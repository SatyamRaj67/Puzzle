import { BlockRegistry } from "../world/blockRegistry";

export class UI {
  // Menus
  private pauseMenu = document.getElementById("pause-menu")! as HTMLDivElement;
  private optionsMenu = document.getElementById(
    "options-menu",
  )! as HTMLDivElement;
  private devtoolsMenu = document.getElementById(
    "devtools-menu",
  )! as HTMLDivElement;

  // HUD
  private debugHud = document.getElementById("debug-hud")! as HTMLDivElement;
  private crosshair = document.getElementsByClassName(
    "crosshair",
  )![0] as HTMLElement;
  private hotbarSlots = document.querySelectorAll(".slot");

  // State
  public isPaused: boolean = false;
  public showDebug: boolean = false;
  public activeHotbarIndex: number = 0;
  public hotbarBlocks: number[] = [];

  public invertMouse: boolean = false;

  constructor(private canvas: HTMLCanvasElement) {
    this.setupMenus();
    this.setupHotbar();
    this.setupDebug();
  }

  private setupMenus() {
    document.addEventListener("pointerlockchange", () => {
      this.isPaused = document.pointerLockElement !== this.canvas;

      if (this.isPaused) {
        this.pauseMenu.style.display = "flex";
        this.crosshair.style.display = "none";
      } else {
        this.pauseMenu.style.display = "none";
        this.optionsMenu.style.display = "none";
        this.devtoolsMenu.style.display = "none";
        this.crosshair.style.display = "block";
      }
    });

    document.getElementById("btn-resume")?.addEventListener("click", () => {
      this.canvas.requestPointerLock();
    });

    document.getElementById("btn-options")?.addEventListener("click", () => {
      this.pauseMenu.style.display = "none";
      this.optionsMenu.style.display = "flex";
    });

    document.getElementById("btn-devtools")?.addEventListener("click", () => {
      this.pauseMenu.style.display = "none";
      this.devtoolsMenu.style.display = "flex";
    });

    document
      .getElementById("go-pause-menu-from-options")
      ?.addEventListener("click", () => {
        this.optionsMenu.style.display = "none";
        this.pauseMenu.style.display = "flex";
      });

    document
      .getElementById("go-pause-menu-from-devtools")
      ?.addEventListener("click", () => {
        this.devtoolsMenu.style.display = "none";
        this.pauseMenu.style.display = "flex";
      });
  }

  private setupHotbar() {
    this.hotbarBlocks = [
      BlockRegistry.getId("grass_block"), // 0
      BlockRegistry.getId("dirt"), // 1
      BlockRegistry.getId("stone"), // 2
      BlockRegistry.getId("oak_log"), // 3
      BlockRegistry.getId("oak_leaves"), // 4
      BlockRegistry.getId("glowstone"), // 5
      BlockRegistry.getId("water"), // 6
      BlockRegistry.getId("grass"), // 7
      0,
    ];

    this.hotbarSlots.forEach((slot, index) => {
      const blockId = this.hotbarBlocks[index];
      if (blockId !== 0) {
        const iconUrl = BlockRegistry.getBlock(blockId).icon;
        if (iconUrl) {
          slot.innerHTML = `<img src="${iconUrl}" alt="Block" />`;
        } else {
          slot.innerHTML = "";
        }
      } else {
        slot.innerHTML = "";
      }
    });

    this.updateHotbarVisuals();

    // Mouse Wheel scrolling
    document.addEventListener("wheel", (e) => {
      if (this.isPaused) return;

      if (e.deltaY > 0) {
        this.activeHotbarIndex = (this.activeHotbarIndex + 1) % 9;
      } else {
        this.activeHotbarIndex = (this.activeHotbarIndex - 1 + 9) % 9;
      }
      this.updateHotbarVisuals();
    });

    // Number keys 1-9
    window.addEventListener("keydown", (e) => {
      if (this.isPaused) return;
      if (e.key >= "1" && e.key <= "9") {
        this.activeHotbarIndex = parseInt(e.key) - 1;
        this.updateHotbarVisuals();
      }

      if (e.code === "KeyI") {
          this.invertMouse = !this.invertMouse;
          console.log("Mouse inverted:", this.invertMouse);
      }
    });
  }

  private updateHotbarVisuals() {
    this.hotbarSlots.forEach((slot, index) => {
      if (index === this.activeHotbarIndex) {
        slot.classList.add("active");
      } else {
        slot.classList.remove("active");
      }
    });
  }

  private setupDebug() {
    window.addEventListener("keydown", (e) => {
      if (e.code === "F3") {
        e.preventDefault();
        this.showDebug = !this.showDebug;
        this.debugHud.style.display = this.showDebug ? "block" : "none";
      }
    });
  }

  public getActiveBlockId(): number {
    return this.hotbarBlocks[this.activeHotbarIndex];
  }

  public updateDebugHUD(
    fps: number,
    x: number,
    y: number,
    z: number,
    chunks: number,
  ) {
    if (!this.showDebug) return;
    this.debugHud.innerHTML = `
      FPS: ${fps.toFixed(0)}<br>
      XYZ: ${x.toFixed(2)} / ${y.toFixed(2)} / ${z.toFixed(2)}<br>
      Chunks Loaded: ${chunks}
    `;
  }
}
