'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { Readable, Transform } = require('node:stream');

const MEBIBYTE = 1024 * 1024;
const DEFAULT_MAX_ENTRY_BYTES = 8 * MEBIBYTE;
const DEFAULT_MAX_BYTES = 192 * MEBIBYTE;

function normalizeAssetKey(value) {
  return String(value || '').normalize('NFC').toLowerCase();
}

function runtimeAssetToken(gameId, asset) {
  return crypto.createHash('sha256').update(`${gameId}\0${asset.path}\0${asset.sha256}`).digest('hex');
}

function parseRange(rangeHeader, size) {
  if (!rangeHeader) return null;
  if (typeof rangeHeader !== 'string' || rangeHeader.includes(',')) return { invalid: true };
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2]) || size < 1) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || start >= size || end < start) {
      return { invalid: true };
    }
    end = Math.min(end, size - 1);
  }
  return { start, end };
}

function assetReadError(message, code = 'ERR_RUNTIME_ASSET_READ') {
  const error = new Error(message);
  error.code = code;
  return error;
}

class RuntimeAssetCache {
  constructor({
    maxEntryBytes = DEFAULT_MAX_ENTRY_BYTES,
    maxBytes = DEFAULT_MAX_BYTES,
    readFileImpl = fs.promises.readFile,
    createReadStreamImpl = fs.createReadStream
  } = {}) {
    this.maxEntryBytes = Math.max(0, Number(maxEntryBytes) || 0);
    this.maxBytes = Math.max(0, Number(maxBytes) || 0);
    this.readFileImpl = readFileImpl;
    this.createReadStreamImpl = createReadStreamImpl;
    this.routes = new Map();
    this.tokens = new Map();
    this.buffers = new Map();
    this.pendingLoads = new Map();
    this.bufferBytes = 0;
  }

  buildGame(gameId, manifest, { filePathForAsset } = {}) {
    const normalizedGameId = String(gameId || '');
    if (!normalizedGameId || !manifest || !Array.isArray(manifest.assets) || typeof filePathForAsset !== 'function') {
      throw new TypeError('A verified game manifest and file path resolver are required.');
    }
    const routeMap = new Map();
    const tokenMap = new Map();
    let totalBytes = 0;
    for (const asset of manifest.assets) {
      if (
        !asset || typeof asset.path !== 'string' || !asset.path || typeof asset.mime !== 'string' ||
        !Number.isSafeInteger(asset.size) || asset.size < 1 || !/^[a-f0-9]{64}$/.test(String(asset.sha256 || ''))
      ) {
        throw new Error(`Invalid runtime asset record for ${normalizedGameId}.`);
      }
      const token = runtimeAssetToken(normalizedGameId, asset);
      const filePath = path.resolve(filePathForAsset(asset));
      const entry = Object.freeze({
        gameId: normalizedGameId,
        path: asset.path,
        key: normalizeAssetKey(asset.path),
        token,
        filePath,
        mime: asset.mime,
        size: asset.size,
        sha256: asset.sha256
      });
      if (routeMap.has(entry.key)) throw new Error(`Duplicate runtime asset path: ${asset.path}`);
      if (tokenMap.has(token)) throw new Error(`Duplicate runtime asset token: ${token}`);
      const installedEntry = this.tokens.get(token);
      if (installedEntry && installedEntry.gameId !== normalizedGameId) {
        throw new Error(`Runtime asset token collision: ${token}`);
      }
      routeMap.set(entry.key, entry);
      tokenMap.set(token, entry);
      totalBytes += asset.size;
    }
    this.clearGame(normalizedGameId);
    for (const [token, entry] of tokenMap) this.tokens.set(token, entry);
    this.routes.set(normalizedGameId, routeMap);
    return { files: routeMap.size, totalBytes };
  }

  lookupPath(gameId, assetPath) {
    return this.routes.get(String(gameId || ''))?.get(normalizeAssetKey(assetPath)) || null;
  }

  lookupToken(gameId, token) {
    const entry = this.tokens.get(String(token || ''));
    return entry?.gameId === String(gameId || '') ? entry : null;
  }

  clearGame(gameId) {
    const normalizedGameId = String(gameId || '');
    const routeMap = this.routes.get(normalizedGameId);
    if (!routeMap) return;
    for (const entry of routeMap.values()) {
      this.tokens.delete(entry.token);
      const cached = this.buffers.get(entry.token);
      if (cached) {
        this.bufferBytes -= cached.buffer.length;
        this.buffers.delete(entry.token);
      }
      this.pendingLoads.delete(entry.token);
    }
    this.routes.delete(normalizedGameId);
    if (this.bufferBytes < 0) this.bufferBytes = 0;
  }

  clearAll() {
    this.routes.clear();
    this.tokens.clear();
    this.buffers.clear();
    this.pendingLoads.clear();
    this.bufferBytes = 0;
  }

  snapshot() {
    return {
      games: this.routes.size,
      routes: [...this.routes.values()].reduce((sum, entries) => sum + entries.size, 0),
      buffers: this.buffers.size,
      bufferBytes: this.bufferBytes,
      pendingLoads: this.pendingLoads.size
    };
  }

  touchBuffer(token, cached) {
    this.buffers.delete(token);
    this.buffers.set(token, cached);
    return cached.buffer;
  }

