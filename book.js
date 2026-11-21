// 方案說明書：在方案（三片玻璃板）的畫面按「方案說明書」打開，像電子書一頁一頁翻。
// 內容整理自《GVS 企業影像處理服務 合作方案與收費說明》。中英兩版都寫在這裡，跟著 <html lang> 換。
// 翻頁：下一頁＝目前這頁沿左邊翻過去；上一頁＝翻回來。按鈕、左右方向鍵、手指左右滑都可以。

const P = (zh, en) => ({ zh, en });
const PAGES = [
  P(`<div class="cover"><small>FG STUDIO / GVS</small><h2>企業影像<br>處理服務</h2><p class="sub">合作方案與收費說明</p><p class="slogan">Global Video Service<br>用心認識你的品牌，再說好你的故事。</p><span class="hint">往左滑或按 › 翻頁</span></div>`,
    `<div class="cover"><small>FG STUDIO / GVS</small><h2>Business Video<br>Service</h2><p class="sub">Plans and Pricing</p><p class="slogan">Global Video Service<br>We get to know your brand with care, then tell your story well.</p><span class="hint">Swipe left or tap › to turn</span></div>`),
  P(`<h3><b>01</b>服務理念</h3><p>GVS 致力於為企業、教育機構及各類品牌，提供專業且穩定的影像製作服務。</p><p>我們相信，好的品牌影像不只是單次的作品，而是透過長期合作，逐步建立一致的視覺風格、品牌識別與內容品質。</p><p>因此，GVS 提供<strong>年度簽約月費合作方案</strong>，協助合作單位以更具成本效益的方式，持續產出符合品牌需求的影音內容。</p>`,
    `<h3><b>01</b>Our Approach</h3><p>GVS provides professional, dependable video production for businesses, schools and brands of every kind.</p><p>We believe good brand video is not a one-off piece. Through a long-term partnership we build a consistent visual style, brand identity and level of quality over time.</p><p>That is why GVS offers an <strong>annual contract with a monthly fee</strong>, so you can keep producing on-brand video in a more cost-effective way.</p>`),
  P(`<h3><b>02</b>VIP 基礎方案</h3><div class="big"><span>年度簽約月費合作方案</span>NT$25,450<em>／月</em></div><ul><li><i>影片數量</i>每月 15 支</li><li><i>合作方式</i>年度簽約月費制</li><li><i>計費週期</i>每月</li><li><i>單支長度</i>90 秒以內</li><li><i>製作原則</i>採用統一且事先確認的品牌視覺風格</li></ul>`,
    `<h3><b>02</b>VIP Plan</h3><div class="big"><span>Annual contract, monthly fee</span>NT$25,450<em> / month</em></div><ul><li><i>Videos</i>15 a month</li><li><i>Terms</i>Annual contract, monthly fee</li><li><i>Billing</i>Monthly</li><li><i>Length</i>Up to 90 seconds each</li><li><i>Style</i>One brand look, agreed in advance</li></ul>`),
  P(`<h3><b>02</b>年度合約怎麼執行</h3><p>本方案以一年為基本合作契約期間，每月依約定內容執行。</p><p>方案價格建立在長期合作、製作流程標準化及品牌風格一致的基礎上，因此<strong>不適用於將單月份的影片數量拆到不同月份執行</strong>。</p><div class="note"><i>例如</i>每月 15 支的方案，不能拆成兩個月、每月各做 8 支。</div>`,
    `<h3><b>02</b>How the Annual Contract Works</h3><p>The plan runs for a one-year contract, delivered month by month as agreed.</p><p>The price rests on a long-term partnership, a standardised workflow and a consistent brand style, so <strong>a month's videos cannot be spread across other months</strong>.</p><div class="note"><i>For example</i>A 15-a-month plan can't be split into two months of 8 videos each.</div>`),
  P(`<h3><b>03</b>加購影片</h3><div class="big"><span>第 16 支起，每支</span>NT$450</div><p>年度簽約客戶在當月用完 VIP 基礎方案後，如有額外需求可以加購。</p><table><tr><th>當月數量</th><th>費用</th></tr><tr><td>15 支</td><td>NT$25,450</td></tr><tr><td>16 支</td><td>NT$25,900</td></tr><tr><td>20 支</td><td>NT$27,700</td></tr><tr><td>30 支</td><td>NT$32,200</td></tr></table>`,
    `<h3><b>03</b>Extra Videos</h3><div class="big"><span>From the 16th video, each</span>NT$450</div><p>Annual-contract clients who use up the month's VIP plan can add more videos.</p><table><tr><th>Videos that month</th><th>Fee</th></tr><tr><td>15</td><td>NT$25,450</td></tr><tr><td>16</td><td>NT$25,900</td></tr><tr><td>20</td><td>NT$27,700</td></tr><tr><td>30</td><td>NT$32,200</td></tr></table>`),
  P(`<h3><b>03</b>加購包含與不包含</h3><p>加購影片以既有品牌視覺風格及製作模板為基礎，包含基本剪輯、既有風格套用與必要的影像後製處理。</p><p class="lbl">NT$450 加購單價不包含</p><ul class="dash"><li>全新視覺風格開發</li><li>額外 Motion Design 動態視覺設計</li><li>客製化動畫及特殊視覺效果</li><li>每支影片獨立的創意企劃或重新設計</li><li>超出既定製作規格的特殊後製需求</li></ul><p class="small">如涉及上述項目，將依實際製作內容另行評估及報價。</p>`,
    `<h3><b>03</b>What Extra Videos Include</h3><p>Extra videos build on your existing brand style and templates: basic editing, applying the established look, and the post-production they need.</p><p class="lbl">The NT$450 rate does not include</p><ul class="dash"><li>Developing a new visual style</li><li>Additional motion design</li><li>Custom animation and special effects</li><li>A separate creative concept or redesign per video</li><li>Post-production beyond the agreed spec</li></ul><p class="small">Anything above is assessed and quoted separately.</p>`),
  P(`<h3><b>04</b>單支影片製作</h3><div class="big"><span>非年度簽約，每支</span>NT$2,000<em> 起</em></div><p>沒有年度簽約的客戶，也可以依個別需求委託製作。</p><p>實際報價依影片內容、製作複雜度、品牌需求、視覺設計及交付規格評估。</p><p class="small">單支製作不適用年度合作方案的加購優惠單價。</p>`,
    `<h3><b>04</b>Single Videos</h3><div class="big"><span>Without an annual contract, from</span>NT$2,000<em> each</em></div><p>Clients without an annual contract can commission videos one at a time.</p><p>Quotes depend on content, complexity, brand needs, visual design and delivery specs.</p><p class="small">The annual plan's extra-video rate does not apply to single videos.</p>`),
  P(`<h3><b>05</b>製作規格與適用條件</h3><ol><li><b>影片長度</b>原則上以 90 秒以內的短影音為主。</li><li><b>品牌風格一致</b>合作初期先確認品牌視覺方向（字體、字幕、色彩、轉場與整體風格），之後的影片以此為基礎。</li><li><b>既有風格延伸</b>優惠價格主要適用於既有流程與風格的延伸運用。</li><li><b>個別特殊需求</b>每支都要不同方向、全新設計、動態特效或獨立企劃時，另行提供客製化報價。</li></ol>`,
    `<h3><b>05</b>Specs and Conditions</h3><ol><li><b>Length</b>Mainly short-form videos of up to 90 seconds.</li><li><b>Consistent brand style</b>We agree your visual direction first (type, subtitles, colour, transitions, overall look) and build every later video on it.</li><li><b>Extending the style</b>The plan prices apply to extending the established workflow and style.</li><li><b>Special requests</b>If every video needs a new direction, new design, motion effects or its own concept, we quote it separately.</li></ol>`),
  P(`<h3><b>06</b>報價原則</h3><p>所列價格均為基本製作起始價格，並非所有類型的影片都適用相同單價；實際費用依品牌需求、製作規模、影片複雜度及後製內容評估。</p><p>GVS 也會依長期合作關係與專案需求，提供適度的額外製作支援或視覺優化；這屬於個別合作安排，不代表所有方案都包含額外 Motion Design 或特殊客製化製作。</p><p>我們希望透過清楚的規格、合理的價格與持續的溝通，讓合作品牌在控制成本的同時，維持專業且一致的影像品質。</p>`,
    `<h3><b>06</b>How We Quote</h3><p>All prices are starting prices; not every type of video has the same rate. Final fees depend on brand needs, scale, complexity and post-production.</p><p>For long-term partners and specific projects, GVS may add extra production support or visual polish. That is arranged case by case and does not mean every plan includes extra motion design or custom work.</p><p>Clear specs, fair pricing and steady communication let you control cost while keeping your video professional and consistent.</p>`),
  P(`<div class="cover end"><small>FG STUDIO｜富居影像音樂工作室</small><h2>開始合作</h2><p class="sub">GVS — Global Video Service</p><p class="slogan">用心認識你的品牌，<br>再說好你的故事。</p></div>`,
    `<div class="cover end"><small>FG STUDIO</small><h2>Let's Work<br>Together</h2><p class="sub">GVS — Global Video Service</p><p class="slogan">We get to know your brand with care,<br>then tell your story well.</p></div>`),
];

