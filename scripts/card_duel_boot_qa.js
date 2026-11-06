'use strict';
// Regression for native API creation after defer scripts run at interactive.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const files = ['private', 'stage', 'runtime'].map(name => `public/js/card-duel-${name}.js`);
const bytes = Object.fromEntries(files.map(file => [file, fs.readFileSync(path.join(root, file))]));
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const checks = [];
function check(name, fn) { fn(); checks.push({ name, pass: true }); }
function harness({ nativeOnDcl = false, existingApi = false, runtimeOnly = false } = {}) {
  let now = 0, next = 0, ran = 0;
  const jobs = new Map(), docEvents = new Map(), socketEvents = new Map(), any = [];
  const trace = { scene: 0, restores: 0, oldPlay: 0, getterCalls: 0 };
  const flags = { originalBusy: false };
  function on(map, name, fn, options) {
    if (!map.has(name)) map.set(name, []);
    map.get(name).push({ fn, once: options?.once === true });
  }
  function fire(map, name, value) {
    for (const entry of (map.get(name) || []).slice()) {
      if (entry.once) map.set(name, map.get(name).filter(item => item !== entry));
      entry.fn(value);
    }
  }
  const timeout = (fn, ms = 0) => { const id = ++next; jobs.set(id, { at: now + ms, fn }); return id; };
  const clear = id => jobs.delete(id);
  function advance(ms) {
    const end = now + ms;
    let guard = 0;
    while (true) {
      const item = [...jobs].filter(([, value]) => value.at <= end).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
      if (!item) break;
      assert(++guard < 2000, 'unbounded retry loop');
      jobs.delete(item[0]); now = item[1].at; ran++; item[1].fn();
    }
    now = end;
  }
  class Node {
    constructor() { this.id = ''; this.className = ''; this.children = []; this.dataset = {}; this.hidden = false; this.isConnected = true; }
    append(...nodes) { this.children.push(...nodes); }
    replaceChildren(...nodes) { this.children = nodes; }
    get classList() { return { contains: value => this.className.split(/\s+/).includes(value) }; }
    getClientRects() { return this.hidden ? [] : [{}]; }
  }
  const body = new Node();
  const find = (node, id) => node.id === id ? node : node.children.map(child => find(child, id)).find(Boolean);
  const document = {
    readyState: 'interactive', hidden: false, baseURI: 'https://boot-qa.invalid/game.html',
    body, documentElement: { dataset: {} }, createElement: () => new Node(),
    getElementById: id => find(body, id), addEventListener: (name, fn, options) => on(docEvents, name, fn, options)
  };
  class Image {
    constructor() { this.complete = true; this.naturalWidth = 100; }
    set src(value) { this._src = value; this.onload?.(); }
    decode() { return Promise.resolve(); }
  }
  const ctx = {
    document, window: { addEventListener() {} }, socket: {
      onAny: fn => any.push(fn), on: (name, fn) => on(socketEvents, name, fn)
    }, me: { roomId: 'boot-room', playerId: 0 }, state: { players: [] },
    playDuel() { trace.oldPlay++; }, setTimeout: timeout, clearTimeout: clear, URL, Image,
    MutationObserver: class { observe() {} disconnect() {} }, innerWidth: 740, innerHeight: 360, matchMedia: () => ({ matches: false })
  };
  const installApi = withGetter => {
    if (!document.getElementById('phoneInteractionFx')) { const fx = new Node(); fx.id = 'phoneInteractionFx'; body.append(fx); }
    ctx.window.CardPhonePresentation = { duelSceneVersion: 3, restoreHandArt: () => trace.restores++, maskHandArt() {}, borrowCardVisual: () => () => {}, ownHandElement: () => null };
    if (withGetter) installGetter();
  };
  const installGetter = () => {
    ctx.window.CardPhonePresentation.isEffectBusy = () => { trace.getterCalls++; return flags.originalBusy; };
  };
  if (nativeOnDcl) document.addEventListener('DOMContentLoaded', () => installApi(true), { once: true });
  if (existingApi) installApi(false);
  vm.createContext(ctx);
  for (const file of runtimeOnly ? files.filter(file => file.endsWith('runtime.js')) : files) vm.runInContext(bytes[file].toString('utf8'), ctx, { filename: file });
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
  return {
    ctx, document, flags, trace, advance, flush, jobs, any, installApi, installGetter,
    get ran() { return ran; }, get api() { return ctx.window.CardPhonePresentation; },
    fire: name => fire(docEvents, name),
    layers: () => body.children.filter(node => node.id === 'cardDuelLayer').length,
    socketCounts: () => Object.fromEntries([...socketEvents].map(([name, entries]) => [name, entries.length])),
    async tick(ms) { advance(ms); await flush(); }
  };
}
let failure = null;
(async () => {
  try {
    const h = harness({ nativeOnDcl: true });
    h.advance(0);
    check('interactive defer execution without API does not bind socket or layer', () => {
      assert.equal(h.api, undefined); assert.equal(h.any.length, 0); assert.equal(h.layers(), 0);
    });
    h.document.readyState = 'interactive'; h.fire('DOMContentLoaded'); await h.tick(0);
    check('native API created at DCL installs duel modules and independent swap hook', () => {
      assert.equal(h.api.duelPrivateVersion, 1); assert.equal(h.api.duelStageVersion, 2); assert.equal(h.api.duelRuntimeVersion, 1);
      assert.equal(typeof h.api.attachDuelDetails, 'function'); assert.equal(h.api.swapHandVisibilityVersion, 1);
    });
    check('initial mount creates one private receiver and one runtime layer', () => {
      assert.equal(h.any.length, 1); assert.equal(h.layers(), 1);
      assert.deepEqual(h.socketCounts(), { disconnect: 3, JOINED: 3, STATE: 2 });
    });
    const refs = { prepare: h.api.prepareDuelDetails, attach: h.api.attachDuelDetails, stage: h.api.playDuelScene, play: h.ctx.playDuel, busy: h.api.isEffectBusy };
    for (let i = 0; i < 3; i++) { h.fire('DOMContentLoaded'); h.fire('card:interface-ready'); await h.tick(0); }
    await h.tick(1000);
    check('repeated ready and DCL never rebind any public API', () => {
      assert.equal(h.api.prepareDuelDetails, refs.prepare); assert.equal(h.api.playDuelScene, refs.stage);
      assert.equal(h.api.attachDuelDetails, refs.attach);
      assert.equal(h.ctx.playDuel, refs.play); assert.equal(h.api.isEffectBusy, refs.busy);
    });
    check('repeated readiness never duplicates socket handlers, layer or retry timer', () => {
      assert.equal(h.any.length, 1); assert.equal(h.layers(), 1);
      assert.deepEqual(h.socketCounts(), { disconnect: 3, JOINED: 3, STATE: 2 }); assert.equal(h.jobs.size, 0);
    });
    h.api.duelStageDuration = 100; h.api.duelStageAssetsFor = () => [];
    h.api.playDuelScene = () => h.trace.scene++;
    h.flags.originalBusy = true; h.ctx.playDuel({ duelId: 'late-native', leftId: 0, rightId: 1, winnerId: null });
    await h.tick(200);
    check('runtime captured the native FX getter established at DCL', () => {
      assert(h.trace.getterCalls > 0); assert.equal(h.trace.scene, 0); assert.equal(h.api.isEffectBusy(), true);
    });
    h.flags.originalBusy = false; await h.tick(50);
    check('queued runtime starts when original FX actually becomes idle', () => assert.equal(h.trace.scene, 1));
    await h.tick(100);
    check('late native runtime finishes without stale busy lock', () => {
      assert.equal(h.api.isEffectBusy(), false); assert.equal(h.trace.restores, 1);
    });
    const delayed = harness({ existingApi: true }); await delayed.tick(0);
    check('runtime does not mount against an API missing its FX getter', () => {
      assert.equal(delayed.api.duelPrivateVersion, 1); assert.equal(delayed.api.duelStageVersion, 2);
      assert.equal(delayed.api.duelRuntimeVersion, undefined); assert.equal(delayed.layers(), 0);
    });
    await delayed.tick(150); delayed.installGetter(); delayed.fire('card:interface-ready'); await delayed.tick(0);
    check('interface-ready installs runtime after delayed getter arrives exactly once', () => {
      assert.equal(delayed.api.duelRuntimeVersion, 1); assert.equal(delayed.layers(), 1); assert.equal(delayed.any.length, 1);
    });
    const noBridge = harness({ existingApi: true, runtimeOnly: true });
    noBridge.api.duelSceneVersion = 4; noBridge.installGetter(); await noBridge.tick(0);
    check('runtime waits for private attach contract even when scene and getter exist', () => {
      assert.equal(noBridge.api.duelRuntimeVersion, undefined); assert.equal(noBridge.layers(), 0);
    });
    noBridge.api.attachDuelDetails = value => ({ ...value }); noBridge.fire('card:interface-ready'); await noBridge.tick(0);
    check('runtime mounts exactly once after private attach contract becomes available', () => {
      assert.equal(noBridge.api.duelRuntimeVersion, 1); assert.equal(noBridge.layers(), 1);
    });
    const retry = harness(); await retry.tick(75); retry.installApi(true); await retry.tick(25);
    check('bounded retry recovers an API arriving without DCL or interface-ready signal', () => {
      assert.equal(retry.api.duelPrivateVersion, 1); assert.equal(retry.api.duelStageVersion, 2);
      assert.equal(retry.api.duelRuntimeVersion, 1); assert.equal(retry.layers(), 1);
    });
    const absent = harness(); await absent.tick(20000);
    check('missing API exhausts all retries with no listeners or layers installed', () => {
      assert.equal(absent.jobs.size, 0); assert(absent.ran <= 800); assert.equal(absent.any.length, 0); assert.equal(absent.layers(), 0);
    });
    const ran = absent.ran; await absent.tick(60000);
    check('missing API leaves no endless polling after retry bound', () => assert.equal(absent.ran, ran));
    check('tested product sources remain unchanged', () => {
      for (const file of files) assert.equal(sha(fs.readFileSync(path.join(root, file))), sha(bytes[file]));
    });
  } catch (error) { failure = error.stack; }
  const report = {
    schema: 1, passed: !failure, checks: checks.length, assertions: checks, failure,
    sourceFiles: Object.fromEntries(files.map(file => [file, { bytes: bytes[file].length, sha256: sha(bytes[file]) }])),
    limitations: ['Node VM boot-order regression with deterministic timers and Image/DOM stubs; not browser scheduling, native installation, account or physical-device acceptance.']
  };
  const output = process.env.CARD_DUEL_BOOT_REPORT || 'D:/Codex_QA/card-swap-collision-20261107/client-boot-report.json';
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks, report: output, failure }));
  if (failure) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
