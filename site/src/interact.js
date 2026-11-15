// ============================================================================
// FG STUDIO: 可互動物件：點選、指到時的提示、電腦的正面模式與 HTML 播放器
// ============================================================================
// 場景層與內容層之間只有三件事：場景回報指到哪個物件（hot）、回報點到哪個物件（activate）、
// 內容層要求鏡頭移到某處（目前用上游的做法瞬間切換；鏡頭滑行之後再做）。
// 點選用的盒子，在物件自己的座標裡（公尺）：o 是物件的位置與朝向，順序與 IDS 相同（兩台電腦，再來五個寶箱）。
// 寶箱的盒子比箱子大一圈，遠處也好點
const BOXES = [...COMPS.map((o) => ({ o, x0: -0.56 * CSCALE, x1: 0.56 * CSCALE, y1: 1.1 * CSCALE, z0: -0.5 * CSCALE, z1: 0.6 * CSCALE })),
  ...CH.map((o) => ({ o, x0: -0.62 * CHS, x1: 0.62 * CHS, y1: 0.95 * CHS, z0: -0.45 * CHS, z1: 0.45 * CHS }))];
const label = $('nn'), tv = $('tv'), tvScreen = $('ts'), tvVideo = $('tvv'), tvBoot = $('tb'), tvList = $('tc');

// ---------------------------------------------------------------- 遠看：螢幕播放靜音預覽
const pv = document.createElement('video');
pv.muted = pv.loop = pv.playsInline = true; pv.preload = 'auto'; pv.src = mediaPreview(CHANNELS[0]);
const onVideoFrame = () => { vidNew = true; pv.requestVideoFrameCallback(onVideoFrame); };
pv.addEventListener('loadeddata', () => {
  const w = pv.videoWidth, h = pv.videoHeight; if (!w || !h) return;
  tVid.destroy(); tVid = tex(w, h, 'rgba8unorm', VTU); bgVid = blitBG(tVid.createView());
  vidSrc.source = pv; vidDst.texture = tVid; vidSize[0] = w; vidSize[1] = h;
  scrData[12] = w / h; scrData[13] = 1; scrDirty = vidNew = true;
  pv.requestVideoFrameCallback(onVideoFrame);
}, { once: true });
pv.play().catch(() => 0);

// 資訊電腦遠看的畫面：綠色螢光幕上的 GVS 三個字與三條橫槓，畫一次就好。文字內容在正面模式的 HTML 裡
{
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 384;
  const x = cv.getContext('2d'); x.fillStyle = '#04140c'; x.fillRect(0, 0, 512, 384);
  x.fillStyle = '#8dffb0'; x.textAlign = 'center'; x.font = '900 150px ui-monospace, Consolas, monospace'; x.fillText('GVS', 256, 170);
  x.font = '700 25px ui-monospace, Consolas, monospace'; x.fillText('GLOBAL VIDEO SERVICE', 256, 215);
  x.textAlign = 'left'; x.font = '700 24px ui-monospace, Consolas, monospace';
  for (let i = 0; i < 3; i++) { x.fillText('0' + (i + 1), 96, 272 + i * 34); x.fillRect(146, 254 + i * 34, [230, 170, 260][i], 18); }
  Q.copyExternalImageToTexture({ source: cv }, { texture: tInfo }, [512, 384]);
  scrData[29] = 1; scrDirty = true;
}

