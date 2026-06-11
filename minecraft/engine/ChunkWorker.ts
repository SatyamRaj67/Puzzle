import { VoxelChunk } from "./VoxelChunk";
import { PerlinNoise } from "./Noise";
import { FeatureGenerator } from "./FeatureGenerator";
import type { BlockIdMap, BlockRegistry } from "./types";

export interface WorkerInitMessage {
  type: "init";
  blocks: BlockIdMap;
  blockRegistry: BlockRegistry;
}

export interface WorkerChunkMessage {
  cx: number;
  cz: number;
  chunkWidth: number;
  chunkHeight: number;
  recycledBuffer: ArrayBuffer | null;
  type?: never;
}

export type WorkerMessage = WorkerInitMessage | WorkerChunkMessage;

const terrainNoise = new PerlinNoise();
const treeNoise = new PerlinNoise();

let BLOCKS: BlockIdMap | null = null;
let BLOCK_REGISTRY: BlockRegistry | null = null;

self.onmessage = function (event: MessageEvent<WorkerMessage>) {
  const data = event.data;
  if (data.type === "init") {
    BLOCKS = data.blocks;
    BLOCK_REGISTRY = data.blockRegistry;
    return;
  }

  // Recieve instructions from main thread
  const { cx, cz, chunkWidth, chunkHeight, recycledBuffer } = data;

  const chunk = new VoxelChunk(chunkWidth, chunkHeight, recycledBuffer);

  if (recycledBuffer) {
    chunk.reset();
  }

  const WATER_LEVEL = 40;
  const SNOW_LEVEL = 85;
  const STONE_LEVEL = 70;

  chunk.generateProceduralTerrain = function (
    noise: PerlinNoise,
    offsetX: number,
    offsetZ: number,
    BLOCKS: BlockIdMap,
  ) {
    const octaves = 5;
    const persistence = 0.5;
    const lacunarity = 2.0;
    const scale = 0.008;
    const baseHeight = 15;
    const maxAmplitude = 90;

    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.width; z++) {
        let amplitude = 1;
        let frequency = 1;
        let noiseHeight = 0;
        let maxValue = 0;

        for (let octave = 0; octave < octaves; octave++) {
          const worldX = (x + offsetX) * scale * frequency;
          const worldZ = (z + offsetZ) * scale * frequency;

          noiseHeight += noise.get(worldX, worldZ) * amplitude;
          maxValue += amplitude;

          amplitude *= persistence;
          frequency *= lacunarity;
        }

        const normalizedNoise = noiseHeight / maxValue;
        const sharpNoise = Math.pow(normalizedNoise, 1.5);
        const terrainHeight = Math.floor(
          baseHeight + sharpNoise * maxAmplitude,
        );

        const secondaryNoise = noise.get(
          (x + offsetX) * 0.05,
          (z + offsetZ) * 0.05,
        );
        const localSnowLine = SNOW_LEVEL + secondaryNoise * 15;
        const localStoneLine = STONE_LEVEL + secondaryNoise * 20;

        for (let y = 0; y < this.height; y++) {
          if (y > terrainHeight) {
            if (y <= WATER_LEVEL) {
              this.setBlock(x, y, z, BLOCKS.WATER);
            } else {
              this.setBlock(x, y, z, BLOCKS.AIR);
            }
          } else if (y === terrainHeight) {
            if (y > localSnowLine) {
              this.setBlock(x, y, z, BLOCKS.SNOW);
            } else if (y > localStoneLine) {
              this.setBlock(x, y, z, BLOCKS.STONE);
            } else if (y <= WATER_LEVEL + 1) {
              this.setBlock(x, y, z, BLOCKS.DIRT);
            } else {
              this.setBlock(x, y, z, BLOCKS.GRASS_BLOCK);
            }
          } else if (y > terrainHeight - 4) {
            if (y > localStoneLine) {
              this.setBlock(x, y, z, BLOCKS.STONE);
            } else {
              this.setBlock(x, y, z, BLOCKS.DIRT);
            }
          } else {
            this.setBlock(x, y, z, BLOCKS.STONE);
          }
        }
      }
    }
  };

  chunk.generateProceduralTerrain(
    terrainNoise,
    cx * chunkWidth,
    cz * chunkWidth,
    BLOCKS as BlockIdMap,
  );

  for (let x = 0; x < chunkWidth - 2; x++) {
    for (let z = 2; z < chunkWidth - 2; z++) {
      let surfaceY = 0;

      for (let y = chunkHeight - 1; y >= 0; y--) {
        if (chunk.getBlock(x, y, z) !== 0) {
          surfaceY = y;
          break;
        }
      }

      if (chunk.getBlock(x, surfaceY, z) === BLOCKS!.GRASS_BLOCK) {
        // Check if it's grass
        const globalX = cx * chunkWidth + x;
        const globalZ = cz * chunkWidth + z;

        const isForest = treeNoise.get(globalX * 0.05, globalZ * 0.05) > 0.6;

        if (isForest && Math.random() < 0.05) {
          FeatureGenerator.generateOakTree(
            chunk,
            x,
            surfaceY + 1,
            z,
            BLOCKS as BlockIdMap,
          );
        } else if (Math.random() < 0.25) {
          chunk.setBlock(x, surfaceY + 1, z, BLOCKS!.GRASS);
        }
      }
    }
  }

  // === SUNLIGHT PASS ===
  for (let x = 0; x < chunkWidth; x++) {
    for (let z = 0; z < chunkWidth; z++) {
      let skylight = 15; // Max light level

      for (let y = chunkHeight - 1; y >= 0; y--) {
        const blockId = chunk.getBlock(x, y, z);

        const blockData = BLOCK_REGISTRY![blockId];
        const isTransparent =
          blockId === 0 || (blockData && blockData.transparent);

        if (!isTransparent) {
          skylight = 0; // Block sunlight
        } else if (blockData && blockData.lightAttenuation) {
          skylight -= blockData.lightAttenuation; // Reduce light based on block properties
          if (skylight < 0) skylight = 0;
        }

        chunk.setSkyLight(x, y, z, skylight);
      }
    }
  }

  (self as any).postMessage(
    {
      cx,
      cz,
      buffer: chunk.data.buffer,
    },
    [chunk.data.buffer],
  ); // Transfer the buffer for efficient memory usage
};
