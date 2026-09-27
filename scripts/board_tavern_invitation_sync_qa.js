"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");
const URL_ROOT = process.env.BOARD_QA_URL || "http://127.0.0.1:18928";
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-tavern-crew-20260928/sync";
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OVERLAY = ".tavern-reveal-overlay";
const SKIP = "[data-tavern-reveal-skip]";

// Fixture-only closure access; actual draw, buttons and Socket.IO handlers remain unchanged.
const ACCESS = `
  window.__tavernCrewSyncQa = {
    prepare(count = 3) {
      devObserver.running = false;
      clearTimeout(devObserver.timer);
      clearTimeout(cpuAuto.timer);
      const game = state.gameState;
      const player = localBoardPlayer();
      const candidate = window.BoardCards.cards.find(card => card.id === "nami");
      const island = game.boardData.islands.find(entry => entry.kind === "tavern");
      game.phase = "main";
      game.currentPlayerIndex = game.players.indexOf(player);
      game.turnStep = "擲骰前進";
      game.pendingMove = game.routePrompt = game.islandDecision = null;
      game.resolutionLock = game.movementAnimating = game.battleExitLock = false;
      state.battleState = state.boardUiEvent = null;
      game.players.forEach(entry => {
        entry.isCPU = entry.isCpu = entry.cpu = false;
        entry.pendingIslandServiceChoice = entry.pendingPostgameBossVoyage = null;
        entry.activeMissions = [];
        entry.crew = [];
      });
      player.crew = window.BoardCards.cards.filter(card => card.id !== candidate.id).slice(0, count).map(cloneFreshDraftRecruit);
      player.activeCrewIndex = 0;
      player.coins = 20000;
      player.location = { kind: "island", islandId: island.id };
      game.availableCards = [cloneFreshDraftRecruit(candidate)];
      recalcPlayerDerivedStats(player);
      normalizeLoadedGameState();
      closeModal();
      renderAll();
      pushBoardLanState("qa-tavern-crew-sync-fixture");
      this.island = island;
      return { playerId: String(player.id), candidateId: candidate.id, candidateName: candidate.name, count };
    },
    open() { openTavernModal(localBoardPlayer(), this.island); },
    draw(id) {
      const player = currentPlayer();
      const pool = tavernRecruitRollPool(tavernRecruitPool(player), player);
      const index = pool.findIndex(card => card.id === id);
      if (index < 0) throw new Error("Controlled candidate unavailable");
      const total = tavernRecruitTotalWeight(pool, player);
      const prior = pool.slice(0, index).reduce((sum, card) => sum + tavernRecruitWeight(card, player), 0);
      const fraction = (prior + tavernRecruitWeight(pool[index], player) / 2) / total;
      const random = window.crypto.getRandomValues;
      window.crypto.getRandomValues = buffer => { buffer[0] = Math.floor(fraction * 4294967296); return buffer; };
      try { document.getElementById("rollRecruitBtn").click(); }
      finally { window.crypto.getRandomValues = random; }
      return { cost: TAVERN_RECRUIT_ROLL_COST, grade: tavernRecruitGrade(pool[index]) };
    },
  };
`;

