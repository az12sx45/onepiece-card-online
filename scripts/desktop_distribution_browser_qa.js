'use strict';

// Disposable Chromium contexts and a loopback-only Service Worker fixture.
// The target receives GET requests only; no installer or game assets are downloaded.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const { RETIRED_WORKER } = require('../server/desktop-distribution');
const args = process.argv.slice(2);
function option(name, fallback) {
  const index = args.indexOf(name);
  if (index < 0) return fallback;
  if (!args[index + 1] || args[index + 1].startsWith('--')) throw new Error(`Missing ${name} value`);
  return args[index + 1];
}
const BASE = new URL(option('--base', 'http://127.0.0.1:18927')).origin;
const OUT = path.resolve(option('--out', 'D:/Codex_QA/desktop-only-20260922'));
if (!/^https?:\/\//.test(BASE)) throw new Error('Use an HTTP(S) --base');
fs.mkdirSync(OUT, { recursive: true });
const reportPath = path.join(OUT, 'browser-report.json');
const report = { startedAt: new Date().toISOString(), base: BASE, scope: 'GET-only target checks; isolated browser profiles and loopback Service Worker fixture; no production rooms or user data.', checks: [], pages: [], http: [], worker: null, screenshots: [], errors: [] };
function save() { fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n'); }
function check(name, pass, detail) {
  report.checks.push({ name, pass: !!pass, detail });
  save();
  assert(pass, name);
}

async function landing(browser) {
  for (const [width, height] of [[1366, 900], [390, 844], [320, 740]]) {
    const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: 'block' });
    const requests = [], responses = [], errors = [], responseJobs = [], blocked = [];
    try {
      await context.route('**/*', route => {
        const request = route.request();
        if (new URL(request.url()).origin === BASE && ['GET', 'HEAD'].includes(request.method())) return route.continue();
        blocked.push({ url: request.url(), method: request.method() });
        return route.abort();
      });
      const page = await context.newPage();
      page.on('request', request => requests.push(request.url()));
      page.on('pageerror', error => errors.push(error.message));
      page.on('download', download => errors.push('Unexpected automatic download: ' + download.suggestedFilename()));
      page.on('response', response => responseJobs.push((async () => {
        responses.push({ url: response.url(), status: response.status(), bodyBytes: (await response.body()).length, contentType: response.headers()['content-type'] || '' });
      })().catch(error => errors.push(error.message))));
      const navigation = await page.goto(BASE + '/download', { waitUntil: 'networkidle', timeout: 30000 });
      await Promise.all(responseJobs);
      const ui = await page.evaluate(() => ({
        title: document.title,
        overflow: document.documentElement.scrollWidth > innerWidth,
        href: document.getElementById('download-link')?.href,
        release: document.getElementById('release-info')?.textContent,
        buttonHeight: document.getElementById('download-link')?.getBoundingClientRect().height,
        forbiddenElements: document.querySelectorAll('script[src],img,audio,video,iframe').length,
        games: Array.from(document.querySelectorAll('.game h3'), element => element.textContent),
      }));
      const record = { width, height, ui, requests, responses, blocked, errors };
      report.pages.push(record);
      check(`${width}px download page returns 200`, navigation.status() === 200);
      check(`${width}px no horizontal overflow`, !ui.overflow, ui);
      check(`${width}px usable download link`, /^https:\/\/game-assets\.rihdi\.tw\/desktop\/launcher\/releases\/[0-9A-Za-z][0-9A-Za-z._-]*\/[0-9A-Za-z][0-9A-Za-z._-]*\.exe$/.test(ui.href || '') && ui.buttonHeight >= 44);
      check(`${width}px only landing and release metadata`, requests.length === 2 && requests.every(url => ['/download', '/desktop/launcher-release-v1.json'].includes(new URL(url).pathname)) && blocked.length === 0, record.requests);
      check(`${width}px no game/media elements or errors`, ui.forbiddenElements === 0 && errors.length === 0 && ui.games.length === 3, { errors, forbiddenElements: ui.forbiddenElements });
      check(`${width}px payload stays small`, responses.every(response => response.status === 200 && response.bodyBytes < 15000) && responses.reduce((sum, response) => sum + response.bodyBytes, 0) < 20000, responses);
      const screenshot = path.join(OUT, `download-${width}.png`);
      await page.screenshot({ path: screenshot, fullPage: true });
      report.screenshots.push(screenshot);
      save();
    } finally { await context.close(); }
  }
}

