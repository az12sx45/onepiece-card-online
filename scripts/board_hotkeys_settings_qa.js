'use strict';

// Disposable Chrome profile, fixture page and synthetic identities only.
// The existing localhost server is used only to read the production JS and CSS.
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const args = process.argv.slice(2);
const option = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const BASE = option('--base', 'http://127.0.0.1:18931');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE)) throw Error('Localhost fixture only');
const OUT = option('--out', 'D:/Codex_QA/hotkeys-fx-20260922/settings');
fs.mkdirSync(OUT, { recursive: true });
const report = { startedAt: new Date().toISOString(), base: BASE, checks: [], errors: [], screenshots: [], scope: 'Disposable real Chrome keyboard fixture; no real account, game state, room or cloud writes.' };
const check = (name, pass, detail) => { report.checks.push({ name, pass: !!pass, detail }); if (!pass) console.error('FAIL', name, detail); };
const ACTIONS = [['roll','擲骰','Space'],['inventory','背包','B'],['missions','任務','Q'],['crew','船員','C'],['ship','船隻','V'],['fleet','船團','F'],['gallery','圖鑑','G'],['focusPlayer','目前玩家','Home'],['directionUp','向上','ArrowUp'],['directionDown','向下','ArrowDown'],['directionLeft','向左','ArrowLeft'],['directionRight','向右','ArrowRight'],['wholeMap','查看全圖','M'],['settings','快捷鍵設定','K']];
const fixture = `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>Hotkeys isolated QA</title><link rel="stylesheet" href="/css/board_hotkeys.css"><style>body{background:#061823;color:#fff;font:16px Arial}input,textarea,select,button{margin:5px;padding:8px}#edit{border:1px solid #aaa;padding:8px}</style><button id="open" onclick="qa.api.openSettings()">快捷鍵設定</button><button id="ordinary" onclick="qa.clicks++">Ordinary button</button><input id="input"><textarea id="textarea"></textarea><select id="select"><option>one</option><option>two</option></select><div id="edit" contenteditable>edit here</div><script src="/js/board_hotkeys.js"></script><script>window.qa={owner:'qa-A',runs:[],allow:true,handled:true,clicks:0,passed:0};qa.api=BoardHotkeys.create({actions:${JSON.stringify(ACTIONS)}.map(([id,label,defaultKey])=>({id,label,defaultKey,description:'可自行設定的航海操作',run:()=>{qa.runs.push(id);return qa.handled}})),owner:()=>qa.owner,canRun:()=>qa.allow});window.addEventListener('keydown',()=>qa.passed++,true);</script></html>`;

