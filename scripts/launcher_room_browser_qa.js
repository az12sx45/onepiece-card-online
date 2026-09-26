'use strict';

// Renderer integration check. The real HTML/CSS/JS runs with a deterministic
// Electron bridge stub, so no account, DB, or public server is changed.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const runtimeRoot = 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const bundledPlaywright = fs.existsSync(runtimeRoot) ? fs.readdirSync(runtimeRoot)
  .map(name => path.join(runtimeRoot, name, 'bin/node_modules/playwright'))
  .find(candidate => fs.existsSync(path.join(candidate, 'package.json'))) : null;
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || bundledPlaywright || 'playwright');
const { CATALOG } = require('../server/launcher-profile-shop');

const root = path.resolve(__dirname, '..');
const output = path.resolve(process.env.LAUNCHER_ROOM_QA_OUT || 'D:/Codex_QA/launcher-room-browser');
const read = file => fs.readFileSync(path.join(root, 'desktop', file), 'utf8');
const roomIds = ['room-scene-sunny-deck', 'room-furniture-helm', 'room-character-luffy'];
const products = roomIds.map(id => CATALOG.find(item => item.id === id));
assert(products.every(Boolean), 'Room catalog fixture is incomplete.');
const canonicalCharacters = CATALOG.filter(item => item.type === 'room_character');
const syntheticMotion = process.env.LAUNCHER_ROOM_QA_SYNTHETIC_MOTION === '1';
const syntheticScenes = false;
assert(canonicalCharacters.length >= 10, 'Ten canonical character products are required.');
const poses = ['idle', 'walk1', 'walk2', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave'];
if (!process.env.LAUNCHER_ROOM_QA_SKIP_ASSET_PREFLIGHT) {
  for (const item of canonicalCharacters) {
    for (const pose of poses)
      assert(fs.existsSync(path.join(root, 'public/images/launcher_room/action_frames', item.key, `${pose}.webp`)), `Missing generated full-body action frame: ${item.key}/${pose}`);
    const digest = pose => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, 'public/images/launcher_room/action_frames', item.key, `${pose}.webp`))).digest('hex');
    if (!syntheticMotion) for (const direction of ['east', 'west', 'north', 'south'])
      assert(fs.existsSync(path.join(root, 'public/images/launcher_room/motion_v2', item.key, `${direction}.webp`)), `Missing reviewed directional atlas: ${item.key}/${direction}`);
    if (!syntheticMotion) for (const direction of ['east', 'west', 'north', 'south'])
      assert(fs.existsSync(path.join(root, 'public/images/launcher_room/acting_v2', item.key, `${direction}.webp`)), `Missing reviewed directional action atlas: ${item.key}/${direction}`);
    assert.notEqual(digest('talk_happy'), digest('talk_annoyed'), `${item.key} spoken emotions must differ on the body`);
  }
  for (const item of CATALOG.filter(value => value.type === 'room_furniture')) {
    const views = [];
    for (let rotation = 0; rotation < 4; rotation++) {
      const file = path.join(root, 'public/images/launcher_room/furniture_views', item.key, `${rotation}.webp`);
      assert(fs.existsSync(file), `Missing furniture view: ${item.key}/${rotation}`);
      views.push(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));
    }
    assert.equal(new Set(views).size, 4, `${item.key} needs four different view images`);
  }
}
fs.mkdirSync(output, { recursive: true });

