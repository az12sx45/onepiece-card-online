'use strict';
// Actual launcher markup/styles/renderer, real local WebP; isolated authenticated bridge only.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const out = process.env.LAUNCHER_AVATAR_PICKER_QA_OUT || 'D:/Codex_QA/launcher-avatar-r60/picker';
process.env.LAUNCHER_GUESTBOOK_UI_QA_OUT = path.join(out, 'fixture');
const { setup, chromium, report: fixture } = require('./launcher_guestbook_danmaku_qa');
const report = { status: 'RUNNING', scope: 'Actual launcher renderer and local images with isolated preload responses; no player account or data writes.', checks: [], screenshots: [], sourceHashes: fixture.sourceHashes };
fs.mkdirSync(out, { recursive: true });
const save = () => fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); save(); assert.ok(pass, name + ': ' + JSON.stringify(detail)); };
async function prepare(page) {
  await page.evaluate(() => {
    const qa = window.__guestbookQa;
    qa.shop.owned.avatars = [148, 152, 222];
    qa.profiles[42].collection.card.avatars = [...Array.from({ length: 30 }, (_, i) => i + 1), 148, 152, 222];
    qa.avatarSaves = []; qa.saveMode = 'success'; qa.avatarResolvers = [];
    const originalCommand = window.onePieceDesktop.commandLauncherLife;
    const saveAvatar = async card => {
      qa.avatarSaves.push(structuredClone(card));
      const mode = qa.saveMode;
      if (mode === 'defer') await new Promise(resolve => qa.avatarResolvers.push(resolve));
      if (mode === 'offline') throw new Error('offline');
      if (mode === 'deny') return { ok: false, error: 'not_owned' };
      qa.profiles[42].card = structuredClone(card); qa.profiles[42].avatar = card.avatarId; qa.shop.equipped.avatar = card.avatarId;
      return { ok: true, profile: structuredClone(qa.profiles[42]), shop: structuredClone(qa.shop) };
    };
    window.onePieceDesktop.saveLauncherCard = saveAvatar;
    window.onePieceDesktop.commandLauncherLife = c => c.payload.operation === 'card.set' ? saveAvatar(c.payload.card) : originalCommand(c);
    window.LauncherProfileShop.setAccount({ authenticated: false });
    window.LauncherProfileShop.setAccount({ authenticated: true, profile: { userId: 42, name: '測試船長' } });
    window.LauncherProfileShop.openProfile(0);
  });
  await page.waitForFunction(() => !document.getElementById('profileAvatarEdit').hidden);
}
async function open(page) { await page.locator('#profileAvatarEdit').click(); await page.waitForFunction(() => document.getElementById('avatarPickerDialog').open); }
async function select(page, id) { await page.locator(`#avatarPickerGrid [data-avatar-id="${id}"]`).click(); }
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.LAUNCHER_PROFILE_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 640 }, { width: 540, height: 720 }]) {
      const page = await setup(browser, viewport), label = `${viewport.width}x${viewport.height}`;
      await prepare(page); await open(page);
      check(label + ' picture grid defaults to 30 free plus 3 collected portraits', await page.locator('#avatarPickerGrid button').count() === 33, await page.locator('#avatarPickerGrid button').count());
      check(label + ' stored avatar marked and apply disabled until changed', await page.locator('[data-avatar-id="222"]').getAttribute('aria-checked') === 'true' && await page.locator('#avatarPickerApply').isDisabled());
      await select(page, 152);
      await page.locator('#avatarPickerImage').evaluate(async n => { await n.decode(); });
      check(label + ' full circular image is local 735px art', await page.locator('#avatarPickerImage').evaluate(n => n.src.endsWith('/152.webp') && n.naturalWidth === 735 && getComputedStyle(n).objectFit === 'contain'));
      check(label + ' unsaved selection does not alter current portrait', await page.locator('#avatarPickerCurrentImage').getAttribute('src') === 'opui://launcher/images/board/avatars/222.webp' && await page.locator('#profileHeroAvatar').getAttribute('src') === 'opui://launcher/images/board/avatars/222.webp');
      const layout = await page.evaluate(() => {
        const ids = ['avatarPickerDialog', 'avatarPickerApply', 'avatarPickerCancel', 'avatarPickerClose', 'avatarPickerImage'];
        return ids.map(id => { const n = document.getElementById(id), b = n.getBoundingClientRect(); return { id, left: b.left, top: b.top, right: b.right, bottom: b.bottom, width: b.width, height: b.height, visible: b.width > 0 && b.height > 0 && b.left >= 0 && b.right <= innerWidth + 1 && b.top >= 0 && b.bottom <= innerHeight + 1 }; });
      });
      check(label + ' dialog preview and fixed actions fit viewport', layout.every(x => x.visible), layout);
      check(label + ' grid never draws into fixed action area', await page.locator('#avatarPickerGrid').evaluate(n => n.getBoundingClientRect().bottom <= document.querySelector('.captain-avatar-footer').getBoundingClientRect().top + 1));
      const shot = path.join(out, `${label}-avatar-picker.png`); await page.screenshot({ path: shot }); report.screenshots.push(shot); save();
      await page.locator('#avatarPickerGrid').evaluate(n => n.scrollTop = n.scrollHeight);
      check(label + ' scrolling portraits leaves apply button visible and clickable', await page.locator('#avatarPickerApply').evaluate(n => { const b = n.getBoundingClientRect(); return document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === n; }));
      await page.locator('#avatarPickerCancel').click();
      check(label + ' cancelling keeps persisted avatar and sends no command', await page.evaluate(() => window.__guestbookQa.avatarSaves.length === 0 && document.getElementById('profileHeroAvatar').src.endsWith('/222.webp')));
      check(label + ' focus returns to opener', await page.locator('#profileAvatarEdit').evaluate(n => document.activeElement === n));
      await open(page);
      await page.locator('#avatarPickerFilters [data-filter="all"]').click();
      check(label + ' all 222 images available for preview', await page.locator('#avatarPickerGrid button').count() === 222);
      await page.locator('#avatarPickerSearch').fill('斯摩格');
      check(label + ' character search uses real product names', await page.locator('#avatarPickerGrid button').count() >= 3 && await page.locator('#avatarPickerGrid').textContent().then(x => x.includes('斯摩格')));
      await select(page, 150);
      check(label + ' locked image can be previewed but cannot be saved', await page.locator('#avatarPickerImage').getAttribute('src') === 'opui://launcher/images/board/avatars/150.webp' && await page.locator('#avatarPickerApply').isDisabled());
      await page.locator('#avatarPickerSearch').fill('沒有這個角色');
      check(label + ' empty search explains no results', await page.locator('#avatarPickerEmpty').isVisible());
      await page.locator('#avatarPickerSearch').fill(''); await page.locator('#avatarPickerFilters [data-filter="owned"]').click();
      await page.locator('#avatarPickerGrid [data-avatar-id="1"]').focus(); await page.keyboard.press('ArrowRight');
      check(label + ' keyboard arrows move focus and selection', await page.locator('[data-avatar-id="2"]').evaluate(n => n === document.activeElement && n.getAttribute('aria-checked') === 'true'));
      await page.keyboard.press('End');
      check(label + ' keyboard End reaches final portrait', await page.locator('#avatarPickerGrid button').last().evaluate(n => n === document.activeElement));
      await page.keyboard.press('Tab');
      check(label + ' Tab stays inside modal', await page.evaluate(() => document.getElementById('avatarPickerDialog').contains(document.activeElement)));
      await page.keyboard.press('Escape');
      check(label + ' Escape closes modal', await page.locator('#avatarPickerDialog').evaluate(n => !n.open));

      await page.locator('#profileCardEdit').click();
      await page.locator('#profileCardName').fill('尚未儲存的新名字'); await page.locator('#profileCardTagline').fill('還在編輯的宣言');
      await page.locator('#profileCardAvatarChoose').click(); await select(page, 152); await page.locator('#avatarPickerApply').click();
      await page.waitForFunction(() => !document.getElementById('avatarPickerDialog').open);
      check(label + ' avatar save preserves unsaved name and tagline fields', await page.locator('#profileCardName').inputValue() === '尚未儲存的新名字' && await page.locator('#profileCardTagline').inputValue() === '還在編輯的宣言');
      check(label + ' avatar-only command uses persisted text and updates actual hero', await page.evaluate(() => window.__guestbookQa.avatarSaves.length === 1 && window.__guestbookQa.avatarSaves[0].displayName === '測試船長' && window.__guestbookQa.avatarSaves[0].tagline !== '還在編輯的宣言' && window.__guestbookQa.avatarSaves[0].avatarId === 152 && document.getElementById('profileHeroAvatar').src.endsWith('/152.webp')));
      await page.locator('#profileCardSave').click();
      await page.waitForFunction(() => document.getElementById('profileCardEditor').hidden);
      check(label + ' explicit card save later preserves chosen avatar and commits draft text', await page.evaluate(() => window.__guestbookQa.profiles[42].card.avatarId === 152 && window.__guestbookQa.profiles[42].card.displayName === '尚未儲存的新名字'));
      await page.evaluate(() => window.LauncherProfileShop.openProfile(0)); await page.waitForFunction(() => !document.getElementById('profileAvatarEdit').hidden);
      check(label + ' reopen reads persisted portrait', await page.locator('#profileHeroAvatar').getAttribute('src') === 'opui://launcher/images/board/avatars/152.webp');
      await open(page); await select(page, 148); await page.evaluate(() => window.__guestbookQa.saveMode = 'offline'); await page.locator('#avatarPickerApply').click();
      await page.waitForFunction(() => document.getElementById('avatarPickerStatus').classList.contains('is-error'));
      check(label + ' failed save keeps dialog selection and old actual portrait', await page.locator('#avatarPickerDialog').evaluate(n => n.open) && await page.locator('#avatarPickerImage').getAttribute('src') === 'opui://launcher/images/board/avatars/148.webp' && await page.locator('#profileHeroAvatar').getAttribute('src') === 'opui://launcher/images/board/avatars/152.webp' && await page.locator('#avatarPickerApply').isEnabled());
      await page.evaluate(() => window.__guestbookQa.saveMode = 'deny'); await page.locator('#avatarPickerApply').click();
      await page.waitForFunction(() => document.getElementById('avatarPickerStatus').textContent.includes('尚未收藏'));
      check(label + ' server ownership rejection does not fake equip', await page.locator('#profileHeroAvatar').getAttribute('src') === 'opui://launcher/images/board/avatars/152.webp');
      await page.evaluate(() => { window.__guestbookQa.saveMode = 'defer'; document.getElementById('avatarPickerApply').click(); document.getElementById('avatarPickerApply').click(); });
      await page.waitForFunction(() => window.__guestbookQa.avatarResolvers.length === 1);
      check(label + ' one in-flight request disables cancellation and grid', await page.evaluate(() => document.getElementById('avatarPickerCancel').disabled && document.getElementById('avatarPickerGrid').inert));
      await page.keyboard.press('Escape'); check(label + ' Escape cannot dismiss a pending mutation', await page.locator('#avatarPickerDialog').evaluate(n => n.open));
      await page.evaluate(() => { window.LauncherProfileShop.setAccount({ authenticated: false }); window.__guestbookQa.avatarResolvers[0](); });
      await page.waitForTimeout(50);
      check(label + ' logout closes picker and ignores old save response', await page.locator('#avatarPickerDialog').evaluate(n => !n.open) && await page.locator('#profileHeroName').textContent() === '航海者' && await page.locator('#profileAvatarEdit').isHidden());
      await page.close();
    }
    check('no missing local artwork', fixture.missingAssets.length === 0, fixture.missingAssets);
    check('no renderer exceptions', fixture.errors.length === 0, fixture.errors);
    report.status = 'PASS'; save(); console.log(JSON.stringify({ status: report.status, checks: report.checks.length, report: path.join(out, 'report.json') }));
  } catch (error) { report.status = 'FAIL'; report.error = error.stack; save(); throw error; }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
