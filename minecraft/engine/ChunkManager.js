import { VoxelChunk } from "./VoxelChunk.js"
import { PerlinNoise } from "./Noise.js"

export class ChunkManager {
    constructor(renderer, blockRegistry) {
        this.renderer = renderer
        this.blockRegistry = blockRegistry
        this.noise = new PerlinNoise()

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

        this.worker = new Worker(new URL('./ChunkWorker.js', import.meta.url), { type: 'module' });

        this.worker.onmessage = (event) => {
            const { cx, cz, buffer } = event.data;
            const key = this.getChunkKey(cx, cz);

            const chunk = new VoxelChunk(this.chunkWidth, 128);
            chunk.blockRegistry = this.blockRegistry;
            chunk.data = new Uint16Array(buffer);

            this.chunks.set(key, chunk);
            this.pendingChunks.delete(key);

            this.queueMesh(cx, cz);
            this.queueMesh(cx + 1, cz);
            this.queueMesh(cx - 1, cz);
            this.queueMesh(cx, cz + 1);
            this.queueMesh(cx, cz - 1);
        }
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    update(playerX, playerZ) {
        const currentCX = Math.floor(playerX / this.chunkWidth);
        const currentCZ = Math.floor(playerZ / this.chunkWidth);

        let meshesBuilt = 0;

        while (this.meshingQueue.length > 0 && meshesBuilt < 2) {
            const target = this.meshingQueue.shift();
            this.queuedMeshes.delete(target.key);
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
                        const distancePacked = (x * x) + (z * z);
                        chunkLoadQueue.push({ cx, cz, key, distancePacked });
                    }
                }
            }

            chunkLoadQueue.sort((a, b) => a.distancePacked - b.distancePacked);

            for (const target of chunkLoadQueue) {
                this.pendingChunks.add(target.key);
                const bufferToRecycle = this.freeBuffers.length > 0 ? this.freeBuffers.pop() : null;
                const transferList = bufferToRecycle ? [bufferToRecycle] : [];

                this.worker.postMessage({
                    cx: target.cx,
                    cz: target.cz,
                    chunkWidth: this.chunkWidth,
                    chunkHeight: 128,
                    recycledBuffer: bufferToRecycle
                }, transferList)
            }

            const unloadRadius = this.renderDistance + 2;
            for (const key of this.chunks.keys()) {
                const [cx, cz] = key.split(',').map(Number);

                if (Math.abs(cx - currentCX) > unloadRadius || Math.abs(cz - currentCZ) > unloadRadius) {
                    if (this.meshes.has(key)) {
                        this.renderer.deleteMesh(this.meshes.get(key).gpuMesh);
                        this.meshes.delete(key);
                    }

                    this.freeBuffers.push(this.chunks.get(key).data.buffer);
                    this.chunks.delete(key);
                }
            }

