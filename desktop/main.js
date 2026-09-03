'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { Readable } = require('node:stream');
const {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  protocol,
  session
} = require('electron');
const { AuthService } = require('./auth-service');
const { AssetStore, availableBytes, safeAssetPath } = require('./asset-store');
const { resetDesktopGameWebCache, shouldBlockServiceWorkerRequest } = require('./game-session-policy');

const REMOTE_ORIGIN = 'https://onepiece-card-online.onrender.com';
const LAUNCHER_SCHEME = 'opui';
const CACHE_SCHEME = 'opcache';
const SMOKE_MODE = process.env.OP_DESKTOP_SMOKE === '1';
const SMOKE_REPORT_PATH = String(process.env.OP_DESKTOP_SMOKE_REPORT || '').trim();
const SMOKE_MEDIA_ASSETS = String(process.env.OP_DESKTOP_SMOKE_MEDIA_ASSETS || '').trim();
const SCREENSHOT_PATH = String(process.env.OP_DESKTOP_SCREENSHOT_PATH || '').trim();
const TEST_USER_DATA_PATH = String(process.env.OP_DESKTOP_USER_DATA || '').trim();
const TEST_VIEWPORT = String(process.env.OP_DESKTOP_VIEWPORT || '').trim();
const ALLOWED_GAME_IDS = new Set(['card', 'board']);
const AUTH_STORAGE_KEYS = [
  'opSecret', 'op_secret', 'op_user_id', 'op_board_user_id', 'op_name',
  'op_player_name', 'op_avatar', 'op_player_avatar', 'op_board_title',
  'op_board_coins', 'op_device_id', 'op_last_password'
];
const GAME_CONFIG = {
  card: { title: '偉大航道爭霸戰', entry: '/start.html', partition: 'onepiece-card-desktop-v1' },
  board: { title: '新世界航海錄', entry: '/board_start.html', partition: 'onepiece-board-desktop-v1' }
};

if (TEST_USER_DATA_PATH && (SMOKE_MODE || !app.isPackaged)) {
  app.setPath('userData', path.resolve(TEST_USER_DATA_PATH));
}

protocol.registerSchemesAsPrivileged([
  {
    scheme: LAUNCHER_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  },
  {
    scheme: CACHE_SCHEME,
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }
]);

let mainWindow = null;
let authService = null;
let assetStore = null;
let authenticated = false;
let readyPromise = null;
let smokeFinished = false;
const gameWindows = new Map();
const gameSessions = new Map();
const tokenEntries = new Map();

function mimeForPath(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return new Map([
    ['.png', 'image/png'], ['.jpg', 'image/jpeg'], ['.jpeg', 'image/jpeg'], ['.jfif', 'image/jpeg'],
    ['.webp', 'image/webp'], ['.gif', 'image/gif'], ['.svg', 'image/svg+xml'], ['.avif', 'image/avif'],
    ['.mp3', 'audio/mpeg'], ['.wav', 'audio/wav'], ['.ogg', 'audio/ogg'], ['.m4a', 'audio/mp4'],
    ['.aac', 'audio/aac'], ['.flac', 'audio/flac'], ['.mp4', 'video/mp4'], ['.webm', 'video/webm'],
    ['.mov', 'video/quicktime'], ['.m4v', 'video/x-m4v'], ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2'], ['.ttf', 'font/ttf'], ['.otf', 'font/otf']
  ]).get(extension) || 'application/octet-stream';
}

