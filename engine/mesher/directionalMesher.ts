import { Chunk } from "../world/chunk";
import { Format } from "./format";
import type { ChunkMesh } from "./types";

export class DirectionalMesher {
  public static mesh(chunk: Chunk): ChunkMesh {
    const faces: number[][] = [[], [], [], [], [], []];

    for (let y = 0; y < Chunk.HEIGHT; y++) {
      for (let z = 0; z < Chunk.DEPTH; z++) {
        for (let x = 0; x < Chunk.WIDTH; x++) {
          const blockId = chunk.getBlock(x, y, z);
          if (blockId === 0) continue;

          // 0: Z+, 1: Z-, 2: Y+, 3: Y-, 4: X+, 5: X-
          // Notice we hardcode width=1, height=1 for now!
          if (chunk.getBlock(x, y, z + 1) === 0)
            this.addFace(0, x, y, z, blockId, 1, 1, faces);
          if (chunk.getBlock(x, y, z - 1) === 0)
            this.addFace(1, x, y, z, blockId, 1, 1, faces);
          if (chunk.getBlock(x, y + 1, z) === 0)
            this.addFace(2, x, y, z, blockId, 1, 1, faces);
          if (chunk.getBlock(x, y - 1, z) === 0)
            this.addFace(3, x, y, z, blockId, 1, 1, faces);
          if (chunk.getBlock(x + 1, y, z) === 0)
            this.addFace(4, x, y, z, blockId, 1, 1, faces);
          if (chunk.getBlock(x - 1, y, z) === 0)
            this.addFace(5, x, y, z, blockId, 1, 1, faces);
        }
      }
    }

    return {
      vertices: faces.map((arr) => new Uint32Array(arr)),
      vertexCounts: faces.map((arr) => arr.length),
    };
  }

  private static addFace(
    faceId: number,
    x: number,
    y: number,
    z: number,
    id: number,
    w: number,
    h: number,
    faces: number[][],
  ) {
    const packed = Format.pack(x, y, z, id, w, h);
    faces[faceId].push(packed, packed, packed, packed, packed, packed);
  }
}
