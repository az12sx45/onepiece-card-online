'use strict';
// Visual QA of the production work overlay with isolated life data and local art.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const playwrightRoot = path.join(process.env.LOCALAPPDATA, 'OpenAI/Codex/runtimes/cua_node');
const playwrightModule = process.env.BOARD_QA_PLAYWRIGHT || fs.readdirSync(playwrightRoot)
  .map(name => path.join(playwrightRoot, name, 'bin/node_modules/playwright')).find(fs.existsSync);
const { chromium } = require(playwrightModule);
const life = require('../server/launcher-life-store');
const root = path.resolve(__dirname, '..');
const out = process.env.LAUNCHER_WORK_ART_QA_OUT || 'D:/Codex_QA/launcher-life-fishing-weather-1.2.15/work-art-client';
fs.mkdirSync(out, { recursive: true });
process.env.TEMP = out;
process.env.TMP = out;
const db = new PGlite();
const errors = [], checks = [], screenshots = [];
let server, browser, serial = 0, queue = Promise.resolve();
const pool = {
  query: (...args) => db.query(...args),
  async connect() {
    const previous = queue;
    let release;
    queue = new Promise(resolve => { release = resolve; });
    await previous;
    return { query: (...args) => db.query(...args), release };
  }
};
function check(name, value) {
  assert(value, name);
  checks.push(name);
}
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function fixture() {
  const initial = { authenticated: false, profile: null, preferences: {}, games: {} };
  window.onePieceDesktop = {
    getState: async () => initial, onState() {}, onSocialState() {}, onLauncherUpdate() {}, onProgress() {}, onSessionKicked() {},
    getSocialState: async () => ({ ok: false }), getLauncherUpdateState: async () => ({ ok: false }),
    getLauncherAnnouncements: async () => ({ ok: false }), getLauncherShop: async () => ({ ok: false }),
    getLauncherProfile: async () => ({ ok: false }), getLauncherComments: async () => ({ ok: false }),
    getLauncherLife: async () => ({ ok: false })
  };
}
async function profile(secret, key) {
  const today = new Date().toISOString().slice(0, 10);
  const stats = {
    client: { totals: { coins: 73 } }, launcherWalletV1: { coins: 100, lastGrantDay: today },
    launcherOwnedV1: { items: [`room-character-${key}`] },
    launcherRoomV1: { revision: 1, sceneId: 'room-scene-default', capacityVersion: 2,
      placements: [], characters: [{ itemId: `room-character-${key}`, x: 300, y: 440 }] }
  };
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)',
    [secret, secret, '8', JSON.stringify(stats)]);
}
async function capture(page, name) {
  const file = path.join(out, `${name}.png`);
  await page.screenshot({ path: file });
  screenshots.push({ file, sha256: sha(fs.readFileSync(file)), viewport: page.viewportSize() });
}
async function main() {
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await profile('repair-qa', 'franky');
  await profile('navigation-qa', 'nami');
  await profile('cooking-qa', 'sanji');
  await profile('supply-qa', 'usopp');
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'launcher.html';
    const target = path.join(root, 'desktop', rel);
    if (rel.includes('..') || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(target);
    res.setHeader('Content-Type', ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(target));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1280, height: 850 } });
  await context.addInitScript(fixture);
  const artLoads = [];
  await context.route('opui://**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const target = path.join(root, 'public', rel);
    if (rel.startsWith('images/launcher_room/minigames_v1/')) artLoads.push({ rel, exists: fs.existsSync(target) });
    return !rel.includes('..') && fs.existsSync(target) ? route.fulfill({ path: target }) : route.fulfill({ status: 404, body: 'missing' });
  });
  await context.exposeFunction('__workArtCommand', async (secret, type, payload) => {
    const current = await life.getLauncherLife(pool, secret, new Date(), { crewContentRevision: 1 });
    return life.commandLauncherLife(pool, secret,
      { type, payload, requestId: `work-art-${String(++serial).padStart(8, '0')}`, expectedRevision: current.life.revision },
      new Date(), { crewContentRevision: 1 });
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.OnePieceRoomMinigames);
  await page.evaluate(() => {
    window.__qaUser = '';
    window.__job = OnePieceRoomMinigames.create({ command: (type, payload) => __workArtCommand(__qaUser, type, payload) });
  });
  for (const job of [
    { name: 'repair', key: 'franky', secret: 'repair-qa', art: 'repair-workbench-v2.webp' },
    { name: 'navigation', key: 'nami', secret: 'navigation-qa', art: 'navigation-chart-v2.webp' },
    { name: 'cooking', key: 'sanji', secret: 'cooking-qa', art: 'cooking-galley-v2.webp' },
    { name: 'supply', key: 'usopp', secret: 'supply-qa', art: 'supply-deck-v2.webp' }
  ]) {
    await page.evaluate(({ secret }) => { window.__qaUser = secret; }, job);
    check(`${job.name} opens`, await page.evaluate(({ name, key }) => __job.open({ kind: 'work', characterId: `room-character-${key}`, jobId: name }), job));
    await page.getByRole('button', { name: '準備好了 · 開始挑戰' }).click();
    await page.waitForFunction(() => ['showcase', 'answer'].includes(__job.inspect().phase));
    await page.waitForFunction(() => __job.inspect().phase === 'answer');
    const background = await page.locator(`.room-minigame-stage.job-${job.name}`).last()
      .evaluate(node => getComputedStyle(node).backgroundImage);
    check(`${job.name} uses reviewed art`, background.includes(job.art));
    await capture(page, `${job.name}-active-desktop`);
    await page.setViewportSize({ width: 390, height: 844 });
    await capture(page, `${job.name}-active-narrow`);
    const card = await page.locator('.room-minigame-card').last().boundingBox();
    check(`${job.name} narrow card fits`, card.x >= 0 && card.x + card.width <= 390);
    await page.getByRole('button', { name: '結束並關閉挑戰' }).click();
    const confirm = page.getByRole('button', { name: '結束並回房間' });
    if (await confirm.count()) await confirm.click();
    await page.setViewportSize({ width: 1280, height: 850 });
  }
  check('all four new art files loaded', ['repair-workbench-v2.webp', 'navigation-chart-v2.webp', 'cooking-galley-v2.webp', 'supply-deck-v2.webp']
    .every(name => artLoads.some(item => item.rel.endsWith(name) && item.exists)));
  check('no page errors', errors.length === 0);
  const report = { schema: 'launcher-work-art-client-qa/1', status: 'PASS', checks, screenshots, artLoads, errors,
    limitations: ['Automated Chromium, not human playtest.', 'Isolated PGlite state; no production account or service.'] };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, report: path.join(out, 'report.json') }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await db.close(); });
