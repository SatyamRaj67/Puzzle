import { GreedyMesher } from "../mesher/greedyMesher";
import { LightingEngine } from "../physics/lighting";
import { WorldDB } from "../storage/db";
import { TerrainGenerator } from "../worldgen/terrain";
import { BlockRegistry } from "./blockRegistry";
import { ChunkStore } from "./chunkStore";

let terrain: TerrainGenerator;
let store: ChunkStore;

let isReady = false;
const messageQueue: MessageEvent[] = [];

self.onmessage = async (event: MessageEvent) => {
  const data = event.data;

  if (data.type === "INIT") {
    await WorldDB.init();
    BlockRegistry.initialize();

    const textureMap = new Map<string, number>(data.textureMap);
    BlockRegistry.linkTextures(textureMap);

    terrain = new TerrainGenerator(69420);
    store = new ChunkStore(terrain);

    isReady = true;

    for (const msg of messageQueue) {
      await handleMessage(msg.data);
    }
    messageQueue.length = 0;
    return;
  }

  if (!isReady) {
    messageQueue.push(event);
    return;
  }
  await handleMessage(data);
};

async function handleMessage(data: any) {
  const remeshAndSend = (
    cx: number,
    cz: number,
    rawData?: Uint8Array,
    isGenerate: boolean = false,
  ) => {
    if (!store.chunks.has(`${cx},${cz}`)) return;

    const meshData = GreedyMesher.mesh(store, cx, cz);

    let opaqueVertexCount = 0;
    for (let i = 0; i < 10; i++) opaqueVertexCount += meshData.vertexCounts[i];

    let transVertexCount = 0;
    for (let i = 10; i < 16; i++) transVertexCount += meshData.vertexCounts[i];

    let opaqueBuffer: ArrayBuffer | null = null;
    if (opaqueVertexCount > 0) {
      const opaqueData = new Uint32Array(opaqueVertexCount * 3);
      let ptr = 0;
      for (let i = 0; i < 10; i++) {
        const arr = meshData.vertices[i];
        if (arr.length > 0) {
          opaqueData.set(arr, ptr);
          ptr += arr.length;
        }
      }
      opaqueBuffer = opaqueData.buffer;
    }

    let transBuffer: ArrayBuffer | null = null;
    if (transVertexCount > 0) {
      const transData = new Uint32Array(transVertexCount * 3);
      let ptr = 0;
      for (let i = 10; i < 16; i++) {
        const arr = meshData.vertices[i];
        if (arr.length > 0) {
          transData.set(arr, ptr);
          ptr += arr.length;
        }
      }
      transBuffer = transData.buffer;
    }

    const transferList: ArrayBuffer[] = [];
    if (opaqueBuffer) transferList.push(opaqueBuffer);
    if (transBuffer) transferList.push(transBuffer);
    if (rawData) transferList.push(rawData.buffer as ArrayBuffer);

    (self as any).postMessage(
      {
        type: "DONE",
        chunkX: cx,
        chunkZ: cz,
        opaqueBuffer,
        opaqueVertexCount,
        transBuffer,
        transVertexCount,
        chunkData: rawData || null,
        isGenerate: isGenerate,
      },
      transferList,
    );
  };

  // if (data.type === "GENERATE") {
  switch (data.type) {
    case "GENERATE": {
      const { chunkX, chunkZ } = data;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const nx = chunkX + dx;
          const nz = chunkZ + dz;
          const key = `${nx},${nz}`;
          if (!store.chunks.has(key)) {
            const chunk = store.getOrCreateChunk(nx, nz);

            const savedData = await WorldDB.loadChunk(nx, nz);

            if (savedData) {
              chunk.data.set(savedData);
            } else {
              await WorldDB.saveChunk(nx, nz, chunk.data);
            }
          }
        }
      }

      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          LightingEngine.calculateChunk(store, chunkX + dx, chunkZ + dz);
        }
      }

      const rawDataClone = store.getOrCreateChunk(chunkX, chunkZ).data.slice();
      remeshAndSend(chunkX, chunkZ, rawDataClone, true);
      break;
    }

    case "MODIFY": {
      const { wx, wy, wz, blockId, chunkX, chunkZ } = data;

      const chunk = store.chunks.get(`${chunkX},${chunkZ}`);
      if (chunk) {
        const lx = wx - chunkX * 16;
        const lz = wz - chunkZ * 16;

        const oldBlockId = chunk.getBlock(lx, wy, lz);
        const oldDef = BlockRegistry.getBlock(oldBlockId);
        const newDef = BlockRegistry.getBlock(blockId);

        const oldLightRaw = chunk.getLight(lx, wy, lz);
        const oldBlkLight = oldLightRaw & 0xf;
        const oldSunLight = (oldLightRaw >> 4) & 0xf;

        chunk.setBlock(lx, wy, lz, blockId);
        WorldDB.saveChunk(chunkX, chunkZ, chunk.data);

        const affectedChunks = new Set<string>();
        affectedChunks.add(`${chunkX},${chunkZ}`);

        if (newDef.isOpaque && !oldDef.isOpaque) {
          store.setLight(wx, wy, wz, 0);
          LightingEngine.removeLight(
            store,
            [wx, wy, wz, oldBlkLight],
            false,
            affectedChunks,
          );
          LightingEngine.removeLight(
            store,
            [wx, wy, wz, oldSunLight],
            true,
            affectedChunks,
          );
        } else if (!newDef.isOpaque && oldDef.isOpaque) {
          store.setLight(wx, wy, wz, 0);

          const addBlkQueue: number[] = [];
          const addSunQueue: number[] = [];

          if (wy + 1 < 128) {
            const aboveLight = store.getLight(wx, wy + 1, wz);
            if (aboveLight >> 4 === 15) {
              store.setLight(wx, wy, wz, (15 << 4) | 0);
              addSunQueue.push(wx, wy, wz);
            }
          }

          const dirs = [
            [1, 0, 0],
            [-1, 0, 0],
            [0, 1, 0],
            [0, -1, 0],
            [0, 0, 1],
            [0, 0, -1],
          ];
          for (const [dx, dy, dz] of dirs) {
            const nx = wx + dx,
              ny = wy + dy,
              nz = wz + dz;
            if (ny >= 0 && ny < 128) {
              addBlkQueue.push(nx, ny, nz);
              addSunQueue.push(nx, ny, nz);
            }
          }

          if (addBlkQueue.length > 0)
            LightingEngine.addLight(store, addBlkQueue, false, affectedChunks);
          if (addSunQueue.length > 0)
            LightingEngine.addLight(store, addSunQueue, true, affectedChunks);
        }

        const oldEmission = oldDef.lightEmission || 0;
        const newEmission = newDef.lightEmission || 0;

        if (newEmission > oldEmission) {
          const curSun = (store.getLight(wx, wy, wz) >> 4) & 0xf;
          store.setLight(wx, wy, wz, (curSun << 4) | newEmission);
          LightingEngine.addLight(store, [wx, wy, wz], false, affectedChunks);
        } else if (newEmission < oldEmission) {
          LightingEngine.removeLight(
            store,
            [wx, wy, wz, oldEmission],
            false,
            affectedChunks,
          );
        }

        if (lx === 0) affectedChunks.add(`${chunkX - 1},${chunkZ}`);
        if (lx === 15) affectedChunks.add(`${chunkX + 1},${chunkZ}`);
        if (lz === 0) affectedChunks.add(`${chunkX},${chunkZ - 1}`);
        if (lz === 15) affectedChunks.add(`${chunkX},${chunkZ + 1}`);
        if (lx === 0 && lz === 0)
          affectedChunks.add(`${chunkX - 1},${chunkZ - 1}`);
        if (lx === 15 && lz === 0)
          affectedChunks.add(`${chunkX + 1},${chunkZ - 1}`);
        if (lx === 0 && lz === 15)
          affectedChunks.add(`${chunkX - 1},${chunkZ + 1}`);
        if (lx === 15 && lz === 15)
          affectedChunks.add(`${chunkX + 1},${chunkZ + 1}`);

        for (const key of affectedChunks) {
          const [cx, cz] = key.split(",").map(Number);
          remeshAndSend(cx, cz);
        }
      }
      break;
    }

    case "UNLOAD": {
      store.unloadChunk(data.chunkX, data.chunkZ);
      break;
    }
  }
}
