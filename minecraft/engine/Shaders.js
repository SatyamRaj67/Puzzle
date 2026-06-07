export const vertexShaderSource = `#version 300 es
in vec3 a_position;
in vec3 a_uv;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

out vec3 v_uv;
out vec3 v_worldPos;

void main() {
    vec4 worldPosition = u_model * vec4(a_position, 1.0);
    gl_Position = u_projection * u_view * worldPosition;
    v_uv = a_uv;
    v_worldPos = worldPosition.xyz;
}
`

export const fragmentShaderSource = `#version 300 es
precision highp float;
precision highp sampler2DArray;

in vec3 v_uv;
in vec3 v_worldPos;

uniform sampler2DArray u_texture;
uniform float u_alpha;
uniform vec3 u_sunDirection;

out vec4 outColor;

void main() {
    vec4 texColor = texture(u_texture, v_uv);

    vec3 normal = normalize(cross(dFdx(v_worldPos), dFdy(v_worldPos)));
    vec3 sunDir = normalize(u_sunDirection);

    float sunHeight = max(sunDir.y, 0.0);

    float diffuse = max(dot(normal, sunDir), 0.0) * sunHeight;

    float ambient = 0.05 + (0.25 * sunHeight);

    float lightIntensity = diffuse + ambient;

    outColor = vec4(texColor.rgb * lightIntensity, texColor.a * u_alpha);
}
`