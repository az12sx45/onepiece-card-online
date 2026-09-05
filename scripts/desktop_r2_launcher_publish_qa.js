'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const publisherPath = path.resolve(__dirname, '..', 'tools', 'desktop-r2-publisher', 'publish-launcher-artifact.js');
const wrapperPath = path.resolve(__dirname, '..', 'tools', 'desktop-r2-publisher', 'publish-saved-launcher.ps1');
const publisher = require(publisherPath);

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function makePeBytes(label = 'fixture') {
  const bytes = Buffer.alloc(512, 0);
  bytes.write('MZ', 0, 'latin1');
  bytes.writeUInt32LE(0x80, 0x3c);
  bytes.write('PE\0\0', 0x80, 'latin1');
  bytes.write(label, 0x100, 'utf8');
  return bytes;
}

class FakeHeadObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

class FakePutObjectCommand {
  constructor(input) {
    this.input = input;
  }
}

function missingError() {
  const error = new Error('missing');
  error.name = 'NotFound';
  error.$metadata = { httpStatusCode: 404 };
  return error;
}

function exactHead(record) {
  return {
    ContentLength: record.size,
    ContentType: publisher.INSTALLER_CONTENT_TYPE,
    CacheControl: publisher.IMMUTABLE_CACHE_CONTROL,
    Metadata: { sha256: record.sha256, version: record.version }
  };
}

class FakeS3Client {
  constructor(initialObjects = new Map(), raceKey = '') {
    this.objects = new Map(initialObjects);
    this.raceKey = raceKey;
    this.calls = [];
  }

  async send(command) {
    if (command instanceof FakeHeadObjectCommand) {
      this.calls.push({ operation: 'HEAD', input: command.input });
      const value = this.objects.get(command.input.Key);
      if (!value) throw missingError();
      return value;
    }
    if (command instanceof FakePutObjectCommand) {
      this.calls.push({ operation: 'PUT', input: command.input });
      if (command.input.Key === this.raceKey) {
        this.raceKey = '';
        this.objects.set(command.input.Key, {
          ContentLength: command.input.ContentLength,
          ContentType: command.input.ContentType,
          CacheControl: command.input.CacheControl,
          Metadata: { ...command.input.Metadata }
        });
        const error = new Error('conditional conflict');
        error.name = 'PreconditionFailed';
        error.$metadata = { httpStatusCode: 412 };
        throw error;
      }
      if (this.objects.has(command.input.Key) && command.input.IfNoneMatch === '*') {
        const error = new Error('conditional conflict');
        error.name = 'PreconditionFailed';
        error.$metadata = { httpStatusCode: 412 };
        throw error;
      }
      this.objects.set(command.input.Key, {
        ContentLength: command.input.ContentLength,
        ContentType: command.input.ContentType,
        CacheControl: command.input.CacheControl,
        Metadata: { ...command.input.Metadata }
      });
      return { ETag: '"fixture"' };
    }
    throw new Error(`Unexpected command: ${command?.constructor?.name || typeof command}`);
  }
}

function liveContext(client) {
  return {
    client,
    bucket: 'fixture-bucket',
    HeadObjectCommand: FakeHeadObjectCommand,
    PutObjectCommand: FakePutObjectCommand
  };
}

async function assertRejectsMessage(action, pattern) {
  let caught = null;
  try {
    await action();
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, 'Expected operation to reject.');
  assert.match(String(caught.message || caught), pattern);
}

function assertThrowsMessage(action, pattern) {
  assert.throws(action, pattern);
}

