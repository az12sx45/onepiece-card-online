'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { LauncherUpdateService, canonicalReleasePayload } = require('../desktop/launcher-update-service');
const { parseBlockmap, sidecarUrls } = require('../desktop/launcher-blockmap-delta');

const ORIGIN = 'https://onepiece-card-online.onrender.com';
const ARTIFACT_ORIGIN = 'https://game-assets.rihdi.tw';
const OLD_VERSION = '1.2.22';
const NEW_VERSION = '1.2.23';
const OLD_NAME = `ONE-PIECE-Tabletop-Launcher-${OLD_VERSION}-x64.exe`;
const NEW_NAME = `ONE-PIECE-Tabletop-Launcher-${NEW_VERSION}-x64.exe`;
const NEW_URL = `${ARTIFACT_ORIGIN}/desktop/launcher/releases/${NEW_VERSION}/${NEW_NAME}`;
const MANIFEST_URL = `${ORIGIN}/desktop/launcher-release-v1.json`;
const BLOCK_SIZE = 32768;
const keyPair = crypto.generateKeyPairSync('ed25519');
const publicKey = keyPair.publicKey.export({ format: 'der', type: 'spki' });
const keyId = `launcher-ed25519-${crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 32)}`;
let checks = 0;

function hash(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makeExe() {
  const bytes = Buffer.alloc(BLOCK_SIZE * 5);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (index * 37 + Math.floor(index / BLOCK_SIZE) * 11) & 255;
  bytes.write('MZ', 0);
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write('PE\0\0', 0x80, 'binary');
  return bytes;
}

function blockmap(bytes) {
  const sizes = [];
  const checksums = [];
  for (let offset = 0; offset < bytes.length; offset += BLOCK_SIZE) {
    const part = bytes.subarray(offset, Math.min(offset + BLOCK_SIZE, bytes.length));
    sizes.push(part.length);
    checksums.push(crypto.createHash('sha256').update(part).digest().subarray(0, 18).toString('base64'));
  }
  return zlib.gzipSync(Buffer.from(JSON.stringify({ version: '2', files: [{ name: 'file', offset: 0, sizes, checksums }] })));
}

function response(bytes, status, url, extraHeaders = {}) {
  const headers = new Map(Object.entries({ 'content-length': bytes.length, ...extraHeaders }).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    status, ok: status >= 200 && status < 300, url,
    headers: { get: (name) => headers.get(String(name).toLowerCase()) || null },
    body: { async *[Symbol.asyncIterator]() { yield bytes; } }
  };
}

function manifest(newBytes) {
  const document = {
    schema: 1, channel: 'stable', platform: 'win32', arch: 'x64', version: NEW_VERSION,
    publishedAt: '2026-10-03T00:00:00.000Z',
    artifact: { fileName: NEW_NAME, bytes: newBytes.length, sha256: hash(newBytes), url: NEW_URL }
  };
  document.signature = {
    algorithm: 'Ed25519', keyId,
    value: crypto.sign(null, canonicalReleasePayload(document), keyPair.privateKey).toString('base64')
  };
  return document;
}

async function caseRun(root, behavior) {
  const oldBytes = makeExe();
  const newBytes = Buffer.from(oldBytes);
  newBytes.fill(0x7a, BLOCK_SIZE * 2, BLOCK_SIZE * 3);
  const oldMap = blockmap(oldBytes);
  const newMap = blockmap(newBytes);
  const document = manifest(newBytes);
  const urls = sidecarUrls(new URL(NEW_URL), OLD_VERSION);
  const folder = path.join(root, behavior.name);
  await fsp.mkdir(folder, { recursive: true });
  if (!behavior.noCache) {
    const oldFolder = path.join(folder, `${OLD_VERSION}-${hash(oldBytes).slice(0, 16)}`);
    await fsp.mkdir(oldFolder, { recursive: true });
    const cached = Buffer.from(oldBytes);
    if (behavior.tamperCache) cached[BLOCK_SIZE * 3 + 8] ^= 0xff;
    await fsp.writeFile(path.join(oldFolder, OLD_NAME), cached);
  }
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, range: options?.headers?.Range || '' });
    if (url === MANIFEST_URL) return response(Buffer.from(JSON.stringify(document)), 200, url, { 'content-type': 'application/json' });
    if (url === urls.old.href) return response(oldMap, 200, behavior.badRedirect ? `${url}?redirected=1` : url);
    if (url === urls.next.href) return response(behavior.badBlockmap ? Buffer.from('bad') : newMap, 200, url);
    if (url === NEW_URL && options?.headers?.Range) {
      const match = /^bytes=(\d+)-(\d+)$/.exec(options.headers.Range);
      assert.ok(match);
      const start = Number(match[1]);
      const end = Number(match[2]);
      const slice = newBytes.subarray(start, end + 1);
      return response(slice, behavior.badRange ? 200 : 206, url,
        { 'content-range': `bytes ${start}-${end}/${newBytes.length}` });
    }
    if (url === NEW_URL) return response(newBytes, 200, url);
    throw new Error(`Unexpected request: ${url}`);
  };
  const service = new LauncherUpdateService({
    origin: ORIGIN, manifestUrl: MANIFEST_URL, currentVersion: OLD_VERSION,
    platform: 'win32', arch: 'x64', downloadRoot: folder, fetchImpl,
    allowedArtifactOrigins: [ARTIFACT_ORIGIN], trustedReleaseKeys: { [keyId]: publicKey.toString('base64') },
    quitImpl: () => {}, spawnImpl: () => { throw new Error('installer must not run during download test'); }
  });
  assert.equal((await service.checkForUpdates()).status, 'available');
  checks += 1;
  const ready = await service.downloadUpdate();
  assert.equal(ready.status, 'ready');
  checks += 1;
  const target = path.join(folder, `${NEW_VERSION}-${hash(newBytes).slice(0, 16)}`, NEW_NAME);
  assert.deepEqual(await fsp.readFile(target), newBytes);
  checks += 1;
  const expectedDelta = !behavior.noCache && !behavior.tamperCache && !behavior.badBlockmap && !behavior.badRange && !behavior.badRedirect;
  assert.equal(ready.downloadMethod, expectedDelta ? 'delta' : 'full');
  assert.equal(calls.filter((call) => call.url === NEW_URL && !call.range).length, expectedDelta ? 0 : 1);
  checks += 2;
  if (expectedDelta) {
    assert.equal(ready.downloadedBytes, BLOCK_SIZE);
    assert.equal(calls.filter((call) => call.range).length, 1);
    checks += 2;
  }
  service.dispose();
}

async function main() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'onepiece-delta-qa-'));
  try {
    const oldBytes = makeExe();
    assert.equal(parseBlockmap(blockmap(oldBytes), oldBytes.length).length, 5);
    checks += 1;
    for (const behavior of [
      { name: 'delta' },
      { name: 'missing-cache', noCache: true },
      { name: 'corrupt-cache', tamperCache: true },
      { name: 'bad-blockmap', badBlockmap: true },
      { name: 'bad-range', badRange: true },
      { name: 'redirected-sidecar', badRedirect: true }
    ]) await caseRun(root, behavior);
    process.stdout.write(`DESKTOP_LAUNCHER_DELTA_QA=PASS checks=${checks} exactRange=PASS signedFinalHash=PASS fullFallback=PASS\n`);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_LAUNCHER_DELTA_QA=FAIL ${error.stack || error}\n`);
  process.exitCode = 1;
});
