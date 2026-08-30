const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/oars_variable_stake_20260814_v56";
let activeBrowser = null;

async function prepareOarsBattle(host) {
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.currentPlayerIndex = 0;
    state.gameState.turnIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    player.pendingBattle = null;
    state.battleState = null;
    const source = window.BoardCards.cards.find((card) => card.id === "custom_mp3la6fr") || window.BoardCards.cards[0];
    const card = debug.cloneCard(source);
    player.crew = [card];
    player.activeCrewIndex = 0;
    card.currentHp = debug.cardMaxHp(card);
    debug.recalcPlayerDerivedStats(player);
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "oars-lottery-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    state.gameState.postgameWorld.researchLabsActive = true;
    const assignment = (state.gameState.postgameWorld?.islandAssignments || []).find((entry) => entry.bossKey === "postgame_oars");
    if (!assignment) throw new Error("postgame_oars assignment missing");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    debug.battleMarkPrebattleIntroDone();
    debug.notifyBattleWindow();
    return {
      islandId: assignment.islandId,
      enemyHp: state.battleState?.enemyCombatant?.currentHp,
      enemyMaxHp: state.battleState?.enemyCombatant?.maxHp,
      enemyProfileMaxHp: state.battleState?.enemyCombatant?.maxHp,
      bossKey: state.battleState?.postgameBossKey,
    };
  });
}

