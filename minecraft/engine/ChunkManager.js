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
        this.renderDistance = 2; // 5 x 5 grid of chunks around the player

        this.worker = new Worker(new URL('./ChunkWorker.js', import.meta.url), { type: 'module' });

        this.worker.onmessage = (event) => {
            const { cx, cz, buffer } = event.data;
            const key = this.getChunkKey(cx, cz);

            const chunk = new VoxelChunk(this.chunkWidth, 128);
            chunk.blockRegistry = this.blockRegistry;
            chunk.data = new Uint8Array(buffer);

            this.chunks.set(key, chunk);
            this.pendingChunks.delete(key);

            this.rebuildChunkMesh(cx, cz);

            this.rebuildChunkMesh(cx + 1, cz);
            this.rebuildChunkMesh(cx - 1, cz);
            this.rebuildChunkMesh(cx, cz + 1);
            this.rebuildChunkMesh(cx, cz - 1);
        }
    }

    getChunkKey(cx, cz) {
        return `${cx},${cz}`;
    }

    update(playerX, playerZ) {
        const currentCX = Math.floor(playerX / this.chunkWidth);
        const currentCZ = Math.floor(playerZ / this.chunkWidth);

        const chunksToLoad = [];

        for (let x = -this.renderDistance; x <= this.renderDistance; x++) {
            for (let z = -this.renderDistance; z <= this.renderDistance; z++) {
                const cx = currentCX + x;
                const cz = currentCZ + z;
                const key = this.getChunkKey(cx, cz);

                if (!this.chunks.has(key) && !this.pendingChunks.has(key)) {
                    const distancePacked = (x * x) + (z * z);
                    chunksToLoad.push({ cx, cz, key, distancePacked })
                }
            }
        }

        chunksToLoad.sort((a, b) => a.distancePacked - b.distancePacked);

        for (const target of chunksToLoad) {
            this.pendingChunks.add(target.key);

            const bufferToRecycle = this.freeBuffers.length > 0 ? this.freeBuffers.pop() : null;

            const transferList = bufferToRecycle ? [bufferToRecycle] : [];

            this.worker.postMessage({
                cx: target.cx,
                cz: target.cz,
                chunkWidth: this.chunkWidth,
                chunkHeight: 128,
                recycledBuffer: bufferToRecycle
            }, transferList);
        }

        const unloadRadius = this.renderDistance + 2;

        for (const key of this.chunks.keys()) {
            const [cx, cz] = key.split(',').map(Number);

            const distanceX = Math.abs(cx - currentCX);
            const distanceZ = Math.abs(cz - currentCZ);

            if (distanceX > unloadRadius || distanceZ > unloadRadius) {
                if (this.meshes.has(key)) {
                    const gpuResource = this.meshes.get(key);
                    this.renderer.deleteMesh(gpuResource.gpuMesh);
                    this.meshes.delete(key);
                }

                const chunkToDelete = this.chunks.get(key);
                this.freeBuffers.push(chunkToDelete.data.buffer);

                this.chunks.delete(key);
            }
        }
    }

    generateChunk(cx, cz, key) {
        const chunk = new VoxelChunk(this.chunkWidth, 128);
        chunk.blockRegistry = this.blockRegistry;

        chunk.generateProceduralTerrain(this.noise, cx * this.chunkWidth, cz * this.chunkWidth);

        this.chunks.set(key, chunk);
        this.rebuildChunkMesh(cx, cz);

        this.rebuildChunkMesh(cx + 1, cz);
        this.rebuildChunkMesh(cx - 1, cz);
        this.rebuildChunkMesh(cx, cz + 1);
        this.rebuildChunkMesh(cx, cz - 1);
    }

    rebuildChunkMesh(cx, cz) {
        const key = this.getChunkKey(cx, cz);
        if (!this.chunks.has(key)) return; // Can't rebuild mesh for non-existent chunk

        const chunk = this.chunks.get(key);

        const meshData = chunk.buildMesh(this, cx, cz);

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
        } else {
            const mesh = this.renderer.createMesh(vertexArray, indexArray);
            const modelMatrix = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                cx * this.chunkWidth, 0, cz * this.chunkWidth, 1 // Translation Offset
            ])
            this.meshes.set(key, { gpuMesh: mesh, model: modelMatrix });
        }
    }

    draw(sunDirection, cameraPos, cameraYaw) {
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

        for (const chunk of chunksToDraw) {
            this.renderer.drawMesh(chunk.gpuMesh, chunk.model, sunDirection);
        }
    }

    getBlock(worldX, worldY, worldZ) {
        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return 0; // If chunk unloaded, treat them as air

        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);

        return this.chunks.get(key).getBlock(localX, worldY, localZ);
    }

    setBlock(worldX, worldY, worldZ, blockId) {
        const cx = Math.floor(worldX / this.chunkWidth);
        const cz = Math.floor(worldZ / this.chunkWidth);
        const key = this.getChunkKey(cx, cz);

        if (!this.chunks.has(key)) return; // Can't set block in an unloaded chunk

        const chunk = this.chunks.get(key);

        const localX = worldX - (cx * this.chunkWidth);
        const localZ = worldZ - (cz * this.chunkWidth);

        chunk.setBlock(localX, worldY, localZ, blockId);
        this.rebuildChunkMesh(cx, cz);

        // Rebuild neighboring chunks if block is on the edge
        if (localX === 0) this.rebuildChunkMesh(cx - 1, cz);
        if (localX === this.chunkWidth - 1) this.rebuildChunkMesh(cx + 1, cz);
        if (localZ === 0) this.rebuildChunkMesh(cx, cz - 1);
        if (localZ === this.chunkWidth - 1) this.rebuildChunkMesh(cx, cz + 1);
    }
}