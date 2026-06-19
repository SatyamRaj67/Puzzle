import { Chunk } from "../world/chunk";
import { Format } from "./format";

export class CullingMesher {
  public static mesh(chunk: Chunk): {
    vertices: Uint32Array;
    vertexCount: number;
  } {
    const vertices: number[] = [];

    for (let y = 0; y < Chunk.HEIGHT; y++) {
      for (let z = 0; z < Chunk.DEPTH; z++) {
        for (let x = 0; x < Chunk.WIDTH; x++) {
          const blockId = chunk.getBlock(x, y, z);
          if (blockId === 0) continue;

          // 0: Front(Z+), 1: Back(Z-), 2: Top(Y+), 3: Bottom(Y-), 4: Right(X+), 5: Left(X-)
          if (chunk.getBlock(x, y, z + 1) === 0)
            this.addPackedFace(x, y, z, blockId, 0, vertices);
          if (chunk.getBlock(x, y, z - 1) === 0)
            this.addPackedFace(x, y, z, blockId, 1, vertices);
          if (chunk.getBlock(x, y + 1, z) === 0)
            this.addPackedFace(x, y, z, blockId, 2, vertices);
          if (chunk.getBlock(x, y - 1, z) === 0)
            this.addPackedFace(x, y, z, blockId, 3, vertices);
          if (chunk.getBlock(x + 1, y, z) === 0)
            this.addPackedFace(x, y, z, blockId, 4, vertices);
          if (chunk.getBlock(x - 1, y, z) === 0)
            this.addPackedFace(x, y, z, blockId, 5, vertices);
        }
      }
    }

    return {
      vertices: new Uint32Array(vertices),
      vertexCount: vertices.length,
    };
  }

  private static addPackedFace(
    x: number,
    y: number,
    z: number,
    id: number,
    faceIndex: number,
    vertices: number[],
  ): void {
    const packedData = Format.pack(x, y, z, id, faceIndex);

    vertices.push(
      packedData,
      packedData,
      packedData,
      packedData,
      packedData,
      packedData,
    );
  }
}
