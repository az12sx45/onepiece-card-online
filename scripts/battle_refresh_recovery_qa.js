const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8838";
const CHROME_PATH = process.env.BOARD_QA_CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.join(process.cwd(), ".codex", "qa", "battle_refresh_recovery_v370");
const SERVER_SNAPSHOT_KEY = "qa-battle-refresh-server-snapshot-v1";
const SERVER_FREEZE_KEY = "qa-battle-refresh-server-freeze-v1";
const RECOVERY_CHECKPOINT_KEY = "onepiece-board-battle-refresh-recovery-v1";

function socketMockSource() {
  return `(() => {
    const SNAPSHOT_KEY = ${JSON.stringify(SERVER_SNAPSHOT_KEY)};
    const FREEZE_KEY = ${JSON.stringify(SERVER_FREEZE_KEY)};
    class FakeSocket {
      constructor() {
        this.handlers = {};
        this.version = 0;
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
          const isObserver = Number(profile.userId) === 990002;
          const lobby = {
            roomCode: "BRQA",
            roomId: "BRQA",
            hostUserId: 990001,
            hostName: "戰鬥刷新測試",
            status: "playing",
            maxPlayers: 4,
            players: [
              { userId: 990001, clientId: "qa-battle-refresh-host", name: "戰鬥刷新測試", isHost: true, isMe: !isObserver, ready: true, online: true },
              ...(isObserver ? [{ ...profile, isHost: false, isMe: true, ready: true, online: true }] : []),
            ],
          };
          this.fire("BOARD_LOBBY", { lobby });
          const raw = localStorage.getItem(SNAPSHOT_KEY);
          if (raw) {
            const stored = JSON.parse(raw);
            this.version = Number(stored.version || 1);
            this.fire("BOARD_GAME_STATE", {
              roomCode: "BRQA",
              payload: stored.payload,
              version: this.version,
              sourceClientId: "qa-server",
              reason: "qa-refresh-restore",
            });
          }
          callback?.({ ok: true, lobby, hasState: !!raw, canSeedState: !raw, version: this.version });
          return;
        }
        if (name === "BOARD_GAME_STATE") {
          this.version += 1;
          if (localStorage.getItem(FREEZE_KEY) !== "1") {
            localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ payload: payload.payload, version: this.version }));
          }
          callback?.({ ok: true, version: this.version });
          return;
        }
        callback?.({ ok: true, version: this.version });
      }
      close() {}
    }
    window.io = () => new FakeSocket();
  })();`;
}

async function prepareBattle(page) {
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.currentPlayerIndex = 0;
    state.gameState.round = 8;
    player.isCpu = false;
    player.isCPU = false;
    player.cpu = false;
    const source = window.BoardCards.cards.find((card) => card.id === "luffy") || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 50 })];
    player.activeCrewIndex = 0;
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.pendingBattle = null;
    state.gameState.players = [player];
    state.gameState.currentPlayerIndex = 0;
    state.battleState = null;
    const island = state.gameState.boardData.islands.find((entry) => {
      const islandState = debug.getIslandState(entry.id);
      return entry.kind === "enemy" && islandState?.enemyProfile;
    });
    const islandState = debug.getIslandState(island.id);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    state.battleState.prebattleIntro.done = true;
    state.battleState.entryTransition = null;
    state.battleState.openingPassiveVisualQueue = [];
    state.battleState.openingPassiveVisualAnimating = false;
    debug.notifyBattleWindow();
  });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getBattleView()?.battle?.canAct === true, null, { timeout: 12000 });
}

