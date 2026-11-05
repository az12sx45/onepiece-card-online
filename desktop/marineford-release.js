'use strict';

const ASSET_BLOB_BASE_URL = 'https://game-assets.rihdi.tw/desktop/blobs/sha256';
const RELEASE_PATH = 'desktop/marineford-release-v1.json';
const ENTRY_PATH = 'marineford/index.html';
const PROGRAM_FILES = Object.freeze([
  'marineford/cards.json',
  'marineford/index.html',
  'marineford/marineford.css',
  'marineford/marineford.js',
  'marineford/sound.js',
  'vendor/socket.io-client/4.8.1/socket.io.min.js'
]);
const MAX_ASSET_BYTES = 32 * 1024 * 1024;
const MAX_INLINE_MEDIA_BYTES = 64 * 1024 * 1024;
const PROGRAM_TYPES = new Map([
  ['marineford/cards.json', ['data', 'application/json']],
  ['marineford/index.html', ['document', 'text/html']],
  ['marineford/marineford.css', ['style', 'text/css']],
  ['marineford/marineford.js', ['script', 'text/javascript']],
  ['marineford/sound.js', ['script', 'text/javascript']],
  ['vendor/socket.io-client/4.8.1/socket.io.min.js', ['script', 'text/javascript']]
]);
const MEDIA_TYPES = new Map([
  ['png', ['image', 'image/png']], ['jpg', ['image', 'image/jpeg']],
  ['jpeg', ['image', 'image/jpeg']], ['jfif', ['image', 'image/jpeg']],
  ['webp', ['image', 'image/webp']], ['gif', ['image', 'image/gif']],
  ['svg', ['image', 'image/svg+xml']], ['avif', ['image', 'image/avif']],
  ['mp3', ['audio', 'audio/mpeg']], ['wav', ['audio', 'audio/wav']],
  ['ogg', ['audio', 'audio/ogg']], ['m4a', ['audio', 'audio/mp4']],
  ['aac', ['audio', 'audio/aac']], ['flac', ['audio', 'audio/flac']],
  ['mp4', ['video', 'video/mp4']], ['webm', ['video', 'video/webm']],
  ['mov', ['video', 'video/quicktime']], ['m4v', ['video', 'video/x-m4v']],
  ['woff', ['font', 'font/woff']], ['woff2', ['font', 'font/woff2']],
  ['ttf', ['font', 'font/ttf']], ['otf', ['font', 'font/otf']]
]);

function validateMarinefordAssets(assets) {
  if (!Array.isArray(assets)) throw new Error('Marineford package assets are invalid.');
  const programs = new Set();
  let inlineBytes = 0;
  for (const asset of assets) {
    if (!asset || typeof asset.path !== 'string' ||
        !Number.isSafeInteger(asset.size) || asset.size < 1 || asset.size > MAX_ASSET_BYTES) {
      throw new Error('Marineford package asset size is invalid.');
    }
    const program = PROGRAM_TYPES.get(asset.path);
    if (program) {
      if (asset.kind !== program[0] || asset.mime !== program[1] || programs.has(asset.path)) {
        throw new Error('Marineford package program is invalid.');
      }
      programs.add(asset.path);
      continue;
    }
    const extension = asset.path.match(/\.([a-z0-9]+)$/)?.[1];
    const type = MEDIA_TYPES.get(extension);
    const namespace = asset.path.match(/^marineford\/(art|audio|video|videos|fonts)\/(?:[a-z0-9_-]+\/)*[a-z0-9][a-z0-9._-]*$/)?.[1];
    const kind = { art: 'image', audio: 'audio', video: 'video', videos: 'video', fonts: 'font' }[namespace];
    const avatar = asset.path.match(/^images\/board\/avatars\/([1-9][0-9]{0,2})\.webp$/);
    const sharedImage = (avatar && Number(avatar[1]) <= 222) ||
      /^images\/game_launcher\/launcher_marineford_cover_v[12]\.webp$/.test(asset.path);
    if (!type || asset.kind !== type[0] || asset.mime !== type[1] ||
        (sharedImage ? asset.kind !== 'image' : !kind || asset.kind !== kind)) {
      throw new Error('Marineford package media is outside its contract.');
    }
    if (asset.kind !== 'image') inlineBytes += asset.size;
    if (inlineBytes > MAX_INLINE_MEDIA_BYTES) throw new Error('Marineford package inline media limit exceeded.');
  }
  if (programs.size !== PROGRAM_FILES.length) throw new Error('Marineford package program set is incomplete.');
  return assets;
}

function validateMarinefordRelease(document) {
  const releaseId = document?.releaseId;
  if (!document || typeof document !== 'object' || Array.isArray(document) ||
      document.schema !== 1 || document.gameId !== 'marineford' ||
      document.assetBlobBaseUrl !== ASSET_BLOB_BASE_URL ||
      typeof document.createdAt !== 'string' || Number.isNaN(Date.parse(document.createdAt)) ||
      typeof releaseId !== 'string' || !/^package-[a-f0-9]{16}$/.test(releaseId) ||
      document.manifestPath !== 'desktop/manifests/marineford-' + releaseId + '.json' ||
      typeof document.manifestSha256 !== 'string' || !/^[a-f0-9]{64}$/.test(document.manifestSha256) ||
      document.entryPath !== ENTRY_PATH ||
      !Number.isSafeInteger(document.totalFiles) || document.totalFiles < PROGRAM_FILES.length ||
      document.totalFiles > 20000 ||
      !Number.isSafeInteger(document.totalBytes) || document.totalBytes < 1) {
    throw new Error('Marineford game release reference is invalid.');
  }
  return {
    releaseId,
    manifestPath: document.manifestPath,
    manifestSha256: document.manifestSha256,
    entryPath: ENTRY_PATH,
    totalFiles: document.totalFiles,
    totalBytes: document.totalBytes
  };
}

module.exports = {
  ASSET_BLOB_BASE_URL, RELEASE_PATH, ENTRY_PATH, PROGRAM_FILES,
  MAX_ASSET_BYTES, MAX_INLINE_MEDIA_BYTES, validateMarinefordRelease, validateMarinefordAssets
};
