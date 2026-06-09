import { ChunkManager } from "./engine/ChunkManager.js";
import { compileRegistry } from './engine/AssetsCompiler.js'
import { Entity } from "./engine/Entity.js";
import { FirstPersonCamera } from "./engine/FPCamera.js";
import { Mat4 } from "./engine/Math.js";
import { PerlinNoise } from "./engine/Noise.js";
import { Raycaster } from "./engine/Raycaster.js";
import { Renderer } from "./engine/Renderer.js";
import { VoxelChunk } from "./engine/VoxelChunk.js";

// === CANVAS ===
const canvas = document.getElementById('gameCanvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === HELPER FUNCTIONS ===
// --- Asset Loading ---
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
    // === CAMERA ===
    const renderer = new Renderer(canvas);
    const camera = new FirstPersonCamera(canvas);

    const projection = Mat4.create();
    const model = Mat4.create();

    Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);

    // === RESIZE ===
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        Mat4.perspective(projection, Math.PI / 4, canvas.width / canvas.height, 0.1, 1000.0);
    });

    // === ASSETS ===
    console.log('Fetching and compiling assets...');
    const assetResponse = await fetch('assets.json');
    const rawAssets = await assetResponse.json();

    const compiledAssets = await compileRegistry(rawAssets);

    const images = await loadImages(compiledAssets.textureList)
    console.log('Textures loaded');

    renderer.createTextureArrayFromImage(images, 16)

    // === BLOCK REGISTRY SETUP ===
    const BLOCKS = { AIR: 0 };
    const BLOCK_DATA = { 0: null };
    const BLOCK_ICONS = { 0: null };

    for (const [blockName, id] of Object.entries(compiledAssets.blockIds)) {
        BLOCKS[blockName.toUpperCase()] = id;
    }

    for (const [blockName, config] of Object.entries(compiledAssets.blockRegistry)) {
        BLOCK_DATA[config.id] = config;
        BLOCK_ICONS[config.id] = rawAssets.blocks[blockName].icon;
    }

    // Precompute highlight layer index for quick access in rendering
    const highlightLayerIndex = compiledAssets.textureList.indexOf(rawAssets.system.highlightLayer);

    // === CHUNK MANAGER SETUP ===
    const chunkManager = new ChunkManager(renderer, BLOCK_DATA);
    chunkManager.worker.postMessage({
        type: 'init',
        blocks: BLOCKS,
        blockRegistry: BLOCK_DATA
    });

    // === ENTITIES ===
    const cowModelData = Entity.getModelData();
    const cowMesh = renderer.createEntityMesh(cowModelData.vertices, cowModelData.indices);

    const cows = [];

    const playerPos = camera.getCameraPosition();

    cows.push(new Entity(playerPos[0] + 5, playerPos[1], playerPos[2] + 5));

    // === UI & MENU === 
    // --- Pause Menu

    const pauseMenu = document.getElementById('pause-menu');
    document.addEventListener('pointerlockchange', () => {
        if (document.pointerLockElement === canvas) {
            pauseMenu.style.display = 'none';
            lastFrameTime = performance.now();
        } else {
            if (isInventoryOpen) return;
            pauseMenu.style.display = 'flex';
        }
    })

    document.getElementById('btn-resume').addEventListener('click', () => {
        canvas.requestPointerLock();
    })

    // --- Options Menu
    pauseMenu.querySelector('#btn-options').addEventListener('click', () => {
        document.getElementById('options-menu').style.display = 'flex';
        pauseMenu.style.display = 'none';
    })

    const rdSlider = document.getElementById('rd-slider');
    const rdVal = document.getElementById('rd-val');

    rdSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        chunkManager.renderDistance = value;
        rdVal.innerText = value;
    })

    const fovSlider = document.getElementById('fov-slider');
    const fovVal = document.getElementById('fov-val');
    fovSlider.addEventListener('input', (e) => {
        const value = parseInt(e.target.value);
        currentFOV = value * Math.PI / 180;
        Mat4.perspective(projection, currentFOV, canvas.width / canvas.height, 0.1, 1000.0);
        fovVal.innerText = `${value}°`;
    })

    document.getElementById('go-pause-menu-from-options').addEventListener('click', () => {
        document.getElementById('options-menu').style.display = 'none';
        pauseMenu.style.display = 'flex';
    })

    document.getElementById('btn-devtools').addEventListener('click', () => {
        document.getElementById('devtools-menu').style.display = 'flex';
        pauseMenu.style.display = 'none';
    })

    document.getElementById('go-pause-menu-from-devtools').addEventListener('click', () => {
        document.getElementById('devtools-menu').style.display = 'none';
        pauseMenu.style.display = 'flex';
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

    // === DEBUG HUD ===
    const debugHUD = document.getElementById('debug-hud');
    let showDebugInfo = false;

    window.addEventListener('keydown', (event) => {
        if (event.key === 'F3') {
            event.preventDefault();
            showDebugInfo = !showDebugInfo;
            debugHUD.style.display = showDebugInfo ? 'block' : 'none';
        }

        if (event.key.toLowerCase() === 'e') {
            pauseMenu.style.display = 'none';
            if (isInventoryOpen) {
                isInventoryOpen = false;
                inventoryMenu.style.display = 'none';

                if (mouseHeldItem !== BLOCKS.AIR) {
                    const emptySlot = inventory.indexOf(BLOCKS.AIR);
                    if (emptySlot !== -1) {
                        inventory[emptySlot] = mouseHeldItem;
                    }
                    mouseHeldItem = BLOCKS.AIR;
                    cursorItemUI.style.display = 'none';
                }
                canvas.requestPointerLock();
                updateInventoryUI();
            } else {
                isInventoryOpen = true;
                inventoryMenu.style.display = 'flex';
                document.exitPointerLock();
                updateInventoryUI();
            }
        }

        if (!isInventoryOpen && document.pointerLockElement === canvas) {
            const keyNum = parseInt(event.key);
            if (keyNum >= 1 && keyNum <= 9) {
                activeSlot = keyNum - 1;
                updateInventoryUI();
            }
        }
    })

    // === HOTBAR & INVENTORY ===
    const INVENTORY_SIZE = 36;
    const inventory = new Array(INVENTORY_SIZE).fill(BLOCKS.AIR);

    inventory[0] = BLOCKS.GRASS;
    inventory[1] = BLOCKS.DIRT;
    inventory[2] = BLOCKS.STONE;
    inventory[3] = BLOCKS.OAK_LOG;
    inventory[4] = BLOCKS.OAK_LEAVES;
    inventory[5] = BLOCKS.GLOWSTONE;

    let activeSlot = 0;

    // --- UI ELEMENTS ---
    const slotsUI = document.querySelectorAll('.slot');
    const inventoryMenu = document.getElementById('inventory-menu');
    const inventoryGrid = document.getElementById('inventory-grid');
    const cursorItemUI = document.getElementById('cursor-item');

    let mouseHeldItem = BLOCKS.AIR;
    let isInventoryOpen = false;

    document.addEventListener('mousemove', (event) => {
        if (mouseHeldItem !== BLOCKS.AIR) {
            cursorItemUI.style.left = `${event.clientX - 16}px`;
            cursorItemUI.style.top = `${event.clientY - 16}px`;
        }
    });

    function updateInventoryUI() {
        for (let i = 0; i < 9; i++) {
            slotsUI[i].classList.remove('active');
            slotsUI[i].innerHTML = '';

            const blockId = inventory[i];
            if (blockId !== BLOCKS.AIR) {
                const img = document.createElement('img');
                img.src = BLOCK_ICONS[blockId];
                slotsUI[i].appendChild(img);
            }
        }

        slotsUI[activeSlot].classList.add('active');

        if (isInventoryOpen) {
            inventoryGrid.innerHTML = '';

            for (let i = 0; i < INVENTORY_SIZE; i++) {
                const slot = document.createElement('div');
                slot.classList.add('inventory-slot');
                inventoryGrid.appendChild(slot);

                const blockId = inventory[i];
                if (blockId !== BLOCKS.AIR) {
                    const img = document.createElement('img');
                    img.src = BLOCK_ICONS[blockId];
                    slot.appendChild(img);
                }

                slot.addEventListener('mousedown', (event) => {
                    event.preventDefault();

                    if (mouseHeldItem === BLOCKS.AIR && inventory[i] !== BLOCKS.AIR) {
                        // PICK UP ITEM
                        mouseHeldItem = inventory[i];
                        inventory[i] = BLOCKS.AIR;
                    } else if (mouseHeldItem !== BLOCKS.AIR && inventory[i] === BLOCKS.AIR) {
                        // PLACE ITEM
                        inventory[i] = mouseHeldItem;
                        mouseHeldItem = BLOCKS.AIR;
                    } else if (mouseHeldItem !== BLOCKS.AIR && inventory[i] !== BLOCKS.AIR) {
                        // SWAP ITEMS
                        const temp = inventory[i];
                        inventory[i] = mouseHeldItem;
                        mouseHeldItem = temp;
                    }

                    if (mouseHeldItem !== BLOCKS.AIR) {
                        cursorItemUI.src = BLOCK_ICONS[mouseHeldItem];
                        cursorItemUI.style.display = 'block';
                    } else {
                        cursorItemUI.style.display = 'none';
                    }

                    updateInventoryUI();
                })

                inventoryGrid.appendChild(slot);
            }
        }
    }

    updateInventoryUI();

    function updateHotbarUI() {
        slotsUI.forEach((slot, index) => slot.classList.remove('active'));
        slotsUI[activeSlot].classList.add('active');
    }

    window.addEventListener('wheel', (event) => {
        if (isInventoryOpen || document.pointerLockElement !== canvas) return;

        if (event.deltaY > 0) {
            activeSlot = (activeSlot + 1) % 9;
        } else {
            activeSlot = (activeSlot - 1 + 9) % 9;
        }

        updateHotbarUI();
    })

    // === MOUSE INTERACTION & RAYCASTING ===
    canvas.addEventListener('mousedown', (event) => {
        if (isInventoryOpen || document.pointerLockElement !== canvas) return;

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
                    } else {
                        return; // Prevent placing block inside player when not flying
                    }
                }
            }
        }
    })

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
            renderer.drawHighlight(projection, view, activehit.x, activehit.y, activehit.z, activehit.normal, highlightLayerIndex);
        }

        renderer.gl.useProgram(renderer.entityProgram);
        renderer.gl.uniformMatrix4fv(renderer.entityLocations.projection, false, projection);
        renderer.gl.uniformMatrix4fv(renderer.entityLocations.view, false, view);

        for (const cow of cows) {
            cow.update(deltaTime, chunkManager);
            renderer.drawEntity(cowMesh, cow.getModelMatrix(), sunDirection, 2);
        }

        renderer.gl.useProgram(renderer.program);
    }

    animate();
}

initGame()