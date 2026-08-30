const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/egghead_map_position_20260813_v41";

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

async function inspectRenderedMap(page) {
  return page.evaluate(() => {
    const map = document.getElementById("boardGameMap");
    const egghead = document.querySelector(".postgame-egghead-island");
    const routeTiles = Array.from(document.querySelectorAll(".postgame-egghead-route-tile"));
    const routeEdges = Array.from(document.querySelectorAll(".postgame-egghead-route-edge"));
    const eggheadRect = egghead?.getBoundingClientRect();
    return {
      mapStyleWidth: map?.style.width || "",
      mapStyleHeight: map?.style.height || "",
      eggheadVisible: Boolean(egghead && getComputedStyle(egghead).display !== "none"),
      eggheadRect: eggheadRect ? {
        left: Math.round(eggheadRect.left),
        top: Math.round(eggheadRect.top),
        width: Math.round(eggheadRect.width),
        height: Math.round(eggheadRect.height),
      } : null,
      routeTileCount: routeTiles.length,
      routeEdgeCount: routeEdges.length,
      routeTileCenters: routeTiles.map((tile) => {
        const rect = tile.getBoundingClientRect();
        return { x: Math.round(rect.left + rect.width / 2), y: Math.round(rect.top + rect.height / 2) };
      }),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
      brokenMapImages: Array.from(map?.querySelectorAll("img") || [])
        .filter((image) => !image.complete || image.naturalWidth <= 0)
        .map((image) => image.currentSrc || image.src),
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const progressPath = path.join(OUTPUT_DIR, "progress.log");
  fs.writeFileSync(progressPath, "");
  const progress = (message) => {
    console.log(`[egghead-map-qa] ${message}`);
    fs.appendFileSync(progressPath, `${new Date().toISOString()} ${message}\n`);
  };
  const errors = [];
  const failures = [];
  progress("launch browser");
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, "egghead-map");
  progress("open board page");
  await page.goto(`${ROOT_URL}/board_game.html?egghead_map_position_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.ensurePostgameWorldLayout, null, { timeout: 20000 });
  progress("board debug ready");

  const audit = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.resolutionLock = false;
    debug.unlockPostgameWorldAfterEnding(player, { id: "egghead-map-position-qa" });
    const world = debug.normalizePostgameWorldState(game);
    world.eggheadUnlocked = false;
    debug.ensurePostgameWorldLayout(game);

    const baseSize = {
      width: Number(game.boardData.mapTemplate.widthPx || 0),
      height: Number(game.boardData.mapTemplate.heightPx || 0),
    };
    const original = Object.fromEntries(game.boardData.islands
      .filter((island) => island.id !== "postgame-egghead-island")
      .map((island) => [island.id, {
        col: Number(island.col),
        row: Number(island.row),
        pxX: Number(island.pxX),
        pxY: Number(island.pxY),
      }]));
    const assignmentBySlot = Object.fromEntries(game.postgameWorld.islandAssignments.map((entry) => [entry.slotId, entry.islandId]));
    const anchors = [
      assignmentBySlot["north-island-7"],
      ...Array.from({ length: 7 }, (_, index) => `island-${(index + 1) * 7}`),
      assignmentBySlot["south-island-49"],
    ].filter(Boolean);

    const cases = anchors.map((anchorId) => {
      game.postgameWorld.eggheadUnlocked = true;
      game.postgameWorld.eggheadAnchorIslandId = anchorId;
      game.boardData.mapTemplate.widthPx = 5692;
      debug.ensurePostgameWorldLayout(game);
      const anchor = game.boardData.islands.find((island) => island.id === anchorId);
      const egghead = game.boardData.islands.find((island) => island.id === "postgame-egghead-island");
      const route = game.boardData.routesBetweenIslands.find((entry) => entry.id === "route-postgame-egghead");
      const seaTiles = game.boardData.seaTiles.filter((tile) => tile.routeId === "route-postgame-egghead");
      const changedOriginalIslands = Object.entries(original).filter(([islandId, before]) => {
        const after = game.boardData.islands.find((island) => island.id === islandId);
        return !after || ["col", "row", "pxX", "pxY"].some((key) => Number(after[key]) !== before[key]);
      }).map(([islandId]) => islandId);
      const uniqueRouteTiles = new Set((route?.tiles || []).map((tile) => `${tile.col}:${tile.row}`));
      return {
        anchorId,
        mapWidth: Number(game.boardData.mapTemplate.widthPx || 0),
        mapHeight: Number(game.boardData.mapTemplate.heightPx || 0),
        anchor: anchor ? { x: Number(anchor.pxX), y: Number(anchor.pxY), col: Number(anchor.col), row: Number(anchor.row) } : null,
        egghead: egghead ? { x: Number(egghead.pxX), y: Number(egghead.pxY), col: Number(egghead.col), row: Number(egghead.row) } : null,
        routeTileCount: route?.tiles?.length || 0,
        uniqueRouteTileCount: uniqueRouteTiles.size,
        seaTileCount: seaTiles.length,
        diagonal: Boolean(anchor && egghead && Number(anchor.pxX) !== Number(egghead.pxX) && Number(anchor.pxY) !== Number(egghead.pxY)),
        insideMap: Boolean(egghead
          && egghead.pxX >= 138 && egghead.pxX <= game.boardData.mapTemplate.widthPx - 138
          && egghead.pxY >= 138 && egghead.pxY <= game.boardData.mapTemplate.heightPx - 138),
        changedOriginalIslands,
      };
    });

    game.postgameWorld.eggheadUnlocked = true;
    game.postgameWorld.eggheadAnchorIslandId = "island-28";
    game.postgameWorld.researchStoryPlayed = true;
    game.postgameWorld.eggheadStoryPlayed = true;
    debug.ensurePostgameWorldLayout(game);
    debug.renderAll();
    document.getElementById("postgameWorldCinematic")?.remove();
    game.resolutionLock = false;
    return { baseSize, originalIslandCount: Object.keys(original).length, anchors, cases };
  });
  progress("state audit complete");

  audit.cases.forEach((entry) => {
    if (entry.mapWidth !== audit.baseSize.width || entry.mapHeight !== audit.baseSize.height) {
      failures.push(`map dimensions changed for ${entry.anchorId}: ${entry.mapWidth}x${entry.mapHeight}`);
    }
    if (entry.routeTileCount !== 5 || entry.uniqueRouteTileCount !== 5 || entry.seaTileCount !== 5) {
      failures.push(`route is not exactly five tiles for ${entry.anchorId}: ${JSON.stringify(entry)}`);
    }
    if (!entry.diagonal || !entry.insideMap) failures.push(`invalid diagonal placement for ${entry.anchorId}: ${JSON.stringify(entry)}`);
    if (entry.changedOriginalIslands.length) failures.push(`existing islands moved for ${entry.anchorId}: ${entry.changedOriginalIslands.join(",")}`);
  });
  if (audit.baseSize.width !== 5120 || audit.baseSize.height !== 3976) {
    failures.push(`formal map did not retain 5120x3976: ${JSON.stringify(audit.baseSize)}`);
  }

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__?.closeModal?.());
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    window.__BOARD_GAME_DEBUG__?.closeModal?.();
    document.getElementById("postgameWorldCinematic")?.remove();
  });
  progress("fit desktop map");
  await page.evaluate(() => document.getElementById("viewWholeMapBtn")?.click());
  await page.waitForTimeout(500);
  const desktop = await inspectRenderedMap(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "egghead-map-desktop-1600x900.png") });
  progress("desktop capture complete");
  if (desktop.routeTileCount !== 5 || desktop.routeEdgeCount !== 6 || !desktop.eggheadVisible || desktop.brokenMapImages.length) {
    failures.push(`desktop map render mismatch: ${JSON.stringify(desktop)}`);
  }

  await page.setViewportSize({ width: 932, height: 430 });
  progress("fit phone map");
  await page.evaluate(() => document.getElementById("viewWholeMapBtn")?.click());
  await page.waitForTimeout(500);
  const phone = await inspectRenderedMap(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, "egghead-map-phone-932x430.png") });
  progress("phone capture complete");
  if (phone.routeTileCount !== 5 || phone.routeEdgeCount !== 6 || !phone.eggheadVisible || phone.brokenMapImages.length) {
    failures.push(`phone map render mismatch: ${JSON.stringify(phone)}`);
  }
  if (errors.length) failures.push(...errors);

  const report = { outputDir: OUTPUT_DIR, audit, desktop, phone, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  progress("close browser");
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
