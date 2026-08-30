const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/tesoro_rework_20260818";

const CASES = [
  { label: "desktop", viewport: { width: 1600, height: 900 } },
  { label: "phone_landscape", viewport: { width: 932, height: 430 } },
];

function captureErrors(page, errors, label) {
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

async function prepareBattle(host, bossKey, goldLevel = 0) {
  return host.evaluate(({ requestedBossKey, requestedGoldLevel }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((source) => debug.cloneCard({
      ...source,
      level: 50,
      currentHp: Number.MAX_SAFE_INTEGER,
    }));
    player.crew.forEach((card) => {
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
      card.battleCarryItem = null;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) {
      debug.unlockPostgameWorldAfterEnding(player, { id: "battle-attribute-tesoro-scope-qa" });
    }
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === requestedBossKey);
    if (!assignment) throw new Error(`Missing postgame assignment for ${requestedBossKey}`);
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
    battle.visualEvent = null;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    if (requestedBossKey === "postgame_gild_tesoro") {
      const mechanic = battle.postgameBossMechanic;
      mechanic.phase = 1;
      Object.keys(mechanic.controlByCrew || {}).forEach((crewKey) => {
        mechanic.controlByCrew[crewKey] = requestedGoldLevel;
        mechanic.goldByCrew[crewKey] = Math.max(0, requestedGoldLevel);
      });
    }
    return debug.getBattleView();
  }, { requestedBossKey: bossKey, requestedGoldLevel: goldLevel });
}

async function inspectTesoroMechanic(host) {
  await prepareBattle(host, "postgame_gild_tesoro", 0);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    const crewKey = Object.keys(mechanic.goldByCrew || {})[0];
    const bind = battle.enemyCombatant.moveSet.find((entry) => entry.id === "postgame_tesoro_gold_bind");
    const buff = { id: "postgame_tesoro_gold_buff_qa", name: "黃金強化", type: "buff", power: 0 };
    const playerMove = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const snapshot = () => ({
      gold: Number(mechanic.goldByCrew?.[crewKey] || 0),
      control: Number(mechanic.controlByCrew?.[crewKey] || 0),
      forced: !!mechanic.forcedSwitch?.pending,
      needsReplacement: !!battle.needsReplacement,
      result: String(battle.result || ""),
    });

    qa.afterMove("enemy", buff, 6, true, 0, player, battle);
    qa.afterDirectHit("player", playerMove, 6, 50, player, battle, { targetId: "boss" });
    const unaffected = snapshot();
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    const firstHit = snapshot();
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    const secondHit = snapshot();
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    const thirdHit = snapshot();
    const replacementView = debug.getBattleView();
    thirdHit.promptType = String(replacementView?.battle?.postgameBossMechanic?.prompt?.type || "");
    thirdHit.replacementCandidateCount = Number(replacementView?.battle?.replacementCandidates?.length || 0);
    const switched = debug.battleChooseReplacement(1);
    const afterSwitch = {
      switched,
      activeCrewIndex: Number(battle.activeCrewIndex),
      outgoingGold: Number(mechanic.goldByCrew?.[crewKey] || 0),
      outgoingControl: Number(mechanic.controlByCrew?.[crewKey] || 0),
      forced: !!mechanic.forcedSwitch?.pending,
      needsReplacement: !!battle.needsReplacement,
      result: String(battle.result || ""),
      waitingResume: !!battle.waitingResume,
      animating: !!battle.animating,
      replacementReason: String(battle.replacementReason || ""),
    };
    return { unaffected, firstHit, secondHit, thirdHit, afterSwitch, replacementView };
  });
}

async function inspectTesoroLethalThirdHit(host) {
  await prepareBattle(host, "postgame_gild_tesoro", 2);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    const activeIndex = Number(battle.activeCrewIndex || 0);
    const activeCard = player.crew[activeIndex];
    const crewKey = activeCard.id;
    const bind = battle.enemyCombatant.moveSet.find((entry) => entry.id === "postgame_tesoro_gold_bind");
    activeCard.currentHp = 0;
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    const direct = {
      currentHp: Number(activeCard.currentHp || 0),
      gold: Number(mechanic.goldByCrew?.[crewKey] || 0),
      control: Number(mechanic.controlByCrew?.[crewKey] || 0),
      forced: !!mechanic.forcedSwitch?.pending,
      needsReplacement: !!battle.needsReplacement,
      result: String(battle.result || ""),
      replacementReason: String(battle.replacementReason || ""),
    };
    mechanic.forcedSwitch = { pending: true, fromIndex: activeIndex, cardName: activeCard.name };
    battle.needsReplacement = true;
    battle.result = "replacement";
    battle.replacementAfterAction = true;
    battle.replacementReason = "tesoro-gold";
    battle.pendingReplacementActiveCrewIndex = activeIndex;
    const normalizedView = qa.view(player, battle);
    return {
      ...direct,
      normalizedLegacy: {
        forced: !!mechanic.forcedSwitch?.pending,
        needsReplacement: !!battle.needsReplacement,
        result: String(battle.result || ""),
        replacementReason: String(battle.replacementReason || ""),
        pendingReplacementActiveCrewIndex: Number(battle.pendingReplacementActiveCrewIndex),
        promptType: String(normalizedView?.prompt?.type || ""),
      },
    };
  });
}

