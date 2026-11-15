// ============================================================================
// 內容資料：影片電腦的頻道清單（docs/spec.md 第 9.1、9.2 節）
// ============================================================================
// 只標溝通情境，不標客戶名稱。溝通情境與影片的對應是依檔名推測的，待負責人確認。
// 每支影片在 media-library/ 有三種檔案：previews/（6 秒靜音）、posters/（封面）、web/ 或 videos/（完整版）。
const MEDIA = '../media-library/';
const CHANNELS = [
  { id: 'welcome-to-fg-gvs', zh: '形象影片', en: 'Brand film', full: 'videos/Welcome_to_FG_GVS.mp4' },
  { id: 'sleepygulls-brand-film', zh: '品牌介紹', en: 'Brand introduction' },
  { id: 'ys-01-new-device', zh: '產品說明', en: 'Product explainer' },
  { id: 'sg-04-mattress-sagging', zh: '客服與常見問題', en: 'Support & FAQ' },
  { id: 'ueis-milk-protein-lab', zh: '教育訓練', en: 'Training' },
  { id: 'ueis-thanksgiving-trailer-2026', zh: '校園政策與活動', en: 'Campus policy & events' },
  { id: 'sg-02-fabric-pattern', zh: '社群宣傳', en: 'Social promotion' },
];
const mediaFull = (c) => MEDIA + (c.full || 'web/' + c.id + '.mp4');
const mediaPreview = (c) => MEDIA + 'previews/' + c.id + '.mp4';
const mediaPoster = (c) => MEDIA + 'posters/' + c.id + '.jpg';
