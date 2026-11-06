'use strict';
// Real engine privacy/rules regression. No HTTP, account, device or browser mocks.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const Module = require('node:module');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'server/engine.js');
const base = 'dbc45faa4377df86cf0fbb86944c1379b84cdc05';
const output = path.resolve(process.env.CARD_DUEL_PRIVACY_REPORT || 'D:/Codex_QA/card-duel-stage-20261106/engine-privacy-report.json');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const initialBytes = fs.readFileSync(source);
const originalSource = execFileSync('git', ['show', `${base}:server/engine.js`], { cwd: root, encoding: 'utf8' });
const originalModule = new Module(path.join(root, 'server/engine-baseline.js'), module);
originalModule.filename = path.join(root, 'server/engine-baseline.js');
originalModule.paths = module.paths;
originalModule._compile(originalSource, originalModule.filename);
const original = originalModule.exports;
const engine = require('../server/engine');
const clone = value => JSON.parse(JSON.stringify(value));
const checks = [];
const cases = [];
const ids = new Set();
function check(name, fn) {
  try { fn(); checks.push({ name, pass: true }); }
  catch (error) { checks.push({ name, pass: false, error: error.message }); throw error; }
}
function seeded(seed, fn) {
  const old = Math.random;
  let n = seed;
  Math.random = () => { n ^= n << 13; n ^= n >>> 17; n ^= n << 5; return (n >>> 0) / 4294967296; };
  try { return fn(); } finally { Math.random = old; }
}
function fixture(cardId, keep, targetCard, enhanced = false) {
  const state = seeded(0x6d2c, () => engine.createInitialState(6));
  state.turnIndex = 0;
  state.turnStep = 'choose';
  state.roundNo = 20;
  state.pending = null;
  state.venues = enhanced ? [{ name: engine._util.cardById(cardId).venue }] : [];
  state.deck = [0, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16];
  state.discard = [16, 12];
  state.players.forEach((p, i) => Object.assign(p, {
    hand: i === 0 ? cardId : i === 1 ? targetCard : i === 2 ? 4 : 6,
    tempDraw: i === 0 ? keep : null,
    alive: true, protected: false, dodging: false, frozen: false,
    client: { displayName: `Privacy${i}` }, gold: 2
  }));
  return state;
}
function oldPackets(events) {
  return events.filter(e => e.type !== 'duel_private').map(e => {
    const packet = { ...e }; delete packet.duelId; return packet;
  });
}
function match(label, initial) {
  let current = clone(initial), prior = clone(initial), sequence = 0;
  return {
    get state() { return current; },
    step(type, payload = {}, playerId = 0) {
      const action = { type, playerId, payload }, seed = 0x7291 + sequence++;
      const before = clone(current);
      const actual = seeded(seed, () => engine.applyAction(current, action));
      const expected = seeded(seed, () => original.applyAction(prior, action));
      check(`${label}/${type}: original rules state unchanged`, () => assert.deepEqual(actual.state, expected.state));
      check(`${label}/${type}: previous packets unchanged except correlation`, () => assert.deepEqual(oldPackets(actual.emits), expected.emits));
      current = actual.state; prior = expected.state;
      cases.push({ label, type, publicDuels: actual.emits.filter(e => e.type === 'duel'), privateRecipients: actual.emits.filter(e => e.type === 'duel_private').map(e => e.to) });
      return { ...actual, before };
    }
  };
}
function inspect(label, result, leftCardId, rightCardId, winnerId, target = 1) {
  const duels = result.emits.filter(e => e.type === 'duel');
  const packets = result.emits.filter(e => e.type === 'duel_private');
  const logs = result.emits.filter(e => e.type === 'duel_log');
  check(`${label}: exactly one public duel and private pair`, () => {
    assert.equal(duels.length, 1); assert.equal(packets.length, 2);
    assert.deepEqual(packets.map(e => e.to), [0, target]);
  });
  const duel = duels[0];
  check(`${label}: unique opaque correlation ID`, () => {
    assert.match(duel.duelId, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.equal(ids.has(duel.duelId), false); ids.add(duel.duelId);
  });
  check(`${label}: cards captured before elimination and only participants receive`, () => {
    for (const packet of packets) assert.deepEqual(packet, {
      to: packet.to, type: 'duel_private', duelId: duel.duelId,
      leftId: 0, rightId: target, leftCardId, rightCardId
    });
    for (const viewer of [0, 1, 2, 3, 4, 5, -1]) {
      const routed = result.emits.filter(e => e.to === 'all' || e.to === viewer);
      assert.equal(routed.filter(e => e.type === 'duel_private').length, [0, target].includes(viewer) ? 1 : 0);
    }
  });
  check(`${label}: private pair precedes public duel`, () => {
    assert(packets.every(e => result.emits.indexOf(e) < result.emits.indexOf(duel)));
  });
  check(`${label}: public duel has no hidden card fields`, () => {
    assert.deepEqual(Object.keys(duel).sort(), ['to', 'type', 'duelId', 'leftId', 'rightId', 'winnerId'].sort());
    assert.equal(duel.winnerId, winnerId);
  });
  check(`${label}: only loser public, draws reveal neither`, () => {
    if (winnerId === null) assert.equal(logs.length, 0);
    else {
      assert.equal(logs.length, 1);
      assert.deepEqual(logs[0], {
        to: 'all', type: 'duel_log', duelId: duel.duelId,
        loserId: winnerId === 0 ? target : 0,
        cardId: winnerId === 0 ? rightCardId : leftCardId
      });
      assert(result.emits.indexOf(logs[0]) > result.emits.indexOf(duel));
    }
  });
  check(`${label}: private pair never enters saved/reconnect STATE`, () => {
    for (const state of [result.state, ...[0, 1, 2, -1].map(id => engine.getVisibleState(result.state, id))]) {
      assert.equal(/"(?:duelId|leftCardId|rightCardId|duel_private)"/.test(JSON.stringify(state)), false);
    }
  });
  return duel.duelId;
}
function noDuel(label, result) {
  check(`${label}: no duel or participant-card packet`, () => assert.equal(result.emits.some(e => ['duel', 'duel_log', 'duel_private'].includes(e.type)), false));
}
function privacy(label, state, keep) {
  const before = clone(state), actor = state.pending?.caster ?? state.turnIndex;
  for (const viewer of [0, 1, 2, 3, 4, 5, -1]) {
    const visible = engine.getVisibleState(state, viewer);
    check(`${label}: pending keep restricted to actor ${viewer}`, () => {
      if (viewer === actor) assert.equal(visible.pending.extra.keep, keep);
      else assert.equal(Object.hasOwn(visible.pending.extra, 'keep'), false);
      for (const p of visible.players) if (p.id !== viewer) {
        assert.equal(p.hand, null); assert.equal(p.tempDraw, null);
      }
    });
  }
  check(`${label}: projection leaves authoritative state unchanged`, () => assert.deepEqual(state, before));
}
let failure = null;
try {
  for (const [cardId, enhanced] of [[3, false], [3, true], [8, false], [10, false], [13, true]]) {
    const outcomes = enhanced && cardId === 3 ? [[7, 4, 0], [2, 7, 1], [3, 4, null]] : [[cardId === 8 ? 8 : 7, 4, 0], [2, 7, 1], [4, 4, null]];
    for (const [keep, target, winner] of outcomes) {
      const label = `${cardId}-${enhanced ? 'enhanced' : 'normal'}-${winner === null ? 'draw' : winner === 0 ? 'win' : 'loss'}`;
      const run = match(label, fixture(cardId, keep, target, enhanced));
      noDuel(`${label}/play`, run.step('PLAY_CARD', { which: 'hand' }));
      privacy(label, run.state, keep);
      if (cardId === 13) noDuel(`${label}/disarm`, run.step('PICK_TARGET', { target: 1 }));
      inspect(label, run.step('PICK_TARGET', { target: 1, ...(cardId === 13 ? { duel: true } : {}) }), keep, target, winner);
    }
  }
  // Full original card IDs, not tails or Sanji's boosted comparison value.
  for (const [cardId, enhanced, keep, target] of [[3, true, 19, 8], [8, false, 17, 4], [10, false, 18, 7], [13, true, 16, 4]]) {
    const label = `${cardId}-full-card-id`, run = match(label, fixture(cardId, keep, target, enhanced));
    run.step('PLAY_CARD', { which: 'hand' });
    inspect(label, run.step('PICK_TARGET', { target: 1, duel: true }), keep, target, 0);
  }
  for (const secondType of ['LUFFY_SECOND', 'PICK_TARGET']) {
    for (const [keep, target, winner] of [[8, 4, 0], [2, 4, 2], [4, 4, null]]) {
      const label = `luffy-second-${secondType}-${winner}`, s = fixture(8, keep, 4);
      // First draw keeps Luffy alive; next target can win, lose or draw.
      s.players[1].hand = keep; s.players[2].hand = target;
      const run = match(label, s); run.step('PLAY_CARD', { which: 'hand' });
      inspect(`${label}/first`, run.step('PICK_TARGET', { target: 1 }), keep, keep, null);
      privacy(`${label}/between`, run.state, keep);
      inspect(label, run.step(secondType, { target: 2 }), keep, target, winner, 2);
    }
  }
  {
    const label = 'luffy-repeated-same-target-draw', run = match(label, fixture(8, 4, 4));
    run.step('PLAY_CARD', { which: 'hand' });
    const first = inspect(`${label}/first`, run.step('PICK_TARGET', { target: 1 }), 4, 4, null);
    const second = inspect(`${label}/second`, run.step('LUFFY_SECOND', { target: 1 }), 4, 4, null);
    check(`${label}: separate accepted duels never share correlation`, () => assert.notEqual(first, second));
  }
  for (const cardId of [3, 8]) for (const status of ['protected', 'dodging']) {
    const label = `${cardId}-${status}`, s = fixture(cardId, cardId === 8 ? 8 : 7, 4); s.players[1][status] = true;
    const run = match(label, s); run.step('PLAY_CARD', { which: 'hand' }); noDuel(label, run.step('PICK_TARGET', { target: 1 }));
  }
  {
    const label = 'kaido-ignores-both-defenses', s = fixture(10, 7, 4); s.players[1].protected = s.players[1].dodging = true;
    const run = match(label, s); run.step('PLAY_CARD', { which: 'hand' }); inspect(label, run.step('PICK_TARGET', { target: 1 }), 7, 4, 0);
  }
  for (const [cardId, enhanced, keep] of [[8, true, 8], [10, true, 14], [10, true, 4], [13, false, 7]]) {
    const label = `${cardId}-nonduel-${keep}`, run = match(label, fixture(cardId, keep, 4, enhanced));
    noDuel(`${label}/play`, run.step('PLAY_CARD', { which: 'hand' }));
    if (cardId === 8) noDuel(label, run.step('LUFFY_BOOST_COMMIT', { go: true }));
    if (cardId === 13) noDuel(label, run.step('PICK_TARGET', { target: 1 }));
  }
  {
    const label = 'killer-fixed-target-cancel', run = match(label, fixture(13, 7, 4, true));
    run.step('PLAY_CARD', { which: 'hand' }); run.step('PICK_TARGET', { target: 1 });
    noDuel(`${label}/wrong-target`, run.step('PICK_TARGET', { target: 2, duel: true }));
    noDuel(`${label}/repeat-disarm`, run.step('PICK_TARGET', { target: 1 }));
    noDuel(label, run.step('PICK_CANCEL'));
  }
  for (const action of ['sanji', 'law', 'luffy', 'luffy-boost', 'kaido', 'killer']) {
    const s = fixture(3, 7, 4); s.pending = { action, extra: { keep: 7, boost: true, disarmedTarget: 1 } }; s.turnStep = 'pending';
    privacy(`${action}-pending-reconnect`, s, 7);
  }
  {
    const s = fixture(3, 7, 4); s.pending = { action: 'sanji', caster: 2, extra: { keep: 4 } };
    privacy('explicit-pending-caster', s, 4);
  }
  check('engine CRLF preserved', () => assert.equal(/(?<!\r)\n/.test(fs.readFileSync(source, 'utf8')), false));
  check('source stable during suite', () => assert.equal(sha(initialBytes), sha(fs.readFileSync(source))));
} catch (error) { failure = error.stack; }
const report = {
  schema: 1, base, engineSha256: sha(initialBytes), passed: !failure,
  checks: checks.length, failed: checks.filter(c => !c.pass).length,
  cases, assertions: checks, failure,
  limitations: ['Real engine and original committed-engine parity only; no running server, Socket.IO routing/auth, browser, physical device, deployment or reconnect transport acceptance.']
};
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, failed: report.failed, duels: ids.size, report: output, engineSha256: report.engineSha256, failure }));
if (failure) process.exitCode = 1;
