import type { IMeshHandle, IRenderer, RenderPassItem } from "./types";
import {
  terrainWGSL,
  skyWGSL,
  entityWGSL,
  highlightWGSL,
  lineWGSL,
} from "./WebGPUShaders";

export interface WebGPUMesh extends IMeshHandle {
  vertexBuffer: GPUBuffer;
  indexBuffer: GPUBuffer;
  indexCount: number;
  modelBuffer: GPUBuffer;
  modelBindGroup: GPUBindGroup;
}

export class WebGPURenderer implements IRenderer {
  public canvas: HTMLCanvasElement;
  public device!: GPUDevice;
  public context!: GPUCanvasContext;
  public format!: GPUTextureFormat;

  public pipeline!: GPURenderPipeline;
  public uniformBuffer!: GPUBuffer;
  public uniformBindGroup!: GPUBindGroup;
  public uniformData!: Float32Array;

  public skyPipeline!: GPURenderPipeline;
  public skyBindGroup!: GPUBindGroup;
  public skyVBO!: GPUBuffer;
  public skyEBO!: GPUBuffer;

  public entityPipeline!: GPURenderPipeline;

  public highlightPipeline!: GPURenderPipeline;
  public highlightVBO!: GPUBuffer;
  public highlightEBO!: GPUBuffer;
  public highlightUniforms!: GPUBuffer;
  public highlightBindGroup!: GPUBindGroup;

  public linePipeline!: GPURenderPipeline;
  public lineVBO!: GPUBuffer;
  public lineUniforms!: GPUBuffer;
  public lineBindGroup!: GPUBindGroup;

  public entityGlobalBindGroup!: GPUBindGroup;
  public highlightGlobalBindGroup!: GPUBindGroup;
  public lineGlobalBindGroup!: GPUBindGroup;

  public textureArray!: GPUTexture;
  public depthTexture!: GPUTexture;
  public sampler!: GPUSampler;

  private commandEncoder!: GPUCommandEncoder;
  private passEncoder!: GPURenderPassEncoder;