            for (const [key, gpuResource] of this.meshes.entries()) {
                const [cx, cz] = key.split(',').map(Number);

                const dist = Math.max(Math.abs(cx - currentCX), Math.abs(cz - currentCZ));
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

    generateChunk(cx, cz, key) {
        const chunk = new VoxelChunk(this.chunkWidth, 128);
        chunk.blockRegistry = this.blockRegistry;

        chunk.generateProceduralTerrain(this.noise, cx * this.chunkWidth, cz * this.chunkWidth);

        this.chunks.set(key, chunk);

        this.meshingQueue.push({ cx, cz });

        this.meshingQueue.push({ cx: cx + 1, cz });
        this.meshingQueue.push({ cx: cx - 1, cz });
        this.meshingQueue.push({ cx, cz: cz + 1 });
        this.meshingQueue.push({ cx, cz: cz - 1 });
    }

    rebuildChunkMesh(cx, cz, playerCX, playerCZ) {
        const key = this.getChunkKey(cx, cz);
        if (!this.chunks.has(key)) return; // Can't rebuild mesh for non-existent chunk

        const dist = Math.max(Math.abs(cx - playerCX), Math.abs(cz - playerCZ));
        let lodStep = 1;

        if (dist >= 32) lodStep = 16;
        else if (dist >= 24) lodStep = 8;
        else if (dist >= 16) lodStep = 4;
        else if (dist >= 8) lodStep = 2;

        const chunk = this.chunks.get(key);
        const meshData = chunk.buildMesh(this, cx, cz, lodStep);

        const vertexArray = new Uint32Array(meshData.packedData);
        const indexArray = new Uint32Array(meshData.indices);

        // If the chunk is completely empty.
        if (indexArray.length === 0) {
            if (this.meshes.has(key)) {
                this.renderer.deleteMesh(this.meshes.get(key).gpuMesh);
                this.meshes.delete(key);
            }
            return;
        }

        if (this.meshes.has(key)) {
            const gpuResource = this.meshes.get(key);
            this.renderer.updateMesh(
                gpuResource.gpuMesh,
                vertexArray,
                indexArray
            )

            gpuResource.currentLod = lodStep;
        } else {
            const mesh = this.renderer.createMesh(vertexArray, indexArray);
            const modelMatrix = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                cx * this.chunkWidth, 0, cz * this.chunkWidth, 1 // Translation Offset
            ])
            this.meshes.set(key, { gpuMesh: mesh, model: modelMatrix, currentLod: lodStep });
        }
    }

    queueMesh(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        if (!this.queuedMeshes.has(key)) {
            this.meshingQueue.push({ cx, cz, key });
            this.queuedMeshes.add(key);
        }
    }

    draw(sunDirection, cameraPos, cameraYaw, activeSlotItem) {
        const camForwardX = -Math.sin(cameraYaw);
        const camForwardZ = -Math.cos(cameraYaw);

        const chunksToDraw = [];

        for (const { gpuMesh, model, cx, cz } of this.meshes.values()) {
            const chunkCenterX = cx * this.chunkWidth + this.chunkWidth / 2;
            const chunkCenterZ = cz * this.chunkWidth + this.chunkWidth / 2;

            const dx = chunkCenterX - cameraPos[0];
            const dz = chunkCenterZ - cameraPos[2];

            const distance = Math.hypot(dx, dz);

            if (distance > this.chunkWidth * 1.5) {
                const dirX = dx / distance;
                const dirZ = dz / distance;

                const dot = (dirX * camForwardX) + (dirZ * camForwardZ);

                if (dot < 0.2) continue;
            }

            chunksToDraw.push({ gpuMesh, model, distance });
        }

        chunksToDraw.sort((a, b) => a.distance - b.distance);

        let isHoldingTorch = 0.0;

        const heldBlockData = this.blockRegistry[activeSlotItem];

        if (heldBlockData && heldBlockData.light) {
            isHoldingTorch = heldBlockData.light / 15.0; // Normalize light level to [0, 1]
        }

        for (const chunk of chunksToDraw) {
            this.renderer.drawMesh(chunk.gpuMesh, chunk.model, sunDirection, cameraPos, isHoldingTorch);
        }
    }

    getBlock(worldX, worldY, worldZ) {
        if (worldY < 0 || worldY >= 128) return 0; // Out of vertical bounds, treat as air

        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return 0; // If chunk unloaded, treat them as air

        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);

        return this.chunks.get(key).getBlock(localX, worldY, localZ);
    }

    setBlock(worldX, worldY, worldZ, blockId) {
        if (worldY < 0 || worldY >= 128) return; // Out of vertical bounds, ignore

        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return; // Can't set block in an unloaded chunk

        const oldBlockId = this.getBlock(worldX, worldY, worldZ);
        const oldLight = this.getLight(worldX, worldY, worldZ);
        const oldBlockData = this.blockRegistry[oldBlockId];
        const oldEmittedLight = (oldBlockData && oldBlockData.light) ? oldBlockData.light : 0;

        const chunk = this.chunks.get(key);
        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);
        chunk.setBlock(localX, worldY, localZ, blockId);

        const newBlockData = this.blockRegistry[blockId];
        const isNewTransparent = blockId === 0 || (newBlockData && newBlockData.transparent);
        const newEmittedLight = (newBlockData && newBlockData.light) ? newBlockData.light : 0;

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
                [0, 0, -1]
            ]

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

        this.rebuildChunkMesh(cx, cz, this.lastPlayerCX, this.lastPlayerCZ);
        if (localX === 0) this.rebuildChunkMesh(cx - 1, cz, this.lastPlayerCX, this.lastPlayerCZ);
        if (localX === this.chunkWidth - 1) this.rebuildChunkMesh(cx + 1, cz, this.lastPlayerCX, this.lastPlayerCZ);
        if (localZ === 0) this.rebuildChunkMesh(cx, cz - 1, this.lastPlayerCX, this.lastPlayerCZ);
        if (localZ === this.chunkWidth - 1) this.rebuildChunkMesh(cx, cz + 1, this.lastPlayerCX, this.lastPlayerCZ);
    }

    getLight(worldX, worldY, worldZ) {
        if (worldY < 0 || worldY >= 128) return 0; // Out of vertical bounds, treat as dark

        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return 0; // If chunk unloaded, treat them as dark

        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);
        return this.chunks.get(key).getLight(localX, worldY, localZ);
    }

    setLight(worldX, worldY, worldZ, lightLevel) {
        if (worldY < 0 || worldY >= 128) return; // Out of vertical bounds, ignore

        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return; // Can't set light in an unloaded chunk

        const chunk = this.chunks.get(key);
        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);
        chunk.setLight(localX, worldY, localZ, lightLevel);
    }

    removeLight(startX, startY, startZ, oldLight) {
        // Pre-allocate a large flat array. 200000 slots = 50000 nodes (x, y, z, light)
        const queue = new Int32Array(200000)
        let head = 0;
        let tail = 0;

        const fillQueue = new Int32Array(200000);
        let fillTail = 0;

        const chunksToRebuild = new Set();
        this.setLight(startX, startY, startZ, 0);

        queue[tail++] = startX;
        queue[tail++] = startY;
        queue[tail++] = startZ;
        queue[tail++] = oldLight;

        const directions = [
            1, 0, 0,
            -1, 0, 0,
            0, 1, 0,
            0, -1, 0,
            0, 0, 1,
            0, 0, -1
        ]

        while (head < tail) {
            const x = queue[head++];
            const y = queue[head++];
            const z = queue[head++];
            const light = queue[head++];

            chunksToRebuild.add(`${Math.floor(x / this.chunkWidth)},${Math.floor(z / this.chunkWidth)}`);

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
                }
                else if (neighborLight >= light) {
                    fillQueue[fillTail++] = nx;
                    fillQueue[fillTail++] = ny;
                    fillQueue[fillTail++] = nz;
                    fillQueue[fillTail++] = neighborLight;
                }
            }
        }

        for (let i = 0; i < fillTail; i += 4) {
            this.floodFillLight(fillQueue[i], fillQueue[i + 1], fillQueue[i + 2], fillQueue[i + 3]);
        }

        for (const key of chunksToRebuild) {
            const [cx, cz] = key.split(',').map(Number);
            this.queueMesh(cx, cz);
        }
    }

    floodFillLight(startX, startY, startZ, startLight) {
        const queue = new Int32Array(200000)
        let head = 0;
        let tail = 0;

        queue[tail++] = startX;
        queue[tail++] = startY;
        queue[tail++] = startZ;
        queue[tail++] = startLight;
        this.setLight(startX, startY, startZ, startLight);

        const directions = [
            1, 0, 0,
            -1, 0, 0,
            0, 1, 0,
            0, -1, 0,
            0, 0, 1,
            0, 0, -1
        ]

        const chunksToRebuild = new Set();

        while (head < tail) {
            const x = queue[head++];
            const y = queue[head++];
            const z = queue[head++];
            const light = queue[head++];

            chunksToRebuild.add(`${Math.floor(x / this.chunkWidth)},${Math.floor(z / this.chunkWidth)}`);

            if (light <= 1) continue;

            for (let i = 0; i < 18; i += 3) {
                const nx = x + directions[i];
                const ny = y + directions[i + 1];
                const nz = z + directions[i + 2];

                const neighborBlock = this.getBlock(nx, ny, nz);
                const neighborBlockData = this.blockRegistry[neighborBlock];

                if (neighborBlock === 0 || (neighborBlockData && neighborBlockData.transparent)) {
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
            const [cx, cz] = key.split(',').map(Number);
            this.queueMesh(cx, cz);
        }
    }

    getSkyLight(worldX, worldY, worldZ) {
        if (worldY < 0) return 0; // Below world, treat as dark
        if (worldY >= 128) return 15; // Above world, treat as fully lit

        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return 15; // If chunk unloaded, treat them as dark

        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);

        return this.chunks.get(key).getSkyLight(localX, worldY, localZ);
    }

    updateSkyLightColumn(worldX, worldZ) {
        let currentSkyLight = 15;

        for (let y = 127; y >= 0; y--) {
            const blockId = this.getBlock(worldX, y, worldZ);
            const blockData = this.blockRegistry[blockId];

            const isTransparent = blockId === 0 || (blockData && blockData.transparent);

            if (!isTransparent) {
                currentSkyLight = 0;
            }

            const cx = Math.floor(worldX / this.chunkWidth);
            const cz = Math.floor(worldZ / this.chunkWidth);
            const key = this.getChunkKey(cx, cz);

            if (this.chunks.has(key)) {
                const localX = worldX - (cx * this.chunkWidth);
                const localZ = worldZ - (cz * this.chunkWidth);

                this.chunks.get(key).setSkyLight(localX, y, localZ, currentSkyLight);
            }
        }
    }
}