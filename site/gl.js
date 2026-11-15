// FG STUDIO — The Creative District
// WebGL2 繪製：給沒有 WebGPU 的瀏覽器。流程與 main.js 的 WebGPU 版一樣——
// 先把場景上下顛倒畫成倒影圖，再畫主畫面（先只寫深度、椅子、深度相等才上色、天空、最後疊玻璃板），都是 4 倍抗鋸齒。
import { GLSL } from './shader-gl.js';

// geo：{ V, I, nIdxOuter, nIdxBoxes, nIdxMain, nIdxGlass0, nIdxGlass }；回傳 null 表示這台裝置不能用
export async function initGL(canvas, geo, atlas, AT, onLost) {
  const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance' });
  if (!gl) return null;
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); onLost(); });
  const hdr = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
  const par = gl.getExtension('KHR_parallel_shader_compile');

  // ---- 著色器：五支程式。先全部送出編譯，再一起等（有平行編譯的瀏覽器不會卡住畫面）----
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const mk = (vs, fs) => {
    const p = gl.createProgram(), a = sh(gl.VERTEX_SHADER, vs), b = sh(gl.FRAGMENT_SHADER, fs);
    gl.attachShader(p, a); gl.attachShader(p, b); gl.linkProgram(p);
    return { p, a, b };
  };
  const progs = {
    pre: mk(GLSL.vsBox, GLSL.fsPre), box: mk(GLSL.vsBox, GLSL.fsBox), chair: mk(GLSL.vsBox, GLSL.fsChair),
    glass: mk(GLSL.vsBox, GLSL.fsGlass), sky: mk(GLSL.vsSky, GLSL.fsSky),
  };
  if (par) {
    const all = Object.values(progs);
    while (!all.every((x) => gl.getProgramParameter(x.p, par.COMPLETION_STATUS_KHR))) await new Promise((r) => setTimeout(r, 30));
  }
  for (const [name, x] of Object.entries(progs)) {
    if (gl.getProgramParameter(x.p, gl.LINK_STATUS)) continue;
    console.error(`WebGL shader "${name}":`, gl.getShaderInfoLog(x.a) || '', gl.getShaderInfoLog(x.b) || '', gl.getProgramInfoLog(x.p) || '');
    return null;
  }
  const P = {};
  for (const [name, x] of Object.entries(progs)) {
    const p = P[name] = x.p; gl.useProgram(p);
    const bi = gl.getUniformBlockIndex(p, 'U'); if (bi !== gl.INVALID_INDEX) gl.uniformBlockBinding(p, bi, 0);
    const t = gl.getUniformLocation(p, 'tex'), r = gl.getUniformLocation(p, 'refl');
    if (t) gl.uniform1i(t, 0); if (r) gl.uniform1i(r, 1);
  }

  // ---- 幾何 ----
  const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geo.V), gl.STATIC_DRAW);
  for (let k = 0; k < 3; k++) { gl.enableVertexAttribArray(k); gl.vertexAttribPointer(k, 3, gl.FLOAT, false, 36, k * 12); }
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(geo.I), gl.STATIC_DRAW);

  // ---- 每格更新的資料：主畫面一份、倒影一份 ----
  const mkU = () => gl.createBuffer(), ubo = mkU(), uboM = mkU();
  let uSize = 0;
  const setU = (b, data) => {
    gl.bindBuffer(gl.UNIFORM_BUFFER, b);
    if (uSize !== data.byteLength) gl.bufferData(gl.UNIFORM_BUFFER, data, gl.DYNAMIC_DRAW); else gl.bufferSubData(gl.UNIFORM_BUFFER, 0, data);
  };

  // ---- 材質：影片圖集、空白（畫倒影時佔位用）----
  const mkTex = () => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
    return t;
  };
  const tex = mkTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, AT.w, AT.h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const blank = mkTex(); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array(4));

  // ---- 依畫布大小配置：多重取樣的顏色與深度（主畫面、倒影），各自再接一張一般材質收結果 ----
  const MS = Math.min(4, gl.getParameter(gl.MAX_SAMPLES));
  let T = null, reflFmt = hdr ? gl.RGBA16F : gl.RGBA8;
  const rb = (fmt, w, h) => { const r = gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER, r); gl.renderbufferStorageMultisample(gl.RENDERBUFFER, MS, fmt, w, h); return r; };
  const target = (fmt, w, h) => { // 回傳 { ms: 多重取樣的畫框, out: 收結果的畫框, tex }
    const c = rb(fmt, w, h), d = rb(gl.DEPTH_COMPONENT24, w, h), ms = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, ms);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.RENDERBUFFER, c);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, d);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    const t = mkTex(); gl.texStorage2D(gl.TEXTURE_2D, 1, fmt, w, h);
    const out = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, out);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0);
    const ok2 = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    const free = () => { gl.deleteRenderbuffer(c); gl.deleteRenderbuffer(d); gl.deleteFramebuffer(ms); gl.deleteFramebuffer(out); gl.deleteTexture(t); };
    return { ms, out, tex: t, ok: ok && ok2, free };
  };
  function targets(w, h, rs) {
    const rw = Math.max(2, Math.round(w * rs)), rh = Math.max(2, Math.round(h * rs));
    if (T && T.w === w && T.h === h && T.rw === rw) return T;
    if (T) { T.main.free(); T.refl.free(); }
    const main = target(gl.RGBA8, w, h);
    let refl = target(reflFmt, rw, rh);
    if (!refl.ok && reflFmt !== gl.RGBA8) { refl.free(); reflFmt = gl.RGBA8; refl = target(reflFmt, rw, rh); } // 半浮點畫不上去的裝置：倒影改用一般格式
    T = { w, h, rw, rh, main, refl };
    return T;
  }
  const resolve = (from, to, w, h) => {
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, from); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, to);
    gl.blitFramebuffer(0, 0, w, h, 0, 0, w, h, gl.COLOR_BUFFER_BIT, gl.NEAREST);
  };

  gl.disable(gl.DITHER); gl.disable(gl.CULL_FACE); gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 1); gl.clearDepth(1);
  gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const state = (prog, func, write) => { gl.useProgram(prog); gl.depthFunc(func); gl.depthMask(write); };
  const idx = (n, first = 0) => gl.drawElements(gl.TRIANGLES, n, gl.UNSIGNED_SHORT, first * 2);
  const begin = (fb, w, h, u, reflTex) => {
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.viewport(0, 0, w, h);
    gl.depthMask(true); gl.colorMask(true, true, true, true); gl.disable(gl.BLEND);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.bindBufferBase(gl.UNIFORM_BUFFER, 0, u);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, reflTex);
  };

  // data：main.js 每格填好的那一份（主畫面用）。o：{ hq, glass, atlasDirty, rs }
  function draw(data, o) {
    const w = canvas.width, h = canvas.height, G = targets(w, h, o.rs);
    setU(ubo, data);
    data[16] = G.rw; data[17] = G.rh; data[28] = 1; setU(uboM, data); uSize = data.byteLength; // 倒影那一份：解析度換成倒影圖的大小
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex);
    if (o.atlasDirty) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
    gl.bindVertexArray(vao);

    // 一、地面倒影：場景上下顛倒畫一次。高畫質連作業中心的小件一起倒映，低畫質只倒映大件
    begin(G.refl.ms, G.rw, G.rh, uboM, blank);
    state(P.box, gl.LESS, true); idx(o.hq ? geo.nIdxBoxes : geo.nIdxOuter);
    state(P.sky, gl.LEQUAL, false); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (o.glass && o.hq) { gl.enable(gl.BLEND); state(P.glass, gl.LESS, false); idx(geo.nIdxGlass, geo.nIdxGlass0); }
    resolve(G.refl.ms, G.refl.out, G.rw, G.rh);

    // 二、主畫面
    begin(G.main.ms, w, h, ubo, G.refl.tex);
    gl.colorMask(false, false, false, false); state(P.pre, gl.LESS, true); idx(geo.nIdxMain);
    gl.colorMask(true, true, true, true); state(P.chair, gl.LESS, true); idx(36, geo.nIdxMain);
    state(P.box, gl.EQUAL, false); idx(geo.nIdxMain);
    state(P.sky, gl.LEQUAL, false); gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (o.glass) { gl.enable(gl.BLEND); state(P.glass, gl.LESS, false); idx(geo.nIdxGlass, geo.nIdxGlass0); } // 半透明的玻璃板疊在最上面
    resolve(G.main.ms, G.main.out, w, h);
    resolve(G.main.out, null, w, h);
  }
  return { draw, info: () => ({ api: 'webgl2', samples: MS, refl: reflFmt === gl.RGBA16F ? 'rgba16f' : 'rgba8' }) };
}
