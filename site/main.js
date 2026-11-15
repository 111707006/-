// FG STUDIO — The Creative District（樣本）
// 直接用 WebGPU，不用引擎；場景由程式生成，文字全部在 HTML。
// 沒有 WebGPU 的瀏覽器改走 WebGL2（gl.js、shader-gl.js），畫面相同。
import { WGSL, MAX_BOXES, MAX_LINES } from './shader.js';
import { initGL } from './gl.js';

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
let i = box(-10.0, 1.5, 10.5, -9.88, 7.3, 21.5, 3); boxes[i][7] = i; const B_LEFT = i;
i = box(9.88, 1.5, 10.5, 10.0, 7.69, 21.5, 3); boxes[i][7] = i; const B_RIGHT = i;
// 螢幕外框
box(-10.0, 1.38, 10.38, -9.93, 7.42, 21.62, 6); box(9.93, 1.38, 10.38, 10.0, 7.81, 21.62, 6);
// 長凳
for (const s of [-1, 1]) {
  box(Math.min(s * 7.4, s * 8.6), 0.40, 12.5, Math.max(s * 7.4, s * 8.6), 0.52, 19.5, 1); // 石板座面
  box(Math.min(s * 7.55, s * 8.45), 0, 12.7, Math.max(s * 7.55, s * 8.45), 0.40, 19.3, 6);   // 內縮的底座
}
// 接待櫃檯、櫃檯上的服務螢幕
const B_DESK = box(-4.6, 0.1, 1.6, 4.6, 1.12, 3.0, 1);
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

// 浮空的玻璃板（材質 12，par = 第幾片）：方案三片（VIP 在中間、較高）。
// 平常沉在地面裡看不到，打開才升起（shader.js 的 vsBox）。
// 半透明，另外一道繪製（fsGlass），所以排在方塊清單最後、不進不透明的那幾次繪製。y0 要與 vsBox 裡的 base 相同
const GL = [
  { x: -1.95, w: 1.6, y0: 0.02, y1: 2.5, z: -4.6 }, { x: 0, w: 1.6, y0: 0.02, y1: 2.85, z: -4.6 }, { x: 1.95, w: 1.6, y0: 0.02, y1: 2.5, z: -4.6 },
];
GL.forEach((g, k) => { g.i = box(g.x - g.w / 2, g.y0, g.z - 0.05, g.x + g.w / 2, g.y1, g.z, 12, k); });

// ---------- 線光源 [ax,ay,az,強度, bx,by,bz,光暈（負值=冷色）] ----------
const lines = [];
for (const z of [7, 11, 15, 19, 23, 27]) { const hl = 2.0 + 0.21 * z; lines.push([-hl, 0.03, z, 0.7, hl, 0.03, z, 0.28]); }
lines.push([-4.5, 0.06, 3.06, 1.6, 4.5, 0.06, 3.06, 0.6]);             // 櫃檯底
lines.push([-8.55, 0.08, 12.5, 0.9, -8.55, 0.08, 19.5, 0.35], [8.55, 0.08, 12.5, 0.9, 8.55, 0.08, 19.5, 0.35]); // 長凳底
for (const z of [-2.6, -6.5, -10.4]) lines.push([-5.2, 4.96, z, 2.6, 5.2, 4.96, z, 0.6]); // 大廳天花
lines.push([-5.3, 0.05, -9.25, 1.5, 5.3, 0.05, -9.25, 0.3]);            // 長桌底
// 「BEYOND THE FRAME」：大廳入口的冷色光框，鏡頭會穿過它
{ const z = 0.45, w = 7.0, y0 = 0.04, y1 = 5.22, I = 0.5, H = -0.4;
  lines.push([-w, y0, z, I, w, y0, z, H], [-w, y1, z, I, w, y1, z, H], [-w, y0, z, I, -w, y1, z, H], [w, y0, z, I, w, y1, z, H]); }
