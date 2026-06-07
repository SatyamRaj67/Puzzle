import { ChunkManager } from "./engine/ChunkManager.js";
import { FirstPersonCamera } from "./engine/FPCamera.js";
import { Mat4 } from "./engine/Math.js";
import { PerlinNoise } from "./engine/Noise.js";
import { Raycaster } from "./engine/Raycaster.js";
import { Renderer } from "./engine/Renderer.js";
import { VoxelChunk } from "./engine/VoxelChunk.js";


const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

async function loadImages(urls) {
    const promises = urls.map(url => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        })
    })
    return Promise.all(promises);
}

async function initGame() {
    const renderer = new Renderer(canvas);
    const camera = new FirstPersonCamera(canvas);

    console.log('Fetching texture atlas...');
    const assetResponse = await fetch('assets.json');
    const assets = await assetResponse.json();

    console.log('Loading textures...');
    const images = await loadImages(assets.textures);
    console.log('Textures loaded successfully');

    renderer.createTextureArrayFromImage(images, 16);

    const chunkManager = new ChunkManager(renderer, assets.blocks);


    // 4. Setup Matrices
    const projection = Mat4.create();
    const model = Mat4.create();

    Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);
    });

    const debugHUD = document.getElementById('debug-hud');
    let showDebugInfo = false;

    let blockType = 2; // Default block type to place (e.g., dirt)


    window.addEventListener('keydown', (e) => {
        switch (e.key) {
            case '1': blockType = 1; break; // Grass
            case '2': blockType = 2; break; // Dirt
            case '3': blockType = 3; break; // Stone

            case 'F3':
                e.preventDefault();
                showDebugInfo = !showDebugInfo;
                debugHUD.style.display = showDebugInfo ? 'block' : 'none';
                break;
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

            const hit = Raycaster.step(cameraOrigin, rayDirection, chunkManager, 8);

            if (hit) {
                if (event.button === 2) {
                    // RIGHT CLICK: BREAK BLOCK
                    chunkManager.setBlock(hit.x, hit.y, hit.z, 0);
                } else if (event.button === 0) {
                    // LEFT CLICK: PLACE BLOCK
                    const placeX = hit.x + hit.normal[0];
                    const placeY = hit.y + hit.normal[1];
                    const placeZ = hit.z + hit.normal[2];

                    if (camera.isFlying || !camera.isBlockInsidePlayer(placeX, placeY, placeZ)) {
                        chunkManager.setBlock(placeX, placeY, placeZ, blockType);
                    } else {
                        return; // Prevent placing block inside player when not flying
                    }
                }
            }
        }
    })

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    let activehit = null;

    // 5. Main Render Loop
    function animate() {
        requestAnimationFrame(animate);

        const pos = camera.getCameraPosition();
        chunkManager.update(pos[0], pos[2]);

        if (showDebugInfo) {
            debugHUD.innerText =
                `XYZ: ${pos[0].toFixed(0)} / ${pos[1].toFixed(0)} / ${pos[2].toFixed(0)}\n` +
                `Chunks Loaded: ${chunkManager.chunks.size}`;
        }

        camera.update(chunkManager);
        const view = camera.getViewMatrix();

        const time = performance.now() * 0.0001;

        const sunDirection = [
            Math.sin(time),
            Math.cos(time),
            0.5
        ]

        renderer.beginFrame(projection, view, [0, 0, 0]);
        renderer.drawSkybox(projection, view, sunDirection)

        chunkManager.draw(sunDirection)

        const rayDirection = camera.getRay();
        const cameraOrigin = camera.getCameraPosition();

        activehit = Raycaster.step(cameraOrigin, rayDirection, chunkManager, 8);

        if (activehit) {
            renderer.drawHighlight(projection, view, activehit.x, activehit.y, activehit.z, activehit.normal, assets.system.highlightLayer);
        }
    }
    animate();
}

initGame()