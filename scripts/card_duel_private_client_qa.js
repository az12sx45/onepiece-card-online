'use strict';
// Execute the two real client modules in isolated VMs with deterministic clocks.
// The scene itself is a controlled callback; this does not verify browser pixels.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const files = ['public/js/card-duel-private.js', 'public/js/card-duel-runtime.js', 'server/engine.js'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const bytes = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(root, f))]));
const source = Object.fromEntries(files.map(f => [f, bytes[f].toString('utf8')]));
const output = path.resolve(process.env.CARD_DUEL_CLIENT_REPORT || 'D:/Codex_QA/card-duel-stage-20261106/client-privacy-report.json');
const tests = [];
function test(name, fn) {
  tests.push({ name, fn });
}
function harness(modules = ['private'], viewer = 0) {
  let now = 1000, serial = 0;
  const jobs = new Map(), handlers = new Map(), any = [], docHandlers = new Map(), winHandlers = new Map();
  const trace = { stages: [], late: [], restored: 0, cancelledAnimations: 0, oldCalls: 0, imageUrls: [] };
  const flags = { originalBusy: false, cpuFast: false, lateBusy: false, imageMode: 'ready' };
  function on(map, key, fn) { if (!map.has(key)) map.set(key, []); map.get(key).push(fn); }
  function fire(map, key, payload) { for (const fn of (map.get(key) || []).slice()) fn(payload); }
  function setTimeout(fn, ms = 0) { const id = ++serial; jobs.set(id, { at: now + Math.max(0, ms), fn }); return id; }
  function clearTimeout(id) { jobs.delete(id); }
  function advance(ms) {
    const end = now + ms;
    let guard = 0;
    while (true) {
      const next = [...jobs].filter(([, j]) => j.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!next) break;
      assert(++guard < 10000, 'timer loop did not settle');
      jobs.delete(next[0]); now = next[1].at; next[1].fn();
    }
    now = end;
  }
  class Node {
    constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.hidden = false; this.className = ''; this.id = ''; }
    get classList() { return { contains: name => this.className.split(/\s+/).includes(name) }; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    getClientRects() { return this.hidden ? [] : [{}]; }
    getBoundingClientRect() { return { left: 20, top: 20, width: 40, height: 60 }; }
    querySelector() { return null; }
    animate() { return { finished: Promise.resolve(), cancel() { trace.cancelledAnimations++; } }; }
  }
  const body = new Node('body');
  const find = (node, id) => node.id === id ? node : node.children.map(n => find(n, id)).find(Boolean);
  const document = {
    readyState: 'complete', hidden: false, baseURI: 'https://qa.invalid/game.html', body, documentElement: { dataset: {} },
    createElement: tag => new Node(tag), getElementById: id => find(body, id),
    addEventListener: (event, fn) => on(docHandlers, event, fn)
  };
  const api = {
    duelSceneVersion: 4, duelStageDuration: 100,
    isEffectBusy: () => flags.originalBusy,
    attachDuelDetails: value => ({ ...value }),
    restoreHandArt: () => trace.restored++,
    playDuelScene(options) {
      trace.stages.push({ id: options.d.duelId, at: now, details: options.d });
      const art = options.make('i', 'qa-scene-art'); options.scene.append(art);
      options.animate(art, [{ opacity: 0 }, { opacity: 1 }], 80);
      options.later(() => trace.late.push({ id: options.d.duelId, at: now }), 50);
    }
  };
  const socket = {
    onAny: fn => any.push(fn), on: (event, fn) => on(handlers, event, fn)
  };
  class ClockDate extends Date { static now() { return now; } }
  class Image {
    constructor() { this.complete = false; this.naturalWidth = 0; }
    set src(url) {
      this._src = url; trace.imageUrls.push(url);
      if (flags.imageMode === 'pending') return;
      this.complete = true; this.naturalWidth = 100; this.onload?.();
    }
    get src() { return this._src; }
    decode() { return Promise.resolve(); }
  }
  const ctx = {
    window: { CardPhonePresentation: api, addEventListener: (e, fn) => on(winHandlers, e, fn) },
    document, socket, me: { playerId: viewer, roomId: 'privacy-room-A' },
    state: { roundNo: 1, pending: { extra: { keep: 17 } }, players: [{ id: 0, hand: 17 }, { id: 1, hand: 14 }] },
    playDuel() { trace.oldCalls++; }, isCpuSkipFastMode: () => flags.cpuFast,
    setTimeout, clearTimeout, Date: ClockDate, Image, URL, innerWidth: 740, innerHeight: 360,
    matchMedia: () => ({ matches: false })
  };
  vm.createContext(ctx);
  for (const module of modules) vm.runInContext(source[`public/js/card-duel-${module}.js`], ctx, { filename: `card-duel-${module}.js` });
  advance(0);
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    ctx, api, document, flags, trace, advance, flush,
    async tick(ms) { advance(ms); await flush(); },
    incoming(event, value) { for (const fn of any.slice()) fn(event, value); fire(handlers, event, value); },
    doc(event) { fire(docHandlers, event); }, win(event) { fire(winHandlers, event); },
    play(value) { return ctx.playDuel(value); }, layer: () => document.getElementById('cardDuelLayer')
  };
}
const duel = (id = 'duel-A', extra = {}) => ({ type: 'duel', to: 'all', duelId: id, leftId: 0, rightId: 1, winnerId: 0, ...extra });
const packet = (id = 'duel-A', extra = {}) => ({ type: 'duel_private', to: 0, duelId: id, leftId: 0, rightId: 1, leftCardId: 17, rightCardId: 14, ...extra });
const log = (id = 'duel-A', extra = {}) => ({ type: 'duel_log', to: 'all', duelId: id, loserId: 1, cardId: 14, ...extra });
const remember = (h, id = 'duel-A', extra = {}) => h.incoming('EMIT', packet(id, extra));
const prepare = (h, id = 'duel-A', extra = {}, publicLog = log(id)) => h.api.prepareDuelDetails(duel(id, extra), publicLog);
const hasCards = value => !!value.privateCards;
const cards = value => ({ ...value.privateCards });

