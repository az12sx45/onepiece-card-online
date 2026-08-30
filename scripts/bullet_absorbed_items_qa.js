const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8841";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/bullet_max_damage_20260805";

const LOADOUTS = [
  { key: "opening_life_orb", label: "首回合穩定爆發", itemId: "life_orb", setup: "opening" },
  { key: "choice_band", label: "鎖招穩定增傷", itemId: "choice_band", setup: "opening" },
  { key: "bullet_arsenal", label: "巴雷特的武器庫（只吸收空外殼）", itemId: "bullet_large_bullet_armor", setup: "arsenal_life_orb" },
  { key: "king_sword", label: "KING 佩刀熄火", itemId: "king_sword", setup: "king_unlit" },
  { key: "seven_star", label: "七星劍瀕死", itemId: "saga_seven_star_sword", setup: "one_hp" },
  { key: "battle_smasher", label: "Battle Smasher 過熱", itemId: "zephyr_battle_smasher", setup: "smasher_ready" },
  { key: "ragnir", label: "Ragnir 三冰雲", itemId: "loki_ragnir", setup: "ragnir_three" },
  { key: "scope_lens_enemy_no_crit", label: "六鏡與最低亂數仍不讓敵方暴擊", itemId: "scope_lens", setup: "force_zero_roll" },
];

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareLoadout(host, itemId, setup) {
  return host.evaluate(({ requestedItemId, requestedSetup }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const qa = debug.postgameBossMechanicQa;
    const player = state.gameState.players[0];
    const maxLevelCard = (source) => debug.cloneCard({
      ...source,
      level: 99,
      totalExp: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
    });
    const leveledCatalog = window.BoardCards.cards.map(maxLevelCard);
    const target = leveledCatalog
      .slice()
      .sort((left, right) => Number(right.baseStats?.hp || 0) - Number(left.baseStats?.hp || 0))[0];
    const filler = leveledCatalog.filter((card) => card.id !== target.id).slice(0, 5);
    player.crew = [target, ...filler];
    while (player.crew.length < 6) player.crew.push(maxLevelCard(window.BoardCards.cards[player.crew.length]));
    player.crew.slice(0, 6).forEach((card) => {
      card.battleCarryItem = requestedSetup === "arsenal_life_orb"
        ? { id: "bullet_large_bullet_armor", arsenalItems: [{ id: "life_orb" }, null] }
        : requestedItemId;
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "bullet-repeat-item-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_douglas_bullet");
    if (!assignment) throw new Error("Missing Douglas Bullet assignment");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = state.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    qa.initializeBulletRuntime(player, battle, battle.postgameBossMechanic);
    const mechanic = battle.postgameBossMechanic;
    const slots = qa.activeBulletSlots(battle);
    const expectedSlotCount = requestedSetup === "arsenal_life_orb" ? 0 : 6;
    if (slots.length !== expectedSlotCount) throw new Error(`Expected ${expectedSlotCount} absorbed slots, got ${slots.length}`);
    if (requestedSetup === "smasher_ready") slots.forEach((slot) => Object.assign(slot.triggered, { heat: 3, battleSmasherReady: true }));
    if (requestedSetup === "ragnir_three") slots.forEach((slot) => Object.assign(slot.triggered, { clouds: 3 }));
    if (requestedSetup === "king_unlit") slots.forEach((slot) => Object.assign(slot.triggered, { flameOn: false }));
    if (requestedSetup === "one_hp") battle.enemyCombatant.currentHp = 1;
    const move = battle.enemyCombatant.moveSet.find((entry) => entry.id === "postgame_bullet_ultimate_faust")
      || battle.enemyCombatant.moveSet.slice().sort((a, b) => Number(b.power || 0) - Number(a.power || 0))[0];
    const originalRandom = Math.random;
    Math.random = requestedSetup === "force_zero_roll" ? () => 0 : () => 0.999999;
    let baseDamage;
    let hitDamages;
    const criticalVisual = { critical: false, criticalCount: 0 };
    try {
      baseDamage = qa.computeMoveDamage("enemy", move, 6, player, battle);
      const resolvedDamage = qa.computeMoveDamage("enemy", move, 6, player, battle, criticalVisual);
      hitDamages = qa.applyDamageRules([resolvedDamage], "enemy", move, 6, player, battle, { targetId: "boss" }, criticalVisual);
    } finally {
      Math.random = originalRandom;
    }
    const damage = hitDamages.reduce((sum, value) => sum + Number(value || 0), 0);
    return {
      damage,
      baseDamage,
      multiplier: damage / Math.max(1, baseDamage),
      ignoreDefenseRatio: qa.bulletIgnoreDefenseRatio(battle, move),
      target: {
        id: target.id,
        name: target.name,
        level: target.level,
        hp: target.baseStats?.hp,
        def: target.baseStats?.def,
      },
      move: { id: move.id, name: move.name, power: move.power },
      itemNames: slots.map((slot) => slot.itemName),
      statuses: qa.view(player, battle)?.state?.slots?.map((slot) => slot.runtimeStatus || slot.status) || [],
      critical: !!criticalVisual.critical,
      criticalCount: Math.max(0, Number(criticalVisual.criticalCount || 0)),
    };
  }, { requestedItemId: itemId, requestedSetup: setup });
}

async function runDuplicateAssertions(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const qa = debug.postgameBossMechanicQa;
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const mechanic = battle.postgameBossMechanic;
    const move = battle.enemyCombatant.moveSet.find((entry) => entry.id === "postgame_bullet_ultimate_faust");
    const slots = qa.activeBulletSlots(battle);
    const checks = [];
    const close = (actual, expected, tolerance = 0.00001) => Math.abs(Number(actual) - Number(expected)) <= tolerance;
    checks.push({ name: "six slots active", pass: slots.length === 6, actual: slots.length, expected: 6 });
    const multiplier = qa.bulletOutgoingMultiplier(mechanic, battle, move, 6, player);
    checks.push({ name: "six repeated Ragnir multipliers", pass: close(multiplier, 1.45 ** 6), actual: multiplier, expected: 1.45 ** 6 });
    checks.push({ name: "six independent runtime states", pass: slots.every((slot) => Number(slot.triggered?.clouds || 0) === 3), actual: slots.map((slot) => slot.triggered?.clouds), expected: [3, 3, 3, 3, 3, 3] });
    return checks;
  });
}

