'use strict';

// Disposable Chromium contexts only. No real account, room, or campaign data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { installCrewLevelUpQaRoute } = require('./board_crew_level_up_qa_route.cjs');

function playwrightPath() {
  if (process.env.BOARD_QA_PLAYWRIGHT) return process.env.BOARD_QA_PLAYWRIGHT;
  try { return require.resolve('playwright'); } catch (_) { /* Codex bundled runtime fallback. */ }
  const runtimes = path.join(process.env.LOCALAPPDATA || '', 'OpenAI/Codex/runtimes/cua_node');
  for (const entry of fs.readdirSync(runtimes, { withFileTypes: true })) {
    const candidate = path.join(runtimes, entry.name, 'bin/node_modules/playwright');
    if (entry.isDirectory() && fs.existsSync(candidate)) return candidate;
  }
  throw new Error('Set BOARD_QA_PLAYWRIGHT to the Playwright module path.');
}

const { chromium } = require(playwrightPath());
const origin = new URL(process.env.BOARD_QA_URL || 'http://127.0.0.1:18945');
if (!['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname)) throw new Error('Local QA server required.');
const output = process.env.BOARD_QA_OUTPUT || 'D:/Codex_QA/board-level-up-20261107/review-2';
const chromePath = process.env.BOARD_QA_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sourcePublic = path.resolve(__dirname, '../public');
const mediaPublic = path.resolve(process.env.BOARD_QA_MEDIA_PUBLIC || 'D:/Codex_Release_Worktrees/board-voyage-records-v1/public');
const url = new URL('/board_game.html?crew_level_up_qa=1&room=LVUPQA&seed=71107&skipOpeningStory=1', origin);
const report = { url: String(url), checks: [], errors: [], screenshots: [], pageErrors: [], mediaFallback: { publicDir: mediaPublic, served: 0 } };

function check(name, condition, detail) {
  report.checks.push({ name, pass: Boolean(condition), ...(detail === undefined ? {} : { detail }) });
  assert.ok(condition, name);
}

async function initialize(page) {
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getState
    && window.BoardCards?.cards?.length && document.querySelector('#crewLevelUpToast [data-level-up-card]'), null, { timeout: 25000 });
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = 'main';
    state.gameState.currentPlayerIndex = 0;
    state.gameState.turnStep = '擲骰前進';
    state.gameState.resolutionLock = false;
    Object.assign(player, { activeCrewIndex: 0, isCPU: false, isCpu: false, cpu: false });
    document.querySelector('#modalBack')?.classList.remove('open');

    const cards = window.BoardCards.cards.filter((entry, index, list) =>
      entry.battlePortraits?.normal && list.findIndex(candidate => candidate.name === entry.name) === index);
    const makeCard = index => {
      const card = debug.cloneCard(cards[index]);
      Object.assign(card, { level: 1, totalExp: 0, exp: 0, currentExp: 0 });
      debug.syncCrewCardProgress(card);
      card.currentHp = card.baseStats.hp;
      return card;
    };
    const resetCrew = (size, offset = 0) => {
      player.crew = Array.from({ length: size }, (_, index) => makeCard(offset + index));
      player.mainMission = { claimedMissionIds: debug.mainMissionQa.definitions().map(mission => mission.id), stats: {} };
      debug.recalcPlayerDerivedStats(player);
      return player.crew;
    };
    // Find the production XP threshold on copies, without triggering grants/UI.
    const thresholdFor = (card, target) => {
      const levelFor = amount => debug.gainCardExp(structuredClone(card), amount).toLevel;
      let lo = 0, hi = 1;
      while (levelFor(hi) < target && hi < 10000000) hi *= 2;
      if (levelFor(hi) < target) throw Error('Unreachable fixture level');
      while (lo + 1 < hi) {
        const mid = (lo + hi) >> 1;
        if (levelFor(mid) >= target) hi = mid;
        else lo = mid;
      }
      return hi;
    };
    const seen = [], cues = [];
    const originalAudio = window.BoardAudio;
    if (originalAudio) window.BoardAudio = { ...originalAudio, playCue(cue, ...args) {
      if (cue === 'levelUp') cues.push(cue);
      return originalAudio.playCue(cue, ...args);
    } };
    const root = document.getElementById('crewLevelUpToast');
    const rows = () => [...root.querySelectorAll('[data-level-up-card]')].filter(card =>
      !card.hidden && !card.closest('[hidden]') && card.getClientRects().length > 0).map(card => ({
        name: card.querySelector('[data-level-up-name]')?.textContent.trim(),
        from: Number(card.querySelector('[data-level-up-from]')?.textContent.match(/\d+/)?.[0] || 0),
        to: Number(card.querySelector('[data-level-up-to]')?.textContent.match(/\d+/)?.[0] || 0),
      })).filter(row => row.name && row.from > 0 && row.to > row.from);
    const remember = () => rows().forEach(row => {
      if (!seen.some(item => item.name === row.name && item.from === row.from && item.to === row.to)) seen.push(row);
    });
    new MutationObserver(remember).observe(root, { attributes: true, subtree: true, childList: true, characterData: true });
    window.__crewLevelUpBrowserFixture = { debug, state, player, resetCrew, thresholdFor, seen, cues, rows, remember,
      grantExp: window.__BOARD_LEVEL_UP_QA_GRANT_EXP__ };
  });
}

