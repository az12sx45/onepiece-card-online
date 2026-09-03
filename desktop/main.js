'use strict';

const { app, BrowserWindow, net, protocol, session } = require('electron');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REMOTE_ORIGIN = 'https://onepiece-card-online.onrender.com';
const START_URL = `${REMOTE_ORIGIN}/game_launcher_preview.html?desktop=1`;
const CACHE_SCHEME = 'opcache';
const CACHE_HOST = 'image';
const SMOKE_MODE = process.env.OP_DESKTOP_SMOKE === '1';
const SMOKE_REPORT_PATH = typeof process.env.OP_DESKTOP_SMOKE_REPORT === 'string' && process.env.OP_DESKTOP_SMOKE_REPORT.trim()
  ? path.resolve(process.env.OP_DESKTOP_SMOKE_REPORT.trim())
  : '';
const SMOKE_DEADLINE_MS = 90_000;
const SMOKE_STARTED_AT = Date.now();

protocol.registerSchemesAsPrivileged([
  {
    scheme: CACHE_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      bypassCSP: true
    }
  }
]);

const cacheState = {
  manifestPath: '',
  imageRoot: '',
  manifestPresent: false,
  manifestEntries: 0,
  cacheHits: 0,
  remoteFallbacks: 0,
  validationFailures: 0,
  smokeVerifiedEntries: 0,
  smokeVerificationFailures: 0
};

const manifestEntries = new Map();
const servedTokens = new Map();
const validationCache = new Map();
let realImageRoot = null;
let smokeFinished = false;
let smokeTimer = null;

function isInside(rootPath, candidatePath) {
  const relative = path.relative(rootPath, candidatePath);
  return relative !== '' && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative);
}

