'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { EventEmitter } = require('node:events');
const {
  canonicalReleasePayload,
  LauncherUpdateService,
  MAX_MANIFEST_BYTES,
  compareSemver,
  parseSemver,
  TRUSTED_RELEASE_KEYS,
  validateReleaseManifest
} = require('../desktop/launcher-update-service');
const { canonicalPayloadBytes: publisherCanonicalPayloadBytes } = require('../tools/desktop-r2-publisher/launcher-manifest-signature');

const ORIGIN = 'https://onepiece-card-online.onrender.com';
const ASSET_ORIGIN = 'https://game-assets.rihdi.tw';
const MANIFEST_URL = `${ORIGIN}/desktop/launcher-release-v1.json`;
const VERSION = '1.1.4';
const FILE_NAME = `ONE-PIECE-Tabletop-Launcher-${VERSION}-x64.exe`;
const ARTIFACT_URL = `${ORIGIN}/desktop/launcher/releases/${FILE_NAME}`;
const TEST_KEY_PAIR = crypto.generateKeyPairSync('ed25519');
const TEST_PUBLIC_KEY = TEST_KEY_PAIR.publicKey.export({ format: 'der', type: 'spki' });
const TEST_KEY_ID = `launcher-ed25519-${crypto.createHash('sha256').update(TEST_PUBLIC_KEY).digest('hex').slice(0, 32)}`;
const TEST_TRUSTED_RELEASE_KEYS = Object.freeze({ [TEST_KEY_ID]: TEST_PUBLIC_KEY.toString('base64') });

function testPublishedSourceManifest() {
  const packageDocument = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'desktop', 'package.json'), 'utf8'));
  const manifestDocument = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'public', 'desktop', 'launcher-release-v1.json'), 'utf8'));
  assert.ok(
    compareSemver(manifestDocument.version, packageDocument.version) <= 0,
    'published source manifest must not announce a launcher newer than the staged package'
  );
  const release = validateReleaseManifest(manifestDocument, {
    manifestUrl: new URL(MANIFEST_URL),
    currentVersion: packageDocument.version
  });
  assert.equal(release.updateAvailable, false);

  const mainSource = fs.readFileSync(path.join(__dirname, '..', 'desktop', 'main.js'), 'utf8');
  assert.ok(mainSource.includes(`const ASSET_ORIGIN = '${ASSET_ORIGIN}';`), 'main process must declare the approved R2 artifact origin');
  assert.ok(mainSource.includes('allowedArtifactOrigins: [ASSET_ORIGIN]'), 'main process must pass the R2 artifact origin to LauncherUpdateService');
}

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function signManifest(document, overrides = {}) {
  const signature = crypto.sign(null, canonicalReleasePayload(document), overrides.privateKey || TEST_KEY_PAIR.privateKey);
  document.signature = {
    algorithm: overrides.algorithm || 'Ed25519',
    keyId: overrides.keyId || TEST_KEY_ID,
    value: signature.toString('base64')
  };
  return document;
}

function makePortableExecutable(size = 4096, marker = 0x31) {
  const bytes = Buffer.alloc(size);
  for (let index = 0; index < bytes.length; index += 1) bytes[index] = (marker + index * 17) & 0xff;
  bytes.write('MZ', 0, 'ascii');
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write('PE\0\0', 0x80, 'binary');
  return bytes;
}

function manifestFor(bytes, overrides = {}) {
  const version = overrides.version || VERSION;
  const document = {
    schema: 1,
    channel: 'stable',
    platform: 'win32',
    arch: 'x64',
    version,
    publishedAt: '2026-09-05T00:00:00.000Z',
    artifact: {
      url: overrides.url || `${ORIGIN}/desktop/launcher/releases/ONE-PIECE-Tabletop-Launcher-${version}-x64.exe`,
      bytes: overrides.bytes ?? bytes.length,
      sha256: overrides.sha256 || sha256(bytes),
      fileName: `ONE-PIECE-Tabletop-Launcher-${version}-x64.exe`
    },
    ...overrides.document
  };
  if (overrides.omitArtifact) delete document.artifact;
  if (!overrides.omitArtifact && !overrides.omitSignature) signManifest(document);
  return document;
}

