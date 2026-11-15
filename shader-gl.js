// FG STUDIO — The Creative District
// 著色器（GLSL ES 3.00）：給沒有 WebGPU 的瀏覽器走 WebGL2 用。
// 內容與 shader.js（WGSL）逐段對應，函式名稱與順序都一樣。改畫面效果時兩份要一起改。
// 與 WGSL 版不同的地方只有三處，都集中在最下面的進入點：
//   1. 畫面座標：WebGL 的 gl_FragCoord 原點在左下，FC() 換成左上，其餘算式就能照抄
//   2. 深度：WebGL 的裁切空間 z 是 -1..1，vsBox 最後換算一次
//   3. 倒影圖：WebGL 的材質 v=0 在下面，取樣時上下顛倒
import { MAX_BOXES, MAX_LINES } from './shader.js';

const HEAD = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
struct Box { vec4 a; vec4 b; };
struct Line { vec4 a; vec4 b; };
layout(std140) uniform U {
  vec4 camPos;   // xyz, w = time
  vec4 camF;     // xyz, w = tan(fovY/2)
  vec4 camR;     // xyz, w = aspect
  vec4 camU;     // xyz, w = power-on 0..1
  vec4 res;      // w, h, nBoxes, nLines
  vec4 fx;       // x = focus stop (0..4), y = atlas split v, z = atlas right v0
  vec4 ex;       // x = 前段（大件）方塊數, y = 玻璃量體亮度 0..1, z = 畫質（1 高、0 低）
  vec4 misc;     // x = 1 表示正在畫地面倒影, y = 方案玻璃升起 0..1
  Box boxes[${MAX_BOXES}];
  Line lines[${MAX_LINES}];
} u;
const float NEAR = 0.05;
const float FAR = 2000.0;
`;

const COMMON = /* glsl */ `
uniform sampler2D tex;
uniform sampler2D refl; // 地面倒影（畫倒影那一次綁的是空白材質）

const vec3 GMIN = vec3(-7.0, 5.2, -12.0);
const vec3 GMAX = vec3(7.0, 12.6, 0.0);
const vec3 WARM = vec3(1.0, 0.68, 0.38);
const vec3 COOL = vec3(0.80, 0.88, 1.0);

struct Hit { float t; vec3 n; float mat; float par; float id; };

float hash1(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash1(i), hash1(i + vec2(1.0, 0.0)), w.x), mix(hash1(i + vec2(0.0, 1.0)), hash1(i + vec2(1.0, 1.0)), w.x), w.y);
}

// ---------- 椅子：距離場（只在椅子那一排的範圍內步進）----------
const vec3 CH0 = vec3(-5.0, 0.0, -8.15);
const vec3 CH1 = vec3(5.0, 1.32, -7.38);
float sdRB(vec3 p, vec3 b, float r) { vec3 q = abs(p) - b + r; return length(max(q, vec3(0.0))) + min(max(q.x, max(q.y, q.z)), 0.0) - r; }
float sdCap(vec3 p, vec3 a, vec3 b, float r) { vec3 pa = p - a; vec3 ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)) - r; }
float chairs(vec3 pw) {
  float k = clamp(round((pw.x + 4.5) / 1.8), 0.0, 5.0);
  vec3 p = vec3(pw.x - (k * 1.8 - 4.5), pw.y, pw.z + 7.78);
  vec3 bq = abs(p - vec3(0.0, 0.65, 0.0)) - vec3(0.35, 0.67, 0.36);
  float bd = length(max(bq, vec3(0.0)));
  if (bd > 0.08) { return bd; }
  float d = sdRB(p - vec3(0.0, 0.47, 0.0), vec3(0.23, 0.04, 0.22), 0.035);          // 座墊
  vec3 pb = vec3(p.x, p.y, p.z + p.x * p.x * 0.7);                                  // 椅背往前包
  d = min(d, sdRB(pb - vec3(0.0, 0.86, 0.27), vec3(0.21, 0.25, 0.022), 0.022));     // 椅背
  d = min(d, sdRB(pb - vec3(0.0, 1.21, 0.265), vec3(0.12, 0.055, 0.022), 0.022));   // 頭枕
  d = min(d, sdCap(p, vec3(0.0, 0.45, 0.20), vec3(0.0, 1.20, 0.30), 0.02));         // 背桿
  d = min(d, sdCap(p, vec3(0.0, 0.07, 0.0), vec3(0.0, 0.44, 0.0), 0.028));          // 氣壓桿
  float a = atan(p.z, p.x); float r = length(p.xz);
  float af = a - round(a / 1.2566371) * 1.2566371;                                  // 五爪椅腳
  d = min(d, sdCap(vec3(r * cos(af), p.y, r * sin(af)), vec3(0.02, 0.07, 0.0), vec3(0.30, 0.035, 0.0), 0.02));
  vec3 s = vec3(abs(p.x), p.y, p.z);                                                // 扶手
  d = min(d, sdRB(s - vec3(0.275, 0.69, -0.02), vec3(0.028, 0.014, 0.15), 0.012));
  d = min(d, sdCap(s, vec3(0.24, 0.47, 0.08), vec3(0.275, 0.68, 0.08), 0.014));
  return d;
}
vec2 slab(vec3 ro, vec3 inv, vec3 a, vec3 b) { // 回傳 (進入, 離開)
  vec3 t0 = (a - ro) * inv; vec3 t1 = (b - ro) * inv;
  vec3 tmn = min(t0, t1); vec3 tmx = max(t0, t1);
  return vec2(max(max(tmn.x, tmn.y), tmn.z), min(min(tmx.x, tmx.y), tmx.z));
}
float marchChairs(vec3 ro, vec3 rd) {
  vec2 ch = slab(ro, 1.0 / rd, CH0, CH1);
  float c0 = max(ch.x, 0.002);
  if (c0 >= ch.y) { return -1.0; }
  float t = c0;
  for (int i = 0; i < 56; i++) {
    float d = chairs(ro + rd * t);
    if (d < 0.0015) { return t; }
    t += d;
    if (t > ch.y) { break; }
  }
  return -1.0;
}
vec3 chairN(vec3 q) {
  vec2 e = vec2(0.002, 0.0);
  return normalize(vec3(chairs(q + e.xyy) - chairs(q - e.xyy), chairs(q + e.yxy) - chairs(q - e.yxy), chairs(q + e.yyx) - chairs(q - e.yyx)));
}

