struct GlobalUniform {
    viewProj: mat4x4<f32>,
    sunDir: vec3<f32>,
    timeOfDay: f32,
    time: f32,
    cameraPosX: f32,
    cameraPosY: f32,
    cameraPosZ: f32,
    heldLight: f32,
}

struct ChunkData {
    minPos: vec4<f32>, //x, y, z, padding
    maxPos: vec4<f32>, //x, y, z, padding
    vertexCount: u32,
    firstVertex: u32,
    pad1: u32,
    pad2: u32,
}

struct IndirectCommand {
    vertexCount: u32,
    instanceCount: u32,
    firstVertex: u32,
    firstInstance: u32,
}

struct IndirectBuffer {
    commands: array<IndirectCommand>,
}

struct Counter {
    count: atomic<u32>,
}

@group(0) @binding(0) var<uniform> globals: GlobalUniform;
@group(0) @binding(1) var<storage, read> chunks: array<ChunkData>;
@group(0) @binding(2) var<storage, read_write> draw_cmds: IndirectBuffer;
@group(0) @binding(3) var<storage, read_write> counter: Counter;

fn extractPlanes() -> array<vec4<f32>, 6> {
    let m = globals.viewProj;
    return array<vec4<f32>, 6>(
        vec4<f32>(m[0][3] + m[0][0], m[1][3] + m[1][0], m[2][3] + m[2][0], m[3][3] + m[3][0]), // Left
        vec4<f32>(m[0][3] - m[0][0], m[1][3] - m[1][0], m[2][3] - m[2][0], m[3][3] - m[3][0]), // Right
        vec4<f32>(m[0][3] + m[0][1], m[1][3] + m[1][1], m[2][3] + m[2][1], m[3][3] + m[3][1]), // Bottom
        vec4<f32>(m[0][3] - m[0][1], m[1][3] - m[1][1], m[2][3] - m[2][1], m[3][3] - m[3][1]), // Top
        vec4<f32>(m[0][3] + m[0][2], m[1][3] + m[1][2], m[2][3] + m[2][2], m[3][3] + m[3][2]), // Near
        vec4<f32>(m[0][3] - m[0][2], m[1][3] - m[1][2], m[2][3] - m[2][2], m[3][3] - m[3][2])  // Far
    );
}

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3<u32>){
    let idx = id.x;

    if (idx >= arrayLength(&chunks)) {
        return;
    }

    let chunk = chunks[idx];
    if (chunk.vertexCount == 0u) {
        return;
    }

    let planes = extractPlanes();
    var isVisible = true;

    for (var i = 0u; i < 6u; i = i + 1u) {
        let p = planes[i];

        var px = chunk.minPos.x; if (p.x > 0.0) { px = chunk.maxPos.x; }
        var py = chunk.minPos.y; if (p.y > 0.0) { py = chunk.maxPos.y; }
        var pz = chunk.minPos.z; if (p.z > 0.0) { pz = chunk.maxPos.z; }

        if (dot(p.xyz, vec3<f32>(px, py, pz)) + p.w < 0.0) {
            isVisible = false;
            break;
        }
    }

    if (isVisible) {
        let cmd_idx = atomicAdd(&counter.count, 1u);

        draw_cmds.commands[cmd_idx].vertexCount = chunk.vertexCount;
        draw_cmds.commands[cmd_idx].instanceCount = 1u;
        draw_cmds.commands[cmd_idx].firstVertex = chunk.firstVertex;
        draw_cmds.commands[cmd_idx].firstInstance = 0u;
    }
}