// 玻璃板腳下的冷色燈線：亮度每一格跟著玻璃升起的進度改（frame() 裡），沒升起時是 0
GL.forEach((g) => { g.li = lines.push([g.x - g.w / 2, g.y0 + 0.01, g.z + 0.04, 0, g.x + g.w / 2, g.y0 + 0.01, g.z + 0.04, 0]) - 1; });

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
// 左牆六格＝六種溝通情境，一格一種（對應依檔名推測，待負責人確認）。只標情境，不標客戶
const SCN = [
  ['sleepygulls-brand-film', '品牌介紹', 'BRAND INTRODUCTION'], ['ys-01-new-device', '產品說明', 'PRODUCT EXPLAINER'], ['sg-04-mattress-sagging', '客服與常見問題', 'SUPPORT & FAQ'],
  ['ueis-milk-protein-lab', '教育訓練', 'TRAINING'], ['ueis-thanksgiving-trailer-2026', '校園政策與活動', 'CAMPUS POLICY & EVENTS'], ['sg-02-fabric-pattern', '社群宣傳', 'SOCIAL CONTENT'],
];
const WALL = SCN.map((s) => s[0]);
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
const dots = [...document.querySelectorAll('.rail .dot')];
// 螢幕牆的六格：每格一顆貼在牆面上的按鈕（標題寫在格子左下角），點了鏡頭走到那一格正前方播放完整影片
const TW = 11 / 3, TH = 2.9; // 一格的寬、高（公尺）
let focus = -1, fTile = 0, fK = 0; // fK：鏡頭走向那一格的進度
const playEl = $('#play'), playV = playEl.querySelector('video');
const tiles = SCN.map(([id, zh, en], k) => {
  const c = k % 3, r = Math.floor(k / 3), el = document.createElement('button');
  el.className = 'wl tile'; el.dataset.o = `-9.86,${7.3 - r * TH},${21.5 - c * TW}`; el.dataset.r = '0,0,-1'; el.dataset.s = '0.005'; el.dataset.stops = '2'; el.dataset.seq = k + 1;
  el.addEventListener('click', (e) => { e.stopPropagation(); openTile(k); });
  document.body.append(el);
  // 播放範圍：影片在這一格裡不裁切時佔的大小（橫式貼齊格寬，直式貼齊格高）
  const vert = /^(sg|ys)-/.test(id), w = vert ? TH * 9 / 16 : TW, h = vert ? TH : TW * 9 / 16;
  return { el, id, w, h, c: [-9.87, 7.3 - (r + 0.5) * TH, 21.5 - (c + 0.5) * TW] };
});
// 玻璃板上的內容（index.html 的 #g0–#g2）：原點在玻璃正面的左上角，寬固定 1000px
const glassEls = GL.map((g, k) => {
  const el = $(`#g${k}`), s = g.w / 1000;
  el.dataset.o = `${g.x - g.w / 2},${g.y1},${g.z + 0.012}`; el.dataset.r = '1,0,0'; el.dataset.s = s; el.style.height = `${(g.y1 - g.y0) / s}px`;
  return el;
});
const labels = [...document.querySelectorAll('.wl')].map((el) => ({
  g: glassEls.indexOf(el),
  el, o: el.dataset.o.split(',').map(Number), r: el.dataset.r.split(',').map(Number), s: +el.dataset.s, stops: (el.dataset.stops || '').split(',').filter(Boolean).map(Number),
  seq: +(el.dataset.seq || 0), tile: el.classList.contains('tile'), play: el === playEl,
}));
const playL = labels.find((L) => L.play);
function openTile(k) {
  const t = tiles[k]; focus = fTile = k;
  playL.o = [-9.86, t.c[1] + t.h / 2, t.c[2] + t.w / 2]; playEl.style.width = `${t.w / playL.s}px`; playEl.style.height = `${t.h / playL.s}px`;
  playV.poster = `${MEDIA}posters/${tiles[k].id}.jpg`; playV.src = `${MEDIA}web/${tiles[k].id}.mp4`;
  if (!qs.has('focus')) playV.play().catch(() => {});
  document.documentElement.classList.add('lock');
}
function closeTile() {
  if (focus < 0) return;
  focus = -1; playV.pause(); document.documentElement.classList.remove('lock'); tiles[fTile].el.focus({ preventScroll: true });
}
if (qs.has('focus')) { openTile(+qs.get('focus')); fK = 1; } // 除錯：?t=2&focus=4 直接停在第 4 格前面
playEl.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); closeTile(); });
addEventListener('click', (e) => { if (focus >= 0 && !playEl.contains(e.target)) closeTile(); });
addEventListener('wheel', () => closeTile(), { passive: true }); // 一捲動就退回原位
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeTile(); });
// ---------- 方案：內容在三片浮空的玻璃板上 ----------
// 按了才升起，鏡頭同時走到正前方；關掉就沉回去、鏡頭沿原路退回。直式螢幕一次看一片，用底下的頁籤換
let view = '', vK = 0, vSel = 1, vX = 0, riseP = 0;
const riseK = (k) => Math.min(Math.max(riseP * 1.5 - Math.abs(k - 1) * 0.5, 0), 1);
const selBtns = [...document.querySelectorAll('#vbar [data-sel]')];
const setSel = (k) => { vSel = k; selBtns.forEach((b) => b.classList.toggle('on', +b.dataset.sel === k)); };
function openView(v) {
  closeTile(); view = v; document.body.dataset.view = v; document.documentElement.classList.add('lock');
}
function closeView() {
  if (!view) return;
  view = ''; delete document.body.dataset.view; document.documentElement.classList.remove('lock');
}
// 靜態版本沒有場景：玻璃板的內容直接攤平排在畫面中央
function flat() {
  const show = view === 'plans' ? (innerWidth > innerHeight * 1.15 ? [0, 1, 2] : [vSel]) : [];
  glassEls.forEach((el, k) => {
    const j = show.indexOf(k); el.style.opacity = j < 0 ? 0 : 1; el.classList.toggle('hot', j >= 0); if (j < 0) return;
    const h = parseFloat(el.style.height), cw = innerWidth * 0.94 / show.length, sc = Math.min((cw - 16) / 1000, innerHeight * 0.76 / h);
    el.style.transform = `translate(${innerWidth * 0.03 + cw * j + (cw - 1000 * sc) / 2}px, ${(innerHeight - h * sc) / 2 + 12}px) scale(${sc})`;
  });
}
setSel(1);
document.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); openView(b.dataset.view); }));
// 玻璃上的按鈕：玻璃沉回去，帶著選的方案走到接待櫃檯那一站；那裡的「開始洽談」會把方案寫進信件主旨
const talk = $('#talk'), MAIL = talk.getAttribute('href').split('?')[0];
document.querySelectorAll('.go[data-plan]').forEach((b) => b.addEventListener('click', (e) => {
  e.stopPropagation(); talk.href = `${MAIL}?subject=${encodeURIComponent(lang === 'en' ? 'FG STUDIO Inquiry: ' + (b.dataset.planEn || b.dataset.plan) : 'FG STUDIO 洽談：' + b.dataset.plan)}`; talk.dataset.plan = b.dataset.plan;
  closeView(); goto(4);
}));
selBtns.forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setSel(+b.dataset.sel); }));
$('#vbar .x').addEventListener('click', (e) => { e.stopPropagation(); closeView(); });
addEventListener('click', (e) => { if (view === 'plans' && !e.target.closest('.glass, #vbar')) closeView(); });
addEventListener('wheel', () => { if (view === 'plans') closeView(); }, { passive: true });
addEventListener('keydown', (e) => { if (e.key === 'Escape') closeView(); });
if (qs.has('view')) { // 除錯：?t=3&view=plans（直式可加 &sel=0）直接停在玻璃前面
  openView('plans'); vK = riseP = 1;
  if (qs.has('sel')) setSel(+qs.get('sel'));
  vX = innerWidth <= innerHeight * 1.15 ? GL[vSel].x : 0;
}
const vh = () => innerHeight;
const SEG = 1.25; // 每一站的捲動長度（倍螢幕高）
const setHeight = () => { $('#track').style.height = `${(STOPS * SEG + 1) * 100}vh`; };
setHeight();
const scrollT = () => Math.min(Math.max(scrollY / (SEG * vh()), 0), STOPS);
const goto = (s) => scrollTo({ top: s * SEG * vh() + 1, behavior: 'smooth' });
// 直接飛過去：捲動位置立刻換到那一站，鏡頭從現在的位置直線移過去（frame() 裡），不沿路徑經過中間的站
let jumpTo = -1, jump = null, lastC = null;
const fly = (s) => { jumpTo = s; scrollTo({ top: s * SEG * vh() + 1, behavior: 'instant' }); };
dots.forEach((b, k) => b.addEventListener('click', () => goto(k)));
document.querySelectorAll('[data-go]').forEach((b) => b.addEventListener('click', () => { closeView(); goto(+b.dataset.go); }));
// 上一站／下一站：一路往下滑不一定剛好停在站點上（說明要靠近站點才出現），按一下就走到下一站
const prevB = $('.rail .prev'), nextB = $('.rail .next');
const step = (d) => { closeView(); goto(Math.min(Math.max(Math.round(scrollT()) + d, 0), STOPS)); };
prevB.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
nextB.addEventListener('click', (e) => { e.stopPropagation(); step(1); });

