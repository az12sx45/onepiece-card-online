'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const DEFAULT_REPO_ROOT = path.resolve(__dirname, '..', '..');
const CATALOG_RELATIVE_PATH = 'public/desktop/catalog-v2.json';
const GAME_IDS = Object.freeze(['card', 'board', 'chess']);
const ASSET_ROOTS = new Set(['images', 'audio', 'videos', 'fonts']);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const MANIFEST_PATH_PATTERN = /^desktop\/manifests\/[a-z0-9._-]+\.json$/;
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';
const OBJECT_PREFIX = 'desktop/blobs/sha256';
const DEFAULT_CONCURRENCY = 3;

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function strictChildPath(root, candidate) {
  const relation = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relation) && relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
}

function validateAssetPath(value) {
  if (
    typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') ||
    value !== value.normalize('NFC') || path.posix.isAbsolute(value) || path.win32.isAbsolute(value) ||
    path.posix.normalize(value) !== value
  ) fail(`Unsafe asset path: ${String(value)}`);
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) fail(`Unsafe asset path: ${value}`);
  if (!ASSET_ROOTS.has(parts[0])) fail(`Asset is outside an approved root: ${value}`);
  return { path: value };
}

function objectKeyForSha256(value) {
  const sha256 = String(value || '').toLowerCase();
  if (!HASH_PATTERN.test(sha256)) fail('Cannot build an R2 key from an invalid SHA-256.');
  return `${OBJECT_PREFIX}/${sha256.slice(0, 2)}/${sha256}`;
}

