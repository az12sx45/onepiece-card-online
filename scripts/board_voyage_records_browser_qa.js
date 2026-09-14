"use strict";

// Local integration QA. Real Chrome / Socket.IO / application controls are used.
// The first-cycle crew, round, inventory and pending battle are explicit fixtures,
// injected through the existing debug API; this is not a natural full playthrough.
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");

const BASE = process.env.BOARD_QA_URL || "http://127.0.0.1:18914";
const runTag = Date.now().toString(36);
const OUTPUT = process.env.BOARD_QA_OUTPUT || `D:/Codex_QA/board-voyage-records-20260914/browser/${runTag}`;
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const report = { startedAt: new Date().toISOString(), base: BASE, runTag, checks: [], errors: [], dialogs: [], fixtures: ["Main phase at rounds 7, 8 and 9; six fresh recruits from production BoardCards; coins and heal_2 inventory marker; one production startBattle result preserved as an inactive player's pendingBattle. An explicit saveKind:auto call covers backup persistence without waiting for the timer."], evidence: "Local no-database preview identities; real Chrome contexts, UI and Socket.IO. No production accounts or saves.", devices: [] };

function check(label, condition, detail) {
  report.checks.push({ label, ok: Boolean(condition), detail });
  console.log(`${condition ? "PASS" : "FAIL"} ${label}`);
  assert(condition, `${label}: ${JSON.stringify(detail)}`);
}

async function createDevice(browser, label, offset) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const profile = { userId: 891400 + offset, clientId: `voyage-qa-${runTag}-${label}`, name: `航海QA${label}${runTag.slice(-4)}` };
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    if (location.pathname.endsWith("/board_game.html")) {
      const url = new URL(location.href);
      url.searchParams.set("skipOpeningStory", "1");
      history.replaceState(null, "", url.href);
    }
  }, profile);
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push(`${label}: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) report.errors.push(`${label}: ${message.text()}`);
  });
  page.on("dialog", async dialog => { report.dialogs.push({ label, type: dialog.type(), message: dialog.message() }); await dialog.accept(); });
  await page.goto(`${BASE}/board_start.html?qa=${runTag}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 20000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app", null, { timeout: 20000 });
  profile.userId = await page.evaluate(() => Number(localStorage.getItem("op_board_user_id")));
  report.devices.push({ label, ...profile });
  return { label, context, page, ...profile };
}

async function socketAck(device, event, payload = {}) {
  return device.page.evaluate(({ event, payload }) => new Promise((resolve, reject) => {
    const shared = window.BoardShared.getState();
    const socket = shared.socket;
    if (!socket?.connected) return reject(new Error("Board application socket is not connected"));
    const timer = setTimeout(() => reject(new Error(`${event} ACK timeout`)), 15000);
    socket.emit(event, { ...payload, profile: shared.profile }, result => { clearTimeout(timer); resolve(result); });
  }), { event, payload });
}

async function listRecords(device) {
  const result = await socketAck(device, "BOARD_CAMPAIGN_LIST");
  assert.equal(result.ok, true, JSON.stringify(result));
  return result.campaigns;
}

async function enterRoom(device, roomCode = "") {
  await device.page.click("#openBoardFlowBtn");
  if (!roomCode) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction(expected => {
    const code = document.getElementById("boardLobbyRoomCode")?.textContent?.trim();
    return document.querySelector('section[data-view="lobby"]')?.classList.contains("active") && (expected ? code === expected : /^B[A-Z0-9]+$/.test(code || ""));
  }, roomCode, { timeout: 20000 });
  return (await device.page.textContent("#boardLobbyRoomCode")).trim();
}

async function waitForGame(device) {
  await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 20000 });
  await device.page.waitForFunction(() => {
    const d = window.__BOARD_GAME_DEBUG__;
    const status = d?.boardLanStatus();
    return status?.connected && !status.awaitingInitialState && d.getState()?.gameState?.players?.length;
  }, null, { timeout: 30000 });
}

async function startPair(host, guest) {
  const code = await enterRoom(host);
  await enterRoom(guest, code);
  await guest.page.click("#boardReadyBtn");
  await host.page.click("#boardStartBtn");
  await Promise.all([host, guest].map(waitForGame));
  return code;
}

