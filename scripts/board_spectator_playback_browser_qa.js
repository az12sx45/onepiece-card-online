const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18919";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-spectator-playback-20260919";
const VIEWPORT = { width: Number(process.env.BOARD_QA_WIDTH || 1280), height: Number(process.env.BOARD_QA_HEIGHT || 720) };
const QUICK_DICE = process.env.BOARD_QA_QUICK_DICE === "1";

async function createDevice(browser, profile, errors) {
  const context = await browser.newContext({ viewport: VIEWPORT });
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    // Capture the production socket before board_game.js creates it. No second
    // connection or production-only test hook is introduced by this fixture.
    window.__playbackQaWire = [];
    window.__playbackQaHeldBattleParts = [];
    window.__playbackQaReleaseBattleParts = () => {
      window.__playbackQaHoldBattleParts = false;
      const pending = window.__playbackQaHeldBattleParts.splice(0);
      pending.forEach((deliver) => deliver());
      return pending.length;
    };
    let originalIo;
    Object.defineProperty(window, "io", {
      configurable: true,
      get: () => originalIo,
      set(value) {
        originalIo = new Proxy(value, {
          apply(target, thisArg, args) {
            const socket = Reflect.apply(target, thisArg, args);
            const socketEmit = socket.emit;
            socket.emit = function tracedEmit(eventName, ...values) {
              const heldEvent = values[0]?.event;
              if (eventName === "BOARD_GAME_EVENT" && window.__playbackQaHoldBattleParts
                && heldEvent?.type === "visual-part" && Number(heldEvent.index) > 0) {
                window.__playbackQaHeldBattleParts.push(() => this.emit(eventName, ...values));
                return this;
              }
              if (eventName === "BOARD_GAME_EVENT") {
                const message = values[0] || {};
                const event = message.event || {};
                const record = {
                  id: event.id || "", channel: event.channel || "", type: event.type || "",
                  eventId: event.visualId || event.eventId || "", transferId: event.transferId || "",
                  index: event.index ?? event.chunkIndex ?? null,
                  count: event.total ?? event.count ?? event.chunkCount ?? null,
                  bytes: new TextEncoder().encode(JSON.stringify(event)).length,
                  messageBytes: new TextEncoder().encode(JSON.stringify(message)).length,
                  ack: null,
                };
                window.__playbackQaWire.push(record);
                const callbackIndex = values.length - 1;
                if (typeof values[callbackIndex] === "function") {
                  const callback = values[callbackIndex];
                  values[callbackIndex] = (...callbackValues) => {
                    record.ack = callbackValues[0] || null;
                    return callback(...callbackValues);
                  };
                }
              }
              return socketEmit.call(this, eventName, ...values);
            };
            window.__playbackQaSocket = socket;
            return socket;
          },
        });
      },
    });
  }, profile);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`${profile.name}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${profile.name}:console:${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      errors.push(`${profile.name}:http:${response.status()}:${response.url()}`);
    }
  });
  await page.goto(`${ROOT_URL}/board_start.html?playback_qa=${encodeURIComponent(profile.name)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 15000 });
  await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 10000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth", null, { timeout: 10000 });
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app", null, { timeout: 10000 });
  return { ...profile, userId: await page.evaluate(() => Number(localStorage.getItem("op_board_user_id"))), context, page };
}

async function enterRoom(device, roomCode, create) {
  await device.page.click("#openBoardFlowBtn");
  if (create) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction((expected) => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    return document.querySelector('section[data-view="lobby"]')?.classList.contains("active")
      && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, roomCode, { timeout: 12000 });
}

async function waitForGame(device) {
  await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 15000 });
  await device.page.waitForFunction(() => {
    const status = window.__BOARD_GAME_DEBUG__?.boardLanStatus?.();
    return status?.connected && !status.awaitingInitialState && !status.applying && window.__playbackQaSocket?.connected;
  }, null, { timeout: 20000 });
}

async function emitEvents(host, roomCode, events) {
  return host.page.evaluate(({ code, entries }) => Promise.all(entries.map((event) => new Promise((resolve) => {
    window.__playbackQaSocket.emit("BOARD_GAME_EVENT", {
      roomCode: code,
      sourceClientId: localStorage.getItem("op_board_client_id"),
      event,
    }, resolve);
  }))), { code: roomCode, entries: events });
}

