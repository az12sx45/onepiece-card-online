const fs = require("fs");
const http = require("http");
const path = require("path");
const { JSDOM, VirtualConsole } = require("jsdom");

const DEFAULT_TEAM = ["nami", "zoro", "chopper"];
const STORY_RECRUIT_CARD_IDS = new Set([
  "whitebeard",
  "ace",
  "marco",
  "jozu",
  "vista",
  "izo",
  "little_oars_jr",
  "squard",
  "prison_buggy",
  "prison_mr3",
  "prison_mr2_bon_clay",
  "prison_mr1_daz_bones",
  "prison_crocodile",
]);
const LEVEL_MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 99];
const MARINEFORD_TARGET_ENEMY_KEYS = new Set(["akainu", "aokiji", "kizaru", "sengoku"]);
const IMPEL_DOWN_TARGET_ENEMY_KEYS = new Set([
  "impel_l1_sadie",
  "impel_l2_minochihuahua",
  "impel_l3_minokoala",
  "impel_l4_minotaur",
  "impel_l5_minorhino",
  "impel_l6_hannyabal",
  "magellan",
]);
const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const WAIT_CAP_MS = Math.max(1, Number(process.env.GROWTH_WAIT_CAP_MS || 8));
const FINAL_ENDING_MIN_AVG_LEVEL = 88;
const FINAL_ENDING_ALT_AVG_LEVEL = 82;
const FINAL_ENDING_MIN_POWER = 185;
const TRAINING_STATS = ["hp", "atk", "def", "satk", "sdef", "spd"];
const TRAINING_STAT_LABELS = { hp: "生命", atk: "力量", def: "防禦", satk: "戰術", sdef: "意志", spd: "速度" };
const TRAINING_MAX_PER_STAT = 30;
const TRAINING_FULL_TOTAL = TRAINING_STATS.length * TRAINING_MAX_PER_STAT;
const FINAL_ENDING_MIN_AVG_TRAINING = 120;
const WATER_SEVEN_UPGRADE_PARTS = ["training", "kitchen", "watchtower", "rudder", "sail"];
const WATER_SEVEN_MATERIAL_ITEM_IDS = {
  plank: "ship_plank",
  toolbox: "ship_toolbox",
  resin: "ship_coating_resin",
  adam: "ship_adam_wood",
};
const WATER_SEVEN_UPGRADE_COSTS = {
  sail: [
    { berries: 8000, plank: 5, toolbox: 1 },
    { berries: 18000, plank: 9, toolbox: 2 },
    { berries: 36000, plank: 14, toolbox: 4, adam: 2 },
  ],
  rudder: [
    { berries: 9000, plank: 4, toolbox: 2 },
    { berries: 20000, plank: 8, toolbox: 3 },
    { berries: 42000, plank: 12, toolbox: 5, adam: 2 },
  ],
  watchtower: [
    { berries: 7000, plank: 3, toolbox: 2 },
    { berries: 16000, plank: 6, toolbox: 3, resin: 1 },
    { berries: 34000, plank: 10, toolbox: 4, resin: 2 },
  ],
  kitchen: [
    { berries: 7500, plank: 4, toolbox: 1 },
    { berries: 17500, plank: 7, toolbox: 2, resin: 1 },
    { berries: 38000, plank: 11, toolbox: 4, adam: 1, resin: 2 },
  ],
  training: [
    { berries: 6500, plank: 5 },
    { berries: 15000, plank: 8, toolbox: 2 },
    { berries: 32000, plank: 12, toolbox: 3, adam: 1 },
  ],
};
const WATER_SEVEN_SLOT_COSTS = [
  { berries: 6000, plank: 3 },
  { berries: 10000, plank: 5, toolbox: 1 },
  { berries: 16000, toolbox: 3, plank: 8, adam: 1 },
  { berries: 40000, toolbox: 5, plank: 12, adam: 3, resin: 2 },
];
const ATTRIBUTE_ADVANTAGE = {
  "力": "技",
  "技": "速",
  "速": "力",
};
let enemyTargetCatalogCache = null;

function parseArgs(argv) {
  const config = {
    seeds: [7412, 20260420, 20260520],
    maxTurns: 500,
    maxMinutes: 30,
    turnTimeoutMs: 90000,
    startMode: "draft",
    team: [],
    draftPicks: 3,
    playerCount: 1,
    restartOnEarlyFailure: true,
    targetAllEnemies: false,
    targetEnding: false,
    focusEndingCaptain: null,
    continueAfterTargets: false,
    maxRestarts: 4,
    earlyRestartTurns: 160,
    outDir: path.join(ROOT, "tmp", "growth_curve"),
    label: "",
    resumeSave: "",
    progressEvery: 10,
  };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--seeds" && next) {
      config.seeds = next.split(",").map((value) => Number(value.trim())).filter(Number.isFinite);
      index += 1;
    } else if (arg === "--runs" && next) {
      const count = Math.max(1, Math.round(Number(next) || 1));
      config.seeds = Array.from({ length: count }, (_, runIndex) => 910001 + runIndex * 97);
      index += 1;
    } else if (arg === "--turns" && next) {
      config.maxTurns = Math.max(1, Math.round(Number(next) || config.maxTurns));
      index += 1;
    } else if (arg === "--minutes" && next) {
      config.maxMinutes = Math.max(1, Number(next) || config.maxMinutes);
      index += 1;
    } else if (arg === "--turn-timeout" && next) {
      config.turnTimeoutMs = Math.max(1000, Math.round(Number(next) || config.turnTimeoutMs));
      index += 1;
    } else if (arg === "--team" && next) {
      config.team = next.split(",").map((value) => value.trim()).filter(Boolean);
      config.startMode = "fixed";
      index += 1;
    } else if (arg === "--start-mode" && next) {
      config.startMode = ["draft", "fixed"].includes(next) ? next : config.startMode;
      index += 1;
    } else if (arg === "--draft-picks" && next) {
      config.draftPicks = Math.max(1, Math.min(6, Math.round(Number(next) || config.draftPicks)));
      index += 1;
    } else if ((arg === "--players" || arg === "--player-count") && next) {
      config.playerCount = Math.max(1, Math.min(4, Math.round(Number(next) || config.playerCount)));
      index += 1;
    } else if (arg === "--no-restart") {
      config.restartOnEarlyFailure = false;
    } else if (arg === "--target-all-enemies") {
      config.targetAllEnemies = true;
    } else if (arg === "--target-ending") {
      config.targetEnding = true;
    } else if (arg === "--focus-ending-captain") {
      config.focusEndingCaptain = true;
    } else if (arg === "--no-focus-ending-captain") {
      config.focusEndingCaptain = false;
    } else if (arg === "--continue-after-targets") {
      config.continueAfterTargets = true;
    } else if (arg === "--max-restarts" && next) {
      config.maxRestarts = Math.max(0, Math.round(Number(next) || config.maxRestarts));
      index += 1;
    } else if (arg === "--early-restart-turns" && next) {
      config.earlyRestartTurns = Math.max(1, Math.round(Number(next) || config.earlyRestartTurns));
      index += 1;
    } else if (arg === "--out" && next) {
      config.outDir = path.resolve(next);
      index += 1;
    } else if (arg === "--label" && next) {
      config.label = next.replace(/[^\w.-]+/g, "_").slice(0, 40);
      index += 1;
    } else if (arg === "--resume-save" && next) {
      config.resumeSave = path.resolve(next);
      index += 1;
    } else if (arg === "--progress-every" && next) {
      config.progressEvery = Math.max(1, Math.round(Number(next) || config.progressEvery));
      index += 1;
    }
  }
  if (!config.seeds.length) config.seeds = [Date.now() % 1000000];
  if (config.startMode === "fixed" && !config.team.length) config.team = DEFAULT_TEAM.slice();
  if (config.focusEndingCaptain === null) {
    config.focusEndingCaptain = Boolean(config.targetEnding && config.playerCount > 1);
  }
  return config;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, Math.min(ms, WAIT_CAP_MS)));
}

function waitRaw(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(check, timeout = 8000, step = 20) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = check();
    if (value) return value;
    await wait(step);
  }
  throw new Error("Timed out while waiting for game state.");
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
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadEnemyTargetCatalog() {
  if (enemyTargetCatalogCache) return enemyTargetCatalogCache;
  const boardGamePath = path.join(PUBLIC_DIR, "js", "board_game.js");
  const source = fs.existsSync(boardGamePath) ? fs.readFileSync(boardGamePath, "utf8") : "";
  const byKey = new Map();
  const add = (key, name, tier) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey) return;
    if (!byKey.has(normalizedKey)) {
      byKey.set(normalizedKey, {
        key: normalizedKey,
        name: String(name || normalizedKey),
        tier: String(tier || ""),
      });
    }
  };
  for (const match of source.matchAll(/enemyProfile\(\s*"([^"]+)"\s*,\s*"([^"]+)"\s*,\s*"([^"]+)"/g)) {
    add(match[1], match[2], match[3]);
  }
  for (const match of source.matchAll(/enemyProfile\(\s*\{\s*key:\s*"([^"]+)"\s*,\s*name:\s*"([^"]+)"\s*,\s*tier:\s*"([^"]+)"/g)) {
    add(match[1], match[2], match[3]);
  }
  enemyTargetCatalogCache = Array.from(byKey.values())
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || a.name.localeCompare(b.name, "zh-Hant"));
  return enemyTargetCatalogCache;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function hashString(value) {
  let hash = 2166136261;
  String(value || "").split("").forEach((char) => {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  });
  return hash >>> 0;
}

function createRng(seed) {
  let state = hashString(seed) || 1;
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state);
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}

function tierRank(tier) {
  return Number(String(tier || "T5").replace(/[^\d]/g, "")) || 5;
}

function tierFromDiceRoll(roll) {
  return `T${Math.min(6, Math.max(1, Math.round(Number(roll) || 6)))}`;
}

function hpRatio(player) {
  const cards = (player.crew || []).filter(Boolean);
  if (!cards.length) return 1;
  return average(cards.map((card) => Number(card.currentHp || 0) / Math.max(1, Number(card.baseStats?.hp || card.hp || 1))));
}

function ppRatio(player) {
  const moves = (player.crew || []).flatMap((card) => card?.moveSet || []);
  if (!moves.length) return 1;
  return average(moves.map((move) => Number(move.currentPP ?? move.pp ?? 0) / Math.max(1, Number(move.pp || 1))));
}

function crewAvgLevel(player) {
  return average((player?.crew || []).map((card) => Number(card?.level || 1)));
}

function completedMissionCount(player) {
  return (player?.activeMissions || []).filter((entry) => entry?.completed).length;
}

function activeMissionCount(player) {
  return Array.isArray(player?.activeMissions) ? player.activeMissions.length : 0;
}

function defeatedEnemyCodex(player) {
  return (player?.defeatedEnemies || [])
    .filter((entry) => entry?.key)
    .map((entry) => ({
      key: String(entry.key),
      name: entry.name || entry.key,
      tier: entry.tier || "",
      count: Number(entry.count || 1),
      highestLevel: Number(entry.highestLevel || entry.level || 1),
      seaEncounterCount: Number(entry.seaEncounterCount || 0),
      islandVictoryCount: Number(entry.islandVictoryCount || 0),
      lastPlace: entry.lastPlace || "",
    }))
    .sort((a, b) => tierRank(a.tier) - tierRank(b.tier) || b.highestLevel - a.highestLevel || a.name.localeCompare(b.name, "zh-Hant"));
}

function enemyCoverageSummary(player) {
  const catalog = loadEnemyTargetCatalog();
  const defeated = defeatedEnemyCodex(player);
  const defeatedKeys = new Set(defeated.map((entry) => entry.key));
  const missing = catalog.filter((entry) => !defeatedKeys.has(entry.key));
  return {
    totalTargets: catalog.length,
    defeatedTargets: catalog.length - missing.length,
    remaining: missing.length,
    percent: catalog.length ? Number((((catalog.length - missing.length) / catalog.length) * 100).toFixed(1)) : 0,
    missing,
  };
}

function hasDefeatedEnemyKey(player, enemyKey) {
  if (!enemyKey) return false;
  return defeatedEnemyCodex(player).some((entry) => entry.key === String(enemyKey));
}

function missingAnyEnemyKey(player, enemyKeys) {
  return Array.from(enemyKeys || []).some((key) => !hasDefeatedEnemyKey(player, key));
}

function updateMemoryFromLogs(memory, lines, turn) {
  memory.avoidIslandNames ||= {};
  for (const name of Object.keys(memory.avoidIslandNames)) {
    if (Number(memory.avoidIslandNames[name] || 0) <= turn) delete memory.avoidIslandNames[name];
  }
  (lines || []).forEach((line) => {
    const escapeMatch = String(line || "").match(/成功脫離\s+(.+?)。/);
    if (escapeMatch?.[1]) {
      memory.avoidIslandNames[escapeMatch[1].trim()] = turn + 70;
    }
    const retreatMatch = String(line || "").match(/在\s+(.+?)\s+撤退骰.+成功脫離/);
    if (retreatMatch?.[1]) {
      memory.avoidIslandNames[retreatMatch[1].trim()] = turn + 70;
    }
  });
}

function missionDefById(window, missionId) {
  return (window.BOARD_MISSIONS || []).find((mission) => mission.id === missionId) || null;
}

function cardMaxStat(card, key) {
  return Number(card?.baseStats?.[key] ?? card?.[key] ?? 0);
}

function cardCombatScore(card) {
  const moves = Array.isArray(card?.moveSet) ? card.moveSet : [];
  const movePower = moves.reduce((sum, move) => {
    const range = move?.damageRange;
    const rangePower = range ? (Number(range.min || 0) + Number(range.max || 0)) / 2 : 0;
    return sum + Math.max(Number(move?.power || 0), rangePower);
  }, 0);
  return Math.max(cardMaxStat(card, "atk"), cardMaxStat(card, "satk"))
    + cardMaxStat(card, "spd") * 0.55
    + cardMaxStat(card, "hp") * 0.08
    + movePower * 0.08;
}

function cardMaxHp(card) {
  return Math.max(1, Number(card?.maxHp || card?.baseStats?.hp || card?.hp || 1));
}

function cardHpRatio(card) {
  return Math.max(0, Number(card?.currentHp || 0)) / cardMaxHp(card);
}

function playerInventoryCount(player, itemId) {
  const formal = Math.max(0, Math.round(Number(player?.inventory?.items?.[itemId] || 0)));
  if (itemId === "heal_2") return Math.max(formal, Math.max(0, Math.round(Number(player?.smallSupplies || 0))));
  if (itemId === "battle_food") return Math.max(formal, Math.max(0, Math.round(Number(player?.battleFood || 0))));
  if (itemId === "guard_charm") return Math.max(formal, Math.max(0, Math.round(Number(player?.guardCharm || 0))));
  if (itemId === "pointer") return Math.max(formal, Math.max(0, Math.round(Number(player?.routeInsight || 0))));
  if (itemId === "fixed_step") return Math.max(formal, Math.max(0, Math.round(Number(player?.fixedStepTokens || 0))));
  return formal;
}

function playerCarryInventoryCount(player, itemId) {
  return (player?.items || []).filter((item) => item?.id === itemId).length;
}

function equippedCarryCount(player, itemId) {
  return (player?.crew || []).filter((card) => card?.battleCarryItem?.id === itemId).length;
}

function ownedItemCount(player, itemId) {
  return playerInventoryCount(player, itemId) + playerCarryInventoryCount(player, itemId) + equippedCarryCount(player, itemId);
}

function itemTierScore(item) {
  return { C: 8, B: 18, A: 34, S: 58 }[String(item?.rarity || "").toUpperCase()] || 12;
}

function closeBoardModal(window, debug) {
  if (typeof debug?.closeModal === "function") {
    debug.closeModal();
    return;
  }
  const modalBack = window.document.getElementById("boardModalBack");
  const modal = window.document.getElementById("boardModal");
  if (modalBack) {
    modalBack.classList.remove("open");
    delete modalBack.dataset.forceChoice;
    delete modalBack.dataset.backdropClose;
  }
  if (modal) {
    modal.className = "board-modal";
    modal.innerHTML = "";
  }
}

function getGameItems(debug) {
  try {
    return debug.gameItems?.() || {};
  } catch (_error) {
    return {};
  }
}

function gameItemDef(debug, itemOrId) {
  const id = typeof itemOrId === "string" ? itemOrId : String(itemOrId?.id || "");
  if (!id) return null;
  return getGameItems(debug)[id] || (typeof itemOrId === "object" ? itemOrId : null);
}

function trainingTotal(card) {
  return TRAINING_STATS.reduce((sum, stat) => sum + Number(card?.training?.[stat] || 0), 0);
}

function trainingRoom(card) {
  return TRAINING_STATS.reduce((sum, stat) => {
    return sum + Math.max(0, TRAINING_MAX_PER_STAT - Number(card?.training?.[stat] || 0));
  }, 0);
}

function crewAverageTraining(player) {
  const crew = (player?.crew || []).filter(Boolean);
  return crew.length ? average(crew.map(trainingTotal)) : 0;
}

function crewTrainingRoom(player) {
  return (player?.crew || []).reduce((sum, card) => sum + trainingRoom(card), 0);
}

function trainingItemPointsForTest(itemDef) {
  const effect = itemDef?.effect || {};
  if (effect.kind === "training_material_small") return 1;
  if (effect.kind === "training_material") return 3;
  if (effect.kind === "training_tier_material") {
    return { low: 1, mid: 2, high: 3, secret: 5 }[String(effect.tier || "")] || 1;
  }
  return 0;
}

function trainingRoomForItem(card, itemDef) {
  const effect = itemDef?.effect || {};
  if (["training_material", "training_material_small"].includes(effect.kind)) {
    const stat = TRAINING_STATS.includes(effect.trainingType) ? effect.trainingType : "hp";
    return Math.max(0, TRAINING_MAX_PER_STAT - Number(card?.training?.[stat] || 0));
  }
  if (effect.kind === "training_tier_material") return trainingRoom(card);
  return 0;
}

function primaryAttackStat(card) {
  return cardMaxStat(card, "atk") >= cardMaxStat(card, "satk") ? "atk" : "satk";
}

