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
                    const distanceSquared = (x * x) + (z * z);
                    chunksToLoad.push({ cx, cz, key, distanceSquared })
                }
            }
        }

        chunksToLoad.sort((a, b) => a.distanceSquared - b.distanceSquared);

        for (const target of chunksToLoad) {
            this.pendingChunks.add(target.key);
            this.worker.postMessage({
                cx: target.cx,
                cz: target.cz,
                chunkWidth: this.chunkWidth,
                chunkHeight: 128
            })
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

        const vertexData = [];

        for (let i = 0; i < meshData.positions.length / 3; i++) {
            vertexData.push(
                meshData.positions[i * 3],
                meshData.positions[i * 3 + 1],
                meshData.positions[i * 3 + 2],

                meshData.uvs[i * 3],
                meshData.uvs[i * 3 + 1],
                meshData.uvs[i * 3 + 2],
            )
        }

        if (this.meshes.has(key)) {
            const gpuResource = this.meshes.get(key);
            this.renderer.updateMesh(
                gpuResource.gpuMesh,
                new Float32Array(vertexData),
                new Uint32Array(meshData.indices)
            )
        } else {
            const mesh = this.renderer.createMesh(new Float32Array(vertexData), new Uint32Array(meshData.indices));
            const modelMatrix = new Float32Array([
                1, 0, 0, 0,
                0, 1, 0, 0,
                0, 0, 1, 0,
                cx * this.chunkWidth, 0, cz * this.chunkWidth, 1 // Translation Offset
            ])
            this.meshes.set(key, { gpuMesh: mesh, model: modelMatrix });
        }
    }

    draw(sunDirection) {
        for (const { gpuMesh, model } of this.meshes.values()) {
            this.renderer.drawMesh(gpuMesh, model, sunDirection);
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