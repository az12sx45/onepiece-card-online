'use strict';

const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const path = require('node:path');
const zlib = require('node:zlib');
const publisher = require('./publish');
const launcherPublisher = require('./publish-launcher-artifact');

const MAX_BLOCKMAP_BYTES = 2 * 1024 * 1024;
const MAX_BLOCKMAP_JSON_BYTES = 16 * 1024 * 1024;
const MAX_BLOCKS = 100000;
const BLOCKMAP_MIME = 'application/octet-stream';

function fail(message) { throw new Error(message); }
function sha256(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }

function validateBlockmap(bytes, installerBytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_BLOCKMAP_BYTES) fail('Blockmap size is invalid.');
  let document;
  try {
    const inflated = zlib.gunzipSync(bytes, { maxOutputLength: MAX_BLOCKMAP_JSON_BYTES });
    document = JSON.parse(inflated.toString('utf8'));
  } catch {
    fail('Blockmap is not a bounded gzip JSON document.');
  }
  if (!document || document.version !== '2' || !Array.isArray(document.files) || document.files.length !== 1) {
    fail('Blockmap must contain one electron-builder v2 file.');
  }
  const file = document.files[0];
  if (file?.name !== 'file' || file.offset !== 0 || !Array.isArray(file.sizes) ||
      !Array.isArray(file.checksums) || file.sizes.length !== file.checksums.length ||
      file.sizes.length < 1 || file.sizes.length > MAX_BLOCKS) {
    fail('Blockmap block list is invalid.');
  }
  let total = 0;
  for (let index = 0; index < file.sizes.length; index += 1) {
    const size = file.sizes[index];
    if (!Number.isSafeInteger(size) || size < 1 || size > 64 * 1024 ||
        typeof file.checksums[index] !== 'string' || !/^[A-Za-z0-9+/]{24}$/.test(file.checksums[index]) ||
        Buffer.from(file.checksums[index], 'base64').length !== 18) {
      fail('Blockmap has an invalid block.');
    }
    total += size;
    if (!Number.isSafeInteger(total) || total > installerBytes) fail('Blockmap exceeds the installer size.');
  }
  if (total !== installerBytes) fail('Blockmap byte sum differs from the reviewed installer.');
  return { blocks: file.sizes.length, installerBytes: total };
}

async function inspectBlockmap({ installerPath, blockmapPath, version, expectedInstallerSha256,
  expectedInstallerBytes, expectedBlockmapSha256 = null, expectedBlockmapBytes = null } = {}) {
  const installer = await launcherPublisher.inspectInstaller({
    filePath: installerPath, version, expectedSha256: expectedInstallerSha256,
    expectedBytes: expectedInstallerBytes
  });
  if (typeof blockmapPath !== 'string' || !path.isAbsolute(blockmapPath) || blockmapPath.includes('\0')) {
    fail('Blockmap path must be absolute.');
  }
  const resolved = path.resolve(blockmapPath);
  const name = path.basename(resolved);
  if (name !== `${installer.record.fileName}.blockmap`) fail('Blockmap name must match the reviewed installer.');
  const before = await fsp.lstat(resolved);
  if (!before.isFile() || before.isSymbolicLink() || before.size < 1 || before.size > MAX_BLOCKMAP_BYTES) {
    fail('Blockmap must be a bounded regular file, not a link.');
  }
  const bytes = await fsp.readFile(resolved);
  const after = await fsp.lstat(resolved);
  if (!after.isFile() || after.isSymbolicLink() || before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs || bytes.length !== after.size) fail('Blockmap changed during review.');
  const format = validateBlockmap(bytes, installer.record.size);
  const digest = sha256(bytes);
  if (expectedBlockmapSha256 !== null && launcherPublisher.validateExpectedSha256(expectedBlockmapSha256) !== digest) {
    fail('Blockmap SHA-256 does not match review.');
  }
  if (expectedBlockmapBytes !== null) {
    const checked = Number(expectedBlockmapBytes);
    if (!Number.isSafeInteger(checked) || checked !== bytes.length) fail('Blockmap byte count does not match review.');
  }
  const record = Object.freeze({
    version: installer.record.version,
    key: `${installer.record.key}.blockmap`,
    url: `${installer.record.artifact.url}.blockmap`,
    size: bytes.length,
    sha256: digest,
    installerSha256: installer.record.sha256,
    installerBytes: installer.record.size,
    mime: BLOCKMAP_MIME,
    reviewed: expectedInstallerSha256 !== null && expectedInstallerBytes !== null &&
      expectedBlockmapSha256 !== null && expectedBlockmapBytes !== null,
    blocks: format.blocks
  });
  return { record, bytes };
}

