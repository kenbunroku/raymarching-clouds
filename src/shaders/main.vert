#version 300 es

layout(location = 0) in vec3 position;
layout(location = 1) in vec2 uv;

out vec3 vPosition;
out vec2 vUv;

void main() {
  vPosition = position;
  vUv = uv;
  gl_Position = vec4(position, 1.0f);
}
