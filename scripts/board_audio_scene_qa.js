"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const board = fs.readFileSync(path.join(root, "public/js/board_game.js"), "utf8");
const routing = board.slice(board.indexOf("  function bgmCharacterTag("), board.indexOf("  function activeCrew("));
assert.ok(routing.includes("function bgmSeaPresentation"), "extract actual formal routing, not a duplicate implementation");
let checks = 0;
function check(value, message) { assert.ok(value, message); checks += 1; }
async function flush() { for (let i = 0; i < 8; i += 1) await Promise.resolve(); }

function fixture() {
  let now = 100000, nextId = 0;
  const timers = new Map(), listeners = new Map(), overlays = new Map(), sounds = [], audios = [];
  const player = { id: "audio-qa", location: { kind: "route" }, crew: [{ id: "luffy", maxHp: 100, currentHp: 100 }] };
  class Audio {
    constructor() { Object.assign(this, { readyState: 4, duration: 600, currentTime: 0, volume: 0, paused: true }); audios.push(this); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
    load() {}
    removeAttribute(name) { if (name === "src") this.src = ""; }
    addEventListener() {}
    removeEventListener() {}
  }
  const sandbox = {
    console, Audio, Date: { now: () => now }, performance: { now: () => now },
    setTimeout: (fn, delay = 0) => { const id = ++nextId; timers.set(id, { at: now + delay, fn }); return id; },
    clearTimeout: (id) => timers.delete(id),
    localStorage: { getItem: () => null, setItem: () => { throw new Error("routing must not persist preferences/state"); } },
    addEventListener: (type, fn) => { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(fn); },
    document: { getElementById: (id) => overlays.get(id) || null },
    state: { gameState: { phase: "main", players: [player] }, battleState: null },
    currentPlayer: () => player, activeCrew: (p) => p?.crew?.[0],
    getIslandById: () => ({ id: "test-island", kind: "shop" }), getIslandState: () => ({}),
    getEffectiveIslandKind: (island) => island.kind, isMedicalServiceIslandKind: () => false,
    luffyGearFifthVideoBgmPaused: false, BoardAudio: { playCue: (kind) => sounds.push(kind) },
  };
  sandbox.requestAnimationFrame = (fn) => sandbox.setTimeout(() => fn(now), 16);
  sandbox.window = sandbox; sandbox.globalThis = sandbox; sandbox.parent = sandbox;
  vm.createContext(sandbox);
  ["bgm_metadata.js", "choose_bgm.js", "bgm_manager.js", "board_sea_event_visuals.js"].forEach((name) => vm.runInContext(fs.readFileSync(path.join(root, "public/js", name), "utf8"), sandbox));
  vm.runInContext(routing, sandbox);
  const emitter = board.slice(board.indexOf("  function emitSpectatorModalEvent("), board.indexOf("  function clearPostgameWorldCinematicTimers("));
  sandbox.emitBoardUiEvent = (type, data) => ({ id: "local-tavern-receipt", type, ...data });
  vm.runInContext(emitter, sandbox);
  return {
    sandbox, player, overlays, sounds, audios,
    unlock: () => (listeners.get("pointerdown") || []).forEach((fn) => fn()),
    overlay(id, classes = ["open"]) {
      const flags = new Set(classes);
      const node = { isConnected: true, hidden: false, classList: { contains: (name) => flags.has(name) }, flags };
      overlays.set(id, node); return node;
    },
    async advance(ms) {
      const target = now + ms;
      for (;;) {
        const task = [...timers].filter(([, t]) => t.at <= target).sort((a, b) => a[1].at - b[1].at)[0];
        if (!task) break;
        timers.delete(task[0]); now = task[1].at; task[1].fn(); await flush();
      }
      now = target; await flush();
    },
  };
}

async function main() {
  const env = fixture(), s = env.sandbox;
  const choose = (context) => s.chooseBgm({ ...context, preferredBgmIds: context.preferredBgmIds || s.bgmScenePreferredIds(context) }).id;
  const original = JSON.stringify(s.state);
  for (const [scene, expected] of [["water_seven", "village_harbor"], ["spar_selection", "duel"], ["york_puzzle", "miss_allsunday"]]) {
    check(choose(s.bgmScenarioContext(scene)) === expected, `${scene} uses matching OST`);
  }
  for (const [prison, expected] of [
    [{ level: 1 }, "stealth_night_shadow"], [{ level: 4 }, "grand_line_hot_island"],
    [{ level: 5 }, "grand_line_cold_island"], [{ level: 4, alerted: true }, "one_hour_evacuation"],
    [{ level: 5, allowEscape: true }, "one_hour_evacuation"],
  ]) check(choose(s.bgmScenarioContext("impel_down", { impelDown: prison })) === expected, `prison ${JSON.stringify(prison)} music`);
  for (const win of [true, false]) {
    const context = s.bgmScenarioContext("marineford", { marinefordHold: { finished: true, win } });
    check(context.phase === (win ? "victory" : "defeat"), "Marineford finished state has result music");
    check(choose(context) === (win ? "we_did_it" : "mother_sea"), "Marineford result OST");
  }
  check(JSON.stringify(s.state) === original, "scenario builders do not mutate players/game state");

  for (const def of s.BoardSeaEventVisuals.definitions) {
    const presentation = s.bgmSeaPresentation({ title: def.title });
    check(s.BGM_METADATA.some((track) => track.id === choose(presentation.context)), `${def.key} selects an available track`);
    if (def.tone === "loss") check(presentation.cue === "danger", `${def.key} warns on loss`);
    if (def.type === "medicine" && def.tone !== "loss") check(presentation.cue === "heal", `${def.key} healing cue`);
  }
  check(s.bgmSeaPresentation({ chestTypeId: "wood", title: "漂流寶箱群" }, "chest-result").cue === "danger", "wooden trap overrides treasure artwork tone");
  check(s.bgmSeaPresentation({ chestTypeId: "gold" }, "chest-result").cue === "reward", "golden chest reward cue");
  check(s.bgmSeaPresentation({}, "draw").cue === "draw", "sea draw cue");
  check(s.bgmSeaPresentation({ typeId: "encounter" }).cue === "danger", "sea encounter never plays a reward cue");
  check(choose(s.bgmSeaPresentation({ title: "精神藥劑" }).context) === "chopper", "medicine uses Chopper theme");
  check(choose(s.bgmSeaPresentation({ title: "順風航線" }).context) === "to_the_ocean", "favorable wind uses sailing theme");
  check(s.bgmSeaPresentation({ title: "精神藥劑", outcomes: [{ tone: "loss" }] }).cue === "danger", "actual negative outcome takes precedence");

  for (const result of ["lose", "knockout", "escape", "win", "replacement", "round-pause", "coop-rescue-wait", ""]) {
    const battle = { bgmScopeId: "fixed-test", result, playerId: env.player.id, isSeaEncounter: true, activeCrewIndex: 0, enemyCombatant: { maxHp: 100, currentHp: 50 } };
    const saved = JSON.stringify(battle), context = s.bgmBattleContext(battle);
    const expected = result === "win" ? "victory" : result === "escape" ? "escape" : ["lose", "knockout"].includes(result) ? "defeat" : "battle_intro";
    check(context.phase === expected, `${result || "active"} battle phase`);
    check(JSON.stringify(battle) === saved, "existing battle scope is read without mutation");
    if (["lose", "knockout", "escape"].includes(result)) check(s.bgmPlaybackOptions(context).transition === "immediate", "terminal state immediately leaves battle music");
  }

  for (const [id, scene] of [["impelDownPageOverlay", "impel_down"], ["marinefordPageOverlay", "marineford"], ["waterSevenPageOverlay", "water_seven"], ["sparSelectionOverlay", "spar_selection"], ["yorkPuzzleOverlay", "york_puzzle"]]) {
    const node = env.overlay(id, id === "yorkPuzzleOverlay" ? [] : ["open"]);
    check(s.bgmOpenScenarioContext()?.sceneType === scene, `open ${scene} survives state refresh`);
    node.flags.add("closing"); check(s.bgmOpenScenarioContext() === null, `closing ${scene} cannot resurrect music`);
    node.flags.delete("closing"); node.hidden = true; check(s.bgmOpenScenarioContext() === null, `hidden ${scene} ignored`);
    node.hidden = false; node.isConnected = false; check(s.bgmOpenScenarioContext() === null, `detached ${scene} ignored`);
    env.overlays.clear();
  }
  env.overlay("impelDownPageOverlay");
  s.state.battleState = { bgmScopeId: "battle-precedence", playerId: env.player.id, isSeaEncounter: true, enemyCombatant: { maxHp: 100, currentHp: 100 } };
  s.refreshBgmForState();
  check(JSON.parse(s.BgmManager.status().desiredContextKey).sceneType === "battle", "battle takes precedence over scenario");
  s.state.battleState = null; s.refreshBgmForState();
  check(JSON.parse(s.BgmManager.status().desiredContextKey).sceneType === "impel_down", "scenario takes precedence over map");
  env.overlays.clear(); s.refreshBgmForState();
  check(JSON.parse(s.BgmManager.status().desiredContextKey).sceneType === "sailing", "closing scenario returns to map");
  env.unlock(); await flush();
  check(s.BgmManager.status().currentChoice.id === "to_the_ocean", "map music actually starts after gesture");

  s.playBoardModalAudio({ id: "short-shop", detail: { kind: "shop" } });
  await env.advance(300); s.refreshBgmForState(); await env.advance(5000);
  check(s.BgmManager.status().currentChoice.id === "to_the_ocean", "quick-exit shop cancels its stale 650 ms request");
  s.playBoardModalAudio({ id: "normal-shop", detail: { kind: "shop" } }); await env.advance(700);
  check(s.BgmManager.status().currentChoice.id === "oden_store", "normal shop visit changes OST within 700 ms");
  for (const scene of ["shop", "research", "hospital", "arena", "tavern", "sea_event", "event_island"]) {
    check(s.bgmPlaybackOptions({ sceneType: scene }).transitionDelayMs === 650, `${scene} short responsive delay`);
  }
  const event = { id: "shared-sea-result", detail: { kind: "sea-result", title: "精神藥劑" } };
  const soundsBefore = env.sounds.length;
  s.playBoardModalAudio(event); s.playBoardModalAudio(event); s.playBoardModalAudio(event);
  check(env.sounds.length === soundsBefore + 1 && env.sounds.at(-1) === "heal", "local echo and duplicate remote event play one cue");
  await env.advance(700); check(s.BgmManager.status().currentChoice.id === "chopper", "spectator medicine result selects actual healing OST");
  for (const [kind, expected] of [["research-lab", "research"], ["tavern", "tavern"], ["hospital", "hospital"], ["arena", "arena"], ["mission-board", "mission_board"], ["judicial-raid", "enemy_island"]]) {
    s.playBoardModalAudio({ id: kind, detail: { kind } });
    check(JSON.parse(s.BgmManager.status().desiredContextKey).sceneType === expected, `spectator ${kind} routes music`);
  }
  const resultBefore = env.sounds.length;
  for (let i = 0; i < 3; i += 1) s.playBgmForContext({ phase: "defeat", musicScope: "one-defeat", sceneType: "battle_result", preferredBgmIds: ["mother_sea"] });
  check(env.sounds.length === resultBefore + 1 && env.sounds.at(-1) === "defeat", "repeated battle renders do not repeat defeat cue");
  const rewardsBefore = env.sounds.length;
  s.playBoardModalAudio({ id: "battle-reward-first", detail: { kind: "battle-rewards" } });
  s.playBoardModalAudio({ id: "battle-reward-first", detail: { kind: "battle-rewards" } });
  s.playBoardModalAudio({ id: "battle-reward-second", detail: { kind: "battle-rewards" } });
  check(env.sounds.length === rewardsBefore + 2, "separate battle reward events each play victory; repeated event stays silent");
  check(JSON.parse(s.BgmManager.status().desiredContextKey).musicScope === "board-battle-rewards:battle-reward-second", "battle reward music scope uses existing event id");
  const tavernBefore = env.sounds.length, musicBeforeTavern = s.BgmManager.status().desiredContextKey;
  const tavern = s.emitSpectatorModalEvent("tavern-result", env.player, { title: "招募成功" });
  check(env.sounds.length === tavernBefore + 1 && env.sounds.at(-1) === "reward", "local tavern result plays reward cue");
  check(s.BgmManager.status().desiredContextKey === musicBeforeTavern, "local tavern cue does not reroute music");
  s.playBoardModalAudio(tavern);
  check(env.sounds.length === tavernBefore + 1, "local tavern result echo shares cue de-duplication");
  for (let i = 0; i < 300; i += 1) s.playBoardPresentationCue("tap", `bounded-cue-${i}`);
  check(vm.runInContext("boardPresentationCueEvents.size", s) === 256, "long sessions cap cue history at 256 ids");
  const boundedBefore = env.sounds.length;
  s.playBoardPresentationCue("tap", "bounded-cue-299");
  check(env.sounds.length === boundedBefore, "latest cue id remains deduplicated after history cap");
  s.playBoardPresentationCue("tap", "bounded-cue-0");
  check(env.sounds.length === boundedBefore + 1, "oldest cue id is evicted from bounded history");
  check(vm.runInContext("boardPresentationCueEvents.size", s) === 256, "history stays capped after evicted id returns");
  s.BoardAudio.playCue = () => { throw new Error("optional media failed"); };
  assert.doesNotThrow(() => s.playBoardModalAudio({ id: "failed-audio", detail: { kind: "chest-result", chestTypeId: "gold" } })); checks += 1;
  console.log(JSON.stringify({ ok: true, checks, scope: "formal routing + real chooser/manager with controlled browser audio clock", note: "No real media listening or physical-device acceptance is claimed." }));
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
