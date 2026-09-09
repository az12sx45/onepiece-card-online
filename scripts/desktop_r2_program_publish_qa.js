'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');

const publisherPath = path.resolve(__dirname, '..', 'tools', 'desktop-r2-publisher', 'publish.js');
const publisher = require(publisherPath);
const CREATED_AT = '2026-09-07T00:00:00.000Z';
const KINDS = ['document', 'style', 'script', 'data', 'wasm', 'image', 'audio', 'video', 'font'];

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function git(root, args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

async function writeFile(root, relativePath, bytes) {
  const target = path.join(root, ...relativePath.split('/'));
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, bytes);
}

function byKind(assets) {
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, { files: 0, bytes: 0 }]));
  for (const asset of assets) {
    totals[asset.kind].files += 1;
    totals[asset.kind].bytes += asset.size;
  }
  return totals;
}

function makeManifest(gameId, entryPath, assets) {
  const sorted = [...assets].sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const assetSetSha256 = digest(Buffer.from(JSON.stringify(sorted), 'utf8'));
  return {
    schema: 3,
    gameId,
    releaseId: `package-${assetSetSha256.slice(0, 16)}`,
    createdAt: CREATED_AT,
    entryPath,
    assetSetSha256,
    totalFiles: sorted.length,
    totalBytes: sorted.reduce((sum, asset) => sum + asset.size, 0),
    byKind: byKind(sorted),
    assets: sorted
  };
}

function makeAsset(assetPath, kind, mime, bytes) {
  return { path: assetPath, kind, mime, size: bytes.length, sha256: digest(bytes) };
}

async function createFixture() {
  const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'desktop-r2-program-publish-qa-'));
  git(root, ['init', '--quiet']);
  git(root, ['config', 'user.name', 'Desktop Program Publisher QA']);
  git(root, ['config', 'user.email', 'desktop-program-publisher@example.invalid']);
  git(root, ['config', 'core.autocrlf', 'false']);

  const sources = {
    'css/card.css': Buffer.from('body{color:#fff}\n', 'utf8'),
    'images/card.png': Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x43, 0x41, 0x52, 0x44]),
    'start.html': Buffer.from('<!doctype html><link rel="stylesheet" href="css/card.css">\n', 'utf8'),
    'audio/board.mp3': Buffer.from([0x49, 0x44, 0x33, 0x42, 0x4f, 0x41, 0x52, 0x44]),
    'board_start.html': Buffer.from('<!doctype html><script src="js/board.js"></script>\n', 'utf8'),
    'js/board.js': Buffer.from('globalThis.BOARD_QA=true;\n', 'utf8'),
    'chess/battle.js': Buffer.from('globalThis.CHESS_QA=true;\n', 'utf8'),
    'chess/index.html': Buffer.from('<!doctype html><script src="battle.js"></script>\n', 'utf8')
  };
  for (const [relativePath, bytes] of Object.entries(sources)) await writeFile(path.join(root, 'public'), relativePath, bytes);

  const chessSourceRoot = path.join(root, 'external-chess-assets');
  const chessBytes = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x43, 0x48, 0x45, 0x53, 0x53]);
  await writeFile(chessSourceRoot, 'pieces/king.webp', chessBytes);

  const cardManifest = makeManifest('card', 'start.html', [
    makeAsset('css/card.css', 'style', 'text/css', sources['css/card.css']),
    makeAsset('images/card.png', 'image', 'image/png', sources['images/card.png']),
    makeAsset('start.html', 'document', 'text/html', sources['start.html'])
  ]);
  const boardManifest = makeManifest('board', 'board_start.html', [
    makeAsset('audio/board.mp3', 'audio', 'audio/mpeg', sources['audio/board.mp3']),
    makeAsset('board_start.html', 'document', 'text/html', sources['board_start.html']),
    makeAsset('js/board.js', 'script', 'text/javascript', sources['js/board.js'])
  ]);
  const chessManifest = makeManifest('chess', 'chess/index.html', [
    makeAsset('chess/battle.js', 'script', 'text/javascript', sources['chess/battle.js']),
    makeAsset('chess/index.html', 'document', 'text/html', sources['chess/index.html']),
    makeAsset('images/chess/assets/pieces/king.webp', 'image', 'image/webp', chessBytes)
  ]);

  const manifestByGame = { card: cardManifest, board: boardManifest, chess: chessManifest };
  const games = {};
  for (const [gameId, manifest] of Object.entries(manifestByGame)) {
    const manifestBytes = jsonBytes(manifest);
    const manifestPath = `desktop/manifests/${gameId}-${manifest.releaseId}.json`;
    await writeFile(path.join(root, 'public'), manifestPath, manifestBytes);
    games[gameId] = {
      releaseId: manifest.releaseId,
      manifestPath,
      manifestSha256: digest(manifestBytes),
      entryPath: manifest.entryPath,
      totalFiles: manifest.totalFiles,
      totalBytes: manifest.totalBytes
    };
  }
  const catalog = {
    schema: 3,
    createdAt: CREATED_AT,
    assetBlobBaseUrl: 'https://game-assets.rihdi.tw/desktop/blobs/sha256',
    sourceTrees: {
      images: '1'.repeat(40),
      audio: '2'.repeat(40),
      videos: '3'.repeat(40),
      fonts: '4'.repeat(40)
    },
    games
  };
  await writeFile(root, 'public/desktop/catalog-v3.json', jsonBytes(catalog));
  git(root, ['add', '--', 'public']);
  git(root, ['commit', '--quiet', '-m', 'schema3 fixture']);
  return { root, sources, chessSourceRoot, chessBytes };
}

