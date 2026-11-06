'use strict';

// Narrow Card regression: suppressed Zoro replacement and Law null-hand guards.
// Baseline is compiled from the exact Git blob, never rewritten or deployed.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const Module = require('node:module');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const engineFile = path.join(root, 'server', 'engine.js');
const baselineCommit = '9f0b62938193fdece0775585ac3b28cf2524b2d0';
const baselineSha = 'bd7f72c1f151b2cbc65b2df490aeee4a5078d68531851486d5ef13d4826ebd48';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const source = fs.readFileSync(engineFile);
const beforeBytes = cp.execFileSync('git', ['show', baselineCommit + ':server/engine.js'], { cwd: root, maxBuffer: 2e6 });
assert.equal(sha(beforeBytes), baselineSha, 'Exact unchanged baseline blob');
const baselineModule = new Module(engineFile + '.baseline', module);
baselineModule.filename = engineFile;
baselineModule.paths = Module._nodeModulePaths(path.dirname(engineFile));
baselineModule._compile(beforeBytes.toString('utf8'), engineFile);
const before = baselineModule.exports;
const after = require(engineFile);
const output = process.argv[2] || 'D:/Codex_QA/card-empty-hand-engine-20261107/engine-unit-final.json';
const report = {
  status: 'RUNNING',
  boundary: 'Node pure engine only; exact baseline Git blob versus candidate. No production room, public requests, source rewriting or deployment. Null-guard fixtures explicitly model historical corrupted retained hands; natural repro fixtures start with numeric physical cards and use real PLAY0.',
  source: { file: engineFile, bytes: source.length, sha256: sha(source), crlf: (source.toString().match(/\r\n/g) || []).length, bareLf: (source.toString().match(/(?<!\r)\n/g) || []).length },
  baseline: { commit: baselineCommit, bytes: beforeBytes.length, sha256: sha(beforeBytes) },
  cases: []
};
const clone = obj => JSON.parse(JSON.stringify(obj));
const valid = id => Number.isInteger(id) && id >= 0 && id <= 19;
const action = (type, playerId, payload) => ({ type, playerId, ...(payload ? { payload } : {}) });
const rng = seed => { let n = seed >>> 0; return () => { n = (Math.imul(n, 1664525) + 1013904223) >>> 0; return n / 4294967296; }; };
function randomRun(seed, fn) {
  const saved = Math.random;
  Math.random = typeof seed === 'function' ? seed : rng(seed);
  try { return fn(); } finally { Math.random = saved; }
}
function fixture({ hands = [6, 2, 4], draw = 8, top = [], venues = ['阿拉巴斯坦', '萬國'], deckOnly = false, flags = {}, step } = {}) {
  const state = randomRun(123, () => after.createInitialState(hands.length));
  const deck = [];
  for (const [id, count] of Object.entries(after.COUNTS)) for (let i = 0; i < count; i++) deck.push(Number(id));
  const take = id => { if (id == null) return; const at = deck.indexOf(id); assert(at >= 0, 'Physical card available: ' + id); deck.splice(at, 1); };
  hands.forEach(take); take(draw); top.forEach(take);
  state.players.forEach((p, id) => Object.assign(p, { hand: hands[id], tempDraw: id === 0 ? draw : null, alive: true, protected: false, dodging: false, frozen: false, skipNext: false, iceInfected: false, iceArmed: false }, flags[id] || {}));
  state.deck = (deckOnly ? [] : deck).concat(top.slice().reverse());
  state.discard = deckOnly ? deck : [];
  state.venues = venues.map(name => ({ name }));
  state.turnIndex = 0; state.turnStep = step || (draw == null ? 'draw' : 'choose'); state.pending = null;
  state.saboSilenceOn = false; state.saboSilenceOwner = null;
  return state;
}
function multiset(state) {
  const cards = [...state.deck, ...state.discard, ...state.players.flatMap(p => [p.hand, p.tempDraw])];
  const counts = {};
  for (const raw of cards) {
    if (raw == null) continue;
    const id = typeof raw === 'object' ? raw.id : raw;
    assert(valid(id), 'Numeric physical identity: ' + JSON.stringify(raw));
    counts[id] = (counts[id] || 0) + 1;
  }
  return counts;
}
function summary(state) {
  return { turn: state.turnIndex, step: state.turnStep, pending: clone(state.pending), silence: state.saboSilenceOn, nextRoundStart: state.nextRoundStart, players: state.players.map(p => ({ id: p.id, alive: p.alive, hand: p.hand, tempDraw: p.tempDraw, protected: p.protected, dodging: p.dodging })), deckCount: state.deck.length, deckTail: state.deck.slice(-5), discard: clone(state.discard) };
}
function run(engine, initial, actions, seed = 867) {
  return randomRun(seed, () => {
    let state = clone(initial); const steps = []; const physical = multiset(initial);
    for (const a of actions) {
      const result = engine.applyAction(state, a);
      state = result.state;
      assert.deepEqual(multiset(state), physical, 'Conserved physical card multiset after ' + a.type);
      steps.push({ action: a, state: summary(state), emits: result.emits });
    }
    return { state, emits: steps.flatMap(s => s.emits), steps };
  });
}
let current;
function check(name, condition, detail) {
  current.checks.push({ name, pass: !!condition, ...(detail === undefined ? {} : { detail }) });
  assert(condition, name);
}
function test(name, fn) {
  current = { name, checks: [] }; report.cases.push(current);
  try { fn(); current.pass = true; } catch (error) { current.pass = false; current.error = error.stack; }
}
function unchanged(initial, actions) {
  const old = run(before, initial, actions), now = run(after, initial, actions);
  assert.deepEqual(now, old, 'Unchanged baseline outcome/state/events');
  check('Exact baseline outcome, state and events unchanged', true);
  current.final = summary(now.state);
  return now;
}
function lawInitial({ hand = 8, targetHand = 2, boost = false, flags = {} } = {}) {
  return fixture({ hands: [hand, targetHand, 4], draw: 6, venues: boost ? ['龐克哈薩德', '萬國'] : ['阿拉巴斯坦', '萬國'], flags });
}
const lawPlay = action('PLAY_CARD', 0, { which: 'drawn' });
const pick = (target, payload = {}, playerId = 0) => action('PICK_TARGET', playerId, { target, ...payload });
function checkNullFailure(result, initial) {
  check('Pending clears and normal next turn continues', result.state.pending === null && result.state.turnIndex === 1 && result.state.turnStep === 'draw', summary(result.state));
  check('Both retained hands stay with original owner', result.state.players[0].hand === initial.players[0].hand && result.state.players[1].hand === initial.players[1].hand);
  check('No null face, peek, exchange or defensive effect emitted', !result.emits.some(e => ['law_view', 'peek', 'law_swap', 'card_defense'].includes(e.type)));
  check('Protection and dodge are not consumed', result.state.players[1].protected === initial.players[1].protected && result.state.players[1].dodging === initial.players[1].dodging);
}

