'use strict';

// Scoped, offline release of reviewed model-derived Board character layers.
// Only explicit --candidate <reviewed-directory> --promote writes public metadata.
// Player data, installed caches, Git, network, Card, Chess and v2 are never written.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes, classifyPath, comparePaths, validateCatalog, validateManifest } = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = 'c9922e2f19191f4fa8e0f3fc91a9a92cefb5d3c3';
const CATALOG = 'public/desktop/catalog-v3.json';
const CONFIG = 'config/desktop-program-packages-v1.json';
const V2 = 'public/desktop/catalog-v2.json';
const SERVER = 'server/desktop-distribution.js';
const GENERATOR = 'board-model-depth-release-v1';
const PREFIX = 'images/board-depth/v1/';
const LAYER_MANIFEST = `${PREFIX}manifest.json`;
const NEW_PROGRAMS = ['css/board_character_depth.css', 'js/board_character_depth.js'];
const CHANGED_PROGRAMS = ['board_battle.html', 'js/board_battle.js'];
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
function layerInventory(manifestBytes, oldByPath) {
  const document = checkedJson(manifestBytes, LAYER_MANIFEST);
  assert.equal(document.schema, 1, 'Layer manifest schema must be 1.');
  assert.equal(document.generator, 'board-depth-layers-v1', 'Layer generator identity mismatch.');
  assert.ok(document.assets && typeof document.assets === 'object' && !Array.isArray(document.assets), 'Layer assets are missing.');
  const sourcePaths = Object.keys(document.assets);
  assert.ok(sourcePaths.length > 0, 'No reviewed model layers were supplied.');
  assert.deepEqual(sourcePaths, [...sourcePaths].sort(comparePaths), 'Layer sources must be sorted.');
  // The existing package contains 596 opaque ally WebPs and 480 enemy WebPs.
  // Three raw JFIF references are not runtime portrait URLs; the RGBA
  // placeholder is likewise excluded. The three legacy Oars poses can still
  // render in the active battle stage or codex fallback and need model layers.
  // Transparent avatars and speakers use their existing alpha source at runtime.
  const expectedSources = [...oldByPath.keys()].filter(relative =>
    (/^images\/board\/battle\/(?:portraits|enemies)\/.+\.webp$/.test(relative) &&
      relative !== 'images/board/battle/portraits/placeholder/normal.webp')
  ).sort(comparePaths);
  assert.equal(expectedSources.length, 1076, 'The reviewed combat source inventory changed.');
  const legacyOars = ['attack', 'hurt', 'idle'].map(pose =>
    `images/board/enemies/postgame_oars_${pose}.webp`);
  for (const source of legacyOars) {
    assert.ok(oldByPath.get(source)?.kind === 'image', `Legacy Oars source is absent: ${source}`);
    expectedSources.push(source);
  }
  assert.equal(expectedSources.length, 1079, 'The full opaque character source inventory changed.');
  const fallbacks = document.fallbacks || {};
  const expectedFallbacks = ["images/board/battle/enemies/kuro/angry.webp", "images/board/battle/enemies/kuro/hit.webp", "images/board/battle/enemies/kuro/hit_player.webp", "images/board/battle/enemies/kuro/morale.webp", "images/board/battle/enemies/kuro/weak.webp", "images/board/battle/enemies/postgame_patrick_redfield/angry.webp", "images/board/battle/enemies/postgame_patrick_redfield/morale.webp"];
  assert.deepEqual(Object.keys(fallbacks), expectedFallbacks);
  for (const source of expectedFallbacks) {
    assert.equal(fallbacks[source].mode, 'planar');
    assert.equal(fallbacks[source].sourceSha256, oldByPath.get(source).sha256);
    assert.equal(document.assets[source], undefined, 'Rejected masks must not be shipped');
  }
  expectedSources.sort(comparePaths);
  assert.deepEqual([...sourcePaths, ...expectedFallbacks].sort(comparePaths), expectedSources, 'Battle inventory must be complete');
  const media = [];
  const seen = new Set();
  for (const sourcePath of sourcePaths) {
    assert.match(sourcePath, /^images\/board\/.+\.webp$/, `Source must be existing Board art: ${sourcePath}`);
    assert.ok(oldByPath.get(sourcePath)?.kind === 'image', `Source is absent from released Board assets: ${sourcePath}`);
    const item = document.assets[sourcePath];
    assert.ok(item && typeof item === 'object' && !Array.isArray(item), `Invalid reviewed asset: ${sourcePath}`);
    const expectedFields = ['background', 'edgeTouch', 'files', 'mask', 'safeShiftPx', 'size', 'sourceSha256', 'visualReview'];
    if (Object.hasOwn(item, 'motionSafe')) {
      assert.equal(typeof item.motionSafe, 'boolean', `motionSafe must be a boolean: ${sourcePath}`);
      expectedFields.push('motionSafe');
    }
    assert.deepEqual(Object.keys(item).sort(comparePaths), expectedFields.sort(comparePaths),
      `Public layer metadata has missing or unexpected fields: ${sourcePath}`);
    assert.equal(item.visualReview, 'approved', `Unreviewed model layers: ${sourcePath}`);
    assert.ok(Array.isArray(item.size) && item.size.length === 2 && item.size.every(n => Number.isSafeInteger(n) && n > 0), `Invalid source size: ${sourcePath}`);
    const shiftCap = Math.floor(Math.min(...item.size) * 0.05);
    for (const [field, check] of [
      ['edgeTouch', value => typeof value === 'boolean'],
      ['safeShiftPx', value => Number.isSafeInteger(value) && value >= 0 && value <= shiftCap]
    ]) {
      const values = item[field];
      assert.ok(values && typeof values === 'object' && !Array.isArray(values), `Missing ${field}: ${sourcePath}`);
      assert.deepEqual(Object.keys(values).sort(comparePaths), ['bottom', 'left', 'right', 'top'], `Invalid ${field} sides: ${sourcePath}`);
      for (const side of ['left', 'right', 'top', 'bottom']) assert.ok(check(values[side]), `Invalid ${field}.${side}: ${sourcePath}`);
    }
    assert.match(String(item.sourceSha256 || ''), /^[a-f0-9]{64}$/, `Missing source digest: ${sourcePath}`);
    assert.equal(item.sourceSha256, oldByPath.get(sourcePath).sha256, `Source release digest changed: ${sourcePath}`);
    assert.ok(item.files && typeof item.files === 'object' && !Array.isArray(item.files), `Missing layer file digests: ${sourcePath}`);
    assert.deepEqual(Object.keys(item.files).sort(comparePaths), ['background', 'mask'], `Only shipped layer roles belong in public metadata: ${sourcePath}`);
    for (const role of ['background', 'mask']) {
      const relative = item[role];
      assert.match(String(relative || ''), /^images\/board-depth\/v1\/[a-z0-9][a-z0-9_-]*\/(?:background|mask)\.webp$/, `Unsafe generated path: ${relative}`);
      assert.ok(relative.endsWith(`/${role}.webp`), `Layer role/path mismatch: ${relative}`);
      assert.equal(seen.has(relative), false, `Repeated layer path: ${relative}`);
      seen.add(relative);
      const record = item.files[role];
      assert.ok(record && Number.isSafeInteger(record.size) && record.size > 0 && /^[a-f0-9]{64}$/.test(String(record.sha256 || '')), `Missing layer bytes/SHA: ${relative}`);
      media.push({ path: relative, size: record.size, sha256: record.sha256 });
    }
  }
  return { sourcePaths, approvedAssets: document.assets, media: media.sort((a, b) => comparePaths(a.path, b.path)), paths: [LAYER_MANIFEST, ...media.map(item => item.path)].sort(comparePaths) };
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
  function readManyAt(ref, relatives, visitor) {
    // Batch Git reads avoid thousands of Windows process launches, while each
    // invocation stays bounded in memory. The callback can discard old source
    // art immediately rather than retaining all 250 MB of existing portraits.
    for (let start = 0; start < relatives.length; start += 48) {
      const group = relatives.slice(start, start + 48);
      const output = execFileSync('git', ['cat-file', '--batch'], {
        cwd: root, windowsHide: true, input: group.map(relative => `${ref}:public/${relative}`).join('\n') + '\n',
        maxBuffer: 160 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe']
      });
      let offset = 0;
      for (const relative of group) {
        const end = output.indexOf(10, offset);
        assert.ok(end > offset, `Missing Git batch header: ${relative}`);
        const header = output.toString('ascii', offset, end);
        const match = header.match(/^[a-f0-9]{40,64} blob ([0-9]+)$/);
        assert.ok(match, `Missing Git blob: ${relative}`);
        const size = Number(match[1]);
        assert.ok(Number.isSafeInteger(size) && size > 0, `Invalid Git blob size: ${relative}`);
        const first = end + 1;
        assert.equal(output[first + size], 10, `Truncated Git batch blob: ${relative}`);
        visitor(relative, output.subarray(first, first + size));
        offset = first + size + 1;
      }
      assert.equal(offset, output.length, 'Unexpected extra Git batch data.');
    }
  }
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
    expectedConfig.games.board.programFiles.push(...NEW_PROGRAMS, LAYER_MANIFEST);
    expectedConfig.games.board.programFiles.sort(comparePaths);
    assert.deepEqual(config, expectedConfig, 'Config may only add the two character-depth programs.');
    assert.equal(priorConfig.games.board.programFiles.length, 48, 'Expected 48 baseline Board programs.');
    assert.equal(config.games.board.programFiles.length, 51, 'Expected 51 candidate Board program/data files.');
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
    const serverBytes = readAt(sourceHead, SERVER);
    const baselineServer = readAt(baseline, SERVER).toString('utf8');
    const routeAnchor = "    if (pathname === '/images/board/mobile/manifest-v397.json' && isDesktopRenderer(req.headers)) return next();\n";
    const routeAddition = "    // The reviewed Board depth catalog is package metadata fetched at runtime,\n" +
      "    // not media redirected through R2. Allow only this exact JSON for Electron.\n" +
      "    if (pathname === '/images/board-depth/v1/manifest.json' && isDesktopRenderer(req.headers)) return next();\n";
    assert.ok(baselineServer.includes(routeAnchor), 'Baseline server routing anchor changed.');
    assert.ok(serverBytes.equals(Buffer.from(baselineServer.replace(routeAnchor, routeAnchor + routeAddition))),
      'Server may only add the exact Electron depth-manifest route.');
    cleanFile(SERVER, serverBytes);
    const previous = manifests.board;
    assert.equal(previous.totalFiles, 4214, 'Expected all 4,214 baseline Board records.');
    const retained = previous.assets.filter(asset => MEDIA.has(asset.kind));
    assert.equal(retained.length, 4166, 'Expected 4,166 retained Board media records.');
    assert.deepEqual(previous.assets.filter(asset => !MEDIA.has(asset.kind)).map(asset => asset.path), priorConfig.games.board.programFiles, 'Baseline Board programs differ from config.');
    assert.equal(previous.entryPath, config.games.board.entryPath, 'Board entry path');
    const oldByPath = new Map(previous.assets.map(asset => [asset.path, asset]));
    const layerManifestBytes = readAt(sourceHead, `public/${LAYER_MANIFEST}`);
    const inventory = layerInventory(layerManifestBytes, oldByPath);
    const mediaNames = inventory.paths;
    const names = config.games.board.programFiles.filter(name => name !== LAYER_MANIFEST);
    const sourcePaths = [CONFIG, SERVER, ...names.map(name => `public/${name}`), `public/${PREFIX}`];
    // Diff respects checkout CRLF rules. All package bytes still come from Git blobs.
    git(['diff', '--quiet', 'HEAD', '--', ...sourcePaths]);
    for (const relative of sourcePaths) {
      const filename = path.join(root, relative);
      rejectLinks(filename);
      if (relative.endsWith('/')) assert.ok(fs.statSync(filename).isDirectory(), `Missing source directory: ${relative}`);
      else assert.ok(fs.statSync(filename).isFile(), `Missing regular source file: ${relative}`);
    }
    assert.equal(git(['ls-files', '--others', '--exclude-standard', '--', `public/${PREFIX}`]).length, 0, 'Untracked model media must not enter the candidate.');
    const trackedMedia = git(['ls-tree', '-r', '-z', '--name-only', sourceHead, '--', `public/${PREFIX}`]).toString('utf8').split('\0').filter(Boolean).map(name => name.slice(7)).sort(comparePaths);
    assert.deepEqual(trackedMedia, mediaNames, 'Committed depth media has missing or unexpected paths.');
    assert.deepEqual(listFiles(path.join(root, 'public', PREFIX)).map(name => PREFIX + name), mediaNames, 'Depth directory has missing or unexpected files.');
    const changedInHead = new Set(git(['diff', '-z', '--name-only', '--no-renames', baseline, sourceHead, '--', 'public']).toString('utf8').split('\0').filter(Boolean));
    const protectedAssetPaths = new Set([...retained, ...manifests.card.assets, ...manifests.chess.assets].map(asset => `public/${asset.path}`));
    for (const relative of protectedAssetPaths) assert.equal(changedInHead.has(relative), false, `Protected existing asset changed in HEAD: ${relative}`);
    const allowedPublic = new Set([...NEW_PROGRAMS, ...CHANGED_PROGRAMS, ...mediaNames].map(relative => `public/${relative}`));
    for (const relative of changedInHead) assert.ok(allowedPublic.has(relative), `Unreviewed public change in HEAD: ${relative}`);
    const programBytes = new Map();
    const programs = names.map(relative => {
      const bytes = readAt(sourceHead, `public/${relative}`);
      const asset = record(relative, bytes);
      assert.equal(MEDIA.has(asset.kind), false, `Program has media type: ${relative}`);
      programBytes.set(relative, bytes);
      return asset;
    });
    for (const relative of CHANGED_PROGRAMS.filter(name => name.endsWith(".html"))) {
      const html = programBytes.get(relative)?.toString('utf8') || '';
      assert.ok(html.includes('css/board_character_depth.css') && html.includes('js/board_character_depth.js'), `Character depth is not loaded by ${relative}`);
    }
    // Read every original from the committed source and compare its SHA with
    // both the reviewed layer manifest and the current released media record.
    readManyAt(sourceHead, inventory.sourcePaths, (relative, bytes) => {
      const approved = inventory.approvedAssets[relative];
      assert.equal(sha256Bytes(bytes), approved.sourceSha256, `Original source SHA changed: ${relative}`);
    });
    const mediaBytes = new Map([[LAYER_MANIFEST, layerManifestBytes]]);
    const newRecords = new Map([[LAYER_MANIFEST, record(LAYER_MANIFEST, layerManifestBytes)]]);
    const declared = new Map(inventory.media.map(item => [item.path, item]));
    readManyAt(sourceHead, inventory.media.map(item => item.path), (relative, bytes) => {
      assert.equal(bytes.toString('ascii', 0, 4), 'RIFF', `Invalid WebP header: ${relative}`);
      assert.equal(bytes.toString('ascii', 8, 12), 'WEBP', `Invalid WebP format: ${relative}`);
      assert.equal(bytes.length, declared.get(relative).size, `Layer byte count differs: ${relative}`);
      assert.equal(sha256Bytes(bytes), declared.get(relative).sha256, `Layer SHA differs: ${relative}`);
      assert.ok(fs.readFileSync(path.join(root, 'public', relative)).equals(bytes), `Uncommitted media differs: ${relative}`);
      mediaBytes.set(relative, Buffer.from(bytes));
      newRecords.set(relative, record(relative, bytes));
    });
    assert.ok(fs.readFileSync(path.join(root, 'public', LAYER_MANIFEST)).equals(layerManifestBytes), 'Uncommitted layer manifest differs.');
    const newAssets = mediaNames.map(relative => newRecords.get(relative));
    assert.equal(newAssets.length, mediaNames.length, 'Incomplete new asset records.');
    const manifest = validateManifest(buildManifest('board', previous.entryPath, createdAt, [...retained, ...newAssets], programs), 'board');
    const changed = programs.filter(asset => oldByPath.has(asset.path) && canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path)));
    assert.deepEqual(changed.map(asset => asset.path), CHANGED_PROGRAMS, 'Only the battle page and cosmetic frame refresh may change.');
    const added = manifest.assets.filter(asset => !oldByPath.has(asset.path)).map(asset => asset.path);
    assert.deepEqual(added, [...NEW_PROGRAMS, ...mediaNames].sort(comparePaths), 'Only two new programs and reviewed model assets may be added.');
    assert.equal(manifest.totalFiles, previous.totalFiles + 2 + mediaNames.length, 'Candidate file count');
    assert.ok(manifest.totalFiles <= 20_000, 'Package manifest exceeds the launcher limit.');
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    for (const asset of previous.assets) if (!CHANGED_PROGRAMS.includes(asset.path)) assert.deepEqual(nextByPath.get(asset.path), asset, `Existing package record changed: ${asset.path}`);
    const nextManifestBytes = jsonBytes(manifest);
    assert.ok(nextManifestBytes.length <= 8 * 1024 * 1024, 'Board package manifest exceeds the launcher 8 MiB limit.');
    const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
    const nextCatalog = validateCatalog({ ...catalog, createdAt, games: { ...catalog.games, board: {
      releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(nextManifestBytes), entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes
    } } });
    for (const game of ['card', 'chess']) assert.deepEqual(nextCatalog.games[game], catalog.games[game], `${game} catalog changed.`);
    assert.deepEqual(nextCatalog.sourceTrees, catalog.sourceTrees, 'Media source trees changed.');
    assert.equal(nextCatalog.assetBlobBaseUrl, catalog.assetBlobBaseUrl, 'Asset origin changed.');
    const inputs = {
      generator: GENERATOR, baseline, sourceHead, createdAt, baselineBoardRelease: previous.releaseId,
      serverRoute: { path: SERVER, size: serverBytes.length, sha256: sha256Bytes(serverBytes) },
      protected: [...protectedFiles].map(([relative, bytes]) => ({ path: relative, size: bytes.length, sha256: sha256Bytes(bytes) })),
      programs, newAssets, originalSources: inventory.sourcePaths.map(relative => ({ path: relative, sha256: oldByPath.get(relative).sha256 })),
      retainedMediaFiles: retained.length, retainedMediaSha256: sha256Bytes(JSON.stringify(retained)),
      changedPrograms: changed, changedAssets: manifest.assets.filter(asset => !oldByPath.has(asset.path) || canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))), addedPaths: added, candidate: nextCatalog.games.board
    };
    const files = new Map([
      ['release-inputs.json', jsonBytes(inputs)], ['desktop/catalog-v3.json', jsonBytes(nextCatalog)], [manifestPath, nextManifestBytes],
      ...[...programBytes].map(([relative, bytes]) => [`program-bytes/${relative}`, bytes]),
      ...[...mediaBytes].map(([relative, bytes]) => [`media-bytes/${relative}`, bytes])
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
    console.log(JSON.stringify({ ok: true, promoted: options.promote, directory, sourceHead: result.inputs.sourceHead, baseline: result.inputs.baseline, checkedPrograms: result.inputs.programs.length, newDepthFiles: result.inputs.newAssets.length, reviewedSources: result.inputs.originalSources.length, retainedMediaFiles: result.inputs.retainedMediaFiles, changedPrograms: result.inputs.changedPrograms.map(asset => asset.path), candidate: result.inputs.candidate }));
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
  try { formal.main(); } catch (error) { console.error(`BOARD_MODEL_DEPTH_RELEASE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { ...formal, createBuilder, layerInventory, parseArguments, BASELINE, PREFIX, LAYER_MANIFEST, NEW_PROGRAMS, CHANGED_PROGRAMS };