async function battlePlaybackCheck(host, guest, report, stamp, roomCode) {
  // The modal snapshot above intentionally used the wire protocol directly.
  // Restore the host's version before continuing through production pushes.
  await host.page.reload({ waitUntil: "domcontentloaded" });
  await waitForGame(host);
  let releaseBattleScript;
  const scriptGate = new Promise((resolve) => { releaseBattleScript = resolve; });
  let markBattleScriptRequested;
  const scriptRequested = new Promise((resolve) => { markBattleScriptRequested = resolve; });
  let scriptHeld = false;
  await guest.page.route("**/js/board_battle.js*", async (route) => {
    scriptHeld = true;
    markBattleScriptRequested();
    await scriptGate;
    await route.continue();
  });
  try {
    await guest.page.evaluate(() => {
      window.__battleTrace = [];
      window.__battleTraceTimer = setInterval(() => {
        const overlay = document.getElementById("battlePageOverlay");
        const frame = document.getElementById("battlePageFrame");
        const battleDebug = frame?.contentWindow?.__BOARD_BATTLE_DEBUG__;
        const view = battleDebug?.latestView?.();
        const playback = battleDebug?.spectatorPlaybackState?.();
        const row = {
          t: Date.now(), loaded: Boolean(frame?.dataset.loaded),
          open: overlay?.classList.contains("open") || false,
          closing: overlay?.classList.contains("closing") || false,
          id: playback?.eventId || "", pending: playback?.pending || 0,
          active: playback?.active || false, type: view?.battle?.visualEvent?.type || "",
          canControl: view?.battle?.canControl ?? null, canAct: view?.battle?.canAct ?? null,
          logLines: view?.battle?.log?.length || 0,
          logTail: String(view?.battle?.log?.at(-1) || "").slice(-70),
          diceOpen: frame?.contentDocument?.getElementById("diceBonusFx")?.classList.contains("active") || false,
          mapDiceOpen: document.getElementById("diceHud")?.classList.contains("open") || false,
          mapDiceTitle: document.getElementById("diceHudTitle")?.textContent || "",
        };
        const previous = window.__battleTrace.at(-1);
        if (!previous || Object.keys(row).some((key) => key !== "t" && row[key] !== previous[key])) window.__battleTrace.push(row);
      }, 15);
    });
    report.battleFixture = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const player = debug.getLocalBoardPlayer();
      player.crew = window.BoardCards.cards.slice(0, 3).map((card) => debug.cloneFreshDraftRecruit(card));
      player.activeCrewIndex = 0;
      debug.recalcPlayerDerivedStats(player);
      const island = state.gameState.boardData.islands.find((entry) => debug.getIslandState(entry.id)?.enemyProfile);
      player.location = { kind: "island", islandId: island.id };
      state.boardUiEvent = null;
      debug.closeModal();
      debug.startBattle(player, island, debug.getIslandState(island.id));
      const battle = state.battleState;
      if (battle.prebattleIntro) battle.prebattleIntro.done = true;
      battle.openingPassiveVisualQueue = [];
      battle.openingPassiveVisualAnimating = false;
      battle.animating = false;
      battle.visualEvent = null;
      debug.notifyBattleWindow();
      debug.pushBoardLanState("qa-playback-battle-start");
      return { playerId: String(player.id), islandId: island.id };
    });
    await guest.page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getState?.().battleState, null, { timeout: 15000 });
    await Promise.race([scriptRequested, new Promise((_, reject) => setTimeout(() => reject(new Error("battle script request not intercepted")), 12000))]);
    report.battleEvents = await host.page.evaluate((suffix) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const battle = debug.getState().battleState;
      // A real getBattleView includes the accumulated battle log. Exercise the
      // production sender with a controlled long multilingual battle history.
      battle.log.push(...Array.from({ length: 180 }, (_, index) => (
        `大型觀看事件 ${index}：中文招式紀錄、日本語バトル、한국어 전투、🎲⚓\\\"\n`.repeat(4)
      )));
      window.__playbackQaWire = [];
      const base = debug.getBattleView();
      const events = [
        { id: `qa-battle-dice-${suffix}`, type: "dice", side: "player", theme: "attack", title: "觀看連續戰鬥骰子", subtitle: "決定攻擊", maxFace: 6, settle: 4, duration: 1200, moveType: "attack" },
        { id: `qa-battle-attack-${suffix}`, type: "attack", side: "player", targetSide: "enemy", actorName: base.player?.activeCard?.name || "玩家", targetName: battle.enemyCombatant.name, moveName: "觀看連續攻擊", moveType: "attack", damage: 12, hitDamages: [12], diceFace: 4, duration: 1650 },
      ];
      return events.map((event) => {
        battle.visualEvent = event;
        debug.notifyBattleWindow();
        const wireEvent = { id: event.id, channel: "battle", type: "visual", view: debug.getBattleView() };
        wireEvent.view.battle.canControl = false;
        return { id: event.id, type: event.type, duration: event.duration,
          sourceBytes: new TextEncoder().encode(JSON.stringify(wireEvent)).length, logLines: battle.log.length,
          logTail: String(battle.log.at(-1)).slice(-70) };
      });
    }, stamp);
    await guest.page.waitForTimeout(180);
    report.battleScriptBuffered = scriptHeld;
    releaseBattleScript();
    await guest.page.waitForFunction((id) => document.getElementById("battlePageFrame")?.contentWindow?.__BOARD_BATTLE_DEBUG__?.spectatorPlaybackState?.().eventId === id,
      report.battleEvents[0].id, { timeout: 15000 });
    // Capture after the card entrance reveal, while the queued dice still runs.
    await guest.page.waitForTimeout(800);
    await guest.page.screenshot({ path: path.join(OUTPUT_DIR, "spectator-battle-desktop-dice.png") });
    await guest.page.setViewportSize({ width: 390, height: 844 });
    await guest.page.waitForTimeout(150);
    await guest.page.screenshot({ path: path.join(OUTPUT_DIR, "spectator-battle-mobile-portrait.png") });
    await guest.page.setViewportSize({ width: 844, height: 390 });
    await guest.page.waitForTimeout(150);
    await guest.page.screenshot({ path: path.join(OUTPUT_DIR, "spectator-battle-mobile-landscape.png") });
    report.battleReadonly = await guest.page.evaluate(() => {
      const api = window.__BOARD_GAME_DEBUG__;
      const before = JSON.stringify(api.getState().battleState?.playerAction || null);
      const view = api.getBattleView();
      const moveId = view?.activeCard?.moves?.[0]?.id || view?.activeCard?.moveSet?.[0]?.id || "qa-invalid-move";
      const result = api.battleChooseMove(moveId);
      return { result: result ?? null, before, after: JSON.stringify(api.getState().battleState?.playerAction || null), canControl: view?.battle?.canControl };
    });
    report.battleTerminalAt = Date.now();
    await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      state.battleState = null;
      state.boardUiEvent = null;
      state.gameState.players.forEach((player) => { player.pendingBattle = null; });
      state.gameState.resolutionLock = false;
      state.gameState.battleExitLock = false;
      state.gameState.turnStep = "擲骰前進";
      debug.renderAll();
      debug.notifyBattleWindow();
      debug.pushBoardLanState("battle-finish");
    });
    const mapDiceCreatedAt = Date.now();
    report.afterBattleMapAck = await emitEvents(host, roomCode, [{
      id: `qa-afterbattle-map-${stamp}`, channel: "ui", type: "dice", title: "戰後地圖骰子",
      subtitle: "戰鬥完整播放後才出現", theme: "move", maxFace: 6, result: 3, settleDelay: 260,
      createdAt: mapDiceCreatedAt, expiresAt: mapDiceCreatedAt + 12000,
    }]);
    await guest.page.waitForTimeout(180);
    report.battleAfterTerminal = await guest.page.evaluate(() => ({
      open: document.getElementById("battlePageOverlay")?.classList.contains("open"),
      playback: document.getElementById("battlePageFrame")?.contentWindow?.__BOARD_BATTLE_DEBUG__?.spectatorPlaybackState?.(),
    }));
    await guest.page.waitForFunction(() => !document.getElementById("battlePageOverlay")?.classList.contains("open"), null, { timeout: 12000 });
    await guest.page.waitForFunction(() => document.getElementById("diceHudTitle")?.textContent === "戰後地圖骰子"
      && document.getElementById("diceHud")?.classList.contains("open"), null, { timeout: 10000 });
    await guest.page.waitForFunction(() => !document.getElementById("diceHud")?.classList.contains("open"), null, { timeout: 6000 });
    report.battleTrace = await guest.page.evaluate(() => { clearInterval(window.__battleTraceTimer); return window.__battleTrace; });
    report.battleWireFrames = await host.page.evaluate(() => window.__playbackQaWire.filter((entry) => entry.channel === "battle"));
    report.battleHolds = report.battleEvents.map((event) => {
      const start = report.battleTrace.findIndex((row) => row.id === event.id && row.active);
      const end = start < 0 ? null : report.battleTrace.slice(start + 1).find((row) => row.id !== event.id || !row.active);
      return { id: event.id, durationMs: start >= 0 && end ? end.t - report.battleTrace[start].t : 0 };
    });
    if (!report.battleScriptBuffered) report.failures.push("late iframe fixture did not hold battle script");
    if (report.battleEvents.some((event) => event.sourceBytes <= 65536)) report.failures.push("large battle fixture did not exceed the server event size limit");
    if (report.battleWireFrames.length < 4 || report.battleWireFrames.some((frame) => frame.type === "visual")) report.failures.push("large production battle events were not transmitted as chunks");
    if (report.battleWireFrames.some((frame) => frame.bytes > 65536 || frame.messageBytes > 65536)) report.failures.push("battle chunk exceeds the server event size limit");
    if (report.battleWireFrames.some((frame) => frame.ack?.ok !== true)) report.failures.push("battle chunk was not acknowledged by the server");
    for (const event of report.battleEvents) {
      const frames = report.battleWireFrames.filter((frame) => frame.eventId === event.id);
      if (!frames.length || frames.length !== frames[0].count || frames.some((frame, index) => frame.index !== index)) report.failures.push(`incomplete outgoing battle chunk sequence: ${event.id}`);
      const displayed = report.battleTrace.find((row) => row.id === event.id && row.active);
      if (!displayed || displayed.logLines !== event.logLines || displayed.logTail !== event.logTail) report.failures.push(`chunked battle view lost multilingual log content: ${event.id}`);
    }
    if (report.battleHolds[0].durationMs < 1770 || report.battleHolds[1].durationMs < 2020) report.failures.push(`battle events cut short: ${JSON.stringify(report.battleHolds)}`);
    const battleEventOrder = [...new Set(report.battleTrace.filter((row) => row.active && row.id).map((row) => row.id))];
    if (JSON.stringify(battleEventOrder) !== JSON.stringify(report.battleEvents.map((event) => event.id))) report.failures.push(`battle FIFO order mismatch: ${JSON.stringify(battleEventOrder)}`);
    const earlyVisual = report.battleTrace.find((row) => row.active && !row.open);
    if (earlyVisual) report.failures.push(`battle playback started behind hidden overlay: ${earlyVisual.id}`);
    report.afterBattleMapStart = report.battleTrace.find((row) => row.mapDiceOpen && row.mapDiceTitle === "戰後地圖骰子");
    if (!report.afterBattleMapStart || report.afterBattleMapStart.active || report.afterBattleMapStart.open) report.failures.push("map dice started before battle visuals and overlay finished");
    if (!report.battleAfterTerminal.open || !report.battleAfterTerminal.playback?.active) report.failures.push("terminal snapshot closed battle before queued visuals ended");
    if (report.battleReadonly.canControl !== false || report.battleReadonly.before !== report.battleReadonly.after) report.failures.push("spectator battle command mutated authoritative action");
  } finally {
    releaseBattleScript();
    await guest.page.unroute("**/js/board_battle.js*");
  }
}