vec3 sky(vec3 rd) {
  float y = clamp(rd.y, 0.0, 1.0);
  vec3 c = mix(vec3(0.16, 0.26, 0.50), vec3(0.015, 0.035, 0.11), pow(y, 0.55));
  c += vec3(0.30, 0.22, 0.20) * pow(1.0 - y, 14.0) * 0.5;
  vec2 sp = rd.xz / max(rd.y, 0.08) * 60.0; vec2 s = floor(sp);
  c += vec3(0.8) * step(0.996, hash1(s)) * smoothstep(0.20, 0.05, length(fract(sp) - 0.5)) * smoothstep(0.10, 0.30, y) * 0.7;
  return c;
}

float lineLight(vec3 p, vec3 n, vec3 a, vec3 b) {
  vec3 ab = b - a;
  vec3 q = a + ab * clamp(dot(p - a, ab) / dot(ab, ab), 0.0, 1.0);
  vec3 l = q - p; float d2 = dot(l, l);
  float ndl = max(dot(n, l) * inversesqrt(d2 + 1e-4), 0.0) * 0.85 + 0.15;
  return ndl / (d2 + 0.30);
}

float pulse(float i) {
  float t = u.camPos.w;
  return 0.75 + 0.45 * pow(0.5 + 0.5 * sin(t * 1.6 + i * 0.9), 6.0);
}

vec3 lighting(vec3 p, vec3 n) {
  float on = u.camU.w;
  vec3 c = mix(vec3(0.005, 0.007, 0.014), vec3(0.018, 0.028, 0.058), n.y * 0.5 + 0.5);
  float indoor = step(p.z, 0.1) * step(abs(p.x), 7.05) * step(p.y, 5.05);
  c *= mix(2.4, 1.7, indoor);
  if (p.z > -0.4 || p.y > 5.1) {
    vec3 q = clamp(p, GMIN, GMAX); vec3 l = q - p; float d2 = dot(l, l);
    float ndl = max(dot(n, l) * inversesqrt(d2 + 1e-4), 0.0);
    c += COOL * u.ex.y * (ndl * 0.9 + 0.1) * 4.0 / (d2 * 0.11 + 6.0);
  }
  int nl = int(u.res.w);
  for (int i = 0; i < nl; i++) {
    Line L = u.lines[i];
    vec3 col = WARM; if (L.b.w < 0.0) { col = vec3(0.78, 0.85, 0.96); }
    c += col * L.a.w * on * pulse(float(i)) * lineLight(p, n, L.a.xyz, L.b.xyz);
  }
  if (p.z > -8.96 && p.z < -4.0 && abs(p.x) < 6.5 && p.y < 2.5) {
    vec3 so = vec3(clamp(p.x, -5.0, 5.0), 1.24, -8.95) - p; float ds = dot(so, so);
    c += vec3(0.50, 0.62, 0.90) * on * (max(dot(n, so) * inversesqrt(ds + 1e-4), 0.0) * 0.8 + 0.2) * 0.22 / (ds + 0.12);
  }
  vec3 sl = vec3(-9.9, 4.5, 16.0) - p; vec3 sr = vec3(9.9, 4.6, 16.0) - p;
  float dl = dot(sl, sl); float dr = dot(sr, sr);
  c += vec3(0.55, 0.65, 0.9) * max(dot(n, sl) * inversesqrt(dl), 0.0) * max(-sl.x, 0.0) * inversesqrt(dl) * 14.0 / (dl + 10.0);
  c += vec3(0.9, 0.7, 0.55) * max(dot(n, sr) * inversesqrt(dr), 0.0) * max(sr.x, 0.0) * inversesqrt(dr) * 14.0 / (dr + 10.0);
  return c;
}

