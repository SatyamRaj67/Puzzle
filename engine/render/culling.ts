export class Frustrum {
  private planes = new Float32Array(24);

  public updateFromMatrix(m: Float32Array) {
    this.planes[0] = m[3] + m[0];
    this.planes[1] = m[7] + m[4];
    this.planes[2] = m[11] + m[8];
    this.planes[3] = m[15] + m[12];
    this.planes[4] = m[3] - m[0];
    this.planes[5] = m[7] - m[4];
    this.planes[6] = m[11] - m[8];
    this.planes[7] = m[15] - m[12];
    this.planes[8] = m[3] + m[1];
    this.planes[9] = m[7] + m[5];
    this.planes[10] = m[11] + m[9];
    this.planes[11] = m[15] + m[13];
    this.planes[12] = m[3] - m[1];
    this.planes[13] = m[7] - m[5];
    this.planes[14] = m[11] - m[9];
    this.planes[15] = m[15] - m[13];
    this.planes[16] = m[2];
    this.planes[17] = m[6];
    this.planes[18] = m[10];
    this.planes[19] = m[14];
    this.planes[20] = m[3] - m[2];
    this.planes[21] = m[7] - m[6];
    this.planes[22] = m[11] - m[10];
    this.planes[23] = m[15] - m[14];

    for (let i = 0; i < 6; i++) {
      const len = Math.hypot(
        this.planes[i * 4],
        this.planes[i * 4 + 1],
        this.planes[i * 4 + 2],
      );
      this.planes[i * 4] /= len;
      this.planes[i * 4 + 1] /= len;
      this.planes[i * 4 + 2] /= len;
      this.planes[i * 4 + 3] /= len;
    }
  }

  public intersectsBox(
    minX: number,
    minY: number,
    minZ: number,
    maxX: number,
    maxY: number,
    maxZ: number,
  ): boolean {
    for (let i = 0; i < 6; i++) {
      const px = this.planes[i * 4] > 0 ? maxX : minX;
      const py = this.planes[i * 4 + 1] > 0 ? maxY : minY;
      const pz = this.planes[i * 4 + 2] > 0 ? maxZ : minZ;

      if (
        this.planes[i * 4] * px +
          this.planes[i * 4 + 1] * py +
          this.planes[i * 4 + 2] * pz +
          this.planes[i * 4 + 3] <
        -0.1
      ) {
        return false;
      }
    }
    return true;
  }
}