async function runViewport(browser, name, viewport) {
  const progress = (label) => process.stdout.write(`[oars-qa:${name}] ${label}\n`);
  const errors = [];
  progress("context");
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const host = await context.newPage();
  host.on("pageerror", (error) => errors.push(`host:${error.message}`));
  await host.goto(`${ROOT_URL}/board_game.html?oars_lottery_qa=${name}`, { waitUntil: "domcontentloaded" });
  progress("board loaded");
  const started = await prepareOarsBattle(host);
  progress("battle started");
  const frameHandle = await host.waitForSelector("#battlePageOverlay iframe", { timeout: 15000 });
  const frame = await frameHandle.contentFrame();
  frame.on("pageerror", (error) => errors.push(`battle:${error.message}`));
  await frame.waitForSelector("[data-oars-prediction]", { timeout: 15000 });
  await frame.waitForTimeout(2600);
  await host.waitForFunction(() => !window.__BOARD_GAME_DEBUG__.getState().battleState?.animating, null, { timeout: 10000 });
  progress("prediction visible");
  const initialView = await host.evaluate(() => window.__BOARD_GAME_DEBUG__.getBattleView());
  const initialRules = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    return {
      saltBags: battle.postgameBossMechanic?.saltBags,
      stages: { ...battle.enemyCombatant?.stages },
      speed: battle.enemyCombatant?.spd,
      minimumHitChance: battle.enemyCombatant?.minimumHitChance,
      intrinsicEvasionPenalty: battle.enemyCombatant?.intrinsicEvasionPenalty,
      firstMoveHitChance: debug.postgameBossMechanicQa.moveHitChance("enemy", battle.enemyCombatant.moveSet[0], player, battle),
      playerAccuracy80HitChance: debug.postgameBossMechanicQa.moveHitChance("player", { accuracy: 80, category: "attack", effects: {} }, player, battle),
    };
  });
  progress(`control=${initialView?.battle?.canControl} prompt=${initialView?.battle?.postgameBossMechanic?.prompt?.type || "none"}`);
  const initialLayout = await frame.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
    prompt: document.querySelector(".oars-lottery-ui")?.getBoundingClientRect().toJSON() || null,
    enemyNatural: {
      width: document.getElementById("enemyPortrait")?.naturalWidth || 0,
      height: document.getElementById("enemyPortrait")?.naturalHeight || 0,
    },
  }));
  await host.screenshot({ path: path.join(OUTPUT_DIR, `${name}_prediction.png`) });
  progress("prediction captured");
  await frame.locator('[data-oars-prediction="first_big"] [data-oars-stake-plus]').click();
  await frame.locator('[data-oars-prediction="first_big"] [data-oars-stake-plus]').click();
  await frame.locator('[data-oars-prediction="first_exact_6"] [data-oars-stake-plus]').click();
  await frame.waitForFunction(() => {
    const big = document.querySelector('[data-oars-prediction="first_big"] [data-oars-stake-count]')?.textContent;
    const exact = document.querySelector('[data-oars-prediction="first_exact_6"] [data-oars-stake-count]')?.textContent;
    return big === "2 包" && exact === "1 包" && document.querySelectorAll("[data-oars-prediction].selected").length === 2;
  }, null, { timeout: 3000 });
  await host.screenshot({ path: path.join(OUTPUT_DIR, `${name}_variable_stakes.png`) });
  await frame.locator("[data-oars-confirm-bets]").click();
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.postgameBossMechanic?.lockedPredictions?.length === 2, null, { timeout: 8000 });
  await frame.waitForFunction(() => !document.querySelector("[data-oars-prediction]"), null, { timeout: 8000 });
  progress("variable stakes locked");
  const lockedView = await host.evaluate(() => window.__BOARD_GAME_DEBUG__.getBattleView());
  const wagerResolution = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const result = debug.postgameBossMechanicQa.settleOarsPrediction(player, battle, [5], 5);
    return {
      saltBags: battle.postgameBossMechanic.saltBags,
      wonCount: result?.wonCount,
      lostCount: result?.lostCount,
      gained: result?.gained,
      lockedCount: battle.postgameBossMechanic.lockedPredictions?.length,
    };
  });
  const periodicGrant = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    battle.roundIndex = 3;
    debug.postgameBossMechanicQa.roundStart(player, battle);
    return {
      saltBags: battle.postgameBossMechanic.saltBags,
      lastPeriodicSaltRound: battle.postgameBossMechanic.lastPeriodicSaltRound,
    };
  });
  const noSaltPrompt = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    battle.postgameBossMechanic.saltBags = 0;
    battle.postgameBossMechanic.lockedPredictions = [];
    battle.postgameBossMechanic.predictionResolvedKey = "";
    return debug.getBattleView()?.battle?.postgameBossMechanic?.prompt?.type || "";
  });
  await frame.waitForTimeout(300);
  await host.screenshot({ path: path.join(OUTPUT_DIR, `${name}_battle_portrait.png`) });
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    battle.postgameBossMechanic.saltBags = 15;
    battle.postgameBossMechanic.lockedPredictions = [];
    battle.postgameBossMechanic.purificationInterruptPending = true;
    debug.notifyBattleWindow();
  });
  await frame.waitForSelector("[data-oars-purify]", { timeout: 8000 });
  progress("purification visible");
  const purificationLayout = await frame.evaluate(() => ({
    prompt: document.querySelector(".oars-purification-ui")?.getBoundingClientRect().toJSON() || null,
    image: document.querySelector(".oars-purification-action img")?.getBoundingClientRect().toJSON() || null,
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  }));
  await host.screenshot({ path: path.join(OUTPUT_DIR, `${name}_purification_ready.png`) });
  await frame.locator("[data-oars-purify]").click();
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.result === "win", null, { timeout: 10000 });
  progress("purification resolved");
  await frame.waitForTimeout(1300);
  await host.screenshot({ path: path.join(OUTPUT_DIR, `${name}_purification_hit.png`) });
  const finalState = await host.evaluate(() => {
    const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
    return {
      result: battle?.result,
      enemyCurrentHp: battle?.enemyCombatant?.currentHp,
      purified: battle?.postgameBossMechanic?.purified,
      saltBags: battle?.postgameBossMechanic?.saltBags,
      eventType: battle?.visualEvent?.type || "",
      extractionPending: !!window.__BOARD_GAME_DEBUG__.getBattleView()?.battle?.lineageExtraction,
    };
  });
  const noHorizontalOverflow = initialLayout.scroll.width <= initialLayout.viewport.width + 2
    && purificationLayout.scroll.width <= initialLayout.viewport.width + 2;
  await context.close();
  progress("context closed");
  return {
    name,
    viewport,
    started,
    initialPrompt: initialView?.battle?.postgameBossMechanic?.prompt?.type || "",
    initialOptions: initialView?.battle?.postgameBossMechanic?.prompt?.options?.length || 0,
    initialRules,
    lockedPredictions: lockedView?.battle?.postgameBossMechanic?.state?.lockedPredictions?.map((bet) => ({ id: bet.id, stake: bet.stake })) || [],
    saltAfterStake: lockedView?.battle?.postgameBossMechanic?.state?.saltBags,
    wagerResolution,
    periodicGrant,
    noSaltPrompt,
    initialLayout,
    purificationLayout,
    noHorizontalOverflow,
    finalState,
    errors,
  };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  activeBrowser = browser;
  const reports = [];
  const requested = String(process.env.BOARD_QA_CASES || "desktop,phone_landscape").split(",").map((entry) => entry.trim());
  for (const [name, viewport] of [
    ["desktop", { width: 1920, height: 1080 }],
    ["phone_landscape", { width: 932, height: 430 }],
  ].filter(([name]) => requested.includes(name))) reports.push(await runViewport(browser, name, viewport));
  await browser.close();
  activeBrowser = null;
  const report = { outputDir: OUTPUT_DIR, reports };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  const failed = reports.some((entry) => (
    entry.started.enemyMaxHp !== 55555
    || entry.started.enemyHp !== 55555
    || entry.started.bossKey !== "postgame_oars"
    || entry.initialPrompt !== "oars_lottery"
    || entry.initialOptions < 10
    || entry.initialRules.saltBags !== 3
    || entry.initialRules.speed !== 18
    || entry.initialRules.stages.accuracy !== 0
    || entry.initialRules.stages.evasion !== 0
    || entry.initialRules.stages.spd !== 0
    || entry.initialRules.minimumHitChance !== 25
    || entry.initialRules.intrinsicEvasionPenalty !== 16
    || entry.initialRules.firstMoveHitChance !== 48
    || entry.initialRules.playerAccuracy80HitChance < 96
    || JSON.stringify(entry.lockedPredictions) !== JSON.stringify([{ id: "first_big", stake: 2 }, { id: "first_exact_6", stake: 1 }])
    || entry.saltAfterStake !== 0
    || entry.wagerResolution.saltBags !== 4
    || entry.wagerResolution.wonCount !== 1
    || entry.wagerResolution.lostCount !== 1
    || entry.wagerResolution.gained !== 4
    || entry.wagerResolution.lockedCount !== 0
    || entry.periodicGrant.saltBags !== 5
    || entry.periodicGrant.lastPeriodicSaltRound !== 3
    || entry.noSaltPrompt !== ""
    || !entry.noHorizontalOverflow
    || entry.finalState.result !== "win"
    || entry.finalState.enemyCurrentHp !== 0
    || !entry.finalState.purified
    || entry.finalState.saltBags !== 0
    || !entry.finalState.extractionPending
    || entry.errors.length
  ));
  if (failed) process.exitCode = 1;
})().catch(async (error) => {
  if (activeBrowser) await activeBrowser.close().catch(() => {});
  console.error(error);
  process.exitCode = 1;
});
