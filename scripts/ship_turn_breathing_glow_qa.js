const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("tmp/ship_turn_breathing_glow_qa");

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

async function prepareTurn(page) {
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.renderAll, null, { timeout: 25000 });
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.pendingMove = null;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.resolutionLock = false;
    game.routePrompt = null;
    game.tradePrompt = null;
    game.coopBattlePrompt = null;
    game.activeTrade = null;
    game.islandDecision = null;
    state.battleState = null;
    const player = game.players[0];
    player.isCPU = false;
    player.pendingBattle = null;
    debug.renderAll();
    document.getElementById("boardModalBack")?.classList.remove("open");
    document.getElementById("postgameWorldCinematic")?.remove();
  });
  await page.locator(".ship-token.current.actionable").first().waitFor({ state: "visible", timeout: 10000 });
}

async function inspectGlow(page) {
  return page.evaluate(() => {
    const current = document.querySelector(".ship-token.current");
    const actionable = document.querySelector(".ship-token.current.actionable");
    const glowTarget = actionable?.querySelector(".ship-art")
      || actionable?.querySelector(".boat:not(.has-ship-art)");
    const glow = glowTarget ? getComputedStyle(glowTarget) : null;
    const rect = actionable?.getBoundingClientRect();
    return {
      currentPlayerId: current?.dataset.playerId || "",
      currentCount: document.querySelectorAll(".ship-token.current").length,
      actionableCurrentCount: document.querySelectorAll(".ship-token.current.actionable").length,
      glowAnimationName: glow?.animationName || "",
      glowFilter: glow?.filter || "",
      shipRect: rect ? {
        left: Number(rect.left.toFixed(2)),
        top: Number(rect.top.toFixed(2)),
        width: Number(rect.width.toFixed(2)),
        height: Number(rect.height.toFixed(2)),
      } : null,
      overflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, "ship-turn-glow");
  await page.goto(`${ROOT_URL}/board_game.html?ship_turn_glow_qa=1`, { waitUntil: "domcontentloaded" });
  await prepareTurn(page);

  const viewports = [
    { name: "desktop-1600x900", width: 1600, height: 900 },
    { name: "phone-landscape-932x430", width: 932, height: 430 },
  ];
  const results = {};

  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.evaluate(() => document.getElementById("focusPlayerBtn")?.click());
    await page.waitForTimeout(850);
    const active = await inspectGlow(page);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${viewport.name}-active.png`) });

    if (active.currentCount !== 1 || active.actionableCurrentCount !== 1) {
      failures.push(`${viewport.name}: expected exactly one current actionable ship`);
    }
    if (active.glowAnimationName !== "shipTurnArtworkGlow" || active.glowFilter === "none") {
      failures.push(`${viewport.name}: ship-art silhouette glow is not active`);
    }
    if (active.overflow) failures.push(`${viewport.name}: document overflow`);

    await page.evaluate(() => document.querySelector(".ship-token.current.actionable")?.click());
    await page.waitForTimeout(120);
    const menuOpened = await page.locator(".ship-action-menu").count() > 0;
    if (!menuOpened) failures.push(`${viewport.name}: clicking glowing ship did not open the ship command menu`);
    await page.evaluate(() => document.querySelectorAll(".ship-action-menu").forEach((node) => node.remove()));

    const locked = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      state.gameState.resolutionLock = true;
      debug.renderAll();
      const current = document.querySelector(".ship-token.current");
      const glowTarget = current?.querySelector(".ship-art")
        || current?.querySelector(".boat:not(.has-ship-art)");
      const glow = glowTarget ? getComputedStyle(glowTarget) : null;
      return {
        currentCount: document.querySelectorAll(".ship-token.current").length,
        actionableCurrentCount: document.querySelectorAll(".ship-token.current.actionable").length,
        glowAnimationName: glow?.animationName || "",
      };
    });
    if (locked.currentCount !== 1 || locked.actionableCurrentCount !== 0) {
      failures.push(`${viewport.name}: locked turn should keep current marker but remove actionable state`);
    }
    if (locked.glowAnimationName === "shipTurnArtworkGlow") {
      failures.push(`${viewport.name}: locked ship still has breathing glow`);
    }
    results[viewport.name] = { active, menuOpened, locked };

    await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      debug.getState().gameState.resolutionLock = false;
      debug.renderAll();
    });
  }

  await page.emulateMedia({ reducedMotion: "reduce" });
  const reducedMotion = await page.evaluate(() => {
    const ship = document.querySelector(".ship-token.current.actionable");
    const glowTarget = ship?.querySelector(".ship-art")
      || ship?.querySelector(".boat:not(.has-ship-art)");
    const glow = glowTarget ? getComputedStyle(glowTarget) : null;
    return {
      animationName: glow?.animationName || "",
      filter: glow?.filter || "",
    };
  });
  if (reducedMotion.animationName !== "none" || reducedMotion.filter === "none") {
    failures.push("reduced-motion mode should retain a static glow without breathing animation");
  }
  results.reducedMotion = reducedMotion;

  if (errors.length) failures.push(...errors);
  const report = { outputDir: OUTPUT_DIR, results, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, errors, failures }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