function launcherWindowSize() {
  if (!(SMOKE_MODE || SCREENSHOT_PATH) || !TEST_VIEWPORT) return { width: 1440, height: 900 };
  const match = /^(\d{3,4})x(\d{3,4})$/i.exec(TEST_VIEWPORT);
  if (!match) return { width: 1440, height: 900 };
  return {
    width: Math.max(960, Math.min(3840, Number(match[1]))),
    height: Math.max(640, Math.min(2160, Number(match[2])))
  };
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

async function streamFileResponse(request, filePath, options = {}) {
  const method = String(request.method || 'GET').toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  }
  let info;
  try {
    info = await fsp.stat(filePath);
    if (!info.isFile()) throw new Error('not file');
  } catch {
    return new Response('Not found', { status: 404 });
  }
  const etag = `"${options.sha256 || `${info.size.toString(16)}-${Math.floor(info.mtimeMs).toString(16)}`}"`;
  const headers = new Headers({
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Content-Type': options.mime || mimeForPath(filePath),
    'Cross-Origin-Resource-Policy': 'cross-origin',
    'X-Content-Type-Options': 'nosniff',
    ETag: etag
  });
  if (options.remoteAsset) {
    headers.set('Access-Control-Allow-Origin', REMOTE_ORIGIN);
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag, X-OnePiece-Desktop-Cache');
    headers.set('X-OnePiece-Desktop-Cache', 'hit');
  }
  if (method === 'HEAD') {
    headers.set('Content-Length', String(info.size));
    return new Response(null, { status: 200, headers });
  }
  const range = parseRange(request.headers.get('range'), info.size);
  if (range?.invalid) {
    headers.set('Content-Range', `bytes */${info.size}`);
    headers.set('Content-Length', '0');
    return new Response(null, { status: 416, headers });
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? Math.max(0, info.size - 1);
  const length = info.size === 0 ? 0 : end - start + 1;
  headers.set('Content-Length', String(length));
  if (range) headers.set('Content-Range', `bytes ${start}-${end}/${info.size}`);
  if (length === 0) return new Response(null, { status: range ? 206 : 200, headers });
  const body = Readable.toWeb(fs.createReadStream(filePath, { start, end }));
  return new Response(body, { status: range ? 206 : 200, headers });
}

function launcherResourceRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'launcher-assets')
    : path.resolve(__dirname, '..', 'public');
}

function catalogResourceRoot() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'catalog')
    : path.resolve(__dirname, '..', 'public', 'desktop');
}

function applicationIconPath() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'launcher-icon.ico')
    : path.join(__dirname, 'assets', 'one_piece_tabletop_launcher_icon_v1.ico');
}

function resolveLauncherResource(requestUrl) {
  try {
    const parsed = new URL(requestUrl);
    if (parsed.protocol !== `${LAUNCHER_SCHEME}:` || parsed.hostname !== 'launcher') return null;
    const relativePath = decodeURIComponent(parsed.pathname).replace(/^\/+/, '');
    if (relativePath.includes('\\') || relativePath.includes('\0') || path.posix.normalize(relativePath) !== relativePath) return null;
    const allowed = [
      /^images\/game_launcher\/[A-Za-z0-9._-]+$/,
      /^images\/desktop_launcher\/[A-Za-z0-9._-]+$/,
      /^images\/board\/avatars\/(?:[1-9]|[1-4][0-9]|50)\.webp$/,
      /^videos\/game_launcher\/[A-Za-z0-9._-]+$/
    ];
    if (!allowed.some((pattern) => pattern.test(relativePath))) return null;
    const root = launcherResourceRoot();
    const absolute = path.resolve(root, ...relativePath.split('/'));
    const relation = path.relative(root, absolute);
    if (!relation || relation === '..' || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) return null;
    return absolute;
  } catch {
    return null;
  }
}

async function installLauncherProtocol() {
  await protocol.handle(LAUNCHER_SCHEME, async (request) => {
    const filePath = resolveLauncherResource(request.url);
    return filePath ? streamFileResponse(request, filePath) : new Response('Not found', { status: 404 });
  });
}

function assetToken(gameId, asset) {
  return crypto.createHash('sha256').update(`${gameId}\0${asset.path}\0${asset.sha256}`).digest('hex');
}

function requestAssetPath(requestUrl) {
  try {
    const parsed = new URL(requestUrl);
    if (parsed.origin !== REMOTE_ORIGIN) return null;
    return safeAssetPath(decodeURIComponent(parsed.pathname).replace(/^\/+/, ''))?.path || null;
  } catch {
    return null;
  }
}

