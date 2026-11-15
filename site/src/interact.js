// ============================================================================
// FG STUDIO: 可互動物件：點選、指到時的提示、電腦的正面模式與 HTML 播放器
// ============================================================================
// 場景層與內容層之間只有三件事：場景回報指到哪個物件（hot）、回報點到哪個物件（activate）、
// 內容層要求鏡頭移到某處（目前用上游的做法瞬間切換；鏡頭滑行之後再做）。
const OBJECTS = [{ zh: '影片電腦', en: 'Video computer', hintZh: '點擊播放', hintEn: 'Click to play' }];
const label = $('n'), tv = $('tv'), tvScreen = $('ts'), tvVideo = $('tvv'), tvBoot = $('tb'), tvList = $('tc');

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
  // 轉到電腦自己的座標（先轉回朝向，再轉回後仰），與包住整台電腦的盒子求交
  const wx = F[CX] - COMP.x, wy = F[CY] - COMP.y, wz = F[CZ] - COMP.z, c = COMP.c, s = COMP.s, ct = COMP.ct, st = COMP.st;
  const ox = c * wx - s * wz, qz = s * wx + c * wz, oy = wy * ct - qz * st, oz = wy * st + qz * ct;
  const ex = c * dx - s * dz, fz = s * dx + c * dz, ey = dy * ct - fz * st, ez = dy * st + fz * ct;
  let t0 = 0, t1 = 1e9, a, b, k;
  a = (-0.56 * CSCALE - ox) / ex; b = (0.56 * CSCALE - ox) / ex; if (a > b) { k = a; a = b; b = k; } if (a > t0) t0 = a; if (b < t1) t1 = b;
  a = -oy / ey; b = (1.1 * CSCALE - oy) / ey; if (a > b) { k = a; a = b; b = k; } if (a > t0) t0 = a; if (b < t1) t1 = b;
  a = (-0.5 * CSCALE - oz) / ez; b = (0.6 * CSCALE - oz) / ez; if (a > b) { k = a; a = b; b = k; } if (a > t0) t0 = a; if (b < t1) t1 = b;
  if (!(t0 <= t1)) return -1;
  for (let t = 0.6; t < t0; t += 0.5) if (rock(F[CX] + dx * t, F[CY] + dy * t, F[CZ] + dz * t) > 0) return -1;
  return 0;
}
// 每格：游標鎖定時看準星（畫面中央），沒鎖定時看游標。指到物件就顯示名稱、游標變手形、螢幕光暈增強
let glowNow = 0;
function hover() {
  let h = -1;
  if (!menu && !front) h = document.pointerLockElement ? pick(canvas.clientWidth / 2, canvas.clientHeight / 2) : mob ? -1 : pick(ptX, ptY);
  if (h !== hot) {
    hot = h; body.classList.toggle('h', h >= 0);
    if (h >= 0) label.textContent = OBJECTS[h].zh + '　' + OBJECTS[h].hintZh;
  }
  const to = hot >= 0 ? 1 : 0;
  if (glowNow !== to) { glowNow += (to - glowNow) * 0.2; if (abs(to - glowNow) < 0.01) glowNow = to; scrData[3] = GLOW * (1 + 0.3 * glowNow); scrData[14] = glowNow; scrDirty = true; }
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
let wasLocked = false, bootTimer = 0, channel = 0, rectW = 0, rectH = 0;
function activate(i) { if (i === 0) enterFront(); }
// 鏡頭停在螢幕正前方：螢幕接近佔滿畫面，外框仍看得到。每格重算，視窗大小改變也對得上
function frontPose() {
  const asp = W / H, d = max(COMP.hh * 1.32 / TANH, COMP.hw * 1.22 / (TANH * asp));
  F[CX] = COMP.sx + COMP.nx * d; F[CY] = COMP.sy + COMP.ny * d; F[CZ] = COMP.sz + COMP.nz * d; F[YAW] = atan2(-COMP.nx, COMP.nz); F[PIT] = -TILT;
  F[VX] = F[VY] = F[VZ] = 0;
  // HTML 播放器對齊場景裡螢幕的四個角：鏡頭沿著螢幕的法線正對它，所以四個角投影後是一個置中的矩形
  const cw = canvas.clientWidth, ch = canvas.clientHeight, w = round(COMP.hw / (d * TANH * asp) * cw), h = round(COMP.hh / (d * TANH) * ch);
  if (w !== rectW || h !== rectH) {
    rectW = w; rectH = h; const s = tvScreen.style;
    s.left = (cw - w) / 2 + 'px'; s.top = (ch - h) / 2 + 'px'; s.width = w + 'px'; s.height = h + 'px'; s.fontSize = h / 22 + 'px';
  }
}
function enterFront() {
  back[0] = F[CX]; back[1] = F[CY]; back[2] = F[CZ]; back[3] = F[YAW]; back[4] = F[PIT];
  wasLocked = !!document.pointerLockElement; front = true; rectW = 0; release();
  frontPose(); // 上游的做法：瞬間切換
  if (wasLocked) document.exitPointerLock(); else ui(false);
  boot();
}
function exitFront() {
  if (!front) return;
  clearTimeout(bootTimer); tvVideo.pause(); tv.className = '';
  front = false; F[CX] = back[0]; F[CY] = back[1]; F[CZ] = back[2]; F[YAW] = back[3]; F[PIT] = back[4];
  ambience(1); ui(false);
  if (wasLocked) capture();
}
// 環境音在播放完整影片時淡出，離開後淡入
function ambience(on) { if (OUT) OUT.gain.setTargetAtTime(on && !muted ? VOL : 0, AC.currentTime, 0.4); }
// 一小段復古開機畫面，然後開始播放
const BOOT = ['FG STUDIO SYSTEM ROM 1.0', '640K RAM .......... OK', 'VIDEO ............. OK', 'LOADING GVS ...', ''];
function boot() {
  tv.className = 'on boot'; tvBoot.textContent = ''; let i = 0;
  const step = () => {
    if (!front) return;
    if (i < BOOT.length) { tvBoot.textContent += BOOT[i++] + '\n'; bootTimer = setTimeout(step, 330); } else { tv.className = 'on'; play(channel); }
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
