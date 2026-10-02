'use strict';
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const out = process.env.LAUNCHER_FISH_UA_QA_OUT || path.join(root, 'tmp', 'launcher-fishing-ua-qa');
fs.mkdirSync(out, {recursive: true});
process.env.TEMP = out;
process.env.TMP = out;
const runtimeBase = path.join(process.env.LOCALAPPDATA || '', 'OpenAI/Codex/runtimes/cua_node');
const playwrightPath = fs.existsSync(runtimeBase) ? fs.readdirSync(runtimeBase)
  .map(name => path.join(runtimeBase, name, 'bin/node_modules/playwright')).find(fs.existsSync) : null;
const {chromium} = require(process.env.BOARD_QA_PLAYWRIGHT || playwrightPath || 'playwright');
const CHROME = process.env.BOARD_QA_CHROMIUM || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const species = [
  'adventure-fish', 'panda-shark', 'elephant-tuna',
  'lovely-angel', 'striped-clam', 'cutie-piranha', 'claw-shrimp', 'pumpkin-octopus',
  'maple-salmon', 'lava-flounder', 'treasure-pearl-clam', 'electric-catfish',
  'demon-bonito', 'guiding-anglerfish', 'ice-fish', 'beat-alligator',
  'aurora-sunfish', 'burning-dragon', 'great-terigius', 'golden-whale'
];
const fishArtFile = id => id === 'golden-whale' ? 'golden-whale-v2.webp' : id + '.webp';
const spots = ['shore', 'reef', 'deep', 'freshwater', 'magma', 'rainbow'];
const catalogue = Object.fromEntries(require(path.join(root, 'server/launcher-minigames')).FISH_SPECIES
  .map(fish => [fish.id, fish.label]));