vec3 brick(vec2 uv, float fw) { // 回傳 (明度, 灰縫, 凹凸)
  vec2 s = vec2(0.46, 0.085);
  vec2 q = uv / s; q.x += 0.5 * floor(q.y);
  vec2 id = floor(q); vec2 f = fract(q);
  float e = min(min(f.x, 1.0 - f.x) * s.x, min(f.y, 1.0 - f.y) * s.y);
  float mortar = 1.0 - smoothstep(0.004, 0.012, e);
  float v = 0.72 + 0.5 * hash1(id);
  float k = smoothstep(0.012, 0.05, fw);
  return vec3(mix(v, 0.9, k), mix(mortar, 0.25, k), 0.0);
}

float rectm(vec2 uv, vec2 a, vec2 b) { vec2 d = min(uv - a, b - uv); return step(0.0, min(d.x, d.y)); }
vec3 screenUI(vec2 uv, float seed, float k) { // 工作站螢幕：剪輯介面，預覽窗播第 k 支作品
  float t = u.camPos.w; float sd = fract(seed * 0.618);
  vec3 c = vec3(0.012, 0.016, 0.026);
  vec2 va = vec2(0.04, 0.07); vec2 vb = vec2(0.64, 0.56);
  if (rectm(uv, va, vb) > 0.5) {
    vec2 v = (uv - va) / (vb - va);
    vec2 cell = vec2(k - 3.0 * floor(k / 3.0), floor(k / 3.0));
    vec2 a = vec2((cell.x + 0.02 + v.x * 0.96) / 3.0, (cell.y + 0.2 + v.y * 0.6) / 2.0 * u.fx.y);
    vec3 vid = textureLod(tex, a, 0.0).rgb;
    c = vid * vid * 1.1;
  }
  for (int j = 0; j < 4; j++) {
    float y0 = 0.07 + float(j) * 0.125;
    float lv = 0.25 + 0.7 * fract(sin(float(j) * 12.9 + sd * 40.0 + floor(t * (0.7 + sd)) * 3.1) * 43758.5);
    c = mix(c, vec3(0.07, 0.09, 0.13), rectm(uv, vec2(0.68, y0), vec2(0.96, y0 + 0.085)));
    c = mix(c, mix(vec3(0.30, 0.48, 0.70), vec3(0.55, 0.62, 0.66), float(j) / 3.0), rectm(uv, vec2(0.69, y0 + 0.03), vec2(0.69 + 0.26 * lv, y0 + 0.055)));
  }
  if (uv.y > 0.62 && uv.y < 0.95 && uv.x > 0.04 && uv.x < 0.96) {
    float v = (uv.y - 0.62) / 0.33; float row = floor(v * 4.0); float fy = fract(v * 4.0);
    float x = uv.x * (4.0 + row * 1.5) + t * (0.10 + 0.05 * sd) + row * 3.7 + sd * 11.0;
    float on = step(0.3, hash1(vec2(floor(x), row + sd * 9.0))) * step(0.05, fract(x)) * step(0.2, fy) * step(fy, 0.8);
    vec3 pal[4] = vec3[4](vec3(0.22, 0.38, 0.62), vec3(0.30, 0.52, 0.50), vec3(0.62, 0.46, 0.26), vec3(0.42, 0.36, 0.60));
    c = mix(vec3(0.03, 0.04, 0.06), pal[int(row)] * 0.85, on);
    c = mix(c, vec3(1.0, 0.3, 0.25), step(abs(uv.x - (0.2 + 0.6 * fract(t * 0.05 + sd))), 0.004));
  }
  return c;
}

