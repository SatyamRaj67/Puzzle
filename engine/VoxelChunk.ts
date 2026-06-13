import { type BlockIdMap, type BlockRegistry } from "./types";
import { ChunkManager } from "./ChunkManager";
import { PerlinNoise } from "./Noise";

export class VoxelChunk {
  public width: number;
  public height: number;
  public data: Uint16Array;
  public blockRegistry!: BlockRegistry;

  constructor(
    width: number = 16,
    height: number = 128,
    existingBuffer: ArrayBuffer | null = null,
  ) {
    this.width = width;
    this.height = height;

    if (existingBuffer) {
      this.data = new Uint16Array(existingBuffer);
    } else {
      this.data = new Uint16Array(width * height * width);
    }
  }

  public reset(): void {
    this.data.fill(0);
  }

  private getIndex(x: number, y: number, z: number): number {
    return x + y * this.width + z * this.width * this.height;
  }

  public setBlock(x: number, y: number, z: number, blockId: number): void {
    // Check if the coordinates are within bounds
    if (
      x < 0 ||
      x >= this.width ||
      y < 0 ||
      y >= this.height ||
      z < 0 ||
      z >= this.width
    ) {
      throw new Error("Block coordinates out of bounds");
    }

    const index = this.getIndex(x, y, z);
    this.data[index] = (this.data[index] & 0xff00) | blockId;
  }

  getBlock(x: number, y: number, z: number): number {
    // Check if the coordinates are within bounds
    if (
      x < 0 ||
      x >= this.width ||
      y < 0 ||
      y >= this.height ||
      z < 0 ||
      z >= this.width
    ) {
      return 0; // Return 0 for out-of-bounds blocks (air)
    }

    const index = this.getIndex(x, y, z);
    return this.data[index] & 0x00ff;
  }

  public setLight(x: number, y: number, z: number, lightValue: number): void {
    if (
      x < 0 ||
      x >= this.width ||
      y < 0 ||
      y >= this.height ||
      z < 0 ||
      z >= this.width
    ) {
      throw new Error("Block coordinates out of bounds");
    }

    const index = this.getIndex(x, y, z);
    this.data[index] = (this.data[index] & 0xf0ff) | (lightValue << 8);
  }

  public getLight(x: number, y: number, z: number): number {
    if (
      x < 0 ||
      x >= this.width ||
      y < 0 ||
      y >= this.height ||
      z < 0 ||
      z >= this.width
    ) {
      return 0; // Return 0 for out-of-bounds blocks (no light)
    }

    const index = this.getIndex(x, y, z);
    return (this.data[index] >> 8) & 0x000f;
  }

  public setSkyLight(
    x: number,
    y: number,
    z: number,
    lightValue: number,
  ): void {
    if (
      x < 0 ||
      x >= this.width ||
      y < 0 ||
      y >= this.height ||
      z < 0 ||
      z >= this.width
    ) {
      throw new Error("Block coordinates out of bounds");
    }

    const index = this.getIndex(x, y, z);
    this.data[index] = (this.data[index] & 0x0fff) | (lightValue << 12);
  }

  public getSkyLight(x: number, y: number, z: number): number {
    if (
      x < 0 ||
      x >= this.width ||
      y < 0 ||
      y >= this.height ||
      z < 0 ||
      z >= this.width
    ) {
      return 0; // Return 0 for out-of-bounds blocks (no skylight)
    }

    const index = this.getIndex(x, y, z);
    return (this.data[index] >> 12) & 0x000f;
  }

