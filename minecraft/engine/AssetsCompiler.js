export function compileRegistry(rawConfig) {
    const uniqueTextures = [];

    function getTextureIndex(path) {
        if (!path) return -1;
        let index = uniqueTextures.indexOf(path);

        if (index === -1) {
            uniqueTextures.push(path);
            index = uniqueTextures.length - 1;
        }

        return index;
    }

    if (rawConfig.system && rawConfig.system.highlightLayer) {
        getTextureIndex(rawConfig.system.highlightLayer);
    }

    const compiledBlocks = {};
    const blockIds = {}
    let nextBlockId = 1;

    for (const [blockName, blockData] of Object.entries(rawConfig.blocks)) {
        blockIds[blockName] = nextBlockId++;

        const blockConfig = {
            id: blockIds[blockName],
            transparent: blockData.transparent || false,
            light: blockData.light || 0
        }

        if (blockData.All) {
            const index = getTextureIndex(blockData.All);
            blockConfig.Top = index;
            blockConfig.Bottom = index;
            blockConfig.Side = index;
        } else {
            blockConfig.Top = getTextureIndex(blockData.Top);
            blockConfig.Bottom = getTextureIndex(blockData.Bottom);
            blockConfig.Side = getTextureIndex(blockData.Side);
        }

        compiledBlocks[blockName] = blockConfig;
    }

    return {
        textureList: uniqueTextures,
        blockRegistry: compiledBlocks,
        blockIds: blockIds
    }
}