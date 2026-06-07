export const vertexShaderSource = `#version 300 es
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
`

export const fragmentShaderSource = `#version 300 es
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
`