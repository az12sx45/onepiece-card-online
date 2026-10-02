'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { BLOB_BASE, LauncherContentOverlay, canonicalPayload, validateManifest } = require('../desktop/launcher-content-overlay');
const { CONTENT_UI_URL, isTrustedLauncherUrl } = require('../desktop/launcher-sender-policy');
const { applySnapshotScript, legacySnapshotScript, sanitizeSnapshot } = require('../desktop/launcher-storage-migration');

const keyPair = crypto.generateKeyPairSync('ed25519');
const publicKey = keyPair.publicKey.export({ format: 'der', type: 'spki' });
const keyId = `launcher-ed25519-${crypto.createHash('sha256').update(publicKey).digest('hex').slice(0, 32)}`;
const keys = { [keyId]: publicKey.toString('base64') };
const coreVersion = '1.2.23';
const manifestUrl = 'https://onepiece-card-online.onrender.com/desktop/launcher-content-v1.json';
let checks = 0;

function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
function sign(revision, entries) {
  const document = {
    schema: 1, channel: 'stable', platform: 'win32', arch: 'x64', coreVersion, revision,
    publishedAt: '2026-10-03T00:00:00.000Z', baseUrl: BLOB_BASE,
    files: entries.map(([name, bytes]) => ({ path: name, bytes: bytes.length, sha256: sha(bytes) })).sort((a, b) => a.path < b.path ? -1 : 1)
  };
  document.signature = { algorithm: 'Ed25519', keyId, value: crypto.sign(null, canonicalPayload(document), keyPair.privateKey).toString('base64') };
  return document;
}
function response(url, bytes, status = 200) {
  return { status, ok: status >= 200 && status < 300, url,
    headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(bytes.length) : null },
    body: { async *[Symbol.asyncIterator]() { yield bytes; } } };
}
function shouldThrow(fn, code) {
  assert.throws(fn, (error) => error?.code === code);
  checks += 1;
}

function localStorageFor(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index] ?? null; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
  };
}

function testSenderAndStorageMigration() {
  const bundled = path.join('D:', 'Launcher App', 'resources', 'app.asar');
  const { pathToFileURL } = require('node:url');
  const originalUrl = pathToFileURL(path.join(bundled, 'launcher.html')).href;
  assert.equal(isTrustedLauncherUrl(originalUrl, bundled), true); checks += 1;
  assert.equal(isTrustedLauncherUrl(CONTENT_UI_URL, bundled), true); checks += 1;
  for (const untrusted of [
    `${CONTENT_UI_URL}?other=1`, 'opui://launcher-ui/preload.js',
    'opui://launcher/launcher.html', 'opui://evil/launcher.html',
    pathToFileURL(path.join(bundled, 'preload.js')).href,
    pathToFileURL(path.join('D:', 'Other App', 'launcher.html')).href
  ]) { assert.equal(isTrustedLauncherUrl(untrusted, bundled), false); checks += 1; }
  const bgm = JSON.stringify({ volume: 0.45, muted: true });
  const announcements = JSON.stringify({ schemaVersion: 1, ownerId: 7, storedAt: 123, revision: 1, entries: [], pending: [] });
  const oldStore = localStorageFor({
    'onepiece.launcher.profileMusic.v1': bgm,
    'onepiece.launcher.announcements.v1.7': announcements,
    opSecret: 'never migrate this secret'
  });
  const snapshot = sanitizeSnapshot(vm.runInNewContext(legacySnapshotScript, { localStorage: oldStore }));
  assert.deepEqual(Object.keys(snapshot).sort(), ['onepiece.launcher.announcements.v1.7', 'onepiece.launcher.profileMusic.v1']); checks += 1;
  const newStore = localStorageFor();
  const first = vm.runInNewContext(applySnapshotScript(snapshot), { localStorage: newStore });
  assert.equal(first.ok, true); checks += 1;
  assert.equal(newStore.getItem('onepiece.launcher.profileMusic.v1'), bgm); checks += 1;
  assert.equal(newStore.getItem('onepiece.launcher.announcements.v1.7'), announcements); checks += 1;
  newStore.setItem('onepiece.launcher.profileMusic.v1', JSON.stringify({ volume: 0.7, muted: false }));
  vm.runInNewContext(applySnapshotScript(snapshot), { localStorage: newStore });
  assert.equal(JSON.parse(newStore.getItem('onepiece.launcher.profileMusic.v1')).volume, 0.7,
    'second migration must never overwrite preferences changed in the new origin'); checks += 1;
}

