const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/board_map_vintage_20260818/vintage-v1";

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

async function prepareMap(page) {
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.ensurePostgameWorldLayout, null, { timeout: 25000 });
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.resolutionLock = false;
    debug.unlockPostgameWorldAfterEnding(player, { id: "map-vintage-qa" });
    const world = debug.normalizePostgameWorldState(game);
    world.eggheadUnlocked = true;
    world.eggheadAnchorIslandId = "island-28";
    world.researchStoryPlayed = true;
    world.eggheadStoryPlayed = true;
    debug.ensurePostgameWorldLayout(game);
    debug.renderAll();
    debug.closeModal?.();
    document.getElementById("postgameWorldCinematic")?.remove();
    game.resolutionLock = false;
  });
  await page.evaluate(() => document.getElementById("viewWholeMapBtn")?.click());
  await page.waitForTimeout(1100);
}

async function inspect(page) {
  return page.evaluate(() => {
    const map = document.getElementById("boardGameMap");
    const rectFor = (element) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        left: Number(rect.left.toFixed(3)),
        top: Number(rect.top.toFixed(3)),
        width: Number(rect.width.toFixed(3)),
        height: Number(rect.height.toFixed(3)),
      };
    };
    const mapNodes = Array.from(map.querySelectorAll(".board-edge,.sea-tile,.island-node,.map-marker-pin,.ship-token,.map-decoration"));
    const geometry = mapNodes.map((node, index) => ({
      key: node.id || node.dataset.islandId || node.dataset.tileId || `${node.className}:${index}`,
      className: node.className,
      left: node.style.left,
      top: node.style.top,
      width: node.style.width,
      height: node.style.height,
      transform: node.style.transform,
      rect: rectFor(node),
    }));
    const firstEdge = map.querySelector(".board-edge");
    const firstTile = map.querySelector(".sea-tile:not(.scout-encounter)");
    const firstIslandImage = map.querySelector(".island-visual-img");
    const ship = map.querySelector(".ship-token");
    const tools = document.querySelector(".board-tools");
    const turnBanner = document.querySelector(".map-turn-banner");
    return {
      href: location.href,
      style: window.__BOARD_GAME_DEBUG__.getMapVisualStyle(),
      mapClass: map.className,
      mapDataset: map.dataset.mapVisualStyle,
      mapBackground: getComputedStyle(map).backgroundImage,
      mapBoxShadow: getComputedStyle(map).boxShadow,
      edgeBackground: firstEdge ? getComputedStyle(firstEdge).backgroundImage : "",
      tileBackground: firstTile ? getComputedStyle(firstTile).backgroundImage : "",
      islandFilter: firstIslandImage ? getComputedStyle(firstIslandImage).filter : "",
      shipFilter: ship ? getComputedStyle(ship).filter : "",
      tools: rectFor(tools),
      toolsBackground: tools ? getComputedStyle(tools).backgroundImage : "",
      turnBanner: rectFor(turnBanner),
      geometry,
      imageCount: map.querySelectorAll("img").length,
      brokenImages: Array.from(map.querySelectorAll("img"))
        .filter((image) => !image.complete || image.naturalWidth <= 0)
        .map((image) => image.currentSrc || image.src),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
}

function geometryDifferences(original, vintage) {
  if (original.length !== vintage.length) return [`node count ${original.length} != ${vintage.length}`];
  const diffs = [];
  original.forEach((before, index) => {
    const after = vintage[index];
    if (before.key !== after.key || before.className !== after.className) {
      diffs.push(`node identity ${index}`);
      return;
    }
    ["left", "top", "width", "height", "transform"].forEach((key) => {
      if (before[key] !== after[key]) diffs.push(`${before.key}:${key}`);
    });
    ["left", "top", "width", "height"].forEach((key) => {
      if (Math.abs(Number(before.rect?.[key] || 0) - Number(after.rect?.[key] || 0)) > 0.05) {
        diffs.push(`${before.key}:rect.${key}`);
      }
    });
  });
  return diffs;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, "map-vintage");
  await page.goto(`${ROOT_URL}/board_game.html?map_visual=original&map_vintage_qa=1`, { waitUntil: "domcontentloaded" });
  await prepareMap(page);

  const viewports = [
    { name: "desktop-1600x900", width: 1600, height: 900 },
    { name: "tablet-1024x768", width: 1024, height: 768 },
    { name: "phone-landscape-932x430", width: 932, height: 430 },
  ];
  const results = {};
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => document.getElementById("viewWholeMapBtn")?.click());
    await page.waitForTimeout(1100);

    await page.evaluate(() => window.__BOARD_GAME_DEBUG__.setMapVisualStyle("original"));
    const original = await inspect(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewport.name}-original.png`) });

    await page.evaluate(() => window.__BOARD_GAME_DEBUG__.setMapVisualStyle("vintage"));
    const vintage = await inspect(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewport.name}-vintage.png`) });

    const geometryDiffs = geometryDifferences(original.geometry, vintage.geometry);
    results[viewport.name] = { original, vintage, geometryDiffs };
    if (original.style !== "original" || original.mapClass.includes("map-visual-vintage")) {
      failures.push(`${viewport.name}: original style did not restore exactly`);
    }
    if (vintage.style !== "vintage" || !vintage.mapClass.includes("map-visual-vintage")) {
      failures.push(`${viewport.name}: vintage style was not applied`);
    }
    if (original.mapBackground === vintage.mapBackground
      || original.edgeBackground === vintage.edgeBackground
      || original.tileBackground === vintage.tileBackground
      || original.islandFilter === vintage.islandFilter) {
      failures.push(`${viewport.name}: one or more vintage map layers did not change`);
    }
    if (original.toolsBackground !== vintage.toolsBackground
      || JSON.stringify(original.tools) !== JSON.stringify(vintage.tools)
      || JSON.stringify(original.turnBanner) !== JSON.stringify(vintage.turnBanner)) {
      failures.push(`${viewport.name}: non-map UI changed`);
    }
    if (geometryDiffs.length) failures.push(`${viewport.name}: map geometry changed: ${geometryDiffs.slice(0, 8).join(",")}`);
    if (original.brokenImages.length || vintage.brokenImages.length) failures.push(`${viewport.name}: broken map image`);
    if (original.documentOverflow || vintage.documentOverflow) failures.push(`${viewport.name}: document overflow`);
  }

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.setMapVisualStyle("original"));
  const restored = await inspect(page);
  if (restored.style !== "original" || restored.mapClass.includes("map-visual-vintage")) {
    failures.push("final original restoration failed");
  }
  if (errors.length) failures.push(...errors);
  const report = { outputDir: OUTPUT_DIR, results, restored, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, errors, failures }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
