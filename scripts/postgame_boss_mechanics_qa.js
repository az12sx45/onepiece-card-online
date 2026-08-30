const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411";

function attachErrorCapture(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`${label}:http:${response.status()}:${response.url()}`);
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED/.test(reason)) errors.push(`${label}:requestfailed:${request.url()}:${reason}`);
  });
}

async function prepareBattle(host, bossKey) {
  return host.evaluate((requestedBossKey) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    if (!player.crew?.length) player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    while (player.crew.length < 6) {
      const source = window.BoardCards.cards[player.crew.length % window.BoardCards.cards.length];
      player.crew.push(debug.cloneCard(source));
    }
    player.crew.slice(0, 6).forEach((card) => { card.battleCarryItem = null; });
    if (requestedBossKey === "postgame_douglas_bullet") {
      const testItems = ["choice_band", "devon_kyubi_mask", "toxic_orb", "flame_orb", "eternal_pose", "vegapunk_mini_shield"];
      player.crew.slice(0, 6).forEach((card, index) => { card.battleCarryItem = testItems[index]; });
    }
    player.crew.forEach((card) => {
      card.currentHp = Math.max(1, Number(card.maxHp || card.stats?.hp || card.baseStats?.hp || card.currentHp || 999));
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "postgame-mechanic-qa" });
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
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    if (requestedBossKey === "postgame_douglas_bullet" && battle.postgameBossMechanic?.slots?.[2]) {
      battle.postgameBossMechanic.slots[2].destroyed = true;
    }
    return {
      bossKey: requestedBossKey,
      islandId: assignment.islandId,
      mechanic: debug.getBattleView()?.battle?.postgameBossMechanic || null,
      enemy: debug.getBattleView()?.battle?.enemy || null,
    };
  }, bossKey);
}

async function inspectBattleUi(battlePage) {
  await battlePage.waitForFunction(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    const trigger = document.querySelector(".boss-mechanic-status-icon");
    return panel?.hidden && trigger && trigger.querySelector("img")?.naturalWidth > 0;
  }, null, { timeout: 10000 });
  const defaultHidden = await battlePage.evaluate(() => document.getElementById("postgameBossMechanicPanel")?.hidden === true);
  await battlePage.evaluate(() => document.querySelector(".boss-mechanic-status-icon")?.click());
  await battlePage.waitForFunction(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    return panel && !panel.hidden && document.getElementById("postgameBossMechanicTitle")?.textContent.trim();
  }, null, { timeout: 10000 });
  await battlePage.waitForTimeout(180);
  return battlePage.evaluate((wasDefaultHidden) => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    const trigger = document.querySelector(".boss-mechanic-status-icon");
    const triggerImage = trigger?.querySelector("img");
    const enemyPortrait = document.getElementById("enemyPortrait");
    const zephyrDynaTarget = document.getElementById("zephyrDynaStoneTarget");
    const zephyrDynaImage = document.getElementById("zephyrDynaStoneTargetImage");
    const images = Array.from(panel.querySelectorAll("img"));
    const watchedText = Array.from(panel.querySelectorAll(".postgame-boss-mechanic-title, .postgame-boss-mechanic-guide-row, .postgame-mechanic-pip, .bullet-slot-die, .bullet-slot-part, .bullet-slot-status, .bullet-slot-copy strong, .bullet-slot-copy small, .postgame-boss-target"));
    const miniSockets = Array.from(trigger?.querySelectorAll(".boss-mechanic-mini-socket") || []).map((socket) => ({
      number: socket.querySelector("small")?.textContent.trim() || "",
      title: socket.getAttribute("title") || "",
      active: socket.classList.contains("is-active"),
      broken: socket.classList.contains("is-broken"),
      empty: socket.classList.contains("is-empty"),
    }));
    const slotCards = Array.from(panel.querySelectorAll("[data-bullet-slot]")).map((slot) => ({
      die: slot.querySelector(".bullet-slot-die")?.textContent.trim() || "",
      part: slot.querySelector(".bullet-slot-part")?.textContent.trim() || "",
      status: slot.querySelector(".bullet-slot-status")?.textContent.trim() || "",
      itemName: slot.querySelector(".bullet-slot-copy strong")?.textContent.trim() || "",
      summary: slot.querySelector(".bullet-slot-copy small")?.textContent.trim() || "",
      image: slot.querySelector("img")?.currentSrc || slot.querySelector("img")?.src || "",
      active: slot.classList.contains("is-active"),
      broken: slot.classList.contains("is-broken"),
      empty: slot.classList.contains("is-empty"),
    }));
    const rect = panel.getBoundingClientRect();
    return {
      defaultHidden: wasDefaultHidden,
      statusIcon: {
        count: document.querySelectorAll(".boss-mechanic-status-icon").length,
        expanded: trigger?.getAttribute("aria-expanded") === "true",
        url: triggerImage?.currentSrc || triggerImage?.src || "",
        width: triggerImage?.naturalWidth || 0,
        height: triggerImage?.naturalHeight || 0,
        miniSockets,
      },
      title: document.getElementById("postgameBossMechanicTitle")?.textContent.trim() || "",
      rule: document.getElementById("postgameBossMechanicRule")?.textContent.trim() || "",
      counter: document.getElementById("postgameBossMechanicCounter")?.textContent.trim() || "",
      stateText: document.getElementById("postgameBossMechanicState")?.innerText.trim() || "",
      slotCards,
      targets: Array.from(document.querySelectorAll("[data-postgame-target]")).map((button) => button.textContent.trim()),
      panelRect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
      panelInsideViewport: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
      textOverflow: watchedText.filter((element) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 3).map((element) => element.textContent.trim()),
      brokenImages: images.filter((image) => !image.complete || image.naturalWidth <= 0).map((image) => image.currentSrc || image.src),
      imageUrls: images.map((image) => ({ url: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight })),
      enemyPortrait: {
        url: enemyPortrait?.currentSrc || enemyPortrait?.src || "",
        width: enemyPortrait?.naturalWidth || 0,
        height: enemyPortrait?.naturalHeight || 0,
      },
      zephyrDynaTarget: {
        visible: !!zephyrDynaTarget && !zephyrDynaTarget.hidden && getComputedStyle(zephyrDynaTarget).display !== "none",
        url: zephyrDynaImage?.currentSrc || zephyrDynaImage?.src || "",
        width: zephyrDynaImage?.naturalWidth || 0,
        height: zephyrDynaImage?.naturalHeight || 0,
      },
    };
  }, defaultHidden);
}

