import { BlockRegistry } from "../world/blockRegistry";
import type { ChunkStore } from "../world/chunkStore";

export class AO {
  private static isOpaque(
    store: ChunkStore,
    wx: number,
    wy: number,
    wz: number,
  ): boolean {
    const id = store.getBlock(wx, wy, wz);
    if (id === 0) return false;
    return BlockRegistry.getBlock(id).lightAttenuation > 0;
  }

  /** * Voxel AO Curve:
   * 0 = Fully Lit, 1 = Mild Shadow, 2 = Dark Shadow, 3 = Pitch Black Corner
   */
  private static calc(side1: boolean, side2: boolean, corner: boolean): number {
    if (side1 && side2) return 3;
    return (side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0);
  }

  public static compute(
    store: ChunkStore,
    wx: number,
    wy: number,
    wz: number,
    face: number,
  ): number {
    let bl = 0,
      br = 0,
      tl = 0,
      tr = 0;

    let s, l, r, d, u;

    switch (face) {
      case 0: // Z+
        s = wz + 1;
        l = this.isOpaque(store, wx - 1, wy, s);
        r = this.isOpaque(store, wx + 1, wy, s);
        d = this.isOpaque(store, wx, wy - 1, s);
        u = this.isOpaque(store, wx, wy + 1, s);
        bl = this.calc(l, d, this.isOpaque(store, wx - 1, wy - 1, s));
        br = this.calc(r, d, this.isOpaque(store, wx + 1, wy - 1, s));
        tl = this.calc(l, u, this.isOpaque(store, wx - 1, wy + 1, s));
        tr = this.calc(r, u, this.isOpaque(store, wx + 1, wy + 1, s));
        break;

      case 1: // Z-
        s = wz - 1;
        l = this.isOpaque(store, wx + 1, wy, s);
        r = this.isOpaque(store, wx - 1, wy, s);
        d = this.isOpaque(store, wx, wy - 1, s);
        u = this.isOpaque(store, wx, wy + 1, s);
        bl = this.calc(l, d, this.isOpaque(store, wx + 1, wy - 1, s));
        br = this.calc(r, d, this.isOpaque(store, wx - 1, wy - 1, s));
        tl = this.calc(l, u, this.isOpaque(store, wx + 1, wy + 1, s));
        tr = this.calc(r, u, this.isOpaque(store, wx - 1, wy + 1, s));
        break;

      case 2: // Y+
        s = wy + 1;
        l = this.isOpaque(store, wx - 1, s, wz);
        r = this.isOpaque(store, wx + 1, s, wz);
        d = this.isOpaque(store, wx, s, wz - 1);
        u = this.isOpaque(store, wx, s, wz + 1);
        bl = this.calc(l, d, this.isOpaque(store, wx - 1, s, wz - 1));
        br = this.calc(r, d, this.isOpaque(store, wx + 1, s, wz - 1));
        tl = this.calc(l, u, this.isOpaque(store, wx - 1, s, wz + 1));
        tr = this.calc(r, u, this.isOpaque(store, wx + 1, s, wz + 1));
        break;

      case 3: // Y-
        s = wy - 1;
        l = this.isOpaque(store, wx - 1, s, wz);
        r = this.isOpaque(store, wx + 1, s, wz);
        d = this.isOpaque(store, wx, s, wz - 1);
        u = this.isOpaque(store, wx, s, wz + 1);
        bl = this.calc(l, d, this.isOpaque(store, wx - 1, s, wz - 1));
        br = this.calc(r, d, this.isOpaque(store, wx + 1, s, wz - 1));
        tl = this.calc(l, u, this.isOpaque(store, wx - 1, s, wz + 1));
        tr = this.calc(r, u, this.isOpaque(store, wx + 1, s, wz + 1));
        break;

      case 4: // X+
        s = wx + 1;
        l = this.isOpaque(store, s, wy, wz - 1);
        r = this.isOpaque(store, s, wy, wz + 1);
        d = this.isOpaque(store, s, wy - 1, wz);
        u = this.isOpaque(store, s, wy + 1, wz);
        bl = this.calc(l, d, this.isOpaque(store, s, wy - 1, wz - 1));
        br = this.calc(r, d, this.isOpaque(store, s, wy - 1, wz + 1));
        tl = this.calc(l, u, this.isOpaque(store, s, wy + 1, wz - 1));
        tr = this.calc(r, u, this.isOpaque(store, s, wy + 1, wz + 1));
        break;

      case 5:
        s = wx - 1;
        l = this.isOpaque(store, s, wy, wz - 1);
        r = this.isOpaque(store, s, wy, wz + 1);
        d = this.isOpaque(store, s, wy - 1, wz);
        u = this.isOpaque(store, s, wy + 1, wz);
        bl = this.calc(l, d, this.isOpaque(store, s, wy - 1, wz - 1));
        br = this.calc(r, d, this.isOpaque(store, s, wy - 1, wz + 1));
        tl = this.calc(l, u, this.isOpaque(store, s, wy + 1, wz - 1));
        tr = this.calc(r, u, this.isOpaque(store, s, wy + 1, wz + 1));
        break;
    }

    return bl | (br << 2) | (tl << 4) | (tr << 6);
  }
}
