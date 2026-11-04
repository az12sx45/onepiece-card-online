'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { AssetStore, blobPath } = require('../desktop/asset-store');

const origin = 'https://launcher.example.test';
const manifestUrl = `${origin}/desktop/marineford-media-v1.json`;
const blobBase = 'https://game-assets.rihdi.tw/desktop/blobs/sha256';
const bytesByHash = new Map();
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blobUrl = hash => `${blobBase}/${hash.slice(0, 2)}/${hash}`;

function asset(assetPath, value) {
  const bytes = Buffer.from(value);
  const hash = sha256(bytes);
  bytesByHash.set(hash, bytes);
  return { path: assetPath, kind: 'image', mime: 'image/webp', size: bytes.length, sha256: hash };
}

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'marineford-desktop-qa-'));
  const background = asset('marineford/art/v2/field.webp', 'field v1');
  const card = asset('marineford/art/card.webp', 'card v1');
  const effect = asset('marineford/art/v2/effect.webp', 'effect v1');
  const cover = asset('images/game_launcher/launcher_marineford_cover_v2.webp', 'cover is launcher-only');
  const newerCard = asset(card.path, 'card v2');
  let assets = [background, card, effect, cover];
  let manifestStatus = 200;
  let requests = [];
  const fetchImpl = async (url, options) => {
    if (url === manifestUrl) {
      assert.equal(options.cache, 'no-store');
      assert.equal(options.redirect, 'error');
      return Response.json({ schema: 1, gameId: 'marineford', assets }, { status: manifestStatus });
    }
    requests.push(url);
    const hash = url.split('/').at(-1);
    const bytes = bytesByHash.get(hash);
    assert.equal(url, blobUrl(hash));
    assert(bytes, url);
    return new Response(bytes, { headers: { 'Content-Length': String(bytes.length) } });
  };
  const openStore = async () => {
    const store = new AssetStore({
      origin,
      cacheRoot: root,
      bundledCatalogRoot: path.join(__dirname, '..', 'public', 'desktop'),
      fetchImpl,
      integrityAuditMaxFiles: 0
    });
    await store.init();
    return store;
  };
  const prepare = async (expected, downloads) => {
    requests = [];
    const store = await openStore();
    const prepared = await store.prepareMarinefordMedia();
    assert.deepEqual(prepared.assets, expected);
    assert.deepEqual(requests.sort(), downloads.map(asset => blobUrl(asset.sha256)).sort());
    for (const asset of expected) {
      const bytes = await fs.readFile(blobPath(root, asset.sha256));
      assert.equal(sha256(bytes), asset.sha256);
    }
    assert.equal((await store.getState()).games.marineford.status, 'installed');
    return store;
  };
  try {
    await prepare([background, card, effect], [background, card, effect]);
    await prepare([background, card, effect], []);
    await assert.rejects(fs.access(blobPath(root, cover.sha256)), { code: 'ENOENT' });

    const damagedPath = blobPath(root, card.sha256);
    const oldStat = await fs.stat(damagedPath);
    await fs.writeFile(damagedPath, Buffer.alloc(card.size, 0x7f));
    await fs.utimes(damagedPath, oldStat.atime, oldStat.mtime);
    await fs.unlink(blobPath(root, effect.sha256));
    await prepare([background, card, effect], [card, effect]);

    assets = [background, newerCard, effect, cover];
    const updated = await prepare([background, newerCard, effect], [newerCard]);
    await updated.cleanupUnusedCache();
    await prepare([background, newerCard, effect], []);

    requests = [];
    const store = await openStore();
    assets = [background, { ...newerCard, path: 'marineford/index.html' }, effect];
    await assert.rejects(store.prepareMarinefordMedia(), /無效檔案/);
    assert.deepEqual(requests, []);
    manifestStatus = 503;
    await assert.rejects(store.prepareMarinefordMedia(), /無法取得/);
    assert.deepEqual(requests, []);
    manifestStatus = 200;
    assets = [background, newerCard, effect, cover];
    await prepare([background, newerCard, effect], []);
    console.log('DESKTOP_MARINEFORD_LOCAL_MEDIA_QA=PASS cold=3 warmRestart=0 repair=2 changedHash=1 cleanupRetention=PASS scope=PASS unavailable=PASS');
  } finally {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    await fs.rm(root, { recursive: true, force: true });
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
