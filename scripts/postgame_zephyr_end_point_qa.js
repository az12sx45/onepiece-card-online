const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("tmp/postgame_zephyr_end_point_qa");

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`${label}:http:${response.status()}:${response.url()}`);
  });
}

async function prepareZephyrBattle(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.crew.forEach((card) => {
      card.currentHp = Math.max(1, Number(card.maxHp || card.stats?.hp || card.baseStats?.hp || card.currentHp || 999));
      card.battleCarryItem = null;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "zephyr-end-point-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_zephyr");
    if (!assignment) throw new Error("Missing postgame Zephyr assignment");
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
    return debug.getBattleView();
  });
}

async function waitForZephyrBattle(page, expectFieldTarget = true) {
  await page.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle?.postgameBossMechanic?.key === "postgame_zephyr", null, { timeout: 15000 });
  await page.waitForFunction((shouldShowTarget) => {
    const target = document.getElementById("zephyrDynaStoneTarget");
    return document.querySelectorAll(".zephyr-end-point-card").length === 3
      && (!shouldShowTarget || (target && !target.hidden));
  }, expectFieldTarget, { timeout: 10000 });
  await page.waitForTimeout(160);
}

async function inspectUi(page) {
  return page.evaluate(() => {
    const stateNode = document.getElementById("postgameBossMechanicState");
    const endpointAction = stateNode?.querySelector("[data-zephyr-disarm]");
    const fieldTarget = document.getElementById("zephyrDynaStoneTarget");
    const fieldTargetImage = document.getElementById("zephyrDynaStoneTargetImage");
    const fieldTargetRect = !fieldTarget?.hidden ? fieldTarget?.getBoundingClientRect() : null;
    const enemyRect = document.getElementById("enemyCard")?.getBoundingClientRect();
    const actionGrid = document.querySelector(".battle-action-grid");
    const actionButtons = Array.from(actionGrid?.querySelectorAll(":scope > .action-button") || []);
    const actionGridStyle = actionGrid ? getComputedStyle(actionGrid) : null;
    const images = Array.from(document.querySelectorAll(".zephyr-end-point-card img"));
    const textNodes = Array.from(document.querySelectorAll(".zephyr-end-point-card strong, .zephyr-end-point-card small, .postgame-boss-mechanic-guide-row span, .action-label, .zephyr-dyna-stone-target-copy strong, .zephyr-dyna-stone-target-copy small"));
    return {
      viewport: { width: innerWidth, height: innerHeight },
      title: document.getElementById("postgameBossMechanicTitle")?.textContent.trim() || "",
      stateText: stateNode?.innerText.trim() || "",
      endpointCards: document.querySelectorAll(".zephyr-end-point-card").length,
      dynaImages: images.map((image) => ({ src: image.currentSrc || image.src, width: image.naturalWidth, height: image.naturalHeight, complete: image.complete })),
      endpointAction: {
        exists: !!endpointAction,
        role: endpointAction?.getAttribute("role") || "",
        label: endpointAction?.getAttribute("aria-label") || "",
        text: endpointAction?.textContent.trim() || "",
      },
      fieldTarget: {
        exists: !!fieldTarget && !fieldTarget.hidden,
        tagName: fieldTarget?.tagName || "",
        disabled: !!fieldTarget?.disabled,
        label: fieldTarget?.getAttribute("aria-label") || "",
        text: fieldTarget?.textContent.trim() || "",
        image: {
          src: fieldTargetImage?.currentSrc || fieldTargetImage?.src || "",
          width: fieldTargetImage?.naturalWidth || 0,
          height: fieldTargetImage?.naturalHeight || 0,
          complete: !!fieldTargetImage?.complete,
        },
        overlapsEnemyLeftEdge: !!fieldTargetRect && !!enemyRect && fieldTargetRect.left < enemyRect.left && fieldTargetRect.right > enemyRect.left,
        insideViewport: !!fieldTargetRect && fieldTargetRect.left >= -1 && fieldTargetRect.right <= innerWidth + 1 && fieldTargetRect.top >= -1 && fieldTargetRect.bottom <= innerHeight + 1,
      },
      actionGrid: {
        count: actionButtons.length,
        modes: actionButtons.map((button) => button.dataset.mode || ""),
        columns: actionGridStyle?.gridTemplateColumns || "",
        rows: actionGridStyle?.gridTemplateRows || "",
        hasZephyrClass: !!actionGrid?.classList.contains("has-zephyr-action"),
      },
      pageOverflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
      textOverflow: textNodes.filter((node) => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 3).map((node) => node.textContent.trim()),
      enemyPortrait: document.getElementById("enemyPortrait")?.currentSrc || document.getElementById("enemyPortrait")?.src || "",
    };
  });
}

