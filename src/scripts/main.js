import { Pane } from "tweakpane";
import Stats from "https://cdnjs.cloudflare.com/ajax/libs/stats.js/17/Stats.js";
import {
  createShader,
  createRenderTarget,
  createVbo,
  useShader,
  unuseShader,
  loadImage,
  createTexture,
} from "../utils/webglUtils";
import { plane } from "../utils/geometry";

// shaders
import vertShader from "../shaders/main.vert";
import cloudFragShader from "../shaders/cloud.frag";
import resultFragShader from "../shaders/result.frag";

let gl, canvas;
let quadVao;
let stats;

const params = {
  iorR: 1.15,
  iorY: 1.16,
  iorG: 1.18,
  iorC: 1.22,
  iorB: 1.22,
  iorP: 1.22,
  chromaticAberration: 1.0,
  refractPower: 0.8,
  fresnelPower: 8.0,
  saturation: 1.04,
  shininess: 30.0,
  diffuseness: 0.2,
  light: [6.0, 5.0, -15.0],
};

const timeInfo = {
  start: 0,
  prev: 0,
  delta: 0,
  elapsed: 0,
  frame: 0,
};

const renderSpec = {
  width: 0,
  height: 0,
  aspect: 1,
  array: new Float32Array(3),
  halfWidth: 0,
  halfHeight: 0,
  halfArray: new Float32Array(3),
};
renderSpec.setSize = function (w, h) {
  renderSpec.width = w;
  renderSpec.height = h;
  renderSpec.aspect = renderSpec.width / renderSpec.height;
  renderSpec.array[0] = renderSpec.width;
  renderSpec.array[1] = renderSpec.height;
  renderSpec.array[2] = renderSpec.aspect;

  renderSpec.halfWidth = Math.floor(w / 2);
  renderSpec.halfHeight = Math.floor(h / 2);
  renderSpec.halfArray[0] = renderSpec.halfWidth;
  renderSpec.halfArray[1] = renderSpec.halfHeight;
  renderSpec.halfArray[2] = renderSpec.halfWidth / renderSpec.halfHeight;
};

let sceneStandBy = true;

const clouds = {};
const result = {};
async function createScene() {
  const img = await loadImage("noise.png");
  clouds.texture = createTexture(gl, img);
  const blueNoise = await loadImage("bluenoise.png");
  clouds.blueNoise = createTexture(gl, blueNoise);

  const geometry = plane(2.0, 2.0, [1.0, 0.0, 0.0, 1.0]);
  const vbos = [
    createVbo(gl, geometry.position, gl.STATIC_DRAW),
    createVbo(gl, geometry.texCoord, gl.STATIC_DRAW),
  ];

  quadVao = gl.createVertexArray();
  gl.bindVertexArray(quadVao);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbos[0]);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(0);
  gl.bindBuffer(gl.ARRAY_BUFFER, vbos[1]);
  gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 0, 0);
  gl.enableVertexAttribArray(1);
  gl.bindVertexArray(null);

  clouds.program = createShader(
    gl,
    vertShader,
    cloudFragShader,
    ["time", "resolution", "noiseTex", "blueNoiseTex", "frame"],
    ["position", "uv"]
  );

  result.program = createShader(
    gl,
    vertShader,
    resultFragShader,
    [
      "tex",
      "resolution",
      "iorR",
      "iorG",
      "iorB",
      "iorY",
      "iorC",
      "iorP",
      "chromaticAberration",
      "refractPower",
      "fresnelPower",
      "saturation",
      "shininess",
      "diffuseness",
      "light",
    ],
    ["position", "uv"]
  );
}

function initScene() {}

