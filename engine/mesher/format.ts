export class Format {
  /**
   * Packs block data into a single 32-bit integer for Greedy Meshing.
   * * Bit Layout:
   * [0-3]   (4 bits): X Position (0-15)
   * [4-10]  (7 bits): Y Position (0-127)
   * [11-14] (4 bits): Z Position (0-15)
   * [15-21] (7 bits): Block ID   (0-127)
   * [22-26] (5 bits): Width      (1-32, stored as 0-31)
   * [27-31] (5 bits): Height     (1-32, stored as 0-31)
   */
  public static packData1(
    x: number,
    y: number,
    z: number,
    id: number,
    width: number,
    height: number,
  ): number {
    const w = (width - 1) & 0x1f;
    const h = (height - 1) & 0x1f;

    return (
      ((x & 0xf) |
        ((y & 0x7f) << 4) |
        ((z & 0xf) << 11) |
        ((id & 0x7f) << 15) |
        (w << 22) |
        (h << 27)) >>>
      0
    );
  }

  /** Lighting and AO
   * *Bit Layout
   * [0-7] Ambient Occlusion,
   * [8-19] Chunk X (12-bit signed),
   * [20-31] Chunk Z (12-bit signed)
   */
  public static packData2(
    packedAO: number,
    chunkX: number,
    chunkZ: number,
  ): number {
    const cx = chunkX & 0xfff;
    const cz = chunkZ & 0xfff;

    return (packedAO & 0xff) | (cx << 8) | (cz << 20);
  }

  /** Sunlight and Block Light
   * *Bit Layout
   * [0-7] SunLight & BlockLight,
   * [8-31] Reserved
   */
  public static packData3(light: number): number {
    return light & 0xff;
  }
}
