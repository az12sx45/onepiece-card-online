"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const guardSource = fs.readFileSync(path.join(root, "public/chess/battle-texture-load-guard-v1.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "public/chess/battle-room-runtime-v1.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(root, "public/chess/battle-game-loader-v1.js"), "utf8");

const listeners = new WeakMap();
class HangingImage {
  constructor() {
    this.complete = false;
    this.naturalWidth = 0;
    listeners.set(this, new Map());
  }
  addEventListener(name, callback) { listeners.get(this).set(name, callback); }
  removeEventListener(name) { listeners.get(this).delete(name); }
  set src(_value) { /* Simulates an opcache image request that never settles. */ }
}

const textureKeys = new Set(["usopp-pawn:stand:back"]);
let fen = "start";
const scene = {
  __battleTextureLoadGuardInstalled:false,
  textureLoads:new Map(),
  textures:{
    exists:(key) => textureKeys.has(key),
    addImage:(key) => textureKeys.add(key),
  },
  loadTextureFromImage() { return Promise.reject(new Error("original loader must be replaced")); },
  ensureCharacterTexture() { return Promise.resolve(); },
  async ensureCharacterWalkFrames(character, direction) {
    const frames = [1, 2, 3].map((frame) => ({ key:`walk:${frame}`, url:`opcache://asset/${direction}/${frame}` }));
    await Promise.all(frames.map((frame) => this.loadTextureFromImage(frame)));
    return frames;
  },
  async performMove() {
    this.locked = true;
    this.animationPhase = "faceoff";
    throw new Error("simulated_animation_failure");
  },
  chess:{
    get:(square) => square === "e2" && fen === "start" ? { type:"p" } : null,
    move:({ from, to }) => {
      fen = "moved";
      return { from, to, san:"e4", captured:null };
    },
  },
  locked:false,
  animationPhase:"idle",
  activeAnimation:null,
  animationFrame:0,
  activeHitSquare:null,
  hitDirection:null,
  rebuildCellMap() {},
  renderPosition() {},
  clearLegalHover() {},
  clearPieceSelectionIndicator() {},
  publish() {},
};

const context = vm.createContext({
  console,
  Error,
  Date,
  Map,
  Promise,
  queueMicrotask,
  document:{ createElement:(name) => {
    assert.equal(name, "img");
    return new HangingImage();
  } },
  window:{
    __BATTLE_CHESS__:{ game:{ scene:{ getScene:() => scene, scenes:[scene] } } },
    setTimeout:(callback, delay) => setTimeout(callback, Math.min(delay, 15)),
    clearTimeout,
  },
});
context.window.window = context.window;
vm.runInContext(guardSource, context, { filename:"battle-texture-load-guard-v1.js" });

(async () => {
  assert.equal(context.window.__BATTLE_TEXTURE_GUARD__.getState().installed, true);
  const frames = await scene.ensureCharacterWalkFrames({ id:"usopp-pawn" }, "back");
  assert.equal(JSON.stringify(frames.map((frame) => frame.key)), JSON.stringify(Array(3).fill("usopp-pawn:stand:back")));
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.equal(scene.textureLoads.size, 0);
  assert.equal(context.window.__BATTLE_TEXTURE_GUARD__.getState().fallbackCount, 1);

  await scene.performMove({ from:"e2", to:"e4", promotion:"q" }, "q");
  assert.equal(fen, "moved");
  assert.equal(scene.locked, false);
  assert.equal(scene.animationPhase, "idle");
  assert.equal(scene.lastMove.san, "e4");
  assert.equal(context.window.__BATTLE_TEXTURE_GUARD__.getState().recoveryCount, 1);

  assert.match(loaderSource, /battle-texture-load-guard-v1\.js\?v=cpu-image-timeout-v1-20260907/);
  assert.match(runtimeSource, /finally\s*\{\s*runtime\.cpuThinking = false;/);
  assert.match(runtimeSource, /finally\s*\{\s*runtime\.applyingRemote = false;/);
  assert.match(runtimeSource, /void driveCpu\(snapshot\)\.catch/);
  console.log(JSON.stringify({
    ok:true,
    hangingImageFallback:true,
    moveRecovery:true,
    runtimeFinallyGuards:true,
  }));
  console.log("CHESS_CPU_MOVE_RECOVERY_QA=PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
