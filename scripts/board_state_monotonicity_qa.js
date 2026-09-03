"use strict";

const { chromium } = require("playwright");

const baseUrl = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8787";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const hostProfile = {
  userId: 98401,
  clientId: "board-monotonicity-host",
  name: "版本測試房主",
  avatar: 1,
};

function emitAck(page, eventName, payload, timeoutMs = 5000) {
  return page.evaluate(({ eventName, payload, timeoutMs }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${eventName} ack timeout`)), timeoutMs);
    window.__qaSocket.emit(eventName, payload, (response) => {
      clearTimeout(timer);
      resolve(response || null);
    });
  }), { eventName, payload, timeoutMs });
}

async function makeSocketPage(browser, profile, label) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${baseUrl}/board_start.html`, { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.addScriptTag({ url: `${baseUrl}/socket.io/socket.io.js` });
  await page.evaluate(({ profile, label }) => new Promise((resolve, reject) => {
    window.__qaLabel = label;
    window.__qaProfile = profile;
    window.__qaStates = [];
    window.__qaEvents = [];
    window.__qaFences = [];
    window.__qaSocket = window.io({ transports: ["websocket"] });
    window.__qaSocket.on("BOARD_GAME_STATE", (message) => window.__qaStates.push(message));
    window.__qaSocket.on("BOARD_GAME_EVENT", (message) => window.__qaEvents.push(message));
    window.__qaSocket.on("BOARD_SOCKET_FENCED", (message) => window.__qaFences.push(message));
    window.__qaSocket.once("connect", resolve);
    window.__qaSocket.once("connect_error", (error) => reject(new Error(error?.message || "connect_error")));
  }), { profile, label });
  return { context, page, label };
}

async function messageCounts(page) {
  return page.evaluate(() => ({
    states: window.__qaStates.length,
    events: window.__qaEvents.length,
    fences: window.__qaFences.length,
  }));
}

async function waitForState(page, predicate, timeoutMs = 7000) {
  await page.waitForFunction(predicate, null, { timeout: timeoutMs });
  return page.evaluate(() => window.__qaStates.at(-1) || null);
}

async function waitForReason(page, reason) {
  await page.waitForFunction((expectedReason) => (
    window.__qaStates.some((message) => message?.reason === expectedReason)
  ), reason, { timeout: 7000 });
  return page.evaluate((expectedReason) => (
    window.__qaStates.find((message) => message?.reason === expectedReason) || null
  ), reason);
}

async function requestCurrentState(page, roomCode) {
  const before = await messageCounts(page);
  const ack = await emitAck(page, "BOARD_STATE_REQUEST", { roomCode, requesterClientId: "monotonicity-qa" });
  await page.waitForFunction((previousCount) => window.__qaStates.length > previousCount, before.states, { timeout: 7000 });
  const state = await page.evaluate(() => window.__qaStates.at(-1) || null);
  return { ack, state };
}

function makePayload(roomCode, lobby, marker, round = 1) {
  const cpu = lobby.players.find((player) => player.isCPU);
  return {
    gameState: {
      boardData: { id: "board-state-monotonicity-qa", roomCode },
      phase: "main",
      currentPlayerIndex: 0,
      round,
      marker,
      players: [
        {
          id: "monotonicity-human",
          ...hostProfile,
          isCpu: false,
          location: { kind: "route", routeId: "qa-route", tileIndex: 1 },
        },
        {
          id: "monotonicity-cpu",
          userId: cpu.userId,
          clientId: cpu.clientId,
          name: cpu.name,
          avatar: cpu.avatar,
          isCpu: true,
          isCPU: true,
          location: { kind: "route", routeId: "qa-route", tileIndex: 2 },
        },
      ],
      settings: { bgmVolume: 0.5 },
    },
    battleState: null,
  };
}

function pushFailure(failures, condition, message, detail) {
  if (condition) return;
  failures.push(detail === undefined ? message : `${message}: ${JSON.stringify(detail)}`);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const sockets = [];
  const failures = [];
  const report = {
    baseUrl,
    roomCode: `MONO${Date.now().toString(36).slice(-6).toUpperCase()}`,
    failures,
  };

  try {
    const oldHost = await makeSocketPage(browser, hostProfile, "old-host");
    sockets.push(oldHost);

    report.joinRoom = {
      host: await emitAck(oldHost.page, "BOARD_JOIN_ROOM", {
        create: true,
        roomCode: report.roomCode,
        profile: hostProfile,
      }),
    };

    report.addCpu = await emitAck(oldHost.page, "BOARD_ADD_CPU", {
      roomCode: report.roomCode,
      profile: hostProfile,
    });
    report.start = await emitAck(oldHost.page, "BOARD_START_GAME", {
      roomCode: report.roomCode,
      profile: hostProfile,
    });
    report.joinGame = await emitAck(oldHost.page, "BOARD_JOIN_GAME", {
      roomCode: report.roomCode,
      profile: hostProfile,
      knownVersion: 0,
      hasPendingState: false,
    });

    const mirror = await makeSocketPage(browser, hostProfile, "same-player-mirror");
    sockets.push(mirror);
    report.joinRoom.mirror = await emitAck(mirror.page, "BOARD_JOIN_ROOM", {
      roomCode: report.roomCode,
      profile: hostProfile,
      allowPlayingJoin: true,
    });

    pushFailure(failures, report.joinRoom.host?.ok, "host could not create room", report.joinRoom.host);
    pushFailure(failures, report.joinRoom.mirror?.ok, "same-player mirror could not join room", report.joinRoom.mirror);
    pushFailure(failures, report.addCpu?.ok, "host could not add CPU", report.addCpu);
    pushFailure(failures, report.start?.ok, "host could not start game", report.start);
    pushFailure(failures, report.joinGame?.ok, "host could not join game channel", report.joinGame);

    const lobby = report.addCpu?.lobby;
    const hasOneCpu = Array.isArray(lobby?.players) && lobby.players.filter((player) => player.isCPU).length === 1;
    const hasOneHuman = Array.isArray(report.joinRoom.mirror?.lobby?.players)
      && report.joinRoom.mirror.lobby.players.filter((player) => !player.isCPU).length === 1;
    pushFailure(failures, hasOneCpu, "test room did not contain exactly one CPU", lobby?.players);
    pushFailure(failures, hasOneHuman, "same-player mirror created a duplicate human slot", report.joinRoom.mirror?.lobby?.players);
    if (!hasOneCpu || !hasOneHuman) throw new Error("monotonicity room must contain one human and one CPU");

    const seedPayload = makePayload(report.roomCode, lobby, "seed-v1", 1);
    report.seedAck = await emitAck(oldHost.page, "BOARD_GAME_STATE", {
      roomCode: report.roomCode,
      sourceClientId: hostProfile.clientId,
      reason: "monotonicity-seed",
      baseVersion: 0,
      version: 1,
      payload: seedPayload,
    });
    report.seedBroadcast = await waitForReason(mirror.page, "monotonicity-seed");

    const freshPayload = makePayload(report.roomCode, lobby, "fresh-v2", 2);
    report.freshAck = await emitAck(oldHost.page, "BOARD_GAME_STATE", {
      roomCode: report.roomCode,
      sourceClientId: hostProfile.clientId,
      reason: "monotonicity-fresh",
      baseVersion: 1,
      version: 2,
      payload: freshPayload,
    });
    report.freshBroadcast = await waitForReason(mirror.page, "monotonicity-fresh");

    pushFailure(failures, report.seedAck?.ok && report.seedAck?.version === 1, "seed v1 was not accepted as version 1", report.seedAck);
    pushFailure(failures, report.freshAck?.ok && report.freshAck?.version === 2, "fresh v2 was not accepted as version 2", report.freshAck);
    pushFailure(failures, report.freshBroadcast?.payload?.gameState?.marker === "fresh-v2", "observer did not receive the fresh marker", report.freshBroadcast);

    const beforeStaleVersion = await messageCounts(mirror.page);
    const stalePayload = makePayload(report.roomCode, lobby, "stale-version-overwrite", 99);
    report.staleVersionAck = await emitAck(oldHost.page, "BOARD_GAME_STATE", {
      roomCode: report.roomCode,
      sourceClientId: hostProfile.clientId,
      reason: "monotonicity-stale-version",
      baseVersion: 0,
      version: 1,
      payload: stalePayload,
    });
    await mirror.page.waitForTimeout(300);
    const afterStaleVersion = await messageCounts(mirror.page);
    report.staleVersionBroadcastDelta = {
      states: afterStaleVersion.states - beforeStaleVersion.states,
      events: afterStaleVersion.events - beforeStaleVersion.events,
    };

    pushFailure(
      failures,
      report.staleVersionAck?.ok === false && ["stale_version", "stale_socket"].includes(report.staleVersionAck?.error),
      "stale version overwrite was not rejected",
      report.staleVersionAck,
    );
    pushFailure(failures, report.staleVersionAck?.version === 2, "stale rejection did not report current version 2", report.staleVersionAck);
    pushFailure(
      failures,
      report.staleVersionBroadcastDelta.states === 0 && report.staleVersionBroadcastDelta.events === 0,
      "stale version attempt was broadcast to observer",
      report.staleVersionBroadcastDelta,
    );

    report.afterStaleVersionRequest = await requestCurrentState(mirror.page, report.roomCode);
    pushFailure(
      failures,
      report.afterStaleVersionRequest.ack?.ok
        && report.afterStaleVersionRequest.ack?.version === 2
        && report.afterStaleVersionRequest.state?.version === 2
        && report.afterStaleVersionRequest.state?.payload?.gameState?.marker === "fresh-v2",
      "state request after stale write did not return fresh v2",
      report.afterStaleVersionRequest,
    );

    const newHost = await makeSocketPage(browser, hostProfile, "new-host");
    sockets.push(newHost);
    report.newHostJoin = await emitAck(newHost.page, "BOARD_JOIN_GAME", {
      roomCode: report.roomCode,
      profile: hostProfile,
      knownVersion: 2,
      hasPendingState: false,
    });
    await oldHost.page.waitForFunction(() => window.__qaFences.length > 0, null, { timeout: 7000 });
    await mirror.page.waitForFunction(() => window.__qaFences.length > 0, null, { timeout: 7000 });
    report.oldHostFence = await oldHost.page.evaluate(() => window.__qaFences.at(-1) || null);
    report.mirrorFence = await mirror.page.evaluate(() => window.__qaFences.at(-1) || null);
    await waitForState(newHost.page, () => window.__qaStates.some((message) => (
      message?.version === 2 && message?.payload?.gameState?.marker === "fresh-v2"
    )));
    report.newHostInitialState = await newHost.page.evaluate(() => window.__qaStates.at(-1) || null);

    pushFailure(failures, report.newHostJoin?.ok && report.newHostJoin?.version === 2, "replacement host socket could not join at version 2", report.newHostJoin);
    pushFailure(failures, report.oldHostFence?.reason === "newer_connection", "old host socket did not receive fencing notice", report.oldHostFence);
    pushFailure(failures, report.mirrorFence?.reason === "newer_connection", "same-player mirror did not receive fencing notice", report.mirrorFence);
    pushFailure(failures, report.newHostInitialState?.payload?.gameState?.marker === "fresh-v2", "replacement host did not receive fresh v2", report.newHostInitialState);

    const beforeFencedAttempts = await messageCounts(newHost.page);
    const fencedOverwritePayload = makePayload(report.roomCode, lobby, "stale-socket-overwrite", 100);
    report.fencedStateAck = await emitAck(oldHost.page, "BOARD_GAME_STATE", {
      roomCode: report.roomCode,
      sourceClientId: hostProfile.clientId,
      reason: "monotonicity-fenced-state",
      baseVersion: 2,
      version: 3,
      payload: fencedOverwritePayload,
    });
    report.fencedEventAck = await emitAck(oldHost.page, "BOARD_GAME_EVENT", {
      roomCode: report.roomCode,
      event: {
        id: `monotonicity-fenced-event-${Date.now()}`,
        channel: "turn-flow",
        type: "turn-handoff",
        payload: { marker: "stale-socket-event" },
      },
    });
    report.fencedRequestAck = await emitAck(oldHost.page, "BOARD_STATE_REQUEST", {
      roomCode: report.roomCode,
      requesterClientId: hostProfile.clientId,
    });
    await newHost.page.waitForTimeout(300);
    const afterFencedAttempts = await messageCounts(newHost.page);
    report.fencedBroadcastDelta = {
      states: afterFencedAttempts.states - beforeFencedAttempts.states,
      events: afterFencedAttempts.events - beforeFencedAttempts.events,
    };

    pushFailure(failures, report.fencedStateAck?.ok === false && report.fencedStateAck?.error === "stale_socket", "fenced STATE was not rejected as stale_socket", report.fencedStateAck);
    pushFailure(failures, report.fencedEventAck?.ok === false && report.fencedEventAck?.error === "stale_socket", "fenced EVENT was not rejected as stale_socket", report.fencedEventAck);
    pushFailure(failures, report.fencedRequestAck?.ok === false && report.fencedRequestAck?.error === "stale_socket", "fenced REQUEST was not rejected as stale_socket", report.fencedRequestAck);
    pushFailure(
      failures,
      report.fencedBroadcastDelta.states === 0 && report.fencedBroadcastDelta.events === 0,
      "fenced socket attempt reached observer",
      report.fencedBroadcastDelta,
    );

    report.finalStateRequest = await requestCurrentState(newHost.page, report.roomCode);
    pushFailure(
      failures,
      report.finalStateRequest.ack?.ok
        && report.finalStateRequest.ack?.version === 2
        && report.finalStateRequest.state?.version === 2
        && report.finalStateRequest.state?.payload?.gameState?.marker === "fresh-v2",
      "final state was not the unchanged fresh v2 marker",
      report.finalStateRequest,
    );

    report.result = failures.length ? "FAIL" : "PASS";
    console.log(JSON.stringify(report, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await Promise.allSettled(sockets.map(({ context }) => context.close()));
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
