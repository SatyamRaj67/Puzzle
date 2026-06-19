struct GlobalUniform {
    viewProj: mat4x4<f32>,
    sunDir: vec3<f32>,
    timeOfDay: f32,
    time: f32,
    cameraPosX: f32,
    cameraPosY: f32,
    cameraPosZ: f32,
};

struct FaceUnifrom {
    face_dir: u32,
};

struct AnimData {
    data: array<vec4<f32>, 128>
}

// --- GROUP 0: Camera ---
@group(0) @binding(0) var<uniform> globals: GlobalUniform;

// --- GROUP 1: Texture Atlas ---
@group(1) @binding(0) var atlas_sampler: sampler;
@group(1) @binding(1) var atlas_texture: texture_2d<f32>;
@group(1) @binding(2) var<uniform> anim_buffer: AnimData;

// --- GROUP 2: Face Data ---
@group(2) @binding(0) var<uniform> face: FaceUnifrom;

struct VertexInput {
    @builtin(vertex_index) vertex_index: u32,
    @location(0) data1: u32,
    @location(1) data2: u32,
};

struct VertexOutput{
    @builtin(position) clip_position: vec4<f32>,
    @location(0) local_uv: vec2<f32>,
    @location(1) shade: f32,
    @location(2) texture_id: f32,
    @location(3) sky_tint: vec3<f32>,
}

var<private> cube_corners: array<vec3<f32>, 60> = array<vec3<f32>, 60>(
    // 0: Z+ (Front)
    vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 1.0, 1.0),
    // 1: Z- (Back)
    vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 0.0),
    // 2: Y+ (Top)
    vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(0.0, 1.0, 0.0),
    // 3: Y- (Bottom)
    vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, 1.0),
    // 4: X+ (Right)
    vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 1.0),
    // 5: X- (Left)
    vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(0.0, 1.0, 0.0),
    
    // 6: Diagonal 1 (Front)
    vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 1.0), vec3<f32>(0.0, 1.0, 0.0),
    // 7: Diagonal 1 (Back - Flipped Winding)
    vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 0.0, 1.0), vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(1.0, 1.0, 1.0),
    // 8: Diagonal 2 (Front)
    vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(0.0, 1.0, 1.0), vec3<f32>(1.0, 1.0, 0.0),
    // 9: Diagonal 2 (Back - Flipped Winding)
    vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 1.0, 0.0), vec3<f32>(0.0, 1.0, 1.0)
);

var<private> quad_uvs: array<vec2<f32>, 6> = array<vec2<f32>, 6>(
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 1.0), vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0), vec2<f32>(1.0, 0.0), vec2<f32>(0.0, 0.0)
);

var<private> face_shading: array<f32, 10> = array<f32, 10>(
    0.8, // Front
    0.8, // Back
    1.0, // Top (Brightest)
    0.5, // Bottom (Darkest)
    0.6, // Right
    0.6,  // Left
    1.0,
    1.0,
    1.0,
    1.0
);

var<private> face_normals: array<vec3<f32>, 10> = array<vec3<f32>, 10>(
    vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(0.0, 0.0, -1.0),
    vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, -1.0, 0.0),
    vec3<f32>(1.0, 0.0, 0.0), vec3<f32>(-1.0, 0.0, 0.0),

    vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, 1.0, 0.0), 
    vec3<f32>(0.0, 1.0, 0.0), vec3<f32>(0.0, 1.0, 0.0)
);