for (const viewer of [0, 1]) test(`participant ${viewer} receives both original card IDs`, () => {
  const h = harness(['private'], viewer); remember(h, 'participant', { to: viewer });
  assert.deepEqual(cards(prepare(h, 'participant')), { 0: 17, 1: 14 });
});
for (const [name, viewer, extra] of [
  ['broadcast private event', 0, { to: 'all' }], ['wrong recipient', 0, { to: 1 }],
  ['spectator addressed directly', 2, { to: 2 }], ['string recipient', 0, { to: '0' }],
  ['missing correlation', 0, { duelId: undefined }], ['empty correlation', 0, { duelId: '' }],
  ['oversize correlation', 0, { duelId: 'x'.repeat(101) }], ['same two sides', 0, { rightId: 0 }],
  ['fractional side', 0, { rightId: 1.5 }], ['missing card', 0, { leftCardId: undefined }],
  ['negative card', 0, { leftCardId: -1 }], ['out-of-range card', 0, { rightCardId: 20 }],
  ['fractional card', 0, { rightCardId: 1.5 }], ['string card', 0, { leftCardId: '17' }]
]) test(`rejects ${name}`, () => {
  const h = harness(['private'], viewer); remember(h, 'invalid', extra);
  assert.equal(hasCards(prepare(h, 'invalid')), false);
});
test('non-EMIT or unrelated events cannot supply private cards', () => {
  const h = harness(); h.incoming('STATE', packet()); h.incoming('EMIT', { ...packet(), type: 'law_view' });
  assert.equal(hasCards(prepare(h)), false);
});
test('STATE and pending keep never become duel projection sources', () => {
  const h = harness();
  assert.equal(hasCards(prepare(h)), false);
  assert.equal(hasCards(prepare(h, 'injected', { privateCards: { 0: 17, 1: 14 } })), false);
});
test('same ID with reversed or different sides cannot join private cards', () => {
  for (const pair of [{ leftId: 1, rightId: 0 }, { leftId: 0, rightId: 2 }]) {
    const h = harness(); remember(h); assert.equal(hasCards(prepare(h, 'duel-A', pair)), false);
  }
});
test('a different duel ID cannot consume a pending projection', () => {
  const h = harness(); remember(h); assert.equal(hasCards(prepare(h, 'duel-B')), false);
  assert.deepEqual(cards(prepare(h)), { 0: 17, 1: 14 });
});
test('private projection consumes once and duplicate event cannot re-arm it', () => {
  const h = harness(); remember(h); assert(hasCards(prepare(h)));
  assert.equal(hasCards(prepare(h)), false); remember(h);
  assert.equal(hasCards(prepare(h)), false);
});
test('duplicate packet cannot overwrite the first authenticated projection', () => {
  const h = harness(); remember(h); remember(h, 'duel-A', { leftCardId: 2, rightCardId: 3 });
  assert.deepEqual(cards(prepare(h)), { 0: 17, 1: 14 });
});
test('committingPresentation never consumes the private projection', () => {
  const h = harness(); remember(h); h.api.committingPresentation = true;
  assert.equal(hasCards(prepare(h)), false); h.api.committingPresentation = false;
  assert.deepEqual(cards(prepare(h)), { 0: 17, 1: 14 });
});
test('expired projection is rejected', () => {
  const h = harness(); remember(h); h.advance(300001); assert.equal(hasCards(prepare(h)), false);
});
test('room or viewer identity changes cannot inherit private cards', () => {
  for (const change of ['room', 'viewer']) {
    const h = harness(); remember(h);
    if (change === 'room') h.ctx.me.roomId = 'privacy-room-B'; else h.ctx.me.playerId = 1;
    assert.equal(hasCards(prepare(h)), false);
  }
});
for (const reason of ['JOINED', 'disconnect', 'hidden', 'explicit clear']) test(`${reason} clears private cards and rejects old replay`, () => {
  const h = harness(); remember(h);
  if (reason === 'hidden') { h.document.hidden = true; h.doc('visibilitychange'); h.document.hidden = false; }
  else if (reason === 'explicit clear') h.api.clearDuelPrivate();
  else h.incoming(reason);
  assert.equal(hasCards(prepare(h)), false); remember(h); assert.equal(hasCards(prepare(h)), false);
  remember(h, 'fresh'); assert(hasCards(prepare(h, 'fresh')));
});
test('bounded pending storage rejects the evicted card payload without affecting newest', () => {
  const h = harness(); for (let i = 0; i < 65; i++) remember(h, `bounded-${i}`);
  assert.equal(hasCards(prepare(h, 'bounded-0')), false); assert(hasCards(prepare(h, 'bounded-64')));
});
test('public loser card joins only same duel ID and an actual side', () => {
  const h = harness();
  for (const invalid of [log('other'), log('duel-A', { loserId: 3 }), log('duel-A', { cardId: 20 })]) {
    const result = prepare(h, 'duel-A', {}, invalid);
    assert.equal(result.loserCardId, undefined); assert.equal(result.loserSide, null);
  }
  const result = prepare(h, 'duel-A', {}, log('duel-A', { cardId: 0 }));
  assert.equal(result.loserCardId, 0); assert.equal(result.loserSide, 'right');
});
test('legacy missing-ID loser log cannot bind to identified duel', () => {
  const h = harness(); assert.equal(prepare(h, 'duel-A', {}, log(undefined, { duelId: undefined })).loserCardId, undefined);
});
test('retained raw opts receive private cards and cached public loser correction at runtime entry', async () => {
  const h = harness(['private', 'runtime']); remember(h, 'retained'); h.incoming('EMIT', log('retained'));
  h.play(duel('retained', { loserSide: 'left', loserCardId: 17 })); await h.flush();
  const details = h.trace.stages[0].details;
  assert.deepEqual(cards(details), { 0: 17, 1: 14 });
  assert.equal(details.loserSide, 'right'); assert.equal(details.loserCardId, 14);
});
test('prepared online opts retain issued private cards through runtime attach', async () => {
  const h = harness(['private', 'runtime']); remember(h, 'online');
  const prepared = prepare(h, 'online'); assert.deepEqual(cards(prepared), { 0: 17, 1: 14 });
  h.play(prepared); await h.flush();
  assert.deepEqual(cards(h.trace.stages[0].details), { 0: 17, 1: 14 });
  assert.equal(h.trace.stages[0].details.loserCardId, 14);
});
test('issued proof defensively copies private values when reprojected', () => {
  const h = harness(); remember(h); const issued = prepare(h);
  issued.privateCards[0] = 2; issued.privateCards[1] = 3;
  assert.deepEqual(cards(h.api.attachDuelDetails(issued)), { 0: 17, 1: 14 });
});
test('a different raw object replay cannot reuse consumed private cards', async () => {
  const h = harness(['private', 'runtime']); remember(h, 'raw-once'); h.incoming('EMIT', log('raw-once'));
  h.play(duel('raw-once')); await h.flush(); assert(hasCards(h.trace.stages[0].details));
  await h.tick(100); h.play(duel('raw-once')); await h.flush();
  assert.equal(hasCards(h.trace.stages[1].details), false);
});
test('clear invalidates an already-issued object and copied forged map', () => {
  const h = harness(); remember(h); const issued = prepare(h); h.api.clearDuelPrivate();
  assert.equal(hasCards(h.api.attachDuelDetails(issued)), false);
  assert.equal(hasCards(h.api.attachDuelDetails({ ...issued })), false);
});
test('forged caller private maps never pass the bridge or runtime', async () => {
  const h = harness(['private', 'runtime']);
  h.play(duel('forged', { privateCards: { 0: 17, 1: 14 } })); await h.flush();
  assert.equal(hasCards(h.trace.stages[0].details), false);
});
test('issued proof cannot cross room, viewer, sides, duel ID, or expiry', () => {
  for (const change of ['room', 'viewer', 'sides', 'id', 'expiry']) {
    const h = harness(); remember(h); const issued = prepare(h);
    if (change === 'room') h.ctx.me.roomId = 'other-room';
    if (change === 'viewer') h.ctx.me.playerId = 1;
    if (change === 'sides') issued.rightId = 2;
    if (change === 'id') issued.duelId = 'other-duel';
    if (change === 'expiry') h.advance(300001);
    assert.equal(hasCards(h.api.attachDuelDetails(issued)), false, change);
  }
});
test('public cache never binds a different UUID or a non-public loser event', () => {
  const h = harness(); h.incoming('EMIT', log('other')); h.incoming('EMIT', log('not-public', { to: 0 }));
  for (const id of ['duel-A', 'not-public']) {
    const projected = h.api.attachDuelDetails(duel(id, { loserSide: 'right', loserCardId: 14 }));
    assert.equal(projected.loserCardId, undefined); assert.equal(projected.loserSide, null);
  }
});
test('public cached loser event is keyed once and preserves same-proof reattachment', () => {
  const h = harness(); h.incoming('EMIT', log()); h.incoming('EMIT', log('duel-A', { cardId: 3 }));
  const issued = h.api.attachDuelDetails(duel());
  assert.equal(issued.loserCardId, 14); assert.equal(h.api.attachDuelDetails(issued).loserCardId, 14);
});
test('old server without UUID retains its original public loser fields', async () => {
  const h = harness(['private', 'runtime']);
  const original = { leftId: 0, rightId: 1, winnerId: 0, loserSide: 'right', loserCardId: 14 };
  h.play(original); await h.flush();
  assert.equal(h.trace.stages[0].details.loserCardId, 14); assert.equal(h.trace.stages[0].details.loserSide, 'right');
  assert.equal(hasCards(h.trace.stages[0].details), false);
});
test('runtime committing guard occurs before attach can consume pending cards', async () => {
  const h = harness(['private', 'runtime']); remember(h, 'commit-guard');
  h.api.committingPresentation = true; h.play(duel('commit-guard')); await h.flush();
  assert.equal(h.trace.stages.length, 0); h.api.committingPresentation = false;
  h.play(duel('commit-guard')); await h.flush(); assert(hasCards(h.trace.stages[0].details));
});

