const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve(__dirname, "..", "docs", "qa", "bullet_arsenal_full_compatibility");
const CATALOG_PATH = path.resolve(__dirname, "..", "docs", "ITEM_CATALOG.md");

// Stateful behavior for the postgame relics is covered by
// postgame_boss_relic_player_effects_qa.js. This scan verifies that all held items
// can still pass through the arsenal lifecycle and that no player handler is known
// to be missing.
const PLAYER_HANDLER_GAPS = Object.freeze({});

function readCarryCatalog() {
  const markdown = fs.readFileSync(CATALOG_PATH, "utf8");
  const start = markdown.indexOf("## 角色攜帶物");
  const end = markdown.indexOf("## 重要道具", start);
  if (start < 0 || end < 0) throw new Error("ITEM_CATALOG.md lacks held-item section");
  return markdown.slice(start, end).split(/\r?\n/).flatMap((line) => {
    const cells = line.split("|").map((entry) => entry.trim());
    const idMatch = cells[2]?.match(/^`([^`]+)`$/);
    if (!idMatch) return [];
    return [{ name: cells[1], id: idMatch[1], rarity: cells[3], summary: cells[4] || "" }];
  });
}

function captureErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
}

function handlerEvidence(entries) {
  const source = fs.readFileSync(path.resolve(__dirname, "..", "public", "js", "board_game.js"), "utf8");
  const lines = source.split(/\r?\n/);
  return entries.map((entry) => {
    const item = global.window.GAME_ITEMS[entry.id];
    const effectKind = String(item?.effect?.kind || "");
    const needles = [entry.id, effectKind].filter(Boolean);
    const references = [];
    lines.forEach((line, index) => {
      if (needles.some((needle) => line.includes(needle))) references.push(index + 1);
    });
    return {
      ...entry,
      effectKind,
      references,
      playerHandlerGap: PLAYER_HANDLER_GAPS[entry.id] || "",
    };
  });
}

(async () => {
  global.window = {};
  require(path.resolve(__dirname, "..", "public", "js", "board_items.js"));
  const catalog = readCarryCatalog();
  const arsenalEntry = catalog.find((entry) => entry.id === "bullet_large_bullet_armor");
  const eligible = catalog.filter((entry) => entry.id !== "bullet_large_bullet_armor");
  const evidence = handlerEvidence(eligible);
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  captureErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?bullet_arsenal_full_compatibility_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.bulletArsenalQa && window.BoardCards, null, { timeout: 30000 });

  const browserResult = await page.evaluate(({ entries, gapIds }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.bulletArsenalQa;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const arsenalId = qa.itemId;
    const emptyStages = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStageTurns = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStatuses = () => ({ poison: 0, burn: 0, paralyze: 0, freeze: 0, bind: 0, sleep: 0, confusion: 0, bleed: 0 });
    const emptyRoundEffects = () => ({ shieldRatio: 0, nextShieldRatio: 0, damageTakenUp: 0, nextHitBoost: 0, guaranteedFirst: false, nextGuaranteedFirst: false, flinch: false });
    const source = window.BoardCards.cards.find((card) => card.id === "zoro")
      || window.BoardCards.cards.find((card) => /索隆/.test(card.name || ""))
      || window.BoardCards.cards.find((card) => !/luffy|路飛|魯夫/i.test(`${card.id} ${card.name}`))
      || window.BoardCards.cards[0];
    const backupSource = window.BoardCards.cards.find((card) => card.id !== source.id) || source;
    const cloneSource = () => debug.cloneCard({
      ...source,
      level: 99,
      totalExp: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
    });
    const cloneBackup = () => debug.cloneCard({
      ...backupSource,
      level: 99,
      totalExp: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
    });
    const makeBattle = (card) => ({
      islandId: "qa-arsenal-compatibility",
      islandKind: "enemy",
      playerId: player.id,
      activeCrewIndex: 0,
      roundIndex: 1,
      result: "",
      log: [],
      carryItemStates: {},
      heldItemStates: {},
      playerStages: emptyStages(),
      playerStageTurns: emptyStageTurns(),
      playerStatuses: emptyStatuses(),
      playerCrewStatuses: {},
      playerStatusActiveKey: "",
      playerRoundEffects: emptyRoundEffects(),
      playerAction: null,
      enemyAction: null,
      playerPerformedAction: false,
      enemyPerformedAction: false,
      enemyCombatant: {
        id: "qa_enemy",
        key: "qa_enemy",
        name: "能力者測試敵人",
        tier: "T1",
        rank: "S",
        level: 99,
        role: "果實能力者",
        attribute: card.attribute === "力" ? "技" : "力",
        isDevilFruitUser: true,
        maxHp: 2000,
        currentHp: 2000,
        atk: 88,
        def: 82,
        satk: 88,
        sdef: 82,
        spd: 76,
        baseStats: { hp: 2000, atk: 88, def: 82, satk: 88, sdef: 82, spd: 76 },
        stages: emptyStages(),
        stageTurns: emptyStageTurns(),
        statuses: emptyStatuses(),
        roundEffects: emptyRoundEffects(),
        moveSet: [],
      },
    });
    const loadout = (ids) => ids.length > 1
      ? { type: "battleCarry", id: arsenalId, bound: false, arsenalItems: ids.map((id) => ({ type: "battleCarry", id, bound: false })) }
      : ids.length === 1 ? { type: "battleCarry", id: ids[0], bound: false } : null;
    const probeMoves = [
      { id: "qa_physical", name: "測試斬擊", category: "attack", type: "attack", power: 140, accuracy: 100, effects: {} },
      { id: "qa_special", name: "測試能量", category: "special", type: "special", power: 140, accuracy: 100, effects: {} },
      { id: "qa_fire_shot", name: "火焰射擊", category: "attack", type: "attack", power: 140, accuracy: 100, effects: {} },
      { id: "qa_water", name: "海流水擊", category: "special", type: "special", power: 140, accuracy: 100, effects: {} },
      { id: "qa_thunder", name: "雷電衝擊", category: "special", type: "special", power: 140, accuracy: 100, effects: {} },
      { id: "qa_sound", name: "音波之歌", category: "special", type: "special", power: 140, accuracy: 100, effects: {} },
      { id: "qa_combo", name: "連續射擊", category: "attack", type: "attack", power: 100, accuracy: 100, effects: { multiHit: 3 } },
    ];
    const metricFor = (ids, options = {}) => {
      const card = cloneSource();
      card.battleCarryItem = loadout(ids);
      player.crew = [card];
      player.activeCrewIndex = 0;
      const maxHp = qa.maxHp(card);
      card.currentHp = options.lowHp ? Math.max(1, Math.round(maxHp * 0.2)) : maxHp;
      const battle = makeBattle(card);
      const originalRandom = Math.random;
      Math.random = () => Number(options.randomValue ?? 0.5);
      let damages;
      try {
        damages = probeMoves.map((move) => {
          const localBattle = makeBattle(card);
          localBattle.playerAction = { type: "move", moveId: move.id };
          localBattle.enemyCombatant.moveSet = [move];
          return debug.postgameBossMechanicQa.computeMoveDamage("player", move, 6, player, localBattle, {});
        });
      } finally {
        Math.random = originalRandom;
      }
      return {
        maxHp,
        stats: {
          atk: qa.currentStat("player", "atk", player, battle),
          def: qa.currentStat("player", "def", player, battle),
          satk: qa.currentStat("player", "satk", player, battle),
          sdef: qa.currentStat("player", "sdef", player, battle),
          spd: qa.currentStat("player", "spd", player, battle),
        },
        damages,
        contexts: qa.contexts(player, battle).map((ctx) => ({ id: ctx.item.id, slotIndex: ctx.slotIndex })),
        runtimeKeys: Object.keys(battle.carryItemStates || {}),
      };
    };
    const inventoryCount = (id) => Number(player.inventory?.items?.[id] || 0);
    const backpackCount = (id) => player.items.filter((item) => String(item?.id || item) === id).length;
    const backpackIndex = (id) => player.items.findIndex((item) => String(item?.id || item) === id);
    const structural = [];

    for (const entry of entries) {
      const itemId = entry.id;
      const checks = [];
      const check = (name, pass, actual = null) => checks.push({ name, pass: !!pass, actual });
      const card = cloneSource();
      const backup = cloneBackup();
      player.crew = [card, backup];
      player.activeCrewIndex = 0;
      player.items = [];
      player.inventory = { items: {}, equipped: {} };
      card.battleCarryItem = null;
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
      window.grantBattleCarryItem(arsenalId);
      window.grantBattleCarryItem(itemId);
      const outer = qa.equipOuter(player, 0, backpackIndex(arsenalId));
      const slot0 = qa.equipInner(player, 0, 0, backpackIndex(itemId));
      const battle0 = makeBattle(card);
      const contexts0 = qa.contexts(player, battle0);
      const serialized0 = qa.serialize(card, 0, battle0);
      check("slot0 insert", outer.ok && slot0.ok, { outer, slot0 });
      check("slot0 effective context", contexts0.length === 1 && contexts0[0].item.id === itemId && contexts0[0].slotIndex === 0, contexts0.map((ctx) => ({ id: ctx.item.id, slotIndex: ctx.slotIndex })));
      check("slot0 independent runtime", contexts0[0]?.state && Object.keys(battle0.carryItemStates).some((key) => key.includes("arsenal:0")), Object.keys(battle0.carryItemStates));
      check("slot0 battle serialization", serialized0.subItems?.length === 1 && serialized0.subItems[0].id === itemId && serialized0.subItems[0].slotIndex === 0, serialized0.subItems);
      const remove0 = qa.unequipInner(player, 0, 0);
      check("slot0 return", remove0.ok && backpackCount(itemId) === 1 && backpackIndex(itemId) >= 0, { remove0, backpackCount: backpackCount(itemId), formalInventoryCount: inventoryCount(itemId) });

      const slot1 = qa.equipInner(player, 0, 1, backpackIndex(itemId));
      const battle1 = makeBattle(card);
      const contexts1 = qa.contexts(player, battle1);
      const serialized1 = qa.serialize(card, 0, battle1);
      check("slot1 insert", slot1.ok, slot1);
      check("slot1 effective context", contexts1.length === 1 && contexts1[0].item.id === itemId && contexts1[0].slotIndex === 1, contexts1.map((ctx) => ({ id: ctx.item.id, slotIndex: ctx.slotIndex })));
      check("slot1 independent runtime", contexts1[0]?.state && Object.keys(battle1.carryItemStates).some((key) => key.includes("arsenal:1")), Object.keys(battle1.carryItemStates));
      check("slot1 battle serialization", serialized1.subItems?.length === 1 && serialized1.subItems[0].id === itemId && serialized1.subItems[0].slotIndex === 1, serialized1.subItems);
      const remove1 = qa.unequipInner(player, 0, 1);
      check("slot1 return", remove1.ok && backpackCount(itemId) === 1 && backpackIndex(itemId) >= 0, { remove1, backpackCount: backpackCount(itemId), formalInventoryCount: inventoryCount(itemId) });

      const sentinel = itemId === "wind_shell" ? "lucci_awakened_black_flame_hagoromo" : "wind_shell";
      window.grantBattleCarryItem(sentinel);
      const pair0 = qa.equipInner(player, 0, 0, backpackIndex(itemId));
      const pair1 = qa.equipInner(player, 0, 1, backpackIndex(sentinel));
      const pairBattle = makeBattle(card);
      const pairContexts = qa.contexts(player, pairBattle);
      check("two different items coexist", pair0.ok && pair1.ok && pairContexts.length === 2 && pairContexts[0].state !== pairContexts[1].state, pairContexts.map((ctx) => ({ id: ctx.item.id, slotIndex: ctx.slotIndex })));
      const outerRemove = qa.unequipOuter(player, 0);
      check("outer removal returns shell and both items", outerRemove.ok && backpackCount(arsenalId) === 1 && backpackCount(itemId) >= 1 && backpackCount(sentinel) >= 1, {
        outerRemove,
        arsenal: backpackCount(arsenalId),
        item: backpackCount(itemId),
        sentinel: backpackCount(sentinel),
      });

      const standalone = metricFor([itemId]);
      const arsenal = metricFor([itemId, sentinel]);
      const sentinelOnly = metricFor([sentinel]);
      const expectedMaxHpRatio = standalone.maxHp / metricFor([]).maxHp;
      const actualMaxHpRatio = arsenal.maxHp / Math.max(1, sentinelOnly.maxHp);
      check("max HP effect remains composable", Math.abs(expectedMaxHpRatio - actualMaxHpRatio) < 0.02, { expectedMaxHpRatio, actualMaxHpRatio });
      check("item appears in arsenal combat metrics", arsenal.contexts.some((ctx) => ctx.id === itemId), arsenal.contexts);
      structural.push({ id: itemId, name: entry.name, checks, failed: checks.filter((item) => !item.pass).map((item) => item.name) });
    }

    const base = metricFor([]);
    const singleMetrics = Object.fromEntries(entries.map((entry) => [entry.id, metricFor([entry.id])]));
    const summaries = Object.fromEntries(entries.map((entry) => {
      const card = cloneSource();
      card.battleCarryItem = loadout([entry.id]);
      player.crew = [card];
      const battle = makeBattle(card);
      return [entry.id, qa.serialize(card, 0, battle).summary || entry.summary || ""];
    }));
    const gapSet = new Set(gapIds);
    const average = (values) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
    const ratio = (value, baseline) => Number(value || 0) / Math.max(1, Number(baseline || 0));
    const utilityFor = (id) => {
      const text = summaries[id] || "";
      let survival = 0;
      let utility = 0;
      let speed = 0;
      let offense = 0;
      let risk = 0;
      if (/致命|保留 1 HP|復活|不屈|救援/.test(text)) survival += 32;
      if (/護盾|減傷|防禦|免疫/.test(text)) survival += 16;
      if (/回復|治療|吸血/.test(text)) survival += 14;
      if (/解除|抵銷|抵抗|無法.*下降/.test(text)) utility += 12;
      if (/先制|速度|必定先手/.test(text)) speed += 14;
      if (/命中|必中|閃避/.test(text)) utility += 10;
      if (/逃跑|換人|交棒/.test(text)) utility += 8;
      if (/反擊|反彈|儲存|固定傷害|追加/.test(text)) utility += 10;
      for (const match of text.matchAll(/(?:傷害|攻擊|特攻)[^。；，]*?\+(\d+)%/g)) offense += Number(match[1] || 0) * 0.45;
      if (/無視.*防禦/.test(text)) offense += 8;
      if (/暴擊/.test(text)) offense += 5;
      if (/自損|反噬|速度.*-/.test(text)) risk += 10;
      if (gapSet.has(id)) return { survival: 0, utility: 0, speed: 0, offense: 0, risk: 35 };
      return { survival, utility, speed, offense, risk };
    };
    const pairs = [];
    for (let left = 0; left < entries.length; left += 1) {
      for (let right = left + 1; right < entries.length; right += 1) {
        const a = entries[left];
        const b = entries[right];
        const metrics = metricFor([a.id, b.id]);
        const lowHpMetrics = metricFor([a.id, b.id], { lowHp: true });
        const procMetrics = metricFor([a.id, b.id], { randomValue: 0 });
        const damageRatios = metrics.damages.map((value, index) => ratio(value, base.damages[index]));
        const lowHpRatios = lowHpMetrics.damages.map((value, index) => ratio(value, base.damages[index]));
        const procRatios = procMetrics.damages.map((value, index) => ratio(value, base.damages[index]));
        const hpRatio = ratio(metrics.maxHp, base.maxHp);
        const speedRatio = ratio(metrics.stats.spd, base.stats.spd);
        const attackRatio = Math.max(ratio(metrics.stats.atk, base.stats.atk), ratio(metrics.stats.satk, base.stats.satk));
        const ua = utilityFor(a.id);
        const ub = utilityFor(b.id);
        const utility = ua.utility + ub.utility;
        const survivalBonus = ua.survival + ub.survival;
        const speedBonus = ua.speed + ub.speed;
        const risk = ua.risk + ub.risk;
        const offense = average(damageRatios) * 55 + Math.max(...damageRatios) * 20 + Math.max(...lowHpRatios) * 15 + Math.max(...procRatios) * 10 + (attackRatio - 1) * 20 + ua.offense + ub.offense;
        const survival = hpRatio * 70 + survivalBonus - risk * 0.4;
        const speed = speedRatio * 80 + speedBonus - risk * 0.2;
        const general = offense * 0.39 + survival * 0.31 + speed * 0.18 + utility * 0.12 - risk * 0.25;
        pairs.push({
          ids: [a.id, b.id],
          names: [a.name, b.name],
          inactive: gapSet.has(a.id) || gapSet.has(b.id),
          scores: {
            general: Math.round(general * 10) / 10,
            offense: Math.round(offense * 10) / 10,
            survival: Math.round(survival * 10) / 10,
            speed: Math.round(speed * 10) / 10,
          },
          ratios: {
            hp: Math.round(hpRatio * 1000) / 1000,
            speed: Math.round(speedRatio * 1000) / 1000,
            avgDamage: Math.round(average(damageRatios) * 1000) / 1000,
            burstDamage: Math.round(Math.max(...procRatios) * 1000) / 1000,
            lowHpBurst: Math.round(Math.max(...lowHpRatios) * 1000) / 1000,
          },
        });
      }
    }
    const activePairs = pairs.filter((entry) => !entry.inactive);
    const fairPairs = activePairs;
    const top = (key) => activePairs.slice().sort((a, b) => b.scores[key] - a.scores[key]).slice(0, 15);
    const fairTop = (key) => fairPairs.slice().sort((a, b) => b.scores[key] - a.scores[key]).slice(0, 15);
    return {
      sourceCard: { id: source.id, name: source.name },
      catalogCount: entries.length + 1,
      eligibleCount: entries.length,
      structural,
      base,
      pairCount: pairs.length,
      activePairCount: activePairs.length,
      speedChecks: {
        choiceScarf: Math.round(ratio(singleMetrics.choice_scarf?.stats?.spd, base.stats.spd) * 1000) / 1000,
        windShell: Math.round(ratio(singleMetrics.wind_shell?.stats?.spd, base.stats.spd) * 1000) / 1000,
        lucciBlackFlame: Math.round(ratio(singleMetrics.lucci_awakened_black_flame_hagoromo?.stats?.spd, base.stats.spd) * 1000) / 1000,
      },
      rankings: {
        general: top("general"),
        offense: top("offense"),
        survival: top("survival"),
        speed: top("speed"),
      },
      recommendedRankings: {
        general: fairTop("general"),
        offense: fairTop("offense"),
        survival: fairTop("survival"),
        speed: fairTop("speed"),
      },
    };
  }, { entries: evidence.map(({ id, name, summary }) => ({ id, name, summary })), gapIds: Object.keys(PLAYER_HANDLER_GAPS) });

  await browser.close();
  const structuralFailures = browserResult.structural.filter((entry) => entry.failed.length);
  const handlerGaps = evidence.filter((entry) => entry.playerHandlerGap).map((entry) => ({
    id: entry.id,
    name: entry.name,
    effectKind: entry.effectKind,
    reason: entry.playerHandlerGap,
    references: entry.references,
  }));
  const failures = [];
  if (!arsenalEntry) failures.push("catalog lacks bullet arsenal");
  if (catalog.length !== 95) failures.push(`expected 95 held items, got ${catalog.length}`);
  if (eligible.length !== 94) failures.push(`expected 94 eligible inner items, got ${eligible.length}`);
  if (browserResult.pairCount !== 4371) failures.push(`expected 4371 different-item pairs, got ${browserResult.pairCount}`);
  structuralFailures.forEach((entry) => failures.push(`${entry.id}: ${entry.failed.join(", ")}`));
  handlerGaps.forEach((entry) => failures.push(`${entry.id}: ${entry.reason}`));
  const runtimeAnomalies = [];
  if (Math.abs(Number(browserResult.speedChecks.choiceScarf || 0) - 1.25) > 0.03) {
    runtimeAnomalies.push({
      id: "choice_scarf",
      name: "疾風圍巾",
      reason: `速度加成預期約 1.25 倍，實測為 ${browserResult.speedChecks.choiceScarf} 倍；item id 與 effect kind 被重複套用`,
    });
  }
  runtimeAnomalies.forEach((entry) => failures.push(`${entry.id}: ${entry.reason}`));
  errors.forEach((entry) => failures.push(entry));
  const result = {
    outputDir: OUTPUT_DIR,
    catalog: { count: catalog.length, arsenal: arsenalEntry, eligibleCount: eligible.length },
    sourceCard: browserResult.sourceCard,
    structuralPassCount: eligible.length - structuralFailures.length,
    structuralFailures,
    playerEffectPassCount: eligible.length - handlerGaps.length,
    playerEffectFailures: handlerGaps,
    runtimeAnomalies,
    speedChecks: browserResult.speedChecks,
    combinationCount: browserResult.pairCount,
    activeCombinationCount: browserResult.activePairCount,
    rankings: browserResult.rankings,
    recommendedRankings: browserResult.recommendedRankings,
    errors,
    failures,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, "bullet_arsenal_full_compatibility_result.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
