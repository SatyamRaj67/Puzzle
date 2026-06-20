import { BlockRegistry } from "../world/blockRegistry";
import { Chunk } from "../world/chunk";
import type { ChunkStore } from "../world/chunkStore";

export class LightingEngine {
  private static lightQueue: number[] = [];
  private static sunQueue: number[] = [];

  private static dirs = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, -1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ];

  public static calculateChunk(store: ChunkStore, cx: number, cz: number) {
    const startX = cx * 16;
    const startZ = cz * 16;

    this.lightQueue = [];
    this.sunQueue = [];

    for (let x = 0; x < 16; x++) {
      for (let z = 0; z < 16; z++) {
        const wx = startX + x;
        const wz = startZ + z;

        let sunStrength = 15;

        for (let y = Chunk.HEIGHT - 1; y >= 0; y--) {
          const blockId = store.getBlock(wx, y, wz);
          const def = BlockRegistry.getBlock(blockId);

          if (def.isOpaque) sunStrength = 0;
          else if (blockId !== 0)
            sunStrength = Math.max(0, sunStrength - def.lightAttenuation);

          const currentLight = store.getLight(wx, y, wz);
          const blockLight = currentLight & 0xf;

          store.setLight(wx, y, wz, (sunStrength << 4) | blockLight);

          if (def.lightEmission > 0) {
            store.setLight(wx, y, wz, (sunStrength << 4) | def.lightEmission);
            this.lightQueue.push(wx, y, wz);
          }
        }
      }
    }

    this.addLight(store, this.lightQueue, false);
    this.addLight(store, this.sunQueue, true);
  }

  public static addLight(
    store: ChunkStore,
    queue: number[],
    isSun: boolean,
    affectedChunks?: Set<string>,
  ) {
    let head = 0;

    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];

      const rawLight = store.getLight(x, y, z);
      const strength = isSun ? (rawLight >> 4) & 0xf : rawLight & 0xf;

      const nextStrength = strength - 1;
      if (nextStrength <= 0) continue;

      for (const [dx, dy, dz] of this.dirs) {
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (ny < 0 || ny >= Chunk.HEIGHT) continue;

        const neighborId = store.getBlock(nx, ny, nz);
        const def = BlockRegistry.getBlock(neighborId);

        if (def.isOpaque) continue;

        let finalStrength = 0;
        if (
          isSun &&
          dy === -1 &&
          strength === 15 &&
          (def.lightAttenuation || 0) === 0
        ) {
          finalStrength = 15;
        } else {
          finalStrength = Math.max(
            0,
            nextStrength - (def.lightAttenuation || 0),
          );
        }
        if (finalStrength <= 0) continue;

        const nRawLight = store.getLight(nx, ny, nz);
        const nSun = (nRawLight >> 4) & 0xf;
        const nBlk = nRawLight & 0xf;

        if (isSun && finalStrength > nSun) {
          store.setLight(nx, ny, nz, (finalStrength << 4) | nBlk);
          queue.push(nx, ny, nz);
          if (affectedChunks)
            affectedChunks.add(`${Math.floor(nx / 16)},${Math.floor(nz / 16)}`);
        } else if (!isSun && finalStrength > nBlk) {
          store.setLight(nx, ny, nz, (nSun << 4) | finalStrength);
          queue.push(nx, ny, nz);
          if (affectedChunks)
            affectedChunks.add(`${Math.floor(nx / 16)},${Math.floor(nz / 16)}`);
        }
      }
    }
  }

  public static removeLight(
    store: ChunkStore,
    queue: number[],
    isSun: boolean,
    affectedChunks?: Set<string>,
  ) {
    const addQueue: number[] = [];
    let head = 0;

    while (head < queue.length) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];

      const lightLevel = queue[head++];

      for (const [dx, dy, dz] of this.dirs) {
        const nx = x + dx,
          ny = y + dy,
          nz = z + dz;
        if (ny < 0 || ny >= Chunk.HEIGHT) continue;

        const neighborRaw = store.getLight(nx, ny, nz);
        const neighborLight = isSun
          ? (neighborRaw >> 4) & 0xf
          : neighborRaw & 0xf;

        if (neighborLight !== 0 && neighborLight < lightLevel) {
          const newSun = isSun ? 0 : (neighborRaw >> 4) & 0xf;
          const newBlk = isSun ? neighborRaw & 0xf : 0;
          store.setLight(nx, ny, nz, (newSun << 4) | newBlk);

          queue.push(nx, ny, nz, neighborLight);
          if (affectedChunks)
            affectedChunks.add(`${Math.floor(nx / 16)},${Math.floor(nz / 16)}`);
        } else if (neighborLight >= lightLevel) {
          addQueue.push(nx, ny, nz);
        }
      }
    }

    if (addQueue.length > 0) {
      this.addLight(store, addQueue, isSun, affectedChunks);
    }
  }
}