// ---------------------------------------------------------------- 點選
// 岩石的距離（公尺，水裡 < 0），與 collide() 用的 sd() 相同，但取任意位置
function rock(wx, wy, wz) {
  const x = (wx - OX) / VS - CO, y = (wy - OY) / VS, z = (wz - OZ) / VS - CO;
  if (x < 1 || z < 1 || x > CN * 4 - 2 || z > CN * 4 - 2 || y < 4 || y > NY - 6) return -1;
  const ix = x | 0, iy = y | 0, iz = z | 0, u = x - ix, v = y - iy, a = cv(ix, iy, iz), b = cv(ix, iy + 1, iz), c = cv(ix, iy, iz + 1), d = cv(ix, iy + 1, iz + 1);
  const p = a + (cv(ix + 1, iy, iz) - a) * u, q = b + (cv(ix + 1, iy + 1, iz) - b) * u, r = c + (cv(ix + 1, iy, iz + 1) - c) * u, s = d + (cv(ix + 1, iy + 1, iz + 1) - d) * u;
  const e = p + (q - p) * v; return (e + (r + (s - r) * v - e) * (z - iz)) / 127;
}
// 從畫布上的一點（畫布自己的 CSS 像素）射出一條線，回傳打到的物件編號，沒有就是 -1。中間有岩石擋住不算
function pick(px, py) {
  const asp = W / H, nx = (px / canvas.clientWidth * 2 - 1) * TANH * asp, ny = (1 - py / canvas.clientHeight * 2) * TANH;
  let dx = F[FX] + F[RX] * nx + F[UX] * ny, dy = F[FY] + F[UY] * ny, dz = F[FZ] + F[RZ] * nx + F[UZ] * ny;
  const l = sqrt(dx * dx + dy * dy + dz * dz); dx /= l; dy /= l; dz /= l;
  // 每個物件：轉到它自己的座標（先轉回朝向，再轉回後仰），與包住它的盒子求交。取最近的一個
  let hit = -1, near = 1e9;
  for (let i = 0; i < BOXES.length; i++) {
    const B = BOXES[i], o = B.o, wx = F[CX] - o.x, wy = F[CY] - o.y, wz = F[CZ] - o.z, c = o.c, s = o.s, ct = o.ct, st = o.st;
    const ox = c * wx - s * wz, qz = s * wx + c * wz, oy = wy * ct - qz * st, oz = wy * st + qz * ct;
    const ex = c * dx - s * dz, fz = s * dx + c * dz, ey = dy * ct - fz * st, ez = dy * st + fz * ct;
    let t0 = 0, t1 = 1e9, a, b, k;
    a = (B.x0 - ox) / ex; b = (B.x1 - ox) / ex; if (a > b) { k = a; a = b; b = k; } if (a > t0) t0 = a; if (b < t1) t1 = b;
    a = -oy / ey; b = (B.y1 - oy) / ey; if (a > b) { k = a; a = b; b = k; } if (a > t0) t0 = a; if (b < t1) t1 = b;
    a = (B.z0 - oz) / ez; b = (B.z1 - oz) / ez; if (a > b) { k = a; a = b; b = k; } if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 <= t1 && t0 < near) { near = t0; hit = i; }
  }
  if (hit < 0) return -1;
  for (let t = 0.6; t < near; t += 0.5) if (rock(F[CX] + dx * t, F[CY] + dy * t, F[CZ] + dz * t) > 0) return -1;
  return hit;
}
// 每格：游標鎖定時看準星（畫面中央），沒鎖定時看游標。指到物件就顯示名稱、游標變手形、螢幕光暈增強
const glowNow = [0, 0];
function hover() {
  let h = -1;
  if (!menu && !front && !win) h = document.pointerLockElement ? pick(canvas.clientWidth / 2, canvas.clientHeight / 2) : mob ? -1 : pick(ptX, ptY);
  if (h !== hot) {
    hot = h; body.classList.toggle('h', h >= 0);
    if (h >= 0) label.innerHTML = logB[h].innerHTML; // 名稱寫在潛水日誌的 HTML 裡，兩種語言都有
  }
  chestTick();
  for (let k = 0; k < 2; k++) {
    const to = hot === k ? 1 : 0; let g = glowNow[k];
    if (g !== to) { g += (to - g) * 0.2; if (abs(to - g) < 0.01) g = to; glowNow[k] = g; scrData[k * 16 + 3] = GLOW * (1 + 0.3 * g); scrData[k * 16 + 14] = g; scrDirty = true; }
  }
  // 太遠、正面模式或分頁在背景時不解碼預覽
  const idle = front || document.hidden || hypot(F[CX] - COMP.x, F[CZ] - COMP.z) > 70;
  if (idle !== pv.paused) { if (idle) pv.pause(); else pv.play().catch(() => 0); }
}
// 觸控：短按且幾乎沒移動算點擊。回傳 true 表示這個事件已處理完，不要再當成游動
let tapT = 0, tapX = 0, tapY = 0, tapOk = false;
function tap(e) {
  const t = e.changedTouches[0];
  if (e.type === 'touchstart' && e.touches.length === 1) { tapT = e.timeStamp; tapX = t.clientX; tapY = t.clientY; tapOk = true; }
  else if (e.type === 'touchmove') { if (hypot(t.clientX - tapX, t.clientY - tapY) > 12) tapOk = false; }
  else if (e.type === 'touchend' && !e.touches.length && tapOk && e.timeStamp - tapT < 300) {
    tapOk = false;
    if (front) { exitFront(); release(); return true; }
    if (!menu) {
      // 直拿的手機整頁轉了 90 度（見 template.html），觸控座標跟著轉
      const h = rot.matches ? pick(t.clientY, innerWidth - t.clientX) : pick(t.clientX, t.clientY);
      if (h >= 0) { release(); activate(h); return true; }
    }
  }
  return front;
}

