export const vertexShaderSource = `#version 300 es
in vec3 a_position;
in vec3 a_color;

uniform mat4 u_projection;
uniform mat4 u_view;
uniform mat4 u_model;

out vec3 v_color;

void main() {
    gl_Position = u_projection * u_view * u_model * vec4(a_position, 1.0);
    v_color = a_color;
}
`

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 v_color;
uniform float u_alpha;

out vec4 outColor;

void main() {
    outColor = vec4(v_color, u_alpha);
}
`