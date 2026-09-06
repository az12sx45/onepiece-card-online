'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const { safeAssetPath, validateManifest } = require('../desktop/asset-store.js');
const { RuntimeAssetCache } = require('../desktop/runtime-asset-cache.js');
const { depthFromSource } = require('../public/js/card_finish_v1.js');

const ROOT = path.resolve(__dirname, '..');
const BASELINE = '40929bcade833267f48599135f9fdd29215f53d5';
const SOURCE_ROOT = path.join(ROOT, 'public', 'card-depth', 'v1');
const ALIAS_ROOT = path.join(ROOT, 'public', 'images', 'card-depth', 'v1');
const CATALOG_PATH = path.join(ROOT, 'public', 'desktop', 'catalog-v1.json');
const MAIN_PATH = path.join(ROOT, 'desktop', 'main.js');
const VARIANTS = ['enh', 'lux-enh', 'lux', 'normal'];
const ROLES = ['background', 'foreground', 'subject'];
const EXPECTED_FILES = 240;
const EXPECTED_LOGICAL_BYTES = 13_632_032;
const EXPECTED_UNIQUE_BLOBS = 211;
const EXPECTED_UNIQUE_BYTES = 13_479_592;

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function readCanonicalJson(filePath) {
  const text = fs.readFileSync(filePath, 'utf8');
  const value = JSON.parse(text);
  assert.equal(text, canonicalJson(value), `${filePath} must be canonical JSON`);
  return value;
}

function gitShowJson(spec) {
  return JSON.parse(execFileSync('git', ['show', spec], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  }));
}

function expectedRelativePaths() {
  const paths = [];
  for (const variant of VARIANTS) {
    for (let id = 0; id < 20; id += 1) {
      for (const role of ROLES) paths.push(`${variant}/${id}/${role}.webp`);
    }
  }
  return paths.sort();
}

function actualRelativePaths(root) {
  const paths = [];
  function walk(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(absolute);
      else if (entry.isFile()) paths.push(path.relative(root, absolute).split(path.sep).join('/'));
      else assert.fail(`Unexpected non-file depth entry: ${absolute}`);
    }
  }
  walk(root);
  return paths.sort();
}

function manifestFromCatalog(catalog, gameId) {
  const record = catalog.games[gameId];
  const manifestPath = path.resolve(ROOT, 'public', ...record.manifestPath.split('/'));
  const text = fs.readFileSync(manifestPath, 'utf8');
  assert.equal(sha256(Buffer.from(text, 'utf8')), record.manifestSha256, `${gameId} manifest digest must match catalog`);
  const manifest = JSON.parse(text);
  validateManifest(manifest, gameId);
  return manifest;
}

