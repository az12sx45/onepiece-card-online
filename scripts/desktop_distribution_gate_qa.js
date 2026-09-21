'use strict';

// Real HTTP/Socket.IO with disposable files only; never loads the game server,
// production accounts, rooms or save directories. All fixtures remain as evidence.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const express = require('express');
const { Server } = require('socket.io');
let clientIo;
try { ({ io: clientIo } = require('socket.io-client')); }
catch { ({ io: clientIo } = require('../desktop/node_modules/socket.io-client')); }
const { createDesktopDistribution, RETIRED_WORKER } = require('../server/desktop-distribution');

const OUTPUT = path.resolve(process.env.BOARD_QA_OUTPUT || path.join(os.tmpdir(), 'onepiece-desktop-distribution-qa'));
fs.mkdirSync(OUTPUT, { recursive: true });
const fixtureRoot = fs.mkdtempSync(path.join(OUTPUT, 'fixtures-'));
const ASSET_BASE = 'https://game-assets.rihdi.tw/desktop/blobs/sha256';
const BROWSER = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140.0.0.0 Safari/537.36';
const ELECTRON = `${BROWSER} Electron/37.3.1`;
const SOCIAL_EVENTS = ['AUTH_REGISTER', 'AUTH_LOGIN', 'PROFILE_GET', 'PROFILE_UPDATE', 'PROFILE_PUBLIC_GET', 'SOCIAL_AUTH', 'PRESENCE_SET', 'FRIENDS_GET', 'FRIEND_ADD_BY_NAME', 'FRIEND_REQUEST_ACCEPT', 'FRIEND_REQUEST_DECLINE', 'FRIEND_REMOVE', 'DM_HISTORY', 'DM_SEND'];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const report = { ok: null, startedAt: new Date().toISOString(), fixtureRoot, checks: [], socketDelivered: [], errors: [] };
let caseNumber = 0;
async function check(name, action) {
  try { await action(); report.checks.push({ name, pass: true }); }
  catch (error) { report.checks.push({ name, pass: false, detail: String(error.stack || error) }); }
}
function put(dir, relative, content) {
  const file = path.join(dir, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content);
}
function fixture(change = null) {
  const dir = path.join(fixtureRoot, String(++caseNumber)); fs.mkdirSync(dir, { recursive: true });
  const games = {};
  const manifests = {};
  for (const [index, gameId] of ['card', 'board', 'chess'].entries()) {
    const releaseId = `package-${String(index + 1).repeat(16)}`;
    const assets = [
      { path: `images/${gameId}/scene.webp`, kind: 'image', sha256: sha(`${gameId}-image`) },
      { path: `audio/${gameId}/海上 song.mp3`, kind: 'audio', sha256: sha(`${gameId}-audio`) },
      { path: `videos/${gameId}/intro.mp4`, kind: 'video', sha256: sha(`${gameId}-video`) },
      { path: `fonts/${gameId}.woff2`, kind: 'font', sha256: sha(`${gameId}-font`) },
      { path: 'images/shared.webp', kind: 'image', sha256: sha('shared') },
      { path: `js/${gameId}.js`, kind: 'script', sha256: sha(`${gameId}-program`) },
    ];
    manifests[gameId] = { gameId, releaseId, assets };
    games[gameId] = { releaseId, manifestPath: `desktop/manifests/${gameId}-${releaseId}.json`, manifestSha256: '' };
    for (const asset of assets) put(dir, asset.path, `LOCAL_${asset.path}`);
  }
  const catalog = { schema: 3, assetBlobBaseUrl: ASSET_BASE, games };
  change?.({ dir, catalog, manifests });
  for (const gameId of ['card', 'board', 'chess']) {
    const bytes = Buffer.from(JSON.stringify(manifests[gameId]));
    const relative = `desktop/manifests/${gameId}-package-${String(['card', 'board', 'chess'].indexOf(gameId) + 1).repeat(16)}.json`;
    put(dir, relative, bytes);
    if (catalog.games?.[gameId]) catalog.games[gameId].manifestSha256 = sha(bytes);
  }
  put(dir, 'desktop/catalog-v3.json', JSON.stringify(catalog));
  put(dir, 'desktop/catalog-v1.json', '{"legacy":1}');
  put(dir, 'desktop/catalog-v2.json', '{"legacy":2}');
  put(dir, 'desktop/launcher-release-v1.json', '{"version":"fixture"}');
  put(dir, 'desktop/manifests/board-assets-0123456789abcdef.json', '{"legacy":true}');
  put(dir, 'desktop-download.html', '<!doctype html><title>Download fixture</title><main>DESKTOP_DOWNLOAD_ONLY</main>');
  const programs = [
    'start.html', 'game.html', 'profile.html', 'shop.html', 'result.html', 'tutorial.html',
    'board_start.html', 'board_game.html', 'board_battle.html', 'board_fixed_viewport.html',
    'board_audio_preview.html', 'board_move_fx_preview.html', 'board_sea_event_preview.html',
    'board_impel_down.html', 'board_marineford.html', 'board_water_seven.html',
    'board_spar_selection_demo.html', 'board_york_clue_puzzle_formal_demo.html', 'game_launcher_preview.html',
    'chess/index.html', 'chess/battle-game.html', 'chess/battle-chess.js',
    'chess/assets/vendor/stockfish-18.0.0/stockfish-18-lite-single.js',
    'js/board_game.js', 'css/board_audio_ui.css', 'data/game.json', 'engine.wasm', 'sw.js',
  ];
  for (const relative of programs) put(dir, relative, `GAME_PROGRAM_${relative}`);
  put(dir, 'images/unknown.webp', 'RENDER_MEDIA_MUST_NOT_LEAK');
  put(dir, 'images/board/mobile/manifest-v397.json', '{"fixture":"desktop-small-prefetch-index"}');
  put(dir, 'misc/unknown.mp3', 'RENDER_MEDIA_MUST_NOT_LEAK');
  return { dir, catalog, manifests, programs };
}
function request(port, target, { method = 'GET', ua = BROWSER, headers = {}, body = null } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, path: target, method, headers: { ...(ua === null ? {} : { 'User-Agent': ua }), ...headers } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8'), bytes: chunks.reduce((sum, b) => sum + b.length, 0) }));
    });
    req.setTimeout(5000, () => req.destroy(new Error('HTTP fixture timeout')));
    req.on('error', reject); if (body) req.write(body); req.end();
  });
}
async function openSocket(origin, transport, extraHeaders = {}, accepted = true) {
  const socket = clientIo(origin, { transports: [transport], reconnection: false, timeout: 2500, forceNew: true, extraHeaders });
  const result = await new Promise(resolve => {
    socket.once('connect', () => resolve({ connected: true }));
    socket.once('connect_error', error => resolve({ connected: false, error: error.message }));
  });
  try { assert.equal(result.connected, accepted, JSON.stringify(result)); }
  catch (error) { socket.disconnect(); throw error; }
  if (!accepted) socket.disconnect();
  return socket;
}
function emitAck(socket, event) {
  return new Promise((resolve, reject) => socket.timeout(2000).emit(event, { fixture: true }, (error, result) => error ? reject(error) : resolve(result)));
}

