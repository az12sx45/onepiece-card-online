'use strict';

// Read-only proof that the public desktop package is the reviewed candidate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { validateConfig } = require('./build_desktop_program_catalog');
const {
  canonicalJson, sha256Bytes, comparePaths, validateCatalog, validateManifest,
} = require('./desktop_program_package_common');
const {
  BASELINE_RELEASE, BASELINE_MANIFEST_SHA, BASELINE_CATALOG_SHA, CHANGED_PROGRAMS,
} = require('./build_board_hit_depth_release');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://onepiece-card-online.onrender.com';
const ELECTRON_UA = 'OnePieceDesktop Electron/31.0.0';
const CONFIG = 'config/desktop-program-packages-v1.json';
const CATALOG = 'public/desktop/catalog-v3.json';
const bytesOf = value => Buffer.from(canonicalJson(value));

function rejectLinks(filename) {
  for (let current = filename; ; current = path.dirname(current)) {
    if (fs.existsSync(current)) assert.equal(fs.lstatSync(current).isSymbolicLink(), false, `Link is not accepted: ${current}`);
    if (path.dirname(current) === current) break;
  }
}

function listFiles(directory, prefix = '') {
  rejectLinks(directory);
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name);
    rejectLinks(filename);
    if (entry.isDirectory()) return listFiles(filename, `${prefix}${entry.name}/`);
    assert.ok(entry.isFile(), `Unexpected candidate object: ${filename}`);
    return [`${prefix}${entry.name}`];
  }).sort(comparePaths);
}

function readCanonical(filename, label) {
  rejectLinks(filename);
  const bytes = fs.readFileSync(filename);
  const value = JSON.parse(bytes.toString('utf8'));
  assert.ok(bytes.equals(bytesOf(value)), `${label} is not canonical JSON.`);
  return { bytes, value };
}

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert.ok(['--candidate', '--report'].includes(key), `Unknown option: ${key}`);
    assert.ok(!options[key], `Duplicate option: ${key}`);
    const value = argv[++index];
    assert.ok(value && !value.startsWith('--') && path.isAbsolute(value), `${key} requires an absolute path.`);
    options[key] = path.resolve(value);
  }
  assert.ok(options['--candidate'], '--candidate is required.');
  return { candidate: options['--candidate'], report: options['--report'] };
}

