"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../public/js/board_battle.js"), "utf8");
function productionFunction(name, nextName) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf(`  function ${nextName}(`, start + 1);
  assert.ok(start >= 0 && end > start, `production function ${name} exists`);
  return source.slice(start, end).trim();
}
const createPlayback = vm.runInNewContext(`(${productionFunction("createSpectatorBattlePlayback", "refresh")})`);
let checks = 0;
function check(value, expected, description) {
  assert.deepEqual(value, expected, description);
  checks += 1;
}
function view(id, type = "attack", duration = 1000, canControl = false, actor = "remote", round = 1) {
  return {
    player: { id: actor }, activeCard: { currentHp: 100 }, enemy: { currentHp: 90 },
    battle: {
      canControl, canAct: canControl, canFinish: canControl,
      roundIndex: round, islandId: `island-${actor}`,
      visualEvent: id ? { id, type, duration } : null,
    },
  };
}
function harness() {
  let now = 0;
  let serial = 0;
  let authoritative = null;
  let displayed = null;
  let advances = 0;
  const timers = new Map();
  const playback = createPlayback({
    schedule(callback, delay) { const id = ++serial; timers.set(id, { callback, at: now + delay }); return id; },
    cancel(id) { timers.delete(id); },
    onAdvance() { advances += 1; displayed = playback.select(authoritative); },
  });
  return {
    playback,
    select(current, incoming = null) { authoritative = current; displayed = playback.select(current, incoming); return displayed; },
    advance(ms) {
      const until = now + ms;
      while (true) {
        const next = [...timers.entries()].sort((a, b) => a[1].at - b[1].at)[0];
        if (!next || next[1].at > until) break;
        now = next[1].at;
        timers.delete(next[0]);
        next[1].callback();
      }
      now = until;
    },
    displayed: () => displayed,
    advances: () => advances,
    timers: () => timers.size,
  };
}

// An action performed locally must not replay when control passes away.
{
  const h = harness();
  const own = view("own", "attack", 1000, true);
  check(h.select(own) === own, true, "local actions keep their live view");
  check(h.playback.status().active, false, "local actions do not enter replay");
  h.select(view("own"));
  check(h.playback.status().active, false, "losing control does not replay own event");
}

// Reproduce burst delivery: the posted dice is older than the parent's attack.
{
  const h = harness();
  const dice = view("dice", "dice", 1200);
  const attack = view("attack", "attack", 1000);
  h.select(attack, dice);
  check(h.displayed().battle.visualEvent.id, "dice", "posted dice survives the newer API view");
  check(h.playback.status().pending, 0, "a supplied event does not pull newer API events ahead of its stream");
  h.select(attack, attack);
  check(h.playback.status().pending, 1, "newer attack waits in order");
  dice.enemy.currentHp = 1;
  attack.enemy.currentHp = 2;
  check(h.displayed().enemy.currentHp, 90, "display snapshot cannot mutate with caller state");
  h.select(attack, dice);
  check(h.playback.status().pending, 1, "stream and full-state duplicates do not replay");
  const ownNextTurn = view("attack", "attack", 1000, true, "local", 2);
  h.select(ownNextTurn);
  h.advance(1819);
  check(h.displayed().battle.visualEvent.id, "dice", "dice rolling and settled hold finish locally");
  h.advance(1);
  check(h.displayed().battle.visualEvent.id, "attack", "attack begins after the complete dice");
  check(h.displayed().enemy.currentHp, 90, "queued attack snapshot is immutable");
  check(h.displayed().battle.canControl, false, "gaining authority does not unlock old replay");
  h.advance(1419);
  check(h.displayed().battle.visualEvent.id, "attack", "attack retains full duration and effect tail");
  h.advance(1);
  check(h.displayed() === ownNextTurn, true, "queue drain restores the latest authoritative view");
  check(h.playback.status().active, false, "commands may unlock only after replay drain");
}

// Frame readiness can deliver buffered A/B while the parent has already reached
// C. Each supplied entry must be accepted before the authoritative catch-up.
{
  const h = harness();
  const newest = view("C", "prepare", 520);
  h.select(newest, view("A", "prepare", 520));
  h.select(newest, view("B", "prepare", 520));
  h.select(newest);
  check(h.displayed().battle.visualEvent.id, "A", "buffered batch starts with A");
  check(h.playback.status().pending, 2, "buffered batch preserves both B and C");
  h.advance(520);
  check(h.displayed().battle.visualEvent.id, "B", "authoritative C cannot overtake buffered B");
  h.advance(520);
  check(h.displayed().battle.visualEvent.id, "C", "authoritative C follows buffered A and B");
  h.advance(520);
  check(h.playback.status().active, false, "buffered batch completes without duplicate replay");
}

