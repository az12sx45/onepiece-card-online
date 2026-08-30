const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("tmp/coop_deferred_result_turn_qa");

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareCoopVictory(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const game = runtime.gameState;
    const cards = window.BoardCards.cards;
    const owner = game.players[0];
    owner.name = "目前回合船長";
    owner.isCPU = false;
    owner.pendingBattle = null;
    owner.pendingCoopBattleResults = [];
    owner.crew = cards.slice(0, 6).map((card) => debug.cloneCard(card));
    owner.activeCrewIndex = 0;
    owner.crew.forEach((card) => { card.currentHp = Math.max(1, Number(card.baseStats?.hp || card.hp || 500)); });

    while (game.players.length < 3) {
      const index = game.players.length;
      const participant = JSON.parse(JSON.stringify(owner));
      participant.id = `coop-result-qa-${index + 1}`;
      participant.userId = 984000 + index;
      participant.clientId = `coop-result-client-${index + 1}`;
      participant.name = index === 1 ? "第二位船長" : "第三位船長";
      participant.isMe = false;
      participant.pendingBattle = null;
      participant.pendingCoopBattleResults = [];
      participant.crew = cards.slice(index * 6, index * 6 + 6).map((card) => debug.cloneCard(card));
      participant.activeCrewIndex = 0;
      participant.crew.forEach((card) => { card.currentHp = Math.max(1, Number(card.baseStats?.hp || card.hp || 500)); });
      game.players.push(participant);
    }
    game.players.length = 3;
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.pendingMove = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    runtime.battleState = null;

    if (!game.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(owner, { id: "coop-result-own-turn-qa" });
    debug.ensurePostgameWorldLayout(game);
    game.players.forEach((player) => {
      debug.grantFormalItemToPlayer(player, "lineage_extractor_standard", 2, { reveal: false });
    });
    const assignment = game.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_shiki")
      || game.postgameWorld.islandAssignments[0];
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(island.id);
    islandState.isDefeated = false;
    islandState.currentHp = Math.max(1, Number(islandState.maxHp || islandState.enemyProfile?.maxHp || 100));
    game.players.forEach((player) => {
      player.location = { kind: "island", islandId: island.id, entryDirection: null };
    });
    debug.startBattle(owner, island, islandState);

    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualAnimating = false;
    battle.animating = false;
    battle.roundResolved = true;
    battle.waitingResume = false;
    battle.result = "win";
    battle.enemyCombatant.currentHp = 0;
    battle.coop = {
      enabled: true,
      participantIds: game.players.map((player) => String(player.id)),
      actions: {},
      runtimes: {},
      defeated: {},
      contributions: {},
      roundStartedAt: Date.now(),
    };
    game.players.forEach((player) => debug.getBattleView({ coopViewPlayerId: player.id }));
    battle.playerId = game.players[1].id;
    debug.ensureLineageExtractionOpportunity(battle);
    debug.renderAll();
    debug.notifyBattleWindow();
    const view = debug.getBattleView({ coopViewPlayerId: game.players[2].id });
    return {
      playerIds: game.players.map((player) => String(player.id)),
      viewPlayerId: String(view.player.id),
      viewCanControl: view.battle.canControl,
      extractionPlayerId: String(view.battle.lineageExtraction?.playerId || ""),
      statuses: Object.fromEntries(Object.entries(battle.lineageExtraction.entries).map(([id, entry]) => [id, entry.status])),
    };
  });
}

