import type { GPUState } from "../../gpu/device";
import chunkShader from "../shaders/chunk.wgsl?raw";

function getSharedPipelineConfig(gpu: GPUState): GPURenderPipelineDescriptor {
  const shaderModule = gpu.device.createShaderModule({
    label: "Chunk Shader",
    code: chunkShader,
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
      { binding: 2, visibility: GPUShaderStage.VERTEX, buffer: {} },
    ],
  });

  const bindGroupLayout2 = gpu.device.createBindGroupLayout({
    entries: [{ binding: 0, visibility: GPUShaderStage.VERTEX, buffer: {} }],
  });

  const pipelineLayout = gpu.device.createPipelineLayout({
    bindGroupLayouts: [bindGroupLayout0, bindGroupLayout1, bindGroupLayout2],
  });

  return {
    label: "Base Chunk Pipeline",
    layout: pipelineLayout,
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [
        {
          arrayStride: 12, 
          attributes: [
            { shaderLocation: 0, offset: 0, format: "uint32" }, 
            { shaderLocation: 1, offset: 4, format: "uint32" }, 
            { shaderLocation: 2, offset: 8, format: "uint32" }, 
          ],
        },
      ],
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [
        {
          format: gpu.format,
          blend: {
            color: {
              srcFactor: "src-alpha",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
            alpha: {
              srcFactor: "one",
              dstFactor: "one-minus-src-alpha",
              operation: "add",
            },
          },
        },
      ],
    },
    primitive: { topology: "triangle-list" }
  };
}

export function createChunkPipeline(gpu: GPUState): GPURenderPipeline {
  const config = getSharedPipelineConfig(gpu);
  
  config.label = "Opaque Chunk Pipeline";
  config.primitive = {
    topology: "triangle-list",
    cullMode: "back",
  };
  config.depthStencil = {
    depthWriteEnabled: true,
    depthCompare: "less",
    format: "depth24plus",
  };

  return gpu.device.createRenderPipeline(config);
}

export function createTranslucentPipeline(gpu: GPUState): GPURenderPipeline {
  const config = getSharedPipelineConfig(gpu);
  
  config.label = "Translucent Chunk Pipeline";
  config.primitive = {
    topology: "triangle-list",
    cullMode: "none",
  };
  config.depthStencil = {
    depthWriteEnabled: false,
    depthCompare: "less",
    format: "depth24plus",
  };

  return gpu.device.createRenderPipeline(config);
}