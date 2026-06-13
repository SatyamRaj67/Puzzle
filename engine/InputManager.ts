export class InputManager {
  public keys: Record<string, boolean> = {};

  public isPaused: boolean = false;
  public showDebug: boolean = false;
  public showEntityRay: boolean = false;

  public leftClick: boolean = false;
  public rightClick: boolean = false;
  public scrollDelta: number = 0;

  public movementX: number = 0;
  public movementY: number = 0;

  public flyToggled: boolean = false;
  public isSprinting: boolean = false;

  private lastWPress: number = 0;
  private lastSpacePress: number = 0;

  constructor(private canvas: HTMLCanvasElement) {
    document.addEventListener("keydown", (e) => {
      if (document.pointerLockElement !== this.canvas) return;

      this.keys[e.code] = true;

      if (e.code === "F3") {
        e.preventDefault();
        this.showDebug = !this.showDebug;
      }
      if (e.code === "KeyP") {
        e.preventDefault();
        this.showEntityRay = !this.showEntityRay;
      }
      if (e.code === "Space" && !e.repeat) {
        const now = performance.now();
        if (now - this.lastSpacePress < 300) {
          this.flyToggled = true;
        }
        this.lastSpacePress = now;
      }
      if (e.code === "KeyW" && !e.repeat) {
        const now = performance.now();
        if (now - this.lastWPress < 300) {
          this.isSprinting = true;
        }
        this.lastWPress = now;
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.code] = false;
      if (e.code === "KeyW") {
        this.isSprinting = false;
      }
    });

    document.addEventListener("mousemove", (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.movementX += e.movementX;
      this.movementY += e.movementY;
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      if (e.button === 0) this.leftClick = true;
      if (e.button === 2) this.rightClick = true;
    });

    this.canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) this.leftClick = false;
      if (e.button === 2) this.rightClick = false;
    });

    window.addEventListener("wheel", (e) => {
      if (document.pointerLockElement !== this.canvas) return;
      this.scrollDelta = Math.sign(e.deltaY);
    });
  }

  public resetFrameSpecificInputs() {
    this.leftClick = false;
    this.rightClick = false;
    this.scrollDelta = 0;

    this.movementX = 0;
    this.movementY = 0;

    this.flyToggled = false;
  }
}