// Unaffected valid paths, including card 0 and the legacy self-target behavior.
for (const boost of [false, true]) {
  for (const [label, hand, targetHand, target] of [['normal', 8, 2, 1], ['retain0', 0, 2, 1], ['receive0', 8, 0, 1], ['legacy-self', 8, 2, 0]]) {
    test(`Law ${boost ? 'enhanced direct' : 'ordinary'} ${label} is baseline-identical`, () => {
      const initial = lawInitial({ hand, targetHand, boost });
      const result = unchanged(initial, [lawPlay, pick(target, boost ? { swap: true } : {})]);
      check('Successful law_swap still emitted', result.emits.some(e => e.type === 'law_swap'));
      check('All live retained hands numeric', result.state.players.every(p => !p.alive || valid(p.hand)));
    });
  }
  for (const defense of ['protected', 'dodging']) {
    test(`Law ${boost ? 'enhanced' : 'ordinary'} valid ${defense} remains baseline-identical`, () => {
      const initial = lawInitial({ boost, flags: { 1: { [defense]: true } } });
      const result = unchanged(initial, [lawPlay, pick(1, boost ? { swap: true } : {})]);
      check('Guard blocks valid exchange', !result.emits.some(e => e.type === 'law_swap') && result.state.players[0].hand === 8 && result.state.players[1].hand === 2);
      check('Existing guard precedence and consumption preserved', result.state.players[1][defense] === (defense === 'protected'));
    });
  }
}
for (const boost of [false, true]) {
  for (const [label, hand, targetHand] of [['empty-target', 8, null], ['empty-caster', null, 2], ['both-empty', null, null]]) {
    for (const defense of ['none', 'protected', 'dodging']) {
      test(`Historical ${label}, ${boost ? 'enhanced' : 'ordinary'}, ${defense}: no null transfer`, () => {
        const initial = lawInitial({ hand, targetHand, boost, flags: defense === 'none' ? {} : { 1: { [defense]: true } } });
        const prepared = run(after, initial, [lawPlay]).state;
        const result = run(after, prepared, [pick(1, boost ? { swap: true } : {})]);
        checkNullFailure(result, prepared);
      });
    }
  }
}
for (const [label, hand, targetHand] of [['empty-target', 8, null], ['empty-caster', null, 2]]) {
  test(`Enhanced preview ${label} cannot expose a null face`, () => {
    const initial = run(after, lawInitial({ hand, targetHand, boost: true }), [lawPlay]).state;
    checkNullFailure(run(after, initial, [pick(1, { preview: true })]), initial);
  });
}
test('Enhanced valid two-step peek and swap remain baseline-identical', () => {
  const result = unchanged(lawInitial({ boost: true }), [lawPlay, pick(1, { preview: true }), pick(1, { swap: true })]);
  check('View appears once, swap appears once', result.emits.filter(e => e.type === 'law_view').length === 1 && result.emits.filter(e => e.type === 'law_swap').length === 1);
});
test('Enhanced valid peek then decline remains baseline-identical', () => {
  const result = unchanged(lawInitial({ boost: true }), [lawPlay, pick(1, { preview: true }), action('PICK_CANCEL', 0)]);
  check('Decline ends without exchange', result.state.pending === null && !result.emits.some(e => e.type === 'law_swap'));
});
for (const boost of [false, true]) {
  for (const [label, request] of [['wrong-actor', pick(1, boost ? { swap: true } : {}, 2)], ['invalid-target', pick(99, boost ? { swap: true } : {})], ['fractional-target', pick(1.5, boost ? { swap: true } : {})]]) {
    test(`Empty Law ${boost ? 'enhanced' : 'ordinary'} ${label} cannot clear pending`, () => {
      const initial = run(after, lawInitial({ targetHand: null, boost }), [lawPlay]).state;
      const result = run(after, initial, [request]);
      assert.deepEqual(result.state, initial); assert.deepEqual(result.emits, []);
      check('Unauthorized/invalid action is a full state and event no-op', true);
    });
  }
}
for (const [label, request] of [['wrong-actor-preview', pick(1, { preview: true }, 2)], ['self-preview', pick(0, { preview: true })]]) {
  test('Enhanced empty ' + label + ' preserves authorization order', () => {
    const initial = run(after, lawInitial({ hand: null, targetHand: null, boost: true }), [lawPlay]).state;
    const result = run(after, initial, [request]);
    assert.deepEqual(result.state, initial); assert.deepEqual(result.emits, []);
    check('Rejected before null failure and pending unchanged', true);
  });
}
test('Enhanced locked preview rejects changed target and wrong actor before null failure', () => {
  let state = run(after, lawInitial({ boost: true }), [lawPlay, pick(1, { preview: true })]).state;
  // Models a historical empty hand while a legitimate preview is already locked.
  state.discard.push(state.players[1].hand); state.players[1].hand = null;
  for (const request of [pick(2, { swap: true }), pick(1, { swap: true }, 2), pick(0, { swap: true })]) {
    const result = run(after, state, [request]);
    assert.deepEqual(result.state, state); assert.deepEqual(result.emits, []);
  }
  check('All forbidden mutations preserve locked pending and all fields', true);
  const result = run(after, state, [pick(1, { swap: true })]);
  checkNullFailure(result, state);
});

