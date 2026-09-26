'use strict';
// Packaging checks provenance and exact deployed bytes. Visual review is separate.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const KEYS = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
const DIRS = ['east', 'west', 'north', 'south'];
function validate(root) {
  const staticValidator = require('./validate-fullbody-manifest');
  staticValidator.validate(root, { requireComplete: true });
  const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const file = relative => {
    assert(typeof relative === 'string' && !path.isAbsolute(relative), 'Relative provenance path required');
    const full = path.resolve(root, relative);
    assert(full.startsWith(path.resolve(root) + path.sep), 'Provenance path escapes project');
    assert(fs.statSync(full).isFile(), `Missing provenance: ${relative}`);
    return full;
  };
  const checked = (relative, hash) => {
    assert(/^[a-f0-9]{64}$/.test(hash), `Invalid SHA: ${relative}`);
    assert.equal(sha(file(relative)), hash, `SHA changed: ${relative}`);
  };
  const body = JSON.parse(fs.readFileSync(file('docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json'), 'utf8'));
  const walk = JSON.parse(fs.readFileSync(file('docs/LAUNCHER_ROOM_WALK_V3_20260927.json'), 'utf8'));
  assert.equal(walk.partial, false);
  assert.equal(walk.anatomyReassembled, false);
  assert.equal(walk.mirrored, false);
  assert.deepEqual(walk.shape, { columns: 4, rows: 1, cell: 128, frames: 4, root: [64, 112] });
  assert.deepEqual(walk.poseOrder, ['contact-a', 'neutral', 'contact-c', 'neutral']);
  for (const item of walk.items) {
    assert.deepEqual(staticValidator.webpSize(fs.readFileSync(file(item.asset))), [512, 128]);
    assert.deepEqual(item.frames.map(frame => frame.pose), walk.poseOrder);
    for (const frame of item.frames) {
      assert.equal(frame.anatomyReassembled, false);
      assert.equal(frame.mirrored, false);
      assert.equal(frame.clipped, false);
    }
  }
  for (const [manifest, kind] of [[body, 'acting'], [walk, 'motion']]) {
    assert.equal(manifest.version, '1.1.15');
    assert.equal(manifest.canonicalCharactersOnly, true);
    assert.notEqual(manifest.fixtureSources, true);
    assert.equal(manifest.items.length, 40);
    assert.deepEqual(manifest.items.map(item => item.asset).sort(), KEYS.flatMap(key => DIRS.map(direction => `public/images/launcher_room/${kind}_v3/${key}/${direction}.webp`)).sort());
    for (const source of Object.values(manifest.sources)) {
      assert.equal(source.generator, 'gpt-image');
      for (const name of ['image', 'prompt', 'receipt']) checked(source[name].path, source[name].sha256);
      for (const entry of source.ancestry || []) checked(entry.path, entry.sha256);
    }
    for (const name of ['originalSelection', 'resolvedSelection']) if (manifest[name]) checked(manifest[name].path, manifest[name].sha256);
    for (const item of manifest.items) {
      checked(item.asset, item.assetSha256);
      assert.equal(fs.statSync(file(item.asset)).size, item.assetBytes);
      checked(item.rawRender, item.rawRenderSha256);
      checked(item.report, item.reportSha256);
    }
  }
  assert.equal(body.portraits.length, 10);
  assert.deepEqual(body.portraits.map(item => item.key).sort(), [...KEYS].sort());
  for (const item of body.portraits) {
    assert.equal(item.wholeBody, true);
    assert.equal(item.asset, `public/images/launcher_room/portrait_v3/${item.key}.webp`);
    checked(item.asset, item.assetSha256);
  }
  const review = JSON.parse(fs.readFileSync(file('tools/launcher-room/fullbody-v3/review.json'), 'utf8'));
  assert.equal(review.scope, 'rendered-asset-inspection');
  assert.equal(review.status, 'REVIEWED');
  assert.deepEqual(review.characters.map(item => item.key).sort(), [...KEYS].sort());
  for (const item of review.characters) assert.equal(item.inspected, true, `${item.key} still needs visual inspection`);
  // Bind the review to both exact manifests, so replacing art invalidates review.
  checked('docs/LAUNCHER_ROOM_FULLBODY_ART_20260927.json', review.actionsManifestSha256);
  checked('docs/LAUNCHER_ROOM_WALK_V3_20260927.json', review.walkManifestSha256);
  assert(review.evidence?.length > 0, 'Rendered review evidence required');
  for (const entry of review.evidence) checked(entry.path, entry.sha256);
  return { complete: true, allSelectedArtReviewed: true, assets: 80, portraits: 10, reviewScope: review.scope, humanAcceptance: false };
}
module.exports = { validate };
if (require.main === module) console.log(JSON.stringify(validate(path.resolve(__dirname, '../..'))));
