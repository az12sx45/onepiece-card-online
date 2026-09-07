"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const guardSource = fs.readFileSync(path.join(root, "public/chess/battle-texture-load-guard-v1.js"), "utf8");
const runtimeSource = fs.readFileSync(path.join(root, "public/chess/battle-room-runtime-v1.js"), "utf8");
const loaderSource = fs.readFileSync(path.join(root, "public/chess/battle-game-loader-v1.js"), "utf8");

const textureKeys = new Set(["board-key", "usopp-pawn:stand:back"]);
const textureSources = new Map();
let fetchCount = 0;
let bitmapClosed = false;
let fen = "after-e4";
const history = ["e4"];
let transientDestroyed = false;
let killAllCalled = false;
let domEffectsCleared = 0;

const camera = {
  zoom:1,
  scrollX:0,
  scrollY:0,
  rotation:0,
  alpha:1,
  resetFX() {},
  setZoom(value) { this.zoom = value; return this; },
  setScroll(x, y) { this.scrollX = x; this.scrollY = y; return this; },
  setRotation(value) { this.rotation = value; return this; },
  setAlpha(value) { this.alpha = value; return this; },
};
const boardImage = {
  visible:true,
  textureKey:"board-key",
  setTexture(value) { this.textureKey = value; return this; },
  setPosition() { return this; },
  setScale() { return this; },
  setRotation() { return this; },
  setAlpha() { return this; },
  setVisible(value) { this.visible = value; return this; },
  setDepth() { return this; },
  setData() { return this; },
};
const children = { list:[boardImage] };
const scene = {
  __battleTextureLoadGuardInstalled:false,
  textureLoads:new Map(),
  textures:{
    exists:(key) => textureKeys.has(key),
    addImage:(key, source) => { textureKeys.add(key); textureSources.set(key, source); },
  },
  loadTextureFromImage() { return Promise.reject(new Error("original loader must be replaced")); },
  async performMove() {
    this.locked = true;
    this.animationPhase = "faceoff";
    this.boardImage.setVisible(false);
    this.cameras.main.setZoom(2);
    fen = "after-e5";
    history.push("e5");
    this.lastMove = { from:"e7", to:"e5", san:"e5", captured:false };
    const transient = { destroy() { transientDestroyed = true; } };
    this.children.list.push(transient);
    throw new Error("simulated_animation_failure");
  },
  chess:{
    fen:() => fen,
    history:() => [...history],
    undo:() => {
      if (history.length <= 1) return null;
      history.pop();
      fen = "after-e4";
      return { from:"e7", to:"e5", san:"e5" };
    },
  },
  lastMove:{ from:"e2", to:"e4", san:"e4", captured:false },
  children,
  cameras:{ main:camera },
  battlefieldThemes:{ flagship:{ boardKey:"board-key" } },
  battlefieldId:"flagship",
  defaultBattlefieldId:"flagship",
  boardImage,
  backgroundImage:{ setVisible() {} },
  pieces:new Map(),
  tweens:{
    killAll() { killAllCalled = true; },
    killTweensOf() {},
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
  AbortController,
  Error,
  Date,
  Map,
  Promise,
  Set,
  queueMicrotask,
  fetch:async () => {
    fetchCount += 1;
    return { ok:true, status:200, blob:async () => ({ size:67154, type:"image/webp" }) };
  },
  createImageBitmap:async () => ({ width:1024, height:1024, close() { bitmapClosed = true; } }),
  document:{
    createElement:(name) => {
      assert.equal(name, "canvas");
      return {
        width:0,
        height:0,
        getContext:() => ({ clearRect() {}, drawImage() {} }),
      };
    },
    getElementById:(id) => id === "battle-effects-stage" ? {
      querySelectorAll:(selector) => selector.includes("battle-rengoku-afterimage")
        ? [{ hidden:false }]
        : [{ classList:{ remove() { domEffectsCleared += 1; } } }],
    } : null,
  },
  window:{
    __BATTLE_CHESS__:{ game:{ scene:{ getScene:() => scene, scenes:[scene] } } },
    localStorage:{ getItem:(key) => key === "op_desktop_launcher" ? "1" : null },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  },
});
context.window.window = context.window;
vm.runInContext(guardSource, context, { filename:"battle-texture-load-guard-v1.js" });

(async () => {
  assert.equal(context.window.__BATTLE_TEXTURE_GUARD__.getState().installed, true);
  await scene.loadTextureFromImage({ key:"walk:1", url:"/images/chess/walk/frame-01.webp" });
  assert.equal(fetchCount, 1);
  assert.equal(textureKeys.has("walk:1"), true);
  assert.equal(textureSources.get("walk:1").width, 1024);
  assert.equal(bitmapClosed, true);
  assert.equal(scene.textureLoads.size, 0);
  assert.equal(context.window.__BATTLE_TEXTURE_GUARD__.getState().bitmapLoadCount, 1);

  await assert.rejects(scene.performMove({ from:"e2", to:"e4", promotion:"q" }, "q"), /simulated_animation_failure/);
  assert.equal(fen, "after-e4", "failed animation must undo only the aborted move");
  assert.deepEqual(history, ["e4"], "rollback must preserve earlier chess history");
  assert.equal(scene.lastMove.san, "e4", "rollback must restore the preceding last move");
  assert.equal(scene.locked, false);
  assert.equal(scene.animationPhase, "idle");
  assert.equal(scene.boardImage.visible, true);
  assert.equal(scene.boardImage.textureKey, "board-key");
  assert.equal(scene.cameras.main.zoom, 1);
  assert.equal(transientDestroyed, true);
  assert.equal(killAllCalled, true);
  assert.equal(domEffectsCleared, 1);
  assert.equal(context.window.__BATTLE_TEXTURE_GUARD__.getState().recoveryCount, 1);

  assert.doesNotMatch(guardSource, /this\.chess\.move\s*\(/, "guard must not skip animations by committing the move itself");
  assert.doesNotMatch(guardSource, /scene\.chess\.load\s*\(/, "guard must not erase prior chess history while recovering");
  assert.doesNotMatch(guardSource, /walk-fallback/, "guard must not replace walk animation frames with standing art");
  assert.match(guardSource, /scene\.tweens\?\.killAll\?\.\(\)/, "guard must stop every unfinished animation tween before restoring the scene");
  assert.match(loaderSource, /battle-texture-load-guard-v1\.js\?v=desktop-bitmap-loader-v2-20260907/);
  assert.match(loaderSource, /battle-room-runtime-v1\.js\?v=cpu-move-recovery-v2-20260907/);
  assert.match(runtimeSource, /finally\s*\{\s*runtime\.cpuThinking = false;/);
  assert.match(runtimeSource, /finally\s*\{\s*runtime\.applyingRemote = false;/);
  assert.match(runtimeSource, /void driveCpu\(snapshot\)\.catch/);
  console.log(JSON.stringify({
    ok:true,
    desktopBitmapLoader:true,
    animationFailureDoesNotCommit:true,
    previousHistoryPreserved:true,
    boardAndCameraRestored:true,
    runtimeFinallyGuards:true,
  }));
  console.log("CHESS_CPU_MOVE_RECOVERY_QA=PASS");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
