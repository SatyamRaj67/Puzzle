import { VoxelChunk } from "./VoxelChunk";
import { PerlinNoise } from "./Noise";
import { Entity } from "./Entity";
import type {
  BlockIdMap,
  BlockRegistry,
  IMeshHandle,
  IRenderer,
  RenderPassItem,
} from "./types";

export interface QueuedMesh {
  cx: number;
  cz: number;
  key?: string;
  distancePacked?: number;
}

export interface ChunkGPUResource {
  solidMesh: IMeshHandle | null;
  transMesh: IMeshHandle | null;
  model: Float32Array;
  currentLod: number;
  cx: number;
  cz: number;
}

export class ChunkManager {
  public renderer: IRenderer;
  public blockRegistry: BlockRegistry;
  public noise: PerlinNoise;

  public chunks: Map<string, VoxelChunk>;
  public meshes: Map<string, ChunkGPUResource>;

  public pendingChunks: Set<string>;
  public freeBuffers: ArrayBufferLike[];

  public chunkWidth: number;
  public renderDistance: number;

  public meshingQueue: QueuedMesh[];
  public queuedMeshes: Set<string>;

  public lastPlayerCX: number | null;
  public lastPlayerCZ: number | null;

  public entities: Entity[];
  public BLOCKS: BlockIdMap | null;

  public worker: Worker;

  public solidPass: RenderPassItem[] = [];
  public transPass: RenderPassItem[] = [];
  public isHoldingTorch: number = 0;

  constructor(renderer: IRenderer, blockRegistry: BlockRegistry) {
    this.renderer = renderer;
    this.blockRegistry = blockRegistry;
    this.noise = new PerlinNoise();

    this.chunks = new Map();
    this.meshes = new Map();
    this.pendingChunks = new Set();

    this.freeBuffers = [];

    this.chunkWidth = 16;
    this.renderDistance = 4; // 9 x 9 grid of chunks around the player

    this.meshingQueue = [];
    this.queuedMeshes = new Set();
    this.lastPlayerCX = null;
    this.lastPlayerCZ = null;

    this.entities = [];
    this.BLOCKS = null;

    this.worker = new Worker(new URL("./ChunkWorker.js", import.meta.url), {
      type: "module",
    });

    this.worker.onmessage = (event) => {
      const { cx, cz, buffer } = event.data;
      const key = this.getChunkKey(cx, cz);

      const chunk = new VoxelChunk(this.chunkWidth, 128);
      chunk.blockRegistry = this.blockRegistry;
      chunk.data = new Uint16Array(buffer);

      this.chunks.set(key, chunk);
      this.pendingChunks.delete(key);

      if (this.BLOCKS && Math.random() < 0.15) {
        const herdSize = Math.floor(Math.random() * 4) + 1;

        for (let i = 0; i < herdSize; i++) {
          const lx = Math.floor(Math.random() * this.chunkWidth);
          const lz = Math.floor(Math.random() * this.chunkWidth);

          let surfaceY = 127;
          while (surfaceY > 0 && chunk.getBlock(lx, surfaceY, lz) === 0)
            surfaceY--;

          if (chunk.getBlock(lx, surfaceY, lz) === this.BLOCKS.GRASS_BLOCK) {
            const globalX = cx * this.chunkWidth + lx;
            const globalZ = cz * this.chunkWidth + lz;

            this.entities.push(new Entity(globalX, surfaceY + 1, globalZ));
          }
        }
      }

      this.queueMesh(cx, cz);
      this.queueMesh(cx + 1, cz);
      this.queueMesh(cx - 1, cz);
      this.queueMesh(cx, cz + 1);
      this.queueMesh(cx, cz - 1);
    };
  }

