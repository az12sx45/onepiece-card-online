"use strict";

const { chromium } = require("playwright");

const baseUrl = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8787";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function socketMockSource() {
  return `(() => {
    class FakeSocket {
      constructor() {
        this.handlers = {};
        this.joinCount = 0;
        this.serverVersion = 42;
        this.serverPayload = null;
        this.sentStates = [];
        window.__qaSocket = this;
        setTimeout(() => this.fire("connect"), 0);
      }
      on(name, handler) {
        (this.handlers[name] ||= []).push({ handler, once: false });
        return this;
      }
      once(name, handler) {
        (this.handlers[name] ||= []).push({ handler, once: true });
        return this;
      }
      fire(name, payload) {
        const entries = [...(this.handlers[name] || [])];
        this.handlers[name] = (this.handlers[name] || []).filter((entry) => !entry.once);
        entries.forEach((entry) => entry.handler(payload));
      }
      disconnectForQa() {
        this.fire("disconnect", "transport close");
      }
      reconnectForQa() {
        this.fire("connect");
      }
      emit(name, payload, callback) {
        if (name === "BOARD_JOIN_GAME") {
          this.joinCount += 1;
          const profile = payload.profile;
          const lobby = {
            roomCode: "BRECONNECT",
            roomId: "BRECONNECT",
            hostUserId: profile.userId,
            hostName: profile.name,
            status: "playing",
            maxPlayers: 4,
            players: [{ ...profile, isHost: true, isMe: true, ready: true, online: true }],
          };
          this.fire("BOARD_LOBBY", { lobby });
          if (this.joinCount === 1) {
            const save = window.__BOARD_GAME_DEBUG__.createManualSavePayload();
            save.roomCode = "BRECONNECT";
            save.gameState.phase = "main";
            save.gameState.round = 460;
            save.gameState.turnStep = "擲骰前進";
            save.gameState.qaReconnectMarker = "server-old-v42";
            save.gameState.currentPlayerIndex = 0;
            this.serverPayload = structuredClone(save);
            this.fire("BOARD_GAME_STATE", {
              roomCode: "BRECONNECT",
              payload: structuredClone(this.serverPayload),
              version: this.serverVersion,
              sourceClientId: profile.clientId,
              reason: "qa-initial",
            });
            callback?.({ ok: true, lobby, hasState: true, stateCurrent: false, canSeedState: true, version: this.serverVersion });
            return;
          }
          // Deliberately reproduce the old server race: an equal-version stale
          // snapshot arrives just before the reconnect acknowledgement.
          this.fire("BOARD_GAME_STATE", {
            roomCode: "BRECONNECT",
            payload: structuredClone(this.serverPayload),
            version: this.serverVersion,
            sourceClientId: profile.clientId,
            reason: "qa-stale-reconnect",
          });
          callback?.({ ok: true, lobby, hasState: true, stateCurrent: true, canSeedState: true, version: this.serverVersion });
          return;
        }
        if (name === "BOARD_GAME_STATE") {
          const expectedVersion = this.serverVersion + 1;
          if (Number(payload.baseVersion) !== this.serverVersion || Number(payload.version) !== expectedVersion) {
            callback?.({ ok: false, error: "stale_version", version: this.serverVersion });
            return;
          }
          this.serverVersion = expectedVersion;
          this.serverPayload = structuredClone(payload.payload);
          this.sentStates.push(structuredClone(payload));
          callback?.({ ok: true, version: this.serverVersion });
          return;
        }
        if (name === "BOARD_STATE_REQUEST") {
          this.fire("BOARD_GAME_STATE", {
            roomCode: "BRECONNECT",
            payload: structuredClone(this.serverPayload),
            version: this.serverVersion,
            sourceClientId: "qa-server",
            reason: "qa-authoritative",
          });
          callback?.({ ok: true, version: this.serverVersion });
          return;
        }
        callback?.({ ok: true });
      }
      close() {}
    }
    window.io = () => new FakeSocket();
  })();`;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript(() => {
    localStorage.setItem("op_board_user_id", "990401");
    localStorage.setItem("op_board_client_id", "qa-reconnect-host");
    localStorage.setItem("op_name", "重連測試房主");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`page:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
  await page.route("**/socket.io/socket.io.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: socketMockSource(),
  }));
  await page.goto(`${baseUrl}/board_game.html?room=BRECONNECT&online=1&skipOpeningStory=1`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForFunction(() => {
    const lan = window.__BOARD_GAME_DEBUG__?.boardLanStatus?.();
    return lan?.connected && !lan.awaitingInitialState && lan.version === 42;
  }, null, { timeout: 12000 });

  const beforeReconnect = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const live = debug.getState().gameState;
    window.__qaSocket.disconnectForQa();

    const human = live.players[0];
    const cpu = structuredClone(human);
    cpu.id = "qa-reconnect-cpu";
    cpu.userId = -9401;
    cpu.clientId = "board-cpu-qa-reconnect";
    cpu.name = "CPU・重連測試";
    cpu.isCPU = true;
    cpu.isCpu = true;
    cpu.cpu = true;
    live.players = [human, cpu];
    live.currentPlayerIndex = 1;
    const cpuPaused = debug.cpuAutoStatus().canRun === false;

    live.currentPlayerIndex = 0;
    live.round = 461;
    live.turnStep = "完成中的回合已結算";
    live.qaReconnectMarker = "local-new-v43";
    human.coins = Number(human.coins || 0) + 777;
    const expectedCoins = human.coins;
    debug.pushBoardLanState("qa-disconnected-finish");
    const queued = debug.boardLanStatus();
    return { cpuPaused, expectedCoins, queued, round: live.round, marker: live.qaReconnectMarker };
  });

  await page.evaluate(() => window.__qaSocket.reconnectForQa());
  await page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const lan = debug?.boardLanStatus?.();
    return lan?.connected
      && !lan.awaitingInitialState
      && !lan.hasPendingState
      && !lan.hasInFlightState
      && lan.version === 43
      && window.__qaSocket.serverPayload?.gameState?.qaReconnectMarker === "local-new-v43";
  }, null, { timeout: 12000 });

  const afterReconnect = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const live = debug.getState().gameState;
    const human = live.players.find((player) => Number(player.userId || player.id) === 990401) || live.players[0];
    return {
      round: live.round,
      marker: live.qaReconnectMarker,
      coins: human.coins,
      lan: debug.boardLanStatus(),
      serverVersion: window.__qaSocket.serverVersion,
      serverRound: window.__qaSocket.serverPayload?.gameState?.round,
      serverMarker: window.__qaSocket.serverPayload?.gameState?.qaReconnectMarker,
      sentCount: window.__qaSocket.sentStates.length,
      sentBaseVersion: window.__qaSocket.sentStates.at(-1)?.baseVersion,
      sentVersion: window.__qaSocket.sentStates.at(-1)?.version,
    };
  });

  const staleSpecialPayloads = await page.evaluate(async () => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const socket = window.__qaSocket;
    const live = debug.getState().gameState;
    const expectedRound = live.round;
    const expectedMarker = live.qaReconnectMarker;
    live.tradePrompt = { playerId: live.players[0].id };
    const staleTrade = structuredClone(socket.serverPayload);
    staleTrade.gameState.round = 12;
    staleTrade.gameState.qaReconnectMarker = "stale-trade-v42";
    staleTrade.gameState.tradePrompt = null;
    staleTrade.gameState.activeTrade = null;
    socket.fire("BOARD_GAME_STATE", {
      roomCode: "BRECONNECT",
      payload: staleTrade,
      version: socket.serverVersion - 1,
      sourceClientId: "qa-remote-stale",
      reason: "trade-close",
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    const afterTrade = debug.getState().gameState;
    const afterTradeMarker = afterTrade.qaReconnectMarker;
    const afterTradeRound = afterTrade.round;
    afterTrade.tradePrompt = null;

    const staleBattle = structuredClone(socket.serverPayload);
    staleBattle.gameState.round = 13;
    staleBattle.gameState.qaReconnectMarker = "stale-battle-v42";
    staleBattle.battleState = { qaStaleBattle: true };
    socket.fire("BOARD_GAME_STATE", {
      roomCode: "BRECONNECT",
      payload: staleBattle,
      version: socket.serverVersion - 1,
      sourceClientId: "qa-remote-stale",
      reason: "battle-attack",
    });
    await new Promise((resolve) => setTimeout(resolve, 120));
    const afterBattleState = debug.getState();
    return {
      expectedRound,
      expectedMarker,
      afterTradeRound,
      afterTradeMarker,
      afterBattleRound: afterBattleState.gameState.round,
      afterBattleMarker: afterBattleState.gameState.qaReconnectMarker,
      hasStaleBattle: !!afterBattleState.battleState?.qaStaleBattle,
      lanVersion: debug.boardLanStatus().version,
    };
  });

  const failures = [];
  if (!beforeReconnect.cpuPaused) failures.push("CPU remained runnable while disconnected");
  if (!beforeReconnect.queued.hasPendingState || beforeReconnect.queued.hasInFlightState) failures.push("offline snapshot was not queued exactly once");
  if (afterReconnect.round !== 461 || afterReconnect.marker !== "local-new-v43") failures.push("equal-version stale snapshot rolled local progress back");
  if (afterReconnect.coins !== beforeReconnect.expectedCoins) failures.push("player coins rolled back during reconnect");
  if (afterReconnect.serverRound !== 461 || afterReconnect.serverMarker !== "local-new-v43") failures.push("queued local snapshot did not reach the server");
  if (afterReconnect.serverVersion !== 43 || afterReconnect.sentBaseVersion !== 42 || afterReconnect.sentVersion !== 43) failures.push("reconnect snapshot did not use monotonic base/version 42 -> 43");
  if (afterReconnect.sentCount !== 1) failures.push(`expected one consolidated reconnect snapshot, got ${afterReconnect.sentCount}`);
  if (afterReconnect.lan.awaitingInitialState || afterReconnect.lan.hasPendingState || afterReconnect.lan.hasInFlightState) failures.push("reconnect queue did not settle");
  if (!afterReconnect.lan.lastAck?.ok) failures.push("reconnect snapshot was not acknowledged");
  if (staleSpecialPayloads.afterTradeRound !== staleSpecialPayloads.expectedRound || staleSpecialPayloads.afterTradeMarker !== staleSpecialPayloads.expectedMarker) {
    failures.push("older trade terminal snapshot rolled the client back");
  }
  if (staleSpecialPayloads.afterBattleRound !== staleSpecialPayloads.expectedRound || staleSpecialPayloads.afterBattleMarker !== staleSpecialPayloads.expectedMarker || staleSpecialPayloads.hasStaleBattle) {
    failures.push("older battle catch-up snapshot rolled the client back");
  }
  if (staleSpecialPayloads.lanVersion !== 43) failures.push("stale special payload changed the acknowledged LAN version");
  if (errors.length) failures.push(...errors);

  console.log(JSON.stringify({
    result: failures.length ? "FAIL" : "PASS",
    beforeReconnect,
    afterReconnect,
    staleSpecialPayloads,
    failures,
  }, null, 2));
  await context.close();
  await browser.close();
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