(async () => {
  const base = fixture();
  const gate = createDesktopDistribution({ publicDir: base.dir, enabled: true });
  await check('deduplicates identical shared media across three games', () => assert.equal(gate.mediaCount, 13));
  const app = express(); app.use(gate.middleware); app.use(express.json());
  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.all('/api/fixture', (req, res) => res.json({ method: req.method }));
  app.get('/api/desktop-runtime-package/:gameId', (req, res) => res.json({ ok: true, gameId: req.params.gameId }));
  app.get('/api/board-runtime', (_req, res) => res.json({ ok: true }));
  app.use(express.static(base.dir));
  app.get('/', (_req, res) => res.send('LEGACY_GAME_ROOT_MUST_NOT_LEAK'));
  const server = http.createServer(app);
  const io = new Server(server, { serveClient: false, allowRequest: gate.allowSocketRequest });
  io.on('connection', socket => {
    gate.installSocketGuard(socket);
    // Match production's named handlers: Socket.IO invokes onAny before packet
    // middleware, so a catch-all ack would itself bypass the guard under test.
    for (const event of [...SOCIAL_EVENTS, 'BOARD_GAME_STATE', 'BOARD_JOIN_ROOM', 'CHESS_JOIN_ROOM', 'JOIN_ROOM', 'BOARD_CAMPAIGN_SAVE', 'BOARD_ROLL_DICE']) {
      socket.on(event, (_payload, ack) => { report.socketDelivered.push(event); ack?.({ ok: true, event }); });
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  try {
    for (const target of ['/', '/download', '/desktop-download.html']) await check(`browser download entry ${target}`, async () => {
      const r = await request(port, target); assert.equal(r.status, 200); assert.match(r.body, /DESKTOP_DOWNLOAD_ONLY/); assert.equal(r.headers['cache-control'], 'no-store');
    });
    for (const file of base.programs.filter(file => file !== 'sw.js')) await check(`browser cannot load ${file}`, async () => {
      const r = await request(port, '/' + file); assert.equal(r.status, file.endsWith('.html') ? 302 : 403); assert.ok(!r.body.includes('GAME_PROGRAM_'));
      if (r.status === 302) { assert.equal(r.headers.location, '/download'); assert.equal(r.bytes, 0); }
    });
    for (const target of ['/board_game.html?desktop=1', '/js/board_game.js?desktop=1', '/%62oard_game.html', '/js/%62oard_game.js', '//board_game.html', '/chess%2findex.html']) await check(`URL variation cannot grant access ${target}`, async () => {
      const r = await request(port, target); assert.ok([302, 403].includes(r.status) || (r.status === 200 && r.body.includes('DESKTOP_DOWNLOAD_ONLY'))); assert.ok(!r.body.includes('GAME_PROGRAM_'));
    });
    for (const target of ['/%ZZ', '/js/%00bad.js', '/js/%5cboard_game.js']) await check(`invalid path fails closed ${target}`, async () => assert.equal((await request(port, target)).status, 400));
    for (const target of ['/board_game.html', '/js/board_game.js']) await check(`HEAD does not leak program ${target}`, async () => {
      const r = await request(port, target, { method: 'HEAD' }); assert.ok([302, 403].includes(r.status)); assert.equal(r.bytes, 0);
    });
    await check('Range does not bypass browser program gate', async () => assert.equal((await request(port, '/js/board_game.js', { headers: { Range: 'bytes=0-7' } })).status, 403));
    await check('non-read static requests rejected', async () => { const r = await request(port, '/js/board_game.js', { method: 'POST', ua: ELECTRON }); assert.equal(r.status, 405); assert.equal(r.headers.allow, 'GET, HEAD'); });
    for (const file of ['board_game.html', 'start.html', 'chess/index.html', 'js/board_game.js', 'chess/battle-chess.js']) await check(`Electron receives unchanged ${file}`, async () => {
      const r = await request(port, '/' + file, { ua: ELECTRON }); assert.equal(r.status, 200); assert.equal(r.body, 'GAME_PROGRAM_' + file);
    });
    await check('Node HTTP is not a game renderer', async () => assert.equal((await request(port, '/js/board_game.js', { ua: 'node' })).status, 403));
    await check('Electron small prefetch JSON remains available', async () => {
      const r = await request(port, '/images/board/mobile/manifest-v397.json', { ua: ELECTRON });
      assert.equal(r.status, 200); assert.deepEqual(JSON.parse(r.body), { fixture: 'desktop-small-prefetch-index' });
    });
    await check('browser cannot load desktop small prefetch JSON', async () => {
      const r = await request(port, '/images/board/mobile/manifest-v397.json'); assert.equal(r.status, 404); assert.equal(r.bytes, 0);
    });
    for (const asset of base.manifests.board.assets.filter(a => ['image', 'audio', 'video', 'font'].includes(a.kind))) {
      const target = '/' + asset.path.split('/').map(encodeURIComponent).join('/');
      for (const method of ['GET', 'HEAD']) await check(`${method} media redirects with zero Render body ${asset.kind}`, async () => {
        const r = await request(port, target, { method, headers: { Range: 'bytes=0-15' } }); assert.equal(r.status, 302); assert.equal(r.bytes, 0); assert.equal(r.headers.location, `${ASSET_BASE}/${asset.sha256.slice(0, 2)}/${asset.sha256}`); assert.equal(r.headers['cache-control'], 'no-store');
      });
    }
    for (const ua of [BROWSER, ELECTRON]) for (const target of ['/images/unknown.webp', '/misc/unknown.mp3', '/audio/missing.mp3']) await check(`unknown media never falls through (${ua === BROWSER ? 'web' : 'desktop'}) ${target}`, async () => {
      const r = await request(port, target, { ua }); assert.equal(r.status, 404); assert.equal(r.bytes, 0);
    });
    for (const target of ['/desktop/catalog-v1.json', '/desktop/catalog-v2.json', '/desktop/catalog-v3.json', '/desktop/launcher-release-v1.json', '/desktop/manifests/board-assets-0123456789abcdef.json', '/' + base.catalog.games.board.manifestPath, '/health', '/api/board-runtime', '/api/desktop-runtime-package/board']) await check(`public metadata/API retained ${target}`, async () => {
      const r = await request(port, target); assert.equal(r.status, 200); assert.doesNotThrow(() => JSON.parse(r.body));
    });
    for (const method of ['POST', 'PUT', 'DELETE', 'OPTIONS']) await check(`API method remains available ${method}`, async () => {
      const r = await request(port, '/api/fixture', { method }); assert.equal(r.status, 200); assert.equal(JSON.parse(r.body).method, method);
    });
    await check('Socket.IO client bundle is not exposed', async () => assert.notEqual((await request(port, '/socket.io/socket.io.js')).status, 200));
    for (const transport of ['websocket', 'polling']) {
      for (const headers of [{ 'User-Agent': BROWSER, Origin: origin }, { 'User-Agent': BROWSER }, { 'User-Agent': 'node', Origin: origin }, { 'User-Agent': 'node', 'Sec-Fetch-Site': 'same-origin' }]) await check(`${transport} browser-like handshake rejected ${JSON.stringify(headers)}`, async () => { await openSocket(origin, transport, headers, false); });
      await check(`${transport} Electron game socket remains usable`, async () => {
        const socket = await openSocket(origin, transport, { 'User-Agent': ELECTRON, Origin: origin });
        try { assert.deepEqual(await emitAck(socket, 'BOARD_GAME_STATE'), { ok: true, event: 'BOARD_GAME_STATE' }); }
        finally { socket.disconnect(); }
      });
      for (const headers of [{}, { 'User-Agent': 'node' }, { 'User-Agent': 'node-XMLHttpRequest' }]) await check(`${transport} Node launcher social allowed but game events blocked ${JSON.stringify(headers)}`, async () => {
        const socket = await openSocket(origin, transport, headers);
        try {
          for (const event of SOCIAL_EVENTS) assert.deepEqual(await emitAck(socket, event), { ok: true, event });
          for (const event of ['BOARD_GAME_STATE', 'BOARD_JOIN_ROOM', 'CHESS_JOIN_ROOM', 'JOIN_ROOM', 'BOARD_CAMPAIGN_SAVE']) {
            const before = report.socketDelivered.filter(value => value === event).length;
            assert.deepEqual(await emitAck(socket, event), { ok: false, error: 'desktop_required', downloadUrl: '/download' });
            assert.equal(report.socketDelivered.filter(value => value === event).length, before);
          }
          const errorEvent = new Promise(resolve => socket.once('ERROR', resolve)); socket.emit('BOARD_ROLL_DICE', {});
          const error = await Promise.race([errorEvent, new Promise((_, reject) => setTimeout(() => reject(new Error('Missing no-ack error')), 1500))]);
          assert.equal(error.error, 'desktop_required');
        } finally { socket.disconnect(); }
      });
    }
    await check('browser receives retiring worker while Electron retains original worker response', async () => {
      const web = await request(port, '/sw.js'); assert.equal(web.status, 200); assert.equal(web.body, RETIRED_WORKER); assert.equal(web.headers['cache-control'], 'no-store');
      const desktop = await request(port, '/sw.js', { ua: ELECTRON }); assert.equal(desktop.body, 'GAME_PROGRAM_sw.js');
    });
  } finally { await new Promise(resolve => io.close(resolve)); if (server.listening) await new Promise(resolve => server.close(resolve)); }

  await check('retired worker unregisters and redirects same-origin game clients without touching storage', async () => {
    const listeners = {}, calls = [], pending = [];
    const client = url => ({ url, navigate: target => { calls.push(['navigate', url, target]); return Promise.resolve(); } });
    const sandbox = { URL, Promise, self: {
      location: { origin: 'https://game.example' }, addEventListener: (kind, callback) => { listeners[kind] = callback; },
      skipWaiting: () => { calls.push(['skipWaiting']); },
      registration: { unregister: async () => { calls.push(['unregister']); } },
      clients: { claim: async () => { calls.push(['claim']); }, matchAll: async () => [client('https://game.example/board_game.html'), client('https://game.example/download'), client('https://game.example/desktop-download.html'), client('https://other.example/game.html')] },
    }};
    for (const target of [sandbox, sandbox.self]) for (const key of ['caches', 'localStorage', 'sessionStorage', 'indexedDB']) Object.defineProperty(target, key, { get() { throw new Error('Storage must be preserved: ' + key); } });
    vm.runInNewContext(RETIRED_WORKER, sandbox);
    listeners.install(); listeners.activate({ waitUntil: promise => pending.push(promise) }); await Promise.all(pending);
    assert.deepEqual(calls.map(row => row[0]), ['skipWaiting', 'claim', 'unregister', 'navigate']);
    assert.deepEqual(calls.at(-1), ['navigate', 'https://game.example/board_game.html', '/download']);
  });
  const invalidCases = [
    ['catalog schema', ({ catalog }) => { catalog.schema = 2; }],
    ['unapproved asset origin', ({ catalog }) => { catalog.assetBlobBaseUrl = 'https://elsewhere.example/blobs'; }],
    ['missing game', ({ catalog }) => { delete catalog.games.chess; }],
    ['manifest traversal', ({ catalog }) => { catalog.games.board.manifestPath = '../outside.json'; }],
    ['manifest game identity', ({ manifests }) => { manifests.board.gameId = 'card'; }],
    ['manifest release identity', ({ manifests }) => { manifests.board.releaseId = 'package-0000000000000000'; }],
    ['manifest asset shape', ({ manifests }) => { manifests.board.assets = {}; }],
    ['absolute asset path', ({ manifests }) => { manifests.board.assets[0].path = '/images/bad.webp'; }],
    ['asset traversal', ({ manifests }) => { manifests.board.assets[0].path = 'images/../bad.webp'; }],
    ['backslash asset', ({ manifests }) => { manifests.board.assets[0].path = 'images\\bad.webp'; }],
    ['empty asset segment', ({ manifests }) => { manifests.board.assets[0].path = 'images//bad.webp'; }],
    ['query in asset', ({ manifests }) => { manifests.board.assets[0].path = 'images/bad.webp?v=1'; }],
    ['hash in asset', ({ manifests }) => { manifests.board.assets[0].path = 'images/bad.webp#x'; }],
    ['control in asset', ({ manifests }) => { manifests.board.assets[0].path = 'images/\u0000bad.webp'; }],
    ['invalid asset SHA', ({ manifests }) => { manifests.board.assets[0].sha256 = 'invalid'; }],
    ['conflicting shared asset', ({ manifests }) => { manifests.board.assets.find(a => a.path === 'images/shared.webp').sha256 = sha('different'); }],
  ];
  for (const [name, change] of invalidCases) await check(`invalid ${name} blocks startup`, () => {
    const bad = fixture(change); assert.throws(() => createDesktopDistribution({ publicDir: bad.dir, enabled: true }));
  });
  await check('manifest bytes must match catalog SHA', () => {
    const bad = fixture(); fs.appendFileSync(path.join(bad.dir, bad.catalog.games.board.manifestPath), ' ');
    assert.throws(() => createDesktopDistribution({ publicDir: bad.dir, enabled: true }), /hash mismatch/);
  });
  await check('missing catalog fails closed', () => assert.throws(() => createDesktopDistribution({ publicDir: path.join(fixtureRoot, 'absent'), enabled: true })));
  await check('explicit disabled gate supports isolated development without metadata', () => {
    const disabled = createDesktopDistribution({ publicDir: path.join(fixtureRoot, 'absent'), enabled: false });
    let passed = false; disabled.middleware({}, {}, () => { passed = true; }); assert.equal(passed, true);
    disabled.allowSocketRequest({ headers: { 'user-agent': BROWSER } }, (error, allowed) => { assert.equal(error, null); assert.equal(allowed, true); });
  });
  report.ok = report.checks.every(row => row.pass); report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(OUTPUT, 'desktop-distribution-gate-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed: report.checks.filter(row => !row.pass), output: OUTPUT }));
  if (!report.ok) process.exitCode = 1;
})().catch(error => { report.ok = false; report.errors.push(String(error.stack || error)); fs.writeFileSync(path.join(OUTPUT, 'desktop-distribution-gate-report.json'), JSON.stringify(report, null, 2)); console.error(error); process.exitCode = 1; });
