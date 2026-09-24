'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ASSET_BASE = 'https://game-assets.rihdi.tw/desktop/blobs/sha256';
const MEDIA_KINDS = new Set(['image', 'audio', 'video', 'font']);
const LAUNCHER_EVENTS = new Set([
  'AUTH_REGISTER', 'AUTH_LOGIN', 'PROFILE_GET', 'PROFILE_UPDATE', 'PROFILE_PUBLIC_GET',
  'LAUNCHER_PROFILE_GET', 'LAUNCHER_SHOP_GET', 'LAUNCHER_SHOP_BUY', 'LAUNCHER_SHOP_EQUIP',
  'LAUNCHER_DECORATION_PLACEMENT_SET', 'LAUNCHER_ROOM_SET', 'LAUNCHER_COMMENTS_GET', 'LAUNCHER_COMMENT_POST', 'LAUNCHER_COMMENT_DELETE',
  'SOCIAL_AUTH', 'PRESENCE_SET', 'FRIENDS_GET', 'FRIEND_ADD_BY_NAME',
  'FRIEND_REQUEST_ACCEPT', 'FRIEND_REQUEST_DECLINE', 'FRIEND_REMOVE', 'DM_HISTORY', 'DM_SEND'
]);
const RETIRED_WORKER = `self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  await self.clients.claim();
  const windows=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  await self.registration.unregister();
  await Promise.all(windows.map(client=>{
    const url=new URL(client.url);
    return url.origin===self.location.origin&&!['/download','/desktop-download.html'].includes(url.pathname)
      ?client.navigate('/download').catch(()=>{}):Promise.resolve();
  }));
})()));
`;

function isDesktopRenderer(headers = {}) {
  // Compatibility routing, not device authentication. Existing account and
  // room authorization still apply; URL flags never grant desktop access.
  return /\bElectron\/\d+\.\d+(?:\.\d+)?\b/i.test(String(headers['user-agent'] || ''));
}

function isLauncherProcess(headers = {}) {
  // Proxies may synthesize a User-Agent for the launcher's headerless WebSocket.
  // Browser requests carry Origin or Fetch Metadata. This compatibility branch
  // still permits only the account/social events in installSocketGuard.
  return !headers.origin && !Object.keys(headers).some(key => key.toLowerCase().startsWith('sec-fetch-'));
}

function requestPath(req) {
  try {
    const pathname = decodeURIComponent(new URL(req.originalUrl || req.url, 'http://distribution.local').pathname);
    if (/[\\\x00-\x1f\x7f]/.test(pathname) || pathname.split('/').some(part => part === '..' || part === '.')) return null;
    return pathname.replace(/\/{2,}/g, '/');
  } catch { return null; }
}

