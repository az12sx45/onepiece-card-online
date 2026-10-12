'use strict';
// Real production Socket.IO + two Chrome contexts. All accounts, inventory and
// world snapshots below are isolated PGlite fixtures, never player data.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { fork } = require('node:child_process');
const PORT = Number(process.env.AVATAR_LIVE_QA_PORT || 41961), ORIGIN = `http://127.0.0.1:${PORT}`;
const OUT = process.env.AVATAR_LIVE_QA_OUT || 'D:/Codex_QA/launcher-avatar-r60/avatar-live';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));
function projectionQa() {
  const vm = require('node:vm');
  const source = fs.readFileSync(path.resolve(__dirname, '../server/index.js'), 'utf8');
  const start = source.indexOf('function boardPayloadWithCurrentAvatars(');
  const end = source.indexOf('function publishSharedAvatar(', start);
  const context = { Date }; vm.createContext(context); vm.runInContext(source.slice(start, end), context);
  const snapshot = { gameState: { round: 12, players: [{ id: 1, userId: 1, avatar: 8, clientId: 'proxy-1', isProxyCPU: true, proxyOwnerUserId: 1, isCPU: true }, { id: -1001, userId: -1001, avatar: 17, clientId: 'board-cpu-1', isCPU: true }] } };
  const projected = context.boardPayloadWithCurrentAvatars({ players: [{ userId: 1, avatar: 222 }, { userId: -1001, avatar: 5 }] }, snapshot);
  check('positive-account proxy CPU changes only avatar; ordinary negative CPU preserved', projected.gameState.players[0].avatar === 222 && projected.gameState.players[0].clientId === 'proxy-1' && projected.gameState.players[0].isProxyCPU && projected.gameState.players[0].proxyOwnerUserId === 1 && projected.gameState.players[1] === snapshot.gameState.players[1] && snapshot.gameState.players[0].avatar === 8);
  context.newer = { user_id: 1, avatar: 222, updated_at: new Date('2026-10-12T02:00:00.900Z') };
  context.older = { user_id: 1, avatar: 7, updated_at: new Date('2026-10-12T02:00:00.100Z') };
  vm.runInContext('liveAvatarVersions.set(1, { avatar:newer.avatar, stamp:profileAvatarTimestamp(newer) }); result = currentSharedAvatarProfile(older);', context);
  check('same-second stale authentication row cannot restore old avatar', context.result.avatar === 222 && context.profileAvatarTimestamp(context.newer) - context.profileAvatarTimestamp(context.older) === 800);
}
async function fixture() {
  const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
  const db = new PGlite();
  await db.exec(`CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB DEFAULT '{}',titles JSONB DEFAULT '[]',bounties JSONB DEFAULT '[]',recent_matches JSONB DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT now());`);
  for (const id of [1, 2]) await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)', [id, `r60-owner-${id}`, `航海測試${id}`, '8', JSON.stringify({ launcherOwnedV1: { items: ['ava-123', 'ava-222'] }, launcherAppearanceV1: { avatarId: id === 1 ? 222 : 123 }, client: { social: { friends: [id === 1 ? 2 : 1] }, totals: { coins: 77 } } })]);
  const pool = { query: (...args) => db.query(...args), async connect() { return { query: (...args) => db.query(...args), release() {} }; } };
  const dbPath = require.resolve('../server/db');
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool } };
  process.env.DATABASE_URL = 'isolated-pglite-no-network'; process.env.OP_DESKTOP_ONLY = '0'; process.env.PORT = String(PORT);
  require('../server/index');
}

