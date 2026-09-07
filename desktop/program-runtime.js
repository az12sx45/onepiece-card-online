'use strict';

const path = require('node:path');

const STATIC_KINDS = new Set(['document', 'style', 'script', 'data', 'wasm', 'image', 'audio', 'video', 'font']);

function normalizeOrigin(value) {
  const parsed = new URL(String(value || ''));
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.pathname !== '/' || parsed.search || parsed.hash) {
    throw new TypeError('Program runtime origin must be a bare HTTPS origin.');
  }
  return parsed.origin;
}

function requestPathForOrigin(requestUrl, origin) {
  try {
    const parsed = new URL(String(requestUrl || ''));
    if (parsed.origin !== origin) return null;
    const decoded = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    if (
      !decoded || decoded.includes('\\') || decoded.includes('\0') ||
      path.posix.isAbsolute(decoded) || path.win32.isAbsolute(decoded) ||
      path.posix.normalize(decoded) !== decoded
    ) return null;
    const parts = decoded.split('/');
    if (parts.some((part) => !part || part === '.' || part === '..')) return null;
    return decoded;
  } catch {
    return null;
  }
}

function normalizeAuthorization(value, gameId) {
  if (!value || value.enabled !== true) {
    return Object.freeze({ enabled: false, reason: String(value?.reason || 'not-confirmed') });
  }
  const releaseId = String(value.releaseId || '');
  const manifestSha256 = String(value.manifestSha256 || '').toLowerCase();
  const entryPath = String(value.entryPath || '');
  if (
    value.gameId !== gameId || !/^[a-z0-9][a-z0-9._-]{0,95}$/.test(releaseId) ||
    !/^[a-f0-9]{64}$/.test(manifestSha256) || !entryPath
  ) throw new TypeError('Program runtime authorization is invalid.');
  return Object.freeze({ enabled: true, gameId, releaseId, manifestSha256, entryPath, reason: 'remote-match' });
}

class HttpsProgramRuntime {
  constructor({ gameId, origin, assetCache, networkFetch, onFailure } = {}) {
    this.gameId = String(gameId || '');
    if (!this.gameId) throw new TypeError('Program runtime gameId is required.');
    this.origin = normalizeOrigin(origin);
    if (!assetCache || typeof assetCache.lookupPath !== 'function' || typeof assetCache.createResponse !== 'function') {
      throw new TypeError('Program runtime requires a verified runtime asset cache.');
    }
    if (typeof networkFetch !== 'function') throw new TypeError('Program runtime networkFetch is required.');
    this.assetCache = assetCache;
    this.networkFetch = networkFetch;
    this.onFailure = typeof onFailure === 'function' ? onFailure : null;
    this.authorization = Object.freeze({ enabled: false, reason: 'not-confirmed' });
  }

  authorize(value) {
    this.authorization = normalizeAuthorization(value, this.gameId);
    return this.snapshot();
  }

  disable(reason = 'disabled') {
    this.authorization = Object.freeze({ enabled: false, reason: String(reason || 'disabled') });
    return this.snapshot();
  }

  snapshot() {
    return { ...this.authorization };
  }

  async fetchNetwork(request) {
    return this.networkFetch(request);
  }

  async handle(request) {
    const method = String(request?.method || 'GET').toUpperCase();
    const assetPath = requestPathForOrigin(request?.url, this.origin);
    if (!this.authorization.enabled || !assetPath || (method !== 'GET' && method !== 'HEAD')) {
      return this.fetchNetwork(request);
    }
    const entry = this.assetCache.lookupPath(this.gameId, assetPath);
    if (!entry || !STATIC_KINDS.has(entry.kind)) return this.fetchNetwork(request);
    try {
      const local = await this.assetCache.createResponse(request, entry, {
        allowedOrigin: this.origin,
        onFailure: this.onFailure
      });
      if (!local.ok && local.status !== 206) return this.fetchNetwork(request);
      const headers = new Headers(local.headers);
      headers.set('X-OnePiece-Desktop-Program', 'hit');
      headers.set('Access-Control-Expose-Headers', [
        headers.get('Access-Control-Expose-Headers'),
        'X-OnePiece-Desktop-Program'
      ].filter(Boolean).join(', '));
      return new Response(method === 'HEAD' ? null : local.body, {
        status: local.status,
        statusText: local.statusText,
        headers
      });
    } catch (error) {
      this.onFailure?.(entry, error);
      return this.fetchNetwork(request);
    }
  }
}

module.exports = {
  HttpsProgramRuntime,
  STATIC_KINDS,
  normalizeAuthorization,
  normalizeOrigin,
  requestPathForOrigin
};
