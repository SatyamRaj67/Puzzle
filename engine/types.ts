export interface BlockData {
  id: number;
  transparent: boolean;
  light: number;
  lightAttenuation?: number;
  isFluid?: boolean;
  isPlant?: boolean;
  Top?: number;
  Bottom?: number;
  Side?: number;
  All?: number;
}

export interface BlockRegistry {
  [key: string]: BlockData;
}

export interface BlockIdMap {
  [key: string]: number;
}

export interface IMeshHandle {
  id: number;
}

export interface MeshData {
  packedData: number[] | Uint32Array;
  indices: number[] | Uint32Array;
}

export interface RenderPassItem {
  mesh: IMeshHandle;
  model: Float32Array;
  distance: number;
}

export interface IRenderer {
  createMesh(vertexData: Uint32Array, indexData: Uint32Array): IMeshHandle;

  updateMesh(
    mesh: IMeshHandle,
    vertexData: Uint32Array,
    indexData: Uint32Array,
  ): void;

  deleteMesh(mesh: IMeshHandle): void;

  beginFrame(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    skyColor: number[],
  ): void;

  endFrame(): void;

  drawWorld(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    solidPass: RenderPassItem[],
    transPass: RenderPassItem[],
    sunDir: [number, number, number],
    playerPos: [number, number, number],
    holdingTorch: number,
    timeVal: number,
    isSubmerged: boolean,
  ): void;

  createTextureArrayFromImage(
    images: HTMLImageElement[],
    textureSize: number,
  ): void;

  setupSkybox(): void;

  drawSkybox(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    sunDirection: [number, number, number],
  ): void;

  createEntityMesh(
    vertexData: Float32Array,
    indexData: Uint16Array,
  ): IMeshHandle;

  drawEntity(
    mesh: IMeshHandle,
    modelMatrix: Float32Array,
    sunDir: number[],
    textureLayer: number,
    isMoving: number,
    damageFlash: number,
  ): void;

  drawHighlight(
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
    hitX: number,
    hitY: number,
    hitZ: number,
    normal: [number, number, number],
    layerId: number,
  ): void;

  drawLine(
    startX: number,
    startY: number,
    startZ: number,
    endX: number,
    endY: number,
    endZ: number,
    r: number,
    g: number,
    b: number,
    projMatrix: Float32Array,
    viewMatrix: Float32Array,
  ): void;
}
