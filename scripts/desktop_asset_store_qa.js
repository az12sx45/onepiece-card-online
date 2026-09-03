'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const {
  AssetStore,
  blobPath,
  canonicalJson,
  sha256Bytes,
  sha256File,
  validateCatalog,
  validateIntegrityDocument,
  validateManifest
} = require('../desktop/asset-store');

const CREATED_AT = '2026-09-03T00:00:00.000Z';
const UPDATED_AT = '2026-09-04T00:00:00.000Z';
const MIME_BY_EXTENSION = new Map([
  ['.png', ['image', 'image/png']],
  ['.mp3', ['audio', 'audio/mpeg']],
  ['.woff2', ['font', 'font/woff2']]
]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitUntil(predicate, label, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await wait(20);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

function makeAsset(assetPath, bytes) {
  const normalized = Buffer.from(bytes);
  const type = MIME_BY_EXTENSION.get(path.posix.extname(assetPath).toLowerCase());
  assert.ok(type, `Fixture has no MIME mapping for ${assetPath}`);
  return {
    path: assetPath,
    kind: type[0],
    mime: type[1],
    size: normalized.length,
    sha256: sha256Bytes(normalized)
  };
}

function makeManifest(gameId, releaseId, assets, createdAt = CREATED_AT) {
  const sortedAssets = [...assets].sort((left, right) => left.path.localeCompare(right.path, 'en'));
  const byKind = {
    image: { files: 0, bytes: 0 },
    audio: { files: 0, bytes: 0 },
    video: { files: 0, bytes: 0 },
    font: { files: 0, bytes: 0 }
  };
  let totalBytes = 0;
  for (const asset of sortedAssets) {
    byKind[asset.kind].files += 1;
    byKind[asset.kind].bytes += asset.size;
    totalBytes += asset.size;
  }
  const document = {
    schema: 1,
    gameId,
    releaseId,
    createdAt,
    assetSetSha256: sha256Bytes(JSON.stringify(sortedAssets)),
    totalFiles: sortedAssets.length,
    totalBytes,
    byKind,
    assets: sortedAssets
  };
  return { document, bytes: Buffer.from(canonicalJson(document)) };
}

function makeCatalog(cardManifest, cardFileName, boardManifest, boardFileName) {
  const createdAt = new Date(Math.max(
    Date.parse(cardManifest.document.createdAt),
    Date.parse(boardManifest.document.createdAt)
  )).toISOString();
  return {
    schema: 1,
    createdAt,
    sourceTrees: {
      images: '1'.repeat(40),
      audio: '2'.repeat(40),
      videos: '3'.repeat(40),
      fonts: '4'.repeat(40)
    },
    games: {
      card: {
        releaseId: cardManifest.document.releaseId,
        manifestPath: `desktop/manifests/${cardFileName}`,
        manifestSha256: sha256Bytes(cardManifest.bytes),
        totalFiles: cardManifest.document.totalFiles,
        totalBytes: cardManifest.document.totalBytes
      },
      board: {
        releaseId: boardManifest.document.releaseId,
        manifestPath: `desktop/manifests/${boardFileName}`,
        manifestSha256: sha256Bytes(boardManifest.bytes),
        totalFiles: boardManifest.document.totalFiles,
        totalBytes: boardManifest.document.totalBytes
      },
      chess: { available: false }
    }
  };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function runStrictValidationChecks(validCatalog, validManifest) {
  assert.equal(validateCatalog(validCatalog).games.card.releaseId, validCatalog.games.card.releaseId);
  assert.equal(validateManifest(validManifest, 'card').releaseId, validManifest.releaseId);

  const unsafeCatalog = clone(validCatalog);
  unsafeCatalog.games.card.manifestPath = '../card.json';
  assert.throws(() => validateCatalog(unsafeCatalog), /card/);

  const badSetDigest = clone(validManifest);
  badSetDigest.assetSetSha256 = '0'.repeat(64);
  assert.throws(() => validateManifest(badSetDigest, 'card'), /摘要/);

  const traversal = clone(validManifest);
  traversal.assets[0].path = 'images/../outside.png';
  traversal.assets[0].kind = 'image';
  traversal.assets[0].mime = 'image/png';
  traversal.assetSetSha256 = sha256Bytes(JSON.stringify(traversal.assets));
  assert.throws(() => validateManifest(traversal, 'card'), /無效素材/);

  const duplicate = clone(validManifest);
  const firstImage = duplicate.assets.find((asset) => asset.kind === 'image');
  assert.ok(firstImage, 'Fixture needs an image for duplicate-path validation.');
  duplicate.assets = [
    { ...firstImage, path: 'images/Duplicate.png' },
    { ...firstImage, path: 'images/duplicate.png' }
  ];
  duplicate.assets.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  duplicate.totalFiles = duplicate.assets.length;
  duplicate.totalBytes = duplicate.assets.reduce((sum, asset) => sum + asset.size, 0);
  duplicate.byKind = {
    image: { files: 2, bytes: duplicate.totalBytes },
    audio: { files: 0, bytes: 0 },
    video: { files: 0, bytes: 0 },
    font: { files: 0, bytes: 0 }
  };
  duplicate.assetSetSha256 = sha256Bytes(JSON.stringify(duplicate.assets));
  assert.throws(() => validateManifest(duplicate, 'card'), /重複路徑/);
}

class FixtureServer {
  constructor() {
    this.catalog = null;
    this.manifests = new Map();
    this.assets = new Map();
    this.assetRequests = new Map();
    this.rangeRequests = [];
    this.slowPaths = new Set();
    this.failureResponses = new Map();
    this.hangBeforeHeaders = new Map();
    this.server = http.createServer((request, response) => this.handle(request, response));
    this.origin = '';
  }

  async start() {
    await new Promise((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(0, '127.0.0.1', resolve);
    });
    const address = this.server.address();
    this.origin = `http://127.0.0.1:${address.port}`;
  }

  async close() {
    await new Promise((resolve) => this.server.close(resolve));
  }

  resetAssetRequests() {
    this.assetRequests.clear();
    this.rangeRequests.length = 0;
  }

  count(assetPath) {
    return this.assetRequests.get(assetPath) || 0;
  }

  failNext(fixturePath, count, status = 503) {
    this.failureResponses.set(fixturePath, { remaining: count, status });
  }

  hangNext(fixturePath, count = 1) {
    this.hangBeforeHeaders.set(fixturePath, count);
  }

  handle(request, response) {
    const url = new URL(request.url, this.origin || 'http://127.0.0.1');
    let fixturePath;
    try {
      fixturePath = decodeURIComponent(url.pathname.replace(/^\/+/, ''));
    } catch {
      response.writeHead(400).end();
      return;
    }

    if (fixturePath === 'desktop/catalog-v1.json') {
      const body = Buffer.from(canonicalJson(this.catalog));
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store'
      });
      response.end(body);
      return;
    }

    if (fixturePath.startsWith('desktop/manifests/')) {
      const hangs = this.hangBeforeHeaders.get(fixturePath) || 0;
      if (hangs > 0) {
        this.hangBeforeHeaders.set(fixturePath, hangs - 1);
        request.once('close', () => response.destroy());
        return;
      }
      const body = this.manifests.get(fixturePath);
      if (!body) {
        response.writeHead(404).end();
        return;
      }
      response.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': body.length,
        'Cache-Control': 'no-store'
      });
      response.end(body);
      return;
    }

    const body = this.assets.get(fixturePath);
    if (!body) {
      response.writeHead(404).end();
      return;
    }
    this.assetRequests.set(fixturePath, this.count(fixturePath) + 1);

    const hangs = this.hangBeforeHeaders.get(fixturePath) || 0;
    if (hangs > 0) {
      this.hangBeforeHeaders.set(fixturePath, hangs - 1);
      request.once('close', () => response.destroy());
      return;
    }
    const failure = this.failureResponses.get(fixturePath);
    if (failure?.remaining > 0) {
      failure.remaining -= 1;
      response.writeHead(failure.status, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Retry-After': '0',
        'Cache-Control': 'no-store'
      });
      response.end(`fixture HTTP ${failure.status}`);
      return;
    }

    const rangeHeader = request.headers.range;
    let start = 0;
    let status = 200;
    if (rangeHeader) {
      const match = /^bytes=(\d+)-$/.exec(rangeHeader);
      if (!match || Number(match[1]) >= body.length) {
        response.writeHead(416, { 'Content-Range': `bytes */${body.length}` }).end();
        return;
      }
      start = Number(match[1]);
      status = 206;
      this.rangeRequests.push({ path: fixturePath, header: rangeHeader, start });
    }

    const headers = {
      'Content-Type': MIME_BY_EXTENSION.get(path.posix.extname(fixturePath).toLowerCase())?.[1] || 'application/octet-stream',
      'Content-Length': body.length - start,
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'no-store'
    };
    if (status === 206) headers['Content-Range'] = `bytes ${start}-${body.length - 1}/${body.length}`;
    response.writeHead(status, headers);

    if (!this.slowPaths.has(fixturePath)) {
      response.end(body.subarray(start));
      return;
    }

    let cursor = start;
    let timer = null;
    const pump = () => {
      if (response.destroyed || response.writableEnded) return;
      if (cursor >= body.length) {
        response.end();
        return;
      }
      const end = Math.min(cursor + 16 * 1024, body.length);
      const canContinue = response.write(body.subarray(cursor, end));
      cursor = end;
      if (canContinue) timer = setTimeout(pump, 8);
      else response.once('drain', () => { timer = setTimeout(pump, 8); });
    };
    response.once('close', () => { if (timer) clearTimeout(timer); });
    pump();
  }
}

