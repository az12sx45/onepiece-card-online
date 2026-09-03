'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_ENTRY_BYTES,
  RuntimeAssetCache
} = require('../desktop/runtime-asset-cache');

const ROOT = path.resolve(__dirname, '..');

function makeAsset(assetPath, bytes, marker) {
  return {
    path: assetPath,
    kind: 'image',
    mime: 'image/png',
    size: bytes.length,
    sha256: crypto.createHash('sha256').update(`${marker}:${bytes.toString('hex')}`).digest('hex')
  };
}

async function responseBytes(response) {
  return Buffer.from(await response.arrayBuffer());
}

function temporaryParentWithSpace() {
  const candidates = [String(process.env.OP_DESKTOP_QA_TEMP_ROOT || '').trim(), os.tmpdir(), path.dirname(ROOT)];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      const space = fs.statfsSync(candidate);
      if (Number(space.bavail) * Number(space.bsize) >= 32 * 1024 * 1024) return candidate;
    } catch {
      // Try the next existing writable location.
    }
  }
  throw new Error('Runtime cache QA needs at least 32 MiB of temporary disk space.');
}

async function main() {
  assert.equal(DEFAULT_MAX_ENTRY_BYTES, 8 * 1024 * 1024, 'Per-entry runtime cache limit changed.');
  assert.equal(DEFAULT_MAX_BYTES, 192 * 1024 * 1024, 'Runtime LRU total limit changed.');

  const temporaryRoot = fs.mkdtempSync(path.join(temporaryParentWithSpace(), 'onepiece-runtime-cache-'));
  try {
    const files = new Map();
    const add = (name, bytes, marker = name) => {
      const filePath = path.join(temporaryRoot, name);
      fs.writeFileSync(filePath, bytes);
      const asset = makeAsset(`images/${name}.png`, bytes, marker);
      files.set(asset.path, filePath);
      return asset;
    };
    const first = add('first', Buffer.from('ABCDEF'));
    const second = add('second', Buffer.from('uvwxyz'));
    const large = add('large', Buffer.from('0123456789ab'));
    const corrupt = makeAsset('images/corrupt.png', Buffer.from('12345'), 'corrupt');
    const corruptPath = path.join(temporaryRoot, 'corrupt');
    fs.writeFileSync(corruptPath, Buffer.from('123'));
    files.set(corrupt.path, corruptPath);

    let readFileCalls = 0;
    let streamCalls = 0;
    const cache = new RuntimeAssetCache({
      maxEntryBytes: 8,
      maxBytes: 10,
      readFileImpl: async (filePath) => {
        readFileCalls += 1;
        return fs.promises.readFile(filePath);
      },
      createReadStreamImpl: (filePath, options) => {
        streamCalls += 1;
        return fs.createReadStream(filePath, options);
      }
    });
    const manifest = { assets: [first, second, large, corrupt] };
    const built = cache.buildGame('card', manifest, { filePathForAsset: (asset) => files.get(asset.path) });
    assert.deepEqual(built, { files: 4, totalBytes: 29 });

    for (let index = 0; index < 1_000; index += 1) {
      assert.equal(cache.lookupPath('card', first.path), cache.lookupToken('card', cache.lookupPath('card', first.path).token));
    }
    assert.equal(readFileCalls, 0, 'Memory route lookup performed file I/O.');
    assert.equal(streamCalls, 0, 'Memory route lookup opened a stream.');

    const firstEntry = cache.lookupPath('card', first.path);
    const head = await cache.createResponse(new Request(`opcache://asset/${firstEntry.token}`, { method: 'HEAD' }), firstEntry, {
      allowedOrigin: 'https://onepiece-card-online.onrender.com'
    });
    assert.equal(head.status, 200);
    assert.equal(head.headers.get('content-length'), '6');
    assert.equal(head.headers.get('x-onepiece-desktop-cache'), 'hit');
    assert.equal((await responseBytes(head)).length, 0);
    assert.equal(readFileCalls, 0, 'HEAD must use manifest metadata without reading the file.');

    const full = await cache.createResponse(new Request(`opcache://asset/${firstEntry.token}`), firstEntry);
    assert.equal(full.status, 200);
    assert.equal((await responseBytes(full)).toString(), 'ABCDEF');
    assert.equal(readFileCalls, 1);

    cache.clearGame('card');
    cache.buildGame('card', manifest, { filePathForAsset: (asset) => files.get(asset.path) });
    const concurrentEntry = cache.lookupPath('card', first.path);
    const [concurrentFirst, concurrentSecond] = await Promise.all([
      cache.createResponse(new Request(`opcache://asset/${concurrentEntry.token}`), concurrentEntry),
      cache.createResponse(new Request(`opcache://asset/${concurrentEntry.token}`), concurrentEntry)
    ]);
    assert.equal((await responseBytes(concurrentFirst)).toString(), 'ABCDEF');
    assert.equal((await responseBytes(concurrentSecond)).toString(), 'ABCDEF');
    assert.equal(readFileCalls, 2, 'Concurrent requests did not share one pending small-asset read.');

    assert.throws(() => cache.buildGame('card', { assets: [{ ...first, size: 0 }] }, {
      filePathForAsset: (asset) => files.get(asset.path)
    }), /Invalid runtime asset record/);
    assert.equal(cache.lookupPath('card', first.path), concurrentEntry, 'A rejected manifest replaced the verified route index.');

    const range = await cache.createResponse(new Request(`opcache://asset/${concurrentEntry.token}`, { headers: { Range: 'bytes=1-3' } }), concurrentEntry);
    assert.equal(range.status, 206);
    assert.equal(range.headers.get('content-range'), 'bytes 1-3/6');
    assert.equal((await responseBytes(range)).toString(), 'BCD');
    assert.equal(readFileCalls, 2, 'Cached Range request reread the small file.');

    const suffix = await cache.createResponse(new Request(`opcache://asset/${concurrentEntry.token}`, { headers: { Range: 'bytes=-2' } }), concurrentEntry);
    assert.equal(suffix.status, 206);
    assert.equal((await responseBytes(suffix)).toString(), 'EF');
    const invalid = await cache.createResponse(new Request(`opcache://asset/${concurrentEntry.token}`, { headers: { Range: 'bytes=99-' } }), concurrentEntry);
    assert.equal(invalid.status, 416);
    assert.equal(invalid.headers.get('content-range'), 'bytes */6');
    assert.equal(readFileCalls, 2);

    const secondEntry = cache.lookupPath('card', second.path);
    await responseBytes(await cache.createResponse(new Request(`opcache://asset/${secondEntry.token}`), secondEntry));
    assert.deepEqual(cache.snapshot(), { games: 1, routes: 4, buffers: 1, bufferBytes: 6, pendingLoads: 0 });
    await responseBytes(await cache.createResponse(new Request(`opcache://asset/${concurrentEntry.token}`), concurrentEntry));
    assert.equal(readFileCalls, 4, 'LRU eviction did not reread the oldest small asset.');
    assert.equal(cache.snapshot().bufferBytes, 6);

    const largeEntry = cache.lookupPath('card', large.path);
    let normalStreamRepairChecks = 0;
    const largeRange = await cache.createResponse(new Request(`opcache://asset/${largeEntry.token}`, { headers: { Range: 'bytes=2-6' } }), largeEntry, {
      onFailure: () => { normalStreamRepairChecks += 1; }
    });
    assert.equal(largeRange.status, 206);
    assert.equal((await responseBytes(largeRange)).toString(), '23456');
    assert.equal(streamCalls, 1, 'Large asset did not use the streaming path.');
    assert.equal(normalStreamRepairChecks, 0, 'Normal large-asset EOF was reported as corruption.');
    assert.equal(cache.snapshot().bufferBytes, 6, 'Large stream entered the small-asset LRU.');

    const cancelBytes = Buffer.alloc(9 * 1024 * 1024, 0x5a);
    const cancelPath = path.join(temporaryRoot, 'cancel-large.bin');
    fs.writeFileSync(cancelPath, cancelBytes);
    const cancelAsset = makeAsset('images/cancel-large.png', cancelBytes, 'cancel-large');
    let cancelSource = null;
    let cancelRepairChecks = 0;
    let resolveSourceClosed;
    const sourceClosed = new Promise((resolve) => { resolveSourceClosed = resolve; });
    const cancelCache = new RuntimeAssetCache({
      createReadStreamImpl: (filePath, options) => {
        cancelSource = fs.createReadStream(filePath, { ...options, highWaterMark: 64 * 1024 });
        cancelSource.once('close', resolveSourceClosed);
        return cancelSource;
      }
    });
    cancelCache.buildGame('card', { assets: [cancelAsset] }, { filePathForAsset: () => cancelPath });
    const cancelEntry = cancelCache.lookupPath('card', cancelAsset.path);
    const cancelResponse = await cancelCache.createResponse(new Request(`opcache://asset/${cancelEntry.token}`), cancelEntry, {
      onFailure: () => { cancelRepairChecks += 1; }
    });
    const cancelReader = cancelResponse.body.getReader();
    const firstChunk = await cancelReader.read();
    assert.equal(firstChunk.done, false);
    assert(firstChunk.value.byteLength > 0 && firstChunk.value.byteLength < cancelAsset.size, 'Cancel fixture completed before cancellation.');
    await cancelReader.cancel('media seek');
    await Promise.race([
      sourceClosed,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Cancelled file stream did not close.')), 2_000))
    ]);
    assert.equal(cancelSource.destroyed, true, 'Cancelling the Web stream did not destroy its file stream.');
    assert.equal(cancelSource.closed, true, 'Cancelling the Web stream left its file descriptor open.');
    assert.equal(cancelRepairChecks, 0, 'Intentional Web stream cancellation was reported as asset corruption.');
    cancelCache.clearAll();

    let repairChecks = 0;
    let repairCode = '';
    const corruptEntry = cache.lookupPath('card', corrupt.path);
    const corruptResponse = await cache.createResponse(new Request(`opcache://asset/${corruptEntry.token}`), corruptEntry, {
      onFailure: (_entry, error) => {
        repairChecks += 1;
        repairCode = error.code;
      }
    });
    assert.equal(corruptResponse.status, 404);
    assert.equal(repairChecks, 1, 'Length mismatch did not request one repair validation.');
    assert.equal(repairCode, 'ERR_RUNTIME_ASSET_LENGTH');

    const finalLruBytes = cache.snapshot().bufferBytes;
    cache.clearGame('card');
    assert.deepEqual(cache.snapshot(), { games: 0, routes: 0, buffers: 0, bufferBytes: 0, pendingLoads: 0 });
    assert.equal(cache.lookupToken('card', concurrentEntry.token), null);

    const mainSource = fs.readFileSync(path.join(ROOT, 'desktop', 'main.js'), 'utf8');
    const hookStart = mainSource.indexOf('targetSession.webRequest.onBeforeRequest(');
    const hookEnd = mainSource.indexOf('gameSessions.set(gameId, targetSession);', hookStart);
    assert(hookStart >= 0 && hookEnd > hookStart, 'Cannot locate the runtime request hook.');
    const hotHook = mainSource.slice(hookStart, hookEnd);
    const prepareStart = mainSource.indexOf('async function prepareGameSession(gameId)');
    const prepareEnd = mainSource.indexOf('function disposeGameSessions()', prepareStart);
    const prepareSection = mainSource.slice(prepareStart, prepareEnd);
    assert(hotHook.includes('runtimeAssetCache.lookupPath(gameId, assetPath)'), 'Runtime request hook does not use the memory route index.');
    for (const forbidden of ['resolveAsset(', 'fsp.stat(', 'sha256File(', 'createHash(']) {
      assert(!hotHook.includes(forbidden), `Runtime request hook contains forbidden hot-path work: ${forbidden}`);
    }
    assert(mainSource.includes('session.fromPartition(GAME_CONFIG[gameId].partition, { cache: false })'), 'Game session must remain in-memory with HTTP disk cache disabled.');
    assert(!mainSource.includes('session.fromPath('), 'A path-backed game session would persist the injected login secret.');
    assert(!/partition:\s*['"]persist:/i.test(mainSource), 'Game session partition must not persist localStorage to disk.');
    assert(!prepareSection.includes("storages: ['localstorage']"), 'Launching a game must preserve non-auth localStorage settings and manual saves.');
    assert(mainSource.includes("storages: ['localstorage']"), 'Logout/cache switching lacks explicit in-memory localStorage cleanup.');
    assert(mainSource.includes('targetSession.setCodeCachePath(sessionPaths.codeCache)'), 'Game code cache is not rooted at the selected asset location.');
    assert(mainSource.includes("path.join(cacheRoot, 'runtime', 'code-cache', gameId)"), 'Game code cache is outside cacheRoot/runtime/code-cache.');
    assert(mainSource.includes("app.setPath('sessionData', sessionDataPath)"), 'Chromium session/GPU cache is not moved to the selected download drive.');
    assert(mainSource.includes("path.resolve(cacheRoot, 'runtime', 'chromium-session-v1')"), 'Chromium session data is outside the selected cache root.');
    assert(mainSource.includes("const SESSION_DATA_PATH = configureSessionDataPath();"), 'Chromium session-data relocation does not run before app readiness.');
    assert(mainSource.includes('runtimeAssetCache.clearAll();'), 'Runtime route cache lacks a full clear path.');
    assert.equal((mainSource.match(/if \(gameWindows\.get\(gameId\) !== window\) return;/g) || []).length, 2, 'Stale game-window events can clear a replacement window route index.');
    assert(mainSource.includes('const failedWindowWasCurrent = gameWindows.get(gameId) === window;'), 'A stale load failure can unregister a replacement game window.');
    assert(mainSource.includes('if (failedWindowWasCurrent && gameWindows.size === 0 && authenticated) {'), 'A stale load failure can overwrite the replacement window presence.');
    assert(mainSource.includes('const hardenedSessions = new WeakSet();'), 'Session hardening lacks identity tracking.');
    assert(mainSource.includes('if (hardenedSessions.has(targetSession)) return;'), 'Repeated cache switches can duplicate session event listeners.');

    console.log(`DESKTOP_RUNTIME_ASSET_CACHE_QA=PASS lookupIo=0 smallReads=${readFileCalls} largeStreams=${streamCalls} cancelClosed=1 cancelRepair=0 repairChecks=${repairChecks} lruBytes=${finalLruBytes} session=memory-only httpCache=off codeCache=selected-root chromiumCache=selected-root windowGuard=1 harden=once`);
  } finally {
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`DESKTOP_RUNTIME_ASSET_CACHE_QA=FAIL ${error.stack || error.message || error}`);
  process.exitCode = 1;
});
