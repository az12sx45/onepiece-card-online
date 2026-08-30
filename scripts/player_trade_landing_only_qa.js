const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/player_trade_landing_only_20260816_v77";

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });

  try {
    await page.goto(`${ROOT_URL}/board_game.html?qa=player-trade-landing-v77`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.playerTradeQa, null, { timeout: 20000 });

    const report = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = game.players[0];
      const partner = structuredClone(player);
      partner.id = "qa-trade-partner";
      partner.userId = "qa-trade-partner";
      partner.clientId = "qa-trade-partner-client";
      partner.name = "停靠玩家";
      partner.isMe = false;
      partner.isHost = false;
      partner.isCPU = false;
      partner.isCpu = false;
      partner.cpu = false;
      partner.pendingBattle = null;
      player.pendingBattle = null;
      game.players = [player, partner];
      game.currentPlayerIndex = 0;
      game.phase = "main";
      state.battleState = null;
      const route = (game.boardData?.routesBetweenIslands || []).find((entry) => Array.isArray(entry.tiles) && entry.tiles.length >= 2);
      if (!route) throw new Error("QA 找不到至少包含兩格的航線。");
      const routeLocation = (tileIndex) => ({
        kind: "route",
        routeId: route.id,
        tileIndex,
        fromIslandId: route.from,
        toIslandId: route.to,
        exitDirection: route.directions?.from || "east",
        entryDirectionAtDestination: route.directions?.to || "west",
      });

      const resetFlow = (stepsRemaining, sameTile = true) => {
        player.location = routeLocation(0);
        partner.location = routeLocation(sameTile ? 0 : 1);
        game.pendingMove = { playerId: player.id, stepsRemaining };
        game.movementAnimating = true;
        game.resolutionLock = false;
        game.tradePrompt = null;
        game.activeTrade = null;
        game.coopBattlePrompt = null;
        return debug.playerTradeQa.maybeOpenSeaTileTradePrompt(player);
      };

      const passed = resetFlow(2, true);
      const passState = {
        opened: passed,
        stepsRemaining: game.pendingMove.stepsRemaining,
        movementAnimating: game.movementAnimating,
        resolutionLock: game.resolutionLock,
        hasPrompt: !!game.tradePrompt,
        partners: debug.playerTradeQa.playersOnSameSeaTile(player).map((entry) => entry.id),
      };

      const differentTile = resetFlow(0, false);
      const differentTileState = {
        opened: differentTile,
        hasPrompt: !!game.tradePrompt,
      };

      const landed = resetFlow(0, true);
      const modalText = String(document.getElementById("boardModal")?.innerText || "").replace(/\s+/g, " ").trim();
      const landingState = {
        opened: landed,
        stepsRemaining: game.pendingMove.stepsRemaining,
        movementAnimating: game.movementAnimating,
        resolutionLock: game.resolutionLock,
        prompt: game.tradePrompt ? {
          playerId: game.tradePrompt.playerId,
          partnerIds: game.tradePrompt.partnerIds,
          routeId: game.tradePrompt.routeId,
          tileIndex: game.tradePrompt.tileIndex,
          trigger: game.tradePrompt.trigger,
        } : null,
        modalText,
      };

      return { passState, differentTileState, landingState };
    });

    if (report.passState.opened) failures.push("passing another player opened the trade prompt");
    if (report.passState.hasPrompt || report.passState.resolutionLock) failures.push("passing another player locked movement");
    if (!report.passState.movementAnimating || report.passState.stepsRemaining !== 2) failures.push("passing altered the active movement state");
    if (!report.passState.partners.includes("qa-trade-partner")) failures.push("same-tile partner was not detected during pass-through setup");
    if (report.differentTileState.opened || report.differentTileState.hasPrompt) failures.push("different tiles opened the trade prompt");
    if (!report.landingState.opened || !report.landingState.prompt) failures.push("same-tile landing did not open the trade prompt");
    if (!report.landingState.resolutionLock || report.landingState.movementAnimating) failures.push("same-tile landing did not pause for the trade decision");
    if (report.landingState.prompt?.trigger !== "sea_tile_landing") failures.push("trade prompt does not identify a landing trigger");
    if (!report.landingState.modalText.includes("停在") || !report.landingState.modalText.includes("同一格")) failures.push("landing-only trade explanation is missing");

    await page.screenshot({ path: path.join(OUTPUT_DIR, "same-tile-landing-trade.png"), fullPage: false });
    const finalReport = { ...report, errors, failures };
    fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(finalReport, null, 2));
    console.log(JSON.stringify(finalReport, null, 2));
    process.exitCode = errors.length || failures.length ? 1 : 0;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
