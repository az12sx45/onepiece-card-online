'use strict';

// Disposable Git fixture; no production metadata, original art or R2 writes.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const builder = require('./build_board_tavern_captain_release');
const { sha256Bytes } = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const parent = path.resolve(process.env.BOARD_TAVERN_CAPTAIN_QA_ROOT || os.tmpdir());
const runRoot = fs.mkdtempSync(path.join(parent, 'board-tavern-captain-builder-'));
const fixture = path.join(runRoot, 'source');
const candidateDir = path.join(runRoot, 'candidate');
const media = [
  'images/board/tavern_recruit/crew_v3/nami_decline.webp',
  'images/board/tavern_recruit/crew_v3/zoro_accept.webp',
];
const checks = [];
const git = (root, args) => execFileSync('git', args, {
  cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const sourceBytes = filename => git(ROOT, ['cat-file', 'blob', `${builder.BASELINE}:${filename}`]);
const write = (filename, bytes) => {
  const target = path.join(fixture, filename);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
};
const commit = message => {
  git(fixture, ['add', '-A']);
  git(fixture, ['commit', '--quiet', '-m', message]);
  return git(fixture, ['rev-parse', 'HEAD']).toString('utf8').trim();
};
const check = (name, fn) => { fn(); checks.push(name); };
const fakeWebp = Buffer.from('RIFF\x10\x00\x00\x00WEBPVP8 \x04\x00\x00\x00FAKE', 'binary');

function main() {
  fs.mkdirSync(fixture);
  git(fixture, ['init', '--quiet']);
  git(fixture, ['config', 'user.name', 'Board Tavern Builder QA']);
  git(fixture, ['config', 'user.email', 'board-tavern-builder-qa@example.invalid']);
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
  const baseline = commit('Isolated live Board package baseline');
  const nextConfig = JSON.parse(JSON.stringify(config));
  nextConfig.games.board.programFiles = [...config.games.board.programFiles, ...builder.ADDED_PROGRAMS].sort();
  write('config/desktop-program-packages-v1.json', Buffer.from(JSON.stringify(nextConfig, null, 2) + '\n'));
  for (const filename of builder.CHANGED_PROGRAMS) {
    write(`public/${filename}`, builder.ADDED_PROGRAMS.includes(filename)
      ? Buffer.from('/* reviewed bundled WebGL VFX fixture */\n')
      : Buffer.concat([sourceBytes(`public/${filename}`), Buffer.from('\n/* reviewed captain update */\n')]));
  }
  for (const filename of media) write(`public/${filename}`, fakeWebp);
  const sourceHead = commit('Isolated reviewed captain update');
  const api = builder.createBuilder(fixture, baseline);
  const createdAt = '2026-09-28T04:00:00.000Z';
  const oldManifest = JSON.parse(sourceBytes(`public/${catalog.games.board.manifestPath}`));
  const built = api.collect(createdAt, media);
  const manifest = JSON.parse(built.files.get(built.manifestPath));

  check('frozen-live-baseline-identity', () => {
    assert.equal(catalog.games.board.releaseId, builder.BASELINE_RELEASE);
    assert.equal(sha256Bytes(sourceBytes(`public/${catalog.games.board.manifestPath}`)), builder.BASELINE_MANIFEST_SHA);
    assert.equal(oldManifest.totalFiles, 6377);
    assert.equal(config.games.board.programFiles.length, 56);
  });
  check('exact-six-program-two-media-delta', () => {
    assert.deepEqual(built.inputs.changedPrograms, builder.CHANGED_PROGRAMS);
    assert.deepEqual(built.inputs.addedPrograms, builder.ADDED_PROGRAMS);
    assert.deepEqual(built.inputs.mediaPaths, media);
    assert.equal(built.inputs.changedAssets.length, 8);
    assert.equal(manifest.totalFiles, 6380);
  });
  check('all-previous-board-media-records-retained', () => {
    const byPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of oldManifest.assets) {
      if (!builder.CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(byPath.get(asset.path), asset, asset.path);
    }
    assert.equal(built.inputs.retainedMediaFiles, 6321);
  });
  check('source-program-and-media-payloads-use-git-blobs', () => {
    for (const filename of [...nextConfig.games.board.programFiles, ...media]) {
      const group = media.includes(filename) ? 'media' : 'program';
      assert.ok(built.files.get(`${group}-bytes/${filename}`).equals(git(fixture, ['cat-file', 'blob', `${sourceHead}:public/${filename}`])));
    }
  });
  check('card-chess-and-launcher-release-unchanged', () => {
    const next = JSON.parse(built.files.get('desktop/catalog-v3.json'));
    for (const game of ['card', 'chess']) assert.deepEqual(next.games[game], catalog.games[game]);
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/launcher-release-v1.json')).equals(sourceBytes('public/desktop/launcher-release-v1.json')));
  });
  check('media-path-validation', () => {
    assert.deepEqual(builder.validateMediaPaths(media.slice().reverse()), media);
    for (const bad of [
      ['images/board/tavern_recruit/crew_v2/old.webp'],
      ['images/board/tavern_recruit/crew_v3/../old.webp'],
      ['images/board/tavern_recruit/crew_v3/UPPER.webp'],
      ['images/board/tavern_recruit/crew_v3/new.png'],
      [media[0], media[0]], [],
    ]) assert.throws(() => builder.validateMediaPaths(bad));
  });
  check('cli-rejects-ambiguous-or-unsafe-options', () => {
    for (const args of [
      ['--output', candidateDir, '--candidate', candidateDir, '--media', media[0]],
      ['--output', candidateDir, '--promote', '--media', media[0]],
      ['--output', candidateDir],
      ['--candidate', candidateDir, '--unknown'],
      ['--candidate', candidateDir, '--candidate', candidateDir],
    ]) assert.throws(() => builder.parseArguments(args));
  });
  check('candidate-path-outside-checkout-only', () => {
    assert.throws(() => api.outputDirectory('relative'));
    assert.throws(() => api.outputDirectory(path.join(fixture, 'candidate')));
    assert.throws(() => api.outputDirectory(runRoot));
    assert.equal(api.outputDirectory(candidateDir), candidateDir);
  });
  check('invalid-time-and-missing-review-list-rejected', () => {
    assert.throws(() => api.collect('bad', media));
    assert.throws(() => api.collect(createdAt, [media[0]]), /Unexpected or missing public changes/);
    assert.throws(() => api.collect(createdAt, [media[0], 'images/board/tavern_recruit/crew_v3/absent.webp']), /Unexpected or missing public changes/);
  });

  // Dirty files outside the explicit release paths must survive every gate.
  const rank = path.join(fixture, 'public/images/ranks/r5.PNG');
  fs.mkdirSync(path.dirname(rank), { recursive: true });
  const rankBytes = Buffer.from('dirty rank sentinel, do not touch');
  fs.writeFileSync(rank, rankBytes);
  const previousCatalog = fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json'));
  const candidate = api.main(['--output', candidateDir, ...media.flatMap(name => ['--media', name])]);
  check('fresh-candidate-verifies-without-promotion', () => {
    assert.equal(candidate.inputs.sourceHead, sourceHead);
    assert.equal(api.verifyCandidate(candidateDir).inputs.candidate.releaseId, candidate.inputs.candidate.releaseId);
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(previousCatalog));
    assert.ok(fs.readFileSync(rank).equals(rankBytes));
  });
  check('candidate-media-list-argument-is-bound', () => {
    assert.throws(() => api.verifyCandidate(candidateDir, [media[0]]));
  });
  check('tampered-candidate-payload-rejected', () => {
    const payload = path.join(candidateDir, `media-bytes/${media[0]}`);
    const original = fs.readFileSync(payload);
    try { fs.writeFileSync(payload, 'tampered'); assert.throws(() => api.verifyCandidate(candidateDir), /Candidate bytes differ/); }
    finally { fs.writeFileSync(payload, original); }
  });
  check('unexpected-candidate-file-rejected', () => {
    const extra = path.join(candidateDir, 'extra.json');
    try { fs.writeFileSync(extra, '{}'); assert.throws(() => api.verifyCandidate(candidateDir), /Candidate inventory differs/); }
    finally { fs.unlinkSync(extra); }
  });
  check('dirty-protected-metadata-rejected-without-promotion', () => {
    const target = path.join(fixture, 'public/desktop/catalog-v3.json');
    try { fs.writeFileSync(target, '{}'); assert.throws(() => api.verifyCandidate(candidateDir), /Metadata differs/); }
    finally { fs.writeFileSync(target, previousCatalog); }
  });
  check('dirty-program-allowlist-rejected-without-promotion', () => {
    const target = path.join(fixture, 'config/desktop-program-packages-v1.json');
    const original = fs.readFileSync(target);
    try { fs.writeFileSync(target, '{}'); assert.throws(() => api.verifyCandidate(candidateDir), /Metadata differs/); }
    finally { fs.writeFileSync(target, original); }
  });
  check('immutable-manifest-collision-keeps-catalog', () => {
    const target = path.join(fixture, 'public', candidate.manifestPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    try {
      fs.writeFileSync(target, 'different immutable bytes');
      assert.throws(() => api.main(['--candidate', candidateDir, '--promote']), /Existing immutable file differs/);
      assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(previousCatalog));
    } finally { fs.unlinkSync(target); }
  });
  check('explicit-promotion-writes-only-board-catalog-and-manifest', () => {
    api.main(['--candidate', candidateDir, '--promote']);
    assert.ok(fs.readFileSync(path.join(fixture, 'public/desktop/catalog-v3.json')).equals(candidate.files.get('desktop/catalog-v3.json')));
    assert.ok(fs.readFileSync(path.join(fixture, 'public', candidate.manifestPath)).equals(candidate.files.get(candidate.manifestPath)));
    for (const [filename, bytes] of candidate.protectedFiles) {
      if (filename !== 'public/desktop/catalog-v3.json') assert.ok(fs.readFileSync(path.join(fixture, filename)).equals(bytes), filename);
    }
    assert.ok(fs.readFileSync(rank).equals(rankBytes));
  });
  const report = { ok: true, checks: checks.length, names: checks, fixture, sourceHead, candidate: candidate.inputs.candidate };
  const output = process.env.BOARD_QA_OUTPUT;
  if (output) {
    fs.mkdirSync(output, { recursive: true });
    fs.writeFileSync(path.join(output, 'captain-builder-qa.json'), JSON.stringify(report, null, 2) + '\n');
  }
  console.log(JSON.stringify(report));
}

try { main(); } catch (error) { console.error(`BOARD_TAVERN_CAPTAIN_BUILDER_QA=FAIL ${error.stack}`); process.exitCode = 1; }