async function prepareFirstCycle(host, round) {
  return host.page.evaluate(({ round }) => {
    const d = window.__BOARD_GAME_DEBUG__;
    const state = d.getState();
    const game = state.gameState;
    game.phase = "main";
    game.round = round;
    game.currentPlayerIndex = 0;
    game.turnStep = "擲骰前進";
    game.resolutionLock = false;
    game.pendingMove = null;
    game.battleExitLock = false;
    state.battleState = null;
    state.boardUiEvent = null;
    game.players.forEach((player, i) => {
      player.crew = window.BoardCards.cards.slice(i * 3, i * 3 + 3).map(card => d.cloneFreshDraftRecruit(card));
      player.activeCrewIndex = 0;
      player.coins = 1400 + i;
      player.pendingBattle = null;
      d.recalcPlayerDerivedStats(player);
      d.grantGameItems(["heal_2"], 2, i);
    });
    d.closeModal();
    d.renderAll();
    d.pushBoardLanState("qa-voyage-first-cycle");
    return { seed: game.seed, round: game.round, players: game.players.map(p => ({ id: p.id, userId: p.userId, crew: p.crew.map(c => c.id), coins: p.coins, inventory: structuredClone(p.inventory.items) })), islands: game.boardData.islands.length, routes: game.boardData.routes?.length || 0, finalEndingCleared: Boolean(game.finalEndingCleared), postgameUnlocked: Boolean(game.postgameWorld?.unlocked) };
  }, { round });
}

async function waitRound(device, round) {
  await device.page.waitForFunction(expected => {
    const d = window.__BOARD_GAME_DEBUG__;
    const s = d?.boardLanStatus();
    return d?.getState()?.gameState?.round === expected && !s.applying && !s.hasInFlightState && !s.hasPendingState;
  }, round, { timeout: 20000 });
}

async function saveThroughUi(device) {
  await device.page.evaluate(() => window.__BOARD_GAME_DEBUG__.closeModal());
  await device.page.click("#saveGameBtn");
  await device.page.getByText("航海錄已保存", { exact: true }).first().waitFor({ state: "visible", timeout: 20000 });
  const context = await device.page.evaluate(() => structuredClone(window.__BOARD_GAME_DEBUG__.getState().campaignContext));
  if (await device.page.locator("#saveOkBtn").count()) await device.page.click("#saveOkBtn");
  else await device.page.evaluate(() => window.__BOARD_GAME_DEBUG__.closeModal());
  assert(context?.campaignId, "Save did not return a campaign identity");
  return context;
}

async function goRecords(device) {
  await device.page.goto(`${BASE}/board_start.html?view=campaigns&qa=${runTag}`, { waitUntil: "domcontentloaded" });
  await device.page.waitForFunction(() => ["auth", "app"].includes(document.body.dataset.entryStage), null, { timeout: 20000 });
  if (await device.page.evaluate(() => document.body.dataset.entryStage === "auth")) {
    await device.page.fill("#boardAuthUsername", device.name);
    await device.page.click("#boardAuthSubmitBtn");
  }
  await device.page.waitForFunction(() => document.body.dataset.entryStage === "app" && window.BoardShared?.getState()?.socket?.connected, null, { timeout: 20000 });
  await device.page.waitForFunction(() => document.querySelector('section[data-view="campaigns"]')?.classList.contains("active"), null, { timeout: 15000 });
}

function recordCard(device, id) { return device.page.locator(`article.campaign-save-card[data-campaign-id="${id}"]`); }

async function refreshRecords(device) {
  await device.page.click("#refreshCampaignsBtn");
  await listRecords(device);
}

async function snapshot(device) {
  return device.page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__;
    const s = d.getState();
    return { seed: s.gameState.seed, round: s.gameState.round, context: structuredClone(s.campaignContext), islands: s.gameState.boardData.islands.length, players: s.gameState.players.map(p => ({ id: String(p.id), userId: Number(p.userId), coins: p.coins, inventory: structuredClone(p.inventory.items), crew: p.crew.map(c => String(c.id)), pendingBattle: Boolean(p.pendingBattle), isCPU: Boolean(p.isCPU) })), battle: s.battleState ? { playerId: String(s.battleState.playerId), enemyName: s.battleState.enemyName } : null, lan: d.boardLanStatus() };
  });
}

