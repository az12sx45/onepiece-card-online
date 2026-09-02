"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const scriptPaths = [
  path.join(publicDir, "js", "bgm_metadata.js"),
  path.join(publicDir, "js", "choose_bgm.js"),
  path.join(publicDir, "js", "bgm_manager.js"),
];

class FakeClock {
  constructor() {
    this.now = 100000;
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delay = 0) {
    const id = this.nextId++;
    this.tasks.set(id, { id, at: this.now + Math.max(0, Number(delay || 0)), callback });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  async advance(ms) {
    const target = this.now + Math.max(0, Number(ms || 0));
    while (true) {
      const task = [...this.tasks.values()]
        .filter((entry) => entry.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!task) break;
      this.tasks.delete(task.id);
      this.now = task.at;
      task.callback();
      await flushMicrotasks();
    }
    this.now = target;
    await flushMicrotasks();
  }
}

async function flushMicrotasks(rounds = 8) {
  for (let index = 0; index < rounds; index += 1) await Promise.resolve();
}

function createSandbox() {
  const clock = new FakeClock();
  const eventHandlers = new Map();
  const storageWrites = [];
  const storage = new Map([
    ["board_bgm_enabled", "1"],
    ["board_bgm_volume", "0.34"],
  ]);
  const playModes = [];

  class FakeAudio {
    static instances = [];

    constructor() {
      this.src = "";
      this.preload = "";
      this.loop = false;
      this.volume = 0;
      this.currentTime = 0;
      this.duration = 600;
      this.readyState = 4;
      this.paused = true;
      this.playCalls = 0;
      this.pauseCalls = 0;
      this.loadCalls = 0;
      this.removedSrc = false;
      this.listeners = new Map();
      this.playMode = playModes.shift() || "resolve";
      FakeAudio.instances.push(this);
    }

    addEventListener(type, callback) {
      if (!this.listeners.has(type)) this.listeners.set(type, new Set());
      this.listeners.get(type).add(callback);
    }

    removeEventListener(type, callback) {
      this.listeners.get(type)?.delete(callback);
    }

    dispatch(type) {
      [...(this.listeners.get(type) || [])].forEach((callback) => callback({ type, target: this }));
    }

    play() {
      this.playCalls += 1;
      if (this.playMode === "reject") return Promise.reject(new Error("autoplay rejected"));
      this.paused = false;
      return Promise.resolve();
    }

    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    }

    load() {
      this.loadCalls += 1;
    }

    removeAttribute(name) {
      if (name === "src") {
        this.src = "";
        this.removedSrc = true;
      }
    }
  }

  function FakeDate(...args) {
    return args.length ? new Date(...args) : new Date(clock.now);
  }
  FakeDate.now = () => clock.now;
  FakeDate.parse = Date.parse;
  FakeDate.UTC = Date.UTC;
  FakeDate.prototype = Date.prototype;

