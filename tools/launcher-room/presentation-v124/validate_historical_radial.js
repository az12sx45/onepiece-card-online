'use strict';
// Validate the immutable 1.2.3 review using its exact committed runtime.
// All old screenshots, reports and artwork still come from the current tree.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const historical = require('../presentation-v122/validate_historical_life');
const previousHistory = require('../presentation-v123/validate_historical_presentation');
const BASELINE = '45167a912b0763b134972bade17e99919cba6c6c';
const REVIEW = 'docs/LAUNCHER_ROOM_RADIAL_20260927.json';
const VALIDATOR = 'tools/launcher-room/presentation-v123/validate_release.js';
const PINNED = Object.freeze({
  [REVIEW]: '8299c1364855af986ae263ca297f4cac484a687b70cb785db9fb10792dbec949',
  [VALIDATOR]: '33f89d740491c0124e9e6a1fd2aaefed42cefbce729ce8ec241c9b73177b96c3',
  'tools/launcher-room/presentation-v123/validate_historical_presentation.js': '90e3a1c592788eb2f70e4dc12f7abf470ffec42584fb3596571597d9933478b6'
});
function validateHistorical(root) {
  root = path.resolve(root);
  const legacy = previousHistory.validateHistorical(root);
  const git = args => cp.execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
  assert.equal(git(['rev-parse', '--verify', BASELINE + '^{commit}']).toString().trim(), BASELINE);
  const blobs = new Map();
  const committed = relative => {
    historical.safePath(root, relative);
    if (!blobs.has(relative)) blobs.set(relative, git(['cat-file', 'blob', BASELINE + ':' + relative]));
    return blobs.get(relative);
  };
  for (const [file, digest] of Object.entries(PINNED)) {
    assert.equal(historical.normalizedSha256(committed(file)), digest, 'Unexpected historical radial gate bytes: ' + file);
    assert.equal(historical.normalizedSha256(fs.readFileSync(historical.safePath(root, file))), digest,
      'Immutable radial review or validator changed: ' + file);
  }
  const review = JSON.parse(committed(REVIEW));
  const runtimePaths = new Set(Object.keys(review.runtime));
  const runtimeProof = [];
  for (const file of runtimePaths) {
    const bytes = committed(file);
    assert.equal(historical.normalizedSha256(bytes), review.runtime[file], 'Historical radial runtime mismatch: ' + file);
    runtimeProof.push({ path: file, rawSha256: historical.sha256(bytes), normalizedSha256: review.runtime[file] });
  }
  const readFileSync = (file, options) => {
    const relative = path.relative(root, path.resolve(file)).split(path.sep).join('/');
    if (!runtimePaths.has(relative)) return fs.readFileSync(file, options);
    const bytes = committed(relative), encoding = typeof options === 'string' ? options : options && options.encoding;
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  };
  const historicalContext = { ...legacy, validateCurrentRuntime: checked => {
    for (const [file, digest] of Object.entries(checked.runtime)) {
      assert(runtimePaths.has(file), 'Unexpected historical runtime path');
      assert.equal(historical.normalizedSha256(committed(file)), digest, 'Reviewed radial runtime differs from exact Git baseline: ' + file);
    }
  } };
  const module = { exports: {} };
  const localRequire = name => {
    if (name === 'node:fs') return Object.freeze({ readFileSync });
    if (['node:path', 'node:assert/strict'].includes(name)) return require(name);
    if (name === '../presentation-v122/validate_historical_life') return historical;
    if (name === './validate_historical_presentation') return previousHistory;
    throw new Error('Unexpected historical radial module: ' + name);
  };
  const filename = historical.safePath(root, VALIDATOR);
  const context = vm.createContext({ Buffer, console });
  const wrapper = new vm.Script('(function(module,exports,require,__filename,__dirname){\n' + committed(VALIDATOR).toString('utf8') + '\n})',
    { filename: BASELINE + ':' + VALIDATOR }).runInContext(context);
  wrapper(module, module.exports, localRequire, filename, path.dirname(filename));
  const realmReview = new vm.Script('JSON.parse(' + JSON.stringify(committed(REVIEW).toString('utf8')) + ')').runInContext(context);
  const result = module.exports.validateReview(root, realmReview, historicalContext);
  return { ...legacy, radial: result, radialBaseline: BASELINE, radialRuntimeProof: runtimeProof };
}
module.exports = { validateHistorical, BASELINE, PINNED, REVIEW, VALIDATOR };
if (require.main === module) {
  const result = validateHistorical(path.resolve(__dirname, '../../..'));
  console.log(JSON.stringify({ complete: result.radial.complete, radialBaseline: BASELINE,
    historicalRadialRuntimeFiles: result.radialRuntimeProof.length,
    historicalPresentationRuntimeFiles: result.presentationRuntimeProof.length,
    historicalLifeRuntimeFiles: result.runtimeProof.length, currentLifeAssets: result.life.assets }));
}
