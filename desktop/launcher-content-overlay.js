'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { TRUSTED_RELEASE_KEYS } = require('./launcher-update-service');

const SCHEMA = 1;
const MANIFEST_PATH = '/desktop/launcher-content-v1.json';
const BLOB_BASE = 'https://game-assets.rihdi.tw/desktop/launcher/content/blobs/sha256/';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const MANIFEST_TIMEOUT_MS = 12_000;
const BLOB_TIMEOUT_MS = 5 * 60_000;
const SHA256 = /^[a-f0-9]{64}$/;
const RENDERER_FILES = new Set([
  'launcher.html', 'launcher.css', 'launcher.js',
  'launcher-social.js', 'launcher-social.css',
  'launcher-profile-shop.js', 'launcher-profile-shop.css',
  'launcher-reserved-crew.js', 'launcher-life-data.js', 'launcher-life-actions.js',
  'launcher-life.js', 'launcher-life-room.js', 'launcher-room.js', 'launcher-room.css',
  'launcher-room-ambience.js', 'launcher-room-ambience.css',
  'launcher-room-aquarium.js', 'launcher-room-aquarium.css',
  'launcher-room-minigames.js', 'launcher-room-minigames.css',
  'launcher-room-dialogue.js', 'launcher-room-motion-data.js', 'launcher-room-motion.js',
  'launcher-announcements.js', 'launcher-announcements.css',
  'launcher-updates-ui.js', 'launcher-account-ui.js'
]);

function fail(code, message) {
  const error = new Error(message);
  error.code = code;
  throw error;
}

function exactObject(value, keys, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...keys].sort())) {
    fail(code, '內容更新清單欄位不正確。');
  }
}

function allowedContentPath(value) {
  if (typeof value !== 'string' || value.length > 240 || value.includes('\\') || value.includes('..') || value.startsWith('/') ||
      !/^[a-z0-9][a-z0-9._/-]*$/.test(value) || value.includes('//')) return false;
  if (RENDERER_FILES.has(value)) return true;
  return /^(?:images|audio|videos)\/[a-z0-9._/-]+\.(?:webp|png|jpg|jpeg|ogg|mp3|mp4|webm)$/.test(value);
}

function canonicalPayload(document) {
  return Buffer.from(JSON.stringify({
    schema: document.schema, channel: document.channel, platform: document.platform, arch: document.arch,
    coreVersion: document.coreVersion, revision: document.revision, publishedAt: document.publishedAt,
    baseUrl: document.baseUrl,
    files: document.files.map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256 }))
  }), 'utf8');
}

function validateManifest(document, coreVersion, trustedKeys = TRUSTED_RELEASE_KEYS) {
  exactObject(document,
    ['schema', 'channel', 'platform', 'arch', 'coreVersion', 'revision', 'publishedAt', 'baseUrl', 'files', 'signature'],
    'invalid_content_manifest');
  if (document.schema !== SCHEMA || document.channel !== 'stable' || document.platform !== 'win32' || document.arch !== 'x64' ||
      document.coreVersion !== coreVersion || !Number.isSafeInteger(document.revision) || document.revision < 1 ||
      typeof document.publishedAt !== 'string' || !Number.isFinite(Date.parse(document.publishedAt)) ||
      document.baseUrl !== BLOB_BASE || !Array.isArray(document.files) || document.files.length > MAX_FILES) {
    fail('invalid_content_manifest', '內容更新清單不適用於目前啟動器。');
  }
  let total = 0;
  let previous = '';
  const seen = new Set();
  for (const file of document.files) {
    exactObject(file, ['path', 'bytes', 'sha256'], 'invalid_content_manifest');
    if (!allowedContentPath(file.path) || file.path <= previous || seen.has(file.path.toLowerCase()) ||
        !Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_FILE_BYTES ||
        typeof file.sha256 !== 'string' || !SHA256.test(file.sha256)) {
      fail('invalid_content_manifest', '內容更新檔案資訊不正確。');
    }
    total += file.bytes;
    if (total > MAX_TOTAL_BYTES) fail('content_too_large', '內容更新超過大小限制。');
    seen.add(file.path.toLowerCase());
    previous = file.path;
  }
  exactObject(document.signature, ['algorithm', 'keyId', 'value'], 'invalid_content_signature');
  const { algorithm, keyId, value } = document.signature;
  if (algorithm !== 'Ed25519' || typeof keyId !== 'string' || !/^launcher-ed25519-[a-f0-9]{32}$/.test(keyId) ||
      typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value)) {
    fail('invalid_content_signature', '內容更新簽章格式不正確。');
  }
  const publicDer = trustedKeys[keyId];
  if (!publicDer) fail('untrusted_content_key', '內容更新簽章金鑰不受信任。');
  const signature = Buffer.from(value, 'base64');
  if (signature.length !== 64 || signature.toString('base64') !== value ||
      !crypto.verify(null, canonicalPayload(document),
        crypto.createPublicKey({ key: Buffer.from(publicDer, 'base64'), format: 'der', type: 'spki' }), signature)) {
    fail('invalid_content_signature', '內容更新簽章驗證失敗。');
  }
  return document;
}

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

