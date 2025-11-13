// sw.js —— 偉大航道爭霸戰 PWA 快取
const CACHE_NAME = 'op-card-v2';

// 基本頁面 + manifest + icon
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

// 頭像 1~30
const AVATARS = Array.from({ length: 30 }, (_, i) =>
  `./images/avatars/${i + 1}.png`
);

// 卡面 0~19 + 卡背
const CARDS = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/${i}.png`
).concat([
  './images/cards/back.png'
]);

// 強化卡面 0~19
const CARDS_ENH = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/enh/${i}.png`
);

// 場地背景（照你現有 jpg 檔名）
const VENUES = [
  'alabasta','amazonlily','baratie','dressrosa','enieslobby',
  'fishmanisland','hachinosu','onigashima','oro-jackson','punkhazard',
  'sabaody','wano','weatheria','wholecake','zou'
].map(n => `./images/venues/${n}.jpg`);

// 影片
const VIDEOS = [
  './videos/start.webm',
  './videos/start.mp4',
  './videos/coin.mp4',
  // 強化影片 0~19
  ...Array.from({ length: 20 }, (_, i) =>
    `./videos/enh/${i}.mp4`
  ),
];

// BGM（依你實際的路徑改名）
const BGM = [
  './audio/bgm.mp3',
  // 或 ./audio/bgm/track01.mp3 ... track20.mp3 這樣列
];

// 最終要預先載入的清單
const ASSETS = [
  ...CORE,
  ...AVATARS,
  ...CARDS,
  ...CARDS_ENH,
  ...VENUES,
  ...VIDEOS,
  ...BGM,
];

// 安裝：預先快取所有資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// 啟用：清掉舊版本快取
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
});

// 攔截請求：先看快取，有就回快取，沒有才去網路
self.addEventListener('fetch', event => {
  const req = event.request;
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req);
    })
  );
});
