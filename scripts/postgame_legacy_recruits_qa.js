const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });

  try {
    await page.goto(`${ROOT_URL}/board_game.html?room=POSTGAMEQA&skipOpeningStory=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postgameLegacyRecruitQa, null, { timeout: 20000 });

    const report = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const player = game.players[0];
      const qa = debug.postgameLegacyRecruitQa;
      const lockedIds = qa.cardIds();
      const allPoolIds = () => ["T1", "T2", "T3", "T4", "T5", "T6"]
        .flatMap((tier) => qa.poolIdsForTier(tier, player));
      const catalogCard = (id) => structuredClone(window.BoardCards.cards.find((card) => card.id === id));

      game.availableCards = window.BoardCards.cards.map((card) => structuredClone(card));
      game.finalEndingCleared = false;
      game.finalEndingRecords = {};
      game.finalEndingLast = null;
      game.postgameWorld = { ...(game.postgameWorld || {}), unlocked: false };
      player.crew = [];
      const beforeUnlocked = qa.unlocked();
      const beforeIds = allPoolIds();

      const oldSaveCard = catalogCard("corazon");
      player.crew = [oldSaveCard];
      debug.normalizeLoadedGameState();
      const oldSavePreserved = player.crew.some((card) => card.id === "corazon");

      player.crew = [catalogCard("ace")];
      game.finalEndingCleared = true;
      game.finalEndingRecords = {
        [player.id]: { playerId: player.id, endingId: "treasure_banquet", completedAt: Date.now() },
      };
      game.postgameWorld = { ...(game.postgameWorld || {}), unlocked: true };
      const rescuedAcePostgameIds = allPoolIds();

      player.crew = [];
      game.availableCards = game.availableCards.filter((card) => card.id !== "custom_mp3la6fr");
      debug.normalizeLoadedGameState();
      const postgameIds = allPoolIds();

      return {
        lockedIds,
        beforeUnlocked,
        beforeVisibleLockedIds: lockedIds.filter((id) => beforeIds.includes(id)),
        oldSavePreserved,
        rescuedAceDuplicated: rescuedAcePostgameIds.includes("ace"),
        rescuedAceOtherUnlocks: lockedIds.filter((id) => id !== "ace" && rescuedAcePostgameIds.includes(id)),
        postgameVisibleLockedIds: lockedIds.filter((id) => postgameIds.includes(id)),
        missingRogerRepaired: game.availableCards.some((card) => card.id === "custom_mp3la6fr"),
      };
    });

    if (report.beforeVisibleLockedIds.length) failures.push(`通關前仍可見：${report.beforeVisibleLockedIds.join(",")}`);
    if (!report.oldSavePreserved) failures.push("舊存檔持有的柯拉松被移除");
    if (report.rescuedAceDuplicated) failures.push("已救出的艾斯仍出現在終局酒館池");
    if (report.rescuedAceOtherUnlocks.length !== 3) failures.push("救出艾斯後其餘三名終局角色未完整解鎖");
    if (report.postgameVisibleLockedIds.length !== 4) failures.push("終局世界未完整開放四名角色");
    if (!report.missingRogerRepaired) failures.push("舊終局存檔缺少的羅傑未回補到可招募池");

    console.log(JSON.stringify({ ok: errors.length === 0 && failures.length === 0, errors, failures, report }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
