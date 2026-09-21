"use strict";

// State/control regression only. Browser and actual LAN transport acceptance are
// exercised separately; this runs the production functions with deterministic UI
// edges and timers so the 260 ms battle-close race cannot be hidden by timing.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/js/board_game.js"), "utf8").replace(/\r\n/g, "\n");
function productionFunction(name) {
  const expression = new RegExp(`^  (?:async )?function ${name}\\(`, "m");
  const start = source.search(expression);
  assert.ok(start >= 0, `production function ${name} exists`);
  const tail = source.slice(start);
  const end = tail.search(/^  }$/m);
  assert.ok(end > 0, `production function ${name} ends`);
  return tail.slice(0, end + 3).trim();
}

const functions = [
  "safeJsonClone", "getIslandById", "getIslandState", "isServiceIslandKind",
  "serviceIslandLabel", "temporaryEnemyIslandTurnsLeft", "isTemporaryEnemyIslandService",
  "getEffectiveIslandKind", "remoteBoardPlaybackBusy", "canBoardLanControlPlayerIdentity",
  "canBoardLanControlCurrentPlayer", "warnBoardLanTurnLocked", "closeBattlePageOverlay",
  "resumeAfterRemoteBoardPlayback", "clearPendingIslandServiceChoice",
  "pendingIslandServiceChoiceOwnsResolutionLock", "releasePendingIslandServiceChoiceLock",
  "markPendingIslandServiceChoice", "markPendingIslandServiceChoiceForPlayers",
  "pendingIslandServiceChoiceAction", "canOpenPendingIslandServiceChoice",
  "cpuShouldEnterPendingIslandService", "resolvePendingIslandServiceChoice",
  "openPendingIslandServiceChoice", "scheduleTurnStartIslandServiceChoiceForCurrentPlayer",
  "devObserverHandlePendingIslandServiceChoice", "itemRevealIsPending", "notifyItemRevealIdle",
  "finishIslandServiceTurn", "syncTurnActionButtons", "boardUiEventLifetimeMs", "handleBoardUiEvent",
];

let checks = 0;
function check(actual, expected, description) {
  assert.deepEqual(actual, expected, description);
  checks += 1;
}
function classes() {
  const values = new Set();
  return {
    contains: (name) => values.has(name),
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
  };
}

