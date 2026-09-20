"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");
const rootUrl = process.env.BOARD_QA_URL || "http://127.0.0.1:18920";
const output = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-quality-20260920/draft";

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const report = { checks: [], errors: [] };
  try {
    for (const [name, viewport] of Object.entries({ desktop: { width: 1440, height: 900 }, portrait: { width: 390, height: 844 }, landscape: { width: 932, height: 430 } })) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on("pageerror", error => report.errors.push(`${name}: ${error.message}`));
      await page.goto(`${rootUrl}/board_game.html?draft_passive_qa=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.openSetupStep);
      const data = await page.evaluate(() => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const game = debug.getState().gameState;
        const player = game.players[0];
        game.phase = "setup-draft";
        game.currentPlayerIndex = 0;
        game.draftOrder = [player.id];
        game.draftSequence = [player.id, player.id, player.id];
        game.draftPickIndex = 0;
        player.crew = [];
        player.isCpu = false;
        const tiers = [...new Set(game.availableCards.map(card => card.tier))];
        player.recruitRolls = [{ roll: 6, rolledTier: tiers[0], resolvedTier: tiers[0], allowedTiers: tiers }];
        debug.openSetupStep({ skipOpeningStory: true });
        return { cards: game.availableCards.map(card => ({ id: card.id, name: card.name })), crewCount: player.crew.length };
      });
      const buttons = page.locator("[data-draft-card-id]");
      const count = await buttons.count();
      assert(count > 0, "draft contains candidates");
      // The existing grid can show every tier in this fixture. Click through the
      // production handler without committing a pick to inspect every real text.
      let longest = { length: -1, id: "" };
      for (let i = 0; i < count; i++) {
        await buttons.nth(i).evaluate(button => button.click());
        const detail = await page.locator(".draft-detail-passive").evaluate(node => ({
          text: node.querySelector(".draft-detail-passive-effect").textContent,
          scrollable: getComputedStyle(node).overflowY === "auto",
          width: node.clientWidth,
          scrollWidth: node.scrollWidth,
          cardId: document.getElementById("draftConfirmPickBtn").dataset.cardId,
        }));
        assert(detail.text.trim().length > 0, "passive effect has text");
        assert(detail.scrollable, "long passive remains scrollable");
        assert(detail.scrollWidth <= detail.width + 1, "passive wraps without horizontal clipping");
        if (detail.text.length > longest.length) longest = { length: detail.text.length, id: detail.cardId };
        await page.locator("#draftDetailCloseBtn").click();
      }
      await page.locator(`[data-draft-card-id="${longest.id}"]`).evaluate(button => button.click());
      const bounds = await page.locator("#draftConfirmPickBtn").boundingBox();
      assert(bounds.x >= 0 && bounds.x + bounds.width <= viewport.width + 1, "confirm is inside viewport horizontally");
      await page.locator("#draftConfirmPickBtn").scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(output, `${name}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getState().gameState.players[0].crew.length), data.crewCount, "preview does not recruit or alter state");
      report.checks.push({ name, candidates: count, longest, confirmBounds: bounds, ok: true });
      await context.close();
    }
    assert.deepEqual(report.errors, []);
    report.ok = true;
  } finally {
    fs.writeFileSync(path.join(output, "report.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify(report));
})().catch(error => { console.error(error); process.exitCode = 1; });
