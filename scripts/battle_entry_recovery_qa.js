const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_entry_recovery_20260816_v75";

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(12000);
  await context.addInitScript(() => {
    sessionStorage.removeItem("onepiece-board-prebattle-intro-done-v3");
    sessionStorage.removeItem("onepiece-board-battle-entry-played-v1");
    localStorage.removeItem("onepiece-board-dev-observer-v1");
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${ROOT_URL}/board_game.html?battle_entry_recovery_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length);

  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    const source = window.BoardCards.cards.find((card) => card.id === "luffy") || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 50 })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-entry-recovery-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments[0];
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
  });

  const frameElement = await page.waitForSelector("#battlePageFrame");
  const frame = await frameElement.contentFrame();
  await frame.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.prebattleIntro);
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.prebattleIntro?.done === true, null, { timeout: 20000 });

  const introBefore = await page.evaluate(() => ({ ...window.__BOARD_GAME_DEBUG__.getState().battleState.prebattleIntro }));
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    debug.getState().battleState.prebattleIntro.done = false;
    debug.notifyBattleWindow();
  });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.prebattleIntro?.done === true, null, { timeout: 5000 });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getBattleView()?.battle?.canAct === true, null, { timeout: 9000 });
  const recovered = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const view = debug.getBattleView();
    return {
      introDone: !!state.battleState?.prebattleIntro?.done,
      introId: state.battleState?.prebattleIntro?.id || "",
      canAct: !!view?.battle?.canAct,
      overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
      frameLoaded: document.getElementById("battlePageFrame")?.dataset.loaded || "",
    };
  });
  if (!recovered.introDone) failures.push("lost intro completion was not acknowledged again");
  if (recovered.introId !== introBefore.id) failures.push("battle intro identity changed during recovery");
  if (!recovered.canAct) failures.push("battle controls did not unlock after recovered acknowledgement");
  if (!recovered.overlayOpen || recovered.frameLoaded !== "true") failures.push("battle overlay was not ready after recovery");

  const layout = await frame.evaluate(() => {
    const playerCard = document.getElementById("playerCard")?.getBoundingClientRect();
    const enemyCard = document.getElementById("enemyCard")?.getBoundingClientRect();
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      playerCard: playerCard ? { left: playerCard.left, top: playerCard.top, right: playerCard.right, bottom: playerCard.bottom } : null,
      enemyCard: enemyCard ? { left: enemyCard.left, top: enemyCard.top, right: enemyCard.right, bottom: enemyCard.bottom } : null,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2 || document.documentElement.scrollHeight > window.innerHeight + 2,
    };
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "battle_entry_recovered.png"), fullPage: false });

  const fallbackPage = await context.newPage();
  fallbackPage.on("pageerror", (error) => errors.push(`fallback:${error.message}`));
  await fallbackPage.goto(`${ROOT_URL}/board_game.html?battle_entry_watchdog_qa=1`, { waitUntil: "domcontentloaded" });
  await fallbackPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length);
  await fallbackPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    const source = window.BoardCards.cards.find((card) => card.id === "luffy") || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 50 })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-entry-watchdog-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignments = state.gameState.postgameWorld.islandAssignments || [];
    const assignment = assignments.find((entry) => debug.getIslandState(entry.islandId)?.enemyProfile?.key === "postgame_vinsmoke_judge") || assignments[0];
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
  });
  const fallbackFrameElement = await fallbackPage.waitForSelector("#battlePageFrame");
  const fallbackFrame = await fallbackFrameElement.contentFrame();
  await fallbackFrame.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.prebattleIntro);
  await fallbackFrame.evaluate(() => {
    window.parent.__BOARD_GAME_DEBUG__.battleMarkPrebattleIntroDone = () => false;
  });
  await fallbackPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.prebattleIntro?.done === true, null, { timeout: 19000 });
  const watchdogRecovered = await fallbackPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const view = debug.getBattleView();
    return {
      introDone: !!debug.getState().battleState?.prebattleIntro?.done,
      canAct: !!view?.battle?.canAct,
      overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
      frameLoaded: document.getElementById("battlePageFrame")?.dataset.loaded || "",
    };
  });
  if (!watchdogRecovered.introDone) failures.push("parent watchdog did not release a missing intro acknowledgement");
  if (!watchdogRecovered.overlayOpen || watchdogRecovered.frameLoaded !== "true") failures.push("watchdog recovery lost the battle overlay");
  await fallbackPage.screenshot({ path: path.join(OUTPUT_DIR, "battle_entry_watchdog_recovered.png"), fullPage: false });

  const seaPage = await context.newPage();
  seaPage.on("pageerror", (error) => errors.push(`sea:${error.message}`));
  await seaPage.goto(`${ROOT_URL}/board_game.html?battle_entry_sea_qa=1`, { waitUntil: "domcontentloaded" });
  await seaPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.beginSeaEncounterBattle && window.BoardCards?.cards?.length);
  await seaPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    const source = window.BoardCards.cards.find((card) => card.id === "luffy") || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 50 })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-entry-sea-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments[0];
    const sourceState = debug.getIslandState(assignment.islandId);
    const enemyProfile = JSON.parse(JSON.stringify(sourceState.enemyProfile));
    enemyProfile.maxHp = Number(sourceState.maxHp || enemyProfile.maxHp || 100);
    debug.beginSeaEncounterBattle(player, { id: "qa-sea-tile", name: "海格測試航路" }, enemyProfile);
  });
  await seaPage.waitForSelector("#battlePageFrame", { timeout: 9000 });
  await seaPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.prebattleIntro, null, { timeout: 9000 });
  await seaPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const intro = debug.getState().battleState.prebattleIntro;
    debug.battleMarkPrebattleIntroDone(intro.id, intro.key);
  });
  await seaPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getBattleView()?.battle?.canAct === true, null, { timeout: 7000 });
  const seaEntry = await seaPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    return {
      isSeaEncounter: !!state.battleState?.isSeaEncounter,
      islandKind: state.battleState?.islandKind || "",
      introDone: !!state.battleState?.prebattleIntro?.done,
      canAct: !!debug.getBattleView()?.battle?.canAct,
      resolutionLock: !!state.gameState?.resolutionLock,
      overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
    };
  });
  if (!seaEntry.isSeaEncounter || seaEntry.islandKind !== "sea-encounter") failures.push("sea encounter did not enter the battle state");
  if (!seaEntry.introDone || !seaEntry.canAct || !seaEntry.overlayOpen) failures.push(`sea encounter remained blocked: ${JSON.stringify(seaEntry)}`);

  const report = { recovered, watchdogRecovered, seaEntry, layout, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length || layout.overflow) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
