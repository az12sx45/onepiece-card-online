// sw.js — 偉大航道爭霸戰（穩定全快取版）
const CACHE_NAME = 'op-card-v7.2';

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

// === 卡片（正確在 images/cards/）===
const CARDS = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/${i}.webp`
).concat(['./images/cards/back.webp']);

// === 強化卡面 ===
const CARDS_ENH = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/enh/${i}.webp`
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

// === 強化影片 ===
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

// === 最終清單 ===
const ASSETS = [
  ...CORE,
  ...AVATARS,
  ...CARDS,
  ...CARDS_ENH,
  ...VENUES,
  ...VIDEOS,
  ...VIDEOS_ENH,
  ...BGM,
];

// 安全快取：逐一加入，失敗不會讓整個 install 掛掉
async function addAllSettled(cache, urls) {
  let ok = 0, fail = 0;

  for (const url of urls) {
    try {
      // 用 Request 讓 cache key 更一致
      const req = new Request(url, { cache: 'reload' });
      const res = await fetch(req);

      // 只快取成功回應
      if (res && res.ok) {
        await cache.put(req, res.clone());
        ok++;
      } else {
        fail++;
      }
    } catch (e) {
      fail++;
    }
  }

  return { ok, fail, total: urls.length };
}

// === 安裝：快取所有（穩定版）===
self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await addAllSettled(cache, ASSETS);
    await self.skipWaiting();
  })());
});

// === 啟用：刪舊快取 + 立即接管 ===
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)));
    await self.clients.claim();
  })());
});

// === 使用快取：cache-first + runtime put（補洞）===
self.addEventListener('fetch', (e) => {
  const req = e.request;

  // ⛔ i18n 語言檔不要走 SW 快取，避免更新後一直拿舊版
  // 例如：/i18n/zh-Hant.js, /i18n/en.js, /i18n/ja.js, /i18n/ko.js, /i18n/i18n.js
  if (req.url.includes('/i18n/')) {
    return; // 直接交給瀏覽器走網路，不攔截、不快取
  }

  // 只處理 GET，避免把 POST/socket 之類搞壞
  if (req.method !== 'GET') return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);

    // 先找快取
    const cached = await cache.match(req);
    if (cached) return cached;

    // 沒有就走網路
    try {
      const res = await fetch(req);

      // 成功才寫入快取（同源且 ok）
      if (res && res.ok && new URL(req.url).origin === self.location.origin) {
        await cache.put(req, res.clone());
      }
      return res;
    } catch (err) {
      // 網路掛掉時，至少回傳 cache（若有）
      const fallback = await cache.match(req);
      if (fallback) return fallback;
      throw err;
    }
  })());
});