function remoteAssetUrl(assetPath) {
  return `${REMOTE_ORIGIN}/${assetPath.split('/').map((segment) => encodeURIComponent(segment)).join('/')}`;
}

function hardenSession(targetSession) {
  targetSession.setPermissionCheckHandler(() => false);
  targetSession.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  targetSession.on('will-download', (event) => event.preventDefault());
}

async function prepareGameSession(gameId) {
  const targetSession = session.fromPartition(GAME_CONFIG[gameId].partition);
  await resetDesktopGameWebCache(targetSession, REMOTE_ORIGIN);
  if (gameSessions.has(gameId)) return gameSessions.get(gameId);
  hardenSession(targetSession);
  await targetSession.protocol.handle(CACHE_SCHEME, async (request) => {
    try {
      const parsed = new URL(request.url);
      if (parsed.hostname !== 'asset') return new Response('Not found', { status: 404 });
      const token = parsed.pathname.replace(/^\/+/, '');
      const entry = tokenEntries.get(token);
      if (!entry || entry.gameId !== gameId) return new Response('Not found', { status: 404 });
      return streamFileResponse(request, entry.filePath, { mime: entry.mime, sha256: entry.sha256, remoteAsset: true });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });
  targetSession.webRequest.onBeforeRequest(
    { urls: [`${REMOTE_ORIGIN}/sw.js*`, `${REMOTE_ORIGIN}/images/*`, `${REMOTE_ORIGIN}/audio/*`, `${REMOTE_ORIGIN}/videos/*`, `${REMOTE_ORIGIN}/fonts/*`] },
    (details, callback) => {
      if (shouldBlockServiceWorkerRequest(details, REMOTE_ORIGIN)) return callback({ cancel: true });
      const assetPath = requestAssetPath(details.url);
      if (!assetPath) return callback({});
      assetStore.resolveAsset(gameId, assetPath).then((asset) => {
        if (!asset) return callback({});
        const token = assetToken(gameId, asset);
        tokenEntries.set(token, { ...asset, gameId });
        callback({ redirectURL: `${CACHE_SCHEME}://asset/${token}` });
      }).catch(() => callback({}));
    }
  );
  gameSessions.set(gameId, targetSession);
  return targetSession;
}

async function chooseDefaultCacheRoot() {
  const explicit = String(process.env.OP_DESKTOP_CACHE_ROOT || '').trim();
  if (explicit) return path.resolve(explicit);
  const candidates = [path.join(app.getPath('documents'), 'ONE PIECE Tabletop Games')];
  if (process.platform === 'win32') {
    for (const drive of ['D:\\', 'E:\\']) {
      try {
        const info = await fsp.stat(drive);
        if (info.isDirectory()) candidates.push(path.join(drive, 'ONE PIECE Tabletop Games'));
      } catch {
        // Drive is not present.
      }
    }
  }
  const measured = [];
  for (const candidate of candidates) {
    try { measured.push({ candidate, bytes: await availableBytes(candidate) }); } catch { /* skip */ }
  }
  measured.sort((left, right) => right.bytes - left.bytes);
  return measured[0]?.candidate || candidates[0];
}

async function composeState(assetSnapshot) {
  const assets = assetSnapshot || await assetStore.getState();
  const previewMode = authService?.previewMode === true || SMOKE_MODE;
  return {
    authenticated,
    previewMode,
    profile: authenticated || previewMode ? (authService.accountSummary() || { name: '羅盤測試員', avatar: 8, title: 'LAUNCHER PREVIEW' }) : null,
    ...assets
  };
}

async function broadcastState(assetSnapshot) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('launcher:state', await composeState(assetSnapshot));
}

function broadcastProgress(progress) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('launcher:progress', progress);
}

function isLauncherSender(event) {
  if (!mainWindow || mainWindow.isDestroyed() || event.sender.id !== mainWindow.webContents.id) return false;
  const senderUrl = event.sender.getURL();
  return senderUrl.startsWith('file:') && senderUrl.endsWith('/launcher.html');
}