// Zoro passives and ordinary replacement paths outside the fix must be identical.
for (const [label, thrown, venues] of [
  ['ordinary replacement', 2, ['阿拉巴斯坦', '萬國']],
  ['unboosted9 elimination', 9, ['阿拉巴斯坦', '萬國']],
  ['unboosted19 elimination and next starter', 19, ['阿拉巴斯坦', '萬國']],
  ['Kuja9 protects and redraws', 9, ['九蛇島', '萬國']],
  ['Oro19 redraws and opens prediction', 19, ['奧羅傑克森號', '萬國']],
  ['Wano even elimination', 2, ['和之國', '萬國']],
  ['Wano odd replacement', 3, ['和之國', '萬國']]
]) {
  test('Non-silenced Zoro: ' + label, () => {
    const initial = fixture({ hands: [5, thrown, 1], draw: 4, top: [8], venues });
    const result = unchanged(initial, [action('PLAY_CARD', 0, { which: 'hand' }), pick(1)]);
    if (label.includes('unboosted19')) check('Roger next starter retained', result.state.nextRoundStart === 1);
    if (label.includes('Oro19')) check('Oro Roger prediction retained', result.state.pending?.action === 'roger' && result.state.pending.caster === 1);
  });
}
for (const defense of ['protected', 'dodging']) {
  test('Zoro existing ' + defense + ' remains baseline-identical', () => {
    const initial = fixture({ hands: [5, 9, 2], draw: 4, flags: { 1: { [defense]: true } } });
    unchanged(initial, [action('PLAY_CARD', 0, { which: 'hand' }), pick(1)]);
  });
}

