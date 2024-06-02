#version 300 es
precision highp float;

uniform sampler2D tex;
uniform vec2 uPPPixelSize;

in vec2 vUv;

out vec4 fragColor;

// source: https://github.com/unity3d-jp/NVIDIAHairWorksIntegration/blob/master/HairWorksIntegration/Assets/Standard%20Assets/Effects/ImageEffects/Shaders/_Antialiasing/FXAA2.shader

vec4 texOffset(sampler2D tex, vec2 uv, vec2 offsetPixel, vec2 resolutionInv) {

  return texture(tex, uv + offsetPixel * resolutionInv);

}

#define FXAA_REDUCE_MIN   ( 1.0 / 128.0 )
#define FXAA_REDUCE_MUL   ( 1.0 / 16.0 )
#define FXAA_SPAN_MAX    8.0

void main(void) {
  vec2 flippedVUv = vec2(vUv.x, 1.0f - vUv.y);
	/*--------------------------------------------------------------------------*/

  vec3 rgbNW = texOffset(tex, flippedVUv, vec2(-1.0f, 1.0f), uPPPixelSize).xyz;
  vec3 rgbNE = texOffset(tex, flippedVUv, vec2(1.0f, 1.0f), uPPPixelSize).xyz;
  vec3 rgbSW = texOffset(tex, flippedVUv, vec2(-1.0f, -1.0f), uPPPixelSize).xyz;
  vec3 rgbSE = texOffset(tex, flippedVUv, vec2(1.0f, -1.0f), uPPPixelSize).xyz;
  vec3 rgbM = texture(tex, flippedVUv).xyz;

	/*--------------------------------------------------------------------------*/

  vec3 luma = vec3(0.299f, 0.587f, 0.114f);

  float lumaNW = dot(rgbNW, luma);
  float lumaNE = dot(rgbNE, luma);
  float lumaSW = dot(rgbSW, luma);
  float lumaSE = dot(rgbSE, luma);
  float lumaM = dot(rgbM, luma);

	/*--------------------------------------------------------------------------*/

  float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
  float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

	/*--------------------------------------------------------------------------*/

  vec2 dir;
  dir.x = -((lumaNW + lumaNE) - (lumaSW + lumaSE));
  dir.y = ((lumaNW + lumaSW) - (lumaNE + lumaSE));

	/*--------------------------------------------------------------------------*/

  float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) * (0.25f * FXAA_REDUCE_MUL), FXAA_REDUCE_MIN);
  float rcpDirMin = 1.0f / (min(abs(dir.x), abs(dir.y)) + dirReduce);
  dir = min(vec2(FXAA_SPAN_MAX, FXAA_SPAN_MAX), max(vec2(-FXAA_SPAN_MAX, -FXAA_SPAN_MAX), dir * rcpDirMin)) * uPPPixelSize.xy;

	/*--------------------------------------------------------------------------*/

  vec3 rgbA = (1.0f / 2.0f) * (texture(tex, flippedVUv + dir * (1.0f / 3.0f - 0.5f)).xyz +
    texture(tex, flippedVUv + dir * (2.0f / 3.0f - 0.5f)).xyz);

  vec3 rgbB = rgbA * 0.5f + 0.25f * (texture(tex, flippedVUv + dir * -0.5f).xyz +
    texture(tex, flippedVUv + dir * 0.5f).xyz);

  float lumaB = dot(rgbB, luma);

  if((lumaB < lumaMin) || (lumaB > lumaMax)) {

    fragColor = vec4(rgbA, 1.0f);

  } else {

    fragColor = vec4(rgbB, 1.0f);

  };

    // fragColor = vec4( 0.0 );

}
