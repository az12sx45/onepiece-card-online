// sw.js — 偉大航道爭霸戰（穩定全快取版 + 豪華素材 + 語音）
// 新增：audio/voice 全語音預快取

const CACHE_NAME = 'op-card-v7.4';

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

// === 一般卡圖 ===
const CARDS = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/${i}.webp`
).concat(['./images/cards/back.webp']);

const CARDS_ENH = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/enh/${i}.webp`
);

// === 豪華卡圖 ===
const CARDS_LUX = Array.from({ length: 20 }, (_, i) =>
  `./images/cards_lux/${i}.webp`
);

const CARDS_LUX_ENH = Array.from({ length: 20 }, (_, i) =>
  `./images/cards_lux/enh/${i}.webp`
);

// === 獎勵寶箱 ===
const REWARD_CHESTS = Array.from({ length: 5 }, (_, i) =>
  `./images/reward/chest_${i + 1}.webp`
);

// === 場地 ===
const VENUES = [
  'alabasta','amazonlily','baratie','dressrosa','enieslobby',
  'fishmanisland','hachinosu','onigashima','oro-jackson','punkhazard',
  'sabaody','wano','weatheria','wholecake','zou'
].map(n => `./images/venues/${n}.jpg`);

// === 影片 ===
const VIDEOS = [
  './videos/start.mp4',
  './videos/coin.mp4',
  './videos/draw.mp4',
];

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

// === 語音（整包快取）===
const VOICE = [
  ...Array.from({ length: 20 }, (_, i) => `./audio/voice/${i}.mp3`),

  // 組合語音（明確列出，避免漏）
  './audio/voice/0-8.mp3',
  './audio/voice/1-8.mp3',
  './audio/voice/2-8.mp3',
  './audio/voice/3-2.mp3',
  './audio/voice/3-7.mp3',
  './audio/voice/3-12.mp3',
  './audio/voice/5-8.mp3',
  './audio/voice/8-1.mp3',
  './audio/voice/8-3.mp3',
  './audio/voice/8-4.mp3',
  './audio/voice/8-7.mp3',
  './audio/voice/8-10-14.mp3',
  './audio/voice/9-8.mp3',
  './audio/voice/10-8.mp3',
  './audio/voice/11-8.mp3',
  './audio/voice/11-13.mp3',
  './audio/voice/12-3.mp3',
  './audio/voice/14-10.mp3',
  './audio/voice/15-8.mp3',
  './audio/voice/16-2.mp3',
  './audio/voice/17-18.mp3',
  './audio/voice/17-5-7-8.mp3',
  './audio/voice/18-8.mp3',
  './audio/voice/18-17.mp3',
];

// === 最終快取清單 ===
const ASSETS = [
  ...CORE,
  ...AVATARS,
  ...CARDS,
  ...CARDS_ENH,
  ...CARDS_LUX,
  ...CARDS_LUX_ENH,
  ...REWARD_CHESTS,
  ...VENUES,
  ...VIDEOS,
  ...VIDEOS_ENH,
  ...BGM,
  ...VOICE,
];

// === 安全快取 ===
async function addAllSettled(cache, urls) {
  for (const url of urls) {
    try {
      const req = new Request(url, { cache: 'reload' });
      const res = await fetch(req);
      if (res && res.ok) await cache.put(req, res.clone());
    } catch {}
  }
}

// === install ===
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await addAllSettled(cache, ASSETS);
    await self.skipWaiting();
  })());
});

// === activate ===
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => k !== CACHE_NAME && caches.delete(k)));
    await self.clients.claim();
  })());
});

// === fetch ===
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || req.url.includes('/i18n/')) return;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    const res = await fetch(req);
    if (res && res.ok && new URL(req.url).origin === self.location.origin) {
      cache.put(req, res.clone());
    }
    return res;
  })());
});
