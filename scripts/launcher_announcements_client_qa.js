'use strict';
// Actual Chromium loads the production launcher HTML, CSP, CSS and scripts.
// The IPC/backend is an isolated fixture: this is not a real purchase, account,
// public deployment, physical-device test or human visual acceptance.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), crypto = require('node:crypto'), assert = require('node:assert/strict'), vm = require('node:vm'), Module = require('node:module');
const root = path.resolve(__dirname, '..');
const out = process.env.LAUNCHER_ANNOUNCEMENTS_QA_OUT || path.join(root, 'tools/launcher-room/presentation-v126/review-evidence');
const scratch = process.env.LAUNCHER_ANNOUNCEMENTS_QA_TEMP || 'D:/Codex_QA/launcher-announcements-1.2.6/client-browser-temp';
fs.mkdirSync(out, { recursive: true }); fs.mkdirSync(scratch, { recursive: true });
process.env.TEMP = scratch; process.env.TMP = scratch;
const playwright = process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/13827bafdc0b5422/bin/node_modules/playwright';
const { chromium } = require(playwright);
const files = ['main.js', 'preload.js', 'auth-service.js', 'launcher.html', 'launcher.js', 'launcher-updates-ui.js', 'launcher-profile-shop.js', 'launcher-announcements.js', 'launcher-announcements.css'];
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const bindings = () => Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(root, 'desktop', file)))]));
const sourceSha256 = bindings(), results = [], captures = [];
let browser, server, context, page; const errors = [];
const check = async (name, run) => { await run(); results.push({ name, status: 'PASS' }); console.log('PASS ' + name); };
async function bridgeTests() {
  await check('preload-exposes-only-two-fixed-announcement-channels', async () => {
    let exposed; const calls = [];
    vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop/preload.js'), 'utf8'), { require: id => { assert.equal(id, 'electron'); return { contextBridge: { exposeInMainWorld: (_name, value) => { exposed = value; } }, ipcRenderer: { invoke: (...args) => { calls.push(args); }, on() {}, removeListener() {} } }; } });
    exposed.getLauncherAnnouncements(); exposed.markLauncherAnnouncementsRead(['crew-ace-1.2.6']);
    assert.deepEqual(calls, [['launcher:announcements-get'], ['launcher:announcements-read', ['crew-ace-1.2.6']]]);
  });
  await check('auth-bridge-authentication-preview-shape-and-session-epoch', async () => {
    const filename = path.join(root, 'desktop/auth-service.js'), mod = new Module(filename, module); mod.filename = filename; mod.paths = Module._nodeModulePaths(path.dirname(filename));
    const normalRequire = mod.require.bind(mod); mod.require = id => id === 'electron' ? { safeStorage: {}, app: { isPackaged: true } } : normalRequire(id);
    mod._compile(fs.readFileSync(filename, 'utf8'), filename);
    const auth = new mod.exports.AuthService({ origin: 'https://unused.invalid', userDataPath: scratch });
    assert.equal((await auth.getLauncherAnnouncements()).ok, false);
    auth.secretMemory = 'fixture-secret'; auth.state.account = { userId: 42 }; const calls = [];
    auth.emitAck = async (...args) => { calls.push(args); return { ok: true }; };
    for (const bad of [null, [], ['../bad'], ['bad id'], Array(101).fill('valid-id')]) assert.equal((await auth.markLauncherAnnouncementsRead(bad)).ok, false);
    assert.equal(calls.length, 0);
    assert.equal((await auth.getLauncherAnnouncements()).ok, true);
    await auth.markLauncherAnnouncementsRead(['crew-ace-1.2.6', 'crew-ace-1.2.6']);
    assert.equal(calls[0][0], 'LAUNCHER_ANNOUNCEMENTS_GET'); assert.equal(calls[0][1].crewContentRevision, 1); assert.equal(calls[0][1].secret, 'fixture-secret');
    assert.deepEqual(calls[1][1].announcementIds, ['crew-ace-1.2.6']);
    auth.previewMode = true; assert.equal((await auth.getLauncherAnnouncements()).ok, false); auth.previewMode = false;
    auth.emitAck = async () => { auth.secretMemory = 'next-account'; return { ok: true }; };
    assert.equal((await auth.getLauncherAnnouncements()).error, 'session changed');
  });
  await check('actual-main-ipc-rejects-game-sender-and-unauthenticated-user', async () => {
    const text = fs.readFileSync(path.join(root, 'desktop/main.js'), 'utf8'), start = text.indexOf('function isLauncherSender('), end = text.indexOf('function validCredentials(', start);
    assert(start > 0 && end > start); const handlers = {}, calls = [];
    const sandbox = { authenticated: true, readyPromise: Promise.resolve(), mainWindow: { isDestroyed: () => false, webContents: { id: 7 } }, ipcMain: { handle: (key, fn) => { handlers[key] = fn; }, on() {} }, authService: { getLauncherAnnouncements: async () => { calls.push('get'); return { ok: true }; }, markLauncherAnnouncementsRead: async ids => { calls.push(ids); return { ok: true }; } } };
    vm.createContext(sandbox); vm.runInContext(text.slice(start, end) + '\nregisterLauncherIpc();', sandbox);
    const event = (id, url) => ({ sender: { id, getURL: () => url } });
    for (const bad of [event(8, 'file:///launcher.html'), event(7, 'https://server/launcher.html'), event(7, 'file:///game.html')]) assert.equal((await handlers['launcher:announcements-get'](bad)).ok, false);
    assert.equal(calls.length, 0); sandbox.authenticated = false;
    assert.equal((await handlers['launcher:announcements-read'](event(7, 'file:///launcher.html'), ['crew-ace-1.2.6'])).ok, false);
    sandbox.authenticated = true; await handlers['launcher:announcements-get'](event(7, 'file:///launcher.html')); await handlers['launcher:announcements-read'](event(7, 'file:///launcher.html'), ['crew-ace-1.2.6']);
    assert.equal(calls.length, 2);
  });
}
function fixture({ notices, shop }) {
  const subscribers = { state: [], social: [], update: [] };
  const state = id => ({ authenticated: id > 0, profile: id > 0 ? { userId: id, name: id === 42 ? '航海者' : '第二位航海者', avatar: 8, needsDisplayName: false } : null, cacheRoot: 'D:\\OnePiece\\Games', freeBytes: 20e9, preferences: { minimizeToTrayOnGameLaunch: false, gameDisplayMode: 'borderless' }, games: Object.fromEntries(['card', 'board', 'chess'].map(id => [id, { status: 'installed', hasInstalled: true }])) });
  const social = () => ({ userId: q.user, ready: !q.offline, friends: [], requestsIn: [], requestsOut: [], unread: {}, conversations: {} });
  const q = window.__noticeQA = { user: 42, offline: false, holdGet: false, holdRead: false, getResolvers: [], readResolvers: [], calls: [], read: { 42: [], 84: [] }, notices, state,
    switchUser(id) { q.user = id; if (id > 0 && document.body.dataset.stage === 'auth' && window.showApp) window.showApp(state(id)); else subscribers.state.forEach(fn => fn(state(id))); },
    connection(ready) { q.offline = !ready; subscribers.social.forEach(fn => fn({ ...social(), ready })); },
    update(value) { subscribers.update.forEach(fn => fn(value)); },
    releaseGet() { q.getResolvers.splice(0).forEach(fn => fn()); }, releaseRead() { q.readResolvers.splice(0).forEach(fn => fn()); }
  };
  const response = id => { const announcements = q.notices.map(item => ({ ...item, read: (q.read[id] || []).includes(item.id) })); return { ok: true, revision: 1, announcements, readIds: q.read[id] || [], unreadCount: announcements.filter(item => !item.read).length, total: announcements.length }; };
  window.onePieceDesktop = {
    getState: async () => state(q.user), onState: fn => subscribers.state.push(fn), onSocialState: fn => subscribers.social.push(fn), onLauncherUpdate: fn => subscribers.update.push(fn), onProgress() {}, onSessionKicked() {},
    getSocialState: async () => ({ ok: true, state: social() }), socialRequest: async () => ({ ok: true, state: social() }),
    getLauncherUpdateState: async () => ({ ok: true, state: { status: 'current', currentVersion: '1.2.6' } }),
    getLauncherAnnouncements: async () => { const owner = q.user; q.calls.push({ kind: 'get', owner }); if (q.offline) return { ok: false, error: 'offline' }; const value = response(owner); if (q.holdGet) await new Promise(resolve => q.getResolvers.push(resolve)); return value; },
    markLauncherAnnouncementsRead: async ids => { const owner = q.user; q.calls.push({ kind: 'read', owner, ids: [...ids] }); if (q.offline) return { ok: false, error: 'offline' }; if (q.holdRead) await new Promise(resolve => q.readResolvers.push(resolve)); q.read[owner] = [...new Set([...(q.read[owner] || []), ...ids])]; return { ok: true, readIds: q.read[owner], announcementIds: ids, unreadCount: notices.length - q.read[owner].length }; },
    getLauncherShop: async () => ({ ok: true, shop: { ...shop, ownedItemIds: [], equipped: {}, wallet: { coins: 40, dailyGrant: 10, cap: 500 } } }),
    buyLauncherItem: async id => { q.calls.push({ kind: 'buy', id }); return { ok: false }; },
    launchGame: async id => { q.calls.push({ kind: 'launch', id }); return { ok: false }; },
    getLauncherProfile: async () => ({ ok: false }), getLauncherComments: async () => ({ ok: false }), getLauncherLife: async () => ({ ok: false })
  };
}
async function capture(name, viewport) {
  const file = name + '.png'; await page.screenshot({ path: path.join(out, file), animations: 'disabled' });
  captures.push({ path: file, sha256: sha(fs.readFileSync(path.join(out, file))), viewport, kind: 'actual Chromium production launcher with isolated fixture IPC' });
}
async function bodyTests() {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'config/launcher-announcements-v1.json')));
  const projected = ({ id, publishedAt, title, summary, scope, category, version, body, cta, image }) =>
    ({ id, publishedAt, title, summary, scope, category, version, body, ...(cta ? { cta } : {}), ...(image ? { image } : {}) });
  const base = config.announcements.filter(item => ['launcher-1.2.6-announcements', 'crew-ace-1.2.6'].includes(item.id)).map(projected);
  const synthetic = ['card', 'board', 'chess'].map((scope, i) => ({ id: `qa-only-${scope}`, publishedAt: new Date(Date.now() - (i === 2 ? 120 : i + 1) * 86400000).toISOString(), title: `${scope} 篩選測試公告`, summary: '僅存在於隔離測試中的公告。', scope, category: 'update', version: 'QA', body: ['隔離測試內容，未寫入正式公告目錄。'], cta: { kind: 'game', gameId: scope } }));
  synthetic.push({ id: 'qa-only-plain-text', publishedAt: new Date(Date.now() - 5 * 86400000).toISOString(), title: '<img src=x onerror="window.__unsafe=true">', summary: '<script>不執行</script>', scope: 'launcher', category: 'maintenance', version: 'QA', body: ['<svg onload="window.__unsafe=true">', '純文字公告\n第二行'], cta: { kind: 'url', url: 'https://invalid.example' } });
  const shopModule = require(path.join(root, 'server/launcher-profile-shop')); const catalog = shopModule.CATALOG;
  const shop = { catalog, items: catalog, releasedCharacterIds: catalog.filter(item => item.type === 'room_character').map(item => item.id), rosterRevision: 2 };
  server = http.createServer((request, response) => {
    const relative = decodeURIComponent(new URL(request.url, 'http://localhost').pathname).replace(/^\//, '') || 'launcher.html';
    const target = path.resolve(root, 'desktop', relative);
    if (!target.startsWith(path.join(root, 'desktop') + path.sep) || !fs.existsSync(target) || !fs.statSync(target).isFile()) { response.writeHead(404); response.end(); return; }
    const ext = path.extname(target); response.setHeader('Content-Type', ext === '.js' ? 'text/javascript' : ext === '.css' ? 'text/css' : 'text/html'); response.end(fs.readFileSync(target));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', args: ['--disable-gpu-shader-disk-cache'] });
  context = await browser.newContext({ viewport: { width: 1280, height: 820 }, reducedMotion: 'reduce' });
  await context.addInitScript(fixture, { notices: [...base, ...synthetic], shop });
  await context.route('opui://**', route => {
    const rel = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, ''), target = path.resolve(root, 'public', rel);
    return target.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(target) ? route.fulfill({ path: target }) : route.fulfill({ status: 404, body: 'missing fixture asset' });
  });
  page = await context.newPage(); page.on('pageerror', error => errors.push(error.stack || error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.dataset.stage === 'app' && document.getElementById('announcementBadge').textContent === '6');
  await page.locator('#announcementsButton').click();
  await check('startup-fetch-and-opening-center-do-not-mark-read', async () => { assert.equal(await page.locator('.announcement-row').count(), 6); assert.equal(await page.evaluate(() => __noticeQA.calls.filter(x => x.kind === 'read').length), 0); assert.equal(await page.locator('#announcementBadge').textContent(), '6'); });
  await capture('announcements-desktop-list', { width: 1280, height: 820 });
  await check('scope-category-date-filters-preserve-global-unread', async () => {
    for (const scope of ['card', 'board', 'chess']) { await page.locator(`[data-scope="${scope}"]`).click(); assert.equal(await page.locator('.announcement-row').count(), 1); }
    await page.locator('#announcementPeriod').selectOption('30'); assert.equal(await page.locator('.announcement-row').count(), 0);
    await page.locator('[data-scope="all"]').click(); await page.locator('#announcementCategory').selectOption('character'); assert.equal(await page.locator('.announcement-row').count(), 1);
    assert.equal(await page.locator('#announcementBadge').textContent(), '6'); assert.equal(await page.evaluate(() => __noticeQA.calls.filter(x => x.kind === 'read').length), 0);
    await page.locator('#announcementCategory').selectOption('all'); await page.locator('#announcementPeriod').selectOption('0');
  });
  await check('full-detail-open-marks-only-selected-after-server-ack', async () => {
    await page.evaluate(() => { __noticeQA.holdRead = true; }); await page.locator('[data-announcement-id="crew-ace-1.2.6"]').click();
    assert.equal(await page.locator('#announcementBadge').textContent(), '6'); assert((await page.locator('#announcementReadState').textContent()).includes('等待同步'));
    await page.evaluate(() => { __noticeQA.holdRead = false; __noticeQA.releaseRead(); }); await page.waitForFunction(() => document.getElementById('announcementBadge').textContent === '5');
    assert.equal(await page.locator('#announcementReadState').textContent(), '已讀'); assert.match(await page.locator('#announcementBody').textContent(), /18 金幣/);
  });
  await capture('announcements-desktop-ace', { width: 1280, height: 820 });
  await check('shop-cta-focuses-live-ace-product-without-purchasing', async () => {
    await page.locator('#announcementAction').click(); await page.waitForFunction(() => document.querySelector('.shop-item.is-announcement-target')?.dataset.itemId === 'room-character-ace');
    assert(await page.locator('#shopPanel').isVisible()); assert.equal(await page.evaluate(() => __noticeQA.calls.filter(x => x.kind === 'buy').length), 0); await page.locator('#announcementsButton').click();
  });
  await check('game-cta-selects-correct-game-without-launch-or-download', async () => {
    await page.locator('[data-announcement-id="qa-only-board"]').click(); await page.locator('#announcementAction').click();
    assert(await page.locator('#libraryPanel').isVisible()); assert.equal(await page.locator('#featureTitle').textContent(), '新世界航海錄'); assert.equal(await page.evaluate(() => __noticeQA.calls.filter(x => x.kind === 'launch').length), 0); await page.locator('#announcementsButton').click();
  });
  await check('notice-text-is-not-html-and-unknown-cta-stays-hidden', async () => {
    await page.locator('[data-announcement-id="qa-only-plain-text"]').click(); assert.equal(await page.locator('#announcementBody svg').count(), 0); assert.equal(await page.locator('#announcementDetailTitle img').count(), 0); assert.equal(await page.evaluate(() => window.__unsafe), undefined); assert(await page.locator('#announcementAction').isHidden());
  });
  await check('offline-open-stays-unread-until-reconnect-and-ack', async () => {
    await page.evaluate(() => __noticeQA.connection(false)); const before = await page.locator('#announcementBadge').textContent();
    await page.locator('[data-announcement-id="qa-only-card"]').click(); await page.waitForFunction(() => document.getElementById('announcementStatus').textContent.includes('離線'));
    assert.equal(await page.locator('#announcementBadge').textContent(), before); assert((await page.locator('#announcementReadState').textContent()).includes('等待同步'));
    await page.evaluate(() => __noticeQA.connection(true)); await page.waitForFunction(() => document.getElementById('announcementReadState').textContent === '已讀'); assert.equal(Number(await page.locator('#announcementBadge').textContent()), Number(before) - 1);
  });
  await check('account-switch-discards-stale-read-and-isolates-cached-state', async () => {
    await page.evaluate(() => { __noticeQA.holdRead = true; }); await page.locator('[data-announcement-id="qa-only-chess"]').click();
    await page.evaluate(() => __noticeQA.switchUser(84)); await page.waitForFunction(() => document.getElementById('announcementBadge').textContent === '6');
    await page.evaluate(() => { __noticeQA.holdRead = false; __noticeQA.releaseRead(); });
    assert.equal(await page.locator('#announcementBadge').textContent(), '6'); assert(await page.locator('#announcementArticle').isHidden());
    assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('onepiece.launcher.announcements.v1.84')).entries.filter(x => x.read).length), 0);
  });
  await check('account-switch-discards-stale-get-result', async () => {
    await page.evaluate(() => { __noticeQA.holdGet = true; }); await page.locator('#announcementRefresh').click();
    await page.evaluate(() => { __noticeQA.holdGet = false; __noticeQA.switchUser(42); });
    await page.waitForFunction(() => document.getElementById('announcementBadge').textContent === '1');
    await page.evaluate(() => __noticeQA.releaseGet()); assert.equal(await page.locator('#announcementBadge').textContent(), '1');
  });
  await check('stale-get-cannot-undo-concurrent-confirmed-read', async () => {
    await page.evaluate(() => { __noticeQA.holdGet = true; }); await page.locator('#announcementRefresh').click();
    await page.locator('[data-announcement-id="launcher-1.2.6-announcements"]').click(); await page.waitForFunction(() => document.getElementById('announcementBadge').hidden);
    await page.evaluate(() => { __noticeQA.holdGet = false; __noticeQA.releaseGet(); }); await page.waitForFunction(() => !document.getElementById('announcementRefresh').disabled); assert(await page.locator('#announcementBadge').isHidden());
  });
  await check('explicit-mark-all-uses-only-current-visible-account-notices', async () => {
    await page.evaluate(() => __noticeQA.switchUser(84)); await page.waitForFunction(() => document.getElementById('announcementBadge').textContent === '6');
    await page.locator('[data-scope="shop"]').click(); await page.locator('#announcementMarkAll').click(); await page.waitForFunction(() => document.getElementById('announcementBadge').hidden);
    const last = await page.evaluate(() => __noticeQA.calls.filter(x => x.kind === 'read').at(-1)); assert.equal(last.owner, 84); assert.equal(last.ids.length, 6); assert.equal(new Set(last.ids).size, 6);
  });
  await check('offline-cache-restores-same-account-only-and-logout-clears-ui', async () => {
    await page.evaluate(() => { __noticeQA.connection(false); __noticeQA.switchUser(0); }); assert(await page.locator('#announcementBadge').isHidden()); assert.equal(await page.locator('.announcement-row').count(), 0);
    await page.evaluate(() => __noticeQA.switchUser(42)); await page.waitForFunction(() => document.querySelectorAll('.announcement-row').length === 6); assert((await page.locator('#announcementStatus').textContent()).includes('離線'));
    await page.evaluate(() => __noticeQA.connection(true)); await page.waitForFunction(() => !document.getElementById('announcementStatus').textContent.includes('離線'));
  });
  await check('update-prompt-opens-matching-game-announcements', async () => {
    await page.evaluate(() => { LauncherUpdates.setAccount({ ...__noticeQA.state(42), games: { chess: { status: 'update', hasInstalled: true, remoteVersion: 'qa-next' } } }); window.dispatchEvent(new Event('focus')); });
    await page.waitForFunction(() => document.getElementById('updatePrompt').open); await page.locator('#updatePromptNotes').click();
    assert(await page.locator('#announcementsPanel').isVisible()); assert.equal(await page.locator('[data-scope="chess"]').getAttribute('aria-pressed'), 'true'); assert.equal(await page.locator('.announcement-row').count(), 1);
    await page.evaluate(() => LauncherUpdates.setAccount(__noticeQA.state(42)));
  });
  await check('narrow-viewport-detail-back-keyboard-and-overflow', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await page.locator('[data-scope="all"]').click(); await page.locator('[data-announcement-id="crew-ace-1.2.6"]').focus(); await page.keyboard.press('Enter');
    assert(await page.locator('#announcementArticle').isVisible()); assert(await page.locator('#announcementBack').isVisible()); assert(await page.locator('.announcement-index').isHidden());
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth, panel: document.getElementById('announcementsPanel').getBoundingClientRect().right, article: document.getElementById('announcementArticle').getBoundingClientRect().right }));
    assert(dimensions.page <= dimensions.viewport && dimensions.panel <= dimensions.viewport && dimensions.article <= dimensions.viewport, JSON.stringify(dimensions));
    await capture('announcements-narrow-ace', { width: 390, height: 844 });
    await page.locator('#announcementBack').click(); assert(await page.locator('.announcement-index').isVisible()); assert(await page.locator('#announcementArticle').isHidden());
  });
  await check('new-release-art-renders-from-local-allowlisted-asset', async () => {
    const notice = projected(config.announcements.find(item => item.id === 'launcher-1.2.13-character-life-and-dialogue'));
    assert.equal(notice.image.asset, 'images/launcher_announcements/launcher-life-1.2.13.webp');
    await page.evaluate(item => { __noticeQA.notices.push(item); }, notice);
    await page.locator('#announcementRefresh').click();
    await page.locator(`[data-announcement-id="${notice.id}"]`).click();
    await page.waitForFunction(() => document.querySelector('.announcement-hero-image')?.naturalWidth === 1672);
    assert.equal(await page.locator('.announcement-hero-image').getAttribute('alt'), notice.image.alt);
    assert(await page.locator('.announcement-hero').isVisible());
    const dimensions = await page.evaluate(() => ({ viewport: innerWidth, page: document.documentElement.scrollWidth }));
    assert(dimensions.page <= dimensions.viewport, JSON.stringify(dimensions));
    await capture('announcements-narrow-life-1213', { width: 390, height: 844 });
    await page.setViewportSize({ width: 1280, height: 820 });
    await capture('announcements-desktop-life-1213', { width: 1280, height: 820 });
  });
  await check('no-production-browser-errors-or-unrequested-purchase', async () => { assert.deepEqual(errors, []); assert.equal(await page.evaluate(() => __noticeQA.calls.filter(x => ['buy', 'launch'].includes(x.kind)).length), 0); });
}
(async () => {
  await bridgeTests(); await bodyTests(); assert.deepEqual(bindings(), sourceSha256);
  const report = { schema: 'one-piece-launcher-announcements-client-qa/1', ok: true, generatedAt: new Date().toISOString(), checks: results.length, results, sourceRoot: root, sourceSha256, sourceNormalizedSha256: Object.fromEntries(files.map(file => [file, sha(fs.readFileSync(path.join(root, 'desktop', file), 'utf8').replace(/\r\n/g, '\n'))])), testScriptSha256: sha(fs.readFileSync(__filename)), captures, errors, humanAcceptance: false, scope: 'Actual Chromium with production launcher HTML/CSP/CSS/JavaScript, desktop 1280x820 and narrow 390x844. Isolated IPC fixture includes two current production notices plus four clearly synthetic notices only for filter/race/plain-text tests. Main IPC and auth bridge executed with isolated services. Not real DB/account/purchase, physical-device, public deployment, or human acceptance.' };
  fs.writeFileSync(path.join(out, 'ANNOUNCEMENTS_CLIENT_QA.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ok: true, checks: results.length, captures: captures.length }));
})().catch(error => { fs.writeFileSync(path.join(out, 'ANNOUNCEMENTS_CLIENT_QA_FAILURE.json'), JSON.stringify({ ok: false, error: error.stack, results, errors }, null, 2)); console.error(error.stack); process.exitCode = 1; }).finally(async () => { await browser?.close(); if (server) await new Promise(resolve => server.close(resolve)); });