async function freezeCurrentSnapshot(page, { clearCheckpoint = false } = {}) {
  return page.evaluate(({ snapshotKey, freezeKey, clearCheckpoint }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    if (clearCheckpoint) debug.battleRefreshRecoveryQa.clear();
    const payload = debug.createManualSavePayload();
    const current = JSON.parse(localStorage.getItem(snapshotKey) || "{}");
    localStorage.setItem(snapshotKey, JSON.stringify({ payload, version: Math.max(1, Number(current.version || 0) + 1) }));
    localStorage.setItem(freezeKey, "1");
    return {
      roundIndex: payload.battleState?.roundIndex || 0,
      playerHp: payload.gameState?.players?.[0]?.crew?.[0]?.currentHp || 0,
      enemyHp: payload.battleState?.enemyCombatant?.currentHp || 0,
      playerPerformedAction: !!payload.battleState?.playerPerformedAction,
      enemyPerformedAction: !!payload.battleState?.enemyPerformedAction,
      visualType: payload.battleState?.visualEvent?.type || "",
      recovery: debug.battleRefreshRecoveryQa.status(),
    };
  }, { snapshotKey: SERVER_SNAPSHOT_KEY, freezeKey: SERVER_FREEZE_KEY, clearCheckpoint });
}

async function waitForRecoveredRound(page) {
  await page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug?.getState?.();
    const battle = state?.battleState;
    if (!battle) return false;
    const view = debug.getBattleView()?.battle;
    const nextRoundReady = !battle.animating
      && !battle.playerAction
      && !battle.enemyAction
      && !battle.roundResolved
      && !battle.result
      && view?.canAct === true;
    const roundPauseReady = !battle.animating
      && battle.result === "round-pause"
      && battle.roundResolved
      && view?.canFinish === true;
    const terminalReady = !battle.animating
      && ["win", "lose", "escape"].includes(String(battle.result || ""))
      && view?.canFinish === true;
    return nextRoundReady || roundPauseReady || terminalReady;
  }, null, { timeout: 35000 }).catch(async (error) => {
    const diagnostic = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug?.getState?.();
      const battle = state?.battleState;
      return {
        phase: state?.gameState?.phase,
        roundIndex: battle?.roundIndex,
        result: battle?.result,
        animating: battle?.animating,
        roundResolved: battle?.roundResolved,
        waitingResume: battle?.waitingResume,
        playerAction: battle?.playerAction,
        enemyAction: battle?.enemyAction,
        playerPerformedAction: battle?.playerPerformedAction,
        enemyPerformedAction: battle?.enemyPerformedAction,
        canAct: debug?.getBattleView?.()?.battle?.canAct,
        log: (battle?.log || []).slice(-12),
        recovery: debug?.battleRefreshRecoveryQa?.status?.(),
      };
    }).catch((diagnosticError) => ({ diagnosticError: String(diagnosticError) }));
    throw new Error(`${error.message}\n${JSON.stringify(diagnostic, null, 2)}`);
  });
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    return {
      roundIndex: battle.roundIndex,
      playerHp: state.gameState.players[0].crew[0].currentHp,
      enemyHp: battle.enemyCombatant.currentHp,
      animating: !!battle.animating,
      hasPlayerAction: !!battle.playerAction,
      hasEnemyAction: !!battle.enemyAction,
      canAct: !!debug.getBattleView()?.battle?.canAct,
      canFinish: !!debug.getBattleView()?.battle?.canFinish,
      result: battle.result || "",
      roundResolved: !!battle.roundResolved,
      recoveryLogCount: (battle.log || []).filter((line) => String(line).includes("頁面刷新後已接回本輪尚未完成的戰鬥結算")).length,
      recovery: debug.battleRefreshRecoveryQa.status(),
    };
  });
}

