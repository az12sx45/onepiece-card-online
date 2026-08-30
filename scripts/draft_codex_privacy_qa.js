const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || path.join(process.cwd(), ".codex", "qa", "codex_encounter_unlock_v377");

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

async function setupFourPlayerDraft(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const basePlayer = game.players[0];
    const names = ["草帽船長", "紅心船長", "革命軍船長", "九蛇船長"];
    game.players = names.map((name, index) => {
      const player = JSON.parse(JSON.stringify(basePlayer));
      player.id = `qa-draft-player-${index + 1}`;
      player.userId = player.id;
      player.clientId = "";
      player.name = name;
      player.avatar = index + 1;
      player.isCpu = false;
      player.isCPU = false;
      player.crew = [];
      player.recruitRolls = [];
      player.defeatedEnemies = [];
      return player;
    });
    const ids = game.players.map((player) => player.id);
    game.phase = "setup-draft";
    game.currentPlayerIndex = 0;
    game.draftOrder = ids.slice();
    game.draftSequence = [...ids, ...ids.slice().reverse(), ...ids];
    game.draftPickIndex = 0;
    game.draftPickNotice = "";
    game.players[0].recruitRolls = [{
      roll: 1,
      rolledTier: "T1",
      resolvedTier: "T1",
      allowedTiers: ["T1"],
    }];
    debug.openSetupStep({ skipOpeningStory: true });
    return { playerIds: ids, sequence: game.draftSequence.slice() };
  });
}

async function inspectDraft(page) {
  return page.evaluate(() => {
    const board = document.querySelector(".draft-voyage-order");
    const grid = document.querySelector(".draft-order-grid");
    const boardRect = board?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const heads = [...document.querySelectorAll(".draft-order-player-head")];
    const cells = [...document.querySelectorAll(".draft-order-cell")];
    const topPlayers = [...document.querySelectorAll("#setupDraftTopStrip .setup-draft-top-player")];
    const inside = (rect, parent) => rect.left >= parent.left - 1
      && rect.top >= parent.top - 1
      && rect.right <= parent.right + 1
      && rect.bottom <= parent.bottom + 1;
    const noInternalOverflow = (element) => element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1;
    const insideArtworkSafeArea = (element) => {
      if (!boardRect) return false;
      const rect = element.getBoundingClientRect();
      const leftRatio = (rect.left - boardRect.left) / boardRect.width;
      const rightRatio = (rect.right - boardRect.left) / boardRect.width;
      const topRatio = (rect.top - boardRect.top) / boardRect.height;
      const bottomRatio = (rect.bottom - boardRect.top) / boardRect.height;
      return leftRatio >= .175 && rightRatio <= .835 && topRatio >= .145 && bottomRatio <= .89;
    };
    const contentRatios = [...heads, ...cells].map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: (rect.left - boardRect.left) / boardRect.width,
        right: (rect.right - boardRect.left) / boardRect.width,
        top: (rect.top - boardRect.top) / boardRect.height,
        bottom: (rect.bottom - boardRect.top) / boardRect.height,
      };
    });
    return {
      modalOpen: Boolean(document.querySelector(".draft-recruitment-modal .draft-recruitment-shell")),
      candidateCount: document.querySelectorAll(".draft-character-card").length,
      playerHeaderCount: heads.length,
      orderCellCount: cells.length,
      topPlayerCount: topPlayers.length,
      headerNames: heads.map((entry) => entry.textContent.trim()),
      headerInsideGrid: Boolean(gridRect) && heads.every((entry) => inside(entry.getBoundingClientRect(), gridRect)),
      cellsInsideGrid: Boolean(gridRect) && cells.every((entry) => inside(entry.getBoundingClientRect(), gridRect)),
      gridInsideBoard: Boolean(boardRect && gridRect) && inside(gridRect, boardRect),
      playerContentInsideArtwork: [...heads, ...cells].every(insideArtworkSafeArea),
      playerContentBounds: {
        left: Math.min(...contentRatios.map((entry) => entry.left)),
        right: Math.max(...contentRatios.map((entry) => entry.right)),
        top: Math.min(...contentRatios.map((entry) => entry.top)),
        bottom: Math.max(...contentRatios.map((entry) => entry.bottom)),
      },
      cellsNoOverflow: cells.every(noInternalOverflow),
      topPlayersNoOverflow: topPlayers.every(noInternalOverflow),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
}

