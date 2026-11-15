// FG STUDIO — The Creative District（樣本）
// 直接用 WebGPU，不用引擎；場景由程式生成，文字全部在 HTML。
import { WGSL, MAX_BOXES, MAX_LINES } from './shader.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#stage');
const qs = new URLSearchParams(location.search);
const MEDIA = '../media-library/';

// ---------- 場景：方塊（min, max, 材質）----------
// 材質：0 磚 1 石材 2 發光玻璃 3 影片螢幕 4 大廳後牆 5 工作站螢幕 6 黑金屬 7 接待螢幕 8 大廳天花
const boxes = [];
const box = (x0, y0, z0, x1, y1, z1, mat, par = 0) => boxes.push([x0, y0, z0, mat, x1, y1, z1, par]) - 1;
// 兩側前翼與後翼
box(-30, 0, 5, -10, 17, 46, 0); box(10, 0, 5, 30, 17, 46, 0);
box(-30, 0, -16, -7, 12.4, 5, 0); box(7, 0, -16, 30, 12.4, 5, 0);
// 發光玻璃量體、底部天花、大廳後牆
box(-7, 5.2, -12, 7, 12.6, 0, 2);
box(-7, 5.0, -12, 7, 5.2, 0.15, 8);
box(-7, 0, -12.4, 7, 5.0, -12, 4);
// 影片螢幕：左牆作品牆、右牆形象影片（par = 自己的索引，著色器用來讀尺寸）
let i = box(-10.0, 1.5, 10.5, -9.88, 7.3, 21.5, 3); boxes[i][7] = i;
i = box(9.88, 1.5, 10.5, 10.0, 7.69, 21.5, 3); boxes[i][7] = i;
// 螢幕外框
box(-10.0, 1.38, 10.38, -9.93, 7.42, 21.62, 6); box(9.93, 1.38, 10.38, 10.0, 7.81, 21.62, 6);
// 長凳
for (const s of [-1, 1]) {
  box(Math.min(s * 7.4, s * 8.6), 0.40, 12.5, Math.max(s * 7.4, s * 8.6), 0.52, 19.5, 1); // 石板座面
  box(Math.min(s * 7.55, s * 8.45), 0, 12.7, Math.max(s * 7.55, s * 8.45), 0.40, 19.3, 6);   // 內縮的底座
}
// 接待櫃檯、櫃檯上的服務螢幕
box(-4.6, 0.1, 1.6, 4.6, 1.12, 3.0, 1);
i = box(2.3, 1.2, 2.2, 3.2, 1.72, 2.24, 7); boxes[i][7] = i;
box(2.71, 1.12, 2.24, 2.79, 1.3, 2.28, 6);
// 大廳入口的直框
for (const x of [-6.9, 6.9]) box(x - 0.03, 0, -0.3, x + 0.03, 5.0, -0.22, 6);
// GVS 作業中心：長桌、六座工作站的螢幕。這一段排在最後，著色器可以整段跳過
const nOuter = boxes.length;
box(-5.6, 0.70, -9.4, 5.6, 0.76, -8.3, 1);
box(-5.5, 0, -9.3, -5.38, 0.7, -8.4, 6); box(5.38, 0, -9.3, 5.5, 0.7, -8.4, 6);
for (let k = 0; k < 6; k++) {
  const x = -4.5 + k * 1.8;
  i = box(x - 0.55, 0.92, -9.0, x + 0.55, 1.56, -8.95, 5); boxes[i][7] = i;
  box(x - 0.04, 0.76, -9.03, x + 0.04, 0.95, -8.99, 6);
  // 椅子不是方塊：由著色器的距離場繪製（shader.js 的 chairs()）
}

// ---------- 線光源 [ax,ay,az,強度, bx,by,bz,光暈（負值=冷色）] ----------
const lines = [];
for (const z of [7, 11, 15, 19, 23, 27, 31]) { const hl = 2.0 + 0.21 * z; lines.push([-hl, 0.03, z, 0.7, hl, 0.03, z, 0.28]); }
lines.push([-4.5, 0.06, 3.06, 2.2, 4.5, 0.06, 3.06, 0.9]);             // 櫃檯底
lines.push([-8.55, 0.08, 12.5, 0.9, -8.55, 0.08, 19.5, 0.35], [8.55, 0.08, 12.5, 0.9, 8.55, 0.08, 19.5, 0.35]); // 長凳底
for (const z of [-2.6, -6.5, -10.4]) lines.push([-5.2, 4.96, z, 1.2, 5.2, 4.96, z, 0.6]); // 大廳天花
lines.push([-5.3, 0.05, -9.25, 1.1, 5.3, 0.05, -9.25, 0.3]);            // 長桌底
// 「BEYOND THE FRAME」：大廳入口的冷色光框，鏡頭會穿過它
{ const z = 0.45, w = 7.0, y0 = 0.04, y1 = 5.22, I = 0.5, H = -1.0;
  lines.push([-w, y0, z, I, w, y0, z, H], [-w, y1, z, I, w, y1, z, H], [-w, y0, z, I, -w, y1, z, H], [w, y0, z, I, w, y1, z, H]); }

