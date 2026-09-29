'use strict';

// Disposable Git fixture; this never promotes the real Board catalog.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const builder = require('./build_board_hit_depth_release');
const { sha256Bytes } = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_SOURCE = 'cc85b439f88d4b8a127a95f021398956083f28ef';
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'board-hit-depth-builder-'));
const fixture = path.join(runRoot, 'source');
const candidateDir = path.join(runRoot, 'candidate');
const checks = [];
const git = (root, args) => execFileSync('git', args, {
  cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const sourceBytes = filename => git(ROOT, ['cat-file', 'blob', `${BASELINE_SOURCE}:${filename}`]);
const write = (filename, bytes) => {
  const target = path.join(fixture, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
};
const check = (name, test) => { test(); checks.push(name); };

function main() {
  fs.mkdirSync(fixture);
  git(fixture, ['init', '--quiet']);
  git(fixture, ['config', 'user.name', 'Board Hit Depth Fixture']);
  git(fixture, ['config', 'user.email', 'board-hit-depth@example.invalid']);
  git(fixture, ['config', 'core.autocrlf', 'false']);
  const catalog = JSON.parse(sourceBytes('public/desktop/catalog-v3.json'));
  const legacy = JSON.parse(sourceBytes('public/desktop/catalog-v2.json'));
  const config = JSON.parse(sourceBytes('config/desktop-program-packages-v1.json'));
  const metadata = new Set([
    'config/desktop-program-packages-v1.json',
    'public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json',
    'public/desktop/launcher-release-v1.json',
    ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`),
    ...Object.values(legacy.games).map(game => `public/${game.manifestPath}`),
  ]);
  for (const filename of metadata) write(filename, sourceBytes(filename));
  for (const filename of config.games.board.programFiles) write(`public/${filename}`, sourceBytes(`public/${filename}`));
  git(fixture, ['add', '-A']);
  git(fixture, ['commit', '--quiet', '-m', 'Isolated current public baseline']);
  for (const name of builder.CHANGED_PROGRAMS) {
    fs.appendFileSync(path.join(fixture, 'public', name), name === 'board_game.html'
      ? '\r\n/* reviewed hit-depth fixture */\r\n'
      : '\n/* reviewed hit-depth fixture */\n');
  }
  const rank = path.join(fixture, 'public/images/ranks/r5.PNG');
  fs.mkdirSync(path.dirname(rank), { recursive: true });
  fs.writeFileSync(rank, 'unrelated dirty rank sentinel');
  const api = builder.createBuilder(fixture);
  const oldCatalogBytes = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json'));
  const oldManifest = JSON.parse(sourceBytes(`public/${catalog.games.board.manifestPath}`));

  check('current-public-baseline-identity', () => {
    assert.equal(catalog.games.board.releaseId, builder.BASELINE_RELEASE);
    assert.equal(sha256Bytes(oldCatalogBytes), builder.BASELINE_CATALOG_SHA);
    assert.equal(sha256Bytes(sourceBytes(`public/${catalog.games.board.manifestPath}`)), builder.BASELINE_MANIFEST_SHA);
  });
  check('unsafe-cli-and-candidate-paths-rejected', () => {
    for (const args of [
      [], ['--output', candidateDir, '--promote'],
      ['--output', candidateDir, '--candidate', candidateDir],
      ['--candidate', candidateDir, '--unknown'],
    ]) assert.throws(() => builder.parseArguments(args));
    assert.throws(() => api.outputDirectory('relative'));
    assert.throws(() => api.outputDirectory(path.join(fixture, 'candidate')));
  });
  const result = api.main(['--output', candidateDir]);
  const manifest = JSON.parse(result.files.get(result.manifestPath));
  check('candidate-is-only-three-program-payloads', () => {
    assert.deepEqual([...result.files.keys()].filter(name => name.startsWith('program-bytes/')),
      builder.CHANGED_PROGRAMS.map(name => `program-bytes/${name}`));
    assert.equal(result.inputs.changedPrograms.length, 3);
    assert.equal(manifest.totalFiles, oldManifest.totalFiles);
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(oldCatalogBytes));
  });
  check('mixed-eol-board-page-retains-committed-crlf-bytes', () => {
    const name = 'board_game.html';
    const committed = sourceBytes(`public/${name}`);
    const local = fs.readFileSync(path.join(fixture, 'public', name));
    const payload = result.files.get(`program-bytes/${name}`);
    assert.ok(payload.equals(local), 'Mixed-EOL page must be packaged without normalization.');
    assert.equal(payload.length, committed.length + Buffer.byteLength('\r\n/* reviewed hit-depth fixture */\r\n'));
    const count = bytes => ({ crlf: (bytes.toString('latin1').match(/\r\n/g) || []).length,
      bareLf: (bytes.toString('latin1').match(/(?<!\r)\n/g) || []).length });
    assert.deepEqual(count(committed), { crlf: 27521, bareLf: 135 });
    assert.deepEqual(count(payload), { crlf: 27523, bareLf: 135 });
    assert.equal(result.inputs.changedPrograms.find(asset => asset.path === name).sha256, sha256Bytes(local));
  });
  check('every-untouched-asset-record-retained', () => {
    const byPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of oldManifest.assets) {
      if (!builder.CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(byPath.get(asset.path), asset, asset.path);
    }
    assert.equal(result.inputs.retainedAssetCount, oldManifest.totalFiles - config.games.board.programFiles.length);
  });
  check('candidate-verifies-and-unrelated-dirty-art-survives', () => {
    assert.equal(api.verifyCandidate(candidateDir).inputs.candidate.releaseId, result.inputs.candidate.releaseId);
    assert.equal(fs.readFileSync(rank, 'utf8'), 'unrelated dirty rank sentinel');
  });
  check('candidate-payload-tampering-rejected', () => {
    const filename = path.join(candidateDir, 'program-bytes', builder.CHANGED_PROGRAMS[0]);
    const original = fs.readFileSync(filename);
    try { fs.writeFileSync(filename, 'tampered'); assert.throws(() => api.verifyCandidate(candidateDir), /Candidate bytes differ/); }
    finally { fs.writeFileSync(filename, original); }
  });
  check('unreviewed-program-drift-rejected', () => {
    const name = config.games.board.programFiles.find(item => !builder.CHANGED_PROGRAMS.includes(item));
    const filename = path.join(fixture, 'public', name);
    const original = fs.readFileSync(filename);
    try { fs.appendFileSync(filename, '\nchanged\n'); assert.throws(() => api.verifyCandidate(candidateDir)); }
    finally { fs.writeFileSync(filename, original); }
  });
  check('protected-catalog-drift-rejected', () => {
    const filename = path.join(fixture, 'public/desktop/catalog-v3.json');
    try { fs.writeFileSync(filename, '{}'); assert.throws(() => api.verifyCandidate(candidateDir), /Protected file differs/); }
    finally { fs.writeFileSync(filename, oldCatalogBytes); }
  });
  check('explicit-fixture-promotion-changes-only-catalog-and-new-manifest', () => {
    api.main(['--candidate', candidateDir, '--promote']);
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(result.files.get('desktop/catalog-v3.json')));
    assert.ok(fs.readFileSync(path.join(fixture, 'public', result.manifestPath)).equals(result.files.get(result.manifestPath)));
    assert.equal(fs.readFileSync(rank, 'utf8'), 'unrelated dirty rank sentinel');
  });
  console.log(JSON.stringify({ ok: true, checks, fixture, candidate: result.inputs.candidate }));
}

try { main(); } catch (error) { console.error(`BOARD_HIT_DEPTH_BUILDER_QA=FAIL ${error.stack}`); process.exitCode = 1; }
