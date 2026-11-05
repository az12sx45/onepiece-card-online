'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { AssetStore, blobPath, canonicalJson, safePackagePath, sha256Bytes } = require('../desktop/asset-store');
const { ASSET_BLOB_BASE_URL, ENTRY_PATH, PROGRAM_FILES, RELEASE_PATH } = require('../desktop/marineford-release');
const { RuntimeAssetCache } = require('../desktop/runtime-asset-cache');
const { HttpsProgramRuntime } = require('../desktop/program-runtime');

const origin = 'https://onepiece-card-online.onrender.com';
const bodies = new Map();
const manifests = new Map();
const blobUrl = hash => `${ASSET_BLOB_BASE_URL}/${hash.slice(0, 2)}/${hash}`;
const coreEntries = { card: 'start.html', board: 'board_start.html', chess: 'chess/index.html' };
const kinds = ['document', 'style', 'script', 'data', 'wasm', 'image', 'audio', 'video', 'font'];

function asset(assetPath, body = assetPath) {
  const bytes = Buffer.from(body);
  const type = safePackagePath(assetPath);
  const sha256 = sha256Bytes(bytes);
  bodies.set(sha256, bytes);
  return { ...type, size: bytes.length, sha256 };
}

function makePackage(gameId, entryPath, assets, createdAt) {
  const sorted = assets.slice().sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0);
  const assetSetSha256 = sha256Bytes(JSON.stringify(sorted));
  const releaseId = 'package-' + assetSetSha256.slice(0, 16);
  const byKind = Object.fromEntries(kinds.map(kind => [kind, { files: 0, bytes: 0 }]));
  for (const row of sorted) {
    byKind[row.kind].files += 1;
    byKind[row.kind].bytes += row.size;
  }
  const document = {
    schema: 3, gameId, releaseId, createdAt, entryPath, assetSetSha256,
    totalFiles: sorted.length, totalBytes: sorted.reduce((count, row) => count + row.size, 0), byKind, assets: sorted
  };
  const bytes = Buffer.from(canonicalJson(document));
  const manifestPath = `desktop/manifests/${gameId}-${releaseId}.json`;
  manifests.set(manifestPath, bytes);
  const entry = { releaseId, manifestPath, manifestSha256: sha256Bytes(bytes), entryPath,
    totalFiles: document.totalFiles, totalBytes: document.totalBytes };
  return { document, bytes, entry };
}

