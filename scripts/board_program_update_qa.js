'use strict';

// Offline Git fixtures only. Never promote formal metadata or touch saved games.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { canonicalJson, sha256Bytes } = require('./desktop_program_package_common');
const ROOT = path.resolve(__dirname, '..');
const MEDIA = new Set(['image', 'audio', 'video', 'font']);
const runRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'board-program-update-qa-'));
const results = [];
const git = (root, args) => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const readAt = (ref, relative) => git(ROOT, ['cat-file', 'blob', `${ref}:${relative}`]);
const check = (name, fn) => { fn(); results.push({ name, pass: true }); };
const formalCatalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/desktop/catalog-v3.json')));
const protectedPaths = ['public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json', 'config/desktop-program-packages-v1.json', ...Object.values(formalCatalog.games).map(game => `public/${game.manifestPath}`), 'public/images/ranks/r5.PNG', 'public/images/ranks/r6.PNG'];
const before = protectedPaths.map(relative => ({ relative, sha256: sha256Bytes(fs.readFileSync(path.join(ROOT, relative))) }));

function exercise(ref, count, expectedMedia) {
  const directory = path.join(runRoot, `source-${count}`);
  fs.mkdirSync(directory);
  const write = (relative, bytes) => { const target = path.join(directory, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const commit = message => { git(directory, ['add', '-A']); git(directory, ['commit', '--quiet', '-m', message]); return git(directory, ['rev-parse', 'HEAD']).toString().trim(); };
  git(directory, ['init', '--quiet']);
  git(directory, ['config', 'user.name', 'Board Program Fixture QA']);
  git(directory, ['config', 'user.email', 'program-fixture@example.invalid']);
  git(directory, ['config', 'core.autocrlf', 'false']);
  const config = JSON.parse(readAt(ref, 'config/desktop-program-packages-v1.json'));
  const catalog = JSON.parse(readAt(ref, 'public/desktop/catalog-v3.json'));
  const previous = JSON.parse(readAt(ref, `public/${catalog.games.board.manifestPath}`));
  assert.equal(config.games.board.programFiles.length, count);
  for (const relative of ['config/desktop-program-packages-v1.json', 'public/desktop/catalog-v3.json', 'public/desktop/catalog-v2.json', ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`), ...config.games.board.programFiles.map(relative => `public/${relative}`)]) write(relative, readAt(ref, relative));
  for (const name of ['build_board_program_update.js', 'build_desktop_program_catalog.js', 'desktop_program_package_common.js']) write(`scripts/${name}`, fs.readFileSync(path.join(ROOT, 'scripts', name)));
  const baseline = commit(`Isolated ${count}-program baseline`);
  write('public/js/board_game.js', Buffer.concat([readAt(ref, 'public/js/board_game.js'), Buffer.from('\n/* fixture-only program update */\n')]));
  commit('Fixture program source update');
  const api = require(path.join(directory, 'scripts/build_board_program_update.js'));
  const collect = () => api.collect(baseline, '2026-09-21T16:00:00.000Z');
  const good = collect();
  check(`${count}-existing-programs-accepted`, () => {
    assert.equal(good.inputs.programs.length, count);
    assert.deepEqual(good.inputs.changedPrograms.map(asset => asset.path), ['js/board_game.js']);
    assert.equal(good.inputs.retainedMediaFiles, expectedMedia);
    assert.equal(good.manifest.totalFiles, count + expectedMedia);
  });
  check(`${count}-all-media-records-preserved`, () => assert.deepEqual(good.manifest.assets.filter(asset => MEDIA.has(asset.kind)), previous.assets.filter(asset => MEDIA.has(asset.kind))));
  check(`${count}-card-chess-origin-source-trees-preserved`, () => {
    for (const game of ['card', 'chess']) assert.deepEqual(good.catalog.games[game], catalog.games[game]);
    assert.deepEqual(good.catalog.sourceTrees, catalog.sourceTrees);
    assert.equal(good.catalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl);
  });
  function temporary(relative, bytes, fn, committed = false) {
    const target = path.join(directory, relative), old = fs.readFileSync(target);
    try { write(relative, bytes); if (committed) commit('Invalid fixture source'); fn(); }
    finally { write(relative, old); if (committed) commit('Restore fixture source'); }
  }
  check(`${count}-config-add-rejected`, () => {
    const invalid = JSON.parse(JSON.stringify(config)); invalid.games.board.programFiles.push('zz-extra.js');
    temporary('config/desktop-program-packages-v1.json', canonicalJson(invalid), () => assert.throws(collect, /cannot add\/remove configured programs/), true);
  });
  check(`${count}-config-remove-rejected`, () => {
    const invalid = JSON.parse(JSON.stringify(config)); invalid.games.board.programFiles = invalid.games.board.programFiles.filter(name => name !== 'js/board_game.js');
    temporary('config/desktop-program-packages-v1.json', canonicalJson(invalid), () => assert.throws(collect, /cannot add\/remove configured programs/), true);
  });
  check(`${count}-dirty-program-rejected`, () => temporary('public/js/board_game.js', 'dirty program', () => assert.throws(collect)));
  check(`${count}-empty-committed-program-rejected`, () => temporary('public/js/board_game.js', '', () => assert.throws(collect, /Empty committed program/), true));
  check(`${count}-legacy-v2-edit-rejected`, () => temporary('public/desktop/catalog-v2.json', '{}\n', () => assert.throws(collect, /legacy v2 catalog changed/), true));
  check(`${count}-baseline-manifest-edit-rejected`, () => temporary(`public/${catalog.games.board.manifestPath}`, '{}\n', () => assert.throws(collect, /baseline manifest changed/), true));
  const candidate = path.join(runRoot, `candidate-${count}`);
  const candidateResult = api.main(['--output', candidate, '--baseline', baseline]);
  check(`${count}-candidate-freezes-exact-committed-programs`, () => {
    const verified = api.verifyCandidate(candidate);
    assert.equal(verified.inputs.sourceHead, candidateResult.inputs.sourceHead);
    assert.equal(verified.inputs.programs.length, count);
  });
  check(`${count}-candidate-creation-is-immutable`, () => assert.throws(() => api.main(['--output', candidate, '--baseline', baseline]), /fresh empty/));
  const frozenProgram = path.join(candidate, 'program-bytes/js/board_game.js'), frozenBytes = fs.readFileSync(frozenProgram);
  try { fs.writeFileSync(frozenProgram, 'tamper'); check(`${count}-tampered-program-rejected`, () => assert.throws(() => api.verifyCandidate(candidate), /differs from committed source/)); }
  finally { fs.writeFileSync(frozenProgram, frozenBytes); }
  check(`${count}-inspection-does-not-promote`, () => {
    api.verifyCandidate(candidate);
    assert.ok(fs.readFileSync(path.join(directory, 'public/desktop/catalog-v3.json')).equals(readAt(ref, 'public/desktop/catalog-v3.json')));
    assert.equal(fs.existsSync(path.join(directory, 'public', candidateResult.manifestPath)), false);
  });
  check(`${count}-output-inside-repository-rejected`, () => assert.throws(() => api.outputDirectory(path.join(directory, 'candidate')), /outside the repository/));
  check(`${count}-promote-without-candidate-rejected`, () => assert.throws(() => api.parseArguments(['--output', candidate, '--promote']), /previously reviewed/));
}

try {
  exercise('6c2e4f59d25eb7f5803894ef834d6a318da562f3', 39, 4040);
  exercise('afea08a234f559f83cb2eb688f4fa1d34ceaa6a8', 43, 4112);
  check('formal-metadata-config-and-ranks-unchanged', () => { for (const entry of before) assert.equal(sha256Bytes(fs.readFileSync(path.join(ROOT, entry.relative))), entry.sha256); });
  const report = { ok: true, checks: results.length, runRoot, fixtureOnly: true, noNetwork: true, noPromotion: true, results };
  const filename = path.join(runRoot, 'report.json');
  fs.writeFileSync(filename, canonicalJson(report), { flag: 'wx' });
  console.log(JSON.stringify({ ok: true, checks: results.length, report: filename }));
} catch (error) { console.error(error.stack || error); process.exitCode = 1; }
