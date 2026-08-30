const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function openBoard(browser, label, errors, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  captureErrors(page, errors, label);
  const onlineQuery = options.online ? "&online=1&room=CPUQA" : "";
  await page.goto(`${ROOT_URL}/board_game.html?cpu_post_coop_choice_qa=${label}${onlineQuery}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postBattleIslandChoiceQa && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  return { context, page };
}

async function prepareChoice(page, options = {}) {
  return page.evaluate((setup) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    const island = game.boardData.islands.find((entry) => entry.kind === "enemy");
    if (!player || !island) throw new Error("CPU post-coop QA setup missing player or enemy island");
    const islandState = debug.getIslandState(island.id);
    game.players.length = 1;
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.pendingMove = null;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.routePrompt = null;
    game.tradePrompt = null;
    game.activeTrade = null;
    game.coopBattlePrompt = null;
    game.islandDecision = null;
    game.resolutionLock = false;
    game.turnStep = "擲骰前進";
    state.battleState = null;
    const modalBack = document.getElementById("boardModalBack");
    const modal = document.getElementById("boardModal");
    modalBack?.classList.remove("open");
    if (modalBack) {
      delete modalBack.dataset.forceChoice;
      delete modalBack.dataset.backdropClose;
    }
    if (modal) modal.innerHTML = "";
    player.isCpu = setup.cpu !== false;
    player.isCPU = setup.cpu !== false;
    player.cpu = setup.cpu !== false;
    player.isMe = setup.cpu === false;
    if (setup.onlineHost && state.lobby) {
      state.lobby.hostUserId = Number(player.userId || player.id);
      state.lobby.hostName = player.name;
      player.isHost = true;
    }
    player.location = { kind: "island", islandId: island.id };
    player.pendingBattle = null;
    player.pendingIslandServiceChoice = null;
    player.coins = Math.max(0, Number(setup.coins ?? 0));
    player.crew = window.BoardCards.cards.slice(0, Math.max(2, Number(setup.crewCount || 3))).map((card) => debug.cloneCard(card));
    player.activeCrewIndex = 0;
    player.crew.forEach((card) => {
      const maxHp = debug.cardMaxHp(card);
      card.currentHp = Math.max(1, Math.round(maxHp * Number(setup.hpRatio ?? 1)));
    });
    debug.recalcPlayerDerivedStats(player);
    islandState.currentKind = setup.kind;
    islandState.temporaryServiceKind = setup.kind;
    islandState.isDefeated = true;
    islandState.currentHp = 0;
    islandState.temporaryServiceStartedRound = Math.max(1, Number(game.round || 1));
    islandState.temporaryServiceExpiresAtRound = islandState.temporaryServiceStartedRound + 3;
    if (setup.kind === "shop") {
      islandState.shopStock = [];
      islandState.shopStockUnlockStage = "";
    }
    debug.postBattleIslandChoiceQa.mark(player, island, setup.kind, {
      islandId: island.id,
      enemyCombatant: { key: "cpu-post-coop-qa" },
    });
    if (setup.locked) {
      game.resolutionLock = true;
      game.turnStep = `${island.name}：進島或出發`;
    }
    debug.renderAll();
    const action = debug.postBattleIslandChoiceQa.action(player);
    return {
      playerId: String(player.id),
      islandId: island.id,
      actionKind: action?.kind || "",
      shouldEnter: debug.postBattleIslandChoiceQa.shouldEnter(action),
      ownsLock: debug.postBattleIslandChoiceQa.ownsLock(),
    };
  }, options);
}

async function runCpuCase(browser, label, options, errors) {
  const { context, page } = await openBoard(browser, label, errors, { online: options.onlineHost });
  const prepared = await prepareChoice(page, { ...options, cpu: true, locked: true });
  const result = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getCurrentPlayer();
    const message = debug.postBattleIslandChoiceQa.handleCpu();
    const state = debug.getState();
    return {
      message,
      pending: Boolean(player.pendingIslandServiceChoice),
      resolutionLock: state.gameState.resolutionLock,
      ownsLock: debug.postBattleIslandChoiceQa.ownsLock(),
      choiceModalVisible: Boolean(document.querySelector(".island-service-choice-ui")),
      serviceModalVisible: Boolean(document.querySelector(".hospital-nautical-modal, .shop-modal, .tavern-nautical-modal")),
      diceRolling: Boolean(state.gameState.diceRolling),
      turnStep: state.gameState.turnStep,
    };
  });
  await context.close();
  return { label, prepared, result };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const cases = [];
  cases.push(await runCpuCase(browser, "hospital_damaged_enter", {
    kind: "hospital",
    hpRatio: 0.35,
    coins: 5000,
  }, errors));
  cases.push(await runCpuCase(browser, "hospital_healthy_roll", {
    kind: "hospital",
    hpRatio: 1,
    coins: 0,
  }, errors));
  cases.push(await runCpuCase(browser, "tavern_recruit_enter", {
    kind: "tavern",
    hpRatio: 1,
    crewCount: 2,
    coins: 99999,
  }, errors));
  cases.push(await runCpuCase(browser, "shop_empty_roll", {
    kind: "shop",
    hpRatio: 1,
    coins: 0,
  }, errors));
  cases.push(await runCpuCase(browser, "online_host_hospital_enter", {
    kind: "hospital",
    hpRatio: 0.35,
    coins: 5000,
    onlineHost: true,
  }, errors));

  const human = await openBoard(browser, "human_refresh_reopen", errors);
  const humanPrepared = await prepareChoice(human.page, {
    kind: "hospital",
    hpRatio: 0.5,
    coins: 5000,
    cpu: false,
    locked: true,
  });
  const humanReopen = await human.page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const opened = debug.postBattleIslandChoiceQa.open(debug.getCurrentPlayer());
    return {
      opened,
      visible: Boolean(document.querySelector(".island-service-choice-ui")),
      enterButton: Boolean(document.getElementById("enterPostBattleIslandBtn")),
      rollButton: Boolean(document.getElementById("rollFromPostBattleIslandBtn")),
      ownsLock: debug.postBattleIslandChoiceQa.ownsLock(),
    };
  });
  await human.context.close();

  const stale = await openBoard(browser, "stale_location_cleanup", errors);
  await prepareChoice(stale.page, {
    kind: "hospital",
    hpRatio: 0.5,
    coins: 5000,
    cpu: true,
    locked: true,
  });
  const staleCleanup = await stale.page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getCurrentPlayer();
    player.location = { kind: "sea", routeId: "qa-route", tileIndex: 0 };
    const action = debug.postBattleIslandChoiceQa.action(player);
    return {
      action: action || null,
      pending: Boolean(player.pendingIslandServiceChoice),
      resolutionLock: debug.getState().gameState.resolutionLock,
      turnStep: debug.getState().gameState.turnStep,
    };
  });
  await stale.context.close();

  const loki = await openBoard(browser, "loki_force_choice", errors);
  const lokiResult = await loki.page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    game.players.length = 1;
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.resolutionLock = false;
    state.battleState = null;
    player.isCpu = true;
    player.isCPU = true;
    player.cpu = true;
    player.crew = window.BoardCards.cards.slice(0, 3).map((card) => debug.cloneCard(card));
    player.activeCrewIndex = 0;
    player.crew.forEach((card) => { card.currentHp = debug.cardMaxHp(card); });
    debug.recalcPlayerDerivedStats(player);
    if (!game.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "cpu-deadlock-loki-qa" });
    debug.ensurePostgameWorldLayout(game);
    const island = debug.getElbaphIsland?.() || game.boardData.islands.find((entry) => entry.kind === "final") || game.boardData.islands[0];
    document.getElementById("boardModalBack")?.classList.remove("open");
    debug.cpuDeadlockQa.openElbaphLokiTrialModal(player, island);
    const promptVisible = Boolean(document.getElementById("elbaphLokiChallengeBtn"));
    const message = debug.cpuDeadlockQa.handleVisibleOverlay();
    return {
      promptVisible,
      message,
      battleStarted: Boolean(state.battleState),
      islandKind: state.battleState?.islandKind || "",
      modalStillOpen: document.getElementById("boardModalBack")?.classList.contains("open") || false,
    };
  });
  await loki.context.close();
  await browser.close();

  const failures = [];
  const byLabel = Object.fromEntries(cases.map((entry) => [entry.label, entry]));
  if (!byLabel.hospital_damaged_enter.prepared.shouldEnter) failures.push("damaged hospital CPU did not choose enter");
  if (!byLabel.hospital_damaged_enter.result.serviceModalVisible) failures.push("damaged hospital CPU did not open hospital service");
  if (byLabel.hospital_healthy_roll.prepared.shouldEnter) failures.push("healthy hospital CPU did not choose roll");
  if (!byLabel.hospital_healthy_roll.result.diceRolling) failures.push("healthy hospital CPU did not start dice roll");
  if (!byLabel.tavern_recruit_enter.prepared.shouldEnter || !byLabel.tavern_recruit_enter.result.serviceModalVisible) failures.push("tavern CPU did not enter useful service");
  if (byLabel.shop_empty_roll.prepared.shouldEnter || !byLabel.shop_empty_roll.result.diceRolling) failures.push("empty-wallet shop CPU did not roll onward");
  if (!byLabel.online_host_hospital_enter.prepared.shouldEnter || !byLabel.online_host_hospital_enter.result.serviceModalVisible) {
    failures.push("online host did not drive CPU post-coop island choice");
  }
  cases.forEach((entry) => {
    if (entry.result.pending) failures.push(`${entry.label}: pending choice remained`);
    if (entry.result.ownsLock) failures.push(`${entry.label}: post-coop choice lock remained`);
    if (entry.result.choiceModalVisible) failures.push(`${entry.label}: choice modal remained visible`);
  });
  if (!humanPrepared.ownsLock || !humanReopen.opened || !humanReopen.visible || !humanReopen.enterButton || !humanReopen.rollButton) {
    failures.push("human refresh did not restore the forced choice modal");
  }
  if (staleCleanup.action || staleCleanup.pending || staleCleanup.resolutionLock || staleCleanup.turnStep !== "擲骰前進") {
    failures.push("stale moved-away choice did not clear its own lock");
  }
  if (!lokiResult.promptVisible || !lokiResult.battleStarted || lokiResult.islandKind !== "elbaph_loki_trial" || lokiResult.modalStillOpen) {
    failures.push("CPU did not resolve the Elbaph Loki force-choice prompt");
  }
  if (errors.length) failures.push(...errors);

  const report = { cases, human: { prepared: humanPrepared, reopen: humanReopen }, staleCleanup, lokiResult, errors, failures };
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
