'use strict';

const crypto = require('node:crypto');
const path = require('node:path');

const CATALOG_SCHEMA = 3;
const MANIFEST_SCHEMA = 3;
const CONFIG_SCHEMA = 1;
const GAME_IDS = Object.freeze(['card', 'board', 'chess']);
const KINDS = Object.freeze([
  'document', 'style', 'script', 'data', 'wasm',
  'image', 'audio', 'video', 'font'
]);
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const RELEASE_PATTERN = /^package-[a-f0-9]{16}$/;
const MANIFEST_PATH_PATTERN = /^desktop\/manifests\/(card|board|chess)-package-[a-f0-9]{16}\.json$/;
const RESERVED_SEGMENTS = new Set(['incoming', 'backup', 'backups', 'private', 'battle_chess']);
const EXTENSIONS = new Map([
  ['.html', ['document', 'text/html']],
  ['.css', ['style', 'text/css']],
  ['.js', ['script', 'text/javascript']],
  ['.mjs', ['script', 'text/javascript']],
  ['.json', ['data', 'application/json']],
  ['.webmanifest', ['data', 'application/manifest+json']],
  ['.txt', ['data', 'text/plain']],
  ['.md', ['data', 'text/markdown']],
  ['.wasm', ['wasm', 'application/wasm']],
  ['.png', ['image', 'image/png']],
  ['.jpg', ['image', 'image/jpeg']],
  ['.jpeg', ['image', 'image/jpeg']],
  ['.jfif', ['image', 'image/jpeg']],
  ['.webp', ['image', 'image/webp']],
  ['.gif', ['image', 'image/gif']],
  ['.svg', ['image', 'image/svg+xml']],
  ['.avif', ['image', 'image/avif']],
  ['.mp3', ['audio', 'audio/mpeg']],
  ['.wav', ['audio', 'audio/wav']],
  ['.ogg', ['audio', 'audio/ogg']],
  ['.m4a', ['audio', 'audio/mp4']],
  ['.aac', ['audio', 'audio/aac']],
  ['.flac', ['audio', 'audio/flac']],
  ['.mp4', ['video', 'video/mp4']],
  ['.webm', ['video', 'video/webm']],
  ['.mov', ['video', 'video/quicktime']],
  ['.m4v', ['video', 'video/x-m4v']],
  ['.woff', ['font', 'font/woff']],
  ['.woff2', ['font', 'font/woff2']],
  ['.ttf', ['font', 'font/ttf']],
  ['.otf', ['font', 'font/otf']]
]);

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function normalizeBlobBaseUrl(value) {
  if (typeof value !== 'string' || !value) fail('assetBlobBaseUrl must be a non-empty string.');
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    fail('assetBlobBaseUrl must be a valid URL.');
  }
  if (
    parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash ||
    parsed.pathname === '/' || parsed.pathname.endsWith('/') || `${parsed.origin}${parsed.pathname}` !== value
  ) fail('assetBlobBaseUrl must be normalized HTTPS without credentials, query, hash, or trailing slash.');
  return value;
}

function classifyPath(value) {
  if (
    typeof value !== 'string' || !value || value.includes('\\') || value.includes('\0') ||
    path.posix.isAbsolute(value) || path.win32.isAbsolute(value) || path.posix.normalize(value) !== value
  ) return null;
  const parts = value.split('/');
  if (
    parts.some((part) => !part || part === '.' || part === '..') ||
    parts.map((part) => part.normalize('NFC').toLowerCase()).some((part) => RESERVED_SEGMENTS.has(part))
  ) return null;
  const type = EXTENSIONS.get(path.posix.extname(value).toLowerCase());
  return type ? { path: value, kind: type[0], mime: type[1] } : null;
}

function emptyByKind() {
  return Object.fromEntries(KINDS.map((kind) => [kind, { files: 0, bytes: 0 }]));
}

function calculateByKind(assets) {
  const totals = emptyByKind();
  for (const asset of assets) {
    totals[asset.kind].files += 1;
    totals[asset.kind].bytes += asset.size;
  }
  return totals;
}

function validateAssetRecord(source, label = 'asset') {
  const validPath = classifyPath(source?.path);
  const keys = isPlainObject(source) ? Object.keys(source) : [];
  if (
    keys.join(',') !== 'path,kind,mime,size,sha256' || !validPath ||
    source.kind !== validPath.kind || source.mime !== validPath.mime ||
    !Number.isSafeInteger(source.size) || source.size < 1 ||
    typeof source.sha256 !== 'string' || !HASH_PATTERN.test(source.sha256)
  ) fail(`Invalid ${label}: ${source?.path || 'unknown'}`);
  return {
    path: validPath.path,
    kind: validPath.kind,
    mime: validPath.mime,
    size: source.size,
    sha256: source.sha256
  };
}

