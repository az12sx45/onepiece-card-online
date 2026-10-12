'use strict';
// Exercise the shipped markup, styles and event handlers. Only the authenticated preload is isolated.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const out = process.env.LAUNCHER_PROFILE_R61_QA_OUT || 'D:/Codex_QA/launcher-profile-r61/editor';
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT = path.join(out, 'fixture');
const { setup, chromium, report: fixture } = require('./launcher_guestbook_danmaku_qa');
const report = { status: 'RUNNING', scope: 'Real renderer and local images; isolated authenticated bridge; no player data writes.', checks: [], screenshots: [], sourceHashes: fixture.sourceHashes };
const launcherSource = fs.readFileSync(path.join(__dirname, '..', 'desktop/launcher.js'), 'utf8');
const accountCloseStart = launcherSource.indexOf('function closeAccountMenu() {');
const accountCloseEnd = launcherSource.indexOf('function closeLauncherOverlays()', accountCloseStart);
const accountClickStart = launcherSource.indexOf("$('#accountButton').addEventListener('click', () => {");
const accountClickEnd = launcherSource.indexOf("$('#settingsButton').addEventListener", accountClickStart);
const avatarEntry = launcherSource.match(/^\$\('#accountAvatarButton'\)\.addEventListener[^\n]+$/m)?.[0];
assert(accountCloseStart >= 0 && accountCloseEnd > accountCloseStart && accountClickStart >= 0 && accountClickEnd > accountClickStart && avatarEntry, 'Actual account menu source locations');
const accountHandlers = launcherSource.slice(accountCloseStart, accountCloseEnd) + launcherSource.slice(accountClickStart, accountClickEnd) + avatarEntry;
fs.mkdirSync(out, { recursive: true });
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); save(); assert.ok(pass, name + ': ' + JSON.stringify(detail)); };
async function prepare(page) {
  await page.evaluate(source => { const $ = selector => document.querySelector(selector); new Function('$', 'accountMenu', source)($, $('#accountMenu')); }, accountHandlers);
  await page.evaluate(() => {
    const qa = window.__guestbookQa; qa.saved = []; qa.saveMode = 'success'; qa.resolvers = [];
    const write = async card => {
      qa.saved.push(structuredClone(card)); const mode = qa.saveMode;
      if (mode === 'defer') await new Promise(resolve => qa.resolvers.push(resolve));
      if (mode === 'offline') throw new Error('offline');
      if (mode === 'deny') return { ok: false, error: 'not_owned' };
      qa.profiles[42].card = structuredClone(card); qa.profiles[42].avatar = card.avatarId; qa.shop.equipped.avatar = card.avatarId;
      return { ok: true, profile: structuredClone(qa.profiles[42]), shop: structuredClone(qa.shop) };
    };
    const previous = window.onePieceDesktop.commandLauncherLife;
    window.onePieceDesktop.commandLauncherLife = c => c.payload.operation === 'card.set' ? write(c.payload.card) : previous(c);
    window.onePieceDesktop.saveLauncherCard = write;
    window.onePieceDesktop.saveLauncherDecorationPlacement = async (slot, placement) => { qa.profiles[42].appearance.decorationPlacement ||= {}; qa.profiles[42].appearance.decorationPlacement[slot] = placement; return { ok: true, profile: structuredClone(qa.profiles[42]), shop: structuredClone(qa.shop) }; };
  });
}
async function visibleAssets(page) {
  await page.locator('img').evaluateAll(async images => Promise.all(images.filter(n => { const r = n.getBoundingClientRect(); return r.width && r.height && r.bottom >= 0 && r.top < innerHeight; }).map(n => n.decode().catch(() => {}))));
}
async function shot(page, name) { await visibleAssets(page); const file = path.join(out, name + '.png'); await page.screenshot({ path: file }); report.screenshots.push(file); save(); }
async function fit(page, ids) { return page.evaluate(ids => ids.map(id => { const n = document.getElementById(id), r = n.getBoundingClientRect(); return { id, x: r.x, y: r.y, width: r.width, height: r.height, fits: r.width > 0 && r.height > 0 && r.x >= 0 && r.right <= innerWidth + 1 && r.y >= 0 && r.bottom <= innerHeight + 1 }; }), ids); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.LAUNCHER_PROFILE_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 640 }, { width: 540, height: 720 }]) {
      const page = await setup(browser, viewport), label = `${viewport.width}x${viewport.height}`; await prepare(page);
      const before = await page.locator('#profileHero').boundingBox();
      await shot(page, label + '-card');
      await page.locator('#profileCardEdit').click();
      check(label + ' actual edit button opens independent modal', await page.locator('#profileCardDialog').evaluate(n => n.open));
      check(label + ' editor cannot stretch the display card', await page.locator('#profileHero').evaluate((n, b) => n.getBoundingClientRect().height === b.height, before), before);
      check(label + ' new default art preserves full 3:1 picture', await page.locator('#profileHeroArt').evaluate(n => getComputedStyle(n).backgroundSize === 'contain' && getComputedStyle(n).backgroundImage.includes('captain-card-wide-r61.webp')));
      const positions = await fit(page, ['profileCardDialog', 'profileCardClose', 'profileCardSave', 'profileCardCancel']);
      check(label + ' editor close and fixed save/cancel stay on screen', positions.every(p => p.fits), positions);
      check(label + ' full preview is contained by its panel', await page.locator('#profileCardPreview .captain-card-preview').evaluate(n => { const r = n.getBoundingClientRect(), p = n.parentElement.getBoundingClientRect(); return r.left >= p.left && r.right <= p.right + 1; }));
      await page.locator('#profileCardName').fill('新的航海名片'); await page.locator('#profileCardTagline').fill('下一段冒險，從這裡啟航。');
      check(label + ' preview follows name and declaration without modifying persisted card', await page.locator('#profileCardPreview h3').textContent() === '新的航海名片' && await page.locator('#profileHeroName').textContent() === '測試船長');
      await shot(page, label + '-editor');
      await page.locator('#profileCardAvatarChoose').click();
      check(label + ' visible thumbnail opens the picture collection', await page.locator('#avatarPickerDialog').evaluate(n => n.open) && await page.locator('#avatarPickerGrid button').count() === 190);
      await page.locator('#avatarPickerGrid [data-avatar-id="152"]').click();
      await visibleAssets(page);
      check(label + ' thumbnail click selects actual full local portrait', await page.locator('#avatarPickerImage').evaluate(n => n.src.endsWith('/152.webp') && n.naturalWidth === 735 && getComputedStyle(n).objectFit === 'contain'));
      check(label + ' portrait name and ownership label fit inside every button', await page.locator('#avatarPickerGrid button').evaluateAll(buttons => buttons.every(b => { const r = b.getBoundingClientRect(); return [...b.children].every(n => { const c = n.getBoundingClientRect(); return c.top >= r.top && c.bottom <= r.bottom + 1 && c.left >= r.left && c.right <= r.right + 1; }); })));
      const buttonBox = await page.locator('#avatarPickerApply').boundingBox();
      check(label + ' confirm remains reachable after a scrolled selection', buttonBox.y + buttonBox.height <= viewport.height);
      await shot(page, label + '-picker');
      await page.locator('#avatarPickerApply').click();
      check(label + ' editor selection becomes draft and returns to editor', await page.locator('#avatarPickerDialog').evaluate(n => !n.open) && await page.locator('#profileCardDialog').evaluate(n => n.open) && await page.locator('#profileCardAvatar').inputValue() === '152');
      check(label + ' chosen draft is displayed in both card and button', await page.locator('#profileCardPreview .captain-hero-avatar > img').getAttribute('src').then(s => s.endsWith('/152.webp')) && await page.locator('#profileCardAvatarImage').getAttribute('src').then(s => s.endsWith('/152.webp')));
      check(label + ' selecting in editor sends no premature save', await page.evaluate(() => window.__guestbookQa.saved.length === 0));
      await page.locator('#profileCardCancel').click();
      check(label + ' cancel restores saved card and closes editor', await page.locator('#profileCardDialog').evaluate(n => !n.open) && await page.locator('#profileHeroAvatar').getAttribute('src').then(s => s.endsWith('/222.webp')) && await page.locator('#profileHeroName').textContent() === '測試船長');
      await page.locator('#profileCardEdit').click(); await page.locator('#profileCardName').fill('新的航海名片'); await page.locator('#profileCardTagline').fill('下一段冒險，從這裡啟航。');
      await page.locator('#profileCardAvatarChoose').click(); await page.locator('#avatarPickerSearch').fill('克比'); await page.locator('[data-avatar-id="152"]').click(); await page.locator('#avatarPickerApply').click();
      await page.locator('#profileCardSave').click(); await page.waitForFunction(() => !document.getElementById('profileCardDialog').open);
      check(label + ' final save persists exactly the selected avatar and text once', await page.evaluate(() => { const q = window.__guestbookQa; return q.saved.length === 1 && q.saved[0].avatarId === 152 && q.profiles[42].card.displayName === '新的航海名片' && q.profiles[42].card.tagline === '下一段冒險，從這裡啟航。'; }));
      await page.locator('#profileAvatarEdit').click(); await page.locator('#avatarPickerSearch').fill('斯摩格');
      const target = page.locator('[data-avatar-id="150"]'), box = await target.boundingBox();
      await page.evaluate(() => window.__retainedPortrait = document.querySelector('[data-avatar-id="150"]'));
      await page.mouse.move(box.x + box.width / 2, box.y + 30); await page.mouse.down();
      await page.evaluate(() => { const q = window.__guestbookQa; q.shop.wallet.coins++; window.LauncherProfileShop.onRoomSaved(structuredClone(q.profiles[42]), structuredClone(q.shop)); });
      await page.mouse.up();
      check(label + ' wallet update during press preserves image/button and successful selection', await target.evaluate(n => n === window.__retainedPortrait && n.getAttribute('aria-checked') === 'true'));
      await page.locator('#avatarPickerApply').click(); await page.waitForFunction(() => !document.getElementById('avatarPickerDialog').open);
      check(label + ' direct portrait entry persists immediately', await page.locator('#profileHeroAvatar').getAttribute('src').then(s => s.endsWith('/150.webp')));
      await page.locator('#accountButton').click(); await page.locator('#accountAvatarButton').click();
      check(label + ' actual account-menu button opens the same picture selector', await page.locator('#avatarPickerDialog').evaluate(n => n.open) && await page.locator('#accountMenu').isHidden());
      await page.locator('#avatarPickerSearch').fill(''); await page.locator('#avatarPickerFilters [data-filter="all"]').click();
      await page.locator('[data-avatar-id="31"]').click();
      check(label + ' unowned portrait remains preview only', await page.locator('#avatarPickerApply').isDisabled());
      await page.keyboard.press('Escape');
      await page.evaluate(() => { const q = window.__guestbookQa, p = q.profiles[42]; const bg = q.shop.catalog.find(i => i.id === 'background-luffy'); p.appearance.backgroundId = bg.id; p.appearanceItems.background = bg; p.appearance.decorations = {}; p.appearanceItems.decorations = {}; for (const id of ['decor-header-luffy', 'decor-side-zoro', 'decor-footer-ace']) { const item = q.shop.catalog.find(i => i.id === id); p.appearance.decorations[item.slot] = id; p.appearanceItems.decorations[item.slot] = item; } window.LauncherProfileShop.onRoomSaved(structuredClone(p), structuredClone(q.shop)); });
      const artBefore = await page.locator('#profileHeroArt').boundingBox();
      await page.locator('#profileCardEdit').click();
      check(label + ' existing purchased picture is complete in a dedicated contain region', await page.locator('#profileHeroArt').evaluate(n => getComputedStyle(n).backgroundSize === 'contain' && n.style.backgroundImage.includes('bg-luffy.webp')));
      check(label + ' all three sticker controls do not resize art/card', await page.locator('#profileHeroArt').evaluate((n, b) => n.getBoundingClientRect().height === b.height, artBefore) && await page.locator('.captain-decor-slot').count() === 3);
      check(label + ' every saved sticker is complete within both card canvases', await page.locator('#profileHero .captain-hero-sticker, #profileCardPreview .captain-hero-sticker').evaluateAll(nodes => nodes.every(n => { const r = n.getBoundingClientRect(), p = n.closest('.captain-hero').getBoundingClientRect(); return r.left >= p.left && r.right <= p.right && r.top >= p.top && r.bottom <= p.bottom; })));
      await shot(page, label + '-purchased-art-editor');
      await page.keyboard.press('Escape');
      for (const layout of ['layout-grand-line', 'layout-bounty-board', 'layout-captain-quarters', 'layout-sunny-deck', 'layout-sunny-kitchen', 'layout-sunny-library']) {
        await page.evaluate(layout => { const q = window.__guestbookQa; q.profiles[42].appearance.layoutId = layout; window.LauncherProfileShop.onRoomSaved(structuredClone(q.profiles[42]), structuredClone(q.shop)); }, layout);
        await page.locator('#profileCardEdit').click();
        check(label + ' existing layout ' + layout + ' edit and cancel remain clickable', await page.locator('#profileCardDialog').evaluate(n => n.open));
        await page.locator('#profileCardCancel').click();
      }
      await page.evaluate(() => window.LauncherProfileShop.openProfile(44)); await page.waitForFunction(() => document.getElementById('profileHeroName').textContent === '好友航海士');
      check(label + ' friend card is read only', await page.locator('#profileCardEdit').isHidden() && await page.locator('#profileAvatarEdit').isHidden() && await page.locator('#profileCardDialog').evaluate(n => !n.open));
      await page.locator('#accountButton').click(); await page.locator('#accountAvatarButton').click(); await page.waitForFunction(() => document.getElementById('avatarPickerDialog').open);
      check(label + ' account avatar action leaves friend view and loads own collection', await page.locator('#profileHeroName').textContent() === '新的航海名片');
      await page.locator('#avatarPickerCancel').click(); await page.locator('#profileCardEdit').click(); await page.locator('#profileCardName').fill('未保存');
      await page.evaluate(() => window.__guestbookQa.saveMode = 'offline'); await page.locator('#profileCardSave').click(); await page.waitForFunction(() => document.getElementById('profileCardStatus').classList.contains('is-error'));
      check(label + ' rejected card save keeps draft editable and original untouched', await page.locator('#profileCardName').inputValue() === '未保存' && await page.locator('#profileCardDialog').evaluate(n => n.open) && await page.locator('#profileHeroName').textContent() === '新的航海名片' && await page.locator('#profileCardSave').isEnabled());
      await page.evaluate(() => window.__guestbookQa.saveMode = 'defer'); await page.locator('#profileCardSave').click(); await page.waitForFunction(() => window.__guestbookQa.resolvers.length === 1); await page.keyboard.press('Escape');
      check(label + ' in-flight save cannot be dismissed and double submitted', await page.locator('#profileCardDialog').evaluate(n => n.open) && await page.locator('#profileCardSave').isDisabled());
      await page.evaluate(() => { window.LauncherProfileShop.setAccount({ authenticated: false }); window.__guestbookQa.resolvers[0](); }); await page.waitForTimeout(30);
      check(label + ' logout closes every editor and ignores a late response', await page.locator('#profileCardDialog').evaluate(n => !n.open) && await page.locator('#avatarPickerDialog').evaluate(n => !n.open) && await page.locator('#profileHeroName').textContent() === '航海者');
      await page.close();
    }
    check('no renderer exceptions', fixture.errors.length === 0, fixture.errors);
    check('no missing local pictures', fixture.missingAssets.length === 0, fixture.missingAssets);
    for (const name of ['launcher.js', 'launcher-profile-shop.js', 'launcher-profile-shop.css', 'launcher.html']) report.sourceHashes[name] = crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, '..', 'desktop', name))).digest('hex');
    report.status = 'PASS'; save(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, report: path.join(out, 'report.json') }));
  } catch (error) { report.status = 'FAIL'; report.error = error.stack; save(); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
