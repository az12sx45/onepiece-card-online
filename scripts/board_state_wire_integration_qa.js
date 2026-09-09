"use strict";

// Local, in-memory rooms only. This test never calls account or save endpoints.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const path = require("node:path");
const zlib = require("node:zlib");

global.WebSocket = require("ws");
const { io } = require(path.join(path.dirname(require.resolve("socket.io")), "../client-dist/socket.io.js"));
const wire = require("../public/js/board_state_wire.js");
const receiver = require("../public/js/board_state_receiver.js");
const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18888";
const target = new URL(ROOT_URL);
assert(["127.0.0.1", "localhost", "[::1]"].includes(target.hostname), "QA must target a loopback server");
assert.equal(wire.codec, "board-copy-v1");

const clients = [];
const received = [];
const checks = [];
const clone = (value) => JSON.parse(JSON.stringify(value));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const timeoutMs = 10000;
let roomCode = "";
let currentVersion = 0;
let currentPayload = null;

function checked(name) {
  checks.push(name);
}

async function until(predicate, label) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const fatal = clients.find((client) => client.fatal)?.fatal;
    if (fatal) throw fatal;
    if (predicate()) return;
    await sleep(10);
  }
  throw new Error(`Timed out: ${label}`);
}

function ack(client, event, payload = {}) {
  return new Promise((resolve, reject) => {
    client.socket.timeout(timeoutMs).emit(event, payload, (error, result) => {
      if (error) reject(new Error(`${client.label} ${event}: ${error.message}`));
      else resolve(result);
    });
  });
}

async function ok(client, event, payload = {}) {
  const result = await ack(client, event, payload);
  assert.equal(result?.ok, true, `${client.label} ${event}: ${JSON.stringify(result)}`);
  return result;
}

function acceptState(client, message, payload) {
  try {
    if (Object.hasOwn(message, "payload")) {
      client.fullCount += 1;
    } else {
      assert.equal(message.encoding, wire.codec, "Unexpected state encoding");
      client.deltaCount += 1;
    }
    client.baseVersion = message.version;
    client.payload = payload;
    const record = { client: client.label, modern: client.modern, message, payload: clone(payload) };
    client.states.push(record);
    received.push(record);
  } catch (error) {
    client.fatal = error;
  }
}

