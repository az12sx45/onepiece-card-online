'use strict';
// Focused loading-policy and first-work probes; no server or visual-quality claim.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const life = require('../desktop/launcher-life');
const checks = [];
const read = name => fs.readFileSync(path.join(__dirname, '..', 'desktop', name), 'utf8');
const flush = () => new Promise(resolve => setImmediate(resolve));

async function check(name, run) { await run(); checks.push(name); }

async function main() {
  await check('entering a room does not request every Life atlas', () => {
    let adapter, requests = 0, resumed = 0;
    const root = {
      document: { getElementById: () => null }, addEventListener() {},
      OnePieceLifeData: { characterKeys: ['sanji'] },
      OnePieceReservedCrew: { releasedKeys: () => ['sanji'] },
      OnePieceLifeActions: {
        supported: (key, clip) => key === 'sanji' && clip === 'cook',
        describe: (_clip, direction) => ({ direction }),
        preload: (_key, _clip, direction) => { requests++; assert.equal(direction, 'north'); return { ready: false }; }
      },
      OnePieceLife: { create: options => {
        adapter = options.adapter;
        return { sync() {}, rebind() {}, resume() { resumed++; }, pause() {} };
      } },
      onePieceDesktop: {}
    };
    root.window = root; root.globalThis = root;
    vm.runInNewContext(read('launcher-life-room.js'), root, { filename: 'launcher-life-room.js' });
    const actor = { key: 'sanji', item: { id: 'room-character-sanji' }, cell: { col: 1, row: 1 }, motion: { direction: 'north' } };
    const profile = { userId: 42, life: { ownedCharacterIds: ['room-character-sanji'] } };
    const room = root.OnePieceLifeRoom.create({
      walkers: () => [actor], profile: () => profile, isOwner: () => false,
      room: () => ({ revision: 1 }), editing: () => false, canAnimate: () => true
    });
    room.resume();
    assert.equal(resumed, 1);
    assert.equal(requests, 0);
    assert.equal(adapter.supportsClip('sanji', 'cook'), true);
    assert.equal(adapter.hasClip('sanji', 'cook'), false);
    assert.equal(requests, 1);
  });

  await check('Life atlas requests are cached and at most two decode concurrently', async () => {
    const started = [];
    class ControlledImage {
      set src(value) { this.source = value; started.push(this); }
      get naturalWidth() { return this.source.includes('/train-') ? 1 : 512; }
      get naturalHeight() { return 128; }
      decode() { return new Promise((resolve, reject) => { this.finish = resolve; this.reject = reject; }); }
    }
    const root = {
      Image: ControlledImage,
      OnePieceReservedCrew: { SUPPORTED_KEYS: ['sanji'], RESERVED_KEYS: [] }
    };
    root.globalThis = root;
    vm.runInNewContext(read('launcher-life-actions.js'), root, { filename: 'launcher-life-actions.js' });
    const actions = root.OnePieceLifeActions;
    const records = ['cook', 'work', 'train', 'eat'].map(clip => actions.preload('sanji', clip, 'south'));
    assert.equal(actions.preload('sanji', 'cook', 'south'), records[0]);
    assert.equal(started.length, 2);
    assert.equal(records[2].image, null);
    started[0].onload(); started[0].finish(); await records[0].promise;
    assert.equal(started.length, 3);
    started[1].onerror(); await records[1].promise;
    assert.equal(started.length, 4);
    started[2].onload(); started[2].finish(); await records[2].promise;
    started[3].onload(); started[3].finish(); await records[3].promise;
    assert.equal(records[0].ready, true);
    assert.equal(records[1].failed, true);
    assert.equal(records[2].failed, true);
    assert.equal(records[3].ready, true);
    assert.match(records[0].source, /\/cook-south\.webp$/);
    const calls = [];
    const canvas = { width: 0, height: 0, getContext: () => ({ clearRect() {}, drawImage: (...args) => calls.push(args) }) };
    assert.equal(actions.draw(canvas, 'sanji', 'cook', 'south', 300).frame, 1);
    assert.equal(calls[0][1], 128);
  });

  await check('first assignment keeps specialist clip and waits for decoded art', async () => {
    let now = Date.UTC(2026, 8, 28, 12), artReady = false, activations = 0;
    const requested = [], drawn = [];
    const station = { id: 'stove', type: 'kitchen', furnitureKey: 'galley-stove', cell: { col: 4, row: 3 },
      slots: [{ id: 'cook', cell: { col: 4, row: 4 }, facing: { col: 4, row: 3 } }] };
    const world = { ownedItemIds: ['room-character-sanji'], roomRevision: 1,
      actors: [{ key: 'sanji', itemId: 'room-character-sanji', cell: { col: 1, row: 4 }, available: true }], stations: [station] };
    const data = { characterKeys: ['sanji'], characters: { sanji: {} }, stations: { kitchen: {
      specialistActions: { sanji: 'cook' }, specialistRequirements: { sanji: { furnitureKeys: ['galley-stove'] } },
      stages: [{ id: 'prepare', clip: 'work', durationMs: 500 }, { id: 'operate', clip: 'work', durationMs: 500 },
        { id: 'finish', clip: 'work', durationMs: 500 }]
    } } };
    const controller = life.create({ data, clock: () => now, rng: () => 0, adapter: {
      getWorld: () => world, plan: () => true, move: () => true, arrived: () => true,
      dock: () => true, face: () => true, undock: () => true,
      supportsClip: (key, clip) => key === 'sanji' && clip === 'cook',
      hasClip: (_key, clip) => { requested.push(clip); return artReady; },
      clip: (_key, clip) => { drawn.push(clip); return artReady; }
    }, command: async type => {
      if (type === 'work.activate') activations++;
      return { ok: true, job: { jobId: 'job-1', itemId: 'room-character-sanji', stationId: 'stove', status: type === 'work.activate' ? 'active' : 'reserved' } };
    } });
    try {
      assert.equal((await controller.assignWork('sanji', 'stove')).ok, true);
      now += 250; controller.tick(now);
      assert(requested.includes('cook'), 'specialist art should be requested on the first assignment');
      assert.equal(activations, 0, 'unloaded art must block work activation');
      artReady = true;
      now += 250; controller.tick(now); await flush();
      assert.equal(activations, 1);
      now += 800; controller.tick(now);
      assert(drawn.includes('cook'), 'the operate stage should play the specialist clip');
    } finally { controller.dispose(); }
  });

  await check('failed specialist art falls back to the authored generic work clip', async () => {
    let now = Date.UTC(2026, 8, 28, 12), activations = 0;
    const drawn = [], failures = [];
    const station = { id: 'stove', type: 'kitchen', furnitureKey: 'galley-stove', cell: { col: 4, row: 3 },
      slots: [{ id: 'cook', cell: { col: 4, row: 4 }, facing: { col: 4, row: 3 } }] };
    const data = { characterKeys: ['sanji'], characters: { sanji: {} }, stations: { kitchen: {
      specialistActions: { sanji: 'cook' }, specialistRequirements: { sanji: { furnitureKeys: ['galley-stove'] } },
      stages: [{ id: 'prepare', clip: 'work', durationMs: 500 }, { id: 'operate', clip: 'work', durationMs: 500 }]
    } } };
    const controller = life.create({ data, clock: () => now, rng: () => 0, adapter: {
      getWorld: () => ({ ownedItemIds: ['room-character-sanji'], roomRevision: 1,
        actors: [{ key: 'sanji', itemId: 'room-character-sanji', cell: { col: 1, row: 4 }, available: true }], stations: [station] }),
      plan: () => true, move: () => true, arrived: () => true, dock: () => true, face: () => true, undock: () => true,
      supportsClip: (_key, clip) => clip === 'cook',
      clipFailed: (_key, clip) => { failures.push(clip); return clip === 'cook'; },
      hasClip: (_key, clip) => clip === 'work',
      clip: (_key, clip) => { drawn.push(clip); return clip === 'work'; }
    }, command: async type => {
      if (type === 'work.activate') activations++;
      return { ok: true, job: { jobId: 'job-1', itemId: 'room-character-sanji', stationId: 'stove', status: type === 'work.activate' ? 'active' : 'reserved' } };
    } });
    try {
      assert.equal((await controller.assignWork('sanji', 'stove')).ok, true);
      now += 250; controller.tick(now); await flush();
      assert(failures.includes('cook'));
      assert.equal(activations, 1);
      now += 800; controller.tick(now);
      assert(drawn.includes('work'));
      assert(!drawn.includes('cook'));
    } finally { controller.dispose(); }
  });

  console.log(JSON.stringify({ ok: true, checks }));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
