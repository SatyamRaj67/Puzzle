import { BlockRegistry } from "../world/blockRegistry";
import { Chunk } from "../world/chunk";
import { Noise2D } from "./noise";

export class TerrainGenerator {
  private continentNoise: Noise2D;
  private erosionNoise: Noise2D;
  private readonly WATER_LEVEL = 40;

  constructor(seed: number = 1337) {
    this.continentNoise = new Noise2D(seed);
    this.erosionNoise = new Noise2D(seed + 1);
  }

  public generateChunk(chunk: Chunk, chunkX: number, chunkZ: number): void {
    for (let x = 0; x < Chunk.WIDTH; x++) {
      for (let z = 0; z < Chunk.DEPTH; z++) {
        const worldX = chunkX * Chunk.WIDTH + x;
        const worldZ = chunkZ * Chunk.DEPTH + z;

        let continent =
          (this.continentNoise.get(worldX * 0.003, worldZ * 0.003) + 1) / 2;
        let erosion =
          (this.erosionNoise.get(worldX * 0.015, worldZ * 0.015) + 1) / 2;
        const elevationFactor = Math.pow(continent, 3.0);
        const surfaceHeight = Math.floor(
          30 + elevationFactor * 80 + erosion * 20,
        );

        for (let y = 0; y < Chunk.HEIGHT; y++) {
          if (y > surfaceHeight) {
            if (y <= this.WATER_LEVEL)
              chunk.setBlock(x, y, z, BlockRegistry.getId("water"));
          } else if (y === surfaceHeight) {
            if (y < this.WATER_LEVEL + 2)
              chunk.setBlock(x, y, z, BlockRegistry.getId("dirt"));
            else chunk.setBlock(x, y, z, BlockRegistry.getId("grass_block"));
          } else if (y > surfaceHeight - 4) {
            chunk.setBlock(x, y, z, BlockRegistry.getId("dirt"));
          } else {
            chunk.setBlock(x, y, z, BlockRegistry.getId("stone"));
          }
        }
      }
    }
  }
}
