'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const {
  canonicalJson, sha256Bytes, comparePaths, classifyPath, calculateByKind,
  validateAssetRecord, validateManifest, validateCatalog
} = require('./desktop_program_package_common');
const {
  ASSET_BLOB_BASE_URL, RELEASE_PATH, ENTRY_PATH, PROGRAM_FILES, validateMarinefordRelease
} = require('../desktop/marineford-release');

const root = path.resolve(__dirname, '..');
const publicRoot = path.join(root, 'public');
const readGit = logicalPath => execFileSync('git', ['show', 'HEAD:public/' + logicalPath], {
  cwd: root, windowsHide: true, maxBuffer: 32 * 1024 * 1024
});
const parseGit = logicalPath => JSON.parse(readGit(logicalPath));

function build() {
  const catalog = validateCatalog(parseGit('desktop/catalog-v3.json'));
  const boardBytes = readGit(catalog.games.board.manifestPath);
  assert.equal(sha256Bytes(boardBytes), catalog.games.board.manifestSha256);
  const board = validateManifest(JSON.parse(boardBytes), 'board');
  const boardAssets = new Map(board.assets.map(asset => [asset.path, asset]));
  const media = parseGit('desktop/marineford-media-v1.json');
  assert.equal(media.schema, 1);
  assert.equal(media.gameId, 'marineford');
  const assets = new Map();

  function add(record) {
    const asset = validateAssetRecord(record);
    assert(!assets.has(asset.path), 'Duplicate Marineford package path ' + asset.path);
    assets.set(asset.path, asset);
  }
  for (const asset of media.assets) {
    assert.equal(asset.kind, 'image');
    assert.match(asset.path, /^(marineford\/art\/(v2\/)?[a-z0-9_-]+|images\/game_launcher\/launcher_marineford_cover_v[12])\.webp$/);
    add(asset);
  }
  for (let avatar = 1; avatar <= 222; avatar++) {
    const assetPath = 'images/board/avatars/' + avatar + '.webp';
    assert(boardAssets.has(assetPath), 'Missing avatar ' + avatar);
    add(boardAssets.get(assetPath));
  }
  for (const assetPath of PROGRAM_FILES) {
    const bytes = readGit(assetPath);
    const local = fs.readFileSync(path.join(publicRoot, assetPath));
    assert(bytes.equals(local), 'Program worktree must match its committed bytes ' + assetPath);
    add({ ...classifyPath(assetPath), size: bytes.length, sha256: sha256Bytes(bytes) });
  }
  const ordered = [...assets.values()].sort((a, b) => comparePaths(a.path, b.path));
  const createdAt = new Date().toISOString();
  const assetSetSha256 = sha256Bytes(JSON.stringify(ordered));
  const manifest = {
    schema: 3,
    gameId: 'marineford',
    releaseId: 'package-' + assetSetSha256.slice(0, 16),
    createdAt,
    entryPath: ENTRY_PATH,
    assetSetSha256,
    totalFiles: ordered.length,
    totalBytes: ordered.reduce((total, asset) => total + asset.size, 0),
    byKind: calculateByKind(ordered),
    assets: ordered
  };
  validateManifest(manifest, 'marineford');
  const manifestPath = 'desktop/manifests/marineford-' + manifest.releaseId + '.json';
  const manifestBytes = Buffer.from(canonicalJson(manifest));
  const reference = {
    schema: 1,
    gameId: 'marineford',
    createdAt,
    assetBlobBaseUrl: ASSET_BLOB_BASE_URL,
    releaseId: manifest.releaseId,
    manifestPath,
    manifestSha256: sha256Bytes(manifestBytes),
    entryPath: ENTRY_PATH,
    totalFiles: manifest.totalFiles,
    totalBytes: manifest.totalBytes
  };
  validateMarinefordRelease(reference);
  const output = path.join(publicRoot, manifestPath);
  fs.mkdirSync(path.dirname(output), { recursive: true });
  if (fs.existsSync(output)) {
    const previous = fs.readFileSync(output);
    const existing = validateManifest(JSON.parse(previous), 'marineford');
    assert.equal(existing.assetSetSha256, assetSetSha256);
    reference.createdAt = existing.createdAt;
    reference.manifestSha256 = sha256Bytes(previous);
  } else {
    fs.writeFileSync(output, manifestBytes, { flag: 'wx' });
  }
  const pointer = path.join(publicRoot, RELEASE_PATH);
  const temporary = pointer + '.tmp-' + process.pid;
  try {
    fs.writeFileSync(temporary, canonicalJson(reference), { flag: 'wx' });
    fs.renameSync(temporary, pointer);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  console.log(JSON.stringify({ ...reference, programFiles: PROGRAM_FILES }));
}

build();
