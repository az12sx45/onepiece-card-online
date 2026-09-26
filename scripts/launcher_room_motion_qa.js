'use strict';

// Controller and asset-contract checks. This test does not judge rendered walk quality.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const motion = require('../desktop/launcher-room-motion');
const results = [];
function check(name, fn) { fn(); results.push({ name, pass: true }); }

async function main() {
  check('grid directions select four independent atlas paths', () => {
    const vectors = [[1, 0, 'east'], [-1, 0, 'west'], [0, -1, 'north'], [0, 1, 'south']];
    assert.equal(new Set(vectors.map(([dc, dr, direction]) => {
      assert.equal(motion.directionForDelta(dc, dr), direction);
      return motion.atlasUrl('zoro', direction);
    })).size, 4);
    assert.equal(motion.atlasUrl('../luffy', 'east'), '');
  });
  check('distance-driven full cycle reaches all 32 ordered frames', () => {
    const state = motion.createState('east');
    const frames = [];
    for (let i = 0; i < 32; i++) frames.push(motion.advance(state, .75, 24));
    assert.deepEqual(frames, [...Array.from({ length: 31 }, (_, index) => index + 1), 0]);
    assert.equal(state.distance, 24);
  });
  check('subdividing cells or frame times preserves locomotion phase', () => {
    const segmented = motion.createState('south'), whole = motion.createState('south');
    for (const distance of [3, 7, 11, 5, 9]) motion.advance(segmented, distance, 44);
    motion.advance(whole, 35, 44);
    assert.ok(Math.abs(segmented.phase - whole.phase) < 1e-12);
  });
  check('blocked and undecoded movement cannot advance feet', () => {
    const state = motion.createState('north');
    motion.advance(state, 17, 44);
    const before = { ...state };
    motion.advance(state, 20, 44, { blocked: true });
    motion.advance(state, 20, 44, { ready: false });
    assert.deepEqual(state, before);
    assert.equal(motion.face(state, 'east', 0, false), false);
    assert.deepEqual(state, before);
  });
  check('whole-sprite turn settles 140ms and keeps step phase', () => {
    const state = motion.createState('east');
    motion.advance(state, 17, 44);
    const phase = state.phase;
    assert.equal(motion.face(state, 'north', 1000), false);
    assert.equal(motion.face(state, 'north', 1139), false);
    assert.equal(state.direction, 'east');
    assert.equal(motion.face(state, 'north', 1140), true);
    assert.equal(state.direction, 'north');
    assert.equal(state.phase, phase);
  });
  check('projected speed and stride preserve gait cadence at both depths', () => {
    const front = motion.speedAndStride('luffy', 'east', 1.07);
    const back = motion.speedAndStride('luffy', 'east', .72);
    assert.equal(front.speed, 26);
    assert.equal(front.stride, 24);
    assert.ok(Math.abs(front.speed / front.stride - back.speed / back.stride) < 1e-12);
    assert.ok(back.speed < front.speed && back.stride < front.stride);
    const north = motion.speedAndStride('luffy', 'north', 1.07);
    assert.equal(north.speed, 26 * .62); assert.equal(north.stride, 24 * .62);
    assert.ok(Math.abs(north.speed / north.stride - front.speed / front.stride) < 1e-12);
    assert.equal(motion.metadata('luffy', { characters: { luffy: { stride: { east: 48 }, speed: 41 } } }).stride.east, 48);
    const custom = motion.metadata('luffy', { characters: { luffy: { speed: { east: 45, north: 28 }, stride: { east: 57, north: 26 } } } });
    assert.equal(custom.speed.north, 28); assert.equal(custom.speed.east, 45);
    assert.equal(custom.stride.north, 26); assert.equal(custom.stride.east, 57);
  });
  check('atlas frame extraction uses fixed cells without scale or mirror transforms', () => {
    const calls = [];
    const context = { clearRect: (...args) => calls.push(['clear', ...args]), drawImage: (...args) => calls.push(['draw', ...args]) };
    const cell = motion.SHAPE.cell;
    const canvas = { width: cell, height: cell, getContext: () => context };
    const atlas = {};
    assert.equal(motion.draw(canvas, atlas, 30), true);
    assert.deepEqual(calls[1], ['draw', atlas, 6 * cell, 3 * cell, cell, cell, 0, 0, cell, cell]);
    assert.equal(motion.SHAPE.rootX / cell, .5); assert.equal(motion.SHAPE.rootY / cell, .875);
    assert.deepEqual(motion.ACTION_POSES, ['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
    assert.equal(motion.atlasUrl('luffy', 'west', 'acting_v2'), 'opui://launcher/images/launcher_room/acting_v2/luffy/west.webp');
  });
  check('edge depth routes use Y speed and phase despite lateral floor projection', () => {
    const center = motion.pathStep(0, 31, 'south', 8);
    const edge = motion.pathStep(-15.9375, 31, 'south', 8);
    assert.equal(center.dy, 8); assert.equal(edge.dy, 8);
    assert.equal(center.travel, edge.travel); assert.equal(edge.reached, false);
    assert.ok(Math.abs(edge.dx / edge.dy - (-15.9375 / 31)) < 1e-12);
    assert.deepEqual(motion.pathStep(15.9375, -31, 'north', 40), { dx: 15.9375, dy: -31, travel: 31, reached: true });
    assert.equal(motion.pathStep(-50, 0, 'west', 5).dx, -5);
  });
  check('depth atlases choose an authored leg projection without mirroring the body', () => {
    assert.deepEqual(motion.DEPTH_SLOPES, [-.52, -.26, 0, .26, .52]);
    assert.equal(motion.slopeVariant(-.514), 0); assert.equal(motion.slopeVariant(.514), 4);
    assert.equal(motion.slopeVariant(0), 2); assert.equal(motion.walkShape('north').height, 20 * motion.SHAPE.cell);
    const cell = motion.SHAPE.cell;
    const calls = [], canvas = { width: cell, height: cell, getContext: () => ({ clearRect() {}, drawImage: (...args) => calls.push(args) }) }, atlas = {};
    motion.draw(canvas, atlas, 32 * 4 + 30, motion.walkShape('south'));
    assert.deepEqual(calls[0], [atlas, 6 * cell, 19 * cell, cell, cell, 0, 0, cell, cell]);
  });
  check('each action selects its four beats without entering another expression', () => {
    for (let index = 0; index < motion.ACTION_POSES.length; index++) {
      const pose = motion.ACTION_POSES[index], duration = pose === 'idle' || pose === 'listen' ? 320 : 180;
      assert.deepEqual([0, 1, 2, 3, 4].map(beat => motion.actionFrame(pose, beat * duration)), [0, 1, 2, 3, 0].map(beat => index * 4 + beat));
    }
    assert.equal(motion.actionFrame('unknown', 0), -1);
    assert.notEqual(motion.WALK_SHAPE, motion.ACTION_SHAPE);
  });
  check('data module exposes measured gait and shared root without changing identity', () => {
    const data = require('../desktop/launcher-room-motion-data');
    const meta = motion.metadata('luffy', data);
    assert.equal(meta.stride.east, 24); assert.equal(meta.speed.east, 26);
    assert.deepEqual(meta.root, [motion.SHAPE.rootX, motion.SHAPE.rootY]);
    assert.equal(data.shape.walk.cell, motion.SHAPE.cell);
    assert.equal(data.shape.actions.beatsPerAction, 4);
  });
  let releaseDecode;
  const gate = new Promise(resolve => { releaseDecode = resolve; });
  class DelayedImage {
    naturalWidth = motion.SHAPE.width;
    get naturalHeight() { return /\/motion_v2\/.*\/(north|south)\.webp$/.test(this.src) ? motion.walkShape('north').height : motion.SHAPE.height; }
    decode() { return gate; }
  }
  const loading = motion.preload('luffy', DelayedImage);
  check('no directional asset is available before image decode finishes', () => {
    assert.deepEqual(loading.atlases, {}); assert.equal(loading.complete, false);
  });
  releaseDecode(); await loading.promise;
  check('preload exposes all four validated and decoded atlases', () => {
    assert.deepEqual(Object.keys(loading.atlases).sort(), [...motion.DIRECTIONS].sort());
    assert.equal(loading.complete, true); assert.deepEqual(loading.errors, {});
    assert.equal(motion.preload('luffy', DelayedImage), loading);
  });
  class InvalidImage { naturalWidth = 1; naturalHeight = 1; async decode() {} }
  const invalid = motion.preload('chopper', InvalidImage); await invalid.promise;
  check('missing or wrong-shape atlases never become movement-ready', () => {
    assert.deepEqual(invalid.atlases, {}); assert.equal(Object.keys(invalid.errors).length, 4);
  });
  class UnpackedAtlasImage { naturalWidth = 2048; naturalHeight = 1024; async decode() {} }
  const legacy = motion.preload('zoro', UnpackedAtlasImage); await legacy.promise;
  check('unpacked source atlases cannot bypass the published cell contract', () => {
    assert.deepEqual(legacy.atlases, {}); assert.equal(Object.keys(legacy.errors).length, 4);
  });
  const actions = motion.preloadActions('luffy', DelayedImage); await actions.promise;
  check('directional action atlas cache is independent from walk cache', () => {
    assert.notEqual(actions, loading); assert.equal(Object.keys(actions.atlases).length, 4);
    assert.ok(actions.atlases.west.src.includes('/acting_v2/luffy/west.webp'));
  });
  const report = { ok: true, checks: results.length, scope: 'controller-only', visualAcceptance: false, results };
  if (process.env.LAUNCHER_ROOM_MOTION_QA_OUT) {
    const out = path.resolve(process.env.LAUNCHER_ROOM_MOTION_QA_OUT);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report));
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
