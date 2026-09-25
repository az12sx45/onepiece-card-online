'use strict';

// Disposable PostgreSQL engine: exercises the production UPSERT expression
// against stale Card snapshots, social writes, and the launcher wallet.
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { PROFILE_STATS_SQL } = require('../server/board-art-collection');
const { changeLauncherItem, getLauncherShop, setLauncherCard, setLauncherRoom, sanitizeLauncherStatsPatch } = require('../server/launcher-profile-shop');
const { updateProfileSocial } = require('../server/profile-social-stats');

const db = new PGlite();
const pool = {
  query: (...args) => db.query(...args),
  async connect() { return { query: (...args) => db.query(...args), release() {} }; }
};
const updateSql = `INSERT INTO player_profiles(secret, name, avatar, stats)
  VALUES ($1, $2, $3, $4::jsonb)
  ON CONFLICT(secret) DO UPDATE SET stats = ${PROFILE_STATS_SQL}
  RETURNING user_id, avatar, stats`;
const patch = async (secret, stats) => (await db.query(updateSql, [secret, 'QA 玩家', '8', JSON.stringify(stats)])).rows[0];
const profile = async secret => (await db.query('SELECT user_id, avatar, stats FROM player_profiles WHERE secret=$1', [secret])).rows[0];
const sorted = values => [...values].sort((a, b) => String(a).localeCompare(String(b)));

