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
  Menu,
  protocol,
  session,
  systemPreferences,
  Tray
} = require('electron');

function configureGpuPreference(commandLine) {
  // Prefer a discrete GPU without bypassing Chromium's driver safety checks.
  // Explicit troubleshooting / power-saving switches remain authoritative.
  if (commandLine.hasSwitch('disable-gpu')) return 'software';
  if (commandLine.hasSwitch('force_low_power_gpu')) return 'low-power';
  if (!commandLine.hasSwitch('force_high_performance_gpu')) {
    commandLine.appendSwitch('force_high_performance_gpu');
  }
  return 'high-performance';
}

const GPU_PREFERENCE = configureGpuPreference(app.commandLine);
let gpuInfoUpdated = false;
app.on('gpu-info-update', () => { gpuInfoUpdated = true; });

const { AuthService } = require('./auth-service');
const { AssetStore, availableBytes, blobPath, safeAssetPath } = require('./asset-store');
const { resetDesktopGameWebCache, shouldBlockServiceWorkerRequest } = require('./game-session-policy');
const { LauncherUpdateService } = require('./launcher-update-service');
const { RuntimeAssetCache } = require('./runtime-asset-cache');
const { installGameCursorPolicy } = require('./game-cursor-policy');

const REMOTE_ORIGIN = 'https://onepiece-card-online.onrender.com';
const ASSET_ORIGIN = 'https://game-assets.rihdi.tw';
const LAUNCHER_SCHEME = 'opui';
const CACHE_SCHEME = 'opcache';
const SMOKE_MODE = process.env.OP_DESKTOP_SMOKE === '1';
const SMOKE_REPORT_PATH = String(process.env.OP_DESKTOP_SMOKE_REPORT || '').trim();
const SMOKE_MEDIA_ASSETS = String(process.env.OP_DESKTOP_SMOKE_MEDIA_ASSETS || '').trim();
const SCREENSHOT_PATH = String(process.env.OP_DESKTOP_SCREENSHOT_PATH || '').trim();
const SCREENSHOT_VIEW = String(process.env.OP_DESKTOP_SCREENSHOT_VIEW || '').trim();
const TEST_USER_DATA_PATH = String(process.env.OP_DESKTOP_USER_DATA || '').trim();
const TEST_VIEWPORT = String(process.env.OP_DESKTOP_VIEWPORT || '').trim();
const EXPLICIT_CACHE_ROOT = String(process.env.OP_DESKTOP_CACHE_ROOT || '').trim();
const ALLOWED_GAME_IDS = new Set(['card', 'board', 'chess']);
const GAME_LAUNCH_PRESENTATION_MS = 1400;
const AUTH_STORAGE_KEYS = [
  'opSecret', 'op_secret', 'op_user_id', 'op_board_user_id', 'op_name',
  'op_player_name', 'op_avatar', 'op_player_avatar', 'op_board_title',
  'op_board_coins', 'op_device_id', 'op_last_password'
];
const GAME_CONFIG = {
  card: { title: '偉大航道爭霸戰', entry: '/start.html', partition: 'onepiece-card-desktop-v1' },
  board: { title: '新世界航海錄', entry: '/board_start.html', partition: 'onepiece-board-desktop-v1' },
  chess: { title: '霸海戰棋', entry: '/chess/index.html', partition: 'onepiece-chess-desktop-v1' }
};

if (TEST_USER_DATA_PATH && (SMOKE_MODE || !app.isPackaged)) {
  app.setPath('userData', path.resolve(TEST_USER_DATA_PATH));
}

function persistedCacheRoot(userDataPath) {
  const stateDirectory = path.join(userDataPath, 'state');
  let newest = null;
  for (const fileName of ['launcher-state-a.json', 'launcher-state-b.json']) {
    try {
      const candidate = JSON.parse(fs.readFileSync(path.join(stateDirectory, fileName), 'utf8'));
      if (
        !Number.isSafeInteger(candidate?.generation) ||
        typeof candidate?.cacheRoot !== 'string' ||
        !path.isAbsolute(candidate.cacheRoot)
      ) continue;
      if (!newest || candidate.generation > newest.generation) newest = candidate;
    } catch {
      // First launch, an interrupted state slot, or an unavailable drive uses Electron's default path.
    }
  }
  return newest?.cacheRoot || '';
}

function configureSessionDataPath() {
  try {
    const userDataPath = app.getPath('userData');
    const cacheRoot = EXPLICIT_CACHE_ROOT
      ? path.resolve(EXPLICIT_CACHE_ROOT)
      : TEST_USER_DATA_PATH && (SMOKE_MODE || !app.isPackaged)
        ? path.resolve(TEST_USER_DATA_PATH, 'download-cache')
        : persistedCacheRoot(userDataPath);
    if (!cacheRoot) return '';
    const sessionDataPath = path.resolve(cacheRoot, 'runtime', 'chromium-session-v1');
    fs.mkdirSync(sessionDataPath, { recursive: true });
    app.setPath('sessionData', sessionDataPath);
    return sessionDataPath;
  } catch {
    // The launcher can still start and let the player choose a different writable drive.
    return '';
  }
}

const SESSION_DATA_PATH = configureSessionDataPath();

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
let tray = null;
let launcherHiddenForGame = false;
let appQuitting = false;
let authService = null;
let assetStore = null;
let launcherUpdateService = null;
let authenticated = false;
let readyPromise = null;
let smokeFinished = false;
const gameWindows = new Map();
const gameLaunchPromises = new Map();
const gameSessions = new Map();
const gameSessionPromises = new Map();
const runtimeRepairChecks = new Map();
const runtimeAssetCache = new RuntimeAssetCache();
const hardenedSessions = new WeakSet();

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

function destroyTray() {
  if (!tray || tray.isDestroyed()) {
    tray = null;
    return;
  }
  tray.destroy();
  tray = null;
}

function restoreLauncherFromTray() {
  if (appQuitting) return;
  launcherHiddenForGame = false;
  destroyTray();
  if (!mainWindow || mainWindow.isDestroyed()) {
    if (app.isReady()) createMainWindow();
    return;
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
}

function ensureTray() {
  if (tray && !tray.isDestroyed()) return tray;
  tray = new Tray(applicationIconPath());
  tray.setToolTip('ONE PIECE TABLETOP SERIES 啟動器');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: '顯示啟動器', click: restoreLauncherFromTray }
  ]));
  tray.on('click', restoreLauncherFromTray);
  tray.on('double-click', restoreLauncherFromTray);
  return tray;
}

function hideLauncherToTray() {
  if (!mainWindow || mainWindow.isDestroyed()) return false;
  try {
    ensureTray();
    launcherHiddenForGame = true;
    mainWindow.hide();
    return true;
  } catch {
    launcherHiddenForGame = false;
    destroyTray();
    return false;
  }
}

function restoreLauncherAfterLastGame() {
  if (gameWindows.size === 0 && launcherHiddenForGame) restoreLauncherFromTray();
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
  if (hardenedSessions.has(targetSession)) return;
  hardenedSessions.add(targetSession);
  targetSession.on('will-download', (event) => event.preventDefault());
}