function normaliseRelativePath(input) {
  if (typeof input !== 'string' || input.includes('\0')) return null;

  let value = input.trim().replaceAll('\\', '/');
  if (!value) return null;

  if (/^https?:\/\//i.test(value)) {
    try {
      const parsed = new URL(value);
      if (parsed.origin !== REMOTE_ORIGIN) return null;
      value = decodeURIComponent(parsed.pathname);
    } catch {
      return null;
    }
  }

  value = value.replace(/^\.\//, '').replace(/^\/+/, '');
  value = value.replace(/^public\/images\//i, '').replace(/^images\//i, '');
  const normalised = path.posix.normalize(value);

  if (
    !normalised ||
    normalised === '.' ||
    normalised === '..' ||
    normalised.startsWith('../') ||
    path.posix.isAbsolute(normalised) ||
    /^[a-z]:/i.test(normalised)
  ) {
    return null;
  }

  return normalised;
}

function manifestRecords(document) {
  if (!document || typeof document !== 'object') return [];
  const container = document.files ?? document.images ?? document.entries ?? document.assets ?? document;

  if (Array.isArray(container)) return container;
  if (!container || typeof container !== 'object') return [];

  return Object.entries(container).map(([entryPath, metadata]) => {
    if (typeof metadata === 'string') return { path: entryPath, sha256: metadata };
    if (!metadata || typeof metadata !== 'object') return { path: entryPath };
    return { ...metadata, path: entryPath };
  });
}

function parseManifestEntry(record) {
  if (!record || typeof record !== 'object') return null;
  const relativePath = normaliseRelativePath(
    record.path ?? record.relativePath ?? record.file ?? record.url ?? record.requestPath
  );
  const rawHash = record.sha256 ?? record.hash ?? record.digest;
  const sha256 = typeof rawHash === 'string'
    ? rawHash.trim().replace(/^sha256[:-]?/i, '').toLowerCase()
    : '';
  const size = Number(record.size ?? record.bytes ?? record.byteLength);

  if (!relativePath || !/^[a-f0-9]{64}$/.test(sha256) || !Number.isSafeInteger(size) || size < 0) {
    return null;
  }

  const filePath = path.resolve(cacheState.imageRoot, ...relativePath.split('/'));
  if (!isInside(cacheState.imageRoot, filePath)) return null;

  return { relativePath, filePath, sha256, size };
}

async function loadManifest() {
  const developmentRoot = path.resolve(__dirname, '..', 'public', 'images');
  cacheState.imageRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'images')
    : developmentRoot;
  cacheState.manifestPath = app.isPackaged
    ? path.join(process.resourcesPath, 'image-manifest.json')
    : path.join(__dirname, 'generated', 'image-manifest.json');

  try {
    realImageRoot = await fsp.realpath(cacheState.imageRoot);
    const manifestText = await fsp.readFile(cacheState.manifestPath, 'utf8');
    const document = JSON.parse(manifestText);
    cacheState.manifestPresent = true;
    const ambiguousKeys = new Set();

    for (const record of manifestRecords(document)) {
      const entry = parseManifestEntry(record);
      if (!entry) continue;

      const key = entry.relativePath.toLocaleLowerCase('en-US');
      if (ambiguousKeys.has(key)) continue;
      const existing = manifestEntries.get(key);
      if (existing && existing.relativePath !== entry.relativePath) {
        manifestEntries.delete(key);
        ambiguousKeys.add(key);
        continue;
      }
      manifestEntries.set(key, entry);
    }
  } catch {
    realImageRoot = null;
    manifestEntries.clear();
  }

  cacheState.manifestEntries = manifestEntries.size;
}

async function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function verifyEntry(entry) {
  if (!realImageRoot) return null;

  try {
    const realFilePath = await fsp.realpath(entry.filePath);
    if (!isInside(realImageRoot, realFilePath)) return null;

    const before = await fsp.stat(realFilePath);
    if (!before.isFile() || before.size !== entry.size) return null;

    const cacheKey = entry.relativePath.toLocaleLowerCase('en-US');
    const signature = `${before.dev}:${before.ino}:${before.size}:${before.mtimeMs}`;
    const cached = validationCache.get(cacheKey);
    if (cached?.signature === signature) return cached.valid ? realFilePath : null;

    const actualHash = await sha256File(realFilePath);
    const after = await fsp.stat(realFilePath);
    const unchanged = before.dev === after.dev && before.ino === after.ino &&
      before.size === after.size && before.mtimeMs === after.mtimeMs;
    const valid = unchanged && actualHash === entry.sha256;
    validationCache.set(cacheKey, { signature, valid });
    return valid ? realFilePath : null;
  } catch {
    return null;
  }
}

async function verifyAllManifestEntriesForSmoke() {
  const entries = [...manifestEntries.values()];
  let cursor = 0;
  let verified = 0;
  const failedPaths = [];
  const workerCount = Math.min(8, Math.max(1, entries.length));

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= entries.length) return;
      const entry = entries[index];
      if (await verifyEntry(entry)) {
        verified += 1;
      } else if (failedPaths.length < 12) {
        failedPaths.push(entry.relativePath);
      }
    }
  }

  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  cacheState.smokeVerifiedEntries = verified;
  cacheState.smokeVerificationFailures = entries.length - verified;
  return {
    ok: entries.length > 0 && verified === entries.length,
    expected: entries.length,
    verified,
    failures: entries.length - verified,
    failedPaths
  };
}

function requestRelativePath(requestUrl) {
  try {
    const parsed = new URL(requestUrl);
    if (parsed.origin !== REMOTE_ORIGIN || !parsed.pathname.startsWith('/images/')) return null;
    return normaliseRelativePath(decodeURIComponent(parsed.pathname));
  } catch {
    return null;
  }
}

function tokenForEntry(entry) {
  return crypto.createHash('sha256').update(entry.relativePath).digest('hex');
}