function publicError(error, fallback = '操作失敗，請稍後再試。') {
  const message = String(error?.message || '').trim();
  return message && message.length <= 180 ? message : fallback;
}

function registerLauncherIpc() {
  const guarded = (handler) => async (event, ...args) => {
    if (!isLauncherSender(event)) return { ok: false, error: '拒絕未授權的啟動器要求。' };
    try {
      await readyPromise;
      return await handler(event, ...args);
    } catch (error) {
      return { ok: false, error: publicError(error) };
    }
  };

  ipcMain.handle('launcher:get-state', guarded(async () => composeState()));
  ipcMain.handle('launcher:enter-preview', guarded(async () => {
    if (!authService.previewMode) return { ok: false, error: '正式版不提供略過登入。' };
    return composeState();
  }));
  ipcMain.handle('launcher:login', guarded(async (_event, credentials) => authenticate('login', credentials)));
  ipcMain.handle('launcher:register', guarded(async (_event, credentials) => authenticate('register', credentials)));
  ipcMain.handle('launcher:logout', guarded(async () => {
    authenticated = false;
    await closeGameWindows();
    await clearGameSessionStorage();
    await authService.clearAccount();
    const state = await composeState();
    await broadcastState();
    return { ok: true, state };
  }));
  ipcMain.handle('launcher:install-game', guarded(async (_event, gameId) => {
    if (!authenticated || authService.previewMode) return { ok: false, error: '請先以正式帳號登入。' };
    if (!ALLOWED_GAME_IDS.has(gameId)) return { ok: false, error: '此遊戲尚未開放下載。' };
    return assetStore.installGame(gameId);
  }));
  ipcMain.handle('launcher:cancel-install', guarded(async (_event, gameId) => {
    if (!ALLOWED_GAME_IDS.has(gameId)) return { ok: false, error: '遊戲代號不正確。' };
    return assetStore.cancelInstall(gameId);
  }));
  ipcMain.handle('launcher:launch-game', guarded(async (_event, gameId) => launchGame(gameId)));
  ipcMain.handle('launcher:choose-cache-location', guarded(async () => {
    if (assetStore.activeInstall) return { ok: false, error: '請先暫停目前下載。' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇遊戲下載位置',
      defaultPath: assetStore.cacheRoot,
      properties: ['openDirectory', 'createDirectory', 'promptToCreate']
    });
    if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true, state: await composeState() };
    await assetStore.setCacheRoot(result.filePaths[0]);
    await authService.setCacheRoot(assetStore.cacheRoot);
    return { ok: true, state: await composeState() };
  }));

  ipcMain.on('game:get-bootstrap', (event) => {
    if (!event.senderFrame || event.senderFrame !== event.sender.mainFrame) {
      event.returnValue = { keys: {}, clearKeys: AUTH_STORAGE_KEYS };
      return;
    }
    const matched = [...gameWindows.entries()].find(([, window]) => !window.isDestroyed() && window.webContents.id === event.sender.id);
    if (!matched || !authenticated) {
      event.returnValue = { keys: {}, clearKeys: AUTH_STORAGE_KEYS };
      return;
    }
    event.returnValue = { keys: authService.getGameBootstrap() || {}, clearKeys: AUTH_STORAGE_KEYS };
  });
}

function validCredentials(credentials) {
  const username = String(credentials?.username || '').trim().toLowerCase();
  const password = String(credentials?.password || '');
  if (!/^[a-z0-9_]{3,24}$/.test(username) || password.length < 6 || password.length > 72) return null;
  return { username, password };
}

async function authenticate(mode, credentials) {
  const valid = validCredentials(credentials);
  if (!valid) return { ok: false, error: 'missing credentials' };
  const result = await authService.authenticate(mode, valid);
  valid.password = '';
  if (!result?.ok) return { ok: false, error: String(result?.error || 'unknown').slice(0, 100) };
  authenticated = true;
  const state = await composeState();
  await broadcastState();
  return { ok: true, state };
}