  public getChunkKey(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  public update(playerX: number, playerZ: number): void {
    const currentCX = Math.floor(playerX / this.chunkWidth);
    const currentCZ = Math.floor(playerZ / this.chunkWidth);

    let meshesBuilt = 0;

    while (this.meshingQueue.length > 0 && meshesBuilt < 2) {
      const target = this.meshingQueue.shift()!;
      this.queuedMeshes.delete(target.key!);
      this.rebuildChunkMesh(target.cx, target.cz, currentCX, currentCZ);
      meshesBuilt++;
    }

    if (this.lastPlayerCX !== currentCX || this.lastPlayerCZ !== currentCZ) {
      this.lastPlayerCX = currentCX;
      this.lastPlayerCZ = currentCZ;

      const chunkLoadQueue = [];

      for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
        for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
          const cx = currentCX + x;
          const cz = currentCZ + z;
          const key = this.getChunkKey(cx, cz);

          if (!this.chunks.has(key) && !this.pendingChunks.has(key)) {
            const distancePacked = x * x + z * z;
            chunkLoadQueue.push({ cx, cz, key, distancePacked });
          }
        }
      }

      chunkLoadQueue.sort((a, b) => a.distancePacked - b.distancePacked);

      for (const target of chunkLoadQueue) {
        this.pendingChunks.add(target.key);
        const bufferToRecycle =
          this.freeBuffers.length > 0 ? this.freeBuffers.pop() : null;
        const transferList = bufferToRecycle ? [bufferToRecycle] : [];

        this.worker.postMessage(
          {
            cx: target.cx,
            cz: target.cz,
            chunkWidth: this.chunkWidth,
            chunkHeight: 128,
            recycledBuffer: bufferToRecycle,
          },
          transferList,
        );
      }

      const unloadRadius = this.renderDistance + 2;

      this.entities = this.entities.filter((entity) => {
        const ecx = Math.floor(entity.x / this.chunkWidth);
        const ecz = Math.floor(entity.z / this.chunkWidth);

        return (
          Math.abs(ecx - currentCX) <= unloadRadius &&
          Math.abs(ecz - currentCZ) <= unloadRadius
        );
      });

      for (const key of this.chunks.keys()) {
        const [cx, cz] = key.split(",").map(Number);

        if (
          Math.abs(cx - currentCX) > unloadRadius ||
          Math.abs(cz - currentCZ) > unloadRadius
        ) {
          if (this.meshes.has(key)) {
            const gpuResource = this.meshes.get(key);
            if (!gpuResource) continue;

            if (gpuResource.solidMesh)
              this.renderer.deleteMesh(gpuResource.solidMesh);
            if (gpuResource.transMesh)
              this.renderer.deleteMesh(gpuResource.transMesh);
            this.meshes.delete(key);
          }

          this.freeBuffers.push(this.chunks.get(key)!.data.buffer);
          this.chunks.delete(key);
        }
      }

      for (const [key, gpuResource] of this.meshes.entries()) {
        const [cx, cz] = key.split(",").map(Number);

        const dist = Math.max(
          Math.abs(cx - currentCX),
          Math.abs(cz - currentCZ),
        );
        let desiredLod = 1;
        if (dist >= 48) desiredLod = 16;
        else if (dist >= 32) desiredLod = 8;
        else if (dist >= 24) desiredLod = 4;
        else if (dist >= 16) desiredLod = 2;

        if (gpuResource.currentLod !== desiredLod) {
          this.queueMesh(cx, cz);
        }
      }
    }
  }

  public generateChunk(cx: number, cz: number, key: string): void {
    const chunk = new VoxelChunk(this.chunkWidth, 128);
    chunk.blockRegistry = this.blockRegistry;

    chunk.generateProceduralTerrain(
      this.noise,
      cx * this.chunkWidth,
      cz * this.chunkWidth,
      this.BLOCKS!,
    );

    this.chunks.set(key, chunk);

    this.meshingQueue.push({ cx, cz });

    this.meshingQueue.push({ cx: cx + 1, cz });
    this.meshingQueue.push({ cx: cx - 1, cz });
    this.meshingQueue.push({ cx, cz: cz + 1 });
    this.meshingQueue.push({ cx, cz: cz - 1 });
  }

  rebuildChunkMesh(
    cx: number,
    cz: number,
    playerCX: number,
    playerCZ: number,
  ): void {
    const key = this.getChunkKey(cx, cz);
    if (!this.chunks.has(key)) return;

    const dist = Math.max(Math.abs(cx - playerCX), Math.abs(cz - playerCZ));
    let lodStep = 1;

    if (dist >= 48) lodStep = 16;
    else if (dist >= 32) lodStep = 8;
    else if (dist >= 24) lodStep = 4;
    else if (dist >= 16) lodStep = 2;

    const chunk = this.chunks.get(key)!;
    const meshData = chunk.buildMesh(this, cx, cz, lodStep);

    const existingResource = this.meshes.get(key);
    let solidGpuMesh = existingResource ? existingResource.solidMesh : null;
    let transGpuMesh = existingResource ? existingResource.transMesh : null;

    const processPass = (
      dataBucket: {
        packedData: number[];
        indices: number[];
      },
      existingMesh: IMeshHandle | null,
    ) => {
      const vArray = new Uint32Array(dataBucket.packedData);
      const iArray = new Uint32Array(dataBucket.indices);

      if (iArray.length > 0) {
        if (existingMesh) {
          this.renderer.updateMesh(existingMesh, vArray, iArray);
          return existingMesh;
        } else {
          return this.renderer.createMesh(vArray, iArray);
        }
      } else {
        if (existingMesh) this.renderer.deleteMesh(existingMesh);
        return null;
      }
    };

    solidGpuMesh = processPass(meshData.solid, solidGpuMesh);
    transGpuMesh = processPass(meshData.trans, transGpuMesh);

    if (solidGpuMesh || transGpuMesh) {
      const modelMatrix = new Float32Array([
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        0,
        0,
        0,
        1,
        0,
        cx * this.chunkWidth,
        0,
        cz * this.chunkWidth,
        1, // Translation Offset
      ]);

      this.meshes.set(key, {
        solidMesh: solidGpuMesh,
        transMesh: transGpuMesh,
        model: modelMatrix,
        currentLod: lodStep,
        cx,
        cz,
      });
    } else if (existingResource) {
      this.meshes.delete(key);
    }
  }

  queueMesh(cx: number, cz: number): void {
    const key = this.getChunkKey(cx, cz);
    if (!this.queuedMeshes.has(key)) {
      this.meshingQueue.push({ cx, cz, key });
      this.queuedMeshes.add(key);
    }
  }

  getVisibleMeshes(
    cameraPos: number[],
    cameraYaw: number,
  ): {
    solid: RenderPassItem[];
    trans: RenderPassItem[];
  } {
    const camForwardX = -Math.sin(cameraYaw);
    const camForwardZ = -Math.cos(cameraYaw);

    const solidPass = [];
    const transPass = [];

    for (const {
      solidMesh,
      transMesh,
      model,
      cx,
      cz,
    } of this.meshes.values()) {
      const chunkCenterX = cx * this.chunkWidth + this.chunkWidth / 2;
      const chunkCenterZ = cz * this.chunkWidth + this.chunkWidth / 2;

      const dx = chunkCenterX - cameraPos[0];
      const dz = chunkCenterZ - cameraPos[2];
      const distance = Math.hypot(dx, dz);

      if (distance > this.chunkWidth * 1.5) {
        const dirX = dx / distance;
        const dirZ = dz / distance;
        const dot = dirX * camForwardX + dirZ * camForwardZ;

        if (dot < 0.2) continue; // Skip chunks that are far and mostly behind the camera
      }

      if (solidMesh) solidPass.push({ mesh: solidMesh, model, distance });
      if (transMesh) transPass.push({ mesh: transMesh, model, distance });
    }

    solidPass.sort((a, b) => a.distance - b.distance);
    transPass.sort((a, b) => b.distance - a.distance);

    return {
      solid: solidPass,
      trans: transPass,
    };
  }

  public getBlock(worldX: number, worldY: number, worldZ: number): number {
    if (worldY < 0 || worldY >= 128) return 0; // Out of vertical bounds, treat as air

    const cx = Math.floor(worldX / this.chunkWidth);
    const cz = Math.floor(worldZ / this.chunkWidth);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks.has(key)) return 0; // If chunk unloaded, treat them as air

    const localX = worldX - cx * this.chunkWidth;
    const localZ = worldZ - cz * this.chunkWidth;

    return this.chunks.get(key)!.getBlock(localX, worldY, localZ);
  }

  public setBlock(
    worldX: number,
    worldY: number,
    worldZ: number,
    blockId: number,
  ): void {
    if (worldY < 0 || worldY >= 128) return; // Out of vertical bounds, ignore

    const cx = Math.floor(worldX / this.chunkWidth);
    const cz = Math.floor(worldZ / this.chunkWidth);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks.has(key)) return; // Can't set block in an unloaded chunk

    const oldBlockId = this.getBlock(worldX, worldY, worldZ);
    const oldLight = this.getLight(worldX, worldY, worldZ);
    const oldBlockData = this.blockRegistry[oldBlockId];
    const oldEmittedLight =
      oldBlockData && oldBlockData.light ? oldBlockData.light : 0;

    const chunk = this.chunks.get(key);
    const localX = worldX - cx * this.chunkWidth;
    const localZ = worldZ - cz * this.chunkWidth;

    chunk!.setBlock(localX, worldY, localZ, blockId);

    const newBlockData = this.blockRegistry[blockId];
    const isNewTransparent =
      blockId === 0 || (newBlockData && newBlockData.transparent);
    const newEmittedLight =
      newBlockData && newBlockData.light ? newBlockData.light : 0;

    if (oldEmittedLight > 0 || (!isNewTransparent && oldLight > 0)) {
      const lightToRemove = Math.max(oldEmittedLight, oldLight);
      this.removeLight(worldX, worldY, worldZ, lightToRemove);
    }

    if (newEmittedLight > 0) {
      this.floodFillLight(worldX, worldY, worldZ, newEmittedLight);
    } else if (isNewTransparent) {
      const directions = [
        [1, 0, 0],
        [-1, 0, 0],
        [0, 1, 0],
        [0, -1, 0],
        [0, 0, 1],
        [0, 0, -1],
      ];

      let maxNeighborLight = 0;

      for (const d of directions) {
        const nx = worldX + d[0];
        const ny = worldY + d[1];
        const nz = worldZ + d[2];

        const neighborLight = this.getLight(nx, ny, nz);
        if (neighborLight > maxNeighborLight) {
          maxNeighborLight = neighborLight;
        }
      }

      if (maxNeighborLight > 2) {
        this.floodFillLight(worldX, worldY, worldZ, maxNeighborLight - 2);
      }
    }

    this.updateSkyLightColumn(worldX, worldZ);

    this.rebuildChunkMesh(cx, cz, this.lastPlayerCX!, this.lastPlayerCZ!);
    if (localX === 0)
      this.rebuildChunkMesh(cx - 1, cz, this.lastPlayerCX!, this.lastPlayerCZ!);
    if (localX === this.chunkWidth - 1)
      this.rebuildChunkMesh(cx + 1, cz, this.lastPlayerCX!, this.lastPlayerCZ!);
    if (localZ === 0)
      this.rebuildChunkMesh(cx, cz - 1, this.lastPlayerCX!, this.lastPlayerCZ!);
    if (localZ === this.chunkWidth - 1)
      this.rebuildChunkMesh(cx, cz + 1, this.lastPlayerCX!, this.lastPlayerCZ!);
  }

  public getLight(worldX: number, worldY: number, worldZ: number): number {
    if (worldY < 0 || worldY >= 128) return 0; // Out of vertical bounds, treat as dark

    const cx = Math.floor(worldX / this.chunkWidth);
    const cz = Math.floor(worldZ / this.chunkWidth);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks.has(key)) return 0; // If chunk unloaded, treat them as dark

    const localX = worldX - cx * this.chunkWidth;
    const localZ = worldZ - cz * this.chunkWidth;

    return this.chunks.get(key)!.getLight(localX, worldY, localZ);
  }

  public setLight(
    worldX: number,
    worldY: number,
    worldZ: number,
    lightLevel: number,
  ): void {
    if (worldY < 0 || worldY >= 128) return; // Out of vertical bounds, ignore

    const cx = Math.floor(worldX / this.chunkWidth);
    const cz = Math.floor(worldZ / this.chunkWidth);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks.has(key)) return; // Can't set light in an unloaded chunk

    const chunk = this.chunks.get(key);
    const localX = worldX - cx * this.chunkWidth;
    const localZ = worldZ - cz * this.chunkWidth;

    chunk!.setLight(localX, worldY, localZ, lightLevel);
  }

  public removeLight(
    startX: number,
    startY: number,
    startZ: number,
    oldLight: number,
  ): void {
    // Pre-allocate a large flat array. 200000 slots = 50000 nodes (x, y, z, light)
    const queue = new Int32Array(200000);
    let head = 0;
    let tail = 0;

    const fillQueue = new Int32Array(200000);
    let fillTail = 0;

    const chunksToRebuild = new Set<string>();
    this.setLight(startX, startY, startZ, 0);

    queue[tail++] = startX;
    queue[tail++] = startY;
    queue[tail++] = startZ;
    queue[tail++] = oldLight;

    const directions = [
      1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1,
    ];

    while (head < tail) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];
      const light = queue[head++];

      chunksToRebuild.add(
        `${Math.floor(x / this.chunkWidth)},${Math.floor(z / this.chunkWidth)}`,
      );

      for (let i = 0; i < 18; i += 3) {
        const nx = x + directions[i];
        const ny = y + directions[i + 1];
        const nz = z + directions[i + 2];

        const neighborLight = this.getLight(nx, ny, nz);

        if (neighborLight !== 0 && neighborLight < light) {
          this.setLight(nx, ny, nz, 0);
          queue[tail++] = nx;
          queue[tail++] = ny;
          queue[tail++] = nz;
          queue[tail++] = neighborLight;
        } else if (neighborLight >= light) {
          fillQueue[fillTail++] = nx;
          fillQueue[fillTail++] = ny;
          fillQueue[fillTail++] = nz;
          fillQueue[fillTail++] = neighborLight;
        }
      }
    }

    for (let i = 0; i < fillTail; i += 4) {
      this.floodFillLight(
        fillQueue[i],
        fillQueue[i + 1],
        fillQueue[i + 2],
        fillQueue[i + 3],
      );
    }

    for (const key of chunksToRebuild) {
      const [cx, cz] = key.split(",").map(Number);
      this.queueMesh(cx, cz);
    }
  }

  public floodFillLight(
    startX: number,
    startY: number,
    startZ: number,
    startLight: number,
  ) {
    const queue = new Int32Array(200000);
    let head = 0;
    let tail = 0;

    queue[tail++] = startX;
    queue[tail++] = startY;
    queue[tail++] = startZ;
    queue[tail++] = startLight;
    this.setLight(startX, startY, startZ, startLight);

    const directions = [
      1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 1, 0, 0, -1,
    ];

    const chunksToRebuild = new Set<string>();

    while (head < tail) {
      const x = queue[head++];
      const y = queue[head++];
      const z = queue[head++];
      const light = queue[head++];

      chunksToRebuild.add(
        `${Math.floor(x / this.chunkWidth)},${Math.floor(z / this.chunkWidth)}`,
      );

      if (light <= 1) continue;

      for (let i = 0; i < 18; i += 3) {
        const nx = x + directions[i];
        const ny = y + directions[i + 1];
        const nz = z + directions[i + 2];

        const neighborBlock = this.getBlock(nx, ny, nz);
        const neighborBlockData = this.blockRegistry[neighborBlock];

        if (
          neighborBlock === 0 ||
          (neighborBlockData && neighborBlockData.transparent)
        ) {
          const currentNeighborLight = this.getLight(nx, ny, nz);

          if (currentNeighborLight < light - 2) {
            this.setLight(nx, ny, nz, light - 2);
            queue[tail++] = nx;
            queue[tail++] = ny;
            queue[tail++] = nz;
            queue[tail++] = light - 2;
          }
        }
      }
    }

    for (const key of chunksToRebuild) {
      const [cx, cz] = key.split(",").map(Number);
      this.queueMesh(cx, cz);
    }
  }

  public getSkyLight(worldX: number, worldY: number, worldZ: number): number {
    if (worldY < 0) return 0; // Below world, treat as dark
    if (worldY >= 128) return 15; // Above world, treat as fully lit

    const cx = Math.floor(worldX / this.chunkWidth);
    const cz = Math.floor(worldZ / this.chunkWidth);
    const key = this.getChunkKey(cx, cz);

    if (!this.chunks.has(key)) return 15; // If chunk unloaded, treat them as dark

    const localX = worldX - cx * this.chunkWidth;
    const localZ = worldZ - cz * this.chunkWidth;

    return this.chunks.get(key)!.getSkyLight(localX, worldY, localZ);
  }

  public updateSkyLightColumn(worldX: number, worldZ: number): void {
    let currentSkyLight = 15;

    for (let y = 127; y >= 0; y--) {
      const blockId = this.getBlock(worldX, y, worldZ);
      const blockData = this.blockRegistry[blockId];

      const isTransparent =
        blockId === 0 || (blockData && blockData.transparent);

      if (!isTransparent) {
        currentSkyLight = 0;
      } else if (blockData && blockData.lightAttenuation) {
        currentSkyLight -= blockData.lightAttenuation;
        if (currentSkyLight < 0) currentSkyLight = 0;
      }

      const cx = Math.floor(worldX / this.chunkWidth);
      const cz = Math.floor(worldZ / this.chunkWidth);
      const key = this.getChunkKey(cx, cz);

      if (this.chunks.has(key)) {
        const localX = worldX - cx * this.chunkWidth;
        const localZ = worldZ - cz * this.chunkWidth;

        this.chunks.get(key)!.setSkyLight(localX, y, localZ, currentSkyLight);
      }
    }
  }
}
