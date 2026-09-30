'use strict';

// Source gate and fallback probe. Synthetic Image decoders do not review artwork.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const motion = require('../desktop/launcher-room-motion.js');
const life = require('../desktop/launcher-life-actions.js');
const reserved = require('../desktop/launcher-reserved-crew.js');

const root = 'opui://launcher/images/launcher_room/';
const directions = ['east', 'west', 'north', 'south'];
const requests = [];
class MotionImage {
  set src(source) {
    this._src = source;
    if (!source) return;
    requests.push(source);
    this.naturalWidth = source.includes('/motion_') ? 1536 : 2048;
    this.naturalHeight = source.includes('/motion_') ? 384 : 256;
    if (source.includes('/motion_v5/luffy/west.webp')) this.naturalWidth = 100;
  }
  get src() { return this._src; }
  async decode() {
    if (this._src.includes('/acting_v5/')) throw new Error('candidate unavailable');
  }
}
class LifeImage {
  set src(source) {
    this._src = source;
    requests.push(source);
    this.naturalWidth = 1024;
    this.naturalHeight = 256;
    queueMicrotask(() => {
      if (source.includes('/life_hd_v3/luffy/work-west.webp')) this.onerror?.();
      else this.onload?.();
    });
  }
  get src() { return this._src; }
  async decode() {}
}
function moduleWithGate(file, enabled, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'desktop', file), 'utf8');
  const candidateSource = file === 'launcher-room-motion.js'
    ? source.replace(/const LUFFY_ART_ENABLED = (?:true|false);/, `const LUFFY_ART_ENABLED = ${enabled};`) : source;
  if (file === 'launcher-room-motion.js') assert(candidateSource.includes(`const LUFFY_ART_ENABLED = ${enabled};`), 'Release gate marker missing');
  const sandbox = {
    module: { exports: {} },
    require: id => dependencies[id] || require(path.join(__dirname, '..', 'desktop', id)),
    Image: LifeImage,
    queueMicrotask
  };
  vm.runInNewContext(candidateSource, sandbox, { filename: file });
  return sandbox.module.exports;
}
function portraitUrls(activeMotion) {
  const desktop = file => fs.readFileSync(path.join(__dirname, '..', 'desktop', file), 'utf8');
  const roomLine = desktop('launcher-room.js').split(/\r?\n/).find(line => line.includes('const portraitFor = key =>'));
  assert(roomLine, 'Room portrait resolver missing');
  const roomPortrait = new Function('reserved', 'locomotion', `${roomLine}\nreturn portraitFor;`)(reserved, activeMotion);
  const shopSource = desktop('launcher-profile-shop.js');
  const shopBlock = shopSource.match(/const imageFor = \(type, key\) => \{[\s\S]*?\n  \};/);
  assert(shopBlock, 'Shop portrait resolver missing');
  const shopImage = new Function('window', `${shopBlock[0]}\nreturn imageFor;`)({OnePieceRoomMotion: activeMotion});
  const miniLine = desktop('launcher-room-minigames.js').split(/\r?\n/).find(line => line.includes('function portraitUrl()'));
  assert(miniLine, 'Minigame portrait resolver missing');
  const miniPortrait = new Function('root', 'keyOf', 'ASSET', 'characterId', `${miniLine}\nreturn portraitUrl;`)(
    {OnePieceRoomMotion: activeMotion, OnePieceReservedCrew: reserved},
    value => String(value).replace(/^room-character-/, ''), root, 'room-character-luffy');
  return [roomPortrait('luffy'), shopImage('room_character', 'luffy'), miniPortrait()];
}

(async () => {
  assert.equal(motion.LUFFY_ART_ENABLED, true, 'The checked-in 1.2.14 release gate must be on');
  const disabledMotion = moduleWithGate('launcher-room-motion.js', false);
  const disabledLife = moduleWithGate('launcher-life-actions.js', false, {'./launcher-room-motion.js': disabledMotion});
  for (const direction of directions) {
    assert.equal(disabledMotion.atlasUrl('luffy', direction), `${root}motion_v4/luffy/${direction}.webp`);
    assert.equal(disabledMotion.atlasUrl('luffy', direction, 'acting_v4'), `${root}acting_v4/luffy/${direction}.webp`);
    assert.equal(motion.atlasUrl('zoro', direction), `${root}motion_v4/zoro/${direction}.webp`);
  }
  assert.equal(disabledLife.url('luffy', 'work', 'east'), `${root}life_hd_v2/luffy/work-east.webp`);
  assert.equal(life.url('luffy', 'cook', 'south'), '');
  assert.deepEqual(portraitUrls(disabledMotion), Array(3).fill(`${root}portrait_v3/luffy.webp`));
  const oldWalk = await disabledMotion.preload('luffy', MotionImage).promise;
  const oldActing = await disabledMotion.preloadActions('luffy', MotionImage).promise;
  assert.equal(Object.keys(oldWalk.errors).length, 0);
  assert.equal(Object.keys(oldActing.errors).length, 0);
  assert.equal(Object.keys(oldWalk.atlases).length, 4);
  assert.equal(Object.keys(oldActing.atlases).length, 4);
  const oldImage = global.Image;
  global.Image = LifeImage;
  try {
    const record = disabledLife.preload('luffy', 'work', 'east');
    await record.promise;
    assert.equal(record.ready, true);
    assert.equal(record.source, `${root}life_hd_v2/luffy/work-east.webp`);
  } finally {
    if (oldImage === undefined) delete global.Image;
    else global.Image = oldImage;
  }
  assert(requests.length === 9 && requests.every(source => !/\/(?:motion_v5|acting_v5|life_hd_v3|portrait_v4)\//.test(source)),
    'Gate OFF must not request any missing Luffy art');

  // Exercise the checked-in enabled branch with deliberate simulated decode
  // failures, then verify the matching old atlas is used for each fallback.
  requests.length = 0;
  assert.equal(motion.atlasUrl('luffy', 'east'), `${root}motion_v5/luffy/east.webp`);
  assert.equal(life.url('luffy', 'work', 'east'), `${root}life_hd_v3/luffy/work-east.webp`);
  assert.deepEqual(portraitUrls(motion), Array(3).fill(`${root}portrait_v4/luffy.webp`));
  const walk = await motion.preload('luffy', MotionImage).promise;
  const acting = await motion.preloadActions('luffy', MotionImage).promise;
  assert.equal(Object.keys(walk.errors).length, 0);
  assert.equal(Object.keys(acting.errors).length, 0);
  assert.equal(walk.sources.east, `${root}motion_v5/luffy/east.webp`);
  assert.equal(walk.sources.west, `${root}motion_v4/luffy/west.webp`);
  assert.equal(acting.sources.south, `${root}acting_v4/luffy/south.webp`);
  global.Image = LifeImage;
  try {
    const current = life.preload('luffy', 'work', 'east');
    const fallback = life.preload('luffy', 'work', 'west');
    await Promise.all([current.promise, fallback.promise]);
    assert.equal(current.source, `${root}life_hd_v3/luffy/work-east.webp`);
    assert.equal(fallback.source, `${root}life_hd_v2/luffy/work-west.webp`);
    assert(current.ready && fallback.ready);
  } finally {
    if (oldImage === undefined) delete global.Image;
    else global.Image = oldImage;
  }
  console.log('PASS Luffy 1.2.14 gate ON: new paths resolve; simulated motion/life failures fall back to installed art; OFF branch remains old-only');
})().catch(error => { console.error(error); process.exitCode = 1; });
