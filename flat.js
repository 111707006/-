// 平面版：跑不動 3D 的裝置（或訪客自己選）看的版本。
// 內容不另外寫一份：說明文字、按鈕、方案的三片玻璃板、影片清單（main.js 的 SCN）都是同一份，
// 這裡只是把它們搬進一般往下捲的版面，再加上捲動效果。改 index.html 或 SCN，3D 版和平面版會一起變。
// 平面版自己才有的字（區塊標題、捲動字帶）寫在下面的 T，中英兩版都在這裡。

const T = {
  plansKicker: ['PLANS', 'PLANS'], plansTitle: ['合作方案', 'Plans'],
  plansLead: ['從一支開始，或長期合作。每個方案都可以打開方案說明書看細節。', 'Start with one video or work with us long-term. Open the plan guide on any card for the details.'],
  client: ['客戶作品', 'CLIENT WORK'], videos: (n) => [`${n} 支影片`, `${n} videos`],
  marquee: ['BEYOND THE FRAME', 'BEYOND THE FRAME'],
};
const $ = (s, r = document) => r.querySelector(s);
const en = () => document.documentElement.lang === 'en';
const t = (pair) => pair[en() ? 1 : 0];

let ctx = null, sections = [], playing = null;

// 捲到某一站（數字＝原本 3D 的站點 0–4；'plans'＝方案）
export function flatGo(s) {
  const el = s === 'plans' ? $('#f-plans') : sections.find((x) => +x.dataset.k === s);
  if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
const current = () => { let k = 0; for (const s of sections) if (s.getBoundingClientRect().top < innerHeight * 0.45) k = +s.dataset.k; return k; };
export function flatStep(d) { flatGo(Math.min(Math.max(current() + d, 0), 4)); }

// 播放一格作品：一格有好幾支時，燈箱上方出現 ‹ 1 / 2 ›，播完自動接下一支
export function flatPlay(k) {
  const ids = ctx.SCN[k][0], lb = $('#lightbox'), v = $('#lightbox video'), sw = $('#lightbox .sw');
  let i = 0;
  const load = () => {
    ctx.openFilm(`web/${ids[i]}.mp4`); v.poster = `${ctx.MEDIA}posters/${ids[i]}.jpg`;
    sw.hidden = ids.length < 2; sw.querySelector('span').textContent = `${i + 1} / ${ids.length}`;
  };
  playing = { next: (d) => { i = (i + d + ids.length) % ids.length; load(); }, auto: () => { if (i < ids.length - 1) { i++; load(); } } };
  load(); lb.hidden = false;
}

export function buildFlat(c) {
  ctx = c;
  const panels = [...document.querySelectorAll('.panel')];
  const img = (name, alt = '') => `<img src="assets/flat/${name}-900.jpg" srcset="assets/flat/${name}-900.jpg 900w, assets/flat/${name}-1600.jpg 1600w" sizes="(max-width: 760px) 100vw, 60vw" alt="${alt}" decoding="async">`;
  const main = document.createElement('main'); main.id = 'flat';
  main.innerHTML = `
    <div class="f-progress" aria-hidden="true"></div>
    <section class="f-hero" data-k="0"><div class="f-bg">${img('hero')}</div><div class="f-text"></div><div class="f-cue" aria-hidden="true"><i></i></div></section>
    <div class="f-marquee" aria-hidden="true"><span></span></div>
    <section class="f-sec f-split f-gvs" data-k="1"><div class="f-media f-film" data-fx><video muted loop playsinline preload="none" poster="${c.MEDIA}posters/welcome-to-fg-gvs.jpg"></video><button class="f-play" aria-label="播放形象影片" data-en-label="Play brand film"><span></span></button></div><div class="f-text"></div></section>
    <section class="f-sec f-work" data-k="2"><div class="f-text"></div><div class="f-grid"></div><button class="f-ad" data-fx type="button"></button></section>
    <section class="f-sec f-split f-ops" data-k="3"><div class="f-text"></div><div class="f-media f-frame" data-fx>${img('ops')}</div></section>
    <section class="f-sec f-plans" id="f-plans"><div class="f-head"><div class="no" data-fx></div><h2 data-fx></h2><p data-fx></p></div><div class="f-cards"></div></section>
    <section class="f-sec f-contact" data-k="4"><div class="f-bg">${img('contact')}</div><div class="f-text"></div></section>`;
  document.body.append(main);
  sections = [...main.querySelectorAll('[data-k]')];

  // 原本的說明（同一份）搬進各區
  sections.forEach((s) => { const p = panels[+s.dataset.k]; if (p) $('.f-text', s).append(p); });
  // 方案：三片玻璃板（同一份）搬進方案區
  const cards = $('.f-cards', main);
  document.querySelectorAll('.wl.glass').forEach((g, i) => { const w = document.createElement('div'); w.className = 'f-plan'; w.dataset.fx = ''; w.style.setProperty('--i', i); w.append(g); cards.append(w); });
  // 方案說明書原本放在 3D 方案畫面裡，搬到最外層，平面版才打得開
  const book = $('#book'); if (book) document.body.append(book);

  // 形象影片：畫面裡循環播 6 秒的靜音預覽，按播放鍵（或說明裡的按鈕）看完整版
  const film = $('.f-film', main), fv = $('video', film);
  const filmBtn = panels[1] && panels[1].querySelector('[data-film]');
  $('.f-play', film).addEventListener('click', () => filmBtn && filmBtn.click());
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting) { if (!fv.src) fv.src = `${c.MEDIA}previews/welcome-to-fg-gvs.mp4`; fv.play().catch(() => {}); } else fv.pause();
  }, { threshold: 0.25 }).observe(film);

  // 作品格：資料直接用 SCN；滑鼠移上去才載入、播放 6 秒預覽（手機只放封面，省流量也省電）
  const grid = $('.f-grid', main), hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
  grid.innerHTML = c.SCN.map(([ids], k) => `<button class="f-card" data-k="${k}" data-fx style="--i:${k % 3}" type="button"><span class="f-m"><img src="${c.MEDIA}posters/${ids[0]}.jpg" alt="" loading="lazy" decoding="async"><video muted loop playsinline preload="none"></video></span><span class="f-cap"></span><span class="f-pi" aria-hidden="true"></span></button>`).join('');
  grid.querySelectorAll('.f-card').forEach((b) => {
    const k = +b.dataset.k, v = $('video', b);
    b.addEventListener('click', () => flatPlay(k));
    if (hover) {
      b.addEventListener('mouseenter', () => { if (!v.src) v.src = `${c.MEDIA}previews/${c.SCN[k][0][0]}.mp4`; v.play().then(() => b.classList.add('live')).catch(() => {}); });
      b.addEventListener('mouseleave', () => { v.pause(); b.classList.remove('live'); });
    }
  });

  // 燈箱的 ‹ › 與自動接下一支（只有作品格會用到）
  const sw = $('#lightbox .sw');
  sw.addEventListener('click', (e) => { const d = e.target.closest('button'); if (d && playing) { e.stopPropagation(); playing.next(+d.dataset.d); } });
  $('#lightbox video').addEventListener('ended', () => { if (!sw.hidden && playing) playing.auto(); });

  // 廣告投放：作品下面一條，內容用 #ads 那一份，點了打開同一個說明
  const ad = $('.f-ad', main);
  ad.addEventListener('click', () => $('#adsBtn').click());

  // 平面版自己的字：跟著語言換
  const words = () => {
    $('.f-marquee span', main).textContent = Array(6).fill(t(T.marquee) + '  ·  FG STUDIO  ·  GVS  ·  ').join('');
    const h = $('.f-head', main); $('.no', h).textContent = `03 — ${t(T.plansKicker)}`; $('h2', h).textContent = t(T.plansTitle); $('p', h).textContent = t(T.plansLead);
    grid.querySelectorAll('.f-card').forEach((b) => {
      const [ids, zh, e2] = c.SCN[+b.dataset.k], k = +b.dataset.k + 1;
      $('.f-cap', b).innerHTML = `<small>${t(T.client)} 0${k}</small><b>${en() ? e2 : zh}</b>${en() ? '' : `<i>${e2}</i>`}${ids.length > 1 ? `<em>${t(T.videos(ids.length))}</em>` : ''}`;
      b.setAttribute('aria-label', `${en() ? e2 : zh}`);
    });
    const ads = $('#ads');
    ad.innerHTML = `<small>${$('.tag', ads).textContent}</small><b>${$('h3', ads).textContent}</b><span>${$('.lead', ads).textContent}</span><i aria-hidden="true">→</i>`;
  };
  words();
  new MutationObserver(words).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  // 大標題一行一行從下面浮上來
  const h1 = $('.f-hero h1', main);
  if (h1) h1.innerHTML = h1.innerHTML.split(/<br\s*\/?>/i).map((l, i) => `<span class="f-line" style="--i:${i}"><span>${l}</span></span>`).join('');

  // 說明裡的每一段依序出現
  sections.forEach((s) => { const p = $('.panel', s); if (p) [...p.children].filter((ch) => !ch.classList.contains('menu')).forEach((ch, i) => { ch.dataset.fx = ''; ch.style.setProperty('--i', i); }); });

  // 進入畫面就加上 .in（所有瀏覽器都支援）；視差、字帶、進度條在支援的瀏覽器上用 CSS 的捲動動畫做（flat.css）
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  main.querySelectorAll('[data-fx]').forEach((el) => io.observe(el));

  // 玻璃板是照 1000px 寬設計的；平面版縮放成卡片的寬度（設計寬度改成 880，字大一點）
  const fit = () => cards.querySelectorAll('.f-plan').forEach((w) => { const g = $('.wl.glass', w); if (g) g.style.zoom = (w.clientWidth / 880).toFixed(4); });
  fit(); addEventListener('resize', fit);

  // 右邊的站點導覽、頂端的陰影、首頁的「往下滑」提示
  const dots = [...document.querySelectorAll('.rail .dot')], prev = $('.rail .prev'), next = $('.rail .next'), header = $('header');
  const onScroll = () => {
    const k = current(); document.body.dataset.stop = k;
    dots.forEach((d, i) => d.classList.toggle('on', i === k)); prev.disabled = k === 0; next.disabled = k === 4;
    header.classList.toggle('scrolled', scrollY > 40);
  };
  addEventListener('scroll', onScroll, { passive: true }); onScroll();

  // 提示（例如「此裝置改用平面版」），幾秒後自己收起來
  const note = $('.note');
  if (c.note) { note.classList.add('show'); setTimeout(() => note.classList.remove('show'), 7000); }
}