async function writeBundledCatalog(root, catalog, manifests) {
  await fsp.mkdir(path.join(root, 'manifests'), { recursive: true });
  await fsp.writeFile(path.join(root, 'catalog-v1.json'), canonicalJson(catalog));
  for (const [fileName, bytes] of manifests) {
    await fsp.writeFile(path.join(root, 'manifests', fileName), bytes);
  }
}

async function waitForInstall(store, gameId, expectedStatus = 'installed') {
  await waitUntil(() => !store.activeInstall, `${gameId} install worker`);
  const state = store.gameStates.get(gameId);
  assert.equal(state?.status, expectedStatus, `${gameId} ended in ${state?.status}: ${state?.message || ''}`);
  return state;
}

async function listFiles(root) {
  const result = [];
  async function walk(directory) {
    let entries;
    try {
      entries = await fsp.readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) await walk(entryPath);
      else if (entry.isFile()) result.push(entryPath);
    }
  }
  await walk(root);
  return result;
}

async function createTemporaryRoot() {
  const preferred = process.platform === 'win32' && fs.existsSync('D:\\')
    ? 'D:\\Codex_BuildCache\\qa'
    : path.join(os.tmpdir(), 'codex-qa');
  await fsp.mkdir(preferred, { recursive: true });
  return fsp.mkdtemp(path.join(preferred, 'desktop-asset-store-'));
}

