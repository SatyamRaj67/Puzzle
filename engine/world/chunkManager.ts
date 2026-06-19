import type { ChunkMesh } from "../mesher/types";
import type { FPCamera } from "../render/camera/fpCamera";
import { Frustrum } from "../render/culling";
import type { Renderer } from "../render/renderer";
import { ChunkStore } from "./chunkStore";
import type { GameTime } from "./gameTime";

export interface LoadedChunk {
  x: number;
  z: number;
  mesh: ChunkMesh;
  buffers: GPUBuffer[];
}

export class ChunkManager {
  private worker: Worker;
  private renderer: Renderer;
  
  public loadedChunks: Map<string, LoadedChunk> = new Map();

  public renderDistance: number = 4; // Generates 9x9 grid
  public frustum = new Frustrum();

  public store = new ChunkStore();
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

        if (data.chunkData) {
          this.store.setChunkData(data.chunkX, data.chunkZ, data.chunkData);
        }

        const typedVertices = data.vertices.map(
          (buf: ArrayBuffer) => new Uint32Array(buf),
        );

        const chunkMesh: ChunkMesh = {
          vertices: typedVertices,
          vertexCounts: data.vertexCounts,
        };

        const buffers: GPUBuffer[] = [];
        for (let i = 0; i < 6; i++) {
          if (chunkMesh.vertexCounts[i] > 0) {
            buffers[i] = this.renderer.createVertexBuffer(
              chunkMesh.vertices[i],
            );
          }
        }

        this.loadedChunks.set(`${data.chunkX},${data.chunkZ}`, {
          x: data.chunkX,
          z: data.chunkZ,
          mesh: chunkMesh,
          buffers,
        });
      }
    };
  }

  public update(camera: FPCamera) {
    const playerChunkX = Math.floor(camera.position[0] / 16);
    const playerChunkZ = Math.floor(camera.position[2] / 16);

    const loadQueue: { x: number; z: number; distSq: number }[] = [];

    for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
      for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
        const cx = playerChunkX + x;
        const cz = playerChunkZ + z;
        const key = `${cx},${cz}`;

        if (!this.loadedChunks.has(key)) {
          const distSq = x * x + z * z;
          loadQueue.push({ x: cx, z: cz, distSq });
        }
      }
    }

    loadQueue.sort((a, b) => a.distSq - b.distSq);

    const chunksToLoadThisFrame = Math.min(loadQueue.length, 4);
    for (let i = 0; i < chunksToLoadThisFrame; i++) {
      const { x, z } = loadQueue[i];
      this.loadedChunks.set(`${x},${z}`, null as any);
      this.worker.postMessage({ type: "GENERATE", chunkX: x, chunkZ: z });
    }

    for (const [key, chunk] of this.loadedChunks.entries()) {
      if (!chunk) continue;
      const dx = Math.abs(chunk.x - playerChunkX);
      const dz = Math.abs(chunk.z - playerChunkZ);

      if (dx > this.renderDistance + 1 || dz > this.renderDistance + 1) {
        for (const buf of chunk.buffers) if (buf) buf.destroy();
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

  public draw(camera: FPCamera, elapsedTime: number, gameTime: GameTime) {
    this.frustum.updateFromMatrix(camera.viewProjMatrix);

    const visibleChunks: LoadedChunk[] = [];

    for (const chunk of this.loadedChunks.values()) {
      if (!chunk) continue;

      const minX = chunk.x * 16;
      const minZ = chunk.z * 16;

      if (
        this.frustum.intersectsBox(minX, 0, minZ, minX + 16, 128, minZ + 16)
      ) {
        visibleChunks.push(chunk);
      }
    }
    this.renderer.drawMultiple(camera, elapsedTime, visibleChunks, gameTime);
  }

  /** Asks the background worker to build a chunk */
  public requestChunk(x: number, z: number) {
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
