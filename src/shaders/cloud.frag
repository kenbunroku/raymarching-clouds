// https://blog.maximeheckel.com/posts/real-time-cloudscapes-with-volumetric-raymarching/
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

const float MARCH_SIZE = 0.1;

float noise(vec3 x) {
  vec3 p = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);

  vec2 uv = (p.xy + vec2(37.0, 239.0) * p.z) + f.xy;
  vec2 tex = textureLod(noiseTex, (uv + 0.5) / 256.0, 0.0).yx;

  return mix(tex.x, tex.y, f.z) * 2.0 - 1.0;
}

vec3 sunPosition() {
  return vec3(6., 5.0, -15.0);
}

float fbm(vec3 p, bool lowRes) {
  vec3 q = p + time * 0.5 * vec3(1.0, -0.2, -.5);

  float f = 0.0;
  float scale = 0.5;
  float factor = 2.02;

  int maxOctave = lowRes ? 3 : 6;

  for(int i = 0; i < maxOctave; i++) {
    f += scale * noise(q);
    q *= factor;
    factor += 0.21;
    scale *= 0.5;
  }

  return f;
}

float sdSphere(vec3 p, float radius) {
  return length(p) - radius;
}

float scene(vec3 p, bool lowRes) {
  float f = fbm(p, lowRes);
  return -p.y + f * 1.5;
}

float BeersLaw(float dist, float absorption) {
  return exp(-dist * absorption);
}

float HenyeyGreenstein(float g, float mu) {
  float gg = g * g;
  return (1.0 / (4.0 * PI)) * ((1.0 - gg) / pow(1.0 + gg - 2.0 * g * mu, 1.5));
}

float lightmarch(vec3 p, vec3 rayDirection) {
  vec3 sunPos = sunPosition();
  vec3 lightDirection = normalize(sunPos);
  float totalDensity = 0.0;
  float marchSize = 0.03;

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
  float depth = 0.0;
  depth += MARCH_SIZE * offset;
  vec3 p = rayOrigin + depth * rayDirection;
  vec3 sunDirection = normalize(sunPos);

  float totalTransmittance = 1.0;
  float lightEnergy = 0.0;

  float phase = HenyeyGreenstein(SCATTERING_ANISO, dot(rayDirection, sunDirection));

  for(int i = 0; i < MAX_STEPS; i++) {
    float density = scene(p, false);

    if(density > 0.0) {
      float transmittance = lightmarch(p, rayDirection);
      float luminance = clamp(density * phase, 0.0, 1.0);

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
  float depth = 0.0;
  depth += marchSize * offset;
  vec3 p = rayOrigin + depth * rayDirection;
  vec4 sum = vec4(0.0);
  for(int i = 0; i < MAX_STEPS; i++) {
    float density = scene(p, false);
    if(density > 0.0) {
      float diffuse = clamp((density - scene(p + 0.3 * sundir, false)) / 0.3, 0.0, 1.0);
      vec3 lin = vec3(0.60, 0.60, 0.75) * 1.1 + 0.8 * vec3(1.0, 0.6, 0.3) * diffuse;
      vec4 color = vec4(mix(vec3(1.0, 0.95, 0.8), vec3(0.25, 0.3, 0.35), density), density);
      color.rgb *= lin;
      color.rgb = mix(color.rgb, bgCol, 1.0 - BeersLaw(depth, ABSORPTION_COEFFICIENT));
      // fog
      color.rgb = mix(color.rgb, bgCol, 1.0 - exp2(-depth * 0.01));
      color.rgb *= color.a;
      sum += color * (1.0 - sum.a);
    }
    depth += marchSize;
    p = rayOrigin + depth * rayDirection;
  }
  return clamp(sum, 0.0, 1.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

 // Ray Origin - camera
  vec3 ro = vec3(0.0, 0.5, 5.0);
  // Ray Direction
  vec3 rd = normalize(vec3(uv, -1.0));

  float offset = 0.0;
  vec3 color = vec3(0.0);

  // Sun and Sky
  vec3 sunColor = vec3(0.8, .7, 0.3);
  vec3 sunPos = sunPosition();
  vec3 sunDirection = normalize(sunPos);
  float sun = clamp(dot(sunDirection, rd), 0.0, 1.0);

  // Base sky color
  vec3 skyColor = vec3(0.7, 0.7, 0.9);
  color = skyColor;
  // Add vertical gradient
  color -= 0.8 * vec3(0.9, 0.75, 0.9) * rd.y;
  // Add sun color to sky
  color += 0.5 * sunColor * pow(sun, 120.0);

  float blueNoise = texture(blueNoiseTex, gl_FragCoord.xy / 1024.0).r;
  offset = fract(blueNoise + float(frame % 32) / sqrt(0.5));

  // float res = raymarch(ro, rd, offset);
  // color = color + sunColor * res;
  // color = smoothstep(0.1f, 1.05f, color);
  vec4 res = raymarch(ro, rd, offset, color);
  color = color * (1.0 - res.w) + res.xyz;
  color += 0.08 * vec3(1.0, 0.3, 0.3) * pow(sun, 8.0);
  fragColor = vec4(color.rgb, 1.0);
}
