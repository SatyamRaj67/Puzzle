import { BlockRegistry } from "../world/blockRegistry";
import type { ChunkStore } from "../world/chunkStore";

export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.8;

export class VoxelCollision {
  /**
   * Attempts to move an AABB by a velocity vector.
   * Modifies the velocity to stop at walls, floors, and ceilings.
   * Returns true if the player hit the ground.
   */
  public static resolve(
    pos: Float32Array,
    vel: Float32Array,
    store: ChunkStore,
  ): boolean {
    let grounded = false;

    // X-AXIS
    if (vel[0] !== 0) {
      pos[0] += vel[0];
      if (this.checkCollision(pos, store)) {
        pos[0] =
          vel[0] > 0
            ? Math.floor(pos[0] + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2 - 0.001
            : Math.floor(pos[0] - PLAYER_WIDTH / 2) + PLAYER_WIDTH / 2 + 1.001;
        vel[0] = 0;
      }
    }

    // Y-AXIS
    if (vel[1] !== 0) {
      pos[1] += vel[1];
      if (this.checkCollision(pos, store)) {
        if (vel[1] < 0) {
          grounded = true;
          pos[1] = Math.floor(pos[1]) + 1.001;
        } else {
          pos[1] = Math.floor(pos[1] + PLAYER_HEIGHT) - PLAYER_HEIGHT - 0.001;
        }
        vel[1] = 0;
      }
    }

    // Z-AXIS
    if (vel[2] !== 0) {
      pos[2] += vel[2];
      if (this.checkCollision(pos, store)) {
        pos[2] =
          vel[2] > 0
            ? Math.floor(pos[2] + PLAYER_WIDTH / 2) - PLAYER_WIDTH / 2 - 0.001
            : Math.floor(pos[2] - PLAYER_WIDTH / 2) + PLAYER_WIDTH / 2 + 1.001;
        vel[2] = 0;
      }
    }

    return grounded;
  }

  private static checkCollision(pos: Float32Array, store: ChunkStore): boolean {
    const minX = Math.floor(pos[0] - PLAYER_WIDTH / 2);
    const maxX = Math.floor(pos[0] + PLAYER_WIDTH / 2);
    const minY = Math.floor(pos[1]);
    const maxY = Math.floor(pos[1] + PLAYER_HEIGHT);
    const minZ = Math.floor(pos[2] - PLAYER_WIDTH / 2);
    const maxZ = Math.floor(pos[2] + PLAYER_WIDTH / 2);

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        for (let z = minZ; z <= maxZ; z++) {
          const blockId = store.getBlock(x, y, z);
          if (blockId === 0) continue;

          const def = BlockRegistry.getBlock(blockId);

          if (
            !def.isFluid &&
            def.renderType !== "EMPTY" &&
            def.renderType !== "CROSS"
          ) {
            return true;
          }
        }
      }
    }
    return false;
  }
}
