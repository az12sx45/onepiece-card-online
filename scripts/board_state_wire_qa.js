"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const zlib = require("node:zlib");
const { performance } = require("node:perf_hooks");
const wire = require("../public/js/board_state_wire");
const receiverApi = require("../public/js/board_state_receiver");

let checks = 0;
let patchesChecked = 0;
function check(fn) { fn(); checks += 1; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function expectInvalid(base, patch) { check(() => assert.throws(() => wire.decode(base, patch))); }

let seed = 0x426f6172;
function random() {
  seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
  return (seed >>> 0) / 4294967296;
}
function int(max) { return Math.floor(random() * max); }
const alphabet = ["a", "0", "z", "\"", "\\", "\n", "\u0000", "\t", "航", "海", "錄", "🌊", "🧭", "é", "e\u0301", "\ud800", "\udfff"];
function randomText(length) {
  const parts = [];
  while (parts.length < length) parts.push(alphabet[int(alphabet.length)]);
  return parts.join("");
}
function roundTrip(base, next, mustPatch = false) {
  const patch = wire.encode(base, next);
  if (mustPatch) check(() => assert.ok(patch, "a similar large payload should use a patch"));
  if (!patch) return null;
  check(() => assert.equal(wire.decode(base, clone(patch)), next));
  check(() => assert.ok(Buffer.byteLength(JSON.stringify(patch)) <= Buffer.byteLength(next) * 0.8));
  patchesChecked += 1;
  return patch;
}

function testCodec() {
  check(() => assert.equal(wire.codec, "board-copy-v1"));
  check(() => assert.equal(wire.encode("", ""), null));
  check(() => assert.equal(wire.encode("hello", "hello!"), null));
  const sandbox = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/js/board_state_wire.js"), "utf8"), sandbox);
  check(() => assert.equal(sandbox.window.BoardStateWire.codec, wire.codec));
  const unicode = JSON.stringify({ name: "海賊🌊🧭e\u0301", lone: "\ud800\udfff\ud800", rows: Array.from({ length: 900 }, (_, i) => ({ id: i, message: randomText(9) })) });
  const patch = roundTrip(unicode, unicode.replace("海賊", "新世界海賊"), true);
  check(() => assert.equal(sandbox.window.BoardStateWire.decode(unicode, clone(patch)), unicode.replace("海賊", "新世界海賊")));
  roundTrip(unicode, unicode, true);
  // Raw UTF-16 strings also round-trip, including copies split at surrogates.
  const rawUnicode = randomText(6000);
  roundTrip(rawUnicode, rawUnicode.slice(0, 1025) + "\ud800\u0000🌊" + rawUnicode.slice(1044), true);
  const protoText = JSON.stringify({ gameState: JSON.parse('{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted":true}}}'), rows: unicode });
  const decodedProto = JSON.parse(wire.decode(protoText, roundTrip(protoText, protoText.replace("true", "false"), true)));
  check(() => assert.equal(Object.prototype.polluted, undefined));
  check(() => assert.equal(decodedProto.gameState.__proto__.polluted, false));

  for (let test = 0; test < 280; test += 1) {
    const base = randomText(700 + int(16000));
    let next = base;
    for (let mutation = 0; mutation < 1 + int(6); mutation += 1) {
      const at = int(next.length + 1);
      const count = int(Math.min(500, next.length - at) + 1);
      switch (int(5)) {
        case 0: next = next.slice(0, at) + randomText(int(220)) + next.slice(at); break;
        case 1: next = next.slice(0, at) + next.slice(at + count); break;
        case 2: next = next.slice(0, at) + randomText(int(220)) + next.slice(at + count); break;
        case 3: next = next.slice(at) + next.slice(0, at); break;
        default: next = next.slice(0, at) + next.slice(at, at + count).split("").reverse().join("") + next.slice(at + count);
      }
    }
    roundTrip(base, next);
  }
  const repeated = "🌊" + "abc123".repeat(140000);
  roundTrip(repeated, repeated.slice(321) + "界\udfff" + repeated.slice(0, 321), true);
  check(() => assert.equal(wire.encode("a".repeat(20000), "b".repeat(20000)), null));
  check(() => assert.throws(() => wire.encode(null, unicode)));
  check(() => assert.throws(() => wire.encode("", "a".repeat(wire.MAX_TEXT_SIZE + 1))));
  check(() => assert.throws(() => wire.encode("", "海".repeat(Math.floor(wire.MAX_TEXT_SIZE / 3) + 1))));

  const base = "0123456789abcdef".repeat(2000);
  const valid = wire.encode(base, base.slice(0, 4097) + "x🌊" + base.slice(4098));
  check(() => assert.ok(valid));
  for (const bad of [null, [], {}, { ...valid, length: -1 }, { ...valid, length: 1.5 },
    { ...valid, length: wire.MAX_TEXT_SIZE + 1 }, { ...valid, length: valid.length + 1 },
    { ...valid, checksum: "bad" }, { ...valid, checksum: "0".repeat(16) },
    { ...valid, chunks: {} }, { ...valid, chunks: new Array(wire.MAX_CHUNKS + 1).fill("") },
    ...[[0, -1], [-1, 256], [0, 1.5], [0, Infinity], [NaN, 3], [base.length, 1], [0, base.length + 1], [0], [0, 1, 2], {}, null]
      .map((chunk) => ({ ...valid, chunks: [chunk] }))]) expectInvalid(base, bad);
  expectInvalid(base, { ...valid, length: 1, chunks: [[0, base.length], [0, base.length]] });
  const copiedOffset = valid.chunks.find(Array.isArray)[0];
  const wrongBase = base.slice(0, copiedOffset) + "X" + base.slice(copiedOffset + 1);
  expectInvalid(wrongBase, valid);
}

function testReceiver() {
  const roomCode = "BQAWIRE";
  const firstPayload = { gameState: { round: 1, rows: Array.from({ length: 1200 }, (_, i) => `海賊 ${i}`) }, battleState: null };
  const secondPayload = clone(firstPayload); secondPayload.gameState.round = 2;
  const thirdPayload = clone(secondPayload); thirdPayload.gameState.round = 3;
  const packet = (payload, version) => ({ roomCode, payload, version, sourceClientId: "qa-other" });
  const delta = (basePayload, nextPayload, baseVersion, version) => ({
    roomCode, version, baseVersion, encoding: wire.codec,
    patch: wire.encode(JSON.stringify(basePayload), JSON.stringify(nextPayload)),
  });
  let requests = 0;
  const messages = [];
  const receiver = receiverApi.create({ roomCode, requestFull: () => { requests += 1; }, onMessage: (message) => {
    messages.push(clone(message));
    // Gameplay may normalize or mutate incoming objects; the wire baseline must
    // remain exactly the immutable JSON received before this callback.
    message.payload.gameState.round = 999;
  } });
  receiver.receive(packet(clone(firstPayload), 1));
  receiver.receive(delta(firstPayload, secondPayload, 1, 2));
  receiver.receive(delta(secondPayload, thirdPayload, 2, 3));
  check(() => assert.deepEqual(messages.map((message) => message.payload.gameState.round), [1, 2, 3]));
  check(() => assert.equal(requests, 0));
  receiver.receive({ ...delta(secondPayload, thirdPayload, 2, 3), roomCode: "OTHERROOM" });
  check(() => assert.equal(requests, 0));
  receiver.reset();
  receiver.receive(delta(firstPayload, secondPayload, 1, 2));
  receiver.receive(delta(firstPayload, secondPayload, 1, 2));
  check(() => assert.equal(requests, 1, "a missing baseline requests only one full snapshot"));
  check(() => assert.equal(receiver.status().recovering, true));
  receiver.receive(packet(clone(firstPayload), 1));
  receiver.receive(delta(firstPayload, secondPayload, 1, 2));
  check(() => assert.equal(messages.at(-1).payload.gameState.round, 2));
  check(() => assert.equal(receiver.status().recovering, false));
  receiver.receive(delta(firstPayload, secondPayload, 41, 42));
  check(() => assert.equal(requests, 2));
  receiver.receive(packet(clone(firstPayload), 7));
  const corrupt = delta(firstPayload, secondPayload, 7, 8);
  corrupt.patch.checksum = "0".repeat(16);
  receiver.receive(corrupt);
  check(() => assert.equal(requests, 3));
  receiver.receive(packet(clone(firstPayload), 9));
  receiver.receive({ ...delta(firstPayload, secondPayload, 9, 10), encoding: "unknown-codec" });
  check(() => assert.equal(requests, 4));
  receiver.receive(packet(clone(firstPayload), 11));
  receiver.receive(delta(firstPayload, secondPayload, 11, 12));
  check(() => assert.equal(messages.at(-1).payload.gameState.round, 2));
  receiver.reset();
  receiver.receive(packet(clone(firstPayload), 15));
  receiver.receive(packet(clone(secondPayload), 16));
  check(() => assert.equal(messages.at(-1).payload.gameState.round, 2, "old full-only servers stay compatible"));
  check(() => assert.equal(receiver.status().recovering, false));
}

function compressedBytes(packet) {
  const text = "42" + JSON.stringify(["BOARD_GAME_STATE", packet]);
  const compressed = zlib.deflateRawSync(text, {
    level: 6, memLevel: 7, flush: zlib.constants.Z_SYNC_FLUSH, finishFlush: zlib.constants.Z_SYNC_FLUSH,
  });
  // RFC 7692 removes the final 00 00 ff ff sync-flush marker. This estimates the
  // compressed WebSocket application payload, not TLS/TCP/network accounting.
  return { raw: Buffer.byteLength(text), compressed: compressed.length - 4 };
}
function summarize(rows) {
  const sum = (key) => rows.reduce((total, row) => total + row[key], 0);
  const oldCompressedBytes = sum("oldCompressed");
  const newCompressedBytes = sum("newCompressed");
  return {
    samples: rows.length, patchFrames: rows.filter((row) => row.patch).length,
    oldJsonBytes: sum("oldRaw"), newJsonBytes: sum("newRaw"),
    oldCompressedBytes, newCompressedBytes,
    compressedReductionPercent: oldCompressedBytes ? Number((100 * (1 - newCompressedBytes / oldCompressedBytes)).toFixed(2)) : null,
    largerCompressedFrames: rows.filter((row) => row.newCompressed > row.oldCompressed).length,
    largestCompressedIncreaseBytes: rows.length ? Math.max(0, ...rows.map((row) => row.newCompressed - row.oldCompressed)) : 0,
    encodeMillisecondsTotal: Number(sum("encodeMilliseconds").toFixed(2)),
    encodeMillisecondsMax: rows.length ? Number(Math.max(...rows.map((row) => row.encodeMilliseconds)).toFixed(2)) : 0,
    compressedBytesPerFrame: rows.length ? {
      oldMin: Math.min(...rows.map((row) => row.oldCompressed)), oldMax: Math.max(...rows.map((row) => row.oldCompressed)),
      newMin: Math.min(...rows.map((row) => row.newCompressed)), newMax: Math.max(...rows.map((row) => row.newCompressed)),
    } : null,
  };
}
function measurePair(basePayload, nextPayload) {
  const base = JSON.stringify(basePayload);
  const next = JSON.stringify(nextPayload);
  const start = performance.now();
  const patch = wire.encode(base, next);
  const elapsed = performance.now() - start;
  if (patch) check(() => assert.equal(wire.decode(base, patch), next));
  const meta = { roomCode: "BQAWIRE", version: 2, sourceClientId: "qa-source", reason: "qa-state-change" };
  const full = { ...meta, payload: nextPayload };
  const encoded = patch ? { ...meta, encoding: wire.codec, baseVersion: 1, patch } : full;
  const before = compressedBytes(full);
  const after = compressedBytes(encoded);
  return { patch: !!patch, oldRaw: before.raw, newRaw: after.raw, oldCompressed: before.compressed, newCompressed: after.compressed, encodeMilliseconds: elapsed };
}
function historicalMeasurements(directory) {
  if (!directory || !fs.existsSync(directory)) return { skipped: "No historical save directory was supplied or available." };
  const smallChange = [];
  const logShift = [];
  const unrelated = [];
  let previous = null;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    let payload;
    try {
      const stored = JSON.parse(fs.readFileSync(path.join(directory, entry.name), "utf8"));
      payload = stored.payload || stored;
    } catch (_) { continue; }
    if (!payload?.gameState?.boardData || payload.gameState.players?.length !== 4) continue;
    // Match the current createManualSavePayload before benchmarking historical
    // saves. Only this in-memory object is normalized; source files stay intact.
    payload.gameState.log = Array.isArray(payload.gameState.log) ? payload.gameState.log.slice(-500) : [];
    payload.boardUiEvent = null;
    const next = clone(payload);
    next.savedAt = "2026-09-10T00:00:00.000Z";
    next.gameState.round = Number(next.gameState.round || 0) + 1;
    next.gameState.currentPlayerIndex = (Number(next.gameState.currentPlayerIndex || 0) + 1) % 4;
    smallChange.push(measurePair(payload, next));
    const withLog = clone(payload);
    withLog.gameState.log = Array.from({ length: 500 }, (_, i) => `QA 歷史存檔模擬紀錄 ${i}：船員使用招式、獲得道具並繼續航行。`);
    const shifted = clone(withLog);
    shifted.gameState.log.shift();
    shifted.gameState.log.push("QA 新回合：玩家擲出 6 點，抵達下一個島嶼。");
    shifted.savedAt = next.savedAt;
    logShift.push(measurePair(withLog, shifted));
    if (previous) unrelated.push(measurePair(previous, payload));
    previous = payload;
  }
  return { source: "Read-only historical saves with four player records, normalized in memory to current createManualSavePayload: latest 500 game log records and boardUiEvent=null. All subsequent mutations are simulated; original saves are unchanged.", smallChange: summarize(smallChange), fixed500LogShift: summarize(logShift), unrelatedSaveChange: summarize(unrelated) };
}