function fakeResponse(body, options = {}) {
  const bytes = Buffer.from(body);
  const headers = new Map(Object.entries(options.headers || {}).map(([key, value]) => [key.toLowerCase(), String(value)]));
  if (!options.omitLength && !headers.has('content-length')) headers.set('content-length', String(bytes.length));
  if (options.contentType && !headers.has('content-type')) headers.set('content-type', options.contentType);
  const chunkSizes = options.chunkSizes || [bytes.length];
  return {
    status: options.status ?? 200,
    ok: (options.status ?? 200) >= 200 && (options.status ?? 200) < 300,
    url: options.url || '',
    headers: { get: (name) => headers.get(String(name).toLowerCase()) || null },
    body: {
      async *[Symbol.asyncIterator]() {
        let offset = 0;
        for (const requested of chunkSizes) {
          if (offset >= bytes.length) break;
          if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
          const end = Math.min(bytes.length, offset + requested);
          yield bytes.subarray(offset, end);
          offset = end;
        }
        if (offset < bytes.length) yield bytes.subarray(offset);
      }
    },
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  };
}

function manifestResponse(document, options = {}) {
  return fakeResponse(Buffer.from(JSON.stringify(document)), {
    url: options.url || MANIFEST_URL,
    contentType: 'application/json; charset=utf-8',
    ...options
  });
}

function makeFetch(routes, calls) {
  return async (url, options) => {
    calls.push({ url, options });
    const route = routes.get(url);
    if (!route) throw new Error(`Unexpected fetch: ${url}`);
    return typeof route === 'function' ? route(url, options) : route;
  };
}

function makeService(downloadRoot, fetchImpl, overrides = {}) {
  return new LauncherUpdateService({
    origin: ORIGIN,
    manifestUrl: MANIFEST_URL,
    currentVersion: '1.1.3',
    platform: 'win32',
    arch: 'x64',
    downloadRoot,
    fetchImpl,
    spawnImpl: overrides.spawnImpl || (() => { throw new Error('spawn must not be called'); }),
    quitImpl: overrides.quitImpl || (() => { throw new Error('quit must not be called'); }),
    manifestTimeoutMs: 2_000,
    downloadTimeoutMs: 2_000,
    spawnTimeoutMs: 2_000,
    trustedReleaseKeys: TEST_TRUSTED_RELEASE_KEYS,
    ...overrides
  });
}

async function rejectsCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code, `Expected rejection code ${code}`);
}

function filesUnder(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const queue = [root];
  while (queue.length) {
    const directory = queue.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) queue.push(full);
      else if (entry.isFile()) output.push(full);
    }
  }
  return output;
}

function expectedInstallerPath(root, manifest) {
  return path.join(root, `${manifest.version}-${manifest.artifact.sha256.slice(0, 16)}`, path.basename(new URL(manifest.artifact.url).pathname));
}

function testSemver() {
  assert.equal(compareSemver('1.1.3', '1.1.2'), 1);
  assert.equal(compareSemver('1.1.3-alpha.2', '1.1.3-alpha.1'), 1);
  assert.equal(compareSemver('1.1.3-alpha', '1.1.3'), -1);
  assert.equal(compareSemver('1.1.3+build.2', '1.1.3+build.1'), 0);
  assert.equal(compareSemver('100000000000000000000.0.0', '99999999999999999999.0.0'), 1);
  assert.throws(() => parseSemver('1.01.2'), (error) => error?.code === 'invalid_version');
  assert.throws(() => parseSemver('v1.1.2'), (error) => error?.code === 'invalid_version');
}

