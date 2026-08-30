const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/shiki_archipelago_20260815_v67";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
}

async function prepareShikiBattle(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    runtime.gameState.phase = "main";
    runtime.gameState.currentPlayerIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    player.pendingBattle = null;
    runtime.battleState = null;
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.crew.forEach((card) => { card.currentHp = debug.cardMaxHp(card); });
    player.activeCrewIndex = 0;
    if (!runtime.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "shiki-archipelago-qa" });
    debug.ensurePostgameWorldLayout(runtime.gameState);
    const assignment = runtime.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_shiki");
    if (!assignment) throw new Error("postgame_shiki assignment missing");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    debug.battleMarkPrebattleIntroDone();
    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    debug.notifyBattleWindow();
    return debug.getBattleView()?.battle?.postgameBossMechanic;
  });
}

async function runRules(host) {
  await prepareShikiBattle(host);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const battle = runtime.battleState;
    const player = runtime.gameState.players[0];
    const qa = debug.postgameBossMechanicQa;
    const move = { id: "qa_direct", name: "測試直接攻擊", category: "attack", type: "attack", power: 100, effects: {} };
    const targetBoss = { targetId: "boss" };
    const mechanic = battle.postgameBossMechanic;
    const initial = qa.view(player, battle);
    player.isCpu = true;
    const cpuDefaultTarget = qa.defaultTarget(player, battle);
    player.isCpu = false;
    const beast = mechanic.islands.find((island) => island.id === "beast");
    const initialBeastHp = beast.currentHp;
    const shieldWithLion = qa.applyDamageRules([100], "player", move, 3, player, battle, targetBoss, {});
    const beastOutgoing = qa.applyDamageRules([100], "enemy", move, 3, player, battle, {}, {});
    const beastIslandSpill = qa.applyDamageRules([80], "player", move, 3, player, battle, { targetId: "shiki_island_beast" }, {});
    const beastHpAfterHit = beast.currentHp;

    const lion = mechanic.islands.find((island) => island.id === "lion");
    lion.currentHp = 40;
    const lionBreakSpill = qa.applyDamageRules([100], "player", move, 3, player, battle, { targetId: "shiki_island_lion" }, {});
    const exposureBefore = mechanic.exposedActions;
    const exposedHit = qa.applyDamageRules([100], "player", move, 3, player, battle, targetBoss, {});
    const exposureAfter = mechanic.exposedActions;
    const shieldAfterLion = qa.applyDamageRules([100], "player", move, 3, player, battle, targetBoss, {});

    const benchBefore = player.crew.slice(1).map((card) => card.currentHp);
    qa.afterMove("enemy", move, 3, true, 100, player, battle);
    const benchAfter = player.crew.slice(1).map((card) => card.currentHp);
    const fleet = mechanic.islands.find((island) => island.id === "fleet");
    fleet.currentHp = 40;
    qa.applyDamageRules([100], "player", move, 3, player, battle, { targetId: "shiki_island_fleet" }, {});
    const benchBeforeNoFleet = player.crew.slice(1).map((card) => card.currentHp);
    qa.afterMove("enemy", move, 3, true, 100, player, battle);
    const benchAfterNoFleet = player.crew.slice(1).map((card) => card.currentHp);
    beast.currentHp = 40;
    qa.applyDamageRules([100], "player", move, 3, player, battle, { targetId: "shiki_island_beast" }, {});

    const finalView = qa.view(player, battle);
    const finalAtk = qa.enemyStat(100, "atk", player, battle);
    const finalSpd = qa.enemyStat(100, "spd", player, battle);
    return {
      initialTitle: initial.title,
      initialTargets: initial.targets.map((target) => target.id),
      islandCount: initial.state.islands.length,
      islandMaxHp: initial.state.islands.map((island) => island.maxHp),
      allIslandsActive: initial.state.islands.every((island) => island.active),
      activeInitial: initial.state.activeIslandId,
      cpuDefaultTarget,
      shieldWithLion,
      beastOutgoing,
      beastIslandSpill,
      beastHpDelta: initialBeastHp - beastHpAfterHit,
      lionBreakSpill,
      shieldAfterLion,
      exposureBefore,
      exposedHit,
      exposureAfter,
      benchLosses: benchBefore.map((hp, index) => hp - benchAfter[index]),
      benchLossesAfterFleetBreak: benchBeforeNoFleet.map((hp, index) => hp - benchAfterNoFleet[index]),
      finalDuel: mechanic.finalDuel,
      finalPhase: mechanic.phase,
      destroyedCount: mechanic.islands.filter((island) => island.destroyed).length,
      finalTargets: finalView.targets.map((target) => target.id),
      finalAtk,
      finalSpd,
      finalPortrait: battle.enemyCombatant.battlePortraits?.normal || "",
      finalMoves: battle.enemyCombatant.moveSet.map((entry) => entry.id),
      oldFieldsPresent: ["floatValue", "groundedSkipPending", "islandFallPending"].some((key) => key in mechanic),
    };
  });
}

