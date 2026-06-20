import { BufferArena } from "../gpu/arena";
import type { GPUState } from "../gpu/device";
import type { GameTime } from "../world/gameTime";
import type { FPCamera } from "./camera/fpCamera";
import {
  createChunkPipeline,
  createTranslucentPipeline,
} from "./pipelines/chunkPipeline";
import { createCullPipeline } from "./pipelines/cullPipeline";
import { createSkyPipeline } from "./pipelines/skyPipeline";
import { TextureAtlas } from "./texture";

export class Renderer {
  public gpu: GPUState;

  public pipeline: GPURenderPipeline;
  public translucentPipeline: GPURenderPipeline;
  public skyPipeline: GPURenderPipeline;
  public cullPipeline: GPUComputePipeline;

  public opaqueChunkDataBuffer: GPUBuffer;
  public opaqueIndirectBuffer: GPUBuffer;
  public opaqueCounterBuffer: GPUBuffer;
  public opaqueComputeBindGroup!: GPUBindGroup;

  public transChunkDataBuffer: GPUBuffer;
  public transIndirectBuffer: GPUBuffer;
  public transCounterBuffer: GPUBuffer;
  public transComputeBindGroup!: GPUBindGroup;

  private cameraBuffer: GPUBuffer;
  private bindGroup: GPUBindGroup;
  private skyVBO: GPUBuffer;

  private depthTexture!: GPUTexture;
  private depthTextureView!: GPUTextureView;

  public textureAtlas: TextureAtlas;

  public opaqueArena: BufferArena;
  public translucentArena: BufferArena;

  private maxChunks = 10000;
  private cpuChunkData = new Float32Array(this.maxChunks * 12);
  private cpuChunkDataUint = new Uint32Array(this.cpuChunkData.buffer);

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
    this.skyPipeline = createSkyPipeline(gpu);
    this.cullPipeline = createCullPipeline(gpu);

    this.opaqueChunkDataBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 48,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.opaqueIndirectBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 16,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
    });
    this.opaqueCounterBuffer = gpu.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.opaqueComputeBindGroup = gpu.device.createBindGroup({
      layout: this.cullPipeline.getBindGroupLayout(0),
      entries: [
        {
          binding: 0,
          resource: { buffer: this.cameraBuffer },
        },
        {
          binding: 1,
          resource: { buffer: this.opaqueChunkDataBuffer },
        },
        {
          binding: 2,
          resource: { buffer: this.opaqueIndirectBuffer },
        },
        {
          binding: 3,
          resource: { buffer: this.opaqueCounterBuffer },
        },
      ],
    });

    this.transChunkDataBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 48,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.transIndirectBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 16,
      usage: GPUBufferUsage.INDIRECT | GPUBufferUsage.STORAGE,
    });
    this.transCounterBuffer = gpu.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });

    this.transComputeBindGroup = gpu.device.createBindGroup({
      layout: this.cullPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.cameraBuffer } },
        { binding: 1, resource: { buffer: this.transChunkDataBuffer } },
        { binding: 2, resource: { buffer: this.transIndirectBuffer } },
        { binding: 3, resource: { buffer: this.transCounterBuffer } },
      ],
    });

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

    // === SKY PIPELINE ===

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

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const ptr = i * 12;

      this.cpuChunkData[ptr] = chunk.x * 16;
      this.cpuChunkData[ptr + 1] = 0;
      this.cpuChunkData[ptr + 2] = chunk.z * 16;

      this.cpuChunkData[ptr + 4] = chunk.x * 16 + 16;
      this.cpuChunkData[ptr + 5] = 128;
      this.cpuChunkData[ptr + 6] = chunk.z * 16 + 16;

      this.cpuChunkDataUint[ptr + 8] = chunk.mesh.vertexCounts[0];
      this.cpuChunkDataUint[ptr + 9] =
        chunk.opaqueOffset !== null ? chunk.opaqueOffset / 12 : 0;
    }
    this.gpu.device.queue.writeBuffer(
      this.opaqueChunkDataBuffer,
      0,
      this.cpuChunkData.buffer,
      0,
      chunks.length * 48,
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const ptr = i * 12;
      this.cpuChunkDataUint[ptr + 8] = chunk.mesh.vertexCounts[1]; // Translucent Count
      this.cpuChunkDataUint[ptr + 9] =
        chunk.translucentOffset !== null ? chunk.translucentOffset / 12 : 0;
    }
    this.gpu.device.queue.writeBuffer(
      this.transChunkDataBuffer,
      0,
      this.cpuChunkData.buffer,
      0,
      chunks.length * 48,
    );

    this.gpu.device.queue.writeBuffer(
      this.opaqueCounterBuffer,
      0,
      new Uint32Array([0]),
    );
    this.gpu.device.queue.writeBuffer(
      this.transCounterBuffer,
      0,
      new Uint32Array([0]),
    );

    const commandEncoder = this.gpu.device.createCommandEncoder();

    // --- PASS 1: COMPUTE CULLING PASS ---
    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.cullPipeline);
    const workgroups = Math.ceil(chunks.length / 64);

    // Dispatch Opaque
    computePass.setBindGroup(0, this.opaqueComputeBindGroup);
    computePass.dispatchWorkgroups(workgroups);

    // Dispatch Translucent
    computePass.setBindGroup(0, this.transComputeBindGroup);
    computePass.dispatchWorkgroups(workgroups);

    computePass.end();

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
      renderPass.setVertexBuffer(0, this.opaqueArena.buffer);
      for (let i = 0; i < chunks.length; i++)
        renderPass.drawIndirect(this.opaqueIndirectBuffer, i * 16);
    }

    renderPass.setPipeline(this.translucentPipeline);
    if (this.textureAtlas.bindGroup) {
      renderPass.setVertexBuffer(0, this.translucentArena.buffer);
      for (let i = 0; i < chunks.length; i++)
        renderPass.drawIndirect(this.transIndirectBuffer, i * 16);
    }

    renderPass.end();
    this.gpu.device.queue.submit([commandEncoder.finish()]);
  }
}