testCodec();
testReceiver();
const synthetic = { version: 1, gameState: { round: 7, boardData: { routes: Array.from({ length: 1600 }, (_, i) => ({ id: `route-${i}`, name: `航道 ${i}`, nodes: [i, i + 1, i + 2] })) }, players: Array.from({ length: 4 }, (_, i) => ({ id: i, crew: Array.from({ length: 90 }, (_, j) => ({ id: `crew-${j}`, hp: 120, name: randomText(30) })) })), log: Array.from({ length: 500 }, (_, i) => `第 ${i} 筆航海紀錄：${randomText(70)}`) }, battleState: null };
const syntheticNext = clone(synthetic);
syntheticNext.gameState.log.shift(); syntheticNext.gameState.log.push("全新的航海紀錄🌊");
syntheticNext.gameState.players[2].crew[8].hp -= 15;
const syntheticMeasurement = summarize([measurePair(synthetic, syntheticNext)]);
const saveDirectory = process.argv.find((arg) => arg.startsWith("--samples="))?.slice("--samples=".length)
  || process.env.BOARD_WIRE_QA_SAVE_DIR || path.join(__dirname, "../server/data/board_saves");
const historical = historicalMeasurements(saveDirectory);
console.log(JSON.stringify({
  ok: true, checks, patchesChecked,
  measurementScope: "Codec round trips and simulated state changes only; not a live four-human game or Render billing measurement. WebSocket bytes estimate per-message-deflate application payloads with no context takeover; connection handshakes, initial full snapshots, HTTP, TCP and TLS overhead are excluded.",
  synthetic: syntheticMeasurement,
  historical,
}, null, 2));
