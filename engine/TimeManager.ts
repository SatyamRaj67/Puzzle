export class TimeManager {
  public deltaTime: number = 0;
  public gameTime: number = 0;
  public timeSpeed: number = 0.0001;
  public isTimePaused: boolean = false;
  public fps: number = 0;

  private lastFrameTime: number = performance.now();
  private accumulator: number = 0;
  public readonly TICK_RATE: number = 1000 / 20;

  public update(
    isGamePaused: boolean,
    fixedUpdate: (tickRate: number) => void,
    variableUpdate: (deltaTime: number, timeScale: number) => void,
  ): void {
    const now = performance.now();

    this.deltaTime = Math.min(now - this.lastFrameTime, 250);
    this.lastFrameTime = now;

    this.fps = Math.round(1000 / Math.max(this.deltaTime, 1));

    if (!isGamePaused) {
      this.accumulator += this.deltaTime;

      while (this.accumulator >= this.TICK_RATE) {
        if (!this.isTimePaused) {
          this.gameTime += this.TICK_RATE * this.timeSpeed;
        }
        fixedUpdate(this.TICK_RATE);
        this.accumulator -= this.TICK_RATE;
      }

      const timeScale = (this.deltaTime * 60) / 1000;
      variableUpdate(this.deltaTime, timeScale);
    }
  }
}