  rememberBuffer(entry, buffer) {
    if (entry.size > this.maxEntryBytes || buffer.length > this.maxBytes || this.maxBytes === 0) return;
    while (this.buffers.size && this.bufferBytes + buffer.length > this.maxBytes) {
      const oldestToken = this.buffers.keys().next().value;
      const oldest = this.buffers.get(oldestToken);
      this.buffers.delete(oldestToken);
      this.bufferBytes -= oldest.buffer.length;
    }
    this.buffers.set(entry.token, { entry, buffer });
    this.bufferBytes += buffer.length;
  }

  async loadSmallAsset(entry) {
    const cached = this.buffers.get(entry.token);
    if (cached?.entry === entry) return this.touchBuffer(entry.token, cached);
    const pending = this.pendingLoads.get(entry.token);
    if (pending) return pending;
    const load = Promise.resolve().then(async () => {
      const buffer = await this.readFileImpl(entry.filePath);
      if (!Buffer.isBuffer(buffer)) throw assetReadError(`Runtime asset reader did not return a Buffer: ${entry.path}`);
      if (buffer.length !== entry.size) {
        throw assetReadError(`Runtime asset length mismatch: ${entry.path}`, 'ERR_RUNTIME_ASSET_LENGTH');
      }
      if (this.tokens.get(entry.token) !== entry) {
        throw assetReadError(`Runtime asset route changed while reading: ${entry.path}`, 'ERR_RUNTIME_ASSET_STALE');
      }
      this.rememberBuffer(entry, buffer);
      return buffer;
    });
    this.pendingLoads.set(entry.token, load);
    try {
      return await load;
    } finally {
      if (this.pendingLoads.get(entry.token) === load) this.pendingLoads.delete(entry.token);
    }
  }

  monitoredStream(entry, start, end, expectedBytes, onFailure) {
    const source = this.createReadStreamImpl(entry.filePath, { start, end });
    let received = 0;
    let reported = false;
    let cancelled = false;
    const report = (error) => {
      if (reported || cancelled) return;
      reported = true;
      onFailure?.(entry, error);
    };
    const monitor = new Transform({
      transform(chunk, _encoding, callback) {
        received += chunk.length;
        callback(null, chunk);
      },
      flush(callback) {
        if (received !== expectedBytes) {
          report(assetReadError(`Runtime asset stream length mismatch: ${entry.path}`, 'ERR_RUNTIME_ASSET_LENGTH'));
        }
        callback();
      }
    });
    const teardownSource = () => {
      source.unpipe(monitor);
      if (!source.destroyed) source.destroy();
    };
    source.once('error', (error) => {
      report(error);
      monitor.destroy(error);
    });
    monitor.once('error', (error) => {
      report(error);
      teardownSource();
    });
    monitor.once('close', teardownSource);
    source.pipe(monitor);
    const reader = Readable.toWeb(monitor).getReader();
    return new ReadableStream({
      async pull(controller) {
        try {
          const chunk = await reader.read();
          if (cancelled) return;
          if (chunk.done) {
            teardownSource();
            controller.close();
          } else {
            controller.enqueue(chunk.value);
          }
        } catch (error) {
          teardownSource();
          if (!cancelled) controller.error(error);
        }
      },
      async cancel(reason) {
        cancelled = true;
        teardownSource();
        try {
          await reader.cancel(reason);
        } catch {
          // The file stream is already torn down; cancellation is not corruption.
        }
      }
    });
  }

  async createResponse(request, entry, { allowedOrigin = '', onFailure } = {}) {
    const method = String(request?.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    if (!entry || this.tokens.get(entry.token) !== entry) return new Response('Not found', { status: 404 });
    const headers = new Headers({
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Type': entry.mime,
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'X-Content-Type-Options': 'nosniff',
      'X-OnePiece-Desktop-Cache': 'hit',
      ETag: `"${entry.sha256}"`
    });
    if (allowedOrigin) {
      headers.set('Access-Control-Allow-Origin', allowedOrigin);
      headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag, X-OnePiece-Desktop-Cache');
    }
    if (method === 'HEAD') {
      headers.set('Content-Length', String(entry.size));
      return new Response(null, { status: 200, headers });
    }
    const range = parseRange(request.headers?.get?.('range'), entry.size);
    if (range?.invalid) {
      headers.set('Content-Range', `bytes */${entry.size}`);
      headers.set('Content-Length', '0');
      return new Response(null, { status: 416, headers });
    }
    const start = range?.start ?? 0;
    const end = range?.end ?? entry.size - 1;
    const length = end - start + 1;
    headers.set('Content-Length', String(length));
    if (range) headers.set('Content-Range', `bytes ${start}-${end}/${entry.size}`);
    try {
      if (entry.size <= this.maxEntryBytes) {
        const buffer = await this.loadSmallAsset(entry);
        return new Response(buffer.subarray(start, end + 1), { status: range ? 206 : 200, headers });
      }
      const body = this.monitoredStream(entry, start, end, length, onFailure);
      return new Response(body, { status: range ? 206 : 200, headers });
    } catch (error) {
      onFailure?.(entry, error);
      return new Response('Installed asset unavailable', {
        status: error?.code === 'ENOENT' || error?.code === 'ERR_RUNTIME_ASSET_LENGTH' ? 404 : 500,
        headers: {
          'Cache-Control': 'no-store',
          'Content-Type': 'text/plain; charset=utf-8',
          'X-OnePiece-Desktop-Cache': 'invalid'
        }
      });
    }
  }
}

module.exports = {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_ENTRY_BYTES,
  RuntimeAssetCache,
  normalizeAssetKey,
  parseRange,
  runtimeAssetToken
};
