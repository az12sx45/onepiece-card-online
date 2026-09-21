'use strict';

// Offline, isolated Git fixture only. Formal metadata and player data are read-only.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const builder = require('./build_board_audio_release');
const { canonicalJson, sha256Bytes, comparePaths } = require('./desktop_program_package_common');
const ROOT = path.resolve(__dirname, '..');
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'board-audio-release-qa-'));
const fixture = path.join(runRoot, 'source');
fs.mkdirSync(fixture);
const git = (root, args) => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const readBaseline = relative => git(ROOT, ['cat-file', 'blob', `${builder.BASELINE}:${relative}`]);
const write = (relative, bytes) => { const filename = path.join(fixture, relative); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes); };
const commit = message => { git(fixture, ['add', '-A']); git(fixture, ['commit', '--quiet', '-m', message]); return git(fixture, ['rev-parse', 'HEAD']).toString('utf8').trim(); };
const results = [];
const check = (name, action) => { action(); results.push({ name, pass: true }); };
const formalCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/desktop/catalog-v3.json')));
const formalProtectedPaths = ['public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json', ...Object.values(formalCatalog.games).map(game => `public/${game.manifestPath}`), 'public/images/ranks/r5.PNG', 'public/images/ranks/r6.PNG'];
const beforeMetadata = formalProtectedPaths.map(relative => ({ relative, sha256: sha256Bytes(fs.readFileSync(path.join(ROOT, relative))) }));

function temporaryFile(relative, bytes, action, committed = false) {
  const filename = path.join(fixture, relative);
  const previous = fs.existsSync(filename) ? fs.readFileSync(filename) : null;
  try {
    if (bytes === null) fs.unlinkSync(filename); else write(relative, bytes);
    if (committed) commit('QA rejection input');
    action();
  } finally {
    if (previous !== null) write(relative, previous); else if (fs.existsSync(filename)) fs.unlinkSync(filename);
    if (committed) commit('Restore QA source input');
  }
}

