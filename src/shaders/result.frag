#version 300 es
precision highp float;

in vec2 vUv;

uniform sampler2D tex;
uniform vec2 resolution;
uniform float iorR;
uniform float iorG;
uniform float iorB;
uniform float iorY;
uniform float iorC;
uniform float iorP;
uniform float chromaticAberration;
uniform float refractPower;
uniform float fresnelPower;
uniform float saturation;
uniform float shininess;
uniform float diffuseness;
uniform vec3 light;

out vec4 fragColor;

#define MAX_STEPS 50
#define MAX_DIST 100.0
#define SURFACE_DIST 0.001

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}

float scene(vec3 p) {
  float distance = sdSphere(p, 1.f);
  return distance;
}

vec3 getNormal(vec3 p) {
  vec2 e = vec2(0.01f, 0.0f);

  vec3 n = scene(p) - vec3(scene(p - e.xyy), scene(p - e.yxy), scene(p - e.yyx));

  return normalize(n);
}

float raymarch(vec3 ro, vec3 rd, float side) {
  float dO = 0.0f;
  vec3 color = vec3(0.0f);
  for(int i = 0; i < MAX_STEPS; i++) {
    vec3 p = ro + rd * dO;
    float dS = scene(p) * side;
    dO += dS;

    if(dO > MAX_DIST || dS < SURFACE_DIST) {
      break;
    }
  }
  return dO;
}

vec3 sat(vec3 rgb, float intensity) {
  vec3 L = vec3(0.2125f, 0.7154f, 0.0721f);
  vec3 grayscale = vec3(dot(rgb, L));
  return mix(grayscale, rgb, intensity);
}

float fresnel(vec3 eyeVector, vec3 normal, float power) {
  float fresnelFactor = abs(dot(eyeVector, normal));
  float inversefresnelFactor = 1.0f - fresnelFactor;
  return pow(inversefresnelFactor, power);
}

float specular(vec3 light, float shininess, float diffuseness, vec3 normal, vec3 eyeVector) {
  vec3 lightVector = normalize(light);
  vec3 halfVector = normalize(lightVector + eyeVector);

  float NdotL = dot(normal, lightVector);
  float NdotH = dot(normal, halfVector);
  float kDiffuse = max(0.0f, NdotL);
  float NdotH2 = NdotH * NdotH;

  float kSpecular = pow(NdotH2, 1000.0f / shininess);
  return kDiffuse * diffuseness + kSpecular;
}

const int LOOP = 16;

void main() {
  float iorRatioRed = 1.0f / iorR;
  float iorRatioGreen = 1.0f / iorG;
  float iorRatioBlue = 1.0f / iorB;
  float iorRatioY = 1.0f / iorY;
  float iorRatioC = 1.0f / iorC;
  float iorRatioP = 1.0f / iorP;
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5f;
  uv.x *= resolution.x / resolution.y;

  // Light Position
  vec3 lightPosition = vec3(-10.0f, 10.0f, 10.0f);

  vec3 ro = vec3(0.0f, 0.0f, 5.0f);
  vec3 rd = normalize(vec3(uv, -1.0f));
  float d = raymarch(ro, rd, 1.0f);
  vec3 p = ro + rd * d;

  vec4 color = texture(tex, vUv);
  color = texture(tex, vec2(vUv.x, 1.0f - vUv.y));

  vec3 normal = getNormal(p);

  if(d < MAX_DIST) {
    vec3 eyeVector = (p - ro);

    vec3 refractVecRed = refract(rd, normal, iorRatioRed);
    vec3 refractVecGreen = refract(rd, normal, iorRatioGreen);
    vec3 refractVecBlue = refract(rd, normal, iorRatioBlue);
    vec3 refractVecY = refract(rd, normal, iorRatioY);
    vec3 refractVecC = refract(rd, normal, iorRatioC);
    vec3 refractVecP = refract(rd, normal, iorRatioP);

    for(int i = 0; i < LOOP; i++) {
      float slide = float(i) / float(LOOP);

      vec2 flipUv = vec2(vUv.x, 1.0f - vUv.y);

      float r = texture(tex, flipUv - refractVecRed.xy * (refractPower + slide * 1.0f) * chromaticAberration).r * 0.5f;

      float y = (texture(tex, flipUv - refractVecY.xy * (refractPower + slide * 1.0f) * chromaticAberration).x * 2.0f +
        texture(tex, flipUv - refractVecY.xy * (refractPower + slide * 1.0f) * chromaticAberration).y * 2.0f -
        texture(tex, flipUv - refractVecY.xy * (refractPower + slide * 1.0f) * chromaticAberration).z) / 6.0f;

      float g = texture(tex, flipUv - refractVecGreen.xy * (refractPower + slide * 2.0f) * chromaticAberration).g * 0.5f;

      float c = (texture(tex, flipUv - refractVecC.xy * (refractPower + slide * 2.5f) * chromaticAberration).y * 2.0f +
        texture(tex, flipUv - refractVecC.xy * (refractPower + slide * 2.5f) * chromaticAberration).z * 2.0f -
        texture(tex, flipUv - refractVecC.xy * (refractPower + slide * 2.5f) * chromaticAberration).x) / 6.0f;

      float b = texture(tex, flipUv - refractVecBlue.xy * (refractPower + slide * 3.0f) * chromaticAberration).b * 0.5f;

      float p = (texture(tex, flipUv - refractVecP.xy * (refractPower + slide * 1.0f) * chromaticAberration).z * 2.0f +
        texture(tex, flipUv - refractVecP.xy * (refractPower + slide * 1.0f) * chromaticAberration).x * 2.0f -
        texture(tex, flipUv - refractVecP.xy * (refractPower + slide * 1.0f) * chromaticAberration).y) / 6.0f;

      float R = r + (2.0f * p + 2.0f * y - c) / 3.0f;
      float G = g + (2.0f * y + 2.0f * c - p) / 3.0f;
      float B = b + (2.0f * c + 2.0f * p - y) / 3.0f;

      color.r += R;
      color.g += G;
      color.b += B;

      color.rgb = sat(color.rgb, saturation);
    }
    color.rgb /= float(LOOP);

    // specular
    float specularLight = specular(light, shininess, diffuseness, normal, eyeVector);
    color.rgb += specularLight;

    // fresnel
    float f = fresnel(eyeVector, normal, fresnelPower);
    f = clamp(f, 0.0f, 1.0f);
    color.rgb += f * vec3(1.0f);

    // Ensuring no channel goes above 1.0
    color.rgb = min(color.rgb, vec3(1.0f));
  }

  fragColor = color;
}