function gameSessionPaths(gameId) {
  const cacheRoot = path.resolve(assetStore.cacheRoot);
  return {
    codeCache: path.join(cacheRoot, 'runtime', 'code-cache', gameId)
  };
}

function buildRuntimeAssetIndex(gameId) {
  const manifest = assetStore.getInstalledManifest(gameId);
  if (!manifest) throw new Error('找不到已安裝的遊戲素材清單。');
  return runtimeAssetCache.buildGame(gameId, manifest, {
    filePathForAsset: (asset) => blobPath(assetStore.cacheRoot, asset.sha256)
  });
}

function queueRuntimeAssetRepair(entry, error) {
  if (!entry || error?.code === 'ERR_RUNTIME_ASSET_STALE') return;
  runtimeAssetCache.clearGame(entry.gameId);
  const key = entry.gameId;
  if (runtimeRepairChecks.has(key)) return;
  const check = assetStore.resolveAsset(entry.gameId, entry.path).then((asset) => {
    if (!asset || !assetStore.canLaunch(entry.gameId)) return;
    const gameWindow = gameWindows.get(entry.gameId);
    if (gameWindow && !gameWindow.isDestroyed()) buildRuntimeAssetIndex(entry.gameId);
  }).catch(() => {}).finally(() => runtimeRepairChecks.delete(key));
  runtimeRepairChecks.set(key, check);
}

async function storageSessionForGame(gameId) {
  if (gameSessions.has(gameId)) return gameSessions.get(gameId);
  const sessionPaths = gameSessionPaths(gameId);
  await fsp.mkdir(sessionPaths.codeCache, { recursive: true });
  const targetSession = session.fromPartition(GAME_CONFIG[gameId].partition, { cache: false });
  targetSession.setCodeCachePath(sessionPaths.codeCache);
  return targetSession;
}

async function clearGameOriginStorage(targetSession) {
  await resetDesktopGameWebCache(targetSession, REMOTE_ORIGIN);
  await targetSession.clearStorageData({
    origin: REMOTE_ORIGIN,
    storages: ['localstorage']
  });
}

async function prepareGameSession(gameId) {
  if (gameSessionPromises.has(gameId)) return gameSessionPromises.get(gameId);
  const pending = (async () => {
    buildRuntimeAssetIndex(gameId);
    const targetSession = await storageSessionForGame(gameId);
    await resetDesktopGameWebCache(targetSession, REMOTE_ORIGIN);
    if (gameSessions.has(gameId)) return gameSessions.get(gameId);
    hardenSession(targetSession);
    await targetSession.protocol.handle(CACHE_SCHEME, async (request) => {
      try {
        const parsed = new URL(request.url);
        if (parsed.hostname !== 'asset') return new Response('Not found', { status: 404 });
        const token = parsed.pathname.replace(/^\/+/, '');
        const entry = runtimeAssetCache.lookupToken(gameId, token);
        if (!entry) return new Response('Not found', { status: 404 });
        return runtimeAssetCache.createResponse(request, entry, {
          allowedOrigin: REMOTE_ORIGIN,
          onFailure: queueRuntimeAssetRepair
        });
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
        const entry = runtimeAssetCache.lookupPath(gameId, assetPath);
        return callback(entry ? { redirectURL: `${CACHE_SCHEME}://asset/${entry.token}` } : {});
      }
    );
    gameSessions.set(gameId, targetSession);
    return targetSession;
  })();
  gameSessionPromises.set(gameId, pending);
  try {
    return await pending;
  } finally {
    if (gameSessionPromises.get(gameId) === pending) gameSessionPromises.delete(gameId);
  }
}

function disposeGameSessions() {
  runtimeAssetCache.clearAll();
  runtimeRepairChecks.clear();
  for (const targetSession of gameSessions.values()) {
    try { targetSession.webRequest.onBeforeRequest(null); } catch { /* already disposed */ }
    try {
      if (targetSession.protocol.isProtocolHandled(CACHE_SCHEME)) targetSession.protocol.unhandle(CACHE_SCHEME);
    } catch {
      // The session may already be shutting down.
    }
  }
  gameSessions.clear();
  gameSessionPromises.clear();
}

async function chooseDefaultCacheRoot() {
  if (EXPLICIT_CACHE_ROOT) return path.resolve(EXPLICIT_CACHE_ROOT);
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
    preferences: authService?.getPreferences() || {
      minimizeToTrayOnGameLaunch: false,
      gameDisplayMode: 'borderless'
    },
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

function broadcastLauncherUpdate() {
  if (!mainWindow || mainWindow.isDestroyed() || !launcherUpdateService) return;
  mainWindow.webContents.send('launcher:update-state', launcherUpdateService.getState());
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
    runtimeAssetCache.clearAll();
    await authService.clearAccount();
    const state = await composeState();
    await broadcastState();
    return { ok: true, state };
  }));
  ipcMain.handle('launcher:set-preferences', guarded(async (_event, preferences) => {
    const keys = preferences && typeof preferences === 'object' && !Array.isArray(preferences)
      ? Object.keys(preferences)
      : [];
    const allowedKeys = new Set(['minimizeToTrayOnGameLaunch', 'gameDisplayMode']);
    const hasMinimizePreference = Object.prototype.hasOwnProperty.call(preferences || {}, 'minimizeToTrayOnGameLaunch');
    const hasDisplayModePreference = Object.prototype.hasOwnProperty.call(preferences || {}, 'gameDisplayMode');
    if (
      keys.length < 1 ||
      keys.length > allowedKeys.size ||
      keys.some((key) => !allowedKeys.has(key)) ||
      (hasMinimizePreference && typeof preferences.minimizeToTrayOnGameLaunch !== 'boolean') ||
      (hasDisplayModePreference && !['borderless', 'fullscreen'].includes(preferences.gameDisplayMode))
    ) {
      return { ok: false, error: '啟動器設定格式不正確。' };
    }
    await authService.setPreferences(preferences);
    const state = await composeState();
    await broadcastState();
    return { ok: true, state };
  }));
  ipcMain.handle('launcher:get-update-state', guarded(async () => ({
    ok: true,
    state: launcherUpdateService.getState()
  })));
  ipcMain.handle('launcher:check-update', guarded(async () => ({
    ok: true,
    state: await launcherUpdateService.checkForUpdates()
  })));
  ipcMain.handle('launcher:download-update', guarded(async () => ({
    ok: true,
    state: await launcherUpdateService.downloadUpdate()
  })));
  ipcMain.handle('launcher:apply-update', guarded(async () => {
    if (gameLaunchPromises.size > 0 || gameWindows.size > 0) {
      return { ok: false, error: '請先在遊戲中存檔並關閉所有遊戲，再重新啟動更新。' };
    }
    if (assetStore.activeInstall || assetStore.activeRemoval) {
      return { ok: false, error: '請先等待遊戲下載或移除完成，再重新啟動更新。' };
    }
    const state = launcherUpdateService.getState();
    await launcherUpdateService.installReadyUpdate();
    return { ok: true, state: { ...state, status: 'applying', error: '' } };
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
  ipcMain.handle('launcher:uninstall-game', guarded(async (_event, gameId) => {
    if (!authenticated || authService.previewMode) return { ok: false, error: '請先以正式帳號登入。' };
    if (!ALLOWED_GAME_IDS.has(gameId)) return { ok: false, error: '遊戲代號不正確。' };
    if (assetStore.activeInstall) return { ok: false, error: '請先暫停目前下載，再解除安裝。' };
    if (gameLaunchPromises.has(gameId)) return { ok: false, error: '遊戲正在啟動，請稍後再解除安裝。' };
    const openGameWindow = gameWindows.get(gameId);
    if (openGameWindow && !openGameWindow.isDestroyed()) {
      return { ok: false, error: '請先在遊戲中存檔並關閉該遊戲，再解除安裝。' };
    }
    await closeGameWindow(gameId);
    const result = await assetStore.uninstallGame(gameId);
    runtimeAssetCache.clearGame(gameId);
    return { ...result, state: await composeState() };
  }));
  ipcMain.handle('launcher:launch-game', guarded(async (_event, gameId) => launchGame(gameId)));
  ipcMain.handle('launcher:choose-cache-location', guarded(async () => {
    if (assetStore.activeInstall || assetStore.activeRemoval) {
      return { ok: false, error: '請先等待目前的下載或移除工作完成。' };
    }
    if (gameLaunchPromises.size > 0) return { ok: false, error: '遊戲正在啟動，請稍後再變更下載位置。' };
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '選擇遊戲下載位置',
      defaultPath: assetStore.cacheRoot,
      properties: ['openDirectory', 'createDirectory', 'promptToCreate']
    });
    if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true, state: await composeState() };
    if (assetStore.activeInstall || assetStore.activeRemoval || gameLaunchPromises.size > 0) {
      return { ok: false, error: '啟動、下載或移除狀態已變更，請稍後再變更下載位置。' };
    }
    await closeGameWindows();
    await Promise.allSettled([...gameSessionPromises.values()]);
    await Promise.allSettled([...runtimeRepairChecks.values()]);
    await clearGameSessionStorage();
    disposeGameSessions();
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
  window.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown' || input.key !== 'F11' || input.alt || input.control || input.meta) return;
    event.preventDefault();
    window.setFullScreen(!window.isFullScreen());
  });
  for (const eventName of ['will-navigate', 'will-frame-navigate', 'will-redirect']) {
    window.webContents.on(eventName, (event, legacyUrl) => {
      const targetUrl = event.url ?? legacyUrl;
      if (!isAllowedGameNavigation(targetUrl)) event.preventDefault();
    });
  }
}