async function checkGrantBoundary(page, name, useXpFixtureRoute) {
  const exposure = await page.evaluate(() => ({
    productionDebugHook: 'crewLevelUpQa' in window.__BOARD_GAME_DEBUG__,
    fixtureGlobal: '__BOARD_LEVEL_UP_QA_GRANT_EXP__' in window,
    fixtureCallable: typeof window.__BOARD_LEVEL_UP_QA_GRANT_EXP__ === 'function',
  }));
  check(`${name}: ${useXpFixtureRoute ? 'XP grant hook is isolated to the intercepted fixture' : 'unmodified program exposes no XP grant hook'}`,
    !exposure.productionDebugHook && exposure.fixtureGlobal === useXpFixtureRoute && exposure.fixtureCallable === useXpFixtureRoute,
    exposure);
}

const idle = page => page.waitForFunction(() => window.__crewLevelUpBrowserFixture.rows().length === 0, null, { timeout: 16000 });
const observed = page => page.evaluate(() => window.__crewLevelUpBrowserFixture.seen);
const cueCount = page => page.evaluate(() => window.__crewLevelUpBrowserFixture.cues.length);
async function waitForRows(page, expected) {
  await page.waitForFunction(rows => {
    const seen = window.__crewLevelUpBrowserFixture.seen;
    return rows.every(({ name, from, to }) => seen.some(row => row.name === name && row.from === from && row.to === to));
  }, expected, { timeout: 16000 });
}

async function layout(page, reducedMotion) {
  return page.evaluate(reduced => {
    const root = document.getElementById('crewLevelUpToast');
    const card = [...root.querySelectorAll('[data-level-up-card]')].find(node => !node.hidden && node.getClientRects().length);
    if (!card) return { present: false };
    const rect = card.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    const below = document.elementFromPoint(x, y);
    const animationSeconds = value => value.split(',').map(token => token.trim()).map(token => parseFloat(token) / (token.endsWith('ms') ? 1000 : 1));
    const entries = [root, card, ...card.querySelectorAll('[data-level-up-name], [data-level-up-from], [data-level-up-to]')];
    const motion = [...entries.map(element => getComputedStyle(element)), getComputedStyle(card, '::after')].map(style => {
      return { animation: style.animationName === 'none' ? [0] : animationSeconds(style.animationDuration), transition: animationSeconds(style.transitionDuration) };
    });
    return {
      present: true, rect: rect.toJSON(), viewport: [innerWidth, innerHeight],
      onScreen: rect.width > 0 && rect.height > 0 && rect.left >= 0 && rect.right <= innerWidth + 1 && rect.top >= 0 && rect.bottom <= innerHeight + 1,
      textFits: entries.slice(2).every(element => !element.clientWidth || element.scrollWidth <= element.clientWidth + 1),
      doesNotInterceptPointer: !!below && !root.contains(below),
      reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches === reduced,
      motion, motionSuppressed: motion.every(entry => [...entry.animation, ...entry.transition].every(seconds => seconds <= 0.05)),
    };
  }, reducedMotion);
}