function testManifestSignatures() {
  const productionEntries = Object.entries(TRUSTED_RELEASE_KEYS);
  assert.equal(productionEntries.length, 1, 'launcher must embed exactly one reviewed release public key');
  const [productionKeyId, productionPublicBase64] = productionEntries[0];
  const productionPublicDer = Buffer.from(productionPublicBase64, 'base64');
  assert.equal(productionPublicDer.toString('base64'), productionPublicBase64, 'embedded release public key must use canonical base64');
  assert.equal(
    productionKeyId,
    `launcher-ed25519-${sha256(productionPublicDer).slice(0, 32)}`,
    'embedded release keyId must match its SPKI fingerprint'
  );
  assert.equal(crypto.createPublicKey({ key: productionPublicDer, format: 'der', type: 'spki' }).asymmetricKeyType, 'ed25519');

  const bytes = makePortableExecutable();
  const validationOptions = {
    manifestUrl: new URL(MANIFEST_URL),
    currentVersion: '1.1.3',
    platform: 'win32',
    arch: 'x64',
    allowedArtifactOrigins: new Set([ORIGIN, ASSET_ORIGIN]),
    trustedReleaseKeys: TEST_TRUSTED_RELEASE_KEYS
  };
  const valid = manifestFor(bytes);
  assert.deepEqual(canonicalReleasePayload(valid), publisherCanonicalPayloadBytes(valid), 'runtime and offline publisher canonical payloads must stay byte-identical');
  assert.equal(validateReleaseManifest(valid, validationOptions).updateAvailable, true, 'valid Ed25519 release signature must pass');

  const tamperCases = [
    ['artifact', (document) => { document.artifact.bytes += 1; }],
    ['url', (document) => { document.artifact.url = `${ORIGIN}/desktop/launcher/mirror/${document.artifact.fileName}`; }],
    ['hash', (document) => { document.artifact.sha256 = `${document.artifact.sha256.slice(0, -1)}${document.artifact.sha256.endsWith('0') ? '1' : '0'}`; }],
    ['version', (document) => { document.version = '1.1.5'; }],
    ['timestamp', (document) => { document.publishedAt = '2026-09-05T00:00:01.000Z'; }],
    ['signature', (document) => {
      const first = document.signature.value[0] === 'A' ? 'B' : 'A';
      document.signature.value = `${first}${document.signature.value.slice(1)}`;
    }]
  ];
  for (const [label, mutate] of tamperCases) {
    const document = structuredClone(valid);
    mutate(document);
    assert.throws(
      () => validateReleaseManifest(document, validationOptions),
      (error) => error?.code === 'invalid_manifest_signature' || error?.code === 'invalid_manifest',
      `${label} tamper must fail`
    );
  }

  const unsigned = structuredClone(valid);
  delete unsigned.signature;
  assert.throws(() => validateReleaseManifest(unsigned, validationOptions), (error) => error?.code === 'invalid_manifest');

  const unknownKey = structuredClone(valid);
  unknownKey.signature.keyId = `launcher-ed25519-${'0'.repeat(32)}`;
  assert.throws(() => validateReleaseManifest(unknownKey, validationOptions), (error) => error?.code === 'untrusted_manifest_key');

  const unknownAlgorithm = structuredClone(valid);
  unknownAlgorithm.signature.algorithm = 'Ed25519ph';
  assert.throws(() => validateReleaseManifest(unknownAlgorithm, validationOptions), (error) => error?.code === 'unsupported_manifest_signature');

  const currentUnsigned = manifestFor(bytes, { version: '1.1.3', omitArtifact: true, omitSignature: true });
  assert.equal(validateReleaseManifest(currentUnsigned, validationOptions).updateAvailable, false, 'current unsigned artifact-free manifest must stay compatible');
}