function responseHeader(response, name) {
  return String(response?.headers?.get?.(name) || '').trim();
}

async function readLimited(response, maximum) {
  if (!response?.body) fail('invalid_content_response', '內容更新回應無法讀取。');
  const parts = [];
  let total = 0;
  const body = response.body;
  const source = typeof body[Symbol.asyncIterator] === 'function' ? body :
    typeof body.getReader === 'function' ? (async function* () {
      const reader = body.getReader();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          yield value;
        }
      } finally { reader.releaseLock(); }
    })() : null;
  if (!source) fail('invalid_content_response', '內容更新回應無法讀取。');
  for await (const chunk of source) {
    total += chunk.length;
    if (total > maximum) fail('content_too_large', '內容更新下載超過大小限制。');
    parts.push(Buffer.from(chunk));
  }
  return Buffer.concat(parts, total);
}

async function withDeadline(work, milliseconds) {
  const controller = new AbortController();
  let timer;
  try {
    return await Promise.race([
      work(controller.signal),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          controller.abort();
          const error = new Error('內容更新連線逾時。');
          error.code = 'content_timeout';
          reject(error);
        }, milliseconds);
      })
    ]);
  } finally { clearTimeout(timer); }
}

class LauncherContentOverlay {
  constructor({ coreVersion, userDataPath, origin, fetchImpl, trustedKeys = TRUSTED_RELEASE_KEYS,
    bundledDesktopRoot = null, bundledAssetsRoot = null,
    manifestTimeoutMs = MANIFEST_TIMEOUT_MS, blobTimeoutMs = BLOB_TIMEOUT_MS }) {
    if (typeof coreVersion !== 'string' || !/^\d+\.\d+\.\d+$/.test(coreVersion) ||
        typeof userDataPath !== 'string' || !path.isAbsolute(userDataPath) ||
        origin !== 'https://onepiece-card-online.onrender.com' || typeof fetchImpl !== 'function' ||
        !Number.isSafeInteger(manifestTimeoutMs) || manifestTimeoutMs < 1 || manifestTimeoutMs > MANIFEST_TIMEOUT_MS ||
        !Number.isSafeInteger(blobTimeoutMs) || blobTimeoutMs < 1 || blobTimeoutMs > BLOB_TIMEOUT_MS) {
      fail('invalid_content_config', '內容更新設定不正確。');
    }
    this.coreVersion = coreVersion;
    this.root = path.join(userDataPath, 'launcher-content-v1');
    this.blobRoot = path.join(this.root, 'blobs');
    this.origin = origin;
    this.fetchImpl = fetchImpl;
    this.manifestTimeoutMs = manifestTimeoutMs;
    this.blobTimeoutMs = blobTimeoutMs;
    this.trustedKeys = trustedKeys;
    this.bundledDesktopRoot = bundledDesktopRoot;
    this.bundledAssetsRoot = bundledAssetsRoot;
    this.active = null;
    this.activeSlot = -1;
    this.activeFiles = new Map();
    this.activeModes = new Map();
    this.rejectedRevision = 0;
  }