@vertex
fn vs_main(model: VertexInput) -> VertexOutput {
    var out: VertexOutput;

    let x = f32(model.data1 & 0xFu);
    let y = f32((model.data1 >> 4u) & 0x7Fu);
    let z = f32((model.data1 >> 11u) & 0xFu);
    var tex_id = (model.data1 >> 15u) & 0x7Fu;
    let w = f32((model.data1 >> 22u) & 0x1Fu) + 1.0;
    let h = f32((model.data1 >> 27u) & 0x1Fu) + 1.0;

    
    let d2 = i32(model.data2);
    let chunk_x = f32((d2 << 12u) >> 20u);
    let chunk_z = f32(d2 >> 20u);

    let face_dir = face.face_dir;
    let corner_index = (face_dir * 6u) + (model.vertex_index % 6u);
    var corner_offset = cube_corners[corner_index];

    if (face_dir == 0u || face_dir == 1u) { 
        corner_offset.x *= w; corner_offset.y *= h; 
    } else if (face_dir == 2u || face_dir == 3u) {
        corner_offset.x *= w; corner_offset.z *= h; 
    } else if (face_dir == 4u || face_dir == 5u) { 
        corner_offset.z *= w; corner_offset.y *= h; 
    }

    let world_pos = vec3<f32>(
        x + (chunk_x * 16.0), 
        y, 
        z + (chunk_z * 16.0)
    ) + corner_offset;
    out.clip_position = globals.viewProj * vec4<f32>(world_pos, 1.0);

    let base_uv = quad_uvs[model.vertex_index % 6u];

    // --- AMBIENT OCCLUSION LOGIC ---
    var ao_level = 0.0;
    if (base_uv.x == 0.0 && base_uv.y == 0.0) {
        ao_level = f32(model.data2 & 3u);          // Bottom-Left
    } else if (base_uv.x == 1.0 && base_uv.y == 0.0) {
        ao_level = f32((model.data2 >> 2u) & 3u);  // Bottom-Right
    } else if (base_uv.x == 0.0 && base_uv.y == 1.0) {
        ao_level = f32((model.data2 >> 4u) & 3u);  // Top-Left
    } else {
        ao_level = f32((model.data2 >> 6u) & 3u);  // Top-Right
    };
    let ao_multiplier = 1.0 - (ao_level * 0.25); 

    let normal = face_normals[face_dir];
    let sun_dir = normalize(globals.sunDir);
    let direct_light = max(dot(normal, sun_dir), 0.0);

    let ambient_light = max(sun_dir.y * 0.5 + 0.1, 0.2);
    let total_illumination = ambient_light + (direct_light * 0.6);

   out.shade = face_shading[face_dir] * ao_multiplier * total_illumination;

    // --- DAY/NIGHT TINT ---
    let night_tint = vec3<f32>(0.2, 0.3, 0.6);
    let day_tint = vec3<f32>(1.0, 1.0, 1.0);
    let day_factor = clamp(sun_dir.y + 0.2, 0.0, 1.0); 
    out.sky_tint = mix(night_tint, day_tint, day_factor);

  // --- ANIMATION LOGIC ---
  let anim_props = anim_buffer.data[tex_id];
  let frames = u32(anim_props.x);
  let speed = anim_props.y;

    if (frames > 1u) {
        let current_frame = u32(globals.time * speed) % frames;
        tex_id = tex_id + current_frame;
    }
    out.texture_id = f32(tex_id);
    out.local_uv = vec2<f32>(base_uv.x * w, base_uv.y * h);
    
    return out;
}

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let atlas_cols = 16.0;
    let tile_size = 1.0 / atlas_cols;

    let col = f32(u32(in.texture_id) % 16u);
    let row = f32(u32(in.texture_id) / 16u);

    let wrapped_uv = fract(in.local_uv);

    let epsilon = 0.001;
    let clamped_uv = vec2<f32>(
        clamp(wrapped_uv.x, epsilon, 1.0 - epsilon),
        clamp(wrapped_uv.y, epsilon, 1.0 - epsilon)
    );

    let final_uv = vec2<f32>(
        (col * tile_size) + (clamped_uv.x * tile_size),
        (row * tile_size) + (clamped_uv.y * tile_size)
    );

    let tex_color = textureSample(atlas_texture, atlas_sampler, final_uv);

    if (tex_color.a < 0.1) {
        discard;
    }

    let final_color = tex_color.rgb * in.shade * in.sky_tint;
    return vec4<f32>(final_color, tex_color.a);
}