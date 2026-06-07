// Block IDs
// 0: AIR
// 1: GRASS
// 2: DIRT
// 3: STONE

export class VoxelChunk {
    constructor(width = 16, height = 128) {
        this.width = width;
        this.height = height;
        this.data = new Uint8Array(this.width * this.height * this.width);
    }

    getIndex(x, y, z) { return x + (y * this.width) + (z * this.width * this.height); }

    setBlock(x, y, z, blockId) {
        // Check if the coordinates are within bounds
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.width) {
            throw new Error("Block coordinates out of bounds");
        }

        const index = this.getIndex(x, y, z);
        this.data[index] = blockId;
    }

    getBlock(x, y, z) {
        // Check if the coordinates are within bounds
        if (x < 0 || x >= this.width || y < 0 || y >= this.height || z < 0 || z >= this.width) {
            return 0; // Return 0 for out-of-bounds blocks (air)
        }

        const index = this.getIndex(x, y, z);
        return this.data[index];
    }

    generateFlatTerrain(groundHeight) {
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.width; z++) {
                for (let y = 0; y < this.height; y++) {
                    this.setBlock(x, y, z, 0); // AIR

                    if (y < groundHeight) {
                        this.setBlock(x, y, z, 3); // DIRT
                    }

                    if (y === groundHeight) {
                        this.setBlock(x, y, z, 1); // GRASS
                    }

                }
            }
        }
    }

    // ==========================================
    // THE GREEDY MESHER
    // ==========================================

    buildMesh() {
        const positions = [], indices = [], uvs = [];
        let vertexCount = 0;

        const axes = [
            { name: 'Y', sliceDir: [0, 1, 0], widthAxis: 'X', heightAxis: 'Z' },
            { name: 'X', sliceDir: [1, 0, 0], widthAxis: 'Z', heightAxis: 'Y' },
            { name: 'Z', sliceDir: [0, 0, 1], widthAxis: 'X', heightAxis: 'Y' }
        ]

        // For every axis (X, Y, Z), we check the positive and negative direction to find faces
        for (const axis of axes) {
            for (const dirMultiplier of [1, -1]) {
                let faceName = 'Side';
                if (axis.name === 'Y') {
                    faceName = (dirMultiplier === 1) ? 'Top' : 'Bottom';
                }

                const wLimit = this.width;
                const hLimit = (axis.name === 'Y') ? this.width : this.height;

                for (let slice = 0; slice < (axis.name === 'Y' ? this.height : this.width); slice++) {
                    const mask = new Int32Array(this.width * this.height);

                    // --- PHASE 1: BUILD THE MASK ---
                    // We scan the entire 2D slice to find visible block faces

                    for (let w = 0; w < wLimit; w++) {
                        for (let h = 0; h < hLimit; h++) {
                            // Map 2D (w, h) coordinates back to 3D (x, y, z)
                            let x = (axis.name === 'X') ? slice : (axis.widthAxis === 'X' ? w : h);
                            let y = (axis.name === 'Y') ? slice : (axis.widthAxis === 'Y' ? w : h);
                            let z = (axis.name === 'Z') ? slice : (axis.widthAxis === 'Z' ? w : h);

                            const currentBlock = this.getBlock(x, y, z);

                            if (currentBlock == 0) continue; // Skip air blocks

                            const neighborX = x + (axis.name === 'X' ? dirMultiplier : 0);
                            const neighborY = y + (axis.name === 'Y' ? dirMultiplier : 0);
                            const neighborZ = z + (axis.name === 'Z' ? dirMultiplier : 0);

                            const neighborBlock = this.getBlock(neighborX, neighborY, neighborZ);

                            if (neighborBlock === 0) {
                                mask[w + (h * wLimit)] = currentBlock;
                            }
                        }
                    }

                    // --- PHASE 2: GREEDY SCAN THE MASK ---
                    // Group identical blocks into huge quads

                    for (let h = 0; h < this.height; h++) {
                        for (let w = 0; w < this.width; w++) {
                            const blockId = mask[w + (h * this.width)];

                            if (blockId === 0) continue; // Skip empty cells

                            // Step A: Stretch the Width (Rightwards)
                            let width = 1;
                            while (w + width < this.width && mask[(w + width) + h * this.width] === blockId) {
                                width++;
                            }

                            // Step B: Stretch the Height (Downwards)
                            let height = 1;
                            let done = false;

                            while (h + height < this.height && !done) {
                                for (let checkW = 0; checkW < width; checkW++) {
                                    if (mask[(w + checkW) + (h + height) * this.width] !== blockId) {
                                        done = true;
                                        break;
                                    }
                                }
                                if (!done) height++;
                            }

                            // Step C: Generate the 4 corners.
                            this.generateOptimizedQuad(axis, dirMultiplier, slice, w, h, width, height, blockId, faceName, positions, indices, uvs, vertexCount);
                            vertexCount += 4;

                            // Step D: Zero-out the mask
                            for (let clearH = 0; clearH < height; clearH++) {
                                for (let clearW = 0; clearW < width; clearW++) {
                                    mask[(w + clearW) + (h + clearH) * this.width] = 0;
                                }
                            }

                            w += width - 1; // Skip processed cells
                        }
                    }
                }
            }
        }
        return { positions, indices, uvs };
    }

    //  --- PHASE 3: GENERATE THE GEOMETRY ---
    generateOptimizedQuad(axis, dir, slice, w, h, width, height, blockId, faceName, positions, indices, uvs, vertexCount) {
        const xOffset = axis.name === 'X' ? (dir === 1 ? 1 : 0) : 0;
        const yOffset = axis.name === 'Y' ? (dir === 1 ? 1 : 0) : 0;
        const zOffset = axis.name === 'Z' ? (dir === 1 ? 1 : 0) : 0;

        let texLayer = 0;
      const blockData = this.blockRegistry[blockId.toString()];

        if (blockData) {
            if (blockData[faceName] !== undefined) {
                texLayer = blockData[faceName];
            } else {
                texLayer = blockData['All'];
            }
        }

        const corners = [
            [w, h], [w + width, h], [w + width, h + height], [w, h + height]
        ]

        const uvCoords = [[0, 0], [width, 0], [width, height], [0, height]]

        for (let i = 0; i < 4; i++) {
            let cx = corners[i][0], cy = corners[i][1];

            let finalX = (axis.name === 'X') ? slice + xOffset : (axis.widthAxis === 'X' ? cx : cy);
            let finalY = (axis.name === 'Y') ? slice + yOffset : (axis.widthAxis === 'Y' ? cx : cy);
            let finalZ = (axis.name === 'Z') ? slice + zOffset : (axis.widthAxis === 'Z' ? cx : cy);

            positions.push(finalX, finalY, finalZ);

            uvs.push(uvCoords[i][0], uvCoords[i][1], texLayer);
        }

        let flip = dir !== 1; // Flip the triangle order for back faces
        if (axis.name === 'X' || axis.name === 'Y') {
            flip = !flip; // Flip the winding order for X and Y faces to maintain correct normals
        }

        if (flip) {
            indices.push(
                vertexCount, vertexCount + 3, vertexCount + 2,
                vertexCount + 2, vertexCount + 1, vertexCount
            );
        } else {
            indices.push(
                vertexCount, vertexCount + 1, vertexCount + 2,
                vertexCount + 2, vertexCount + 3, vertexCount
            );
        }
    }

    generateProceduralTerrain(noise, offsetX = 0, offsetZ = 0) {
        // FBM (Fractal Brownian Motion) parameters
        const octaves = 4;            // How many layers of noise to combine
        const persistence = 0.5;   // How much the amplitude decreases each layer
        const lacunarity = 2.0;     // How much the frequency increases each layer
        const scale = 0.02;           // Base Zoom Level

        const baseHeight = 4;     // Minimum terrain height
        const maxAmplitude = 20;     // Maximum terrain height

        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.width; z++) {
                let amplitude = 1;
                let frequency = 1;
                let noiseHeight = 0;
                let maxValue = 0;

                for (let octave = 0; octave < octaves; octave++) {
                    const worldX = (x + offsetX) * scale * frequency;
                    const worldZ = (z + offsetZ) * scale * frequency;

                    const rawNoise = noise.get(worldX, worldZ);

                    noiseHeight += rawNoise * amplitude;
                    maxValue += amplitude;

                    amplitude *= persistence;
                    frequency *= lacunarity;
                }

                // Normalize the layered noise to 0.0 - 1.0 range
                const normalizedNoise = noiseHeight / maxValue;

                const sharpNoise = Math.pow(normalizedNoise, 1.5); // Exaggerate peaks and flatten valleys

                const terrainHeight = Math.floor(baseHeight + sharpNoise * maxAmplitude);

                for (let y = 0; y < this.height; y++) {
                    this.setBlock(x, y, z, 0); // AIR

                    if (y < terrainHeight - 4) {
                        this.setBlock(x, y, z, 3); // STONE
                    } else if (y < terrainHeight - 1) {
                        this.setBlock(x, y, z, 2); // DIRT
                    } else if (y < terrainHeight) {
                        this.setBlock(x, y, z, 1); // GRASS
                    }
                }
            }
        }
    }
}