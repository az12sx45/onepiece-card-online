'use strict';
// Isolated PGlite account with the production room bridge and actual Chromium UI.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const runtime = 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const playwright = fs.existsSync(runtime) ? fs.readdirSync(runtime)
  .map(name => path.join(runtime, name, 'bin/node_modules/playwright'))
  .find(file => fs.existsSync(path.join(file, 'package.json'))) : null;
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || playwright || 'playwright');
const shop = require('../server/launcher-profile-shop');
const sourceRoot = path.resolve(__dirname, '..');
const reportDir = process.env.LAUNCHER_SCENE_NAV_QA_OUT ||
  'D:/Codex_QA/launcher-scene-ambience-ui-1.2.12/scene-navigation';
fs.mkdirSync(reportDir, { recursive: true });
const read = name => fs.readFileSync(path.join(sourceRoot, 'desktop', name), 'utf8');
const scenes = ['room-scene-sunny-deck', 'room-scene-sunny-kitchen', 'room-scene-sunny-library',
  'room-scene-sunny-workshop', 'room-scene-sunny-aquarium'];
const owned = [...scenes, 'room-furniture-tool-bench', 'room-furniture-piano',
  'room-character-franky', 'room-character-robin'];
const db = new PGlite();
let serial = Promise.resolve();
const pool = {
  query: (...args) => db.query(...args),
  async connect() {
    const before = serial;
    let release;
    serial = new Promise(resolve => { release = resolve; });
    await before;
    return { query: (...args) => db.query(...args), release };
  }
};
const capability = { crewContentRevision: 1 };
const results = [];
const errors = [];
function check(name, condition, detail) {
  assert.ok(condition, `${name}: ${JSON.stringify(detail)}`);
  results.push(name);
}
async function currentProfile(secret = 'owner') {
  const result = await shop.getLauncherProfile(pool, secret, 1, null, capability);
  assert.equal(result.ok, true, result.error);
  return result.profile;
}
async function savedRoom() {
  const result = await db.query('SELECT stats FROM player_profiles WHERE user_id=1');
  return result.rows[0].stats.launcherRoomsV2;
}
async function makePage(browser, width, account = 'owner') {
  const page = await browser.newPage({ viewport: { width, height: width < 600 ? 844 : 900 },
    reducedMotion: 'reduce' });
  page.on('pageerror', error => errors.push(error.stack || error.message));
  const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZnwAAAABJRU5ErkJggg==', 'base64');
  await page.route('opui://**', route => {
    const relative = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const file = path.resolve(sourceRoot, 'public', relative);
    return file.startsWith(path.join(sourceRoot, 'public') + path.sep) && fs.existsSync(file)
      ? route.fulfill({ path: file })
      : route.fulfill({ status: 200, contentType: 'image/png', body: tinyPng });
  });
  await page.exposeFunction('__qaGetShop', () => shop.getLauncherShop(pool, 'owner', false, capability));
  await page.exposeFunction('__qaSaveRoom', room => shop.setLauncherRoom(pool, 'owner', room, capability));
  const html = read('launcher.html')
    .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '')
    .replace(/<link[^>]+rel="stylesheet"[^>]*>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace('<body data-stage="boot">', '<body data-stage="app">')
    .replace('<main class="launcher-app screen" id="launcherApp" hidden>',
      '<main class="launcher-app screen is-active" id="launcherApp">');
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  const css = ['launcher.css', 'launcher-profile-shop.css', 'launcher-room.css',
    'launcher-room-ambience.css'].filter(file => fs.existsSync(path.join(sourceRoot, 'desktop', file)));
  await page.addStyleTag({ content: css.map(read).join('\n') });
  await page.evaluate(() => {
    window.__LAUNCHER_ROOM_QA__ = true;
    window.__sceneQa = { deferShop: true, holdNextSave: false, resumeSave: null, saves: [] };
    window.onePieceDesktop = {
      getLauncherShop: () => window.__sceneQa.deferShop
        ? new Promise(resolve => { window.__sceneQa.resolveShop = async () => resolve(await window.__qaGetShop()); })
        : window.__qaGetShop(),
      saveLauncherRoom: room => {
        window.__sceneQa.saves.push(structuredClone(room));
        if (!window.__sceneQa.holdNextSave) return window.__qaSaveRoom(room);
        window.__sceneQa.holdNextSave = false;
        return new Promise(resolve => { window.__sceneQa.resumeSave = async () => resolve(await window.__qaSaveRoom(room)); });
      }
    };
    document.getElementById('bootScreen').hidden = true;
    document.getElementById('profilePanel').hidden = false;
  });
  for (const file of ['launcher-reserved-crew.js', 'launcher-room-dialogue.js',
    'launcher-room-motion-data.js', 'launcher-room-motion.js', 'launcher-room-ambience.js',
    'launcher-room.js']) {
    if (fs.existsSync(path.join(sourceRoot, 'desktop', file)))
      await page.addScriptTag({ content: read(file) });
  }
  const profile = await currentProfile(account);
  await page.evaluate(profile => LauncherRoom.setProfile(profile, { accountId: 1 }), profile);
  return page;
}

