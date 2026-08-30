const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lineage_extraction_visibility_20260813_v40";
const ONLY_JUDGE = process.env.BOARD_QA_ONLY_JUDGE === "1";
const SKIP_CATALOG = process.env.BOARD_QA_SKIP_CATALOG === "1";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function waitForBattleFrame(host) {
  const frameHandle = await host.waitForSelector("#battlePageOverlay iframe", { timeout: 15000 });
  const frame = await frameHandle.contentFrame();
  await frame.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle, null, { timeout: 15000 });
  return frame;
}

async function inspectEnemy(frame) {
  return frame.evaluate(() => {
    const card = document.getElementById("enemyCard");
    const portrait = document.getElementById("enemyPortrait");
    const wrap = document.getElementById("enemyPortraitWrap");
    const root = document.querySelector(".lineage-extraction-root");
    const soldierLayer = document.getElementById("judgeCloneGuardLayer");
    const cardStyle = card ? getComputedStyle(card) : null;
    const imageStyle = portrait ? getComputedStyle(portrait) : null;
    const cardRect = card?.getBoundingClientRect();
    const imageRect = portrait?.getBoundingClientRect();
    const rootStyle = root ? getComputedStyle(root) : null;
    const centerX = cardRect ? Math.max(0, Math.min(window.innerWidth - 1, cardRect.left + cardRect.width * .5)) : 0;
    const centerY = cardRect ? Math.max(0, Math.min(window.innerHeight - 1, cardRect.top + cardRect.height * .5)) : 0;
    const topAtEnemyCenter = cardRect ? document.elementFromPoint(centerX, centerY) : null;
    const visibleRect = (rect) => !!rect && rect.width > 40 && rect.height > 40
      && rect.right > 0 && rect.bottom > 0 && rect.left < window.innerWidth && rect.top < window.innerHeight;
    return {
      lineageOpen: root?.classList.contains("is-open") || false,
      lineageBattleLayout: document.getElementById("battleStage")?.classList.contains("lineage-extraction-battle-layout") || false,
      lineageOperationLayout: document.getElementById("battleStage")?.classList.contains("lineage-extraction-operation") || false,
      lineageCylinderSelection: root?.classList.contains("is-cylinder-selection") || false,
      enemyName: window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.lineageExtraction?.enemy?.name || "",
      enemyKey: window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.lineageExtraction?.enemy?.key || "",
      cardClass: card?.className || "",
      cardDisplay: cardStyle?.display || "",
      cardVisibility: cardStyle?.visibility || "",
      cardOpacity: Number(cardStyle?.opacity || 0),
      cardZIndex: Number(cardStyle?.zIndex || 0),
      rootZIndex: Number(rootStyle?.zIndex || 0),
      cardVisibleRect: visibleRect(cardRect),
      enemyIsTopLayer: !!topAtEnemyCenter && !!card?.contains(topAtEnemyCenter),
      topAtEnemyCenter: topAtEnemyCenter?.id || topAtEnemyCenter?.className || topAtEnemyCenter?.tagName || "",
      portraitSrc: portrait?.currentSrc || portrait?.src || "",
      portraitNaturalWidth: Number(portrait?.naturalWidth || 0),
      portraitNaturalHeight: Number(portrait?.naturalHeight || 0),
      portraitDisplay: imageStyle?.display || "",
      portraitVisibility: imageStyle?.visibility || "",
      portraitOpacity: Number(imageStyle?.opacity || 0),
      portraitVisibleRect: visibleRect(imageRect),
      wrapHasPortrait: wrap?.classList.contains("has-portrait") || false,
      judgeSoldierLayerHidden: soldierLayer?.hidden ?? true,
      judgeSoldierCount: soldierLayer?.querySelectorAll(".judge-clone-guard")?.length || 0,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2
        || document.documentElement.scrollHeight > window.innerHeight + 2,
    };
  });
}

function baseVisible(result) {
  return result.lineageOpen
    && result.cardDisplay !== "none"
    && result.cardVisibility !== "hidden"
    && result.cardOpacity > 0.9
    && result.cardVisibleRect
    && result.portraitNaturalWidth > 0
    && result.portraitNaturalHeight > 0
    && result.portraitDisplay !== "none"
    && result.portraitVisibility !== "hidden"
    && result.portraitOpacity > 0.9
    && result.portraitVisibleRect
    && result.wrapHasPortrait
    && result.enemyIsTopLayer;
}

