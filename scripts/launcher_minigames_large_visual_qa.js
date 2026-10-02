'use strict';
// Desktop playability and artwork check for every non-fishing room minigame.
// Chromium drives the production launcher UI; commands use isolated PGlite state.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const playwrightRoot = path.join(process.env.LOCALAPPDATA, 'OpenAI/Codex/runtimes/cua_node');
const playwrightModule = process.env.BOARD_QA_PLAYWRIGHT || fs.readdirSync(playwrightRoot)
  .map(name => path.join(playwrightRoot, name, 'bin/node_modules/playwright'))
  .find(file => fs.existsSync(path.join(file, 'package.json')));
const { chromium } = require(playwrightModule);
const life = require('../server/launcher-life-store');

const root = path.resolve(__dirname, '..');
const out = process.env.LAUNCHER_MINIGAMES_LARGE_QA_OUT || 'D:/Codex_QA/launcher-minigames-large-visual/qa';
const flowOnly = process.argv.includes('--flow-only');
const jobs = [
  { id: 'supply', character: 'usopp' },
  { id: 'cooking', character: 'sanji' },
  { id: 'repair', character: 'franky' },
  { id: 'navigation', character: 'nami' },
  { id: 'training', character: 'robin' }
];
const CONTROL_SELECTORS = {
  supply: '.room-minigame-cargo', cooking: '.room-minigame-ingredient', repair: '.room-minigame-pipe',
  navigation: '.room-minigame-sea-cell', training: '.room-minigame-direction'
};
const db = new PGlite();
let transaction = Promise.resolve();
let serial = 0;
let browser;
let server;
const checks = [];
const screenshots = [];
const errors = [];
const art = [];
const calls = [];
const pool = {
  query: (...args) => db.query(...args),
  async connect() {
    const previous = transaction;
    let release;
    transaction = new Promise(resolve => { release = resolve; });
    await previous;
    return { query: (...args) => db.query(...args), release };
  }
};
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function pass(name, value) { assert(value, name); checks.push(name); console.log(`PASS ${name}`); }
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
function ports(tile, rotation) { return (tile.type === 'straight' ? [0, 2] : [0, 1]).map(side => (side + rotation) % 4); }
function repairSolution(round) {
  const side = { north: 0, east: 1, south: 2, west: 3 };
  const neighbor = (index, direction) => {
    const x = index % round.size, y = Math.floor(index / round.size);
    const nx = x + [0, 1, 0, -1][direction], ny = y + [-1, 0, 1, 0][direction];
    return nx < 0 || ny < 0 || nx >= round.size || ny >= round.size ? -1 : ny * round.size + nx;
  };
  const rotations = round.tiles.map(tile => tile.rotation);
  function visit(index, entry, seen) {
    if (seen.has(index)) return false;
    seen.add(index);
    for (let rotation = 0; rotation < 4; rotation++) {
      const openings = ports(round.tiles[index], rotation);
      if (!openings.includes(entry)) continue;
      const exit = openings.find(direction => direction !== entry);
      rotations[index] = rotation;
      if (index === round.exit.index && exit === side[round.exit.side]) return true;
      const next = neighbor(index, exit);
      if (next >= 0 && visit(next, (exit + 2) % 4, seen)) return true;
    }
    seen.delete(index);
    return false;
  }
  assert(visit(round.entry.index, side[round.entry.side], new Set()), 'repair puzzle has a connected solution');
  return rotations;
}
function navigationSolution(round) {
  const queue = [[round.start]], seen = new Set([round.start]);
  while (queue.length) {
    const route = queue.shift(), last = route.at(-1);
    if (last === round.goal) return route;
    for (const next of [last - round.size, last + 1, last + round.size, last - 1]) {
      if (next < 0 || next >= round.size ** 2 || round.blocked.includes(next) || seen.has(next)) continue;
      if (Math.abs(last % round.size - next % round.size) + Math.abs(Math.floor(last / round.size) - Math.floor(next / round.size)) !== 1) continue;
      seen.add(next); queue.push([...route, next]);
    }
  }
  throw new Error('navigation challenge has no route');
}
async function setupProfiles() {
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  for (const job of jobs) {
    const id = `room-character-${job.character}`;
    const stats = { client: { totals: { coins: 73 } }, launcherWalletV1: { coins: 100, lastGrantDay: new Date().toISOString().slice(0, 10) },
      launcherOwnedV1: { items: [id] }, launcherRoomV1: { revision: 1, sceneId: 'room-scene-default', capacityVersion: 2, placements: [], characters: [{ itemId: id, x: 350, y: 440 }] } };
    await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)', [`large-${job.id}`, job.id, '8', JSON.stringify(stats)]);
  }
}
async function screenshot(page, label) {
  const file = path.join(out, `${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  screenshots.push({ file, sha256: sha(fs.readFileSync(file)) });
}
async function checkIntro(page, job) {
  const isWork = job.id === 'supply';
  const intro = await page.evaluate(() => {
    const box = selector => {
      const node = document.querySelector(selector);
      if (!node) return null;
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    const choices = [...document.querySelectorAll('.room-minigame-job')].map(node => {
      const rect = node.getBoundingClientRect();
      return { job: node.dataset.job, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom,
        background: getComputedStyle(node).backgroundImage };
    });
    return { card: box('.room-minigame-card'), hero: box('.room-minigame-intro-hero'),
      rule: box('.room-minigame-rules summary'), start: box('.room-minigame-intro [data-action=start]'),
      crew: box('.room-minigame-crew'), choices,
      heroBackground: getComputedStyle(document.querySelector('.room-minigame-intro-hero')).backgroundImage,
      rulesClosed: !document.querySelector('.room-minigame-rules').open,
      documentWidth: document.documentElement.scrollWidth };
  });
  const within = box => !!box && box.left >= 0 && box.right <= 1440 && box.top >= 0 && box.bottom <= 900;
  pass(`${isWork ? 'work' : 'training'} intro hero, rules and start fit one viewport`,
    intro.card.width >= 1000 && within(intro.card) && within(intro.hero) && within(intro.rule) && within(intro.start) && within(intro.crew) && intro.documentWidth <= 1440);
  pass(`${isWork ? 'work' : 'training'} rules start collapsed`, intro.rulesClosed);
  pass(`${isWork ? 'work' : 'training'} intro hero artwork exists`, intro.heroBackground.includes('minigames_'));
  if (isWork) {
    pass('four work scene cards fit one row and show distinct artwork', intro.choices.length === 4 &&
      new Set(intro.choices.map(option => option.background)).size === 4 && intro.choices.every(within));
    for (const id of ['supply', 'cooking', 'repair', 'navigation']) {
      await page.locator(`.room-minigame-job[data-job="${id}"]`).click();
      const selected = await page.evaluate(() => ({
        count: document.querySelectorAll('.room-minigame-job[aria-pressed=true]').length,
        id: document.querySelector('.room-minigame-job[aria-pressed=true]')?.dataset.job,
        choice: getComputedStyle(document.querySelector(`.room-minigame-job[data-job="${document.querySelector('.room-minigame-job[aria-pressed=true]')?.dataset.job}"]`)).backgroundImage,
        hero: getComputedStyle(document.querySelector('.room-minigame-intro-hero')).backgroundImage
      }));
      const asset = selected.choice.match(/minigames_v1\/[^"')]+/);
      pass(`${id} selection updates hero artwork`, selected.count === 1 && selected.id === id && !!asset && selected.hero.includes(asset[0]));
    }
    await page.locator('.room-minigame-job[data-job="supply"]').click();
  }
  await page.locator('.room-minigame-rules summary').click();
  pass(`${isWork ? 'work' : 'training'} rules expand`, await page.locator('.room-minigame-rules').evaluate(node => node.open && node.querySelectorAll('li').length >= 3));
  await page.locator('.room-minigame-rules summary').click();
  pass(`${isWork ? 'work' : 'training'} rules collapse`, await page.locator('.room-minigame-rules').evaluate(node => !node.open));
  const start = await page.locator('.room-minigame-intro [data-action=start]').boundingBox();
  pass(`${isWork ? 'work' : 'training'} start remains visible after rules toggle`, !!start && start.y >= 0 && start.y + start.height <= 900);
  await screenshot(page, `${isWork ? 'work' : 'training'}-intro-desktop`);
}
async function checkNarrowLayout(page, job) {
  await page.setViewportSize({ width: 390, height: 844 });
  const layout = await page.evaluate(selector => {
    const card = document.querySelector('.room-minigame-card').getBoundingClientRect();
    const stage = document.querySelector('.room-minigame-stage').getBoundingClientRect();
    const controls = [...document.querySelectorAll(selector)].map(node => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width, height: box.height };
    });
    return { card: { left: card.left, right: card.right }, stage: { left: stage.left, right: stage.right }, controls,
      documentWidth: document.documentElement.scrollWidth };
  }, CONTROL_SELECTORS[job.id]);
  pass(`${job.id} narrow card and document fit width`, layout.card.left >= 0 && layout.card.right <= 390 && layout.documentWidth <= 390);
  pass(`${job.id} narrow controls fit stage width`, layout.controls.length >= 3 && layout.controls.every(box =>
    box.left >= layout.stage.left - 1 && box.right <= layout.stage.right + 1 && box.width >= 32 && box.height >= 32));
  const controls = page.locator(CONTROL_SELECTORS[job.id]);
  for (const index of [0, await controls.count() - 1]) {
    await controls.nth(index).scrollIntoViewIfNeeded();
    const box = await controls.nth(index).boundingBox();
    pass(`${job.id} narrow control ${index} scrolls into view`, !!box && box.x >= 0 && box.x + box.width <= 390 && box.y >= 0 && box.y + box.height <= 844);
  }
  await screenshot(page, `${job.id}-active-narrow`);
  await page.setViewportSize({ width: 1440, height: 900 });
}
async function answerRound(page, job, challenge) {
  if (job.id === 'supply') {
    for (const [index, crate] of challenge.crates.entries()) if (crate.category === challenge.order.category) await page.locator(`.room-minigame-cargo[data-index="${index}"]`).click();
    pass('supply selected required cargo only', JSON.stringify(await page.evaluate(() => __game.inspect().selected.sort())) === JSON.stringify(challenge.crates.filter(crate => crate.category === challenge.order.category).map(crate => crate.id).sort()));
  } else if (job.id === 'cooking') {
    for (const id of challenge.recipe) await page.locator(`.room-minigame-ingredient[data-ingredient="${id}"]`).click();
    pass('cooking recipe input matches order', JSON.stringify(await page.evaluate(() => __game.inspect().ingredients)) === JSON.stringify(challenge.recipe));
  } else if (job.id === 'repair') {
    const solution = repairSolution(challenge);
    for (let index = 0; index < solution.length; index++) {
      const count = (solution[index] - challenge.tiles[index].rotation + 4) % 4;
      for (let click = 0; click < count; click++) await page.locator(`.room-minigame-pipe[data-pipe="${index}"]`).click();
    }
    pass('repair visible tile rotations match solved route', JSON.stringify(await page.evaluate(() => __game.inspect().rotations)) === JSON.stringify(solution));
  } else if (job.id === 'navigation') {
    const route = navigationSolution(challenge);
    for (const cell of route.slice(1)) await page.locator(`.room-minigame-sea-cell[data-cell="${cell}"]`).click();
    pass('navigation drawn route reaches port', JSON.stringify(await page.evaluate(() => __game.inspect().course)) === JSON.stringify(route));
  } else {
    const keys = { left: 'ArrowLeft', up: 'ArrowUp', right: 'ArrowRight' };
    for (const direction of challenge.directions.slice(0, -1)) await page.keyboard.press(keys[direction]);
    pass('training remembered path entered in order', JSON.stringify(await page.evaluate(() => __game.inspect().entered)) === JSON.stringify(challenge.directions.slice(0, -1)));
    await page.keyboard.press(keys[challenge.directions.at(-1)]);
  }
  if (job.id !== 'training') await page.keyboard.press('Enter');
  await page.waitForFunction(() => __game.inspect().roundIndex === 1, null, { timeout: 18000 });
  pass(`${job.id} first round accepted as correct`, await page.evaluate(() => __qa.last?.minigame?.correctRounds === 1));
}
async function main() {
  fs.mkdirSync(out, { recursive: true });
  await setupProfiles();
  server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\//, '') || 'launcher.html';
    const target = path.resolve(root, 'desktop', rel);
    if (!target.startsWith(path.join(root, 'desktop') + path.sep) || !fs.existsSync(target)) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(target);
    res.setHeader('Content-Type', ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html');
    res.end(fs.readFileSync(target));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(fixture);
  await context.route('opui://**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const file = path.resolve(root, 'public', rel);
    if (rel.startsWith('images/launcher_room/minigames_')) art.push({ rel, exists: fs.existsSync(file) });
    return file.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404, body: 'missing' });
  });
  await context.exposeFunction('__command', async (secret, type, payload) => {
    const state = await life.getLauncherLife(pool, secret, new Date(), { crewContentRevision: 1 });
    const response = await life.commandLauncherLife(pool, secret,
      { type, payload, requestId: `large-visual-${String(++serial).padStart(8, '0')}`, expectedRevision: state.life.revision },
      new Date(), { crewContentRevision: 1 });
    calls.push({ secret, type, ok: response.ok, error: response.error, roundIndex: response.minigame?.roundIndex, correctRounds: response.minigame?.correctRounds });
    return response;
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.OnePieceRoomMinigames);
  await page.evaluate(() => {
    window.__qa = { secret: '', last: null };
    window.__game = OnePieceRoomMinigames.create({ command: async (type, payload) => {
      const response = await __command(__qa.secret, type, payload);
      __qa.last = response;
      return response;
    } });
  });
  for (const job of jobs) {
    await page.evaluate(({ id, character }) => {
      __qa.secret = `large-${id}`;
      if (!__game.open({ kind: id === 'training' ? 'training' : 'work', characterId: `room-character-${character}`, jobId: id })) throw new Error(`${id} did not open`);
    }, job);
    pass(`${job.id} entry is visible`, await page.locator('.room-minigame-intro').isVisible());
    const intro = await page.locator('.room-minigame-intro').innerText();
    pass(`${job.id} intro has concise instructions`, intro.length <= 500);
    if (!flowOnly && (job.id === 'supply' || job.id === 'training')) await checkIntro(page, job);
    await page.locator('.room-minigame-intro button').filter({ hasText: /開始|挑戰/ }).last().click();
    await page.waitForFunction(() => __game.inspect().phase === 'answer', null, { timeout: 12000 });
    const challenge = await page.evaluate(() => __qa.last.minigame.challenge);
    const bounds = await page.evaluate(() => {
      const card = document.querySelector('.room-minigame-card').getBoundingClientRect();
      const stage = document.querySelector('.room-minigame-stage').getBoundingClientRect();
      const crew = document.querySelector('.room-minigame-crew').getBoundingClientRect();
      const order = document.querySelector('.room-minigame-order strong')?.textContent || '';
      const background = getComputedStyle(document.querySelector('.room-minigame-stage')).backgroundImage;
      const images = [...document.querySelectorAll('.room-minigame-stage img')].map(image => ({ src: image.src, width: image.naturalWidth, height: image.naturalHeight }));
      const controlSelector = {
        supply: '.room-minigame-cargo', cooking: '.room-minigame-ingredient', repair: '.room-minigame-pipe',
        navigation: '.room-minigame-sea-cell', training: '.room-minigame-direction'
      }[document.querySelector('.room-minigame-overlay').dataset.job];
      const controls = [...document.querySelectorAll(controlSelector)].map(node => {
        const rect = node.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
      });
      return { card: { x: card.x, right: card.right, width: card.width }, stage: { x: stage.x, right: stage.right, width: stage.width, height: stage.height },
        crew: { top: crew.top, bottom: crew.bottom }, order, background, images, controls };
    });
    if (!flowOnly) {
      pass(`${job.id} desktop card is large and on-screen`, bounds.card.width >= 1000 && bounds.card.x >= 0 && bounds.card.right <= 1440);
      pass(`${job.id} desktop play area is large`, bounds.stage.width >= 940 && bounds.stage.height >= 450);
      pass(`${job.id} primary controls fit viewport`, bounds.controls.length >= 3 && bounds.controls.every(box => box.top >= 0 && box.bottom <= 900 && box.width >= 32 && box.height >= 32));
      pass(`${job.id} companion footer fits viewport`, bounds.crew.top >= 0 && bounds.crew.bottom <= 900);
      if (job.id === 'navigation') pass('navigation order heading describes the route', /航線|港口|出航/.test(bounds.order) && !/魚/.test(bounds.order));
    }
    pass(`${job.id} stage uses scene artwork`, bounds.background.includes('minigames_'));
    if (!flowOnly) pass(`${job.id} active images decode`, bounds.images.every(image => image.width > 0 && image.height > 0));
    await screenshot(page, `${job.id}-active-desktop`);
    if (!flowOnly) await checkNarrowLayout(page, job);
    await answerRound(page, job, challenge);
    await page.locator('.room-minigame-close').click();
    const confirm = page.getByRole('button', { name: '結束並回房間' });
    if (await confirm.count()) await confirm.click();
    await page.waitForFunction(() => !__game.active());
  }
  if (!flowOnly) pass('all minigame scene artwork requests exist', art.length >= 4 && art.every(entry => entry.exists));
  pass('no page JavaScript errors', errors.length === 0);
  const report = { schema: 'launcher-minigames-large-visual-qa/1', status: flowOnly ? 'FLOW_ONLY' : 'PASS', createdAt: new Date().toISOString(), checks, screenshots, art, calls, errors,
    limitations: ['Automated Chromium and isolated PGlite, not human playtest or public-service acceptance.', 'Exercises one correct round per mode; existing server QA covers rewards and full sessions.'] };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: checks.length, screenshots: screenshots.length, report: path.join(out, 'report.json') }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; })
  .finally(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); await db.close(); });
