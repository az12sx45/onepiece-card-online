'use strict';

const assert = require('node:assert/strict');
const Module = require('node:module');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { PROFILE_STATS_SQL } = require('../server/board-art-collection');
const {
  getLauncherProfile, getLauncherShop, changeLauncherItem, setLauncherRoom,
  getLauncherCharacter, interactLauncherCharacter, startLauncherCharacterWork,
  claimLauncherCharacterWork, sanitizeLauncherStatsPatch
} = require('../server/launcher-profile-shop');

const db = new PGlite();
const pool = {
  query: (...args) => db.query(...args),
  async connect() { return { query: (...args) => db.query(...args), release() {} }; }
};
const today = new Date().toISOString().slice(0, 10);
const at = minutes => new Date(Date.parse(`${today}T01:00:00.000Z`) + minutes * 60000);
const ids = ['room-character-luffy', 'room-character-zoro', 'room-character-nami'];
const statsFor = (coins = 100, owned = ids, placed = ids) => ({
  client: { totals: { coins: 37 }, social: { friends: [] } },
  launcherWalletV1: { coins, lastGrantDay: today },
  launcherOwnedV1: { items: owned },
  launcherRoomV1: {
    revision: 1, sceneId: 'room-scene-default', placements: [],
    characters: placed.map((itemId, index) => ({ itemId, x: 260 + index * 120, y: 420 }))
  }
});
const add = async (secret, stats) => (await db.query(
  'INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb) RETURNING user_id',
  [secret, secret, '8', JSON.stringify(stats)]
)).rows[0].user_id;
const row = async secret => (await db.query('SELECT user_id, stats FROM player_profiles WHERE secret=$1', [secret])).rows[0];