function mediaIndex(publicDir) {
  const catalog = JSON.parse(fs.readFileSync(path.join(publicDir, 'desktop/catalog-v3.json'), 'utf8'));
  if (catalog.schema !== 3 || catalog.assetBlobBaseUrl !== ASSET_BASE) throw new Error('Invalid desktop distribution catalog');
  const index = new Map();
  for (const gameId of ['card', 'board', 'chess']) {
    const record = catalog.games?.[gameId];
    if (!record || !new RegExp(`^desktop/manifests/${gameId}-package-[a-f0-9]{16}\\.json$`).test(record.manifestPath)) throw new Error('Invalid desktop distribution manifest path');
    const bytes = fs.readFileSync(path.join(publicDir, record.manifestPath));
    if (crypto.createHash('sha256').update(bytes).digest('hex') !== record.manifestSha256) throw new Error('Desktop distribution manifest hash mismatch');
    const manifest = JSON.parse(bytes.toString('utf8'));
    if (manifest.gameId !== gameId || manifest.releaseId !== record.releaseId || !Array.isArray(manifest.assets)) throw new Error('Invalid desktop distribution manifest');
    for (const asset of manifest.assets) {
      if (!MEDIA_KINDS.has(asset.kind)) continue;
      if (typeof asset.path !== 'string' || asset.path.startsWith('/') || /[\\\x00-\x1f\x7f?#]/.test(asset.path)
        || asset.path.split('/').some(part => !part || part === '.' || part === '..')
        || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw new Error('Invalid desktop distribution media');
      const key = '/' + asset.path;
      const url = `${ASSET_BASE}/${asset.sha256.slice(0, 2)}/${asset.sha256}`;
      if (index.has(key) && index.get(key) !== url) throw new Error('Conflicting desktop media path: ' + asset.path);
      index.set(key, url);
    }
  }
  return index;
}

function createDesktopDistribution({ publicDir, enabled = process.env.OP_DESKTOP_ONLY !== '0' } = {}) {
  const media = enabled ? mediaIndex(publicDir) : new Map();
  const downloadPath = path.join(publicDir, 'desktop-download.html');
  function middleware(req, res, next) {
    if (!enabled) return next();
    res.setHeader('X-OnePiece-Distribution', 'desktop-only-v1');
    const pathname = requestPath(req);
    if (pathname === null) return res.status(400).set('Cache-Control', 'no-store').end();
    const read = req.method === 'GET' || req.method === 'HEAD';
    if (pathname === '/health' || pathname.startsWith('/api/')) return next();
    if (/^\/desktop\/(?:catalog-v[123]|launcher-release-v1)\.json$/.test(pathname)
      || /^\/desktop\/manifests\/[a-z0-9._-]+\.json$/.test(pathname)) return next();
    if (!read) return res.status(405).set('Allow', 'GET, HEAD').set('Cache-Control', 'no-store').end();
    if (pathname === '/download' || pathname === '/desktop-download.html' || pathname === '/') {
      res.set('Cache-Control', 'no-store');
      return res.sendFile(downloadPath);
    }
    if (media.has(pathname)) {
      return res.status(302).set('Cache-Control', 'no-store').set('Location', media.get(pathname)).end();
    }
    // Touch-capable Windows laptops still use Board's small prefetch index.
    if (pathname === '/images/board/mobile/manifest-v397.json' && isDesktopRenderer(req.headers)) return next();
    // The reviewed Board depth catalog is package metadata fetched at runtime,
    // not media redirected through R2. Allow only this exact JSON for Electron.
    if (pathname === '/images/board-depth/v1/manifest.json' && isDesktopRenderer(req.headers)) return next();
    // No unknown media falls through to Render's static file handler.
    if (/^\/(?:images|audio|videos|fonts)(?:\/|$)/i.test(pathname)
      || /\.(?:png|jpe?g|webp|gif|avif|svg|mp3|ogg|wav|m4a|mp4|webm|otf|ttf|woff2?)$/i.test(pathname)) {
      return res.status(404).set('Cache-Control', 'no-store').end();
    }
    if (isDesktopRenderer(req.headers)) return next();
    if (pathname === '/sw.js') {
      return res.status(200).set('Cache-Control', 'no-store').type('application/javascript').send(RETIRED_WORKER);
    }
    if (/\.html?\/?$/i.test(pathname) || pathname.endsWith('/')) {
      return res.status(302).set('Cache-Control', 'no-store').set('Location', '/download').end();
    }
    return res.status(403).set('Cache-Control', 'no-store').json({ ok: false, error: 'desktop_required', downloadUrl: '/download' });
  }

  function allowSocketRequest(req, callback) {
    const allowed = !enabled || isDesktopRenderer(req.headers) || isLauncherProcess(req.headers);
    callback(allowed ? null : 'desktop_required', allowed);
  }

  function installSocketGuard(socket) {
    if (!enabled || isDesktopRenderer(socket.handshake.headers)) return;
    socket.use((packet, next) => {
      if (isLauncherProcess(socket.handshake.headers) && LAUNCHER_EVENTS.has(String(packet[0] || ''))) return next();
      const ack = packet.findLast(value => typeof value === 'function');
      ack?.({ ok: false, error: 'desktop_required', downloadUrl: '/download' });
      if (!ack) socket.emit('ERROR', { error: 'desktop_required', message: '請從桌面啟動器進入遊戲。' });
    });
  }
  return { middleware, allowSocketRequest, installSocketGuard, mediaCount: media.size, enabled };
}

module.exports = { createDesktopDistribution, isDesktopRenderer, isLauncherProcess, requestPath, RETIRED_WORKER };