async function waitForInstall(store, expectSuccess = true) {
  const result = store.installGame('marineford');
  assert.equal(result.ok, true, result.error);
  const deadline = Date.now() + 10_000;
  while (store.activeInstall && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(store.activeInstall, null);
  assert.equal(store.canLaunch('marineford'), expectSuccess);
  return (await store.getState()).games.marineford;
}

async function main() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'marineford-package-qa-'));
  const bundled = path.join(temp, 'bundled');
  await fs.mkdir(path.join(bundled, 'manifests'), { recursive: true });
  const field = asset('marineford/art/v2/field.webp', 'field-v1');
  const card = asset('marineford/art/v2/navy-back.webp', 'navy-v1');
  const effect = asset('marineford/art/v2/effect.webp', 'effect-v1');
  const avatar = asset('images/board/avatars/8.webp', 'avatar-v1');
  const duplicate = { ...field, path: 'marineford/art/v2/field-copy.webp' };
  const programs = PROGRAM_FILES.map(file => asset(file));
  const first = makePackage('marineford', ENTRY_PATH, [...programs, field, card, effect, avatar, duplicate], '2026-11-01T00:00:00.000Z');
  const updatedScript = asset('marineford/marineford.js', 'updated-program');
  const second = makePackage('marineford', ENTRY_PATH,
    [...programs.filter(row => row.path !== updatedScript.path), updatedScript, field, card, effect, avatar, duplicate],
    '2026-11-02T00:00:00.000Z');
  const catalog = {
    schema: 3, createdAt: '2026-10-01T00:00:00.000Z',
    sourceTrees: Object.fromEntries(['images', 'audio', 'videos', 'fonts'].map(name => [name, '1'.repeat(40)])),
    assetBlobBaseUrl: ASSET_BLOB_BASE_URL, games: {}
  };
  for (const [gameId, entryPath] of Object.entries(coreEntries)) {
    const fixture = makePackage(gameId, entryPath, [asset(entryPath), avatar], catalog.createdAt);
    catalog.games[gameId] = { available: true, ...fixture.entry };
    await fs.writeFile(path.join(bundled, 'manifests', path.posix.basename(fixture.entry.manifestPath)), fixture.bytes);
  }
  const catalogBytes = Buffer.from(canonicalJson(catalog));
  await fs.writeFile(path.join(bundled, 'catalog-v3.json'), catalogBytes);
  let current = first;
  let unavailable = false;
  let wrongProof = false;
  let corruptDownload = '';
  let interruptDownload = '';
  let interrupted = false;
  let allowPrevious = true;
  let running = false;
  let downloaded = [];
  const reference = fixture => ({ schema: 1, gameId: 'marineford', createdAt: fixture.document.createdAt,
    assetBlobBaseUrl: ASSET_BLOB_BASE_URL, ...fixture.entry });
  const fetchImpl = async (url, options = {}) => {
    if (url === origin + '/' + RELEASE_PATH) {
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
      return Response.json(reference(current), { status: unavailable ? 503 : 200 });
    }
    if (url.startsWith(origin + '/api/desktop-runtime-package/marineford?')) {
      if (unavailable) return new Response('', { status: 503 });
      const query = new URL(url).searchParams;
      const requested = [first, second].find(fixture => fixture.entry.releaseId === query.get('releaseId') &&
        fixture.entry.manifestSha256 === query.get('manifestSha256'));
      if (!requested || (requested !== current && !allowPrevious)) return new Response('', { status: 409 });
      return Response.json({ ok: true, schema: 1, gameId: 'marineford', releaseId: requested.entry.releaseId,
        manifestSha256: wrongProof ? '0'.repeat(64) : requested.entry.manifestSha256, entryPath: ENTRY_PATH });
    }
    if (url.startsWith(origin + '/desktop/catalog-v3.json')) return new Response(catalogBytes);
    const relative = url.startsWith(origin + '/') ? url.slice(origin.length + 1) : '';
    if (manifests.has(relative)) return new Response(manifests.get(relative));
    const digest = url.startsWith(ASSET_BLOB_BASE_URL + '/') ? url.split('/').at(-1)
      : current.document.assets.find(row => row.path === relative)?.sha256;
    const bytes = bodies.get(digest);
    assert(bytes, url);
    if (url.startsWith(ASSET_BLOB_BASE_URL + '/')) downloaded.push(digest);
    if (digest === interruptDownload) {
      interrupted = true;
      return new Promise((resolve, reject) => {
        const abort = () => reject(new DOMException('Fixture download interrupted', 'AbortError'));
        if (options.signal.aborted) abort();
        else options.signal.addEventListener('abort', abort, { once: true });
      });
    }
    return new Response(digest === corruptDownload ? Buffer.alloc(bytes.length, 0) : bytes,
      { headers: { 'Content-Length': String(bytes.length) } });
  };
  const open = async name => {
    const store = new AssetStore({ origin, bundledCatalogRoot: bundled, cacheRoot: path.join(temp, name),
      fetchImpl, integrityAuditMaxFiles: 0, isGameRunning: () => running });
    await store.init();
    return store;
  };
  const resetDownloads = () => { downloaded = []; };
  const checkDownloads = assets => assert.deepEqual(downloaded.sort(), [...new Set(assets.map(row => row.sha256))].sort());
  try {
    let store = await open('cache');
    const coreBefore = (await store.getState()).games;
    assert.equal(store.canLaunch('marineford'), false);
    resetDownloads();
    await waitForInstall(store);
    checkDownloads(first.document.assets);
    assert.equal(store.getInstalledManifest('marineford').totalFiles, 11);
    assert.deepEqual(Object.keys(JSON.parse(await fs.readFile(path.join(bundled, 'catalog-v3.json'))).games), ['card', 'board', 'chess']);
    for (const id of Object.keys(coreEntries)) assert.deepEqual((await store.getState()).games[id], coreBefore[id]);
    resetDownloads();
    store = await open('cache');
    assert.equal(store.canLaunch('marineford'), true);
    await waitForInstall(store);
    checkDownloads([]);
    assert.equal((await store.confirmRuntimePackage('marineford')).enabled, true);
    wrongProof = true;
    assert.equal((await store.confirmRuntimePackage('marineford')).enabled, false);
    wrongProof = false;
    unavailable = true;
    assert.equal((await store.confirmRuntimePackage('marineford')).enabled, false);
    assert.equal((await store.refreshMarinefordRelease()).ok, false);
    assert.equal(store.canLaunch('marineford'), true);
    unavailable = false;

    current = second;
    running = true;
    assert.equal((await store.refreshMarinefordRelease()).ok, true);
    assert.equal((await store.getState()).games.marineford.status, 'update');
    const installed = store.receipts.get('marineford').manifestSha256;
    assert.equal(store.installGame('marineford').ok, false);
    assert.equal((await store.uninstallGame('marineford')).ok, false);
    assert.equal(store.receipts.get('marineford').manifestSha256, installed);
    assert.equal((await store.confirmRuntimePackage('marineford')).enabled, true);
    allowPrevious = false;
    assert.equal((await store.confirmRuntimePackage('marineford')).enabled, false);
    allowPrevious = true;
    running = false;
    corruptDownload = updatedScript.sha256;
    resetDownloads();
    await waitForInstall(store);
    assert.equal(store.receipts.get('marineford').manifestSha256, installed, 'A failed delta replaced the installed package');
    assert.equal((await store.confirmRuntimePackage('marineford')).manifestSha256, first.entry.manifestSha256);
    corruptDownload = '';
    interruptDownload = updatedScript.sha256;
    assert.equal(store.installGame('marineford').ok, true);
    while (!interrupted) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(store.cancelInstall('marineford').ok, true);
    while (store.activeInstall) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(store.canLaunch('marineford'), true);
    assert.equal(store.receipts.get('marineford').manifestSha256, installed);
    assert.equal((await store.confirmRuntimePackage('marineford')).manifestSha256, first.entry.manifestSha256);
    interruptDownload = '';
    resetDownloads();
    await waitForInstall(store);
    checkDownloads([updatedScript]);
    assert.equal(store.receipts.get('marineford').manifestSha256, second.entry.manifestSha256);
    current = first;
    assert.equal((await store.refreshMarinefordRelease()).ok, false, 'Previous compatibility must not permit an install downgrade');
    assert.equal(store.catalog.games.marineford.manifestSha256, second.entry.manifestSha256);
    current = second;

    await fs.unlink(blobPath(store.cacheRoot, card.sha256));
    const effectPath = blobPath(store.cacheRoot, effect.sha256);
    const stamp = await fs.stat(effectPath);
    await fs.writeFile(effectPath, Buffer.alloc(effect.size, 0x7f));
    await fs.utimes(effectPath, stamp.atime, stamp.mtime);
    store = await open('cache');
    assert.equal((await store.getState()).games.marineford.status, 'repair');
    resetDownloads();
    await waitForInstall(store);
    checkDownloads([card, effect]);
    const local = new RuntimeAssetCache();
    local.buildGame('marineford', store.getInstalledManifest('marineford'), {
      filePathForAsset: row => blobPath(store.cacheRoot, row.sha256)
    });
    let networkReads = 0;
    const runtime = new HttpsProgramRuntime({ gameId: 'marineford', origin, assetCache: local,
      networkFetch: async () => { networkReads += 1; return new Response('network'); } });
    runtime.authorize(await store.confirmRuntimePackage('marineford'));
    for (const row of [updatedScript, field, avatar, programs.find(row => row.path === ENTRY_PATH)]) {
      const response = await runtime.handle(new Request(origin + '/' + row.path));
      assert.equal(response.headers.get('X-OnePiece-Desktop-Program'), 'hit');
      assert.equal(sha256Bytes(Buffer.from(await response.arrayBuffer())), row.sha256);
    }
    await runtime.handle(new Request(origin + '/api/account'));
    assert.equal(networkReads, 1);
    assert.equal(store.installGame('card').ok, true);
    while (store.activeInstall) await new Promise(resolve => setTimeout(resolve, 10));
    assert.equal(store.canLaunch('card'), true);
    const coreIdentity = store.getInstalledRuntimeIdentity('card');
    assert.equal((await store.confirmRuntimePackage('card', { fetchImpl: async url => {
      assert.equal(new URL(url).pathname, '/api/desktop-runtime-package/card');
      assert.deepEqual([...new URL(url).searchParams.keys()], ['launcher']);
      return Response.json({ ok: true, schema: 1, ...coreIdentity });
    } })).enabled, true, 'Original games must retain their unqualified current-proof request');
    assert.equal((await store.uninstallGame('marineford')).ok, true);
    assert.equal(store.canLaunch('marineford'), false);
    await fs.access(blobPath(store.cacheRoot, avatar.sha256));
    assert.equal(store.canLaunch('card'), true);

    current = first;
    let migration = await open('migration');
    for (const row of [field, card, effect]) {
      const target = blobPath(migration.cacheRoot, row.sha256);
      await fs.mkdir(path.dirname(target), { recursive: true });
      await fs.writeFile(target, bodies.get(row.sha256));
    }
    const legacyPath = path.join(migration.cacheRoot, 'state', 'marineford-media-v1.json');
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, canonicalJson({ schema: 1, gameId: 'marineford', assets: [field, card, effect, duplicate] }));
    migration = await open('migration');
    assert.equal((await migration.refreshMarinefordRelease()).ok, true);
    assert.equal((await migration.getState()).games.marineford.status, 'update');
    assert.equal(migration.canLaunch('marineford'), false);
    resetDownloads();
    await waitForInstall(migration);
    checkDownloads([...programs, avatar]);
    await assert.rejects(fs.access(legacyPath), { code: 'ENOENT' });

    const oldPointer = migration.marinefordRelease.entry.manifestSha256;
    const bad = makePackage('marineford', ENTRY_PATH,
      [...first.document.assets.filter(row => row.path !== 'marineford/sound.js'), asset('api/account.json', '{}')],
      '2026-11-03T00:00:00.000Z');
    current = bad;
    resetDownloads();
    assert.equal((await migration.refreshMarinefordRelease()).ok, false);
    assert.equal(migration.marinefordRelease.entry.manifestSha256, oldPointer);
    checkDownloads([]);
    assert.equal(sha256Bytes(await fs.readFile(path.join(bundled, 'catalog-v3.json'))), sha256Bytes(catalogBytes));
    console.log('DESKTOP_MARINEFORD_PACKAGE_QA=PASS cold=10 warm=0 delta=1 repair=2 migration=7 proof=exact previousCompatible=PASS failedAndInterruptedUpgrade=PASS downgradeGuard=PASS activeGuard=PASS partialFailure=PASS uninstallShared=PASS originalCatalog=PASS');
  } finally {
    assert.equal(path.dirname(temp), path.resolve(os.tmpdir()));
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error.stack); process.exitCode = 1; });
