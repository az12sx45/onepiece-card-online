"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../public/js/board_battle.js"), "utf8");
const checks = [];
function check(name, actual, expected = true) {
  assert.deepEqual(actual, expected, name);
  checks.push(name);
}
function productionFunction(name) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf("\n  function ", start + 1);
  assert.ok(start >= 0 && end > start, name);
  return source.slice(start, end);
}
const portraitFunctions = [
  "attackHitDamages", "attackTargetSide", "attackDamageTotal", "visualEventCombatantForSide",
  "ensureVisualHpOverride", "currentVisualHpOverride", "displayedCombatant", "getPortraitSet", "portraitUrl",
  "effectivePortraitState", "shouldKeepPlayerPortraitOnKnockout", "setImageSafe", "combatantVisualKey",
  "currentCombatantHp", "attackPresentationPending", "markKnockoutPortraitHidden", "clearKnockoutPortraitHidden",
  "knockoutPortraitShouldStayHidden", "resetPortraitVisual", "syncPlayerAwakeningStandby", "resetChangedCombatants",
  "setPortraitState", "restartPortraitMotion", "playPortraitAction", "showKnockoutPose", "playKnockoutAction",
  "restartAnimation", "applyDisplayedHitDamage", "finishDisplayedAttackHp", "replacementPanelKnockoutKey",
  "replacementNeedsKnockoutDelay", "clearReplacementPanelGate", "scheduleReplacementPanelRender",
  "replacementPanelReady", "battleResultPresentationReady", "handleVisualEvent",
];
function harness(side = "player", options = {}) {
  let now = 0;
  let serial = 0;
  const timers = new Map();
  const trace = [];
  const later = (callback, delay) => { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id; };
  const cancel = (id) => timers.delete(id);
  function element(name) {
    const classes = new Set();
    let src = "";
    return {
      dataset: {}, style: { setProperty() {}, removeProperty() {} }, offsetWidth: 100,
      classList: {
        add(...values) { for (const value of values) { if (!classes.has(value)) trace.push({ time: now, node: name, add: value }); classes.add(value); } },
        remove(...values) { for (const value of values) { if (classes.has(value)) trace.push({ time: now, node: name, remove: value }); classes.delete(value); } },
        toggle(value, enabled) { if (enabled) this.add(value); else this.remove(value); },
        contains: (value) => classes.has(value),
      },
      get src() { return src; },
      set src(value) { src = value; trace.push({ time: now, node: name, src: value }); },
      getAttribute: (name) => name === "src" ? src : null,
      removeAttribute(name) { if (name === "src") src = ""; },
    };
  }
  const refs = new Proxy({}, { get(target, key) { return target[key] || (target[key] = element(key)); } });
  const combatant = (name, currentHp) => ({ id: name, name, currentHp, maxHp: 100, battlePortraits: Object.fromEntries(["normal", "angry", "hit", "weak", "dizzy", "morale"].map((pose) => [pose, `${name}/${pose}.webp`])) });
  const view = {
    player: { id: "p" }, activeCard: combatant("player", side === "player" ? 0 : 100), enemy: combatant("enemy", side === "enemy" ? 0 : 100),
    battle: { playerId: "p", activeCrewIndex: 0, animating: true, needsReplacement: side === "player", keepPlayerPortraitOnKnockout: !!options.awakening,
      visualEvent: { id: "attack-1", type: "attack", side: side === "player" ? "enemy" : "player", targetSide: side, damage: 100, hitDamages: [100], startHp: { player: 100, enemy: 100 }, finalHp: { player: side === "player" ? 0 : 100, enemy: side === "enemy" ? 0 : 100 } },
    },
  };
  const sandbox = {
    refs, latestView: view, visualHpOverride: null, completedImpactEventId: "", pendingAttackPresentation: null, currentMode: null,
    portraitState: { player: "normal", enemy: "normal" }, portraitTimers: {}, knockoutTimers: {},
    knockoutVisualStarted: { player: false, enemy: false }, knockoutHiddenCombatantKeys: { player: "", enemy: "" },
    knockoutActions: { player: null, enemy: null }, lastCombatantKeys: { player: "", enemy: "" },
    nikaAwakeningHeartbeatTimer: null, playerKnockoutPanelReadyAt: 0, replacementPanelGateKey: "", replacementPanelAutoKoKey: "", replacementPanelTimer: null,
    KNOCKOUT_FADE_DELAY_MS: 1250, KNOCKOUT_REPEAT_FADE_DELAY_MS: 900, KNOCKOUT_FADE_DURATION_MS: 1050,
    REPLACEMENT_PANEL_KO_BUFFER_MS: 360, KNOCKOUT_ANNOUNCE_AFTER_FADE_BUFFER_MS: 120,
    PLACEHOLDER_BATTLE_PORTRAIT: "placeholder.webp", missingPortraitSrc: new Set(),
    lastVisualEventId: "", playedVisualEventIds: new Set(),
    Date: { now: () => now }, setTimeout: later, clearTimeout: cancel, clearInterval: cancel,
    window: {}, renderHud() {}, renderShikiArchipelago() {}, renderPanel() {},
    playCutIn: (text) => trace.push({ time: now, cutIn: text }), moveFxRuntime: () => null,
    eventActorSide: (event) => event.side, clearInactiveActionPose() {}, isAttackLikeMoveType: () => true,
    playImpactFx: (event) => trace.push({ time: now, impactEvent: event.id }),
  };
  for (const name of ["clearImpactFxTimers", "clearKyubiMaskFx", "clearSanjiRaidSuitFx", "clearLucciSixPowerFx", "clearLucciRokuoganFx", "clearBulletFusionFx", "clearSagaFusionFx", "clearOarsPurificationFx", "clearBlackTurnFx", "clearKatakuriFutureSightCinematic", "clearTotMusicaDualSyncFx"]) sandbox[name] = () => {};
  vm.createContext(sandbox);
  vm.runInContext(portraitFunctions.map(productionFunction).join("\n"), sandbox);
  const paint = () => {
    sandbox.ensureVisualHpOverride(view);
    sandbox.resetChangedCombatants(view);
    sandbox.setPortraitState("player", sandbox.portraitState.player);
    sandbox.setPortraitState("enemy", sandbox.portraitState.enemy);
    sandbox.syncPlayerAwakeningStandby(view);
  };
  const advance = (until) => {
    for (;;) {
      const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > until) break;
      now = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    now = until;
  };
  paint();
  return { sandbox, refs, view, trace, paint, advance, side,
    contact(damage, duration = 700) { sandbox.playPortraitAction(side, "hit", duration); sandbox.applyDisplayedHitDamage(side, damage); },
    knockout(id = "knockout-1") { view.battle.visualEvent = { id, type: "knockout", side, targetName: side }; sandbox.handleVisualEvent(view); },
    src: () => refs[`${side}Portrait`].src,
    fades: () => trace.filter((entry) => entry.node === `${side}Card` && entry.add === "portrait-ko").length,
  };
}

