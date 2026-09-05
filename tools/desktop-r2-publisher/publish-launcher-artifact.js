'use strict';

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');

const assetPublisher = require('./publish');

const DEFAULT_PUBLIC_BASE_URL = 'https://game-assets.rihdi.tw';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const IMMUTABLE_CACHE_CONTROL = assetPublisher.IMMUTABLE_CACHE_CONTROL;
const INSTALLER_CONTENT_TYPE = 'application/vnd.microsoft.portable-executable';
const RELEASE_PREFIX = 'desktop/launcher/releases';
const MAX_INSTALLER_BYTES = 256 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sha256Bytes(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function validateVersion(value) {
  if (typeof value !== 'string' || value.length > 128 || !SEMVER_PATTERN.test(value)) {
    fail('Version must be a valid semantic version.');
  }
  return value;
}

function expectedInstallerFileName(version) {
  return `ONE-PIECE-Tabletop-Launcher-${validateVersion(version)}-x64.exe`;
}

function validatePublicBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || ''));
  } catch {
    fail('Public base URL is invalid.');
  }
  if (
    url.protocol !== 'https:' || url.username || url.password || url.search || url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  ) fail('Public base URL must be an HTTPS origin without credentials, path, query, or fragment.');
  return url.origin;
}

function installerKey(version, fileName) {
  const checkedVersion = validateVersion(version);
  const expectedName = expectedInstallerFileName(checkedVersion);
  if (fileName !== expectedName || path.basename(fileName) !== fileName) {
    fail(`Installer file name must be ${expectedName}.`);
  }
  return `${RELEASE_PREFIX}/${checkedVersion}/${fileName}`;
}

function publicObjectUrl(publicBaseUrl, key) {
  const origin = validatePublicBaseUrl(publicBaseUrl);
  const encodedKey = key.split('/').map((segment) => encodeURIComponent(segment)).join('/');
  return `${origin}/${encodedKey}`;
}

function parseExpectedBytes(value, label = 'Expected byte count') {
  const parsed = typeof value === 'number' ? value : Number(String(value || ''));
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > MAX_INSTALLER_BYTES) {
    fail(`${label} must be an integer from 1 through ${MAX_INSTALLER_BYTES}.`);
  }
  return parsed;
}

function validateExpectedSha256(value) {
  const normalized = String(value || '').toLowerCase();
  if (!HASH_PATTERN.test(normalized)) fail('Expected SHA-256 must contain exactly 64 hexadecimal characters.');
  return normalized;
}

function validatePortableExecutable(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 68 || bytes[0] !== 0x4d || bytes[1] !== 0x5a) {
    fail('Installer is not a valid Windows PE executable (missing MZ header).');
  }
  const peOffset = bytes.readUInt32LE(0x3c);
  if (peOffset < 0x40 || peOffset > bytes.length - 4 || bytes.toString('latin1', peOffset, peOffset + 4) !== 'PE\0\0') {
    fail('Installer is not a valid Windows PE executable (missing PE signature).');
  }
}

async function inspectInstaller({
  filePath,
  version,
  expectedSha256 = null,
  expectedBytes = null,
  publicBaseUrl = DEFAULT_PUBLIC_BASE_URL
} = {}) {
  if (typeof filePath !== 'string' || !filePath || filePath.includes('\0') || !path.isAbsolute(filePath)) {
    fail('Installer --file must be an explicit absolute local path.');
  }
  const checkedVersion = validateVersion(version);
  const resolvedPath = path.resolve(filePath);
  const fileName = path.basename(resolvedPath);
  if (path.extname(fileName).toLowerCase() !== '.exe') fail('Installer file must have the .exe extension.');
  if (fileName !== expectedInstallerFileName(checkedVersion)) {
    fail(`Installer file name must be ${expectedInstallerFileName(checkedVersion)}.`);
  }

  const before = await fsp.lstat(resolvedPath);
  if (!before.isFile() || before.isSymbolicLink()) fail('Installer path must identify a regular local file, not a link.');
  parseExpectedBytes(before.size, 'Installer byte count');
  const bytes = await fsp.readFile(resolvedPath);
  const after = await fsp.lstat(resolvedPath);
  if (
    !after.isFile() || after.isSymbolicLink() || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
    bytes.length !== after.size
  ) fail('Installer changed while it was being verified.');
  validatePortableExecutable(bytes);

  const sha256 = sha256Bytes(bytes);
  const size = bytes.length;
  if (expectedSha256 !== null && validateExpectedSha256(expectedSha256) !== sha256) {
    fail('Installer SHA-256 does not match --expected-sha256.');
  }
  if (expectedBytes !== null && parseExpectedBytes(expectedBytes) !== size) {
    fail('Installer byte count does not match --expected-bytes.');
  }

  const key = installerKey(checkedVersion, fileName);
  const artifact = Object.freeze({
    url: publicObjectUrl(publicBaseUrl, key),
    bytes: size,
    sha256,
    fileName
  });
  const record = Object.freeze({
    filePath: resolvedPath,
    fileName,
    version: checkedVersion,
    key,
    size,
    sha256,
    mime: INSTALLER_CONTENT_TYPE,
    reviewed: expectedSha256 !== null && expectedBytes !== null,
    artifact
  });
  return { record, bytes };
}

