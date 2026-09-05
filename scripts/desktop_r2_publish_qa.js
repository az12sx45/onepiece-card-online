'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const publisherPath = path.resolve(__dirname, '..', 'tools', 'desktop-r2-publisher', 'publish.js');
const publisher = require(publisherPath);

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function kindTotals(assets) {
  const result = {
    image: { files: 0, bytes: 0 },
    audio: { files: 0, bytes: 0 },
    video: { files: 0, bytes: 0 },
    font: { files: 0, bytes: 0 }
  };
  for (const asset of assets) {
    result[asset.kind].files += 1;
    result[asset.kind].bytes += asset.size;
  }
  return result;
}

function makeManifest(gameId, releaseId, assets) {
  return {
    schema: 1,
    gameId,
    releaseId,
    createdAt: '2026-09-05T00:00:00.000Z',
    assetSetSha256: digest(Buffer.from(JSON.stringify(assets), 'utf8')),
    totalFiles: assets.length,
    totalBytes: assets.reduce((sum, asset) => sum + asset.size, 0),
    byKind: kindTotals(assets),
    assets
  };
}

async function writeFixtureFile(root, relativePath, bytes) {
  const target = path.join(root, ...relativePath.split('/'));
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, bytes);
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function createFixture() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'desktop-r2-publish-qa-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Desktop R2 QA']);
  git(root, ['config', 'user.email', 'desktop-r2-qa@example.invalid']);
  git(root, ['config', 'core.autocrlf', 'false']);

  const sources = {
    'audio/board.mp3': Buffer.from([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x51, 0x41]),
    'images/card.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x43, 0x41, 0x52, 0x44]),
    'images/shared.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x53, 0x48, 0x41, 0x52, 0x45, 0x44]),
    'images/vector.svg': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h1v1z"/></svg>\n', 'utf8')
  };
  for (const [relativePath, bytes] of Object.entries(sources)) {
    await writeFixtureFile(path.join(root, 'public'), relativePath, bytes);
  }

  const asset = (assetPath, kind, mime) => ({
    path: assetPath,
    kind,
    mime,
    size: sources[assetPath].length,
    sha256: digest(sources[assetPath])
  });
  const cardAssets = [
    asset('images/card.png', 'image', 'image/png'),
    asset('images/shared.png', 'image', 'image/png'),
    asset('images/vector.svg', 'image', 'image/svg+xml')
  ];
  const boardAssets = [
    asset('audio/board.mp3', 'audio', 'audio/mpeg'),
    asset('images/shared.png', 'image', 'image/png')
  ];
  const cardManifest = makeManifest('card', 'assets-card-fixture', cardAssets);
  const boardManifest = makeManifest('board', 'assets-board-fixture', boardAssets);
  const cardManifestBytes = jsonBytes(cardManifest);
  const boardManifestBytes = jsonBytes(boardManifest);
  await writeFixtureFile(root, 'public/desktop/manifests/card-fixture.json', cardManifestBytes);
  await writeFixtureFile(root, 'public/desktop/manifests/board-fixture.json', boardManifestBytes);

  const catalog = {
    schema: 1,
    createdAt: '2026-09-05T00:00:00.000Z',
    games: {
      card: {
        releaseId: cardManifest.releaseId,
        manifestPath: 'desktop/manifests/card-fixture.json',
        manifestSha256: digest(cardManifestBytes),
        totalFiles: cardManifest.totalFiles,
        totalBytes: cardManifest.totalBytes
      },
      board: {
        releaseId: boardManifest.releaseId,
        manifestPath: 'desktop/manifests/board-fixture.json',
        manifestSha256: digest(boardManifestBytes),
        totalFiles: boardManifest.totalFiles,
        totalBytes: boardManifest.totalBytes
      }
    }
  };
  await writeFixtureFile(root, 'public/desktop/catalog-v1.json', jsonBytes(catalog));
  git(root, ['add', '--', 'public']);
  git(root, ['commit', '--quiet', '-m', 'fixture']);

  return { root, sources };
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

