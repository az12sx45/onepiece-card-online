'use strict';

// Local-only endpoint QA. Metadata and program files are supplied by an
// in-memory fs/promises fixture, so corruption cases never alter repository
// files or the immutable package manifests being prepared by another task.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const realFs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ROOT, 'config', 'desktop-program-packages-v1.json');
const CATALOG_PATH = path.join(PUBLIC_ROOT, 'desktop', 'catalog-v3.json');
const GAME_IDS = ['card', 'board', 'chess'];
const KINDS = ['document', 'style', 'script', 'data', 'wasm', 'image', 'audio', 'video', 'font'];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function fixtureKey(filePath) {
  return path.resolve(filePath).normalize('NFC').toLowerCase();
}

function emptyByKind() {
  return Object.fromEntries(KINDS.map((kind) => [kind, { files: 0, bytes: 0 }]));
}

function makeManifest(gameId, entryPath, bytes) {
  const asset = {
    path: entryPath,
    kind: 'document',
    mime: 'text/html',
    size: bytes.length,
    sha256: sha256(bytes),
  };
  const assets = [asset];
  const assetSetSha256 = sha256(JSON.stringify(assets));
  const byKind = emptyByKind();
  byKind.document = { files: 1, bytes: bytes.length };
  return {
    schema: 3,
    gameId,
    releaseId: `package-${assetSetSha256.slice(0, 16)}`,
    createdAt: '2026-09-07T00:00:00.000Z',
    entryPath,
    assetSetSha256,
    totalFiles: 1,
    totalBytes: bytes.length,
    byKind,
    assets,
  };
}

function createFixture() {
  const entryByGame = {
    card: 'start.html',
    board: 'board_start.html',
    chess: 'chess/index.html',
  };
  const records = new Map();
  let clock = 1000;
  const put = (filePath, bytes) => {
    const record = { bytes: Buffer.from(bytes), mtimeMs: clock++, ctimeMs: clock++ };
    records.set(fixtureKey(filePath), record);
    return record;
  };
  const touch = (filePath) => {
    const record = records.get(fixtureKey(filePath));
    assert.ok(record, `missing fixture ${filePath}`);
    record.mtimeMs = clock++;
    record.ctimeMs = clock++;
    return record;
  };
  const manifests = Object.create(null);
  const catalogGames = Object.create(null);
  for (const gameId of GAME_IDS) {
    const entryPath = entryByGame[gameId];
    const programBytes = Buffer.from(`<html><body>${gameId} runtime fixture</body></html>\n`, 'utf8');
    put(path.join(PUBLIC_ROOT, ...entryPath.split('/')), programBytes);
    const manifest = makeManifest(gameId, entryPath, programBytes);
    const manifestBytes = canonicalJson(manifest);
    const manifestPath = `desktop/manifests/${gameId}-${manifest.releaseId}.json`;
    put(path.join(PUBLIC_ROOT, ...manifestPath.split('/')), manifestBytes);
    manifests[gameId] = { manifest, manifestBytes, manifestPath };
    catalogGames[gameId] = {
      releaseId: manifest.releaseId,
      manifestPath,
      manifestSha256: sha256(manifestBytes),
      entryPath,
      totalFiles: manifest.totalFiles,
      totalBytes: manifest.totalBytes,
    };
  }
  const config = {
    schema: 1,
    legacyBaseline: {
      catalogPath: 'desktop/catalog-v2.json',
      catalogSha256: '0'.repeat(64),
      manifestSha256ByGame: Object.fromEntries(GAME_IDS.map((gameId) => [gameId, '0'.repeat(64)])),
    },
    games: Object.fromEntries(GAME_IDS.map((gameId) => [gameId, {
      entryPath: entryByGame[gameId],
      programFiles: [entryByGame[gameId]],
    }])),
  };
  const catalog = {
    schema: 3,
    createdAt: '2026-09-07T00:00:00.000Z',
    assetBlobBaseUrl: 'https://assets.example.test/desktop/blobs/sha256',
    sourceTrees: { images: '1'.repeat(40), audio: '2'.repeat(40), videos: '3'.repeat(40), fonts: '4'.repeat(40) },
    games: catalogGames,
  };
  put(CONFIG_PATH, canonicalJson(config));
  put(CATALOG_PATH, canonicalJson(catalog));
  return { records, touch, entryByGame, manifests };
}

