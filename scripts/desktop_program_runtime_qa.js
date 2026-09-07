'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { AssetStore, validateCatalog, validateManifest, validateRuntimePackageResponse } = require('../desktop/asset-store');
const { RuntimeAssetCache } = require('../desktop/runtime-asset-cache');
const { HttpsProgramRuntime, requestPathForOrigin } = require('../desktop/program-runtime');

const ORIGIN = 'https://onepiece-card-online.onrender.com';
const HASH = /^[a-f0-9]{64}$/;

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function byKind(assets) {
  const result = Object.fromEntries(
    ['document', 'style', 'script', 'data', 'wasm', 'image', 'audio', 'video', 'font']
      .map((kind) => [kind, { files: 0, bytes: 0 }])
  );
  for (const asset of assets) {
    result[asset.kind].files += 1;
    result[asset.kind].bytes += asset.size;
  }
  return result;
}

function makeManifest(records, gameId = 'card') {
  const assets = [...records].sort((left, right) => left.path.localeCompare(right.path, 'en'));
  const assetSetSha256 = digest(Buffer.from(JSON.stringify(assets)));
  return {
    schema: 3,
    gameId,
    releaseId: `package-${assetSetSha256.slice(0, 16)}`,
    createdAt: '2026-09-07T00:00:00.000Z',
    entryPath: 'start.html',
    assetSetSha256,
    totalFiles: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
    byKind: byKind(assets),
    assets
  };
}

