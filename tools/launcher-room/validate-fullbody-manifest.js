'use strict';
// Packaging gate: source/receipt/output integrity. Python additionally rebuilds every figure.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const KEYS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
const DIRECTIONS = ['east', 'west', 'north', 'south'];
const POSES = ['idle', 'talk_happy', 'talk_annoyed', 'surprised', 'focused_use', 'sit', 'wave', 'listen'];
const MANIFEST = 'docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json';
function webpSize(bytes) {
  assert.equal(bytes.toString('ascii', 0, 4), 'RIFF'); assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
  for (let offset = 12; offset + 8 <= bytes.length;) {
    const kind = bytes.toString('ascii', offset, offset + 4), size = bytes.readUInt32LE(offset + 4), start = offset + 8;
    assert(start + size <= bytes.length, 'Truncated WebP chunk');
    if (kind === 'VP8X') return [1 + bytes.readUIntLE(start + 4, 3), 1 + bytes.readUIntLE(start + 7, 3)];
    if (kind === 'VP8L') { assert.equal(bytes[start], 0x2f); const value = bytes.readUInt32LE(start + 1); return [1 + (value & 0x3fff), 1 + ((value >>> 14) & 0x3fff)]; }
    offset = start + size + size % 2;
  }
  throw Error('Expected lossless WebP dimensions');
}
function validate(root, { requireComplete = true } = {}) {
  root = path.resolve(root);
  const hashes = new Map();
  const local = name => { assert.equal(typeof name, 'string'); assert(!path.isAbsolute(name)); const result = path.resolve(root, name); assert(result.startsWith(root + path.sep), `Path escapes repository: ${name}`); return result; };
  const read = name => JSON.parse(fs.readFileSync(local(name), 'utf8').replace(/^\uFEFF/, ''));
  const hash = name => { if (!hashes.has(name)) hashes.set(name, crypto.createHash('sha256').update(fs.readFileSync(local(name))).digest('hex')); return hashes.get(name); };
  const checkFile = ref => { assert.match(ref.sha256, /^[a-f0-9]{64}$/); assert.equal(hash(ref.path), ref.sha256, `SHA changed: ${ref.path}`); if (ref.bytes !== undefined) assert.equal(fs.statSync(local(ref.path)).size, ref.bytes); };
  const manifest = read(MANIFEST);
  assert.equal(manifest.schema, 'one-piece-room-fullbody-art/3'); assert.equal(manifest.version, '1.1.14');
  assert.equal(manifest.canonicalCharactersOnly, true); assert.equal(manifest.anatomyReassembled, false);
  assert.equal(manifest.walkProvided, false); assert.equal(manifest.fixtureSources, false);
  assert.equal(manifest.visualAccepted, false); assert.equal(manifest.requiresManualVisualReview, true);
  assert.deepEqual(manifest.poseOrder, POSES);
  assert.deepEqual(manifest.shape, { cell: 128, columns: 8, rows: 1, root: [64, 112], standingMaxHeight: 100, maxWidth: 112 });
  checkFile(manifest.originalSelection); checkFile(manifest.resolvedSelection);
  const resolved = read(manifest.resolvedSelection.path), original = read(manifest.originalSelection.path);
  assert.deepEqual(original.frames, resolved.frames); assert.deepEqual(Object.keys(manifest.sources).sort(), Object.keys(resolved.sources).sort());
  for (const [id, source] of Object.entries(manifest.sources)) {
    assert.equal(source.generator, 'gpt-image');
    for (const kind of ['image', 'prompt', 'receipt']) { checkFile(source[kind]); assert.equal(source[kind].sha256, resolved.sources[id][kind].sha256); assert.equal(source[kind].sha256, original.sources[id][kind].sha256); }
    assert.equal(source.promptText, fs.readFileSync(local(source.prompt.path), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n'));
    assert(source.promptText.trim().length >= 12); assert(Object.keys(read(source.receipt.path)).length > 0);
    for (const extra of source.ancestry) checkFile(extra);
    assert.deepEqual(source.ancestry, resolved.sources[id].ancestry || []);
  }
  const expected = KEYS.flatMap(key => DIRECTIONS.map(direction => `${key}/${direction}`)).sort();
  const actual = manifest.items.map(item => `${item.key}/${item.direction}`).sort();
  assert.equal(new Set(actual).size, actual.length); assert(actual.every(value => expected.includes(value)));
  if (requireComplete) assert.deepEqual(actual, expected);
  for (const item of manifest.items) {
    assert.equal(item.kind, 'static-poses'); assert.equal(item.asset, `public/images/launcher_room/acting_v3/${item.key}/${item.direction}.webp`);
    checkFile({ path: item.asset, sha256: item.assetSha256, bytes: item.assetBytes });
    checkFile({ path: item.rawRender, sha256: item.rawRenderSha256 }); checkFile({ path: item.report, sha256: item.reportSha256 });
    assert.deepEqual(item.assetPixels, [1024, 128]); assert.deepEqual(webpSize(fs.readFileSync(local(item.asset))), [1024, 128]);
    const report = read(item.report); assert.deepEqual(report.frames, item.frames); assert.equal(report.uniformDirectionScale, item.uniformDirectionScale);
    assert.deepEqual(item.frames.map(frame => frame.pose), POSES); assert(item.uniformDirectionScale > 0);
    assert.deepEqual(item.sourceHashes, Object.fromEntries(item.sourceIds.map(id => [id, manifest.sources[id].image.sha256])));
    for (const [index, frame] of item.frames.entries()) {
      assert.equal(frame.index, index); assert.equal(frame.anatomyReassembled, false); assert.equal(frame.mirrored, false); assert.equal(frame.clipped, false);
      assert.equal(frame.uniformDirectionScale, item.uniformDirectionScale); assert(item.sourceIds.includes(frame.source));
      assert(frame.bounds[0] > 0 && frame.bounds[1] > 0 && frame.bounds[2] < 128 && frame.bounds[3] < 128);
    }
  }
  const portraits = manifest.portraits.map(item => item.key).sort();
  assert.equal(new Set(portraits).size, portraits.length);
  assert.deepEqual(portraits, manifest.items.filter(item => item.direction === 'south').map(item => item.key).sort());
  for (const item of manifest.portraits) {
    assert.equal(item.asset, `public/images/launcher_room/portrait_v3/${item.key}.webp`);
    assert.equal(item.direction, 'south'); assert.equal(item.pose, 'idle'); assert.equal(item.wholeBody, true);
    assert.deepEqual(item.assetPixels, [256, 256]); assert.deepEqual(item.root, [128, 224]);
    checkFile({ path: item.asset, sha256: item.assetSha256, bytes: item.assetBytes }); checkFile({ path: item.rawRender, sha256: item.rawRenderSha256 });
    assert.deepEqual(webpSize(fs.readFileSync(local(item.asset))), [256, 256]);
  }
  return { ok: true, atlases: actual.length, frames: actual.length * 8, portraits: portraits.length,
    sources: Object.keys(manifest.sources).length, filesHashed: hashes.size, walkProvided: false, visualAccepted: false, manifest };
}
module.exports = { validate, MANIFEST, webpSize };
if (require.main === module) {
  const rootArg = process.argv.indexOf('--root');
  const result = validate(rootArg < 0 ? path.resolve(__dirname, '../..') : process.argv[rootArg + 1], { requireComplete: !process.argv.includes('--allow-partial') });
  const { manifest, ...summary } = result; console.log(JSON.stringify(summary));
}
