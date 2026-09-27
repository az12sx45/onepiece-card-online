'use strict';
// Higher-resolution re-export of the same reviewed whole-body artwork.
// No geometry waiver and no permission to replace historical v3 resources.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const historical = require('../presentation-v122/validate_historical_life');
const { webpSize } = require('../validate-fullbody-manifest');
const MANIFEST = 'tools/launcher-room/hd-v4/manifest.json';
const QUALITY_REPORT = 'tools/launcher-room/hd-v4/review-evidence/QUALITY_QA.json';
const KEYS = Object.freeze(['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe']);
const DIRECTIONS = Object.freeze(['east', 'west', 'north', 'south']);
const KINDS = Object.freeze(['motion_v4', 'acting_v4']);
const ASSETS = Object.freeze(KEYS.flatMap(key => KINDS.flatMap(kind => DIRECTIONS.map(direction => `public/images/launcher_room/${kind}/${key}/${direction}.webp`))));
const LEGACY = Object.freeze({ motion_v4: 'docs/LAUNCHER_ROOM_WALK_V3_20260927.json', acting_v4: 'docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json' });
function validateQuality(root, report) {
  const read = file => fs.readFileSync(historical.safePath(root, file));
  const check = ref => {
    assert(ref && typeof ref.path === 'string');
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    const bytes = read(ref.path);
    assert.equal(historical.sha256(bytes), ref.sha256, 'HD quality evidence changed: ' + ref.path);
    return bytes;
  };
  assert.equal(report.schema, 'one-piece-room-hd-quality-qa/1');
  assert.equal(report.ok, true);
  assert.equal(report.humanAcceptance, false);
  assert.equal(report.visualAcceptance, false, 'Automated readback does not perform visual acceptance');
  assert.equal(report.renderer?.path, 'desktop/launcher-room-motion.js');
  assert.match(report.renderer.sha256, /^[a-f0-9]{64}$/, 'Preserve the actual tested raw renderer hash');
  assert.equal(report.renderer.hashNormalization, historical.NORMALIZATION);
  assert.equal(report.renderer.normalizedSha256, historical.normalizedSha256(read(report.renderer.path)),
    'HD quality QA was run against different renderer content');
  assert.equal(report.script?.path, 'tools/launcher-room/hd-v4/quality_qa.js'); check(report.script);
  assert.equal(report.manifest?.path, MANIFEST); check(report.manifest);
  const expected = KEYS.flatMap(key => ['walk', 'idle'].flatMap(kind => DIRECTIONS.flatMap(direction =>
    [1, 2].map(dpr => `${key}/${kind}/${direction}/${dpr}`))));
  assert.deepEqual((report.results || []).map(row => `${row.key}/${row.kind}/${row.direction}/${row.dpr}`).sort(),
    expected.sort(), 'HD quality QA must cover all 160 crew/action/direction/DPR combinations exactly once');
  for (const row of report.results) {
    assert.equal(row.cell, row.kind === 'walk' ? 384 : 256);
    assert.equal(row.frames, row.kind === 'walk' ? 4 : 8);
    assert.equal(row.stableBackingDraws, 100);
    assert.equal(row.layoutReads, 0);
    assert.equal(row.clippedFrames, 0);
  }
  assert.equal(report.checks, 160);
  assert.equal(report.totalFrameChecks, 960);
  assert.equal(report.stableBackingDraws, 16000);
  assert.equal(report.results.reduce((sum, row) => sum + row.frames, 0), report.totalFrameChecks);
  assert.equal(report.results.reduce((sum, row) => sum + row.stableBackingDraws, 0), report.stableBackingDraws);
  assert.deepEqual((report.evidence || []).map(item => item.dpr).sort(), [1, 2]);
  for (const item of report.evidence) {
    assert.equal(item.path, `tools/launcher-room/hd-v4/review-evidence/quality-paired-dpr${item.dpr}.png`);
    assert.equal(item.cssCanvas, 244);
    assert.equal(item.physicalCanvas, 244 * item.dpr);
    const bytes = check(item);
    assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Expected actual HD quality PNG');
    assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
    assert(bytes.readUInt32BE(16) >= 512 && bytes.readUInt32BE(20) >= 300, 'HD paired contact sheet is too small');
  }
  assert(typeof report.scope === 'string' && /web security disabled/i.test(report.scope)
    && /does not verify packaged protocol security/i.test(report.scope), 'Preserve the actual isolated readback limitations');
  return { complete: true, checks: report.checks, frames: report.totalFrameChecks,
    stableBackingDraws: report.stableBackingDraws, humanAcceptance: false };
}
function validate(root) {
  root = path.resolve(root);
  const cache = new Map();
  const read = file => fs.readFileSync(historical.safePath(root, file));
  const json = file => JSON.parse(read(file).toString('utf8').replace(/^\uFEFF/, ''));
  const check = ref => {
    assert(ref && typeof ref.path === 'string');
    assert.match(ref.sha256, /^[a-f0-9]{64}$/);
    if (!cache.has(ref.path)) cache.set(ref.path, read(ref.path));
    const bytes = cache.get(ref.path);
    assert.equal(historical.sha256(bytes), ref.sha256, 'HD provenance or asset changed: ' + ref.path);
    if (ref.bytes !== undefined) assert.equal(bytes.length, ref.bytes, 'HD asset byte count differs: ' + ref.path);
    return bytes;
  };
  const manifest = json(MANIFEST);
  assert.equal(manifest.schema, 'one-piece-room-hd-art/4');
  assert.equal(manifest.version, '1.2.4');
  assert.equal(manifest.logicalCell, 128);
  assert.equal(manifest.anatomyReassembled, false);
  assert.equal(manifest.mirrored, false);
  assert.equal(manifest.generatedNewDrawings, false);
  assert.equal(manifest.visualAcceptance, false, 'The export report does not perform visual acceptance');
  assert.equal(manifest.humanAcceptance, false);
  assert.equal(manifest.legacyFramesReproduced, 480);
  assert.equal(manifest.exporter.path, 'tools/launcher-room/hd-v4/export_hd.py'); check(manifest.exporter);
  assert.equal(manifest.legacyImporter.path, 'tools/launcher-room/import_fullbody_v3.py'); check(manifest.legacyImporter);
  assert.deepEqual((manifest.inputs || []).map(item => item.kind).sort(), [...KINDS].sort(), 'Both original motion and acting inputs are required');
  const original = new Map(), selections = new Map(), expectedSources = new Map();
  for (const input of manifest.inputs) {
    assert.equal(input.legacyManifest.path, LEGACY[input.kind]);
    check(input.legacyManifest); check(input.selection);
    const legacy = json(input.legacyManifest.path), selection = json(input.selection.path);
    assert.deepEqual(input.selection, legacy.resolvedSelection, 'HD export changed the reviewed component selection');
    original.set(input.kind, legacy);
    selections.set(input.kind, new Map(selection.frames.map(frame => [`${frame.key}/${frame.direction}/${frame.pose}`, frame])));
    for (const source of Object.values(legacy.sources)) {
      check(source.image);
      expectedSources.set(source.image.path, source.image.sha256);
    }
  }
  assert.deepEqual(Object.keys(manifest.sources || {}).sort(), [...expectedSources.keys()].sort(), 'HD source coverage differs from the preserved reviewed originals');
  for (const [file, source] of Object.entries(manifest.sources)) {
    assert.equal(source.path, file);
    assert.equal(source.sha256, expectedSources.get(file));
    assert.equal(source.generator, 'gpt-image');
    check(source);
  }
  assert.deepEqual((manifest.items || []).map(item => item.asset).sort(), [...ASSETS].sort(), 'Exactly eighty canonical HD direction atlases are required');
  let bytes = 0, frameCount = 0;
  for (const item of manifest.items) {
    assert(KINDS.includes(item.kind) && KEYS.includes(item.key) && DIRECTIONS.includes(item.direction));
    assert.equal(item.asset, `public/images/launcher_room/${item.kind}/${item.key}/${item.direction}.webp`);
    const cell = item.kind === 'motion_v4' ? 384 : 256, columns = item.kind === 'motion_v4' ? 4 : 8;
    assert.equal(item.cell, cell); assert.equal(item.columns, columns);
    assert.equal(item.logicalCell, 128); assert.equal(item.resolution, cell / 128);
    assert.deepEqual(item.dimensions, [cell * columns, cell]);
    const atlas = check({ path: item.asset, sha256: item.sha256, bytes: item.bytes });
    assert.deepEqual(webpSize(atlas), item.dimensions, 'Actual HD atlas dimensions differ');
    assert.equal(item.losslessPixelMatch, true);
    const legacy = original.get(item.kind), old = legacy.items.find(row => row.key === item.key && row.direction === item.direction);
    assert(old, 'HD atlas has no reviewed original');
    assert.equal(item.legacyAsset.path, old.asset); assert.equal(item.legacyAsset.sha256, old.assetSha256); check(item.legacyAsset);
    assert.equal(item.frames.length, columns);
    for (let index = 0; index < columns; index += 1) {
      const frame = item.frames[index], prior = old.frames[index];
      assert.equal(frame.index, index); assert.equal(frame.pose, prior.pose);
      assert.equal(frame.legacyRgbaSha256, prior.rgbaSha256, 'Re-export no longer reproduces the reviewed legacy pixels');
      assert.equal(frame.legacyPixelsReproduced, true);
      assert.match(frame.rgbaSha256, /^[a-f0-9]{64}$/);
      assert.deepEqual(frame.localAnchor, prior.localAnchor);
      assert.equal(frame.uniformDirectionScale, prior.uniformDirectionScale);
      assert.equal(frame.sourceUnitScale, prior.sourceUnitScale);
      const authored = selections.get(item.kind).get(`${item.key}/${item.direction}/${frame.pose}`);
      assert(authored, 'Missing original authoring selection');
      assert.equal(frame.sourceId, authored.source);
      assert.equal(frame.sourcePath, legacy.sources[authored.source].image.path);
      assert.deepEqual(frame.sourceRegion, authored.region);
      assert.deepEqual(frame.root, [cell / 2, cell * 112 / 128]);
      assert.equal(frame.clipped, false);
      assert(Array.isArray(frame.bounds) && frame.bounds.length === 4 && frame.bounds.every(Number.isFinite));
      assert(frame.bounds[0] > 0 && frame.bounds[1] > 0 && frame.bounds[2] < cell && frame.bounds[3] < cell,
        'HD frame touches or exceeds cell bounds');
      assert(Array.isArray(frame.inverseWholeImageTransform) && frame.inverseWholeImageTransform.length === 6
        && frame.inverseWholeImageTransform.every(Number.isFinite), 'Expected one whole-image affine transform');
      frameCount += 1;
    }
    bytes += item.bytes;
  }
  assert.equal(frameCount, 480);
  const quality = validateQuality(root, json(QUALITY_REPORT));
  return { complete: true, manifest, assets: ASSETS.length, frames: frameCount, bytes,
    manifestSha256: historical.sha256(read(MANIFEST)), quality,
    qualitySha256: historical.sha256(read(QUALITY_REPORT)), humanAcceptance: false };
}
module.exports = { validate, validateQuality, MANIFEST, QUALITY_REPORT, ASSETS, KEYS, KINDS, DIRECTIONS };
if (require.main === module) {
  const result = validate(path.resolve(__dirname, '../../..'));
  console.log(JSON.stringify({ complete: result.complete, assets: result.assets, frames: result.frames,
    bytes: result.bytes, manifestSha256: result.manifestSha256, quality: result.quality,
    qualitySha256: result.qualitySha256, humanAcceptance: false }));
}
