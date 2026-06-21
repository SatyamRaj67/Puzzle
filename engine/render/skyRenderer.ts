import type { GPUState } from "../gpu/device";
import { createSkyPipeline } from "./pipelines/skyPipeline";
import type { TextureAtlas } from "./texture";

export class SkyRenderer {
  private gpu: GPUState;
  public pipeline: GPURenderPipeline;

  private vbo: GPUBuffer;

  constructor(gpu: GPUState) {
    this.gpu = gpu;
    this.pipeline = createSkyPipeline(gpu);

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

    this.vbo = this.gpu.device.createBuffer({
      size: vData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    this.gpu.device.queue.writeBuffer(this.vbo, 0, vData);
  }

  /**
   * Appends the sky drawing commands to the active render pass.
   */
  public draw(
    renderPass: GPURenderPassEncoder,
    globalBindGroup: GPUBindGroup,
    atlas: TextureAtlas,
  ) {
    renderPass.setPipeline(this.pipeline);
    renderPass.setBindGroup(0, globalBindGroup);

    if (atlas.bindGroup) {
      renderPass.setBindGroup(1, atlas.bindGroup);
    }

    renderPass.setVertexBuffer(0, this.vbo);
    renderPass.draw(36);
  }
}
