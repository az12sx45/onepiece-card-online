// sw.js —— 偉大航道爭霸戰 PWA 快取（強化版）
const CACHE_NAME = 'op-card-v2';

// 核心頁面 & 設定
const CORE_ASSETS = [
  './',
  './start.html',
  './game.html',
  './result.html',
  './manifest.webmanifest',

  // icon（跟 manifest 裡的要對得起來）
  './images/icon-180.png',
  './images/icon-192.png',
  './images/icon-512.png',
];

// 頭像（30 個）
const AVATAR_ASSETS = Array.from({ length: 30 }, (_, i) =>
  `./images/avatars/${i + 1}.png`
);

// 卡面（根據你現在的路徑填，這裡先照你 sw.js 的註解走）
const CARD_ASSETS = [
  './images/cards/0.png',
  './images/cards/1.png',
  './images/cards/2.png',
  './images/cards/3.png',
  './images/cards/4.png',
  './images/cards/5.png',
  './images/cards/6.png',
  './images/cards/7.png',
  './images/cards/8.png',
  './images/cards/9.png',
  './images/cards/10.png',
  './images/cards/11.png',
  './images/cards/12.png',
  './images/cards/13.png',
  './images/cards/14.png',
  './images/cards/15.png',
  './images/cards/16.png',
  './images/cards/17.png',
  './images/cards/18.png',
  './images/cards/19.png',
  './images/cards/back.png',
];

// 強化卡圖
const ENH_CARD_ASSETS = Array.from({ length: 20 }, (_, i) =>
  `./images/cards/enh/${i}.png`
);

// 場地背景（照你註解的路徑）
const VENUE_ASSETS = [
  './images/venues/alabasta.jpg',
  './images/venues/amazonlily.jpg',
  './images/venues/baratie.jpg',
  './images/venues/dressrosa.jpg',
  './images/venues/enieslobby.jpg',
  './images/venues/fishmanisland.jpg',
  './images/venues/hachinosu.jpg',
  './images/venues/onigashima.jpg',
  './images/venues/oro-jackson.jpg',
  './images/venues/punkhazard.jpg',
  './images/venues/sabaody.jpg',
  './images/venues/wano.jpg',
  './images/venues/weatheria.jpg',
  './images/venues/wholecake.jpg',
  './images/venues/zou.jpg',

  // 你有用到的中文檔名也可以放進來（如果還在用）
  './images/venues/九蛇島.png',
  './images/venues/佐烏.png',
  './images/venues/和之國.png',
  './images/venues/夏波帝諸島.png',
  './images/venues/奧羅傑克森號.png',
  './images/venues/巴拉蒂.png',
  './images/venues/德雷斯羅薩鬥技場.png',
  './images/venues/維薩利亞.png',
  './images/venues/艾尼艾斯大廳.png',
  './images/venues/萬國.png',
  './images/venues/蜂巢島.png',
  './images/venues/阿拉巴斯坦.png',
  './images/venues/鬼島.png',
  './images/venues/魚人島.png',
  './images/venues/龐克哈薩德.png',
];

// BGM / 音效（看你實際檔案路徑，先放最常用的）
const AUDIO_ASSETS = [
  './audio/bgm.mp3',
  './audio/intro.mp3',
];

// 影片（硬幣 + 開場 + 強化）
const VIDEO_ASSETS = [
  './videos/coin.mp4',
  './videos/start.mp4',
  // 如果有 webm 版也一起放
  './videos/start.webm',
  // 強化影片 0~19
  ...Array.from({ length: 20 }, (_, i) => `./videos/enh/${i}.mp4`),
];

const ASSETS = [
  ...CORE_ASSETS,
  ...AVATAR_ASSETS,
  ...CARD_ASSETS,
  ...ENH_CARD_ASSETS,
  ...VENUE_ASSETS,
  ...AUDIO_ASSETS,
  ...VIDEO_ASSETS,
];

// 安裝：預先快取所有資源
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting()) // 安裝後直接啟用新版 SW
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
    ).then(() => self.clients.claim())
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
