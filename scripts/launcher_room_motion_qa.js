'use strict';

// Controller and asset-contract checks. This test does not judge rendered walk quality.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
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
    assert.ok(motion.atlasUrl('zoro', 'north').includes('/motion_v3/'));
    assert.equal(motion.atlasUrl('../luffy', 'east'), '');
    assert.equal(motion.atlasUrl('luffy', 'east', 'motion_v2'), '');
  });
  check('distance-driven cycle preserves contactA, neutral, contactC, neutral order', () => {
    const state = motion.createState('east');
    const frames = [state.frame];
    for (let i = 0; i < 4; i++) frames.push(motion.advance(state, 6, 24));
    assert.deepEqual(frames, [0, 1, 2, 3, 0]);
    assert.equal(state.distance, 24);
    assert.equal(motion.metadata('luffy').standingFrame, 1);
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
    assert.equal(north.speed, 13); assert.equal(north.stride, 12);
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
    assert.equal(motion.draw(canvas, atlas, 2), true);
    assert.deepEqual(calls[1], ['draw', atlas, 2 * cell, 0, cell, cell, 0, 0, cell, cell]);
    assert.equal(motion.SHAPE.rootX / cell, .5); assert.equal(motion.SHAPE.rootY / cell, .875);
    assert.deepEqual(motion.ACTION_POSES, ['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen']);
    assert.equal(motion.atlasUrl('luffy', 'west', 'acting_v3'), 'opui://launcher/images/launcher_room/acting_v3/luffy/west.webp');
    motion.draw(canvas, atlas, 7, motion.ACTION_SHAPE);
    assert.deepEqual(calls[3], ['draw', atlas, 7 * cell, 0, cell, cell, 0, 0, cell, cell]);
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
  check('all directions use four complete bodies without slope or body-part variants', () => {
    assert.deepEqual(motion.WALK_SHAPE, { columns: 4, rows: 1, frames: 4, cell: 128, width: 512, height: 128, rootX: 64, rootY: 112 });
    for (const direction of motion.DIRECTIONS) assert.equal(motion.walkShape(direction), motion.WALK_SHAPE);
    assert.equal(motion.slopeVariant, undefined); assert.equal(motion.DEPTH_WALK_SHAPE, undefined);
    const cell = motion.SHAPE.cell;
    const calls = [], canvas = { width: cell, height: cell, getContext: () => ({ clearRect() {}, drawImage: (...args) => calls.push(args) }) }, atlas = {};
    motion.draw(canvas, atlas, 3, motion.walkShape('south'));
    assert.deepEqual(calls[0], [atlas, 3 * cell, 0, cell, cell, 0, 0, cell, cell]);
  });
  check('each action retains its complete authored pose at every elapsed time', () => {
    for (let index = 0; index < motion.ACTION_POSES.length; index++) {
      const pose = motion.ACTION_POSES[index];
      for (const time of [0, 179, 180, 320, 720, 1500, 10000]) assert.equal(motion.actionFrame(pose, time), index);
    }
    assert.equal(motion.actionFrame('unknown', 0), -1);
    assert.notEqual(motion.WALK_SHAPE, motion.ACTION_SHAPE);
    assert.equal(motion.ACTION_SHAPE.width, 1024); assert.equal(motion.ACTION_SHAPE.height, 128);
  });
  check('v3 data matches four walk beats and eight poses with a shared neutral root', () => {
    const data = require('../desktop/launcher-room-motion-data');
    const browserGlobal = {};
    vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../desktop/launcher-room-motion-data.js'), 'utf8'), browserGlobal);
    assert.equal(browserGlobal.OnePieceRoomMotionManifest.schema, data.schema);
    assert.equal(data.schema, 'one-piece-room-motion/3');
    assert.deepEqual(data.shape.walk.sequence, ['contactA', 'neutral', 'contactC', 'neutral']);
    for (const [kind, shape] of [['walk', motion.SHAPE], ['actions', motion.ACTION_SHAPE]])
      for (const field of ['cell', 'frames', 'columns', 'rows']) assert.equal(data.shape[kind][field], shape[field]);
    assert.equal(data.shape.actions.beatsPerAction, 1);
    assert.equal(Object.keys(data.characters).length, 10);
    for (const key of Object.keys(data.characters)) {
      const meta = motion.metadata(key, data);
      assert.ok(meta.displayScale >= .7 && meta.displayScale <= 1.4);
      for (const direction of motion.DIRECTIONS) {
        assert.ok(meta.stride[direction] >= 8 && meta.stride[direction] <= 80);
        const cadence = meta.stride[direction] / meta.speed[direction];
        assert.ok(cadence >= 1 && cadence <= 1.4, `${key}/${direction} should retain a low-step walking cadence`);
        const front = motion.speedAndStride(key, direction, 1.07, data);
        const back = motion.speedAndStride(key, direction, .72, data);
        assert.equal(front.stride, meta.stride[direction] * meta.displayScale);
        assert.ok(Math.abs(front.stride / front.speed - back.stride / back.speed) < 1e-10);
      }
      assert.ok(Math.abs(meta.stride.east / meta.speed.east - meta.stride.north / meta.speed.north) < .0001);
      assert.equal(meta.standingFrame, 1);
      assert.deepEqual(meta.root, [motion.SHAPE.rootX, motion.SHAPE.rootY]);
    }
    assert.ok(data.characters.chopper.displayScale < data.characters.luffy.displayScale);
    assert.ok(data.characters.franky.displayScale > data.characters.luffy.displayScale);
  });
  let releaseDecode;
  const gate = new Promise(resolve => { releaseDecode = resolve; });
  class DelayedImage {
    get naturalWidth() { return this.src.includes('/acting_v3/') ? motion.ACTION_SHAPE.width : motion.SHAPE.width; }
    get naturalHeight() { return this.src.includes('/acting_v3/') ? motion.ACTION_SHAPE.height : motion.SHAPE.height; }
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
    assert.equal(new Set(Object.values(loading.atlases)).size, 4);
    assert.equal(new Set(Object.values(loading.atlases).map(image => image.src)).size, 4);
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
  class LegacyWalkImage { naturalWidth = 1024; naturalHeight = 512; async decode() {} }
  const oldWalk = motion.preload('nami', LegacyWalkImage); await oldWalk.promise;
  check('previous 32-frame walk atlases fail the four-beat contract', () => {
    assert.deepEqual(oldWalk.atlases, {}); assert.equal(Object.keys(oldWalk.errors).length, 4);
  });
  class LegacyDepthImage { naturalWidth = 1024; naturalHeight = 2560; async decode() {} }
  const oldDepth = motion.preload('robin', LegacyDepthImage); await oldDepth.promise;
  check('previous 160-cell depth atlases cannot become movement-ready', () => {
    assert.deepEqual(oldDepth.atlases, {}); assert.equal(Object.keys(oldDepth.errors).length, 4);
  });
  class FailedDecodeImage extends DelayedImage { async decode() { throw new Error('decode failed'); } }
  const failed = motion.preload('sanji', FailedDecodeImage); await failed.promise;
  check('correct dimensions cannot bypass a failed image decode', () => {
    assert.deepEqual(failed.atlases, {}); assert.equal(Object.keys(failed.errors).length, 4);
  });
  const actions = motion.preloadActions('luffy', DelayedImage); await actions.promise;
  check('directional action atlas cache is independent from walk cache', () => {
    assert.notEqual(actions, loading); assert.equal(Object.keys(actions.atlases).length, 4);
    assert.ok(actions.atlases.west.src.includes('/acting_v3/luffy/west.webp'));
    assert.equal(actions.atlases.west.naturalWidth, 1024); assert.equal(loading.atlases.west.naturalWidth, 512);
  });
  const oldActions = motion.preloadActions('nami', LegacyWalkImage); await oldActions.promise;
  check('previous four-beats-per-action atlas is rejected', () => {
    assert.deepEqual(oldActions.atlases, {}); assert.equal(Object.keys(oldActions.errors).length, 4);
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
