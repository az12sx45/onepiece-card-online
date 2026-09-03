"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const baseUrl = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8787";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outputDir = path.resolve(__dirname, "..", "_codex_artifacts", "spar-lan-sync-qa");
fs.mkdirSync(outputDir, { recursive: true });

const profiles = {
  host: { userId: 97201, clientId: "spar-lan-host", name: "PK 房主", avatar: 1 },
  guest: { userId: 97202, clientId: "spar-lan-guest", name: "PK 對手", avatar: 2 },
  outsider: { userId: 97203, clientId: "spar-lan-outsider", name: "旁觀者", avatar: 3 },
};

function emitAck(page, eventName, payload) {
  return page.evaluate(({ eventName, payload }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${eventName} ack timeout`)), 5000);
    window.__qaSocket.emit(eventName, payload, (response) => {
      clearTimeout(timer);
      resolve(response || null);
    });
  }), { eventName, payload });
}

async function makeSocketPage(browser, profile) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/board_start.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.addScriptTag({ url: `${baseUrl}/socket.io/socket.io.js` });
  await page.evaluate((currentProfile) => new Promise((resolve, reject) => {
    window.__qaMessages = [];
    window.__qaSocket = window.io({ transports: ["websocket"] });
    window.__qaSocket.on("BOARD_GAME_STATE", (message) => window.__qaMessages.push(message));
    window.__qaSocket.once("connect", resolve);
    window.__qaSocket.once("connect_error", (error) => reject(new Error(error?.message || "connect_error")));
    window.__qaProfile = currentProfile;
  }), profile);
  return { context, page };
}

async function waitForReason(page, reason) {
  await page.waitForFunction((expected) => window.__qaMessages.some((message) => message?.reason === expected), reason, { timeout: 7000 });
  return page.evaluate((expected) => window.__qaMessages.find((message) => message?.reason === expected), reason);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const failures = [];
  const roomCode = `SPAR${Date.now().toString(36).slice(-6).toUpperCase()}`;
  const host = await makeSocketPage(browser, profiles.host);
  const guest = await makeSocketPage(browser, profiles.guest);
  const outsider = await makeSocketPage(browser, profiles.outsider);

  const joins = {
    host: await emitAck(host.page, "BOARD_JOIN_ROOM", { create: true, roomCode, profile: profiles.host }),
    guest: await emitAck(guest.page, "BOARD_JOIN_ROOM", { roomCode, profile: profiles.guest }),
    outsider: await emitAck(outsider.page, "BOARD_JOIN_ROOM", { roomCode, profile: profiles.outsider }),
  };

  const location = { kind: "route", routeId: "qa-route", tileIndex: 4 };
  const players = [
    { id: "spar-player-a", ...profiles.host, isCpu: false, location },
    { id: "spar-player-b", ...profiles.outsider, isCpu: false, location: { ...location, tileIndex: 7 } },
    { id: "spar-player-c", ...profiles.guest, isCpu: false, location },
  ];
  const activeSpar = {
    id: `spar-sync-${Date.now()}`,
    status: "invited",
    initiatorId: players[0].id,
    opponentId: players[2].id,
    participantIds: [players[0].id, players[2].id],
    picks: { [players[0].id]: [], [players[2].id]: [] },
    locked: { [players[0].id]: false, [players[2].id]: false },
  };
  const seedPayload = {
    gameState: {
      boardData: { id: "spar-lan-qa-board" },
      phase: "main",
      currentPlayerIndex: 0,
      round: 21,
      players,
      activeSpar,
      postgameWorld: { unlocked: true },
      settings: { bgmVolume: 0.5 },
    },
    battleState: null,
  };

  const seedAck = await emitAck(host.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.host.clientId,
    reason: "spar-invite",
    baseVersion: 0,
    version: 1,
    payload: seedPayload,
  });
  const seededForGuest = await waitForReason(guest.page, "spar-invite");

  const acceptedPayload = JSON.parse(JSON.stringify(seedPayload));
  acceptedPayload.gameState.activeSpar.status = "selection";
  const acceptAck = await emitAck(guest.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.guest.clientId,
    reason: "spar-accept",
    baseVersion: Number(seedAck?.version || 0),
    version: Number(seedAck?.version || 0) + 1,
    payload: acceptedPayload,
  });
  const acceptedForHost = await waitForReason(host.page, "spar-accept");

  const battlePayload = JSON.parse(JSON.stringify(acceptedPayload));
  battlePayload.gameState.activeSpar.status = "battle";
  battlePayload.battleState = {
    isSparBattle: true,
    id: activeSpar.id,
    playerId: players[0].id,
    participantOrder: [players[0].id, players[2].id],
    sparParticipants: {
      [players[0].id]: { playerId: players[0].id, pendingAction: null },
      [players[2].id]: { playerId: players[2].id, pendingAction: null },
    },
    roundIndex: 1,
    turnOwnerId: players[0].id,
  };
  const guestActionPayload = JSON.parse(JSON.stringify(battlePayload));
  guestActionPayload.battleState.sparParticipants[players[2].id].pendingAction = { type: "move", moveId: "qa-move" };
  const guestActionAck = await emitAck(guest.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.guest.clientId,
    reason: "spar-action",
    baseVersion: Number(acceptAck?.version || 0),
    version: Number(acceptAck?.version || 0) + 1,
    payload: guestActionPayload,
  });
  const actionForHost = await waitForReason(host.page, "spar-action");

  const stashedPayload = JSON.parse(JSON.stringify(guestActionPayload));
  stashedPayload.gameState.currentPlayerIndex = 1;
  stashedPayload.gameState.activeSpar.battleSnapshot = stashedPayload.battleState;
  stashedPayload.gameState.activeSpar.battleSnapshot.waitingMapTurn = true;
  stashedPayload.battleState = null;
  const roundCompleteAck = await emitAck(guest.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.guest.clientId,
    reason: "spar-turn-complete",
    baseVersion: Number(guestActionAck?.version || 0),
    version: Number(guestActionAck?.version || 0) + 1,
    payload: stashedPayload,
  });
  const bTurnForHost = await waitForReason(host.page, "spar-turn-complete");

  const bTurnPayload = JSON.parse(JSON.stringify(stashedPayload));
  bTurnPayload.gameState.currentPlayerIndex = 2;
  const bTurnAck = await emitAck(outsider.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.outsider.clientId,
    reason: "turn-end",
    baseVersion: Number(roundCompleteAck?.version || 0),
    version: Number(roundCompleteAck?.version || 0) + 1,
    payload: bTurnPayload,
  });
  const cTurnForGuest = await waitForReason(guest.page, "turn-end");

  const cBattlePayload = JSON.parse(JSON.stringify(bTurnPayload));
  cBattlePayload.battleState = cBattlePayload.gameState.activeSpar.battleSnapshot;
  cBattlePayload.gameState.activeSpar.battleSnapshot = null;
  cBattlePayload.battleState.turnOwnerId = players[2].id;
  cBattlePayload.battleState.roundIndex = 2;
  cBattlePayload.battleState.waitingMapTurn = false;
  const cTurnStartAck = await emitAck(guest.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.guest.clientId,
    reason: "spar-turn-start",
    baseVersion: Number(bTurnAck?.version || 0),
    version: Number(bTurnAck?.version || 0) + 1,
    payload: cBattlePayload,
  });
  const cBattleForHost = await waitForReason(host.page, "spar-turn-start");

  const outsiderPayload = JSON.parse(JSON.stringify(cBattlePayload));
  outsiderPayload.battleState.roundIndex = 3;
  const outsiderAck = await emitAck(outsider.page, "BOARD_GAME_STATE", {
    roomCode,
    sourceClientId: profiles.outsider.clientId,
    reason: "spar-action",
    baseVersion: Number(cTurnStartAck?.version || 0),
    version: Number(cTurnStartAck?.version || 0) + 1,
    payload: outsiderPayload,
  });

  if (!joins.host?.ok || !joins.guest?.ok || !joins.outsider?.ok) failures.push("one or more browser sockets could not join the same room");
  if (!seedAck?.ok || seededForGuest?.payload?.gameState?.activeSpar?.status !== "invited") failures.push("host spar invitation did not synchronize to guest");
  if (!acceptAck?.ok || acceptedForHost?.payload?.gameState?.activeSpar?.status !== "selection") failures.push("guest could not accept and synchronize spar selection");
  if (!guestActionAck?.ok || actionForHost?.payload?.battleState?.sparParticipants?.[players[2].id]?.pendingAction?.moveId !== "qa-move") failures.push("non-turn spar participant action did not synchronize");
  if (!roundCompleteAck?.ok || bTurnForHost?.payload?.gameState?.currentPlayerIndex !== 1 || bTurnForHost?.payload?.battleState) failures.push("A-C spar round did not return to B with battle stashed");
  if (!bTurnAck?.ok || cTurnForGuest?.payload?.gameState?.currentPlayerIndex !== 2 || !cTurnForGuest?.payload?.gameState?.activeSpar?.battleSnapshot) failures.push("B normal turn did not advance to C with spar preserved");
  if (!cTurnStartAck?.ok || cBattleForHost?.payload?.battleState?.turnOwnerId !== players[2].id || cBattleForHost?.payload?.gameState?.currentPlayerIndex !== 2) failures.push("C turn did not resume the stashed spar battle");
  if (outsiderAck?.ok || outsiderAck?.error !== "not_your_turn") failures.push(`non-participant update was not rejected: ${JSON.stringify(outsiderAck)}`);

  const report = {
    roomCode,
    joins,
    seedAck,
    acceptAck,
    guestActionAck,
    roundCompleteAck,
    bTurnAck,
    cTurnStartAck,
    outsiderAck,
    versions: {
      invite: seededForGuest?.version || 0,
      accept: acceptedForHost?.version || 0,
      action: actionForHost?.version || 0,
      roundComplete: bTurnForHost?.version || 0,
      bTurn: cTurnForGuest?.version || 0,
      cTurnStart: cBattleForHost?.version || 0,
    },
    failures,
  };
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await Promise.all([host.context.close(), guest.context.close(), outsider.context.close()]);
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