// ---------------------------------------------------------------- 正面模式
const back = new Float64Array(5);
let wasLocked = false, bootTimer = 0, channel = 0, rectW = 0, rectH = 0, cur = COMP, frontK = 0;
function activate(i) { if (i < 2) enterFront(i); else openChest(i - 2); }
// 鏡頭停在螢幕正前方：螢幕接近佔滿畫面，外框仍看得到。每格重算，視窗大小改變也對得上
function frontPose() {
  const asp = W / H, d = max(cur.hh * 1.5 / TANH, cur.hw * 1.32 / (TANH * asp));
  F[CX] = cur.sx + cur.nx * d; F[CY] = cur.sy + cur.ny * d; F[CZ] = cur.sz + cur.nz * d; F[YAW] = atan2(-cur.nx, cur.nz); F[PIT] = -TILT;
  F[VX] = F[VY] = F[VZ] = 0;
  // HTML 播放器對齊場景裡螢幕的四個角：鏡頭沿著螢幕的法線正對它，所以四個角投影後是一個置中的矩形
  const cw = canvas.clientWidth, ch = canvas.clientHeight, w = round(cur.hw / (d * TANH * asp) * cw), h = round(cur.hh / (d * TANH) * ch);
  if (w !== rectW || h !== rectH) {
    rectW = w; rectH = h; const s = tvScreen.style;
    s.left = (cw - w) / 2 + 'px'; s.top = (ch - h) / 2 + 'px'; s.width = w + 'px'; s.height = h + 'px'; s.fontSize = h / 22 + 'px';
  }
}
function enterFront(k) {
  cur = COMPS[k]; frontK = k; mark(IDS[k]);
  back[0] = F[CX]; back[1] = F[CY]; back[2] = F[CZ]; back[3] = F[YAW]; back[4] = F[PIT];
  wasLocked = !!document.pointerLockElement; front = true; rectW = 0; release();
  frontPose(); // 上游的做法：瞬間切換
  if (wasLocked) document.exitPointerLock(); else ui(false);
  boot();
}
function exitFront(stay) { // stay: 不要重新鎖定游標（從 HTML 的按鈕離開）
  if (!front) return;
  clearTimeout(bootTimer); tvVideo.pause(); tv.className = '';
  front = false; F[CX] = back[0]; F[CY] = back[1]; F[CZ] = back[2]; F[YAW] = back[3]; F[PIT] = back[4];
  ambience(1); ui(false);
  if (endDue) { endDue = false; openWin('end'); } else if (wasLocked && stay !== true) capture();
}
function frontKey(e) {
  if (e.code === 'Escape') exitFront();
  else if (frontK && tv.className === 'on info') { if (e.code === 'ArrowRight') slide(slideI + 1); else if (e.code === 'ArrowLeft') slide(slideI - 1); }
}
// 環境音在播放完整影片時淡出，離開後淡入
function ambience(on) { if (OUT) OUT.gain.setTargetAtTime(on && !muted ? VOL : 0, AC.currentTime, 0.4); }
// 一小段復古開機畫面，然後開始播放
const BOOT = ['FG STUDIO SYSTEM ROM 1.0', '640K RAM .......... OK', 'VIDEO ............. OK', 'LOADING GVS ...', ''];
function boot() {
  tv.className = 'on boot'; tvBoot.textContent = ''; let i = 0;
  const step = () => {
    if (!front) return;
    if (i < BOOT.length) { tvBoot.textContent += BOOT[i++] + '\n'; bootTimer = setTimeout(step, 330); } else if (frontK) { tv.className = 'on info'; slide(0); } else { tv.className = 'on'; play(channel); }
  };
  step();
}
function play(i) {
  channel = i; const c = CHANNELS[i];
  tvList.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-pressed', k === i));
  tvVideo.poster = mediaPoster(c); tvVideo.src = mediaFull(c);
  ambience(0); tvVideo.play().catch(() => 0);
}
CHANNELS.forEach((c, i) => {
  const li = document.createElement('li'), b = document.createElement('button');
  b.textContent = c.zh; b.onclick = () => play(i);
  li.append(b); tvList.append(li);
});
tvVideo.addEventListener('ended', () => { ambience(1); wake(); });
// 頻道清單：播放中滑鼠停住 2.5 秒就淡出，一動就回來；暫停或播完時一直顯示
let idleTimer = 0;
function wake() { tvScreen.classList.remove('idle'); clearTimeout(idleTimer); idleTimer = setTimeout(() => { if (!tvVideo.paused) tvScreen.classList.add('idle'); }, 2500); }
for (const n of ['pointermove', 'pointerdown', 'keydown']) tvScreen.addEventListener(n, wake);
tvVideo.addEventListener('pause', wake); tvVideo.addEventListener('playing', wake);
$('tx').onclick = exitFront;
// 資訊電腦：GVS 是什麼，一句一窗，左右鍵或按鈕換頁
const slides = $('ti').querySelectorAll('section'); let slideI = 0;
function slide(i) {
  slideI = i = i < 0 ? 0 : i > slides.length - 1 ? slides.length - 1 : i;
  slides.forEach((e, k) => { e.hidden = k !== i; });
  $('tn').textContent = (i + 1) + ' / ' + slides.length; $('tp').disabled = !i; $('tq').disabled = i === slides.length - 1;
}
$('tp').onclick = () => slide(slideI - 1); $('tq').onclick = () => slide(slideI + 1);