// lite：不算逐燈光照，只留自發光與一點固定的環境光
vec3 shade(vec3 p, Hit h, vec3 rd, bool lite) {
  vec3 n = h.n; int m = int(h.mat + 0.5); float t = u.camPos.w; float on = u.camU.w;
  float fw = h.t * u.camF.w * 2.0 / u.res.y;
  vec3 alb = vec3(0.05); vec3 em = vec3(0.0); float spec = 0.0;
  vec2 wuv = abs(n.x) > 0.5 ? vec2(p.z, p.y) : vec2(p.x, p.y);

  if (m == 0) { // 深色長磚
    if (abs(n.y) < 0.5) {
      vec3 b = brick(wuv, fw / max(abs(dot(rd, n)), 0.1));
      alb = vec3(0.086, 0.078, 0.072) * b.x * (1.0 - 0.6 * b.y) * (0.9 + 0.2 * noise(wuv * vec2(0.5, 1.3)));
      float du = abs(fract(wuv.x / 3.0 + 0.5) - 0.5) * 3.0;
      float w = 0.07 + 0.085 * p.y;
      float inside = step(p.z, 0.0) * step(abs(p.x), 7.05);
      em = alb * WARM * 17.0 * on * exp(-du * du / (w * w)) * exp(-p.y * 0.62) * smoothstep(0.0, 0.2, p.y) * (1.0 - 0.8 * inside);
    } else { alb = vec3(0.03); }
  } else if (m == 1) { // 深色石材
    vec2 suv = abs(n.y) > 0.5 ? p.xz : wuv;
    float g = noise(suv * 1.1) * 0.14 + (noise(suv * 46.0) * 0.16 + noise(suv * 130.0) * 0.10) * (1.0 - smoothstep(0.003, 0.015, fw));
    alb = vec3(0.056, 0.056, 0.061) * (0.80 + g);
    if (abs(n.y) < 0.5) {
      float sx = abs(fract(suv.x / 1.15) - 0.5) * 1.15;
      alb *= 1.0 - 0.6 * smoothstep(0.566, 0.575, sx) * (1.0 - smoothstep(0.008, 0.03, fw));
    }
    spec = 0.3;
  } else if (m == 2) { // 稜紋發光玻璃
    float rib = 0.5 + 0.5 * cos(wuv.x * 3.14159 * 2.0 / 0.30);
    float yy = (p.y - GMIN.y) / (GMAX.y - GMIN.y);
    float bands = exp(-pow((yy - 0.24) * 5.5, 2.0)) + exp(-pow((yy - 0.74) * 5.5, 2.0));
    float col = floor(wuv.x / 0.30);
    float flow = pow(fract(yy * 0.5 - t * (0.04 + 0.06 * hash1(vec2(col, 3.0))) + hash1(vec2(col, 1.0))), 5.0);
    float breathe = 0.9 + 0.1 * sin(t * 0.7);
    float base = 0.13 + 0.62 * bands * breathe + 0.28 * flow * step(0.5, hash1(vec2(col, 7.0)));
    float rk = 1.0 - smoothstep(0.03, 0.12, fw);
    em = COOL * u.ex.y * base * mix(0.62, 0.22 + 0.78 * rib, rk) * 2.3;
    if (n.y < -0.5) { em = vec3(0.0); alb = vec3(0.02); }
    alb = vec3(0.10);
  } else if (m == 3) { // 影片螢幕（圖集）
    Box b = u.boxes[int(h.par + 0.5)];
    bool left = h.par < 0.5 + float(int(h.par)) && p.x < 0.0;
    vec2 uv = vec2((p.z - b.a.z) / (b.b.z - b.a.z), (b.b.y - p.y) / (b.b.y - b.a.y));
    vec2 a = vec2(0.0); float bez = 1.0;
    if (left) {
      uv.x = 1.0 - uv.x;
      vec2 g = uv * vec2(3.0, 2.0); vec2 f = fract(g);
      bez = smoothstep(0.0, 0.012, min(min(f.x, 1.0 - f.x) * 1.26, min(f.y, 1.0 - f.y)));
      a = vec2(uv.x, uv.y * u.fx.y);
    } else {
      a = vec2(uv.x, u.fx.z + uv.y * (1.0 - u.fx.z));
    }
    vec3 v = textureLod(tex, a, 0.0).rgb;
    em = (v * v * 1.15 + 0.004) * bez * on;
    alb = vec3(0.01);
  } else if (m == 4) { // 大廳後牆（暖色石材）
    float g = noise(wuv * 0.8) * 0.12 + (noise(wuv * 46.0) * 0.16 + noise(wuv * 130.0) * 0.10) * (1.0 - smoothstep(0.003, 0.015, fw));
    alb = vec3(0.044, 0.045, 0.049) * (0.80 + g);
    float sx = abs(fract(wuv.x / 2.4) - 0.5) * 2.4;
    alb *= 1.0 - 0.55 * smoothstep(1.185, 1.2, sx);
    alb *= 1.0 - 0.35 * smoothstep(0.012, 0.0, abs(p.y - 2.5));
    em = alb * vec3(1.0, 0.80, 0.58) * on * (4.6 * exp(-(5.0 - p.y) * 2.4) + 0.3 * exp(-p.y * 1.6) + 0.06);
  } else if (m == 5) { // 工作站螢幕
    Box b = u.boxes[int(h.par + 0.5)];
    if (n.z > 0.5) {
      vec2 uv = vec2((p.x - b.a.x) / (b.b.x - b.a.x), (b.b.y - p.y) / (b.b.y - b.a.y));
      float bz = smoothstep(0.0, 0.03, min(min(uv.x, 1.0 - uv.x), min(uv.y, 1.0 - uv.y)));
      em = screenUI(uv, h.par, clamp(round(((b.a.x + b.b.x) * 0.5 + 4.5) / 1.8), 0.0, 5.0)) * 1.5 * bz * on;
    }
    alb = vec3(0.01);
  } else if (m == 6) { // 黑色金屬
    alb = vec3(0.018); spec = 0.5;
  } else if (m == 11) { // 椅子（距離場）
    alb = vec3(0.085, 0.085, 0.092); spec = 0.6;
  } else if (m == 8) { // 大廳天花：深色木格柵
    if (n.y < -0.5) {
      float f = fract(p.z / 0.24);
      float fade = smoothstep(0.04, 0.14, fw / max(abs(dot(rd, n)), 0.08));
      float slat = mix(smoothstep(0.0, 0.06, f) * smoothstep(0.66, 0.60, f), 0.62, fade);
      alb = vec3(0.022, 0.017, 0.013) * (0.75 + 0.5 * noise(vec2(p.x * 0.6, floor(p.z / 0.24) * 3.1)) * (1.0 - fade)) * (0.12 + 0.88 * slat);
    } else { alb = vec3(0.018); spec = 0.5; }
  } else if (m == 7) { // 接待服務螢幕：呼吸的光環
    Box b = u.boxes[int(h.par + 0.5)];
    if (n.z > 0.5) {
      vec2 uv = vec2((p.x - b.a.x) / (b.b.x - b.a.x), (b.b.y - p.y) / (b.b.y - b.a.y)) - 0.5;
      float nb2 = 22.0; float bi = floor((uv.x + 0.5) * nb2); float fx2 = fract((uv.x + 0.5) * nb2);
      float env = exp(-pow((bi / nb2 - 0.5) * 3.2, 2.0));
      float amp = 0.04 + 0.36 * env * (0.35 + 0.65 * abs(sin(t * (2.0 + 1.3 * hash1(vec2(bi, 2.0))) + bi * 1.7)));
      float bar = step(abs(uv.y), amp) * step(0.22, fx2) * step(fx2, 0.78) * step(abs(uv.x), 0.42);
      em = vec3(0.45, 0.80, 1.0) * bar * 2.6 * on + vec3(0.004, 0.007, 0.012);
    }
    alb = vec3(0.01);
  }
  // 石材與金屬的邊緣做一點倒角：靠近方塊邊線時把法線往相鄰的面偏
  vec3 nb = n; float edge = 0.0;
  if (m == 11) { edge = 1.5 + 6.0 * pow(1.0 - abs(dot(rd, n)), 2.0); } // 椅子：輪廓光
  if (m == 1 || m == 6) {
    Box bx = u.boxes[int(h.id + 0.5)];
    vec3 da = p - bx.a.xyz; vec3 db = bx.b.xyz - p;
    float r = max(0.014, fw * 1.4);
    vec3 w = (1.0 - clamp(min(da, db) / r, vec3(0.0), vec3(1.0))) * (1.0 - abs(n));
    nb = normalize(n + sign(da - db) * w * w * 1.2);
    edge = max(w.x, max(w.y, w.z));
  }
  vec3 Lt = vec3(0.016, 0.020, 0.030);
  if (!lite) { Lt = lighting(p, nb); }
  vec3 c = alb * Lt + em + Lt * 0.035 * edge; // 邊緣多一點受光，當成倒角的高光
  if (spec > 0.0) { // 石材與金屬帶一點天空與玻璃量體的反光
    vec3 r = reflect(rd, n);
    c += spec * 0.06 * sky(vec3(r.x, abs(r.y), r.z)) * pow(1.0 - max(dot(-rd, n), 0.0), 3.0);
  }
  return c;
}

