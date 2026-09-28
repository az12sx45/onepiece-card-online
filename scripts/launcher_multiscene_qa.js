'use strict';
// Isolated PGlite service check. No production account, save or wallet is used.
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const shop = require('../server/launcher-profile-shop');
const lifeStore = require('../server/launcher-life-store');
const db = new PGlite();
let serial = Promise.resolve();
const pool = {
  query: (...args) => db.query(...args),
  async connect() {
    const previous = serial;
    let release;
    serial = new Promise(resolve => { release = resolve; });
    await previous;
    return { query: (...args) => db.query(...args), release };
  }
};
const cap = { crewContentRevision: 1 };
const defaultId = 'room-scene-default';
const deckId = 'room-scene-sunny-deck';
const kitchenId = 'room-scene-sunny-kitchen';
const furniture = (key, x = 300) => ({ itemId: `room-furniture-${key}`, x, y: 400, scale: 1, rotation: 0, flip: false });
const character = (key, x = 400) => ({ itemId: `room-character-${key}`, x, y: 430 });
const empty = () => ({ placements: [], characters: [] });
const checks = [];
async function check(name, run) { await run(); checks.push(name); console.log(`PASS ${name}`); }
async function row() { return (await db.query('SELECT * FROM player_profiles WHERE user_id=1')).rows[0]; }
async function save(snapshot) { return shop.setLauncherRoom(pool, 'owner', snapshot, cap); }