async function setupCodexCases(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    debug.closeModal();
    game.phase = "main";
    game.currentPlayerIndex = 0;
    player.crew = [];
    player.defeatedEnemies = [];
    const lab = debug.ensurePlayerResearchLabState(player);
    lab.collection = [];
    lab.completeFactors = [];
    lab.codexFactorCardIds = [];
    lab.codexCultivatedCardIds = [];

    const baseEntries = debug.lineageCodexSummary(player).entries
      .filter((entry) => entry.enemyKeys.length > 0 && window.BoardCards.cards.some((card) => card.id === entry.cardId))
      .slice(0, 4);
    if (baseEntries.length < 4) throw new Error("圖鑑測試角色不足四名");
    const [both, ownedOnly, encounteredOnly, neither] = baseEntries;
    const sourceCard = (entry) => window.BoardCards.cards.find((card) => card.id === entry.cardId);
    player.crew = [debug.cloneCard(sourceCard(both)), debug.cloneCard(sourceCard(ownedOnly))];
    player.defeatedEnemies = [{
      key: both.enemyKeys[0],
      sourceCardId: both.cardId,
      name: both.name,
      encounterCount: 1,
      count: 1,
      highestLevel: 50,
      lastEncounterPlace: "QA 測試海域",
      lastPlace: "QA 測試海域",
    }, {
      key: encounteredOnly.enemyKeys[0],
      sourceCardId: encounteredOnly.cardId,
      name: encounteredOnly.name,
      encounterCount: 1,
      count: 0,
      highestLevel: 50,
      lastEncounterPlace: "QA 測試海域",
      lastPlace: "",
    }];
    const summary = debug.lineageCodexSummary(player);
    const resolve = (entry) => {
      const index = summary.entries.findIndex((candidate) => candidate.cardId === entry.cardId);
      return { ...summary.entries[index], index };
    };
    const cases = {
      both: resolve(both),
      ownedOnly: resolve(ownedOnly),
      encounteredOnly: resolve(encounteredOnly),
      neither: resolve(neither),
    };
    debug.openDefeatedEnemyCodexModal(player);
    return cases;
  });
}

