'use strict';

// Signed, complete inventory for mutable launcher UI and its packaged media.
// The Electron main process, preload, native modules, and game packages are
// deliberately outside this content channel.
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const signing = require('./launcher-manifest-signature');

const BASE_URL = 'https://game-assets.rihdi.tw/desktop/launcher/content/blobs/sha256/';
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024;
const MAX_FILES = 5000;
const MAX_FILE_BYTES = 64 * 1024 * 1024;
const MAX_TOTAL_BYTES = 256 * 1024 * 1024;
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const VERSION_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const MEDIA_ROOTS = new Set(['images', 'audio', 'videos']);
const WINDOWS_RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i;
const RENDERER_FILES = new Set([
  'launcher.html', 'launcher.css', 'launcher.js', 'launcher-social.css', 'launcher-social.js',
  'launcher-profile-shop.css', 'launcher-profile-shop.js', 'launcher-room.css', 'launcher-room.js',
  'launcher-room-ambience.css', 'launcher-room-ambience.js', 'launcher-room-aquarium.css',
  'launcher-room-aquarium.js', 'launcher-room-minigames.css', 'launcher-room-minigames.js',
  'launcher-announcements.css', 'launcher-announcements.js', 'launcher-updates-ui.js',
  'launcher-account-ui.js', 'launcher-reserved-crew.js', 'launcher-life-data.js',
  'launcher-life-actions.js', 'launcher-life.js', 'launcher-life-room.js',
  'launcher-room-dialogue.js', 'launcher-room-motion-data.js', 'launcher-room-motion.js'
]);
const MEDIA_EXTENSIONS = Object.freeze({
  images: new Set(['.webp', '.png', '.jpg', '.jpeg']),
  audio: new Set(['.mp3', '.ogg']),
  videos: new Set(['.mp4', '.webm'])
});

