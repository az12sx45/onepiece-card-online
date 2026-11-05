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

module.exports = { ASSET_BLOB_BASE_URL, RELEASE_PATH, ENTRY_PATH, PROGRAM_FILES, validateMarinefordRelease };