async function dismissImportantItemReveals(host) {
  for (let index = 0; index < 60; index += 1) {
    const visible = await host.locator("#itemRevealContinue").isVisible().catch(() => false);
    if (visible) await host.evaluate(() => document.getElementById("itemRevealContinue")?.click());
    await host.waitForTimeout(150);
  }
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  const errors = [];
  const failures = [];
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?coop_deferred_result_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });

  const setup = await prepareCoopVictory(host);
  const ownerDeclined = await host.evaluate(({ ownerId }) => window.__BOARD_GAME_DEBUG__.battleDeclineLineageExtraction(ownerId), { ownerId: setup.playerIds[0] });
  const beforeFinish = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    return {
      ready: debug.coopDeferredResultQa.ready(state.battleState),
      resultPlayerId: String(debug.coopDeferredResultQa.resultPlayer(state.battleState)?.id || ""),
      queueCounts: state.gameState.players.map((player) => debug.coopDeferredResultQa.normalize(player).length),
    };
  });
  await host.evaluate(() => window.__BOARD_GAME_DEBUG__.battleFinish());
  await dismissImportantItemReveals(host);
  await host.waitForFunction(({ secondId }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    return String(debug.getCurrentPlayer()?.id || "") === secondId
      && String(state.battleState?.deferredCoopResult?.playerId || "") === secondId;
  }, { secondId: setup.playerIds[1] }, { timeout: 15000 });

  const deferredOpen = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = debug.getCurrentPlayer();
    const view = debug.getBattleView();
    return {
      currentPlayerId: String(player.id),
      viewPlayerId: String(view.player.id),
      deferredPlayerId: String(view.battle.deferredCoopResult?.playerId || ""),
      canControl: view.battle.canControl,
      canControlExtraction: view.battle.lineageExtraction?.canControl,
      extractionStatus: view.battle.lineageExtraction?.entry?.status || "",
      queueCounts: state.gameState.players.map((entry) => debug.coopDeferredResultQa.normalize(entry).length),
      coins: Number(player.coins || 0),
    };
  });

  const wrongTurnLock = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const savedIndex = state.gameState.currentPlayerIndex;
    state.gameState.currentPlayerIndex = 0;
    const view = debug.getBattleView();
    const result = {
      canControl: view.battle.canControl,
      canControlExtraction: view.battle.lineageExtraction?.canControl,
      viewPlayerId: String(view.player.id),
      currentPlayerId: String(debug.getCurrentPlayer()?.id || ""),
    };
    state.gameState.currentPlayerIndex = savedIndex;
    return result;
  });

  const secondDeclined = await host.evaluate(({ secondId }) => window.__BOARD_GAME_DEBUG__.battleDeclineLineageExtraction(secondId), { secondId: setup.playerIds[1] });
  const battleFrame = host.frameLocator("#battlePageOverlay iframe");
  await battleFrame.locator("[data-finish-battle]").waitFor({ state: "visible", timeout: 8000 });
  const finishLabel = (await battleFrame.locator("[data-finish-battle]").textContent()).trim();
  await battleFrame.locator("body").screenshot({ path: path.join(OUTPUT_DIR, "deferred_result_own_turn.png") });
  const coinsBeforeDeferredFinish = deferredOpen.coins;
  await host.evaluate(() => window.__BOARD_GAME_DEBUG__.battleFinish());
  await host.waitForFunction(({ secondId }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    return !debug.getState().battleState && String(debug.getCurrentPlayer()?.id || "") === secondId;
  }, { secondId: setup.playerIds[1] }, { timeout: 8000 });
  const afterDeferredFinish = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = debug.getCurrentPlayer();
    return {
      currentPlayerId: String(player.id),
      turnStep: state.gameState.turnStep,
      battleOpen: !!state.battleState,
      ownQueueCount: debug.coopDeferredResultQa.normalize(player).length,
      thirdQueueCount: debug.coopDeferredResultQa.normalize(state.gameState.players[2]).length,
      coins: Number(player.coins || 0),
    };
  });

  if (setup.viewPlayerId !== setup.playerIds[0] || setup.extractionPlayerId !== setup.playerIds[0] || !setup.viewCanControl) failures.push("original-result-not-owned-by-current-turn-player");
  if (!ownerDeclined || !beforeFinish.ready || beforeFinish.resultPlayerId !== setup.playerIds[0]) failures.push("current-owner-could-not-resolve-before-finish");
  if (beforeFinish.queueCounts.some((count) => count !== 0)) failures.push("queue-created-before-battle-finish");
  if (deferredOpen.currentPlayerId !== setup.playerIds[1] || deferredOpen.viewPlayerId !== setup.playerIds[1] || deferredOpen.deferredPlayerId !== setup.playerIds[1]) failures.push("second-player-result-not-opened-on-own-turn");
  if (!deferredOpen.canControl || !deferredOpen.canControlExtraction || deferredOpen.extractionStatus !== "offered") failures.push("second-player-own-turn-controls-not-enabled");
  if (deferredOpen.queueCounts[0] !== 0 || deferredOpen.queueCounts[1] !== 1 || deferredOpen.queueCounts[2] !== 1) failures.push("deferred-queues-not-split-per-player");
  if (wrongTurnLock.canControl || wrongTurnLock.canControlExtraction || wrongTurnLock.viewPlayerId !== setup.playerIds[1]) failures.push("deferred-result-usable-outside-own-turn");
  if (!secondDeclined || !/繼續本回合/.test(finishLabel)) failures.push("deferred-result-finish-ui-missing");
  if (afterDeferredFinish.currentPlayerId !== setup.playerIds[1] || afterDeferredFinish.battleOpen || afterDeferredFinish.ownQueueCount !== 0 || afterDeferredFinish.thirdQueueCount !== 1) failures.push("deferred-result-finish-did-not-preserve-turn-or-next-queue");
  if (afterDeferredFinish.coins !== coinsBeforeDeferredFinish) failures.push("deferred-result-finish-granted-rewards-twice");

  const report = {
    setup,
    ownerDeclined,
    beforeFinish,
    deferredOpen,
    wrongTurnLock,
    secondDeclined,
    finishLabel,
    afterDeferredFinish,
    errors,
    failures,
    outputDir: OUTPUT_DIR,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