async function installImageCache(ses) {
  await ses.protocol.handle(CACHE_SCHEME, async (request) => {
    try {
      const parsed = new URL(request.url);
      if (parsed.hostname !== CACHE_HOST) return new Response('Not found', { status: 404 });

      const token = parsed.pathname.replace(/^\/+/, '');
      const entry = servedTokens.get(token);
      const verifiedPath = entry ? await verifyEntry(entry) : null;
      if (!entry || !verifiedPath) {
        return new Response('Not found', { status: 404 });
      }

      const localResponse = await net.fetch(pathToFileURL(verifiedPath).toString());
      const headers = new Headers(localResponse.headers);
      headers.set('Access-Control-Allow-Origin', REMOTE_ORIGIN);
      headers.set('Access-Control-Expose-Headers', 'X-OnePiece-Desktop-Cache');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      headers.set('X-OnePiece-Desktop-Cache', 'hit');
      return new Response(localResponse.body, {
        status: localResponse.status,
        statusText: localResponse.statusText,
        headers
      });
    } catch {
      return new Response('Not found', { status: 404 });
    }
  });

  ses.webRequest.onBeforeRequest(
    { urls: [`${REMOTE_ORIGIN}/images/*`] },
    async (details, callback) => {
      try {
        const relativePath = requestRelativePath(details.url);
        const entry = relativePath
          ? manifestEntries.get(relativePath.toLocaleLowerCase('en-US'))
          : null;

        if (entry && await verifyEntry(entry)) {
          const token = tokenForEntry(entry);
          servedTokens.set(token, entry);
          cacheState.cacheHits += 1;
          callback({ redirectURL: `${CACHE_SCHEME}://${CACHE_HOST}/${token}` });
          return;
        }

        if (entry) cacheState.validationFailures += 1;
        cacheState.remoteFallbacks += 1;
      } catch {
        cacheState.validationFailures += 1;
        cacheState.remoteFallbacks += 1;
      }
      callback({});
    }
  );
}

function isAllowedNavigation(targetUrl) {
  try {
    return new URL(targetUrl).origin === REMOTE_ORIGIN;
  } catch {
    return false;
  }
}

function isExpectedLauncherUrl(targetUrl) {
  try {
    const parsed = new URL(targetUrl);
    return parsed.origin === REMOTE_ORIGIN &&
      parsed.pathname === '/game_launcher_preview.html' &&
      parsed.searchParams.get('desktop') === '1';
  } catch {
    return false;
  }
}

function remoteImageUrl(relativePath) {
  const encodedPath = relativePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
  return `${REMOTE_ORIGIN}/images/${encodedPath}?desktopSmoke=${Date.now()}`;
}

async function runSmokeCacheProbe(window) {
  const entry = manifestEntries.values().next().value;
  if (!entry) {
    return { ok: false, error: 'The local image manifest has no usable entries.' };
  }

  const probeUrl = remoteImageUrl(entry.relativePath);
  const hitsBeforeProbe = cacheState.cacheHits;
  try {
    const result = await window.webContents.executeJavaScript(`
      (async () => {
        const response = await fetch(${JSON.stringify(probeUrl)}, { cache: 'no-store' });
        const bytes = (await response.arrayBuffer()).byteLength;
        return {
          ok: response.ok,
          status: response.status,
          bytes,
          cacheHeader: response.headers.get('x-onepiece-desktop-cache'),
          finalUrl: response.url,
          dom: {
            title: document.title,
            launcherEntry: Boolean(document.querySelector('#launcherEntry')),
            startButton: Boolean(document.querySelector('#launcherEntryStartBtn')),
            launcherStage: Boolean(document.querySelector('.launcher-stage')),
            gameChoices: document.querySelectorAll('.game-pick').length
          }
        };
      })()
    `, true);
    const localHitObserved = cacheState.cacheHits > hitsBeforeProbe || result.cacheHeader === 'hit';
    const domReady = result.dom?.launcherEntry === true &&
      result.dom?.startButton === true &&
      result.dom?.launcherStage === true &&
      result.dom?.gameChoices === 3;
    return {
      ok: result.ok === true && result.status === 200 && result.bytes === entry.size && localHitObserved && domReady,
      relativePath: entry.relativePath,
      expectedBytes: entry.size,
      ...result,
      localHitObserved,
      domReady
    };
  } catch (error) {
    return {
      ok: false,
      relativePath: entry.relativePath,
      expectedBytes: entry.size,
      error: error.message
    };
  }
}

function smokeReport(extra, exitCode) {
  if (!SMOKE_MODE || smokeFinished) return;
  smokeFinished = true;
  if (smokeTimer) clearTimeout(smokeTimer);

  const report = {
    mode: 'smoke',
    ok: exitCode === 0,
    electron: process.versions.electron,
    startUrl: START_URL,
    security: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      newWindows: 'deny',
      externalNavigation: 'deny'
    },
    cache: cacheState,
    ...extra
  };
  const reportJson = `${JSON.stringify(report)}\n`;

  if (SMOKE_REPORT_PATH) {
    try {
      fs.mkdirSync(path.dirname(SMOKE_REPORT_PATH), { recursive: true });
      fs.writeFileSync(SMOKE_REPORT_PATH, reportJson, 'utf8');
    } catch (error) {
      process.stderr.write(`Unable to write smoke report: ${error.message}\n`);
    }
  }

  const forcedExit = setTimeout(() => app.exit(exitCode), 1_000);
  process.stdout.write(reportJson, () => {
    clearTimeout(forcedExit);
    app.exit(exitCode);
  });
}