async function main() {
  const temporaryRoot = await createTemporaryRoot();
  const fixture = new FixtureServer();
  try {
    const bundledRoot = path.join(temporaryRoot, 'bundled');
    const cacheRoot = path.join(temporaryRoot, 'cache');

    const sharedBytes = Buffer.from('shared-launcher-art-v1');
    const initialVersionBytes = Buffer.from('card-version-one-content');
    const updatedVersionBytes = Buffer.from('card-version-two-content');
    const boardFontBytes = Buffer.from('board-font-fixture');
    const slowAudioBytes = Buffer.alloc(3 * 1024 * 1024);
    for (let index = 0; index < slowAudioBytes.length; index += 1) slowAudioBytes[index] = index % 251;

    const slowAudio = makeAsset('audio/card-theme.mp3', slowAudioBytes);
    const shared = makeAsset('images/shared.png', sharedBytes);
    const initialVersion = makeAsset('images/version.png', initialVersionBytes);
    const updatedVersion = makeAsset('images/version.png', updatedVersionBytes);
    const boardFont = makeAsset('fonts/board.woff2', boardFontBytes);

    const cardV1File = 'card-assets-v1.json';
    const cardV2File = 'card-assets-v2.json';
    const boardV1File = 'board-assets-v1.json';
    const cardV1 = makeManifest('card', 'assets-card-v1', [slowAudio, shared, initialVersion]);
    const cardV2 = makeManifest('card', 'assets-card-v2', [slowAudio, shared, updatedVersion], UPDATED_AT);
    const boardV1 = makeManifest('board', 'assets-board-v1', [boardFont, shared]);
    const catalogV1 = makeCatalog(cardV1, cardV1File, boardV1, boardV1File);
    const catalogV2 = makeCatalog(cardV2, cardV2File, boardV1, boardV1File);

    runStrictValidationChecks(catalogV1, cardV1.document);
    await writeBundledCatalog(bundledRoot, catalogV1, [
      [cardV1File, cardV1.bytes],
      [boardV1File, boardV1.bytes]
    ]);

    fixture.catalog = catalogV1;
    fixture.manifests.set(`desktop/manifests/${cardV1File}`, cardV1.bytes);
    fixture.manifests.set(`desktop/manifests/${cardV2File}`, cardV2.bytes);
    fixture.manifests.set(`desktop/manifests/${boardV1File}`, boardV1.bytes);
    fixture.assets.set(slowAudio.path, slowAudioBytes);
    fixture.assets.set(shared.path, sharedBytes);
    fixture.assets.set(initialVersion.path, initialVersionBytes);
    fixture.assets.set(boardFont.path, boardFontBytes);
    fixture.slowPaths.add(slowAudio.path);
    await fixture.start();

    const store = new AssetStore({
      origin: fixture.origin,
      bundledCatalogRoot: bundledRoot,
      cacheRoot,
      integrityAuditMaxFiles: 0,
      downloadRequestTimeoutMs: 150,
      downloadIdleTimeoutMs: 500,
      downloadRetryBaseMs: 10
    });
    await store.init();
    assert.equal(store.catalogSource, 'bundled');

    const invalidRemoteCatalog = clone(catalogV1);
    invalidRemoteCatalog.games.board.manifestPath = '../../outside.json';
    fixture.catalog = invalidRemoteCatalog;
    const rejectedCatalog = await store.refreshRemoteCatalog();
    assert.equal(rejectedCatalog.ok, false, 'Unsafe remote catalog must be rejected.');
    assert.equal(store.catalogSource, 'bundled', 'Rejected catalog must not replace the trusted bundled catalog.');

    fixture.catalog = catalogV1;
    const acceptedCatalog = await store.refreshRemoteCatalog();
    assert.equal(acceptedCatalog.ok, true, 'Valid remote catalog should be accepted.');
    assert.equal(store.catalogSource, 'remote');

    let pauseTriggered = false;
    const pauseListener = (progress) => {
      if (
        !pauseTriggered && progress.gameId === 'card' && progress.status === 'downloading' &&
        progress.currentFile === path.posix.basename(slowAudio.path) && progress.downloadedBytes > 64 * 1024
      ) {
        pauseTriggered = true;
        store.cancelInstall('card');
      }
    };
    store.on('progress', pauseListener);
    assert.equal(store.installGame('card').ok, true);
    await waitUntil(() => !store.activeInstall && store.gameStates.get('card')?.status === 'paused', 'paused card download');
    store.off('progress', pauseListener);
    assert.equal(pauseTriggered, true, 'The test must interrupt an in-flight download.');
    const partialPath = path.join(cacheRoot, 'partial', `${slowAudio.sha256}.part`);
    const partialSize = (await fsp.stat(partialPath)).size;
    assert.ok(partialSize > 0 && partialSize < slowAudio.size, 'Interrupted download should leave a reusable partial file.');

    assert.equal(store.installGame('card').ok, true);
    await waitForInstall(store, 'card');
    assert.ok(
      fixture.rangeRequests.some((request) => request.path === slowAudio.path && request.start === partialSize),
      'Resumed install must request exactly the remaining byte range.'
    );
    assert.equal(await sha256File(blobPath(cacheRoot, slowAudio.sha256)), slowAudio.sha256);

    const sharedRequestsBeforeBoard = fixture.count(shared.path);
    fixture.hangNext(boardFont.path, 1);
    assert.equal(store.installGame('board').ok, true);
    await waitForInstall(store, 'board');
    assert.equal(fixture.count(boardFont.path), 2, 'A request timeout must resume through the bounded retry path.');
    assert.equal(
      fixture.count(shared.path),
      sharedRequestsBeforeBoard,
      'Board install must reuse the card game shared content-addressed blob.'
    );
    assert.ok(await store.resolveAsset('card', shared.path));
    assert.ok(await store.resolveAsset('board', shared.path));
    const blobFiles = await listFiles(path.join(cacheRoot, 'blobs', 'sha256'));
    assert.equal(blobFiles.length, 4, 'Two games should store four unique blobs, not five logical paths.');

    fixture.catalog = catalogV2;
    fixture.manifests.set(`desktop/manifests/${cardV2File}`, Buffer.from('{}\n'));
    assert.equal(
      (await store.refreshRemoteCatalog()).ok,
      false,
      'A catalog must not become current until every referenced manifest passes its digest and schema checks.'
    );
    assert.equal(store.catalog.games.card.releaseId, 'assets-card-v1', 'Rejected remote metadata must preserve the last-known-good catalog.');
    fixture.manifests.set(`desktop/manifests/${cardV2File}`, cardV2.bytes);
    assert.equal((await store.refreshRemoteCatalog()).ok, true);
    assert.equal(store.gameStates.get('card')?.status, 'update');
    fixture.assets.set(updatedVersion.path, updatedVersionBytes);
    fixture.resetAssetRequests();
    fixture.failNext(updatedVersion.path, 2, 503);

    assert.equal(store.installGame('card').ok, true);
    await waitForInstall(store, 'card');
    assert.equal(fixture.count(updatedVersion.path), 3, 'Transient HTTP 5xx failures must stop after bounded retry and then succeed.');
    assert.equal(fixture.count(shared.path), 0, 'Update must reuse the unchanged shared image blob.');
    assert.equal(fixture.count(slowAudio.path), 0, 'Update must reuse the unchanged audio blob.');
    assert.equal(store.receipts.get('card')?.releaseId, 'assets-card-v2');

    const integrityPath = path.join(cacheRoot, 'state', 'blob-integrity-v1.json');
    const integrityDocument = JSON.parse(await fsp.readFile(integrityPath, 'utf8'));
    const parsedIntegrity = validateIntegrityDocument(integrityDocument);
    assert.ok(parsedIntegrity.records.size >= 4, 'Successful installs must persist verified blob fingerprints.');
    const tamperedIntegrity = clone(integrityDocument);
    tamperedIntegrity.records[0].size += 1;
    assert.throws(() => validateIntegrityDocument(tamperedIntegrity), /摘要不符/);

    let restartHashCalls = 0;
    const restartedStore = new AssetStore({
      origin: 'http://127.0.0.1:1',
      bundledCatalogRoot: bundledRoot,
      cacheRoot,
      fetchImpl: async () => { throw new TypeError('offline fixture'); },
      hashFileImpl: async (filePath, signal) => {
        restartHashCalls += 1;
        return sha256File(filePath, signal);
      },
      integrityAuditMaxFiles: 0,
      downloadRequestTimeoutMs: 150,
      downloadIdleTimeoutMs: 500,
      downloadRetryBaseMs: 10
    });
    await restartedStore.init();
    assert.equal(restartedStore.catalogSource, 'cached', 'Offline restart must load the last-known-good remote catalog.');
    assert.equal(restartedStore.catalog.games.card.releaseId, 'assets-card-v2');
    assert.equal(restartedStore.gameStates.get('card')?.status, 'installed');
    assert.equal(restartedStore.canLaunch('card'), true);
    const hotPaths = [slowAudio.path, shared.path, updatedVersion.path, boardFont.path];
    await Promise.all(Array.from({ length: 12 }, () => Promise.all(hotPaths.map((assetPath) => (
      restartedStore.resolveAsset(assetPath === boardFont.path ? 'board' : 'card', assetPath)
    )))));
    assert.equal(restartHashCalls, 0, 'Restarted request hot path must trust unchanged persistent fingerprints without hashing each blob.');
    assert.equal((await restartedStore.refreshRemoteCatalog()).ok, false);
    assert.equal(restartedStore.catalogSource, 'cached', 'Offline refresh must not replace last-known-good metadata with bundled data.');
    assert.equal(restartedStore.catalog.games.card.releaseId, 'assets-card-v2');

    const latestCatalog = restartedStore.catalog;
    const latestManifestCache = restartedStore.cachedManifests;
    restartedStore.catalog = validateCatalog(catalogV1);
    restartedStore.catalogSource = 'bundled';
    restartedStore.cachedManifests = new Map();
    await assert.rejects(
      restartedStore.getManifest('card'),
      /阻止降版/,
      'Bundled release A must never be installable over newer installed release B.'
    );
    restartedStore.catalog = latestCatalog;
    restartedStore.catalogSource = 'cached';
    restartedStore.cachedManifests = latestManifestCache;

    const resolvedBeforeCorruption = await restartedStore.resolveAsset('card', updatedVersion.path);
    assert.ok(resolvedBeforeCorruption);
    const corruptBytes = Buffer.alloc(updatedVersion.size, 0x5a);
    assert.notEqual(sha256Bytes(corruptBytes), updatedVersion.sha256);
    await wait(25);
    await fsp.writeFile(resolvedBeforeCorruption.filePath, corruptBytes);
    const future = new Date(Date.now() + 2_000);
    await fsp.utimes(resolvedBeforeCorruption.filePath, future, future);
    assert.equal(await restartedStore.resolveAsset('card', updatedVersion.path), null, 'Same-size corruption must be detected on asset resolution.');
    assert.equal(restartHashCalls, 1, 'Only the changed blob may be hashed on the hot path.');
    assert.equal(restartedStore.gameStates.get('card')?.status, 'repair');
    assert.equal(restartedStore.gameStates.get('card')?.hasInstalled, false);
    assert.equal(restartedStore.canLaunch('card'), false, 'Repair-required game must not launch.');

    fixture.resetAssetRequests();
    restartedStore.origin = fixture.origin;
    restartedStore.fetchImpl = globalThis.fetch;
    const repairStatuses = [];
    restartedStore.on('progress', (progress) => {
      if (progress.gameId === 'card') repairStatuses.push(progress.status);
    });
    assert.equal(restartedStore.installGame('card').ok, true);
    assert.equal(restartedStore.canLaunch('card'), false, 'A game must remain blocked while repair is preparing or downloading.');
    await waitUntil(() => !restartedStore.activeInstall, 'card repair worker');
    const repairedState = restartedStore.gameStates.get('card');
    if (repairedState?.status !== 'installed') {
      throw new Error(
        `REPAIR_FAILED: a same-size corrupt blob was detected but not redownloaded ` +
        `(status=${repairedState?.status}, message=${repairedState?.message || ''}).`
      );
    }
    assert.equal(repairStatuses[0], 'preparing', 'Install must enter a cancellable preparing state before manifest and blob checks.');
    assert.equal(fixture.count(updatedVersion.path), 1, 'Repair must redownload the corrupt blob only.');
    assert.ok(await restartedStore.resolveAsset('card', updatedVersion.path));
    assert.equal(restartedStore.canLaunch('card'), true);

    let boundedAuditHashes = 0;
    const auditStore = new AssetStore({
      origin: fixture.origin,
      bundledCatalogRoot: bundledRoot,
      cacheRoot,
      hashFileImpl: async (filePath, signal) => {
        boundedAuditHashes += 1;
        return sha256File(filePath, signal);
      },
      integrityAuditMaxFiles: 2,
      integrityAuditMaxBytes: 64 * 1024 * 1024
    });
    await auditStore.init();
    const auditResult = await auditStore.backgroundAuditPromise;
    assert.ok(
      auditResult.files > 0 && auditResult.files <= 2 && boundedAuditHashes === auditResult.files,
      'Background audit must hash sequentially and stop at its configured file limit.'
    );

    const manifestProbe = new AssetStore({
      origin: fixture.origin,
      bundledCatalogRoot: bundledRoot,
      cacheRoot: path.join(temporaryRoot, 'manifest-probe-cache'),
      integrityAuditMaxFiles: 0,
      manifestTimeoutMs: 100,
      downloadRequestTimeoutMs: 150,
      downloadIdleTimeoutMs: 500,
      downloadRetryBaseMs: 10
    });
    await manifestProbe.init();
    manifestProbe.catalog = validateCatalog(catalogV2);
    manifestProbe.catalogSource = 'remote';
    manifestProbe.cachedManifests.clear();
    fixture.hangNext(`desktop/manifests/${cardV2File}`);
    const manifestAbort = new AbortController();
    const abortedManifest = manifestProbe.getManifest('card', { signal: manifestAbort.signal });
    setTimeout(() => manifestAbort.abort(), 25);
    await assert.rejects(abortedManifest, (error) => error?.name === 'AbortError', 'Manifest request must honor install cancellation.');
    fixture.hangNext(`desktop/manifests/${cardV2File}`);
    await assert.rejects(manifestProbe.getManifest('card'), /清單下載逾時/, 'Manifest request must have a bounded timeout.');

    fixture.hangNext(`desktop/manifests/${cardV2File}`);
    assert.equal(manifestProbe.installGame('card').ok, true);
    assert.equal(manifestProbe.gameStates.get('card')?.status, 'preparing');
    assert.equal(manifestProbe.cancelInstall('card').ok, true);
    await waitUntil(() => !manifestProbe.activeInstall, 'cancelled preparing worker');
    assert.equal(manifestProbe.gameStates.get('card')?.status, 'paused');
    assert.equal(manifestProbe.canLaunch('card'), false);

    const mismatchRoot = path.join(temporaryRoot, 'hash-mismatch-cache');
    const mismatchStore = new AssetStore({
      origin: fixture.origin,
      bundledCatalogRoot: bundledRoot,
      cacheRoot: mismatchRoot,
      integrityAuditMaxFiles: 0,
      downloadRequestTimeoutMs: 150,
      downloadIdleTimeoutMs: 500,
      downloadRetryBaseMs: 10
    });
    fixture.assets.set(updatedVersion.path, corruptBytes);
    fixture.resetAssetRequests();
    await assert.rejects(
      mismatchStore.downloadBlob(updatedVersion, new AbortController().signal, () => {}),
      /下載驗證失敗/,
      'Hash mismatch must fail closed.'
    );
    assert.equal(fixture.count(updatedVersion.path), 1, 'Hash mismatch must not be blindly retried.');
    fixture.assets.set(updatedVersion.path, updatedVersionBytes);

    console.log(
      `DESKTOP_ASSET_STORE_QA=PASS pauseResume=PASS dedup=PASS retryTimeout=PASS update=PASS ` +
      `persistentIntegrity=PASS boundedAudit=PASS lastKnownGood=PASS downgradeGuard=PASS ` +
      `launchGuard=PASS corruptionRepair=PASS uniqueBlobs=${blobFiles.length}`
    );
  } finally {
    await fixture.close().catch(() => {});
    const resolvedTemporaryRoot = path.resolve(temporaryRoot);
    const safeParent = process.platform === 'win32' && fs.existsSync('D:\\')
      ? path.resolve('D:\\Codex_BuildCache\\qa')
      : path.resolve(path.join(os.tmpdir(), 'codex-qa'));
    assert.ok(
      resolvedTemporaryRoot.startsWith(`${safeParent}${path.sep}`),
      `Refusing to recursively remove unexpected QA path: ${resolvedTemporaryRoot}`
    );
    await fsp.rm(resolvedTemporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`DESKTOP_ASSET_STORE_QA=FAIL ${error.stack || error}`);
  process.exitCode = 1;
});
