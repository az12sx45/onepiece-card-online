const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_impact_order_20260813_v38";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareRogerBattle(host) {
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const rogerSource = window.BoardCards.cards.find((card) => card.id === "custom_mp3la6fr");
    player.crew = [debug.cloneCard({ ...rogerSource, level: 50, currentHp: Number.MAX_SAFE_INTEGER })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-impact-order-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments[0];
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
  });
}

async function openBattlePage(host, context, query) {
  const popupPromise = context.waitForEvent("page");
  await host.evaluate((suffix) => window.open(`board_battle.html?${suffix}`, "_blank"), query);
  const battlePage = await popupPromise;
  await battlePage.waitForLoadState("domcontentloaded");
  await battlePage.waitForFunction(() => document.getElementById("playerPortrait") && document.getElementById("enemyPortrait"), null, { timeout: 15000 });
  return battlePage;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?battle_impact_order_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  await prepareRogerBattle(host);
  const battlePage = await openBattlePage(host, context, "battle_impact_order_qa=1");
  captureErrors(battlePage, errors, "battle");

  const passiveResult = await battlePage.evaluate(async () => {
    const host = window.opener;
    const debug = host.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const roger = state.gameState.players[0].crew[0];
    const enemyHpBefore = Number(battle.enemyCombatant.currentHp || 0);
    battle.visualEvent = {
      id: `roger-opening-${Date.now()}`,
      type: "passive-opening",
      side: "player",
      actorName: "哥爾·D·羅傑",
      passiveName: "海賊王的霸王色",
      effectText: "敵方攻擊-1、敵方防禦-1",
      targetSide: "enemy",
      moveType: "debuff",
      cosmeticOnly: true,
      damage: 0,
      hitDamages: [],
      duration: 1850,
      actorCombatant: JSON.parse(JSON.stringify(roger)),
    };
    debug.notifyBattleWindow();
    await new Promise((resolve) => setTimeout(resolve, 180));
    const card = document.getElementById("playerCard");
    const image = document.getElementById("playerPortrait");
    const enemyCard = document.getElementById("enemyCard");
    const enemyImage = document.getElementById("enemyPortrait");
    return {
      portrait: image?.getAttribute("src") || "",
      attackClass: card?.classList.contains("portrait-attack") || false,
      hitClass: card?.classList.contains("portrait-hit") || false,
      enemyPortrait: enemyImage?.getAttribute("src") || "",
      enemyHitClass: enemyCard?.classList.contains("portrait-hit") || false,
      enemyHpBefore,
      enemyHpAfter: Number(battle.enemyCombatant.currentHp || 0),
      displayedEnemyHp: window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.enemy?.currentHp ?? null,
      damageNumberCount: document.querySelectorAll("#damagePop .damage-number").length,
    };
  });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "roger-opening-passive-desktop.png") });
  if (
    !/\/angry\.webp(?:\?|$)/.test(passiveResult.portrait)
    || !passiveResult.attackClass
    || passiveResult.hitClass
    || passiveResult.enemyHitClass
    || /\/(?:hit|weak|dizzy)\.webp(?:\?|$)/.test(passiveResult.enemyPortrait)
    || passiveResult.enemyHpAfter !== passiveResult.enemyHpBefore
    || Number(passiveResult.displayedEnemyHp) !== passiveResult.enemyHpBefore
    || passiveResult.damageNumberCount > 0
  ) {
    failures.push(`Roger cosmetic opening attack changed combat state: ${JSON.stringify(passiveResult)}`);
  }
  await battlePage.waitForTimeout(2100);

  const impactResult = await battlePage.evaluate(async () => {
    const host = window.opener;
    const debug = host.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const target = state.gameState.players[0].crew[0];
    const startHp = Number(target.baseStats?.hp || target.maxHp || 1);
    const finalHp = Math.max(1, Math.round(startHp * 0.2));
    target.currentHp = finalHp;
    battle.visualEvent = {
      id: `impact-order-${Date.now()}`,
      type: "attack",
      side: "enemy",
      targetSide: "player",
      actorName: battle.enemyCombatant.name,
      targetName: target.name,
      actorCombatant: JSON.parse(JSON.stringify(battle.enemyCombatant)),
      targetCombatant: JSON.parse(JSON.stringify(target)),
      startCombatant: { ...JSON.parse(JSON.stringify(target)), currentHp: startHp },
      startSnapshot: {
        player: { ...JSON.parse(JSON.stringify(target)), currentHp: startHp },
        enemy: JSON.parse(JSON.stringify(battle.enemyCombatant)),
      },
      finalSnapshot: {
        player: JSON.parse(JSON.stringify(target)),
        enemy: JSON.parse(JSON.stringify(battle.enemyCombatant)),
      },
      moveName: "時序測試攻擊",
      moveType: "attack",
      damage: startHp - finalHp,
      hitDamages: [startHp - finalHp],
      startHp: { player: startHp, enemy: battle.enemyCombatant.currentHp },
      finalHp: { player: finalHp, enemy: battle.enemyCombatant.currentHp },
      diceFace: 6,
      miss: false,
      duration: 3000,
    };
    debug.notifyBattleWindow();
    const sample = () => ({
      src: document.getElementById("playerPortrait")?.getAttribute("src") || "",
      hpWidth: document.getElementById("playerHpFill")?.style.width || "",
      hitClass: document.getElementById("playerCard")?.classList.contains("portrait-hit") || false,
    });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const beforeContact = sample();
    await new Promise((resolve) => setTimeout(resolve, 680));
    const afterContact = sample();
    return { beforeContact, afterContact };
  });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "impact-after-contact-desktop.png") });
  if (/\/weak\.webp(?:\?|$)|\/dizzy\.webp(?:\?|$)/.test(impactResult.beforeContact.src) || impactResult.beforeContact.hitClass || parseFloat(impactResult.beforeContact.hpWidth) < 99) {
    failures.push(`Defender changed before contact: ${JSON.stringify(impactResult.beforeContact)}`);
  }
  if (!impactResult.afterContact.hitClass || Math.abs(parseFloat(impactResult.afterContact.hpWidth) - 20) > 1) {
    failures.push(`Defender did not change at contact: ${JSON.stringify(impactResult.afterContact)}`);
  }

  await battlePage.setViewportSize({ width: 932, height: 430 });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "battle-impact-order-phone-932x430.png") });
  const phone = await battlePage.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 2 || document.documentElement.scrollHeight > window.innerHeight + 2,
  }));
  if (phone.overflow) failures.push(`Phone viewport overflow: ${JSON.stringify(phone)}`);
  if (errors.length) failures.push(...errors);

  const report = { outputDir: OUTPUT_DIR, passiveResult, impactResult, phone, errors, failures };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