async function main() {
  const chrome = process.env.LAUNCHER_PROFILE_QA_CHROME ||
    (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  const results = [];
  const errors = [];
  const check = (name, value) => { results.push({ name, pass: !!value }); assert.ok(value, name); };
  let page;
  try {
    page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const motionFixture = syntheticMotion ? await page.evaluate(cell => {
      const canvas = document.createElement('canvas'); canvas.width = cell * 8; canvas.height = cell * 4;
      const context = canvas.getContext('2d');
      for (let frame = 0; frame < 32; frame++) {
        const x = frame % 8 * cell, y = Math.floor(frame / 8) * cell;
        context.fillStyle = `hsl(${frame * 45} 60% 50%)`; context.fillRect(x + cell * .27, y + cell * .12, cell * .46, cell * .85);
        context.fillStyle = '#000'; context.font = `${cell * .19}px sans-serif`; context.fillText(String(frame), x + cell * .42, y + cell * .55);
      }
      const depth = document.createElement('canvas'); depth.width = cell * 8; depth.height = cell * 20;
      for (let variant = 0; variant < 5; variant++) depth.getContext('2d').drawImage(canvas, 0, variant * cell * 4);
      return { base: canvas.toDataURL('image/png').split(',')[1], depth: depth.toDataURL('image/png').split(',')[1] };
    }, require('../desktop/launcher-room-motion').SHAPE.cell) : null;
    page.on('pageerror', error => errors.push(error.message));
    const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZnwAAAABJRU5ErkJggg==', 'base64');
    await page.route('opui://**', route => {
      const requested = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
      if (/^images\/launcher_room\/(motion_v2|acting_v2)\//.test(requested) && motionFixture)
        return route.fulfill({ contentType: 'image/png', body: Buffer.from(motionFixture[/\/motion_v2\/.*\/(north|south)\.webp$/.test(requested) ? 'depth' : 'base'], 'base64') });
      const file = path.resolve(root, 'public', requested);
      if (file.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(file)) return route.fulfill({ path: file });
      if (requested.includes('/motion_v2/') || requested.includes('/acting_v2/')) return route.fulfill({ status: 404, body: 'Missing directional animation' });
      if (process.env.LAUNCHER_ROOM_QA_SKIP_ASSET_PREFLIGHT) {
        const action = requested.match(/^images\/launcher_room\/action_frames\/([a-z0-9-]+)\/[a-z0-9_]+\.webp$/);
        const furniture = requested.match(/^images\/launcher_room\/furniture_views\/([a-z0-9-]+)\/[0-3]\.webp$/);
        const legacy = action ? path.join(root, 'public/images/launcher_room/chibi', `${action[1]}.webp`)
          : furniture ? path.join(root, 'public/images/launcher_room/furniture', `${furniture[1]}.webp`) : null;
        if (legacy && fs.existsSync(legacy)) return route.fulfill({ path: legacy });
      }
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
          placements: [{ itemId: items[1].id, x: 390, y: 405, scale: 1.5, flip: true }],
          characters: [{ itemId: items[2].id, x: 530, y: 0 }] },
        roomItems: { scene: items[0],
          placements: [{ itemId: items[1].id, x: 390, y: 405, scale: 1.5, flip: true, item: items[1] }],
          characters: [{ itemId: items[2].id, x: 530, y: 0, item: items[2] }] }
      };
      const shop = {
        catalog, wallet: { coins: 460, dailyGrant: 20, cap: 500 },
        owned: { avatars: [], walls: [], flags: [], layouts: [], backgrounds: [], frames: [], decorations: [], bgms: [],
          roomScenes: [items[0].id], roomFurniture: [items[1].id, 'room-furniture-map-table'],
          roomCharacters: catalog.filter(item => item.type === 'room_character').map(item => item.id), guestbook: false },
        equipped: { avatar: 8, wall: 1, flag: 1, decorations: {} }
      };
      const companionFor = itemId => ({
        itemId, name: catalog.find(item => item.id === itemId)?.name || itemId,
        role: '船長', description: '喜歡冒險，也關心每位同伴。', affinity: 0, maxAffinity: 100,
        nextTalkAt: null, talksRemainingToday: 6,
        work: { state: 'idle', readyAt: null, reward: 10, remainingStartsToday: 6,
          characterStartsRemainingToday: 2, remainingClaimsToday: 6 }
      });
      window.__roomQa = { mine, friend, shop, calls: [], saved: null, companions: {}, companionFor };
      window.onePieceDesktop = {
        async getLauncherProfile(userId = 0) { return { ok: true, profile: copy(userId === 44 ? friend : mine) }; },
        async getLauncherShop() { return { ok: true, shop: copy(shop) }; },
        async getLauncherComments() { return { ok: true, comments: [], hasMore: false }; },
        async saveLauncherRoom(room) {
          window.__roomQa.calls.push('save'); window.__roomQa.saved = copy(room);
          mine.room = { ...copy(room), revision: room.revision + 1 };
          const byId = id => catalog.find(item => item.id === id);
          mine.roomItems = {
            scene: byId(mine.room.sceneId) || null,
            placements: mine.room.placements.map(entry => ({ ...entry, item: byId(entry.itemId) })),
            characters: mine.room.characters.map(entry => ({ ...entry, item: byId(entry.itemId) }))
          };
          return { ok: true, profile: copy(mine), shop: copy(shop) };
        },
        async getLauncherCharacter(itemId) {
          window.__roomQa.calls.push(`character-get:${itemId}`);
          const companion = window.__roomQa.companions[itemId] ||= companionFor(itemId);
          if (companion.work.state === 'working' && Date.parse(companion.work.readyAt) <= Date.now())
            companion.work.state = 'ready';
          return { ok: true, character: copy(companion), wallet: copy(shop.wallet) };
        },
        async interactLauncherCharacter(itemId, action) {
          window.__roomQa.calls.push(`character-interact:${itemId}:${action}`);
          const companion = window.__roomQa.companions[itemId];
          if (action !== 'talk' || !companion) return { ok: false, error: 'invalid_action' };
          companion.affinity += 2; companion.talksRemainingToday--;
          companion.nextTalkAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
          return { ok: true, character: copy(companion), wallet: copy(shop.wallet) };
        },
        async startLauncherCharacterWork(itemId) {
          window.__roomQa.calls.push(`character-start:${itemId}`);
          const companion = window.__roomQa.companions[itemId];
          if (!companion) return { ok: false, error: 'invalid_character' };
          companion.work.state = 'working';
          companion.work.readyAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
          companion.work.remainingStartsToday--; companion.work.characterStartsRemainingToday--;
          return { ok: true, character: copy(companion), wallet: copy(shop.wallet) };
        },
        async claimLauncherCharacterWork(itemId) {
          window.__roomQa.calls.push(`character-claim:${itemId}`);
          const companion = window.__roomQa.companions[itemId];
          if (!companion || Date.parse(companion.work.readyAt) > Date.now())
            return { ok: false, error: 'work_not_ready' };
          companion.work.state = 'idle'; companion.work.readyAt = null;
          companion.affinity++; shop.wallet.coins += 10;
          return { ok: true, claimed: true, character: copy(companion), wallet: copy(shop.wallet) };
        }
      };
      window.launcherSwitchPanel = name => {
        for (const id of ['profile', 'shop', 'social']) document.getElementById(`${id}Panel`).hidden = id !== name;
        window.LauncherProfileShop?.onVisible(name);
      };
      document.getElementById('bootScreen').hidden = true;
    }, { items: products, catalog: CATALOG });
    await page.addScriptTag({ content: read('launcher-room-dialogue.js') });
    await page.evaluate(() => { window.__LAUNCHER_ROOM_QA__ = true; });
    await page.addScriptTag({ content: read('launcher-room-motion-data.js') });
    await page.addScriptTag({ content: read('launcher-room-motion.js') });
    check('canonical relationship dialogue loads before room renderer', await page.evaluate(() =>
      window.OnePieceRoomDialogue?.KEYS?.length === 10 &&
      window.OnePieceRoomDialogue?.hasPair?.('zoro', 'sanji') &&
      window.OnePieceRoomDialogue?.hasPair?.('luffy', 'jinbe')));
    await page.addScriptTag({ content: read('launcher-room.js') });
    await page.addScriptTag({ content: read('launcher-profile-shop.js') });
    assert.ok(await page.evaluate(() => !!window.LauncherProfileShop), `Profile renderer did not initialize: ${errors.join(' | ')}`);
    await page.evaluate(() => window.LauncherProfileShop.setAccount({ authenticated: true, profile: { userId: 42 } }));
    await page.evaluate(() => window.LauncherProfileShop.openProfile(0));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    check('owner edit button visible', await page.locator('#roomEditToggle').isVisible());
    await page.locator('#roomEditToggle').click();
    await page.waitForSelector('#roomEditor:not([hidden])');
    check('room editor has no shop jump button', await page.locator('#roomShopButton').count() === 0);
    check('floor grid only appears while editing', await page.locator('.room-floor-grid').isVisible());
    check('free room scene shown', await page.locator('#roomEditorItems .room-palette-item').count() === 2);
    await page.locator('#roomEditorItems .room-palette-item').nth(1).click();
    await page.getByRole('tab', { name: '家具' }).click();
    await page.locator('#roomEditorItems .room-palette-item').first().click();
    const facing = [];
    const views = [];
    const furniture = page.locator('#roomObjects .room-object-shell').first();
    for (let turn = 0; turn < 4; turn++) {
      facing.push(await furniture.getAttribute('data-rotation'));
      views.push(await furniture.locator('.room-object').getAttribute('src'));
      await page.locator('#roomStage').screenshot({ path: path.join(output, `furniture-direction-${turn}.png`) });
      await furniture.locator('.room-canvas-rotate').nth(1).click();
    }
    check('selected furniture exposes on-canvas turn controls without a size slider',
      await furniture.locator('.room-canvas-controls').isVisible() &&
      await page.locator('#roomSelection input[type="range"]').count() === 0 &&
      await page.locator('#roomSelection .room-rotate').count() === 0);
    check('furniture cycles four cardinal directions', facing.join(',') === '0,1,2,3' && await furniture.getAttribute('data-rotation') === '0');
    check('four furniture views use four distinct art files', new Set(views).size === 4 && views.every((url, index) => url.endsWith(`/helm/${index}.webp`)));
    check('four furniture views decode into visible pixels', await furniture.locator('.room-object').evaluate(async image => {
      const urls = [0, 1, 2, 3].map(rotation => `opui://launcher/images/launcher_room/furniture_views/helm/${rotation}.webp`);
      return (await Promise.all(urls.map(src => new Promise(resolve => {
        const candidate = new Image(); candidate.onload = () => resolve(candidate.naturalWidth > 1 && candidate.naturalHeight > 1);
        candidate.onerror = () => resolve(false); candidate.src = src;
      })))).every(Boolean);
    }));
    await furniture.locator('.room-canvas-rotate').first().click();
    check('on-canvas left turn reverses one bearing', await furniture.getAttribute('data-rotation') === '3');
    await page.locator('#roomStage').press('r');
    check('R shortcut rotates selected furniture', await furniture.getAttribute('data-rotation') === '0');
    await furniture.locator('.room-canvas-rotate').nth(1).click();
    check('on-canvas right turn restores selected bearing', await furniture.getAttribute('data-rotation') === '1');
    check('furniture uses a fixed character-calibrated base size', await furniture.evaluate(node => {
      const width = Number.parseFloat(node.style.getPropertyValue('--room-width'));
      const height = Number.parseFloat(node.style.getPropertyValue('--room-height'));
      const depth = Number.parseFloat(node.style.getPropertyValue('--room-size'));
      const groundY = Number.parseFloat(node.style.top) / 100 * 540;
      return Math.abs(width - 140 / 960 * 100) < .01 && Math.abs(height - 148 / 540 * 100) < .01 &&
        Math.abs(depth - (.72 + .35 * (groundY - 267) / (515 - 267))) < .01;
    }));
    check('furniture has projected grid footprint', await furniture.evaluate(node => {
      const [width, height] = node.dataset.footprint.split('x').map(Number);
      return Number.isInteger(Number(node.dataset.gridCol)) && Number.isInteger(Number(node.dataset.gridRow)) && width > 0 && height > 0;
    }));
    const before = await furniture.evaluate(node => node.style.left);
    const box = await furniture.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 65, box.y + box.height / 2 + 20, { steps: 4 }); await page.mouse.up();
    check('pointer drag moved furniture', await furniture.evaluate(node => node.style.left) !== before);
    check('dragged furniture snaps to its projected floor cell', await furniture.evaluate(node => {
      const col = Number(node.dataset.gridCol), row = Number(node.dataset.gridRow);
      const [width, height] = node.dataset.footprint.split('x').map(Number);
      const depth = (row + height) / 8;
      const left = 164 + (28 - 164) * depth, right = 796 + (932 - 796) * depth;
      const expectedX = left + (right - left) * (col + width / 2) / 16;
      const expectedY = 267 + (515 - 267) * depth;
      return Math.abs(Number.parseFloat(node.style.left) / 100 * 960 - expectedX) < 1 &&
        Math.abs(Number.parseFloat(node.style.top) / 100 * 540 - expectedY) < 1;
    }));
    const beforeArrow = Number(await furniture.getAttribute('data-grid-col'));
    await page.locator('#roomStage').press('ArrowRight');
    check('arrow key moves one projected floor tile', Number(await furniture.getAttribute('data-grid-col')) === beforeArrow + 1);
    await page.locator('#roomEditorItems .room-palette-item').nth(1).click();
    check('two furniture items have separate projected floor footprints', await page.evaluate(() => {
      const pieces = [...document.querySelectorAll('#roomObjects .room-object-shell')];
      if (pieces.length !== 2) return false;
      const occupied = new Set();
      for (const piece of pieces) {
        const x = Number(piece.dataset.gridCol), y = Number(piece.dataset.gridRow);
        const [width, height] = piece.dataset.footprint.split('x').map(Number);
        for (let row = y; row < y + height; row++) for (let col = x; col < x + width; col++) {
          const id = `${col}:${row}`;
          if (occupied.has(id)) return false;
          occupied.add(id);
        }
      }
      return true;
    }));
    check('projected depth order follows ground contact point', await page.evaluate(() => {
      const pieces = [...document.querySelectorAll('#roomObjects .room-object-shell')];
      return pieces.every(piece => Number(piece.style.zIndex) === 10 + Math.round(Number.parseFloat(piece.style.top) / 100 * 540));
    }));
    const occupiedDrag = await page.evaluate(() => {
      const stage = document.querySelector('#roomStage').getBoundingClientRect();
      const first = document.querySelector('#roomObjects [data-room-key="f:room-furniture-helm"]');
      const second = document.querySelector('#roomObjects [data-room-key="f:room-furniture-map-table"]');
      const secondBox = second.getBoundingClientRect();
      const start = { x: secondBox.left + secondBox.width / 2, y: secondBox.top + secondBox.height / 2 };
      const startWorld = { x: (start.x - stage.left) / stage.width * 960, y: (start.y - stage.top) / stage.height * 540 };
      const secondAnchor = { x: Number.parseFloat(second.style.left) / 100 * 960, y: Number.parseFloat(second.style.top) / 100 * 540 };
      const firstAnchor = { x: Number.parseFloat(first.style.left) / 100 * 960, y: Number.parseFloat(first.style.top) / 100 * 540 };
      return { start, end: {
        x: stage.left + (firstAnchor.x + startWorld.x - secondAnchor.x) / 960 * stage.width,
        y: stage.top + (firstAnchor.y + startWorld.y - secondAnchor.y) / 540 * stage.height
      }, before: `${second.dataset.gridCol}:${second.dataset.gridRow}` };
    });
    await page.mouse.move(occupiedDrag.start.x, occupiedDrag.start.y);
    await page.mouse.down();
    await page.mouse.move(occupiedDrag.end.x, occupiedDrag.end.y);
    await page.mouse.up();
    const occupiedDragResult = await page.evaluate(before => {
      const second = document.querySelector('#roomObjects [data-room-key="f:room-furniture-map-table"]');
      return { before, after: `${second.dataset.gridCol}:${second.dataset.gridRow}`,
        status: document.querySelector('#roomStatus').textContent,
        selected: document.querySelector('#roomSelection strong')?.textContent };
    }, occupiedDrag.before);
    if (occupiedDragResult.after !== occupiedDragResult.before || !occupiedDragResult.status.includes('佔用'))
      console.error('occupied drag detail', JSON.stringify(occupiedDragResult));
    check('dragging second furniture onto occupied tiles is rejected',
      occupiedDragResult.after === occupiedDragResult.before && occupiedDragResult.status.includes('佔用'));
    await page.locator('#roomSelection .room-remove').click();
    await page.getByRole('tab', { name: '夥伴' }).click();
    for (let index = 0; index < 8; index++) await page.locator('#roomEditorItems .room-palette-item').nth(index).click();
    check('eight canonical chibis can share room', await page.locator('#roomObjects .room-object-shell').count() === 1 && await page.locator('#roomCharacters .room-character-shell').count() === 8);
    check('edit grid marks nine non-overlapping placed footprints', await page.locator('#roomStage .room-grid-footprint').count() === 9 && await page.evaluate(() => {
      const nodes = [...document.querySelectorAll('#roomObjects .room-object-shell, #roomCharacters .room-character-shell')];
      return nodes.every(node => Number(node.style.zIndex) === 10 + Math.round(Number.parseFloat(node.style.top) / 100 * 540));
    }));
    check('character and furniture really occlude by shared depth instead of layer order', await page.evaluate(() => {
      const furniture = document.querySelector('#roomObjects .room-object-shell');
      const actor = document.querySelector('#roomCharacters .room-character-shell');
      const formerFurniture = furniture.style.cssText, formerActor = actor.style.cssText;
      furniture.style.left = actor.style.left = '50%'; furniture.style.top = actor.style.top = '75%';
      const box = actor.getBoundingClientRect();
      const x = box.left + box.width / 2, y = box.top + box.height / 2;
      furniture.style.zIndex = '700'; actor.style.zIndex = '400';
      const frontFurniture = document.elementFromPoint(x, y)?.closest('[data-room-key]') === furniture;
      furniture.style.zIndex = '400'; actor.style.zIndex = '700';
      const frontActor = document.elementFromPoint(x, y)?.closest('[data-room-key]') === actor;
      furniture.style.cssText = formerFurniture; actor.style.cssText = formerActor;
      return frontFurniture && frontActor;
    }));
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'edit-room-eight-1280.png') });
    await page.locator('#roomEditorItems .room-palette-item').nth(8).click();
    check('ninth chibi is rejected', await page.locator('#roomCharacters .room-character-shell').count() === 8 && (await page.locator('#roomStatus').textContent()).includes('8 位'));
    await page.locator('#roomSave').click();
    check('server payload contains editable room', await page.evaluate(() => {
      const saved = window.__roomQa.saved;
      return saved?.revision === 0 && saved?.sceneId === 'room-scene-sunny-deck' &&
        saved?.placements?.[0]?.itemId === 'room-furniture-helm' && saved?.placements?.[0]?.x > 0 &&
        saved?.placements?.[0]?.rotation === 1 && saved?.placements?.[0]?.flip === false &&
        saved?.characters?.length === 8 && saved.characters[0]?.itemId === 'room-character-luffy';
    }));
    await page.evaluate(() => { Math.random = () => .9; });
    await page.locator('#roomCancel').click();
    // Separate the locomotion/conversation fixture from the crowded eight-slot editor check.
    await page.evaluate(async () => {
      const qa = window.__roomQa;
      qa.mine.room.placements = []; qa.mine.roomItems.placements = [];
      qa.mine.room.characters = [['luffy', 460, 391], ['zoro', 510, 391]].map(([key, x, y]) => ({ itemId: `room-character-${key}`, x, y }));
      qa.mine.roomItems.characters = qa.mine.room.characters.map(entry => ({ ...entry, item: qa.shop.catalog.find(item => item.id === entry.itemId) }));
      await window.LauncherProfileShop.openProfile(0);
    });
    await page.waitForFunction(() => document.querySelectorAll('#roomCharacters .room-character-shell').length === 2);
    check('floor grid hidden outside editing', await page.locator('.room-floor-grid').isHidden());
    check('dialogue bubble does not contain emotion portrait', await page.locator('#roomCharacters .room-speech-face').count() === 0);
    await page.evaluate(() => {
      const walker = window.__launcherRoomTest.snapshot().walkers.find(entry => entry.key === 'luffy');
      window.__launcherRoomTest.route('luffy', { col: walker.cell.col, row: Math.min(7, walker.cell.row + 2) });
    });
    const chibiStart = await page.locator('#roomCharacters .room-character-shell').first().evaluate(node => `${node.style.left}|${node.style.top}`);
    const walkingFrames = await page.evaluate(async () => {
      const seen = new Set();
      for (let index = 0; index < 240; index++) {
        for (const node of document.querySelectorAll('#roomCharacters .room-character-shell.is-walking'))
          seen.add(`${node.dataset.motionFrame}|${node.dataset.direction}|${!node.querySelector('.room-walk-sprite').hidden}`);
        await new Promise(resolve => requestAnimationFrame(resolve));
      }
      return [...seen];
    });
    check('decoded directional canvas displays all 32 walk frames', [...Array(32).keys()].every(frame =>
      walkingFrames.some(value => value.startsWith(`${frame}|`) && value.endsWith('|true'))));
    check('whole body uses independent directional art without mirror transforms', await page.evaluate(() =>
      [...document.querySelectorAll('.room-walk-sprite')].every(canvas => !getComputedStyle(canvas).transform.startsWith('matrix(-1')) &&
      ![...document.querySelectorAll('.room-chibi')].some(image => getComputedStyle(image).animationName !== 'none')));
    check('character pixel size and gait use the same depth factor', await page.evaluate(() =>
      [...document.querySelectorAll('#roomCharacters .room-character-shell')].every(node => {
        const depth = Number(node.style.getPropertyValue('--room-depth'));
        const scale = Number(node.style.getPropertyValue('--room-character-scale'));
        return Math.abs(scale - depth / 1.07) < .0001;
      })));
    await page.waitForTimeout(2200);
    const chibiMoved = await page.locator('#roomCharacters .room-character-shell').first().evaluate(node => `${node.style.left}|${node.style.top}`);
    check('canonical chibi walks when room is visible', chibiMoved !== chibiStart);
    await page.evaluate(() => window.__launcherRoomTest.resumeInteractions());
    await page.waitForFunction(() => document.querySelectorAll('#roomCharacters .room-speech:not([hidden])').length === 1 &&
      window.__launcherRoomTest.snapshot().interaction?.turnIndex === 0, undefined, { timeout: 30000 });
    await page.evaluate(() => {
      window.__qaSceneTurns = new Map();
      window.__qaSceneSpeakers = new Map();
      window.__qaSceneWatch = setInterval(() => {
        const active = window.__launcherRoomTest.snapshot().interaction;
        if (!active?.sceneId || active.turnIndex < 0) return;
        const seen = window.__qaSceneTurns.get(active.sceneId) || new Set();
        seen.add(active.turnIndex); window.__qaSceneTurns.set(active.sceneId, seen);
        const speech = document.querySelector('#roomCharacters .room-speech:not([hidden])');
        const spoken = window.__qaSceneSpeakers.get(active.sceneId) || new Map();
        if (speech) spoken.set(active.turnIndex, { speaker: speech.parentElement.dataset.roomKey.replace('c:room-character-', ''),
          line: speech.querySelector('.room-speech-text').textContent });
        window.__qaSceneSpeakers.set(active.sceneId, spoken);
      }, 50);
    });
    const firstSpeech = await page.locator('#roomCharacters .room-speech:not([hidden]) .room-speech-text').textContent();
    check('spoken emotion changes the full-body character pose', await page.locator('#roomCharacters .room-speech:not([hidden])').evaluate(speech => {
      const body = speech.parentElement;
      return !!speech.textContent.trim() && ['idle', 'wave', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use'].includes(body.dataset.pose) &&
        (body.dataset.actionSource === 'acting_v2' ? !body.querySelector('.room-walk-sprite').hidden :
          body.querySelector('.room-chibi').src.includes(`/action_frames/${body.dataset.roomKey.slice(17)}/${body.dataset.pose}.webp`));
    }));
    const directionalConversation = await page.locator('#roomCharacters .room-speech:not([hidden])').evaluate(speech =>
      speech.parentElement.dataset.directionalAction === 'true');
    check('speaker keeps its complete directional body during authored expression', directionalConversation);
    const actionBeats = await page.evaluate(async () => {
      const node = document.querySelector('#roomCharacters .room-speech:not([hidden])').parentElement;
      const pose = node.dataset.pose, frames = new Set(), started = performance.now();
      while (performance.now() - started < 900 && node.dataset.pose === pose) {
        frames.add(Number(node.dataset.actionFrame)); await new Promise(resolve => requestAnimationFrame(resolve));
      }
      return { pose, frames: [...frames], index: window.OnePieceRoomMotion.ACTION_POSES.indexOf(pose) };
    });
    check('speaking action plays four beats while retaining its assigned expression', actionBeats.frames.length === 4 &&
      actionBeats.frames.every(frame => Math.floor(frame / 4) === actionBeats.index));
    check('one active speech bubble stays inside stage', await page.locator('#roomCharacters .room-speech:not([hidden])').evaluate(node => {
      const bubble = node.getBoundingClientRect(); const stage = document.querySelector('#roomStage').getBoundingClientRect();
      return bubble.left >= stage.left - 1 && bubble.right <= stage.right + 1 && bubble.top >= stage.top - 1 && bubble.bottom <= stage.bottom + 1;
    }));
    await page.locator('#roomStage').screenshot({ path: path.join(output, 'dialogue-room-stage-1280.png') });
    await page.waitForFunction(first => {
      const current = document.querySelector('#roomCharacters .room-speech:not([hidden]) .room-speech-text');
      return current && current.textContent !== first;
    }, firstSpeech, { timeout: 7000 });
    check('partner replies sequentially', await page.locator('#roomCharacters .room-speech:not([hidden])').count() === 1);
    check('listener performs its authored body reaction during the reply', await page.evaluate(() => {
      const speaker = document.querySelector('#roomCharacters .room-speech:not([hidden])');
      return ['talk_happy', 'talk_annoyed', 'surprised', 'focused_use'].includes(speaker?.parentElement?.dataset.pose) &&
        [...document.querySelectorAll('#roomCharacters .room-character-shell')].some(node => node !== speaker.parentElement && node.dataset.listener && node.dataset.reaction);
    }));
    const fullScene = await page.evaluate(async () => {
      const scenes = window.__qaSceneTurns; const started = performance.now();
      while (performance.now() - started < 35000) {
        const active = window.__launcherRoomTest.snapshot().interaction;
        if (active?.sceneId && active.turnIndex >= 0) {
          const seen = scenes.get(active.sceneId) || new Set(); seen.add(active.turnIndex); scenes.set(active.sceneId, seen);
          if (seen.has(0) && seen.has(1) && seen.has(2) && seen.has(3) && window.__qaSceneSpeakers.get(active.sceneId)?.has(3)) {
            clearInterval(window.__qaSceneWatch);
            const [first, second] = active.pair.split(':');
            return { id: active.sceneId, turns: [...seen], spoken: [...window.__qaSceneSpeakers.get(active.sceneId)],
              expected: window.OnePieceRoomDialogue.scene(first, second, active.sceneCursor).turns };
          }
        }
        await new Promise(resolve => setTimeout(resolve, 90));
      }
      return [...scenes].map(([id, turns]) => ({ id, turns: [...turns] }));
    });
    check('a full conversation plays at least four turns without truncating replies', !Array.isArray(fullScene) && fullScene.turns.length >= 4);
    check('each displayed turn retains its authored speaker and line', fullScene.spoken.length >= 4 &&
      fullScene.spoken.every(([index, turn]) => turn.speaker === fullScene.expected[index].speaker && turn.line === fullScene.expected[index].line));
    await page.locator('#roomCharacters [data-room-key="c:room-character-luffy"]').click({ force: true });
    check('manual character selection interrupts scene and clears listener reactions', await page.evaluate(() =>
      !window.__launcherRoomTest.snapshot().interaction &&
      !document.querySelector('#roomCharacters [data-listener]') &&
      !document.querySelector('#roomCharacters .room-speech:not([hidden])')));
    await page.locator('#roomCompanionClose').click();
    check('an interrupted pair remains on cooldown instead of repeating immediately', !await page.evaluate(() =>
      window.__launcherRoomTest.beginChat('luffy', 'zoro')));
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    const hiddenStart = await page.locator('#roomCharacters .room-character-shell').first().evaluate(node => node.style.left);
    await page.waitForTimeout(350);
    check('chibi pauses and bubble clears when document is hidden', await page.locator('#roomCharacters .room-character-shell').first().evaluate(node => node.style.left) === hiddenStart && await page.locator('#roomCharacters .room-speech:not([hidden])').count() === 0);
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'owner-room-section-1280.png') });
    await page.locator('#roomStage').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(output, 'owner-room-viewport-1280.png') });
    await page.screenshot({ path: path.join(output, 'owner-room-1280.png'), fullPage: true });
    await page.evaluate(() => {
      // Isolate one actor so an overlapping crew member cannot intercept a real pointer click.
      const qa = window.__roomQa;
      const entry = { itemId: 'room-character-luffy', x: 120, y: 450 };
      qa.mine.room.characters = [entry];
      qa.mine.roomItems.characters = [{ ...entry, item: qa.shop.catalog.find(item => item.id === entry.itemId) }];
      window.LauncherProfileShop.openProfile(0);
    });
    await page.waitForFunction(() => document.querySelectorAll('#roomCharacters .room-character-shell').length === 1);
    const captain = page.locator('#roomCharacters [data-room-key="c:room-character-luffy"]');
    await captain.click();
    await page.waitForFunction(() => document.getElementById('roomCompanionAffinity').textContent === '0 / 100' &&
      window.__roomQa.calls.includes('character-get:room-character-luffy'));
    check('clicking a placed character opens details and affection',
      await page.locator('#roomCompanionPanel').isVisible() &&
      (await page.locator('#roomCompanionName').textContent()).includes('魯夫') &&
      (await page.locator('#roomCompanionRole').textContent()) === '船長' &&
      await page.locator('#roomCompanionProgress').getAttribute('value') === '0');
    check('owner interaction controls are available with server character record',
      await page.locator('#roomCompanionTalk').isEnabled() &&
      await page.locator('#roomCompanionWorkStart').isEnabled() &&
      await page.locator('#roomCompanionWorkClaim').isHidden());
    await page.locator('#roomCompanionTalk').click();
    await page.waitForFunction(() => document.getElementById('roomCompanionAffinity').textContent === '2 / 100');
    check('chat raises affection and enforces returned cooldown in UI',
      await page.locator('#roomCompanionTalk').isDisabled() &&
      await page.evaluate(() => window.__roomQa.calls.includes('character-interact:room-character-luffy:talk')));
    await page.locator('#roomCompanionWorkStart').click();
    await page.waitForFunction(() => document.getElementById('roomCompanionWork').textContent.includes('正在工作'));
    check('work without a matching furnishing uses the character own work beat', await page.evaluate(() => {
      const walker = window.__launcherRoomTest.snapshot().walkers.find(value => value.key === 'luffy');
      const allowed = window.OnePieceRoomDialogue.SOLO.luffy.work.map(beat => beat.line);
      return walker.mode === 'job' && !walker.jobFurnitureKey && allowed.includes(walker.jobLine) &&
        !document.querySelector('#roomCharacters .is-using-furniture');
    }));
    check('five minute character work starts without immediate coin payout', await page.evaluate(() => {
      const qa = window.__roomQa;
      const companion = qa.companions['room-character-luffy'];
      const remaining = Date.parse(companion.work.readyAt) - Date.now();
      return companion.work.state === 'working' && remaining > 4 * 60 * 1000 &&
        qa.shop.wallet.coins === 460 && qa.calls.includes('character-start:room-character-luffy');
    }));
    await page.evaluate(() => {
      const work = window.__roomQa.companions['room-character-luffy'].work;
      work.state = 'ready'; work.readyAt = new Date(Date.now() - 1000).toISOString();
    });
    await page.locator('#roomCompanionClose').click();
    await captain.click();
    await page.waitForFunction(() => !document.getElementById('roomCompanionWorkClaim').hidden);
    check('finished work exposes claim only after server refresh', await page.locator('#roomCompanionWorkClaim').isEnabled());
    await page.locator('#roomCompanionWorkClaim').click();
    await page.waitForFunction(() => document.getElementById('roomCompanionAffinity').textContent === '3 / 100');
    check('claim updates affection and the same shop wallet', await page.evaluate(() =>
      window.__roomQa.shop.wallet.coins === 470 &&
      window.__roomQa.calls.includes('character-claim:room-character-luffy') &&
      document.getElementById('roomCompanionWorkStart').hidden === false));
    await page.locator('#roomCompanionClose').click();
    await page.evaluate(() => window.LauncherProfileShop.openShopCategory('room_scene'));
    await page.waitForFunction(() => document.getElementById('shopItemCount').textContent.includes('3 件'));
    check('scene shop shows all three products', await page.locator('#shopGrid .shop-item').count() === 3);
    await page.getByRole('tab', { name: '房間家具' }).click();
    check('furniture shop shows ten products', await page.locator('#shopGrid .shop-item').count() === 10);
    await page.getByRole('tab', { name: 'Q版夥伴' }).click();
    check('canonical chibi shop shows ten products', await page.locator('#shopGrid .shop-item').count() === 10);
    await page.locator('#shopPanel').screenshot({ path: path.join(output, 'chibi-shop-1280.png') });
    await page.evaluate(() => window.LauncherProfileShop.openProfile(44));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '好友航海士');
    check('friend room readonly', await page.locator('#roomEditToggle').isHidden() && await page.locator('#roomEditor').isHidden());
    check('friend canonical chibi visible', await page.locator('#roomCharacters .room-chibi').count() === 1);
    check('legacy flip migrates to rear-facing furniture', await page.locator('#roomObjects .room-object-shell').first().getAttribute('data-rotation') === '2');
    check('old saved furniture scale cannot stretch character-calibrated display size', await page.locator('#roomObjects .room-object-shell').first().evaluate(node => {
      const groundY = Number.parseFloat(node.style.top) / 100 * 540;
      const depth = Number.parseFloat(node.style.getPropertyValue('--room-size'));
      return Math.abs(depth - (.72 + .35 * (groundY - 267) / (515 - 267))) < .01 &&
        Math.abs(Number.parseFloat(node.style.getPropertyValue('--room-width')) - 140 / 960 * 100) < .01;
    }));
    const friendRequestsBefore = await page.evaluate(() => window.__roomQa.calls.length);
    await page.locator('#roomCharacters [data-room-key="c:room-character-luffy"]').click({ force: true });
    check('friend sees companion details but no interaction controls',
      await page.locator('#roomCompanionPanel').isVisible() &&
      await page.locator('#roomCompanionActions').isHidden() &&
      await page.evaluate(before => window.__roomQa.calls.length === before, friendRequestsBefore));
    await page.locator('#roomCompanionClose').click();
    check('off-floor saved character receives valid walk bounds', await page.locator('#roomCharacters .room-character-shell').first().evaluate(node => {
      const top = Number.parseFloat(node.style.top);
      return Number.isFinite(top) && top >= 267 / 540 * 100 && top <= 515 / 540 * 100;
    }));
    await page.waitForFunction(() => {
      const text = document.querySelector('#roomCharacters .room-speech:not([hidden]) .room-speech-action');
      return text?.textContent.trim() && text.closest('.room-character-shell').classList.contains('is-using-furniture');
    }, undefined, { timeout: 35000 });
    check('single chibi visits furniture and acts', await page.locator('#roomCharacters .room-speech:not([hidden])').count() === 1);
    check('furniture actor uses in-world body pose at an adjacent tile', await page.evaluate(() => {
      const actor = document.querySelector('#roomCharacters .room-speech:not([hidden])')?.parentElement;
      const furniture = document.querySelector('#roomObjects .room-object-shell');
      if (!actor || !furniture) return false;
      const ax = Number(actor.dataset.gridCol), ay = Number(actor.dataset.gridRow);
      const fx = Number(furniture.dataset.gridCol), fy = Number(furniture.dataset.gridRow);
      const [fw, fh] = furniture.dataset.footprint.split('x').map(Number);
      const nearestX = Math.max(fx, Math.min(ax, fx + fw - 1));
      const nearestY = Math.max(fy, Math.min(ay, fy + fh - 1));
      return ['idle', 'focused_use', 'sit', 'talk_happy', 'talk_annoyed', 'surprised', 'wave'].includes(actor.dataset.pose) && Math.abs(ax - nearestX) + Math.abs(ay - nearestY) === 1;
    }));
    await page.evaluate(() => {
      const qa = window.__roomQa;
      const probe = structuredClone(qa.friend);
      const furniture = { itemId: 'room-furniture-map-table', x: 600, y: 420, rotation: 0, scale: 1 };
      const actor = { itemId: 'room-character-zoro', x: 360, y: 420 };
      probe.room.placements = [furniture]; probe.room.characters = [actor];
      probe.roomItems.placements = [{ ...furniture, item: qa.shop.catalog.find(value => value.id === furniture.itemId) }];
      probe.roomItems.characters = [{ ...actor, item: qa.shop.catalog.find(value => value.id === actor.itemId) }];
      window.LauncherRoom.setProfile(probe, { accountId: 42 });
      window.__launcherRoomTest.resumeInteractions();
    });
    await page.waitForTimeout(250);
    check('Zoro cannot receive a generic navigation activity from a map table', await page.evaluate(() =>
      !window.OnePieceRoomDialogue.activity('zoro', 'map-table') &&
      !window.__launcherRoomTest.snapshot().interaction &&
      !document.querySelector('#roomCharacters .is-using-furniture')));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.waitForFunction(() => !document.querySelector('#roomCharacters .room-speech:not([hidden])'), undefined, { timeout: 1500 });
    check('reduced motion stops walking and speech and restores idle body art',
      await page.locator('#roomCharacters .is-walking').count() === 0 &&
      await page.locator('#roomCharacters .room-speech:not([hidden])').count() === 0 &&
      await page.locator('#roomCharacters .room-character-shell:not([data-pose="idle"])').count() === 0);
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
    check('narrow owner editor remains usable', await page.locator('#roomSave').isVisible() && await page.locator('#roomEditorTabs').isVisible() && await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    const narrowBubbles = await page.evaluate(async () => {
      const node = document.querySelector('#roomCharacters .room-character-shell');
      const speech = node?.querySelector('.room-speech');
      const stage = document.querySelector('#roomStage').getBoundingClientRect();
      if (!node || !speech) return [];
      const oldPosition = node.style.left;
      const bounds = [];
      for (const [x, side] of [[65, 'is-near-left'], [895, 'is-near-right']]) {
        node.style.left = `${x / 960 * 100}%`;
        node.classList.remove('is-near-left', 'is-near-right'); node.classList.add(side);
        speech.hidden = false; speech.querySelector('.room-speech-text').textContent = '測試對話氣泡位置';
        await new Promise(resolve => requestAnimationFrame(resolve));
        const bubble = speech.getBoundingClientRect();
        bounds.push({ bubbleLeft: bubble.left, bubbleRight: bubble.right, stageLeft: stage.left, stageRight: stage.right });
      }
      speech.hidden = true; node.style.left = oldPosition; node.classList.remove('is-near-left', 'is-near-right');
      return bounds;
    });
    check('narrow left and right speech bubbles stay inside room', narrowBubbles.length === 2 && narrowBubbles.every(bubble =>
      bubble.bubbleLeft >= bubble.stageLeft - 1 && bubble.bubbleRight <= bubble.stageRight + 1));
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'edit-room-390.png') });
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

    // Furnished-room visual gate: six distinct generated furniture objects, four
    // view bearings, and six body-animated canonical crew in one floor layout.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.evaluate(() => {
      const qa = window.__roomQa;
      const furniture = [
        ['helm', 300, 425, 0], ['map-table', 650, 400, 1], ['treasure-chest', 190, 475, 2],
        ['tangerine-tree', 820, 390, 3], ['bookshelf', 205, 345, 1], ['piano', 655, 505, 2]
      ];
      const crew = [
        ['luffy', 150, 425], ['zoro', 405, 390], ['nami', 520, 470],
        ['chopper', 785, 475], ['sanji', 585, 345], ['robin', 320, 490]
      ];
      const byId = id => qa.shop.catalog.find(item => item.id === id);
      qa.mine.room = {
        revision: 3, sceneId: 'room-scene-sunny-deck',
        placements: furniture.map(([key, x, y, rotation]) => ({ itemId: `room-furniture-${key}`, x, y, rotation, flip: rotation === 2, scale: 1 })),
        characters: crew.map(([key, x, y]) => ({ itemId: `room-character-${key}`, x, y }))
      };
      qa.mine.roomItems = {
        scene: byId(qa.mine.room.sceneId),
        placements: qa.mine.room.placements.map(entry => ({ ...entry, item: byId(entry.itemId) })),
        characters: qa.mine.room.characters.map(entry => ({ ...entry, item: byId(entry.itemId) }))
      };
      qa.shop.owned.roomFurniture = furniture.map(([key]) => `room-furniture-${key}`);
      qa.shop.owned.roomCharacters = crew.map(([key]) => `room-character-${key}`);
      window.LauncherProfileShop.openProfile(0);
    });
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長' &&
      document.querySelectorAll('#roomObjects .room-object-shell').length === 6);
    await page.locator('#roomEditToggle').click();
    await page.waitForSelector('#roomEditor:not([hidden])');
    await page.waitForFunction(() => [...document.querySelectorAll('#roomObjects .room-object')].every(image =>
      image.complete && image.naturalWidth > 1 && image.dataset.artFallback === 'false'));
    const showcase = await page.evaluate(() => {
      const furniture = [...document.querySelectorAll('#roomObjects .room-object-shell')];
      const characters = [...document.querySelectorAll('#roomCharacters .room-character-shell')];
      const occupied = new Set(); let collision = false;
      for (const node of [...furniture, ...characters]) {
        const col = Number(node.dataset.gridCol), row = Number(node.dataset.gridRow);
        const [width, height] = node.dataset.footprint.split('x').map(Number);
        for (let r = row; r < row + height; r++) for (let c = col; c < col + width; c++) {
          const id = `${c}:${r}`; if (occupied.has(id)) collision = true; occupied.add(id);
        }
      }
      return {
        collision, gridCount: document.querySelectorAll('#roomStage .room-grid-footprint').length,
        furniture: furniture.map(node => {
          const image = node.querySelector('.room-object');
          return { id: node.dataset.roomKey, col: Number(node.dataset.gridCol), row: Number(node.dataset.gridRow),
            footprint: node.dataset.footprint, rotation: Number(node.dataset.rotation),
            src: image.getAttribute('src'), decoded: image.complete && image.naturalWidth > 1 && image.naturalHeight > 1,
            fallback: image.dataset.artFallback, depth: Number(node.style.zIndex), y: Number.parseFloat(node.style.top) / 100 * 540 };
        }),
        crew: characters.map(node => node.dataset.roomKey)
      };
    });
    check('showcase places six distinct furniture and six canonical crew without floor collision',
      showcase.furniture.length === 6 && new Set(showcase.furniture.map(item => item.id)).size === 6 &&
      showcase.crew.length === 6 && !showcase.collision && showcase.gridCount === 12);
    check('showcase four bearings use decoded final view art with no fallback',
      new Set(showcase.furniture.map(item => item.rotation)).size === 4 &&
      showcase.furniture.every(item => item.decoded && item.fallback === 'false' &&
        item.src.endsWith(`/${item.id.replace('f:room-furniture-', '')}/${item.rotation}.webp`)));
    check('showcase depth follows projected ground contact', showcase.furniture.every(item => item.depth === 10 + Math.round(item.y)));
    await page.locator('#roomStage').screenshot({ path: path.join(output, 'showcase-edit-stage-1280.png') });
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'showcase-edit-room-1280.png') });
    await page.locator('#roomCancel').click();
    await page.waitForFunction(() => window.__launcherRoomTest.snapshot().walkers.length === 6 &&
      window.__launcherRoomTest.snapshot().walkers.every(walker => walker.ready.length === 4), undefined, { timeout: 6000 });
    check('showcase six characters have all four decoded directional atlases', await page.evaluate(() =>
      window.__launcherRoomTest.snapshot().walkers.length === 6 &&
      window.__launcherRoomTest.snapshot().walkers.every(walker => walker.ready.length === 4)));
    await page.waitForFunction(() => document.querySelectorAll('#roomCharacters .is-walking').length >= 2, undefined, { timeout: 5000 });
    await page.locator('#roomStage').screenshot({ path: path.join(output, 'showcase-view-stage-1280.png') });
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'showcase-view-room-1280.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => { document.querySelector('.room-stage-scroll').scrollLeft = 0; });
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'showcase-view-room-390-left.png') });
    await page.evaluate(() => { const scroller = document.querySelector('.room-stage-scroll'); scroller.scrollLeft = scroller.scrollWidth; });
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'showcase-view-room-390-right.png') });
    check('showcase mobile viewport pans to both room edges without page overflow', await page.evaluate(() => {
      const scroller = document.querySelector('.room-stage-scroll');
      return scroller.scrollWidth > scroller.clientWidth && scroller.scrollLeft > 0 &&
        document.documentElement.scrollWidth <= window.innerWidth + 1;
    }));
    await page.locator('#roomEditToggle').click();
    await page.waitForSelector('#roomEditor:not([hidden])');
    await page.locator('#profileRoom').screenshot({ path: path.join(output, 'showcase-edit-room-390.png') });
    await page.locator('#roomCancel').click();
    check('renderer has no uncaught errors', errors.length === 0);
    const showcaseScreenshots = [
      'showcase-edit-stage-1280.png', 'showcase-edit-room-1280.png', 'showcase-view-stage-1280.png',
      'showcase-view-room-1280.png', 'showcase-view-room-390-left.png',
      'showcase-view-room-390-right.png', 'showcase-edit-room-390.png'
    ].map(name => path.join(output, name));
    assert(showcaseScreenshots.every(file => fs.existsSync(file) && fs.statSync(file).size > 10000), 'Missing showcase screenshots.');
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ok: true, syntheticMotion, syntheticScenes, directionalConversation,
      visualAcceptance: false, results, errors, showcase, showcaseScreenshots }, null, 2) + '\n');
    console.log(JSON.stringify({ ok: true, checks: results.length, output, syntheticMotion, syntheticScenes, visualAcceptance: false }));
  } catch (error) {
    const snapshot = page && await page.evaluate(() => window.__launcherRoomTest?.snapshot()).catch(() => null);
    fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message, results, errors, snapshot, syntheticMotion, syntheticScenes, visualAcceptance: false }, null, 2) + '\n');
    throw error;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.stack || error.message); process.exitCode = 1; });
