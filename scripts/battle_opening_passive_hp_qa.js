const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_opening_passive_hp_20260813_v38";

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  await context.addInitScript(() => {
    sessionStorage.removeItem("onepiece-board-prebattle-intro-done-v3");
    localStorage.removeItem("onepiece-board-dev-observer-v1");
  });
  const host = await context.newPage();
  host.on("pageerror", (error) => errors.push(error.message));
  await host.goto(`${ROOT_URL}/board_game.html?battle_opening_passive_hp_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  const setup = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    player.isCpu = true;
    player.isCPU = true;
    player.clientId = "board-cpu-opening-passive-hp-qa";
    const rogerSource = window.BoardCards.cards.find((card) => card.id === "custom_mp3la6fr");
    player.crew = [debug.cloneCard({ ...rogerSource, level: 50, currentHp: Number.MAX_SAFE_INTEGER })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-opening-passive-hp-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => {
      const candidateState = debug.getIslandState(entry.islandId);
      return candidateState?.enemyProfile?.key === "postgame_zephyr";
    }) || state.gameState.postgameWorld.islandAssignments.find((entry) => {
      const candidateState = debug.getIslandState(entry.islandId);
      return candidateState?.enemyProfile?.key !== "postgame_tot_musica";
    }) || state.gameState.postgameWorld.islandAssignments[0];
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    return { enemyHp: state.battleState.enemyCombatant.currentHp, enemyName: state.battleState.enemyCombatant.name };
  });
  const frameHandle = await host.waitForSelector("#battlePageOverlay iframe", { timeout: 15000 });
  const frame = await frameHandle.contentFrame();
  await frame.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle, null, { timeout: 15000 });

  await host.evaluate(() => {
    window.__openingPassiveHpSamples = [];
    window.__openingPassiveHpSampler = window.setInterval(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const battle = state.battleState;
      const iframe = document.querySelector("#battlePageOverlay iframe");
      const view = iframe?.contentWindow?.__BOARD_BATTLE_DEBUG__?.latestView?.();
      const sample = {
        at: Date.now(),
        hp: Number(battle?.enemyCombatant?.currentHp || 0),
        maxHp: Number(battle?.enemyCombatant?.maxHp || 0),
        eventId: battle?.visualEvent?.id || "",
        eventType: battle?.visualEvent?.type || "",
        eventMove: battle?.visualEvent?.moveName || battle?.visualEvent?.passiveName || "",
        playerAction: battle?.playerAction?.moveId || battle?.playerAction?.type || "",
        dice: battle?.playerDiceRoll ?? null,
        introDone: !!battle?.prebattleIntro?.done,
        passivePending: !!debug.getBattleView()?.battle?.openingPassiveVisualPending,
        lastLog: (battle?.log || []).slice(-1)[0] || "",
        playerPortrait: iframe?.contentDocument?.getElementById("playerPortrait")?.getAttribute("src") || "",
        enemyPortrait: iframe?.contentDocument?.getElementById("enemyPortrait")?.getAttribute("src") || "",
        displayedEnemyHp: view?.enemy?.currentHp ?? null,
        damageNumberCount: iframe?.contentDocument?.querySelectorAll("#damagePop .damage-number")?.length || 0,
      };
      const last = window.__openingPassiveHpSamples[window.__openingPassiveHpSamples.length - 1];
      const keys = ["hp", "eventId", "eventType", "playerAction", "dice", "introDone", "passivePending", "lastLog", "playerPortrait", "enemyPortrait", "displayedEnemyHp", "damageNumberCount"];
      if (!last || keys.some((key) => last[key] !== sample[key])) window.__openingPassiveHpSamples.push(sample);
    }, 32);
  });
  await host.waitForTimeout(22000);
  const timeline = await host.evaluate(() => {
    window.clearInterval(window.__openingPassiveHpSampler);
    return window.__openingPassiveHpSamples || [];
  });

  const firstHpDropIndex = timeline.findIndex((sample) => sample.hp < setup.enemyHp);
  const firstHpDrop = firstHpDropIndex >= 0 ? timeline[firstHpDropIndex] : null;
  const passiveSamples = timeline.filter((sample) => sample.eventType === "passive-opening");
  const passiveHpChanged = passiveSamples.some((sample) => sample.hp !== setup.enemyHp);
  const result = {
    outputDir: OUTPUT_DIR,
    setup,
    passiveHpChanged,
    firstHpDrop,
    firstHpDropDuringFormalAttack: !!firstHpDrop && firstHpDrop.eventType === "attack" && firstHpDrop.dice != null,
    passiveUsedAttackPortrait: passiveSamples.some((sample) => /\/angry\.webp(?:\?|$)/.test(sample.playerPortrait)),
    passiveEnemyHitPortrait: passiveSamples.some((sample) => /\/(?:hit|weak|dizzy)\.webp(?:\?|$)/.test(sample.enemyPortrait)),
    passiveDisplayedHpChanged: passiveSamples.some((sample) => Number(sample.displayedEnemyHp) !== setup.enemyHp),
    passiveDamageNumberShown: passiveSamples.some((sample) => sample.damageNumberCount > 0),
    errors,
    timeline,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (
    passiveHpChanged
    || !result.passiveUsedAttackPortrait
    || result.passiveEnemyHitPortrait
    || result.passiveDisplayedHpChanged
    || result.passiveDamageNumberShown
    || !result.firstHpDropDuringFormalAttack
    || errors.length
  ) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