function main() {
  git(fixture, ['init', '--quiet']);
  git(fixture, ['config', 'user.name', 'Audio Release Fixture QA']);
  git(fixture, ['config', 'user.email', 'audio-release-fixture@example.invalid']);
  git(fixture, ['config', 'core.autocrlf', 'false']);
  const config = JSON.parse(readBaseline('config/desktop-program-packages-v1.json'));
  const catalog = JSON.parse(readBaseline('public/desktop/catalog-v3.json'));
  const previous = JSON.parse(readBaseline(`public/${catalog.games.board.manifestPath}`));
  const oldAudio = previous.assets.find(asset => asset.kind === 'audio');
  const oldCard = JSON.parse(readBaseline(`public/${catalog.games.card.manifestPath}`)).assets.find(asset => asset.path.startsWith('images/ranks/'));
  assert.ok(oldAudio && oldCard);
  for (const relative of ['config/desktop-program-packages-v1.json', 'public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json', ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`), `public/${oldAudio.path}`, `public/${oldCard.path}`]) write(relative, readBaseline(relative));
  for (const relative of config.games.board.programFiles) write(`public/${relative}`, readBaseline(`public/${relative}`));
  const baseline = commit('Isolated audio release baseline');
  config.games.board.programFiles.push(...builder.NEW_PROGRAMS);
  config.games.board.programFiles.sort(comparePaths);
  write('config/desktop-program-packages-v1.json', canonicalJson(config));
  for (const relative of builder.NEW_PROGRAMS) write(`public/${relative}`, '/* isolated audio interface fixture */\n');
  for (const relative of builder.WEB_ONLY_PROGRAMS) write(`public/${relative}`, '/* isolated audio review room */\n');
  for (const relative of builder.CHANGED_PROGRAMS) write(`public/${relative}`, Buffer.concat([readBaseline(`public/${relative}`), Buffer.from('\n/* fixture audio integration */\n')]));
  commit('Isolated audio feature source');
  const api = builder.createBuilder(fixture, baseline);
  const collect = () => api.collect('2026-09-21T00:00:00.000Z');
  const good = collect();

  check('exact-43-program-4155-file-inventory', () => {
    assert.equal(good.inputs.programs.length, 43);
    assert.equal(good.inputs.media.length, 0);
    assert.equal(good.inputs.changedPrograms.length, 13);
    assert.equal(good.inputs.changedExistingPrograms.length, 11);
    assert.equal(good.inputs.changedAssets.length, 13);
    assert.deepEqual(good.inputs.changedAssets, good.inputs.changedPrograms);
    assert.deepEqual(good.inputs.addedPaths, builder.NEW_PROGRAMS);
    assert.equal(good.manifest.totalFiles, 4155);
    assert.equal(good.files.size, 48);
  });
  check('all-4112-existing-media-records-preserved', () => {
    const media = previous.assets.filter(asset => ['image', 'audio', 'video', 'font'].includes(asset.kind));
    assert.equal(media.length, 4112);
    assert.deepEqual(good.manifest.assets.filter(asset => ['image', 'audio', 'video', 'font'].includes(asset.kind)), media);
  });
  check('exact-review-room-is-web-only', () => { for (const relative of builder.WEB_ONLY_PROGRAMS) assert.equal(good.manifest.assets.some(asset => asset.path === relative), false); });
  check('dirty-review-room-rejected', () => temporaryFile('public/js/board_audio_preview.js', 'dirty preview', () => assert.throws(collect)));
  check('unrelated-preview-page-rejected', () => temporaryFile('public/board_unapproved_preview.html', 'unrelated preview', () => assert.throws(collect, /Unreviewed public source/), true));
  check('card-chess-source-trees-origin-preserved', () => {
    for (const game of ['card', 'chess']) assert.deepEqual(good.catalog.games[game], catalog.games[game]);
    assert.deepEqual(good.catalog.sourceTrees, catalog.sourceTrees);
    assert.equal(good.catalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl);
  });
  check('allowed-existing-program-subset-accepted', () => temporaryFile('public/board_battle.html', readBaseline('public/board_battle.html'), () => assert.equal(collect().inputs.changedExistingPrograms.length, 10), true));
  check('missing-new-program-rejected', () => temporaryFile('public/js/board_audio_ui.js', null, () => assert.throws(collect)));
  check('dirty-new-program-rejected', () => temporaryFile('public/js/board_audio_ui.js', 'dirty new source', () => assert.throws(collect)));
  check('dirty-existing-program-rejected', () => temporaryFile('public/js/board_game.js', 'dirty source', () => assert.throws(collect)));
  check('missing-existing-program-rejected', () => temporaryFile('public/board_game.html', null, () => assert.throws(collect)));
  check('dirty-config-rejected', () => temporaryFile('config/desktop-program-packages-v1.json', '{}\n', () => assert.throws(collect)));
  check('empty-committed-program-rejected', () => temporaryFile('public/js/board_audio_ui.js', '', () => assert.throws(collect, /Invalid or empty/), true));
  check('unexpected-config-program-rejected', () => {
    const invalid = JSON.parse(JSON.stringify(config));
    invalid.games.board.programFiles.push('zz-extra.js');
    temporaryFile('config/desktop-program-packages-v1.json', canonicalJson(invalid), () => assert.throws(collect, /only add the two/), true);
  });
  check('unrelated-existing-program-change-rejected', () => temporaryFile('public/js/board_cards.js', 'unexpected program change\n', () => assert.throws(collect, /Unreviewed public source/), true));
  check('old-board-audio-change-rejected', () => temporaryFile(`public/${oldAudio.path}`, 'unexpected old audio', () => assert.throws(collect, /Protected existing asset changed/), true));
  check('new-unapproved-audio-rejected', () => temporaryFile('public/audio/board_game/unapproved.mp3', 'unexpected new audio', () => assert.throws(collect, /Unreviewed public source/), true));
  check('new-unapproved-public-program-rejected', () => temporaryFile('public/js/unapproved.js', 'unexpected new script', () => assert.throws(collect, /Unreviewed public source/), true));
  check('card-media-change-rejected', () => temporaryFile(`public/${oldCard.path}`, 'unexpected rank', () => assert.throws(collect, /Protected existing asset changed/), true));
  check('dirty-unrelated-rank-excluded', () => temporaryFile(`public/${oldCard.path}`, 'uncommitted user rank edit', () => assert.deepEqual(collect().inputs.changedAssets, good.inputs.changedAssets)));
  check('legacy-v2-change-rejected', () => temporaryFile('public/desktop/catalog-v2.json', '{}\n', () => assert.throws(collect, /Protected metadata changed/), true));
  check('legacy-board-manifest-change-rejected', () => temporaryFile(`public/${catalog.games.board.manifestPath}`, '{}\n', () => assert.throws(collect, /Protected metadata changed/), true));
  check('dirty-catalog-rejected', () => temporaryFile('public/desktop/catalog-v3.json', '{}\n', () => assert.throws(collect, /Uncommitted metadata/)));
  check('repository-output-rejected', () => assert.throws(() => api.outputDirectory(path.join(fixture, 'candidate')), /outside the repository/));
  check('ancestor-output-rejected', () => assert.throws(() => api.outputDirectory(runRoot), /outside the repository/));
  check('relative-output-rejected', () => assert.throws(() => api.outputDirectory('candidate'), /absolute/));
  check('other-git-tree-output-rejected', () => {
    const other = path.join(runRoot, 'other-worktree');
    fs.mkdirSync(other); fs.writeFileSync(path.join(other, '.git'), 'fixture');
    assert.throws(() => api.outputDirectory(path.join(other, 'candidate')), /every Git worktree/);
  });
  check('promote-requires-reviewed-candidate', () => assert.throws(() => builder.parseArguments(['--output', path.join(runRoot, 'candidate'), '--promote']), /previously reviewed/));
  check('baseline-cli-override-rejected', () => assert.throws(() => builder.parseArguments(['--output', path.join(runRoot, 'candidate'), '--baseline', baseline]), /Unknown argument/));
  check('duplicate-cli-argument-rejected', () => assert.throws(() => builder.parseArguments(['--candidate', runRoot, '--candidate', runRoot]), /Duplicate/));

  const directory = path.join(runRoot, 'candidate');
  const candidate = api.main(['--output', directory]);
  check('fresh-candidate-reconstructs-from-head', () => assert.equal(api.verifyCandidate(directory).inputs.sourceHead, candidate.inputs.sourceHead));
  check('candidate-is-immutable', () => assert.throws(() => api.main(['--output', directory]), /fresh empty/));
  for (const [relative, name] of [['program-bytes/js/board_audio_ui.js', 'program'], ['release-inputs.json', 'inputs'], ['desktop/catalog-v3.json', 'catalog']]) {
    const filename = path.join(directory, relative);
    const bytes = fs.readFileSync(filename);
    try {
      fs.writeFileSync(filename, relative.endsWith('.js') ? 'tampered' : '{}\n');
      check(`tampered-candidate-${name}-rejected`, () => assert.throws(() => api.verifyCandidate(directory)));
    } finally { fs.writeFileSync(filename, bytes); }
  }
  const missing = path.join(directory, 'program-bytes/css/board_audio_ui.css');
  const missingBytes = fs.readFileSync(missing);
  try { fs.unlinkSync(missing); check('missing-candidate-file-rejected', () => assert.throws(() => api.verifyCandidate(directory), /missing or unexpected/)); }
  finally { fs.writeFileSync(missing, missingBytes); }
  const extra = path.join(directory, 'extra.json');
  try { fs.writeFileSync(extra, '{}'); check('unexpected-candidate-file-rejected', () => assert.throws(() => api.verifyCandidate(directory), /missing or unexpected/)); }
  finally { fs.unlinkSync(extra); }
  const oldCatalog = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json'));
  const oldV2 = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v2.json'));
  const oldManifest = fs.readFileSync(path.join(fixture, 'public', catalog.games.board.manifestPath));
  check('inspect-does-not-promote', () => { api.main(['--candidate', directory]); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalog)); });
  check('dirty-source-blocks-promotion', () => temporaryFile('public/js/board_audio_ui.js', 'dirty', () => { assert.throws(() => api.main(['--candidate', directory, '--promote'])); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalog)); assert.equal(fs.existsSync(path.join(fixture, 'public', candidate.manifestPath)), false); }));
  check('explicit-promote-writes-exact-candidate', () => {
    api.main(['--candidate', directory, '--promote']);
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(candidate.files.get('desktop/catalog-v3.json')));
    assert.ok(fs.readFileSync(path.join(fixture, 'public', candidate.manifestPath)).equals(candidate.files.get(candidate.manifestPath)));
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v2.json')).equals(oldV2));
    assert.ok(fs.readFileSync(path.join(fixture, 'public', catalog.games.board.manifestPath)).equals(oldManifest));
  });
  check('formal-metadata-and-ranks-remain-unchanged', () => { for (const item of beforeMetadata) assert.equal(sha256Bytes(fs.readFileSync(path.join(ROOT, item.relative))), item.sha256); });
  const report = { ok: true, runRoot, checks: results.length, results, fixtureOnly: true, noNetwork: true, formalMetadataUnchanged: true };
  fs.writeFileSync(path.join(runRoot, 'report.json'), canonicalJson(report), { flag: 'wx' });
  console.log(JSON.stringify({ ok: true, checks: results.length, report: path.join(runRoot, 'report.json') }));
}
try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