async function readJsonWithBytes(filePath, label, maximumBytes) {
  const bytes = await fsp.readFile(filePath);
  if (!bytes.length || bytes.length > maximumBytes) fail(`${label} has an invalid byte length.`);
  try {
    return { bytes, document: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
}

function validateManifest(document, gameId, catalogEntry) {
  if (!isPlainObject(document) || document.schema !== 1 || document.gameId !== gameId || !Array.isArray(document.assets)) {
    fail(`${gameId} manifest shape is invalid.`);
  }
  if (
    document.releaseId !== catalogEntry.releaseId || document.totalFiles !== catalogEntry.totalFiles ||
    document.totalBytes !== catalogEntry.totalBytes
  ) fail(`${gameId} manifest does not match the catalog.`);
  if (typeof document.createdAt !== 'string' || Number.isNaN(Date.parse(document.createdAt))) {
    fail(`${gameId} manifest createdAt is invalid.`);
  }
  if (!HASH_PATTERN.test(String(document.assetSetSha256 || '')) || sha256Bytes(JSON.stringify(document.assets)) !== document.assetSetSha256) {
    fail(`${gameId} manifest asset-set digest is invalid.`);
  }

  const seenPaths = new Set();
  const byKind = {
    image: { files: 0, bytes: 0 },
    audio: { files: 0, bytes: 0 },
    video: { files: 0, bytes: 0 },
    font: { files: 0, bytes: 0 }
  };
  let totalBytes = 0;
  let previousPath = '';
  for (const asset of document.assets) {
    if (!isPlainObject(asset)) fail(`${gameId} manifest contains a malformed asset.`);
    const checkedPath = validateAssetPath(asset.path);
    const foldedPath = checkedPath.path.toLowerCase();
    const size = Number(asset.size);
    const sha256 = String(asset.sha256 || '').toLowerCase();
    if (
      !Object.prototype.hasOwnProperty.call(byKind, asset.kind) || typeof asset.mime !== 'string' || !asset.mime ||
      !Number.isSafeInteger(size) || size < 1 || !HASH_PATTERN.test(sha256)
    ) fail(`${gameId} manifest contains invalid metadata for ${checkedPath.path}.`);
    if (seenPaths.has(foldedPath)) fail(`${gameId} manifest contains a duplicate path: ${checkedPath.path}`);
    if (previousPath && compareText(previousPath, checkedPath.path) >= 0) fail(`${gameId} manifest assets are not strictly sorted.`);
    seenPaths.add(foldedPath);
    previousPath = checkedPath.path;
    totalBytes += size;
    if (!Number.isSafeInteger(totalBytes)) fail(`${gameId} manifest byte total exceeds the safe integer range.`);
    byKind[asset.kind].files += 1;
    byKind[asset.kind].bytes += size;
  }
  if (
    document.assets.length !== document.totalFiles || totalBytes !== document.totalBytes ||
    JSON.stringify(byKind) !== JSON.stringify(document.byKind)
  ) fail(`${gameId} manifest totals are invalid.`);
}

async function loadPublishInventory({ repoRoot = DEFAULT_REPO_ROOT, gameIds = GAME_IDS } = {}) {
  const resolvedRoot = path.resolve(repoRoot);
  const publicRoot = path.join(resolvedRoot, 'public');
  const catalogPath = path.join(resolvedRoot, ...CATALOG_RELATIVE_PATH.split('/'));
  if (!strictChildPath(resolvedRoot, catalogPath)) fail('Catalog path escaped the repository root.');
  const { document: catalog } = await readJsonWithBytes(catalogPath, 'Desktop catalog', 256 * 1024);
  if (!isPlainObject(catalog) || catalog.schema !== 2 || !isPlainObject(catalog.games)) fail('Desktop catalog shape is invalid.');

  const recordsByHash = new Map();
  let logicalFiles = 0;
  let logicalBytes = 0;
  const manifests = Object.create(null);

  const selectedGameIds = [...gameIds];
  if (!selectedGameIds.length || selectedGameIds.some((gameId) => !GAME_IDS.includes(gameId))) {
    fail('Desktop publish game selection is invalid.');
  }
  for (const gameId of selectedGameIds) {
    const entry = catalog.games[gameId];
    if (!isPlainObject(entry)) fail(`Desktop catalog is missing ${gameId}.`);
    const manifestPath = String(entry.manifestPath || '');
    const manifestSha256 = String(entry.manifestSha256 || '').toLowerCase();
    if (
      !MANIFEST_PATH_PATTERN.test(manifestPath) || !HASH_PATTERN.test(manifestSha256) ||
      typeof entry.releaseId !== 'string' || !entry.releaseId || !Number.isSafeInteger(entry.totalFiles) ||
      entry.totalFiles < 1 || !Number.isSafeInteger(entry.totalBytes) || entry.totalBytes < 1
    ) fail(`Desktop catalog ${gameId} entry is invalid.`);
    const absoluteManifestPath = path.join(publicRoot, ...manifestPath.split('/'));
    if (!strictChildPath(publicRoot, absoluteManifestPath)) fail(`${gameId} manifest path escaped public/.`);
    const { bytes, document } = await readJsonWithBytes(absoluteManifestPath, `${gameId} manifest`, 8 * 1024 * 1024);
    if (sha256Bytes(bytes) !== manifestSha256) fail(`${gameId} manifest bytes do not match the catalog digest.`);
    validateManifest(document, gameId, entry);
    manifests[gameId] = { path: manifestPath, sha256: manifestSha256, releaseId: document.releaseId };

    for (const asset of document.assets) {
      const sha256 = String(asset.sha256).toLowerCase();
      let record = recordsByHash.get(sha256);
      if (!record) {
        record = {
          sha256,
          size: Number(asset.size),
          kind: asset.kind,
          mime: asset.mime,
          key: objectKeyForSha256(sha256),
          games: new Set(),
          sources: new Set()
        };
        recordsByHash.set(sha256, record);
      } else if (record.size !== asset.size || record.kind !== asset.kind || record.mime !== asset.mime) {
        fail(`SHA-256 ${sha256} has conflicting manifest metadata.`);
      }
      record.games.add(gameId);
      record.sources.add(asset.path);
      logicalFiles += 1;
      logicalBytes += Number(asset.size);
    }
  }

  const records = [...recordsByHash.values()].sort((left, right) => compareText(left.sha256, right.sha256)).map((record) => ({
    sha256: record.sha256,
    size: record.size,
    kind: record.kind,
    mime: record.mime,
    key: record.key,
    games: [...record.games].sort(compareText),
    sources: [...record.sources].sort(compareText)
  }));
  const uniqueBytes = records.reduce((sum, record) => sum + record.size, 0);
  if (!Number.isSafeInteger(logicalBytes) || !Number.isSafeInteger(uniqueBytes)) fail('Inventory byte total exceeds the safe integer range.');
  return {
    repoRoot: resolvedRoot,
    publicRoot,
    catalogPath: CATALOG_RELATIVE_PATH,
    catalogCreatedAt: catalog.createdAt,
    manifests,
    logicalFiles,
    logicalBytes,
    uniqueFiles: records.length,
    uniqueBytes,
    records
  };
}

function readGitHeadBlob(repoRoot, assetPath) {
  const spec = `HEAD:public/${assetPath}`;
  try {
    return execFileSync('git', ['cat-file', 'blob', spec], {
      cwd: repoRoot,
      encoding: null,
      maxBuffer: 128 * 1024 * 1024,
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe']
    });
  } catch (error) {
    const detail = Buffer.isBuffer(error?.stderr) ? error.stderr.toString('utf8').trim() : '';
    fail(`Cannot read committed SVG bytes for ${assetPath}${detail ? `: ${detail}` : ''}`);
  }
}

function createSourceReader(inventory, { chessSourceRoot = '' } = {}) {
  const publicRoot = path.resolve(inventory.publicRoot);
  const resolvedChessSourceRoot = chessSourceRoot ? path.resolve(chessSourceRoot) : '';
  let realPublicRootPromise = null;
  let realChessSourceRootPromise = null;
  const realPublicRoot = () => {
    if (!realPublicRootPromise) realPublicRootPromise = fsp.realpath(publicRoot);
    return realPublicRootPromise;
  };
  const realChessSourceRoot = () => {
    if (!resolvedChessSourceRoot) fail('Chess assets require --chess-source <release public/assets directory>.');
    if (!realChessSourceRootPromise) realChessSourceRootPromise = fsp.realpath(resolvedChessSourceRoot);
    return realChessSourceRootPromise;
  };
  return async function readVerifiedSource(assetPath, expected) {
    validateAssetPath(assetPath);
    let bytes;
    const chessPrefix = 'images/chess/assets/';
    if (assetPath.startsWith(chessPrefix)) {
      const relativePath = assetPath.slice(chessPrefix.length);
      if (!relativePath || path.posix.normalize(relativePath) !== relativePath) fail(`Invalid Chess asset source path: ${assetPath}`);
      const sourceRoot = await realChessSourceRoot();
      const absolutePath = path.resolve(sourceRoot, ...relativePath.split('/'));
      if (!strictChildPath(sourceRoot, absolutePath)) fail(`Chess asset escaped its source root: ${assetPath}`);
      const info = await fsp.lstat(absolutePath);
      if (!info.isFile() || info.isSymbolicLink()) fail(`Chess asset source is not a regular file: ${assetPath}`);
      const resolvedAssetPath = await fsp.realpath(absolutePath);
      if (!strictChildPath(sourceRoot, resolvedAssetPath)) fail(`Chess asset real path escaped its source root: ${assetPath}`);
      bytes = await fsp.readFile(resolvedAssetPath);
    } else if (path.posix.extname(assetPath).toLowerCase() === '.svg') {
      bytes = readGitHeadBlob(inventory.repoRoot, assetPath);
    } else {
      const absolutePath = path.resolve(publicRoot, ...assetPath.split('/'));
      if (!strictChildPath(publicRoot, absolutePath)) fail(`Asset path escaped public/: ${assetPath}`);
      const info = await fsp.lstat(absolutePath);
      if (!info.isFile() || info.isSymbolicLink()) fail(`Asset source is not a regular file: ${assetPath}`);
      const [resolvedPublicRoot, resolvedAssetPath] = await Promise.all([realPublicRoot(), fsp.realpath(absolutePath)]);
      if (!strictChildPath(resolvedPublicRoot, resolvedAssetPath)) fail(`Asset real path escaped public/: ${assetPath}`);
      bytes = await fsp.readFile(resolvedAssetPath);
    }
    if (bytes.length !== expected.size) fail(`Asset source size mismatch for ${assetPath}: expected ${expected.size}, got ${bytes.length}.`);
    const digest = sha256Bytes(bytes);
    if (digest !== expected.sha256) fail(`Asset source SHA-256 mismatch for ${assetPath}.`);
    return bytes;
  };
}

async function verifyRecordSources(record, readSource) {
  let uploadBytes = null;
  for (const assetPath of record.sources) {
    const bytes = await readSource(assetPath, record);
    if (!uploadBytes) uploadBytes = bytes;
  }
  if (!uploadBytes) fail(`R2 record ${record.sha256} has no source path.`);
  return uploadBytes;
}

function isNotFoundError(error) {
  return error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound' || error?.name === 'NoSuchKey';
}

function isPreconditionFailedError(error) {
  return error?.$metadata?.httpStatusCode === 412 || error?.name === 'PreconditionFailed';
}

function validateRemoteHead(record, response) {
  const metadata = isPlainObject(response?.Metadata) ? response.Metadata : {};
  const remoteSha256 = String(metadata.sha256 || '').toLowerCase();
  const problems = [];
  if (Number(response?.ContentLength) !== record.size) problems.push(`size=${String(response?.ContentLength)}`);
  if (remoteSha256 !== record.sha256) problems.push(`metadata.sha256=${remoteSha256 || 'missing'}`);
  if (String(response?.ContentType || '').toLowerCase() !== record.mime.toLowerCase()) problems.push(`content-type=${String(response?.ContentType || 'missing')}`);
  if (String(response?.CacheControl || '') !== IMMUTABLE_CACHE_CONTROL) problems.push(`cache-control=${String(response?.CacheControl || 'missing')}`);
  if (problems.length) fail(`R2 object already exists with mismatched metadata; refusing overwrite: ${record.key} (${problems.join(', ')}).`);
  return true;
}

async function headRemoteObject(record, liveContext) {
  try {
    const response = await liveContext.client.send(new liveContext.HeadObjectCommand({
      Bucket: liveContext.bucket,
      Key: record.key
    }));
    validateRemoteHead(record, response);
    return response;
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function publishRecord(record, readSource, liveContext) {
  const bytes = await verifyRecordSources(record, readSource);
  if (!liveContext) return { status: 'verified', bytes: record.size };
  const existing = await headRemoteObject(record, liveContext);
  if (existing) return { status: 'skipped', bytes: record.size };

  try {
    await liveContext.client.send(new liveContext.PutObjectCommand({
      Bucket: liveContext.bucket,
      Key: record.key,
      Body: bytes,
      ContentLength: record.size,
      ContentType: record.mime,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      Metadata: { sha256: record.sha256 },
      IfNoneMatch: '*'
    }));
  } catch (error) {
    if (!isPreconditionFailedError(error)) throw error;
    const racedObject = await headRemoteObject(record, liveContext);
    if (!racedObject) throw error;
    return { status: 'skipped-race', bytes: record.size };
  }
  const uploaded = await headRemoteObject(record, liveContext);
  if (!uploaded) fail(`Uploaded R2 object cannot be verified: ${record.key}`);
  return { status: 'uploaded', bytes: record.size };
}

async function mapConcurrent(values, concurrency, worker) {
  let cursor = 0;
  const results = new Array(values.length);
  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, values.length)) }, runWorker));
  return results;
}

