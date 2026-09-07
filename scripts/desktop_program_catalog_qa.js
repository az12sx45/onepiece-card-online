'use strict';

const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  GAME_IDS,
  canonicalJson,
  sha256Bytes,
  classifyPath,
  calculateByKind,
  validateManifest,
  validateCatalog,
  objectKeyForSha256
} = require('./desktop_program_package_common');
const {
  CONFIG_PATH,
  CATALOG_V3_PATH,
  readGitHeadBlob,
  readCanonicalJson,
  validateConfig,
  validateLegacyCatalog,
  validateLegacyManifest
} = require('./build_desktop_program_catalog');
const {
  validateCatalog: validateRuntimeCatalog,
  validateManifest: validateRuntimeManifest
} = require('../desktop/asset-store');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const PROGRAM_KINDS = new Set(['document', 'style', 'script', 'data', 'wasm']);
const FORBIDDEN_PROGRAM_PATHS = new Set([
  'game_launcher_preview.html',
  'css/game_launcher_preview.css',
  'js/game_launcher_preview.js',
  'css/card-cursor-buggy-v1.css',
  'css/card-cursor-buggy-v2.css',
  'css/board-cursor-nami-v1.css',
  'css/board-cursor-nami-v2.css',
  'css/board_enemy_spawn_designer.css',
  'js/board_map_align.js',
  'js/board_lobby.js'
]);
const NETWORK_PROGRAM_FALLBACKS = Object.freeze({
  card: new Set(['game_launcher_preview.html']),
  board: new Set(),
  chess: new Set()
});

function normalizedLocalReference(sourcePath, reference) {
  const withoutSuffix = String(reference).split(/[?#]/, 1)[0].trim();
  if (
    !withoutSuffix || withoutSuffix.startsWith('#') || withoutSuffix.startsWith('//') ||
    /^[a-z][a-z0-9+.-]*:/i.test(withoutSuffix) || withoutSuffix === '/socket.io/socket.io.js'
  ) return null;
  const candidate = withoutSuffix.startsWith('/')
    ? withoutSuffix.slice(1)
    : path.posix.join(path.posix.dirname(sourcePath), withoutSuffix);
  const normalized = path.posix.normalize(candidate);
  return normalized.startsWith('../') || normalized === '..' ? null : normalized;
}

function scanDirectReferences(gameId, programRecords, allAssetPaths) {
  let externalReferences = 0;
  let checkedLocalReferences = 0;
  let unresolvedMediaReferences = 0;
  const unresolvedMediaPaths = new Set();
  let networkProgramFallbacks = 0;
  for (const record of programRecords) {
    if (!['document', 'style'].includes(record.kind)) continue;
    const text = readGitHeadBlob(record.path).toString('utf8');
    const patterns = record.kind === 'document'
      ? [/(?:src|href)\s*=\s*["']([^"'<>]+)["']/gi]
      : [/url\(\s*["']?([^"')]+)["']?\s*\)/gi, /@import\s+["']([^"']+)["']/gi];
    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        if (match[1].includes('${')) continue;
        if (/^(?:https?:)?\/\//i.test(match[1])) {
          externalReferences += 1;
          continue;
        }
        const localPath = normalizedLocalReference(record.path, match[1]);
        if (!localPath) continue;
        const type = classifyPath(localPath);
        if (!type) continue;
        checkedLocalReferences += 1;
        if (!allAssetPaths.has(localPath)) {
          if (PROGRAM_KINDS.has(type.kind)) {
            if (NETWORK_PROGRAM_FALLBACKS[gameId].has(localPath)) networkProgramFallbacks += 1;
            else assert.fail(`${gameId} direct local program reference is absent from its package: ${record.path} -> ${localPath}`);
            continue;
          }
          unresolvedMediaReferences += 1;
          unresolvedMediaPaths.add(`${record.path}->${localPath}`);
        }
      }
    }
  }
  return { externalReferences, checkedLocalReferences, unresolvedMediaReferences, unresolvedMediaPaths, networkProgramFallbacks };
}

async function fileDigest(filePath) {
  return sha256Bytes(await fsp.readFile(filePath));
}