// ---------- 鏡頭路徑 ----------
// 停靠點：0 總覽 1 形象影片（右牆）2 作品牆（左牆）3 GVS 作業中心 4 接待櫃檯
const KEYS = [
  { t: 0.0, p: [0, 3.0, 41], l: [0, 2.7, 0] },
  { t: 0.5, p: [-1.0, 2.3, 33], l: [4, 4.6, 6] },
  { t: 1.0, p: [-3.5, 2.2, 25.5], l: [10, 4.8, 12.5] },
  { t: 2.0, p: [4.6, 2.2, 25.0], l: [-10, 5.0, 19.5] },
  { t: 2.55, p: [5.9, 1.9, 4.5], l: [1.5, 1.6, -7] },
  { t: 3.0, p: [0, 1.7, -1.2], l: [0, 1.3, -9] },
  { t: 3.5, p: [-5.9, 2.0, 4.0], l: [-1.5, 1.4, 1.0] },
  { t: 4.0, p: [0.0, 0.9, 8.0], l: [0.8, 1.25, 2.3] },
];
const STOPS = 4;
const cr = (a, b, c, d, t) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
function camAt(T) {
  let k = 0; while (k < KEYS.length - 2 && T > KEYS[k + 1].t) k++;
  const a = KEYS[Math.max(k - 1, 0)], b = KEYS[k], c = KEYS[k + 1], d = KEYS[Math.min(k + 2, KEYS.length - 1)];
  const f = Math.min(Math.max((T - b.t) / (c.t - b.t), 0), 1);
  const v = (key) => [0, 1, 2].map((j) => cr(a[key][j], b[key][j], c[key][j], d[key][j], f));
  return { p: v('p'), l: v('l') };
}
const ease = (x) => x * x * x * (x * (6 * x - 15) + 10);
const settle = (T) => { const s = Math.min(Math.floor(T), STOPS - 1), f = T - s; return s + ease(Math.min(Math.max((f - 0.08) / 0.84, 0), 1)); };

// ---------- 影片圖集 ----------
const AT = { w: 1024, h: 1136, split: 540, right: 560 };
const atlas = document.createElement('canvas'); atlas.width = AT.w; atlas.height = AT.h;
const actx = atlas.getContext('2d');
const WALL = ['ueis-thanksgiving-trailer-2026', 'sg-01-waterproof-protector', 'sleepygulls-brand-film', 'ys-04-tuning-like-violin', 'ueis-milk-protein-lab', 'sg-04-mattress-sagging'];
const slots = WALL.map((id, k) => ({ id, x: (k % 3) * (AT.w / 3), y: Math.floor(k / 3) * (AT.split / 2), w: AT.w / 3, h: AT.split / 2 }));
slots.push({ id: 'welcome-to-fg-gvs', x: 0, y: AT.right, w: AT.w, h: AT.h - AT.right });
function cover(src, sw, sh, s) {
  if (!sw || !sh) return;
  const r = Math.max(s.w / sw, s.h / sh), cw = s.w / r, ch = s.h / r;
  actx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, s.x, s.y, s.w, s.h);
}
actx.fillStyle = '#05070c'; actx.fillRect(0, 0, AT.w, AT.h);
let atlasDirty = true;
for (const s of slots) {
  const img = new Image(); img.onload = () => { if (!s.live) { cover(img, img.naturalWidth, img.naturalHeight, s); atlasDirty = true; } };
  img.src = `${MEDIA}posters/${s.id}.jpg`;
  if (qs.has('still')) continue;
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto'; v.src = `${MEDIA}previews/${s.id}.mp4`;
  v.addEventListener('playing', () => { s.live = true; });
  v.play().catch(() => {});
  s.v = v;
}
function drawAtlas() {
  for (const s of slots) if (s.live && s.v.readyState >= 2) { cover(s.v, s.v.videoWidth, s.v.videoHeight, s); atlasDirty = true; }
}