async function main() {
  const protectedPath = path.join(PUBLIC_ROOT, 'start.html');
  const protectedDigestBefore = sha256(realFs.readFileSync(protectedPath));
  const fixture = createFixture();
  const reads = new Map();
  const originalReadFile = fsp.readFile;
  const originalLstat = fsp.lstat;
  const originalCreateServer = http.createServer;
  const previousPort = process.env.PORT;
  const previousDatabaseUrl = process.env.DATABASE_URL;
  const dbPath = require.resolve('../server/db');
  const previousDbModule = require.cache[dbPath];
  let server;

  fsp.readFile = async function fixtureReadFile(filePath, options) {
    const key = fixtureKey(filePath);
    const record = fixture.records.get(key);
    if (!record) return originalReadFile.call(this, filePath, options);
    reads.set(key, (reads.get(key) || 0) + 1);
    const bytes = Buffer.from(record.bytes);
    const encoding = typeof options === 'string' ? options : options?.encoding;
    return encoding ? bytes.toString(encoding) : bytes;
  };
  fsp.lstat = async function fixtureLstat(filePath, options) {
    const record = fixture.records.get(fixtureKey(filePath));
    if (!record) return originalLstat.call(this, filePath, options);
    return {
      size: record.bytes.length,
      mtimeMs: record.mtimeMs,
      ctimeMs: record.ctimeMs,
      isFile: () => true,
    };
  };

  process.env.PORT = '0';
  delete process.env.DATABASE_URL;
  require.cache[dbPath] = {
    id: dbPath,
    filename: dbPath,
    loaded: true,
    exports: { pool: { async query(sql) {
      if (/select\s+now\(\)\s+as\s+now/i.test(String(sql || ''))) {
        return { rows: [{ now: new Date('2026-09-07T00:00:00.000Z') }], rowCount: 1 };
      }
      return { rows: [], rowCount: 0 };
    } } },
  };
  http.createServer = function captureServer(...args) {
    server = originalCreateServer.apply(this, args);
    return server;
  };

  let origin = '';
  try {
    require('../server/index.js');
    http.createServer = originalCreateServer;
    if (!server?.listening) {
      await new Promise((resolve, reject) => {
        server.once('listening', resolve);
        server.once('error', reject);
      });
    }
    origin = `http://127.0.0.1:${server.address().port}`;

    for (const gameId of GAME_IDS) {
      const response = await fetch(`${origin}/api/desktop-runtime-package/${gameId}`);
      assert.equal(response.status, 200, `${gameId} fixture package should validate`);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const result = await response.json();
      assert.deepEqual(result, {
        ok: true,
        schema: 1,
        gameId,
        releaseId: fixture.manifests[gameId].manifest.releaseId,
        manifestSha256: sha256(fixture.manifests[gameId].manifestBytes),
        entryPath: fixture.entryByGame[gameId],
      });
    }

    const cardProgramPath = path.join(PUBLIC_ROOT, fixture.entryByGame.card);
    const cardProgramKey = fixtureKey(cardProgramPath);
    const readsBeforeCacheHit = reads.get(cardProgramKey);
    const cached = await fetch(`${origin}/api/desktop-runtime-package/card`);
    assert.equal(cached.status, 200);
    assert.equal(reads.get(cardProgramKey), readsBeforeCacheHit, 'unchanged file stats should reuse verified cache');

    const metadataReadsBeforeUnknown = reads.get(fixtureKey(CATALOG_PATH));
    const unknown = await fetch(`${origin}/api/desktop-runtime-package/pirate`);
    assert.equal(unknown.status, 404);
    assert.equal(unknown.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await unknown.json(), { ok: false, error: 'unknown_game' });
    assert.equal(reads.get(fixtureKey(CATALOG_PATH)), metadataReadsBeforeUnknown, 'unknown games must not read package metadata');

    const programRecord = fixture.records.get(cardProgramKey);
    const originalProgramBytes = Buffer.from(programRecord.bytes);
    programRecord.bytes[0] ^= 1;
    fixture.touch(cardProgramPath);
    const programTamper = await fetch(`${origin}/api/desktop-runtime-package/card`);
    assert.equal(programTamper.status, 503, 'mtime invalidation must reject same-size program tampering');
    const programFailureText = await programTamper.text();
    assert.match(programFailureText, /desktop_runtime_package_unavailable/);
    assert.ok(!programFailureText.includes(ROOT) && !programFailureText.includes('start.html'), 'failure response leaked a local path');

    programRecord.bytes = Buffer.from(originalProgramBytes);
    fixture.touch(cardProgramPath);
    assert.equal((await fetch(`${origin}/api/desktop-runtime-package/card`)).status, 200, 'repair after failed verification should recover');

    programRecord.bytes = Buffer.concat([originalProgramBytes, Buffer.from('x')]);
    const sizeTamper = await fetch(`${origin}/api/desktop-runtime-package/card`);
    assert.equal(sizeTamper.status, 503, 'size-only stat invalidation must reject program tampering');
    programRecord.bytes = Buffer.from(originalProgramBytes);
    assert.equal((await fetch(`${origin}/api/desktop-runtime-package/card`)).status, 200, 'size repair should recover');

    const manifestPath = path.join(PUBLIC_ROOT, ...fixture.manifests.card.manifestPath.split('/'));
    const manifestRecord = fixture.records.get(fixtureKey(manifestPath));
    const originalManifestBytes = Buffer.from(manifestRecord.bytes);
    manifestRecord.bytes = Buffer.concat([originalManifestBytes, Buffer.from(' ')]);
    fixture.touch(manifestPath);
    const manifestTamper = await fetch(`${origin}/api/desktop-runtime-package/card`);
    assert.equal(manifestTamper.status, 503, 'manifest stat invalidation must re-check catalog SHA');
    const manifestFailureText = await manifestTamper.text();
    assert.ok(!manifestFailureText.includes(ROOT) && !manifestFailureText.includes('.json'), 'manifest failure leaked a local path');
    manifestRecord.bytes = originalManifestBytes;
    fixture.touch(manifestPath);
    assert.equal((await fetch(`${origin}/api/desktop-runtime-package/card`)).status, 200, 'manifest repair should recover');

    const catalogRecord = fixture.records.get(fixtureKey(CATALOG_PATH));
    const originalCatalogBytes = Buffer.from(catalogRecord.bytes);
    const inconsistentManifest = JSON.parse(originalManifestBytes.toString('utf8'));
    inconsistentManifest.totalFiles = 2;
    const inconsistentManifestBytes = canonicalJson(inconsistentManifest);
    const inconsistentCatalog = JSON.parse(originalCatalogBytes.toString('utf8'));
    inconsistentCatalog.games.card.manifestSha256 = sha256(inconsistentManifestBytes);
    inconsistentCatalog.games.card.totalFiles = 2;
    manifestRecord.bytes = inconsistentManifestBytes;
    catalogRecord.bytes = canonicalJson(inconsistentCatalog);
    fixture.touch(manifestPath);
    fixture.touch(CATALOG_PATH);
    const totalsMismatch = await fetch(`${origin}/api/desktop-runtime-package/card`);
    assert.equal(totalsMismatch.status, 503, 'catalog/manifest stat invalidation must re-check manifest totals');
    manifestRecord.bytes = originalManifestBytes;
    catalogRecord.bytes = originalCatalogBytes;
    fixture.touch(manifestPath);
    fixture.touch(CATALOG_PATH);
    assert.equal((await fetch(`${origin}/api/desktop-runtime-package/card`)).status, 200, 'catalog and manifest repair should recover');

    assert.equal(sha256(realFs.readFileSync(protectedPath)), protectedDigestBefore, 'QA modified a repository program file');
    process.stdout.write(
      `DESKTOP_RUNTIME_PACKAGE_ENDPOINT_QA=PASS games=${GAME_IDS.length} success=3 unknown=404 ` +
      'cacheHit=PASS mtimeInvalidation=PASS sizeInvalidation=PASS manifestSha=PASS ' +
      'catalogStat=PASS manifestTotals=PASS failClosed=503 filesUntouched=PASS\n'
    );
  } finally {
    http.createServer = originalCreateServer;
    if (server?.listening) {
      await new Promise((resolve) => {
        server.closeAllConnections?.();
        server.close(resolve);
      });
    }
    fsp.readFile = originalReadFile;
    fsp.lstat = originalLstat;
    if (previousDbModule) require.cache[dbPath] = previousDbModule;
    else delete require.cache[dbPath];
    if (previousPort === undefined) delete process.env.PORT;
    else process.env.PORT = previousPort;
    if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDatabaseUrl;
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_RUNTIME_PACKAGE_ENDPOINT_QA=FAIL ${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
