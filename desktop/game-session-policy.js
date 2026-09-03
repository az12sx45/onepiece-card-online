'use strict';

const DESKTOP_WEB_CACHE_STORAGES = Object.freeze(['serviceworkers', 'cachestorage']);

function normalizedOrigin(value) {
  try {
    return new URL(value).origin;
  } catch {
    return '';
  }
}

function shouldBlockServiceWorkerRequest(details, remoteOrigin) {
  if (!details || typeof details.url !== 'string') return false;
  const approvedOrigin = normalizedOrigin(remoteOrigin);
  if (!approvedOrigin) return false;
  try {
    const requested = new URL(details.url);
    return requested.origin === approvedOrigin && requested.pathname === '/sw.js';
  } catch {
    return false;
  }
}

async function resetDesktopGameWebCache(targetSession, remoteOrigin) {
  if (!targetSession || typeof targetSession.clearStorageData !== 'function') {
    throw new TypeError('A valid Electron game session is required.');
  }
  const origin = normalizedOrigin(remoteOrigin);
  if (!origin) throw new TypeError('A valid remote game origin is required.');
  await targetSession.clearStorageData({
    origin,
    storages: [...DESKTOP_WEB_CACHE_STORAGES]
  });
}

module.exports = {
  DESKTOP_WEB_CACHE_STORAGES,
  resetDesktopGameWebCache,
  shouldBlockServiceWorkerRequest
};
