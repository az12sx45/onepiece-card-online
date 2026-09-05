'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const { spawn: nodeSpawn } = require('node:child_process');

const MANIFEST_SCHEMA = 1;
const DEFAULT_MANIFEST_PATH = '/desktop/launcher-release-v1.json';
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_INSTALLER_BYTES = 256 * 1024 * 1024;
const DEFAULT_MANIFEST_TIMEOUT_MS = 10_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 30 * 60_000;
const DEFAULT_SPAWN_TIMEOUT_MS = 5_000;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const RELEASE_SIGNATURE_ALGORITHM = 'Ed25519';
const RELEASE_SIGNATURE_BYTES = 64;
const RELEASE_KEY_ID_PATTERN = /^launcher-ed25519-[a-f0-9]{32}$/;

// Replaced only through a reviewed launcher release. The matching private key is
// stored outside the repository under the Windows user's DPAPI protection.
const TRUSTED_RELEASE_KEYS = Object.freeze({
  'launcher-ed25519-cadd711c990664d5715de23131cadf45':
    'MCowBQYDK2VwAyEAkSxE7aLqcZ8U91QvOhPfBwAJ0wmAaGfyBEO/jG5Kajs='
});

class LauncherUpdateError extends Error {
  constructor(code, message, options = {}) {
    super(message, options.cause ? { cause: options.cause } : undefined);
    this.name = 'LauncherUpdateError';
    this.code = code;
  }
}

function fail(code, message, options) {
  throw new LauncherUpdateError(code, message, options);
}

function parseSemver(value) {
  if (typeof value !== 'string' || value.length > 128) fail('invalid_version', '版本格式不正確。');
  const match = SEMVER_PATTERN.exec(value);
  if (!match) fail('invalid_version', '版本格式不正確。');
  return Object.freeze({
    raw: value,
    core: Object.freeze([match[1], match[2], match[3]]),
    prerelease: Object.freeze(match[4] ? match[4].split('.') : []),
    build: Object.freeze(match[5] ? match[5].split('.') : [])
  });
}

function compareNumericText(left, right) {
  if (left.length !== right.length) return left.length < right.length ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function comparePrereleaseIdentifier(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);
  if (leftNumeric && rightNumeric) return compareNumericText(left, right);
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return left === right ? 0 : left < right ? -1 : 1;
}

function compareSemver(leftValue, rightValue) {
  const left = typeof leftValue === 'string' ? parseSemver(leftValue) : leftValue;
  const right = typeof rightValue === 'string' ? parseSemver(rightValue) : rightValue;
  if (!left?.core || !right?.core) fail('invalid_version', '版本格式不正確。');
  for (let index = 0; index < 3; index += 1) {
    const result = compareNumericText(left.core[index], right.core[index]);
    if (result) return result;
  }
  if (!left.prerelease.length && !right.prerelease.length) return 0;
  if (!left.prerelease.length) return 1;
  if (!right.prerelease.length) return -1;
  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) return -1;
    if (right.prerelease[index] === undefined) return 1;
    const result = comparePrereleaseIdentifier(left.prerelease[index], right.prerelease[index]);
    if (result) return result;
  }
  return 0;
}

function parseHttpsUrl(value, code, message) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail(code, message);
  }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.hash) fail(code, message);
  return parsed;
}

function normalizeOrigin(value) {
  const parsed = parseHttpsUrl(value, 'invalid_origin', '更新來源必須是 HTTPS。');
  if (parsed.pathname !== '/' || parsed.search) fail('invalid_origin', '更新來源必須是純 HTTPS origin。');
  return parsed.origin;
}

function responseHeader(response, name) {
  if (!response?.headers) return '';
  if (typeof response.headers.get === 'function') return String(response.headers.get(name) || '');
  const target = name.toLowerCase();
  const entry = Object.entries(response.headers).find(([key]) => key.toLowerCase() === target);
  return entry ? String(entry[1] || '') : '';
}

