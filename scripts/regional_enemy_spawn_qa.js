const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || path.join(process.cwd(), ".codex", "qa", "regional_enemy_spawns_v381");

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

function expectEqual(failures, label, actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    failures.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

async function inspectDesigner(browser, errors, failures) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  attachErrors(page, errors, "designer");
  await page.goto(`${ROOT_URL}/board_enemy_spawn_designer.html?qa=v381`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const result = await page.evaluate(() => ({
    configVersion: window.BoardEnemySpawnRegions?.version || "",
    regionCount: Object.keys(window.BoardEnemySpawnRegions?.assignments || {}).length,
    assignedEnemyCount: new Set(Object.values(window.BoardEnemySpawnRegions?.assignments || {}).flat()).size,
    activeRegion: document.getElementById("activeRegionName")?.textContent?.trim() || "",
    selectedCount: Number(document.getElementById("selectionCount")?.textContent?.match(/\d+/)?.[0] || 0),
    pageOverflow: document.documentElement.scrollWidth > innerWidth + 2,
  }));
  if (result.configVersion !== "2026-08-29-v1" || result.regionCount !== 21 || result.assignedEnemyCount !== 30) {
    failures.push(`designer: shared preset did not load: ${JSON.stringify(result)}`);
  }
  if (result.activeRegion !== "A航線" || result.selectedCount !== 4 || result.pageOverflow) {
    failures.push(`designer: default UI mismatch: ${JSON.stringify(result)}`);
  }
  const screenshot = path.join(OUTPUT_DIR, "designer-shared-preset.png");
  await page.screenshot({ path: screenshot, fullPage: true });
  await context.close();
  return { ...result, screenshot };
}

async function inspectRules(browser, errors, failures) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  attachErrors(page, errors, "rules");
  await page.goto(`${ROOT_URL}/board_game.html?regional_enemy_spawn_qa=v381`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.enemySpawnQa, null, { timeout: 30000 });
  const result = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.enemySpawnQa;
    const state = debug.getState();
    const game = state.gameState;
    const routes = game.boardData.routesBetweenIslands;
    const route = (id) => routes.find((entry) => entry.id === id);
    const routeRegions = (id) => qa.regionIdsForRoute(route(id));
    const onePlay = { postgameWorld: { unlocked: false } };
    const twoPlay = { postgameWorld: { unlocked: true } };
    const activeEnemyIslands = game.boardData.islands
      .filter((island) => island.kind === "enemy")
      .map((island) => {
        const profile = game.boardData.islandStates[island.id]?.enemyProfile;
        const regionIds = qa.regionIdsForIsland(island.id);
        return {
          islandId: island.id,
          key: profile?.key || "",
          regionIds,
          allowed: qa.profileAllowed(profile, regionIds, game),
          marked: profile?.isRegionalSpawnEncounter === true,
          version: profile?._spawnRegionPresetVersion || "",
        };
      });
    const floorPlayer = { crew: [{ level: 20 }, { level: 60 }, { level: 45 }] };
    const lowProfile = qa.profilesForRegions(["route_a"], onePlay)[0];
    const raisedLow = qa.raiseProfile({ ...lowProfile, level: 10 }, floorPlayer);
    const highProfile = qa.raiseProfile({ ...lowProfile, level: 70 }, floorPlayer);
    const seaTile = game.boardData.seaTiles.find((tile) => tile.routeId === "route-island-8-island-9")
      || { id: "qa-route-a-b", routeId: "route-island-8-island-9", index: 0, zone: "safe" };
    const seaEnemy = qa.pickSea(seaTile, floorPlayer);
    game.postgameWorld = game.postgameWorld || {};
    game.postgameWorld.unlocked = true;
    const northPostgame = qa.keysForRegions(["north_yonko"], game);
    const imu = qa.pickUnique("T1", "regional-imu-qa", ["enel", "sentomaru", "doflamingo"], ["north_yonko"]);
    const domi = imu?.moves?.find((move) => move.id === "final_imu_domi_reversi");
    const livePlayer = game.players[0];
    livePlayer.crew = window.BoardCards.cards.slice(0, 2).map((source) => debug.cloneCard({
      ...source,
      level: 60,
      currentHp: Number.MAX_SAFE_INTEGER,
    }));
    livePlayer.crew.forEach((card) => {
      card.level = 60;
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
    });
    livePlayer.activeCrewIndex = 0;
    livePlayer.pendingBattle = null;
    game.phase = "main";
    game.currentPlayerIndex = 0;
    state.battleState = null;
    const battleIsland = game.boardData.islands
      .filter((entry) => entry.kind === "enemy")
      .sort((a, b) => Number(game.boardData.islandStates[a.id]?.enemyProfile?.level || 999)
        - Number(game.boardData.islandStates[b.id]?.enemyProfile?.level || 999))[0];
    const battleIslandState = game.boardData.islandStates[battleIsland.id];
    const beforeStartLevel = Number(battleIslandState.enemyProfile.level || 0);
    battleIslandState.currentHp = battleIslandState.maxHp;
    debug.startBattle(livePlayer, battleIsland, battleIslandState);
    const actualStart = {
      islandId: battleIsland.id,
      beforeLevel: beforeStartLevel,
      islandLevel: Number(battleIslandState.enemyProfile.level || 0),
      battleLevel: Number(state.battleState?.enemyCombatant?.level || 0),
      levelFloorTarget: Number(battleIslandState.enemyProfile._levelFloorTarget || 0),
    };
    return {
      config: qa.config(),
      mappings: {
        island1: qa.regionIdsForIsland("island-1"),
        island9: qa.regionIdsForIsland("island-9"),
        island49: qa.regionIdsForIsland("island-49"),
        horizontalBC: routeRegions("route-island-23-island-24"),
        northBoundary: routeRegions("route-island-4-island-11"),
        southBoundary: routeRegions("route-island-41-island-48"),
        reverseMountain: routeRegions("route-reverse-center"),
      },
      onePlay: {
        north: qa.keysForRegions(["north_yonko"], onePlay),
        gWest: qa.keysForRegions(["route_g_west"], onePlay),
        south: qa.keysForRegions(["south_yonko"], onePlay),
      },
      twoPlay: {
        north: qa.keysForRegions(["north_yonko"], twoPlay),
        gWest: qa.keysForRegions(["route_g_west"], twoPlay),
        south: qa.keysForRegions(["south_yonko"], twoPlay),
      },
      activeEnemyIslands,
      levelFloor: {
        target: qa.minimumLevel(floorPlayer),
        raisedLowLevel: raisedLow.level,
        raisedFrom: raisedLow._levelFloorAdjustedFrom,
        unchangedHighLevel: highProfile.level,
        seaLevel: seaEnemy.level,
        seaRegions: seaEnemy.spawnRegionIds,
        actualStart,
      },
      specialEncounter: {
        northPostgame,
        pickedKey: imu?.key || "",
        marked: imu?.isRegionalSpawnEncounter === true,
        domiEnemyStages: domi?.effects?.enemyStages || {},
        finalStorySuppressed: qa.isFinalGateBattle({ islandKind: "enemy", isRegionalSpawnEncounter: true, enemyCombatant: { key: "final_imu", isRegionalSpawnEncounter: true } }) === false,
        finalStoryStillWorks: qa.isFinalGateBattle({ islandKind: "final_gate", isFinalGate: true, enemyCombatant: { key: "final_imu" } }) === true,
        godKnightStorySuppressed: qa.isElbaphGodKnightBattle({ islandKind: "enemy", isRegionalSpawnEncounter: true, enemyCombatant: { key: "god_knight_killingham", isRegionalSpawnEncounter: true } }) === false,
        godKnightStoryStillWorks: qa.isElbaphGodKnightBattle({ islandKind: "elbaph_god_knight", isElbaphGodKnight: true, enemyCombatant: { key: "god_knight_killingham" } }) === true,
      },
    };
  });

  expectEqual(failures, "mapping:island1", result.mappings.island1, ["north_yonko"]);
  expectEqual(failures, "mapping:island9", result.mappings.island9, ["route_b_west", "route_b", "route_b_east"]);
  expectEqual(failures, "mapping:island49", result.mappings.island49, ["south_yonko"]);
  expectEqual(failures, "mapping:horizontalBC", result.mappings.horizontalBC, ["route_b", "route_b_east", "route_c_west", "route_c"]);
  expectEqual(failures, "mapping:northBoundary", result.mappings.northBoundary, ["north_yonko"]);
  expectEqual(failures, "mapping:southBoundary", result.mappings.southBoundary, ["south_yonko"]);
  expectEqual(failures, "mapping:reverseMountain", result.mappings.reverseMountain, ["route_a"]);
  if (result.onePlay.north.includes("final_imu") || result.onePlay.gWest.includes("god_knight_killingham") || result.onePlay.south.includes("god_knight_sommers")) {
    failures.push(`one-play: postgame-only enemies leaked: ${JSON.stringify(result.onePlay)}`);
  }
  if (!result.twoPlay.north.includes("final_imu") || !result.twoPlay.gWest.includes("god_knight_killingham") || !result.twoPlay.south.includes("god_knight_sommers")) {
    failures.push(`two-play: postgame-only enemies missing: ${JSON.stringify(result.twoPlay)}`);
  }
  const invalidIsland = result.activeEnemyIslands.find((entry) => !entry.allowed || !entry.marked || entry.version !== result.config.version);
  if (invalidIsland) failures.push(`island spawn: invalid live profile: ${JSON.stringify(invalidIsland)}`);
  if (result.levelFloor.target !== 55 || result.levelFloor.raisedLowLevel !== 55 || result.levelFloor.raisedFrom !== 10
    || result.levelFloor.unchangedHighLevel !== 70 || result.levelFloor.seaLevel < 55
    || result.levelFloor.actualStart.beforeLevel >= 55 || result.levelFloor.actualStart.islandLevel !== 55
    || result.levelFloor.actualStart.battleLevel !== 55 || result.levelFloor.actualStart.levelFloorTarget !== 55) {
    failures.push(`level floor: mismatch: ${JSON.stringify(result.levelFloor)}`);
  }
  if (result.specialEncounter.pickedKey !== "final_imu" || !result.specialEncounter.marked
    || result.specialEncounter.domiEnemyStages.atk !== -1 || result.specialEncounter.domiEnemyStages.satk !== -1
    || !result.specialEncounter.finalStorySuppressed || !result.specialEncounter.finalStoryStillWorks
    || !result.specialEncounter.godKnightStorySuppressed || !result.specialEncounter.godKnightStoryStillWorks) {
    failures.push(`special encounter isolation: mismatch: ${JSON.stringify(result.specialEncounter)}`);
  }
  await context.close();
  return result;
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
  await page.goto(`${ROOT_URL}/board_start.html?regional_spawn_sync=${profile.userId}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.BoardShared && window.io, null, { timeout: 15000 });
  return { ...profile, context, page };
}

async function enterLanRoom(device, roomCode, create) {
  await device.page.click("#openBoardFlowBtn");
  if (create) await device.page.click("#createBoardRoomBtn");
  else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  await device.page.waitForFunction((expected) => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    return document.querySelector('section[data-view="lobby"]')?.classList.contains("active")
      && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, roomCode, { timeout: 15000 });
}

async function runLanSync(browser, errors, failures) {
  const host = await createLanDevice(browser, { userId: 889811, clientId: "regional-spawn-host", name: "航線生成房主" }, errors);
  const guest = await createLanDevice(browser, { userId: 889812, clientId: "regional-spawn-guest", name: "航線生成玩家" }, errors);
  try {
    await enterLanRoom(host, "", true);
    const roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterLanRoom(guest, roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardStartBtn");
    await Promise.all([host.page, guest.page].map((page) => page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 20000 })));
    await Promise.all([host.page, guest.page].map((page) => page.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const status = debug?.boardLanStatus?.();
      return debug?.enemySpawnQa && status?.connected && !status.awaitingInitialState;
    }, null, { timeout: 30000 })));

    const pushed = await host.page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const game = state.gameState;
      const qa = debug.enemySpawnQa;
      game.postgameWorld = game.postgameWorld || {};
      game.postgameWorld.unlocked = true;
      qa.rebalanceIslands(game);
      const floorPlayer = { crew: [{ level: 80 }] };
      const island = game.boardData.islands
        .filter((entry) => entry.kind === "enemy")
        .sort((a, b) => Number(game.boardData.islandStates[a.id]?.enemyProfile?.level || 999)
          - Number(game.boardData.islandStates[b.id]?.enemyProfile?.level || 999))[0];
      const islandState = game.boardData.islandStates[island.id];
      const adjustment = qa.raiseIsland(island, islandState, floorPlayer);
      const summary = game.boardData.islands.filter((entry) => entry.kind === "enemy").map((entry) => {
        const profile = game.boardData.islandStates[entry.id].enemyProfile;
        return [entry.id, profile.key, profile.level, profile.spawnRegionIds, profile._spawnPostgameUnlocked];
      });
      debug.pushBoardLanState("regional-enemy-spawn-qa");
      return {
        summary,
        adjustment,
        adjustedIslandId: island.id,
        adjustedProfile: summary.find((entry) => entry[0] === island.id),
        version: debug.boardLanStatus().version,
      };
    });

    await guest.page.waitForFunction(({ minimumVersion, adjustedIslandId, expectedProfile }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.()?.gameState;
      const profile = game?.boardData?.islandStates?.[adjustedIslandId]?.enemyProfile;
      const receivedProfile = profile
        ? [adjustedIslandId, profile.key, profile.level, profile.spawnRegionIds, profile._spawnPostgameUnlocked]
        : null;
      return debug?.boardLanStatus?.().version >= minimumVersion
        && JSON.stringify(receivedProfile) === JSON.stringify(expectedProfile);
    }, {
      minimumVersion: pushed.version,
      adjustedIslandId: pushed.adjustedIslandId,
      expectedProfile: pushed.adjustedProfile,
    }, { timeout: 15000 });
    const received = await guest.page.evaluate((adjustedIslandId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const summary = game.boardData.islands.filter((entry) => entry.kind === "enemy").map((entry) => {
        const profile = game.boardData.islandStates[entry.id].enemyProfile;
        return [entry.id, profile.key, profile.level, profile.spawnRegionIds, profile._spawnPostgameUnlocked];
      });
      const invalid = game.boardData.islands.filter((entry) => entry.kind === "enemy").filter((entry) => {
        const profile = game.boardData.islandStates[entry.id].enemyProfile;
        const regionIds = debug.enemySpawnQa.regionIdsForIsland(entry.id);
        return !debug.enemySpawnQa.profileAllowed(profile, regionIds, game) || profile.isRegionalSpawnEncounter !== true;
      });
      return { summary, target: summary.find((entry) => entry[0] === adjustedIslandId), invalidCount: invalid.length };
    }, pushed.adjustedIslandId);
    expectEqual(failures, "lan:adjusted regional enemy state", received.target, pushed.adjustedProfile);
    if (received.invalidCount !== 0) failures.push(`lan: received ${received.invalidCount} invalid regional profiles`);
    if (!pushed.adjustment || pushed.adjustment.toLevel !== 75) {
      failures.push(`lan: level floor was not applied before sync: ${JSON.stringify(pushed.adjustment)}`);
    }
    return { roomCode, pushedVersion: pushed.version, enemyIslandCount: received.summary.length, levelAdjustment: pushed.adjustment };
  } finally {
    await Promise.all([host.context.close(), guest.context.close()]);
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const failures = [];
  try {
    const designer = await inspectDesigner(browser, errors, failures);
    const rules = await inspectRules(browser, errors, failures);
    const lan = await runLanSync(browser, errors, failures);
    const functionalErrors = errors.filter((message) => !message.includes("404 (Not Found)"));
    if (functionalErrors.length) failures.push(...functionalErrors);
    const report = { ok: failures.length === 0, failures, browserErrors: functionalErrors, designer, rules, lan };
    fs.writeFileSync(path.join(OUTPUT_DIR, "regional_enemy_spawn_report.json"), JSON.stringify(report, null, 2), "utf8");
    console.log(JSON.stringify(report, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