async function main() {
  const { value: configValue } = await readCanonicalJson(CONFIG_PATH, 'Desktop program package config', 256 * 1024);
  const config = validateConfig(configValue);
  const legacyCatalogPath = path.join(PUBLIC_ROOT, ...config.legacyBaseline.catalogPath.split('/'));
  const legacyBefore = await fsp.readFile(legacyCatalogPath);
  assert.equal(sha256Bytes(legacyBefore), config.legacyBaseline.catalogSha256, 'catalog-v2 compatibility baseline changed');
  const { value: legacyCatalogValue } = await readCanonicalJson(legacyCatalogPath, 'Legacy catalog-v2');
  const legacyCatalog = validateLegacyCatalog(legacyCatalogValue);

  const immutableBefore = new Map();
  for (const gameId of GAME_IDS) {
    const legacyPath = path.join(PUBLIC_ROOT, ...legacyCatalog.games[gameId].manifestPath.split('/'));
    const bytes = await fsp.readFile(legacyPath);
    assert.equal(
      sha256Bytes(bytes),
      config.legacyBaseline.manifestSha256ByGame[gameId],
      `${gameId} legacy manifest compatibility baseline changed`
    );
    immutableBefore.set(legacyPath, bytes);
  }

  const { bytes: catalogBytes, value: catalogValue } = await readCanonicalJson(CATALOG_V3_PATH, 'Catalog v3');
  const catalog = validateCatalog(catalogValue);
  const runtimeCatalog = validateRuntimeCatalog(catalogValue);
  assert.equal(runtimeCatalog.schema, 3, 'Desktop runtime rejected catalog-v3');
  assert.equal(catalogBytes.toString('utf8'), canonicalJson(catalog), 'Catalog v3 is not canonical');
  assert.equal(catalog.assetBlobBaseUrl, legacyCatalog.assetBlobBaseUrl, 'Catalog v3 changed the CAS origin');
  assert.deepEqual(catalog.sourceTrees, legacyCatalog.sourceTrees, 'Catalog v3 changed the media source trees');

  let logicalFiles = 0;
  let logicalBytes = 0;
  let programFiles = 0;
  let programBytes = 0;
  let externalReferences = 0;
  let checkedLocalReferences = 0;
  let unresolvedMediaReferences = 0;
  const unresolvedMediaPaths = new Set();
  let networkProgramFallbacks = 0;
  const uniqueBlobs = new Map();
  for (const gameId of GAME_IDS) {
    const catalogRecord = catalog.games[gameId];
    const manifestPath = path.join(PUBLIC_ROOT, ...catalogRecord.manifestPath.split('/'));
    const { bytes: manifestBytes, value: manifestValue } = await readCanonicalJson(manifestPath, `${gameId} package manifest`);
    assert.equal(sha256Bytes(manifestBytes), catalogRecord.manifestSha256, `${gameId} manifest SHA differs from catalog`);
    const manifest = validateManifest(manifestValue, gameId);
    const runtimeManifest = validateRuntimeManifest(manifestValue, gameId);
    assert.equal(runtimeManifest.schema, 3, `${gameId} desktop runtime rejected package manifest`);
    assert.equal(runtimeManifest.entryPath, manifest.entryPath, `${gameId} desktop runtime changed entryPath`);
    assert.equal(catalogRecord.releaseId, manifest.releaseId, `${gameId} catalog release differs from manifest`);
    assert.equal(catalogRecord.entryPath, manifest.entryPath, `${gameId} catalog entry differs from manifest`);
    assert.equal(catalogRecord.totalFiles, manifest.totalFiles, `${gameId} catalog file total differs from manifest`);
    assert.equal(catalogRecord.totalBytes, manifest.totalBytes, `${gameId} catalog byte total differs from manifest`);

    const legacyRecord = legacyCatalog.games[gameId];
    const legacyManifestPath = path.join(PUBLIC_ROOT, ...legacyRecord.manifestPath.split('/'));
    const { value: legacyManifest } = await readCanonicalJson(legacyManifestPath, `${gameId} legacy manifest`);
    const legacyAssets = validateLegacyManifest(legacyManifest, gameId, legacyRecord);
    const legacyByPath = new Map(legacyAssets.map((asset) => [asset.path, asset]));
    const configured = new Set(config.games[gameId].programFiles);
    const packageByPath = new Map(manifest.assets.map((asset) => [asset.path, asset]));
    assert.equal(config.games[gameId].entryPath, manifest.entryPath, `${gameId} entry differs from config`);
    assert.equal(manifest.assets.length, legacyAssets.length + configured.size, `${gameId} package has an unexpected file count`);

    for (const forbidden of FORBIDDEN_PROGRAM_PATHS) {
      assert.ok(!configured.has(forbidden), `${gameId} package included forbidden preview/obsolete file ${forbidden}`);
    }
    for (const legacyAsset of legacyAssets) {
      assert.deepEqual(packageByPath.get(legacyAsset.path), legacyAsset, `${gameId} changed legacy media metadata: ${legacyAsset.path}`);
    }

    const programRecords = [];
    for (const logicalPath of config.games[gameId].programFiles) {
      const record = packageByPath.get(logicalPath);
      assert.ok(record, `${gameId} package is missing configured program ${logicalPath}`);
      assert.ok(!legacyByPath.has(logicalPath), `${gameId} program collides with legacy media ${logicalPath}`);
      const bytes = readGitHeadBlob(logicalPath);
      assert.equal(record.size, bytes.length, `${gameId} program size differs from Git HEAD: ${logicalPath}`);
      assert.equal(record.sha256, sha256Bytes(bytes), `${gameId} program SHA differs from Git HEAD: ${logicalPath}`);
      assert.equal(record.kind, classifyPath(logicalPath).kind, `${gameId} program kind differs: ${logicalPath}`);
      programRecords.push(record);
      programFiles += 1;
      programBytes += record.size;
    }
    const references = scanDirectReferences(gameId, programRecords, new Set(manifest.assets.map((asset) => asset.path)));
    externalReferences += references.externalReferences;
    checkedLocalReferences += references.checkedLocalReferences;
    unresolvedMediaReferences += references.unresolvedMediaReferences;
    for (const item of references.unresolvedMediaPaths) unresolvedMediaPaths.add(`${gameId}:${item}`);
    networkProgramFallbacks += references.networkProgramFallbacks;
    assert.deepEqual(manifest.byKind, calculateByKind(manifest.assets), `${gameId} byKind differs`);

    logicalFiles += manifest.totalFiles;
    logicalBytes += manifest.totalBytes;
    for (const asset of manifest.assets) {
      assert.equal(objectKeyForSha256(asset.sha256), `desktop/blobs/sha256/${asset.sha256.slice(0, 2)}/${asset.sha256}`);
      const existing = uniqueBlobs.get(asset.sha256);
      if (existing) assert.deepEqual(existing, { size: asset.size, mime: asset.mime }, `CAS metadata conflict for ${asset.sha256}`);
      else uniqueBlobs.set(asset.sha256, { size: asset.size, mime: asset.mime });
    }
  }

  execFileSync(process.execPath, ['scripts/build_desktop_program_catalog.js'], {
    cwd: ROOT,
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  assert.equal(await fileDigest(CATALOG_V3_PATH), sha256Bytes(catalogBytes), 'Deterministic rebuild changed catalog-v3 bytes');
  assert.ok((await fsp.readFile(legacyCatalogPath)).equals(legacyBefore), 'Deterministic rebuild changed catalog-v2 bytes');
  for (const [legacyPath, bytes] of immutableBefore) {
    assert.ok((await fsp.readFile(legacyPath)).equals(bytes), `Deterministic rebuild changed ${legacyPath}`);
  }

  const uniqueBytes = [...uniqueBlobs.values()].reduce((sum, record) => sum + record.size, 0);
  process.stdout.write(
    `DESKTOP_PROGRAM_CATALOG_QA=PASS games=3 programFiles=${programFiles} programBytes=${programBytes} ` +
    `logicalFiles=${logicalFiles} logicalBytes=${logicalBytes} casBlobs=${uniqueBlobs.size} casBytes=${uniqueBytes} ` +
    `localRefs=${checkedLocalReferences} networkProgramFallbacks=${networkProgramFallbacks} ` +
    `unresolvedMediaRefs=${unresolvedMediaReferences} externalRefs=${externalReferences} ` +
    `legacyV2=UNCHANGED runtimeValidation=PASS gitHeadPrograms=PASS deterministic=PASS\n`
  );
  if (unresolvedMediaPaths.size) {
    process.stdout.write(`DESKTOP_PROGRAM_CATALOG_UNRESOLVED_MEDIA=${[...unresolvedMediaPaths].sort().join(',')}\n`);
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_PROGRAM_CATALOG_QA=FAIL ${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
