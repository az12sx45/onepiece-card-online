'use strict';
// Private, per-process bridge. Account credentials never enter command lines or files.
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');

async function createNativeCardBridge({ auth, assets, matchRoom = null, onSessionInvalid = () => {} }) {
  const initialSecret = auth.getSecretForGame();
  const initialId = auth.accountSummary()?.userId;
  if (!initialSecret || !initialId || auth.previewMode) throw Error('Native Card requires an authenticated account');
  const token = crypto.randomBytes(32).toString('hex');
  let closed = false, requests = 0;
  let ready;
  const matchReady = new Promise(resolve => { ready = resolve; });
  const valid = () => !closed && auth.getSecretForGame() === initialSecret && auth.accountSummary()?.userId === initialId;
  const server = http.createServer(async (req, res) => {
    const finish = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Connection: 'close' });
      res.end(JSON.stringify(data));
    };
    const supplied = Buffer.from(String(req.headers['x-po-native'] || ''));
    if (req.method !== 'POST' || req.url !== '/rpc' || req.headers.origin || req.headers['sec-fetch-site'] || supplied.length !== token.length || !crypto.timingSafeEqual(supplied, Buffer.from(token))) {
      req.resume(); finish(403, { ok: false, error: 'denied' }); return;
    }
    if (!valid()) { req.resume(); finish(409, { ok: false, error: 'session changed' }); return; }
    if (++requests > 16) { requests--; req.resume(); finish(429, { ok: false, error: 'busy' }); return; }
    try {
      const chunks = []; let bytes = 0;
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 32768) throw Error('request too large'); chunks.push(chunk); }
      const { method, args = {} } = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!valid()) { finish(409, { ok: false, error: 'session changed' }); return; }
      if (method === 'getNativeState') {
        const bootstrap = auth.getGameBootstrap();
        finish(200, { ok: true, account: auth.accountSummary(), secret: initialSecret, deviceId: bootstrap.op_device_id, preferences: auth.getPreferences() });
      } else if (method === 'cardMatchReady') {
        if (!matchRoom || args.room !== matchRoom) { finish(400, { ok: false }); return; }
        ready(); finish(200, { ok: true });
      } else if (method === 'saveSession') {
        // Native refresh may acknowledge the same session, never replace launcher credentials.
        finish(200, { ok: args.secret === initialSecret && args.account?.userId === initialId });
      } else if (method === 'clearSession') {
        await onSessionInvalid(); finish(200, { ok: true });
      } else if (method === 'resolveCardAsset') {
        const name = args.path;
        if (typeof name !== 'string' || !/^(?:audio\/[a-zA-Z0-9_./ -]+\.(?:mp3|ogg|wav)|videos\/enh\/(?:[0-9]|1[0-9])\.mp4)$/.test(name) || name.split('/').includes('..')) throw Error('invalid media path');
        const asset = await assets.resolveAsset('card', name);
        if (!valid()) { finish(409, { ok: false, error: 'session changed' }); return; }
        if (!asset || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw Error('verified media unavailable');
        const stat = await fs.stat(asset.filePath);
        if (!stat.isFile() || stat.size !== asset.size) throw Error('verified media changed');
        finish(200, { ok: true, path: name, file: asset.filePath, size: stat.size, sha256: asset.sha256 });
      } else finish(400, { ok: false, error: 'unsupported request' });
    } catch { if (!res.headersSent && !res.destroyed) finish(400, { ok: false, error: 'native request failed' }); }
    finally { requests--; }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const endpoint = `http://127.0.0.1:${server.address().port}/rpc`;
  return {
    matchReady,
    childEnvironment: { PO_NATIVE_DESKTOP_ENDPOINT: endpoint, PO_NATIVE_DESKTOP_TOKEN: token, PO_NATIVE_CARD_ROOM: matchRoom || '' },
    close() { if (closed) return; closed = true; server.closeAllConnections(); server.close(); }
  };
}
module.exports = { createNativeCardBridge };
