export type TextureConfig =
  | string
  | { topNbottom: string; sides: string }
  | { top: string; bottom: string; sides: string }
  | { diagonal1: string; diagonal2?: string };

export interface BlockDefinition {
  name: string;
  texture: TextureConfig;
  icon?: string;
  frames?: number;
  speed?: number;
  isFluid?: boolean;
  lightAttenuation?: number; // 0 = fully transparent, 15 = fully opaque
  lightEmission?: number; // 0 = no light, 15 = maximum light
  isOpaque?: boolean;           // Does the texture have holes? (e.g. leaves)
}

export const BlockData: BlockDefinition[] = [
  {
    name: "Air",
    texture: "", 
    lightAttenuation: 0,
    isOpaque: false,
  },
  {
    name: "dirt",
    texture: "/Puzzle/textures/model/dirt.png",
    icon: "/Puzzle/textures/icon/dirt.png",
  },
  {
    name: "grass_block",
    texture: {
      top: "/Puzzle/textures/model/grass_block_top.png",
      bottom: "/Puzzle/textures/model/dirt.png",
      sides: "/Puzzle/textures/model/grass_block_side.png",
    },
    icon: "/Puzzle/textures/icon/grass_block.png",
  },
  {
    name: "stone",
    texture: "/Puzzle/textures/model/stone.png",
    icon: "/Puzzle/textures/icon/stone.png",
  },
  {
    name: "water",
    texture: "/Puzzle/textures/model/water_still.png",
    frames: 32,
    speed: 16,
    isFluid: true,
    lightAttenuation: 2, 
    isOpaque: false,
  },
  {
    name: "glowstone",
    texture: "/Puzzle/textures/model/glowstone.png",
    icon: "/Puzzle/textures/icon/glowstone.png",
    lightAttenuation: 0, 
    lightEmission: 15,
  },
  {
    name: "oak_log",
    texture: {
      topNbottom: "/Puzzle/textures/model/oak_log_top.png",
      sides: "/Puzzle/textures/model/oak_log.png",
    },
    icon: "/Puzzle/textures/icon/oak_log.png",
  },
  {
    name: "oak_leaves",
    texture: "/Puzzle/textures/model/oak_leaves.png",
    icon: "/Puzzle/textures/icon/oak_leaves.png",
    lightAttenuation: 4, 
    isOpaque: false,
  },
  {
    name: "grass",
    texture: {
      diagonal1: "/Puzzle/textures/model/grass.png",
    },
    lightAttenuation: 1,
    isOpaque: false
  },
];