async function runSpecialEffectChecks(host) {
  const checks = [];
  await prepareLoadout(host, "black_sludge", "opening");
  checks.push(await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const qa = debug.postgameBossMechanicQa;
    battle.enemyCombatant.currentHp = Math.round(battle.enemyCombatant.maxHp * 0.5);
    const before = battle.enemyCombatant.currentHp;
    qa.roundEnd(player, battle);
    const expected = Math.min(battle.enemyCombatant.maxHp, before + 6 * Math.round(battle.enemyCombatant.maxHp * 0.06));
    return { name: "six black sludge heals", pass: battle.enemyCombatant.currentHp === expected, actual: battle.enemyCombatant.currentHp, expected };
  }));

  await prepareLoadout(host, "vegapunk_mini_shield", "opening");
  checks.push(await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const qa = debug.postgameBossMechanicQa;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const shieldTotal = qa.activeBulletSlots(battle).reduce((sum, slot) => sum + Number(slot.triggered?.miniShieldRemaining || 0), 0);
    const incoming = battle.enemyCombatant.maxHp + shieldTotal + 100;
    const remaining = qa.applyDamageRules([incoming], "player", move, 4, player, battle, { targetId: "boss" })[0];
    const expected = incoming - shieldTotal;
    return { name: "six mini shields have independent pools", pass: remaining === expected, actual: remaining, expected, shieldTotal };
  }));

  await prepareLoadout(host, "lucci_awakened_black_flame_hagoromo", "opening");
  checks.push(await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    const mechanic = battle.postgameBossMechanic;
    const expected = Math.round(Number(mechanic.bulletBaseMaxHp || 1) * (1.3 ** 6));
    return { name: "six black flames increase maximum HP", pass: battle.enemyCombatant.maxHp === expected, actual: battle.enemyCombatant.maxHp, expected };
  }));

  await prepareLoadout(host, "seastone_bullet", "opening");
  checks.push(await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const qa = debug.postgameBossMechanicQa;
    const target = player.crew[battle.activeCrewIndex || 0];
    target.isDevilFruitUser = true;
    target.currentHp = Number(target.baseStats?.hp || target.maxHp || target.hp || 1);
    const before = target.currentHp;
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    qa.afterDirectHit("enemy", move, 4, 10, player, battle, { targetId: "boss" });
    const perSlot = Math.round(Number(target.baseStats?.hp || 1) * 0.06);
    const expected = Math.max(0, before - perSlot * 6);
    return { name: "six seastone bullets each trigger once", pass: target.currentHp === expected, actual: target.currentHp, expected };
  }));
  return checks;
}

