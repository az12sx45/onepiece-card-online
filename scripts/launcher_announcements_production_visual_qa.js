'use strict';
// Supplementary actual-config visual evidence. Production renderer; isolated IPC.
// No synthetic announcements are added. This does not contact real accounts.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'tools/launcher-room/presentation-v126/review-evidence');
const scratch = 'D:/Codex_QA/launcher-announcements-1.2.6/production-visual-temp'; fs.mkdirSync(scratch, { recursive: true }); process.env.TEMP = scratch; process.env.TMP = scratch;
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/13827bafdc0b5422/bin/node_modules/playwright');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const names = ['main.js', 'preload.js', 'auth-service.js', 'launcher.html', 'launcher.js', 'launcher-updates-ui.js', 'launcher-profile-shop.js', 'launcher-announcements.js', 'launcher-announcements.css'];
const hashes = () => Object.fromEntries(names.map(name => [name, sha(fs.readFileSync(path.join(root, 'desktop', name)))]));
const sourceSha256 = hashes(), captures = [], results = [], errors = [];
const fixturePath = path.join(root, 'scripts/launcher_announcements_client_qa.js'), fixtureSource = fs.readFileSync(fixturePath, 'utf8');
const fixture = vm.runInNewContext('(' + fixtureSource.slice(fixtureSource.indexOf('function fixture('), fixtureSource.indexOf('\nasync function capture(')) + ')');
const configPath = path.join(root, 'config/launcher-announcements-v1.json'), configBytes = fs.readFileSync(configPath), config = JSON.parse(configBytes);
const notices = config.announcements.map(({ id, publishedAt, title, summary, scope, category, version, body, cta }) => ({ id, publishedAt, title, summary, scope, category, version, body, ...(cta ? { cta } : {}) }));
const expected = ['crew-ace-1.2.6', 'launcher-1.2.6-announcements'];
assert.deepEqual(notices.map(n => n.id).sort(), expected); assert(notices.every(n => Date.parse(n.publishedAt) <= Date.now()));
const catalog = require(path.join(root, 'server/launcher-profile-shop')).CATALOG;
const shop = { catalog, items: catalog, releasedCharacterIds: catalog.filter(item => item.type === 'room_character').map(item => item.id), rosterRevision: 2 };
let server, browser, page;
async function shot(name) { const file = name + '.png'; await page.screenshot({ path: path.join(out, file), animations: 'disabled' }); captures.push({ path: file, sha256: sha(fs.readFileSync(path.join(out, file))), viewport: { width: 1280, height: 820 }, noticeIds: expected, syntheticAnnouncements: false }); }
(async () => {
  server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'launcher.html', target = path.resolve(root, 'desktop', relative);
    if (!target.startsWith(path.join(root, 'desktop') + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
    const ext = path.extname(target); response.setHeader('Content-Type', ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html'); response.end(fs.readFileSync(target));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-shader-disk-cache'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
  await context.addInitScript(fixture, { notices, shop });
  await context.route('opui://**', route => { const target = path.resolve(root, 'public', decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '')); return target.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(target) ? route.fulfill({ path: target }) : route.fulfill({ status: 404, body: 'not available' }); });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.stage === 'app' && document.getElementById('announcementBadge').textContent === '2');
  await page.locator('#announcementsButton').click();
  assert.deepEqual((await page.locator('.announcement-row').evaluateAll(nodes => nodes.map(node => node.dataset.announcementId))).sort(), expected);
  assert.equal(await page.evaluate(() => __noticeQA.calls.filter(c => c.kind === 'read').length), 0);
  await page.locator('[data-announcement-id="launcher-1.2.6-announcements"]').click();
  await page.waitForFunction(() => document.getElementById('announcementReadState').textContent === '已讀');
  const bgmParagraph = page.locator('#announcementBody p').filter({ hasText: '套用個人頁 BGM 後' });
  assert.match(await bgmParagraph.textContent(), /好友.*自動播放.*音量.*靜音.*暫停/);
  await bgmParagraph.scrollIntoViewIfNeeded();
  await shot('announcements-production-two-notices'); results.push({ name: 'actual-config-only-two-notices-center-open-keeps-both-unread', status: 'PASS', detailAlsoVerified: 'The launcher notice was then explicitly opened and its actual BGM update paragraph was scrolled into view for the capture.' });
  await page.locator('[data-announcement-id="crew-ace-1.2.6"]').click();
  await page.waitForFunction(() => document.getElementById('announcementReadState').textContent === '已讀');
  await page.locator('#announcementDetail').hover(); await page.mouse.wheel(0, 400);
  await page.waitForFunction(() => { const a = document.getElementById('announcementAction').getBoundingClientRect(), d = document.getElementById('announcementDetail').getBoundingClientRect(); return a.top >= d.top && a.bottom <= d.bottom; });
  const geometry = await page.evaluate(() => { const a = document.getElementById('announcementAction').getBoundingClientRect(), d = document.getElementById('announcementDetail').getBoundingClientRect(); return { action: { top: a.top, bottom: a.bottom, left: a.left, right: a.right }, detail: { top: d.top, bottom: d.bottom, left: d.left, right: d.right }, viewport: { width: innerWidth, height: innerHeight }, scrollTop: document.getElementById('announcementDetail').scrollTop }; });
  console.log(JSON.stringify({ geometry }));
  assert(geometry.action.top >= geometry.detail.top && geometry.action.bottom <= geometry.detail.bottom && geometry.action.right <= geometry.detail.right && geometry.action.bottom <= geometry.viewport.height);
  assert(geometry.scrollTop > 0); await shot('announcements-production-ace-cta');
  results.push({ name: 'natural-detail-scroll-exposes-entire-cta-inside-visible-panel', status: 'PASS', geometry });
  await page.locator('#announcementAction').click();
  await page.waitForFunction(() => document.querySelector('.shop-item.is-announcement-target')?.dataset.itemId === 'room-character-ace');
  assert.equal(await page.evaluate(() => __noticeQA.calls.filter(c => c.kind === 'buy').length), 0); assert(await page.locator('#shopPanel').isVisible());
  results.push({ name: 'non-force-cta-click-opens-ace-product-without-purchase', status: 'PASS' }); assert.deepEqual(errors, []); assert.deepEqual(hashes(), sourceSha256);
  const report = { schema: 'one-piece-launcher-announcements-production-visual-qa/1', ok: true, generatedAt: new Date().toISOString(), checks: results.length, results, sourceRoot: root, sourceSha256, sourceNormalizedSha256: Object.fromEntries(names.map(name => [name, sha(fs.readFileSync(path.join(root, 'desktop', name), 'utf8').replace(/\r\n/g, '\n'))])), testScriptSha256: sha(fs.readFileSync(__filename)), fixtureScriptSha256: sha(fs.readFileSync(fixturePath)), config: { path: 'config/launcher-announcements-v1.json', sha256: sha(configBytes), noticeIds: expected }, captures, errors, humanAcceptance: false, scope: 'Actual Chromium with unchanged production launcher HTML/CSP/CSS/JS. Only the two notices from actual announcement config; no synthetic announcements. Isolated IPC/backend fixture, not public server or real account/purchase. Natural element scrolling and ordinary click without force.' };
  fs.writeFileSync(path.join(out, 'ANNOUNCEMENTS_PRODUCTION_VISUAL_QA.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ok: true, checks: results.length, captures: captures.length, geometry }));
})().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
