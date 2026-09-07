'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const CHILD_FLAG = '--electron-child';
const ORIGIN = 'https://desktop-program-fixture.test';

function digest(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function fixtureFiles() {
  return new Map([
    ['index.html', Buffer.from(`<!doctype html>
<html><head><meta charset="utf-8"><link rel="stylesheet" href="/fixture.css"></head>
<body><div id="probe">fixture</div><script src="/fixture.js"></script><script>
(async () => {
  try {
    const workerResult = await new Promise((resolve, reject) => {
      const worker = new Worker('/worker.js');
      const timeout = setTimeout(() => reject(new Error('worker timeout')), 5000);
      worker.onmessage = (event) => { clearTimeout(timeout); worker.terminate(); resolve(event.data); };
      worker.onerror = (event) => { clearTimeout(timeout); reject(new Error(event.message || 'worker failed')); };
    });
    const wasm = await WebAssembly.instantiateStreaming(fetch('/answer.wasm'));
    const imageBytes = await fetch('/images/avatar.webp').then((response) => response.arrayBuffer());
    const api = await fetch('/api/ping', { cache: 'no-store' }).then((response) => response.json());
    window.__fixtureDone = {
      href: location.href,
      origin: location.origin,
      colour: getComputedStyle(document.getElementById('probe')).color,
      scriptOrigin: window.__fixtureScriptOrigin,
      workerOrigin: workerResult.origin,
      workerValue: workerResult.value,
      wasmValue: wasm.instance.exports.run(),
      imageBytes: imageBytes.byteLength,
      api
    };
  } catch (error) {
    window.__fixtureDone = { error: String(error && (error.stack || error.message) || error) };
  }
})();
</script></body></html>`)],
    ['fixture.css', Buffer.from('#probe { color: rgb(12, 34, 56); }')],
    ['fixture.js', Buffer.from('window.__fixtureScriptOrigin = location.origin;')],
    ['worker.js', Buffer.from("postMessage({ origin: self.location.origin, value: 7 });")],
    ['answer.wasm', Buffer.from([
      0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x60, 0x00, 0x01, 0x7f,
      0x03, 0x02, 0x01, 0x00,
      0x07, 0x07, 0x01, 0x03, 0x72, 0x75, 0x6e, 0x00, 0x00,
      0x0a, 0x06, 0x01, 0x04, 0x00, 0x41, 0x2a, 0x0b
    ])],
    ['images/avatar.webp', Buffer.from('fixture-image')]
  ]);
}

function kindAndMime(logicalPath) {
  const extension = path.posix.extname(logicalPath).toLowerCase();
  return new Map([
    ['.html', ['document', 'text/html']],
    ['.css', ['style', 'text/css']],
    ['.js', ['script', 'text/javascript']],
    ['.wasm', ['wasm', 'application/wasm']],
    ['.webp', ['image', 'image/webp']]
  ]).get(extension);
}

async function waitForResult(window, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await window.webContents.executeJavaScript('window.__fixtureDone || null', true);
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error('Timed out waiting for the Electron protocol fixture.');
}

async function runElectronChild() {
  const { app, BrowserWindow, protocol, session } = require('electron');
  const { RuntimeAssetCache } = require('../desktop/runtime-asset-cache');
  const { HttpsProgramRuntime } = require('../desktop/program-runtime');
  app.commandLine.appendSwitch('disable-gpu');
  protocol.registerSchemesAsPrivileged([{
    scheme: 'opcachefixture',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
  }]);
  const temporaryRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'op-electron-protocol-'));
  let window = null;
  let targetSession = null;
  try {
    await app.whenReady();
    const files = fixtureFiles();
    const assets = [];
    for (const [logicalPath, bytes] of files) {
      const target = path.join(temporaryRoot, ...logicalPath.split('/'));
      await fsp.mkdir(path.dirname(target), { recursive: true });
      await fsp.writeFile(target, bytes);
      const [kind, mime] = kindAndMime(logicalPath);
      assets.push({ path: logicalPath, kind, mime, size: bytes.length, sha256: digest(bytes) });
    }
    assets.sort((left, right) => left.path.localeCompare(right.path, 'en'));
    const reads = new Map();
    const runtimeAssetCache = new RuntimeAssetCache({
      maxBytes: 8 * 1024 * 1024,
      readFileImpl: async (filePath) => {
        reads.set(path.basename(filePath), (reads.get(path.basename(filePath)) || 0) + 1);
        return fsp.readFile(filePath);
      }
    });
    runtimeAssetCache.buildGame('card', { assets }, {
      filePathForAsset: (asset) => path.join(temporaryRoot, ...asset.path.split('/'))
    });
    const networkUrls = [];
    const failures = [];
    let useSessionBypass = false;
    const programRuntime = new HttpsProgramRuntime({
      gameId: 'card',
      origin: ORIGIN,
      assetCache: runtimeAssetCache,
      networkFetch: async (request) => {
        if (useSessionBypass) return targetSession.fetch(request, { bypassCustomProtocolHandlers: true });
        networkUrls.push(request.url);
        const parsed = new URL(request.url);
        if (parsed.origin === ORIGIN && parsed.pathname === '/api/ping') {
          return new Response(JSON.stringify({ ok: true, source: 'network' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        return new Response('fixture network miss', { status: 502 });
      },
      onFailure: (entry, error) => failures.push({ path: entry.path, message: error.message })
    });
    programRuntime.authorize({
      enabled: true,
      gameId: 'card',
      releaseId: 'package-fixture',
      manifestSha256: 'a'.repeat(64),
      entryPath: 'index.html'
    });

    targetSession = session.fromPartition(`onepiece-program-fixture-${process.pid}`, { cache: false });
    await targetSession.protocol.handle('https', (request) => programRuntime.handle(request));
    window = new BrowserWindow({
      show: false,
      width: 800,
      height: 600,
      webPreferences: {
        session: targetSession,
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        webSecurity: true
      }
    });
    await window.loadURL(`${ORIGIN}/index.html?desktop=1`);
    const result = await waitForResult(window);
    assert.equal(result.error, undefined, result.error);
    assert.equal(result.href, `${ORIGIN}/index.html?desktop=1`);
    assert.equal(result.origin, ORIGIN);
    assert.equal(result.colour, 'rgb(12, 34, 56)');
    assert.equal(result.scriptOrigin, ORIGIN);
    assert.equal(result.workerOrigin, ORIGIN);
    assert.equal(result.workerValue, 7);
    assert.equal(result.wasmValue, 42);
    assert.equal(result.imageBytes, files.get('images/avatar.webp').length);
    assert.deepEqual(result.api, { ok: true, source: 'network' });
    assert.deepEqual(networkUrls, [`${ORIGIN}/api/ping`]);
    assert.deepEqual([...reads.keys()].sort(), ['answer.wasm', 'avatar.webp', 'fixture.css', 'fixture.js', 'index.html', 'worker.js']);
    assert.equal(failures.length, 0);

    await targetSession.protocol.handle('opcachefixture', () => new Response(files.get('images/avatar.webp'), {
      status: 200,
      headers: { 'Content-Type': 'image/webp', 'X-OnePiece-Desktop-Cache': 'hit' }
    }));
    targetSession.webRequest.onBeforeRequest(
      { urls: [`${ORIGIN}/images/*`] },
      (_details, callback) => callback({ redirectURL: 'opcachefixture://asset/avatar' })
    );
    programRuntime.disable('fixture-handshake-failed');
    useSessionBypass = true;
    const fallbackMedia = await targetSession.fetch(`${ORIGIN}/images/avatar.webp`, { cache: 'no-store' });
    assert.equal(fallbackMedia.status, 200);
    assert.equal(fallbackMedia.headers.get('x-onepiece-desktop-cache'), 'hit');
    assert.deepEqual(Buffer.from(await fallbackMedia.arrayBuffer()), files.get('images/avatar.webp'));
    process.stdout.write(
      `DESKTOP_PROGRAM_PROTOCOL_ELECTRON_QA=PASS href=${result.href} origin=${result.origin} ` +
      `document=local css=local script=local worker=local wasm=local image=local api=network ` +
      `disabledProgramMedia=opcache bypass=PASS networkRequests=${networkUrls.length}\n`
    );
  } finally {
    if (window && !window.isDestroyed()) window.destroy();
    if (targetSession) {
      try { targetSession.webRequest.onBeforeRequest(null); } catch { /* already removed */ }
      try { await targetSession.protocol.unhandle('opcachefixture'); } catch { /* already removed */ }
      try { await targetSession.protocol.unhandle('https'); } catch { /* already removed */ }
      try { await targetSession.clearStorageData(); } catch { /* ephemeral fixture */ }
    }
    await fsp.rm(temporaryRoot, { recursive: true, force: true });
    app.quit();
  }
}

function runNodeParent() {
  const electronPath = require(path.join(ROOT, 'desktop', 'node_modules', 'electron'));
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(electronPath, [__filename, CHILD_FLAG], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 30_000,
    windowsHide: true
  });
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  if (child.error) throw child.error;
  if (child.status !== 0) throw new Error(`Electron protocol fixture exited with code ${child.status}.`);
}

if (process.versions.electron && process.argv.includes(CHILD_FLAG)) {
  runElectronChild().catch((error) => {
    process.stderr.write(`DESKTOP_PROGRAM_PROTOCOL_ELECTRON_QA=FAIL ${String(error?.stack || error)}\n`);
    appExit(1);
  });
} else {
  try {
    runNodeParent();
  } catch (error) {
    process.stderr.write(`DESKTOP_PROGRAM_PROTOCOL_ELECTRON_QA=FAIL ${String(error?.stack || error)}\n`);
    process.exitCode = 1;
  }
}

function appExit(code) {
  try {
    require('electron').app.exit(code);
  } catch {
    process.exit(code);
  }
}
