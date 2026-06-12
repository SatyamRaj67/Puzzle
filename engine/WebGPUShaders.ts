export const terrainWGSL = /* wgsl */ `
// === GLOBAL UNIFORMS (Group 0) ===
struct GlobalUniforms {
    projection: mat4x4<f32>,
    view: mat4x4<f32>,
    sunDirection: vec3<f32>,
    time: f32,
    playerPos: vec3<f32>,
    holdingTorch: f32,
    isSubmerged: f32,
    pad1: f32,
    pad2: f32,
    pad3: f32,
};

@group(0) @binding(0) var<uniform> globals: GlobalUniforms;
@group(0) @binding(1) var textureArray: texture_2d_array<f32>;
@group(0) @binding(2) var textureSampler: sampler;

// === LOCAL UNIFORMS (Group 1) ===
@group(1) @binding(0) var<uniform> model: mat4x4<f32>;

struct VertexInput {
    @location(0) data1: u32,
    @location(1) data2: u32,
}

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec3<f32>,
    @location(1) worldPos: vec3<f32>,
    @location(2) light: f32,
    @location(3) skyLight: f32,
    @location(4) ao: f32,
}

@vertex 
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let x = f32(in.data1 & 31u);
    var y = f32((in.data1 >> 5u) & 255u);
    let z = f32((in.data1 >> 13u) & 31u);
    let u = f32((in.data1 >> 18u) & 31u);
    let v = f32((in.data1 >> 23u) & 255u);

    var layer = f32(in.data2 & 255u);

    let WATER_BASE_LAYER = 10.0;
    let ANIMATION_SPEED = 16.0;

    if (layer == WATER_BASE_LAYER) {
        let currentFrame = floor(globals.time * ANIMATION_SPEED) % 32.0;
        layer += currentFrame;
        y -= 0.15;
    }

    out.light = f32((in.data2 >> 8u) & 15u) / 15.0;
    out.skyLight = f32((in.data2 >> 12u) & 15u) / 15.0;

    let aoRaw = f32((in.data2 >> 16u) & 3u);
    out.ao = 0.4 + (aoRaw * 0.2); 

    let pos = vec3<f32>(x, y, z);
    let worldPosition = model * vec4<f32>(pos, 1.0);

    out.position = globals.projection * globals.view * worldPosition;
    out.worldPos = worldPosition.xyz;
    out.uv = vec3<f32>(u, v, layer);

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
  let texColor = textureSample(textureArray, textureSampler, in.uv.xy, i32(in.uv.z));
    if (texColor.a < 0.1) { discard; }

    let normal = normalize(cross(dpdx(in.worldPos), dpdy(in.worldPos)));
    let sunDir = normalize(globals.sunDirection);
    let dayFactor = clamp((sunDir.y + 0.2) / 0.4, 0.0, 1.0);

   let skyInfluence = max(in.skyLight, 0.2); 
    let ambientSky = skyInfluence * mix(0.3, 0.6, dayFactor);

    let diffuse = max(dot(normal, sunDir), 0.0);
    let sunIntensity = diffuse * dayFactor * in.skyLight * 0.4;

    let distToPlayer = distance(in.worldPos, globals.playerPos);
    let torch = pow(max(0.0, 1.0 - (distToPlayer / 12.0)), 2.0) * globals.holdingTorch;
    let artificialLight = max(in.light, torch);

    let naturalLight = ambientSky + sunIntensity;
    let totalIllumination = max(naturalLight, artificialLight);

    let nightTint = vec3<f32>(0.4, 0.5, 0.8);
    let dayTint = vec3<f32>(1.0, 1.0, 1.0);
    let envTint = mix(nightTint, dayTint, dayFactor);

    let warmLightTint = vec3<f32>(1.0, 0.9, 0.8);
    let finalTint = mix(envTint, warmLightTint, artificialLight);

   let finalColor = texColor.rgb * totalIllumination * finalTint * in.ao;
    var outputColor = finalColor;

    if (globals.isSubmerged > 0.4) {
        let baseWaterTint = vec3<f32>(0.4, 0.7, 1.0);
        outputColor = outputColor * baseWaterTint;

        let dist = distance(in.worldPos, globals.playerPos);
        let fogDensity = 0.015;
        let fogFactor = clamp(exp(-dist * fogDensity), 0.0, 1.0);
        let waterFogColor = vec3<f32>(0.0, 0.15, 0.4); 

        outputColor = mix(waterFogColor, outputColor, fogFactor);
    }

    return vec4<f32>(outputColor, texColor.a);
}
`;

