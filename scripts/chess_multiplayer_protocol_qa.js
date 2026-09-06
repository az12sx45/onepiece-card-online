"use strict";

// Local-only integration QA. The real shared server uses an in-memory DB stub;
// no production account, database, filesystem save, or remote service is used.
const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const http = require("http");
const { Chess } = require("chess.js");
let io;
try { ({ io } = require("socket.io-client")); }
catch (error) {
  if (error.code !== "MODULE_NOT_FOUND") throw error;
  // Socket.IO already distributes this client. Node 20 can use its ws
  // dependency; Node 22+ also provides the native WebSocket implementation.
  if (!global.WebSocket) global.WebSocket = require("ws");
  io = require(path.join(path.dirname(require.resolve("socket.io")), "../client-dist/socket.io.js"));
}

const profiles = new Map([
  ["qa-chess-host", { user_id:810001, name:"房主測試員", avatar:8 }],
  ["qa-chess-guest", { user_id:810002, name:"來賓測試員", avatar:9 }],
  ["qa-chess-spectator", { user_id:810003, name:"觀戰測試員", avatar:10 }],
  ["qa-chess-cpu", { user_id:810004, name:"CPU 測試員", avatar:11 }],
]);
for (const profile of profiles.values()) {
  profile.stats = { client:{ social:{ friends:[810001,810002,810003,810004], friend_in:[], friend_out:[] } } };
}
process.env.PORT = process.env.CHESS_MULTIPLAYER_QA_PORT || "0";
delete process.env.DATABASE_URL;
const dbPath = require.resolve("../server/db");
require.cache[dbPath] = { id:dbPath, filename:dbPath, loaded:true, exports:{ pool:{
  async query(sql, params = []) {
    const text = String(sql || "");
    if (/select\s+now\(\)\s+as\s+now/i.test(text)) return { rows:[{ now:new Date().toISOString() }], rowCount:1 };
    if (text.includes("FROM player_profiles WHERE secret=$1")) {
      const profile = profiles.get(String(params[0] || ""));
      return { rows:profile ? [structuredClone(profile)] : [], rowCount:profile ? 1 : 0 };
    }
    return { rows:[], rowCount:0 };
  },
} } };

let server;
const originalCreateServer = http.createServer;
http.createServer = function (...args) {
  server = originalCreateServer.apply(this, args);
  return server;
};
try { require("../server/index.js"); }
finally { http.createServer = originalCreateServer; }

let origin;
const sockets = [];
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const ack = (socket, eventName, payload) => new Promise((resolve) => {
  socket.timeout(6000).emit(eventName, payload, (error, result = {}) => {
    resolve(error ? { ok:false, error:"timeout" } : result);
  });
});
const waitEvent = (socket, eventName, predicate = () => true) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => { socket.off(eventName, handler); reject(new Error(`${eventName} timeout`)); }, 6000);
  function handler(message) {
    if (!predicate(message)) return;
    clearTimeout(timer);
    socket.off(eventName, handler);
    resolve(message);
  }
  socket.on(eventName, handler);
});
async function connect(secret, device) {
  const socket = io(origin, { transports:["websocket"], forceNew:true, reconnection:false });
  sockets.push(socket);
  await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
  if (secret) assert.strictEqual((await ack(socket, "SOCIAL_AUTH", { secret, deviceId:device })).ok, true);
  return socket;
}
function ok(result) { assert.strictEqual(result.ok, true, JSON.stringify(result)); return result; }
function rejected(result, error) { assert.strictEqual(result.ok, false, JSON.stringify(result)); assert.strictEqual(result.error, error); }

// Execute the shipped UI's actual stage functions, not a duplicate phase
// implementation. DOM rendering is stubbed; Socket.IO acknowledgements are real.
const uiSource = fs.readFileSync(path.join(__dirname, "../public/chess/pre-match-lobby.js"), "utf8");
function uiFunction(name) {
  const match = new RegExp(`\\n  (?:async )?function ${name}\\(`).exec(uiSource);
  assert.ok(match, `missing UI function ${name}`);
  const start = match.index + 1;
  const rest = uiSource.slice(start);
  const next = /\n  (?:async )?function /.exec(rest.slice(1));
  return next ? rest.slice(0, next.index + 1) : rest;
}
function makeUi(socket, userId) {
  const context = {
    state:{ lobby:null, role:"player", localPreview:false, preparationResetting:false },
    refs:{ waitingNext:{ disabled:false } },
    setupView:{ hidden:true }, waitingView:{ hidden:false, classList:{ toggle() {} } },
    lobby:{ dataset:{}, querySelector:() => null },
    setMessage() {}, renderSetup() {}, renderWaiting() {}, errorText:(value) => value,
    emitAck:(event, payload) => ack(socket, event, payload),
  };
  context.currentPlayer = () => context.state.lobby?.players.find((player) => player.userId === userId);
  context.isHost = () => context.state.lobby?.hostUserId === userId;
  vm.createContext(context);
  for (const name of ["allWaitingReady", "roomPhase", "showWaiting", "resetOwnReadyForPreparation", "advanceRoomSetup"]) {
    vm.runInContext(uiFunction(name), context);
  }
  return context;
}

