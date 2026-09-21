'use strict';

// Scoped, offline release for Board scene BGM and interface sounds.
// Only explicit --candidate <reviewed-directory> --promote writes public metadata.
// Player data, installed caches, Git, network, Card, Chess and v2 are never written.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes, classifyPath, comparePaths, validateCatalog, validateManifest } = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = 'a5cf3d328195537cc062460e4d1dde91dc17b654';
const CATALOG = 'public/desktop/catalog-v3.json';
const CONFIG = 'config/desktop-program-packages-v1.json';
const V2 = 'public/desktop/catalog-v2.json';
const GENERATOR = 'board-audio-release-v1';
const NEW_PROGRAMS = ['css/board_audio_ui.css', 'js/board_audio_ui.js'];
// Public review room is web-only and does not enter the desktop program inventory.
const WEB_ONLY_PROGRAMS = ['board_audio_preview.html', 'js/board_audio_preview.js'];
const CHANGED_PROGRAMS = [
  'board_battle.html', 'board_game.html', 'board_impel_down.html', 'board_marineford.html',
  'board_spar_selection_demo.html', 'board_start.html', 'board_water_seven.html',
  'board_york_clue_puzzle_formal_demo.html', 'js/bgm_manager.js', 'js/board_game.js', 'js/board_start.js'
];
const MEDIA = new Set(['image', 'audio', 'video', 'font']);
const jsonBytes = value => Buffer.from(canonicalJson(value));
const within = (parent, target) => { const relative = path.relative(parent, target); return !relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); };

