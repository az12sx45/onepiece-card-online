'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');

const CATALOG_SCHEMA = 1;
const MANIFEST_SCHEMA = 1;
const RECEIPT_SCHEMA = 1;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_PATTERN = /^[a-z0-9][a-z0-9._-]{0,95}$/;
const MANIFEST_PATH_PATTERN = /^desktop\/manifests\/[a-z0-9._-]+\.json$/;
const ASSET_ROOTS = new Set(['images', 'audio', 'videos', 'fonts']);
const GAME_IDS = new Set(['card', 'board']);
const RESERVED_SEGMENTS = new Set(['incoming', 'backup', 'backups', 'private', 'battle_chess']);
const DOWNLOAD_RESERVE_BYTES = 512 * 1024 * 1024;
const LARGE_FILE_BYTES = 32 * 1024 * 1024;
const INTEGRITY_SCHEMA = 1;
const INTEGRITY_MAX_ENTRIES = 20_000;
const INTEGRITY_INDEX_MAX_BYTES = 12 * 1024 * 1024;
const DEFAULT_AUDIT_MAX_FILES = 4;
const DEFAULT_AUDIT_MAX_BYTES = 64 * 1024 * 1024;

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

function validateCatalog(document) {
  if (!isPlainObject(document) || document.schema !== CATALOG_SCHEMA || !isPlainObject(document.games)) {
    throw new Error('版本目錄格式不正確。');
  }
  if (Object.keys(document.games).join(',') !== 'card,board,chess' || !isPlainObject(document.games.chess) || document.games.chess.available !== false) {
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
  const games = {};
  for (const gameId of ['card', 'board']) {
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
    games: {
      ...games,
      chess: { available: false }
    }
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

async function atomicWriteJson(target, value) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const handle = await fsp.open(temporary, 'wx');
  try {
    await handle.writeFile(canonicalJson(value), 'utf8');
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsp.rename(temporary, target);
}

async function atomicWriteBuffer(target, value) {
  await fsp.mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
  const handle = await fsp.open(temporary, 'wx');
  try {
    await handle.writeFile(value);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await fsp.rename(temporary, target);
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
    downloadMaxAttempts = 3
  }) {
    super();
    this.origin = String(origin || '').replace(/\/+$/, '');
    this.bundledCatalogRoot = path.resolve(bundledCatalogRoot);
    this.cacheRoot = path.resolve(cacheRoot);
    this.fetchImpl = fetchImpl || globalThis.fetch;
    this.hashFileImpl = typeof hashFileImpl === 'function' ? hashFileImpl : sha256File;
    this.integrityAuditMaxFiles = Math.max(0, Math.min(64, Number(integrityAuditMaxFiles) || 0));
    this.integrityAuditMaxBytes = Math.max(0, Number(integrityAuditMaxBytes) || 0);
    this.manifestTimeoutMs = Math.max(100, Number(manifestTimeoutMs) || 8_000);
    this.downloadRequestTimeoutMs = Math.max(100, Number(downloadRequestTimeoutMs) || 15_000);
    this.downloadIdleTimeoutMs = Math.max(100, Number(downloadIdleTimeoutMs) || 20_000);
    this.downloadRetryBaseMs = Math.max(10, Number(downloadRetryBaseMs) || 300);
    this.downloadMaxAttempts = Math.max(1, Math.min(5, Number(downloadMaxAttempts) || 3));
    this.catalog = null;
    this.catalogSource = 'bundled';
    this.receipts = new Map();
    this.gameStates = new Map();
    this.activeInstall = null;
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
    await this.loadIntegrityIndex();
    await this.loadBundledCatalog();
    await Promise.all(['card', 'board'].map((gameId) => this.loadReceipt(gameId)));
    await this.loadLastKnownGoodCatalog();
    await this.refreshStates();
    const state = await this.getState();
    this.startBackgroundIntegrityAudit();
    return state;
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
      const info = await fsp.stat(indexPath);
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
      await atomicWriteJson(integrityIndexPath(cacheRoot), document);
      if (generation === this.integrityGeneration && revision === this.integrityRevision) this.integrityDirty = false;
    });
    return this.integrityWritePromise;
  }

  async fingerprintBlob(asset) {
    const info = await fsp.stat(blobPath(this.cacheRoot, asset.sha256), { bigint: true });
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
        await fsp.rm(blobPath(this.cacheRoot, asset.sha256), { force: true });
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
    const catalogPath = path.join(this.bundledCatalogRoot, 'catalog-v1.json');
    const document = JSON.parse(await fsp.readFile(catalogPath, 'utf8'));
    this.catalog = validateCatalog(document);
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
      const catalogPath = path.join(root, 'catalog-v1.json');
      const info = await fsp.stat(catalogPath);
      if (!info.isFile() || info.size > 256 * 1024) throw new Error('cached catalog size');
      const catalog = validateCatalog(JSON.parse(await fsp.readFile(catalogPath, 'utf8')));
      const results = new Map();
      for (const gameId of ['card', 'board']) {
        const entry = catalog.games[gameId];
        const bytes = await fsp.readFile(path.join(root, 'manifests', path.posix.basename(entry.manifestPath)));
        const result = this.validateManifestResult(bytes, entry, gameId);
        this.assertNotDowngrade(gameId, result, entry.manifestSha256);
        results.set(`${gameId}:${entry.manifestSha256}`, result);
      }
      const bundledCreatedAt = Date.parse(this.catalog.createdAt);
      const cachedCreatedAt = Date.parse(catalog.createdAt);
      const matchesInstalled = ['card', 'board'].some((gameId) => (
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
    for (const gameId of ['card', 'board']) {
      const result = results.get(`${gameId}:${catalog.games[gameId].manifestSha256}`);
      await atomicWriteBuffer(path.join(root, 'manifests', result.fileName), result.bytes);
    }
    await atomicWriteJson(path.join(root, 'catalog-v1.json'), catalog);
  }

  async refreshRemoteCatalog() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);
    try {
      const response = await this.fetchImpl(`${this.origin}/desktop/catalog-v1.json?launcher=${encodeURIComponent(process.versions.electron || 'desktop')}`, {
        cache: 'no-store',
        redirect: 'error',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 256 * 1024) throw new Error('版本目錄過大。');
      const catalog = validateCatalog(JSON.parse(bytes.toString('utf8')));
      const results = new Map();
      for (const gameId of ['card', 'board']) {
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
    if (this.activeInstall) throw new Error('下載進行中，請先暫停。');
    const raw = String(nextRoot || '').trim();
    if (!raw) throw new Error('下載位置不正確。');
    const resolved = path.resolve(raw);
    if (!path.isAbsolute(resolved)) throw new Error('下載位置不正確。');
    await fsp.mkdir(resolved, { recursive: true });
    this.cacheRoot = resolved;
    this.receipts.clear();
    this.cachedManifests.clear();
    await this.loadIntegrityIndex();
    await this.loadBundledCatalog();
    await Promise.all(['card', 'board'].map((gameId) => this.loadReceipt(gameId)));
    await this.loadLastKnownGoodCatalog();
    await this.refreshStates();
    this.startBackgroundIntegrityAudit();
    this.getState().then((state) => this.emit('state', state)).catch(() => {});
  }

  async loadReceipt(gameId) {
    const receiptPath = path.join(this.cacheRoot, 'receipts', `${gameId}.json`);
    try {
      const source = JSON.parse(await fsp.readFile(receiptPath, 'utf8'));
      if (
        source?.schema !== RECEIPT_SCHEMA || source.gameId !== gameId || !RELEASE_PATTERN.test(String(source.releaseId || '')) ||
        !HASH_PATTERN.test(String(source.manifestSha256 || '')) || !/^[a-z0-9._-]+\.json$/.test(String(source.manifestFile || ''))
      ) throw new Error('receipt shape');
      const manifestPath = path.join(this.cacheRoot, 'manifests', gameId, source.manifestFile);
      const manifestBytes = await fsp.readFile(manifestPath);
      if (sha256Bytes(manifestBytes) !== source.manifestSha256) throw new Error('receipt manifest hash');
      const manifest = validateManifest(JSON.parse(manifestBytes.toString('utf8')), gameId);
      if (manifest.releaseId !== source.releaseId) throw new Error('receipt release');
      this.receipts.set(gameId, {
        ...source,
        manifestPath,
        manifest,
        assetIndex: new Map(manifest.assets.map((asset) => [asset.path.normalize('NFC').toLowerCase(), asset]))
      });
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
    for (const gameId of ['card', 'board']) {
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
        installedVersion,
        remoteVersion: latest.releaseId,
        totalFiles: latest.totalFiles,
        totalBytes: latest.totalBytes,
        downloadedBytes: 0,
        completedFiles: 0
      });
    }
    this.gameStates.set('chess', {
      status: 'unavailable',
      message: '仍在製作與校準中',
      hasInstalled: false,
      remoteVersion: '',
      totalFiles: 0,
      totalBytes: 0
    });
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
        const bundled = validateCatalog(JSON.parse(await fsp.readFile(path.join(this.bundledCatalogRoot, 'catalog-v1.json'), 'utf8')));
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

  async runInstall(gameId, signal) {
    const priorReceipt = this.receipts.get(gameId);
    const startingState = this.gameStates.get(gameId) || {};
    const repairing = startingState.status === 'repair';
    this.emitProgress(gameId, {
      status: 'preparing',
      message: repairing ? '正在檢查需要修復的素材' : '正在準備下載',
      hasInstalled: repairing ? false : Boolean(startingState.hasInstalled),
      currentFile: '檢查版本資料…'
    }, true);
    throwIfAborted(signal);
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
      await fsp.rm(blobPath(this.cacheRoot, asset.sha256), { force: true });
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
    await this.downloadQueue(gameId, normal, 4, runtime, signal);
    await this.downloadQueue(gameId, large, 2, runtime, signal);
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
    await fsp.mkdir(path.dirname(manifestTarget), { recursive: true });
    const temporary = `${manifestTarget}.${process.pid}.${Date.now()}.tmp`;
    await fsp.writeFile(temporary, manifestBytes, { flag: 'wx' });
    await fsp.rm(manifestTarget, { force: true });
    await fsp.rename(temporary, manifestTarget);
    const receipt = {
      schema: RECEIPT_SCHEMA,
      gameId,
      releaseId: manifest.releaseId,
      manifestSha256: sha256Bytes(manifestBytes),
      manifestFile: fileName,
      installedAt: new Date().toISOString()
    };
    await atomicWriteJson(path.join(this.cacheRoot, 'receipts', `${gameId}.json`), receipt);
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

  async downloadQueue(gameId, assets, concurrency, runtime, signal) {
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
        });
        runtime.completedFiles += 1;
        this.emitProgress(gameId, { ...runtime, currentFile: path.posix.basename(asset.path) }, true);
      }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, Math.max(1, assets.length)) }, worker));
  }

  async downloadBlob(asset, signal, onProgress) {
    let lastError = null;
    for (let attempt = 1; attempt <= this.downloadMaxAttempts; attempt += 1) {
      throwIfAborted(signal);
      try {
        await this.downloadBlobOnce(asset, signal, onProgress);
        return;
      } catch (error) {
        if (signal?.aborted) throw abortError();
        lastError = error;
        const networkFailure = error?.name === 'TypeError' || ['ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENETUNREACH', 'ETIMEDOUT'].includes(error?.code);
        if (attempt >= this.downloadMaxAttempts || (error?.retryable !== true && !networkFailure)) throw error;
        const retryAfter = Number(error?.retryAfterMs) || this.downloadRetryBaseMs * (2 ** (attempt - 1));
        await delayWithSignal(Math.min(5_000, retryAfter), signal);
      }
    }
    throw lastError || new Error(`下載失敗：${asset.path}`);
  }

  async downloadBlobOnce(asset, signal, onProgress) {
    const target = blobPath(this.cacheRoot, asset.sha256);
    const partial = path.join(this.cacheRoot, 'partial', `${asset.sha256}.part`);
    await fsp.mkdir(path.dirname(target), { recursive: true });
    await fsp.mkdir(path.dirname(partial), { recursive: true });
    let start = 0;
    try {
      const info = await fsp.stat(partial);
      if (info.isFile() && info.size <= asset.size) start = info.size;
      else await fsp.rm(partial, { force: true });
    } catch {
      // No partial download yet.
    }
    if (start === asset.size) {
      const digest = await this.hashFileImpl(partial, signal);
      if (digest === asset.sha256) {
        await fsp.rm(target, { force: true });
        await fsp.rename(partial, target);
        const fingerprint = await this.fingerprintBlob(asset);
        if (!fingerprint) throw new Error(`下載完成檔案大小不符：${asset.path}`);
        this.rememberVerifiedBlob(asset, fingerprint);
        onProgress(asset.size);
        return;
      }
      await fsp.rm(partial, { force: true });
      start = 0;
    }
    const headers = { 'Accept-Encoding': 'identity', 'Cache-Control': 'no-cache' };
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
      response = await this.fetchImpl(encodeAssetUrl(this.origin, asset.path), {
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
      await fsp.rm(partial, { force: true });
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
    const digest = await this.hashFileImpl(partial, signal);
    if (digest !== asset.sha256) {
      await fsp.rm(partial, { force: true });
      throw new Error(`下載驗證失敗：${asset.path}`);
    }
    await fsp.rm(target, { force: true });
    await fsp.rename(partial, target);
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
        try {
          const info = await fsp.lstat(candidate);
          if (!info.isFile() || info.isSymbolicLink()) continue;
          await fsp.unlink(candidate);
          result.removedBlobs += 1;
          result.removedBlobBytes += info.size;
          this.forgetVerifiedBlob(entry.name);
          this.invalidBlobs.delete(entry.name);
        } catch { result.skipped += 1; }
      }
      try { await fsp.rmdir(prefixPath); } catch { /* non-empty or already gone */ }
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
      try {
        const info = await fsp.lstat(candidate);
        if (!info.isFile() || info.isSymbolicLink()) continue;
        const expectedSize = protectedPartialSizes.get(sha256);
        let preserve = Number.isSafeInteger(expectedSize) && info.size > 0 && info.size <= expectedSize;
        if (preserve) {
          try {
            const completed = await fsp.stat(blobPath(cacheRoot, sha256));
            if (completed.isFile() && completed.size === expectedSize) preserve = false;
          } catch {
            // A valid partial for another/current active game must survive.
          }
        }
        if (preserve) continue;
        await fsp.unlink(candidate);
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
  availableBytes,
  blobPath,
  canonicalJson,
  encodeAssetUrl,
  safeAssetPath,
  sha256Bytes,
  sha256File,
  validateCatalog,
  validateIntegrityDocument,
  validateManifest
};
