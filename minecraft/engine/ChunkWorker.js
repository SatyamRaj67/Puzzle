import { VoxelChunk } from "./VoxelChunk.js";
import { PerlinNoise } from "./Noise.js";
import { FeatureGenerator } from "./FeatureGenerator.js";

const terrainNoise = new PerlinNoise();
const treeNoise = new PerlinNoise();

let BLOCKS = null;

self.onmessage = function (event) {
    if (event.data.type === 'init') {
        BLOCKS = event.data.blocks;
        return;
    }

    // Recieve instructions from main thread
    const { cx, cz, chunkWidth, chunkHeight, recycledBuffer } = event.data;

    const chunk = new VoxelChunk(chunkWidth, chunkHeight, recycledBuffer);

    if (recycledBuffer) {
        chunk.reset();
    }

    chunk.generateProceduralTerrain(terrainNoise, cx * chunkWidth, cz * chunkWidth, BLOCKS);

    for (let x = 2; x < chunkWidth - 2; x++) {
        for (let z = 2; z < chunkWidth - 2; z++) {
            let surfaceY = 0;

            for (let y = chunkHeight - 1; y >= 0; y--) {
                if (chunk.getBlock(x, y, z) !== 0) {
                    surfaceY = y;
                    break;
                }
            }

            if (chunk.getBlock(x, surfaceY, z) === 1) { // Check if it's grass
                const globalX = cx * chunkWidth + x;
                const globalZ = cz * chunkWidth + z;

                const isForest = treeNoise.get(globalX * 0.05, globalZ * 0.05) > 0.6;

                if (isForest && Math.random() < 0.05) {
                    FeatureGenerator.generateOakTree(chunk, x, surfaceY + 1, z, BLOCKS  );
                }
            }
        }
    }

    self.postMessage({
        cx,
        cz,
        buffer: chunk.data.buffer
    }, [chunk.data.buffer]); // Transfer the buffer for efficient memory usage
}