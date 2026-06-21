export interface StructureBlock{
    dx: number;
    dy: number;
    dz: number;
    blockId: number;
}

export interface Structure {
    blocks: StructureBlock[]
}