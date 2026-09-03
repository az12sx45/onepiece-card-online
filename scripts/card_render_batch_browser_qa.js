"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const CHROME_PATH = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Q9ZrAAAAAElFTkSuQmCC", "base64");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function contentType(filePath) {
  return new Map([
    [".html", "text/html; charset=utf-8"],
    [".css", "text/css; charset=utf-8"],
    [".js", "application/javascript; charset=utf-8"]
  ]).get(path.extname(filePath).toLowerCase()) || "application/octet-stream";
}

function createStaticServer() {
  return http.createServer((request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://127.0.0.1").pathname).replace(/^\/+/, "");
    const filePath = path.resolve(PUBLIC_ROOT, pathname || "game.html");
    const relation = path.relative(PUBLIC_ROOT, filePath);
    if (!relation || relation === ".." || relation.startsWith(`..${path.sep}`) || path.isAbsolute(relation)) {
      response.writeHead(404).end();
      return;
    }
    try {
      const bytes = fs.readFileSync(filePath);
      response.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" });
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

async function main() {
  const server = createStaticServer();
  const port = await listen(server);
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true,
    args: ["--disable-background-networking"]
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.route("https://cdn.socket.io/**", (route) => route.fulfill({
      status: 200,
      contentType: "application/javascript",
      body: "/* socket client supplied by QA init script */"
    }));
    await page.route("**/*", async (route) => {
      const type = route.request().resourceType();
      if (type === "image") {
        await route.fulfill({ status: 200, contentType: "image/png", body: PIXEL });
        return;
      }
      if (type === "media") {
        await route.fulfill({ status: 204, body: "" });
        return;
      }
      await route.fallback();
    });
    await page.addInitScript(() => {
      const handlers = Object.create(null);
      const sent = [];
      const socket = {
        id: "card-render-qa",
        connected: true,
        on(type, handler) {
          (handlers[type] ||= []).push(handler);
          return this;
        },
        off(type, handler) {
          if (!handlers[type]) return this;
          handlers[type] = handlers[type].filter((candidate) => candidate !== handler);
          return this;
        },
        emit(_type, _payload, callback) {
          sent.push({ type: _type, payload: _payload });
          if (typeof callback === "function") callback(null, { ok: true });
          return this;
        },
        timeout() { return this; },
        connect() { return this; },
        disconnect() { this.connected = false; return this; }
      };
      window.io = () => socket;
      window.__CARD_RENDER_QA__ = {
        emit(type, payload) {
          for (const handler of handlers[type] || []) handler(payload);
        },
        actions() {
          return sent.map((entry) => structuredClone(entry));
        },
        clearActions() {
          sent.length = 0;
        }
      };
    });

    await page.goto(`http://127.0.0.1:${port}/game.html?room=PERFQA&name=QA&n=2`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => typeof window.render === "function" && typeof window.scheduleRender === "function");
    const result = await page.evaluate(async () => {
      const qa = window.__CARD_RENDER_QA__;
      const hiddenEntryElementIds = [
        "modal",
        "cardDexOverlay",
        "duelFx",
        "finalOverlay",
        "coinOverlay",
        "drawOverlay",
        "playedOverlay",
        "rewardModal",
        "rewardOverlay",
        "enhOverlay",
        "lawSwapModal",
        "luffyBoostModal",
        "idleWarning",
        "autoTakeoverBanner",
        "drawHint",
        "chooseHint"
      ];
      const exposedEntryElements = hiddenEntryElementIds.filter((id) => {
        const node = document.getElementById(id);
        return node && getComputedStyle(node).display !== "none";
      });
      qa.emit("JOINED", { playerId: 0, secret: "qa-secret" });
      const state = {
        roundNo: 1,
        deck: Array.from({ length: 30 }, (_, index) => index % 20),
        turnIndex: 0,
        turnStep: "draw",
        chestCoins: 100,
        venues: [{ name: "巴拉蒂" }],
        discard: [{ id: 3 }],
        myDeluxe: [],
        log: ["測試局開始"],
        players: [
          { id: 0, alive: true, gold: 10, hand: null, tempDraw: null, skipNext: false, client: { displayName: "QA1", avatar: 1 } },
          { id: 1, alive: true, gold: 10, hand: null, tempDraw: null, skipNext: false, isCPU: true, client: { displayName: "CPU", avatar: 2 } }
        ]
      };
      const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      qa.emit("STATE", structuredClone(state));
      await nextFrame();
      const modalVisibleAfterState = getComputedStyle(document.getElementById("modal")).display !== "none";

      const venueNode = document.querySelector("#venues .venue-card");
      const discardNode = document.querySelector("#discard img");
      const playerNode = document.querySelector("#players > div");
      const renderFrameBefore = window.eval("_renderFrame");
      window.__cardQaRenderCalls = 0;
      window.__cardQaOriginalRender = window.eval("render");
      window.eval("render = function(...args){ window.__cardQaRenderCalls += 1; return window.__cardQaOriginalRender(...args); }");
      qa.emit("EMIT", { type: "robin_view", targetId: 1, cardId: 3 });
      qa.emit("STATE", structuredClone({ ...state, log: [...state.log, "同步完成"] }));
      const renderFrameAfterEmit = window.eval("_renderFrame");
      await nextFrame();
      const batchedRenderCalls = window.__cardQaRenderCalls;
      const renderFrameAfterWait = window.eval("_renderFrame");
      const stableAfterLog = {
        venue: venueNode === document.querySelector("#venues .venue-card"),
        discard: discardNode === document.querySelector("#discard img"),
        player: playerNode === document.querySelector("#players > div")
      };

      window.__cardQaRenderCalls = 0;
      const changed = structuredClone(state);
      changed.players[0].gold = 11;
      qa.emit("STATE", changed);
      await nextFrame();
      const changedRenderCalls = window.__cardQaRenderCalls;
      const selectiveAfterPlayerChange = {
        venue: venueNode === document.querySelector("#venues .venue-card"),
        discard: discardNode === document.querySelector("#discard img"),
        playerChanged: playerNode !== document.querySelector("#players > div")
      };
      window.eval("render = window.__cardQaOriginalRender");

      // 模擬背景分頁：rAF callback 完全不執行。STATE 先到、JOINED 後仍須立即送一次麻痺 DRAW。
      const realRequestAnimationFrame = window.requestAnimationFrame;
      const heldFrames = [];
      window.eval("_renderFrame = 0; _autoSkipKey = null; me.playerId = null;");
      window.requestAnimationFrame = (callback) => {
        heldFrames.push(callback);
        return 10_000 + heldFrames.length;
      };
      qa.clearActions();
      const paralyzedState = structuredClone(changed);
      paralyzedState.roundNo = 8;
      paralyzedState.turnIndex = 0;
      paralyzedState.turnStep = "draw";
      paralyzedState.players[0].skipNext = true;
      qa.emit("STATE", paralyzedState);
      const countDrawActions = () => qa.actions().filter((entry) => (
        entry.type === "ACTION" && entry.payload?.type === "DRAW"
      )).length;
      const autoDrawBeforeJoin = countDrawActions();
      qa.emit("JOINED", { playerId: 0, secret: "qa-secret" });
      const autoDrawAfterJoin = countDrawActions();
      qa.emit("STATE", structuredClone(paralyzedState));
      const autoDrawAfterRepeatedState = countDrawActions();
      const heldFrameCount = heldFrames.length;
      window.requestAnimationFrame = realRequestAnimationFrame;
      window.eval("_renderFrame = 0;");

      return {
        batchedRenderCalls,
        changedRenderCalls,
        renderFrameBefore,
        renderFrameAfterEmit,
        renderFrameAfterWait,
        stableAfterLog,
        selectiveAfterPlayerChange,
        autoSkipWithoutFrame: {
          autoDrawBeforeJoin,
          autoDrawAfterJoin,
          autoDrawAfterRepeatedState,
          heldFrameCount
        },
        tailwindRuntimeScripts: [...document.scripts].filter((script) => /tailwindcss/i.test(script.src)).length,
        localCssLoaded: [...document.styleSheets].some((sheet) => /card-tailwind-v1\.min\.css/.test(sheet.href || "")),
        exposedEntryElements,
        modalVisibleAfterState,
        counts: {
          venues: document.querySelectorAll("#venues .venue-card").length,
          discard: document.querySelectorAll("#discard img").length,
          players: document.querySelectorAll("#players > div").length
        }
      };
    });

    if (process.env.CARD_RENDER_QA_DEBUG === "1") console.log(JSON.stringify(result));
    assert(pageErrors.length === 0, `page errors: ${JSON.stringify(pageErrors)}`);
    assert(result.batchedRenderCalls === 1, `EMIT + STATE rendered ${result.batchedRenderCalls} times in one frame`);
    assert(result.changedRenderCalls === 1, `changed STATE rendered ${result.changedRenderCalls} times`);
    assert(Object.values(result.stableAfterLog).every(Boolean), `unchanged DOM was rebuilt: ${JSON.stringify(result.stableAfterLog)}`);
    assert(Object.values(result.selectiveAfterPlayerChange).every(Boolean), `selective DOM update failed: ${JSON.stringify(result.selectiveAfterPlayerChange)}`);
    assert(result.tailwindRuntimeScripts === 0 && result.localCssLoaded, "compiled local Tailwind CSS was not the only Tailwind source");
    assert(result.exposedEntryElements.length === 0, `hidden elements are exposed before game state: ${JSON.stringify(result.exposedEntryElements)}`);
    assert(!result.modalVisibleAfterState, "generic modal intercepts the rendered entry screen");
    assert(result.autoSkipWithoutFrame.autoDrawBeforeJoin === 0, "paralyzed DRAW was sent before JOINED supplied player identity");
    assert(result.autoSkipWithoutFrame.autoDrawAfterJoin === 1, "JOINED did not immediately send the pending paralyzed DRAW");
    assert(result.autoSkipWithoutFrame.autoDrawAfterRepeatedState === 1, "repeated paralyzed STATE sent DRAW more than once");
    assert(result.autoSkipWithoutFrame.heldFrameCount === 1, "background-rAF fixture did not hold the scheduled render frame");
    assert(JSON.stringify(result.counts) === JSON.stringify({ venues: 1, discard: 1, players: 2 }), `unexpected rendered counts: ${JSON.stringify(result.counts)}`);
    console.log(`CARD_RENDER_BATCH_BROWSER_QA=PASS batched=${result.batchedRenderCalls} stable=venues,discard,players selective=players-only autoSkipWithoutFrame=PASS overlays=hidden css=local`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(`CARD_RENDER_BATCH_BROWSER_QA=FAIL ${error.stack || error.message || error}`);
  process.exitCode = 1;
});
