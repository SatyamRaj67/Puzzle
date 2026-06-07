export class FeatureGenerator {
    static generateOakTree(chunk, startX, startY, startZ, BLOCKS) {
        const height = 4 + Math.floor(Math.random() * 3) // Tree height between 4 and 6

        // Generate the Leaves
        for (let y = startY + height - 2; y <= startY + height + 1; y++) {
            const radius = (y === startY + height + 1) ? 1 : 2 // Top layer has a smaller radius

            for (let x = startX - radius; x <= startX + radius; x++) {
                for (let z = startZ - radius; z <= startZ + radius; z++) {
                    if (x >= 0 && x < chunk.width && z >= 0 && z < chunk.width && y >= 0 && y < chunk.height) {
                        if (Math.abs(x - startX) === radius && Math.abs(z - startZ) === radius && Math.random() > 0.5) continue; // Randomly skip corners for a more natural look

                        if (chunk.getBlock(x, y, z) === BLOCKS.AIR) { // Only place leaves in empty spaces
                            chunk.setBlock(x, y, z, BLOCKS.OAK_LEAVES);
                        }
                    }
                }
            }
        }

        for (let y = startY; y < startY + height; y++) {
            if (startX >= 0 && startX < chunk.width && startZ >= 0 && startZ < chunk.width && y >= 0 && y < chunk.height) {
                chunk.setBlock(startX, y, startZ, BLOCKS.OAK_LOG);
            }
        }
    }
}