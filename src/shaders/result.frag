// https ://blog.maximeheckel.com/posts/refraction-dispersion-and-other-shader-light-effects/
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
uniform float time;

out vec4 fragColor;

#define MAX_STEPS 50
#define MAX_DIST 100.0
#define SURFACE_DIST 0.001
#define PI 3.1415926
#define TAU 6.2831853

#include './modules/snoise.glsl'

vec3 opTwist(in vec3 p, float k) {
  float c = cos(k * p.y);
  float s = sin(k * p.y);
  mat2 m = mat2(c, -s, s, c);
  vec3 q = vec3(m * p.xz, p.y);
  return q;
}

// This function comes from glsl-rotate https://github.com/dmnsgn/glsl-rotate/blob/main/rotation-3d.glsl
mat4 rotation3d(vec3 axis, float angle) {
  axis = normalize(axis);
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;

  return mat4(oc * axis.x * axis.x + c, oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s, 0.0, oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c, oc * axis.y * axis.z - axis.x * s, 0.0, oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c, 0.0, 0.0, 0.0, 0.0, 1.0);
}

vec3 rotate(vec3 v, vec3 axis, float angle) {
  mat4 m = rotation3d(axis, angle);
  return (m * vec4(v, 1.0)).xyz;
}

float sdSphere(vec3 p, float s) {
  return length(p) - s;
}

float sdSine(vec3 p) {
  return 1.0 - (sin(p.x) + sin(p.y) + sin(p.z)) / 3.0;
}

float smin(float a, float b, float k) {
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float displacement(vec4 p) {
  return snoise(p * 2.0);
}

float scene(vec3 p) {
  vec3 p1 = rotate(p, vec3(1.0), time * 0.4);
  p1 = opTwist(p1, cos(time * 0.7));
  float sphere = sdSphere(p1, 1.5);

  float scale = 8.0 + 6.0 * sin(time * 0.5) + displacement(vec4(p, time * 0.5));
  float sine = (0.8 - sdSine(p1 * scale)) / (scale * 2.0);

  float distance = max(sphere, sine);

  return distance;
}

vec3 getNormal(vec3 p) {
  vec2 e = vec2(0.01, 0.0);

  vec3 n = scene(p) - vec3(scene(p - e.xyy), scene(p - e.yxy), scene(p - e.yyx));

  return normalize(n);
}

float raymarch(vec3 ro, vec3 rd, float side) {
  float dO = 0.0;
  vec3 color = vec3(0.0);
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
  vec3 L = vec3(0.2125, 0.7154, 0.0721);
  vec3 grayscale = vec3(dot(rgb, L));
  return mix(grayscale, rgb, intensity);
}

float fresnel(vec3 eyeVector, vec3 normal, float power) {
  float fresnelFactor = abs(dot(eyeVector, normal));
  float inversefresnelFactor = 1.0 - fresnelFactor;
  return pow(inversefresnelFactor, power);
}

float specular(vec3 light, float shininess, float diffuseness, vec3 normal, vec3 eyeVector) {
  vec3 lightVector = normalize(light);
  vec3 halfVector = normalize(lightVector + eyeVector);

  float NdotL = dot(normal, lightVector);
  float NdotH = dot(normal, halfVector);
  float kDiffuse = max(0.0, NdotL);
  float NdotH2 = NdotH * NdotH;

  float kSpecular = pow(NdotH2, 2000.0 / shininess);
  return kDiffuse * diffuseness + kSpecular;
}

const int LOOP = 16;

void main() {
  float iorRatioRed = 1.0 / iorR;
  float iorRatioGreen = 1.0 / iorG;
  float iorRatioBlue = 1.0 / iorB;
  float iorRatioY = 1.0 / iorY;
  float iorRatioC = 1.0 / iorC;
  float iorRatioP = 1.0 / iorP;
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;

  // Light Position
  vec3 lightPosition = vec3(-10.0, 10.0, 10.0);

  vec3 ro = vec3(0.0, 0.0, 5.0);
  vec3 rd = normalize(vec3(uv, -1.0));
  float d = raymarch(ro, rd, 1.0);
  vec3 p = ro + rd * d;

  vec4 color = texture(tex, vUv);
  color = texture(tex, vec2(vUv.x, 1.0 - vUv.y));

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

      vec2 flipUv = vec2(vUv.x, 1.0 - vUv.y);

      float r = texture(tex, flipUv - refractVecRed.xy * (refractPower + slide * 1.0) * chromaticAberration).r * 0.5;

      float y = (texture(tex, flipUv - refractVecY.xy * (refractPower + slide * 1.0) * chromaticAberration).x * 2.0 +
        texture(tex, flipUv - refractVecY.xy * (refractPower + slide * 1.0) * chromaticAberration).y * 2.0 -
        texture(tex, flipUv - refractVecY.xy * (refractPower + slide * 1.0) * chromaticAberration).z) / 6.0;

      float g = texture(tex, flipUv - refractVecGreen.xy * (refractPower + slide * 2.0) * chromaticAberration).g * 0.5;

      float c = (texture(tex, flipUv - refractVecC.xy * (refractPower + slide * 2.5) * chromaticAberration).y * 2.0 +
        texture(tex, flipUv - refractVecC.xy * (refractPower + slide * 2.5) * chromaticAberration).z * 2.0 -
        texture(tex, flipUv - refractVecC.xy * (refractPower + slide * 2.5) * chromaticAberration).x) / 6.0;

      float b = texture(tex, flipUv - refractVecBlue.xy * (refractPower + slide * 3.0) * chromaticAberration).b * 0.5;

      float p = (texture(tex, flipUv - refractVecP.xy * (refractPower + slide * 1.0) * chromaticAberration).z * 2.0 +
        texture(tex, flipUv - refractVecP.xy * (refractPower + slide * 1.0) * chromaticAberration).x * 2.0 -
        texture(tex, flipUv - refractVecP.xy * (refractPower + slide * 1.0) * chromaticAberration).y) / 6.0;

      float R = r + (2.0 * p + 2.0 * y - c) / 3.0;
      float G = g + (2.0 * y + 2.0 * c - p) / 3.0;
      float B = b + (2.0 * c + 2.0 * p - y) / 3.0;

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
    f = clamp(f, 0.0, 1.0);
    color.rgb += f * vec3(1.0);

    // Ensuring no channel goes above 1.0
    color.rgb = min(color.rgb, vec3(1.0));
  }

  fragColor = color;
}
