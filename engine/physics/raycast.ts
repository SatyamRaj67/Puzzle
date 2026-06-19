import { vec3, type Vec3Type } from "../core/math/vec3";
import type { ChunkStore } from "../world/chunkStore";

export interface RaycastResult {
  hit: boolean;
  blockPos: Vec3Type;
  normal: Vec3Type;
  blockId: number;
}

export class Raycaster {
  public static step(
    origin: Float32Array,
    direction: Float32Array,
    maxDistance: number,
    store: ChunkStore,
  ): RaycastResult {
    let x = Math.floor(origin[0]);
    let y = Math.floor(origin[1]);
    let z = Math.floor(origin[2]);

    const dx = direction[0];
    const dy = direction[1];
    const dz = direction[2];

    const stepX = Math.sign(dx);
    const stepY = Math.sign(dy);
    const stepZ = Math.sign(dz);

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Infinity;

    let tMaxX =
      stepX > 0
        ? (Math.floor(origin[0]) + 1 - origin[0]) * tDeltaX
        : (origin[0] - Math.floor(origin[0])) * tDeltaX;
    let tMaxY =
      stepY > 0
        ? (Math.floor(origin[1]) + 1 - origin[1]) * tDeltaY
        : (origin[1] - Math.floor(origin[1])) * tDeltaY;
    let tMaxZ =
      stepZ > 0
        ? (Math.floor(origin[2]) + 1 - origin[2]) * tDeltaZ
        : (origin[2] - Math.floor(origin[2])) * tDeltaZ;

    let distance = 0;
    let normal: Vec3Type = vec3.create(0, 0, 0);

    while (distance <= maxDistance) {
      const blockId = store.getBlock(x, y, z);

      if (blockId !== 0) {
        return { hit: true, blockPos: vec3.create(x, y, z), normal, blockId };
      }

      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          distance = tMaxX;
          tMaxX += tDeltaX;
          normal = vec3.create(-stepX, 0, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal = vec3.create(0, 0, -stepZ);
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          distance = tMaxY;
          tMaxY += tDeltaY;
          normal = vec3.create(0, -stepY, 0);
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;
          normal = vec3.create(0, 0, -stepZ);
        }
      }
    }
    return {
      hit: false,
      blockPos: vec3.create(0, 0, 0),
      normal: vec3.create(0, 0, 0),
      blockId: 0,
    };
  }
}