function isAllowedGameNavigation(targetUrl) {
  try { return new URL(targetUrl).origin === REMOTE_ORIGIN; } catch { return false; }
}

function hardenGameWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  for (const eventName of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
    window.webContents.on(eventName, (event, legacyUrl) => {
      const targetUrl = event.url ?? legacyUrl;
      if (!isAllowedGameNavigation(targetUrl)) event.preventDefault();
    });
  }
}

async function launchGame(gameId) {
  if (!authenticated || authService.previewMode) return { ok: false, error: '請先以正式帳號登入。' };
  if (!ALLOWED_GAME_IDS.has(gameId)) return { ok: false, error: '此遊戲仍在製作中。' };
  if (!assetStore.canLaunch(gameId)) return { ok: false, error: '請先完成遊戲下載或修復。' };
  const existing = gameWindows.get(gameId);
  if (existing && !existing.isDestroyed()) {
    existing.show();
    existing.focus();
    return { ok: true, focused: true };
  }
  const targetSession = await prepareGameSession(gameId);
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: true,
    autoHideMenuBar: true,
    backgroundColor: '#071b27',
    title: GAME_CONFIG[gameId].title,
    icon: applicationIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'game-preload.js'),
      session: targetSession,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  gameWindows.set(gameId, window);
  hardenGameWindow(window);
  window.on('closed', () => {
    gameWindows.delete(gameId);
    if (gameWindows.size === 0 && authenticated) authService.setPresence('desktop-launcher').catch(() => {});
  });
  window.webContents.on('render-process-gone', () => gameWindows.delete(gameId));
  try {
    await authService.setPresence(`desktop-${gameId}`);
    await window.loadURL(`${REMOTE_ORIGIN}${GAME_CONFIG[gameId].entry}?desktop=1`);
    return { ok: true };
  } catch (error) {
    gameWindows.delete(gameId);
    if (!window.isDestroyed()) window.destroy();
    await authService.setPresence('desktop-launcher').catch(() => {});
    return { ok: false, error: publicError(error, '無法連線到遊戲伺服器，請稍後重試。') };
  }
}

async function closeGameWindows() {
  const pending = [];
  for (const window of gameWindows.values()) {
    if (window.isDestroyed()) continue;
    pending.push(window.webContents.executeJavaScript(`for (const key of ${JSON.stringify(AUTH_STORAGE_KEYS)}) localStorage.removeItem(key);`, true).catch(() => {}));
  }
  await Promise.all(pending);
  for (const window of gameWindows.values()) if (!window.isDestroyed()) window.close();
  gameWindows.clear();
}

async function clearGameSessionStorage() {
  const results = await Promise.allSettled([...ALLOWED_GAME_IDS].map(async (gameId) => {
    const targetSession = gameSessions.get(gameId) || session.fromPartition(GAME_CONFIG[gameId].partition);
    await targetSession.clearStorageData({
      storages: ['localstorage', 'serviceworkers', 'cachestorage']
    });
  }));
  return results.every((result) => result.status === 'fulfilled');
}

function createMainWindow() {
  const size = launcherWindowSize();
  mainWindow = new BrowserWindow({
    width: size.width,
    height: size.height,
    minWidth: 960,
    minHeight: 640,
    show: !SMOKE_MODE && !SCREENSHOT_PATH,
    autoHideMenuBar: true,
    backgroundColor: '#061520',
    title: 'ONE PIECE TABLETOP SERIES',
    icon: applicationIconPath(),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });
  hardenSession(mainWindow.webContents.session);
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, targetUrl) => {
    if (targetUrl !== mainWindow.webContents.getURL()) event.preventDefault();
  });
  mainWindow.on('closed', () => { mainWindow = null; });
  mainWindow.loadFile(path.join(__dirname, 'launcher.html')).catch((error) => finishSmoke({ stage: 'load', error: error.message }, 1));
  mainWindow.webContents.once('did-finish-load', () => setTimeout(runVisualOrSmokeCapture, 1200));
}

