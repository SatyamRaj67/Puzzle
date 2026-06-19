import type { GPUState } from "../gpu/device";
import type { GameTime } from "../world/gameTime";
import type { FPCamera } from "./camera/fpCamera";
import {
  createChunkPipeline,
  createTranslucentPipeline,
} from "./pipelines/chunkPipeline";
import { createSkyPipeline } from "./pipelines/skyPipeline";
import { TextureAtlas } from "./texture";

export class Renderer {
  private gpu: GPUState;
  public pipeline: GPURenderPipeline;
  private cameraBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;

  public translucentPipeline: GPURenderPipeline;

  public skyPipeline: GPURenderPipeline;
  private skyVBO: GPUBuffer;

  private faceUniformBuffers: GPUBuffer[] = [];
  private faceBindGroups: GPUBindGroup[] = [];

  private depthTexture!: GPUTexture;
  private depthTextureView!: GPUTextureView;

  public textureAtlas: TextureAtlas;

  constructor(gpu: GPUState, canvasWidth: number, canvasHeight: number) {
    this.gpu = gpu;

    this.cameraBuffer = gpu.device.createBuffer({
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    this.resizeDepthTexture(canvasWidth, canvasHeight);

    this.textureAtlas = new TextureAtlas(gpu);

    this.pipeline = createChunkPipeline(gpu);
    this.translucentPipeline = createTranslucentPipeline(gpu);

    for (let i = 0; i < 16; i++) {
      const buffer = gpu.device.createBuffer({
        size: 16,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
      });

      const shaderFaceId = i >= 10 ? i - 10 : i;
      gpu.device.queue.writeBuffer(buffer, 0, new Uint32Array([shaderFaceId]));

      const bindGroup = gpu.device.createBindGroup({
        layout: this.pipeline.getBindGroupLayout(2),
        entries: [{ binding: 0, resource: { buffer: buffer } }],
      });

      this.faceUniformBuffers.push(buffer);
      this.faceBindGroups.push(bindGroup);
    }

    this.bindGroup = gpu.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: this.cameraBuffer,
          },
        },
      ],
    });

    // === SKY PIPELINE ===
    this.skyPipeline = createSkyPipeline(gpu);

    const vData = new Float32Array([
      -1,
      1,
      -1,
      -1,
      -1,
      -1,
      1,
      -1,
      -1,
      -1,
      1,
      -1,
      1,
      -1,
      -1,
      1,
      1,
      -1, // Front
      1,
      1,
      1,
      1,
      -1,
      1,
      -1,
      -1,
      1,
      1,
      1,
      1,
      -1,
      -1,
      1,
      -1,
      1,
      1, // Back
      -1,
      1,
      1,
      -1,
      -1,
      1,
      -1,
      -1,
      -1,
      -1,
      1,
      1,
      -1,
      -1,
      -1,
      -1,
      1,
      -1, // Left
      1,
      1,
      -1,
      1,
      -1,
      -1,
      1,
      -1,
      1,
      1,
      1,
      -1,
      1,
      -1,
      1,
      1,
      1,
      1, // Right
      -1,
      1,
      1,
      -1,
      1,
      -1,
      1,
      1,
      -1,
      -1,
      1,
      1,
      1,
      1,
      -1,
      1,
      1,
      1, // Top
      -1,
      -1,
      -1,
      -1,
      -1,
      1,
      1,
      -1,
      1,
      -1,
      -1,
      -1,
      1,
      -1,
      1,
      1,
      -1,
      -1, // Bottom
    ]);

    this.skyVBO = this.gpu.device.createBuffer({
      size: vData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.gpu.device.queue.writeBuffer(this.skyVBO, 0, vData);
  }

  public resizeDepthTexture(width: number, height: number) {
    if (this.depthTexture) this.depthTexture.destroy();

    this.depthTexture = this.gpu.device.createTexture({
      size: [width, height],
      format: "depth24plus",
      usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.depthTextureView = this.depthTexture.createView();
  }

  public createVertexBuffer(data: Uint32Array): GPUBuffer {
    const buffer = this.gpu.device.createBuffer({
      size: data.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.gpu.device.queue.writeBuffer(buffer, 0, data);
    return buffer;
  }

  public drawMultiple(
    camera: FPCamera,
    elapsedTime: number,
    chunks: any[],
    gameTime: GameTime,
    heldLightLevel: number,
  ): void {
    const uploadData = new Float32Array(28);
    uploadData.set(camera.viewProjMatrix, 0);

    const sunDir = gameTime.getSunDirection();
    uploadData[16] = sunDir[0];
    uploadData[17] = sunDir[1];
    uploadData[18] = sunDir[2];
    uploadData[19] = gameTime.timeOfDay;
    uploadData[20] = elapsedTime;

    uploadData[21] = camera.position[0];
    uploadData[22] = camera.position[1];
    uploadData[23] = camera.position[2];

    uploadData[24] = heldLightLevel;

    this.gpu.device.queue.writeBuffer(
      this.cameraBuffer,
      0,
      uploadData.buffer,
      uploadData.byteOffset,
      uploadData.byteLength,
    );

    const commandEncoder = this.gpu.device.createCommandEncoder();
    const textureView = this.gpu.context.getCurrentTexture().createView();

    const renderPass = commandEncoder.beginRenderPass({
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: 0,
            g: 0,
            b: 0,
            a: 1.0,
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTextureView,
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    });

    // Draw Sky
    renderPass.setPipeline(this.skyPipeline);
    renderPass.setBindGroup(0, this.bindGroup);

    if (this.textureAtlas.bindGroup) {
      renderPass.setBindGroup(1, this.textureAtlas.bindGroup);
    }

    renderPass.setVertexBuffer(0, this.skyVBO);
    renderPass.draw(36);

    // Draw Chunks
    renderPass.setPipeline(this.pipeline);
    if (this.textureAtlas.bindGroup) {
      for (const chunk of chunks) {
        for (let i = 0; i < 10; i++) {
          if (chunk.mesh.vertexCounts[i] > 0 && chunk.buffers[i]) {
            renderPass.setBindGroup(2, this.faceBindGroups[i]);
            renderPass.setVertexBuffer(0, chunk.buffers[i]);
            renderPass.draw(chunk.mesh.vertexCounts[i]);
          }
        }
      }
    }

    renderPass.setPipeline(this.translucentPipeline);
    if (this.textureAtlas.bindGroup) {
      for (const chunk of chunks) {
        for (let i = 10; i < 16; i++) {
          if (chunk.mesh.vertexCounts[i] > 0 && chunk.buffers[i]) {
            renderPass.setBindGroup(2, this.faceBindGroups[i]);
            renderPass.setVertexBuffer(0, chunk.buffers[i]);
            renderPass.draw(chunk.mesh.vertexCounts[i]);
          }
        }
      }
    }

    renderPass.end();
    this.gpu.device.queue.submit([commandEncoder.finish()]);
  }
}
