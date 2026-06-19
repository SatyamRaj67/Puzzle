import { BlockData, type BlockDefinition } from "../data/blocks";

export type RenderType = "CUBE" | "CROSS" | "EMPTY" | "CUSTOM";

export interface ParsedBlock {
  id: number;
  name: string;
  renderType: RenderType;
  isFluid: boolean;
  isOpaque: boolean;
  lightAttenuation: number;
  lightEmission: number;
  frames: number;
  speed: number;

  textures: string[];
  textureIds: number[];
  icon: string;
}

export class BlockRegistry {
  private static blocks: ParsedBlock[] = [];
  private static nameToId: Map<string, number> = new Map();

  public static initialize() {
    for (let i = 0; i < BlockData.length; i++) {
      const def = BlockData[i];

      const parsed: ParsedBlock = {
        id: i,
        name: def.name,
        renderType: this.determineRenderType(def),
        isFluid: def.isFluid ?? false,
        isOpaque: def.isOpaque ?? true,
        lightAttenuation: def.lightAttenuation ?? 15, // Default to Opaque
        lightEmission: def.lightEmission ?? 0, // Default to No Light Emission
        frames: def.frames ?? 1, // Default to Static
        speed: def.speed ?? 0,
        textures: this.normalizeTextures(def),
        textureIds: [],
        icon: def.icon ?? def.name.toLowerCase(),
      };

      this.blocks[i] = parsed;
      this.nameToId.set(def.name.toLowerCase(), i);
    }

    console.log(
      `🧱 BlockRegistry Initialized: Loaded ${this.blocks.length} blocks.`,
    );
  }

  public static getBlock(id: number): ParsedBlock {
    return this.blocks[id];
  }

  public static getId(name: string): number {
    return this.nameToId.get(name.toLowerCase()) ?? 0;
  }

  public static getAllBlocks(): ParsedBlock[] {
    return this.blocks;
  }

  private static determineRenderType(def: BlockDefinition): RenderType {
    if (def.name === "Air") return "EMPTY";

    if (typeof def.texture === "object") {
      if ("diagonal1" in def.texture) return "CROSS";
    }
    return "CUBE";
  }

  private static normalizeTextures(def: BlockDefinition): string[] {
    if (def.name === "Air" || !def.texture) return [];

    const tex = def.texture;

    // If it's a cross (plant), return the diagonals
    if (typeof tex === "object" && "diagonal1" in tex) {
      return [tex.diagonal1, tex.diagonal2 ?? tex.diagonal1];
    }

    if (typeof tex === "string") {
      return [tex, tex, tex, tex, tex, tex];
    }

    if ("topNbottom" in tex) {
      return [
        tex.sides,
        tex.sides,
        tex.topNbottom,
        tex.topNbottom,
        tex.sides,
        tex.sides,
      ];
    }

    if ("top" in tex) {
      return [tex.sides, tex.sides, tex.top, tex.bottom, tex.sides, tex.sides];
    }

    return [];
  }

  public static linkTextures(textureMap: Map<string, number>) {
    for (const block of this.blocks) {
      block.textureIds = block.textures.map((url) => textureMap.get(url) ?? 0);
    }
  }

  public static shouldRenderFace(blockId: number, neighborId: number): boolean {
    if (neighborId === 0) return true; // Air always renders faces
    if (blockId === neighborId) return false; // Same block type, no face

    return !this.blocks[neighborId].isOpaque;
  }
}