function renderScene() {
  stats.begin();
  // 1. Render clouds
  gl.viewport(0, 0, renderSpec.width, renderSpec.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.bindVertexArray(quadVao);
  gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.wHalfRT.frameBuffer);
  useShader(gl, clouds.program);
  gl.uniform1f(clouds.program.uniforms.time, timeInfo.elapsed);
  gl.uniform2fv(clouds.program.uniforms.resolution, [
    renderSpec.halfWidth,
    renderSpec.halfHeight,
  ]);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, clouds.texture);
  gl.uniform1i(clouds.program.uniforms.noiseTex, 0);
  gl.activeTexture(gl.TEXTURE1);
  gl.bindTexture(gl.TEXTURE_2D, clouds.blueNoise);
  gl.uniform1i(clouds.program.uniforms.blueNoiseTex, 1);
  gl.uniform1i(clouds.program.uniforms.frame, timeInfo.frame);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  unuseShader(gl, clouds.program);

  // 2. Render result
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.viewport(0, 0, renderSpec.width, renderSpec.height);
  useShader(gl, result.program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, renderSpec.wHalfRT.texture);
  gl.uniform1i(result.program.uniforms.tex, 0);
  gl.uniform2fv(result.program.uniforms.resolution, [
    renderSpec.width,
    renderSpec.height,
  ]);
  gl.uniform1f(result.program.uniforms.iorR, params.iorR);
  gl.uniform1f(result.program.uniforms.iorG, params.iorG);
  gl.uniform1f(result.program.uniforms.iorB, params.iorB);
  gl.uniform1f(result.program.uniforms.iorY, params.iorY);
  gl.uniform1f(result.program.uniforms.iorC, params.iorC);
  gl.uniform1f(result.program.uniforms.iorP, params.iorP);
  gl.uniform1f(
    result.program.uniforms.chromaticAberration,
    params.chromaticAberration
  );
  gl.uniform1f(result.program.uniforms.refractPower, params.refractPower);
  gl.uniform1f(result.program.uniforms.fresnelPower, params.fresnelPower);
  gl.uniform1f(result.program.uniforms.saturation, params.saturation);
  gl.uniform1f(result.program.uniforms.shininess, params.shininess);
  gl.uniform1f(result.program.uniforms.diffuseness, params.diffuseness);
  gl.uniform3fv(result.program.uniforms.light, params.light);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  unuseShader(gl, result.program);

  gl.bindVertexArray(null);
  stats.end();
}

function render() {
  renderScene();
}

let animating = true;
function animate() {
  const curdate = new Date();
  timeInfo.elapsed = (curdate - timeInfo.start) / 1000.0;
  timeInfo.delta = (curdate - timeInfo.prev) / 1000.0;
  timeInfo.prev = curdate;
  timeInfo.frame++;

  if (animating) requestAnimationFrame(animate);
  render();
}

function setViewports() {
  renderSpec.setSize(gl.canvas.width, gl.canvas.height);

  gl.clearColor(0.02, 0.0, 0.05, 1.0);
  gl.clearDepth(1.0);
  gl.viewport(0, 0, renderSpec.width, renderSpec.height);

  const rtfunc = function (rtname, rtw, rth) {
    renderSpec[rtname] = createRenderTarget(gl, rtw, rth);
  };
  rtfunc("mainRT", renderSpec.width, renderSpec.height);
  rtfunc("wHalfRT", renderSpec.halfWidth, renderSpec.halfHeight);
}

function onResize(e) {
  makeCanvasFullScreen(document.getElementById("webgl"));
  setViewports();

  if (sceneStandBy) {
    createScene();
  }
}

function makeCanvasFullScreen(canvas) {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

window.addEventListener("load", async function (e) {
  canvas = document.getElementById("webgl");
  try {
    makeCanvasFullScreen(canvas);
    gl = canvas.getContext("webgl2");
  } catch (e) {
    alert("WebGL not supported." + e);
    console.error(e);
    return;
  }

  window.addEventListener("resize", onResize);

  stats = createStats();
  setViewports();
  createDebugPane();

  await createScene();
  initScene();

  timeInfo.start = new Date();
  timeInfo.prev = timeInfo.start;
  animate();
});

function createStats() {
  const stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);
  return stats;
}

function createDebugPane() {
  const pane = new Pane();
  const ior = pane.addFolder({ title: "ior", expanded: false });
  ior.addBinding(params, "iorR", { min: 1.0, max: 2.333, step: 0.001 });
  ior.addBinding(params, "iorG", { min: 1.0, max: 2.333, step: 0.001 });
  ior.addBinding(params, "iorB", { min: 1.0, max: 2.333, step: 0.001 });
  ior.addBinding(params, "iorY", { min: 1.0, max: 2.333, step: 0.001 });
  ior.addBinding(params, "iorC", { min: 1.0, max: 2.333, step: 0.001 });
  ior.addBinding(params, "iorP", { min: 1.0, max: 2.333, step: 0.001 });
  pane.addBinding(params, "chromaticAberration", {
    min: 0.0,
    max: 1.5,
    step: 0.01,
  });
  pane.addBinding(params, "refractPower", { min: 0.0, max: 1.0, step: 0.01 });
  pane.addBinding(params, "fresnelPower", { min: 1.0, max: 20.0, step: 0.01 });
  pane.addBinding(params, "saturation", { min: 1.0, max: 1.25, step: 0.01 });
  pane.addBinding(params, "shininess", { min: 1.0, max: 100.0, step: 0.1 });
  pane.addBinding(params, "diffuseness", { min: 0.0, max: 1.0, step: 0.01 });
}
