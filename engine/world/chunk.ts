export class Chunk {
  public static readonly WIDTH = 16;
  public static readonly HEIGHT = 128;
  public static readonly DEPTH = 16;

  public data = new Uint8Array(Chunk.WIDTH * Chunk.HEIGHT * Chunk.DEPTH);
  public light = new Uint8Array(Chunk.WIDTH * Chunk.HEIGHT * Chunk.DEPTH);

  public getIndex(x: number, y: number, z: number): number {
    return x + z * Chunk.WIDTH + y * Chunk.WIDTH * Chunk.DEPTH;
  }

  public getBlock(x: number, y: number, z: number): number {
    if (
      x < 0 ||
      x >= Chunk.WIDTH ||
      y < 0 ||
      y >= Chunk.HEIGHT ||
      z < 0 ||
      z >= Chunk.DEPTH
    ) {
      return 0; // Outside Bounds
    }
    return this.data[this.getIndex(x, y, z)];
  }

  public setBlock(x: number, y: number, z: number, blockId: number): void {
    if (
      x < 0 ||
      x >= Chunk.WIDTH ||
      y < 0 ||
      y >= Chunk.HEIGHT ||
      z < 0 ||
      z >= Chunk.DEPTH
    ) {
      return; // Outside Bounds
    }
    this.data[this.getIndex(x, y, z)] = blockId;
  }

  public generateFlatTerrain() {
    for (let x = 0; x < Chunk.WIDTH; x++) {
      for (let z = 0; z < Chunk.DEPTH; z++) {
        for (let y = 0; y < Chunk.HEIGHT; y++) {
          if (y < 4) {
            this.setBlock(x, y, z, 1); // 1 = Solid Block
          } else {
            this.setBlock(x, y, z, 0); // 0 = Air
          }
        }
      }
    }
  }

  public getLight(x: number, y: number, z: number): number {
    if (
      x < 0 ||
      x >= Chunk.WIDTH ||
      y < 0 ||
      y >= Chunk.HEIGHT ||
      z < 0 ||
      z >= Chunk.DEPTH
    )
      return 15 << 4;
    return this.light[this.getIndex(x, y, z)];
  }

  public setLight(x: number, y: number, z: number, lightVal: number): void {
    if (
      x < 0 ||
      x >= Chunk.WIDTH ||
      y < 0 ||
      y >= Chunk.HEIGHT ||
      z < 0 ||
      z >= Chunk.DEPTH
    )
      return;
    this.light[this.getIndex(x, y, z)] = lightVal;
  }
}