function validateManifest(document, expectedGameId) {
  const fields = [
    'schema', 'gameId', 'releaseId', 'createdAt', 'entryPath', 'assetSetSha256',
    'totalFiles', 'totalBytes', 'byKind', 'assets'
  ];
  if (!isPlainObject(document) || Object.keys(document).join(',') !== fields.join(',')) {
    fail(`${expectedGameId} package manifest fields/order are invalid.`);
  }
  if (
    document.schema !== MANIFEST_SCHEMA || document.gameId !== expectedGameId ||
    !GAME_IDS.includes(expectedGameId) || !RELEASE_PATTERN.test(String(document.releaseId || '')) ||
    typeof document.createdAt !== 'string' || Number.isNaN(Date.parse(document.createdAt)) ||
    !Array.isArray(document.assets) || document.assets.length < 1 || document.assets.length > 20_000
  ) fail(`${expectedGameId} package manifest identity is invalid.`);
  const entry = classifyPath(document.entryPath);
  if (!entry || entry.kind !== 'document') fail(`${expectedGameId} entryPath is invalid.`);

  const assets = [];
  const folded = new Set();
  let previous = '';
  let totalBytes = 0;
  for (const source of document.assets) {
    const asset = validateAssetRecord(source, `${expectedGameId} asset`);
    if (previous && comparePaths(previous, asset.path) >= 0) fail(`${expectedGameId} package assets are not strictly sorted.`);
    previous = asset.path;
    const key = asset.path.normalize('NFC').toLowerCase();
    if (folded.has(key)) fail(`${expectedGameId} package contains a case-folded path collision.`);
    folded.add(key);
    totalBytes += asset.size;
    if (!Number.isSafeInteger(totalBytes)) fail(`${expectedGameId} package byte total is unsafe.`);
    assets.push(asset);
  }
  const entryAsset = assets.find((asset) => asset.path === document.entryPath);
  if (!entryAsset || entryAsset.kind !== 'document') fail(`${expectedGameId} package does not contain its entry document.`);
  const assetSetSha256 = sha256Bytes(JSON.stringify(assets));
  if (
    document.assetSetSha256 !== assetSetSha256 ||
    document.releaseId !== `package-${assetSetSha256.slice(0, 16)}` ||
    document.totalFiles !== assets.length || document.totalBytes !== totalBytes ||
    JSON.stringify(document.byKind) !== JSON.stringify(calculateByKind(assets))
  ) fail(`${expectedGameId} package totals or digests are invalid.`);
  return { ...document, assets };
}

function validateCatalog(document) {
  const fields = ['schema', 'createdAt', 'assetBlobBaseUrl', 'sourceTrees', 'games'];
  if (!isPlainObject(document) || Object.keys(document).join(',') !== fields.join(',')) fail('Catalog v3 fields/order are invalid.');
  if (
    document.schema !== CATALOG_SCHEMA || typeof document.createdAt !== 'string' ||
    Number.isNaN(Date.parse(document.createdAt)) || !isPlainObject(document.games) ||
    Object.keys(document.games).join(',') !== GAME_IDS.join(',')
  ) fail('Catalog v3 identity is invalid.');
  normalizeBlobBaseUrl(document.assetBlobBaseUrl);
  if (!isPlainObject(document.sourceTrees) || Object.keys(document.sourceTrees).join(',') !== 'images,audio,videos,fonts') {
    fail('Catalog v3 sourceTrees are invalid.');
  }
  for (const tree of Object.values(document.sourceTrees)) {
    if (typeof tree !== 'string' || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(tree)) fail('Catalog v3 contains an invalid source tree.');
  }
  for (const gameId of GAME_IDS) {
    const record = document.games[gameId];
    const recordFields = ['releaseId', 'manifestPath', 'manifestSha256', 'entryPath', 'totalFiles', 'totalBytes'];
    if (!isPlainObject(record) || Object.keys(record).join(',') !== recordFields.join(',')) fail(`Catalog v3 ${gameId} fields/order are invalid.`);
    const match = String(record.manifestPath || '').match(MANIFEST_PATH_PATTERN);
    if (
      !RELEASE_PATTERN.test(String(record.releaseId || '')) || !match || match[1] !== gameId ||
      typeof record.manifestSha256 !== 'string' || !HASH_PATTERN.test(record.manifestSha256) ||
      !classifyPath(record.entryPath) || classifyPath(record.entryPath).kind !== 'document' ||
      !Number.isSafeInteger(record.totalFiles) || record.totalFiles < 1 ||
      !Number.isSafeInteger(record.totalBytes) || record.totalBytes < 1
    ) fail(`Catalog v3 ${gameId} record is invalid.`);
  }
  return document;
}

function objectKeyForSha256(sha256) {
  if (typeof sha256 !== 'string' || !HASH_PATTERN.test(sha256)) fail('Invalid blob SHA-256.');
  return `desktop/blobs/sha256/${sha256.slice(0, 2)}/${sha256}`;
}

module.exports = {
  CATALOG_SCHEMA,
  MANIFEST_SCHEMA,
  CONFIG_SCHEMA,
  GAME_IDS,
  KINDS,
  HASH_PATTERN,
  canonicalJson,
  sha256Bytes,
  comparePaths,
  normalizeBlobBaseUrl,
  classifyPath,
  calculateByKind,
  validateAssetRecord,
  validateManifest,
  validateCatalog,
  objectKeyForSha256,
  isPlainObject,
  fail
};
