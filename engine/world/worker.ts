import { GreedyMesher } from "../mesher/greedyMesher";
import { TerrainGenerator } from "../worldgen/terrain";
import { BlockRegistry } from "./blockRegistry";
import { ChunkStore } from "./chunkStore";

let terrain: TerrainGenerator;
let store: ChunkStore;

self.onmessage = (event: MessageEvent) => {
  const data = event.data;

  if (data.type === "INIT") {
    BlockRegistry.initialize();

    const textureMap = new Map<string, number>(data.textureMap);
    BlockRegistry.linkTextures(textureMap);

    terrain = new TerrainGenerator(69420);
    store = new ChunkStore(terrain);
  }

  const remeshAndSend = (cx: number, cz: number, rawData?: Uint8Array) => {
    if (!store.chunks.has(`${cx},${cz}`)) return;

    const meshData = GreedyMesher.mesh(store, cx, cz);

    const transferList: ArrayBuffer[] = [];
    const buffersToSend: ArrayBuffer[] = [];

    for (let i = 0; i < 10; i++) {
      const buffer = meshData.vertices[i].buffer as ArrayBuffer;
      buffersToSend.push(buffer);
      if (meshData.vertexCounts[i] > 0) {
        transferList.push(buffer);
      }
    }

    if (rawData) {
      transferList.push(rawData.buffer as ArrayBuffer);
    }

    (self as any).postMessage(
      {
        type: "DONE",
        chunkX: cx,
        chunkZ: cz,
        vertices: buffersToSend,
        vertexCounts: meshData.vertexCounts,
        chunkData: rawData || null,
      },
      transferList,
    );
  };

  if (data.type === "GENERATE") {
    const { chunkX, chunkZ } = data;

    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        store.getOrCreateChunk(chunkX + dx, chunkZ + dz);
      }
    }

    const rawDataClone = store.getOrCreateChunk(chunkX, chunkZ).data.slice();
    remeshAndSend(chunkX, chunkZ, rawDataClone);
  }

  if (data.type === "MODIFY") {
    const { wx, wy, wz, blockId, chunkX, chunkZ } = data;

    const chunk = store.chunks.get(`${chunkX},${chunkZ}`);
    if (chunk) {
      const lx = wx - chunkX * 16;
      const lz = wz - chunkZ * 16;

      chunk.setBlock(lx, wy, lz, blockId);
      
      remeshAndSend(chunkX, chunkZ);

      if (lx === 0) remeshAndSend(chunkX - 1, chunkZ);
      if (lx === 15) remeshAndSend(chunkX + 1, chunkZ);
      if (lz === 0) remeshAndSend(chunkX, chunkZ - 1);
      if (lz === 15) remeshAndSend(chunkX, chunkZ + 1);

      if (lx === 0 && lz === 0) remeshAndSend(chunkX - 1, chunkZ - 1);
      if (lx === 15 && lz === 0) remeshAndSend(chunkX + 1, chunkZ - 1);
      if (lx === 0 && lz === 15) remeshAndSend(chunkX - 1, chunkZ + 1);
      if (lx === 15 && lz === 15) remeshAndSend(chunkX + 1, chunkZ + 1);
    }
  }

  if (data.type === "UNLOAD") {
    store.unloadChunk(data.chunkX, data.chunkZ);
  }
};
