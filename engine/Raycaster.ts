import { ChunkManager } from "./ChunkManager";

export interface RaycastHit {
  x: number;
  y: number;
  z: number;
  blockId: number;
  normal: [number, number, number];
}

export class Raycaster {
  static step(
    origin: [number, number, number],
    direction: [number, number, number],
    chunkManager: ChunkManager,
    maxDistance = 8,
  ): RaycastHit | null {
    // 1. Where to start in the voxel grid (floor of the origin)
    let x = Math.floor(origin[0]);
    let y = Math.floor(origin[1]);
    let z = Math.floor(origin[2]);

    // 2. Which direction to step in each axis (+1, -1, or 0)
    const stepX = Math.sign(direction[0]);
    const stepY = Math.sign(direction[1]);
    const stepZ = Math.sign(direction[2]);

    // 3. How far to go in each axis to reach the next voxel boundary
    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction[0]) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction[1]) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction[2]) : Infinity;

    // 4. How far is it to the first voxel boundary from the origin
    let tMaxX =
      stepX > 0 ? (x + 1 - origin[0]) * tDeltaX : (origin[0] - x) * tDeltaX;
    let tMaxY =
      stepY > 0 ? (y + 1 - origin[1]) * tDeltaY : (origin[1] - y) * tDeltaY;
    let tMaxZ =
      stepZ > 0 ? (z + 1 - origin[2]) * tDeltaZ : (origin[2] - z) * tDeltaZ;

    let distance = 0;

    let hitNormal: [number, number, number] = [0, 0, 0];

    // 5. The Core DDA Loop
    while (distance < maxDistance) {
      const blockId = chunkManager.getBlock(x, y, z);

      if (blockId !== 0) {
        const blockData = chunkManager.blockRegistry[blockId.toString()];

        if (blockData && !blockData.isFluid){
          return { x, y, z, blockId, normal: hitNormal };
        }
      }

      // Step B: Move to the next voxel boundary
      if (tMaxX < tMaxY) {
        if (tMaxX < tMaxZ) {
          x += stepX;
          distance = tMaxX;
          tMaxX += tDeltaX;

          hitNormal = [-stepX, 0, 0];
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;

          hitNormal = [0, 0, -stepZ];
        }
      } else {
        if (tMaxY < tMaxZ) {
          y += stepY;
          distance = tMaxY;
          tMaxY += tDeltaY;

          hitNormal = [0, -stepY, 0];
        } else {
          z += stepZ;
          distance = tMaxZ;
          tMaxZ += tDeltaZ;

          hitNormal = [0, 0, -stepZ];
        }
      }
    }

    return null;
  }
}
