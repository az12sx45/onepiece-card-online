'use strict';
// Real launcher room HTML/CSS/JS and local artwork in Chromium. Only the
// authenticated IPC and persistence replies are fixtures; server transactions
// are covered by launcher_life_server_qa.js and launcher_aquarium_management_qa.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.LAUNCHER_AQUARIUM_QA_OUT || 'D:/Codex_QA/launcher-aquarium-r13/browser');
const runtime = path.join(process.env.LOCALAPPDATA || '', 'OpenAI/Codex/runtimes/cua_node');
const playwright = process.env.BOARD_QA_PLAYWRIGHT || fs.readdirSync(runtime)
  .map(name => path.join(runtime, name, 'bin/node_modules/playwright'))
  .find(candidate => fs.existsSync(path.join(candidate, 'package.json')));
const { chromium } = require(playwright);
const { CATALOG } = require('../server/launcher-profile-shop');
const read = file => fs.readFileSync(path.join(root, 'desktop', file), 'utf8');
const styles = ['launcher.css', 'launcher-social.css', 'launcher-profile-shop.css',
  'launcher-room.css', 'launcher-room-ambience.css', 'launcher-room-aquarium.css',
  'launcher-room-minigames.css'];
const scripts = ['launcher-reserved-crew.js', 'launcher-room-dialogue.js',
  'launcher-room-motion-data.js', 'launcher-room-motion.js', 'launcher-life-data.js',
  'launcher-life-actions.js', 'launcher-life.js', 'launcher-room-minigames.js',
  'launcher-life-room.js', 'launcher-room-ambience.js', 'launcher-room-aquarium.js',
  'launcher-room.js'];
const checks = [], errors = [], missing = [];
const pass = (name, result) => { assert(result, name); checks.push(name); console.log('PASS ' + name); };
const clone = value => JSON.parse(JSON.stringify(value));
const saleInViewport = () => page.locator('#roomAquariumManager').evaluate(node => {
  const sale = node.querySelector('.room-aquarium-manager-sell').getBoundingClientRect();
  const detail = node.querySelector('.room-aquarium-manager-detail').getBoundingClientRect();
  const card = node.querySelector('.room-aquarium-manager-card').getBoundingClientRect();
  return sale.height > 20 && sale.top >= detail.top && sale.bottom <= detail.bottom &&
    sale.top >= card.top && sale.bottom <= card.bottom && sale.bottom <= innerHeight;
});
const html = read('launcher.html')
  .replace(/<meta[^>]+Content-Security-Policy[^>]+>/i, '')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<link[^>]+>/g, '')
  .replace('<body data-stage="boot">', '<body data-stage="app">')
  .replace('<main class="launcher-app screen" id="launcherApp" hidden>',
    '<main class="launcher-app screen is-active" id="launcherApp">');
