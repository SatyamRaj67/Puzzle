import type { GPUState } from "../gpu/device";
import type { ParsedBlock } from "../world/blockRegistry";

export class TextureAtlas {
  public texture!: GPUTexture;
  public sampler!: GPUSampler;
  public bindGroup!: GPUBindGroup;
  public animBuffer!: GPUBuffer;

  private gpu: GPUState;

  private atlasSize = 256; // 16x16 grid
  private tileSize = 16;

  public textureMap: Map<string, number> = new Map();

  constructor(gpu: GPUState) {
    this.gpu = gpu;

    this.sampler = this.gpu.device.createSampler({
      magFilter: "nearest",
      minFilter: "nearest",
      addressModeU: "repeat",
      addressModeV: "repeat",
    });

    this.animBuffer = this.gpu.device.createBuffer({
      size: 128 * 16,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
  }

  public async buildAtlas(blocks: ParsedBlock[], pipeline: GPURenderPipeline) {
    const canvas = document.createElement("canvas");
    canvas.width = this.atlasSize;
    canvas.height = this.atlasSize;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    })!;

    let currentSlot = 0;
    let animData = new Float32Array(128 * 4);

    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
      });
    };

    for (const block of blocks) {
      for (const textureUrl of block.textures) {
        if (!this.textureMap.has(textureUrl)) {
          this.textureMap.set(textureUrl, currentSlot);

          const img = await loadImage(textureUrl);

          if (block.frames > 1) {
            for (let i = 0; i < block.frames; i++) {
              const slotId = currentSlot + i;
              const destX = (slotId % 16) * this.tileSize;
              const destY = Math.floor(slotId / 16) * this.tileSize;

              ctx.drawImage(
                img,
                0,
                i * this.tileSize,
                this.tileSize,
                this.tileSize,
                destX,
                destY,
                this.tileSize,
                this.tileSize,
              );

              animData[currentSlot * 4 + 0] = block.frames;
              animData[currentSlot * 4 + 1] = block.speed;
            }
            currentSlot += block.frames;
          } else {
            const destX = (currentSlot % 16) * this.tileSize;
            const destY = Math.floor(currentSlot / 16) * this.tileSize;
            ctx.drawImage(img, destX, destY, this.tileSize, this.tileSize);

            animData[currentSlot * 4 + 0] = 1; // 1 frame
            animData[currentSlot * 4 + 1] = 0; // 0 speed
            currentSlot++;
          }
        }
      }
    }

    this.gpu.device.queue.writeBuffer(this.animBuffer, 0, animData);

    const imageBitmap = await createImageBitmap(canvas);
    this.texture = this.gpu.device.createTexture({
      size: [this.atlasSize, this.atlasSize, 1],
      format: "rgba8unorm",
      usage:
        GPUTextureUsage.TEXTURE_BINDING |
        GPUTextureUsage.COPY_DST |
        GPUTextureUsage.RENDER_ATTACHMENT,
    });

    this.gpu.device.queue.copyExternalImageToTexture(
      { source: imageBitmap },
      { texture: this.texture },
      [this.atlasSize, this.atlasSize],
    );

    this.bindGroup = this.gpu.device.createBindGroup({
      layout: pipeline.getBindGroupLayout(1),
      entries: [
        { binding: 0, resource: this.sampler },
        { binding: 1, resource: this.texture.createView() },
        { binding: 2, resource: { buffer: this.animBuffer } },
      ],
    });

    console.log("Texture Atlas Compiled and Uploaded to GPU.");
  }
}
