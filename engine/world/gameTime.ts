import type { Vec3Type } from "../core/math/vec3";

export class GameTime {
  public timeOfDay: number = 0.5; // 0.0 to 1.0
  public timeSpeed: number = 1.0;
  public isPaused: boolean = false;

  public update(dt: number) {
    if (!this.isPaused) {
      this.timeOfDay += (dt * this.timeSpeed) / 120.0;

      if (this.timeOfDay > 1.0) this.timeOfDay -= 1.0;
    }
  }

  public getSunDirection(): Vec3Type {
    const angle = (this.timeOfDay - 0.25) * 2 * Math.PI;

    return [Math.cos(angle), Math.sin(angle), 0.2];
  }

  public getSkyColor(): Vec3Type {
    const sunY = this.getSunDirection()[1];

    const dayFactor = Math.max(0, Math.min(1, sunY + 0.2));

    // Night: Deep Space Blue whatever
    const nr = 0.02,
      ng = 0.02,
      nb = 0.05;

    // Day: Bright Sky Blue
    const dr = 0.4,
      dg = 0.6,
      db = 0.9;

    return [
      nr + (dr - nr) * dayFactor,
      ng + (dg - ng) * dayFactor,
      nb + (db - nb) * dayFactor,
    ];
  }
}
