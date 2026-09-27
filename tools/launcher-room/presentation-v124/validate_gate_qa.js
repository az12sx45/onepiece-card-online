'use strict';
// Exercise refusal paths against the real completed review. No source, asset,
// screenshot or review is changed; all mutations are isolated JSON copies.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const preservation = require('./validate_historical_radial');
const release = require('./validate_release');
const historical = require('../presentation-v122/validate_historical_life');
const hd = require('./validate_hd');
function run(root) {
  const legacy = preservation.validateHistorical(root);
  const review = JSON.parse(fs.readFileSync(historical.safePath(root, release.REVIEW_PATH), 'utf8'));
  const result = release.validateReview(root, review, legacy);
  assert.equal(result.complete, true);
  const checks = [{ name: 'actual frozen interaction review passes all checks', status: 'PASS' }];
  const rejectAction = (name, action, expected) => {
    let observed;
    try { action(); } catch (error) { observed = error.message; }
    assert(observed && expected.test(observed), 'Gate did not reject expected mutation: ' + name + ' / ' + observed);
    checks.push({ name, status: 'PASS', expectedRefusal: observed });
  };
  const reject = (name, mutate, expected) => {
    const copy = structuredClone(review); mutate(copy);
    rejectAction(name, () => release.validateReview(root, copy, legacy), expected);
  };
  const css = fs.readFileSync(historical.safePath(root, 'desktop/launcher-room.css'), 'utf8');
  const firstIcon = /#roomCompanionTalk\s*\{[^}]*--room-action-icon[^}]*\}/;
  reject('draft cannot release', r => { r.status = 'DRAFT'; }, /visual review is incomplete/);
  reject('older release cannot satisfy current gate', r => { r.releaseVersion = '1.2.3'; }, /1\.2\.4/);
  reject('blocking issues cannot release', r => { r.blockingIssues = ['Unreadable icon']; }, /deep-equal/);
  reject('automated evidence cannot claim human acceptance', r => { r.humanAcceptance = true; }, /not human acceptance/);
  reject('runtime coverage cannot omit CSS', r => { delete r.runtime['desktop/launcher-room.css']; }, /runtime coverage/);
  reject('changed runtime cannot reuse visual approval', r => { r.runtime['desktop/launcher-room.js'] = '0'.repeat(64); }, /Changed reviewed life runtime/);
  reject('new runtime variant cannot bypass source checks', r => { r.approvedRuntimeVariants['desktop/launcher-room.js'] = []; }, /immutable formal Board variant/);
  reject('rejected generated icon mode cannot release', r => { r.iconMode = 'generated-png'; }, /user-restored inline icons/);
  rejectAction('missing SVG action cannot satisfy original icon coverage', () => release.validateInlineIcons(css.replace(firstIcon, '')), /Exactly six original inline icon definitions/);
  rejectAction('duplicate SVG declaration cannot override reviewed icon', () => release.validateInlineIcons(css + '\n' + css.match(firstIcon)[0]), /Exactly six original inline icon definitions/);
  rejectAction('external PNG cannot replace inline SVG', () => release.validateInlineIcons(css.replace(/data:image\/svg\+xml,[^"]+/, 'opui://launcher/rejected.png')), /Icon must be an inline SVG mask/);
  rejectAction('changed original SVG cannot reuse icon approval', () => release.validateInlineIcons(css.replace('%3Csvg', '%3CSVG')), /Original inline glyph changed/);
  rejectAction('missing CSS mask pipeline cannot pass glyph validation', () => release.validateInlineIcons(css.replace(/((?:-webkit-)?mask(?:-image)?)(\s*:\s*var\(--room-action-icon\))/g, 'discarded-$1$2')), /mask rendering pipeline is missing/);
  reject('older screenshot directory cannot satisfy new review', r => { r.evidence[0].path = 'tools/launcher-room/presentation-v122/review-evidence/old.png'; }, /presentation-v124/);
  reject('changed screenshot cannot reuse visual approval', r => { r.evidence.find(item => item.kind === 'screenshot').sha256 = '0'.repeat(64); }, /Hash-bound file changed/);
  reject('missing mobile review cannot release', r => { r.checks = r.checks.filter(item => item.id !== 'mobile-owner-radial'); }, /visual coverage/);
  reject('pending icon inspection cannot release', r => { r.checks.find(item => item.id === 'inline-icons-contact-sheet').status = 'PENDING'; }, /Unreviewed visual scenario/);
  reject('unbound functional QA cannot release', r => { r.qaReport = 'missing.json'; }, /Bind the final automated radial QA/);
  reject('changed HD export manifest cannot reuse approval', r => { r.hdArt.sha256 = '0'.repeat(64); }, /Hash-bound file changed/);
  reject('changed HD quality report cannot reuse approval', r => { r.hdQuality.sha256 = '0'.repeat(64); }, /Hash-bound file changed/);
  reject('unbound interaction regression report cannot release', r => { r.interactionReport = 'missing.json'; }, /Bind the final interaction regression report/);
  const quality = JSON.parse(fs.readFileSync(historical.safePath(root, hd.QUALITY_REPORT), 'utf8'));
  rejectAction('HD QA cannot omit a direction or DPR', () => {
    const copy = structuredClone(quality); copy.results.pop(); hd.validateQuality(root, copy);
  }, /all 160/);
  rejectAction('HD QA cannot reuse approval after renderer changes', () => {
    const copy = structuredClone(quality); copy.renderer.normalizedSha256 = '0'.repeat(64); hd.validateQuality(root, copy);
  }, /different renderer content/);
  return { status: 'PASS', kind: 'real-review-gate-negative-tests', recordedAt: new Date().toISOString(),
    productionDeployed: false, checks, limitations: ['Validator tamper checks are not visual acceptance or public deployment proof.'] };
}
module.exports = { run };
if (require.main === module) {
  const root = path.resolve(__dirname, '../../..'), result = run(root);
  const output = process.argv[2];
  if (output) fs.writeFileSync(path.resolve(output), JSON.stringify(result, null, 2) + '\n');
  console.log(JSON.stringify({ status: result.status, checks: result.checks.length, productionDeployed: false }));
}
