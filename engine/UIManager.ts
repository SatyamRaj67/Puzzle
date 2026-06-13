import type { InputManager } from "./InputManager";
import type { TimeManager } from "./TimeManager";

export class UIManager {
  private debugHUD = document.getElementById("debug-hud")!;
  private pauseMenu = document.getElementById("pause-menu")!;
  private optionsMenu = document.getElementById("options-menu")!;
  private devtoolsMenu = document.getElementById("devtools-menu")!;

  public renderDistance: number = 8;
  public fov: number = Math.PI / 2;
  public timeSpeed: number = 0.0001;
  public isGamePaused: boolean = false;

  constructor(
    private canvas: HTMLCanvasElement,
    private inputManager: InputManager,
    private timeManager: TimeManager,
  ) {
    this.setupPauseMenu();
    this.setupSliders();
    this.setupTimeControls();
  }

  private setupPauseMenu() {
    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement === this.canvas) {
        this.pauseMenu.style.display = "none";
        this.isGamePaused = false;
      } else {
        this.pauseMenu.style.display = "flex";
        this.isGamePaused = true;
      }
    });

    document
      .getElementById("btn-resume")!
      .addEventListener("click", () => this.canvas.requestPointerLock());

    document.getElementById("btn-options")!.addEventListener("click", () => {
      this.optionsMenu.style.display = "flex";
      this.pauseMenu.style.display = "none";
    });

    document
      .getElementById("go-pause-menu-from-options")!
      .addEventListener("click", () => {
        this.optionsMenu.style.display = "none";
        this.pauseMenu.style.display = "flex";
      });

    document.getElementById("btn-devtools")!.addEventListener("click", () => {
      this.devtoolsMenu.style.display = "flex";
      this.pauseMenu.style.display = "none";
    });

    document
      .getElementById("go-pause-menu-from-devtools")!
      .addEventListener("click", () => {
        this.devtoolsMenu.style.display = "none";
        this.pauseMenu.style.display = "flex";
      });

    document.getElementById("btn-quit")!.addEventListener("click", () => {
      window.close();
    });
  }

  private setupSliders() {
    document.getElementById("rd-slider")!.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.renderDistance = val;
      document.getElementById("rd-val")!.innerText = val.toString();
    });

    document.getElementById("fov-slider")!.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.fov = (val * Math.PI) / 180;
      document.getElementById("fov-val")!.innerText = `${val}°`;
    });

    document.getElementById("speed-slider")!.addEventListener("input", (e) => {
      const val = parseInt((e.target as HTMLInputElement).value);
      this.timeSpeed = val * 0.00001;
      document.getElementById("speed-val")!.innerText =
        `${(val / 10).toFixed(1)}x`;
    });
  }

  private setupTimeControls() {
    document.getElementById("btn-set-noon")!.addEventListener("click", () => {
      this.timeManager.gameTime = 0; // Reset the sun!
    });

    const btnToggleTime = document.getElementById("btn-toggle-time")!;
    btnToggleTime.addEventListener("click", () => {
      this.timeManager.isTimePaused = !this.timeManager.isTimePaused;
      btnToggleTime.innerText = this.timeManager.isTimePaused
        ? "Resume Time"
        : "Pause Time";
      btnToggleTime.style.background = this.timeManager.isTimePaused
        ? "#e67e22"
        : "#444";
    });
  }

  public renderDebug(
    pos: [number, number, number],
    fps: number,
    chunksLoaded: number,
    entitiesLoaded: number,
    targetInfo: string,
  ) {
    if (this.inputManager.showDebug) {
      this.debugHUD.style.display = "block";
      this.debugHUD.innerText =
        `XYZ: ${pos[0].toFixed(0)} / ${pos[1].toFixed(0)} / ${pos[2].toFixed(0)}\n` +
        `FPS: ${fps}\n` +
        `Chunks Loaded: ${chunksLoaded}\n` +
        `Entities Loaded: ${entitiesLoaded}\n` +
        `Target: ${targetInfo}`;
    } else {
      this.debugHUD.style.display = "none";
    }
  }
}
