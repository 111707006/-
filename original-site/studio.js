const works=[
{id:'sNRpOZQaV9E',title:'不請自來',client:'楊琳 YangLin',category:'music',type:'MUSIC VIDEO',desc:'FG Studio 影像製作・PPTG 導演。破億神曲創作者楊琳攜手《角頭》系列演員王宣，以敘事影像承接歌曲的情緒。',credit:'導演：PPTG｜製片：李宥嫻 Sophy Lee｜攝影：羅奇｜後期製作：PPTG、羅奇｜調色：PPTG'},
{id:'N_d9UTZmsW4',title:'歡迎光臨鷗鷗睏家居',client:'鷗鷗睏 / Sleepygulls',category:'brand',type:'BRAND FILM',desc:'從空間、產品與生活細節，建立安心舒適的品牌第一印象。'},
{id:'m6Sh6dNB5cs',title:'海洋之心',client:'鷗鷗睏 / Sleepygulls',category:'brand',type:'PRODUCT FILM',desc:'聚焦雙層獨立筒與複合式舒適層，把產品特色轉化為具體的影像。'},
{id:'dUt99uDgS4U',title:'NEW GAME',client:'PPTG',category:'music',type:'MUSIC VIDEO',desc:'Afro Pop 與 R&B 交會的中英雙語作品，在霓虹、律動與真誠之間建立視覺風格。',badge:'MTV 播出作品',credit:'詞曲：PPTG｜編曲：PPTG、Howard｜製作：PPTG、H$U、Howard｜導演、後期製作：PPTG｜攝影：PPTG、羅奇'},
{id:'85ZYVRJtkvc',title:'Nothing More Nothing Less',client:'PPTG',category:'music',type:'MUSIC VIDEO',desc:'以 Hip-Hop、Pop 與 R&B 的敘事節奏，探索追逐、成長與內在的平衡。',badge:'MTV 播出作品',credit:'詞曲：PPTG｜編曲：PPTG、Howard｜製作：PPTG、H$U、Howard｜導演、後期製作：PPTG｜攝影：PPTG、Zeon'},
{id:'3n7wBNsyBSI',title:'夏日優惠套組',client:'鷗鷗睏 / Sleepygulls',category:'brand',type:'SOCIAL CONTENT',desc:'床包、涼被與枕頭的季節企劃，讓產品組合走進有情境的品牌內容。'},
{id:'wwxwM_dHqtE',title:'在三重，認識鷗鷗睏',client:'鷗鷗睏 / Sleepygulls',category:'brand',type:'SOCIAL CONTENT',desc:'從在地切入介紹床墊專賣店，讓品牌的專業與門市特色更容易被認識。'},
{id:'tsLw-jatnIY',title:'顏牧 Pastor Yen',client:'Forty 顏世琳',category:'music',type:'MUSIC VIDEO',desc:'以音樂影像延伸創作者的表達，收錄於 FG Studio 精選作品集。',badge:'KKBOX 收錄・MTV 播出'}
];
const en=[
 ['Uninvited','Music video for YangLin, creator of the song 痴情玫瑰花, which reached over 100 million views. Starring Wang Xuan from the Gatao film series.'],
 ['Welcome to Sleepygulls','Introduces the showroom, its products and the people behind the brand.'],
 ['Ocean Series','Explains the mattress construction and what the comfort layers do.'],
 ['NEW GAME','A bilingual Afro-pop and R&B music video. Broadcast on MTV.'],
 ['Nothing More Nothing Less','A music video about ambition and inner balance. Broadcast on MTV.'],
 ['Summer Essentials','Shows how the seasonal bedding range fits into daily life.'],
 ['Meet Sleepygulls in Sanchong','A local introduction to the showroom and its specialty.'],
 ['Pastor Yen','Music video for Forty. Broadcast on MTV and available on KKBOX.']
];
works.push({id:'dvfPK_5C-nU',title:'Wedding day',client:'PPTG',category:'event',type:'EVENT FILM',desc:'以影像紀錄婚禮當天的流程與人物互動。',thumbnail:'https://i.ytimg.com/vi/dvfPK_5C-nU/hqdefault.jpg'});
en.push(['Wedding day','An event film documenting the day and the people who shared it.']);
const englishCredits={sNRpOZQaV9E:'Director: PPTG · Producer: Sophy Lee · Cinematography: 羅奇 · Post-production: PPTG and 羅奇 · Color: PPTG',dUt99uDgS4U:'Music: PPTG · Arrangement: PPTG and Howard · Production: PPTG, H$U and Howard · Director and post-production: PPTG · Cinematography: PPTG and 羅奇', '85ZYVRJtkvc':'Music: PPTG · Arrangement: PPTG and Howard · Production: PPTG, H$U and Howard · Director and post-production: PPTG · Cinematography: PPTG and Zeon'};
const grid=document.querySelector('#projects'), dialog=document.querySelector('#player'), iframe=dialog.querySelector('iframe'), watch=document.querySelector('#watch-link');
let lang='en', category='all', last;
const escapeHTML=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const t=(en,zh)=>lang==='en'?en:zh;
function render(){
 grid.innerHTML=works.map((w,i)=>({w,i})).filter(({w})=>category==='all'||category===w.category).sort(({w:a},{w:b})=>+(b.category==='brand')-+(a.category==='brand')).map(({w,i})=>{
 const title=escapeHTML(t(en[i][0],w.title)), credit=t(englishCredits[w.id],w.credit);
 return '<article class="project"><button type="button" aria-label="'+escapeHTML(t('Play ','播放：'))+title+'" data-video="'+w.id+'"><img loading="lazy" src="'+(w.thumbnail||'assets/'+w.id+'.jpg')+'" alt=""><i aria-hidden="true"></i></button><p class="label">'+escapeHTML(w.type+' / '+w.client)+'</p><h3>'+title+'</h3><p>'+escapeHTML(t(en[i][1],w.desc))+'</p>'+(credit?'<details><summary>Credits</summary><p>'+escapeHTML(credit)+'</p></details>':'')+'</article>';
 }).join('');
}
function setLang(next){lang=next;document.documentElement.lang=lang;document.querySelectorAll('span[lang]').forEach(x=>x.hidden=x.lang!==lang);document.querySelectorAll('[data-lang]').forEach(x=>x.setAttribute('aria-pressed',x.dataset.lang===lang));dialog.querySelector('.close').setAttribute('aria-label',t('Close video','關閉影片'));render();try{localStorage.setItem('fg-language',lang)}catch{}}
document.querySelectorAll('[data-lang]').forEach(x=>x.addEventListener('click',()=>setLang(x.dataset.lang)));
document.querySelectorAll('[data-filter]').forEach(x=>x.addEventListener('click',()=>{category=x.dataset.filter;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',b===x));render()}));
grid.addEventListener('click',e=>{const button=e.target.closest('[data-video]');if(!button)return;last=button;const id=button.dataset.video;watch.href='https://youtu.be/'+id;iframe.src='https://www.youtube-nocookie.com/embed/'+id+'?autoplay=1&rel=0';dialog.showModal()});
dialog.querySelector('.close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('close',()=>{iframe.removeAttribute('src');last?.focus()});
document.querySelector('#email-preferences').addEventListener('click',()=>{
 const checked=id=>document.getElementById(id).checked?t('Open to discussion','願意討論'):t('No permission indicated','未表示同意');
 location.href='mailto:forgod20232023@gmail.com?subject='+encodeURIComponent('FG STUDIO / Project inquiry')+'&body='+encodeURIComponent(t('Company:\nProject goals:\n\nPortfolio display: ','公司／品牌：\n專案需求：\n\n作品集展示：')+checked('allow-portfolio')+t('\nFG STUDIO brand promotion: ','\nFG STUDIO 品牌推廣：')+checked('allow-promotion'));
});
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const vip=document.querySelector('#vip-card');
const observeVip=new IntersectionObserver(([e])=>{if(e.isIntersecting){if(!reduced.matches)vip.open=true;observeVip.disconnect()}},{threshold:0.65});
observeVip.observe(vip.querySelector('summary'));
vip.querySelector('summary').addEventListener('click',()=>observeVip.disconnect());
if(!reduced.matches){
 const frame=document.querySelector('.film-frame');
 addEventListener('scroll',()=>frame.style.setProperty('--shift',Math.min(19,scrollY/18)+'deg'),{passive:true});
}
const feature=document.querySelector('#feature');let player,active=false,requested=false;
const syncFilm=()=>{if(player?.playVideo){if(active&&!reduced.matches){player.mute();player.playVideo()}else player.pauseVideo()}};
const observeFilm=new IntersectionObserver(([e])=>{
 active=e.isIntersecting&&e.intersectionRatio>=0.35;
 if(active&&!requested){requested=true;window.onYouTubeIframeAPIReady=()=>{player=new YT.Player('gvs-player',{host:'https://www.youtube-nocookie.com',videoId:'kVBGJUCEO3k',playerVars:{playsinline:1,rel:0},events:{onReady:e=>{e.target.getIframe().setAttribute('title','GVS Brand Film');syncFilm()}}})};const script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';document.head.append(script)}
 syncFilm();
},{threshold:[0,.35]});
observeFilm.observe(feature);
try{lang=localStorage.getItem('fg-language')==='zh-Hant'?'zh-Hant':'en'}catch{}
setLang(lang);
