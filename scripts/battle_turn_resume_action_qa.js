const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8849";
const CHROME_PATH = process.env.BOARD_QA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.join(process.cwd(), ".codex", "qa", "battle_turn_resume_v458");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function captureErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
}

async function inspectActionGrid(page, viewport) {
  await page.setViewportSize(viewport);
  await page.waitForTimeout(180);
  const frame = page.frameLocator("#battlePageFrame");
  await frame.locator(".battle-action-grid .action-button").first().waitFor({ state: "visible", timeout: 10000 });
  return frame.locator(".battle-action-grid").evaluate((grid) => {
    const panel = grid.closest(".action-panel");
    const buttons = Array.from(grid.querySelectorAll(".action-button"));
    const panelRect = panel.getBoundingClientRect();
    const gridRect = grid.getBoundingClientRect();
    const rects = buttons.map((button) => {
      const rect = button.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    return {
      viewport: { width: innerWidth, height: innerHeight },
      panel: { left: panelRect.left, right: panelRect.right, width: panelRect.width },
      grid: { left: gridRect.left, right: gridRect.right, width: gridRect.width },
      rects,
      leftInset: rects[0].left - panelRect.left,
      rightInset: panelRect.right - rects[1].right,
      horizontalGap: rects[1].left - rects[0].right,
      verticalGap: rects[2].top - rects[0].bottom,
      overflow: rects.some((rect) => rect.left < panelRect.left - 1 || rect.right > panelRect.right + 1),
    };
  });
}

let browser;

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  const errors = [];
  captureErrors(page, errors);

  await page.goto(`${BASE_URL}/board_game.html?skipOpeningStory=1&battle_turn_resume_qa=1`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const seeded = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const owner = game.players[0];
    const sourceCard = window.BoardCards.cards.find((card) => String(card.id || "").includes("sanji")) || window.BoardCards.cards[0];
    const ownerCard = debug.cloneCard({ ...sourceCard, level: Math.max(24, Number(sourceCard.level || 1)) });
    ownerCard.currentHp = Math.max(1, Number(ownerCard.baseStats?.hp || ownerCard.hp || 100));
    ownerCard.carryItem = null;
    ownerCard.heldItem = null;
    owner.name = "續戰玩家";
    owner.isCPU = false;
    owner.isCpu = false;
    owner.cpu = false;
    owner.crew = [ownerCard];
    owner.activeCrewIndex = 0;
    owner.pendingBattle = null;

    const guest = JSON.parse(JSON.stringify(owner));
    guest.id = "battle-resume-guest";
    guest.userId = 958002;
    guest.clientId = "battle-resume-guest-client";
    guest.name = "下一位玩家";
    guest.isMe = false;
    guest.pendingBattle = null;
    guest.crew = [debug.cloneCard(window.BoardCards.cards.find((card) => card.id !== sourceCard.id) || window.BoardCards.cards[1])];
    guest.crew[0].currentHp = Math.max(1, Number(guest.crew[0].baseStats?.hp || guest.crew[0].hp || 100));
    guest.activeCrewIndex = 0;

    const enemyIslands = game.boardData.islands.filter((island) => island.kind === "enemy" && debug.getIslandState(island.id)?.enemyProfile);
    const island = enemyIslands[0];
    const otherIsland = enemyIslands.find((entry) => entry.id !== island.id) || game.boardData.islands.find((entry) => entry.id !== island.id);
    owner.location = { kind: "island", islandId: island.id };
    guest.location = otherIsland
      ? { kind: "island", islandId: otherIsland.id }
      : { kind: "sea", tileId: "battle-resume-guest-away" };
    game.players = [owner, guest];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.round = Math.max(2, Number(game.round || 1));
    game.pendingMove = null;
    game.routePrompt = null;
    game.tradePrompt = null;
    game.activeTrade = null;
    game.coopBattlePrompt = null;
    game.islandDecision = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    game.battleExitLock = false;
    state.battleState = null;

    const islandState = debug.getIslandState(island.id);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(owner, island, islandState);
    const battle = state.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualAnimating = false;
    battle.visualEvent = null;
    battle.animating = false;

    debug.getBattleView();
    const runtime = battle.coop?.runtimes?.[String(owner.id)];
    if (!runtime) throw new Error("QA 無法建立續戰玩家的共鬥 runtime");
    battle.result = "round-pause";
    battle.roundResolved = true;
    battle.waitingResume = true;
    battle.playerAction = null;
    battle.enemyAction = null;
    battle.playerPerformedAction = true;
    battle.enemyPerformedAction = true;
    battle.playerDiceRoll = 4;
    battle.enemyDiceRoll = 5;
    battle.playerActionSummary = "上一輪玩家行動";
    battle.enemyActionSummary = "上一輪敵方行動";
    battle.firstActor = "enemy";
    battle.secondActor = "player";
    Object.assign(runtime, {
      playerPerformedAction: true,
      playerDiceRoll: 4,
      playerActionSummary: "上一輪玩家行動",
    });
    debug.notifyBattleWindow();
    return {
      ownerId: String(owner.id),
      guestId: String(guest.id),
      islandId: island.id,
      roundIndex: battle.roundIndex,
      participantIds: battle.coop?.participantIds || [],
    };
  });

  assert(seeded.participantIds.length === 1 && String(seeded.participantIds[0]) === seeded.ownerId,
    `QA 預期只有原玩家參戰，實際 ${JSON.stringify(seeded.participantIds)}`);

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.battleFinish());
  await page.waitForFunction(() => {
    const state = window.__BOARD_GAME_DEBUG__?.getState?.();
    return state && !state.battleState && state.gameState.currentPlayerIndex === 1 && !state.gameState.battleExitLock;
  }, null, { timeout: 12000 });

  const pending = await page.evaluate((ownerId) => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    const owner = state.gameState.players.find((player) => String(player.id) === ownerId);
    return {
      exists: !!owner?.pendingBattle,
      performed: !!owner?.pendingBattle?.coop?.runtimes?.[ownerId]?.playerPerformedAction,
      dice: owner?.pendingBattle?.coop?.runtimes?.[ownerId]?.playerDiceRoll ?? null,
      firstActor: owner?.pendingBattle?.firstActor || "",
    };
  }, seeded.ownerId);
  assert(pending.exists && pending.performed && pending.dice === 4 && pending.firstActor === "enemy",
    `QA 沒有保留刻意種入的上一輪狀態：${JSON.stringify(pending)}`);

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.endTurn());
  await page.waitForFunction((ownerId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug?.getState?.();
    const current = state?.gameState?.players?.[state.gameState.currentPlayerIndex];
    return String(current?.id || "") === ownerId && !!state?.battleState && debug.getBattleView()?.battle?.canAct === true;
  }, seeded.ownerId, { timeout: 15000 });

  const resumed = await page.evaluate((ownerId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const owner = state.gameState.players.find((player) => String(player.id) === ownerId);
    const runtime = battle.coop?.runtimes?.[ownerId];
    const activeCard = owner.crew[battle.activeCrewIndex];
    activeCard.baseStats.spd = 9999;
    activeCard.moveSet.forEach((move) => {
      move.priority = 0;
      move.effects ||= {};
      move.effects.priority = 0;
    });
    battle.enemyCombatant.baseStats ||= {};
    battle.enemyCombatant.baseStats.spd = 1;
    battle.enemyCombatant.spd = 1;
    battle.enemyCombatant.moveSet.forEach((move) => {
      move.priority = 0;
      move.effects ||= {};
      move.effects.priority = 0;
    });
    const move = activeCard.moveSet.find((entry) => Number(entry.currentPP ?? entry.pp ?? 0) > 0 && Number(entry.power || entry.basePower || 0) > 0)
      || activeCard.moveSet.find((entry) => Number(entry.currentPP ?? entry.pp ?? 0) > 0);
    debug.notifyBattleWindow();
    return {
      roundIndex: battle.roundIndex,
      playerPerformedAction: !!battle.playerPerformedAction,
      enemyPerformedAction: !!battle.enemyPerformedAction,
      playerDiceRoll: battle.playerDiceRoll ?? null,
      enemyDiceRoll: battle.enemyDiceRoll ?? null,
      playerActionSummary: battle.playerActionSummary || "",
      enemyActionSummary: battle.enemyActionSummary || "",
      firstActor: battle.firstActor || "",
      secondActor: battle.secondActor || "",
      runtimePerformedAction: !!runtime?.playerPerformedAction,
      runtimeDiceRoll: runtime?.playerDiceRoll ?? null,
      runtimeActionSummary: runtime?.playerActionSummary || "",
      canAct: !!debug.getBattleView()?.battle?.canAct,
      moveId: move?.id || "",
      movePP: Number(move?.currentPP ?? move?.pp ?? 0),
    };
  }, seeded.ownerId);

  assert(resumed.roundIndex === seeded.roundIndex + 1, `續戰沒有開始新輪：${JSON.stringify(resumed)}`);
  assert(!resumed.playerPerformedAction && !resumed.enemyPerformedAction, `新輪仍保留已行動旗標：${JSON.stringify(resumed)}`);
  assert(resumed.playerDiceRoll === null && resumed.enemyDiceRoll === null, `新輪仍保留舊骰值：${JSON.stringify(resumed)}`);
  assert(!resumed.playerActionSummary && !resumed.enemyActionSummary, `新輪仍保留舊摘要：${JSON.stringify(resumed)}`);
  assert(!resumed.firstActor && !resumed.secondActor, `新輪仍沿用上一輪先攻：${JSON.stringify(resumed)}`);
  assert(!resumed.runtimePerformedAction && resumed.runtimeDiceRoll === null && !resumed.runtimeActionSummary,
    `共鬥 runtime 沒有跟著新輪重置：${JSON.stringify(resumed)}`);
  assert(resumed.canAct && resumed.moveId, `續戰後無法選招：${JSON.stringify(resumed)}`);

  const desktopLayout = await inspectActionGrid(page, { width: 1920, height: 1080 });
  assert(!desktopLayout.overflow, `桌機指令按鈕超出邊框：${JSON.stringify(desktopLayout)}`);
  assert(desktopLayout.leftInset >= desktopLayout.panel.width * 0.045 && desktopLayout.rightInset >= desktopLayout.panel.width * 0.045,
    `桌機指令按鈕沒有收進安全邊界：${JSON.stringify(desktopLayout)}`);
  assert(Math.abs(desktopLayout.horizontalGap - desktopLayout.verticalGap) <= 2,
    `桌機四鍵間距不一致：${JSON.stringify(desktopLayout)}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "battle_commands_1920x1080.png") });

  const compactLayout = await inspectActionGrid(page, { width: 932, height: 430 });
  assert(!compactLayout.overflow, `橫向小螢幕指令按鈕超出邊框：${JSON.stringify(compactLayout)}`);
  assert(compactLayout.leftInset >= compactLayout.panel.width * 0.045 && compactLayout.rightInset >= compactLayout.panel.width * 0.045,
    `橫向小螢幕指令按鈕沒有收進安全邊界：${JSON.stringify(compactLayout)}`);
  assert(Math.abs(compactLayout.horizontalGap - compactLayout.verticalGap) <= 2,
    `橫向小螢幕四鍵間距不一致：${JSON.stringify(compactLayout)}`);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "battle_commands_932x430.png") });

  await page.setViewportSize({ width: 1920, height: 1080 });
  const frame = page.frameLocator("#battlePageFrame");
  await frame.locator('[data-mode="attack"]').click();
  await frame.locator(`[data-move-id="${resumed.moveId}"]`).click();
  await page.waitForFunction(() => {
    const battle = window.__BOARD_GAME_DEBUG__?.getState?.()?.battleState;
    return battle && (battle.playerDiceRoll != null || battle.enemyDiceRoll != null);
  }, null, { timeout: 15000 });

  const action = await page.evaluate(({ ownerId, moveId }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const owner = state.gameState.players.find((player) => String(player.id) === ownerId);
    const move = owner.crew[battle.activeCrewIndex].moveSet.find((entry) => entry.id === moveId);
    return {
      playerDiceRoll: battle.playerDiceRoll ?? null,
      enemyDiceRoll: battle.enemyDiceRoll ?? null,
      firstActor: battle.firstActor || "",
      secondActor: battle.secondActor || "",
      playerPerformedAction: !!battle.playerPerformedAction,
      enemyPerformedAction: !!battle.enemyPerformedAction,
      remainingPP: Number(move?.currentPP ?? move?.pp ?? 0),
      log: (battle.log || []).slice(-8),
    };
  }, { ownerId: seeded.ownerId, moveId: resumed.moveId });

  assert(action.firstActor === "player" && action.secondActor === "enemy", `新輪先攻沒有重新計算：${JSON.stringify(action)}`);
  assert(action.playerDiceRoll !== null && action.enemyDiceRoll === null,
    `點攻擊後沒有先出現玩家骰，或直接跳到敵方：${JSON.stringify(action)}`);
  assert(action.remainingPP === resumed.movePP - 1, `玩家招式 PP 沒有剛好扣一次：${JSON.stringify(action)}`);
  assert(errors.length === 0, `瀏覽器發生錯誤：${errors.join(" | ")}`);

  console.log(JSON.stringify({ seeded, pending, resumed, desktopLayout, compactLayout, action, errors }, null, 2));
  console.log("BATTLE_TURN_RESUME_ACTION_QA=PASS");
  await browser.close();
  browser = null;
})().catch(async (error) => {
  if (browser) await browser.close().catch(() => {});
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