function exactHead(record) {
  return {
    ContentLength: record.size,
    ContentType: record.mime,
    CacheControl: publisher.IMMUTABLE_CACHE_CONTROL,
    Metadata: { sha256: record.sha256 }
  };
}

function missingError() {
  const error = new Error('missing');
  error.name = 'NotFound';
  error.$metadata = { httpStatusCode: 404 };
  return error;
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
          Metadata: { sha256: command.input.Metadata.sha256 }
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
        Metadata: { sha256: command.input.Metadata.sha256 }
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

async function run() {
  const publisherSource = await fsp.readFile(publisherPath, 'utf8');
  assert.doesNotMatch(publisherSource, /DeleteObjectCommand|deleteObjects?\s*\(/i, 'Publisher must not contain an R2 delete path.');
  assert.equal(publisher.parseArguments([]).live, false, 'Dry-run must be the default.');

  const fixture = await createFixture();
  try {
    const inventory = await publisher.loadPublishInventory({ repoRoot: fixture.root });
    assert.equal(inventory.logicalFiles, 5, 'Both manifests must contribute all logical files.');
    assert.equal(inventory.uniqueFiles, 4, 'Shared SHA blobs must be deduplicated.');
    assert.equal(inventory.records.filter((record) => record.games.length === 2).length, 1, 'The shared blob must retain both game references.');
    for (const record of inventory.records) {
      assert.equal(record.key, `desktop/blobs/sha256/${record.sha256.slice(0, 2)}/${record.sha256}`);
      assert.match(record.key, /^desktop\/blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
    }

    const svgPath = path.join(fixture.root, 'public', 'images', 'vector.svg');
    await fsp.writeFile(svgPath, '<svg>dirty working tree must be ignored</svg>\n', 'utf8');
    const svgRecord = inventory.records.find((record) => record.sources.includes('images/vector.svg'));
    assert.ok(svgRecord, 'SVG record is missing.');
    const svgBytes = await publisher.createSourceReader(inventory)('images/vector.svg', svgRecord);
    assert.deepEqual(svgBytes, fixture.sources['images/vector.svg'], 'SVG publishing bytes must come from Git HEAD.');

    const networkTrap = {
      sends: 0,
      async send() {
        this.sends += 1;
        throw new Error('Dry-run attempted network access.');
      }
    };
    const dryResult = await publisher.publishInventory(inventory, {
      live: false,
      concurrency: 2,
      liveContext: liveContext(networkTrap)
    });
    assert.equal(dryResult.mode, 'dry-run');
    assert.equal(dryResult.verified, 4);
    assert.equal(dryResult.uploaded, 0);
    assert.equal(networkTrap.sends, 0, 'Dry-run must not issue an R2 request.');

    const secretSentinel = 'DO_NOT_PRINT_OR_PERSIST_THIS_SECRET';
    const cli = spawnSync(process.execPath, [publisherPath, '--repo-root', fixture.root, '--json'], {
      cwd: fixture.root,
      encoding: 'utf8',
      windowsHide: true,
      env: { ...process.env, R2_SECRET_ACCESS_KEY: secretSentinel },
      maxBuffer: 4 * 1024 * 1024
    });
    assert.equal(cli.status, 0, `Dry-run CLI failed: ${cli.stderr}`);
    assert.doesNotMatch(`${cli.stdout}\n${cli.stderr}`, new RegExp(secretSentinel), 'Dry-run output leaked a secret.');
    const cliResult = JSON.parse(cli.stdout.trim());
    assert.equal(cliResult.mode, 'dry-run');
    assert.equal(cliResult.uniqueFiles, 4);

    const first = inventory.records[0];
    const client = new FakeS3Client(new Map([[first.key, exactHead(first)]]));
    const liveResult = await publisher.publishInventory(inventory, {
      live: true,
      concurrency: 1,
      liveContext: liveContext(client)
    });
    assert.equal(liveResult.skipped, 1, 'An exact existing blob must be skipped.');
    assert.equal(liveResult.uploaded, 3, 'Missing blobs must be uploaded exactly once.');
    const puts = client.calls.filter((call) => call.operation === 'PUT');
    assert.equal(puts.length, 3);
    for (const call of puts) {
      const record = inventory.records.find((candidate) => candidate.key === call.input.Key);
      assert.ok(record, 'PUT used an unknown key.');
      assert.equal(call.input.Bucket, 'fixture-bucket');
      assert.equal(call.input.IfNoneMatch, '*', 'PUT must be conditional and immutable.');
      assert.equal(call.input.ContentLength, record.size);
      assert.equal(call.input.ContentType, record.mime);
      assert.equal(call.input.CacheControl, publisher.IMMUTABLE_CACHE_CONTROL);
      assert.deepEqual(call.input.Metadata, { sha256: record.sha256 });
      assert.ok(Buffer.isBuffer(call.input.Body));
      assert.equal(call.input.Body.length, record.size);
      assert.equal(digest(call.input.Body), record.sha256);
      const headsForKey = client.calls.filter((candidate) => candidate.operation === 'HEAD' && candidate.input.Key === record.key);
      assert.ok(headsForKey.length >= 2, 'Uploaded blobs must receive a post-upload HEAD verification.');
    }

    const mismatchClient = new FakeS3Client(new Map([[
      first.key,
      { ...exactHead(first), Metadata: { sha256: '0'.repeat(64) } }
    ]]));
    await assertRejectsMessage(
      () => publisher.publishRecord(first, publisher.createSourceReader(inventory), liveContext(mismatchClient)),
      /refusing overwrite/i
    );
    assert.equal(mismatchClient.calls.filter((call) => call.operation === 'PUT').length, 0, 'A mismatched object must never be overwritten.');

    const raceRecord = inventory.records[1];
    const raceClient = new FakeS3Client(new Map(), raceRecord.key);
    const raceResult = await publisher.publishRecord(raceRecord, publisher.createSourceReader(inventory), liveContext(raceClient));
    assert.equal(raceResult.status, 'skipped-race', 'A valid object created during PUT must be re-HEADed and skipped.');
    assert.equal(raceClient.calls.filter((call) => call.operation === 'PUT').length, 1);
    assert.equal(raceClient.calls.filter((call) => call.operation === 'HEAD').length, 2);

    const nonSvgRecord = inventory.records.find((record) => record.sources.includes('images/card.png'));
    assert.ok(nonSvgRecord, 'Non-SVG fixture record is missing.');
    await fsp.writeFile(path.join(fixture.root, 'public', 'images', 'card.png'), Buffer.from('corrupt'));
    await assertRejectsMessage(
      () => publisher.verifyRecordSources(nonSvgRecord, publisher.createSourceReader(inventory)),
      /source (?:size|SHA-256) mismatch/i
    );

    const configuration = publisher.loadLiveConfiguration({
      R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
      R2_BUCKET: 'fixture-bucket',
      R2_ACCESS_KEY_ID: 'fixture-access-key',
      R2_SECRET_ACCESS_KEY: secretSentinel
    });
    assert.equal(configuration.endpoint, 'https://0123456789abcdef0123456789abcdef.r2.cloudflarestorage.com');
    assert.equal(configuration.bucket, 'fixture-bucket');
    assert.equal(configuration.credentials.secretAccessKey, secretSentinel);

    process.stdout.write(
      `DESKTOP_R2_PUBLISH_QA=PASS logical=${inventory.logicalFiles} unique=${inventory.uniqueFiles} ` +
      `dryVerified=${dryResult.verified} uploaded=${liveResult.uploaded} skipped=${liveResult.skipped}\n`
    );
  } finally {
    const resolvedTemp = path.resolve(os.tmpdir());
    const resolvedFixture = path.resolve(fixture.root);
    const relation = path.relative(resolvedTemp, resolvedFixture);
    assert.ok(relation && relation !== '..' && !relation.startsWith(`..${path.sep}`), 'Refusing to remove a fixture outside the temp directory.');
    await fsp.rm(resolvedFixture, { recursive: true, force: true });
  }
}

run().catch((error) => {
  process.stderr.write(`DESKTOP_R2_PUBLISH_QA=FAIL ${error?.stack || error}\n`);
  process.exitCode = 1;
});