class FakeHeadObjectCommand { constructor(input) { this.input = input; } }
class FakePutObjectCommand { constructor(input) { this.input = input; } }

function notFound() {
  const error = new Error('missing');
  error.name = 'NotFound';
  error.$metadata = { httpStatusCode: 404 };
  return error;
}

class FakeS3Client {
  constructor() {
    this.objects = new Map();
    this.calls = [];
  }

  async send(command) {
    if (command instanceof FakeHeadObjectCommand) {
      this.calls.push({ operation: 'HEAD', input: command.input });
      const object = this.objects.get(command.input.Key);
      if (!object) throw notFound();
      return object;
    }
    if (command instanceof FakePutObjectCommand) {
      this.calls.push({ operation: 'PUT', input: command.input });
      assert.equal(command.input.IfNoneMatch, '*', 'Program publishing must be immutable.');
      assert.ok(!this.objects.has(command.input.Key), 'Fixture publisher attempted to overwrite an immutable key.');
      this.objects.set(command.input.Key, {
        ContentLength: command.input.ContentLength,
        ContentType: command.input.ContentType,
        CacheControl: command.input.CacheControl,
        Metadata: command.input.Metadata
      });
      return { ETag: '"program-fixture"' };
    }
    throw new Error('Unexpected fake S3 command.');
  }
}

function fakeContext(client) {
  return {
    client,
    bucket: 'fixture-bucket',
    HeadObjectCommand: FakeHeadObjectCommand,
    PutObjectCommand: FakePutObjectCommand
  };
}

class RacingS3Client extends FakeS3Client {
  constructor(racedHead) {
    super();
    this.racedHead = racedHead;
  }

  async send(command) {
    if (command instanceof FakePutObjectCommand) {
      this.calls.push({ operation: 'PUT', input: command.input });
      assert.equal(command.input.IfNoneMatch, '*');
      assert.ok(!this.objects.has(command.input.Key));
      this.objects.set(command.input.Key, this.racedHead);
      const error = new Error('Another publisher created this key.');
      error.name = 'PreconditionFailed';
      error.$metadata = { httpStatusCode: 412 };
      throw error;
    }
    return super.send(command);
  }
}

async function expectReject(action, pattern) {
  let error = null;
  try { await action(); } catch (caught) { error = caught; }
  assert.ok(error, 'Expected operation to reject.');
  assert.match(String(error.message || error), pattern);
}