function validateRemoteHead(record, response) {
  const metadata = response?.Metadata || {};
  if (Number(response?.ContentLength) !== record.size ||
      String(metadata.sha256 || '').toLowerCase() !== record.sha256 ||
      String(metadata.version || '') !== record.version ||
      String(metadata['installer-sha256'] || '').toLowerCase() !== record.installerSha256 ||
      String(response?.ContentType || '').toLowerCase() !== record.mime ||
      String(response?.CacheControl || '') !== launcherPublisher.IMMUTABLE_CACHE_CONTROL) {
    fail(`Existing blockmap metadata differs from reviewed object: ${record.key}`);
  }
}

async function head(record, liveContext) {
  try {
    const response = await liveContext.client.send(new liveContext.HeadObjectCommand({
      Bucket: liveContext.bucket, Key: record.key
    }));
    validateRemoteHead(record, response);
    return response;
  } catch (error) {
    if (publisher.isNotFoundError(error)) return null;
    throw error;
  }
}

async function publishBlockmap(record, bytes, liveContext = null) {
  if (sha256(bytes) !== record.sha256 || bytes.length !== record.size) fail('Blockmap bytes changed after review.');
  validateBlockmap(bytes, record.installerBytes);
  if (!liveContext) return { status: 'verified', bytes: record.size };
  if (!record.reviewed) fail('Live upload requires installer and blockmap SHA-256/byte review.');
  if (await head(record, liveContext)) return { status: 'skipped', bytes: record.size };
  try {
    await liveContext.client.send(new liveContext.PutObjectCommand({
      Bucket: liveContext.bucket, Key: record.key, Body: bytes, ContentLength: record.size,
      ContentType: record.mime, CacheControl: launcherPublisher.IMMUTABLE_CACHE_CONTROL,
      Metadata: { sha256: record.sha256, version: record.version, 'installer-sha256': record.installerSha256 },
      IfNoneMatch: '*'
    }));
  } catch (error) {
    if (!publisher.isPreconditionFailedError(error)) throw error;
    if (!await head(record, liveContext)) throw error;
    return { status: 'skipped-race', bytes: record.size };
  }
  if (!await head(record, liveContext)) fail('Uploaded blockmap cannot be read back.');
  return { status: 'uploaded', bytes: record.size };
}

function parseArgs(argv) {
  const options = { live: false, json: false };
  const names = new Map([
    ['--installer', 'installerPath'], ['--blockmap', 'blockmapPath'], ['--version', 'version'],
    ['--installer-sha256', 'expectedInstallerSha256'], ['--installer-bytes', 'expectedInstallerBytes'],
    ['--blockmap-sha256', 'expectedBlockmapSha256'], ['--blockmap-bytes', 'expectedBlockmapBytes']
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--live') options.live = true;
    else if (arg === '--json') options.json = true;
    else if (names.has(arg)) {
      const field = names.get(arg);
      if (options[field] !== undefined || index + 1 >= argv.length) fail(`Missing or repeated ${arg}.`);
      options[field] = argv[++index];
    } else fail(`Unknown argument: ${arg}`);
  }
  for (const field of ['installerPath', 'blockmapPath', 'version']) if (!options[field]) fail(`Missing ${field}.`);
  if (options.live) for (const field of ['expectedInstallerSha256', 'expectedInstallerBytes', 'expectedBlockmapSha256', 'expectedBlockmapBytes']) {
    if (!options[field]) fail(`Live mode needs reviewed ${field}.`);
  }
  return options;
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  const { record, bytes } = await inspectBlockmap(options);
  const liveContext = options.live ? launcherPublisher.createAwsLiveContext(publisher.loadLiveConfiguration(env)) : null;
  try {
    const result = await publishBlockmap(record, bytes, liveContext);
    const output = { ok: true, mode: options.live ? 'live' : 'dry-run', status: result.status,
      key: record.key, url: record.url, bytes: record.size, sha256: record.sha256,
      installerSha256: record.installerSha256, blocks: record.blocks };
    process.stdout.write(options.json ? `${JSON.stringify(output)}\n` :
      `DESKTOP_R2_BLOCKMAP_PUBLISH=PASS mode=${output.mode} status=${output.status} bytes=${record.size} sha256=${record.sha256}\n`);
    return output;
  } finally {
    liveContext?.client?.destroy?.();
  }
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`DESKTOP_R2_BLOCKMAP_PUBLISH=FAIL ${String(error?.message || error)}\n`);
  process.exitCode = 1;
});

module.exports = { inspectBlockmap, main, parseArgs, publishBlockmap, validateBlockmap, validateRemoteHead };
