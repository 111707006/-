// 背景音樂：在瀏覽器裡即時合成的環境音（沒有音樂檔，是這個網站自己產生的聲音，不涉及他人版權）。
// 低沉的持續音 + 緩慢換和弦的柔和鋪底 + 偶爾幾顆帶回音的高音點綴，配合夜晚、霓虹的場景。
// 預設開啟；瀏覽器規定網頁要先被點一下才能出聲，所以訪客第一次點畫面（或按鍵）時才淡入（瀏覽器允許的話一進來就直接播）。按右上角的「音樂」可以關掉，播放作品影片時自動淡出，影片停了再回來。關掉的選擇記在 localStorage，下次進來維持關閉。

const VOL = 0.22;      // 整體音量（再經過 build 裡的混音，實際聽起來很小聲）
const STEP = 10;      // 每幾秒換一個和弦
const midi = (m) => 440 * 2 ** ((m - 69) / 12);
// D 多利亞調式上的四個和弦，聽起來安靜、略帶科技感，不會有明顯的「歌」
const CHORDS = [[50, 57, 60, 64, 65], [46, 53, 57, 62, 65], [41, 48, 55, 57, 64], [48, 55, 60, 62, 64]];
const SPARK = [74, 76, 81, 83, 86, 88];

// 建立整個聲音網路，回傳 schedule(until)：把 until 秒之前要出現的音排進去。
// 線上播放時每秒呼叫一次；測試時可以在 OfflineAudioContext 裡一次排完。
export function build(ctx, out) {
  const rnd = mulberry(7);
  const bus = ctx.createGain(); bus.gain.value = 1;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -24; comp.ratio.value = 3;
  bus.connect(comp).connect(out);

  // 殘響：用衰減的雜訊當作空間的回響
  const rev = ctx.createConvolver(), len = ctx.sampleRate * 5, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (rnd() * 2 - 1) * (1 - i / len) ** 3; }
  rev.buffer = ir;
  const wet = ctx.createGain(); wet.gain.value = 0.55; rev.connect(wet).connect(bus);

  // 鋪底：兩支微微走音的鋸齒波經過低通濾波，濾波器慢慢開合
  const padF = ctx.createBiquadFilter(); padF.type = 'lowpass'; padF.frequency.value = 650; padF.Q.value = 0.6;
  const lfo = ctx.createOscillator(), lfoG = ctx.createGain(); lfo.frequency.value = 0.04; lfoG.gain.value = 280; lfo.connect(lfoG).connect(padF.frequency); lfo.start();
  const pad = ctx.createGain(); pad.gain.value = 0.55; padF.connect(pad); pad.connect(bus); pad.connect(rev);

  // 持續的低音
  const drone = ctx.createGain(); drone.gain.value = 0.02; drone.connect(bus);
  for (const [m, d] of [[38, 0], [45, 4]]) { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = midi(m); o.detune.value = d; o.connect(drone); o.start(); }

  // 空氣感：很淡的帶通雜訊
  const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate), nd = nb.getChannelData(0);
  for (let i = 0; i < nd.length; i++) nd[i] = rnd() * 2 - 1;
  const ns = ctx.createBufferSource(); ns.buffer = nb; ns.loop = true;
  const nf = ctx.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.5;
  const ng = ctx.createGain(); ng.gain.value = 0.012; ns.connect(nf).connect(ng).connect(bus); ns.start();

  // 高音點綴：正弦波短音，接一段回音再進殘響
  const dl = ctx.createDelay(2), fb = ctx.createGain(), sp = ctx.createGain();
  dl.delayTime.value = 0.45; fb.gain.value = 0.38; sp.gain.value = 0.5;
  dl.connect(fb).connect(dl); sp.connect(dl); sp.connect(rev); dl.connect(rev); dl.connect(bus);

  let nextChord = ctx.currentTime + 0.1, k = 0, nextSpark = ctx.currentTime + 3;
  return function schedule(until) {
    while (nextChord < until) {
      const t = nextChord, dur = STEP + 5;
      for (const m of CHORDS[k % CHORDS.length]) {
        const g = ctx.createGain(), lv = 0.05;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(lv, t + 4); g.gain.setValueAtTime(lv, t + dur - 5); g.gain.linearRampToValueAtTime(0, t + dur);
        g.connect(padF);
        for (const d of [-7, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = midi(m); o.detune.value = d; o.connect(g); o.start(t); o.stop(t + dur + 0.1); }
      }
      k++; nextChord += STEP;
    }
    while (nextSpark < until) {
      const t = nextSpark, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.value = midi(SPARK[Math.floor(rnd() * SPARK.length)]);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.09, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g).connect(sp); o.start(t); o.stop(t + 2);
      nextSpark += 2.5 + rnd() * 4;
    }
  };
}

function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- 網頁上的開關 ----------
const btn = document.querySelector('#musicBtn');
if (btn) {
  let ctx = null, master = null, schedule = null, timer = 0, on = false, ducked = false;
  const level = () => (on && !ducked && !document.hidden ? VOL : 0);
  const fade = (sec) => { if (!master) return; const t = ctx.currentTime; master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t); master.gain.linearRampToValueAtTime(level(), t + sec); };
  const start = () => {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0; master.connect(ctx.destination);
      schedule = build(ctx, master);
    }
    ctx.resume(); schedule(ctx.currentTime + 4);
    clearInterval(timer); timer = setInterval(() => schedule(ctx.currentTime + 4), 1000);
  };
  const set = (v) => {
    on = v; btn.classList.toggle('on', on); btn.setAttribute('aria-pressed', on);
    try { localStorage.setItem('music', on ? 'on' : 'off'); } catch {}
    if (on) { start(); fade(3); } else if (ctx) { fade(1.2); setTimeout(() => { if (!on) { clearInterval(timer); ctx.suspend(); } }, 1400); }
  };
  btn.addEventListener('click', (e) => { e.stopPropagation(); set(!on); });

  // 預設開啟（除非訪客之前自己關掉）：開關先顯示成開著，等第一次點畫面或按鍵才真的出聲
  let saved = null; try { saved = localStorage.getItem('music'); } catch {}
  if (saved !== 'off') {
    on = true; btn.classList.add('on'); btn.setAttribute('aria-pressed', true);
    start(); fade(4); // 有些瀏覽器（或訪客常來的網站）允許直接出聲，這時一進來就有音樂
    // 其他的要等訪客第一次操作。手機上手指按下去那一刻還不算，要放開（touchend／click）才算，所以幾種都聽，直到真的出聲為止
    const EVS = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];
    const done = () => EVS.forEach((ev) => removeEventListener(ev, kick, true));
    const kick = (e) => {
      if (e.target.closest && e.target.closest('#musicBtn')) return; // 第一下就是按開關的人，交給開關處理（等於關掉）
      if (!on) return done();
      ctx.resume().then(() => { if (ctx.state === 'running') { done(); fade(4); } });
    };
    EVS.forEach((ev) => addEventListener(ev, kick, true));
  }

  // 作品影片在播的時候讓位
  const vids = [...document.querySelectorAll('#play video, #lightbox video')];
  const check = () => { ducked = vids.some((v) => !v.paused && !v.ended); fade(ducked ? 0.6 : 2.5); };
  vids.forEach((v) => ['play', 'pause', 'ended', 'emptied'].forEach((ev) => v.addEventListener(ev, check)));
  document.addEventListener('visibilitychange', () => fade(0.5)); // 切到別的分頁就靜音
}