vec4 ground(vec3 p, vec3 rd, float t) { // rgb = 顏色, a = 反射率
  float on = u.camU.w;
  float fw = t * u.camF.w * 2.0 / u.res.y;
  vec2 s = vec2(1.2, 0.6);
  vec2 q = p.xz / s; q.x += 0.5 * floor(q.y);
  vec2 id = floor(q); vec2 f = fract(q);
  float e = min(min(f.x, 1.0 - f.x) * s.x, min(f.y, 1.0 - f.y) * s.y);
  float joint = (1.0 - smoothstep(0.003, 0.012, e)) * (1.0 - smoothstep(0.01, 0.06, fw));
  float g = noise(p.xz * 0.7) * 0.5 + noise(p.xz * 5.0) * 0.2;
  vec3 alb = vec3(0.034, 0.033, 0.036) * (0.62 + 0.35 * hash1(id) * (1.0 - smoothstep(0.02, 0.12, fw)) + g * 0.5) * (1.0 - 0.6 * joint);
  vec3 c = alb * lighting(p, vec3(0.0, 1.0, 0.0));
  int nl = int(u.res.w);
  for (int i = 0; i < nl; i++) {
    Line L = u.lines[i];
    if (L.a.y < 0.12) {
      vec2 a = L.a.xz; vec2 ab = L.b.xz - a;
      float d = length(p.xz - (a + ab * clamp(dot(p.xz - a, ab) / dot(ab, ab), 0.0, 1.0)));
      float pw = pulse(float(i)) * on;
      vec3 col = WARM; if (L.b.w < 0.0) { col = vec3(0.78, 0.85, 0.96); }
      c += col * pw * (smoothstep(0.04 + fw, 0.018, d) * 4.2 + alb * 15.0 * exp(-d * 6.5) + alb * 0.5 / (1.0 + d * d * 2.0));
    }
  }
  float rough = 0.35 + 0.5 * g;
  return vec4(c, (1.0 - 0.7 * joint) * (1.15 - rough));
}

