'use strict';

// Preserve the live tavern v1 package while adding the reviewed crew reactions.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes, classifyPath, comparePaths, validateCatalog, validateManifest } = require('./desktop_program_package_common');

const BASELINE = '6dc1fcf32c13225e108b32767251c20098eefed4';
const BASELINE_RELEASE = 'package-b5eaebdecfaee7d6';
const BASELINE_MANIFEST_SHA = '0502fba41c3e97236d1ec832d7e1b36e58e3e323ba877f8211dc424c6bac4b82';
const CONFIG = 'config/desktop-program-packages-v1.json';
const CATALOG = 'public/desktop/catalog-v3.json';
const NEW_PROGRAMS = ['js/board_tavern_crew.js'];
const CHANGED_PROGRAMS = ['board_game.html', 'css/board_tavern_reveal.css', 'js/board_game.js', 'js/board_tavern_reveal.js'];
const NEW_MEDIA = ['images/board/tavern_recruit/crew_v2/brook_accept.webp', 'images/board/tavern_recruit/crew_v2/brook_invite.webp', 'images/board/tavern_recruit/crew_v2/chopper_accept.webp', 'images/board/tavern_recruit/crew_v2/chopper_invite.webp', 'images/board/tavern_recruit/crew_v2/nami_accept.webp', 'images/board/tavern_recruit/crew_v2/nami_decline.webp', 'images/board/tavern_recruit/crew_v2/nami_invite.webp', 'images/board/tavern_recruit/crew_v2/sanji_accept.webp'];
const GENERATOR = 'board-tavern-crew-release-v2';
const bytesOf = value => Buffer.from(canonicalJson(value));