async function runLegacyMigration(host) {
  await prepareShikiBattle(host);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const battle = runtime.battleState;
    const player = runtime.gameState.players[0];
    battle.postgameBossMechanic = {
      version: 1,
      key: "postgame_shiki",
      title: "浮空值",
      initialized: true,
      floatValue: 3,
      playerHitThisRound: false,
      groundedSkipPending: false,
      islandFallPending: true,
    };
    battle.enemyCombatant.moveSet.push({ id: "postgame_shiki_island_fall", name: "舊島嶼墜落", type: "special", category: "special", currentPP: 99, pp: 99, power: 318, effects: {} });
    const view = debug.postgameBossMechanicQa.view(player, battle);
    return {
      title: view.title,
      islands: view.state.islands.length,
      islandMaxHp: view.state.islands.map((island) => island.maxHp),
      activeIslandId: view.state.activeIslandId,
      legacyFieldsPresent: ["floatValue", "groundedSkipPending", "islandFallPending"].some((key) => key in battle.postgameBossMechanic),
      phaseOneHasIslandFall: battle.enemyCombatant.moveSet.some((entry) => entry.id === "postgame_shiki_island_fall"),
    };
  });
}

async function runComboCascade(host) {
  await prepareShikiBattle(host);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const battle = runtime.battleState;
    const player = runtime.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    mechanic.islands.forEach((island) => {
      island.maxHp = 60;
      island.currentHp = 60;
      island.destroyed = false;
    });
    mechanic.finalDuel = false;
    mechanic.phase = 1;
    mechanic.activeIslandId = "beast";
    const visualMeta = {};
    const bossHits = debug.postgameBossMechanicQa.applyDamageRules(
      [100, 100, 100, 100],
      "player",
      { id: "qa_combo", name: "四段連擊", category: "attack", type: "attack", power: 100, effects: { multiHit: 4 } },
      6,
      player,
      battle,
      { targetId: "shiki_island_beast" },
      visualMeta,
    );
    return {
      bossHits,
      islandHitDamages: visualMeta.shikiIslandHitDamages,
      islandHitTargetIds: visualMeta.shikiIslandHitTargetIds,
      islandHitDestroyed: visualMeta.shikiIslandHitDestroyed,
      breakIds: (visualMeta.shikiIslandBreaks || []).map((entry) => entry.islandId),
      finalDuel: mechanic.finalDuel,
      destroyedCount: mechanic.islands.filter((island) => island.destroyed).length,
    };
  });
}