// 視線與線段的最近距離，用來畫光暈
float halo(vec3 ro, vec3 rd, float tmax, vec3 a, vec3 b) {
  vec3 ab = b - a; vec3 ao = a - ro;
  float d1 = dot(rd, ab); float d2 = dot(ab, ab);
  float den = d2 - d1 * d1;
  float s = 0.0;
  if (den > 1e-5) { s = clamp((d1 * dot(rd, ao) - dot(ab, ao)) / den, 0.0, 1.0); }
  vec3 q = a + ab * s;
  float tr = dot(q - ro, rd);
  if (tr < 0.0 || tr > tmax + 0.05) { return 0.0; }
  float d = length(q - (ro + rd * tr));
  float w = max(0.018, tr * u.camF.w * 2.0 / u.res.y);
  float core = smoothstep(w, w * 0.25, d) * min(1.0, 0.018 / w * 3.0);
  return core * 1.9 + 0.0011 / (d * d + 0.0045) * min(1.0, 20.0 / (tr + 1.0));
}

// 霧、光暈、色調映射、暗角、顆粒：每個像素最後都過這一段。tt 是到表面的距離（天空給很大的值）
vec4 finish(vec3 cin, float tt, vec3 rd, vec4 fc, bool fogOn) {
  vec3 ro = u.camPos.xyz; float on = u.camU.w; float t = u.camPos.w;
  vec3 col = cin;
  if (fogOn) { col = mix(col, vec3(0.008, 0.014, 0.034), 1.0 - exp(-tt * 0.0025)); } // 薄霧
  int nl = int(u.res.w);
  for (int i = 0; i < nl; i++) {
    Line L = u.lines[i];
    vec3 lc = WARM; if (L.b.w < 0.0) { lc = vec3(0.78, 0.85, 0.96); }
    col += lc * halo(ro, rd, tt, L.a.xyz, L.b.xyz) * abs(L.b.w) * on * pulse(float(i));
  }
  {
    vec3 c = (GMIN + GMAX) * 0.5; float tc = max(dot(c - ro, rd), 0.0);
    vec3 q = ro + rd * min(tc, tt);
    vec3 d = max(abs(q - c) - (GMAX - GMIN) * 0.5, vec3(0.0));
    col += COOL * u.ex.y * 0.032 * exp(-length(d) * 0.55) * (0.9 + 0.1 * sin(t * 0.7));
  }
  col = max(col * 1.25 - vec3(0.0012), vec3(0.0));
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2));
  col = mix(col, col * col * (3.0 - 2.0 * col), 0.38); // 對比：暗部更黑、亮線更亮
  vec2 ndc = vec2(fc.x / u.res.x * 2.0 - 1.0, 1.0 - fc.y / u.res.y * 2.0);
  vec2 vg = ndc * vec2(0.55, 0.62);
  col *= 1.0 - 0.38 * dot(vg, vg);
  col += (hash1(floor(fc.xy) + fract(t) * 97.0) - 0.5) * (0.008 + 0.02 * max(col.r, max(col.g, col.b)));
  return vec4(col, 1.0);
}

