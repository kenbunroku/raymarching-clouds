export function loadImage(path) {
  return new Promise((resolve, reject) => {
    // Add reject here
    // Image オブジェクトの生成
    const img = new Image();
    // ロード完了を検出したいので、先にイベントを設定する
    img.addEventListener(
      "load",
      () => {
        // 画像を引数に Promise を解決する
        resolve(img);
      },
      false
    );

    img.addEventListener(
      "error",
      (err) => {
        reject(new Error(`Failed to load image at path: ${path}`));
      },
      false
    );

    // 読み込む画像のパスを設定する
    img.src = path;
  });
}

export function createTexture(gl, resource) {
  // テクスチャオブジェクトを生成
  const texture = gl.createTexture();
  // アクティブなテクスチャユニット番号を指定する
  gl.activeTexture(gl.TEXTURE0);
  // テクスチャをアクティブなユニットにバインドする
  gl.bindTexture(gl.TEXTURE_2D, texture);
  // バインドしたテクスチャにデータを割り当て
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, resource);
  // ミップマップを自動生成する
  gl.generateMipmap(gl.TEXTURE_2D);
  // テクスチャパラメータを設定する
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    gl.NEAREST_MIPMAP_LINEAR
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  // 安全の為にテクスチャのバインドを解除してから返す
  gl.bindTexture(gl.TEXTURE_2D, null);
  return texture;
}

export function createRenderTarget(gl, w, h) {
  const ret = {
    width: w,
    height: h,
    sizeArray: new Float32Array([w, h, w / h]),
    dtxArray: new Float32Array([1.0 / w, 1.0 / h]),
  };
  ret.frameBuffer = gl.createFramebuffer();
  ret.renderBuffer = gl.createRenderbuffer();
  ret.texture = gl.createTexture();

  gl.bindTexture(gl.TEXTURE_2D, ret.texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    w,
    h,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);

  gl.bindFramebuffer(gl.FRAMEBUFFER, ret.frameBuffer);
  gl.framebufferTexture2D(
    gl.FRAMEBUFFER,
    gl.COLOR_ATTACHMENT0,
    gl.TEXTURE_2D,
    ret.texture,
    0
  );

  gl.bindRenderbuffer(gl.RENDERBUFFER, ret.renderBuffer);
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
  gl.framebufferRenderbuffer(
    gl.FRAMEBUFFER,
    gl.DEPTH_ATTACHMENT,
    gl.RENDERBUFFER,
    ret.renderBuffer
  );

  gl.bindTexture(gl.TEXTURE_2D, null);
  gl.bindRenderbuffer(gl.RENDERBUFFER, null);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  return ret;
}

export function deleteRenderTarget(gl, rt) {
  gl.deleteFramebuffer(rt.frameBuffer);
  gl.deleteRenderbuffer(rt.renderBuffer);
  gl.deleteTexture(rt.texture);
}

function _compileShader(gl, shtype, shsrc) {
  var retsh = gl.createShader(shtype);

  gl.shaderSource(retsh, shsrc);
  gl.compileShader(retsh);

  if (!gl.getShaderParameter(retsh, gl.COMPILE_STATUS)) {
    var errlog = gl.getShaderInfoLog(retsh);
    gl.deleteShader(retsh);
    console.error(errlog);
    return null;
  }
  return retsh;
}

export function createShader(gl, vtxsrc, frgsrc, uniformlist, attrlist) {
  const vsh = _compileShader(gl, gl.VERTEX_SHADER, vtxsrc);
  const fsh = _compileShader(gl, gl.FRAGMENT_SHADER, frgsrc);

  if (vsh == null || fsh == null) {
    return null;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, vsh);
  gl.attachShader(prog, fsh);

  gl.deleteShader(vsh);
  gl.deleteShader(fsh);

  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    const errlog = gl.getProgramInfoLog(prog);
    console.error(errlog);
    return null;
  }

  if (uniformlist) {
    prog.uniforms = {};
    for (let i = 0; i < uniformlist.length; i++) {
      prog.uniforms[uniformlist[i]] = gl.getUniformLocation(
        prog,
        uniformlist[i]
      );
    }
  }

  if (attrlist) {
    prog.attributes = {};
    for (let i = 0; i < attrlist.length; i++) {
      const attr = attrlist[i];
      prog.attributes[attr] = gl.getAttribLocation(prog, attr);
    }
  }

  return prog;
}

export function useShader(gl, prog) {
  gl.useProgram(prog);
  for (const attr in prog.attributes) {
    gl.enableVertexAttribArray(prog.attributes[attr]);
  }
}

export function unuseShader(gl, prog) {
  for (const attr in prog.attributes) {
    gl.disableVertexAttribArray(prog.attributes[attr]);
  }
  gl.useProgram(null);
}

export const createVbo = (gl, data, usage) => {
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), usage);
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  return vbo;
};