function validateContentLength(response, maximum, expected = null) {
  const raw = responseHeader(response, 'content-length').trim();
  if (!raw) return;
  if (!/^\d+$/.test(raw)) fail('invalid_content_length', '更新伺服器回傳的檔案大小不正確。');
  const size = Number(raw);
  if (!Number.isSafeInteger(size) || size < 0 || size > maximum) fail('download_too_large', '更新檔超過允許大小。');
  if (expected !== null && size !== expected) fail('size_mismatch', '更新檔大小與 manifest 不符。');
}

async function* responseChunks(response) {
  if (response?.body && typeof response.body[Symbol.asyncIterator] === 'function') {
    for await (const chunk of response.body) yield Buffer.from(chunk);
    return;
  }
  if (response?.body && typeof response.body.getReader === 'function') {
    const reader = response.body.getReader();
    try {
      while (true) {
        const result = await reader.read();
        if (result.done) break;
        yield Buffer.from(result.value);
      }
    } finally {
      reader.releaseLock?.();
    }
    return;
  }
  if (typeof response?.arrayBuffer === 'function') {
    yield Buffer.from(await response.arrayBuffer());
    return;
  }
  fail('invalid_response', '更新伺服器沒有回傳可讀取的內容。');
}

async function readResponseLimited(response, maximum) {
  validateContentLength(response, maximum);
  const chunks = [];
  let total = 0;
  for await (const chunk of responseChunks(response)) {
    total += chunk.length;
    if (total > maximum) fail('manifest_too_large', '更新 manifest 超過允許大小。');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks, total);
}

function assertResponseUrl(response, expectedUrl, allowedOrigins, code) {
  if (!response?.url) return;
  let actual;
  try {
    actual = new URL(response.url);
  } catch {
    fail(code, '更新伺服器回傳了不安全的重新導向。');
  }
  if (actual.protocol !== 'https:' || actual.username || actual.password || actual.hash || !allowedOrigins.has(actual.origin)) {
    fail(code, '更新伺服器回傳了不安全的重新導向。');
  }
  if (actual.href !== expectedUrl.href) fail(code, '更新下載不得重新導向。');
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, code, message) {
  if (!isPlainObject(value)) fail(code, message);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((key, index) => key !== wanted[index])) fail(code, message);
}

function canonicalReleasePayload(document) {
  if (!isPlainObject(document) || !isPlainObject(document.artifact)) fail('invalid_manifest', '更新 manifest 格式不正確。');
  return Buffer.from(JSON.stringify({
    schema: document.schema,
    channel: document.channel,
    platform: document.platform,
    arch: document.arch,
    version: document.version,
    publishedAt: document.publishedAt,
    artifact: {
      fileName: document.artifact.fileName,
      bytes: document.artifact.bytes,
      sha256: document.artifact.sha256,
      url: document.artifact.url
    }
  }), 'utf8');
}

function decodeSignature(value) {
  if (typeof value !== 'string' || value.length !== 88 || !/^[A-Za-z0-9+/]{86}==$/.test(value)) {
    fail('invalid_manifest_signature', '更新 manifest 簽章格式不正確。');
  }
  const bytes = Buffer.from(value, 'base64');
  if (bytes.length !== RELEASE_SIGNATURE_BYTES || bytes.toString('base64') !== value) {
    fail('invalid_manifest_signature', '更新 manifest 簽章格式不正確。');
  }
  return bytes;
}

