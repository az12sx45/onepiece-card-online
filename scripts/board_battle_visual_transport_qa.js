"use strict";

const assert = require("node:assert/strict");
const { splitBattleVisualEvent, createBattleVisualReceiver, createBattleVisualIngress } = require("../public/js/board_remote_playback");
const FRAME_LIMIT = 64 * 1024;
const VISUAL_LIMIT = 30 * 1024 * 1024;
let checks = 0;
function check(description, actual, expected) { assert.deepEqual(actual, expected, description); checks += 1; }
function visual(id, log = "") {
  return { id, channel: "battle", type: "visual", view: { player: { name: "索隆" }, battle: { canControl: false, visualEvent: { id, type: "attack" }, log } } };
}
function clockReceiver() {
  let clock = 0;
  let serial = 0;
  const timers = new Map();
  const receiver = createBattleVisualReceiver({
    now: () => clock,
    setTimer(fn, ms) { const id = ++serial; timers.set(id, { fn, at: clock + ms }); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  return {
    receiver, timers,
    advance(ms) {
      const end = clock + ms;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        clock = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      clock = end;
    },
  };
}
const unicode = visual("battle-劍士-🗡️", "索隆使用三刀流！ナミの雷⚡🌊".repeat(3500));
const parts = splitBattleVisualEvent(unicode);
check("multilingual fixture exceeds legacy event limit", Buffer.byteLength(JSON.stringify(unicode)) > FRAME_LIMIT, true);
check("large view splits into more than one frame", parts.length > 1, true);
check("every encoded frame remains within existing64KiB protocol limit", parts.every((part) => Buffer.byteLength(JSON.stringify(part)) <= FRAME_LIMIT), true);
check("every frame uses existing battle event channel", parts.every((part, index) => part.channel === "battle" && part.type === "visual-part" && part.index === index && part.total === parts.length), true);
{
  const { receiver } = clockReceiver();
  const result = parts.map((part) => receiver.receive(part, "source-a")).filter(Boolean);
  check("large UTF8 view roundtrips exactly", result, [unicode]);
  check("completed assembly releases all byte buffers", receiver.status().bufferedBytes, 0);
  check("completed duplicate frames do not redeliver", parts.map((part) => receiver.receive(part, "source-a")).filter(Boolean), []);
}
{
  const { receiver } = clockReceiver();
  const small = visual("small", "短句");
  check("small event keeps singleton transport", splitBattleVisualEvent(small), [small]);
  check("small raw visual passes through", receiver.receive(small, "source-a"), small);
  check("duplicate raw visual is deduplicated", receiver.receive(small, "source-a"), null);
  check("same visual from separate source is isolated", receiver.receive(small, "source-b"), small);
}
{
  const { receiver } = clockReceiver();
  const reversed = parts.slice().reverse();
  check("first out of order frame waits", receiver.receive(reversed[0], "source-a"), null);
  check("identical in-progress duplicate waits", receiver.receive(reversed[0], "source-a"), null);
  const result = reversed.slice(1).map((part) => receiver.receive(part, "source-a")).filter(Boolean);
  check("out of order frames reassemble in original byte order", result, [unicode]);
}
{
  const { receiver } = clockReceiver();
  receiver.receive(parts[0], "source-a");
  const foreignResults = parts.slice(1).map((part) => receiver.receive(part, "source-b")).filter(Boolean);
  check("different source clients cannot complete each other's assemblies", foreignResults, []);
  check("source separation maintains independent assemblies", receiver.status().assemblies, 2);
  receiver.reset();
  check("reset discards all assemblies and byte memory", [receiver.status().assemblies, receiver.status().bufferedBytes], [0, 0]);
}
{
  const { receiver } = clockReceiver();
  receiver.receive(parts[0], "source-a");
  receiver.receive({ ...parts[1], total: parts.length + 1 }, "source-a");
  check("mismatched part count rejects and discards assembly", [receiver.status().assemblies, receiver.status().bufferedBytes, receiver.status().rejected], [0, 0, 1]);
  check("remaining frames cannot revive rejected transfer", parts.map((part) => receiver.receive(part, "source-a")).filter(Boolean), []);
}
{
  const { receiver } = clockReceiver();
  const damaged = { ...parts[1], data: `${parts[1].data[0] === "A" ? "B" : "A"}${parts[1].data.slice(1)}` };
  const result = parts.map((part, index) => receiver.receive(index === 1 ? damaged : part, "source-a")).filter(Boolean);
  check("valid-base64 byte corruption fails integrity check", result, []);
  check("corrupt assembly leaves no byte memory", [receiver.status().bufferedBytes, receiver.status().rejected], [0, 1]);
}
{
  const { receiver } = clockReceiver();
  receiver.receive(parts[0], "source-a");
  receiver.receive({ ...parts[0], data: `${parts[0].data[0] === "A" ? "B" : "A"}${parts[0].data.slice(1)}` }, "source-a");
  check("conflicting duplicate rejects the entire transfer", receiver.status().rejected, 1);
  const invalid = [
    { total: 0 }, { total: Math.ceil(VISUAL_LIMIT / (24 * 1024)) + 1 }, { index: -1 },
    { index: 0.5 }, { data: "!" }, { data: "AAAA" }, { data: "A".repeat(32772) }, { checksum: "invalid" },
  ];
  invalid.forEach((patch, index) => receiver.receive({ ...parts[0], ...patch }, `invalid-${index}`));
  check("invalid counts indexes data sizes and base64 are bounded", receiver.status().rejected, invalid.length + 1);
  check("invalid frames never allocate an assembly", receiver.status().assemblies, 0);
}
{
  const { receiver, advance, timers } = clockReceiver();
  receiver.receive(parts[0], "source-a");
  advance(29000);
  receiver.receive(parts[1], "source-a");
  advance(29000);
  check("timeout follows inactivity rather than total transfer duration", receiver.status().assemblies, 1);
  advance(999);
  check("assembly survives until full30 seconds of inactivity", receiver.status().assemblies, 1);
  advance(1);
  check("inactivity timeout releases buffers and timer", [receiver.status().assemblies, receiver.status().bufferedBytes, timers.size], [0, 0, 0]);
  receiver.reset();
  receiver.receive(parts[0], "source-a");
  receiver.reset();
  check("reset cancels active expiration timers", timers.size, 0);
  check("reset allows a new transfer of the same event", parts.map((part) => receiver.receive(part, "source-a")).filter(Boolean), [unicode]);
}
{
  const { receiver } = clockReceiver();
  for (let index = 0; index < 33; index += 1) receiver.receive(parts[0], `source-${index}`);
  check("active assembly count is capped at32", receiver.status().assemblies, 32);
  check("oldest incomplete assembly is evicted at cap", receiver.status().evicted, 1);
  check("evicted old transfer cannot complete from remaining frames", parts.slice(1).map((part) => receiver.receive(part, "source-0")).filter(Boolean), []);
  receiver.reset();
}
{
  const event = visual("near-buffer-cap", "x".repeat(23 * 1024 * 1024));
  const largeParts = splitBattleVisualEvent(event);
  const { receiver } = clockReceiver();
  for (let source = 0; source < 3; source += 1) {
    for (const part of largeParts.slice(0, -1)) receiver.receive(part, `large-${source}`);
  }
  check("aggregate incomplete bytes remain below64MiB", receiver.status().bufferedBytes <= 64 * 1024 * 1024, true);
  check("aggregate memory cap evicts an old assembly", receiver.status().evicted > 0, true);
  receiver.reset();
  check("memory cap test releases retained buffers", receiver.status().bufferedBytes, 0);
}
assert.throws(() => splitBattleVisualEvent(visual("oversize", "x".repeat(VISUAL_LIMIT))), /battle_visual_size_limit/);
checks += 1;

function clockIngress(onDeliver = null) {
  let clock = 0;
  let serial = 0;
  let idle = 0;
  const timers = new Map();
  const delivered = [];
  const ingress = createBattleVisualIngress({
    deliver(kind, message) { delivered.push({ kind, message }); onDeliver?.(kind, message, ingress); },
    onIdle() { idle += 1; },
    now: () => clock,
    setTimer(fn, ms) { const id = ++serial; timers.set(id, { fn, at: clock + ms }); return id; },
    clearTimer(id) { timers.delete(id); },
  });
  return {
    ingress, delivered, timers, idle: () => idle,
    advance(ms) {
      const end = clock + ms;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > end) break;
        clock = next[1].at; timers.delete(next[0]); next[1].fn();
      }
      clock = end;
    },
  };
}
function envelope(event, sequence, sourceClientId = "source-a") { return { event, sequence, sourceClientId, roomCode: "QA", stateVersion: 8 }; }
{
  const h = clockIngress();
  h.ingress.receive("event", envelope(parts[0], 10));
  h.ingress.receive("state", { version: 9, payload: { battleState: null } });
  h.ingress.receive("event", envelope({ id: "next-map-action", channel: "movement", type: "move-step" }, 11, "next-player"));
  check("first chunk reserves visual position ahead of terminal and next-player map action", h.delivered.length, 0);
  check("ingress busy state includes placeholder and subsequent messages", h.ingress.status().pending, 3);
  parts.slice(1).forEach((part, index) => h.ingress.receive("event", envelope(part, 12 + index)));
  check("reassembled visual precedes terminal snapshot and later map action", h.delivered.map(({ kind, message }) => [kind, message.event?.id || message.version]), [["event", unicode.id], ["state", 9], ["event", "next-map-action"]]);
  check("reassembled visual keeps first arrival sequence", h.delivered[0].message.sequence, 10);
  check("reassembled visual keeps first arrival source and state metadata", [h.delivered[0].message.sourceClientId, h.delivered[0].message.stateVersion], ["source-a", 8]);
  check("raw parts never reach downstream sequence guard", h.delivered.some(({ message }) => message.event?.type === "visual-part"), false);
  check("completed blocked ingress returns idle once", [h.ingress.status().pending, h.idle()], [0, 1]);
}
{
  const h = clockIngress();
  const other = visual("second-visual", "連擊🌊".repeat(14000));
  const otherParts = splitBattleVisualEvent(other);
  h.ingress.receive("event", envelope(parts[0], 20));
  h.ingress.receive("state", { version: 21, payload: {} });
  h.ingress.receive("event", envelope(otherParts[0], 22, "source-b"));
  otherParts.slice(1).forEach((part, index) => h.ingress.receive("event", envelope(part, 23 + index, "source-b")));
  check("second visual completed first cannot overtake earlier incomplete visual", h.delivered.length, 0);
  parts.slice(1).forEach((part, index) => h.ingress.receive("event", envelope(part, 100 + index)));
  check("inverted completion still respects visual first-appearance order", h.delivered.map(({ kind, message }) => [kind, message.event?.id || message.version]), [["event", unicode.id], ["state", 21], ["event", other.id]]);
  check("later completed visual also keeps its first chunk sequence", h.delivered[2].message.sequence, 22);
}
{
  const h = clockIngress();
  h.ingress.receive("event", envelope(parts[0], 1));
  h.ingress.receive("state", { version: 2, payload: { battleState: null } });
  h.advance(29999);
  check("ingress retains later state before chunk inactivity timeout", h.delivered.length, 0);
  h.advance(1);
  check("timeout releases later authoritative state without permanent stall", h.delivered.map(({ message }) => message.version), [2]);
  check("timeout drains placeholder and resumes idle controls", [h.ingress.status().pending, h.idle(), h.timers.size], [0, 1, 0]);
}
{
  const h = clockIngress();
  h.ingress.receive("event", envelope(parts[0], 1));
  h.advance(30000);
  check("timeout of final placeholder emits idle even with no later messages", [h.ingress.status().pending, h.idle()], [0, 1]);
  h.ingress.receive("event", envelope(parts[0], 3, "source-b"));
  h.ingress.receive("state", { version: 4, payload: {} });
  h.ingress.reset();
  h.advance(60000);
  check("reset cancels placeholder and queued messages without idle resume", [h.ingress.status().pending, h.delivered.length, h.idle(), h.timers.size], [0, 0, 1, 0]);
}
{
  const h = clockIngress();
  h.ingress.receive("event", envelope(parts[0], 1));
  h.ingress.receive("state", { version: 2, payload: {} });
  h.ingress.receive("event", envelope({ ...parts[1], total: parts.length + 1 }, 3));
  check("rejected mismatched chunk releases reserved position", h.delivered.map(({ message }) => message.version), [2]);
  check("rejected chunk leaves no blocked ingress", h.ingress.status().pending, 0);
}
{
  let assembliesDuringDeliver = 0;
  const h = clockIngress((_kind, _message, ingress) => { assembliesDuringDeliver = ingress.status().assemblies; });
  h.ingress.receive("event", envelope(parts[0], 1, "evict-0"));
  h.ingress.receive("state", { version: 2, payload: {} });
  for (let index = 1; index < 33; index += 1) h.ingress.receive("event", envelope(parts[0], index + 2, `evict-${index}`));
  check("assembly eviction releases first reserved placeholder", h.delivered.map(({ message }) => message.version), [2]);
  check("discard callback cannot drain halfway through accepting replacement chunk", assembliesDuringDeliver, 32);
  check("remaining active reservations respect assembly bound", h.ingress.status().waiting, 32);
  h.ingress.reset();
}
{
  const h = clockIngress((_kind, message, ingress) => {
    if (message.event?.id === unicode.id) ingress.receive("event", envelope({ id: "reentrant", channel: "ui", type: "notice" }, 99));
  });
  h.ingress.receive("event", envelope(parts[0], 1));
  h.ingress.receive("event", envelope({ id: "already-queued", channel: "ui", type: "notice" }, 2));
  parts.slice(1).forEach((part, index) => h.ingress.receive("event", envelope(part, 3 + index)));
  check("reentrant delivery appends after messages already queued", h.delivered.map(({ message }) => message.event.id), [unicode.id, "already-queued", "reentrant"]);
  check("reentrant completion reports idle once", h.idle(), 1);
}
console.log(JSON.stringify({ ok: true, checks, multilingualBytes: Buffer.byteLength(JSON.stringify(unicode)), frames: parts.length }));