function validateInstallerRecord(record, bytes) {
  if (!isPlainObject(record) || !Buffer.isBuffer(bytes)) fail('Installer publish record is invalid.');
  validateVersion(record.version);
  const expectedName = expectedInstallerFileName(record.version);
  if (
    record.fileName !== expectedName || record.key !== installerKey(record.version, record.fileName) ||
    record.mime !== INSTALLER_CONTENT_TYPE
  ) fail('Installer publish record identity is invalid.');
  if (parseExpectedBytes(record.size, 'Installer byte count') !== bytes.length) fail('Installer publish bytes have the wrong size.');
  validatePortableExecutable(bytes);
  if (validateExpectedSha256(record.sha256) !== sha256Bytes(bytes)) fail('Installer publish bytes have the wrong SHA-256.');
  return true;
}

function validateRemoteHead(record, response) {
  const metadata = isPlainObject(response?.Metadata) ? response.Metadata : {};
  const remoteSha256 = String(metadata.sha256 || '').toLowerCase();
  const remoteVersion = String(metadata.version || '');
  const problems = [];
  if (Number(response?.ContentLength) !== record.size) problems.push(`size=${String(response?.ContentLength)}`);
  if (remoteSha256 !== record.sha256) problems.push(`metadata.sha256=${remoteSha256 || 'missing'}`);
  if (remoteVersion !== record.version) problems.push(`metadata.version=${remoteVersion || 'missing'}`);
  if (String(response?.ContentType || '').toLowerCase() !== record.mime) problems.push(`content-type=${String(response?.ContentType || 'missing')}`);
  if (String(response?.CacheControl || '') !== IMMUTABLE_CACHE_CONTROL) problems.push(`cache-control=${String(response?.CacheControl || 'missing')}`);
  if (problems.length) {
    fail(`R2 launcher artifact already exists with mismatched metadata; refusing overwrite: ${record.key} (${problems.join(', ')}).`);
  }
  return true;
}

async function headRemoteInstaller(record, liveContext) {
  try {
    const response = await liveContext.client.send(new liveContext.HeadObjectCommand({
      Bucket: liveContext.bucket,
      Key: record.key
    }));
    validateRemoteHead(record, response);
    return response;
  } catch (error) {
    if (assetPublisher.isNotFoundError(error)) return null;
    throw error;
  }
}

