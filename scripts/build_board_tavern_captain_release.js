'use strict';

// Build the captain-led tavern update from committed Board bytes only.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes, classifyPath, comparePaths, validateCatalog, validateManifest } = require('./desktop_program_package_common');

const BASELINE = '2afbda5358257cb6eac12edb957ca93ccd3ee817';
const BASELINE_RELEASE = 'package-1c453fcf83416d97';
const BASELINE_MANIFEST_SHA = 'f83c26dfb1d9e2bc74b864ebfd6afb67b939e73ed6ac6790462af098134f141e';
const CONFIG = 'config/desktop-program-packages-v1.json';
const CATALOG = 'public/desktop/catalog-v3.json';
const CHANGED_PROGRAMS = Object.freeze([
  'board_game.html',
  'css/board_tavern_reveal.css',
  'js/board_game.js',
  'js/board_tavern_crew.js',
  'js/board_tavern_reveal.js',
  'js/board_tavern_vfx.bundle.js',
]);
const ADDED_PROGRAMS = Object.freeze(['js/board_tavern_vfx.bundle.js']);
const MEDIA_PREFIX = 'images/board/tavern_recruit/crew_v3/';
const GENERATOR = 'board-tavern-captain-release-v4';
const bytesOf = value => Buffer.from(canonicalJson(value));

function validateMediaPaths(paths) {
  assert.ok(Array.isArray(paths) && paths.length >= 1 && paths.length <= 40, 'List 1-40 new crew_v3 WebP paths with --media.');
  const sorted = paths.slice().sort(comparePaths);
  assert.equal(new Set(sorted).size, sorted.length, 'Duplicate media path.');
  for (const name of sorted) {
    assert.match(name, /^images\/board\/tavern_recruit\/crew_v3\/[a-z0-9][a-z0-9_-]*\.webp$/, 'Only explicit crew_v3 WebP paths are allowed.');
  }
  return sorted;
}

