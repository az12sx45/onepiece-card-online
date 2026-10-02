'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const content = require('../tools/desktop-r2-publisher/launcher-content-manifest');
const publisher = require('../tools/desktop-r2-publisher/publish-launcher-content');
const signing = require('../tools/desktop-r2-publisher/launcher-manifest-signature');
const runtime = require('../desktop/launcher-content-overlay');

let checks = 0;
async function rejects(work, pattern) { await assert.rejects(work, pattern); checks++; }
function equal(actual, expected) { assert.deepEqual(actual, expected); checks++; }
async function fixture(root) {
  const desktop = path.join(root, 'desktop');
  const imageRoot = path.join(root, 'public', 'images', 'test');
  await fsp.mkdir(desktop, { recursive: true });
  await fsp.mkdir(imageRoot, { recursive: true });
  await fsp.writeFile(path.join(desktop, 'launcher.html'), '<link href="launcher.css"><script src="launcher.js"></script>');
  await fsp.writeFile(path.join(desktop, 'launcher.css'), 'body{color:#123}');
  await fsp.writeFile(path.join(desktop, 'launcher.js'), 'window.test=1;');
  await fsp.writeFile(path.join(desktop, 'main.js'), 'private core');
  await fsp.writeFile(path.join(imageRoot, 'one.webp'), 'image one');
  await fsp.writeFile(path.join(imageRoot, 'two.webp'), 'image one');
  await fsp.writeFile(path.join(imageRoot, 'new-fish.webp'), 'new fish art');
  await fsp.writeFile(path.join(desktop, 'package.json'), JSON.stringify({
    version: '1.2.23', build: {
      files: ['main.js', 'launcher.html', 'launcher.css', 'launcher.js'],
      extraResources: [{ from: '../public/images/test', to: 'launcher-assets/images/test', filter: ['one.webp', 'two.webp'] }]
    }
  }));
}
function fakeContext() {
  const objects = new Map();
  let puts = 0;
  class HeadObjectCommand { constructor(input) { this.input = input; } }
  class PutObjectCommand { constructor(input) { this.input = input; } }
  const client = { async send(command) {
    const { Key } = command.input;
    if (command instanceof HeadObjectCommand) {
      const value = objects.get(Key);
      if (!value) { const error = new Error('missing'); error.name = 'NotFound'; throw error; }
      return value;
    }
    if (objects.has(Key)) { const error = new Error('precondition'); error.name = 'PreconditionFailed'; throw error; }
    puts++;
    const input = command.input;
    assert.equal(input.IfNoneMatch, '*'); checks++;
    assert.equal(crypto.createHash('sha256').update(input.Body).digest('hex'), input.Metadata.sha256); checks++;
    objects.set(Key, { ContentLength: input.ContentLength, Metadata: input.Metadata,
      ContentType: input.ContentType, CacheControl: input.CacheControl });
    return {};
  } };
  return { client, bucket: 'test-bucket', HeadObjectCommand, PutObjectCommand, objects, get puts() { return puts; } };
}
async function run() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'launcher-content-qa-'));
  try {
    await fixture(root);
    await rejects(() => content.build(root, '1.2.23', 1, '2026-10-03T00:00:00.000Z'), /explicit --include/);
    const unsigned = await content.build(root, '1.2.23', 1, '2026-10-03T00:00:00.000Z',
      ['launcher.js', 'images/test/one.webp', 'images/test/two.webp', 'images/test/new-fish.webp']);
    equal(unsigned.files.length, 4);
    equal(unsigned.files.every((file, index, files) => index === 0 || files[index - 1].path < file.path), true);
    equal(unsigned.files.some((file) => file.path === 'main.js'), false);
    equal(unsigned.files.filter((file) => file.path.startsWith('images/')).length, 3);
    equal(unsigned.files.some((file) => file.path === 'images/test/new-fish.webp'), true);
    const pair = crypto.generateKeyPairSync('ed25519');
    const privateKeyPkcs8Base64 = pair.privateKey.export({ format: 'der', type: 'pkcs8' }).toString('base64');
    const publicKeySpki = signing.publicKeySpkiBase64(pair.publicKey);
    const keyId = signing.computeKeyId(pair.publicKey);
    const signed = content.sign(unsigned, { privateKeyPkcs8Base64, publicKeySpki, keyId });
    equal(content.verify(signed, publicKeySpki), true);
    equal(content.carryPaths(signed, '1.2.23', 2, { [keyId]: publicKeySpki }),
      unsigned.files.map((file) => file.path));
    await rejects(async () => content.carryPaths(signed, '1.2.23', 1, { [keyId]: publicKeySpki }), /older revision/);
    const next = await content.build(root, '1.2.23', 2, '2026-10-03T01:00:00.000Z',
      ['launcher.css', ...content.carryPaths(signed, '1.2.23', 2, { [keyId]: publicKeySpki })]);
    equal(next.files.length, 5);
    equal(next.files.some((file) => file.path === 'launcher.js'), true);
    const nextSigned = content.sign(next, { privateKeyPkcs8Base64, publicKeySpki, keyId });
    equal(content.canonicalPayload(signed), runtime.canonicalPayload(signed));
    equal(runtime.validateManifest(signed, '1.2.23', { [keyId]: publicKeySpki }), signed);
    const manifestFile = path.join(root, 'signed.json');
    await fsp.writeFile(manifestFile, `${JSON.stringify(signed)}\n`);
    const inspected = await publisher.inspect(root, manifestFile, { [keyId]: publicKeySpki });
    equal(inspected.records.length, 3); // identical image bytes share one blob
    equal(inspected.logicalBytes > inspected.uniqueBytes, true);
    const dry = await publisher.publishInventory(inspected);
    equal(dry.verified, 3);
    equal(dry.uploaded, 0);
    const context = fakeContext();
    const first = await publisher.publishInventory(inspected, context);
    equal(first.uploaded, 3);
    equal(context.puts, 3);
    const second = await publisher.publishInventory(inspected, context);
    equal(second.reused, 3);
    equal(context.puts, 3);
    const media = await content.collectSources(root);
    const downloads = new Map();
    for (const file of signed.files) {
      const source = content.sourceForPath(root, media, file.path);
      downloads.set(file.sha256, await content.readSource(source.root, source.relative));
    }
    let served = signed;
    const fetchImpl = async (url) => {
      if (url.endsWith('/desktop/launcher-content-v1.json')) return new Response(JSON.stringify(served), { status: 200 });
      const hash = url.slice(url.lastIndexOf('/') + 1);
      return downloads.has(hash) ? new Response(downloads.get(hash), { status: 200 }) : new Response('missing', { status: 404 });
    };
    const overlay = new runtime.LauncherContentOverlay({
      coreVersion: '1.2.23', userDataPath: path.join(root, 'user-data'),
      origin: 'https://onepiece-card-online.onrender.com', fetchImpl, trustedKeys: { [keyId]: publicKeySpki }
    });
    const stage = await overlay.stage();
    equal(stage.staged, true);
    equal(stage.downloadedBytes, inspected.uniqueBytes);
    equal(await overlay.load(), 1);
    equal((await overlay.readVerified('launcher.js')).toString('utf8'), 'window.test=1;');
    equal((await overlay.readVerified('images/test/new-fish.webp')).toString('utf8'), 'new fish art');
    const cssFile = nextSigned.files.find((file) => file.path === 'launcher.css');
    downloads.set(cssFile.sha256, await fsp.readFile(path.join(root, 'desktop', 'launcher.css')));
    served = nextSigned;
    const secondStage = await overlay.stage();
    equal(secondStage.staged, true);
    equal(secondStage.downloadedBytes, cssFile.bytes);
    equal(await overlay.load(), 2);
    equal((await overlay.readVerified('launcher.js')).toString('utf8'), 'window.test=1;');
    const firstRecord = inspected.records[0];
    context.objects.get(firstRecord.key).Metadata.sha256 = '0'.repeat(64);
    await rejects(() => publisher.publishOne(firstRecord, context), /mismatched sha256 metadata/);
    const tampered = structuredClone(signed);
    tampered.files[0].sha256 = '0'.repeat(64);
    await rejects(async () => content.verify(tampered, publicKeySpki), /signature verification failed/);
    const unsorted = structuredClone(unsigned);
    unsorted.files.reverse();
    await rejects(async () => content.validate(unsorted), /strictly sorted/);
    const duplicate = structuredClone(unsigned);
    duplicate.files[1].path = duplicate.files[0].path.replace(/[^/]+$/, (name) => name.toUpperCase());
    duplicate.files.sort((a, b) => a.path < b.path ? -1 : 1);
    await rejects(async () => content.validate(duplicate), /Unsafe content path|Case-colliding|strictly sorted/);
    for (const bad of ['../main.js', 'main.js', 'preload.js', 'images/../../evil.webp', 'images/CON.webp', 'images/foo\\bar.webp', 'images/UPPER.webp', 'images/foo%bar.webp']) {
      await rejects(async () => content.checkedPath(bad), /Unsafe|cannot replace core/);
    }
    await fsp.writeFile(path.join(root, 'desktop', 'launcher.js'), 'window.test=2;');
    await rejects(() => publisher.inspect(root, manifestFile, { [keyId]: publicKeySpki }), /Manifest\/source mismatch/);
    process.stdout.write(`DESKTOP_R2_LAUNCHER_CONTENT_QA=PASS checks=${checks}\n`);
  } finally { await fsp.rm(root, { recursive: true, force: true }); }
}
run().catch((error) => { process.stderr.write(`DESKTOP_R2_LAUNCHER_CONTENT_QA=FAIL ${error.stack || error}\n`); process.exitCode = 1; });