async function publishInstaller(record, bytes, liveContext = null) {
  validateInstallerRecord(record, bytes);
  if (!liveContext) return { status: 'verified', bytes: record.size };
  if (record.reviewed !== true) {
    fail('Live mode requires a record verified against both the reviewed SHA-256 and byte count.');
  }
  if (!liveContext.client || !liveContext.bucket || !liveContext.HeadObjectCommand || !liveContext.PutObjectCommand) {
    fail('Live R2 context is incomplete.');
  }

  const existing = await headRemoteInstaller(record, liveContext);
  if (existing) return { status: 'skipped', bytes: record.size };
  try {
    await liveContext.client.send(new liveContext.PutObjectCommand({
      Bucket: liveContext.bucket,
      Key: record.key,
      Body: bytes,
      ContentLength: record.size,
      ContentType: record.mime,
      CacheControl: IMMUTABLE_CACHE_CONTROL,
      Metadata: { sha256: record.sha256, version: record.version },
      IfNoneMatch: '*'
    }));
  } catch (error) {
    if (!assetPublisher.isPreconditionFailedError(error)) throw error;
    const racedObject = await headRemoteInstaller(record, liveContext);
    if (!racedObject) throw error;
    return { status: 'skipped-race', bytes: record.size };
  }
  const uploaded = await headRemoteInstaller(record, liveContext);
  if (!uploaded) fail(`Uploaded R2 launcher artifact cannot be verified: ${record.key}`);
  return { status: 'uploaded', bytes: record.size };
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
    help: false,
    filePath: '',
    version: '',
    expectedSha256: null,
    expectedBytes: null,
    publicBaseUrl: DEFAULT_PUBLIC_BASE_URL
  };
  const assigned = new Set();
  const takeValue = (name, inlineValue, index) => {
    if (assigned.has(name)) fail(`${name} may only be provided once.`);
    assigned.add(name);
    if (inlineValue !== null) return { value: inlineValue, index };
    const next = index + 1;
    if (next >= argv.length || String(argv[next]).startsWith('--')) fail(`${name} requires a value.`);
    return { value: argv[next], index: next };
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--live') options.live = true;
    else if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else {
      const equalIndex = argument.indexOf('=');
      const name = equalIndex === -1 ? argument : argument.slice(0, equalIndex);
      const inlineValue = equalIndex === -1 ? null : argument.slice(equalIndex + 1);
      if (!['--file', '--version', '--expected-sha256', '--expected-bytes', '--public-base-url'].includes(name)) {
        fail(`Unknown argument: ${argument}`);
      }
      const taken = takeValue(name, inlineValue, index);
      index = taken.index;
      if (name === '--file') options.filePath = taken.value;
      else if (name === '--version') options.version = taken.value;
      else if (name === '--expected-sha256') options.expectedSha256 = validateExpectedSha256(taken.value);
      else if (name === '--expected-bytes') options.expectedBytes = parseExpectedBytes(taken.value);
      else if (name === '--public-base-url') options.publicBaseUrl = validatePublicBaseUrl(taken.value);
    }
  }
  if (!options.help) {
    if (!options.filePath) fail('--file is required.');
    if (!options.version) fail('--version is required.');
    validateVersion(options.version);
    validatePublicBaseUrl(options.publicBaseUrl);
    if (options.live && (options.expectedSha256 === null || options.expectedBytes === null)) {
      fail('Live mode requires both --expected-sha256 and --expected-bytes from a reviewed dry run.');
    }
  }
  return options;
}

function usage() {
  return [
    'Usage: node tools/desktop-r2-publisher/publish-launcher-artifact.js --file ABSOLUTE_EXE --version SEMVER [options]',
    '',
    'Default: local-only dry run. It verifies the PE file and prints its artifact metadata.',
    'Live: add --live --expected-sha256 HASH --expected-bytes BYTES.',
    'Options: --public-base-url HTTPS_ORIGIN --json',
    'Live environment: R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.'
  ].join('\n');
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return { ok: true, help: true };
  }
  const inspected = await inspectInstaller({
    filePath: options.filePath,
    version: options.version,
    expectedSha256: options.expectedSha256,
    expectedBytes: options.expectedBytes,
    publicBaseUrl: options.publicBaseUrl
  });
  let liveContext = null;
  if (options.live) liveContext = createAwsLiveContext(assetPublisher.loadLiveConfiguration(env));
  try {
    const publish = await publishInstaller(inspected.record, inspected.bytes, options.live ? liveContext : null);
    const result = {
      ok: true,
      mode: options.live ? 'live' : 'dry-run',
      status: publish.status,
      key: inspected.record.key,
      artifact: inspected.record.artifact
    };
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else {
      process.stdout.write(
        `DESKTOP_R2_LAUNCHER_PUBLISH=PASS mode=${result.mode} status=${result.status} ` +
        `version=${inspected.record.version} bytes=${inspected.record.size} sha256=${inspected.record.sha256}\n`
      );
      process.stdout.write(`ARTIFACT_JSON=${JSON.stringify(result.artifact)}\n`);
    }
    return result;
  } finally {
    if (typeof liveContext?.client?.destroy === 'function') liveContext.client.destroy();
  }
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`DESKTOP_R2_LAUNCHER_PUBLISH=FAIL ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  DEFAULT_PUBLIC_BASE_URL,
  HASH_PATTERN,
  IMMUTABLE_CACHE_CONTROL,
  INSTALLER_CONTENT_TYPE,
  MAX_INSTALLER_BYTES,
  RELEASE_PREFIX,
  SEMVER_PATTERN,
  createAwsLiveContext,
  expectedInstallerFileName,
  headRemoteInstaller,
  inspectInstaller,
  installerKey,
  main,
  parseArguments,
  publicObjectUrl,
  publishInstaller,
  sha256Bytes,
  validateExpectedSha256,
  validatePortableExecutable,
  validatePublicBaseUrl,
  validateRemoteHead,
  validateVersion
};