async function battleControlHandoffCheck(host, guest, report, stamp, roomCode) {
  report.handoffGuestId = await host.page.evaluate((guestUserId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = debug.getLocalBoardPlayer();
    const next = state.gameState.players.find((entry) => Number(entry.userId || entry.id) === guestUserId);
    next.crew = window.BoardCards.cards.slice(0, 3).map((card) => debug.cloneFreshDraftRecruit(card));
    next.activeCrewIndex = 0;
    debug.recalcPlayerDerivedStats(next);
    const island = state.gameState.boardData.islands.find((entry) => debug.getIslandState(entry.id)?.enemyProfile);
    player.location = { kind: "island", islandId: island.id };
    debug.startBattle(player, island, debug.getIslandState(island.id));
    if (state.battleState.prebattleIntro) state.battleState.prebattleIntro.done = true;
    state.battleState.openingPassiveVisualQueue = [];
    state.battleState.openingPassiveVisualAnimating = false;
    state.battleState.animating = false;
    state.battleState.visualEvent = null;
    debug.notifyBattleWindow();
    debug.pushBoardLanState("qa-handoff-battle-start");
    return String(next.id);
  }, guest.userId);
  await guest.page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getState?.().battleState
    && document.getElementById("battlePageOverlay")?.classList.contains("ready"), null, { timeout: 15000 });
  await host.page.evaluate((suffix) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    for (const index of [1, 2]) {
      debug.getState().battleState.visualEvent = {
        id: `qa-handoff-dice-${index}-${suffix}`, type: "dice", side: "player", theme: "attack",
        title: `交棒前骰子 ${index}`, maxFace: 6, settle: index + 2, duration: 1200, moveType: "attack",
      };
      debug.notifyBattleWindow();
    }
  }, stamp);
  await guest.page.waitForFunction(() => document.getElementById("battlePageFrame")?.contentWindow?.__BOARD_BATTLE_DEBUG__?.spectatorPlaybackState?.().active, null, { timeout: 8000 });
  await host.page.waitForFunction(() => !window.__BOARD_GAME_DEBUG__.boardLanStatus().hasInFlightState, null, { timeout: 8000 });
  report.handoffAck = await host.page.evaluate(({ id, code }) => new Promise((resolve) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const payload = debug.createManualSavePayload();
    const next = payload.gameState.players.find((entry) => String(entry.id) === id);
    payload.gameState.currentPlayerIndex = payload.gameState.players.indexOf(next);
    payload.battleState.playerId = next.id;
    payload.battleState.playerName = next.name;
    payload.battleState.activeCrewIndex = 0;
    payload.battleState.playerAction = null;
    payload.battleState.visualEvent = null;
    payload.battleState.animating = false;
    payload.battleState.roundResolved = false;
    const version = debug.boardLanStatus().version;
    window.__playbackQaSocket.emit("BOARD_GAME_STATE", { roomCode: code, payload, baseVersion: version, version: version + 1, reason: "turn-end" }, resolve);
  }), { id: report.handoffGuestId, code: roomCode });
  await guest.page.waitForFunction((id) => String(window.__BOARD_GAME_DEBUG__?.getState?.().battleState?.playerId) === id,
    report.handoffGuestId, { timeout: 8000 });
  report.handoffDuringPlayback = await guest.page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const view = debug.getBattleView();
    const playback = document.getElementById("battlePageFrame").contentWindow.__BOARD_BATTLE_DEBUG__.spectatorPlaybackState();
    const moveId = view.activeCard.moves[0].id;
    const before = JSON.stringify(debug.getState().battleState.playerAction || null);
    const result = debug.battleChooseMove(moveId);
    return { playback, canControl: view.battle.canControl, canAct: view.battle.canAct, moveId, before,
      after: JSON.stringify(debug.getState().battleState.playerAction || null), result: result ?? null };
  });
  if (!report.handoffAck?.ok) report.failures.push(`handoff snapshot rejected: ${JSON.stringify(report.handoffAck)}`);
  const during = report.handoffDuringPlayback;
  if (!during.playback.active || during.canControl || during.canAct || during.before !== during.after) report.failures.push("new controller accepted command before spectator playback finished");
  await guest.page.waitForFunction(() => !document.getElementById("battlePageFrame").contentWindow.__BOARD_BATTLE_DEBUG__.spectatorPlaybackState().active,
    null, { timeout: 10000 });
  report.handoffAfterPlayback = await guest.page.evaluate(() => {
    const view = window.__BOARD_GAME_DEBUG__.getBattleView();
    return { playerId: String(view.player.id), canControl: view.battle.canControl, canAct: view.battle.canAct };
  });
  if (!report.handoffAfterPlayback.canControl || !report.handoffAfterPlayback.canAct) report.failures.push("new controller did not regain input after playback drained");
}

