'use strict';

// Real Chromium regression for lean Ace v2 and the unchanged Sanji correction.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tools/launcher-room/ace-lean-v1212/review/browser');
fs.mkdirSync(out, { recursive: true });
process.env.LAUNCHER_LIFE_INTEGRATION_OUT = out;
const helperPath = path.join(root, 'scripts/launcher_radial_fixture.js');
let source = fs.readFileSync(helperPath, 'utf8');
const replace = (before, after) => {
  assert(source.includes(before), `Missing fixture anchor: ${before}`);
  source = source.replace(before, after);
};
replace("const {CATALOG}=require(sourceRoot+'/server/launcher-profile-shop');",
  "const {CATALOG:ACTIVE}=require(sourceRoot+'/server/launcher-profile-shop');const R=require(sourceRoot+'/desktop/launcher-reserved-crew');const CATALOG=[...ACTIVE,...Object.values(R.shopMetadata).map(p=>({...p,id:p.itemId,type:'room_character',price:0}))];");
replace("const files=['launcher-room-dialogue.js'", "const files=['launcher-reserved-crew.js','launcher-room-dialogue.js'");
replace("    await page.addScriptTag({content:read(file)});",
  "    await page.addScriptTag({content:read(file)});if(file==='launcher-life.js')await page.evaluate(()=>{const original=OnePieceLife;window.OnePieceLife={...original,create:options=>({...original.create(options),tick:()=>{}})};});");
replace("  await page.evaluate(async()=>{const promises=[];for(const key of window.__integration.db[42].life.ownedCharacterIds.map(id=>id.replace('room-character-','')))for(const clip of ['work','eat','train']){const record=window.OnePieceLifeActions.preload(key,clip,'south');if(record?.promise)promises.push(record.promise);}await Promise.all(promises);});", '');
const mod = new Module(helperPath, module);
mod.filename = helperPath;
mod.paths = Module._nodeModulePaths(path.dirname(helperPath));
mod._compile(source, helperPath);
const fixture = mod.exports;
const catalog = require('../server/launcher-profile-shop').CATALOG;
const reserved = require('../desktop/launcher-reserved-crew');
const keys = ['ace', 'sabo', 'sanji', 'zoro'];
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const snapshots = [];

function state() {
  const products = [...catalog, ...Object.values(reserved.shopMetadata).map(p => ({ ...p, id: p.itemId, type: 'room_character', price: 0 }))];
  const x = [220, 400, 590, 770];
  const characters = keys.map((key, i) => ({ itemId: `room-character-${key}`, x: x[i], y: 426 }));
  const ids = characters.map(c => c.itemId);
  const releasedCharacterIds = reserved.SUPPORTED_KEYS.map(key => `room-character-${key}`);
  const life = {
    schemaVersion: 1, revision: 1, ownedCharacterIds: ids, activeCharacterIds: ids,
    characters: Object.fromEntries(keys.map(key => [`room-character-${key}`, { key, itemId: `room-character-${key}`,
      needs: { energy: 85, hunger: 20, mood: 70, social: 70, workMotivation: 70 }, memories: [] }])),
    pairs: {}, jobs: [], pendingArrivals: [], directive: 'free_day', recentEvents: [],
    offlineSummary: { elapsedMs: 0, completedJobs: 0, coins: 0 }
  };
  const room = { revision: 1, capacityVersion: 2, sceneId: 'room-scene-default', characters, placements: [] };
  const profile = {
    userId: 42, isSelf: true, name: '角色比例隔離預覽', releasedCharacterIds, rosterRevision: 2,
    life, room, collection: { launcher: { itemIds: ids } },
    roomItems: { scene: null, placements: [], characters: characters.map(c => ({ ...c, item: products.find(p => p.id === c.itemId) })) },
    companions: characters.map(c => ({ itemId: c.itemId, affinity: 12, talksRemainingToday: 6 }))
  };
  return { profile, life, wallet: { coins: 100, cap: 500 }, releasedCharacterIds, rosterRevision: 2 };
}

async function setPose(page, kind) {
  await page.evaluate(async ({ keys, kind }) => {
    for (const key of keys) {
      const node = document.querySelector(`[data-room-key="c:room-character-${key}"]`);
      if (!node) throw Error(`Missing character ${key}`);
      const canvas = node.querySelector('.room-walk-sprite');
      if (kind === 'portrait') {
        canvas.hidden = true;
        node.classList.remove('has-directional-sprite');
        node.dataset.pose = 'idle';
        node.dataset.actionSource = 'portrait';
      } else if (kind === 'walk') {
        const record = OnePieceRoomMotion.preload(key);
        await record.promise;
        if (!OnePieceRoomMotion.draw(canvas, record.atlases.south, 0)) throw Error(`Walk image failed ${key}`);
        canvas.hidden = false;
        node.classList.add('has-directional-sprite');
        node.dataset.pose = 'walk';
        node.dataset.actionSource = 'motion_v4';
      } else if (kind === 'acting') {
        const record = OnePieceRoomMotion.preloadActions(key);
        await record.promise;
        if (!OnePieceRoomMotion.draw(canvas, record.atlases.south, 1, OnePieceRoomMotion.ACTION_SHAPE)) throw Error(`Acting image failed ${key}`);
        canvas.hidden = false;
        node.classList.add('has-directional-sprite');
        node.dataset.pose = 'talk_happy';
        node.dataset.actionSource = 'acting_v4';
      } else {
        const record = OnePieceLifeActions.preload(key, 'work', 'south');
        await record.promise;
        if (!OnePieceLifeActions.draw(canvas, key, 'work', 'south', 0)) throw Error(`Work image failed ${key}`);
        canvas.hidden = false;
        node.classList.add('has-directional-sprite');
        node.dataset.pose = 'work';
        node.dataset.actionSource = 'life_v1';
      }
      node.dataset.direction = 'south';
    }
  }, { keys, kind });
}

