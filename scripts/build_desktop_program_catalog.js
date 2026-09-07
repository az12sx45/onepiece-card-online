'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  CONFIG_SCHEMA,
  GAME_IDS,
  HASH_PATTERN,
  canonicalJson,
  sha256Bytes,
  comparePaths,
  classifyPath,
  calculateByKind,
  validateAssetRecord,
  validateManifest,
  validateCatalog,
  isPlainObject,
  fail
} = require('./desktop_program_package_common');

const ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.join(ROOT, 'public');
const CONFIG_PATH = path.join(ROOT, 'config', 'desktop-program-packages-v1.json');
const OUTPUT_ROOT = path.join(PUBLIC_ROOT, 'desktop', 'manifests');
const CATALOG_V3_PATH = path.join(PUBLIC_ROOT, 'desktop', 'catalog-v3.json');
const MAX_GIT_BLOB_BYTES = 128 * 1024 * 1024;

function readGitHeadBlob(logicalPath) {
  const spec = `HEAD:public/${logicalPath}`;
  try {
    return execFileSync('git', ['cat-file', 'blob', spec], {
      cwd: ROOT,
      encoding: null,
      maxBuffer: MAX_GIT_BLOB_BYTES,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    const detail = Buffer.isBuffer(error?.stderr) ? error.stderr.toString('utf8').trim() : '';
    fail(`Cannot read Git HEAD blob public/${logicalPath}${detail ? `: ${detail}` : ''}`);
  }
}

async function readCanonicalJson(filePath, label, maximumBytes = 16 * 1024 * 1024) {
  const bytes = await fsp.readFile(filePath);
  if (!bytes.length || bytes.length > maximumBytes) fail(`${label} has an invalid byte length.`);
  let value;
  try {
    value = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
  if (!bytes.equals(Buffer.from(canonicalJson(value), 'utf8'))) fail(`${label} JSON is not canonical.`);
  return { bytes, value };
}

function validateLogicalPath(value, label) {
  const classified = classifyPath(value);
  if (!classified) fail(`${label} contains an unsafe or unsupported path: ${String(value)}`);
  if (value !== value.normalize('NFC')) fail(`${label} path is not NFC-normalized: ${value}`);
  return classified;
}

function validateConfig(config) {
  if (!isPlainObject(config) || Object.keys(config).join(',') !== 'schema,legacyBaseline,games' || config.schema !== CONFIG_SCHEMA) {
    fail('Desktop program package config shape is invalid.');
  }
  const baseline = config.legacyBaseline;
  if (
    !isPlainObject(baseline) || Object.keys(baseline).join(',') !== 'catalogPath,catalogSha256,manifestSha256ByGame' ||
    baseline.catalogPath !== 'desktop/catalog-v2.json' || !HASH_PATTERN.test(String(baseline.catalogSha256 || '')) ||
    !isPlainObject(baseline.manifestSha256ByGame) ||
    Object.keys(baseline.manifestSha256ByGame).join(',') !== GAME_IDS.join(',') ||
    Object.values(baseline.manifestSha256ByGame).some((value) => !HASH_PATTERN.test(String(value || '')))
  ) fail('Desktop program package legacy baseline is invalid.');
  if (!isPlainObject(config.games) || Object.keys(config.games).join(',') !== GAME_IDS.join(',')) {
    fail('Desktop program package games are missing or out of order.');
  }
  for (const gameId of GAME_IDS) {
    const game = config.games[gameId];
    if (!isPlainObject(game) || Object.keys(game).join(',') !== 'entryPath,programFiles' || !Array.isArray(game.programFiles)) {
      fail(`Desktop program package ${gameId} config is invalid.`);
    }
    const entry = validateLogicalPath(game.entryPath, `${gameId}.entryPath`);
    if (entry.kind !== 'document') fail(`${gameId}.entryPath must be an HTML document.`);
    if (!game.programFiles.length || game.programFiles.length > 500) fail(`${gameId}.programFiles count is invalid.`);
    let previous = '';
    const folded = new Set();
    for (const filePath of game.programFiles) {
      validateLogicalPath(filePath, `${gameId}.programFiles`);
      if (previous && comparePaths(previous, filePath) >= 0) fail(`${gameId}.programFiles must be strictly sorted.`);
      previous = filePath;
      const key = filePath.normalize('NFC').toLowerCase();
      if (folded.has(key)) fail(`${gameId}.programFiles contains a case-folded path collision.`);
      folded.add(key);
    }
    if (!folded.has(game.entryPath.normalize('NFC').toLowerCase())) fail(`${gameId}.programFiles does not contain entryPath.`);
  }
  return config;
}

function validateLegacyCatalog(catalog) {
  if (
    !isPlainObject(catalog) || catalog.schema !== 2 || !isPlainObject(catalog.games) ||
    Object.keys(catalog.games).join(',') !== GAME_IDS.join(',') ||
    !isPlainObject(catalog.sourceTrees) || Object.keys(catalog.sourceTrees).join(',') !== 'images,audio,videos,fonts' ||
    typeof catalog.assetBlobBaseUrl !== 'string' || !catalog.assetBlobBaseUrl
  ) fail('Legacy catalog-v2 shape is invalid.');
  return catalog;
}

function validateLegacyManifest(manifest, gameId, catalogRecord) {
  if (
    !isPlainObject(manifest) || manifest.schema !== 1 || manifest.gameId !== gameId ||
    manifest.releaseId !== catalogRecord.releaseId || !Array.isArray(manifest.assets) ||
    manifest.totalFiles !== catalogRecord.totalFiles || manifest.totalBytes !== catalogRecord.totalBytes ||
    sha256Bytes(JSON.stringify(manifest.assets)) !== manifest.assetSetSha256
  ) fail(`Legacy ${gameId} asset manifest is invalid.`);
  return manifest.assets.map((record) => validateAssetRecord(record, `legacy ${gameId} asset`));
}

function programRecordsFromHead(game) {
  return game.programFiles.map((logicalPath) => {
    const type = validateLogicalPath(logicalPath, 'programFiles');
    const bytes = readGitHeadBlob(logicalPath);
    if (!bytes.length) fail(`Git HEAD program file is empty: public/${logicalPath}`);
    return {
      path: logicalPath,
      kind: type.kind,
      mime: type.mime,
      size: bytes.length,
      sha256: sha256Bytes(bytes)
    };
  });
}

function buildManifest(gameId, entryPath, createdAt, legacyAssets, programs) {
  const folded = new Set();
  const assets = [...legacyAssets, ...programs].sort((left, right) => comparePaths(left.path, right.path));
  for (const asset of assets) {
    const key = asset.path.normalize('NFC').toLowerCase();
    if (folded.has(key)) fail(`${gameId} package has a path collision: ${asset.path}`);
    folded.add(key);
  }
  const assetSetSha256 = sha256Bytes(JSON.stringify(assets));
  const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
  if (!Number.isSafeInteger(totalBytes)) fail(`${gameId} package byte total is unsafe.`);
  return {
    schema: 3,
    gameId,
    releaseId: `package-${assetSetSha256.slice(0, 16)}`,
    createdAt,
    entryPath,
    assetSetSha256,
    totalFiles: assets.length,
    totalBytes,
    byKind: calculateByKind(assets),
    assets
  };
}

async function reuseImmutableManifest(outputPath, expected, buildCreatedAt) {
  try {
    const { value: existing } = await readCanonicalJson(outputPath, 'Existing immutable package manifest');
    if (Date.parse(existing.createdAt) > Date.parse(buildCreatedAt)) fail(`Immutable package manifest is newer than this build: ${outputPath}`);
    const expectedWithOriginalTime = { ...expected, createdAt: existing.createdAt };
    if (canonicalJson(existing) !== canonicalJson(expectedWithOriginalTime)) {
      fail(`Immutable package manifest already exists with different content: ${outputPath}`);
    }
    return existing;
  } catch (error) {
    if (error.code === 'ENOENT') return expected;
    throw error;
  }
}

async function writeAtomicJson(outputPath, value, { immutable = false } = {}) {
  const bytes = Buffer.from(canonicalJson(value), 'utf8');
  await fsp.mkdir(path.dirname(outputPath), { recursive: true });
  if (immutable) {
    try {
      const existing = await fsp.readFile(outputPath);
      if (!existing.equals(bytes)) fail(`Refusing to replace immutable JSON: ${outputPath}`);
      return existing;
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  const temporary = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fsp.writeFile(temporary, bytes, { flag: 'wx' });
    if (immutable) {
      try {
        await fsp.rename(temporary, outputPath);
      } catch (error) {
        if (!['EEXIST', 'EPERM'].includes(error.code)) throw error;
        const existing = await fsp.readFile(outputPath);
        if (!existing.equals(bytes)) throw error;
      }
    } else {
      await fsp.rm(outputPath, { force: true });
      await fsp.rename(temporary, outputPath);
    }
  } finally {
    await fsp.rm(temporary, { force: true });
  }
  return bytes;
}

async function main() {
  const { value: configValue } = await readCanonicalJson(CONFIG_PATH, 'Desktop program package config', 256 * 1024);
  const config = validateConfig(configValue);
  const legacyCatalogPath = path.join(PUBLIC_ROOT, ...config.legacyBaseline.catalogPath.split('/'));
  const { bytes: legacyCatalogBytes, value: legacyCatalogValue } = await readCanonicalJson(legacyCatalogPath, 'Legacy catalog-v2');
  if (sha256Bytes(legacyCatalogBytes) !== config.legacyBaseline.catalogSha256) {
    fail('Legacy catalog-v2 bytes changed; refusing to generate a mixed compatibility release.');
  }
  const legacyCatalog = validateLegacyCatalog(legacyCatalogValue);
  const buildCreatedAt = new Date().toISOString();
  const built = Object.create(null);
  const catalogGames = Object.create(null);

  for (const gameId of GAME_IDS) {
    const legacyRecord = legacyCatalog.games[gameId];
    const legacyManifestPath = path.join(PUBLIC_ROOT, ...String(legacyRecord.manifestPath).split('/'));
    const { bytes: legacyManifestBytes, value: legacyManifest } = await readCanonicalJson(
      legacyManifestPath,
      `Legacy ${gameId} manifest`
    );
    const legacyDigest = sha256Bytes(legacyManifestBytes);
    if (
      legacyDigest !== config.legacyBaseline.manifestSha256ByGame[gameId] ||
      legacyDigest !== legacyRecord.manifestSha256
    ) fail(`Legacy ${gameId} manifest bytes changed; refusing compatibility release.`);
    const legacyAssets = validateLegacyManifest(legacyManifest, gameId, legacyRecord);
    const programs = programRecordsFromHead(config.games[gameId]);
    let manifest = buildManifest(
      gameId,
      config.games[gameId].entryPath,
      buildCreatedAt,
      legacyAssets,
      programs
    );
    const filename = `${gameId}-${manifest.releaseId}.json`;
    const outputPath = path.join(OUTPUT_ROOT, filename);
    manifest = await reuseImmutableManifest(outputPath, manifest, buildCreatedAt);
    validateManifest(manifest, gameId);
    const manifestBytes = await writeAtomicJson(outputPath, manifest, { immutable: true });
    built[gameId] = { legacyAssets, programs, manifest };
    catalogGames[gameId] = {
      releaseId: manifest.releaseId,
      manifestPath: `desktop/manifests/${filename}`,
      manifestSha256: sha256Bytes(manifestBytes),
      entryPath: manifest.entryPath,
      totalFiles: manifest.totalFiles,
      totalBytes: manifest.totalBytes
    };
  }

  const catalog = {
    schema: 3,
    createdAt: new Date(Math.max(...GAME_IDS.map((gameId) => Date.parse(built[gameId].manifest.createdAt)))).toISOString(),
    assetBlobBaseUrl: legacyCatalog.assetBlobBaseUrl,
    sourceTrees: legacyCatalog.sourceTrees,
    games: catalogGames
  };
  validateCatalog(catalog);
  await writeAtomicJson(CATALOG_V3_PATH, catalog);

  const legacyCatalogAfter = await fsp.readFile(legacyCatalogPath);
  if (!legacyCatalogAfter.equals(legacyCatalogBytes)) fail('Legacy catalog-v2 changed during generation.');
  for (const gameId of GAME_IDS) {
    const summary = built[gameId];
    process.stdout.write(
      `${gameId}: release=${summary.manifest.releaseId} programs=${summary.programs.length} ` +
      `programBytes=${summary.programs.reduce((sum, item) => sum + item.size, 0)} ` +
      `media=${summary.legacyAssets.length} totalFiles=${summary.manifest.totalFiles} totalBytes=${summary.manifest.totalBytes}\n`
    );
  }
  process.stdout.write(`DESKTOP_PROGRAM_CATALOG_BUILD=PASS catalog=${path.relative(ROOT, CATALOG_V3_PATH)}\n`);
  return { catalog, built };
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`DESKTOP_PROGRAM_CATALOG_BUILD=FAIL ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CONFIG_PATH,
  CATALOG_V3_PATH,
  readGitHeadBlob,
  readCanonicalJson,
  validateConfig,
  validateLegacyCatalog,
  validateLegacyManifest,
  programRecordsFromHead,
  buildManifest,
  main
};
