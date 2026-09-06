'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const CATALOG_SCHEMA = 2;
const CATALOG_FILE = 'catalog-v2.json';
const MANIFEST_SCHEMA = 1;
const RECEIPT_SCHEMA = 1;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const MANIFEST_PATH_PATTERN = /^desktop\/manifests\/[a-z0-9._-]+\.json$/;
const ASSET_ROOTS = new Set(['images', 'audio', 'videos', 'fonts']);
const GAME_ID_LIST = Object.freeze(['card', 'board', 'chess']);
const GAME_IDS = new Set(GAME_ID_LIST);
const RESERVED_SEGMENTS = new Set(['incoming', 'backup', 'backups', 'private', 'battle_chess']);
const DOWNLOAD_RESERVE_BYTES = 512 * 1024 * 1024;
const LARGE_FILE_BYTES = 32 * 1024 * 1024;
const INTEGRITY_SCHEMA = 1;
const INTEGRITY_MAX_ENTRIES = 20_000;
const INTEGRITY_INDEX_MAX_BYTES = 12 * 1024 * 1024;
const DEFAULT_AUDIT_MAX_FILES = 4;
const DEFAULT_AUDIT_MAX_BYTES = 64 * 1024 * 1024;
const CACHE_OWNER_SCHEMA = 1;
const CACHE_OWNER_NAME = 'com.onepiece.tabletop.desktop';
const CACHE_OWNER_FILE = '.onepiece-tabletop-cache-owner-v1.json';
const CACHE_OWNER_MAX_BYTES = 4 * 1024;
const RECEIPT_MAX_BYTES = 64 * 1024;
const MANIFEST_MAX_BYTES = 8 * 1024 * 1024;
const PRODUCTION_ASSET_BLOB_BASE_URL = 'https://game-assets.rihdi.tw/desktop/blobs/sha256';
const MANAGED_CACHE_TOP_LEVEL = new Set(['blobs', 'partial', 'receipts', 'manifests', 'state']);

const EXTENSIONS = new Map([
  ['.png', ['image', 'image/png']], ['.jpg', ['image', 'image/jpeg']],
  ['.jpeg', ['image', 'image/jpeg']], ['.jfif', ['image', 'image/jpeg']],
  ['.webp', ['image', 'image/webp']], ['.gif', ['image', 'image/gif']],
  ['.svg', ['image', 'image/svg+xml']], ['.avif', ['image', 'image/avif']],
  ['.mp3', ['audio', 'audio/mpeg']], ['.wav', ['audio', 'audio/wav']],
  ['.ogg', ['audio', 'audio/ogg']], ['.m4a', ['audio', 'audio/mp4']],
  ['.aac', ['audio', 'audio/aac']], ['.flac', ['audio', 'audio/flac']],
  ['.mp4', ['video', 'video/mp4']], ['.webm', ['video', 'video/webm']],
  ['.mov', ['video', 'video/quicktime']], ['.m4v', ['video', 'video/x-m4v']],
  ['.woff', ['font', 'font/woff']], ['.woff2', ['font', 'font/woff2']],
  ['.ttf', ['font', 'font/ttf']], ['.otf', ['font', 'font/otf']]
]);

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function sha256File(filePath, signal) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  try {
    for await (const chunk of stream) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      hash.update(chunk);
    }
  } finally {
    if (signal?.aborted) stream.destroy();
  }
  return hash.digest('hex');
}

function abortError() {
  return new DOMException('Aborted', 'AbortError');
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortError();
}

function delayWithSignal(milliseconds, signal) {
  if (signal?.aborted) return Promise.reject(abortError());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(done, milliseconds);
    function done() {
      signal?.removeEventListener('abort', aborted);
      resolve();
    }
    function aborted() {
      clearTimeout(timer);
      reject(abortError());
    }
    signal?.addEventListener('abort', aborted, { once: true });
  });
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function safeAssetPath(value) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0')) return null;
  if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.normalize(value) !== value) return null;
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..')) return null;
  if (!ASSET_ROOTS.has(parts[0])) return null;
  if (parts.map((part) => part.normalize('NFC').toLowerCase()).some((part) => RESERVED_SEGMENTS.has(part))) return null;
  const type = EXTENSIONS.get(path.posix.extname(value).toLowerCase());
  return type ? { path: value, kind: type[0], mime: type[1] } : null;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function normalizeTestAssetBlobBaseUrls(values) {
  if (values === undefined) return new Set();
  if (!Array.isArray(values) || values.length > 8) throw new Error('測試素材來源白名單不正確。');
  const normalized = new Set();
  for (const value of values) {
    if (typeof value !== 'string' || !value || value.length > 2048 || value.includes('\\')) {
      throw new Error('測試素材來源白名單不正確。');
    }
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new Error('測試素材來源白名單不正確。');
    }
    if (
      !['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname) ||
      !['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password ||
      parsed.search || parsed.hash || !parsed.pathname || parsed.pathname === '/'
    ) throw new Error('測試素材來源白名單只允許本機來源。');
    const pathname = parsed.pathname.replace(/\/+$/, '');
    normalized.add(`${parsed.origin}${pathname}`);
  }
  return normalized;
}

function validateAssetBlobBaseUrl(value, { testAssetBlobBaseUrls } = {}) {
  if (value === undefined || value === '') return '';
  if (typeof value !== 'string' || !value || value.length > 2048 || value.includes('\\')) {
    throw new Error('版本目錄的素材下載來源不正確。');
  }
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('版本目錄的素材下載來源不正確。');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || !parsed.hostname) {
    throw new Error('版本目錄的素材下載來源不安全。');
  }
  const pathname = parsed.pathname.replace(/\/+$/, '');
  const normalized = `${parsed.origin}${pathname}`;
  const testAllowlist = normalizeTestAssetBlobBaseUrls(testAssetBlobBaseUrls);
  const productionSource = parsed.protocol === 'https:' && normalized === PRODUCTION_ASSET_BLOB_BASE_URL;
  if (!productionSource && !testAllowlist.has(normalized)) {
    throw new Error('版本目錄的素材下載來源不在允許清單。');
  }
  return normalized;
}

function validateCatalog(document, options = {}) {
  if (!isPlainObject(document) || document.schema !== CATALOG_SCHEMA || !isPlainObject(document.games)) {
    throw new Error('版本目錄格式不正確。');
  }
  if (Object.keys(document.games).join(',') !== GAME_ID_LIST.join(',')) {
    throw new Error('版本目錄的遊戲邊界不正確。');
  }
  if (!isPlainObject(document.sourceTrees) || Object.keys(document.sourceTrees).join(',') !== 'images,audio,videos,fonts') {
    throw new Error('版本目錄的素材版本不完整。');
  }
  for (const tree of Object.values(document.sourceTrees)) {
    if (typeof tree !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(tree)) throw new Error('版本目錄的素材版本不正確。');
  }
  if (typeof document.createdAt !== 'string' || Number.isNaN(Date.parse(document.createdAt))) {
    throw new Error('版本目錄缺少有效日期。');
  }
  const assetBlobBaseUrl = validateAssetBlobBaseUrl(document.assetBlobBaseUrl, options);
  const games = {};
  for (const gameId of GAME_ID_LIST) {
    const source = document.games[gameId];
    if (!isPlainObject(source) || source.available === false) throw new Error(`版本目錄缺少 ${gameId}。`);
    const releaseId = String(source.releaseId || '');
    const manifestPath = String(source.manifestPath || '');
    const manifestSha256 = String(source.manifestSha256 || '').toLowerCase();
    const totalFiles = Number(source.totalFiles);
    const totalBytes = Number(source.totalBytes);
    if (!RELEASE_PATTERN.test(releaseId) || !MANIFEST_PATH_PATTERN.test(manifestPath) || !HASH_PATTERN.test(manifestSha256)) {
      throw new Error(`${gameId} 版本資訊不安全。`);
    }
    if (!Number.isSafeInteger(totalFiles) || totalFiles < 1 || !Number.isSafeInteger(totalBytes) || totalBytes < 1) {
      throw new Error(`${gameId} 版本大小不正確。`);
    }
    games[gameId] = { available: true, releaseId, manifestPath, manifestSha256, totalFiles, totalBytes };
  }
  return {
    schema: CATALOG_SCHEMA,
    createdAt: document.createdAt,
    sourceTrees: isPlainObject(document.sourceTrees) ? { ...document.sourceTrees } : {},
    ...(assetBlobBaseUrl ? { assetBlobBaseUrl } : {}),
    games
  };
}

function validateManifest(document, expectedGameId) {
  if (!isPlainObject(document) || document.schema !== MANIFEST_SCHEMA || document.gameId !== expectedGameId) {
    throw new Error(`${expectedGameId} 遊戲清單格式不正確。`);
  }
  if (!GAME_IDS.has(document.gameId) || !RELEASE_PATTERN.test(String(document.releaseId || '')) || !Array.isArray(document.assets)) {
    throw new Error(`${expectedGameId} 遊戲清單欄位不正確。`);
  }
  if (typeof document.createdAt !== 'string' || Number.isNaN(Date.parse(document.createdAt))) {
    throw new Error(`${expectedGameId} 遊戲清單缺少有效日期。`);
  }
  const assetSetSha256 = String(document.assetSetSha256 || '').toLowerCase();
  if (document.assets.length < 1 || document.assets.length > 10_000 || !HASH_PATTERN.test(assetSetSha256) || sha256Bytes(JSON.stringify(document.assets)) !== assetSetSha256) {
    throw new Error(`${expectedGameId} 遊戲清單內容摘要不符。`);
  }
  const assets = [];
  const foldedPaths = new Set();
  let totalBytes = 0;
  const byKind = { image: { files: 0, bytes: 0 }, audio: { files: 0, bytes: 0 }, video: { files: 0, bytes: 0 }, font: { files: 0, bytes: 0 } };
  for (const source of document.assets) {
    const validPath = safeAssetPath(source?.path);
    const size = Number(source?.size);
    const sha256 = String(source?.sha256 || '').toLowerCase();
    if (!validPath || source.kind !== validPath.kind || source.mime !== validPath.mime || !Number.isSafeInteger(size) || size < 1 || !HASH_PATTERN.test(sha256)) {
      throw new Error(`${expectedGameId} 遊戲清單含有無效素材。`);
    }
    const folded = validPath.path.normalize('NFC').toLowerCase();
    if (foldedPaths.has(folded)) throw new Error(`${expectedGameId} 遊戲清單含有重複路徑。`);
    foldedPaths.add(folded);
    const record = { path: validPath.path, kind: validPath.kind, mime: validPath.mime, size, sha256 };
    assets.push(record);
    totalBytes += size;
    byKind[record.kind].files += 1;
    byKind[record.kind].bytes += size;
  }
  const sorted = [...assets].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  if (assets.some((asset, index) => asset.path !== sorted[index].path)) throw new Error(`${expectedGameId} 遊戲清單未排序。`);
  if (document.totalFiles !== assets.length || document.totalBytes !== totalBytes || JSON.stringify(document.byKind) !== JSON.stringify(byKind)) {
    throw new Error(`${expectedGameId} 遊戲清單合計不符。`);
  }
  return {
    schema: MANIFEST_SCHEMA,
    gameId: document.gameId,
    releaseId: document.releaseId,
    createdAt: document.createdAt,
    assetSetSha256,
    totalFiles: assets.length,
    totalBytes,
    byKind,
    assets
  };
}