function normalizeTrustedReleaseKeys(value = TRUSTED_RELEASE_KEYS) {
  if (!isPlainObject(value)) fail('invalid_release_keys', '啟動器內建更新公鑰設定不正確。');
  const keys = new Map();
  for (const [keyId, encoded] of Object.entries(value)) {
    if (!RELEASE_KEY_ID_PATTERN.test(keyId) || typeof encoded !== 'string' || !encoded) {
      fail('invalid_release_keys', '啟動器內建更新公鑰設定不正確。');
    }
    let key;
    let der;
    try {
      der = Buffer.from(encoded, 'base64');
      if (!der.length || der.toString('base64') !== encoded) throw new Error('non-canonical base64');
      key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
    } catch (error) {
      fail('invalid_release_keys', '啟動器內建更新公鑰設定不正確。', { cause: error });
    }
    if (key.asymmetricKeyType !== 'ed25519') fail('invalid_release_keys', '啟動器內建更新公鑰不是 Ed25519。');
    const expectedKeyId = `launcher-ed25519-${crypto.createHash('sha256').update(der).digest('hex').slice(0, 32)}`;
    if (keyId !== expectedKeyId) fail('invalid_release_keys', '啟動器內建更新公鑰與 keyId 不一致。');
    keys.set(keyId, key);
  }
  if (!keys.size) fail('invalid_release_keys', '啟動器未設定可信任的更新公鑰。');
  return keys;
}

function verifyReleaseManifestSignature(document, trustedReleaseKeys = TRUSTED_RELEASE_KEYS) {
  assertExactKeys(
    document,
    ['schema', 'channel', 'platform', 'arch', 'version', 'publishedAt', 'artifact', 'signature'],
    'invalid_manifest',
    '新版 manifest 含有未簽署的未知欄位。'
  );
  assertExactKeys(
    document.artifact,
    ['fileName', 'bytes', 'sha256', 'url'],
    'invalid_manifest',
    '新版 manifest 的 artifact 格式不正確。'
  );
  assertExactKeys(
    document.signature,
    ['algorithm', 'keyId', 'value'],
    'invalid_manifest_signature',
    '更新 manifest 簽章格式不正確。'
  );
  if (document.signature.algorithm !== RELEASE_SIGNATURE_ALGORITHM) {
    fail('unsupported_manifest_signature', '更新 manifest 使用不支援的簽章演算法。');
  }
  const keyId = document.signature.keyId;
  if (typeof keyId !== 'string' || !RELEASE_KEY_ID_PATTERN.test(keyId)) {
    fail('untrusted_manifest_key', '更新 manifest 使用未知的簽章金鑰。');
  }
  const keys = trustedReleaseKeys instanceof Map ? trustedReleaseKeys : normalizeTrustedReleaseKeys(trustedReleaseKeys);
  const publicKey = keys.get(keyId);
  if (!publicKey) fail('untrusted_manifest_key', '更新 manifest 使用未知的簽章金鑰。');
  const signature = decodeSignature(document.signature.value);
  let valid = false;
  try {
    valid = crypto.verify(null, canonicalReleasePayload(document), publicKey, signature);
  } catch (error) {
    fail('invalid_manifest_signature', '更新 manifest 簽章驗證失敗。', { cause: error });
  }
  if (!valid) fail('invalid_manifest_signature', '更新 manifest 簽章驗證失敗。');
  return true;
}

