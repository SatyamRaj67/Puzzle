import { BufferArena } from "../gpu/arena";
import type { GPUState } from "../gpu/device";
import type { GameTime } from "../world/gameTime";
import type { FPCamera } from "./camera/fpCamera";
import { ComputeCuller } from "./computeCuller";
import {
  createChunkPipeline,
  createTranslucentPipeline,
} from "./pipelines/chunkPipeline";
import { SkyRenderer } from "./skyRenderer";
import { TextureAtlas } from "./texture";

export class Renderer {
  public gpu: GPUState;

  // Render Pipelines
  public pipeline: GPURenderPipeline;
  public translucentPipeline: GPURenderPipeline;

  // Systems
  public textureAtlas: TextureAtlas;
  public culler: ComputeCuller;
  public sky: SkyRenderer;

  // Memory
  public opaqueArena: BufferArena;
  public translucentArena: BufferArena;
  private cameraBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;

  private depthTexture!: GPUTexture;
  private depthTextureView!: GPUTextureView;

  constructor(gpu: GPUState, canvasWidth: number, canvasHeight: number) {
    this.gpu = gpu;

    // Core State
    this.cameraBuffer = gpu.device.createBuffer({
      size: 112,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    this.resizeDepthTexture(canvasWidth, canvasHeight);
    this.textureAtlas = new TextureAtlas(gpu);

    // Initialize Sub systems
    this.pipeline = createChunkPipeline(gpu);
    this.translucentPipeline = createTranslucentPipeline(gpu);

    this.sky = new SkyRenderer(gpu);
    this.culler = new ComputeCuller(gpu, this.cameraBuffer);

    // Arenas
    this.opaqueArena = new BufferArena(
      gpu.device,
      64 * 1024 * 1024,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      "Opaque Arena",
    );

    this.translucentArena = new BufferArena(
      gpu.device,
      16 * 1024 * 1024,
      GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      "Translucent Arena",
    );

    this.bindGroup = gpu.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.cameraBuffer },
        },
      ],
    });
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

  public drawMultiple(
    camera: FPCamera,
    elapsedTime: number,
    chunks: any[],
    gameTime: GameTime,
    heldLightLevel: number,
  ): void {
    if (chunks.length === 0) return;

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

    this.culler.executeCullPass(commandEncoder, chunks);

    // --- PASS 2: RENDERING PASS ---
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
    this.sky.draw(renderPass, this.bindGroup, this.textureAtlas);

    // Draw Chunks
    renderPass.setPipeline(this.pipeline);
    if (this.textureAtlas.bindGroup) {
      renderPass.setVertexBuffer(0, this.opaqueArena.buffer);
      for (let i = 0; i < chunks.length; i++)
        renderPass.drawIndirect(this.culler.opaqueIndirectBuffer, i * 16);
    }

    renderPass.setPipeline(this.translucentPipeline);
    if (this.textureAtlas.bindGroup) {
      renderPass.setVertexBuffer(0, this.translucentArena.buffer);
      for (let i = 0; i < chunks.length; i++)
        renderPass.drawIndirect(this.culler.transIndirectBuffer, i * 16);
    }

    renderPass.end();
    this.gpu.device.queue.submit([commandEncoder.finish()]);
  }
}
