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

async function createDevice(browser, profile, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
  }, profile);
  const page = await context.newPage();
  captureErrors(page, errors, profile.name);
  await page.goto(`${ROOT_URL}/board_start.html?qa=${encodeURIComponent(profile.name)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 15000 });
  await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 10000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth", null, { timeout: 10000 });
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app", null, { timeout: 10000 });
  const localUserId = await page.evaluate(() => Number(localStorage.getItem("op_board_user_id") || 0));
  return { ...profile, userId: localUserId || profile.userId, context, page };
}

async function enterRoom(device, roomCode, create = false) {
  await device.page.click("#openBoardFlowBtn");
  if (create) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction((expected) => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    const lobbyVisible = document.querySelector('section[data-view="lobby"]')?.classList.contains("active");
    return lobbyVisible && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, roomCode, { timeout: 12000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const failures = [];
  const host = await createDevice(browser, {
    userId: 880001,
    clientId: "qa-refresh-flow-host",
    name: "刷新流程房主",
  }, errors);
  const guest = await createDevice(browser, {
    userId: 880002,
    clientId: "qa-refresh-flow-guest",
    name: "刷新流程玩家",
  }, errors);

  try {
    await enterRoom(host, "", true);
    const roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterRoom(guest, roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardStartBtn");
    await Promise.all([host.page, guest.page].map((page) => page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 15000 })));
    await Promise.all([host.page, guest.page].map((page) => page.waitForFunction(() => (
      window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().connected
    ), null, { timeout: 20000 })));
    await guest.page.waitForTimeout(700);

    await guest.page.reload({ waitUntil: "domcontentloaded" });
    await guest.page.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      return debug?.boardLanStatus?.().connected && !debug.boardLanStatus().awaitingInitialState;
    }, null, { timeout: 20000 });
    const identity = await guest.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const local = debug.getLocalBoardPlayer();
      return {
        localUserId: Number(local?.userId || local?.id || 0),
        localName: local?.name || "",
        isHost: Number(debug.getState().lobby?.hostUserId || 0) === Number(local?.userId || local?.id || 0),
      };
    });
    if (identity.localUserId !== guest.userId || identity.isHost) {
      failures.push(`guest refresh identity mismatch: ${JSON.stringify(identity)}`);
    }

    const turnHandoffTarget = await host.page.evaluate(({ guestUserId }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const hostPlayer = game.players.find((player) => Number(player.userId || player.id) !== Number(guestUserId) && !player.isCPU);
      const guestPlayer = game.players.find((player) => Number(player.userId || player.id) === Number(guestUserId));
      game.phase = "main";
      game.currentPlayerIndex = game.players.indexOf(hostPlayer);
      game.turnStep = "擲骰前進";
      game.resolutionLock = false;
      game.pendingMove = null;
      game.battleExitLock = false;
      state.battleState = null;
      state.boardUiEvent = null;
      debug.closeModal();
      debug.renderAll();
      debug.endTurn();
      return String(guestPlayer.id);
    }, { guestUserId: guest.userId });
    await guest.page.waitForFunction((expectedPlayerId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.().gameState;
      return String(game?.players?.[game.currentPlayerIndex]?.id || "") === expectedPlayerId
        && !debug.boardLanStatus().applying;
    }, turnHandoffTarget, { timeout: 8000 });
    const turnHandoff = await guest.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      return {
        currentPlayerId: String(game.players[game.currentPlayerIndex]?.id || ""),
        version: debug.boardLanStatus().version,
      };
    });
    if (turnHandoff.currentPlayerId !== turnHandoffTarget) {
      failures.push(`turn-banner deferred apply did not advance guest: ${JSON.stringify(turnHandoff)}`);
    }

    const prepared = await host.page.evaluate(({ guestUserId }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const players = game.players;
      const hostPlayer = players.find((player) => Number(player.userId || player.id) !== Number(guestUserId) && !player.isCPU);
      const guestPlayer = players.find((player) => Number(player.userId || player.id) === Number(guestUserId));
      const sources = window.BoardCards.cards.slice(0, 12);
      const freshRows = sources.map((source) => {
        const recruit = debug.cloneFreshDraftRecruit(source);
        return { name: recruit.name, hp: Number(recruit.currentHp), maxHp: Number(recruit.baseStats?.hp || 0) };
      });
      hostPlayer.crew = sources.slice(0, 3).map((source) => debug.cloneFreshDraftRecruit(source));
      guestPlayer.crew = sources.slice(3, 6).map((source) => debug.cloneFreshDraftRecruit(source));
      hostPlayer.activeCrewIndex = 0;
      guestPlayer.activeCrewIndex = 0;
      debug.recalcPlayerDerivedStats(hostPlayer);
      debug.recalcPlayerDerivedStats(guestPlayer);
      game.phase = "main";
      game.currentPlayerIndex = players.indexOf(hostPlayer);
      game.resolutionLock = false;
      game.pendingMove = null;
      const island = game.boardData.islands.find((entry) => debug.getIslandState(entry.id)?.enemyProfile);
      const islandState = debug.getIslandState(island.id);
      hostPlayer.location = { kind: "island", islandId: island.id };
      guestPlayer.location = { kind: "island", islandId: island.id };
      debug.closeModal();
      debug.startBattle(hostPlayer, island, islandState);
      const pending = structuredClone(state.battleState);
      pending.playerId = guestPlayer.id;
      pending.playerName = guestPlayer.name;
      pending.activeCrewIndex = 0;
      guestPlayer.pendingBattle = structuredClone(pending);
      hostPlayer.pendingBattle = null;
      state.battleState = null;
      state.boardUiEvent = null;
      game.currentPlayerIndex = players.indexOf(guestPlayer);
      game.resolutionLock = false;
      game.battleExitLock = false;
      game.turnStep = "待續戰鬥";
      debug.closeModal();
      debug.renderAll();
      debug.pushBoardLanState("qa-turn-end");
      return {
        freshRows,
        hostId: String(hostPlayer.id),
        guestId: String(guestPlayer.id),
        islandId: island.id,
      };
    }, { guestUserId: guest.userId });

    const notFull = prepared.freshRows.filter((entry) => entry.hp !== entry.maxHp);
    if (notFull.length) failures.push(`fresh draft recruits are not full HP: ${JSON.stringify(notFull)}`);

    await guest.page.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      return !!debug?.getState?.().battleState
        && document.getElementById("battlePageOverlay")?.classList.contains("open");
    }, null, { timeout: 15000 });
    await host.page.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      return !!debug?.getState?.().battleState
        && document.getElementById("battlePageOverlay")?.classList.contains("open");
    }, null, { timeout: 15000 });

    const [guestBattle, hostBattle] = await Promise.all([guest.page, host.page].map((page) => page.evaluate(() => ({
      playerId: String(window.__BOARD_GAME_DEBUG__.getState().battleState?.playerId || ""),
      overlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("open") || false,
      lanApplying: window.__BOARD_GAME_DEBUG__.boardLanStatus().applying,
    }))));
    if (!guestBattle.overlayOpen || !hostBattle.overlayOpen) failures.push("resumed battle was not visible on both devices");
    if (guestBattle.playerId !== prepared.guestId || hostBattle.playerId !== prepared.guestId) {
      failures.push(`resumed battle owner mismatch: ${guestBattle.playerId}/${hostBattle.playerId}`);
    }

    console.log(JSON.stringify({
      ok: failures.length === 0 && errors.length === 0,
      roomCode,
      identity,
      turnHandoff,
      freshRecruitCount: prepared.freshRows.length,
      guestBattle,
      hostBattle,
      failures,
      errors,
    }, null, 2));
    process.exitCode = failures.length || errors.length ? 1 : 0;
  } finally {
    await Promise.all([host.context.close(), guest.context.close()]);
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