async function httpGate(browser) {
  const context = await browser.newContext({ serviceWorkers: 'block' });
  try {
    for (const pathname of ['/start.html', '/board_start.html', '/board_game.html', '/board_battle.html', '/chess/index.html', '/chess/battle-game.html']) {
      const response = await context.request.get(BASE + pathname, { maxRedirects: 0, timeout: 20000 });
      const record = { path: pathname, status: response.status(), location: response.headers().location, bodyBytes: (await response.body()).length };
      report.http.push(record);
      check(`browser game redirects: ${pathname}`, record.status === 302 && record.location === '/download' && record.bodyBytes < 200, record);
    }
    for (const pathname of ['/js/board_game.js', '/js/board_battle.js', '/vendor/socket.io-client/4.8.1/socket.io.min.js']) {
      const response = await context.request.get(BASE + pathname, { maxRedirects: 0, timeout: 20000 });
      const body = await response.body();
      const record = { path: pathname, status: response.status(), bodyBytes: body.length, body: body.toString('utf8') };
      report.http.push(record);
      check(`browser game code blocked: ${pathname}`, record.status === 403 && body.length < 500 && JSON.parse(record.body).error === 'desktop_required', record);
    }
    const page = await context.newPage();
    await page.goto(BASE + '/board_start.html', { waitUntil: 'networkidle', timeout: 30000 });
    check('real browser game navigation reaches download', page.url() === BASE + '/download' && await page.locator('#download-link').count() === 1, { url: page.url() });
    const worker = await context.request.get(BASE + '/sw.js', { maxRedirects: 0, timeout: 20000 });
    const workerText = await worker.text();
    const record = { path: '/sw.js', status: worker.status(), bodyBytes: Buffer.byteLength(workerText), cacheControl: worker.headers()['cache-control'], contentType: worker.headers()['content-type'] };
    report.http.push(record);
    check('target serves current retirement worker without cache', worker.status() === 200 && workerText === RETIRED_WORKER && record.cacheControl === 'no-store' && /javascript/.test(record.contentType), record);
    return workerText;
  } finally { await context.close(); }
}

