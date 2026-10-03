'use strict';

// Build a Board-only island-intro candidate from the currently released package.
// Stage the reviewed JS and images first; candidate bytes must match Git's index.
// --dry-run is read-only; --promote writes only the Board manifest and catalog.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const {
  canonicalJson, sha256Bytes, classifyPath, comparePaths, validateCatalog, validateManifest,
} = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const CONFIG = 'config/desktop-program-packages-v1.json';
const CATALOG = 'public/desktop/catalog-v3.json';
const LEGACY_CATALOG = 'public/desktop/catalog-v2.json';
const LAUNCHER = 'public/desktop/launcher-release-v1.json';
const BASELINE_RELEASE = 'package-660f4c4369f9177b';
const BASELINE_MANIFEST_SHA = '0de8e2d5835f49e13d0063f997681c28a9a6d8af6541480bfb28f50d91143650';
const BASELINE_CATALOG_SHA = '4653657c75d7fa44560c0a1634180e2285a7cf9ff7272fa03d1953efe5a60485';
const GENERATOR = 'board-island-intro-release-v1';
const CHANGED_PROGRAM = 'js/board_game.js';
const IMAGE_DIRECTORY = 'images/board/story/backgrounds/island_intro';
const INTRO_NAMES = Object.freeze([
  'shop', 'hospital', 'tavern', 'mission', 'research_lab',
  'arena', 'water_seven', 'judicial', 'impel_down', 'marineford',
]);
const NEW_IMAGES = Object.freeze([
  ...INTRO_NAMES.map(name => `${IMAGE_DIRECTORY}/${name}.webp`),
  'images/board/story/speakers/luffy_pre_timeskip_enies.webp',
  'images/board/story/speakers/luffy_pre_timeskip_war.webp',
]);
const jsonBytes = value => Buffer.from(canonicalJson(value));