async function inspectTesoroFirstPhaseDefense(host) {
  await prepareBattle(host, "postgame_gild_tesoro", 0);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const firstDirectMove = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    battle.enemyCombatant.currentHp -= 1400;
    debug.postgameBossMechanicQa.afterDirectHit("player", firstDirectMove, 6, 1400, player, battle, { targetId: "boss" });
    return {
      maxHp: Number(battle.enemyCombatant.maxHp || 0),
      hpAfterHeavyHit: Number(battle.enemyCombatant.currentHp || 0),
      defStage: Number(battle.enemyCombatant.stages?.def || 0),
      sdefStage: Number(battle.enemyCombatant.stages?.sdef || 0),
      phase: Number(battle.postgameBossMechanic?.phase || 0),
      pendingPhase: Number(battle.postgameBossMechanic?.pendingPhase || 0),
      passiveText: String(battle.enemyCombatant.passiveText || ""),
    };
  });
}

async function inspectTesoroLegacyNormalization(host) {
  await prepareBattle(host, "postgame_gild_tesoro", 0);
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const crewKey = Object.keys(mechanic.goldByCrew || {})[0];
    mechanic.version = 2;
    mechanic.phase = 1;
    mechanic.goldByCrew[crewKey] = 2;
    mechanic.controlByCrew[crewKey] = -3;
    mechanic.forcedSwitch = { pending: true, fromIndex: 0, cardName: player.crew[0].name };
    battle.result = "";
    battle.needsReplacement = false;
    delete battle.replacementReason;
    const view = debug.getBattleView();
    const firstPhase = {
      version: Number(mechanic.version || 0),
      gold: Number(mechanic.goldByCrew?.[crewKey] || 0),
      control: Number(mechanic.controlByCrew?.[crewKey] || 0),
      forced: !!mechanic.forcedSwitch?.pending,
      needsReplacement: !!battle.needsReplacement,
      result: String(battle.result || ""),
      replacementReason: String(battle.replacementReason || ""),
      promptType: String(view?.battle?.postgameBossMechanic?.prompt?.type || ""),
      replacementCandidateCount: Number(view?.battle?.replacementCandidates?.length || 0),
      viewNeedsReplacement: !!view?.battle?.needsReplacement,
      viewResult: String(view?.battle?.result || ""),
      canAct: !!view?.battle?.canAct,
    };
    const legacyReplacementResolved = debug.battleChooseReplacement(1);
    const legacyReplacement = {
      resolved: legacyReplacementResolved,
      activeCrewIndex: Number(battle.activeCrewIndex),
      gold: Number(mechanic.goldByCrew?.[crewKey] || 0),
      control: Number(mechanic.controlByCrew?.[crewKey] || 0),
      forced: !!mechanic.forcedSwitch?.pending,
      needsReplacement: !!battle.needsReplacement,
      result: String(battle.result || ""),
      replacementReason: String(battle.replacementReason || ""),
    };
    battle.activeCrewIndex = 0;
    player.activeCrewIndex = 0;
    battle.animating = false;
    battle.waitingResume = false;
    mechanic.version = 3;
    mechanic.phase = 3;
    mechanic.moveSetPhase = 3;
    mechanic.pendingPhase = 3;
    mechanic.giantControl = 2;
    mechanic.giantArmor = 1;
    mechanic.ultimatePending = true;
    mechanic.forcedSwitch = null;
    mechanic.goldByCrew[crewKey] = 0;
    mechanic.controlByCrew[crewKey] = 0;
    battle.result = "";
    battle.needsReplacement = false;
    const goldenView = debug.getBattleView();
    const migratedGolden = {
      version: Number(mechanic.version || 0),
      phase: Number(mechanic.phase || 0),
      pendingPhase: Number(mechanic.pendingPhase || 0),
      gold: Math.max(0, ...Object.values(mechanic.goldByCrew || {}).map(Number)),
      control: Math.max(0, ...Object.values(mechanic.controlByCrew || {}).map(Number)),
      giantControl: Number(mechanic.giantControl || 0),
      giantArmor: Number(mechanic.giantArmor || 0),
      ultimatePending: !!mechanic.ultimatePending,
      retainedPercent: Number(goldenView?.battle?.postgameBossMechanic?.state?.goldenDamageRetainedPercent || 0),
      portrait: String(battle.enemyCombatant?.battlePortraits?.normal || ""),
      moveIds: (battle.enemyCombatant?.moveSet || []).map((entry) => entry.id),
    };
    return {
      ...firstPhase,
      legacyReplacement,
      migratedGolden,
    };
  });
}

