import type { TerrainGenerator } from "../worldgen/terrain";
import { Chunk } from "./chunk";

export class ChunkStore {
  public chunks: Map<string, Chunk> = new Map();

  private terrain: TerrainGenerator | undefined;

  constructor(terrain?: TerrainGenerator) {
    this.terrain = terrain;
  }

  public getOrCreateChunk(cx: number, cz: number): Chunk {
    const key = `${cx},${cz}`;
    if (this.chunks.has(key)) return this.chunks.get(key)!;

    const chunk = new Chunk();
    if (this.terrain) {
      this.terrain.generateChunk(chunk, cx, cz);
    }
    this.chunks.set(key, chunk);
    return chunk;
  }

  public setChunkData(cx: number, cz: number, data: Uint8Array) {
    const chunk = new Chunk();
    chunk.data = data as Uint8Array<ArrayBuffer>;
    this.chunks.set(`${cx},${cz}`, chunk);
  }

  public unloadChunk(cx: number, cz: number) {
    this.chunks.delete(`${cx},${cz}`);
  }

  public getBlock(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= Chunk.HEIGHT) return 0;

    const cx = Math.floor(wx / Chunk.WIDTH);
    const cz = Math.floor(wz / Chunk.DEPTH);

    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return 0;

    const lx = wx - cx * Chunk.WIDTH;
    const lz = wz - cz * Chunk.DEPTH;

    return chunk.getBlock(lx, wy, lz);
  }

  public getLight(wx: number, wy: number, wz: number): number {
    if (wy < 0 || wy >= Chunk.HEIGHT) return 15 << 4;

    const cx = Math.floor(wx / Chunk.WIDTH);
    const cz = Math.floor(wz / Chunk.DEPTH);

    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return 15 << 4;

    const lx = wx - cx * Chunk.WIDTH;
    const lz = wz - cz * Chunk.DEPTH;

    return chunk.getLight(lx, wy, lz);
  }

  public setLight(wx: number, wy: number, wz: number, lightVal: number) {
    if (wy < 0 || wy >= Chunk.HEIGHT) return;

    const cx = Math.floor(wx / Chunk.WIDTH);
    const cz = Math.floor(wz / Chunk.DEPTH);

    const chunk = this.chunks.get(`${cx},${cz}`);
    if (!chunk) return;

    const lx = wx - cx * Chunk.WIDTH;
    const lz = wz - cz * Chunk.DEPTH;

    chunk.setLight(lx, wy, lz, lightVal);
  }
}