// ---------- HTML 介面 ----------
const panels = [...document.querySelectorAll('.panel')];
const dots = [...document.querySelectorAll('.rail button')];
const labels = [...document.querySelectorAll('.wl')].map((el) => ({
  el, o: el.dataset.o.split(',').map(Number), r: el.dataset.r.split(',').map(Number), s: +el.dataset.s, stops: (el.dataset.stops || '').split(',').filter(Boolean).map(Number),
}));
const vh = () => innerHeight;
const SEG = 1.25; // 每一站的捲動長度（倍螢幕高）
const setHeight = () => { $('#track').style.height = `${(STOPS * SEG + 1) * 100}vh`; };
setHeight();
const scrollT = () => Math.min(Math.max(scrollY / (SEG * vh()), 0), STOPS);
const goto = (s) => scrollTo({ top: s * SEG * vh() + 1, behavior: 'smooth' });
dots.forEach((b, k) => b.addEventListener('click', () => goto(k)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => goto(+b.dataset.go)));
addEventListener('keydown', (e) => {
  const s = Math.round(scrollT());
  if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); goto(Math.min(s + 1, STOPS)); }
  if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); goto(Math.max(s - 1, 0)); }
});

// 形象影片燈箱
const lb = $('#lightbox'), lbv = $('#lightbox video');
document.querySelectorAll('[data-film]').forEach((b) => b.addEventListener('click', () => { lbv.src = `${MEDIA}${b.dataset.film}`; lb.hidden = false; lbv.play().catch(() => {}); }));
const closeLb = () => { lb.hidden = true; lbv.pause(); lbv.removeAttribute('src'); lbv.load(); };
lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.x')) closeLb(); });
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !lb.hidden) closeLb(); });

let mx = 0, my = 0;
addEventListener('pointermove', (e) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; });

let introK = 1; // 開場鏡頭的進度：0 最遠，1 就定位
function ui(T) {
  const s = Math.round(T), near = 1 - Math.min(Math.abs(T - s) * 3.2, 1);
  panels.forEach((p, k) => { const on = k === s && near > 0.25 && (k !== 0 || introK > 0.82); p.classList.toggle('on', on); p.style.setProperty('--k', k === s ? near : 0); });
  dots.forEach((d, k) => d.classList.toggle('on', k === s));
  document.body.dataset.stop = s;
}

// ---------- 啟動 ----------
function fallback(msg) {
  document.body.classList.add('nogpu'); introK = 1;
  console.warn('WebGPU unavailable:', msg);
  const loop = () => { ui(scrollT()); requestAnimationFrame(loop); }; loop();
}

