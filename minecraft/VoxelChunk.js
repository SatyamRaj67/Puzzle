// Block IDs
// 0: AIR
// 1: GRASS
// 2: DIRT
// 3: STONE

export class VoxelChunk {
    constructor(size = 32) {
        this.size = size;
        this.data = new Uint8Array(this.size * this.size * this.size);
    }

    getIndex(x, y, z) { return x + (y * this.size) + (z * this.size * this.size); }

    setBlock(x, y, z, blockId) {
        // Check if the coordinates are within bounds
        if (x < 0 || x >= this.size || y < 0 || y >= this.size || z < 0 || z >= this.size) {
            throw new Error("Block coordinates out of bounds");
        }

        const index = this.getIndex(x, y, z);
        this.data[index] = blockId;
    }

    getBlock(x, y, z) {
        // Check if the coordinates are within bounds
        if (x < 0 || x >= this.size || y < 0 || y >= this.size || z < 0 || z >= this.size) {
            return 0; // Return 0 for out-of-bounds blocks (air)
        }

        const index = this.getIndex(x, y, z);
        return this.data[index];
    }

    generateFlatTerrain(groundHeight) {
        for (let x = 0; x < this.size; x++) {
            for (let z = 0; z < this.size; z++) {
                for (let y = 0; y < this.size; y++) {
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
        const positions = [], indices = [], colors = [];
        let vertexCount = 0;

        const getColor = (blockId, faceName) => {
            switch (blockId) {
                case 1:
                    switch (faceName) {
                        case 'Top': return [34 / 255, 139 / 255, 34 / 255]; // GRASS TOP
                        case 'Bottom': return [101 / 255, 67 / 255, 33 / 255]; // GRASS BOTTOM
                        default: return [139 / 255, 69 / 255, 19 / 255]; // GRASS SIDE
                    }
                case 2: return [139 / 255, 69 / 255, 19 / 255]; // DIRT
                case 3: return [128 / 255, 128 / 255, 128 / 255]; // STONE
                default: return [1, 1, 1]; // AIR
            }
        }

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

                for (let slice = 0; slice < this.size; slice++) {
                    const mask = new Int32Array(this.size * this.size);

                    // --- PHASE 1: BUILD THE MASK ---
                    // We scan the entire 2D slice to find visible block faces

                    for (let w = 0; w < this.size; w++) {
                        for (let h = 0; h < this.size; h++) {
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
                                mask[w + (h * this.size)] = currentBlock;
                            }
                        }
                    }

                    // --- PHASE 2: GREEDY SCAN THE MASK ---
                    // Group identical blocks into huge quads

                    for (let h = 0; h < this.size; h++) {
                        for (let w = 0; w < this.size; w++) {
                            const blockId = mask[w + (h * this.size)];

                            if (blockId === 0) continue; // Skip empty cells

                            // Step A: Stretch the Width (Rightwards)
                            let width = 1;
                            while (w + width < this.size && mask[(w + width) + h * this.size] === blockId) {
                                width++;
                            }

                            // Step B: Stretch the Height (Downwards)
                            let height = 1;
                            let done = false;

                            while (h + height < this.size && !done) {
                                for (let checkW = 0; checkW < width; checkW++) {
                                    if (mask[(w + checkW) + (h + height) * this.size] !== blockId) {
                                        done = true;
                                        break;
                                    }
                                }
                                if (!done) height++;
                            }

                            // Step C: Generate the 4 corners.
                            this.generateOptimizedQuad(axis, dirMultiplier, slice, w, h, width, height, blockId, faceName, positions, indices, colors, vertexCount, getColor);
                            vertexCount += 4;

                            // Step D: Zero-out the mask
                            for (let clearH = 0; clearH < height; clearH++) {
                                for (let clearW = 0; clearW < width; clearW++) {
                                    mask[(w + clearW) + (h + clearH) * this.size] = 0;
                                }
                            }

                            w += width - 1; // Skip processed cells
                        }
                    }
                }
            }
        }
        return { positions, indices, colors };
    }

    //  --- PHASE 3: GENERATE THE GEOMETRY ---
    generateOptimizedQuad(axis, dir, slice, w, h, width, height, blockId, faceName, positions, indices, colors, vertexCount, getColor) {
        const xOffset = axis.name === 'X' ? (dir === 1 ? 1 : 0) : 0;
        const yOffset = axis.name === 'Y' ? (dir === 1 ? 1 : 0) : 0;
        const zOffset = axis.name === 'Z' ? (dir === 1 ? 1 : 0) : 0;

        const corners = [
            [w, h], [w + width, h], [w + width, h + height], [w, h + height]
        ]

        for (let i = 0; i < 4; i++) {
            let cx = corners[i][0], cy = corners[i][1];

            let finalX = (axis.name === 'X') ? slice + xOffset : (axis.widthAxis === 'X' ? cx : cy);
            let finalY = (axis.name === 'Y') ? slice + yOffset : (axis.widthAxis === 'Y' ? cx : cy);
            let finalZ = (axis.name === 'Z') ? slice + zOffset : (axis.widthAxis === 'Z' ? cx : cy);

            positions.push(finalX, finalY, finalZ);
            colors.push(...getColor(blockId, faceName));
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
}