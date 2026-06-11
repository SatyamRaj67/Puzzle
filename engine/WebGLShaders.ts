export const vertexShaderSource = `#version 300 es
in uint a_data1;
in uint a_data2;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform float u_time;

out vec3 v_uv;
out vec3 v_worldPos;
out float v_light;
out float v_skyLight;
out float v_ao;

void main() {
    float x = float(a_data1 & 31u);
    float y = float((a_data1 >> 5u) & 255u);
    float z = float((a_data1 >> 13u) & 31u);

    float u = float((a_data1 >> 18u) & 31u);
    float v = float((a_data1 >> 23u) & 255u);

    float layer = float(a_data2 & 255u);

    float WATER_BASE_LAYER = 10.0;
    float ANIMATION_SPEED = 16.0; // 16 frames per second

    // === FRAME-BY-FRAME WATER ANIMATION ===
    if (layer == WATER_BASE_LAYER) { 
        float currentFrame = floor(mod(u_time * ANIMATION_SPEED, 32.0)); 
        
        layer += currentFrame; 

        y -= 0.15; 
    }

    v_light = float((a_data2 >> 8u) & 15u) / 15.0;
    v_skyLight = float((a_data2 >> 12u) & 15u) / 15.0;

    float aoRaw = float((a_data2 >> 16u) & 3u);
    v_ao = 0.4 + (aoRaw * 0.2); 

    vec3 pos = vec3(x, y, z);
    vec4 worldPosition = u_model * vec4(pos, 1.0);

    gl_Position = u_projection * u_view * worldPosition;
    
    v_worldPos = worldPosition.xyz;
    v_uv = vec3(u, v, layer);
}
`;
export const fragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 v_uv;
in vec3 v_worldPos;
in float v_light;
in float v_skyLight;
in float v_ao;

uniform sampler2DArray u_texture;
uniform float u_alpha;
uniform float u_holdingTorch;
uniform vec3 u_sunDirection;
uniform vec3 u_playerPos;

out vec4 outColor;

void main() {
    vec4 texColor = texture(u_texture, v_uv);
    if (texColor.a < 0.1) discard;

    vec3 normal = normalize(cross(dFdx(v_worldPos), dFdy(v_worldPos)));
    vec3 sunDir = normalize(u_sunDirection);
    float dayFactor = clamp((sunDir.y + 0.2) / 0.4, 0.0, 1.0);

    float skyInfluence = max(v_skyLight, 0.2); 
    float ambientSky = skyInfluence * mix(0.3, 0.6, dayFactor);

    float diffuse = max(dot(normal, sunDir), 0.0);
    float sunIntensity = diffuse * dayFactor * v_skyLight * 0.4;

    float distToPlayer = distance(v_worldPos, u_playerPos);
    float torch = pow(max(0.0, 1.0 - (distToPlayer / 12.0)), 2.0) * u_holdingTorch;
    float artificialLight = max(v_light, torch);

    float naturalLight = ambientSky + sunIntensity;
    float totalIllumination = max(naturalLight, artificialLight);

    vec3 nightTint = vec3(0.4, 0.5, 0.8);
    vec3 dayTint = vec3(1.0, 1.0, 1.0);
    vec3 envTint = mix(nightTint, dayTint, dayFactor);

    vec3 warmLightTint = vec3(1.0, 0.9, 0.8);
    vec3 finalTint = mix(envTint, warmLightTint, artificialLight);

    vec3 finalColor = texColor.rgb * totalIllumination * finalTint * v_ao;
    outColor = vec4(finalColor, texColor.a * u_alpha);
}
`;

export const highlightVertexShaderSource = `#version 300 es
in vec3 a_position;
in vec3 a_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

out vec3 v_uv;

void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
    v_uv = a_uv;
}
`;

export const highlightFragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 v_uv;

uniform sampler2DArray u_texture;
uniform float u_alpha;

out vec4 outColor;

void main() {
    vec4 texColor = texture(u_texture, v_uv);    
    outColor = vec4(texColor.rgb, texColor.a * u_alpha);
}   
`;

export const skyVertexShaderSource = `#version 300 es
in vec3 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;

out vec3 v_texcoord;

void main() {
    v_texcoord = a_position;

    mat4 viewRotOnly = mat4(mat3(u_view));

    vec4 pos = u_projection * viewRotOnly * vec4(a_position, 1.0);

    gl_Position = pos.xyww;
}
`;

export const skyFragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_texcoord;

uniform vec3 u_sunDirection;

out vec4 outColor;

float random(vec3 st) {
    return fract(sin(dot(st.xyz, vec3(12.9898, 78.233, 54.53))) * 43758.5453123); 
}