// ---------------------------------------------------------------- 寶箱：開箱與內容視窗
// 每格：每個寶箱箱蓋的動畫、光的強度（沒開過最亮，指到時增強，開箱的瞬間迸出，開過之後變柔和）。有變才寫進緩衝區
const wn = $('wn'), chAnim = new Float32Array(NCH).fill(-1), chHover = new Float32Array(NCH);
let chT = 0, pend = -1, winLocked = false, endDue = false; // pend: 正在開、等著彈出視窗的寶箱；endDue: 剛開完最後一個，等著出結尾
function chestTick() {
  let dt = F[TIME] - chT; chT = F[TIME]; dt = dt < 0 ? 0 : dt > 0.1 ? 0.1 : dt;
  for (let i = 0; i < NCH; i++) {
    const was = opened.has(IDS[i + 2]); let burst = 0, frac = was ? 1 : 0, a = chAnim[i];
    if (a >= 0) {
      a += dt;
      // 箱蓋 0.9 秒掀開，稍微過頭再回來；光在開箱的瞬間迸出再退下去；箱蓋快到位時彈出視窗
      const u = min(a / 0.9, 1) - 1; frac = 1 + 2.4 * u * u * u + 1.4 * u * u;
      burst = 3.2 * exp(-a * 2.2) * min(a * 8, 1);
      if (a > 0.8 && pend === i && !menu && !front && !win) { pend = -1; openWin(IDS[i + 2]); } // 選單開著就等它關掉
      chAnim[i] = a > 4 && pend !== i ? -1 : a;
    }
    const hv = hot === i + 2 ? 1 : 0; let h = chHover[i];
    if (h !== hv) { h += (hv - h) * 0.2; if (abs(hv - h) < 0.01) h = hv; chHover[i] = h; }
    const lv = (was ? 0.4 : 1) * (1 + 0.45 * h) + burst;
    if (frac !== chFrac[i] || abs(lv - chLevel[i]) > 0.004) { chFrac[i] = frac; chLevel[i] = lv; chWrite(i); }
  }
}
function openChest(i) {
  if (pend >= 0) return; // 有一個正在開
  const id = IDS[i + 2];
  if (opened.has(id)) { openWin(id); return; } // 開過的寶箱保持打開，再點只開視窗
  mark(id); chAnim[i] = 0; pend = i;
}
// 開過的記號：記進 localStorage，潛水日誌打勾、更新數量。全部開完就準備出結尾
const logB = $('jl').querySelectorAll('button');
function logShow() { logB.forEach((b, i) => b.classList.toggle('ok', opened.has(IDS[i]))); $('jn').textContent = opened.size + '／' + IDS.length; }
function mark(id) {
  if (opened.has(id)) return;
  opened.add(id); keep('fgOpen', [...opened].join(',')); logShow();
  if (opened.size === IDS.length) endDue = true;
}
logShow();
// 內容視窗：一張藏寶圖，每個寶箱一頁（data-p），只顯示要看的那一頁。放開游標（不開選單），焦點移進視窗；
// Esc、關閉鈕、點視窗外關閉，焦點回到場景
function openWin(id) {
  if (menu || front) return;
  for (const e of wn.querySelectorAll('[data-p]')) e.hidden = e.dataset.p !== id;
  $('wc').scrollTop = 0;
  if (win) { $('wx').focus(); return; }
  winLocked = !!document.pointerLockElement; win = true; release();
  if (winLocked) document.exitPointerLock(); else ui(false);
  wn.className = 'on'; setTimeout(() => win && $('wx').focus(), 60);
}
function closeWin() {
  if (!win) return;
  if (endDue) { endDue = false; openWin('end'); return; } // 剛看完最後一個：同一張圖換成結尾
  win = false; wn.className = ''; ui(false);
  if (winLocked) capture();
}
function winKey(e) {
  if (e.code === 'Escape') { closeWin(); return; }
  if (e.code !== 'Tab') return;
  // 焦點留在視窗裡
  const f = [...wn.querySelectorAll('button, a[href]')].filter((n) => !n.closest('[hidden]')), a = f[0], b = f[f.length - 1];
  if (!wn.contains(document.activeElement)) { e.preventDefault(); a.focus(); }
  else if (e.shiftKey && document.activeElement === a) { e.preventDefault(); b.focus(); }
  else if (!e.shiftKey && document.activeElement === b) { e.preventDefault(); a.focus(); }
}
wn.addEventListener('click', (e) => { if (e.target === wn) closeWin(); });
$('wx').onclick = closeWin;

