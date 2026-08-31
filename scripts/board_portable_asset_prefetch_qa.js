const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve(".codex/qa/board_portable_asset_prefetch_v397");
const VERSION = "20260831-portable-prefetch-v397";
const manifest = JSON.parse(fs.readFileSync(path.resolve("public/images/board/mobile/manifest-v397.json"), "utf8"));
const EXPECTED_ASSET_PATHS = new Set([...manifest.assets, ...manifest.deferredAssets].map((asset) => `/${asset}`));
const IPAD_CONTEXT_OPTIONS = {
  viewport: { width: 1024, height: 768 },
  screen: { width: 1024, height: 768 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: "Mozilla/5.0 (iPad; CPU OS 18_6 like Mac OS X) AppleWebKit/605.1.15 Version/18.6 Mobile/15E148 Safari/604.1",
};

function isExpectedAssetUrl(source) {
  const url = new URL(source);
  return EXPECTED_ASSET_PATHS.has(url.pathname) && url.searchParams.get("v") === VERSION;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext(IPAD_CONTEXT_OPTIONS);
  const page = await context.newPage();
  const errors = [];
  const failures = [];
  const responseHeaders = new Map();
  const cdpEvents = [];
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (isExpectedAssetUrl(response.url())) {
      responseHeaders.set(response.url(), response.headers()["cache-control"] || "");
    }
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  cdp.on("Network.responseReceived", (event) => {
    if (isExpectedAssetUrl(event.response.url)) {
      cdpEvents.push({
        url: event.response.url,
        fromDiskCache: Boolean(event.response.fromDiskCache),
        fromPrefetchCache: Boolean(event.response.fromPrefetchCache),
      });
    }
  });

  await page.goto(`${ROOT_URL}/board_start.html?prefetch_qa=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForFunction(() => window.__BOARD_START_DEBUG__?.getState?.().portableAssetWarmup?.status === "complete", null, { timeout: 60000 });
  const warmup = await page.evaluate(({ assetPaths, version }) => {
    const state = window.__BOARD_START_DEBUG__.getState().portableAssetWarmup;
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => {
        const url = new URL(entry.name);
        return assetPaths.includes(url.pathname) && url.searchParams.get("v") === version;
      })
      .map((entry) => ({ name: entry.name, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }));
    const decodedPreloadImages = Array.from(document.images)
      .filter((image) => {
        const source = image.currentSrc || image.src;
        if (!source) return false;
        const url = new URL(source);
        return assetPaths.includes(url.pathname) && url.searchParams.get("v") === version;
      })
      .length;
    return { state, resources, decodedPreloadImages };
  }, { assetPaths: Array.from(EXPECTED_ASSET_PATHS), version: VERSION });
  const cacheHeaderValues = Array.from(responseHeaders.values());
  const sampleAssetPath = Array.from(EXPECTED_ASSET_PATHS)[0];
  const unversionedSampleResponse = await context.request.get(`${ROOT_URL}${sampleAssetPath}`);
  const unversionedSampleCacheControl = unversionedSampleResponse.headers()["cache-control"] || "";
  const navigationEventIndex = cdpEvents.length;

  await page.goto(`${ROOT_URL}/board_game.html?room=QA397&online=1&desktop_frame=1&portable_assets=1`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && document.querySelectorAll("#boardGameMap .island-visual-img").length > 0, null, { timeout: 30000 });
  await page.waitForTimeout(500);
  const game = await page.evaluate(({ version, assetPaths }) => {
    const mapImages = Array.from(document.querySelectorAll([
      "#boardGameMap .island-visual-img",
      "#boardGameMap .island-generic-mark img",
      "#boardGameMap .map-decoration img",
      "#boardGameMap .ship-art",
      ".map-turn-avatar img",
    ].join(",")));
    const sources = mapImages.map((image) => image.currentSrc || image.src);
    const uniqueSources = Array.from(new Set(sources));
    const resources = performance.getEntriesByType("resource")
      .filter((entry) => {
        const url = new URL(entry.name);
        return assetPaths.includes(url.pathname) && url.searchParams.get("v") === version;
      })
      .map((entry) => ({ name: entry.name, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }));
    return {
      imageCount: mapImages.length,
      loadedImageCount: mapImages.filter((image) => image.complete && image.naturalWidth > 0).length,
      versionedImageCount: sources.filter((source) => source.includes(`v=${version}`)).length,
      originalMapSources: sources.filter((source) => source.includes("images/board/") && !source.includes("images/board/mobile/")),
      uniqueSources,
      resources,
    };
  }, { version: VERSION, assetPaths: Array.from(EXPECTED_ASSET_PATHS) });
  const navigationCacheEvents = cdpEvents.slice(navigationEventIndex);
  const cacheHits = navigationCacheEvents.filter((event) => event.fromDiskCache || event.fromPrefetchCache).length;
  const retryContext = await browser.newContext(IPAD_CONTEXT_OPTIONS);
  await retryContext.addInitScript(() => {
    window.addEventListener("board:portable-assets-progress", (event) => {
      sessionStorage.setItem("board_prefetch_retry_qa", JSON.stringify(event.detail || {}));
    });
  });
  const retryPage = await retryContext.newPage();
  let forcedAssetRequests = 0;
  await retryPage.route((url) => url.pathname.endsWith("/images/board/mobile/avatars/1.webp") && url.searchParams.get("v") === VERSION, async (route) => {
    forcedAssetRequests += 1;
    if (forcedAssetRequests === 1) {
      await route.fulfill({ status: 503, contentType: "text/plain", body: "forced first-attempt failure" });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.continue();
  });
  await retryPage.goto(`${ROOT_URL}/board_start.html?prefetch_retry_qa=1`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await retryPage.waitForFunction(() => window.__BOARD_START_DEBUG__?.getState?.().portableAssetWarmup?.status === "partial", null, { timeout: 60000 });
  await retryPage.evaluate(() => {
    void window.__BOARD_START_DEBUG__.navigateToBoardGameWhenReady("board_game.html?room=QA397R&online=1");
  });
  await retryPage.waitForSelector("#portableAssetGate:not([hidden])", { timeout: 5000 });
  const retryGate = await retryPage.evaluate(() => ({
    visible: !document.getElementById("portableAssetGate")?.hidden,
    text: document.getElementById("portableAssetGateText")?.textContent || "",
  }));
  await retryPage.waitForURL(/board_fixed_viewport\.html/, { timeout: 30000 });
  const retryWarmup = await retryPage.evaluate(() => JSON.parse(sessionStorage.getItem("board_prefetch_retry_qa") || "{}"));
  await retryContext.close();

  if (warmup.state.total !== 108 || warmup.state.completed !== 108 || warmup.state.failed !== 0) {
    failures.push("portable warmup did not finish all 108 assets");
  }
  if (warmup.resources.length !== 108) failures.push(`expected 108 warmup resources, found ${warmup.resources.length}`);
  if (warmup.decodedPreloadImages !== 0) failures.push("warmup created decoded image elements");
  if (cacheHeaderValues.length !== 108 || cacheHeaderValues.some((value) => !/immutable/i.test(value))) {
    failures.push("portable asset responses are not all immutable-cacheable");
  }
  if (/immutable/i.test(unversionedSampleCacheControl)) failures.push("unversioned portable asset is incorrectly immutable-cacheable");
  if (!game.imageCount || game.loadedImageCount !== game.imageCount || game.versionedImageCount !== game.imageCount) {
    failures.push("game map did not reuse the complete versioned portable image set");
  }
  if (game.originalMapSources.length) failures.push("game map contains original-size image URLs");
  const gameResourceNames = new Set(game.resources.map((entry) => entry.name));
  if (!game.uniqueSources.length || game.uniqueSources.some((source) => !gameResourceNames.has(source))) {
    failures.push("not every unique map image has a matching resource entry");
  }
  if (game.resources.some((entry) => Number(entry.transferSize || 0) !== 0)) {
    failures.push("at least one portable game image required a network transfer after warmup");
  }
  if (!cacheHits) failures.push("no portable game image was served from browser cache");
  if (!retryGate.visible || !retryGate.text.includes("/") || retryWarmup.status !== "complete" || retryWarmup.failed !== 0 || retryWarmup.attempts !== 2 || forcedAssetRequests !== 2) {
    failures.push("portable warmup did not recover from a forced first-attempt failure");
  }
  if (errors.length) failures.push("browser errors detected");

  const report = {
    ok: failures.length === 0,
    warmup,
    game,
    cacheHeaderCount: cacheHeaderValues.length,
    unversionedSampleCacheControl,
    navigationCacheEvents: navigationCacheEvents.length,
    navigationCacheHits: cacheHits,
    retryWarmup: { ...retryWarmup, forcedAssetRequests, gate: retryGate },
    errors,
    failures,
  };
  await page.screenshot({ path: path.join(OUTPUT_DIR, "portable-prefetch-after-navigation.png") });
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    ok: report.ok,
    warmup: report.warmup.state,
    warmupResources: report.warmup.resources.length,
    decodedPreloadImages: report.warmup.decodedPreloadImages,
    gameImageCount: report.game.imageCount,
    navigationCacheHits: report.navigationCacheHits,
    errors: report.errors,
    failures: report.failures,
  }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || String(error));
  process.exitCode = 1;
});
