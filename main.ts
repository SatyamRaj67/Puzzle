import { Input } from "./engine/core/input";
import { mat4 } from "./engine/core/math/mat4";
import { Time } from "./engine/core/time";
import { initWebGPU } from "./engine/gpu/device";
import { Raycaster } from "./engine/physics/raycast";
import { FPCamera } from "./engine/render/camera/fpCamera";
import { Renderer } from "./engine/render/renderer";
import { WorldDB } from "./engine/storage/db";
import { UI } from "./engine/ui/ui";
import { BlockRegistry } from "./engine/world/blockRegistry";
import { ChunkManager } from "./engine/world/chunkManager";
import { GameTime } from "./engine/world/gameTime";

const canvas = document.createElement("canvas") as HTMLCanvasElement;
canvas.id = "gameCanvas";
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

document.body.appendChild(canvas);

async function bootstrap() {
  try {
    BlockRegistry.initialize();
    const gpu = await initWebGPU(canvas);
    const input = new Input(canvas);
    const camera = new FPCamera(canvas.width / canvas.height);
    const renderer = new Renderer(gpu, canvas.width, canvas.height);
    const ui = new UI(canvas);
    const gameTime = new GameTime();

    await renderer.textureAtlas.buildAtlas(
      BlockRegistry.getAllBlocks(),
      renderer.pipeline,
    );
    BlockRegistry.linkTextures(renderer.textureAtlas.textureMap);

    const chunkManager = new ChunkManager(renderer);
    chunkManager.requestChunk(0, 0);

    const fovSlider = document.getElementById("fov-slider") as HTMLInputElement;
    const fovVal = document.getElementById("fov-val") as HTMLSpanElement;
    fovSlider.addEventListener("input", (e) => {
      const val = (e.target as HTMLInputElement).value;
      fovVal.innerText = `${val}°`;
      mat4.perspective(
        camera.projectionMatrix,
        (parseInt(val) * Math.PI) / 180,
        canvas.width / canvas.height,
        0.1,
        1000,
      );
    });

    const rdSlider = document.getElementById("rd-slider") as HTMLInputElement;
    const rdVal = document.getElementById("rd-val") as HTMLSpanElement;
    rdSlider.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      rdVal.innerText = val.toString();
      chunkManager.renderDistance = val;
    });

    const speedSlider = document.getElementById(
      "speed-slider",
    ) as HTMLInputElement;
    const speedVal = document.getElementById("speed-val") as HTMLSpanElement;
    speedSlider.addEventListener("input", (e) => {
      const val = parseFloat((e.target as HTMLInputElement).value);
      gameTime.timeSpeed = val;
      speedVal.innerText = `${val.toFixed(1)}x`;
    });

    const btnToggleTime = document.getElementById(
      "btn-toggle-time",
    ) as HTMLButtonElement;
    btnToggleTime.addEventListener("click", () => {
      gameTime.isPaused = !gameTime.isPaused;
      btnToggleTime.innerText = gameTime.isPaused
        ? "Resume Time"
        : "Pause Time";
    });

    document.getElementById("btn-set-noon")?.addEventListener("click", () => {
      gameTime.timeOfDay = 1.0;
    });

    const resetBtn = document.getElementById("btn-reset-world")! as HTMLButtonElement;
    resetBtn.addEventListener("click", async () => {
      const confirmWipe = confirm("⚠️ Are you sure you want to delete the entire world? This cannot be undone.");
      if (confirmWipe) {
        resetBtn.innerText = "Wiping...";
        (resetBtn).disabled = true;

        await WorldDB.clearWorld();
        window.location.reload();
      }
    })

    camera.position[0] = 8;
    camera.position[1] = 128;
    camera.position[2] = 25;

    window.addEventListener("resize", () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      camera.updateProjection(canvas.width / canvas.height);
      renderer.resizeDepthTexture(canvas.width, canvas.height);

      const fov = (parseInt(fovSlider.value) * Math.PI) / 180;
      mat4.perspective(
        camera.projectionMatrix,
        fov,
        window.innerWidth / window.innerHeight,
        0.1,
        1000,
      );
    });

    let frameCount = 0;
    let lastFpsTime = performance.now();
    let currentFps = 0;

    function fixedUpdate(dt: number) {
      if (ui.isPaused) {
        input.resetPerFrame();
        return;
      }

      gameTime.update(dt);

      camera.update(dt, input, chunkManager.store);
      chunkManager.update(camera);

      if ((input.leftClick || input.rightClick) && input.isPointerLocked) {
        const lookDir = new Float32Array([
          Math.cos(camera.pitch) * Math.cos(camera.yaw),
          Math.sin(camera.pitch),
          Math.cos(camera.pitch) * Math.sin(camera.yaw),
        ]);

        const eyePos = new Float32Array([
          camera.position[0],
          camera.position[1] + 1.6,
          camera.position[2],
        ]);

        const hitResult = Raycaster.step(
          eyePos,
          lookDir,
          6.0,
          chunkManager.store,
        );

        if (hitResult.hit) {
          // Determine which action to take based on the UI toggle
          const isBreak = ui.invertMouse ? input.rightClick : input.leftClick;
          const isPlace = ui.invertMouse ? input.leftClick : input.rightClick;

          if (isBreak) {
            chunkManager.setBlock(
              hitResult.blockPos[0],
              hitResult.blockPos[1],
              hitResult.blockPos[2],
              0,
            );
          } else if (isPlace) {
            const placeX = hitResult.blockPos[0] + hitResult.normal[0];
            const placeY = hitResult.blockPos[1] + hitResult.normal[1];
            const placeZ = hitResult.blockPos[2] + hitResult.normal[2];

            const blockToPlace = ui.getActiveBlockId();
            if (blockToPlace !== 0) {
              chunkManager.setBlock(placeX, placeY, placeZ, blockToPlace);
            }
          }
        }
      }

      input.resetPerFrame();
    }

    // Render Tick
    function render() {
      frameCount++;
      const now = performance.now();
      if (now - lastFpsTime >= 1000) {
        currentFps = frameCount;
        frameCount = 0;
        lastFpsTime = now;
      }

      ui.updateDebugHUD(
        currentFps,
        camera.position[0],
        camera.position[1],
        camera.position[2],
        chunkManager.loadedChunks.size,
      );

      const activeBlockId = ui.getActiveBlockId();

      let heldLightLevel = 0.0;
      if (activeBlockId !== 0) {
        heldLightLevel =
          BlockRegistry.getBlock(activeBlockId).lightEmission / 15.0;
      }
      chunkManager.draw(
        camera,
        engineTime.elapsedTime,
        gameTime,
        heldLightLevel,
      );
    }

    const engineTime = new Time(fixedUpdate, render);
    engineTime.start();

    console.log("ENGINE STARTING IN 3.. 2... 1.. VROOOOOOMM!!!!🚀");
  } catch (error) {
    console.error("Error:", error);
  }
}

bootstrap();