function rejectLinks(target) {
  for (let current = target; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Links/junctions are not accepted: ${current}`);
    if (path.dirname(current) === current) break;
  }
}
function checkedJson(bytes, label) {
  const value = JSON.parse(bytes.toString('utf8'));
  assert.ok(bytes.equals(jsonBytes(value)), `${label} must use canonical JSON.`);
  return value;
}
function record(relative, bytes) {
  const type = classifyPath(relative);
  assert.ok(type && bytes.length, `Invalid or empty source: ${relative}`);
  return { path: relative, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) };
}
function immutableWrite(filename, bytes) {
  rejectLinks(filename);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  if (fs.existsSync(filename)) assert.ok(fs.readFileSync(filename).equals(bytes), `Refusing to overwrite different candidate/immutable bytes: ${filename}`);
  else fs.writeFileSync(filename, bytes, { flag: 'wx' });
}
function listFiles(directory, prefix = '') {
  rejectLinks(directory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const relative = prefix + entry.name;
    const filename = path.join(directory, entry.name);
    rejectLinks(filename);
    if (entry.isDirectory()) return listFiles(filename, relative + '/');
    assert.ok(entry.isFile(), `Expected regular file: ${filename}`);
    return [relative];
  }).sort(comparePaths);
}

// The factory supports isolated fixture QA. CLI always uses the fixed formal
// root and reviewed baseline above, and exposes no root/baseline override.
function createBuilder(root = ROOT, baselineRef = BASELINE) {
  root = path.resolve(root);
  const git = args => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const readAt = (ref, relative) => git(['cat-file', 'blob', `${ref}:${relative}`]);
  function cleanFile(relative, expected) {
    const filename = path.join(root, relative);
    rejectLinks(filename);
    assert.ok(fs.readFileSync(filename).equals(expected), `Uncommitted metadata differs: ${relative}`);
  }
  function outputDirectory(value) {
    assert.ok(value && path.isAbsolute(value), 'Candidate path must be absolute.');
    const directory = path.resolve(value);
    assert.ok(!within(root, directory) && !within(directory, root), 'Candidate must be outside the repository.');
    rejectLinks(directory);
    for (let current = directory; ; current = path.dirname(current)) {
      assert.equal(fs.existsSync(path.join(current, '.git')), false, 'Candidate must be outside every Git worktree.');
      if (path.dirname(current) === current) break;
    }
    if (fs.existsSync(directory)) assert.ok(fs.statSync(directory).isDirectory(), 'Candidate path is not a directory.');
    return directory;
  }
  function collect(createdAt) {
    assert.ok(Number.isFinite(Date.parse(createdAt)), 'Invalid candidate time.');
    const sourceHead = git(['rev-parse', 'HEAD']).toString('utf8').trim();
    const baseline = git(['rev-parse', '--verify', `${baselineRef}^{commit}`]).toString('utf8').trim();
    git(['merge-base', '--is-ancestor', baseline, sourceHead]);
    const baselineBytes = readAt(baseline, CATALOG);
    const catalog = validateCatalog(checkedJson(baselineBytes, 'Baseline catalog'));
    const configBytes = readAt(sourceHead, CONFIG);
    const config = validateConfig(checkedJson(configBytes, 'Program config'));
    const priorConfig = validateConfig(checkedJson(readAt(baseline, CONFIG), 'Baseline program config'));
    const expectedConfig = JSON.parse(JSON.stringify(priorConfig));
    expectedConfig.games.board.programFiles.push(...NEW_PROGRAMS);
    expectedConfig.games.board.programFiles.sort(comparePaths);
    assert.deepEqual(config, expectedConfig, 'Config may only add the two Board audio interface programs.');
    assert.equal(priorConfig.games.board.programFiles.length, 41, 'Expected 41 baseline Board programs.');
    assert.equal(config.games.board.programFiles.length, 43, 'Expected 43 candidate Board programs.');
    const protectedFiles = new Map([[CATALOG, baselineBytes], [V2, readAt(baseline, V2)]]);
    assert.equal(sha256Bytes(protectedFiles.get(V2)), config.legacyBaseline.catalogSha256, 'Legacy v2 baseline SHA');
    const manifests = {};
    for (const game of ['card', 'board', 'chess']) {
      const relative = `public/${catalog.games[game].manifestPath}`;
      const bytes = readAt(baseline, relative);
      assert.equal(sha256Bytes(bytes), catalog.games[game].manifestSha256, `${game} manifest SHA`);
      const manifest = validateManifest(checkedJson(bytes, `${game} baseline manifest`), game);
      for (const key of ['releaseId', 'entryPath', 'totalFiles', 'totalBytes']) assert.equal(manifest[key], catalog.games[game][key], `${game} baseline ${key}`);
      manifests[game] = manifest;
      protectedFiles.set(relative, bytes);
    }
    for (const [relative, bytes] of protectedFiles) {
      assert.ok(readAt(sourceHead, relative).equals(bytes), `Protected metadata changed in HEAD: ${relative}`);
      cleanFile(relative, bytes);
    }
    protectedFiles.set(CONFIG, configBytes);
    cleanFile(CONFIG, configBytes);
    const previous = manifests.board;
    const retained = previous.assets.filter(asset => MEDIA.has(asset.kind));
    assert.equal(retained.length, 4112, 'Expected 4,112 retained Board media records.');
    assert.deepEqual(previous.assets.filter(asset => !MEDIA.has(asset.kind)).map(asset => asset.path), priorConfig.games.board.programFiles, 'Baseline Board programs differ from config.');
    assert.equal(previous.entryPath, config.games.board.entryPath, 'Board entry path');
    const names = config.games.board.programFiles;
    const sourcePaths = [CONFIG, ...names.map(name => `public/${name}`), ...WEB_ONLY_PROGRAMS.map(name => `public/${name}`)];
    // Diff respects checkout CRLF rules. All package bytes still come from Git blobs.
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    for (const relative of sourcePaths) {
      const filename = path.join(root, relative);
      rejectLinks(filename);
      assert.ok(fs.statSync(filename).isFile(), `Missing regular source file: ${relative}`);
    }
    const changedInHead = new Set(git(['diff', '-z', '--name-only', '--no-renames', baseline, sourceHead, '--', 'public']).toString('utf8').split('\0').filter(Boolean));
    const protectedAssetPaths = new Set([...retained, ...manifests.card.assets, ...manifests.chess.assets].map(asset => `public/${asset.path}`));
    for (const relative of protectedAssetPaths) assert.equal(changedInHead.has(relative), false, `Protected existing asset changed in HEAD: ${relative}`);
    const allowedPublicChanges = new Set([...CHANGED_PROGRAMS, ...NEW_PROGRAMS, ...WEB_ONLY_PROGRAMS].map(relative => `public/${relative}`));
    for (const relative of changedInHead) assert.ok(allowedPublicChanges.has(relative), `Unreviewed public source changed in HEAD: ${relative}`);
    const programBytes = new Map();
    const webOnlyBytes = new Map(WEB_ONLY_PROGRAMS.map(relative => [relative, readAt(sourceHead, `public/${relative}`)]));
    const webOnlyPrograms = [...webOnlyBytes].map(([relative, bytes]) => record(relative, bytes));
    const programs = names.map(relative => {
      const bytes = readAt(sourceHead, `public/${relative}`);
      const asset = record(relative, bytes);
      assert.equal(MEDIA.has(asset.kind), false, `Program has media type: ${relative}`);
      programBytes.set(relative, bytes);
      return asset;
    });
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, retained, programs), 'board');
    assert.deepEqual(manifest.assets.filter(asset => MEDIA.has(asset.kind)), retained, 'Existing media records changed.');
    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    const changed = programs.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)));
    const changedExisting = changed.filter(asset => oldByPath.has(asset.path));
    for (const asset of changedExisting) assert.ok(CHANGED_PROGRAMS.includes(asset.path), `Unreviewed existing program changed: ${asset.path}`);
    const added = manifest.assets.filter(asset => !oldByPath.has(asset.path)).map(asset => asset.path);
    assert.deepEqual(added, [...NEW_PROGRAMS].sort(comparePaths), 'Only the two reviewed audio programs may be added.');
    assert.equal(manifest.totalFiles, previous.totalFiles + 2, 'Candidate file count');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of previous.assets) if (!CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(nextByPath.get(asset.path), asset, `Existing package record changed: ${asset.path}`);
    const nextManifestBytes = jsonBytes(manifest);
    const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
    const nextCatalog = validateCatalog({ ...catalog, createdAt, games: { ...catalog.games, board: {
      releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(nextManifestBytes), entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes
    } } });
    for (const game of ['card', 'chess']) assert.deepEqual(nextCatalog.games[game], catalog.games[game], `${game} catalog changed.`);
    assert.deepEqual(nextCatalog.sourceTrees, catalog.sourceTrees, 'Media source trees changed.');
    assert.equal(nextCatalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl, 'Asset origin changed.');
    const inputs = {
      generator: GENERATOR, baseline, sourceHead, createdAt, baselineBoardRelease: previous.releaseId,
      protected: [...protectedFiles].map(([relative, bytes]) => ({ path: relative, size: bytes.length, sha256: sha256Bytes(bytes) })),
      programs, webOnlyPrograms, media: [], retainedMediaFiles: retained.length, retainedMediaSha256: sha256Bytes(JSON.stringify(retained)),
      changedPrograms: changed, changedExistingPrograms: changedExisting, changedAssets: manifest.assets.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))), addedPaths: added, candidate: nextCatalog.games.board
    };
    const files = new Map([
      ['release-inputs.json', jsonBytes(inputs)], ['desktop/catalog-v3.json', jsonBytes(nextCatalog)], [manifestPath, nextManifestBytes],
      ...[...programBytes].map(([relative, bytes]) => [`program-bytes/${relative}`, bytes]),
      ...[...webOnlyBytes].map(([relative, bytes]) => [`web-only-bytes/${relative}`, bytes])
    ]);
    assert.equal(git(['rev-parse', 'HEAD']).toString('utf8').trim(), sourceHead, 'HEAD changed during collection.');
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    return { inputs, files, manifestPath, manifest, catalog: nextCatalog, protectedFiles };
  }
  function verifyCandidate(value) {
    const directory = outputDirectory(value);
    const inputsPath = path.join(directory, 'release-inputs.json');
    rejectLinks(inputsPath);
    const inputs = checkedJson(fs.readFileSync(inputsPath), 'Candidate inputs');
    assert.equal(inputs.generator, GENERATOR, 'Unexpected candidate generator.');
    assert.equal(inputs.baseline, git(['rev-parse', `${baselineRef}^{commit}`]).toString('utf8').trim(), 'Unexpected candidate baseline.');
    const result = collect(inputs.createdAt);
    assert.equal(result.inputs.sourceHead, inputs.sourceHead, 'Git HEAD changed after candidate creation; build a fresh candidate.');
    assert.deepEqual(listFiles(directory), [...result.files.keys()].sort(comparePaths), 'Candidate has missing or unexpected files.');
    for (const [relative, bytes] of result.files) assert.ok(fs.readFileSync(path.join(directory, relative)).equals(bytes), `Candidate differs from committed source or baseline: ${relative}`);
    return result;
  }
  function promote(result) {
    for (const [relative, bytes] of result.protectedFiles) cleanFile(relative, bytes);
    immutableWrite(path.join(root, 'public', result.manifestPath), result.files.get(result.manifestPath));
    const target = path.join(root, CATALOG);
    const temporary = `${target}.${process.pid}.tmp`;
    assert.equal(fs.existsSync(temporary), false, 'Catalog temporary path already exists.');
    try {
      fs.writeFileSync(temporary, result.files.get('desktop/catalog-v3.json'), { flag: 'wx' });
      fs.renameSync(temporary, target);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    for (const [relative, bytes] of result.protectedFiles) if (relative !== CATALOG) cleanFile(relative, bytes);
    assert.ok(fs.readFileSync(target).equals(result.files.get('desktop/catalog-v3.json')), 'Promoted catalog readback differs.');
  }
  function main(argv = process.argv.slice(2)) {
    const options = parseArguments(argv);
    const directory = outputDirectory(options.output || options.candidate);
    let result;
    if (options.output) {
      assert.ok(!fs.existsSync(directory) || fs.readdirSync(directory).length === 0, 'Use a fresh empty candidate directory.');
      result = collect(new Date().toISOString());
      for (const [relative, bytes] of result.files) immutableWrite(path.join(directory, relative), bytes);
      result = verifyCandidate(directory);
    } else result = verifyCandidate(directory);
    if (options.promote) promote(result);
    console.log(JSON.stringify({ ok: true, promoted: options.promote, directory, sourceHead: result.inputs.sourceHead, baseline: result.inputs.baseline, checkedPrograms: result.inputs.programs.length, newMedia: result.inputs.media.length, retainedMediaFiles: result.inputs.retainedMediaFiles, changedPrograms: result.inputs.changedPrograms.map(asset => asset.path), candidate: result.inputs.candidate }));
    return result;
  }
  return { collect, outputDirectory, verifyCandidate, main };
}
function parseArguments(argv) {
  const options = { promote: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert.equal(seen.has(key), false, `Duplicate ${key}.`);
    seen.add(key);
    if (key === '--promote') options.promote = true;
    else if (['--output', '--candidate'].includes(key)) {
      assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'), `${key} requires a value.`);
      options[key.slice(2)] = argv[++index];
    } else throw new Error(`Unknown argument: ${key}`);
  }
  assert.ok(Boolean(options.output) !== Boolean(options.candidate), 'Use --output <external directory> OR --candidate <directory> [--promote].');
  assert.ok(!options.promote || options.candidate, '--promote requires a previously reviewed --candidate.');
  return options;
}
const formal = createBuilder();
if (require.main === module) {
  try { formal.main(); } catch (error) { console.error(`BOARD_AUDIO_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { ...formal, createBuilder, parseArguments, BASELINE, NEW_PROGRAMS, WEB_ONLY_PROGRAMS, CHANGED_PROGRAMS };
