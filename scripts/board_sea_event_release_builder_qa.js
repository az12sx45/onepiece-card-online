'use strict';

// Isolated Git fixture only: no formal metadata, player data, network or publish.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const builder = require('./build_board_sea_event_release');
const { canonicalJson, sha256Bytes, comparePaths } = require('./desktop_program_package_common');
const ROOT = path.resolve(__dirname, '..');
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'board-sea-release-qa-'));
const fixture = path.join(runRoot, 'source');
fs.mkdirSync(fixture);
const git = (root, args) => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const readBaseline = relative => git(ROOT, ['cat-file', 'blob', `${builder.BASELINE}:${relative}`]);
const write = (relative, bytes) => { const filename = path.join(fixture, relative); fs.mkdirSync(path.dirname(filename), { recursive: true }); fs.writeFileSync(filename, bytes); };
const commit = message => { git(fixture, ['add', '-A']); git(fixture, ['commit', '--quiet', '-m', message]); return git(fixture, ['rev-parse', 'HEAD']).toString('utf8').trim(); };
const results = [];
const check = (name, action) => { action(); results.push({ name, pass: true }); };
const beforeMetadata = ['public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json'].map(relative => ({ relative, sha256: sha256Bytes(fs.readFileSync(path.join(ROOT, relative))) }));
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
  git(fixture, ['config', 'user.name', 'Sea Release Fixture QA']);
  git(fixture, ['config', 'user.email', 'sea-release-fixture@example.invalid']);
  git(fixture, ['config', 'core.autocrlf', 'false']);
  const config = JSON.parse(readBaseline('config/desktop-program-packages-v1.json'));
  const catalog = JSON.parse(readBaseline('public/desktop/catalog-v3.json'));
  for (const relative of ['config/desktop-program-packages-v1.json', 'public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json', ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`)]) write(relative, readBaseline(relative));
  for (const relative of config.games.board.programFiles) write(`public/${relative}`, readBaseline(`public/${relative}`));
  const baseline = commit('Isolated release baseline');
  const helper = fs.readFileSync(path.join(ROOT, 'public/js/board_sea_event_visuals.js'));
  const images = builder.imagePaths(helper);
  config.games.board.programFiles.push(...builder.NEW_PROGRAMS);
  config.games.board.programFiles.sort(comparePaths);
  write('config/desktop-program-packages-v1.json', canonicalJson(config));
  write('public/js/board_sea_event_visuals.js', helper);
  write('public/css/board_sea_event_reveal.css', '/* isolated fixture CSS */\n');
  for (const relative of builder.CHANGED_PROGRAMS) write(`public/${relative}`, Buffer.concat([readBaseline(`public/${relative}`), Buffer.from('\n<!-- fixture sea change -->\n')]));
  // Header-valid stand-ins test packaging integrity, not image decoding/visual QA.
  for (const relative of images) write(`public/${relative}`, Buffer.concat([Buffer.from('RIFF0000WEBPVP8 '), Buffer.from(relative)]));
  commit('Isolated sea feature source');
  const api = builder.createBuilder(fixture, baseline);
  const collect = () => api.collect('2026-09-21T00:00:00.000Z');
  const good = collect();
  check('exact-release-inventory', () => { assert.equal(good.inputs.programs.length, 41); assert.equal(good.inputs.media.length, 72); assert.equal(good.inputs.changedAssets.length, 76); assert.equal(good.manifest.totalFiles, 4153); });
  check('all-4040-old-media-preserved', () => { const previous = JSON.parse(readBaseline(`public/${catalog.games.board.manifestPath}`)); const media = previous.assets.filter(asset => ['image', 'audio', 'video', 'font'].includes(asset.kind)); assert.equal(media.length, 4040); assert.deepEqual(good.manifest.assets.filter(asset => media.some(old => old.path === asset.path)), media); });
  check('card-chess-and-source-trees-preserved', () => { for (const game of ['card', 'chess']) assert.deepEqual(good.catalog.games[game], catalog.games[game]); assert.deepEqual(good.catalog.sourceTrees, catalog.sourceTrees); });
  check('missing-referenced-image-rejected', () => temporaryFile(`public/${images[0]}`, null, () => assert.throws(collect)));
  check('dirty-referenced-image-rejected', () => temporaryFile(`public/${images[0]}`, 'dirty', () => assert.throws(collect)));
  check('unexpected-untracked-image-rejected', () => temporaryFile(`public/${builder.PREFIX}unexpected.webp`, 'extra', () => assert.throws(collect, /unexpected files/)));
  check('unexpected-committed-image-rejected', () => temporaryFile(`public/${builder.PREFIX}unexpected.webp`, 'extra', () => assert.throws(collect, /missing or unexpected paths/), true));
  check('unexpected-config-program-rejected', () => { const invalid = JSON.parse(JSON.stringify(config)); invalid.games.board.programFiles.push('zz-extra.js'); temporaryFile('config/desktop-program-packages-v1.json', canonicalJson(invalid), () => assert.throws(collect, /only add the two/), true); });
  check('unrelated-existing-program-change-rejected', () => temporaryFile('public/js/board_cards.js', 'unexpected program change\n', () => assert.throws(collect, /Only board_game/), true));
  check('old-board-media-change-rejected', () => { const old = JSON.parse(readBaseline(`public/${catalog.games.board.manifestPath}`)).assets.find(asset => asset.kind === 'image'); temporaryFile(`public/${old.path}`, 'unexpected old media', () => assert.throws(collect, /Protected existing asset changed/), true); });
  check('card-media-change-rejected', () => { const old = JSON.parse(readBaseline(`public/${catalog.games.card.manifestPath}`)).assets.find(asset => asset.path.startsWith('images/ranks/')); assert.ok(old); temporaryFile(`public/${old.path}`, 'unexpected rank', () => assert.throws(collect, /Protected existing asset changed/), true); });
  check('legacy-v2-change-rejected', () => temporaryFile('public/desktop/catalog-v2.json', '{}\n', () => assert.throws(collect, /Protected metadata changed/), true));
  check('missing-variant-in-helper-rejected', () => assert.throws(() => builder.imagePaths(Buffer.from('module.exports={definitions:[]};')), /reviewed 24 events/));
  check('repository-output-rejected', () => assert.throws(() => api.outputDirectory(path.join(fixture, 'candidate')), /outside the repository/));
  check('relative-output-rejected', () => assert.throws(() => api.outputDirectory('candidate'), /absolute/));
  check('promote-requires-reviewed-candidate', () => assert.throws(() => builder.parseArguments(['--output', path.join(runRoot, 'candidate'), '--promote']), /previously reviewed/));
  check('baseline-cli-override-rejected', () => assert.throws(() => builder.parseArguments(['--output', path.join(runRoot, 'candidate'), '--baseline', baseline]), /Unknown argument/));
  const directory = path.join(runRoot, 'candidate');
  const candidate = api.main(['--output', directory]);
  check('fresh-candidate-reconstructs-from-head', () => assert.equal(api.verifyCandidate(directory).inputs.sourceHead, candidate.inputs.sourceHead));
  check('candidate-is-immutable', () => assert.throws(() => api.main(['--output', directory]), /fresh empty/));
  const candidateImage = path.join(directory, 'media-bytes', images[0]);
  const candidateImageBytes = fs.readFileSync(candidateImage);
  try { fs.writeFileSync(candidateImage, 'tampered'); check('tampered-candidate-image-rejected', () => assert.throws(() => api.verifyCandidate(directory), /differs from committed source/)); }
  finally { fs.writeFileSync(candidateImage, candidateImageBytes); }
  const extra = path.join(directory, 'extra.json');
  try { fs.writeFileSync(extra, '{}'); check('unexpected-candidate-file-rejected', () => assert.throws(() => api.verifyCandidate(directory), /missing or unexpected files/)); }
  finally { fs.unlinkSync(extra); }
  const oldCatalog = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json'));
  const oldV2 = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v2.json'));
  check('inspect-does-not-promote', () => { api.main(['--candidate', directory]); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalog)); });
  check('explicit-promote-writes-exact-candidate', () => { api.main(['--candidate', directory, '--promote']); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(candidate.files.get('desktop/catalog-v3.json'))); assert.ok(fs.readFileSync(path.join(fixture, 'public', candidate.manifestPath)).equals(candidate.files.get(candidate.manifestPath))); assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v2.json')).equals(oldV2)); });
  check('formal-metadata-remains-unchanged', () => { for (const item of beforeMetadata) assert.equal(sha256Bytes(fs.readFileSync(path.join(ROOT, item.relative))), item.sha256); });
  const report = { ok: true, runRoot, checks: results.length, results, fixtureOnly: true, imagesAreHeaderFixtures: true, noNetwork: true, formalMetadataUnchanged: true };
  fs.writeFileSync(path.join(runRoot, 'report.json'), canonicalJson(report), { flag: 'wx' });
  console.log(JSON.stringify({ ok: true, checks: results.length, report: path.join(runRoot, 'report.json') }));
}
try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