async function publishInventory(inventory, {
  live = false,
  concurrency = DEFAULT_CONCURRENCY,
  liveContext = null,
  chessSourceRoot = '',
  onProgress = null
} = {}) {
  const normalizedConcurrency = Number(concurrency);
  if (!Number.isSafeInteger(normalizedConcurrency) || normalizedConcurrency < 1 || normalizedConcurrency > 16) {
    fail('Concurrency must be an integer from 1 through 16.');
  }
  if (live && (!liveContext?.client || !liveContext?.bucket || !liveContext?.HeadObjectCommand || !liveContext?.PutObjectCommand)) {
    fail('Live R2 context is incomplete.');
  }
  const readSource = createSourceReader(inventory, { chessSourceRoot });
  let completed = 0;
  const results = await mapConcurrent(inventory.records, normalizedConcurrency, async (record) => {
    const result = await publishRecord(record, readSource, live ? liveContext : null);
    completed += 1;
    if (typeof onProgress === 'function') onProgress({ completed, total: inventory.uniqueFiles, record, result });
    return result;
  });
  const counts = { verified: 0, uploaded: 0, skipped: 0, skippedRace: 0 };
  for (const result of results) {
    if (result.status === 'verified') counts.verified += 1;
    else if (result.status === 'uploaded') counts.uploaded += 1;
    else if (result.status === 'skipped') counts.skipped += 1;
    else if (result.status === 'skipped-race') counts.skippedRace += 1;
  }
  return {
    ok: true,
    mode: live ? 'live' : 'dry-run',
    logicalFiles: inventory.logicalFiles,
    logicalBytes: inventory.logicalBytes,
    uniqueFiles: inventory.uniqueFiles,
    uniqueBytes: inventory.uniqueBytes,
    ...counts
  };
}

