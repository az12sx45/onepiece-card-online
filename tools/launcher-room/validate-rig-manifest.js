'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const CHARACTERS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
const DIRECTIONS = ['east', 'west', 'north', 'south'];
const ACTIONS = ['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen'];
const PARTS = ['head_quiet', 'head_happy', 'head_annoyed', 'head_surprise', 'torso', 'nearArm', 'farArm', 'nearLeg', 'farLeg', 'nearFoot', 'farFoot'];
function webpSize(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  for (let offset = 12; offset + 8 < bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    assert(start + size <= bytes.length, 'Truncated WebP chunk');
    if (kind === 'VP8X') return [1 + bytes.readUIntLE(start + 4, 3), 1 + bytes.readUIntLE(start + 7, 3)];
    if (kind === 'VP8L') { assert.equal(bytes[start], 0x2f); const value = bytes.readUInt32LE(start + 1); return [1 + (value & 0x3fff), 1 + ((value >>> 14) & 0x3fff)]; }
    offset = start + size + size % 2;
  }
  throw Error('No supported lossless WebP dimensions');
}
function validate(root, { requireComplete = true, requireReviewed = false } = {}) {
  root = path.resolve(root);
  const digestCache = new Map();
  const local = name => { assert.equal(typeof name, 'string'); const value = path.resolve(root, name); assert(value.startsWith(root + path.sep), `Path escapes repository: ${name}`); return value; };
  const digest = name => { if (!digestCache.has(name)) digestCache.set(name, crypto.createHash('sha256').update(fs.readFileSync(local(name))).digest('hex')); return digestCache.get(name); };
  const read = name => JSON.parse(fs.readFileSync(local(name), 'utf8').replace(/^\uFEFF/, ''));
  const manifest = read('docs/LAUNCHER_ROOM_MOTION_ART_20260926.json');
  assert.equal(manifest.schema, 'one-piece-room-rig-art/1'); assert.equal(manifest.version, '1.1.13'); assert.equal(manifest.canonicalCharactersOnly, true);
  assert(Array.isArray(manifest.items) && manifest.items.length > 0);
  const expected = CHARACTERS.flatMap(key => ['motion', 'acting'].flatMap(kind => DIRECTIONS.map(direction => `public/images/launcher_room/${kind}_v2/${key}/${direction}.webp`))).sort();
  const actual = manifest.items.map(item => item.asset).sort(); assert.equal(new Set(actual).size, actual.length, 'Duplicate atlas identity');
  assert(actual.every(asset => expected.includes(asset)), 'Unexpected character, direction or atlas kind');
  if (requireComplete) { assert.equal(actual.length, 80, `Formal motion art gate requires 80 atlases; found ${actual.length}`); assert.deepEqual(actual, expected); }
  const dataPath = local('desktop/launcher-room-motion-data.js'); delete require.cache[require.resolve(dataPath)]; const data = require(dataPath);
  assert.equal(data.schema, 'one-piece-room-motion/2');
  for (const kind of ['walk', 'actions']) { assert.equal(data.shape[kind].frames, 32); assert.equal(data.shape[kind].columns, 8); assert.equal(data.shape[kind].rows, 4); assert.equal(data.shape[kind].cell, 128); assert.deepEqual(data.shape[kind].root, [64, 112]); }
  const scales = new Map();
  for (const item of manifest.items) {
    const id = `${item.key}-${item.direction}`;
    assert.equal(item.asset, `public/images/launcher_room/${item.kind}_v2/${item.key}/${item.direction}.webp`);
    const slopes = item.kind === 'motion' && ['north', 'south'].includes(item.direction) ? [-.52, -.26, 0, .26, .52] : [0];
    assert.deepEqual(item.assetPixels, [1024, 512 * slopes.length]); assert.deepEqual(item.anchor, [64, 112]);
    assert.deepEqual(webpSize(fs.readFileSync(local(item.asset))), item.assetPixels, `${id} WebP dimensions`);
    assert.equal(fs.statSync(local(item.asset)).size, item.assetBytes); assert.equal(digest(item.asset), item.assetSha256);
    assert.equal(item.sourcePng, `tools/launcher-room/motion-source-png/${id}.png`); assert.equal(digest(item.sourcePng), item.sourceSha256);
    assert.equal(item.rigSpec, `tools/launcher-room/rig-specs/${id}.json`); assert.equal(digest(item.rigSpec), item.rigSpecSha256);
    assert.equal(item.receipt, `tools/launcher-room/motion-receipts/${id}.json`); assert.equal(digest(item.receipt), item.receiptSha256);
    assert.equal(digest(item.bakeReport), item.bakeReportSha256);
    const spec = read(item.rigSpec), receipt = read(item.receipt), report = read(item.bakeReport);
    assert.equal(spec.schema, 'one-piece-room-rig/1'); assert.equal(spec.character, item.key); assert.equal(spec.direction, item.direction);
    assert.equal(spec.images.sheet, `../motion-source-png/${id}.png`);
    assert.deepEqual(Object.keys(item.sourceImages).sort(), Object.keys(spec.images).sort());
    assert.deepEqual(receipt.sourceImages, item.sourceImages);
    for (const [name, source] of Object.entries(item.sourceImages)) {
      const suffix = name === 'sheet' ? id : `${id}-${name}`;
      assert.equal(source.sourcePng, `tools/launcher-room/motion-source-png/${suffix}.png`); assert.equal(spec.images[name], `../motion-source-png/${suffix}.png`);
      assert.equal(digest(source.sourcePng), source.sourceSha256); assert.equal(report.sourceHashes[name], source.sourceSha256);
      assert.equal(digest(source.provenance), source.provenanceSha256); const prompt = read(source.provenance).prompt;
      assert(typeof prompt === 'string' && prompt.trim() && !(prompt.trim().endsWith('.txt') && !prompt.includes('\n')), `Receipt must embed actual prompt: ${id}/${name}`);
      if (source.rawReceipt) assert.equal(digest(source.rawReceipt.path), source.rawReceipt.sha256);
      assert.equal(item.review.sourceHashes[name], source.sourceSha256);
    }
    assert.deepEqual(spec.output, item.renderOutput); assert.equal(spec.output.cell, 256); assert.equal(spec.output.stageWidth, 96); assert.deepEqual(spec.output.root, [128, 224]);
    assert.deepEqual(item.output, { ...spec.output, cell: 128, root: [64, 112], canonicalScale: spec.output.canonicalScale * .5 });
    assert.equal(spec.output.canonicalScale * .5, item.scale); assert(item.scale > 0 && item.scale <= 1);
    if (scales.has(item.key)) assert.equal(scales.get(item.key), item.scale, `Direction scale differs: ${id}`); else scales.set(item.key, item.scale);
    for (const part of PARTS) assert(spec.parts[part], `Missing authored part: ${id}/${part}`);
    assert(!spec.parts.body, 'Merged neutral head/body is not a production expression kit');
    for (const [name, part] of Object.entries(spec.parts)) {
      assert(spec.images[part.image || 'sheet'], `Unknown part source: ${id}/${name}`);
      assert(Array.isArray(part.rect) && part.rect.length === 4 && part.rect.every(Number.isFinite) && part.rect[2] > 0 && part.rect[3] > 0, `Invalid cut: ${id}/${name}`);
      if (part.joints) assert(part.joints.length === 3 && part.joints.every(point => point.length === 2 && point.every(Number.isFinite)), `Invalid joints: ${id}/${name}`);
      else assert(part.sourceRoot?.length === 2 && part.targetRoot?.length === 2 && part.scale > 0, `Invalid static part root: ${id}/${name}`);
    }
    assert.equal(spec.gait.stride, item.strideStagePixels); assert.equal(spec.gait.speed, item.speedStagePixels);
    assert.equal(data.characters[item.key].stride[item.direction], spec.gait.stride); assert.equal(data.characters[item.key].speed[item.direction], spec.gait.speed); assert.deepEqual(data.characters[item.key].root, item.anchor);
    assert.equal(receipt.sourceSha256, item.sourceSha256); assert.equal(receipt.rigSpecSha256, item.rigSpecSha256); assert.deepEqual(receipt.review, item.review);
    assert.equal(digest(receipt.provenance), receipt.provenanceSha256); assert(read(receipt.provenance).prompt?.trim(), 'Missing GPT generation prompt');
    if (receipt.rawReceipt) assert.equal(digest(receipt.rawReceipt.path), receipt.rawReceipt.sha256, 'Original generation receipt changed');
    assert.equal(report.character, item.key); assert.equal(report.direction, item.direction); assert.equal(report.kind, item.kind === 'motion' ? 'walk' : 'actions');
    assert.equal(report.frames, 32); assert.equal(report.columns, 8); assert.equal(report.rows, 4 * slopes.length); assert.equal(report.totalCells, 32 * slopes.length); assert.equal(report.cell, 256); assert.equal(report.edgeAlpha, 0); assert.deepEqual(report.root, item.renderOutput.root);
    assert.equal(digest(item.sourceRenderPng), item.sourceRenderSha256, 'Raw rendered atlas changed');
    assert.deepEqual(item.slopeVariants.map(value => value.slope), slopes); assert.deepEqual(report.slopeVariants.map(value => value.slope), slopes);
    for (const [index, variant] of item.slopeVariants.entries()) {
      assert.equal(variant.startFrame, index * 32); assert.equal(variant.frames.length, 32);
      for (const [frameIndex, frame] of variant.frames.entries()) {
        assert.equal(frame.index, frameIndex); assert.deepEqual(frame.renderBounds, report.slopeVariants[index].framesData[frameIndex].bbox);
        assert(frame.bounds[0] > 0 && frame.bounds[1] > 0 && frame.bounds[2] < 128 && frame.bounds[3] < 128);
      }
    }
    assert.equal(report.sourceHashes.sheet, item.sourceSha256); assert.equal(report.stride, spec.gait.stride); assert.equal(report.speed, spec.gait.speed);
    assert.equal(item.frames.length, 32); assert.equal(report.framesData.length, 32);
    for (const [index, frame] of item.frames.entries()) {
      const baked = report.framesData[index]; assert.equal(frame.index, index); assert.equal(frame.phase, index / 32);
      assert.deepEqual(frame.renderBounds, baked.bbox); assert(frame.bounds[0] > 0 && frame.bounds[1] > 0 && frame.bounds[2] < 128 && frame.bounds[3] < 128);
      assert.equal(frame.action, item.kind === 'acting' ? ACTIONS[Math.floor(index / 4)] : null);
      assert.equal(frame.actionBeat, item.kind === 'acting' ? [0, .5, 1, .5][index % 4] : 0);
    }
    if (item.kind === 'acting') for (const action of ACTIONS) assert(report.distinctActionFrames[action] >= 2, `No gesture/breath animation: ${id}/${action}`);
    assert.deepEqual(Object.keys(item.rendererHashes).sort(), ['rig-engine.js', 'bake-rig.js', 'encode-rig-atlas.py', 'build-rig-release.js'].sort());
    for (const [name, hash] of Object.entries(item.rendererHashes)) assert.equal(digest(`tools/launcher-room/${name}`), hash, `Renderer changed since bake: ${name}`);
    assert.equal(item.review.rendererSha256, item.rendererHashes['rig-engine.js']); assert.equal(item.review.bakerSha256, item.rendererHashes['bake-rig.js']);
    assert.equal(item.encoding.losslessRoundTrip, true);
    assert.deepEqual(item.encoding.resize, { fromPixels: [2048, 1024 * slopes.length], factor: .5, filter: 'LANCZOS' });
    assert.deepEqual(item.review.assetHashes, Object.fromEntries(manifest.items.filter(other => other.key === item.key && other.direction === item.direction).map(other => [other.kind, other.assetSha256])));
    assert(['pending', 'reviewed'].includes(item.review?.status)); assert.equal(item.review.sourceSha256, item.sourceSha256); assert.equal(item.review.rigSpecSha256, item.rigSpecSha256);
    for (const evidence of item.review.evidence) assert.equal(digest(evidence.path), evidence.sha256, `Review evidence changed: ${id}`);
    if (item.review.status === 'reviewed') assert(item.review.reviewer && item.review.notes && item.review.evidence.length, `Incomplete review evidence: ${id}`);
    if (requireReviewed) assert.equal(item.review.status, 'reviewed', `Selected rig still needs actual visual review: ${id}`);
  }
  const portraits = manifest.portraits || [];
  if (requireComplete) assert.deepEqual(portraits.map(item => item.key).sort(), [...CHARACTERS].sort(), 'Formal portrait gate requires ten current south idle crops');
  for (const portrait of portraits) {
    assert(CHARACTERS.includes(portrait.key)); assert.equal(portrait.asset, `public/images/launcher_room/portrait_v2/${portrait.key}.webp`);
    assert.deepEqual(portrait.assetPixels, [256, 256]); assert.deepEqual(webpSize(fs.readFileSync(local(portrait.asset))), [256, 256]);
    assert.equal(digest(portrait.asset), portrait.assetSha256); assert.equal(fs.statSync(local(portrait.asset)).size, portrait.assetBytes);
    assert.equal(portrait.sourceAtlas, `public/images/launcher_room/acting_v2/${portrait.key}/south.webp`); assert.equal(digest(portrait.sourceAtlas), portrait.sourceAtlasSha256);
    const source = manifest.items.find(item => item.asset === portrait.sourceAtlas);
    assert.equal(portrait.sourceRenderPng, source.sourceRenderPng); assert.equal(portrait.sourceRenderSha256, source.sourceRenderSha256); assert.equal(digest(portrait.sourceRenderPng), portrait.sourceRenderSha256);
    assert.equal(portrait.sourceFrame, 0); assert.deepEqual(portrait.sourceRect, [0, 0, 256, 256]); assert.equal(portrait.losslessPixelMatch, true);
  }
  return { assets: actual.length, portraits: portraits.length, directions: actual.length / 2, complete: actual.length === 80 && portraits.length === 10, allSelectedArtReviewed: manifest.items.every(item => item.review.status === 'reviewed'), visualAcceptance: false };
}
module.exports = { validate, webpSize };
if (require.main === module) {
  try { console.log(JSON.stringify(validate(process.argv[2] || path.resolve(__dirname, '../..'), { requireComplete: !process.argv.includes('--partial'), requireReviewed: process.argv.includes('--reviewed') }))); }
  catch (error) { console.error(error.stack || error); process.exitCode = 1; }
}