  private nextMeshId = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
  }

  public async initialize(): Promise<boolean> {
    if (!navigator.gpu) {
      console.warn("WebGPU is not supported in this browser.");
      return false;
    }

    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      console.warn("Failed to get GPU adapter.");
      return false;
    }

    this.device = await adapter.requestDevice();
    this.context = this.canvas.getContext("webgpu") as GPUCanvasContext;
    this.format = navigator.gpu.getPreferredCanvasFormat();

    this.context.configure({
      device: this.device,
      format: this.format,
      alphaMode: "premultiplied",
    });

    await this.initPipeline();
    this.setupSkybox();

    console.log("WebGPU successfully initialized!");
    return true;
  }

  private async initPipeline() {
    const shaderModule = this.device.createShaderModule({
      label: "Terrain Shader",
      code: terrainWGSL,
    });

    const vertexBufferLayout: GPUVertexBufferLayout = {
      arrayStride: 8,
      attributes: [
        {
          format: "uint32",
          offset: 0,
          shaderLocation: 0, // @location(0) in WGSL (data1)
        },
        {
          format: "uint32",
          offset: 4,
          shaderLocation: 1, // @location(1) in WGSL (data2)
        },
      ],
    };

    this.pipeline = this.device.createRenderPipeline({
      label: "Terrain Pipeline",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [vertexBufferLayout],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: {
                srcFactor: "one",
                dstFactor: "one-minus-src-alpha",
              },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    this.uniformData = new Float32Array(56);
    this.uniformBuffer = this.device.createBuffer({
      size: this.uniformData.byteLength,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    //  === ENTITY PIPELINE ===
    this.entityPipeline = this.device.createRenderPipeline({
      label: "Entity Pipeline",
      layout: "auto",
      vertex: {
        module: this.device.createShaderModule({ code: entityWGSL }),
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 36, // 3 pos + 2 uv + 3 normals + 1 bone = 9 floats * 4 bytes per float
            attributes: [
              { format: "float32x3", offset: 0, shaderLocation: 0 },
              { format: "float32x2", offset: 12, shaderLocation: 1 },
              { format: "float32x3", offset: 20, shaderLocation: 2 },
              { format: "float32", offset: 32, shaderLocation: 3 }, // bone
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: entityWGSL }),
        entryPoint: "fs_main",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "back",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    // === HIGHLIGHT PIPELINE ===
    this.highlightPipeline = this.device.createRenderPipeline({
      label: "Highlight Pipeine",
      layout: "auto",
      vertex: {
        module: this.device.createShaderModule({ code: highlightWGSL }),
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 24,
            attributes: [
              { format: "float32x3", offset: 0, shaderLocation: 0 },
              { format: "float32x3", offset: 12, shaderLocation: 1 },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: highlightWGSL }),
        entryPoint: "fs_main",
        targets: [
          {
            format: this.format,
            blend: {
              color: {
                srcFactor: "src-alpha",
                dstFactor: "one-minus-src-alpha",
              },
              alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha" },
            },
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: true,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    this.highlightVBO = this.device.createBuffer({
      size: 96, // 4 verts * 24 bytes
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.highlightEBO = this.device.createBuffer({
      size: 12, // 6 indices * 2 bytes
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });

    this.device.queue.writeBuffer(
      this.highlightEBO,
      0,
      new Uint16Array([0, 1, 2, 2, 3, 0]),
    );

    this.highlightUniforms = this.device.createBuffer({
      size: 80, // Mat4 + Alpha + Padding
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // === LINE PIPELINE & BUFFERS ===
    this.linePipeline = this.device.createRenderPipeline({
      label: "Line Pipeline",
      layout: "auto",
      vertex: {
        module: this.device.createShaderModule({ code: lineWGSL }),
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 12, // 3 pos
            attributes: [
              {
                format: "float32x3",
                offset: 0,
                shaderLocation: 0,
              },
            ],
          },
        ],
      },
      fragment: {
        module: this.device.createShaderModule({ code: lineWGSL }),
        entryPoint: "fs_main",
        targets: [{ format: this.format }],
      },
      primitive: {
        topology: "line-list",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less",
        format: "depth24plus",
      },
    });

    this.lineVBO = this.device.createBuffer({
      size: 24,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.lineUniforms = this.device.createBuffer({
      size: 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  public createMesh(
    vertexData: Uint32Array,
    indexData: Uint32Array,
  ): IMeshHandle {
    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(indexBuffer, 0, indexData);

    const modelBuffer = this.device.createBuffer({
      size: 64, // 16 floats * 4 bytes
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const modelBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: modelBuffer,
          },
        },
      ],
    });

    return {
      id: this.nextMeshId++,
      vertexBuffer,
      indexBuffer,
      indexCount: indexData.length,
      modelBuffer,
      modelBindGroup,
    } as WebGPUMesh;
  }

  public updateMesh(
    mesh: IMeshHandle,
    vertexData: Uint32Array,
    indexData: Uint32Array,
  ): void {
    const gpuMesh = mesh as WebGPUMesh;

    if (gpuMesh.vertexBuffer.size < vertexData.byteLength) {
      gpuMesh.vertexBuffer.destroy();
      gpuMesh.vertexBuffer = this.device.createBuffer({
        size: vertexData.byteLength,
        usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
      });
    }

    this.device.queue.writeBuffer(gpuMesh.vertexBuffer, 0, vertexData);

    if (gpuMesh.indexBuffer.size < indexData.byteLength) {
      gpuMesh.indexBuffer.destroy();
      gpuMesh.indexBuffer = this.device.createBuffer({
        size: indexData.byteLength,
        usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
      });
    }
    this.device.queue.writeBuffer(gpuMesh.indexBuffer, 0, indexData);

    gpuMesh.indexCount = indexData.length;
  }

  public deleteMesh(mesh: IMeshHandle): void {
    const gpuMesh = mesh as WebGPUMesh;
    gpuMesh.vertexBuffer.destroy();
    gpuMesh.indexBuffer.destroy();
    gpuMesh.modelBuffer.destroy();
  }

  public beginFrame(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    skyColor: number[],
  ): void {
    if (!this.device) return;

    if (
      !this.depthTexture ||
      this.depthTexture.width !== this.canvas.width ||
      this.depthTexture.height !== this.canvas.height
    ) {
      if (this.depthTexture) this.depthTexture.destroy();
      this.depthTexture = this.device.createTexture({
        size: [this.canvas.width, this.canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });
    }

    this.commandEncoder = this.device.createCommandEncoder();
    const textureView = this.context.getCurrentTexture().createView();

    const renderPassDescriptor: GPURenderPassDescriptor = {
      colorAttachments: [
        {
          view: textureView,
          clearValue: {
            r: skyColor[0],
            g: skyColor[1],
            b: skyColor[2],
            a: 1.0,
          },
          loadOp: "clear",
          storeOp: "store",
        },
      ],
      depthStencilAttachment: {
        view: this.depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store",
      },
    };

    this.passEncoder =
      this.commandEncoder.beginRenderPass(renderPassDescriptor);
  }

  public endFrame(): void {
    if (!this.passEncoder || !this.commandEncoder) return;

    this.passEncoder.end();
    this.device.queue.submit([this.commandEncoder.finish()]);
  }

  public drawWorld(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    solidPass: RenderPassItem[],
    transPass: RenderPassItem[],
    sunDir: [number, number, number],
    playerPos: [number, number, number],
    holdingTorch: number,
    timeVal: number,
  ): void {
    if (!this.pipeline || !this.uniformBindGroup || !this.passEncoder) return;

    if (this.uniformData.length !== 40) {
      this.uniformData = new Float32Array(40);
    }

    this.uniformData.set(projMatrix, 0); //  Floats 0-15
    this.uniformData.set(viewMatrix, 16); // Floats 16-31
    this.uniformData.set(sunDir, 32); // Floats 32-34
    this.uniformData[35] = timeVal; // Float 35
    this.uniformData.set(playerPos, 36); // Floats 36-38
    this.uniformData[39] = holdingTorch; // Float 39

    this.device.queue.writeBuffer(this.uniformBuffer, 0, this.uniformData);

    this.passEncoder.setPipeline(this.pipeline);
    this.passEncoder.setBindGroup(0, this.uniformBindGroup);

    const drawChunks = (chunks: RenderPassItem[]) => {
      for (const chunk of chunks) {
        const gpuMesh = chunk.mesh as WebGPUMesh;
        if (!gpuMesh || !gpuMesh.vertexBuffer) continue;

        this.device.queue.writeBuffer(gpuMesh.modelBuffer, 0, chunk.model);

        this.passEncoder.setBindGroup(1, gpuMesh.modelBindGroup);
        this.passEncoder.setVertexBuffer(0, gpuMesh.vertexBuffer);
        this.passEncoder.setIndexBuffer(gpuMesh.indexBuffer, "uint32");
        this.passEncoder.drawIndexed(gpuMesh.indexCount);
      }
    };

    drawChunks(solidPass);
    drawChunks(transPass);
  }

  public createTextureArrayFromImage(
    images: HTMLImageElement[],
    textureSize: number,
  ): void {
    this.textureArray = this.device.createTexture({
      size: [textureSize, textureSize, images.length],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    for (let i = 0; i < images.length; i++) {
      this.device.queue.copyExternalImageToTexture(
        { source: images[i], flipY: true },
        { texture: this.textureArray, origin: [0, 0, i] },
        [textureSize, textureSize, 1],
      );
    }

    this.sampler = this.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    this.uniformBindGroup = this.device.createBindGroup({
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        {
          binding: 1,
          resource: this.textureArray.createView({ dimension: "2d-array" }),
        },
        { binding: 2, resource: this.sampler },
      ],
    });

    this.highlightBindGroup = this.device.createBindGroup({
      layout: this.highlightPipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: this.highlightUniforms } }],
    });

    this.lineBindGroup = this.device.createBindGroup({
      layout: this.linePipeline.getBindGroupLayout(1),
      entries: [{ binding: 0, resource: { buffer: this.lineUniforms } }],
    });

    // === Forge Global Key for Entities ===
    this.entityGlobalBindGroup = this.device.createBindGroup({
      layout: this.entityPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        {
          binding: 1,
          resource: this.textureArray.createView({ dimension: "2d-array" }),
        },
        { binding: 2, resource: this.sampler },
      ],
    });

    // === Forge Global Key for Highlights ===
    this.highlightGlobalBindGroup = this.device.createBindGroup({
      layout: this.highlightPipeline.getBindGroupLayout(0),
      entries: [
        { binding: 0, resource: { buffer: this.uniformBuffer } },
        {
          binding: 1,
          resource: this.textureArray.createView({ dimension: "2d-array" }),
        },
        { binding: 2, resource: this.sampler },
      ],
    });

    // === Forge Global Key for Lines (No textures needed here!) ===
    this.lineGlobalBindGroup = this.device.createBindGroup({
      layout: this.linePipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
  }

  public setupSkybox(): void {
    const vData = new Float32Array([
      -1, 1, -1, -1, -1, -1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, -1, 1, 1, -1, 1,
      1, 1, 1,
    ]);

    const iData = new Uint16Array([
      0,
      1,
      2,
      2,
      3,
      0, // Back
      4,
      5,
      6,
      6,
      7,
      4, // Front
      4,
      5,
      1,
      1,
      0,
      4, // Left
      3,
      2,
      6,
      6,
      7,
      3, // Right
      4,
      0,
      3,
      3,
      7,
      4, // Top
      1,
      5,
      6,
      6,
      2,
      1, // Bottom
    ]);

    this.skyVBO = this.device.createBuffer({
      size: vData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.skyVBO, 0, vData);

    this.skyEBO = this.device.createBuffer({
      size: iData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(this.skyEBO, 0, iData);

    const shaderModule = this.device.createShaderModule({ code: skyWGSL });

    this.skyPipeline = this.device.createRenderPipeline({
      label: "Skybox Pipeline",
      layout: "auto",
      vertex: {
        module: shaderModule,
        entryPoint: "vs_main",
        buffers: [
          {
            arrayStride: 12, // 3 floats * 4 bytes
            attributes: [
              {
                format: "float32x3",
                offset: 0,
                shaderLocation: 0, // @location(0) in WGSL
              },
            ],
          },
        ],
      },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [
          {
            format: this.format,
          },
        ],
      },
      primitive: {
        topology: "triangle-list",
        cullMode: "none",
      },
      depthStencil: {
        depthWriteEnabled: false,
        depthCompare: "less-equal",
        format: "depth24plus",
      },
    });

    this.skyBindGroup = this.device.createBindGroup({
      layout: this.skyPipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.uniformBuffer } }],
    });
  }

  public drawSkybox(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    sunDirection: [number, number, number],
  ): void {
    if (!this.passEncoder || !this.skyPipeline) return;

    this.passEncoder.setPipeline(this.skyPipeline);
    this.passEncoder.setBindGroup(0, this.skyBindGroup);
    this.passEncoder.setVertexBuffer(0, this.skyVBO);
    this.passEncoder.setIndexBuffer(this.skyEBO, "uint16");
    this.passEncoder.drawIndexed(36);
  }

  public createEntityMesh(
    vertexData: Float32Array,
    indexData: Uint16Array,
  ): IMeshHandle {
    const vertexBuffer = this.device.createBuffer({
      size: vertexData.byteLength,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(vertexBuffer, 0, vertexData);

    const indexBuffer = this.device.createBuffer({
      size: indexData.byteLength,
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    this.device.queue.writeBuffer(indexBuffer, 0, indexData);

    const modelBuffer = this.device.createBuffer({
      size: 80,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const modelBindGroup = this.device.createBindGroup({
      layout: this.entityPipeline.getBindGroupLayout(1),
      entries: [
        {
          binding: 0,
          resource: {
            buffer: modelBuffer,
          },
        },
      ],
    });

    return {
      id: this.nextMeshId++,
      vertexBuffer,
      indexBuffer,
      indexCount: indexData.length,
      modelBuffer,
      modelBindGroup,
    } as WebGPUMesh;
  }

  public drawEntity(
    mesh: IMeshHandle,
    modelMatrix: Float32Array,
    sunDir: [number, number, number],
    textureLayer: number,
    isMoving: number,
    damageFlash: number,
  ): void {
    if (!this.passEncoder || !this.entityPipeline) return;

    const gpuMesh = mesh as WebGPUMesh;

    const uniformData = new Float32Array(20);
    uniformData.set(modelMatrix, 0); // 16 floats
    uniformData[16] = textureLayer;
    uniformData[17] = isMoving;
    uniformData[18] = damageFlash;

    this.device.queue.writeBuffer(gpuMesh.modelBuffer, 0, uniformData);

    this.passEncoder.setPipeline(this.entityPipeline);
    this.passEncoder.setBindGroup(0, this.entityGlobalBindGroup);
    this.passEncoder.setBindGroup(1, gpuMesh.modelBindGroup);
    this.passEncoder.setVertexBuffer(0, gpuMesh.vertexBuffer);
    this.passEncoder.setIndexBuffer(gpuMesh.indexBuffer, "uint16");
    this.passEncoder.drawIndexed(gpuMesh.indexCount);
  }

  public drawHighlight(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    hitX: number,
    hitY: number,
    hitZ: number,
    normal: number[],
    layerId: number,
  ): void {
    if (!this.passEncoder || !this.highlightPipeline) return;

    // Build the vertices identical to WebGL (Omitted for brevity, just copy your WebGL vertex building math here...)
    const offset = 0.005;
    const px = hitX + 0.5 + normal[0] * (0.5 + offset);
    const py = hitY + 0.5 + normal[1] * (0.5 + offset);
    const pz = hitZ + 0.5 + normal[2] * (0.5 + offset);

    let tx, ty;
    if (Math.abs(normal[1]) == 1) {
      tx = [1, 0, 0];
      ty = [0, 0, 1];
    } else if (Math.abs(normal[0]) == 1) {
      tx = [0, 1, 0];
      ty = [0, 0, 1];
    } else {
      tx = [1, 0, 0];
      ty = [0, 1, 0];
    }

    const s = 0.505;
    const vData = new Float32Array(24);
    const corners = [
      [-1, -1],
      [1, -1],
      [1, 1],
      [-1, 1],
    ];
    const uvCoords = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];

    for (let i = 0; i < 4; i++) {
      vData[i * 6 + 0] =
        px + tx[0] * corners[i][0] * s + ty[0] * corners[i][1] * s;
      vData[i * 6 + 1] =
        py + tx[1] * corners[i][0] * s + ty[1] * corners[i][1] * s;
      vData[i * 6 + 2] =
        pz + tx[2] * corners[i][0] * s + ty[2] * corners[i][1] * s;
      vData[i * 6 + 3] = uvCoords[i][0];
      vData[i * 6 + 4] = uvCoords[i][1];
      vData[i * 6 + 5] = layerId;
    }

    this.device.queue.writeBuffer(this.highlightVBO, 0, vData);

    const uData = new Float32Array(20);
    uData.set([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1], 0);
    uData[16] = 0.3;
    this.device.queue.writeBuffer(this.highlightUniforms, 0, uData);

    this.passEncoder.setPipeline(this.highlightPipeline);
    this.passEncoder.setBindGroup(0, this.highlightGlobalBindGroup);
    this.passEncoder.setBindGroup(1, this.highlightBindGroup);
    this.passEncoder.setVertexBuffer(0, this.highlightVBO);
    this.passEncoder.setIndexBuffer(this.highlightEBO, "uint16");
    this.passEncoder.drawIndexed(6);
  }

  public drawLine(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    r: number,
    g: number,
    b: number,
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
  ): void {
    if (!this.passEncoder || !this.linePipeline) return;

    this.device.queue.writeBuffer(
      this.lineVBO,
      0,
      new Float32Array([startX, startY, startZ, endX, endY, endZ]),
    );
    this.device.queue.writeBuffer(
      this.lineUniforms,
      0,
      new Float32Array([r, g, b, 1.0]),
    );

    this.passEncoder.setPipeline(this.linePipeline);

    this.passEncoder.setBindGroup(0, this.lineGlobalBindGroup);
    this.passEncoder.setBindGroup(1, this.lineBindGroup);
    this.passEncoder.setVertexBuffer(0, this.lineVBO);
    this.passEncoder.draw(2);
  }
}