let browser, page;
async function main() {
  fs.mkdirSync(out, { recursive: true });
  browser = await chromium.launch({ headless: true,
    executablePath: process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  page = await browser.newPage({ viewport: { width: 1366, height: 980 } });
  page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.route('opui://**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
    const file = path.resolve(root, 'public', rel);
    if (file.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(file))
      return route.fulfill({ path: file });
    missing.push(rel); return route.fulfill({ status: 404, body: 'Missing local artwork' });
  });
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  await page.addStyleTag({ content: styles.map(read).join('\n') });
  await page.evaluate(catalog => {
    window.__LAUNCHER_ROOM_QA__ = true;
    const item = id => catalog.find(value => value.id === id);
    const point = (col, row, width = 1, height = 1) => {
      const depth = (row + height) / 8;
      const left = 164 + (28 - 164) * depth;
      const right = 796 + (932 - 796) * depth;
      return { x: left + (right - left) * (col + width / 2) / 16, y: 267 + 248 * depth };
    };
    const tank = { itemId: 'room-furniture-aquarium-tank', ...point(3, 3, 3, 2), rotation: 0, scale: 1 };
    const luffy = { itemId: 'room-character-luffy', ...point(11, 5) };
    const owned = ['room-character-luffy', 'room-character-sanji'];
    const f = window.__aquariumFixture = {
      calls: [], wallet: { coins: 100, cap: 500 }, rod: { level: 0, maxLevel: 3, nextCost: 20 },
      life: { schemaVersion: 1, revision: 1, ownedCharacterIds: owned, activeCharacterIds: [luffy.itemId],
        characters: { [luffy.itemId]: { itemId: luffy.itemId, key: 'luffy',
          needs: { energy: 85, hunger: 20, mood: 70, social: 70, workMotivation: 70 }, memories: [] } },
        jobs: [], pendingArrivals: [], directive: 'free_day', pairs: {}, recentEvents: [],
        fishCollection: [
          { id: 'fish-balloon', speciesId: 'balloon-catfish', caughtAt: '2026-10-04T01:00:00Z', inAquarium: true },
          { id: 'fish-jelly', speciesId: 'smile-jellyfish', caughtAt: '2026-10-04T02:00:00Z', inAquarium: false }
        ] },
      profile: null, shop: null
    };
    f.offers = () => f.life.fishCollection.map(fish => ({
      fishId: fish.id, speciesId: fish.speciesId,
      label: fish.speciesId === 'balloon-catfish' ? '氣球鯰魚' : '微笑水母',
      rarity: 'common', saleCoins: 4, cookable: fish.speciesId === 'balloon-catfish',
      dishLabel: fish.speciesId === 'balloon-catfish' ? '香吉士特製・香草鯰魚湯' : null,
      affinityGain: fish.speciesId === 'balloon-catfish' ? 2 : 0
    }));
    f.setRoom = (scene = 'sunny-aquarium', withFurniture = false) => {
      const placements = withFurniture ? [tank] : [];
      const room = { revision: (f.profile?.room?.revision || 0) + 1, capacityVersion: 2,
        sceneId: 'room-scene-' + scene, placements, characters: [luffy] };
      f.profile = { userId: 42, isSelf: true, name: '水族箱驗收', room,
        life: structuredClone(f.life),
        releasedCharacterIds: owned,
        collection: { launcher: { itemIds: [...owned, tank.itemId, 'room-scene-sunny-aquarium'] } },
        roomItems: { scene: item(room.sceneId), placements: placements.map(entry => ({ ...entry, item: item(entry.itemId) })),
          characters: [{ ...luffy, item: item(luffy.itemId) }] },
        companions: [{ itemId: luffy.itemId, affinity: 28, talksRemainingToday: 6 },
          { itemId: owned[1], affinity: 45, talksRemainingToday: 6 }] };
      window.LauncherRoom.setProfile(structuredClone(f.profile), { accountId: 42 });
      window.LauncherRoom.onVisible('profile');
    };
    f.shop = { catalog, wallet: f.wallet, owned: { roomScenes: ['room-scene-sunny-aquarium'],
      roomFurniture: [tank.itemId], roomCharacters: owned } };
    function response(extra = {}) { return structuredClone({ ok: true, serverNow: new Date().toISOString(),
      profile: f.profile, room: f.profile.room, life: f.life, wallet: f.wallet, rod: f.rod,
      fishOffers: f.offers(), ...extra }); }
    window.onePieceDesktop = {
      getLauncherLife: async () => response(),
      getLauncherShop: async () => ({ ok: true, shop: structuredClone(f.shop) }),
      getLauncherCharacter: async id => ({ ok: true, character: f.profile.companions.find(c => c.itemId === id) }),
      commandLauncherLife: async command => {
        // Match the allowlist in the currently installed Electron core. A
        // renderer-only fixture must not silently accept newer command types.
        const allowed = ['work.reserve','work.activate','work.complete','work.cancel','directive.set',
          'character.interact','event.record','activity.record','arrival.ack','checkpoint',
          'minigame.start','minigame.answer','minigame.finish','minigame.cancel','minigame.retry',
          'fish.place','fish.release'];
        if (!allowed.includes(command.type)) return { ok: false, error: 'invalid_command' };
        f.calls.push(structuredClone(command));
        const { type, payload } = command;
        if (command.expectedRevision !== f.life.revision) return response({ ok: false, error: 'revision_conflict' });
        const action = type === 'fish.release' ? ({ cook: 'fish.cook', sell: 'fish.sell',
          upgrade_rod: 'rod.upgrade' })[payload.disposition] || type : type;
        const fish = f.life.fishCollection.find(entry => entry.id === payload.fishId);
        if (action.startsWith('fish.') && !fish) return response({ ok: false, error: 'fish_not_owned' });
        let extra = {};
        if (action === 'fish.place') fish.inAquarium = payload.inAquarium;
        else if (action === 'fish.cook') {
          if (fish.speciesId !== 'balloon-catfish') return response({ ok: false, error: 'fish_not_cookable' });
          const companion = f.profile.companions.find(entry => entry.itemId === payload.recipientId);
          if (!companion || companion.affinity >= 100) return response({ ok: false, error: 'affinity_full' });
          companion.affinity += 2;
          f.life.fishCollection = f.life.fishCollection.filter(entry => entry !== fish);
          extra.meal = { fishId: fish.id, speciesId: fish.speciesId, itemId: payload.recipientId,
            dishLabel: '香吉士特製・香草鯰魚湯', affinityGained: 2, affinityAfter: companion.affinity };
        } else if (action === 'fish.sell') {
          if (f.wallet.coins + 4 > f.wallet.cap) return response({ ok: false, error: 'wallet_full' });
          f.wallet.coins += 4;
          f.life.fishCollection = f.life.fishCollection.filter(entry => entry !== fish);
          extra.sale = { fishId: fish.id, speciesId: fish.speciesId, amount: 4 };
        } else if (action === 'rod.upgrade') {
          if (f.rod.nextCost == null || f.wallet.coins < f.rod.nextCost)
            return response({ ok: false, error: 'insufficient_coins' });
          f.wallet.coins -= f.rod.nextCost;
          f.rod.level++;
          f.rod.nextCost = [20, 35, 55][f.rod.level] ?? null;
        }
        f.life.revision++;
        f.profile.life = structuredClone(f.life);
        return response(extra);
      }
    };
    window.LauncherProfileShop = { onCompanionWalletChanged() {} };
    document.getElementById('bootScreen').hidden = true;
    document.body.dataset.stage = 'app';
    document.getElementById('profilePanel').hidden = false;
    document.getElementById('libraryPanel').hidden = true;
  }, CATALOG);
  for (const file of scripts) await page.addScriptTag({ content: read(file) });
  await page.evaluate(() => window.__aquariumFixture.setRoom());
  await page.waitForFunction(() => !!window.__launcherRoomTest?.snapshot()?.life);
  const scene = page.locator('.room-aquarium-scene-window');
  await scene.scrollIntoViewIfNeeded();
  await scene.focus(); await scene.press('Enter');
  pass('keyboard Enter on scene glass opens management', await page.locator('#roomAquariumManager').isVisible());
  await page.locator('.room-aquarium-manager-close').click();
  await scene.focus(); await scene.press('Space');
  pass('keyboard Space on scene glass opens management', await page.locator('#roomAquariumManager').isVisible());
  await page.locator('.room-aquarium-manager-close').click();
  await scene.click({ position: { x: 180, y: 65 } });
  pass('clicking scene glass opens full fish management', await page.locator('#roomAquariumManager').isVisible());
  pass('list includes fish not displayed in aquarium', await page.locator('.room-aquarium-manager-fish').count() === 2);
  pass('Sanji offer and recipient owned outside this room are available',
    await page.locator('.room-aquarium-manager-recipient select option').count() === 2);
  pass('desktop displays sale control without detail scrolling', await saleInViewport());
  await page.locator('#roomAquariumManager').screenshot({ path: path.join(out, 'aquarium-desktop.png') });
  await page.locator('.room-aquarium-manager-fish[data-fish-id="fish-jelly"]').click();
  pass('uncookable fish explains why there is no cook action',
    (await page.locator('.room-aquarium-manager-action').first().textContent()).includes('不適合料理') &&
    await page.locator('.room-aquarium-manager-primary').count() === 0);
  await page.locator('.room-aquarium-manager-display').click();
  pass('placing a fish updates displayed count through real room renderer',
    await page.locator('#roomStage').getAttribute('data-aquarium-fish-count') === '2');
  await page.locator('.room-aquarium-manager-fish[data-fish-id="fish-balloon"]').click();
  await page.locator('.room-aquarium-manager-recipient select').selectOption('room-character-sanji');
  await page.locator('.room-aquarium-manager-primary').click();
  pass('first cook click requests confirmation and retains keyboard focus',
    await page.locator('.room-aquarium-manager-primary').textContent() === '確定料理並送出' &&
    await page.evaluate(() => document.activeElement?.classList.contains('room-aquarium-manager-primary')));
  await page.locator('.room-aquarium-manager-primary').click();
  await page.waitForFunction(() => window.__aquariumFixture.life.fishCollection.length === 1);
  pass('cook consumes exactly one fish and raises selected Sanji affinity',
    await page.evaluate(() => window.__aquariumFixture.profile.companions.find(c => c.itemId === 'room-character-sanji').affinity) === 47);
  pass('cooked displayed fish immediately leaves aquarium',
    await page.locator('#roomStage').getAttribute('data-aquarium-fish-count') === '1');
  await page.locator('.room-aquarium-manager-sell').click();
  await page.locator('.room-aquarium-manager-sell').click();
  await page.waitForFunction(() => window.__aquariumFixture.life.fishCollection.length === 0);
  pass('selling last fish raises wallet and leaves upgrade button visible',
    await page.evaluate(() => window.__aquariumFixture.wallet.coins) === 104 &&
    await page.locator('.room-aquarium-manager-upgrade').isVisible());
  pass('sold displayed fish immediately leaves aquarium',
    await page.locator('#roomStage').getAttribute('data-aquarium-fish-count') === '0');
  await page.locator('.room-aquarium-manager-upgrade').click();
  await page.locator('.room-aquarium-manager-upgrade').click();
  await page.waitForFunction(() => window.__aquariumFixture.rod.level === 1);
  pass('same wallet pays Franky rod upgrade in aquarium',
    await page.evaluate(() => window.__aquariumFixture.wallet.coins === 84 && window.__aquariumFixture.rod.level === 1));
  pass('cook sell and upgrade cross the installed core allowlist with exact dispositions',
    await page.evaluate(() => {
      const commands = window.__aquariumFixture.calls.filter(c => c.type === 'fish.release');
      return commands.length === 3 && commands.every(c => !!c.requestId && Number.isInteger(c.expectedRevision)) &&
        commands.some(c => c.payload.fishId === 'fish-balloon' && c.payload.disposition === 'cook' && c.payload.recipientId === 'room-character-sanji') &&
        commands.some(c => c.payload.fishId === 'fish-jelly' && c.payload.disposition === 'sell') &&
        commands.some(c => !Object.hasOwn(c.payload, 'fishId') && c.payload.disposition === 'upgrade_rod');
    }));
  await page.locator('.room-aquarium-manager-close').click();
  await page.evaluate(() => {
    const f = window.__aquariumFixture;
    f.life.fishCollection = [{ id: 'fish-jelly-new', speciesId: 'smile-jellyfish', inAquarium: true }];
    f.profile.life = structuredClone(f.life);
    f.setRoom('default', true);
  });
  await page.waitForFunction(() => !!document.querySelector('.room-aquarium-furniture .room-object')?.naturalWidth);
  await page.locator('#roomStage').scrollIntoViewIfNeeded();
  const hit = await page.evaluate(() => {
    const node = document.querySelector('.room-aquarium-furniture'), rect = node.getBoundingClientRect();
    for (let y = rect.top + 3; y < rect.bottom - 3; y += 2)
      for (let x = rect.left + 3; x < rect.right - 3; x += 2)
        if (window.__launcherRoomTest.hitAt(x, y) === node.dataset.roomKey) return { x, y };
    return null;
  });
  pass('furniture aquarium has a painted alpha hit point', !!hit);
  await page.mouse.click(hit.x, hit.y);
  pass('clicking painted furniture aquarium opens manager', await page.locator('#roomAquariumManager').isVisible());
  await page.locator('.room-aquarium-manager-close').click();
  await page.evaluate(() => window.LauncherRoom.openEditor());
  await page.mouse.click(hit.x, hit.y);
  pass('editor click selects furniture without opening manager',
    await page.locator('#roomAquariumManager').isHidden() &&
    await page.locator('.room-aquarium-furniture').evaluate(node => node.classList.contains('is-selected')));
  await page.locator('#roomCancel').click();
  const furniture = page.locator('.room-aquarium-furniture');
  await furniture.focus(); await furniture.press('Enter');
  pass('keyboard Enter on furniture opens manager', await page.locator('#roomAquariumManager').isVisible());
  await page.locator('.room-aquarium-manager-close').press('Escape');
  pass('Escape closes manager', await page.locator('#roomAquariumManager').isHidden());
  pass('assignment starts before aquarium click',
    await page.evaluate(() => window.LauncherRoom.beginAssignment('room-character-luffy')));
  await page.mouse.click(hit.x, hit.y);
  pass('assignment click on tank does not open fish manager', await page.locator('#roomAquariumManager').isHidden());
  await page.evaluate(() => window.LauncherRoom.beginAssignment('room-character-luffy'));
  await page.keyboard.press('Escape');
  await page.setViewportSize({ width: 960, height: 640 });
  await furniture.focus(); await furniture.press('Space');
  pass('960 by 640 desktop viewport keeps controls in view',
    await page.locator('#roomAquariumManager').evaluate(node => {
      const card = node.querySelector('.room-aquarium-manager-card').getBoundingClientRect();
      return card.left >= 0 && card.right <= innerWidth && card.top >= 0 && card.bottom <= innerHeight;
    }));
  pass('short desktop displays sale control without detail scrolling', await saleInViewport());
  await page.locator('#roomAquariumManager').screenshot({ path: path.join(out, 'aquarium-960x640.png') });
  await page.setViewportSize({ width: 390, height: 844 });
  pass('narrow viewport keeps management and sale reachable without horizontal overflow',
    await page.locator('#roomAquariumManager').evaluate(node => {
      const card = node.querySelector('.room-aquarium-manager-card');
      const box = card.getBoundingClientRect();
      const body = node.querySelector('.room-aquarium-manager-body');
      return box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight &&
        card.scrollWidth <= card.clientWidth && body.scrollWidth <= body.clientWidth &&
        !!node.querySelector('.room-aquarium-manager-sell');
    }));
  await page.locator('#roomAquariumManager').screenshot({ path: path.join(out, 'aquarium-390x844.png') });
  await page.setViewportSize({ width: 960, height: 640 });
  await page.locator('.room-aquarium-manager-close').click();
  await page.evaluate(() => {
    const f = window.__aquariumFixture;
    f.profile.isSelf = false;
    f.profile.life.fishCollection = f.life.fishCollection.filter(entry => entry.inAquarium);
    window.LauncherRoom.setProfile(structuredClone(f.profile), { accountId: 99 });
    window.LauncherRoom.onVisible('profile');
  });
  await page.locator('.room-aquarium-furniture').focus();
  await page.locator('.room-aquarium-furniture').press('Enter');
  pass('friend can inspect tank but cannot manage or see owner wallet',
    await page.locator('#roomAquariumManager').isVisible() &&
    await page.locator('.room-aquarium-manager-primary,.room-aquarium-manager-sell,.room-aquarium-manager-upgrade').count() === 0 &&
    !(await page.locator('.room-aquarium-manager-stats').textContent()).includes('金幣'));
  pass('visitor does not get fabricated rarity badge', await page.locator('.room-aquarium-manager-rarity').count() === 0);
  pass('no page script errors or missing fish artwork', errors.length === 0 && !missing.some(name => name.includes('/fish_')));
  const report = { status: 'PASS', checks, pageErrors: errors, missingArtwork: [...new Set(missing)],
    screenshots: ['aquarium-desktop.png', 'aquarium-960x640.png', 'aquarium-390x844.png'],
    scope: 'Real Chromium room DOM, CSS, alpha hit testing and local fish artwork; authenticated account and server effects are isolated IPC fixtures.' };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checks: checks.length, out }));
}
main().catch(async error => {
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'failure.json'), JSON.stringify({ error: error.stack, checks, errors, missing }, null, 2));
  await page?.screenshot({ path: path.join(out, 'failure.png'), fullPage: true }).catch(() => {});
  console.error(error); process.exitCode = 1;
}).finally(() => browser?.close());