async function runVisualOrSmokeCapture() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  try { await readyPromise; } catch (error) {
    finishSmoke({ stage: 'services', error: error.message }, 1);
    return;
  }
  const dom = await mainWindow.webContents.executeJavaScript(`({
    title: document.title,
    stage: document.body.dataset.stage,
    games: document.querySelectorAll('.game-rail-item').length,
    cover: document.querySelector('#featureCover')?.getAttribute('src') || '',
    hasApi: Boolean(window.onePieceDesktop)
  })`, true).catch((error) => ({ error: error.message }));
  let protocolSmoke = null;
  let installedMediaSmoke = null;
  if (SMOKE_MODE) {
    const probeUrl = `${LAUNCHER_SCHEME}://launcher/videos/game_launcher/board_battle_preview_v2.mp4`;
    try {
      const targetSession = mainWindow.webContents.session;
      const head = await targetSession.fetch(probeUrl, { method: 'HEAD' });
      const partial = await targetSession.fetch(probeUrl, { headers: { Range: 'bytes=0-1023' } });
      const partialBytes = (await partial.arrayBuffer()).byteLength;
      const suffix = await targetSession.fetch(probeUrl, { headers: { Range: 'bytes=-257' } });
      const suffixBytes = (await suffix.arrayBuffer()).byteLength;
      const invalid = await targetSession.fetch(probeUrl, { headers: { Range: 'bytes=99999999999-' } });
      protocolSmoke = {
        headStatus: head.status,
        headLength: head.headers.get('content-length'),
        partialStatus: partial.status,
        partialRange: partial.headers.get('content-range'),
        partialBytes,
        suffixStatus: suffix.status,
        suffixBytes,
        invalidStatus: invalid.status,
        invalidRange: invalid.headers.get('content-range')
      };
      protocolSmoke.ok = head.status === 200 && Number(protocolSmoke.headLength) > 1024 && partial.status === 206 &&
        partialBytes === 1024 && suffix.status === 206 && suffixBytes === 257 && invalid.status === 416;
    } catch (error) {
      protocolSmoke = { ok: false, error: error.message };
    }
    if (SMOKE_MEDIA_ASSETS) {
      try {
        const requested = JSON.parse(SMOKE_MEDIA_ASSETS);
        if (!Array.isArray(requested) || requested.length < 1 || requested.length > 8) throw new Error('Invalid media smoke asset list.');
        const results = [];
        for (const source of requested) {
          const gameId = String(source?.gameId || '');
          const assetPath = safeAssetPath(String(source?.path || ''))?.path;
          const expectedSha256 = String(source?.sha256 || '').toLowerCase();
          if (!ALLOWED_GAME_IDS.has(gameId) || !assetPath || !/^[a-f0-9]{64}$/.test(expectedSha256)) throw new Error('Invalid media smoke asset.');
          const targetSession = await prepareGameSession(gameId);
          const assetUrl = remoteAssetUrl(assetPath);
          const head = await targetSession.fetch(assetUrl, { method: 'HEAD', cache: 'no-store' });
          const rangeResponse = await targetSession.fetch(assetUrl, { cache: 'no-store', headers: { Range: 'bytes=0-1023' } });
          const rangeBytes = Buffer.from(await rangeResponse.arrayBuffer());
          const fullResponse = await targetSession.fetch(assetUrl, { cache: 'no-store' });
          const fullBytes = Buffer.from(await fullResponse.arrayBuffer());
          const result = {
            gameId,
            path: assetPath,
            headStatus: head.status,
            rangeStatus: rangeResponse.status,
            rangeBytes: rangeBytes.length,
            cacheHeader: fullResponse.headers.get('x-onepiece-desktop-cache'),
            contentType: fullResponse.headers.get('content-type'),
            fullStatus: fullResponse.status,
            fullBytes: fullBytes.length,
            sha256: crypto.createHash('sha256').update(fullBytes).digest('hex')
          };
          result.ok = result.headStatus === 200 && result.rangeStatus === 206 && result.rangeBytes > 0 && result.rangeBytes <= 1024 &&
            result.fullStatus === 200 && result.cacheHeader === 'hit' && result.sha256 === expectedSha256;
          results.push(result);
        }
        installedMediaSmoke = { ok: results.every((result) => result.ok), results };
      } catch (error) {
        installedMediaSmoke = { ok: false, error: error.message };
      }
    }
  }
  if (SCREENSHOT_PATH) {
    const image = await mainWindow.webContents.capturePage();
    await fsp.mkdir(path.dirname(path.resolve(SCREENSHOT_PATH)), { recursive: true });
    await fsp.writeFile(path.resolve(SCREENSHOT_PATH), image.toPNG());
  }
  if (SMOKE_MODE) finishSmoke(
    { stage: 'launcher-ready', dom, protocolSmoke, installedMediaSmoke, state: await composeState() },
    dom.hasApi && dom.games === 3 && protocolSmoke?.ok === true && (!SMOKE_MEDIA_ASSETS || installedMediaSmoke?.ok === true) ? 0 : 1
  );
  else if (SCREENSHOT_PATH) app.quit();
}

