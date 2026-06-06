import { FirstPersonCamera } from "./engine/FPCamera.js";
import { Mat4 } from "./engine/Math.js";
import { Raycaster } from "./engine/Raycaster.js";
import { Renderer } from "./engine/Renderer.js";
import { VoxelChunk } from "./VoxelChunk.js";


const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// 1. Initialize Renderer and Camera
const renderer = new Renderer(canvas);
const camera = new FirstPersonCamera(canvas);

// 2. Generate the Voxel Data (CPU)
const chunk = new VoxelChunk(32);
chunk.generateFlatTerrain(5);
const meshData = chunk.buildMesh();

console.log(`Sending ${meshData.positions.length / 3} vertices to GPU`);

const vertexData = [];

for (let i = 0; i < meshData.positions.length / 3; i++) {
    // Add XYZ
    vertexData.push(
        meshData.positions[i * 3],
        meshData.positions[(i * 3) + 1],
        meshData.positions[(i * 3) + 2]
    );
    // Add RGB
    vertexData.push(
        meshData.colors[i * 3],
        meshData.colors[(i * 3) + 1],
        meshData.colors[(i * 3) + 2]
    );
}

// 3. Upload Mesh Data to GPU
renderer.setBufferData(
    new Float32Array(vertexData),
    new Uint32Array(meshData.indices)
);


// 4. Setup Matrices
const projection = Mat4.create();
const model = Mat4.create();

Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);
});

let indexCount = meshData.indices.length;
let vertexCount = vertexData.length / 6;

function rebuildAndSendToGPU() {
    const newMeshData = chunk.buildMesh();
    const newVertexData = [];

    for (let i = 0; i < newMeshData.positions.length / 3; i++) {
        // Add XYZ
        newVertexData.push(
            newMeshData.positions[i * 3],
            newMeshData.positions[i * 3 + 1],
            newMeshData.positions[i * 3 + 2]
        )

        // Add RGB
        newVertexData.push(
            newMeshData.colors[i * 3],
            newMeshData.colors[i * 3 + 1],
            newMeshData.colors[i * 3 + 2]
        )
    }

    renderer.updateBufferData(
        new Float32Array(newVertexData),
        new Uint32Array(newMeshData.indices)
    );
    indexCount = newMeshData.indices.length;
}

let blockType = 2; // Default block type to place (e.g., dirt)
window.addEventListener('keydown', (e) => {
    switch (e.key) {
        case '1': blockType = 1; break; // Grass
        case '2': blockType = 2; break; // Dirt
        case '3': blockType = 3; break; // Stone
    }
})

canvas.addEventListener('mousedown', (event) => {
    if (document.pointerLockElement !== canvas) return;

    if (event.button === 0 || event.button === 2) {
        const rayDirection = camera.getRay(
            event.clientX,
            event.clientY,
            canvas.width,
            canvas.height,
            projection
        );
        const cameraOrigin = camera.getCameraPosition();

        const hit = Raycaster.step(cameraOrigin, rayDirection, chunk, 100);

        if (hit) {
            if (event.button === 2) {
                // RIGHT CLICK: BREAK BLOCK
                chunk.setBlock(hit.x, hit.y, hit.z, 0);
            } else if (event.button === 0) {
                // LEFT CLICK: PLACE BLOCK
                const placeX = hit.x + hit.normal[0];
                const placeY = hit.y + hit.normal[1];
                const placeZ = hit.z + hit.normal[2];

                if (camera.isFlying || !camera.isBlockInsidePlayer(placeX, placeY, placeZ)) {
                    chunk.setBlock(placeX, placeY, placeZ, blockType);
                } else {
                    return; // Prevent placing block inside player when not flying
                }
            }

            rebuildAndSendToGPU();
        }
    }
})

canvas.addEventListener('contextmenu', e => e.preventDefault());

let activehit = null;

// 5. Main Render Loop
function animate() {
    requestAnimationFrame(animate);

    camera.update(chunk);
    const view = camera.getViewMatrix();

    renderer.draw(indexCount, projection, view, model);

    const rayDirection = camera.getRay();
    const cameraOrigin = camera.getCameraPosition();

    activehit = Raycaster.step(cameraOrigin, rayDirection, chunk, 100);

    if (activehit) {
        renderer.drawHighlight(projection, view, activehit.x, activehit.y, activehit.z, activehit.normal);
    }
}
animate();