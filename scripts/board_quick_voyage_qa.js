"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18920";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-quality-20260920/quick";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const report = { errors: [], checks: [], timings: {}, layouts: [] };
  const check = (name, condition) => { assert(condition, name); report.checks.push(name); console.log(`PASS ${name}`); };
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    // Test-only closure access; the served application and production debug API stay unchanged.
    await page.route("**/js/board_game.js*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const marker = "  window.__BOARD_GAME_DEBUG__ = {";
      assert(source.includes(marker));
      await route.fulfill({ response, body: source.replace(marker, `
        window.__quickVoyageQa = {
          timing: movementDiceTiming,
          eventTiming: boardDiceEventTiming,
          remoteDuration: remoteBoardPlaybackDuration,
          animateDice,
          preferences: () => ({ ...quickVoyagePreferences }),
          shuffle: startSeaTreasureChestShuffle,
        };
${marker}`) });
    });
    await page.goto(`${ROOT_URL}/board_game.html?skipOpeningStory=1&quick_voyage_qa=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__quickVoyageQa && window.__BOARD_GAME_DEBUG__, null, { timeout: 30000 });
    await page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = s.gameState.players[0];
      s.gameState.phase = "main";
      s.gameState.currentPlayerIndex = 0;
      p.crew = window.BoardCards.cards.slice(0, 3).map((card) => d.cloneFreshDraftRecruit(card));
      d.recalcPlayerDerivedStats(p);
      d.closeModal();
      d.renderAll();
    });
    const baseline = await page.evaluate(() => {
      const q = window.__quickVoyageQa;
      return { preference: q.preferences(), timing: q.timing(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()), state: JSON.stringify(window.__BOARD_GAME_DEBUG__.getState().gameState) };
    });
    check("quick mode is opt-in", !baseline.preference.enabled && !baseline.preference.seenSeaChest);
    check("normal dice retains 5.4-6.2 seconds", baseline.timing.duration >= 5400 && baseline.timing.duration <= 6200);
    await page.locator("#quickVoyageBtn").click();
    const quick = await page.evaluate(() => {
      const q = window.__quickVoyageQa;
      const event = { id: "quick-qa", type: "dice", theme: "move", settleDelay: 650, duration: 1200 };
      return { timing: q.timing(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()), eventTiming: q.eventTiming(event), remote: q.remoteDuration(event, { kind: "state" }), legacy: q.eventTiming({ settleDelay: 2600, theme: "move" }), state: JSON.stringify(window.__BOARD_GAME_DEBUG__.getState().gameState) };
    });
    check("toggle does not mutate game state", quick.state === baseline.state);
    check("quick dice has 650 ms roll and 550 ms hold", quick.timing.settleDelay === 650 && quick.timing.resultHoldMs === 550);
    check("spectators use the same 1200 ms playback", quick.eventTiming.duration === 1200 && quick.remote === 1200);
    check("legacy dice events keep full hold", quick.legacy.duration === 5600);
    report.timings.quickDice = await page.evaluate(async () => {
      const q = window.__quickVoyageQa, timing = q.timing(window.__BOARD_GAME_DEBUG__.getCurrentPlayer());
      const start = performance.now();
      const result = await q.animateDice("move", "快速航行測試", "固定 4 點", 6, { ...timing, settle: 4 });
      return { ms: performance.now() - start, result, closed: !document.getElementById("diceHud").classList.contains("open") };
    });
    check("quick dice resolves once with unchanged face", report.timings.quickDice.result === 4 && report.timings.quickDice.closed && report.timings.quickDice.ms >= 1150 && report.timings.quickDice.ms < 2000);
    report.timings.battleDice = await page.evaluate(async () => {
      const start = performance.now();
      const result = await window.__quickVoyageQa.animateDice("battle", "完整戰鬥演出測試", "固定 2 點", 6, { settle: 2, settleDelay: 260 });
      return { ms: performance.now() - start, result };
    });
    check("battle dice keeps full 3000 ms hold", report.timings.battleDice.result === 2 && report.timings.battleDice.ms >= 3200);

    report.timings.movement = await page.evaluate(async () => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), gameBefore = structuredClone(s.gameState);
      const game = s.gameState, p = d.getCurrentPlayer();
      const island = game.boardData.islands.find((entry) => d.getAvailableRoutes(entry.id).length > 1);
      if (!island) throw new Error("No branching island for movement fixture");
      p.location = { kind: "island", islandId: island.id };
      p.routeChoice = null;
      p.presetStep = null;
      p.skipNextTurn = false;
      game.pendingMove = null;
      game.islandDecision = null;
      game.routePrompt = null;
      game.resolutionLock = false;
      const start = Date.now();
      const roll = d.rollDice();
      const animationEndsIn = Number(game.pendingMove?.diceAnimationEndsAt || 0) - start;
      const eventDuration = Number(s.boardUiEvent?.duration || 0);
      await roll;
      const result = { ms: Date.now() - start, animationEndsIn, eventDuration, waitingForRoute: !!game.routePrompt, pendingSteps: game.pendingMove?.stepsRemaining || 0, lastRoll: game.lastRoll, rolling: game.diceRolling, animationDeadlineCleared: !game.pendingMove?.diceAnimationEndsAt };
      s.gameState = gameBefore;
      d.closeModal();
      d.renderAll();
      return result;
    });
    check("real movement begins after the advertised quick dice duration", report.timings.movement.animationEndsIn >= 1200 && report.timings.movement.animationEndsIn < 1400 && report.timings.movement.eventDuration === 1200 && report.timings.movement.ms >= 1200 && report.timings.movement.ms < 2200);
    check("quick roll keeps pending steps and clears the animation lock", report.timings.movement.waitingForRoute && report.timings.movement.pendingSteps === report.timings.movement.lastRoll && !report.timings.movement.rolling && report.timings.movement.animationDeadlineCleared);

    async function chestShuffle() {
      await page.evaluate(() => {
        const d = window.__BOARD_GAME_DEBUG__, s = d.getState();
        d.closeModal();
        d.openSeaTreasureChestDraft(d.getCurrentPlayer(), s.gameState.boardData.seaTiles[0], { title: "寶箱演出測試", desc: "確認首次完整與重複加速。" }, "chest", "quick-qa");
        document.getElementById("startSeaChestShuffleBtn").addEventListener("click", () => { window.__qaShuffleStart = performance.now(); }, { capture: true, once: true });
      });
      await page.locator("#startSeaChestShuffleBtn").click();
      await page.waitForFunction(() => document.querySelector("[data-sea-chest-grid]")?.classList.contains("is-ready"));
      return page.evaluate(() => ({ ms: performance.now() - window.__qaShuffleStart, quick: window.__BOARD_GAME_DEBUG__.getState().boardUiEvent?.detail?.quickVoyage ?? null }));
    }
    report.timings.firstChest = await chestShuffle();
    check("first chest retains the full shuffle", report.timings.firstChest.ms >= 4500);
    await page.locator("[data-sea-treasure-chest]").first().click();
    check("reward still requires confirmation", await page.locator("#confirmSeaTreasureChestBtn").isVisible());
    // The reward panel continuously floats; use its visible center for a real pointer click.
    const confirmRect = await page.locator("#confirmSeaTreasureChestBtn").boundingBox();
    await page.mouse.click(confirmRect.x + confirmRect.width / 2, confirmRect.y + confirmRect.height / 2);
    check("completed chest marks local presentation as seen", await page.evaluate(() => window.__quickVoyageQa.preferences().seenSeaChest));
    report.timings.repeatChest = await chestShuffle();
    check("repeat chest shuffle is shortened to 1.1 seconds", report.timings.repeatChest.ms >= 1050 && report.timings.repeatChest.ms < 2100);
    await page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__;
      d.getState().gameState.phase = "main";
      d.closeModal();
    });

    for (const viewport of [{ width: 1440, height: 900 }, { width: 932, height: 430 }, { width: 390, height: 844 }]) {
      await page.setViewportSize(viewport);
      const layout = await page.evaluate(() => {
        const button = document.getElementById("quickVoyageBtn"), r = button.getBoundingClientRect();
        return { width: innerWidth, overflow: document.documentElement.scrollWidth > innerWidth + 2, visible: r.width > 0 && r.left >= 0 && r.right <= innerWidth + 2, pressed: button.getAttribute("aria-pressed"), textFits: button.scrollWidth <= button.clientWidth + 2 };
      });
      report.layouts.push(layout);
      check(`toggle visible and fits ${viewport.width}x${viewport.height}`, layout.visible && layout.textFits && !layout.overflow && layout.pressed === "true");
      await page.screenshot({ path: path.join(OUTPUT_DIR, `quick-${viewport.width}x${viewport.height}.png`) });
    }
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__quickVoyageQa);
    const restored = await page.evaluate(() => window.__quickVoyageQa.preferences());
    check("preference and seen status survive refresh", restored.enabled && restored.seenSeaChest);
    await page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__;
      d.getState().gameState.phase = "main";
      d.closeModal();
    });
    await page.locator("#quickVoyageBtn").click();
    const disabled = await page.evaluate(() => window.__quickVoyageQa.timing(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()));
    check("toggle off restores normal duration", disabled.duration >= 5400 && disabled.duration <= 6200);
    check("no browser runtime errors", report.errors.length === 0);
  } catch (error) {
    report.failure = error.stack;
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
})();
