"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.join(__dirname, "..");
const battle = fs.readFileSync(path.join(root, "public/js/board_battle.js"), "utf8");
const game = fs.readFileSync(path.join(root, "public/js/board_game.js"), "utf8");
const runtime = require("../public/js/board_move_fx.js");
const start = battle.indexOf("  function playImpactFx(");
const end = battle.indexOf("  const RAID_REWARD_SLOT_LABELS", start);
assert.ok(start > 0 && end > start);

function harness(ready = true) {
  let time = 0;
  let serial = 0;
  const calls = [];
  const queue = new Map();
  const record = (name, ...args) => calls.push({ name, time, args });
  const element = () => ({ classList: { remove() {}, toggle() {}, add() {} }, style: { setProperty() {} } });
  const fx = { ready: () => ready, resolve: () => ({ durationMs: 400, launchFrames: 4 }), play: (event, options) => { record("sprite", options.phase, options.targetSide, options.anchorElement, options.durationMs); return ready; } };
  const sandbox = {
    refs: { stage: element(), impactFx: element(), speedlinesFx: element(), enemyCard: element(), playerCard: element() },
    clearImpactFxTimers() {}, playLucciRokuoganFx: () => { record("lucci"); return true; },
    eventActorSide: (event) => event.side, attackTargetSide: (event) => event.targetSide || (event.side === "player" ? "enemy" : "player"),
    oppositeSide: (side) => side === "player" ? "enemy" : "player", playCutIn() {},
    deployJudgeCloneInterceptors: () => [], playPortraitAction: (...args) => record("pose", ...args),
    scheduleImpactFx: (callback, delay) => queue.set(++serial, { callback, at: time + delay }),
    moveFxRuntime: () => fx, moveFxPlayer: fx, playSpeedlines: () => record("speedlines"),
    applyDisplayedHitDamage: (...args) => record("hp", ...args), playStageShake: () => record("shake"),
    inferHitEffectFile: () => "punch_mark.webp", positionImpactFx() {}, setImpactEffect() {}, setDirectionalImpactEffect() {},
    restartAnimation: () => record("legacy-impact"), playHitEffectSound: (sound) => record("sound", sound),
    moveFxSound: () => "audio/new-hit.ogg", eventCriticalAtHit: () => false,
    spawnBattleDamageNumber: (options) => record("number", options.amount), finishDisplayedAttackHp: () => record("finish-hp"), clearJudgeCloneInterceptors() {},
    playStatusEffectFx: (...args) => record("status", ...args), effectKind: () => "heal",
  };
  vm.runInNewContext(`${battle.slice(start, end)}; this.play = playImpactFx;`, sandbox);
  return { calls, play: sandbox.play, advance(until) {
    while (true) {
      const entry = [...queue.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > until) break;
      queue.delete(entry[0]); time = entry[1].at; entry[1].callback();
    }
    time = until;
  } };
}

let checks = 0;
function check(description, action) { action(); checks += 1; }
const event = { id: "move-1", moveId: "luffy_pistol", type: "attack", side: "player", targetSide: "enemy", damage: 42, hitDamages: [42] };
const one = harness(); one.play(event); one.advance(819);
check("no HP loss before current single contact time", () => assert.equal(one.calls.filter((call) => call.name === "hp").length, 0));
one.advance(820);
check("sprite, sound, HP and number share existing contact", () => {
  ["hp", "sound", "number"].forEach((name) => assert.equal(one.calls.find((call) => call.name === name).time, 820));
  assert.equal(one.calls.find((call) => call.name === "sprite" && call.args[0] === "impact").time, 820);
});
check("ready sprite suppresses CSS speedlines and impact", () => assert.equal(one.calls.filter((call) => ["speedlines", "legacy-impact"].includes(call.name)).length, 0));
check("single impact uses the complete 700 ms hit pose", () => assert.equal(one.calls.find((call) => call.name === "sprite" && call.args[0] === "impact").args[3], 700));
const combo = harness(); combo.play({ ...event, hitDamages: [10, 20, 30] }); combo.advance(2400);
check("combo contacts stay 590,1250,1910 without extra damage", () => assert.deepEqual(combo.calls.filter((call) => call.name === "hp").map((call) => call.time), [590, 1250, 1910]));
check("combo damage numbers preserve each damage", () => assert.deepEqual(combo.calls.filter((call) => call.name === "number").map((call) => call.args[0]), [10, 20, 30]));
check("every combo impact gets the complete 420 ms hit pose", () => assert.deepEqual(combo.calls.filter((call) => call.name === "sprite" && call.args[0] === "impact").map((call) => call.args[3]), [420, 420, 420]));
const cold = harness(false); cold.play(event); cold.advance(1000);
check("unready art retains legacy effect at same contact", () => assert.equal(cold.calls.find((call) => call.name === "legacy-impact").time, 820));
const miss = harness(); miss.play({ ...event, miss: true, damage: 0, hitDamages: [0] }); miss.advance(1000);
check("miss applies neither HP damage nor contact sound", () => assert.equal(miss.calls.filter((call) => ["hp", "sound"].includes(call.name)).length, 0));
const lucci = harness(); lucci.play({ ...event, specialFx: "lucci-rokuogan" }); lucci.advance(10000);
check("Lucci remains on existing cinematic path", () => assert.deepEqual(lucci.calls.map((call) => call.name), ["lucci"]));
const support = harness(); support.play({ id: "heal", moveId: "heal_move", type: "heal", side: "player", amount: 10 }); support.advance(1000);
check("support passes move identity into particle suppression", () => assert.equal(support.calls.find((call) => call.name === "status").args[1].moveEvent.moveId, "heal_move"));
check("support sprite uses existing 360ms status effect moment", () => assert.equal(support.calls.find((call) => call.name === "sprite").time, 360));

const soundContext = { window: { BoardMoveFx: runtime, BoardMoveFxCatalog: { moves: { test_move: { sound: "audio/test.ogg", castSound: "audio/windup.ogg" } }, families: {} } }, battleHitEffectChoiceForMove: () => ({ sfx: "old-custom.mp3" }), battleHitEffectSettings: () => ({}) };
const soundsStart = game.indexOf("  function battleHitSfxForMove(");
const soundsEnd = game.indexOf("  function battleActorLevel(", soundsStart);
vm.runInNewContext(`${game.slice(soundsStart, soundsEnd)}; this.hit = battleHitSfxForMove; this.cast = battleCastSfxForMove;`, soundContext);
check("authoritative event takes exact catalog OGG paths", () => { assert.equal(soundContext.hit({ id: "test_move" }), "audio/test.ogg"); assert.equal(soundContext.cast({ id: "test_move" }), "audio/windup.ogg"); });
check("old overrides survive for an unmapped legacy move", () => assert.equal(soundContext.hit({ id: "unknown" }), "old-custom.mp3"));
check("new scripts precede battle/game consumers", () => {
  ["board_game", "board_battle"].forEach((name) => {
    const html = fs.readFileSync(path.join(root, `public/${name}.html`), "utf8");
    const catalogAt = html.indexOf('src="js/board_move_fx_catalog.js');
    const runtimeAt = html.indexOf('src="js/board_move_fx.js');
    const consumerAt = html.indexOf(`src="js/${name}.js`);
    assert.ok(catalogAt > 0 && runtimeAt > catalogAt && consumerAt > runtimeAt);
  });
});
console.log(JSON.stringify({ ok: true, checks, scope: "production single/combo contact, HP ordering, no generated-effect duplication, support, Lucci, catalog SFX, legacy fallback" }));
