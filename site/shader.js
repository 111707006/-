// FG STUDIO — The Creative District
// 全螢幕光線追蹤著色器（WGSL）。場景完全由程式生成：方塊清單與線光源由 main.js 傳入。
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
  boxes: array<Box, ${MAX_BOXES}>,
  lines: array<Line, ${MAX_LINES}>,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var smp: sampler;

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

fn trace(ro: vec3f, rd: vec3f) -> Hit {
  var h: Hit; h.t = 1e9; h.mat = -1.0; h.par = 0.0; h.id = 0.0; h.n = vec3f(0, 1, 0);
  if (rd.y < -1e-4) { let t = -ro.y / rd.y; if (t > 0.0) { h.t = t; h.mat = 9.0; } }
  let inv = 1.0 / rd;
  let n = i32(u.res.z);
  for (var i = 0; i < n; i++) {
    let b = u.boxes[i];
    let t0 = (b.a.xyz - ro) * inv; let t1 = (b.b.xyz - ro) * inv;
    let tmin = min(t0, t1); let tmax = max(t0, t1);
    let tn = max(max(tmin.x, tmin.y), tmin.z); let tf = min(min(tmax.x, tmax.y), tmax.z);
    if (tn < tf && tn > 0.002 && tn < h.t) {
      h.t = tn; h.mat = b.a.w; h.par = b.b.w; h.id = f32(i);
      h.n = -sign(rd) * step(vec3f(tn), tmin);
    }
  }
  return h;
}

fn sky(rd: vec3f) -> vec3f {
  let y = clamp(rd.y, 0.0, 1.0);
  var c = mix(vec3f(0.16, 0.26, 0.50), vec3f(0.015, 0.035, 0.11), pow(y, 0.55));
  c += vec3f(0.30, 0.22, 0.20) * pow(1.0 - y, 14.0) * 0.5;
  // 稀疏的星
  let sp = rd.xz / max(rd.y, 0.08) * 60.0; let s = floor(sp);
  c += vec3f(0.8) * step(0.992, hash1(s)) * smoothstep(0.30, 0.08, length(fract(sp) - 0.5)) * smoothstep(0.10, 0.30, y) * 0.7;
  return c;
}

// 線光源對表面的照度
fn lineLight(p: vec3f, n: vec3f, a: vec3f, b: vec3f) -> f32 {
  let ab = b - a;
  let q = a + ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  let l = q - p; let d2 = dot(l, l);
  let ndl = max(dot(n, l) * inverseSqrt(d2 + 1e-4), 0.0) * 0.85 + 0.15;
  return ndl / (d2 + 0.35);
}

fn pulse(i: f32) -> f32 { // 沿燈帶往入口推進的光脈衝
  let t = u.camPos.w;
  return 0.75 + 0.45 * pow(0.5 + 0.5 * sin(t * 1.6 + i * 0.9), 6.0);
}