async function main() {
  await db.exec(`CREATE TABLE player_profiles (
    user_id INTEGER PRIMARY KEY, secret TEXT UNIQUE, name TEXT, avatar TEXT,
    stats JSONB, updated_at TIMESTAMPTZ DEFAULT now()
  )`);
  const stats = {
    client: { social: { friends: [2] } },
    launcherOwnedV1: { items: [deckId, kitchenId, 'room-furniture-helm',
      'room-furniture-treasure-chest', 'room-character-luffy', 'room-character-ace'] },
    launcherRoomV1: { revision: 7, capacityVersion: 2, sceneId: deckId,
      placements: [furniture('helm')], characters: [character('luffy')] }
  };
  await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',
    [1, 'owner', '房主', '8', JSON.stringify(stats)]);
  await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',
    [2, 'friend', '好友', '8', JSON.stringify({ client: { social: { friends: [1] } } })]);

  await check('legacy active scene migrates without losing placed items', async () => {
    const owner = shop.toPublicProfile(await row(), true);
    assert.equal(owner.room.revision, 7);
    assert.equal(owner.room.sceneId, deckId);
    assert.deepEqual(owner.room.scenes[deckId].characters.map(item => item.itemId), ['room-character-luffy']);
    assert.deepEqual(owner.room.scenes[defaultId], empty());
    assert.equal((await row()).stats.launcherRoomsV2, undefined, 'reading must not rewrite the save');
    const malformed = shop.toPublicProfile({ ...await row(), stats: {
      ...(await row()).stats, launcherRoomsV2: { revision: 7, activeSceneId: deckId, scenes: {} }
    } }, true);
    assert.deepEqual(malformed.room.characters.map(item => item.itemId), ['room-character-luffy'],
      'a malformed V2 map must not erase the legacy layout');
  });

  const first = { revision: 7, capacityVersion: 2, sceneId: kitchenId,
    scenes: { [defaultId]: empty(), [deckId]: {
      placements: [furniture('helm')], characters: [character('ace')]
    }, [kitchenId]: {
      placements: [furniture('treasure-chest')], characters: [character('luffy')]
    } } };
  first.placements = first.scenes[kitchenId].placements;
  first.characters = first.scenes[kitchenId].characters;
  await check('two independent scenes save and V1 mirror follows active scene', async () => {
    const result = await save(first);
    assert.equal(result.ok, true, result.error);
    const saved = (await row()).stats;
    assert.equal(saved.launcherRoomsV2.revision, 8);
    assert.equal(saved.launcherRoomsV2.activeSceneId, kitchenId);
    assert.deepEqual(saved.launcherRoomV1.characters.map(item => item.itemId), ['room-character-luffy']);
    assert.deepEqual(saved.launcherRoomsV2.scenes[deckId].characters.map(item => item.itemId), ['room-character-ace']);
  });
  await check('friend sees only the active scene and no private layouts', async () => {
    const result = await shop.getLauncherProfile(pool, 'friend', 1, null, cap);
    assert.equal(result.ok, true, result.error);
    assert.equal(result.profile.room.sceneId, kitchenId);
    assert.equal(result.profile.room.scenes, undefined);
    assert.deepEqual(result.profile.room.characters.map(item => item.itemId), ['room-character-luffy']);
    assert.deepEqual(result.profile.room.placements.map(item => item.itemId), ['room-furniture-treasure-chest']);
  });
  await check('global revision prevents lost edits', async () => {
    const result = await save(first);
    assert.equal(result.error, 'revision_conflict');
    assert.equal(result.profile.room.revision, 8);
  });
  await check('duplicate character or furniture across scenes is rejected', async () => {
    for (const key of ['characters', 'placements']) {
      const duplicate = structuredClone(first);
      duplicate.revision = 8;
      duplicate.scenes[deckId][key].push(structuredClone(duplicate.scenes[kitchenId][key][0]));
      const result = await save(duplicate);
      assert.equal(result.error, 'invalid_room');
    }
  });
  await check('flat active mirror cannot silently disagree with V2 scene', async () => {
    const mismatched = structuredClone(first);
    mismatched.revision = 8;
    mismatched.characters = [];
    assert.equal((await save(mismatched)).error, 'invalid_room');
    assert.equal((await row()).stats.launcherRoomsV2.revision, 8);
  });
  await check('unowned scene and object never persist', async () => {
    const unownedScene = structuredClone(first);
    unownedScene.revision = 8;
    unownedScene.scenes['room-scene-sunny-library'] = empty();
    assert.equal((await save(unownedScene)).error, 'not_owned');
    const unownedItem = structuredClone(first);
    unownedItem.revision = 8;
    unownedItem.scenes[kitchenId].characters.push(character('zoro'));
    assert.equal((await save(unownedItem)).error, 'not_owned');
  });
  await check('legacy save transfers a character to the selected scene', async () => {
    const result = await save({ revision: 8, capacityVersion: 2, sceneId: deckId,
      placements: [furniture('helm')], characters: [character('luffy')] });
    assert.equal(result.ok, true, result.error);
    const scenes = (await row()).stats.launcherRoomsV2.scenes;
    assert.deepEqual(scenes[deckId].characters.map(item => item.itemId), ['room-character-luffy']);
    assert.deepEqual(scenes[kitchenId].characters, []);
    assert.deepEqual(scenes[kitchenId].placements.map(item => item.itemId), ['room-furniture-treasure-chest']);
  });
  await check('switching the displayed scene preserves work in another scene', async () => {
    await lifeStore.ensureLifeTables(pool);
    const now = new Date();
    const job = { jobId: 'multi-scene-work', itemId: 'room-character-luffy',
      stationId: 'room-furniture-helm', status: 'active', activatedAt: now.toISOString(),
      readyAt: new Date(now.getTime() + 3600000).toISOString(), durationMs: 3600000,
      reward: 10, roomRevision: 9 };
    await db.query('INSERT INTO launcher_life_state(user_id,state) VALUES($1,$2::jsonb)',
      [1, JSON.stringify({ revision: 1, jobs: [job], lastSimulatedAt: now.toISOString() })]);
    const before = shop.toPublicProfile(await row(), true).room;
    const switched = await save({ ...before, sceneId: kitchenId,
      placements: before.scenes[kitchenId].placements, characters: before.scenes[kitchenId].characters });
    assert.equal(switched.ok, true, switched.error);
    const state = await lifeStore.getLauncherLife(pool, 'owner', new Date(), cap);
    assert.equal(state.ok, true, state.error);
    assert.equal(state.room.sceneId, kitchenId);
    assert.deepEqual(state.life.jobs.map(entry => entry.jobId), [job.jobId]);
    assert.equal(state.life.activeCharacterIds.includes(job.itemId), false,
      'inactive room characters stay out of current-scene interaction actions');
    const split = shop.toPublicProfile(await row(), true).room;
    split.scenes[deckId].placements = [];
    split.scenes[kitchenId].placements.push(furniture('helm', 200));
    split.placements = split.scenes[kitchenId].placements;
    const movedStation = await save(split);
    assert.equal(movedStation.ok, true, movedStation.error);
    const invalidated = await lifeStore.getLauncherLife(pool, 'owner', new Date(), cap);
    assert.deepEqual(invalidated.life.jobs, [],
      'moving a station away from its character invalidates the old job');
  });
  await check('legacy patch cannot overwrite canonical V2 rooms', async () => {
    const safe = shop.sanitizeLauncherStatsPatch({ launcherRoomV1: {}, launcherRoomsV2: {}, client: { safe: true } });
    assert.equal(safe.launcherRoomV1, undefined);
    assert.equal(safe.launcherRoomsV2, undefined);
    assert.deepEqual(safe.client, { safe: true });
  });
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.close());