async function screenshot(page, name, closeUp = false) {
  const file = path.join(output, `${name}.png`);
  if (closeUp) await page.locator('#crewLevelUpToast [data-level-up-card]').screenshot({ path: file, timeout: 4000 });
  else await page.screenshot({ path: file, timeout: 12000 });
  report.screenshots.push(file);
}

async function browserCase(browser, name, viewport, reducedMotion, run, useXpFixtureRoute = false) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Electron/39.2.7 Safari/537.36' });
  try {
    await context.addInitScript(() => {
      localStorage.setItem('op_board_user_id', '89271107');
      localStorage.setItem('op_board_client_id', 'board-level-up-local-qa');
      localStorage.setItem('board_bgm_enabled', '0');
      localStorage.setItem('board_sfx_enabled', '0');
    });
    await context.route('**/*', async route => {
      const request = route.request();
      const remote = new URL(request.url());
      if (remote.origin !== origin.origin || !['GET', 'HEAD'].includes(request.method())) return route.abort();
      const relative = decodeURIComponent(remote.pathname).slice(1);
      if (request.method() === 'GET' && /^(images|audio)\//.test(relative)) {
        const primary = path.resolve(sourcePublic, relative);
        const fallback = path.resolve(mediaPublic, relative);
        if (primary.startsWith(sourcePublic + path.sep) && fallback.startsWith(mediaPublic + path.sep)
          && !fs.existsSync(primary) && fs.statSync(fallback, { throwIfNoEntry: false })?.isFile()) {
          report.mediaFallback.served += 1;
          return route.fulfill({ path: fallback });
        }
      }
      return route.continue();
    });
    if (useXpFixtureRoute) await installCrewLevelUpQaRoute(context, origin);
    await context.routeWebSocket('**/*', socket => socket.close());
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push({ name, message: error.message }));
    await page.goto(String(url), { waitUntil: 'domcontentloaded' });
    await initialize(page);
    await checkGrantBoundary(page, name, useXpFixtureRoute);
    // Let the initial map media finish before measuring a short-lived toast.
    await page.waitForLoadState('networkidle', { timeout: 14000 }).catch(() => {});
    await run(page);
    check(`${name}: no uncaught browser errors`, !report.pageErrors.some(entry => entry.name === name));
  } catch (error) {
    report.errors.push({ name, message: error.stack || error.message });
  } finally { await context.close(); }
}

async function desktop(page) {
  await page.evaluate(() => new Promise(resolve => {
    const q = window.__crewLevelUpBrowserFixture;
    const [card] = q.resetCrew(1);
    const image = new Image();
    image.onload = image.onerror = resolve;
    image.src = card.battlePortraits.normal;
    setTimeout(resolve, 1800);
  }));
  const single = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const [card] = q.resetCrew(1);
    q.debug.gainCardExp(card, q.thresholdFor(card, 2) - 1);
    const from = card.level;
    q.grantExp(q.player, 0, 1, '瀏覽器回歸');
    q.remember();
    return { name: card.name, from, to: card.level };
  });
  check('single grant crosses exactly one level', single.from === 1 && single.to === 2, single);
  await waitForRows(page, [single]);
  check('one notification uses the actual Lv. 1 → Lv. 2 values', (await observed(page)).length === 1, single);
  check('single level-up requests one sound cue', await cueCount(page) === 1);
  const desktopLayout = await layout(page, false);
  check('desktop notification is on-screen and does not intercept clicks', desktopLayout.onScreen && desktopLayout.textFits && desktopLayout.doesNotInterceptPointer, desktopLayout);
  await page.waitForFunction(() => {
    const img = document.querySelector('#crewLevelUpToast img');
    return img?.complete && img.naturalWidth > 0;
  }, null, { timeout: 1700 });
  check('desktop notification loads the real character portrait', true);
  await page.waitForTimeout(450);
  await screenshot(page, 'crew-level-up-card-close-up', true);
  await screenshot(page, 'crew-level-up-desktop');
  await idle(page);

  const multiple = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const crew = q.resetCrew(3);
    q.seen.length = 0;
    crew[1].currentHp = 0;
    const before = crew.map(card => card.level);
    q.grantExp(q.player, 0, 5000, '同批角色回歸');
    q.remember();
    return { rows: crew.map((card, index) => ({ name: card.name, from: before[index], to: card.level })), faintedHp: crew[1].currentHp };
  });
  check('one grant levels three characters and keeps a fainted character at zero HP', multiple.rows.every(row => row.to > row.from + 1) && multiple.faintedHp === 0, multiple);
  await waitForRows(page, multiple.rows);
  check('each character shows its actual multi-level range without intermediate fake levels', (await observed(page)).length === multiple.rows.length, await observed(page));
  check('multi-character grant requests just one additional sound cue', await cueCount(page) === 2);
  await idle(page);

  const silent = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    q.seen.length = 0;
    const [card] = q.resetCrew(1);
    const before = { level: card.level, exp: card.totalExp };
    q.grantExp(q.player, 0, 1, '只得經驗');
    const xpOnly = card.level === before.level && card.totalExp > before.exp;
    const [cpuCard] = q.resetCrew(1, 1);
    q.player.isCPU = true;
    try { q.grantExp(q.player, 0, 5000, '電腦玩家回歸'); }
    finally { q.player.isCPU = false; }
    const [maxCard] = q.resetCrew(1, 2);
    q.debug.gainCardExp(maxCard, 10000000);
    const maxLevel = maxCard.level;
    q.grantExp(q.player, 0, 5000, '滿等回歸');
    q.remember();
    return { xpOnly, cpuLevel: cpuCard.level, maxUnchanged: maxCard.level === maxLevel, maxLevel };
  });
  await page.waitForTimeout(500);
  check('XP without level change, CPU growth, and capped level are silent', silent.xpOnly && silent.cpuLevel > 1 && silent.maxUnchanged && (await observed(page)).length === 0 && await cueCount(page) === 2, silent);
}