// 六種情境的選單：說明旁邊的按鈕打開，選一支就跟點牆上那一格一樣（鏡頭走過去播放）
const pickBtn = $('#pickBtn'), pickMenu = $('#pickMenu');
const showMenu = (on) => { pickMenu.hidden = !on; pickBtn.setAttribute('aria-expanded', on); };
pickBtn.addEventListener('click', (e) => { e.stopPropagation(); showMenu(pickMenu.hidden); });
pickMenu.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  e.stopPropagation(); showMenu(false); openTile(+b.dataset.k);
});

// ---------- 語言：預設是原本的中英混排（zh），EN 是全英文 ----------
// index.html 裡有 data-en 的元素：中文是原本的內容，英文寫在 data-en；aria-label 的英文寫在 data-en-label
let lang = 'zh', noteMsg = '';
const i18n = [...document.querySelectorAll('[data-en]')].map((el) => ({ el, zh: el.innerHTML, en: el.dataset.en }));
const i18nLabel = [...document.querySelectorAll('[data-en-label]')].map((el) => ({ el, zh: el.getAttribute('aria-label'), en: el.dataset.enLabel }));
const NOTE = { // 靜態版本的提示：一般（不支援）、跑太慢、顯示裝置中斷
  '': ['此裝置無法顯示 3D 場景，顯示靜態版本', 'This device can’t show the 3D scene. Showing the static version.'],
  'too slow': ['此裝置跑 3D 場景太吃力，顯示靜態版本', 'The 3D scene is too heavy for this device. Showing the static version.'],
  'device lost': ['顯示裝置中斷，顯示靜態版本（重新整理可再試一次）', 'Graphics device lost. Showing the static version (reload to try again).'],
};
const EN_TITLE = "FG STUDIO | GVS Brand Video Production & Long-Term Short-Form Video", EN_DESC = "GVS (Global Video Service) by FG STUDIO: long-term video production for brands, companies and schools. Brand introductions, product explainers, support & FAQ, training, campus policy & events, social content. From NT$2,000 per video; VIP covers 15 videos a month.";
const metaEl = (sel) => document.querySelector(sel);
const META = [[document, 'title', document.title, EN_TITLE], ...['meta[name=description]', 'meta[property="og:description"]', 'meta[name="twitter:description"]'].map((s) => [metaEl(s), 'content', metaEl(s)?.content, EN_DESC]),
  ...['meta[property="og:title"]', 'meta[name="twitter:title"]'].map((s) => [metaEl(s), 'content', metaEl(s)?.content, EN_TITLE])];
