const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("artifacts/one_piece_board_complete_guide_v1/qa");
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, "screenshots", "raw");
const REPORT_PATH = path.join(OUTPUT_DIR, "full_campaign_2p2cpu_report.json");

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

function safeName(value) {
  return String(value || "unknown")
    .replace(/[^a-zA-Z0-9\u3400-\u9fff_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "unknown";
}

function attachDiagnostics(page, report, label) {
  page.on("pageerror", (error) => report.errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const detail = message.text();
    if (!detail.startsWith("Failed to load resource:")) report.errors.push(`${label}:console:${detail}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      report.errors.push(`${label}:http:${response.status()}:${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED/.test(reason)) report.errors.push(`${label}:requestfailed:${request.url()}:${reason}`);
  });
}

async function createDevice(browser, profile, report) {
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    localStorage.setItem("op_board_story_speed", "3");
  }, profile);
  const page = await context.newPage();
  attachDiagnostics(page, report, profile.name);
  await page.goto(`${ROOT_URL}/board_start.html?full_campaign_qa=${encodeURIComponent(profile.name)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 20000 });
  return { ...profile, context, page };
}

async function enterRoom(device, roomCode, create = false) {
  await device.page.click("#openBoardFlowBtn");
  if (create) {
    await device.page.click("#createBoardRoomBtn");
  } else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction((expected) => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    const active = document.querySelector('[data-view="lobby"]')?.classList.contains("active");
    return Boolean(active && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual)));
  }, roomCode, { timeout: 15000 });
}

async function takeShot(page, index, label) {
  const file = `${String(index).padStart(2, "0")}_${safeName(label)}.png`;
  const target = path.join(SCREENSHOT_DIR, file);
  await page.screenshot({ path: target, fullPage: false });
  return { label, file, path: target };
}

async function takeBattleShot(page, index, label) {
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    debug?.renderAll?.();
    debug?.notifyBattleWindow?.();
    const overlay = document.getElementById("battlePageOverlay");
    if (overlay) {
      overlay.classList.add("open", "ready");
      overlay.classList.remove("closing", "transitioning");
      overlay.style.setProperty("display", "block", "important");
      overlay.style.setProperty("z-index", "9999", "important");
      overlay.style.setProperty("opacity", "1", "important");
      const frame = document.getElementById("battlePageFrame");
      frame?.style.setProperty("opacity", "1", "important");
      frame?.style.setProperty("transform", "none", "important");
    }
    document.body.classList.remove("battle-map-shake");
    document.querySelectorAll(".sea-encounter-splash").forEach((entry) => entry.remove());
  });
  await page.evaluate(() => {
    document.getElementById("turnTransitionBanner")?.classList.remove("open", "is-your-turn", "is-watch");
    document.getElementById("missionCompleteToast")?.classList.remove("show");
    document.getElementById("itemRevealHud")?.classList.remove("show", "awaiting");
  });
  await page.waitForTimeout(100);
  const file = `${String(index).padStart(2, "0")}_${safeName(label)}.png`;
  const target = path.join(SCREENSHOT_DIR, file);
  await page.screenshot({ path: target, fullPage: false });
  await page.evaluate(() => {
    const overlay = document.getElementById("battlePageOverlay");
    const frame = document.getElementById("battlePageFrame");
    ["display", "z-index", "opacity"].forEach((name) => overlay?.style.removeProperty(name));
    ["opacity", "transform"].forEach((name) => frame?.style.removeProperty(name));
  });
  return { label, file, path: target };
}

async function waitForLanIdle(page, timeout = 12000) {
  await page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const status = debug?.boardLanStatus?.();
    return Boolean(debug && status?.connected && !status.awaitingInitialState && !status.applying);
  }, null, { timeout });
}

async function waitForGameReady(device) {
  await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 30000 });
  await device.page.waitForFunction(() => (
    window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().connected
    && !window.__BOARD_GAME_DEBUG__.boardLanStatus().awaitingInitialState
  ), null, { timeout: 30000 });
}

async function dismissItemReveals(page) {
  for (let attempt = 0; attempt < 14; attempt += 1) {
    const visible = await page.evaluate(() => document.getElementById("itemRevealHud")?.classList.contains("show") || false);
    if (!visible) return;
    await page.click("#itemRevealHud");
    await page.waitForTimeout(160);
  }
}

async function closeModalAndFreezeHost(host, hostId, reason = "qa-freeze") {
  await host.evaluate(({ requestedHostId, pushReason }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const hostPlayer = game.players.find((entry) => String(entry.id) === String(requestedHostId));
    if (!hostPlayer) throw new Error("Host player missing while freezing state");
    game.currentPlayerIndex = game.players.indexOf(hostPlayer);
    game.resolutionLock = true;
    game.battleExitLock = false;
    game.pendingMove = null;
    game.routePrompt = null;
    game.islandDecision = null;
    debug.closeModal();
    debug.renderAll();
    debug.pushBoardLanState(pushReason);
  }, { requestedHostId: hostId, pushReason: reason });
  await host.waitForTimeout(350);
}

async function prepareMainPhase(host, guestUserId) {
  return host.evaluate((requestedGuestUserId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const players = game.players;
    const humans = players.filter((entry) => !entry.isCPU);
    const hostPlayer = humans.find((entry) => Number(entry.userId || entry.id) !== Number(requestedGuestUserId));
    const guestPlayer = humans.find((entry) => Number(entry.userId || entry.id) === Number(requestedGuestUserId));
    if (!hostPlayer || !guestPlayer || players.filter((entry) => entry.isCPU).length !== 2) {
      throw new Error(`Expected 2 human + 2 CPU players, got ${players.length}`);
    }
    players.forEach((player, playerIndex) => {
      player.crew = Array.from({ length: 6 }, (_, index) => {
        const source = window.BoardCards.cards[(playerIndex * 6 + index) % window.BoardCards.cards.length];
        const card = debug.cloneFreshDraftRecruit(source);
        card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.currentHp || 1);
        (card.moveSet || []).forEach((move) => { move.currentPP = Number(move.pp || move.currentPP || 0); });
        return card;
      });
      player.activeCrewIndex = 0;
      player.hp = Number(player.maxHp || player.hp || 100);
      player.pendingBattle = null;
      debug.recalcPlayerDerivedStats(player);
    });
    game.phase = "main";
    game.round = Math.max(1, Number(game.round || 1));
    game.currentPlayerIndex = players.indexOf(hostPlayer);
    game.turnStep = "擲骰前進";
    game.resolutionLock = true;
    game.battleExitLock = false;
    game.pendingMove = null;
    state.battleState = null;
    state.boardUiEvent = null;
    debug.closeModal();
    debug.renderAll();
    debug.pushBoardLanState("qa-full-campaign-main-ready");
    return {
      hostId: String(hostPlayer.id),
      guestId: String(guestPlayer.id),
      players: players.map((entry, index) => ({
        id: String(entry.id),
        name: entry.name,
        isCPU: Boolean(entry.isCPU),
        index,
        crew: entry.crew.map((card) => ({ name: card.name, hp: card.currentHp, maxHp: card.baseStats?.hp || card.maxHp })),
      })),
    };
  }, guestUserId);
}

async function verifyTurnRing(host, guest, hostId, guestId) {
  const observations = [];
  for (let step = 0; step < 4; step += 1) {
    const current = await host.evaluate(() => {
      const game = window.__BOARD_GAME_DEBUG__.getState().gameState;
      const player = game.players[game.currentPlayerIndex];
      return { id: String(player?.id || ""), isCPU: Boolean(player?.isCPU) };
    });
    const controller = current.id === String(guestId) ? guest : host;
    const observer = controller === host ? guest : host;
    const value = await controller.evaluate(async ({ requestedHostId, stepIndex }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const hostPlayer = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      if (stepIndex === 0) game.currentPlayerIndex = game.players.indexOf(hostPlayer);
      const before = game.players[game.currentPlayerIndex];
      game.resolutionLock = false;
      debug.endTurn({ context: "qa", subtitle: "完整攻略測試回合交棒" });
      game.resolutionLock = true;
      const after = game.players[game.currentPlayerIndex];
      debug.pushBoardLanState(`qa-turn-ring-${stepIndex}`);
      return {
        before: { id: String(before.id), name: before.name, isCPU: Boolean(before.isCPU) },
        after: { id: String(after.id), name: after.name, isCPU: Boolean(after.isCPU) },
        round: Number(game.round || 0),
      };
    }, { requestedHostId: hostId, stepIndex: step });
    observations.push(value);
    await observer.waitForFunction((expectedId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.().gameState;
      return String(game?.players?.[game.currentPlayerIndex]?.id || "") === String(expectedId)
        && !debug.boardLanStatus().applying;
    }, value.after.id, { timeout: 10000 });
  }
  return observations;
}

async function startIslandBattle(host, guest, hostId, islandId) {
  await waitForLanIdle(host);
  await waitForLanIdle(guest);
  await host.waitForTimeout(650);
  const prepared = await host.evaluate(({ requestedHostId, requestedIslandId }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
    const island = debug.getIslandById(requestedIslandId);
    const islandState = debug.getIslandState(requestedIslandId);
    if (!player || !island || !islandState) throw new Error(`Cannot prepare island battle ${requestedIslandId}`);
    player.crew.forEach((card) => { card.currentHp = debug.cardMaxHp(card); });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    player.location = { kind: "island", islandId: island.id };
    game.phase = "main";
    game.currentPlayerIndex = game.players.indexOf(player);
    game.resolutionLock = false;
    game.battleExitLock = false;
    state.battleState = null;
    state.boardUiEvent = null;
    debug.closeModal();
    debug.startBattle(player, island, islandState);
    if (!state.battleState) throw new Error(`Battle did not start for ${requestedIslandId}`);
    const battle = state.battleState;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.animating = false;
    battle.waitingResume = false;
    debug.notifyBattleWindow();
    debug.renderAll();
    debug.pushBoardLanState(`qa-battle-start-${requestedIslandId}`);
    return {
      islandId: island.id,
      islandName: island.name,
      islandKind: island.kind,
      bossKey: battle.postgameBossKey || battle.enemyCombatant?.key || "",
      bossName: battle.enemyCombatant?.name || "",
      maxHp: Number(battle.enemyCombatant?.maxHp || 0),
      currentHp: Number(battle.enemyCombatant?.currentHp || 0),
      attribute: battle.enemyCombatant?.attribute || "",
      tier: battle.enemyCombatant?.tier || battle.enemyTier || "",
      role: battle.enemyCombatant?.role || "",
      passiveName: battle.enemyCombatant?.passiveName || "",
      passiveText: battle.enemyCombatant?.passiveText || "",
      moves: (battle.enemyCombatant?.moveSet || []).map((move) => ({
        id: move.id,
        name: move.name,
        type: move.type,
        power: Number(move.power || 0),
        pp: Number(move.pp || 0),
        description: move.description || move.effectText || "",
      })),
      mechanic: debug.postgameBossMechanicQa.view(player, battle),
    };
  }, { requestedHostId: hostId, requestedIslandId: islandId });
  prepared.sync = {};
  for (const [label, page] of [["host", host], ["guest", guest]]) {
    await page.waitForFunction((expectedKey) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const battle = debug?.getState?.().battleState;
      const lan = debug?.boardLanStatus?.();
      return Boolean(
        battle
        && lan?.connected
        && !lan.awaitingInitialState
        && !lan.applying
        && String(battle.postgameBossKey || battle.enemyCombatant?.key || "") === String(expectedKey)
      );
    }, prepared.bossKey, { timeout: 20000 });
    await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      debug?.renderAll?.();
      debug?.notifyBattleWindow?.();
      const overlay = document.getElementById("battlePageOverlay");
      if (overlay && debug?.getState?.().battleState) {
        overlay.classList.add("open", "ready");
        overlay.classList.remove("closing", "transitioning");
      }
    });
    prepared.sync[label] = await page.evaluate((expectedKey) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const battle = debug?.getState?.().battleState;
      return {
        expectedKey,
        actualKey: battle?.postgameBossKey || battle?.enemyCombatant?.key || "",
        overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
        overlayClosing: document.getElementById("battlePageOverlay")?.classList.contains("closing") || false,
        applying: Boolean(debug?.boardLanStatus?.().applying),
        version: Number(debug?.boardLanStatus?.().version || 0),
        recoveredByRender: false,
        recoveredByReload: false,
      };
    }, prepared.bossKey);
  }
  await host.waitForTimeout(350);
  return prepared;
}

async function forceWinAndSettle(host, hostId, options = {}) {
  const startedAt = Date.now();
  await waitForLanIdle(host);
  const before = await host.evaluate(async ({ requestedHostId, keepPostgameResearch }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
    const battle = state.battleState;
    if (!player || !battle) throw new Error("No battle to settle");
    const researchWasActive = Boolean(game.postgameWorld?.researchLabsActive);
    if (game.postgameWorld && !keepPostgameResearch) game.postgameWorld.researchLabsActive = false;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.visualEvent = null;
    battle.lastVisualEvent = null;
    battle.animating = false;
    battle.waitingResume = false;
    battle.needsReplacement = false;
    battle.roundResolved = true;
    battle.result = "win";
    if (battle.enemyCombatant) battle.enemyCombatant.currentHp = 0;
    game.resolutionLock = false;
    game.battleExitLock = false;
    debug.notifyBattleWindow();
    await debug.battleFinish();
    return {
      researchWasActive,
      bossKey: battle.postgameBossKey || battle.enemyCombatant?.key || "",
      bossName: battle.enemyCombatant?.name || "",
    };
  }, { requestedHostId: hostId, keepPostgameResearch: options.keepPostgameResearch !== false });
  let extractionSettlementContinued = false;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const status = await host.evaluate(() => ({
      battleActive: Boolean(window.__BOARD_GAME_DEBUG__?.getState?.().battleState),
      revealVisible: document.getElementById("itemRevealHud")?.classList.contains("show") || false,
    }));
    if (!status.battleActive) break;
    if (status.revealVisible) await host.click("#itemRevealHud");
    const extractionResult = await host.evaluate(async ({ requestedHostId, mayContinueSettlement }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug?.getState?.();
      const battle = state?.battleState;
      if (!battle?.lineageExtraction) return { seen: false, continued: false };
      const player = state.gameState.players.find((entry) => String(entry.id) === String(requestedHostId));
      const view = debug.lineageExtractionViewForPlayer(player, battle);
      if (view?.entry?.status === "offered") debug.battleDeclineLineageExtraction(requestedHostId);
      const after = debug.lineageExtractionViewForPlayer(player, battle);
      if (after?.allResolved && mayContinueSettlement) {
        await debug.battleFinish();
        return { seen: true, continued: true };
      }
      return { seen: true, continued: false };
    }, { requestedHostId: hostId, mayContinueSettlement: !extractionSettlementContinued });
    if (extractionResult.continued) extractionSettlementContinued = true;
    await host.waitForTimeout(180);
  }
  try {
    await host.waitForFunction(() => !window.__BOARD_GAME_DEBUG__?.getState?.().battleState, null, { timeout: 20000 });
  } catch (error) {
    const stuck = await host.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      return {
        battle: battle ? {
          key: battle.postgameBossKey || battle.enemyCombatant?.key || "",
          result: battle.result,
          animating: Boolean(battle.animating),
          roundResolved: Boolean(battle.roundResolved),
          needsReplacement: Boolean(battle.needsReplacement),
          zorojuroEvolutionResolving: Boolean(battle.zorojuroEvolutionResolving),
          lineage: debug.lineageExtractionViewForPlayer(
            state.gameState.players.find((entry) => String(entry.id) === String(requestedHostId)),
            battle,
          ),
        } : null,
        currentPlayerId: String(state.gameState.players[state.gameState.currentPlayerIndex]?.id || ""),
        resolutionLock: Boolean(state.gameState.resolutionLock),
        battleExitLock: Boolean(state.gameState.battleExitLock),
        lan: debug.boardLanStatus(),
      };
    }, hostId);
    throw new Error(`Battle settlement timeout: ${JSON.stringify(stuck)}`);
  }
  await host.waitForTimeout(550);
  await host.waitForFunction(() => {
    const overlay = document.getElementById("battlePageOverlay");
    return !overlay || (!overlay.classList.contains("open") && !overlay.classList.contains("closing"));
  }, null, { timeout: 5000 }).catch(() => {});
  await host.evaluate(() => {
    const overlay = document.getElementById("battlePageOverlay");
    overlay?.classList.remove("open", "closing", "ready", "transitioning");
    document.body.classList.remove("battle-map-shake");
    document.querySelectorAll(".sea-encounter-splash").forEach((entry) => entry.remove());
  });
  await host.waitForTimeout(650);
  await dismissItemReveals(host);
  await waitForLanIdle(host);
  const after = await host.evaluate(({ requestedHostId, restoreResearch }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
    if (game.postgameWorld && restoreResearch) game.postgameWorld.researchLabsActive = true;
    game.currentPlayerIndex = game.players.indexOf(player);
    game.resolutionLock = true;
    game.battleExitLock = false;
    state.boardUiEvent = null;
    debug.closeModal();
    debug.renderAll();
    debug.pushBoardLanState(`qa-battle-settled-${Date.now()}`);
    const voyages = debug.getPostgameBossVoyageEntries(player);
    return {
      noBattle: !state.battleState,
      currentPlayerId: String(game.players[game.currentPlayerIndex]?.id || ""),
      finalIslandCandidate: Boolean(game.finalIslandCandidate),
      roadPoneglyphs: Array.from(new Set(player.roadPoneglyphs || [])).length,
      yorkClues: voyages.filter((entry) => Number(entry.currentClueCount || 0) > 0).length,
      finalEndingCleared: Boolean(player.finalEndingCleared),
      postgameUnlocked: Boolean(game.postgameWorld?.unlocked),
    };
  }, { requestedHostId: hostId, restoreResearch: before.researchWasActive });
  return { ...before, ...after, settleMs: Date.now() - startedAt };
}

async function openMechanicPanel(host) {
  const frame = host.frameLocator("#battlePageFrame");
  const trigger = frame.locator(".boss-mechanic-status-icon");
  if (await trigger.count()) {
    await trigger.first().click();
    await frame.locator("#postgameBossMechanicPanel:not([hidden])").waitFor({ state: "visible", timeout: 8000 });
    await host.waitForTimeout(180);
    return frame.locator("#postgameBossMechanicTitle").textContent().catch(() => "");
  }
  return "";
}

async function prepareDirectBattle(host, guest, hostId, kind) {
  await waitForLanIdle(host);
  await waitForLanIdle(guest);
  await host.waitForTimeout(650);
  return host.evaluate(({ requestedHostId, requestedKind }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
    game.currentPlayerIndex = game.players.indexOf(player);
    game.resolutionLock = false;
    game.battleExitLock = false;
    player.crew.forEach((card) => { card.currentHp = debug.cardMaxHp(card); });
    player.activeCrewIndex = 0;
    state.battleState = null;
    state.boardUiEvent = null;
    debug.closeModal();
    if (requestedKind === "imu") {
      const anchorId = String(game.boardData?.finalIslandLayout?.anchorIslandId || "");
      player.location = { kind: "island", islandId: anchorId };
      player.finalGateChopperHealed = true;
      player.finalGateBlackTurnCleared = true;
      player.finalGateElbaphCleared = true;
      player.finalGateAftermathSeen = true;
      if (!debug.confirmFinalGateDescent()) throw new Error("Failed to start Imu final-gate battle");
    } else if (requestedKind === "loki") {
      const anchorId = String(game.boardData?.finalIslandLayout?.anchorIslandId || "");
      const anchor = debug.getIslandById(anchorId);
      player.location = { kind: "island", islandId: anchorId };
      if (!debug.cpuDeadlockQa.openElbaphLokiTrialModal(player, anchor)) throw new Error("Failed to open Loki trial");
      document.getElementById("elbaphLokiChallengeBtn")?.click();
      if (!state.battleState) throw new Error("Failed to start Loki trial battle");
    } else if (requestedKind === "rocks") {
      const island = debug.getPostgameEggheadIsland();
      const islandState = debug.getIslandState(island.id);
      player.location = { kind: "island", islandId: island.id };
      debug.startBattle(player, island, islandState);
      if (!state.battleState) throw new Error("Failed to start Rocks battle");
    } else {
      throw new Error(`Unknown direct battle kind ${requestedKind}`);
    }
    const battle = state.battleState;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.animating = false;
    battle.waitingResume = false;
    debug.notifyBattleWindow();
    debug.renderAll();
    debug.pushBoardLanState(`qa-direct-${requestedKind}`);
    return {
      key: battle.postgameBossKey || battle.enemyCombatant?.key || "",
      name: battle.enemyCombatant?.name || "",
      hp: Number(battle.enemyCombatant?.maxHp || 0),
      tier: battle.enemyCombatant?.tier || battle.enemyTier || "",
      attribute: battle.enemyCombatant?.attribute || "",
      passiveName: battle.enemyCombatant?.passiveName || "",
      passiveText: battle.enemyCombatant?.passiveText || "",
      moves: (battle.enemyCombatant?.moveSet || []).map((move) => ({
        id: move.id, name: move.name, type: move.type, power: Number(move.power || 0), pp: Number(move.pp || 0), description: move.description || "",
      })),
    };
  }, { requestedHostId: hostId, requestedKind: kind }).then(async (prepared) => {
    prepared.sync = {};
    for (const [label, page] of [["host", host], ["guest", guest]]) {
      await page.waitForFunction((expectedKey) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const battle = debug?.getState?.().battleState;
        const lan = debug?.boardLanStatus?.();
        return Boolean(
          battle
          && lan?.connected
          && !lan.awaitingInitialState
          && !lan.applying
          && String(battle.postgameBossKey || battle.enemyCombatant?.key || "") === String(expectedKey)
        );
      }, prepared.key, { timeout: 20000 });
    await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      debug?.renderAll?.();
      debug?.notifyBattleWindow?.();
      const overlay = document.getElementById("battlePageOverlay");
      if (overlay && debug?.getState?.().battleState) {
        overlay.classList.add("open", "ready");
        overlay.classList.remove("closing", "transitioning");
      }
    });
      prepared.sync[label] = await page.evaluate((expectedKey) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const battle = debug.getState().battleState;
        return {
          expectedKey,
          actualKey: battle?.postgameBossKey || battle?.enemyCombatant?.key || "",
          overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
          overlayClosing: document.getElementById("battlePageOverlay")?.classList.contains("closing") || false,
          version: Number(debug.boardLanStatus().version || 0),
          recoveredByReload: false,
        };
      }, prepared.key);
    }
    await host.waitForTimeout(500);
    return prepared;
  });
}

(async () => {
  const report = {
    title: "One Piece Board 2P2CPU full campaign QA",
    startedAt: new Date().toISOString(),
    rootUrl: ROOT_URL,
    methodology: {
      room: "Real Socket.IO lobby with two human browser contexts and two CPU seats",
      progression: "Production state/sync/battle entry and settlement paths; deterministic force-win used only to accelerate boss HP depletion",
      scope: "Four Emperors, Imu, first ending, thirteen postgame island bosses, Loki trial, York reveal, Rocks",
    },
    room: null,
    turnRing: [],
    firstPlaythrough: { yonko: [], imu: null, ending: null },
    secondPlaythrough: { bosses: [], loki: null, york: null, rocks: null },
    refreshCheckpoint: null,
    screenshots: [],
    errors: [],
    failures: [],
  };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const host = await createDevice(browser, {
    userId: 992001,
    clientId: `qa-full-host-${Date.now()}`,
    name: "攻略測試船長",
  }, report);
  const guest = await createDevice(browser, {
    userId: 992002,
    clientId: `qa-full-guest-${Date.now()}`,
    name: "攻略測試夥伴",
  }, report);

  try {
    await enterRoom(host, "", true);
    const roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterRoom(guest, roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardAddCpuBtn");
    await host.page.click("#boardAddCpuBtn");
    await host.page.waitForFunction(() => document.querySelectorAll(".seat-tag.cpu").length === 2, null, { timeout: 10000 });
    report.screenshots.push(await takeShot(host.page, 1, "2真人2CPU等待室"));
    const lobbyRows = await host.page.evaluate(() => Array.from(document.querySelectorAll("#boardLobbyPlayerGrid .seat-card:not(.empty)")).map((card) => ({
      id: card.querySelector("[data-remove-cpu]")?.getAttribute("data-remove-cpu") || "",
      name: card.querySelector(".seat-name")?.textContent?.trim() || "",
      isCPU: card.classList.contains("cpu"),
      ready: Boolean(card.querySelector(".seat-tag.ready")),
    })));
    report.room = {
      roomCode,
      players: lobbyRows.map((entry) => ({ id: String(entry.id || ""), name: entry.name, isCPU: Boolean(entry.isCPU), ready: Boolean(entry.ready) })),
    };
    if (report.room.players.length !== 4 || report.room.players.filter((entry) => entry.isCPU).length !== 2) {
      report.failures.push(`lobby composition mismatch: ${JSON.stringify(report.room.players)}`);
    }
    await host.page.click("#boardStartBtn");
    await Promise.all([waitForGameReady(host), waitForGameReady(guest)]);

    const preparedRoom = await prepareMainPhase(host.page, guest.userId);
    report.room.gamePlayers = preparedRoom.players;
    report.screenshots.push(await takeShot(host.page, 2, "四人主地圖"));
    const notFull = preparedRoom.players.flatMap((entry) => entry.crew.filter((card) => Number(card.hp) !== Number(card.maxHp)).map((card) => `${entry.name}:${card.name}`));
    if (notFull.length) report.failures.push(`new challenge crew not full HP: ${notFull.join(", ")}`);

    report.turnRing = await verifyTurnRing(host.page, guest.page, preparedRoom.hostId, preparedRoom.guestId);
    const turnNames = [report.turnRing[0]?.before?.name, ...report.turnRing.map((entry) => entry.after.name)];
    if (new Set(turnNames.slice(0, 4)).size !== 4 || turnNames[0] !== turnNames[4]) {
      report.failures.push(`turn ring did not visit four unique players and return: ${turnNames.join(" -> ")}`);
    }
    await closeModalAndFreezeHost(host.page, preparedRoom.hostId, "qa-after-turn-ring");
    report.screenshots.push(await takeShot(host.page, 3, "四人輪替完成"));

    const yonko = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      return game.boardData.islands.filter((entry) => entry.kind === "yonko").map((entry) => ({ id: entry.id, name: entry.name }));
    });
    if (yonko.length !== 4) report.failures.push(`expected four Yonko islands, got ${yonko.length}`);
    for (let index = 0; index < yonko.length; index += 1) {
      const entry = yonko[index];
      const prepared = await startIslandBattle(host.page, guest.page, preparedRoom.hostId, entry.id);
      if (!prepared.sync.host.overlayOpen || !prepared.sync.guest.overlayOpen) {
        report.failures.push(`battle overlay sync failed ${prepared.bossName}: ${JSON.stringify(prepared.sync)}`);
      }
      if (prepared.sync.host.recoveredByReload || prepared.sync.guest.recoveredByReload) {
        report.failures.push(`battle view required reload to see ${prepared.bossName}: ${JSON.stringify(prepared.sync)}`);
      }
      report.screenshots.push(await takeBattleShot(host.page, 4 + index, `一周目四皇_${prepared.bossName}`));
      const settled = await forceWinAndSettle(host.page, preparedRoom.hostId);
      report.firstPlaythrough.yonko.push({ ...prepared, settled });
      if (!settled.noBattle || settled.currentPlayerId !== preparedRoom.hostId || settled.roadPoneglyphs !== index + 1) {
        report.failures.push(`Yonko settlement mismatch ${prepared.bossName}: ${JSON.stringify(settled)}`);
      }
    }

    const activation = await host.page.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      game.currentPlayerIndex = game.players.indexOf(player);
      game.resolutionLock = false;
      debug.closeModal();
      return {
        activated: debug.activateFinalIslandFromBackpack(player),
        candidate: Boolean(game.finalIslandCandidate),
        glyphs: Array.from(new Set(player.roadPoneglyphs || [])).length,
      };
    }, preparedRoom.hostId);
    if (!activation.activated || activation.glyphs !== 4) report.failures.push(`final-island activation precondition failed: ${JSON.stringify(activation)}`);
    await host.page.locator("[data-final-story-skip]").waitFor({ state: "visible", timeout: 10000 });
    report.screenshots.push(await takeShot(host.page, 8, "四拓本啟動最終之島"));
    await host.page.evaluate(() => {
      document.getElementById("turnTransitionBanner")?.classList.remove("open", "is-your-turn", "is-watch");
      document.querySelector("[data-final-story-skip]")?.click();
    });
    await host.page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getState?.().gameState?.finalIslandUnlocked === true, null, { timeout: 15000 });
    await closeModalAndFreezeHost(host.page, preparedRoom.hostId, "qa-final-island-revealed");
    report.screenshots.push(await takeShot(host.page, 9, "最終之島航路現身"));

    const imu = await prepareDirectBattle(host.page, guest.page, preparedRoom.hostId, "imu");
    if (imu.sync.host.recoveredByReload || imu.sync.guest.recoveredByReload) {
      report.failures.push(`battle view required reload to see Imu: ${JSON.stringify(imu.sync)}`);
    }
    report.screenshots.push(await takeBattleShot(host.page, 10, "伊姆最終戰"));
    const imuSettled = await forceWinAndSettle(host.page, preparedRoom.hostId);
    report.firstPlaythrough.imu = { ...imu, settled: imuSettled };
    const imuCleared = await host.page.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      return Boolean(player?.finalGateDefeated);
    }, preparedRoom.hostId);
    if (!imuCleared) report.failures.push("Imu victory did not mark final gate clear");

    await host.page.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      const island = debug.getIslandById("final-island");
      const islandState = debug.getIslandState("final-island");
      game.currentPlayerIndex = game.players.indexOf(player);
      game.resolutionLock = false;
      player.location = { kind: "island", islandId: island.id };
      debug.resolveLanding(player, island, islandState);
    }, preparedRoom.hostId);
    await host.page.locator("#finalEndingSkipBtn").waitFor({ state: "visible", timeout: 15000 });
    report.screenshots.push(await takeShot(host.page, 11, "一周目最終之島結局"));
    await host.page.evaluate(() => document.getElementById("finalEndingSkipBtn")?.click());
    await host.page.waitForFunction((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.().gameState;
      const player = game?.players?.find((entry) => String(entry.id) === String(requestedHostId));
      return Boolean(player?.finalEndingCleared && game?.postgameWorld?.unlocked);
    }, preparedRoom.hostId, { timeout: 15000 });
    await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.finishPostgameWorldCinematic());
    await closeModalAndFreezeHost(host.page, preparedRoom.hostId, "qa-postgame-world-ready");
    report.firstPlaythrough.ending = await host.page.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      return {
        endingId: player.finalEndingChoice,
        endingCleared: Boolean(player.finalEndingCleared),
        postgameUnlocked: Boolean(game.postgameWorld?.unlocked),
        islandCount: Number(game.postgameWorld?.bossOrder?.length || 0),
      };
    }, preparedRoom.hostId);
    if (!report.firstPlaythrough.ending.endingCleared || !report.firstPlaythrough.ending.postgameUnlocked || report.firstPlaythrough.ending.islandCount !== 13) {
      report.failures.push(`first ending did not unlock full postgame: ${JSON.stringify(report.firstPlaythrough.ending)}`);
    }
    report.screenshots.push(await takeShot(host.page, 12, "二周目十三孤島地圖"));

    const bossAssignments = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      debug.ensurePostgameWorldLayout(game);
      return game.postgameWorld.bossOrder.map((bossKey) => {
        const assignment = game.postgameWorld.islandAssignments.find((entry) => entry.bossKey === bossKey);
        const profile = debug.getPostgameBossProfile(bossKey);
        return { bossKey, islandId: assignment?.islandId || "", name: profile?.name || bossKey };
      });
    });
    if (bossAssignments.length !== 13 || bossAssignments.some((entry) => !entry.islandId)) {
      report.failures.push(`postgame assignment mismatch: ${JSON.stringify(bossAssignments)}`);
    }

    let shotIndex = 13;
    for (let index = 0; index < bossAssignments.length; index += 1) {
      const assignment = bossAssignments[index];
      const prepared = await startIslandBattle(host.page, guest.page, preparedRoom.hostId, assignment.islandId);
      if (!prepared.sync.host.overlayOpen || !prepared.sync.guest.overlayOpen) {
        report.failures.push(`battle overlay sync failed ${prepared.bossName}: ${JSON.stringify(prepared.sync)}`);
      }
      if (prepared.sync.host.recoveredByReload || prepared.sync.guest.recoveredByReload) {
        report.failures.push(`battle view required reload to see ${prepared.bossName}: ${JSON.stringify(prepared.sync)}`);
      }
      prepared.mechanicTitle = await openMechanicPanel(host.page).catch(() => "");
      report.screenshots.push(await takeBattleShot(host.page, shotIndex, `二周目Boss${String(index + 1).padStart(2, "0")}_${prepared.bossName}`));
      shotIndex += 1;
      if (index === 4) {
        await guest.page.reload({ waitUntil: "domcontentloaded" });
        await guest.page.waitForFunction((expectedKey) => {
          const debug = window.__BOARD_GAME_DEBUG__;
          const battle = debug?.getState?.().battleState;
          return debug?.boardLanStatus?.().connected
            && !debug.boardLanStatus().awaitingInitialState
            && String(battle?.postgameBossKey || battle?.enemyCombatant?.key || "") === String(expectedKey)
            && document.getElementById("battlePageOverlay")?.classList.contains("open");
        }, prepared.bossKey, { timeout: 20000 });
        report.refreshCheckpoint = await guest.page.evaluate(() => {
          const debug = window.__BOARD_GAME_DEBUG__;
          const battle = debug.getState().battleState;
          return {
            connected: debug.boardLanStatus().connected,
            awaitingInitialState: debug.boardLanStatus().awaitingInitialState,
            bossKey: battle?.postgameBossKey || battle?.enemyCombatant?.key || "",
            overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
          };
        });
        report.screenshots.push(await takeShot(guest.page, shotIndex, "觀戰玩家重整後仍在同一Boss"));
        shotIndex += 1;
      }
      const settled = await forceWinAndSettle(host.page, preparedRoom.hostId);
      const islandReset = await host.page.evaluate((islandId) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const islandState = debug.getIslandState(islandId);
        return {
          currentHp: Number(islandState?.currentHp || 0),
          maxHp: Number(islandState?.maxHp || 0),
          defeated: Boolean(islandState?.isDefeated),
        };
      }, assignment.islandId);
      report.secondPlaythrough.bosses.push({ ...prepared, settled, islandReset });
      if (!settled.noBattle || settled.yorkClues !== index + 1 || islandReset.currentHp !== islandReset.maxHp || islandReset.defeated) {
        report.failures.push(`postgame settlement mismatch ${prepared.bossName}: ${JSON.stringify({ settled, islandReset })}`);
      }
    }

    const cluesBeforeLoki = report.secondPlaythrough.bosses.at(-1)?.settled?.yorkClues || 0;
    const loki = await prepareDirectBattle(host.page, guest.page, preparedRoom.hostId, "loki");
    if (loki.sync.host.recoveredByReload || loki.sync.guest.recoveredByReload) {
      report.failures.push(`battle view required reload to see Loki: ${JSON.stringify(loki.sync)}`);
    }
    report.screenshots.push(await takeBattleShot(host.page, shotIndex, "洛基王子試煉"));
    shotIndex += 1;
    const lokiSettled = await forceWinAndSettle(host.page, preparedRoom.hostId);
    report.secondPlaythrough.loki = { ...loki, settled: lokiSettled };
    if (lokiSettled.yorkClues !== cluesBeforeLoki) report.failures.push("Loki trial incorrectly changed 13-clue count");

    report.secondPlaythrough.york = await host.page.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      game.currentPlayerIndex = game.players.indexOf(player);
      game.resolutionLock = false;
      const before = {
        canActivate: debug.canActivateYorkTracking(player),
        clueEntries: debug.getPostgameBossVoyageEntries(player).filter((entry) => Number(entry.currentClueCount || 0) > 0).length,
      };
      debug.grantYorkDecoderTier(player, 1, { source: "full_campaign_qa" });
      const revealed = debug.completeYorkTrackingActivation(player, { skipCinematic: true, immediate: true });
      state.boardUiEvent = null;
      game.resolutionLock = true;
      debug.closeModal();
      debug.renderAll();
      debug.pushBoardLanState("qa-york-egghead-reveal");
      return {
        ...before,
        revealed,
        eggheadUnlocked: Boolean(game.postgameWorld?.eggheadUnlocked),
        decoderTier: Number(player.yorkDecoderTier || player.postgameYorkDecoderTier || 0),
        eggheadIslandId: debug.getPostgameEggheadIsland()?.id || "",
      };
    }, preparedRoom.hostId);
    if (!report.secondPlaythrough.york.canActivate || !report.secondPlaythrough.york.revealed || !report.secondPlaythrough.york.eggheadUnlocked) {
      report.failures.push(`York/Egghead reveal failed: ${JSON.stringify(report.secondPlaythrough.york)}`);
    }
    report.screenshots.push(await takeShot(host.page, shotIndex, "約克解碼後蛋頭島現身"));
    shotIndex += 1;

    const rocks = await prepareDirectBattle(host.page, guest.page, preparedRoom.hostId, "rocks");
    if (rocks.sync.host.recoveredByReload || rocks.sync.guest.recoveredByReload) {
      report.failures.push(`battle view required reload to see Rocks: ${JSON.stringify(rocks.sync)}`);
    }
    rocks.mechanicTitle = await openMechanicPanel(host.page).catch(() => "");
    report.screenshots.push(await takeBattleShot(host.page, shotIndex, "洛克斯終戰"));
    const rocksSettled = await forceWinAndSettle(host.page, preparedRoom.hostId);
    report.secondPlaythrough.rocks = { ...rocks, settled: rocksSettled };
    const rocksRewards = await host.page.evaluate((requestedHostId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const player = game.players.find((entry) => String(entry.id) === String(requestedHostId));
      const lab = debug.ensurePlayerResearchLabState(player);
      return {
        researchPoints: Number(lab.researchPoints || 0),
        perfectLineageCores: debug.inventoryItemCount(player, "perfect_lineage_core"),
        battleCleared: !debug.getState().battleState,
      };
    }, preparedRoom.hostId);
    report.secondPlaythrough.rocks.rewards = rocksRewards;
    if (!rocksRewards.battleCleared || rocksRewards.perfectLineageCores < 1 || rocksRewards.researchPoints < 25) {
      report.failures.push(`Rocks rewards/settlement failed: ${JSON.stringify(rocksRewards)}`);
    }

    await guest.page.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.().gameState;
      return Boolean(
        debug?.boardLanStatus?.().connected
        && !debug.boardLanStatus().awaitingInitialState
        && !debug.boardLanStatus().applying
        && game?.postgameWorld?.eggheadUnlocked
        && !debug.getState().battleState
      );
    }, null, { timeout: 20000 });
    const finalSync = await guest.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      return {
        connected: debug.boardLanStatus().connected,
        players: game.players.length,
        cpuPlayers: game.players.filter((entry) => entry.isCPU).length,
        postgameUnlocked: Boolean(game.postgameWorld?.unlocked),
        eggheadUnlocked: Boolean(game.postgameWorld?.eggheadUnlocked),
        battleActive: Boolean(debug.getState().battleState),
      };
    });
    report.finalSync = finalSync;
    if (!finalSync.connected || finalSync.players !== 4 || finalSync.cpuPlayers !== 2 || !finalSync.postgameUnlocked || !finalSync.eggheadUnlocked || finalSync.battleActive) {
      report.failures.push(`final guest sync mismatch: ${JSON.stringify(finalSync)}`);
    }
  } catch (error) {
    report.failures.push(`fatal:${error.stack || error.message}`);
  } finally {
    report.finishedAt = new Date().toISOString();
    report.ok = report.failures.length === 0 && report.errors.length === 0;
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify({
      ok: report.ok,
      report: REPORT_PATH,
      screenshots: report.screenshots.length,
      firstPlaythroughBosses: report.firstPlaythrough.yonko.length + (report.firstPlaythrough.imu ? 1 : 0),
      postgameBosses: report.secondPlaythrough.bosses.length + (report.secondPlaythrough.loki ? 1 : 0) + (report.secondPlaythrough.rocks ? 1 : 0),
      failures: report.failures,
      errors: report.errors,
    }, null, 2));
    await Promise.allSettled([host.context.close(), guest.context.close()]);
    await browser.close();
    if (!report.ok) process.exitCode = 1;
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