async function prepareSagaFusionVisual(host) {
  await prepareBattle(host, "postgame_saga");
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    mechanic.blood = 74;
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    qa.afterDirectHit("enemy", move, 4, 30, player, battle, { targetId: "boss" });
    const eventIndex = (battle.openingPassiveVisualQueue || []).findIndex((entry) => entry?.type === "postgame-saga-fusion");
    const event = eventIndex >= 0 ? battle.openingPassiveVisualQueue.splice(eventIndex, 1)[0] : null;
    if (!event) return null;
    battle.visualEvent = event;
    battle.openingPassiveVisualAnimating = true;
    battle.animating = true;
    return event;
  });
}

async function inspectSagaFusionVisual(battlePage) {
  await battlePage.waitForFunction(() => document.getElementById("sagaFusionFx")?.classList.contains("show"), null, { timeout: 10000 });
  await battlePage.waitForTimeout(1600);
  const swordVisibleDuringAbsorption = await battlePage.evaluate(() => Number.parseFloat(getComputedStyle(document.getElementById("sagaFusionSword")).opacity || "0"));
  await battlePage.waitForTimeout(2500);
  return battlePage.evaluate((midSwordOpacity) => {
    const overlay = document.getElementById("sagaFusionFx");
    const before = document.getElementById("sagaFusionBefore");
    const final = document.getElementById("sagaFusionFinal");
    const sword = document.getElementById("sagaFusionSword");
    const watched = ["sagaFusionStage", "sagaFusionTitle", "sagaFusionResult", "sagaFusionEffect"]
      .map((id) => document.getElementById(id))
      .filter(Boolean);
    const rect = overlay?.getBoundingClientRect();
    const imageStatus = [before, final, sword].map((image) => ({
      id: image?.id || "",
      url: image?.currentSrc || image?.src || "",
      width: image?.naturalWidth || 0,
      height: image?.naturalHeight || 0,
    }));
    return {
      visible: !!overlay?.classList.contains("show"),
      stage: document.getElementById("sagaFusionStage")?.textContent.trim() || "",
      title: document.getElementById("sagaFusionTitle")?.textContent.trim() || "",
      result: document.getElementById("sagaFusionResult")?.textContent.trim() || "",
      effect: document.getElementById("sagaFusionEffect")?.textContent.trim() || "",
      swordOpacityDuringAbsorption: midSwordOpacity,
      finalOpacity: Number.parseFloat(getComputedStyle(final).opacity || "0"),
      rect: rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, innerWidth, innerHeight } : null,
      insideViewport: !!rect && rect.left >= -3 && rect.right <= innerWidth + 3 && rect.top >= -3 && rect.bottom <= innerHeight + 3,
      textOverflow: watched.filter((element) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 3).map((element) => element.textContent.trim()),
      brokenImages: imageStatus.filter((image) => image.width <= 0 || image.height <= 0),
      images: imageStatus,
    };
  }, swordVisibleDuringAbsorption);
}

async function prepareEncounter(host, bossKey) {
  return host.evaluate((requestedBossKey) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === requestedBossKey);
    if (!assignment) throw new Error(`Missing postgame assignment for ${requestedBossKey}`);
    state.gameState.currentPlayerIndex = 0;
    state.gameState.pendingMove = null;
    state.gameState.movementAnimating = false;
    state.battleState = null;
    player.pendingBattle = null;
    player.location = { kind: "island", islandId: assignment.islandId, entryDirection: null };
    debug.resolveLanding(player);
    return { bossKey: requestedBossKey, islandId: assignment.islandId };
  }, bossKey);
}

