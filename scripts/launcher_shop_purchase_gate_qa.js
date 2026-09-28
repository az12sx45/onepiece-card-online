'use strict';

// The catalog and launcher preflight must agree. Use an in-memory SQL database
// to check room purchases without touching a player account or the live server.
const assert = require('node:assert/strict');
const Module = require('node:module');
const path = require('node:path');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');

const originalLoad = Module._load;
let auth, S, L, B, crew;
try {
  Module._load = function(request, parent, isMain) {
    if (request === 'electron') return { app: { isPackaged: true }, safeStorage: {} };
    if (request === 'socket.io-client') return { io() {} };
    return originalLoad.call(this, request, parent, isMain);
  };
  const { AuthService } = require('../desktop/auth-service');
  auth = new AuthService({ origin: 'https://example.invalid', userDataPath: path.join(__dirname, '.unused-shop-gate') });
  S = require('../server/launcher-profile-shop');
  L = require('../server/launcher-life');
  B = require('../server/launcher-life-store');
  crew = require('../server/launcher-crew-release');
} finally {
  Module._load = originalLoad;
}

const db = new PGlite();
const pool = {
  query: (...args) => db.query(...args),
  connect: async () => ({ query: (...args) => db.query(...args), release() {} })
};
const cap = { crewContentRevision: 1 };
const today = new Date().toISOString().slice(0, 10);
const newRoomProducts = [
  'room-scene-sunny-workshop', 'room-scene-sunny-aquarium',
  'room-furniture-supply-rack', 'room-furniture-log-pose-desk',
  'room-furniture-repair-cart', 'room-furniture-library-cart',
  'room-furniture-medical-cart', 'room-furniture-den-den-desk'
];

async function addAccount(secret, stats) {
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)',
    [secret, secret, '8', JSON.stringify(stats)]);
}