async function inspectTesoroGoldenTransition(host) {
  await prepareBattle(host, "postgame_gild_tesoro", 0);
  const prepared = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const card = player.crew[0];
    const move = card.moveSet.find((entry) => Number(entry.power || 0) > 0);
    if (!move) throw new Error("Missing player damage move for Tesoro phase QA");
    card.baseStats.atk = 9999;
    card.baseStats.satk = 9999;
    card.baseStats.spd = 9999;
    card.baseStats.hp = 99999;
    card.maxHp = 99999;
    card.currentHp = 99999;
    move.category = "attack";
    move.type = "attack";
    move.power = 9999;
    move.accuracy = 100;
    move.effects = {};
    move.pp = 99;
    move.currentPP = 99;
    battle.enemyCombatant.spd = 1;
    battle.enemyCombatant.baseStats.spd = 1;
    battle.enemyCombatant.currentHp = Math.max(2, Math.ceil(battle.enemyCombatant.maxHp * 0.51));
    const preservedCrewKey = player.crew[1].id;
    mechanic.goldByCrew[preservedCrewKey] = 2;
    mechanic.controlByCrew[preservedCrewKey] = 2;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.result = "";
    const queued = debug.battleChooseMove(move.id);
    return {
      queued,
      moveId: move.id,
      originalEnemyMoveId: battle.enemyAction?.moveId || "",
      preservedCrewKey,
    };
  });
  let timedOut = false;
  try {
    await host.waitForFunction(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      return Number(battle?.postgameBossMechanic?.phase || 0) === 2
        && !battle?.animating
        && (battle?.log || []).some((entry) => /^敵人 使用 (黃金業火|黃金神火|黃金帝壓|黃金神之怒)/.test(entry))
        && (Number(battle?.roundIndex || 0) >= 2 || !!battle?.roundResolved || !!battle?.result);
    }, null, { timeout: 25000 });
  } catch (_error) {
    timedOut = true;
  }
  return host.evaluate(({ setup, timedOut: didTimeOut }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    const mechanic = battle.postgameBossMechanic;
    const goldenMoveIds = (battle.enemyCombatant.moveSet || []).map((entry) => entry.id);
    const enemyAttackLog = (battle.log || []).filter((entry) => /^敵人 使用 /.test(entry));
    const enemyPerformedAction = !!battle.enemyPerformedAction;
    battle.enemyPerformedAction = false;
    battle.enemyAction = { type: "move", moveId: "postgame_tesoro_gold_splash" };
    debug.postgameBossMechanicQa.view(debug.getState().gameState.players[0], battle);
    const recoveredEnemyActionId = String(battle.enemyAction?.moveId || "");
    const player = debug.getState().gameState.players[0];
    const qa = debug.postgameBossMechanicQa;
    const activeCard = player.crew[battle.activeCrewIndex];
    const activeKey = activeCard.id;
    mechanic.goldByCrew[activeKey] = 0;
    mechanic.controlByCrew[activeKey] = 0;
    const goldenMove = (battle.enemyCombatant.moveSet || []).find((entry) => entry.id === "postgame_tesoro_golden_inferno");
    qa.afterMove("enemy", goldenMove, 4, true, 50, player, battle);
    const goldAfterGoldenHit = Number(mechanic.goldByCrew[activeKey] || 0);
    const playerMove = activeCard.moveSet.find((entry) => Number(entry.power || 0) > 0);
    qa.afterDirectHit("player", playerMove, 6, 100, player, battle, { targetId: "boss" });
    const goldAfterPlayerHit = Number(mechanic.goldByCrew[activeKey] || 0);
    const retainedDamage = qa.applyDamageRules([100], "player", playerMove, 6, player, battle, { targetId: "boss" })[0];
    const enemyHpBeforeKoProbe = Number(battle.enemyCombatant.currentHp || 0);
    battle.enemyCombatant.currentHp = 0;
    mechanic.pendingPhase = 0;
    const goldenKoPrevented = qa.preventEnemyKnockout(player, battle);
    const goldenKoHp = Number(battle.enemyCombatant.currentHp || 0);
    battle.enemyCombatant.currentHp = enemyHpBeforeKoProbe;
    return {
      ...setup,
      timedOut: didTimeOut,
      phase: Number(mechanic.phase || 0),
      pendingPhase: Number(mechanic.pendingPhase || 0),
      animating: !!battle.animating,
      result: String(battle.result || ""),
      roundResolved: !!battle.roundResolved,
      roundIndex: Number(battle.roundIndex || 0),
      canAct: !!debug.getBattleView()?.battle?.canAct,
      enemyPerformedAction,
      recoveredEnemyActionId,
      staleActionRecovered: goldenMoveIds.includes(recoveredEnemyActionId),
      enemyPortrait: battle.enemyCombatant.battlePortraits?.normal || "",
      goldenMoveIds,
      enemyAttackLog,
      goldenEnemyActed: enemyAttackLog.some((entry) => /黃金業火|黃金神火|黃金帝壓|黃金神之怒/.test(entry)),
      preservedGold: Number(mechanic.goldByCrew[setup.preservedCrewKey] || 0),
      goldAfterGoldenHit,
      goldAfterPlayerHit,
      retainedDamage,
      goldenKoPrevented,
      goldenKoHp,
      giantControl: Number(mechanic.giantControl || 0),
      giantArmor: Number(mechanic.giantArmor || 0),
      ultimatePending: !!mechanic.ultimatePending,
    };
  }, { setup: prepared, timedOut });
}

