'use strict';

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');
const content = require('./launcher-content-manifest');
const existingPublisher = require('./publish');
const { TRUSTED_RELEASE_KEYS } = require('../../desktop/launcher-update-service');

const PREFIX = 'desktop/launcher/content/blobs/sha256';
const CACHE_CONTROL = 'public, max-age=31536000, immutable, no-transform';
const MIME = new Map([
  ['.html', 'application/octet-stream'], ['.js', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'], ['.webp', 'image/webp'], ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'],
  ['.mp3', 'audio/mpeg'], ['.ogg', 'audio/ogg'],
  ['.mp4', 'video/mp4'], ['.webm', 'video/webm']
]);

function fail(message) { throw new Error(message); }
function sha256(value) { return crypto.createHash('sha256').update(value).digest('hex'); }
function keyForHash(value) {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) fail('Invalid content SHA-256.');
  return `${PREFIX}/${value}`;
}
function mimeForPath(relative) {
  const mime = MIME.get(path.posix.extname(relative).toLowerCase());
  if (!mime) fail(`Unapproved content MIME: ${relative}`);
  return mime;
}
async function loadVerifiedManifest(filePath, trustKeys = TRUSTED_RELEASE_KEYS) {
  const document = await content.readManifest(filePath);
  content.validate(document, true);
  const publicKey = trustKeys[document.signature.keyId];
  if (!publicKey) fail('Content manifest is not signed by a trusted launcher key.');
  content.verify(document, publicKey);
  return document;
}
async function inspect(repoRoot, signedManifestPath, trustKeys = TRUSTED_RELEASE_KEYS) {
  const document = await loadVerifiedManifest(signedManifestPath, trustKeys);
  const packageJson = JSON.parse(await fsp.readFile(path.join(repoRoot, 'desktop', 'package.json'), 'utf8'));
  if (document.coreVersion !== packageJson.version) fail('Content coreVersion does not match package.json.');
  const sources = await content.collectSources(repoRoot);
  const records = new Map();
  let logicalBytes = 0;
  for (const file of document.files) {
    const source = content.sourceForPath(repoRoot, sources, file.path);
    const bytes = await content.readSource(source.root, source.relative);
    if (bytes.length !== file.bytes || sha256(bytes) !== file.sha256) fail(`Manifest/source mismatch: ${file.path}`);
    logicalBytes += file.bytes;
    const prior = records.get(file.sha256);
    if (prior && (prior.bytes !== file.bytes || prior.mime !== mimeForPath(file.path))) {
      fail(`Identical content hash has conflicting metadata: ${file.path}`);
    }
    if (!prior) records.set(file.sha256, { ...file, source, key: keyForHash(file.sha256), mime: mimeForPath(file.path) });
  }
  const rawManifest = await fsp.readFile(signedManifestPath);
  return { document, records: [...records.values()], manifestSha256: sha256(rawManifest), logicalBytes,
    uniqueBytes: [...records.values()].reduce((sum, record) => sum + record.bytes, 0) };
}
function validateHead(record, response) {
  const errors = [];
  if (Number(response?.ContentLength) !== record.bytes) errors.push('size');
  if (String(response?.Metadata?.sha256 || '').toLowerCase() !== record.sha256) errors.push('sha256 metadata');
  if (String(response?.ContentType || '').toLowerCase() !== record.mime.toLowerCase()) errors.push('content type');
  if (String(response?.CacheControl || '') !== CACHE_CONTROL) errors.push('cache control');
  if (errors.length) fail(`Existing immutable R2 object has mismatched ${errors.join(', ')}: ${record.key}`);
  return true;
}
async function head(record, context) {
  try {
    const response = await context.client.send(new context.HeadObjectCommand({ Bucket: context.bucket, Key: record.key }));
    validateHead(record, response);
    return response;
  } catch (error) {
    if (existingPublisher.isNotFoundError(error)) return null;
    throw error;
  }
}
async function publishOne(record, context = null) {
  const bytes = await content.readSource(record.source.root, record.source.relative);
  if (bytes.length !== record.bytes || sha256(bytes) !== record.sha256) fail(`Source changed before upload: ${record.path}`);
  if (!context) return { status: 'verified', bytes: record.bytes };
  if (await head(record, context)) return { status: 'reused', bytes: record.bytes };
  try {
    await context.client.send(new context.PutObjectCommand({
      Bucket: context.bucket, Key: record.key, Body: bytes, ContentLength: record.bytes,
      ContentType: record.mime, CacheControl: CACHE_CONTROL, Metadata: { sha256: record.sha256 }, IfNoneMatch: '*'
    }));
  } catch (error) {
    if (!existingPublisher.isPreconditionFailedError(error) || !(await head(record, context))) throw error;
    return { status: 'reused-race', bytes: record.bytes };
  }
  if (!(await head(record, context))) fail(`Uploaded object was not visible for verification: ${record.key}`);
  return { status: 'uploaded', bytes: record.bytes };
}
async function publishInventory(inventory, context = null, onProgress = null) {
  const counts = { verified: 0, uploaded: 0, reused: 0, reusedRace: 0, transferBytes: 0 };
  for (let index = 0; index < inventory.records.length; index += 1) {
    const record = inventory.records[index];
    const result = await publishOne(record, context);
    if (result.status === 'verified') counts.verified++;
    else if (result.status === 'uploaded') { counts.uploaded++; counts.transferBytes += record.bytes; }
    else if (result.status === 'reused') counts.reused++;
    else counts.reusedRace++;
    onProgress?.({ index: index + 1, total: inventory.records.length, record, result });
  }
  return { ok: true, mode: context ? 'live' : 'dry-run', coreVersion: inventory.document.coreVersion,
    revision: inventory.document.revision, manifestSha256: inventory.manifestSha256,
    logicalFiles: inventory.document.files.length, logicalBytes: inventory.logicalBytes,
    uniqueBlobs: inventory.records.length, uniqueBytes: inventory.uniqueBytes, ...counts };
}
function parseArguments(argv) {
  const options = { live: false, json: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    if (arg === '--live') options.live = true;
    else if (arg === '--json') options.json = true;
    else if (['--repo-root', '--manifest', '--expected-manifest-sha256'].includes(arg)) {
      if (options[arg]) fail(`Duplicate option ${arg}`);
      options[arg] = argv[++index];
      if (!options[arg] || options[arg].startsWith('--')) fail(`${arg} needs a value.`);
    } else fail(`Unknown option ${arg}`);
  }
  if (!options['--repo-root'] || !options['--manifest']) fail('--repo-root and --manifest are required.');
  if (options.live && !/^[a-f0-9]{64}$/.test(options['--expected-manifest-sha256'] || '')) {
    fail('Live upload requires the reviewed --expected-manifest-sha256 from a dry run.');
  }
  return options;
}
function createLiveContext(config) {
  let sdk;
  try { sdk = require('@aws-sdk/client-s3'); } catch { fail('Live mode requires @aws-sdk/client-s3.'); }
  return { client: new sdk.S3Client(config), bucket: config.bucket,
    HeadObjectCommand: sdk.HeadObjectCommand, PutObjectCommand: sdk.PutObjectCommand };
}
async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArguments(argv);
  const inventory = await inspect(path.resolve(options['--repo-root']), path.resolve(options['--manifest']));
  if (options.live && inventory.manifestSha256 !== options['--expected-manifest-sha256']) fail('Reviewed manifest SHA-256 changed.');
  let context = null;
  if (options.live) context = createLiveContext(existingPublisher.loadLiveConfiguration(env));
  try {
    const report = await publishInventory(inventory, context, options.json ? null : ({ index, total, record, result }) => {
      if (index === total || index % 25 === 0) process.stdout.write(`[${index}/${total}] ${result.status} ${record.key}\n`);
    });
    process.stdout.write(`${options.json ? JSON.stringify(report) : `LAUNCHER_CONTENT_PUBLISH=PASS ${JSON.stringify(report)}`}\n`);
    return report;
  } finally { context?.client?.destroy?.(); }
}
if (require.main === module) main().catch((error) => { process.stderr.write(`LAUNCHER_CONTENT_PUBLISH=FAIL ${error.message}\n`); process.exitCode = 1; });

module.exports = { CACHE_CONTROL, PREFIX, head, inspect, keyForHash, main, mimeForPath, publishInventory, publishOne, validateHead };
