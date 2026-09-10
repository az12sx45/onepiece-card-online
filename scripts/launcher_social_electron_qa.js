'use strict';
const fs = require('node:fs'); const path = require('node:path'); const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const { app, BrowserWindow, ipcMain, protocol, net } = require('electron');
// QA can reuse an installed dependency tree without modifying this checkout.
if (process.env.LAUNCHER_QA_DEPENDENCIES) {
  const Module = require('node:module'); const resolve = Module._resolveFilename;
  Module._resolveFilename = function(name, ...args) { return name === 'socket.io-client' ? require.resolve(path.join(process.env.LAUNCHER_QA_DEPENDENCIES, name)) : resolve.call(this, name, ...args); };
}
const ROOT = path.resolve(__dirname, '..');
const OUT = process.env.LAUNCHER_QA_OUT || 'D:/Codex_QA/launcher-social-20260910';
const ORIGIN = 'http://127.0.0.1:18894';
fs.mkdirSync(OUT, { recursive: true }); app.setPath('userData', path.join(OUT, 'electron-state'));
protocol.registerSchemesAsPrivileged([{ scheme: 'opui', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const sessions = new Map(), errors = [], checks = [];
const wait = ms => new Promise(r => setTimeout(r, ms));
const check = (name, value) => { assert.ok(value, name); checks.push(name); };
async function until(fn, name, timeout = 15000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await fn()) return; await wait(100); } throw Error(`Timeout: ${name}`); }
const js = (w, code) => w.webContents.executeJavaScript(code, true);
function state(s) { return { authenticated: !!s.auth.accountSummary(), previewMode: false, profile: s.auth.accountSummary(), games: { card: { status: 'installed', hasInstalled: true }, board: { status: 'installed', hasInstalled: true }, chess: { status: 'installed', hasInstalled: true } }, cacheRoot: 'D:\\ONE PIECE Tabletop Games', freeBytes: 123 * 1024 ** 3 }; }
function push(s) { s.window.webContents.send('launcher:state', state(s)); }
async function main() {
  await app.whenReady();
  protocol.handle('opui', req => {
    const relative = decodeURIComponent(new URL(req.url).pathname).replace(/^\//, '');
    const target = path.resolve(ROOT, 'public', relative);
    if (!target.startsWith(path.join(ROOT, 'public') + path.sep)) return new Response('', { status: 403 });
    return net.fetch(pathToFileURL(target).href);
  });
  const { AuthService } = require('../desktop/auth-service');
  const { SocialService } = require('../desktop/social-service');
  ipcMain.handle('launcher:get-state', e => state(sessions.get(e.sender.id)));
  ipcMain.handle('launcher:get-social-state', e => ({ ok: true, state: sessions.get(e.sender.id).social.snapshot() }));
  ipcMain.handle('launcher:social-request', (e, action, payload) => sessions.get(e.sender.id).social.request(action, payload));
  ipcMain.handle('launcher:set-display-name', async (e, name) => { const s = sessions.get(e.sender.id); const r = await s.auth.setDisplayName(name); if (r.ok) { push(s); await s.social.start(); return { ok: true, state: state(s) }; } return r; });
  ipcMain.handle('launcher:logout', async e => { const s = sessions.get(e.sender.id); await s.auth.clearAccount(); push(s); return { ok: true }; });
  ipcMain.handle('launcher:get-update-state', () => ({ ok: true, state: { status: 'current', currentVersion: '1.1.7' } }));
  for (const channel of ['check-update', 'set-preferences']) ipcMain.handle(`launcher:${channel}`, () => ({ ok: true }));
  async function make(username, label, mode = 'login') {
    const auth = new AuthService({ origin: ORIGIN, userDataPath: path.join(OUT, label) }); await auth.load();
    const social = new SocialService(auth);
    const r = await auth.authenticate(mode, { username, password: 'qa-social-pass' }); assert.equal(r.ok, true);
    const window = new BrowserWindow({ show: false, width: 1440, height: 950, webPreferences: { preload: path.join(ROOT, 'desktop', 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
    const s = { auth, social, window }; sessions.set(window.webContents.id, s);
    social.on('state', data => { if (!window.isDestroyed()) window.webContents.send('launcher:social-state', data); });
    window.webContents.on('console-message', (_e, level, message) => { if (level >= 3 && !message.includes('ERR_FILE_NOT_FOUND')) errors.push(message); });
    await social.start(); await window.loadFile(path.join(ROOT, 'desktop', 'launcher.html'));
    await until(() => js(window, "document.body.dataset.stage === 'app'"), 'app');
    await js(window, "document.hasFocus = () => true; true");
    return s;
  }
  const a = await make('qa_new', 'a'), b = await make('qa_friend', 'b');
  check('existing unnamed account needs onboarding', a.auth.accountSummary().needsDisplayName === true);
  check('no login username used as public name', !a.auth.accountSummary().name.includes('qa_new'));
  check('name dialog opens before access', await js(a.window, "document.getElementById('playerNameDialog').open"));
  await js(a.window, "document.getElementById('playerNameInput').value='海上信差'; document.getElementById('playerNameSave').click()");
  await until(() => js(a.window, "document.getElementById('playerNameHint').textContent.includes('已有人')"), 'duplicate name');
  check('duplicate name rejected', a.auth.accountSummary().needsDisplayName);
  await js(a.window, "document.getElementById('playerNameInput').value='遠航船長'; document.getElementById('playerNameSave').click()");
  await until(() => !a.auth.accountSummary().needsDisplayName, 'save name');
  check('name saved without losing stats', a.auth.accountSummary().coins === 1234);
  await until(() => b.social.friends.some(p => p.userId === 43 && p.name === '遠航船長'), 'friend sees canonical name');
  const fresh = await make('qa_fresh_' + Date.now(), 'fresh', 'register');
  check('fresh registration opens nickname dialog', await js(fresh.window, "document.getElementById('playerNameDialog').open"));
  await fresh.auth.clearAccount(); fresh.window.destroy();
  for (const s of [a, b]) await js(s.window, "document.getElementById('socialButton').click()");
  await until(() => js(a.window, "!!document.querySelector('.social-person[data-user-id=\"44\"]')"), 'friend row');
  await js(a.window, "document.querySelector('.social-person[data-user-id=\"44\"]').click()");
  await until(() => js(a.window, "document.getElementById('socialChatNotice').hidden"), 'history loaded');
  await js(b.window, "document.getElementById('downloadsButton').click()");
  await js(a.window, "document.getElementById('socialMessageInput').value='今晚來一場霸海戰棋？'; document.getElementById('socialSend').click()");
  await until(() => b.social.unread[43] === 1, 'unread message');
  check('one outgoing message', a.social.conversations[44].length === 1);
  check('live message and unread badge', await js(b.window, "!document.getElementById('socialBadge').hidden"));
  await js(b.window, "document.getElementById('socialButton').click(); document.querySelector('.social-person[data-user-id=\"43\"]').click()");
  await until(() => b.social.unread[43] === 0, 'mark read');
  check('history and live message deduplicate', b.social.conversations[43].length === 1);
  await js(b.window, "document.getElementById('socialMessageInput').value='好啊，我在航海錄，這回合結束就過去。'; document.getElementById('socialSend').click()");
  await until(() => a.social.conversations[44]?.length === 2, 'reply');
  for (const [page, text] of [['desktop-card', '爭霸戰'], ['board-game', '航海錄'], ['chess', '霸海戰棋'], ['desktop-launcher', '啟動器']]) {
    await b.auth.setPresence(page);
    await until(() => js(a.window, `document.getElementById('socialPeerActivity').textContent.includes(${JSON.stringify(text)})`), page);
    checks.push(`presence ${page}`);
  }
  await a.auth.setPresence('desktop-board'); await b.auth.setPresence('chess');
  check('friend add sent', (await a.social.request('add', { name: '第三位好友' })).ok);
  check('outgoing request listed', a.social.requestsOut.some(p => p.userId === 45));
  const c = await make('qa_other', 'c');
  check('incoming request listed', c.social.requestsIn.some(p => p.userId === 43));
  check('accept request', (await c.social.request('accept', { userId: 43 })).ok);
  await until(() => a.social.friends.some(p => p.userId === 45), 'friend accepted');
  check('cannot send nonfriend', !(await b.social.request('send', { userId: 45, body: 'blocked' })).ok);
  check('invalid IPC action rejected', !(await a.social.request('AUTH_LOGIN', {})).ok);
  await a.auth.setDisplayName('遠航船長・改名');
  await until(() => js(b.window, "document.getElementById('socialPeerName').textContent === '遠航船長・改名'"), 'open chat renamed');
  checks.push('already open header follows name change');
  const profile = await a.auth.emitAck('PROFILE_PUBLIC_GET', { userId: 43 });
  check('public profile omits secret', profile.ok && !profile.profile.secret);
  const screenshot = async (s, name) => { await wait(150); fs.writeFileSync(path.join(OUT, name), (await s.window.webContents.capturePage()).toPNG()); };
  await screenshot(a, 'social-desktop.png');
  for (const [width, height] of [[1024, 768], [390, 844]]) {
    a.window.setContentSize(width, height); await wait(150);
    const overflow = await js(a.window, "({doc:document.documentElement.scrollWidth>innerWidth+1, panel:document.getElementById('socialPanel').getBoundingClientRect().right>innerWidth+1})");
    check(`layout ${width}`, !overflow.doc && !overflow.panel);
    await screenshot(a, `social-${width}.png`);
  }
  a.window.setContentSize(1440, 900);
  a.window.webContents.send('launcher:state', { ...state(a), games: { ...state(a).games, board: { hasInstalled: true, status: 'update', remoteVersion: 'qa-update-2' } } });
  await until(() => js(a.window, "document.getElementById('updatePrompt').open"), 'game update prompt');
  check('game update notice', await js(a.window, "document.getElementById('updatePromptTitle').textContent.includes('航海錄')"));
  await screenshot(a, 'game-update-prompt.png');
  await js(a.window, "document.getElementById('updatePromptLater').click()"); push(a); await wait(700);
  check('dismissed game update stays quiet', !await js(a.window, "document.getElementById('updatePrompt').open"));
  a.window.webContents.send('launcher:update-state', { status: 'available', availableVersion: '1.1.8', currentVersion: '1.1.7' });
  await until(() => js(a.window, "document.getElementById('updatePrompt').open"), 'launcher update prompt');
  check('launcher update notice', await js(a.window, "document.getElementById('updatePromptTitle').textContent.includes('啟動器')"));
  await js(a.window, "document.getElementById('updatePromptGo').click()");
  check('update action opens settings', await js(a.window, "document.getElementById('settingsDialog').open"));
  await a.auth.clearAccount(); push(a); await wait(100);
  check('logout purges friends and messages', a.social.friends.length === 0 && Object.keys(a.social.conversations).length === 0);
  check('logout clears visible conversation', await js(a.window, "document.getElementById('socialChat').hidden && document.body.dataset.stage==='auth'"));
  check('renderer contains no errors', errors.length === 0);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify({ ok: true, checks, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, checks: checks.length, output: OUT }));
}
main().catch(e => { fs.writeFileSync(path.join(OUT, 'failure.json'), JSON.stringify({ error: e.stack, checks, errors }, null, 2)); console.error(e); process.exitCode = 1; }).finally(() => { for (const s of sessions.values()) { s.auth.close(); if (!s.window.isDestroyed()) s.window.destroy(); } app.exit(process.exitCode || 0); });
