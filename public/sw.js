// sw.js — 偉大航道爭霸戰（穩定全快取版 + 豪華素材）
// ⚠️ 改動重點：
// 1. 新增 豪華卡圖 / 豪華強化卡圖 / 寶箱圖片 預快取
// 2. CACHE_NAME 升版，強制重新 install

const CACHE_NAME = 'op-card-v7.3';

// === 基本檔案 ===
const CORE = [
  './',
  './start.html',
  './game.html',
  './result.html',
  './manifest.webmanifest',
  './images/icon-180.png',
  './images/icon-192.png',
  './images/icon-512.png',
  './images/wanted.png',
  './images/cover.jpg',
];

// === 頭像（1~30）===
const AVATARS = Array.from({ length: 30 }, (_, i) =>
  `./images/avatars/${i + 1}.webp`
);

// === 一般卡圖（0~19）===
const CARDS = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/${i}.webp`
).concat(['./images/cards/back.webp']);

// === 一般強化卡圖（0~19）===
const CARDS_ENH = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/enh/${i}.webp`
);

// === 豪華版卡圖（0~19）===
const CARDS_LUX = Array.from({ length: 20 }, (_, i) =>
  `./images/cards_lux/${i}.webp`
);

// === 豪華版強化卡圖（0~19）===
const CARDS_LUX_ENH = Array.from({ length: 20 }, (_, i) =>
  `./images/cards_lux/enh/${i}.webp`
);

// === 獎勵寶箱圖片（1~5）===
const REWARD_CHESTS = Array.from({ length: 5 }, (_, i) =>
  `./images/reward/chest_${i + 1}.webp`
);

// === 場地背景 ===
const VENUES = [
  'alabasta','amazonlily','baratie','dressrosa','enieslobby',
  'fishmanisland','hachinosu','onigashima','oro-jackson','punkhazard',
  'sabaody','wano','weatheria','wholecake','zou'
].map(n => `./images/venues/${n}.jpg`);

// === 主要影片 ===
const VIDEOS = [
  './videos/start.mp4',
  './videos/coin.mp4',
  './videos/draw.mp4',
];

// === 強化影片（0~19）===
const VIDEOS_ENH = Array.from({ length: 20 }, (_, i) =>
  `./videos/enh/${i}.mp4`
);

// === BGM ===
const BGM = [
  './audio/intro.mp3',
  './audio/bgm.mp3',
  ...Array.from({ length: 20 }, (_, i) =>
    `./audio/bgm/track${String(i + 1).padStart(2, '0')}.mp3`
  ),
];

// === 最終快取清單 ===
const ASSETS = [
  ...CORE,
  ...AVATARS,

  // 一般卡圖
  ...CARDS,
  ...CARDS_ENH,

  // 豪華卡圖
  ...CARDS_LUX,
  ...CARDS_LUX_ENH,

  // 獎勵寶箱
  ...REWARD_CHESTS,

  ...VENUES,
  ...VIDEOS,
  ...VIDEOS_ENH,
  ...BGM,
];

// === 安全快取工具（逐一加入，失敗不中斷）===
async function addAllSettled(cache, urls) {
  let ok = 0, fail = 0;

  for (const url of urls) {
    try {
      const req = new Request(url, { cache: 'reload' });
      const res = await fetch(req);

      if (res && res.ok) {
        await cache.put(req, res.clone());
        ok++;
      } else {
        fail++;
      }
    } catch {
      fail++;
    }
  }

  console.log(`[SW] precache done: ${ok}/${urls.length} ok, ${fail} fail`);
  return { ok, fail, total: urls.length };
}

// === install：預快取所有資源 ===
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await addAllSettled(cache, ASSETS);
    await self.skipWaiting();
  })());
});

// === activate：清除舊 cache，立即接管 ===
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null))
    );
    await self.clients.claim();
  })());
});

// === fetch：cache-first + runtime 補洞 ===
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // ⛔ i18n 語言檔不走 SW（避免卡舊翻譯）
  if (req.url.includes('/i18n/')) return;

  // 只處理 GET
  if (req.method !== 'GET') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);

      if (
        res &&
        res.ok &&
        new URL(req.url).origin === self.location.origin
      ) {
        await cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      const fallback = await cache.match(req);
      if (fallback) return fallback;
      throw err;
    }
  })());
});
