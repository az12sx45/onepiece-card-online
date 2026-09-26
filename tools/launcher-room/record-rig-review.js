'use strict';
// Record an explicit review of unchanged final pixels; this tool never reviews art.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { validate } = require('./validate-rig-manifest');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const write = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');
function main() {
  const args = process.argv.slice(2), planIndex = args.indexOf('--plan'), rootIndex = args.indexOf('--root');
  assert(planIndex >= 0 && args[planIndex + 1], 'Usage: node record-rig-review.js --plan reviewed-selection.json [--root DIRECTORY]');
  const root = path.resolve(rootIndex >= 0 ? args[rootIndex + 1] : path.join(__dirname, '../..')), planPath = path.resolve(args[planIndex + 1]), plan = read(planPath);
  validate(root);
  const manifestPath = path.join(root, 'docs/LAUNCHER_ROOM_MOTION_ART_20260926.json'), manifest = read(manifestPath), updates = [], seen = new Set();
  for (const entry of plan.entries) {
    const key = `${entry.character}-${entry.direction}`; assert(!seen.has(key), `Duplicate review: ${key}`); seen.add(key);
    const items = manifest.items.filter(item => item.key === entry.character && item.direction === entry.direction);
    assert.equal(items.length, 2, `Unknown review selection: ${key}`);
    const item = items[0], incoming = entry.review;
    assert.equal(incoming?.status, 'reviewed', `Review not explicitly complete: ${key}`);
    assert(incoming.reviewer && incoming.notes && incoming.evidence?.length, `Review needs reviewer, notes and actual evidence: ${key}`);
    assert.equal(incoming.specSha256, item.rigSpecSha256); assert.equal(sha(path.resolve(path.dirname(planPath), entry.spec)), item.rigSpecSha256);
    assert.deepEqual(incoming.sourceHashes || { sheet: incoming.sourceSha256 }, item.review.sourceHashes);
    assert.equal(incoming.rendererSha256, item.rendererHashes['rig-engine.js']); assert.equal(incoming.bakerSha256, item.rendererHashes['bake-rig.js']);
    assert.deepEqual(incoming.assetHashes, Object.fromEntries(items.map(value => [value.kind, value.assetSha256])), `Review is not bound to the final encoded atlases: ${key}`);
    const review = { ...item.review, ...incoming, rigSpecSha256: item.rigSpecSha256, sourceSha256: item.sourceSha256, evidence: [] };
    for (const [index, value] of incoming.evidence.entries()) {
      const source = path.resolve(path.dirname(planPath), typeof value === 'string' ? value : value.path);
      const relative = `tools/launcher-room/motion-reviews/${key}-final-${index}${path.extname(source)}`, target = path.join(root, relative);
      assert(fs.statSync(source).isFile()); review.evidence.push({ path: relative, sha256: sha(source) });
      updates.push(() => { fs.mkdirSync(path.dirname(target), { recursive: true }); if (source !== target) fs.copyFileSync(source, target); assert.equal(sha(target), sha(source)); });
    }
    updates.push(() => {
      const receiptPath = path.join(root, item.receipt), receipt = read(receiptPath); receipt.review = review; write(receiptPath, receipt);
      for (const entry of items) { entry.review = review; entry.receiptSha256 = sha(receiptPath); }
    });
  }
  assert(seen.size > 0, 'No review entries');
  for (const update of updates) update();
  manifest.allSelectedArtReviewed = manifest.items.every(item => item.review.status === 'reviewed');
  manifest.reviewRecordedAt = new Date().toISOString(); write(manifestPath, manifest);
  const selectedPath = path.join(root, 'tools/launcher-room/rig-selection.json');
  if (fs.existsSync(selectedPath)) {
    const selected = read(selectedPath);
    for (const entry of selected.entries) {
      const item = manifest.items.find(item => item.key === entry.character && item.direction === entry.direction);
      entry.review = { ...item.review, specSha256: item.rigSpecSha256, evidence: item.review.evidence.map(value => path.relative(path.dirname(selectedPath), path.join(root, value.path)).split(path.sep).join('/')) };
    }
    write(selectedPath, selected);
  }
  console.log(JSON.stringify({ recordedDirections: seen.size, ...validate(root), inferenceOfVisualApproval: false }));
}
try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; }
