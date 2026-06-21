import type { GPUState } from "../gpu/device";
import type { LoadedChunk } from "../world/chunkManager";
import { createCullPipeline } from "./pipelines/cullPipeline";

export class ComputeCuller {
  private gpu: GPUState;
  public pipeline: GPUComputePipeline;

  // Metadata Arrays
  private maxChunks: number = 40_000;
  private cpuChunkData = new Float32Array(this.maxChunks * 12);
  private cpuChunkDataUint = new Uint32Array(this.cpuChunkData.buffer);

  //Opaque SSBOs
  public opaqueChunkDataBuffer: GPUBuffer;
  public opaqueIndirectBuffer: GPUBuffer;
  public opaqueCounterBuffer: GPUBuffer;
  public opaqueBindGroup: GPUBindGroup;

  // Translucent SSBOs
  public transChunkDataBuffer: GPUBuffer;
  public transIndirectBuffer: GPUBuffer;
  public transCounterBuffer: GPUBuffer;
  public transBindGroup: GPUBindGroup;

  constructor(gpu: GPUState, cameraBuffer: GPUBuffer) {
    this.gpu = gpu;
    this.pipeline = createCullPipeline(gpu);

    // --- Allocate Opaque Buffers ---
    this.opaqueChunkDataBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 12 * 4, // 12 floats per chunk, 4 bytes each
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.opaqueIndirectBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 4 * 4, // 4 uints per draw call, 4 bytes each
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
    });
    this.opaqueCounterBuffer = gpu.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.opaqueBindGroup = gpu.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: cameraBuffer } },
        { binding: 1, resource: { buffer: this.opaqueChunkDataBuffer } },
        { binding: 2, resource: { buffer: this.opaqueIndirectBuffer } },
        { binding: 3, resource: { buffer: this.opaqueCounterBuffer } },
      ],
    });

    // --- Allocate Translucent Buffers ---
    this.transChunkDataBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 12 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.transIndirectBuffer = gpu.device.createBuffer({
      size: this.maxChunks * 4 * 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.INDIRECT,
    });
    this.transCounterBuffer = gpu.device.createBuffer({
      size: 4,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
    });
    this.transBindGroup = gpu.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: cameraBuffer } },
        { binding: 1, resource: { buffer: this.transChunkDataBuffer } },
        { binding: 2, resource: { buffer: this.transIndirectBuffer } },
        { binding: 3, resource: { buffer: this.transCounterBuffer } },
      ],
    });
  }

  /**
   * Packs chunk metadata and executes the GPU Frustum Culling shader.
   */
  public executeCullPass(
    commandEncoder: GPUCommandEncoder,
    chunks: LoadedChunk[],
  ) {
    if (chunks.length === 0) return;

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
      chunks.length * 12 * 4,
    );

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const ptr = i * 12;
      this.cpuChunkDataUint[ptr + 8] = chunk.mesh.vertexCounts[1];
      this.cpuChunkDataUint[ptr + 9] =
        chunk.translucentOffset !== null ? chunk.translucentOffset / 12 : 0;
    }

    this.gpu.device.queue.writeBuffer(
      this.transChunkDataBuffer,
      0,
      this.cpuChunkData.buffer,
      0,
      chunks.length * 12 * 4,
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

    const computePass = commandEncoder.beginComputePass();
    computePass.setPipeline(this.pipeline);

    const workgroups = Math.ceil(chunks.length / 64);

    computePass.setBindGroup(0, this.opaqueBindGroup);
    computePass.dispatchWorkgroups(workgroups);

    computePass.setBindGroup(0, this.transBindGroup);
    computePass.dispatchWorkgroups(workgroups);

    computePass.end();
  }
}