async function runCase(browser, mode) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(({ snapshotKey, freezeKey }) => {
    const observer = localStorage.getItem("qa-battle-refresh-observer-v1") === "1";
    localStorage.setItem("op_board_user_id", observer ? "990002" : "990001");
    localStorage.setItem("op_board_client_id", observer ? "qa-battle-refresh-observer" : "qa-battle-refresh-host");
    localStorage.setItem("op_name", observer ? "戰鬥旁觀測試" : "戰鬥刷新測試");
    if (!sessionStorage.getItem("qa-battle-refresh-loaded")) {
      localStorage.removeItem(snapshotKey);
      localStorage.removeItem(freezeKey);
      sessionStorage.setItem("qa-battle-refresh-loaded", "1");
    }
  }, { snapshotKey: SERVER_SNAPSHOT_KEY, freezeKey: SERVER_FREEZE_KEY });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/socket.io/socket.io.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: socketMockSource(),
  }));
  await page.goto(`${BASE_URL}/board_game.html?room=BRQA&online=1&skipOpeningStory=1&battle_refresh_recovery_qa=1`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await prepareBattle(page);
  const moveId = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getBattleView().activeCard.moves.find((move) => move.currentPP > 0)?.id || "");
  if (!moveId) throw new Error("QA 找不到可使用招式");
  await page.evaluate((id) => window.__BOARD_GAME_DEBUG__.battleChooseMove(id), moveId);
  if (mode === "visual") {
    await page.waitForFunction(() => {
      const battle = window.__BOARD_GAME_DEBUG__?.getState?.()?.battleState;
      return battle?.animating && ["attack", "heal", "status"].includes(String(battle.visualEvent?.type || ""));
    }, null, { timeout: 18000 });
  } else {
    await page.waitForFunction(() => {
      const battle = window.__BOARD_GAME_DEBUG__?.getState?.()?.battleState;
      return battle?.animating && battle.playerAction && battle.enemyAction;
    }, null, { timeout: 5000 });
  }
  const frozen = await freezeCurrentSnapshot(page, { clearCheckpoint: mode === "fallback" });
  if (mode === "observer") {
    const transfer = await page.evaluate(({ snapshotKey, recoveryKey }) => ({
      snapshot: localStorage.getItem(snapshotKey) || "",
      checkpoint: sessionStorage.getItem(recoveryKey) || "",
    }), { snapshotKey: SERVER_SNAPSHOT_KEY, recoveryKey: RECOVERY_CHECKPOINT_KEY });
    await context.close();
    const observerContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: "reduce" });
    await observerContext.addInitScript(({ snapshotKey, freezeKey, recoveryKey, transfer }) => {
      localStorage.setItem("op_board_user_id", "990002");
      localStorage.setItem("op_board_client_id", "qa-battle-refresh-observer");
      localStorage.setItem("op_name", "戰鬥旁觀測試");
      localStorage.setItem(snapshotKey, transfer.snapshot);
      localStorage.setItem(freezeKey, "1");
      sessionStorage.setItem("qa-battle-refresh-loaded", "1");
      sessionStorage.setItem(recoveryKey, transfer.checkpoint);
    }, { snapshotKey: SERVER_SNAPSHOT_KEY, freezeKey: SERVER_FREEZE_KEY, recoveryKey: RECOVERY_CHECKPOINT_KEY, transfer });
    const observerPage = await observerContext.newPage();
    observerPage.on("pageerror", (error) => errors.push(`observer:${String(error)}`));
    await observerPage.route("**/socket.io/socket.io.js", (route) => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: socketMockSource(),
    }));
    await observerPage.goto(`${BASE_URL}/board_game.html?room=BRQA&online=1&skipOpeningStory=1&battle_refresh_recovery_qa=1`, { waitUntil: "domcontentloaded", timeout: 20000 });
    await observerPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getBattleView?.()?.battle, null, { timeout: 15000 });
    await observerPage.waitForTimeout(2600);
    const recovered = await observerPage.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      const view = debug.getBattleView()?.battle;
      return {
        roundIndex: battle.roundIndex,
        animating: !!battle.animating,
        hasPlayerAction: !!battle.playerAction,
        hasEnemyAction: !!battle.enemyAction,
        canAct: !!view?.canAct,
        canControl: !!view?.canControl,
        recoveryLogCount: (battle.log || []).filter((line) => String(line).includes("頁面刷新後已接回本輪尚未完成的戰鬥結算")).length,
        recovery: debug.battleRefreshRecoveryQa.status(),
      };
    });
    await observerPage.screenshot({ path: path.join(OUTPUT_DIR, `${mode}.png`) });
    await observerContext.close();
    return { mode, frozen, recovered, errors };
  }
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  const recovered = await waitForRecoveredRound(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${mode}.png`) });
  await context.close();
  return { mode, frozen, recovered, errors };
}

async function runSparCase(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(({ snapshotKey, freezeKey }) => {
    localStorage.setItem("op_board_user_id", "990001");
    localStorage.setItem("op_board_client_id", "qa-battle-refresh-host");
    localStorage.setItem("op_name", "戰鬥刷新測試");
    if (!sessionStorage.getItem("qa-battle-refresh-spar-loaded")) {
      localStorage.removeItem(snapshotKey);
      localStorage.removeItem(freezeKey);
      sessionStorage.setItem("qa-battle-refresh-spar-loaded", "1");
    }
  }, { snapshotKey: SERVER_SNAPSHOT_KEY, freezeKey: SERVER_FREEZE_KEY });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.route("**/socket.io/socket.io.js", (route) => route.fulfill({
    status: 200,
    contentType: "application/javascript",
    body: socketMockSource(),
  }));
  await page.goto(`${BASE_URL}/board_game.html?room=BRQA&online=1&skipOpeningStory=1&battle_refresh_recovery_qa=1`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.sparQa && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  const setup = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const catalog = window.BoardCards.cards;
    const runtimeCards = (ids) => ids.map((id) => catalog.find((card) => card.id === id)).filter(Boolean).map(debug.sparQa.cloneRuntimeCard);
    const first = state.gameState.players[0];
    first.id = "990001";
    first.userId = 990001;
    first.clientId = "qa-battle-refresh-host";
    first.name = "戰鬥刷新測試";
    first.crew = runtimeCards(["luffy", "zoro", "sanji", "nami", "robin", "chopper"]);
    first.activeCrewIndex = 0;
    const second = safeClone(first);
    function safeClone(value) { return JSON.parse(JSON.stringify(value)); }
    second.id = "spar-refresh-b";
    second.userId = 990003;
    second.clientId = "qa-spar-refresh-b";
    second.name = "切磋刷新對手";
    second.crew = runtimeCards(["ace", "sabo", "yamato", "hancock", "law", "oden"]);
    const routeId = state.gameState.boardData.routesBetweenIslands[0].id;
    first.location = { kind: "route", routeId, tileIndex: 0 };
    second.location = { kind: "route", routeId, tileIndex: 0 };
    state.gameState.players = [first, second];
    state.gameState.currentPlayerIndex = 0;
    state.gameState.phase = "main";
    state.gameState.postgameWorld.unlocked = true;
    state.gameState.activeSpar = {
      id: "spar-refresh-qa",
      status: "selection",
      initiatorId: first.id,
      opponentId: second.id,
      participantIds: [first.id, second.id],
      picks: { [first.id]: [0, 1, 2], [second.id]: [0, 1, 2] },
      locked: { [first.id]: true, [second.id]: true },
      createdAt: Date.now(),
    };
    if (!debug.sparQa.startBattle(debug.sparQa.normalize())) throw new Error("QA 無法建立切磋戰");
    const battle = state.battleState;
    const a = battle.sparParticipants[first.id];
    const b = battle.sparParticipants[second.id];
    const firstMove = (a.crew[a.activeCrewIndex].moveSet || []).find((move) => Number(move.currentPP || 0) > 0);
    const secondMove = (b.crew[b.activeCrewIndex].moveSet || []).find((move) => Number(move.currentPP || 0) > 0);
    if (!debug.sparQa.queueAction({ type: "move", moveId: firstMove.id })) throw new Error("QA 無法鎖定切磋第一方行動");
    if (!debug.sparQa.queueActionFor(second.id, { type: "move", moveId: secondMove.id })) throw new Error("QA 無法鎖定切磋第二方行動");
    return { firstMove: firstMove.id, secondMove: secondMove.id };
  });
  await page.waitForFunction(() => {
    const battle = window.__BOARD_GAME_DEBUG__?.getState?.()?.battleState;
    return battle?.isSparBattle && battle.animating && battle.participantOrder.every((id) => !!battle.sparParticipants[id]?.action);
  }, null, { timeout: 5000 });
  const frozen = await freezeCurrentSnapshot(page);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug?.getState?.();
    const live = state?.battleState;
    const stashed = state?.gameState?.activeSpar?.battleSnapshot;
    return (!live && stashed?.isSparBattle)
      || (live?.isSparBattle && !live.animating && !!live.result && debug.sparQa.battleView(live)?.canFinish);
  }, null, { timeout: 35000 }).catch(async (error) => {
    const diagnostic = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug?.getState?.();
      const battle = state?.battleState;
      return {
        currentPlayerIndex: state?.gameState?.currentPlayerIndex,
        currentPlayerId: state?.gameState?.players?.[state?.gameState?.currentPlayerIndex]?.id || "",
        resolutionLock: state?.gameState?.resolutionLock,
        activeSpar: state?.gameState?.activeSpar,
        battle,
        recovery: debug?.battleRefreshRecoveryQa?.status?.(),
      };
    }).catch((diagnosticError) => ({ diagnosticError: String(diagnosticError) }));
    throw new Error(`${error.message}\n${JSON.stringify(diagnostic, null, 2)}`);
  });
  const recovered = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState || state.gameState.activeSpar?.battleSnapshot;
    return {
      battleStashed: !state.battleState && !!battle?.isSparBattle,
      result: battle?.result || "",
      animating: !!battle?.animating,
      actionsCleared: (battle?.participantOrder || []).every((id) => !battle.sparParticipants[id]?.action),
      recoveryLogCount: (battle?.log || []).filter((line) => String(line).includes("頁面刷新後已接回本輪尚未完成的切磋結算")).length,
      recovery: debug.battleRefreshRecoveryQa.status(),
    };
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "spar.png") });
  await context.close();
  return { mode: "spar", setup, frozen, recovered, errors };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const cases = [];
  const modes = String(process.env.BOARD_QA_CASES || "queued,visual,fallback,observer").split(",").map((value) => value.trim()).filter(Boolean);
  for (const mode of modes) cases.push(await runCase(browser, mode));
  if (String(process.env.BOARD_QA_INCLUDE_SPAR || "1") !== "0") cases.push(await runSparCase(browser));
  await browser.close();
  const failures = [];
  for (const entry of cases) {
    if (entry.errors.length) failures.push(`${entry.mode}: page errors: ${entry.errors.join(" | ")}`);
    if (entry.mode === "spar") {
      if (entry.recovered.animating || !entry.recovered.actionsCleared) failures.push("spar: refreshed round did not settle");
      if (!entry.recovered.battleStashed && !entry.recovered.result) failures.push("spar: refreshed round did not reach a stable handoff or result");
      if (entry.recovered.recoveryLogCount !== 1) failures.push(`spar: recovery log count was ${entry.recovered.recoveryLogCount}`);
      if (entry.recovered.recovery.hasCheckpoint) failures.push("spar: checkpoint was not cleared");
      continue;
    }
    if (entry.mode === "observer") {
      if (entry.recovered.canControl || entry.recovered.canAct) failures.push("observer: viewer gained battle control");
      if (entry.recovered.recoveryLogCount !== 0) failures.push("observer: viewer resumed the owner's battle resolution");
      if (!entry.recovered.hasPlayerAction || !entry.recovered.hasEnemyAction) failures.push("observer: queued battle state was changed");
      continue;
    }
    const stableNextStep = entry.recovered.canAct
      || (entry.recovered.canFinish && ["round-pause", "win", "lose", "escape"].includes(entry.recovered.result));
    if (!stableNextStep || entry.recovered.animating) {
      failures.push(`${entry.mode}: battle did not return to an actionable round`);
    }
    if (entry.recovered.roundIndex < entry.frozen.roundIndex) failures.push(`${entry.mode}: round moved backwards`);
    if (entry.recovered.recoveryLogCount !== 1) failures.push(`${entry.mode}: recovery log count was ${entry.recovered.recoveryLogCount}`);
    if (entry.recovered.recovery.hasCheckpoint) failures.push(`${entry.mode}: checkpoint was not cleared`);
    if (entry.mode !== "fallback" && !entry.frozen.recovery.hasCheckpoint) failures.push(`${entry.mode}: pre-action checkpoint was not created`);
  }
  const report = { ok: failures.length === 0, failures, cases };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  process.stdout.write(JSON.stringify(report, null, 2));
  process.exitCode = failures.length ? 1 : 0;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
