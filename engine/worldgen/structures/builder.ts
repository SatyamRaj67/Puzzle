import { BlockRegistry } from "../../world/blockRegistry";
import type { ChunkStore } from "../../world/chunkStore";

export class StructureBuilder {
  /**
   * Safely places a block at absolute world coordinates, crossing chunk boundaries if necessary.
   * Will not overwrite solid blocks unless explicitly told to.
   */
  public static place(
    store: ChunkStore, 
    wx: number, 
    wy: number, 
    wz: number, 
    blockId: number, 
    overwriteSolid: boolean = false
  ) {
    if (wy < 0 || wy > 127) return;

    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);
    const chunk = store.chunks.get(`${cx},${cz}`);
    
    if (chunk) {
      const lx = wx - (cx * 16);
      const lz = wz - (cz * 16);
      
      const currentBlockId = chunk.getBlock(lx, wy, lz);
      
      if (currentBlockId === 0 || BlockRegistry.getBlock(currentBlockId).isFluid || overwriteSolid) {
        chunk.setBlock(lx, wy, lz, blockId);
      }
    }
  }
}