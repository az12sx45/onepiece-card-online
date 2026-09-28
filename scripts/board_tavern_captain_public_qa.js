'use strict';

// Read-only postdeploy verification for the desktop-only Tavern release.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const { BASELINE, CHANGED_PROGRAMS, ADDED_PROGRAMS, MEDIA_PREFIX } = require('./build_board_tavern_captain_release');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const OUTPUT = process.env.BOARD_QA_OUTPUT || 'D:/Codex_QA/board-tavern-captain-20260928/public-final';
const ORIGIN = 'https://onepiece-card-online.onrender.com';
const ELECTRON_UA = 'OnePieceDesktop Electron/31.0.0';
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const same = (left, right, label) => assert.deepEqual(left, right, label);
const report = {
  schema: 1,
  test: 'board-tavern-captain-desktop-public-v4',
  startedAt: new Date().toISOString(),
  origin: ORIGIN,
  baselineCommit: BASELINE,
  responses: [],
  checks: [],
  transferredBodyBytes: 0,
};

function gitJson(relative) {
  const bytes = execFileSync('git', ['cat-file', 'blob', `${BASELINE}:${relative}`], {
    cwd: ROOT, windowsHide: true, maxBuffer: 32 * 1024 * 1024,
  });
  return JSON.parse(bytes.toString('utf8'));
}

async function get(url, options = {}) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(45000),
    headers: {
      'Cache-Control': 'no-cache',
      ...(options.electron ? { 'User-Agent': ELECTRON_UA } : {}),
      ...(options.cors ? { Origin: ORIGIN } : {}),
    },
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const item = {
    url,
    route: options.electron ? 'electron-compatibility' : options.cors ? 'cors-cas' : 'anonymous',
    status: response.status,
    location: response.headers.get('location'),
    cacheControl: response.headers.get('cache-control'),
    contentType: response.headers.get('content-type'),
    accessControlAllowOrigin: response.headers.get('access-control-allow-origin'),
    distribution: response.headers.get('x-onepiece-distribution'),
    size: bytes.length,
    sha256: digest(bytes),
  };
  report.responses.push(item);
  report.transferredBodyBytes += bytes.length;
  assert.equal(response.status, options.status || 200, `${url} status`);
  return { bytes, item };
}