function harness(options = {}) {
  let now = 0;
  let serial = 0;
  const timers = new Map();
  const trace = [];
  const calls = { entered: 0, rolls: 0, renders: 0, scheduledLearn: 0, spectator: 0, markup: "", events: [] };
  const player = { id: "p1", userId: 1, clientId: "c1", name: "Captain", isCPU: !!options.cpu, location: { kind: "island", islandId: "enemy-qa" } };
  const island = { id: "enemy-qa", name: "Enemy QA", kind: "enemy" };
  const islandState = { currentKind: options.kind || "shop", isDefeated: true, temporaryServiceExpiresAtRound: 4 };
  const overlay = { classList: classes(), setAttribute() {} };
  const modalBack = { classList: classes() };
  const buttons = new Map();
  const context = {
    console, Date, Math, Set,
    TEMPORARY_ENEMY_ISLAND_SERVICE_KINDS: ["shop", "hospital", "tavern"],
    WATER_SEVEN_ISLAND_ID: "water-seven",
    ISLAND_IMAGE_MAP: { unknown: "qa.webp" },
    state: { battleState: null, battleWindow: null, gameState: {
      phase: "main", currentPlayerIndex: 0, round: 1, turnStep: "擲骰前進", resolutionLock: false,
      players: [player], boardData: { islands: [island], islandStates: { [island.id]: islandState } },
    } },
    boardLan: { enabled: options.online !== false, connected: true, awaitingInitialState: false, clientId: "c1", pendingRemoteBattleViews: [] },
    profile: { clientId: "c1" },
    remotePlayback: { status: () => ({ active: false, pending: 0 }), resume() {} },
    battleVisualIngress: { status: () => ({ pending: 0 }) },
    battlePageOverlayCloseTimer: null,
    handledBoardUiEventIds: new Set(),
    itemRevealActive: false, itemRevealQueue: [], itemRevealTimer: null, itemRevealIdleCallbacks: [],
    refs: {
      modalBack, modal: { querySelector: () => calls.markup.includes("island-service-choice-ui") ? {} : null },
      itemRevealHud: { classList: classes() }, rollDiceBtn: {}, useItemBtn: {}, inspectTileBtn: {},
    },
    document: { getElementById: (id) => {
      if (id === "battlePageOverlay") return overlay;
      if (!buttons.has(id)) buttons.set(id, { addEventListener() {} });
      return buttons.get(id);
    } },
    window: {
      setTimeout(callback, delay = 0) { const id = ++serial; timers.set(id, { at: now + delay, callback }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    currentPlayer: () => context.state.gameState.players[context.state.gameState.currentPlayerIndex],
    canLocalDriveCpuPlayer: (entry) => !!entry?.isCPU && context.boardLan.clientId === "c1",
    boardPlayerMatchesLocalUser: (entry) => entry?.clientId === context.boardLan.clientId,
    localPlayerIsLobbyHost: () => context.boardLan.clientId === "c1",
    isCpuPlayer: (entry) => !!entry?.isCPU,
    shared: { showToast: (message) => trace.push(["toast", message]) },
    clearBattlePageOverlayOpenTimers() {}, clearBattlePrebattleIntroRecoveryTimer() {},
    notifyBattleWindow() {}, scheduleAutoResumeBattleForCurrentPlayer() {}, scheduleAutoResumePendingMoveForCurrentPlayer() {},
    shouldRunCpuAutoStep: () => false, scheduleCpuAutoStep() {}, activeSparBlocksCurrentTurn: () => false,
    pendingCoopBattleResultForPlayer: () => null,
    devObserverNeedsRecovery: () => false, devObserverDesiredResearchLabExtractor: () => null,
    devObserverDesiredShopItemId: () => "", devObserverShouldRollTavern: () => false,
    devObserverCompletedMission: () => null, devObserverBestMissionChoice: () => null, cpuChooseArenaPlan: () => null,
    getIslandImageUrl: () => "qa.webp", escapeModalText: (value) => String(value),
    openModal(html) { calls.markup = html; modalBack.classList.add("open"); },
    openSpectatorBoardModal() { calls.spectator += 1; modalBack.classList.add("open"); },
    closeModal() { trace.push(["close", context.currentPlayer()?.pendingIslandServiceChoice || null]); calls.markup = ""; modalBack.classList.remove("open"); },
    enterIslandService(action) { calls.entered += 1; calls.enteredKind = action.kind; modalBack.classList.add("open"); return true; },
    renderAll() { calls.renders += 1; },
    scheduleBoardLanStatePush: (reason) => calls.events.push(reason),
    rollDice() { calls.rolls += 1; }, addLog: (message) => trace.push(["log", message]),
    endTurn() { trace.push(["end", context.currentPlayer()?.pendingIslandServiceChoice || null]); context.state.gameState.currentPlayerIndex += 1; },
    schedulePendingMoveLearn() { calls.scheduledLearn += 1; },
    canResumeBattle: () => false, isGameActionLocked: () => false,
    currentIslandServiceAction: () => ({ label: "商店島" }), updateShipTokensOnMap() {},
  };
  vm.createContext(context);
  functions.forEach((name) => vm.runInContext(productionFunction(name), context, { filename: `board_game.js:${name}` }));
  const directRollDice = vm.runInContext(`(${productionFunction("rollDice")})`, context);
  function advance(ms) {
    const until = now + ms;
    let fired = 0;
    while (true) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      assert.ok(++fired < 100, "timer scheduling must remain bounded");
      now = next[1].at;
      timers.delete(next[0]);
      next[1].callback();
    }
    now = until;
  }
  const mark = (required = true) => context.markPendingIslandServiceChoice(player, island, islandState.currentKind, { islandId: island.id }, required ? { requiredEntry: true } : {});
  return { context, player, island, islandState, overlay, modalBack, calls, trace, mark, advance, directRollDice, timerCount: () => timers.size };
}

async function main() {
  // The real overlay close path must still deny LAN actions until closing ends.
  {
    const h = harness(); h.mark();
    h.context.closeBattlePageOverlay();
    check(h.context.remoteBoardPlaybackBusy(), true, "closing overlay keeps the playback lock");
    check(h.context.canBoardLanControlCurrentPlayer(h.player), false, "LAN owner cannot bypass closing");
    check(h.context.openPendingIslandServiceChoice(), false, "required entry waits for closing");
    check(h.player.pendingIslandServiceChoice.requiredEntry, true, "waiting preserves required entry");
    h.advance(259);
    check(h.calls.entered, 0, "service cannot open before close finishes");
    h.advance(1);
    check(h.context.canBoardLanControlCurrentPlayer(h.player), true, "LAN owner regains control after closing");
    check(h.calls.entered, 1, "close completion resumes required service");
    h.advance(2000);
    check(h.calls.entered, 1, "remaining retries do not reopen an active service");
    check(h.timerCount(), 0, "service retry timers finish without a loop");
  }
  for (const kind of ["shop", "hospital", "tavern"]) {
    const h = harness({ kind }); h.mark();
    check(h.context.resolvePendingIslandServiceChoice({ player: h.player }, "roll"), true, `${kind}: forced roll request is handled`);
    check(h.calls.enteredKind, kind, `${kind}: forced roll enters the service`);
    check(h.calls.rolls, 0, `${kind}: forced entry never rolls`);
    check(h.player.pendingIslandServiceChoice.requiredEntry, true, `${kind}: marker survives until service completes`);
  }
  {
    const h = harness(); h.mark();
    await h.directRollDice();
    check(h.calls.entered, 1, "direct dice API is redirected into required entry");
    check(h.context.state.gameState.pendingMove, undefined, "required entry does not create movement");
    h.context.syncTurnActionButtons();
    check(h.context.refs.rollDiceBtn.disabled, true, "dice stays disabled while service is required");
    check(h.context.refs.rollDiceBtn.textContent, "進入島嶼", "dice button shows entry state");
  }
  {
    const h = harness({ cpu: true, kind: "hospital" }); h.mark();
    check(h.context.cpuShouldEnterPendingIslandService(h.context.pendingIslandServiceChoiceAction()), true, "healthy CPU still enters its mandatory hospital");
    check(Boolean(h.context.devObserverHandlePendingIslandServiceChoice()), true, "CPU executes its required entry");
    check(h.calls.entered, 1, "CPU opens service before regular turn actions");
    check(h.calls.rolls, 0, "CPU does not roll through required entry");
    check(h.context.devObserverHandlePendingIslandServiceChoice(), "", "CPU leaves an open service to its normal service handler");
  }
  {
    const h = harness(); h.mark(false);
    check(Object.hasOwn(h.player.pendingIslandServiceChoice, "requiredEntry"), false, "legacy choice markers stay optional");
    check(h.context.openPendingIslandServiceChoice(), true, "legacy choice opens normally");
    check(h.calls.markup.includes('id="rollFromPostBattleIslandBtn"'), true, "legacy choice still offers rolling");
    check(h.context.resolvePendingIslandServiceChoice({ player: h.player }, "roll"), true, "legacy roll option resolves");
    check(h.calls.rolls, 1, "legacy participant can roll");
    check(h.player.pendingIslandServiceChoice, null, "optional choice clears when resolved");
    const cpu = harness({ cpu: true, kind: "hospital" }); cpu.mark(false);
    check(cpu.context.cpuShouldEnterPendingIslandService(cpu.context.pendingIslandServiceChoiceAction()), false, "healthy optional CPU retains its skip decision");
  }
  {
    const h = harness(); h.mark();
    const supporter = { ...h.player, id: "p2", userId: 2, clientId: "c2", pendingIslandServiceChoice: null };
    const marked = h.context.markPendingIslandServiceChoiceForPlayers([h.player, supporter, supporter], h.island, "shop", {}, h.player);
    check(marked.length, 1, "co-op supporters are marked once and winner excluded");
    check(supporter.pendingIslandServiceChoice.requiredEntry, undefined, "co-op supporter keeps an optional choice");
    h.context.state.gameState = h.context.safeJsonClone(h.context.state.gameState);
    check(h.context.currentPlayer().pendingIslandServiceChoice.requiredEntry, true, "JSON save clone retains required entry");
    check(h.context.pendingIslandServiceChoiceAction().kind, "shop", "cloned save still resolves its service");
    h.context.scheduleTurnStartIslandServiceChoiceForCurrentPlayer(); h.advance(0);
    check(h.calls.entered, 1, "restored state resumes required service");
  }
  for (const invalid of ["route", "other-island", "enemy-returned", "missing-state"]) {
    const h = harness(); h.mark();
    h.context.state.gameState.resolutionLock = true;
    h.context.state.gameState.turnStep = `${h.island.name}：進島或出發`;
    if (invalid === "route") h.player.location = { kind: "route", routeId: "qa-route" };
    if (invalid === "other-island") h.player.location.islandId = "elsewhere";
    if (invalid === "enemy-returned") h.islandState.currentKind = "enemy";
    if (invalid === "missing-state") delete h.context.state.gameState.boardData.islandStates[h.island.id];
    check(h.context.pendingIslandServiceChoiceAction(), null, `${invalid}: stale service is rejected`);
    check(h.player.pendingIslandServiceChoice, null, `${invalid}: stale marker is removed`);
    check(h.context.state.gameState.resolutionLock, false, `${invalid}: stale choice-owned lock is released`);
  }
  {
    const h = harness(); h.mark();
    h.context.itemRevealActive = true;
    h.context.scheduleTurnStartIslandServiceChoiceForCurrentPlayer(); h.advance(3000);
    check(h.calls.entered, 0, "required entry waits for a long reward reveal");
    h.context.notifyItemRevealIdle(); h.advance(0);
    check(h.calls.entered, 0, "non-idle notification cannot bypass a reward");
    h.context.itemRevealActive = false;
    h.context.notifyItemRevealIdle(); h.advance(0);
    check(h.calls.entered, 1, "finishing reward after initial retries resumes service");
    h.context.notifyItemRevealIdle(); h.advance(1000);
    check(h.calls.entered, 1, "repeated idle signals do not reopen the visible service");
  }
  {
    const h = harness(); h.mark();
    h.context.openPendingIslandServiceChoice();
    h.context.finishIslandServiceTurn();
    check(h.player.pendingIslandServiceChoice, null, "service completion consumes required marker");
    check(h.trace.map((entry) => entry[0]).join(","), "close,end", "service closes before handing off");
    check(h.trace.every((entry) => entry[1] === null), true, "marker is cleared before close and handoff callbacks");
    check(h.context.state.gameState.currentPlayerIndex, 1, "service hands off exactly once");
    check(h.calls.scheduledLearn, 1, "existing move-learning follow-up is preserved");
  }
  // Service broadcasts carry a display name, not a stable island ID. Recovery
  // therefore validates the pending marker against the player's live location;
  // it does not claim that the historical event names the exact same island.
  for (const kind of ["shop", "hospital", "tavern"]) {
    const h = harness({ kind }); h.mark();
    const event = { id: `own-${kind}`, type: "spectator-modal", createdAt: Date.now(), playerId: h.player.id, detail: { kind, islandName: "Previous display name" } };
    h.context.handleBoardUiEvent(event);
    check(h.calls.spectator, 0, `${kind}: owner does not restore its own read-only broadcast`);
    check(h.calls.entered, 0, `${kind}: event recovery queues entry instead of bypassing scheduling`);
    h.advance(0);
    check(h.calls.enteredKind, kind, `${kind}: current pending service reopens as interactive`);
    h.context.handleBoardUiEvent(event); h.advance(1000);
    check(h.calls.entered, 1, `${kind}: repeated broadcast does not reopen the service`);
  }
  for (const excluded of ["other-player", "optional", "different-location", "different-kind", "non-owner", "cpu-non-host"]) {
    const h = harness({ cpu: excluded === "cpu-non-host" }); h.mark(excluded !== "optional");
    const event = { id: `excluded-${excluded}`, type: "spectator-modal", createdAt: Date.now(), playerId: h.player.id, detail: { kind: "shop" } };
    if (excluded === "other-player") event.playerId = "p2";
    if (excluded === "different-location") h.player.location.islandId = "different-island";
    if (excluded === "different-kind") event.detail.kind = "hospital";
    if (excluded === "non-owner" || excluded === "cpu-non-host") h.context.boardLan.clientId = "c2";
    h.context.handleBoardUiEvent(event); h.advance(1000);
    check(h.calls.spectator, 1, `${excluded}: existing spectator behavior is preserved`);
    check(h.calls.entered, 0, `${excluded}: event cannot force an interactive service`);
  }
  {
    const h = harness({ cpu: true }); h.mark();
    h.player.clientId = "cpu-player";
    h.context.handleBoardUiEvent({ id: "cpu-host-recovery", type: "spectator-modal", createdAt: Date.now(), playerId: h.player.id, detail: { kind: "shop" } });
    h.advance(0);
    check(h.calls.spectator, 0, "CPU host does not open the CPU service as read-only");
    check(h.calls.entered, 1, "CPU host restores its controlled service");
  }
  console.log(JSON.stringify({ ok: true, checks, scope: "production function VM state/control regression" }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