  public generateFlatTerrain(groundHeight: number): void {
    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.width; z++) {
        for (let y = 0; y < this.height; y++) {
          this.setBlock(x, y, z, 0); // AIR

          if (y < groundHeight) {
            this.setBlock(x, y, z, 3); // DIRT
          }

          if (y === groundHeight) {
            this.setBlock(x, y, z, 1); // GRASS
          }
        }
      }
    }
  }

  // ==========================================
  // THE GREEDY MESHER
  // ==========================================

  buildMesh(
    manager: ChunkManager | null,
    cx: number,
    cz: number,
    lodStep: number = 1,
  ) {
    const solidData: number[] = [],
      solidIndices: number[] = [];
    const transData: number[] = [],
      transIndices: number[] = [];

    let solidVertexCount = 0;
    let transVertexCount = 0;

    const getSafeBlock = (x: number, y: number, z: number): number => {
      if (
        x >= 0 &&
        x < this.width &&
        y >= 0 &&
        y < this.height &&
        z >= 0 &&
        z < this.width
      ) {
        return this.getBlock(x, y, z);
      }

      if (manager) {
        const globalX = x + cx * this.width;
        const globalZ = z + cz * this.width;

        return manager.getBlock(globalX, y, globalZ);
      }

      return 0; // Default to AIR for out-of-bounds
    };

    const getSafeLight = (x: number, y: number, z: number): number => {
      if (
        x >= 0 &&
        x < this.width &&
        y >= 0 &&
        y < this.height &&
        z >= 0 &&
        z < this.width
      ) {
        return this.getLight(x, y, z);
      }

      if (manager) {
        const globalX = x + cx * this.width;
        const globalZ = z + cz * this.width;

        return manager.getLight(globalX, y, globalZ);
      }
      return 0; // Default to no light for out-of-bounds
    };

    const getSafeSkyLight = (x: number, y: number, z: number): number => {
      if (
        x >= 0 &&
        x < this.width &&
        y >= 0 &&
        y < this.height &&
        z >= 0 &&
        z < this.width
      ) {
        return this.getSkyLight(x, y, z);
      }

      if (manager) {
        const globalX = x + cx * this.width;
        const globalZ = z + cz * this.width;

        return manager.getSkyLight(globalX, y, globalZ);
      }
      return 15;
    };

    const isSolid = (x: number, y: number, z: number): boolean => {
      const blockId = getSafeBlock(x, y, z);
      if (blockId === 0) return false; // AIR is not solid

      const data = this.blockRegistry[blockId.toString()];

      return !(data && data.transparent); // Solid if not transparent
    };

    const vertexAO = (
      side1: boolean,
      side2: boolean,
      corner: boolean,
    ): number => {
      if (side1 && side2) return 0;
      return 3 - (side1 ? 1 : 0) - (side2 ? 1 : 0) - (corner ? 1 : 0);
    };

    const axes = [
      { name: "Y", sliceDir: [0, 1, 0], widthAxis: "X", heightAxis: "Z" },
      { name: "X", sliceDir: [1, 0, 0], widthAxis: "Z", heightAxis: "Y" },
      { name: "Z", sliceDir: [0, 0, 1], widthAxis: "X", heightAxis: "Y" },
    ];

    // For every axis (X, Y, Z), we check the positive and negative direction to find faces
    for (const axis of axes) {
      for (const dirMultiplier of [1, -1]) {
        let faceName = "Side";
        if (axis.name === "Y") {
          faceName = dirMultiplier === 1 ? "Top" : "Bottom";
        }

        const wLimit = Math.floor(this.width / lodStep);
        const hLimit =
          Math.floor(axis.name === "Y" ? this.width : this.height) / lodStep;

        for (
          let slice = 0;
          slice < (axis.name === "Y" ? this.height : this.width);
          slice++
        ) {
          const mask = new Int32Array(wLimit * hLimit);

          // --- PHASE 1: BUILD THE MASK ---
          // We scan the entire 2D slice to find visible block faces
          for (let w = 0; w < wLimit; w++) {
            for (let h = 0; h < hLimit; h++) {
              // Map 2D (w, h) coordinates back to 3D (x, y, z)
              let x =
                axis.name === "X"
                  ? slice * lodStep
                  : axis.widthAxis === "X"
                    ? w * lodStep
                    : h * lodStep;
              let y =
                axis.name === "Y"
                  ? slice * lodStep
                  : axis.widthAxis === "Y"
                    ? w * lodStep
                    : h * lodStep;
              let z =
                axis.name === "Z"
                  ? slice * lodStep
                  : axis.widthAxis === "Z"
                    ? w * lodStep
                    : h * lodStep;

              const currentBlock = this.getBlock(x, y, z);
              if (currentBlock == 0) continue; // Skip air blocks

              const currentData = this.blockRegistry[currentBlock];
              if (currentData && currentData.isPlant) continue;

              const neighborX =
                x + (axis.name === "X" ? dirMultiplier * lodStep : 0);
              const neighborY =
                y + (axis.name === "Y" ? dirMultiplier * lodStep : 0);
              const neighborZ =
                z + (axis.name === "Z" ? dirMultiplier * lodStep : 0);

              const neighborBlock = getSafeBlock(
                neighborX,
                neighborY,
                neighborZ,
              );

              let drawFace = false;

              if (neighborBlock === 0) {
                drawFace = true; // Face is visible if neighbor is air
              } else if (neighborBlock !== currentBlock) {
                const neighborData = this.blockRegistry[neighborBlock];

                if (neighborData && neighborData.transparent) {
                  drawFace = true; // Face is visible if neighbor is a different transparent block
                }
              }

              if (drawFace) {
                const neighborLight = getSafeLight(
                  neighborX,
                  neighborY,
                  neighborZ,
                );
                const neighborSkyLight = getSafeSkyLight(
                  neighborX,
                  neighborY,
                  neighborZ,
                );

                // Pack block ID (8), light(4), and skylight (4) into a single integer for the mask
                mask[w + h * wLimit] =
                  currentBlock |
                  (neighborLight << 8) |
                  (neighborSkyLight << 12);
              }
            }
          }

          // --- PHASE 2: GREEDY SCAN THE MASK ---
          // Group identical blocks into huge quads

          for (let h = 0; h < hLimit; h++) {
            for (let w = 0; w < wLimit; w++) {
              const maskVal = mask[w + h * wLimit];

              if (maskVal === 0) continue; // Skip empty cells

              const blockId = maskVal & 0x00ff;
              const blockData = this.blockRegistry[blockId.toString()];
              const isFluid = blockData && blockData.isFluid;

              let width = 1;
              let height = 1;

              let x =
                axis.name === "X"
                  ? slice * lodStep
                  : axis.widthAxis === "X"
                    ? w * lodStep
                    : h * lodStep;
              let y =
                axis.name === "Y"
                  ? slice * lodStep
                  : axis.widthAxis === "Y"
                    ? w * lodStep
                    : h * lodStep;
              let z =
                axis.name === "Z"
                  ? slice * lodStep
                  : axis.widthAxis === "Z"
                    ? w * lodStep
                    : h * lodStep;

              const dx = axis.name === "X" ? dirMultiplier * lodStep : 0;
              const dy = axis.name === "Y" ? dirMultiplier * lodStep : 0;
              const dz = axis.name === "Z" ? dirMultiplier * lodStep : 0;

              const uDir =
                axis.name === "X" ? [0, 0, lodStep] : [lodStep, 0, 0];
              const vDir =
                axis.name === "Y" ? [0, 0, lodStep] : [0, lodStep, 0];

              const s00 = isSolid(
                x + dx - uDir[0] - vDir[0],
                y + dy - uDir[1] - vDir[1],
                z + dz - uDir[2] - vDir[2],
              );
              const s10 = isSolid(
                x + dx - vDir[0],
                y + dy - vDir[1],
                z + dz - vDir[2],
              );
              const s20 = isSolid(
                x + dx + uDir[0] - vDir[0],
                y + dy + uDir[1] - vDir[1],
                z + dz + uDir[2] - vDir[2],
              );
              const s01 = isSolid(
                x + dx - uDir[0],
                y + dy - uDir[1],
                z + dz - uDir[2],
              );
              const s21 = isSolid(
                x + dx + uDir[0],
                y + dy + uDir[1],
                z + dz + uDir[2],
              );
              const s02 = isSolid(
                x + dx - uDir[0] + vDir[0],
                y + dy - uDir[1] + vDir[1],
                z + dz - uDir[2] + vDir[2],
              );
              const s12 = isSolid(
                x + dx + vDir[0],
                y + dy + vDir[1],
                z + dz + vDir[2],
              );
              const s22 = isSolid(
                x + dx + uDir[0] + vDir[0],
                y + dy + uDir[1] + vDir[1],
                z + dz + uDir[2] + vDir[2],
              );

              const ao00 = vertexAO(s01, s10, s00); // Bottom Left
              const ao20 = vertexAO(s21, s10, s20); // Bottom Right
              const ao22 = vertexAO(s21, s12, s22); // Top Right
              const ao02 = vertexAO(s01, s12, s02); // Top Left

              let aoValues = [ao00, ao20, ao22, ao02];

              if (axis.name === "X" || axis.name === "Y") {
                aoValues =
                  dirMultiplier === 1
                    ? [ao00, ao20, ao22, ao02]
                    : [ao20, ao00, ao02, ao22];
              }

              if (isFluid) {
                this.generateOptimizedQuad(
                  axis,
                  dirMultiplier,
                  slice,
                  w,
                  h,
                  width,
                  height,
                  maskVal,
                  faceName,
                  transData,
                  transIndices,
                  transVertexCount,
                  aoValues,
                  lodStep,
                );
                transVertexCount += 4;
              } else {
                this.generateOptimizedQuad(
                  axis,
                  dirMultiplier,
                  slice,
                  w,
                  h,
                  width,
                  height,
                  maskVal,
                  faceName,
                  solidData,
                  solidIndices,
                  solidVertexCount,
                  aoValues,
                  lodStep,
                );
                solidVertexCount += 4;
              }

              mask[w + h * wLimit] = 0; // Mark as processed
            }
          }
        }
      }
    }

    for (let px = 0; px < this.width; px++) {
      for (let py = 0; py < this.height; py++) {
        for (let pz = 0; pz < this.width; pz++) {
          const blockId = this.getBlock(px, py, pz);
          if (blockId === 0) continue;

          const bData = this.blockRegistry[blockId.toString()];
          if (bData && bData.isPlant) {
            solidVertexCount = this.packPlantCross(
              px,
              py,
              pz,
              bData,
              solidData,
              solidIndices,
              solidVertexCount,
              cx,
              cz,
              manager,
            );
          }
        }
      }
    }

    return {
      solid: {
        packedData: solidData,
        indices: solidIndices,
      },
      trans: {
        packedData: transData,
        indices: transIndices,
      },
    };
  }

  //  --- PHASE 3: GENERATE THE GEOMETRY ---
  public generateOptimizedQuad(
    axis: { name: string; widthAxis: string },
    dir: number,
    slice: number,
    w: number,
    h: number,
    width: number,
    height: number,
    maskVal: number,
    faceName: string,
    packedData: number[],
    indices: number[],
    vertexCount: number,
    aoValues: number[] = [3, 3, 3, 3],
    lodStep: number = 1,
  ): void {
    const xOffset = axis.name === "X" ? (dir === 1 ? lodStep : 0) : 0;
    const yOffset = axis.name === "Y" ? (dir === 1 ? lodStep : 0) : 0;
    const zOffset = axis.name === "Z" ? (dir === 1 ? lodStep : 0) : 0;

    const physicalW = w * lodStep;
    const physicalH = h * lodStep;
    const physicalWidth = width * lodStep;
    const physicalHeight = height * lodStep;
    const physicalSlice = slice * lodStep;

    let texLayer = 0;

    const blockId = maskVal & 0x00ff;
    const lightValue = (maskVal >> 8) & 0x000f;
    const skyLightValue = (maskVal >> 12) & 0x000f;

    const blockData = this.blockRegistry[blockId.toString()];

    if (blockData) {
      const key = faceName as keyof typeof blockData;
      if (blockData[key] !== undefined) {
        texLayer = blockData[key] as number;
      } else if (blockData["All"] !== undefined) {
        texLayer = blockData["All"] as number;
      }
    }

    const corners = [
      [physicalW, physicalH],
      [physicalW + physicalWidth, physicalH],
      [physicalW + physicalWidth, physicalH + physicalHeight],
      [physicalW, physicalH + physicalHeight],
    ];
    const uvCoords = [
      [0, 0],
      [physicalWidth, 0],
      [physicalWidth, physicalHeight],
      [0, physicalHeight],
    ];

    for (let i = 0; i < 4; i++) {
      let cx = corners[i][0],
        cy = corners[i][1];

      let finalX =
        axis.name === "X"
          ? physicalSlice + xOffset
          : axis.widthAxis === "X"
            ? cx
            : cy;
      let finalY =
        axis.name === "Y"
          ? physicalSlice + yOffset
          : axis.widthAxis === "Y"
            ? cx
            : cy;
      let finalZ =
        axis.name === "Z"
          ? physicalSlice + zOffset
          : axis.widthAxis === "Z"
            ? cx
            : cy;

      // BITWISE PACKING

      const data1 =
        (finalX & 31) | // 5 bits for X (0-31)
        ((finalY & 255) << 5) | // 8 bits for Y (0-255)
        ((finalZ & 31) << 13) | // 5 bits for Z (0-31)
        ((uvCoords[i][0] & 31) << 18) | // 5 bits for U (0-31)
        ((uvCoords[i][1] & 255) << 23); // 8 bits for V (0-255)

      const cornerAO = aoValues[i] & 3; // 2 bits for AO (0-3)

      const data2 =
        (texLayer & 255) | // 8 bits for texture layer (0-255)
        ((lightValue & 15) << 8) | // 4 bits for light level (0-15)
        ((skyLightValue & 15) << 12) | // 4 bits for skylight level (0-15)
        (cornerAO << 16); // 2 bits for AO (0-3)

      packedData.push(data1, data2);
    }

    let flip = dir !== 1; // Flip the triangle order for back faces
    if (axis.name === "X" || axis.name === "Y") {
      flip = !flip; // Flip the winding order for X and Y faces to maintain correct normals
    }

    if (flip) {
      indices.push(
        vertexCount,
        vertexCount + 3,
        vertexCount + 2,
        vertexCount + 2,
        vertexCount + 1,
        vertexCount,
      );
    } else {
      indices.push(
        vertexCount,
        vertexCount + 1,
        vertexCount + 2,
        vertexCount + 2,
        vertexCount + 3,
        vertexCount,
      );
    }
  }

  public generateProceduralTerrain(
    noise: PerlinNoise,
    offsetX = 0,
    offsetZ = 0,
    BLOCKS: BlockIdMap,
  ) {
    // FBM (Fractal Brownian Motion) parameters
    const octaves = 5; // How many layers of noise to combine
    const persistence = 0.5; // How much the amplitude decreases each layer
    const lacunarity = 2.0; // How much the frequency increases each layer

    const scale = 0.008; // Base Zoom Level

    const baseHeight = 10; // Minimum terrain height
    const maxAmplitude = 100; // Maximum terrain height

    for (let x = 0; x < this.width; x++) {
      for (let z = 0; z < this.width; z++) {
        let amplitude = 1;
        let frequency = 1;
        let noiseHeight = 0;
        let maxValue = 0;

        for (let octave = 0; octave < octaves; octave++) {
          const worldX = (x + offsetX) * scale * frequency;
          const worldZ = (z + offsetZ) * scale * frequency;

          const rawNoise = noise.get(worldX, worldZ);

          noiseHeight += rawNoise * amplitude;
          maxValue += amplitude;

          amplitude *= persistence;
          frequency *= lacunarity;
        }

        // Normalize the layered noise to 0.0 - 1.0 range
        const normalizedNoise = noiseHeight / maxValue;

        const sharpNoise = Math.pow(normalizedNoise, 1.5); // Exaggerate peaks and flatten valleys

        const terrainHeight = Math.floor(
          baseHeight + sharpNoise * maxAmplitude,
        );

        for (let y = 0; y < this.height; y++) {
          this.setBlock(x, y, z, BLOCKS.AIR); // AIR

          if (y < terrainHeight - 4) {
            this.setBlock(x, y, z, BLOCKS.STONE); // STONE
          } else if (y < terrainHeight - 1) {
            this.setBlock(x, y, z, BLOCKS.DIRT); // DIRT
          } else if (y < terrainHeight) {
            this.setBlock(x, y, z, BLOCKS.GRASS_BLOCK); // GRASS
          }
        }
      }
    }
  }

  packPlantCross(
    x: number,
    y: number,
    z: number,
    blockData: { All?: number; Side?: number },
    packedData: number[],
    indices: number[],
    vertexCount: number,
    cx: number,
    cz: number,
    manager: ChunkManager | null,
  ) {
    let light = this.getLight(x, y, z);
    let skyLight = this.getSkyLight(x, y, z);

    if (
      manager &&
      (x === 0 || x === this.width - 1 || z === 0 || z === this.width - 1)
    ) {
      light = manager.getLight(x + cx * this.width, y, z + cz * this.width);
      skyLight = manager.getSkyLight(
        x + cx * this.width,
        y,
        z + cz * this.width,
      );
    }

    const texLayer = blockData.Side ?? blockData.All ?? 0;
    const uvCoords = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];

    const diagonals = [
      {
        dx1: 0,
        dz1: 0,
        dx2: 1,
        dz2: 1,
      },
      {
        dx1: 1,
        dz1: 0,
        dx2: 0,
        dz2: 1,
      },
    ];

    for (const diag of diagonals) {
      const corners = [
        [x + diag.dx1, y, z + diag.dz1],
        [x + diag.dx2, y, z + diag.dz2],
        [x + diag.dx2, y + 1, z + diag.dz2],
        [x + diag.dx1, y + 1, z + diag.dz1],
      ];

      for (let i = 0; i < 4; i++) {
        const data1 =
          (corners[i][0] & 31) | // 5 bits for X (0-31)
          ((corners[i][1] & 255) << 5) | // 8 bits for Y (0-255)
          ((corners[i][2] & 31) << 13) | // 5 bits for Z (0-31)
          ((uvCoords[i][0] & 31) << 18) | // 5 bits for U (0-31)
          ((uvCoords[i][1] & 255) << 23); // 8 bits for V (0-255)

        const data2 =
          (texLayer & 255) | // 8 bits for texture layer (0-255)
          ((light & 15) << 8) | // 4 bits for light level (0-15)
          ((skyLight & 15) << 12) | // 4 bits for skylight level (0-15)
          (3 << 16); // 2 bits for AO (0-3) - Plants are fully lit

        packedData.push(data1, data2);
      }

      indices.push(
        vertexCount,
        vertexCount + 1,
        vertexCount + 2,
        vertexCount + 2,
        vertexCount + 3,
        vertexCount,
        vertexCount,
        vertexCount + 3,
        vertexCount + 2,
        vertexCount + 2,
        vertexCount + 1,
        vertexCount,
      );

      vertexCount += 4;
    }

    return vertexCount;
  }
}