for (const side of ["player", "enemy"]) {
  const h = harness(side), s = h.sandbox;
  check(`${side}: initial final HP snapshot keeps starting portrait`, h.src(), `${side}/normal.webp`);
  check(`${side}: starting visual HP is held`, s.currentCombatantHp(side), 100);
  check(`${side}: raw replacement cannot trigger a premature KO`, s.replacementPanelReady(h.view), side === "enemy");
  check(`${side}: no KO before contact`, h.fades(), 0);
  h.advance(820); h.contact(100);
  check(`${side}: lethal contact shows hit exactly once`, h.src(), `${side}/hit.webp`);
  check(`${side}: HP changes at contact`, s.currentCombatantHp(side), 0);
  h.advance(1520);
  check(`${side}: lethal hit settles to dizzy without standing`, h.src(), `${side}/dizzy.webp`);
  h.paint(); h.advance(1740); s.finishDisplayedAttackHp("attack-1");
  check(`${side}: completed contact still waits for authoritative KO`, s.attackPresentationPending(), true);
  check(`${side}: held dizzy is not an early fade`, h.fades(), 0);
  h.advance(3300); h.knockout();
  const action = s.knockoutActions[side];
  h.knockout(); h.knockout("knockout-duplicate-id");
  if (side === "player") s.replacementPanelReady(h.view);
  check(`${side}: repeated event and fallback keep one timer sequence`, s.knockoutActions[side] === action);
  h.advance(4200); h.paint();
  check(`${side}: one fade starts after the held knockout`, h.fades(), 1);
  h.advance(6300); h.knockout("knockout-late-duplicate"); h.paint();
  check(`${side}: later KO does not reappear or restart its fade`, h.fades(), 1);
  check(`${side}: one knockout announcement`, h.trace.filter((entry) => entry.cutIn).length, 1);
  check(`${side}: portrait stays hidden`, h.refs[`${side}Card`].classList.contains("portrait-ko"));
  h.view.battle.animating = false;
  h.view.battle.needsReplacement = false;
  h.view.battle.visualEvent = { id: "revive", type: "heal" };
  h.view[side === "player" ? "activeCard" : "enemy"].currentHp = 80;
  h.paint();
  check(`${side}: actual revival restores normal portrait`, h.src(), `${side}/normal.webp`);
  check(`${side}: actual revival resets KO deduplication`, s.knockoutActions[side], null);
  h.view[side === "player" ? "activeCard" : "enemy"].currentHp = 0;
  h.knockout("second-life-knockout"); h.advance(8000);
  check(`${side}: a subsequent life can be knocked out once`, h.fades(), 2);
}

