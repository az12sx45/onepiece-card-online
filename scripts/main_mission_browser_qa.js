const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const rootUrl = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const outputDir = process.env.BOARD_QA_OUTPUT || path.join(__dirname, "..", "tmp", "main-mission-browser-qa");

async function prepareMissionJournal(page) {
  await page.goto(`${rootUrl}/board_game.html?main_mission_browser_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.mainMissionQa && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    player.isCPU = false;
    player.isCpu = false;
    player.cpu = false;
    player.crew = window.BoardCards.cards.slice(0, 4).map((card) => debug.cloneCard(card));
    player.activeCrewIndex = 0;
    debug.recalcPlayerDerivedStats(player);
    const missions = debug.mainMissionQa.definitions();
    player.mainMission = {
      currentMissionId: "main_017",
      progress: 4,
      target: 4,
      completed: true,
      claimedMissionIds: missions.slice(0, 16).map((mission) => mission.id),
      stats: { crew_formation_confirmed: 1 },
    };
    debug.mainMissionQa.normalize(player);
    debug.openMissionJournalModal(player);
    return { playerId: String(player.id), missionId: player.mainMission.currentMissionId };
  });
}

async function inspectViewport(browser, name, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console:${message.text()}`);
  });
  const prepared = await prepareMissionJournal(page);
  await page.waitForSelector(".mission-journal-primary-action button:not([disabled])", { timeout: 10000 });
  const layout = await page.evaluate(() => {
    const button = document.querySelector(".mission-journal-primary-action button");
    const slot = document.querySelector(".mission-journal-primary-action");
    const panel = document.querySelector(".mission-journal-ui");
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height, right: box.right, bottom: box.bottom } : null;
    };
    const inside = (outer, inner) => Boolean(outer && inner
      && inner.x >= outer.x - 1
      && inner.y >= outer.y - 1
      && inner.right <= outer.right + 1
      && inner.bottom <= outer.bottom + 1);
    return {
      label: button?.textContent?.trim() || "",
      panel: rect(panel),
      slot: rect(slot),
      button: rect(button),
      buttonInsideSlot: inside(rect(slot), rect(button)),
      textFits: Boolean(button && button.scrollWidth <= button.clientWidth + 1 && button.scrollHeight <= button.clientHeight + 1),
    };
  });
  await page.screenshot({ path: path.join(outputDir, `${name}.png`), fullPage: true });
  await context.close();
  return { name, viewport, prepared, layout, errors };
}

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  try {
    const results = [];
    results.push(await inspectViewport(browser, "main_mission_desktop_1600x900", { width: 1600, height: 900 }));
    results.push(await inspectViewport(browser, "main_mission_phone_932x430", { width: 932, height: 430 }));
    const errors = results.flatMap((result) => [
      ...result.errors.map((error) => `${result.name}:${error}`),
      ...(result.layout.buttonInsideSlot ? [] : [`${result.name}:claim button is outside its slot`]),
      ...(result.layout.textFits ? [] : [`${result.name}:claim button text is clipped`]),
    ]);
    const report = { ok: errors.length === 0, errors, outputDir, results };
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
