import { BlockRegistry } from "../../world/blockRegistry";
import type { ChunkStore } from "../../world/chunkStore";
import { StructureBuilder } from "./builder";

export class TreeGenerator {
  public static generateOak(
    store: ChunkStore,
    wx: number,
    wy: number,
    wz: number,
    prng: () => number,
  ): void {
    const logId = BlockRegistry.getId("oak_log");
    const leafId = BlockRegistry.getId("oak_leaves");

    const height = 4 + Math.floor(prng() * 3); // 4-6 blocks tall

    for (let y = height - 2; y <= height + 1; y++) {
      const radius = y >= height ? 1 : 2;

      for (let x = -radius; x <= radius; x++) {
        for (let z = -radius; z <= radius; z++) {
          if (Math.abs(x) === radius && Math.abs(z) === radius) {
            if (y < height && prng() > 0.5) continue;
            if (y >= height) continue;
          }
          StructureBuilder.place(store, wx + x, wy + y, wz + z, leafId);
        }
      }
    }

    for (let y = 0; y < height; y++) {
      StructureBuilder.place(store, wx, wy + y, wz, logId, true);
    }
  }
}
