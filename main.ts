import { ChunkManager } from "./engine/ChunkManager";
import { compileRegistry } from "./engine/AssetsCompiler";
import { Entity } from "./engine/Entity";
import { Mat4 } from "./engine/Math";
import { WebGLRenderer } from "./engine/WebGLRenderer";
import { WebGPURenderer } from "./engine/WebGPURenderer";
import type { BlockIdMap, IRenderer } from "./engine/types";
import { TimeManager } from "./engine/TimeManager";
import { InputManager } from "./engine/InputManager";
import { UIManager } from "./engine/UIManager";
import { Player } from "./engine/Player";

// === CANVAS ===
const canvas = document.getElementById("gameCanvas")! as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// === HELPER FUNCTIONS ===
// --- Asset Loading ---
async function loadImages(urls: string[]): Promise<HTMLImageElement[]> {
  const promises = urls.map((url) => {
    return new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
      img.src = url;
    });
  });
  return Promise.all(promises);
}

async function initGame() {
  const timeManager = new TimeManager();
  const inputManager = new InputManager(canvas);
  const uiManager = new UIManager(canvas, inputManager, timeManager);

  // === RENDERER ===
  let renderer: IRenderer;
  const gpuRenderer = new WebGPURenderer(canvas);

  const isWebGPUSupported = await gpuRenderer.initialize();

  if (isWebGPUSupported) {
    renderer = gpuRenderer;
  } else {
    console.log("Falling back to WebGL2 Renderer.");
    renderer = new WebGLRenderer(canvas);
  }
  // === CAMERA ===
  const projection = Mat4.create();

  Mat4.perspective(
    projection,
    Math.PI / 4,
    canvas.width / canvas.height,
    0.1,
    1000.0,
  );

  // === RESIZE ===
  window.addEventListener("resize", () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    Mat4.perspective(
      projection,
      Math.PI / 4,
      canvas.width / canvas.height,
      0.1,
      1000.0,
    );
  });

  // === ASSETS ===
  console.log("Fetching and compiling assets...");
  const assetResponse = await fetch("assets.json");
  const rawAssets = await assetResponse.json();

  const compiledAssets = await compileRegistry(rawAssets);

  const images = await loadImages(compiledAssets.textureList);
  console.log("Textures loaded");

  renderer.createTextureArrayFromImage(images, 16);

  // === BLOCK REGISTRY SETUP ===
  const BLOCKS: BlockIdMap = { AIR: 0 };
  const BLOCK_DATA: Record<number, any> = { 0: null };
  const BLOCK_ICONS: Record<number, string> = { 0: "" };

  for (const [blockName, id] of Object.entries(compiledAssets.blockIds)) {
    BLOCKS[blockName.toUpperCase()] = id;
  }

  for (const [blockName, config] of Object.entries(
    compiledAssets.blockRegistry,
  )) {
    BLOCK_DATA[config.id] = config;
    BLOCK_ICONS[config.id] = rawAssets.blocks[blockName].icon;
  }

  // Precompute highlight layer index for quick access in rendering
  const highlightLayerIndex = compiledAssets.textureList.indexOf(
    rawAssets.system.highlightLayer,
  );

  const chunkManager = new ChunkManager(renderer, BLOCK_DATA);
  chunkManager.BLOCKS = BLOCKS;
  chunkManager.worker.postMessage({
    type: "init",
    blocks: BLOCKS,
    blockRegistry: BLOCK_DATA,
  });
  const player = new Player(canvas, inputManager, BLOCKS, BLOCK_ICONS);

  canvas.addEventListener("click", () => {
    if (!uiManager.isGamePaused && !player.inventoryManager.isOpen) {
      canvas.requestPointerLock();
    }
  });

  // === ENTITY ===
  const cowModelData = Entity.getModelData();
  const cowMesh = renderer.createEntityMesh(
    cowModelData.vertices,
    cowModelData.indices,
  );

  // 5. Main Render Loop
  function animate() {
    requestAnimationFrame(animate);

    timeManager.update(
      uiManager.isGamePaused,
      (tickRate) => {
        for (const cow of chunkManager.entities) {
          cow.update(tickRate, chunkManager);
        }
      },
      (deltaTime, timeScale) => {
        const pos = player.camera.getCameraPosition();
        chunkManager.update(pos[0], pos[2]);

        player.update(chunkManager, timeScale, inputManager);
      },
    );

    const gameTime = timeManager.gameTime;
    const fps = timeManager.fps;

    const view = player.camera.getViewMatrix();
    const cameraOrigin = player.camera.getCameraPosition();

    chunkManager.renderDistance = uiManager.renderDistance;
    timeManager.timeSpeed = uiManager.timeSpeed;

    uiManager.renderDebug(
      cameraOrigin,
      fps,
      chunkManager.chunks.size,
      chunkManager.entities.length,
      player.targetedEntity ? `COW [HP: ${player.targetedEntity.hp}]` : "None",
    );

    const sunDirection: [number, number, number] = [
      Math.sin(gameTime),
      Math.cos(gameTime),
      0.5,
    ];

    const { solid, trans } = chunkManager.getVisibleMeshes(
      player.camera.getCameraPosition(),
      player.camera.yaw,
    );

    let isHoldingTorch = 0;
    const heldBlockId = player.inventoryManager.getActiveBlock();
    const heldBlockData = BLOCK_DATA[heldBlockId];
    if (heldBlockData && heldBlockData.light) {
      isHoldingTorch = heldBlockData.light / 15.0;
    }

    let skyColor: [number, number, number] = [0.53, 0.81, 0.92];

    renderer.beginFrame(projection, view, skyColor);

    renderer.drawSkybox(projection, view, sunDirection);

    renderer.drawWorld(
      projection,
      view,
      solid,
      trans,
      sunDirection,
      cameraOrigin,
      isHoldingTorch,
      performance.now() * 0.001,
      player.camera.isSubmerged,
    );

    for (let i = chunkManager.entities.length - 1; i >= 0; i--) {
      const cow = chunkManager.entities[i];
      if (cow.hp <= 0) {
        chunkManager.entities.splice(i, 1);
        continue;
      }

      const flash = cow.damageFlashTimer > 0 ? 0.7 : 0.0;

      renderer.drawEntity(
        cowMesh,
        cow.getModelMatrix(),
        sunDirection,
        50,
        cow.isMoving,
        flash,
      );
    }

    if (player.activeHit) {
      renderer.drawHighlight(
        projection,
        view,
        player.activeHit.x,
        player.activeHit.y,
        player.activeHit.z,
        player.activeHit.normal,
        highlightLayerIndex,
      );
    }

    if (inputManager.showEntityRay && player.nearestEntity) {
      renderer.drawLine(
        cameraOrigin[0],
        cameraOrigin[1],
        cameraOrigin[2],
        player.nearestEntity.x,
        player.nearestEntity.y,
        player.nearestEntity.z,
        1.0,
        0.0,
        0.0,
        projection,
        view,
      );
    }

    renderer.endFrame();
  }

  animate();
}

initGame();