function encodeAssetUrl(origin, assetPath) {
  const pathname = assetPath.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${origin}/${pathname}`;
}

function encodeAssetBlobUrl(assetBlobBaseUrl, sha256) {
  if (!HASH_PATTERN.test(String(sha256 || '').toLowerCase())) throw new Error('素材雜湊不正確。');
  const digest = String(sha256).toLowerCase();
  return `${assetBlobBaseUrl}/${digest.slice(0, 2)}/${digest}`;
}

async function assertSafeManagedPath(cacheRoot, target, { allowMissing = true, leafKind = '' } = {}) {
  const resolvedRoot = validateCacheRootPath(cacheRoot);
  const resolvedTarget = path.resolve(target);
  if (!isStrictChildPath(resolvedRoot, resolvedTarget)) throw new Error('快取檔案路徑不安全。');
  const relative = path.relative(resolvedRoot, resolvedTarget);
  const segments = relative.split(path.sep);
  const ownerMarkerTemporary = segments.length === 1 && segments[0].startsWith(`${CACHE_OWNER_FILE}.`);
  if (!MANAGED_CACHE_TOP_LEVEL.has(segments[0]) && segments[0] !== CACHE_OWNER_FILE && !ownerMarkerTemporary) {
    throw new Error('快取檔案不屬於受管理目錄。');
  }

  const rootInfo = await fsp.lstat(resolvedRoot);
  if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('下載位置不是安全的資料夾。');
  const realRoot = await fsp.realpath(resolvedRoot);
  let current = resolvedRoot;
  for (let index = 0; index < segments.length; index += 1) {
    current = path.join(current, segments[index]);
    const info = await lstatIfPresent(current);
    if (!info) {
      if (!allowMissing) throw new Error('快取檔案不存在。');
      return resolvedTarget;
    }
    if (info.isSymbolicLink()) throw new Error('快取路徑含有符號連結或目錄連接點。');
    const isLeaf = index === segments.length - 1;
    if (!isLeaf && !info.isDirectory()) throw new Error('快取路徑的父層不是安全資料夾。');
    if (isLeaf && leafKind === 'directory' && !info.isDirectory()) throw new Error('快取路徑不是安全資料夾。');
    if (isLeaf && leafKind === 'file' && !info.isFile()) throw new Error('快取路徑不是安全檔案。');
    const realCurrent = await fsp.realpath(current);
    if (!samePath(realCurrent, realRoot) && !isStrictChildPath(realRoot, realCurrent)) {
      throw new Error('快取路徑已離開下載位置。');
    }
  }
  return resolvedTarget;
}

async function ensureSafeManagedDirectory(cacheRoot, directory) {
  if (samePath(cacheRoot, directory)) {
    const rootInfo = await fsp.lstat(validateCacheRootPath(cacheRoot));
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('下載位置不是安全的資料夾。');
    return;
  }
  await assertSafeManagedPath(cacheRoot, directory, { allowMissing: true, leafKind: 'directory' });
  await fsp.mkdir(directory, { recursive: true });
  await assertSafeManagedPath(cacheRoot, directory, { allowMissing: false, leafKind: 'directory' });
}

async function removeSafeManagedPath(cacheRoot, target, { recursive = false, force = false, leafKind = '' } = {}) {
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: force, leafKind });
  const info = await lstatIfPresent(target);
  if (!info) {
    if (force) return;
    const error = new Error(`快取檔案不存在：${target}`);
    error.code = 'ENOENT';
    throw error;
  }
  if (recursive && !info.isDirectory()) throw new Error('拒絕遞迴移除非資料夾快取路徑。');
  await fsp.rm(target, { recursive, force });
}

async function renameSafeManagedFile(cacheRoot, source, target) {
  await assertSafeManagedPath(cacheRoot, source, { allowMissing: false, leafKind: 'file' });
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: true, leafKind: 'file' });
  await fsp.rename(source, target);
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: false, leafKind: 'file' });
}

async function atomicWriteJson(cacheRoot, target, value) {
  await ensureSafeManagedDirectory(cacheRoot, path.dirname(target));
  const temporary = `${target}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await assertSafeManagedPath(cacheRoot, temporary, { allowMissing: true, leafKind: 'file' });
  const handle = await fsp.open(temporary, 'wx');
  try {
    await handle.writeFile(canonicalJson(value), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await assertSafeManagedPath(cacheRoot, temporary, { allowMissing: false, leafKind: 'file' });
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: true, leafKind: 'file' });
  await renameSafeManagedFile(cacheRoot, temporary, target);
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: false, leafKind: 'file' });
}

