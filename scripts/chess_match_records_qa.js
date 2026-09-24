"use strict";

const assert = require("node:assert/strict");
const { Chess } = require("chess.js");
const {
  completedChessMatch,
  recordCompletedChessMatch,
  sanitizeChessStatsPatch,
} = require("../server/chess-match-records");

function room(chess, seats) {
  return {
    matchId:"5a85f71b-8d5b-4d1b-958b-a49a4278a941",
    roomCode:"C10001",
    status:"ended",
    chess,
    moveSequence:chess.history().length,
    updatedAt:1780000000000,
    matchParticipants:seats,
  };
}

async function main() {
  const seats = [
    { color:"w", userId:810001, isCPU:false },
    { color:"b", userId:810002, isCPU:false },
  ];
  assert.equal(completedChessMatch(room(new Chess(), seats)), null, "an abandoned room has no result");

  const mate = new Chess();
  for (const move of ["f3", "e5", "g4", "Qh4#"]) mate.move(move);
  assert.equal(mate.isCheckmate(), true);
  const blackWin = completedChessMatch(room(mate, seats));
  assert.equal(blackWin.result, "black", "the side to move at checkmate loses");
  assert.equal(blackWin.whiteUserId, 810001);
  assert.equal(blackWin.blackUserId, 810002);

  const cpuWin = completedChessMatch(room(mate, [seats[0], { color:"b", isCPU:true }]));
  assert.equal(cpuWin.result, "black");
  assert.equal(cpuWin.blackUserId, null, "CPU has no profile counter");
  assert.equal(completedChessMatch(room(mate, [seats[0], { color:"b", userId:810001, isCPU:false }])), null,
    "one account cannot occupy both scored seats");
  assert.equal(completedChessMatch(room(mate, [seats[0], { color:"b", isCPU:false }])), null,
    "unverified human seat is not scored");

  const draw = new Chess();
  for (let n = 0; n < 2; n += 1) for (const move of ["Nf3", "Nf6", "Ng1", "Ng8"]) draw.move(move);
  assert.equal(draw.isThreefoldRepetition(), true);
  assert.equal(completedChessMatch(room(draw, seats)).result, "draw");

  assert.deepEqual(sanitizeChessStatsPatch({ launcherChessV1:{ games:999 }, client:{ totals:{ games:2 } } }),
    { client:{ totals:{ games:2 } } }, "client cannot submit chess counters");
  assert.deepEqual(sanitizeChessStatsPatch([]), {}, "malformed stats cannot replace the root object");

  const ids = new Set();
  const calls = [];
  const fakePool = { async query(sql, params) {
    calls.push({ sql, params });
    if (!params) return { rows:[], rowCount:0 };
    const first = !ids.has(params[0]);
    ids.add(params[0]);
    return { rows:[{ recorded:first ? 1 : 0, updated:first ? 2 : 0 }] };
  } };
  const first = await recordCompletedChessMatch(fakePool, blackWin);
  const duplicate = await recordCompletedChessMatch(fakePool, blackWin);
  assert.deepEqual([first.recorded, duplicate.recorded], [true, false], "repeated terminal report is idempotent");
  assert.equal(calls.filter((call) => call.params).length, 2);
  console.log(JSON.stringify({ ok:true, checks:["abandonment", "server checkmate", "CPU seat", "draw", "identity", "reserved stats", "duplicate ledger"] }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