async function connectClient(index, modern = true, profile = null) {
  const client = {
    label: `${modern ? "modern" : "legacy"}-${index}`,
    modern,
    profile: profile || {
      userId: 970100 + index,
      clientId: `wire-qa-${runId}-${index}`,
      name: `Wire QA ${index}`,
      avatar: 1,
    },
    states: [],
    fullCount: 0,
    deltaCount: 0,
    rejectedDeltas: 0,
    baseVersion: -1,
    payload: null,
    navCount: 0,
    fatal: null,
  };
  client.socket = io(ROOT_URL, { transports: ["websocket"], reconnection: false, forceNew: true, autoConnect: false });
  client.socket.on("BOARD_GAME_STATE", (message) => {
    if (client.modern) {
      client.incoming = message;
      if (client.tamperNextDelta && message.encoding) {
        client.incoming = clone(message);
        if (client.tamperNextDelta === "version") client.incoming.baseVersion = -1;
        if (client.tamperNextDelta === "checksum") client.incoming.patch.checksum = "0000000000000000";
        client.tamperNextDelta = "";
      }
      client.receiver.receive(client.incoming);
    } else {
      if (!Object.hasOwn(message, "payload")) {
        client.fatal = new Error("Legacy client received a delta");
        return;
      }
      acceptState(client, message, message.payload);
    }
  });
  client.socket.on("BOARD_NAV_GAME", () => { client.navCount += 1; });
  clients.push(client);
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Connect timeout: ${client.label}`)), timeoutMs);
    client.socket.once("connect", () => { clearTimeout(timer); resolve(); });
    client.socket.once("connect_error", (error) => { clearTimeout(timer); reject(error); });
    client.socket.connect();
  });
  return client;
}

async function joinGame(client, modern = client.modern) {
  const payload = { roomCode, profile: client.profile, knownVersion: Math.max(0, client.baseVersion) };
  if (modern) payload.stateEncoding = wire.codec;
  client.modern = modern;
  client.receiver = receiver.create({
    roomCode,
    onMessage(message) { acceptState(client, client.incoming, message.payload); },
    requestFull() {
      if (!client.expectRecovery) {
        client.fatal = new Error(`${client.label} unexpectedly requested baseline recovery`);
        return;
      }
      client.expectRecovery = false;
      client.rejectedDeltas += 1;
      client.recovery = ok(client, "BOARD_STATE_REQUEST", { roomCode }).catch((failure) => { client.fatal = failure; });
    },
  });
  return ok(client, "BOARD_JOIN_GAME", payload);
}

function makePayload(players) {
  // Deterministic varied data models an unchanged board database. These are QA
  // fixtures, not real save files or an estimate of human gameplay frequency.
  const islands = Array.from({ length: 1600 }, (_, index) => ({
    id: `qa-island-${index}`,
    name: `測試島嶼 ${index} 🏴‍☠️`,
    description: crypto.createHash("sha256").update(`island-${index}`).digest("hex"),
    image: `images/qa-${index}.webp`,
    enemyProfile: { id: `enemy-${index}`, hp: 150 + index, attack: 20 + index % 31 },
  }));
  return {
    schemaVersion: 1,
    roomCode,
    savedAt: "2026-09-10T00:00:00.000Z",
    gameState: {
      phase: "main",
      currentPlayerIndex: 0,
      round: 1,
      turnStep: "擲骰前進",
      boardData: { islands, routes: [] },
      players: players.map((client, index) => ({
        id: `qa-player-${index}`,
        ...client.profile,
        isCPU: false,
        gold: 1000,
        crew: [],
        location: { kind: "island", islandId: "qa-island-0" },
      })),
      settings: { musicEnabled: true, soundEnabled: true },
      log: ["本機傳輸回歸測試"],
      pendingMove: null,
      activeTrade: null,
      activeSpar: null,
    },
    battleState: null,
    boardUiEvent: null,
  };
}

async function publish(sender, activeClients, edit, options = {}) {
  const next = clone(currentPayload);
  edit(next);
  next.savedAt = new Date(Date.UTC(2026, 8, 10, 0, 0, currentVersion + 1)).toISOString();
  const expected = options.expected ? options.expected(clone(next)) : next;
  const version = currentVersion + 1;
  const result = await ok(sender, "BOARD_GAME_STATE", {
    roomCode,
    payload: next,
    version,
    baseVersion: currentVersion,
    reason: `qa-wire-step-${version}`,
  });
  assert.equal(result.version, version);
  currentVersion = version;
  currentPayload = expected;
  for (const client of activeClients.filter((entry) => entry !== sender)) {
    await until(() => client.states.some((entry) => entry.message.version === version), `${client.label} version ${version}`);
    assert.deepEqual(client.payload, expected, `${client.label} exact authoritative payload at ${version}`);
  }
  return version;
}

async function fullRequest(client) {
  const before = client.states.length;
  await ok(client, "BOARD_STATE_REQUEST", { roomCode });
  await until(() => client.states.length > before, `${client.label} full recovery snapshot`);
  const latest = client.states.at(-1);
  assert(Object.hasOwn(latest.message, "payload"), "STATE_REQUEST must always send full state");
  assert.equal(latest.message.version, currentVersion);
  assert.deepEqual(latest.payload, currentPayload);
}

function wireBytes(message) {
  const packet = `42${JSON.stringify(["BOARD_GAME_STATE", message])}`;
  return {
    raw: Buffer.byteLength(packet, "utf8"),
    deflated: zlib.deflateRawSync(Buffer.from(packet), { level: 6, memLevel: 7 }).length,
  };
}

function measurements(entries = received) {
  const records = entries.filter((entry) => /^qa-wire-step-/.test(entry.message.reason || ""));
  const totals = { updatesDelivered: records.length, deltaMessages: 0, fullMessages: 0, actualRawBytes: 0, fullRawBytes: 0, actualDeflatedBytes: 0, fullDeflatedBytes: 0 };
  for (const entry of records) {
    const message = entry.message;
    const full = { roomCode: message.roomCode, payload: entry.payload, version: message.version, sourceClientId: message.sourceClientId, reason: message.reason };
    const actual = wireBytes(message);
    const baseline = wireBytes(full);
    totals[Object.hasOwn(message, "payload") ? "fullMessages" : "deltaMessages"] += 1;
    totals.actualRawBytes += actual.raw;
    totals.fullRawBytes += baseline.raw;
    totals.actualDeflatedBytes += actual.deflated;
    totals.fullDeflatedBytes += baseline.deflated;
  }
  totals.deflatedReductionPercent = Number((100 * (1 - totals.actualDeflatedBytes / totals.fullDeflatedBytes)).toFixed(2));
  return totals;
}

const runId = `${Date.now().toString(36)}-${crypto.randomBytes(3).toString("hex")}`;

async function main() {
  const active = await Promise.all([connectClient(0), connectClient(1), connectClient(2), connectClient(3, false)]);
  const [host, player, observer, legacy] = active;
  const created = await ok(host, "BOARD_JOIN_ROOM", { create: true, profile: host.profile });
  roomCode = created.lobby.roomCode;
  for (const client of active.slice(1)) await ok(client, "BOARD_JOIN_ROOM", { roomCode, profile: client.profile });
  for (const client of active) await ok(client, "BOARD_LOBBY_READY", { roomCode, ready: true, profile: client.profile });
  await ok(host, "BOARD_START_GAME", { roomCode, profile: host.profile });
  await until(() => active.every((client) => client.navCount === 1), "four-player start notification");
  for (const client of active) await joinGame(client);
  checked("Four real Socket.IO players create, join, ready and start a local room");

  currentPayload = makePayload(active);
  await publish(host, active, () => {});
  assert(active.slice(1).every((client) => client.fullCount === 1 && client.deltaCount === 0));
  checked("First snapshot is full for modern and legacy recipients");

  await publish(host, active, (payload) => {
    payload.gameState.players[0].gold += 50;
    payload.gameState.log.push("第一個更新：金幣增加，保留 Unicode 🏴‍☠️");
  });
  assert.equal(player.states.at(-1).message.encoding, wire.codec);
  assert.equal(observer.states.at(-1).message.encoding, wire.codec);
  assert(Object.hasOwn(legacy.states.at(-1).message, "payload"));
  checked("Small updates use exact decoded deltas; a legacy recipient still receives full state");

  await publish(host, active, (payload) => {
    payload.gameState.currentPlayerIndex = 1;
    payload.gameState.log.push("交棒給第二位玩家");
  });
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 75; });
  assert(Object.hasOwn(host.states[0].message, "payload"), "Original publisher has no receive baseline until its first full message");
  checked("Control handoff accepts the new actor and bootstraps the old publisher with full state");

  const beforeRejections = received.length;
  const stale = await ack(player, "BOARD_GAME_STATE", { roomCode, payload: currentPayload, version: currentVersion, baseVersion: currentVersion - 1, reason: "qa-stale" });
  assert.equal(stale.error, "stale_version");
  const unauthorized = await ack(host, "BOARD_GAME_STATE", { roomCode, payload: currentPayload, version: currentVersion + 1, baseVersion: currentVersion, reason: "qa-unauthorized" });
  assert.equal(unauthorized.error, "not_your_turn");
  const invalid = await ack(player, "BOARD_GAME_STATE", { roomCode, payload: {}, version: currentVersion + 1, baseVersion: currentVersion, reason: "qa-invalid" });
  assert.equal(invalid.error, "invalid_payload");
  await sleep(50);
  assert.equal(received.length, beforeRejections, "Rejected publications must not advance or broadcast state");
  checked("Stale versions, unauthorized publishers and invalid payloads remain rejected");

  const settings = clone(currentPayload.gameState.settings);
  await publish(player, active, (payload) => { payload.gameState.settings.musicEnabled = false; }, {
    expected(payload) { payload.gameState.settings = clone(settings); return payload; },
  });
  checked("Deltas contain the server-preserved settings, not the unaccepted publisher variant");

  observer.expectRecovery = true;
  observer.tamperNextDelta = "version";
  const priorObserverStates = observer.states.length;
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 1; });
  await observer.recovery;
  assert.equal(observer.rejectedDeltas, 1);
  assert.equal(observer.states.length, priorObserverStates + 1, "Rejected delta must not be applied before full recovery");
  assert(Object.hasOwn(observer.states.at(-1).message, "payload"));
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 1; });
  assert.equal(observer.states.at(-1).message.encoding, wire.codec);
  checked("A missing baseline rejects the delta, requests full recovery and resumes later deltas");

  observer.expectRecovery = true;
  observer.tamperNextDelta = "checksum";
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 1; });
  await observer.recovery;
  assert.equal(observer.rejectedDeltas, 2);
  assert(Object.hasOwn(observer.states.at(-1).message, "payload"));
  observer.payload.gameState.players[1].gold = -999;
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 1; });
  assert.equal(observer.states.at(-1).message.encoding, wire.codec);
  assert.equal(observer.receiver.status().recovering, false);
  checked("The production receiver rejects corrupt patches and its immutable baseline survives gameplay object mutation");

  await fullRequest(observer);
  checked("Explicit STATE_REQUEST sends a full snapshot even when a delta baseline exists");

  observer.socket.disconnect();
  const reconnected = await connectClient(2, true, observer.profile);
  active[2] = reconnected;
  await joinGame(reconnected);
  await until(() => reconnected.states.length === 1, "reconnect full state");
  assert(Object.hasOwn(reconnected.states[0].message, "payload"));
  assert.deepEqual(reconnected.payload, currentPayload);
  await publish(player, active, (payload) => { payload.gameState.round += 1; });
  assert.equal(reconnected.states.at(-1).message.encoding, wire.codec);
  checked("A new socket reconnects from a full snapshot and resumes delta updates");

  const beforeOptOut = reconnected.states.length;
  await joinGame(reconnected, false);
  await until(() => reconnected.states.length > beforeOptOut, "opt-out full state");
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 1; });
  assert(Object.hasOwn(reconnected.states.at(-1).message, "payload"));
  const beforeOptIn = reconnected.states.length;
  await joinGame(reconnected, true);
  await until(() => reconnected.states.length > beforeOptIn, "renewed opt-in full state");
  await publish(player, active, (payload) => { payload.gameState.players[1].gold += 1; });
  assert.equal(reconnected.states.at(-1).message.encoding, wire.codec);
  assert.equal(legacy.deltaCount, 0);
  checked("Capability negotiation resets on each JOIN_GAME and never sends deltas to legacy clients");

  const countBeforeForeignRoom = reconnected.states.length;
  const statusBeforeForeignRoom = reconnected.receiver.status();
  reconnected.receiver.receive({ roomCode: `${roomCode}-old`, payload: currentPayload, version: currentVersion + 100 });
  assert.equal(reconnected.states.length, countBeforeForeignRoom);
  assert.deepEqual(reconnected.receiver.status(), statusBeforeForeignRoom);
  checked("A delayed snapshot from another room is ignored without changing the receiver baseline");

  const beforeLegacyUpgrade = legacy.states.length;
  await joinGame(legacy, true);
  await until(() => legacy.states.length > beforeLegacyUpgrade, "fourth player upgrade full state");
  const fourModernStart = received.length;
  for (let step = 0; step < 5; step += 1) {
    await publish(player, active, (payload) => {
      payload.gameState.players[1].gold += 10;
      payload.gameState.players[1].location = { kind: "route", routeId: "qa-route", tileIndex: step };
      payload.gameState.log.push(`四位新版玩家測試第 ${step + 1} 步`);
    });
  }
  const fourModernMeasurements = measurements(received.slice(fourModernStart));
  assert.equal(fourModernMeasurements.deltaMessages, 15);
  assert.equal(fourModernMeasurements.fullMessages, 0);
  checked("After all four players opt in, each of three recipients receives exact deltas across five further updates");

  const metrics = measurements();
  assert(metrics.deltaMessages > 0 && metrics.actualDeflatedBytes < metrics.fullDeflatedBytes);
  console.log(JSON.stringify({ ok: true, checks, finalVersion: currentVersion, measurements: metrics, fourModernSteadyState: fourModernMeasurements, measurementScope: "Deterministic local fixtures with mixed-client compatibility and recovery checks, then five four-modern-player updates; per-message deflate model, not Render billing or observed human gameplay." }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  for (const client of clients) client.socket.disconnect();
});