function requiredEnvironment(env, key) {
  const value = String(env[key] || '').trim();
  if (!value) fail(`Live mode requires ${key}.`);
  return value;
}

function loadLiveConfiguration(env = process.env) {
  const accountId = requiredEnvironment(env, 'R2_ACCOUNT_ID');
  const bucket = requiredEnvironment(env, 'R2_BUCKET');
  const accessKeyId = requiredEnvironment(env, 'R2_ACCESS_KEY_ID');
  const secretAccessKey = requiredEnvironment(env, 'R2_SECRET_ACCESS_KEY');
  if (!/^[a-f0-9]{32}$/i.test(accountId)) fail('R2_ACCOUNT_ID must be a 32-character hexadecimal account id.');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) fail('R2_BUCKET has an invalid bucket name.');
  return {
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    region: 'auto',
    bucket,
    credentials: { accessKeyId, secretAccessKey }
  };
}

function createAwsLiveContext(configuration) {
  let sdk;
  try {
    sdk = require('@aws-sdk/client-s3');
  } catch {
    fail('Live mode requires @aws-sdk/client-s3. Run npm install in tools/desktop-r2-publisher first.');
  }
  const client = new sdk.S3Client({
    endpoint: configuration.endpoint,
    region: configuration.region,
    credentials: configuration.credentials
  });
  return {
    client,
    bucket: configuration.bucket,
    HeadObjectCommand: sdk.HeadObjectCommand,
    PutObjectCommand: sdk.PutObjectCommand
  };
}