export const skyWGSL = /* wgsl */ `
// === GLOBAL UNIFORMS (Group 0) ===
struct GlobalUniforms {
    projection: mat4x4<f32>,
    view: mat4x4<f32>,
    sunDirection: vec3<f32>,
    time: f32,
    playerPos: vec3<f32>,
    holdingTorch: f32,
};

@group(0) @binding(0) var<uniform> globals: GlobalUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) texcoord: vec3<f32>,
};

@vertex
fn vs_main(@location(0) position: vec3<f32>) -> VertexOutput {
    var out: VertexOutput;
    out.texcoord = position;

    var viewRotOnly = globals.view;
    viewRotOnly[3][0] = 0.0;
    viewRotOnly[3][1] = 0.0;
    viewRotOnly[3][2] = 0.0;

    let pos = globals.projection * viewRotOnly * vec4<f32>(position, 1.0);
    out.position = vec4<f32>(pos.x, pos.y, pos.w, pos.w); // pos.xyww equivalent
    return out;
}

fn random(st: vec3<f32>) -> f32 {
    return fract(sin(dot(st, vec3<f32>(12.9898, 78.233, 54.53))) * 43758.5453123); 
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(in.texcoord);
    let sunDir = normalize(globals.sunDirection);
   
    let daySky = mix(vec3<f32>(0.5, 0.7, 1.0), vec3<f32>(0.1, 0.4, 0.8), clamp(dir.y, 0.0, 1.0));
    let nightSky = mix(vec3<f32>(0.02, 0.02, 0.05), vec3<f32>(0.0, 0.0, 0.02), clamp(dir.y, 0.0, 1.0));

    let sunHeight = clamp(sunDir.y, -0.2, 0.2) / 0.2;
    let dayFactor = (sunHeight + 1.0) / 2.0;

    var skyColor = mix(nightSky, daySky, dayFactor);

    // === SUN ===
    let sunZ = sunDir;
    let sunX = normalize(cross(vec3<f32>(0.0, 0.0, 1.0), sunZ));
    let sunY = cross(sunZ, sunX);

    let dx = dot(dir, sunX);
    let dy = dot(dir, sunY);
    let dz = dot(dir, sunZ);

    let sunSize = 0.05;
    if (abs(dx) < sunSize && abs(dy) < sunSize && dz > 0.0) {
        skyColor = vec3<f32>(1.0, 0.95, 0.8);
    }

   // === MOON ===
    let moonZ = -sunDir;
    let moonX = normalize(cross(vec3<f32>(0.0, 0.0, 1.0), moonZ));
    let moonY = cross(moonZ, moonX);

    let mdx = dot(dir, moonX);
    let mdy = dot(dir, moonY);
    let mdz = dot(dir, moonZ);

    let moonSize = 0.04;
    if (abs(mdx) < moonSize && abs(mdy) < moonSize && mdz > 0.0) {
        skyColor = vec3<f32>(0.8, 0.8, 0.9);
    }

    // === STARS ===
    let star = random(floor(dir * 200.0));
    if (star > 0.9995 && dayFactor < 0.5 && dir.y > 0.0) {
        skyColor += vec3<f32>(1.0, 1.0, 1.0) * (0.5 - dayFactor) * 2.0;
    }

    return vec4<f32>(skyColor, 1.0);
}
`;

