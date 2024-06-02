#version 300 es
precision highp float;

uniform float time;
uniform vec2 resolution;

in vec3 vPosition;
in vec2 vUv;

out vec4 fragColor;

#include './modules/snoise.glsl'

float rand(vec3 p) {
  return fract(sin(dot(p, vec3(12.345f, 67.89f, 412.12f))) * 42123.45f) * 2.0f - 1.0f;
}

float valueNoise(vec3 p) {
  vec3 u = floor(p);
  vec3 v = fract(p);
  vec3 s = smoothstep(0.0f, 1.0f, v);

  float a = rand(u);
  float b = rand(u + vec3(1.0f, 0.0f, 0.0f));
  float c = rand(u + vec3(0.0f, 1.0f, 0.0f));
  float d = rand(u + vec3(1.0f, 1.0f, 0.0f));
  float e = rand(u + vec3(0.0f, 0.0f, 1.0f));
  float f = rand(u + vec3(1.0f, 0.0f, 1.0f));
  float g = rand(u + vec3(0.0f, 1.0f, 1.0f));
  float h = rand(u + vec3(1.0f, 1.0f, 1.0f));

  return mix(mix(mix(a, b, s.x), mix(c, d, s.x), s.y), mix(mix(e, f, s.x), mix(g, h, s.x), s.y), s.z);
}

float fbm(vec3 p) {
  vec3 q = p - vec3(0.1f, 0.0f, 0.0f) * time;
  int numOctaves = 8;
  float weight = 0.5f;
  float ret = 0.0f;

  // fbm
  for(int i = 0; i < numOctaves; i++) {
    ret += weight * valueNoise(q);
    q *= 2.0f;
    weight *= 0.5f;
  }
  return clamp(ret - p.y, 0.0f, 1.0f);
}

vec4 volumetricMarch(vec3 ro, vec3 rd) {
  float depth = 0.0f;
  vec4 color = vec4(0.0f, 0.0f, 0.0f, 0.0f);

  for(int i = 0; i < 150; i++) {
    vec3 p = ro + depth * rd;
    float density = fbm(p);

    // If density is unignorable...
    if(density > 1e-3f) {
      // We estimate the color with w.r.t. density
      vec4 c = vec4(mix(vec3(1.0f, 1.0f, 1.0f), vec3(0.0f, 0.0f, 0.0f), density), density);
      // Multiply it by a factor so that it becomes softer
      c.a *= 0.4f;
      c.rgb *= c.a;
      color += c * (1.0f - color.a);
    }

    // March forward a fixed distance
    depth += max(0.05f, 0.02f * depth);
  }

  return vec4(clamp(color.rgb, 0.0f, 1.0f), color.a);
}

vec3 sunDir = normalize(vec3(1.0f, 1.0f, 2.0f));

vec3 getSky(vec3 rd) {
  vec3 sc = mix(vec3(1.0f), vec3(0.1f, 0.5f, 1.0f), clamp(rd.y, -1.0f, 1.0f) * 0.5f + 0.5f);
  sc += max(vec3(0.0f), pow(dot(rd, sunDir) * vec3(1.0f, 1.0f, 0.0f), vec3(24.0f)));
  return sc;
}

void main() {
  vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0f - 1.0f;
  vec3 ro = vec3(0.0f, 1.0f, time);
  vec3 front = normalize(vec3(0.0f, -0.3f, 1.0f));
  vec3 right = normalize(cross(front, vec3(0.0f, 1.0f, 0.0f)));
  vec3 up = normalize(cross(right, front));
  mat3 lookAt = mat3(right, up, front);
  vec3 rd = lookAt * normalize(vec3(uv, 1.0f));
  vec3 skyColor = getSky(rd);
  vec4 cloudColor = volumetricMarch(ro, rd);

  vec3 color = clamp(cloudColor.rgb + (1.0f - cloudColor.a) * skyColor, 0.0f, 1.0f);

  // Gamma correction
  color = pow(color, vec3(0.4545f));

  fragColor = vec4(color, 1.0f);
}
