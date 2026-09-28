'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CATALOG } = require('../server/launcher-profile-shop');
const runtimeRoot = 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const bundledPlaywright = fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot)
  .map(name => path.join(runtimeRoot, name, 'bin/node_modules/playwright'))
  .find(candidate => fs.existsSync(path.join(candidate, 'package.json'))) : null;
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || bundledPlaywright || 'playwright');

const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.LAUNCHER_SHOP_MUSIC_QA_OUT || 'D:/Codex_QA/launcher-shop-music-preview-20260928');
const report = { scope: 'Headless Chromium, real local Ogg/MP3 bytes, mocked shop IPC; no account purchase or public deployment', checks: [], errors: [], ok: false };
fs.mkdirSync(out, { recursive: true });
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
const check = (name, condition, detail) => {
  report.checks.push({ name, pass: !!condition, detail }); save();
  assert.ok(condition, `${name}: ${JSON.stringify(detail)}`);
};
const source = file => fs.readFileSync(path.join(root, 'desktop', file), 'utf8');

async function main() {
  const chrome = process.env.BOARD_QA_CHROME ||
    (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => report.errors.push(error.stack || error.message));
    await page.route('opui://**', route => {
      const relative = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
      const target = path.resolve(root, 'public', relative);
      if (!target.startsWith(path.join(root, 'public') + path.sep) || !fs.existsSync(target)) return route.fulfill({ status: 404, body: 'not found' });
      const type = target.endsWith('.ogg') ? 'audio/ogg' : target.endsWith('.mp3') ? 'audio/mpeg' : '';
      if (!type) return route.fulfill({ path: target });
      const size = fs.statSync(target).size;
      const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
        if (start <= end && end < size) return route.fulfill({ status: 206, contentType: type,
          headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}` },
          body: fs.readFileSync(target).subarray(start, end + 1) });
      }
      return route.fulfill({ path: target, contentType: type, headers: { 'Accept-Ranges': 'bytes' } });
    });
    const html = source('launcher.html')
      .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '')
      .replace(/<link[^>]+rel="stylesheet"[^>]*>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace('<body data-stage="boot">', '<body data-stage="app">');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: source('launcher.css') + '\n' + source('launcher-profile-shop.css') });
    await page.evaluate(() => {
      const boot = document.getElementById('bootScreen');
      boot.hidden = true;
      boot.classList.remove('is-active');
      document.getElementById('launcherApp').classList.add('is-active');
    });
    await page.evaluate(catalog => {
      window.__previewQa = { buys: [], catalog };
      window.onePieceDesktop = {
        getLauncherShop: async options => ({ ok: true, shop: { catalog, preview: !!options?.preview,
          wallet: { coins: 0, dailyGrant: 0, cap: 0 }, owned: { bgms: [] }, equipped: { bgmId: 'bgm-none' } } }),
        buyLauncherItem: async id => { window.__previewQa.buys.push(id); return { ok: false, error: 'disabled' }; }
      };
      window.launcherSwitchPanel = panel => {
        for (const name of ['shop', 'profile']) document.getElementById(`${name}Panel`).hidden = name !== panel;
        window.LauncherProfileShop?.onVisible(panel);
      };
    }, CATALOG.filter(item => item.type === 'bgm'));
    await page.addScriptTag({ content: source('launcher-profile-shop.js') });
    await page.evaluate(() => {
      document.getElementById('launcherApp').hidden = false;
      LauncherProfileShop.setAccount({ authenticated: true, profile: { userId: 42, needsDisplayName: false } });
      launcherSwitchPanel('shop');
    });
    await page.getByRole('tab', { name: '音樂' }).click();
    await page.waitForFunction(() => document.querySelectorAll('#shopGrid .shop-preview-button').length === 23);
    const audio = page.locator('audio[data-role="shop-preview"]');
    const snapshot = () => audio.evaluate(node => ({ paused: node.paused, time: node.currentTime, source: node.getAttribute('src') }));
    const awaitClock = () => audio.evaluate(async node => {
      const until = performance.now() + 8000;
      while (performance.now() < until && (node.paused || node.currentTime <= .1)) await new Promise(resolve => setTimeout(resolve, 100));
      return { paused: node.paused, time: node.currentTime, source: node.getAttribute('src') };
    });
    const preview = id => page.locator(`#shopGrid .shop-item[data-item-id="${id}"] .shop-preview-button`).click();
    check('all 23 tracks available before purchase', await page.locator('.shop-preview-button').count() === 23 &&
      await page.locator('#shopGrid .shop-item[data-item-id="bgm-op-01"] .shop-item-bottom button').isDisabled());
    report.screenshots = [];
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#shopGrid').scrollIntoViewIfNeeded();
      const file = path.join(out, `shop-music-${width}.png`);
      await page.screenshot({ path: file });
      report.screenshots.push(file);
      const geometry = await page.evaluate(() => ({ width: innerWidth, pageWidth: document.documentElement.scrollWidth,
        gridWidth: document.getElementById('shopGrid').getBoundingClientRect().width }));
      check(`${width}px preview controls fit viewport`, geometry.pageWidth <= width + 1 && geometry.gridWidth <= width, geometry);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await preview('bgm-op-01');
    const first = await awaitClock();
    check('unowned OP MP3 plays', !first.paused && first.time > .1 && first.source.endsWith('/track01.mp3'), first);
    await preview('bgm-op-02');
    const second = await awaitClock();
    check('switch replaces track in same player', !second.paused && second.time > .1 && second.source.endsWith('/track02.mp3'), second);
    await preview('bgm-op-02');
    const stopped = await snapshot();
    check('second click stops and releases audio', stopped.paused && stopped.time === 0 && !stopped.source, stopped);
    await preview('bgm-harbor');
    const original = await awaitClock();
    check('original Ogg also plays', !original.paused && original.time > .1 && original.source.endsWith('/harbor.ogg'), original);
    await page.evaluate(() => { const node = document.querySelector('audio[data-role="shop-preview"]'); node.currentTime = 30; node.dispatchEvent(new Event('timeupdate')); });
    check('30 second limit stops playback', (await snapshot()).paused && !(await snapshot()).source);
    await preview('bgm-op-01');
    await page.evaluate(() => launcherSwitchPanel('profile'));
    check('leaving shop stops playback', (await snapshot()).paused && !(await snapshot()).source);
    await page.evaluate(() => launcherSwitchPanel('shop'));
    await page.getByRole('tab', { name: '音樂' }).click();
    await preview('bgm-op-01');
    await page.getByRole('tab', { name: '頭像' }).click();
    check('changing category stops playback', (await snapshot()).paused && !(await snapshot()).source);
    await page.getByRole('tab', { name: '音樂' }).click();
    await preview('bgm-op-01');
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    check('minimizing launcher stops preview', (await snapshot()).paused && !(await snapshot()).source);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.evaluate(() => {
      LauncherProfileShop.setAccount({ previewMode: true });
      launcherSwitchPanel('shop');
    });
    await page.getByRole('tab', { name: '音樂' }).click();
    await preview('bgm-harbor');
    const designPreview = await awaitClock();
    check('design preview can audition without account or purchase', !designPreview.paused && designPreview.time > .1 &&
      await page.locator('#shopGrid .shop-item[data-item-id="bgm-harbor"] .shop-item-bottom button').isDisabled(), designPreview);
    await preview('bgm-harbor');
    check('preview never calls purchase', (await page.evaluate(() => __previewQa.buys.length)) === 0);
    check('no renderer errors', report.errors.length === 0, report.errors);
    report.ok = true; save();
    console.log(JSON.stringify({ ok: true, checks: report.checks.length, report: path.join(out, 'report.json') }));
  } finally { await browser.close(); }
}
main().catch(error => { report.failure = error.stack; save(); console.error(error); process.exitCode = 1; });