function focusGameWindow(window) {
  if (window.isMinimized()) window.restore();
  const shouldUseFullscreen = authService.getPreferences().gameDisplayMode === 'fullscreen';
  if (window.isFullScreen() !== shouldUseFullscreen) window.setFullScreen(shouldUseFullscreen);
  window.show();
  window.focus();
  if (authService.getPreferences().minimizeToTrayOnGameLaunch) hideLauncherToTray();
  return { ok: true, focused: true };
}

function launchGame(gameId) {
  if (!authenticated || authService.previewMode) return { ok: false, error: '請先以正式帳號登入。' };
  if (!ALLOWED_GAME_IDS.has(gameId)) return { ok: false, error: '此遊戲仍在製作中。' };
  if (!assetStore.canLaunch(gameId)) return { ok: false, error: '請先完成遊戲下載或修復。' };
  const activeLaunch = gameLaunchPromises.get(gameId);
  if (activeLaunch) return activeLaunch;
  if (gameLaunchPromises.size > 0) return { ok: false, error: '另一款遊戲正在啟動，請稍候片刻。' };
  const existing = gameWindows.get(gameId);
  if (existing && !existing.isDestroyed()) return focusGameWindow(existing);
  const launchPromise = createGameWindow(gameId);
  gameLaunchPromises.set(gameId, launchPromise);
  return launchPromise.finally(() => {
    if (gameLaunchPromises.get(gameId) === launchPromise) gameLaunchPromises.delete(gameId);
  });
}

async function createGameWindow(gameId) {
  const launchStartedAt = Date.now();
  const targetSession = await prepareGameSession(gameId);
  if (!authenticated || authService.previewMode) return { ok: false, error: '請先以正式帳號登入。' };
  if (!assetStore.canLaunch(gameId)) return { ok: false, error: '遊戲檔案狀態已變更，請重新檢查或下載。' };
  const existing = gameWindows.get(gameId);
  if (existing && !existing.isDestroyed()) return focusGameWindow(existing);
  const shouldUseFullscreen = authService.getPreferences().gameDisplayMode === 'fullscreen';
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    fullscreen: shouldUseFullscreen,
    autoHideMenuBar: true,
    backgroundColor: '#071b27',
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#071b27',
      symbolColor: '#d8e3e6',
      height: 38
    },
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
  window.webContents.setAudioMuted(true);
  try {
    installGameCursorPolicy(window.webContents, gameId, {
      origin: REMOTE_ORIGIN,
      resourceRoot: app.isPackaged
        ? path.join(process.resourcesPath, 'cursor-policy')
        : path.join(__dirname, '..', 'public')
    });
  } catch {
    // Missing optional UI resources must not prevent launching the game.
    console.warn('[cursor] Local cursor policy unavailable; using the hosted page theme.');
  }
  gameWindows.set(gameId, window);
  hardenGameWindow(window);
  window.on('closed', () => {
    if (gameWindows.get(gameId) !== window) return;
    gameWindows.delete(gameId);
    runtimeAssetCache.clearGame(gameId);
    if (gameWindows.size === 0 && authenticated) authService.setPresence('desktop-launcher').catch(() => {});
    restoreLauncherAfterLastGame();
  });
  window.webContents.on('render-process-gone', () => {
    if (gameWindows.get(gameId) !== window) return;
    gameWindows.delete(gameId);
    runtimeAssetCache.clearGame(gameId);
    if (!window.isDestroyed()) window.destroy();
    if (gameWindows.size === 0 && authenticated) authService.setPresence('desktop-launcher').catch(() => {});
    restoreLauncherAfterLastGame();
  });
  try {
    await authService.setPresence(`desktop-${gameId}`);
    await window.loadURL(`${REMOTE_ORIGIN}${GAME_CONFIG[gameId].entry}?desktop=1`);
    if (gameWindows.get(gameId) !== window || window.isDestroyed() || !authenticated) {
      if (!window.isDestroyed()) window.destroy();
      restoreLauncherAfterLastGame();
      return { ok: false, error: '遊戲啟動已取消。' };
    }
    const prefersReducedMotion = systemPreferences.getAnimationSettings().prefersReducedMotion;
    const presentationDuration = prefersReducedMotion ? 80 : GAME_LAUNCH_PRESENTATION_MS;
    const presentationRemaining = Math.max(0, presentationDuration - (Date.now() - launchStartedAt));
    if (presentationRemaining > 0) await new Promise((resolve) => setTimeout(resolve, presentationRemaining));
    if (gameWindows.get(gameId) !== window || window.isDestroyed() || !authenticated) {
      if (!window.isDestroyed()) window.destroy();
      restoreLauncherAfterLastGame();
      return { ok: false, error: '遊戲啟動已取消。' };
    }
    window.show();
    window.focus();
    window.webContents.setAudioMuted(false);
    if (authService.getPreferences().minimizeToTrayOnGameLaunch) hideLauncherToTray();
    return { ok: true };
  } catch (error) {
    const failedWindowWasCurrent = gameWindows.get(gameId) === window;
    if (failedWindowWasCurrent) {
      gameWindows.delete(gameId);
      runtimeAssetCache.clearGame(gameId);
    }
    if (!window.isDestroyed()) window.destroy();
    if (failedWindowWasCurrent && gameWindows.size === 0 && authenticated) {
      await authService.setPresence('desktop-launcher').catch(() => {});
    }
    restoreLauncherAfterLastGame();
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
  restoreLauncherAfterLastGame();
}

