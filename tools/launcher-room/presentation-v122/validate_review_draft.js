'use strict';
// This helper can capture hashes or create a DRAFT. It cannot approve a review,
// fabricate screenshots, or turn pending checks into PASS.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const historical = require('./validate_historical_life');
const release = require('./validate_release');
function captureRuntime(root) {
  const legacy = historical.validateHistorical(root);
  const runtime = {};
  for (const file of [...Object.keys(legacy.life.review.runtime), ...release.ADDITIONAL_RUNTIME]) {
    runtime[file] = historical.normalizedSha256(fs.readFileSync(historical.safePath(root, file)));
  }
  // Preserve the exact reviewed base on formal D; the inherited variant proves
  // the one accepted alternate value. All other files keep actual current SHA.
  const formal = legacy.life.review.approvedRuntimeVariants;
  for (const [file, variants] of Object.entries(formal)) {
    assert([legacy.life.review.runtime[file], ...variants.map(item => item.normalizedSha256)].includes(runtime[file]), 'Unapproved formal Board runtime');
    runtime[file] = legacy.life.review.runtime[file];
  }
  const result = { runtimeHashNormalization: historical.NORMALIZATION, runtime, approvedRuntimeVariants: JSON.parse(JSON.stringify(formal)) };
  legacy.validateCurrentRuntime(result);
  return result;
}
function createDraft(root) {
  const legacy = historical.validateHistorical(root);
  return {
    schema: 'launcher-room-presentation/1',
    releaseVersion: '1.2.2', artGeneration: '1.2.0', historicalBaseline: historical.BASELINE,
    status: 'DRAFT', blockingIssues: ['Current UI and enlarged room geometry await final screenshots and independent inspection.'],
    method: '', humanAcceptance: false,
    limitations: ['Automated Chromium and model visual inspection do not establish physical-device or human fan/playtest acceptance.'],
    runtimeHashNormalization: historical.NORMALIZATION, runtime: {},
    approvedRuntimeVariants: JSON.parse(JSON.stringify(legacy.life.review.approvedRuntimeVariants)),
    evidence: [],
    checks: release.CASES.map(item => ({ id: item.id, status: 'PENDING', notes: '', evidence: [] }))
  };
}
module.exports = { createDraft, captureRuntime };
if (require.main === module) {
  const root = path.resolve(__dirname, '../../..');
  const mode = process.argv[2];
  assert(['--write-draft', '--capture-runtime'].includes(mode), 'Use --write-draft or --capture-runtime');
  if (mode === '--capture-runtime') console.log(JSON.stringify(captureRuntime(root), null, 2));
  else {
    const destination = historical.safePath(root, release.REVIEW_PATH);
    assert(!fs.existsSync(destination), 'Existing review is never overwritten by the draft helper');
    fs.writeFileSync(destination, JSON.stringify(createDraft(root), null, 2) + '\n', { flag: 'wx' });
    console.log('DRAFT created; visual release gate remains closed.');
  }
}
