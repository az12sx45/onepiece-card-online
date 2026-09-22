'use strict';

// Uses disposable Git fixtures and tiny dirty-media sentinels. Does not read
// 1.3 GB of package media, run gameplay/performance tests, or publish anything.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const builder = require('./build_board_hotkeys_fx_release');
const { canonicalJson, sha256Bytes, comparePaths } = require('./desktop_program_package_common');
const ROOT = path.resolve(__dirname, '..');
const parent = process.env.BOARD_HOTKEYS_RELEASE_QA_ROOT || os.tmpdir();
assert.ok(path.isAbsolute(parent), 'QA parent must be absolute.');
fs.mkdirSync(parent, { recursive: true });
const runRoot = fs.mkdtempSync(path.join(parent, 'hotkeys-release-qa-'));
const fixture = path.join(runRoot, 'source');
fs.mkdirSync(fixture);
const git = (root, args) => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const readBaseline = relative => git(ROOT, ['cat-file', 'blob', `${builder.BASELINE}:${relative}`]);
const write = (relative, bytes) => { const filename = path.join(fixture, relative); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes); };
const commit = message => { git(fixture, ['add', '-A']); git(fixture, ['commit', '--quiet', '-m', message]); return git(fixture, ['rev-parse', 'HEAD']).toString('utf8').trim(); };
const results = [];
const check = (name, action) => { action(); results.push({ name, pass: true }); };
const formalProtected = ['public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json', 'public/images/ranks/r5.PNG', 'public/images/ranks/r6.PNG'];
const beforeFormal = formalProtected.map(relative => ({ relative, sha256: sha256Bytes(fs.readFileSync(path.join(ROOT, relative))) }));
function temporaryFile(relative, bytes, action, committed = false) {
  const filename = path.join(fixture, relative);
  const previous = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
  try {
    if (bytes === null) fs.unlinkSync(filename); else write(relative, bytes);
    if (committed) commit('QA rejection input');
    action();
  } finally {
    if (previous) write(relative, previous); else if (fs.existsSync(filename)) fs.unlinkSync(filename);
    if (committed) commit('Restore QA source input');
  }
}
function main() {
  git(fixture, ['init', '--quiet']);
  git(fixture, ['config', 'user.name', 'Hotkeys Release Fixture QA']);
  git(fixture, ['config', 'user.email', 'hotkeys-release-fixture@example.invalid']);
  git(fixture, ['config', 'core.autocrlf', 'false']);
  const config = JSON.parse(readBaseline('config/desktop-program-packages-v1.json'));
  const catalog = JSON.parse(readBaseline('public/desktop/catalog-v3.json'));
  const legacy = JSON.parse(readBaseline('public/desktop/catalog-v2.json'));
  const metadataPaths = [...new Set(['config/desktop-program-packages-v1.json', 'public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json',
    ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`), ...Object.values(legacy.games).map(game => `public/${game.manifestPath}`)])];
  for (const relative of metadataPaths) write(relative, readBaseline(relative));
  for (const relative of config.games.board.programFiles) write(`public/${relative}`, readBaseline(`public/${relative}`));
  // Only these two real media paths need fixture blobs for preservation tests.
  for (const rank of ['r5', 'r6']) write(`public/images/ranks/${rank}.PNG`, `baseline rank sentinel ${rank}\n`);
  const baseline = commit('Isolated release baseline');
  config.games.board.programFiles.push(...builder.NEW_PROGRAMS);
  config.games.board.programFiles.sort(comparePaths);
  write('config/desktop-program-packages-v1.json', canonicalJson(config));
  for (const relative of builder.NEW_PROGRAMS) write(`public/${relative}`, '/* isolated hotkey program */\n');
  for (const relative of builder.REQUIRED_PROGRAMS) write(`public/${relative}`, Buffer.concat([readBaseline(`public/${relative}`), Buffer.from('\n/* isolated presentation change */\n')]));
  commit('Isolated hotkey and battle source');
  const api = builder.createBuilder(fixture, baseline);
  const collect = () => api.collect('2026-09-22T00:00:00.000Z');
  const previous = JSON.parse(readBaseline(`public/${catalog.games.board.manifestPath}`));
  const oldMedia = previous.assets.filter(asset => ['image', 'audio', 'video', 'font'].includes(asset.kind));
  const good = collect();
  check('exact-inventory-48-programs-4214-assets', () => { assert.equal(good.inputs.programs.length, 48); assert.equal(good.manifest.totalFiles, 4214); assert.equal(good.inputs.changedAssets.length, 7); assert.deepEqual(good.inputs.addedPaths, builder.NEW_PROGRAMS); });
  check('all-4212-old-paths-retained', () => { const next = new Set(good.manifest.assets.map(a => a.path)); for (const old of previous.assets) assert.ok(next.has(old.path), old.path); });
  check('all-4166-media-records-byte-identical', () => { assert.equal(oldMedia.length, 4166); assert.deepEqual(good.manifest.assets.filter(a => ['image', 'audio', 'video', 'font'].includes(a.kind)), oldMedia); assert.equal(good.inputs.retainedMediaSha256, sha256Bytes(JSON.stringify(oldMedia))); });
  check('existing-unreviewed-programs-identical', () => { const next = new Map(good.manifest.assets.map(a => [a.path, a])); for (const old of previous.assets) if (!builder.REQUIRED_PROGRAMS.includes(old.path)) assert.deepEqual(next.get(old.path), old); });
  check('exactly-five-reviewed-programs-changed', () => assert.deepEqual(good.inputs.changedPrograms.map(a => a.path), builder.REQUIRED_PROGRAMS));
  check('program-payload-is-committed-head-bytes', () => { for (const a of good.inputs.programs) { const bytes = git(fixture, ['cat-file', 'blob', `HEAD:public/${a.path}`]); assert.ok(good.files.get(`program-bytes/${a.path}`).equals(bytes)); assert.equal(a.sha256, sha256Bytes(bytes)); } });
  check('candidate-has-no-media-payload', () => { assert.equal(good.files.size, 51); assert.ok([...good.files.keys()].every(name => !name.startsWith('media-bytes/'))); });
  check('card-chess-source-trees-origin-preserved', () => { for (const game of ['card', 'chess']) assert.deepEqual(good.catalog.games[game], catalog.games[game]); assert.deepEqual(good.catalog.sourceTrees, catalog.sourceTrees); assert.equal(good.catalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl); });
  check('invalid-time-rejected', () => assert.throws(() => api.collect('not-a-time'), /Invalid candidate time/));
  check('dirty-program-rejected', () => temporaryFile('public/js/board_hotkeys.js', 'dirty\n', () => assert.throws(collect)));
  check('missing-program-rejected', () => temporaryFile('public/js/board_hotkeys.js', null, () => assert.throws(collect)));
  check('dirty-config-rejected', () => temporaryFile('config/desktop-program-packages-v1.json', '{}\n', () => assert.throws(collect, /Uncommitted metadata differs/)));
  check('dirty-catalog-rejected', () => temporaryFile('public/desktop/catalog-v3.json', '{}\n', () => assert.throws(collect, /Uncommitted metadata differs/)));
  check('unexpected-config-program-rejected', () => { const invalid = JSON.parse(JSON.stringify(config)); invalid.games.board.programFiles.push('zz-extra.js'); temporaryFile('config/desktop-program-packages-v1.json', canonicalJson(invalid), () => assert.throws(collect, /only add the two/), true); });
  check('missing-required-fx-change-rejected', () => temporaryFile('public/js/board_move_fx.js', readBaseline('public/js/board_move_fx.js'), () => assert.throws(collect, /Exactly the five/), true));
  check('unexpected-existing-program-change-rejected', () => temporaryFile('public/js/board_cards.js', 'unexpected\n', () => assert.throws(collect, /Unreviewed public change/), true));
  check('unexpected-new-public-file-rejected', () => temporaryFile('public/js/unreviewed.js', 'unexpected\n', () => assert.throws(collect, /Unreviewed public change/), true));
  check('old-board-media-committed-change-rejected', () => temporaryFile(`public/${oldMedia[0].path}`, 'unexpected old media\n', () => assert.throws(collect, /Protected existing asset changed/), true));
  check('rank-committed-change-rejected', () => temporaryFile('public/images/ranks/r5.PNG', 'unexpected rank\n', () => assert.throws(collect, /Protected existing asset changed|Unreviewed public change/), true));
  check('legacy-catalog-committed-change-rejected', () => temporaryFile('public/desktop/catalog-v2.json', '{}\n', () => assert.throws(collect, /Protected metadata changed/), true));
  check('legacy-manifest-committed-change-rejected', () => temporaryFile(`public/${legacy.games.board.manifestPath}`, '{}\n', () => assert.throws(collect, /Protected metadata changed/), true));
  check('current-manifest-dirty-change-rejected', () => temporaryFile(`public/${catalog.games.board.manifestPath}`, '{}\n', () => assert.throws(collect, /Uncommitted metadata differs/)));
  check('repository-output-rejected', () => assert.throws(() => api.outputDirectory(path.join(fixture, 'candidate')), /outside the repository/));
  check('repository-parent-output-rejected', () => assert.throws(() => api.outputDirectory(runRoot), /outside the repository/));
  check('relative-output-rejected', () => assert.throws(() => api.outputDirectory('candidate'), /absolute/));
  const otherRepo = path.join(runRoot, 'other-repo'); fs.mkdirSync(otherRepo); git(otherRepo, ['init', '--quiet']);
  check('other-git-worktree-output-rejected', () => assert.throws(() => api.outputDirectory(path.join(otherRepo, 'candidate')), /outside every Git worktree/));
  check('promote-needs-previously-reviewed-candidate', () => assert.throws(() => builder.parseArguments(['--output', path.join(runRoot, 'candidate'), '--promote']), /previously reviewed/));
  check('baseline-cli-override-rejected', () => assert.throws(() => builder.parseArguments(['--output', path.join(runRoot, 'candidate'), '--baseline', baseline]), /Unknown argument/));
  check('duplicate-argument-rejected', () => assert.throws(() => builder.parseArguments(['--candidate', 'a', '--candidate', 'b']), /Duplicate/));
  check('ambiguous-output-candidate-rejected', () => assert.throws(() => builder.parseArguments(['--candidate', 'a', '--output', 'b']), /OR/));
  const link = path.join(runRoot, 'junction-candidate');
  fs.symlinkSync(otherRepo, link, process.platform === 'win32' ? 'junction' : 'dir');
  check('junction-output-rejected', () => assert.throws(() => api.outputDirectory(path.join(link, 'candidate')), /Links\/junctions/));
  // Preserve these exact uncommitted bytes through collect, inspect and promote.
  const sentinels = new Map([
    ['public/images/ranks/r5.PNG', Buffer.from('preserve dirty rank five\n')],
    ['public/images/ranks/r6.PNG', Buffer.from('preserve dirty rank six\n')],
    ['public/images/board/sea_event_reveal/v1/untracked.webp', Buffer.from('preserve untracked old sea artwork\n')]
  ]);
  for (const [relative, bytes] of sentinels) write(relative, bytes);
  const sentinelStatus = git(fixture, ['status', '--porcelain', '--', ...sentinels.keys()]);
  const assertSentinels = () => { for (const [relative, bytes] of sentinels) assert.ok(fs.readFileSync(path.join(fixture, relative)).equals(bytes), relative); assert.ok(git(fixture, ['status', '--porcelain', '--', ...sentinels.keys()]).equals(sentinelStatus)); };
  check('dirty-ranks-and-untracked-art-ignored-and-preserved', () => { const result = collect(); assert.deepEqual(result.manifest.assets.filter(a => ['image', 'audio', 'video', 'font'].includes(a.kind)), oldMedia); assertSentinels(); });
  const directory = path.join(runRoot, 'candidate');
  const candidate = api.main(['--output', directory]);
  check('fresh-candidate-reconstructs-from-head', () => assert.equal(api.verifyCandidate(directory).inputs.sourceHead, candidate.inputs.sourceHead));
  check('candidate-directory-cannot-be-reused', () => assert.throws(() => api.main(['--output', directory]), /fresh empty/));
  const payload = path.join(directory, 'program-bytes/js/board_hotkeys.js');
  const payloadBytes = fs.readFileSync(payload);
  try { fs.writeFileSync(payload, 'tampered'); check('tampered-program-candidate-rejected', () => assert.throws(() => api.verifyCandidate(directory), /differs from committed source/)); }
  finally { fs.writeFileSync(payload, payloadBytes); }
  const extra = path.join(directory, 'extra.json');
  try { fs.writeFileSync(extra, '{}'); check('unexpected-candidate-file-rejected', () => assert.throws(() => api.verifyCandidate(directory), /missing or unexpected files/)); }
  finally { fs.unlinkSync(extra); }
  const oldCatalog = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json'));
  check('inspect-does-not-promote', () => { api.main(['--candidate', directory]); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalog)); assertSentinels(); });
  const immutable = path.join(fixture, 'public', candidate.manifestPath);
  fs.writeFileSync(immutable, 'preexisting different immutable\n');
  try { check('immutable-collision-does-not-touch-catalog', () => { assert.throws(() => api.main(['--candidate', directory, '--promote']), /Refusing to overwrite/); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalog)); assertSentinels(); }); }
  finally { fs.unlinkSync(immutable); }
  check('explicit-promote-writes-only-reviewed-metadata', () => { api.main(['--candidate', directory, '--promote']); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(candidate.files.get('desktop/catalog-v3.json'))); assert.ok(fs.readFileSync(immutable).equals(candidate.files.get(candidate.manifestPath))); for (const [relative, bytes] of candidate.protectedFiles) if (relative !== 'public/desktop/catalog-v3.json') assert.ok(fs.readFileSync(path.join(fixture, relative)).equals(bytes)); assertSentinels(); });
  // Restore only the disposable fixture metadata, then advance HEAD without
  // adding dirty sentinels, proving stale candidates cannot be promoted.
  write('public/desktop/catalog-v3.json', oldCatalog);
  fs.unlinkSync(immutable);
  write('qa-head-change.txt', 'advance fixture HEAD\n');
  git(fixture, ['add', '--', 'qa-head-change.txt']); git(fixture, ['commit', '--quiet', '-m', 'Advance fixture HEAD']);
  check('head-change-rejects-old-candidate-before-promotion', () => { assert.throws(() => api.main(['--candidate', directory, '--promote']), /Git HEAD changed after/); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalog)); assert.equal(fs.existsSync(immutable), false); assertSentinels(); });
  check('formal-metadata-and-dirty-ranks-unchanged', () => { for (const item of beforeFormal) assert.equal(sha256Bytes(fs.readFileSync(path.join(ROOT, item.relative))), item.sha256); });
  const report = { ok: true, runRoot, checks: results.length, results, fixtureOnly: true, mediaPayloadNeverRead: true, noNetwork: true, formalMetadataUnchanged: true };
  const reportPath = path.join(runRoot, 'report.json');
  fs.writeFileSync(reportPath, canonicalJson(report), { flag: 'wx' });
  console.log(JSON.stringify({ ok: true, checks: results.length, report: reportPath }));
}
try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