function main() {
  const expected = expectedRelativePaths();
  assert.deepEqual(actualRelativePaths(SOURCE_ROOT), expected, 'Canonical depth tree must contain the exact 80 x 3 inventory');
  assert.deepEqual(actualRelativePaths(ALIAS_ROOT), expected, 'Desktop image alias tree must contain the exact 80 x 3 inventory');

  const aliases = [];
  for (const relative of expected) {
    const sourceBytes = fs.readFileSync(path.join(SOURCE_ROOT, ...relative.split('/')));
    const aliasBytes = fs.readFileSync(path.join(ALIAS_ROOT, ...relative.split('/')));
    assert.deepEqual(aliasBytes, sourceBytes, `Desktop alias must be byte-identical: ${relative}`);
    const assetPath = `images/card-depth/v1/${relative}`;
    assert.equal(safeAssetPath(assetPath)?.path, assetPath, `Asset store must accept ${assetPath}`);
    aliases.push({ path: assetPath, size: aliasBytes.length, sha256: sha256(aliasBytes) });
  }
  assert.equal(aliases.length, EXPECTED_FILES);
  assert.equal(aliases.reduce((sum, asset) => sum + asset.size, 0), EXPECTED_LOGICAL_BYTES);

  const uniqueAliases = new Map();
  for (const asset of aliases) {
    if (!uniqueAliases.has(asset.sha256)) uniqueAliases.set(asset.sha256, asset.size);
    else assert.equal(uniqueAliases.get(asset.sha256), asset.size, 'Duplicate digest must keep one byte size');
  }
  assert.equal(uniqueAliases.size, EXPECTED_UNIQUE_BLOBS);
  assert.equal([...uniqueAliases.values()].reduce((sum, size) => sum + size, 0), EXPECTED_UNIQUE_BYTES);

  const catalog = readCanonicalJson(CATALOG_PATH);
  const cardManifest = manifestFromCatalog(catalog, 'card');
  const boardManifest = manifestFromCatalog(catalog, 'board');
  const cardAliases = cardManifest.assets.filter((asset) => asset.path.startsWith('images/card-depth/v1/'));
  const boardAliases = boardManifest.assets.filter((asset) => asset.path.startsWith('images/card-depth/v1/'));
  assert.deepEqual(cardAliases.map((asset) => asset.path), aliases.map((asset) => asset.path), 'Card manifest must include every depth alias in order');
  for (let index = 0; index < aliases.length; index += 1) {
    assert.equal(cardAliases[index].size, aliases[index].size, `Card manifest size must match ${aliases[index].path}`);
    assert.equal(cardAliases[index].sha256, aliases[index].sha256, `Card manifest digest must match ${aliases[index].path}`);
    assert.equal(cardAliases[index].kind, 'image', `Card manifest kind must be image: ${aliases[index].path}`);
    assert.equal(cardAliases[index].mime, 'image/webp', `Card manifest MIME must be WebP: ${aliases[index].path}`);
  }
  assert.equal(boardAliases.length, 0, 'Board manifest must not receive Card-only depth aliases');

  const baselineCatalog = gitShowJson(`${BASELINE}:public/desktop/catalog-v1.json`);
  const baselineCard = gitShowJson(`${BASELINE}:public/${baselineCatalog.games.card.manifestPath}`);
  const baselineBoardText = execFileSync('git', ['show', `${BASELINE}:public/${baselineCatalog.games.board.manifestPath}`], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const baselineHashes = new Set(baselineCard.assets.map((asset) => asset.sha256));
  assert.equal([...uniqueAliases.keys()].filter((digest) => baselineHashes.has(digest)).length, 0, 'Depth aliases are new CAS bytes for the previous Card package');
  assert.equal(cardManifest.totalFiles - baselineCard.totalFiles, EXPECTED_FILES, 'Card package file delta must equal the aliases');
  assert.equal(cardManifest.totalBytes - baselineCard.totalBytes, EXPECTED_LOGICAL_BYTES, 'Card package byte delta must equal the aliases');
  assert.deepEqual(catalog.games.board, baselineCatalog.games.board, 'Board catalog entry must remain byte-for-byte equivalent');
  assert.equal(fs.readFileSync(path.resolve(ROOT, 'public', ...catalog.games.board.manifestPath.split('/')), 'utf8'), baselineBoardText, 'Board immutable manifest must remain unchanged');

  const runtimeCache = new RuntimeAssetCache();
  runtimeCache.buildGame('card', cardManifest, { filePathForAsset: (asset) => path.join('C:\\unused-cas-fixture', asset.sha256) });
  for (const alias of aliases) {
    const entry = runtimeCache.lookupPath('card', alias.path);
    assert.equal(entry?.sha256, alias.sha256, `Runtime cache must route ${alias.path}`);
  }
  assert.equal(runtimeCache.lookupPath('board', aliases[0].path), null, 'Card aliases must not leak into a Board route map');

  const baseUri = 'https://onepiece-card-online.onrender.com/game.html';
  const sourceCases = [
    ['/images/cards/3.webp', 'normal/3'],
    ['/images/cards/enh/3.webp', 'enh/3'],
    ['/images/cards_lux/3.webp', 'lux/3'],
    ['/images/cards_lux/enh/3.webp', 'lux-enh/3']
  ];
  for (const [source, key] of sourceCases) {
    const depth = depthFromSource(source, baseUri);
    assert.ok(depth, `Runtime must recognise ${source}`);
    for (const role of ['background', 'subject', 'foreground']) {
      assert.equal(depth[role], `/images/card-depth/v1/${key}/${role}.webp`, `Runtime ${role} URL must use the launcher-cached image root`);
    }
  }

  const mainSource = fs.readFileSync(MAIN_PATH, 'utf8');
  assert.match(mainSource, /\$\{REMOTE_ORIGIN\}\/images\/\*/, 'Electron request filter must continue intercepting the image root');

  console.log(
    `DESKTOP_CARD_DEPTH_BUNDLE_QA=PASS aliases=${aliases.length} logicalBytes=${EXPECTED_LOGICAL_BYTES} ` +
    `uniqueBlobs=${uniqueAliases.size} uniqueBytes=${EXPECTED_UNIQUE_BYTES} previouslyCached=0 ` +
    `cardFiles=${cardManifest.totalFiles} boardUnchanged=PASS runtimePrefix=PASS`
  );
}

try {
  main();
} catch (error) {
  console.error(`DESKTOP_CARD_DEPTH_BUNDLE_QA=FAIL ${error.stack || error.message}`);
  process.exitCode = 1;
}
