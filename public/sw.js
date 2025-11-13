// sw.js —— 偉大航道爭霸戰 PWA 快取
const CACHE_NAME = 'op-card-v1';

// 這裡列出你希望安裝時就通通載好的檔案
const ASSETS = [
  './',
  './start.html',
  './game.html',
  './result.html',
  './manifest.webmanifest',

  // icon（跟 manifest 裡的要對得起來）
  './images/icon-180.png',
  './images/icon-192.png',
  './images/icon-512.png',

  // 封面 & 常用圖片
  './images/wanted.png',
  // './images/avatars/1.png',
  // './images/avatars/2.png',
  // './images/avatars/3.png',
  // './images/avatars/4.png',
  // './images/avatars/5.png',
  // './images/avatars/6.png',
  // './images/avatars/7.png',
  // './images/avatars/8.png',
  // './images/avatars/9.png',
  // './images/avatars/10.png',
  // './images/avatars/11.png',
  // './images/avatars/12.png',
  // './images/avatars/13.png',
  // './images/avatars/14.png',
  // './images/avatars/15.png',
  // './images/avatars/16.png',
  // './images/avatars/17.png',
  // './images/avatars/18.png',
  // './images/avatars/19.png',
  // './images/avatars/20.png',
  // './images/avatars/21.png',
  // './images/avatars/22.png',
  // './images/avatars/23.png',
  // './images/avatars/24.png',
  // './images/avatars/25.png',
  // './images/avatars/26.png',
  // './images/avatars/27.png',
  // './images/avatars/28.png',
  // './images/avatars/29.png',
  // './images/avatars/30.png',
  // './images/crds/0.png',
  // './images/crds/1.png',
  // './images/crds/2.png',
  // './images/crds/3.png',
  // './images/crds/4.png',
  // './images/crds/5.png',
  // './images/crds/6.png',
  // './images/crds/7.png',
  // './images/crds/8.png',
  // './images/crds/9.png',
  // './images/crds/10.png',
  // './images/crds/11.png',
  // './images/crds/12.png',
  // './images/crds/13.png',
  // './images/crds/14.png',
  // './images/crds/15.png',
  // './images/crds/16.png',
  // './images/crds/17.png',
  // './images/crds/18.png',
  // './images/crds/19.png',
  // './images/crds/back.png',
  // './images/cards/enh/0.png',
  // './images/cards/enh/1.png',
  // './images/cards/enh/2.png',
  // './images/cards/enh/3.png',
  // './images/cards/enh/4.png',
  // './images/cards/enh/5.png',
  // './images/cards/enh/6.png',
  // './images/cards/enh/7.png',
  // './images/cards/enh/8.png',
  // './images/cards/enh/9.png',
  // './images/cards/enh/10.png',
  // './images/cards/enh/11.png',
  // './images/cards/enh/12.png',
  // './images/cards/enh/13.png',
  // './images/cards/enh/14.png',
  // './images/cards/enh/15.png',
  // './images/cards/enh/16.png',
  // './images/cards/enh/17.png',
  // './images/cards/enh/18.png',
  // './images/cards/enh/19.png',
  // './images/venues/alabasta.jpg',
  // './images/venues/amazonlily.jpg',
  // './images/venues/baratie.jpg',
  // './images/venues/dressrosa.jpg',
  // './images/venues/enieslobby.jpg',
  // './images/venues/fishmanisland.jpg',
  // './images/venues/hachinosu.jpg',
  // './images/venues/onigashima.jpg',
  // './images/venues/oro-jackson.jpg',
  // './images/venues/punkhazard.jpg',
  // './images/venues/sabaody.jpg',
  // './images/venues/wano.jpg',
  // './images/venues/weatheria.jpg',
  // './images/venues/wholecake.jpg',
  // './images/venues/zou.jpg',
  // './images/venues/九蛇島.png',
  // './images/venues/佐烏.png',
  // './images/venues/和之國.png',
  // './images/venues/夏波帝諸島.png',
  // './images/venues/奧羅傑克森號.png',
  // './images/venues/巴拉蒂.png',
  // './images/venues/德雷斯羅薩鬥技場.png',
  // './images/venues/維薩利亞.png',
  // './images/venues/艾尼艾斯大廳.png',
  // './images/venues/萬國.png',
  // './images/venues/蜂巢島.png',
  // './images/venues/阿拉巴斯坦.png',
  // './images/venues/鬼島.png',
  // './images/venues/魚人島.png',
  // './images/venues/龐克哈薩德.png',



  // ... 這邊把你常用的頭像 / 卡圖 / 場地慢慢加進來

  // BGM / 音效（檔名照你的實際路徑改）
  // './audio/bgm.mp3',
  // './audio/intro.mp3',
  // './audio/bgm/track01.mp3',
  // './audio/bgm/track02.mp3',
  // './audio/bgm/track03.mp3',
  // './audio/bgm/track04.mp3',
  // './audio/bgm/track05.mp3',
  // './audio/bgm/track06.mp3',
  // './audio/bgm/track07.mp3',
  // './audio/bgm/track08.mp3',
  // './audio/bgm/track09.mp3',
  // './audio/bgm/track10.mp3',
  // './audio/bgm/track11.mp3',
  // './audio/bgm/track12.mp3',
  // './audio/bgm/track13.mp3',
  // './audio/bgm/track14.mp3',
  // './audio/bgm/track15.mp3',
  // './audio/bgm/track16.mp3',
  // './audio/bgm/track17.mp3',
  // './audio/bgm/track18.mp3',
  // './audio/bgm/track19.mp3',
  // './audio/bgm/track20.mp3',
  // './videos/coin.mp4',
  // './videos/start.mp4',
  // './videos/enh/0.mp4',
  // './videos/enh/1.mp4',
  // './videos/enh/2.mp4',
  // './videos/enh/3.mp4',
  // './videos/enh/4.mp4',
  // './videos/enh/5.mp4',
  // './videos/enh/6.mp4',
  // './videos/enh/7.mp4',
  // './videos/enh/8.mp4',
  // './videos/enh/9.mp4',
  // './videos/enh/10.mp4',
  // './videos/enh/11.mp4',
  // './videos/enh/12.mp4',
  // './videos/enh/13.mp4',
  // './videos/enh/14.mp4',
  // './videos/enh/15.mp4',
  // './videos/enh/16.mp4',
  // './videos/enh/17.mp4',
  // './videos/enh/18.mp4',
  // './videos/enh/19.mp4',

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