async function closeGameWindow(gameId) {
  await gameSessionPromises.get(gameId)?.catch(() => {});
  await runtimeRepairChecks.get(gameId)?.catch(() => {});
  const target = gameWindows.get(gameId);
  if (target && !target.isDestroyed()) {
    await new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        resolve();
      };
      target.once('closed', done);
      target.close();
      setTimeout(() => {
        if (!target.isDestroyed()) target.destroy();
        done();
      }, 1500).unref();
    });
  }
  gameWindows.delete(gameId);
  runtimeAssetCache.clearGame(gameId);
  restoreLauncherAfterLastGame();
}

async function clearGameSessionStorage() {
  const results = await Promise.allSettled([...ALLOWED_GAME_IDS].map(async (gameId) => {
    const targetSession = await storageSessionForGame(gameId);
    await clearGameOriginStorage(targetSession);
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
    titleBarStyle: 'hidden',
    titleBarOverlay: {
      color: '#04111b',
      symbolColor: '#c1cdd1',
      height: 38
    },
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
  await mainWindow.webContents.executeJavaScript(`new Promise((resolve) => {
    const deadline = Date.now() + 15000;
    const check = () => {
      if (document.body.dataset.stage === 'app' && document.querySelectorAll('.game-rail-item').length === 3) return resolve();
      if (Date.now() >= deadline) return resolve();
      setTimeout(check, 50);
    };
    check();
  })`, true).catch(() => {});
  let traySmoke = null;
  const boxMotionViews = new Set(['box-crack', 'box-mid', 'box-open']);
  if (SCREENSHOT_PATH && (SMOKE_MODE || !app.isPackaged)) {
    mainWindow.show();
    if (['game-card', 'game-board', 'game-chess'].includes(SCREENSHOT_VIEW)) {
      await mainWindow.webContents.executeJavaScript(`selectGame(${JSON.stringify(SCREENSHOT_VIEW.replace('game-', ''))})`, true).catch(() => {});
    } else if (boxMotionViews.has(SCREENSHOT_VIEW)) {
      await mainWindow.webContents.executeJavaScript(`(async () => {
        selectGame('board');
        const feature = document.querySelector('#gameFeature');
        feature?.classList.add('is-launch-opening');
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const seekMs = ${JSON.stringify(SCREENSHOT_VIEW)} === 'box-crack' ? 400 : ${JSON.stringify(SCREENSHOT_VIEW)} === 'box-mid' ? 700 : 1250;
        for (const animation of feature?.getAnimations({ subtree: true }) || []) {
          const name = animation.animationName || '';
          if (name.startsWith('box') || name === 'featureBoxLidOpen' || name === 'featureAmbientFade' || name === 'featureBoxShadowOpen') {
            animation.currentTime = seekMs;
            animation.pause();
          }
        }
      })()`, true).catch(() => {});
    } else if (SCREENSHOT_VIEW === 'downloads') {
      await mainWindow.webContents.executeJavaScript(`switchPanel('downloads')`, true).catch(() => {});
    } else if (SCREENSHOT_VIEW === 'uninstall') {
      await mainWindow.webContents.executeJavaScript(`
        snapshot.games.board = { ...(snapshot.games.board || {}), status: 'installed', message: '已安裝，可以遊玩', hasInstalled: true, removable: true, installedVersion: 'qa-installed' };
        renderAll();
        switchPanel('downloads');
        openUninstallDialog('board');
      `, true).catch(() => {});
    } else if (['settings', 'settings-on', 'settings-update-current'].includes(SCREENSHOT_VIEW)) {
      await mainWindow.webContents.executeJavaScript(`(async () => {
        if (${JSON.stringify(SCREENSHOT_VIEW)} === 'settings-on') {
          openSettingsDialog();
          minimizeToTrayToggle.checked = true;
          await saveSettings();
        }
        renderAll();
        if (!settingsDialog.open) openSettingsDialog();
        if (${JSON.stringify(SCREENSHOT_VIEW)} === 'settings-update-current') await runLauncherUpdateAction();
      })()`, true).catch(() => {});
    } else if (SCREENSHOT_VIEW === 'cursor-click') {
      await mainWindow.webContents.executeJavaScript(`renderAll()`, true).catch(() => {});
    }
  }
  if (SMOKE_MODE && SCREENSHOT_VIEW === 'tray-cycle') {
    mainWindow.show();
    const hideResult = hideLauncherToTray();
    traySmoke = {
      hideResult,
      hidden: !mainWindow.isVisible(),
      trayCreated: Boolean(tray && !tray.isDestroyed())
    };
    restoreLauncherFromTray();
    traySmoke.restored = mainWindow.isVisible();
    traySmoke.trayDestroyedAfterRestore = !tray;
  }
  if (SCREENSHOT_PATH) {
    const captureDelay = boxMotionViews.has(SCREENSHOT_VIEW) ? 260 : SCREENSHOT_VIEW === 'cursor-click' ? 90 : 320;
    await new Promise((resolve) => setTimeout(resolve, captureDelay));
  }
  await mainWindow.webContents.executeJavaScript(`Promise.all([...document.images].map((image) => image.complete ? Promise.resolve() : image.decode().catch(() => {}))).then(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))))`, true).catch(() => {});
  if (SCREENSHOT_VIEW === 'cursor-click') {
    await mainWindow.webContents.executeJavaScript(`(() => {
      const rect = primaryAction.getBoundingClientRect();
      primaryAction.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        isPrimary: true,
        pointerType: 'mouse',
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }));
    })()`, true).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 70));
  }
  const dom = await mainWindow.webContents.executeJavaScript(`({
    title: document.title,
    stage: document.body.dataset.stage,
    games: document.querySelectorAll('.game-rail-item').length,
    cover: document.querySelector('#featureCover')?.getAttribute('src') || '',
    coverNaturalWidth: document.querySelector('#featureCover')?.naturalWidth || 0,
    frameNaturalWidth: document.querySelector('#featureFrame')?.naturalWidth || 0,
    boxWidth: Math.round(document.querySelector('.feature-box-art')?.getBoundingClientRect().width || 0),
    boxHeight: Math.round(document.querySelector('.feature-box-art')?.getBoundingClientRect().height || 0),
    coverStyle: (() => { const node = document.querySelector('#featureCover'); const style = node && getComputedStyle(node); return style ? { display: style.display, visibility: style.visibility, opacity: style.opacity, zIndex: style.zIndex } : null; })(),
    frameStyle: (() => { const node = document.querySelector('#featureFrame'); const style = node && getComputedStyle(node); return style ? { display: style.display, visibility: style.visibility, opacity: style.opacity, zIndex: style.zIndex } : null; })(),
    loadedBoxCovers: [...document.querySelectorAll('.game-box-cover')].filter((image) => image.getAttribute('src') && image.naturalWidth > 0).length,
    loadedBoxFrames: [...document.querySelectorAll('.game-box-frame')].filter((image) => image.getAttribute('src') && image.naturalWidth > 0).length,
    brokenImages: [...document.images].filter((image) => image.getAttribute('src') && image.complete && image.naturalWidth === 0).map((image) => image.getAttribute('src')),
    downloadsVisible: !document.querySelector('#downloadsPanel')?.hidden,
    downloadRows: document.querySelectorAll('.download-row').length,
    uninstallOpen: Boolean(document.querySelector('#uninstallDialog')?.open),
    settingsOpen: Boolean(document.querySelector('#settingsDialog')?.open),
    minimizeToTrayChecked: Boolean(document.querySelector('#minimizeToTrayToggle')?.checked),
    settingsDisplayModeValues: [...document.querySelectorAll('input[name="gameDisplayMode"]')].map((input) => input.value),
    settingsCheckedDisplayModes: [...document.querySelectorAll('input[name="gameDisplayMode"]:checked')].map((input) => input.value),
    settingsHorizontalOverflow: (() => { const node = document.querySelector('#settingsDialog'); return Boolean(node && node.scrollWidth > node.clientWidth + 1); })(),
    launcherUpdateStatus: document.querySelector('#launcherUpdateCard')?.dataset.status || '',
    launcherUpdateActionText: document.querySelector('#launcherUpdateAction')?.textContent?.trim() || '',
    launcherCurrentVersionText: document.querySelector('#launcherCurrentVersion')?.textContent?.trim() || '',
    mediaState: document.querySelector('#gameFeature')?.dataset.mediaState || '',
    videoOpacity: Number.parseFloat(getComputedStyle(document.querySelector('#featureVideo')).opacity || '0'),
    artOpacity: Number.parseFloat(getComputedStyle(document.querySelector('#featureArt')).opacity || '0'),
    launchOpening: document.querySelector('#gameFeature')?.classList.contains('is-launch-opening') || false,
    lidTransform: getComputedStyle(document.querySelector('.feature-box-lid')).transform,
    lidRotateYDeg: (() => { const transform = getComputedStyle(document.querySelector('.feature-box-lid')).transform; if (!transform || transform === 'none') return 0; const matrix = new DOMMatrixReadOnly(transform); return Math.abs(Math.atan2(matrix.m13, matrix.m11) * 180 / Math.PI); })(),
    lidAnimation: getComputedStyle(document.querySelector('.feature-box-lid')).animationName,
    lidOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.feature-box-lid')).opacity || '0'),
    lidOrigin: (() => { const node = document.querySelector('.feature-box-lid'); const style = getComputedStyle(node); const parts = style.transformOrigin.split(' ').map(Number.parseFloat); return { xRatio: node.offsetWidth ? parts[0] / node.offsetWidth : 1, yRatio: node.offsetHeight ? parts[1] / node.offsetHeight : 0 }; })(),
    lidRectWidth: Math.round(document.querySelector('.feature-box-lid')?.getBoundingClientRect().width || 0),
    baseRectWidth: Math.round(document.querySelector('#featureFrame')?.getBoundingClientRect().width || 0),
    lidFrontBackface: getComputedStyle(document.querySelector('.feature-box-lid-front')).backfaceVisibility,
    lidBackBackface: getComputedStyle(document.querySelector('.feature-box-lid-back')).backfaceVisibility,
    lidFrontClip: getComputedStyle(document.querySelector('.feature-box-lid-front')).clipPath,
    lidBackClip: getComputedStyle(document.querySelector('.feature-box-lid-back')).clipPath,
    lidPanelNaturalWidth: document.querySelector('#featureCover')?.naturalWidth || 0,
    fixedShellNaturalWidth: document.querySelector('#featureFrame')?.naturalWidth || 0,
    trayOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.feature-box-tray')).opacity || '0'),
    trayFilter: getComputedStyle(document.querySelector('.feature-box-tray')).filter,
    trayZ: Number.parseInt(getComputedStyle(document.querySelector('.feature-box-tray')).zIndex || '0', 10),
    trayImageNaturalWidth: document.querySelector('.feature-box-tray-image')?.naturalWidth || 0,
    revealFramesLoaded: [...document.querySelectorAll('.feature-box-reveal-frame')].filter((image) => image.complete && image.naturalWidth > 0).length,
    visibleRevealFrames: [...document.querySelectorAll('.feature-box-reveal-frame')].filter((image) => Number.parseFloat(getComputedStyle(image).opacity || '0') > .01).length,
    visibleRevealFrame: [...document.querySelectorAll('.feature-box-reveal-frame')].find((image) => Number.parseFloat(getComputedStyle(image).opacity || '0') > .01)?.className || '',
    visibleRevealOpacity: (() => { const node = [...document.querySelectorAll('.feature-box-reveal-frame')].find((image) => Number.parseFloat(getComputedStyle(image).opacity || '0') > .01); return node ? Number.parseFloat(getComputedStyle(node).opacity || '0') : 0; })(),
    revealFrameAnimations: [...document.querySelectorAll('.feature-box-reveal-frame')].map((image) => getComputedStyle(image).animationName),
    revealOverflow: getComputedStyle(document.querySelector('.feature-box-reveal')).overflow,
    revealClip: getComputedStyle(document.querySelector('.feature-box-reveal')).clipPath,
    revealMask: getComputedStyle(document.querySelector('.feature-box-reveal')).webkitMaskImage || getComputedStyle(document.querySelector('.feature-box-reveal')).maskImage,
    visibleRevealMask: (() => { const node = [...document.querySelectorAll('.feature-box-reveal-frame')].find((image) => Number.parseFloat(getComputedStyle(image).opacity || '0') > .01); return node ? (getComputedStyle(node).webkitMaskImage || getComputedStyle(node).maskImage) : ''; })(),
    visibleRevealRect: (() => { const node = [...document.querySelectorAll('.feature-box-reveal-frame')].find((image) => Number.parseFloat(getComputedStyle(image).opacity || '0') > .01); const rect = node?.getBoundingClientRect(); return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null; })(),
    trayClip: getComputedStyle(document.querySelector('.feature-box-tray')).clipPath,
    innerCoreOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.feature-box-inner-core-svg')).opacity || '0'),
    freeEdgeOpacity: Number.parseFloat(getComputedStyle(document.querySelector('.feature-box-free-edge-svg')).opacity || '0'),
    freeEdgePath: document.querySelector('#featureEdgeCore')?.getAttribute('d') || '',
    freeEdgeLineSegments: ((document.querySelector('#featureEdgeCore')?.getAttribute('d') || '').match(/\\bL\\b/g) || []).length,
    freeEdgeHasClosedLeft: /\\bZ\\b/i.test(document.querySelector('#featureEdgeCore')?.getAttribute('d') || ''),
    revealZ: Number.parseInt(getComputedStyle(document.querySelector('.feature-box-reveal')).zIndex || '0', 10),
    fixedShellZ: Number.parseInt(getComputedStyle(document.querySelector('.game-box-fixed-shell')).zIndex || '0', 10),
    innerCoreZ: Number.parseInt(getComputedStyle(document.querySelector('.feature-box-inner-core-svg')).zIndex || '0', 10),
    freeEdgeZ: Number.parseInt(getComputedStyle(document.querySelector('.feature-box-free-edge-svg')).zIndex || '0', 10),
    lidZ: Number.parseInt(getComputedStyle(document.querySelector('.feature-box-lid')).zIndex || '0', 10),
    boxIsolation: getComputedStyle(document.querySelector('.feature-box-art')).isolation,
    allBoxLayersDirectChildren: ['.feature-box-tray', '.feature-box-reveal', '.feature-box-inner-core-svg', '.game-box-fixed-shell', '.feature-box-free-edge-svg', '.feature-box-lid'].every((selector) => document.querySelector(selector)?.parentElement?.classList.contains('feature-box-art')),
    legacyLightNodes: document.querySelectorAll('.feature-box-right-seam, .feature-box-player-wash').length,
    leftLeakNodes: document.querySelectorAll('.feature-box-left-seam, .feature-box-edge-leak--left').length,
    innerCoreCenter: (() => { const node = document.querySelector('#featureInnerCore'); const box = document.querySelector('.feature-box-art')?.getBoundingClientRect(); const rect = node?.getBoundingClientRect(); return box && rect ? { xRatio: (rect.left + rect.width / 2 - box.left) / box.width, yRatio: (rect.top + rect.height / 2 - box.top) / box.height } : null; })(),
    forbiddenForwardRayNodes: document.querySelectorAll('.feature-box-forward-ray, .feature-box-forward-rays').length,
    bodyCursor: (() => { const hadPressed = document.body.classList.contains('is-cursor-pressed'); document.body.classList.remove('is-cursor-pressed'); const cursor = getComputedStyle(document.body).cursor; document.body.classList.toggle('is-cursor-pressed', hadPressed); return cursor; })(),
    pointerCursor: (() => { const hadPressed = document.body.classList.contains('is-cursor-pressed'); document.body.classList.remove('is-cursor-pressed'); const cursor = getComputedStyle(document.querySelector('#detailClose')).cursor; document.body.classList.toggle('is-cursor-pressed', hadPressed); return cursor; })(),
    settingsOptionCursor: (() => { const hadPressed = document.body.classList.contains('is-cursor-pressed'); document.body.classList.remove('is-cursor-pressed'); const cursor = getComputedStyle(document.querySelector('.settings-option')).cursor; document.body.classList.toggle('is-cursor-pressed', hadPressed); return cursor; })(),
    checkboxCursor: getComputedStyle(document.querySelector('#minimizeToTrayToggle')).cursor,
    pressedCursor: (() => { const hadPressed = document.body.classList.contains('is-cursor-pressed'); document.body.classList.add('is-cursor-pressed'); const cursor = getComputedStyle(document.querySelector('#detailClose')).cursor; document.body.classList.toggle('is-cursor-pressed', hadPressed); return cursor; })(),
    disabledCursor: (() => { const node = document.createElement('button'); node.disabled = true; document.body.appendChild(node); const cursor = getComputedStyle(node).cursor; node.remove(); return cursor; })(),
    textCursor: getComputedStyle(document.querySelector('#usernameInput')).cursor,
    cursorPulseCount: document.querySelectorAll('.launcher-cursor-click-pulse').length,
    cursorPulseAriaHidden: document.querySelector('.launcher-cursor-click-pulse')?.getAttribute('aria-hidden') || '',
    cursorPulsePointerEvents: (() => { const node = document.querySelector('.launcher-cursor-click-pulse'); return node ? getComputedStyle(node).pointerEvents : ''; })(),
    cursorPulseAnimationName: (() => { const node = document.querySelector('.launcher-cursor-click-pulse'); return node ? getComputedStyle(node).animationName : ''; })(),
    cursorPulseAnimationDuration: (() => { const node = document.querySelector('.launcher-cursor-click-pulse'); return node ? getComputedStyle(node).animationDuration : ''; })(),
    pressedActiveRulePresent: [...document.styleSheets].some((sheet) => [...sheet.cssRules].some((rule) => rule.cssText?.includes('launcher_cursor_logpose_pressed_v1.png') && rule.cssText.includes(':active'))),
    boxRect: (() => { const rect = document.querySelector('.feature-box-art')?.getBoundingClientRect(); return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } : null; })(),
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
      const cursorAssets = [];
      for (const fileName of [
        'launcher_cursor_logpose_default_v1.png',
        'launcher_cursor_logpose_pointer_v1.png',
        'launcher_cursor_logpose_pressed_v1.png'
      ]) {
        const response = await targetSession.fetch(`${LAUNCHER_SCHEME}://launcher/images/desktop_launcher/${fileName}`);
        const bytes = Buffer.from(await response.arrayBuffer());
        cursorAssets.push({
          fileName,
          status: response.status,
          contentType: response.headers.get('content-type'),
          bytes: bytes.length,
          png: bytes.length >= 24 && bytes.subarray(1, 4).toString('ascii') === 'PNG' && bytes.readUInt32BE(16) === 40 && bytes.readUInt32BE(20) === 40
        });
      }
      protocolSmoke = {
        headStatus: head.status,
        headLength: head.headers.get('content-length'),
        partialStatus: partial.status,
        partialRange: partial.headers.get('content-range'),
        partialBytes,
        suffixStatus: suffix.status,
        suffixBytes,
        invalidStatus: invalid.status,
        invalidRange: invalid.headers.get('content-range'),
        cursorAssets
      };
      protocolSmoke.ok = head.status === 200 && Number(protocolSmoke.headLength) > 1024 && partial.status === 206 &&
        partialBytes === 1024 && suffix.status === 206 && suffixBytes === 257 && invalid.status === 416 &&
        cursorAssets.every((asset) => asset.status === 200 && asset.contentType === 'image/png' && asset.png);
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
  if (SCREENSHOT_PATH && SCREENSHOT_VIEW === 'cursor-click') {
    await mainWindow.webContents.executeJavaScript(`(() => {
      const rect = primaryAction.getBoundingClientRect();
      primaryAction.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        isPrimary: true,
        pointerType: 'mouse',
        button: 0,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2
      }));
    })()`, true).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 90));
  }
  if (SCREENSHOT_PATH) {
    const image = await mainWindow.webContents.capturePage();
    await fsp.mkdir(path.dirname(path.resolve(SCREENSHOT_PATH)), { recursive: true });
    await fsp.writeFile(path.resolve(SCREENSHOT_PATH), image.toPNG());
  }
  let cursorPulseCleanupReady = true;
  if (SMOKE_MODE && SCREENSHOT_VIEW === 'cursor-click') {
    await mainWindow.webContents.executeJavaScript(`document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, isPrimary: true, pointerType: 'mouse', button: 0 }))`, true).catch(() => {});
    await new Promise((resolve) => setTimeout(resolve, 450));
    cursorPulseCleanupReady = await mainWindow.webContents.executeJavaScript(`document.querySelectorAll('.launcher-cursor-click-pulse').length === 0 && !document.body.classList.contains('is-cursor-pressed')`, true).catch(() => false);
  }
  const viewReady = SCREENSHOT_VIEW === 'downloads'
    ? dom.downloadsVisible && dom.downloadRows === 3
    : SCREENSHOT_VIEW === 'cursor-click'
      ? dom.cursorPulseCount === 1 && dom.cursorPulseAriaHidden === 'true' && dom.cursorPulsePointerEvents === 'none' && ['launcherCursorClickPulse', 'launcherCursorClickFade'].includes(dom.cursorPulseAnimationName) && ['0.32s', '0.12s'].includes(dom.cursorPulseAnimationDuration) && cursorPulseCleanupReady
    : SCREENSHOT_VIEW === 'uninstall'
      ? dom.downloadsVisible && dom.downloadRows === 3 && dom.uninstallOpen
      : ['settings', 'settings-on', 'settings-update-current'].includes(SCREENSHOT_VIEW)
        ? dom.settingsOpen && dom.settingsDisplayModeValues.length === 2 && dom.settingsDisplayModeValues.includes('borderless') && dom.settingsDisplayModeValues.includes('fullscreen') && dom.settingsCheckedDisplayModes.length === 1 && !dom.settingsHorizontalOverflow && (SCREENSHOT_VIEW !== 'settings-on' || dom.minimizeToTrayChecked) && (SCREENSHOT_VIEW !== 'settings-update-current' || (dom.launcherUpdateStatus === 'current' && dom.launcherUpdateActionText === '再次檢查' && dom.launcherCurrentVersionText.includes(app.getVersion())))
        : SCREENSHOT_VIEW === 'box-crack'
          ? dom.launchOpening && dom.videoOpacity === 0 && dom.artOpacity === 0 && dom.lidAnimation === 'featureBoxLidOpen' && dom.lidOrigin.xRatio <= .06 && dom.lidRotateYDeg >= 4 && dom.lidRotateYDeg <= 8 && dom.lidRectWidth > dom.baseRectWidth * .97 && dom.lidFrontClip.startsWith('polygon') && dom.lidBackClip.startsWith('polygon') && dom.lidPanelNaturalWidth === 1086 && dom.fixedShellNaturalWidth === 1086 && dom.trayImageNaturalWidth === 1086 && dom.revealFramesLoaded === 4 && dom.visibleRevealFrames === 1 && dom.visibleRevealFrame.includes('feature-box-reveal-frame--01') && dom.visibleRevealOpacity > .26 && dom.visibleRevealOpacity < .32 && dom.innerCoreOpacity > .08 && dom.innerCoreOpacity < .12 && dom.freeEdgeOpacity > .26 && dom.freeEdgeOpacity < .31 && dom.visibleRevealRect?.width <= dom.boxRect.width * 1.08 && dom.visibleRevealRect?.height <= dom.boxRect.height * 1.08 && dom.revealOverflow === 'visible' && dom.revealClip === 'none' && dom.revealMask === 'none' && dom.visibleRevealMask.includes('linear-gradient') && dom.freeEdgeLineSegments === 3 && !dom.freeEdgeHasClosedLeft && dom.legacyLightNodes === 0 && dom.leftLeakNodes === 0 && dom.trayZ < dom.fixedShellZ && dom.fixedShellZ < dom.revealZ && dom.revealZ < dom.innerCoreZ && dom.innerCoreZ < dom.freeEdgeZ && dom.freeEdgeZ < dom.lidZ && dom.boxIsolation === 'isolate' && dom.allBoxLayersDirectChildren && dom.innerCoreCenter?.xRatio >= .4 && dom.innerCoreCenter.xRatio <= .48 && dom.innerCoreCenter?.yRatio >= .45 && dom.innerCoreCenter.yRatio <= .55 && dom.forbiddenForwardRayNodes === 0
        : SCREENSHOT_VIEW === 'box-mid'
          ? dom.launchOpening && dom.videoOpacity === 0 && dom.artOpacity === 0 && dom.lidAnimation === 'featureBoxLidOpen' && dom.lidTransform.startsWith('matrix3d') && dom.lidRotateYDeg >= 16 && dom.lidRotateYDeg <= 19 && dom.lidRectWidth > dom.baseRectWidth * .95 && dom.lidFrontClip.startsWith('polygon') && dom.lidBackClip.startsWith('polygon') && dom.revealFramesLoaded === 4 && dom.visibleRevealFrames === 1 && dom.visibleRevealFrame.includes('feature-box-reveal-frame--01') && dom.visibleRevealOpacity > .41 && dom.visibleRevealOpacity < .47 && dom.innerCoreOpacity > .22 && dom.innerCoreOpacity < .27 && dom.freeEdgeOpacity > .43 && dom.freeEdgeOpacity < .49 && dom.visibleRevealRect?.width <= dom.boxRect.width * 1.08 && dom.visibleRevealRect?.height <= dom.boxRect.height * 1.08 && dom.revealOverflow === 'visible' && dom.revealClip === 'none' && dom.revealMask === 'none' && dom.visibleRevealMask.includes('linear-gradient') && dom.freeEdgeLineSegments === 3 && !dom.freeEdgeHasClosedLeft && dom.legacyLightNodes === 0 && dom.leftLeakNodes === 0 && dom.trayZ < dom.fixedShellZ && dom.fixedShellZ < dom.revealZ && dom.revealZ < dom.innerCoreZ && dom.innerCoreZ < dom.freeEdgeZ && dom.freeEdgeZ < dom.lidZ && dom.boxIsolation === 'isolate' && dom.allBoxLayersDirectChildren && dom.innerCoreCenter?.xRatio >= .4 && dom.innerCoreCenter.xRatio <= .48 && dom.innerCoreCenter?.yRatio >= .45 && dom.innerCoreCenter.yRatio <= .55 && dom.forbiddenForwardRayNodes === 0
        : SCREENSHOT_VIEW === 'box-open'
          ? dom.launchOpening && dom.videoOpacity === 0 && dom.artOpacity === 0 && dom.lidAnimation === 'featureBoxLidOpen' && dom.lidTransform.startsWith('matrix3d') && dom.lidOrigin.xRatio <= .06 && dom.lidOrigin.yRatio >= .45 && dom.lidOrigin.yRatio <= .55 && dom.lidRotateYDeg >= 18 && dom.lidRotateYDeg <= 24 && dom.lidRectWidth > dom.baseRectWidth * .9 && dom.lidFrontClip.startsWith('polygon') && dom.lidBackClip.startsWith('polygon') && dom.trayOpacity >= .95 && dom.revealFramesLoaded === 4 && dom.visibleRevealFrames === 1 && dom.visibleRevealFrame.includes('feature-box-reveal-frame--02') && dom.visibleRevealOpacity > .64 && dom.visibleRevealOpacity < .7 && dom.revealFrameAnimations.every((name) => name.startsWith('boxRevealFrame')) && dom.innerCoreOpacity > .39 && dom.innerCoreOpacity < .46 && dom.freeEdgeOpacity > .64 && dom.freeEdgeOpacity < .72 && dom.revealOverflow === 'visible' && dom.revealClip === 'none' && dom.revealMask === 'none' && dom.visibleRevealMask.includes('linear-gradient') && dom.visibleRevealRect?.top >= dom.boxRect.top - dom.boxRect.height * .15 && dom.visibleRevealRect?.right <= dom.boxRect.right + dom.boxRect.width * .15 && dom.visibleRevealRect?.bottom <= dom.boxRect.bottom + dom.boxRect.height * .15 && dom.visibleRevealRect?.width <= dom.boxRect.width * 1.26 && dom.visibleRevealRect?.height <= dom.boxRect.height * 1.26 && dom.freeEdgeLineSegments === 3 && !dom.freeEdgeHasClosedLeft && dom.legacyLightNodes === 0 && dom.leftLeakNodes === 0 && dom.trayZ < dom.fixedShellZ && dom.fixedShellZ < dom.revealZ && dom.revealZ < dom.innerCoreZ && dom.innerCoreZ < dom.freeEdgeZ && dom.freeEdgeZ < dom.lidZ && dom.boxIsolation === 'isolate' && dom.allBoxLayersDirectChildren && dom.innerCoreCenter?.xRatio >= .4 && dom.innerCoreCenter.xRatio <= .48 && dom.innerCoreCenter?.yRatio >= .45 && dom.innerCoreCenter.yRatio <= .55 && dom.lidPanelNaturalWidth === 1086 && dom.fixedShellNaturalWidth === 1086 && dom.lidFrontBackface === 'hidden' && dom.lidBackBackface === 'hidden' && dom.forbiddenForwardRayNodes === 0
        : SCREENSHOT_VIEW === 'tray-cycle'
          ? traySmoke?.hideResult === true && traySmoke.hidden === true && traySmoke.trayCreated === true && traySmoke.restored === true && traySmoke.trayDestroyedAfterRestore === true
          : dom.boxWidth > 0 && dom.boxHeight > 0;
  const mediaExclusive = dom.videoOpacity <= .001 || dom.artOpacity <= .001;
  const cursorHas = (value, fileName) => value.includes(fileName) && /\b3\s+3\b/.test(value);
  const cursorReady = cursorHas(dom.bodyCursor, 'launcher_cursor_logpose_default_v1.png') && cursorHas(dom.pointerCursor, 'launcher_cursor_logpose_pointer_v1.png') && cursorHas(dom.settingsOptionCursor, 'launcher_cursor_logpose_pointer_v1.png') && cursorHas(dom.checkboxCursor, 'launcher_cursor_logpose_pointer_v1.png') && cursorHas(dom.pressedCursor, 'launcher_cursor_logpose_pressed_v1.png') && cursorHas(dom.disabledCursor, 'launcher_cursor_logpose_default_v1.png') && dom.textCursor === 'text' && dom.pressedActiveRulePresent;
  const visualReady = dom.stage === 'app' && dom.games === 3 && dom.loadedBoxCovers >= 7 && dom.loadedBoxFrames >= 7 && dom.brokenImages.length === 0 && mediaExclusive && cursorReady && viewReady;
  if (SMOKE_MODE) finishSmoke(
    { stage: 'launcher-ready', dom, protocolSmoke, installedMediaSmoke, traySmoke, gpu: await collectGpuDiagnostics(), sessionDataPath: app.getPath('sessionData'), state: await composeState() },
    dom.hasApi && visualReady && protocolSmoke?.ok === true && (!SMOKE_MEDIA_ASSETS || installedMediaSmoke?.ok === true) ? 0 : 1
  );
  else if (SCREENSHOT_PATH) app.quit();
}