async function capture(page, viewport, variant, kind) {
  const filename = `${viewport}-${variant}-${kind}.png`;
  await page.locator('#roomStage').screenshot({ path: path.join(out, filename) });
  const actors = await page.evaluate(() => [...document.querySelectorAll('#roomCharacters [data-room-key]')].map(node => {
    const element = node.dataset.actionSource === 'portrait' ? node.querySelector('.room-chibi') : node.querySelector('.room-walk-sprite');
    const box = element.getBoundingClientRect();
    const shell = node.getBoundingClientRect();
    return { key: node.dataset.roomKey.replace('c:room-character-', ''), pose: node.dataset.pose,
      source: node.dataset.actionSource, cssScale: getComputedStyle(element).scale,
      box: { x: box.x, y: box.y, width: box.width, height: box.height },
      shellBottom: shell.bottom, bottomDelta: box.bottom - shell.bottom };
  }));
  snapshots.push({ viewport, variant, kind, file: filename, sha256: sha(path.join(out, filename)), actors });
}

(async () => {
  const browser = await fixture.chromium.launch({ headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-web-security'] });
  fixture.setBrowser(browser);
  try {
    const f = await fixture.create({ persisted: state() });
    const page = f.page;
    try {
      const acePortrait = await page.locator('[data-room-key="c:room-character-ace"] .room-chibi').getAttribute('src');
      assert.equal(acePortrait, 'opui://launcher/images/launcher_room/reserved_v2/ace/portrait.webp',
        'Production room must actually resolve the new Ace portrait');
      await page.waitForFunction(() => document.querySelector('[data-room-key="c:room-character-ace"] .room-chibi')?.naturalWidth === 256);
      assert.equal(await page.evaluate(() => OnePieceRoomMotion.atlasUrl('ace', 'south', 'motion_v4')),
        'opui://launcher/images/launcher_room/reserved_v2/ace/walk/south.webp');
      assert.equal(await page.evaluate(() => OnePieceLifeActions.url('ace', 'work', 'south')),
        'opui://launcher/images/launcher_room/reserved_v2/ace/life/work-south.webp');
      await page.evaluate(() => document.getElementById('roomStage').scrollIntoView({ block: 'center', behavior: 'instant' }));
      const correction = await page.addStyleTag({ content: `
        .room-character-shell[data-room-key="c:room-character-ace"] :is(.room-chibi, .room-walk-sprite),
        .room-character-shell[data-room-key="c:room-character-sanji"] :is(.room-chibi, .room-walk-sprite) { scale: 1 1 !important; }
      ` });
      await correction.evaluate(node => { node.dataset.previewProportion = 'true'; node.disabled = true; });
      for (const viewport of [{ name: 'desktop', width: 1366, height: 1050 }, { name: 'mobile', width: 390, height: 844 }]) {
        await page.setViewportSize({ width: viewport.width, height: viewport.height });
        await page.evaluate(() => document.getElementById('roomStage').scrollIntoView({ block: 'center', behavior: 'instant' }));
        for (const variant of ['before', 'after']) {
          await correction.evaluate((node, enabled) => { node.disabled = !enabled; }, variant === 'before');
          for (const kind of ['portrait', 'walk', 'acting', 'work']) {
            await setPose(page, kind);
            await capture(page, viewport.name, variant, kind);
          }
        }
      }
      assert.deepEqual(f.errors, []);
      const before = snapshots.filter(s => s.variant === 'before');
      const after = snapshots.filter(s => s.variant === 'after');
      assert.equal(before.length, 8);
      assert.equal(after.length, 8);
      for (let i = 0; i < before.length; i++) {
        assert.equal(before[i].viewport, after[i].viewport);
        assert.equal(before[i].kind, after[i].kind);
        for (const key of keys) {
          const a = before[i].actors.find(c => c.key === key);
          const b = after[i].actors.find(c => c.key === key);
          assert(Math.abs(a.box.height - b.box.height) < 0.02, `${key}: vertical height changed`);
          assert(Math.abs(a.bottomDelta - b.bottomDelta) < 0.02, `${key}: foot position changed`);
          const ratio = b.box.width / a.box.width;
          const expected = key === 'sanji' ? .92 : 1;
          assert(Math.abs(ratio - expected) < .003, `${key}: horizontal ratio ${ratio}`);
        }
      }
      fs.writeFileSync(path.join(out, 'preview.json'), JSON.stringify({ status: 'PASS', release: '1.2.12', acePortrait, snapshots,
        source: path.relative(root, helperPath).replaceAll('\\', '/'),
        methods: 'Real Chrome production renderer; isolated mock profile with four owned, released, placed characters. The room DOM resolves Ace v2 portrait, motion and work URLs. Before temporarily overrides character aspect to 1; after uses production CSS. Desktop and 390px viewports; portrait, walk, acting and work.',
        humanAcceptance: false }, null, 2));
      console.log(JSON.stringify({ status: 'PASS', captures: snapshots.length, out }));
    } finally { await page.close(); }
  } finally { await browser.close(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