async function preparePendingBattle(host, guest) {
  return host.page.evaluate(({ guestId }) => {
    const d = window.__BOARD_GAME_DEBUG__;
    const s = d.getState();
    const game = s.gameState;
    const actor = game.players[game.currentPlayerIndex];
    const other = game.players.find(p => Number(p.userId || p.id) === guestId);
    const island = game.boardData.islands.find(entry => d.getIslandState(entry.id)?.enemyProfile);
    actor.location = { kind: "island", islandId: island.id };
    other.location = { kind: "island", islandId: island.id };
    d.closeModal();
    d.startBattle(actor, island, d.getIslandState(island.id));
    const assertPending = Boolean(s.battleState);
    if (!assertPending) throw new Error("Production startBattle did not produce a battle fixture");
    const pending = structuredClone(s.battleState);
    pending.playerId = other.id;
    pending.playerName = other.name;
    pending.activeCrewIndex = 0;
    other.pendingBattle = pending;
    actor.pendingBattle = null;
    s.battleState = null;
    s.boardUiEvent = null;
    game.round = 9;
    game.turnStep = "擲骰前進";
    game.resolutionLock = false;
    game.battleExitLock = false;
    d.closeModal();
    d.renderAll();
    d.pushBoardLanState("qa-voyage-pending-battle");
    return { guestPlayerId: String(other.id), islandId: island.id };
  }, { guestId: guest.userId });
}