export const entityWGSL = /* wgsl */ `
// === GLOBAL UNIFORMS (Group 0) ===
struct GlobalUniforms {
    projection: mat4x4<f32>,
    view: mat4x4<f32>,
    sunDirection: vec3<f32>,
    time: f32,
    playerPos: vec3<f32>,
    holdingTorch: f32,
};

@group(0) @binding(0) var<uniform> globals: GlobalUniforms;
@group(0) @binding(1) var textureArray: texture_2d_array<f32>;
@group(0) @binding(2) var textureSampler: sampler;

struct EntityUniforms {
    model: mat4x4<f32>,
    layer: f32,
    isMoving: f32,
    damageFlash: f32,
    padding: f32,
};

@group(1) @binding(0) var<uniform> entity: EntityUniforms;

struct VertexInput {
    @location(0) position: vec3<f32>,
    @location(1) uv: vec2<f32>,
    @location(2) normal: vec3<f32>,
    @location(3) bone: f32,
};

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec2<f32>,
    @location(1) normal: vec3<f32>,
    @location(2) worldPos: vec3<f32>,
}

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var animatedPos = in.position;

    if (in.bone > 0.0) {
        var swing = sin(globals.time * 10.0) * 0.3 * entity.isMoving;

        if (in.bone == 2.0) { swing *= -1.0; }

        let pivotY = 0.5;
        let dy = animatedPos.y - pivotY;
        let dz = animatedPos.z;

        animatedPos.y = pivotY + (dy * cos(swing) - dz * sin(swing));
        animatedPos.z = (dy * sin(swing) + dz * cos(swing));
    }

    let worldPosition = entity.model * vec4<f32>(animatedPos, 1.0);

    var out: VertexOutput;
    out.position = globals.projection * globals.view * worldPosition;

    let modelMat3 = mat3x3<f32>(
        entity.model[0].xyz,
        entity.model[1].xyz,
        entity.model[2].xyz
    );
    out.normal = modelMat3 * in.normal;
    out.worldPos = worldPosition.xyz;

    out.uv = in.uv;
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(textureArray, textureSampler, in.uv, i32(entity.layer));
    if (texColor.a < 0.1) { discard; }

    let normal = normalize(in.normal);
    let sunDir = normalize(globals.sunDirection);
    let sunHeight = max(sunDir.y, 0.0);

    let diffuse = max(dot(normal, sunDir), 0.0) * sunHeight;
    let ambient = 0.2 + (sunHeight * 0.3);
    let lightIntensity = diffuse + ambient;

    var finalColor = texColor.rgb * lightIntensity;

    if (entity.damageFlash > 0.0) {
       finalColor = mix(finalColor, vec3<f32>(1.0, 0.0, 0.0), entity.damageFlash);
    }

    return vec4<f32>(finalColor, texColor.a);
}
`;

export const highlightWGSL = /* wgsl */ `
struct GlobalUniforms {
    projection: mat4x4<f32>,
    view: mat4x4<f32>,
};

@group(0) @binding(0) var<uniform> globals: GlobalUniforms;
@group(0) @binding(1) var textureArray: texture_2d_array<f32>;
@group(0) @binding(2) var textureSampler: sampler;

struct HighlightUniforms {
    model: mat4x4<f32>,
    alpha: f32,
    padding1: f32,
    padding2: f32,
    padding3: f32,
};

@group(1) @binding(0) var<uniform> highlight: HighlightUniforms;

struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv: vec3<f32>
}

@vertex
fn vs_main(@location(0) position: vec3<f32>, @location(1) uv: vec3<f32>) -> VertexOutput {
    var out: VertexOutput;
    out.position = globals.projection * globals.view * highlight.model * vec4<f32>(position, 1.0);
    out.uv = uv;

    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(textureArray, textureSampler, in.uv.xy, i32(in.uv.z));
    return vec4<f32>(texColor.rgb, texColor.a * highlight.alpha);
}
`;

export const lineWGSL = /* wgsl */ `
struct GlobalUniforms {
    projection: mat4x4<f32>,
    view: mat4x4<f32>,
};
@group(0) @binding(0) var<uniform> globals: GlobalUniforms;

struct LineUniforms {
    color: vec3<f32>,
    padding: f32,
};
@group(1) @binding(0) var<uniform> line: LineUniforms;

@vertex
fn vs_main(@location(0) position: vec3<f32>) -> @builtin(position) vec4<f32> {
    return globals.projection * globals.view * vec4<f32>(position, 1.0);
}

@fragment
fn fs_main() -> @location(0) vec4<f32> {
    return vec4<f32>(line.color, 1.0);
}
`;