async function displayMaximumHit(host, battlePage, result, itemId, setup, outputName) {
  await prepareLoadout(host, itemId, setup);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  await battlePage.waitForFunction(() => document.querySelector(".boss-mechanic-status-icon img")?.naturalWidth > 0, null, { timeout: 15000 });
  await battlePage.locator(".boss-mechanic-status-icon").click();
  await battlePage.waitForFunction(() => document.getElementById("postgameBossMechanicPanel")?.hidden === false, null, { timeout: 10000 });
  await host.evaluate((hitResult) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const target = player.crew[battle.activeCrewIndex || 0];
    const move = battle.enemyCombatant.moveSet.find((entry) => entry.id === hitResult.move.id);
    const actor = JSON.parse(JSON.stringify(battle.enemyCombatant));
    const targetSnapshot = JSON.parse(JSON.stringify(target));
    battle.log.push(`極限傷害驗證：六件「${hitResult.itemNames[0]}」，${move.name} 骰出 6，造成 ${hitResult.damage} 點傷害。`);
    battle.visualEvent = {
      id: `bullet-max-${Date.now()}`,
      type: "attack",
      side: "enemy",
      targetSide: "player",
      actorName: battle.enemyCombatant.name,
      targetName: target.name,
      actorCombatant: actor,
      targetCombatant: targetSnapshot,
      startCombatant: targetSnapshot,
      moveName: move.name,
      moveType: move.category || "attack",
      damage: hitResult.damage,
      hitDamages: [hitResult.damage],
      hitEffect: "punch_heavy.webp",
      startHp: { player: target.currentHp, enemy: battle.enemyCombatant.currentHp },
      finalHp: { player: Math.max(0, Number(target.currentHp || 0) - hitResult.damage), enemy: battle.enemyCombatant.currentHp },
      diceFace: 6,
      miss: false,
      critical: !!hitResult.critical,
      duration: 20000,
    };
    battle.animating = true;
  }, result);
  await battlePage.waitForFunction(() => {
    const event = window.opener.__BOARD_GAME_DEBUG__.getState().battleState.visualEvent;
    return !!document.querySelector(`#damagePop .damage-number[data-damage-value="${event.damage}"]`);
  }, null, { timeout: 15000 });
  await battlePage.waitForTimeout(120);
  const ui = await battlePage.evaluate(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    const damage = document.querySelector("#damagePop .damage-number");
    const watched = Array.from(panel?.querySelectorAll(".bullet-slot-copy strong, .bullet-slot-copy small, .bullet-slot-status") || []);
    return {
      damageText: damage?.textContent.trim() || "",
      damageKind: damage?.dataset.damageKind || "",
      damageValue: Number(damage?.dataset.damageValue || 0),
      criticalLabel: damage?.querySelector(".damage-critical-label")?.textContent.trim() || "",
      criticalBurst: damage ? getComputedStyle(damage, "::before").backgroundImage : "",
      panelVisible: panel?.hidden === false,
      slots: document.querySelectorAll("[data-bullet-slot]").length,
      brokenImages: Array.from(panel?.querySelectorAll("img") || []).filter((image) => !image.complete || image.naturalWidth <= 0).map((image) => image.src),
      overflow: watched.filter((element) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 3).map((element) => element.textContent.trim()),
    };
  });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, outputName), fullPage: true });
  return ui;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?bullet_absorbed_items_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postgameBossMechanicQa?.computeMoveDamage && window.BoardCards, null, { timeout: 20000 });

  const results = [];
  for (const loadout of LOADOUTS) {
    console.log(`qa:loadout:${loadout.key}`);
    results.push({ ...loadout, ...(await prepareLoadout(host, loadout.itemId, loadout.setup)) });
  }
  const stable = results.slice().sort((a, b) => b.damage - a.damage)[0];
  const absolute = results.slice().sort((a, b) => b.damage - a.damage)[0];
  const enemyScope = results.find((entry) => entry.key === "scope_lens_enemy_no_crit");

  const damageChecks = [
    ["opening_life_orb", 1.3 ** 6],
    ["choice_band", 1.25 ** 6],
    ["bullet_arsenal", 1],
    ["king_sword", 1.25 ** 6],
    ["seven_star", 1.76 ** 6],
    ["battle_smasher", 1.4 ** 6],
    ["ragnir", 1.45 ** 6],
    ["scope_lens_enemy_no_crit", 1],
  ].map(([key, expected]) => {
    const entry = results.find((result) => result.key === key);
    return { name: `${key} repeated damage`, pass: Math.abs(Number(entry?.multiplier || 0) - expected) <= 0.01, actual: entry?.multiplier, expected };
  });

  await prepareLoadout(host, "loki_ragnir", "ragnir_three");
  const duplicateChecks = await runDuplicateAssertions(host);
  const specialEffectChecks = await runSpecialEffectChecks(host);
  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?bullet_absorbed_items_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");

  console.log("qa:stable-ui");
  const stableUi = await displayMaximumHit(host, battlePage, stable, stable.itemId, stable.setup, "bullet_stable_max_damage.png");
  console.log("qa:enemy-scope-no-critical-ui");
  const enemyScopeUi = await displayMaximumHit(host, battlePage, enemyScope, enemyScope.itemId, enemyScope.setup, "bullet_enemy_scope_no_critical.png");
  const failures = [
    ...damageChecks.filter((entry) => !entry.pass).map((entry) => `${entry.name}: ${JSON.stringify(entry)}`),
    ...duplicateChecks.filter((entry) => !entry.pass).map((entry) => `${entry.name}: ${JSON.stringify(entry)}`),
    ...specialEffectChecks.filter((entry) => !entry.pass).map((entry) => `${entry.name}: ${JSON.stringify(entry)}`),
  ];
  for (const [label, ui] of [["stable", stableUi], ["enemy-scope", enemyScopeUi]]) {
    if (!ui.panelVisible || ui.slots !== 6) failures.push(`${label}: six-slot panel missing`);
    if (ui.brokenImages.length) failures.push(`${label}: broken images ${ui.brokenImages.join(", ")}`);
    if (ui.overflow.length) failures.push(`${label}: clipped text ${ui.overflow.join(" / ")}`);
  }
  if (stableUi.damageKind !== "normal" || stableUi.criticalLabel) failures.push(`stable: normal damage style missing ${JSON.stringify(stableUi)}`);
  if (enemyScope?.critical || enemyScope?.criticalCount !== 0) failures.push(`enemy scope: enemy critical was not disabled ${JSON.stringify(enemyScope)}`);
  if (enemyScopeUi.damageKind !== "normal" || enemyScopeUi.criticalLabel || enemyScopeUi.criticalBurst !== "none") failures.push(`enemy scope: normal damage style missing ${JSON.stringify(enemyScopeUi)}`);
  if (errors.length) failures.push(...errors);
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, results, stable, absolute, enemyScope, damageChecks, duplicateChecks, specialEffectChecks, stableUi, enemyScopeUi, errors, failures }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
