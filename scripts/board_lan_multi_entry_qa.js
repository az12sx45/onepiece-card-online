const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/board_lan_multi_entry_20260816";
const DELAY_HOST_MS = Math.max(0, Number(process.env.BOARD_QA_DELAY_HOST_MS || 0));

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function createDevice(browser, device, errors) {
  const context = await browser.newContext({ viewport: device.viewport, deviceScaleFactor: 1 });
  await context.addInitScript((profile) => {
    localStorage.setItem("op_board_user_id", String(profile.userId));
    localStorage.setItem("op_board_client_id", profile.clientId);
    localStorage.setItem("op_name", profile.name);
    localStorage.setItem("op_player_name", profile.name);
    localStorage.setItem("op_avatar", String(profile.avatar));
    sessionStorage.clear();
  }, device);
  const page = await context.newPage();
  captureErrors(page, errors, device.label);
  await page.goto(`${ROOT_URL}/board_start.html?qa=${encodeURIComponent(device.label)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 20000 });
  return { ...device, context, page };
}

async function enterRoom(device, roomCode, create = false) {
  const { page } = device;
  await page.click("#openBoardFlowBtn");
  if (create) {
    await page.click("#createBoardRoomBtn");
  } else {
    await page.fill("#roomCodeInput", roomCode);
    await page.click("#joinBoardRoomBtn");
  }
  await page.waitForFunction((code) => {
    const value = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    return code ? value === code : /^B[A-Z0-9]+$/.test(value);
  }, roomCode, { timeout: 12000 });
}

async function inspectDevice(device) {
  return device.page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug?.getState?.();
    const status = debug?.boardLanStatus?.();
    const current = debug?.getCurrentPlayer?.();
    const local = debug?.getLocalBoardPlayer?.();
    const modal = document.getElementById("boardModal");
    return {
      url: location.href,
      ready: !!debug,
      roomCode: status?.roomCode || "",
      lobbyHostUserId: String(state?.lobby?.hostUserId || ""),
      lobbyPlayers: (state?.lobby?.players || []).map((player) => ({
        id: String(player.userId || ""),
        host: !!player.isHost,
        online: !!player.online,
      })),
      connected: !!status?.connected,
      awaitingInitialState: !!status?.awaitingInitialState,
      version: Number(status?.version || 0),
      lastError: status?.lastError || "",
      phase: state?.gameState?.phase || "",
      seed: state?.gameState?.seed || "",
      playerIds: (state?.gameState?.players || []).map((player) => String(player.userId || player.id)),
      playerClients: (state?.gameState?.players || []).map((player) => String(player.clientId || "")),
      meIds: (state?.gameState?.players || []).filter((player) => player.isMe).map((player) => String(player.userId || player.id)),
      currentId: String(current?.userId || current?.id || ""),
      localId: String(local?.userId || local?.id || ""),
      openingStory: debug?.getOpeningStoryStatus?.() || null,
      modalOpen: document.getElementById("boardModalBack")?.classList.contains("open") || false,
      modalText: String(modal?.innerText || "").replace(/\s+/g, " ").trim().slice(0, 160),
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const configs = [
    { label: "desktop-host", userId: 810001, clientId: "qa-desktop-host", name: "電腦房主", avatar: 8, viewport: { width: 1600, height: 900 } },
    { label: "tablet-player", userId: 810002, clientId: "qa-tablet-player", name: "平板玩家", avatar: 5, viewport: { width: 1024, height: 768 } },
    { label: "phone-player", userId: 810003, clientId: "qa-phone-player", name: "手機玩家", avatar: 7, viewport: { width: 932, height: 430 } },
  ];

  try {
    const devices = [];
    for (const config of configs) devices.push(await createDevice(browser, config, errors));
    await enterRoom(devices[0], "", true);
    const roomCode = String(await devices[0].page.textContent("#boardLobbyRoomCode")).trim();
    await Promise.all([
      enterRoom(devices[1], roomCode, false),
      enterRoom(devices[2], roomCode, false),
    ]);
    await Promise.all(devices.map(({ page }) => page.waitForFunction(() => (
      document.querySelectorAll("#boardLobbyPlayerGrid .seat-card:not(.empty)").length === 3
    ), null, { timeout: 12000 })));

    if (DELAY_HOST_MS > 0) {
      await devices[0].page.route("**/board_game.html*", async (route) => {
        await new Promise((resolve) => setTimeout(resolve, DELAY_HOST_MS));
        await route.continue();
      });
    }

    await devices[0].page.click("#boardStartBtn");
    let waitingSnapshots = [];
    if (DELAY_HOST_MS >= 1800) {
      await Promise.all(devices.slice(1).map(({ page }) => page.waitForFunction(() => (
        window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().connected
      ), null, { timeout: 12000 })));
      await new Promise((resolve) => setTimeout(resolve, 520));
      waitingSnapshots = await Promise.all(devices.slice(1).map(inspectDevice));
      await Promise.all(devices.slice(1).map(({ page, label }) => page.screenshot({
        path: path.join(OUTPUT_DIR, `${label}-waiting.png`),
        fullPage: false,
      })));
      waitingSnapshots.forEach((entry, index) => {
        if (!entry.awaitingInitialState) failures.push(`${configs[index + 1].label} did not wait for host state`);
        if (entry.version !== 0) failures.push(`${configs[index + 1].label} seeded state before the host`);
        if (!entry.modalText.includes("正在向房主取得同一局遊戲資料")) failures.push(`${configs[index + 1].label} has no initial sync notice`);
      });
    }
    await Promise.all(devices.map(({ page }) => page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 15000 })));
    await Promise.all(devices.map(({ page }) => page.waitForFunction(() => (
      window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().connected
    ), null, { timeout: 25000 })));
    await new Promise((resolve) => setTimeout(resolve, 1800));

    const snapshots = await Promise.all(devices.map(inspectDevice));
    for (let index = 0; index < devices.length; index += 1) {
      await devices[index].page.screenshot({
        path: path.join(OUTPUT_DIR, `${devices[index].label}.png`),
        fullPage: false,
      });
    }

    const seeds = new Set(snapshots.map((entry) => entry.seed));
    const versions = new Set(snapshots.map((entry) => entry.version));
    if (seeds.size !== 1) failures.push(`devices do not share one game seed: ${[...seeds].join(",")}`);
    if (versions.size !== 1) failures.push(`devices do not share one game version: ${[...versions].join(",")}`);
    snapshots.forEach((entry, index) => {
      if (!entry.connected) failures.push(`${configs[index].label} is disconnected`);
      if (entry.awaitingInitialState) failures.push(`${configs[index].label} is still awaiting initial state`);
      if (entry.lastError) failures.push(`${configs[index].label} sync error: ${entry.lastError}`);
      if (entry.playerIds.length !== 3) failures.push(`${configs[index].label} has ${entry.playerIds.length} players`);
      if (entry.meIds.length !== 1 || entry.meIds[0] !== String(configs[index].userId)) {
        failures.push(`${configs[index].label} local identity mismatch: ${entry.meIds.join(",") || "none"}`);
      }
      if (entry.localId !== String(configs[index].userId)) failures.push(`${configs[index].label} controls ${entry.localId || "none"}`);
      if (entry.lobbyHostUserId !== String(configs[0].userId)) failures.push(`${configs[index].label} sees wrong host ${entry.lobbyHostUserId || "none"}`);
      if (!entry.openingStory?.active) failures.push(`${configs[index].label} did not enter the shared opening flow`);
    });

    await Promise.all(devices.map(async ({ page }) => {
      const skip = page.locator("#finalEndingSkipBtn");
      if (await skip.count()) await skip.click();
    }));
    await devices[0].page.waitForSelector("#confirmDraftOrderBtn", { timeout: 12000 });
    await devices[0].page.click("#confirmDraftOrderBtn");
    await Promise.all(devices.map(({ page }) => page.waitForFunction(() => (
      window.__BOARD_GAME_DEBUG__?.getState?.().gameState?.phase === "setup-draft"
    ), null, { timeout: 12000 })));
    await new Promise((resolve) => setTimeout(resolve, 320));
    const draftControl = await Promise.all(devices.map(({ page }) => page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const playerId = String(game.draftSequence[game.draftPickIndex] || "");
      const player = game.players.find((entry) => String(entry.id) === playerId);
      return {
        playerId,
        playerName: player?.name || "",
        hasRollButton: !!document.getElementById("recruitRollBtn"),
        localId: String(debug.getLocalBoardPlayer()?.id || ""),
        phase: game.phase,
      };
    })));
    const actingDevice = draftControl.find((entry) => entry.localId === entry.playerId);
    if (!actingDevice?.hasRollButton) failures.push("the first draft owner cannot operate on their own device");
    draftControl.filter((entry) => entry.localId !== entry.playerId).forEach((entry) => {
      if (entry.hasRollButton) failures.push(`non-owner ${entry.localId} can operate draft for ${entry.playerId}`);
    });

    const report = { roomCode, waitingSnapshots, snapshots, draftControl, errors, failures };
    fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = errors.length || failures.length ? 1 : 0;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