function chooseTrainingTarget(player, itemDef) {
  const crew = (player?.crew || []).filter(Boolean);
  if (!crew.length) return -1;
  const effect = itemDef?.effect || {};
  return crew
    .map((card, index) => ({ card, index, room: trainingRoomForItem(card, itemDef) }))
    .filter((entry) => entry.room > 0)
    .map((entry) => {
      const { card, index } = entry;
      const stat = effect.trainingType || "";
      let score = cardCombatScore(card) * 0.6 + Number(card.level || 1) * 2 - trainingTotal(card) * 2;
      if (stat === "hp") score += cardMaxStat(card, "hp") * 0.18 + (1 - cardHpRatio(card)) * 15;
      if (stat === "atk") score += cardMaxStat(card, "atk") * 0.9 + (primaryAttackStat(card) === "atk" ? 28 : -12);
      if (stat === "satk") score += cardMaxStat(card, "satk") * 0.9 + (primaryAttackStat(card) === "satk" ? 28 : -12);
      if (stat === "def" || stat === "sdef") score += cardMaxStat(card, "hp") * 0.1 + cardMaxStat(card, stat) * 0.75;
      if (stat === "spd") score += cardMaxStat(card, "spd") * 1.1 + (/移動|戰鬥/.test(String(card.roleType || "")) ? 14 : 0);
      if (effect.kind === "training_tier_material") score -= trainingTotal(card) * 3;
      score += entry.room * 0.12;
      return { index, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.index ?? 0;
}

function chooseSkillTrainingTarget(player) {
  return (player?.crew || [])
    .map((card, index) => ({ index, score: cardCombatScore(card) + Number(card?.level || 1) * 3 }))
    .filter((entry) => Number(player.crew?.[entry.index]?.level || 1) >= 8)
    .sort((a, b) => b.score - a.score)[0]?.index ?? 0;
}

function trainingItemCandidates(debug, player) {
  const items = getGameItems(debug);
  return Object.values(items)
    .filter((item) => item?.category === "key")
    .filter((item) => playerInventoryCount(player, item.id) > 0)
    .filter((item) => ["training_material", "training_material_small", "training_tier_material"].includes(item?.effect?.kind || ""))
    .sort((a, b) => {
      const skillA = a.effect?.kind === "skill_training_material" ? 1 : 0;
      const skillB = b.effect?.kind === "skill_training_material" ? 1 : 0;
      return skillB - skillA || itemTierScore(b) - itemTierScore(a) || a.name.localeCompare(b.name, "zh-Hant");
    });
}

function runTrainingAutomation(window, debug, player, memory, options = {}) {
  if (!player || typeof debug?.applyTrainingItemToTarget !== "function") return false;
  const force = Boolean(options.force);
  if (!force && Number(memory.lastTrainingTurn || 0) && Number(memory.turn || 0) - Number(memory.lastTrainingTurn || 0) < 4) return false;
  let used = 0;
  const maxUses = Math.max(1, Number(options.maxUses || (force ? 48 : 6)));
  const beforeLogLength = debug.getState().gameState.log.length;
  for (const item of trainingItemCandidates(debug, player)) {
    if (used >= maxUses) break;
    const beforeCount = playerInventoryCount(player, item.id);
    if (beforeCount <= 0) continue;
    if (item.effect?.kind === "skill_training_material") {
      const targetIndex = chooseSkillTrainingTarget(player);
      debug.applySkillTrainingItemToTarget(player, item.id, targetIndex);
    } else {
      const targetIndex = chooseTrainingTarget(player, item);
      if (targetIndex < 0) continue;
      const room = trainingRoomForItem(player.crew?.[targetIndex], item);
      if (room <= 0) continue;
      const points = Math.max(1, trainingItemPointsForTest(item));
      const effectiveQuantity = Math.ceil(room / points);
      const turnLimit = force ? maxUses - used : (item.effect?.kind === "training_material_small" ? 3 : 2);
      const quantity = Math.min(beforeCount, effectiveQuantity, Math.max(1, turnLimit));
      debug.applyTrainingItemToTarget(player, item.id, targetIndex, quantity);
    }
    closeBoardModal(window, debug);
    debug.recalcPlayerDerivedStats?.(player);
    debug.renderAll?.();
    const afterCount = playerInventoryCount(player, item.id);
    if (afterCount < beforeCount) used += beforeCount - afterCount;
  }
  if (used > 0 || debug.getState().gameState.log.length > beforeLogLength) {
    memory.lastTrainingTurn = Number(memory.turn || 0);
    return true;
  }
  return false;
}

function carryScoreForCard(item, card, player, debug = null) {
  const def = debug ? gameItemDef(debug, item) : item;
  const effect = def?.effect || item?.effect || {};
  const kind = String(effect.kind || "");
  const id = String(def?.id || item?.id || "");
  const lowestLevel = Math.min(...(player?.crew || []).map((entry) => Number(entry?.level || 1)));
  const levelGap = Math.max(0, Number(card?.level || 1) - lowestLevel);
  const endgame = crewAvgLevel(player) >= 70;
  let score = itemTierScore(def || item) + cardCombatScore(card) * 0.16;
  if (kind === "exp_bonus_self") score += Math.max(0, 60 - levelGap * 8);
  if (/heal|revive|survive|fatal|shield|reduce|defense|damage_reduction|auto_heal/.test(kind)) {
    score += 36 + (1 - cardHpRatio(card)) * 20 + cardMaxStat(card, "hp") * 0.08;
  }
  if (/speed|quick|first|priority/.test(kind)) score += cardMaxStat(card, "spd") * 0.45 + 22;
  if (/physical/.test(kind)) score += primaryAttackStat(card) === "atk" ? 42 : -16;
  if (/special/.test(kind)) score += primaryAttackStat(card) === "satk" ? 42 : -16;
  if (/damage|crit|counter|flinch|skill_tag/.test(kind)) score += Math.max(cardMaxStat(card, "atk"), cardMaxStat(card, "satk")) * 0.36;
  if (/guaranteed_escape|switch_out/.test(kind)) score += 18;
  if (/self_status/.test(kind) || item?.id === "toxic_orb" || item?.id === "flame_orb") score -= 120;
  if (/speed_down/.test(kind) || id === "iron_ball") score += endgame ? -90 : (cardMaxStat(card, "def") > cardMaxStat(card, "spd") ? 10 : -24);
  if (id === "life_orb") score -= 25;
  if (id === "focus_sash") score += 110;
  if (id === "weakness_policy") score += 100;
  if (id === "leftovers_meat") score += 92;
  if (id === "heal_shell") score += 90;
  if (id === "shell_bell") score += 82;
  if (id === "focus_band") score += 76;
  if (id === "quick_claw") score += 64;
  if (id === "choice_band") score += primaryAttackStat(card) === "atk" ? 82 : -24;
  if (id === "choice_glasses") score += primaryAttackStat(card) === "satk" ? 82 : -24;
  if (id === "choice_scarf") score += 48;
  if (id === "rocky_helmet" || id === "cloud_shell" || id === "air_balloon_shell") score += 54;
  if (id === "impact_shell") score += 48;
  if (id === "reject_shell") score += cardMaxStat(card, "hp") >= 300 ? 42 : -18;
  if (id === "king_badge" || id === "scope_lens" || id === "metronome") score += 34;
  if (id === "light_shell") score += 18;
  if (id === "smoke_ball") score += endgame ? -48 : 12;
  if (id === "cleanse_tag" || id === "treasure_coin" || id === "lucky_egg" || id === "heavy_duty_boots" || id === "utility_umbrella") {
    score += endgame ? -58 : 10;
  }
  return score;
}

function equipBattleCarryAutomation(debug, player, memory, options = {}) {
  if (!player || typeof debug?.equipBattleCarryItemFromInventory !== "function") return false;
  const force = Boolean(options.force);
  if (!force && Number(memory.lastCarryTurn || 0) && Number(memory.turn || 0) - Number(memory.lastCarryTurn || 0) < 3) return false;
  memory.failedCarryPairs ||= {};
  let equipped = 0;
  for (let guard = 0; guard < 12; guard += 1) {
    const entries = (player.items || [])
      .map((item, inventoryIndex) => ({ item, inventoryIndex }))
      .filter((entry) => entry.item?.id);
    if (!entries.length) break;
    const candidates = [];
    (player.crew || []).forEach((card, cardIndex) => {
      if (!card || card.battleCarryItem?.bound) return;
      const currentScore = card.battleCarryItem?.id
        ? carryScoreForCard(card.battleCarryItem, card, player, debug)
        : 0;
      entries.forEach((entry) => {
        if (memory.failedCarryPairs[`${cardIndex}:${entry.item.id}:${card.battleCarryItem?.id || "-"}`]) return;
        const score = carryScoreForCard(entry.item, card, player, debug);
        const gain = card.battleCarryItem?.id ? score - currentScore : score;
        candidates.push({
          cardIndex,
          inventoryIndex: entry.inventoryIndex,
          score,
          gain,
          replacing: Boolean(card.battleCarryItem?.id),
        });
      });
    });
    const best = candidates.sort((a, b) => b.gain - a.gain || b.score - a.score)[0];
    const replaceThreshold = force ? 8 : 28;
    if (!best || best.gain < (best.replacing ? replaceThreshold : 18)) break;
    const result = debug.equipBattleCarryItemFromInventory(player, best.cardIndex, best.inventoryIndex);
    if (result?.ok) {
      equipped += 1;
      debug.recalcPlayerDerivedStats?.(player);
      debug.renderAll?.();
      continue;
    }
    const failed = player.items?.[best.inventoryIndex];
    const current = player.crew?.[best.cardIndex]?.battleCarryItem?.id || "-";
    if (failed?.id) memory.failedCarryPairs[`${best.cardIndex}:${failed.id}:${current}`] = true;
  }
  if (equipped > 0) {
    memory.lastCarryTurn = Number(memory.turn || 0);
    return true;
  }
  return false;
}

function mapHealingCandidates(debug, player) {
  const items = getGameItems(debug);
  return Object.values(items)
    .filter((item) => item?.category === "battle" && item.usableOnMap)
    .filter((item) => playerInventoryCount(player, item.id) > 0)
    .filter((item) => ["heal_hp", "heal_hp_percent", "heal_percent_and_cure_status", "heal_party_percent_battle", "heal_party_percent_outside_battle", "revive"].includes(item?.effect?.kind || ""))
    .sort((a, b) => itemTierScore(a) - itemTierScore(b) || Number(a.price || 0) - Number(b.price || 0));
}

function healingTargetForItem(player, item) {
  const effect = item?.effect || {};
  const crew = (player?.crew || []).filter(Boolean);
  if (!crew.length) return null;
  const indexed = crew.map((card, index) => ({ card, index, ratio: cardHpRatio(card) }));
  if (effect.kind === "revive") {
    return indexed
      .filter((entry) => Number(entry.card.currentHp || 0) <= 0)
      .sort((a, b) => cardCombatScore(b.card) - cardCombatScore(a.card))[0] || null;
  }
  return indexed
    .filter((entry) => Number(entry.card.currentHp || 0) > 0 && entry.ratio < 0.92)
    .sort((a, b) => a.ratio - b.ratio || cardCombatScore(b.card) - cardCombatScore(a.card))[0] || null;
}

function mapHealingScore(player, item, target) {
  if (!target) return -999;
  const effect = item?.effect || {};
  const teamHp = hpRatio(player);
  const deadCount = (player?.crew || []).filter((card) => Number(card?.currentHp || 0) <= 0).length;
  if (effect.kind === "revive") return deadCount > 0 ? 220 + cardCombatScore(target.card) * 0.2 : -999;
  const missing = 1 - target.ratio;
  let score = missing * 160 + (0.85 - teamHp) * 90 - itemTierScore(item) * 0.35;
  if (/party/.test(effect.kind || "")) score += teamHp < 0.48 ? 65 : -20;
  if (item.id === "heal_2" || item.id === "small_meat") score += 25;
  if (item.id === "battle_food" || item.id === "large_meat" || item.id === "emergency_med_kit") score += 16;
  if (item.rarity === "S" && teamHp > 0.35) score -= 90;
  return score;
}

function runMapHealingAutomation(window, debug, player, memory) {
  if (!player || typeof debug?.applyBackpackHealingToTarget !== "function") return false;
  const deadCount = (player.crew || []).filter((card) => Number(card?.currentHp || 0) <= 0).length;
  const lowestAlive = Math.min(1, ...(player.crew || []).filter((card) => Number(card?.currentHp || 0) > 0).map(cardHpRatio));
  if (deadCount <= 0 && hpRatio(player) >= 0.78 && lowestAlive >= 0.44) return false;
  const best = mapHealingCandidates(debug, player)
    .map((item) => {
      const target = healingTargetForItem(player, item);
      return { item, target, score: mapHealingScore(player, item, target) };
    })
    .filter((entry) => entry.target && entry.score > 18)
    .sort((a, b) => b.score - a.score)[0];
  if (!best) return false;
  const before = playerInventoryCount(player, best.item.id);
  debug.applyBackpackHealingToTarget(player, best.item.id, best.target.index, 1);
  closeBoardModal(window, debug);
  debug.recalcPlayerDerivedStats?.(player);
  debug.renderAll?.();
  if (playerInventoryCount(player, best.item.id) < before) {
    memory.lastMapHealTurn = Number(memory.turn || 0);
    return true;
  }
  return false;
}

function canRunCrewPreparation(window, debug) {
  const state = debug.getState();
  return state.gameState.phase === "main"
    && !state.battleState
    && !state.gameState.pendingMove
    && !state.gameState.movementAnimating
    && !state.gameState.diceRolling
    && !state.gameState.routePrompt
    && !state.gameState.islandDecision
    && !state.gameState.resolutionLock
    && !window.document.getElementById("boardModalBack")?.classList.contains("open");
}

function runCrewPreparation(window, debug, player, memory) {
  if (!canRunCrewPreparation(window, debug)) return false;
  const finalCandidate = Boolean(memory.targetEnding) && sameTestPlayer(player, endingCandidatePlayer(debug, memory));
  const finalPrep = (finalCandidate || isEndingCaptain(debug, player, memory)) && playerHasAllRoadPoneglyphsForTest(player);
  if (runMapHealingAutomation(window, debug, player, memory)) return true;
  if (player?.location?.kind === "island" && player.location.islandId === "island-24" && runDirectWaterSevenAutomation(debug, player, memory, { finalPrep, force: finalPrep })) return true;
  if (equipBattleCarryAutomation(debug, player, memory, { force: finalPrep })) return true;
  if (runTrainingAutomation(window, debug, player, memory, { force: finalPrep, maxUses: finalPrep ? 72 : 6 })) return true;
  return false;
}

function attributeMatchScore(attackerAttribute, defenderAttribute) {
  const attacker = String(attackerAttribute || "");
  const defender = String(defenderAttribute || "");
  if (!attacker || !defender || attacker === "無" || defender === "無") return 0;
  if (ATTRIBUTE_ADVANTAGE[attacker] === defender) return 1;
  if (ATTRIBUTE_ADVANTAGE[defender] === attacker) return -1;
  return 0;
}

function teamCompositionSummary(cards = []) {
  const attrCounts = {};
  const roleCounts = {};
  (cards || []).filter(Boolean).forEach((card) => {
    const attr = String(card.attribute || "無");
    const role = String(card.roleType || "未分類");
    attrCounts[attr] = Number(attrCounts[attr] || 0) + 1;
    roleCounts[role] = Number(roleCounts[role] || 0) + 1;
  });
  const realAttrs = Object.keys(attrCounts).filter((attr) => attr !== "無");
  const roles = Object.keys(roleCounts);
  const hasFighter = Number(roleCounts["戰鬥型"] || 0) > 0;
  const hasSupport = Number(roleCounts["輔助型"] || 0) > 0;
  const hasScout = Number(roleCounts["偵查型"] || 0) > 0;
  const hasMover = Number(roleCounts["移動型"] || 0) > 0;
  const missingAttrs = Object.keys(ATTRIBUTE_ADVANTAGE).filter((attr) => !attrCounts[attr]);
  let score = realAttrs.length * 18 + roles.length * 10;
  if (hasFighter) score += 18;
  if (hasSupport) score += 14;
  if (hasScout) score += 10;
  if (hasMover) score += 8;
  Object.values(attrCounts).forEach((count) => {
    if (count >= 3) score -= 24;
    else if (count === 2) score -= 5;
  });
  if (!hasFighter) score -= 30;
  if (!hasSupport && cards.length >= 3) score -= 18;
  return {
    attrCounts,
    roleCounts,
    missingAttrs,
    score,
    label: `屬性 ${Object.entries(attrCounts).map(([key, value]) => `${key}${value}`).join("/")}；職能 ${Object.entries(roleCounts).map(([key, value]) => `${key}${value}`).join("/")}`,
  };
}

function cardDraftScore(card, player, rng = Math.random) {
  const crew = (player?.crew || []).filter(Boolean);
  const role = String(card?.roleType || "");
  const composition = teamCompositionSummary(crew);
  const roles = new Set(crew.map((entry) => String(entry.roleType || "")));
  const attrs = new Set(crew.map((entry) => String(entry.attribute || "")));
  const attr = String(card?.attribute || "");
  const attrCount = crew.filter((entry) => String(entry.attribute || "") === attr).length;
  const passive = String(card?.passive || "");
  let score = (7 - tierRank(card?.tier)) * 26 + cardCombatScore(card);
  if (!roles.has("戰鬥型") && role === "戰鬥型") score += 34;
  if (!roles.has("輔助型") && role === "輔助型") score += 30;
  if (!roles.has("偵查型") && role === "偵查型") score += 24;
  if (!roles.has("移動型") && role === "移動型") score += 16;
  if (crew.length >= 2 && !roles.has(role)) score += 12;
  if (attr && attr !== "無" && !attrs.has(attr)) score += crew.length < 3 ? 34 : 18;
  if (attr && attr !== "無" && composition.missingAttrs.includes(attr)) score += crew.length < 6 ? 18 : 8;
  if (crew.length < 3 && attrCount > 0) score -= 22 * attrCount;
  if (crew.length >= 3 && attrCount >= 2) score -= 12 * attrCount;
  if (crew.length === 2 && attrs.size < 2 && attrs.has(attr)) score -= 40;
  if (/回復|恢復|治療|護盾|減傷|支援/.test(passive)) score += crew.some((entry) => /輔助/.test(String(entry.roleType || ""))) ? 6 : 20;
  if (/速度|先手|命中|閃避|逃跑|移動/.test(passive)) score += 10;
  return score + rng() * 8;
}

function availableRecruitCardsForTier(cards, tier, player) {
  const ownedIds = new Set((player?.crew || []).map((card) => card.id));
  const tierId = String(tier || "T5");
  return (cards || [])
    .filter((card) => card?.tier === tierId)
    .filter((card) => !STORY_RECRUIT_CARD_IDS.has(card.id))
    .filter((card) => !ownedIds.has(card.id));
}

function resolveRecruitTierFromRoll(cards, roll, player) {
  const rolledRank = tierRank(tierFromDiceRoll(roll));
  for (let rank = rolledRank; rank >= 1; rank -= 1) {
    const tier = `T${rank}`;
    if (availableRecruitCardsForTier(cards, tier, player).length) return tier;
  }
  for (let rank = rolledRank + 1; rank <= 6; rank += 1) {
    const tier = `T${rank}`;
    if (availableRecruitCardsForTier(cards, tier, player).length) return tier;
  }
  return tierFromDiceRoll(roll);
}

function chooseBestRecruitCard(cards, player, rng) {
  return (cards || [])
    .map((card) => ({ card, score: cardDraftScore(card, player, rng) }))
    .sort((a, b) => b.score - a.score)[0]?.card || null;
}

function shouldRestartRun(config, run, snapshot, turn, newLines) {
  if (!config.restartOnEarlyFailure || turn > config.earlyRestartTurns) return "";
  const crewSize = (snapshot.crew || []).length;
  const losses = Number(run.metrics.losses || 0);
  const lowLevel = Number(snapshot.avgLevel || 1) < 18;
  const economyPrison = (newLines || []).some((line) => /貝里不足被送進推進城/.test(line));
  const terminalPunishment = (newLines || []).some((line) => /被押往海軍本部|海軍本部挑戰失敗|進入頂上戰爭篇/.test(line));
  if (economyPrison && (crewSize < 6 || Number(snapshot.avgLevel || 1) < 12)) return "early-economy-prison";
  if (terminalPunishment && (crewSize < 6 || lowLevel)) return "early-terminal-punishment";
  if (String(snapshot.location || "") === "海軍本部" && (crewSize < 6 || lowLevel)) return "early-marineford-lock";
  if (crewSize < 6 && losses >= 5 && Number(snapshot.avgLevel || 1) < 12) return "early-loss-spiral";
  if (turn >= 50 && crewSize < 4 && Number(snapshot.avgLevel || 1) < 10 && losses >= 2) return "bad-start-no-recruits";
  return "";
}

function currentLocationLabel(debug, player) {
  if (!player?.location) return "unknown";
  if (player.location.kind === "island") {
    const island = debug.getIslandById(player.location.islandId);
    return island?.name || player.location.islandId;
  }
  return `${player.location.routeId}:${player.location.tileIndex}`;
}

function withTimeout(promise, ms, label = "operation") {
  let timer = null;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

function domStatus(window, debug) {
  const state = debug.getState();
  const battleView = debug.getBattleView?.();
  const modalBack = window.document.getElementById("boardModalBack");
  const modal = window.document.getElementById("boardModal");
  const waterSevenOverlay = window.document.getElementById("waterSevenPageOverlay");
  return {
    phase: state.gameState?.phase,
    turnStep: state.gameState?.turnStep,
    pendingMove: !!state.gameState?.pendingMove,
    movementAnimating: !!state.gameState?.movementAnimating,
    routePrompt: !!state.gameState?.routePrompt,
    islandDecision: !!state.gameState?.islandDecision,
    tradePrompt: !!state.gameState?.tradePrompt,
    activeTrade: !!state.gameState?.activeTrade,
    resolutionLock: !!state.gameState?.resolutionLock,
    battle: !!state.battleState,
    modalOpen: !!modalBack?.classList.contains("open"),
    modalClass: modal?.className || "",
    modalText: (modal?.textContent || "").replace(/\s+/g, " ").trim().slice(0, 240),
    waterSevenOpen: !!waterSevenOverlay?.classList.contains("open"),
    battleView: battleView ? {
      roundIndex: battleView.battle?.roundIndex,
      result: battleView.battle?.result,
      animating: battleView.battle?.animating,
      canAct: battleView.battle?.canAct,
      canFinish: battleView.battle?.canFinish,
      roundResolved: battleView.battle?.roundResolved,
      hasPlayerAction: battleView.battle?.hasPlayerAction,
      hasEnemyAction: battleView.battle?.hasEnemyAction,
      needsReplacement: battleView.battle?.needsReplacement,
      prebattleIntro: battleView.battle?.prebattleIntro ? {
        done: battleView.battle.prebattleIntro.done,
        id: battleView.battle.prebattleIntro.id,
      } : null,
      activeHp: `${battleView.activeCard?.currentHp}/${battleView.activeCard?.maxHp}`,
      enemyHp: `${battleView.enemy?.currentHp}/${battleView.enemy?.maxHp}`,
    } : null,
  };
}

function effectiveIslandKind(debug, island) {
  if (!island) return "";
  const islandState = debug.getIslandState(island.id);
  return islandState?.currentKind || island.kind || "";
}

function routeTarget(debug, routeItem, fromIslandId) {
  if (!routeItem) return null;
  const toId = routeItem.from === fromIslandId ? routeItem.to : routeItem.from;
  return debug.getIslandById(toId);
}

function islandGridDistance(a, b) {
  if (!a || !b) return Infinity;
  return Math.abs(Number(a.col || 0) - Number(b.col || 0)) + Math.abs(Number(a.row || 0) - Number(b.row || 0));
}

function islandRouteDistance(debug, source, target) {
  const sourceId = typeof source === "string" ? source : source?.id;
  const targetId = typeof target === "string" ? target : target?.id;
  if (!sourceId || !targetId) return Infinity;
  if (sourceId === targetId) return 0;
  const routes = debug.getState().gameState?.boardData?.routesBetweenIslands || [];
  const graph = new Map();
  routes.forEach((routeItem) => {
    if (!routeItem?.from || !routeItem?.to) return;
    if (!graph.has(routeItem.from)) graph.set(routeItem.from, []);
    if (!graph.has(routeItem.to)) graph.set(routeItem.to, []);
    graph.get(routeItem.from).push(routeItem.to);
    graph.get(routeItem.to).push(routeItem.from);
  });
  const queue = [{ id: sourceId, distance: 0 }];
  const visited = new Set([sourceId]);
  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    for (const nextId of graph.get(entry.id) || []) {
      if (visited.has(nextId)) continue;
      if (nextId === targetId) return entry.distance + 1;
      visited.add(nextId);
      queue.push({ id: nextId, distance: entry.distance + 1 });
    }
  }
  return Infinity;
}

function nextIslandIdsTowardTargets(debug, source, targets = []) {
  const sourceId = typeof source === "string" ? source : source?.id;
  const targetIds = new Set((targets || []).map((target) => typeof target === "string" ? target : target?.id).filter(Boolean));
  if (!sourceId || !targetIds.size) return new Set();
  const routes = debug.getState().gameState?.boardData?.routesBetweenIslands || [];
  const graph = new Map();
  routes.forEach((routeItem) => {
    if (!routeItem?.from || !routeItem?.to) return;
    if (!graph.has(routeItem.from)) graph.set(routeItem.from, []);
    if (!graph.has(routeItem.to)) graph.set(routeItem.to, []);
    graph.get(routeItem.from).push(routeItem.to);
    graph.get(routeItem.to).push(routeItem.from);
  });
  const queue = [{ id: sourceId, distance: 0, first: "" }];
  const visited = new Map([[sourceId, 0]]);
  let bestDistance = Infinity;
  const nextIds = new Set();
  for (let index = 0; index < queue.length; index += 1) {
    const entry = queue[index];
    if (entry.distance > bestDistance) continue;
    if (targetIds.has(entry.id) && entry.id !== sourceId) {
      bestDistance = entry.distance;
      if (entry.first) nextIds.add(entry.first);
      continue;
    }
    for (const nextId of graph.get(entry.id) || []) {
      const distance = entry.distance + 1;
      if (distance > bestDistance) continue;
      if (visited.has(nextId) && visited.get(nextId) < distance) continue;
      visited.set(nextId, distance);
      queue.push({ id: nextId, distance, first: entry.first || nextId });
    }
  }
  return nextIds;
}

function nearestIslandDistance(source, targets = []) {
  if (!source || !targets.length) return Infinity;
  return Math.min(...targets.map((target) => islandGridDistance(source, target)));
}

function nearestIslandRouteDistance(debug, source, targets = []) {
  if (!source || !targets.length) return Infinity;
  return Math.min(...targets.map((target) => islandRouteDistance(debug, source, target)));
}

function undefeatedYonkoTargets(debug) {
  return (debug.getState().gameState?.boardData?.islands || [])
    .filter((island) => island.kind === "yonko" && !debug.getIslandState(island.id)?.isYonkoDefeated);
}

function roadPoneglyphSet(player) {
  return new Set((Array.isArray(player?.roadPoneglyphs) ? player.roadPoneglyphs : []).map((glyphId) => String(glyphId || "")));
}

function playerHasAllRoadPoneglyphsForTest(player) {
  return roadPoneglyphSet(player).size >= 4;
}

function playerNeedsYonkoGlyph(debug, player, island) {
  if (!player || island?.kind !== "yonko") return false;
  const glyphId = String(debug.getIslandState(island.id)?.glyphId || "");
  return Boolean(glyphId && !roadPoneglyphSet(player).has(glyphId));
}

function yonkoTargetsForPlayer(debug, player) {
  return (debug.getState().gameState?.boardData?.islands || [])
    .filter((island) => {
      if (island.kind !== "yonko") return false;
      const islandState = debug.getIslandState(island.id);
      return !islandState?.isYonkoDefeated || playerNeedsYonkoGlyph(debug, player, island);
    });
}

function targetEndingYonkoApproachReady(player) {
  const crewSize = (player?.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  const power = Number(player?.power || 0);
  return crewSize >= 6
    && hpRatio(player) >= 0.62
    && ppRatio(player) >= 0.34
    && (avgLevel >= 48 || power >= 120);
}

function targetEndingYonkoFightReady(player) {
  const crewSize = (player?.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  const power = Number(player?.power || 0);
  const avgTraining = crewAverageTraining(player);
  return crewSize >= 6
    && hpRatio(player) >= 0.86
    && ppRatio(player) >= 0.56
    && avgTraining >= 120
    && (avgLevel >= 86 || (avgLevel >= 82 && power >= 210) || power >= 230);
}

function finalTrainingEnemyTargets(debug, player) {
  const avgLevel = crewAvgLevel(player);
  const power = Number(player?.power || 0);
  return (debug.getState().gameState?.boardData?.islands || [])
    .filter((island) => effectiveIslandKind(debug, island) === "enemy")
    .filter((island) => {
      const enemy = debug.getIslandState(island.id)?.enemyProfile;
      if (!enemy) return false;
      const enemyLevel = Number(enemy.level || 0);
      const recommended = Number(enemy.recommendedPower || enemy.power || 0);
      if (enemyLevel && enemyLevel < avgLevel - 4) return false;
      if (enemyLevel && enemyLevel > avgLevel + 12 && power < recommended * 1.15) return false;
      return true;
    });
}

function finalIslandTarget(debug) {
  return (debug.getState().gameState?.boardData?.islands || []).find((island) => island.kind === "final") || null;
}

function sameTestPlayer(a, b) {
  if (!a || !b) return false;
  if (a.id && b.id) return String(a.id) === String(b.id);
  return String(a.name || "") === String(b.name || "");
}

function endingCaptainScore(player) {
  if (!player) return -Infinity;
  const roads = roadPoneglyphSet(player).size;
  const defeatedGlyphs = new Set(Array.isArray(player.defeatedYonkoGlyphs) ? player.defeatedYonkoGlyphs : []).size;
  return roads * 12000
    + defeatedGlyphs * 4200
    + crewAvgLevel(player) * 85
    + Number(player.power || 0) * 7
    + crewAverageTraining(player) * 3
    + (player.crew || []).length * 180
    + Number(player.bounty || 0) / 5000000
    + Number(player.coins || 0) / 7000;
}

function playerToken(player) {
  return String(player?.id || player?.name || "");
}

function endingCaptainPlayer(debug, memory = {}) {
  const players = (debug.getState().gameState?.players || []).filter(Boolean);
  if (!players.length) return null;
  const stored = String(memory.endingCaptainId || "");
  const existing = stored
    ? players.find((player) => String(player.id || "") === stored || String(player.name || "") === stored)
    : null;
  if (existing) return existing;
  const chosen = players.slice().sort((a, b) => endingCaptainScore(b) - endingCaptainScore(a))[0] || players[0];
  if (chosen && memory) {
    memory.endingCaptainId = playerToken(chosen);
    memory.endingCaptainName = chosen.name || memory.endingCaptainId;
  }
  return chosen;
}

function isEndingCaptain(debug, player, memory = {}) {
  if (!memory.targetEnding || !memory.focusEndingCaptain) return true;
  const captain = endingCaptainPlayer(debug, memory);
  return !captain || sameTestPlayer(player, captain);
}

function finalBattleReadyForTest(player, debug = null) {
  if (!playerHasAllRoadPoneglyphsForTest(player)) return false;
  const avgLevel = crewAvgLevel(player);
  const power = Number(player?.power || 0);
  const avgTraining = crewAverageTraining(player);
  const shipState = normalizedShipState(player);
  const shipReady = shipState.slotsUnlocked >= 2
    && Number(shipState.upgradeLevels.training || 0) >= 2
    && Number(shipState.upgradeLevels.kitchen || 0) >= 1
    && Number(shipState.upgradeLevels.watchtower || 0) >= 1;
  const prepNeed = debug ? automationPreparationNeed(debug, player) : null;
  return (player?.crew || []).length >= 6
    && hpRatio(player) >= 0.82
    && ppRatio(player) >= 0.48
    && shipReady
    && avgTraining >= FINAL_ENDING_MIN_AVG_TRAINING
    && (!prepNeed || (!prepNeed.needsCarry && !prepNeed.lowSupplies))
    && (avgLevel >= FINAL_ENDING_MIN_AVG_LEVEL || (avgLevel >= FINAL_ENDING_ALT_AVG_LEVEL && power >= FINAL_ENDING_MIN_POWER) || power >= 220);
}

function endingCandidatePlayer(debug, memory = null) {
  const state = debug.getState();
  if (!state.gameState?.finalIslandUnlocked) return null;
  const candidates = (state.gameState.players || [])
    .filter((player) => player && playerHasAllRoadPoneglyphsForTest(player))
    .sort((a, b) => (crewAvgLevel(b) * 3 + Number(b.power || 0)) - (crewAvgLevel(a) * 3 + Number(a.power || 0)));
  if (memory?.focusEndingCaptain) {
    const captain = endingCaptainPlayer(debug, memory);
    const captainCandidate = candidates.find((player) => sameTestPlayer(player, captain));
    if (captainCandidate) return captainCandidate;
  }
  return candidates[0] || null;
}

function endingRunnerPlayer(debug, memory = null) {
  const candidate = endingCandidatePlayer(debug, memory);
  return candidate && (candidate.finalGateDefeated || finalBattleReadyForTest(candidate, debug)) ? candidate : null;
}

function routeRiskScore(debug, routeItem) {
  const state = debug.getState();
  const tiles = (state.gameState.boardData.seaTiles || []).filter((tile) => tile.routeId === routeItem?.id);
  if (!tiles.length) return 0;
  const encounterCount = tiles.filter((tile) => tile.primaryTypeId === "encounter").length;
  const unknownCount = tiles.filter((tile) => tile.primaryTypeId === "unknown").length;
  const longRoutePenalty = Math.max(0, tiles.length - 4);
  return tiles.length + encounterCount * 18 + unknownCount * 8 + longRoutePenalty * 2;
}

function crewSummary(player) {
  return (player.crew || []).filter(Boolean).map((card) => ({
    id: card.id,
    name: card.name,
    tier: card.tier,
    roleType: card.roleType,
    attribute: card.attribute,
    level: Number(card.level || 1),
    exp: Number(card.exp || card.currentExp || 0),
    hp: Number(card.currentHp || 0),
    maxHp: Number(card.baseStats?.hp || card.hp || 1),
    battleCarryItem: card.battleCarryItem?.id || "",
    training: { ...(card.training || {}) },
    trainingTotal: trainingTotal(card),
  }));
}

function summarizeState(debug, focusPlayer = null) {
  const state = debug.getState();
  const players = Array.isArray(state.gameState.players) ? state.gameState.players : [];
  const player = focusPlayer || state.gameState.players[state.gameState.currentPlayerIndex] || state.gameState.players[0];
  const levels = (player.crew || []).filter(Boolean).map((card) => Number(card.level || 1));
  const islandStates = state.gameState.boardData.islandStates || {};
  const islands = state.gameState.boardData.islands || [];
  const defeatedEnemyIslands = islands.filter((island) => island.kind === "enemy" && islandStates[island.id]?.isDefeated).length;
  const defeatedYonko = islands.filter((island) => island.kind === "yonko" && islandStates[island.id]?.isYonkoDefeated).length;
  const defeatedEnemyCodexEntries = defeatedEnemyCodex(player);
  const enemyCoverage = enemyCoverageSummary(player);
  return {
    round: Number(state.gameState.round || 1),
    phase: state.gameState.phase,
    turnStep: state.gameState.turnStep,
    currentPlayerIndex: Number(state.gameState.currentPlayerIndex || 0),
    currentPlayerName: player?.name || "",
    playerCount: players.length,
    location: currentLocationLabel(debug, player),
    avgLevel: Number(average(levels).toFixed(2)),
    avgTraining: Number(crewAverageTraining(player).toFixed(2)),
    minLevel: levels.length ? Math.min(...levels) : 0,
    maxLevel: levels.length ? Math.max(...levels) : 0,
    coins: Math.round(Number(player.coins || 0)),
    bounty: Math.round(Number(player.bounty || 0)),
    power: Math.round(Number(player.power || 0)),
    hpRatio: Number(hpRatio(player).toFixed(3)),
    ppRatio: Number(ppRatio(player).toFixed(3)),
    activeMissions: Array.isArray(player.activeMissions) ? player.activeMissions.length : 0,
    completedActiveMissions: completedMissionCount(player),
    missionDetails: (player.activeMissions || []).map((entry) => ({
      missionId: entry.missionId,
      progress: Number(entry.progress || 0),
      target: Number(entry.target || 0),
      completed: !!entry.completed,
    })),
    crew: crewSummary(player),
    ship: {
      slotsUnlocked: Number(player.shipSlotsUnlocked || 0),
      upgrades: { ...(player.shipUpgradeLevels || {}) },
      equippedGear: Array.isArray(player.shipEquippedGear) ? player.shipEquippedGear.filter(Boolean) : [],
    },
    defeatedEnemyCodex: defeatedEnemyCodexEntries,
    defeatedEnemyUnique: defeatedEnemyCodexEntries.length,
    enemyCoverage,
    defeatedEnemyIslands,
    defeatedYonko,
    roadPoneglyphs: Array.isArray(player.roadPoneglyphs) ? player.roadPoneglyphs.length : 0,
    finalIslandUnlocked: !!state.gameState.finalIslandUnlocked,
    finalGateDefeatedBy: { ...(state.gameState.finalGateDefeatedBy || {}) },
    finalEndingSeen: Array.isArray(player.finalEndingSeen) ? player.finalEndingSeen.slice() : [],
    allPlayers: players.map((entry, index) => {
      const entryLevels = (entry.crew || []).filter(Boolean).map((card) => Number(card.level || 1));
      const coverage = enemyCoverageSummary(entry);
      return {
        index,
        id: entry.id,
        name: entry.name,
        location: currentLocationLabel(debug, entry),
        avgLevel: Number(average(entryLevels).toFixed(2)),
        avgTraining: Number(crewAverageTraining(entry).toFixed(2)),
        minLevel: entryLevels.length ? Math.min(...entryLevels) : 0,
        maxLevel: entryLevels.length ? Math.max(...entryLevels) : 0,
        crew: (entry.crew || []).length,
        coins: Math.round(Number(entry.coins || 0)),
        bounty: Math.round(Number(entry.bounty || 0)),
        hpRatio: Number(hpRatio(entry).toFixed(3)),
        ppRatio: Number(ppRatio(entry).toFixed(3)),
        enemyCoverage: coverage,
        roadPoneglyphs: Array.isArray(entry.roadPoneglyphs) ? entry.roadPoneglyphs.length : 0,
        finalGateDefeated: !!entry.finalGateDefeated,
        finalEndingSeen: Array.isArray(entry.finalEndingSeen) ? entry.finalEndingSeen.slice() : [],
      };
    }),
  };
}

function finalEndingCompleted(snapshot) {
  if (Array.isArray(snapshot?.finalEndingSeen) && snapshot.finalEndingSeen.length) return true;
  return (snapshot?.allPlayers || []).some((entry) => Array.isArray(entry.finalEndingSeen) && entry.finalEndingSeen.length);
}

function analyzeLogLines(lines) {
  const metrics = {
    battlesWon: 0,
    seaWins: 0,
    enemyIslandWins: 0,
    losses: 0,
    escapes: 0,
    levelUps: 0,
    missionsAccepted: 0,
    missionsCompleted: 0,
    shipRewards: 0,
    shipUpgrades: 0,
    shipSlots: 0,
    shopBuys: 0,
    mapHeals: 0,
    battleItemsUsed: 0,
    carriesEquipped: 0,
    trainingUses: 0,
    skillTrainingUses: 0,
    hospitalUses: 0,
    recruits: 0,
    impelEscapes: 0,
    judicialClears: 0,
    marinefordClears: 0,
    yonkoWins: 0,
  };
  lines.forEach((line) => {
    if (/勝利獎勵|遭遇戰獎勵|擊退了|擊敗了/.test(line)) metrics.battlesWon += 1;
    if (/擊退了海格遭遇敵人/.test(line)) metrics.seaWins += 1;
    if (/擊敗了 .*。/.test(line) && !/四皇據點/.test(line)) metrics.enemyIslandWins += 1;
    if (/挑戰失敗|戰敗/.test(line)) metrics.losses += 1;
    if (/成功脫離|逃跑成功|撤退成功/.test(line)) metrics.escapes += 1;
    if (/升到 Lv\./.test(line)) metrics.levelUps += 1;
    if (/接下任務/.test(line)) metrics.missionsAccepted += 1;
    if (/完成任務/.test(line)) metrics.missionsCompleted += 1;
    if (/獲得船隻獎賞/.test(line)) metrics.shipRewards += 1;
    if (/在水之七島升級/.test(line)) metrics.shipUpgrades += 1;
    if (/在水之七島開啟船隻孔位/.test(line)) metrics.shipSlots += 1;
    if (/購買了/.test(line)) metrics.shopBuys += 1;
    if (/ 對 .* 使用.*回復|復活並回復/.test(line)) metrics.mapHeals += 1;
    if (/使用.*回復|使用.*解除|煙霧貝噴出|糧食|帶骨肉/.test(line) && !/ 對 .* 使用.*修行/.test(line)) metrics.battleItemsUsed += 1;
    if (/裝備了 /.test(line)) metrics.carriesEquipped += 1;
    if (/使用.*修行/.test(line)) metrics.trainingUses += 1;
    if (/研讀.*學會|遺忘了 .*學會/.test(line)) metrics.skillTrainingUses += 1;
    if (/使用 全隊完整整備/.test(line)) metrics.hospitalUses += 1;
    if (/招募到|救出 .*加入船團|自動選秀/.test(line)) metrics.recruits += 1;
    if (/逃出推進城|直接逃出推進城/.test(line)) metrics.impelEscapes += 1;
    if (/司法島討伐戰第 .*通關/.test(line)) metrics.judicialClears += 1;
    if (/突破海軍本部/.test(line)) metrics.marinefordClears += 1;
    if (/擊破四皇據點|擊敗四皇|擊敗了 .*四皇據點/.test(line)) metrics.yonkoWins += 1;
  });
  return metrics;
}

function mergeMetrics(target, delta) {
  Object.entries(delta).forEach(([key, value]) => {
    target[key] = Number(target[key] || 0) + Number(value || 0);
  });
}

function setupFastWindow(window) {
  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeSetInterval = window.setInterval.bind(window);
  window.setTimeout = (fn, delay = 0, ...args) => nativeSetTimeout(fn, Math.min(Number(delay) || 0, 4), ...args);
  window.setInterval = (fn, delay = 0, ...args) => nativeSetInterval(fn, Math.min(Math.max(Number(delay) || 0, 8), 25), ...args);
  window.requestAnimationFrame = (cb) => nativeSetTimeout(() => cb(Date.now()), 4);
  window.cancelAnimationFrame = (id) => window.clearTimeout(id);
  window.matchMedia = (queryValue) => ({
    matches: String(queryValue || "").includes("prefers-reduced-motion"),
    media: String(queryValue || ""),
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() { return false; },
  });
  window.focus = () => {};
  window.open = () => null;
  if (window.HTMLMediaElement?.prototype) {
    window.HTMLMediaElement.prototype.play = () => Promise.resolve();
    window.HTMLMediaElement.prototype.pause = () => {};
  }
}

function installTestLobby(window, roomCode, playerCount = 1) {
  const count = Math.max(1, Math.min(4, Math.round(Number(playerCount) || 1)));
  if (count <= 1) return;
  const names = ["草帽路飛", "索隆", "娜美", "香吉士"];
  const players = names.slice(0, count).map((name, index) => ({
    userId: 10001 + index,
    name,
    avatar: [8, 5, 7, 3][index] || 1,
    title: index === 0 ? "新世界啟航者" : "測試船員",
    isHost: index === 0,
    isMe: index === 0,
    ready: index !== 0,
    online: true,
  }));
  const lobby = {
    roomId: roomCode,
    roomCode,
    roomName: "四人完整流程測試局",
    hostName: players[0]?.name || "草帽路飛",
    hostUserId: players[0]?.userId || 10001,
    status: "starting",
    maxPlayers: 4,
    players,
    chat: [{ system: true, text: "自動測試：四人完整流程。", ts: Date.now() }],
  };
  try {
    window.sessionStorage.setItem("op_board_preview_lobby", JSON.stringify(lobby));
  } catch (_error) {
    // If jsdom storage is unavailable, the game will fall back to its normal single-player lobby.
  }
}

async function bootGame(baseUrl, seed, runIndex, config) {
  const errors = [];
  const virtualConsole = new VirtualConsole();
  virtualConsole.on("jsdomError", (error) => {
    const message = String(error?.message || error);
    if (
      message.includes("Window's focus")
      || message.includes("HTMLMediaElement's play() method")
      || /Could not load script: ".+\/socket\.io\/socket\.io\.js"/.test(message)
    ) {
      return;
    }
    const details = error?.cause?.stack || error?.stack || message;
    errors.push(`jsdom: ${details}`);
  });
  virtualConsole.on("error", (...args) => errors.push(`console.error: ${args.join(" ")}`));
  const roomCode = `GROWTH-${runIndex}`;
  const dom = await JSDOM.fromURL(`${baseUrl}/board_game.html?room=${roomCode}&seed=${seed}`, {
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse(window) {
      setupFastWindow(window);
      installTestLobby(window, roomCode, config.playerCount);
    },
  });
  const debug = await waitFor(() => dom.window.__BOARD_GAME_DEBUG__);
  await waitFor(() => dom.window.BoardCards?.cards?.length);
  await wait(120);

  if (config.resumeSave) {
    const payload = JSON.parse(fs.readFileSync(config.resumeSave, "utf8"));
    debug.loadManualGame(payload);
    await wait(160);
    closeBoardModal(dom.window, debug);
    const resumedState = debug.getState();
    const resumedPlayer = resumedState.gameState.players[resumedState.gameState.currentPlayerIndex] || resumedState.gameState.players[0];
    debug.recalcPlayerDerivedStats(resumedPlayer);
    debug.renderAll();
    return {
      dom,
      debug,
      errors,
      startingTeam: crewSummary(resumedPlayer),
      startingComposition: teamCompositionSummary(resumedPlayer?.crew || []),
      draftHistory: [{ pick: 0, roll: 0, rolledTier: "save", resolvedTier: "save", id: "manual_save", name: path.basename(config.resumeSave), tier: "", roleType: "", attribute: "" }],
    };
  }

  const state = debug.getState();
  const players = Array.isArray(state.gameState.players) && state.gameState.players.length
    ? state.gameState.players
    : [];
  const draftHistory = [];
  const byId = new Map(dom.window.BoardCards.cards.map((card) => [card.id, card]));
  if (!players.length) throw new Error("No game players were created.");
  state.gameState.availableCards = Array.isArray(state.gameState.availableCards) && state.gameState.availableCards.length
    ? state.gameState.availableCards
    : dom.window.BoardCards.cards.map((card) => cloneJson(card));

  players.forEach((player, playerIndex) => {
    const playerDraft = [];
    if (config.startMode === "fixed") {
      const chosen = config.team.map((id) => byId.get(id)).filter(Boolean);
      if (!chosen.length) throw new Error(`No valid team cards found for ${config.team.join(",")}.`);
      player.crew = chosen.map((card) => cloneJson(card));
    } else {
      const rng = createRng(`${seed}:draft:${runIndex}:${player.id || playerIndex}`);
      player.crew = [];
      for (let pickIndex = 0; pickIndex < config.draftPicks; pickIndex += 1) {
        const roll = Math.floor(rng() * 6) + 1;
        const resolvedTier = resolveRecruitTierFromRoll(state.gameState.availableCards, roll, player);
        const candidates = availableRecruitCardsForTier(state.gameState.availableCards, resolvedTier, player);
        const pick = chooseBestRecruitCard(candidates, player, rng);
        if (!pick) continue;
        player.crew.push(cloneJson(pick));
        state.gameState.availableCards = state.gameState.availableCards.filter((card) => card.id !== pick.id);
        const entry = {
          playerId: player.id,
          playerName: player.name,
          pick: pickIndex + 1,
          roll,
          rolledTier: tierFromDiceRoll(roll),
          resolvedTier,
          id: pick.id,
          name: pick.name,
          tier: pick.tier,
          roleType: pick.roleType,
          attribute: pick.attribute,
        };
        draftHistory.push(entry);
        playerDraft.push(entry);
      }
      if (!player.crew.length) throw new Error(`Draft automation could not pick any starting crew for ${player.name}.`);
      state.gameState.log.push(`${player.name} 自動選秀：${playerDraft.map((entry) => `${entry.name}(${entry.tier}/${entry.roleType})`).join("、")}。`);
    }
    player.activeCrewIndex = 0;
    player.discoveredIslands = Array.isArray(player.discoveredIslands) && player.discoveredIslands.length
      ? player.discoveredIslands
      : ["loguetown"];
    player.location = player.location || { kind: "island", islandId: "loguetown", entryDirection: null };
    debug.recalcPlayerDerivedStats(player);
  });
  state.gameState.phase = "main";
  state.gameState.currentPlayerIndex = 0;
  state.gameState.turnStep = "成長曲線自動測試";
  state.gameState.pendingMove = null;
  state.gameState.routePrompt = null;
  state.gameState.islandDecision = null;
  state.gameState.resolutionLock = false;
  state.battleState = null;
  const modalBack = dom.window.document.getElementById("boardModalBack");
  const modal = dom.window.document.getElementById("boardModal");
  if (modalBack) {
    modalBack.classList.remove("open");
    delete modalBack.dataset.forceChoice;
    delete modalBack.dataset.backdropClose;
  }
  if (modal) {
    modal.className = "board-modal";
    modal.innerHTML = "";
  }
  debug.renderAll();
  const player = players[0];
  return {
    dom,
    debug,
    errors,
    startingTeam: crewSummary(player),
    startingPlayers: players.map((entry) => ({
      id: entry.id,
      name: entry.name,
      crew: crewSummary(entry),
      composition: teamCompositionSummary(entry.crew),
    })),
    startingComposition: teamCompositionSummary(player.crew),
    draftHistory,
  };
}

function targetScore(debug, player, currentIslandId, routeItem, memory) {
  const target = routeTarget(debug, routeItem, currentIslandId);
  if (!target) return -999;
  const kind = effectiveIslandKind(debug, target);
  const targetState = debug.getIslandState(target.id);
  const avgLevel = crewAvgLevel(player);
  const crewSize = (player.crew || []).length;
  const buildingCrew = crewSize < 6;
  const earlyCrewBuild = crewSize < 4 || (crewSize < 6 && avgLevel < 12);
  const earlySafetyMode = earlyCrewBuild || (avgLevel < 10 && Number(player.power || 0) < 18);
  const weak = hpRatio(player) < 0.42 || ppRatio(player) < 0.2;
  const recoveryMode = hpRatio(player) < 0.58 || ppRatio(player) < 0.38;
  const majorReadyHp = hpRatio(player) > 0.82 && ppRatio(player) > 0.48;
  const enemyCoverage = enemyCoverageSummary(player);
  const allTargetsCleared = Number(enemyCoverage.remaining || 0) <= 0;
  const remainingNonYonkoTargets = (enemyCoverage.missing || [])
    .filter((entry) => !String(entry?.key || "").startsWith("yonko_"))
    .length;
  const nonYonkoTargetsCleared = remainingNonYonkoTargets <= 0;
  const defeatedYonkoCount = (debug.getState().gameState?.boardData?.islands || [])
    .filter((island) => island.kind === "yonko" && debug.getIslandState(island.id)?.isYonkoDefeated)
    .length;
  const currentIsland = debug.getIslandById(currentIslandId);
  const undefeatedYonkos = undefeatedYonkoTargets(debug);
  const endingMode = Boolean(memory.targetEnding);
  const endingCaptain = endingMode ? endingCaptainPlayer(debug, memory) : null;
  const isCaptain = !endingMode || !memory.focusEndingCaptain || !endingCaptain || sameTestPlayer(player, endingCaptain);
  const finalPushCandidate = endingMode ? endingCandidatePlayer(debug, memory) : null;
  const finalPushRunner = endingMode ? endingRunnerPlayer(debug, memory) : null;
  const finalPushActive = Boolean(finalPushCandidate);
  const isFinalCandidate = finalPushActive && sameTestPlayer(player, finalPushCandidate);
  const isFinalPushRunner = finalPushActive && sameTestPlayer(player, finalPushRunner);
  const prepNeed = automationPreparationNeed(debug, player);
  const playerYonkoTargets = endingMode && (finalPushActive || !isCaptain) ? [] : (endingMode ? yonkoTargetsForPlayer(debug, player) : undefeatedYonkos);
  const finalTrainingTargets = endingMode && finalPushActive && isFinalCandidate && !isFinalPushRunner
    ? finalTrainingEnemyTargets(debug, player)
    : [];
  const finalTarget = finalIslandTarget(debug);
  const routeRisk = routeRiskScore(debug, routeItem);
  const finalAnchorId = String(finalTarget?.finalAnchorIslandId || debug.getState().gameState?.boardData?.finalIslandLayout?.anchorIslandId || "");
  const targetIsFinalEntrance = kind === "final"
    || kind === "elbaph"
    || Boolean(target.finalGateAnchor)
    || Boolean(finalAnchorId && target.id === finalAnchorId);
  let finalPathStep = false;
  let score = 0;
  if (endingMode && isFinalCandidate && !isFinalPushRunner && targetIsFinalEntrance) {
    score -= 12000;
  }
  if (endingMode && memory.focusEndingCaptain && !isCaptain) {
    if (kind === "yonko" || kind === "final" || kind === "elbaph" || target.finalGateAnchor) score -= 8600;
  }
  if (target.id === "island-24") {
    score += buildingCrew ? 85 : 45;
    if (prepNeed.needsShipWork) score += endingMode ? 360 : 220;
    if (prepNeed.shipEquipment > 0 && Number(player.shipSlotsUnlocked || 0) < 4) score += 120;
  }
  if (kind === "hospital") score += recoveryMode ? 360 : (weak || hpRatio(player) < 0.82 ? 190 : (buildingCrew ? 18 : 8));
  if (kind === "shop") {
    const needsSupplies = hpRatio(player) < 0.88 || ppRatio(player) < 0.72 || (player.items || []).length < Math.min(6, crewSize);
    score += player.coins >= 300 ? (needsSupplies ? 92 : 34) : (buildingCrew ? 14 : 8);
    if (player.coins >= 600) {
      if (prepNeed.lowSupplies) score += endingMode ? 210 : 120;
      if (prepNeed.needsCarry) score += endingMode ? 150 : 90;
      if (prepNeed.needsTrainingStock && avgLevel < (endingMode ? FINAL_ENDING_MIN_AVG_LEVEL : 82)) score += endingMode ? 125 : 70;
    }
  }
  if (kind === "mission") {
    const activeCount = activeMissionCount(player);
    score += activeCount < 6 ? (buildingCrew ? 210 : 150) : 26;
    if (activeCount === 0) score += 80;
    if (endingMode && activeCount < 4 && avgLevel < 72) score += 95;
  }
  if (kind === "tavern") {
    if (earlyCrewBuild && player.coins >= 2500) score += crewSize < 4 ? 720 : 480;
    else score += buildingCrew && player.coins >= 2500 ? 260 : (buildingCrew ? 75 : -4);
    if (endingMode && crewSize < 6 && player.coins >= 2500) score += earlyCrewBuild ? 260 : 160;
  }
  if (nonYonkoTargetsCleared && avgLevel >= 90 && !recoveryMode) {
    if (kind === "shop" || kind === "mission" || kind === "tavern") score -= 90;
    if (kind === "hospital" && hpRatio(player) > 0.92 && ppRatio(player) > 0.85) score -= 80;
  }
  const targetEndingYonkoReady = endingMode
    && isCaptain
    && !recoveryMode
    && targetEndingYonkoFightReady(player);
  const targetEndingYonkoApproach = endingMode
    && isCaptain
    && !recoveryMode
    && targetEndingYonkoApproachReady(player);
  const shouldChaseYonko = endingMode
    ? targetEndingYonkoApproach && playerYonkoTargets.length > 0
    : nonYonkoTargetsCleared && avgLevel >= 90 && undefeatedYonkos.length;
  if (shouldChaseYonko) {
    const currentDistance = endingMode
      ? nearestIslandRouteDistance(debug, currentIsland, playerYonkoTargets)
      : nearestIslandDistance(currentIsland, playerYonkoTargets);
    const targetDistance = endingMode
      ? nearestIslandRouteDistance(debug, target, playerYonkoTargets)
      : nearestIslandDistance(target, playerYonkoTargets);
    if (Number.isFinite(currentDistance) && Number.isFinite(targetDistance)) {
      score += (currentDistance - targetDistance) * (endingMode ? 620 : 135) - targetDistance * (endingMode ? 18 : 3);
    }
    if (endingMode) {
      const nextIds = nextIslandIdsTowardTargets(debug, currentIsland, playerYonkoTargets);
      if (nextIds.size) score += nextIds.has(target.id) ? 2400 : -720;
    }
  }
  if (finalTrainingTargets.length) {
    const currentDistance = nearestIslandRouteDistance(debug, currentIsland, finalTrainingTargets);
    const targetDistance = nearestIslandRouteDistance(debug, target, finalTrainingTargets);
    if (Number.isFinite(currentDistance) && Number.isFinite(targetDistance)) {
      score += (currentDistance - targetDistance) * 360 - targetDistance * 9;
    }
    const nextIds = nextIslandIdsTowardTargets(debug, currentIsland, finalTrainingTargets);
    if (nextIds.size) score += nextIds.has(target.id) ? 1050 : -260;
  }
  const finalRouteReady = endingMode
    ? debug.getState().gameState?.finalIslandUnlocked && (player.finalGateDefeated || finalBattleReadyForTest(player, debug))
    : allTargetsCleared && avgLevel >= 95 && defeatedYonkoCount >= 4;
  if (finalRouteReady && finalTarget) {
    const currentDistance = endingMode
      ? islandRouteDistance(debug, currentIsland, finalTarget)
      : islandGridDistance(currentIsland, finalTarget);
    const targetDistance = endingMode
      ? islandRouteDistance(debug, target, finalTarget)
      : islandGridDistance(target, finalTarget);
    if (Number.isFinite(currentDistance) && Number.isFinite(targetDistance)) {
      score += (currentDistance - targetDistance) * (endingMode ? 320 : 110) - targetDistance * (endingMode ? 7 : 2);
    }
    if (endingMode) {
      const nextIds = nextIslandIdsTowardTargets(debug, currentIsland, [finalTarget]);
      finalPathStep = nextIds.has(target.id);
      if (nextIds.size) score += finalPathStep ? 4200 : -1250;
      if (isFinalPushRunner) {
        if (target.id === finalTarget.id) score += 7200;
        if (finalAnchorId && target.id === finalAnchorId) score += 3600;
      }
    }
  }
  if (target.kind === "enemy") {
    const power = Number(player.power || 0);
    const recommended = Number(targetState?.enemyProfile?.recommendedPower || targetState?.enemyProfile?.power || 10);
    const enemyLevel = Number(targetState?.enemyProfile?.level || 0);
    const levelGap = enemyLevel ? enemyLevel - avgLevel : 0;
    const enemyKey = targetState?.enemyProfile?.key || "";
    const missingEnemy = enemyKey && !hasDefeatedEnemyKey(player, enemyKey);
    if (missingEnemy) score += crewSize >= 6 ? 260 : 70;
    if (endingMode && crewSize >= 6 && avgLevel >= 56) {
      score += missingEnemy && avgLevel < 68 ? 60 : -120;
      if (targetEndingYonkoReady) score -= 320;
    }
    if (nonYonkoTargetsCleared && !missingEnemy) score -= 180;
    if (memory.avoidIslandNames?.[target.name] && Number(memory.avoidIslandNames[target.name]) > Number(memory.turn || 0)) score -= 260;
    if (recoveryMode) score -= 230;
    const safePractice = levelGap <= 2
      && hpRatio(player) > 0.86
      && ppRatio(player) > 0.55
      && power >= recommended * 1.25;
    if (buildingCrew && !safePractice) score -= 140;
    if (earlySafetyMode && !safePractice) score -= crewSize < 4 ? 360 : 260;
    score += power >= recommended ? 72 + Math.min(24, recommended) : -36 + Math.round((power / Math.max(1, recommended)) * 20);
    if (targetState?.isDefeated && !missingEnemy) score -= 55;
    if (weak || hpRatio(player) < 0.72) score -= 70;
    if (levelGap > 18) score -= 120;
    else if (levelGap > 10) score -= 55;
    else if (levelGap > 5 && weak) score -= 35;
  }
  if (kind === "yonko") {
    const needsGlyph = playerNeedsYonkoGlyph(debug, player, target);
    score += crewSize >= 6 && avgLevel >= 80 && !recoveryMode ? 120 : -160;
    if (endingMode && !targetEndingYonkoReady) score -= 1800;
    if (endingMode && targetEndingYonkoReady) {
      score += needsGlyph ? 2200 : (!targetState?.isYonkoDefeated ? 1650 : -260);
      score += roadPoneglyphSet(player).size * 180;
      if (needsGlyph && hpRatio(player) > 0.76 && ppRatio(player) > 0.42) score += 420;
    }
    if (nonYonkoTargetsCleared && avgLevel >= 90 && majorReadyHp) {
      score += targetState?.isYonkoDefeated ? -260 : 760;
    }
  }
  const impelMissing = missingAnyEnemyKey(player, IMPEL_DOWN_TARGET_ENEMY_KEYS);
  const marinefordMissing = missingAnyEnemyKey(player, MARINEFORD_TARGET_ENEMY_KEYS);
  if (kind === "judicial") {
    score += crewSize >= 6 && avgLevel >= 56 && majorReadyHp ? 84 : -135;
    if (earlySafetyMode) score -= 420;
  }
  if (kind === "impel_down") {
    score += endingMode
      ? (avgLevel < 48 && crewSize >= 6 && majorReadyHp ? 36 : -520)
      : (crewSize >= 6 && avgLevel >= 66 && majorReadyHp ? (impelMissing ? 210 : 62) : -145);
    if (earlySafetyMode) score -= 560;
    else if (earlyCrewBuild) score -= 220;
  }
  if (kind === "marineford") {
    score += endingMode
      ? -620
      : (crewSize >= 6 && avgLevel >= 82 && majorReadyHp ? (marinefordMissing ? 260 : 86) : -180);
    if (earlySafetyMode) score -= 620;
  }
  if (crewSize >= 6 && avgLevel >= 50 && !hasDefeatedEnemyKey(player, "spandam")) {
    if (kind === "judicial") score += 130;
  }
  if (!endingMode && crewSize >= 6 && avgLevel >= 65 && impelMissing) {
    if (kind === "impel_down") score += 180;
  }
  if (!endingMode && crewSize >= 6 && avgLevel >= 82 && marinefordMissing) {
    if (kind === "marineford") score += 220;
  }
  if (kind === "final") {
    const finalReady = endingMode
      ? debug.getState().gameState?.finalIslandUnlocked && (player.finalGateDefeated || finalBattleReadyForTest(player, debug))
      : allTargetsCleared && avgLevel >= 95 && !marinefordMissing && !impelMissing && defeatedYonkoCount >= 4;
    score += finalReady ? (endingMode ? 3200 : 720) : (avgLevel >= 92 && !marinefordMissing && !impelMissing ? 160 : -180);
  }
  if (endingMode && finalPushActive) {
    const hardDetour = kind === "yonko" || kind === "judicial" || kind === "impel_down" || kind === "marineford" || kind === "elbaph";
    if (hardDetour) {
      const dangerousStoryDetour = kind === "judicial" || kind === "impel_down" || kind === "marineford" || kind === "yonko";
      score -= isFinalPushRunner && finalPathStep && !dangerousStoryDetour
        ? 120
        : (isFinalPushRunner ? (dangerousStoryDetour ? 8200 : 2400) : (!isFinalCandidate ? 5200 : 1800));
    }
    if (kind === "enemy" && (isFinalPushRunner || !isFinalCandidate)) score -= isFinalPushRunner && finalPathStep ? 120 : (!isFinalCandidate ? 2200 : 1200);
    if (isFinalCandidate && !isFinalPushRunner && kind === "enemy") {
      const enemyLevel = Number(targetState?.enemyProfile?.level || 0);
      score += enemyLevel >= avgLevel - 4 ? 420 + Math.min(240, enemyLevel * 2) : -120;
    }
    if (!isFinalPushRunner && (kind === "hospital" || kind === "shop" || target.id === "island-24")) score += 170;
    if (isFinalPushRunner && (kind === "mission" || kind === "tavern")) score -= 420;
  }
  if (earlySafetyMode) score -= routeRisk * 6.2;
  else if (buildingCrew) score -= routeRisk * (avgLevel < 16 ? 4.2 : 2.8);
  else if (weak) score -= routeRisk * 1.8;
  else if (avgLevel < 24 && hpRatio(player) < 0.86) score -= routeRisk * 2.2;
  else score -= routeRisk * 0.45;
  if (memory.lastTargets?.includes(target.id)) score -= 8;
  score += Math.random() * 4;
  return score;
}

function chooseRoute(debug, memory) {
  const state = debug.getState();
  const prompt = state.gameState.routePrompt;
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (!prompt || !player) return false;
  const finalLayout = state.gameState.boardData?.finalIslandLayout || {};
  const finalRouteId = String(finalLayout.routeId || "");
  if (memory.targetEnding
    && player.finalGateDefeated
    && finalRouteId
    && String(prompt.islandId || "") === String(finalLayout.anchorIslandId || "")
    && (prompt.routeIds || []).includes(finalRouteId)) {
    memory.lastTargets = ["final-island", ...(memory.lastTargets || [])].slice(0, 4);
    debug.chooseRouteFromMap(finalRouteId);
    return true;
  }
  const routes = (prompt.routeIds || [])
    .map((id) => debug.getRouteById(id))
    .filter(Boolean)
    .map((routeItem) => ({
      routeItem,
      score: targetScore(debug, player, prompt.islandId, routeItem, memory),
    }))
    .sort((a, b) => b.score - a.score);
  const chosen = routes[0]?.routeItem;
  if (!chosen) return false;
  const target = routeTarget(debug, chosen, prompt.islandId);
  memory.lastTargets = [target?.id || "", ...(memory.lastTargets || [])].slice(0, 4);
  debug.chooseRouteFromMap(chosen.id);
  return true;
}

function shouldStayOnIsland(debug, memory = {}) {
  const state = debug.getState();
  const decision = state.gameState.islandDecision;
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (!decision || !player) return false;
  const island = debug.getIslandById(decision.islandId);
  const kind = effectiveIslandKind(debug, island);
  const islandState = debug.getIslandState(island?.id);
  if (!island) return false;
  const crewSize = (player.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  const majorReady = crewSize >= 6 && hpRatio(player) > 0.82 && ppRatio(player) > 0.48;
  const isCaptain = isEndingCaptain(debug, player, memory);
  const endingReadyToAdvance = Boolean(memory.targetEnding)
    && isCaptain
    && targetEndingYonkoFightReady(player);
  const finalPushCandidate = Boolean(memory.targetEnding) ? endingCandidatePlayer(debug, memory) : null;
  const finalPushRunner = Boolean(memory.targetEnding) ? endingRunnerPlayer(debug, memory) : null;
  const finalPushActive = Boolean(finalPushCandidate);
  const isFinalCandidate = finalPushActive && sameTestPlayer(player, finalPushCandidate);
  const isFinalPushRunner = finalPushActive && sameTestPlayer(player, finalPushRunner);
  if (island.id === "island-24") return true;
  if (memory.targetEnding && memory.focusEndingCaptain && !isCaptain) {
    if (kind === "yonko" || kind === "final" || kind === "elbaph") return false;
  }
  if (finalPushActive) {
    if (kind === "final") return isFinalPushRunner;
    if (kind === "elbaph" && player.finalGateDefeated) return false;
    if (kind === "elbaph") return isFinalPushRunner;
    if (kind === "yonko" || kind === "judicial" || kind === "impel_down" || kind === "marineford") return false;
    if (kind === "enemy" && (isFinalPushRunner || !isFinalCandidate)) return false;
  }
  if (endingReadyToAdvance) {
    const prepNeed = automationPreparationNeed(debug, player);
    if (kind === "hospital") return hpRatio(player) < 0.78 || ppRatio(player) < 0.58;
    if (kind === "shop") return hpRatio(player) < 0.62 || ppRatio(player) < 0.46 || prepNeed.lowSupplies || prepNeed.needsCarry || prepNeed.needsTrainingStock;
    if (kind === "mission" || kind === "tavern") return false;
  }
  if (kind === "hospital" && (hpRatio(player) < 0.9 || ppRatio(player) < 0.75)) return true;
  if (kind === "shop" && player.coins >= 300) return true;
  if (kind === "mission" && activeMissionCount(player) < 6) return true;
  if (kind === "tavern" && (player.crew || []).length < 6 && player.coins >= 2500) return true;
  if (kind === "judicial") return majorReady && avgLevel >= 56 && !hasDefeatedEnemyKey(player, "spandam");
  if (memory.targetEnding && (kind === "impel_down" || kind === "marineford")) return false;
  if (kind === "impel_down") return majorReady && avgLevel >= 66 && missingAnyEnemyKey(player, IMPEL_DOWN_TARGET_ENEMY_KEYS);
  if (kind === "marineford") return majorReady && avgLevel >= 82 && missingAnyEnemyKey(player, MARINEFORD_TARGET_ENEMY_KEYS);
  if (kind === "final") {
    if (memory.targetEnding) return majorReady && finalBattleReadyForTest(player, debug);
    return majorReady && avgLevel >= 95 && Number(enemyCoverageSummary(player).remaining || 0) <= 0;
  }
  if (kind === "enemy" && islandState?.enemyProfile && !islandState.isDefeated) {
    const enemyLevel = Number(islandState.enemyProfile.level || 0);
    const recommended = Number(islandState.enemyProfile.recommendedPower || 8);
    const levelReady = crewSize >= 6
      ? (!enemyLevel || avgLevel + 8 >= enemyLevel)
      : (!enemyLevel || avgLevel + 2 >= enemyLevel);
    const powerReady = crewSize >= 6
      ? Number(player.power || 0) >= recommended
      : Number(player.power || 0) >= recommended * 1.35;
    const healthyEnough = crewSize >= 6
      ? hpRatio(player) > 0.68 && ppRatio(player) > 0.3
      : hpRatio(player) > 0.88 && ppRatio(player) > 0.58;
    return !state.battleState
      && levelReady
      && healthyEnough
      && powerReady;
  }
  if (kind === "yonko") {
    if (memory.targetEnding) {
      if (!isCaptain) return false;
      return targetEndingYonkoFightReady(player)
        && (!islandState?.isYonkoDefeated || playerNeedsYonkoGlyph(debug, player, island));
    }
    return majorReady && (player.crew || []).length >= 6 && crewAvgLevel(player) >= 90;
  }
  return false;
}

function shouldChallengeCurrentYonko(debug, memory = {}) {
  const state = debug.getState();
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  const island = debug.getIslandById(player?.location?.islandId);
  const kind = effectiveIslandKind(debug, island);
  const islandState = debug.getIslandState(island?.id);
  if (!player || !island || kind !== "yonko") return false;
  const crewSize = (player.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  const majorReady = crewSize >= 6 && hpRatio(player) > 0.82 && ppRatio(player) > 0.48;
  if (memory.targetEnding) {
    if (!isEndingCaptain(debug, player, memory)) return false;
    if (endingCandidatePlayer(debug, memory)) return false;
    return targetEndingYonkoFightReady(player)
      && (!islandState?.isYonkoDefeated || playerNeedsYonkoGlyph(debug, player, island));
  }
  return majorReady && crewSize >= 6 && avgLevel >= 90;
}

function clickIfPresent(window, selectors) {
  for (const selector of selectors) {
    const node = window.document.querySelector(selector);
    if (node && !node.disabled) {
      node.click();
      return selector;
    }
  }
  return "";
}

function skipOrCancelPlayerTrade(window, debug) {
  const state = debug.getState();
  if (!state.gameState?.tradePrompt && !state.gameState?.activeTrade) return false;
  if (clickIfPresent(window, ["#skipSeaTradeBtn", "#cancelActiveTradeBtn"])) return true;

  const pending = state.gameState.pendingMove;
  const player = state.gameState.players?.[state.gameState.currentPlayerIndex];
  state.gameState.tradePrompt = null;
  state.gameState.activeTrade = null;
  state.gameState.resolutionLock = false;

  const modalBack = window.document.getElementById("boardModalBack");
  const modal = window.document.getElementById("boardModal");
  modalBack?.classList.remove("open");
  if (modal) {
    modal.innerHTML = "";
    modal.dataset.tradeId = "";
  }
  debug.renderAll?.();

  if (pending && player && pending.playerId === player.id && typeof debug.continueMove === "function") {
    window.setTimeout(() => debug.continueMove(), 0);
  }
  return true;
}

function chooseSeaEvent(window, player) {
  const buttons = Array.from(window.document.querySelectorAll("[data-sea-choice][data-sea-type]"));
  if (!buttons.length) return false;
  const avgLevel = crewAvgLevel(player);
  const crewSize = (player.crew || []).length;
  const healthyEnoughForEncounter = crewSize >= 6 && avgLevel >= 16 && hpRatio(player) >= 0.88 && ppRatio(player) >= 0.58;
  const broke = Number(player.coins || 0) < 500;
  const priority = broke
    ? ["medicine", "treasure", "rumor", "weather", "ocean", "money", "encounter"]
    : hpRatio(player) < 0.55
    ? ["medicine", "treasure", "money", "rumor", "weather", "ocean", "encounter"]
    : healthyEnoughForEncounter
      ? ["treasure", "money", "medicine", "rumor", "encounter", "weather", "ocean"]
      : ["treasure", "money", "medicine", "rumor", "weather", "ocean", "encounter"];
  const chosenType = priority.find((type) => buttons.some((button) => button.dataset.seaType === type));
  const chosen = buttons.find((button) => button.dataset.seaType === chosenType) || buttons[0];
  chosen.click();
  return true;
}

function shipGearScore(item, options = {}) {
  const id = String(item?.id || "");
  const rarityScore = { S: 400, A: 260, B: 150, C: 70 }[String(item?.rank || item?.rarity || "C").toUpperCase()] || 60;
  const finalPrep = Boolean(options.finalPrep);
  const preferredOrder = [
    "ship_dream_medical_galley",
    "ship_adam_sub_keel",
    "ship_stove_upgrade",
    "ship_reinforced_bottom_plate",
    "ship_ration_barrel",
    "ship_cola_aux_engine",
    "ship_bird_nest_tower",
    "ship_tailwind_sail",
    "ship_observer_spyglass",
    "ship_coup_de_burst_port",
    "ship_escape_ladder",
    "ship_patch_canvas",
  ];
  const preference = preferredOrder.includes(id) ? (preferredOrder.length - preferredOrder.indexOf(id)) * 8 : 0;
  const effect = item?.effect || {};
  const text = `${item?.kind || ""} ${JSON.stringify(effect)} ${item?.desc || ""} ${item?.uiSummary || ""}`;
  const sustain = /回復|護盾|防禦|減傷|復活/.test(text) ? 26 : 0;
  const mobility = /移動|擲骰|逃跑|航行/.test(text) ? 20 : 0;
  const scouting = /偵查|顯示|未知|戰鬥/.test(text) ? 12 : 0;
  let score = rarityScore + preference + sustain + mobility + scouting;
  if (finalPrep) {
    if (effect.battleStartShield || effect.bossBattleStartShield) score += 125;
    if (effect.battleWinTeamHeal || effect.battleWinLowestHeal || effect.battleWinReviveOneHp) score += 70;
    if (effect.seaHpDamageReduction || effect.firstBattleDamageReduction) score += 64;
    if (effect.escapeThresholdBonus || id === "ship_coup_de_burst_port" || id === "ship_escape_ladder") score -= 130;
    if (id === "ship_cola_aux_engine" || id === "ship_tailwind_sail" || id === "ship_patch_canvas") score -= 36;
  }
  return score;
}

function normalizedShipState(player) {
  return {
    slotsUnlocked: Math.max(0, Math.min(4, Math.round(Number(player?.shipSlotsUnlocked || 0)))),
    upgradeLevels: Object.fromEntries(WATER_SEVEN_UPGRADE_PARTS.map((part) => [
      part,
      Math.max(0, Math.min(3, Math.round(Number(player?.shipUpgradeLevels?.[part] || 0)))),
    ])),
    equippedGear: Array.from({ length: 4 }, (_, index) => player?.shipEquippedGear?.[index] || null),
  };
}

function waterSevenCanAfford(player, cost = {}) {
  if (Number(player?.coins || 0) < Number(cost.berries || 0)) return false;
  return Object.entries(WATER_SEVEN_MATERIAL_ITEM_IDS).every(([key, itemId]) => {
    return playerInventoryCount(player, itemId) >= Number(cost[key] || 0);
  });
}

function nextAffordableShipSlot(player) {
  const state = normalizedShipState(player);
  if (state.slotsUnlocked >= 4) return null;
  const cost = WATER_SEVEN_SLOT_COSTS[state.slotsUnlocked];
  return waterSevenCanAfford(player, cost) ? { type: "open-slot" } : null;
}

function nextAffordableShipUpgrade(player) {
  const state = normalizedShipState(player);
  return WATER_SEVEN_UPGRADE_PARTS
    .map((part) => {
      const level = state.upgradeLevels[part] || 0;
      const cost = WATER_SEVEN_UPGRADE_COSTS[part]?.[level];
      return cost && waterSevenCanAfford(player, cost) ? { type: "upgrade", upgradeId: part } : null;
    })
    .filter(Boolean)[0] || null;
}

function ownedShipGearDefs(debug, player) {
  const items = getGameItems(debug);
  return Object.values(items)
    .filter((item) => item?.category === "ship" && item?.effect?.kind === "ship_equipment")
    .filter((item) => playerInventoryCount(player, item.id) > 0);
}

function desiredShipGearIds(debug, player, options = {}) {
  const slots = normalizedShipState(player).slotsUnlocked;
  const result = [];
  const owned = ownedShipGearDefs(debug, player)
    .sort((a, b) => shipGearScore(b, options) - shipGearScore(a, options));
  for (const item of owned) {
    if (result.length >= slots) break;
    const rarity = String(item.rarity || "").toUpperCase();
    if (rarity === "S" && result.some((itemId) => String(gameItemDef(debug, itemId)?.rarity || "").toUpperCase() === "S")) continue;
    result.push(item.id);
  }
  return result;
}

function shipGearCommandPlan(debug, player, options = {}) {
  const state = normalizedShipState(player);
  if (state.slotsUnlocked <= 0) return null;
  const desired = desiredShipGearIds(debug, player, options);
  const desiredSet = new Set(desired);
  const equipped = state.equippedGear.slice();
  const unwanted = equipped
    .map((itemId, slotIndex) => ({ itemId, slotIndex }))
    .filter((entry) => entry.slotIndex < state.slotsUnlocked && entry.itemId && !desiredSet.has(entry.itemId))
    .sort((a, b) => shipGearScore(gameItemDef(debug, a.itemId), options) - shipGearScore(gameItemDef(debug, b.itemId), options))[0];
  if (unwanted) return { type: "unequip-slot", slotIndex: unwanted.slotIndex };
  const missing = desired.find((itemId) => !equipped.includes(itemId));
  if (!missing) return null;
  const emptyIndex = equipped.findIndex((itemId, index) => index < state.slotsUnlocked && !itemId);
  if (emptyIndex >= 0) return { type: "equip-gear", itemId: missing };
  const lowest = equipped
    .map((itemId, slotIndex) => ({ itemId, slotIndex, score: shipGearScore(gameItemDef(debug, itemId), options) }))
    .filter((entry) => entry.slotIndex < state.slotsUnlocked && entry.itemId)
    .sort((a, b) => a.score - b.score)[0];
  const missingScore = shipGearScore(gameItemDef(debug, missing), options);
  if (lowest && missingScore >= lowest.score + 35) return { type: "unequip-slot", slotIndex: lowest.slotIndex };
  return null;
}

function applyDirectWaterSevenCommand(debug, player, command) {
  let result = { ok: false };
  if (command.type === "upgrade") result = debug.waterSevenCommandUpgrade?.(player, command.upgradeId);
  if (command.type === "open-slot") result = debug.waterSevenCommandOpenSlot?.(player);
  if (command.type === "equip-gear") result = debug.waterSevenCommandEquipGear?.(player, command.itemId);
  if (command.type === "unequip-slot") result = debug.waterSevenCommandUnequipSlot?.(player, command.slotIndex);
  if (result?.ok) {
    debug.recalcPlayerDerivedStats?.(player);
    debug.renderAll?.();
    return true;
  }
  return false;
}

function runDirectWaterSevenAutomation(debug, player, memory = {}, options = {}) {
  if (!player || typeof debug?.waterSevenCommandUpgrade !== "function") return false;
  if (!options.force && Number(memory.lastWaterSevenTurn || 0) && Number(memory.turn || 0) - Number(memory.lastWaterSevenTurn || 0) < 2) return false;
  let changed = false;
  for (let guard = 0; guard < 20; guard += 1) {
    const command = nextAffordableShipSlot(player)
      || nextAffordableShipUpgrade(player)
      || shipGearCommandPlan(debug, player, options);
    if (!command) break;
    if (!applyDirectWaterSevenCommand(debug, player, command)) break;
    changed = true;
  }
  if (changed) memory.lastWaterSevenTurn = Number(memory.turn || 0);
  return changed;
}

async function runWaterSevenAutomation(window, debug, player, memory = {}, options = {}) {
  if (runDirectWaterSevenAutomation(debug, player, memory, { ...options, force: true })) {
    await wait(80);
    clickIfPresent(window, ["#waterSevenPageCloseBtn"]);
    return;
  }
  const commands = [];
  const raw = window.localStorage.getItem("onepiece-board-water-seven-snapshot-v1");
  const view = raw ? JSON.parse(raw).view : null;
  const ownedGear = (view?.shipEquipment || []).filter((item) => item.count > 0);
  const equippedList = Array.isArray(view?.equippedShipGear)
    ? view.equippedShipGear
    : Array.isArray(player.shipEquippedGear)
      ? player.shipEquippedGear
      : [];
  const equipped = new Set(equippedList.filter(Boolean));
  const slotsUnlocked = Number(view?.slotsUnlocked || player.shipSlotsUnlocked || 0);
  if (slotsUnlocked < 4) commands.push({ type: "open-slot" });
  ["training", "kitchen", "watchtower", "rudder", "sail"].forEach((upgradeId) => {
    if (Number(view?.upgradeLevels?.[upgradeId] || player.shipUpgradeLevels?.[upgradeId] || 0) < 3) {
      commands.push({ type: "upgrade", upgradeId });
    }
  });
  const desiredGear = ownedGear
    .slice()
    .sort((a, b) => shipGearScore(b, options) - shipGearScore(a, options))
    .slice(0, Math.max(0, slotsUnlocked))
    .map((item) => item.id);
  const desiredSet = new Set(desiredGear);
  equippedList.forEach((itemId, slotIndex) => {
    if (itemId && !desiredSet.has(itemId)) commands.push({ type: "unequip-slot", slotIndex });
  });
  desiredGear.forEach((itemId) => {
    if (!equipped.has(itemId)) commands.push({ type: "equip-gear", itemId });
  });
  for (const command of commands.slice(0, 12)) {
    window.postMessage({ type: "water-seven-command", command }, "*");
    await wait(20);
  }
  clickIfPresent(window, ["#waterSevenPageCloseBtn"]);
  await wait(80);
}

function automationInventoryCounts(debug, player) {
  const items = getGameItems(debug);
  let held = 0;
  let training = 0;
  let shipMaterial = 0;
  let shipEquipment = 0;
  let mapHealing = 0;
  Object.values(items).forEach((item) => {
    const count = playerInventoryCount(player, item.id);
    if (count <= 0) return;
    const kind = String(item?.effect?.kind || "");
    if (item.category === "held") held += count;
    if (item.category === "key" && ["training_material", "training_material_small", "training_tier_material", "skill_training_material"].includes(kind)) training += count;
    if (item.category === "ship" && kind === "ship_material") shipMaterial += count;
    if (item.category === "ship" && kind === "ship_equipment") shipEquipment += count;
    if (item.category === "battle" && item.usableOnMap && ["heal_hp", "heal_hp_percent", "heal_percent_and_cure_status", "heal_party_percent_battle", "heal_party_percent_outside_battle", "revive"].includes(kind)) {
      mapHealing += count;
    }
  });
  return { held, training, shipMaterial, shipEquipment, mapHealing };
}

function automationNeedsShipWork(debug, player) {
  return Boolean(
    nextAffordableShipSlot(player)
    || nextAffordableShipUpgrade(player)
    || shipGearCommandPlan(debug, player, { finalPrep: crewAvgLevel(player) >= 70 })
  );
}

function automationPreparationNeed(debug, player) {
  const crewSize = (player?.crew || []).length;
  const missingCarrySlots = Math.max(0, crewSize - (player?.crew || []).filter((card) => card?.battleCarryItem?.id).length);
  const inv = automationInventoryCounts(debug, player);
  const avgTraining = crewAverageTraining(player);
  const trainingRoomLeft = crewTrainingRoom(player);
  const lowSupplies = inv.mapHealing < Math.max(3, Math.ceil(crewSize * 0.8));
  const needsCarry = missingCarrySlots > 0 && inv.held < missingCarrySlots;
  const needsTrainingWork = inv.training > 0 && trainingRoomLeft > 0;
  const needsTrainingStock = trainingRoomLeft > 0
    && avgTraining < FINAL_ENDING_MIN_AVG_TRAINING
    && inv.training < Math.max(4, Math.ceil(crewSize * 1.5));
  return {
    ...inv,
    missingCarrySlots,
    avgTraining: Number(avgTraining.toFixed(2)),
    trainingRoomLeft,
    lowSupplies,
    needsCarry,
    needsTrainingWork,
    needsTrainingStock,
    needsShipWork: automationNeedsShipWork(debug, player),
  };
}

function selectBestTavernCandidate(window, debug, player) {
  const buttons = Array.from(window.document.querySelectorAll("[data-tavern-candidate]"));
  if (!buttons.length) return false;
  const state = debug.getState();
  const availableById = new Map((state.gameState.availableCards || []).map((card) => [card.id, card]));
  const rng = createRng(`${state.gameState.seed}:tavern:${state.gameState.round}:${state.gameState.log.length}`);
  const ranked = buttons
    .map((button) => {
      const card = availableById.get(button.dataset.tavernCandidate);
      return card ? { button, score: cardDraftScore(card, player, rng), card } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return false;
  best.button.click();
  return true;
}

function missionPickScore(mission, player) {
  if (!mission) return -999;
  const goal = mission.goal || {};
  const kind = String(goal.kind || "");
  const crewSize = (player.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  const healthy = hpRatio(player) > 0.72 && ppRatio(player) > 0.38;
  let score = Number(mission.exp || 0) / 18 + Number(mission.coins || 0) / 180 + Number(mission.bounty || 0) / 5000000;
  if (/大量經驗/.test(String(mission.special || ""))) score += 90;
  if (/大量貝里/.test(String(mission.special || "")) && Number(player.coins || 0) < 4000) score += 55;
  if (/大量懸賞/.test(String(mission.special || ""))) score += 22;
  if (kind === "sea_step") score += 95;
  else if (kind === "visit_island_kind") {
    const islandKind = String(goal.islandKind || "");
    score += ["tavern", "hospital", "shop", "mission"].includes(islandKind) ? 110 : 55;
    if (islandKind === "tavern" && crewSize < 6) score += 70;
    if (islandKind === "hospital" && hpRatio(player) < 0.9) score += 45;
  } else if (kind === "sea_event" || kind === "sea_event_or_chest" || kind === "chest_open") score += 85;
  else if (kind === "crew_exp" || kind === "crew_level") score += 92;
  else if (kind === "tavern_action") score += crewSize < 6 ? 130 : 38;
  else if (kind === "shop_buy") score += Number(player.coins || 0) >= 1000 ? 70 : -35;
  else if (kind === "hospital_service" || kind === "medical_ticket_or_hospital") score += hpRatio(player) < 0.95 ? 86 : 40;
  else if (kind === "battle_win" || kind === "no_ko_battle_win") score += crewSize >= 6 && healthy ? 58 : -12;
  else if (kind === "sea_battle_win") score += crewSize >= 6 && avgLevel >= 10 && healthy ? 46 : -40;
  else if (kind === "enemy_island_win" || kind === "defeat_tier" || kind === "defeat_devil_fruit") score += crewSize >= 6 && avgLevel >= 16 && healthy ? 28 : -90;
  else if (kind === "use_item_category" || kind === "use_heal_item") score += Number(player.coins || 0) >= 300 ? 36 : -8;
  else if (kind === "equip_held" || kind === "held_trigger") score += (player.items || []).length || (player.crew || []).some((card) => card?.battleCarryItem) ? 62 : -8;
  else if (/judicial|yonko|marineford|old_era|impel/.test(kind)) score += avgLevel >= 45 && crewSize >= 6 ? 10 : -160;
  const activeIds = new Set((player.activeMissions || []).map((entry) => entry.missionId));
  if (activeIds.has(mission.id)) score -= 500;
  return score;
}

function selectBestMissionCard(window, player) {
  const cards = Array.from(window.document.querySelectorAll("[data-mission-select]"));
  if (!cards.length) return false;
  const activeIds = new Set((player.activeMissions || []).map((entry) => entry.missionId));
  const ranked = cards
    .map((button) => {
      const mission = missionDefById(window, button.dataset.missionSelect);
      return mission ? { button, mission, score: missionPickScore(mission, player) } : null;
    })
    .filter((entry) => entry && !activeIds.has(entry.mission.id))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best || best.score < -50) return false;
  if (!best.button.classList.contains("selected")) {
    best.button.click();
    return true;
  }
  return false;
}

function openShipMissionJournal(window, player) {
  if (!player || completedMissionCount(player) <= 0) return false;
  if (window.document.getElementById("boardModalBack")?.classList.contains("open")) return false;
  const token = window.document.querySelector(`.ship-token.current.actionable[data-player-id="${player.id}"]`)
    || window.document.querySelector(".ship-token.current.actionable");
  if (!token) return false;
  token.click();
  const missionButton = window.document.querySelector('[data-ship-action="mission"]');
  if (!missionButton || missionButton.disabled) return false;
  missionButton.click();
  return true;
}

function shopItemScore(item, player) {
  if (!item) return -999;
  const id = item.id;
  const category = item.category || "";
  const effectKind = item.effect?.kind || "";
  const owned = ownedItemCount(player, id);
  const coins = Number(player.coins || 0);
  const cost = Math.max(1, Number(item.cost || item.price || 0));
  const crewSize = (player.crew || []).length;
  const missingCarrySlots = Math.max(0, crewSize - (player.crew || []).filter((card) => card?.battleCarryItem).length);
  const avgTraining = crewAverageTraining(player);
  let score = itemTierScore(item) - cost / 120;
  if (coins < cost) return -999;
  if (category === "battle") {
    if (["heal_hp", "heal_hp_percent", "heal_percent_and_cure_status", "heal_party_percent_battle", "heal_party_percent_outside_battle", "revive"].includes(effectKind)) {
      const need = hpRatio(player) < 0.9 ? 70 : 34;
      score += need - Math.max(0, owned - 4) * 12;
      if (id === "miracle_bone") score += (player.crew || []).some((card) => Number(card?.currentHp || 0) <= 0) ? 120 : 20;
      if (/party/.test(effectKind)) score += crewSize >= 5 ? 26 : -8;
    } else if (effectKind === "restore_skill_use") {
      score += ppRatio(player) < 0.75 ? 42 : 16;
    } else if (effectKind === "escape_battle") {
      score += 16 - owned * 4;
    } else {
      score += 4 - owned * 7;
    }
  } else if (category === "held") {
    score += missingCarrySlots > 0 ? 58 : 18;
    if (/self_status/.test(effectKind) || id === "toxic_orb" || id === "flame_orb") score -= 110;
    if (/heal|survive|shield|reduce|speed|quick|damage|crit|exp_bonus/.test(effectKind)) score += 30;
    if (owned >= 2) score -= 42;
  } else if (category === "key") {
    if (["training_material", "training_material_small", "training_tier_material", "skill_training_material"].includes(effectKind)) {
      const trainingNeed = Math.max(0, FINAL_ENDING_MIN_AVG_TRAINING - avgTraining);
      if (effectKind === "skill_training_material") {
        score += avgTraining >= FINAL_ENDING_MIN_AVG_TRAINING ? 8 : -90;
      } else {
        score += 34 + trainingNeed * 0.9 - Math.max(0, owned - (trainingNeed > 0 ? 18 : 6)) * 6;
      }
    } else {
      score += 4 - owned * 8;
    }
  } else if (category === "ship") {
    if (effectKind === "ship_material") score += 48 - Math.max(0, owned - 12) * 5;
    else if (effectKind === "ship_equipment") score += owned > 0 ? -24 : 42;
  } else if (category === "navigation") {
    if (["medical_ship_ticket", "fixed_step", "pointer"].includes(id)) score += 20 - owned * 6;
    else score += 6 - owned * 9;
  }
  if (coins < cost * 3 && !["heal_2", "small_meat", "battle_food", "ship_plank"].includes(id)) score -= 20;
  return score;
}

function selectBestShopItem(window, debug, player, memory) {
  if (window.document.getElementById("shopQtyConfirm")) {
    memory.shopBuysThisVisit = Number(memory.shopBuysThisVisit || 0) + 1;
    clickIfPresent(window, ["#shopQtyConfirm"]);
    return true;
  }
  const rows = Array.from(window.document.querySelectorAll("[data-shop-select]"))
    .filter((row) => !row.classList.contains("is-locked"));
  if (!rows.length) return false;
  const items = getGameItems(debug);
  const maxBuys = crewAverageTraining(player) < FINAL_ENDING_MIN_AVG_TRAINING && playerHasAllRoadPoneglyphsForTest(player)
    ? 12
    : (hpRatio(player) < 0.65 ? 7 : 5);
  if (Number(memory.shopBuysThisVisit || 0) >= maxBuys || Number(player.coins || 0) < 90) return false;
  const ranked = rows
    .map((row) => {
      const item = items[row.dataset.shopSelect];
      return item ? { row, item, score: shopItemScore(item, player) } : null;
    })
    .filter((entry) => entry && entry.score > 10)
    .sort((a, b) => b.score - a.score);
  const best = ranked[0];
  if (!best) return false;
  if (!best.row.classList.contains("is-selected")) {
    best.row.click();
    return true;
  }
  const buyButton = window.document.getElementById("shopBuyBtn");
  if (buyButton && !buyButton.disabled) {
    buyButton.click();
    return true;
  }
  return false;
}

async function handleModalOrOverlay(window, debug, memory) {
  const state = debug.getState();
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (skipOrCancelPlayerTrade(window, debug)) return true;
  const finalEndingScreen = window.document.querySelector(".final-ending-screen.final-ending-cinematic");
  const finalEndingNext = window.document.getElementById("finalEndingNextBtn");
  if (finalEndingScreen || finalEndingNext) {
    if (finalEndingNext && !finalEndingNext.disabled) {
      finalEndingNext.click();
      return true;
    }
    const finalEndingDialogue = window.document.querySelector(".final-ending-dialogue");
    if (finalEndingDialogue) {
      finalEndingDialogue.click();
      if (finalEndingNext && !finalEndingNext.disabled) {
        finalEndingNext.click();
      }
      return true;
    }
    finalEndingScreen?.click();
    if (finalEndingNext && !finalEndingNext.disabled) {
      finalEndingNext.click();
    }
    return true;
  }
  const elbaphContinue = window.document.getElementById("continueElbaphImuStoryBtn");
  if (elbaphContinue && !elbaphContinue.disabled) {
    elbaphContinue.click();
    return true;
  }
  const finalImuPrimary = window.document.querySelector(".final-imu-btn.primary:not(:disabled)");
  if (finalImuPrimary) {
    finalImuPrimary.click();
    return true;
  }
  if (finalEndingNext) {
    finalEndingNext.click();
    return true;
  }
  const waterSevenOverlay = window.document.getElementById("waterSevenPageOverlay");
  if (waterSevenOverlay?.classList.contains("open")) {
    await runWaterSevenAutomation(window, debug, player, memory, { finalPrep: Boolean(memory.targetEnding) });
    return true;
  }

  if (!window.document.getElementById("boardModalBack")?.classList.contains("open")) return false;

  if (window.document.getElementById("finalActivationRitualScene") || window.document.getElementById("finalRobinReading")) {
    await waitRaw(1200);
    return true;
  }

  if (window.document.getElementById("confirmFinalGateBtn")) {
    return !!clickIfPresent(window, ["#confirmFinalGateBtn"]);
  }

  if (window.document.querySelector("[data-journal-claim]") || window.document.getElementById("journalCloseMissionBtn")) {
    const claim = Array.from(window.document.querySelectorAll("[data-journal-claim]")).find((button) => !button.disabled);
    if (claim) {
      claim.click();
      return true;
    }
    return !!clickIfPresent(window, ["#journalCloseMissionBtn"]);
  }

  if (window.document.getElementById("startJudicialRaidBtn") || window.document.getElementById("joinJudicialRaidBtn") || window.document.getElementById("restartJudicialRaidBtn")) {
    const ready = crewAvgLevel(player) >= 56 && hpRatio(player) > 0.82 && ppRatio(player) > 0.48 && !hasDefeatedEnemyKey(player, "spandam");
    if (ready) {
      return !!clickIfPresent(window, ["#startJudicialRaidBtn", "#joinJudicialRaidBtn", "#restartJudicialRaidBtn"]);
    }
    return !!clickIfPresent(window, ["#skipJudicialRaidBtn", "#leaveJudicialRaidBtn"]);
  }

  if (window.document.getElementById("enterImpelIslandBtn")) {
    const ready = crewAvgLevel(player) >= 66 && hpRatio(player) > 0.82 && ppRatio(player) > 0.48 && missingAnyEnemyKey(player, IMPEL_DOWN_TARGET_ENEMY_KEYS);
    return !!clickIfPresent(window, [ready ? "#enterImpelIslandBtn" : "#leaveImpelIslandBtn"]);
  }

  if (window.document.getElementById("enterMarinefordIslandBtn")) {
    const ready = crewAvgLevel(player) >= 82 && hpRatio(player) > 0.82 && ppRatio(player) > 0.5 && missingAnyEnemyKey(player, MARINEFORD_TARGET_ENEMY_KEYS);
    return !!clickIfPresent(window, [ready ? "#enterMarinefordIslandBtn" : "#leaveMarinefordIslandBtn"]);
  }

  if (window.document.getElementById("impelPrimaryBtn") || window.document.getElementById("impelSecondaryBtn") || window.document.getElementById("impelThirdBtn")) {
    if (window.document.getElementById("impelRecruitSkipBtn") && !window.document.getElementById("impelRecruitSkipBtn").disabled) {
      return !!clickIfPresent(window, ["#impelRecruitSkipBtn"]);
    }
    return !!clickIfPresent(window, ["#impelPrimaryBtn", "#impelSecondaryBtn", "#impelThirdBtn"]);
  }

  if (window.document.querySelector("[data-forget-move-id]")) {
    const queue = debug.getState().gameState.pendingMoveLearnQueue || [];
    const pending = queue[0] || {};
    const card = (player.crew || []).find((entry) => entry?.id === pending.cardId);
    const buttons = Array.from(window.document.querySelectorAll("[data-forget-move-id]"));
    const ranked = buttons
      .map((button) => {
        const move = (card?.moveSet || []).find((entry) => entry.id === button.dataset.forgetMoveId) || {};
        const power = move.damageRange ? (Number(move.damageRange.min || 0) + Number(move.damageRange.max || 0)) / 2 : Number(move.power || 0);
        const pp = Number(move.pp || 0);
        const supportPenalty = power <= 0 ? 15 : 0;
        return { button, score: power * 2 + pp + supportPenalty };
      })
      .sort((a, b) => a.score - b.score);
    ranked[0]?.button.click();
    return true;
  }

  if (chooseSeaEvent(window, player)) return true;

  if (window.document.querySelector("[data-hospital-service]")) {
    if (hpRatio(player) < 0.98 || ppRatio(player) < 0.96) {
      if (clickIfPresent(window, ["[data-hospital-service]"])) return true;
    }
    return !!clickIfPresent(window, ["#leaveHospitalBtn"]);
  }

  if (window.document.getElementById("shopQtyConfirm")) {
    memory.shopBuysThisVisit = Number(memory.shopBuysThisVisit || 0) + 1;
    return !!clickIfPresent(window, ["#shopQtyConfirm"]);
  }

  if (window.document.querySelector(".shop-list")) {
    if (selectBestShopItem(window, debug, player, memory)) {
      return true;
    }
    memory.shopBuysThisVisit = 0;
    return !!clickIfPresent(window, ["#leaveShopBtn", "#leaveShopListBtn"]);
  }

  if (window.document.getElementById("acceptMissionBtn") || window.document.getElementById("leaveMissionBoardBtn")) {
    if (clickIfPresent(window, ["#claimMissionRewardBtn"])) return true;
    const accept = window.document.getElementById("acceptMissionBtn");
    if (activeMissionCount(player) < 6 && selectBestMissionCard(window, player)) {
      await wait(20);
      return true;
    }
    if (accept && !accept.disabled && activeMissionCount(player) < 6) {
      accept.click();
      return true;
    }
    if (activeMissionCount(player) < 6 && player.coins >= 300 && window.document.getElementById("refreshMissionBoardBtn") && !window.document.getElementById("refreshMissionBoardBtn").disabled) {
      window.document.getElementById("refreshMissionBoardBtn").click();
      return true;
    }
    return !!clickIfPresent(window, ["#leaveMissionBoardBtn"]);
  }

  if (window.document.getElementById("acceptRecruitBtn") || window.document.getElementById("rejectRecruitBtn")) {
    return !!clickIfPresent(window, [(player.crew || []).length < 6 ? "#acceptRecruitBtn" : "#rejectRecruitBtn"]);
  }

  if (window.document.getElementById("rejectFullRecruitBtn")) {
    return !!clickIfPresent(window, ["#rejectFullRecruitBtn"]);
  }

  if (window.document.getElementById("leaveTavernBtn")) {
    if ((player.crew || []).length < 6 && player.coins >= 2500 && window.document.getElementById("rollRecruitBtn") && !window.document.getElementById("rollRecruitBtn").disabled) {
      if (!memory.tavernSelectedThisVisit) {
        memory.tavernSelectedThisVisit = selectBestTavernCandidate(window, debug, player);
        return true;
      }
      if (!memory.tavernFocusedThisVisit && player.coins >= 5500 && window.document.getElementById("tavernFocusBtn") && !window.document.getElementById("tavernFocusBtn").disabled) {
        memory.tavernFocusedThisVisit = true;
        window.document.getElementById("tavernFocusBtn").click();
        return true;
      }
      memory.tavernSelectedThisVisit = false;
      memory.tavernFocusedThisVisit = false;
      return !!clickIfPresent(window, ["#rollRecruitBtn"]);
    }
    memory.tavernSelectedThisVisit = false;
    memory.tavernFocusedThisVisit = false;
    return !!clickIfPresent(window, ["#leaveTavernBtn"]);
  }

  if (window.document.getElementById("challengeBtn")) {
    const challenge = window.document.getElementById("challengeBtn");
    if (!challenge.disabled && shouldStayOnIsland(debug, memory)) {
      challenge.click();
      return true;
    }
  }

  if (window.document.getElementById("yonkoStoryStartBtn") || window.document.getElementById("yonkoStoryLeaveBtn")) {
    const start = window.document.getElementById("yonkoStoryStartBtn");
    if (start && !start.disabled && shouldChallengeCurrentYonko(debug, memory)) {
      start.click();
      return true;
    }
    clickIfPresent(window, ["#yonkoStoryLeaveBtn"]);
    return true;
  }

  if (window.document.getElementById("continueSailingBtn") || window.document.getElementById("stayOnIslandBtn")) {
    clickIfPresent(window, [shouldStayOnIsland(debug, memory) ? "#stayOnIslandBtn" : "#continueSailingBtn"]);
    return true;
  }

  const clicked = clickIfPresent(window, [
    "#continueElbaphImuStoryBtn",
    "#confirmSeaEventBtn",
    "#confirmChestBtn",
    "#confirmEventIslandBtn",
    "#finalGateCloseBtn",
    "#closeModalBtn",
    "#closeIslandBtn",
    "#closeInspectBtn",
    ".final-imu-btn.primary:not(:disabled)",
    ".final-ending-btn.primary:not(:disabled)",
    ".modal-row .modal-btn.primary",
    ".modal-row .modal-btn.secondary",
  ]);
  return Boolean(clicked);
}

function chooseBattleMove(view) {
  const moves = combatMovesForCard(view.activeCard).filter((move) => Number(move.currentPP ?? move.pp ?? 0) > 0);
  if (!moves.length) return null;
  const damaging = moves.filter((move) => Number(move.power || 0) > 0 || move.damageRange);
  const pool = damaging.length ? damaging : moves;
  return pool
    .slice()
    .sort((a, b) => {
      const avgA = a.damageRange ? (Number(a.damageRange.min || 0) + Number(a.damageRange.max || 0)) / 2 : Number(a.power || 0);
      const avgB = b.damageRange ? (Number(b.damageRange.min || 0) + Number(b.damageRange.max || 0)) / 2 : Number(b.power || 0);
      const attrA = attributeMatchScore(a.attribute || view.activeCard.attribute, view.enemy?.attribute);
      const attrB = attributeMatchScore(b.attribute || view.activeCard.attribute, view.enemy?.attribute);
      const scoreA = avgA * (Number(a.accuracy ?? 100) / 100) * (attrA > 0 ? 1.22 : attrA < 0 ? 0.82 : 1);
      const scoreB = avgB * (Number(b.accuracy ?? 100) / 100) * (attrB > 0 ? 1.22 : attrB < 0 ? 0.82 : 1);
      return scoreB - scoreA;
    })[0];
}

function combatMovesForCard(card) {
  if (Array.isArray(card?.moves) && card.moves.length) return card.moves;
  if (Array.isArray(card?.moveSet) && card.moveSet.length) return card.moveSet;
  return [];
}

function hasUsableDamagingMove(card) {
  return combatMovesForCard(card).some((move) => (
    Number(move.currentPP ?? move.pp ?? 0) > 0
    && (Number(move.power || 0) > 0 || move.damageRange)
  ));
}

function isFinalPressureBattle(view) {
  const battle = view?.battle || {};
  const key = String(view?.enemy?.key || battle.enemyCombatant?.key || "");
  return Boolean(
    battle.isFinalGate
    || battle.islandKind === "final_gate"
    || battle.islandKind === "elbaph_god_knight"
    || key === "final_imu"
    || key === "god_knight_killingham"
    || key === "god_knight_sommers"
  );
}

function battleSwitchScore(card, enemyAttr) {
  const hpRatioValue = Number(card?.currentHp || 0) / Math.max(1, Number(card?.maxHp || card?.baseStats?.hp || 1));
  const attrScore = attributeMatchScore(card?.attribute, enemyAttr);
  return attrScore * 95
    + hpRatioValue * 55
    + Number(card?.level || 1)
    + cardCombatScore(card) * 0.08
    + (hasUsableDamagingMove(card) ? 35 : -80);
}

function battleHealingItemScore(item, view, target) {
  if (!item || !target) return -999;
  const effect = item.effect || {};
  const targetRatio = target.card ? cardHpRatio(target.card) : 1;
  const teamRatio = battleTeamHpRatio(view);
  const deadCount = (view?.player?.crew || []).filter((card) => Number(card?.currentHp || 0) <= 0).length;
  const finalPressure = isFinalPressureBattle(view);
  if (effect.kind === "revive") return deadCount > 0 ? 260 + cardCombatScore(target.card) * 0.2 + (finalPressure ? 120 : 0) : -999;
  let score = (1 - targetRatio) * 190 + (0.62 - teamRatio) * 120 - itemTierScore(item) * 0.25;
  if (finalPressure) score += 80 + (0.78 - teamRatio) * 170 + (0.58 - targetRatio) * 130;
  if (/party/.test(effect.kind || "")) score += teamRatio < (finalPressure ? 0.72 : 0.5) ? 105 : 15;
  if (item.id === "heal_2" || item.id === "small_meat") score += 20;
  if (item.rarity === "S" && teamRatio > (finalPressure ? 0.72 : 0.34)) score -= 85;
  return score;
}

function chooseBattleItem(debug, view) {
  const player = view?.player;
  if (!player) return null;
  const items = getGameItems(debug);
  const crew = (player.crew || []).map((card, index) => ({ card, index }));
  const deadTargets = crew.filter((entry) => Number(entry.card?.currentHp || 0) <= 0);
  const livingTargets = crew.filter((entry) => Number(entry.card?.currentHp || 0) > 0);
  const activeIndex = Number(view?.battle?.activeCrewIndex ?? player.activeCrewIndex ?? 0);
  const activeTarget = crew.find((entry) => entry.index === activeIndex) || livingTargets[0];
  const lowestTarget = livingTargets.slice().sort((a, b) => cardHpRatio(a.card) - cardHpRatio(b.card))[0] || activeTarget;
  const battleItems = Object.values(items)
    .filter((item) => item?.category === "battle" && item.usableInBattle)
    .filter((item) => playerInventoryCount(player, item.id) > 0);
  if (!battleItems.length) return null;
  const candidates = [];
  battleItems.forEach((item) => {
    const kind = item.effect?.kind || "";
    if (kind === "revive") {
      const target = deadTargets.sort((a, b) => cardCombatScore(b.card) - cardCombatScore(a.card))[0];
      candidates.push({ item, target, score: battleHealingItemScore(item, view, target) });
      return;
    }
    if (["heal_hp", "heal_hp_percent", "heal_percent_and_cure_status", "heal_party_percent_battle", "heal_party_percent_outside_battle"].includes(kind)) {
      const target = /party/.test(kind) ? activeTarget : lowestTarget;
      candidates.push({ item, target, score: battleHealingItemScore(item, view, target) });
      return;
    }
    if (kind === "escape_battle" && shouldEscapeBattle(view)) {
      candidates.push({ item, target: activeTarget, score: 180 });
      return;
    }
    if (kind === "restore_skill_use" && ppRatio(player) < 0.22) {
      candidates.push({ item, target: activeTarget, score: 75 });
      return;
    }
    if (/apply_.*stage|accuracy|speed|status/.test(kind || "") && view.enemy?.currentHp / Math.max(1, view.enemy?.maxHp || 1) > 0.45) {
      candidates.push({ item, target: activeTarget, score: 36 + itemTierScore(item) * 0.4 });
    }
  });
  const teamRatio = battleTeamHpRatio(view);
  const activeRatio = view.activeCard?.currentHp / Math.max(1, view.activeCard?.maxHp || 1);
  const finalPressure = isFinalPressureBattle(view);
  return candidates
    .filter((entry) => entry.target && (
      entry.score > (finalPressure ? 55 : 95)
      || (activeRatio < (finalPressure ? 0.58 : 0.31) && entry.score > 30)
      || (teamRatio < (finalPressure ? 0.72 : 0.42) && entry.score > 30)
    ))
    .sort((a, b) => b.score - a.score)[0] || null;
}

function battleTeamHpRatio(view) {
  const crew = (view?.player?.crew || []).filter(Boolean);
  if (!crew.length) return 0;
  return average(crew.map((card) => Number(card.currentHp || 0) / Math.max(1, Number(card.maxHp || 1))));
}

function battleCrewAverageLevel(view) {
  return average((view?.player?.crew || []).filter(Boolean).map((card) => Number(card.level || 1)));
}

function shouldEscapeBattle(view) {
  if (!view?.battle?.escapeThreshold) return false;
  if (view.battle.islandKind === "impel_down") return false;
  const crewSize = (view.player?.crew || []).length;
  const avgLevel = battleCrewAverageLevel(view);
  const enemyLevel = Number(view.enemy?.level || 1);
  const teamHp = battleTeamHpRatio(view);
  const isSeaEncounter = view.battle.islandKind === "sea-encounter";
  if (!isSeaEncounter) return false;
  if (teamHp < 0.34) return true;
  if (isSeaEncounter && crewSize < 6 && enemyLevel > avgLevel + 3) return true;
  if (isSeaEncounter && avgLevel < 10 && enemyLevel > avgLevel + 5) return true;
  if (isSeaEncounter && crewSize < 6 && teamHp < 0.82) return true;
  return false;
}

function shouldHuntImpelDownTargets(player, memory = {}) {
  if (!memory.targetAllEnemies) return false;
  const crewSize = (player?.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  return crewSize >= 6
    && avgLevel >= 66
    && hpRatio(player) >= 0.82
    && ppRatio(player) >= 0.48
    && missingAnyEnemyKey(player, IMPEL_DOWN_TARGET_ENEMY_KEYS);
}

function shouldPrioritizeImpelEscape(debug, player, memory = {}) {
  if (!player) return true;
  if (memory.targetEnding) return true;
  if (debug.getState().gameState?.finalIslandUnlocked) return true;
  if (playerHasAllRoadPoneglyphsForTest(player)) return true;
  return !shouldHuntImpelDownTargets(player, memory);
}

function shouldFightImpelEventForEscape(view, player) {
  const eventId = view?.event?.id || "";
  const avgLevel = crewAvgLevel(player);
  const power = Number(player?.power || 0);
  const healthy = hpRatio(player) >= 0.84 && ppRatio(player) >= 0.5;
  if (!healthy) return false;
  if (eventId === "magellan") {
    return Number(view?.level || 1) >= 4 && (avgLevel >= 76 || power >= 175);
  }
  if (eventId === "patrol") {
    const level = Math.max(1, Number(view?.level || 1));
    const safeLevel = [0, 10, 20, 36, 52, 68, 84][level] || 84;
    return avgLevel + 8 >= safeLevel || power >= 150;
  }
  return false;
}

function chooseBigMomSoulChoice(view) {
  const prompt = view?.battle?.yonkoPrompt || {};
  const options = prompt.options || {};
  const activeRatio = Number(view?.activeCard?.currentHp || 0) / Math.max(1, Number(view?.activeCard?.maxHp || 1));
  const coins = Number(view?.player?.coins || 0);
  if (options.item && activeRatio < 0.72) return "item";
  if (options.coins && coins >= 900) return "coins";
  if (options.pp && activeRatio < 0.45) return "pp";
  if (options.hp && activeRatio >= 0.55) return "hp";
  if (options.item) return "item";
  if (options.coins) return "coins";
  if (options.pp) return "pp";
  if (options.hp) return "hp";
  return "refuse";
}

function chooseAttributeSwitch(view) {
  const enemyAttr = view?.enemy?.attribute;
  const activeScore = attributeMatchScore(view?.activeCard?.attribute, enemyAttr);
  const activeHpRatio = Number(view?.activeCard?.currentHp || 0) / Math.max(1, Number(view?.activeCard?.maxHp || 1));
  if (activeScore > 0 && activeHpRatio > 0.32) return null;
  const activeIndex = Number(view?.player?.activeCrewIndex ?? view?.battle?.activeCrewIndex ?? -1);
  return (view?.player?.crew || [])
    .map((card, index) => {
      const hpRatioValue = Number(card.currentHp || 0) / Math.max(1, Number(card.maxHp || 1));
      return {
        ...card,
        index,
        hpRatio: hpRatioValue,
        attrScore: attributeMatchScore(card.attribute, enemyAttr),
      };
    })
    .filter((card) => card.index !== activeIndex && card.currentHp > 0 && card.hpRatio > 0.45 && hasUsableDamagingMove(card))
    .sort((a, b) => {
      const scoreA = a.attrScore * 70 + a.hpRatio * 20 + Number(a.level || 1);
      const scoreB = b.attrScore * 70 + b.hpRatio * 20 + Number(b.level || 1);
      return scoreB - scoreA;
    })
    .find((card) => card.attrScore > activeScore && (card.attrScore > 0 || activeScore < 0)) || null;
}

async function handleBattle(debug) {
  for (let guard = 0; guard < 220; guard += 1) {
    const view = debug.getBattleView();
    if (!view) return true;
    if (view.battle.prebattleIntro && !view.battle.prebattleIntro.done) {
      debug.battleMarkPrebattleIntroDone();
      await wait(12);
      continue;
    }
    if (view.battle.needsReplacement) {
      const enemyAttr = view?.enemy?.attribute;
      const finalPressure = isFinalPressureBattle(view);
      const best = (view.battle.replacementCandidates || [])
        .slice()
        .sort((a, b) => {
          if (finalPressure) return battleSwitchScore(b, enemyAttr) - battleSwitchScore(a, enemyAttr);
          return (b.currentHp / Math.max(1, b.maxHp)) - (a.currentHp / Math.max(1, a.maxHp));
        })[0];
      if (best) debug.battleChooseReplacement(best.index);
      await wait(16);
      continue;
    }
    if (view.battle.result === "judicial-switch") {
      const crewWithIndex = (view.player.crew || []).map((card, index) => ({ ...card, index }));
      const best = crewWithIndex
        .filter((card) => Number(card.currentHp || 0) > 0)
        .sort((a, b) => (b.currentHp / Math.max(1, b.maxHp)) - (a.currentHp / Math.max(1, a.maxHp)))[0];
      debug.battleJudicialNextSwitch(best?.index ?? view.battle.activeCrewIndex ?? 0);
      await wait(20);
      continue;
    }
    if (view.battle.yonkoPrompt?.type === "bigmom_soul_torture") {
      debug.battleYonkoSoulChoice(chooseBigMomSoulChoice(view));
      await wait(24);
      continue;
    }
    if (view.battle.canFinish) {
      debug.battleFinish();
      await wait(20);
      if (!debug.getBattleView()) return true;
      continue;
    }
    if (view.battle.canAct) {
      const activeRatio = view.activeCard.currentHp / Math.max(1, view.activeCard.maxHp);
      const activeAttrScore = attributeMatchScore(view.activeCard?.attribute, view.enemy?.attribute);
      const activeHasDamage = hasUsableDamagingMove(view.activeCard);
      const crewWithIndex = (view.player.crew || []).map((card, index) => ({ ...card, index }));
      const finalPressure = isFinalPressureBattle(view);
      const healthier = crewWithIndex
        .filter((card) => !card.isActive && card.currentHp / Math.max(1, card.maxHp) > activeRatio + (finalPressure ? 0.18 : 0.35))
        .sort((a, b) => finalPressure
          ? battleSwitchScore(b, view.enemy?.attribute) - battleSwitchScore(a, view.enemy?.attribute)
          : (b.currentHp / Math.max(1, b.maxHp)) - (a.currentHp / Math.max(1, a.maxHp)))[0];
      const earlyBattle = Number(view.battle.roundIndex || view.battle.round || 0) <= 2;
      const attributeSwitch = (!activeHasDamage || activeAttrScore < 0 || earlyBattle) ? chooseAttributeSwitch(view) : null;
      const battleItem = chooseBattleItem(debug, view);
      if (battleItem) {
        debug.battleUseItem(battleItem.item.id, battleItem.target?.index ?? null);
      } else if (shouldEscapeBattle(view)) {
        debug.battleTryEscape();
      } else if (attributeSwitch) {
        debug.battleChooseSwitch(attributeSwitch.index);
      } else if (activeRatio < 0.22 && healthier) {
        debug.battleChooseSwitch(healthier.index);
      } else if (activeRatio < 0.18 && view.battle.escapeThreshold) {
        debug.battleTryEscape();
      } else {
        const move = chooseBattleMove(view);
        if (move) debug.battleChooseMove(move.id);
        else {
          const fallback = crewWithIndex.find((card) => !card.isActive && card.currentHp > 0);
          if (fallback) debug.battleChooseSwitch(fallback.index);
          else if (view.battle.escapeThreshold) debug.battleTryEscape();
          else debug.battleSurrender();
        }
      }
      await wait(24);
      continue;
    }
    await wait(12);
  }
  return false;
}

function handleImpelDown(debug, memory = {}) {
  const state = debug.getState();
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (!player?.impelDown?.active || state.battleState) return false;
  const view = debug.getImpelDownView?.();
  if (!view || !view.active) return false;
  const crewSize = (player.crew || []).length;
  const avgLevel = crewAvgLevel(player);
  const deepReady = crewSize >= 6 && avgLevel >= 65 && hpRatio(player) >= 0.82 && ppRatio(player) >= 0.45;
  const escapeOnly = shouldPrioritizeImpelEscape(debug, player, memory);
  if (view.status === "locked") {
    debug.impelRollEscape();
    return true;
  }
  if (view.status === "free" || view.status === "wait_event") {
    debug.impelDrawEvent();
    return true;
  }
  if (view.status === "event") {
    if (escapeOnly) {
      const eventId = view.event?.id || "";
      if (eventId === "key") debug.impelResolveEventPrimary();
      else if (eventId === "ivankov") {
        if (hpRatio(player) < 0.55 || ppRatio(player) < 0.25) debug.impelResolveEventPrimary();
        else debug.impelResolveEventSecondary();
      } else if (shouldFightImpelEventForEscape(view, player)) debug.impelResolveEventPrimary();
      else debug.impelResolveEventSecondary();
      return true;
    }
    if ((view.event?.id === "patrol" || view.event?.id === "magellan") && hpRatio(player) < 0.52) {
      debug.impelResolveEventSecondary();
      return true;
    }
    if (view.event?.id === "magellan" && !deepReady) {
      debug.impelResolveEventSecondary();
      return true;
    }
    debug.impelResolveEventPrimary();
    return true;
  }
  if (view.status === "move") {
    if (escapeOnly) {
      if (view.allowEscape) debug.impelDirectEscape();
      else debug.impelMove("up");
      return true;
    }
    const impelKeysByLevel = {
      1: "impel_l1_sadie",
      2: "impel_l2_minochihuahua",
      3: "impel_l3_minokoala",
      4: "impel_l4_minotaur",
      5: "impel_l5_minorhino",
      6: "impel_l6_hannyabal",
    };
    const remainingFloorLevels = Object.entries(impelKeysByLevel)
      .filter(([, key]) => !hasDefeatedEnemyKey(player, key))
      .map(([level]) => Number(level));
    const magellanMissing = !hasDefeatedEnemyKey(player, "magellan");
    if (view.allowEscape && !remainingFloorLevels.length && !magellanMissing) {
      debug.impelDirectEscape();
    } else {
      const currentLevel = Math.max(1, Math.min(6, Number(view.level || 1)));
      let direction = "up";
      if (remainingFloorLevels.length || magellanMissing) {
        const desiredLevel = remainingFloorLevels.length
          ? remainingFloorLevels.reduce((best, level) => Math.abs(level - currentLevel) < Math.abs(best - currentLevel) ? level : best, remainingFloorLevels[0])
          : 6;
        direction = deepReady && currentLevel < desiredLevel ? "down" : "up";
      }
      debug.impelMove(direction);
    }
    return true;
  }
  if (view.status === "recruit") {
    debug.impelSkipRecruit();
    return true;
  }
  if (view.status === "escaped") {
    debug.impelClose();
    return true;
  }
  return false;
}

function postMarinefordCommand(window, type, payload = {}) {
  window.postMessage({
    type: "board-marineford-command",
    command: {
      id: `growth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type,
      payload,
    },
  }, "*");
}

function forceMarinefordProgress(debug) {
  const state = debug.getState();
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (!player?.marinefordHold?.active || state.battleState) return false;
  const hold = player.marinefordHold;
  if (hold.setupStep === "chooseExecution") {
    const preferred = ["ace", "whitebeard", "marco", "jozu", "vista", "izo", "little_oars_jr", "squard"];
    const unavailable = new Set([
      ...(hold.lostWhitebeard || []),
      ...(hold.joinedWhitebeard || []),
      ...(hold.slots || []).map((slot) => slot?.cardId).filter(Boolean),
      ...(hold.helpers || []).map((helper) => helper?.cardId).filter(Boolean),
    ]);
    const cardId = preferred.find((id) => !unavailable.has(id));
    const slotIndex = Math.max(0, Number(hold.selectedSlotIndex || 0));
    if (!cardId) return false;
    hold.slots[slotIndex] ||= {
      playerId: player.id,
      playerName: player.name,
      source: "whitebeard",
      canJoinOnWin: true,
      roundsLeft: 20,
    };
    hold.slots[slotIndex].playerId ||= player.id;
    hold.slots[slotIndex].playerName ||= player.name;
    hold.slots[slotIndex].cardId = cardId;
    hold.slots[slotIndex].source = "whitebeard";
    hold.slots[slotIndex].canJoinOnWin = true;
    hold.slots[slotIndex].roundsLeft = Math.max(1, Number(hold.slots[slotIndex].roundsLeft || 20));
    hold.setupStep = "ready";
    hold.started = false;
    debug.renderAll?.();
    return true;
  }
  if (hold.setupStep === "ready" && !hold.started && !hold.finished) {
    const result = debug.startMarinefordBattle?.(player);
    return Boolean(result?.ok);
  }
  return false;
}

function handleMarineford(window, debug) {
  const state = debug.getState();
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (!player?.marinefordHold?.active || state.battleState) return false;
  const hold = player.marinefordHold;
  const view = debug.getMarinefordView?.();
  if (!view || !view.active) {
    debug.openMarinefordWindow?.(player);
    return true;
  }
  if (view.finished) {
    hold.active = false;
    debug.renderAll();
    debug.endTurn();
    return true;
  }
  if (hold.setupStep === "drawCrew") {
    const candidate = (player.crew || []).find((card) => card?.id) || null;
    hold.slots = candidate ? [{
        playerId: player.id,
        playerName: player.name,
        cardId: candidate.id,
        source: "crew",
        cleanOnLoss: true,
        canJoinOnWin: false,
        roundsLeft: 5,
        rescued: false,
        executed: false,
      }] : [];
    hold.setupStep = hold.slots.length ? "drawSupport" : "drawCrew";
    debug.renderAll();
    return true;
  }
  if (hold.setupStep === "drawSupport") {
    hold.helpers = [];
    hold.setupStep = "ready";
    debug.renderAll();
    return true;
  }
  if (hold.setupStep === "chooseExecution") {
    const preferred = ["ace", "whitebeard", "marco", "jozu", "vista", "izo", "little_oars_jr", "squard"];
    const unavailable = new Set([
      ...(view?.lostWhitebeard || []),
      ...(view?.joinedWhitebeard || []),
      ...(hold.slots || []).map((slot) => slot?.cardId).filter(Boolean),
      ...(hold.helpers || []).map((helper) => helper?.cardId).filter(Boolean),
    ]);
    const cardId = preferred.find((id) => !unavailable.has(id));
    const slotIndex = Math.max(0, Number(hold.selectedSlotIndex || 0));
    if (!cardId) return false;
    postMarinefordCommand(window, "assignExecution", { slotIndex, cardId });
    hold.slots[slotIndex] ||= {
      playerId: player.id,
      playerName: player.name,
      source: "whitebeard",
      canJoinOnWin: true,
      roundsLeft: 20,
    };
    hold.slots[slotIndex].cardId = cardId;
    hold.slots[slotIndex].source = "whitebeard";
    hold.slots[slotIndex].canJoinOnWin = true;
    hold.slots[slotIndex].roundsLeft = Math.max(1, Number(hold.slots[slotIndex].roundsLeft || 20));
    hold.setupStep = "ready";
    hold.started = false;
    debug.renderAll();
    return true;
  }
  const result = debug.startMarinefordBattle?.(player);
  return Boolean(result?.ok);
}

function maybeActivateFinalIslandForEndingTest(debug, player, memory) {
  if (!memory.targetEnding || !player) return false;
  if (!isEndingCaptain(debug, player, memory)) return false;
  const state = debug.getState();
  if (state.gameState.finalIslandUnlocked) return false;
  if (!state.gameState.finalIslandCandidate) return false;
  if (!playerHasAllRoadPoneglyphsForTest(player)) return false;
  const token = `${player.id || player.name}:${roadPoneglyphSet(player).size}:${state.gameState.round || 0}`;
  if (memory.finalActivationToken === token) return false;
  memory.finalActivationToken = token;
  return Boolean(debug.activateFinalIslandFromBackpack?.(player));
}

function shouldFastPassForEndingCaptain(debug, player, memory) {
  if (!memory.targetEnding || !memory.focusEndingCaptain || !player) return false;
  if (isEndingCaptain(debug, player, memory)) return false;
  const state = debug.getState();
  return Boolean(
    state.gameState?.phase === "main"
    && !state.battleState
    && !player.pendingBattle
    && !player.impelDown?.active
    && !player.marinefordHold?.active
    && !state.gameState.pendingMove
    && !state.gameState.movementAnimating
    && !state.gameState.diceRolling
    && !state.gameState.routePrompt
    && !state.gameState.islandDecision
    && !state.gameState.resolutionLock
  );
}

async function settleState(window, debug, memory) {
  for (let guard = 0; guard < 1200; guard += 1) {
    const state = debug.getState();
    const player = state.gameState.players[state.gameState.currentPlayerIndex];
    if (skipOrCancelPlayerTrade(window, debug)) {
      await wait(30);
      continue;
    }
    if (state.battleState) {
      await handleBattle(debug);
      continue;
    }
    if (forceMarinefordProgress(debug)) {
      await wait(30);
      continue;
    }
    if (handleMarineford(window, debug)) {
      await wait(30);
      return true;
    }
    if (handleImpelDown(debug, memory)) {
      await wait(20);
      return true;
    }
    if (state.gameState.phase === "main"
      && player
      && completedMissionCount(player) > 0
      && !state.gameState.pendingMove
      && !state.gameState.movementAnimating
      && !state.gameState.diceRolling
      && !state.gameState.routePrompt
      && !state.gameState.islandDecision
      && !state.gameState.resolutionLock
      && openShipMissionJournal(window, player)) {
      await wait(20);
      continue;
    }
    if (player && runCrewPreparation(window, debug, player, memory)) {
      await wait(20);
      continue;
    }
    if (maybeActivateFinalIslandForEndingTest(debug, player, memory)) {
      await waitRaw(32000);
      continue;
    }
    if (state.gameState.routePrompt) {
      chooseRoute(debug, memory);
      await waitRaw(32);
      continue;
    }
    if (state.gameState.islandDecision) {
      const selector = shouldStayOnIsland(debug, memory) ? "#stayOnIslandBtn" : "#continueSailingBtn";
      clickIfPresent(window, [selector]);
      await wait(20);
      continue;
    }
    if (await handleModalOrOverlay(window, debug, memory)) {
      await wait(20);
      continue;
    }
    if (state.gameState.pendingMove && !state.gameState.movementAnimating && !state.gameState.diceRolling && !state.gameState.routePrompt && !state.gameState.islandDecision && !state.gameState.resolutionLock) {
      await debug.continueMove();
      await waitRaw(32);
      continue;
    }
    if (state.gameState.movementAnimating || state.gameState.diceRolling || state.gameState.pendingMove) {
      await waitRaw(32);
      continue;
    }
    if (state.gameState.resolutionLock) {
      state.gameState.resolutionLock = false;
      await wait(20);
      continue;
    }
    return true;
  }
  return false;
}

async function runTurn(window, debug, memory) {
  const settled = await settleState(window, debug, memory);
  if (!settled) return { ok: false, reason: "settle-timeout" };
  const state = debug.getState();
  if (state.gameState.phase !== "main") return { ok: false, reason: `phase-${state.gameState.phase}` };
  if (state.battleState) return { ok: true, reason: "battle" };
  const player = state.gameState.players[state.gameState.currentPlayerIndex];
  if (!player) return { ok: false, reason: "no-player" };
  if (player.impelDown?.active) return { ok: true, reason: "impel-down" };
  if (player.marinefordHold?.active) return { ok: true, reason: "marineford" };
  if (shouldFastPassForEndingCaptain(debug, player, memory)) {
    const captain = endingCaptainPlayer(debug, memory);
    debug.endTurn?.({
      reason: "target-ending-captain-focus",
      subtitle: captain ? `協助 ${captain.name || "終局船長"} 集中推進最終之島。` : "集中推進最終之島。",
    });
    await wait(20);
    await settleState(window, debug, memory);
    return { ok: true, reason: "focus-ending-captain" };
  }
  await debug.rollDice();
  await waitRaw(24);
  await settleState(window, debug, memory);
  return { ok: true, reason: "rolled" };
}

function updateMilestones(run, snapshot, turn) {
  LEVEL_MILESTONES.forEach((level) => {
    const key = `avg${level}`;
    if (!run.milestones[key] && snapshot.avgLevel >= level) {
      run.milestones[key] = { turn, round: snapshot.round, location: snapshot.location };
    }
    const maxKey = `max${level}`;
    if (!run.milestones[maxKey] && snapshot.maxLevel >= level) {
      run.milestones[maxKey] = { turn, round: snapshot.round, location: snapshot.location };
    }
  });
}

function trimDiagnosticLogs(debug, keep = 250) {
  const state = debug.getState();
  const log = state?.gameState?.log;
  if (!Array.isArray(log) || log.length <= keep) return log?.length || 0;
  log.splice(0, log.length - keep);
  return log.length;
}

async function runSeed(baseUrl, seed, runIndex, config, attemptInfo = {}) {
  const booted = await bootGame(baseUrl, seed, runIndex, config);
  const { dom, debug, errors } = booted;
  const run = {
    seed,
    baseSeed: attemptInfo.baseSeed ?? seed,
    attempt: Number(attemptInfo.attempt || 0),
    startMode: config.startMode,
    team: (booted.startingTeam || []).map((card) => card.id),
    startingTeam: booted.startingTeam || [],
    startingPlayers: booted.startingPlayers || [],
    startingComposition: booted.startingComposition || null,
    draftHistory: booted.draftHistory || [],
    startedAt: new Date().toISOString(),
    maxTurns: config.maxTurns,
    turnsPlayed: 0,
    stopReason: "",
    errors,
    metrics: {},
    milestones: {},
    samples: [],
    warnings: [],
    final: null,
  };
  const memory = {
    targetEnding: Boolean(config.targetEnding),
    targetAllEnemies: Boolean(config.targetAllEnemies),
    focusEndingCaptain: Boolean(config.focusEndingCaptain),
    lastTargets: [],
    avoidIslandNames: {},
    shopBuysThisVisit: 0,
    tavernSelectedThisVisit: false,
    tavernFocusedThisVisit: false,
  };
  if (memory.targetEnding && memory.focusEndingCaptain) {
    const captain = endingCaptainPlayer(debug, memory);
    run.endingCaptain = captain ? { id: playerToken(captain), name: captain.name || playerToken(captain) } : null;
  }
  const summaryFocusPlayer = () => (memory.targetEnding && memory.focusEndingCaptain ? endingCaptainPlayer(debug, memory) : null);
  let lastLogLength = debug.getState().gameState.log.length;
  const deadline = Date.now() + config.maxMinutes * 60 * 1000;
  const progressPath = path.join(config.outDir, `growth_curve_progress_seed_${seed}_${config.label || "run"}.json`);
  const savePath = path.join(config.outDir, `growth_curve_progress_seed_${seed}_${config.label || "run"}_save.json`);

  const writeProgress = (turn, note = "") => {
    try {
      if (typeof debug.createManualSavePayload === "function") {
        fs.writeFileSync(savePath, JSON.stringify(debug.createManualSavePayload(), null, 2), "utf8");
      }
      fs.writeFileSync(progressPath, JSON.stringify({
        seed,
        turn,
        note,
        updatedAt: new Date().toISOString(),
        savePath,
        run: {
          stopReason: run.stopReason,
          turnsPlayed: run.turnsPlayed,
          metrics: run.metrics,
          milestones: run.milestones,
          final: summarizeState(debug, summaryFocusPlayer()),
          warnings: run.warnings.slice(-3),
          logTail: debug.getState().gameState.log.slice(-12),
          dom: domStatus(dom.window, debug),
        },
      }, null, 2), "utf8");
    } catch (_error) {
      // Progress files are diagnostic only.
    }
  };

  for (let turn = 1; turn <= config.maxTurns; turn += 1) {
    if (Date.now() > deadline) {
      run.stopReason = "time-limit";
      break;
    }
    memory.turn = turn;
    let result = null;
    try {
      result = await withTimeout(runTurn(dom.window, debug, memory), config.turnTimeoutMs, `turn ${turn}`);
    } catch (error) {
      const snapshot = summarizeState(debug, summaryFocusPlayer());
      const tail = debug.getState().gameState.log.slice(-12);
      const restartReason = shouldRestartRun(config, run, snapshot, turn, tail);
      run.stopReason = restartReason ? `restart-reselect-${restartReason}` : "turn-timeout";
      run.warnings.push({
        turn,
        reason: restartReason || error.message,
        snapshot,
        dom: domStatus(dom.window, debug),
        logTail: tail,
      });
      break;
    }
    run.turnsPlayed = turn;
    const state = debug.getState();
    const newLines = state.gameState.log.slice(lastLogLength);
    lastLogLength = state.gameState.log.length;
    updateMemoryFromLogs(memory, newLines, turn);
    mergeMetrics(run.metrics, analyzeLogLines(newLines));

    const snapshot = summarizeState(debug, summaryFocusPlayer());
    updateMilestones(run, snapshot, turn);
    if (turn === 1 || turn % 25 === 0 || newLines.some((line) => /升到 Lv\.|擊敗|完成任務|水之七島/.test(line))) {
      run.samples.push({
        turn,
        ...snapshot,
        logTail: newLines.slice(-6),
      });
      if (run.samples.length > 240) run.samples.splice(0, run.samples.length - 240);
    }
    if (turn === 1 || turn % config.progressEvery === 0) {
      writeProgress(turn, "running");
      process.stdout.write(`[growth] seed ${seed} turn ${turn}/${config.maxTurns} avgLv=${snapshot.avgLevel} maxLv=${snapshot.maxLevel} loc=${snapshot.location}\n`);
    }
    if (!result.ok) {
      run.stopReason = result.reason;
      run.warnings.push({ turn, reason: result.reason, snapshot, logTail: state.gameState.log.slice(-10) });
      break;
    }
    if (finalEndingCompleted(snapshot)) {
      run.stopReason = "final-ending-completed";
      break;
    }
    lastLogLength = trimDiagnosticLogs(debug);
    const restartReason = shouldRestartRun(config, run, snapshot, turn, newLines);
    if (restartReason) {
      run.stopReason = `restart-reselect-${restartReason}`;
      run.warnings.push({ turn, reason: restartReason, snapshot, logTail: state.gameState.log.slice(-12) });
      break;
    }
    if (config.targetAllEnemies && Number(snapshot.enemyCoverage?.remaining || 0) <= 0) {
      if (!run.milestones.allEnemies) {
        run.milestones.allEnemies = { turn, round: snapshot.round, location: snapshot.location };
      }
      if (!config.continueAfterTargets) {
        run.stopReason = "all-enemies-defeated";
        break;
      }
    }
  }
  if (!run.stopReason) run.stopReason = "turn-limit";
  writeProgress(run.turnsPlayed, run.stopReason);
  if (run.stopReason !== "turn-timeout") {
    await settleState(dom.window, debug, memory);
  }
  run.final = summarizeState(debug, summaryFocusPlayer());
  run.endedAt = new Date().toISOString();
  run.logTail = debug.getState().gameState.log.slice(-30);
  dom.window.close();
  return run;
}

function buildMarkdownReport(results, config) {
  const endingLabel = (final) => {
    const direct = Array.isArray(final?.finalEndingSeen) ? final.finalEndingSeen : [];
    const byPlayer = (final?.allPlayers || []).flatMap((entry) => Array.isArray(entry.finalEndingSeen) ? entry.finalEndingSeen : []);
    return Array.from(new Set([...direct, ...byPlayer])).join(", ") || "-";
  };
  const lines = [];
  lines.push("# Growth Curve Playtest Report");
  lines.push("");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push(`Seeds: ${results.runs.map((run) => run.seed).join(", ")}`);
  lines.push(`Start mode: ${config.startMode}`);
  if (config.startMode === "fixed") lines.push(`Fixed team: ${config.team.join(", ")}`);
  lines.push(`Turn cap per seed: ${config.maxTurns}`);
  lines.push(`Target all enemies: ${config.targetAllEnemies ? "yes" : "no"}`);
  lines.push(`Target ending: ${config.targetEnding ? "yes" : "no"}`);
  if (config.targetEnding) lines.push(`Focus ending captain: ${config.focusEndingCaptain ? "yes" : "no"}`);
  if (config.targetAllEnemies) lines.push(`Continue after targets: ${config.continueAfterTargets ? "yes" : "no"}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push("| Seed | Stop | Turns | Ending | Avg Lv | Avg Training | Max Lv | Crew | Coins | Bounty | Enemy Codex | Coverage | Enemy Islands | Yonko | Wins | Losses | Impel/Judicial/Marineford | Ship Slots/Upgrades |");
  lines.push("| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |");
  results.runs.forEach((run) => {
    const final = run.final || {};
    const coverage = final.enemyCoverage || {};
    lines.push(`| ${run.seed} | ${run.stopReason} | ${run.turnsPlayed} | ${endingLabel(final)} | ${final.avgLevel ?? 0} | ${final.avgTraining ?? 0} | ${final.maxLevel ?? 0} | ${(final.crew || []).length || 0} | ${final.coins ?? 0} | ${final.bounty ?? 0} | ${final.defeatedEnemyUnique ?? 0} | ${(coverage.defeatedTargets ?? 0)}/${(coverage.totalTargets ?? 0)} (${coverage.percent ?? 0}%) | ${final.defeatedEnemyIslands ?? 0} | ${final.defeatedYonko ?? 0} | ${run.metrics.battlesWon || 0} | ${run.metrics.losses || 0} | ${(run.metrics.impelEscapes || 0)}/${(run.metrics.judicialClears || 0)}/${(run.metrics.marinefordClears || 0)} | ${(final.ship?.slotsUnlocked || 0)}/${Object.values(final.ship?.upgrades || {}).reduce((sum, value) => sum + Number(value || 0), 0)} |`);
  });
  lines.push("");
  lines.push("## Milestones");
  lines.push("");
  results.runs.forEach((run) => {
    lines.push(`### Seed ${run.seed}${run.attempt ? ` (retry ${run.attempt})` : ""}`);
    if (run.startingTeam?.length) {
      lines.push(`- Starting crew: ${run.startingTeam.map((card) => `${card.name || card.id} ${card.attribute || "無"}/${card.roleType || "未分類"} Lv.${card.level || 1}`).join(", ")}`);
    }
    if (run.endingCaptain) {
      lines.push(`- Ending captain: ${run.endingCaptain.name || run.endingCaptain.id}`);
    }
    if (run.startingPlayers?.length > 1) {
      run.startingPlayers.forEach((entry) => {
        lines.push(`- ${entry.name}: ${entry.crew.map((card) => `${card.name || card.id} ${card.attribute || "無"}/${card.roleType || "未分類"} Lv.${card.level || 1}`).join(", ")}`);
      });
    }
    if (run.startingComposition?.label) {
      lines.push(`- Starting composition: ${run.startingComposition.label}，評分 ${run.startingComposition.score}`);
    }
    if (run.draftHistory?.length) {
      lines.push(`- Draft: ${run.draftHistory.map((entry) => `roll ${entry.roll} -> ${entry.name} (${entry.tier}/${entry.roleType})`).join("; ")}`);
    }
    const milestoneEntries = LEVEL_MILESTONES
      .map((level) => {
        const hit = run.milestones[`avg${level}`] || run.milestones[`max${level}`];
        return hit ? `Lv${level}: turn ${hit.turn}, round ${hit.round}, ${hit.location}` : `Lv${level}: not reached`;
      });
    milestoneEntries.forEach((entry) => lines.push(`- ${entry}`));
    if (run.milestones.allEnemies) {
      const hit = run.milestones.allEnemies;
      lines.push(`- All enemies: turn ${hit.turn}, round ${hit.round}, ${hit.location}`);
    }
    const finalEnding = endingLabel(run.final || {});
    if (finalEnding !== "-") {
      lines.push(`- Final ending: ${finalEnding}`);
    }
    if (run.warnings.length) {
      lines.push(`- Warnings: ${run.warnings.map((warning) => `${warning.turn}:${warning.reason}`).join(", ")}`);
    }
    lines.push(`- Items/training: shop buys ${run.metrics.shopBuys || 0}, map heals ${run.metrics.mapHeals || 0}, battle items ${run.metrics.battleItemsUsed || 0}, carries equipped ${run.metrics.carriesEquipped || 0}, training uses ${run.metrics.trainingUses || 0}, skill training ${run.metrics.skillTrainingUses || 0}`);
    const coverage = run.final?.enemyCoverage || {};
    lines.push(`- Enemy coverage: ${coverage.defeatedTargets || 0}/${coverage.totalTargets || 0} (${coverage.percent || 0}%)`);
    if (coverage.missing?.length) {
      lines.push(`- Missing enemies: ${coverage.missing.slice(0, 24).map((entry) => `${entry.name}(${entry.key})`).join(", ")}${coverage.missing.length > 24 ? `... +${coverage.missing.length - 24}` : ""}`);
    }
    if (run.final?.defeatedEnemyCodex?.length) {
      lines.push(`- Defeated enemies: ${run.final.defeatedEnemyCodex.slice(0, 36).map((entry) => `${entry.name} x${entry.count}`).join(", ")}${run.final.defeatedEnemyCodex.length > 36 ? `... +${run.final.defeatedEnemyCodex.length - 36}` : ""}`);
    }
    lines.push("");
  });
  lines.push("## Latest Logs");
  lines.push("");
  results.runs.forEach((run) => {
    lines.push(`### Seed ${run.seed}`);
    (run.logTail || []).forEach((line) => lines.push(`- ${line}`));
    lines.push("");
  });
  return lines.join("\n");
}

function retrySeedFor(seed, attempt) {
  const base = Number(seed) || hashString(seed);
  return base + attempt * 1000003 + 37;
}

async function main() {
  const config = parseArgs(process.argv);
  fs.mkdirSync(config.outDir, { recursive: true });
  const server = await startStaticServer(PUBLIC_DIR);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const startedAt = new Date();
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  const suffix = config.label ? `_${config.label}` : "";
  const results = {
    startedAt: startedAt.toISOString(),
    config,
    runs: [],
  };
  try {
    for (let index = 0; index < config.seeds.length; index += 1) {
      const seed = config.seeds[index];
      for (let attempt = 0; attempt <= config.maxRestarts; attempt += 1) {
        const attemptSeed = attempt === 0 ? seed : retrySeedFor(seed, attempt);
        console.log(`[growth] seed ${seed} attempt ${attempt + 1}/${config.maxRestarts + 1} actual ${attemptSeed} (${index + 1}/${config.seeds.length})`);
        const run = await runSeed(baseUrl, attemptSeed, index + 1 + attempt * 100, config, { baseSeed: seed, attempt });
        results.runs.push(run);
        console.log(`[growth] seed ${attemptSeed} done: ${run.stopReason}, turns=${run.turnsPlayed}, avgLv=${run.final?.avgLevel}, maxLv=${run.final?.maxLevel}`);
        if (!config.restartOnEarlyFailure || !String(run.stopReason || "").startsWith("restart-reselect")) break;
        if (attempt >= config.maxRestarts) break;
        console.log(`[growth] reselecting after ${run.stopReason}`);
      }
    }
  } finally {
    server.close();
  }
  results.endedAt = new Date().toISOString();
  const jsonPath = path.join(config.outDir, `growth_curve_${stamp}${suffix}.json`);
  const mdPath = path.join(config.outDir, `growth_curve_${stamp}${suffix}.md`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf8");
  fs.writeFileSync(mdPath, buildMarkdownReport(results, config), "utf8");
  console.log(JSON.stringify({ jsonPath, mdPath, runs: results.runs.length }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
