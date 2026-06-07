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

    const BLOCKS = { AIR: 0 }
    const BLOCK_DATA = { 0: null };

    let currentId = 1;
    for (const [name, textures] of Object.entries(assets.blocks)) {
        BLOCKS[name.toUpperCase()] = currentId;
        BLOCK_DATA[currentId] = textures;
        currentId++;
    }

    const chunkManager = new ChunkManager(renderer, BLOCK_DATA);

    chunkManager.worker.postMessage({
        type: 'init',
        blocks: BLOCKS
    })


    // 4. Setup Matrices
    const projection = Mat4.create();
    const model = Mat4.create();

    Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

    // ======================
    // UI and MENU
    // ======================

    const pauseMenu = document.getElementById('pause-menu');

    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
            pauseMenu.style.display = 'none';
            lastFrameTime = performance.now(); // Reset frame time to prevent large delta
        } else {
            pauseMenu.style.display = 'flex';
        }
    })

    document.getElementById('btn-resume').addEventListener('click', () => {
        canvas.requestPointerLock();
    })

    const rdSlider = document.getElementById('rd-slider');
    const rdVal = document.getElementById('rd-val');

    rdSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        chunkManager.renderDistance = value;
        rdVal.innerText = `${value} Chunks`;
    })

    const fovSlider = document.getElementById('fov-slider');
    const fovVal = document.getElementById('fov-val');
    fovSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        currentFOV = value * Math.PI / 180;
        Mat4.perspective(projection, currentFOV, canvas.width / canvas.height, 0.1, 1000.0);
        fovVal.innerText = `${value}°`;
    })

    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    speedSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        timeSpeed = value * 0.00001;
        speedVal.innerText = `${(value / 10).toFixed(1)}x`;
    })

    const btnToggleTime = document.getElementById('btn-toggle-time');
    btnToggleTime.addEventListener('click', () => {
        isTimePaused = !isTimePaused;
        btnToggleTime.innerText = isTimePaused ? 'Resume Time' : 'Pause Time';
        btnToggleTime.style.background = isTimePaused ? "#e67e22" : "#444";
    })

    document.getElementById('btn-set-noon').addEventListener('click', () => {
        gameTime = 0;
    })

    document.getElementById('btn-quit').addEventListener('click', () => {
        window.close();
    })

    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);
    });

    const debugHUD = document.getElementById('debug-hud');
    let showDebugInfo = false;

    window.addEventListener('keydown', (event) => {
        if (event.key === 'F3') {
            event.preventDefault();
            showDebugInfo = !showDebugInfo;
            debugHUD.style.display = showDebugInfo ? 'block' : 'none';
        }
    })

    const inventory = [
        BLOCKS.GRASS, BLOCKS.DIRT, BLOCKS.STONE,
        BLOCKS.OAK_LOG, BLOCKS.OAK_LEAVES, BLOCKS.GLOWSTONE,
        BLOCKS.AIR, BLOCKS.AIR, BLOCKS.AIR
    ]

    let activeSlot = 0;
    const slotsUI = document.querySelectorAll('.slot');

    function updateHotbarUI() {
        slotsUI.forEach((slot, index) => slot.classList.remove('active'));
        slotsUI[activeSlot].classList.add('active');
    }

    window.addEventListener('wheel', (event) => {
        if (document.pointerLockElement !== canvas) return;

        if (event.deltaY > 0) {
            activeSlot = (activeSlot + 1) % inventory.length;
        } else {
            activeSlot = (activeSlot - 1 + inventory.length) % inventory.length;
        }

        updateHotbarUI();
    })

    document.addEventListener('keydown', (event) => {
        if (document.pointerLockElement !== canvas) return;
        const keyNum = parseInt(event.key);

        if (keyNum >= 1 && keyNum <= 9) {
            activeSlot = keyNum - 1;
            updateHotbarUI();
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

                    const selectedBlock = inventory[activeSlot];
                    if (selectedBlock === BLOCKS.AIR) return; // Can't place air

                    if (camera.isFlying || !camera.isBlockInsidePlayer(placeX, placeY, placeZ)) {
                        chunkManager.setBlock(placeX, placeY, placeZ, selectedBlock);

                        const blockData = assets.blocks[Object.keys(BLOCKS).find(key => BLOCKS[key] === selectedBlock).toLowerCase()];
                    } else {
                        return; // Prevent placing block inside player when not flying
                    }
                }
            }
        }
    })

    canvas.addEventListener('contextmenu', e => e.preventDefault());

    let activehit = null;

    let currentFOV = Math.PI / 2;

    let gameTime = 0;
    let timeSpeed = 0.0001;
    let isTimePaused = false;
    let lastFrameTime = performance.now();

    // 5. Main Render Loop
    function animate() {
        requestAnimationFrame(animate);

        const now = performance.now();
        const deltaTime = now - lastFrameTime;
        lastFrameTime = now;

        const fps = Math.round(1000 / Math.max(deltaTime, 1));

        if (!isTimePaused) {
            gameTime += deltaTime * timeSpeed;
        }

        const pos = camera.getCameraPosition();
        chunkManager.update(pos[0], pos[2]);

        if (showDebugInfo) {
            debugHUD.innerText =
                `XYZ: ${pos[0].toFixed(0)} / ${pos[1].toFixed(0)} / ${pos[2].toFixed(0)}\n` +
                `FPS: ${fps}\n` +
                `Chunks Loaded: ${chunkManager.chunks.size}`;
        }

        camera.update(chunkManager);
        const view = camera.getViewMatrix();


        const sunDirection = [
            Math.sin(gameTime),
            Math.cos(gameTime),
            0.5
        ]

        renderer.beginFrame(projection, view, [0, 0, 0]);
        renderer.drawSkybox(projection, view, sunDirection)

        chunkManager.draw(sunDirection, camera.getCameraPosition(), camera.yaw, inventory[activeSlot]);

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