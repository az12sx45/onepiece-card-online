'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const blockmapPublisher = require('../tools/desktop-r2-publisher/publish-launcher-blockmap');

const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
class Head { constructor(input) { this.input = input; } }
class Put { constructor(input) { this.input = input; } }
class FakeClient {
  constructor() { this.objects = new Map(); this.puts = []; }
  async send(command) {
    const key = command.input.Key;
    if (command instanceof Head) {
      if (this.objects.has(key)) return this.objects.get(key);
      const error = new Error('missing'); error.name = 'NotFound'; error.$metadata = { httpStatusCode: 404 }; throw error;
    }
    if (command instanceof Put) {
      assert.equal(command.input.IfNoneMatch, '*');
      if (this.objects.has(key)) throw new Error('overwrite attempted');
      this.puts.push(command.input);
      this.objects.set(key, {
        ContentLength: command.input.ContentLength,
        ContentType: command.input.ContentType,
        CacheControl: command.input.CacheControl,
        Metadata: command.input.Metadata
      });
      return {};
    }
    throw new Error('unknown command');
  }
}

async function run() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'launcher-blockmap-qa-'));
  try {
    const version = '1.2.99';
    const installerPath = path.join(root, `ONE-PIECE-Tabletop-Launcher-${version}-x64.exe`);
    const blockmapPath = `${installerPath}.blockmap`;
    const installer = Buffer.alloc(512, 0);
    installer.write('MZ', 0, 'latin1');
    installer.writeUInt32LE(0x80, 0x3c);
    installer.write('PE\0\0', 0x80, 'latin1');
    await fsp.writeFile(installerPath, installer);
    const makeMap = sizes => zlib.gzipSync(Buffer.from(JSON.stringify({
      version: '2', files: [{ name: 'file', offset: 0, sizes, checksums: sizes.map(() => 'AYuGxilBrzqjm/SubMd839e5') }]
    })));
    const bytes = makeMap([256, 256]);
    await fsp.writeFile(blockmapPath, bytes);
    const options = {
      installerPath, blockmapPath, version,
      expectedInstallerSha256: sha256(installer), expectedInstallerBytes: installer.length,
      expectedBlockmapSha256: sha256(bytes), expectedBlockmapBytes: bytes.length
    };
    const { record } = await blockmapPublisher.inspectBlockmap(options);
    assert.equal(record.reviewed, true);
    assert.equal(record.blocks, 2);
    assert.equal(record.installerBytes, installer.length);
    assert.equal(record.key, `desktop/launcher/releases/${version}/${path.basename(blockmapPath)}`);
    assert.equal((await blockmapPublisher.publishBlockmap(record, bytes)).status, 'verified');
    await assert.rejects(() => blockmapPublisher.inspectBlockmap({ ...options, expectedBlockmapSha256: '0'.repeat(64) }), /SHA-256/);
    await assert.rejects(() => blockmapPublisher.inspectBlockmap({ ...options, expectedInstallerSha256: '0'.repeat(64) }), /SHA-256/);
    await fsp.writeFile(blockmapPath, makeMap([256, 255]));
    await assert.rejects(() => blockmapPublisher.inspectBlockmap({ ...options, expectedBlockmapSha256: null,
      expectedBlockmapBytes: null }), /byte sum/);
    await fsp.writeFile(blockmapPath, bytes);
    const client = new FakeClient();
    const context = { client, bucket: 'fixture', HeadObjectCommand: Head, PutObjectCommand: Put };
    assert.equal((await blockmapPublisher.publishBlockmap(record, bytes, context)).status, 'uploaded');
    assert.equal(client.puts.length, 1);
    assert.equal(client.puts[0].Metadata['installer-sha256'], sha256(installer));
    assert.equal((await blockmapPublisher.publishBlockmap(record, bytes, context)).status, 'skipped');
    assert.equal(client.puts.length, 1);
    client.objects.get(record.key).Metadata.sha256 = '0'.repeat(64);
    await assert.rejects(() => blockmapPublisher.publishBlockmap(record, bytes, context), /metadata differs/);
    assert.equal(client.puts.length, 1);
    process.stdout.write('DESKTOP_R2_LAUNCHER_BLOCKMAP_QA=PASS format=PASS reviewedPair=PASS noOverwrite=PASS\n');
  } finally {
    const relation = path.relative(path.resolve(os.tmpdir()), path.resolve(root));
    assert.ok(relation && relation !== '..' && !relation.startsWith(`..${path.sep}`));
    await fsp.rm(root, { recursive: true, force: true });
  }
}

run().catch(error => {
  process.stderr.write(`DESKTOP_R2_LAUNCHER_BLOCKMAP_QA=FAIL ${error.stack || error}\n`);
  process.exitCode = 1;
});
