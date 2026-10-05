'use strict';

// Exercise the existing Electron AuthService command gate. The aquarium room is
// updated by signed content, while this class ships inside the installed app.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const Module = require('node:module');
const { PGlite } = require(process.env.BOARD_QA_PGLITE ||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life = require('../server/launcher-life-store');
const originalLoad = Module._load;
let bridge;
try {
  Module._load = function (request, parent, isMain) {
    if (request === 'electron') return { app: { isPackaged: true }, safeStorage: {} };
    if (request === 'socket.io-client') return { io: () => { throw new Error('socket transport is mocked'); } };
    return originalLoad.call(this, request, parent, isMain);
  };
  const { AuthService } = require('../desktop/auth-service');
  bridge = new AuthService({ origin: 'https://example.invalid', userDataPath: 'D:/Codex_QA/launcher-aquarium-r14/unused-auth-state' });
} finally { Module._load = originalLoad; }

async function main() {
  let checks = 0;
  const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks++; };
  bridge.secretMemory = 'private-fixture-secret';
  bridge.state.account = { userId: 42 };
  const sent = [];
  bridge.emitAck = async (event, payload) => { sent.push({ event, payload }); return { ok: true }; };
  const intents = [
    { requestId: 'aquarium-cook-001', expectedRevision: 4, type: 'fish.release',
      payload: { fishId: 'catch-001', disposition: 'cook', recipientId: 'room-character-sanji' } },
    { requestId: 'aquarium-sell-001', expectedRevision: 5, type: 'fish.release',
      payload: { fishId: 'catch-002', disposition: 'sell' } },
    { requestId: 'aquarium-upgrade-001', expectedRevision: 6, type: 'fish.release',
      payload: { disposition: 'upgrade_rod' } },
    { requestId: 'aquarium-release-001', expectedRevision: 7, type: 'fish.release',
      payload: { fishId: 'catch-003' } }
  ];
  for (const intent of intents) {
    check(`core accepts ${intent.payload.disposition || 'plain release'}`,
      (await bridge.commandLauncherLife({ ...intent, secret: 'forged', userId: 999 })).ok, true);
  }
  check('all allowed intents forwarded', sent.length, intents.length);
  sent.forEach(({ event, payload }, index) => {
    check('correct guarded event ' + index, event, 'LAUNCHER_LIFE_COMMAND');
    check('exact trusted payload ' + index, payload,
      { secret: 'private-fixture-secret', ...intents[index], crewContentRevision: 1 });
  });
  for (const type of ['fish.cook', 'fish.sell', 'rod.upgrade', 'wallet.set']) {
    check('core rejects ' + type, (await bridge.commandLauncherLife({ requestId: `blocked-${type.replace('.', '-')}`,
      expectedRevision: 7, type, payload: {} })).error, 'invalid_command');
  }
  check('rejected intents never reached socket', sent.length, intents.length);

  // Cross all three production layers with an isolated PostgreSQL-compatible
  // database: actual installed command gate -> server dispatch -> durable life
  // and wallet state. The UI test separately verifies its exact wire payloads.
  const db = new PGlite(), cap = { crewContentRevision: 1 }, now = new Date();
  let queue = Promise.resolve();
  const pool = { query: (...args) => db.query(...args), async connect() {
    const prior = queue; let release;
    queue = new Promise(resolve => { release = resolve; });
    await prior;
    return { query: (...args) => db.query(...args), release };
  } };
  try {
    await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
    const actor = 'room-character-sanji';
    const stats = { launcherWalletV1: { coins: 16, lastGrantDay: now.toISOString().slice(0, 10) },
      launcherOwnedV1: { items: [actor, 'room-furniture-aquarium-tank'] },
      launcherCompanionsV1: { characters: { [actor]: { affinity: 10 } } },
      launcherRoomV1: { revision: 1, sceneId: 'room-scene-default', capacityVersion: 2,
        placements: [], characters: [{ itemId: actor, x: 160, y: 440 }] } };
    await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)',
      ['private-fixture-secret', 'Core bridge fixture', '8', JSON.stringify(stats)]);
    const initial = await life.getLauncherLife(pool, bridge.secretMemory, now, cap);
    const userId = (await db.query('SELECT user_id FROM player_profiles WHERE secret=$1', [bridge.secretMemory])).rows[0].user_id;
    const row = (await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1', [userId])).rows[0];
    const cooked = { id: crypto.randomUUID(), speciesId: 'glistening-saury', caughtAt: now.toISOString(), inAquarium: true };
    const sold = { id: crypto.randomUUID(), speciesId: 'glistening-saury', caughtAt: now.toISOString(), inAquarium: false };
    row.state.fishCollection.push(cooked, sold);
    await db.query('UPDATE launcher_life_state SET state=$1::jsonb WHERE user_id=$2', [JSON.stringify(row.state), userId]);
    const actualEvents = [];
    bridge.emitAck = async (event, payload) => {
      actualEvents.push({ event, payload });
      if (event === 'LAUNCHER_LIFE_GET') return life.getLauncherLife(pool, payload.secret, now, cap);
      if (event === 'LAUNCHER_LIFE_COMMAND') return life.commandLauncherLife(pool, payload.secret,
        { requestId: payload.requestId, expectedRevision: payload.expectedRevision,
          type: payload.type, payload: payload.payload }, now, cap);
      throw new Error('unexpected bridge event ' + event);
    };
    const send = async (requestId, payload) => {
      const snapshot = await bridge.getLauncherLife();
      return bridge.commandLauncherLife({ requestId, expectedRevision: snapshot.life.revision,
        type: 'fish.release', payload });
    };
    check('seeded life snapshot', initial.ok, true);
    const meal = await send('core-real-cook-001', { fishId: cooked.id, disposition: 'cook', recipientId: actor });
    check('real cook transaction succeeds', meal.ok, true);
    check('cook consumes one exact fish', meal.life.fishCollection.map(fish => fish.id), [sold.id]);
    check('selected companion affinity changes', meal.profile.companions.find(item => item.itemId === actor).affinity, 12);
    const sale = await send('core-real-sell-001', { fishId: sold.id, disposition: 'sell' });
    check('real sale transaction succeeds', sale.ok, true);
    check('sale credits shared wallet', [sale.sale.amount, sale.wallet.coins, sale.life.fishCollection.length], [4, 20, 0]);
    const upgrade = await send('core-real-upgrade-001', { disposition: 'upgrade_rod' });
    check('real upgrade transaction succeeds', upgrade.ok, true);
    check('same sale proceeds pay upgrade', [upgrade.rod.level, upgrade.wallet.coins], [1, 0]);
    check('all transactions used installed-core allowed command',
      actualEvents.filter(item => item.event === 'LAUNCHER_LIFE_COMMAND').map(item => item.payload.type),
      ['fish.release', 'fish.release', 'fish.release']);
    const stored = await life.getLauncherLife(pool, bridge.secretMemory, now, cap);
    check('durable state matches replies',
      [stored.life.fishCollection.length, stored.profile.companions.find(item => item.itemId === actor).affinity,
        stored.wallet.coins, stored.rod.level], [0, 12, 0, 1]);
  } finally { await db.close(); }
  bridge.close();
  console.log(JSON.stringify({ status: 'PASS', checks,
    scope: 'Actual AuthService allowlist -> server life transaction -> PGlite persistence; isolated account and no external socket' }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