function validateReleaseManifest(document, options) {
  if (!document || typeof document !== 'object' || Array.isArray(document)) fail('invalid_manifest', '更新 manifest 格式不正確。');
  const {
    manifestUrl,
    currentVersion,
    platform = 'win32',
    arch = 'x64',
    maxInstallerBytes = MAX_INSTALLER_BYTES,
    allowedArtifactOrigins = new Set([manifestUrl.origin]),
    trustedReleaseKeys = TRUSTED_RELEASE_KEYS
  } = options;
  if (document.schema !== MANIFEST_SCHEMA || document.channel !== 'stable') fail('invalid_manifest', '更新 manifest schema 或 channel 不正確。');
  if (document.platform !== platform || document.arch !== arch) fail('wrong_platform', '更新檔不適用於目前的平台或架構。');
  const version = parseSemver(document.version).raw;
  if (typeof document.publishedAt !== 'string' || !Number.isFinite(Date.parse(document.publishedAt))) {
    fail('invalid_manifest', '更新 manifest 缺少有效發布時間。');
  }
  const updateAvailable = compareSemver(version, currentVersion) > 0;
  if (!updateAvailable) {
    return Object.freeze({
      schema: MANIFEST_SCHEMA,
      channel: 'stable',
      platform,
      arch,
      version,
      publishedAt: document.publishedAt,
      updateAvailable: false
    });
  }
  const artifact = document.artifact;
  if (!artifact || typeof artifact !== 'object' || Array.isArray(artifact)) fail('invalid_manifest', '新版 manifest 缺少 NSIS 安裝檔。');
  if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes <= 0 || artifact.bytes > maxInstallerBytes) {
    fail('download_too_large', '更新檔大小超過允許範圍。');
  }
  const sha256 = String(artifact.sha256 || '').toLowerCase();
  if (!HASH_PATTERN.test(sha256)) fail('invalid_manifest', '更新 manifest 的 SHA-256 不正確。');
  if (typeof artifact.url !== 'string' || !artifact.url || artifact.url.length > 2048) {
    fail('invalid_manifest', '更新 manifest 的下載網址不正確。');
  }
  let artifactUrl;
  try {
    artifactUrl = new URL(artifact.url, manifestUrl);
  } catch {
    fail('invalid_manifest', '更新 manifest 的下載網址不正確。');
  }
  if (
    artifactUrl.protocol !== 'https:' || artifactUrl.username || artifactUrl.password || artifactUrl.hash ||
    artifactUrl.search || !allowedArtifactOrigins.has(artifactUrl.origin)
  ) {
    fail('untrusted_artifact', '更新檔下載來源不在允許清單。');
  }
  let fileName;
  const expectedFileName = `ONE-PIECE-Tabletop-Launcher-${version}-${arch}.exe`;
  if (typeof artifact.fileName !== 'string' || artifact.fileName !== expectedFileName || path.basename(artifact.fileName) !== artifact.fileName) {
    fail('invalid_manifest', `更新檔名稱必須是 ${expectedFileName}。`);
  }
  try {
    fileName = decodeURIComponent(path.posix.basename(artifactUrl.pathname));
  } catch {
    fail('invalid_manifest', '更新檔名稱不正確。');
  }
  if (fileName !== artifact.fileName) fail('invalid_manifest', '更新網址與 manifest 檔名不一致。');
  verifyReleaseManifestSignature(document, trustedReleaseKeys);
  return Object.freeze({
    schema: MANIFEST_SCHEMA,
    channel: 'stable',
    platform,
    arch,
    version,
    publishedAt: document.publishedAt,
    updateAvailable: true,
    artifactUrl,
    fileName,
    bytes: artifact.bytes,
    sha256
  });
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function validatePortableExecutable(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const dos = Buffer.alloc(64);
    const dosRead = await handle.read(dos, 0, dos.length, 0);
    if (dosRead.bytesRead !== dos.length || dos.toString('ascii', 0, 2) !== 'MZ') fail('invalid_installer', '下載內容不是有效的 Windows 安裝檔。');
    const peOffset = dos.readUInt32LE(0x3c);
    const stat = await handle.stat();
    if (peOffset <= 0 || peOffset + 4 > stat.size) fail('invalid_installer', 'Windows 安裝檔的 PE header 不正確。');
    const signature = Buffer.alloc(4);
    const peRead = await handle.read(signature, 0, signature.length, peOffset);
    if (peRead.bytesRead !== 4 || !signature.equals(Buffer.from([0x50, 0x45, 0, 0]))) {
      fail('invalid_installer', 'Windows 安裝檔的 PE signature 不正確。');
    }
  } finally {
    await handle.close();
  }
}

async function verifyInstaller(filePath, release, maximum) {
  const stat = await fsp.stat(filePath).catch(() => null);
  if (!stat?.isFile() || stat.size !== release.bytes || stat.size > maximum) fail('size_mismatch', '更新檔大小與 manifest 不符。');
  const digest = await sha256File(filePath);
  if (digest !== release.sha256) fail('hash_mismatch', '更新檔 SHA-256 驗證失敗。');
  await validatePortableExecutable(filePath);
  return true;
}

