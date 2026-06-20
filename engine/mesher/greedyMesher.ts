import { BlockRegistry } from "../world/blockRegistry";
import { Chunk } from "../world/chunk";
import type { ChunkStore } from "../world/chunkStore";
import { AO } from "./ao";
import { Format } from "./format";
import type { ChunkMesh } from "./types";

const MAX_VERTICES: number = 100000;
const faceBuffers = Array.from(
  {
    length: 16,
  },
  () => new Uint32Array(MAX_VERTICES * 3),
);
const faceCounts = new Uint32Array(16);

const mask0 = new Int32Array(Chunk.WIDTH * Chunk.HEIGHT);
const mask1 = new Int32Array(Chunk.WIDTH * Chunk.HEIGHT);

export class GreedyMesher {
  public static mesh(
    store: ChunkStore,
    chunkX: number,
    chunkZ: number,
  ): ChunkMesh {
    faceCounts.fill(0);

    const startX = chunkX * Chunk.WIDTH;
    const startZ = chunkZ * Chunk.DEPTH;

    // --- FLORA PASS ---
    for (let y = 0; y < Chunk.HEIGHT; y++) {
      for (let x = 0; x < Chunk.WIDTH; x++) {
        for (let z = 0; z < Chunk.DEPTH; z++) {
          const wx = startX + x;
          const wz = startZ + z;
          const blockId = store.getBlock(wx, y, wz);

          if (blockId !== 0) {
            const def = BlockRegistry.getBlock(blockId);
            if (def.renderType === "CROSS") {
              const tex_d1 = def.textureIds[0];
              const tex_d2 = def.textureIds[1] ?? tex_d1;

              const data1_d1 = Format.packData1(x, y, z, tex_d1, 1, 1);
              const data1_d2 = Format.packData1(x, y, z, tex_d2, 1, 1);

              const data2 = Format.packData2(0, chunkX, chunkZ);

              const light = store.getLight(wx, y, wz);

              this.pushQuad(6, data1_d1, data2, Format.packData3(light, 6));
              this.pushQuad(7, data1_d1, data2, Format.packData3(light, 7));
              this.pushQuad(8, data1_d2, data2, Format.packData3(light, 8));
              this.pushQuad(9, data1_d2, data2, Format.packData3(light, 9));
            }
          }
        }
      }
    }

    // --- Z AXIS (Faces 0: Z+, 1: Z-) ---
    // Slice = Z. Plane = X (u) and Y (v)
    for (let z = 0; z < Chunk.DEPTH; z++) {
      const wz = startZ + z;
      mask0.fill(0);
      mask1.fill(0);

      for (let y = 0; y < Chunk.HEIGHT; y++) {
        const wy = y;
        for (let x = 0; x < Chunk.WIDTH; x++) {
          const wx = startX + x;
          const blockId = store.getBlock(wx, wy, wz);

          if (
            blockId !== 0 &&
            BlockRegistry.getBlock(blockId).renderType !== "CROSS"
          ) {
            const neighborZPlus = store.getBlock(wx, wy, wz + 1);
            if (BlockRegistry.shouldRenderFace(blockId, neighborZPlus)) {
              const ao = AO.compute(store, wx, wy, wz, 0);
              const light = store.getLight(wx, wy, wz + 1);
              mask0[y * Chunk.WIDTH + x] = blockId | (ao << 16) | (light << 24);
            }
            const neighborZMinus = store.getBlock(wx, wy, wz - 1);
            if (BlockRegistry.shouldRenderFace(blockId, neighborZMinus)) {
              const ao = AO.compute(store, wx, wy, wz, 1);
              const light = store.getLight(wx, wy, wz - 1);
              mask1[y * Chunk.WIDTH + x] = blockId | (ao << 16) | (light << 24);
            }
          }
        }
      }
      this.sweep(mask0, 0, z, Chunk.WIDTH, Chunk.HEIGHT, 0, chunkX, chunkZ);
      this.sweep(mask1, 1, z, Chunk.WIDTH, Chunk.HEIGHT, 0, chunkX, chunkZ);
    }

    // --- Y AXIS (Faces 2: Y+, 3: Y-) ---
    // Slice = Y. Plane = X (u) and Z (v)
    for (let y = 0; y < Chunk.HEIGHT; y++) {
      const wy = y;
      mask0.fill(0);
      mask1.fill(0);

      for (let z = 0; z < Chunk.DEPTH; z++) {
        const wz = startZ + z;
        for (let x = 0; x < Chunk.WIDTH; x++) {
          const wx = startX + x;
          const blockId = store.getBlock(wx, wy, wz);

          if (
            blockId !== 0 &&
            BlockRegistry.getBlock(blockId).renderType !== "CROSS"
          ) {
            const neighborYPlus = store.getBlock(wx, wy + 1, wz);
            if (BlockRegistry.shouldRenderFace(blockId, neighborYPlus)) {
              const ao = AO.compute(store, wx, wy, wz, 2);
              const light = store.getLight(wx, wy + 1, wz);
              mask0[z * Chunk.WIDTH + x] = blockId | (ao << 16) | (light << 24);
            }
            const neighborYMinus = store.getBlock(wx, wy - 1, wz);
            if (BlockRegistry.shouldRenderFace(blockId, neighborYMinus)) {
              const ao = AO.compute(store, wx, wy, wz, 3);
              const light = store.getLight(wx, wy - 1, wz);
              mask1[z * Chunk.WIDTH + x] = blockId | (ao << 16) | (light << 24);
            }
          }
        }
      }
      this.sweep(mask0, 2, y, Chunk.WIDTH, Chunk.DEPTH, 1, chunkX, chunkZ);
      this.sweep(mask1, 3, y, Chunk.WIDTH, Chunk.DEPTH, 1, chunkX, chunkZ);
    }

    // --- X AXIS (Faces 4: X+, 5: X-) ---
    // Slice = X. Plane = Z (u) and Y (v)
    for (let x = 0; x < Chunk.WIDTH; x++) {
      const wx = startX + x;
      mask0.fill(0);
      mask1.fill(0);

      for (let y = 0; y < Chunk.HEIGHT; y++) {
        const wy = y;
        for (let z = 0; z < Chunk.DEPTH; z++) {
          const wz = startZ + z;
          const blockId = store.getBlock(wx, wy, wz);

          if (
            blockId !== 0 &&
            BlockRegistry.getBlock(blockId).renderType !== "CROSS"
          ) {
            const neighborXPlus = store.getBlock(wx + 1, wy, wz);
            if (BlockRegistry.shouldRenderFace(blockId, neighborXPlus)) {
              const ao = AO.compute(store, wx, wy, wz, 4);
              const light = store.getLight(wx + 1, wy, wz);
              mask0[y * Chunk.DEPTH + z] = blockId | (ao << 16) | (light << 24);
            }
            const neighborXMinus = store.getBlock(wx - 1, wy, wz);
            if (BlockRegistry.shouldRenderFace(blockId, neighborXMinus)) {
              const ao = AO.compute(store, wx, wy, wz, 5);
              const light = store.getLight(wx - 1, wy, wz);
              mask1[y * Chunk.DEPTH + z] = blockId | (ao << 16) | (light << 24);
            }
          }
        }
      }
      this.sweep(mask0, 4, x, Chunk.DEPTH, Chunk.HEIGHT, 2, chunkX, chunkZ);
      this.sweep(mask1, 5, x, Chunk.DEPTH, Chunk.HEIGHT, 2, chunkX, chunkZ);
    }
    const finalVertices: Uint32Array[] = [];
    const finalCounts: number[] = [];

    for (let i = 0; i < 16; i++) {
      const uintCount = faceCounts[i];
      finalCounts.push(uintCount / 3);

      if (uintCount > 0) {
        finalVertices.push(faceBuffers[i].slice(0, uintCount));
      } else {
        finalVertices.push(new Uint32Array(0));
      }
    }

    return {
      vertices: finalVertices,
      vertexCounts: finalCounts,
    };
  }