  slotPath(index) { return path.join(this.root, `manifest-${index}.json`); }
  blobPath(sha256) { return path.join(this.blobRoot, sha256); }
  rejectedPath() { return path.join(this.root, 'rejected-revision.json'); }

  bundledPath(relativePath) {
    const root = relativePath.includes('/') ? this.bundledAssetsRoot : this.bundledDesktopRoot;
    return root ? path.join(root, ...relativePath.split('/')) : null;
  }

  async verifiedContent(file) {
    const bundled = this.bundledPath(file.path);
    if (bundled) {
      const stat = await fsp.lstat(bundled).catch(() => null);
      if (stat?.isFile() && !stat.isSymbolicLink() && stat.size === file.bytes && await hashFile(bundled) === file.sha256) {
        return 'bundled';
      }
    }
    const blob = this.blobPath(file.sha256);
    const stat = await fsp.lstat(blob).catch(() => null);
    return stat?.isFile() && !stat.isSymbolicLink() && stat.size === file.bytes && await hashFile(blob) === file.sha256
      ? 'blob' : false;
  }

  async load() {
    try {
      const rejected = JSON.parse(await fsp.readFile(this.rejectedPath(), 'utf8'));
      this.rejectedRevision = rejected?.coreVersion === this.coreVersion && Number.isSafeInteger(rejected?.revision)
        ? rejected.revision : 0;
    } catch { this.rejectedRevision = 0; }
    const valid = [];
    for (const slot of [0, 1]) {
      let document;
      try {
        const stat = await fsp.lstat(this.slotPath(slot));
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size > MAX_MANIFEST_BYTES) continue;
        document = validateManifest(JSON.parse(await fsp.readFile(this.slotPath(slot), 'utf8')), this.coreVersion, this.trustedKeys);
        if (document.revision === this.rejectedRevision) continue;
        let filesValid = true;
        const modes = new Map();
        for (const file of document.files) {
          const mode = await this.verifiedContent(file);
          if (!mode) { filesValid = false; break; }
          modes.set(file.path, mode);
        }
        if (filesValid) valid.push({ slot, document, modes });
      } catch {
        // A torn slot or changed blob is ignored; the other slot and bundled UI remain available.
      }
    }
    valid.sort((left, right) => right.document.revision - left.document.revision);
    this.active = valid[0]?.document || null;
    this.activeSlot = valid[0]?.slot ?? -1;
    this.activeFiles = new Map(this.active?.files.map((file) => [file.path, file]) || []);
    this.activeModes = valid[0]?.modes || new Map();
    return this.active?.revision || 0;
  }

  resolve(relativePath) {
    const file = this.activeFiles.get(relativePath);
    return file && this.activeModes.get(relativePath) === 'blob' ? this.blobPath(file.sha256) : null;
  }

  async readVerified(relativePath) {
    const file = this.activeFiles.get(relativePath);
    if (!file || this.activeModes.get(relativePath) === 'bundled') return null;
    const blob = this.blobPath(file.sha256);
    const stat = await fsp.lstat(blob).catch(() => null);
    if (!stat?.isFile() || stat.isSymbolicLink() || stat.size !== file.bytes) {
      fail('content_hash_mismatch', '已安裝的內容更新檔案有變動。');
    }
    const bytes = await fsp.readFile(blob);
    if (bytes.length !== file.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
      fail('content_hash_mismatch', '已安裝的內容更新檔案有變動。');
    }
    return bytes;
  }

  deactivate() {
    this.active = null;
    this.activeSlot = -1;
    this.activeFiles.clear();
    this.activeModes.clear();
  }

  async rejectActive() {
    const revision = this.active?.revision || 0;
    if (!revision) { this.deactivate(); return 0; }
    const record = { coreVersion: this.coreVersion, revision };
    await fsp.mkdir(this.root, { recursive: true });
    const temp = path.join(this.root, `.rejected-${crypto.randomBytes(8).toString('hex')}.part`);
    try {
      await fsp.writeFile(temp, `${JSON.stringify(record)}\n`, { flag: 'wx' });
      await fsp.rename(temp, this.rejectedPath());
    } finally { await fsp.rm(temp, { force: true }).catch(() => {}); }
    return this.load();
  }

  async fetchManifest() {
    const url = new URL(MANIFEST_PATH, this.origin);
    return withDeadline(async (signal) => {
      const response = await this.fetchImpl(url.href, { cache: 'no-store', redirect: 'error', signal,
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' } });
      if (response?.status !== 200 || response.ok === false || (response.url && response.url !== url.href)) return null;
      const length = responseHeader(response, 'content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_MANIFEST_BYTES)) fail('content_too_large', '內容更新清單過大。');
      const bytes = await readLimited(response, MAX_MANIFEST_BYTES);
      if (length && Number(length) !== bytes.length) fail('invalid_content_manifest', '內容更新清單長度不符。');
      let document;
      try { document = JSON.parse(bytes.toString('utf8')); }
      catch { fail('invalid_content_manifest', '內容更新清單不是有效 JSON。'); }
      return validateManifest(document, this.coreVersion, this.trustedKeys);
    }, this.manifestTimeoutMs);
  }

  async fetchBlob(file) {
    if (await this.verifiedContent(file)) return false;
    await fsp.mkdir(this.blobRoot, { recursive: true });
    const url = new URL(file.sha256, BLOB_BASE);
    const bytes = await withDeadline(async (signal) => {
      const response = await this.fetchImpl(url.href, { cache: 'no-store', redirect: 'error', signal,
        headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity' } });
      if (response?.status !== 200 || response.ok === false || (response.url && response.url !== url.href)) fail('content_blob_http', '內容更新檔案無法下載。');
      const length = responseHeader(response, 'content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) !== file.bytes)) fail('content_size_mismatch', '內容更新檔案大小不符。');
      return readLimited(response, file.bytes);
    }, this.blobTimeoutMs);
    if (bytes.length !== file.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== file.sha256) {
      fail('content_hash_mismatch', '內容更新檔案 SHA-256 不符。');
    }
    const temp = path.join(this.blobRoot, `.${file.sha256}.${crypto.randomBytes(8).toString('hex')}.part`);
    try {
      await fsp.writeFile(temp, bytes, { flag: 'wx' });
      await fsp.rename(temp, this.blobPath(file.sha256));
    } finally { await fsp.rm(temp, { force: true }).catch(() => {}); }
    if (!await this.verifiedContent(file)) fail('content_hash_mismatch', '內容更新檔案寫入後驗證失敗。');
    return true;
  }

  async stage(onProgress = () => {}) {
    const document = await this.fetchManifest();
    if (!document || document.revision <= (this.active?.revision || 0) || document.revision === this.rejectedRevision) {
      return { staged: false, revision: this.active?.revision || 0, downloadedBytes: 0 };
    }
    const missing = new Map();
    for (const file of document.files) {
      if (!await this.verifiedContent(file)) missing.set(file.sha256, file);
    }
    const totalBytes = [...missing.values()].reduce((sum, file) => sum + file.bytes, 0);
    let downloadedBytes = 0;
    onProgress({ status: 'downloading', revision: document.revision, downloadedBytes, totalBytes });
    for (const file of missing.values()) {
      if (await this.fetchBlob(file)) {
        downloadedBytes += file.bytes;
        onProgress({ status: 'downloading', revision: document.revision, downloadedBytes, totalBytes });
      }
    }
    const slot = this.activeSlot === 0 ? 1 : 0;
    await fsp.mkdir(this.root, { recursive: true });
    const temp = path.join(this.root, `.manifest-${slot}.${crypto.randomBytes(8).toString('hex')}.part`);
    try {
      await fsp.writeFile(temp, `${JSON.stringify(document)}\n`, { flag: 'wx' });
      await fsp.rename(temp, this.slotPath(slot));
    } finally { await fsp.rm(temp, { force: true }).catch(() => {}); }
    // The active page keeps its loaded scripts and art until the next process start.
    return { staged: true, revision: document.revision, downloadedBytes, totalBytes };
  }
}

module.exports = { BLOB_BASE, LauncherContentOverlay, RENDERER_FILES, canonicalPayload, validateManifest };
