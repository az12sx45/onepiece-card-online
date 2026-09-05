'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const ALGORITHM = 'Ed25519';
const MAX_MANIFEST_BYTES = 64 * 1024;
const MAX_INSTALLER_BYTES = 256 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const KEY_ID_PATTERN = /^launcher-ed25519-[a-f0-9]{32}$/;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const PRIVATE_KEY_ENV = 'LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64';
const KEY_ID_ENV = 'LAUNCHER_SIGNING_KEY_ID';
const PUBLIC_KEY_ENV = 'LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64';
const FORMAL_RELEASE_PATH = path.resolve(__dirname, '..', '..', 'public', 'desktop', 'launcher-release-v1.json');

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertExactKeys(value, expected, label) {
  if (!isPlainObject(value)) fail(`${label} must be a plain object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    fail(`${label} fields must be exactly: ${wanted.join(', ')}.`);
  }
}

function decodeCanonicalBase64(value, label) {
  if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    fail(`${label} is not canonical base64.`);
  }
  const bytes = Buffer.from(value, 'base64');
  if (!bytes.length || bytes.toString('base64') !== value) fail(`${label} is not canonical base64.`);
  return bytes;
}

function validateVersion(value) {
  if (typeof value !== 'string' || value.length > 128 || !SEMVER_PATTERN.test(value)) {
    fail('Manifest version must be a valid semantic version without a leading v.');
  }
  return value;
}

function validatePublishedAt(value) {
  if (typeof value !== 'string' || !value || value.length > 64) fail('Manifest publishedAt is invalid.');
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== value) {
    fail('Manifest publishedAt must be a canonical UTC ISO-8601 timestamp.');
  }
  return value;
}

function validateArtifact(artifact, version) {
  assertExactKeys(artifact, ['fileName', 'bytes', 'sha256', 'url'], 'Manifest artifact');
  const expectedFileName = `ONE-PIECE-Tabletop-Launcher-${version}-x64.exe`;
  if (artifact.fileName !== expectedFileName || path.basename(artifact.fileName) !== artifact.fileName) {
    fail(`Manifest artifact.fileName must be ${expectedFileName}.`);
  }
  if (!Number.isSafeInteger(artifact.bytes) || artifact.bytes < 1 || artifact.bytes > MAX_INSTALLER_BYTES) {
    fail(`Manifest artifact.bytes must be an integer from 1 through ${MAX_INSTALLER_BYTES}.`);
  }
  if (typeof artifact.sha256 !== 'string' || !HASH_PATTERN.test(artifact.sha256)) {
    fail('Manifest artifact.sha256 must be 64 lower-case hexadecimal characters.');
  }
  if (typeof artifact.url !== 'string' || !artifact.url || artifact.url.length > 2048) {
    fail('Manifest artifact.url is invalid.');
  }
  let parsedUrl;
  try {
    parsedUrl = new URL(artifact.url);
  } catch {
    fail('Manifest artifact.url is not a valid absolute URL.');
  }
  if (
    parsedUrl.protocol !== 'https:' || parsedUrl.username || parsedUrl.password || parsedUrl.search ||
    parsedUrl.hash || decodeURIComponent(path.posix.basename(parsedUrl.pathname)) !== artifact.fileName
  ) fail('Manifest artifact.url must be a clean HTTPS URL ending in artifact.fileName.');
  return artifact;
}

function validateSignature(signature) {
  assertExactKeys(signature, ['algorithm', 'keyId', 'value'], 'Manifest signature');
  if (signature.algorithm !== ALGORITHM) fail(`Manifest signature.algorithm must be ${ALGORITHM}.`);
  if (typeof signature.keyId !== 'string' || !KEY_ID_PATTERN.test(signature.keyId)) {
    fail('Manifest signature.keyId is invalid.');
  }
  const bytes = decodeCanonicalBase64(signature.value, 'Manifest signature.value');
  if (bytes.length !== 64) fail('Manifest Ed25519 signature must contain exactly 64 bytes.');
  return signature;
}

function validateReleaseDocument(document, { signed = false } = {}) {
  const expected = ['schema', 'channel', 'platform', 'arch', 'version', 'publishedAt', 'artifact'];
  if (signed) expected.push('signature');
  assertExactKeys(document, expected, signed ? 'Signed launcher manifest' : 'Unsigned launcher manifest');
  if (document.schema !== 1 || document.channel !== 'stable') fail('Manifest schema/channel is invalid.');
  if (document.platform !== 'win32' || document.arch !== 'x64') fail('Manifest platform/arch must be win32/x64.');
  validateVersion(document.version);
  validatePublishedAt(document.publishedAt);
  validateArtifact(document.artifact, document.version);
  if (signed) validateSignature(document.signature);
  return document;
}

function canonicalPayloadObject(document) {
  const signed = Object.prototype.hasOwnProperty.call(document || {}, 'signature');
  validateReleaseDocument(document, { signed });
  return {
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
  };
}

function canonicalPayloadBytes(document) {
  return Buffer.from(JSON.stringify(canonicalPayloadObject(document)), 'utf8');
}

function importPublicKey(publicKeySpkiBase64) {
  const der = decodeCanonicalBase64(publicKeySpkiBase64, 'Ed25519 public SPKI key');
  let key;
  try {
    key = crypto.createPublicKey({ key: der, format: 'der', type: 'spki' });
  } catch (error) {
    fail(`Cannot import Ed25519 public key: ${error.message}`);
  }
  if (key.asymmetricKeyType !== 'ed25519') fail('Public key is not Ed25519.');
  return key;
}

function importPrivateKey(privateKeyPkcs8Base64) {
  const der = decodeCanonicalBase64(privateKeyPkcs8Base64, 'Ed25519 private PKCS8 key');
  let key;
  try {
    key = crypto.createPrivateKey({ key: der, format: 'der', type: 'pkcs8' });
  } catch (error) {
    fail(`Cannot import Ed25519 private key: ${error.message}`);
  }
  if (key.asymmetricKeyType !== 'ed25519') fail('Private key is not Ed25519.');
  return key;
}

function publicKeySpkiBase64(publicKey) {
  return publicKey.export({ format: 'der', type: 'spki' }).toString('base64');
}

function computeKeyId(publicKeyOrSpkiBase64) {
  const key = typeof publicKeyOrSpkiBase64 === 'string'
    ? importPublicKey(publicKeyOrSpkiBase64)
    : publicKeyOrSpkiBase64;
  if (!key || key.asymmetricKeyType !== 'ed25519') fail('Cannot compute keyId from a non-Ed25519 public key.');
  const der = key.export({ format: 'der', type: 'spki' });
  const fingerprint = crypto.createHash('sha256').update(der).digest('hex');
  return `launcher-ed25519-${fingerprint.slice(0, 32)}`;
}

function signReleaseDocument(document, { privateKeyPkcs8Base64, publicKeySpki, keyId }) {
  validateReleaseDocument(document, { signed: false });
  const privateKey = importPrivateKey(privateKeyPkcs8Base64);
  const derivedPublicKey = crypto.createPublicKey(privateKey);
  const derivedPublicBase64 = publicKeySpkiBase64(derivedPublicKey);
  const suppliedPublicKey = importPublicKey(publicKeySpki);
  const suppliedPublicBase64 = publicKeySpkiBase64(suppliedPublicKey);
  if (derivedPublicBase64 !== suppliedPublicBase64) fail('DPAPI private key does not match the stored public key.');
  const derivedKeyId = computeKeyId(derivedPublicKey);
  if (keyId !== derivedKeyId) fail('DPAPI signing keyId does not match its public key fingerprint.');
  const value = crypto.sign(null, canonicalPayloadBytes(document), privateKey).toString('base64');
  return {
    ...canonicalPayloadObject(document),
    signature: { algorithm: ALGORITHM, keyId, value }
  };
}

function verifyReleaseDocument(document, { publicKeySpki, expectedKeyId = null }) {
  validateReleaseDocument(document, { signed: true });
  const publicKey = importPublicKey(publicKeySpki);
  const computedKeyId = computeKeyId(publicKey);
  if (expectedKeyId !== null && expectedKeyId !== computedKeyId) {
    fail('Expected keyId does not match the supplied public key fingerprint.');
  }
  if (document.signature.keyId !== computedKeyId) fail('Manifest signature keyId is not trusted by the supplied public key.');
  const signature = decodeCanonicalBase64(document.signature.value, 'Manifest signature.value');
  if (!crypto.verify(null, canonicalPayloadBytes(document), publicKey, signature)) {
    fail('Manifest Ed25519 signature verification failed.');
  }
  return { ok: true, keyId: computedKeyId, version: document.version };
}

async function readManifest(filePath) {
  const resolved = path.resolve(filePath);
  const info = await fsp.lstat(resolved);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 2 || info.size > MAX_MANIFEST_BYTES) {
    fail('Manifest input must be a regular, non-link JSON file no larger than 64 KiB.');
  }
  const bytes = await fsp.readFile(resolved);
  try {
    return { path: resolved, document: JSON.parse(bytes.toString('utf8')) };
  } catch (error) {
    fail(`Manifest input is not valid JSON: ${error.message}`);
  }
}

async function writeCandidate(outputPath, inputPath, document) {
  const resolvedOutput = path.resolve(outputPath);
  const resolvedInput = path.resolve(inputPath);
  if (resolvedOutput === resolvedInput) fail('Signed output must not overwrite its input manifest.');
  if (resolvedOutput === FORMAL_RELEASE_PATH) {
    fail('The signing tool refuses to overwrite the formal launcher-release-v1.json; review and promote a candidate separately.');
  }
  await fsp.mkdir(path.dirname(resolvedOutput), { recursive: true });
  const realParent = await fsp.realpath(path.dirname(resolvedOutput));
  const realOutput = path.join(realParent, path.basename(resolvedOutput));
  if (path.resolve(realOutput) === FORMAL_RELEASE_PATH) fail('Candidate output resolves to the formal launcher manifest.');
  try {
    await fsp.lstat(realOutput);
    fail(`Candidate output already exists; refusing overwrite: ${realOutput}`);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const body = `${JSON.stringify(document, null, 2)}\n`;
  const temporary = path.join(realParent, `.${path.basename(realOutput)}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`);
  try {
    await fsp.writeFile(temporary, body, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await fsp.copyFile(temporary, realOutput, fs.constants.COPYFILE_EXCL);
  } finally {
    await fsp.rm(temporary, { force: true });
  }
  return realOutput;
}

function parseArguments(argv) {
  const command = argv[0] || '';
  const options = { command, input: '', output: '', publicKeySpki: '', keyId: '', json: false, help: false };
  const assigned = new Set();
  for (let index = 1; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--json') options.json = true;
    else if (argument === '--help' || argument === '-h') options.help = true;
    else {
      const equalIndex = argument.indexOf('=');
      const name = equalIndex === -1 ? argument : argument.slice(0, equalIndex);
      if (!['--input', '--output', '--public-key-spki-base64', '--key-id'].includes(name)) fail(`Unknown argument: ${argument}`);
      if (assigned.has(name)) fail(`${name} may only be provided once.`);
      assigned.add(name);
      const value = equalIndex === -1 ? argv[++index] : argument.slice(equalIndex + 1);
      if (typeof value !== 'string' || !value || value.startsWith('--')) fail(`${name} requires a value.`);
      if (name === '--input') options.input = value;
      else if (name === '--output') options.output = value;
      else if (name === '--public-key-spki-base64') options.publicKeySpki = value;
      else if (name === '--key-id') options.keyId = value;
    }
  }
  if (options.help) return options;
  if (!['sign', 'verify', 'canonical'].includes(command)) fail('Command must be sign, verify, or canonical.');
  if (!options.input) fail('--input is required.');
  if (command === 'sign' && !options.output) fail('sign requires --output.');
  if (command === 'verify' && !options.publicKeySpki) fail('verify requires --public-key-spki-base64.');
  return options;
}

function usage() {
  return [
    'Usage:',
    '  node launcher-manifest-signature.js canonical --input MANIFEST',
    '  node launcher-manifest-signature.js sign --input UNSIGNED_JSON --output CANDIDATE_JSON [--json]',
    '  node launcher-manifest-signature.js verify --input SIGNED_JSON --public-key-spki-base64 BASE64 [--key-id ID] [--json]',
    '',
    `sign reads ${PRIVATE_KEY_ENV}, ${KEY_ID_ENV}, and ${PUBLIC_KEY_ENV} from the DPAPI wrapper.`,
    'It never overwrites the input or public/desktop/launcher-release-v1.json.'
  ].join('\n');
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write(`${usage()}\n`);
    return { ok: true, help: true };
  }
  const loaded = await readManifest(options.input);
  if (options.command === 'canonical') {
    const bytes = canonicalPayloadBytes(loaded.document);
    process.stdout.write(bytes);
    process.stdout.write('\n');
    return { ok: true, bytes };
  }
  if (options.command === 'sign') {
    const privateKeyPkcs8Base64 = String(env[PRIVATE_KEY_ENV] || '').trim();
    const publicKeySpki = String(env[PUBLIC_KEY_ENV] || '').trim();
    const keyId = String(env[KEY_ID_ENV] || '').trim();
    if (!privateKeyPkcs8Base64 || !publicKeySpki || !keyId) fail('Signing requires the DPAPI key wrapper environment.');
    const signed = signReleaseDocument(loaded.document, { privateKeyPkcs8Base64, publicKeySpki, keyId });
    const output = await writeCandidate(options.output, loaded.path, signed);
    const result = { ok: true, mode: 'signed-candidate', output, version: signed.version, keyId };
    if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
    else process.stdout.write(`LAUNCHER_MANIFEST_SIGN=PASS version=${signed.version} keyId=${keyId} output=${output}\n`);
    return result;
  }
  const result = verifyReleaseDocument(loaded.document, {
    publicKeySpki: options.publicKeySpki,
    expectedKeyId: options.keyId || null
  });
  if (options.json) process.stdout.write(`${JSON.stringify(result)}\n`);
  else process.stdout.write(`LAUNCHER_MANIFEST_VERIFY=PASS version=${result.version} keyId=${result.keyId}\n`);
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`LAUNCHER_MANIFEST_SIGNATURE=FAIL ${String(error?.message || error)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  ALGORITHM,
  FORMAL_RELEASE_PATH,
  HASH_PATTERN,
  KEY_ID_ENV,
  KEY_ID_PATTERN,
  MAX_INSTALLER_BYTES,
  PRIVATE_KEY_ENV,
  PUBLIC_KEY_ENV,
  canonicalPayloadBytes,
  canonicalPayloadObject,
  computeKeyId,
  importPrivateKey,
  importPublicKey,
  main,
  publicKeySpkiBase64,
  signReleaseDocument,
  validateReleaseDocument,
  verifyReleaseDocument,
  writeCandidate
};