function createVerifier({ root = ROOT, origin = ORIGIN, fetchImpl = fetch } = {}) {
  root = path.resolve(root);
  assert.ok(/^https?:\/\/[^/]+$/.test(origin), 'Origin must not contain a path or trailing slash.');
  const git = args => execFileSync('git', args, {
    cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const at = (ref, filename) => git(['cat-file', 'blob', `${ref}:${filename}`]);

  function localCandidate(directory) {
    assert.ok(path.isAbsolute(directory), 'Candidate directory must be absolute.');
    directory = path.resolve(directory);
    assert.ok(fs.statSync(directory).isDirectory(), 'Candidate directory is missing.');
    const read = relative => {
      const filename = path.join(directory, relative);
      rejectLinks(filename);
      return fs.readFileSync(filename);
    };
    const inputs = readCanonical(path.join(directory, 'release-inputs.json'), 'Candidate inputs').value;
    assert.equal(inputs.generator, 'board-hit-depth-release-v1', 'Wrong candidate generator.');
    assert.match(String(inputs.sourceHead), /^[a-f0-9]{40,64}$/, 'Invalid source commit.');
    assert.equal(inputs.baselineCatalogSha256, BASELINE_CATALOG_SHA, 'Candidate baseline catalog changed.');
    assert.equal(inputs.baselineBoardRelease, BASELINE_RELEASE, 'Candidate baseline release changed.');
    assert.equal(inputs.baselineBoardManifestSha256, BASELINE_MANIFEST_SHA, 'Candidate baseline manifest changed.');
    const baselineBytes = at(inputs.sourceHead, CATALOG);
    assert.equal(sha256Bytes(baselineBytes), BASELINE_CATALOG_SHA, 'Source commit is not the reviewed public baseline.');
    const baseline = validateCatalog(JSON.parse(baselineBytes));
    assert.equal(baseline.games.board.releaseId, BASELINE_RELEASE);
    assert.equal(baseline.games.board.manifestSha256, BASELINE_MANIFEST_SHA);
    const oldBytes = at(inputs.sourceHead, `public/${baseline.games.board.manifestPath}`);
    assert.equal(sha256Bytes(oldBytes), BASELINE_MANIFEST_SHA, 'Baseline Board manifest bytes changed.');
    const old = validateManifest(JSON.parse(oldBytes), 'board');
    const config = validateConfig(JSON.parse(at(inputs.sourceHead, CONFIG)));
    const changed = [...CHANGED_PROGRAMS];
    assert.ok(changed.every(name => config.games.board.programFiles.includes(name)), 'Changed program absent from Board config.');
    const catalogFile = readCanonical(path.join(directory, 'desktop/catalog-v3.json'), 'Candidate catalog');
    const catalog = validateCatalog(catalogFile.value);
    assert.deepEqual(catalog, { ...baseline, createdAt: inputs.createdAt, games: { ...baseline.games, board: inputs.candidate } },
      'Candidate may change only the Board package and catalog time.');
    const board = catalog.games.board;
    const manifestFile = readCanonical(path.join(directory, board.manifestPath), 'Candidate Board manifest');
    assert.equal(sha256Bytes(manifestFile.bytes), board.manifestSha256, 'Candidate manifest digest differs.');
    const manifest = validateManifest(manifestFile.value, 'board');
    for (const field of ['releaseId', 'entryPath', 'totalFiles', 'totalBytes']) {
      assert.equal(manifest[field], board[field], `Candidate Board ${field} differs.`);
    }
    assert.equal(manifest.createdAt, inputs.createdAt, 'Candidate time differs.');
    assert.equal(manifest.totalFiles, old.totalFiles, 'Board file count changed.');
    const oldByPath = new Map(old.assets.map(asset => [asset.path, asset]));
    const nextByPath = new Map(manifest.assets.map(asset => [asset.path, asset]));
    assert.deepEqual(manifest.assets.filter(asset => canonicalJson(asset) !== canonicalJson(oldByPath.get(asset.path))).map(asset => asset.path),
      changed, 'Candidate changed-asset allowlist differs.');
    for (const asset of old.assets) {
      if (!changed.includes(asset.path)) assert.deepEqual(nextByPath.get(asset.path), asset, `Untouched asset changed: ${asset.path}`);
    }
    const retained = old.assets.filter(asset => !config.games.board.programFiles.includes(asset.path));
    assert.equal(inputs.retainedAssetCount, retained.length, 'Retained asset count differs.');
    assert.equal(inputs.retainedAssetRecordsSha256, sha256Bytes(bytesOf(retained)), 'Retained asset record digest differs.');
    assert.deepEqual(inputs.changedPrograms, changed.map(name => nextByPath.get(name)), 'Changed program records differ.');
    for (const name of changed) {
      const bytes = read(`program-bytes/${name}`);
      const asset = nextByPath.get(name);
      assert.equal(bytes.length, asset.size, `Candidate payload size differs: ${name}`);
      assert.equal(sha256Bytes(bytes), asset.sha256, `Candidate payload digest differs: ${name}`);
    }
    assert.deepEqual(listFiles(directory), [
      'release-inputs.json', 'desktop/catalog-v3.json', board.manifestPath,
      ...changed.map(name => `program-bytes/${name}`),
    ].sort(comparePaths), 'Candidate has missing or unexpected files.');
    return { inputs, baseline, old, catalog, manifest, catalogBytes: catalogFile.bytes, manifestBytes: manifestFile.bytes, nextByPath };
  }

  async function verify(directory) {
    const expected = localCandidate(directory);
    const report = {
      schema: 1, test: 'board-hit-depth-desktop-public-v1', startedAt: new Date().toISOString(),
      origin, baselineRelease: BASELINE_RELEASE, expectedBoard: expected.catalog.games.board,
      changedPrograms: [...CHANGED_PROGRAMS], checks: [], responses: [], transferredBodyBytes: 0,
    };
    async function get(url, { status = 200, electron = false, cors = false } = {}) {
      const response = await fetchImpl(url, {
        redirect: 'manual', signal: AbortSignal.timeout(45000),
        headers: {
          'Cache-Control': 'no-cache',
          ...(electron ? { 'User-Agent': ELECTRON_UA } : {}),
          ...(cors ? { Origin: origin } : {}),
        },
      });
      const bytes = Buffer.from(await response.arrayBuffer());
      const item = {
        url, route: electron ? 'electron' : cors ? 'cors-cas' : 'anonymous',
        status: response.status, size: bytes.length, sha256: sha256Bytes(bytes),
        location: response.headers.get('location'),
        contentType: response.headers.get('content-type'),
        cacheControl: response.headers.get('cache-control'),
        corsOrigin: response.headers.get('access-control-allow-origin'),
      };
      report.responses.push(item);
      report.transferredBodyBytes += bytes.length;
      assert.equal(response.status, status, `${url} status`);
      return { bytes, item };
    }
    try {
      const health = await get(`${origin}/health`);
      assert.equal(JSON.parse(health.bytes).ok, true, 'Public health');
      report.checks.push('health');
      const catalogResponse = await get(`${origin}/desktop/catalog-v3.json`);
      assert.ok(catalogResponse.bytes.equals(expected.catalogBytes), 'Public catalog differs from reviewed candidate.');
      report.checks.push('public-catalog-exact-bytes');
      for (const gameId of ['card', 'board', 'chess']) {
        const record = expected.catalog.games[gameId];
        if (gameId !== 'board') assert.deepEqual(record, expected.baseline.games[gameId], `${gameId} changed from baseline.`);
        const runtime = await get(`${origin}/api/desktop-runtime-package/${gameId}`, { electron: true });
        const value = JSON.parse(runtime.bytes);
        assert.equal(value.ok, true, `${gameId} runtime health`);
        assert.equal(value.gameId, gameId, `${gameId} runtime game`);
        for (const field of ['releaseId', 'manifestSha256', 'entryPath']) assert.equal(value[field], record[field], `${gameId} runtime ${field}`);
        assert.equal(runtime.item.cacheControl, 'no-store', `${gameId} runtime cache control`);
        report.checks.push(`${gameId}-runtime-identity`);
        const manifest = await get(`${origin}/${record.manifestPath}`);
        assert.equal(manifest.item.sha256, record.manifestSha256, `${gameId} public manifest digest`);
        if (gameId === 'board') assert.ok(manifest.bytes.equals(expected.manifestBytes), 'Public Board manifest differs from candidate.');
        report.checks.push(`${gameId}-public-manifest`);
      }
      const anonymous = await get(`${origin}/board_battle.html`, { status: 302 });
      assert.equal(anonymous.item.location, '/download', 'Anonymous Board gate');
      report.checks.push('anonymous-board-gate');
      for (const name of CHANGED_PROGRAMS) {
        const asset = expected.nextByPath.get(name);
        const direct = await get(`${origin}/${name}`, { electron: true });
        assert.equal(direct.item.size, asset.size, `Direct program size: ${name}`);
        assert.equal(direct.item.sha256, asset.sha256, `Direct program digest: ${name}`);
        assert.match(direct.item.contentType || '', asset.kind === 'document' ? /^text\/html/ : /^text\/css/, `Program MIME: ${name}`);
        report.checks.push(`electron-program:${name}`);
        const cas = await get(`${expected.catalog.assetBlobBaseUrl}/${asset.sha256.slice(0, 2)}/${asset.sha256}`, { cors: true });
        assert.equal(cas.item.size, asset.size, `CAS program size: ${name}`);
        assert.equal(cas.item.sha256, asset.sha256, `CAS program digest: ${name}`);
        assert.ok(cas.item.corsOrigin === '*' || cas.item.corsOrigin === origin, `CAS CORS origin: ${name}`);
        report.checks.push(`cors-cas:${name}`);
      }
      report.ok = true;
    } catch (error) {
      report.ok = false;
      report.error = error.stack;
      throw Object.assign(error, { report });
    } finally { report.finishedAt = new Date().toISOString(); }
    return report;
  }

  return { localCandidate, verify };
}

async function main(argv = process.argv.slice(2)) {
  const options = parseArguments(argv);
  let report;
  try { report = await createVerifier().verify(options.candidate); }
  catch (error) { report = error.report; if (!report) throw error; }
  if (options.report) {
    rejectLinks(options.report);
    fs.mkdirSync(path.dirname(options.report), { recursive: true });
    fs.writeFileSync(options.report, `${JSON.stringify(report, null, 2)}\n`, { flag: 'wx' });
  }
  if (!report.ok) throw new Error(report.error);
  console.log(JSON.stringify({ ok: true, checks: report.checks.length, boardReleaseId: report.expectedBoard.releaseId,
    transferredBodyBytes: report.transferredBodyBytes, report: options.report || null }));
  return report;
}

if (require.main === module) {
  main().catch(error => { console.error(`BOARD_HIT_DEPTH_PUBLIC_QA=FAIL ${error.message}`); process.exitCode = 1; });
}

module.exports = { createVerifier, parseArguments, ORIGIN, ELECTRON_UA };