async function main() {
  try {
    if (!server.listening) await new Promise((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
    origin = `http://127.0.0.1:${server.address().port}`;
    assert.strictEqual((await fetch(`${origin}/health`)).status, 200);
    const host = await connect("qa-chess-host", "qa-host");
    const guest = await connect("qa-chess-guest", "qa-guest");
    if (process.argv.includes("--fail-after-connect")) assert.fail("intentional_exit_code_probe");
    const anonymous = await connect();
    rejected(await ack(anonymous, "CHESS_JOIN_ROOM", { create:true, profile:{ userId:810001 } }), "auth_required");
    anonymous.disconnect();
    const created = ok(await ack(host, "CHESS_JOIN_ROOM", {
      create:true, profile:{ userId:1, name:"偽造名稱", clientId:"qa-host" },
      settings:{ visibility:"public", allowSpectators:true, phase:"preparation" },
    }));
    assert.strictEqual(created.lobby.players[0].name, "房主測試員");
    assert.strictEqual(created.lobby.players[0].userId, 810001);
    assert.strictEqual(created.lobby.settings.phase, "waiting");
    const roomCode = created.lobby.roomCode;
    assert.ok(ok(await ack(guest, "CHESS_ROOM_LIST", {})).rooms.some((room) => room.roomCode === roomCode));
    rejected(await ack(host, "CHESS_UPDATE_SETTINGS", { roomCode, settings:{ phase:"preparation" } }), "need_opponent");

    const invitedEvent = waitEvent(guest, "EMIT", (message) => message.type === "chess_lobby_invite");
    const invited = ok(await ack(host, "LOBBY_INVITE_SEND", { secret:"qa-chess-host", toUserId:810002, roomId:roomCode, mode:"chess" }));
    assert.strictEqual((await invitedEvent).invite.mode, "chess");
    const accepted = ok(await ack(guest, "LOBBY_INVITE_RESPOND", { secret:"qa-chess-guest", inviteId:invited.inviteId, action:"accept" }));
    assert.strictEqual(accepted.mode, "chess");
    const joined = ok(await ack(guest, "CHESS_JOIN_ROOM", { roomCode }));
    const hostColor = created.lobby.players[0].color;
    assert.strictEqual(joined.lobby.players[1].color, hostColor === "w" ? "b" : "w");
    rejected(await ack(guest, "CHESS_UPDATE_SETTINGS", { roomCode, settings:{ phase:"preparation" } }), "host_only");
    rejected(await ack(host, "CHESS_UPDATE_SETTINGS", { roomCode, settings:{ phase:"bogus" } }), "invalid_phase");
    rejected(await ack(host, "CHESS_UPDATE_SETTINGS", { roomCode, settings:{ phase:"preparation" } }), "not_all_ready");
    rejected(await ack(host, "CHESS_START_GAME", { roomCode }), "not_preparation");
    rejected(await ack(host, "CHESS_UPDATE_LOADOUT", { roomCode, factionId:"straw-hat-pirates" }), "not_preparation");
    ok(await ack(host, "CHESS_LOBBY_READY", { roomCode, ready:true }));
    const waitingReady = ok(await ack(guest, "CHESS_LOBBY_READY", { roomCode, ready:true }));
    const hostUi = makeUi(host, 810001), guestUi = makeUi(guest, 810002);
    hostUi.showWaiting(waitingReady.lobby);
    guestUi.showWaiting(waitingReady.lobby);
    assert.strictEqual(hostUi.lobby.dataset.stage, "matchmaking");
    const preparationEvent = waitEvent(guest, "CHESS_LOBBY", (message) => message.lobby?.settings?.phase === "preparation");
    await hostUi.advanceRoomSetup();
    const preparation = (await preparationEvent).lobby;
    guestUi.showWaiting(preparation);
    for (const ui of [hostUi, guestUi]) {
      assert.strictEqual(ui.lobby.dataset.stage, "preparation");
      assert.strictEqual(ui.setupView.hidden, false);
      assert.strictEqual(ui.waitingView.hidden, true);
      assert.ok(ui.state.lobby.players.every((player) => !player.ready));
    }
    rejected(await ack(host, "CHESS_START_GAME", { roomCode }), "not_all_ready");
    rejected(await ack(host, "CHESS_UPDATE_SETTINGS", { roomCode, settings:{ phase:"waiting" } }), "invalid_phase_transition");
    ok(await ack(host, "CHESS_UPDATE_LOADOUT", { roomCode, factionId:"straw-hat-pirates", battlefieldId:"onigashima" }));
    ok(await ack(guest, "CHESS_UPDATE_LOADOUT", { roomCode, factionId:"straw-hat-pirates", battlefieldId:"marineford" }));
    ok(await ack(guest, "CHESS_LOBBY_CHAT", { roomCode, text:"準備開局" }));
    const hostLocked = ok(await ack(host, "CHESS_LOBBY_READY", { roomCode, ready:true }));
    hostUi.showWaiting(hostLocked.lobby);
    await delay(100); // A UI regression must not send an automatic ready:false.
    const guestLocked = ok(await ack(guest, "CHESS_LOBBY_READY", { roomCode, ready:true }));
    guestUi.showWaiting(guestLocked.lobby);
    await delay(100);
    const preserved = ok(await ack(host, "CHESS_UPDATE_SETTINGS", { roomCode, settings:{ phase:"preparation", visibility:"public" } }));
    assert.ok(preserved.lobby.players.every((player) => player.ready), "loadout locks were reset by a UI snapshot");
    const navigation = waitEvent(guest, "CHESS_NAV_GAME", (message) => message.lobby?.roomCode === roomCode);
    const started = ok(await ack(host, "CHESS_START_GAME", { roomCode }));
    await navigation;
    assert.strictEqual(started.lobby.settings.battlefieldResolution, "random-two");
    assert.ok(["onigashima", "marineford"].includes(started.lobby.settings.battlefieldId));
    assert.ok(started.lobby.players.every((player) => player.factionId === "straw-hat-pirates"));
    rejected(await ack(host, "CHESS_GAME_OVER", { roomCode, fen:"forged_terminal_position" }), "not_game_over");
    const spectator = await connect("qa-chess-spectator", "qa-spectator");
    const watched = ok(await ack(spectator, "CHESS_JOIN_GAME", { roomCode, role:"spectator" }));
    assert.strictEqual(watched.lobby.spectatorCount, 1);
    rejected(await ack(spectator, "CHESS_MOVE", { roomCode }), "not_player");
    const white = hostColor === "w" ? host : guest;
    const black = hostColor === "w" ? guest : host;
    const move = { roomCode, beforeFen:started.lobby.game.fen,
      afterFen:"rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1",
      moveSequence:0, move:{ from:"e2", to:"e4", san:"e4" } };
    rejected(await ack(black, "CHESS_MOVE", move), "not_your_turn");
    rejected(await ack(white, "CHESS_MOVE", { ...move, move:{ from:"e2", to:"e5" } }), "illegal_move");
    const committedEvent = waitEvent(spectator, "CHESS_MOVE_COMMITTED", (message) => message.game?.moveSequence === 1);
    const moved = ok(await ack(white, "CHESS_MOVE", { ...move, afterFen:"untrusted_fen", move:{ ...move.move, san:"forged", captured:true } }));
    assert.strictEqual(moved.game.fen, move.afterFen);
    assert.strictEqual(moved.game.lastMove.san, "e4");
    assert.strictEqual(moved.game.lastMove.captured, false);
    assert.strictEqual((await committedEvent).game.fen, moved.game.fen);
    rejected(await ack(white, "CHESS_MOVE", move), "stale_state");
    guest.disconnect();
    await delay(100);
    const restoredGuest = await connect("qa-chess-guest", "qa-guest");
    const restored = ok(await ack(restoredGuest, "CHESS_JOIN_GAME", { roomCode }));
    assert.strictEqual(restored.lobby.game.fen, moved.game.fen);
    assert.strictEqual(restored.lobby.game.moveSequence, 1);
    const mirror = new Chess(); mirror.move("e4");
    let sequence = 1;
    let terminal;
    for (const san of ["e5", "Qh5", "Nc6", "Bc4", "Nf6", "Qxf7#"]) {
      const beforeFen = mirror.fen(), color = mirror.turn();
      const nextMove = mirror.move(san);
      const actor = color === hostColor ? host : restoredGuest;
      terminal = ok(await ack(actor, "CHESS_MOVE", { roomCode, beforeFen, moveSequence:sequence,
        afterFen:"ignored", move:{ from:nextMove.from, to:nextMove.to } }));
      sequence += 1;
      assert.strictEqual(terminal.game.fen, mirror.fen());
    }
    assert.strictEqual(terminal.game.gameOver, true);
    assert.strictEqual(ok(await ack(host, "CHESS_JOIN_GAME", { roomCode })).lobby.status, "ended");
    ok(await ack(host, "CHESS_GAME_OVER", { roomCode }));
    rejected(await ack(host, "CHESS_MOVE", { roomCode }), "not_playing");

    const cpuHost = await connect("qa-chess-cpu", "qa-cpu");
    const cpuRoom = ok(await ack(cpuHost, "CHESS_JOIN_ROOM", { create:true, settings:{ visibility:"private" } }));
    const cpuCode = cpuRoom.lobby.roomCode;
    const cpuAdded = ok(await ack(cpuHost, "CHESS_ADD_CPU", { roomCode:cpuCode, difficulty:"easy" }));
    assert.strictEqual(cpuAdded.lobby.players[1].isCPU, true);
    assert.strictEqual(cpuAdded.lobby.players[1].ready, true);
    assert.ok(!ok(await ack(host, "CHESS_ROOM_LIST", {})).rooms.some((room) => room.roomCode === cpuCode));
    ok(await ack(cpuHost, "CHESS_LOBBY_READY", { roomCode:cpuCode, ready:true }));
    const cpuPrep = ok(await ack(cpuHost, "CHESS_UPDATE_SETTINGS", { roomCode:cpuCode, settings:{ phase:"preparation" } }));
    assert.strictEqual(cpuPrep.lobby.players[0].ready, false);
    assert.strictEqual(cpuPrep.lobby.players[1].ready, true);
    const cpuRemoved = ok(await ack(cpuHost, "CHESS_REMOVE_CPU", { roomCode:cpuCode }));
    assert.strictEqual(cpuRemoved.lobby.settings.phase, "waiting");
    assert.strictEqual(cpuRemoved.lobby.players.length, 1);
    ok(await ack(cpuHost, "CHESS_ADD_CPU", { roomCode:cpuCode, difficulty:"easy" }));
    ok(await ack(cpuHost, "CHESS_LOBBY_READY", { roomCode:cpuCode, ready:true }));
    ok(await ack(cpuHost, "CHESS_UPDATE_SETTINGS", { roomCode:cpuCode, settings:{ phase:"preparation" } }));
    ok(await ack(cpuHost, "CHESS_LOBBY_READY", { roomCode:cpuCode, ready:true }));
    const cpuStart = ok(await ack(cpuHost, "CHESS_START_GAME", { roomCode:cpuCode }));
    const cpuHostColor = cpuStart.lobby.players.find((player) => !player.isCPU).color;
    const repeated = new Chess();
    let draw;
    for (const [index, san] of ["Nf3", "Nf6", "Ng1", "Ng8", "Nf3", "Nf6", "Ng1", "Ng8"].entries()) {
      const beforeFen = repeated.fen(), cpu = repeated.turn() !== cpuHostColor;
      const nextMove = repeated.move(san);
      const request = { roomCode:cpuCode, beforeFen, moveSequence:index, cpu, move:{ from:nextMove.from, to:nextMove.to } };
      if (cpu) rejected(await ack(cpuHost, "CHESS_MOVE", { ...request, cpu:false }), "not_your_turn");
      draw = ok(await ack(cpuHost, "CHESS_MOVE", request));
    }
    assert.strictEqual(draw.game.gameOver, true, "server must retain threefold repetition history");
    ok(await ack(cpuHost, "CHESS_GAME_OVER", { roomCode:cpuCode }));
    ok(await ack(cpuHost, "CHESS_LEAVE_ROOM", { roomCode:cpuCode }));
    // Existing game-family handlers remain reachable in the same server.
    assert.strictEqual((await ack(host, "BOARD_ROOM_LIST", {})).ok, true);
    console.log(JSON.stringify({ ok:true, authenticatedProfiles:true, chessFriendInvite:true,
      uiSource:"public/chess/pre-match-lobby.js", twoStageUi:true, locksSurviveSnapshots:true,
      phaseGuards:true, sameFaction:true, battlefieldResolution:true, spectator:true,
      synchronizedMoveSequence:1, reconnectSnapshot:true, cpuPreparation:true, boardRoomList:true,
      authoritativeMoves:true, illegalMoveRejected:true, forgedGameOverRejected:true,
      untrustedFenIgnored:true, checkmate:true, threefoldRepetition:true, cpuTurnAuthority:true }, null, 2));
    console.log("CHESS_MULTIPLAYER_PROTOCOL_QA=PASS");
  } finally {
    sockets.forEach((socket) => socket.disconnect());
    await delay(50);
    if (server?.listening) await new Promise((resolve) => server.close(resolve));
  }
}

// Deliberately outside finally: failed assertions must reach the failure exit.
main().then(() => process.exit(0), (error) => { console.error(error); process.exit(1); });