{
  const h = harness(), s = h.sandbox;
  h.view.battle.visualEvent.hitDamages = [40, 60];
  h.advance(590); h.contact(40, 420); h.advance(1010);
  check("combo: first surviving contact returns to normal", h.src(), "player/normal.webp");
  h.advance(1250); h.contact(60, 420); h.advance(1670);
  check("combo: lethal last contact holds dizzy", h.src(), "player/dizzy.webp");
  check("combo: each contact preserves original HP decrement", s.currentCombatantHp("player"), 0);
  h.paint();
  check("combo: polling cannot restart a held KO", h.fades(), 0);
}

{
  const h = harness("player", { awakening: true }), s = h.sandbox;
  check("Nika: raw awakening flag cannot bypass contact", h.src(), "player/normal.webp");
  check("Nika: no standby filter before contact", h.refs.playerCard.classList.contains("nika-awakening-standby"), false);
  h.advance(820); h.contact(100); h.paint();
  check("Nika: contact keeps its full hit pose", h.src(), "player/hit.webp");
  h.advance(1520); h.knockout(); h.paint();
  check("Nika: formal KO switches to standby", h.refs.playerCard.classList.contains("nika-awakening-standby"));
  h.advance(6000); h.knockout("nika-duplicate");
  check("Nika: awakening never fades the player", h.fades(), 0);
}

{
  const h = harness("enemy"), s = h.sandbox;
  h.view.battle.result = "win";
  check("result: final result cannot bypass contact", s.battleResultPresentationReady(h.view), false);
  h.advance(820); h.contact(100); h.advance(1520); h.knockout();
  check("result: final result waits for the fade", s.battleResultPresentationReady(h.view), false);
  h.advance(3830);
  check("result: final result releases after the fade buffer", s.battleResultPresentationReady(h.view));
  const writes = h.trace.filter((entry) => entry.src).length;
  h.paint(); h.paint(); h.paint();
  check("image: unchanged polling does not assign src again", h.trace.filter((entry) => entry.src).length, writes);
}

{
  const h = harness(), s = h.sandbox;
  h.advance(820); h.contact(100); h.advance(1740); s.finishDisplayedAttackHp("attack-1");
  check("restore: unresolved authority tail stays gated", s.replacementPanelReady(h.view), false);
  h.advance(4250);
  check("restore: stale animating flag cannot gate forever", s.attackPresentationPending(), false);
  check("restore: fallback starts its one fade after expiry", s.replacementPanelReady(h.view), false);
  h.advance(6560);
  check("restore: replacement opens after fallback fade", s.replacementPanelReady(h.view));
  check("restore: fallback produces exactly one fade", h.fades(), 1);
}

{
  const h = harness(), s = h.sandbox;
  h.knockout();
  s.clearReplacementPanelGate();
  check("late replacement: cleared UI gate still honors the existing fade deadline", s.replacementPanelReady(h.view), false);
  h.advance(2660);
  check("late replacement: existing fade completes without another KO", s.replacementPanelReady(h.view));
  check("late replacement: one fade after control mode changes", h.fades(), 1);
}

{
  const h = harness(), s = h.sandbox;
  const image = h.refs.playerPortrait, wrap = h.refs.playerPortraitWrap;
  s.setImageSafe(image, wrap, "bad.webp", "fallback.webp");
  image.onerror();
  check("image: first failed image still falls back", image.src, "fallback.webp");
  check("image: failed source is remembered", s.missingPortraitSrc.has("bad.webp"));
  s.setImageSafe(image, wrap, "bad.webp", "fallback.webp");
  check("image: repeat failed source preserves its fallback", image.src, "fallback.webp");
  h.view.battle.visualEvent = { id: "observed-a", type: "attack" }; s.handleVisualEvent(h.view);
  h.view.battle.visualEvent = { id: "observed-b", type: "attack" }; s.handleVisualEvent(h.view);
  h.view.battle.visualEvent = { id: "observed-a", type: "attack" }; s.handleVisualEvent(h.view);
  check("events: A/B/A delivery does not replay A", h.trace.filter((entry) => entry.impactEvent).map((entry) => entry.impactEvent), ["observed-a", "observed-b"]);
  for (let i = 0; i < 600; i++) { h.view.battle.visualEvent = { id: `bounded-${i}`, type: "ignored" }; s.handleVisualEvent(h.view); }
  check("events: transient deduplication memory is bounded", s.playedVisualEventIds.size, 512);
}

