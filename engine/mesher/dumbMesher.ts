import { Chunk } from '../world/chunk';

const FLOATS_PER_VERTEX = 6;

export class DumbMesher {
    
    public static mesh(chunk: Chunk): { vertices: Float32Array, vertexCount: number } {
        const vertices: number[] = [];

        for (let y = 0; y < Chunk.HEIGHT; y++) {
            for (let z = 0; z < Chunk.DEPTH; z++) {
                for (let x = 0; x < Chunk.WIDTH; x++) {
                    
                    const blockId = chunk.getBlock(x, y, z);
                    
                    if (blockId !== 0) {
                        this.addBlockFaces(x, y, z, vertices);
                    }
                }
            }
        }

        return {
            vertices: new Float32Array(vertices),
            vertexCount: vertices.length / FLOATS_PER_VERTEX
        };
    }

    private static addBlockFaces(x: number, y: number, z: number, verts: number[]) {
        const r = 0.2, g = 0.8, b = 0.2;

        // Front Face (Z+)
        verts.push(
            x, y, z+1, r, g, b,      x+1, y, z+1, r, g, b,    x+1, y+1, z+1, r, g, b,
            x, y, z+1, r, g, b,      x+1, y+1, z+1, r, g, b,  x, y+1, z+1, r, g, b
        );
        // Back Face (Z-)
        verts.push(
            x, y, z, r, g, b,        x, y+1, z, r, g, b,      x+1, y+1, z, r, g, b,
            x, y, z, r, g, b,        x+1, y+1, z, r, g, b,    x+1, y, z, r, g, b
        );
        // Top Face (Y+) - Slightly brighter green for fake lighting
        verts.push(
            x, y+1, z, r*1.2, g*1.2, b*1.2,    x, y+1, z+1, r*1.2, g*1.2, b*1.2,  x+1, y+1, z+1, r*1.2, g*1.2, b*1.2,
            x, y+1, z, r*1.2, g*1.2, b*1.2,    x+1, y+1, z+1, r*1.2, g*1.2, b*1.2, x+1, y+1, z, r*1.2, g*1.2, b*1.2
        );
        // Bottom Face (Y-) - Darker
        verts.push(
            x, y, z, r*0.5, g*0.5, b*0.5,      x+1, y, z, r*0.5, g*0.5, b*0.5,    x+1, y, z+1, r*0.5, g*0.5, b*0.5,
            x, y, z, r*0.5, g*0.5, b*0.5,      x+1, y, z+1, r*0.5, g*0.5, b*0.5,  x, y, z+1, r*0.5, g*0.5, b*0.5
        );
        // Right Face (X+)
        verts.push(
            x+1, y, z, r*0.8, g*0.8, b*0.8,    x+1, y+1, z, r*0.8, g*0.8, b*0.8,  x+1, y+1, z+1, r*0.8, g*0.8, b*0.8,
            x+1, y, z, r*0.8, g*0.8, b*0.8,    x+1, y+1, z+1, r*0.8, g*0.8, b*0.8, x+1, y, z+1, r*0.8, g*0.8, b*0.8
        );
        // Left Face (X-)
        verts.push(
            x, y, z, r*0.8, g*0.8, b*0.8,      x, y, z+1, r*0.8, g*0.8, b*0.8,    x, y+1, z+1, r*0.8, g*0.8, b*0.8,
            x, y, z, r*0.8, g*0.8, b*0.8,      x, y+1, z+1, r*0.8, g*0.8, b*0.8,  x, y+1, z, r*0.8, g*0.8, b*0.8
        );
    }
}