async function parallel(items, count, action) {
  const queue = items.slice();
  await Promise.all(Array.from({ length: count }, async () => {
    while (queue.length) await action(queue.shift());
  }));
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const localCatalogBytes = fs.readFileSync(path.join(PUBLIC, 'desktop/catalog-v3.json'));
  const catalog = JSON.parse(localCatalogBytes);
  const previousCatalog = gitJson('public/desktop/catalog-v3.json');
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'config/desktop-program-packages-v1.json')));
  const boardRecord = catalog.games.board;
  const localManifestBytes = fs.readFileSync(path.join(PUBLIC, boardRecord.manifestPath));
  const manifest = JSON.parse(localManifestBytes);
  const previousManifest = gitJson(`public/${previousCatalog.games.board.manifestPath}`);
  const assets = new Map(manifest.assets.map(asset => [asset.path, asset]));
  const previousAssets = new Map(previousManifest.assets.map(asset => [asset.path, asset]));
  const programs = config.games.board.programFiles;
  const changed = manifest.assets.filter(asset => !previousAssets.has(asset.path) || asset.sha256 !== previousAssets.get(asset.path).sha256);
  const newMedia = changed.filter(asset => asset.path.startsWith(MEDIA_PREFIX));

  assert.equal(boardRecord.manifestSha256, digest(localManifestBytes), 'Local Board manifest integrity');
  assert.equal(manifest.releaseId, boardRecord.releaseId, 'Board release identity');
  assert.equal(manifest.totalFiles, 6396, 'Board asset count');
  assert.equal(manifest.assets.length, 6396, 'Board manifest inventory');
  assert.equal(programs.length, 57, 'Board program count');
  assert.equal(previousManifest.assets.length, 6377, 'Reviewed baseline inventory');
  assert.equal(changed.length, 24, 'Exactly six programs and 18 media changed');
  assert.equal(newMedia.length, 18, 'New reaction art count');
  same(changed.filter(asset => !asset.path.startsWith(MEDIA_PREFIX)).map(asset => asset.path).sort(),
    [...CHANGED_PROGRAMS].sort(), 'Only reviewed Board programs changed');
  same(changed.filter(asset => !previousAssets.has(asset.path) && !asset.path.startsWith(MEDIA_PREFIX)).map(asset => asset.path),
    [...ADDED_PROGRAMS], 'Only the VFX bundle was added as a program');
  assert.equal(previousAssets.size + newMedia.length + ADDED_PROGRAMS.length, assets.size, 'No prior asset removed');
  for (const [name, asset] of previousAssets) {
    if (!CHANGED_PROGRAMS.includes(name)) same(assets.get(name), asset, `Existing asset unchanged: ${name}`);
  }
  for (const id of ['card', 'chess']) same(catalog.games[id], previousCatalog.games[id], `${id} local identity unchanged`);
  report.expected = {
    board: boardRecord,
    card: catalog.games.card,
    chess: catalog.games.chess,
    boardPrograms: programs.length,
    changedAssets: changed.map(asset => asset.path),
  };
  report.checks.push({ name: 'reviewed-manifest-boundary', ok: true, boardFiles: assets.size, changed: changed.length });

  const health = await get(`${ORIGIN}/health`);
  assert.equal(JSON.parse(health.bytes).ok, true, 'Production health');
  report.checks.push({ name: 'health', ok: true });

  const browserGate = await get(`${ORIGIN}/board_game.html`, { status: 302 });
  assert.equal(browserGate.item.location, '/download', 'Anonymous Board HTML redirects to download');
  assert.equal(browserGate.item.cacheControl, 'no-store', 'Browser gate no-store');
  assert.equal(browserGate.item.distribution, 'desktop-only-v1', 'Desktop distribution middleware');
  report.checks.push({ name: 'anonymous-browser-download-gate', ok: true });

  const publicCatalog = await get(`${ORIGIN}/desktop/catalog-v3.json`);
  assert.equal(publicCatalog.item.sha256, digest(localCatalogBytes), 'Public catalog bytes');
  report.checks.push({ name: 'public-catalog-sha256', ok: true, sha256: publicCatalog.item.sha256 });
  for (const id of ['card', 'board', 'chess']) {
    const expected = catalog.games[id];
    const identity = await get(`${ORIGIN}/api/desktop-runtime-package/${id}`);
    const actual = JSON.parse(identity.bytes);
    assert.equal(actual.ok, true, `${id} package endpoint`);
    assert.equal(actual.gameId, id, `${id} identity`);
    for (const key of ['releaseId', 'manifestSha256', 'entryPath']) assert.equal(actual[key], expected[key], `${id} ${key}`);
    assert.equal(identity.item.cacheControl, 'no-store', `${id} package no-store`);
    report.checks.push({ name: `${id}-runtime-identity`, ok: true, releaseId: actual.releaseId, manifestSha256: actual.manifestSha256 });

    const relative = expected.manifestPath;
    const expectedBytes = fs.readFileSync(path.join(PUBLIC, relative));
    assert.equal(digest(expectedBytes), expected.manifestSha256, `${id} local manifest integrity`);
    const publicManifest = await get(`${ORIGIN}/${relative}`);
    assert.equal(publicManifest.item.sha256, expected.manifestSha256, `${id} public manifest bytes`);
    report.checks.push({ name: `${id}-public-manifest-sha256`, ok: true, sha256: publicManifest.item.sha256 });
  }

  await parallel(programs, 4, async relative => {
    const asset = assets.get(relative);
    assert.ok(asset, `Board program missing from manifest: ${relative}`);
    const { item } = await get(`${ORIGIN}/${relative}`, { electron: true });
    assert.equal(item.size, asset.size, `${relative} direct size`);
    assert.equal(item.sha256, asset.sha256, `${relative} direct SHA-256`);
    if (asset.kind === 'document') assert.match(item.contentType || '', /^text\/html/, `${relative} content type`);
    report.checks.push({ name: 'electron-program', path: relative, ok: true, sha256: item.sha256 });
  });

  await parallel(changed, 4, async asset => {
    const url = `${catalog.assetBlobBaseUrl}/${asset.sha256.slice(0, 2)}/${asset.sha256}`;
    const { item } = await get(url, { cors: true });
    assert.equal(item.size, asset.size, `${asset.path} CAS size`);
    assert.equal(item.sha256, asset.sha256, `${asset.path} CAS SHA-256`);
    assert.ok(item.accessControlAllowOrigin === '*' || item.accessControlAllowOrigin === ORIGIN,
      `${asset.path} CAS CORS origin`);
    report.checks.push({ name: 'changed-asset-cas', path: asset.path, ok: true, sha256: item.sha256, cors: item.accessControlAllowOrigin });
  });

  await parallel(newMedia, 4, async asset => {
    const { item } = await get(`${ORIGIN}/${asset.path}`, { status: 302 });
    assert.equal(item.location, `${catalog.assetBlobBaseUrl}/${asset.sha256.slice(0, 2)}/${asset.sha256}`,
      `${asset.path} alias CAS location`);
    assert.equal(item.cacheControl, 'no-store', `${asset.path} alias no-store`);
    report.checks.push({ name: 'reaction-art-alias', path: asset.path, ok: true });
  });

  report.ok = true;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, checks: report.checks.length, boardReleaseId: boardRecord.releaseId,
    boardPrograms: programs.length, changedCas: changed.length, artAliases: newMedia.length,
    transferredBodyBytes: report.transferredBodyBytes, report: path.join(OUTPUT, 'result.json') }));
}

main().catch(error => {
  report.ok = false;
  report.error = error.stack;
  report.finishedAt = new Date().toISOString();
  fs.mkdirSync(OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT, 'result.json'), JSON.stringify(report, null, 2) + '\n');
  console.error(error);
  process.exitCode = 1;
});