async function start() {
  if (!navigator.gpu || qs.has('nogpu')) return fallback('no navigator.gpu'); // ?nogpu：強制看靜態版本
  const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
  if (!adapter) return fallback('no adapter');
  const device = await adapter.requestDevice();
  window.__gpu = device; // 保留參照，避免被回收
  device.lost.then((i) => { console.warn('device lost:', i.reason, i.message); if (!dead) { dead = true; fallback('device lost'); } });
  device.addEventListener('uncapturederror', (e) => console.error('GPU error:', e.error.message));
  // ?offscreen：畫到離屏材質再讀回 2D 畫布，給沒有顯示卡、無法呈現 WebGPU 畫布的環境截圖用
  const OFF = qs.has('offscreen');
  const format = OFF ? 'rgba8unorm' : navigator.gpu.getPreferredCanvasFormat();
  const ctx = OFF ? canvas.getContext('2d') : canvas.getContext('webgpu');
  if (!OFF) ctx.configure({ device, format, alphaMode: 'opaque' });

  const module = device.createShaderModule({ code: WGSL });
  const info = await module.getCompilationInfo();
  const errs = info.messages.filter((m) => m.type === 'error');
  if (errs.length) { console.error(errs.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n')); return fallback('shader'); }
  const pipeline = await device.createRenderPipelineAsync({
    layout: 'auto', vertex: { module, entryPoint: 'vs' }, fragment: { module, entryPoint: 'fs', targets: [{ format }] }, primitive: { topology: 'triangle-list' },
  });

  const HEAD = 28, data = new Float32Array(HEAD + MAX_BOXES * 8 + MAX_LINES * 8);
  boxes.forEach((b, k) => data.set(b, HEAD + k * 8));
  lines.forEach((l, k) => data.set(l, HEAD + MAX_BOXES * 8 + k * 8));
  const ubuf = device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
  const tex = device.createTexture({ size: [AT.w, AT.h], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
  const smp = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
  const bind = device.createBindGroup({ layout: pipeline.getBindGroupLayout(0), entries: [{ binding: 0, resource: { buffer: ubuf } }, { binding: 1, resource: tex.createView() }, { binding: 2, resource: smp }] });

  // 依幀時間調整解析度
  // 解析度倍率：最高 1.5（一倍螢幕上等於超取樣，當成抗鋸齒），太慢就往下降
  const SS = 1.5, MIN = 0.45;
  let scale = qs.has('scale') ? +qs.get('scale') : Math.min(devicePixelRatio, SS), acc = 0, frames = 0, best = 1e9, cool = 0, coolN = 20, slowN = 0, dead = false;
  const fixedScale = qs.has('scale');
  let W = 0, H = 0;
  function resize() {
    W = innerWidth; H = innerHeight;
    canvas.width = Math.max(2, Math.round(W * scale)); canvas.height = Math.max(2, Math.round(H * scale));
  }
  addEventListener('resize', () => { resize(); setHeight(); }); resize();

  const fixedT = qs.has('t') ? +qs.get('t') : null;
  // 開場（由遠推近、燈依序亮起）：固定站點、減少動態效果、或一進來就不在頂端時略過
  const noIntro = fixedT != null || qs.has('nointro') || matchMedia('(prefers-reduced-motion: reduce)').matches || scrollT() > 0.05;
  let Ts = fixedT ?? scrollT(), t0 = performance.now(), last = t0, tI = noIntro ? 99 : 0;
  introK = noIntro ? 1 : 0;
  window.__ready = false;

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.1); last = now;
    const time = qs.has('time') ? +qs.get('time') : (now - t0) / 1000;
    const target = fixedT ?? scrollT();
    Ts += (target - Ts) * (fixedT != null ? 1 : 1 - Math.exp(-dt * 4.2));
    tI += dt * (scrollT() > 0.03 ? 5 : 1); // 一捲動就快轉
    const sm = (x) => ease(Math.min(Math.max(x, 0), 1));
    const warmOn = sm((tI - 0.3) / 1.8), glassOn = sm((tI - 1.6) / 2.4);
    introK = 1 - Math.pow(1 - Math.min(tI / 6, 1), 3);
    const T = settle(Ts);
    ui(Ts);

    // 鏡頭
    const c = camAt(T), aspect = W / H;
    const far = (1 - introK) * Math.max(1 - T, 0);
    c.p[2] += 30 * far; c.p[1] += 2.2 * far; c.l[1] += 1.6 * far;
    const tall = Math.min(Math.max(1 / aspect - 1, 0), 1.2);
    // 直式螢幕：首頁少一點天空；櫃檯那一站退後、右移、視角收窄，櫃檯上的字才放得進畫面
    // 形象影片那一站往左退、往右看，整面螢幕才放得進；作業中心退到門口並放寬視角，六座都入鏡
    const k1 = tall * Math.max(1 - Math.abs(T - 1), 0), k3 = Math.max(1 - Math.abs(T - 3), 0), k4 = Math.min(Math.max(T - 3, 0), 1), t4 = tall * k4;
    c.l[1] -= tall * 1.6 * Math.max(1 - T, 0) + t4 * 0.55;
    c.p[0] += t4 * 1.5 - k1 * 1.5; c.l[0] += t4 * 1.2; c.p[2] += t4 * 0.9 + tall * k3 * 1.6; c.l[2] += k1 * 2.5;
    const hfov = (27 + 6 * k3 - 6 * k4) * Math.PI / 180;
    const tanH = Math.max(Math.tan(24 * Math.PI / 180), Math.tan(hfov) / aspect);
    const sway = fixedT != null ? 0 : 1;
    const p = [c.p[0] + mx * 0.5 * sway, c.p[1] - my * 0.25 * sway + Math.sin(time * 0.4) * 0.03 * sway, c.p[2]];
    let f = [c.l[0] - p[0], c.l[1] - p[1], c.l[2] - p[2]]; const fl = Math.hypot(...f); f = f.map((x) => x / fl);
    let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map((x) => x / rl);
    const up = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];

    data.set([p[0], p[1], p[2], time, f[0], f[1], f[2], tanH, r[0], r[1], r[2], aspect, up[0], up[1], up[2], warmOn,
      canvas.width, canvas.height, boxes.length, lines.length, T, AT.split / AT.h, AT.right / AT.h, 0, nOuter, glassOn, 0, 0]);
    device.queue.writeBuffer(ubuf, 0, data);
    drawAtlas();
    if (atlasDirty && !qs.has('noatlas')) { device.queue.copyExternalImageToTexture({ source: atlas }, { texture: tex }, [AT.w, AT.h]); atlasDirty = false; }

    const enc = device.createCommandEncoder();
    const cw = canvas.width, chh = canvas.height;
    const rt = OFF ? device.createTexture({ size: [cw, chh], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }) : null;
    const pass = enc.beginRenderPass({ colorAttachments: [{ view: (OFF ? rt : ctx.getCurrentTexture()).createView(), loadOp: 'clear', storeOp: 'store', clearValue: [0, 0, 0, 1] }] });
    pass.setPipeline(pipeline); pass.setBindGroup(0, bind); pass.draw(3); pass.end();
    let rb = null; const bpr = Math.ceil(cw * 4 / 256) * 256;
    if (OFF) { rb = device.createBuffer({ size: bpr * chh, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); enc.copyTextureToBuffer({ texture: rt }, { buffer: rb, bytesPerRow: bpr }, [cw, chh]); }
    device.queue.submit([enc.finish()]);
    if (OFF) rb.mapAsync(GPUMapMode.READ).then(() => {
      const src = new Uint8Array(rb.getMappedRange()), img = ctx.createImageData(cw, chh);
      for (let y = 0; y < chh; y++) img.data.set(src.subarray(y * bpr, y * bpr + cw * 4), y * cw * 4);
      ctx.putImageData(img, 0, 0); rb.unmap(); rb.destroy(); rt.destroy(); window.__done = true;
    });

    // 貼在牆面與櫃檯上的 HTML 標示：用同一台鏡頭做透視
    const kx = (W / 2) / (tanH * aspect), ky = (H / 2) / tanH;
    const row = (a, b, k, d) => ({ v: [a[0] * k + b[0] * d, a[1] * k + b[1] * d, a[2] * k + b[2] * d] });
    const X = row(r, f, kx, W / 2).v, Y = row(up, f, -ky, H / 2).v, Wv = f;
    const dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const s = Math.round(Ts);
    for (const L of labels) {
      const A = L.r.map((x) => x * L.s), B = [0, -L.s, 0], O = [L.o[0] - p[0], L.o[1] - p[1], L.o[2] - p[2]];
      const w = dotp(Wv, O);
      const show = w > 0.6 && (!L.stops.length || L.stops.includes(s));
      L.el.style.opacity = show ? 1 : 0;
      if (w <= 0.6) continue;
      const m = [dotp(X, A), dotp(Y, A), 0, dotp(Wv, A), dotp(X, B), dotp(Y, B), 0, dotp(Wv, B), 0, 0, 1, 0, dotp(X, O), dotp(Y, O), 0, w];
      L.el.style.transform = `matrix3d(${m.map((x) => x.toFixed(5)).join(',')})`;
    }

    if (!fixedScale) { // 太慢就降解析度，夠快再升回來
      acc += dt; frames++;
      if (frames >= 30) {
        const ms = acc / frames * 1000; acc = 0; frames = 0;
        // best：看過最短的每格時間，約等於螢幕的更新間隔。掉到 45 幀以下就降；貼著更新間隔跑就試著升，
        // 升了又掉回來的話，下次等久一點再試
        best = Math.min(best, ms); if (cool > 0) cool--;
        if (ms > Math.max(Math.min(best, 16.7) * 1.3, 20) && scale > MIN) { scale = Math.max(MIN, scale * 0.85); cool = coolN; coolN = Math.min(coolN * 2, 320); resize(); }
        else if (ms < best * 1.12 && cool === 0 && scale < SS) { scale = Math.min(SS, scale * 1.1); resize(); }
        // 降到最低解析度還是不到 20 幀，連續三次就換成靜態版本
        if (scale <= MIN && ms > 50) { if (++slowN >= 3) { dead = true; fallback('too slow'); } } else slowN = 0;
      }
    }
    if (!window.__ready) { window.__ready = true; document.body.classList.add('ready'); }
    if (qs.has('once')) { if (!OFF) device.queue.onSubmittedWorkDone().then(() => { window.__done = true; }); return; }
    if (!dead) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start().catch((e) => fallback(e.message));
