"use strict";
const assert = require("node:assert/strict");
const { create } = require("../public/js/board_remote_playback");
let clock = 1000;
let nextTimer = 0;
let idle = 0;
let checks = 0;
let battleBusy = false;
const timers = new Map();
const calls = [];
const seen = new Set();
const check = (label, test) => { test(); checks++; console.log(`PASS ${label}`); };
const playback = create({
  now: () => clock,
  setTimer: (fn, ms) => { const id = ++nextTimer; timers.set(id, { fn, at: clock + ms }); return id; },
  clearTimer: (id) => timers.delete(id),
  blocked: () => battleBusy,
  duration: (event) => event && !seen.has(event.id) ? event.duration : 0,
  apply: (kind, message) => {
    const event = kind === "event" ? message.event : message.payload?.boardUiEvent;
    if (event) seen.add(event.id);
    calls.push({ kind, message, clock });
  },
  onIdle: () => idle++,
});
function advance(ms) {
  const end = clock + ms;
  while (true) {
    const next = [...timers].sort((a, b) => a[1].at - b[1].at)[0];
    if (!next || next[1].at > end) break;
    clock = next[1].at; timers.delete(next[0]); next[1].fn();
  }
  clock = end;
}
const a = { event: { id: "dice-a", duration: 3260, expiresAt: 2000 } };
const b = { event: { id: "dice-b", duration: 3260, expiresAt: 2000 } };
playback.enqueue("event", a);
playback.enqueue("state", { version: 1, payload: {} });
playback.enqueue("state", { version: 2, payload: {} });
playback.enqueue("event", b);
check("one action plays while later actions and newest checkpoint wait", () => {
  assert.equal(calls.length, 1); assert.deepEqual(playback.status(), { active: true, pending: 2 });
});
advance(3259);
check("first action cannot be interrupted by burst", () => assert.equal(calls.length, 1));
advance(1);
check("checkpoint then second action retain arrival order", () => {
  assert.equal(calls[1].message.version, 2); assert.equal(calls[2].message.event.id, "dice-b");
});
check("queued lifetime covers full local playback", () => assert(calls[2].message.event.expiresAt >= clock + 3260));
check("wire messages remain immutable", () => { assert.equal(a.event.expiresAt, 2000); assert.equal(b.event.expiresAt, 2000); });
advance(3260);
check("queue unlocks and resumes once", () => { assert.deepEqual(playback.status(), { active: false, pending: 0 }); assert.equal(idle, 1); });
playback.enqueue("event", { event: { id: "step-a", duration: 320 } });
playback.enqueue("event", { event: { id: "step-b", duration: 320 } });
const beforeStep = calls.length;
advance(319);
check("movement does not collapse to one frame", () => assert.equal(calls.length, beforeStep));
advance(1);
check("movement advances at advertised cadence", () => assert.equal(calls.at(-1).message.event.id, "step-b"));
playback.enqueue("state", { version: 3, payload: { battleState: { visualEvent: { id: "attack-a" } } } });
playback.enqueue("state", { version: 4, payload: { battleState: { visualEvent: { id: "attack-b" } } } });
check("distinct battle snapshots are not coalesced", () => assert.equal(playback.status().pending, 2));
playback.reset();
advance(10000);
check("disconnect discards queued visuals and timers", () => { assert.equal(calls.at(-1).message.event.id, "step-b"); assert.equal(timers.size, 0); assert.equal(playback.status().pending, 0); });
playback.enqueue("state", { version: 9, payload: {} });
check("restored latest state applies immediately after reset", () => assert.equal(calls.at(-1).message.version, 9));
battleBusy = true;
const beforeBattle = calls.length;
playback.enqueue("state", { version: 10, payload: { battleState: null } });
playback.enqueue("event", { event: { id: "next-turn-dice", duration: 3260 } });
advance(4000);
check("next map action cannot play behind battle overlay", () => assert.equal(calls.length, beforeBattle));
battleBusy = false;
playback.resume();
check("battle completion applies terminal state before next map dice", () => {
  assert.equal(calls[beforeBattle].message.version, 10);
  assert.equal(calls[beforeBattle + 1].message.event.id, "next-turn-dice");
  assert.equal(playback.status().active, true);
});
playback.reset();
console.log(JSON.stringify({ ok: true, checks }));