async function inspect(page) {
  await page.waitForFunction(() => {
    const portrait = document.getElementById("playerPortrait");
    return portrait?.complete && portrait.naturalWidth > 0;
  }, null, { timeout: 15000 });
  return page.evaluate(() => {
    const tier = document.getElementById("playerCardTier");
    const coating = document.getElementById("tesoroGoldCoating");
    const tierRect = tier.getBoundingClientRect();
    const portrait = document.getElementById("playerPortrait");
    const hudAttribute = document.querySelector("#playerHudMeta .attribute-pill");
    return {
      cardTier: {
        className: tier.className,
        text: tier.textContent.trim(),
        display: getComputedStyle(tier).display,
        width: tierRect.width,
        height: tierRect.height,
      },
      goldCoating: {
        hidden: coating.hidden,
        display: getComputedStyle(coating).display,
        active: coating.classList.contains("is-active"),
        className: coating.className,
        level: coating.dataset.level,
        parent: coating.offsetParent?.id || "",
        fillRatio: (() => {
          const fill = coating.querySelector(".tesoro-gold-river-fill");
          const coatingHeight = coating.getBoundingClientRect().height;
          return coatingHeight > 0 && fill ? fill.getBoundingClientRect().height / coatingHeight : 0;
        })(),
        art: (() => {
          const art = coating.querySelector(".tesoro-gold-river-art");
          return {
            url: art?.currentSrc || art?.src || "",
            loaded: !!art?.complete && Number(art?.naturalWidth || 0) > 0,
            naturalWidth: Number(art?.naturalWidth || 0),
            naturalHeight: Number(art?.naturalHeight || 0),
          };
        })(),
      },
      hudAttribute: {
        text: hudAttribute?.textContent.trim() || "",
        display: hudAttribute ? getComputedStyle(hudAttribute).display : "missing",
      },
      portrait: {
        loaded: portrait.complete && portrait.naturalWidth > 0,
      },
    };
  });
}

async function inspectTesoroOrdinaryReplacement(page) {
  await page.waitForFunction(() => document.querySelectorAll("#infoContent [data-replacement-index]").length > 0, null, { timeout: 5000 });
  return page.evaluate(() => {
    const content = document.getElementById("infoContent");
    const choices = Array.from(content?.querySelectorAll("[data-replacement-index]") || []);
    return {
      choiceCount: choices.length,
      imageCount: content?.querySelectorAll("img").length || 0,
      specialPromptCount: content?.querySelectorAll('[aria-label="金流完全淹沒強制換人"], [data-postgame-force-index]').length || 0,
      text: content?.textContent.replace(/\s+/g, " ").trim() || "",
    };
  });
}

async function inspectTesoroGoldenDetail(page) {
  await page.locator(".boss-mechanic-status-icon").click();
  await page.waitForTimeout(180);
  return page.evaluate(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    const state = document.getElementById("postgameBossMechanicState");
    const rect = panel?.getBoundingClientRect();
    return {
      hidden: !!panel?.hidden,
      text: state?.textContent.replace(/\s+/g, " ").trim() || "",
      withinViewport: !!rect
        && rect.left >= -1
        && rect.top >= -1
        && rect.right <= window.innerWidth + 1
        && rect.bottom <= window.innerHeight + 1,
    };
  });
}

