const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
}

async function prepareKatakuriBattle(host, { waitForChoice = true, skipIntro = true } = {}) {
  await host.evaluate(({ skipIntro }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.players = [player];
    state.gameState.currentPlayerIndex = 0;
    player.isCPU = false;
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.crew.forEach((card) => {
      card.currentHp = Math.max(1, Number(card.maxHp || card.stats?.hp || card.baseStats?.hp || 999));
      card.battleCarryItem = null;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "katakuri-future-sight-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_charlotte_katakuri");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = state.battleState;
    battle.entryTransition = null;
    if (skipIntro) {
      battle.prebattleIntro = null;
      battle.prebattleIntroDone = true;
    }
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    if (battle.coop) battle.coop.enabled = false;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
  }, { skipIntro });
  if (waitForChoice) {
    await host.waitForFunction(() => {
      const mechanic = window.__BOARD_GAME_DEBUG__?.getState()?.battleState?.postgameBossMechanic;
      return mechanic?.key === "postgame_charlotte_katakuri" && mechanic.choicePending && mechanic.forecastDie >= 1;
    }, null, { timeout: 15000 });
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: "reduce" });
  const errors = [];
  const failures = [];
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?katakuri_future_sight_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });

  await prepareKatakuriBattle(host, { waitForChoice: false, skipIntro: false });
  const battleFrame = host.frameLocator("#battlePageOverlay iframe");
  await battleFrame.locator("#prebattleDialogue.is-open").waitFor({ state: "visible", timeout: 10000 });
  const introGateUi = await host.evaluate(() => {
    const battle = window.__BOARD_GAME_DEBUG__?.getState()?.battleState;
    return {
      introPending: !!battle?.prebattleIntro && !battle.prebattleIntro.done,
      forecastRolling: !!battle?.postgameBossMechanic?.forecastRolling,
      visualType: battle?.visualEvent?.type || "",
    };
  });
  await battleFrame.locator("#katakuriFutureSightCinematic:not([hidden])").waitFor({ state: "visible", timeout: 15000 });
  const cinematicUi = await battleFrame.locator("#katakuriFutureSightCinematic").evaluate((node) => ({
    visible: !node.hidden,
    title: document.getElementById("katakuriFutureSightTitle")?.textContent.trim() || "",
    videoSrc: document.getElementById("katakuriFutureSightVideo")?.getAttribute("src") || "",
  }));
  await battleFrame.locator("#diceBonusFx.active").waitFor({ state: "visible", timeout: 5000 });
  const forecastDiceUi = await battleFrame.locator("#diceBonusFx").evaluate((node) => ({
    visible: node.classList.contains("active"),
    cinematicHidden: document.getElementById("katakuriFutureSightCinematic")?.hidden ?? false,
    title: document.getElementById("diceBonusTitle")?.textContent.trim() || "",
    rolling: document.getElementById("diceBonusOrb")?.classList.contains("rolling") || false,
  }));
  await host.waitForFunction(() => {
    const mechanic = window.__BOARD_GAME_DEBUG__?.getState()?.battleState?.postgameBossMechanic;
    return mechanic?.key === "postgame_charlotte_katakuri" && mechanic.choicePending && mechanic.forecastDie >= 1;
  }, null, { timeout: 15000 });

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?katakuri_future_sight_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");
  await battlePage.waitForFunction(() => document.querySelectorAll("[data-katakuri-choice]").length === 2, null, { timeout: 10000 });
  const desktopUi = await battlePage.evaluate(() => ({
    permanentButtons: document.querySelectorAll("[data-mode]").length,
    temporaryChoices: [...document.querySelectorAll("[data-katakuri-choice]")].map((button) => button.textContent.trim()),
    promptText: document.getElementById("infoContent")?.textContent.trim() || "",
    overflow: document.documentElement.scrollWidth - window.innerWidth,
  }));
  await battlePage.setViewportSize({ width: 932, height: 430 });
  await battlePage.evaluate(() => window.__BOARD_BATTLE_DEBUG__?.fitBattleViewport?.());
  await battlePage.waitForTimeout(120);
  const mobileUi = await battlePage.evaluate(() => {
    const panel = document.querySelector("[data-layout-id='infoPanel']");
    const rect = panel?.getBoundingClientRect();
    return {
      temporaryChoices: document.querySelectorAll("[data-katakuri-choice]").length,
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      panelInside: !!rect && rect.left >= -1 && rect.right <= window.innerWidth + 1 && rect.top >= -1 && rect.bottom <= window.innerHeight + 1,
      panelRect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null,
      choiceRects: [...document.querySelectorAll("[data-katakuri-choice]")].map((button) => {
        const buttonRect = button.getBoundingClientRect();
        return { left: buttonRect.left, top: buttonRect.top, right: buttonRect.right, bottom: buttonRect.bottom, width: buttonRect.width, height: buttonRect.height };
      }),
    };
  });
  await battlePage.click("[data-katakuri-choice='move']");
  await host.waitForFunction(() => {
    const mechanic = window.__BOARD_GAME_DEBUG__?.getState()?.battleState?.postgameBossMechanic;
    return mechanic?.choiceMode === "move" && !mechanic.choicePending;
  }, null, { timeout: 5000 });
  await battlePage.waitForFunction(() => {
    const buttons = [...document.querySelectorAll("[data-mode]")];
    return buttons.length === 4 && buttons.every((button) => !button.disabled);
  }, null, { timeout: 5000 });
  const postChoiceUi = await battlePage.evaluate(() => ({
    actions: [...document.querySelectorAll("[data-mode]")].map((button) => ({
      mode: button.dataset.mode,
      label: button.textContent.trim(),
      disabled: button.disabled,
    })),
    panelHidden: document.querySelector("[data-layout-id='actionPanel']")?.classList.contains("is-hidden") ?? true,
    status: document.getElementById("statusMessage")?.textContent.trim() || "",
  }));

  const damageTable = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    const actionKey = qa.katakuriActionKey(player, battle);
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    return [1, 2, 3, 4, 5, 6].map((die) => {
      mechanic.defenseDie = die;
      mechanic.defenseReduction = die * .15;
      mechanic.defenseActionKey = actionKey;
      mechanic.defenseAppliedActionKey = "";
      const visualMeta = {};
      const damage = qa.applyDamageRules([1000], "enemy", move, 4, player, battle, {}, visualMeta).reduce((sum, value) => sum + value, 0);
      return { die, reduction: Math.round(mechanic.defenseReduction * 100), damage, visualMeta };
    });
  });

  await prepareKatakuriBattle(host);
  const failedMove = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    mechanic.forecastDie = 6;
    debug.battleNewItemQa.setParityEffect("player", battle, player, "odd", 1, "odd_dice");
    const move = player.crew[battle.activeCrewIndex].moveSet.find((entry) => Number(entry.currentPP ?? entry.pp ?? 0) > 0);
    const before = { pp: move.currentPP, enemyHp: battle.enemyCombatant.currentHp, moveId: move.id };
    const choiceAccepted = debug.battleKatakuriChoice("move");
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualAnimating = false;
    move.priority = 99;
    move.effects ||= {};
    move.effects.priority = 99;
    const moveAccepted = debug.battleChooseMove(move.id);
    return {
      ...before,
      choiceAccepted,
      moveAccepted,
      choiceMode: mechanic.choiceMode,
      promptPending: mechanic.choicePending,
      actionAfterQueue: battle.playerAction ? { ...battle.playerAction } : null,
      recentLog: battle.log.slice(-6),
    };
  });
  await host.waitForTimeout(18000);
  const failedMoveResult = await host.evaluate((before) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    const player = debug.getState().gameState.players[0];
    const move = player.crew[0].moveSet.find((entry) => entry.id === before.moveId);
    const log = battle.log.find((entry) => /整招失效但 PP 已消耗/.test(entry)) || "";
    const match = log.match(/第一骰\s+(\d+)/);
    return {
      ppSpent: Number(before.pp) - Number(move.currentPP),
      enemyHpUnchanged: Number(battle.enemyCombatant.currentHp) === Number(before.enemyHp),
      firstDie: Number(match?.[1] || 0),
      log,
      legacyFieldsRemoved: battle.postgameBossMechanic.calm === undefined
        && battle.postgameBossMechanic.predictions === undefined
        && battle.postgameBossMechanic.futureDisabledActions === undefined,
    };
  }, failedMove);

  const expectedDamages = [850, 700, 550, 400, 250, 100];
  if (!introGateUi.introPending || !introGateUi.forecastRolling || ["postgame-katakuri-future-sight", "dice"].includes(introGateUi.visualType)) failures.push(`prebattle intro gate ${JSON.stringify(introGateUi)}`);
  if (!cinematicUi.visible || !/預知未來/.test(cinematicUi.title) || !/videos\/board\/postgame_bosses\/katakuri\/future_sight_red_eyes\.mp4/.test(cinematicUi.videoSrc)) failures.push(`future-sight cinematic ${JSON.stringify(cinematicUi)}`);
  if (!forecastDiceUi.visible || !forecastDiceUi.cinematicHidden || !/預知/.test(forecastDiceUi.title) || !forecastDiceUi.rolling) failures.push(`forecast dice animation ${JSON.stringify(forecastDiceUi)}`);
  if (desktopUi.permanentButtons !== 4 || desktopUi.temporaryChoices.length !== 2) failures.push(`desktop buttons ${JSON.stringify(desktopUi)}`);
  if (!/正面出招/.test(desktopUi.promptText) || !/防禦/.test(desktopUi.promptText)) failures.push("desktop prompt copy missing");
  const mobileChoicesVisible = mobileUi.choiceRects.every((rect) => rect.width > 0 && rect.height > 0 && rect.left >= -1 && rect.right <= 933 && rect.top >= -1 && rect.bottom <= 431);
  if (desktopUi.overflow > 1 || mobileUi.overflow > 1 || !mobileChoicesVisible || mobileUi.temporaryChoices !== 2) failures.push(`responsive UI ${JSON.stringify(mobileUi)}`);
  const expectedModes = ["attack", "partners", "items", "escape"];
  if (postChoiceUi.panelHidden || postChoiceUi.actions.length !== 4 || postChoiceUi.actions.some((entry) => entry.disabled) || expectedModes.some((mode) => !postChoiceUi.actions.some((entry) => entry.mode === mode))) {
    failures.push(`normal action buttons ${JSON.stringify(postChoiceUi)}`);
  }
  damageTable.forEach((entry, index) => {
    if (entry.reduction !== (index + 1) * 15 || entry.damage !== expectedDamages[index] || !entry.visualMeta.katakuriDefenseActive) failures.push(`defense die ${index + 1}: ${JSON.stringify(entry)}`);
  });
  if (failedMoveResult.ppSpent !== 1 || !failedMoveResult.enemyHpUnchanged || ![1, 3, 5].includes(failedMoveResult.firstDie) || failedMoveResult.firstDie >= 6 || !failedMoveResult.legacyFieldsRemoved) {
    failures.push(`future sight failure setup=${JSON.stringify(failedMove)} result=${JSON.stringify(failedMoveResult)}`);
  }

  const report = { introGateUi, cinematicUi, forecastDiceUi, desktopUi, mobileUi, postChoiceUi, damageTable, failedMoveResult, errors, failures };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
