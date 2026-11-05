'use strict';

// Synthetic authenticated sockets exercise the real room command handlers.
// No database, public service or player account is used.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { attach, RULESET } = require('../server/marineford-rooms');
const updateMessage = '遊戲規則已更新，請返回啟動器更新《馬林福特之戰》後再進入。';
const checks = [];
let now = 1000;
const worlds = [];

function world() {
  const sockets = new Map();
  let connection;
  const io = { sockets: { sockets }, on(event, handler) { assert.equal(event, 'connection'); connection = handler; } };
  const runtime = attach(io, { clock: () => now, cpuDelay: 1000000, gateTimeout: 1000000,
    getProfile: async userId => ({ userId, games: 0 }) });
  let ordinal = 0;
  const result = { runtime, connect(userId, marker = RULESET) {
    const auth = marker === null ? {} : { marinefordRuleset: marker };
    const socket = { id: 'ruleset-qa-' + (++ordinal), connected: true,
      handshake: { auth }, data: { socialProfile: { userId, name: '規則測試 ' + userId, avatar: 8 } },
      handlers: new Map(), events: [],
      on(event, handler) { this.handlers.set(event, handler); },
      emit(event, packet) { this.events.push({ event, packet }); } };
    sockets.set(socket.id, socket); connection(socket);
    return socket;
  } };
  worlds.push(result);
  return result;
}

async function call(socket, event, payload = {}, advanceMs = 100) {
  now += advanceMs;
  let response;
  const handler = socket.handlers.get(event);
  assert(handler, 'Missing handler ' + event);
  await handler(payload, value => { response = value; });
  assert(response, 'Missing reply for ' + event);
  return response;
}

function roomSnapshot(room) {
  return JSON.stringify({ seats: room.seats, state: room.state, sequence: room.sequence,
    touched: room.touched, gate: room.gate && [...room.gate], host: room.host,
    navyId: room.navyId, chat: room.chat, matchId: room.matchId });
}

