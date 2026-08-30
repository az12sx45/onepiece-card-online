const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/board_fixed_viewport_20260815_v66";

function captureErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
}

function nearly(actual, expected, tolerance = 1.5) {
  return Math.abs(actual - expected) <= tolerance;
}

async function inspectFixedViewport(browser, spec) {
  const errors = [];
  const context = await browser.newContext({
    viewport: spec.viewport,
    screen: spec.viewport,
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: spec.userAgent,
  });
  const page = await context.newPage();
  captureErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?room=QA123&online=1#fixed-ratio`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForURL(/board_fixed_viewport\.html/, { timeout: 15000 });
  const frameElement = page.locator("#boardFixedFrame");
  await frameElement.waitFor({ state: "visible", timeout: 15000 });
  const frame = page.frames().find((candidate) => candidate.url().includes("board_game.html"));
  if (!frame) throw new Error(`${spec.name}: inner board frame missing`);
  await frame.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && document.getElementById("boardGameMap"), null, { timeout: 25000 });
  await page.waitForTimeout(250);

  const outer = await page.evaluate(() => ({
    href: location.href,
    bodyBackground: getComputedStyle(document.body).backgroundColor,
    viewport: [window.innerWidth, window.innerHeight],
  }));
  const frameBox = await frameElement.boundingBox();
  const inner = await frame.evaluate(() => {
    const params = new URLSearchParams(location.search);
    const map = document.getElementById("boardGameMap")?.getBoundingClientRect();
    const turn = document.querySelector(".map-turn-banner")?.getBoundingClientRect();
    const tools = document.querySelector(".map-tools")?.getBoundingClientRect();
    return {
      href: location.href,
      viewport: [window.innerWidth, window.innerHeight],
      room: params.get("room"),
      online: params.get("online"),
      desktopFrame: params.get("desktop_frame"),
      map: map ? { left: map.left, top: map.top, width: map.width, height: map.height } : null,
      turn: turn ? { left: turn.left, top: turn.top, width: turn.width, height: turn.height } : null,
      tools: tools ? { left: tools.left, top: tools.top, width: tools.width, height: tools.height } : null,
    };
  });

  await frame.evaluate(() => {
    const probe = document.createElement("button");
    probe.id = "fixedViewportPointerProbe";
    probe.type = "button";
    probe.textContent = "probe";
    probe.style.cssText = "position:fixed;left:760px;top:420px;width:80px;height:60px;z-index:2147483647";
    probe.addEventListener("click", () => { probe.dataset.clicked = "1"; });
    document.body.appendChild(probe);
  });
  const probeButton = frame.locator("#fixedViewportPointerProbe");
  const clickProbe = { found: await probeButton.count() === 1, clicked: null };
  if (clickProbe.found) {
    await probeButton.click({ timeout: 5000 });
    clickProbe.clicked = await probeButton.getAttribute("data-clicked");
    await probeButton.evaluate((element) => element.remove());
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${spec.name}.png`) });
  await context.close();
  return { outer, frameBox, inner, clickProbe, errors };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const failures = [];

  const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 });
  const desktopPage = await desktopContext.newPage();
  const desktopErrors = [];
  captureErrors(desktopPage, desktopErrors);
  await desktopPage.goto(`${ROOT_URL}/board_game.html?fixed_ratio_desktop_qa=1`, { waitUntil: "domcontentloaded" });
  await desktopPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && document.getElementById("boardGameMap"), null, { timeout: 25000 });
  const desktop = {
    href: desktopPage.url(),
    viewport: await desktopPage.evaluate(() => [window.innerWidth, window.innerHeight]),
    wrapperCount: await desktopPage.locator("#boardFixedFrame").count(),
    errors: desktopErrors,
  };
  await desktopPage.screenshot({ path: path.join(OUTPUT_DIR, "desktop_1920x900.png") });
  await desktopContext.close();

  const specs = [
    {
      name: "tablet_1024x768",
      viewport: { width: 1024, height: 768 },
      userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      expected: { left: 0, top: 144, width: 1024, height: 480 },
    },
    {
      name: "phone_landscape_932x430",
      viewport: { width: 932, height: 430 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      expected: { left: 7.33, top: 0, width: 917.33, height: 430 },
    },
    {
      name: "phone_portrait_390x844",
      viewport: { width: 390, height: 844 },
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
      expected: { left: 0, top: 330.59, width: 390, height: 182.81 },
    },
  ];
  const portable = {};
  for (const spec of specs) {
    const result = await inspectFixedViewport(browser, spec);
    portable[spec.name] = result;
    const box = result.frameBox || {};
    if (!nearly(box.x, spec.expected.left)
      || !nearly(box.y, spec.expected.top)
      || !nearly(box.width, spec.expected.width)
      || !nearly(box.height, spec.expected.height)) {
      failures.push(`${spec.name}: fixed frame geometry mismatch`);
    }
    if (!nearly((box.width || 0) / (box.height || 1), 1920 / 900, 0.005)) {
      failures.push(`${spec.name}: frame ratio is not 1920:900`);
    }
    if (result.inner.viewport[0] !== 1920 || result.inner.viewport[1] !== 900) {
      failures.push(`${spec.name}: inner viewport is not 1920x900`);
    }
    if (result.inner.room !== "QA123" || result.inner.online !== "1" || result.inner.desktopFrame !== "1") {
      failures.push(`${spec.name}: URL parameters were not preserved`);
    }
    if (!result.clickProbe.found || result.clickProbe.clicked !== "1") {
      failures.push(`${spec.name}: scaled pointer target did not activate`);
    }
    if (result.errors.length) failures.push(`${spec.name}: browser errors detected`);
  }

  if (!desktop.href.includes("/board_game.html") || desktop.href.includes("board_fixed_viewport.html") || desktop.wrapperCount !== 0) {
    failures.push("desktop layout was unexpectedly redirected");
  }
  if (desktop.errors.length) failures.push("desktop browser errors detected");

  const report = { desktop, portable, failures, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
