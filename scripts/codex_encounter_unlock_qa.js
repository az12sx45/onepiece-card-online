const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || path.join(process.cwd(), ".codex", "qa", "codex_region_labels_v383");

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

async function createLanDevice(browser, profile, errors) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
  }, profile);
  const page = await context.newPage();
  attachErrors(page, errors, profile.name);
  await page.goto(`${ROOT_URL}/board_start.html?codex_sync_qa=${encodeURIComponent(profile.name)}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 15000 });
  return { ...profile, context, page };
}

async function enterLanRoom(device, roomCode, create = false) {
  await device.page.click("#openBoardFlowBtn");
  if (create) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction((expected) => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    const lobbyVisible = document.querySelector('section[data-view="lobby"]')?.classList.contains("active");
    return lobbyVisible && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, roomCode, { timeout: 12000 });
}

async function runLanSync(browser, errors, failures) {
  const host = await createLanDevice(browser, {
    userId: 889701,
    clientId: "qa-codex-sync-host",
    name: "圖鑑同步房主",
  }, errors);
  const guest = await createLanDevice(browser, {
    userId: 889702,
    clientId: "qa-codex-sync-guest",
    name: "圖鑑同步玩家",
  }, errors);
  try {
    await enterLanRoom(host, "", true);
    const roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterLanRoom(guest, roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardStartBtn");
    await Promise.all([host.page, guest.page].map((page) => page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 15000 })));
    await Promise.all([host.page, guest.page].map((page) => page.waitForFunction(() => {
      const status = window.__BOARD_GAME_DEBUG__?.boardLanStatus?.();
      return status?.connected && !status.awaitingInitialState;
    }, null, { timeout: 20000 })));

    const pushed = await host.page.evaluate(({ guestUserId }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const owner = debug.getLocalBoardPlayer();
      const partner = game.players.find((player) => Number(player.userId || player.id) === Number(guestUserId));
      owner.defeatedEnemies = [];
      partner.defeatedEnemies = [];
      const target = debug.lineageCodexSummary(owner).entries.find((entry) => entry.enemyKeys.length > 0);
      const battle = {
        islandId: "qa-codex-sync-island",
        islandKind: "enemy",
        enemyTier: target.tier,
        enemyCombatant: {
          key: target.enemyKeys[0],
          sourceCardId: target.cardId,
          name: target.name,
          tier: target.tier,
          level: 50,
        },
      };
      debug.recordEncounteredEnemy(owner, battle, "QA 同步島");
      debug.recordEncounteredEnemy(partner, battle, "QA 共鬥同步島");
      debug.pushBoardLanState("qa-codex-encounter-sync");
      return {
        cardId: target.cardId,
        ownerId: String(owner.id),
        partnerId: String(partner.id),
        version: debug.boardLanStatus().version,
      };
    }, { guestUserId: guest.userId });

    await guest.page.waitForFunction(({ cardId, partnerId, minimumVersion }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const partner = debug.getState().gameState.players.find((player) => String(player.id) === partnerId);
      const entry = debug.lineageCodexSummary(partner).entries.find((candidate) => candidate.cardId === cardId);
      return debug.boardLanStatus().version >= minimumVersion && entry?.revealed && entry.encounterCount === 1;
    }, { cardId: pushed.cardId, partnerId: pushed.partnerId, minimumVersion: pushed.version }, { timeout: 10000 });
    const received = await guest.page.evaluate(({ cardId, ownerId, partnerId }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const players = debug.getState().gameState.players;
      const inspect = (playerId) => {
        const player = players.find((entry) => String(entry.id) === playerId);
        const codex = debug.lineageCodexSummary(player).entries.find((entry) => entry.cardId === cardId);
        return { playerId, revealed: codex?.revealed, encounterCount: codex?.encounterCount };
      };
      return {
        connected: debug.boardLanStatus().connected,
        version: debug.boardLanStatus().version,
        owner: inspect(ownerId),
        partner: inspect(partnerId),
      };
    }, pushed);
    if (!received.connected || !received.owner.revealed || !received.partner.revealed
      || received.owner.encounterCount !== 1 || received.partner.encounterCount !== 1) {
      failures.push(`lan: encounter unlock snapshot did not converge: ${JSON.stringify(received)}`);
    }
    return { roomCode, pushed, received };
  } finally {
    await Promise.all([host.context.close(), guest.context.close()]);
  }
}

async function setupEncounterCases(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const basePlayer = game.players[0];
    const makePlayer = (id, name) => {
      const player = JSON.parse(JSON.stringify(basePlayer));
      player.id = id;
      player.userId = id;
      player.clientId = "";
      player.name = name;
      player.isCpu = false;
      player.isCPU = false;
      player.crew = [];
      player.defeatedEnemies = [];
      const lab = debug.ensurePlayerResearchLabState(player);
      lab.collection = [];
      lab.completeFactors = [];
      lab.codexFactorCardIds = [];
      lab.codexCultivatedCardIds = [];
      return player;
    };
    const owner = makePlayer("qa-codex-owner", "圖鑑測試船長");
    const partner = makePlayer("qa-codex-partner", "共鬥測試船長");
    game.players = [owner, partner];
    game.currentPlayerIndex = 0;
    game.phase = "main";

    const initialSummary = debug.lineageCodexSummary(owner);
    const target = initialSummary.entries
      .find((entry) => entry.spawnRegionLabel && entry.enemyKeys.length > 0
        && window.BoardCards.cards.some((card) => card.id === entry.cardId));
    if (!target) throw new Error("找不到可用的圖鑑測試角色");
    const spawnLabels = Object.fromEntries([
      "buggy",
      "gecko_moria",
      "final_imu",
      "god_knight_killingham",
      "god_knight_sommers",
    ].map((enemyKey) => [
      enemyKey,
      initialSummary.entries.find((entry) => entry.enemyKeys.includes(enemyKey))?.spawnRegionLabel || "",
    ]));
    const battle = {
      islandId: "qa-codex-island",
      islandKind: "enemy",
      enemyTier: target.tier,
      enemyCombatant: {
        key: target.enemyKeys[0],
        sourceCardId: target.cardId,
        name: target.name,
        tier: target.tier,
        level: 50,
      },
    };

    const before = debug.lineageCodexSummary(owner).entries.find((entry) => entry.cardId === target.cardId);
    debug.recordEncounteredEnemy(owner, battle, "QA 遭遇島");
    debug.recordEncounteredEnemy(owner, battle, "QA 遭遇島");
    debug.recordEncounteredEnemy(partner, battle, "QA 共鬥島");
    const ownerAfter = debug.lineageCodexSummary(owner).entries.find((entry) => entry.cardId === target.cardId);
    const partnerAfter = debug.lineageCodexSummary(partner).entries.find((entry) => entry.cardId === target.cardId);
    const freshBattle = JSON.parse(JSON.stringify(battle));
    delete freshBattle.codexEncounteredPlayerIds;
    debug.recordEncounteredEnemy(owner, freshBattle, "QA 再遇島");
    const ownerSecondEncounter = debug.lineageCodexSummary(owner).entries.find((entry) => entry.cardId === target.cardId);
    debug.openDefeatedEnemyCodexModal(owner);
    const summary = debug.lineageCodexSummary(owner);
    return {
      target,
      targetIndex: summary.entries.findIndex((entry) => entry.cardId === target.cardId),
      before,
      ownerAfter,
      partnerAfter,
      ownerSecondEncounter,
      summary: {
        total: summary.total,
        encountered: summary.encountered,
      },
      spawnLabels,
    };
  });
}

async function inspectUi(page, setup) {
  await page.waitForSelector(".defeated-codex-nautical-modal .defeated-codex-row");
  const selector = `[data-codex-index="${setup.targetIndex}"]`;
  await page.locator(selector).click();
  await page.waitForTimeout(120);
  return page.evaluate((targetSelector) => {
    const row = document.querySelector(targetSelector);
    const detail = document.getElementById("defeatedCodexDetail");
    const header = document.querySelector(".defeated-codex-heading p");
    return {
      headerText: header?.textContent?.trim() || "",
      rowLocked: row?.classList.contains("is-locked") || false,
      rowText: row?.textContent?.replace(/\s+/g, " ").trim() || "",
      rowPortraits: row?.querySelectorAll(".defeated-codex-row-art img").length || 0,
      detailText: detail?.textContent?.replace(/\s+/g, " ").trim() || "",
      detailPortraits: detail?.querySelectorAll(".defeated-codex-detail-art img").length || 0,
      rankImages: detail?.querySelectorAll(".defeated-codex-detail-tier img").length || 0,
      mysteryMarks: row?.querySelectorAll(".defeated-codex-mystery-mark").length || 0,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  }, selector);
}

async function runViewport(browser, viewport, label, errors, failures) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?codex_encounter_unlock_qa=${label}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.lineageCodexSummary && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  const setup = await setupEncounterCases(page);
  const ui = await inspectUi(page, setup);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-encounter-unlocked.png`) });

  if (setup.before.revealed || setup.before.encounterCount !== 0) failures.push(`${label}: unseen entry was already revealed`);
  if (!setup.ownerAfter.revealed || setup.ownerAfter.encounterCount !== 1 || setup.ownerAfter.defeatCount !== 0 || setup.ownerAfter.ownedCount !== 0) {
    failures.push(`${label}: first encounter did not unlock independently of defeat and ownership`);
  }
  const expectedSpawnLabels = {
    buggy: "A東／B西",
    gecko_moria: "E東／F航線區域／G航線／南四皇航線",
    final_imu: "二周目限定：北四皇航線",
    god_knight_killingham: "二周目限定：G西",
    god_knight_sommers: "二周目限定：南四皇航線",
  };
  Object.entries(expectedSpawnLabels).forEach(([enemyKey, expected]) => {
    if (setup.spawnLabels[enemyKey] !== expected) {
      failures.push(`${label}: ${enemyKey} spawn label mismatch: ${setup.spawnLabels[enemyKey]} !== ${expected}`);
    }
  });
  if (!setup.partnerAfter.revealed || setup.partnerAfter.encounterCount !== 1) {
    failures.push(`${label}: second participant did not receive an independent encounter unlock`);
  }
  if (setup.ownerSecondEncounter.encounterCount !== 2) failures.push(`${label}: encounter deduplication/new-battle counting is incorrect`);
  if (ui.rowLocked || ui.rowPortraits !== 1 || ui.detailPortraits !== 1 || ui.rankImages !== 1 || ui.mysteryMarks !== 0
    || !ui.rowText.includes(setup.target.name) || !ui.rowText.includes(setup.target.spawnRegionLabel)
    || !ui.detailText.includes("遇見・未討伐") || !ui.detailText.includes(`出沒區域：${setup.target.spawnRegionLabel}`)
    || !ui.headerText.includes("遇見過就會揭露") || ui.documentOverflow) {
    failures.push(`${label}: unlocked codex UI did not match the encounter-only rule`);
  }
  await context.close();
  return { viewport, setup, ui };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const desktop = await runViewport(browser, { width: 1600, height: 900 }, "desktop", errors, failures);
  const tablet = await runViewport(browser, { width: 1024, height: 768 }, "tablet", errors, failures);
  const lanSync = await runLanSync(browser, errors, failures);
  await browser.close();
  failures.push(...errors);
  const report = { ok: failures.length === 0, outputDir: OUTPUT_DIR, desktop, tablet, lanSync, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
