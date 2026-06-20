import type { GPUState } from "../../gpu/device";
import cullShader from "../shaders/cull.wgsl?raw";

export function createCullPipeline(gpu: GPUState): GPUComputePipeline {
  const shaderModule = gpu.device.createShaderModule({
    label: "Cull Compute Shader",
    code: cullShader,
  });

  const bindGroupLayout = gpu.device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "uniform",
        },
      },
      {
        binding: 1,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "read-only-storage",
        },
      },
      {
        binding: 2,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage",
        },
      },
      {
        binding: 3,
        visibility: GPUShaderStage.COMPUTE,
        buffer: {
          type: "storage",
        },
      },
    ],
  });

  const pipelineLayout = gpu.device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout],
  });

  return gpu.device.createComputePipeline({
    label: "Cull Pipeline",
    layout: pipelineLayout,
    compute: {
      module: shaderModule,
      entryPoint: "cs_main",
    },
  });
}