async function missionAndRestore(page) {
  const opened = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const [card] = q.resetCrew(1);
    const definitions = q.debug.mainMissionQa.definitions();
    const index = definitions.findIndex(item => item.goal?.kind === 'game_started' && Number(item.exp) > 0);
    const definition = definitions[index];
    if (!definition) throw Error('No mission with an EXP reward');
    q.player.mainMission = {
      currentMissionId: definition.id, progress: Number(definition.goal.target || 1), target: Number(definition.goal.target || 1), completed: true,
      claimedMissionIds: definitions.slice(0, index).map(item => item.id), stats: {},
    };
    q.debug.gainCardExp(card, q.thresholdFor(card, 2) - 1);
    q.debug.openMissionJournalModal(q.player);
    return { id: definition.id, from: card.level, exp: card.totalExp };
  });
  const claim = page.locator(`button[data-journal-main-claim="${opened.id}"]:enabled`);
  await claim.click({ timeout: 14000 });
  const mission = await page.evaluate(({ id, from }) => {
    const q = window.__crewLevelUpBrowserFixture;
    const [card] = q.player.crew;
    q.remember();
    return { id, claimed: q.player.mainMission.claimedMissionIds.includes(id), exp: card.totalExp, row: { name: card.name, from, to: card.level } };
  }, opened);
  check('production main mission claim button grants real XP and changes the crew level', mission.claimed && mission.exp > opened.exp && mission.row.to > mission.row.from, mission);
  await waitForRows(page, [mission.row]);
  check('mission-claim level-up appears in the same real HUD', (await observed(page)).length === 1, await observed(page));

  const loaded = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const save = q.debug.createManualSavePayload();
    const storageScope = { ownerUserId: '89271107', roomCode: save.roomCode, campaignId: '' };
    localStorage.setItem(q.debug.manualSaveStorageKeys(save)[0], JSON.stringify({ ...save, storageScope }));
    q.seen.length = 0;
    const loaded = q.debug.loadManualGame(q.debug.readManualSavePayload(), { silent: true });
    return { loaded, level: q.debug.getState().gameState.players[0].crew[0]?.level, display: q.rows() };
  });
  await idle(page);
  check('same-page save load preserves actual level and clears the transient UI', loaded.loaded && loaded.level === mission.row.to && !loaded.display.length && (await observed(page)).length === 0 && await cueCount(page) === 1, loaded);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await initialize(page);
  await checkGrantBoundary(page, 'mission restore after hard reload', false);
  const restored = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const payload = q.debug.readManualSavePayload();
    const loaded = q.debug.loadManualGame(payload, { silent: true });
    return { loaded, level: q.debug.getState().gameState.players[0].crew[0]?.level, display: q.rows() };
  });
  await page.waitForTimeout(500);
  check('hard reload and loading the stored save do not replay a prior level-up', restored.loaded && restored.level === mission.row.to && !restored.display.length && !(await observed(page)).length && await cueCount(page) === 0, restored);
}

