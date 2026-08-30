"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8787";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outputDir = path.resolve(__dirname, "..", "_codex_artifacts", "spar-formal-battle-qa");
fs.mkdirSync(outputDir, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !/DATABASE_URL|favicon|Failed to load resource/i.test(message.text())) errors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/i.test(response.url())) errors.push(`http:${response.status()}:${response.url()}`);
  });

  await page.goto(`${baseUrl}/board_game.html?seed=82727`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.sparQa, null, { timeout: 20000 });

  const setup = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const catalog = window.BoardCards?.cards || [];
    const idsA = ["luffy", "zoro", "sanji", "nami", "robin", "chopper"];
    const idsB = ["ace", "sabo", "yamato", "hancock", "law", "oden"];
    const cards = (ids) => ids.map((id) => catalog.find((card) => card.id === id)).filter(Boolean).map(debug.sparQa.cloneRuntimeCard);
    const first = state.gameState.players[0];
    first.id = "spar-qa-a";
    first.userId = 91001;
    first.clientId = "spar-qa-client-a";
    first.name = "草帽測試方";
    first.crew = cards(idsA);
    first.crew[0].battleCarryItem = { type: "battleCarry", id: "choice_band", bound: false };
    first.activeCrewIndex = 0;
    const second = JSON.parse(JSON.stringify(first));
    second.id = "spar-qa-b";
    second.userId = 91002;
    second.clientId = "spar-qa-client-b";
    second.name = "B 航海玩家";
    const third = JSON.parse(JSON.stringify(first));
    third.id = "spar-qa-c";
    third.userId = 91003;
    third.clientId = "spar-qa-client-c";
    third.name = "新世界測試方 C";
    third.crew = cards(idsB);
    third.crew[0].battleCarryItem = { type: "battleCarry", id: "justice_cloak", bound: false };
    const fourth = JSON.parse(JSON.stringify(second));
    fourth.id = "spar-qa-d";
    fourth.userId = 91004;
    fourth.clientId = "spar-qa-client-d";
    fourth.name = "D 航海玩家";
    const routeId = state.gameState.boardData.routesBetweenIslands[0].id;
    first.location = { kind: "route", routeId, tileIndex: 0 };
    second.location = { kind: "route", routeId, tileIndex: 2 };
    third.location = { kind: "route", routeId, tileIndex: 0 };
    fourth.location = { kind: "route", routeId, tileIndex: 4 };
    state.gameState.players = [first, second, third, fourth];
    state.gameState.currentPlayerIndex = 0;
    state.gameState.phase = "main";
    state.gameState.postgameWorld.unlocked = true;
    state.gameState.pendingMove = null;
    state.gameState.resolutionLock = false;
    debug.recalcPlayerDerivedStats(first);
    debug.recalcPlayerDerivedStats(second);
    debug.recalcPlayerDerivedStats(third);
    debug.recalcPlayerDerivedStats(fourth);
    debug.renderAll();
    const modalBack = document.getElementById("boardModalBack");
    modalBack?.classList.remove("open", "final-ending-fullscreen-backdrop", "force-choice");
    document.body.classList.remove("modal-open");
    const baseline = state.gameState.players.map((player) => ({
      id: player.id,
      activeCrewIndex: player.activeCrewIndex,
      crew: player.crew.map((card) => ({
        id: card.id,
        currentHp: card.currentHp,
        pp: (card.moveSet || []).map((move) => [move.id, move.currentPP]),
        carry: JSON.stringify(card.battleCarryItem || null),
      })),
    }));
    return { baseline };
  });

  await page.locator('.ship-token.current.actionable[data-player-id="spar-qa-a"]').click({ force: true });
  const shipMenu = await page.locator(".ship-action-menu.ship-command-menu").evaluate((menu) => ({
    secondaryCount: menu.querySelectorAll(".ship-command-secondary-btn").length,
    hasSparClass: !!menu.querySelector(".ship-command-secondary-actions.has-spar"),
    hasSparButton: !!menu.querySelector('[data-ship-action="spar"]'),
    overflowX: menu.scrollWidth > menu.clientWidth + 1,
    buttonsInside: Array.from(menu.querySelectorAll(".ship-command-secondary-btn")).every((button) => {
      const buttonRect = button.getBoundingClientRect();
      const rowRect = button.parentElement.getBoundingClientRect();
      return buttonRect.left >= rowRect.left - 1 && buttonRect.right <= rowRect.right + 1;
    }),
  }));
  await page.screenshot({ path: path.join(outputDir, "ship-menu-five-actions.png"), fullPage: true });
  const invitation = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const [first, , third] = state.gameState.players;
    document.querySelector(".ship-action-menu")?.remove();
    const invited = debug.sparQa.startInvitation(first, third);
    state.gameState.currentPlayerIndex = 2;
    const accepted = debug.sparQa.acceptInvitation();
    return { invited, accepted };
  });
  setup.invited = invitation.invited;
  setup.accepted = invitation.accepted;

  await page.waitForSelector("#sparSelectionOverlay.open iframe", { timeout: 10000 });
  const selectionFrame = page.frameLocator("#sparSelectionOverlay iframe");
  await selectionFrame.locator(".crew-side.right .crew-card").first().waitFor({ timeout: 10000 });
  const selectionCounts = await selectionFrame.locator(".crew-side").evaluateAll((sides) => sides.map((side) => side.querySelectorAll(".crew-card").length));
  for (let index = 0; index < 3; index += 1) await selectionFrame.locator(".crew-side.right .crew-card").nth(index).click();
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().gameState.activeSpar?.picks?.["spar-qa-c"]?.length === 3);
  await selectionFrame.locator("#lockBtn").click();
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().gameState.activeSpar?.locked?.["spar-qa-c"] === true);
  await page.screenshot({ path: path.join(outputDir, "selection-desktop.png"), fullPage: true });

  const battleSetup = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const spar = state.gameState.activeSpar;
    spar.picks["spar-qa-a"] = [0, 1, 2];
    spar.locked["spar-qa-a"] = true;
    state.gameState.currentPlayerIndex = 0;
    const started = debug.sparQa.startBattle(spar);
    const battle = state.battleState;
    const view = debug.sparQa.battleView(battle);
    return {
      started,
      ownCarryVisible: view.activeCard?.carryItem?.id === "choice_band",
      opponentCarryHidden: !("carryItem" in (view.enemy || {})),
      carryStatesReady: battle.participantOrder.every((id) => Object.keys(battle.sparParticipants[id].carryItemStates || {}).length > 0),
      runtime: battle.participantOrder.map((id) => ({
        id,
        crew: battle.sparParticipants[id].crew.map((card) => ({
          id: card.id,
          currentHp: card.currentHp,
          maxHp: card.baseStats.hp,
          ppFull: (card.moveSet || []).every((move) => Number(move.currentPP) === Number(move.pp)),
        })),
      })),
    };
  });

  await page.waitForSelector("#battlePageOverlay.open iframe", { timeout: 15000 });
  await page.waitForTimeout(2500);
  const battleFrame = page.frameLocator("#battlePageOverlay iframe");
  await battleFrame.locator("body").waitFor({ timeout: 10000 });
  await page.screenshot({ path: path.join(outputDir, "battle-desktop.png"), fullPage: true });

  const queued = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const a = battle.sparParticipants["spar-qa-a"];
    const b = battle.sparParticipants["spar-qa-c"];
    state.gameState.currentPlayerIndex = 0;
    const aMove = (a.crew[a.activeCrewIndex].moveSet || []).find((move) => (a.crew[a.activeCrewIndex].unlockedMoveIds || []).includes(move.id) && move.currentPP > 0);
    const first = debug.sparQa.queueAction({ type: "move", moveId: aMove.id });
    const bMove = (b.crew[b.activeCrewIndex].moveSet || []).find((move) => (b.crew[b.activeCrewIndex].unlockedMoveIds || []).includes(move.id) && move.currentPP > 0);
    const second = debug.sparQa.queueActionFor("spar-qa-c", { type: "move", moveId: bMove.id });
    return {
      first,
      second,
      aMove: aMove.id,
      bMove: bMove.id,
      firstExpected: battle.turnOwnerId === "spar-qa-a",
    };
  });

  await page.waitForFunction(() => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    return !state.battleState
      && state.gameState.currentPlayerIndex === 1
      && state.gameState.activeSpar?.battleSnapshot?.isSparBattle;
  }, null, { timeout: 35000 });
  await page.waitForTimeout(2200);

  const firstRound = await page.evaluate((baseline) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.gameState.activeSpar?.battleSnapshot;
    const mainlineNow = state.gameState.players.map((player) => ({
      id: player.id,
      activeCrewIndex: player.activeCrewIndex,
      crew: player.crew.map((card) => ({
        id: card.id,
        currentHp: card.currentHp,
        pp: (card.moveSet || []).map((move) => [move.id, move.currentPP]),
        carry: JSON.stringify(card.battleCarryItem || null),
      })),
    }));
    const isolated = JSON.stringify(baseline) === JSON.stringify(mainlineNow);
    const runtimeChanged = battle.participantOrder.some((id) => battle.sparParticipants[id].crew.some((card) => card.currentHp < card.baseStats.hp || (card.moveSet || []).some((move) => move.currentPP < move.pp)));
    return {
      isolated,
      runtimeChanged,
      currentPlayerId: state.gameState.players[state.gameState.currentPlayerIndex]?.id || "",
      battleStashed: !state.battleState && !!battle?.isSparBattle,
      bTurnBlocked: debug.sparQa.blocksCurrentTurn(),
      logs: battle.log.slice(-8),
    };
  }, setup.baseline);

  const bAdvance = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const before = state.gameState.players[state.gameState.currentPlayerIndex]?.id || "";
    debug.endTurn({ reason: "spar-qa-b-normal-turn" });
    return {
      before,
      after: state.gameState.players[state.gameState.currentPlayerIndex]?.id || "",
      activeSparKept: !!state.gameState.activeSpar,
    };
  });

  await page.waitForFunction(() => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    return state.gameState.currentPlayerIndex === 2
      && state.battleState?.isSparBattle
      && state.battleState.turnOwnerId === "spar-qa-c";
  }, null, { timeout: 15000 });

  const secondRoundQueued = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const c = battle.sparParticipants["spar-qa-c"];
    const a = battle.sparParticipants["spar-qa-a"];
    const replacementSide = a;
    replacementSide.needsReplacement = true;
    const replacementChosen = debug.sparQa.chooseReplacementFor("spar-qa-a", 1);
    const replacementApplied = replacementChosen && replacementSide.activeCrewIndex === 1 && !replacementSide.needsReplacement;
    const cMove = (c.crew[c.activeCrewIndex].moveSet || []).find((move) => (c.crew[c.activeCrewIndex].unlockedMoveIds || []).includes(move.id) && move.currentPP > 0);
    const aMove = (a.crew[a.activeCrewIndex].moveSet || []).find((move) => (a.crew[a.activeCrewIndex].unlockedMoveIds || []).includes(move.id) && move.currentPP > 0);
    const expectedBefore = debug.sparQa.expectedActionPlayerId(battle);
    const cQueued = debug.sparQa.queueAction({ type: "move", moveId: cMove.id });
    const expectedAfterC = debug.sparQa.expectedActionPlayerId(battle);
    const aQueued = debug.sparQa.queueActionFor("spar-qa-a", { type: "move", moveId: aMove.id });
    return { replacementApplied, expectedBefore, cQueued, expectedAfterC, aQueued, cMove: cMove.id, aMove: aMove.id };
  });

  await page.waitForFunction(() => {
    const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
    return !battle || (battle.isSparBattle && battle.roundResolved && !battle.animating);
  }, null, { timeout: 35000 });
  const secondRoundReplacements = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    if (!battle?.isSparBattle) return [];
    const applied = [];
    for (const playerId of battle.participantOrder || []) {
      const participant = battle.sparParticipants?.[playerId];
      if (!participant?.needsReplacement) continue;
      const nextIndex = (participant.crew || []).findIndex((card, index) => index !== participant.activeCrewIndex && Number(card?.currentHp || 0) > 0);
      if (nextIndex < 0) continue;
      applied.push({ playerId, nextIndex, accepted: debug.sparQa.chooseReplacementFor(playerId, nextIndex) });
      if (!debug.getState().battleState) break;
    }
    return applied;
  });

  try {
    await page.waitForFunction(() => {
      const state = window.__BOARD_GAME_DEBUG__.getState();
      return !state.battleState
        && state.gameState.currentPlayerIndex === 3
        && state.gameState.activeSpar?.battleSnapshot?.isSparBattle;
    }, null, { timeout: 35000 });
  } catch (error) {
    const diagnostic = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState || state.gameState.activeSpar?.battleSnapshot || null;
      return {
        currentPlayerIndex: state.gameState.currentPlayerIndex,
        currentPlayerId: state.gameState.players[state.gameState.currentPlayerIndex]?.id || "",
        activeBattle: Boolean(state.battleState),
        turnOwnerId: battle?.turnOwnerId || "",
        result: battle?.result || "",
        animating: Boolean(battle?.animating),
        roundResolved: Boolean(battle?.roundResolved),
        needsReplacement: Object.fromEntries(Object.entries(battle?.sparParticipants || {}).map(([id, side]) => [id, Boolean(side.needsReplacement)])),
        queuedActions: battle?.sparQueuedActions || battle?.queuedActions || null,
        log: (battle?.log || []).slice(-12),
      };
    });
    throw new Error(`Second spar round did not return to board: ${JSON.stringify(diagnostic)}\n${error.message}`);
  }

  const result = await page.evaluate((baseline) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.gameState.activeSpar?.battleSnapshot;
    const mainlineNow = state.gameState.players.map((player) => ({
      id: player.id,
      activeCrewIndex: player.activeCrewIndex,
      crew: player.crew.map((card) => ({
        id: card.id,
        currentHp: card.currentHp,
        pp: (card.moveSet || []).map((move) => [move.id, move.currentPP]),
        carry: JSON.stringify(card.battleCarryItem || null),
      })),
    }));
    const isolated = JSON.stringify(baseline) === JSON.stringify(mainlineNow);
    const dTurnBlocked = debug.sparQa.blocksCurrentTurn();
    const currentPlayerId = state.gameState.players[state.gameState.currentPlayerIndex]?.id || "";
    const logs = battle?.log?.slice(-12) || [];
    const finished = debug.sparQa.finish("spar-qa-finish");
    return {
      isolated,
      currentPlayerId,
      dTurnBlocked,
      finished,
      activeSparCleared: !state.gameState.activeSpar,
      battleCleared: !state.battleState,
      resolutionUnlocked: !state.gameState.resolutionLock,
      logs,
    };
  }, setup.baseline);

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`${baseUrl}/board_spar_selection_demo.html`, { waitUntil: "domcontentloaded" });
  await page.screenshot({ path: path.join(outputDir, "selection-tablet.png"), fullPage: true });

  const report = { errors, setup, shipMenu, selectionCounts, battleSetup, queued, firstRound, bAdvance, secondRoundQueued, secondRoundReplacements, result, outputDir };
  const failures = [];
  if (!setup.invited || !setup.accepted) failures.push("invitation/accept flow failed");
  if (shipMenu.secondaryCount !== 5 || !shipMenu.hasSparClass || !shipMenu.hasSparButton || shipMenu.overflowX || !shipMenu.buttonsInside) failures.push(`ship command PK layout failed ${JSON.stringify(shipMenu)}`);
  if (selectionCounts.join(",") !== "6,6") failures.push(`selection roster count ${selectionCounts.join(",")}`);
  if (!battleSetup.started) failures.push("formal battle did not start");
  if (!battleSetup.ownCarryVisible || !battleSetup.opponentCarryHidden || !battleSetup.carryStatesReady) failures.push("carry item visibility/runtime state contract failed");
  if (battleSetup.runtime.some((side) => side.crew.length !== 3 || side.crew.some((card) => card.currentHp <= 0 || !card.ppFull))) failures.push("runtime was not full HP/full PP");
  if (!queued.firstExpected || !queued.first || !queued.second) failures.push("A then C first-round action order failed");
  if (!firstRound.runtimeChanged) failures.push("spar runtime did not resolve damage/PP");
  if (!firstRound.isolated || !firstRound.battleStashed || firstRound.currentPlayerId !== "spar-qa-b" || firstRound.bTurnBlocked) failures.push(`A round did not return to normal B turn ${JSON.stringify(firstRound)}`);
  if (bAdvance.before !== "spar-qa-b" || bAdvance.after !== "spar-qa-c" || !bAdvance.activeSparKept) failures.push(`B normal turn did not advance to C with spar preserved ${JSON.stringify(bAdvance)}`);
  if (!secondRoundQueued.replacementApplied || secondRoundQueued.expectedBefore !== "spar-qa-c" || !secondRoundQueued.cQueued || secondRoundQueued.expectedAfterC !== "spar-qa-a" || !secondRoundQueued.aQueued) failures.push(`C then A second-round action order failed ${JSON.stringify(secondRoundQueued)}`);
  if (result.currentPlayerId !== "spar-qa-d" || result.dTurnBlocked) failures.push(`C round did not return to normal D turn ${JSON.stringify(result)}`);
  if (!result.isolated) failures.push("mainline crew HP/PP/carry state changed");
  if (!result.finished || !result.activeSparCleared || !result.battleCleared || !result.resolutionUnlocked) failures.push("spar finish cleanup failed");
  if (errors.length) failures.push(...errors);
  report.failures = failures;
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await Promise.race([
    browser.close(),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
