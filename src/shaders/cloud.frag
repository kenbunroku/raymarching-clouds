#version 300 es
precision highp float;

uniform float time;
uniform vec2 resolution;
uniform sampler2D noiseTex;
uniform sampler2D blueNoiseTex;
uniform int frame;

in vec3 vPosition;
in vec2 vUv;

out vec4 fragColor;

#define MAX_STEPS 80
#define MAX_STEPS_LIGHTS 6
#define ABSORPTION_COEFFICIENT 0.2f
#define SCATTERING_ANISO 0.3
#define PI 3.14159265359

const float MARCH_SIZE = 0.1f;

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0f - 2.0f * f);

  vec2 uv = (p.xy + vec2(37.0f, 239.0f) * p.z) + f.xy;
  vec2 tex = textureLod(noiseTex, (uv + 0.5f) / 256.0f, 0.0f).yx;

  return mix(tex.x, tex.y, f.z) * 2.0f - 1.0f;
}

vec3 sunPosition() {
  return vec3(6.f, 5.0f, -15.0f);
}

float fbm(vec3 p, bool lowRes) {
  vec3 q = p + time * 0.5f * vec3(1.0f, -0.2f, -.5f);

  float f = 0.0f;
  float scale = 0.5f;
  float factor = 2.02f;

  int maxOctave = lowRes ? 3 : 6;

  for(int i = 0; i < maxOctave; i++) {
    f += scale * noise(q);
    q *= factor;
    factor += 0.21f;
    scale *= 0.5f;
  }

  return f;
}

float sdSphere(vec3 p, float radius) {
  return length(p) - radius;
}

float scene(vec3 p, bool lowRes) {
  float f = fbm(p, lowRes);
  return -p.y + f * 1.5f;
}

float BeersLaw(float dist, float absorption) {
  return exp(-dist * absorption);
}

float HenyeyGreenstein(float g, float mu) {
  float gg = g * g;
  return (1.0f / (4.0f * PI)) * ((1.0f - gg) / pow(1.0f + gg - 2.0f * g * mu, 1.5f));
}

float lightmarch(vec3 p, vec3 rayDirection) {
  vec3 sunPos = sunPosition();
  vec3 lightDirection = normalize(sunPos);
  float totalDensity = 0.0f;
  float marchSize = 0.03f;

  for(int step = 0; step < MAX_STEPS_LIGHTS; step++) {
    p += lightDirection * marchSize * float(step);
    float lightSample = scene(p, true);
    totalDensity += lightSample;
  }

  float transmittance = BeersLaw(totalDensity, ABSORPTION_COEFFICIENT);
  return transmittance;
}

float raymarch(vec3 rayOrigin, vec3 rayDirection, float offset) {
  vec3 sunPos = sunPosition();
  float depth = 0.0f;
  depth += MARCH_SIZE * offset;
  vec3 p = rayOrigin + depth * rayDirection;
  vec3 sunDirection = normalize(sunPos);

  float totalTransmittance = 1.0f;
  float lightEnergy = 0.0f;

  float phase = HenyeyGreenstein(SCATTERING_ANISO, dot(rayDirection, sunDirection));

  for(int i = 0; i < MAX_STEPS; i++) {
    float density = scene(p, false);

    if(density > 0.0f) {
      float transmittance = lightmarch(p, rayDirection);
      float luminance = clamp(density * phase, 0.0f, 1.0f);

      totalTransmittance *= transmittance;
      lightEnergy += totalTransmittance * luminance;
    }
    depth += MARCH_SIZE;
    p = rayOrigin + depth * rayDirection;
  }

  return lightEnergy;
}

vec4 raymarch(vec3 rayOrigin, vec3 rayDirection, float offset, vec3 bgCol) {
  vec3 sunPos = sunPosition();
  vec3 sundir = normalize(sunPos);
  float marchSize = MARCH_SIZE;
  float depth = 0.0f;
  depth += marchSize * offset;
  vec3 p = rayOrigin + depth * rayDirection;
  vec4 sum = vec4(0.0f);
  for(int i = 0; i < MAX_STEPS; i++) {
    float density = scene(p, false);
    if(density > 0.0f) {
      float diffuse = clamp((density - scene(p + 0.3f * sundir, false)) / 0.3f, 0.0f, 1.0f);
      vec3 lin = vec3(0.60f, 0.60f, 0.75f) * 1.1f + 0.8f * vec3(1.0f, 0.6f, 0.3f) * diffuse;
      vec4 color = vec4(mix(vec3(1.0f, 0.95f, 0.8f), vec3(0.25f, 0.3f, 0.35f), density), density);
      color.rgb *= lin;
      color.rgb = mix(color.rgb, bgCol, 1.0f - BeersLaw(depth, ABSORPTION_COEFFICIENT));
      // fog
      color.rgb = mix(color.rgb, bgCol, 1.0f - exp2(-depth * 0.01f));
      color.rgb *= color.a;
      sum += color * (1.0f - sum.a);
    }
    depth += marchSize;
    p = rayOrigin + depth * rayDirection;
  }
  return clamp(sum, 0.0f, 1.0f);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5f;
  uv.x *= resolution.x / resolution.y;

 // Ray Origin - camera
  vec3 ro = vec3(0.0f, 0.5f, 5.0f);
  // Ray Direction
  vec3 rd = normalize(vec3(uv, -1.0f));

  float offset = 0.0f;
  vec3 color = vec3(0.0f);

  // Sun and Sky
  vec3 sunColor = vec3(0.8f, .7f, 0.3f);
  vec3 sunPos = sunPosition();
  vec3 sunDirection = normalize(sunPos);
  float sun = clamp(dot(sunDirection, rd), 0.0f, 1.0f);

  // Base sky color
  vec3 skyColor = vec3(0.7f, 0.7f, 0.9f);
  color = skyColor;
  // Add vertical gradient
  color -= 0.8f * vec3(0.9f, 0.75f, 0.9f) * rd.y;
  // Add sun color to sky
  color += 0.5f * sunColor * pow(sun, 120.0f);

  float blueNoise = texture(blueNoiseTex, gl_FragCoord.xy / 1024.0f).r;
  offset = fract(blueNoise + float(frame % 32) / sqrt(0.5f));

  // float res = raymarch(ro, rd, offset);
  // color = color + sunColor * res;
  // color = smoothstep(0.1f, 1.05f, color);
  vec4 res = raymarch(ro, rd, offset, color);
  color = color * (1.0f - res.w) + res.xyz;
  color += 0.08f * vec3(1.0f, 0.3f, 0.3f) * pow(sun, 8.0f);
  fragColor = vec4(color.rgb, 1.0f);
}