fn lighting(p: vec3f, n: vec3f) -> vec3f {
  let on = u.camU.w;
  var c = mix(vec3f(0.010, 0.014, 0.028), vec3f(0.035, 0.055, 0.11), n.y * 0.5 + 0.5);
  let indoor = step(p.z, 0.1) * step(abs(p.x), 7.05) * step(p.y, 5.05);
  c *= mix(3.2, 1.0, indoor);
  // 發光玻璃量體（當成大面光）
  if (p.z > -0.4 || p.y > 5.1) {
    let q = clamp(p, GMIN, GMAX); let l = q - p; let d2 = dot(l, l);
    let ndl = max(dot(n, l) * inverseSqrt(d2 + 1e-4), 0.0);
    c += COOL * on * (ndl * 0.9 + 0.1) * 5.5 / (d2 * 0.09 + 6.0);
  }
  let nl = i32(u.res.w);
  for (var i = 0; i < nl; i++) {
    let L = u.lines[i];
    var col = WARM; if (L.b.w < 0.0) { col = vec3f(0.55, 0.78, 1.0); }
    c += col * L.a.w * on * pulse(f32(i)) * lineLight(p, n, L.a.xyz, L.b.xyz);
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

fn shade(p: vec3f, h: Hit, rd: vec3f) -> vec3f {
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
      let w = 0.09 + 0.11 * p.y;
      let inside = step(p.z, 0.0) * step(abs(p.x), 7.05);
      em = alb * WARM * 17.0 * on * exp(-du * du / (w * w)) * exp(-p.y * 0.62) * smoothstep(0.0, 0.2, p.y) * (1.0 - 0.8 * inside);
    } else { alb = vec3f(0.03); }
  } else if (m == 1) { // 深色石材
    let suv = select(wuv, p.xz, abs(n.y) > 0.5);
    let g = noise(suv * 2.3) * 0.5 + noise(suv * 9.0) * 0.25 + noise(suv * 37.0) * 0.1 * (1.0 - smoothstep(0.004, 0.02, fw));
    let vein = smoothstep(0.04, 0.0, abs(noise(suv * 0.9 + 3.7) - 0.5));
    alb = vec3f(0.050, 0.050, 0.054) * (0.62 + g) + vec3f(0.012) * vein;
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
    em = COOL * on * base * mix(0.62, 0.22 + 0.78 * rib, rk) * 2.3;
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
    let g = noise(wuv * 1.3) * 0.3 + noise(wuv * 7.0) * 0.2 + noise(wuv * 31.0) * 0.12 * (1.0 - smoothstep(0.004, 0.02, fw));
    alb = vec3f(0.070, 0.071, 0.075) * (0.75 + g);
    let sx = abs(fract(wuv.x / 2.4) - 0.5) * 2.4;
    alb *= 1.0 - 0.55 * smoothstep(1.185, 1.2, sx);
    alb *= 1.0 - 0.35 * smoothstep(0.012, 0.0, abs(p.y - 2.5));
    em = alb * vec3f(1.0, 0.80, 0.58) * on * (3.6 * exp(-(5.0 - p.y) * 1.25) + 0.3 * exp(-p.y * 1.4) + 0.10);
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
  } else if (m == 8) { // 大廳天花：深色木格柵
    if (n.y < -0.5) {
      let f = fract(p.z / 0.14);
      let slat = smoothstep(0.0, 0.08, f) * smoothstep(0.62, 0.54, f);
      alb = vec3f(0.115, 0.088, 0.066) * (0.75 + 0.5 * noise(vec2f(p.x * 0.6, floor(p.z / 0.14) * 3.1))) * (0.12 + 0.88 * slat);
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
  var nb = n;
  if (m == 1 || m == 6) {
    let bx = u.boxes[i32(h.id + 0.5)];
    let da = p - bx.a.xyz; let db = bx.b.xyz - p;
    let r = max(0.014, fw * 1.4);
    let w = (1.0 - clamp(min(da, db) / r, vec3f(0.0), vec3f(1.0))) * (1.0 - abs(n));
    nb = normalize(n + sign(da - db) * w * w * 1.2);
  }
  var c = alb * lighting(p, nb) + em;
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
      var col = WARM; if (L.b.w < 0.0) { col = vec3f(0.55, 0.78, 1.0); }
      c += col * pw * (smoothstep(0.07 + fw, 0.035, d) * 2.6 + alb * 12.0 * exp(-d * 2.0) + alb * 2.0 / (1.0 + d * d * 0.5));
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
  let w = max(0.03, tr * u.camF.w * 2.4 / u.res.y);
  let core = smoothstep(w, w * 0.25, d) * min(1.0, 0.03 / w * 2.5);
  return core * 1.15 + 0.006 / (d * d + 0.03) * min(1.0, 20.0 / (tr + 1.0));
}

@vertex fn vs(@builtin(vertex_index) i: u32) -> @builtin(position) vec4f {
  return vec4f(f32((i << 1u) & 2u) * 2.0 - 1.0, f32(i & 2u) * 2.0 - 1.0, 0.0, 1.0);
}

@fragment fn fs(@builtin(position) fc: vec4f) -> @location(0) vec4f {
  let ndc = vec2f(fc.x / u.res.x * 2.0 - 1.0, 1.0 - fc.y / u.res.y * 2.0);
  let ro = u.camPos.xyz;
  var rd = normalize(u.camF.xyz + u.camR.xyz * (ndc.x * u.camF.w * u.camR.w) + u.camU.xyz * (ndc.y * u.camF.w));
  rd += vec3f(1e-5, 1e-5, 1e-5) * step(abs(rd), vec3f(1e-5));
  let on = u.camU.w; let t = u.camPos.w;

  let h = trace(ro, rd);
  var col = vec3f(0.0);
  if (h.mat < 0.0) { col = sky(rd); }
  else {
    let p = ro + rd * h.t;
    if (h.mat > 8.5) {
      let g = ground(p, rd, h.t);
      col = g.rgb;
      // 拋光地面：一次反射
      let w = noise(p.xz * 3.0) - 0.5; let w2 = noise(p.zx * 3.0 + 7.0) - 0.5;
      let nn = normalize(vec3f(w * 0.006, 1.0, w2 * 0.006));
      let rr = reflect(rd, nn);
      let h2 = trace(p + vec3f(0, 0.004, 0), rr);
      var rc = vec3f(0.0);
      if (h2.mat < 0.0) { rc = sky(rr) * 0.6; }
      else if (h2.mat > 8.5) { rc = vec3f(0.0); }
      else { rc = shade(p + rr * h2.t, h2, rr); }
      let fres = 0.05 + 0.95 * pow(1.0 - max(-rd.y, 0.0), 4.0);
      col += rc * g.a * (0.11 + 0.62 * fres) * exp(-h2.t * 0.012);
    } else {
      col = shade(p, h, rd);
    }
    // 薄霧
    let fog = 1.0 - exp(-h.t * 0.0025);
    col = mix(col, vec3f(0.02, 0.035, 0.08), fog);
  }

  // 光暈：線光源
  let nl = i32(u.res.w);
  for (var i = 0; i < nl; i++) {
    let L = u.lines[i];
    var lc = WARM; if (L.b.w < 0.0) { lc = vec3f(0.55, 0.78, 1.0); }
    col += lc * halo(ro, rd, h.t, L.a.xyz, L.b.xyz) * abs(L.b.w) * on * pulse(f32(i));
  }
  // 光暈：玻璃量體周圍的霧光
  {
    let c = (GMIN + GMAX) * 0.5; let tc = max(dot(c - ro, rd), 0.0);
    let q = ro + rd * min(tc, h.t);
    let d = max(abs(q - c) - (GMAX - GMIN) * 0.5, vec3f(0.0));
    col += COOL * on * 0.05 * exp(-length(d) * 0.30) * (0.9 + 0.1 * sin(t * 0.7));
  }

  // 色調映射、暗角、顆粒
  col *= 1.25;
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  let vg = ndc * vec2f(0.55, 0.62);
  col *= 1.0 - 0.38 * dot(vg, vg);
  col += (hash1(fc.xy + fract(t) * 97.0) - 0.5) * 0.022;
  return vec4f(col, 1.0);
}
`;
