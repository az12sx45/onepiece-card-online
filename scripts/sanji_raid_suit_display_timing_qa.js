const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/sanji_stealth_miss_portrait_20260814_v217";
let qaBrowser = null;

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  qaBrowser = browser;
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?sanji_raid_suit_timing_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const queued = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const source = JSON.parse(JSON.stringify(window.BoardCards.cards.find((card) => card.id === "sanji")));
    if (!source) throw new Error("Missing Sanji card");
    source.formId = "sanji_evolution_2";
    source.unlockedEvolutionFormIds = ["sanji_evolution_2"];
    source.battleCarryItem = "judge_germa66_battle_suit";
    const sanji = debug.cloneCard(source);
    sanji.currentHp = Math.max(1, Number(sanji.baseStats?.hp || sanji.hp || 1));
    player.crew = [sanji];
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "sanji-raid-suit-timing-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_vinsmoke_judge");
    if (!assignment) throw new Error("Missing Judge postgame assignment");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = state.battleState;
    const view = debug.getBattleView();
    return {
      introId: battle.prebattleIntro?.id || "",
      logicalTransformed: !!battle.sanjiRaidSuitState?.players?.[player.id]?.forms
        && Object.values(battle.sanjiRaidSuitState.players[player.id].forms).some((entry) => entry.transformed),
      queueTypes: (battle.openingPassiveVisualQueue || []).map((event) => event.type),
      displayed: {
        name: view.activeCard.name,
        transformed: view.activeCard.raidSuitTransformed,
        portrait: view.activeCard.battlePortraits?.normal || view.activeCard.battlePortraits?.idle || "",
      },
    };
  });

  await host.waitForSelector("#battlePageFrame", { timeout: 10000 });
  await host.waitForFunction(() => document.querySelector("#battlePageFrame")?.dataset.loaded === "true", null, { timeout: 15000 });
  const battle = host.frames().find((frame) => frame.url().includes("board_battle.html"));
  if (!battle) throw new Error("Missing embedded battle frame");
  captureErrors(battle, errors, "battle");
  await battle.waitForFunction(() => document.getElementById("playerPortrait")?.naturalWidth > 0, null, { timeout: 15000 });

  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    state.battleState.prebattleIntro.done = true;
    debug.notifyBattleWindow();
  });
  await battle.waitForTimeout(180);
  const before = await host.evaluate(() => {
    const view = window.__BOARD_GAME_DEBUG__.getBattleView();
    return {
      name: view.activeCard.name,
      transformed: view.activeCard.raidSuitTransformed,
      portrait: view.activeCard.battlePortraits?.normal || view.activeCard.battlePortraits?.idle || "",
    };
  });
  const beforeDom = await battle.evaluate(() => document.getElementById("playerPortrait")?.currentSrc || "");
  await host.screenshot({ path: path.join(OUTPUT_DIR, "01-before-transform-new-world-sanji.png") });

  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const intro = debug.getState().battleState.prebattleIntro;
    debug.battleMarkPrebattleIntroDone(intro?.id || "", intro?.key || "");
  });
  await battle.waitForFunction(() => document.getElementById("sanjiRaidSuitFx")?.classList.contains("show"), null, { timeout: 10000 });
  await battle.waitForTimeout(1600);
  const during = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const view = debug.getBattleView();
    return {
      eventType: debug.getState().battleState.visualEvent?.type || "",
      name: view.activeCard.name,
      transformed: view.activeCard.raidSuitTransformed,
      portrait: view.activeCard.battlePortraits?.normal || view.activeCard.battlePortraits?.idle || "",
    };
  });
  const duringDom = await battle.evaluate(() => document.getElementById("playerPortrait")?.currentSrc || "");
  await host.screenshot({ path: path.join(OUTPUT_DIR, "02-during-transform-main-card-still-new-world.png") });

  await host.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const view = debug.getBattleView();
    return !debug.getState().battleState.visualEvent && view?.activeCard?.raidSuitTransformed;
  }, null, { timeout: 12000 });
  await battle.waitForTimeout(250);
  const after = await host.evaluate(() => {
    const view = window.__BOARD_GAME_DEBUG__.getBattleView();
    return {
      name: view.activeCard.name,
      transformed: view.activeCard.raidSuitTransformed,
      portrait: view.activeCard.battlePortraits?.normal || view.activeCard.battlePortraits?.idle || "",
    };
  });
  const afterDom = await battle.evaluate(() => document.getElementById("playerPortrait")?.currentSrc || "");
  await host.screenshot({ path: path.join(OUTPUT_DIR, "03-after-transform-normal-stealth-black.png") });

  const statBalance = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battleState = state.battleState;
    const player = state.gameState.players[0];
    const formState = Object.values(battleState.sanjiRaidSuitState?.players?.[player.id]?.forms || {})[0];
    if (!formState) throw new Error("Missing Sanji raid suit form state");
    const stats = () => Object.fromEntries(["atk", "def", "satk", "sdef", "spd"].map((stat) => [stat, debug.currentBattleStat("player", stat, player, battleState)]));
    formState.transformed = true;
    const transformed = stats();
    const transformedText = debug.getBattleView()?.activeCard?.passiveText || "";
    formState.transformed = false;
    const newWorld = stats();
    formState.transformed = true;
    debug.notifyBattleWindow();
    return { newWorld, transformed, transformedText };
  });

  const attackSetup = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battleState = state.battleState;
    const player = state.gameState.players[0];
    const enemyMove = (battleState.enemyCombatant?.moveSet || []).find((move) => Number(move.power || 0) > 0);
    const view = debug.getBattleView();
    const playerMove = (view?.moves || view?.activeCard?.moves || []).find((move) => Number(move.currentPP ?? move.pp ?? 0) > 0);
    if (!enemyMove || !playerMove) throw new Error(`Missing direct move for stealth MISS QA ${JSON.stringify({ enemyMoves: battleState.enemyCombatant?.moveSet, viewKeys: Object.keys(view || {}), activeKeys: Object.keys(view?.activeCard || {}) })}`);
    battleState.enemyCombatant.moveSet = [enemyMove];
    battleState.enemyCombatant.baseStats ||= {};
    battleState.enemyCombatant.baseStats.spd = 9999;
    enemyMove.effects ||= {};
    enemyMove.effects.priority = 99;
    const beforeHp = Number(player.crew?.[battleState.activeCrewIndex]?.currentHp || 0);
    debug.battleChooseMove(playerMove.id);
    return { enemyMoveId: enemyMove.id, playerMoveId: playerMove.id, beforeHp };
  });

  await host.waitForFunction(() => {
    const event = window.__BOARD_GAME_DEBUG__?.getState()?.battleState?.visualEvent;
    return event?.type === "attack" && event?.side === "enemy" && event?.raidSuitStealth === true;
  }, null, { timeout: 35000 });
  const stealthMissEvent = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battleState = state.battleState;
    const player = state.gameState.players[0];
    const event = battleState.visualEvent;
    const formState = Object.values(battleState.sanjiRaidSuitState?.players?.[player.id]?.forms || {})[0];
    return {
      type: event?.type || "",
      side: event?.side || "",
      miss: !!event?.miss,
      raidSuitStealth: !!event?.raidSuitStealth,
      currentHp: Number(player.crew?.[battleState.activeCrewIndex]?.currentHp || 0),
      stealthReady: !!formState?.stealthReady,
    };
  });
  await battle.waitForFunction(() => /sanji_stealth_black\/stealth\.webp/i.test(document.getElementById("playerPortrait")?.currentSrc || ""), null, { timeout: 5000 });
  const stealthMissDom = await battle.evaluate(() => document.getElementById("playerPortrait")?.currentSrc || "");
  await host.screenshot({ path: path.join(OUTPUT_DIR, "04-enemy-miss-shows-stealth.png") });
  await battle.waitForFunction(() => /sanji_stealth_black\/normal\.webp/i.test(document.getElementById("playerPortrait")?.currentSrc || ""), null, { timeout: 5000 });
  const restoredDom = await battle.evaluate(() => document.getElementById("playerPortrait")?.currentSrc || "");

  await host.waitForFunction(() => !window.__BOARD_GAME_DEBUG__?.getState()?.battleState?.animating, null, { timeout: 45000 });

  await host.setViewportSize({ width: 932, height: 430 });
  await battle.waitForTimeout(250);
  const phone = await battle.evaluate(() => {
    const portrait = document.getElementById("playerPortrait");
    const rect = portrait?.getBoundingClientRect();
    return {
      portrait: portrait?.currentSrc || "",
      portraitInViewport: !!rect && rect.left >= -2 && rect.top >= -2 && rect.right <= innerWidth + 2 && rect.bottom <= innerHeight + 2,
      overflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
  await host.screenshot({ path: path.join(OUTPUT_DIR, "05-after-stealth-miss-phone-932x430.png") });

  const isNewWorldPortrait = (value) => /sanji_evolution_2\/(?:normal|idle)\.webp/i.test(value);
  const isStealthBlackNormalPortrait = (value) => /sanji_stealth_black\/normal\.webp/i.test(value);
  const isStealthBlackStealthPortrait = (value) => /sanji_stealth_black\/stealth\.webp/i.test(value);
  if (!queued.logicalTransformed || !queued.queueTypes.includes("sanji-raid-suit-transform")) failures.push(`transform not queued ${JSON.stringify(queued)}`);
  if (queued.displayed.transformed || !isNewWorldPortrait(queued.displayed.portrait)) failures.push(`queued display switched early ${JSON.stringify(queued.displayed)}`);
  if (before.transformed || !isNewWorldPortrait(before.portrait) || !isNewWorldPortrait(beforeDom)) failures.push(`before display ${JSON.stringify({ before, beforeDom })}`);
  if (during.eventType !== "sanji-raid-suit-transform" || during.transformed || !isNewWorldPortrait(during.portrait) || !isNewWorldPortrait(duringDom)) failures.push(`during display ${JSON.stringify({ during, duringDom })}`);
  if (!after.transformed || !isStealthBlackNormalPortrait(after.portrait) || !isStealthBlackNormalPortrait(afterDom)) failures.push(`after display ${JSON.stringify({ after, afterDom })}`);
  if (statBalance.transformed.atk !== statBalance.newWorld.atk || statBalance.transformed.satk !== statBalance.newWorld.satk) failures.push(`raid suit still raises offense ${JSON.stringify(statBalance)}`);
  if (statBalance.transformed.def <= statBalance.newWorld.def || statBalance.transformed.sdef <= statBalance.newWorld.sdef || statBalance.transformed.spd <= statBalance.newWorld.spd) failures.push(`raid suit defensive identity missing ${JSON.stringify(statBalance)}`);
  if (/攻擊\+20%|戰術\+10%/.test(statBalance.transformedText) || !/不額外提高攻擊與戰術/.test(statBalance.transformedText)) failures.push(`raid suit passive text mismatch ${statBalance.transformedText}`);
  if (!stealthMissEvent.miss || !stealthMissEvent.raidSuitStealth || stealthMissEvent.stealthReady || stealthMissEvent.currentHp !== attackSetup.beforeHp) failures.push(`stealth miss authority ${JSON.stringify({ attackSetup, stealthMissEvent })}`);
  if (!isStealthBlackStealthPortrait(stealthMissDom) || !isStealthBlackNormalPortrait(restoredDom)) failures.push(`stealth miss display ${JSON.stringify({ stealthMissDom, restoredDom })}`);
  if (!isStealthBlackNormalPortrait(phone.portrait) || !phone.portraitInViewport || phone.overflow) failures.push(`phone display ${JSON.stringify(phone)}`);
  if (errors.length) failures.push(...errors);

  const report = { queued, before, beforeDom, during, duringDom, after, afterDom, statBalance, attackSetup, stealthMissEvent, stealthMissDom, restoredDom, phone, errors, failures, outputDir: OUTPUT_DIR };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  qaBrowser = null;
  if (failures.length) process.exitCode = 1;
})().catch(async (error) => {
  console.error(error);
  await qaBrowser?.close?.();
  process.exitCode = 1;
});
