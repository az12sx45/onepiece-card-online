'use strict';
// Keep the accepted 1.2.2 review immutable and execute its original checks
// against its exact committed runtime. Evidence and art still come from disk.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const assert = require('node:assert/strict');
const historical = require('../presentation-v122/validate_historical_life');
const BASELINE = 'caf02b4f2e768ebc4c0eefb9f393fff1b08ee8c9';
const PINNED = Object.freeze({
  'docs/LAUNCHER_ROOM_PRESENTATION_20260927.json': '8fffd502dc703f6da8cbe3a944a5f645a6e137c7f9eb5bf80b7d09219a556691',
  'tools/launcher-room/presentation-v122/validate_release.js': '44f75fd9df7d3a7f3fb2bab643e5aefa1d5f0c4de0f55d5a783614183aa99ee5',
  'tools/launcher-room/presentation-v122/validate_historical_life.js': '0a3717ccdd9f1db83dc28399fcfb903229bc544c3d641082665831584165a80a'
});
function validateHistorical(root) {
  root = path.resolve(root);
  for (const [file, digest] of Object.entries(PINNED)) {
    assert.equal(historical.normalizedSha256(fs.readFileSync(historical.safePath(root, file))), digest,
      'Historical presentation review or validator was rewritten: ' + file);
  }
  const legacy = historical.validateHistorical(root);
  const git = args => cp.execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
  assert.equal(git(['rev-parse', '--verify', BASELINE + '^{commit}']).toString().trim(), BASELINE);
  const previous = require('../presentation-v122/validate_release');
  const review = JSON.parse(fs.readFileSync(historical.safePath(root, previous.REVIEW_PATH), 'utf8'));
  const runtimeProof = [];
  const oldContext = { ...legacy, validateCurrentRuntime: checked => {
    for (const [file, digest] of Object.entries(checked.runtime)) {
      historical.safePath(root, file);
      const bytes = git(['cat-file', 'blob', BASELINE + ':' + file]);
      assert.equal(historical.normalizedSha256(bytes), digest, 'Committed 1.2.2 runtime differs from its review: ' + file);
      runtimeProof.push({ path: file, normalizedSha256: digest });
    }
  } };
  const result = previous.validateReview(root, review, oldContext);
  return { ...legacy, presentation: result, presentationBaseline: BASELINE, presentationRuntimeProof: runtimeProof };
}
module.exports = { validateHistorical, BASELINE, PINNED };
if (require.main === module) {
  const result = validateHistorical(path.resolve(__dirname, '../../..'));
  console.log(JSON.stringify({ complete: result.presentation.complete, presentationBaseline: BASELINE,
    historicalPresentationRuntimeFiles: result.presentationRuntimeProof.length,
    historicalLifeRuntimeFiles: result.runtimeProof.length, currentLifeAssets: result.life.assets }));
}
