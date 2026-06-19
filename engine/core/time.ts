export class Time {
  public deltaTime: number = 0;
  public elapsedTime: number = 0;

  private lastTime: number = 0;
  private accumulator: number = 0;

  public readonly fixedDeltaTime: number = 1 / 60;  // 60 FPS

  private updateFn: (dt: number) => void;
  private renderFn: (alpha: number) => void;
  private animationFrameId: number = 0;

  constructor(
    updateFn: (dt: number) => void,
    renderFn: (alpha: number) => void,
  ) {
    this.updateFn = updateFn;
    this.renderFn = renderFn;
  }

  public start() {
    this.lastTime = performance.now() / 1000; // Convert to seconds
    this.loop(performance.now());
  }

  public stop() {
    cancelAnimationFrame(this.animationFrameId);
  }

  private loop = (currentTimeMs: number) => {
    const currentTime = currentTimeMs / 1000; // Convert to seconds

    this.deltaTime = Math.min(currentTime - this.lastTime, 0.25); // Cap deltaTime to avoid spiral of death
    this.lastTime = currentTime;

    this.elapsedTime += this.deltaTime;
    this.accumulator += this.deltaTime;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.updateFn(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }

    const alpha = this.accumulator / this.fixedDeltaTime;
    this.renderFn(alpha);

    this.animationFrameId = requestAnimationFrame(this.loop);
  };
}