test('runtime combines original FX busy and queued duel without early unlock', async () => {
  const h = harness(['runtime']); h.flags.originalBusy = true; h.play(duel());
  assert.equal(h.trace.stages.length, 0); assert.equal(h.api.isEffectBusy(), true);
  await h.tick(200); assert.equal(h.trace.stages.length, 0);
  h.flags.originalBusy = false; await h.tick(50); assert.equal(h.trace.stages.length, 1);
  h.flags.originalBusy = true; await h.tick(100); assert.equal(h.api.isEffectBusy(), true);
  h.flags.originalBusy = false; assert.equal(h.api.isEffectBusy(), false);
});
test('two runtime stages stay busy continuously and restore hand after final stage', async () => {
  const h = harness(['runtime']); h.play(duel('first')); h.play(duel('second'));
  assert.equal(h.api.isEffectBusy(), true); await h.flush();
  assert.equal(h.trace.stages.length, 1); await h.tick(99); assert.equal(h.api.isEffectBusy(), true);
  await h.tick(1); assert.deepEqual(h.trace.stages.map(s => s.id), ['first', 'second']);
  assert.equal(h.api.isEffectBusy(), true); assert.equal(h.trace.restored, 0);
  await h.tick(99); assert.equal(h.api.isEffectBusy(), true); await h.tick(1);
  assert.equal(h.api.isEffectBusy(), false); assert.equal(h.trace.restored, 1);
  assert.equal(h.layer().hidden, true); assert.equal(h.layer().children.length, 0);
});
test('later busy wrapper cannot trap queued runtime forever', async () => {
  const h = harness(['runtime']), previous = h.api.isEffectBusy;
  h.api.isEffectBusy = () => h.flags.lateBusy || previous();
  h.play(duel()); await h.flush(); await h.tick(100);
  assert.equal(h.trace.stages.length, 1); assert.equal(h.api.isEffectBusy(), false);
});
test('committing, CPU fast, hidden, invalid side pair never starts runtime', () => {
  const h = harness(['runtime']); h.api.committingPresentation = true; h.play(duel()); h.api.committingPresentation = false;
  h.flags.cpuFast = true; h.play(duel()); h.flags.cpuFast = false;
  h.document.hidden = true; h.play(duel()); h.document.hidden = false;
  h.play(duel('same', { rightId: 0 })); h.play(duel('fraction', { leftId: 0.5 }));
  assert.equal(h.trace.stages.length, 0); assert.equal(h.api.isEffectBusy(), false);
});
for (const reason of ['cancel', 'JOINED', 'disconnect', 'hidden', 'pagehide', 'new round']) test(`${reason} cancels active/queued stages and all stale callbacks/private records`, async () => {
  const h = harness(['private', 'runtime']); h.incoming('STATE', { roundNo: 1 }); remember(h, 'old-private');
  h.play(duel('old-active')); h.play(duel('old-queued')); await h.flush(); await h.tick(20);
  if (reason === 'cancel') h.api.cancelDuelStages();
  else if (reason === 'hidden') { h.document.hidden = true; h.doc('visibilitychange'); h.document.hidden = false; }
  else if (reason === 'pagehide') h.win('pagehide');
  else if (reason === 'new round') h.incoming('STATE', { roundNo: 2 });
  else h.incoming(reason);
  assert.equal(h.api.isEffectBusy(), false); assert.equal(h.layer().hidden, true); assert.equal(h.layer().children.length, 0);
  assert(h.trace.cancelledAnimations > 0); assert(h.trace.restored > 0);
  await h.tick(1000); assert.equal(h.trace.stages.length, 1); assert.equal(h.trace.late.length, 0);
  assert.equal(hasCards(prepare(h, 'old-private')), false); remember(h, 'old-private'); assert.equal(hasCards(prepare(h, 'old-private')), false);
  remember(h, 'fresh-private'); const next = prepare(h, 'fresh-private'); assert(hasCards(next));
  h.play(next); await h.flush(); assert.equal(h.trace.stages.length, 2); assert.equal(h.api.isEffectBusy(), true);
});
test('same-round STATE does not cancel an active duel', async () => {
  const h = harness(['runtime']); h.incoming('STATE', { roundNo: 1 }); h.play(duel()); await h.flush(); await h.tick(20);
  h.incoming('STATE', { roundNo: 1 }); assert.equal(h.api.isEffectBusy(), true); await h.tick(80);
  assert.equal(h.trace.late.length, 1); assert.equal(h.api.isEffectBusy(), false);
});
test('asset readiness keeps busy until load timeout then completes stage', async () => {
  const h = harness(['runtime']); h.flags.imageMode = 'pending';
  h.api.duelStageAssetsFor = () => ['https://qa.invalid/pending-arena.webp'];
  h.play(duel('asset-delay', { loserCardId: 14 })); await h.flush();
  assert.equal(h.trace.stages.length, 0); assert.equal(h.api.isEffectBusy(), true);
  assert(h.trace.imageUrls.includes('https://qa.invalid/images/cards/14.webp'));
  await h.tick(4999); assert.equal(h.trace.stages.length, 0); assert.equal(h.api.isEffectBusy(), true);
  await h.tick(1); assert.equal(h.trace.stages.length, 1); assert.equal(h.api.isEffectBusy(), true);
  await h.tick(100); assert.equal(h.api.isEffectBusy(), false);
});
test('cancel during asset readiness cannot start stale active or queued stages', async () => {
  const h = harness(['runtime']); h.flags.imageMode = 'pending';
  h.api.duelStageAssetsFor = () => ['https://qa.invalid/pending-cancel.webp'];
  h.play(duel('loading-old')); h.play(duel('loading-queued')); await h.flush();
  assert.equal(h.api.isEffectBusy(), true); h.api.cancelDuelStages(); await h.tick(6000);
  assert.equal(h.trace.stages.length, 0); assert.equal(h.api.isEffectBusy(), false); assert.equal(h.layer().hidden, true);
});
test('tested module bytes and engine remain unchanged during QA', () => {
  for (const file of files) assert.equal(sha(fs.readFileSync(path.join(root, file))), sha(bytes[file]), file);
});
(async () => {
for (const entry of tests) {
  try { await entry.fn(); entry.pass = true; }
  catch (error) { entry.pass = false; entry.error = error.stack; }
  delete entry.fn;
}
const report = {
  schema: 1, passed: tests.every(t => t.pass), checks: tests.length,
  failed: tests.filter(t => !t.pass).length, tests,
  sourceFiles: Object.fromEntries(files.map(f => [f, { bytes: bytes[f].length, sha256: sha(bytes[f]) }])),
  limitations: ['Node VM with deterministic timers and controlled DOM/stage callback. Does not establish browser rendering, actual Socket.IO authentication/routing, physical device, public deployment, or unlimited replay protection beyond bounded tombstone retention.']
};
fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ passed: report.passed, checks: report.checks, failed: report.failed, report: output, failures: tests.filter(t => !t.pass).map(t => ({ name: t.name, error: t.error })) }));
if (!report.passed) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
