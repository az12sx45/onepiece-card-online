'use strict';

// Offline, scoped Board program release. Default output is an external review
// candidate; only --candidate <reviewed-directory> --promote writes metadata.
// Existing media bytes, player data, caches, Git and network are never written.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes, classifyPath, comparePaths, validateCatalog, validateManifest } = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '4f4170331f0e323786f93dd8d7535e868985dc6d';
const CATALOG = 'public/desktop/catalog-v3.json';
const CONFIG = 'config/desktop-program-packages-v1.json';
const V2 = 'public/desktop/catalog-v2.json';
const GENERATOR = 'water-seven-ship-relief-release-v1';
const NEW_PROGRAMS = ['js/board_water_seven_depth.js', 'js/board_water_seven_depth_data.json'];
const BATTLE_PROGRAMS = ['board_water_seven.html'];
const REQUIRED_PROGRAMS = ['board_game.html', 'js/board_game.js', ...BATTLE_PROGRAMS].sort(comparePaths);
const ALLOWED_CHANGED_PROGRAMS = [...REQUIRED_PROGRAMS];
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
  assert.equal(MEDIA.has(type.kind), false, `Only program bytes may be packaged: ${relative}`);
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

// Factory overrides exist only for isolated Git fixtures. CLI has no root,
// baseline, count or change-list override and always uses the reviewed baseline.
function createBuilder(root = ROOT, baselineRef = BASELINE) {
  root = path.resolve(root);
  const git = args => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const head = () => git(['rev-parse', 'HEAD']).toString('utf8').trim();
  const readAt = (ref, relative) => git(['cat-file', 'blob', `${ref}:${relative}`]);
  function cleanFile(relative, expected) {
    const filename = path.join(root, relative);
    rejectLinks(filename);
    assert.ok(fs.statSync(filename).isFile(), `Missing regular protected file: ${relative}`);
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
    assert.ok(typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)), 'Invalid candidate time.');
    const sourceHead = head();
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
    assert.deepEqual(config, expectedConfig, 'Program allowlist must add exactly the two ship relief programs.');
    assert.equal(priorConfig.games.board.programFiles.length, 51, 'Expected 51 baseline Board programs.');
    assert.equal(config.games.board.programFiles.length, 53, 'Expected 53 candidate Board programs.');
    const protectedFiles = new Map([[CATALOG, baselineBytes], [V2, readAt(baseline, V2)]]);
    assert.equal(sha256Bytes(protectedFiles.get(V2)), config.legacyBaseline.catalogSha256, 'Legacy v2 baseline SHA');
    const legacyCatalog = checkedJson(protectedFiles.get(V2), 'Legacy catalog');
    const manifests = {};
    for (const game of ['card', 'board', 'chess']) {
      const relative = `public/${catalog.games[game].manifestPath}`;
      const bytes = readAt(baseline, relative);
      assert.equal(sha256Bytes(bytes), catalog.games[game].manifestSha256, `${game} manifest SHA`);
      const manifest = validateManifest(checkedJson(bytes, `${game} baseline manifest`), game);
      for (const key of ['releaseId', 'entryPath', 'totalFiles', 'totalBytes']) assert.equal(manifest[key], catalog.games[game][key], `${game} baseline ${key}`);
      manifests[game] = manifest;
      protectedFiles.set(relative, bytes);
      const legacyPath = `public/${legacyCatalog.games[game].manifestPath}`;
      const legacyBytes = readAt(baseline, legacyPath);
      assert.equal(sha256Bytes(legacyBytes), config.legacyBaseline.manifestSha256ByGame[game], `${game} legacy manifest SHA`);
      assert.equal(sha256Bytes(legacyBytes), legacyCatalog.games[game].manifestSha256, `${game} legacy catalog manifest SHA`);
      protectedFiles.set(legacyPath, legacyBytes);
    }
    for (const [relative, bytes] of protectedFiles) {
      assert.ok(readAt(sourceHead, relative).equals(bytes), `Protected metadata changed in HEAD: ${relative}`);
      cleanFile(relative, bytes);
    }
    protectedFiles.set(CONFIG, configBytes);
    cleanFile(CONFIG, configBytes);
    const previous = manifests.board;
    assert.equal(previous.totalFiles, 6361, 'Expected all 6,361 baseline Board records.');
    const retained = previous.assets.filter(asset => MEDIA.has(asset.kind));
    assert.equal(retained.length, 6310, 'Expected 6,310 retained Board media records.');
    assert.deepEqual(previous.assets.filter(asset => !MEDIA.has(asset.kind)).map(asset => asset.path), priorConfig.games.board.programFiles, 'Baseline Board programs differ from config.');
    assert.equal(previous.entryPath, config.games.board.entryPath, 'Board entry path');
    const names = config.games.board.programFiles;
    const sourcePaths = [CONFIG, ...names.map(name => `public/${name}`)];
    // Git diff respects checkout CRLF rules; payload bytes always come from HEAD.
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    for (const relative of sourcePaths) {
      const filename = path.join(root, relative);
      rejectLinks(filename);
      assert.ok(fs.statSync(filename).isFile(), `Missing regular source file: ${relative}`);
    }
    const changedInHead = new Set(git(['diff', '-z', '--name-only', '--no-renames', baseline, sourceHead, '--', 'public']).toString('utf8').split('\0').filter(Boolean));
    const protectedAssetPaths = new Set([...retained, ...manifests.card.assets, ...manifests.chess.assets].map(asset => `public/${asset.path}`));
    for (const relative of protectedAssetPaths) assert.equal(changedInHead.has(relative), false, `Protected existing asset changed in HEAD: ${relative}`);
    const allowedPublic = new Set([...NEW_PROGRAMS, ...ALLOWED_CHANGED_PROGRAMS].map(relative => `public/${relative}`));
    for (const relative of changedInHead) assert.ok(allowedPublic.has(relative), `Unreviewed public change in HEAD: ${relative}`);
    const programBytes = new Map();
    const programs = names.map(relative => {
      const bytes = readAt(sourceHead, `public/${relative}`);
      programBytes.set(relative, bytes);
      return record(relative, bytes);
    });
    // Retain every existing media record verbatim. No media source file is read,
    // copied or normalized, including unrelated dirty ranks and untracked art.
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, retained, programs), 'board');
    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    const changed = programs.filter(asset => oldByPath.has(asset.path) && canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)));
    const changedNames = changed.map(asset => asset.path);
    for (const relative of changedNames) assert.ok(ALLOWED_CHANGED_PROGRAMS.includes(relative), `Unreviewed changed program: ${relative}`);
    assert.deepEqual(changedNames, REQUIRED_PROGRAMS, 'Exactly the three reviewed ship page and cache-version programs must change.');
    const added = manifest.assets.filter(asset => !oldByPath.has(asset.path)).map(asset => asset.path);
    assert.deepEqual(added, NEW_PROGRAMS, 'Exactly two reviewed ship relief program paths must be added.');
    assert.equal(manifest.totalFiles, 6363, 'Candidate must preserve all 6,361 old paths and add two programs.');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of previous.assets) {
      assert.ok(nextByPath.has(asset.path), `Existing package path removed: ${asset.path}`);
      if (!ALLOWED_CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(nextByPath.get(asset.path), asset, `Existing package record changed: ${asset.path}`);
    }
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
      programs, retainedMediaFiles: retained.length, retainedMediaBytes: retained.reduce((sum, asset) => sum + asset.size, 0), retainedMediaSha256: sha256Bytes(JSON.stringify(retained)),
      allowedChangedPrograms: ALLOWED_CHANGED_PROGRAMS, changedPrograms: changed,
      changedAssets: manifest.assets.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))), addedPaths: added, candidate: nextCatalog.games.board
    };
    const files = new Map([
      ['release-inputs.json', jsonBytes(inputs)], ['desktop/catalog-v3.json', jsonBytes(nextCatalog)], [manifestPath, nextManifestBytes],
      ...[...programBytes].map(([relative, bytes]) => [`program-bytes/${relative}`, bytes])
    ]);
    assert.equal(head(), sourceHead, 'HEAD changed during collection.');
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    return { inputs, files, manifestPath, manifest, catalog: nextCatalog, protectedFiles, sourcePaths };
  }
  function verifyCandidate(value) {
    const directory = outputDirectory(value);
    const inputsPath = path.join(directory, 'release-inputs.json');
    rejectLinks(inputsPath);
    const inputs = checkedJson(fs.readFileSync(inputsPath), 'Candidate inputs');
    assert.equal(inputs.generator, GENERATOR, 'Unexpected candidate generator.');
    assert.equal(inputs.baseline, git(['rev-parse', `${baselineRef}^{commit}`]).toString('utf8').trim(), 'Unexpected candidate baseline.');
    assert.equal(head(), inputs.sourceHead, 'Git HEAD changed after candidate creation; build a fresh candidate.');
    const result = collect(inputs.createdAt);
    assert.deepEqual(listFiles(directory), [...result.files.keys()].sort(comparePaths), 'Candidate has missing or unexpected files.');
    for (const [relative, bytes] of result.files) assert.ok(fs.readFileSync(path.join(directory, relative)).equals(bytes), `Candidate differs from committed source or baseline: ${relative}`);
    return result;
  }
  function promote(result) {
    assert.equal(head(), result.inputs.sourceHead, 'Git HEAD changed before promotion.');
    git(['diff', '--quiet', 'HEAD', '--', ...result.sourcePaths]);
    for (const [relative, bytes] of result.protectedFiles) cleanFile(relative, bytes);
    const target = path.join(root, CATALOG);
    const temporary = `${target}.${process.pid}.tmp`;
    rejectLinks(temporary);
    assert.equal(fs.existsSync(temporary), false, 'Catalog temporary path already exists.');
    immutableWrite(path.join(root, 'public', result.manifestPath), result.files.get(result.manifestPath));
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
    console.log(JSON.stringify({ ok: true, promoted: options.promote, directory, sourceHead: result.inputs.sourceHead, baseline: result.inputs.baseline, checkedPrograms: result.inputs.programs.length, retainedMediaFiles: result.inputs.retainedMediaFiles, changedPrograms: result.inputs.changedPrograms.map(asset => asset.path), candidate: result.inputs.candidate }));
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
  try { formal.main(); } catch (error) { console.error(`WATER_SEVEN_SHIP_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { ...formal, createBuilder, parseArguments, BASELINE, NEW_PROGRAMS, REQUIRED_PROGRAMS, BATTLE_PROGRAMS, ALLOWED_CHANGED_PROGRAMS };