async function small(page) {
  const expected = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const [card] = q.resetCrew(1);
    const from = card.level;
    q.grantExp(q.player, 0, 5000, '小螢幕驗證');
    q.remember();
    return { name: card.name, from, to: card.level };
  });
  await waitForRows(page, [expected]);
  const smallLayout = await layout(page, true);
  check('small viewport has readable on-screen text and does not block input', smallLayout.onScreen && smallLayout.textFits && smallLayout.doesNotInterceptPointer, smallLayout);
  check('reduced-motion preference suppresses the notification animation', smallLayout.reducedMotion && smallLayout.motionSuppressed, smallLayout.motion);
  await screenshot(page, 'crew-level-up-small-reduced-motion');
}

async function normalBattle(page) {
  const opened = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    const [card] = q.resetCrew(1);
    q.debug.gainCardExp(card, q.thresholdFor(card, 2) - 1);
    const island = q.state.gameState.boardData.islands.find(entry => entry.kind === 'enemy'
      && q.debug.getIslandState(entry.id)?.enemyProfile);
    if (!island) throw Error('Missing normal enemy island');
    q.state.gameState.skipNextBattleMapShake = true;
    q.debug.startBattle(q.player, island, q.debug.getIslandState(island.id));
    const battle = q.state.battleState;
    // Seed only the terminal combat result. The real result button must perform all reward grants.
    Object.assign(battle, { entryTransition: null, prebattleIntro: null, prebattleIntroDone: true, openingPassiveVisual: null, openingPassiveVisualQueue: [], visualEvent: null, animating: false, roundResolved: true, waitingResume: false, needsReplacement: false, result: 'win' });
    battle.enemyCombatant.currentHp = 0;
    q.debug.notifyBattleWindow();
    return { island: island.id, enemy: battle.enemyCombatant.name, from: card.level, exp: card.totalExp };
  });
  const finish = page.frameLocator('#battlePageFrame').locator('[data-finish-battle]:enabled');
  await finish.waitFor({ state: 'visible', timeout: 14000 });
  const beforeFinish = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture;
    return { exp: q.player.crew[0].totalExp, shown: q.seen.length };
  });
  check('normal battle victory preview has not granted EXP or played a level-up', beforeFinish.exp === opened.exp && beforeFinish.shown === 0, { ...opened, beforeFinish });
  await finish.click();
  await page.waitForFunction(() => window.__crewLevelUpBrowserFixture.seen.length > 0, null, { timeout: 14000 });
  const afterFinish = await page.evaluate(() => {
    const q = window.__crewLevelUpBrowserFixture, card = q.player.crew[0];
    return { exp: card.totalExp, level: card.level, seen: q.seen, cues: q.cues.length };
  });
  check('actual normal battle result button grants EXP and notifies once with the real level', afterFinish.exp > opened.exp
    && afterFinish.level > opened.from && afterFinish.seen.length === 1 && afterFinish.seen[0].from === opened.from
    && afterFinish.seen[0].to === afterFinish.level && afterFinish.cues === 1, afterFinish);
}

async function main() {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(fs.existsSync(chromePath) ? { executablePath: chromePath } : {}) });
  try {
    await browserCase(browser, 'desktop', { width: 1440, height: 900 }, false, desktop, true);
    await browserCase(browser, 'small-landscape', { width: 568, height: 320 }, true, small, true);
    await browserCase(browser, 'mission-claim', { width: 1440, height: 900 }, false, missionAndRestore);
    await browserCase(browser, 'normal-battle', { width: 1366, height: 768 }, false, normalBattle);
  } finally { await browser.close(); }
}

main().catch(error => report.errors.push({ name: 'harness', message: error.stack || error.message })).finally(() => {
  report.ok = report.checks.length > 0 && report.errors.length === 0 && report.pageErrors.length === 0 && report.checks.every(entry => entry.pass);
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'crew-level-up-browser-report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
});