const book = document.querySelector('#book');
if (book) {
  const pagesEl = book.querySelector('.pages'), noEl = book.querySelector('.no'), prevB = book.querySelector('.prev'), nextB = book.querySelector('.next');
  let cur = 0, els = [];
  const en = () => document.documentElement.lang === 'en';
  const render = () => {
    pagesEl.innerHTML = PAGES.map((p, i) => `<section class="pg" style="z-index:${PAGES.length - i}">${en() ? p.en : p.zh}<span class="pn">${i + 1}</span></section>`).join('');
    els = [...pagesEl.children]; show();
  };
  const show = () => {
    els.forEach((el, i) => { el.classList.toggle('turned', i < cur); el.setAttribute('aria-hidden', i !== cur); });
    noEl.textContent = `${cur + 1} / ${PAGES.length}`;
    prevB.disabled = cur === 0; nextB.disabled = cur === PAGES.length - 1;
    book.classList.toggle('last', cur === PAGES.length - 1);
  };
  const go = (d) => { const n = Math.min(Math.max(cur + d, 0), PAGES.length - 1); if (n !== cur) { cur = n; show(); } };
  // 每片玻璃板上的「方案說明書」：直接翻到那個方案的那一頁（data-page 從 1 算）
  const open = (e) => { e.stopPropagation(); cur = Math.max(0, (+e.currentTarget.dataset.page || 1) - 1); render(); book.hidden = false; nextB.focus({ preventScroll: true }); };
  const close = () => { book.hidden = true; };
  document.querySelectorAll('.bookgo').forEach((b) => b.addEventListener('click', open));
  prevB.addEventListener('click', (e) => { e.stopPropagation(); go(-1); });
  nextB.addEventListener('click', (e) => { e.stopPropagation(); go(1); });
  book.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); close(); });
  book.querySelector('.go').addEventListener('click', close); // 「洽談 GVS 方案」：main.js 帶主旨到聯絡那一站，這裡只負責把書關掉
  book.addEventListener('click', (e) => { if (e.target === book) close(); });
  book.addEventListener('wheel', (e) => e.stopPropagation()); // 不要讓滾輪把方案的畫面關掉
  addEventListener('keydown', (e) => {
    if (book.hidden) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); go(-1); }
    if (e.key === 'Escape') { e.stopImmediatePropagation(); close(); }
  }, true);
  // 手指左右滑翻頁（上下滑留給頁面內容捲動）
  let sx = 0, sy = 0;
  pagesEl.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; });
  pagesEl.addEventListener('pointerup', (e) => { const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.2) go(dx < 0 ? 1 : -1); });
  // 換語言時，書開著就換成另一個語言的內容，停在同一頁
  new MutationObserver(() => { if (!book.hidden) render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
}
