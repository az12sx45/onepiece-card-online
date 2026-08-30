const { chromium } = require("playwright");

const BASE_URL = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function socketMockSource(hasRemoteState, cpuSnapshot = false, localIsHost = true) {
  return `(() => {
    class FakeSocket {
      constructor() {
        this.handlers = {};
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
      emit(name, payload, callback) {
        if (name === "BOARD_JOIN_GAME") {
          const profile = payload.profile;
          const lobby = {
            roomCode: "BQA",
            roomId: "BQA",
            hostUserId: ${localIsHost} ? profile.userId : 990099,
            hostName: ${localIsHost} ? profile.name : "另一台房主",
            status: "playing",
            maxPlayers: 4,
            players: [
              ...(${localIsHost} ? [] : [{ userId: 990099, clientId: "qa-other-host", name: "另一台房主", isHost: true, isMe: false, ready: true, online: true }]),
              { ...profile, isHost: ${localIsHost}, isMe: true, ready: true, online: true },
            ],
          };
          // The production server emits lobby first, then the saved game, and only then acknowledges join.
          this.fire("BOARD_LOBBY", { lobby });
          if (${hasRemoteState}) {
            const debug = window.__BOARD_GAME_DEBUG__;
            const save = debug.createManualSavePayload();
            save.roomCode = "BQA";
            save.gameState.phase = "main";
            save.gameState.round = 460;
            save.gameState.turnStep = "擲骰前進";
            save.boardUiEvent = {
              id: "qa-stale-turn-banner",
              type: "turn-banner",
              title: "CPU 的回合",
              transitionDelay: 2800,
            };
            if (${cpuSnapshot}) {
              const host = save.gameState.players[0];
              const cpu = structuredClone(host);
              const starter = structuredClone(save.gameState.availableCards[0]);
              cpu.id = "qa-cpu-1";
              cpu.userId = -1001;
              cpu.clientId = "board-cpu-1";
              cpu.name = "CPU1";
              cpu.isCPU = true;
              cpu.isCpu = true;
              cpu.cpu = true;
              cpu.isMe = false;
              cpu.isHost = false;
              cpu.crew = [starter];
              cpu.activeCrewIndex = 0;
              cpu.location = structuredClone(host.location);
              save.gameState.players = [host, cpu];
              save.gameState.currentPlayerIndex = 1;
              save.gameState.pendingMove = { playerId: cpu.id, stepsRemaining: 1 };
              save.gameState.movementAnimating = true;
              save.gameState.diceRolling = true;
              save.gameState.resolutionLock = true;
              save.gameState.turnStep = "航行 1 格";
            }
            this.fire("BOARD_GAME_STATE", {
              roomCode: "BQA",
              payload: save,
              version: 42,
              sourceClientId: profile.clientId,
            });
          }
          callback?.({
            ok: true,
            lobby,
            hasState: ${hasRemoteState},
            canSeedState: ${localIsHost},
            version: ${hasRemoteState ? 42 : 0},
          });
          return;
        }
        callback?.({ ok: true, version: 43 });
      }
      close() {}
    }
    window.io = () => new FakeSocket();
  })();`;
}

async function runCase(browser, hasRemoteState, cpuSnapshot = false, localIsHost = true, waitMs = 1300) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await context.addInitScript(() => {
    localStorage.setItem("op_board_user_id", "990001");
    localStorage.setItem("op_board_client_id", "qa-refresh-host");
    localStorage.setItem("op_name", "刷新測試");
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/socket.io/socket.io.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: socketMockSource(hasRemoteState, cpuSnapshot, localIsHost),
  }));
  await page.goto(`${BASE_URL}/board_game.html?room=BQA&online=1&skipOpeningStory=1`, {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  if (cpuSnapshot && localIsHost) {
    await page.waitForFunction(() => {
      const live = window.__BOARD_GAME_DEBUG__?.getState?.()?.gameState;
      return !!live
        && !live.pendingMove
        && !live.movementAnimating
        && !live.diceRolling
        && !live.resolutionLock;
    }, null, { timeout: 8000 }).catch(() => {});
  } else {
    await page.waitForTimeout(waitMs);
  }
  const result = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const live = debug.getState();
    return {
      phase: live.gameState.phase,
      round: live.gameState.round,
      turnStep: live.gameState.turnStep,
      pendingMove: live.gameState.pendingMove,
      movementAnimating: live.gameState.movementAnimating,
      diceRolling: live.gameState.diceRolling,
      resolutionLock: live.gameState.resolutionLock,
      lan: debug.boardLanStatus(),
      cpu: debug.cpuAutoStatus(),
      initialWaitModalOpen: !!document.querySelector("#boardModal.board-lan-initial-wait-modal")
        && !!document.querySelector("#boardModalBack.open"),
    };
  });
  result.errors = errors;
  await context.close();
  return result;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const restored = await runCase(browser, true);
  const [cpuRestored, cpuObserver] = await Promise.all([
    runCase(browser, true, true, true),
    runCase(browser, true, true, false),
  ]);
  const fresh = await runCase(browser, false);
  const unavailableHost = await runCase(browser, false, false, false, 10000);
  await browser.close();
  const failures = [];
  if (restored.phase !== "main" || restored.round !== 460 || restored.turnStep !== "擲骰前進") {
    failures.push("existing-room snapshot was replaced by fresh setup");
  }
  if (restored.lan.awaitingInitialState || restored.lan.initialStateCanSeed) {
    failures.push("existing-room restore left initial-state flags active");
  }
  if (restored.initialWaitModalOpen || restored.lan.hasInitialStateRetryTimer) {
    failures.push("normal refresh displayed or retained the room-state waiting flow");
  }
  if (!cpuRestored.cpu.lastResult) {
    failures.push("restored CPU turn did not resume automatically");
  }
  if (cpuRestored.movementAnimating || cpuRestored.diceRolling || cpuRestored.resolutionLock) {
    failures.push("restored CPU turn retained stale page animation locks");
  }
  if (cpuObserver.cpu.lastResult || cpuObserver.cpu.canRun || cpuObserver.round !== 460) {
    failures.push("non-host device attempted to drive the restored CPU turn");
  }
  if (fresh.phase !== "setup-order") failures.push("new room did not enter setup-order");
  if (unavailableHost.lan.initialStateRequestAttempts !== 4 || unavailableHost.lan.hasInitialStateRetryTimer) {
    failures.push("missing-room-host retry was not capped at four requests");
  }
  if (!unavailableHost.initialWaitModalOpen) failures.push("genuinely unavailable room did not show delayed wait guidance");
  if (restored.errors.length || cpuRestored.errors.length || cpuObserver.errors.length || fresh.errors.length || unavailableHost.errors.length) failures.push("page error occurred");
  process.stdout.write(JSON.stringify({ ok: failures.length === 0, failures, restored, cpuRestored, cpuObserver, fresh, unavailableHost }, null, 2));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
