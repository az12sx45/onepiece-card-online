const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const BASE_URL = process.env.BOARD_QA_BASE_URL || "http://127.0.0.1:8787";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT_DIR
  || "C:\\Users\\王曜瑋\\.codex\\visualizations\\2026\\07\\27\\019fa333-31ef-7e32-b226-023fffa4c411\\board_cpu_names_20260817_v109";

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  const errors = [];
  const failedResponses = [];
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      failedResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  try {
    await page.goto(`${BASE_URL}/board_start.html`, { waitUntil: "networkidle" });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });
    await page.click("#openBoardFlowBtn");
    await page.click("#createBoardRoomBtn");
    await page.waitForFunction(() => window.__BOARD_START_DEBUG__?.getState()?.currentView === "lobby");

    for (let expectedCount = 2; expectedCount <= 4; expectedCount += 1) {
      await page.click("#boardAddCpuBtn");
      await page.waitForFunction(
        (count) => window.__BOARD_START_DEBUG__?.getState()?.lobby?.players?.length === count,
        expectedCount,
      );
    }

    const lobby = await page.evaluate(() => window.__BOARD_START_DEBUG__.getState().lobby);
    const cpuNames = lobby.players.filter((player) => player.isCPU).map((player) => player.name);
    const expectedNames = ["CPU1", "CPU2", "CPU3"];
    if (JSON.stringify(cpuNames) !== JSON.stringify(expectedNames)) {
      throw new Error(`等待室 CPU 名稱錯誤：${JSON.stringify(cpuNames)}`);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, "cpu123_lobby.png"), fullPage: true });

    await page.click("#boardStartBtn");
    await page.waitForURL(/board_game\.html/, { timeout: 30000 });
    await page.waitForFunction(() => !!window.__BOARD_GAME_DEBUG__?.getState, null, { timeout: 30000 });
    const gameCpuNames = await page.evaluate(() => {
      const state = window.__BOARD_GAME_DEBUG__.getState();
      return (state.gameState?.players || []).filter((player) => player.isCPU).map((player) => player.name);
    });
    if (JSON.stringify(gameCpuNames) !== JSON.stringify(expectedNames)) {
      throw new Error(`正式遊戲 CPU 名稱錯誤：${JSON.stringify(gameCpuNames)}`);
    }
    const functionalErrors = errors.filter((message) => !message.includes("404 (Not Found)"));
    if (functionalErrors.length) {
      throw new Error(`瀏覽器錯誤：${JSON.stringify(functionalErrors)}`);
    }
    if (failedResponses.length) {
      throw new Error(`HTTP 錯誤：${JSON.stringify(failedResponses)}`);
    }

    console.log(JSON.stringify({
      ok: true,
      roomCode: lobby.roomCode,
      lobbyCpuNames: cpuNames,
      gameCpuNames,
      browserErrors: functionalErrors,
      httpErrors: failedResponses,
      screenshot: path.join(OUTPUT_DIR, "cpu123_lobby.png"),
    }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
