'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const profileShop = require('../server/launcher-profile-shop');

const db = new PGlite();
const pool = { query: (...args) => db.query(...args), connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
const checks = [];
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name);
  checks.push({ name, status: 'PASS' });
}
const saved = async secret => (await db.query('SELECT stats FROM player_profiles WHERE secret=$1', [secret])).rows[0].stats;

async function main() {
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL, name TEXT, avatar TEXT, stats JSONB, updated_at TIMESTAMPTZ DEFAULT now())');
  const today = new Date().toISOString().slice(0, 10);
  for (const [secret, friends] of [['owner', [2]], ['visitor', [1]]]) {
    const stats = { client: { social: { friends }, totals: { coins: 71 } }, launcherWalletV1: { coins: 500, lastGrantDay: today },
      launcherOwnedV1: { items: [] }, launcherAppearanceV1: { bgmId: 'bgm-none' },
      launcherRoomV1: { revision: 4, sceneId: 'room-scene-default', capacityVersion: 2, placements: [], characters: [] } };
    await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)', [secret, '8', JSON.stringify(stats)]);
  }
  const ids = ['bgm-harbor', 'bgm-op-01', 'bgm-night-watch'];
  const cap = { crewContentRevision: 1 };
  check('unowned playlist rejected', (await profileShop.setLauncherBgmPlaylist(pool, 'owner', [ids[0]], cap)).error, 'not_owned');
  for (const id of ids) check(`purchase ${id}`, (await profileShop.changeLauncherItem(pool, 'owner', id, 'buy', cap)).ok, true);
  const before = await saved('owner');
  check('purchase does not silently set playlist', before.launcherAppearanceV1.bgmId, 'bgm-none');
  check('duplicate selection rejected', (await profileShop.setLauncherBgmPlaylist(pool, 'owner', [ids[0], ids[0]], cap)).error, 'invalid_bgm_playlist');
  check('forged unowned selection rejected', (await profileShop.setLauncherBgmPlaylist(pool, 'owner', [ids[0], 'bgm-voyage'], cap)).error, 'not_owned');
  check('invalid selection preserves save', await saved('owner'), before);
  const selected = await profileShop.setLauncherBgmPlaylist(pool, 'owner', ids, cap);
  check('owned playlist saves in selected order', [selected.ok, selected.profile.appearance.bgmIds, selected.profile.appearance.bgmId], [true, ids, ids[0]]);
  check('public playlist resolves each owned audio asset', selected.profile.appearanceItems.bgms.map(item => item.id), ids);
  check('shop reflects selection', selected.shop.equipped.bgmIds, ids);
  check('authoritative save stores list', (await saved('owner')).launcherAppearanceV1.bgmIds, ids);
  check('selection has no extra charge', (await saved('owner')).launcherWalletV1.coins, before.launcherWalletV1.coins);
  const visited = await profileShop.getLauncherProfile(pool, 'visitor', 1, null, cap);
  check('friend reads owner playlist in order', [visited.profile.isSelf, visited.profile.appearance.bgmIds, visited.profile.appearanceItems.bgms.map(item => item.id)], [false, ids, ids]);
  check('visitor own appearance remains silent', (await saved('visitor')).launcherAppearanceV1.bgmId, 'bgm-none');
  const empty = await profileShop.setLauncherBgmPlaylist(pool, 'owner', [], cap);
  check('empty selection disables music but keeps ownership', [empty.profile.appearance.bgmId, empty.profile.appearance.bgmIds, empty.shop.owned.bgms.sort()], ['bgm-none', [], [...ids].sort()]);
  check('legacy single-song equip still works', (await profileShop.changeLauncherItem(pool, 'owner', ids[1], 'equip', cap)).profile.appearance.bgmIds, [ids[1]]);
  await db.query('UPDATE player_profiles SET stats=jsonb_set(stats,\'{launcherAppearanceV1}\',\'{"bgmId":"bgm-harbor"}\'::jsonb) WHERE secret=\'owner\'');
  check('old saved single song migrates in read projection', (await profileShop.getLauncherProfile(pool, 'owner', 0, null, cap)).profile.appearance.bgmIds, [ids[0]]);
  check('game currency and room revision untouched', [(await saved('owner')).client.totals.coins, (await saved('owner')).launcherRoomV1.revision], [71, 4]);
  const report = { status: 'PASS', kind: 'isolated-PGlite-launcher-bgm-playlist', checks, checkCount: checks.length, productionDataTouched: false };
  const arg = process.argv.indexOf('--report');
  if (arg >= 0) fs.writeFileSync(process.argv[arg + 1], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, checkCount: report.checkCount }));
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; }).finally(() => db.close());