async function inspectTesoroRiverStability(page, screenshotPath) {
  await page.evaluate(() => {
    const card = document.getElementById("playerCard");
    card.classList.remove("portrait-attack", "portrait-hit");
    void card.offsetWidth;
    card.classList.add("portrait-attack");
  });
  await page.waitForTimeout(340);
  const attack = await page.evaluate(() => {
    const portrait = document.getElementById("playerPortrait");
    const portraitStyle = getComputedStyle(document.getElementById("playerPortrait"));
    const coating = document.getElementById("tesoroGoldCoating");
    const coatingStyle = getComputedStyle(coating);
    const card = document.getElementById("playerCard");
    return {
      cardClass: card.className,
      coatingClass: coating.className,
      coatingHidden: coating.hidden,
      portraitAnimation: portraitStyle.animationName,
      coatingAnimation: coatingStyle.animationName,
      portraitTransform: portraitStyle.transform,
      coatingTransform: coatingStyle.transform,
      portraitParent: portrait.offsetParent?.id || "",
      coatingParent: coating.offsetParent?.id || "",
    };
  });
  await page.screenshot({ path: screenshotPath, fullPage: false });

  await page.evaluate(() => {
    const card = document.getElementById("playerCard");
    card.classList.remove("portrait-attack", "portrait-hit");
    void card.offsetWidth;
    card.classList.add("portrait-hit");
  });
  await page.waitForTimeout(220);
  const hit = await page.evaluate(() => {
    const portrait = document.getElementById("playerPortrait");
    const portraitStyle = getComputedStyle(document.getElementById("playerPortrait"));
    const coating = document.getElementById("tesoroGoldCoating");
    const coatingStyle = getComputedStyle(coating);
    const card = document.getElementById("playerCard");
    return {
      cardClass: card.className,
      coatingClass: coating.className,
      coatingHidden: coating.hidden,
      portraitAnimation: portraitStyle.animationName,
      coatingAnimation: coatingStyle.animationName,
      portraitTransform: portraitStyle.transform,
      coatingTransform: coatingStyle.transform,
      portraitParent: portrait.offsetParent?.id || "",
      coatingParent: coating.offsetParent?.id || "",
    };
  });
  await page.evaluate(() => document.getElementById("playerCard").classList.remove("portrait-attack", "portrait-hit"));
  return { attack, hit };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const results = {};
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });

  for (const testCase of CASES) {
    const context = await browser.newContext({ viewport: testCase.viewport, deviceScaleFactor: 1 });
    await context.addInitScript(() => {
      window.setInterval = () => 0;
    });
    const host = await context.newPage();
    captureErrors(host, errors, `${testCase.label}:host`);
    await host.goto(`${ROOT_URL}/board_game.html?battle_attribute_tesoro_scope_qa=1`, { waitUntil: "domcontentloaded" });
    await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
    const ordinaryView = await prepareBattle(host, "postgame_douglas_bullet", 0);
    const tesoroViews = {};
    for (const level of [1, 2, 3]) {
      tesoroViews[level] = await prepareBattle(host, "postgame_gild_tesoro", level);
    }
    const tesoroFirstPhaseDefense = await inspectTesoroFirstPhaseDefense(host);
    const { replacementView: tesoroReplacementView, ...tesoroMechanic } = await inspectTesoroMechanic(host);
    const tesoroLethalThirdHit = await inspectTesoroLethalThirdHit(host);
    const tesoroLegacy = await inspectTesoroLegacyNormalization(host);
    const tesoroGoldenTransition = await inspectTesoroGoldenTransition(host);
    const tesoroGoldenView = await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      const player = state.gameState.players[0];
      const mechanic = battle.postgameBossMechanic;
      const key = player.crew[battle.activeCrewIndex].id;
      mechanic.goldByCrew[key] = 2;
      mechanic.controlByCrew[key] = 2;
      return debug.getBattleView();
    });
    await host.screenshot({
      path: path.join(OUTPUT_DIR, `tesoro_golden_transition_resolved_${testCase.label}.png`),
      fullPage: false,
    });
    await host.close();

    const battle = await context.newPage();
    captureErrors(battle, errors, `${testCase.label}:battle`);
    await battle.goto(`${ROOT_URL}/board_battle.html?battle_attribute_tesoro_scope_qa=1`, { waitUntil: "domcontentloaded" });
    await battle.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.refresh, null, { timeout: 15000 });

    await battle.evaluate((view) => window.__BOARD_BATTLE_DEBUG__.refresh(view), ordinaryView);
    await battle.waitForTimeout(350);
    const ordinary = await inspect(battle);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, `normal_battle_no_attribute_bar_${testCase.label}.png`), fullPage: false });

    const tesoroStages = {};
    for (const level of [1, 2, 3]) {
      await battle.evaluate((view) => window.__BOARD_BATTLE_DEBUG__.refresh(view), tesoroViews[level]);
      await battle.waitForTimeout(350);
      tesoroStages[level] = await inspect(battle);
      await battle.screenshot({ path: path.join(OUTPUT_DIR, `tesoro_gold_river_level_${level}_${testCase.label}.png`), fullPage: false });
    }
    const tesoro = tesoroStages[2];
    await battle.evaluate((view) => window.__BOARD_BATTLE_DEBUG__.refresh(view), tesoroReplacementView);
    await battle.waitForTimeout(180);
    const tesoroOrdinaryReplacement = await inspectTesoroOrdinaryReplacement(battle);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, `tesoro_ordinary_replacement_${testCase.label}.png`), fullPage: false });
    await battle.evaluate((view) => window.__BOARD_BATTLE_DEBUG__.refresh(view), tesoroViews[2]);
    await battle.waitForTimeout(100);
    const tesoroMotion = await inspectTesoroRiverStability(
      battle,
      path.join(OUTPUT_DIR, `tesoro_gold_river_attack_${testCase.label}.png`),
    );
    await battle.evaluate((view) => window.__BOARD_BATTLE_DEBUG__.refresh(view), tesoroGoldenView);
    await battle.waitForTimeout(350);
    const tesoroGolden = await inspect(battle);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, `tesoro_golden_gold_river_${testCase.label}.png`), fullPage: false });
    const tesoroGoldenDetail = await inspectTesoroGoldenDetail(battle);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, `tesoro_golden_mechanic_detail_${testCase.label}.png`), fullPage: false });

    results[testCase.label] = { ordinary, tesoro, tesoroStages, tesoroMotion, tesoroOrdinaryReplacement, tesoroGolden, tesoroGoldenDetail, tesoroFirstPhaseDefense, tesoroMechanic, tesoroLethalThirdHit, tesoroLegacy, tesoroGoldenTransition };
    await context.close();
  }

  await browser.close();

  const failures = [];
  for (const [label, result] of Object.entries(results)) {
    for (const [battleType, data] of Object.entries({ ordinary: result.ordinary, tesoro: result.tesoro })) {
      if (data.cardTier.className !== "card-tier" || data.cardTier.display !== "none" || data.cardTier.height !== 0) {
        failures.push(`${label}:${battleType}:player card tier is visible or mutated`);
      }
      if (!data.hudAttribute.text || data.hudAttribute.display === "none" || data.hudAttribute.display === "missing") {
        failures.push(`${label}:${battleType}:HUD attribute pill is missing`);
      }
      if (!data.portrait.loaded) {
        failures.push(`${label}:${battleType}:player portrait is broken`);
      }
    }
    if (!result.ordinary.goldCoating.hidden || result.ordinary.goldCoating.display !== "none" || result.ordinary.goldCoating.active) {
      failures.push(`${label}:ordinary:Tesoro coating leaked into another battle`);
    }
    if (result.tesoro.goldCoating.hidden
      || result.tesoro.goldCoating.display === "none"
      || !result.tesoro.goldCoating.active
      || !result.tesoro.goldCoating.className.includes("tesoro-gold-river")
      || result.tesoro.goldCoating.level !== "2"
      || result.tesoro.goldCoating.parent !== "playerPortraitWrap"
      || !result.tesoro.goldCoating.art.loaded
      || !result.tesoro.goldCoating.art.url.includes("gold_river_fill_v1.webp")
      || result.tesoro.goldCoating.art.naturalWidth !== 1254
      || result.tesoro.goldCoating.art.naturalHeight !== 1254
      || result.tesoro.goldCoating.fillRatio < 0.64
      || result.tesoro.goldCoating.fillRatio > 0.73) {
      failures.push(`${label}:tesoro:gold river did not render as the fixed second flood stage`);
    }
    const expectedFillRanges = {
      1: [0.31, 0.39],
      2: [0.64, 0.73],
      3: [0.98, 1.08],
    };
    for (const level of [1, 2, 3]) {
      const stage = result.tesoroStages[level]?.goldCoating;
      const [minFill, maxFill] = expectedFillRanges[level];
      if (!stage
        || stage.hidden
        || stage.level !== String(level)
        || stage.parent !== "playerPortraitWrap"
        || stage.fillRatio < minFill
        || stage.fillRatio > maxFill) {
        failures.push(`${label}:tesoro:gold river stage ${level} is not aligned to the portrait frame`);
      }
    }
    if (result.tesoroMotion.attack.portraitAnimation === "none"
      || result.tesoroMotion.attack.coatingTransform !== "none"
      || result.tesoroMotion.attack.portraitParent !== "playerPortraitWrap"
      || result.tesoroMotion.attack.coatingParent !== "playerPortraitWrap") {
      failures.push(`${label}:tesoro:gold river is not fixed to the portrait frame during attack`);
    }
    if (result.tesoroMotion.hit.portraitAnimation === "none"
      || result.tesoroMotion.hit.coatingTransform !== "none"
      || result.tesoroMotion.hit.portraitParent !== "playerPortraitWrap"
      || result.tesoroMotion.hit.coatingParent !== "playerPortraitWrap") {
      failures.push(`${label}:tesoro:gold river is not fixed to the portrait frame during hit`);
    }
    const mechanic = result.tesoroMechanic;
    const firstPhaseDefense = result.tesoroFirstPhaseDefense;
    if (firstPhaseDefense.maxHp !== 3000
      || firstPhaseDefense.hpAfterHeavyHit !== 1600
      || firstPhaseDefense.defStage !== 2
      || firstPhaseDefense.sdefStage !== 2
      || firstPhaseDefense.phase !== 1
      || firstPhaseDefense.pendingPhase !== 0
      || !/防禦、特防各提升 2 階/.test(firstPhaseDefense.passiveText)) {
      failures.push(`${label}:tesoro:first phase did not start at 3000 HP, keep defense and special-defense +2, or survive the 1400-damage probe before transforming`);
    }
    if (mechanic.unaffected.gold !== 0 || mechanic.unaffected.forced) {
      failures.push(`${label}:tesoro:buff or player attack incorrectly changed first-phase flood`);
    }
    if (mechanic.firstHit.gold !== 1 || mechanic.firstHit.forced
      || mechanic.secondHit.gold !== 2 || mechanic.secondHit.forced) {
      failures.push(`${label}:tesoro:first two successful hits did not add exactly one flood stage each`);
    }
    if (mechanic.thirdHit.gold !== 3 || !mechanic.thirdHit.forced
      || !mechanic.thirdHit.needsReplacement || mechanic.thirdHit.result !== "replacement"
      || mechanic.thirdHit.promptType !== "" || mechanic.thirdHit.replacementCandidateCount < 1) {
      failures.push(`${label}:tesoro:third successful hit did not require immediate replacement`);
    }
    if (result.tesoroOrdinaryReplacement.choiceCount < 1
      || result.tesoroOrdinaryReplacement.imageCount !== 0
      || result.tesoroOrdinaryReplacement.specialPromptCount !== 0
      || !/HP/.test(result.tesoroOrdinaryReplacement.text)) {
      failures.push(`${label}:tesoro:three-stage flood did not use the ordinary text-only replacement interface`);
    }
    const lethalThirdHit = result.tesoroLethalThirdHit;
    if (lethalThirdHit.currentHp !== 0 || lethalThirdHit.gold !== 2 || lethalThirdHit.control !== 2
      || lethalThirdHit.forced || lethalThirdHit.needsReplacement
      || lethalThirdHit.result !== "" || lethalThirdHit.replacementReason !== "") {
      failures.push(`${label}:tesoro:lethal third hit incorrectly triggered gold-river replacement`);
    }
    if (lethalThirdHit.normalizedLegacy.forced || !lethalThirdHit.normalizedLegacy.needsReplacement
      || lethalThirdHit.normalizedLegacy.result !== "replacement"
      || lethalThirdHit.normalizedLegacy.replacementReason !== ""
      || lethalThirdHit.normalizedLegacy.pendingReplacementActiveCrewIndex !== 0
      || lethalThirdHit.normalizedLegacy.promptType === "tesoro_forced_switch") {
      failures.push(`${label}:tesoro:lethal legacy snapshot did not normalize to ordinary replacement`);
    }
    if (!mechanic.afterSwitch.switched || mechanic.afterSwitch.activeCrewIndex !== 1
      || mechanic.afterSwitch.outgoingGold !== 0 || mechanic.afterSwitch.outgoingControl !== 0
      || mechanic.afterSwitch.forced || mechanic.afterSwitch.needsReplacement
      || mechanic.afterSwitch.result !== "" || !mechanic.afterSwitch.waitingResume
      || !mechanic.afterSwitch.animating || mechanic.afterSwitch.replacementReason !== "") {
      failures.push(`${label}:tesoro:replacement did not clear flood and hold the new crew until next round`);
    }
    const legacy = result.tesoroLegacy;
    if (legacy.version !== 4 || legacy.gold !== 2 || legacy.control !== 2
      || !legacy.forced || !legacy.viewNeedsReplacement || legacy.viewResult !== "replacement"
      || legacy.replacementReason !== "tesoro-gold"
      || legacy.promptType !== "" || legacy.replacementCandidateCount < 1 || legacy.canAct) {
      failures.push(`${label}:tesoro:legacy first-phase state did not normalize into the three-segment replacement flow`);
    }
    if (!legacy.legacyReplacement.resolved || legacy.legacyReplacement.activeCrewIndex !== 1
      || legacy.legacyReplacement.gold !== 0 || legacy.legacyReplacement.control !== 0
      || legacy.legacyReplacement.forced || legacy.legacyReplacement.needsReplacement
      || legacy.legacyReplacement.result !== "" || legacy.legacyReplacement.replacementReason !== "") {
      failures.push(`${label}:tesoro:legacy flood state could not complete the ordinary replacement command`);
    }
    const migratedGolden = legacy.migratedGolden;
    if (migratedGolden.version !== 4
      || migratedGolden.phase !== 2
      || migratedGolden.pendingPhase !== 0
      || migratedGolden.gold !== 2
      || migratedGolden.control !== 2
      || migratedGolden.giantControl !== 0
      || migratedGolden.giantArmor !== 0
      || migratedGolden.ultimatePending
      || migratedGolden.retainedPercent !== 40
      || !migratedGolden.portrait.includes("postgame_gild_tesoro_golden/normal.webp")
      || migratedGolden.moveIds.length !== 4
      || migratedGolden.moveIds.some((moveId) => !/^postgame_tesoro_(?:golden_|gold_wrath)/.test(moveId))) {
      failures.push(`${label}:tesoro:legacy shared-line or third-phase state did not migrate to Golden Tesoro with personal gold river`);
    }
    const transition = result.tesoroGoldenTransition;
    const transitionCompletedRound = (transition.roundIndex >= 2 && transition.canAct)
      || (transition.result === "round-pause" && transition.roundResolved);
    const goldenMoveIds = new Set([
      "postgame_tesoro_golden_inferno",
      "postgame_tesoro_golden_divine_fire",
      "postgame_tesoro_golden_press",
      "postgame_tesoro_gold_wrath",
    ]);
    if (!transition.queued
      || transition.timedOut
      || transition.phase !== 2
      || transition.pendingPhase !== 0
      || transition.animating
      || !transitionCompletedRound
      || !transition.enemyPortrait.includes("postgame_gild_tesoro_golden/normal.webp")
      || transition.goldenMoveIds.length !== 4
      || transition.goldenMoveIds.some((moveId) => !goldenMoveIds.has(moveId))
      || !transition.staleActionRecovered
      || !transition.goldenEnemyActed
      || transition.preservedGold !== 2
      || transition.goldAfterGoldenHit !== 1
      || transition.goldAfterPlayerHit !== 1
      || transition.retainedDamage !== 40
      || transition.goldenKoPrevented
      || transition.goldenKoHp !== 0
      || transition.giantControl !== 0
      || transition.giantArmor !== 0
      || transition.ultimatePending) {
      failures.push(`${label}:tesoro:Golden Tesoro phase transition remained locked or kept the stale first-phase enemy action`);
    }
    if (result.tesoroGolden.goldCoating.hidden
      || result.tesoroGolden.goldCoating.level !== "2"
      || result.tesoroGolden.goldCoating.parent !== "playerPortraitWrap"
      || result.tesoroGolden.goldCoating.fillRatio < 0.64
      || result.tesoroGolden.goldCoating.fillRatio > 0.73) {
      failures.push(`${label}:tesoro:Golden Tesoro did not keep the same fixed gold-river presentation`);
    }
    if (result.tesoroGoldenDetail.hidden
      || !/第二階段・Golden Tesoro/.test(result.tesoroGoldenDetail.text)
      || !/傷害只保留 40%/.test(result.tesoroGoldenDetail.text)
      || /共用|外殼|黃金戰線/.test(result.tesoroGoldenDetail.text)
      || !result.tesoroGoldenDetail.withinViewport) {
      failures.push(`${label}:tesoro:Golden Tesoro mechanic detail still shows the retired shared-line rules or overflows`);
    }
  }
  if (errors.length) failures.push(...errors);

  console.log(JSON.stringify({ ok: failures.length === 0, failures, errors, results, outputDir: OUTPUT_DIR }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