(async () => {
  try {
    await db.exec(`CREATE TABLE player_profiles (
      user_id SERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL, name TEXT, avatar TEXT,
      stats JSONB, updated_at TIMESTAMPTZ DEFAULT now()
    )`);
    const stale = {
      client: {
        totals: { games: 3, wins: 1, coins: 12 },
        shop: { ownedAvatars: [], ownedWalls: [], ownedFlags: [], ownedItems: [] },
        titles: { equipped: '船長' }
      }
    };
    await patch('stale-card', stale);
    const initialShop = await getLauncherShop(pool, 'stale-card');
    assert.equal(initialShop.shop.wallet.coins, 100); // Fixed starter grant cannot be inflated by Card coin patches.
    assert.equal(initialShop.shop.wallet.dailyGrant, 20);
    assert.match(initialShop.shop.wallet.nextGrantAt, /^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    const bought = await changeLauncherItem(pool, 'stale-card', 'ava-31', 'buy');
    assert.equal(bought.ok, true);
    assert.equal(bought.shop.wallet.coins, 95);
    assert.equal((await profile('stale-card')).stats.client.totals.coins, 12); // Legacy Card wallet is independent.
    assert.deepEqual((await patch('stale-card', stale)).stats.client.shop.ownedAvatars, [31]);
    assert.equal((await profile('stale-card')).stats.launcherWalletV1.coins, 95);
    await patch('stale-card', sanitizeLauncherStatsPatch({ launcherWalletV1: { coins: 999999, lastGrantDay: '2099-01-01' }, client: { totals: { coins: 999999 } } }));
    assert.equal((await profile('stale-card')).stats.launcherWalletV1.coins, 95);
    assert.equal((await getLauncherShop(pool, 'stale-card')).shop.wallet.coins, 95);
    assert.equal((await profile('stale-card')).stats.client.totals.coins, 999999); // Old Card behavior remains client controlled.
    await patch('stale-card', { client: { totals: { coins: 20 }, shop: { ownedAvatars: [] } } });
    assert.equal((await profile('stale-card')).stats.client.totals.coins, 20); // Legacy Card rewards still apply.
    assert.deepEqual((await profile('stale-card')).stats.client.shop.ownedAvatars, [31]);

    for (let index = 1; index <= 9; index++) {
      const id = `bgm-op-${String(index).padStart(2, '0')}`;
      assert.equal((await changeLauncherItem(pool, 'stale-card', id, 'buy')).ok, true);
    }
    assert.equal((await getLauncherShop(pool, 'stale-card')).shop.wallet.coins, 5);
    assert.equal((await changeLauncherItem(pool, 'stale-card', 'bgm-op-10', 'buy')).error, 'insufficient_coins');
    await patch('stale-card', sanitizeLauncherStatsPatch({ launcherWalletV1: { coins: 500 }, client: { totals: { coins: 999999 } } }));
    assert.equal((await getLauncherShop(pool, 'stale-card')).shop.wallet.coins, 5);
    assert.equal((await changeLauncherItem(pool, 'stale-card', 'bgm-op-10', 'buy')).error, 'insufficient_coins');
    const staleSocialStats = (await profile('stale-card')).stats;
    assert.equal((await changeLauncherItem(pool, 'stale-card', 'ava-52', 'buy')).ok, true);
    await updateProfileSocial(pool, (await profile('stale-card')).user_id, { friends: [4], friend_in: [], friend_out: [] });
    assert.equal((await profile('stale-card')).stats.launcherWalletV1.coins, 0);
    assert.ok((await profile('stale-card')).stats.launcherOwnedV1.items.includes('ava-52'));
    assert.equal((await profile('stale-card')).stats.client.totals.coins, 999999);
    assert.equal(staleSocialStats.launcherWalletV1.coins, 5); // A social snapshot predates the last purchase.
    await patch('stale-card', { client: { social: { friends: [], friend_in: [], friend_out: [] }, totals: { coins: 21 } } });
    assert.deepEqual((await profile('stale-card')).stats.client.social.friends, [4]);
    assert.equal((await profile('stale-card')).stats.launcherWalletV1.coins, 0);
    assert.ok((await profile('stale-card')).stats.launcherOwnedV1.items.includes('ava-52'));
    assert.equal((await profile('stale-card')).stats.client.totals.coins, 21);

    await patch('forged-first', { client: { totals: { coins: 999999999 } } });
    assert.equal((await getLauncherShop(pool, 'forged-first')).shop.wallet.coins, 100);
    await patch('daily', { client: { totals: { coins: 0 } } });
    assert.equal((await getLauncherShop(pool, 'daily')).shop.wallet.coins, 100);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    await db.query("UPDATE player_profiles SET stats=jsonb_set(stats, '{launcherWalletV1,lastGrantDay}', $1::jsonb, true) WHERE secret=$2", [JSON.stringify(yesterday), 'daily']);
    assert.equal((await getLauncherShop(pool, 'daily')).shop.wallet.coins, 120);
    assert.equal((await getLauncherShop(pool, 'daily')).shop.wallet.coins, 120); // One grant per UTC day.
    await db.query("UPDATE player_profiles SET stats=jsonb_set(jsonb_set(stats, '{launcherWalletV1,coins}', '495'::jsonb, true), '{launcherWalletV1,lastGrantDay}', $1::jsonb, true) WHERE secret=$2", [JSON.stringify(yesterday), 'daily']);
    assert.equal((await getLauncherShop(pool, 'daily')).shop.wallet.coins, 500); // Refill is capped.

    await patch('overlap', { client: { shop: { ownedAvatars: [31], ownedWalls: [4], ownedFlags: [4], ownedItems: ['legacy-a'] } } });
    await Promise.all([
      patch('overlap', { client: { shop: { ownedAvatars: [32], ownedWalls: [], ownedFlags: [5], ownedItems: ['legacy-b'] } } }),
      patch('overlap', { client: { shop: { ownedAvatars: [33], ownedWalls: [5], ownedFlags: [], ownedItems: ['legacy-c'] } } })
    ]);
    const owned = (await profile('overlap')).stats.client.shop;
    assert.deepEqual(sorted(owned.ownedAvatars), [31, 32, 33]);
    assert.deepEqual(sorted(owned.ownedWalls), [4, 5]);
    assert.deepEqual(sorted(owned.ownedFlags), [4, 5]);
    assert.deepEqual(sorted(owned.ownedItems), ['legacy-a', 'legacy-b', 'legacy-c']);

    await patch('overlap', { client: { shop: { ownedAvatars: [31, 31] } } });
    assert.deepEqual(sorted((await profile('overlap')).stats.client.shop.ownedAvatars), [31, 32, 33]);
    await patch('overlap', { unrelated: 42 });
    assert.deepEqual(sorted((await profile('overlap')).stats.client.shop.ownedAvatars), [31, 32, 33]);
    assert.equal((await profile('overlap')).stats.unrelated, 42);
    await patch('overlap', { boardArtCollectionV1: { 'chest:wood:1': 100 } });
    await patch('overlap', { boardArtCollectionV1: { 'chest:wood:1': 80, 'impel:key:2': 90 } });
    assert.deepEqual((await profile('overlap')).stats.boardArtCollectionV1, { 'chest:wood:1': 80, 'impel:key:2': 90 });

    await db.query(`INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,'QA 玩家','8',$2::jsonb)`,
      ['protected', JSON.stringify({ launcherOwnedV1: { items: ['guestbook-1'] }, launcherAppearanceV1: { layoutId: 'layout-grand-line' }, client: { totals: { coins: 5 } } })]);
    await patch('protected', sanitizeLauncherStatsPatch({
      launcherOwnedV1: { items: ['bgm-voyage'] }, launcherAppearanceV1: { bgmId: 'bgm-voyage' },
      client: { totals: { coins: 8 } }
    }));
    assert.deepEqual((await profile('protected')).stats.launcherOwnedV1.items, ['guestbook-1']);
    assert.deepEqual((await profile('protected')).stats.launcherAppearanceV1, { layoutId: 'layout-grand-line' });
    assert.equal((await profile('protected')).stats.client.totals.coins, 8);

    assert.equal((await changeLauncherItem(pool, 'protected', 'room-scene-sunny-deck', 'buy')).ok, true);
    assert.equal((await changeLauncherItem(pool, 'protected', 'room-furniture-helm', 'buy')).ok, true);
    assert.equal((await changeLauncherItem(pool, 'protected', 'room-character-luffy', 'buy')).ok, true);
    const roomSaved = await setLauncherRoom(pool, 'protected', {
      revision: 0, sceneId: 'room-scene-sunny-deck',
      placements: [{ itemId: 'room-furniture-helm', x: 300, y: 210, scale: 1, flip: false }],
      characters: [{ itemId: 'room-character-luffy', x: 480, y: 420 }]
    });
    assert.equal(roomSaved.ok, true);
    assert.equal((await setLauncherCard(pool, 'protected', { displayName: '千陽號船員', tagline: '船艙歡迎你', avatarId: 31 })).error, 'not_owned');
    assert.equal((await setLauncherCard(pool, 'protected', { displayName: '千陽號船員', tagline: '船艙歡迎你', avatarId: 3 })).ok, true);
    assert.deepEqual((await profile('protected')).stats.launcherCardV1,
      { displayName: '千陽號船員', tagline: '船艙歡迎你', avatarId: 3 });
    const roomBeforePatch = (await profile('protected')).stats.launcherRoomV1;
    await patch('protected', sanitizeLauncherStatsPatch({
      launcherRoomV1: { revision: 999, sceneId: 'room-scene-default', placements: [], characters: [] },
      launcherCardV1: { displayName: '偽造名片', tagline: '', avatarId: 31 },
      client: { totals: { games: 11 } }
    }));
    assert.deepEqual((await profile('protected')).stats.launcherRoomV1, roomBeforePatch);
    assert.deepEqual((await profile('protected')).stats.launcherCardV1,
      { displayName: '千陽號船員', tagline: '船艙歡迎你', avatarId: 3 });
    assert.equal((await profile('protected')).stats.client.totals.games, 11);
    assert.equal((await setLauncherRoom(pool, 'protected', { ...roomBeforePatch, revision: 0 })).error, 'revision_conflict');
    assert.deepEqual((await profile('protected')).stats.launcherRoomV1, roomBeforePatch);

    await patch('launcher-only-avatar', { client: { totals: { coins: 200 } } });
    assert.equal((await changeLauncherItem(pool, 'launcher-only-avatar', 'ava-52', 'buy')).ok, true);
    assert.equal((await changeLauncherItem(pool, 'launcher-only-avatar', 'ava-52', 'equip')).profile.avatar, 52);
    assert.equal((await changeLauncherItem(pool, 'launcher-only-avatar', 'bgm-op-20', 'buy')).ok, true);
    assert.equal((await changeLauncherItem(pool, 'launcher-only-avatar', 'bgm-op-20', 'equip')).profile.appearance.bgmId, 'bgm-op-20');
    assert.equal((await profile('launcher-only-avatar')).avatar, '8');
    await patch('launcher-only-avatar', sanitizeLauncherStatsPatch({
      launcherOwnedV1: { items: [] }, launcherAppearanceV1: { avatarId: 1 },
      client: { totals: { coins: 170 }, shop: { ownedAvatars: [] } }
    }));
    assert.deepEqual((await profile('launcher-only-avatar')).stats.launcherOwnedV1.items, ['ava-52', 'bgm-op-20']);
    assert.equal((await profile('launcher-only-avatar')).stats.launcherAppearanceV1.avatarId, 52);
    assert.equal((await profile('launcher-only-avatar')).stats.launcherAppearanceV1.bgmId, 'bgm-op-20');
    assert.equal((await profile('launcher-only-avatar')).stats.launcherWalletV1.coins, 85);
    assert.equal((await profile('launcher-only-avatar')).avatar, '8');

    console.log('profile shop ownership SQL: stale Card patch and overlapping UPSERT ownership union passed (PGlite)');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
