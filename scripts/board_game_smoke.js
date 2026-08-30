const fs = require("fs");
const http = require("http");
const path = require("path");
const { JSDOM } = require("jsdom");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeout = 8000, step = 40) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await wait(step);
  }
  throw new Error("Timed out while waiting for expected board-game state.");
}

function startStaticServer(publicDir) {
  const server = http.createServer((req, res) => {
    const rawPath = new URL(req.url, "http://localhost").pathname;
    const normalized = rawPath === "/" ? "/board_game.html" : rawPath;
    const localPath = path.join(publicDir, normalized.replace(/^\//, ""));
    if (!localPath.startsWith(publicDir) || !fs.existsSync(localPath)) {
      res.statusCode = 404;
      res.end("not found");
      return;
    }
    const ext = path.extname(localPath).toLowerCase();
    const contentType = {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[ext] || "application/octet-stream";
    res.setHeader("Content-Type", contentType);
    res.end(fs.readFileSync(localPath));
  });

  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(41731, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const publicDir = path.join(__dirname, "..", "public");
  const server = await startStaticServer(publicDir);

  try {
    const dom = await JSDOM.fromURL("http://127.0.0.1:41731/board_game.html?room=B7412", {
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window) {
        const nativeSetTimeout = window.setTimeout.bind(window);
        const nativeSetInterval = window.setInterval.bind(window);
        window.setTimeout = (fn, delay = 0, ...args) => nativeSetTimeout(fn, Math.min(Number(delay) || 0, 4), ...args);
        window.setInterval = (fn, delay = 0, ...args) => nativeSetInterval(fn, Math.min(Math.max(Number(delay) || 0, 8), 25), ...args);
        window.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 4);
        window.cancelAnimationFrame = (id) => clearTimeout(id);
      },
    });

    const { window } = dom;
    const debug = await waitFor(() => window.__BOARD_GAME_DEBUG__);
    const state = debug.getState();
    const cards = window.BoardCards.cards;

    const pick = (...ids) => ids.map((id) => JSON.parse(JSON.stringify(cards.find((card) => card.id === id))));
    const crews = [
      pick("nami", "dragon", "koby"),
      pick("zoro", "sanji", "chopper"),
      pick("law", "rayleigh", "ace"),
      pick("yamato", "marco", "jinbe"),
    ];

    state.gameState.players.forEach((player, index) => {
      player.crew = crews[index];
      player.activeCrewIndex = 0;
      debug.recalcPlayerDerivedStats(player);
    });

    state.gameState.phase = "main";
    state.gameState.currentPlayerIndex = 0;
    state.gameState.turnStep = "smoke-test";
    debug.renderAll();

    const me = debug.getCurrentPlayer();
    if (debug.movementCap(me) <= 6) {
      throw new Error(`Expected movement cap above 6 for smoke-test captain, got ${debug.movementCap(me)}`);
    }

    me.location = { kind: "island", islandId: "reverse-mountain", entryDirection: "west" };
    debug.openReverseMountainChoice(me, 6);
    await waitFor(() => state.gameState.routePrompt?.specialJunction === "reverse-mountain");
    debug.chooseRouteFromMap("route-reverse-center");
    await waitFor(() => me.location.kind === "island" && me.location.islandId === "island-22", 12000);

    if (state.gameState.boardData.finalIslandLayout) {
      throw new Error("Expected final island layout to stay unset before activation.");
    }
    state.gameState.finalIslandCandidate = true;
    state.gameState.finalIslandUnlocked = false;
    me.roadPoneglyphs = ["yonko_shanks", "yonko_bigmom", "yonko_kaido", "yonko_blackbeard"];
    debug.renderAll();
    debug.activateFinalIslandFromBackpack(me);
    await waitFor(() => state.gameState.finalIslandUnlocked, 12000);
    const finalLayout = state.gameState.boardData.finalIslandLayout;
    if (!finalLayout) {
      throw new Error("Expected randomized final island layout to exist after unlock.");
    }
    const finalRoute = debug.getRouteById(finalLayout.routeId);
    if (!finalRoute) {
      throw new Error("Expected randomized final island route to exist after unlock.");
    }
    me.location = { kind: "island", islandId: finalLayout.anchorIslandId, entryDirection: "" };
    me.routeChoice = finalLayout.routeId;
    state.gameState.pendingMove = { playerId: me.id, stepsRemaining: (finalRoute.tiles?.length || 5) + 1 };
    state.gameState.currentPlayerIndex = 0;
    debug.renderAll();

    await debug.continueMove();
    await waitFor(
      () => window.document.getElementById("confirmFinalGateBtn"),
      12000
    );
    debug.declineFinalGateDescent();
    await waitFor(() => !window.document.getElementById("confirmFinalGateBtn"), 12000);
    if (state.battleState) {
      throw new Error("Expected final gate retreat to avoid starting battle.");
    }
    const retreatRoutes = debug.getAvailableRoutes(finalLayout.anchorIslandId, me);
    if (!retreatRoutes.length) {
      throw new Error("Expected retreat to leave at least one alternate route.");
    }
    if (retreatRoutes.some((routeItem) => routeItem.id === finalLayout.routeId)) {
      throw new Error("Expected retreat routes to hide the final island route.");
    }
    me.finalGateRetreat = null;
    debug.confirmFinalGateDescent();
    await waitFor(
      () => state.battleState?.isFinalGate && state.battleState?.enemyCombatant?.key === "final_imu",
      12000
    );
    const finalGateTriggered = true;
    state.battleState = null;
    me.pendingBattle = null;
    me.finalGateDefeated = true;
    me.location = { kind: "island", islandId: finalLayout.anchorIslandId, entryDirection: "" };
    me.routeChoice = finalLayout.routeId;
    state.gameState.pendingMove = { playerId: me.id, stepsRemaining: (finalRoute.tiles?.length || 5) + 1 };
    debug.renderAll();
    await debug.continueMove();
    await waitFor(
      () => state.gameState.log.some((entry) => String(entry).includes("可進入最終之島")),
      12000
    );

    console.log(JSON.stringify({
      movementCap: debug.movementCap(me),
      claimedRouteCenterBy: state.gameState.claimedBranchRoutes.center,
      currentLocation: me.location,
      finalUnlocked: state.gameState.finalIslandUnlocked,
      finalGateTriggered,
      logTail: state.gameState.log.slice(-8),
    }, null, 2));

    window.close();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