async function run() {
  const [source, wrapperSource] = await Promise.all([
    fsp.readFile(publisherPath, 'utf8'),
    fsp.readFile(wrapperPath, 'utf8')
  ]);
  assert.doesNotMatch(source, /DeleteObjectCommand|deleteObjects?\s*\(/i, 'Launcher publisher must not contain an R2 delete path.');
  assert.doesNotMatch(source, /PutObjectCommand[\s\S]{0,200}IfMatch\s*:/i, 'Launcher publisher must never use an overwrite precondition.');
  assert.match(wrapperSource, /accessKeyIdProtected/);
  assert.match(wrapperSource, /secretAccessKeyProtected/);
  assert.match(wrapperSource, /'--live'/);
  assert.match(wrapperSource, /'--expected-sha256'/);
  assert.match(wrapperSource, /'--expected-bytes'/);

  assert.equal(publisher.parseArguments(['--help']).help, true);
  assertThrowsMessage(() => publisher.parseArguments([]), /--file is required/);
  assertThrowsMessage(
    () => publisher.parseArguments(['--file', 'relative.exe', '--version', '1.2.3', '--live']),
    /expected-sha256/
  );
  assertThrowsMessage(
    () => publisher.parseArguments(['--file', 'relative.exe', '--version', '01.2.3']),
    /semantic version/
  );
  assertThrowsMessage(
    () => publisher.parseArguments(['--file=a.exe', '--file=b.exe', '--version=1.2.3']),
    /only be provided once/
  );
  assertThrowsMessage(
    () => publisher.parseArguments(['--file', 'relative.exe', '--version', '1.2.3', '--public-base-url', 'http://example.com']),
    /HTTPS origin/
  );

  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'desktop-r2-launcher-publish-qa-'));
  try {
    const version = '1.2.3';
    const fileName = publisher.expectedInstallerFileName(version);
    const filePath = path.join(root, fileName);
    const bytes = makePeBytes('launcher fixture');
    const sha256 = digest(bytes);
    await fsp.writeFile(filePath, bytes);

    const dry = await publisher.inspectInstaller({ filePath, version });
    assert.equal(dry.record.reviewed, false);
    assert.equal(dry.record.key, `desktop/launcher/releases/${version}/${fileName}`);
    assert.equal(dry.record.size, bytes.length);
    assert.equal(dry.record.sha256, sha256);
    assert.deepEqual(dry.record.artifact, {
      url: `https://game-assets.rihdi.tw/desktop/launcher/releases/${version}/${fileName}`,
      bytes: bytes.length,
      sha256,
      fileName
    });
    assert.equal((await publisher.publishInstaller(dry.record, dry.bytes)).status, 'verified');
    await assertRejectsMessage(
      () => publisher.publishInstaller(dry.record, dry.bytes, liveContext(new FakeS3Client())),
      /reviewed SHA-256 and byte count/i
    );

    const reviewed = await publisher.inspectInstaller({
      filePath,
      version,
      expectedSha256: sha256.toUpperCase(),
      expectedBytes: bytes.length
    });
    assert.equal(reviewed.record.reviewed, true);
    await assertRejectsMessage(
      () => publisher.inspectInstaller({ filePath, version, expectedSha256: '0'.repeat(64), expectedBytes: bytes.length }),
      /does not match --expected-sha256/
    );
    await assertRejectsMessage(
      () => publisher.inspectInstaller({ filePath, version, expectedSha256: sha256, expectedBytes: bytes.length + 1 }),
      /does not match --expected-bytes/
    );
    await assertRejectsMessage(
      () => publisher.inspectInstaller({ filePath: 'relative-installer.exe', version }),
      /explicit absolute local path/
    );

    const renamedPath = path.join(root, 'something-else.exe');
    await fsp.writeFile(renamedPath, bytes);
    await assertRejectsMessage(
      () => publisher.inspectInstaller({ filePath: renamedPath, version }),
      /file name must be/
    );
    const fakeExePath = path.join(root, publisher.expectedInstallerFileName('1.2.4'));
    await fsp.writeFile(fakeExePath, Buffer.alloc(128));
    await assertRejectsMessage(
      () => publisher.inspectInstaller({ filePath: fakeExePath, version: '1.2.4' }),
      /valid Windows PE executable/
    );

    const secretSentinel = 'DO_NOT_PRINT_THIS_R2_SECRET';
    const cli = spawnSync(process.execPath, [
      publisherPath,
      '--file', filePath,
      '--version', version,
      '--json'
    ], {
      cwd: root,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, R2_SECRET_ACCESS_KEY: secretSentinel },
      maxBuffer: 1024 * 1024
    });
    assert.equal(cli.status, 0, `Dry-run CLI failed: ${cli.stderr}`);
    assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, new RegExp(secretSentinel), 'CLI output leaked a secret.');
    const cliResult = JSON.parse(cli.stdout.trim());
    assert.equal(cliResult.mode, 'dry-run');
    assert.equal(cliResult.status, 'verified');
    assert.deepEqual(cliResult.artifact, reviewed.record.artifact);

    const existingClient = new FakeS3Client(new Map([[reviewed.record.key, exactHead(reviewed.record)]]));
    const skipped = await publisher.publishInstaller(reviewed.record, reviewed.bytes, liveContext(existingClient));
    assert.equal(skipped.status, 'skipped');
    assert.equal(existingClient.calls.filter((call) => call.operation === 'PUT').length, 0);

    const uploadClient = new FakeS3Client();
    const uploaded = await publisher.publishInstaller(reviewed.record, reviewed.bytes, liveContext(uploadClient));
    assert.equal(uploaded.status, 'uploaded');
    const put = uploadClient.calls.find((call) => call.operation === 'PUT');
    assert.ok(put, 'Missing conditional PUT.');
    assert.equal(put.input.Bucket, 'fixture-bucket');
    assert.equal(put.input.Key, reviewed.record.key);
    assert.equal(put.input.IfNoneMatch, '*');
    assert.equal(put.input.ContentLength, bytes.length);
    assert.equal(put.input.ContentType, publisher.INSTALLER_CONTENT_TYPE);
    assert.equal(put.input.CacheControl, publisher.IMMUTABLE_CACHE_CONTROL);
    assert.deepEqual(put.input.Metadata, { sha256, version });
    assert.deepEqual(put.input.Body, bytes);
    assert.equal(uploadClient.calls.filter((call) => call.operation === 'HEAD').length, 2, 'Upload must be bracketed by HEAD checks.');

    const mismatchClient = new FakeS3Client(new Map([[
      reviewed.record.key,
      { ...exactHead(reviewed.record), Metadata: { sha256: '0'.repeat(64), version } }
    ]]));
    await assertRejectsMessage(
      () => publisher.publishInstaller(reviewed.record, reviewed.bytes, liveContext(mismatchClient)),
      /refusing overwrite/i
    );
    assert.equal(mismatchClient.calls.filter((call) => call.operation === 'PUT').length, 0);

    const raceClient = new FakeS3Client(new Map(), reviewed.record.key);
    const raced = await publisher.publishInstaller(reviewed.record, reviewed.bytes, liveContext(raceClient));
    assert.equal(raced.status, 'skipped-race');
    assert.equal(raceClient.calls.filter((call) => call.operation === 'PUT').length, 1);
    assert.equal(raceClient.calls.filter((call) => call.operation === 'HEAD').length, 2);

    process.stdout.write(
      `DESKTOP_R2_LAUNCHER_PUBLISH_QA=PASS version=${version} bytes=${bytes.length} ` +
      'dryRun=PASS conditionalPut=PASS postHead=PASS noOverwrite=PASS\n'
    );
  } finally {
    const resolvedTemp = path.resolve(os.tmpdir());
    const resolvedRoot = path.resolve(root);
    const relation = path.relative(resolvedTemp, resolvedRoot);
    assert.ok(relation && relation !== '..' && !relation.startsWith(`..${path.sep}`), 'Refusing to remove a fixture outside the temp directory.');
    await fsp.rm(resolvedRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  process.stderr.write(`DESKTOP_R2_LAUNCHER_PUBLISH_QA=FAIL ${error?.stack || error}\n`);
  process.exitCode = 1;
});
