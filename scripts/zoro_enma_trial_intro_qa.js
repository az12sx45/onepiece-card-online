const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "C:/Users/王曜瑋/.codex/qa/zoro_enma_trial_full_frame_v358";

function captureErrors(page, errors, prefix) {
  page.on("pageerror", (error) => errors.push(`${prefix}:pageerror:${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${prefix}:console:${message.text()}`);
    }
  });
}

async function prepareBattle(page) {
  await page.goto(`${ROOT_URL}/board_game.html?zoro_enma_trial_intro_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.enmaTrialQa && window.BoardCards, null, { timeout: 30000 });
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.enmaTrialQa;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const source = window.BoardCards.cards.find((entry) => entry.id === "zoro");
    const card = debug.cloneCard(source);
    card.level = 40;
    card.totalExp = Number.MAX_SAFE_INTEGER;
    card.exp = Number.MAX_SAFE_INTEGER;
    card.formId = qa.newWorldFormId;
    card.evolutionFormId = qa.newWorldFormId;
    card.unlockedEvolutionFormIds = ["zoro_santoryu_plus", qa.newWorldFormId];
    card.battleCarryItem = debug.bulletArsenalQa.normalize({ id: qa.itemId });
    player.crew = [card];
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    player.isCpu = false;
    player.isCPU = false;
    state.gameState.phase = "main";
    state.gameState.turnIndex = 0;
    state.battleState = null;
    const island = state.gameState.boardData.islands.find((entry) => entry.kind === "enemy");
    const islandState = debug.getIslandState(island.id);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    return {
      playerId: player.id,
      intro: state.battleState?.prebattleIntro || null,
    };
  });
}

async function collectCinematic(page, label, errors) {
  const frameHandle = await page.waitForSelector("#battlePageOverlay iframe", { timeout: 20000 });
  const frame = await frameHandle.contentFrame();
  await frame.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView?.()?.battle?.prebattleIntro?.cinematic?.kind === "enma_trial", null, { timeout: 20000 });
  await frame.waitForFunction(() => document.getElementById("prebattleDialogue")?.classList.contains("enma-trial"), null, { timeout: 20000 });
  await frame.evaluate(() => {
    window.__ENMA_TRIAL_QA_OBSERVER__?.disconnect();
    window.__ENMA_TRIAL_QA_SAMPLES__ = [];
    const layer = document.getElementById("prebattleDialogue");
    const collect = () => {
      const index = Number(layer?.dataset.enmaFrameIndex);
      if (!Number.isInteger(index) || index < 0 || index >= 6) return;
      const currentLayer = document.getElementById("prebattleDialogue");
      const activeImage = currentLayer?.querySelector(".enma-trial-frame.is-active");
      const dialogue = currentLayer?.querySelector("[data-enma-trial-dialogue]");
      const layerRect = currentLayer?.getBoundingClientRect();
      const dialogueRect = dialogue && !dialogue.hidden ? dialogue.getBoundingClientRect() : null;
      const view = window.__BOARD_BATTLE_DEBUG__?.latestView?.();
      const isVisible = (element) => {
        if (!element) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01;
      };
      const sample = {
        className: currentLayer?.className || "",
        index,
        state: currentLayer?.dataset.enmaState || "",
        src: activeImage?.getAttribute("src") || "",
        objectFit: activeImage ? getComputedStyle(activeImage).objectFit : "",
        speaker: currentLayer?.querySelector("[data-enma-trial-speaker]")?.textContent || "",
        text: currentLayer?.querySelector("[data-enma-trial-text]")?.textContent || "",
        dialogueHidden: dialogue?.hidden ?? true,
        dialogueClassName: dialogue?.className || "",
        dialogueFrameSrc: dialogue?.querySelector(".prebattle-quote-frame")?.getAttribute("src") || "",
        titleCount: currentLayer?.querySelectorAll(".enma-trial-badge").length || 0,
        progressCount: currentLayer?.querySelectorAll(".enma-trial-progress-dot").length || 0,
        activeProgressCount: currentLayer?.querySelectorAll(".enma-trial-progress-dot.is-active").length || 0,
        buttonCount: currentLayer?.querySelectorAll("button").length || 0,
        action: view?.battle?.playerAction || null,
        playerHudVisible: isVisible(document.querySelector('[data-layout-id="playerHud"]')),
        enemyHudVisible: isVisible(document.querySelector('[data-layout-id="enemyHud"]')),
        matchupChipVisible: isVisible(document.querySelector(".attribute-matchup-chip")),
        layerRect: layerRect ? { left: layerRect.left, top: layerRect.top, right: layerRect.right, bottom: layerRect.bottom } : null,
        dialogueRect: dialogueRect ? { left: dialogueRect.left, top: dialogueRect.top, right: dialogueRect.right, bottom: dialogueRect.bottom } : null,
        overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
        overflowY: document.documentElement.scrollHeight > window.innerHeight + 2,
      };
      window.__ENMA_TRIAL_QA_SAMPLES__[index] = sample;
    };
    window.setTimeout(collect, 400);
    window.__ENMA_TRIAL_QA_OBSERVER__ = new MutationObserver(() => window.setTimeout(collect, 400));
    window.__ENMA_TRIAL_QA_OBSERVER__.observe(layer, { attributes: true, attributeFilter: ["data-enma-frame-index"] });
  });
  await frame.waitForFunction(() => Number(document.getElementById("prebattleDialogue")?.dataset.enmaFrameIndex) === 2, null, { timeout: 10000 });
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}_frame_03.png`) });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__.getState().battleState?.prebattleIntro?.done === true, null, { timeout: 20000 });
  const samples = await frame.evaluate(() => {
    window.__ENMA_TRIAL_QA_OBSERVER__?.disconnect();
    return [...(window.__ENMA_TRIAL_QA_SAMPLES__ || [])].filter(Boolean);
  });
  const finalState = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const battle = debug.getState().battleState;
    const view = debug.getBattleView();
    return {
      introDone: !!battle?.prebattleIntro?.done,
      canAct: !!view?.battle?.canAct,
      action: battle?.playerAction || null,
    };
  });
  const restoredUi = await frame.evaluate(() => {
    const isVisible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) > 0.01;
    };
    return {
      playerHudVisible: isVisible(document.querySelector('[data-layout-id="playerHud"]')),
      enemyHudVisible: isVisible(document.querySelector('[data-layout-id="enemyHud"]')),
      matchupChipVisible: isVisible(document.querySelector(".attribute-matchup-chip")),
      stageClassName: document.getElementById("battleStage")?.className || "",
    };
  });
  if (samples.some((sample) => sample.action)) errors.push(`${label}:戰鬥在閻魔劇情結束前提前選招`);
  if (samples.some((sample) => sample.titleCount !== 0)) errors.push(`${label}:閻魔劇情仍有頂部標題遮住圖片`);
  if (samples.some((sample) => sample.playerHudVisible || sample.enemyHudVisible || sample.matchupChipVisible)) errors.push(`${label}:閻魔劇情期間仍顯示血量或屬性 UI`);
  const dialogueSamples = samples.filter((sample) => !sample.dialogueHidden);
  if (dialogueSamples.some((sample) => !sample.dialogueClassName.includes("prebattle-quote") || !sample.dialogueClassName.includes("player"))) errors.push(`${label}:閻魔台詞未使用正式玩家對話結構`);
  if (dialogueSamples.some((sample) => !sample.dialogueFrameSrc.includes("battle_dialogue_player_frame.webp"))) errors.push(`${label}:閻魔台詞未使用正式玩家對話框素材`);
  if (!restoredUi.playerHudVisible || !restoredUi.enemyHudVisible || !restoredUi.matchupChipVisible || restoredUi.stageClassName.includes("enma-trial-cinematic-active")) errors.push(`${label}:閻魔劇情結束後戰鬥 UI 未完整恢復`);
  return { samples, finalState, restoredUi };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const desktopContext = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await desktopContext.addInitScript(() => sessionStorage.removeItem("onepiece-board-prebattle-intro-done-v3"));
  const desktopPage = await desktopContext.newPage();
  captureErrors(desktopPage, errors, "desktop");

  await desktopPage.goto(`${ROOT_URL}/board_game.html?zoro_enma_trial_logic_qa=1`, { waitUntil: "domcontentloaded" });
  await desktopPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.enmaTrialQa && window.BoardCards, null, { timeout: 30000 });
  const logic = await desktopPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.enmaTrialQa;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const source = window.BoardCards.cards.find((entry) => entry.id === "zoro");
    const makeCard = (formId, mode = "standalone") => {
      const card = debug.cloneCard(source);
      card.level = 40;
      card.formId = formId;
      card.evolutionFormId = formId;
      card.unlockedEvolutionFormIds = formId === "base" ? [] : ["zoro_santoryu_plus", qa.newWorldFormId, qa.zorojuroFormId].filter((id) => id === formId || id !== qa.zorojuroFormId);
      card.battleCarryItem = mode === "none"
        ? null
        : mode === "arsenal"
          ? debug.bulletArsenalQa.normalize({ id: debug.bulletArsenalQa.itemId, arsenalItems: [{ id: qa.itemId }, { id: "scope_lens" }] })
          : debug.bulletArsenalQa.normalize({ id: qa.itemId });
      return card;
    };
    const battle = { playerId: player.id, activeCrewIndex: 0, islandId: "enma-trial-qa", islandKind: "enemy", enemyCombatant: { id: "qa-enemy", name: "測試敵人" } };
    const standalone = qa.cinematicFor(makeCard(qa.newWorldFormId), battle);
    const arsenal = qa.cinematicFor(makeCard(qa.newWorldFormId, "arsenal"), battle);
    const noItem = qa.cinematicFor(makeCard(qa.newWorldFormId, "none"), battle);
    const base = qa.cinematicFor(makeCard("base"), battle);
    const zorojuro = qa.cinematicFor(makeCard(qa.zorojuroFormId), battle);
    const spar = qa.cinematicFor(makeCard(qa.newWorldFormId), { ...battle, isSparBattle: true });
    player.crew = [makeCard(qa.newWorldFormId)];
    player.activeCrewIndex = 0;
    const intro = qa.createIntro(player, battle);
    return { standalone, arsenal, noItem, base, zorojuro, spar, intro };
  });
  await desktopPage.close();

  const expectedLines = [
    "來測試這把新刀如何。",
    "……！這把刀在吸走我的霸氣。",
    "可惡……！",
    "給我還回來！",
    "閻魔嗎……等我習慣它，就能變得更強吧。",
    "你也想測試我嗎？我會贏下這場戰鬥，證明給你看的。",
  ];
  const expectedDurations = [3000, 3000, 2400, 2400, 3800, 4200];
  if (logic.standalone?.frames?.length !== 6) errors.push(`logic:單件閻魔幕數=${logic.standalone?.frames?.length}`);
  if (logic.arsenal?.frames?.length !== 6) errors.push(`logic:武器庫閻魔幕數=${logic.arsenal?.frames?.length}`);
  if (logic.noItem || logic.base || logic.zorojuro || logic.spar) errors.push("logic:非新世界索隆／未攜帶／索隆十郎／切磋不應觸發");
  if (logic.intro?.cinematic?.kind !== "enma_trial") errors.push("logic:正式開場未標記 enma_trial");
  if (!expectedLines.every((line, index) => logic.intro?.cinematic?.frames?.[index]?.text === line)) errors.push("logic:六幕台詞不符");
  if (!expectedDurations.every((duration, index) => logic.intro?.cinematic?.frames?.[index]?.durationMs === duration)) errors.push("logic:六幕停留時間不符");
  if (!logic.intro?.cinematic?.frames?.every((frame) => frame.speaker === "新世界索隆")) errors.push("logic:六幕說話者不符");
  if (JSON.stringify(logic.intro).includes("鬼徹") || JSON.stringify(logic.intro).includes("索隆十郎")) errors.push("logic:閻魔開場混入鬼徹或索隆十郎文字");

  const imageAudit = await desktopContext.request.get(`${ROOT_URL}/images/board/battle/cinematics/enma_trial_v1/frame_01.webp`);
  if (!imageAudit.ok()) errors.push(`image:first=${imageAudit.status()}`);
  const imageDimensions = await desktopContext.newPage();
  await imageDimensions.goto(`${ROOT_URL}/board_game.html?zoro_enma_trial_asset_qa=1`, { waitUntil: "domcontentloaded" });
  const assets = await imageDimensions.evaluate(async (rootUrl) => Promise.all(Array.from({ length: 6 }, async (_entry, index) => {
    const src = `${rootUrl}/images/board/battle/cinematics/enma_trial_v1/frame_${String(index + 1).padStart(2, "0")}.webp`;
    const response = await fetch(src, { cache: "no-store" });
    const bitmap = response.ok ? await createImageBitmap(await response.blob()) : null;
    return { src, ok: response.ok, width: bitmap?.width || 0, height: bitmap?.height || 0 };
  })), ROOT_URL);
  await imageDimensions.close();
  assets.forEach((entry) => {
    if (!entry.ok || entry.width !== 1672 || entry.height !== 941) errors.push(`asset:${entry.src}:${entry.ok}/${entry.width}x${entry.height}`);
  });

  const desktopRunPage = await desktopContext.newPage();
  captureErrors(desktopRunPage, errors, "desktop-run");
  const desktopIntro = await prepareBattle(desktopRunPage);
  const desktop = await collectCinematic(desktopRunPage, "desktop", errors);
  await desktopRunPage.close();
  await desktopContext.close();

  const tabletContext = await browser.newContext({ viewport: { width: 932, height: 430 } });
  await tabletContext.addInitScript(() => sessionStorage.removeItem("onepiece-board-prebattle-intro-done-v3"));
  const tabletPage = await tabletContext.newPage();
  captureErrors(tabletPage, errors, "tablet");
  const tabletIntro = await prepareBattle(tabletPage);
  const tablet = await collectCinematic(tabletPage, "tablet", errors);
  await tabletPage.close();
  await tabletContext.close();
  await browser.close();

  const validateSamples = (label, samples) => {
    if (samples.length !== 6) errors.push(`${label}:samples=${samples.length}`);
    samples.forEach((sample, index) => {
      if (!sample.className.includes("enma-trial")) errors.push(`${label}:frame${index + 1}:class=${sample.className}`);
      if (sample.index !== index || sample.progressCount !== 6 || sample.activeProgressCount !== 1) errors.push(`${label}:frame${index + 1}:progress/index`);
      if (!sample.src.endsWith(`/frame_${String(index + 1).padStart(2, "0")}.webp`)) errors.push(`${label}:frame${index + 1}:src=${sample.src}`);
      if (sample.objectFit !== "contain") errors.push(`${label}:frame${index + 1}:objectFit=${sample.objectFit}`);
      if (sample.buttonCount !== 0) errors.push(`${label}:frame${index + 1}:unexpected button`);
      if (sample.overflowX || sample.overflowY) errors.push(`${label}:frame${index + 1}:overflow`);
      if (sample.dialogueRect && sample.layerRect && (sample.dialogueRect.left < sample.layerRect.left || sample.dialogueRect.right > sample.layerRect.right || sample.dialogueRect.bottom > sample.layerRect.bottom)) {
        errors.push(`${label}:frame${index + 1}:dialogue outside layer`);
      }
    });
    samples.forEach((sample, index) => {
      if (sample.text !== expectedLines[index] || sample.speaker !== "新世界索隆" || sample.dialogueHidden) {
        errors.push(`${label}:frame${index + 1}:六幕對話顯示不符`);
      }
    });
  };
  validateSamples("desktop", desktop.samples);
  validateSamples("tablet", tablet.samples);
  if (!desktop.finalState.introDone || !desktop.finalState.canAct) errors.push(`desktop:final=${JSON.stringify(desktop.finalState)}`);
  if (!tablet.finalState.introDone || !tablet.finalState.canAct) errors.push(`tablet:final=${JSON.stringify(tablet.finalState)}`);

  const report = {
    pass: errors.length === 0,
    errors,
    assets,
    logic: {
      standaloneFrames: logic.standalone?.frames?.length || 0,
      arsenalFrames: logic.arsenal?.frames?.length || 0,
      rejects: { noItem: !logic.noItem, base: !logic.base, zorojuro: !logic.zorojuro, spar: !logic.spar },
      lines: logic.intro?.cinematic?.frames?.map((frame) => frame.text || "") || [],
    },
    desktopIntro,
    tabletIntro,
    desktop,
    tablet,
    outputDir: OUTPUT_DIR,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (errors.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