function parseArguments(argv) {
  const options = {
    live: false,
    json: false,
    repoRoot: DEFAULT_REPO_ROOT,
    concurrency: DEFAULT_CONCURRENCY,
    chessSourceRoot: String(process.env.CHESS_ASSET_SOURCE || '').trim(),
    gameIds: [],
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--live') options.live = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else if (argument === '--repo-root') {
      index += 1;
      if (index >= argv.length) fail('--repo-root requires a path.');
      options.repoRoot = path.resolve(argv[index]);
    } else if (argument.startsWith('--repo-root=')) options.repoRoot = path.resolve(argument.slice('--repo-root='.length));
    else if (argument === '--concurrency') {
      index += 1;
      if (index >= argv.length) fail('--concurrency requires a number.');
      options.concurrency = Number(argv[index]);
    } else if (argument.startsWith('--concurrency=')) options.concurrency = Number(argument.slice('--concurrency='.length));
    else if (argument === '--chess-source') {
      index += 1;
      if (index >= argv.length) fail('--chess-source requires a path.');
      options.chessSourceRoot = path.resolve(argv[index]);
    } else if (argument.startsWith('--chess-source=')) options.chessSourceRoot = path.resolve(argument.slice('--chess-source='.length));
    else if (argument === '--game') {
      index += 1;
      if (index >= argv.length) fail('--game requires card, board, or chess.');
      options.gameIds.push(String(argv[index]).trim().toLowerCase());
    } else if (argument.startsWith('--game=')) options.gameIds.push(String(argument.slice('--game='.length)).trim().toLowerCase());
    else fail(`Unknown argument: ${argument}`);
  }
  if (!options.gameIds.length) options.gameIds = [...GAME_IDS];
  options.gameIds = [...new Set(options.gameIds)];
  if (options.gameIds.some((gameId) => !GAME_IDS.includes(gameId))) fail('--game requires card, board, or chess.');
  return options;
}

function usage() {
  return [
    'Usage: node tools/desktop-r2-publisher/publish.js [--live] [--repo-root PATH] [--game card|board|chess] [--chess-source PATH] [--concurrency 1-16] [--json]',
    '',
    'Without --live, every source is verified locally and no network request is made.',
    'Live environment: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.'
  ].join('\n');
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return { ok: true, help: true };
  }
  const inventory = await loadPublishInventory({ repoRoot: options.repoRoot, gameIds: options.gameIds });
  let liveContext = null;
  if (options.live) liveContext = createAwsLiveContext(loadLiveConfiguration(env));
  try {
    const result = await publishInventory(inventory, {
      live: options.live,
      concurrency: options.concurrency,
      liveContext,
      chessSourceRoot: options.chessSourceRoot,
      onProgress: options.json ? null : ({ completed, total, record, result: itemResult }) => {
        if (completed === total || completed % 25 === 0) {
          process.stdout.write(`[${completed}/${total}] ${itemResult.status} ${record.key}\n`);
        }
      }
    });
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.stdout.write(`DESKTOP_R2_PUBLISH=PASS mode=${result.mode} uniqueFiles=${result.uniqueFiles} uniqueBytes=${result.uniqueBytes} uploaded=${result.uploaded} skipped=${result.skipped + result.skippedRace}\n`);
    return result;
  } finally {
    if (typeof liveContext?.client?.destroy === 'function') liveContext.client.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`DESKTOP_R2_PUBLISH=FAIL ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  CATALOG_RELATIVE_PATH,
  DEFAULT_CONCURRENCY,
  IMMUTABLE_CACHE_CONTROL,
  OBJECT_PREFIX,
  canonicalJson,
  createSourceReader,
  isNotFoundError,
  isPreconditionFailedError,
  loadLiveConfiguration,
  loadPublishInventory,
  main,
  objectKeyForSha256,
  parseArguments,
  publishInventory,
  publishRecord,
  readGitHeadBlob,
  sha256Bytes,
  validateRemoteHead,
  verifyRecordSources
};