function rejectLinks(filename) {
  for (let current = filename; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Links are not accepted: ${current}`);
    if (path.dirname(current) === current) break;
  }
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
    assert.ok(fs.readFileSync(absolute).equals(expected), `Metadata differs from committed baseline: ${filename}`);
  }
  function outputDirectory(value) {
    assert.ok(typeof value === 'string' && path.isAbsolute(value), 'Use an absolute candidate directory.');
    const directory = path.resolve(value);
    const contains = (parent, child) => { const relative = path.relative(parent, child); return !relative || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`)); };
    assert.ok(!contains(root, directory) && !contains(directory, root), 'Candidate must be outside the repository.');
    rejectLinks(directory);
    for (let current = directory; ; current = path.dirname(current)) {
      assert.ok(!fs.existsSync(path.join(current, '.git')), 'Candidate must be outside every Git checkout.');
      if (path.dirname(current) === current) break;
    }
    return directory;
  }
  function collect(createdAt) {
    assert.ok(typeof createdAt === 'string' && Number.isFinite(Date.parse(createdAt)), 'Invalid creation time.');
    const sourceHead = head();
    const baseline = git(['rev-parse', `${baselineRef}^{commit}`]).toString('utf8').trim();
    git(['merge-base', '--is-ancestor', baseline, sourceHead]);
    const catalog = validateCatalog(jsonAt(baseline, CATALOG));
    assert.equal(catalog.games.board.releaseId, BASELINE_RELEASE, 'Unexpected baseline Board package.');
    assert.equal(catalog.games.board.manifestSha256, BASELINE_MANIFEST_SHA, 'Unexpected baseline manifest identity.');
    const previousBytes = at(baseline, `public/${catalog.games.board.manifestPath}`);
    assert.equal(sha256Bytes(previousBytes), BASELINE_MANIFEST_SHA, 'Baseline manifest SHA.');
    const previous = validateManifest(JSON.parse(previousBytes), 'board');
    assert.equal(previous.totalFiles, 6368, 'Unexpected baseline Board inventory.');
    const priorConfig = validateConfig(jsonAt(baseline, CONFIG));
    assert.equal(priorConfig.games.board.programFiles.length, 55, 'Unexpected baseline program inventory.');
    const config = validateConfig(jsonAt(sourceHead, CONFIG));
    const expectedConfig = JSON.parse(JSON.stringify(priorConfig));
    expectedConfig.games.board.programFiles.push(...NEW_PROGRAMS);
    expectedConfig.games.board.programFiles.sort(comparePaths);
    assert.deepEqual(config, expectedConfig, 'Only the crew program may be added to the allowlist.');

    const protectedFiles = new Map();
    const legacyCatalog = jsonAt(baseline, 'public/desktop/catalog-v2.json');
    const protectedPaths = [CATALOG, 'public/desktop/catalog-v2.json', 'public/desktop/launcher-release-v1.json', ...Object.values(catalog.games).map(game => `public/${game.manifestPath}`), ...Object.values(legacyCatalog.games).map(game => `public/${game.manifestPath}`)];
    for (const filename of protectedPaths) {
      const bytes = at(baseline, filename);
      assert.ok(at(sourceHead, filename).equals(bytes), `Protected metadata changed: ${filename}`);
      clean(filename, bytes);
      protectedFiles.set(filename, bytes);
    }
    const sourcePaths = [CONFIG, ...config.games.board.programFiles.map(name => `public/${name}`), ...NEW_MEDIA.map(name => `public/${name}`)];
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    const reviewed = [...CHANGED_PROGRAMS, ...NEW_PROGRAMS, ...NEW_MEDIA].map(name => `public/${name}`).sort(comparePaths);
    const changedPublic = git(['diff', '--name-only', '-z', '--no-renames', baseline, sourceHead, '--', 'public']).toString('utf8').split('\0').filter(Boolean).sort(comparePaths);
    assert.deepEqual(changedPublic, reviewed, 'Unexpected or missing public changes since the reviewed baseline.');
    const payloads = new Map();
    function record(logicalPath) {
      const filename = `public/${logicalPath}`;
      rejectLinks(path.join(root, filename));
      assert.ok(fs.statSync(path.join(root, filename)).isFile(), `Missing source: ${filename}`);
      const bytes = at(sourceHead, filename);
      const type = classifyPath(logicalPath);
      assert.ok(type && bytes.length, `Invalid source: ${logicalPath}`);
      if (NEW_MEDIA.includes(logicalPath)) {
        assert.equal(type.kind, 'image');
        assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `Invalid WebP: ${logicalPath}`);
        assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `Invalid WebP: ${logicalPath}`);
      }
      payloads.set(`${NEW_MEDIA.includes(logicalPath) ? 'media' : 'program'}-bytes/${logicalPath}`, bytes);
      return { path: logicalPath, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) };
    }
    const oldPrograms = new Set(priorConfig.games.board.programFiles);
    const retained = previous.assets.filter(asset => !oldPrograms.has(asset.path));
    assert.equal(retained.length, 6313, 'All live media records must be retained.');
    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    for (const name of [...NEW_PROGRAMS, ...NEW_MEDIA]) assert.ok(!oldByPath.has(name), `Added path already exists: ${name}`);
    const programs = config.games.board.programFiles.map(record);
    const media = NEW_MEDIA.map(record);
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, [...retained, ...media], programs), 'board');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of previous.assets) if (!CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(nextByPath.get(asset.path), asset, `Existing record changed: ${asset.path}`);
    const changedPrograms = programs.filter(asset => oldByPath.has(asset.path) && canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))).map(asset => asset.path).sort(comparePaths);
    assert.deepEqual(changedPrograms, [...CHANGED_PROGRAMS].sort(comparePaths), 'Every reviewed existing program must change.');
    assert.equal(manifest.totalFiles, previous.totalFiles + NEW_PROGRAMS.length + NEW_MEDIA.length);
    const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
    const manifestBytes = bytesOf(manifest);
    const candidate = { releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(manifestBytes), entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes };
    const nextCatalog = validateCatalog({ ...catalog, createdAt, games: { ...catalog.games, board: candidate } });
    const inputs = { generator: GENERATOR, baseline, sourceHead, createdAt, baselineBoardRelease: previous.releaseId, retainedMediaFiles: retained.length, retainedMediaSha256: sha256Bytes(bytesOf(retained)), changedPrograms: CHANGED_PROGRAMS, addedPaths: [...NEW_PROGRAMS, ...NEW_MEDIA].sort(comparePaths), changedAssets: manifest.assets.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))), candidate };
    const files = new Map([['release-inputs.json', bytesOf(inputs)], ['desktop/catalog-v3.json', bytesOf(nextCatalog)], [manifestPath, manifestBytes], ...payloads]);
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
  function verifyCandidate(value) {
    const directory = outputDirectory(value);
    const inputs = JSON.parse(fs.readFileSync(path.join(directory, 'release-inputs.json')));
    assert.equal(inputs.generator, GENERATOR);
    assert.equal(inputs.sourceHead, head(), 'HEAD changed; build a new candidate.');
    const result = collect(inputs.createdAt);
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
    const options = {};
    for (let index = 0; index < argv.length; index++) {
      const key = argv[index];
      assert.ok(['--output', '--candidate', '--promote'].includes(key) && !(key in options), `Invalid or duplicate option: ${key}`);
      if (key === '--promote') options[key] = true;
      else { assert.ok(argv[index + 1] && !argv[index + 1].startsWith('--'), `Missing value: ${key}`); options[key] = argv[++index]; }
    }
    assert.ok(Boolean(options['--output']) !== Boolean(options['--candidate']), 'Use --output <directory> OR --candidate <directory> [--promote].');
    assert.ok(!options['--promote'] || options['--candidate'], 'Promotion requires an existing candidate.');
    const directory = outputDirectory(options['--output'] || options['--candidate']);
    if (options['--output']) {
      assert.ok(!fs.existsSync(directory) || fs.readdirSync(directory).length === 0, 'Use a fresh candidate directory.');
      for (const [relative, bytes] of collect(new Date().toISOString()).files) immutableWrite(path.join(directory, relative), bytes);
    }
    const result = verifyCandidate(directory);
    if (options['--promote']) {
      assert.equal(head(), result.inputs.sourceHead);
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
    console.log(JSON.stringify({ ok: true, promoted: Boolean(options['--promote']), directory, ...result.inputs }));
    return result;
  }
  return { collect, main, verifyCandidate, outputDirectory };
}

if (require.main === module) {
  try { createBuilder().main(); } catch (error) { console.error(`BOARD_TAVERN_CREW_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { createBuilder, BASELINE, BASELINE_RELEASE, BASELINE_MANIFEST_SHA, NEW_PROGRAMS, CHANGED_PROGRAMS, NEW_MEDIA };