async function main() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'onepiece-overlay-qa-'));
  try {
    testSenderAndStorageMigration();
    const html1 = Buffer.from('<!doctype html><title>r1</title>');
    const html2 = Buffer.from('<!doctype html><title>r2</title>');
    const script1 = Buffer.from('window.ONE_PIECE_OVERLAY=1;');
    const script2 = Buffer.from('window.ONE_PIECE_OVERLAY=2;');
    const art = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x12, 0x34]);
    const first = sign(1, [['launcher.html', html1], ['launcher.js', script1]]);
    const second = sign(2, [['images/launcher_room/fishing_v5/overlay-test.webp', art], ['launcher.html', html2], ['launcher.js', script2]]);
    const blobs = new Map([html1, html2, script1, script2, art].map((bytes) => [`${BLOB_BASE}${sha(bytes)}`, bytes]));
    let remote = first;
    let corruptBlob = false;
    const calls = [];
    const fetchImpl = async (url) => {
      calls.push(url);
      if (url === manifestUrl) return response(url, Buffer.from(JSON.stringify(remote)));
      const bytes = blobs.get(url);
      if (!bytes) return response(url, Buffer.from('missing'), 404);
      return response(url, corruptBlob ? Buffer.alloc(bytes.length, 0x7f) : bytes);
    };
    const create = () => new LauncherContentOverlay({ coreVersion, userDataPath: root,
      origin: 'https://onepiece-card-online.onrender.com', fetchImpl, trustedKeys: keys });
    const store = create();
    assert.equal(await store.load(), 0); checks += 1;
    assert.equal(store.resolve('launcher.html'), null); checks += 1;
    const staged1 = await store.stage();
    assert.equal(staged1.staged, true); checks += 1;
    assert.equal(staged1.downloadedBytes, html1.length + script1.length); checks += 1;
    assert.equal(store.resolve('launcher.html'), null, 'stage must not mix live renderer files'); checks += 1;
    const rebooted = create();
    assert.equal(await rebooted.load(), 1); checks += 1;
    assert.deepEqual(await fsp.readFile(rebooted.resolve('launcher.html')), html1); checks += 1;

    remote = second;
    const staged2 = await rebooted.stage();
    assert.equal(staged2.staged, true); checks += 1;
    assert.equal(staged2.downloadedBytes, html2.length + script2.length + art.length); checks += 1;
    const nextBoot = create();
    assert.equal(await nextBoot.load(), 2); checks += 1;
    assert.deepEqual(await fsp.readFile(nextBoot.resolve('launcher.js')), script2); checks += 1;
    assert.deepEqual(await fsp.readFile(nextBoot.resolve('images/launcher_room/fishing_v5/overlay-test.webp')), art); checks += 1;

    const rejected = create();
    assert.equal(await rejected.load(), 2); checks += 1;
    assert.equal(await rejected.rejectActive(), 1, 'unusable signed UI must return to the previous complete revision'); checks += 1;
    assert.equal((await create().load()), 1, 'rejected revision must remain quarantined after restart'); checks += 1;
    assert.equal((await rejected.stage()).staged, false, 'the same rejected revision must not immediately reinstall'); checks += 1;

    await fsp.writeFile(nextBoot.resolve('launcher.js'), Buffer.from('tampered'));
    const rollback = create();
    assert.equal(await rollback.load(), 1, 'one damaged overlay file must discard the whole revision'); checks += 1;
    assert.deepEqual(await fsp.readFile(rollback.resolve('launcher.html')), html1); checks += 1;
    assert.equal(rollback.resolve('images/launcher_room/fishing_v5/overlay-test.webp'), null); checks += 1;

    const tampered = JSON.parse(JSON.stringify(first));
    tampered.files[0].bytes += 1;
    shouldThrow(() => validateManifest(tampered, coreVersion, keys), 'invalid_content_signature');
    shouldThrow(() => validateManifest(first, '1.2.24', keys), 'invalid_content_manifest');
    const unsafe = sign(3, [['preload.js', Buffer.from('bad')]]);
    shouldThrow(() => validateManifest(unsafe, coreVersion, keys), 'invalid_content_manifest');
    const unsorted = sign(3, [['launcher.html', html1], ['launcher.js', script1]]);
    unsorted.files.reverse();
    shouldThrow(() => validateManifest(unsorted, coreVersion, keys), 'invalid_content_manifest');

    remote = sign(3, [['launcher.html', html2], ['launcher.js', script2]]);
    corruptBlob = true;
    await assert.rejects(rollback.stage(), (error) => error?.code === 'content_hash_mismatch');
    checks += 1;
    assert.equal((await create().load()), 1, 'failed blob fetch must not switch the slot'); checks += 1;
    assert.ok(calls.includes(manifestUrl)); checks += 1;
    corruptBlob = false;
    remote = sign(4, []);
    const resetToBundled = await rollback.stage();
    assert.equal(resetToBundled.staged, true); checks += 1;
    assert.equal(resetToBundled.downloadedBytes, 0); checks += 1;
    const bundledOnly = create();
    assert.equal(await bundledOnly.load(), 4); checks += 1;
    assert.equal(bundledOnly.resolve('launcher.html'), null, 'an empty sparse revision must retire prior overrides'); checks += 1;
    assert.equal(bundledOnly.resolve('launcher.js'), null); checks += 1;
    const stalled = new LauncherContentOverlay({ coreVersion, userDataPath: root,
      origin: 'https://onepiece-card-online.onrender.com', fetchImpl: () => new Promise(() => {}),
      trustedKeys: keys, manifestTimeoutMs: 25 });
    await assert.rejects(stalled.stage(), (error) => error?.code === 'content_timeout'); checks += 1;
    process.stdout.write(`DESKTOP_LAUNCHER_CONTENT_OVERLAY_QA=PASS checks=${checks} signature=PASS coreGate=PASS atomicSlot=PASS fullRevisionRollback=PASS\n`);
  } finally {
    await fsp.rm(root, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_LAUNCHER_CONTENT_OVERLAY_QA=FAIL ${error.stack || error}\n`);
  process.exitCode = 1;
});
