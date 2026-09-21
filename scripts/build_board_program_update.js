'use strict';

// Scoped Board program releases preserve the deployed v3 media inventory.
// Build an external candidate from committed bytes, verify it, then promote.
// This tool never uploads, pushes, rebuilds v2, or reads/writes player saves.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes, classifyPath, validateCatalog, validateManifest } = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const CATALOG = 'public/desktop/catalog-v3.json';
const CONFIG = 'config/desktop-program-packages-v1.json';
const V2 = 'public/desktop/catalog-v2.json';
const GENERATOR = 'board-program-update-v1';
const MEDIA = new Set(['image', 'audio', 'video', 'font']);
const git = args => execFileSync('git', args, { cwd: ROOT, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const readAt = (ref, relative) => git(['cat-file', 'blob', `${ref}:${relative}`]);
const parse = bytes => JSON.parse(bytes.toString('utf8'));
const jsonBytes = value => Buffer.from(canonicalJson(value));
const within = (parent, target) => { const relative = path.relative(parent, target); return !relative || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)); };

function rejectLinks(target) {
  for (let current = target; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Links/junctions are not accepted: ${current}`);
    if (path.dirname(current) === current) break;
  }
}

function outputDirectory(value) {
  assert.ok(value && path.isAbsolute(value), 'Candidate path must be absolute.');
  const directory = path.resolve(value);
  assert.ok(!within(ROOT, directory) && !within(directory, ROOT), 'Candidate must be outside the repository.');
  rejectLinks(directory);
  for (let current = directory; ; current = path.dirname(current)) {
    assert.equal(fs.existsSync(path.join(current, '.git')), false, 'Candidate must be outside every Git worktree.');
    if (path.dirname(current) === current) break;
  }
  if (fs.existsSync(directory)) assert.ok(fs.statSync(directory).isDirectory(), 'Candidate path is not a directory.');
  return directory;
}

function checkedJson(bytes, label) {
  const value = parse(bytes);
  assert.ok(bytes.equals(jsonBytes(value)), `${label} must use canonical JSON.`);
  return value;
}

function cleanPublicFile(relative, expected) {
  const filename = path.join(ROOT, relative);
  rejectLinks(filename);
  const actual = fs.readFileSync(filename);
  assert.ok(actual.equals(expected), `Uncommitted metadata differs: ${relative}`);
}

function collect(baselineRef, createdAt) {
  const sourceHead = git(['rev-parse', 'HEAD']).toString('utf8').trim();
  const baseline = git(['rev-parse', '--verify', `${baselineRef}^{commit}`]).toString('utf8').trim();
  git(['merge-base', '--is-ancestor', baseline, sourceHead]);
  assert.ok(Number.isFinite(Date.parse(createdAt)), 'Invalid candidate time.');
  const baselineBytes = readAt(baseline, CATALOG);
  const catalog = validateCatalog(checkedJson(baselineBytes, 'Baseline catalog'));
  assert.ok(readAt(sourceHead, CATALOG).equals(baselineBytes), 'HEAD catalog has changed since baseline.');
  cleanPublicFile(CATALOG, baselineBytes);
  const configBytes = readAt(sourceHead, CONFIG);
  const config = validateConfig(checkedJson(configBytes, 'Program config'));
  assert.ok(configBytes.equals(readAt(baseline, CONFIG)), 'This update cannot add/remove configured programs.');
  cleanPublicFile(CONFIG, configBytes);
  const v2Bytes = readAt(baseline, V2);
  assert.ok(readAt(sourceHead, V2).equals(v2Bytes), 'HEAD legacy v2 catalog changed.');
  assert.equal(sha256Bytes(v2Bytes), config.legacyBaseline.catalogSha256, 'Legacy v2 baseline SHA');
  cleanPublicFile(V2, v2Bytes);
  const manifestBytes = readAt(baseline, `public/${catalog.games.board.manifestPath}`);
  assert.equal(sha256Bytes(manifestBytes), catalog.games.board.manifestSha256, 'Baseline Board manifest SHA');
  const previous = validateManifest(checkedJson(manifestBytes, 'Baseline Board manifest'), 'board');
  for (const key of ['releaseId', 'entryPath', 'totalFiles', 'totalBytes']) assert.equal(previous[key], catalog.games.board[key], `Baseline Board ${key}`);
  assert.equal(previous.entryPath, config.games.board.entryPath, 'Board entry path');
  const protectedFiles = new Map([[CATALOG, baselineBytes], [CONFIG, configBytes], [V2, v2Bytes]]);
  for (const game of ['card', 'board', 'chess']) {
    const relative = `public/${catalog.games[game].manifestPath}`;
    const bytes = readAt(baseline, relative);
    assert.equal(sha256Bytes(bytes), catalog.games[game].manifestSha256, `${game} manifest SHA`);
    assert.ok(readAt(sourceHead, relative).equals(bytes), `${game} baseline manifest changed in HEAD.`);
    cleanPublicFile(relative, bytes);
    protectedFiles.set(relative, bytes);
  }
  const names = config.games.board.programFiles;
  const previousPrograms = previous.assets.filter(asset => !MEDIA.has(asset.kind)).map(asset => asset.path);
  assert.deepEqual(previousPrograms, names, 'Configured program paths must exactly match the v3 program inventory.');
  // Git's diff accounts for checkout line-ending conversion; hashes below always
  // use the committed blob, so a Windows checkout cannot alter Linux delivery.
  git(['diff', '--quiet', 'HEAD', '--', CONFIG, ...names.map(relative => `public/${relative}`)]);
  const programBytes = new Map();
  const programs = names.map(relative => {
    const type = classifyPath(relative);
    assert.ok(type && !MEDIA.has(type.kind), `Invalid program type: ${relative}`);
    const bytes = readAt(sourceHead, `public/${relative}`);
    assert.ok(bytes.length, `Empty committed program: ${relative}`);
    programBytes.set(relative, bytes);
    return { path: relative, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) };
  });
  const retained = previous.assets.filter(asset => MEDIA.has(asset.kind));
  const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, retained, programs), 'board');
  assert.deepEqual(manifest.assets.map(asset => asset.path), previous.assets.map(asset => asset.path), 'Board asset paths changed.');
  assert.deepEqual(manifest.assets.filter(asset => MEDIA.has(asset.kind)), retained, 'Existing media changed.');
  assert.equal(manifest.totalFiles, previous.totalFiles, 'Board file count changed.');
  if (manifest.releaseId === previous.releaseId) manifest.createdAt = previous.createdAt;
  const nextManifestBytes = jsonBytes(manifest);
  const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
  const nextCatalog = validateCatalog({ ...catalog, createdAt: manifest.releaseId === previous.releaseId ? catalog.createdAt : createdAt, games: { ...catalog.games, board: {
    releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(nextManifestBytes), entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes
  } } });
  for (const game of ['card', 'chess']) assert.deepEqual(nextCatalog.games[game], catalog.games[game], `${game} catalog changed.`);
  assert.deepEqual(nextCatalog.sourceTrees, catalog.sourceTrees, 'Media source trees changed.');
  assert.equal(nextCatalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl, 'Asset origin changed.');
  const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
  const changed = programs.filter(asset => canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)));
  const inputs = {
    generator: GENERATOR, baseline, sourceHead, createdAt,
    baselineBoardRelease: previous.releaseId,
    protected: [...protectedFiles].map(([relative, bytes]) => ({ path: relative, size: bytes.length, sha256: sha256Bytes(bytes) })),
    programs, retainedMediaFiles: retained.length, retainedMediaSha256: sha256Bytes(JSON.stringify(retained)),
    changedPrograms: changed, candidate: nextCatalog.games.board
  };
  const files = new Map([
    ['release-inputs.json', jsonBytes(inputs)],
    ['desktop/catalog-v3.json', jsonBytes(nextCatalog)],
    [manifestPath, nextManifestBytes],
    ...[...programBytes].map(([relative, bytes]) => [`program-bytes/${relative}`, bytes])
  ]);
  return { inputs, files, manifestPath, manifest, catalog: nextCatalog, protectedFiles };
}

function immutableWrite(filename, bytes) {
  rejectLinks(filename);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  if (fs.existsSync(filename)) assert.ok(fs.readFileSync(filename).equals(bytes), `Refusing to overwrite different candidate/immutable bytes: ${filename}`);
  else fs.writeFileSync(filename, bytes, { flag: 'wx' });
}

function verifyCandidate(directory) {
  const inputsPath = path.join(directory, 'release-inputs.json');
  rejectLinks(inputsPath);
  const inputs = checkedJson(fs.readFileSync(inputsPath), 'Candidate inputs');
  assert.equal(inputs.generator, GENERATOR, 'Unexpected candidate generator.');
  assert.match(inputs.baseline, /^[a-f0-9]{40}$/);
  assert.match(inputs.sourceHead, /^[a-f0-9]{40}$/);
  const result = collect(inputs.baseline, inputs.createdAt);
  assert.equal(result.inputs.sourceHead, inputs.sourceHead, 'Git HEAD changed after candidate creation; build a fresh candidate.');
  for (const [relative, bytes] of result.files) {
    const filename = path.join(directory, relative);
    rejectLinks(filename);
    assert.ok(fs.readFileSync(filename).equals(bytes), `Candidate differs from committed source or baseline: ${relative}`);
  }
  return result;
}

function promote(result) {
  assert.ok(result.inputs.changedPrograms.length, 'There are no program changes to promote.');
  // Recheck all protected inputs immediately before either public metadata write.
  for (const [relative, bytes] of result.protectedFiles) cleanPublicFile(relative, bytes);
  immutableWrite(path.join(ROOT, 'public', result.manifestPath), result.files.get(result.manifestPath));
  const target = path.join(ROOT, CATALOG);
  const temporary = `${target}.${process.pid}.tmp`;
  assert.equal(fs.existsSync(temporary), false, 'Catalog temporary path already exists.');
  try {
    fs.writeFileSync(temporary, result.files.get('desktop/catalog-v3.json'), { flag: 'wx' });
    fs.renameSync(temporary, target);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  for (const [relative, bytes] of result.protectedFiles) if (relative !== CATALOG) cleanPublicFile(relative, bytes);
  assert.ok(fs.readFileSync(target).equals(result.files.get('desktop/catalog-v3.json')), 'Promoted catalog readback differs.');
}

function parseArguments(argv) {
  const options = { baseline: 'HEAD', promote: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert.equal(seen.has(key), false, `Duplicate ${key}.`);
    seen.add(key);
    if (key === '--promote') options.promote = true;
    else if (['--output', '--candidate', '--baseline'].includes(key)) {
      assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'), `${key} requires a value.`);
      options[key.slice(2)] = argv[++index];
    } else throw new Error(`Unknown argument: ${key}`);
  }
  assert.ok(Boolean(options.output) !== Boolean(options.candidate), 'Use --output <external directory> [--baseline SHA] OR --candidate <directory> [--promote].');
  assert.ok(!options.promote || options.candidate, '--promote requires a previously reviewed --candidate.');
  assert.ok(!options.candidate || options.baseline === 'HEAD', '--baseline is only valid with --output.');
  return options;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  const directory = outputDirectory(options.output || options.candidate);
  let result;
  if (options.output) {
    assert.ok(!fs.existsSync(directory) || fs.readdirSync(directory).length === 0, 'Use a fresh empty candidate directory.');
    result = collect(options.baseline, new Date().toISOString());
    for (const [relative, bytes] of result.files) immutableWrite(path.join(directory, relative), bytes);
    verifyCandidate(directory);
  } else result = verifyCandidate(directory);
  if (options.promote) promote(result);
  console.log(JSON.stringify({ ok: true, promoted: options.promote, directory, sourceHead: result.inputs.sourceHead, baseline: result.inputs.baseline, checkedPrograms: result.inputs.programs.length, retainedMediaFiles: result.inputs.retainedMediaFiles, changedPrograms: result.inputs.changedPrograms.map(asset => asset.path), candidate: result.inputs.candidate }));
  return result;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`BOARD_PROGRAM_UPDATE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { collect, outputDirectory, verifyCandidate, parseArguments, main };