(async () => {
  try {
    await db.exec(`CREATE TABLE player_profiles (
      user_id SERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL, name TEXT, avatar TEXT,
      stats JSONB, updated_at TIMESTAMPTZ DEFAULT now()
    )`);
    const ownerId = await add('owner', statsFor());
    const friendId = await add('friend', statsFor(100, [], []));
    await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social,friends}',$1::jsonb,true) WHERE user_id=$2", [JSON.stringify([friendId]), ownerId]);
    await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social,friends}',$1::jsonb,true) WHERE user_id=$2", [JSON.stringify([ownerId]), friendId]);

    assert.equal((await getLauncherCharacter(pool, 'wrong', ids[0], at(0))).error, 'bad secret');
    assert.equal((await getLauncherCharacter(pool, 'owner', 'room-character-fake', at(0))).error, 'invalid_character');
    assert.equal((await getLauncherCharacter(pool, 'friend', ids[0], at(0))).error, 'not_owned');
    assert.equal((await getLauncherCharacter(pool, 'owner', 'room-character-usopp', at(0))).error, 'not_owned');
    const initial = await getLauncherCharacter(pool, 'owner', ids[0], at(0));
    assert.equal(initial.ok, true);
    assert.equal(initial.character.affinity, 0);
    assert.equal(initial.character.work.reward, 10);
    assert.equal(initial.character.work.state, 'idle');
    assert.equal(initial.character.work.remainingClaimsToday, 6);
    assert.equal(initial.wallet.coins, 100);

    const talked = await interactLauncherCharacter(pool, 'owner', ids[0], 'talk', at(0));
    assert.equal(talked.character.affinity, 2);
    assert.equal(talked.character.talksRemainingToday, 5);
    assert.equal((await interactLauncherCharacter(pool, 'owner', ids[0], 'talk', at(0))).error, 'talk_cooldown');
    assert.equal((await interactLauncherCharacter(pool, 'owner', ids[0], 'work', at(10))).error, 'invalid_action');
    for (let minute = 10; minute <= 50; minute += 10) {
      assert.equal((await interactLauncherCharacter(pool, 'owner', ids[0], 'talk', at(minute))).ok, true);
    }
    assert.equal((await interactLauncherCharacter(pool, 'owner', ids[0], 'talk', at(60))).error, 'talk_daily_limit');
    assert.equal((await getLauncherCharacter(pool, 'owner', ids[0], at(60))).character.affinity, 12);

    let minute = 65;
    for (const itemId of ids) {
      for (let task = 0; task < 2; task++) {
        const started = await startLauncherCharacterWork(pool, 'owner', itemId, at(minute));
        assert.equal(started.ok, true);
        assert.equal(started.character.work.state, 'working');
        assert.equal(started.character.work.readyAt, at(minute + 5).toISOString());
        assert.equal((await startLauncherCharacterWork(pool, 'owner', itemId, at(minute))).error, 'work_active');
        assert.equal((await claimLauncherCharacterWork(pool, 'owner', itemId, at(minute + 4))).error, 'work_not_ready');
        const claimed = await claimLauncherCharacterWork(pool, 'owner', itemId, at(minute + 5));
        assert.equal(claimed.ok, true);
        assert.equal(claimed.claimed, true);
        assert.equal(claimed.character.work.state, 'idle');
        assert.equal(claimed.wallet.coins, 100 + 10 * (ids.indexOf(itemId) * 2 + task + 1));
        const replay = await claimLauncherCharacterWork(pool, 'owner', itemId, at(minute + 5));
        assert.equal(replay.ok, true);
        assert.equal(replay.claimed, false);
        assert.equal(replay.wallet.coins, claimed.wallet.coins);
        minute += 6;
      }
      assert.equal((await startLauncherCharacterWork(pool, 'owner', itemId, at(minute))).error, 'work_daily_limit');
    }
    assert.equal((await getLauncherCharacter(pool, 'owner', ids[0], at(minute))).character.work.remainingClaimsToday, 0);
    assert.equal((await getLauncherShop(pool, 'owner')).shop.wallet.coins, 160);
    assert.equal((await changeLauncherItem(pool, 'owner', 'bgm-op-01', 'buy')).shop.wallet.coins, 150);
    assert.equal((await row('owner')).stats.client.totals.coins, 37);
    const friendView = await getLauncherProfile(pool, 'friend', ownerId);
    assert.equal(friendView.ok, true);
    assert.equal(friendView.profile.isSelf, false);
    assert.equal(friendView.profile.companions.length, 3);
    assert.equal(friendView.profile.companions[0].affinity, 14);
    assert.equal(friendView.profile.collection.launcher.itemIds.includes(ids[0]), true);
    assert.ok(!JSON.stringify(friendView.profile).includes('launcherCompanionsV1'));
    assert.equal((await claimLauncherCharacterWork(pool, 'friend', ids[0], at(minute))).error, 'not_owned');

    const forged = sanitizeLauncherStatsPatch({
      launcherCompanionsV1: { characters: { [ids[0]]: { affinity: 100, activeWork: { readyAt: at(0).toISOString() } } } },
      launcherWalletV1: { coins: 500 }, client: { totals: { coins: 99999 } }
    });
    assert.deepEqual(forged, { client: { totals: { coins: 99999 } } });
    await db.query(`INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)
      ON CONFLICT(secret) DO UPDATE SET stats=${PROFILE_STATS_SQL}`,
    ['owner', 'owner', '8', JSON.stringify(forged)]);
    assert.equal((await row('owner')).stats.launcherCompanionsV1.characters[ids[0]].affinity, 14);
    assert.equal((await getLauncherShop(pool, 'owner')).shop.wallet.coins, 150);

    const richStats = statsFor(495, [ids[0]], [ids[0]]);
    await add('rich', richStats);
    assert.equal((await startLauncherCharacterWork(pool, 'rich', ids[0], at(65))).ok, true);
    assert.equal((await claimLauncherCharacterWork(pool, 'rich', ids[0], at(70))).error, 'wallet_full');
    assert.equal((await row('rich')).stats.launcherWalletV1.coins, 495);
    assert.equal((await changeLauncherItem(pool, 'rich', 'ava-31', 'buy')).shop.wallet.coins, 490);
    assert.equal((await claimLauncherCharacterWork(pool, 'rich', ids[0], at(70))).wallet.coins, 500);
    const richReplay = await claimLauncherCharacterWork(pool, 'rich', ids[0], at(70));
    assert.equal(richReplay.claimed, false);
    assert.equal(richReplay.wallet.coins, 500);

    const unplacedStats = statsFor(100, [ids[0]], []);
    await add('unplaced', unplacedStats);
    assert.equal((await startLauncherCharacterWork(pool, 'unplaced', ids[0], at(0))).error, 'not_placed');
    assert.equal((await interactLauncherCharacter(pool, 'unplaced', ids[0], 'talk', at(0))).error, 'not_placed');
    const placed = await setLauncherRoom(pool, 'unplaced', { revision: 1, sceneId: 'room-scene-default', placements: [], characters: [{ itemId: ids[0], x: 300, y: 410 }] });
    assert.equal(placed.ok, true);
    assert.equal((await startLauncherCharacterWork(pool, 'unplaced', ids[0], at(0))).ok, true);

    // Yesterday's unfinished jobs reserve today's claim capacity as well.
    const reservedIds = ['luffy', 'zoro', 'nami', 'chopper', 'sanji', 'robin', 'usopp']
      .map(key => `room-character-${key}`);
    const reservedStats = statsFor(100, reservedIds, reservedIds);
    reservedStats.launcherRoomV1.characters.forEach((entry, index) => { entry.x = 100 + index * 100; });
    await add('reserved', reservedStats);
    const yesterday = new Date(Date.parse(`${today}T00:00:00.000Z`) - 86400000);
    yesterday.setUTCHours(23, 50, 0, 0);
    for (const itemId of reservedIds.slice(0, 6)) {
      assert.equal((await startLauncherCharacterWork(pool, 'reserved', itemId, yesterday)).ok, true);
    }
    assert.equal((await startLauncherCharacterWork(pool, 'reserved', reservedIds[6], yesterday)).error, 'work_daily_limit');
    const nextDay = new Date(`${today}T00:00:00.000Z`);
    assert.equal((await getLauncherCharacter(pool, 'reserved', reservedIds[6], nextDay)).character.work.remainingStartsToday, 0);
    assert.equal((await startLauncherCharacterWork(pool, 'reserved', reservedIds[6], nextDay)).error, 'work_daily_limit');
    assert.equal((await row('reserved')).stats.launcherWalletV1.coins, 120);
    assert.equal((await claimLauncherCharacterWork(pool, 'reserved', reservedIds[0], nextDay)).ok, true);
    assert.equal((await startLauncherCharacterWork(pool, 'reserved', reservedIds[6], nextDay)).error, 'work_daily_limit');

    // The desktop bridge accepts the eight canonical companions and both
    // four-way rotations and older flip-only furniture snapshots.
    const originalLoad = Module._load;
    let bridge;
    try {
      Module._load = function (request, parent, isMain) {
        if (request === 'electron') return { app: { isPackaged: false }, safeStorage: {} };
        return originalLoad.call(this, request, parent, isMain);
      };
      const { AuthService } = require('../desktop/auth-service');
      bridge = new AuthService({ origin: 'https://example.invalid', userDataPath: 'D:/Codex_QA/launcher-character-economy-qa' });
    } finally {
      Module._load = originalLoad;
    }
    bridge.launcherRequest = async (event, payload) => ({ ok: true, event, payload });
    const eightCharacters = ['luffy', 'zoro', 'nami', 'chopper', 'sanji', 'robin', 'usopp', 'jinbe']
      .map((key, index) => ({ itemId: `room-character-${key}`, x: 100 + index * 95, y: 405 }));
    const rotations = [0, 1, 2, 3].map((rotation, index) => ({
      itemId: ['room-furniture-helm', 'room-furniture-map-table', 'room-furniture-piano', 'room-furniture-tool-bench'][index],
      x: 180 + index * 170, y: 390, scale: 1, rotation, flip: rotation === 2
    }));
    const bridgeResult = await bridge.saveLauncherRoom({
      revision: 1, sceneId: 'room-scene-default', placements: rotations, characters: eightCharacters
    });
    assert.equal(bridgeResult.ok, true);
    assert.equal(bridgeResult.event, 'LAUNCHER_ROOM_SET');
    assert.equal(bridgeResult.payload.characters.length, 8);
    assert.equal(bridgeResult.payload.placements[3].rotation, 3);
    const roomSaveStats = statsFor(100,
      [...eightCharacters.map(entry => entry.itemId), ...rotations.map(entry => entry.itemId)], []);
    await add('room-save', roomSaveStats);
    const roomSaved = await setLauncherRoom(pool, 'room-save', bridgeResult.payload);
    assert.equal(roomSaved.ok, true);
    assert.equal(roomSaved.profile.room.characters.length, 8);
    assert.deepEqual(roomSaved.profile.room.placements.map(entry => entry.rotation), [0, 1, 2, 3]);
    const legacySaved = await setLauncherRoom(pool, 'room-save', {
      revision: 2, sceneId: 'room-scene-default',
      placements: [{ itemId: 'room-furniture-helm', x: 300, y: 390, scale: .7, flip: true }],
      characters: eightCharacters
    });
    assert.equal(legacySaved.ok, true);
    assert.equal(legacySaved.profile.room.placements[0].scale, .7);
    assert.equal(legacySaved.profile.room.placements[0].rotation, 2);
    assert.equal((await bridge.saveLauncherRoom({ revision: 1, sceneId: 'room-scene-default',
      placements: [{ itemId: 'room-furniture-helm', x: 300, y: 390, scale: .7, flip: true }],
      characters: [] })).ok, true);
    assert.equal((await bridge.saveLauncherRoom({ revision: 1, sceneId: 'room-scene-default',
      placements: [{ itemId: 'room-furniture-helm', x: 300, y: 390, scale: 1, rotation: 4, flip: false }],
      characters: [] })).error, 'invalid_room');
    assert.equal((await bridge.saveLauncherRoom({ revision: 1, sceneId: 'room-scene-default',
      placements: [], characters: [...eightCharacters, { itemId: 'room-character-franky', x: 900, y: 405 }] })).error, 'invalid_room');
    bridge.close();

    console.log(JSON.stringify({ ok: true, characters: ids.length, workReward: 10, workMinutes: 5, dailyClaimCap: 6, spendable: true, crossDayReservation: true }));
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
