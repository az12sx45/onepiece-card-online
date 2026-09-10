const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

// Real disposable LAN rooms, one local host and three lobby-created CPUs.
// BOARD_QA_MODE=targeted checks the move-learning/landing modal collision.
// BOARD_QA_BASELINE=1 serves only the verified pre-fix board_game.js for comparison.
// All seed changes and save data belong to fresh, isolated browser contexts.

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18891";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(ROOT_URL).hostname)) {
  throw new Error("CPU arrival QA creates disposable rooms and is localhost only.");
}
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Users/王曜瑋/AppData/Local/ms-playwright/chromium-1193/chrome-win/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-cpu-arrival-20260910";
const BASELINE_REF = "6a6f22c12e8049560fcd071aab926382ec1322f0";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const report = { startedAt: new Date().toISOString(), rootUrl: ROOT_URL, baselineRef: process.env.BOARD_QA_BASELINE === "1" ? BASELINE_REF : null, errors: [], samples: [], cases: [] };
function saveReport() { fs.writeFileSync(path.join(OUTPUT_DIR, "cpu-arrival-report.json"), JSON.stringify(report, null, 2)); }

async function snapshot(page, label) {
  const value = await page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState, p = d.getCurrentPlayer();
    return {
      phase: g.phase, round: g.round, turnStep: g.turnStep, currentPlayerIndex: g.currentPlayerIndex,
      player: p && { id: p.id, name: p.name, isCPU: p.isCPU, location: p.location },
      cpu: d.cpuAutoStatus(), lan: d.boardLanStatus(),
      resolutionLock: g.resolutionLock, movementAnimating: g.movementAnimating, diceRolling: g.diceRolling,
      pendingMove: g.pendingMove, routePrompt: g.routePrompt, islandDecision: g.islandDecision,
      coopBattlePrompt: g.coopBattlePrompt, tradePrompt: g.tradePrompt, activeTrade: g.activeTrade,
      battleState: s.battleState && { playerId: s.battleState.playerId, phase: s.battleState.phase, prebattleIntro: s.battleState.prebattleIntro, animating: s.battleState.animating, roundResolved: s.battleState.roundResolved, result: s.battleState.result },
      boardUiEvent: s.boardUiEvent,
      overlay: [...document.querySelectorAll('[id$="Overlay"], #boardModalBack')].map(e => ({ id: e.id, classes: e.className, display: getComputedStyle(e).display, opacity: getComputedStyle(e).opacity, visibility: getComputedStyle(e).visibility, title: e.innerText?.slice(0, 240) })),
      frames: [...document.querySelectorAll('iframe')].map(e => ({ id: e.id, src: e.src, ready: e.contentDocument?.readyState, title: e.contentDocument?.title })),
      modalOpen: document.getElementById("boardModalBack")?.classList.contains("open"),
      modalText: document.getElementById("boardModal")?.innerText?.slice(0, 1800),
      buttons: [...document.querySelectorAll("#boardModal button")].map(b => ({ id: b.id, text: b.innerText, disabled: b.disabled, visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length) })),
      log: (g.log || g.logs || []).slice(-12),
    };
  });
  report.samples.push({ label, time: new Date().toISOString(), ...value });
  saveReport();
  return value;
}