async function main() {
  const publisherSource = await fsp.readFile(publisherPath, 'utf8');
  assert.doesNotMatch(publisherSource, /DeleteObjectCommand|deleteObjects?\s*\(/i, 'Publisher must never delete R2 objects.');
  assert.equal(publisher.parseArguments([]).live, false, 'Dry-run must remain the default.');
  assert.equal(publisher.parseArguments([]).catalogVersion, 2, 'Legacy catalog-v2 flow must remain the default.');
  assert.equal(publisher.parseArguments(['--catalog-version', '3']).catalogVersion, 3);

  const fixture = await createFixture();
  try {
    const inventory = await publisher.loadPublishInventory({ repoRoot: fixture.root, catalogVersion: 3 });
    assert.equal(inventory.catalogSchema, 3);
    assert.equal(inventory.catalogPath, 'public/desktop/catalog-v3.json');
    assert.equal(inventory.logicalFiles, 9);
    assert.equal(inventory.uniqueFiles, 9);
    assert.deepEqual(inventory.manifests.card.entryPath, 'start.html');
    const originalRecords = JSON.stringify(inventory.records);
    for (const record of inventory.records) {
      assert.match(record.key, /^desktop\/blobs\/sha256\/[a-f0-9]{2}\/[a-f0-9]{64}$/);
    }

    for (const relativePath of Object.keys(fixture.sources)) {
      await fsp.writeFile(path.join(fixture.root, 'public', ...relativePath.split('/')), Buffer.from(`dirty:${relativePath}\n`, 'utf8'));
    }
    const reader = publisher.createSourceReader(inventory, { chessSourceRoot: fixture.chessSourceRoot });
    for (const [relativePath, committedBytes] of Object.entries(fixture.sources)) {
      const record = inventory.records.find((item) => item.sources.includes(relativePath));
      assert.ok(record, `Missing fixture record ${relativePath}`);
      assert.deepEqual(await reader(relativePath, record), committedBytes, `Schema3 source did not use Git HEAD: ${relativePath}`);
    }
    const chessRecord = inventory.records.find((item) => item.sources.includes('images/chess/assets/pieces/king.webp'));
    assert.deepEqual(await reader(chessRecord.sources[0], chessRecord), fixture.chessBytes);

    const networkTrap = { async send() { throw new Error('Dry-run touched the network.'); } };
    const dryResult = await publisher.publishInventory(inventory, {
      live: false,
      concurrency: 3,
      chessSourceRoot: fixture.chessSourceRoot,
      liveContext: {
        client: networkTrap,
        bucket: 'fixture',
        HeadObjectCommand: FakeHeadObjectCommand,
        PutObjectCommand: FakePutObjectCommand
      }
    });
    assert.equal(dryResult.mode, 'dry-run');
    assert.equal(dryResult.verified, 9);

    const cli = spawnSync(process.execPath, [
      publisherPath,
      '--catalog-version', '3',
      '--repo-root', fixture.root,
      '--chess-source', fixture.chessSourceRoot,
      '--json'
    ], { cwd: fixture.root, encoding: 'utf8', windowsHide: true, maxBuffer: 4 * 1024 * 1024 });
    assert.equal(cli.status, 0, `Schema3 dry-run CLI failed: ${cli.stderr}`);
    assert.equal(JSON.parse(cli.stdout.trim()).verified, 9);

    const fakeClient = new FakeS3Client();
    const liveResult = await publisher.publishInventory(inventory, {
      live: true,
      concurrency: 2,
      chessSourceRoot: fixture.chessSourceRoot,
      liveContext: {
        client: fakeClient,
        bucket: 'fixture-bucket',
        HeadObjectCommand: FakeHeadObjectCommand,
        PutObjectCommand: FakePutObjectCommand
      }
    });
    assert.equal(liveResult.uploaded, 9);
    assert.equal(fakeClient.calls.filter((call) => call.operation === 'PUT').length, 9);
    for (const call of fakeClient.calls.filter((item) => item.operation === 'PUT')) {
      const record = inventory.records.find((item) => item.key === call.input.Key);
      assert.equal(call.input.IfNoneMatch, '*');
      assert.equal(digest(call.input.Body), call.input.Metadata.sha256);
      assert.equal(call.input.Key, publisher.objectKeyForSha256(call.input.Metadata.sha256));
      if (record.kind === 'document') {
        assert.equal(record.mime, 'text/html', 'Manifest execution MIME must remain HTML.');
        assert.equal(call.input.ContentType, 'application/octet-stream', 'New HTML blobs must bypass CDN page rewriting.');
        assert.equal(call.input.CacheControl, 'public, max-age=31536000, immutable, no-transform');
      } else {
        assert.equal(call.input.ContentType, record.mime, 'Non-document transport MIME must not change.');
        assert.equal(call.input.CacheControl, publisher.IMMUTABLE_CACHE_CONTROL);
      }
    }
    assert.equal(JSON.stringify(inventory.records), originalRecords, 'Publishing must not mutate manifest metadata.');

    const documentRecord = inventory.records.find((record) => record.sources.includes('board_start.html'));
    const currentHead = fakeClient.objects.get(documentRecord.key);
    const legacyHead = {
      ...currentHead,
      ContentType: 'text/html',
      CacheControl: publisher.IMMUTABLE_CACHE_CONTROL
    };
    const currentAgain = await publisher.publishRecord(documentRecord, reader, fakeContext(fakeClient));
    assert.equal(currentAgain.status, 'skipped');
    assert.equal(fakeClient.calls.filter((call) => call.operation === 'PUT').length, 9, 'New-profile immutable keys must be skipped.');
    const legacyClient = new FakeS3Client();
    legacyClient.objects.set(documentRecord.key, legacyHead);
    const legacyAgain = await publisher.publishRecord(documentRecord, reader, fakeContext(legacyClient));
    assert.equal(legacyAgain.status, 'skipped');
    assert.equal(legacyClient.calls.filter((call) => call.operation === 'PUT').length, 0, 'Legacy document metadata must not be overwritten.');
    assert.equal(legacyClient.objects.get(documentRecord.key), legacyHead);

    const invalidHeads = [
      { ...currentHead, ContentType: 'text/html' },
      { ...currentHead, CacheControl: publisher.IMMUTABLE_CACHE_CONTROL },
      { ...currentHead, ContentType: 'application/x-unknown' },
      { ...currentHead, CacheControl: 'public, max-age=60' },
      { ...currentHead, ContentLength: documentRecord.size + 1 },
      { ...currentHead, Metadata: { sha256: '0'.repeat(64) } },
      { ...legacyHead, ContentLength: documentRecord.size + 1 },
      { ...legacyHead, Metadata: { sha256: '0'.repeat(64) } }
    ];
    for (const head of invalidHeads) {
      const invalidClient = new FakeS3Client();
      invalidClient.objects.set(documentRecord.key, head);
      await expectReject(
        () => publisher.publishRecord(documentRecord, reader, fakeContext(invalidClient)),
        /mismatched metadata; refusing overwrite/i
      );
      assert.equal(invalidClient.calls.filter((call) => call.operation === 'PUT').length, 0);
      assert.equal(invalidClient.objects.get(documentRecord.key), head);
    }

    const scriptRecord = inventory.records.find((record) => record.kind === 'script');
    const invalidScriptClient = new FakeS3Client();
    invalidScriptClient.objects.set(scriptRecord.key, {
      ...fakeClient.objects.get(scriptRecord.key),
      ContentType: 'application/octet-stream',
      CacheControl: 'public, max-age=31536000, immutable, no-transform'
    });
    await expectReject(
      () => publisher.publishRecord(scriptRecord, reader, fakeContext(invalidScriptClient)),
      /mismatched metadata; refusing overwrite/i
    );
    assert.equal(invalidScriptClient.calls.filter((call) => call.operation === 'PUT').length, 0);

    for (const head of [currentHead, legacyHead]) {
      const raceClient = new RacingS3Client(head);
      const raceResult = await publisher.publishRecord(documentRecord, reader, fakeContext(raceClient));
      assert.equal(raceResult.status, 'skipped-race');
      assert.equal(raceClient.calls.filter((call) => call.operation === 'PUT').length, 1);
      assert.equal(raceClient.objects.get(documentRecord.key), head);
    }
    const invalidRaceHead = { ...currentHead, Metadata: { sha256: '0'.repeat(64) } };
    const invalidRaceClient = new RacingS3Client(invalidRaceHead);
    await expectReject(
      () => publisher.publishRecord(documentRecord, reader, fakeContext(invalidRaceClient)),
      /mismatched metadata; refusing overwrite/i
    );
    assert.equal(invalidRaceClient.calls.filter((call) => call.operation === 'PUT').length, 1);
    assert.equal(invalidRaceClient.objects.get(documentRecord.key), invalidRaceHead);

    const catalogPath = path.join(fixture.root, 'public', 'desktop', 'catalog-v3.json');
    const originalCatalog = await fsp.readFile(catalogPath);
    const tampered = JSON.parse(originalCatalog.toString('utf8'));
    tampered.games.card.manifestSha256 = '0'.repeat(64);
    await fsp.writeFile(catalogPath, jsonBytes(tampered));
    await expectReject(
      () => publisher.loadPublishInventory({ repoRoot: fixture.root, catalogVersion: 3 }),
      /manifest bytes do not match/i
    );

    process.stdout.write(
      `DESKTOP_R2_PROGRAM_PUBLISH_QA=PASS logical=${inventory.logicalFiles} unique=${inventory.uniqueFiles} ` +
      `dryVerified=${dryResult.verified} uploaded=${liveResult.uploaded} gitHeadOnly=PASS immutable=PASS ` +
      `documentTransport=PASS legacyDocument=PASS metadataReject=PASS race=PASS manifestMime=PASS legacyDefault=v2\n`
    );
  } finally {
    const tempRoot = path.resolve(os.tmpdir());
    const fixtureRoot = path.resolve(fixture.root);
    const relation = path.relative(tempRoot, fixtureRoot);
    assert.ok(relation && relation !== '..' && !relation.startsWith(`..${path.sep}`), 'Refusing fixture cleanup outside temp.');
    await fsp.rm(fixtureRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_R2_PROGRAM_PUBLISH_QA=FAIL ${String(error?.stack || error)}\n`);
  process.exitCode = 1;
});