async function main() {
  const sent = [];
  const roomPackets = [];
  auth.launcherRequest = async (event, payload) => {
    if (event === 'LAUNCHER_ROOM_SET') roomPackets.push(payload);
    else sent.push({ event, itemId: payload.itemId });
    return { ok: true };
  };
  for (const item of S.CATALOG) {
    const result = await auth.changeLauncherShopItem('buy', item.id);
    assert.equal(result.ok, true, `launcher rejected catalog item ${item.id}`);
    assert.deepEqual(sent.at(-1), { event: 'LAUNCHER_SHOP_BUY', itemId: item.id });
  }
  assert.equal((await auth.changeLauncherShopItem('buy', 'room-furniture-not-in-catalog')).error, 'invalid item');
  assert.equal(sent.length, S.CATALOG.length, 'invalid item must never reach the server');

  // Every room product that can be bought must also pass the packaged desktop
  // room-save gate. The server independently checks ownership on save.
  const scenes = S.CATALOG.filter(item => item.type === 'room_scene');
  const furniture = S.CATALOG.filter(item => item.type === 'room_furniture');
  assert.equal(scenes.length, 5);
  assert.equal(furniture.length, 17);
  for (const scene of scenes) {
    const result = await auth.saveLauncherRoom({ revision: 0, capacityVersion: 2,
      sceneId: scene.id, placements: [], characters: [] });
    assert.equal(result.ok, true, `bought scene cannot pass desktop room save: ${scene.id}`);
    assert.equal(roomPackets.at(-1).sceneId, scene.id);
  }
  for (const item of furniture) {
    const result = await auth.saveLauncherRoom({ revision: 0, capacityVersion: 2,
      sceneId: 'room-scene-default', placements: [{ itemId: item.id, x: 480, y: 390, scale: 1, rotation: 0, flip: false }], characters: [] });
    assert.equal(result.ok, true, `bought furniture cannot pass desktop room save: ${item.id}`);
    assert.equal(roomPackets.at(-1).placements[0].itemId, item.id);
  }
  const packetsBeforeReject = roomPackets.length;
  assert.equal((await auth.saveLauncherRoom({ revision: 0, capacityVersion: 2,
    sceneId: 'room-scene-unreleased', placements: [], characters: [] })).error, 'invalid_room');
  assert.equal((await auth.saveLauncherRoom({ revision: 0, capacityVersion: 2,
    sceneId: 'room-scene-default', placements: [{ itemId: 'room-furniture-unreleased', x: 480, y: 390, scale: 1, rotation: 0 }], characters: [] })).error, 'invalid_room');
  assert.equal(roomPackets.length, packetsBeforeReject, 'unknown room products must never reach the server');

  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await B.ensureLifeTables(pool);
  await addAccount('new-room-items', { launcherWalletV1: { coins: 500, lastGrantDay: today } });
  let priceTotal = 0;
  for (const id of newRoomProducts) {
    const item = S.CATALOG.find(entry => entry.id === id);
    assert.ok(item, `missing server catalog item ${id}`);
    const result = await S.changeLauncherItem(pool, 'new-room-items', id, 'buy', cap);
    assert.equal(result.ok, true, `server rejected catalog item ${id}: ${result.error}`);
    priceTotal += item.price;
    assert.equal(result.shop.wallet.coins, 500 - priceTotal);
    assert.ok(result.profile.collection.launcher.itemIds.includes(id));
  }

  const newlyBoughtFurniture = newRoomProducts.filter(id => id.startsWith('room-furniture-'))
    .map((itemId, index) => ({ itemId, x: 180 + index * 110, y: 390, scale: 1, rotation: index % 4, flip: index % 4 === 2 }));
  for (const sceneId of newRoomProducts.filter(id => id.startsWith('room-scene-'))) {
    const before = await S.getLauncherProfile(pool, 'new-room-items', 0, null, cap);
    const snapshot = { revision: before.profile.room.revision, capacityVersion: 2,
      sceneId, placements: newlyBoughtFurniture, characters: [] };
    assert.equal((await auth.saveLauncherRoom(snapshot)).ok, true, `desktop rejected purchased scene ${sceneId}`);
    const saved = await S.setLauncherRoom(pool, 'new-room-items', roomPackets.at(-1), cap);
    assert.equal(saved.ok, true, `server rejected purchased scene ${sceneId}: ${saved.error}`);
    const reloaded = await S.getLauncherProfile(pool, 'new-room-items', 0, null, cap);
    assert.equal(reloaded.profile.room.sceneId, sceneId, 'selected scene must survive reload');
    assert.deepEqual(reloaded.profile.room.placements.map(entry => entry.itemId),
      newlyBoughtFurniture.map(entry => entry.itemId), 'purchased furniture must survive reload');
    assert.equal(reloaded.profile.room.revision, before.profile.room.revision + 1);
    assert.equal(reloaded.profile.collection.launcher.itemIds.includes(sceneId), true);
  }
  assert.equal((await S.getLauncherShop(pool, 'new-room-items', false, cap)).shop.wallet.coins,
    500 - priceTotal, 'using purchased scenes must not charge coins twice');

  const placed = crew.LEGACY_KEYS.map((key, index) => ({ itemId: `room-character-${key}`, x: 40 + index * 80, y: 430 }));
  assert.equal(placed.length, 10);
  assert.ok(crew.releasedKeys.includes('ace'), 'this release fixture requires Ace to be on sale');
  await addAccount('full-room', {
    launcherWalletV1: { coins: 100, lastGrantDay: today },
    launcherOwnedV1: { items: placed.map(entry => entry.itemId) },
    launcherRoomV1: { revision: 7, capacityVersion: 2, sceneId: 'room-scene-default', placements: [], characters: placed }
  });
  const fullUser = (await db.query('SELECT user_id FROM player_profiles WHERE secret=$1', ['full-room'])).rows[0].user_id;
  const originalPending = placed.map((entry, index) => ({ itemId: entry.itemId, arrivalId: `arrival-${index}` }));
  await db.query('INSERT INTO launcher_life_state(user_id,state) VALUES($1,$2::jsonb)',
    [fullUser, JSON.stringify({ pendingArrivals: originalPending })]);
  const ace = S.CATALOG.find(item => item.id === 'room-character-ace');
  const bought = await S.changeLauncherItem(pool, 'full-room', ace.id, 'buy', cap);
  assert.equal(bought.ok, true, bought.error);
  assert.equal(bought.roomPlacementDeferred, true);
  assert.equal(bought.shop.wallet.coins, 100 - ace.price);
  assert.ok(bought.shop.owned.roomCharacters.includes(ace.id));
  assert.equal(bought.profile.room.revision, 7, 'purchase without placement must not change room revision');
  assert.equal(bought.profile.room.characters.length, 10, 'simultaneous room cap must stay at ten');
  assert.ok(bought.life.ownedCharacterIds.includes(ace.id));
  assert.ok(bought.life.pendingArrivals.some(entry => entry.itemId === ace.id));
  assert.equal(bought.life.pendingArrivals.length, 11);
  const reloaded = await B.getLauncherLife(pool, 'full-room', new Date(), cap);
  assert.equal(reloaded.life.pendingArrivals.length, 11, 'the eleventh arrival must survive a database reload');
  const repeat = await S.changeLauncherItem(pool, 'full-room', ace.id, 'buy', cap);
  assert.equal(repeat.error, 'already_owned');
  assert.equal((await S.getLauncherShop(pool, 'full-room', false, cap)).shop.wallet.coins, 100 - ace.price);

  // An owner may collect every released character before entering the room.
  // The last arrival must survive loading, even though only ten can be placed.
  const elevenPending = [...placed.map((entry, index) => ({ itemId: entry.itemId, arrivalId: `arrival-${index}` })),
    { itemId: ace.id, arrivalId: 'arrival-ace' }];
  const normalized = L.normalizeState({ pendingArrivals: elevenPending },
    [...placed.map(entry => entry.itemId), ace.id], placed.map(entry => entry.itemId), new Date());
  assert.equal(normalized.pendingArrivals.length, 11);
  assert.equal(normalized.pendingArrivals.at(-1).itemId, ace.id);

  // Legacy clients send only the active room. A modern payload must keep its
  // flat active mirror and scenes[sceneId] identical, so omit the V2 map here.
  const { scenes: _scenes, ...legacyRoom } = bought.profile.room;
  const nextCharacters = [...legacyRoom.characters.slice(0, 9), { itemId: ace.id, x: 820, y: 430 }];
  const mismatched = await S.setLauncherRoom(pool, 'full-room', {
    ...bought.profile.room, characters: nextCharacters
  }, cap);
  assert.equal(mismatched.error, 'invalid_room');
  const replacement = await S.setLauncherRoom(pool, 'full-room', {
    ...legacyRoom, characters: nextCharacters
  }, cap);
  assert.equal(replacement.ok, true, replacement.error);
  assert.equal(replacement.profile.room.characters.length, 10);
  assert.ok(replacement.profile.room.characters.some(entry => entry.itemId === ace.id));
  assert.equal(replacement.profile.room.revision, 8);
  console.log(JSON.stringify({ status: 'PASS', catalogItems: S.CATALOG.length, newRoomProducts: newRoomProducts.length,
    saveableScenes: scenes.length, saveableFurniture: furniture.length,
    roomCapacity: 10, ownedAfterPurchase: bought.shop.owned.roomCharacters.length }));
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await db.close(); });
