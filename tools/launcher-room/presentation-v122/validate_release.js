'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const historical = require('./validate_historical_life');
const REVIEW_PATH = 'docs/LAUNCHER_ROOM_PRESENTATION_20260927.json';
const EVIDENCE_PREFIX = 'tools/launcher-room/presentation-v122/review-evidence/';
const ADDITIONAL_RUNTIME = ['desktop/launcher-profile-shop.css', 'desktop/launcher.css', 'desktop/launcher.js', 'desktop/launcher-room-motion.js', 'desktop/launcher-room-motion-data.js'];
const CASES = Object.freeze([
  { id: 'desktop-owner-popover', viewport: 'desktop' },
  { id: 'mobile-owner-popover', viewport: 'mobile' },
  { id: 'desktop-friend-readonly-popover', viewport: 'desktop' },
  { id: 'desktop-furniture-edit', viewport: 'desktop' },
  ...['crew-cabin', 'sunny-deck', 'sunny-kitchen', 'sunny-library'].map(scene => ({ id: 'desktop-scale-' + scene, viewport: 'desktop' }))
]);
function validateReview(root, review, legacy) {
  assert.equal(review.schema, 'launcher-room-presentation/1');
  assert.equal(review.releaseVersion, '1.2.2');
  assert.equal(review.artGeneration, '1.2.0');
  assert.equal(review.historicalBaseline, historical.BASELINE);
  assert.equal(review.status, 'PASS_WITH_NOTES', '1.2.2 visual review is not complete');
  assert.deepEqual(review.blockingIssues, []);
  assert.equal(review.humanAcceptance, false, 'This gate records model visual review, not human acceptance');
  assert(typeof review.method === 'string' && review.method.length >= 40, 'Record the actual inspection method');
  assert(Array.isArray(review.limitations) && review.limitations.length > 0, 'Record visual-review limitations');
  assert.equal(review.runtimeHashNormalization, historical.NORMALIZATION);
  assert.deepEqual(review.approvedRuntimeVariants, JSON.parse(JSON.stringify(legacy.life.review.approvedRuntimeVariants)), 'Only the immutable formal Board variant may be inherited');
  const requiredRuntime = [...Object.keys(legacy.life.review.runtime), ...ADDITIONAL_RUNTIME].sort();
  assert.deepEqual(Object.keys(review.runtime || {}).sort(), requiredRuntime, '1.2.2 runtime coverage must be exact and complete');
  // All new runtime checks are against the current tree, with the original
  // validator's exact, evidence-bound formal distribution exception only.
  legacy.validateCurrentRuntime(review);
  assert.equal(review.runtime['server/desktop-distribution.js'], legacy.life.review.runtime['server/desktop-distribution.js'], 'The formal Board variant base must remain unchanged');
  assert(Array.isArray(review.evidence) && review.evidence.length > 0, 'New visual evidence is required');
  const evidence = new Map();
  for (const entry of review.evidence) {
    assert(typeof entry.path === 'string' && entry.path.startsWith(EVIDENCE_PREFIX) && path.posix.normalize(entry.path) === entry.path, '1.2.2 evidence must be self-contained in its own directory');
    assert(!evidence.has(entry.path), 'Duplicate evidence path');
    assert.match(entry.sha256, /^[a-f0-9]{64}$/);
    const bytes = fs.readFileSync(historical.safePath(root, entry.path));
    assert.equal(historical.sha256(bytes), entry.sha256, 'Changed presentation evidence: ' + entry.path);
    if (entry.kind === 'screenshot') {
      assert(bytes.length >= 24 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Visual evidence must be an actual PNG');
      const pixels = [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
      assert.deepEqual(entry.pixels, pixels, 'Screenshot dimensions differ');
    } else assert.equal(entry.kind, 'report', 'Unknown evidence type');
    evidence.set(entry.path, entry);
  }
  assert.deepEqual((review.checks || []).map(item => item.id).sort(), CASES.map(item => item.id).sort(), 'Visual scenario coverage differs');
  for (const required of CASES) {
    const check = review.checks.find(item => item.id === required.id);
    assert.equal(check.status, 'PASS', 'Unreviewed or failed scenario: ' + check.id);
    assert(typeof check.notes === 'string' && check.notes.trim().length >= 16, 'Specific visual findings required: ' + check.id);
    assert(Array.isArray(check.evidence) && check.evidence.length > 0, 'Scenario needs a reviewed screenshot: ' + check.id);
    for (const file of check.evidence) {
      const item = evidence.get(file);
      assert(item && item.kind === 'screenshot', 'Missing screenshot binding: ' + check.id);
      const [width, height] = item.pixels;
      assert(height >= 300, 'Use a readable room or viewport screenshot for ' + check.id);
      assert(required.viewport === 'desktop' ? width >= 900 : width >= 350 && width <= 450, 'Screenshot viewport does not match ' + check.id);
    }
  }
  return { complete: true, review, scenarios: CASES.length, currentRuntimeFiles: requiredRuntime.length, evidenceFiles: evidence.size, humanAcceptance: false };
}
function validate(root) {
  const legacy = historical.validateHistorical(root);
  const review = JSON.parse(fs.readFileSync(historical.safePath(root, REVIEW_PATH), 'utf8'));
  const result = validateReview(root, review, legacy);
  return { ...result, life: legacy.life, historicalBaseline: legacy.baseline, historicalRuntimeProof: legacy.runtimeProof };
}
module.exports = { validate, validateReview, REVIEW_PATH, EVIDENCE_PREFIX, ADDITIONAL_RUNTIME, CASES };
if (require.main === module) {
  const result = validate(path.resolve(__dirname, '../../..'));
  console.log(JSON.stringify({ complete: result.complete, releaseVersion: result.review.releaseVersion, historicalBaseline: result.historicalBaseline, historicalRuntimeFiles: result.historicalRuntimeProof.length, currentRuntimeFiles: result.currentRuntimeFiles, currentLifeAssets: result.life.assets, visualScenarios: result.scenarios, evidenceFiles: result.evidenceFiles, humanAcceptance: false }));
}
