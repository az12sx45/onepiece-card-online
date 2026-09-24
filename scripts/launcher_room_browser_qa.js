'use strict';

// Renderer integration check. The real HTML/CSS/JS runs with a deterministic
// Electron bridge stub, so no account, DB, or public server is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT ||
  'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/7f75cff94511d5f8/bin/node_modules/playwright');
const { CATALOG } = require('../server/launcher-profile-shop');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.LAUNCHER_ROOM_QA_OUT || 'D:/Codex_QA/launcher-room-browser');
const read = file => fs.readFileSync(path.join(root, 'desktop', file), 'utf8');
const roomIds = ['room-scene-sunny-deck', 'room-furniture-helm', 'room-character-luffy'];
const products = roomIds.map(id => CATALOG.find(item => item.id === id));
assert(products.every(Boolean), 'Room catalog fixture is incomplete.');
fs.mkdirSync(output, { recursive: true });

async function main() {
  const chrome = process.env.LAUNCHER_PROFILE_QA_CHROME ||
    (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const results = [];
  const errors = [];
  const check = (name, value) => { results.push({ name, pass: !!value }); assert.ok(value, name); };
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZnwAAAABJRU5ErkJggg==', 'base64');
    await page.route('opui://**', route => {
      const file = path.resolve(root, 'public', decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, ''));
      if (file.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(file)) return route.fulfill({ path: file });
      return route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
    });
    const html = read('launcher.html')
      .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '')
      .replace(/<link[^>]+rel="stylesheet"[^>]*>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace('<body data-stage="boot">', '<body data-stage="app">')
      .replace('<main class="launcher-app screen" id="launcherApp" hidden>', '<main class="launcher-app screen is-active" id="launcherApp">');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.addStyleTag({ content: ['launcher.css', 'launcher-social.css', 'launcher-profile-shop.css', 'launcher-room.css'].map(read).join('\n') });
    await page.evaluate(({ items, catalog }) => {
      const copy = value => structuredClone(value);
      const emptyRoom = () => ({ revision: 0, sceneId: 'room-scene-default', placements: [], characters: [] });
      const mine = {
        userId: 42, name: '測試船長', avatar: 8, isSelf: true, room: emptyRoom(),
        roomItems: { scene: null, placements: [], characters: [] },
        appearance: {}, appearanceItems: {}, collection: { card: { avatars: [8], walls: [], flags: [] }, board: {}, chess: {}, launcher: {} }, games: {}
      };
      const friend = {
        ...copy(mine), userId: 44, name: '好友航海士', isSelf: false,
        room: { revision: 1, sceneId: items[0].id,
          placements: [{ itemId: items[1].id, x: 390, y: 405, scale: 1, flip: false }],
          characters: [{ itemId: items[2].id, x: 530, y: 0 }] },
        roomItems: { scene: items[0],
          placements: [{ itemId: items[1].id, x: 390, y: 405, scale: 1, flip: false, item: items[1] }],
          characters: [{ itemId: items[2].id, x: 530, y: 0, item: items[2] }] }
      };
      const shop = {
        catalog, wallet: { coins: 500, dailyGrant: 20, cap: 500 },
        owned: { avatars: [], walls: [], flags: [], layouts: [], backgrounds: [], frames: [], decorations: [], bgms: [],
          roomScenes: [items[0].id], roomFurniture: [items[1].id], roomCharacters: [items[2].id], guestbook: false },
        equipped: { avatar: 8, wall: 1, flag: 1, decorations: {} }
      };
      window.__roomQa = { mine, friend, shop, calls: [], saved: null };
      window.onePieceDesktop = {
        async getLauncherProfile(userId = 0) { return { ok: true, profile: copy(userId === 44 ? friend : mine) }; },
        async getLauncherShop() { return { ok: true, shop: copy(shop) }; },
        async getLauncherComments() { return { ok: true, comments: [], hasMore: false }; },
        async saveLauncherRoom(room) {
          window.__roomQa.calls.push('save'); window.__roomQa.saved = copy(room);
          mine.room = { ...copy(room), revision: room.revision + 1 };
          const byId = id => items.find(item => item.id === id);
          mine.roomItems = {
            scene: byId(mine.room.sceneId) || null,
            placements: mine.room.placements.map(entry => ({ ...entry, item: byId(entry.itemId) })),
            characters: mine.room.characters.map(entry => ({ ...entry, item: byId(entry.itemId) }))
          };
          return { ok: true, profile: copy(mine), shop: copy(shop) };
        }
      };
      window.launcherSwitchPanel = name => {
        for (const id of ['profile', 'shop', 'social']) document.getElementById(`${id}Panel`).hidden = id !== name;
        window.LauncherProfileShop?.onVisible(name);
      };
      document.getElementById('bootScreen').hidden = true;
    }, { items: products, catalog: CATALOG });
    await page.addScriptTag({ content: read('launcher-room.js') });
    await page.addScriptTag({ content: read('launcher-profile-shop.js') });
    await page.evaluate(() => window.LauncherProfileShop.setAccount({ authenticated: true, profile: { userId: 42 } }));
    await page.evaluate(() => window.LauncherProfileShop.openProfile(0));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    check('owner edit button visible', await page.locator('#roomEditToggle').isVisible());
    await page.locator('#roomEditToggle').click();
    await page.waitForSelector('#roomEditor:not([hidden])');
    check('free room scene shown', await page.locator('#roomEditorItems .room-palette-item').count() === 2);
    await page.locator('#roomEditorItems .room-palette-item').nth(1).click();
    await page.getByRole('tab', { name: '家具' }).click();
    await page.locator('#roomEditorItems .room-palette-item').first().click();
    await page.getByRole('tab', { name: '夥伴' }).click();
    await page.locator('#roomEditorItems .room-palette-item').first().click();
    check('furniture and chibi both placed', await page.locator('#roomObjects img').count() === 1 && await page.locator('#roomCharacters img').count() === 1);
    const furniture = page.locator('#roomObjects img').first();
    const before = await furniture.evaluate(node => node.style.left);
    const box = await furniture.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 20, { steps: 4 }); await page.mouse.up();
    check('pointer drag moved furniture', await furniture.evaluate(node => node.style.left) !== before);
    await page.locator('#roomStage').press('ArrowRight');
    await page.locator('#roomSave').click();
    check('server payload contains editable room', await page.evaluate(() => {
      const saved = window.__roomQa.saved;
      return saved?.revision === 0 && saved?.sceneId === 'room-scene-sunny-deck' &&
        saved?.placements?.[0]?.itemId === 'room-furniture-helm' && saved?.placements?.[0]?.x > 340 &&
        saved?.characters?.[0]?.itemId === 'room-character-luffy';
    }));
    await page.evaluate(() => { Math.random = () => .9; });
    await page.locator('#roomCancel').click();
    const chibiStart = await page.locator('#roomCharacters img').first().evaluate(node => node.style.left);
    await page.waitForTimeout(2200);
    const chibiMoved = await page.locator('#roomCharacters img').first().evaluate(node => node.style.left);
    check('canonical chibi walks when room is visible', chibiMoved !== chibiStart);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenStart = await page.locator('#roomCharacters img').first().evaluate(node => node.style.left);
    await page.waitForTimeout(350);
    check('chibi pauses when document is hidden', await page.locator('#roomCharacters img').first().evaluate(node => node.style.left) === hiddenStart);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'owner-room-section-1280.png') });
    await page.locator('#roomStage').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'owner-room-viewport-1280.png') });
    await page.screenshot({ path: path.join(output, 'owner-room-1280.png'), fullPage: true });
    await page.evaluate(() => window.LauncherProfileShop.openShopCategory('room_scene'));
    await page.waitForFunction(() => document.getElementById('shopItemCount').textContent.includes('3 件'));
    check('scene shop shows all three products', await page.locator('#shopGrid .shop-item').count() === 3);
    await page.getByRole('tab', { name: '房間家具' }).click();
    check('furniture shop shows ten products', await page.locator('#shopGrid .shop-item').count() === 10);
    await page.getByRole('tab', { name: 'Q版夥伴' }).click();
    check('canonical chibi shop shows six products', await page.locator('#shopGrid .shop-item').count() === 6);
    await page.locator('#shopPanel').screenshot({ path: path.join(output, 'chibi-shop-1280.png') });
    await page.evaluate(() => window.LauncherProfileShop.openProfile(44));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '好友航海士');
    check('friend room readonly', await page.locator('#roomEditToggle').isHidden() && await page.locator('#roomEditor').isHidden());
    check('friend canonical chibi visible', await page.locator('#roomCharacters img').count() === 1);
    check('off-floor saved character receives valid walk bounds', await page.locator('#roomCharacters img').first().evaluate(node => {
      const top = Number.parseFloat(node.style.top);
      return Number.isFinite(top) && top >= 345 / 540 * 100 && top <= 485 / 540 * 100;
    }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    check('reduced motion stops walking animation', await page.locator('#roomCharacters .is-walking').count() === 0);
    await page.setViewportSize({ width: 390, height: 844 });
    check('narrow viewport scrolls room internally', await page.evaluate(() =>
      document.documentElement.scrollWidth <= window.innerWidth + 1 &&
      document.querySelector('.room-stage-scroll').scrollWidth > document.querySelector('.room-stage-scroll').clientWidth));
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'friend-room-section-390.png') });
    await page.screenshot({ path: path.join(output, 'friend-room-390.png'), fullPage: true });
    await page.evaluate(() => window.LauncherProfileShop.openProfile(0));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    await page.locator('#roomEditToggle').click();
    await page.waitForSelector('#roomEditor:not([hidden])');
    await page.evaluate(() => {
      window.onePieceDesktop.saveLauncherRoom = room => new Promise(resolve => {
        window.__roomQa.pendingRoomSave = { room, resolve };
      });
    });
    await page.getByRole('tab', { name: '場景' }).click();
    await page.locator('#roomEditorItems .room-palette-item').first().click();
    await page.locator('#roomSave').click();
    await page.evaluate(() => window.LauncherProfileShop.openProfile(44));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '好友航海士');
    await page.evaluate(() => window.__roomQa.pendingRoomSave.resolve({ ok: true, profile: structuredClone(window.__roomQa.mine), shop: structuredClone(window.__roomQa.shop) }));
    await page.waitForTimeout(50);
    check('late save response cannot replace visited friend', await page.evaluate(() =>
      document.getElementById('profileHeroName').textContent === '好友航海士' && document.getElementById('roomEditToggle').hidden));
    check('renderer has no uncaught errors', errors.length === 0);
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ok: true, results, errors }, null, 2) + '\n');
    console.log(JSON.stringify({ ok: true, checks: results.length, output }));
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