async function main() {
  await db.exec(`CREATE TABLE player_profiles (
    user_id INTEGER PRIMARY KEY, secret TEXT UNIQUE, name TEXT, avatar TEXT,
    stats JSONB, updated_at TIMESTAMPTZ DEFAULT now()
  )`);
  await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',
    [1, 'owner', '測試船長', '8', JSON.stringify({
      client: { social: { friends: [2] } }, launcherOwnedV1: { items: owned },
      launcherRoomV1: { revision: 1, capacityVersion: 2, sceneId: 'room-scene-default',
        placements: [], characters: [] }
    })]);
  await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',
    [2, 'friend', '參觀好友', '8', JSON.stringify({ client: { social: { friends: [1] } } })]);
  const chrome = process.env.LAUNCHER_PROFILE_QA_CHROME ||
    (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  let page;
  try {
    page = await makePage(browser, 1280);
    const owner = await currentProfile();
    check('owner projection includes purchased workshop and aquarium before shop request',
      owner.collection.launcher.items.some(item => item.id === scenes[3]) &&
      owner.collection.launcher.items.some(item => item.id === scenes[4]) &&
      !owner.collection.launcher.items.find(item => item.id === scenes[3]).key);
    check('directive control removed while auto assignment remains',
      await page.locator('#roomLifeDirective').count() === 0 &&
      await page.locator('#roomLifeAutoAssign').count() === 1);
    await page.locator('#roomEditToggle').click();
    check('editor opens before network shop response',
      await page.locator('#roomEditor').isVisible() &&
      await page.evaluate(() => typeof __sceneQa.resolveShop === 'function') &&
      await page.locator('#roomEditorItems .room-palette-item').count() >= 2);
    for (let i = 0; i < 4; i++) await page.locator('#roomSceneNext').click();
    check('workshop selected by sea-side arrows in edit mode',
      (await page.locator('#roomCaption').innerText()).includes('船匠工作間'));
    await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '佛朗基的工作台' }).click();
    const bench = page.locator('#roomObjects [data-room-key="f:room-furniture-tool-bench"]');
    check('purchased workshop furniture can be placed without second shop fetch', await bench.count() === 1);
    const beforeDrag = await bench.getAttribute('data-grid-col');
    const box = await bench.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 95, box.y + box.height / 2, { steps: 5 });
    await page.mouse.up();
    check('placed workshop furniture moves on floor grid',
      await bench.getAttribute('data-grid-col') !== beforeDrag);
    await bench.locator('.room-canvas-rotate').last().click();
    check('workshop furniture rotates on image', await bench.getAttribute('data-rotation') === '1');
    await page.getByRole('tab', { name: '夥伴' }).click();
    await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '佛朗基' }).click();
    check('workshop holds its own character',
      await page.locator('#roomCharacters [data-room-key="c:room-character-franky"]').count() === 1);
    await page.locator('#profileRoom').screenshot({ path: path.join(reportDir, 'desktop-workshop.png') });
    await page.locator('#roomSceneNext').click();
    check('aquarium opens without carrying workshop items',
      (await page.locator('#roomCaption').innerText()).includes('水族館酒吧') &&
      await page.locator('#roomObjects [data-room-key="f:room-furniture-tool-bench"]').count() === 0);
    await page.getByRole('tab', { name: '家具' }).click();
    await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '布魯克的鋼琴' }).click();
    await page.getByRole('tab', { name: '夥伴' }).click();
    await page.locator('#roomEditorItems .room-palette-item').filter({ hasText: '羅賓' }).click();
    await page.locator('#roomSave').click();
    await page.waitForFunction(() => __sceneQa.saves.length === 1 &&
      /房間已儲存|房間未儲存/.test(document.getElementById('roomStatus').textContent));
    const stored = await savedRoom();
    check('PGlite saves distinct workshop and aquarium arrangements',
      stored.activeSceneId === scenes[4] &&
      stored.scenes[scenes[3]].placements[0]?.itemId === 'room-furniture-tool-bench' &&
      stored.scenes[scenes[3]].placements[0]?.rotation === 1 &&
      stored.scenes[scenes[3]].characters[0]?.itemId === 'room-character-franky' &&
      stored.scenes[scenes[4]].placements[0]?.itemId === 'room-furniture-piano' &&
      stored.scenes[scenes[4]].characters[0]?.itemId === 'room-character-robin');
    await page.evaluate(() => __sceneQa.resolveShop());
    await page.locator('#roomCancel').click();
    await page.close();

    page = await makePage(browser, 1280);
    check('fresh page reloads aquarium furniture and character',
      (await page.locator('#roomCaption').innerText()).includes('水族館酒吧') &&
      await page.locator('#roomObjects [data-room-key="f:room-furniture-piano"]').count() === 1 &&
      await page.locator('#roomCharacters [data-room-key="c:room-character-robin"]').count() === 1);
    await page.evaluate(() => { __sceneQa.holdNextSave = true; });
    await page.locator('#roomScenePrev').click();
    check('view scene changes before slow save resolves',
      (await page.locator('#roomCaption').innerText()).includes('船匠工作間') &&
      (await savedRoom()).activeSceneId === scenes[4]);
    await page.waitForFunction(() => typeof __sceneQa.resumeSave === 'function');
    await page.locator('#roomScenePrev').click();
    check('second arrow remains responsive during first save',
      (await page.locator('#roomCaption').innerText()).includes('圖書室'));
    await page.evaluate(() => __sceneQa.resumeSave());
    await page.waitForFunction(() => !document.getElementById('roomSceneCurrent').textContent.includes('船匠工作間'));
    await page.waitForFunction(() => __sceneQa.saves.length >= 2);
    await page.waitForTimeout(250);
    check('rapid navigation serializes to final scene in database', (await savedRoom()).activeSceneId === scenes[2]);
    await page.locator('#roomSceneNext').click();
    await page.waitForFunction(() => !document.getElementById('roomStatus').textContent.includes('同步到好友'));
    check('workshop remains decorated after switching back',
      (await savedRoom()).activeSceneId === scenes[3] &&
      await page.locator('#roomObjects [data-room-key="f:room-furniture-tool-bench"]').count() === 1);
    const friend = await currentProfile('friend');
    check('friend receives active room without private scene layouts',
      friend.room.sceneId === scenes[3] && friend.room.scenes === undefined);
    await page.evaluate(profile => LauncherRoom.setProfile(profile, { accountId: 2 }), friend);
    check('visitor sees displayed workshop but cannot switch or edit',
      await page.locator('#roomScenePrev').isHidden() &&
      await page.locator('#roomSceneNext').isHidden() &&
      await page.locator('#roomEditToggle').isHidden() &&
      await page.locator('#roomObjects [data-room-key="f:room-furniture-tool-bench"]').count() === 1);
    await page.close();

    page = await makePage(browser, 390);
    const bounds = await page.evaluate(() => {
      const shell = document.querySelector('.room-stage-shell').getBoundingClientRect();
      const left = document.getElementById('roomScenePrev').getBoundingClientRect();
      const right = document.getElementById('roomSceneNext').getBoundingClientRect();
      const center = document.getElementById('roomSceneCurrent').getBoundingClientRect();
      const stage = document.getElementById('roomStage').getBoundingClientRect();
      return { shell: { left: shell.left, right: shell.right },
        left: { left: left.left, right: left.right }, right: { left: right.left, right: right.right },
        center: { left: center.left, right: center.right },
        stage: { left: stage.left, right: stage.right }, viewport: innerWidth,
        scrollWidth: document.documentElement.scrollWidth };
    });
    check('390px arrows stay inside visible sea viewport with no page overflow',
      bounds.left.left >= bounds.shell.left - 1 && bounds.right.right <= bounds.shell.right + 1 &&
      bounds.right.right <= bounds.viewport + 1 && bounds.scrollWidth <= bounds.viewport + 1, bounds);
    await page.locator('#roomSceneNext').click();
    check('390px sea-side arrow is clickable',
      (await page.locator('#roomCaption').innerText()).includes('水族館酒吧'));
    await page.locator('#roomScenePrev').click();
    await page.locator('#roomCharacters [data-room-key="c:room-character-franky"]').click();
    check('arrow overlay does not block character click',
      await page.locator('#roomCompanionPanel').isVisible());
    await page.locator('#roomCompanionClose').click();
    await page.locator('#roomEditToggle').click();
    check('390px editor opens with purchased furniture',
      await page.locator('#roomEditor').isVisible() &&
      await page.locator('#roomEditorItems .room-palette-item').count() >= 2);
    await page.locator('#profileRoom').screenshot({ path: path.join(reportDir, 'mobile-workshop.png') });
    check('no JavaScript errors', errors.length === 0, errors);
    console.log(JSON.stringify({ status: 'PASS', checks: results.length, reportDir }));
  } finally {
    if (page && !page.isClosed()) await page.close();
    await browser.close();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(async () => {
    fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify({
      status: process.exitCode ? 'FAIL' : 'PASS', checks: results, errors, generatedAt: new Date().toISOString()
    }, null, 2));
    await db.close();
  });