async function testManifestPolicy(root) {
  const bytes = makePortableExecutable();
  assert.throws(() => new LauncherUpdateService({
    origin: 'http://onepiece-card-online.onrender.com',
    currentVersion: '1.1.3', platform: 'win32', arch: 'x64', downloadRoot: root,
    fetchImpl: async () => {}, spawnImpl: () => {}, quitImpl: () => {}
  }), (error) => error?.code === 'invalid_origin');
  assert.throws(() => new LauncherUpdateService({
    origin: ORIGIN,
    manifestUrl: 'https://updates.example.test/latest.json',
    currentVersion: '1.1.3', platform: 'win32', arch: 'x64', downloadRoot: root,
    fetchImpl: async () => {}, spawnImpl: () => {}, quitImpl: () => {}
  }), (error) => error?.code === 'invalid_manifest_url');

  const externalManifest = manifestFor(bytes, {
    url: `${ASSET_ORIGIN}/desktop/launcher/releases/${FILE_NAME}`
  });
  const deniedCalls = [];
  const denied = makeService(path.join(root, 'denied'), makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(externalManifest)]
  ]), deniedCalls));
  await rejectsCode(denied.checkForUpdates(), 'untrusted_artifact');

  const allowedCalls = [];
  const allowed = makeService(path.join(root, 'allowed'), makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(externalManifest)]
  ]), allowedCalls), { allowedArtifactOrigins: [ASSET_ORIGIN] });
  assert.equal((await allowed.checkForUpdates()).status, 'available');

  const redirectedCalls = [];
  const redirected = makeService(path.join(root, 'redirected'), makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(manifestFor(bytes), { url: `${ORIGIN}/desktop/other.json` })]
  ]), redirectedCalls));
  await rejectsCode(redirected.checkForUpdates(), 'manifest_redirect');

  const oversized = manifestFor(bytes, { bytes: 1025 });
  const sizeCalls = [];
  const sizeService = makeService(path.join(root, 'size'), makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(oversized)]
  ]), sizeCalls), { maxInstallerBytes: 1024 });
  await rejectsCode(sizeService.checkForUpdates(), 'download_too_large');

  const missingArtifactCalls = [];
  const missingArtifactService = makeService(path.join(root, 'missing-artifact'), makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(manifestFor(bytes, { omitArtifact: true }))]
  ]), missingArtifactCalls));
  await rejectsCode(missingArtifactService.checkForUpdates(), 'invalid_manifest');

  const wrongFileName = manifestFor(bytes);
  wrongFileName.artifact.fileName = 'different-installer.exe';
  const fileNameCalls = [];
  const fileNameService = makeService(path.join(root, 'file-name'), makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(wrongFileName)]
  ]), fileNameCalls));
  await rejectsCode(fileNameService.checkForUpdates(), 'invalid_manifest');

  const hugeBody = Buffer.alloc(MAX_MANIFEST_BYTES + 1, 0x20);
  const manifestSizeCalls = [];
  const manifestSizeService = makeService(path.join(root, 'manifest-size'), makeFetch(new Map([
    [MANIFEST_URL, () => fakeResponse(hugeBody, { url: MANIFEST_URL, contentType: 'application/json' })]
  ]), manifestSizeCalls));
  await assert.rejects(manifestSizeService.checkForUpdates(), (error) => ['download_too_large', 'manifest_too_large'].includes(error?.code));
}

async function testUpToDate(root) {
  const bytes = makePortableExecutable();
  const document = manifestFor(bytes, { version: '1.1.3', omitArtifact: true });
  const calls = [];
  const service = makeService(root, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(document)]
  ]), calls));
  const state = await service.checkForUpdates();
  assert.equal(state.status, 'current');
  assert.equal(state.currentVersion, '1.1.3');
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[0].options.redirect, 'error');
  assert.equal(calls[0].options.headers['Accept-Encoding'], 'identity');
}

