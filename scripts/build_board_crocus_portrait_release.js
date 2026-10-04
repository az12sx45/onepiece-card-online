'use strict';

// Build an image-only Board package from the currently published Crocus package.
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
const BASELINE_RELEASE = 'package-4f3c87d6ae495974';
const BASELINE_MANIFEST_SHA = '2ddba755d4c8cd2503c2d9c723dc2e2eede61e775b467655ff0471136ba934ad';
const BASELINE_CATALOG_SHA = 'e29bf6d1611e9d7692de705c58a15d96727388052f52550b19f9de0395fdb24c';
const GENERATOR = 'board-crocus-portrait-release-v1';
const IMAGE = 'images/board/story/speakers/island_intro_crocus.webp';
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
    readLocal(filename);
    git(['diff', '--quiet', 'HEAD', '--', filename]);
    assert.ok(at(head(), filename).equals(expected), `Protected HEAD bytes changed: ${filename}`);
  };
  const reviewedImage = (filename, committed) => {
    const local = readLocal(filename);
    git(['diff', '--quiet', '--', filename]);
    const stagedId = git(['rev-parse', `:${filename}`]).toString('utf8').trim();
    const staged = git(['cat-file', 'blob', stagedId]);
    assert.ok(!staged.equals(committed), `Stage the reviewed portrait change: ${filename}`);
    assert.ok(local.equals(staged), `Unstaged portrait bytes differ: ${filename}`);
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
    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    const programs = programPaths.map(name => {
      const filename = `public/${name}`;
      const committed = at(sourceHead, filename);
      const type = classifyPath(name);
      const old = oldByPath.get(name);
      assert.ok(type && old && committed.length, `Missing released program: ${name}`);
      assert.deepEqual({ path: name, kind: type.kind, mime: type.mime, size: committed.length, sha256: sha256Bytes(committed) }, old,
        `Committed program differs from public baseline: ${name}`);
      clean(filename, committed);
      return old;
    });
    assert.deepEqual(previous.assets.filter(asset => programPaths.includes(asset.path)).map(asset => asset.path), programPaths,
      'Baseline program inventory differs from config.');

    const oldImage = oldByPath.get(IMAGE);
    assert.ok(oldImage && oldImage.kind === 'image' && oldImage.mime === 'image/webp', 'Crocus portrait is absent from the public package.');
    const filename = `public/${IMAGE}`;
    const committedImage = at(sourceHead, filename);
    assert.equal(committedImage.length, oldImage.size, 'Committed Crocus portrait size differs from public baseline.');
    assert.equal(sha256Bytes(committedImage), oldImage.sha256, 'Committed Crocus portrait SHA differs from public baseline.');
    const imageBytes = reviewedImage(filename, committedImage);
    assert.ok(imageBytes.length > 0 && imageBytes.length <= 8 * 1024 * 1024, 'Unexpected Crocus portrait size.');
    assert.equal(imageBytes.toString('ascii', 0, 4), 'RIFF', 'Crocus portrait is not WebP.');
    assert.equal(imageBytes.toString('ascii', 8, 12), 'WEBP', 'Crocus portrait is not WebP.');
    const image = { ...oldImage, size: imageBytes.length, sha256: sha256Bytes(imageBytes) };
    assert.notEqual(image.sha256, oldImage.sha256, 'Crocus portrait digest did not change.');

    const retained = previous.assets.filter(asset => !programPaths.includes(asset.path) && asset.path !== IMAGE);
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, [...retained, image], programs), 'board');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const old of previous.assets) {
      if (old.path !== IMAGE) assert.deepEqual(nextByPath.get(old.path), old, `Untouched asset record changed: ${old.path}`);
    }
    const changed = manifest.assets.filter(asset => canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)))
      .map(asset => asset.path).sort(comparePaths);
    assert.deepEqual(changed, [IMAGE], 'Only the reviewed Crocus portrait may change.');
    assert.equal(manifest.totalFiles, previous.totalFiles, 'Board inventory count changed unexpectedly.');
    assert.equal(manifest.totalBytes, previous.totalBytes - oldImage.size + image.size, 'Board byte total changed unexpectedly.');

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
      replacedImageBefore: oldImage, replacedImageAfter: image, candidate: nextBoard,
    };
    const files = new Map([
      ['release-inputs.json', jsonBytes(inputs)],
      ['desktop/catalog-v3.json', jsonBytes(nextCatalog)],
      [manifestPath, manifestBytes],
      [`media-bytes/${IMAGE}`, imageBytes],
    ]);
    assert.equal(head(), sourceHead, 'HEAD changed during candidate build.');
    for (const [name, bytes] of protectedFiles) clean(name, bytes);
    for (const name of programPaths) clean(`public/${name}`, at(sourceHead, `public/${name}`));
    assert.ok(reviewedImage(filename, committedImage).equals(imageBytes), 'Reviewed portrait changed during collection.');
    return { inputs, files, manifestPath, protectedFiles, programPaths, committedImage };
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
    for (const name of result.programPaths) clean(`public/${name}`, at(result.inputs.sourceHead, `public/${name}`));
    assert.ok(reviewedImage(`public/${IMAGE}`, result.committedImage).equals(result.files.get(`media-bytes/${IMAGE}`)),
      'Reviewed portrait changed before promotion.');
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
  try { createBuilder().main(); } catch (error) { console.error(`BOARD_CROCUS_PORTRAIT_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}

module.exports = {
  createBuilder, parseArguments, BASELINE_RELEASE, BASELINE_MANIFEST_SHA,
  BASELINE_CATALOG_SHA, IMAGE,
};
