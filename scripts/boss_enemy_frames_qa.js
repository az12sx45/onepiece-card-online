const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.join(process.cwd(), "tmp", "boss_enemy_frames_qa");

const POSTGAME_FRAME_IDS = Object.freeze({
  postgame_shiki: "postgameShiki",
  postgame_gild_tesoro: "postgameGildTesoro",
  postgame_zephyr: "postgameZephyr",
  postgame_tot_musica: "postgameTotMusica",
  postgame_douglas_bullet: "postgameDouglasBullet",
  postgame_saga: "postgameSaga",
  postgame_vinsmoke_judge: "postgameVinsmokeJudge",
  postgame_rob_lucci_awakened: "postgameRobLucciAwakened",
  postgame_king: "postgameKing",
  postgame_charlotte_katakuri: "postgameCharlotteKatakuri",
  postgame_patrick_redfield: "postgamePatrickRedfield",
  postgame_loki: "postgameLoki",
  postgame_aramaki: "postgameAramaki",
});

const YONKO_FRAME_IDS = Object.freeze({
  yonko_blackbeard: "yonkoBlackbeard",
  yonko_shanks: "yonkoShanks",
  yonko_bigmom: "yonkoBigMom",
  yonko_kaido: "enemyYonkoKaido",
});

function attachErrorCapture(page, errors, label) {
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

async function initializeHost(host) {
  await host.goto(`${ROOT_URL}/board_game.html?boss_enemy_frames_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.crew.forEach((card) => {
      card.currentHp = Math.max(1, Number(card.maxHp || card.stats?.hp || card.baseStats?.hp || card.currentHp || 999));
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    player.isCpu = false;
    player.cpu = false;
    if (player.type === "cpu") player.type = "human";
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) {
      debug.unlockPostgameWorldAfterEnding(player, { id: "boss-enemy-frames-qa" });
    }
    debug.ensurePostgameWorldLayout(state.gameState);
    return {
      playerId: player.id,
      bossOrder: state.gameState.postgameWorld.bossOrder.slice(),
    };
  });
}

async function preparePostgameBattle(host, bossKey) {
  return host.evaluate((requestedBossKey) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.isCpu = false;
    player.cpu = false;
    if (player.type === "cpu") player.type = "human";
    player.pendingBattle = null;
    state.battleState = null;
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
    debug.notifyBattleWindow();
    const overlay = document.getElementById("battlePageOverlay");
    overlay?.classList.add("open", "ready");
    overlay?.classList.remove("transitioning", "closing");
    const view = debug.getBattleView();
    return {
      bossKey: requestedBossKey,
      frameId: view?.enemy?.cosmeticFrameId || view?.battle?.enemy?.cosmeticFrameId || "",
      enemyName: view?.enemy?.name || view?.battle?.enemy?.name || "",
    };
  }, bossKey);
}

async function prepareCpuYonkoBattle(host, yonkoKey) {
  return host.evaluate((requestedYonkoKey) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.isCpu = false;
    player.cpu = false;
    if (player.type === "cpu") player.type = "human";
    player.pendingBattle = null;
    state.battleState = null;
    const island = state.gameState.boardData?.islands?.find((entry) => entry.glyphId === requestedYonkoKey);
    if (!island) throw new Error(`Missing Yonko island for ${requestedYonkoKey}`);
    const islandState = debug.getIslandState(island.id);
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
    player.isCPU = true;
    player.isCpu = true;
    player.cpu = true;
    debug.notifyBattleWindow();
    const overlay = document.getElementById("battlePageOverlay");
    overlay?.classList.add("open", "ready");
    overlay?.classList.remove("transitioning", "closing");
    const view = debug.getBattleView();
    const cpuPlayer = Boolean(player.isCPU || player.isCpu || player.cpu);
    player.isCPU = false;
    player.isCpu = false;
    player.cpu = false;
    return {
      yonkoKey: requestedYonkoKey,
      cpuPlayer,
      frameId: view?.enemy?.cosmeticFrameId || view?.battle?.enemy?.cosmeticFrameId || "",
      enemyName: view?.enemy?.name || view?.battle?.enemy?.name || "",
    };
  }, yonkoKey);
}

async function inspectFrame(battlePage, expectedFrameId) {
  await battlePage.waitForFunction((frameId) => {
    const layer = document.querySelector(`#enemyCard .cosmetic-frame-layer[data-frame-id="${frameId}"]`);
    return layer && layer.complete && layer.naturalWidth > 0;
  }, expectedFrameId, { timeout: 12000 });
  await battlePage.waitForTimeout(180);
  return battlePage.evaluate((frameId) => {
    const card = document.getElementById("enemyCard");
    const portrait = document.getElementById("enemyPortrait");
    const name = document.getElementById("enemyCardName");
    const layers = Array.from(card.querySelectorAll(".cosmetic-frame-layer"));
    const selected = layers.filter((layer) => layer.dataset.frameId === frameId);
    const cardRect = card.getBoundingClientRect();
    const portraitRect = portrait.getBoundingClientRect();
    return {
      frameId,
      layerCount: selected.length,
      allLayerFrameIds: [...new Set(layers.map((layer) => layer.dataset.frameId))],
      layerStyles: selected.map((layer) => ({
        layerId: layer.dataset.layerId || "",
        opacity: Number(getComputedStyle(layer).opacity || 0),
        blend: getComputedStyle(layer).mixBlendMode,
      })),
      brokenLayers: selected.filter((layer) => !layer.complete || layer.naturalWidth <= 0).map((layer) => layer.src),
      baseHidden: card.classList.contains("cosmetic-frame-hide-base"),
      cardRect: { x: cardRect.x, y: cardRect.y, width: cardRect.width, height: cardRect.height },
      portraitRect: { x: portraitRect.x, y: portraitRect.y, width: portraitRect.width, height: portraitRect.height },
      portraitNaturalSize: { width: portrait.naturalWidth, height: portrait.naturalHeight },
      portraitFit: getComputedStyle(portrait).objectFit,
      name: name?.textContent.trim() || "",
      nameOverflow: Boolean(name && (name.scrollWidth > name.clientWidth + 2 || name.scrollHeight > name.clientHeight + 2)),
      viewport: { width: innerWidth, height: innerHeight },
    };
  }, expectedFrameId);
}