const report = { status: 'RUNNING', scope: 'Synthetic PGlite accounts, real production handlers; two browser contexts create/join/start/turn push/refresh. Main round and crew are explicit fixtures, not a natural playthrough.', checks: [], screenshots: [], errors: [] };
function check(name, value) { assert.ok(value, name); report.checks.push(name); console.log('PASS ' + name); }
const save = () => fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
const ack = (socket, event, payload = {}) => new Promise((resolve, reject) => socket.timeout(10000).emit(event, payload, (error, result) => error ? reject(error) : resolve(result)));
const once = (socket, event, accept = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(event, listener); reject(Error('Timeout ' + event)); }, 12000);
  function listener(value) { if (accept(value)) { clearTimeout(timer); socket.off(event, listener); resolve(value); } }
  socket.on(event, listener);
});
async function protocolQa() {
  const { io } = require('../public/vendor/socket.io-client/4.8.1/socket.io.min.js');
  const sockets = [];
  async function connect(id) {
    const socket = io(ORIGIN, { transports: ['websocket'], forceNew: true }); sockets.push(socket);
    await once(socket, 'connect'); assert.equal((await ack(socket, 'SOCIAL_AUTH', { secret: `r60-owner-${id}`, deviceId: `r60-protocol-${id}` })).ok, true);
    return socket;
  }
  try {
    const a = await connect(1), b = await connect(2), launcher = await connect(1);
    const roomCode = 'B60601';
    const pa = { userId: 1, clientId: 'r60-a', avatar: 1 }, pb = { userId: 2, clientId: 'r60-b', avatar: 1 };
    assert.equal((await ack(a, 'BOARD_JOIN_ROOM', { create: true, roomCode, profile: pa })).ok, true);
    const lobby = await ack(b, 'BOARD_JOIN_ROOM', { roomCode, profile: pb });
    check('initial account 222 and 123 replace stale bootstrap 1', lobby.lobby.players[0].avatar === 222 && lobby.lobby.players[1].avatar === 123);
    const cpuResult = await ack(a, 'BOARD_ADD_CPU', { roomCode }); assert.equal(cpuResult.ok, true);
    const cpu = cpuResult.lobby.players.find(player => player.userId < 0);
    await ack(a, 'BOARD_JOIN_GAME', { roomCode, profile: pa }); await ack(b, 'BOARD_JOIN_GAME', { roomCode, profile: pb });
    let payload = { schemaVersion: 2, roomCode, gameState: { boardData: { islands: [], routes: [] }, phase: 'main', round: 12, currentPlayerIndex: 0, turnStep: '擲骰前進', settings: { cpuTurnSpeed: 1 }, players: [{ id: 1, ...pa, coins: 1234, crew: [{ hp: 211 }] }, { id: 2, ...pb, coins: 5678, crew: [{ hp: 312 }] }, { id: cpu.userId, ...cpu, crew: [{ hp: 199 }] }], marker: 'gameplay-preserved' } };
    const received = once(b, 'BOARD_GAME_STATE');
    assert.equal((await ack(a, 'BOARD_GAME_STATE', { roomCode, payload, baseVersion: 0, version: 1, reason: 'qa-seed' })).ok, true);
    payload = (await received).payload;
    await ack(a, 'CHESS_JOIN_ROOM', { create: true, roomCode: 'C60601', profile: pa });
    await ack(b, 'CHESS_JOIN_ROOM', { roomCode: 'C60601', profile: pb });
    let cardReady = once(a, 'EMIT', value => value.type === 'lobby');
    a.emit('JOIN_ROOM', { roomId: 'R60QACARD', secret: 'r60-owner-1', displayName: 'QA', avatar: 1 }); await cardReady;
    cardReady = once(b, 'EMIT', value => value.type === 'lobby');
    b.emit('JOIN_ROOM', { roomId: 'R60QACARD', secret: 'r60-owner-2', displayName: 'QB', avatar: 1 }); await cardReady;
    for (const avatar of [123, 7]) {
      const ownNotice = once(a, 'PROFILE_AVATAR_UPDATED', value => value.avatar === avatar);
      const launcherNotice = once(launcher, 'PROFILE_AVATAR_UPDATED', value => value.avatar === avatar);
      const peerLobby = once(b, 'BOARD_LOBBY', value => value.lobby.players[0].avatar === avatar);
      const chessLobby = once(b, 'CHESS_LOBBY', value => value.lobby.players[0].avatar === avatar);
      const cardLobby = once(b, 'EMIT', value => value.type === 'lobby' && value.lobby.players.some(player => player.name === 'QA' && player.avatar === avatar));
      assert.equal((await ack(launcher, 'LAUNCHER_SHOP_EQUIP', { secret: 'r60-owner-1', itemId: `ava-${avatar}`, crewContentRevision: 1 })).ok, true);
      await Promise.all([ownNotice, launcherNotice, peerLobby, chessLobby, cardLobby]);
      check('live equip ' + avatar + ' reaches own sockets and Board/Chess/Card peer', true);
      const state = once(b, 'BOARD_GAME_STATE'); await ack(b, 'BOARD_STATE_REQUEST', { roomCode });
      const current = await state;
      check('avatar-only equip keeps game version 1 at ' + avatar, current.version === 1);
      const stripped = p => ({ ...p, gameState: { ...p.gameState, players: p.gameState.players.map(({ avatar: ignored, ...player }) => player) } });
      check('avatar-only equip preserves gameplay and client identity at ' + avatar, JSON.stringify(stripped(current.payload)) === JSON.stringify(stripped(payload)));
      check('server snapshot immediately reflects avatar ' + avatar, current.payload.gameState.players[0].avatar === avatar && current.payload.gameState.players[1].avatar === 123);
    }
    const settings = clone(payload); settings.gameState.settings.cpuTurnSpeed = 2;
    const settingsUpdate = once(b, 'BOARD_GAME_STATE');
    assert.equal((await ack(a, 'BOARD_GAME_STATE', { roomCode, payload: settings, baseVersion: 1, version: 2, reason: 'settings-speed' })).ok, true);
    const settingsState = await settingsUpdate;
    check('in-flight host settings with old avatar remain legal and get current avatar', settingsState.payload.gameState.settings.cpuTurnSpeed === 2 && settingsState.payload.gameState.players[0].avatar === 7);
    const stale = clone(payload); stale.gameState.players[0].avatar = 222; stale.gameState.round = 13;
    const update = once(b, 'BOARD_GAME_STATE');
    assert.equal((await ack(a, 'BOARD_GAME_STATE', { roomCode, payload: stale, baseVersion: 2, version: 3, reason: 'qa-turn' })).ok, true);
    const state = await update;
    check('valid stale-avatar turn advances round but cannot undo chosen 7', state.version === 3 && state.payload.gameState.round === 13 && state.payload.gameState.players[0].avatar === 7);
    const outsider = await ack(b, 'BOARD_GAME_STATE', { roomCode, payload: stale, baseVersion: 3, version: 4, reason: 'qa-spoof', profile: pa });
    check('non-turn account cannot spoof current owner through profile', outsider.error === 'not_your_turn');
    const beforeGuest = once(a, 'BOARD_LOBBY', value => value.lobby.players[1].avatar === 222);
    assert.equal((await ack(b, 'LAUNCHER_CARD_SET', { secret: 'r60-owner-2', displayName: '測試船員', tagline: '', avatarId: 222, crewContentRevision: 1 })).ok, true);
    await beforeGuest; check('inactive-turn player can change own avatar without taking turn', true);
    const read = once(b, 'BOARD_GAME_STATE'); await ack(b, 'BOARD_STATE_REQUEST', { roomCode });
    const after = await read;
    check('inactive-turn cosmetics preserve version and turn', after.version === 3 && after.payload.gameState.currentPlayerIndex === 0 && after.payload.gameState.players[1].avatar === 222);
    const forged = await ack(a, 'LAUNCHER_SHOP_EQUIP', { secret: 'r60-owner-1', itemId: 'ava-221', crewContentRevision: 1 });
    check('unowned avatar still rejected', forged.error === 'not_owned');
    await ack(launcher, 'LAUNCHER_SHOP_EQUIP', { secret: 'r60-owner-1', itemId: 'ava-222', crewContentRevision: 1 });
    await ack(b, 'LAUNCHER_SHOP_EQUIP', { secret: 'r60-owner-2', itemId: 'ava-123', crewContentRevision: 1 });
  } finally { sockets.forEach(socket => socket.disconnect()); }
}

