'use strict';
// Isolated 1.2.15 shop/room/notice regression. Never touches real accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const releaseConfig = require('../config/launcher-crew-release-v1.json');
const announcementsConfig = require('../config/launcher-announcements-v1.json');
const { validateConfig } = require('../server/launcher-announcements');
const crew = require('../server/launcher-crew-release');
const shop = require('../server/launcher-profile-shop');
const reserved = require('../desktop/launcher-reserved-crew');
const future = require('../tools/launcher-room/reserved-v3/roster.json');
const previews = require('../tools/launcher-room/reserved-v3/preview-manifest.json');

const root = path.resolve(__dirname, '..');
const cap = { crewContentRevision: 1 };
const checks = [];
const id = key => 'room-character-' + key;
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const eq = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
const yes = (name, actual) => { assert.ok(actual, name); checks.push(name); };

async function main() {
  eq('shipping release flags', releaseConfig.characters, { ace: true, sabo: true, law: true, hancock: false });
  yes('roster revision advanced', releaseConfig.rosterRevision >= 3);
  eq('capable release metadata', crew.metadata(cap).releasedCharacterIds.filter(value =>
    ['ace','sabo','law','hancock'].includes(value.slice(15))), [id('ace'), id('sabo'), id('law')]);
  eq('legacy release metadata', crew.metadata().releasedCharacterIds.length, 10);
  for (const key of ['sabo','law']) {
    eq(key + ' server release guard', crew.accessError(cap, id(key)), null);
    yes(key + ' role does not claim Straw Hat membership', !/草帽.*船員|草帽.*船醫/.test(reserved.profiles[key].role));
  }
  eq('Hancock remains release gated', crew.accessError(cap, id('hancock')), 'character_not_released');
  const catalogIds = shop.CATALOG.filter(item => item.type === 'room_character').map(item => item.id);
  eq('catalog has exactly thirteen available characters', catalogIds.length, 13);
  for (const key of ['ace','sabo','law']) yes(key + ' is in store catalog', catalogIds.includes(id(key)));
  eq('Hancock absent from catalog', catalogIds.includes(id('hancock')), false);
  eq('ten future character previews stay locked', Object.keys(future.characters).length, 10);
  eq('preview manifest matches current roster bytes', previews.rosterSha256,
    sha(fs.readFileSync(path.join(root, 'tools/launcher-room/reserved-v3/roster.json'))));
  for (const [key, entry] of Object.entries(future.characters)) {
    eq(key + ' lock flags', [entry.locked, entry.runtimeEligible, entry.availableForPurchase], [true, false, false]);
    eq(key + ' absent from catalog', catalogIds.includes(id(key)), false);
    eq(key + ' preview is art only', [previews.previews[key].releaseStatus, previews.previews[key].runtimeAnimationComplete],
      ['locked-art-preview-only', false]);
  }

  validateConfig(announcementsConfig);
  const notice = announcementsConfig.announcements.find(item => item.id === 'launcher-1.2.15-fishing-and-living-seas');
  yes('1.2.15 notice exists', notice);
  eq('notice bound to launcher release', notice.requiredRelease, { kind: 'launcher', version: '1.2.15' });
  yes('notice names both released guests', notice.body.some(line => line.includes('薩波與羅')));
  yes('notice illustration exists', fs.existsSync(path.join(root, 'public', notice.image.asset)));

  const db = new PGlite();
  const pool = { query: (...args) => db.query(...args),
    connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
  try {
    await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
    for (const key of ['sabo','law','hancock','vivi']) {
      await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',
        ['qa-' + key, '8', JSON.stringify({ launcherWalletV1: { coins: 100, lastGrantDay: new Date().toISOString().slice(0, 10) } })]);
    }
    for (const key of ['sabo','law']) {
      const product = shop.CATALOG.find(item => item.id === id(key));
      yes(key + ' shop metadata has transparent portrait', /^opui:\/\/launcher\/images\/launcher_room\/reserved_v1\//.test(product.asset));
      const bought = await shop.changeLauncherItem(pool, 'qa-' + key, id(key), 'buy', cap);
      eq(key + ' purchase succeeds', bought.ok, true);
      eq(key + ' purchase charges listed price', bought.shop.wallet.coins, 100 - product.price);
      yes(key + ' ownership returned', bought.shop.owned.roomCharacters.includes(id(key)));
      yes(key + ' auto placed in room', bought.profile.room.characters.some(value => value.itemId === id(key)));
      yes(key + ' arrival returned', bought.life.pendingArrivals.some(value => value.itemId === id(key)));
      const room = bought.profile.room;
      const saved = await shop.setLauncherRoom(pool, 'qa-' + key, room, cap);
      eq(key + ' room save succeeds', saved.ok, true);
      const reloaded = await shop.getLauncherProfile(pool, 'qa-' + key, 0, null, cap);
      yes(key + ' remains placed after reload', reloaded.profile.room.characters.some(value => value.itemId === id(key)));
      eq(key + ' repeat purchase rejected', (await shop.changeLauncherItem(pool, 'qa-' + key, id(key), 'buy', cap)).error, 'already_owned');
    }
    eq('Hancock purchase rejected', (await shop.changeLauncherItem(pool, 'qa-hancock', id('hancock'), 'buy', cap)).error,
      'character_not_released');
    const futureKey = Object.keys(future.characters)[0];
    eq('future character purchase rejected', (await shop.changeLauncherItem(pool, 'qa-vivi', id(futureKey), 'buy', cap)).ok, false);
    const profile = await shop.getLauncherProfile(pool, 'qa-vivi', 0, null, cap);
    const invalidRoom = { ...profile.profile.room, characters: [{ itemId: id(futureKey), x: 360, y: 420 }] };
    eq('future character cannot be placed', (await shop.setLauncherRoom(pool, 'qa-vivi', invalidRoom, cap)).ok, false);
    const blockedRoom = { ...profile.profile.room, characters: [{ itemId: id('hancock'), x: 360, y: 420 }] };
    eq('Hancock cannot be placed', (await shop.setLauncherRoom(pool, 'qa-vivi', blockedRoom, cap)).error,
      'character_not_released');
  } finally { await db.close(); }
  const result = { status: 'PASS', kind: 'isolated-in-memory-PGlite-release-QA', checks: checks.length,
    limitations: ['No public server, real account, human play, or physical device tested.'],
    rosterSha256: previews.rosterSha256, noticeId: notice.id };
  const index = process.argv.indexOf('--report');
  if (index >= 0) fs.writeFileSync(process.argv[index + 1], JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify(result));
}

main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