// A terminal snapshot cannot clear an attack before its effect finishes.
{
  const h = harness();
  h.select(view("last", "attack", 1850));
  check(h.select(null).battle.visualEvent.id, "last", "terminal null preserves current animation");
  h.advance(2269);
  check(h.playback.status().active, true, "terminal view still waits for the final effect");
  h.advance(1);
  check(h.displayed(), null, "terminal null applies after playback finishes");
}

// Consecutive actors/battle rounds use their own snapshots, never mixed cards.
{
  const h = harness();
  h.select(view("first", "prepare", 520, false, "one", 1));
  h.select(view("second", "prepare", 520, false, "two", 2));
  check(h.displayed().player.id, "one", "actor replacement waits for previous view");
  h.advance(520);
  check(h.displayed().player.id, "two", "new actor uses its captured player");
  check(h.displayed().battle.roundIndex, 2, "new round stays paired to captured event");
  h.playback.reset();
  check(h.timers(), 0, "disconnect/pagehide reset cancels replay timer");
  check(h.playback.status().active, false, "reset removes active and pending views");
  h.select(view("second", "prepare", 520, false, "two", 2));
  check(h.playback.status().active, false, "reconnect full-state restore does not replay a discarded event");
}

// Production command gates reject an old snapshot throughout replay.
{
  const h = harness();
  h.select(view("remote-action"));
  let sent = 0;
  const context = {
    spectatorBattlePlayback: h.playback,
    latestView: { battle: { canControl: true, lineageExtraction: { canControl: true } } },
    showStatus() {},
    controller() { return { extract() { sent += 1; } }; },
  };
  vm.createContext(context);
  vm.runInContext(`${productionFunction("viewerCanControlBattle", "viewerBattleLockMessage")}\n${productionFunction("callLineageExtractionAction", "restoreLineageExtractionEnemyCard")}`, context);
  check(context.viewerCanControlBattle(), false, "battle controls check active replay");
  check(context.callLineageExtractionAction("extract", "extract", [], {}), false, "extraction cannot use stale replay authority");
  check(sent, 0, "no stale extraction action reaches controller");
}

// Exercise production refresh against the production scheduler, including the
// coop follow helper that previously replaced supplied snapshots with live API.
{
  const h = harness();
  let authoritative = view("newer");
  let parentHasBufferedViews = true;
  let presentationReady = false;
  let renderedId = "";
  let followedLiveApi = false;
  const context = {
    spectatorBattlePlayback: h.playback,
    selectedCoopViewPlayerId: "", latestView: null, currentMode: null,
    lastBattleIdentity: "", lastCoopCommandPlayerId: "",
    controller: () => ({
      getBattleView: () => authoritative,
      hasPendingRemoteBattleViews: () => parentHasBufferedViews,
      isBattlePresentationReady: () => presentationReady,
    }),
    readSnapshotView: () => null,
    followCurrentCoopActor(current, api) { followedLiveApi = !!api; return api?.getBattleView() || current; },
    handleVisualEvent(current) { renderedId = current.battle.visualEvent.id; },
  };
  for (const name of ["resetBattleSessionVisualState", "applyBattleBackground", "renderHud", "renderCards", "renderPostgameMechanic", "syncPrebattleIntro", "syncZephyrExplosionStory", "syncTotMusicaPersistentStage", "inferPortraitEventsFromLog", "renderPanel", "refreshLineageExtraction", "renderClosedPanel"]) context[name] = () => {};
  vm.createContext(context);
  vm.runInContext(productionFunction("refresh", "bindActions"), context);
  context.refresh();
  check(renderedId, "", "initial iframe refresh waits for parent's buffered stream");
  parentHasBufferedViews = false;
  context.refresh();
  check(h.playback.status().active, false, "hidden spectator fallback does not start its playback timer");
  context.refresh(view("earlier", "dice", 1200));
  check(renderedId, "", "hidden supplied spectator view waits for visible presentation");
  presentationReady = true;
  context.refresh(view("earlier", "dice", 1200));
  check(renderedId, "earlier", "production refresh renders the supplied event first");
  check(h.playback.status().active, true, "visible spectator starts full local playback duration");
  check(followedLiveApi, false, "coop actor following cannot jump to latest API during replay");
  parentHasBufferedViews = false;
  authoritative = null;
  context.refresh();
  check(renderedId, "earlier", "production refresh retains replay when authoritative battle closes");
  h.playback.reset();
  authoritative = view("local-active", "attack", 1000, true);
  presentationReady = false;
  context.refresh();
  check(renderedId, "local-active", "local actor refresh is not blocked by presentation readiness");
  check(h.playback.status().active, false, "local actor still avoids spectator playback");
}

console.log(JSON.stringify({ ok: true, checks }, null, 2));
