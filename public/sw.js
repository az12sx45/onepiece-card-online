// sw.js — 偉大航道爭霸戰（正確 cards 版）
const CACHE_NAME = 'op-card-v6';

// === 基本檔案 ===
const CORE = [
  './',
  './start.html',
  './game.html',
  './result.html',
  './manifest.webmanifest',
  './images/icon-180.webp',
  './images/icon-192.webp',
  './images/icon-512.webp',
  './images/wanted.webp',
  './images/cover.jpg',
];

// === 頭像（1~30）===
const AVATARS = Array.from({ length: 30 }, (_, i) =>
  `./images/avatars/${i + 1}.webp`
);

// === 卡片（正確在 images/cards/）===
const CARDS = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/${i}.webp`
).concat([
  './images/cards/back.webp'
]);

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
    `./audio/bgm/track${String(i+1).padStart(2,'0')}.mp3`
  )
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

// === 安裝：快取所有 ===
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// === 啟用：刪舊快取 ===
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(k => k !== CACHE_NAME ? caches.delete(k) : null)
      )
    )
  );
});

// === 使用快取 ===
self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
