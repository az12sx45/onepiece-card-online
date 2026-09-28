'use strict';
// Real room renderer with an isolated Electron bridge; no live account writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const runtimeRoot = 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const bundled = fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot)
  .map(name => path.join(runtimeRoot, name, 'bin/node_modules/playwright'))
  .find(file => fs.existsSync(path.join(file, 'package.json'))) : null;
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || bundled || 'playwright');
const { CATALOG } = require('../server/launcher-profile-shop');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, 'desktop', name), 'utf8');
const names = ['room-scene-sunny-deck', 'room-scene-sunny-kitchen',
  'room-furniture-helm', 'room-furniture-treasure-chest', 'room-character-luffy', 'room-character-zoro'];
const items = names.map(id => CATALOG.find(item => item.id === id));
assert(items.every(Boolean), 'Missing scene QA product');
const id = names;
let browser;
async function main() {
  const chrome = process.env.LAUNCHER_PROFILE_QA_CHROME ||
    (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  browser = await chromium.launch({ headless: true, executablePath: chrome });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZnwAAAABJRU5ErkJggg==', 'base64');
  await page.route('opui://**', route => {
    const requested = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const file = path.resolve(root, 'public', requested);
    return file.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(file)
      ? route.fulfill({ path: file }) : route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
  });
  const html = read('launcher.html')
    .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '')
    .replace(/<link[^>]+rel="stylesheet"[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('<body data-stage="boot">', '<body data-stage="app">')
    .replace('<main class="launcher-app screen" id="launcherApp" hidden>',
      '<main class="launcher-app screen is-active" id="launcherApp">');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: ['launcher.css', 'launcher-profile-shop.css', 'launcher-room.css'].map(read).join('\n') });
  await page.evaluate(({ items, catalog, id }) => {
    const blank = () => ({ placements: [], characters: [] });
    const placedFurniture = { itemId: id[2], x: 300, y: 400, scale: 1, rotation: 0, flip: false };
    const placedCharacter = { itemId: id[4], x: 400, y: 430 };
    const defaultRoom = { placements: [placedFurniture], characters: [placedCharacter] };
    const owner = {
      userId: 42, name: '測試船長', isSelf: true,
      room: { revision: 2, capacityVersion: 2, sceneId: 'room-scene-default',
        scenes: { 'room-scene-default': defaultRoom, [id[0]]: blank(), [id[1]]: blank() },
        ...defaultRoom },
      roomItems: { scene: null, placements: [{ ...placedFurniture, item: items[2] }],
        characters: [{ ...placedCharacter, item: items[4] }] },
      collection: { launcher: { items } }, companions: []
    };
    const shop = { catalog, owned: { roomScenes: id.slice(0, 2), roomFurniture: id.slice(2, 4),
      roomCharacters: id.slice(4, 6) }, wallet: { coins: 100 } };
    window.__roomQa = { owner, shop, saves: [], copy: value => structuredClone(value) };
    window.onePieceDesktop = {
      async getLauncherShop() { return { ok: true, shop: structuredClone(shop) }; },
      async saveLauncherRoom(payload) {
        const copy = structuredClone(payload);
        window.__roomQa.saves.push(copy);
        owner.room = { ...copy, revision: copy.revision + 1 };
        const item = itemId => catalog.find(product => product.id === itemId);
        owner.roomItems = { scene: item(copy.sceneId) || null,
          placements: copy.placements.map(entry => ({ ...entry, item: item(entry.itemId) })),
          characters: copy.characters.map(entry => ({ ...entry, item: item(entry.itemId) })) };
        return { ok: true, profile: structuredClone(owner), shop: structuredClone(shop) };
      }
    };
    document.getElementById('bootScreen').hidden = true;
    document.getElementById('profilePanel').hidden = false;
    window.__LAUNCHER_ROOM_QA__ = true;
  }, { items, catalog: CATALOG, id });
  await page.addScriptTag({ content: read('launcher-room.js') });
  await page.evaluate(() => LauncherRoom.setProfile(__roomQa.copy(__roomQa.owner), { accountId: 42 }));
  assert.equal(await page.locator('#roomCharacters .room-character-shell').count(), 1);
  await page.locator('#roomEditToggle').click();
  await page.locator(`[data-scene-id="${id[0]}"]`).click();
  assert.equal(await page.locator('#roomCharacters .room-character-shell').count(), 0, 'new deck begins empty');
  await page.getByRole('tab', { name: '夥伴' }).click();
  await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '魯夫' }).click();
  await page.getByRole('tab', { name: '家具' }).click();
  await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '千陽號舵輪' }).click();
  await page.locator(`[data-scene-id="${id[1]}"]`).click();
  assert.equal(await page.locator('#roomCharacters .room-character-shell').count(), 0, 'kitchen has its own occupants');
  await page.getByRole('tab', { name: '夥伴' }).click();
  await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '索隆' }).click();
  await page.getByRole('tab', { name: '家具' }).click();
  await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '草帽一行人的寶箱' }).click();
  await page.locator('#roomSave').click();
  const saved = await page.evaluate(() => __roomQa.saves[0]);
  assert.equal(saved.sceneId, id[1]);
  assert.deepEqual(saved.scenes['room-scene-default'], { placements: [], characters: [] });
  assert.deepEqual(saved.scenes[id[0]].characters.map(entry => entry.itemId), [id[4]]);
  assert.deepEqual(saved.scenes[id[0]].placements.map(entry => entry.itemId), [id[2]]);
  assert.deepEqual(saved.scenes[id[1]].characters.map(entry => entry.itemId), [id[5]]);
  assert.deepEqual(saved.scenes[id[1]].placements.map(entry => entry.itemId), [id[3]]);
  assert.equal(await page.locator(`[data-scene-id="${id[0]}"]`).isEnabled(), true,
    'scene buttons unlock after a room save');
  await page.locator('#roomCancel').click();
  await page.locator(`[data-scene-id="${id[0]}"]`).click();
  await page.waitForFunction(() => __roomQa.saves.length === 2);
  assert.equal(await page.locator('#roomCharacters .room-character-shell').count(), 1);
  assert.match(await page.locator('#roomCaption').innerText(), /千陽號甲板/);
  await page.evaluate(() => {
    const profile = structuredClone(__roomQa.owner);
    profile.isSelf = false;
    delete profile.room.scenes;
    LauncherRoom.setProfile(profile, { accountId: 42 });
  });
  assert.equal(await page.locator('#roomEditToggle').isHidden(), true);
  assert.equal(await page.locator('#roomSceneSwitcher button:visible').count(), 0);
  assert.match(await page.locator('#roomSceneSwitcher').innerText(), /千陽號甲板/);
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({ status: 'PASS', checks: 8, saves: saved.scenes ? 2 : 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => browser?.close());
