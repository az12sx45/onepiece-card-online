const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const TARGET_BOSS_KEY = process.env.BOARD_QA_BOSS_KEY || "";
const SAMPLE_COUNT = Math.max(1, Number(process.env.BOARD_QA_SAMPLE_COUNT || 38));
const [VIEWPORT_WIDTH, VIEWPORT_HEIGHT] = String(process.env.BOARD_QA_VIEWPORT || "1600x900")
  .split("x")
  .map((value) => Math.max(1, Number(value || 1)));
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_prebattle_voice_20260817_v253";
const SYSTEM_STYLE_LINE_PATTERN = /(上場|出戰|迎戰|登場|參戰|應戰|派出|輪到你|準備戰鬥|戰鬥開始|放馬過來)/;
const EXPOSITION_STYLE_LINE_PATTERN = /(超越這份見聞色|血統因子的完成形|覺醒之後|火焰熄滅前|每回合|第[一二三四五六0-9]+顆|命中率|閃避率|血量|HP|骰子|傷害[+＋\-－])/i;

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const progressPath = path.join(OUTPUT_DIR, "progress.log");
  const progress = (label) => {
    fs.appendFileSync(progressPath, `${new Date().toISOString()} ${label}\n`);
    process.stdout.write(`[prebattle-qa] ${label}\n`);
  };
  fs.writeFileSync(progressPath, "");
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  progress("browser launched");
  const context = await browser.newContext({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(6000);
  await context.addInitScript(() => {
    sessionStorage.removeItem("onepiece-board-prebattle-intro-done-v3");
    localStorage.removeItem("onepiece-board-dev-observer-v1");
  });
  const host = await context.newPage();
  host.on("pageerror", (error) => errors.push(`host:${error.stack || error.message}`));
  await host.goto(`${ROOT_URL}/board_game.html?battle_prebattle_intro_qa=1`, { waitUntil: "domcontentloaded" });
  progress("board loaded");
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  progress("debug ready");
  await host.evaluate((targetBossKey) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    player.isCpu = true;
    player.isCPU = true;
    player.clientId = "board-cpu-prebattle-qa";
    const rogerSource = window.BoardCards.cards.find((card) => card.id === "custom_mp3la6fr");
    player.crew = [debug.cloneCard({ ...rogerSource, level: 50, currentHp: Number.MAX_SAFE_INTEGER })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-prebattle-intro-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === targetBossKey)
      || state.gameState.postgameWorld.islandAssignments[0];
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
  }, TARGET_BOSS_KEY);
  progress("battle started");

  const frameHandle = await host.waitForSelector("#battlePageOverlay iframe", { timeout: 15000 });
  progress("iframe found");
  const frame = await frameHandle.contentFrame();
  await frame.waitForFunction(() => document.getElementById("playerPortrait") && document.getElementById("enemyPortrait"), null, { timeout: 15000 });
  progress("iframe ready");
  const samples = [];
  for (let index = 0; index < SAMPLE_COUNT; index += 1) {
    progress(`sample ${index} start`);
    const frameSample = await frame.evaluate(() => {
      const layer = document.getElementById("prebattleDialogue");
      const style = layer ? getComputedStyle(layer) : null;
      const view = window.__BOARD_BATTLE_DEBUG__?.latestView?.();
      return {
        at: Date.now(),
        layerClass: layer?.className || "",
        display: style?.display || "",
        opacity: style?.opacity || "",
        playerQuoteDisplay: layer ? getComputedStyle(layer.querySelector(".prebattle-quote.player")).display : "",
        enemyQuoteDisplay: layer ? getComputedStyle(layer.querySelector(".prebattle-quote.enemy")).display : "",
        heroText: layer?.querySelector("[data-prebattle-hero-text]")?.textContent || "",
        enemyText: layer?.querySelector("[data-prebattle-enemy-text]")?.textContent || "",
        action: view?.battle?.playerAction || null,
      };
    });
    const hostSample = await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const battle = debug.getState().battleState;
      return {
        introDone: !!battle?.prebattleIntro?.done,
        liveAction: battle?.playerAction || null,
        roundIndex: Number(battle?.roundIndex || 0),
        result: battle?.result || null,
        enemyHp: Number(battle?.enemyCombatant?.currentHp || 0),
        cpu: debug.cpuAutoStatus(),
      };
    });
    samples.push({ ...frameSample, ...hostSample });
    progress(`sample ${index} done`);
    await host.waitForTimeout(500);
  }

  const visible = samples.some((sample) => sample.display !== "none" && (sample.playerQuoteDisplay !== "none" || sample.enemyQuoteDisplay !== "none"));
  const cpuState = await host.evaluate(() => ({
    cpu: window.__BOARD_GAME_DEBUG__.cpuAutoStatus(),
    intro: window.__BOARD_GAME_DEBUG__.getState().battleState?.prebattleIntro || null,
    action: window.__BOARD_GAME_DEBUG__.getState().battleState?.playerAction || null,
    roundIndex: Number(window.__BOARD_GAME_DEBUG__.getState().battleState?.roundIndex || 0),
    result: window.__BOARD_GAME_DEBUG__.getState().battleState?.result || null,
    enemyHp: Number(window.__BOARD_GAME_DEBUG__.getState().battleState?.enemyCombatant?.currentHp || 0),
  }));
  const waitedWhileIntroVisible = samples
    .filter((sample) => sample.playerQuoteDisplay !== "none" || sample.enemyQuoteDisplay !== "none")
    .every((sample) => !sample.action && !sample.liveAction);
  const cpuWaitedForDialogue = samples
    .filter((sample) => !sample.introDone)
    .some((sample) => sample.cpu?.lastResult === "等待戰鬥開場對話播放。")
    || samples.filter((sample) => !sample.introDone).every((sample) => !sample.liveAction);
  const cpuActedAfterDialogue = samples.some((sample) => sample.introDone && (
    sample.liveAction
    || /使用招式|換上更適合|使用補品/.test(String(sample.cpu?.lastResult || ""))
  ));
  const sampledBattleRounds = [...new Set(samples.map((sample) => sample.roundIndex).filter((round) => round > 0))];
  const dialogueTexts = samples.flatMap((sample) => [sample.heroText, sample.enemyText])
    .map((text) => String(text || "").trim())
    .filter(Boolean);
  const systemStyleDialogue = [...new Set(dialogueTexts.filter((text) => SYSTEM_STYLE_LINE_PATTERN.test(text)))];
  const expositionStyleDialogue = [...new Set(dialogueTexts.filter((text) => EXPOSITION_STYLE_LINE_PATTERN.test(text)))];
  const naturalDialogue = dialogueTexts.length >= 2
    && systemStyleDialogue.length === 0
    && expositionStyleDialogue.length === 0;
  const overflow = await frame.evaluate(() => (
    document.documentElement.scrollWidth > window.innerWidth + 2
    || document.documentElement.scrollHeight > window.innerHeight + 2
  ));
  const report = {
    outputDir: OUTPUT_DIR,
    viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT },
    visible,
    waitedWhileIntroVisible,
    cpuWaitedForDialogue,
    cpuActedAfterDialogue,
    sampledBattleRounds,
    naturalDialogue,
    dialogueTexts: [...new Set(dialogueTexts)],
    systemStyleDialogue,
    expositionStyleDialogue,
    overflow,
    cpuState,
    errors,
    samples,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  progress("closing browser");
  await browser.close();
  progress("done");
  if (!visible || !waitedWhileIntroVisible || !cpuWaitedForDialogue || !cpuActedAfterDialogue || !naturalDialogue || overflow || errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