vec3 viewRay(vec4 fc) {
  vec2 ndc = vec2(fc.x / u.res.x * 2.0 - 1.0, 1.0 - fc.y / u.res.y * 2.0);
  vec3 rd = normalize(u.camF.xyz + u.camR.xyz * (ndc.x * u.camF.w * u.camR.w) + u.camU.xyz * (ndc.y * u.camF.w));
  rd += vec3(1e-5) * step(abs(rd), vec3(1e-5));
  return rd;
}

vec3 tone(vec3 c0) {
  vec3 col = max(c0 * 1.25 - vec3(0.0012), vec3(0.0));
  col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
  col = pow(clamp(col, vec3(0.0), vec3(1.0)), vec3(1.0 / 2.2));
  return mix(col, col * col * (3.0 - 2.0 * col), 0.38);
}

// 畫面座標換成原點在左上（與 WebGPU 相同），上面的算式才能照抄
vec4 FC() { return vec4(gl_FragCoord.x, u.res.y - gl_FragCoord.y, gl_FragCoord.z, gl_FragCoord.w); }
`;

const VARY_IN = /* glsl */ `
in vec3 vWp;        // 真實的世界座標（畫倒影時也是沒顛倒的）
flat in vec3 vN;
flat in vec3 vM;    // 材質、par、方塊編號
`;

export const GLSL = {
  vsBox: HEAD + /* glsl */ `
layout(location = 0) in vec3 aPos;
layout(location = 1) in vec3 aN;
layout(location = 2) in vec3 aM;
out vec3 vWp;
flat out vec3 vN;
flat out vec3 vM;
invariant gl_Position; // 「只寫深度」與「深度相等才上色」是兩支程式，位置要算得一模一樣
void main() {
  vN = aN; vM = aM;
  vec3 pw = aPos; bool hide = false;
  if (aM.x > 11.5) { // 玻璃板：平常沉在地面裡，打開才升起（VIP 先、兩側後）
    float base = 0.02; float k = smoothstep(0.0, 1.0, u.misc.y * 1.5 - abs(aM.y - 1.0) * 0.5);
    pw.y = base + (aPos.y - base) * k; hide = k < 0.003;
  }
  vWp = pw;
  vec3 pv = pw; if (u.misc.x > 0.5) { pv.y = -pv.y; } // 倒影：鏡頭看到的是上下顛倒的場景
  vec3 d = pv - u.camPos.xyz; float z = dot(d, u.camF.xyz);
  float zc = (z - NEAR) * FAR / (FAR - NEAR); // WebGPU 的裁切 z（0..w）；WebGL 要 -w..w
  gl_Position = vec4(dot(d, u.camR.xyz) / (u.camF.w * u.camR.w), dot(d, u.camU.xyz) / u.camF.w, 2.0 * zc - z, z);
  if (hide) { gl_Position = vec4(0.0, 0.0, -2.0, 1.0); }
}`,

  vsSky: HEAD + /* glsl */ `
void main() {
  gl_Position = vec4(float((gl_VertexID << 1) & 2) * 2.0 - 1.0, float(gl_VertexID & 2) * 2.0 - 1.0, 1.0, 1.0);
}`,

  fsPre: /* glsl */ `#version 300 es
precision highp float;
out vec4 o;
void main() { o = vec4(0.0); }`, // 只寫深度的那一次

  fsBox: HEAD + COMMON + VARY_IN + /* glsl */ `
