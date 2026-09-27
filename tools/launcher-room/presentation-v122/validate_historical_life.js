'use strict';
// Re-run the immutable 1.2.1 gate against its exact Git runtime, while every
// asset, source image, prompt, receipt and old review is read from THIS tree.
// This is an explicit historical view, never a waiver of runtime validation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const cp = require('node:child_process');
const vm = require('node:vm');
const BASELINE = 'b9210988b1b6fd6054ce8dfe65b6ddbd9b0f75ea';
const NORMALIZATION = 'CRLF to LF only; all other bytes remain significant';
const MANIFEST = 'docs/LAUNCHER_LIFE_ART_20260927.json';
const REVIEW = 'tools/launcher-room/life-v1/final-visual-review.json';
const VALIDATOR = 'tools/launcher-room/life-v1/validate_release.js';
const HELPER = 'tools/launcher-room/validate-fullbody-manifest.js';
const ACTIONS = 'desktop/launcher-life-actions.js';
const PINNED = Object.freeze({
  [MANIFEST]: 'bae909a7a7ff54fb1bcaaa4e565bc599195d49a1a5f4d362ea9413e36e1affff',
  [REVIEW]: '6723157c4482874c89b1409023cbd976aff970b4b57b32686a7b4a4fca83cd9c',
  [VALIDATOR]: 'c4fbadb447b1a14bf5c8d788d1889d8c47ecf4a2ec41f3f9bc003ef16e1351ce',
  [HELPER]: 'd69f1677617dd8a13ecf6ac4b98c2c192d80384cce15121bbb29438f8da9bb0e'
});
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const normalizedSha256 = bytes => sha256(bytes.toString('utf8').replace(/\r\n/g, '\n'));
function safePath(root, relative) {
  assert(typeof relative === 'string' && relative && !path.isAbsolute(relative) && !relative.includes('\\'), 'Expected portable relative path');
  const full = path.resolve(root, relative);
  assert(full.startsWith(path.resolve(root) + path.sep), 'Path escapes release root');
  return full;
}
function validateHistorical(root) {
  root = path.resolve(root);
  const git = args => cp.execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 64 * 1024 * 1024, timeout: 30000 });
  assert.equal(git(['rev-parse', '--verify', BASELINE + '^{commit}']).toString().trim(), BASELINE, 'The exact reviewed Git baseline is required');
  const blobs = new Map();
  const historical = relative => {
    safePath(root, relative);
    if (!blobs.has(relative)) blobs.set(relative, git(['cat-file', 'blob', BASELINE + ':' + relative]));
    return blobs.get(relative);
  };
  for (const [file, digest] of Object.entries(PINNED)) {
    assert.equal(sha256(historical(file)), digest, 'Unexpected historical gate bytes: ' + file);
    const current = fs.readFileSync(safePath(root, file));
    // The helper is a normal text checkout. Immutable life-v1 files use raw SHA.
    assert.equal(file === HELPER ? normalizedSha256(current) : sha256(current), digest, 'Historical gate or manifest was rewritten: ' + file);
  }
  const oldReview = JSON.parse(historical(REVIEW));
  const runtimePaths = new Set(Object.keys(oldReview.runtime));
  const runtimeProof = [];
  for (const file of runtimePaths) {
    const bytes = historical(file);
    assert.equal(normalizedSha256(bytes), oldReview.runtime[file], 'Git baseline does not match the original review: ' + file);
    runtimeProof.push({ path: file, gitBlob: git(['rev-parse', BASELINE + ':' + file]).toString().trim(), rawSha256: sha256(bytes), normalizedSha256: normalizedSha256(bytes) });
  }
  let historicalRuntime = true;
  const readFileSync = (file, options) => {
    const relative = path.relative(root, path.resolve(file)).split(path.sep).join('/');
    if (!historicalRuntime || !runtimePaths.has(relative)) return fs.readFileSync(file, options);
    const bytes = historical(relative);
    const encoding = typeof options === 'string' ? options : options && options.encoding;
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  };
  // A private CommonJS realm prevents global require/fs hooks and keeps every
  // original assertion intact. Only three explicitly named historical modules
  // are executable; only the 17 reviewed runtime reads use Git blobs.
  const context = vm.createContext({ Buffer, console });
  const loaded = new Map();
  const permitted = new Set([VALIDATOR, HELPER, ACTIONS]);
  const load = relative => {
    assert(permitted.has(relative), 'Unexpected historical module: ' + relative);
    if (loaded.has(relative)) return loaded.get(relative).exports;
    const module = { exports: {} };
    loaded.set(relative, module);
    const localRequire = name => {
      if (name === 'node:fs') return Object.freeze({ readFileSync, statSync: fs.statSync.bind(fs) });
      if (['node:path', 'node:crypto', 'node:assert/strict'].includes(name)) return require(name);
      const absolute = path.isAbsolute(name) ? name : path.resolve(root, path.dirname(relative), name);
      return load(path.relative(root, absolute + (path.extname(absolute) ? '' : '.js')).split(path.sep).join('/'));
    };
    const filename = safePath(root, relative);
    const wrapper = new vm.Script('(function(module,exports,require,__filename,__dirname){\n' + historical(relative).toString('utf8') + '\n})', { filename: BASELINE + ':' + relative }).runInContext(context);
    wrapper(module, module.exports, localRequire, filename, path.dirname(filename));
    return module.exports;
  };
  const original = load(VALIDATOR);
  const life = original.validate(root);
  historicalRuntime = false;
  return {
    life,
    baseline: BASELINE,
    runtimeProof,
    // The SAME untouched validator enforces current runtime hashes and the one
    // pre-existing, exact formal Board variant against its pinned evidence.
    validateCurrentRuntime: review => original.validateReviewedRuntime(root, review)
  };
}
module.exports = { validateHistorical, BASELINE, NORMALIZATION, MANIFEST, REVIEW, PINNED, sha256, normalizedSha256, safePath };
if (require.main === module) {
  const result = validateHistorical(path.resolve(__dirname, '../../..'));
  console.log(JSON.stringify({ complete: result.life.complete, baseline: result.baseline, historicalRuntimeFiles: result.runtimeProof.length, currentAssets: result.life.assets, currentAtlases: result.life.atlases, currentFrames: result.life.frames, humanAcceptance: false }));
}