  private static pushQuad(faceId: number, d1: number, d2: number, d3: number) {
    const buf = faceBuffers[faceId];
    let ptr = faceCounts[faceId];

    // Triangle 1
    buf[ptr++] = d1;
    buf[ptr++] = d2;
    buf[ptr++] = d3;
    buf[ptr++] = d1;
    buf[ptr++] = d2;
    buf[ptr++] = d3;
    buf[ptr++] = d1;
    buf[ptr++] = d2;
    buf[ptr++] = d3;

    // Triangle 2
    buf[ptr++] = d1;
    buf[ptr++] = d2;
    buf[ptr++] = d3;
    buf[ptr++] = d1;
    buf[ptr++] = d2;
    buf[ptr++] = d3;
    buf[ptr++] = d1;
    buf[ptr++] = d2;
    buf[ptr++] = d3;

    faceCounts[faceId] = ptr;
  }

  /**
   * Scans the 2D mask, builds the largest possible rectangles, and emits them.
   */
  private static sweep(
    mask: Int32Array,
    faceId: number,
    slice: number,
    maxU: number,
    maxV: number,
    axis: number,
    chunkX: number,
    chunkZ: number,
  ) {
    for (let v = 0; v < maxV; v++) {
      for (let u = 0; u < maxU; u++) {
        const val = mask[v * maxU + u];
        if (val === 0) continue;

        const blockId = val & 0xffff;
        const ao = (val >> 16) & 0xff;
        const light = (val >> 24) & 0xff;

        let w = 1;
        while (u + w < maxU && w < 32) {
          const nextVal = mask[v * maxU + (u + w)];

          const nextId = nextVal & 0xffff;
          const nextAO = (nextVal >> 16) & 0xff;
          const nextLight = (nextVal >> 24) & 0xff;
          if (
            nextId !== blockId ||
            nextAO !== ao ||
            nextLight !== light ||
            ao !== 0
          )
            break;

          w++;
        }

        let h = 1;
        let done = false;

        while (v + h < maxV && h < 32) {
          for (let i = 0; i < w; i++) {
            const nextVal = mask[(v + h) * maxU + (u + i)];
            const nextId = nextVal & 0xffff;
            const nextAo = (nextVal >> 16) & 0xff;
            const nextLight = (nextVal >> 24) & 0xff;

            if (
              nextId !== blockId ||
              nextAo !== ao ||
              nextLight !== light ||
              ao !== 0
            ) {
              done = true;
              break;
            }
          }
          if (done) break;
          h++;
        }

        let x = 0,
          y = 0,
          z = 0;

        switch (axis) {
          case 0: // Z Axis
            x = u;
            y = v;
            z = slice;
            break;
          case 1: // Y Axis
            x = u;
            y = slice;
            z = v;
            break;
          case 2: // X Axis
            x = slice;
            y = v;
            z = u;
            break;
        }

        const block = BlockRegistry.getBlock(blockId);
        const tex_id = block.textureIds[faceId];
        const targetFaceId = block.isFluid ? faceId + 10 : faceId;

        const data1 = Format.packData1(x, y, z, tex_id, w, h);
        const data2 = Format.packData2(ao, chunkX, chunkZ);
        const data3 = Format.packData3(light, faceId);

        this.pushQuad(targetFaceId, data1, data2, data3);

        for (let j = 0; j < h; j++) {
          for (let i = 0; i < w; i++) {
            mask[(v + j) * maxU + (u + i)] = 0;
          }
        }

        u += w - 1;
      }
    }
  }
}