function offerVisible(result) {
  return baseVisible(result) && result.lineageBattleLayout;
}

function pickerVisible(result) {
  return baseVisible(result) && result.lineageOperationLayout && result.lineageCylinderSelection;
}

async function inspectPicker(frame) {
  await frame.locator("[data-lineage-proceed]").click();
  await frame.waitForFunction(() => (
    document.querySelector(".lineage-extraction-root.is-cylinder-selection")
    && document.getElementById("battleStage")?.classList.contains("lineage-extraction-operation")
  ), null, { timeout: 5000 });
  await frame.waitForTimeout(180);
  return inspectEnemy(frame);
}

async function inspectOutcomeBeam(host, frame, playerId) {
  const started = await host.evaluate(({ playerId }) => (
    window.__BOARD_GAME_DEBUG__.battleStartLineageExtraction("lineage_extractor_standard", playerId)
  ), { playerId });
  if (!started) throw new Error("Unable to start lineage extraction outcome QA.");
  await frame.waitForFunction(() => (
    document.querySelector(".lineage-extraction-root.is-minigame")
    && window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.lineageExtraction?.entry?.status === "active"
  ), null, { timeout: 8000 });

  const completed = await host.evaluate(({ playerId }) => (
    window.__BOARD_GAME_DEBUG__.battleCompleteLineageExtraction(["Perfect", "Perfect", "Perfect"], playerId)
  ), { playerId });
  if (!completed) throw new Error("Unable to complete lineage extraction outcome QA.");
  await frame.waitForFunction(() => (
    document.querySelector(".lineage-extraction-root.is-outcome")
    && document.querySelector("#battleStage > .lineage-target-beam")
  ), null, { timeout: 8000 });
  await frame.waitForFunction(() => (
    document.querySelector("#battleStage > .lineage-target-beam.is-firing")
  ), null, { timeout: 8000 });
  await frame.waitForTimeout(780);

  return frame.evaluate(() => {
    const stage = document.getElementById("battleStage");
    const root = document.querySelector(".lineage-extraction-root");
    const card = document.getElementById("enemyCard");
    const beam = document.querySelector("#battleStage > .lineage-target-beam");
    const line = beam?.querySelector(".lineage-beam-line");
    const beamRect = beam?.getBoundingClientRect();
    const lineStyle = line ? getComputedStyle(line) : null;
    const beamZIndex = Number(beam ? getComputedStyle(beam).zIndex : 0);
    const cardZIndex = Number(card ? getComputedStyle(card).zIndex : 0);
    const rootZIndex = Number(root ? getComputedStyle(root).zIndex : 0);
    return {
      parentId: beam?.parentElement?.id || "",
      operationLayout: stage?.classList.contains("lineage-extraction-operation") || false,
      outcomeOpen: root?.classList.contains("is-outcome") || false,
      firing: beam?.classList.contains("is-firing") || false,
      beamZIndex,
      cardZIndex,
      rootZIndex,
      aboveEnemyCard: beamZIndex > cardZIndex,
      aboveLaboratory: beamZIndex > rootZIndex,
      beamWidth: Math.round(beamRect?.width || 0),
      beamHeight: Math.round(beamRect?.height || 0),
      lineOpacity: Number(lineStyle?.opacity || 0),
      lineAnimation: lineStyle?.animationName || "",
      visible: !!beam && beamRect.width > 80 && beamRect.height > 8
        && Number(lineStyle?.opacity || 0) > .05
        && beamZIndex > cardZIndex && beamZIndex > rootZIndex,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2
        || document.documentElement.scrollHeight > window.innerHeight + 2,
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const progressPath = path.join(OUTPUT_DIR, "progress.log");
  fs.writeFileSync(progressPath, "");
  const progress = (message) => fs.appendFileSync(progressPath, `${new Date().toISOString()} ${message}\n`);
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?lineage_extraction_visibility_qa=1`, { waitUntil: "domcontentloaded" });
  progress("host loaded");
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const setup = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    player.pendingBattle = null;
    const source = window.BoardCards.cards.find((card) => card.id === "custom_mp3la6fr") || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard ? debug.cloneCard(source) : JSON.parse(JSON.stringify(source))];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || player.crew[0].currentHp || 999);
    player.activeCrewIndex = 0;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "lineage-extraction-visibility-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    debug.grantFormalItemToPlayer(player, "lineage_extractor_standard", 160, { reveal: false });
    return {
      playerId: player.id,
      assignments: state.gameState.postgameWorld.islandAssignments.map((entry) => ({
        islandId: entry.islandId,
        bossKey: entry.bossKey,
      })),
      catalog: debug.lineageCodexCatalog(player).map((entry) => ({
        cardId: entry.cardId,
        name: entry.name,
        enemyKey: entry.enemyKeys?.[0] || entry.cardId,
        portrait: entry.portrait,
        fallbackImage: entry.fallbackImage,
      })),
    };
  });
  progress(`setup complete assignments=${setup.assignments.length} catalog=${setup.catalog.length}`);

  const preparePostgameBoss = async (assignment, index) => host.evaluate(({ assignment, index }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.pendingBattle = null;
    state.battleState = null;
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
    battle.roundResolved = true;
    battle.waitingResume = false;
    battle.result = "win";
    battle.enemyCombatant.currentHp = 0;
    battle.lineageExtraction = null;
    battle.visualEvent = {
      id: `lineage-ko-${assignment.bossKey}-${index}-${Date.now()}`,
      type: "knockout",
      side: "enemy",
      targetName: battle.enemyCombatant.name,
      duration: 2600,
    };
    debug.ensureLineageExtractionOpportunity(battle);
    debug.notifyBattleWindow();
    return { key: battle.enemyCombatant.key, name: battle.enemyCombatant.name };
  }, { assignment, index });

  const bossAssignments = ONLY_JUDGE
    ? setup.assignments.filter((entry) => entry.bossKey === "postgame_vinsmoke_judge")
    : setup.assignments;
  if (!bossAssignments.length) throw new Error("No postgame boss assignment available for lineage extraction QA.");
  await preparePostgameBoss(bossAssignments[0], 0);
  progress(`initial boss prepared ${bossAssignments[0].bossKey}`);
  let frame = await waitForBattleFrame(host);
  progress("initial frame ready");
  const bosses = [];
  let judgeOutcomeDesktop = null;
  for (let index = 0; index < bossAssignments.length; index += 1) {
    const assignment = bossAssignments[index];
    const enemy = index === 0
      ? await host.evaluate(() => {
        const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
        return { key: battle.enemyCombatant.key, name: battle.enemyCombatant.name };
      })
      : await preparePostgameBoss(assignment, index);
    if (index > 0) frame = await waitForBattleFrame(host);
    await frame.waitForFunction((key) => (
      window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.lineageExtraction?.enemy?.key === key
      && document.querySelector(".lineage-extraction-root.is-open")
    ), enemy.key, { timeout: 10000 });
    progress(`boss extraction visible ${enemy.key}`);
    await frame.waitForTimeout(2850);
    const result = await inspectEnemy(frame);
    const picker = await inspectPicker(frame);
    bosses.push({ ...enemy, offer: result, picker, visible: offerVisible(result) && pickerVisible(picker) });
    progress(`boss inspected ${enemy.key} offer=${offerVisible(result)} picker=${pickerVisible(picker)}`);
    process.stdout.write(`[lineage-visibility] boss ${index + 1}/${bossAssignments.length} ${enemy.key} offer=${offerVisible(result)} picker=${pickerVisible(picker)}\n`);
    if (enemy.key === "postgame_vinsmoke_judge") {
      await host.screenshot({ path: path.join(OUTPUT_DIR, "judge-extractor-picker-desktop.png") });
      judgeOutcomeDesktop = await inspectOutcomeBeam(host, frame, setup.playerId);
      await host.screenshot({ path: path.join(OUTPUT_DIR, "judge-extractor-outcome-beam-desktop.png") });
    }
  }

  const catalogEntries = SKIP_CATALOG ? [] : setup.catalog;
  const catalog = [];
  for (let index = 0; index < catalogEntries.length; index += 1) {
    const entry = catalogEntries[index];
    await host.evaluate(({ entry, index }) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      const maxHp = 1000 + index;
      battle.result = "win";
      battle.animating = false;
      battle.roundResolved = true;
      battle.waitingResume = false;
      battle.isPostgameBoss = false;
      battle.postgameBossKey = "";
      battle.islandKind = "enemy";
      battle.bgmScopeId = `lineage-catalog-${index}`;
      battle.enemyCombatant = {
        key: entry.enemyKey,
        id: entry.enemyKey,
        sourceCardId: entry.cardId,
        name: entry.name,
        level: 99,
        tier: "T1",
        rank: "SSS",
        attribute: "力",
        maxHp,
        currentHp: 0,
        battlePortrait: entry.portrait,
        image: entry.fallbackImage,
        battlePortraits: {
          normal: entry.portrait,
          idle: entry.portrait,
          attack: entry.portrait,
          angry: entry.portrait,
          hit: entry.portrait,
          weak: entry.portrait,
          dizzy: entry.portrait,
          morale: entry.portrait,
        },
        moves: [],
      };
      battle.lineageExtraction = null;
      battle.visualEvent = null;
      debug.ensureLineageExtractionOpportunity(battle);
      debug.notifyBattleWindow();
    }, { entry, index });
    await frame.waitForFunction((key) => (
      window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.lineageExtraction?.enemy?.key === key
    ), entry.enemyKey, { timeout: 8000 });
    await frame.waitForTimeout(80);
    const result = await inspectEnemy(frame);
    catalog.push({ ...entry, ...result, visible: offerVisible(result) });
    if ((index + 1) % 10 === 0 || index + 1 === catalogEntries.length) {
      process.stdout.write(`[lineage-visibility] catalog ${index + 1}/${catalogEntries.length}\n`);
    }
  }

  const judgeAssignment = setup.assignments.find((entry) => entry.bossKey === "postgame_vinsmoke_judge");
  if (judgeAssignment) {
    progress("phone judge prepare start");
    await preparePostgameBoss(judgeAssignment, 999);
    progress("phone judge prepared");
    frame = await waitForBattleFrame(host);
    progress("phone frame ready");
    await host.setViewportSize({ width: 932, height: 430 });
    await frame.waitForFunction(() => document.querySelector(".lineage-extraction-root.is-open"), null, { timeout: 8000 });
    await frame.waitForTimeout(2850);
  }
  const phoneOffer = await inspectEnemy(frame);
  const phone = await inspectPicker(frame);
  phone.visible = offerVisible(phoneOffer) && pickerVisible(phone);
  await host.screenshot({ path: path.join(OUTPUT_DIR, "judge-extractor-picker-phone-932x430.png") });
  const judgeOutcomePhone = await inspectOutcomeBeam(host, frame, setup.playerId);
  await host.screenshot({ path: path.join(OUTPUT_DIR, "judge-extractor-outcome-beam-phone-932x430.png") });

  bosses.filter((entry) => !entry.visible).forEach((entry) => failures.push(`postgame boss hidden: ${entry.key} ${JSON.stringify(entry)}`));
  catalog.filter((entry) => !entry.visible).forEach((entry) => failures.push(`catalog portrait hidden: ${entry.enemyKey} ${JSON.stringify(entry)}`));
  if (!phone.visible || phone.overflow) failures.push(`judge phone extraction hidden or overflow: ${JSON.stringify(phone)}`);
  if (!judgeOutcomeDesktop?.visible || judgeOutcomeDesktop.overflow) {
    failures.push(`judge desktop outcome beam hidden or overflow: ${JSON.stringify(judgeOutcomeDesktop)}`);
  }
  if (!judgeOutcomePhone?.visible || judgeOutcomePhone.overflow) {
    failures.push(`judge phone outcome beam hidden or overflow: ${JSON.stringify(judgeOutcomePhone)}`);
  }
  if (errors.length) failures.push(...errors);

  const report = {
    outputDir: OUTPUT_DIR,
    bossCount: bosses.length,
    bossVisibleCount: bosses.filter((entry) => entry.visible).length,
    bosses,
    catalogCount: catalog.length,
    catalogVisibleCount: catalog.filter((entry) => entry.visible).length,
    catalogFailures: catalog.filter((entry) => !entry.visible),
    phone,
    judgeOutcomeDesktop,
    judgeOutcomePhone,
    errors,
    failures,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