async function inspectUi(page) {
  await page.waitForFunction(() => {
    const stage = document.getElementById("shikiArchipelagoStage");
    const images = Array.from(stage?.querySelectorAll(".shiki-archipelago-island") || []);
    return stage && !stage.hidden && images.length === 3 && images.every((image) => image.naturalWidth > 0);
  }, null, { timeout: 12000 });
  return page.evaluate(() => {
    const stage = document.getElementById("shikiArchipelagoStage");
    const slots = Array.from(stage.querySelectorAll(".shiki-archipelago-slot"));
    const images = Array.from(stage.querySelectorAll(".shiki-archipelago-island"));
    const portrait = document.getElementById("enemyPortraitWrap");
    const enemyCard = document.getElementById("enemyCard");
    const cosmeticFrames = Array.from(enemyCard.querySelectorAll(".cosmetic-frame-layer"));
    const stageRect = stage.getBoundingClientRect();
    const portraitRect = portrait.getBoundingClientRect();
    const enemyPortrait = document.getElementById("enemyPortrait");
    const slotRects = slots.map((slot) => slot.getBoundingClientRect());
    const overlaps = slotRects.some((rect, index) => slotRects.slice(index + 1).some((other) => (
      Math.min(rect.right, other.right) - Math.max(rect.left, other.left) > 2
      && Math.min(rect.bottom, other.bottom) - Math.max(rect.top, other.top) > 2
    )));
    const stageZ = Number.parseInt(getComputedStyle(stage).zIndex, 10) || 0;
    const maxFrameZ = cosmeticFrames.reduce((max, frame) => Math.max(max, Number.parseInt(getComputedStyle(frame).zIndex, 10) || 0), 0);
    return {
      names: slots.map((slot) => slot.querySelector("strong")?.textContent.trim() || ""),
      effects: slots.map((slot) => slot.querySelector("small")?.textContent.trim() || ""),
      images: images.map((image) => image.currentSrc || image.src || ""),
      naturalSizes: images.map((image) => [image.naturalWidth, image.naturalHeight]),
      slotCount: slots.length,
      stageParent: stage.parentElement?.id || "",
      stageZ,
      maxFrameZ,
      slotsOverlap: overlaps,
      stagePlacedAtLeftEdge: stageRect.left < portraitRect.left - 10 && Math.abs(stageRect.right - portraitRect.left) <= 18,
      enemyPortraitOverflow: getComputedStyle(portrait).overflow,
      enemyCardOverflow: getComputedStyle(enemyCard).overflow,
      visibleEffectCount: slots.filter((slot) => {
        const effect = slot.querySelector("small");
        return effect && getComputedStyle(effect).display !== "none" && effect.getBoundingClientRect().height > 0;
      }).length,
      enemyPortraitLoaded: !!enemyPortrait?.naturalWidth,
      slotsInsideViewport: slots.every((slot) => {
        const rect = slot.getBoundingClientRect();
        return rect.left >= -2 && rect.right <= innerWidth + 2 && rect.top >= -2 && rect.bottom <= innerHeight + 2;
      }),
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
      viewport: [innerWidth, innerHeight],
      stageRect: { x: stageRect.x, y: stageRect.y, width: stageRect.width, height: stageRect.height },
      slotRects: slotRects.map((rect) => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
      brokenImages: Array.from(document.querySelectorAll("#shikiArchipelagoStage img, .shiki-island-card img")).filter((entry) => entry.complete && !entry.naturalWidth).map((entry) => entry.id || entry.src),
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const failures = [];
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?shiki_archipelago_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const rules = await runRules(host);
  const comboCascade = await runComboCascade(host);
  const legacyMigration = await runLegacyMigration(host);
  await prepareShikiBattle(host);
  const pagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?shiki_archipelago_qa=1", "_blank"));
  const battlePage = await pagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");
  const desktop = await inspectUi(battlePage);
  await battlePage.locator('[data-shiki-island-id="lion"]').click({ force: true });
  const selectedStageTarget = await battlePage.evaluate(() => document.querySelector(".shiki-archipelago-slot.is-selected")?.dataset.shikiTargetId || "");
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "shiki_archipelago_desktop.png"), fullPage: true });
  await battlePage.locator(".boss-mechanic-status-icon").click();
  await battlePage.waitForFunction(() => !document.getElementById("postgameBossMechanicPanel")?.hidden);
  const detail = await battlePage.evaluate(() => ({
    title: document.getElementById("postgameBossMechanicTitle")?.textContent.trim() || "",
    islands: Array.from(document.querySelectorAll(".shiki-island-card")).map((card) => card.textContent.replace(/\s+/g, " ").trim()),
    targets: Array.from(document.querySelectorAll(".postgame-boss-target")).map((button) => button.textContent.trim()),
    selectedTarget: document.querySelector(".postgame-boss-target.active")?.dataset.postgameTarget || "",
    panelRect: (() => { const rect = document.getElementById("postgameBossMechanicPanel").getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
    overflow: Array.from(document.querySelectorAll(".shiki-island-card, .postgame-boss-target")).filter((entry) => entry.scrollWidth > entry.clientWidth + 2 || entry.scrollHeight > entry.clientHeight + 2).map((entry) => entry.textContent.trim()),
  }));
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "shiki_archipelago_detail_desktop.png"), fullPage: true });

  await battlePage.locator("#postgameBossMechanicClose").click();
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const battle = runtime.battleState;
    const player = runtime.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const beast = mechanic.islands.find((island) => island.id === "beast");
    beast.currentHp = 40;
    const visualMeta = {};
    const bossHits = debug.postgameBossMechanicQa.applyDamageRules(
      [100],
      "player",
      { id: "qa_break", name: "破島測試", category: "attack", type: "attack", power: 100, effects: {} },
      6,
      player,
      battle,
      { targetId: "shiki_island_beast" },
      visualMeta,
    );
    battle.visualEvent = {
      id: `qa-shiki-break-${Date.now()}`,
      type: "attack",
      side: "player",
      targetSide: "enemy",
      actorName: player.crew[0]?.name || player.name,
      targetName: battle.enemyCombatant.name,
      moveName: "破島測試",
      moveType: "attack",
      damage: bossHits.reduce((sum, value) => sum + value, 0),
      hitDamages: bossHits,
      shikiIslandId: visualMeta.shikiIslandId,
      shikiIslandName: visualMeta.shikiIslandName,
      shikiIslandDamage: visualMeta.shikiIslandDamage,
      shikiIslandHitDamages: visualMeta.shikiIslandHitDamages,
      shikiIslandHitTargetIds: visualMeta.shikiIslandHitTargetIds,
      shikiIslandHitTargetNames: visualMeta.shikiIslandHitTargetNames,
      shikiIslandHitDestroyed: visualMeta.shikiIslandHitDestroyed,
      shikiIslandBreaks: visualMeta.shikiIslandBreaks,
      shikiIslandVisualIslands: visualMeta.shikiIslandVisualIslands,
      shikiIslandDestroyed: visualMeta.shikiIslandDestroyed,
      critical: false,
      miss: false,
      duration: 1850,
    };
    debug.notifyBattleWindow();
  });
  await battlePage.waitForFunction(() => document.querySelector('[data-shiki-island-id="beast"]')?.classList.contains("is-breaking"), null, { timeout: 3500 });
  const breakVisual = await battlePage.evaluate(() => ({
    className: document.querySelector('[data-shiki-island-id="beast"]')?.className || "",
    image: document.querySelector('[data-shiki-island-id="beast"] .shiki-archipelago-island')?.currentSrc || "",
    animationName: getComputedStyle(document.querySelector('[data-shiki-island-id="beast"]')).animationName,
    damageNumbers: Array.from(document.querySelectorAll(".damage-number-value")).map((entry) => entry.textContent.trim()),
  }));
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "shiki_archipelago_break_impact.png"), fullPage: true });
  await battlePage.waitForFunction(() => !document.querySelector('[data-shiki-island-id="beast"]'), null, { timeout: 3000 });
  const breakRemoved = await battlePage.evaluate(() => !document.querySelector('[data-shiki-island-id="beast"]'));

  await prepareShikiBattle(host);
  await battlePage.setViewportSize({ width: 932, height: 430 });
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const mobile = await inspectUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "shiki_archipelago_mobile_932x430.png"), fullPage: true });

  if (rules.initialTitle !== "漂浮群島攻城戰") failures.push("mechanic title mismatch");
  if (rules.islandCount !== 3 || rules.activeInitial !== "beast" || !rules.allIslandsActive || !rules.islandMaxHp.every((hp) => hp === 900)) failures.push("initial simultaneous island state or durability mismatch");
  if (JSON.stringify(rules.initialTargets) !== '["shiki_island_beast","shiki_island_lion","shiki_island_fleet","boss"]') failures.push("three selectable island targets mismatch");
  if (rules.cpuDefaultTarget !== "shiki_island_lion") failures.push("CPU did not prioritize lion island");
  if (JSON.stringify(rules.shieldWithLion) !== "[2]" || JSON.stringify(rules.beastOutgoing) !== "[115]") failures.push("simultaneous island modifiers mismatch");
  if (JSON.stringify(rules.beastIslandSpill) !== "[20]" || rules.beastHpDelta !== 80) failures.push("island spill mismatch");
  if (JSON.stringify(rules.lionBreakSpill) !== "[70]" || JSON.stringify(rules.shieldAfterLion) !== "[5]") failures.push("lion break or remaining island shield mismatch");
  if (rules.exposureBefore !== 1 || JSON.stringify(rules.exposedHit) !== "[8]" || rules.exposureAfter !== 0) failures.push("break exposure mismatch");
  if (!rules.benchLosses.every((loss) => loss > 0) || !rules.benchLossesAfterFleetBreak.every((loss) => loss === 0)) failures.push("fleet volley lifetime mismatch");
  if (!rules.finalDuel || rules.finalPhase !== 2 || rules.destroyedCount !== 3 || JSON.stringify(rules.finalTargets) !== '["boss"]') failures.push("final duel transition mismatch");
  if (rules.finalAtk !== 125 || rules.finalSpd !== 125 || !/postgame_shiki\/angry\.webp/.test(rules.finalPortrait)) failures.push("final duel stat or portrait mismatch");
  if (!rules.finalMoves.includes("postgame_shiki_island_fall") || rules.finalMoves.includes("postgame_shiki_float_float") || rules.oldFieldsPresent) failures.push("final moves or legacy fields mismatch");
  if (legacyMigration.title !== "漂浮群島攻城戰" || legacyMigration.islands !== 3 || !legacyMigration.islandMaxHp.every((hp) => hp === 900) || legacyMigration.activeIslandId !== "beast" || legacyMigration.legacyFieldsPresent || legacyMigration.phaseOneHasIslandFall) failures.push("legacy float mechanic migration mismatch");
  if (JSON.stringify(comboCascade.bossHits) !== "[55,55,55,100]" || JSON.stringify(comboCascade.islandHitDamages) !== "[60,60,60,0]" || JSON.stringify(comboCascade.islandHitTargetIds) !== '["beast","lion","fleet",""]' || JSON.stringify(comboCascade.islandHitDestroyed) !== "[true,true,true,false]" || JSON.stringify(comboCascade.breakIds) !== '["beast","lion","fleet"]' || !comboCascade.finalDuel || comboCascade.destroyedCount !== 3) failures.push("multi-hit island target cascade mismatch");
  if (desktop.slotCount !== 3 || desktop.stageParent !== "enemyCard" || desktop.stageZ <= desktop.maxFrameZ || desktop.slotsOverlap || !desktop.stagePlacedAtLeftEdge || !desktop.slotsInsideViewport || desktop.documentOverflow || desktop.brokenImages.length || desktop.enemyPortraitOverflow !== "hidden" || desktop.enemyCardOverflow !== "visible" || desktop.visibleEffectCount !== 3 || !desktop.enemyPortraitLoaded) failures.push("desktop island convoy stacking/bounds/assets mismatch");
  if (mobile.slotCount !== 3 || mobile.stageParent !== "enemyCard" || mobile.stageZ <= mobile.maxFrameZ || mobile.slotsOverlap || !mobile.stagePlacedAtLeftEdge || !mobile.slotsInsideViewport || mobile.documentOverflow || mobile.brokenImages.length || mobile.enemyPortraitOverflow !== "hidden" || mobile.enemyCardOverflow !== "visible" || mobile.visibleEffectCount !== 3 || !mobile.enemyPortraitLoaded) failures.push("mobile island convoy stacking/bounds/assets mismatch");
  if (selectedStageTarget !== "shiki_island_lion") failures.push("direct island selection mismatch");
  if (detail.title !== "漂浮群島攻城戰" || detail.islands.length !== 3 || detail.targets.length !== 4 || detail.selectedTarget !== "shiki_island_lion" || detail.overflow.length) failures.push("mechanic detail panel mismatch");
  if (!/is-breaking/.test(breakVisual.className) || breakVisual.animationName !== "shikiIslandBreak" || !/beast_broken\.webp/.test(breakVisual.image) || !breakVisual.damageNumbers.some((value) => value.includes("40")) || !breakRemoved) failures.push("break fall-out animation or island damage number mismatch");

  const report = { rules, comboCascade, legacyMigration, desktop, selectedStageTarget, detail, breakVisual, breakRemoved, mobile, errors, failures, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