function finishSmoke(extra, code) {
  if (!SMOKE_MODE || smokeFinished) return;
  smokeFinished = true;
  const report = `${JSON.stringify({ ok: code === 0, electron: process.versions.electron, ...extra })}\n`;
  if (SMOKE_REPORT_PATH) {
    fs.mkdirSync(path.dirname(path.resolve(SMOKE_REPORT_PATH)), { recursive: true });
    fs.writeFileSync(path.resolve(SMOKE_REPORT_PATH), report, 'utf8');
  }
  process.stdout.write(report, () => app.exit(code));
  setTimeout(() => app.exit(code), 1200).unref();
}

async function initializeServices() {
  authService = new AuthService({ origin: REMOTE_ORIGIN, userDataPath: app.getPath('userData') });
  await authService.load();
  const cacheRoot = authService.state.cacheRoot || await chooseDefaultCacheRoot();
  if (!authService.state.cacheRoot) await authService.setCacheRoot(cacheRoot);
  assetStore = new AssetStore({
    origin: REMOTE_ORIGIN,
    bundledCatalogRoot: catalogResourceRoot(),
    cacheRoot,
    fetchImpl: (url, options) => session.fromPartition('onepiece-downloads-v1').fetch(url, options)
  });
  hardenSession(session.fromPartition('onepiece-downloads-v1'));
  await assetStore.init();
  const restored = await authService.restore();
  authenticated = restored?.ok === true && authService.previewMode !== true;
  assetStore.on('state', (state) => broadcastState(state).catch(() => {}));
  assetStore.on('progress', broadcastProgress);
  authService.on('kicked', async () => {
    authenticated = false;
    await closeGameWindows();
    await clearGameSessionStorage();
    mainWindow?.webContents.send('launcher:session-kicked', {});
    await broadcastState();
  });
  assetStore.refreshRemoteCatalog().catch(() => {});
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      if (app.isReady()) createMainWindow();
      return;
    }
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  });
  app.whenReady().then(async () => {
    app.setAppUserModelId('com.onepiece.tabletop.desktop');
    await installLauncherProtocol();
    registerLauncherIpc();
    readyPromise = initializeServices();
    createMainWindow();
    if (SMOKE_MODE) setTimeout(() => finishSmoke({ stage: 'timeout', error: 'Launcher smoke timed out.' }, 1), 60_000).unref();
  }).catch((error) => {
    if (SMOKE_MODE) finishSmoke({ stage: 'startup', error: error.message }, 1);
    else {
      dialog.showErrorBox('啟動器無法開啟', publicError(error, '請重新安裝啟動器後再試。'));
      app.quit();
    }
  });
}

app.on('before-quit', () => authService?.close());
app.on('window-all-closed', () => app.quit());

module.exports = { parseRange, streamFileResponse };