async function playExplosionStory(page, label) {
  const expectedTitles = ["倒數歸零", "引爆", "終結點崩壞", "連鎖反應", "新世界陷落"];
  await page.waitForFunction(() => {
    const debug = window.__BOARD_BATTLE_DEBUG__;
    const overlay = document.getElementById("zephyrExplosionStory");
    return debug?.zephyrExplosionStoryState?.().visible && overlay && !overlay.hidden;
  }, null, { timeout: 10000 });
  const frames = [];
  for (let index = 0; index < expectedTitles.length; index += 1) {
    await page.waitForFunction((title) => document.getElementById("zephyrExplosionStoryTitle")?.textContent === title, expectedTitles[index], { timeout: 5000 });
    await page.waitForFunction(() => {
      const image = document.getElementById("zephyrExplosionStoryImage");
      return image?.complete && image.naturalWidth > 0;
    }, null, { timeout: 5000 });
    frames.push(await page.evaluate(() => {
      const overlay = document.getElementById("zephyrExplosionStory");
      const image = document.getElementById("zephyrExplosionStoryImage");
      const copy = overlay.querySelector(".zephyr-explosion-story-copy");
      const overlayRect = overlay.getBoundingClientRect();
      const copyRect = copy.getBoundingClientRect();
      const view = window.__BOARD_BATTLE_DEBUG__.latestView();
      return {
        title: document.getElementById("zephyrExplosionStoryTitle")?.textContent || "",
        image: image.currentSrc || image.src || "",
        natural: [image.naturalWidth, image.naturalHeight],
        activeDots: overlay.querySelectorAll(".zephyr-explosion-story-progress .active").length,
        copyInside: copyRect.left >= overlayRect.left - 1 && copyRect.right <= overlayRect.right + 1 && copyRect.top >= overlayRect.top - 1 && copyRect.bottom <= overlayRect.bottom + 1,
        pageOverflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
        resultBeforeStoryEnd: view?.battle?.result || "",
        activeCrewHpBeforeStoryEnd: Number(view?.activeCard?.currentHp || 0),
      };
    }));
    if (index === 0 || index === expectedTitles.length - 1) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}_story_scene_${String(index + 1).padStart(2, "0")}.png`), fullPage: true });
    }
    await page.locator("#zephyrExplosionStory").click({ force: true });
    if (index < expectedTitles.length - 1) await page.waitForTimeout(340);
  }
  return frames;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?postgame_zephyr_end_point_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });

  const initialView = await prepareZephyrBattle(host);
  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?postgame_zephyr_end_point_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");
  await waitForZephyrBattle(battlePage);
  const desktop = await inspectUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "zephyr_field_target_desktop.png"), fullPage: true });
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    window.__zephyrPanelActionCalls = 0;
    window.__zephyrPanelActionOriginal = debug.battleZephyrDisarm;
    debug.battleZephyrDisarm = () => {
      window.__zephyrPanelActionCalls += 1;
      return true;
    };
  });
  await battlePage.evaluate(() => {
    const view = window.__BOARD_BATTLE_DEBUG__.latestView();
    view.battle.canControl = true;
    view.battle.canAct = true;
    document.getElementById("zephyrDynaStoneTarget").disabled = false;
  });
  await battlePage.locator("#zephyrDynaStoneTarget").click({ force: true });
  const fieldActionRoute = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const calls = Number(window.__zephyrPanelActionCalls || 0);
    debug.battleZephyrDisarm = window.__zephyrPanelActionOriginal;
    delete window.__zephyrPanelActionOriginal;
    delete window.__zephyrPanelActionCalls;
    return {
      calls,
    };
  });
  await prepareZephyrBattle(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  await waitForZephyrBattle(battlePage);

  const disarmResult = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const qa = debug.postgameBossMechanicQa;
    const phaseMove = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    battle.enemyCombatant.currentHp = Math.round(battle.enemyCombatant.maxHp * 0.5);
    qa.afterDirectHit("player", phaseMove, 4, 1, player, battle, { targetId: "boss" });
    const first = qa.resolveZephyrDisarmRoll(player, battle, 2);
    const second = qa.resolveZephyrDisarmRoll(player, battle, 6);
    const mechanic = battle.postgameBossMechanic;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    mechanic.lastMoveByCrew[player.crew[0].id] = move.id;
    const repeatedDamage = qa.applyDamageRules([100], "player", move, 4, player, battle, { targetId: "boss" });
    return {
      first,
      second,
      progress: mechanic.disarmProgress,
      disarmed: mechanic.dynaRockDisarmed,
      countdownActive: mechanic.countdownActive,
      phase: mechanic.phase,
      portrait: battle.enemyCombatant.battlePortraits.normal,
      repeatedDamage,
    };
  });
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  await waitForZephyrBattle(battlePage, false);
  const disarmedUi = await inspectUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "zephyr_disarmed_black_arm_desktop.png"), fullPage: true });

  await prepareZephyrBattle(host);
  const countdownPromise = host.evaluate(async () => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    battle.enemyCombatant.currentHp = Math.round(battle.enemyCombatant.maxHp * 0.5);
    debug.postgameBossMechanicQa.afterDirectHit("player", move, 4, 1, player, battle, { targetId: "boss" });
    for (let index = 0; index < 4; index += 1) await debug.postgameBossMechanicQa.roundEnd(player, battle);
    return {
      phase: battle.postgameBossMechanic.phase,
      countdown: battle.postgameBossMechanic.countdown,
      active: battle.postgameBossMechanic.countdownActive,
      detonated: battle.postgameBossMechanic.detonated,
      result: battle.result,
      log: battle.log.slice(-1)[0] || "",
      crewHp: player.crew.map((card) => Number(card.currentHp || 0)),
      knockedOutCrew: battle.knockedOutCrew.slice(),
    };
  });
  const desktopStory = await playExplosionStory(battlePage, "zephyr_explosion_desktop");
  const countdownResult = await countdownPromise;
  await battlePage.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle?.result === "lose", null, { timeout: 5000 });
  const desktopStoryResult = await battlePage.evaluate(() => ({
    overlayHidden: document.getElementById("zephyrExplosionStory")?.hidden,
    resultText: document.getElementById("infoContent")?.innerText || "",
    storyState: window.__BOARD_BATTLE_DEBUG__?.zephyrExplosionStoryState?.() || null,
  }));
  await battlePage.locator("[data-finish-battle]").click();
  await host.waitForFunction(() => !window.__BOARD_GAME_DEBUG__.getState().battleState, null, { timeout: 5000 });
  const desktopWipeoutSettlement = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getState().gameState.players[0];
    return {
      battleCleared: !debug.getState().battleState,
      impelDownActive: !!player.impelDown?.active,
      capturedReason: player.impelDown?.capturedReason || "",
      crewHp: player.crew.map((card) => Number(card.currentHp || 0)),
    };
  });

  await prepareZephyrBattle(host);
  const halfHpResult = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const adjustedDamage = debug.postgameBossMechanicQa.applyDamageRules([2500], "player", move, 4, player, battle, { targetId: "boss" });
    const actualDamage = adjustedDamage.reduce((sum, value) => sum + Number(value || 0), 0);
    battle.enemyCombatant.currentHp = Math.max(0, battle.enemyCombatant.currentHp - actualDamage);
    debug.postgameBossMechanicQa.afterDirectHit("player", move, 4, actualDamage, player, battle, { targetId: "boss" });
    return {
      maxHp: battle.enemyCombatant.maxHp,
      currentHp: battle.enemyCombatant.currentHp,
      adjustedDamage,
      phase: battle.postgameBossMechanic.phase,
      portrait: battle.enemyCombatant.battlePortraits.normal,
      countdownActive: battle.postgameBossMechanic.countdownActive,
      disarmed: battle.postgameBossMechanic.dynaRockDisarmed,
      progress: battle.postgameBossMechanic.disarmProgress,
      canDisarm: debug.getBattleView().battle.postgameBossMechanic.state.canDisarm,
    };
  });
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  await waitForZephyrBattle(battlePage);
  const halfHpUi = await inspectUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "zephyr_half_hp_bomb_persists_desktop.png"), fullPage: true });

  await prepareZephyrBattle(host);
  const legacyMigration = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    battle.postgameBossMechanic = {
      version: 1,
      key: "postgame_zephyr",
      title: "Battle Smasher",
      phase: 1,
      heat: 3,
      armor: 2,
      overheat: true,
      seaStoneSkipByCrew: {},
    };
    battle.enemyCombatant.name = "Z／捷風";
    const view = debug.getBattleView();
    const mechanic = battle.postgameBossMechanic;
    return {
      version: mechanic.version,
      countdown: mechanic.countdown,
      progress: mechanic.disarmProgress,
      legacyFieldsRemoved: !("heat" in mechanic) && !("armor" in mechanic) && !("overheat" in mechanic),
      viewTitle: view.battle.postgameBossMechanic.title,
      enemyName: view.enemy.name,
    };
  });

  await prepareZephyrBattle(host);
  const legacyHalfMigration = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    battle.postgameBossMechanic.version = 2;
    battle.postgameBossMechanic.phase = 2;
    battle.postgameBossMechanic.countdown = 4;
    battle.postgameBossMechanic.countdownActive = false;
    battle.postgameBossMechanic.disarmProgress = 3;
    battle.postgameBossMechanic.dynaRockDisarmed = true;
    battle.log.push("測試船員 放棄攻擊處理炸藥岩，骰出 2，解除進度 0 → 1/3。");
    battle.log.push("澤法生命降到一半，Battle Smasher 在正面衝擊下爆裂脫落；黑腕拳頭決戰開始。");
    const view = debug.getBattleView();
    return {
      version: battle.postgameBossMechanic.version,
      phase: battle.postgameBossMechanic.phase,
      countdown: battle.postgameBossMechanic.countdown,
      countdownActive: battle.postgameBossMechanic.countdownActive,
      progress: battle.postgameBossMechanic.disarmProgress,
      disarmed: battle.postgameBossMechanic.dynaRockDisarmed,
      canDisarm: view.battle.postgameBossMechanic.state.canDisarm,
    };
  });

  await prepareZephyrBattle(host);
  const previousSixCountdownMigration = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    battle.postgameBossMechanic.version = 3;
    battle.postgameBossMechanic.countdownTotal = 6;
    battle.postgameBossMechanic.countdown = 6;
    battle.postgameBossMechanic.countdownActive = true;
    const view = debug.getBattleView();
    return {
      countdownTotal: battle.postgameBossMechanic.countdownTotal,
      countdown: battle.postgameBossMechanic.countdown,
      countdownActive: battle.postgameBossMechanic.countdownActive,
      viewCountdown: view.battle.postgameBossMechanic.state.countdown,
    };
  });

  await prepareZephyrBattle(host);
  const storyReloadRecovery = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    battle.postgameBossMechanic.countdown = 0;
    battle.postgameBossMechanic.countdownActive = false;
    battle.postgameBossMechanic.detonated = true;
    battle.roundResolved = true;
    battle.animating = true;
    battle.result = "";
    battle.visualEvent = {
      id: "zephyr-story-reload-recovery",
      type: "postgame-zephyr-explosion-story",
      duration: 18000,
      sceneCount: 5,
    };
    const resolved = debug.battleZephyrExplosionStoryDone("zephyr-story-reload-recovery");
    return {
      resolved,
      result: battle.result,
      animating: battle.animating,
      visualEvent: battle.visualEvent,
      crewHp: player.crew.map((card) => Number(card.currentHp || 0)),
      knockedOutCrew: battle.knockedOutCrew.slice(),
    };
  });

  await prepareZephyrBattle(host);
  await battlePage.setViewportSize({ width: 932, height: 430 });
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  await waitForZephyrBattle(battlePage);
  const mobile = await inspectUi(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "zephyr_field_target_phone_landscape.png"), fullPage: true });
  const mobileCountdownPromise = host.evaluate(async () => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    for (let index = 0; index < 4; index += 1) await debug.postgameBossMechanicQa.roundEnd(player, battle);
    return {
      result: battle.result,
      crewHp: player.crew.map((card) => Number(card.currentHp || 0)),
    };
  });
  const mobileStory = await playExplosionStory(battlePage, "zephyr_explosion_phone_landscape");
  const mobileCountdownResult = await mobileCountdownPromise;

  if (initialView?.enemy?.name !== "澤法") failures.push(`enemy name is ${initialView?.enemy?.name || "missing"}`);
  if (initialView?.enemy?.maxHp !== 2000 || initialView?.enemy?.currentHp !== 2000) failures.push(`Zephyr did not start at 2000/2000 HP ${JSON.stringify(initialView?.enemy)}`);
  if (initialView?.battle?.postgameBossMechanic?.state?.countdown !== 4) failures.push("initial countdown is not 4");
  if (initialView?.battle?.postgameBossMechanic?.state?.disarmProgress !== 0) failures.push("initial disarm progress is not 0");
  for (const [label, ui] of [["desktop", desktop], ["mobile", mobile]]) {
    if (ui.title !== "最終終結點阻止戰") failures.push(`${label}: wrong mechanic title ${ui.title}`);
    if (ui.endpointCards !== 3 || !/終結點Ⅰ/.test(ui.stateText) || !/終結點Ⅲ/.test(ui.stateText)) failures.push(`${label}: endpoint status is incomplete`);
    if (ui.endpointAction.exists) failures.push(`${label}: mechanic panel still owns the disarm action`);
    if (!ui.fieldTarget.exists || ui.fieldTarget.tagName !== "BUTTON" || !/解除炸藥岩/.test(ui.fieldTarget.label) || !/進度 0\/3.*倒數 4/.test(ui.fieldTarget.text)) failures.push(`${label}: battlefield Dyna Stone target is not available ${JSON.stringify(ui.fieldTarget)}`);
    if (!ui.fieldTarget.overlapsEnemyLeftEdge || !ui.fieldTarget.insideViewport) failures.push(`${label}: battlefield Dyna Stone is not anchored across Zephyr's left frame ${JSON.stringify(ui.fieldTarget)}`);
    if (ui.actionGrid.count !== 4 || ui.actionGrid.modes.includes("zephyr-disarm") || ui.actionGrid.hasZephyrClass || ui.actionGrid.columns.trim().split(/\s+/).length !== 2 || ui.actionGrid.rows.trim().split(/\s+/).length !== 2) failures.push(`${label}: original 2x2 action layout changed ${JSON.stringify(ui.actionGrid)}`);
    if (ui.dynaImages.some((image) => !image.complete || image.width <= 0 || !/dyna_stone_cylinder_v2\.webp/.test(image.src))) failures.push(`${label}: mechanic panel Dyna Stone image is missing`);
    if (!ui.fieldTarget.image.complete || ui.fieldTarget.image.width <= 0 || !/dyna_stone_cylinder_v2\.webp/.test(ui.fieldTarget.image.src)) failures.push(`${label}: battlefield Dyna Stone image is missing`);
    if (ui.pageOverflow) failures.push(`${label}: page overflow detected`);
    if (ui.textOverflow.length) failures.push(`${label}: text overflow ${ui.textOverflow.join(" / ")}`);
  }
  if (fieldActionRoute.calls !== 1) failures.push(`battlefield Dyna Stone action route did not execute ${JSON.stringify(fieldActionRoute)}`);
  if (disarmResult.first?.gain !== 1 || disarmResult.second?.gain !== 2 || disarmResult.progress !== 3 || !disarmResult.disarmed || disarmResult.countdownActive) failures.push(`disarm resolution failed ${JSON.stringify(disarmResult)}`);
  if (disarmResult.phase !== 2 || !/black_arm_normal/.test(disarmResult.portrait) || JSON.stringify(disarmResult.repeatedDamage) !== JSON.stringify([65])) failures.push(`black arm or instructor read failed ${JSON.stringify(disarmResult)}`);
  if (disarmedUi.endpointAction.exists || disarmedUi.fieldTarget.exists || !/炸藥岩已解除/.test(disarmedUi.stateText) || !/black_arm_normal/.test(disarmedUi.enemyPortrait)) failures.push("disarmed UI did not hide the field target and switch to the Black Arm state");
  if (countdownResult.phase !== 2 || countdownResult.countdown !== 0 || countdownResult.active || !countdownResult.detonated || countdownResult.result !== "lose" || !/全員瀕死/.test(countdownResult.log) || countdownResult.crewHp.some((hp) => hp !== 0) || countdownResult.knockedOutCrew.length !== 6) failures.push(`phase-two countdown story/wipeout failed ${JSON.stringify(countdownResult)}`);
  for (const [label, story] of [["desktop", desktopStory], ["mobile", mobileStory]]) {
    if (story.length !== 5) failures.push(`${label}: explosion story did not show five scenes`);
    story.forEach((frame, index) => {
      const expectedTitle = ["倒數歸零", "引爆", "終結點崩壞", "連鎖反應", "新世界陷落"][index];
      if (frame.title !== expectedTitle || !/postgame_zephyr_explosion\/scene_0[1-5]_/.test(frame.image) || frame.natural[0] !== 1672 || frame.natural[1] !== 941 || frame.activeDots !== 1 || !frame.copyInside || frame.pageOverflow || frame.resultBeforeStoryEnd || frame.activeCrewHpBeforeStoryEnd <= 0) {
        failures.push(`${label}: invalid explosion story frame ${index + 1} ${JSON.stringify(frame)}`);
      }
    });
  }
  if (!desktopStoryResult.overlayHidden || !/全員瀕死/.test(desktopStoryResult.resultText) || desktopStoryResult.storyState?.visible) failures.push(`desktop: story did not close into the normal wipeout result ${JSON.stringify(desktopStoryResult)}`);
  if (!desktopWipeoutSettlement.battleCleared || !desktopWipeoutSettlement.impelDownActive || !/挑戰失敗/.test(desktopWipeoutSettlement.capturedReason) || desktopWipeoutSettlement.crewHp.some((hp) => hp <= 0)) failures.push(`desktop: normal full-crew wipeout settlement did not run ${JSON.stringify(desktopWipeoutSettlement)}`);
  if (mobileCountdownResult.result !== "lose" || mobileCountdownResult.crewHp.some((hp) => hp !== 0)) failures.push(`mobile: explosion did not apply full-crew wipeout ${JSON.stringify(mobileCountdownResult)}`);
  if (halfHpResult.maxHp !== 2000 || halfHpResult.currentHp !== 1000 || JSON.stringify(halfHpResult.adjustedDamage) !== JSON.stringify([1000]) || halfHpResult.phase !== 2 || !/black_arm_normal/.test(halfHpResult.portrait) || !halfHpResult.countdownActive || halfHpResult.disarmed || halfHpResult.progress !== 0 || !halfHpResult.canDisarm) failures.push(`half-HP transition failed ${JSON.stringify(halfHpResult)}`);
  if (!halfHpUi.fieldTarget.exists || halfHpUi.fieldTarget.disabled || !/進度 0\/3.*倒數 4/.test(halfHpUi.fieldTarget.text) || !/black_arm_normal/.test(halfHpUi.enemyPortrait) || !/炸藥岩倒數仍繼續/.test(halfHpUi.stateText)) failures.push(`half-HP UI did not keep Dyna Stone active ${JSON.stringify(halfHpUi)}`);
  if (legacyMigration.version !== 3 || legacyMigration.countdown !== 4 || legacyMigration.progress !== 0 || !legacyMigration.legacyFieldsRemoved || legacyMigration.viewTitle !== "最終終結點阻止戰" || legacyMigration.enemyName !== "澤法") failures.push(`legacy migration failed ${JSON.stringify(legacyMigration)}`);
  if (legacyHalfMigration.version !== 3 || legacyHalfMigration.phase !== 2 || legacyHalfMigration.countdown !== 4 || !legacyHalfMigration.countdownActive || legacyHalfMigration.progress !== 1 || legacyHalfMigration.disarmed || !legacyHalfMigration.canDisarm) failures.push(`legacy half-HP bomb restoration failed ${JSON.stringify(legacyHalfMigration)}`);
  if (previousSixCountdownMigration.countdownTotal !== 4 || previousSixCountdownMigration.countdown !== 4 || !previousSixCountdownMigration.countdownActive || previousSixCountdownMigration.viewCountdown !== 4) failures.push(`six-to-four countdown migration failed ${JSON.stringify(previousSixCountdownMigration)}`);
  if (!storyReloadRecovery.resolved || storyReloadRecovery.result !== "lose" || storyReloadRecovery.animating || storyReloadRecovery.visualEvent || storyReloadRecovery.crewHp.some((hp) => hp !== 0) || storyReloadRecovery.knockedOutCrew.length !== 6) failures.push(`story reload recovery failed ${JSON.stringify(storyReloadRecovery)}`);

  const report = {
    ok: errors.length === 0 && failures.length === 0,
    outputDir: OUTPUT_DIR,
    initial: {
      enemyName: initialView?.enemy?.name || "",
      mechanic: initialView?.battle?.postgameBossMechanic || null,
    },
    desktop,
    mobile,
    fieldActionRoute,
    disarmResult,
    disarmedUi,
    countdownResult,
    desktopStory,
    desktopStoryResult,
    desktopWipeoutSettlement,
    mobileStory,
    mobileCountdownResult,
    halfHpResult,
    halfHpUi,
    legacyMigration,
    legacyHalfMigration,
    previousSixCountdownMigration,
    storyReloadRecovery,
    errors,
    failures,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (!report.ok) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