async function browserQa() {
  process.env.BOARD_QA_URL = ORIGIN;
  const helper = require('./board_voyage_records_browser_qa');
  const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  const devices = [];
  try {
    for (const id of [1, 2]) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.route(ORIGIN + '/**', async route => {
        const p = new URL(route.request().url()).pathname;
        if (p.endsWith('.html')) {
          const source = path.resolve(__dirname, '../public', '.' + p);
          assert(source.startsWith(path.resolve(__dirname, '../public') + path.sep));
          return route.fulfill({ contentType: 'text/html', body: fs.readFileSync(source, 'utf8').replaceAll('https://onepiece-card-online.onrender.com', ORIGIN) });
        }
        return route.continue();
      });
      await context.addInitScript(id => {
        localStorage.setItem('opSecret', `r60-owner-${id}`); localStorage.setItem('op_secret', `r60-owner-${id}`);
        localStorage.setItem('op_user_id', String(id)); localStorage.setItem('op_board_user_id', String(id));
        localStorage.setItem('op_board_client_id', `r60-browser-${id}`); localStorage.setItem('op_device_id', `r60-browser-device-${id}`);
        // Reproduce installed-core bootstrap clipping a paid avatar to old IDs.
        localStorage.setItem('op_avatar', '50'); localStorage.setItem('op_player_avatar', '50');
        if (location.pathname.endsWith('/board_game.html')) { const url = new URL(location.href); url.searchParams.set('skipOpeningStory', '1'); history.replaceState(null, '', url.href); }
      }, id);
      const page = await context.newPage(); page.on('pageerror', error => report.errors.push(`${id}: ${error.message}`));
      const cdp = await context.newCDPSession(page), target = await cdp.send('Target.getTargetInfo');
      await cdp.send('Browser.setPermission', { permission: { name: 'loopback-network' }, setting: 'granted', origin: ORIGIN, browserContextId: target.targetInfo.browserContextId });
      const device = { page, context, userId: id, label: String(id) }; devices.push(device);
      await page.goto(ORIGIN + '/board_start.html', { waitUntil: 'domcontentloaded' });
      await page.locator('#boardEntryStartBtn').click();
      await page.waitForFunction(() => document.body.dataset.entryStage === 'app' && window.BoardShared?.getState()?.socialReady, null, { timeout: 30000 });
      check('entry reads paid avatar beyond core 62 for account ' + id, await page.evaluate(id => window.BoardShared.getState().profile.avatar === (id === 1 ? 222 : 123), id));
    }
    const [a, b] = devices;
    const equip = (device, avatar) => helper.socketAck(device, 'LAUNCHER_SHOP_EQUIP', { secret: `r60-owner-${device.userId}`, itemId: `ava-${avatar}`, crewContentRevision: 1 });
    await equip(a, 123);
    await a.page.waitForFunction(() => document.querySelector('#playerAvatar')?.src.includes('/123.webp'));
    check('already-open entry repaints selected avatar without reload', true);
    await equip(a, 222);
    await a.page.waitForFunction(() => document.querySelector('#playerAvatar')?.src.includes('/222.webp'));
    report.roomCode = await helper.startPair(a, b);
    await helper.prepareFirstCycle(a, 12); await Promise.all(devices.map(d => helper.waitRound(d, 12)));
    await a.page.locator('#boardToolsToggle').click();
    const saved = await helper.saveThroughUi(a);
    // prepareFirstCycle deliberately moved to round 12, which schedules the
    // normal initial auto checkpoint. Let it finish before cosmetic assertions.
    await a.page.waitForFunction(() => {
      const d = window.__BOARD_GAME_DEBUG__;
      return d.getCampaignSaveState().lastAutoCheckpoint === d.boardCampaignAutoCheckpoint();
    }, null, { timeout: 20000 });
    const initialRecord = (await helper.listRecords(a)).find(record => record.campaignId === saved.campaignId);
    check('isolated real database stores baseline campaign with initial avatars', initialRecord.members.map(member => member.avatar).join(',') === '222,123');
    const oldSave = await a.page.evaluate(() => window.__BOARD_GAME_DEBUG__.createManualSavePayload());
    const world = device => device.page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__, g = d.getState().gameState;
      return { version: d.boardLanStatus().version, round: g.round, index: g.currentPlayerIndex, players: g.players.map(({ avatar, ...p }) => p) };
    });
    const baseline = await world(a);
    for (const avatar of [123, 7]) {
      assert.equal((await equip(a, avatar)).ok, true);
      for (const device of devices) {
        await device.page.waitForFunction(avatar => window.__BOARD_GAME_DEBUG__.getState().gameState.players.find(p => p.userId === 1).avatar === avatar, avatar);
        await device.page.waitForFunction(avatar => [...document.images].some(img => img.src.includes('/' + avatar + '.webp') && img.complete && img.naturalWidth > 0), avatar);
      }
      check('two running game views immediately render account 1 avatar ' + avatar, true);
      check('live avatar ' + avatar + ' changes neither version nor complete gameplay fields', JSON.stringify(await world(a)) === JSON.stringify(baseline));
    }
    await a.page.evaluate(payload => window.__BOARD_GAME_DEBUG__.loadManualGame(payload, { silent: true, source: 'lan' }), oldSave);
    check('loading old local snapshot projects current lobby avatar', await a.page.evaluate(() => window.__BOARD_GAME_DEBUG__.getState().gameState.players[0].avatar === 7));
    assert.equal((await equip(b, 222)).ok, true);
    await a.page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().gameState.players.find(p => p.userId === 2).avatar === 222);
    check('peer changing appearance does not replace own local selection', await a.page.evaluate(() => Number(localStorage.getItem('op_avatar')) === 7));
    const stalePayload = await a.page.evaluate(() => window.__BOARD_GAME_DEBUG__.createManualSavePayload());
    stalePayload.gameState.round = 13; stalePayload.gameState.players[0].avatar = 222; stalePayload.gameState.players[1].avatar = 123;
    const version = await a.page.evaluate(() => window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
    assert.equal((await helper.socketAck(a, 'BOARD_GAME_STATE', { roomCode: report.roomCode, payload: stalePayload, baseVersion: version, version: version + 1, reason: 'qa-stale-turn' })).ok, true);
    await helper.waitRound(b, 13);
    check('peer receives next legal turn with authoritative avatars', await b.page.evaluate(() => window.__BOARD_GAME_DEBUG__.getState().gameState.players.map(p => p.avatar).join(',') === '7,222'));
    await b.page.reload({ waitUntil: 'domcontentloaded' }); await helper.waitForGame(b);
    check('refresh from clipped bootstrap restores latest account and saved game avatars', await b.page.evaluate(() => window.BoardShared.getState().profile.avatar === 222 && window.__BOARD_GAME_DEBUG__.getState().gameState.players.map(p => p.avatar).join(',') === '7,222'));
    for (const device of devices) { const name = `board-live-${device.userId}.png`; await device.page.screenshot({ path: path.join(OUT, name) }); report.screenshots.push(name); }
    const listed = (await helper.listRecords(a)).find(record => record.campaignId === saved.campaignId);
    const withoutAvatars = record => ({ ...record, members: record.members.map(({ avatar, ...member }) => member) });
    report.savedRecordComparison = { before: initialRecord, after: listed };
    check('saved-record list shows latest avatars without changing saved revision or progress', listed.members.map(member => member.avatar).join(',') === '7,222' && JSON.stringify(withoutAvatars(listed)) === JSON.stringify(withoutAvatars(initialRecord)));
    await a.page.goto(ORIGIN + '/board_start.html?view=campaigns', { waitUntil: 'domcontentloaded' });
    await a.page.waitForFunction(() => document.body.dataset.entryStage === 'app' && window.BoardShared?.getState()?.socialReady && document.querySelectorAll('.campaign-member-chip img').length === 2);
    const chipAvatars = () => a.page.locator('.campaign-member-chip img').evaluateAll(images => images.map(image => Number(image.src.match(/\/(\d+)\.webp/)[1])).join(','));
    check('my voyage records UI renders current own and peer avatar', await chipAvatars() === '7,222');
    await equip(a, 123);
    await a.page.waitForFunction(() => document.querySelector('.campaign-member-chip img')?.src.includes('/123.webp'));
    check('open records list updates own avatar immediately', await chipAvatars() === '123,222');
    await equip(b, 7);
    await a.page.waitForFunction(() => document.querySelectorAll('.campaign-member-chip img')[1]?.src.includes('/7.webp'));
    check('open records list refreshes peer avatar after profile notification', await chipAvatars() === '123,7');
    const unchanged = (await helper.listRecords(a)).find(record => record.campaignId === saved.campaignId);
    check('cosmetic list refresh never changes original saved revision updatedAt or gameplay', JSON.stringify(withoutAvatars(unchanged)) === JSON.stringify(withoutAvatars(initialRecord)));
    await a.page.screenshot({ path: path.join(OUT, 'records-live.png') }); report.screenshots.push('records-live.png');
    check('no browser runtime exceptions', report.errors.length === 0);
  } catch (error) {
    report.browserDiagnostics = [];
    for (const d of devices) { report.browserDiagnostics.push({ id: d.userId, url: d.page.url(), text: (await d.page.locator('body').innerText()).slice(0, 1800) }); await d.page.screenshot({ path: path.join(OUT, `failure-${d.userId}.png`) }).catch(() => {}); }
    throw error;
  } finally { await browser.close(); }
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  await new Promise((resolve, reject) => {
    const probe = require('node:net').createServer();
    probe.once('error', reject); probe.listen(PORT, '127.0.0.1', () => probe.close(resolve));
  });
  const child = fork(__filename, ['--fixture'], { cwd: path.resolve(__dirname, '..'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'ipc'] });
  const output = []; child.stdout.on('data', data => output.push(String(data))); child.stderr.on('data', data => output.push(String(data)));
  try {
    let ready = false;
    for (let i = 0; i < 400; i++) { try { if ((await fetch(ORIGIN + '/health', { signal: AbortSignal.timeout(500) })).ok) { ready = true; break; } } catch {} await delay(100); }
    assert(ready, 'Isolated server startup'); projectionQa(); await protocolQa(); await browserQa(); report.status = 'PASS';
  } catch (error) { report.status = 'FAIL'; report.failure = error.stack; report.serverLog = output.join('').slice(-12000); }
  finally { child.kill(); save(); }
  console.log(JSON.stringify({ status: report.status, checks: report.checks.length, failure: report.failure, report: path.join(OUT, 'report.json') }));
  process.exitCode = report.status === 'PASS' ? 0 : 1;
}
if (process.argv.includes('--fixture')) fixture().catch(error => { console.error(error); process.exit(1); });
else main().catch(error => { console.error(error); process.exit(1); });