let activeBrowser = null;

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  activeBrowser = browser;
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const host = await context.newPage();
  attachErrorCapture(host, errors, "host");
  const initialized = await initializeHost(host);
  console.log(`initialized:${initialized.bossOrder.length}`);

  await preparePostgameBattle(host, initialized.bossOrder[0]);
  await host.waitForFunction(() => {
    const frame = document.getElementById("battlePageFrame");
    return frame?.contentDocument?.readyState === "complete" && frame.contentDocument.getElementById("enemyCard");
  }, null, { timeout: 15000 });
  const battlePage = host.frames().find((frame) => frame.url().includes("board_battle.html"));
  if (!battlePage) throw new Error("Battle iframe did not load");
  battlePage.on("pageerror", (error) => errors.push(`battle:pageerror:${error.message}`));

  const postgameResults = [];
  for (const bossKey of initialized.bossOrder) {
    const prepared = await preparePostgameBattle(host, bossKey);
    const ui = await inspectFrame(battlePage, POSTGAME_FRAME_IDS[bossKey]);
    await battlePage.locator("#enemyCard").screenshot({
      path: path.join(OUTPUT_DIR, `${bossKey}_card.png`),
      animations: "disabled",
      caret: "hide",
      timeout: 10000,
    });
    postgameResults.push({ bossKey, expected: POSTGAME_FRAME_IDS[bossKey], prepared, ui });
    console.log(`postgame:${bossKey}:${prepared.frameId}:${ui.layerCount}`);
  }

  const yonkoResults = [];
  for (const yonkoKey of Object.keys(YONKO_FRAME_IDS)) {
    const prepared = await prepareCpuYonkoBattle(host, yonkoKey);
    const ui = await inspectFrame(battlePage, YONKO_FRAME_IDS[yonkoKey]);
    yonkoResults.push({ yonkoKey, expected: YONKO_FRAME_IDS[yonkoKey], prepared, ui });
    console.log(`yonko-cpu:${yonkoKey}:${prepared.frameId}:${ui.layerCount}`);
    if (yonkoKey === "yonko_kaido") {
      const aura = ui.layerStyles.find((layer) => layer.layerId === "aura");
      if (!aura || aura.opacity > 0.25) {
        errors.push(`yonko_kaido:aura-opacity:${aura?.opacity ?? "missing"}`);
      }
      await host.screenshot({ path: path.join(OUTPUT_DIR, "cpu_watching_kaido_desktop.png"), fullPage: true });
    }
  }

  await host.setViewportSize({ width: 932, height: 430 });
  const mobilePrepared = await preparePostgameBattle(host, "postgame_charlotte_katakuri");
  const mobileUi = await inspectFrame(battlePage, POSTGAME_FRAME_IDS.postgame_charlotte_katakuri);
  await host.screenshot({ path: path.join(OUTPUT_DIR, "postgame_katakuri_phone_landscape.png"), fullPage: true });

  const report = {
    rootUrl: ROOT_URL,
    initialized,
    postgameResults,
    yonkoResults,
    mobile: { prepared: mobilePrepared, ui: mobileUi },
    errors,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  activeBrowser = null;
})().catch((error) => {
  console.error(error);
  Promise.resolve(activeBrowser?.close())
    .catch(() => {})
    .finally(() => process.exit(1));
});