out vec4 o;
void main() {
  vec4 fc = FC();
  vec3 ro = u.camPos.xyz; vec3 p = vWp; bool mir = u.misc.x > 0.5;
  vec3 pv = p; if (mir) { pv.y = -pv.y; }
  vec3 dv = pv - ro; float tt = length(dv);
  vec3 rd = dv / tt;
  if (mir) { rd.y = -rd.y; } // 經地面反射之後，實際打到 p 的方向
  rd += vec3(1e-5) * step(abs(rd), vec3(1e-5));
  Hit h; h.t = tt; h.n = vN; h.mat = vM.x; h.par = vM.y; h.id = vM.z;
  if (mir) {
    vec3 c = shade(p, h, rd, u.ex.z < 0.5);
    float t2 = tt * p.y / (ro.y + p.y);
    o = vec4(c * exp(-t2 * 0.012), 1.0);
    return;
  }
  vec3 col = vec3(0.0);
  if (h.mat > 8.5 && h.mat < 9.5) {
    vec4 g = ground(p, rd, tt);
    col = g.rgb;
    float w = noise(p.xz * 3.0) - 0.5; float w2 = noise(p.zx * 3.0 + 7.0) - 0.5;
    vec2 uv = fc.xy / u.res.xy + vec2(w, w2) * 0.0014;
    vec3 rc = textureLod(refl, vec2(uv.x, 1.0 - uv.y), 0.0).rgb; // 倒影圖在 WebGL 是上下顛倒存的
    float fres = 0.05 + 0.95 * pow(1.0 - max(-rd.y, 0.0), 4.0);
    col += rc * g.a * (0.11 + 0.62 * fres);
  } else {
    col = shade(p, h, rd, false);
  }
  o = finish(col, tt, rd, fc, true);
}`,

  fsSky: HEAD + COMMON + /* glsl */ `
out vec4 o;
void main() {
  vec4 fc = FC();
  vec3 rd = viewRay(fc);
  if (u.misc.x > 0.5) { rd.y = -rd.y; o = vec4(sky(rd) * 0.6, 1.0); return; }
  o = finish(sky(rd), 1e9, rd, fc, false);
}`,

  // 浮空的玻璃板（三個方案）：半透明，疊在畫好的場景上
  fsGlass: HEAD + COMMON + VARY_IN + /* glsl */ `
out vec4 o;
void main() {
  vec3 ro = u.camPos.xyz; vec3 p = vWp; bool mir = u.misc.x > 0.5; float on = u.camU.w;
  vec3 pv = p; if (mir) { pv.y = -pv.y; }
  vec3 dv = pv - ro; float tt = length(dv); vec3 rd = dv / tt;
  if (mir) { rd.y = -rd.y; }
  vec3 n = vN; float ndv = -dot(rd, n);
  if (ndv <= 0.0) { discard; } // 背向鏡頭的面不畫
  float fw = tt * u.camF.w * 2.0 / u.res.y;
  Box b = u.boxes[int(vM.z + 0.5)];
  vec2 sz = b.b.xy - b.a.xy; vec2 q = (p.xy - b.a.xy) / sz;
  float e = min(min(q.x, 1.0 - q.x) * sz.x, min(q.y, 1.0 - q.y) * sz.y);
  float vip = step(0.5, vM.y) * step(vM.y, 1.5);
  vec3 ec = mix(COOL, WARM, vip); // VIP 那一片的邊線是暖色
  vec3 col = ec * 1.1; float a = 0.95; // 側面與頂面：玻璃的斷面，整條發亮
  if (abs(n.z) > 0.5) {
    float fres = pow(1.0 - ndv, 3.0);
    float rim = smoothstep(0.005 + fw * 1.6, fw * 0.3, e);
    col = vec3(0.002, 0.003, 0.005)
        + ec * (rim * 2.2 + 0.06 * exp(-e * 26.0) + 0.11 * exp(-q.y * sz.y * 2.4))
        + COOL * (0.004 + 0.22 * fres);
    a = clamp(0.34 + 0.5 * fres + rim, 0.0, 0.97);
  }
  col *= on;
  if (mir) { o = vec4(col * exp(-tt * p.y / (ro.y + p.y) * 0.012), a); return; }
  o = vec4(tone(col), a);
}`,

  // 椅子：畫的是那一排的外框，在裡面沿視線步進距離場，打到才上色並寫入真正的深度
  fsChair: HEAD + COMMON + VARY_IN + /* glsl */ `
out vec4 o;
void main() {
  vec3 ro = u.camPos.xyz;
  vec3 rd = normalize(vWp - ro);
  rd += vec3(1e-5) * step(abs(rd), vec3(1e-5));
  float t = -1.0;
  if (gl_FrontFacing) { t = marchChairs(ro, rd); }
  if (t < 0.0) { discard; }
  vec3 p = ro + rd * t;
  Hit h; h.t = t; h.n = chairN(p); h.mat = 11.0; h.par = 0.0; h.id = 0.0;
  o = finish(shade(p, h, rd, false), t, rd, FC(), true);
  float z = dot(p - ro, u.camF.xyz);
  gl_FragDepth = (z - NEAR) * FAR / ((FAR - NEAR) * z);
}`,
};
