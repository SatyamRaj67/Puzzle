export class Input {
  public keys: Set<string> = new Set();

  public doubleTapped: Set<string> = new Set();
  private keyPressTimes: Map<string, number> = new Map();

  public mouseDeltaX: number = 0;
  public mouseDeltaY: number = 0;
  public isPointerLocked: boolean = false;

  public leftClick: boolean = false;
  public rightClick: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) {
        const now = performance.now();
        const lastPress = this.keyPressTimes.get(e.code) || 0;
        if (now - lastPress < 300) {
          this.doubleTapped.add(e.code);
        }
        this.keyPressTimes.set(e.code, now);
      }
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));

    canvas.addEventListener("click", () => {
      if (!this.isPointerLocked) canvas.requestPointerLock();
    });

    document.addEventListener("pointerlockchange", () => {
      this.isPointerLocked = document.pointerLockElement === canvas;
    });

    document.addEventListener("mousemove", (e) => {
      if (this.isPointerLocked) {
        this.mouseDeltaX += e.movementX;
        this.mouseDeltaY += e.movementY;
      }
    });

    canvas.addEventListener("mousedown", (e) => {
      if (!this.isPointerLocked) {
        canvas.requestPointerLock();
        return;
      }
      if (e.button === 0) this.leftClick = true;
      if (e.button === 2) this.rightClick = true;
    });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  public isKeyDown(code: string): boolean {
    return this.keys.has(code);
  }

  public isDoubleTapped(code: string): boolean {
    return this.doubleTapped.has(code);
  }

  public resetPerFrame(): void {
    this.mouseDeltaX = 0;
    this.mouseDeltaY = 0;
    this.doubleTapped.clear();
    this.leftClick = false;
    this.rightClick = false;
  }
}