function rejectLinks(filename) {
  for (let current = filename; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Links are not accepted: ${current}`);
    if (path.dirname(current) === current) break;
  }
}

function parseArguments(argv) {
  const options = { media: [] };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert.ok(['--output', '--candidate', '--promote', '--media'].includes(key), `Invalid option: ${key}`);
    if (key === '--promote') {
      assert.ok(!options.promote, 'Duplicate --promote.');
      options.promote = true;
      continue;
    }
    const value = argv[++index];
    assert.ok(value && !value.startsWith('--'), `Missing value for ${key}.`);
    if (key === '--media') options.media.push(value);
    else {
      assert.ok(!options[key], `Duplicate ${key}.`);
      options[key] = value;
    }
  }
  assert.ok(Boolean(options['--output']) !== Boolean(options['--candidate']), 'Use --output OR --candidate.');
  assert.ok(!options.promote || options['--candidate'], 'Promotion requires an existing candidate.');
  if (options['--output']) options.media = validateMediaPaths(options.media);
  else if (options.media.length) options.media = validateMediaPaths(options.media);
  return options;
}

function createBuilder(root = path.resolve(__dirname, '..'), baselineRef = BASELINE) {
  root = path.resolve(root);
  const git = args => execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
  const head = () => git(['rev-parse', 'HEAD']).toString('utf8').trim();
  const at = (ref, filename) => git(['cat-file', 'blob', `${ref}:${filename}`]);
  const jsonAt = (ref, filename) => JSON.parse(at(ref, filename));

  function clean(filename, expected) {
    const absolute = path.join(root, filename);
    rejectLinks(absolute);
    assert.ok(fs.statSync(absolute).isFile(), `Missing source: ${filename}`);
    const local = fs.readFileSync(absolute);
    const windowsConfig = filename === CONFIG && local.toString('utf8').replace(/\r\n/g, '\n') === expected.toString('utf8');
    assert.ok(local.equals(expected) || windowsConfig, `Metadata differs from committed baseline: ${filename}`);
    git(['diff', '--quiet', 'HEAD', '--', filename]);
  }

  function outputDirectory(value) {
    assert.ok(typeof value === 'string' && path.isAbsolute(value), 'Use an absolute candidate directory.');
    const directory = path.resolve(value);
    const contains = (parent, child) => {
      const relative = path.relative(parent, child);
      return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`));
    };
    assert.ok(!contains(root, directory) && !contains(directory, root), 'Candidate must be outside the repository.');
    rejectLinks(directory);
    for (let current = directory; ; current = path.dirname(current)) {
      assert.ok(!fs.existsSync(path.join(current, '.git')), 'Candidate must be outside every Git checkout.');
      if (path.dirname(current) === current) break;
    }
    return directory;
  }

  function collect(createdAt, requestedMedia) {
    assert.ok(typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)), 'Invalid creation time.');
    const mediaPaths = validateMediaPaths(requestedMedia);
    const sourceHead = head();
    const baseline = git(['rev-parse', `${baselineRef}^{commit}`]).toString('utf8').trim();
    git(['merge-base', '--is-ancestor', baseline, sourceHead]);
    const catalog = validateCatalog(jsonAt(baseline, CATALOG));
    assert.equal(catalog.games.board.releaseId, BASELINE_RELEASE, 'Unexpected baseline Board package.');
    assert.equal(catalog.games.board.manifestSha256, BASELINE_MANIFEST_SHA, 'Unexpected baseline manifest identity.');
    const previousBytes = at(baseline, `public/${catalog.games.board.manifestPath}`);
    assert.equal(sha256Bytes(previousBytes), BASELINE_MANIFEST_SHA, 'Baseline manifest SHA.');
    const previous = validateManifest(JSON.parse(previousBytes), 'board');
    assert.equal(previous.totalFiles, 6377, 'Unexpected baseline Board inventory.');
    const priorConfig = validateConfig(jsonAt(baseline, CONFIG));
    assert.equal(priorConfig.games.board.programFiles.length, 56, 'Unexpected baseline program inventory.');
    const currentConfig = validateConfig(jsonAt(sourceHead, CONFIG));
    const expectedConfig = JSON.parse(JSON.stringify(priorConfig));
    expectedConfig.games.board.programFiles = [...priorConfig.games.board.programFiles, ...ADDED_PROGRAMS].sort(comparePaths);
    assert.deepEqual(currentConfig, expectedConfig, 'Only the reviewed Board VFX bundle may be added to the program configuration.');
    clean(CONFIG, at(sourceHead, CONFIG));

    const legacyCatalog = jsonAt(baseline, 'public/desktop/catalog-v2.json');
    const protectedPaths = [
      CATALOG, 'public/desktop/catalog-v2.json', 'public/desktop/launcher-release-v1.json',
      ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`),
      ...Object.values(legacyCatalog.games).map(game => `public/${game.manifestPath}`),
    ];
    const protectedFiles = new Map();
    for (const filename of new Set(protectedPaths)) {
      const bytes = at(baseline, filename);
      assert.ok(at(sourceHead, filename).equals(bytes), `Protected metadata changed: ${filename}`);
      clean(filename, bytes);
      protectedFiles.set(filename, bytes);
    }

    const reviewed = [...CHANGED_PROGRAMS, ...mediaPaths].map(name => `public/${name}`).sort(comparePaths);
    const changedPublic = git(['diff', '--name-only', '-z', '--no-renames', baseline, sourceHead, '--', 'public'])
      .toString('utf8').split('\0').filter(Boolean).sort(comparePaths);
    assert.deepEqual(changedPublic, reviewed, 'Unexpected or missing public changes since the reviewed baseline.');
    const sourcePaths = [CONFIG, ...currentConfig.games.board.programFiles.map(name => `public/${name}`), ...mediaPaths.map(name => `public/${name}`)];
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);

    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    for (const name of mediaPaths) assert.ok(!oldByPath.has(name), `Media path already exists: ${name}`);
    const payloads = new Map();
    function record(logicalPath, media = false) {
      const filename = `public/${logicalPath}`;
      rejectLinks(path.join(root, filename));
      assert.ok(fs.statSync(path.join(root, filename)).isFile(), `Missing source: ${filename}`);
      const bytes = at(sourceHead, filename);
      const type = classifyPath(logicalPath);
      assert.ok(type && bytes.length, `Invalid source: ${logicalPath}`);
      if (media) {
        assert.equal(type.kind, 'image');
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `Invalid WebP: ${logicalPath}`);
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `Invalid WebP: ${logicalPath}`);
      }
      payloads.set(`${media ? 'media' : 'program'}-bytes/${logicalPath}`, bytes);
      return { path: logicalPath, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) };
    }
    const oldPrograms = new Set(priorConfig.games.board.programFiles);
    const retainedMedia = previous.assets.filter(asset => !oldPrograms.has(asset.path));
    assert.equal(retainedMedia.length, 6321, 'All live Board media records must be retained.');
    const programs = currentConfig.games.board.programFiles.map(name => record(name));
    const media = mediaPaths.map(name => record(name, true));
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, [...retainedMedia, ...media], programs), 'board');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of previous.assets) {
      if (!CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(nextByPath.get(asset.path), asset, `Existing record changed: ${asset.path}`);
    }
    const changedPrograms = programs.filter(asset => canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)))
      .map(asset => asset.path).sort(comparePaths);
    assert.deepEqual(changedPrograms, [...CHANGED_PROGRAMS].sort(comparePaths), 'Every reviewed program must change, and no other program may change.');
    assert.equal(manifest.totalFiles, previous.totalFiles + mediaPaths.length + ADDED_PROGRAMS.length, 'Unexpected final Board inventory.');
    const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
    const manifestBytes = bytesOf(manifest);
    const candidate = {
      releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(manifestBytes),
      entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes,
    };
    const nextCatalog = validateCatalog({ ...catalog, createdAt, games: { ...catalog.games, board: candidate } });
    assert.deepEqual(nextCatalog.games.card, catalog.games.card, 'Card package changed.');
    assert.deepEqual(nextCatalog.games.chess, catalog.games.chess, 'Chess package changed.');
    const inputs = {
      generator: GENERATOR, baseline, sourceHead, createdAt, baselineBoardRelease: previous.releaseId,
      retainedMediaFiles: retainedMedia.length, retainedMediaSha256: sha256Bytes(bytesOf(retainedMedia)),
      changedPrograms: CHANGED_PROGRAMS, addedPrograms: ADDED_PROGRAMS, mediaPaths,
      changedAssets: manifest.assets.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))),
      candidate,
    };
    const files = new Map([
      ['release-inputs.json', bytesOf(inputs)], ['desktop/catalog-v3.json', bytesOf(nextCatalog)],
      [manifestPath, manifestBytes], ...payloads,
    ]);
    assert.equal(head(), sourceHead, 'HEAD changed during collection.');
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    return { inputs, files, sourcePaths, protectedFiles, manifestPath };
  }

  function immutableWrite(filename, bytes) {
    rejectLinks(filename);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    if (fs.existsSync(filename)) assert.ok(fs.readFileSync(filename).equals(bytes), `Existing immutable file differs: ${filename}`);
    else fs.writeFileSync(filename, bytes, { flag: 'wx' });
  }

  function verifyCandidate(value, expectedMedia = []) {
    const directory = outputDirectory(value);
    const inputs = JSON.parse(fs.readFileSync(path.join(directory, 'release-inputs.json')));
    assert.equal(inputs.generator, GENERATOR, 'Wrong release generator.');
    const mediaPaths = validateMediaPaths(inputs.mediaPaths);
    assert.deepEqual(inputs.mediaPaths, mediaPaths, 'Candidate media paths must be sorted.');
    if (expectedMedia.length) assert.deepEqual(mediaPaths, validateMediaPaths(expectedMedia), 'Candidate media list differs from --media arguments.');
    assert.equal(inputs.sourceHead, head(), 'HEAD changed; build a new candidate.');
    const result = collect(inputs.createdAt, mediaPaths);
    const actual = [];
    function walk(location, prefix = '') {
      rejectLinks(location);
      for (const entry of fs.readdirSync(location, { withFileTypes: true })) {
        const absolute = path.join(location, entry.name);
        rejectLinks(absolute);
        if (entry.isDirectory()) walk(absolute, `${prefix}${entry.name}/`);
        else { assert.ok(entry.isFile(), `Unexpected candidate object: ${absolute}`); actual.push(prefix + entry.name); }
      }
    }
    walk(directory);
    assert.deepEqual(actual.sort(comparePaths), [...result.files.keys()].sort(comparePaths), 'Candidate inventory differs.');
    for (const [relative, bytes] of result.files) assert.ok(fs.readFileSync(path.join(directory, relative)).equals(bytes), `Candidate bytes differ: ${relative}`);
    return result;
  }

  function main(argv = process.argv.slice(2)) {
    const options = parseArguments(argv);
    const directory = outputDirectory(options['--output'] || options['--candidate']);
    if (options['--output']) {
      assert.ok(!fs.existsSync(directory) || fs.readdirSync(directory).length === 0, 'Use a fresh candidate directory.');
      for (const [relative, bytes] of collect(new Date().toISOString(), options.media).files) immutableWrite(path.join(directory, relative), bytes);
    }
    const result = verifyCandidate(directory, options.media);
    if (options.promote) {
      assert.equal(head(), result.inputs.sourceHead, 'HEAD changed before promotion.');
      git(['diff', '--quiet', 'HEAD', '--', ...result.sourcePaths]);
      for (const [filename, bytes] of result.protectedFiles) clean(filename, bytes);
      immutableWrite(path.join(root, 'public', result.manifestPath), result.files.get(result.manifestPath));
      const target = path.join(root, CATALOG);
      const temporary = `${target}.${process.pid}.tmp`;
      rejectLinks(temporary);
      assert.ok(!fs.existsSync(temporary), 'Unexpected catalog temporary file.');
      try {
        fs.writeFileSync(temporary, result.files.get('desktop/catalog-v3.json'), { flag: 'wx' });
        fs.renameSync(temporary, target);
      } finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
      assert.ok(fs.readFileSync(target).equals(result.files.get('desktop/catalog-v3.json')), 'Promoted catalog readback failed.');
      for (const [filename, bytes] of result.protectedFiles) if (filename !== CATALOG) clean(filename, bytes);
    }
    console.log(JSON.stringify({ ok: true, promoted: Boolean(options.promote), directory, ...result.inputs }));
    return result;
  }
  return { collect, main, outputDirectory, verifyCandidate };
}

if (require.main === module) {
  try { createBuilder().main(); } catch (error) { console.error(`BOARD_TAVERN_CAPTAIN_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { createBuilder, parseArguments, validateMediaPaths, BASELINE, BASELINE_RELEASE, BASELINE_MANIFEST_SHA, CHANGED_PROGRAMS, ADDED_PROGRAMS, MEDIA_PREFIX };