function safeUpdateError(error, fallbackCode = 'update_failed', fallbackMessage = '啟動器更新失敗。') {
  if (error instanceof LauncherUpdateError) return error;
  if (error?.name === 'AbortError') return new LauncherUpdateError('aborted', '啟動器更新已取消。', { cause: error });
  return new LauncherUpdateError(fallbackCode, fallbackMessage, { cause: error });
}

async function writeAll(handle, buffer) {
  let offset = 0;
  while (offset < buffer.length) {
    const result = await handle.write(buffer, offset, buffer.length - offset, null);
    if (!result.bytesWritten) fail('write_failed', '無法寫入更新暫存檔。');
    offset += result.bytesWritten;
  }
}

function waitForSpawn(child, timeoutMs) {
  if (!child || typeof child !== 'object') return Promise.reject(new LauncherUpdateError('spawn_failed', '無法啟動更新安裝程式。'));
  if (Number.isInteger(child.pid) && child.pid > 0) return Promise.resolve();
  if (typeof child.once !== 'function') return Promise.reject(new LauncherUpdateError('spawn_failed', '無法確認更新安裝程式已啟動。'));
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      child.removeListener?.('spawn', onSpawn);
      child.removeListener?.('error', onError);
      if (error) reject(error);
      else resolve();
    };
    const onSpawn = () => finish();
    const onError = (error) => finish(new LauncherUpdateError('spawn_failed', '無法啟動更新安裝程式。', { cause: error }));
    const timer = setTimeout(() => finish(new LauncherUpdateError('spawn_timeout', '啟動更新安裝程式逾時。')), timeoutMs);
    timer.unref?.();
    child.once('spawn', onSpawn);
    child.once('error', onError);
  });
}

