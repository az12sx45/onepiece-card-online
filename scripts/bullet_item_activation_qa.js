const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8842";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.join(process.cwd(), "tmp", "bullet_item_activation_qa");

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareBullet(host, itemId) {
  await host.evaluate((requestedItemId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const cloneAtMaxLevel = (source) => debug.cloneCard({
      ...source,
      level: 99,
      totalExp: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
    });
    player.crew = window.BoardCards.cards.slice(0, 6).map(cloneAtMaxLevel);
    player.crew.forEach((card) => {
      card.battleCarryItem = requestedItemId;
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "bullet-item-activation-qa" });
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
    debug.postgameBossMechanicQa.initializeBulletRuntime(player, battle, battle.postgameBossMechanic);
  }, itemId);
}

async function runViewport(browser, viewport, label) {
  const errors = [];
  const failures = [];
  const context = await browser.newContext({ viewport });
  const host = await context.newPage();
  captureErrors(host, errors, `${label}:host`);
  await host.goto(`${ROOT_URL}/board_game.html?bullet_item_activation_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postgameBossMechanicQa?.moveAttackAttribute && window.BoardCards, null, { timeout: 20000 });

  await prepareBullet(host, "judge_germa66_battle_suit");
  const germa = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const qa = debug.postgameBossMechanicQa;
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const move = player.crew[0].moveSet.find((entry) => ["attack", "special"].includes(entry.category || entry.type) && Number(entry.power || 0) > 0);
    battle.enemyCombatant.currentHp = 120;
    const visual = {};
    const adjusted = qa.applyDamageRules([500], "player", move, 4, player, battle, { targetId: "boss" }, visual);
    qa.afterDirectHit("player", move, 1, 0, player, battle, { targetId: "boss" });
    const slots = battle.postgameBossMechanic.slots;
    const view = qa.view(player, battle);
    const enemy = JSON.parse(JSON.stringify(battle.enemyCombatant));
    const startEnemy = { ...enemy, currentHp: 120 };
    battle.visualEvent = {
      id: `qa-germa-${Date.now()}`,
      type: "attack",
      side: "player",
      targetSide: "enemy",
      actorName: player.crew[0].name,
      targetName: enemy.name,
      actorCombatant: JSON.parse(JSON.stringify(player.crew[0])),
      targetCombatant: enemy,
      startCombatant: startEnemy,
      moveName: move.name,
      moveType: move.category || "attack",
      damage: 0,
      hitDamages: adjusted,
      startHp: { player: player.crew[0].currentHp, enemy: 120 },
      finalHp: { player: player.crew[0].currentHp, enemy: 120 },
      fatalGuard: !!visual.fatalGuard,
      fatalGuardLabel: visual.fatalGuardLabel,
      fatalGuardItemName: visual.fatalGuardItemName,
      duration: 7000,
    };
    battle.animating = true;
    return {
      move: { id: move?.id, category: move?.category, type: move?.type, power: move?.power },
      adjusted,
      fatalGuard: visual.fatalGuard,
      usedCount: slots.filter((slot) => slot.triggered?.judgeFatalUsed).length,
      destroyedCount: slots.filter((slot) => slot.destroyed).length,
      statuses: view.state.slots.map((slot) => slot.runtimeStatus),
      defStage: battle.enemyCombatant.stages.def,
      spdStage: battle.enemyCombatant.stages.spd,
      logTail: battle.log.slice(-5),
    };
  });
  if (germa.adjusted.some((damage) => Number(damage || 0) !== 0)) failures.push(`${label}: Germa lethal damage was not reduced to zero`);
  if (!germa.fatalGuard || germa.usedCount !== 1 || germa.destroyedCount !== 1) failures.push(`${label}: Germa guard trigger/break state invalid ${JSON.stringify(germa)}`);
  if (!germa.statuses.some((status) => /不屈：已發動/.test(status)) || germa.statuses.filter((status) => /不屈：待命/.test(status)).length !== 5) failures.push(`${label}: Germa slot statuses invalid ${JSON.stringify(germa.statuses)}`);
  if (germa.defStage < 1 || germa.spdStage < 1) failures.push(`${label}: Germa stages were not applied`);

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?bullet_item_activation_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, `${label}:battle`);
  await battlePage.waitForLoadState("domcontentloaded");
  await battlePage.waitForFunction(() => document.querySelector(".boss-mechanic-status-icon img")?.naturalWidth > 0, null, { timeout: 15000 });
  await battlePage.locator(".boss-mechanic-status-icon").click();
  await battlePage.waitForFunction(() => document.getElementById("postgameBossMechanicPanel")?.hidden === false, null, { timeout: 10000 });
  await battlePage.waitForFunction(() => Array.from(document.querySelectorAll(".damage-number-value")).some((node) => node.textContent.trim() === "不屈"), null, { timeout: 10000 });
  const germaUi = await battlePage.evaluate(() => ({
    panelText: document.getElementById("postgameBossMechanicPanel")?.textContent || "",
    damageLabels: Array.from(document.querySelectorAll(".damage-number-value")).map((node) => node.textContent.trim()),
    overflow: Array.from(document.querySelectorAll(".postgame-mechanic-slot, .bullet-slot-copy, .bullet-slot-status"))
      .filter((node) => node.scrollWidth > node.clientWidth + 3 || node.scrollHeight > node.clientHeight + 3)
      .map((node) => node.textContent.trim()),
  }));
  if (!germaUi.panelText.includes("不屈：已發動") || !germaUi.panelText.includes("不屈：待命")) failures.push(`${label}: Germa detail panel lacks used/pending state`);
  if (!germaUi.damageLabels.includes("不屈")) failures.push(`${label}: Germa combat visual lacks 不屈`);
  if (germaUi.overflow.length) failures.push(`${label}: Germa UI overflow ${germaUi.overflow.join(" / ")}`);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `${label}_germa_endure.png`), fullPage: true });

  await prepareBullet(host, "devon_kyubi_mask");
  const kyubi = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const qa = debug.postgameBossMechanicQa;
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const target = player.crew[0];
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    const slots = battle.postgameBossMechanic.slots;
    slots.forEach((slot) => { slot.destroyed = true; });
    const naturalAttribute = qa.moveAttackAttribute("enemy", move, player, battle);
    target.attribute = naturalAttribute;
    const originalRandom = Math.random;
    Math.random = () => 0.5;
    const withoutMask = qa.computeMoveDamage("enemy", move, 4, player, battle);
    slots.forEach((slot) => { slot.destroyed = false; });
    const attackAttribute = qa.moveAttackAttribute("enemy", move, player, battle);
    const withMask = qa.computeMoveDamage("enemy", move, 4, player, battle);
    Math.random = originalRandom;
    const visual = {};
    const adjusted = qa.applyDamageRules([withMask], "enemy", move, 4, player, battle, { targetId: "boss" }, visual);
    const view = qa.view(player, battle);
    const beforeHp = Number(target.currentHp || 1);
    const damage = adjusted.reduce((sum, value) => sum + Number(value || 0), 0);
    target.currentHp = Math.max(1, beforeHp - damage);
    battle.visualEvent = {
      id: `qa-kyubi-${Date.now()}`,
      type: "attack",
      side: "enemy",
      targetSide: "player",
      actorName: battle.enemyCombatant.name,
      targetName: target.name,
      actorCombatant: JSON.parse(JSON.stringify(battle.enemyCombatant)),
      targetCombatant: JSON.parse(JSON.stringify(target)),
      startCombatant: { ...JSON.parse(JSON.stringify(target)), currentHp: beforeHp },
      moveName: move.name,
      moveType: move.category || "attack",
      damage,
      hitDamages: adjusted,
      startHp: { player: beforeHp, enemy: battle.enemyCombatant.currentHp },
      finalHp: { player: target.currentHp, enemy: battle.enemyCombatant.currentHp },
      kyubiMaskActive: !!visual.kyubiMaskActive,
      kyubiMaskLabel: visual.kyubiMaskLabel,
      duration: 7000,
    };
    battle.animating = true;
    return {
      attackAttribute,
      naturalAttribute,
      targetAttribute: target.attribute,
      attributeMultiplier: qa.attributeMultiplier(attackAttribute, target.attribute, 0.5),
      withMask,
      withoutMask,
      multiplier: withMask / Math.max(1, withoutMask),
      active: visual.kyubiMaskActive,
      label: visual.kyubiMaskLabel,
      statuses: view.state.slots.map((slot) => slot.runtimeStatus),
      log: battle.log.slice(-8),
    };
  });
  if (kyubi.attackAttribute === kyubi.naturalAttribute || kyubi.attributeMultiplier !== 2 || kyubi.withMask <= kyubi.withoutMask) failures.push(`${label}: Kyubi attribute conversion invalid ${JSON.stringify(kyubi)}`);
  if (!kyubi.active || !/九尾幻化/.test(kyubi.label) || !kyubi.log.some((line) => /九尾幻化/.test(line))) failures.push(`${label}: Kyubi activation feedback missing ${JSON.stringify(kyubi)}`);
  const expectedKyubiStatus = `九尾幻化：${kyubi.attackAttribute}屬性克制${kyubi.targetAttribute}`;
  if (!kyubi.statuses.every((status) => status === expectedKyubiStatus)) failures.push(`${label}: Kyubi detail status invalid ${JSON.stringify(kyubi.statuses)}`);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  await battlePage.waitForFunction(() => document.querySelector(".boss-mechanic-status-icon img")?.naturalWidth > 0, null, { timeout: 15000 });
  await battlePage.locator(".boss-mechanic-status-icon").click();
  await battlePage.waitForFunction((expectedStatus) => document.getElementById("postgameBossMechanicPanel")?.textContent.includes(expectedStatus), expectedKyubiStatus, { timeout: 10000 });
  await battlePage.waitForFunction(() => document.getElementById("enemyCard")?.dataset.effectLabel?.includes("九尾幻化"), null, { timeout: 10000 });
  await battlePage.waitForFunction(() => document.getElementById("statusMessage")?.textContent.includes("九尾幻化"), null, { timeout: 10000 });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `${label}_kyubi_activation.png`), fullPage: true });

  await prepareBullet(host, "impact_shell");
  const hitOrder = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const qa = debug.postgameBossMechanicQa;
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const move = player.crew[0].moveSet.find((entry) => ["attack", "special"].includes(entry.category || entry.type) && Number(entry.power || 0) > 0);
    qa.afterDirectHit("player", move, 1, 100, player, battle, { targetId: "boss" });
    const slots = battle.postgameBossMechanic.slots;
    return {
      stored: slots.map((slot) => Number(slot.triggered?.storedDamage || 0)),
      destroyed: slots.map((slot) => !!slot.destroyed),
      returnedRuntime: Object.values(battle.carryItemStates || {}).map((entry) => Number(entry.storedDamage || 0)),
    };
  });
  if (!hitOrder.stored.every((value) => value === 30) || hitOrder.destroyed.filter(Boolean).length !== 1 || !hitOrder.returnedRuntime.includes(30)) {
    failures.push(`${label}: struck slot effect did not resolve before release ${JSON.stringify(hitOrder)}`);
  }

  errors.forEach((error) => failures.push(error));
  await context.close();
  return { label, viewport, germa, germaUi, kyubi, hitOrder, errors, failures };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const results = [];
  results.push(await runViewport(browser, { width: 1440, height: 900 }, "desktop"));
  results.push(await runViewport(browser, { width: 932, height: 430 }, "mobile"));
  await browser.close();
  const failures = results.flatMap((entry) => entry.failures);
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, results, failures }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
