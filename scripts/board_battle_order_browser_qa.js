'use strict';

// Real DOM/media timeline checks in disposable contexts. Public mode is GET/HEAD
// only with WebSocket blocked; fixtures never touch a room or a real save.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || 'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const ROOT = path.resolve(__dirname, '..');
const ORIGIN = process.env.BOARD_QA_URL || 'http://127.0.0.1:18926';
const OUTPUT = process.env.BOARD_QA_OUTPUT || 'D:/Codex_QA/board-battle-order-20260921/browser';
const baseline = process.argv.includes('--baseline');
if (baseline && !/^http:\/\/(localhost|127\.0\.0\.1):/.test(ORIGIN)) throw new Error('Baseline comparison is local only');
const baselineSource = baseline ? execFileSync('git', ['show', 'afea08a234f559f83cb2eb688f4fa1d34ceaa6a8:public/js/board_battle.js'], { cwd: ROOT, maxBuffer: 4 * 1024 * 1024 }) : null;
const report = { startedAt: new Date().toISOString(), origin: ORIGIN, baseline, readOnly: true, checks: [], errors: [], cases: [], screenshots: [] };
fs.mkdirSync(OUTPUT, { recursive: true });
const save = () => fs.writeFileSync(path.join(OUTPUT, 'battle-order-report.json'), JSON.stringify(report, null, 2));
function check(name, pass, detail) { report.checks.push({ name, pass: !!pass, detail }); if (!pass) console.error('FAIL ' + name); save(); }
async function contextFor(browser, viewport = { width: 1440, height: 900 }) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => {
    try {
    localStorage.setItem('op_board_user_id', '892126');
    localStorage.setItem('op_board_client_id', 'readonly-battle-order-qa');
    localStorage.setItem('op_name', '戰鬥時序驗證');
    localStorage.setItem('op_player_name', '戰鬥時序驗證');
    localStorage.setItem('board_bgm_enabled', '0');
    localStorage.setItem('board_sfx_enabled', '0');
    } catch (_) { /* about:blank has no origin before navigation */ }
  });
  await context.route('**/*', route => ['GET', 'HEAD'].includes(route.request().method()) ? route.continue() : route.abort('blockedbyclient'));
  await context.routeWebSocket('**/*', socket => socket.close());
  if (baselineSource) await context.route('**/js/board_battle.js*', route => route.fulfill({ contentType: 'text/javascript', body: baselineSource }));
  context.on('page', page => page.on('pageerror', error => report.errors.push({ url: page.url(), message: error.message })));
  return context;
}
async function actualView(browser) {
  const context = await contextFor(browser), page = await context.newPage();
  try {
    await page.goto(ORIGIN + '/board_game.html?battle_order_qa=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 30000 });
    return await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__, state = debug.getState(), player = state.gameState.players[0];
      const source = window.BoardCards.cards.find(card => /索隆/.test(card.name)) || window.BoardCards.cards[0];
      player.crew = [0, 1].map(index => ({ ...debug.cloneCard({ ...source, level: 50, currentHp: Number.MAX_SAFE_INTEGER }), id: source.id + '-qa-' + index }));
      player.crew.forEach(card => { card.currentHp = Number(card.baseStats?.hp || 1000); });
      player.activeCrewIndex = 0; player.pendingBattle = null; state.battleState = null;
      if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: 'readonly-battle-order' });
      debug.ensurePostgameWorldLayout(state.gameState);
      const assignment = state.gameState.postgameWorld.islandAssignments.find(entry => entry.bossKey === 'postgame_douglas_bullet') || state.gameState.postgameWorld.islandAssignments[0];
      const island = debug.getIslandById(assignment.islandId), islandState = debug.getIslandState(assignment.islandId);
      islandState.currentHp = islandState.maxHp; islandState.isDefeated = false;
      debug.startBattle(player, island, islandState);
      Object.assign(state.battleState, { entryTransition: null, prebattleIntro: null, prebattleIntroDone: true, openingPassiveVisual: null, openingPassiveVisualQueue: [], visualEvent: null, animating: false, roundResolved: false, waitingResume: false });
      const view = JSON.parse(JSON.stringify(debug.getBattleView()));
      Object.assign(view.battle, { postgameBossMechanic: null, prebattleIntro: null, canControl: true, canAct: false, canFinish: false, animating: true, result: '', log: [], visualEvent: null });
      view.enemy.key = 'qa-enemy'; view.enemy.currentHp = view.enemy.maxHp = 100;
      view.activeCard.currentHp = view.activeCard.maxHp = 100;
      return view;
    });
  } finally { await context.close(); }
}
async function runCase(browser, fixture, spec) {
  const context = await contextFor(browser, spec.viewport), page = await context.newPage();
  try {
    await page.goto(ORIGIN + '/board_battle.html?battle_order_qa=1', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__);
    await page.locator('body').click({ position: { x: 6, y: 6 } });
    await page.evaluate(({ fixture, spec }) => {
      const qa = window.__orderQa = { samples: [], writes: [], audio: [], marks: {}, view: structuredClone(fixture), start: 0, running: false };
      const target = spec.side || 'player', actor = target === 'player' ? 'enemy' : 'player';
      qa.target = target;
      const targetCard = () => document.getElementById(target + 'Card');
      const targetImage = () => document.getElementById(target + 'Portrait');
      qa.send = view => { qa.view = structuredClone(view); localStorage.setItem('onepiece-board-battle-snapshot-v1', JSON.stringify({ view: qa.view })); window.__BOARD_BATTLE_DEBUG__.refresh(qa.view); };
      qa.view.battle.islandId += '-' + spec.name;
      qa.send(qa.view);
      const originalPlay = HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play = function(...args) { if (qa.running) qa.audio.push({ time: performance.now() - qa.start, src: this.src }); return originalPlay.apply(this, args); };
      new MutationObserver(records => { if (qa.running) records.forEach(record => qa.writes.push({ at: performance.now() - qa.start, attribute: record.attributeName, old: record.oldValue, value: record.target.getAttribute(record.attributeName) })); }).observe(targetImage(), { attributes: true, attributeFilter: ['src'], attributeOldValue: true });
      function sample() {
        if (qa.running) qa.samples.push({ at: performance.now() - qa.start, src: targetImage().getAttribute('src'), className: targetCard().className, hp: document.getElementById(target + 'HpFill').style.width, panel: !document.querySelector('[data-layout-id="infoPanel"]').classList.contains('is-hidden'), panelText: document.getElementById('infoContent').textContent.slice(0, 120), loaded: targetImage().complete && targetImage().naturalWidth > 0 });
        requestAnimationFrame(sample);
      }
      requestAnimationFrame(sample);
      qa.begin = () => {
        qa.start = performance.now(); qa.running = true;
        const view = structuredClone(qa.view), source = target === 'player' ? view.activeCard : view.enemy;
        const before = { player: structuredClone(view.activeCard), enemy: structuredClone(view.enemy) };
        source.currentHp = 0;
        const after = { player: structuredClone(view.activeCard), enemy: structuredClone(view.enemy) };
        const hits = spec.combo ? [30, 30, 40] : [100];
        const duration = spec.combo ? 2800 : 1850;
        view.battle.visualEvent = { id: spec.name + '-attack', type: 'attack', side: actor, targetSide: target, actorName: before[actor].name, targetName: source.name, moveName: '時序驗證', moveType: spec.combo ? 'combo' : 'attack', moveId: 'qa-custom-attack', castSfx: 'audio/board_game/sfx/game01/game01/button01a.mp3', hitSfx: 'audio/board_game/sfx/game01/game01/button02a.mp3', damage: 100, hitDamages: hits, duration, startCombatant: before[target], targetCombatant: after[target], actorCombatant: before[actor], startSnapshot: before, finalSnapshot: after, startHp: { player: 100, enemy: 100 }, finalHp: { player: after.player.currentHp, enemy: after.enemy.currentHp } };
        if (spec.earlyReplacement) { view.battle.needsReplacement = true; view.battle.result = 'replacement'; }
        if (spec.earlyResult) { view.battle.result = target === 'enemy' ? 'win' : 'lose'; view.battle.canFinish = true; }
        if (spec.awakening) view.battle.keepPlayerPortraitOnKnockout = view.battle.luffyGearFifthAwakeningPending = true;
        qa.send(view);
        qa.repeat = setInterval(() => qa.send(qa.view), 120);
        const koAt = duration + 420 + 1450;
        setTimeout(() => {
          qa.marks.ko = performance.now() - qa.start;
          const next = structuredClone(qa.view); next.battle.visualEvent = { id: spec.name + '-knockout', type: 'knockout', side: target, targetName: source.name, duration: 4250 }; qa.send(next);
          // Repeated transport/refresh must not restart the knockout.
          setTimeout(() => qa.send(qa.view), 420);
        }, koAt);
        setTimeout(() => { clearInterval(qa.repeat); qa.running = false; qa.done = true; }, koAt + 4450);
      };
    }, { fixture, spec });
    await page.waitForFunction(() => ['playerPortrait', 'enemyPortrait'].every(id => { const image = document.getElementById(id); return image.complete && image.naturalWidth; }), null, { timeout: 30000 });
    await page.evaluate(() => window.__orderQa.begin());
    await page.waitForTimeout(1100);
    const screenshot = path.join(OUTPUT, spec.name + '.png'); await page.screenshot({ path: screenshot }); report.screenshots.push(screenshot);
    await page.waitForFunction(() => window.__orderQa.done, null, { timeout: 16000 });
    const data = await page.evaluate(() => { const q = window.__orderQa; return { samples: q.samples, writes: q.writes, audio: q.audio, marks: q.marks }; });
    report.cases.push({ name: spec.name, ...data });
    const samples = data.samples, before = samples.filter(row => row.at < (spec.combo ? 480 : 700));
    const dead = samples.find(row => parseFloat(row.hp) === 0);
    check(spec.name + ': no hurt/KO/zero HP before contact', before.length > 0 && before.every(row => parseFloat(row.hp) > 0 && !/portrait-hit|portrait-ko|nika-awakening-standby/.test(row.className)), before.slice(-2));
    check(spec.name + ': lethal contact is displayed', !!dead && dead.at >= (spec.combo ? 480 : 700), dead);
    const afterContact = dead ? samples.filter(row => row.at > dead.at + 80 && row.at < data.marks.ko) : [];
    check(spec.name + ': lethal target never returns to normal', afterContact.length > 0 && afterContact.every(row => /portrait-hit|portrait-ko|nika-awakening-standby/.test(row.className)), afterContact.filter(row => !/portrait-hit|portrait-ko|nika-awakening-standby/.test(row.className)).slice(0, 3));
    const fadeEntries = samples.filter((row, index) => /portrait-ko/.test(row.className) && (index === 0 || !/portrait-ko/.test(samples[index - 1].className)));
    check(spec.name + ': knockout fades at most once', fadeEntries.length === (spec.awakening ? 0 : 1), fadeEntries.map(row => row.at));
    if (!spec.awakening) { const fade = fadeEntries[0]; check(spec.name + ': no reappearance after knockout', !!fade && samples.filter(row => row.at >= fade.at).every(row => /portrait-ko/.test(row.className))); }
    check(spec.name + ': periodic refresh does not reset identical image', data.writes.filter(row => row.old === row.value).length === 0, data.writes.length);
    if (spec.earlyReplacement || spec.earlyResult) check(spec.name + ': terminal panel waits for contact and fade', samples.filter(row => row.at < (fadeEntries[0]?.at || data.marks.ko) + 900).every(row => !row.panel));
    check(spec.name + ': real portraits decoded', samples.some(row => row.loaded));
  } finally { await context.close(); save(); }
}
async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  try {
    const fixture = await actualView(browser);
    const cases = [
      { name: 'player-lethal', side: 'player' },
      { name: 'enemy-lethal-result', side: 'enemy', earlyResult: true },
      { name: 'player-early-replacement', side: 'player', earlyReplacement: true },
      { name: 'combo-lethal-mobile', side: 'player', combo: true, earlyReplacement: true, viewport: { width: 932, height: 430 } },
      { name: 'awakening-hold', side: 'player', awakening: true },
    ];
    // Two independent pages at a time keep animation frames responsive.
    for (let i = 0; i < cases.length; i += 2) await Promise.all(cases.slice(i, i + 2).map(spec => runCase(browser, fixture, spec)));
    check('no JavaScript exceptions', report.errors.length === 0, report.errors);
    report.ok = report.checks.every(row => row.pass); report.finishedAt = new Date().toISOString(); save();
    console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failed: report.checks.filter(row => !row.pass).map(row => row.name), output: OUTPUT }));
    if (!report.ok) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { report.ok = false; report.fatal = error.stack; save(); console.error(error.stack); process.exitCode = 1; });