const titleCase = (t) => t.toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace('Faq', 'FAQ');
function setLang(l) {
  lang = l === 'en' ? 'en' : 'zh'; const en = lang === 'en';
  document.documentElement.lang = en ? 'en' : 'zh-Hant';
  META.forEach(([el, attr, zh, e2]) => { if (el) el[attr] = en ? e2 : zh; }); // 標題與摘要跟著語言換（搜尋引擎與分享預覽用）
  if (qs.get('lang')) document.querySelector('link[rel=canonical]')?.setAttribute('href', location.origin + location.pathname + (en ? '?lang=en' : ''));
  i18n.forEach((x) => { x.el.innerHTML = en ? x.en : x.zh; });
  i18nLabel.forEach((x) => x.el.setAttribute('aria-label', en ? x.en : x.zh));
  SCN.forEach(([, zh, e2], k) => {
    tiles[k].el.setAttribute('aria-label', en ? `Play example: ${titleCase(e2)}` : `播放範例：${zh}`);
    tiles[k].el.innerHTML = `<span class="cap"><b>0${k + 1}</b><span>${en ? e2 : zh}</span><i>${en ? '' : e2}</i></span>`;
  });
  pickMenu.innerHTML = SCN.map(([, zh, e2], k) => `<button data-k="${k}"><b>0${k + 1}</b>${en ? titleCase(e2).replace('&', '&amp;') : zh}</button>`).join('');
  $('.note').textContent = (NOTE[noteMsg] || NOTE[''])[en ? 1 : 0];
  document.querySelectorAll('.lang [data-lang]').forEach((b) => { const on = b.dataset.lang === lang; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on); });
  try { localStorage.setItem('lang', lang); } catch {}
}
document.querySelectorAll('.lang [data-lang]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); setLang(b.dataset.lang); }));
{ let saved = null; try { saved = localStorage.getItem('lang'); } catch {} setLang(qs.get('lang') || saved || 'zh'); } // ?lang=en 可以直接開英文版
addEventListener('keydown', (e) => {
  if (focus >= 0 || view) return;
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

// ---------- 點場景裡的東西就走過去 ----------
// 右牆螢幕 → 形象影片那一站、左牆螢幕 → 螢幕牆、大廳開口（櫃檯）→ 接待櫃檯。
// 從鏡頭往點的位置打一條線，找最先碰到的方塊（被牆擋住的就點不到）；已經在那一站就不動
let camS = null; // frame() 每一格記下當下的鏡頭
function pick(cx, cy) {
  if (!camS || view || focus >= 0) return -1;
  const { p, f, r, up, tanH, aspect } = camS, x = (cx / innerWidth * 2 - 1) * tanH * aspect, y = (1 - cy / innerHeight * 2) * tanH;
  const d = [0, 1, 2].map((j) => f[j] + r[j] * x + up[j] * y);
  let best = 1e9, hit = -1;
  boxes.forEach((b, k) => {
    if (b[3] === 12) return;
    let t0 = 0, t1 = 1e9;
    for (let j = 0; j < 3; j++) {
      const inv = 1 / (Math.abs(d[j]) < 1e-6 ? 1e-6 : d[j]), a = (b[j] - p[j]) * inv, c = (b[j + 4] - p[j]) * inv;
      t0 = Math.max(t0, Math.min(a, c)); t1 = Math.min(t1, Math.max(a, c));
    }
    if (t0 <= t1 && t0 < best) { best = t0; hit = k; }
  });
  // 大廳裡面（櫃檯、後牆、天花、作業中心）從遠處看很小，整個開口都算櫃檯那一站；人已經在櫃檯時，點後面的工作站才是去作業中心
  const cur = Math.round(scrollT()), m = hit < 0 ? -1 : boxes[hit][3], lobby = hit === B_DESK || m === 4 || m === 8 || hit >= nOuter;
  const stop = hit === B_RIGHT ? 1 : hit === B_LEFT ? 2 : lobby ? (cur === 4 && hit >= nOuter ? 3 : 4) : -1;
  return stop === cur ? -1 : stop;
}
const free = (e) => !e.target.closest('button, a, input, video, .glass, #vbar, #lightbox');
canvas.addEventListener('click', () => {}); // iOS Safari：元素自己沒有 click 監聽的話，點它不會送出 click，下面掛在 window 上的就收不到
addEventListener('click', (e) => { if (!free(e)) return; const s = pick(e.clientX, e.clientY); if (s >= 0) fly(s); });
addEventListener('pointermove', (e) => { document.body.classList.toggle('pick', e.pointerType === 'mouse' && free(e) && pick(e.clientX, e.clientY) >= 0); });

let introK = 1; // 開場鏡頭的進度：0 最遠，1 就定位
function ui(T) {
  const s = Math.round(T), near = 1 - Math.min(Math.abs(T - s) * 3.2, 1);
  panels.forEach((p, k) => { const on = k === s && near > 0.25 && (k !== 0 || introK > 0.82) && !view && focus < 0; p.classList.toggle('on', on); p.style.setProperty('--k', k === s ? near : 0); });
  dots.forEach((d, k) => d.classList.toggle('on', k === s));
  prevB.disabled = s === 0; nextB.disabled = s === STOPS;
  if (s !== 2 && !pickMenu.hidden) showMenu(false);
  document.body.dataset.stop = s;
}

// ---------- 啟動 ----------
function fallback(msg) {
  document.body.classList.add('nogpu'); introK = 1;
  console.warn('3D unavailable:', msg);
  noteMsg = msg; setLang(lang); // 提示要說實話：跑太慢或顯示裝置中斷，不是「不支援」
  const loop = () => { ui(scrollT()); flat(); requestAnimationFrame(loop); }; loop();
}

async function start() {
  if (qs.has('nogpu')) return fallback('forced'); // ?nogpu：強制看靜態版本
  // 先試 WebGPU；沒有就退到 WebGL2（gl.js，?gl 可以強制走這條）；兩個都不行才顯示靜態版本
  let device = null;
  if (navigator.gpu && !qs.has('gl')) {
    const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' }).catch(() => null);
    if (adapter) device = await adapter.requestDevice().catch(() => null);
  }
  const onLost = () => { if (!dead) { dead = true; fallback('device lost'); } };

  // ---- 幾何：每個方塊六個面；地面一大片；椅子那一排的外框 ----
  // 頂點：位置 3、法線 3、（材質、par、方塊編號）3
  const V = [], I = [];
  const addBox = (b, id) => {
    const lo = [b[0], b[1], b[2]], hi = [b[4], b[5], b[6]];
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const a1 = (a + 1) % 3, a2 = (a + 2) % 3, base = V.length / 9, n = [0, 0, 0]; n[a] = s;
      for (const [c1, c2] of s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]]) {
        const p = [0, 0, 0]; p[a] = s > 0 ? hi[a] : lo[a]; p[a1] = c1 ? hi[a1] : lo[a1]; p[a2] = c2 ? hi[a2] : lo[a2];
        V.push(...p, ...n, b[3], b[7], id);
      }
      I.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  };
  boxes.forEach((b, k) => { if (b[3] !== 12) addBox(b, k); });
  const nIdxOuter = nOuter * 36, nIdxBoxes = I.length;
  { const base = V.length / 9, G = 1500; // 地面（材質 9）
    for (const [x, z] of [[-G, -G], [-G, G], [G, G], [G, -G]]) V.push(x, 0, z, 0, 1, 0, 9, 0, 0);
    I.push(base, base + 1, base + 2, base, base + 2, base + 3); }
  const nIdxMain = I.length;
  addBox([-5.0, 0, -8.15, 11, 5.0, 1.32, -7.38, 0], 0); // 椅子那一排的外框（與 shader.js 的 CH0／CH1 相同）
  const nIdxGlass0 = I.length; GL.forEach((g) => addBox(boxes[g.i], g.i)); const nIdxGlass = I.length - nIdxGlass0; // 玻璃板：半透明，最後畫
  const HEAD = 32, data = new Float32Array(HEAD + MAX_BOXES * 8 + MAX_LINES * 8);
  boxes.forEach((b, k) => data.set(b, HEAD + k * 8));
  lines.forEach((l, k) => data.set(l, HEAD + MAX_BOXES * 8 + k * 8));

  let draw, OFF = false;
  if (device) {
    window.__gpu = device; // 保留參照，避免被回收
    device.lost.then((i) => { console.warn('device lost:', i.reason, i.message); onLost(); });
    device.addEventListener('uncapturederror', (e) => console.error('GPU error:', e.error.message));
    // ?offscreen：畫到離屏材質再讀回 2D 畫布，給沒有顯示卡、無法呈現 WebGPU 畫布的環境截圖用
    OFF = qs.has('offscreen');
    const format = OFF ? 'rgba8unorm' : navigator.gpu.getPreferredCanvasFormat();
    const ctx = OFF ? canvas.getContext('2d') : canvas.getContext('webgpu');
    if (!OFF) ctx.configure({ device, format, alphaMode: 'opaque' });

    const module = device.createShaderModule({ code: WGSL });
    const info = await module.getCompilationInfo();
    const errs = info.messages.filter((m) => m.type === 'error');
    if (errs.length) { console.error(errs.map((m) => `${m.lineNum}:${m.linePos} ${m.message}`).join('\n')); return fallback('shader'); }
    const vbuf = device.createBuffer({ size: V.length * 4, usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(vbuf, 0, new Float32Array(V));
    const ibuf = device.createBuffer({ size: Math.ceil(I.length / 2) * 4, usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST });
    device.queue.writeBuffer(ibuf, 0, new Uint16Array(Math.ceil(I.length / 2) * 2).map((_, k) => I[k] || 0));

    // ---- 繪製流程 ----
    const bgl = device.createBindGroupLayout({ entries: [
      { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: {} },
      { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: {} },
      { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: {} },
      { binding: 3, visibility: GPUShaderStage.FRAGMENT, texture: {} },
    ] });
    const layout = device.createPipelineLayout({ bindGroupLayouts: [bgl] });
    const vbl = [{ arrayStride: 36, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }, { shaderLocation: 1, offset: 12, format: 'float32x3' }, { shaderLocation: 2, offset: 24, format: 'float32x3' }] }];
    const MS = 4, RF = 'rgba16float';
    const vsB = { module, entryPoint: 'vsBox', buffers: vbl }, vsS = { module, entryPoint: 'vsSky' };
    const fr = (entryPoint, f) => ({ module, entryPoint, targets: [{ format: f }] });
    const ds = (depthCompare, depthWriteEnabled) => ({ format: 'depth24plus', depthCompare, depthWriteEnabled });
    const mk = (o) => device.createRenderPipelineAsync({ layout, multisample: { count: MS }, primitive: { topology: 'triangle-list', cullMode: 'none' }, ...o });
    // 主畫面：先只寫深度（pPre），椅子（pChair）寫自己的深度，再用「深度相等」上色（pBox），每個像素只算一次；最後補天空
    // 倒影：同一套幾何上下顛倒畫到一張半解析度左右的圖（pMBox、pMSky）
    const blend = { color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha' }, alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha' } };
    const glassP = (f) => mk({ vertex: vsB, fragment: { module, entryPoint: 'fsGlass', targets: [{ format: f, blend }] }, depthStencil: ds('less', false) });
    const [pPre, pChair, pBox, pSky, pMBox, pMSky, pGlass, pMGlass] = await Promise.all([
      mk({ vertex: vsB, fragment: { module, entryPoint: 'fsPre', targets: [{ format, writeMask: 0 }] }, depthStencil: ds('less', true) }),
      mk({ vertex: vsB, fragment: fr('fsChair', format), depthStencil: ds('less', true) }),
      mk({ vertex: vsB, fragment: fr('fsBox', format), depthStencil: ds('equal', false) }),
      mk({ vertex: vsS, fragment: fr('fsSky', format), depthStencil: ds('equal', false) }),
      mk({ vertex: vsB, fragment: fr('fsBox', RF), depthStencil: ds('less', true) }),
      mk({ vertex: vsS, fragment: fr('fsSky', RF), depthStencil: ds('less-equal', false) }),
      glassP(format), glassP(RF),
    ]);
    const mkU = () => device.createBuffer({ size: data.byteLength, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const ubuf = mkU(), ubufM = mkU(); // ubufM：畫倒影用的那一份
    const tex = device.createTexture({ size: [AT.w, AT.h], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT });
    const smp = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const blank = device.createTexture({ size: [1, 1], format: 'rgba8unorm', usage: GPUTextureUsage.TEXTURE_BINDING });
    const mkBind = (buffer, r) => device.createBindGroup({ layout: bgl, entries: [{ binding: 0, resource: { buffer } }, { binding: 1, resource: tex.createView() }, { binding: 2, resource: smp }, { binding: 3, resource: r.createView() }] });
    const bindM = mkBind(ubufM, blank);
    // 依畫布大小配置的材質：多重取樣的顏色與深度、倒影
    let T2 = null;
    function targets(w, h, rs) {
      const rw = Math.max(2, Math.round(w * rs)), rh = Math.max(2, Math.round(h * rs));
      if (T2 && T2.w === w && T2.h === h && T2.rw === rw) return T2;
      if (T2) for (const t of T2.all) t.destroy();
      const RA = GPUTextureUsage.RENDER_ATTACHMENT;
      const mkT = (size, fmt, sampleCount, usage = RA) => device.createTexture({ size, format: fmt, sampleCount, usage });
      const color = mkT([w, h], format, MS), depth = mkT([w, h], 'depth24plus', MS);
      const rColor = mkT([rw, rh], RF, MS), rDepth = mkT([rw, rh], 'depth24plus', MS), rTex = mkT([rw, rh], RF, 1, RA | GPUTextureUsage.TEXTURE_BINDING);
      T2 = { w, h, rw, rh, color, depth, rColor, rDepth, rTex, bind: mkBind(ubuf, rTex), all: [color, depth, rColor, rDepth, rTex] };
      return T2;
    }

    // 畫一格。data：這一格填好的資料；o：{ hq, glass, atlasDirty, rs }
    draw = (data, o) => {
      device.queue.writeBuffer(ubuf, 0, data);
      const cw = canvas.width, chh = canvas.height, G = targets(cw, chh, o.rs);
      data[16] = G.rw; data[17] = G.rh; data[28] = 1; device.queue.writeBuffer(ubufM, 0, data); // 倒影那一份：解析度換成倒影圖的大小
      if (o.atlasDirty) device.queue.copyExternalImageToTexture({ source: atlas }, { texture: tex }, [AT.w, AT.h]);

      const enc = device.createCommandEncoder();
      const rt = OFF ? device.createTexture({ size: [cw, chh], format, usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC }) : null;
      const att = (view, resolveTarget) => ({ view, resolveTarget, loadOp: 'clear', storeOp: 'discard', clearValue: [0, 0, 0, 1] });
      const dep = (t) => ({ view: t.createView(), depthClearValue: 1, depthLoadOp: 'clear', depthStoreOp: 'discard' });
      // 一、地面倒影：場景上下顛倒畫一次。高畫質連作業中心的小件一起倒映，低畫質只倒映大件
      let pass = enc.beginRenderPass({ colorAttachments: [att(G.rColor.createView(), G.rTex.createView())], depthStencilAttachment: dep(G.rDepth) });
      pass.setBindGroup(0, bindM); pass.setVertexBuffer(0, vbuf); pass.setIndexBuffer(ibuf, 'uint16');
      pass.setPipeline(pMBox); pass.drawIndexed(o.hq ? nIdxBoxes : nIdxOuter);
      pass.setPipeline(pMSky); pass.draw(3);
      if (o.glass && o.hq) { pass.setPipeline(pMGlass); pass.drawIndexed(nIdxGlass, 1, nIdxGlass0); }
      pass.end();
      // 二、主畫面
      pass = enc.beginRenderPass({ colorAttachments: [att(G.color.createView(), (OFF ? rt : ctx.getCurrentTexture()).createView())], depthStencilAttachment: dep(G.depth) });
      pass.setBindGroup(0, G.bind); pass.setVertexBuffer(0, vbuf); pass.setIndexBuffer(ibuf, 'uint16');
      pass.setPipeline(pPre); pass.drawIndexed(nIdxMain);
      pass.setPipeline(pChair); pass.drawIndexed(36, 1, nIdxMain);
      pass.setPipeline(pBox); pass.drawIndexed(nIdxMain);
      pass.setPipeline(pSky); pass.draw(3);
      if (o.glass) { pass.setPipeline(pGlass); pass.drawIndexed(nIdxGlass, 1, nIdxGlass0); } // 半透明的玻璃板疊在最上面
      pass.end();
      let rb = null; const bpr = Math.ceil(cw * 4 / 256) * 256;
      if (OFF) { rb = device.createBuffer({ size: bpr * chh, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ }); enc.copyTextureToBuffer({ texture: rt }, { buffer: rb, bytesPerRow: bpr }, [cw, chh]); }
      device.queue.submit([enc.finish()]);
      if (OFF) rb.mapAsync(GPUMapMode.READ).then(() => {
        const src = new Uint8Array(rb.getMappedRange()), img = ctx.createImageData(cw, chh);
        for (let y = 0; y < chh; y++) img.data.set(src.subarray(y * bpr, y * bpr + cw * 4), y * cw * 4);
        ctx.putImageData(img, 0, 0); rb.unmap(); rb.destroy(); rt.destroy(); window.__done = true;
      });
    };
  } else {
    const geo = { V, I, nIdxOuter, nIdxBoxes, nIdxMain, nIdxGlass0, nIdxGlass };
    const g = await initGL(canvas, geo, atlas, AT, onLost).catch((e) => { console.error(e); return null; });
    if (!g) return fallback('no webgl2');
    draw = g.draw;
  }
  window.__api = document.body.dataset.api = device ? 'webgpu' : 'webgl2';

  // 畫質分兩級：高＝地面做完整的一次反射；低＝反射只看大件、不算逐燈光照，解析度上限也低一點
  // 手機一開始就用低畫質；其他裝置先用高畫質，跑不動再自動換成低畫質（不會自己換回去）。?q=high／low 可以固定
  const fixedQ = qs.has('q');
  const mobile = navigator.userAgentData?.mobile ?? /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
  let hq = fixedQ ? qs.get('q') !== 'low' : !mobile, slowHi = 0;
  const setQ = () => { window.__q = document.body.dataset.q = hq ? 'high' : 'low'; }; setQ();
  // 依幀時間調整解析度
  // 解析度倍率：高畫質最高 1.5（一倍螢幕上等於超取樣，當成抗鋸齒），低畫質 1.25；太慢就往下降
  // 手機螢幕是 2～3 倍像素，1.25 倍會糊，所以手機上限放到 2
  // MIN：平常降到這裡就停（寧可 30 幀也要清楚）；真的不到 20 幀才繼續往 HARD 降
  // 上限至少到螢幕的實際像素（最多 2 倍），不然 125%／150% 縮放的螢幕永遠是糊的
  const DPR = Math.min(devicePixelRatio, 2), MIN = mobile ? 0.9 : 1, HARD = 0.45, cap = () => (mobile ? DPR : Math.max(DPR, hq ? 1.5 : 1.25));
  let scale = qs.has('scale') ? +qs.get('scale') : Math.min(devicePixelRatio, cap()), acc = 0, frames = 0, best = 1e9, cool = 0, coolN = 20, slowN = 0, dead = false;
  const fixedScale = qs.has('scale');
  let W = 0, H = 0, longN = 0;
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
    if (jumpTo >= 0) { if (lastC) jump = { p: lastC.p, l: lastC.l, k: 0 }; Ts = target; jumpTo = -1; }
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
    // 點了螢幕牆的一格：鏡頭從這一站的位置走到那一格正前方，剛好把那一格框滿；關掉就沿原路退回
    const fT = focus >= 0 ? 1 : 0; fK += (fT - fK) * (1 - Math.exp(-dt * 3.2)); if (Math.abs(fT - fK) < 0.002) fK = fT;
    if (fK > 0) {
      const ft = tiles[fTile], tc = ft.c, d = Math.max(ft.h / 2 / tanH, ft.w / 2 / (tanH * aspect)) / 0.86, e = fK * fK * (3 - 2 * fK);
      const fp = [tc[0] + d, tc[1], tc[2]];
      for (let j = 0; j < 3; j++) { c.p[j] += (fp[j] - c.p[j]) * e; c.l[j] += (tc[j] - c.l[j]) * e; }
      if (fK < 0.02 && focus < 0 && playV.hasAttribute('src')) { playV.removeAttribute('src'); playV.load(); }
    }
    // 方案：三片玻璃升起，鏡頭走到正前方、正對著它們；直式螢幕一次框一片
    const ek = (a, b, rate) => { const n = a + (b - a) * (1 - Math.exp(-dt * rate)); return Math.abs(b - n) < 0.002 ? b : n; };
    vK = ek(vK, view ? 1 : 0, 3.0); riseP = ek(riseP, view ? 1 : 0, 1.6);
    if (vK > 0) {
      const wide = aspect > 1.15, g = GL[vSel], y1 = GL[1].y1, cy = (g.y0 + y1) / 2;
      vX = ek(vX, wide ? 0 : g.x, 5);
      const d = Math.max((y1 - g.y0) / 2 / tanH, (wide ? 5.5 : g.w) / 2 / (tanH * aspect)) / (wide ? 0.86 : 0.93), e = vK * vK * (3 - 2 * vK);
      const fp = [vX, cy, g.z + d], tl = [vX, cy, g.z];
      for (let j = 0; j < 3; j++) { c.p[j] += (fp[j] - c.p[j]) * e; c.l[j] += (tl[j] - c.l[j]) * e; }
    }
    if (jump) { // 直接飛：從按下去那一刻的鏡頭，直線移到新的位置
      jump.k = Math.min(jump.k + dt / 1.1, 1); const e = ease(jump.k);
      for (let j = 0; j < 3; j++) { c.p[j] = jump.p[j] + (c.p[j] - jump.p[j]) * e; c.l[j] = jump.l[j] + (c.l[j] - jump.l[j]) * e; }
      if (jump.k >= 1) jump = null;
    }
    lastC = { p: [...c.p], l: [...c.l] };
    const sway = (fixedT != null ? 0 : 1) * (1 - fK) * (1 - vK);
    const p = [c.p[0] + mx * 0.5 * sway, c.p[1] - my * 0.25 * sway + Math.sin(time * 0.4) * 0.03 * sway, c.p[2]];
    let f = [c.l[0] - p[0], c.l[1] - p[1], c.l[2] - p[2]]; const fl = Math.hypot(...f); f = f.map((x) => x / fl);
    let r = [-f[2], 0, f[0]]; const rl = Math.hypot(...r); r = r.map((x) => x / rl);
    const up = [r[1] * f[2] - r[2] * f[1], r[2] * f[0] - r[0] * f[2], r[0] * f[1] - r[1] * f[0]];
    camS = { p, f, r, up, tanH, aspect };

    data.set([p[0], p[1], p[2], time, f[0], f[1], f[2], tanH, r[0], r[1], r[2], aspect, up[0], up[1], up[2], warmOn,
      canvas.width, canvas.height, boxes.length, lines.length, T, AT.split / AT.h, AT.right / AT.h, 0, nOuter, glassOn, hq ? 1 : 0, 0, 0, riseP, 0, 0]);
    GL.forEach((g, k) => { const o = HEAD + MAX_BOXES * 8 + g.li * 8, rk = riseK(k); data[o + 3] = 1.3 * rk; data[o + 7] = -0.45 * rk; });
    drawAtlas();
    const newAtlas = atlasDirty && !qs.has('noatlas'); if (newAtlas) atlasDirty = false;
    draw(data, { hq, glass: riseP > 0, atlasDirty: newAtlas, rs: hq ? 0.6 : 0.5 });

    // 貼在牆面與櫃檯上的 HTML 標示：用同一台鏡頭做透視
    const kx = (W / 2) / (tanH * aspect), ky = (H / 2) / tanH;
    const row = (a, b, k, d) => ({ v: [a[0] * k + b[0] * d, a[1] * k + b[1] * d, a[2] * k + b[2] * d] });
    const X = row(r, f, kx, W / 2).v, Y = row(up, f, -ky, H / 2).v, Wv = f;
    const dotp = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    // 進退場跟著鏡頭：標示貼在牆上，鏡頭走近那一站就依序亮起（先標題、再一格一格），走遠就依序暗掉；往回捲就倒著來
    for (const L of labels) {
      const A = L.r.map((x) => x * L.s), B = [0, -L.s, 0], O = [L.o[0] - p[0], L.o[1] - p[1], L.o[2] - p[2]];
      const w = dotp(Wv, O);
      let near = L.stops.length ? 0 : 1;
      for (const st of L.stops) near = Math.max(near, 1 - Math.min(Math.abs(T - st) * 2.2, 1));
      let k = Math.min(Math.max(near * 2.2 - 0.25 - L.seq * 0.13, 0), 1);
      if (L.play) k = Math.min(Math.max((fK - 0.7) / 0.25, 0), 1); else k *= 1 - Math.min(fK * 3, 1); // 走向某一格時，牆上其他的字先暗掉
      // 玻璃板上的字：玻璃升到頂才浮現；玻璃打開時，牆上與櫃檯上的字先暗掉
      if (L.g >= 0) k = Math.min(Math.max((riseK(L.g) - 0.8) / 0.2, 0), 1); else if (!L.play) k *= 1 - Math.min(vK * 3, 1);
      if (w <= 0.6) k = 0;
      L.el.style.opacity = k; L.el.style.setProperty('--k', k);
      if (L.tile || L.play) L.el.classList.toggle('hot', L.play ? fK > 0.9 : k > 0.9 && focus < 0);
      if (L.g >= 0) L.el.classList.toggle('hot', k > 0.9 && !!view);
      if (w <= 0.6) continue;
      const m = [dotp(X, A), dotp(Y, A), 0, dotp(Wv, A), dotp(X, B), dotp(Y, B), 0, dotp(Wv, B), 0, 0, 1, 0, dotp(X, O), dotp(Y, O), 0, w];
      L.el.style.transform = `matrix3d(${m.map((x) => x.toFixed(5)).join(',')})`;
    }

    // 偶發的卡頓不算：剛啟動的 1.5 秒（載入、影片開始解碼）、分頁在背景、單獨幾格特別長的，都不列入統計。
    // 不然這些暫時的慢會把解析度一路降到最低
    longN = dt >= 0.09 ? longN + 1 : 0;
    const steady = now - t0 > 1500 && !document.hidden && (longN === 0 || longN > 6);
    if (!fixedScale && steady) { // 太慢就降解析度，夠快再升回來
      acc += dt; frames++;
      if (frames >= 30) {
        const ms = acc / frames * 1000; acc = 0; frames = 0;
        // best：看過最短的每格時間，約等於螢幕的更新間隔。掉到 45 幀以下就降；貼著更新間隔跑就試著升，
        // 升了又掉回來的話，下次等久一點再試
        best = Math.min(best, ms); if (cool > 0) cool--;
        // strict：掉到 45 幀以下。用來收掉「多出來的」東西：超取樣（一倍以上）和高畫質
        // 一倍以下的解析度是最後才動的：要掉到 28 幀以下才降（手機一律用這條），不然 40 幾幀就一路降到糊掉
        const strict = ms > Math.max(Math.min(best, 16.7) * 1.3, 20), slow = mobile || scale <= DPR ? ms > 36 : strict;
        const lo = ms > 50 ? HARD : MIN;
        slowHi = strict && hq ? slowHi + 1 : 0;
        // 高畫質已經降到一倍以下還是慢，或連兩次不到 30 幀：換成低畫質，解析度留著
        if (strict && hq && !fixedQ && (scale <= 1.0 || (ms > 33 && slowHi >= 2))) { hq = false; setQ(); cool = 4; }
        else if (slow && scale > lo) { scale = Math.max(lo, scale * 0.85); cool = coolN; coolN = Math.min(coolN * 2, 320); resize(); }
        // 升回來的條件：貼著螢幕更新率，或至少有 74 幀。只看前者的話，144 Hz 的螢幕上跑 75 幀永遠升不回來，畫面就卡在最低解析度
        // 被壓到 MIN 以下的，回到 25 幀以上就先升回 MIN
        else if (cool === 0 && ((scale < MIN && ms < 40) || ((mobile || scale < DPR ? ms < 26 : ms < Math.max(best * 1.12, 13.5)) && scale < cap()))) { scale = Math.min(cap(), scale * 1.1); resize(); }
        // 降到最低解析度還是不到 20 幀，連續三次就換成靜態版本
        if (scale <= HARD && ms > 50) { if (++slowN >= 3) { dead = true; fallback('too slow'); } } else slowN = 0;
      }
    }
    if (!window.__ready) { window.__ready = true; document.body.classList.add('ready'); }
    if (qs.has('once')) { if (!OFF) (device ? device.queue.onSubmittedWorkDone() : Promise.resolve()).then(() => { window.__done = true; }); return; }
    if (!dead) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start().catch((e) => fallback(e.message));
