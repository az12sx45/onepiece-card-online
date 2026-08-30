const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function attachErrorCapture(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`http:${response.status()}:${response.url()}`);
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  const errors = [];
  const failures = [];
  attachErrorCapture(page, errors);

  try {
    await page.goto(`${ROOT_URL}/board_game.html?postgame_fresh_hp_qa=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });

    const result = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const player = state.gameState.players[0];
      player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
      player.crew.forEach((card) => {
        card.currentHp = Math.max(1, Number(card.maxHp || card.stats?.hp || card.baseStats?.hp || card.currentHp || 1));
      });
      player.activeCrewIndex = 0;
      state.gameState.currentPlayerIndex = 0;
      if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "postgame-fresh-hp-qa" });
      debug.ensurePostgameWorldLayout(state.gameState);

      const rows = [];
      for (const assignment of state.gameState.postgameWorld.islandAssignments) {
        const island = debug.getIslandById(assignment.islandId);
        const islandState = debug.getIslandState(assignment.islandId);
        const expectedMaxHp = Number(debug.getPostgameBossProfile(assignment.bossKey)?.maxHp || islandState.maxHp || 1);

        player.pendingBattle = null;
        state.battleState = null;
        islandState.currentHp = Math.max(1, Math.floor(expectedMaxHp * 0.37));
        islandState.isDefeated = false;
        debug.startBattle(player, island, islandState);
        const freshBattle = state.battleState;
        const fresh = {
          currentHp: Number(freshBattle?.enemyCombatant?.currentHp || 0),
          maxHp: Number(freshBattle?.enemyCombatant?.maxHp || 0),
          islandCurrentHp: Number(islandState.currentHp || 0),
          islandMaxHp: Number(islandState.maxHp || 0),
        };

        const resumeHp = Math.max(1, Math.floor(fresh.maxHp * 0.41));
        freshBattle.enemyCombatant.currentHp = resumeHp;
        islandState.currentHp = resumeHp;
        player.pendingBattle = JSON.parse(JSON.stringify(freshBattle));
        state.battleState = null;
        debug.startBattle(player, island, islandState);
        const resumedBattle = state.battleState;
        const resumed = {
          currentHp: Number(resumedBattle?.enemyCombatant?.currentHp || 0),
          maxHp: Number(resumedBattle?.enemyCombatant?.maxHp || 0),
          islandCurrentHp: Number(islandState.currentHp || 0),
        };

        rows.push({
          bossKey: assignment.bossKey,
          expectedMaxHp,
          fresh,
          resumeHp,
          resumed,
        });
      }
      player.pendingBattle = null;
      state.battleState = null;
      return rows;
    });

    if (result.length !== 13) failures.push(`expected 13 postgame bosses, got ${result.length}`);
    for (const row of result) {
      if (row.fresh.currentHp !== row.expectedMaxHp
        || row.fresh.maxHp !== row.expectedMaxHp
        || row.fresh.islandCurrentHp !== row.expectedMaxHp
        || row.fresh.islandMaxHp !== row.expectedMaxHp) {
        failures.push(`${row.bossKey}: fresh challenge was not full HP ${JSON.stringify(row.fresh)} expected=${row.expectedMaxHp}`);
      }
      if (row.resumed.currentHp !== row.resumeHp || row.resumed.islandCurrentHp !== row.resumeHp) {
        failures.push(`${row.bossKey}: pending battle HP was refilled ${JSON.stringify(row.resumed)} expected=${row.resumeHp}`);
      }
    }

    process.stdout.write(JSON.stringify({
      ok: failures.length === 0 && errors.length === 0,
      bossCount: result.length,
      failures,
      errors,
      results: result,
    }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