// Execute the actual Tot Musica timelines with a controlled presentation clock.
function totHarness() {
  const h = harness(), s = h.sandbox;
  const calls = [];
  s.totMusicaDualFxTimers = []; s.totMusicaDualDiceIntervals = []; s.totMusicaDualAwaitTimer = null;
  s.totMusicaDualAwaitingEvent = false; s.totMusicaDualAnimationActive = false;
  s.scheduleTotMusicaDualFx = (callback, delay) => s.totMusicaDualFxTimers.push(s.setTimeout(callback, delay));
  s.playCastEffectSound = (sound) => calls.push({ sound, at: s.Date.now() });
  s.moveFxSound = (event) => event.castSfx || "";
  s.moveFxRuntime = () => ({ warm() {}, play() {} });
  for (const name of ["clearDamageNumbers", "setTotMusicaWorldStage", "setTotMusicaBossStage", "animateTotMusicaWorldDice", "setTotMusicaDualImage", "setTotMusicaHpUi", "playStageShake", "syncTotMusicaPersistentStage", "spawnBattleDamageNumber", "playHitEffectSound"]) s[name] = () => {};
  const constantsStart = source.indexOf("  const TOT_MUSICA_DICE_ROLL_MS");
  const constantsEnd = source.indexOf("\n", source.indexOf("  const TOT_MUSICA_BOSS_REVEAL_HOLD_MS", constantsStart));
  vm.runInContext(source.slice(constantsStart, constantsEnd) + "\n" + productionFunction("playTotMusicaDualSyncFx") + "\n" + productionFunction("playTotMusicaEnemyDualStrikeFx"), s);
  return { ...h, calls };
}
{
  const h = totHarness(), s = h.sandbox;
  const world = (castSfx) => ({ moveId: castSfx, castSfx, direct: true, hit: true, firstDiceFace: 2, diceTotal: 2, diceRolls: [2] });
  s.playTotMusicaDualSyncFx({ bothAttackRolls: true, realWorld: world("real-cast"), songWorld: world("song-cast"), damage: 10 });
  h.advance(5699);
  check("Tot attack: dice and collision are free of skill sounds", h.calls.length, 0);
  h.advance(5700);
  check("Tot attack: both casts begin at the upward launch", h.calls.map((call) => call.at), [5700, 5700]);
}
{
  const h = totHarness(), s = h.sandbox;
  s.playTotMusicaDualSyncFx({ realWorld: { moveId: "heal", castSfx: "heal-cast", direct: false }, songWorld: { moveId: "buff", castSfx: "buff-cast", direct: false } });
  h.advance(4399);
  check("Tot support: no cast during the dice", h.calls.length, 0);
  h.advance(4400);
  check("Tot support: casts coincide with judge-time effects", h.calls.map((call) => call.at), [4400, 4400]);
}
for (const continueFromPlayerHigh of [false, true]) {
  const h = totHarness(), s = h.sandbox;
  s.playTotMusicaEnemyDualStrikeFx({ castSfx: "enemy-cast", diceFace: 2, diceRolls: [2], continueFromPlayerHigh });
  const attackAt = continueFromPlayerHigh ? 3300 : 6200;
  h.advance(attackAt - 1);
  check(`Tot enemy ${continueFromPlayerHigh}: revealing and dice do not play cast`, h.calls.length, 0);
  h.advance(attackAt);
  check(`Tot enemy ${continueFromPlayerHigh}: cast begins at the attack`, h.calls.map((call) => call.at), [attackAt]);
}

const report = { ok: true, checks: checks.length, cases: checks };
if (process.env.BOARD_QA_OUTPUT) {
  fs.mkdirSync(process.env.BOARD_QA_OUTPUT, { recursive: true });
  fs.writeFileSync(path.join(process.env.BOARD_QA_OUTPUT, "board-battle-knockout-timing-report.json"), JSON.stringify(report, null, 2) + "\n");
}
console.log(JSON.stringify(report, null, 2));