function naturalPrefix(engine, initial, seed, zoroTarget) {
  return run(engine, initial, [action('PLAY_CARD', 0, { which: 'hand' }), action('DRAW', 1), action('PLAY_CARD', 1, { which: 'hand' }), action('PICK_TARGET', 1, { target: zoroTarget })], seed);
}
function finishHarmlessTurn(engine, input, playerId) {
  const actions = [action('DRAW', playerId), action('PLAY_CARD', playerId, { which: 'drawn' })];
  let result = run(engine, input, actions), state = result.state;
  if (state.pending?.action === 'robin' || state.pending?.action === 'usopp') {
    const target = state.players.find(p => p.id !== playerId && p.id !== 2 && p.alive && valid(p.hand)).id;
    const pickAction = action('PICK_TARGET', playerId, { target }); actions.push(pickAction);
    state = run(engine, state, [pickAction]).state;
    if (state.pending?.action === 'usopp') {
      let digit = (state.players[target].hand % 10 + 1) % 10; if (digit === 1) digit = 2;
      actions.push(action('PICK_DIGIT', playerId, { digit }));
    }
  }
  return run(engine, input, actions);
}
test('Natural seed1154 original 8-step null transfer before / numeric recovery after', () => {
  const initial = fixture({ hands: [0, 5, 9, 2], draw: 4, venues: ['德雷斯羅薩鬥技場', '佐烏'] });
  const oldPrefix = naturalPrefix(before, initial, 1154, 2);
  check('Baseline true PLAY0 silence leaves live null target', oldPrefix.state.saboSilenceOn && oldPrefix.state.players[2].alive && oldPrefix.state.players[2].hand === null);
  const old = run(before, oldPrefix.state, [action('DRAW', 2), action('PLAY_CARD', 2, { which: 'drawn' }), action('PICK_TARGET', 2, { target: 3 }), action('DRAW', 3)]);
  check('Baseline eighth action leaves only new tempDraw', old.state.players[3].hand === null && valid(old.state.players[3].tempDraw) && old.state.turnStep === 'choose');
  const fixedPrefix = naturalPrefix(after, initial, 1154, 2);
  check('Replacement immediately restores numeric retained hand', fixedPrefix.state.players[2].hand === 6 && fixedPrefix.state.players[2].alive);
  const fixed = run(after, fixedPrefix.state, [action('DRAW', 2), action('PLAY_CARD', 2, { which: 'hand' }), action('PICK_TARGET', 2, { target: 3 }), action('DRAW', 3)]);
  check('Adapted legal Law slot retains numeric returned hand plus next draw', valid(fixed.state.players[3].hand) && valid(fixed.state.players[3].tempDraw) && fixed.state.turnStep === 'choose');
  current.before = { seed: 1154, initial: summary(initial), steps: [...oldPrefix.steps, ...old.steps] };
  current.after = { seed: 1154, steps: [...fixedPrefix.steps, ...fixed.steps], note: 'Replacement consumes card6, so real Law6 is now in hand instead of drawn; action slot follows the real card.' };
});
test('Natural seed50705 user direction: nonempty Law caster receives null before / valid after next DRAW', () => {
  const initial = fixture({ hands: [0, 5, 6], draw: 4, venues: ['德雷斯羅薩鬥技場', '佐烏'] });
  const execute = engine => {
    const prefix = naturalPrefix(engine, initial, 50705, 0);
    const swap = run(engine, prefix.state, [action('DRAW', 2), action('PLAY_CARD', 2, { which: 'hand' }), action('PICK_TARGET', 2, { target: 0 })]);
    const p0 = finishHarmlessTurn(engine, swap.state, 0);
    const p1 = finishHarmlessTurn(engine, p0.state, 1);
    const next = run(engine, p1.state, [action('DRAW', 2)]);
    return { prefix, swap, next, steps: [...prefix.steps, ...swap.steps, ...p0.steps, ...p1.steps, ...next.steps] };
  };
  const old = execute(before), fixed = execute(after);
  check('Baseline exact15ACTION natural symptom reproduced', old.steps.length === 15 && old.prefix.state.players[0].hand === null && old.swap.state.players[2].hand === null && old.swap.state.players[0].hand === 8 && old.next.state.players[2].hand === null && old.next.state.players[2].tempDraw === 1);
  check('New prefix refills target8 and Law caster draws2', fixed.prefix.state.players[0].hand === 8 && fixed.swap.steps[0].state.players[2].tempDraw === 2);
  check('Law swaps two actual numeric cards and user keeps8', fixed.swap.state.players[2].hand === 8 && fixed.swap.state.players[0].hand === 2);
  check('Natural next own DRAW shows returned8 plus new numeric card', fixed.next.state.turnIndex === 2 && fixed.next.state.turnStep === 'choose' && fixed.next.state.players[2].hand === 8 && valid(fixed.next.state.players[2].tempDraw));
  const visible = after.getVisibleState(fixed.next.state, 2).players[2];
  check('Self state projection keeps both numeric identities', visible.hand === 8 && valid(visible.tempDraw));
  current.before = { seed: 50705, initial: summary(initial), steps: old.steps };
  current.after = { seed: 50705, steps: fixed.steps, visibleSelf: visible };
});
for (const thrown of [9, 19]) {
  for (const deckCase of ['empty-after-draw', 'last-replacement', 'nonempty']) {
    test(`True PLAY0 silence -> Zoro${thrown}, ${deckCase}: replacement or ordinary end`, () => {
      const top = deckCase === 'empty-after-draw' ? [8] : deckCase === 'last-replacement' ? [2, 8] : [2, 8, 3];
      const initial = fixture({ hands: [0, 5, thrown], draw: 4, top, deckOnly: true, venues: ['德雷斯羅薩鬥技場', '奧羅傑克森號'] });
      const result = naturalPrefix(after, initial, () => .999999, 0);
      check('Silence came from actual PLAY0, no manual flag', result.steps[0].state.silence && result.steps[0].state.players[0].hand === thrown);
      check('Suppressed9/19 does not eliminate or open prediction/start rule', result.state.players[0].alive && result.state.pending === null && result.state.nextRoundStart == null && !result.emits.some(e => e.type === 'toast' && String(e.text || '').includes('預測')));
      if (deckCase === 'nonempty') check('Live round refills8 and continues normally', result.state.players[0].hand === 8 && result.state.deck.length === 1 && result.state.turnStep === 'draw');
      else check('Exhausted deck resolves existing round instead of live null choose', result.state.turnStep === 'ended' && result.state.deck.length === 0);
      if (deckCase === 'last-replacement') check('Last physical replacement is retained8', result.state.players[0].hand === 8);
      current.trace = result.steps;
    });
  }
}
test('Historical empty Law at empty deck resolves without refill or guard consumption', () => {
  const initial = fixture({ hands: [null, 8, 2], draw: 6, deckOnly: true, venues: ['龐克哈薩德', '萬國'], flags: { 1: { dodging: true } } });
  const result = run(after, initial, [lawPlay, pick(1, { swap: true })]);
  check('Normal exhausted-deck showdown completes', result.state.turnStep === 'ended' && result.state.pending === null);
  check('No view, exchange, or defensive effect at empty swap', !result.emits.some(e => ['law_view', 'law_swap', 'card_defense'].includes(e.type)) && result.state.players[1].dodging);
});
test('DRAW behavior is intentionally unchanged for historical bad rooms', () => {
  const initial = fixture({ hands: [null, 8, 2], draw: null, top: [4] });
  const result = unchanged(initial, [action('DRAW', 0)]);
  check('No extra repair draw or deck consumption added', result.state.players[0].hand === null && result.state.players[0].tempDraw === 4 && result.state.deck.length === initial.deck.length - 1);
});
test('Teach-covered discard -> Kid11 -> Law6 identities remain numeric and baseline-identical', () => {
  const initial = fixture({ hands: [17, 11, 2], draw: 4, top: [6, 5], venues: ['九蛇島', '佐烏'] });
  const actions = [action('PLAY_CARD', 0, { which: 'hand' }), action('DRAW', 1), action('PLAY_CARD', 1, { which: 'hand' }), action('PLAY_CARD', 1, { which: 'drawn' }), action('PICK_TARGET', 1, { target: 2 })];
  const old = run(before, initial, actions, () => .999999), fixed = run(after, initial, actions, () => .999999);
  assert.deepEqual(fixed, old);
  check('Teach covered object is read as numeric6 before Law', fixed.steps[0].state.discard.some(x => x?.id === 6 && x.coverBy === 'teach') && fixed.steps[2].state.players[1].tempDraw === 6);
  check('Final swapped identities remain2 and5', fixed.state.players[1].hand === 2 && fixed.state.players[2].hand === 5);
});

report.sourceUnchangedDuringQA = sha(fs.readFileSync(engineFile)) === report.source.sha256;
report.totals = { cases: report.cases.length, passed: report.cases.filter(c => c.pass).length, failed: report.cases.filter(c => !c.pass).length, checks: report.cases.reduce((n, c) => n + c.checks.length, 0) };
report.status = !report.totals.failed && report.sourceUnchangedDuringQA && !report.source.bareLf ? 'PASS' : 'FAIL';
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ status: report.status, ...report.totals, source: report.source, output, failures: report.cases.filter(c => !c.pass).map(c => ({ name: c.name, error: c.error })) }));
if (report.status !== 'PASS') process.exitCode = 1;
