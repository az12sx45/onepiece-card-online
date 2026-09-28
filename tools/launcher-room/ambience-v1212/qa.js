'use strict';
// Isolated Chromium visual proof using the shipped scene art and ambience code.
// No player account, save, purchase, or production server is used.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../../..');
const out = path.resolve(process.env.ROOM_AMBIENCE_QA_OUTPUT || 'D:/Codex_QA/launcher-room-ambience-1.2.12');
fs.mkdirSync(out, { recursive: true });
const candidates = [process.env.BOARD_QA_PLAYWRIGHT, process.env.PLAYWRIGHT_MODULE].filter(Boolean);
const runtime = path.join(process.env.LOCALAPPDATA || '', 'OpenAI/Codex/runtimes/cua_node');
if (fs.existsSync(runtime)) for (const entry of fs.readdirSync(runtime, { withFileTypes: true })) {
  if (entry.isDirectory()) candidates.push(path.join(runtime, entry.name, 'bin/node_modules/playwright'));
}
const playwright = candidates.map(candidate => { try { return require(candidate); } catch { return null; } }).find(Boolean);
if (!playwright) throw new Error('Playwright module unavailable');
const chrome = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(fs.existsSync);
if (!chrome) throw new Error('Chrome or Edge unavailable');
const scenes = [
  ['crew-cabin', 'crew-cabin-v2.webp'], ['sunny-deck', 'sunny-deck-v2.webp'],
  ['sunny-kitchen', 'sunny-kitchen-v2.webp'], ['sunny-library', 'sunny-library-v2.webp'],
  ['sunny-workshop', 'sunny-workshop.webp'], ['sunny-aquarium', 'sunny-aquarium.webp']
];
const states = [
  ['summer-day-clear', '2026-07-12T13:10:00', 'clear', '夏 · 白天 · 晴朗'],
  ['spring-dawn-rain', '2026-04-12T05:45:00', 'rain', '春 · 清晨 · 下雨'],
  ['autumn-dusk-storm', '2026-10-12T18:20:00', 'storm', '秋 · 黃昏 · 雷雨'],
  ['winter-night-snow', '2026-12-12T23:10:00', 'snow', '冬 · 夜晚 · 飄雪'],
  ['winter-night-clear', '2026-12-12T23:10:00', 'clear', '冬 · 夜晚 · 晴朗']
];
const mime = pathname => pathname.endsWith('.css') ? 'text/css' : pathname.endsWith('.js') ? 'text/javascript' : pathname.endsWith('.webp') ? 'image/webp' : 'text/html';
const html = `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/desktop/launcher-room.css"><link rel="stylesheet" href="/desktop/launcher-room-ambience.css"><style>body{margin:0;padding:30px;background:#071b26;color:#f4ddaa;font:13px sans-serif}.room-stage-scroll{max-width:960px;margin:auto}.room-stage{width:960px}.room-objects,.room-character-layer{z-index:10}</style></head><body><div class="room-stage-scroll"><div class="room-stage" id="roomStage"><img class="room-scene" id="roomScene" alt="測試場景"><div class="room-objects" id="roomObjects"></div><div class="room-character-layer" id="roomCharacters"></div><div class="room-stage-caption" id="roomCaption">航海夥伴房間 · 場景演出檢查</div></div></div><script>window.__ONE_PIECE_ROOM_QA__=true</script><script src="/desktop/launcher-room-ambience.js"></script></body></html>`;
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.pathname === '/') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end(html); return; }
  const relative = url.pathname.slice(1);
  if (!/^(desktop\/launcher-room(?:-ambience)?\.(?:js|css)|public\/images\/launcher_room\/scenes\/[a-z0-9-]+\.webp)$/.test(relative)) {
    res.writeHead(404); res.end(); return;
  }
  const absolute = path.join(root, relative);
  if (!absolute.startsWith(root + path.sep) || !fs.existsSync(absolute)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': mime(relative) });
  fs.createReadStream(absolute).pipe(res);
});
(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const browser = await playwright.chromium.launch({ executablePath: chrome, headless: true, args: ['--disable-gpu-sandbox'] });
  const checks = [];
  const files = [];
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
      await page.goto(`http://127.0.0.1:${port}/`);
      for (const [scene, asset] of scenes) {
        const selectedStates = viewport.width < 400 ? [states[0], states[2], states[3]] : states;
        for (const [label, date, weather, expectedText] of selectedStates) {
          const data = await page.evaluate(({ scene, asset, date, weather }) => {
            const image = document.getElementById('roomScene');
            image.src = `/public/images/launcher_room/scenes/${asset}`;
            const layer = window.OnePieceRoomAmbience;
            layer.setScene({ stage: document.getElementById('roomStage'), sceneKey: scene });
            layer.setQaOverride({ date, weather });
            const stage = document.getElementById('roomStage');
            return { scene: stage.dataset.roomScene, season: stage.dataset.roomSeason,
              daypart: stage.dataset.roomDaypart, weather: stage.dataset.roomWeather,
              canvas: !!stage.querySelector('.room-ambience-canvas[data-drawn="true"]'),
              text: stage.querySelector('.room-ambience-badge').textContent,
              outsidePointerEvents: getComputedStyle(stage.querySelector('.room-ambience')).pointerEvents };
          }, { scene, asset, date, weather });
          await page.waitForFunction(() => document.getElementById('roomScene').complete && document.getElementById('roomScene').naturalWidth === 1600);
          assert.equal(data.scene, scene);
          assert.equal(data.weather, weather);
          assert.equal(data.text, expectedText);
          assert.equal(data.canvas, true);
          assert.equal(data.outsidePointerEvents, 'none');
          const suffix = viewport.width < 400 ? 'mobile' : 'desktop';
          const filename = `${scene}-${label}-${suffix}.png`;
          await page.screenshot({ path: path.join(out, filename) });
          files.push(filename);
          checks.push(`${scene}/${label}/${suffix}`);
        }
      }
      if (viewport.width === 1440) {
        await page.evaluate(() => {
          const image = document.getElementById('roomScene');
          image.src = '/public/images/launcher_room/scenes/sunny-deck-v2.webp';
          window.OnePieceRoomAmbience.setScene({ stage: document.getElementById('roomStage'), sceneKey: 'sunny-deck' });
          window.OnePieceRoomAmbience.setQaOverride({ date: '2026-10-12T18:20:00', weather: 'storm' });
          const flash = document.querySelector('.room-ambience-lightning');
          flash.style.animation = 'none'; flash.style.opacity = '.48';
        });
        const flashFile = 'sunny-deck-thunder-flash-desktop.png';
        await page.screenshot({ path: path.join(out, flashFile) });
        files.push(flashFile);
        checks.push('sunny-deck/lightning-peak/desktop');
        await page.emulateMedia({ reducedMotion: 'reduce' });
        await page.evaluate(() => window.OnePieceRoomAmbience.setQaOverride({ date: '2026-10-12T18:20:00', weather: 'storm' }));
        const reduced = await page.locator('.room-ambience-lightning').evaluate(node => getComputedStyle(node).display);
        assert.equal(reduced, 'none');
        checks.push('reduced-motion/lightning-disabled');
        const access = await page.evaluate(() => { window.__ONE_PIECE_ROOM_QA__ = false; return window.OnePieceRoomAmbience.setQaOverride({ date: '2026-10-12T18:20:00', weather: 'snow' }); });
        assert.equal(access, false);
        checks.push('qa-override/production-gate');
      }
      await page.close();
    }
    const report = { status: 'PASS', checks: checks.length, scenes: scenes.map(x => x[0]),
      images: files, sourceSha256: Object.fromEntries(['desktop/launcher-room-ambience.js','desktop/launcher-room-ambience.css'].map(name => [name, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, name))).digest('hex')])) };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(`PASS ${checks.length} checks; ${files.length} screenshots; ${out}`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => server.close());