async function inspectEncounterUi(host) {
  await host.waitForFunction(() => document.querySelector(".encounter-message.has-mechanic .encounter-mechanic-preview"), null, { timeout: 10000 });
  return host.evaluate(() => {
    const message = document.querySelector(".encounter-message.has-mechanic");
    const mechanic = message?.querySelector(".encounter-mechanic-preview");
    const detail = document.querySelector(".encounter-detail");
    const actions = document.querySelector(".encounter-actions");
    const messageRect = message?.getBoundingClientRect();
    const detailRect = detail?.getBoundingClientRect();
    const actionsRect = actions?.getBoundingClientRect();
    const overlapsVertically = (a, b) => !!a && !!b && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
    const textBlocks = Array.from(message?.querySelectorAll(".encounter-mechanic-preview>strong, .encounter-mechanic-preview p, .encounter-message-copy>strong, .encounter-message-copy p") || []);
    return {
      title: mechanic?.querySelector(":scope>strong")?.innerText.trim() || "",
      rule: mechanic?.querySelector("p:nth-of-type(1) span")?.innerText.trim() || "",
      counter: mechanic?.querySelector("p:nth-of-type(2) span")?.innerText.trim() || "",
      messageDetailOverlap: overlapsVertically(messageRect, detailRect),
      detailActionsOverlap: overlapsVertically(detailRect, actionsRect),
      clippedText: textBlocks.filter((element) => {
        const style = getComputedStyle(element);
        return style.overflow !== "visible" && (element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2);
      }).map((element) => element.innerText.trim()),
    };
  });
}

