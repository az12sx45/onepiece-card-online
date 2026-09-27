'use strict';

// Run with Electron, not node. All accounts and persisted state below are local fixtures.
// OP_DISTRIBUTION_QA_URL points at an isolated real server; no rooms are created.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const Module = require('node:module');
const { app, BrowserWindow, ipcMain } = require('electron');
const ROOT = path.resolve(__dirname, '..');
const DEP_ROOT = process.env.OP_QA_DEP_ROOT || 'D:/Codex_Release_Worktrees/battle-chess-launcher-v1';
const OUT = path.resolve(process.env.OP_DISTRIBUTION_QA_OUT || 'D:/Codex_QA/desktop-distribution-20260922/electron');
const REAL = process.env.OP_DISTRIBUTION_QA_URL || 'http://127.0.0.1:18927';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(REAL).hostname)) throw new Error('QA requires a local isolated server');
fs.mkdirSync(OUT, { recursive: true });
app.setPath('userData', path.join(OUT, 'electron-profile-' + Date.now()));
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) {
  if (name === 'socket.io-client') return require.resolve(path.join(DEP_ROOT, 'desktop/node_modules/socket.io-client'));
  return originalResolve.call(this, name, ...args);
};
const express = require(path.join(DEP_ROOT, 'node_modules/express'));
const { Server } = require(path.join(DEP_ROOT, 'node_modules/socket.io'));
const { io: nodeIo } = require('socket.io-client');
const { AuthService } = require('../desktop/auth-service');
const { createDesktopDistribution } = require('../server/desktop-distribution');
const checks = [], errors = [], handshakes = [], windows = [], services = [], clients = [];
const report = { startedAt: new Date().toISOString(), realServer: REAL, electron: process.versions.electron,
  scope: 'True Electron default-UA HTTP/socket; actual AuthService against controlled local fixture; no real accounts or rooms',
  mediaProbe: process.env.OP_DISTRIBUTION_QA_MEDIA === '1', bridgeOnly: process.env.OP_DISTRIBUTION_QA_BRIDGE_ONLY === '1', checks, errors, handshakes };