async function main() {
  assert.equal(RULESET, '20261106-kizaru-one');
  const client = fs.readFileSync(path.join(__dirname, '../public/marineford/marineford.js'), 'utf8');
  assert.equal(client.match(/marinefordRuleset\s*:\s*['"]([^'"]+)['"]/)?.[1], RULESET,
    'The delivered client and server must use the same rule marker');
  checks.push('Client and server use the same current ruleset marker');

  const f = world();
  const missing = f.connect(21, null), old = f.connect(22, '20261105'), invalid = f.connect(23, { current: RULESET });
  for (const socket of [missing, old, invalid]) {
    assert(!socket.handlers.has('SOCIAL_AUTH'));
    const registered = [...socket.handlers.keys()].filter(event => event.startsWith('MF_'));
    assert(registered.includes('MF_CREATE') && registered.includes('MF_ACTION') && registered.includes('MF_ACK'));
    for (const event of registered) {
      const result = await call(socket, event, { marinefordRuleset: RULESET, code: 'MOLD', action: { type: 'DRAW' } });
      assert.deepEqual(result, { ok: false, error: updateMessage }, event);
      assert.equal(f.runtime.rooms.size, 0, event + ' must not create a room');
      assert.equal(socket.data.mfLastAction, undefined, event + ' must not reach action state');
    }
  }
  checks.push('Every MF entry rejects missing, old and malformed handshake markers before mutation; payload marker cannot bypass it');

  const a = f.connect(1), b = f.connect(2);
  assert((await call(a, 'MF_PROFILE')).ok);
  const created = await call(a, 'MF_CREATE');
  assert(created.ok);
  const room = f.runtime.rooms.get(created.code);
  const beforeRules = roomSnapshot(room), lastAction = a.data.mfLastAction;
  assert.deepEqual(await call(a, 'MF_RULES', {}, 0), { ok: true, ruleset: RULESET });
  assert.equal(a.data.mfLastAction, lastAction);
  assert.equal(roomSnapshot(room), beforeRules);
  assert.deepEqual(await call(b, 'MF_RULES'), { ok: true, ruleset: RULESET });
  assert.equal(b.data.mfLastAction, undefined);
  assert((await call(b, 'MF_JOIN', { code: created.code }, 0)).ok);
  checks.push('MF_RULES is authenticated and read-only, bypasses action throttling, and does not throttle an immediate saved-room join');
  assert((await call(b, 'MF_READY', { ready: true })).ok);
  assert((await call(a, 'MF_LIST')).rooms.some(entry => entry.code === created.code));
  assert((await call(a, 'MF_START')).ok);
  assert(room.state && room.state.phase === 'playing');
  checks.push('Current marker permits profile, list, create, join, ready and start with authenticated seats');

  const beforeJoin = roomSnapshot(room), oldSeat = old.data.marinefordRoom;
  assert.deepEqual(await call(old, 'MF_JOIN', { code: created.code }), { ok: false, error: updateMessage });
  assert.equal(roomSnapshot(room), beforeJoin);
  assert.equal(old.data.marinefordRoom, oldSeat);
  checks.push('An old connected page cannot join a current room or mutate seats');

  const action = await call(a, 'MF_ACTION', { revision: room.state.revision, action: { type: 'DRAW' } });
  assert(action.ok);
  assert.equal(room.gate.size, 2);
  const frozen = roomSnapshot(room), actionTime = a.data.mfLastAction, emitted = a.events.length;
  a.handshake.auth.marinefordRuleset = '20261105';
  for (const event of ['MF_CREATE', 'MF_JOIN', 'MF_ACTION', 'MF_ACK']) {
    assert.deepEqual(await call(a, event, { code: created.code, revision: room.state.revision,
      sequence: room.sequence, action: { type: 'DRAW' } }), { ok: false, error: updateMessage });
    assert.equal(roomSnapshot(room), frozen, event + ' changed room state');
    assert.equal(a.data.mfLastAction, actionTime);
    assert.equal(a.events.length, emitted);
  }
  checks.push('A seated stale connection cannot create, rejoin, act or release another presentation gate');

  a.handshake.auth.marinefordRuleset = RULESET;
  assert((await call(a, 'MF_ACK', { sequence: room.sequence })).ok);
  assert.equal(room.gate.size, 1);
  assert((await call(b, 'MF_ACK', { sequence: room.sequence })).ok);
  assert.equal(room.gate, null);
  assert(a.events.some(entry => entry.event === 'MF_CAN_ACT'));
  checks.push('Current-marker ACKs still release the existing two-player presentation gate');

  const originalHand = room.state.players[0].hand.slice();
  a.connected = false; a.handlers.get('disconnect')();
  const returning = f.connect(1);
  const rejoined = await call(returning, 'MF_JOIN', { code: created.code });
  assert(rejoined.ok && rejoined.you === 0);
  const restored = returning.events.findLast(entry => entry.event === 'MF_STATE').packet;
  assert.deepEqual(restored.view.players[0].hand, originalHand);
  assert(restored.view.players[1].hand.every(card => card === null));
  checks.push('A current client reconnects to its existing seat with its private hand and redacted other hand');

  f.runtime.close();
  const fresh = world(), currentAfterRestart = fresh.connect(1), oldAfterRestart = fresh.connect(2, null);
  assert.equal(fresh.runtime.rooms.size, 0);
  const lost = await call(currentAfterRestart, 'MF_JOIN', { code: created.code });
  assert.deepEqual(lost, { ok: false, error: '找不到房間' });
  assert.deepEqual(await call(oldAfterRestart, 'MF_CREATE', { cpuCount: 1 }), { ok: false, error: updateMessage });
  assert.equal(fresh.runtime.rooms.size, 0);
  const newRoom = await call(currentAfterRestart, 'MF_CREATE', { cpuCount: 1 });
  assert(newRoom.ok && (await call(currentAfterRestart, 'MF_START')).ok);
  checks.push('Restarted runtime has no restored active room; old pages cannot recreate one and current clients can start afresh');

  const report = { passed: true, checkedAt: new Date().toISOString(), ruleset: RULESET, checks,
    scope: { syntheticAuthenticatedSockets: true, actualProductionRoomHandlers: true, database: false,
      productionAccount: false, physicalDevice: false, realRenderRestart: false } };
  if (process.argv[2]) fs.writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, checks: checks.length, ruleset: RULESET }));
}

main().catch(error => { console.error(error); process.exitCode = 1; })
  .finally(() => { for (const f of worlds) f.runtime.close(); });