async function atomicWriteBuffer(cacheRoot, target, value) {
  await ensureSafeManagedDirectory(cacheRoot, path.dirname(target));
  const temporary = `${target}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  await assertSafeManagedPath(cacheRoot, temporary, { allowMissing: true, leafKind: 'file' });
  const handle = await fsp.open(temporary, 'wx');
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await assertSafeManagedPath(cacheRoot, temporary, { allowMissing: false, leafKind: 'file' });
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: true, leafKind: 'file' });
  await renameSafeManagedFile(cacheRoot, temporary, target);
  await assertSafeManagedPath(cacheRoot, target, { allowMissing: false, leafKind: 'file' });
}

async function nearestExistingDirectory(targetPath) {
  let candidate = path.resolve(targetPath);
  while (true) {
    try {
      const info = await fsp.stat(candidate);
      if (info.isDirectory()) return candidate;
    } catch {
      // Keep moving toward an existing parent.
    }
    const parent = path.dirname(candidate);
    if (parent === candidate) throw new Error(`找不到可用磁碟：${targetPath}`);
    candidate = parent;
  }
}

async function availableBytes(targetPath) {
  const existing = await nearestExistingDirectory(targetPath);
  const stats = await fsp.statfs(existing);
  return Number(stats.bavail) * Number(stats.bsize);
}

function blobPath(cacheRoot, sha256) {
  return path.join(cacheRoot, 'blobs', 'sha256', sha256.slice(0, 2), sha256);
}

function integrityIndexPath(cacheRoot) {
  return path.join(cacheRoot, 'state', 'blob-integrity-v1.json');
}

function isStrictChildPath(root, candidate) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return Boolean(relative) && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function comparablePath(value) {
  const resolved = path.resolve(value);
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
}

function samePath(left, right) {
  return comparablePath(left) === comparablePath(right);
}

function validateCacheRootPath(value) {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw || raw.includes('\0') || !path.isAbsolute(raw)) throw new Error('下載位置不正確。');
  const resolved = path.resolve(raw);
  if (samePath(resolved, path.parse(resolved).root)) {
    throw new Error('下載位置不能是磁碟或網路分享根目錄。');
  }
  return resolved;
}

function cacheOwnershipMarkerPath(cacheRoot) {
  return path.join(validateCacheRootPath(cacheRoot), CACHE_OWNER_FILE);
}

function validateReceiptDocument(source, gameId) {
  if (
    !isPlainObject(source) || source.schema !== RECEIPT_SCHEMA || source.gameId !== gameId ||
    !RELEASE_PATTERN.test(String(source.releaseId || '')) ||
    !HASH_PATTERN.test(String(source.manifestSha256 || '').toLowerCase()) ||
    !/^[a-z0-9._-]+\.json$/.test(String(source.manifestFile || '')) ||
    typeof source.installedAt !== 'string' || Number.isNaN(Date.parse(source.installedAt))
  ) throw new Error('遊戲安裝收據格式不正確。');
  return {
    ...source,
    manifestSha256: String(source.manifestSha256).toLowerCase(),
    manifestFile: String(source.manifestFile)
  };
}

async function lstatIfPresent(target) {
  try {
    return await fsp.lstat(target);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

async function readRegularFile(target, maximumBytes, label) {
  const info = await fsp.lstat(target);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > maximumBytes) {
    throw new Error(`${label}不是安全的一般檔案。`);
  }
  return fsp.readFile(target);
}

function nanosecondsFromStat(info, nanosecondsKey, millisecondsKey) {
  if (typeof info[nanosecondsKey] === 'bigint') return info[nanosecondsKey].toString();
  const milliseconds = Number(info[millisecondsKey]);
  return BigInt(Math.round(milliseconds * 1_000_000)).toString();
}

function blobFingerprint(info) {
  return {
    size: Number(info.size),
    dev: String(info.dev),
    ino: String(info.ino),
    mode: String(info.mode),
    mtimeNs: nanosecondsFromStat(info, 'mtimeNs', 'mtimeMs'),
    ctimeNs: nanosecondsFromStat(info, 'ctimeNs', 'ctimeMs'),
    birthtimeNs: nanosecondsFromStat(info, 'birthtimeNs', 'birthtimeMs')
  };
}

function fingerprintSignature(value) {
  return `${value.size}:${value.dev}:${value.ino}:${value.mode}:${value.mtimeNs}:${value.ctimeNs}:${value.birthtimeNs}`;
}

function validDecimalString(value) {
  return typeof value === 'string' && /^\d{1,32}$/.test(value);
}

function validateIntegrityDocument(document) {
  if (!isPlainObject(document) || document.schema !== INTEGRITY_SCHEMA || !Array.isArray(document.records)) {
    throw new Error('素材驗證索引格式不正確。');
  }
  if (typeof document.updatedAt !== 'string' || Number.isNaN(Date.parse(document.updatedAt))) {
    throw new Error('素材驗證索引日期不正確。');
  }
  const auditAfter = String(document.auditAfter || '');
  if (auditAfter && !HASH_PATTERN.test(auditAfter)) throw new Error('素材驗證索引游標不正確。');
  const recordsSha256 = String(document.recordsSha256 || '').toLowerCase();
  if (
    document.records.length > INTEGRITY_MAX_ENTRIES || !HASH_PATTERN.test(recordsSha256) ||
    sha256Bytes(JSON.stringify(document.records)) !== recordsSha256
  ) {
    throw new Error('素材驗證索引摘要不符。');
  }
  const records = new Map();
  let previousHash = '';
  for (const source of document.records) {
    if (!isPlainObject(source) || !HASH_PATTERN.test(String(source.sha256 || ''))) {
      throw new Error('素材驗證索引含有無效紀錄。');
    }
    const sha256 = String(source.sha256);
    if (previousHash && sha256 <= previousHash) throw new Error('素材驗證索引未排序或含重複紀錄。');
    previousHash = sha256;
    if (
      !Number.isSafeInteger(source.size) || source.size < 1 ||
      !validDecimalString(source.dev) || !validDecimalString(source.ino) || !validDecimalString(source.mode) ||
      !validDecimalString(source.mtimeNs) || !validDecimalString(source.ctimeNs) || !validDecimalString(source.birthtimeNs)
    ) {
      throw new Error('素材驗證索引含有無效檔案指紋。');
    }
    records.set(sha256, {
      sha256,
      size: source.size,
      dev: source.dev,
      ino: source.ino,
      mode: source.mode,
      mtimeNs: source.mtimeNs,
      ctimeNs: source.ctimeNs,
      birthtimeNs: source.birthtimeNs
    });
  }
  return { auditAfter, records };
}

class AssetStore extends EventEmitter {
  constructor({
    origin,
    bundledCatalogRoot,
    cacheRoot,
    fetchImpl,
    hashFileImpl,
    integrityAuditMaxFiles = DEFAULT_AUDIT_MAX_FILES,
    integrityAuditMaxBytes = DEFAULT_AUDIT_MAX_BYTES,
    manifestTimeoutMs = 8_000,
    downloadRequestTimeoutMs = 15_000,
    downloadIdleTimeoutMs = 20_000,
    downloadRetryBaseMs = 300,
    downloadMaxAttempts = 3,
    testAssetBlobBaseUrls
  }) {
    super();
    this.origin = String(origin || '').replace(/\/+$/, '');
    this.bundledCatalogRoot = path.resolve(bundledCatalogRoot);
    this.cacheRoot = validateCacheRootPath(cacheRoot);
    this.fetchImpl = fetchImpl || globalThis.fetch;
    this.hashFileImpl = typeof hashFileImpl === 'function' ? hashFileImpl : sha256File;
    this.integrityAuditMaxFiles = Math.max(0, Math.min(64, Number(integrityAuditMaxFiles) || 0));
    this.integrityAuditMaxBytes = Math.max(0, Number(integrityAuditMaxBytes) || 0);
    this.manifestTimeoutMs = Math.max(100, Number(manifestTimeoutMs) || 8_000);
    this.downloadRequestTimeoutMs = Math.max(100, Number(downloadRequestTimeoutMs) || 15_000);
    this.downloadIdleTimeoutMs = Math.max(100, Number(downloadIdleTimeoutMs) || 20_000);
    this.downloadRetryBaseMs = Math.max(10, Number(downloadRetryBaseMs) || 300);
    this.downloadMaxAttempts = Math.max(1, Math.min(5, Number(downloadMaxAttempts) || 3));
    this.catalogValidationOptions = {
      testAssetBlobBaseUrls: [...normalizeTestAssetBlobBaseUrls(testAssetBlobBaseUrls)]
    };
    this.catalog = null;
    this.catalogSource = 'bundled';
    this.receipts = new Map();
    this.gameStates = new Map();
    this.activeInstall = null;
    this.activeRemoval = null;
    this.verifiedBlobs = new Map();
    this.invalidBlobs = new Map();
    this.integrityRecords = new Map();
    this.integrityAuditAfter = '';
    this.integrityDirty = false;
    this.integrityRevision = 0;
    this.integrityGeneration = 0;
    this.integrityWritePromise = Promise.resolve();
    this.backgroundAuditPromise = Promise.resolve({ files: 0, bytes: 0, invalid: 0 });
    this.stateRefreshPromise = Promise.resolve();
    this.cachedManifests = new Map();
    this.progressLastSentAt = 0;
  }

  async init() {
    await fsp.mkdir(this.cacheRoot, { recursive: true });
    await this.ensureCacheOwnership(this.cacheRoot);
    await this.loadIntegrityIndex();
    await this.loadBundledCatalog();
    await Promise.all(GAME_ID_LIST.map((gameId) => this.loadReceipt(gameId)));
    await this.loadLastKnownGoodCatalog();
    await this.refreshStates();
    const state = await this.getState();
    this.startBackgroundIntegrityAudit();
    return state;
  }

  async validateCacheOwnership(cacheRoot = this.cacheRoot) {
    const resolved = validateCacheRootPath(cacheRoot);
    const rootInfo = await fsp.lstat(resolved);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('下載位置不是安全的資料夾。');
    const markerPath = cacheOwnershipMarkerPath(resolved);
    if (!isStrictChildPath(resolved, markerPath)) throw new Error('快取擁有權標記路徑不安全。');
    if (!(await lstatIfPresent(markerPath))) throw new Error('快取擁有權標記不存在，已拒絕檔案操作。');
    await assertSafeManagedPath(resolved, markerPath, { allowMissing: false, leafKind: 'file' });
    const bytes = await readRegularFile(markerPath, CACHE_OWNER_MAX_BYTES, '快取擁有權標記');
    let document;
    try {
      document = JSON.parse(bytes.toString('utf8'));
    } catch {
      throw new Error('快取擁有權標記格式不正確。');
    }
    const keys = isPlainObject(document) ? Object.keys(document).sort() : [];
    if (
      keys.join(',') !== 'cacheRoot,createdAt,owner,schema' || document.schema !== CACHE_OWNER_SCHEMA ||
      document.owner !== CACHE_OWNER_NAME || typeof document.cacheRoot !== 'string' ||
      !samePath(document.cacheRoot, resolved) || typeof document.createdAt !== 'string' ||
      Number.isNaN(Date.parse(document.createdAt))
    ) throw new Error('快取擁有權標記不符合目前下載位置。');
    for (const directoryName of MANAGED_CACHE_TOP_LEVEL) {
      await assertSafeManagedPath(resolved, path.join(resolved, directoryName), {
        allowMissing: true,
        leafKind: 'directory'
      });
    }
    return document;
  }

  async assertSafeManifestDirectory(cacheRoot, gameId, { required = false } = {}) {
    const manifestRoot = path.join(cacheRoot, 'manifests', gameId);
    if (!isStrictChildPath(cacheRoot, manifestRoot)) throw new Error('遊戲清單目錄路徑不安全。');
    const rootInfo = await lstatIfPresent(manifestRoot);
    if (!rootInfo) {
      if (required) throw new Error('遊戲安裝收據找不到對應清單。');
      return;
    }
    await assertSafeManagedPath(cacheRoot, manifestRoot, { allowMissing: false, leafKind: 'directory' });
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('遊戲清單目錄含有可疑衝突。');
    const entries = await fsp.readdir(manifestRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (!/^[a-z0-9._-]+\.json$/.test(entry.name)) throw new Error('遊戲清單目錄含有可疑衝突。');
      const manifestPath = path.join(manifestRoot, entry.name);
      if (!isStrictChildPath(manifestRoot, manifestPath) || !isStrictChildPath(cacheRoot, manifestPath)) {
        throw new Error('遊戲清單檔案路徑不安全。');
      }
      const info = await fsp.lstat(manifestPath);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('遊戲清單目錄含有可疑衝突。');
      await assertSafeManagedPath(cacheRoot, manifestPath, { allowMissing: false, leafKind: 'file' });
      const bytes = await readRegularFile(manifestPath, MANIFEST_MAX_BYTES, '遊戲清單');
      let document;
      try {
        document = JSON.parse(bytes.toString('utf8'));
      } catch {
        throw new Error('遊戲清單目錄含有無效資料。');
      }
      validateManifest(document, gameId);
    }
  }

  async readReceiptFromRoot(cacheRoot, gameId) {
    if (!GAME_IDS.has(gameId)) throw new Error('遊戲代號不正確。');
    const receiptPath = path.join(cacheRoot, 'receipts', `${gameId}.json`);
    if (!isStrictChildPath(cacheRoot, receiptPath)) throw new Error('遊戲安裝收據路徑不安全。');
    await assertSafeManagedPath(cacheRoot, receiptPath, { allowMissing: false, leafKind: 'file' });
    const receiptBytes = await readRegularFile(receiptPath, RECEIPT_MAX_BYTES, '遊戲安裝收據');
    let source;
    try {
      source = validateReceiptDocument(JSON.parse(receiptBytes.toString('utf8')), gameId);
    } catch (error) {
      if (error.message === '遊戲安裝收據格式不正確。') throw error;
      throw new Error('遊戲安裝收據格式不正確。');
    }
    const manifestRoot = path.join(cacheRoot, 'manifests', gameId);
    const manifestPath = path.join(manifestRoot, source.manifestFile);
    if (
      !isStrictChildPath(cacheRoot, manifestRoot) || !isStrictChildPath(manifestRoot, manifestPath) ||
      !isStrictChildPath(cacheRoot, manifestPath) || !samePath(path.dirname(manifestPath), manifestRoot)
    ) throw new Error('遊戲安裝收據指向不安全的清單路徑。');
    await assertSafeManagedPath(cacheRoot, manifestPath, { allowMissing: false, leafKind: 'file' });
    const manifestBytes = await readRegularFile(manifestPath, MANIFEST_MAX_BYTES, '遊戲安裝清單');
    if (sha256Bytes(manifestBytes) !== source.manifestSha256) throw new Error('遊戲安裝收據與清單摘要不符。');
    let manifest;
    try {
      manifest = validateManifest(JSON.parse(manifestBytes.toString('utf8')), gameId);
    } catch {
      throw new Error('遊戲安裝收據指向無效清單。');
    }
    if (manifest.releaseId !== source.releaseId) throw new Error('遊戲安裝收據與清單版本不符。');
    return {
      ...source,
      receiptPath,
      manifestPath,
      manifest,
      assetIndex: new Map(manifest.assets.map((asset) => [asset.path.normalize('NFC').toLowerCase(), asset]))
    };
  }

  async assertLegacyCacheSafeToClaim(cacheRoot) {
    const receiptsRoot = path.join(cacheRoot, 'receipts');
    const manifestsRoot = path.join(cacheRoot, 'manifests');
    for (const directoryName of MANAGED_CACHE_TOP_LEVEL) {
      const managedRoot = path.join(cacheRoot, directoryName);
      if (!isStrictChildPath(cacheRoot, managedRoot)) throw new Error('舊快取資料夾路徑不安全。');
      try {
        await assertSafeManagedPath(cacheRoot, managedRoot, { allowMissing: true, leafKind: 'directory' });
      } catch {
        throw new Error('下載位置已有可疑的清單或收據衝突，無法接管。');
      }
    }

    const receiptsInfo = await lstatIfPresent(receiptsRoot);
    if (receiptsInfo) {
      const entries = await fsp.readdir(receiptsRoot, { withFileTypes: true });
      for (const entry of entries) {
        const match = /^(card|board|chess)\.json$/.exec(entry.name);
        if (!match || !entry.isFile() || entry.isSymbolicLink()) {
          throw new Error('下載位置已有可疑的清單或收據衝突，無法接管。');
        }
        try {
          await this.readReceiptFromRoot(cacheRoot, match[1]);
        } catch {
          throw new Error('下載位置已有可疑的清單或收據衝突，無法接管。');
        }
      }
    }

    const manifestsInfo = await lstatIfPresent(manifestsRoot);
    if (manifestsInfo) {
      const entries = await fsp.readdir(manifestsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!GAME_IDS.has(entry.name) || !entry.isDirectory() || entry.isSymbolicLink()) {
          throw new Error('下載位置已有可疑的清單或收據衝突，無法接管。');
        }
        try {
          await this.assertSafeManifestDirectory(cacheRoot, entry.name);
        } catch {
          throw new Error('下載位置已有可疑的清單或收據衝突，無法接管。');
        }
      }
    }
  }

  async ensureCacheOwnership(cacheRoot = this.cacheRoot) {
    const resolved = validateCacheRootPath(cacheRoot);
    const rootInfo = await fsp.lstat(resolved);
    if (!rootInfo.isDirectory() || rootInfo.isSymbolicLink()) throw new Error('下載位置不是安全的資料夾。');
    const markerPath = cacheOwnershipMarkerPath(resolved);
    const markerInfo = await lstatIfPresent(markerPath);
    if (markerInfo) return this.validateCacheOwnership(resolved);
    await this.assertLegacyCacheSafeToClaim(resolved);
    await atomicWriteJson(resolved, markerPath, {
      schema: CACHE_OWNER_SCHEMA,
      owner: CACHE_OWNER_NAME,
      cacheRoot: resolved,
      createdAt: new Date().toISOString()
    });
    return this.validateCacheOwnership(resolved);
  }

  async loadIntegrityIndex() {
    this.integrityGeneration += 1;
    this.verifiedBlobs.clear();
    this.invalidBlobs.clear();
    this.integrityRecords.clear();
    this.integrityAuditAfter = '';
    this.integrityDirty = false;
    this.integrityRevision = 0;
    try {
      const indexPath = integrityIndexPath(this.cacheRoot);
      await assertSafeManagedPath(this.cacheRoot, indexPath, { allowMissing: false, leafKind: 'file' });
      const info = await fsp.lstat(indexPath);
      if (!info.isFile() || info.size > INTEGRITY_INDEX_MAX_BYTES) throw new Error('integrity index size');
      const parsed = validateIntegrityDocument(JSON.parse(await fsp.readFile(indexPath, 'utf8')));
      this.integrityRecords = parsed.records;
      this.integrityAuditAfter = parsed.auditAfter;
    } catch {
      // A missing or malformed cache index is never trusted. Existing blobs are
      // revalidated on demand or by the bounded background audit.
    }
  }

  markIntegrityDirty() {
    this.integrityDirty = true;
    this.integrityRevision += 1;
  }

  async flushIntegrityIndex() {
    const generation = this.integrityGeneration;
    const cacheRoot = this.cacheRoot;
    this.integrityWritePromise = this.integrityWritePromise.catch(() => {}).then(async () => {
      if (!this.integrityDirty || generation !== this.integrityGeneration) return;
      const revision = this.integrityRevision;
      const records = [...this.integrityRecords.values()].sort((left, right) => left.sha256 < right.sha256 ? -1 : 1);
      const document = {
        schema: INTEGRITY_SCHEMA,
        updatedAt: new Date().toISOString(),
        auditAfter: this.integrityAuditAfter,
        recordsSha256: sha256Bytes(JSON.stringify(records)),
        records
      };
      await atomicWriteJson(cacheRoot, integrityIndexPath(cacheRoot), document);
      if (generation === this.integrityGeneration && revision === this.integrityRevision) this.integrityDirty = false;
    });
    return this.integrityWritePromise;
  }

  async fingerprintBlob(asset) {
    const target = blobPath(this.cacheRoot, asset.sha256);
    await assertSafeManagedPath(this.cacheRoot, target, { allowMissing: false, leafKind: 'file' });
    const info = await fsp.lstat(target, { bigint: true });
    const fingerprint = blobFingerprint(info);
    if (!info.isFile() || fingerprint.size !== asset.size) return null;
    return fingerprint;
  }

  rememberVerifiedBlob(asset, fingerprint) {
    const record = { sha256: asset.sha256, ...fingerprint };
    const previous = this.integrityRecords.get(asset.sha256);
    this.verifiedBlobs.set(asset.sha256, fingerprintSignature(record));
    this.invalidBlobs.delete(asset.sha256);
    if (!previous || fingerprintSignature(previous) !== fingerprintSignature(record)) {
      this.integrityRecords.set(asset.sha256, record);
      this.markIntegrityDirty();
    }
  }

  forgetVerifiedBlob(sha256) {
    this.verifiedBlobs.delete(sha256);
    if (this.integrityRecords.delete(sha256)) this.markIntegrityDirty();
  }

  async fastBlobStatus(asset) {
    try {
      const fingerprint = await this.fingerprintBlob(asset);
      if (!fingerprint) return 'missing';
      const signature = fingerprintSignature(fingerprint);
      if (this.invalidBlobs.get(asset.sha256) === signature) return 'changed';
      const record = this.integrityRecords.get(asset.sha256);
      if (!record) return 'unverified';
      if (record.size !== asset.size || fingerprintSignature(record) !== signature) {
        this.forgetVerifiedBlob(asset.sha256);
        return 'changed';
      }
      this.verifiedBlobs.set(asset.sha256, signature);
      return 'trusted';
    } catch {
      return 'missing';
    }
  }

  startBackgroundIntegrityAudit() {
    if (this.integrityAuditMaxFiles <= 0) return;
    const generation = this.integrityGeneration;
    this.backgroundAuditPromise = Promise.resolve().then(() => this.runBackgroundIntegrityAudit(generation)).catch(() => ({
      files: 0,
      bytes: 0,
      invalid: 0
    }));
  }

  async runBackgroundIntegrityAudit(generation) {
    const unique = new Map();
    for (const receipt of this.receipts.values()) {
      for (const asset of receipt.manifest.assets) if (!unique.has(asset.sha256)) unique.set(asset.sha256, asset);
    }
    const assets = [...unique.values()].sort((left, right) => left.sha256 < right.sha256 ? -1 : 1);
    if (!assets.length || generation !== this.integrityGeneration) return { files: 0, bytes: 0, invalid: 0 };
    let start = assets.findIndex((asset) => asset.sha256 > this.integrityAuditAfter);
    if (start < 0) start = 0;
    const ordered = [...assets.slice(start), ...assets.slice(0, start)];
    let files = 0;
    let bytes = 0;
    let invalid = 0;
    for (const asset of ordered) {
      if (generation !== this.integrityGeneration || files >= this.integrityAuditMaxFiles) break;
      if (files > 0 && bytes + asset.size > this.integrityAuditMaxBytes) break;
      const valid = await this.verifyBlob(asset, { forceHash: true });
      if (generation !== this.integrityGeneration) break;
      files += 1;
      bytes += asset.size;
      this.integrityAuditAfter = asset.sha256;
      this.markIntegrityDirty();
      if (!valid) {
        invalid += 1;
        await removeSafeManagedPath(this.cacheRoot, blobPath(this.cacheRoot, asset.sha256), { force: true, leafKind: 'file' });
        this.forgetVerifiedBlob(asset.sha256);
        for (const [gameId, receipt] of this.receipts) {
          if (!receipt.manifest.assets.some((entry) => entry.sha256 === asset.sha256)) continue;
          const state = this.gameStates.get(gameId) || {};
          this.gameStates.set(gameId, { ...state, status: 'repair', message: '素材損壞，需要修復', hasInstalled: false });
        }
      }
    }
    await this.flushIntegrityIndex();
    if (invalid > 0) this.getState().then((state) => this.emit('state', state)).catch(() => {});
    return { files, bytes, invalid };
  }

  async loadBundledCatalog() {
    const catalogPath = path.join(this.bundledCatalogRoot, CATALOG_FILE);
    const document = JSON.parse(await fsp.readFile(catalogPath, 'utf8'));
    this.catalog = validateCatalog(document, this.catalogValidationOptions);
    this.catalogSource = 'bundled';
  }

  lastKnownGoodRoot() {
    return path.join(this.cacheRoot, 'state', 'last-known-good-v1');
  }

  validateManifestResult(bytes, entry, gameId) {
    if (bytes.length > 8 * 1024 * 1024 || sha256Bytes(bytes) !== entry.manifestSha256) {
      throw new Error(`${gameId} 遊戲清單摘要不符。`);
    }
    const manifest = validateManifest(JSON.parse(bytes.toString('utf8')), gameId);
    if (
      manifest.releaseId !== entry.releaseId || manifest.totalFiles !== entry.totalFiles ||
      manifest.totalBytes !== entry.totalBytes
    ) {
      throw new Error(`${gameId} 版本目錄與遊戲清單不一致。`);
    }
    return { bytes, manifest, fileName: path.posix.basename(entry.manifestPath) };
  }

  assertNotDowngrade(gameId, result, manifestSha256) {
    const installed = this.receipts.get(gameId);
    if (!installed || installed.manifestSha256 === manifestSha256) return;
    const installedAt = Date.parse(installed.manifest.createdAt);
    const candidateAt = Date.parse(result.manifest.createdAt);
    if (!Number.isFinite(candidateAt) || candidateAt <= installedAt) {
      throw new Error('偵測到較舊的素材版本，已阻止降版。');
    }
  }

  async loadLastKnownGoodCatalog() {
    const root = this.lastKnownGoodRoot();
    try {
      const catalogPath = path.join(root, CATALOG_FILE);
      await assertSafeManagedPath(this.cacheRoot, catalogPath, { allowMissing: false, leafKind: 'file' });
      const info = await fsp.lstat(catalogPath);
      if (!info.isFile() || info.size > 256 * 1024) throw new Error('cached catalog size');
      const catalog = validateCatalog(JSON.parse(await fsp.readFile(catalogPath, 'utf8')), this.catalogValidationOptions);
      const results = new Map();
      for (const gameId of GAME_ID_LIST) {
        const entry = catalog.games[gameId];
        const manifestPath = path.join(root, 'manifests', path.posix.basename(entry.manifestPath));
        await assertSafeManagedPath(this.cacheRoot, manifestPath, { allowMissing: false, leafKind: 'file' });
        const bytes = await fsp.readFile(manifestPath);
        const result = this.validateManifestResult(bytes, entry, gameId);
        this.assertNotDowngrade(gameId, result, entry.manifestSha256);
        results.set(`${gameId}:${entry.manifestSha256}`, result);
      }
      const bundledCreatedAt = Date.parse(this.catalog.createdAt);
      const cachedCreatedAt = Date.parse(catalog.createdAt);
      const matchesInstalled = GAME_ID_LIST.some((gameId) => (
        this.receipts.get(gameId)?.manifestSha256 === catalog.games[gameId].manifestSha256
      ));
      if (cachedCreatedAt < bundledCreatedAt && !matchesInstalled) return false;
      this.catalog = catalog;
      this.catalogSource = 'cached';
      this.cachedManifests = results;
      return true;
    } catch {
      return false;
    }
  }

  async fetchRemoteManifest(catalog, gameId, signal) {
    const entry = catalog.games[gameId];
    const response = await this.fetchImpl(`${this.origin}/${entry.manifestPath}`, {
      cache: 'no-store',
      redirect: 'error',
      headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
      signal
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const result = this.validateManifestResult(bytes, entry, gameId);
    this.assertNotDowngrade(gameId, result, entry.manifestSha256);
    return result;
  }

  async persistLastKnownGoodCatalog(catalog, results) {
    const root = this.lastKnownGoodRoot();
    for (const gameId of GAME_ID_LIST) {
      const result = results.get(`${gameId}:${catalog.games[gameId].manifestSha256}`);
      await atomicWriteBuffer(this.cacheRoot, path.join(root, 'manifests', result.fileName), result.bytes);
    }
    await atomicWriteJson(this.cacheRoot, path.join(root, CATALOG_FILE), catalog);
  }

  async refreshRemoteCatalog() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await this.fetchImpl(`${this.origin}/desktop/${CATALOG_FILE}?launcher=${encodeURIComponent(process.versions.electron || 'desktop')}`, {
        cache: 'no-store',
        redirect: 'error',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 256 * 1024) throw new Error('版本目錄過大。');
      const catalog = validateCatalog(JSON.parse(bytes.toString('utf8')), this.catalogValidationOptions);
      const results = new Map();
      for (const gameId of GAME_ID_LIST) {
        const result = await this.fetchRemoteManifest(catalog, gameId, controller.signal);
        results.set(`${gameId}:${catalog.games[gameId].manifestSha256}`, result);
      }
      await this.persistLastKnownGoodCatalog(catalog, results);
      this.catalog = catalog;
      this.catalogSource = 'remote';
      this.cachedManifests = results;
      await this.refreshStates();
      this.getState().then((state) => this.emit('state', state)).catch(() => {});
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error.name === 'AbortError'
          ? '更新伺服器逾時。'
          : `暫時無法取得線上版本，已保留${this.catalogSource === 'bundled' ? '內建' : '最近驗證'}版本資料。`
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async setCacheRoot(nextRoot) {
    if (this.activeInstall || this.activeRemoval) throw new Error('下載或移除進行中，請稍後再變更位置。');
    const resolved = validateCacheRootPath(nextRoot);
    await fsp.mkdir(resolved, { recursive: true });
    await this.ensureCacheOwnership(resolved);
    this.cacheRoot = resolved;
    this.receipts.clear();
    this.cachedManifests.clear();
    await this.loadIntegrityIndex();
    await this.loadBundledCatalog();
    await Promise.all(GAME_ID_LIST.map((gameId) => this.loadReceipt(gameId)));
    await this.loadLastKnownGoodCatalog();
    await this.refreshStates();
    this.startBackgroundIntegrityAudit();
    this.getState().then((state) => this.emit('state', state)).catch(() => {});
  }

  async loadReceipt(gameId) {
    try {
      this.receipts.set(gameId, await this.readReceiptFromRoot(this.cacheRoot, gameId));
    } catch {
      this.receipts.delete(gameId);
    }
  }

  async receiptFilesPresent(receipt) {
    const unique = new Map();
    for (const asset of receipt.manifest.assets) if (!unique.has(asset.sha256)) unique.set(asset.sha256, asset);
    let cursor = 0;
    let valid = true;
    const values = [...unique.values()];
    async function worker(store) {
      while (valid) {
        const index = cursor++;
        if (index >= values.length) return;
        const asset = values[index];
        const status = await store.fastBlobStatus(asset);
        if (status === 'missing' || status === 'changed') valid = false;
      }
    }
    await Promise.all(Array.from({ length: Math.min(12, Math.max(1, values.length)) }, () => worker(this)));
    return valid;
  }

  refreshStates(options = {}) {
    const task = this.stateRefreshPromise.then(() => this.computeStates(options));
    this.stateRefreshPromise = task.catch(() => {});
    return task;
  }

  async computeStates({ includeActiveGameId = '' } = {}) {
    for (const gameId of GAME_ID_LIST) {
      if (this.activeInstall?.gameId === gameId && includeActiveGameId !== gameId) continue;
      const latest = this.catalog.games[gameId];
      const receipt = this.receipts.get(gameId);
      let status = 'not-installed';
      let message = '尚未安裝';
      let hasInstalled = false;
      let installedVersion = '';
      if (receipt) {
        hasInstalled = await this.receiptFilesPresent(receipt);
        installedVersion = receipt.releaseId;
        if (!hasInstalled) {
          status = 'repair';
          message = '部分檔案遺失，需要修復';
        } else if (receipt.releaseId === latest.releaseId && receipt.manifestSha256 === latest.manifestSha256) {
          status = 'installed';
          message = '已安裝，可以遊玩';
        } else if (Date.parse(this.catalog.createdAt) <= Date.parse(receipt.manifest.createdAt)) {
          status = 'installed';
          message = '已安裝，可以遊玩（等待線上版本確認）';
        } else {
          status = 'update';
          message = '已有新版本可下載';
        }
      }
      this.gameStates.set(gameId, {
        status,
        message,
        hasInstalled,
        removable: Boolean(receipt),
        installedVersion,
        remoteVersion: latest.releaseId,
        totalFiles: latest.totalFiles,
        totalBytes: latest.totalBytes,
        downloadedBytes: 0,
        completedFiles: 0
      });
    }
    if (this.integrityDirty) await this.flushIntegrityIndex();
  }

  async getState() {
    let freeBytes = null;
    try { freeBytes = await availableBytes(this.cacheRoot); } catch { /* shown as unavailable */ }
    return {
      cacheRoot: this.cacheRoot,
      freeBytes,
      catalogSource: this.catalogSource,
      games: Object.fromEntries([...this.gameStates.entries()].map(([gameId, state]) => [gameId, { ...state }]))
    };
  }

  emitProgress(gameId, patch, force = false) {
    const next = { ...(this.gameStates.get(gameId) || {}), ...patch };
    this.gameStates.set(gameId, next);
    const now = Date.now();
    if (force || now - this.progressLastSentAt >= 120) {
      this.progressLastSentAt = now;
      this.emit('progress', { gameId, ...next });
    }
  }

  async readBundledManifest(entry, gameId, signal) {
    throwIfAborted(signal);
    const fileName = path.posix.basename(entry.manifestPath);
    const bytes = await fsp.readFile(path.join(this.bundledCatalogRoot, 'manifests', fileName));
    throwIfAborted(signal);
    return this.validateManifestResult(bytes, entry, gameId);
  }

  async readLastKnownGoodManifest(entry, gameId, signal) {
    throwIfAborted(signal);
    const fileName = path.posix.basename(entry.manifestPath);
    const bytes = await fsp.readFile(path.join(this.lastKnownGoodRoot(), 'manifests', fileName));
    throwIfAborted(signal);
    return this.validateManifestResult(bytes, entry, gameId);
  }

  async getManifest(gameId, { signal } = {}) {
    if (!GAME_IDS.has(gameId)) throw new Error('此遊戲尚未開放下載。');
    throwIfAborted(signal);
    const entry = this.catalog.games[gameId];
    const key = `${gameId}:${entry.manifestSha256}`;
    if (this.cachedManifests.has(key)) {
      const cached = this.cachedManifests.get(key);
      this.assertNotDowngrade(gameId, cached, entry.manifestSha256);
      return cached;
    }
    let result;
    if (this.catalogSource === 'remote') {
      const controller = new AbortController();
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, this.manifestTimeoutMs);
      const relayAbort = () => controller.abort();
      signal?.addEventListener('abort', relayAbort, { once: true });
      try {
        result = await this.fetchRemoteManifest(this.catalog, gameId, controller.signal);
      } catch (error) {
        if (signal?.aborted) throw abortError();
        if (timedOut) throw new Error('遊戲清單下載逾時，請稍後再試。');
        const bundled = validateCatalog(
          JSON.parse(await fsp.readFile(path.join(this.bundledCatalogRoot, CATALOG_FILE), 'utf8')),
          this.catalogValidationOptions
        );
        const bundledEntry = bundled.games[gameId];
        if (bundledEntry.manifestSha256 !== entry.manifestSha256) throw new Error('新版本清單下載失敗，請稍後再試。');
        result = await this.readBundledManifest(bundledEntry, gameId, signal);
      } finally {
        clearTimeout(timer);
        signal?.removeEventListener('abort', relayAbort);
      }
    } else if (this.catalogSource === 'cached') {
      result = await this.readLastKnownGoodManifest(entry, gameId, signal);
    } else {
      result = await this.readBundledManifest(entry, gameId, signal);
    }
    this.assertNotDowngrade(gameId, result, entry.manifestSha256);
    this.cachedManifests.set(key, result);
    return result;
  }

  installGame(gameId) {
    if (!GAME_IDS.has(gameId)) return { ok: false, error: '此遊戲仍在製作中。' };
    if (this.activeRemoval) return { ok: false, error: '正在移除遊戲，完成後才能開始下載。' };
    if (this.activeInstall) {
      if (this.activeInstall.gameId === gameId) return { ok: true, alreadyRunning: true };
      return { ok: false, error: '目前已有另一款遊戲正在下載，請先等待或暫停。' };
    }
    const controller = new AbortController();
    const startingState = { ...(this.gameStates.get(gameId) || {}) };
    this.activeInstall = { gameId, controller, startingState };
    let succeeded = false;
    this.runInstall(gameId, controller.signal).then(() => {
      succeeded = true;
    }).catch((error) => {
      const aborted = error?.name === 'AbortError';
      const repairRequired = startingState.status === 'repair';
      const fallbackStatus = repairRequired ? 'repair' : (startingState.hasInstalled ? 'update' : (aborted ? 'paused' : 'error'));
      this.emitProgress(gameId, {
        status: fallbackStatus,
        hasInstalled: repairRequired ? false : Boolean(startingState.hasInstalled),
        message: aborted
          ? (repairRequired ? '修復已暫停，完成修復前無法遊玩' : '下載已暫停，可保留進度繼續')
          : String(error?.message || '下載失敗'),
        lastError: aborted ? '' : String(error?.message || '下載失敗')
      }, true);
    }).finally(async () => {
      if (this.activeInstall?.controller === controller) this.activeInstall = null;
      if (succeeded) await this.refreshStates({ includeActiveGameId: gameId }).catch(() => {});
      this.getState().then((state) => this.emit('state', state)).catch(() => {});
    });
    return { ok: true };
  }

  cancelInstall(gameId) {
    if (!this.activeInstall || this.activeInstall.gameId !== gameId) return { ok: false, error: '目前沒有這款遊戲的下載工作。' };
    this.activeInstall.controller.abort();
    return { ok: true };
  }

  async uninstallGame(gameId) {
    if (!GAME_IDS.has(gameId)) return { ok: false, error: '遊戲代號不正確。' };
    if (this.activeInstall) return { ok: false, error: '請先暫停目前下載，再解除安裝。' };
    if (this.activeRemoval) return { ok: false, error: '已有遊戲正在移除，請稍候。' };

    const cacheRoot = validateCacheRootPath(this.cacheRoot);
    await this.validateCacheOwnership(cacheRoot);

    const receipt = this.receipts.get(gameId);
    if (!receipt) {
      await this.refreshStates();
      return { ok: true, alreadyRemoved: true, removedBytes: 0, removedFiles: 0, skipped: 0 };
    }

    const receiptPath = path.join(cacheRoot, 'receipts', `${gameId}.json`);
    const manifestRoot = path.join(cacheRoot, 'manifests', gameId);
    const partialRoot = path.join(cacheRoot, 'partial');
    if (
      !isStrictChildPath(cacheRoot, receiptPath) || !isStrictChildPath(cacheRoot, manifestRoot) ||
      !isStrictChildPath(cacheRoot, partialRoot)
    ) throw new Error('遊戲解除安裝路徑不安全。');

    this.activeRemoval = { gameId };
    this.emitProgress(gameId, {
      ...(this.gameStates.get(gameId) || {}),
      status: 'removing',
      message: '正在移除本機遊戲素材'
    }, true);

    const candidates = new Set(receipt.manifest.assets.map((asset) => asset.sha256));
    const latestEntry = this.catalog.games[gameId];
    const latestCached = this.cachedManifests.get(`${gameId}:${latestEntry.manifestSha256}`)?.manifest;
    for (const asset of latestCached?.assets || []) candidates.add(asset.sha256);

    const protectedHashes = new Set();
    for (const otherGameId of GAME_IDS) {
      if (otherGameId === gameId) continue;
      const otherReceipt = this.receipts.get(otherGameId);
      for (const asset of otherReceipt?.manifest.assets || []) protectedHashes.add(asset.sha256);
      const otherEntry = this.catalog.games[otherGameId];
      const otherCached = this.cachedManifests.get(`${otherGameId}:${otherEntry.manifestSha256}`)?.manifest;
      const otherStatus = this.gameStates.get(otherGameId)?.status;
      const hasIncompleteDownload = ['paused', 'error', 'preparing', 'downloading', 'verifying'].includes(otherStatus);
      if (otherReceipt || hasIncompleteDownload) {
        for (const asset of otherCached?.assets || []) protectedHashes.add(asset.sha256);
      }
    }

    const result = { ok: true, removedBytes: 0, removedFiles: 0, removedPartials: 0, skipped: 0 };
    try {
      await this.stateRefreshPromise.catch(() => {});
      await this.backgroundAuditPromise.catch(() => {});

      // Re-read the marker and durable receipt immediately before recursive
      // deletion. A stale in-memory receipt can never authorize filesystem work.
      await this.validateCacheOwnership(cacheRoot);
      const durableReceipt = await this.readReceiptFromRoot(cacheRoot, gameId);
      for (const field of ['schema', 'gameId', 'releaseId', 'manifestSha256', 'manifestFile', 'installedAt']) {
        if (durableReceipt[field] !== receipt[field]) throw new Error('遊戲安裝收據在解除安裝前已被變更。');
      }
      if (!samePath(durableReceipt.receiptPath, receiptPath) || !samePath(durableReceipt.manifestPath, path.join(manifestRoot, receipt.manifestFile))) {
        throw new Error('遊戲安裝收據路徑不安全。');
      }
      await this.assertSafeManifestDirectory(cacheRoot, gameId, { required: true });

      // The receipt is the durable installed marker. Remove it first so a crash
      // cannot make a partially removed game appear launchable on restart.
      await removeSafeManagedPath(cacheRoot, receiptPath, { force: true, leafKind: 'file' });
      this.receipts.delete(gameId);
      try {
        await removeSafeManagedPath(cacheRoot, manifestRoot, { recursive: true, force: true, leafKind: 'directory' });
      } catch {
        result.skipped += 1;
      }

      for (const sha256 of candidates) {
        if (protectedHashes.has(sha256)) continue;
        const blob = blobPath(cacheRoot, sha256);
        const partial = path.join(partialRoot, `${sha256}.part`);
        for (const [candidate, partialFile] of [[blob, false], [partial, true]]) {
          if (!isStrictChildPath(cacheRoot, candidate)) {
            result.skipped += 1;
            continue;
          }
          try {
            const info = await fsp.lstat(candidate);
            if (!info.isFile() || info.isSymbolicLink()) {
              result.skipped += 1;
              continue;
            }
            await removeSafeManagedPath(cacheRoot, candidate, { leafKind: 'file' });
            result.removedBytes += info.size;
            if (partialFile) result.removedPartials += 1;
            else result.removedFiles += 1;
          } catch (error) {
            if (error.code !== 'ENOENT') result.skipped += 1;
          }
        }
        this.forgetVerifiedBlob(sha256);
        this.invalidBlobs.delete(sha256);
        const prefixPath = path.dirname(blob);
        if (isStrictChildPath(cacheRoot, prefixPath)) {
          try { await removeSafeManagedPath(cacheRoot, prefixPath, { leafKind: 'directory' }); } catch { /* shared or non-empty prefix */ }
        }
      }

      await this.flushIntegrityIndex();
      await this.refreshStates({ includeActiveGameId: gameId });
      const state = await this.getState();
      this.emit('state', state);
      return result;
    } catch (error) {
      await this.refreshStates({ includeActiveGameId: gameId }).catch(() => {});
      this.getState().then((state) => this.emit('state', state)).catch(() => {});
      throw error;
    } finally {
      this.activeRemoval = null;
    }
  }

  async runInstall(gameId, signal) {
    const priorReceipt = this.receipts.get(gameId);
    const startingState = this.gameStates.get(gameId) || {};
    const assetBlobBaseUrl = this.catalog.assetBlobBaseUrl || '';
    const repairing = startingState.status === 'repair';
    this.emitProgress(gameId, {
      status: 'preparing',
      message: repairing ? '正在檢查需要修復的素材' : '正在準備下載',
      hasInstalled: repairing ? false : Boolean(startingState.hasInstalled),
      currentFile: '檢查版本資料…'
    }, true);
    throwIfAborted(signal);
    await this.validateCacheOwnership(this.cacheRoot);
    const { bytes: manifestBytes, manifest, fileName } = await this.getManifest(gameId, { signal });
    if (this.activeInstall?.gameId === gameId) this.activeInstall.manifest = manifest;
    throwIfAborted(signal);
    const unique = new Map();
    for (const asset of manifest.assets) if (!unique.has(asset.sha256)) unique.set(asset.sha256, asset);
    const assets = [...unique.values()];
    let cachedBytes = 0;
    let cachedFiles = 0;
    const missing = [];
    for (const asset of assets) {
      throwIfAborted(signal);
      if (await this.verifyBlob(asset, { signal })) {
        cachedBytes += asset.size;
        cachedFiles += 1;
        continue;
      }
      await removeSafeManagedPath(this.cacheRoot, blobPath(this.cacheRoot, asset.sha256), { force: true, leafKind: 'file' });
      this.forgetVerifiedBlob(asset.sha256);
      missing.push(asset);
    }
    const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
    const missingBytes = missing.reduce((sum, asset) => sum + asset.size, 0);
    const freeBytes = await availableBytes(this.cacheRoot);
    const reserve = Math.max(DOWNLOAD_RESERVE_BYTES, Math.ceil(missingBytes * 0.1));
    if (freeBytes < missingBytes + reserve) {
      throw new Error(`空間不足：至少還需要 ${Math.ceil((missingBytes + reserve - freeBytes) / 1024 / 1024)} MB。`);
    }

    const runtime = {
      downloadedBytes: cachedBytes,
      completedFiles: cachedFiles,
      totalBytes,
      totalFiles: assets.length
    };
    this.emitProgress(gameId, {
      ...runtime,
      status: 'downloading',
      message: repairing ? '正在修復遊戲素材' : (priorReceipt ? '正在下載更新' : '正在下載遊戲素材'),
      hasInstalled: repairing ? false : Boolean(startingState.hasInstalled),
      currentFile: '準備下載…'
    }, true);

    const normal = missing.filter((asset) => asset.size < LARGE_FILE_BYTES);
    const large = missing.filter((asset) => asset.size >= LARGE_FILE_BYTES);
    await this.downloadQueue(gameId, normal, 4, runtime, signal, assetBlobBaseUrl);
    await this.downloadQueue(gameId, large, 2, runtime, signal, assetBlobBaseUrl);
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError');

    this.emitProgress(gameId, { ...runtime, status: 'verifying', message: '正在驗證遊戲檔案', currentFile: '' }, true);
    let verified = 0;
    for (const asset of assets) {
      if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
      const valid = await this.verifyBlob(asset, { signal });
      if (!valid) throw new Error(`素材驗證失敗：${asset.path}`);
      verified += 1;
      if (verified % 32 === 0 || verified === assets.length) {
        this.emitProgress(gameId, { ...runtime, status: 'verifying', completedFiles: verified, totalFiles: assets.length }, verified === assets.length);
      }
    }

    await this.flushIntegrityIndex();
    throwIfAborted(signal);
    const manifestTarget = path.join(this.cacheRoot, 'manifests', gameId, fileName);
    await ensureSafeManagedDirectory(this.cacheRoot, path.dirname(manifestTarget));
    const temporary = `${manifestTarget}.${process.pid}.${Date.now()}.tmp`;
    await assertSafeManagedPath(this.cacheRoot, temporary, { allowMissing: true, leafKind: 'file' });
    await fsp.writeFile(temporary, manifestBytes, { flag: 'wx' });
    await removeSafeManagedPath(this.cacheRoot, manifestTarget, { force: true, leafKind: 'file' });
    await renameSafeManagedFile(this.cacheRoot, temporary, manifestTarget);
    const receipt = {
      schema: RECEIPT_SCHEMA,
      gameId,
      releaseId: manifest.releaseId,
      manifestSha256: sha256Bytes(manifestBytes),
      manifestFile: fileName,
      installedAt: new Date().toISOString()
    };
    await atomicWriteJson(this.cacheRoot, path.join(this.cacheRoot, 'receipts', `${gameId}.json`), receipt);
    this.receipts.set(gameId, {
      ...receipt,
      manifestPath: manifestTarget,
      manifest,
      assetIndex: new Map(manifest.assets.map((asset) => [asset.path.normalize('NFC').toLowerCase(), asset]))
    });
    await this.cleanupUnusedCache({ completedGameId: gameId });
    await this.refreshStates({ includeActiveGameId: gameId });
    const finalState = this.gameStates.get(gameId) || {};
    this.emitProgress(gameId, {
      ...finalState,
      downloadedBytes: totalBytes, completedFiles: assets.length, totalFiles: assets.length, totalBytes
    }, true);
  }

  async downloadQueue(gameId, assets, concurrency, runtime, signal, assetBlobBaseUrl = '') {
    let cursor = 0;
    const worker = async () => {
      while (true) {
        if (signal.aborted) throw new DOMException('Aborted', 'AbortError');
        const index = cursor++;
        if (index >= assets.length) return;
        const asset = assets[index];
        let lastReported = 0;
        await this.downloadBlob(asset, signal, (received) => {
          const delta = received - lastReported;
          lastReported = received;
          runtime.downloadedBytes += delta;
          this.emitProgress(gameId, { ...runtime, currentFile: path.posix.basename(asset.path) });
        }, { assetBlobBaseUrl });
        runtime.completedFiles += 1;
        this.emitProgress(gameId, { ...runtime, currentFile: path.posix.basename(asset.path) }, true);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, assets.length)) }, worker));
  }

  async downloadBlob(asset, signal, onProgress, { assetBlobBaseUrl = '' } = {}) {
    const approvedAssetBlobBaseUrl = validateAssetBlobBaseUrl(assetBlobBaseUrl, this.catalogValidationOptions);
    const sources = approvedAssetBlobBaseUrl
      ? [
          { url: encodeAssetBlobUrl(approvedAssetBlobBaseUrl, asset.sha256), immutable: true },
          { url: encodeAssetUrl(this.origin, asset.path), immutable: false }
        ]
      : [{ url: encodeAssetUrl(this.origin, asset.path), immutable: false }];
    let lastError = null;
    for (const source of sources) {
      for (let attempt = 1; attempt <= this.downloadMaxAttempts; attempt += 1) {
        throwIfAborted(signal);
        try {
          await this.downloadBlobOnce(asset, signal, onProgress, source);
          return;
        } catch (error) {
          if (signal?.aborted) throw abortError();
          lastError = error;
          const networkFailure = error?.name === 'TypeError' || ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'ETIMEDOUT'].includes(error?.code);
          const retryable = error?.retryable === true || networkFailure;
          if (attempt >= this.downloadMaxAttempts || !retryable) break;
          const retryAfter = Number(error?.retryAfterMs) || this.downloadRetryBaseMs * (2 ** (attempt - 1));
          await delayWithSignal(Math.min(5_000, retryAfter), signal);
        }
      }
    }
    throw lastError || new Error(`下載失敗：${asset.path}`);
  }

  async downloadBlobOnce(asset, signal, onProgress, source) {
    const target = blobPath(this.cacheRoot, asset.sha256);
    const partial = path.join(this.cacheRoot, 'partial', `${asset.sha256}.part`);
    await ensureSafeManagedDirectory(this.cacheRoot, path.dirname(target));
    await ensureSafeManagedDirectory(this.cacheRoot, path.dirname(partial));
    await assertSafeManagedPath(this.cacheRoot, target, { allowMissing: true, leafKind: 'file' });
    await assertSafeManagedPath(this.cacheRoot, partial, { allowMissing: true, leafKind: 'file' });
    let start = 0;
    const partialInfo = await lstatIfPresent(partial);
    if (partialInfo) {
      const info = await fsp.lstat(partial);
      if (info.isFile() && info.size <= asset.size) start = info.size;
      else await removeSafeManagedPath(this.cacheRoot, partial, { force: true });
    }
    if (start === asset.size) {
      const digest = await this.hashFileImpl(partial, signal);
      if (digest === asset.sha256) {
        await removeSafeManagedPath(this.cacheRoot, target, { force: true, leafKind: 'file' });
        await renameSafeManagedFile(this.cacheRoot, partial, target);
        const fingerprint = await this.fingerprintBlob(asset);
        if (!fingerprint) throw new Error(`下載完成檔案大小不符：${asset.path}`);
        this.rememberVerifiedBlob(asset, fingerprint);
        onProgress(asset.size);
        return;
      }
      await removeSafeManagedPath(this.cacheRoot, partial, { force: true, leafKind: 'file' });
      start = 0;
    }
    const headers = { 'Accept-Encoding': 'identity' };
    if (!source.immutable) headers['Cache-Control'] = 'no-cache';
    if (start > 0) headers.Range = `bytes=${start}-`;
    const requestController = new AbortController();
    let requestTimedOut = false;
    let idleTimedOut = false;
    let idleTimer = null;
    const requestTimer = setTimeout(() => {
      requestTimedOut = true;
      requestController.abort();
    }, this.downloadRequestTimeoutMs);
    const relayAbort = () => requestController.abort();
    const cleanupRequest = () => {
      clearTimeout(requestTimer);
      if (idleTimer) clearTimeout(idleTimer);
      signal?.removeEventListener('abort', relayAbort);
    };
    signal?.addEventListener('abort', relayAbort, { once: true });
    let response;
    try {
      response = await this.fetchImpl(source.url, {
        cache: 'no-store', redirect: 'error', headers, signal: requestController.signal
      });
    } catch (error) {
      cleanupRequest();
      if (signal?.aborted) throw abortError();
      if (requestTimedOut) {
        const timeout = new Error(`下載連線逾時：${asset.path}`);
        timeout.retryable = true;
        throw timeout;
      }
      throw error;
    }
    clearTimeout(requestTimer);
    const retryableStatus = response.status === 408 || response.status === 429 || response.status >= 500;
    if (retryableStatus) {
      cleanupRequest();
      try { await response.body?.cancel(); } catch { /* ignore */ }
      const error = new Error(`下載暫時失敗（HTTP ${response.status}）：${asset.path}`);
      error.retryable = true;
      const retryAfterSeconds = Number(response.headers.get('retry-after'));
      if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) error.retryAfterMs = retryAfterSeconds * 1_000;
      throw error;
    }
    if (start > 0 && response.status === 200) {
      start = 0;
      await removeSafeManagedPath(this.cacheRoot, partial, { force: true, leafKind: 'file' });
    } else if (start > 0) {
      if (response.status !== 206) {
        cleanupRequest();
        throw new Error(`續傳失敗（HTTP ${response.status}）：${asset.path}`);
      }
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
      if (!match || Number(match[1]) !== start || Number(match[3]) !== asset.size) {
        cleanupRequest();
        throw new Error(`續傳範圍不符：${asset.path}`);
      }
    } else if (response.status !== 200 && response.status !== 206) {
      cleanupRequest();
      throw new Error(`下載失敗（HTTP ${response.status}）：${asset.path}`);
    }
    if (start === 0 && response.status === 206) {
      const match = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range') || '');
      if (!match || Number(match[1]) !== 0 || Number(match[3]) !== asset.size) {
        cleanupRequest();
        throw new Error(`下載範圍不符：${asset.path}`);
      }
    }
    if (!response.body) {
      cleanupRequest();
      throw new Error(`下載沒有內容：${asset.path}`);
    }
    await assertSafeManagedPath(this.cacheRoot, partial, { allowMissing: start === 0, leafKind: 'file' });
    const handle = await fsp.open(partial, start > 0 ? 'a' : 'w');
    let received = start;
    onProgress(received);
    const armIdleTimer = () => {
      if (idleTimer) clearTimeout(idleTimer);
      idleTimer = setTimeout(() => {
        idleTimedOut = true;
        requestController.abort();
      }, this.downloadIdleTimeoutMs);
    };
    try {
      const reader = response.body.getReader();
      armIdleTimer();
      while (true) {
        throwIfAborted(signal);
        const { done, value } = await reader.read();
        if (done) break;
        armIdleTimer();
        if (received + value.byteLength > asset.size) throw new Error(`下載內容超過預期大小：${asset.path}`);
        await handle.write(Buffer.from(value));
        received += value.byteLength;
        onProgress(received);
      }
      await handle.sync();
    } catch (error) {
      if (signal?.aborted) throw abortError();
      if (requestTimedOut || idleTimedOut) {
        const timeout = new Error(`下載資料逾時：${asset.path}`);
        timeout.retryable = true;
        throw timeout;
      }
      if (error?.name === 'TypeError' || error?.name === 'AbortError') error.retryable = true;
      throw error;
    } finally {
      cleanupRequest();
      await handle.close();
    }
    if (received !== asset.size) {
      const error = new Error(`下載大小不符：${asset.path}`);
      error.retryable = true;
      throw error;
    }
    await assertSafeManagedPath(this.cacheRoot, partial, { allowMissing: false, leafKind: 'file' });
    const digest = await this.hashFileImpl(partial, signal);
    if (digest !== asset.sha256) {
      await removeSafeManagedPath(this.cacheRoot, partial, { force: true, leafKind: 'file' });
      throw new Error(`下載驗證失敗：${asset.path}`);
    }
    await removeSafeManagedPath(this.cacheRoot, target, { force: true, leafKind: 'file' });
    await renameSafeManagedFile(this.cacheRoot, partial, target);
    const fingerprint = await this.fingerprintBlob(asset);
    if (!fingerprint) throw new Error(`下載完成檔案大小不符：${asset.path}`);
    this.rememberVerifiedBlob(asset, fingerprint);
  }

  async verifyBlob(asset, { forceHash = false, signal } = {}) {
    const target = blobPath(this.cacheRoot, asset.sha256);
    try {
      throwIfAborted(signal);
      const before = await this.fingerprintBlob(asset);
      if (!before) {
        this.forgetVerifiedBlob(asset.sha256);
        return false;
      }
      const signature = fingerprintSignature(before);
      if (this.invalidBlobs.get(asset.sha256) === signature) return false;
      const persisted = this.integrityRecords.get(asset.sha256);
      if (!forceHash && this.verifiedBlobs.get(asset.sha256) === signature) return true;
      if (!forceHash && persisted && persisted.size === asset.size && fingerprintSignature(persisted) === signature) {
        this.verifiedBlobs.set(asset.sha256, signature);
        return true;
      }
      const digest = await this.hashFileImpl(target, signal);
      throwIfAborted(signal);
      const after = await this.fingerprintBlob(asset);
      const stable = after && fingerprintSignature(after) === signature;
      const valid = Boolean(stable && digest === asset.sha256);
      if (valid) {
        this.rememberVerifiedBlob(asset, after);
      } else {
        this.forgetVerifiedBlob(asset.sha256);
        if (after) this.invalidBlobs.set(asset.sha256, fingerprintSignature(after));
      }
      return valid;
    } catch {
      if (signal?.aborted) throw abortError();
      this.forgetVerifiedBlob(asset.sha256);
      return false;
    }
  }

  async cleanupUnusedCache({ completedGameId = '' } = {}) {
    const cacheRoot = path.resolve(this.cacheRoot);
    await this.validateCacheOwnership(cacheRoot);
    const keepBlobHashes = new Set();
    const protectedPartialSizes = new Map();
    for (const receipt of this.receipts.values()) {
      for (const asset of receipt.manifest.assets) keepBlobHashes.add(asset.sha256);
    }
    if (this.activeInstall?.manifest) {
      for (const asset of this.activeInstall.manifest.assets) {
        keepBlobHashes.add(asset.sha256);
        protectedPartialSizes.set(asset.sha256, asset.size);
      }
    }
    for (const gameId of GAME_IDS) {
      if (gameId === completedGameId) continue;
      const entry = this.catalog.games[gameId];
      const cached = this.cachedManifests.get(`${gameId}:${entry.manifestSha256}`);
      let manifest = cached?.manifest || null;
      if (!manifest) {
        const receipt = this.receipts.get(gameId);
        if (receipt?.manifestSha256 === entry.manifestSha256) manifest = receipt.manifest;
      }
      if (!manifest) {
        try { manifest = (await this.getManifest(gameId)).manifest; } catch { /* receipt hashes remain protected */ }
      }
      if (!manifest) continue;
      for (const asset of manifest.assets) {
        keepBlobHashes.add(asset.sha256);
        protectedPartialSizes.set(asset.sha256, asset.size);
      }
    }

    const result = { removedBlobs: 0, removedBlobBytes: 0, removedPartials: 0, removedPartialBytes: 0, skipped: 0 };
    const blobRoot = path.join(cacheRoot, 'blobs', 'sha256');
    if (!isStrictChildPath(cacheRoot, blobRoot)) throw new Error('素材快取清理路徑不安全。');
    let prefixEntries = [];
    try { prefixEntries = await fsp.readdir(blobRoot, { withFileTypes: true }); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const prefixEntry of prefixEntries) {
      if (!prefixEntry.isDirectory() || !/^[a-f0-9]{2}$/.test(prefixEntry.name)) continue;
      const prefixPath = path.join(blobRoot, prefixEntry.name);
      if (!isStrictChildPath(cacheRoot, prefixPath)) continue;
      let entries = [];
      try { entries = await fsp.readdir(prefixPath, { withFileTypes: true }); } catch { result.skipped += 1; continue; }
      for (const entry of entries) {
        if (!entry.isFile() || !HASH_PATTERN.test(entry.name) || !entry.name.startsWith(prefixEntry.name)) continue;
        if (keepBlobHashes.has(entry.name)) continue;
        const candidate = path.join(prefixPath, entry.name);
        if (!isStrictChildPath(cacheRoot, candidate)) continue;
        await assertSafeManagedPath(cacheRoot, candidate, { allowMissing: false, leafKind: 'file' });
        try {
          const info = await fsp.lstat(candidate);
          if (!info.isFile() || info.isSymbolicLink()) continue;
          await removeSafeManagedPath(cacheRoot, candidate, { leafKind: 'file' });
          result.removedBlobs += 1;
          result.removedBlobBytes += info.size;
          this.forgetVerifiedBlob(entry.name);
          this.invalidBlobs.delete(entry.name);
        } catch { result.skipped += 1; }
      }
      try { await removeSafeManagedPath(cacheRoot, prefixPath, { leafKind: 'directory' }); } catch { /* non-empty or already gone */ }
    }

    const partialRoot = path.join(cacheRoot, 'partial');
    if (!isStrictChildPath(cacheRoot, partialRoot)) throw new Error('素材續傳清理路徑不安全。');
    let partialEntries = [];
    try { partialEntries = await fsp.readdir(partialRoot, { withFileTypes: true }); } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    for (const entry of partialEntries) {
      const match = /^([a-f0-9]{64})\.part$/.exec(entry.name);
      if (!entry.isFile() || !match) continue;
      const sha256 = match[1];
      const candidate = path.join(partialRoot, entry.name);
      if (!isStrictChildPath(cacheRoot, candidate)) continue;
      await assertSafeManagedPath(cacheRoot, candidate, { allowMissing: false, leafKind: 'file' });
      try {
        const info = await fsp.lstat(candidate);
        if (!info.isFile() || info.isSymbolicLink()) continue;
        const expectedSize = protectedPartialSizes.get(sha256);
        let preserve = Number.isSafeInteger(expectedSize) && info.size > 0 && info.size <= expectedSize;
        if (preserve) {
          try {
            const completedPath = blobPath(cacheRoot, sha256);
            await assertSafeManagedPath(cacheRoot, completedPath, { allowMissing: false, leafKind: 'file' });
            const completed = await fsp.lstat(completedPath);
            if (completed.isFile() && completed.size === expectedSize) preserve = false;
          } catch {
            // A valid partial for another/current active game must survive.
          }
        }
        if (preserve) continue;
        await removeSafeManagedPath(cacheRoot, candidate, { leafKind: 'file' });
        result.removedPartials += 1;
        result.removedPartialBytes += info.size;
      } catch { result.skipped += 1; }
    }
    await this.flushIntegrityIndex();
    return result;
  }

  getInstalledManifest(gameId) {
    return this.receipts.get(gameId)?.manifest || null;
  }

  canLaunch(gameId) {
    const state = this.gameStates.get(gameId);
    return (
      GAME_IDS.has(gameId) && Boolean(this.receipts.get(gameId)) && this.activeInstall?.gameId !== gameId &&
      state?.hasInstalled === true && (state.status === 'installed' || state.status === 'update')
    );
  }

  async resolveAsset(gameId, assetPath) {
    const validated = safeAssetPath(assetPath);
    const receipt = this.receipts.get(gameId);
    if (!validated || !receipt) return null;
    const asset = receipt.assetIndex.get(validated.path.normalize('NFC').toLowerCase());
    if (!asset || !(await this.verifyBlob(asset))) {
      await this.flushIntegrityIndex();
      const state = this.gameStates.get(gameId) || {};
      this.gameStates.set(gameId, { ...state, status: 'repair', message: '素材損壞，需要修復', hasInstalled: false });
      this.getState().then((state) => this.emit('state', state)).catch(() => {});
      return null;
    }
    return { ...asset, filePath: blobPath(this.cacheRoot, asset.sha256) };
  }
}

module.exports = {
  AssetStore,
  CACHE_OWNER_FILE,
  availableBytes,
  blobPath,
  cacheOwnershipMarkerPath,
  canonicalJson,
  encodeAssetBlobUrl,
  encodeAssetUrl,
  safeAssetPath,
  sha256Bytes,
  sha256File,
  validateCatalog,
  validateCacheRootPath,
  validateAssetBlobBaseUrl,
  validateIntegrityDocument,
  validateManifest
};
