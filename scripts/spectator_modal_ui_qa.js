const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const VIEWPORT_WIDTH = Math.max(800, Number(process.env.BOARD_QA_WIDTH || 1280));
const VIEWPORT_HEIGHT = Math.max(600, Number(process.env.BOARD_QA_HEIGHT || 720));
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || path.join(process.cwd(), ".codex", "qa", "spectator_modal_ui_v393");

function attachErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      errors.push(`${label}:http:${response.status()}:${response.url()}`);
    }
  });
}

async function createLanDevice(browser, profile, errors) {
  const context = await browser.newContext({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT } });
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
  }, profile);
  const page = await context.newPage();
  attachErrors(page, errors, profile.name);
  await page.goto(`${ROOT_URL}/board_start.html?spectator_ui_qa=${encodeURIComponent(profile.name)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 15000 });
  return { ...profile, context, page };
}

async function enterLanRoom(device, roomCode, create = false) {
  await device.page.click("#openBoardFlowBtn");
  if (create) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction((expected) => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    const lobbyVisible = document.querySelector('section[data-view="lobby"]')?.classList.contains("active");
    return lobbyVisible && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, roomCode, { timeout: 12000 });
}

async function waitForGame(device) {
  await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 15000 });
  await device.page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const status = debug?.boardLanStatus?.();
    return debug?.spectatorUiQa && status?.connected && !status.awaitingInitialState;
  }, null, { timeout: 20000 });
}

async function emitAndInspect(host, guest, kind, detail, selector, inspect, screenshotName, options = {}) {
  const beforeVersion = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
  await host.page.evaluate(({ eventKind, eventDetail, eventOptions }) => {
    window.__BOARD_GAME_DEBUG__.spectatorUiQa.emit(eventKind, eventDetail, eventOptions);
  }, { eventKind: kind, eventDetail: detail, eventOptions: options });
  await guest.page.waitForFunction((target) => document.querySelector(target), selector, { timeout: 10000 });
  const result = await guest.page.evaluate(inspect);
  await host.page.waitForTimeout(240);
  const afterVersion = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
  const screenshot = path.join(OUTPUT_DIR, screenshotName);
  await guest.page.screenshot({ path: screenshot });
  return { ...result, beforeVersion, afterVersion, screenshot };
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const host = await createLanDevice(browser, {
    userId: 893931,
    clientId: "qa-spectator-modal-host",
    name: "觀看同步房主",
  }, errors);
  const guest = await createLanDevice(browser, {
    userId: 893932,
    clientId: "qa-spectator-modal-guest",
    name: "觀看同步玩家",
  }, errors);
  try {
    await enterLanRoom(host, "", true);
    const roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterLanRoom(guest, roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardStartBtn");
    await Promise.all([waitForGame(host), waitForGame(guest)]);

    const normalized = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const local = debug.getLocalBoardPlayer();
      const localIndex = state.gameState.players.findIndex((entry) => String(entry.id) === String(local?.id));
      state.gameState.phase = "main";
      state.gameState.currentPlayerIndex = Math.max(0, localIndex);
      state.gameState.pendingMove = null;
      state.gameState.routePrompt = null;
      state.gameState.islandDecision = null;
      state.gameState.resolutionLock = false;
      state.gameState.movementAnimating = false;
      state.battleState = null;
      debug.renderAll();
      debug.pushBoardLanState("qa-spectator-modal-main-phase");
      return { localId: String(local?.id || ""), version: debug.boardLanStatus().version };
    });
    await guest.page.waitForFunction((minimumVersion) => (
      window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().version >= minimumVersion
      && window.__BOARD_GAME_DEBUG__?.getState?.().gameState?.phase === "main"
    ), normalized.version, { timeout: 10000 });

    const supportedKinds = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.spectatorUiQa.supportedKinds());
    const revisit = await emitAndInspect(
      host,
      guest,
      "final-island-revisit",
      { title: "拉夫德魯・黎明紀錄殿", subtitle: "觀看同步測試" },
      ".encounter-ui",
      () => ({
        title: document.querySelector(".encounter-heading h3")?.textContent?.trim() || "",
        hasEncounterFrame: Boolean(document.querySelector(".encounter-panel-frame")),
        hasClose: Boolean(document.getElementById("spectatorModalCloseBtn")),
        oldBlueHudOpen: Boolean(document.querySelector(".board-action-hud.open")),
        modalClass: document.getElementById("modal")?.className || "",
      }),
      "final-island-revisit-guest.png"
    );
    if (revisit.title !== "拉夫德魯・黎明紀錄殿" || !revisit.hasEncounterFrame || !revisit.hasClose || revisit.oldBlueHudOpen) {
      failures.push(`final-island-revisit:${JSON.stringify(revisit)}`);
    }

    const compass = await emitAndInspect(
      host,
      guest,
      "final-boss-voyage-compass",
      { title: "大熊的肉球航路", subtitle: "觀看同步測試", selectedBossKey: "" },
      ".final-boss-compass-screen",
      () => ({
        title: document.querySelector("#finalBossCompassTitle")?.textContent?.trim() || "",
        cardCount: document.querySelectorAll(".final-boss-compass-card").length,
        enabledCardCount: Array.from(document.querySelectorAll(".final-boss-compass-card")).filter((entry) => !entry.disabled).length,
        hasClose: Boolean(document.getElementById("spectatorModalCloseBtn")),
        oldBlueHudOpen: Boolean(document.querySelector(".board-action-hud.open")),
        modalClass: document.getElementById("modal")?.className || "",
      }),
      "final-boss-voyage-compass-guest.png",
      { skipStatePush: true }
    );
    if (compass.title !== "大熊的肉球航路" || compass.cardCount !== 13 || compass.enabledCardCount !== 0 || !compass.hasClose
      || compass.oldBlueHudOpen || compass.afterVersion !== compass.beforeVersion) {
      failures.push(`final-boss-voyage-compass:${JSON.stringify(compass)}`);
    }

    const fallback = await emitAndInspect(
      host,
      guest,
      "qa-unknown-formal-fallback",
      { title: "未知觀看事件", subtitle: "不得顯示舊藍框" },
      ".encounter-ui",
      () => ({
        title: document.querySelector(".encounter-heading h3")?.textContent?.trim() || "",
        hasEncounterFrame: Boolean(document.querySelector(".encounter-panel-frame")),
        hasClose: Boolean(document.getElementById("spectatorModalCloseBtn")),
        oldBlueHudOpen: Boolean(document.querySelector(".board-action-hud.open")),
        modalClass: document.getElementById("modal")?.className || "",
      }),
      "unknown-formal-fallback-guest.png"
    );
    if (fallback.title !== "未知觀看事件" || !fallback.hasEncounterFrame || !fallback.hasClose || fallback.oldBlueHudOpen) {
      failures.push(`unknown-formal-fallback:${JSON.stringify(fallback)}`);
    }

    const output = { viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }, roomCode, supportedKinds, revisit, compass, fallback, errors, failures };
    fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), `${JSON.stringify(output, null, 2)}\n`);
    console.log(JSON.stringify(output, null, 2));
    if (errors.length || failures.length) process.exitCode = 1;
  } finally {
    await Promise.all([host.context.close(), guest.context.close()]);
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
