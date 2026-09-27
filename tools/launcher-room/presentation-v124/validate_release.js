'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const historical = require('../presentation-v122/validate_historical_life');
const preservation = require('./validate_historical_radial');
const hdArt = require('./validate_hd');
const REVIEW_PATH = 'docs/LAUNCHER_ROOM_INTERACTION_20260927.json';
const EVIDENCE_PREFIX = 'tools/launcher-room/presentation-v124/review-evidence/';
const ICON_MODE = 'inline-svg-restored-user-request';
// Original six glyphs from the immutable 1.2.2 source. User requested these
// exact line icons restored; final theme colors are bound by the CSS hash.
const INLINE_ICONS = Object.freeze({
  roomCompanionTalk: '36fc17105ba8e47dfc125e3b272958c104337fd090fcc0f19350f3117c8691b3',
  roomLifeWork: '48ac1e346f4fd4dba6a096b239598fd7241875674ab3029517340dba8cb3c762',
  roomLifeCall: '1c5713a00b58b6b8e5a4857d7be667b08db57606c387530de2594abf550b8dd1',
  roomLifeGift: 'a234943652d91c7f23834fdd1f4f0d058cab99576f2888eec3d2ae32fe1c9ae8',
  roomLifeTrain: 'fe4aa7640b61431fe15888ac0716870784454055cbc26e841aa7842af5fc05e9',
  roomLifeStatus: '86eed0e0586c5fa7f79349dacd83afae65da8d329287c81bfa95ab3e332e2f7f'
});
const UI_RUNTIME = Object.freeze(['launcher-room.js', 'launcher-room.css', 'launcher-life-room.js', 'launcher.html']);
const INTERACTION_RUNTIME = Object.freeze(['launcher-room.js', 'launcher-room.css', 'launcher-life-room.js',
  'launcher-life.js', 'launcher-room-motion.js', 'main.js', 'launcher.html']);
const INTERACTION_CHECKS = Object.freeze(['wheel-physical-notch-all-actions', 'wheel-rapid-and-pending-resync',
  'selected-character-front-and-still', 'explicit-call-and-work-still-operate', 'menu-close-restores-autonomy']);
