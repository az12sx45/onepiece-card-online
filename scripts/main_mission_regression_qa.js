const fs = require("fs");
const http = require("http");
const path = require("path");
const { JSDOM } = require("jsdom");

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeout = 12000, step = 40) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await wait(step);
  }
  throw new Error("Timed out while waiting for main-mission QA state.");
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
    res.setHeader("Content-Type", {
      ".html": "text/html; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
      ".webp": "image/webp",
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
    }[ext] || "application/octet-stream");
    res.end(fs.readFileSync(localPath));
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(41739, "127.0.0.1", () => resolve(server));
  });
}

function requireCheck(condition, message, errors) {
  if (!condition) errors.push(message);
}

async function main() {
  const root = path.join(__dirname, "..");
  const publicDir = path.join(root, "public");
  const server = await startStaticServer(publicDir);
  const errors = [];
  let dom;
  try {
    dom = await JSDOM.fromURL("http://127.0.0.1:41739/board_game.html?main_mission_qa=1", {
      runScripts: "dangerously",
      resources: "usable",
      pretendToBeVisual: true,
      beforeParse(window) {
        const nativeSetTimeout = window.setTimeout.bind(window);
        const nativeSetInterval = window.setInterval.bind(window);
        window.setTimeout = (fn, delay = 0, ...args) => nativeSetTimeout(fn, Math.min(Number(delay) || 0, 4), ...args);
        window.setInterval = (fn, delay = 0, ...args) => nativeSetInterval(fn, Math.min(Math.max(Number(delay) || 0, 8), 25), ...args);
        window.requestAnimationFrame = (callback) => window.setTimeout(() => callback(Date.now()), 4);
        window.cancelAnimationFrame = (id) => window.clearTimeout(id);
      },
    });

    const { window } = dom;
    const debug = await waitFor(() => window.__BOARD_GAME_DEBUG__?.mainMissionQa && window.BoardCards?.cards?.length
      ? window.__BOARD_GAME_DEBUG__
      : null);
    const qa = debug.mainMissionQa;
    const state = debug.getState();
    const game = state.gameState;
    const missions = qa.definitions();
    const player = game.players[0];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    player.crew = window.BoardCards.cards.slice(0, 4).map((card) => debug.cloneCard(card));
    player.activeCrewIndex = 0;
    player.isCPU = true;
    player.isCpu = true;
    player.cpu = true;
    debug.recalcPlayerDerivedStats(player);

    requireCheck(missions.length === 120, `expected 120 main missions, got ${missions.length}`, errors);
    const goalGroups = new Map();
    missions.forEach((mission) => {
      const key = JSON.stringify(mission.goal || {});
      if (!goalGroups.has(key)) goalGroups.set(key, []);
      goalGroups.get(key).push(mission.order);
    });
    const exactGoalDuplicates = [...goalGroups.values()].filter((orders) => orders.length > 1);
    requireCheck(exactGoalDuplicates.length === 0, `exact duplicate goals remain: ${JSON.stringify(exactGoalDuplicates)}`, errors);

    let cumulativeBounty = 0;
    const bountyChecks = [];
    for (const mission of missions) {
      if (mission.goal?.kind === "bounty_total") {
        bountyChecks.push({ order: mission.order, threshold: mission.goal.target, priorMainBounty: cumulativeBounty });
        requireCheck(Number(mission.goal.target) > cumulativeBounty, `main_${mission.order} bounty gate is still self-funded`, errors);
      }
      cumulativeBounty += Math.max(0, Number(mission.bounty || 0));
    }

    const waterSevenRewards = missions
      .filter((mission) => mission.order >= 41 && mission.order <= 44)
      .flatMap((mission) => mission.items || []);
    const plankCount = waterSevenRewards.filter((item) => item.name === "船材木板").reduce((sum, item) => sum + Number(item.qty || 1), 0);
    const toolboxCount = waterSevenRewards.filter((item) => item.name === "船匠工具箱").reduce((sum, item) => sum + Number(item.qty || 1), 0);
    requireCheck(plankCount >= 20, `Water Seven pre-gate planks ${plankCount}/20`, errors);
    requireCheck(toolboxCount >= 4, `Water Seven pre-gate toolboxes ${toolboxCount}/4`, errors);
    requireCheck(missions[0].exp === 77, `main_001 EXP expected 77, got ${missions[0].exp}`, errors);
    requireCheck(missions[19].exp === 330, `main_020 EXP expected 330, got ${missions[19].exp}`, errors);
    requireCheck(missions[29].exp === 924, `main_030 EXP expected 924, got ${missions[29].exp}`, errors);
    requireCheck(missions[115].goal?.event === "final_gate_phase_two", "main_116 is not bound to phase-two event", errors);
    requireCheck(missions[119].items?.some((item) => item.name === "黎明航路生命卡"), "main_120 permanent route pass is missing", errors);
    requireCheck(window.GAME_ITEMS?.dawn_paw_route_pass?.important === true, "permanent route pass item is not registered as important", errors);
    const formalItemNames = new Set(Object.values(window.GAME_ITEMS || {}).map((item) => item.name));
    const unresolvedRewards = missions.flatMap((mission) => (mission.items || [])
      .filter((item) => !formalItemNames.has(item.name))
      .map((item) => ({ order: mission.order, name: item.name })));
    requireCheck(unresolvedRewards.length === 0, `unresolved main reward items: ${JSON.stringify(unresolvedRewards)}`, errors);

    player.mainMission = null;
    qa.normalize(player);
    qa.refresh(player, { notify: false });
    requireCheck(player.mainMission.currentMissionId === "main_001" && player.mainMission.completed, "CPU main_001 did not complete from crew state", errors);
    requireCheck(qa.claim(player, "main_001", { render: false, silent: true }), "CPU could not claim main_001", errors);
    requireCheck(player.mainMission.currentMissionId === "main_002", `CPU expected main_002, got ${player.mainMission.currentMissionId}`, errors);
    requireCheck(player.mainMission.completed === true, "CPU main_002 did not read live game_started state", errors);
    requireCheck(!Object.prototype.hasOwnProperty.call(player.mainMission, "goalBaseline"), "CPU main_002 incorrectly received a goal baseline", errors);
    qa.record(player, { type: "backpack_open" });
    requireCheck(player.mainMission.claimedMissionIds.includes("main_002"), "CPU main_002 was not auto-claimed on the next formal event", errors);

    const preMainFive = missions.slice(0, 4).map((mission) => mission.id);
    player.mainMission = {
      currentMissionId: "main_004",
      progress: 1,
      target: 1,
      completed: true,
      claimedMissionIds: preMainFive.slice(0, 3),
      stats: { dice_roll: 1, sea_step: 7 },
    };
    qa.normalize(player);
    requireCheck(qa.claim(player, "main_004", { render: false, silent: true }), "CPU could not claim prepared main_004", errors);
    requireCheck(player.mainMission.currentMissionId === "main_005", `CPU expected main_005, got ${player.mainMission.currentMissionId}`, errors);
    requireCheck(player.mainMission.goalBaseline === 7, `CPU cumulative sea-step baseline expected 7, got ${player.mainMission.goalBaseline}`, errors);
    const liveStateGoalKinds = new Set([
      "game_started", "crew_count", "discovered_islands", "bounty_total", "ship_material", "ship_slots", "ship_gear", "ship_upgrades",
      "road_poneglyphs", "final_island_unlocked", "elbaph_killingham", "elbaph_sommers", "final_gate_chopper", "final_gate_black_turn_clear",
      "final_gate_clear", "final_gate_aftermath", "visit_island_kind", "final_ending",
    ]);
    const stateGoalsUsingBaseline = missions
      .filter((mission) => liveStateGoalKinds.has(mission.goal?.kind))
      .filter((mission) => qa.usesCpuBaseline(player, mission))
      .map((mission) => mission.id);
    requireCheck(stateGoalsUsingBaseline.length === 0, `live state goals still use CPU baselines: ${stateGoalsUsingBaseline.join(", ")}`, errors);

    player.isCPU = false;
    player.isCpu = false;
    player.cpu = false;
    player.mainMission = {
      currentMissionId: "main_017",
      progress: 0,
      target: 4,
      completed: false,
      claimedMissionIds: missions.slice(0, 16).map((mission) => mission.id),
      stats: { crew_formation_confirmed: 1 },
    };
    qa.normalize(player);
    qa.refresh(player, { notify: false });
    const humanClaimed = qa.claimHumanReady(player, "main_017");
    requireCheck(humanClaimed === 2, `human batch claim expected 2 missions, got ${humanClaimed}`, errors);
    requireCheck(player.mainMission.currentMissionId === "main_019", `human expected main_019 after batch claim, got ${player.mainMission.currentMissionId}`, errors);

    const coinsBeforeFullClaim = Math.max(0, Number(player.coins || 0));
    const bountyBeforeFullClaim = Math.max(0, Number(player.bounty || 0));
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.activeCrewIndex = 0;
    debug.recalcPlayerDerivedStats(player);
    player.mainMission = null;
    qa.normalize(player);
    let fullClaimCount = 0;
    const levelMilestones = {};
    for (const mission of missions) {
      qa.normalize(player);
      requireCheck(player.mainMission.currentMissionId === mission.id, `full claim expected ${mission.id}, got ${player.mainMission.currentMissionId}`, errors);
      player.mainMission.progress = Math.max(1, Number(mission.goal?.target || 1));
      player.mainMission.target = player.mainMission.progress;
      player.mainMission.completed = true;
      if (!qa.claim(player, mission.id, { render: false, silent: true })) break;
      fullClaimCount += 1;
      if ([10, 20, 30, 60, 100, 120].includes(mission.order)) {
        levelMilestones[mission.order] = player.crew.map((card) => Number(card.level || 1));
      }
    }
    const expectedCoins = missions.reduce((sum, mission) => sum + Number(mission.coins || 0), 0);
    const expectedBounty = missions.reduce((sum, mission) => sum + Number(mission.bounty || 0), 0);
    requireCheck(fullClaimCount === 120, `full human claim sequence stopped at ${fullClaimCount}/120`, errors);
    requireCheck(player.mainMission.currentMissionId === "" && player.mainMission.completed, "full human claim did not reach completed terminal state", errors);
    requireCheck(Number(player.coins || 0) - coinsBeforeFullClaim === expectedCoins, "full human claim coin total mismatch", errors);
    requireCheck(Number(player.bounty || 0) - bountyBeforeFullClaim === expectedBounty, "full human claim bounty total mismatch", errors);

    const source = fs.readFileSync(path.join(publicDir, "js", "board_game.js"), "utf8");
    [
      "final_gate_phase_two",
      "judicial_intermission_ready",
      "final_activation_started",
      "final_robin_reading",
      "final_route_revealed",
      "final_route_step",
      "elbaph_rescue_briefing",
      "elbaph_god_knights_arrived",
      "imu_descent_seen",
      "final_gate_battle_started",
      "final_gate_black_turn_cast",
      "final_gate_black_turn_target",
    ].forEach((eventName) => requireCheck(source.includes(`type: "${eventName}"`), `missing runtime event ${eventName}`, errors));

    const report = {
      ok: errors.length === 0,
      errors,
      missionCount: missions.length,
      exactGoalDuplicates,
      bountyChecks,
      waterSevenRewards: { planks: plankCount, toolboxes: toolboxCount },
      earlyExp: { main001: missions[0].exp, main020: missions[19].exp, main030: missions[29].exp },
      cpuMain2: {
        claimed: player.mainMission.claimedMissionIds.includes("main_002"),
        stateGoalUsesBaseline: qa.usesCpuBaseline(player, missions[1]),
        liveStateGoalsUsingBaseline: stateGoalsUsingBaseline,
      },
      humanBatchClaimed: humanClaimed,
      fullHumanClaimed: fullClaimCount,
      levelMilestones,
      unresolvedRewards,
      finalReward: missions[119].items,
    };
    console.log(JSON.stringify(report, null, 2));
    if (errors.length) process.exitCode = 1;
  } finally {
    dom?.window?.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