async function testDownloadAndInstall(root) {
  const bytes = makePortableExecutable(8192, 0x43);
  const document = manifestFor(bytes);
  const calls = [];
  const routes = new Map([
    [MANIFEST_URL, () => manifestResponse(document)],
    [ARTIFACT_URL, () => fakeResponse(bytes, {
      url: ARTIFACT_URL,
      contentType: 'application/octet-stream',
      chunkSizes: [733, 997, 1301, 1901]
    })]
  ]);
  const spawnCalls = [];
  let quitCount = 0;
  let unrefCount = 0;
  const service = makeService(root, makeFetch(routes, calls), {
    spawnImpl: (file, args, options) => {
      spawnCalls.push({ file, args, options });
      const child = new EventEmitter();
      child.unref = () => { unrefCount += 1; };
      setImmediate(() => child.emit('spawn'));
      return child;
    },
    quitImpl: () => { quitCount += 1; }
  });
  const states = [];
  const progress = [];
  let partObserved = false;
  service.on('state', (state) => states.push(state));
  service.on('progress', (event) => {
    progress.push(event);
    if (event.downloadedBytes > 0 && event.downloadedBytes < event.totalBytes) {
      partObserved ||= filesUnder(root).some((file) => file.endsWith('.part'));
    }
  });

  assert.equal(service.getState().progress, 0);
  assert.equal(service.getState().error, '');
  assert.equal(Object.hasOwn(service.getState(), 'percent'), false);
  assert.equal(Object.hasOwn(service.getState(), 'errorMessage'), false);

  assert.equal((await service.checkForUpdates()).status, 'available');
  const ready = await service.downloadUpdate();
  assert.equal(ready.status, 'ready');
  assert.equal(ready.progress, 100);
  assert.equal(Object.hasOwn(ready, 'installerPath'), false, 'public state must not expose a filesystem path');
  assert.equal(partObserved, true, 'download must be written through a visible .part file');
  const finalPath = expectedInstallerPath(root, document);
  assert.equal(fs.existsSync(finalPath), true);
  assert.equal(fs.existsSync(`${finalPath}.part`), false);
  assert.equal(sha256(fs.readFileSync(finalPath)), document.artifact.sha256);
  assert.equal(progress[0].downloadedBytes, 0);
  assert.equal(progress.at(-1).downloadedBytes, bytes.length);
  assert.equal(progress.at(-1).progress, 100);
  assert.equal(Object.hasOwn(progress.at(-1), 'percent'), false);
  assert.ok(states.some((state) => state.status === 'checking'));
  assert.ok(states.some((state) => state.status === 'available'));
  assert.ok(states.some((state) => state.status === 'downloading'));
  assert.ok(states.some((state) => state.status === 'ready'));

  const result = await service.installReadyUpdate();
  assert.deepEqual(result, { ok: true, version: VERSION });
  assert.equal(spawnCalls.length, 1);
  assert.equal(spawnCalls[0].file, finalPath);
  assert.deepEqual(spawnCalls[0].args, ['--updated', '/S', '--force-run']);
  assert.deepEqual(spawnCalls[0].options, { detached: true, stdio: 'ignore', windowsHide: true, shell: false });
  assert.equal(unrefCount, 1);
  assert.equal(quitCount, 1);
  assert.equal(service.getState().status, 'applying');

  const artifactFetch = calls.find((call) => call.url === ARTIFACT_URL);
  assert.equal(artifactFetch.options.cache, 'no-store');
  assert.equal(artifactFetch.options.redirect, 'error');
  assert.equal(artifactFetch.options.headers['Accept-Encoding'], 'identity');
  return { bytes, document, finalPath };
}

async function testIntegrityFailures(root) {
  const good = makePortableExecutable(4096, 0x52);
  const wrong = Buffer.from(good);
  wrong[300] ^= 0xff;
  const hashDocument = manifestFor(good);
  const hashCalls = [];
  const hashRoot = path.join(root, 'hash');
  const hashService = makeService(hashRoot, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(hashDocument)],
    [ARTIFACT_URL, () => fakeResponse(wrong, { url: ARTIFACT_URL, omitLength: true })]
  ]), hashCalls));
  await hashService.checkForUpdates();
  await rejectsCode(hashService.downloadUpdate(), 'hash_mismatch');
  assert.equal(hashService.getState().status, 'error');
  assert.equal(hashService.getState().errorCode, 'hash_mismatch');
  assert.ok(hashService.getState().error);
  assert.equal(Object.hasOwn(hashService.getState(), 'errorMessage'), false);
  assert.equal(filesUnder(hashRoot).some((file) => file.endsWith('.part')), false);

  const lengthDocument = manifestFor(good);
  const lengthCalls = [];
  const lengthRoot = path.join(root, 'length');
  const lengthService = makeService(lengthRoot, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(lengthDocument)],
    [ARTIFACT_URL, () => fakeResponse(good, { url: ARTIFACT_URL, headers: { 'content-length': String(good.length - 1) } })]
  ]), lengthCalls));
  await lengthService.checkForUpdates();
  await rejectsCode(lengthService.downloadUpdate(), 'size_mismatch');
  assert.equal(filesUnder(lengthRoot).some((file) => file.endsWith('.part')), false);

  const notPe = Buffer.alloc(4096, 0x62);
  const peDocument = manifestFor(notPe);
  const peCalls = [];
  const peRoot = path.join(root, 'pe');
  const peService = makeService(peRoot, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(peDocument)],
    [ARTIFACT_URL, () => fakeResponse(notPe, { url: ARTIFACT_URL })]
  ]), peCalls));
  await peService.checkForUpdates();
  await rejectsCode(peService.downloadUpdate(), 'invalid_installer');
  assert.equal(filesUnder(peRoot).some((file) => file.endsWith('.part')), false);
}