async function run() {
  const browser = await chromium.launch({ executablePath: process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
    await context.route('**/qa-hotkeys-settings', route => route.fulfill({ contentType: 'text/html', body: fixture }));
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.message));
    await page.goto(BASE + '/qa-hotkeys-settings');
    await page.waitForFunction(() => window.qa?.api);
    const state = () => page.evaluate(() => ({ runs: [...qa.runs], bindings: qa.api.bindings, clicks: qa.clicks, passed: qa.passed }));
    const clear = () => page.evaluate(() => { qa.runs = []; qa.passed = 0; document.activeElement?.blur(); });
    const open = () => page.click('#open');
    const close = () => page.locator('[data-hotkey-close]').last().click();
    const edit = id => page.locator(`[data-hotkey-edit="${id}"]`).click();
    const binding = id => page.evaluate(id => qa.api.bindings[id], id);

    check('all supplied defaults retained', JSON.stringify((await state()).bindings) === JSON.stringify(Object.fromEntries(ACTIONS.map(([id,,key]) => [id,key]))));
    await page.keyboard.press('Space'); await page.keyboard.press('b');
    check('real keys dispatch matching actions once', JSON.stringify((await state()).runs) === '["roll","inventory"]');
    check('handled events do not reach later capture handler', (await state()).passed === 0);
    await page.focus('#ordinary'); await clear(); await page.focus('#ordinary'); await page.keyboard.press('Space');
    check('handled Space prevents focused-button double activation', (await state()).clicks === 0 && (await state()).runs.length === 1);
    await clear(); await page.evaluate(() => qa.allow = false); await page.keyboard.press('b');
    check('canRun false leaves event unconsumed', (await state()).runs.length === 0 && (await state()).passed === 1);
    await page.evaluate(() => { qa.allow = true; qa.handled = false; }); await clear(); await page.keyboard.press('b');
    check('run false leaves event unconsumed', (await state()).runs.length === 1 && (await state()).passed === 1);
    await page.evaluate(() => qa.handled = true);
    for (const id of ['input','textarea','select','edit']) {
      await clear(); await page.focus('#' + id); await page.keyboard.press('b');
      check(`${id}: typing never runs action`, (await state()).runs.length === 0);
    }
    await clear(); for (const key of ['Control+b','Meta+b','Enter','Escape','F5']) {
      if (key === 'F5') continue; // Avoid actual browser reload; reserved-key normalization is checked below.
      await page.keyboard.press(key);
    }
    check('Ctrl Meta Enter Escape do not run game actions', (await state()).runs.length === 0);
    await clear(); await page.keyboard.down('b'); await page.keyboard.down('b'); await page.keyboard.up('b');
    check('repeat ignored after first keydown', (await state()).runs.length === 1);
    await clear();
    const ime = await page.evaluate(() => {
      for (const extra of [{ isComposing: true }, { keyCode: 229 }]) window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b', bubbles: true, cancelable: true, ...extra }));
      return qa.runs.length;
    });
    check('IME composition and legacy 229 ignored', ime === 0);
    check('browser reserved bindings rejected', await page.evaluate(() => ['Control+B','Meta+B','Enter','Escape','Tab','F1','F5','F12','Alt+ArrowLeft','Alt+Home','Alt+Space','Alt+D'].every(key => BoardHotkeys.normalizeBinding(key) === null)));
    await clear();
    const dedupe = await page.evaluate(() => { const event = new KeyboardEvent('keydown', { key: 'b', cancelable: true, bubbles: true }); window.dispatchEvent(event); const again = qa.api.handleKeydown(event); return { count: qa.runs.length, again, prevented: event.defaultPrevented }; });
    check('same event cannot dispatch twice', dedupe.count === 1 && !dedupe.again && dedupe.prevented, dedupe);

    await open(); check('settings accessible dialog opens', await page.getByRole('dialog', { name: '快捷鍵設定', exact: true }).isVisible());
    await clear(); await page.keyboard.press('b'); check('settings blocks game actions', (await state()).runs.length === 0);
    await edit('inventory'); await page.keyboard.press('Escape');
    check('Escape cancels recording without closing dialog', await binding('inventory') === 'B' && await page.locator('dialog').evaluate(d => d.open) && await page.locator('.is-recording').count() === 0);
    await page.keyboard.press('Escape'); check('Escape outside recording closes dialog', !(await page.locator('dialog').evaluate(d => d.open)));
    await open(); await edit('inventory'); await page.keyboard.press('Shift+h');
    check('real Shift shortcut recording accepted', await binding('inventory') === 'Shift+H');
    await edit('missions'); await page.keyboard.press('Shift+h');
    check('duplicate key requests confirmation', await page.locator('[data-hotkey-confirm]').count() === 1 && await binding('missions') === 'Q' && await binding('inventory') === 'Shift+H');
    await page.click('[data-hotkey-cancel]');
    check('conflict cancel preserves both bindings', await binding('missions') === 'Q' && await binding('inventory') === 'Shift+H');
    await edit('missions'); await page.keyboard.press('Shift+h'); await page.click('[data-hotkey-confirm]');
    check('conflict confirm transfers key and clears old action', await binding('missions') === 'Shift+H' && await binding('inventory') === '');
    await page.click('[data-hotkey-clear="missions"]'); check('clear disables shortcut', await binding('missions') === '');
    await page.click('[data-hotkey-reset]'); check('reset restores supplied defaults', await binding('inventory') === 'B' && await binding('missions') === 'Q');
    await edit('inventory');
    for (const key of ['Control+b','Meta+b','Enter','Tab']) await page.keyboard.press(key);
    await page.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', isComposing: true, bubbles: true, cancelable: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'h', repeat: true, bubbles: true, cancelable: true })); });
    check('recording rejects modifiers reserved IME and repeat', await binding('inventory') === 'B' && await page.locator('.is-recording').count() === 1);
    await page.keyboard.press('Escape'); await edit('inventory'); await page.keyboard.press('Alt+h');
    check('Alt shortcut recording accepted', await binding('inventory') === 'Alt+H');
    await close(); await clear(); await page.keyboard.press('Alt+h');
    check('recorded Alt shortcut actually runs', JSON.stringify((await state()).runs) === '["inventory"]');
    const savedA = await page.evaluate(() => JSON.parse(localStorage.getItem('op_board_hotkeys_v1:qa-A')));
    check('versioned owner storage contains binding', savedA.schema === 1 && savedA.bindings.inventory === 'Alt+H');
    await page.reload(); await page.waitForFunction(() => window.qa?.api); check('reload retains owner settings', await binding('inventory') === 'Alt+H');
    await open();
    for (const [name,width,height] of [['desktop',1440,960],['mobile',390,844],['narrow',320,740],['landscape',932,430]]) {
      await page.setViewportSize({ width, height });
      const layout = await page.locator('dialog').evaluate(d => ({ width: d.getBoundingClientRect().width, height: d.getBoundingClientRect().height, overflow: d.scrollWidth > d.clientWidth + 1, bodyOverflow: document.documentElement.scrollWidth > innerWidth }));
      check(`${name}: no horizontal overflow and fits viewport`, layout.width <= width && layout.height <= height && !layout.overflow && !layout.bodyOverflow, layout);
      await page.screenshot({ path: path.join(OUT, name + '.png') }); report.screenshots.push(name + '.png');
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await page.evaluate(() => { qa.owner = 'qa-B'; });
    await page.evaluate(() => window.dispatchEvent(new StorageEvent('storage', { key: 'op_board_hotkeys_v1:qa-A', newValue: JSON.stringify({ schema: 1, bindings: { inventory: 'J' } }) })));
    check('late A storage event cannot leak into B', await binding('inventory') === 'B');
    await edit('inventory'); await page.keyboard.press('j');
    check('B settings save independently', await page.evaluate(() => JSON.parse(localStorage.getItem('op_board_hotkeys_v1:qa-B')).bindings.inventory === 'J' && JSON.parse(localStorage.getItem('op_board_hotkeys_v1:qa-A')).bindings.inventory === 'Alt+H'));
    await page.evaluate(() => qa.owner = 'qa-A'); check('switch back restores A', await binding('inventory') === 'Alt+H');
    await edit('missions'); await page.evaluate(() => qa.owner = '');
    check('signout resets bindings and recording', await binding('inventory') === 'B' && await page.locator('.is-recording').count() === 0);
    await edit('inventory'); await page.keyboard.press('j');
    check('guest setting stays memory only', await binding('inventory') === 'J' && await page.evaluate(() => localStorage.getItem('op_board_hotkeys_v1:') === null));
    await page.evaluate(() => qa.owner = 'qa-A'); check('login preserves previous account bindings', await binding('inventory') === 'Alt+H');
    await page.evaluate(() => { const value = { schema: 1, bindings: { inventory: 'U', missions: 'U', crew: 'Control+P' } }; localStorage.setItem('op_board_hotkeys_v1:qa-A', JSON.stringify(value)); window.dispatchEvent(new StorageEvent('storage', { key: 'op_board_hotkeys_v1:qa-A', newValue: JSON.stringify(value) })); });
    check('current-owner storage sanitizes duplicate and invalid bindings', await binding('inventory') === 'U' && await binding('missions') === '' && await binding('crew') === 'C');
    await close(); await clear();
    await page.evaluate(() => { const copy = qa.api.bindings; copy.inventory = 'X'; }); check('bindings getter cannot mutate internal state', await binding('inventory') === 'U');
    await page.evaluate(() => qa.api.destroy()); await page.keyboard.press('u');
    check('destroy removes dialog and key handler', (await state()).runs.length === 0 && await page.locator('dialog').count() === 0);
    check('no browser script errors', report.errors.length === 0, report.errors);
  } finally { await browser.close(); }
}
run().catch(error => { report.fatal = error.stack; console.error(error); }).finally(() => {
  report.finishedAt = new Date().toISOString(); report.ok = !report.fatal && report.checks.every(check => check.pass);
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed: report.checks.filter(check => !check.pass).map(check => check.name), output: OUT }));
  if (!report.ok) process.exitCode = 1;
});
