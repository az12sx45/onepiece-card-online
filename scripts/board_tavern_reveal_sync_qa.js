"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");
const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18928";
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-tavern-reveal-20260928/sync";
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OVERLAY = ".tavern-reveal-overlay";
const SKIP = "[data-tavern-reveal-skip]";

async function createDevice(browser, profile, report) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: "Mozilla/5.0 Chrome/146.0.0.0 Safari/537.36 Electron/44.0.0" });
  await context.addInitScript(entry => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    window.__tavernSyncWire = [];
    let originalIo;
    Object.defineProperty(window, "io", {
      configurable: true,
      get: () => originalIo,
      set(value) {
        originalIo = new Proxy(value, { apply(target, thisArg, args) {
          const socket = Reflect.apply(target, thisArg, args);
          const emit = socket.emit;
          socket.emit = function (eventName, ...values) {
            if (["BOARD_GAME_EVENT", "BOARD_GAME_STATE"].includes(eventName)) {
              const event = values[0]?.event;
              const row = { eventName, type: event?.type, kind: event?.detail?.kind, detail: event?.detail?.kind === "tavern-result" ? event.detail : null, reason: values[0]?.reason, ack: null };
              window.__tavernSyncWire.push(row);
              const index = values.length - 1;
              if (typeof values[index] === "function") {
                const callback = values[index];
                values[index] = (...reply) => { row.ack = reply[0]; return callback(...reply); };
              }
            }
            return emit.call(this, eventName, ...values);
          };
          window.__tavernSyncSocket = socket;
          return socket;
        } });
      },
    });
  }, profile);
  const page = await context.newPage();
  // Only the local QA response exposes deterministic sampling. The production
  // weighted draw, event sender and acceptance handlers still execute normally.
  await page.route("**/js/board_game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "  window.__BOARD_GAME_DEBUG__ = {";
    assert(source.includes(marker), "Existing debug marker is available");
    const hook = `window.__tavernSyncDraw = function (id) {
      const player = currentPlayer();
      const pool = tavernRecruitRollPool(tavernRecruitPool(player), player);
      const index = pool.findIndex(card => card.id === id);
      if (index < 0) throw new Error("Controlled candidate is unavailable");
      const total = tavernRecruitTotalWeight(pool, player);
      const prior = pool.slice(0, index).reduce((sum, card) => sum + tavernRecruitWeight(card, player), 0);
      const fraction = (prior + tavernRecruitWeight(pool[index], player) / 2) / total;
      const original = window.crypto.getRandomValues;
      window.crypto.getRandomValues = buffer => { buffer[0] = Math.floor(fraction * 4294967296); return buffer; };
      try { document.getElementById("rollRecruitBtn").click(); }
      finally { window.crypto.getRandomValues = original; }
      return { cost: TAVERN_RECRUIT_ROLL_COST, grade: tavernRecruitGrade(pool[index]) };
    };\n`;
    await route.fulfill({ response, body: source.replace(marker, hook + marker) });
  });
  page.on("pageerror", error => report.errors.push({ device: profile.name, error: error.message }));
  page.on("response", response => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) report.resources.push({ device: profile.name, status: response.status(), url: response.url() });
  });
  await page.goto(`${ROOT_URL}/board_start.html?tavern_sync_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io && document.body.dataset.entryStage === "press", null, { timeout: 15000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app");
  return { ...profile, context, page, userId: await page.evaluate(() => Number(localStorage.getItem("op_board_user_id"))) };
}

async function enterRoom(device, roomCode, create) {
  await device.page.click("#openBoardFlowBtn");
  if (create) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction(expected => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    return document.querySelector('section[data-view="lobby"]')?.classList.contains("active") && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, roomCode, { timeout: 15000 });
}

async function waitForGame(device) {
  await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 20000 });
  await device.page.waitForFunction(() => {
    const status = window.__BOARD_GAME_DEBUG__?.boardLanStatus?.();
    return status?.connected && !status.awaitingInitialState && !status.applying && window.__tavernSyncSocket?.connected;
  }, null, { timeout: 30000 });
}

async function snapshot(device, playerId) {
  return device.page.evaluate(id => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug.getState().gameState;
    const player = game.players.find(entry => String(entry.id) === id);
    return { playerId: String(player.id), coins: player.coins, crewIds: player.crew.map(card => card.id), poolIds: game.availableCards.map(card => card.id).sort(), phase: game.phase, currentPlayerIndex: game.currentPlayerIndex };
  }, playerId);
}

async function main() {
  assert(["127.0.0.1", "localhost"].includes(new URL(ROOT_URL).hostname), "This controlled-state fixture must only run locally.");
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = { ok: false, url: ROOT_URL, scope: "Two isolated Chromium contexts, real local Socket.IO rooms and production draw handlers; controlled initial state and one deterministic random sample. Not human, physical-device, or remote-network acceptance.", checks: [], errors: [], resources: [] };
  const check = (name, condition) => { assert(condition, name); report.checks.push(name); console.log(`PASS ${name}`); };
  const browser = await chromium.launch({ executablePath: CHROME, headless: true });
  let host, guest;
  try {
    const stamp = Date.now().toString(36);
    host = await createDevice(browser, { userId: 889281, clientId: `tavern-host-${stamp}`, name: `招募主${stamp}` }, report);
    guest = await createDevice(browser, { userId: 889282, clientId: `tavern-guest-${stamp}`, name: `招募客${stamp}` }, report);
    await enterRoom(host, "", true);
    report.roomCode = (await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterRoom(guest, report.roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardStartBtn");
    await Promise.all([waitForGame(host), waitForGame(guest)]);
    check("real host create, guest join, ready and start reach connected game", true);

    report.fixture = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = debug.getLocalBoardPlayer();
      const candidate = window.BoardCards.cards.find(card => card.id === "nami");
      const island = game.boardData.islands.find(entry => entry.kind === "tavern");
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
      game.players.forEach(entry => {
        entry.isCPU = false; entry.isCpu = false; entry.cpu = false;
        entry.pendingIslandServiceChoice = null;
        entry.pendingPostgameBossVoyage = null;
        entry.activeMissions = [];
        entry.crew = [];
      });
      player.crew = window.BoardCards.cards.filter(card => card.id !== candidate.id).slice(0, 3).map(card => debug.cloneFreshDraftRecruit(card));
      player.activeCrewIndex = 0;
      player.coins = 20000;
      player.location = { kind: "island", islandId: island.id };
      game.availableCards = [debug.cloneFreshDraftRecruit(candidate)];
      debug.recalcPlayerDerivedStats(player);
      debug.normalizeLoadedGameState();
      debug.closeModal();
      debug.renderAll();
      debug.pushBoardLanState("qa-tavern-sync-fixture");
      return { playerId: String(player.id), islandId: island.id, candidateId: candidate.id, candidateName: candidate.name };
    });
    const id = report.fixture.playerId;
    await guest.page.waitForFunction(({ id, cardId }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      return game.phase === "main" && String(game.players[game.currentPlayerIndex]?.id) === id && game.availableCards.some(card => card.id === cardId) && !debug.boardLanStatus().applying;
    }, { id, cardId: report.fixture.candidateId }, { timeout: 15000 });
    report.before = await snapshot(host, id);
    report.guestBefore = await snapshot(guest, id);
    check("controlled host state reaches guest through normal snapshot", JSON.stringify(report.guestBefore) === JSON.stringify(report.before));
    await host.page.evaluate(islandId => {
      const debug = window.__BOARD_GAME_DEBUG__;
      debug.openTavernModal(debug.getLocalBoardPlayer(), debug.getState().gameState.boardData.islands.find(entry => entry.id === islandId));
    }, report.fixture.islandId);
    await guest.page.locator("#spectatorModalCloseBtn").waitFor({ state: "visible", timeout: 10000 });
    await host.page.locator("#rollRecruitBtn").waitFor({ state: "visible" });
    report.rollMeta = await host.page.evaluate(cardId => window.__tavernSyncDraw(cardId), report.fixture.candidateId);
    await Promise.all([host.page.locator(OVERLAY).waitFor({ state: "visible" }), guest.page.locator(OVERLAY).waitFor({ state: "visible" })]);
    const presentation = device => device.page.evaluate(() => {
      const overlay = document.querySelector(".tavern-reveal-overlay");
      return { grade: overlay.dataset.grade, name: overlay.querySelector(".tavern-reveal-name").textContent, portrait: new URL(overlay.querySelector(".tavern-reveal-character").src).pathname, color: overlay.style.getPropertyValue("--tavern-reveal-color"), stage: overlay.dataset.stage };
    });
    report.presentation = { host: await presentation(host), guest: await presentation(guest) };
    const { stage: hostStage, ...hostArt } = report.presentation.host;
    const { stage: guestStage, ...guestArt } = report.presentation.guest;
    check("actual draw presents same character, tier, portrait and color to both devices", JSON.stringify(hostArt) === JSON.stringify(guestArt) && hostArt.name === report.fixture.candidateName && hostArt.grade === report.rollMeta.grade);
    report.rolled = await snapshot(host, id);
    check("actual draw charges once and keeps crew undecided", report.before.coins - report.rolled.coins === report.rollMeta.cost && JSON.stringify(report.rolled.crewIds) === JSON.stringify(report.before.crewIds));
    await Promise.all([host.page.screenshot({ path: path.join(OUTPUT, "host-invitation.png") }), guest.page.screenshot({ path: path.join(OUTPUT, "guest-invitation.png") })]);
    await guest.page.waitForFunction(({ id, coins }) => window.__BOARD_GAME_DEBUG__.getState().gameState.players.find(entry => String(entry.id) === id)?.coins === coins, { id, coins: report.rolled.coins }, { timeout: 12000 });
    const guestBefore = await snapshot(guest, id);
    check("spectator has no recruitment decision controls", await guest.page.locator("#acceptRecruitBtn, #rejectRecruitBtn, [data-replace-crew]").count() === 0);
    await guest.page.locator(SKIP).click();
    await guest.page.locator(OVERLAY).waitFor({ state: "detached" });
    check("spectator skip changes no authoritative recruitment state", JSON.stringify(await snapshot(guest, id)) === JSON.stringify(guestBefore));
    check("spectator retains only its close action", await guest.page.locator("#spectatorModalCloseBtn").isEnabled());
    await host.page.locator(SKIP).click();
    await host.page.locator(OVERLAY).waitFor({ state: "detached" });
    const acceptWireStart = await host.page.evaluate(() => window.__tavernSyncWire.length);
    await host.page.locator("#acceptRecruitBtn").click();
    await guest.page.waitForFunction(({ id, cardId }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      return debug.getState().gameState.players.find(entry => String(entry.id) === id)?.crew.some(card => card.id === cardId) && !debug.boardLanStatus().applying;
    }, { id, cardId: report.fixture.candidateId }, { timeout: 15000 });
    report.after = { host: await snapshot(host, id), guest: await snapshot(guest, id) };
    check("accept propagates exactly one recruit and removes candidate from pool", report.after.host.crewIds.filter(cardId => cardId === report.fixture.candidateId).length === 1 && !report.after.host.poolIds.includes(report.fixture.candidateId) && report.after.host.coins === report.rolled.coins);
    check("normal acceptance state push makes host and guest identical", JSON.stringify(report.after.host) === JSON.stringify(report.after.guest));
    await guest.page.reload({ waitUntil: "domcontentloaded" });
    await waitForGame(guest);
    report.refresh = { state: await snapshot(guest, id), localUserId: await guest.page.evaluate(() => Number(window.__BOARD_GAME_DEBUG__.getLocalBoardPlayer()?.userId)) };
    check("guest refresh restores accepted crew, pool, coins, turn and identity", JSON.stringify(report.refresh.state) === JSON.stringify(report.after.host) && report.refresh.localUserId === guest.userId);
    await guest.page.screenshot({ path: path.join(OUTPUT, "guest-after-refresh.png") });
    report.wire = await host.page.evaluate(() => window.__tavernSyncWire);
    check("tavern reveal travels on acknowledged existing spectator event", report.wire.some(row => row.kind === "tavern-result" && row.detail?.tavernReveal === true && row.ack?.ok === true));
    check("acceptance uses acknowledged normal game-state transport", report.wire.slice(acceptWireStart).some(row => row.eventName === "BOARD_GAME_STATE" && row.ack?.ok === true));
    check("no browser runtime errors", report.errors.length === 0);
    report.ok = true;
  } catch (error) {
    report.failure = error.stack;
    for (const device of [host, guest].filter(Boolean)) {
      await device.page.screenshot({ path: path.join(OUTPUT, `${device === host ? "host" : "guest"}-failure.png`) }).catch(() => {});
      report[device === host ? "hostFailure" : "guestFailure"] = await device.page.evaluate(() => ({ url: location.href, entryStage: document.body.dataset.entryStage, modalText: document.getElementById("boardModal")?.textContent?.slice(0, 700), overlay: document.querySelector(".tavern-reveal-overlay")?.dataset.stage, status: window.__BOARD_GAME_DEBUG__?.boardLanStatus?.() })).catch(() => null);
    }
  } finally {
    if (host) await host.context.close();
    if (guest) await guest.context.close();
    await browser.close();
    fs.writeFileSync(path.join(OUTPUT, "result.json"), JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.ok ? 0 : 1;
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
