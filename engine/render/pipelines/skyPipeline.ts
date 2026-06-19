import type { GPUState } from "../../gpu/device";
import skyShader from "../shaders/sky.wgsl?raw";

export function createSkyPipeline(gpu: GPUState): GPURenderPipeline {
  const shaderModule = gpu.device.createShaderModule({
    label: "Sky Shader",
    code: skyShader,
  });

  const bindGroupLayout0 = gpu.device.createBindGroupLayout({
    entries: [
      {
        binding: 0,
        visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
        buffer: {},
      },
    ],
  });

  const bindGroupLayout1 = gpu.device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: {} }, // Anim Buffer
    ],
  });

  const pipelineLayout = gpu.device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout0, bindGroupLayout1],
  });

  return gpu.device.createRenderPipeline({
    label: "Sky Pipeline",
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12, // 3 floats (x, y, z)
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: "float32x3",
            },
          ],
        },
      ],
    },
    fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{format: gpu.format}],
    },
    primitive: {
        topology: "triangle-list",
        cullMode: "none"
    },
    depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus",
    }
  });
}
