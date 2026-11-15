// FG STUDIO — The Creative District
// 著色器（WGSL）。場景完全由程式生成：方塊清單與線光源由 main.js 傳入。
// 方塊與地面是三角形繪製（4 倍抗鋸齒）；材質、燈光、光暈逐像素計算；
// 椅子保留距離場，只在椅子那一排的外框範圍裡步進；地面倒影是把場景上下顛倒再畫一次。
export const MAX_BOXES = 112;
export const MAX_LINES = 24;

export const WGSL = /* wgsl */ `
struct Box { a: vec4f, b: vec4f }
struct Line { a: vec4f, b: vec4f }
struct U {
  camPos: vec4f,   // xyz, w = time
  camF: vec4f,     // xyz, w = tan(fovY/2)
  camR: vec4f,     // xyz, w = aspect
  camU: vec4f,     // xyz, w = power-on 0..1
  res: vec4f,      // w, h, nBoxes, nLines
  fx: vec4f,       // x = focus stop (0..4), y = atlas split v, z = atlas right v0, w = unused
  ex: vec4f,       // x = 前段（大件）方塊數, y = 玻璃量體亮度 0..1, z = 畫質（1 高、0 低）
  misc: vec4f,     // x = 1 表示正在畫地面倒影（場景上下顛倒）, y = 方案玻璃升起 0..1
  boxes: array<Box, ${MAX_BOXES}>,
  lines: array<Line, ${MAX_LINES}>,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;
@group(0) @binding(3) var refl: texture_2d<f32>; // 地面倒影（畫倒影那一次綁的是空白材質）

const NEAR = 0.05;
const FAR = 2000.0;

const GMIN = vec3f(-7.0, 5.2, -12.0);
const GMAX = vec3f(7.0, 12.6, 0.0);
const WARM = vec3f(1.0, 0.68, 0.38);
const COOL = vec3f(0.80, 0.88, 1.0);

struct Hit { t: f32, n: vec3f, mat: f32, par: f32, id: f32 }

fn hash1(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn noise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p); let w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2f(1, 0)), w.x), mix(hash1(i + vec2f(0, 1)), hash1(i + vec2f(1, 1)), w.x), w.y);
}

// ---------- 椅子：距離場（只在椅子那一排的範圍內步進）----------
const CH0 = vec3f(-5.0, 0.0, -8.15);
const CH1 = vec3f(5.0, 1.32, -7.38);
const OP0 = vec3f(-5.7, 0.0, -9.5);
const OP1 = vec3f(5.7, 1.65, -8.2);
fn sdRB(p: vec3f, b: vec3f, r: f32) -> f32 { let q = abs(p) - b + r; return length(max(q, vec3f(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
fn sdCap(p: vec3f, a: vec3f, b: vec3f, r: f32) -> f32 { let pa = p - a; let ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
fn chairs(pw: vec3f) -> f32 {
  let k = clamp(round((pw.x + 4.5) / 1.8), 0.0, 5.0);
  let p = vec3f(pw.x - (k * 1.8 - 4.5), pw.y, pw.z + 7.78);
  // 離這張椅子的外框還遠就直接回傳到外框的距離，省掉後面整串形狀
  let bq = abs(p - vec3f(0.0, 0.65, 0.0)) - vec3f(0.35, 0.67, 0.36);
  let bd = length(max(bq, vec3f(0.0)));
  if (bd > 0.08) { return bd; }
  var d = sdRB(p - vec3f(0.0, 0.47, 0.0), vec3f(0.23, 0.04, 0.22), 0.035);          // 座墊
  let pb = vec3f(p.x, p.y, p.z + p.x * p.x * 0.7);                                   // 椅背往前包
  d = min(d, sdRB(pb - vec3f(0.0, 0.86, 0.27), vec3f(0.21, 0.25, 0.022), 0.022));    // 椅背
  d = min(d, sdRB(pb - vec3f(0.0, 1.21, 0.265), vec3f(0.12, 0.055, 0.022), 0.022));  // 頭枕
  d = min(d, sdCap(p, vec3f(0.0, 0.45, 0.20), vec3f(0.0, 1.20, 0.30), 0.02));        // 背桿
  d = min(d, sdCap(p, vec3f(0.0, 0.07, 0.0), vec3f(0.0, 0.44, 0.0), 0.028));         // 氣壓桿
  let a = atan2(p.z, p.x); let r = length(p.xz);
  let af = a - round(a / 1.2566371) * 1.2566371;                                     // 五爪椅腳
  d = min(d, sdCap(vec3f(r * cos(af), p.y, r * sin(af)), vec3f(0.02, 0.07, 0.0), vec3f(0.30, 0.035, 0.0), 0.02));
  let s = vec3f(abs(p.x), p.y, p.z);                                                 // 扶手
  d = min(d, sdRB(s - vec3f(0.275, 0.69, -0.02), vec3f(0.028, 0.014, 0.15), 0.012));
  d = min(d, sdCap(s, vec3f(0.24, 0.47, 0.08), vec3f(0.275, 0.68, 0.08), 0.014));
  return d;
}
fn slab(ro: vec3f, inv: vec3f, a: vec3f, b: vec3f) -> vec2f { // 回傳 (進入, 離開)
  let t0 = (a - ro) * inv; let t1 = (b - ro) * inv;
  let tmn = min(t0, t1); let tmx = max(t0, t1);
  return vec2f(max(max(tmn.x, tmn.y), tmn.z), min(min(tmx.x, tmx.y), tmx.z));
}

// 椅子：沿視線在椅子那一排的範圍內步進。回傳打到的距離，沒打到是 -1
fn marchChairs(ro: vec3f, rd: vec3f) -> f32 {
  let ch = slab(ro, 1.0 / rd, CH0, CH1);
  let c0 = max(ch.x, 0.002);
  if (c0 >= ch.y) { return -1.0; }
  var t = c0;
  for (var i = 0; i < 56; i++) {
    let d = chairs(ro + rd * t);
    if (d < 0.0015) { return t; }
    t += d;
    if (t > ch.y) { break; }
  }
  return -1.0;
}
fn chairN(q: vec3f) -> vec3f {
  let e = vec2f(0.002, 0.0);
  return normalize(vec3f(chairs(q + e.xyy) - chairs(q - e.xyy), chairs(q + e.yxy) - chairs(q - e.yxy), chairs(q + e.yyx) - chairs(q - e.yyx)));
}

fn sky(rd: vec3f) -> vec3f {
  let y = clamp(rd.y, 0.0, 1.0);
  var c = mix(vec3f(0.16, 0.26, 0.50), vec3f(0.015, 0.035, 0.11), pow(y, 0.55));
  c += vec3f(0.30, 0.22, 0.20) * pow(1.0 - y, 14.0) * 0.5;
  // 稀疏的星
  let sp = rd.xz / max(rd.y, 0.08) * 60.0; let s = floor(sp);
  c += vec3f(0.8) * step(0.996, hash1(s)) * smoothstep(0.20, 0.05, length(fract(sp) - 0.5)) * smoothstep(0.10, 0.30, y) * 0.7;
  return c;
}

// 線光源對表面的照度
fn lineLight(p: vec3f, n: vec3f, a: vec3f, b: vec3f) -> f32 {
  let ab = b - a;
  let q = a + ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  let l = q - p; let d2 = dot(l, l);
  let ndl = max(dot(n, l) * inverseSqrt(d2 + 1e-4), 0.0) * 0.85 + 0.15;
  return ndl / (d2 + 0.30);
}

fn pulse(i: f32) -> f32 { // 沿燈帶往入口推進的光脈衝
  let t = u.camPos.w;
  return 0.75 + 0.45 * pow(0.5 + 0.5 * sin(t * 1.6 + i * 0.9), 6.0);
}

fn lighting(p: vec3f, n: vec3f) -> vec3f {
  let on = u.camU.w;
  var c = mix(vec3f(0.005, 0.007, 0.014), vec3f(0.018, 0.028, 0.058), n.y * 0.5 + 0.5);
  let indoor = step(p.z, 0.1) * step(abs(p.x), 7.05) * step(p.y, 5.05);
  c *= mix(2.4, 1.7, indoor);
  // 發光玻璃量體（當成大面光）
  if (p.z > -0.4 || p.y > 5.1) {
    let q = clamp(p, GMIN, GMAX); let l = q - p; let d2 = dot(l, l);
    let ndl = max(dot(n, l) * inverseSqrt(d2 + 1e-4), 0.0);
    c += COOL * u.ex.y * (ndl * 0.9 + 0.1) * 4.0 / (d2 * 0.11 + 6.0);
  }
  let nl = i32(u.res.w);
  for (var i = 0; i < nl; i++) {
    let L = u.lines[i];
    var col = WARM; if (L.b.w < 0.0) { col = vec3f(0.78, 0.85, 0.96); }
    c += col * L.a.w * on * pulse(f32(i)) * lineLight(p, n, L.a.xyz, L.b.xyz);
  }
  // 工作站螢幕照在桌面與地面上的冷光
  if (p.z > -8.96 && p.z < -4.0 && abs(p.x) < 6.5 && p.y < 2.5) {
    let so = vec3f(clamp(p.x, -5.0, 5.0), 1.24, -8.95) - p; let ds = dot(so, so);
    c += vec3f(0.50, 0.62, 0.90) * on * (max(dot(n, so) * inverseSqrt(ds + 1e-4), 0.0) * 0.8 + 0.2) * 0.22 / (ds + 0.12);
  }
  // 兩面螢幕牆的溢光
  let sl = vec3f(-9.9, 4.5, 16.0) - p; let sr = vec3f(9.9, 4.6, 16.0) - p;
  let dl = dot(sl, sl); let dr = dot(sr, sr);
  c += vec3f(0.55, 0.65, 0.9) * max(dot(n, sl) * inverseSqrt(dl), 0.0) * max(-sl.x, 0.0) * inverseSqrt(dl) * 14.0 / (dl + 10.0);
  c += vec3f(0.9, 0.7, 0.55) * max(dot(n, sr) * inverseSqrt(dr), 0.0) * max(sr.x, 0.0) * inverseSqrt(dr) * 14.0 / (dr + 10.0);
  return c;
}

fn brick(uv: vec2f, fw: f32) -> vec3f { // 回傳 (明度, 灰縫, 凹凸)
  let s = vec2f(0.46, 0.085);
  var q = uv / s; q.x += 0.5 * floor(q.y);
  let id = floor(q); let f = fract(q);
  let e = min(min(f.x, 1.0 - f.x) * s.x, min(f.y, 1.0 - f.y) * s.y);
  let mortar = 1.0 - smoothstep(0.004, 0.012, e);
  let v = 0.72 + 0.5 * hash1(id);
  let k = smoothstep(0.012, 0.05, fw);
  return vec3f(mix(v, 0.9, k), mix(mortar, 0.25, k), 0.0);
}

fn rectm(uv: vec2f, a: vec2f, b: vec2f) -> f32 { let d = min(uv - a, b - uv); return step(0.0, min(d.x, d.y)); }
fn screenUI(uv: vec2f, seed: f32, k: f32) -> vec3f { // 工作站螢幕：剪輯介面，預覽窗播第 k 支作品
  let t = u.camPos.w; let sd = fract(seed * 0.618);
  var c = vec3f(0.012, 0.016, 0.026);
  // 監看畫面：地平線與光
  let va = vec2f(0.04, 0.07); let vb = vec2f(0.64, 0.56);
  if (rectm(uv, va, vb) > 0.5) {
    let v = (uv - va) / (vb - va);
    let cell = vec2f(k - 3.0 * floor(k / 3.0), floor(k / 3.0));
    let a = vec2f((cell.x + 0.02 + v.x * 0.96) / 3.0, (cell.y + 0.2 + v.y * 0.6) / 2.0 * u.fx.y);
    let vid = textureSampleLevel(tex, smp, a, 0.0).rgb;
    c = vid * vid * 1.1;
  }
  // 右側：示波與參數列
  for (var k = 0; k < 4; k++) {
    let y0 = 0.07 + f32(k) * 0.125;
    let lv = 0.25 + 0.7 * fract(sin(f32(k) * 12.9 + sd * 40.0 + floor(t * (0.7 + sd)) * 3.1) * 43758.5);
    c = mix(c, vec3f(0.07, 0.09, 0.13), rectm(uv, vec2f(0.68, y0), vec2f(0.96, y0 + 0.085)));
    c = mix(c, mix(vec3f(0.30, 0.48, 0.70), vec3f(0.55, 0.62, 0.66), f32(k) / 3.0), rectm(uv, vec2f(0.69, y0 + 0.03), vec2f(0.69 + 0.26 * lv, y0 + 0.055)));
  }
  // 時間軸
  if (uv.y > 0.62 && uv.y < 0.95 && uv.x > 0.04 && uv.x < 0.96) {
    let v = (uv.y - 0.62) / 0.33; let row = floor(v * 4.0); let fy = fract(v * 4.0);
    let x = uv.x * (4.0 + row * 1.5) + t * (0.10 + 0.05 * sd) + row * 3.7 + sd * 11.0;
    let on = step(0.3, hash1(vec2f(floor(x), row + sd * 9.0))) * step(0.05, fract(x)) * step(0.2, fy) * step(fy, 0.8);
    let pal = array<vec3f, 4>(vec3f(0.22, 0.38, 0.62), vec3f(0.30, 0.52, 0.50), vec3f(0.62, 0.46, 0.26), vec3f(0.42, 0.36, 0.60));
    c = mix(vec3f(0.03, 0.04, 0.06), pal[i32(row)] * 0.85, on);
    c = mix(c, vec3f(1.0, 0.3, 0.25), step(abs(uv.x - (0.2 + 0.6 * fract(t * 0.05 + sd))), 0.004));
  }
  return c;
}

// lite：不算逐燈光照，只留自發光與一點固定的環境光
fn shade(p: vec3f, h: Hit, rd: vec3f, lite: bool) -> vec3f {
  let n = h.n; let m = i32(h.mat + 0.5); let t = u.camPos.w; let on = u.camU.w;
  let fw = h.t * u.camF.w * 2.0 / u.res.y;
  var alb = vec3f(0.05); var em = vec3f(0.0); var spec = 0.0;
  let wuv = select(vec2f(p.x, p.y), vec2f(p.z, p.y), abs(n.x) > 0.5);

  if (m == 0) { // 深色長磚
    if (abs(n.y) < 0.5) {
      let b = brick(wuv, fw / max(abs(dot(rd, n)), 0.1));
      alb = vec3f(0.086, 0.078, 0.072) * b.x * (1.0 - 0.6 * b.y) * (0.9 + 0.2 * noise(wuv * vec2f(0.5, 1.3)));
      // 洗牆燈：沿牆腳每 4 公尺一盞
      let du = abs(fract(wuv.x / 3.0 + 0.5) - 0.5) * 3.0;
      let w = 0.07 + 0.085 * p.y;
      let inside = step(p.z, 0.0) * step(abs(p.x), 7.05);
      em = alb * WARM * 17.0 * on * exp(-du * du / (w * w)) * exp(-p.y * 0.62) * smoothstep(0.0, 0.2, p.y) * (1.0 - 0.8 * inside);
    } else { alb = vec3f(0.03); }
  } else if (m == 1) { // 深色石材
    let suv = select(wuv, p.xz, abs(n.y) > 0.5);
    let g = noise(suv * 1.1) * 0.14 + (noise(suv * 46.0) * 0.16 + noise(suv * 130.0) * 0.10) * (1.0 - smoothstep(0.003, 0.015, fw));
    alb = vec3f(0.056, 0.056, 0.061) * (0.80 + g);
    if (abs(n.y) < 0.5) {
      let sx = abs(fract(suv.x / 1.15) - 0.5) * 1.15;
      alb *= 1.0 - 0.6 * smoothstep(0.566, 0.575, sx) * (1.0 - smoothstep(0.008, 0.03, fw));
    }
    spec = 0.3;
  } else if (m == 2) { // 稜紋發光玻璃
    let rib = 0.5 + 0.5 * cos(wuv.x * 3.14159 * 2.0 / 0.30);
    let yy = (p.y - GMIN.y) / (GMAX.y - GMIN.y);
    let bands = exp(-pow((yy - 0.24) * 5.5, 2.0)) + exp(-pow((yy - 0.74) * 5.5, 2.0));
    // 由下往上流動的資料光
    let col = floor(wuv.x / 0.30);
    let flow = pow(fract(yy * 0.5 - t * (0.04 + 0.06 * hash1(vec2f(col, 3.0))) + hash1(vec2f(col, 1.0))), 5.0);
    let breathe = 0.9 + 0.1 * sin(t * 0.7);
    let base = 0.13 + 0.62 * bands * breathe + 0.28 * flow * step(0.5, hash1(vec2f(col, 7.0)));
    let rk = 1.0 - smoothstep(0.03, 0.12, fw);
    em = COOL * u.ex.y * base * mix(0.62, 0.22 + 0.78 * rib, rk) * 2.3;
    if (n.y < -0.5) { em = vec3f(0.0); alb = vec3f(0.02); }
    alb = vec3f(0.10);
  } else if (m == 3) { // 影片螢幕（圖集）
    let b = u.boxes[i32(h.par + 0.5)];
    let left = h.par < 0.5 + f32(i32(h.par)) && p.x < 0.0;
    var uv = vec2f((p.z - b.a.z) / (b.b.z - b.a.z), (b.b.y - p.y) / (b.b.y - b.a.y));
    var a = vec2f(0.0); var bez = 1.0;
    if (left) {
      uv.x = 1.0 - uv.x;
      let g = uv * vec2f(3.0, 2.0); let f = fract(g);
      bez = smoothstep(0.0, 0.012, min(min(f.x, 1.0 - f.x) * 1.26, min(f.y, 1.0 - f.y)));
      a = vec2f(uv.x, uv.y * u.fx.y);
    } else {
      a = vec2f(uv.x, u.fx.z + uv.y * (1.0 - u.fx.z));
    }
    let v = textureSampleLevel(tex, smp, a, 0.0).rgb;
    em = (v * v * 1.15 + 0.004) * bez * on;
    alb = vec3f(0.01);
  } else if (m == 4) { // 大廳後牆（暖色石材）
    let g = noise(wuv * 0.8) * 0.12 + (noise(wuv * 46.0) * 0.16 + noise(wuv * 130.0) * 0.10) * (1.0 - smoothstep(0.003, 0.015, fw));
    alb = vec3f(0.044, 0.045, 0.049) * (0.80 + g);
    let sx = abs(fract(wuv.x / 2.4) - 0.5) * 2.4;
    alb *= 1.0 - 0.55 * smoothstep(1.185, 1.2, sx);
    alb *= 1.0 - 0.35 * smoothstep(0.012, 0.0, abs(p.y - 2.5));
    em = alb * vec3f(1.0, 0.80, 0.58) * on * (4.6 * exp(-(5.0 - p.y) * 2.4) + 0.3 * exp(-p.y * 1.6) + 0.06);
  } else if (m == 5) { // 工作站螢幕
    let b = u.boxes[i32(h.par + 0.5)];
    if (n.z > 0.5) {
      let uv = vec2f((p.x - b.a.x) / (b.b.x - b.a.x), (b.b.y - p.y) / (b.b.y - b.a.y));
      let bz = smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      em = screenUI(uv, h.par, clamp(round(((b.a.x + b.b.x) * 0.5 + 4.5) / 1.8), 0.0, 5.0)) * 1.5 * bz * on;
    }
    alb = vec3f(0.01);
  } else if (m == 6) { // 黑色金屬
    alb = vec3f(0.018); spec = 0.5;
  } else if (m == 11) { // 椅子（距離場）
    alb = vec3f(0.085, 0.085, 0.092); spec = 0.6;
  } else if (m == 8) { // 大廳天花：深色木格柵
    if (n.y < -0.5) {
      // 格柵：遠處或斜看時淡成平均值，避免摩爾紋
      let f = fract(p.z / 0.24);
      let far = smoothstep(0.04, 0.14, fw / max(abs(dot(rd, n)), 0.08));
      let slat = mix(smoothstep(0.0, 0.06, f) * smoothstep(0.66, 0.60, f), 0.62, far);
      alb = vec3f(0.022, 0.017, 0.013) * (0.75 + 0.5 * noise(vec2f(p.x * 0.6, floor(p.z / 0.24) * 3.1)) * (1.0 - far)) * (0.12 + 0.88 * slat);
    } else { alb = vec3f(0.018); spec = 0.5; }
  } else if (m == 7) { // 接待服務螢幕：呼吸的光環
    let b = u.boxes[i32(h.par + 0.5)];
    if (n.z > 0.5) {
      let uv = vec2f((p.x - b.a.x) / (b.b.x - b.a.x), (b.b.y - p.y) / (b.b.y - b.a.y)) - 0.5;
      let n = 22.0; let bi = floor((uv.x + 0.5) * n); let fx2 = fract((uv.x + 0.5) * n);
      let env = exp(-pow((bi / n - 0.5) * 3.2, 2.0));
      let amp = 0.04 + 0.36 * env * (0.35 + 0.65 * abs(sin(t * (2.0 + 1.3 * hash1(vec2f(bi, 2.0))) + bi * 1.7)));
      let bar = step(abs(uv.y), amp) * step(0.22, fx2) * step(fx2, 0.78) * step(abs(uv.x), 0.42);
      em = vec3f(0.45, 0.80, 1.0) * bar * 2.6 * on + vec3f(0.004, 0.007, 0.012);
    }
    alb = vec3f(0.01);
  }
  // 石材與金屬的邊緣做一點倒角：靠近方塊邊線時把法線往相鄰的面偏
  var nb = n; var edge = 0.0;
  if (m == 11) { edge = 1.5 + 6.0 * pow(1.0 - abs(dot(rd, n)), 2.0); } // 椅子：輪廓光
  if (m == 1 || m == 6) {
    let bx = u.boxes[i32(h.id + 0.5)];
    let da = p - bx.a.xyz; let db = bx.b.xyz - p;
    let r = max(0.014, fw * 1.4);
    let w = (1.0 - clamp(min(da, db) / r, vec3f(0.0), vec3f(1.0))) * (1.0 - abs(n));
    nb = normalize(n + sign(da - db) * w * w * 1.2);
    edge = max(w.x, max(w.y, w.z));
  }
  var Lt = vec3f(0.016, 0.020, 0.030);
  if (!lite) { Lt = lighting(p, nb); }
  var c = alb * Lt + em + Lt * 0.035 * edge; // 邊緣多一點受光，當成倒角的高光
  if (spec > 0.0) { // 石材與金屬帶一點天空與玻璃量體的反光
    let r = reflect(rd, n);
    c += spec * 0.06 * sky(vec3f(r.x, abs(r.y), r.z)) * pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
  }
  return c;
}

fn ground(p: vec3f, rd: vec3f, t: f32) -> vec4f { // rgb = 顏色, a = 反射率
  let on = u.camU.w;
  let fw = t * u.camF.w * 2.0 / u.res.y;
  let s = vec2f(1.2, 0.6);
  var q = p.xz / s; q.x += 0.5 * floor(q.y);
  let id = floor(q); let f = fract(q);
  let e = min(min(f.x, 1.0 - f.x) * s.x, min(f.y, 1.0 - f.y) * s.y);
  let joint = (1.0 - smoothstep(0.003, 0.012, e)) * (1.0 - smoothstep(0.01, 0.06, fw));
  let g = noise(p.xz * 0.7) * 0.5 + noise(p.xz * 5.0) * 0.2;
  var alb = vec3f(0.034, 0.033, 0.036) * (0.62 + 0.35 * hash1(id) * (1.0 - smoothstep(0.02, 0.12, fw)) + g * 0.5) * (1.0 - 0.6 * joint);
  var c = alb * lighting(p, vec3f(0, 1, 0));
  // 嵌在地面的燈帶：亮芯與地面暈光
  let nl = i32(u.res.w);
  for (var i = 0; i < nl; i++) {
    let L = u.lines[i];
    if (L.a.y < 0.12) {
      let a = L.a.xz; let ab = L.b.xz - a;
      let d = length(p.xz - (a + ab * clamp(dot(p.xz - a, ab) / dot(ab, ab), 0.0, 1.0)));
      let pw = pulse(f32(i)) * on;
      var col = WARM; if (L.b.w < 0.0) { col = vec3f(0.78, 0.85, 0.96); }
      c += col * pw * (smoothstep(0.04 + fw, 0.018, d) * 4.2 + alb * 15.0 * exp(-d * 6.5) + alb * 0.5 / (1.0 + d * d * 2.0));
    }
  }
  let rough = 0.35 + 0.5 * g;
  return vec4f(c, (1.0 - 0.7 * joint) * (1.15 - rough));
}

// 視線與線段的最近距離，用來畫光暈
fn halo(ro: vec3f, rd: vec3f, tmax: f32, a: vec3f, b: vec3f) -> f32 {
  let ab = b - a; let ao = a - ro;
  let d1 = dot(rd, ab); let d2 = dot(ab, ab);
  let den = d2 - d1 * d1;
  var s = 0.0;
  if (den > 1e-5) { s = clamp((d1 * dot(rd, ao) - dot(ab, ao)) / den, 0.0, 1.0); }
  let q = a + ab * s;
  let tr = dot(q - ro, rd);
  if (tr < 0.0 || tr > tmax + 0.05) { return 0.0; }
  let d = length(q - (ro + rd * tr));
  let w = max(0.018, tr * u.camF.w * 2.0 / u.res.y);
  let core = smoothstep(w, w * 0.25, d) * min(1.0, 0.018 / w * 3.0);
  return core * 1.9 + 0.0011 / (d * d + 0.0045) * min(1.0, 20.0 / (tr + 1.0));
}

// 霧、光暈、色調映射、暗角、顆粒：每個像素最後都過這一段。tt 是到表面的距離（天空給很大的值）
fn finish(cin: vec3f, tt: f32, rd: vec3f, fc: vec4f, fogOn: bool) -> vec4f {
  let ro = u.camPos.xyz; let on = u.camU.w; let t = u.camPos.w;
  var col = cin;
  if (fogOn) { col = mix(col, vec3f(0.008, 0.014, 0.034), 1.0 - exp(-tt * 0.0025)); } // 薄霧
  // 光暈：線光源
  let nl = i32(u.res.w);
  for (var i = 0; i < nl; i++) {
    let L = u.lines[i];
    var lc = WARM; if (L.b.w < 0.0) { lc = vec3f(0.78, 0.85, 0.96); }
    col += lc * halo(ro, rd, tt, L.a.xyz, L.b.xyz) * abs(L.b.w) * on * pulse(f32(i));
  }
  // 光暈：玻璃量體周圍的霧光
  {
    let c = (GMIN + GMAX) * 0.5; let tc = max(dot(c - ro, rd), 0.0);
    let q = ro + rd * min(tc, tt);
    let d = max(abs(q - c) - (GMAX - GMIN) * 0.5, vec3f(0.0));
    col += COOL * u.ex.y * 0.032 * exp(-length(d) * 0.55) * (0.9 + 0.1 * sin(t * 0.7));
  }
  // 色調映射、暗角、顆粒
  col = max(col * 1.25 - vec3f(0.0012), vec3f(0.0));
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.38); // 對比：暗部更黑、亮線更亮
  let ndc = vec2f(fc.x / u.res.x * 2.0 - 1.0, 1.0 - fc.y / u.res.y * 2.0);
  let vg = ndc * vec2f(0.55, 0.62);
  col *= 1.0 - 0.38 * dot(vg, vg);
  col += (hash1(floor(fc.xy) + fract(t) * 97.0) - 0.5) * (0.008 + 0.02 * max(col.r, max(col.g, col.b)));
  return vec4f(col, 1.0);
}

fn viewRay(fc: vec4f) -> vec3f {
  let ndc = vec2f(fc.x / u.res.x * 2.0 - 1.0, 1.0 - fc.y / u.res.y * 2.0);
  var rd = normalize(u.camF.xyz + u.camR.xyz * (ndc.x * u.camF.w * u.camR.w) + u.camU.xyz * (ndc.y * u.camF.w));
  rd += vec3f(1e-5, 1e-5, 1e-5) * step(abs(rd), vec3f(1e-5));
  return rd;
}

struct VO {
  @invariant @builtin(position) pos: vec4f,
  @location(0) wp: vec3f,                       // 真實的世界座標（畫倒影時也是沒顛倒的）
  @location(1) @interpolate(flat) n: vec3f,
  @location(2) @interpolate(flat) m: vec3f,     // 材質、par、方塊編號
}
@vertex fn vsBox(@location(0) pos: vec3f, @location(1) n: vec3f, @location(2) m: vec3f) -> VO {
  var o: VO; o.n = n; o.m = m;
  var pw = pos; var hide = false;
  if (m.x > 11.5) { // 玻璃板：平常沉在地面裡，打開才升起（VIP 先、兩側後）
    let base = 0.02; let k = smoothstep(0.0, 1.0, u.misc.y * 1.5 - abs(m.y - 1.0) * 0.5);
    pw.y = base + (pos.y - base) * k; hide = k < 0.003;
  }
  o.wp = pw;
  var pv = pw; if (u.misc.x > 0.5) { pv.y = -pv.y; } // 倒影：鏡頭看到的是上下顛倒的場景
  let d = pv - u.camPos.xyz; let z = dot(d, u.camF.xyz);
  o.pos = vec4f(dot(d, u.camR.xyz) / (u.camF.w * u.camR.w), dot(d, u.camU.xyz) / u.camF.w, (z - NEAR) * FAR / (FAR - NEAR), z);
  if (hide) { o.pos = vec4f(0.0, 0.0, -1.0, 1.0); }
  return o;
}
@vertex fn vsSky(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 1.0, 1.0);
}

@fragment fn fsPre() -> @location(0) vec4f { return vec4f(0.0); } // 只寫深度的那一次

@fragment fn fsBox(in: VO) -> @location(0) vec4f {
  let ro = u.camPos.xyz; let p = in.wp; let mir = u.misc.x > 0.5;
  var pv = p; if (mir) { pv.y = -pv.y; }
  let dv = pv - ro; let tt = length(dv);
  var rd = dv / tt;
  if (mir) { rd.y = -rd.y; } // 經地面反射之後，實際打到 p 的方向
  rd += vec3f(1e-5, 1e-5, 1e-5) * step(abs(rd), vec3f(1e-5));
  var h: Hit; h.t = tt; h.n = in.n; h.mat = in.m.x; h.par = in.m.y; h.id = in.m.z;
  if (mir) {
    // 倒影：低畫質不算逐燈光照。t2 是從地面反射點到這個表面的距離，用來讓遠處的倒影淡一點
    let c = shade(p, h, rd, u.ex.z < 0.5);
    let t2 = tt * p.y / (ro.y + p.y);
    return vec4f(c * exp(-t2 * 0.012), 1.0);
  }
  var col = vec3f(0.0);
  if (h.mat > 8.5 && h.mat < 9.5) {
    let g = ground(p, rd, tt);
    col = g.rgb;
    // 拋光地面：取倒影那一張圖，順著地面的細微起伏偏一點
    let w = noise(p.xz * 3.0) - 0.5; let w2 = noise(p.zx * 3.0 + 7.0) - 0.5;
    let uv = in.pos.xy / u.res.xy + vec2f(w, w2) * 0.0014;
    let rc = textureSampleLevel(refl, smp, uv, 0.0).rgb;
    let fres = 0.05 + 0.95 * pow(1.0 - max(-rd.y, 0.0), 4.0);
    col += rc * g.a * (0.11 + 0.62 * fres);
  } else {
    col = shade(p, h, rd, false);
  }
  return finish(col, tt, rd, in.pos, true);
}

@fragment fn fsSky(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  var rd = viewRay(fc);
  if (u.misc.x > 0.5) { rd.y = -rd.y; return vec4f(sky(rd) * 0.6, 1.0); }
  return finish(sky(rd), 1e9, rd, fc, false);
}

// 浮空的玻璃板（三個方案）：半透明，疊在畫好的場景上。只有邊緣一條細亮線、腳下往上爬的光、斜看時的反光
fn tone(c0: vec3f) -> vec3f {
  var col = max(c0 * 1.25 - vec3f(0.0012), vec3f(0.0));
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  return mix(col, col * col * (3.0 - 2.0 * col), 0.38);
}
@fragment fn fsGlass(in: VO) -> @location(0) vec4f {
  let ro = u.camPos.xyz; let p = in.wp; let mir = u.misc.x > 0.5; let on = u.camU.w;
  var pv = p; if (mir) { pv.y = -pv.y; }
  let dv = pv - ro; let tt = length(dv); var rd = dv / tt;
  if (mir) { rd.y = -rd.y; }
  let n = in.n; let ndv = -dot(rd, n);
  if (ndv <= 0.0) { discard; } // 背向鏡頭的面不畫
  let fw = tt * u.camF.w * 2.0 / u.res.y;
  let b = u.boxes[i32(in.m.z + 0.5)];
  let sz = b.b.xy - b.a.xy; let q = (p.xy - b.a.xy) / sz;
  let e = min(min(q.x, 1.0 - q.x) * sz.x, min(q.y, 1.0 - q.y) * sz.y);
  let vip = step(0.5, in.m.y) * step(in.m.y, 1.5);
  let ec = mix(COOL, WARM, vip); // VIP 那一片的邊線是暖色
  var col = ec * 1.1; var a = 0.95; // 側面與頂面：玻璃的斷面，整條發亮
  if (abs(n.z) > 0.5) {
    let fres = pow(1.0 - ndv, 3.0);
    let rim = smoothstep(0.005 + fw * 1.6, fw * 0.3, e);
    col = vec3f(0.002, 0.003, 0.005)
        + ec * (rim * 2.2 + 0.06 * exp(-e * 26.0) + 0.11 * exp(-q.y * sz.y * 2.4))
        + COOL * (0.004 + 0.22 * fres);
    a = clamp(0.34 + 0.5 * fres + rim, 0.0, 0.97);
  }
  col *= on;
  if (mir) { return vec4f(col * exp(-tt * p.y / (ro.y + p.y) * 0.012), a); }
  return vec4f(tone(col), a);
}

// 椅子：畫的是那一排的外框，在裡面沿視線步進距離場，打到才上色並寫入真正的深度
struct CO { @location(0) col: vec4f, @builtin(frag_depth) depth: f32 }
@fragment fn fsChair(in: VO, @builtin(front_facing) ff: bool) -> CO {
  var o: CO; o.col = vec4f(0.0); o.depth = 1.0;
  let ro = u.camPos.xyz;
  var rd = normalize(in.wp - ro);
  rd += vec3f(1e-5, 1e-5, 1e-5) * step(abs(rd), vec3f(1e-5));
  var t = -1.0;
  if (ff) { t = marchChairs(ro, rd); }
  if (t < 0.0) { discard; }
  let p = ro + rd * t;
  var h: Hit; h.t = t; h.n = chairN(p); h.mat = 11.0; h.par = 0.0; h.id = 0.0;
  o.col = finish(shade(p, h, rd, false), t, rd, in.pos, true);
  let z = dot(p - ro, u.camF.xyz);
  o.depth = (z - NEAR) * FAR / ((FAR - NEAR) * z);
  return o;
}
`;