let fixtureServer, fixtureIo;
const check = (name, pass, detail) => checks.push({ name, pass: !!pass, ...(detail === undefined ? {} : { detail }) });
const gameEvents = ['BOARD_ROOM_LIST', 'CHESS_ROOM_LIST', 'ROOM_LIST_GET'];
const fixtureHandled = Object.create(null);
const lifePackets = [];
report.lifeTransport = { scope: 'Real preload IPC -> fixture main handlers -> actual AuthService -> actual Socket.IO gate -> controlled echo endpoints; no database business-validation claim', packets: lifePackets };
function safeHeaders(headers) {
  return { userAgent: headers['user-agent'] || '', origin: headers.origin || '',
    fetchHeaders: Object.keys(headers).filter(key => key.startsWith('sec-fetch-')) };
}
function ack(socket, event, payload = {}) {
  return new Promise(resolve => socket.timeout(4000).emit(event, payload, (err, data) => resolve(err ? { error: 'timeout' } : data)));
}
async function connectNode(origin, transports) {
  const socket = nodeIo(origin, { transports, reconnection: false, timeout: 4000 });
  clients.push(socket);
  await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
  return socket;
}
async function makeFixture() {
  const web = express();
  const gate = createDesktopDistribution({ publicDir: path.join(ROOT, 'public'), enabled: true });
  web.use(gate.middleware);
  web.use(express.static(path.join(ROOT, 'public')));
  fixtureServer = http.createServer(web);
  fixtureIo = new Server(fixtureServer, { serveClient: false, allowRequest: gate.allowSocketRequest, cors: { origin: '*' } });
  fixtureIo.on('connection', socket => {
    handshakes.push({ fixture: true, transport: socket.conn.transport.name, ...safeHeaders(socket.handshake.headers) });
    gate.installSocketGuard(socket);
    const profile = { user_id: 17, name: 'QA Local Fixture', avatar: 8,
      stats: { client: { totals: { coins: 321 }, titles: { equipped: 'Fixture' } } } };
    for (const event of ['AUTH_LOGIN', 'AUTH_REGISTER']) socket.on(event, (_payload, done) => done({ ok: true, secret: 'local-fixture-only', username: 'qa_fixture' }));
    for (const event of ['PROFILE_GET', 'PROFILE_PUBLIC_GET', 'PROFILE_UPDATE']) socket.on(event, (_payload, done) => done({ ok: true, profile }));
    for (const event of ['SOCIAL_AUTH', 'PRESENCE_SET', 'FRIENDS_GET', 'DM_HISTORY']) socket.on(event, (_payload, done) => done?.({ ok: true, friends: [], messages: [] }));
    for (const event of ['LAUNCHER_LIFE_GET','LAUNCHER_LIFE_COMMAND','LAUNCHER_ROOM_SET','LAUNCHER_SHOP_BUY']) socket.on(event, (payload, done) => {
      const { secret, ...received } = payload || {};
      lifePackets.push({ event, type: received.type, keys: Object.keys(received).sort() });
      done?.({ ok: secret === 'local-fixture-only', fixture: true, received,
        life: { schemaVersion: 1, revision: 7, ownedCharacterIds: [], activeCharacterIds: [], jobs: [] } });
    });
    for (const event of [...gameEvents, 'BOARD_GAME_STATE', 'CHESS_MOVE', 'ACTION']) socket.on(event, (_payload, done) => {
      fixtureHandled[event] = (fixtureHandled[event] || 0) + 1;
      done?.({ ok: true, rooms: [], fixture: true });
    });
  });
  await new Promise(resolve => fixtureServer.listen(0, '127.0.0.1', resolve));
  check('manifest media index loads', gate.mediaCount > 6000, gate.mediaCount);
  return 'http://127.0.0.1:' + fixtureServer.address().port;
}
async function rendererProbe(origin, label) {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  windows.push(win);
  await win.loadURL(origin + '/download');
  const result = await win.webContents.executeJavaScript(`(async () => {
    const result = { userAgent: navigator.userAgent, entries: [], sockets: [] };
    for (const entry of ['/start.html', '/board_start.html', '/chess/index.html']) {
      const response = await fetch(entry, { cache: 'no-store' });
      const body = await response.text();
      result.entries.push({ entry, status: response.status, url: response.url,
        html: /<!doctype html|<html/i.test(body), gameSource: entry.startsWith('/chess/') ? body.includes('battle-start-v1.js') : body.includes('socket.io.min.js') });
    }
    await new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/socket.io-client/4.8.1/socket.io.min.js';
      script.onload = resolve; script.onerror = reject; document.head.appendChild(script);
    });
    for (const transport of ['websocket', 'polling']) {
      const socket = io(location.origin, { transports: [transport], forceNew: true, reconnection: false, timeout: 5000 });
      try {
        await new Promise((resolve, reject) => { socket.once('connect', resolve); socket.once('connect_error', reject); });
        const item = { transport, connected: true, events: [] };
        for (const event of ${JSON.stringify(gameEvents)}) {
          const data = await new Promise(resolve => socket.timeout(5000).emit(event, {}, (error, value) => resolve(error ? { error: 'timeout' } : value)));
          item.events.push({ event, ok: data?.ok, error: data?.error || '', rooms: Array.isArray(data?.rooms) });
        }
        result.sockets.push(item);
      } catch (error) { result.sockets.push({ transport, connected: false, error: String(error.message || error) }); }
      finally { socket.disconnect(); }
    }
    return result;
  })()`);
  check(label + ': unmodified default Electron UA', /\bElectron\/\d+\./.test(result.userAgent), result.userAgent);
  for (const entry of result.entries) check(label + ': game HTML ' + entry.entry,
    entry.status === 200 && new URL(entry.url).pathname === entry.entry && entry.html && entry.gameSource, entry);
  for (const socket of result.sockets) {
    check(label + ': renderer ' + socket.transport + ' handshake', socket.connected, socket);
    for (const item of socket.events || []) check(label + ': ' + socket.transport + ' ' + item.event,
      item.error !== 'desktop_required' && item.error !== 'timeout' && (item.ok || item.error), item);
  }
  win.destroy();
}
async function authProbe(origin) {
  for (const mode of ['login', 'register']) {
    const userDataPath = path.join(OUT, 'fixture-auth-' + mode + '-' + Date.now());
    const auth = new AuthService({ origin, userDataPath }); services.push(auth);
    await auth.load();
    const result = await auth.authenticate(mode, { username: 'qa_fixture', password: 'local-fixture-password-only' });
    check('actual AuthService ' + mode, result.ok && result.account?.userId === 17 && result.account.coins === 321,
      { ok: result.ok, userId: result.account?.userId, error: result.error });
    const presence = await auth.setPresence('desktop-board');
    check('actual AuthService ' + mode + ' presence', presence.ok);
    await lifeBridgeProbe(origin, auth, mode);
    for (const event of [...gameEvents, 'BOARD_GAME_STATE', 'CHESS_MOVE', 'ACTION']) {
      const result = await auth.emitAck(event, { secret: 'local-fixture-only' }, 4000);
      check('Node ' + mode + ' rejects ' + event, result.error === 'desktop_required', result.error);
    }
    check('actual AuthService ' + mode + ' in-memory restore', (await auth.restore()).ok);
    auth.close();
    const restored = new AuthService({ origin, userDataPath }); services.push(restored);
    await restored.load();
    const canEncrypt = require('electron').safeStorage.isEncryptionAvailable();
    check('actual AuthService ' + mode + ' encrypted reload', canEncrypt && (await restored.restore()).ok,
      { encryptionAvailable: canEncrypt });
    restored.close();
  }
  for (const transport of ['websocket', 'polling']) {
    const socket = await connectNode(origin, [transport]);
    check('Node ' + transport + ' account request allowed', (await ack(socket, 'PROFILE_PUBLIC_GET')).ok);
    for (const event of gameEvents) check('Node ' + transport + ' rejects ' + event, (await ack(socket, event)).error === 'desktop_required');
    socket.disconnect();
  }
  check('Node game requests never reach handlers', Object.keys(fixtureHandled).length === 0, { ...fixtureHandled });
}
async function lifeBridgeProbe(origin, auth, mode) {
  const keys = ['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
  const room = { revision: 3, capacityVersion: 2, sceneId: 'room-scene-default',
    characters: keys.map((key, i) => ({ itemId: 'room-character-' + key, x: 140 + 65 * i, y: 430 })),
    placements: [{ itemId: 'room-furniture-galley-stove', x: 480, y: 390, rotation: 0, flip: false, scale: 1 }] };
  const getter = await auth.getLauncherLife();
  check(mode + ': Life GET crosses guarded socket', getter.ok && getter.life?.revision === 7 && Object.keys(getter.received).length === 0);
  const commands = [
    ['work.reserve', { itemId: 'room-character-sanji', stationId: 'room-furniture-galley-stove', roomRevision: 3 }],
    ['work.activate', { jobId: 'fixture-job' }], ['work.complete', { jobId: 'fixture-job' }], ['work.cancel', { jobId: 'fixture-job' }],
    ['directive.set', { directiveId: 'free_day' }], ['character.interact', { itemId: 'room-character-luffy', action: 'call' }],
    ['event.record', { eventId: 'fixture-transport-event', participants: ['room-character-luffy'] }],
    ['activity.record', { itemId: 'room-character-luffy', activity: 'Sleep' }], ['arrival.ack', { arrivalId: 'fixture-arrival' }], ['checkpoint', { exit: true }]
  ];
  for (const [type, payload] of commands) {
    const command = { requestId: 'transport-' + mode + '-' + type.replace('.', '-'), expectedRevision: 7, type, payload };
    const result = await auth.commandLauncherLife({ ...command, secret: 'forged-fixture-secret', userId: 999 });
    check(mode + ': command preserves exact transport ' + type, result.ok && JSON.stringify(result.received) === JSON.stringify(command));
  }
  for (let rotation = 0; rotation < 4; rotation++) {
    const value = { ...room, placements: [{ ...room.placements[0], rotation, flip: rotation === 2 }] };
    const result = await auth.saveLauncherRoom(value);
    check(mode + ': ten crew + stove rotation ' + rotation, result.ok && result.received.capacityVersion === 2 && result.received.characters.length === 10 && result.received.placements[0].rotation === rotation);
  }
  const beforeReject = lifePackets.length;
  check(mode + ': eleven crew rejected before transport', (await auth.saveLauncherRoom({ ...room, characters: [...room.characters, room.characters[0]] })).error === 'invalid_room');
  check(mode + ': ten crew requires capacity version2', (await auth.saveLauncherRoom({ ...room, capacityVersion: undefined })).error === 'invalid_room');
  check(mode + ': forged command type rejected before transport', (await auth.commandLauncherLife({ requestId: 'invalid-command-fixture', expectedRevision: 7, type: 'wallet.set', payload: {} })).error === 'invalid_command');
  check(mode + ': invalid data emitted no socket request', beforeReject === lifePackets.length);
  const buy = await auth.buyLauncherItem('room-furniture-galley-stove');
  check(mode + ': stove purchase ID accepted', buy.ok && buy.received.itemId === 'room-furniture-galley-stove');
  const handlers = { 'launcher:life-get': () => auth.getLauncherLife(), 'launcher:life-command': (_e,c) => auth.commandLauncherLife(c),
    'launcher:room-set': (_e,r) => auth.saveLauncherRoom(r), 'launcher:buy-item': (_e,id) => auth.buyLauncherItem(id) };
  for (const [channel, handler] of Object.entries(handlers)) ipcMain.handle(channel, handler);
  const win = new BrowserWindow({ show: false, webPreferences: { preload: path.join(ROOT, 'desktop/preload.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  windows.push(win);
  try {
    await win.loadURL(origin + '/download');
    const result = await win.webContents.executeJavaScript(`(async()=>{
      const api=window.onePieceDesktop;
      return {get:await api.getLauncherLife(),command:await api.commandLauncherLife({requestId:'preload-transport-${mode}',expectedRevision:7,type:'checkpoint',payload:{exit:true}}),room:await api.saveLauncherRoom(${JSON.stringify(room)}),buy:await api.buyLauncherItem('room-furniture-galley-stove')};
    })()`);
    check(mode + ': actual sandboxed preload Life GET', result.get.ok && result.get.life.revision === 7);
    check(mode + ': actual sandboxed preload Life command', result.command.ok && result.command.received.type === 'checkpoint');
    check(mode + ': actual sandboxed preload ten-character room', result.room.ok && result.room.received.characters.length === 10 && result.room.received.capacityVersion === 2);
    check(mode + ': actual sandboxed preload stove purchase', result.buy.ok && result.buy.received.itemId === 'room-furniture-galley-stove');
  } finally { win.destroy(); for (const channel of Object.keys(handlers)) ipcMain.removeHandler(channel); }
}
async function httpProbe(origin) {
  for (const entry of ['/start.html', '/board_start.html?desktop=1', '/chess/index.html?desktop=1', '/js/board_game.js?desktop=1']) {
    const response = await fetch(origin + entry, { redirect: 'manual' });
    check('ordinary HTTP denied ' + entry, [302, 403].includes(response.status),
      { status: response.status, location: response.headers.get('location') });
  }
  for (const target of ['/images/unknown%2Epng', '/audio/%75nknown.ogg', '/font%73/unknown.bin', '/unknown%2Ewebp', '/images/%5cunknown', '/images/%00unknown', '/images/%ZZ']) {
    const response = await fetch(origin + target, { redirect: 'manual', headers: { 'User-Agent': 'Electron/44.0.0' } });
    check('encoded unknown media has no body ' + target, [400, 404].includes(response.status) && (await response.arrayBuffer()).byteLength === 0,
      { status: response.status });
  }
  const worker = await fetch(origin + '/sw.js');
  const text = await worker.text();
  check('ordinary HTTP retires previous service worker', worker.status === 200 && text.includes('unregister()') && text.includes("navigate('/download')") && !text.includes("addEventListener('fetch'"));
}
async function mediaProbe(origin) {
  // Fresh renderer has no opcache handler, so this deliberately exercises a local media miss.
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/desktop/catalog-v3.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', catalog.games.board.manifestPath), 'utf8'));
  const samples = ['image', 'audio', 'font'].map(kind => manifest.assets.filter(asset => asset.kind === kind).sort((a, b) => a.size - b.size)[0]);
  const win = new BrowserWindow({ show: false, webPreferences: { partition: 'distribution-media-' + Date.now(), sandbox: true, contextIsolation: true, nodeIntegration: false } });
  windows.push(win);
  await win.loadURL(origin + '/download');
  const results = await win.webContents.executeJavaScript(`(async () => {
    const results = [];
    for (const asset of ${JSON.stringify(samples)}) {
      try {
        const response = await fetch('/' + asset.path.split('/').map(encodeURIComponent).join('/'), { cache: 'no-store' });
        const bytes = await response.arrayBuffer();
        const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))).map(v => v.toString(16).padStart(2, '0')).join('');
        let decoded = false;
        if (asset.kind === 'image') { const bitmap = await createImageBitmap(new Blob([bytes], { type: asset.mime })); decoded = bitmap.width > 0 && bitmap.height > 0; bitmap.close(); }
        if (asset.kind === 'audio') { const ctx = new AudioContext(); const audio = await ctx.decodeAudioData(bytes.slice(0)); decoded = audio.duration > 0; await ctx.close(); }
        if (asset.kind === 'font') { const font = await new FontFace('DistributionQaFont', bytes).load(); decoded = font.status === 'loaded'; }
        results.push({ kind: asset.kind, status: response.status, url: response.url, bytes: bytes.byteLength,
          matches: hash === asset.sha256 && bytes.byteLength === asset.size, decoded });
      } catch (error) { results.push({ kind: asset.kind, error: String(error.message || error) }); }
    }
    return results;
  })()`);
  for (const item of results) check('fresh Electron missing ' + item.kind + ' redirects to R2 and decodes',
    item.status === 200 && item.url?.startsWith('https://game-assets.rihdi.tw/desktop/blobs/sha256/') && item.matches && item.decoded, item);
  win.destroy();
}
async function finish(error) {
  if (error) errors.push(String(error.stack || error));
  for (const service of services) service.close();
  for (const socket of clients) socket.disconnect();
  for (const window of windows) if (!window.isDestroyed()) window.destroy();
  if (fixtureIo) await new Promise(resolve => fixtureIo.close(resolve));
  else if (fixtureServer) await new Promise(resolve => fixtureServer.close(resolve));
  report.finishedAt = new Date().toISOString();
  report.passed = checks.filter(item => item.pass).length;
  report.failed = checks.filter(item => !item.pass).length;
  report.ok = !report.failed && !errors.length;
  fs.writeFileSync(path.join(OUT, 'desktop-distribution-electron-report.json'), JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify({ ok: report.ok, passed: report.passed, failed: report.failed, errors: errors.length, out: OUT }) + '\n');
  app.exit(report.ok ? 0 : 1);
}
app.on('window-all-closed', () => {});
app.whenReady().then(async () => {
  const fixture = await makeFixture();
  await authProbe(fixture);
  if (!report.bridgeOnly) await rendererProbe(fixture, 'controlled fixture');
  await httpProbe(REAL);
  if (!report.bridgeOnly) await rendererProbe(REAL, 'real isolated server');
  if (report.mediaProbe) await mediaProbe(REAL);
  await finish();
}).catch(finish);
