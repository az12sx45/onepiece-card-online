'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { safePackagePath, sha256Bytes } = require('../desktop/asset-store');
const { PROGRAM_FILES, MAX_ASSET_BYTES, MAX_INLINE_MEDIA_BYTES, validateMarinefordAssets } = require('../desktop/marineford-release');
const { RuntimeAssetCache } = require('../desktop/runtime-asset-cache');
const { HttpsProgramRuntime } = require('../desktop/program-runtime');

async function main() {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'marineford-media-qa-'));
  const origin = 'https://onepiece-card-online.onrender.com';
  const files = new Map();
  function asset(logical, bytes) {
    const file = path.join(temporary, String(files.size));
    fs.writeFileSync(file, bytes);
    files.set(logical, { file, bytes });
    return { ...safePackagePath(logical), size: bytes.length, sha256: sha256Bytes(bytes) };
  }
  try {
    const assets = PROGRAM_FILES.map(logical => asset(logical, Buffer.from(logical)));
    const media = [
      ['tone.wav', 'marineford/audio/tone.wav'],
      ['blue.mp4', 'marineford/video/blue.mp4'],
      ['blue.webm', 'marineford/videos/blue.webm'],
      ['fixture.woff', 'marineford/fonts/fixture.woff']
    ].map(([name, logical]) => asset(logical, fs.readFileSync(path.join(__dirname, 'fixtures/desktop-marineford-media', name))));
    assets.push(...media);
    assert.equal(validateMarinefordAssets(assets), assets);
    assert.throws(() => validateMarinefordAssets([...assets, { ...media[0], path: 'audio/unscoped.wav' }]));
    assert.throws(() => validateMarinefordAssets([...assets, { ...media[0], path: 'marineford/art/tone.wav' }]));
    assert.throws(() => validateMarinefordAssets([...assets, { ...media[0], mime: 'application/octet-stream' }]));
    assert.throws(() => validateMarinefordAssets([...assets, { ...assets[0], path: 'marineford/extra.json' }]));
    assert.throws(() => validateMarinefordAssets([...assets, { ...media[0], size: MAX_ASSET_BYTES + 1 }]));
    const twoMaximum = [0, 1].map(index => ({ ...media[0], path: `marineford/audio/max-${index}.wav`, size: MAX_ASSET_BYTES }));
    assert.equal(MAX_INLINE_MEDIA_BYTES, MAX_ASSET_BYTES * 2);
    validateMarinefordAssets([...assets.slice(0, PROGRAM_FILES.length), ...twoMaximum]);
    assert.throws(() => validateMarinefordAssets([...assets.slice(0, PROGRAM_FILES.length), ...twoMaximum,
      { ...media[0], path: 'marineford/audio/one-more.wav', size: 1 }]));
    const cache = new RuntimeAssetCache({ maxEntryBytes: 512, maxBytes: 2048 });
    cache.buildGame('marineford', { assets }, { filePathForAsset: row => files.get(row.path).file });
    let networkReads = 0;
    let repairChecks = 0;
    const runtime = new HttpsProgramRuntime({ gameId: 'marineford', origin, assetCache: cache,
      verifyAsset: async entry => {
        try { return sha256Bytes(fs.readFileSync(entry.filePath)) === entry.sha256; } catch { return false; }
      },
      onFailure: () => { repairChecks += 1; },
      networkFetch: async () => { networkReads += 1; return new Response('unexpected-network', { status: 502 }); } });
    runtime.authorize({ enabled: true, gameId: 'marineford', releaseId: 'package-' + '1'.repeat(16),
      manifestSha256: '2'.repeat(64), entryPath: 'marineford/index.html' });
    for (const row of media) {
      const response = await runtime.handle(new Request(origin + '/' + row.path));
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('Content-Type'), row.mime);
      assert.equal(response.headers.get('X-OnePiece-Desktop-Program'), 'hit');
      assert.equal(sha256Bytes(Buffer.from(await response.arrayBuffer())), row.sha256);
      const head = await runtime.handle(new Request(origin + '/' + row.path, { method: 'HEAD' }));
      assert.equal(head.status, 200);
      assert.equal(Number(head.headers.get('Content-Length')), row.size);
      assert.equal((await head.arrayBuffer()).byteLength, 0);
      const range = await runtime.handle(new Request(origin + '/' + row.path, { headers: { Range: 'bytes=0-31' } }));
      assert.equal(range.status, 206);
      assert.equal(range.headers.get('Content-Range'), `bytes 0-31/${row.size}`);
      assert.deepEqual(Buffer.from(await range.arrayBuffer()), files.get(row.path).bytes.subarray(0, 32));
    }
    assert.equal(networkReads, 0);
    assert.equal((await runtime.handle(new Request(origin + '/marineford/new-program.js'))).status, 404);
    assert.equal((await runtime.handle(new Request(origin + '/images/unknown.webp'))).status, 404);
    assert.equal((await runtime.handle(new Request('https://game-assets.rihdi.tw/desktop/blobs/sha256/ab/' + 'ab'.repeat(32)))).status, 403);
    assert.equal((await runtime.handle(new Request('https://cdn.example.test/image.webp'))).status, 403);
    assert.equal((await runtime.handle(new Request('http://cdn.example.test/media'))).status, 403);
    assert.equal((await runtime.handle(new Request(origin + '/marineford/art/%2e%2e%2funknown.js'))).status, 503);
    assert.equal((await runtime.handle(new Request(origin + '/' + media[0].path, { method: 'POST' }))).status, 405);
    const invalidRange = await runtime.handle(new Request(origin + '/' + media[0].path, { headers: { Range: 'bytes=999999-' } }));
    assert.equal(invalidRange.status, 416);
    fs.writeFileSync(files.get(media[0].path).file, Buffer.alloc(media[0].size));
    assert.equal((await runtime.handle(new Request(origin + '/' + media[0].path))).status, 503);
    fs.unlinkSync(files.get(media[1].path).file);
    assert.equal((await runtime.handle(new Request(origin + '/' + media[1].path))).status, 503);
    assert.equal(repairChecks, 2);
    assert.equal(networkReads, 0);
    runtime.disable('proof-unavailable');
    assert.equal((await runtime.handle(new Request(origin + '/marineford/index.html'))).status, 503);
    await runtime.handle(new Request(origin + '/api/profile.json'));
    await runtime.handle(new Request(origin + '/socket.io/?EIO=4'));
    assert.equal(networkReads, 2);
    console.log('DESKTOP_MARINEFORD_MEDIA_QA=PASS audio=WAV video=MP4,WebM font=WOFF mime=PASS fullSha=PASS head=PASS range=PASS staticNetwork=0 corruptMissingClosed=PASS unknownProgramClosed=PASS apiSocket=network fixedPrograms=PASS scopes=PASS limits=32MiB,64MiB');
  } finally {
    assert.equal(path.dirname(temporary), path.resolve(os.tmpdir()));
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