async function testCancellation(root) {
  const bytes = makePortableExecutable(8192, 0x71);
  const document = manifestFor(bytes);
  const calls = [];
  const service = makeService(root, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(document)],
    [ARTIFACT_URL, () => fakeResponse(bytes, { url: ARTIFACT_URL, omitLength: true, chunkSizes: [1024, 1024, 1024], delayMs: 20 })]
  ]), calls));
  await service.checkForUpdates();
  let canceled = false;
  service.on('progress', (event) => {
    if (!canceled && event.downloadedBytes > 0) {
      canceled = service.cancelDownload();
    }
  });
  await rejectsCode(service.downloadUpdate(), 'aborted');
  assert.equal(canceled, true);
  assert.equal(service.getState().status, 'available');
  assert.equal(filesUnder(root).some((file) => file.endsWith('.part')), false);
}

async function testTamperAndSpawnFailure(root, valid) {
  const calls = [];
  let spawnCount = 0;
  let quitCount = 0;
  const tamperService = makeService(root, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(valid.document)]
  ]), calls), {
    spawnImpl: () => { spawnCount += 1; },
    quitImpl: () => { quitCount += 1; }
  });
  assert.equal((await tamperService.checkForUpdates()).status, 'ready');
  const tampered = fs.readFileSync(valid.finalPath);
  tampered[512] ^= 0xff;
  fs.writeFileSync(valid.finalPath, tampered);
  await rejectsCode(tamperService.installReadyUpdate(), 'hash_mismatch');
  assert.equal(spawnCount, 0);
  assert.equal(quitCount, 0);

  fs.writeFileSync(valid.finalPath, valid.bytes);
  const spawnService = makeService(root, makeFetch(new Map([
    [MANIFEST_URL, () => manifestResponse(valid.document)]
  ]), []), {
    spawnImpl: () => {
      const child = new EventEmitter();
      setImmediate(() => child.emit('error', new Error('fixture spawn failure')));
      return child;
    },
    quitImpl: () => { quitCount += 1; }
  });
  assert.equal((await spawnService.checkForUpdates()).status, 'ready');
  await rejectsCode(spawnService.installReadyUpdate(), 'spawn_failed');
  assert.equal(quitCount, 0, 'launcher must not quit when NSIS failed to spawn');
}

async function main() {
  const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'onepiece-launcher-update-qa-'));
  try {
    testPublishedSourceManifest();
    testSemver();
    testManifestSignatures();
    await testManifestPolicy(path.join(temporaryRoot, 'policy'));
    await testUpToDate(path.join(temporaryRoot, 'up-to-date'));
    const valid = await testDownloadAndInstall(path.join(temporaryRoot, 'valid'));
    await testIntegrityFailures(path.join(temporaryRoot, 'failures'));
    await testCancellation(path.join(temporaryRoot, 'cancel'));
    await testTamperAndSpawnFailure(path.join(temporaryRoot, 'valid'), valid);
    console.log(
      'DESKTOP_LAUNCHER_UPDATE_QA=PASS ' +
      'sourceManifest=PASS semver=PASS ed25519Manifest=PASS tamperMatrix=PASS unknownKeyAlgorithm=PASS renderAndR2Origins=PASS optionalArtifact=PASS manifestLimit=PASS sizeShaPe=PASS partRename=PASS ' +
      'events=PASS cancelCleanup=PASS tamperRecheck=PASS nsisArgs=--updated,/S,--force-run spawnBeforeQuit=PASS'
    );
  } finally {
    await fsp.rm(temporaryRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(`DESKTOP_LAUNCHER_UPDATE_QA=FAIL ${error.stack || error.message || error}`);
  process.exitCode = 1;
});
