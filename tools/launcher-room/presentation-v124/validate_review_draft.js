'use strict';
// Capture provenance or create a DRAFT only. Approval needs actual inspection.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const historical = require('../presentation-v122/validate_historical_life');
const preservation = require('./validate_historical_radial');
const release = require('./validate_release');
function captureRuntime(root) {
  const legacy = preservation.validateHistorical(root);
  const runtime = {};
  for (const file of Object.keys(legacy.radial.review.runtime)) {
    runtime[file] = historical.normalizedSha256(fs.readFileSync(historical.safePath(root, file)));
  }
  for (const [file, variants] of Object.entries(legacy.life.review.approvedRuntimeVariants)) {
    assert([legacy.life.review.runtime[file], ...variants.map(item => item.normalizedSha256)].includes(runtime[file]), 'Unapproved formal Board runtime');
    runtime[file] = legacy.life.review.runtime[file];
  }
  const result = { runtimeHashNormalization: historical.NORMALIZATION, runtime,
    approvedRuntimeVariants: JSON.parse(JSON.stringify(legacy.life.review.approvedRuntimeVariants)) };
  legacy.validateCurrentRuntime(result);
  return result;
}
function captureEvidence(root, paths) {
  return paths.map(file => {
    assert(file.startsWith(release.EVIDENCE_PREFIX), 'Evidence must reside in the new release directory');
    const bytes = fs.readFileSync(historical.safePath(root, file));
    const screenshot = file.endsWith('.png');
    return { path: file, kind: screenshot ? 'screenshot' : 'report', sha256: historical.sha256(bytes),
      ...(screenshot ? { pixels: release.pngSize(bytes) } : {}) };
  });
}
function createDraft(root) {
  return {
    schema: 'launcher-room-interaction/1', releaseVersion: '1.2.4', artGeneration: '1.2.0',
    historicalBaseline: historical.BASELINE, presentationBaseline: 'caf02b4f2e768ebc4c0eefb9f393fff1b08ee8c9', radialBaseline: preservation.BASELINE,
    status: 'DRAFT', blockingIssues: ['Interaction fixes and HD walking await frozen QA and explicit visual inspection.'],
    method: '', humanAcceptance: false,
    limitations: ['Automated Chromium and model inspection do not establish physical-device or human fan/playtest acceptance.'],
    ...captureRuntime(root),
    iconMode: release.ICON_MODE,
    hdArt: { path: 'tools/launcher-room/hd-v4/manifest.json', sha256: '' },
    hdQuality: { path: 'tools/launcher-room/hd-v4/review-evidence/QUALITY_QA.json', sha256: '' },
    evidence: [], qaReport: '', interactionReport: '',
    checks: release.CASES.map(item => ({ id: item.id, status: 'PENDING', notes: '', evidence: [] }))
  };
}
module.exports = { createDraft, captureRuntime, captureEvidence };
if (require.main === module) {
  const root = path.resolve(__dirname, '../../..'), mode = process.argv[2];
  assert(['--write-draft', '--capture-runtime'].includes(mode), 'Use --write-draft or --capture-runtime');
  if (mode === '--capture-runtime') console.log(JSON.stringify(captureRuntime(root), null, 2));
  else {
    const destination = historical.safePath(root, release.REVIEW_PATH);
    assert(!fs.existsSync(destination), 'Existing review is never overwritten');
    fs.writeFileSync(destination, JSON.stringify(createDraft(root), null, 2) + '\n', { flag: 'wx' });
    console.log('DRAFT created; interaction release gate remains closed.');
  }
}