const CASES = Object.freeze([
  { id: 'desktop-owner-radial', minWidth: 900, maxWidth: 4000 },
  { id: 'mobile-owner-radial', minWidth: 350, maxWidth: 450 },
  { id: 'narrow-owner-radial', minWidth: 300, maxWidth: 349 },
  { id: 'short-owner-radial', minWidth: 350, maxWidth: 900 },
  { id: 'desktop-friend-readonly-radial', minWidth: 900, maxWidth: 4000 },
  { id: 'desktop-work-sheet', minWidth: 900, maxWidth: 4000 },
  { id: 'desktop-details-sheet', minWidth: 900, maxWidth: 4000 },
  { id: 'inline-icons-contact-sheet', minWidth: 512, maxWidth: 4000 },
  { id: 'desktop-selected-front-facing', minWidth: 900, maxWidth: 4000 },
  { id: 'hd-walk-contact-sheet', minWidth: 512, maxWidth: 4000 }
]);
const REQUIRED_QA = Object.freeze([
  'five separate translucent circles; no rectangular backplate',
  'mouse wheel traverses every action and wraps without page scroll or command',
  'line-mode wheel and keyboard activate details; sheet scroll leaves arc unchanged',
  'direct icon selection opens work choices without assigning work',
  'gift requires two clicks; close resets confirmation; exactly one five-coin charge',
  'drag rotates without accidental action; release outside clears drag',
  'navigation/account/edit mode close wheel and reset state',
  'work button assigns the selected station through the existing command path',
  'friend room exposes details only and no mutating commands',
  'mobile viewport keeps circles and details within screen',
  'narrow viewport keeps circles and details within screen',
  'short viewport keeps circles and details within screen',
  'right-edge character mirrors semicircle and reduced motion switches instantly'
]);
function readBound(root, item) {
  assert(item && typeof item.path === 'string' && path.posix.normalize(item.path) === item.path, 'Expected normalized evidence path');
  assert.match(item.sha256, /^[a-f0-9]{64}$/);
  const bytes = fs.readFileSync(historical.safePath(root, item.path));
  assert.equal(historical.sha256(bytes), item.sha256, 'Hash-bound file changed: ' + item.path);
  return bytes;
}
function pngSize(bytes) {
  assert(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Expected actual PNG data');
  assert.equal(bytes.toString('ascii', 12, 16), 'IHDR');
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
}
function validateInlineIcons(css) {
  assert.equal(typeof css, 'string');
  assert(!/ui_radial_v\d/.test(css), 'Rejected external generated icons remain referenced');
  const definitions = [...css.matchAll(/#(roomCompanionTalk|roomLifeWork|roomLifeCall|roomLifeGift|roomLifeTrain|roomLifeStatus)\s*\{([^}]+)\}/g)]
    .filter(match => /--room-action-icon\s*:/.test(match[2]));
  assert.deepEqual(definitions.map(match => match[1]).sort(), Object.keys(INLINE_ICONS).sort(), 'Exactly six original inline icon definitions are required');
  assert.equal([...css.matchAll(/--room-action-icon\s*:/g)].length, 6, 'Unexpected duplicate or alternate icon declaration');
  for (const [, id, block] of definitions) {
    const match = block.match(/--room-action-icon\s*:\s*url\(\s*["'](data:image\/svg\+xml,[^"']+)["']\s*\)/);
    assert(match, 'Icon must be an inline SVG mask: ' + id);
    const svg = decodeURIComponent(match[1].slice('data:image/svg+xml,'.length));
    assert.equal(historical.sha256(svg), INLINE_ICONS[id], 'Original inline glyph changed: ' + id);
  }
  assert(/(?:^|[;{])\s*(?:-webkit-)?mask(?:-image)?\s*:\s*var\(--room-action-icon\)/m.test(css), 'Inline icon mask rendering pipeline is missing');
  return { mode: ICON_MODE, count: definitions.length, externalAssets: 0 };
}
function validateReview(root, review, legacy) {
  assert.equal(review.schema, 'launcher-room-interaction/1');
  assert.equal(review.releaseVersion, '1.2.4');
  assert.equal(review.artGeneration, '1.2.0');
  assert.equal(review.historicalBaseline, historical.BASELINE);
  assert.equal(review.presentationBaseline, legacy.presentationBaseline);
  assert.equal(review.radialBaseline, preservation.BASELINE);
  assert.equal(review.status, 'PASS_WITH_NOTES', '1.2.4 visual review is incomplete');
  assert.deepEqual(review.blockingIssues, []);
  assert.equal(review.humanAcceptance, false, 'Automated/model review is not human acceptance');
  assert(typeof review.method === 'string' && review.method.length >= 40, 'Record the actual inspection method');
  assert(Array.isArray(review.limitations) && review.limitations.length > 0, 'Record review limitations');
  assert.equal(review.runtimeHashNormalization, historical.NORMALIZATION);
  assert.deepEqual(review.approvedRuntimeVariants, JSON.parse(JSON.stringify(legacy.life.review.approvedRuntimeVariants)), 'Only the immutable formal Board variant may be inherited');
  const requiredRuntime = Object.keys(legacy.radial.review.runtime).sort();
  assert.deepEqual(Object.keys(review.runtime || {}).sort(), requiredRuntime, 'Current runtime coverage must remain exactly 22 files');
  legacy.validateCurrentRuntime(review);
  assert.equal(review.runtime['server/desktop-distribution.js'], legacy.life.review.runtime['server/desktop-distribution.js']);
  assert.equal(review.iconMode, ICON_MODE, 'The review must reflect the user-restored inline icons');
  assert.equal(review.icons, undefined, 'Rejected generated icon manifests must not enter this release review');
  const icons = validateInlineIcons(fs.readFileSync(historical.safePath(root, 'desktop/launcher-room.css'), 'utf8'));
  assert.equal(review.hdArt?.path, hdArt.MANIFEST, 'Bind the exact HD re-export manifest');
  readBound(root, review.hdArt);
  assert.equal(review.hdQuality?.path, hdArt.QUALITY_REPORT, 'Bind the exact HD renderer quality report');
  readBound(root, review.hdQuality);
  const hd = hdArt.validate(root);
  assert(Array.isArray(review.evidence) && review.evidence.length > 0, 'New radial screenshots and QA evidence are required');
  const evidence = new Map();
  for (const item of review.evidence) {
    assert(item.path.startsWith(EVIDENCE_PREFIX), 'Current evidence must reside in presentation-v124');
    assert(!evidence.has(item.path), 'Duplicate radial evidence');
    const bytes = readBound(root, item);
    if (item.kind === 'screenshot') assert.deepEqual(item.pixels, pngSize(bytes), 'Screenshot dimensions differ');
    else assert.equal(item.kind, 'report', 'Unknown evidence kind');
    evidence.set(item.path, item);
  }
  assert.deepEqual((review.checks || []).map(item => item.id).sort(), CASES.map(item => item.id).sort(), 'Radial visual coverage differs');
  for (const required of CASES) {
    const check = review.checks.find(item => item.id === required.id);
    assert.equal(check.status, 'PASS', 'Unreviewed visual scenario: ' + required.id);
    assert(typeof check.notes === 'string' && check.notes.trim().length >= 16, 'Record concrete visual findings: ' + required.id);
    assert(Array.isArray(check.evidence) && check.evidence.length > 0, 'Visual scenario needs a screenshot: ' + required.id);
    for (const file of check.evidence) {
      const entry = evidence.get(file);
      assert(entry && entry.kind === 'screenshot', 'Missing reviewed screenshot: ' + required.id);
      const [width, height] = entry.pixels;
      assert(width >= required.minWidth && width <= required.maxWidth && height >= 300, 'Wrong screenshot dimensions: ' + required.id);
    }
  }
  assert(evidence.get(review.qaReport)?.kind === 'report', 'Bind the final automated radial QA report');
  const qa = JSON.parse(fs.readFileSync(historical.safePath(root, review.qaReport), 'utf8'));
  assert.equal(qa.status, 'PASS');
  assert(Array.isArray(qa.checks) && qa.checks.every(check => check.status === 'PASS'), 'A radial functional check failed');
  for (const name of REQUIRED_QA) assert(qa.checks.some(check => check.name === name), 'Required radial behavior was not checked: ' + name);
  assert.deepEqual(Object.keys(qa.sourceSha256 || {}).sort(), [...UI_RUNTIME].sort(), 'QA must bind all four current UI sources');
  assert.equal(qa.sourceHashNormalization, historical.NORMALIZATION, 'QA normalization must be CRLF to LF only');
  assert.deepEqual(Object.keys(qa.sourceNormalizedSha256 || {}).sort(), [...UI_RUNTIME].sort(), 'QA must bind normalized content of all four UI sources');
  for (const file of UI_RUNTIME) {
    assert.match(qa.sourceSha256[file], /^[a-f0-9]{64}$/, 'Actual tested raw source SHA must remain recorded');
    const current = fs.readFileSync(historical.safePath(root, 'desktop/' + file));
    assert.equal(qa.sourceNormalizedSha256[file], historical.normalizedSha256(current), 'Radial QA was run against different source content: ' + file);
    assert.equal(qa.sourceNormalizedSha256[file], review.runtime['desktop/' + file], 'QA/runtime review binding differs: ' + file);
  }
  assert.equal(qa.iconMode, ICON_MODE, 'Radial QA must identify the restored inline icon mode');
  assert.equal(qa.iconSha256, undefined, 'Rejected external icon QA is not the current UI evidence');
  assert(evidence.get(review.interactionReport)?.kind === 'report', 'Bind the final interaction regression report');
  const interaction = JSON.parse(fs.readFileSync(historical.safePath(root, review.interactionReport), 'utf8'));
  assert.equal(interaction.status, 'PASS');
  assert(Array.isArray(interaction.checks) && interaction.checks.every(check => check.status === 'PASS'), 'An interaction regression check failed');
  for (const name of INTERACTION_CHECKS) assert(interaction.checks.some(check => check.name === name), 'Required interaction behavior was not checked: ' + name);
  assert.equal(interaction.sourceHashNormalization, historical.NORMALIZATION);
  assert.deepEqual(Object.keys(interaction.sourceSha256 || {}).sort(), [...INTERACTION_RUNTIME].sort(), 'Interaction QA must bind all seven runtime sources');
  assert.deepEqual(Object.keys(interaction.sourceNormalizedSha256 || {}).sort(), [...INTERACTION_RUNTIME].sort(), 'Interaction QA must bind all seven normalized sources');
  for (const file of INTERACTION_RUNTIME) {
    assert.match(interaction.sourceSha256[file], /^[a-f0-9]{64}$/);
    assert.equal(interaction.sourceNormalizedSha256[file], review.runtime['desktop/' + file], 'Interaction QA/runtime review binding differs: ' + file);
    assert.equal(interaction.sourceNormalizedSha256[file], historical.normalizedSha256(fs.readFileSync(historical.safePath(root, 'desktop/' + file))),
      'Interaction QA was run against different source content: ' + file);
  }
  assert.equal(interaction.testScriptSha256, historical.sha256(fs.readFileSync(historical.safePath(root, 'scripts/launcher_interaction_qa.js'))),
    'The tested interaction script differs from the preserved script');
  return { complete: true, review, scenarios: CASES.length, functionalChecks: qa.checks.length,
    interactionChecks: interaction.checks.length, currentRuntimeFiles: requiredRuntime.length,
    evidenceFiles: evidence.size, icons, hd, humanAcceptance: false };
}
function validate(root) {
  const legacy = preservation.validateHistorical(root);
  const review = JSON.parse(fs.readFileSync(historical.safePath(root, REVIEW_PATH), 'utf8'));
  return { ...validateReview(root, review, legacy), life: legacy.life, historicalBaseline: legacy.baseline,
    historicalRuntimeProof: legacy.runtimeProof, presentationBaseline: legacy.presentationBaseline,
    historicalPresentationRuntimeProof: legacy.presentationRuntimeProof, radialBaseline: legacy.radialBaseline,
    historicalRadialRuntimeProof: legacy.radialRuntimeProof };
}
module.exports = { validate, validateReview, validateInlineIcons, pngSize, REVIEW_PATH, EVIDENCE_PREFIX,
  ICON_MODE, INLINE_ICONS, UI_RUNTIME, INTERACTION_RUNTIME, INTERACTION_CHECKS, CASES, REQUIRED_QA };
if (require.main === module) {
  const result = validate(path.resolve(__dirname, '../../..'));
  console.log(JSON.stringify({ complete: result.complete, releaseVersion: result.review.releaseVersion,
    historicalBaseline: result.historicalBaseline, presentationBaseline: result.presentationBaseline,
    currentRuntimeFiles: result.currentRuntimeFiles, currentLifeAssets: result.life.assets,
    radialIcons: result.icons.count, iconMode: result.icons.mode, visualScenarios: result.scenarios, functionalChecks: result.functionalChecks,
    interactionChecks: result.interactionChecks, hdAssets: result.hd.assets, hdFrames: result.hd.frames,
    evidenceFiles: result.evidenceFiles, humanAcceptance: false }));
}