async function collectGpuDiagnostics() {
  let timeout;
  try {
    return await Promise.race([
      app.getGPUInfo('complete').then((info) => ({
        requestedPreference: GPU_PREFERENCE,
        featureStatus: gpuInfoUpdated ? app.getGPUFeatureStatus() : null,
        devices: (info.gpuDevice || []).map((device) => ({
          active: device.active,
          name: device.deviceString,
          vendorId: device.vendorId,
          deviceId: device.deviceId
        })),
        renderer: info.auxAttributes?.glRenderer || ''
      })),
      new Promise((resolve) => {
        timeout = setTimeout(() => resolve({ requestedPreference: GPU_PREFERENCE, unavailable: 'timeout' }), 3000);
      })
    ]);
  } catch (error) {
    return { requestedPreference: GPU_PREFERENCE, unavailable: error.message };
  } finally {
    clearTimeout(timeout);
  }
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
  setTimeout(() => app.exit(code), 1200);
}

async function initializeServices() {
  authService = new AuthService({ origin: REMOTE_ORIGIN, userDataPath: app.getPath('userData') });
  await authService.load();
  const updateSession = session.fromPartition('onepiece-launcher-updates-v1');
  hardenSession(updateSession);
  launcherUpdateService = new LauncherUpdateService({
    origin: REMOTE_ORIGIN,
    allowedArtifactOrigins: [ASSET_ORIGIN],
    currentVersion: app.getVersion(),
    downloadRoot: path.join(app.getPath('userData'), 'launcher-updates'),
    fetchImpl: (url, options) => updateSession.fetch(url, options),
    quitImpl: () => app.quit()
  });
  launcherUpdateService.on('state', broadcastLauncherUpdate);
  launcherUpdateService.on('progress', broadcastLauncherUpdate);
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
    runtimeAssetCache.clearAll();
    restoreLauncherFromTray();
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
    restoreLauncherFromTray();
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

app.on('before-quit', () => {
  appQuitting = true;
  destroyTray();
  runtimeAssetCache.clearAll();
  launcherUpdateService?.dispose();
  authService?.close();
});
app.on('window-all-closed', () => app.quit());

module.exports = { parseRange, streamFileResponse };