class LauncherUpdateService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.origin = normalizeOrigin(options.origin);
    const manifestCandidate = new URL(options.manifestUrl || DEFAULT_MANIFEST_PATH, this.origin);
    if (manifestCandidate.protocol !== 'https:' || manifestCandidate.origin !== this.origin || manifestCandidate.username || manifestCandidate.password || manifestCandidate.hash) {
      fail('invalid_manifest_url', '更新 manifest 必須使用正式站同源 HTTPS 網址。');
    }
    this.manifestUrl = manifestCandidate;
    this.currentVersion = parseSemver(options.currentVersion).raw;
    this.platform = options.platform || process.platform;
    this.arch = options.arch || process.arch;
    if (this.platform !== 'win32' || this.arch !== 'x64') fail('unsupported_platform', '目前只支援 Windows x64 NSIS 更新。');
    if (typeof options.downloadRoot !== 'string' || !path.isAbsolute(options.downloadRoot)) fail('invalid_download_root', '更新暫存目錄必須是絕對路徑。');
    this.downloadRoot = path.resolve(options.downloadRoot);
    if (this.downloadRoot === path.parse(this.downloadRoot).root) fail('invalid_download_root', '更新暫存目錄不可使用磁碟根目錄。');
    this.maxInstallerBytes = options.maxInstallerBytes ?? MAX_INSTALLER_BYTES;
    if (!Number.isSafeInteger(this.maxInstallerBytes) || this.maxInstallerBytes <= 0 || this.maxInstallerBytes > MAX_INSTALLER_BYTES) {
      fail('invalid_size_limit', `更新檔上限必須介於 1 與 ${MAX_INSTALLER_BYTES} bytes。`);
    }
    this.manifestTimeoutMs = options.manifestTimeoutMs ?? DEFAULT_MANIFEST_TIMEOUT_MS;
    this.downloadTimeoutMs = options.downloadTimeoutMs ?? DEFAULT_DOWNLOAD_TIMEOUT_MS;
    this.spawnTimeoutMs = options.spawnTimeoutMs ?? DEFAULT_SPAWN_TIMEOUT_MS;
    for (const [name, value] of [['manifestTimeoutMs', this.manifestTimeoutMs], ['downloadTimeoutMs', this.downloadTimeoutMs], ['spawnTimeoutMs', this.spawnTimeoutMs]]) {
      if (!Number.isSafeInteger(value) || value < 1) fail('invalid_timeout', `${name} 必須是正整數。`);
    }
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.spawnImpl = options.spawnImpl || nodeSpawn;
    this.quitImpl = options.quitImpl;
    if (typeof this.fetchImpl !== 'function' || typeof this.spawnImpl !== 'function' || typeof this.quitImpl !== 'function') {
      fail('missing_dependency', '更新服務缺少 fetch、spawn 或 quit 依賴。');
    }
    this.allowedArtifactOrigins = new Set([this.origin]);
    for (const candidate of options.allowedArtifactOrigins || []) this.allowedArtifactOrigins.add(normalizeOrigin(candidate));
    this.trustedReleaseKeys = normalizeTrustedReleaseKeys(options.trustedReleaseKeys || TRUSTED_RELEASE_KEYS);
    this.release = null;
    this.ready = null;
    this.checkPromise = null;
    this.downloadPromise = null;
    this.downloadController = null;
    this.state = Object.freeze({
      status: 'idle',
      currentVersion: this.currentVersion,
      availableVersion: '',
      downloadedBytes: 0,
      totalBytes: 0,
      progress: 0,
      errorCode: '',
      error: ''
    });
  }

  getState() {
    return { ...this.state };
  }

  _setState(status, patch = {}, emit = true) {
    this.state = Object.freeze({ ...this.state, ...patch, status });
    if (emit) this.emit('state', this.getState());
    return this.getState();
  }

  _setError(error) {
    const safe = safeUpdateError(error);
    this._setState('error', { errorCode: safe.code, error: safe.message });
    return safe;
  }

  _emitProgress(downloadedBytes, totalBytes) {
    const progress = totalBytes > 0 ? Math.min(100, downloadedBytes / totalBytes * 100) : 0;
    this._setState('downloading', { downloadedBytes, totalBytes, progress }, false);
    this.emit('progress', Object.freeze({ downloadedBytes, totalBytes, progress }));
  }

  _releasePaths(release) {
    const directory = path.join(this.downloadRoot, `${release.version}-${release.sha256.slice(0, 16)}`);
    const finalPath = path.join(directory, release.fileName);
    const partPath = `${finalPath}.part`;
    const relative = path.relative(this.downloadRoot, finalPath);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) fail('unsafe_path', '更新檔路徑超出暫存目錄。');
    return { directory, finalPath, partPath };
  }

  async checkForUpdates() {
    if (this.checkPromise) return this.checkPromise;
    if (this.downloadPromise || this.state.status === 'applying') fail('update_busy', '啟動器更新工作正在進行。');
    this.checkPromise = this._checkForUpdates().finally(() => { this.checkPromise = null; });
    return this.checkPromise;
  }

  async _checkForUpdates() {
    this._setState('checking', {
      availableVersion: '', downloadedBytes: 0, totalBytes: 0, progress: 0, errorCode: '', error: ''
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.manifestTimeoutMs);
    timer.unref?.();
    try {
      const response = await this.fetchImpl(this.manifestUrl.href, {
        cache: 'no-store',
        redirect: 'error',
        headers: { Accept: 'application/json', 'Accept-Encoding': 'identity' },
        signal: controller.signal
      });
      if (!response || response.status !== 200 || response.ok === false) fail('manifest_http', `更新 manifest HTTP ${response?.status || 0}。`);
      assertResponseUrl(response, this.manifestUrl, new Set([this.origin]), 'manifest_redirect');
      const contentType = responseHeader(response, 'content-type').toLowerCase();
      if (contentType && !contentType.startsWith('application/json')) fail('manifest_content_type', '更新 manifest Content-Type 必須是 application/json。');
      const bytes = await readResponseLimited(response, MAX_MANIFEST_BYTES);
      let document;
      try {
        document = JSON.parse(bytes.toString('utf8'));
      } catch {
        fail('invalid_manifest', '更新 manifest 不是有效 JSON。');
      }
      const release = validateReleaseManifest(document, {
        manifestUrl: this.manifestUrl,
        currentVersion: this.currentVersion,
        platform: this.platform,
        arch: this.arch,
        maxInstallerBytes: this.maxInstallerBytes,
        allowedArtifactOrigins: this.allowedArtifactOrigins,
        trustedReleaseKeys: this.trustedReleaseKeys
      });
      this.release = null;
      this.ready = null;
      if (!release.updateAvailable) {
        return this._setState('current', {
          availableVersion: release.version,
          downloadedBytes: 0,
          totalBytes: 0,
          progress: 0,
          errorCode: '',
          error: ''
        });
      }
      this.release = release;
      const paths = this._releasePaths(release);
      try {
        await verifyInstaller(paths.finalPath, release, this.maxInstallerBytes);
        this.ready = { release, installerPath: paths.finalPath };
        return this._setState('ready', {
          availableVersion: release.version,
          downloadedBytes: release.bytes,
          totalBytes: release.bytes,
          progress: 100,
          errorCode: '',
          error: ''
        });
      } catch {
        return this._setState('available', {
          availableVersion: release.version,
          downloadedBytes: 0,
          totalBytes: release.bytes,
          progress: 0,
          errorCode: '',
          error: ''
        });
      }
    } catch (error) {
      const safe = error?.name === 'AbortError'
        ? new LauncherUpdateError('manifest_timeout', '檢查啟動器更新逾時。', { cause: error })
        : safeUpdateError(error, 'check_failed', '無法檢查啟動器更新。');
      throw this._setError(safe);
    } finally {
      clearTimeout(timer);
    }
  }

  async downloadUpdate() {
    if (this.downloadPromise) return this.downloadPromise;
    if (this.checkPromise || this.state.status === 'applying') fail('update_busy', '啟動器更新工作正在進行。');
    if (!this.release || compareSemver(this.release.version, this.currentVersion) <= 0) fail('no_update', '目前沒有可下載的啟動器更新。');
    this.downloadPromise = this._downloadUpdate().finally(() => {
      this.downloadPromise = null;
      this.downloadController = null;
    });
    return this.downloadPromise;
  }

  async _downloadUpdate() {
    const release = this.release;
    const paths = this._releasePaths(release);
    await fsp.mkdir(paths.directory, { recursive: true });
    try {
      await verifyInstaller(paths.finalPath, release, this.maxInstallerBytes);
      this.ready = { release, installerPath: paths.finalPath };
      return this._setState('ready', {
        availableVersion: release.version,
        downloadedBytes: release.bytes,
        totalBytes: release.bytes,
        progress: 100,
        errorCode: '',
        error: ''
      });
    } catch {
      await fsp.rm(paths.finalPath, { force: true }).catch(() => {});
    }
    await fsp.rm(paths.partPath, { force: true }).catch(() => {});
    this.ready = null;
    this._setState('downloading', {
      availableVersion: release.version,
      downloadedBytes: 0,
      totalBytes: release.bytes,
      progress: 0,
      errorCode: '',
      error: ''
    });
    this._emitProgress(0, release.bytes);
    const controller = new AbortController();
    this.downloadController = controller;
    const timer = setTimeout(() => controller.abort(), this.downloadTimeoutMs);
    timer.unref?.();
    let handle = null;
    try {
      const response = await this.fetchImpl(release.artifactUrl.href, {
        cache: 'no-store',
        redirect: 'error',
        headers: { Accept: 'application/octet-stream', 'Accept-Encoding': 'identity' },
        signal: controller.signal
      });
      if (!response || response.status !== 200 || response.ok === false) fail('download_http', `更新檔 HTTP ${response?.status || 0}。`);
      assertResponseUrl(response, release.artifactUrl, this.allowedArtifactOrigins, 'artifact_redirect');
      validateContentLength(response, this.maxInstallerBytes, release.bytes);
      handle = await fsp.open(paths.partPath, 'wx');
      const hash = crypto.createHash('sha256');
      let downloaded = 0;
      for await (const chunk of responseChunks(response)) {
        if (controller.signal.aborted) fail('aborted', '啟動器更新已取消。');
        downloaded += chunk.length;
        if (downloaded > release.bytes || downloaded > this.maxInstallerBytes) fail('download_too_large', '更新檔超過 manifest 宣告大小。');
        await writeAll(handle, chunk);
        hash.update(chunk);
        this._emitProgress(downloaded, release.bytes);
      }
      if (downloaded !== release.bytes) fail('size_mismatch', '更新檔大小與 manifest 不符。');
      if (hash.digest('hex') !== release.sha256) fail('hash_mismatch', '更新檔 SHA-256 驗證失敗。');
      await handle.sync();
      await handle.close();
      handle = null;
      await validatePortableExecutable(paths.partPath);
      try {
        await fsp.rename(paths.partPath, paths.finalPath);
      } catch (error) {
        try {
          await verifyInstaller(paths.finalPath, release, this.maxInstallerBytes);
          await fsp.rm(paths.partPath, { force: true });
        } catch {
          fail('atomic_rename_failed', '無法完成更新檔原子切換。', { cause: error });
        }
      }
      await verifyInstaller(paths.finalPath, release, this.maxInstallerBytes);
      this.ready = { release, installerPath: paths.finalPath };
      return this._setState('ready', {
        availableVersion: release.version,
        downloadedBytes: release.bytes,
        totalBytes: release.bytes,
        progress: 100,
        errorCode: '',
        error: ''
      });
    } catch (error) {
      const safe = controller.signal.aborted
        ? new LauncherUpdateError('aborted', '啟動器更新已取消。', { cause: error })
        : safeUpdateError(error, 'download_failed', '下載啟動器更新失敗。');
      if (handle) await handle.close().catch(() => {});
      await fsp.rm(paths.partPath, { force: true }).catch(() => {});
      if (safe.code === 'aborted') {
        this._setState('available', { downloadedBytes: 0, progress: 0, errorCode: '', error: '' });
      } else {
        this._setError(safe);
      }
      throw safe;
    } finally {
      clearTimeout(timer);
    }
  }

  cancelDownload() {
    if (!this.downloadController || this.state.status !== 'downloading') return false;
    this.downloadController.abort();
    return true;
  }

  async installReadyUpdate() {
    if (this.checkPromise || this.downloadPromise || this.state.status === 'applying') fail('update_busy', '啟動器更新工作正在進行。');
    if (!this.ready || !this.release || this.ready.release.sha256 !== this.release.sha256) fail('not_ready', '啟動器更新尚未準備完成。');
    try {
      await verifyInstaller(this.ready.installerPath, this.ready.release, this.maxInstallerBytes);
      this._setState('applying', { errorCode: '', error: '' });
      const child = this.spawnImpl(this.ready.installerPath, ['--updated', '/S', '--force-run'], {
        detached: true,
        stdio: 'ignore',
        windowsHide: true,
        shell: false
      });
      await waitForSpawn(child, this.spawnTimeoutMs);
      child.unref?.();
      await Promise.resolve(this.quitImpl());
      return { ok: true, version: this.ready.release.version };
    } catch (error) {
      const safe = safeUpdateError(error, 'install_failed', '無法啟動更新安裝程式。');
      throw this._setError(safe);
    }
  }

  dispose() {
    this.downloadController?.abort();
    this.removeAllListeners();
  }
}

module.exports = {
  DEFAULT_MANIFEST_PATH,
  LauncherUpdateError,
  LauncherUpdateService,
  MANIFEST_SCHEMA,
  MAX_INSTALLER_BYTES,
  MAX_MANIFEST_BYTES,
  compareSemver,
  canonicalReleasePayload,
  parseSemver,
  RELEASE_SIGNATURE_ALGORITHM,
  TRUSTED_RELEASE_KEYS,
  validateReleaseManifest,
  verifyReleaseManifestSignature,
  verifyInstaller
};
