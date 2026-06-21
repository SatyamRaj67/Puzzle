import { BlockRegistry } from "../world/blockRegistry";
import type { ChunkStore } from "../world/chunkStore";
import { StructureBuilder } from "./structures/builder";
import { TreeGenerator } from "./structures/trees";

export class BiomeDecorator {
  /**
   * A simple seeded PRNG (Pseudo-Random Number Generator)
   * Ensures trees always spawn in the exact same coordinates if you reload the world.
   */
  private static seededRandom(x: number, z: number): number {
    let seed = (x * 73856093) ^ (z * 191919);
    seed = (seed ^ (seed >> 16)) * 2246822507;
    seed = (seed ^ (seed >> 13)) * 3266489909;
    return ((seed ^ (seed >> 16)) >>> 0) / 4294967296;
  }

  public static decorateChunk(store: ChunkStore, cx: number, cz: number): void {
    const grassBlockId = BlockRegistry.getId("grass_block");
    const grassId = BlockRegistry.getId("grass");

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const wx = cx * 16 + x;
        const wz = cz * 16 + z;

        const rand = this.seededRandom(wx, wz);

        for (let y = 127; y >= 0; y--) {
          const blockId = store.getBlock(wx, y, wz);

          if (blockId === grassBlockId) {
            if (rand < 0.01) {
              let treeSalt = rand;

              const prng = () => {
                treeSalt = (treeSalt * 16807) % 1;
                return treeSalt;
              };

              TreeGenerator.generateOak(store, wx, y + 1, wz, prng);
            } else if (rand < 0.15) {
            //   store.setLight(wx, y + 1, wz, 15);
              StructureBuilder.place(store, wx, y + 1, wz, grassId);
            }

            break;
          }
        }
      }
    }
  }
}