async function device(browser, profile, report) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: "Mozilla/5.0 Chrome/146.0.0.0 Safari/537.36 Electron/44.0.0" });
  await context.addInitScript(entry => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    window.__tavernCrewWire = [];
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
              const row = { eventName, type: event?.type, kind: event?.detail?.kind, detail: event?.detail?.kind === "tavern-result" ? event.detail : null, ack: null };
              window.__tavernCrewWire.push(row);
              const index = values.length - 1;
              if (typeof values[index] === "function") {
                const callback = values[index];
                values[index] = (...reply) => { row.ack = reply[0]; return callback(...reply); };
              }
            }
            return emit.call(this, eventName, ...values);
          };
          window.__tavernCrewSocket = socket;
          return socket;
        } });
      },
    });
  }, profile);
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push({ device: profile.name, error: error.message }));
  await page.route("**/js/board_game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "  window.__BOARD_GAME_DEBUG__ = {";
    assert(source.includes(marker));
    await route.fulfill({ response, body: source.replace(marker, ACCESS + marker) });
  });
  await page.route("**/js/board_tavern_crew.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    assert(source.includes("function choose() {"));
    await route.fulfill({ response, body: source.replace("function choose() {", 'function choose() { return "zoro";') });
  });
  await page.goto(`${URL_ROOT}/board_start.html?tavern_crew_sync_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io && document.body.dataset.entryStage === "press", null, { timeout: 15000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app");
  return { ...profile, context, page, userId: await page.evaluate(() => Number(localStorage.getItem("op_board_user_id"))) };
}

async function room(entry, code = "") {
  await entry.page.click("#openBoardFlowBtn");
  if (code) { await entry.page.fill("#roomCodeInput", code); await entry.page.click("#joinBoardRoomBtn"); }
  else await entry.page.click("#createBoardRoomBtn");
  await entry.page.waitForFunction(expected => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    return document.querySelector('section[data-view="lobby"]')?.classList.contains("active") && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, code, { timeout: 15000 });
}
async function connected(entry) {
  await entry.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 20000 });
  await entry.page.waitForFunction(() => {
    const status = window.__BOARD_GAME_DEBUG__?.boardLanStatus?.();
    return status?.connected && !status.awaitingInitialState && !status.applying && window.__tavernCrewSocket?.connected && window.BoardTavernReveal?.version === "2";
  }, null, { timeout: 30000 });
}
async function snapshot(entry, id) {
  return entry.page.evaluate(playerId => {
    const game = window.__BOARD_GAME_DEBUG__.getState().gameState;
    const player = game.players.find(row => String(row.id) === playerId);
    return { coins: player.coins, crew: player.crew.map(card => card.id), pool: game.availableCards.map(card => card.id).sort(), phase: game.phase, turn: game.currentPlayerIndex };
  }, id);
}
async function ready(entry, stage) {
  await entry.page.waitForFunction(expected => {
    const overlay = document.querySelector(".tavern-reveal-overlay");
    return overlay?.dataset.stage === expected && overlay.dataset.ready === "1";
  }, stage, { timeout: 12000 });
}
async function presentation(entry) {
  return entry.page.evaluate(() => {
    const overlay = document.querySelector(".tavern-reveal-overlay");
    return { host: overlay.dataset.host, stage: overlay.dataset.stage, grade: overlay.dataset.grade, color: overlay.style.getPropertyValue("--tavern-reveal-color"), line: overlay.querySelector(".tavern-reveal-line").textContent, image: overlay.querySelector(".tavern-reveal-host").getAttribute("src") };
  });
}

async function main() {
  assert(["127.0.0.1", "localhost"].includes(new URL(URL_ROOT).hostname), "Controlled fixtures are local only");
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = { ok: false, scope: "Three independent real local Socket.IO rooms, each with two isolated Chromium contexts using create/join/start, production recruitment and state handlers. Initial state and cosmetic host controlled only in QA responses. Not physical-device, human-play or remote-network acceptance.", checks: [], outcomes: [], wire: [], errors: [] };
  const check = (name, value) => { assert(value, name); report.checks.push(name); console.log(`PASS ${name}`); };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  let host, guest;
  try {
    for (const action of ["accept", "decline", "replace"]) {
      const stamp = Date.now().toString(36);
      host = await device(browser, { userId: 889291, clientId: `crew-host-${stamp}`, name: `酒館主${stamp}` }, report);
      guest = await device(browser, { userId: 889292, clientId: `crew-guest-${stamp}`, name: `酒館客${stamp}` }, report);
      await room(host);
      const roomCode = (await host.page.textContent("#boardLobbyRoomCode")).trim();
      await room(guest, roomCode);
      await guest.page.click("#boardReadyBtn");
      await host.page.click("#boardStartBtn");
      await Promise.all([connected(host), connected(guest)]);
      check(`${action} real host create, guest join, ready and start reach connected v2 game`, true);
      const fixture = await host.page.evaluate(count => window.__tavernCrewSyncQa.prepare(count), action === "replace" ? 6 : 3);
      await guest.page.waitForFunction(({ id, count }) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const game = debug.getState().gameState;
        const player = game.players.find(row => String(row.id) === id);
        return game.phase === "main" && String(game.players[game.currentPlayerIndex]?.id) === id && player.coins === 20000 && player.crew.length === count && !player.crew.some(card => card.id === "nami") && !debug.boardLanStatus().applying;
      }, { id: fixture.playerId, count: fixture.count }, { timeout: 15000 });
      const before = await snapshot(host, fixture.playerId);
      check(`${action} fixture synchronizes before drawing`, JSON.stringify(before) === JSON.stringify(await snapshot(guest, fixture.playerId)));
      await host.page.evaluate(() => window.__tavernCrewSyncQa.open());
      await guest.page.locator("#spectatorModalCloseBtn").waitFor({ state: "visible", timeout: 10000 });
      const draw = await host.page.evaluate(id => window.__tavernCrewSyncQa.draw(id), fixture.candidateId);
      await Promise.all([ready(host, "invitation"), ready(guest, "invitation")]);
      const invitation = { host: await presentation(host), guest: await presentation(guest) };
      report.current = { action, fixture, before, invitation };
      const { stage: hostStage, ...hostInvitation } = invitation.host;
      const { stage: guestStage, ...guestInvitation } = invitation.guest;
      check(`${action} invitation shares the actor's host, art, line, grade and color`, JSON.stringify(hostInvitation) === JSON.stringify(guestInvitation) && hostInvitation.host === "zoro" && hostInvitation.grade === draw.grade);
      check(`${action} spectator has no original or overlay decision controls`, await guest.page.locator("#acceptRecruitBtn, #rejectRecruitBtn, [data-replace-crew], [data-tavern-choice]").count() === 0);
      await guest.page.waitForFunction(({ id, coins }) => window.__BOARD_GAME_DEBUG__.getState().gameState.players.find(row => String(row.id) === id)?.coins === coins, { id: fixture.playerId, coins: before.coins - draw.cost });
      const paid = await snapshot(host, fixture.playerId);
      const paidVersion = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
      check(`${action} real draw deducts exactly 2500 without changing crew`, paid.coins === before.coins - 2500 && JSON.stringify(paid.crew) === JSON.stringify(before.crew));
      await guest.page.locator(SKIP).click();
      await guest.page.locator(OVERLAY).waitFor({ state: "detached" });
      check(`${action} spectator skip changes no authoritative state`, JSON.stringify(await snapshot(guest, fixture.playerId)) === JSON.stringify(paid));
      await ready(host, "choice");
      await host.page.locator(`[data-tavern-choice="${action === "decline" ? "decline" : "accept"}"]`).click();
      if (action === "replace") {
        await host.page.locator(OVERLAY).waitFor({ state: "detached" });
        check("replacement chooser has not mutated the draw", JSON.stringify(await snapshot(host, fixture.playerId)) === JSON.stringify(paid));
        await host.page.locator('[data-replace-crew="0"]').click();
      }
      const outcome = action === "decline" ? "decline" : "accept";
      await Promise.all([ready(host, outcome), ready(guest, outcome)]);
      const reaction = { host: await presentation(host), guest: await presentation(guest) };
      check(`${action} reaction shares the same host and outcome on both clients`, JSON.stringify(reaction.host) === JSON.stringify(reaction.guest) && reaction.host.host === invitation.host.host && reaction.host.stage === outcome);
      check(`${action} reaction precedes authoritative settlement`, JSON.stringify(await snapshot(host, fixture.playerId)) === JSON.stringify(paid));
      await Promise.all([host.page.screenshot({ path: path.join(OUTPUT, `${action}-host-reaction.png`) }), guest.page.screenshot({ path: path.join(OUTPUT, `${action}-guest-reaction.png`) })]);
      await guest.page.locator(SKIP).click();
      check(`${action} spectator reaction skip cannot settle the owner`, JSON.stringify(await snapshot(host, fixture.playerId)) === JSON.stringify(paid));
      await host.page.locator(SKIP).click();
      await host.page.locator(OVERLAY).waitFor({ state: "detached" });
      await host.page.waitForFunction(version => {
        const status = window.__BOARD_GAME_DEBUG__.boardLanStatus();
        return status.version > version && status.lastAck?.ok === true && !status.hasInFlightState && !status.hasPendingState && !status.hasPushTimer;
      }, paidVersion, { timeout: 15000 });
      const committedVersion = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
      await guest.page.waitForFunction(({ id, expected, action, version }) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const status = debug.boardLanStatus();
        const game = debug.getState().gameState;
        const player = game.players.find(row => String(row.id) === id);
        return status.version >= version && !status.applying && !status.playback.active && status.playback.pending === 0 && !document.querySelector(".tavern-result-ui") && (action === "decline" ? player.crew.length === expected : player.crew.some(card => card.id === "nami"));
      }, { id: fixture.playerId, expected: before.crew.length, action, version: committedVersion }, { timeout: 15000 });
      const after = { host: await snapshot(host, fixture.playerId), guest: await snapshot(guest, fixture.playerId) };
      report.current.after = after;
      check(`${action} normal state transport makes both clients identical`, JSON.stringify(after.host) === JSON.stringify(after.guest));
      check(`${action} settles original crew, pool and payment once`, after.host.coins === paid.coins && (action === "decline" ? JSON.stringify(after.host.crew) === JSON.stringify(before.crew) && after.host.pool.includes("nami") : after.host.crew.filter(id => id === "nami").length === 1 && !after.host.pool.includes("nami") && after.host.crew.length === (action === "replace" ? 6 : 4)));
      if (action === "replace") check("replacement returns the displaced crew member to pool", after.host.pool.includes(before.crew[0]));
      const guestWire = await guest.page.evaluate(() => window.__tavernCrewWire);
      check(`${action} guest never emits a tavern recruitment decision`, !guestWire.some(row => row.kind === "tavern-result"));
      report.outcomes.push({ action, roomCode, fixture, before, paid, invitation, reaction, after });
      await guest.page.reload({ waitUntil: "domcontentloaded" });
      await connected(guest);
      check(`${action} guest refresh restores result and identity`, JSON.stringify(await snapshot(guest, fixture.playerId)) === JSON.stringify(after.host) && await guest.page.evaluate(() => Number(window.__BOARD_GAME_DEBUG__.getLocalBoardPlayer()?.userId)) === guest.userId);
      report.wire.push(...await host.page.evaluate(() => window.__tavernCrewWire));
      await host.context.close();
      await guest.context.close();
      host = guest = null;
    }
    check("new reaction phases use acknowledged existing spectator transport", ["accept", "decline"].every(phase => report.wire.some(row => row.kind === "tavern-result" && row.detail?.tavernHost === "zoro" && row.detail?.tavernOutcome === phase && row.ack?.ok === true)));
    check("settlement uses acknowledged existing BOARD_GAME_STATE transport", report.wire.some(row => row.eventName === "BOARD_GAME_STATE" && row.ack?.ok === true));
    check("no runtime errors across either browser context", report.errors.length === 0);
    report.ok = true;
  } catch (error) {
    report.failure = error.stack;
    for (const entry of [host, guest].filter(Boolean)) {
      const name = entry === host ? "host" : "guest";
      await entry.page.screenshot({ path: path.join(OUTPUT, `${name}-failure.png`) }).catch(() => {});
      report[`${name}Failure`] = await entry.page.evaluate(() => ({ url: location.href, modal: document.getElementById("boardModal")?.textContent?.slice(0, 800), overlay: document.querySelector(".tavern-reveal-overlay")?.dataset, status: window.__BOARD_GAME_DEBUG__?.boardLanStatus?.(), wire: window.__tavernCrewWire?.slice(-12) })).catch(() => null);
    }
    throw error;
  } finally {
    fs.writeFileSync(path.join(OUTPUT, "result.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
