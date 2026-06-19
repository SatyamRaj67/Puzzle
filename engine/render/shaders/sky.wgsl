struct GlobalUniform {
    viewProj: mat4x4<f32>,
    sunDir: vec3<f32>,
    timeOfDay: f32,
    time: f32,
    cameraPosX: f32,
    cameraPosY: f32,
    cameraPosZ: f32,
};

@group(0) @binding(0) var<uniform> globals: GlobalUniform;

@group(1) @binding(0) var atlas_sampler: sampler;
@group(1) @binding(1) var atlas_texture: texture_2d<f32>;

struct VertexInput {
    @location(0) position: vec3<f32>,
};

struct VertexOutput {
    @builtin(position) clip_position: vec4<f32>,
    @location(0) texcoord: vec3<f32>,
};

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.texcoord = model.position;
    
    // Reconstruct the vec3 from our perfectly packed floats
    let cameraPos = vec3<f32>(globals.cameraPosX, globals.cameraPosY, globals.cameraPosZ);

    // Scale box massively and center on player
    let world_pos = (model.position * 500.0) + cameraPos;
    out.clip_position = globals.viewProj * vec4<f32>(world_pos, 1.0);
    return out;
}

// Pseudo-random noise
fn random(st: vec3<f32>) -> f32 {
    return fract(sin(dot(st, vec3<f32>(12.9898, 78.233, 54.53))) * 43758.5453123); 
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let dir = normalize(in.texcoord);
    let sunDir = normalize(globals.sunDir);
   
    // Sky Gradients
    let daySky = mix(vec3<f32>(0.4, 0.6, 0.9), vec3<f32>(0.1, 0.3, 0.8), clamp(dir.y, 0.0, 1.0));
    let nightSky = mix(vec3<f32>(0.02, 0.02, 0.05), vec3<f32>(0.0, 0.0, 0.02), clamp(dir.y, 0.0, 1.0));

    let sunHeight = clamp(sunDir.y, -0.2, 0.2) / 0.2;
    let dayFactor = (sunHeight + 1.0) / 2.0;

    var skyColor = mix(nightSky, daySky, dayFactor);

    // --- SUN (Crisp Square) ---
    let sunZ = sunDir;
    // Cross product against UP (Y) to get a stable X axis
    let sunX = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), sunZ)); 
    let sunY = cross(sunZ, sunX);

    let dx = dot(dir, sunX);
    let dy = dot(dir, sunY);
    let dz = dot(dir, sunZ);

    let sunSize = 0.08;
    if (abs(dx) < sunSize && abs(dy) < sunSize && dz > 0.0) {
        skyColor = vec3<f32>(1.0, 0.95, 0.8);
    }

    // --- MOON (Crisp Square) ---
    let moonZ = -sunDir; 
    let moonX = normalize(cross(vec3<f32>(0.0, 1.0, 0.0), moonZ));
    let moonY = cross(moonZ, moonX);

    let mdx = dot(dir, moonX);
    let mdy = dot(dir, moonY);
    let mdz = dot(dir, moonZ);

    let moonSize = 0.06;
    if (abs(mdx) < moonSize && abs(mdy) < moonSize && mdz > 0.0) {
        skyColor = vec3<f32>(0.8, 0.85, 0.9);
    }

    // --- JUMBLED, FLICKERING, MOVING STARS ---
    let drift = globals.time * 0.001;
    let c = cos(drift);
    let s = sin(drift);

    let rotatedDir = vec3<f32>(
        dir.x * c - dir.z * s,
        dir.y,
        dir.x * s + dir.z * c
    );
    
    let starGrid = floor(rotatedDir * 200.0);
    let starNoise = random(starGrid);
    
    if (starNoise > 0.997 && dayFactor < 0.5 && dir.y > 0.05) {
        let flickerSpeed = 1.0 + starNoise * 4.0;
        let flicker = (sin(globals.time * flickerSpeed) * 0.125) + 0.875;
        let starBrightness = flicker * (0.5 - dayFactor) * 1.5;
        skyColor += vec3<f32>(1.0, 1.0, 1.0) * starBrightness;
    }

    return vec4<f32>(skyColor, 1.0);
}