async function createMainWindow() {
  const partition = 'persist:onepiece-board-desktop';
  const ses = session.fromPartition(partition);

  ses.setPermissionCheckHandler(() => false);
  ses.setPermissionRequestHandler((_webContents, _permission, callback) => callback(false));
  await loadManifest();
  const smokeInventory = SMOKE_MODE
    ? await verifyAllManifestEntriesForSmoke()
    : null;
  await installImageCache(ses);

  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: !SMOKE_MODE,
    autoHideMenuBar: true,
    backgroundColor: '#071b27',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      partition,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, legacyUrl) => {
    const targetUrl = event.url ?? legacyUrl;
    if (!isAllowedNavigation(targetUrl)) event.preventDefault();
  });
  window.webContents.on('will-frame-navigate', (event, legacyUrl) => {
    const targetUrl = event.url ?? legacyUrl;
    if (!isAllowedNavigation(targetUrl)) event.preventDefault();
  });
  window.webContents.on('will-redirect', (event, legacyUrl) => {
    const targetUrl = event.url ?? legacyUrl;
    if (!isAllowedNavigation(targetUrl)) event.preventDefault();
  });

  let showingOfflinePage = false;
  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedUrl, isMainFrame) => {
    if (!isMainFrame || errorCode === -3 || showingOfflinePage) return;
    showingOfflinePage = true;
    window.loadFile(path.join(__dirname, 'offline.html')).catch((error) => {
      smokeReport({ stage: 'offline-load', error: error.message }, 1);
    });
    if (!SMOKE_MODE) {
      console.error(`Remote page failed to load (${errorCode} ${errorDescription}): ${validatedUrl}`);
    }
  });

  window.webContents.on('did-finish-load', () => {
    if (!SMOKE_MODE) return;
    setTimeout(async () => {
      if (smokeFinished) return;
      const finalUrl = window.webContents.getURL();
      const remoteLoaded = isExpectedLauncherUrl(finalUrl);
      const cacheProbe = remoteLoaded
        ? await runSmokeCacheProbe(window)
        : { ok: false, error: 'The hosted launcher did not load.' };
      const cacheReady = cacheState.manifestPresent &&
        cacheState.manifestEntries > 0 &&
        smokeInventory?.ok === true &&
        cacheProbe.ok &&
        cacheState.remoteFallbacks === 0 &&
        cacheState.validationFailures === 0;
      smokeReport({
        stage: 'did-finish-load',
        remoteLoaded,
        offlineFallback: !remoteLoaded,
        finalUrl,
        smokeInventory,
        cacheProbe
      }, remoteLoaded && cacheReady ? 0 : 1);
    }, 1_000);
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    smokeReport({ stage: 'render-process-gone', reason: details.reason }, 1);
  });
  window.on('unresponsive', () => {
    smokeReport({ stage: 'unresponsive' }, 1);
  });

  await window.loadURL(START_URL).catch(() => {
    // did-fail-load owns the offline fallback and smoke-test reporting.
  });
  return window;
}

if (SMOKE_MODE) {
  const remainingMs = Math.max(1, SMOKE_DEADLINE_MS - (Date.now() - SMOKE_STARTED_AT));
  smokeTimer = setTimeout(() => {
    smokeReport({ stage: 'timeout', error: `No completed page load within ${SMOKE_DEADLINE_MS}ms` }, 1);
  }, remainingMs);
}

app.whenReady().then(async () => {
  try {
    await createMainWindow();
  } catch (error) {
    if (SMOKE_MODE) {
      smokeReport({ stage: 'startup', error: error.message }, 1);
    } else {
      console.error(error);
      app.quit();
    }
  }
});

app.on('window-all-closed', () => app.quit());
