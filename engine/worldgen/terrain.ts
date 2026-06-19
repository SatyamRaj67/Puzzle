import { BlockRegistry } from "../world/blockRegistry";
import { Chunk } from "../world/chunk";
import { Noise2D } from "./noise";

export class TerrainGenerator {
  private noise: Noise2D;

  private readonly WATER_LEVEL = 30;

  constructor(seed: number = 1337) {
    this.noise = new Noise2D(seed);
  }

  public generateChunk(chunk: Chunk, chunkX: number, chunkZ: number): void {
    for (let x = 0; x < Chunk.WIDTH; x++) {
      for (let z = 0; z < Chunk.DEPTH; z++) {
        const worldX = chunkX * Chunk.WIDTH + x;
        const worldZ = chunkZ * Chunk.DEPTH + z;

        let heightValue = 0;
        let amplitude = 20;
        let frequency = 0.02;

        // Layer 1: Base Mountains
        heightValue +=
          this.noise.get(worldX * frequency, worldZ * frequency) * amplitude;

        // Layer 2: Small bumps/details
        heightValue +=
          this.noise.get(worldX * frequency * 4, worldZ * frequency * 4) *
          (amplitude / 4);

        const surfaceHeight = Math.floor(heightValue) + 25; // Base height offset

        for (let y = 0; y < Chunk.HEIGHT; y++) {
          if (y < surfaceHeight - 3) {
            chunk.setBlock(x, y, z, BlockRegistry.getId("stone"));
          } else if (y < surfaceHeight) {
            chunk.setBlock(x, y, z, BlockRegistry.getId("dirt"));
          } else if (y === surfaceHeight) {
            if (y < this.WATER_LEVEL) chunk.setBlock(x, y, z, BlockRegistry.getId("dirt"));
            else chunk.setBlock(x, y, z, BlockRegistry.getId("grass_block"));
          } else if (y < this.WATER_LEVEL) {
            chunk.setBlock(x, y, z, BlockRegistry.getId("water"));
          }
        }
      }
    }
  }
}