async function dismissEncounterUi(host) {
  await host.evaluate(() => {
    const modal = document.getElementById("boardModal");
    const backdrop = document.getElementById("boardModalBack");
    if (modal) {
      modal.className = "board-modal";
      modal.innerHTML = "";
    }
    if (backdrop) {
      backdrop.className = "board-modal-backdrop";
      delete backdrop.dataset.forceChoice;
      delete backdrop.dataset.backdropClose;
    }
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const host = await context.newPage();
  attachErrorCapture(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?postgame_mechanic_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });

  const bossKeys = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.activeCrewIndex = 0;
    debug.unlockPostgameWorldAfterEnding(player, { id: "postgame-mechanic-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    return state.gameState.postgameWorld.bossOrder.slice();
  });

  const encounterResults = [];
  for (const bossKey of bossKeys) {
    await prepareEncounter(host, bossKey);
    encounterResults.push({ bossKey, ui: await inspectEncounterUi(host) });
    await dismissEncounterUi(host);
  }
  await prepareEncounter(host, bossKeys[0]);
  await host.screenshot({ path: path.join(OUTPUT_DIR, "postgame_boss_encounter_desktop.png"), fullPage: true });
  await dismissEncounterUi(host);
  await host.setViewportSize({ width: 390, height: 844 });
  await prepareEncounter(host, bossKeys[0]);
  const encounterMobile = await inspectEncounterUi(host);
  await host.screenshot({ path: path.join(OUTPUT_DIR, "postgame_boss_encounter_mobile.png"), fullPage: true });
  await dismissEncounterUi(host);
  await host.setViewportSize({ width: 1600, height: 900 });

  await prepareBattle(host, bossKeys[0]);
  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?postgame_mechanic_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  attachErrorCapture(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");

  const results = [];
  for (const bossKey of bossKeys) {
    const prepared = await prepareBattle(host, bossKey);
    await battlePage.reload({ waitUntil: "domcontentloaded" });
    if (bossKey === "postgame_tot_musica") {
      await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_tot_setup_desktop.png"), fullPage: true });
      await host.evaluate(() => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const state = debug.getState();
        const battle = state.battleState;
        const mechanic = battle.postgameBossMechanic;
        Object.assign(mechanic, {
          assigned: true,
          realIndices: [0, 1, 2],
          songIndices: [3, 4, 5],
          realActiveIndex: 0,
          songActiveIndex: 3,
        });
        battle.activeCrewIndex = 0;
        debug.getBattleView();
      });
      await battlePage.reload({ waitUntil: "domcontentloaded" });
    }
    const ui = await inspectBattleUi(battlePage);
    results.push({ bossKey, prepared, ui });
    if (bossKey === "postgame_douglas_bullet") {
      await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_bullet_mechanic_desktop.png"), fullPage: true });
      await battlePage.locator("#postgameBossMechanicClose").click();
      await battlePage.waitForFunction(() => document.getElementById("postgameBossMechanicPanel")?.hidden === true);
      await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_bullet_normal_portrait_desktop.png"), fullPage: true });
    }
  }

  const sagaFusionEventDesktop = await prepareSagaFusionVisual(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const sagaFusionDesktop = await inspectSagaFusionVisual(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_saga_fusion_animation_desktop.png"), fullPage: true });

  const phaseAssets = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const mechanic = battle.postgameBossMechanic;
    const paths = [];
    const force = (key, values) => {
      mechanic.key = key;
      Object.assign(mechanic, values);
      battle.postgameBossKey = key;
      battle.enemyCombatant.key = key;
      debug.getBattleView();
      const portraits = battle.enemyCombatant.battlePortraits || {};
      paths.push({ key, portrait: portraits.normal || portraits.idle || "" });
    };
    force("postgame_saga", { blood: 75, fused: true });
    force("postgame_zephyr", { version: 3, phase: 2, countdown: 4, countdownTotal: 4, countdownActive: true, disarmProgress: 0, disarmTarget: 3, dynaRockDisarmed: false, detonated: false, seaStoneSkipByCrew: {}, lastMoveByCrew: {} });
    force("postgame_tot_musica", { assigned: true, movement: 1, realIndices: [0, 1, 2], songIndices: [3, 4, 5], realActiveIndex: 0, songActiveIndex: 3 });
    force("postgame_tot_musica", { movement: 2 });
    force("postgame_tot_musica", { movement: 3 });
    force("postgame_douglas_bullet", { slots: [] });
    return paths;
  });
  const phaseAssetStatus = await host.evaluate(async (entries) => Promise.all(entries.map(async (entry) => {
    const url = new URL(entry.portrait, location.href).href;
    const response = await fetch(url);
    return { ...entry, url, status: response.status, ok: response.ok };
  })), phaseAssets);

  const behaviorResults = {};
  const runBehavior = async (key, callbackSource) => {
    await prepareBattle(host, key);
    behaviorResults[key] = await host.evaluate(({ source }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      const player = state.gameState.players[0];
      const qa = debug.postgameBossMechanicQa;
      return Function("debug", "state", "battle", "player", "qa", source)(debug, state, battle, player, qa);
    }, { source: callbackSource });
  };

  await runBehavior("postgame_shiki", `
    const mechanic = battle.postgameBossMechanic;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const target = debug.getBattleView().battle.postgameBossMechanic.targets.find((entry) => entry.id !== "boss");
    const island = mechanic.islands.find((entry) => target.id.endsWith(entry.id));
    const before = island.currentHp;
    const bossDamage = qa.applyDamageRules([100], "player", move, 6, player, battle, { targetId: target.id }).reduce((sum, value) => sum + value, 0);
    return { islandDamage: before - island.currentHp, bossDamage, islandId: island.id, targetId: target.id };
  `);
  await runBehavior("postgame_gild_tesoro", `
    const mechanic = battle.postgameBossMechanic;
    const bind = battle.enemyCombatant.moveSet.find((entry) => entry.id === "postgame_tesoro_gold_bind");
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    const beforeThirdHit = { pending: !!mechanic.forcedSwitch?.pending, gold: mechanic.goldByCrew[player.crew[0].id], needsReplacement: !!battle.needsReplacement };
    qa.afterMove("enemy", bind, 4, true, 50, player, battle);
    const beforeSwitch = { pending: !!mechanic.forcedSwitch?.pending, gold: mechanic.goldByCrew[player.crew[0].id], needsReplacement: !!battle.needsReplacement, result: battle.result };
    const switched = debug.battlePostgameForcedSwitch(1);
    return { beforeThirdHit, beforeSwitch, switched, activeCrewIndex: battle.activeCrewIndex, releasedGold: mechanic.goldByCrew[player.crew[0].id], replacementReason: battle.replacementReason || "" };
  `);
  await runBehavior("postgame_zephyr", `
    const mechanic = battle.postgameBossMechanic;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const countdownBefore = mechanic.countdown;
    qa.roundEnd(player, battle);
    const countdownAfter = mechanic.countdown;
    battle.enemyCombatant.currentHp = Math.round(battle.enemyCombatant.maxHp * 0.5);
    qa.afterDirectHit("player", move, 4, 1, player, battle, { targetId: "boss" });
    const bombAfterHalf = {
      phase: mechanic.phase,
      active: mechanic.countdownActive,
      disarmed: mechanic.dynaRockDisarmed,
      progress: mechanic.disarmProgress,
      canDisarm: debug.getBattleView().battle.postgameBossMechanic.state.canDisarm,
    };
    const firstDisarm = qa.resolveZephyrDisarmRoll(player, battle, 2);
    const secondDisarm = qa.resolveZephyrDisarmRoll(player, battle, 6);
    mechanic.lastMoveByCrew[player.crew[0].id] = move.id;
    const repeatedDamage = qa.applyDamageRules([100], "player", move, 4, player, battle, { targetId: "boss" });
    return {
      countdownBefore,
      countdownAfter,
      maxHp: battle.enemyCombatant.maxHp,
      bombAfterHalf,
      firstDisarm,
      secondDisarm,
      disarmProgress: mechanic.disarmProgress,
      disarmed: mechanic.dynaRockDisarmed,
      countdownActive: mechanic.countdownActive,
      phase: mechanic.phase,
      repeatedDamage,
      portrait: battle.enemyCombatant.battlePortraits.normal,
      enemyName: battle.enemyCombatant.name,
    };
  `);
  await runBehavior("postgame_tot_musica", `
    const accepted = debug.battleTotTeamSetup([0, 1, 2]);
    const mechanic = battle.postgameBossMechanic;
    return { accepted, assigned: mechanic.assigned, real: mechanic.realIndices.length, song: mechanic.songIndices.length };
  `);
  await runBehavior("postgame_douglas_bullet", `
    const mechanic = battle.postgameBossMechanic;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    Object.assign(mechanic.slots[0], { itemId: "choice_band", itemName: "講究頭帶", destroyed: false });
    qa.afterDirectHit("player", move, 1, 50, player, battle, { targetId: "boss" });
    return {
      destroyedByDieOne: mechanic.slots[0].destroyed,
      intactSlots: mechanic.slots.filter((slot) => !slot.destroyed).length,
      portrait: battle.enemyCombatant.battlePortraits.normal,
    };
  `);
  await runBehavior("postgame_saga", `
    const mechanic = battle.postgameBossMechanic;
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    qa.afterDirectHit("enemy", move, 4, 30, player, battle, { targetId: "boss" });
    mechanic.blood = 74;
    qa.afterDirectHit("enemy", move, 4, 30, player, battle, { targetId: "boss" });
    const fusionEvent = (battle.openingPassiveVisualQueue || []).find((entry) => entry?.type === "postgame-saga-fusion");
    return {
      blood: mechanic.blood,
      fused: mechanic.fused,
      portrait: battle.enemyCombatant.battlePortraits.normal,
      fusionEvent: fusionEvent ? {
        type: fusionEvent.type,
        beforePortrait: fusionEvent.beforePortrait,
        finalPortrait: fusionEvent.finalPortrait,
        swordImage: fusionEvent.swordImage,
        duration: fusionEvent.duration,
        title: fusionEvent.title,
        fusionText: fusionEvent.fusionText,
        resultText: fusionEvent.resultText,
        effectText: fusionEvent.effectText,
      } : null,
    };
  `);
  await runBehavior("postgame_vinsmoke_judge", `
    const mechanic = battle.postgameBossMechanic;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const bossMeta = {};
    const combo = qa.applyDamageRules([100, 110, 120, 130], "player", move, 6, player, battle, { targetId: "boss" }, bossMeta);
    const afterCombo = mechanic.clones;
    mechanic.clones = 2;
    const targetMeta = {};
    const targeted = qa.applyDamageRules([50, 60, 70], "player", move, 1, player, battle, { targetId: "judge_clone" }, targetMeta);
    return {
      afterCombo,
      combo,
      comboBlocks: bossMeta.judgeCloneBlocks,
      clones: mechanic.clones,
      targeted,
      targetedBlocks: targetMeta.judgeCloneBlocks,
    };
  `);
  await runBehavior("postgame_rob_lucci_awakened", `
    const mechanic = battle.postgameBossMechanic;
    mechanic.nodes = [];
    mechanic.activePower = "";
    mechanic.activePowerId = "";
    mechanic.activePowerStat = "";
    mechanic.activePowerRound = 0;
    mechanic.rokuoganPending = false;
    const selections = [];
    const cycleActions = [];
    const timing = [];
    const boosts = [];
    let evasionHitChance = null;
    let action = null;
    let ultimate = null;
    let guaranteed = null;
    let beforeReset = null;
    for (let round = 1; round <= 6; round += 1) {
      battle.roundIndex = round;
      battle.playerAction = null;
      battle.enemyAction = null;
      battle.playerPerformedAction = false;
      const beforeRoundStartCount = mechanic.nodes.length;
      const playerHpBeforeDraw = Number(player.crew?.[battle.activeCrewIndex]?.currentHp || 0);
      qa.roundStart(player, battle);
      const afterRoundStartCount = mechanic.nodes.length;
      const playerHpAfterDraw = Number(player.crew?.[battle.activeCrewIndex]?.currentHp || 0);
      const cycleAction = qa.chooseEnemyAction(battle);
      const selected = qa.activeLucciPower(battle);
      selections.push(selected?.name || "");
      cycleActions.push(cycleAction?.moveId || "");
      timing.push({
        round,
        beforeRoundStartCount,
        afterRoundStartCount,
        afterEnemySelectionCount: mechanic.nodes.length,
        beforePlayerAction: battle.playerAction === null && !battle.playerPerformedAction,
        playerHpBeforeDraw,
        playerHpAfterDraw,
      });
      if (selected?.stat === "evasion") {
        evasionHitChance = qa.moveHitChance("player", { id: "qa-lucci-hit", name: "測試攻擊", category: "attack", accuracy: 100 }, player, battle);
      } else if (selected?.stat) {
        boosts.push({ stat: selected.stat, value: qa.enemyStat(100, selected.stat, player, battle) });
      }
      if (round === 6) {
        action = cycleAction;
        ultimate = battle.enemyCombatant.moveSet.find((entry) => entry.id === action.moveId);
        battle.playerStages.evasion = 6;
        guaranteed = qa.moveHits("enemy", ultimate, player, battle);
        beforeReset = { nodes: mechanic.nodes.length, rokuoganPending: mechanic.rokuoganPending };
        qa.afterMove("enemy", ultimate, 1, true, 100, player, battle);
      }
    }
    return {
      selections,
      cycleActions,
      timing,
      uniqueCount: new Set(selections).size,
      boosts,
      evasionHitChance,
      beforeReset,
      action,
      ultimatePower: ultimate?.power,
      ignoreDefenseRatio: ultimate?.effects?.ignoreDefenseRatio,
      guaranteed,
      afterReset: { nodes: mechanic.nodes.length, rokuoganPending: mechanic.rokuoganPending },
    };
  `);
  await runBehavior("postgame_king", `
    const mechanic = battle.postgameBossMechanic;
    const kingMove = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0) || battle.enemyCombatant.moveSet[0];
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const damage = () => qa.applyDamageRules([100], "player", move, 4, player, battle, { targetId: "boss" }).reduce((a, b) => a + b, 0);
    const openingDamage = damage();
    qa.afterMove("enemy", kingMove, 9, true, 40, player, battle, 2);
    const evenDelayed = mechanic.flameOn === true && mechanic.pendingFlameOn === false;
    battle.roundIndex += 1;
    qa.roundStart(player, battle);
    const evenFlameOn = mechanic.flameOn;
    const evenDamage = damage();
    qa.afterMove("enemy", kingMove, 8, true, 40, player, battle, 3);
    const oddDelayed = mechanic.flameOn === false && mechanic.pendingFlameOn === true;
    battle.roundIndex += 1;
    qa.roundStart(player, battle);
    const oddDamage = damage();
    return { openingDamage, evenDelayed, evenFlameOn, evenDamage, oddDelayed, oddFlameOn: mechanic.flameOn, oddDamage };
  `);
  await runBehavior("postgame_charlotte_katakuri", `
    const mechanic = battle.postgameBossMechanic;
    const actionKey = qa.katakuriActionKey(player, battle);
    mechanic.forecastDie = 5;
    mechanic.forecastActionKey = actionKey;
    mechanic.choiceMode = "defend";
    mechanic.defenseDie = 4;
    mechanic.defenseReduction = .6;
    mechanic.defenseActionKey = actionKey;
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    const visualMeta = {};
    const reducedDamage = qa.applyDamageRules([100], "enemy", move, 4, player, battle, {}, visualMeta).reduce((a, b) => a + b, 0);
    return {
      version: mechanic.version,
      forecastDie: mechanic.forecastDie,
      defenseDie: mechanic.defenseDie,
      defenseReduction: mechanic.defenseReduction,
      reducedDamage,
      visualMeta,
      legacyRemoved: mechanic.calm === undefined && mechanic.predictions === undefined && mechanic.futureDisabledActions === undefined,
    };
  `);
  await runBehavior("postgame_patrick_redfield", `
    const mechanic = battle.postgameBossMechanic;
    battle.enemyCombatant.currentHp = Math.round(battle.enemyCombatant.maxHp / 2);
    const before = player.crew.map((card) => card.currentHp);
    const move = battle.enemyCombatant.moveSet.find((entry) => Number(entry.power || 0) > 0);
    qa.afterDirectHit("enemy", move, 6, 20, player, battle, { targetId: "boss" });
    return { percent: mechanic.lastDrainPercent, total: mechanic.lastDrainTotal, allLostHp: player.crew.every((card, index) => card.currentHp < before[index]) };
  `);
  await runBehavior("postgame_aramaki", `
    const mechanic = battle.postgameBossMechanic;
    mechanic.groves = 4;
    battle.enemyCombatant.currentHp = 0;
    const prevented = qa.preventEnemyKnockout(player, battle);
    return { prevented, revived: mechanic.revived, groves: mechanic.groves, hp: battle.enemyCombatant.currentHp, maxHp: battle.enemyCombatant.maxHp };
  `);

  await battlePage.setViewportSize({ width: 900, height: 600 });
  await prepareBattle(host, "postgame_douglas_bullet");
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const bulletMobile = await inspectBattleUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_bullet_mechanic_mobile.png"), fullPage: true });
  await prepareBattle(host, "postgame_patrick_redfield");
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const mobile = await inspectBattleUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_redfield_mechanic_mobile.png"), fullPage: true });
  const sagaFusionEventMobile = await prepareSagaFusionVisual(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const sagaFusionMobile = await inspectSagaFusionVisual(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "postgame_saga_fusion_animation_mobile.png"), fullPage: true });

  const failures = [];
  for (const result of encounterResults) {
    if (!result.ui.title || !result.ui.rule || !result.ui.counter) failures.push(`${result.bossKey}: encounter mechanism explanation incomplete`);
    if (result.ui.messageDetailOverlap || result.ui.detailActionsOverlap) failures.push(`${result.bossKey}: encounter sections overlap`);
    if (result.ui.clippedText.length) failures.push(`${result.bossKey}: encounter text clipped ${result.ui.clippedText.join(" / ")}`);
  }
  if (encounterMobile.messageDetailOverlap || encounterMobile.detailActionsOverlap) failures.push("mobile: encounter sections overlap");
  for (const result of results) {
    if (!result.prepared.mechanic) failures.push(`${result.bossKey}: missing mechanic view`);
    if (!result.ui.defaultHidden) failures.push(`${result.bossKey}: mechanic detail was visible before status icon click`);
    if (result.ui.statusIcon.count !== 1 || !result.ui.statusIcon.expanded || result.ui.statusIcon.width <= 0) failures.push(`${result.bossKey}: status icon missing or not interactive`);
    if (!result.ui.title) failures.push(`${result.bossKey}: missing UI title`);
    if (!result.ui.rule) failures.push(`${result.bossKey}: missing mechanism explanation`);
    if (!result.ui.counter) failures.push(`${result.bossKey}: missing player counter explanation`);
    if (!result.ui.panelInsideViewport) failures.push(`${result.bossKey}: desktop panel outside viewport`);
    if (result.ui.textOverflow.length) failures.push(`${result.bossKey}: text overflow ${result.ui.textOverflow.join(" / ")}`);
    if (result.ui.brokenImages.length) failures.push(`${result.bossKey}: broken images ${result.ui.brokenImages.join(" / ")}`);
    if (result.bossKey === "postgame_zephyr") {
      if (!result.ui.zephyrDynaTarget.visible || result.ui.zephyrDynaTarget.width <= 0 || !/dyna_stone_cylinder_v2\.webp/.test(result.ui.zephyrDynaTarget.url)) failures.push(`${result.bossKey}: battlefield Dyna Stone target missing ${JSON.stringify(result.ui.zephyrDynaTarget)}`);
    } else if (result.ui.zephyrDynaTarget.visible) {
      failures.push(`${result.bossKey}: Zephyr battlefield Dyna Stone leaked into another boss`);
    }
    if (result.bossKey === "postgame_douglas_bullet"
      && (!/postgame_douglas_bullet\/normal\.webp/.test(result.ui.enemyPortrait.url) || /fusion_normal/.test(result.ui.enemyPortrait.url))) {
      failures.push(`${result.bossKey}: formal enemy card is not using the normal battle portrait ${result.ui.enemyPortrait.url}`);
    }
    if (result.bossKey === "postgame_douglas_bullet") {
      const expectedDice = ["骰 1", "骰 2", "骰 3", "骰 4", "骰 5", "骰 6"];
      const expectedParts = ["頭部裝甲", "胸部裝甲", "左手裝甲", "右手裝甲", "左腳裝甲", "右腳裝甲"];
      if (!/postgame_douglas_bullet_super_fusion_v2\.webp/.test(result.ui.statusIcon.url)) failures.push(`${result.bossKey}: status icon is not the rabbit-eared super fusion image ${result.ui.statusIcon.url}`);
      if (result.ui.slotCards.length !== 6) failures.push(`${result.bossKey}: expected six detailed equipment slots, got ${result.ui.slotCards.length}`);
      if (result.ui.slotCards.map((slot) => slot.die).join("|") !== expectedDice.join("|")) failures.push(`${result.bossKey}: dice labels are incomplete`);
      if (result.ui.slotCards.map((slot) => slot.part).join("|") !== expectedParts.join("|")) failures.push(`${result.bossKey}: armor part labels are incomplete`);
      if (result.ui.slotCards.some((slot) => !slot.itemName || !slot.summary || !slot.image)) failures.push(`${result.bossKey}: absorbed item name, effect, or image missing`);
      if (!result.ui.slotCards.some((slot) => slot.broken && /已破壞/.test(slot.status))) failures.push(`${result.bossKey}: destroyed slot is not visibly marked`);
      if (!result.ui.slotCards.some((slot) => slot.active && /接管中/.test(slot.status))) failures.push(`${result.bossKey}: active slot is not visibly marked`);
      if (result.ui.statusIcon.miniSockets.length !== 6 || !result.ui.statusIcon.miniSockets.some((slot) => slot.broken)) failures.push(`${result.bossKey}: compact status icon does not show six sockets and destruction`);
    }
  }
  for (const asset of phaseAssetStatus) if (!asset.ok) failures.push(`${asset.key}: phase image ${asset.status} ${asset.url}`);
  const behaviorChecks = {
    postgame_shiki: (value) => value.islandDamage === 100 && value.bossDamage === 25 && value.targetId.endsWith(value.islandId),
    postgame_gild_tesoro: (value) => value.beforeThirdHit.gold === 2
      && !value.beforeThirdHit.pending
      && !value.beforeThirdHit.needsReplacement
      && value.beforeSwitch.gold === 3
      && value.beforeSwitch.pending
      && value.beforeSwitch.needsReplacement
      && value.beforeSwitch.result === "replacement"
      && value.switched
      && value.activeCrewIndex === 1
      && value.releasedGold === 0
      && value.replacementReason === "",
    postgame_zephyr: (value) => value.countdownBefore === 4
      && value.countdownAfter === 3
      && value.maxHp === 2000
      && value.bombAfterHalf?.phase === 2
      && value.bombAfterHalf?.active
      && !value.bombAfterHalf?.disarmed
      && value.bombAfterHalf?.progress === 0
      && value.bombAfterHalf?.canDisarm
      && value.firstDisarm?.gain === 1
      && value.secondDisarm?.gain === 2
      && value.disarmProgress === 3
      && value.disarmed
      && !value.countdownActive
      && value.phase === 2
      && JSON.stringify(value.repeatedDamage) === JSON.stringify([65])
      && /black_arm_normal/.test(value.portrait)
      && value.enemyName === "澤法",
    postgame_tot_musica: (value) => value.accepted && value.assigned && value.real === 3 && value.song === 3,
    postgame_douglas_bullet: (value) => value.destroyedByDieOne
      && /postgame_douglas_bullet\/normal\.webp/.test(value.portrait)
      && !/fusion_normal/.test(value.portrait),
    postgame_saga: (value) => value.blood === 75
      && value.fused
      && /fused_normal/.test(value.portrait)
      && value.fusionEvent?.type === "postgame-saga-fusion"
      && /postgame_saga\/normal/.test(value.fusionEvent.beforePortrait)
      && /fused_normal/.test(value.fusionEvent.finalPortrait)
      && /saga_seven_star_sword/.test(value.fusionEvent.swordImage)
      && value.fusionEvent.duration >= 6000,
    postgame_vinsmoke_judge: (value) => value.afterCombo === 0
      && JSON.stringify(value.combo) === JSON.stringify([0, 0, 0, 130])
      && JSON.stringify(value.comboBlocks) === JSON.stringify([true, true, true, false])
      && value.clones === 0
      && JSON.stringify(value.targeted) === JSON.stringify([0, 0, 0])
      && JSON.stringify(value.targetedBlocks) === JSON.stringify([true, true, false]),
    postgame_rob_lucci_awakened: (value) => value.selections?.length === 6
      && value.uniqueCount === 6
      && !value.cycleActions?.slice(0, 5).some((moveId) => moveId === "postgame_lucci_ultimate_rokuogan")
      && value.cycleActions?.[5] === "postgame_lucci_ultimate_rokuogan"
      && value.timing?.every((entry) => entry.beforePlayerAction && entry.afterRoundStartCount === entry.beforeRoundStartCount + 1 && entry.afterEnemySelectionCount === entry.afterRoundStartCount && entry.playerHpAfterDraw === entry.playerHpBeforeDraw)
      && value.boosts?.every((entry) => entry.value === 180)
      && value.evasionHitChance >= 55 && value.evasionHitChance <= 60
      && value.beforeReset?.nodes === 6 && value.beforeReset?.rokuoganPending
      && value.action?.moveId === "postgame_lucci_ultimate_rokuogan"
      && value.ultimatePower === 480
      && value.ignoreDefenseRatio === 0.5
      && value.guaranteed?.hit && value.guaranteed?.chance === 100
      && value.afterReset?.nodes === 0 && !value.afterReset?.rokuoganPending,
    postgame_king: (value) => value.openingDamage === 10
      && value.evenDelayed && value.evenFlameOn === false && value.evenDamage === 100
      && value.oddDelayed && value.oddFlameOn === true && value.oddDamage === 10,
    postgame_charlotte_katakuri: (value) => value.version === 2
      && value.forecastDie === 5
      && value.defenseDie === 4
      && value.defenseReduction === .6
      && value.reducedDamage === 40
      && value.visualMeta?.katakuriDefenseActive
      && value.visualMeta?.katakuriDefensePercent === 60
      && value.legacyRemoved,
    postgame_patrick_redfield: (value) => value.percent === 6 && value.total > 0 && value.allLostHp,
    postgame_aramaki: (value) => value.prevented && value.revived && value.groves === 0 && value.hp === Math.round(value.maxHp * .4),
  };
  Object.entries(behaviorChecks).forEach(([key, check]) => {
    if (!check(behaviorResults[key] || {})) failures.push(`${key}: behavior check failed ${JSON.stringify(behaviorResults[key] || {})}`);
  });
  if (!mobile.panelInsideViewport) failures.push("mobile: panel outside viewport");
  if (mobile.textOverflow.length) failures.push(`mobile: text overflow ${mobile.textOverflow.join(" / ")}`);
  if (!bulletMobile.panelInsideViewport) failures.push("bullet mobile: panel outside viewport");
  if (bulletMobile.textOverflow.length) failures.push(`bullet mobile: text overflow ${bulletMobile.textOverflow.join(" / ")}`);
  if (bulletMobile.slotCards.length !== 6 || bulletMobile.brokenImages.length) failures.push("bullet mobile: six-slot panel or item images incomplete");
  for (const [label, event, visual] of [
    ["desktop", sagaFusionEventDesktop, sagaFusionDesktop],
    ["mobile", sagaFusionEventMobile, sagaFusionMobile],
  ]) {
    if (!event || event.type !== "postgame-saga-fusion") failures.push(`saga fusion ${label}: visual event missing`);
    if (!visual.visible || visual.finalOpacity <= 0) failures.push(`saga fusion ${label}: final form was not visible`);
    if (visual.swordOpacityDuringAbsorption <= 0) failures.push(`saga fusion ${label}: Seven Star Sword was not visible during absorption`);
    if (!visual.stage || !visual.title || !visual.result || !visual.effect) failures.push(`saga fusion ${label}: animation text incomplete`);
    if (!visual.insideViewport) failures.push(`saga fusion ${label}: overlay outside viewport`);
    if (visual.textOverflow.length) failures.push(`saga fusion ${label}: text overflow ${visual.textOverflow.join(" / ")}`);
    if (visual.brokenImages.length) failures.push(`saga fusion ${label}: broken images ${visual.brokenImages.map((image) => image.id).join(" / ")}`);
  }

  const sagaFusion = {
    desktop: { event: sagaFusionEventDesktop, visual: sagaFusionDesktop },
    mobile: { event: sagaFusionEventMobile, visual: sagaFusionMobile },
  };
  const report = { bossCount: results.length, results, encounterResults, encounterMobile, phaseAssetStatus, sagaFusion, bulletMobile, mobile, errors, failures };
  const output = process.env.BOARD_QA_COMPACT
    ? {
        bossCount: report.bossCount,
        bosses: report.results.map((entry) => ({
          key: entry.bossKey,
          defaultHidden: entry.ui.defaultHidden,
          statusIcon: entry.ui.statusIcon,
          title: entry.ui.title,
          panelInsideViewport: entry.ui.panelInsideViewport,
          textOverflow: entry.ui.textOverflow,
          brokenImages: entry.ui.brokenImages,
        })),
        phaseAssetStatus: report.phaseAssetStatus,
        encounterResults: report.encounterResults,
        encounterMobile: report.encounterMobile,
        behaviorResults,
        sagaFusion: report.sagaFusion,
        bulletMobile: {
          title: report.bulletMobile.title,
          panelInsideViewport: report.bulletMobile.panelInsideViewport,
          textOverflow: report.bulletMobile.textOverflow,
          brokenImages: report.bulletMobile.brokenImages,
          slotCards: report.bulletMobile.slotCards,
        },
        mobile: {
          title: report.mobile.title,
          panelInsideViewport: report.mobile.panelInsideViewport,
          textOverflow: report.mobile.textOverflow,
          brokenImages: report.mobile.brokenImages,
        },
        errors: report.errors,
        failures: report.failures,
      }
    : report;
  console.log(JSON.stringify(output, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