async function main() {
  const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'op-program-runtime-'));
  try {
    const sources = new Map([
      ['start.html', { kind: 'document', mime: 'text/html', bytes: Buffer.from('<!doctype html><title>local</title>') }],
      ['app.js', { kind: 'script', mime: 'text/javascript', bytes: Buffer.from('window.localProgram=true;') }],
      ['module.wasm', { kind: 'wasm', mime: 'application/wasm', bytes: Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]) }],
      ['images/piece.webp', { kind: 'image', mime: 'image/webp', bytes: Buffer.from('media') }]
    ]);
    const records = [];
    for (const [logicalPath, source] of sources) {
      const filePath = path.join(temporaryRoot, ...logicalPath.split('/'));
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(filePath, source.bytes);
      records.push({ path: logicalPath, kind: source.kind, mime: source.mime, size: source.bytes.length, sha256: digest(source.bytes) });
    }
    const manifest = validateManifest(makeManifest(records), 'card');
    assert.equal(manifest.schema, 3);
    assert.equal(manifest.entryPath, 'start.html');

    const catalog = validateCatalog({
      schema: 3,
      createdAt: '2026-09-07T00:00:00.000Z',
      assetBlobBaseUrl: 'https://game-assets.rihdi.tw/desktop/blobs/sha256',
      sourceTrees: { images: 'a'.repeat(40), audio: 'b'.repeat(40), videos: 'c'.repeat(40), fonts: 'd'.repeat(40) },
      games: Object.fromEntries(['card', 'board', 'chess'].map((gameId) => [gameId, {
        releaseId: manifest.releaseId,
        manifestPath: `desktop/manifests/${gameId}-package-${'e'.repeat(16)}.json`,
        manifestSha256: 'f'.repeat(64),
        entryPath: gameId === 'card' ? 'start.html' : gameId === 'board' ? 'board_start.html' : 'chess/index.html',
        totalFiles: manifest.totalFiles,
        totalBytes: manifest.totalBytes
      }]))
    });
    assert.equal(catalog.schema, 3);
    assert.equal(catalog.games.chess.entryPath, 'chess/index.html');

    const legacyAsset = records.find((record) => record.kind === 'image');
    const legacyManifest = {
      schema: 1,
      gameId: 'card',
      releaseId: 'assets-legacy',
      createdAt: '2026-09-01T00:00:00.000Z',
      assetSetSha256: digest(Buffer.from(JSON.stringify([legacyAsset]))),
      totalFiles: 1,
      totalBytes: legacyAsset.size,
      byKind: {
        image: { files: 1, bytes: legacyAsset.size },
        audio: { files: 0, bytes: 0 },
        video: { files: 0, bytes: 0 },
        font: { files: 0, bytes: 0 }
      },
      assets: [legacyAsset]
    };
    assert.equal(validateManifest(legacyManifest, 'card').schema, 1, 'legacy installed manifest must remain readable');

    const cache = new RuntimeAssetCache({ maxBytes: 1024 * 1024 });
    cache.buildGame('card', manifest, {
      filePathForAsset: (asset) => path.join(temporaryRoot, ...asset.path.split('/'))
    });
    assert.equal(cache.lookupPath('card', 'app.js').kind, 'script');

    const networkRequests = [];
    const failures = [];
    const runtime = new HttpsProgramRuntime({
      gameId: 'card',
      origin: ORIGIN,
      assetCache: cache,
      networkFetch: async (request) => {
        networkRequests.push(typeof request === 'string' ? request : request.url);
        return new Response('render', { status: 200, headers: { 'X-Fixture-Network': '1' } });
      },
      onFailure: (entry, error) => failures.push({ entry, error })
    });

    const disabled = await runtime.handle(new Request(`${ORIGIN}/start.html`));
    assert.equal(await disabled.text(), 'render');
    assert.equal(networkRequests.length, 1);
    runtime.authorize({
      enabled: true,
      gameId: 'card',
      releaseId: manifest.releaseId,
      manifestSha256: '1'.repeat(64),
      entryPath: manifest.entryPath
    });
    const localDocument = await runtime.handle(new Request(`${ORIGIN}/start.html?desktop=1`));
    assert.equal(localDocument.headers.get('x-onepiece-desktop-program'), 'hit');
    assert.equal(await localDocument.text(), sources.get('start.html').bytes.toString());
    const localScript = await runtime.handle(new Request(`${ORIGIN}/app.js?v=7`));
    assert.equal(localScript.headers.get('content-type'), 'text/javascript');
    assert.equal(await localScript.text(), sources.get('app.js').bytes.toString());
    const localWasm = await runtime.handle(new Request(`${ORIGIN}/module.wasm`));
    assert.deepEqual(Buffer.from(await localWasm.arrayBuffer()), sources.get('module.wasm').bytes);
    const localMedia = await runtime.handle(new Request(`${ORIGIN}/images/piece.webp`));
    assert.equal(localMedia.headers.get('x-onepiece-desktop-program'), 'hit');
    assert.equal(await localMedia.text(), sources.get('images/piece.webp').bytes.toString());
    const apiFallsThrough = await runtime.handle(new Request(`${ORIGIN}/api/profile`));
    assert.equal(apiFallsThrough.headers.get('x-fixture-network'), '1');
    const socketFallsThrough = await runtime.handle(new Request(`${ORIGIN}/socket.io/?EIO=4&transport=polling`));
    assert.equal(socketFallsThrough.headers.get('x-fixture-network'), '1');
    const crossOriginFallsThrough = await runtime.handle(new Request('https://cdn.example.test/app.js'));
    assert.equal(crossOriginFallsThrough.headers.get('x-fixture-network'), '1');
    assert.equal(networkRequests.length, 4);
    assert.equal(requestPathForOrigin(`${ORIGIN}/chess/index.html?v=1`, ORIGIN), 'chess/index.html');
    assert.equal(requestPathForOrigin(`${ORIGIN}/../secret.js`, ORIGIN), 'secret.js');
    assert.equal(requestPathForOrigin('https://elsewhere.invalid/start.html', ORIGIN), null);

    const receipt = {
      schema: 1,
      gameId: 'card',
      releaseId: manifest.releaseId,
      manifestSha256: '2'.repeat(64),
      manifestFile: `card-${manifest.releaseId}.json`,
      installedAt: '2026-09-07T00:00:00.000Z',
      manifest,
      assetIndex: new Map(manifest.assets.map((asset) => [asset.path.toLowerCase(), asset]))
    };
    const store = new AssetStore({
      origin: ORIGIN,
      bundledCatalogRoot: temporaryRoot,
      cacheRoot: path.join(temporaryRoot, 'cache'),
      fetchImpl: async () => new Response('', { status: 503 })
    });
    store.receipts.set('card', receipt);
    const identity = {
      ok: true,
      schema: 1,
      gameId: 'card',
      releaseId: receipt.releaseId,
      manifestSha256: receipt.manifestSha256,
      entryPath: 'start.html'
    };
    assert.equal(validateRuntimePackageResponse(identity, 'card').entryPath, 'start.html');
    assert.throws(
      () => validateRuntimePackageResponse({ ...identity, unexpected: true }, 'card'),
      /格式不正確/,
      'runtime endpoint response must use exact fields'
    );
    let handshakeOptions = null;
    const confirmed = await store.confirmRuntimePackage('card', {
      fetchImpl: async (_url, options) => {
        handshakeOptions = options;
        return new Response(JSON.stringify(identity), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
    });
    assert.equal(confirmed.enabled, true);
    assert.equal(confirmed.releaseId, receipt.releaseId);
    assert.equal(handshakeOptions.cache, 'no-store');
    assert.equal(handshakeOptions.redirect, 'error');
    const mismatch = structuredClone(identity);
    mismatch.releaseId = 'package-newer';
    assert.equal((await store.confirmRuntimePackage('card', {
      fetchImpl: async () => new Response(JSON.stringify(mismatch), { status: 200 })
    })).reason, 'runtime-identity-mismatch');
    assert.equal((await store.confirmRuntimePackage('card', {
      fetchImpl: async () => { throw new Error('offline'); }
    })).reason, 'runtime-identity-unavailable');
    store.receipts.set('card', { ...receipt, manifest: validateManifest(legacyManifest, 'card') });
    assert.equal((await store.confirmRuntimePackage('card')).reason, 'legacy-or-missing-package');

    const bundledV3Store = new AssetStore({
      origin: ORIGIN,
      bundledCatalogRoot: path.join(__dirname, '..', 'public', 'desktop'),
      cacheRoot: path.join(temporaryRoot, 'bundled-v3-cache'),
      fetchImpl: async () => new Response('', { status: 503 }),
      integrityAuditMaxFiles: 0,
      integrityAuditMaxBytes: 0
    });
    await bundledV3Store.init();
    assert.equal(bundledV3Store.catalog.schema, 3);
    assert.equal(bundledV3Store.catalogFile, 'catalog-v3.json');

    const mainSource = await fsp.readFile(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
    assert.match(mainSource, /protocol\.handle\('https'/, 'production must install a per-session HTTPS handler');
    assert.match(mainSource, /bypassCustomProtocolHandlers:\s*true/, 'production network fallback must bypass its HTTPS handler');
    assert.match(mainSource, /confirmRuntimePackage\(gameId/, 'production launch must verify the deployed runtime identity');
    assert.ok(!mainSource.includes('file://'), 'production must never launch a game from file://');

    for (const asset of manifest.assets) assert.match(asset.sha256, HASH);
    process.stdout.write(
      `DESKTOP_PROGRAM_RUNTIME_QA=PASS schema3=PASS bundledV3=PASS legacyReceipt=PASS handshake=exact ` +
      `failOpen=PASS document=local script=local wasm=local media=local api=render socket=render bypass=PASS failures=${failures.length}\n`
    );
  } finally {
    await fsp.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_PROGRAM_RUNTIME_QA=FAIL ${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