const mockArt = process.argv.includes('--mock-art');
const checks = [], errors = [], missing = [], mocked = [];
let browser, server;
function check(label, actual, expected) {
  assert.deepEqual(actual, expected, label);
  checks.push(label);
}
async function main() {
  const html = '<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/desktop/launcher-room-minigames.css"><link rel="stylesheet" href="/desktop/launcher-room-aquarium.css"><body><div id="aquarium-stage" style="position:relative;width:350px;height:180px"><div class="room-aquarium-scene-window" style="inset:0"></div></div><script src="/desktop/launcher-room-minigames.js"></script><script src="/desktop/launcher-room-aquarium.js"></script></body></html>';
  server = http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return; }
    const rel = pathname.replace(/^\//, '');
    const file = path.join(root, rel);
    if (!['desktop/launcher-room-minigames.js', 'desktop/launcher-room-minigames.css',
      'desktop/launcher-room-aquarium.js', 'desktop/launcher-room-aquarium.css'].includes(rel)) {
      res.writeHead(404); res.end(); return;
    }
    res.setHeader('Content-Type', path.extname(file) === '.js' ? 'text/javascript' : 'text/css');
    res.end(fs.readFileSync(file));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({headless: true, executablePath: CHROME,
    args: ['--disable-gpu-shader-disk-cache']});
  const context = await browser.newContext({viewport: {width: 390, height: 844}});
  await context.route('opui://**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const file = path.join(root, 'public', rel);
    if (rel.includes('..') || !fs.existsSync(file)) {
      if (mockArt && /^images\/launcher_room\/fish_ua\/[a-z-]+\.webp$/.test(rel)) {
        mocked.push(rel);
        const label = path.basename(rel, '.webp');
        const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="128"><rect width="256" height="128" fill="#0b4051"/><text x="128" y="70" fill="#ffe3a1" font-size="13" text-anchor="middle">QA MOCK: ' + label + '</text></svg>';
        return route.fulfill({status: 200, contentType: 'image/svg+xml', body: svg});
      }
      if (rel.includes('/fish_ua/') || rel.includes('/fishing_v4/')) missing.push(rel);
      return route.fulfill({status: 404, body: 'missing'});
    }
    return route.fulfill({path: file});
  });
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:' + server.address().port + '/', {waitUntil: 'load'});
  await page.evaluate(({species}) => {
    window.__fish = species.map((speciesId, i) => ({id: 'ua-' + i, speciesId, inAquarium: false}));
    window.__catchSpecies = species[0];
    window.__rodCalls = 0;
    window.__rodRefreshes = 0;
    window.__minigame = OnePieceRoomMinigames.create({
      fishCollection: () => window.__fish,
      refreshLife: async () => { window.__rodRefreshes++; },
      command: async (type, payload) => {
        if (type.startsWith('minigame.')) await new Promise(resolve => setTimeout(resolve, 80));
        if (type === 'rod.upgrade') {window.__rodCalls++;return {ok:false,error:'offline'};}
        if (type === 'fish.place') {
          const item = window.__fish.find(entry => entry.id === payload.fishId);
          if (!item) return {ok: false, error: 'fish_not_found'};
          item.inAquarium = payload.inAquarium;
          return {ok: true};
        }
        if (type === 'minigame.start') {
          window.__lastBait = payload.baitId;
          window.__lastSpot = payload.spotId;
          return {ok: true, serverNow: new Date().toISOString(),
            minigame: {id: 'qa-' + Date.now(), token: 'qa', state: 'playing', kind: 'fishing',
              characterId: 'room-character-luffy', baitId: payload.baitId, spotId: payload.spotId,
              fishingVersion: 4, roundIndex: 0, totalRounds: 1,
              challenge: {id: 'qa-round', fishingVersion: 4, stage: 'cast', motionSeed: 8}}};
        }
        if (type === 'minigame.answer') {
          const cast = payload.counterMoves?.[0] === 'cast';
          return {ok: true, serverNow: new Date().toISOString(),
            minigame: {id: payload.sessionId, token: 'qa', state: cast ? 'completed' : 'playing', kind: 'fishing',
              characterId: 'room-character-luffy', baitId: window.__lastBait, spotId: window.__lastSpot,
              fishingVersion: 4, roundIndex: 0, totalRounds: 1,
              ...(cast ? {result: {catch: {id: 'ua-0', speciesId: window.__catchSpecies}}} :
                {challenge: {id: 'qa-round', fishingVersion: 4, stage: 'cast', motionSeed: 8}})}};
        }
        return {ok: true};
      }
    });
    window.__minigame.open({kind: 'fishing', characterId: 'room-character-luffy'});
  }, {species});
  check('six fishing spots', await page.locator('[data-spot]').count(), 6);
  await page.evaluate(() => __minigame.receive({rod:{level:0,nextCost:20}}));
  await page.locator('.room-fishing-v4-workshop summary').click();
  await page.locator('.room-fishing-v4-workshop-upgrade').click();
  check('lost upgrade reply refreshes life', await page.evaluate(() => __rodRefreshes), 1);
  check('lost upgrade reply blocks another debit', await page.locator('.room-fishing-v4-workshop-upgrade').isDisabled(), true);
  await page.locator('.room-fishing-v4-workshop-upgrade').evaluate(button => button.click());
  check('blocked retry sends no new upgrade', await page.evaluate(() => __rodCalls), 1);
  await page.evaluate(() => __minigame.receive({rod:{level:1,nextCost:35}}));
  check('fresh rod level shown after reply loss', (await page.locator('.room-fishing-v4-workshop-level').textContent()).trim(), 'Lv 1 / 3');
  check('upgrade allowed after fresh state', await page.locator('.room-fishing-v4-workshop-upgrade').isEnabled(), true);
  await page.locator('.room-fishing-v4-workshop summary').click();
  for (const spot of spots) {
    await page.locator('[data-spot="' + spot + '"]').click();
    check(spot + ' selected', await page.locator('[data-spot="' + spot + '"]').getAttribute('aria-pressed'), 'true');
    const image = await page.locator('.room-fishing-v4-intro-scene').evaluate(node => node.style.backgroundImage);
    check(spot + ' scene art route', image.includes('/sea-' + spot + '.webp'), true);
  }
  const start = await page.getByRole('button', {name: '開始釣魚'}).boundingBox();
  check('390px start button within first screen', start.y + start.height <= 844, true);
  check('no horizontal scroll at 390px', await page.evaluate(() => document.documentElement.scrollWidth <= 390), true);
  const backgroundLoads = await page.evaluate(async ids => Promise.all(ids.map(async id => {
    const version = ['freshwater', 'magma', 'rainbow'].includes(id) ? 'fishing_v4' : 'fishing_v3';
    const image = new Image();
    image.src = 'opui://launcher/images/launcher_room/' + version + '/sea-' + id + '.webp';
    await image.decode();
    return {id, width: image.naturalWidth, height: image.naturalHeight};
  })), spots);
  for (const image of backgroundLoads) check(image.id + ' background decoded', image.width > 0 && image.height > 0, true);
  await page.setViewportSize({width: 1280, height: 850});
  const desktopStart = await page.getByRole('button', {name: '開始釣魚'}).boundingBox();
  check('1280px start button within first screen', desktopStart.y + desktopStart.height <= 850, true);
  check('no horizontal scroll at 1280px', await page.evaluate(() => document.documentElement.scrollWidth <= 1280), true);
  await page.screenshot({path: path.join(out, 'ua-spots-1280.png')});
  await page.setViewportSize({width: 390, height: 844});
  await page.locator('[data-spot="freshwater"]').click();
  await page.screenshot({path: path.join(out, 'ua-spots-390.png')});
  await page.locator('.room-fishing-v4-collection').evaluate(node => { node.open = true; });
  const fishCards = page.locator('.room-fishing-collection-item');
  check('all new species in collection', await fishCards.count(), species.length);
  for (const [index, id] of species.entries()) {
    check(id + ' in server catalogue', !!catalogue[id], true);
    const card = fishCards.filter({has: page.locator('[data-fish-id="ua-' + index + '"]')});
    check(id + ' collection name', (await card.locator('strong').textContent()).trim(), catalogue[id]);
    const art = card.locator('img');
    check(id + ' art path', (await art.getAttribute('src')).endsWith('/fish_ua/' + fishArtFile(id)), true);
    await art.evaluate(img => img.decode());
    check(id + ' art decoded', await art.evaluate(img => img.naturalWidth > 0 && img.naturalHeight > 0), true);
  }
  for (const [index, id] of species.entries()) {
    const action = page.locator('[data-fish-id="ua-' + index + '"]');
    await action.click();
    check(id + ' placed', await page.evaluate(i => __fish[i].inAquarium, index), true);
    await page.locator('.room-fishing-v4-collection').evaluate(node => { node.open = true; });
    await page.locator('[data-fish-id="ua-' + index + '"]').click();
    check(id + ' retrieved', await page.evaluate(i => __fish[i].inAquarium, index), false);
    await page.locator('.room-fishing-v4-collection').evaluate(node => { node.open = true; });
  }
  for (const [index, id] of species.entries()) {
    await page.evaluate(id => { window.__catchSpecies = id; }, id);
    await page.getByRole('button', {name: '開始釣魚'}).click();
    await page.locator('.room-fishing-v4-cast').waitFor({timeout: 5000});
    await page.locator('.room-fishing-v4-cast').waitFor({state: 'visible', timeout: 5000});
    if (index === 0) {
      const shadow = page.locator('.room-fishing-v4-fish');
      check('underwater shadow is species neutral', await shadow.evaluate(node => node.tagName), 'DIV');
      check('underwater shadow uses diffuse shape', await shadow.evaluate(node =>
        getComputedStyle(node).backgroundImage.includes('radial-gradient')), true);
      if (!mockArt) {
        await page.locator('.room-fishing-v4-sea').evaluate(sea => {
          sea.dataset.stage = 'fight';
          sea.style.setProperty('--fish-x', '56%');
          sea.style.setProperty('--fish-y', '50%');
        });
        await page.screenshot({path: path.join(out, 'neutral-shadow-390.png')});
        await page.locator('.room-fishing-v4-sea').evaluate(sea => {sea.dataset.stage = 'cast';});
      }
    }
    await page.locator('.room-fishing-v4-cast').click();
    const result = page.locator('.room-fishing-v3-result');
    await result.waitFor();
    const art = result.locator('img');
    check(id + ' catch art path', (await art.getAttribute('src')).endsWith('/fish_ua/' + fishArtFile(id)), true);
    await art.evaluate(img => img.decode());
    check(id + ' catch art decoded', await art.evaluate(img => img.naturalWidth > 0), true);
    check(id + ' catch named', (await result.locator('.room-fishing-v3-catch-name').textContent()).trim(), catalogue[id]);
    if (index === 0 && !mockArt) {
      await art.evaluate(img => Promise.all(img.getAnimations().map(animation => animation.finished)));
      await page.screenshot({path: path.join(out, 'ua-catch-390.png')});
    }
    await page.evaluate(() => { __minigame.dismiss(); __minigame.open({kind: 'fishing', characterId: 'room-character-luffy'}); });
  }
  for (const [index, id] of species.entries()) {
    const details = await page.evaluate(entry => {
      const stage = document.querySelector('#aquarium-stage');
      OnePieceRoomAquarium.render({stage, room: {sceneId: 'room-scene-sunny-aquarium'},
        fishCollection: [{id: 'aquarium-qa', speciesId: entry, inAquarium: true}]});
      const sprite = stage.querySelector('.room-aquarium-fish img');
      return {src: sprite?.src, name: OnePieceRoomAquarium.species[entry]};
    }, id);
    check(id + ' aquarium species', details.name, catalogue[id]);
    check(id + ' aquarium art path', details.src.endsWith('/fish_ua/' + fishArtFile(id)), true);
    const art = page.locator('#aquarium-stage .room-aquarium-fish img');
    await art.evaluate(img => img.decode());
    check(id + ' aquarium art decoded', await art.evaluate(img => img.naturalWidth > 0), true);
    if (index === 0 && !mockArt) await page.screenshot({path: path.join(out, 'ua-aquarium-390.png')});
  }
  check('new art and spot files available', missing.length, 0);
  check('no JavaScript errors', errors.length, 0);
  const report = {schema: 'launcher-fishing-ua-ui-qa/1', status: mockArt ? 'PASS_MOCK_ART' : 'PASS', checks: checks.length,
    species: species.length, spots: spots.length, missing, mocked, errors,
    limitations: ['Chromium UI with simulated successful catches and place commands; server rules and physical device play are verified separately.',
      ...(mockArt ? ['QA generated placeholder SVGs were served for missing fish sprites; this does not verify final public fish art.'] : [])]};
  fs.writeFileSync(path.join(out, 'LAUNCHER_FISHING_UA_UI_QA.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({status: report.status, checks: report.checks, report: path.join(out, 'LAUNCHER_FISHING_UA_UI_QA.json')}));
}
main().catch(error => {
  const report = {schema: 'launcher-fishing-ua-ui-qa/1', status: 'FAIL', checks: checks.length,
    error: error.stack || String(error), missing, errors};
  fs.writeFileSync(path.join(out, 'LAUNCHER_FISHING_UA_UI_QA.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(error.stack || error); process.exitCode = 1;
}).finally(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});