// ---------------------------------------------------------------- 潛水日誌、常駐聯絡按鈕、操作提示
// 潛水日誌：角落常駐的清單，同時是進度、選單與捷徑。點一項，鏡頭就到那個物件前面並開啟它
// （鏡頭照上游的做法瞬間切換；滑行之後再做）。游標鎖定時點不到它：按 Esc 放開游標，選單開著時它也在
function visit(i) {
  if (front || win || pend >= 0) return;
  if (menu) go();
  if (i < 2) { const o = COMPS[i]; lookAt(o.sx + o.nx * 8, o.sy + 0.4, o.sz + o.nz * 8, o.sx, o.sy, o.sz); }
  else { const o = CH[i - 2], dx = P0[0] - o.x, dz = P0[2] - o.z, l = hypot(dx, dz) || 1, d = min(4.6, l); lookAt(o.x + dx / l * d, o.y + 2, o.z + dz / l * d, o.x, o.y + 0.7, o.z); }
  F[VX] = F[VY] = F[VZ] = 0;
  activate(i);
}
logB.forEach((b, i) => { b.onclick = () => visit(i); });
const logN = $('j');
if (!mob && innerHeight > 560) logN.className = 'on'; // 大畫面預設展開，小畫面收成一顆按鈕
$('jt').onclick = () => { $('jt').setAttribute('aria-expanded', logN.classList.toggle('on')); };
$('jt').setAttribute('aria-expanded', logN.className === 'on');
// 常駐聯絡按鈕：任何狀態下都看得到。場景好了之後點它直接打開聯絡寶箱的內容；在那之前它是一般的寄信連結
$('ct').onclick = (e) => {
  e.preventDefault();
  if (front) exitFront(true);
  if (menu) go();
  mark('contact'); openWin('contact');
};
// 一行操作提示，第一次潛入時出現，幾秒後淡出
let hinted = false;
function hint() { if (hinted) return; hinted = true; const h = $('hn'); h.className = 'on'; setTimeout(() => { h.className = ''; }, 7000); }
