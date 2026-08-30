const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("tmp/tot-musica-counterattack-qa");
const VIEWPORT_WIDTH = Math.max(320, Number(process.env.BOARD_QA_WIDTH || 1440));
const VIEWPORT_HEIGHT = Math.max(320, Number(process.env.BOARD_QA_HEIGHT || 900));

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, timeout: 15000 });
  const context = await browser.newContext({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(20000);
  const errors = [];
  const failures = [];
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?tot_counterattack_qa=1`, { waitUntil: "commit", timeout: 15000 });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 20000 });
  const setup = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.crew.forEach((card) => {
      card.baseStats ||= {};
      card.baseStats.hp = 5000;
      card.baseStats.spd = 999;
      card.currentHp = 5000;
      (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(5, Number(move.pp || move.currentPP || 5)); });
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    runtime.battleState = null;
    if (!runtime.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "tot-counterattack-qa" });
    debug.ensurePostgameWorldLayout(runtime.gameState);
    const assignment = runtime.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_tot_musica");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.enemyCombatant.baseStats ||= {};
    battle.enemyCombatant.baseStats.spd = 1;
    battle.enemyCombatant.spd = 1;
    const mechanic = battle.postgameBossMechanic;
    const confirmed = debug.battleTotTeamSetup(mechanic.realIndices, mechanic.songIndices);
    battle.result = "replacement";
    battle.needsReplacement = true;
    battle.replacementAfterAction = true;
    battle.enemyAction = null;
    const guardAccepted = debug.postgameBossMechanicQa.totPrepareCounterattack(player, battle, mechanic);
    const guard = {
      accepted: guardAccepted,
      result: battle.result || "",
      needsReplacement: !!battle.needsReplacement,
      replacementAfterAction: !!battle.replacementAfterAction,
      enemyAction: battle.enemyAction ? { ...battle.enemyAction } : null,
    };
    battle.enemyCombatant.statuses ||= {};
    battle.enemyCombatant.statuses.freeze = 1;
    const pickMove = (index) => (player.crew[index].moveSet || []).find((move) => ["attack", "special"].includes(move.category || move.type) && Number(move.power || 0) > 0 && Number(move.currentPP ?? move.pp ?? 0) > 0)?.id;
    return {
      confirmed,
      guard,
      realMove: pickMove(mechanic.realActiveIndex),
      songMove: pickMove(mechanic.songActiveIndex),
      hpBefore: mechanic.realIndices.concat(mechanic.songIndices).map((index) => player.crew[index].currentHp),
    };
  });
  if (!setup.confirmed || !setup.realMove || !setup.songMove || !setup.guard.accepted || setup.guard.result || setup.guard.needsReplacement || setup.guard.replacementAfterAction || setup.guard.enemyAction?.type !== "move") failures.push(`setup: ${JSON.stringify(setup)}`);

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?tot_counterattack_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded", { timeout: 15000 });
  await battlePage.waitForFunction(() => document.getElementById("battleStage")?.classList.contains("tot-musica-battle-mode"));

  const accepted = await host.evaluate(({ realMove, songMove }) => window.__BOARD_GAME_DEBUG__.battleTotDualAction(
    { type: "move", moveId: realMove },
    { type: "move", moveId: songMove },
  ), setup);
  if (!accepted) failures.push("dual action was rejected");

  await battlePage.waitForFunction(() => /因.+無法攻擊/.test(document.getElementById("totMusicaDualResult")?.textContent || ""), null, { timeout: 30000 });
  const blockedVisual = await battlePage.evaluate(() => ({
    text: document.getElementById("totMusicaDualResult")?.textContent || "",
    realText: document.getElementById("totMusicaRealMove")?.textContent || "",
    songText: document.getElementById("totMusicaSongMove")?.textContent || "",
    bossVisible: Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
    dedicated: document.getElementById("battleStage")?.classList.contains("tot-musica-battle-mode"),
    resultOverflow: (() => {
      const node = document.getElementById("totMusicaDualResult");
      return !!node && (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
    })(),
    pageOverflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
  }));
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "tot-musica-blocked-counterattack.png") });
  const runtimeDuringBlock = await host.evaluate(() => {
    const runtime = window.__BOARD_GAME_DEBUG__.getState();
    const player = runtime.gameState.players[0];
    const battle = runtime.battleState;
    const mechanic = battle.postgameBossMechanic;
    return {
      eventType: battle.visualEvent?.type || "",
      blocked: !!battle.visualEvent?.blocked,
      blockedReason: battle.visualEvent?.blockedReason || "",
      playerPerformedAction: !!battle.playerPerformedAction,
      enemyPerformedAction: !!battle.enemyPerformedAction,
      result: battle.result || "",
      needsReplacement: !!battle.needsReplacement,
      hpAfter: mechanic.realIndices.concat(mechanic.songIndices).map((index) => player.crew[index].currentHp),
      log: (battle.log || []).slice(-6),
    };
  });
  await battlePage.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("selection-preview"), null, { timeout: 12000 });
  const nextRound = await host.evaluate(() => {
    const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
    return { roundIndex: battle.roundIndex, result: battle.result || "", canAct: !battle.animating && !battle.roundResolved && !battle.result };
  });

  if (!blockedVisual.dedicated || !blockedVisual.bossVisible || !/冰凍/.test(blockedVisual.text) || !/未受攻擊/.test(blockedVisual.realText) || !/未受攻擊/.test(blockedVisual.songText) || blockedVisual.resultOverflow || blockedVisual.pageOverflowX) failures.push(`blocked visual: ${JSON.stringify(blockedVisual)}`);
  if (runtimeDuringBlock.eventType !== "tot-musica-enemy-dual-strike" || !runtimeDuringBlock.blocked || runtimeDuringBlock.blockedReason !== "冰凍" || !runtimeDuringBlock.playerPerformedAction || !runtimeDuringBlock.enemyPerformedAction || runtimeDuringBlock.result || runtimeDuringBlock.needsReplacement || JSON.stringify(runtimeDuringBlock.hpAfter) !== JSON.stringify(setup.hpBefore)) failures.push(`blocked runtime: ${JSON.stringify(runtimeDuringBlock)}`);
  if (nextRound.roundIndex < 2 || nextRound.result || !nextRound.canAct) failures.push(`next round: ${JSON.stringify(nextRound)}`);
  if (errors.length) failures.push(...errors);

  const report = { setup, accepted, blockedVisual, runtimeDuringBlock, nextRound, errors, failures, outputDir: OUTPUT_DIR };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