function rejectLinks(filename) {
  for (let current = filename; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Link is not accepted: ${current}`);
    if (path.dirname(current) === current) break;
  }
}

function checkedJson(bytes, label) {
  const value = JSON.parse(bytes.toString('utf8'));
  assert.ok(bytes.equals(jsonBytes(value)), `${label} is not canonical JSON.`);
  return value;
}

function within(parent, child) {
  const relative = path.relative(parent, child);
  return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
}

function outputDirectory(root, value) {
  assert.ok(typeof value === 'string' && path.isAbsolute(value), 'Candidate directory must be absolute.');
  const directory = path.resolve(value);
  assert.ok(!within(root, directory) && !within(directory, root), 'Candidate must be outside the source repository.');
  rejectLinks(directory);
  for (let current = directory; ; current = path.dirname(current)) {
    assert.equal(fs.existsSync(path.join(current, '.git')), false, 'Candidate must be outside every Git checkout.');
    if (path.dirname(current) === current) break;
  }
  if (fs.existsSync(directory)) assert.ok(fs.statSync(directory).isDirectory(), 'Candidate path is not a directory.');
  return directory;
}

function listFiles(directory, prefix = '') {
  rejectLinks(directory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    const relative = `${prefix}${entry.name}`;
    rejectLinks(filename);
    if (entry.isDirectory()) return listFiles(filename, `${relative}/`);
    assert.ok(entry.isFile(), `Unexpected candidate object: ${filename}`);
    return [relative];
  }).sort(comparePaths);
}

function immutableWrite(filename, bytes) {
  rejectLinks(filename);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  if (fs.existsSync(filename)) assert.ok(fs.readFileSync(filename).equals(bytes), `Existing immutable file differs: ${filename}`);
  else fs.writeFileSync(filename, bytes, { flag: 'wx' });
}

function parseArguments(argv) {
  const options = { dryRun: false, promote: false };
  const seen = new Set();
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert.ok(!seen.has(key), `Duplicate option: ${key}`);
    seen.add(key);
    if (key === '--dry-run') options.dryRun = true;
    else if (key === '--promote') options.promote = true;
    else if (key === '--output' || key === '--candidate') {
      const value = argv[++index];
      assert.ok(value && !value.startsWith('--'), `Missing path for ${key}.`);
      options[key.slice(2)] = value;
    } else throw new Error(`Unknown option: ${key}`);
  }
  if (options.dryRun) assert.ok(!options.promote && !options.output && !options.candidate, '--dry-run cannot write or promote.');
  else assert.ok(Boolean(options.output) !== Boolean(options.candidate), 'Use --output OR --candidate.');
  assert.ok(!options.promote || options.candidate, '--promote requires an existing --candidate.');
  return options;
}

function createBuilder(root = ROOT) {
  root = path.resolve(root);
  const git = args => execFileSync('git', args, {
    cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const head = () => git(['rev-parse', 'HEAD']).toString('utf8').trim();
  const at = (ref, filename) => git(['cat-file', 'blob', `${ref}:${filename}`]);
  const readLocal = filename => {
    const absolute = path.join(root, filename);
    rejectLinks(absolute);
    assert.ok(fs.statSync(absolute).isFile(), `Missing source: ${filename}`);
    return fs.readFileSync(absolute);
  };
  const clean = (filename, expected) => {
    const local = readLocal(filename);
    const windowsConfig = filename === CONFIG && local.toString('utf8').replace(/\r\n/g, '\n') === expected.toString('utf8');
    assert.ok(local.equals(expected) || windowsConfig, `Protected file differs from baseline: ${filename}`);
    git(['diff', '--quiet', 'HEAD', '--', filename]);
  };
  const reviewedProgram = (filename, committed) => {
    const local = readLocal(filename);
    const staged = git(['show', `:${filename}`]);
    assert.ok(!staged.equals(committed), `Stage reviewed program before building: ${filename}`);
    assert.ok(staged.equals(local), `Staged program differs from worktree bytes: ${filename}`);
    return staged;
  };

  function collect(createdAt) {
    assert.ok(typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)), 'Invalid creation time.');
    const sourceHead = head();
    const catalogBytes = at(sourceHead, CATALOG);
    assert.equal(sha256Bytes(catalogBytes), BASELINE_CATALOG_SHA, 'Baseline catalog changed.');
    const catalog = validateCatalog(checkedJson(catalogBytes, 'Baseline catalog'));
    assert.equal(catalog.games.board.releaseId, BASELINE_RELEASE, 'Public Board baseline release changed.');
    assert.equal(catalog.games.board.manifestSha256, BASELINE_MANIFEST_SHA, 'Public Board manifest identity changed.');
    assert.ok(Date.parse(createdAt) >= Date.parse(catalog.createdAt), 'Candidate predates baseline catalog.');

    const configBytes = at(sourceHead, CONFIG);
    const config = validateConfig(checkedJson(configBytes, 'Program config'));
    const legacy = checkedJson(at(sourceHead, LEGACY_CATALOG), 'Legacy catalog');
    const protectedFiles = new Map([
      [CONFIG, configBytes], [CATALOG, catalogBytes],
      [LEGACY_CATALOG, at(sourceHead, LEGACY_CATALOG)], [LAUNCHER, at(sourceHead, LAUNCHER)],
    ]);
    for (const game of Object.values(catalog.games)) {
      const filename = `public/${game.manifestPath}`;
      const bytes = at(sourceHead, filename);
      assert.equal(sha256Bytes(bytes), game.manifestSha256, `Manifest digest changed: ${filename}`);
      protectedFiles.set(filename, bytes);
    }
    for (const game of Object.values(legacy.games)) {
      const filename = `public/${game.manifestPath}`;
      protectedFiles.set(filename, at(sourceHead, filename));
    }
    for (const [filename, bytes] of protectedFiles) clean(filename, bytes);

    const previous = validateManifest(checkedJson(protectedFiles.get(`public/${catalog.games.board.manifestPath}`), 'Board baseline manifest'), 'board');
    for (const field of ['releaseId', 'entryPath', 'totalFiles', 'totalBytes']) {
      assert.equal(previous[field], catalog.games.board[field], `Baseline Board ${field} differs.`);
    }
    assert.equal(previous.entryPath, config.games.board.entryPath, 'Board entry path changed.');
    const programPaths = config.games.board.programFiles;
    assert.ok(programPaths.includes(CHANGED_PROGRAM), 'Reviewed Board script is absent from program config.');
    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    const payloads = new Map();
    const programs = [];
    for (const name of programPaths) {
      const filename = `public/${name}`;
      const committed = at(sourceHead, filename);
      const type = classifyPath(name);
      const old = oldByPath.get(name);
      assert.ok(type && old && committed.length, `Missing released program: ${name}`);
      assert.deepEqual({ path: name, kind: type.kind, mime: type.mime, size: committed.length, sha256: sha256Bytes(committed) }, old,
        `Committed program differs from public baseline: ${name}`);
      let bytes = committed;
      if (name === CHANGED_PROGRAM) {
        bytes = reviewedProgram(filename, committed);
        assert.ok(bytes.length && !bytes.equals(committed), 'Reviewed Board script has no local change.');
        payloads.set(`program-bytes/${name}`, bytes);
      } else {
        readLocal(filename);
        git(['diff', '--quiet', 'HEAD', '--', filename]);
      }
      programs.push({ path: name, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) });
    }
    assert.deepEqual(previous.assets.filter(asset => programPaths.includes(asset.path)).map(asset => asset.path), programPaths,
      'Baseline program inventory differs from config.');

    const imageFolder = path.join(root, 'public', IMAGE_DIRECTORY);
    rejectLinks(imageFolder);
    assert.deepEqual(fs.readdirSync(imageFolder).sort(comparePaths), INTRO_NAMES.map(name => `${name}.webp`).sort(comparePaths),
      'Island-intro directory contains missing or unreviewed files.');
    const newImages = NEW_IMAGES.map(name => {
      assert.ok(!oldByPath.has(name), `Image already exists in public Board package: ${name}`);
      const bytes = readLocal(`public/${name}`);
      assert.ok(git(['show', `:public/${name}`]).equals(bytes), `Stage reviewed image before building: ${name}`);
      assert.ok(bytes.length > 0 && bytes.length <= 8 * 1024 * 1024, `Unexpected image size: ${name}`);
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `Not a WebP image: ${name}`);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `Not a WebP image: ${name}`);
      const type = classifyPath(name);
      assert.equal(type?.kind, 'image', `Unexpected image path: ${name}`);
      payloads.set(`media-bytes/${name}`, bytes);
      return { path: name, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) };
    });
    const retained = previous.assets.filter(asset => !programPaths.includes(asset.path));
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, [...retained, ...newImages], programs), 'board');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const old of previous.assets) {
      if (old.path !== CHANGED_PROGRAM) assert.deepEqual(nextByPath.get(old.path), old, `Untouched asset record changed: ${old.path}`);
    }
    const changed = manifest.assets.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)))
      .map(asset => asset.path).sort(comparePaths);
    assert.deepEqual(changed, [CHANGED_PROGRAM, ...NEW_IMAGES].sort(comparePaths), 'Only reviewed Board assets may change.');
    assert.equal(manifest.totalFiles, previous.totalFiles + NEW_IMAGES.length, 'Board inventory count changed unexpectedly.');
    const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
    const manifestBytes = jsonBytes(manifest);
    assert.ok(manifestBytes.length <= 8 * 1024 * 1024, 'Package manifest exceeds launcher limit.');
    const nextBoard = {
      releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(manifestBytes),
      entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes,
    };
    const nextCatalog = validateCatalog({ ...catalog, createdAt, games: { ...catalog.games, board: nextBoard } });
    assert.deepEqual(nextCatalog.games.card, catalog.games.card, 'Card package changed.');
    assert.deepEqual(nextCatalog.games.chess, catalog.games.chess, 'Chess package changed.');
    assert.deepEqual(nextCatalog.sourceTrees, catalog.sourceTrees, 'Source trees changed.');
    assert.equal(nextCatalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl, 'Blob origin changed.');
    const inputs = {
      generator: GENERATOR, sourceHead, createdAt,
      baselineCatalogSha256: BASELINE_CATALOG_SHA,
      baselineBoardRelease: BASELINE_RELEASE, baselineBoardManifestSha256: BASELINE_MANIFEST_SHA,
      retainedAssetCount: retained.length, retainedAssetRecordsSha256: sha256Bytes(jsonBytes(retained)),
      changedProgram: nextByPath.get(CHANGED_PROGRAM), newImages, candidate: nextBoard,
    };
    const files = new Map([
      ['release-inputs.json', jsonBytes(inputs)],
      ['desktop/catalog-v3.json', jsonBytes(nextCatalog)],
      [manifestPath, manifestBytes], ...payloads,
    ]);
    assert.equal(head(), sourceHead, 'HEAD changed during candidate build.');
    for (const [filename, bytes] of protectedFiles) clean(filename, bytes);
    assert.ok(reviewedProgram(`public/${CHANGED_PROGRAM}`, at(sourceHead, `public/${CHANGED_PROGRAM}`))
      .equals(payloads.get(`program-bytes/${CHANGED_PROGRAM}`)), 'Reviewed Board script changed during collection.');
    for (const name of NEW_IMAGES) assert.ok(readLocal(`public/${name}`).equals(payloads.get(`media-bytes/${name}`)), `Image changed during collection: ${name}`);
    return { inputs, files, manifestPath, protectedFiles };
  }

  function verifyCandidate(value) {
    const directory = outputDirectory(root, value);
    const inputs = checkedJson(fs.readFileSync(path.join(directory, 'release-inputs.json')), 'Candidate inputs');
    assert.equal(inputs.generator, GENERATOR, 'Wrong release generator.');
    assert.equal(inputs.sourceHead, head(), 'HEAD changed since candidate build.');
    const expected = collect(inputs.createdAt);
    assert.deepEqual(listFiles(directory), [...expected.files.keys()].sort(comparePaths), 'Candidate inventory differs.');
    for (const [name, bytes] of expected.files) {
      assert.ok(fs.readFileSync(path.join(directory, name)).equals(bytes), `Candidate bytes differ: ${name}`);
    }
    return expected;
  }

  function promote(result) {
    assert.equal(head(), result.inputs.sourceHead, 'HEAD changed before promotion.');
    for (const [name, bytes] of result.protectedFiles) clean(name, bytes);
    for (const name of [CHANGED_PROGRAM, ...NEW_IMAGES]) {
      const candidatePath = `${name === CHANGED_PROGRAM ? 'program' : 'media'}-bytes/${name}`;
      const current = name === CHANGED_PROGRAM
        ? reviewedProgram(`public/${name}`, at(result.inputs.sourceHead, `public/${name}`))
        : readLocal(`public/${name}`);
      assert.ok(current.equals(result.files.get(candidatePath)), `Reviewed source changed before promotion: ${name}`);
    }
    immutableWrite(path.join(root, 'public', result.manifestPath), result.files.get(result.manifestPath));
    const target = path.join(root, CATALOG);
    const temporary = `${target}.${process.pid}.tmp`;
    rejectLinks(temporary);
    assert.ok(!fs.existsSync(temporary), 'Catalog temporary file exists.');
    try {
      fs.writeFileSync(temporary, result.files.get('desktop/catalog-v3.json'), { flag: 'wx' });
      fs.renameSync(temporary, target);
    } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
    assert.ok(fs.readFileSync(target).equals(result.files.get('desktop/catalog-v3.json')), 'Promoted catalog readback differs.');
    for (const [name, bytes] of result.protectedFiles) if (name !== CATALOG) clean(name, bytes);
  }

  function main(argv = process.argv.slice(2)) {
    const options = parseArguments(argv);
    if (options.dryRun) {
      const result = collect(new Date().toISOString());
      console.log(JSON.stringify({ ok: true, dryRun: true, ...result.inputs }));
      return result;
    }
    const directory = outputDirectory(root, options.output || options.candidate);
    if (options.output) {
      assert.ok(!fs.existsSync(directory) || fs.readdirSync(directory).length === 0, 'Use a fresh empty candidate directory.');
      const result = collect(new Date().toISOString());
      for (const [name, bytes] of result.files) immutableWrite(path.join(directory, name), bytes);
    }
    const result = verifyCandidate(directory);
    if (options.promote) promote(result);
    console.log(JSON.stringify({ ok: true, promoted: options.promote, directory, ...result.inputs }));
    return result;
  }

  return { collect, verifyCandidate, main, outputDirectory: value => outputDirectory(root, value) };
}

if (require.main === module) {
  try { createBuilder().main(); } catch (error) { console.error(`BOARD_ISLAND_INTRO_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}

module.exports = {
  createBuilder, parseArguments, BASELINE_RELEASE, BASELINE_MANIFEST_SHA,
  BASELINE_CATALOG_SHA, CHANGED_PROGRAM, INTRO_NAMES, NEW_IMAGES,
};