function fail(message) { throw new Error(message); }
function exactKeys(value, expected, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      JSON.stringify(Object.keys(value).sort()) !== JSON.stringify([...expected].sort())) {
    fail(`${label} must contain exactly ${expected.join(', ')}.`);
  }
}
function checkedPath(value) {
  if (typeof value !== 'string' || !value || value.length > 240 || value !== value.normalize('NFC') ||
      value.includes('\\') || value.includes('\0') || value.includes(':') || value.startsWith('/') ||
      path.posix.normalize(value) !== value || value.includes('..') || value.includes('//') ||
      !/^[a-z0-9][a-z0-9._/-]*$/.test(value)) fail(`Unsafe content path: ${String(value)}`);
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || /[. ]$/.test(part) || WINDOWS_RESERVED.test(part))) {
    fail(`Unsafe content path: ${value}`);
  }
  if (parts.length === 1) {
    if (!RENDERER_FILES.has(value)) fail(`Content cannot replace core code: ${value}`);
  } else {
    if (!MEDIA_ROOTS.has(parts[0])) fail(`Content is outside media roots: ${value}`);
    if (!MEDIA_EXTENSIONS[parts[0]].has(path.posix.extname(value).toLowerCase())) fail(`Content media extension is not approved: ${value}`);
  }
  return value;
}
function checkedPublishedAt(value) {
  if (typeof value !== 'string' || value.length > 64 || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value) fail('publishedAt must be canonical UTC ISO-8601.');
  return value;
}
function validate(document, signed = false) {
  const fields = ['schema', 'channel', 'platform', 'arch', 'coreVersion', 'revision', 'publishedAt', 'baseUrl', 'files'];
  if (signed) fields.push('signature');
  exactKeys(document, fields, 'Launcher content manifest');
  if (document.schema !== 1 || document.channel !== 'stable' || document.platform !== 'win32' || document.arch !== 'x64') {
    fail('Launcher content identity is invalid.');
  }
  if (typeof document.coreVersion !== 'string' || !VERSION_PATTERN.test(document.coreVersion)) fail('coreVersion is invalid.');
  if (!Number.isSafeInteger(document.revision) || document.revision < 1) fail('revision must be a positive integer.');
  checkedPublishedAt(document.publishedAt);
  if (document.baseUrl !== BASE_URL) fail('Content baseUrl is not the approved immutable blob origin.');
  if (!Array.isArray(document.files) || !document.files.length || document.files.length > MAX_FILES) fail('files count is invalid.');
  let previous = '';
  const folded = new Set();
  let total = 0;
  for (const file of document.files) {
    exactKeys(file, ['path', 'bytes', 'sha256'], 'Content file');
    checkedPath(file.path);
    if (previous && !(previous < file.path)) fail('Content paths must be strictly sorted.');
    previous = file.path;
    const insensitive = file.path.toLowerCase();
    if (folded.has(insensitive)) fail(`Case-colliding content path: ${file.path}`);
    folded.add(insensitive);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 1 || file.bytes > MAX_FILE_BYTES) fail(`Invalid size for ${file.path}`);
    total += file.bytes;
    if (total > MAX_TOTAL_BYTES) fail('Content inventory exceeds 256 MiB.');
    if (typeof file.sha256 !== 'string' || !HASH_PATTERN.test(file.sha256)) fail(`Invalid SHA-256 for ${file.path}`);
  }
  if (signed) {
    exactKeys(document.signature, ['algorithm', 'keyId', 'value'], 'Content signature');
    if (document.signature.algorithm !== 'Ed25519' || !signing.KEY_ID_PATTERN.test(document.signature.keyId)) fail('Invalid signature identity.');
    const value = document.signature.value;
    if (typeof value !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(value) ||
        Buffer.from(value, 'base64').toString('base64') !== value) fail('Invalid Ed25519 signature bytes.');
  }
  return document;
}
function canonicalPayload(document) {
  validate(document, Object.hasOwn(document, 'signature'));
  return Buffer.from(JSON.stringify({
    schema: document.schema, channel: document.channel, platform: document.platform, arch: document.arch,
    coreVersion: document.coreVersion, revision: document.revision, publishedAt: document.publishedAt,
    baseUrl: document.baseUrl,
    files: document.files.map((file) => ({ path: file.path, bytes: file.bytes, sha256: file.sha256 }))
  }), 'utf8');
}
function sign(document, { privateKeyPkcs8Base64, publicKeySpki, keyId }) {
  validate(document, false);
  const privateKey = signing.importPrivateKey(privateKeyPkcs8Base64);
  const actualPublic = signing.publicKeySpkiBase64(crypto.createPublicKey(privateKey));
  if (actualPublic !== publicKeySpki || signing.computeKeyId(publicKeySpki) !== keyId) fail('Signing key identity mismatch.');
  const value = crypto.sign(null, canonicalPayload(document), privateKey).toString('base64');
  return { ...document, signature: { algorithm: 'Ed25519', keyId, value } };
}
function verify(document, publicKeySpki) {
  validate(document, true);
  const key = signing.importPublicKey(publicKeySpki);
  if (signing.computeKeyId(key) !== document.signature.keyId ||
      !crypto.verify(null, canonicalPayload(document), key, Buffer.from(document.signature.value, 'base64'))) {
    fail('Launcher content manifest signature verification failed.');
  }
  return true;
}
function inside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}
async function readSource(root, relative) {
  const absolute = path.resolve(root, ...relative.split('/'));
  if (!inside(path.resolve(root), absolute)) fail(`Source escapes root: ${relative}`);
  const rootReal = await fsp.realpath(root);
  const real = await fsp.realpath(absolute);
  if (!inside(rootReal, real)) fail(`Linked source escapes root: ${relative}`);
  const before = await fsp.lstat(absolute);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > MAX_FILE_BYTES) fail(`Source is not a safe regular file: ${relative}`);
  const bytes = await fsp.readFile(absolute);
  const after = await fsp.lstat(absolute);
  if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) fail(`Source changed during scan: ${relative}`);
  return bytes;
}
async function collectSources(repoRoot) {
  const desktopRoot = path.join(repoRoot, 'desktop');
  const packageDocument = JSON.parse(await fsp.readFile(path.join(desktopRoot, 'package.json'), 'utf8'));
  const listed = new Set(packageDocument?.build?.files || []);
  const html = (await readSource(desktopRoot, 'launcher.html')).toString('utf8');
  const renderer = new Set(['launcher.html']);
  for (const match of html.matchAll(/(?:src|href)="(launcher(?:-[a-z0-9-]+)?\.(?:js|css))"/g)) renderer.add(match[1]);
  const records = new Map();
  for (const relative of renderer) {
    if (!listed.has(relative)) fail(`Renderer dependency is not packaged: ${relative}`);
    checkedPath(relative);
    records.set(relative, { root: desktopRoot, relative });
  }
  for (const resource of packageDocument?.build?.extraResources || []) {
    if (!resource.to?.startsWith('launcher-assets/') || !Array.isArray(resource.filter)) continue;
    const prefix = resource.to.slice('launcher-assets/'.length).replaceAll('\\', '/');
    const sourceRoot = path.resolve(desktopRoot, resource.from);
    for (const filter of resource.filter) {
      if (typeof filter !== 'string' || filter.includes('..') || filter.includes('\\')) fail('Unsafe extraResources filter.');
      let names = [filter];
      if (filter === '*.webp') {
        names = (await fsp.readdir(sourceRoot, { withFileTypes: true }))
          .filter((entry) => entry.isFile() && entry.name.endsWith('.webp')).map((entry) => entry.name);
      } else if (filter.includes('*')) fail(`Unsupported extraResources pattern: ${filter}`);
      for (const relative of names) {
        const name = `${prefix}/${relative}`;
        checkedPath(name);
        if (records.has(name)) fail(`Duplicate packaged content path: ${name}`);
        records.set(name, { root: sourceRoot, relative });
      }
    }
  }
  return records;
}
function sourceForPath(repoRoot, packagedSources, relative) {
  checkedPath(relative);
  const packaged = packagedSources.get(relative);
  if (packaged) return packaged;
  // New public media can be delivered by the signed content channel before
  // it exists in an installer. Renderer code and Electron core stay packaged.
  if (relative.includes('/') && MEDIA_ROOTS.has(relative.split('/')[0])) {
    return { root: path.join(path.resolve(repoRoot), 'public'), relative };
  }
  fail(`Content path is not an approved renderer or public media file: ${relative}`);
}
async function build(repoRoot, coreVersion, revision, publishedAt = new Date().toISOString(), includePaths = []) {
  const sources = await collectSources(path.resolve(repoRoot));
  if (!Array.isArray(includePaths) || !includePaths.length) fail('Content build requires explicit --include paths.');
  const selected = new Set();
  for (const name of includePaths) {
    sourceForPath(repoRoot, sources, name);
    selected.add(name);
  }
  const files = [];
  for (const name of [...selected].sort()) {
    const source = sourceForPath(repoRoot, sources, name);
    const bytes = await readSource(source.root, source.relative);
    files.push({ path: name, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') });
  }
  const document = { schema: 1, channel: 'stable', platform: 'win32', arch: 'x64', coreVersion,
    revision, publishedAt, baseUrl: BASE_URL, files };
  validate(document, false);
  if (Buffer.byteLength(JSON.stringify(document)) > MAX_MANIFEST_BYTES) fail('Content manifest exceeds 2 MiB.');
  return document;
}
async function readManifest(filePath) {
  const stat = await fsp.lstat(filePath);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size < 2 || stat.size > MAX_MANIFEST_BYTES) fail('Manifest must be a regular JSON file up to 2 MiB.');
  return JSON.parse(await fsp.readFile(filePath, 'utf8'));
}
function carryPaths(previous, coreVersion, revision, trustKeys) {
  const publicKey = trustKeys?.[previous?.signature?.keyId];
  if (!publicKey) fail('Previous overlay manifest has an untrusted signature.');
  verify(previous, publicKey);
  if (previous.coreVersion !== coreVersion || revision <= previous.revision) {
    fail('Carried overlay must match coreVersion and have an older revision.');
  }
  return previous.files.map((file) => file.path);
}
async function writeExclusive(filePath, document) {
  const absolute = path.resolve(filePath);
  const formal = path.resolve(__dirname, '..', '..', 'public', 'desktop', 'launcher-content-v1.json');
  if (absolute === formal) fail('Signing refuses direct formal manifest overwrite.');
  await fsp.mkdir(path.dirname(absolute), { recursive: true });
  const realOutput = path.join(await fsp.realpath(path.dirname(absolute)), path.basename(absolute));
  if (realOutput === formal) fail('Signing refuses direct formal manifest overwrite.');
  await fsp.writeFile(realOutput, `${JSON.stringify(document, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  return realOutput;
}
function parseArguments(argv) {
  const command = argv[0];
  if (!['build', 'sign', 'verify'].includes(command)) fail('Command must be build, sign, or verify.');
  const options = { '--include': [] };
  for (let i = 1; i < argv.length; i += 1) {
    const key = argv[i];
    if (!['--repo-root', '--core-version', '--revision', '--published-at', '--input', '--output', '--public-key-spki-base64', '--include', '--carry-from'].includes(key)) fail(`Unknown option ${key}`);
    if (key !== '--include' && Object.hasOwn(options, key)) fail(`Duplicate option ${key}`);
    const value = argv[++i];
    if (!value || value.startsWith('--')) fail(`${key} needs a value.`);
    if (key === '--include') options[key].push(value);
    else options[key] = value;
  }
  return { command, options };
}
async function main(argv = process.argv.slice(2), env = process.env) {
  const { command, options } = parseArguments(argv);
  if (command === 'build') {
    if (!options['--repo-root'] || !options['--core-version'] || !options['--revision'] || !options['--output']) fail('build requires repo root, core version, revision, output.');
    const revision = Number(options['--revision']);
    const include = [...options['--include']];
    if (options['--carry-from']) {
      const previous = await readManifest(options['--carry-from']);
      const { TRUSTED_RELEASE_KEYS } = require('../../desktop/launcher-update-service');
      include.push(...carryPaths(previous, options['--core-version'], revision, TRUSTED_RELEASE_KEYS));
    }
    const document = await build(options['--repo-root'], options['--core-version'], revision, options['--published-at'], include);
    const output = await writeExclusive(options['--output'], document);
    const result = { ok: true, output, files: document.files.length, bytes: document.files.reduce((sum, file) => sum + file.bytes, 0) };
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result;
  }
  if (!options['--input']) fail(`${command} requires --input.`);
  const document = await readManifest(options['--input']);
  if (command === 'sign') {
    if (!options['--output']) fail('sign requires --output.');
    const signed = sign(document, {
      privateKeyPkcs8Base64: env.LAUNCHER_SIGNING_PRIVATE_KEY_PKCS8_BASE64,
      publicKeySpki: env.LAUNCHER_SIGNING_PUBLIC_KEY_SPKI_BASE64,
      keyId: env.LAUNCHER_SIGNING_KEY_ID
    });
    const output = await writeExclusive(options['--output'], signed);
    process.stdout.write(`${JSON.stringify({ ok: true, output, keyId: signed.signature.keyId })}\n`);
    return signed;
  }
  if (!options['--public-key-spki-base64']) fail('verify requires --public-key-spki-base64.');
  verify(document, options['--public-key-spki-base64']);
  process.stdout.write(`${JSON.stringify({ ok: true, coreVersion: document.coreVersion, revision: document.revision })}\n`);
  return document;
}
if (require.main === module) main().catch((error) => { process.stderr.write(`LAUNCHER_CONTENT_MANIFEST=FAIL ${error.message}\n`); process.exitCode = 1; });

module.exports = { BASE_URL, MAX_MANIFEST_BYTES, build, canonicalPayload, carryPaths, checkedPath, collectSources, main,
  readManifest, readSource, sign, sourceForPath, validate, verify, writeExclusive };
