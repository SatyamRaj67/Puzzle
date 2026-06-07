import { VoxelChunk } from "./VoxelChunk.js";
import { PerlinNoise } from "./Noise.js";

const noise = new PerlinNoise(12345);

self.onmessage = function (event) {
    // Recieve instructions from main thread
    const { cx, cz, chunkWidth, chunkHeight } = event.data;

    const chunk = new VoxelChunk(chunkWidth, chunkHeight);

    chunk.generateProceduralTerrain(noise, cx * chunkWidth, cz * chunkWidth);

    self.postMessage({
        cx,
        cz,
        buffer: chunk.data.buffer
    }, [chunk.data.buffer]); // Transfer the buffer for efficient memory usage
}