async function main() {
  await fs.mkdir(OUTPUT, { recursive: true });
  const runtime = await (await fetch(`${BASE}/api/board-runtime`)).json();
  assert.equal(new URL(BASE).hostname, "127.0.0.1", "This QA is restricted to local preview");
  assert.equal(runtime.accountDatabaseEnabled, false, "Do not run fixture QA against an account database");
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const devices = [];
  try {
    const a = await createDevice(browser, "A", 1); devices.push(a);
    const b = await createDevice(browser, "B", 2); devices.push(b);
    const c = await createDevice(browser, "C", 3); devices.push(c);
    report.firstRoom = await startPair(a, b);
    report.initialFixture = await prepareFirstCycle(a, 7);
    await waitRound(b, 7);
    check("fixture remains first cycle", !report.initialFixture.finalEndingCleared && !report.initialFixture.postgameUnlocked, report.initialFixture);
    const saved = await saveThroughUi(b);
    const originalId = saved.campaignId;
    report.originalId = originalId;
    const autoSave = await a.page.evaluate(() => window.__BOARD_GAME_DEBUG__.saveManualGame({ silent: true, saveKind: "auto" }));
    check("automatic backup persistence handler accepts current snapshot", Boolean(autoSave?.campaignSaved), { campaignSaved: autoSave?.campaignSaved });
    let aRecords = await listRecords(a);
    let bRecords = await listRecords(b);
    let cRecords = await listRecords(c);
    check("both members see same first-cycle record", aRecords.some(r => r.campaignId === originalId) && bRecords.some(r => r.campaignId === originalId), { a: aRecords, b: bRecords });
    check("unrelated player cannot list record", !cRecords.some(r => r.campaignId === originalId), cRecords);
    const denied = await socketAck(c, "BOARD_CAMPAIGN_OPEN", { campaignId: originalId, mode: "gather" });
    check("unrelated player cannot open record", denied.ok === false, denied);

    await a.page.evaluate(() => { const d = window.__BOARD_GAME_DEBUG__; d.getState().gameState.round = 8; d.pushBoardLanState("qa-voyage-newer-authority"); });
    await waitRound(b, 8);
    await b.page.evaluate(() => { window.__BOARD_GAME_DEBUG__.getState().gameState.round = 999; });
    await saveThroughUi(b);
    aRecords = await listRecords(a);
    check("nonacting member saves server snapshot rather than stale local world", aRecords.find(r => r.campaignId === originalId)?.progress?.round === 8, aRecords.find(r => r.campaignId === originalId));
    await b.page.reload({ waitUntil: "domcontentloaded" }); await waitForGame(b);
    const pending = await preparePendingBattle(a, b);
    await waitRound(b, 9);
    // Fixture creation uses production startBattle (which opens its iframe).
    // A real refresh clears that old presentation and restores the committed
    // inactive pending battle before exercising the visible save control.
    await a.page.reload({ waitUntil: "domcontentloaded" }); await waitForGame(a);
    await saveThroughUi(a);
    const originalBeforeCopy = (await listRecords(a)).find(r => r.campaignId === originalId);
    report.pendingFixture = pending;
    check("recent backups expose distinct snapshots", originalBeforeCopy.backups?.length >= 2, originalBeforeCopy.backups);

    await Promise.all([a, b].map(goRecords));
    await recordCard(a, originalId).waitFor();
    await recordCard(b, originalId).waitFor();
    await a.page.screenshot({ path: path.join(OUTPUT, "records-desktop.png"), fullPage: true });
    await a.page.setViewportSize({ width: 390, height: 844 });
    await a.page.screenshot({ path: path.join(OUTPUT, "records-mobile-390.png"), fullPage: true });
    const mobile = await a.page.evaluate(() => ({ innerWidth, scrollWidth: document.documentElement.scrollWidth, cards: [...document.querySelectorAll(".campaign-save-card")].map(el => { const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, width: r.width }; }) }));
    check("390px records have no horizontal overflow", mobile.scrollWidth <= 391 && mobile.cards.every(r => r.left >= -1 && r.right <= 391), mobile);
    await a.page.setViewportSize({ width: 1440, height: 1000 });

    const renamed = `我的A與B航海-${runTag}`;
    await recordCard(a, originalId).locator("details.campaign-manage > summary").click();
    await recordCard(a, originalId).locator("[data-campaign-name]").fill(renamed);
    await recordCard(a, originalId).locator("[data-campaign-rename]").click();
    await a.page.waitForFunction(({ id, name }) => document.querySelector(`[data-campaign-id="${id}"] .campaign-save-title`)?.textContent?.includes(name), { id: originalId, name: renamed });
    await refreshRecords(b);
    check("rename is shared by members", (await listRecords(b)).find(r => r.campaignId === originalId)?.name === renamed, (await listRecords(b)).find(r => r.campaignId === originalId));

    await recordCard(a, originalId).locator("[data-campaign-continue]").click();
    await a.page.waitForFunction(() => document.querySelector('section[data-view="lobby"]')?.classList.contains("active"));
    const beforeReady = await socketAck(a, "BOARD_START_GAME", {});
    check("gather cannot start without original teammate", beforeReady.ok === false, beforeReady);
    await refreshRecords(b);
    await recordCard(b, originalId).locator("[data-campaign-continue]").click();
    await b.page.waitForFunction(() => document.querySelector('section[data-view="lobby"]')?.classList.contains("active"));
    await b.page.click("#boardReadyBtn");
    await a.page.click("#boardReadyBtn");
    await a.page.click("#boardStartBtn");
    await Promise.all([a, b].map(waitForGame));
    const restored = await Promise.all([a, b].map(snapshot));
    check("gather restores shared map players crews inventory and pending battle", restored.every(s => s.context.campaignId === originalId && s.round === 9 && s.seed === report.initialFixture.seed && s.islands === report.initialFixture.islands && s.players.some(p => p.id === pending.guestPlayerId && p.pendingBattle) && s.players.every(p => p.crew.length === 3 && p.coins >= 1400 && Number(p.inventory.heal_2) >= 2)), restored);
    await a.page.evaluate(() => { const d = window.__BOARD_GAME_DEBUG__; d.closeModal(); d.endTurn(); });
    await Promise.all([a, b].map(device => device.page.waitForFunction(expected => {
      const state = window.__BOARD_GAME_DEBUG__?.getState();
      return String(state?.battleState?.playerId || "") === expected && document.getElementById("battlePageOverlay")?.classList.contains("open");
    }, pending.guestPlayerId, { timeout: 20000 })));
    check("pending battle resumes visibly on both contexts", true, await Promise.all([a, b].map(snapshot)));
    await b.page.reload({ waitUntil: "domcontentloaded" }); await waitForGame(b);
    await b.page.waitForFunction(() => document.getElementById("battlePageOverlay")?.classList.contains("open"), null, { timeout: 20000 });
    check("refresh restores battle and guest identity", (await b.page.evaluate(() => Number(window.__BOARD_GAME_DEBUG__.getLocalBoardPlayer()?.userId))) === b.userId);
    await b.page.screenshot({ path: path.join(OUTPUT, "gather-restored-battle.png") });

    await Promise.all([a, b].map(goRecords));
    const parentBaseline = (await listRecords(a)).find(r => r.campaignId === originalId);
    await recordCard(a, originalId).locator("[data-campaign-copy]").click();
    await waitForGame(a);
    const copied = await snapshot(a);
    check("solo copy has new identity and preserves original team world", copied.context.campaignId !== originalId && copied.round === 9 && copied.players.length === 2, copied);
    const copyId = copied.context.campaignId;
    await a.page.evaluate(() => { const d = window.__BOARD_GAME_DEBUG__; const s = d.getState(); s.gameState.round = 23; s.gameState.currentPlayerIndex = s.gameState.players.findIndex(p => !p.isCPU); s.gameState.players.forEach(p => { p.pendingBattle = null; }); s.battleState = null; s.boardUiEvent = null; s.gameState.resolutionLock = false; s.gameState.battleExitLock = false; d.closeModal(); d.renderAll(); d.pushBoardLanState("qa-private-copy"); });
    await waitRound(a, 23);
    await saveThroughUi(a);
    const afterCopy = await listRecords(a);
    check("private continuation does not change shared progress", afterCopy.find(r => r.campaignId === originalId)?.revision === parentBaseline.revision && afterCopy.find(r => r.campaignId === originalId)?.progress?.round === parentBaseline.progress.round, { before: parentBaseline, after: afterCopy.find(r => r.campaignId === originalId) });
    check("private copy is absent from teammate list", !(await listRecords(b)).some(r => r.campaignId === copyId));
    await goRecords(a);
    const originalWithBackups = (await listRecords(a)).find(r => r.campaignId === originalId);
    await recordCard(a, originalId).locator("details.campaign-manage > summary").click();
    const backupButton = recordCard(a, originalId).locator("[data-backup-revision]").last();
    const backupRevision = Number(await backupButton.getAttribute("data-backup-revision"));
    const expectedBackup = originalWithBackups.backups.find(r => Number(r.revision) === backupRevision);
    await backupButton.click();
    await waitForGame(a);
    const backupCopy = await snapshot(a);
    check("backup restore creates separate record with selected round", backupCopy.context.campaignId !== originalId && backupCopy.context.campaignId !== copyId && backupCopy.round === expectedBackup.round, { backupRevision, expectedBackup, backupCopy });

    await goRecords(a);
    await a.page.click("#backFromCampaignsBtn");
    report.secondRoom = await startPair(a, c);
    await prepareFirstCycle(a, 31);
    await waitRound(c, 31);
    const otherTeam = await saveThroughUi(c);
    check("different team receives independent record", otherTeam.campaignId !== originalId && !(await listRecords(b)).some(r => r.campaignId === otherTeam.campaignId) && !(await listRecords(c)).some(r => r.campaignId === originalId), { otherTeam });
    check("shared world remains unchanged after different team saves", (await listRecords(a)).find(r => r.campaignId === originalId)?.progress.round === parentBaseline.progress.round);
    check("no unexpected page or console errors", report.errors.length === 0, report.errors);
    report.ok = true;
  } catch (error) {
    report.ok = false;
    report.failure = error.stack;
    report.diagnostics = [];
    for (const device of devices) {
      report.diagnostics.push({ label: device.label, url: device.page.url(), text: await device.page.locator("body").innerText().catch(() => "unavailable"), state: await snapshot(device).catch(() => null) });
      await device.page.screenshot({ path: path.join(OUTPUT, `failure-${device.label}.png`), fullPage: true }).catch(() => {});
    }
  } finally {
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(OUTPUT, "report.json"), JSON.stringify(report, null, 2) + "\n");
    await Promise.all(devices.map(d => d.context.close()));
    await browser.close();
  }
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, errors: report.errors, failure: report.failure || null, report: path.join(OUTPUT, "report.json") }, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

module.exports = { socketAck, listRecords, enterRoom, waitForGame, startPair, prepareFirstCycle, waitRound, saveThroughUi, goRecords, recordCard, snapshot };

if (require.main === module) main().catch(async error => { console.error(error); process.exitCode = 1; });
