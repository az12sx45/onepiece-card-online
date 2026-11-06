'use strict';
// One old-page socket on an owned ephemeral server, with handshake diagnostics.
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const { spawn, execFileSync } = require('node:child_process');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const deps = 'C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/node_modules';
process.env.NODE_PATH = deps; Module._initPaths();
if (process.argv.includes('--server')) {
  const entry = path.join(root, 'server/index.js'), compiled = new Module(entry, module);
  compiled.filename = entry; compiled.paths = Module._nodeModulePaths(path.dirname(entry));
  const instrumentation = `
server.on('listening',()=>process.send?.({kind:'listening',port:server.address().port}));
io.engine.on('connection_error',error=>process.send?.({kind:'engine-error',code:error.code,message:error.message,context:error.context&&{name:error.context.name,message:error.context.message},headers:{ua:error.req?.headers['user-agent'],origin:error.req?.headers.origin}}));
io.engine.on('connection',client=>process.send?.({kind:'engine-connected',transport:client.transport.name,ua:client.request.headers['user-agent'],origin:client.request.headers.origin}));
io.on('connection',socket=>process.send?.({kind:'socket-connected'}));
`;
  let serverSource = fs.readFileSync(entry, 'utf8');
  if (process.env.CARD_LEGACY_SOCKET_HTTP === '1') {
    compiled.__legacyQaBytes = Object.fromEntries([
      ['/game.html', 'public/game.html'], ['/js/card-desktop-table.js', 'public/js/card-desktop-table.js']
    ].map(([url, file]) => [url, execFileSync('git', ['show', `dbc45faa4377df86cf0fbb86944c1379b84cdc05:${file}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 })]));
    const anchor = 'app.use(desktopDistribution.middleware);';
    if (!serverSource.includes(anchor)) throw Error('HTTP fixture insertion point missing');
    serverSource = serverSource.replace(anchor, anchor + `
app.get(['/game.html','/js/card-desktop-table.js'],(req,res)=>res.type(req.path.endsWith('.js')?'application/javascript':'text/html').send(module.__legacyQaBytes[req.path]));
`);
  }
  compiled._compile(serverSource + instrumentation, entry);
  return;
}
const out = process.env.CARD_LEGACY_SOCKET_OUT || 'D:/Codex_QA/card-duel-stage-20261106/legacy-socket-probe-1';
const ua = process.env.CARD_LEGACY_SOCKET_UA || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1';
const report = { userAgent: ua, base: 'dbc45faa4377df86cf0fbb86944c1379b84cdc05', mainDocumentTransport: process.env.CARD_LEGACY_SOCKET_HTTP === '1' ? 'server-http' : 'playwright-fulfill', server: [], network: [], console: [], errors: [], requestsFailed: [] };
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const old = {};
for (const file of ['public/game.html', 'public/js/card-desktop-table.js']) {
  old[file] = execFileSync('git', ['show', `${report.base}:${file}`], { cwd: root, maxBuffer: 8 * 1024 * 1024 });
}
report.legacySources = Object.entries(old).map(([file, b]) => ({ file, bytes: b.length, sha256: hash(b) }));
const watched = ['server/index.js', 'server/engine.js'];
report.sourceFiles = watched.map(file => ({ file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
let child, browser, logs = '', failure;
(async () => {
  try {
    const port = await new Promise((resolve, reject) => {
      child = spawn(process.execPath, [__filename, '--server'], { cwd: root, windowsHide: true, env: { ...process.env, DATABASE_URL: '', PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
      const deadline = setTimeout(() => reject(Error('server did not listen')), 15000);
      child.on('message', message => { report.server.push(message); if (message.kind === 'listening') { clearTimeout(deadline); resolve(message.port); } });
      child.stdout.on('data', b => logs += b); child.stderr.on('data', b => logs += b);
      child.on('exit', code => { clearTimeout(deadline); if (!report.server.some(e => e.kind === 'listening')) reject(Error('server exited ' + code)); });
    });
    const origin = `http://127.0.0.1:${port}`; report.origin = origin;
    const pw = require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
    browser = await pw.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
    const context = await browser.newContext({ userAgent: ua, viewport: { width: 1366, height: 768 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin !== origin) return route.abort();
      if (process.env.CARD_LEGACY_SOCKET_HTTP !== '1' && url.pathname === '/game.html') return route.fulfill({ contentType: 'text/html', body: old['public/game.html'] });
      if (process.env.CARD_LEGACY_SOCKET_HTTP !== '1' && url.pathname === '/js/card-desktop-table.js') return route.fulfill({ contentType: 'text/javascript', body: old['public/js/card-desktop-table.js'] });
      if (/^\/(images|art|fonts|audio|videos)\//.test(url.pathname)) return route.fulfill({ status: 204, body: '' });
      return route.continue();
    });
    await context.addInitScript(() => {
      window.__TABLETOP_ANDROID_TEST_ORIGIN = location.origin;
      localStorage.setItem('opSecret', 'qa-socket-' + crypto.randomUUID());
      HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function () {};
    });
    const page = await context.newPage(), cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    cdp.on('Network.webSocketCreated', e => report.network.push({ kind: 'ws-created', url: e.url, id: e.requestId }));
    cdp.on('Network.webSocketWillSendHandshakeRequest', e => report.network.push({ kind: 'ws-request', id: e.requestId, ua: e.request.headers['User-Agent'], origin: e.request.headers.Origin }));
    cdp.on('Network.webSocketHandshakeResponseReceived', e => report.network.push({ kind: 'ws-response', id: e.requestId, status: e.response.status, text: e.response.statusText }));
    cdp.on('Network.webSocketFrameError', e => report.network.push({ kind: 'ws-error', id: e.requestId, error: e.errorMessage }));
    cdp.on('Network.webSocketClosed', e => report.network.push({ kind: 'ws-closed', id: e.requestId }));
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', e => { if (e.type() === 'error' || /socket/.test(e.text())) report.console.push({ type: e.type(), text: e.text().slice(0, 500) }); });
    page.on('requestfailed', r => report.requestsFailed.push({ url: r.url(), failure: r.failure() }));
    await page.goto(origin + '/game.html?name=QAlegacy-single', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => typeof socket === 'object', null, { timeout: 10000 });
    await page.evaluate(() => {
      window.__socketProbe = [];
      socket.on('connect_error', e => __socketProbe.push({ type: 'connect_error', message: e.message, description: String(e.description || ''), context: e.context && { status: e.context.status, statusText: e.context.statusText } }));
      socket.on('disconnect', reason => __socketProbe.push({ type: 'disconnect', reason }));
      socket.on('connect', () => __socketProbe.push({ type: 'connect' }));
    });
    try { await page.waitForFunction(() => socket.connected, null, { timeout: 6500 }); } catch {}
    report.snapshot = await page.evaluate(() => ({ ua: navigator.userAgent, connected: socket.connected, active: socket.active, uri: socket.io.uri, manager: socket.io._readyState, transport: socket.io.engine?.transport?.name, engine: socket.io.engine?.readyState, events: __socketProbe, api: !!window.CardPhonePresentation, seat: me.playerId, hasDoJoin: typeof doJoin === 'function' }));
    if (report.snapshot.connected) {
      await page.evaluate(() => { el.room.value = 'QA-LEGACY-SOCKET-' + Date.now(); doJoin('QA legacy socket'); });
      await page.waitForFunction(() => Number.isInteger(me.playerId) && state?.players?.length, null, { timeout: 8000 });
      report.joined = await page.evaluate(() => ({ seat: me.playerId, players: state.players.length, pending: state.pending?.action || null }));
    }
  } catch (error) { failure = error.stack; }
  finally {
    await browser?.close().catch(() => {});
    if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => { child.once('exit', resolve); setTimeout(resolve, 3000); }); }
    report.failure = failure || null; report.serverLogTail = logs.slice(-5000);
    report.sourceStable = report.sourceFiles.every(item => hash(fs.readFileSync(path.join(root, item.file))) === item.sha256);
    fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({ report: path.join(out, 'report.json'), connected: report.snapshot?.connected, joined: report.joined, failure, network: report.network, server: report.server, snapshot: report.snapshot }));
    if (failure || !report.snapshot?.connected) process.exitCode = 1;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
