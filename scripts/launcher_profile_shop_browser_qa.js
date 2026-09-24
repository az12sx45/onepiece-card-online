'use strict';

// Isolated renderer QA. Reads the real launcher HTML/CSS/JS, but replaces its
// preload bridge with deterministic in-page data. No account, server, or DB I/O.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { CATALOG } = require('../server/launcher-profile-shop');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT ||
  'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/7f75cff94511d5f8/bin/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const addedAvatars = CATALOG.filter(item => item.type === 'avatar' && Number(item.key) >= 51 && Number(item.key) <= 62).sort((a, b) => Number(a.key) - Number(b.key));
const opTracks = CATALOG.filter(item => item.type === 'bgm' && /^bgm-op-(?:0[1-9]|1[0-9]|20)$/.test(item.id)).sort((a, b) => a.id.localeCompare(b.id));
const out = path.resolve(process.env.LAUNCHER_PROFILE_QA_OUT || 'D:/Codex_QA/launcher-profile-shop-renderer');
const report = { scope: 'Local Chromium renderer with mocked Electron preload; no real accounts, purchases, or server calls', checks: [], screenshots: [], missingAssets: [], errors: [], audioRequests: [], audioResponses: [], audioAborts: [], audioFailures: [] };
fs.mkdirSync(out, { recursive: true });
function save() { fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n'); }
function check(name, condition, detail) {
  report.checks.push({ name, pass: !!condition, detail });
  save();
  assert.ok(condition, `${name}${detail ? `: ${JSON.stringify(detail)}` : ''}`);
}
const read = file => fs.readFileSync(path.join(root, 'desktop', file), 'utf8');
const ownProfile = {
  userId: 42, name: '測試船長', title: '偉大航道航海者', avatar: 8, isSelf: true,
  games: {
    card: { available: true, games: 12, wins: 7 },
    board: { available: true, campaigns: 2, crewCount: 5, bounty: 1500, latestCoins: 300, completed: 1 },
    chess: { available: true, games: 4, wins: 2, draws: 1, losses: 1 }
  },
  collection: {
    card: { avatars: [8, 31], walls: [1], flags: [1], titles: 1, titleNames: ['航海新星'], bountyPosters: 2, deluxeUnlocked: false },
    board: { artworks: 1, artworkTotal: 126, artworkIds: ['sea:first-island:1'], artworkEntries: [{ id: 'sea:first-island:1', title: '初次登島', group: '海格事件', variant: 1, variantLabel: '插畫 1/3' }] },
    chess: { items: 0 }
  }
};
const friendProfile = {
  userId: 44, name: '好友航海士', title: '海上探險家', avatar: 51, isSelf: false,
  games: { card: { available: true, games: 3, wins: 2 }, board: { available: false }, chess: { available: false } },
  collection: { card: { avatars: [51], walls: [], flags: [], titles: 0, bountyPosters: 0 }, board: { artworks: 0, artworkTotal: 20, artworkIds: [] }, chess: {} }
};
const initialShop = {
  catalog: [
    { id: 'ava-31', type: 'avatar', key: 31, name: '路奇', rarity: 'common', price: 5 },
    { id: 'ava-49', type: 'avatar', key: 49, name: '尼卡大笑', rarity: 'legend', price: 25 },
    { id: 'wall-4', type: 'wall', key: 4, name: '牆面 #4', rarity: 'rare', price: 10 }
  ],
  wallet: { coins: 12 }, owned: { avatars: [], walls: [], flags: [] },
  equipped: { avatar: 8, wall: 1, flag: 1 }
};
const launcherSource = read('launcher.js');
const switchStart = launcherSource.indexOf('function switchPanel(panelName) {');
const switchEnd = launcherSource.indexOf('window.launcherSwitchPanel = switchPanel;', switchStart);
const navStart = launcherSource.indexOf("document.querySelectorAll('.nav-button[data-panel]').forEach((button) => button.addEventListener('click', () => {");
const navEnd = launcherSource.indexOf("$('#storageButton').addEventListener", navStart);
const accountStart = launcherSource.indexOf('function renderAccount() {');
const accountEnd = launcherSource.indexOf('function renderDownloads() {', accountStart);
assert(switchStart >= 0 && switchEnd > switchStart && navStart >= 0 && navEnd > navStart && accountStart >= 0 && accountEnd > accountStart,
  'Launcher panel/navigation/account code could not be extracted');
const panelCode = launcherSource.slice(switchStart, switchEnd + 'window.launcherSwitchPanel = switchPanel;'.length) + '\n' +
  launcherSource.slice(navStart, navEnd);
const accountCode = launcherSource.slice(accountStart, accountEnd);

async function main() {
  check('catalog includes twelve new canonical-character avatar slots', addedAvatars.length === 12 &&
    addedAvatars.every((item, index) => Number(item.key) === index + 51 && item.asset === `opui://launcher/images/board/avatars/${index + 51}.webp`));
  check('all twelve new avatar files exist', addedAvatars.every(item => {
    const file = path.join(root, 'public/images/board/avatars', `${item.key}.webp`);
    return fs.existsSync(file) && fs.statSync(file).size > 1000;
  }));
  check('catalog includes twenty existing OP music tracks', opTracks.length === 20 &&
    opTracks.every((item, index) => item.id === `bgm-op-${String(index + 1).padStart(2, '0')}` &&
      item.asset === `opui://launcher/audio/bgm/track${String(index + 1).padStart(2, '0')}.mp3`));
  check('all twenty OP music files exist', opTracks.every((item, index) => {
    const file = path.join(root, 'public/audio/bgm', `track${String(index + 1).padStart(2, '0')}.mp3`);
    return fs.existsSync(file) && fs.statSync(file).size > 1000;
  }));
  // Use installed Chrome when Playwright's optional browser build is absent.
  const chrome = process.env.LAUNCHER_PROFILE_QA_CHROME ||
    (fs.existsSync(chromium.executablePath()) ? chromium.executablePath() : 'C:/Program Files/Google/Chrome/Application/chrome.exe');
  const browser = await chromium.launch({ headless: true, executablePath: chrome });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', error => report.errors.push(error.stack || error.message));
    const isAudio = url => /\.(?:ogg|mp3)$/i.test(url);
    page.on('requestfailed', request => {
      if (!isAudio(request.url())) return;
      const entry = { url: request.url(), failure: request.failure() };
      (entry.failure?.errorText === 'net::ERR_ABORTED' ? report.audioAborts : report.audioFailures).push(entry);
    });
    page.on('response', async response => { if (isAudio(response.url())) report.audioResponses.push({ url: response.url(), status: response.status(), headers: await response.allHeaders() }); });
    const blankPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLZnwAAAABJRU5ErkJggg==', 'base64');
    await page.route('opui://**', route => {
      const relative = decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//, '');
      const target = path.resolve(root, 'public', relative);
      if (target.startsWith(path.join(root, 'public') + path.sep) && fs.existsSync(target)) {
        const audioType = path.extname(target) === '.ogg' ? 'audio/ogg' : path.extname(target) === '.mp3' ? 'audio/mpeg' : '';
        if (audioType) {
          const size = fs.statSync(target).size;
          report.audioRequests.push({ relative, range: route.request().headers().range || '' });
          const range = /^bytes=(\d+)-(\d*)$/.exec(route.request().headers().range || '');
          if (range) {
            const start = Number(range[1]);
            const end = range[2] ? Math.min(size - 1, Number(range[2])) : size - 1;
            if (start <= end && end < size) return route.fulfill({
              status: 206, contentType: audioType,
              headers: { 'Accept-Ranges': 'bytes', 'Content-Range': `bytes ${start}-${end}/${size}` },
              body: fs.readFileSync(target).subarray(start, end + 1)
            });
          }
          return route.fulfill({ status: 200, path: target, contentType: audioType, headers: { 'Accept-Ranges': 'bytes' } });
        }
        return route.fulfill({ status: 200, path: target });
      }
      report.missingAssets.push(relative);
      return route.fulfill({ status: 200, contentType: 'image/png', body: blankPng });
    });
    const html = read('launcher.html')
      .replace(/<meta[^>]+http-equiv="Content-Security-Policy"[^>]*>/i, '')
      .replace(/<link[^>]+rel="stylesheet"[^>]*>/gi, '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace('<body data-stage="boot">', '<body data-stage="app">')
      .replace('<main class="launcher-app screen" id="launcherApp" hidden>', '<main class="launcher-app screen is-active" id="launcherApp">');
    await page.setContent(html, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      const boot = document.getElementById('bootScreen');
      boot.hidden = true;
      boot.classList.remove('is-active');
    });
    await page.addStyleTag({ content: read('launcher.css') + '\n' + read('launcher-social.css') + '\n' + read('launcher-profile-shop.css') });
    await page.evaluate(({ mine, friend, shop }) => {
      const copy = value => structuredClone(value);
      window.__profileShopQa = {
        profiles: { 42: mine, 44: friend }, shop, calls: [], profileError: '', shopError: '', buyError: '', equipError: '',
        social: { userId: 42, ready: true, friends: [{ userId: 44, name: '好友航海士', avatar: 51, online: true, page: 'desktop-launcher' }], requestsIn: [], requestsOut: [], unread: {}, conversations: {} }
      };
      const qa = window.__profileShopQa;
      window.onePieceDesktop = {
        async getLauncherProfile(userId) {
          qa.calls.push(['profile', userId]);
          if (qa.profileError) return { ok: false, error: qa.profileError };
          const profile = qa.profiles[userId || 42];
          return profile ? { ok: true, profile: copy(profile) } : { ok: false, error: 'not friends' };
        },
        async getLauncherShop() {
          qa.calls.push(['shop']);
          return qa.shopError ? { ok: false, error: qa.shopError } : { ok: true, shop: copy(qa.shop) };
        },
        async buyLauncherItem(itemId) {
          qa.calls.push(['buy', itemId]);
          if (qa.buyError) return { ok: false, error: qa.buyError };
          const item = qa.shop.catalog.find(entry => entry.id === itemId);
          if (!item || qa.shop.wallet.coins < item.price) return { ok: false, error: 'insufficient coins' };
          qa.shop.wallet.coins -= item.price;
          const key = item.type === 'avatar' ? 'avatars' : item.type === 'wall' ? 'walls' : 'flags';
          qa.shop.owned[key].push(item.key);
          qa.profiles[42].collection.card[key].push(item.key);
          return { ok: true, shop: copy(qa.shop) };
        },
        async equipLauncherItem(itemId) {
          qa.calls.push(['equip', itemId]);
          if (qa.equipError) return { ok: false, error: qa.equipError };
          const item = qa.shop.catalog.find(entry => entry.id === itemId);
          if (!item) return { ok: false, error: 'invalid item' };
          qa.shop.equipped[item.type] = item.key;
          if (item.type === 'avatar') qa.profiles[42].avatar = item.key;
          return { ok: true, shop: copy(qa.shop) };
        },
        onSocialState() { return () => {}; },
        async getSocialState() { return { ok: true, state: copy(qa.social) }; },
        async socialRequest(action, payload) { qa.calls.push(['social', action, payload]); return { ok: true }; }
      };
    }, { mine: ownProfile, friend: friendProfile, shop: initialShop });
    await page.addScriptTag({ content: read('launcher-profile-shop.js') });
    await page.addScriptTag({ content: read('launcher-social.js') });
    check('all launcher panels exist', await page.evaluate(() =>
      ['libraryPanel', 'downloadsPanel', 'socialPanel', 'profilePanel', 'shopPanel'].every(id => !!document.getElementById(id))));
    const headerAvatars = await page.evaluate(source => {
      const $ = selector => document.querySelector(selector);
      const snapshot = { profile: { name: '測試船長', avatar: 31, launcherAvatar: 51 }, freeBytes: 123, cacheRoot: 'D:/QA' };
      const render = new Function('$', 'snapshot', 'storageSummary', 'cachePath', 'downloadsCachePath', 'formatBytes', 'launchingGameIds',
        source + '; renderAccount();');
      const args = [$, snapshot, $('#storageSummary'), $('#cachePath'), $('#downloadsCachePath'), () => '123 B', new Set()];
      render(...args);
      const equipped = $('#accountAvatar').getAttribute('src');
      snapshot.profile.launcherAvatar = null;
      render(...args);
      return { equipped, legacy: $('#accountAvatar').getAttribute('src') };
    }, accountCode);
    check('account header uses launcher avatar and retains legacy fallback', headerAvatars.equipped.endsWith('/51.webp') &&
      headerAvatars.legacy.endsWith('/31.webp'), headerAvatars);
    await page.evaluate(source => {
      const $ = selector => document.querySelector(selector);
      const libraryPanel = $('#libraryPanel'), downloadsPanel = $('#downloadsPanel');
      const syncFeatureMedia = () => {};
      new Function('$', 'libraryPanel', 'downloadsPanel', 'syncFeatureMedia', source)($, libraryPanel, downloadsPanel, syncFeatureMedia);
    }, panelCode);
    check('startup shows three honest no-data game cards', await page.locator('#profileGameStats .voyage-no-data').count() === 3);

    await page.evaluate(() => {
      const account = { authenticated: true, profile: { userId: 42 } };
      window.LauncherProfileShop.setAccount(account);
      window.LauncherSocial.setAccount(account);
    });
    await page.locator('#profileButton').click();
    if (report.errors.length) throw new Error(report.errors.join('\n'));
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    const own = await page.evaluate(() => ({
      heading: document.getElementById('profilePageTitle').textContent,
      games: [...document.querySelectorAll('#profileGameStats .voyage-game-card')].map(e => e.dataset.game),
      gameText: document.getElementById('profileGameStats').textContent,
      collection: document.getElementById('profileCollectionGrid').textContent,
      backHidden: document.getElementById('profileBackToFriends').hidden,
      avatar: document.getElementById('profileHeroAvatar').getAttribute('src')
    }));
    check('own profile renders card, board, chess metrics from data', own.heading === '個人頁' &&
      own.games.join(',') === 'card,board,chess' && own.gameText.includes('勝率') && own.gameText.includes('航海存檔') && own.gameText.includes('和棋'), own);
    check('own collection and avatar render', own.collection.includes('頭像 #31') && own.backHidden && own.avatar.endsWith('/8.webp'));
    check('profile navigation is active', await page.locator('#profileButton').evaluate(node => node.classList.contains('is-active')));
    await page.getByRole('tab', { name: '航海圖鑑' }).click();
    const boardArtText = await page.locator('#profileCollectionGrid').textContent();
    check('board collection tab renders saved artwork title', boardArtText.includes('初次登島') && boardArtText.includes('海格事件 · 插畫 1/3'));

    await page.locator('#socialButton').click();
    await page.waitForSelector('.social-person[data-user-id="44"]');
    check('friend list renders new avatar 51', await page.locator('.social-person[data-user-id="44"] img').evaluate(img => img.getAttribute('src')?.endsWith('/51.webp') && img.complete && img.naturalWidth > 0));
    await page.locator('.social-person[data-user-id="44"]').click();
    await page.locator('#socialVisitProfile').click();
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '好友航海士');
    const friend = await page.evaluate(() => ({
      heading: document.getElementById('profilePageTitle').textContent,
      backVisible: !document.getElementById('profileBackToFriends').hidden,
      shopShortcutVisible: getComputedStyle(document.getElementById('profileShopShortcut')).display !== 'none',
      board: document.querySelector('[data-game="board"]').textContent,
      call: window.__profileShopQa.calls.at(-1)
    }));
    check('social friend visit fetches friend id and hides own shop shortcut', friend.heading === '好友個人頁' &&
      friend.backVisible && !friend.shopShortcutVisible && friend.call[0] === 'profile' && friend.call[1] === 44, friend);
    check('friend profile renders avatar 51', await page.locator('#profileHeroAvatar').evaluate(img => img.getAttribute('src')?.endsWith('/51.webp') && img.complete && img.naturalWidth > 0));
    check('friend missing board data uses truthful empty state', friend.board.includes('尚無可讀取的雲端航海存檔'));
    await page.locator('#profileBackToFriends').click();
    check('friend back button returns to social panel', await page.locator('#socialPanel').evaluate(node => !node.hidden) &&
      await page.locator('#socialButton').evaluate(node => node.classList.contains('is-active')));

    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    await page.locator('#profileShopShortcut').click();
    await page.waitForFunction(() => document.getElementById('shopWallet').textContent === '12');
    check('profile shop shortcut selects shop navigation', await page.locator('#shopButton').evaluate(node => node.classList.contains('is-active')));
    check('shop displays real balance and disables unaffordable item', await page.locator('#shopGrid .shop-item').count() === 2 &&
      await page.locator('#shopGrid .shop-item').nth(1).locator('button').isDisabled() &&
      (await page.locator('#shopGrid .shop-item').nth(1).locator('button').textContent()) === '金幣不足');
    await page.locator('#shopGrid .shop-item').first().locator('button').click();
    check('purchase requires confirmation with exact price', await page.locator('#shopConfirmDialog').evaluate(node => node.open) &&
      (await page.locator('#shopConfirmPrice').textContent()) === '5 金幣');
    await page.locator('#shopConfirmBuy').click();
    await page.waitForFunction(() => document.getElementById('shopWallet').textContent === '7');
    check('purchase updates wallet, ownership, and cloud call', await page.locator('#shopGrid .shop-item').first().locator('button').textContent() === '套用' &&
      await page.evaluate(() => window.__profileShopQa.calls.some(call => call[0] === 'buy' && call[1] === 'ava-31')));
    await page.locator('#shopGrid .shop-item').first().locator('button').click();
    await page.waitForFunction(() => document.querySelector('#shopGrid .shop-item button').textContent === '使用中');
    check('equip updates avatar and refreshes profile', await page.evaluate(() => window.__profileShopQa.calls.some(call => call[0] === 'equip' && call[1] === 'ava-31')));
    await page.evaluate(() => window.LauncherProfileShop.openProfile());
    await page.waitForFunction(() => document.getElementById('profileHeroAvatar').getAttribute('src')?.endsWith('/31.webp'));
    check('equipped avatar appears on own profile', await page.locator('#profileHeroAvatar').getAttribute('src').then(src => src.endsWith('/31.webp')));

    await page.evaluate(() => window.launcherSwitchPanel('shop'));
    await page.getByRole('tab', { name: '旗幟' }).last().click();
    check('empty shop category has a visible message', (await page.locator('#shopGrid').textContent()).includes('此分類目前沒有商品'));
    await page.evaluate(() => { window.__profileShopQa.shopError = 'offline'; window.LauncherProfileShop.onVisible('shop'); });
    await page.waitForFunction(() => document.getElementById('shopStatus').textContent.includes('目前無法連線'));
    check('shop error clears stale balance and items', await page.locator('#shopWallet').textContent() === '—' &&
      await page.locator('#shopGrid .shop-item').count() === 0);
    await page.evaluate(() => { window.__profileShopQa.profileError = 'not friends'; window.LauncherProfileShop.openProfile(99); });
    await page.waitForFunction(() => document.getElementById('profileStatus').textContent.includes('無法參觀'));
    check('nonfriend profile denial shows error without stale friend data', await page.locator('#profileHeroName').textContent() === '航海者' &&
      await page.locator('#profileStatus').evaluate(node => node.classList.contains('is-error')));

    await page.evaluate(() => { window.__profileShopQa.profileError = ''; window.__profileShopQa.shopError = ''; window.LauncherProfileShop.openProfile(); });
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    for (const width of [1440, 1024, 760, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page.locator('#profilePanel .voyage-scroll').evaluate(node => { node.scrollTop = 0; });
      const layout = await page.evaluate(() => {
        const panel = document.getElementById('profilePanel');
        const box = panel.getBoundingClientRect();
        return { viewport: innerWidth, body: document.documentElement.scrollWidth, panelLeft: box.left, panelRight: box.right, panelScrollWidth: panel.scrollWidth, panelClientWidth: panel.clientWidth };
      });
      check(`profile fits ${width}px viewport`, layout.body <= width + 1 && layout.panelLeft >= -1 && layout.panelRight <= width + 1 && layout.panelScrollWidth <= layout.panelClientWidth + 1, layout);
      const hero = await page.evaluate(() => {
        const copy = document.querySelector('.captain-hero-copy');
        return { copyWidth: copy.getBoundingClientRect().width, name: document.getElementById('profileHeroName').textContent };
      });
      check(`profile hero text is readable at ${width}px`, hero.copyWidth >= 100, hero);
      const file = path.join(out, `profile-${width}.png`);
      await page.waitForTimeout(250);
      await page.screenshot({ path: file }); report.screenshots.push(file); save();
      await page.locator('#shopButton').click();
      await page.waitForFunction(() => document.getElementById('shopWallet').textContent === '7');
      await page.getByRole('tab', { name: '頭像' }).last().click();
      check(`shop navigation and avatar products reachable at ${width}px`,
        await page.locator('#shopButton').evaluate(node => node.classList.contains('is-active')) &&
        await page.locator('#shopGrid .shop-item').count() === 2);
      if (width === 390) {
        const nav = await page.evaluate(() => {
          const bar = document.querySelector('.topnav');
          const button = document.getElementById('shopButton');
          const a = bar.getBoundingClientRect(), b = button.getBoundingClientRect();
          return { scrollWidth: bar.scrollWidth, clientWidth: bar.clientWidth, scrollLeft: bar.scrollLeft, shopVisible: b.left >= a.left - 1 && b.right <= a.right + 1 };
        });
        check('390px navigation keeps shop visible', nav.shopVisible, nav);
      }
      const shopLayout = await page.evaluate(() => {
        const panel = document.getElementById('shopPanel');
        const box = panel.getBoundingClientRect();
        return { viewport: innerWidth, body: document.documentElement.scrollWidth, panelLeft: box.left, panelRight: box.right, panelScrollWidth: panel.scrollWidth, panelClientWidth: panel.clientWidth };
      });
      check(`shop fits ${width}px viewport`, shopLayout.body <= width + 1 && shopLayout.panelLeft >= -1 && shopLayout.panelRight <= width + 1 && shopLayout.panelScrollWidth <= shopLayout.panelClientWidth + 1, shopLayout);
      await page.locator('#shopPanel .voyage-scroll').evaluate(node => { node.scrollTop = 0; });
      const shopFile = path.join(out, `shop-${width}.png`);
      await page.waitForTimeout(250);
      await page.screenshot({ path: shopFile }); report.screenshots.push(shopFile); save();
      if (width === 390) {
        await page.locator('#shopGrid').scrollIntoViewIfNeeded();
        const productsFile = path.join(out, 'shop-390-products.png');
        await page.screenshot({ path: productsFile }); report.screenshots.push(productsFile); save();
      }
      await page.evaluate(() => window.launcherSwitchPanel('profile'));
    }
    await page.evaluate(() => {
      const qa = window.__profileShopQa;
      const copy = value => structuredClone(value);
      const placement = { header: { x: 50, y: 12, scale: 1 }, side: { x: 12, y: 54, scale: 1 }, footer: { x: 50, y: 86, scale: 1 } };
      const emptyDecor = () => ({ header: null, side: null, footer: null });
      for (const profile of Object.values(qa.profiles)) {
        profile.appearance = { wallId: 1, flagId: 1, layoutId: 'layout-default', backgroundId: 'background-default', frameId: 'frame-none', decorations: emptyDecor(), decorationPlacement: copy(placement), bgmId: 'bgm-none' };
        profile.appearanceItems = { layout: null, background: null, frame: null, bgm: null, decorations: emptyDecor() };
        profile.guestbookUnlocked = profile.userId === 44;
        profile.guestbook = { enabled: profile.guestbookUnlocked, commentCount: 0 };
        profile.collection.launcher = { ownedItems: 0, itemIds: [] };
      }
      qa.comments = { 42: [], 44: [] }; qa.nextCommentId = 1; qa.playCalls = 0;
      qa.shop.wallet.coins = 100;
      Object.assign(qa.shop.owned, { layouts: [], backgrounds: [], frames: [], decorations: [], bgms: [], guestbook: false });
      Object.assign(qa.shop.equipped, { layoutId: 'layout-default', backgroundId: 'background-default', frameId: 'frame-none', bgmId: 'bgm-none', decorations: emptyDecor(), decorationPlacement: copy(placement) });
      qa.shop.catalog.push(
        { id: 'layout-grand-line', type: 'layout', key: 'grand-line', name: '偉大航路版型', rarity: 'rare', price: 9 },
        { id: 'background-luffy', type: 'background', key: 'luffy', asset: 'opui://launcher/images/profile_decor/bg-luffy.webp', name: '魯夫啟航', rarity: 'rare', price: 8 },
        { id: 'frame-luffy', type: 'frame', key: 'luffy', asset: 'opui://launcher/images/profile_decor/frame-luffy.webp', name: '魯夫相框', rarity: 'epic', price: 10 },
        { id: 'decor-header-luffy', type: 'decoration', key: 'header-luffy', slot: 'header', asset: 'opui://launcher/images/profile_decor/sticker-luffy.webp', name: '魯夫貼紙', rarity: 'rare', price: 8 },
        { id: 'bgm-harbor', type: 'bgm', key: 'harbor', asset: 'opui://launcher/audio/profile_bgm/harbor.ogg', name: '港口晨光', rarity: 'rare', price: 12 },
        { id: 'guestbook-1', type: 'guestbook', key: 1, name: '好友留言板', rarity: 'common', price: 6 }
      );
      window.onePieceDesktop.getLauncherShop = async options => {
        qa.calls.push(['shop', options]);
        if (options?.preview) return { ok: true, shop: { catalog: copy(qa.shop.catalog), wallet: null, owned: {}, equipped: {}, preview: true } };
        return { ok: true, shop: copy(qa.shop) };
      };
      window.onePieceDesktop.buyLauncherItem = async itemId => {
        qa.calls.push(['buy', itemId]);
        const item = qa.shop.catalog.find(entry => entry.id === itemId);
        if (!item || qa.shop.wallet.coins < item.price) return { ok: false, error: 'insufficient coins' };
        qa.shop.wallet.coins -= item.price;
        if (item.type === 'guestbook') { qa.shop.owned.guestbook = true; qa.profiles[42].guestbookUnlocked = true; qa.profiles[42].guestbook.enabled = true; }
        else if (['avatar', 'wall', 'flag'].includes(item.type)) {
          const field = { avatar: 'avatars', wall: 'walls', flag: 'flags' }[item.type];
          qa.shop.owned[field].push(item.key);
          qa.profiles[42].collection.card[field].push(item.key);
        } else {
          qa.shop.owned[{ layout: 'layouts', background: 'backgrounds', frame: 'frames', decoration: 'decorations', bgm: 'bgms' }[item.type]].push(item.id);
          qa.profiles[42].collection.launcher.itemIds.push(item.id);
          qa.profiles[42].collection.launcher.ownedItems++;
        }
        return { ok: true, shop: copy(qa.shop) };
      };
      window.onePieceDesktop.equipLauncherItem = async itemId => {
        qa.calls.push(['equip', itemId]);
        const profile = qa.profiles[42];
        if (itemId === 'layout-default') { qa.shop.equipped.layoutId = itemId; profile.appearance.layoutId = itemId; profile.appearanceItems.layout = null; }
        else if (itemId === 'background-default') { qa.shop.equipped.backgroundId = itemId; profile.appearance.backgroundId = itemId; profile.appearanceItems.background = null; }
        else if (itemId === 'frame-none') { qa.shop.equipped.frameId = itemId; profile.appearance.frameId = itemId; profile.appearanceItems.frame = null; }
        else if (itemId === 'bgm-none') { qa.shop.equipped.bgmId = itemId; profile.appearance.bgmId = itemId; profile.appearanceItems.bgm = null; }
        else if (itemId.startsWith('decor-none-')) { const slot = itemId.slice('decor-none-'.length); qa.shop.equipped.decorations[slot] = null; profile.appearance.decorations[slot] = null; profile.appearanceItems.decorations[slot] = null; }
        else {
          const item = qa.shop.catalog.find(entry => entry.id === itemId);
          if (!item) return { ok: false, error: 'invalid item' };
          if (['avatar', 'wall', 'flag'].includes(item.type)) {
            const field = { avatar: 'avatars', wall: 'walls', flag: 'flags' }[item.type];
            if (!qa.shop.owned[field]?.includes(item.key)) return { ok: false, error: 'not_owned' };
            qa.shop.equipped[item.type] = item.key;
            if (item.type === 'avatar') profile.avatar = item.key;
            return { ok: true, shop: copy(qa.shop) };
          }
          if (!qa.shop.owned[{ layout: 'layouts', background: 'backgrounds', frame: 'frames', decoration: 'decorations', bgm: 'bgms' }[item.type]]?.includes(item.id)) return { ok: false, error: 'not_owned' };
          if (item.type === 'layout') { qa.shop.equipped.layoutId = item.id; profile.appearance.layoutId = item.id; profile.appearanceItems.layout = copy(item); }
          if (item.type === 'background') { qa.shop.equipped.backgroundId = item.id; profile.appearance.backgroundId = item.id; profile.appearanceItems.background = copy(item); }
          if (item.type === 'frame') { qa.shop.equipped.frameId = item.id; profile.appearance.frameId = item.id; profile.appearanceItems.frame = copy(item); }
          if (item.type === 'bgm') { qa.shop.equipped.bgmId = item.id; profile.appearance.bgmId = item.id; profile.appearanceItems.bgm = copy(item); }
          if (item.type === 'decoration') { qa.shop.equipped.decorations[item.slot] = item.id; profile.appearance.decorations[item.slot] = item.id; profile.appearanceItems.decorations[item.slot] = copy(item); }
        }
        return { ok: true, shop: copy(qa.shop) };
      };
      window.onePieceDesktop.saveLauncherDecorationPlacement = async (slot, value) => {
        qa.calls.push(['placement', slot, value]);
        qa.profiles[42].appearance.decorationPlacement[slot] = copy(value);
        qa.shop.equipped.decorationPlacement[slot] = copy(value);
        return { ok: true, profile: copy(qa.profiles[42]), shop: copy(qa.shop) };
      };
      window.onePieceDesktop.getLauncherComments = async (userId, beforeId = 0) => {
        qa.calls.push(['comments', userId, beforeId]);
        const owner = userId || 42;
        if (!qa.profiles[owner]?.guestbookUnlocked) return { ok: false, error: 'guestbook_locked' };
        return { ok: true, enabled: true, comments: copy(qa.comments[owner] || []), hasMore: false, nextBeforeId: 0 };
      };
      window.onePieceDesktop.postLauncherComment = async (userId, body) => {
        qa.calls.push(['post', userId, body]);
        const owner = userId || 42;
        if (!qa.profiles[owner]?.guestbookUnlocked) return { ok: false, error: 'guestbook_locked' };
        const comment = { id: qa.nextCommentId++, authorUserId: 42, authorName: '測試船長', authorAvatar: 31, body, createdAt: new Date().toISOString() };
        qa.comments[owner].unshift(comment); qa.profiles[owner].guestbook.commentCount = qa.comments[owner].length;
        return { ok: true, comment: copy(comment) };
      };
      window.onePieceDesktop.deleteLauncherComment = async id => {
        qa.calls.push(['delete', id]);
        for (const owner of [42, 44]) { qa.comments[owner] = qa.comments[owner].filter(item => item.id !== id); qa.profiles[owner].guestbook.commentCount = qa.comments[owner].length; }
        return { ok: true, messageId: id };
      };
      qa.nativeMedia = { play: HTMLMediaElement.prototype.play, pause: HTMLMediaElement.prototype.pause, paused: Object.getOwnPropertyDescriptor(HTMLMediaElement.prototype, 'paused') };
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', { configurable: true, get() { return !this.__qaPlaying; } });
      HTMLMediaElement.prototype.play = function() { this.__qaPlaying = true; qa.playCalls++; return Promise.resolve(); };
      HTMLMediaElement.prototype.pause = function() { this.__qaPlaying = false; };
    });
    await page.evaluate(() => window.LauncherProfileShop.openProfile());
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    check('locked guestbook shows store call to action and hides composer', await page.locator('#profileGuestbookLocked').isVisible() &&
      await page.locator('#profileGuestbookForm').isHidden() && await page.locator('#profileGuestbookShop').isVisible());
    await page.locator('#profileGuestbookShop').click();
    await page.waitForFunction(() => document.getElementById('shopWallet').textContent === '100');
    check('guestbook catalog is purchasable before unlock', await page.locator('#shopGrid .shop-item').count() === 1 &&
      (await page.locator('#shopGrid .shop-item button').textContent()) === '購買');
    await page.locator('#shopGrid .shop-item button').click(); await page.locator('#shopConfirmBuy').click();
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => !document.getElementById('profileGuestbookForm').hidden);
    check('guestbook purchase unlocks own composer', await page.locator('#profileGuestbookLocked').isHidden() &&
      await page.evaluate(() => window.__profileShopQa.calls.some(call => call[0] === 'buy' && call[1] === 'guestbook-1')));
    await page.locator('#profileGuestbookInput').fill('祝你下一趟航程順風！');
    await page.locator('#profileGuestbookPost').click();
    await page.waitForFunction(() => document.getElementById('profileGuestbookList').textContent.includes('祝你下一趟航程順風'));
    check('guestbook post renders text and author', (await page.locator('#profileGuestbookList').textContent()).includes('測試船長'));
    await page.locator('#profileGuestbookList button').click();
    await page.locator('#profileCommentDeleteConfirm').click();
    await page.waitForFunction(() => document.getElementById('profileGuestbookList').textContent.includes('還沒有留言'));
    check('owner can delete a comment', await page.evaluate(() => window.__profileShopQa.calls.some(call => call[0] === 'delete')));

    for (const [tab, id] of [['排版', 'layout-grand-line'], ['背景', 'background-luffy'], ['相框', 'frame-luffy'], ['貼紙', 'decor-header-luffy'], ['音樂', 'bgm-harbor']]) {
      await page.locator('#shopButton').click();
      await page.getByRole('tab', { name: tab }).last().click();
      const item = page.locator('#shopGrid .shop-item').first();
      check(`${tab} requires purchase before equip`, (await item.locator('button').textContent()) === '購買');
      await item.locator('button').click(); await page.locator('#shopConfirmBuy').click();
      await page.waitForFunction(() => document.querySelector('#shopGrid .shop-item button')?.textContent === '套用');
      await item.locator('button').click();
      await page.waitForFunction(() => document.querySelector('#shopGrid .shop-item button')?.textContent === '使用中');
      check(`${tab} purchase and equip call`, await page.evaluate(itemId => {
        const calls = window.__profileShopQa.calls;
        return calls.some(call => call[0] === 'buy' && call[1] === itemId) && calls.some(call => call[0] === 'equip' && call[1] === itemId);
      }, id));
    }
    await page.getByRole('tab', { name: '背景' }).last().click();
    check('shop shows purchased GPT character background', await page.locator('#shopGrid .shop-item img').first().evaluate(node => node.complete && node.naturalWidth > 0));
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page.locator('#shopPanel .voyage-scroll').evaluate(node => { node.scrollTop = 0; });
      await page.locator('#shopGrid').evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
      const productFile = path.join(out, `shop-background-${width}.png`);
      await page.screenshot({ path: productFile }); report.screenshots.push(productFile); save();
    }
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileCabinStage').dataset.layout === 'layout-grand-line');
    check('owned layout, character background, frame and fixed sticker render on profile', await page.locator('#profileCabinStickers [data-slot="header"]').count() === 1 &&
      await page.locator('#profileBgmToggle').isEnabled() &&
      await page.locator('#profileCabinBackground').evaluate(node => !node.hidden && node.complete && node.naturalWidth > 0) &&
      await page.locator('#profileCabinFrame').evaluate(node => !node.hidden && getComputedStyle(node).borderImageSource.includes('frame-luffy.webp')));
    check('selected BGM never auto plays on profile open', await page.evaluate(() => window.__profileShopQa.playCalls === 0));
    await page.locator('#profileDecorEdit').click();
    const headerSlot = page.locator('.captain-decor-slot[data-slot="header"]');
    for (const [field, value] of [['x', '72'], ['y', '28'], ['scale', '1.25']]) await headerSlot.locator(`input[data-field="${field}"]`).evaluate((input, next) => { input.value = next; input.dispatchEvent(new Event('input', { bubbles: true })); }, value);
    await headerSlot.locator('button').click();
    await page.waitForFunction(() => document.querySelector('#profileCabinStickers [data-slot="header"]')?.style.left === '72%');
    check('sticker placement saves bounded position and scale', await page.evaluate(() => {
      const sticker = document.querySelector('#profileCabinStickers [data-slot="header"]');
      return sticker.style.top === '28%' && sticker.style.getPropertyValue('--scale') === '1.25' &&
        window.__profileShopQa.calls.some(call => call[0] === 'placement' && call[1] === 'header' && call[2].x === 72);
    }));
    await page.locator('#profileBgmToggle').click();
    check('BGM plays only after explicit user click', await page.evaluate(() => window.__profileShopQa.playCalls === 1) &&
      (await page.locator('#profileBgmToggle').textContent()) === '停止音樂');
    await page.locator('#profileBgmToggle').click();
    check('BGM stop control works', (await page.locator('#profileBgmToggle').textContent()) === '播放音樂');
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 850 });
      await page.locator('#profilePanel .voyage-scroll').evaluate(node => { node.scrollTop = 0; });
      check(`character background stays visible at ${width}px`, await page.locator('#profileCabinBackground').evaluate(node => {
        const img = node.getBoundingClientRect(), stage = document.getElementById('profileCabinStage').getBoundingClientRect();
        return img.width > 0 && img.height >= 295 && stage.width <= innerWidth && stage.height >= 295;
      }));
      const custom = path.join(out, `profile-custom-${width}.png`);
      await page.screenshot({ path: custom }); report.screenshots.push(custom); save();
      await page.locator('#profileCabinStage').evaluate(node => node.scrollIntoView({ block: 'center', inline: 'nearest' }));
      await page.waitForTimeout(180);
      const stageFile = path.join(out, `profile-custom-stage-${width}.png`);
      await page.screenshot({ path: stageFile }); report.screenshots.push(stageFile); save();
    }
    await page.evaluate(() => {
      const qa = window.__profileShopQa;
      const track = qa.shop.catalog.find(item => item.id === 'bgm-harbor');
      qa.profiles[44].appearance.bgmId = track.id;
      qa.profiles[44].appearanceItems.bgm = structuredClone(track);
    });
    await page.setViewportSize({ width: 1440, height: 850 });
    await page.locator('#socialButton').click();
    await page.locator('.social-person[data-user-id="44"]').click();
    await page.locator('#socialVisitProfile').click();
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '好友航海士');
    check('friend BGM remains silent until visitor clicks', await page.evaluate(() => window.__profileShopQa.playCalls === 1) &&
      await page.locator('#profileDecorEdit').isHidden() && await page.locator('#profileGuestbookForm').isVisible());
    await page.locator('#profileBgmToggle').click();
    check('friend BGM starts on explicit visitor action', await page.evaluate(() => window.__profileShopQa.playCalls === 2));
    await page.locator('#profileGuestbookInput').fill('從你的好友頁留下問候。');
    await page.locator('#profileGuestbookPost').click();
    await page.waitForFunction(() => document.getElementById('profileGuestbookList').textContent.includes('從你的好友頁留下問候'));
    check('friend can post on unlocked guestbook', await page.evaluate(() => window.__profileShopQa.calls.some(call => call[0] === 'post' && call[1] === 44)));
    await page.locator('#socialButton').click();
    check('leaving friend profile stops BGM', (await page.locator('#profileBgmToggle').textContent()) === '播放音樂');
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    await page.evaluate(() => {
      const qa = window.__profileShopQa;
      HTMLMediaElement.prototype.play = function() {
        this.__qaPlaying = true;
        return new Promise(resolve => { qa.resolveDelayedPlay = resolve; });
      };
    });
    await page.locator('#profileBgmToggle').click();
    await page.locator('#socialButton').click();
    await page.evaluate(() => window.__profileShopQa.resolveDelayedPlay());
    await page.waitForTimeout(30);
    check('late BGM play completion stays stopped after leaving profile', await page.locator('#profileBgmAudio').evaluate(node => node.paused && node.currentTime === 0) &&
      (await page.locator('#profileBgmToggle').textContent()) === '播放音樂');
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    await page.evaluate(() => {
      const native = window.__profileShopQa.nativeMedia;
      HTMLMediaElement.prototype.play = native.play;
      HTMLMediaElement.prototype.pause = native.pause;
      Object.defineProperty(HTMLMediaElement.prototype, 'paused', native.paused);
    });
    const realAudio = await page.locator('#profileBgmAudio').evaluate(async node => {
      node.load();
      if (node.readyState < 1) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Ogg metadata timeout')), 6000);
        node.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
        node.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(`Ogg media error ${node.error?.code}`)); }, { once: true });
      });
      return { duration: node.duration, loop: node.loop, paused: node.paused, source: node.getAttribute('src') };
    });
    check('original Ogg BGM decodes, loops, and starts silent', Number.isFinite(realAudio.duration) && realAudio.duration > 1 && realAudio.loop && realAudio.paused && realAudio.source.endsWith('/harbor.ogg'), realAudio);
    const otherTracks = await page.evaluate(async () => Promise.all(['night-watch', 'voyage'].map(async name => {
      const audio = new Audio(`opui://launcher/audio/profile_bgm/${name}.ogg`);
      audio.preload = 'metadata'; audio.load();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`${name} metadata timeout`)), 6000);
        audio.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
        audio.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(`${name} media error ${audio.error?.code}`)); }, { once: true });
      });
      return { name, duration: audio.duration };
    })));
    check('all three original Ogg tracks decode in Chromium', otherTracks.length === 2 && otherTracks.every(track => Number.isFinite(track.duration) && track.duration > 1), otherTracks);
    await page.evaluate(encoded => {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0));
      const fixtureUrl = URL.createObjectURL(new Blob([bytes], { type: 'audio/ogg' }));
      window.__profileShopQa.audioFixtureUrl = fixtureUrl;
      const audio = document.getElementById('profileBgmAudio');
      audio.src = fixtureUrl; audio.load();
    }, fs.readFileSync(path.join(root, 'public/audio/profile_bgm/harbor.ogg')).toString('base64'));
    await page.locator('#profileBgmToggle').click();
    await page.waitForTimeout(1000);
    const playback = await page.locator('#profileBgmAudio').evaluate(node => ({ paused: node.paused, time: node.currentTime, readyState: node.readyState, error: node.error?.code, button: document.getElementById('profileBgmToggle').textContent, status: document.getElementById('profileStatus').textContent }));
    check('real Ogg bytes play through the page button after an explicit click', !playback.paused && playback.time > 0.1, playback);
    await page.locator('#socialButton').click();
    check('leaving profile stops real Ogg playback', await page.locator('#profileBgmAudio').evaluate(node => node.paused && node.currentTime === 0));
    await page.evaluate(() => URL.revokeObjectURL(window.__profileShopQa.audioFixtureUrl));
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '測試船長');
    await page.locator('#shopButton').click();
    await page.getByRole('tab', { name: '音樂' }).last().click();
    await page.getByRole('button', { name: '停用個人頁音樂' }).click();
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileBgmToggle').disabled);
    check('owned BGM can be disabled without losing purchase', await page.evaluate(() => {
      const qa = window.__profileShopQa;
      return qa.shop.owned.bgms.includes('bgm-harbor') && qa.shop.equipped.bgmId === 'bgm-none' &&
        qa.calls.some(call => call[0] === 'equip' && call[1] === 'bgm-none');
    }));
    await page.evaluate(({ avatars, music }) => {
      const qa = window.__profileShopQa;
      qa.shop.catalog.push(...avatars, ...music);
      qa.shop.wallet.coins = 500;
    }, { avatars: addedAvatars, music: opTracks });
    await page.locator('#shopButton').click();
    await page.getByRole('tab', { name: '頭像' }).last().click();
    await page.waitForFunction(() => document.querySelectorAll('#shopGrid .shop-item[data-type="avatar"]').length === 14);
    check('all twelve new avatars appear in the shop', await page.locator('#shopGrid .shop-item[data-item-id^="ava-"]').count() === 14);
    await page.waitForFunction(() => [...document.querySelectorAll('#shopGrid .shop-item[data-type="avatar"] img')].every(img => img.complete && img.naturalWidth > 0));
    check('new avatar shop images decode', await page.locator('#shopGrid .shop-item[data-item-id^="ava-"] img').count() === 14);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator('#shopGrid').scrollIntoViewIfNeeded();
    const avatarShopFile = path.join(out, 'shop-new-avatars-1440.png');
    await page.screenshot({ path: avatarShopFile }); report.screenshots.push(avatarShopFile); save();
    const newAvatar = page.locator(`#shopGrid .shop-item[data-item-id="${addedAvatars[0].id}"]`);
    await newAvatar.locator('button').click();
    check('new avatar shows exact coin price before purchase', await page.locator('#shopConfirmPrice').textContent() === `${addedAvatars[0].price} 金幣`);
    await page.locator('#shopConfirmBuy').click();
    await page.waitForFunction(id => document.querySelector(`#shopGrid .shop-item[data-item-id="${id}"] button`)?.textContent === '套用', addedAvatars[0].id);
    await newAvatar.locator('button').click();
    await page.waitForFunction(id => document.querySelector(`#shopGrid .shop-item[data-item-id="${id}"] button`)?.textContent === '使用中', addedAvatars[0].id);
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileHeroAvatar').getAttribute('src')?.endsWith('/51.webp'));
    await page.locator('#profileCollectionTabs').getByRole('tab', { name: '頭像' }).click();
    check('purchased avatar 51 equips and appears in collection', await page.locator('#profileCollectionGrid').textContent().then(text => text.includes('頭像 #51')) &&
      await page.locator('#profileHeroAvatar').evaluate(img => img.complete && img.naturalWidth > 0));
    await page.locator('#shopButton').click();
    await page.getByRole('tab', { name: '音樂' }).last().click();
    await page.waitForFunction(() => document.querySelectorAll('#shopGrid .shop-item[data-type="bgm"]').length === 21);
    check('twenty OP tracks appear alongside existing original BGM', await page.locator('#shopGrid .shop-item[data-item-id^="bgm-op-"]').count() === 20);
    await page.locator('#shopGrid').scrollIntoViewIfNeeded();
    const opShopFile = path.join(out, 'shop-op-tracks-1440.png');
    await page.screenshot({ path: opShopFile }); report.screenshots.push(opShopFile); save();
    await page.setViewportSize({ width: 390, height: 844 });
    const opMobile = await page.evaluate(() => {
      const panel = document.getElementById('shopPanel');
      const bounds = panel.getBoundingClientRect();
      return { pageWidth: document.documentElement.scrollWidth, panelWidth: panel.scrollWidth, visibleWidth: panel.clientWidth,
        left: bounds.left, right: bounds.right };
    });
    check('twenty OP tracks fit the 390px shop viewport', opMobile.pageWidth <= 391 &&
      opMobile.panelWidth <= opMobile.visibleWidth + 1 && opMobile.left >= -1 && opMobile.right <= 391, opMobile);
    const opMobileFile = path.join(out, 'shop-op-tracks-390.png');
    await page.screenshot({ path: opMobileFile }); report.screenshots.push(opMobileFile); save();
    await page.setViewportSize({ width: 1440, height: 900 });
    const opFirst = page.locator(`#shopGrid .shop-item[data-item-id="${opTracks[0].id}"]`);
    await opFirst.locator('button').click();
    check('OP track shows exact coin price before purchase', await page.locator('#shopConfirmPrice').textContent() === `${opTracks[0].price} 金幣`);
    await page.locator('#shopConfirmBuy').click();
    await page.waitForFunction(id => document.querySelector(`#shopGrid .shop-item[data-item-id="${id}"] button`)?.textContent === '套用', opTracks[0].id);
    await opFirst.locator('button').click();
    await page.waitForFunction(id => document.querySelector(`#shopGrid .shop-item[data-item-id="${id}"] button`)?.textContent === '使用中', opTracks[0].id);
    await page.locator('#profileButton').click();
    await page.waitForFunction(() => document.getElementById('profileBgmAudio').getAttribute('src')?.endsWith('/track01.mp3'));
    const opMedia = await page.locator('#profileBgmAudio').evaluate(async audio => {
      audio.load();
      if (audio.readyState < 1) await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('OP MP3 metadata timeout')), 8000);
        audio.addEventListener('loadedmetadata', () => { clearTimeout(timeout); resolve(); }, { once: true });
        audio.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(`OP MP3 media error ${audio.error?.code}`)); }, { once: true });
      });
      return { duration: audio.duration, loop: audio.loop, paused: audio.paused, source: audio.getAttribute('src') };
    });
    check('selected OP MP3 decodes and waits for manual playback', Number.isFinite(opMedia.duration) && opMedia.duration > 1 &&
      opMedia.loop && opMedia.paused && opMedia.source.endsWith('/track01.mp3'), opMedia);
    await page.locator('#profileBgmToggle').click();
    await page.waitForTimeout(750);
    check('selected OP MP3 plays on explicit click', await page.locator('#profileBgmAudio').evaluate(audio => !audio.paused && audio.currentTime > 0.1));
    await page.locator('#profileBgmToggle').click();
    check('OP MP3 stops from profile control', await page.locator('#profileBgmAudio').evaluate(audio => audio.paused && audio.currentTime === 0));
    await page.evaluate(() => window.LauncherProfileShop.setAccount({ previewMode: true }));
    await page.locator('#shopButton').click();
    await page.waitForFunction(() => document.getElementById('shopStatus').textContent.includes('設計預覽可查看商品'));
    await page.getByRole('tab', { name: '排版' }).last().click();
    check('preview mode displays catalog but forbids purchase', await page.locator('#shopGrid .shop-item').count() === 1 &&
      await page.locator('#shopGrid .shop-item button').isDisabled() &&
      (await page.locator('#shopWallet').textContent()) === '—');
    check('visible launcher media has local source assets', report.missingAssets.length === 0, report.missingAssets);
    check('audio requests have no unexpected network failure', report.audioFailures.length === 0, report.audioFailures);
    check('renderer has no uncaught JavaScript errors', report.errors.length === 0, report.errors);
    report.ok = true; save();
    console.log(JSON.stringify({ ok: true, checks: report.checks.length, report: path.join(out, 'report.json') }));
  } finally { await browser.close(); }
}
main().catch(error => {
  report.ok = false; report.failure = error.stack; save();
  console.error(error); process.exitCode = 1;
});