async function inspectCodexList(page, cases) {
  return page.evaluate((caseData) => {
    const inspect = (entry) => {
      const row = document.querySelector(`[data-codex-index="${entry.index}"]`);
      const art = row?.querySelector(".defeated-codex-row-art");
      return {
        exists: Boolean(row),
        text: row?.textContent?.replace(/\s+/g, " ").trim() || "",
        locked: row?.classList.contains("is-locked") || false,
        portraitCount: art?.querySelectorAll("img").length || 0,
        mysteryCount: art?.querySelectorAll(".defeated-codex-mystery-mark").length || 0,
        leaksName: Boolean(entry.name && row?.textContent?.includes(entry.name)),
        leaksLocation: Boolean(entry.locationLabel && row?.textContent?.includes(entry.locationLabel)),
      };
    };
    return {
      both: inspect(caseData.both),
      ownedOnly: inspect(caseData.ownedOnly),
      encounteredOnly: inspect(caseData.encounteredOnly),
      neither: inspect(caseData.neither),
      rowCount: document.querySelectorAll(".defeated-codex-row").length,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  }, cases);
}

async function inspectCodexDetail(page, entry) {
  await page.locator(`[data-codex-index="${entry.index}"]`).click();
  await page.waitForTimeout(100);
  return page.evaluate((selected) => {
    const detail = document.getElementById("defeatedCodexDetail");
    const art = detail?.querySelector(".defeated-codex-detail-art");
    const tier = detail?.querySelector(".defeated-codex-detail-tier");
    return {
      text: detail?.textContent?.replace(/\s+/g, " ").trim() || "",
      portraitCount: art?.querySelectorAll("img").length || 0,
      rankImageCount: tier?.querySelectorAll("img").length || 0,
      mysteryCount: detail?.querySelectorAll(".defeated-codex-detail-mystery").length || 0,
      leaksName: Boolean(selected.name && detail?.textContent?.includes(selected.name)),
      leaksLocation: Boolean(selected.locationLabel && detail?.textContent?.includes(selected.locationLabel)),
      leaksSource: Boolean(selected.sourceLabel && detail?.textContent?.includes(selected.sourceLabel)),
    };
  }, entry);
}

async function runViewport(browser, viewport, label, errors, failures) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?draft_codex_privacy_qa=${label}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.openSetupStep && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const draftSetup = await setupFourPlayerDraft(page);
  await page.waitForSelector(".draft-recruitment-modal .draft-order-grid");
  await page.waitForTimeout(180);
  const draft = await inspectDraft(page);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-four-player-draft.png`) });
  if (draftSetup.sequence.length !== 12 || draft.playerHeaderCount !== 4 || draft.orderCellCount !== 12 || draft.topPlayerCount !== 4) {
    failures.push(`${label}: four-player draft counts incorrect`);
  }
  if (!draft.modalOpen || !draft.headerInsideGrid || !draft.cellsInsideGrid || !draft.gridInsideBoard
    || !draft.playerContentInsideArtwork
    || !draft.cellsNoOverflow || !draft.topPlayersNoOverflow || draft.documentOverflow) {
    failures.push(`${label}: four-player draft layout overflow or alignment failure`);
  }

  const cases = await setupCodexCases(page);
  await page.waitForSelector(".defeated-codex-nautical-modal .defeated-codex-row");
  await page.waitForTimeout(180);
  const list = await inspectCodexList(page, cases);
  if (!cases.both.revealed || cases.ownedOnly.revealed || !cases.encounteredOnly.revealed || cases.neither.revealed) {
    failures.push(`${label}: codex reveal truth table incorrect`);
  }
  if (list.both.locked || list.both.portraitCount !== 1 || list.both.leaksName === false) {
    failures.push(`${label}: owned-and-defeated entry did not reveal`);
  }
  const encounteredOnly = list.encounteredOnly;
  if (encounteredOnly.locked || encounteredOnly.portraitCount !== 1 || encounteredOnly.leaksName === false
    || !encounteredOnly.text.includes("遇見")) {
    failures.push(`${label}: encountered-only entry did not reveal immediately`);
  }
  for (const key of ["ownedOnly", "neither"]) {
    const item = list[key];
    if (!item.exists || !item.locked || item.portraitCount !== 0 || item.mysteryCount !== 1
      || item.leaksName || item.leaksLocation || !item.text.includes("????")) {
      failures.push(`${label}: ${key} list entry leaked identity`);
    }
  }

  const lockedDetail = await inspectCodexDetail(page, cases.ownedOnly);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-codex-locked.png`) });
  if (lockedDetail.portraitCount !== 0 || lockedDetail.rankImageCount !== 0 || lockedDetail.mysteryCount !== 1
    || lockedDetail.leaksName || lockedDetail.leaksLocation || lockedDetail.leaksSource || !lockedDetail.text.includes("????")) {
    failures.push(`${label}: locked detail leaked identity or loaded artwork`);
  }
  const revealedDetail = await inspectCodexDetail(page, cases.both);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-codex-revealed.png`) });
  if (revealedDetail.portraitCount !== 1 || revealedDetail.rankImageCount !== 1 || !revealedDetail.text.includes(cases.both.name)) {
    failures.push(`${label}: revealed detail did not show formal identity`);
  }
  const encounteredDetail = await inspectCodexDetail(page, cases.encounteredOnly);
  if (encounteredDetail.portraitCount !== 1 || encounteredDetail.rankImageCount !== 1
    || !encounteredDetail.text.includes(cases.encounteredOnly.name)
    || !encounteredDetail.text.includes("遇見・未討伐")) {
    failures.push(`${label}: encountered-only detail did not reveal without defeat or ownership`);
  }

  await context.close();
  return { viewport, draftSetup, draft, cases, list, lockedDetail, revealedDetail, encounteredDetail };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const desktop = await runViewport(browser, { width: 1600, height: 900 }, "desktop", errors, failures);
  const tablet = await runViewport(browser, { width: 1024, height: 768 }, "tablet", errors, failures);
  await browser.close();
  failures.push(...errors);
  const report = { ok: failures.length === 0, outputDir: OUTPUT_DIR, desktop, tablet, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