void main() {
    vec3 dir = normalize(v_texcoord);
    vec3 sunDir = normalize(u_sunDirection);

    // Sky Gradient using Interpolation
    vec3 daySky = mix(vec3(0.5, 0.7, 1.0), vec3(0.1, 0.4, 0.8), clamp(dir.y, 0.0, 1.0));
    vec3 nightSky = mix(vec3(0.02, 0.02, 0.05), vec3(0.0, 0.0, 0.02), clamp(dir.y, 0.0, 1.0));

    float sunHeight = clamp(sunDir.y, -0.2, 0.2) / 0.2;
    float dayFactor = (sunHeight + 1.0) / 2.0;

    vec3 skyColor = mix(nightSky, daySky, dayFactor);

    // === SUN ===

    vec3 sunZ = sunDir;
    vec3 sunX = normalize(cross(vec3(0.0, 0.0, 1.0), sunZ));
    vec3 sunY = cross(sunZ, sunX);

    float dx = dot(dir, sunX);
    float dy = dot(dir, sunY);
    float dz = dot(dir, sunZ);

    float sunSize = 0.05;

    if (abs(dx) < sunSize && abs(dy) < sunSize && dz > 0.0) {
        skyColor = vec3(1.0, 0.95, 0.8);
    }

    // === MOON ===
    vec3 moonZ = -sunDir;
    vec3 moonX = normalize(cross(vec3(0.0, 0.0, 1.0), moonZ));
    vec3 moonY = cross(moonZ, moonX);

    float mdx = dot(dir, moonX);
    float mdy = dot(dir, moonY);
    float mdz = dot(dir, moonZ);

    float moonSize = 0.04;

    if (abs(mdx) < moonSize && abs(mdy) < moonSize && mdz > 0.0) {
        skyColor = vec3(0.8, 0.8, 0.9);
    }

    // === STARS ===

    // Add Stars at Night
    float star = random(floor(dir * 200.0));

    if (star > 0.9995 && dayFactor < 0.5 && dir.y > 0.0) {
        skyColor += vec3(1.0) * (0.5 - dayFactor) * 2.0;
    }

    outColor = vec4(skyColor, 1.0);
}
`;

export const entityVertexShaderSource = `#version 300 es
in vec3 a_position;
in vec2 a_uv;
in vec3 a_normal;
in float a_bone;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;
uniform float u_time;
uniform float u_isMoving;

out vec2 v_uv;
out vec3 v_normal;
out vec3 v_worldPos;

void main() {
    vec3 animatedPos = a_position;
    
    if (a_bone > 0.0) {
        float swing = sin(u_time * 10.0) * 0.3 * u_isMoving;

        if (a_bone == 2.0) swing *= -1.0;

        float pivotY = 0.5;

        float dy = animatedPos.y - pivotY;
        float dz = animatedPos.z;

        animatedPos.y = pivotY + (dy * cos(swing) - dz * sin(swing));
        animatedPos.z = (dy * sin(swing) + dz * cos(swing));
    }

    vec4 worldPosition = u_model * vec4(animatedPos, 1.0);
    gl_Position = u_projection * u_view * worldPosition;

    v_normal = mat3(u_model) * a_normal;
    v_worldPos = worldPosition.xyz;
    v_uv = a_uv;
}
`;

export const entityFragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec2 v_uv;
in vec3 v_normal;
in vec3 v_worldPos;

uniform sampler2DArray u_texture;
uniform vec3 u_sunDirection;
uniform float u_layer;
uniform float u_damageFlash;

out vec4 outColor;

void main() {
    vec4 texColor = texture(u_texture, vec3(v_uv, u_layer));
    if (texColor.a < 0.1) discard;

    vec3 normal = normalize(v_normal);
    vec3 sunDir = normalize(u_sunDirection);
    float sunHeight = max(sunDir.y, 0.0);

    float diffuse = max(dot(normal, sunDir), 0.0) * sunHeight;
    float ambient = 0.2 + (0.3 * sunHeight);

    float lightIntensity = diffuse + ambient;

    vec3 finalColor = texColor.rgb * lightIntensity;

    if (u_damageFlash > 0.0) {
        finalColor = mix(finalColor, vec3(1.0, 0.0, 0.0), u_damageFlash);
    }

    outColor = vec4(finalColor, texColor.a);
}
`;

export const lineVertexShaderSource = `#version 300 es
in vec3 a_position;

uniform mat4 u_projection;
uniform mat4 u_view;

void main() {
    gl_Position = u_projection * u_view * vec4(a_position, 1.0);
}
`;

export const lineFragmentShaderSource = `#version 300 es
precision mediump float;

uniform vec3 u_color;

out vec4 outColor;

void main() {
    outColor = vec4(u_color, 1.0);
}
`;