async function workerRetirement(browser, retiredWorker) {
  const html = fs.readFileSync(path.join(__dirname, '../public/desktop-download.html'));
  const release = fs.readFileSync(path.join(__dirname, '../public/desktop/launcher-release-v1.json'));
  const oldPage = '<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"></head><body><h1 id="old-cached-page">舊遊戲快取測試頁</h1></body></html>';
  const oldWorker = `self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open('qa-old-game-cache');await cache.put('/board_game.html',new Response(${JSON.stringify(oldPage)},{headers:{'Content-Type':'text/html'}}));await self.skipWaiting();})()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request))));`;
  let retired = false;
  const fixtureRequests = [];
  const server = http.createServer((req, res) => {
    const pathname = new URL(req.url, 'http://fixture.local').pathname;
    fixtureRequests.push({ path: pathname, phase: retired ? 'retired' : 'old' });
    res.setHeader('Cache-Control', 'no-store');
    if (pathname === '/sw.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(retired ? retiredWorker : oldWorker); }
    else if (pathname === '/desktop/launcher-release-v1.json') { res.setHeader('Content-Type', 'application/json'); res.end(release); }
    else if (pathname === '/download' || pathname === '/desktop-download.html') { res.setHeader('Content-Type', 'text/html'); res.end(html); }
    else if (pathname === '/board_game.html' && retired) { res.writeHead(302, { Location: '/download' }); res.end(); }
    else if (pathname === '/seed' || pathname === '/board_game.html') { res.setHeader('Content-Type', 'text/html'); res.end(oldPage); }
    else { res.writeHead(404); res.end(); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const context = await browser.newContext({ serviceWorkers: 'allow' });
  const result = report.worker = { origin, fixtureRequests, errors: [] };
  try {
    const page = await context.newPage();
    page.on('pageerror', error => result.errors.push(error.message));
    await page.goto(origin + '/seed');
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
    });
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 15000 });
    await page.evaluate(async () => {
      localStorage.setItem('qa-player-save-sentinel', 'player-save-must-remain');
      await (await caches.open('qa-user-data-cache')).put('/qa-data-sentinel', new Response('cache-save-must-remain'));
      await new Promise((resolve, reject) => {
        const request = indexedDB.open('qa-player-save-db', 1);
        request.onupgradeneeded = () => request.result.createObjectStore('saves');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const transaction = db.transaction('saves', 'readwrite');
          transaction.objectStore('saves').put({ round: 27, sentinel: 'idb-save-must-remain' }, 'current');
          transaction.oncomplete = () => { db.close(); resolve(); };
          transaction.onerror = () => { db.close(); reject(transaction.error); };
        };
      });
    });
    const cached = await page.goto(origin + '/board_game.html', { waitUntil: 'domcontentloaded' });
    result.old = { fromServiceWorker: cached.fromServiceWorker(), cachedPageVisible: await page.locator('#old-cached-page').count() === 1 };
    check('old worker genuinely serves cached game navigation', result.old.fromServiceWorker && result.old.cachedPageVisible, result.old);
    const download = await context.newPage();
    await download.goto(origin + '/download', { waitUntil: 'networkidle' });
    await download.evaluate(() => { window.qaDownloadNavigationSentinel = 'download-page-stays'; });
    retired = true;
    const navigation = page.waitForURL(origin + '/download', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.evaluate(async () => { const registration = await navigator.serviceWorker.getRegistration('/'); void registration.update(); });
    await navigation;
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistrations()).length === 0, null, { timeout: 15000 });
    result.after = await page.evaluate(async () => ({
      url: location.href,
      registrations: (await navigator.serviceWorker.getRegistrations()).length,
      localStorage: localStorage.getItem('qa-player-save-sentinel'),
      cacheKeys: await caches.keys(),
      cacheSentinel: await (await caches.match('/qa-data-sentinel')).text(),
      oldGameCache: await (await caches.match('/board_game.html')).text(),
      indexedDb: await new Promise((resolve, reject) => {
        const request = indexedDB.open('qa-player-save-db', 1);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const read = db.transaction('saves', 'readonly').objectStore('saves').get('current');
          read.onsuccess = () => { const value = read.result; db.close(); resolve(value); };
          read.onerror = () => { db.close(); reject(read.error); };
        };
      }),
    }));
    result.downloadPageUnchanged = await download.evaluate(() => window.qaDownloadNavigationSentinel === 'download-page-stays');
    check('retirement navigates old game to download', result.after.url === origin + '/download');
    check('retirement unregisters worker', result.after.registrations === 0);
    check('retirement preserves localStorage', result.after.localStorage === 'player-save-must-remain');
    check('retirement preserves CacheStorage and cached game', result.after.cacheSentinel === 'cache-save-must-remain' && result.after.oldGameCache === oldPage && result.after.cacheKeys.includes('qa-old-game-cache') && result.after.cacheKeys.includes('qa-user-data-cache'));
    check('retirement preserves IndexedDB save', result.after.indexedDb?.round === 27 && result.after.indexedDb.sentinel === 'idb-save-must-remain', result.after.indexedDb);
    check('already-open download page is not reloaded', result.downloadPageUnchanged);
    const fresh = await context.newPage();
    await fresh.goto(origin + '/board_game.html', { waitUntil: 'networkidle' });
    check('later game navigation cannot revive the retired cache', fresh.url() === origin + '/download' && await fresh.locator('#download-link').count() === 1, { url: fresh.url() });
    check('worker fixture has no page errors', result.errors.length === 0, result.errors);
  } finally {
    await context.close();
    await new Promise(resolve => server.close(resolve));
    save();
  }
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    await landing(browser);
    const retiredWorker = await httpGate(browser);
    await workerRetirement(browser, retiredWorker);
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.errors.push(error.stack || String(error));
    process.exitCode = 1;
  } finally {
    await browser.close();
    report.finishedAt = new Date().toISOString();
    save();
  }
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, base: BASE, reportPath, errors: report.errors }, null, 2));
}
main().catch(error => { report.errors.push(error.stack || String(error)); report.ok = false; save(); console.error(error); process.exitCode = 1; });
