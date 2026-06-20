import type { ChunkMesh } from "../mesher/types";
import type { FPCamera } from "../render/camera/fpCamera";
import type { Renderer } from "../render/renderer";
import { ChunkStore } from "./chunkStore";
import type { GameTime } from "./gameTime";

export interface LoadedChunk {
  x: number;
  z: number;
  mesh: ChunkMesh;
  opaqueOffset: number | null;
  translucentOffset: number | null;
}

export class ChunkManager {
  private worker: Worker;
  private renderer: Renderer;

  public store = new ChunkStore();
  public loadedChunks: Map<string, LoadedChunk> = new Map();
  private pendingGenerations = 0;

  public renderDistance: number = 4; // Generates 9x9 grid
  private unloadRadius: number = this.renderDistance + 4;

  private lastPlayerChunkX: number | null = null;
  private lastPlayerChunkZ: number | null = null;
  private loadQueue: {
    x: number;
    z: number;
    distSq: number;
  }[] = [];

  constructor(renderer: Renderer) {
    this.renderer = renderer;
    this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });

    this.worker.postMessage({
      type: "INIT",
      textureMap: Array.from(renderer.textureAtlas.textureMap.entries()),
    });

    this.worker.onmessage = (event: MessageEvent) => {
      const data = event.data;

      if (data.type === "DONE") {
        if (data.isGenerate) this.pendingGenerations--;
        if (data.chunkData) {
          this.store.setChunkData(data.chunkX, data.chunkZ, data.chunkData);
        }

        let opaqueOffset: number | null = null;
        if (data.opaqueVertexCount > 0 && data.opaqueBuffer) {
          const opaqueData = new Uint32Array(data.opaqueBuffer);
          opaqueOffset = this.renderer.opaqueArena.allocate(
            opaqueData.byteLength,
          );
          this.renderer.gpu.device.queue.writeBuffer(
            this.renderer.opaqueArena.buffer,
            opaqueOffset,
            opaqueData,
          );
        }

        let translucentOffset: number | null = null;
        if (data.transVertexCount > 0 && data.transBuffer) {
          const transData = new Uint32Array(data.transBuffer);
          translucentOffset = this.renderer.translucentArena.allocate(
            transData.byteLength,
          );
          this.renderer.gpu.device.queue.writeBuffer(
            this.renderer.translucentArena.buffer,
            translucentOffset,
            transData,
          );
        }

        const key = `${data.chunkX},${data.chunkZ}`;
        const existing = this.loadedChunks.get(key);
        if (existing) this.freeChunkMemory(existing);

        this.loadedChunks.set(key, {
          x: data.chunkX,
          z: data.chunkZ,
          mesh: {
            vertices: [],
            vertexCounts: [data.opaqueVertexCount, data.transVertexCount],
          },
          opaqueOffset,
          translucentOffset,
        });
      }
    };
  }

  private freeChunkMemory(chunk: LoadedChunk) {
    if (chunk.opaqueOffset !== null) {
      const bytes = chunk.mesh.vertexCounts[0] * 3 * 4;
      this.renderer.opaqueArena.free(chunk.opaqueOffset, bytes);
    }
    if (chunk.translucentOffset !== null) {
      const bytes = chunk.mesh.vertexCounts[1] * 3 * 4;
      this.renderer.translucentArena.free(chunk.translucentOffset, bytes);
    }
  }

  private rebuildLoadQueue(playerChunkX: number, playerChunkZ: number) {
    this.loadQueue = [];

    for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
      for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
        const cx = playerChunkX + x;
        const cz = playerChunkZ + z;
        const key = `${cx},${cz}`;

        if (!this.loadedChunks.has(key)) {
          const distSq = x * x + z * z;
          this.loadQueue.push({ x: cx, z: cz, distSq });
        }
      }
    }

    this.loadQueue.sort((a, b) => a.distSq - b.distSq);

    for (const [key, chunk] of this.loadedChunks.entries()) {
      if (!chunk) continue;

      const dx = Math.abs(chunk.x - playerChunkX);
      const dz = Math.abs(chunk.z - playerChunkZ);

      if (dx > this.unloadRadius || dz > this.unloadRadius) {
        this.freeChunkMemory(chunk);
        this.loadedChunks.delete(key);
        this.store.unloadChunk(chunk.x, chunk.z);
        this.worker.postMessage({
          type: "UNLOAD",
          chunkX: chunk.x,
          chunkZ: chunk.z,
        });
      }
    }
  }

  public update(camera: FPCamera) {
    const playerChunkX = Math.floor(camera.position[0] / 16);
    const playerChunkZ = Math.floor(camera.position[2] / 16);

    if (
      this.lastPlayerChunkX !== playerChunkX ||
      this.lastPlayerChunkZ !== playerChunkZ
    ) {
      this.lastPlayerChunkX = playerChunkX;
      this.lastPlayerChunkZ = playerChunkZ;
      this.rebuildLoadQueue(playerChunkX, playerChunkZ);
    }

    if (this.pendingGenerations < 2 && this.loadQueue.length > 0) {
      const chunksToLoadThisFrame = Math.min(
        this.loadQueue.length,
        2 - this.pendingGenerations,
      );

      for (let i = 0; i < chunksToLoadThisFrame; i++) {
        const target = this.loadQueue.shift();
        if (!target) continue;

        const key = `${target.x},${target.z}`;
        if (!this.loadedChunks.has(key)) {
          this.loadedChunks.set(key, null as any); // Mark as pending
          this.pendingGenerations++;
          this.worker.postMessage({
            type: "GENERATE",
            chunkX: target.x,
            chunkZ: target.z,
          });
        }
      }
    }
  }

  public draw(
    camera: FPCamera,
    elapsedTime: number,
    gameTime: GameTime,
    heldLightLevel: number,
  ) {
    const visibleChunks: LoadedChunk[] = [];

    for (const chunk of this.loadedChunks.values()) {
      if (!chunk) continue;
      visibleChunks.push(chunk);
    }
    this.renderer.drawMultiple(
      camera,
      elapsedTime,
      visibleChunks,
      gameTime,
      heldLightLevel,
    );
  }

  /** Asks the background worker to build a chunk */
  public requestChunk(x: number, z: number) {
    this.pendingGenerations++;
    this.worker.postMessage({ type: "GENERATE", chunkX: x, chunkZ: z });
  }

  public setBlock(wx: number, wy: number, wz: number, blockId: number): void {
    if (wy < 0 || wy > 127) return;

    const cx = Math.floor(wx / 16);
    const cz = Math.floor(wz / 16);

    const chunk = this.store.chunks.get(`${cx},${cz}`);
    if (!chunk) return;

    const lx = wx - cx * 16;
    const lz = wz - cz * 16;
    chunk.setBlock(lx, wy, lz, blockId);

    this.worker.postMessage({
      type: "MODIFY",
      wx,
      wy,
      wz,
      blockId,
      chunkX: cx,
      chunkZ: cz,
    });
  }
}