  const sandbox = {
    console,
    Audio: FakeAudio,
    Date: FakeDate,
    performance: { now: () => clock.now },
    setTimeout: (callback, delay) => clock.setTimeout(callback, delay),
    clearTimeout: (id) => clock.clearTimeout(id),
    requestAnimationFrame: (callback) => clock.setTimeout(() => callback(clock.now), 16),
    cancelAnimationFrame: (id) => clock.clearTimeout(id),
    localStorage: {
      getItem: (key) => storage.has(key) ? storage.get(key) : null,
      setItem: (key, value) => {
        storage.set(key, String(value));
        storageWrites.push(String(key));
      },
    },
    addEventListener(type, callback) {
      if (!eventHandlers.has(type)) eventHandlers.set(type, new Set());
      eventHandlers.get(type).add(callback);
    },
    removeEventListener(type, callback) {
      eventHandlers.get(type)?.delete(callback);
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.parent = sandbox;
  vm.createContext(sandbox);
  scriptPaths.forEach((file) => vm.runInContext(fs.readFileSync(file, "utf8"), sandbox, { filename: file }));
  return {
    sandbox,
    clock,
    FakeAudio,
    playModes,
    storageWrites,
    dispatch(type) {
      [...(eventHandlers.get(type) || [])].forEach((callback) => callback({ type }));
    },
  };
}

function preferred(id, phase = "map", scope = `scope:${id}`) {
  return {
    phase,
    musicScope: scope,
    sceneType: `qa:${id}`,
    preferredBgmIds: [id],
  };
}

async function startTrack(env, id, phase = "map", scope = `scope:${id}`) {
  env.sandbox.BgmManager.chooseAndPlay(preferred(id, phase, scope), { transition: "immediate", fadeMs: 0 });
  env.dispatch("pointerdown");
  await flushMicrotasks();
  return env.FakeAudio.instances.at(-1);
}

async function testMetadataAndChooser() {
  const env = createSandbox();
  const metadata = env.sandbox.BGM_METADATA;
  assert.strictEqual(metadata.length, 56, "OST metadata must contain 56 tracks");
  assert.strictEqual(new Set(metadata.map((entry) => entry.id)).size, 56, "BGM ids must be unique");
  assert.strictEqual(new Set(metadata.map((entry) => entry.filename)).size, 56, "BGM filenames must be unique");
  metadata.forEach((entry) => {
    const file = path.join(publicDir, "audio", "board_game", "bgm_new", entry.filename);
    assert.ok(fs.statSync(file).size > 0, `missing BGM asset: ${entry.filename}`);
    assert.ok(Number.isFinite(entry.cueInSec) && Number.isFinite(entry.cueOutSec) && Number.isFinite(entry.gainDb), `${entry.id} tuning must be finite`);
    assert.ok(entry.cueOutSec > entry.cueInSec, `${entry.id} cue-out must follow cue-in`);
    assert.ok(entry.gainDb >= -4 && entry.gainDb <= 6, `${entry.id} gain must stay clamped`);
  });
  assert.strictEqual(metadata.find((entry) => entry.id === "more_and_more").loop, false);
  assert.ok(metadata.find((entry) => entry.id === "grand_line_cold_island").cueInSec >= 6);

  const explicit = env.sandbox.chooseBgm({ phase: "map", preferredBgmIds: ["message_from_uunan", "to_the_ocean"] });
  assert.strictEqual(explicit.id, "message_from_uunan", "first explicit scene cue must win even across phases");
  assert.ok(Number.isFinite(explicit.cueInSec) && Number.isFinite(explicit.cueOutSec) && Number.isFinite(explicit.gainDb));
  const continuous = env.sandbox.chooseBgm({
    phase: "map",
    sceneType: "sailing",
    environment: ["ocean"],
    preferredBgmIds: ["to_the_ocean", "to_the_grand_line"],
    lastPlayedBgmId: "to_the_ocean",
    recentlyPlayedIds: ["to_the_ocean"],
  });
  assert.strictEqual(continuous.id, "to_the_ocean", "current suitable cue must not be forced away");
  const retuned = env.sandbox.chooseBgm({
    phase: "map",
    preferredBgmIds: ["to_the_ocean", "to_the_grand_line"],
    lastPlayedBgmId: "to_the_ocean",
    forceRetune: true,
  });
  assert.notStrictEqual(retuned.id, "to_the_ocean", "only explicit forceRetune may exclude the current cue");

  const tesoroIntro = env.sandbox.chooseBgm({
    phase: "battle_intro",
    sceneType: "postgame_boss_island",
    isBoss: true,
    preferredBgmIds: ["gold_uunan", "angry", "shinkenshoubu"],
  });
  const tesoroBattle = env.sandbox.chooseBgm({
    phase: "battle_intro",
    sceneType: "battle",
    isBoss: true,
    preferredBgmIds: ["gold_uunan", "angry", "shinkenshoubu"],
    lastPlayedBgmId: tesoroIntro.id,
    recentlyPlayedIds: [tesoroIntro.id],
  });
  assert.strictEqual(tesoroIntro.id, "gold_uunan");
  assert.strictEqual(tesoroBattle.id, tesoroIntro.id, "boss encounter and battle must keep the same opening cue");
}

async function testLatestUnlockAndSameTrack() {
  const env = createSandbox();
  env.sandbox.BgmManager.chooseAndPlay(preferred("to_the_ocean", "map", "map"), { transition: "immediate", fadeMs: 0 });
  env.sandbox.BgmManager.chooseAndPlay(preferred("oden_store", "shop", "shop"), { transition: "immediate", fadeMs: 0 });
  env.sandbox.BgmManager.chooseAndPlay(preferred("fight_continues", "battle_intro", "battle:1"), { transition: "immediate", fadeMs: 0 });
  assert.strictEqual(env.FakeAudio.instances.length, 0, "locked autoplay must not allocate stale audio");
  env.dispatch("pointerdown");
  await flushMicrotasks();
  assert.strictEqual(env.FakeAudio.instances.length, 1);
  assert.strictEqual(env.sandbox.BgmManager.status().currentChoice.id, "fight_continues");

  const audio = env.FakeAudio.instances[0];
  audio.currentTime = 88;
  env.sandbox.BgmManager.chooseAndPlay(preferred("fight_continues", "battle_loop", "battle:1"), { transition: "immediate", fadeMs: 0 });
  await flushMicrotasks();
  assert.strictEqual(env.FakeAudio.instances.length, 1, "same cue must reuse its Audio instance");
  assert.strictEqual(audio.currentTime, 88, "same cue must not restart");
}

async function testDeferredCancellation() {
  const env = createSandbox();
  await startTrack(env, "to_the_ocean", "map", "map");
  env.sandbox.BgmManager.chooseAndPlay(preferred("oden_store", "shop", "shop"), { transition: "defer", transitionDelayMs: 9000, fadeMs: 0 });
  await env.clock.advance(8999);
  assert.strictEqual(env.FakeAudio.instances.length, 1, "short service overlay must not cut map music");
  env.sandbox.BgmManager.chooseAndPlay(preferred("to_the_ocean", "map", "map"), { transition: "immediate", fadeMs: 0 });
  await env.clock.advance(10000);
  assert.strictEqual(env.FakeAudio.instances.length, 1, "canceled service timer must not revive later");
}

async function testFailureAndCueLoop() {
  const env = createSandbox();
  const oldAudio = await startTrack(env, "to_the_ocean", "map", "map");
  env.playModes.push("reject");
  env.sandbox.BgmManager.chooseAndPlay(preferred("oden_store", "shop", "shop"), { transition: "immediate", fadeMs: 0 });
  await flushMicrotasks();
  const failedAudio = env.FakeAudio.instances.at(-1);
  assert.strictEqual(env.sandbox.BgmManager.status().currentChoice.id, "to_the_ocean", "failed replacement must keep old current cue");
  assert.strictEqual(oldAudio.paused, false, "failed replacement must not pause old cue");
  assert.ok(failedAudio.removedSrc && failedAudio.pauseCalls > 0, "failed Audio must be cleaned");

  env.dispatch("pointerdown");
  env.sandbox.BgmManager.chooseAndPlay(preferred("grand_line_cold_island", "map", "cold"), { transition: "immediate", fadeMs: 0 });
  await flushMicrotasks();
  const coldAudio = env.FakeAudio.instances.at(-1);
  assert.ok(Math.abs(coldAudio.currentTime - 6.1) < 0.001, "cue-in must skip cold-track silence");
  coldAudio.currentTime = 230.8;
  coldAudio.dispatch("timeupdate");
  await env.clock.advance(1200);
  assert.ok(Math.abs(coldAudio.currentTime - 6.1) < 0.001, "loop must fade across the silent tail and return to cue-in");
  assert.ok(coldAudio.volume > 0, "loop fade must restore the gain-aware target volume");
}

async function testAudioFocus() {
  const env = createSandbox();
  const audio = await startTrack(env, "to_the_ocean", "map", "map");
  const focus = env.sandbox.BgmManager.acquireAudioFocus("qa-video", { volumeRatio: 0.1, fadeOutMs: 0, fadeInMs: 0 });
  const expectedDuck = Math.min(1, 0.34 * Math.pow(10, -1.18 / 20) * 0.1);
  assert.ok(Math.abs(audio.volume - expectedDuck) < 0.001, "focus must apply gain-aware ducking");
  env.sandbox.BgmManager.chooseAndPlay(preferred("fight_continues", "battle_intro", "battle:2"), { force: true, fadeMs: 0 });
  await flushMicrotasks();
  assert.strictEqual(env.FakeAudio.instances.length, 1, "legacy force must not bypass media focus");
  focus.release();
  await flushMicrotasks();
  assert.strictEqual(env.sandbox.BgmManager.status().currentChoice.id, "fight_continues", "latest queued scene must play after focus release");
  focus.release();
  assert.strictEqual(env.sandbox.BgmManager.status().audioFocusCount, 0, "focus release must be idempotent");
}

function testStaticWiring() {
  const board = fs.readFileSync(path.join(publicDir, "js", "board_game.js"), "utf8");
  const battle = fs.readFileSync(path.join(publicDir, "js", "board_battle.js"), "utf8");
  const marineford = fs.readFileSync(path.join(publicDir, "board_marineford.html"), "utf8");
  const metadata = fs.readFileSync(path.join(publicDir, "js", "bgm_metadata.js"), "utf8");
  assert.match(board, /function startFinalEndingCinematicSession[\s\S]*?playBgmForContext\(bgmStoryContext\(ending, player\)/);
  assert.match(board, /function openImpelDownWindow[\s\S]*?sceneType:\s*"impel_down"/);
  assert.match(board, /function openMarinefordWindow[\s\S]*?sceneType:\s*"marineford"/);
  assert.match(board, /musicScope:\s*"board-map"/);
  const bossProfileSource = board.match(/const BOARD_BOSS_BGM_PROFILES = Object\.freeze\(\{([\s\S]*?)\n\s*\}\);/)?.[1] || "";
  assert.ok(bossProfileSource, "boss BGM profile table must be present");
  [
    "postgame_shiki",
    "postgame_gild_tesoro",
    "postgame_zephyr",
    "postgame_tot_musica",
    "postgame_douglas_bullet",
    "postgame_saga",
    "postgame_vinsmoke_judge",
    "postgame_rob_lucci_awakened",
    "postgame_king",
    "postgame_charlotte_katakuri",
    "postgame_patrick_redfield",
    "postgame_oars",
    "postgame_aramaki",
    "postgame_rocks",
    "postgame_loki",
    "final_imu",
  ].forEach((bossKey) => {
    assert.match(bossProfileSource, new RegExp(`(?:^|\\n)\\s*${bossKey}\\s*:`), `${bossKey} must have a BGM profile`);
  });
  const knownTrackIds = new Set([...metadata.matchAll(/\bid:\s*"([^"]+)"/g)].map((match) => match[1]));
  const bossTrackIds = [...bossProfileSource.matchAll(/:\s*\[([^\]]+)\]/g)]
    .flatMap((match) => [...match[1].matchAll(/"([^"]+)"/g)].map((idMatch) => idMatch[1]));
  assert.ok(bossTrackIds.length > 0, "boss BGM profiles must contain track ids");
  bossTrackIds.forEach((trackId) => assert.ok(knownTrackIds.has(trackId), `unknown boss BGM track id: ${trackId}`));
  assert.match(board, /function bgmScenePreferredIds[\s\S]*?BOARD_BOSS_BGM_PROFILES\[enemyMusicKey\]/, "pre-battle routing must reuse the boss profile");
  assert.doesNotMatch(board, /\["enemy_island", "postgame_boss_island", "postgame_rocks_final"\][\s\S]{0,220}\["erudrago_appears"/, "pre-battle routing must not insert a throwaway intro cue");
  assert.match(board, /BOARD_BOSS_BGM_PROFILES\[enemyMusicKey\]/, "battle routing must consume the boss BGM profiles");
  assert.match(battle, /katakuriFutureSightBgmFocus[\s\S]*?acquireAudioFocus/);
  assert.match(marineford, /marineford-conqueror-video[\s\S]*?releaseBgmFocus/);
}

async function main() {
  await testMetadataAndChooser();
  await testLatestUnlockAndSameTrack();
  await testDeferredCancellation();
  await testFailureAndCueLoop();
  await testAudioFocus();
  testStaticWiring();
  console.log("board_bgm_continuity_qa: PASS");
}

main().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