async function startRoom(browser) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("op_board_user_id", "889901");
    localStorage.setItem("op_board_client_id", "qa-cpu-arrival-host");
    localStorage.setItem("op_name", "CPU停靠測試");
    localStorage.setItem("op_player_name", "CPU停靠測試");
    localStorage.setItem("op_board_story_speed", "3");
  });
  const page = await context.newPage();
  if (process.env.BOARD_QA_BASELINE === "1") {
    const baseline = execFileSync("git", ["show", `${BASELINE_REF}:public/js/board_game.js`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    await page.route("**/js/board_game.js*", route => route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: baseline }));
  }
  page.on("pageerror", e => { report.errors.push({ type: "pageerror", message: e.message, stack: e.stack }); saveReport(); });
  page.on("console", e => {
    if (e.type() === "error" && !e.text().startsWith("Failed to load resource:")) { report.errors.push({ type: "console", message: e.text() }); saveReport(); }
  });
  await page.goto(`${ROOT_URL}/board_start.html?cpu_arrival_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 20000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", "CPU停靠測試");
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app");
  await page.click("#openBoardFlowBtn");
  await page.click("#createBoardRoomBtn");
  await page.waitForFunction(() => /^B[A-Z0-9]+$/.test(document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || ""));
  report.roomCode = (await page.textContent("#boardLobbyRoomCode")).trim();
  for (let count = 2; count <= 4; count += 1) {
    await page.click("#boardAddCpuBtn");
    await page.waitForFunction(n => window.__BOARD_START_DEBUG__.getState().lobby.players.length === n, count);
  }
  report.lobby = await page.evaluate(() => window.__BOARD_START_DEBUG__.getState().lobby);
  await page.click("#boardStartBtn");
  await page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 30000 });
  await page.waitForFunction(() => {
    const d = window.__BOARD_GAME_DEBUG__, l = d?.boardLanStatus?.();
    return d && l?.connected && !l.awaitingInitialState && !l.applying;
  }, null, { timeout: 30000 });
  return { context, page };
}

async function prepareMain(page) {
  return page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState;
    if (g.players.length !== 4 || g.players.filter(p => p.isCPU).length !== 3) throw new Error("Expected 1 human plus 3 real lobby CPUs");
    g.phase = "main";
    g.currentPlayerIndex = g.players.findIndex(p => !p.isCPU);
    g.players.forEach((p, i) => {
      p.crew = window.BoardCards.cards.slice(i * 3, i * 3 + 3).map(c => d.cloneFreshDraftRecruit(c));
      p.activeCrewIndex = 0;
      d.recalcPlayerDerivedStats(p);
    });
    g.resolutionLock = false; g.movementAnimating = false; g.diceRolling = false; g.pendingMove = null;
    g.battleExitLock = false; g.routePrompt = null; g.islandDecision = null; g.tradePrompt = null; g.activeTrade = null;
    g.coopBattlePrompt = null; g.turnStep = "擲骰前進"; s.battleState = null; s.boardUiEvent = null;
    d.closeModal(); d.renderAll(); d.pushBoardLanState("qa-cpu-arrival-main");
    return { humanIndex: g.currentPlayerIndex, playerIds: g.players.map(p => p.id), islandKinds: [...new Set(g.boardData.islands.map(i => i.kind))], gameKeys: Object.keys(g) };
  });
}

async function targetedCases(browser) {
  for (const kind of ["replace", "known", "invalid", "multiple", "visible-learning", "human-visible-learning"]) {
    const { context, page } = await startRoom(browser);
    await prepareMain(page);
    const evidence = await page.evaluate((mode) => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState;
      const p = g.players.find(p => mode === "human-visible-learning" ? !p.isCPU : p.isCPU);
      g.currentPlayerIndex = g.players.indexOf(p);
      const source = window.BoardCards.cards.find(c => c.id === "carrot");
      const card = d.cloneFreshDraftRecruit(source);
      d.gainCardExp(card, 22000);
      p.crew = [card]; p.activeCrewIndex = 0; d.recalcPlayerDerivedStats(p);
      const moves = card.moveSet;
      const base = moves.filter(m => Number(m.unlockLevel || 1) <= 1).slice(0, 4);
      const next = moves.find(m => Number(m.unlockLevel) === 15);
      const second = moves.find(m => Number(m.unlockLevel) === 25);
      if (!next || !second || base.length < 4) throw new Error("Carrot QA move data missing");
      card.unlockedMoveIds = base.map(m => m.id);
      g.pendingMoveLearnQueue = [{ playerId: p.id, cardId: card.id, moveId: mode === "known" ? base[0].id : next.id }];
      if (mode === "invalid") g.pendingMoveLearnQueue.unshift({ playerId: p.id, cardId: "qa-missing-card", moveId: "qa-missing-move" });
      if (mode === "multiple" || mode.endsWith("visible-learning")) g.pendingMoveLearnQueue.push({ playerId: p.id, cardId: card.id, moveId: second.id });
      const tile = g.boardData.seaTiles.find(t => t.zone === "safe");
      const route = d.getRouteById(tile.routeId);
      tile.primaryTypeId = "money";
      p.location = { kind: "route", routeId: tile.routeId, tileIndex: tile.index, fromIslandId: route.from, toIslandId: route.to };
      g.pendingMove = null; g.turnStep = "停靠結算";
      if (mode.endsWith("visible-learning")) d.moveLearnQa.open({ playerId: p.id });
      else d.resolveLanding(p);
      const originalChoice = document.querySelector("[data-sea-choice]");
      const before = { modalOpen: document.getElementById("boardModalBack").classList.contains("open"), choice: !!originalChoice, queue: structuredClone(g.pendingMoveLearnQueue), modalText: document.getElementById("boardModal").innerText };
      const actions = [];
      if (mode === "human-visible-learning") {
        document.querySelector("[data-forget-move-id]").click();
        document.getElementById("confirmMoveLearnBtn").click();
        actions.push("human-confirmed-replacement");
        document.getElementById("skipMoveLearnBtn").click();
        actions.push("human-skipped-next-choice");
      } else {
        for (let i = 0; i < 4 && g.pendingMoveLearnQueue.length; i += 1) actions.push(d.cpuDeadlockQa.handleVisibleOverlay());
      }
      return {
        kind: mode, playerId: p.id, before, actions,
        after: { modalOpen: document.getElementById("boardModalBack").classList.contains("open"), sameChoiceNode: originalChoice && originalChoice === document.querySelector("[data-sea-choice]"), queue: structuredClone(g.pendingMoveLearnQueue), resolutionLock: g.resolutionLock, turnStep: g.turnStep, unlocked: card.unlockedMoveIds, modalText: document.getElementById("boardModal").innerText },
      };
    }, kind);
    report.cases.push(evidence);
    await snapshot(page, `${kind}-after-learning`);
    if (!kind.endsWith("visible-learning") && evidence.after.sameChoiceNode && evidence.after.modalOpen && evidence.after.queue.length === 0) {
      try {
        await page.waitForFunction(id => String(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()?.id) !== String(id), evidence.playerId, { timeout: 12000 });
        evidence.advancedToNextPlayer = true;
      } catch { evidence.advancedToNextPlayer = false; }
      await snapshot(page, `${kind}-after-cpu-landing`);
    }
    evidence.ok = kind.endsWith("visible-learning")
      ? evidence.after.queue.length === 0 && !evidence.after.modalOpen
      : !!evidence.after.sameChoiceNode && evidence.after.modalOpen && evidence.after.queue.length === 0 && evidence.advancedToNextPlayer;
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${kind}.png`), fullPage: false });
    fs.writeFileSync(path.join(OUTPUT_DIR, `${kind}-dom.html`), await page.content());
    fs.writeFileSync(path.join(OUTPUT_DIR, `${kind}-state.json`), JSON.stringify(await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getState()), null, 2));
    saveReport();
    console.log(JSON.stringify({ case: kind, ok: evidence.ok, actions: evidence.actions, sameChoiceNode: evidence.after.sameChoiceNode, queueLeft: evidence.after.queue.length, advanced: evidence.advancedToNextPlayer }));
    await context.close();
  }
  report.ok = report.cases.every(c => c.ok) && report.errors.length === 0;
  if (!report.ok) process.exitCode = 1;
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    if (process.env.BOARD_QA_MODE === "targeted") {
      await targetedCases(browser);
      report.finishedAt = new Date().toISOString();
      return;
    }
    const { page } = await startRoom(browser);
    report.prepared = await prepareMain(page);
    await snapshot(page, "prepared-main");
    await page.evaluate(() => window.__BOARD_GAME_DEBUG__.endTurn());
    let emptyLockedSamples = 0;
    for (let step = 0; step < Number(process.env.BOARD_QA_SAMPLES || 40); step += 1) {
      await page.waitForTimeout(1500);
      const row = await snapshot(page, `natural-${step}`);
      console.log(JSON.stringify({ step, player: row.player?.name, turnStep: row.turnStep, cpu: row.cpu, lock: row.resolutionLock, modal: row.modalText?.slice(0, 180) }));
      const emptyLocked = row.player?.isCPU && row.turnStep === "停靠結算" && row.resolutionLock
        && !row.pendingMove && !row.movementAnimating && !row.diceRolling && !row.battleState
        && !row.modalOpen && !row.coopBattlePrompt && !row.tradePrompt && !row.activeTrade
        && row.cpu.lastResult === "等待移動 / 演出。";
      emptyLockedSamples = emptyLocked ? emptyLockedSamples + 1 : 0;
      if (emptyLockedSamples >= 10) {
        report.failure = { message: "CPU remained at landing resolution without an event UI for 15 seconds", step };
        fs.writeFileSync(path.join(OUTPUT_DIR, "stalled-dom.html"), await page.content());
        fs.writeFileSync(path.join(OUTPUT_DIR, "stalled-state.json"), JSON.stringify(await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getState()), null, 2));
        await page.screenshot({ path: path.join(OUTPUT_DIR, "stalled.png"), fullPage: false });
        process.exitCode = 1;
        break;
      }
      if (row.phase === "main" && !row.player?.isCPU && !row.battleState) {
        await page.evaluate(() => window.__BOARD_GAME_DEBUG__.endTurn());
      }
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, "cpu-arrival-last.png"), fullPage: false });
    report.finishedAt = new Date().toISOString();
    report.ok = !report.failure && report.errors.length === 0;
  } catch (e) {
    report.failure = { message: e.message, stack: e.stack };
    process.exitCode = 1;
  } finally {
    saveReport();
    await browser.close();
  }
})();
