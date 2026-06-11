import type { BlockData, BlockIdMap, BlockRegistry } from "./types";

export interface RawBlockConfig {
  Top?: string | string[];
  Bottom?: string | string[];
  Side?: string | string[];
  All?: string | string[];
  icon: string;
  transparent?: boolean;
  light?: number;
  lightAttenuation?: number;
  isFluid?: boolean;
  isPlant?: boolean;
}

export interface RawSystemConfig {
  highlightLayer: string;
}

export interface RawAssetsJSON {
  blocks: Record<string, RawBlockConfig>;
  system: RawSystemConfig;
}

export interface CompiledAssets {
  textureList: string[];
  blockRegistry: BlockRegistry;
  blockIds: BlockIdMap;
}

export function compileRegistry(rawConfig: RawAssetsJSON): CompiledAssets {
  const uniqueTextures: string[] = [];

  function getTextureIndex(pathOrArray: string | string[] | undefined): number {
    if (!pathOrArray) return -1;

    if (Array.isArray(pathOrArray)) {
      let baseIndex = -1;

      for (let i = 0; i < pathOrArray.length; i++) {
        const path = pathOrArray[i];
        let index = uniqueTextures.indexOf(path);

        if (index === -1) {
          uniqueTextures.push(path);
          index = uniqueTextures.length - 1;
        }

        if (i === 0) baseIndex = index;
      }
      return baseIndex;
    } else {
      let index = uniqueTextures.indexOf(pathOrArray);
      if (index === -1) {
        uniqueTextures.push(pathOrArray);
        index = uniqueTextures.length - 1;
      }
      return index;
    }
  }

  if (rawConfig.system && rawConfig.system.highlightLayer) {
    getTextureIndex(rawConfig.system.highlightLayer);
  }

  const compiledBlocks: Record<string, BlockData> = {};
  const blockIds: Record<string, number> = {};
  let nextBlockId = 1;

  for (const [blockName, blockData] of Object.entries(rawConfig.blocks)) {
    blockIds[blockName] = nextBlockId++;

    const { All, Top, Bottom, Side, ...rest } = blockData;

    const blockConfig: BlockData = {
      ...rest,
      id: blockIds[blockName],
      transparent: blockData.transparent ?? false,
      light: blockData.light ?? 0,
      Top: -1,
      Bottom: -1,
      Side: -1,
    };

    if (blockData.All) {
      const index = getTextureIndex(blockData.All);
      blockConfig.Top = index;
      blockConfig.Bottom = index;
      blockConfig.Side = index;
    } else if (blockData.Top && blockData.Bottom && blockData.Side) {
      blockConfig.Top = getTextureIndex(blockData.Top);
      blockConfig.Bottom = getTextureIndex(blockData.Bottom);
      blockConfig.Side = getTextureIndex(blockData.Side);
    }

    compiledBlocks[blockName] = blockConfig;
  }

  return {
    textureList: uniqueTextures,
    blockRegistry: compiledBlocks,
    blockIds: blockIds,
  };
}
