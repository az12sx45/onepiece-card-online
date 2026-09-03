"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const GAME_PATH = path.join(ROOT, "public", "game.html");
const CSS_PATH = path.join(ROOT, "public", "css", "card-tailwind-v1.min.css");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function extractFunction(source, name) {
  const marker = `function ${name}(`;
  const start = source.indexOf(marker);
  assert(start >= 0, `missing ${name}()`);
  const brace = source.indexOf("{", start + marker.length);
  assert(brace >= 0, `missing ${name}() body`);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "'" || char === '"' || char === "`") {
      quote = char;
      continue;
    }
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unterminated ${name}()`);
}

function fakeClassList() {
  const values = new Set(["hidden"]);
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    remove: (...names) => names.forEach((name) => values.delete(name)),
    contains: (name) => values.has(name)
  };
}

async function settlePromises() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise((resolve) => setImmediate(resolve));
}

async function exerciseDraw(functionSource, syncPendingSource, rejectFirstPlay) {
  const timers = new Map();
  const listeners = new Map();
  let timerId = 0;
  let playCount = 0;
  let drawCount = 0;
  const overlay = {
    classList: fakeClassList(),
    addEventListener: (type, handler) => listeners.set(`overlay:${type}`, handler),
    removeEventListener: (type, handler) => {
      if (listeners.get(`overlay:${type}`) === handler) listeners.delete(`overlay:${type}`);
    }
  };
  const video = {
    currentTime: 0,
    duration: 0.01,
    muted: false,
    volume: 1,
    pause() {},
    play() {
      playCount += 1;
      if (rejectFirstPlay && playCount === 1) return Promise.reject(new Error("autoplay blocked"));
      return Promise.resolve();
    },
    addEventListener: (type, handler) => listeners.set(`video:${type}`, handler),
    removeEventListener: (type, handler) => {
      if (listeners.get(`video:${type}`) === handler) listeners.delete(`video:${type}`);
    }
  };
  const context = vm.createContext({
    document: {
      getElementById(id) {
        if (id === "drawOverlay") return overlay;
        if (id === "drawVideo") return video;
        return null;
      }
    },
    sendAction(type) {
      if (type === "DRAW") drawCount += 1;
    },
    setTimeout(handler) {
      timerId += 1;
      timers.set(timerId, handler);
      return timerId;
    },
    clearTimeout(id) {
      timers.delete(id);
    },
    Number,
    Promise
  });
  vm.runInContext(`
    let me = { playerId: 0 };
    let state = { roundNo: 1, turnIndex: 0, turnStep: "draw", deck: [0, 1, 2], players: [{ skipNext: false }] };
    let _drawPlaying = false;
    let _drawActionPending = null;
    ${syncPendingSource}
    ${functionSource}
  `, context);
  context.playDrawFxThenDraw();
  await settlePromises();

  const completion = rejectFirstPlay ? listeners.get("overlay:click") : listeners.get("video:ended");
  assert(typeof completion === "function", rejectFirstPlay ? "draw fallback click was not armed" : "draw ended handler was not armed");
  completion();
  for (const handler of [...timers.values()]) handler();
  await settlePromises();

  assert(drawCount === 1, `draw animation emitted DRAW ${drawCount} times`);
  assert(!listeners.has("video:ended"), "draw ended listener leaked after settlement");
  assert(!listeners.has("overlay:click"), "draw click listener leaked after settlement");

  // 完整結束後、伺服器 STATE 尚未前進時再次呼叫，也不能重播或再送 DRAW。
  const playCountAfterFirstSettlement = playCount;
  context.playDrawFxThenDraw();
  await settlePromises();
  assert(playCount === playCountAfterFirstSettlement, "draw animation replayed before authoritative STATE progressed");
  assert(drawCount === 1, `second completed draw call emitted DRAW ${drawCount} times`);
  assert(vm.runInContext("!!_drawActionPending", context), "draw action lock cleared before authoritative STATE progressed");

  // 相同 STATE 不得解鎖；turnStep / turn / deck 任一前進才可解鎖。
  context.syncDrawActionPendingFromState();
  assert(vm.runInContext("!!_drawActionPending", context), "unchanged STATE cleared draw action lock");
  vm.runInContext("state = { ...state, deck: state.deck.slice(0, -1) };", context);
  context.syncDrawActionPendingFromState();
  assert(!vm.runInContext("!!_drawActionPending", context), "progressed STATE did not clear draw action lock");

  // 權威狀態已離開 draw 時，即使舊 DOM 尚未在下一個 rAF 變成 disabled，也不能重播動畫或送指令。
  vm.runInContext("state = { ...state, turnStep: 'choose' };", context);
  const playCountAfterProgress = playCount;
  context.playDrawFxThenDraw();
  await settlePromises();
  assert(playCount === playCountAfterProgress, "stale draw button replayed after STATE left draw step");
  assert(drawCount === 1, `stale draw button emitted DRAW ${drawCount} times`);
}

function exerciseParalyzedAutoDraw(functionSource) {
  let drawCount = 0;
  const context = vm.createContext({
    sendAction(type) {
      if (type === "DRAW") drawCount += 1;
    }
  });
  vm.runInContext(`
    let state = {
      roundNo: 7,
      turnIndex: 0,
      turnStep: "draw",
      players: [{ skipNext: true }]
    };
    let me = { playerId: null };
    let _autoSkipKey = null;
    ${functionSource}
  `, context);

  // 不提供 requestAnimationFrame：STATE 先到時不送，JOINED 補上 playerId 後立即送。
  context.syncParalyzedAutoDraw();
  assert(drawCount === 0, "paralyzed auto draw ran before player identity was known");
  vm.runInContext("me.playerId = 0", context);
  context.syncParalyzedAutoDraw();
  context.syncParalyzedAutoDraw();
  assert(drawCount === 1, `same paralyzed round/turn emitted DRAW ${drawCount} times`);

  vm.runInContext("state = { ...state, turnStep: 'choose' };", context);
  context.syncParalyzedAutoDraw();
  assert(vm.runInContext("_autoSkipKey === null", context), "leaving paralyzed draw state did not clear its guard");
}

async function main() {
  const html = fs.readFileSync(GAME_PATH, "utf8");
  const css = fs.readFileSync(CSS_PATH, "utf8");

  assert(!html.includes("cdn.tailwindcss.com"), "runtime Tailwind CDN compiler is still loaded");
  assert(/<link[^>]+card-tailwind-v1\.min\.css/i.test(html), "compiled card Tailwind stylesheet is not linked");
  assert(css.length >= 10_000 && css.length <= 300_000, `compiled stylesheet size is suspicious: ${css.length}`);
  for (const selector of [".flex", ".grid", ".rounded-xl", ".text-amber-300"]) {
    assert(css.includes(selector), `compiled stylesheet is missing ${selector}`);
  }
  for (const selector of ["#modal.hidden", "#coinOverlay.hidden", "#playedOverlay.hidden", "#drawHint.hidden", "#chooseHint.hidden"]) {
    assert(html.includes(selector), `legacy component has no explicit hidden override: ${selector}`);
  }

  const drawSource = extractFunction(html, "playDrawFxThenDraw");
  const syncDrawPendingSource = extractFunction(html, "syncDrawActionPendingFromState");
  assert(/settled|finished/.test(drawSource), "draw animation has no single-settlement guard");
  assert(drawSource.includes("clearTimeout"), "draw animation does not cancel its failsafe timer");
  assert(drawSource.includes("removeEventListener"), "draw animation does not remove completion listeners");
  assert(drawSource.includes("_drawActionPending"), "draw action has no server-state pending guard");
  assert(drawSource.includes("canRequestDraw"), "draw action does not reject a stale enabled button after STATE progressed");
  assert(syncDrawPendingSource.includes("pending.sent"), "draw action can unlock before DRAW is sent");
  await exerciseDraw(drawSource, syncDrawPendingSource, false);
  await exerciseDraw(drawSource, syncDrawPendingSource, true);

  const autoSkipSource = extractFunction(html, "syncParalyzedAutoDraw");
  const renderSource = extractFunction(html, "render");
  assert(!autoSkipSource.includes("requestAnimationFrame"), "paralyzed auto draw still depends on animation frames");
  assert(!renderSource.includes("sendAction('DRAW')"), "render still performs the paralyzed DRAW side effect");
  exerciseParalyzedAutoDraw(autoSkipSource);

  const stateHandlerStart = html.indexOf("socket.on('STATE', (s)=>{");
  const stateHandlerEnd = html.indexOf("// === 決鬥動畫", stateHandlerStart);
  assert(stateHandlerStart >= 0 && stateHandlerEnd > stateHandlerStart, "STATE handler boundaries not found");
  const stateHandlerSource = html.slice(stateHandlerStart, stateHandlerEnd);
  assert(stateHandlerSource.includes("syncDrawActionPendingFromState();"), "STATE does not reconcile the draw action lock");
  assert(stateHandlerSource.includes("syncParalyzedAutoDraw();"), "STATE does not immediately process paralyzed auto draw");
  assert(stateHandlerSource.indexOf("syncParalyzedAutoDraw();") < stateHandlerSource.indexOf("scheduleRender();"), "paralyzed auto draw runs after render scheduling");
  const joinedHandlerSource = html.slice(html.indexOf("const socketOnJoined"), html.indexOf("socket.on('JOINED', socketOnJoined)"));
  assert(joinedHandlerSource.includes("syncParalyzedAutoDraw();"), "JOINED does not process a previously received paralyzed STATE");

  assert(/function\s+scheduleRender\s*\(/.test(html), "render coalescing scheduler is missing");
  assert(/socket\.on\('STATE',[\s\S]*?scheduleRender\(\);\s*\n\}\);/.test(html), "STATE does not use the render scheduler");
  assert(/if \(line\)[\s\S]*?scheduleRender\(\);/.test(html), "EMIT log updates do not use the render scheduler");
  assert((html.match(/el\.deckBtn\.disabled\s*=\s*!canDraw/g) || []).length === 1, "deck disabled update is duplicated");
  assert(!extractFunction(html, "cardImageURL").includes("back.png"), "duel fallback still decodes the oversized PNG card back");
  assert(/_prev\.deck\s*!==\s*left[\s\S]{0,180}onceFx/.test(html) || /onceFx[\s\S]{0,180}_prev\.deck\s*=\s*left/.test(html), "deck pulse is not guarded by a count change");

  console.log(`CARD_RUNTIME_PERFORMANCE_QA=PASS cssBytes=${Buffer.byteLength(css)} drawPaths=2 drawPending=PASS autoSkipImmediate=PASS renderScheduler=PASS`);
}

main().catch((error) => {
  console.error(`CARD_RUNTIME_PERFORMANCE_QA=FAIL ${error.message}`);
  process.exitCode = 1;
});