async function interleavedBattleIngressCheck(host, guest, report, stamp, roomCode) {
  // Guest now owns the battle after the real handoff. Reload the previous host
  // to receive that authoritative ownership before observing guest's actions.
  await host.page.reload({ waitUntil: "domcontentloaded" });
  await waitForGame(host);
  await host.page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    return debug.getBattleView()?.battle?.canControl === false
      && document.getElementById("battlePageOverlay")?.classList.contains("ready");
  }, null, { timeout: 15000 });
  await host.page.evaluate(() => {
    window.__interleavedTrace = [];
    window.__interleavedTimer = setInterval(() => {
      const overlay = document.getElementById("battlePageOverlay");
      const viewer = document.getElementById("battlePageFrame")?.contentWindow?.__BOARD_BATTLE_DEBUG__;
      const playback = viewer?.spectatorPlaybackState?.();
      const row = {
        t: Date.now(), id: playback?.eventId || "", active: playback?.active || false,
        pending: playback?.pending || 0, open: overlay?.classList.contains("open") || false,
        closing: overlay?.classList.contains("closing") || false,
        hasBattle: Boolean(window.__BOARD_GAME_DEBUG__.getState().battleState),
        mapOpen: document.getElementById("diceHud")?.classList.contains("open") || false,
        mapTitle: document.getElementById("diceHudTitle")?.textContent || "",
      };
      const previous = window.__interleavedTrace.at(-1);
      if (!previous || Object.keys(row).some((key) => key !== "t" && row[key] !== previous[key])) window.__interleavedTrace.push(row);
    }, 15);
  });
  try {
    report.interleavedEvents = await guest.page.evaluate((suffix) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const battle = debug.getState().battleState;
      battle.log.push(...Array.from({ length: 180 }, (_, index) => `分段交錯 ${index} 中文・日本語・한국어・🎲⚓`.repeat(8)));
      window.__playbackQaWire = [];
      window.__playbackQaHoldBattleParts = true;
      const events = [
        { id: `qa-interleaved-dice-${suffix}`, type: "dice", side: "player", theme: "attack", title: "分段交錯骰子", maxFace: 6, settle: 4, duration: 1200, moveType: "attack" },
        { id: `qa-interleaved-attack-${suffix}`, type: "attack", side: "player", targetSide: "enemy", actorName: "玩家", targetName: battle.enemyCombatant.name, moveName: "分段交錯攻擊", moveType: "attack", damage: 12, hitDamages: [12], diceFace: 4, duration: 1650 },
      ];
      return events.map((event) => {
        battle.visualEvent = event;
        debug.notifyBattleWindow();
        const view = debug.getBattleView();
        view.battle.canControl = false;
        return { id: event.id, sourceBytes: new TextEncoder().encode(JSON.stringify({ id: event.id, channel: "battle", type: "visual", view })).length };
      });
    }, stamp);
    await guest.page.waitForFunction(() => {
      const firstParts = window.__playbackQaWire.filter((entry) => entry.type === "visual-part" && entry.index === 0);
      return firstParts.length === 2 && firstParts.every((entry) => entry.ack?.ok);
    }, null, { timeout: 8000 });
    report.interleavedTerminalVersionBefore = await guest.page.evaluate(() => window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
    await guest.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      state.battleState = null;
      state.boardUiEvent = null;
      state.gameState.players.forEach((player) => { player.pendingBattle = null; });
      state.gameState.resolutionLock = false;
      state.gameState.battleExitLock = false;
      state.gameState.turnStep = "擲骰前進";
      debug.renderAll();
      debug.notifyBattleWindow();
      debug.pushBoardLanState("battle-finish");
    });
    const createdAt = Date.now();
    report.interleavedMapAck = await emitEvents(guest, roomCode, [{
      id: `qa-interleaved-map-${stamp}`, channel: "ui", type: "dice", title: "分段完成後地圖骰子",
      subtitle: "終局快照與地圖事件插在第一段和剩餘段之間", theme: "move", maxFace: 6, result: 5, settleDelay: 260,
      createdAt, expiresAt: createdAt + 15000,
    }]);
    await guest.page.waitForFunction((before) => window.__BOARD_GAME_DEBUG__.boardLanStatus().version > before
      && !window.__BOARD_GAME_DEBUG__.boardLanStatus().hasInFlightState,
    report.interleavedTerminalVersionBefore, { timeout: 8000 });
    await host.page.waitForTimeout(350);
    report.interleavedBeforeCompletion = await host.page.evaluate(() => ({
      hasBattle: Boolean(window.__BOARD_GAME_DEBUG__.getState().battleState),
      open: document.getElementById("battlePageOverlay")?.classList.contains("open"),
      closing: document.getElementById("battlePageOverlay")?.classList.contains("closing"),
      mapOpen: document.getElementById("diceHud")?.classList.contains("open"),
      playback: document.getElementById("battlePageFrame")?.contentWindow?.__BOARD_BATTLE_DEBUG__?.spectatorPlaybackState?.(),
    }));
    report.interleavedReleasedParts = await guest.page.evaluate(() => window.__playbackQaReleaseBattleParts());
    await host.page.waitForFunction((id) => document.getElementById("battlePageFrame")?.contentWindow?.__BOARD_BATTLE_DEBUG__?.spectatorPlaybackState?.().eventId === id,
      report.interleavedEvents[0].id, { timeout: 10000 });
    await host.page.waitForFunction(() => document.getElementById("diceHudTitle")?.textContent === "分段完成後地圖骰子"
      && document.getElementById("diceHud")?.classList.contains("open"), null, { timeout: 12000 });
    await host.page.waitForFunction(() => !document.getElementById("diceHud")?.classList.contains("open"), null, { timeout: 6000 });
    report.interleavedTrace = await host.page.evaluate(() => { clearInterval(window.__interleavedTimer); return window.__interleavedTrace; });
    report.interleavedWire = await guest.page.evaluate(() => window.__playbackQaWire);
    report.interleavedHolds = report.interleavedEvents.map((event) => {
      const index = report.interleavedTrace.findIndex((row) => row.active && row.id === event.id);
      const end = index < 0 ? null : report.interleavedTrace.slice(index + 1).find((row) => !row.active || row.id !== event.id);
      return { id: event.id, durationMs: index >= 0 && end ? end.t - report.interleavedTrace[index].t : 0 };
    });
    const first = report.interleavedBeforeCompletion;
    if (!first.hasBattle || !first.open || first.closing || first.mapOpen || first.playback?.active) report.failures.push("interleaved state or map escaped before battle parts completed");
    const order = [...new Set(report.interleavedTrace.filter((row) => row.active && row.id).map((row) => row.id))];
    if (JSON.stringify(order) !== JSON.stringify(report.interleavedEvents.map((event) => event.id))) report.failures.push("interleaved battle playback FIFO order mismatch");
    if (report.interleavedHolds[0].durationMs < 1770 || report.interleavedHolds[1].durationMs < 2020) report.failures.push("interleaved battle presentation was cut short");
    const mapStart = report.interleavedTrace.find((row) => row.mapOpen && row.mapTitle === "分段完成後地圖骰子");
    if (!mapStart || mapStart.active || mapStart.open || mapStart.closing) report.failures.push("interleaved map dice started before all battle presentation finished");
    const parts = report.interleavedWire.filter((frame) => frame.type === "visual-part");
    const mapSequence = report.interleavedMapAck[0]?.sequence || 0;
    if (!parts.length || !report.interleavedReleasedParts || parts.some((frame) => !frame.ack?.ok || frame.bytes > 65536 || frame.messageBytes > 65536)) report.failures.push("interleaved parts did not receive valid server acknowledgements");
    if (parts.filter((frame) => frame.index === 0).some((frame) => frame.ack.sequence >= mapSequence)
      || parts.filter((frame) => frame.index > 0).some((frame) => frame.ack.sequence <= mapSequence)) report.failures.push("server did not receive map event between first and remaining battle parts");
  } finally {
    await guest.page.evaluate(() => window.__playbackQaReleaseBattleParts());
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = { ok: false, url: ROOT_URL, viewport: VIEWPORT, quickDice: QUICK_DICE, errors: [], failures: [] };
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: process.env.BOARD_QA_HEADED !== "1" });
  let host;
  let guest;
  try {
    const stamp = Date.now().toString(36);
    host = await createDevice(browser, { userId: 889191, clientId: `playback-host-${stamp}`, name: `播測主${stamp}` }, report.errors);
    guest = await createDevice(browser, { userId: 889192, clientId: `playback-guest-${stamp}`, name: `播測客${stamp}` }, report.errors);
    await enterRoom(host, "", true);
    const roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    report.roomCode = roomCode;
    await enterRoom(guest, roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardStartBtn");
    await Promise.all([waitForGame(host), waitForGame(guest)]);
    const fixture = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = debug.getLocalBoardPlayer();
      game.phase = "main";
      game.currentPlayerIndex = game.players.indexOf(player);
      game.turnStep = "擲骰前進";
      game.pendingMove = null;
      game.routePrompt = null;
      game.islandDecision = null;
      game.resolutionLock = false;
      game.movementAnimating = false;
      game.battleExitLock = false;
      state.battleState = null;
      state.boardUiEvent = null;
      debug.closeModal();
      debug.renderAll();
      debug.pushBoardLanState("qa-playback-main-phase");
      return { playerId: String(player.id), playerName: player.name };
    });
    await guest.page.waitForFunction((id) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      return game.phase === "main" && String(game.players[game.currentPlayerIndex]?.id) === id && !debug.boardLanStatus().applying;
    }, fixture.playerId, { timeout: 10000 });
    await guest.page.waitForTimeout(800);

    await guest.page.evaluate(() => {
      window.__diceTrace = [];
      const capture = () => {
        const hud = document.getElementById("diceHud");
        const orb = document.getElementById("diceHudOrb");
        const row = {
          t: performance.now(),
          open: hud.classList.contains("open"),
          title: document.getElementById("diceHudTitle").textContent,
          rolling: orb.classList.contains("rolling"),
          settled: orb.classList.contains("settled"),
          face: document.getElementById("diceHudFaceImage")?.alt,
          coins: Number(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()?.coins || 0),
        };
        const prior = window.__diceTrace.at(-1);
        if (!prior || ["open", "title", "rolling", "settled", "face", "coins"].some((key) => prior[key] !== row[key])) window.__diceTrace.push(row);
      };
      window.__diceObserver = new MutationObserver(capture);
      window.__diceObserver.observe(document.getElementById("diceHud"), { subtree: true, childList: true, attributes: true });
      window.__diceCheckpointTimer = setInterval(capture, 25);
      capture();
    });
    const createdAt = Date.now();
    const diceEvents = [2, 5].map((result, index) => ({
      ...fixture, id: `qa-dice-${index}-${stamp}`, channel: "ui", type: "dice", title: `連續骰子 ${index + 1}`,
      subtitle: QUICK_DICE ? "快速航行結果停留" : "完整三秒結果", theme: "move", maxFace: 6, result,
      settleDelay: QUICK_DICE ? 650 : 260,
      ...(QUICK_DICE ? { duration: 1200 } : {}),
      createdAt, expiresAt: createdAt + (QUICK_DICE ? 1600 : 3660),
    }));
    report.diceAcks = await emitEvents(host, roomCode, diceEvents);
    report.diceCheckpoint = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      // A later game snapshot must not cut off either queued visual event.
      const before = Number(debug.getLocalBoardPlayer().coins || 0);
      debug.getLocalBoardPlayer().coins = before + 1;
      debug.pushBoardLanState("qa-playback-during-dice");
      return { before, after: before + 1 };
    });
    await guest.page.waitForTimeout(QUICK_DICE ? 3400 : 7400);
    report.diceTrace = await guest.page.evaluate(() => {
      window.__diceObserver.disconnect();
      clearInterval(window.__diceCheckpointTimer);
      return window.__diceTrace;
    });
    report.diceHolds = diceEvents.map((event) => {
      const settledIndex = report.diceTrace.findIndex((row) => row.title === event.title && row.open && row.settled);
      if (settledIndex < 0) return { title: event.title, holdMs: 0, error: "result never displayed" };
      const row = report.diceTrace[settledIndex];
      const end = report.diceTrace.slice(settledIndex + 1).find((entry) => !entry.open || entry.title !== event.title || !entry.settled);
      return { title: event.title, holdMs: end ? Math.round(end.t - row.t) : 0, face: row.face };
    });
    for (const hold of report.diceHolds) {
      if (hold.holdMs < (QUICK_DICE ? 500 : 2950)) report.failures.push(`dice cut short: ${JSON.stringify(hold)}`);
      if (QUICK_DICE && hold.holdMs > 900) report.failures.push(`quick dice retained a full-length hold: ${JSON.stringify(hold)}`);
    }
    if (QUICK_DICE) {
      const shownTitles = [...new Set(report.diceTrace.filter((row) => row.open).map((row) => row.title))];
      if (JSON.stringify(shownTitles) !== JSON.stringify(diceEvents.map((event) => event.title))) report.failures.push("quick dice FIFO order mismatch");
      if (report.diceTrace.some((row) => row.open && row.coins !== report.diceCheckpoint.before)) report.failures.push("state checkpoint interrupted quick dice playback");
      if (report.diceTrace.at(-1)?.coins !== report.diceCheckpoint.after) report.failures.push("state checkpoint missing after both quick dice finished");
      if (report.diceHolds.some((hold, index) => hold.face !== `骰面 ${diceEvents[index].result}`)) report.failures.push("quick dice displayed the wrong result");
    }

    report.movementFixture = await guest.page.evaluate((playerId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const player = state.gameState.players.find((entry) => String(entry.id) === playerId);
      const previous = structuredClone(player.location);
      const route = state.gameState.boardData.routesBetweenIslands.find((entry) => entry.tiles.length >= 3);
      const locations = [0, 1, 2].map((tileIndex) => ({ kind: "route", routeId: route.id, tileIndex }));
      const expected = locations.map((location) => {
        player.location = location;
        debug.renderAll();
        const token = Array.from(document.querySelectorAll(".ship-token[data-player-id]")).find((entry) => entry.dataset.playerId === playerId);
        return { location, left: token.style.left, top: token.style.top };
      });
      player.location = previous;
      debug.renderAll();
      return expected;
    }, fixture.playerId);
    await guest.page.evaluate((playerId) => {
      window.__movementTrace = [];
      const capture = () => {
        const token = Array.from(document.querySelectorAll(".ship-token[data-player-id]")).find((entry) => entry.dataset.playerId === playerId);
        if (!token) return;
        const row = { t: performance.now(), left: token.style.left, top: token.style.top };
        const previous = window.__movementTrace.at(-1);
        if (!previous || row.left !== previous.left || row.top !== previous.top) window.__movementTrace.push(row);
      };
      window.__movementObserver = new MutationObserver(capture);
      window.__movementObserver.observe(document.getElementById("boardGameMap"), { attributes: true, subtree: true, childList: true });
      capture();
    }, fixture.playerId);
    const movementCreatedAt = Date.now();
    const movementEvents = report.movementFixture.map((entry, index) => ({
      id: `qa-move-${index}-${stamp}`, channel: "movement", type: "move-step", playerId: fixture.playerId,
      location: entry.location, stepsRemaining: 2 - index, stepDurationMs: 320,
      createdAt: movementCreatedAt, expiresAt: movementCreatedAt + 5000,
    }));
    report.movementAcks = await emitEvents(host, roomCode, movementEvents);
    await host.page.evaluate((location) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      debug.getLocalBoardPlayer().location = location;
      debug.pushBoardLanState("qa-playback-during-movement");
    }, report.movementFixture.at(-1).location);
    await guest.page.waitForTimeout(1600);
    report.movementTrace = await guest.page.evaluate(() => { window.__movementObserver.disconnect(); return window.__movementTrace; });
    report.movementVisits = report.movementFixture.map((entry) => report.movementTrace.find((row) => row.left === entry.left && row.top === entry.top) || null);
    for (let index = 0; index < report.movementVisits.length; index += 1) {
      const visit = report.movementVisits[index];
      if (!visit) report.failures.push(`movement skipped tile ${index}`);
      else if (index && report.movementVisits[index - 1] && visit.t - report.movementVisits[index - 1].t < 280) {
        report.failures.push(`movement step ${index} compressed to ${Math.round(visit.t - report.movementVisits[index - 1].t)} ms`);
      }
    }

    report.modalEvent = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.spectatorUiQa.emit(
      "qa-playback-modal", { title: "持續觀看測試", subtitle: "快照不可清掉同一個事件" }, { skipStatePush: true }
    ));
    await guest.page.waitForFunction((id) => document.getElementById("boardModalBack")?.dataset.boardUiEventId === id
      && document.getElementById("boardModalBack")?.classList.contains("open"), report.modalEvent.id, { timeout: 6000 });
    report.modalSnapshot = await host.page.evaluate(({ event, code }) => new Promise((resolve) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const payload = debug.createManualSavePayload();
      payload.boardUiEvent = event;
      const version = debug.boardLanStatus().version;
      window.__playbackQaSocket.emit("BOARD_GAME_STATE", {
        roomCode: code, sourceClientId: localStorage.getItem("op_board_client_id"), payload,
        baseVersion: version, version: version + 1, reason: "qa-playback-same-modal-snapshot",
      }, resolve);
    }), { event: report.modalEvent, code: roomCode });
    await guest.page.waitForTimeout(600);
    report.modalAfterSnapshot = await guest.page.evaluate(() => ({
      open: document.getElementById("boardModalBack")?.classList.contains("open"),
      id: document.getElementById("boardModalBack")?.dataset.boardUiEventId || "",
      title: document.querySelector(".encounter-heading h3")?.textContent || "",
    }));
    if (!report.modalAfterSnapshot.open || report.modalAfterSnapshot.id !== report.modalEvent.id) report.failures.push("snapshot erased active spectator modal");
    await guest.page.screenshot({ path: path.join(OUTPUT_DIR, "spectator-modal-after-snapshot.png") });

    await guest.page.reload({ waitUntil: "domcontentloaded" });
    await waitForGame(guest);
    report.refresh = await guest.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      return { localUserId: Number(debug.getLocalBoardPlayer()?.userId), phase: debug.getState().gameState.phase, status: debug.boardLanStatus() };
    });
    if (report.refresh.localUserId !== guest.userId || report.refresh.phase !== "main") report.failures.push("guest identity or phase lost after refresh");
    await battlePlaybackCheck(host, guest, report, stamp, roomCode);
    await battleControlHandoffCheck(host, guest, report, stamp, roomCode);
    await interleavedBattleIngressCheck(host, guest, report, stamp, roomCode);
    for (const ack of [...report.diceAcks, ...report.movementAcks, report.modalSnapshot]) if (!ack?.ok) report.failures.push(`server rejected fixture: ${JSON.stringify(ack)}`);
    report.ok = report.errors.length === 0 && report.failures.length === 0;
  } catch (error) {
    report.failures.push(error.stack || String(error));
  } finally {
    if (host) await host.context.close();
    if (guest) await guest.context.close();
    await browser.close();
    fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
