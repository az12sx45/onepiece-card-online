const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/lucci_six_powers_20260814_v48";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`${label}:http:${response.status()}:${response.url()}`);
  });
}

async function prepareBattle(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    while (player.crew.length < 6) player.crew.push(debug.cloneCard(window.BoardCards.cards[player.crew.length % window.BoardCards.cards.length]));
    player.crew.forEach((card) => {
      card.battleCarryItem = null;
      card.currentHp = Math.max(1, Number(card.maxHp || card.stats?.hp || card.baseStats?.hp || 999));
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "lucci-six-powers-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_rob_lucci_awakened");
    if (!assignment) throw new Error("Missing awakened Lucci island assignment");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = state.battleState;
    const mechanic = battle.postgameBossMechanic;
    if (mechanic?.key === "postgame_rob_lucci_awakened") {
      mechanic.nodes = [];
      mechanic.activePower = "";
      mechanic.activePowerId = "";
      mechanic.activePowerStat = "";
      mechanic.activePowerRound = 0;
      mechanic.rokuoganPending = false;
    }
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualPlayed = {};
    battle.visualEvent = null;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    return { islandId: assignment.islandId, enemy: battle.enemyCombatant.name };
  });
}

async function showPower(host, roundIndex) {
  return host.evaluate((round) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    battle.roundIndex = round;
    battle.playerAction = null;
    battle.enemyAction = null;
    battle.playerPerformedAction = false;
    debug.postgameBossMechanicQa.roundStart(player, battle);
    const selected = debug.postgameBossMechanicQa.activeLucciPower(battle);
    const eventIndex = (battle.openingPassiveVisualQueue || []).findIndex((entry) => entry.type === "postgame-lucci-six-power");
    const event = eventIndex >= 0 ? battle.openingPassiveVisualQueue.splice(eventIndex, 1)[0] : null;
    battle.visualEvent = event;
    return {
      selected,
      event,
      beforePlayerAction: battle.playerAction === null && !battle.playerPerformedAction,
      enemyActionChosen: battle.enemyAction !== null,
    };
  }, roundIndex);
}

async function inspectVisual(page) {
  await page.waitForFunction(() => document.getElementById("lucciSixPowerFx")?.classList.contains("show"), null, { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById("lucciSixPowerFx")?.classList.contains("has-image"), null, { timeout: 10000 });
  await page.waitForTimeout(700);
  return page.evaluate(() => {
    const overlay = document.getElementById("lucciSixPowerFx");
    const name = document.getElementById("lucciSixPowerName");
    const effect = document.getElementById("lucciSixPowerEffect");
    const image = document.getElementById("lucciSixPowerImage");
    const overlayRect = overlay.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    const effectRect = effect.getBoundingClientRect();
    const imageRect = image.getBoundingClientRect();
    const inside = (rect) => rect.left >= -2 && rect.top >= -2 && rect.right <= innerWidth + 2 && rect.bottom <= innerHeight + 2;
    return {
      name: name.textContent.trim(),
      effect: effect.textContent.trim(),
      overlayOpacity: Number.parseFloat(getComputedStyle(overlay).opacity || "0"),
      nameOpacity: Number.parseFloat(getComputedStyle(name).opacity || "0"),
      nameDisplay: getComputedStyle(name).display,
      effectOpacity: Number.parseFloat(getComputedStyle(effect).opacity || "0"),
      imageOpacity: Number.parseFloat(getComputedStyle(image).opacity || "0"),
      overlayInside: inside(overlayRect),
      nameInside: inside(nameRect),
      effectInside: inside(effectRect),
      imageInside: inside(imageRect),
      imageHasSource: image.hasAttribute("src"),
      imageSource: image.currentSrc || image.src || "",
      imageNaturalWidth: image.naturalWidth,
      imageNaturalHeight: image.naturalHeight,
      hasImageClass: overlay.classList.contains("has-image"),
      bodyOverflowX: document.documentElement.scrollWidth > innerWidth + 2,
      bodyOverflowY: document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
}

async function inspectMechanicPanel(page) {
  await page.waitForFunction(() => document.querySelector(".boss-mechanic-status-icon"), null, { timeout: 10000 });
  const trigger = page.locator(".boss-mechanic-status-icon");
  if (await trigger.getAttribute("aria-expanded") !== "true") await trigger.click();
  await page.waitForFunction(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    return panel && !panel.hidden;
  }, null, { timeout: 10000 });
  await page.waitForTimeout(120);
  return page.evaluate(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    const rect = panel.getBoundingClientRect();
    const watched = Array.from(panel.querySelectorAll(".postgame-boss-mechanic-title, .postgame-boss-mechanic-guide-row, .postgame-mechanic-pip, .postgame-boss-mechanic-state > strong, .postgame-boss-mechanic-state > span:not(.postgame-mechanic-pips):not(.postgame-mechanic-crew)"));
    return {
      title: document.getElementById("postgameBossMechanicTitle")?.textContent.trim() || "",
      rule: document.getElementById("postgameBossMechanicRule")?.textContent.trim() || "",
      counter: document.getElementById("postgameBossMechanicCounter")?.textContent.trim() || "",
      stateText: document.getElementById("postgameBossMechanicState")?.innerText.trim() || "",
      pipCount: panel.querySelectorAll(".postgame-mechanic-pip").length,
      currentPipCount: panel.querySelectorAll(".postgame-mechanic-pip.current").length,
      panelInside: rect.left >= -2 && rect.top >= -2 && rect.right <= innerWidth + 2 && rect.bottom <= innerHeight + 2,
      textOverflow: watched.filter((node) => node.scrollWidth > node.clientWidth + 2 || node.scrollHeight > node.clientHeight + 3).map((node) => node.textContent.trim()),
    };
  });
}

async function inspectApprovedAssets(page) {
  const names = ["soru", "tekkai", "kamie", "geppo", "shigan", "rankyaku"];
  return page.evaluate(async (assetNames) => Promise.all(assetNames.map((name) => new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const cornerAlpha = [
        context.getImageData(0, 0, 1, 1).data[3],
        context.getImageData(canvas.width - 1, 0, 1, 1).data[3],
        context.getImageData(0, canvas.height - 1, 1, 1).data[3],
        context.getImageData(canvas.width - 1, canvas.height - 1, 1, 1).data[3],
      ];
      resolve({ name, ok: true, width: image.naturalWidth, height: image.naturalHeight, cornerAlpha });
    };
    image.onerror = () => resolve({ name, ok: false, width: 0, height: 0, cornerAlpha: [] });
    image.src = `images/board/battle/postgame_mechanics/lucci_six_powers/${name}.webp`;
  }))), names);
}

async function showRokuogan(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const card = player.crew[battle.activeCrewIndex];
    card.stats = { ...(card.stats || {}), hp: Math.max(800, Number(card.stats?.hp || 0)) };
    card.baseStats = { ...(card.baseStats || {}), hp: Math.max(800, Number(card.baseStats?.hp || 0)) };
    card.currentHp = Math.max(800, Number(card.maxHp || card.stats?.hp || 800));
    card.maxHp = Math.max(card.currentHp, Number(card.maxHp || card.currentHp));
    const damage = 321;
    const startHp = card.currentHp;
    card.currentHp = Math.max(1, startHp - damage);
    battle.visualEvent = {
      id: `qa-rokuogan-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: "attack",
      side: "enemy",
      targetSide: "player",
      actorName: battle.enemyCombatant.name,
      targetName: card.name,
      moveName: "覺醒・六王銃",
      moveType: "special",
      specialFx: "lucci-rokuogan",
      voiceSfx: "audio/board_game/sfx/postgame_boss/lucci_rokuogan/lucci_rokuogan_call.mp3",
      hitVoiceSfx: "audio/board_game/sfx/postgame_boss/lucci_rokuogan/lucci_rokuogan_hit.mp3",
      damage,
      hitDamages: [damage],
      critical: false,
      startHp: { player: startHp, enemy: battle.enemyCombatant.currentHp },
      finalHp: { player: card.currentHp, enemy: battle.enemyCombatant.currentHp },
      miss: false,
      duration: 7600,
    };
    debug.notifyBattleWindow();
    return {
      moveName: battle.visualEvent.moveName,
      specialFx: battle.visualEvent.specialFx,
      voiceSfx: battle.visualEvent.voiceSfx,
      hitVoiceSfx: battle.visualEvent.hitVoiceSfx,
      startHp,
      finalHp: card.currentHp,
      damage,
    };
  });
}

async function installRokuoganBgmMock(host) {
  await host.evaluate(() => {
    window.__ROKUOGAN_BGM_QA__ = [];
    window.BgmManager = {
      status() {
        window.__ROKUOGAN_BGM_QA__.push({ type: "status", at: performance.now() });
        return { enabled: true, currentChoice: { id: "qa-battle-bgm" } };
      },
      lockAutoSwitch(reason) {
        window.__ROKUOGAN_BGM_QA__.push({ type: "lock", reason, at: performance.now() });
        return () => window.__ROKUOGAN_BGM_QA__.push({ type: "unlock", reason, at: performance.now() });
      },
      fadeOut(duration) {
        window.__ROKUOGAN_BGM_QA__.push({ type: "fadeOut", duration, at: performance.now() });
        return Promise.resolve();
      },
      fadeIn(duration) {
        window.__ROKUOGAN_BGM_QA__.push({ type: "fadeIn", duration, at: performance.now() });
        return Promise.resolve();
      },
      chooseAndPlay() {
        return { id: "qa-battle-bgm" };
      },
    };
  });
}

async function inspectRokuogan(page, phase) {
  await page.waitForFunction(() => document.getElementById("lucciRokuoganFx")?.classList.contains("show"), null, { timeout: 10000 });
  await page.waitForTimeout(phase === "cast" ? 1200 : 3400);
  return page.evaluate((phaseName) => {
    const overlay = document.getElementById("lucciRokuoganFx");
    const cast = document.getElementById("lucciRokuoganCast");
    const impact = document.getElementById("lucciRokuoganImpact");
    const overlayRect = overlay.getBoundingClientRect();
    const castRect = cast.getBoundingClientRect();
    const impactRect = impact.getBoundingClientRect();
    const inside = (rect) => rect.left >= -2 && rect.top >= -2 && rect.right <= innerWidth + 2 && rect.bottom <= innerHeight + 2;
    return {
      phase: phaseName,
      visible: overlay.classList.contains("show") && Number.parseFloat(getComputedStyle(overlay).opacity || "0") > 0,
      impacting: overlay.classList.contains("impacting"),
      castOpacity: Number.parseFloat(getComputedStyle(cast).opacity || "0"),
      impactOpacity: Number.parseFloat(getComputedStyle(impact).opacity || "0"),
      castNaturalSize: [cast.naturalWidth, cast.naturalHeight],
      impactNaturalSize: [impact.naturalWidth, impact.naturalHeight],
      castSource: cast.currentSrc || cast.src || "",
      impactSource: impact.currentSrc || impact.src || "",
      castKeyframes: cast.getAnimations().flatMap((animation) => animation.effect?.getKeyframes?.() || []).map((frame) => ({ offset: frame.offset, opacity: frame.opacity, transform: frame.transform })),
      overlayInside: inside(overlayRect),
      castInside: inside(castRect),
      impactTouchesViewport: impactRect.right >= 0 && impactRect.left <= innerWidth && impactRect.bottom >= 0 && impactRect.top <= innerHeight,
      damageNumbers: Array.from(document.querySelectorAll(".damage-number")).map((node) => node.textContent.trim()),
      audioState: window.__BOARD_BATTLE_DEBUG__?.lucciRokuoganAudioState?.() || null,
      bgmPausedMarker: overlay.dataset.bgmPaused || "",
      effectAudioSilencedMarker: overlay.dataset.effectAudioSilenced || "",
      rootBackground: getComputedStyle(document.documentElement).backgroundColor,
      bodyBackground: getComputedStyle(document.body).backgroundColor,
      bodyOverflowX: document.documentElement.scrollWidth > innerWidth + 2,
      bodyOverflowY: document.documentElement.scrollHeight > innerHeight + 2,
    };
  }, phase);
}

async function inspectRokuoganAftermath(page) {
  return page.evaluate(() => {
    const overlay = document.getElementById("lucciRokuoganFx");
    const playerCard = document.getElementById("playerCard");
    const playerPortrait = document.getElementById("playerPortrait");
    return {
      overlayCleared: !overlay?.classList.contains("show"),
      playerHitPose: !!playerCard?.classList.contains("portrait-hit"),
      playerPortraitSource: playerPortrait?.currentSrc || playerPortrait?.src || "",
      playerPortraitNaturalSize: [Number(playerPortrait?.naturalWidth || 0), Number(playerPortrait?.naturalHeight || 0)],
      damageNumbers: Array.from(document.querySelectorAll(".damage-number")).map((node) => node.textContent.trim()),
      audioState: window.__BOARD_BATTLE_DEBUG__?.lucciRokuoganAudioState?.() || null,
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?lucci_six_powers_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });
  await prepareBattle(host);
  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?lucci_six_powers_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");
  const assetChecks = await inspectApprovedAssets(battlePage);

  const desktopEvent = await showPower(host, 1);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const desktopVisual = await inspectVisual(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_six_power_desktop.png"), fullPage: true });

  await battlePage.waitForTimeout(2000);
  const desktopPanel = await inspectMechanicPanel(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_six_power_panel_desktop.png"), fullPage: true });
  await battlePage.setViewportSize({ width: 932, height: 430 });
  const phoneEvent = await showPower(host, 2);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const phoneVisual = await inspectVisual(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_six_power_phone.png"), fullPage: true });
  await battlePage.waitForTimeout(2000);
  const phonePanel = await inspectMechanicPanel(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_six_power_panel_phone.png"), fullPage: true });

  await installRokuoganBgmMock(host);
  await battlePage.setViewportSize({ width: 1600, height: 900 });
  const desktopRokuoganEvent = await showRokuogan(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const desktopRokuoganCast = await inspectRokuogan(battlePage, "cast");
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_cast_desktop.png"), fullPage: true });
  await showRokuogan(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const desktopRokuoganImpact = await inspectRokuogan(battlePage, "impact");
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_impact_desktop.png"), fullPage: true });
  await battlePage.waitForFunction(() => !document.getElementById("lucciRokuoganFx")?.classList.contains("show"), null, { timeout: 3000 });
  const desktopRokuoganReveal = await inspectRokuoganAftermath(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_reveal_desktop.png"), fullPage: true });
  await battlePage.waitForFunction(() => document.getElementById("playerCard")?.classList.contains("portrait-hit"), null, { timeout: 2000 });
  const desktopRokuoganHit = await inspectRokuoganAftermath(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_hit_desktop.png"), fullPage: true });

  await battlePage.setViewportSize({ width: 932, height: 430 });
  const phoneRokuoganEvent = await showRokuogan(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const phoneRokuoganCast = await inspectRokuogan(battlePage, "cast");
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_cast_phone.png"), fullPage: true });
  await showRokuogan(host);
  await battlePage.reload({ waitUntil: "domcontentloaded" });
  const phoneRokuoganImpact = await inspectRokuogan(battlePage, "impact");
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_impact_phone.png"), fullPage: true });
  await battlePage.waitForFunction(() => !document.getElementById("lucciRokuoganFx")?.classList.contains("show"), null, { timeout: 3000 });
  const phoneRokuoganReveal = await inspectRokuoganAftermath(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_reveal_phone.png"), fullPage: true });
  await battlePage.waitForFunction(() => document.getElementById("playerCard")?.classList.contains("portrait-hit"), null, { timeout: 2000 });
  const phoneRokuoganHit = await inspectRokuoganAftermath(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "lucci_rokuogan_hit_phone.png"), fullPage: true });
  await battlePage.waitForFunction(() => {
    const audioState = window.__BOARD_BATTLE_DEBUG__?.lucciRokuoganAudioState?.();
    return audioState && !audioState.effectAudioSilenced && !audioState.bgmHeld;
  }, null, { timeout: 3000 });
  const postRokuoganAudioState = await battlePage.evaluate(() => window.__BOARD_BATTLE_DEBUG__?.lucciRokuoganAudioState?.() || null);
  const rokuoganBgmLog = await host.evaluate(() => window.__ROKUOGAN_BGM_QA__ || []);

  await prepareBattle(host);
  const behavior = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const qa = debug.postgameBossMechanicQa;
    const mechanic = battle.postgameBossMechanic;
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
      } else {
        boosts.push({ stat: selected?.stat || "", value: qa.enemyStat(100, selected?.stat, player, battle) });
      }
      if (round === 6) {
        action = cycleAction;
        ultimate = battle.enemyCombatant.moveSet.find((entry) => entry.id === action.moveId);
        battle.playerStages.evasion = 6;
        guaranteed = qa.moveHits("enemy", ultimate, player, battle);
        beforeReset = { nodes: mechanic.nodes.length, pending: mechanic.rokuoganPending };
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
      action,
      ultimate: { power: ultimate?.power, ignoreDefenseRatio: ultimate?.effects?.ignoreDefenseRatio },
      guaranteed,
      beforeReset,
      afterReset: { nodes: mechanic.nodes.length, pending: mechanic.rokuoganPending },
      view: qa.view(player, battle),
    };
  });

  const allowed = ["剃", "鐵塊", "紙繪", "月步", "指槍", "嵐腳"];
  const failures = [];
  for (const [label, event, visual] of [["desktop", desktopEvent, desktopVisual], ["phone", phoneEvent, phoneVisual]]) {
    if (!event.event || event.event.type !== "postgame-lucci-six-power") failures.push(`${label}: visual event missing`);
    if (!event.beforePlayerAction || event.enemyActionChosen) failures.push(`${label}: six power was not drawn before the player action`);
    if (!allowed.includes(visual.name)) failures.push(`${label}: wrong ink name ${visual.name}`);
    if (!/提高 80%/.test(visual.effect)) failures.push(`${label}: effect label missing`);
    if (visual.overlayOpacity <= 0 || visual.imageOpacity <= 0 || visual.effectOpacity <= 0) failures.push(`${label}: ink image visual not visible`);
    if (!visual.imageInside || !visual.effectInside) failures.push(`${label}: ink image outside viewport`);
    if (!visual.imageHasSource || !visual.hasImageClass || visual.imageNaturalWidth <= 0 || visual.imageNaturalHeight <= 0) failures.push(`${label}: formal ink image failed to decode`);
    if (!/images\/board\/battle\/postgame_mechanics\/lucci_six_powers\/(soru|tekkai|kamie|geppo|shigan|rankyaku)\.webp/.test(visual.imageSource) || /\/incoming\//.test(visual.imageSource)) failures.push(`${label}: wrong formal ink image source ${visual.imageSource}`);
    if (visual.nameDisplay !== "none") failures.push(`${label}: fallback text still covers the approved image`);
    if (visual.bodyOverflowX || visual.bodyOverflowY) failures.push(`${label}: document overflow`);
  }
  for (const [label, panel] of [["desktop", desktopPanel], ["phone", phonePanel]]) {
    if (panel.title !== "六式獵殺輪" || !/隨機抽出一式/.test(panel.rule) || !/剃強化速度/.test(panel.counter)) failures.push(`${label}: mechanism copy incomplete`);
    if (panel.pipCount !== 6 || panel.currentPipCount !== 1 || !/提高 80%/.test(panel.stateText)) failures.push(`${label}: six-power state incomplete`);
    if (!panel.panelInside) failures.push(`${label}: mechanism panel outside viewport`);
    if (panel.textOverflow.length) failures.push(`${label}: mechanism text overflow ${panel.textOverflow.join(" / ")}`);
  }
  for (const asset of assetChecks) {
    if (!asset.ok || asset.width <= 0 || asset.height <= 0) failures.push(`${asset.name}: approved ink image failed to load`);
    if (asset.width !== asset.height) failures.push(`${asset.name}: approved ink image is not square (${asset.width}x${asset.height})`);
    if (asset.cornerAlpha.some((alpha) => alpha > 16)) failures.push(`${asset.name}: approved ink image has a visibly opaque corner`);
  }
  for (const [label, event, castPhase, impactPhase] of [
    ["desktop", desktopRokuoganEvent, desktopRokuoganCast, desktopRokuoganImpact],
    ["phone", phoneRokuoganEvent, phoneRokuoganCast, phoneRokuoganImpact],
  ]) {
    if (event.moveName !== "覺醒・六王銃" || event.specialFx !== "lucci-rokuogan" || event.startHp - event.finalHp !== event.damage) failures.push(`${label}: Rokuogan attack event mismatch`);
    if (!/lucci_rokuogan_call\.mp3$/.test(event.voiceSfx || "") || !/lucci_rokuogan_hit\.mp3$/.test(event.hitVoiceSfx || "")) failures.push(`${label}: Rokuogan voice event paths mismatch`);
    if (!castPhase.visible || castPhase.castOpacity <= 0 || castPhase.impactOpacity > 0.1) failures.push(`${label}: Rokuogan cast phase mismatch`);
    if (!castPhase.audioState?.effectAudioSilenced || !castPhase.audioState?.bgmHeld || castPhase.audioState?.lastVoiceKey !== "call" || !/lucci_rokuogan_call\.mp3$/.test(castPhase.audioState?.lastVoiceSrc || "")) failures.push(`${label}: Rokuogan cast audio hold mismatch`);
    if (castPhase.bgmPausedMarker !== "true" || castPhase.effectAudioSilencedMarker !== "true") failures.push(`${label}: Rokuogan cast silence markers missing`);
    if (castPhase.rootBackground !== "rgb(1, 1, 8)" || castPhase.bodyBackground !== "rgb(1, 1, 8)") failures.push(`${label}: Rokuogan did not darken the full viewport`);
    if (!castPhase.castKeyframes.some((frame) => /scale\(0?\.92\)/.test(frame.transform || "")) || !castPhase.castKeyframes.some((frame) => /scale\(1\.36\)/.test(frame.transform || ""))) failures.push(`${label}: Rokuogan forward punch zoom is missing`);
    if (!impactPhase.visible || !impactPhase.impacting || impactPhase.impactOpacity <= 0) failures.push(`${label}: Rokuogan impact phase mismatch`);
    if (!impactPhase.audioState?.effectAudioSilenced || !impactPhase.audioState?.bgmHeld || impactPhase.audioState?.lastVoiceKey !== "call" || !/lucci_rokuogan_call\.mp3$/.test(impactPhase.audioState?.lastVoiceSrc || "")) failures.push(`${label}: Rokuogan cinematic played the hit voice before revealing the player`);
    if (castPhase.castNaturalSize[0] !== 1254 || castPhase.castNaturalSize[1] !== 1254 || castPhase.impactNaturalSize[0] !== 1254 || castPhase.impactNaturalSize[1] !== 1254) failures.push(`${label}: Rokuogan asset size mismatch`);
    if (!/postgame_mechanics\/lucci_rokuogan\/rokuogan_cast\.webp/.test(castPhase.castSource) || !/postgame_mechanics\/lucci_rokuogan\/rokuogan_impact\.webp/.test(castPhase.impactSource) || /\/incoming\//.test(`${castPhase.castSource} ${castPhase.impactSource}`)) failures.push(`${label}: Rokuogan formal source mismatch`);
    if (!castPhase.overlayInside || !castPhase.castInside || !impactPhase.impactTouchesViewport || castPhase.bodyOverflowX || castPhase.bodyOverflowY || impactPhase.bodyOverflowX || impactPhase.bodyOverflowY) failures.push(`${label}: Rokuogan layout overflow`);
    if (impactPhase.damageNumbers.some((text) => text.includes("321"))) failures.push(`${label}: Rokuogan damaged the player before the cinematic ended`);
  }
  for (const [label, reveal, hit] of [["desktop", desktopRokuoganReveal, desktopRokuoganHit], ["phone", phoneRokuoganReveal, phoneRokuoganHit]]) {
    if (!reveal.overlayCleared || reveal.playerHitPose || !/\/normal\.webp(?:\?|$)/.test(reveal.playerPortraitSource) || reveal.damageNumbers.some((text) => text.includes("321"))) failures.push(`${label}: Rokuogan did not reveal the normal player portrait before damage ${JSON.stringify(reveal)}`);
    if (!reveal.audioState?.effectAudioSilenced || !reveal.audioState?.bgmHeld || reveal.audioState?.lastVoiceKey !== "call") failures.push(`${label}: Rokuogan audio advanced before the player reveal ${JSON.stringify(reveal.audioState)}`);
    if (!hit.overlayCleared || !hit.playerHitPose || !/\/hit\.webp(?:\?|$)/.test(hit.playerPortraitSource) || !hit.damageNumbers.some((text) => text.includes("321"))) failures.push(`${label}: Rokuogan player hit did not follow the normal portrait reveal ${JSON.stringify(hit)}`);
    if (hit.playerPortraitNaturalSize.some((value) => value <= 0) || hit.audioState?.lastVoiceKey !== "hit" || !/lucci_rokuogan_hit\.mp3$/.test(hit.audioState?.lastVoiceSrc || "")) failures.push(`${label}: Rokuogan delayed hit portrait or voice failed ${JSON.stringify(hit)}`);
  }
  if (behavior.selections.length !== 6 || behavior.uniqueCount !== 6 || behavior.selections.some((name) => !allowed.includes(name))) failures.push("six powers are not unique");
  if (behavior.cycleActions?.slice(0, 5).some((moveId) => moveId === "postgame_lucci_ultimate_rokuogan") || behavior.cycleActions?.[5] !== "postgame_lucci_ultimate_rokuogan") failures.push("ultimate timing does not follow the sixth pre-action draw");
  if (behavior.timing?.some((entry) => !entry.beforePlayerAction || entry.afterRoundStartCount !== entry.beforeRoundStartCount + 1 || entry.afterEnemySelectionCount !== entry.afterRoundStartCount || entry.playerHpAfterDraw !== entry.playerHpBeforeDraw)) failures.push(`six-power draw timing mismatch ${JSON.stringify(behavior.timing)}`);
  if (behavior.boosts.some((entry) => entry.value !== 180)) failures.push(`stat boost mismatch ${JSON.stringify(behavior.boosts)}`);
  if (!(behavior.evasionHitChance >= 55 && behavior.evasionHitChance <= 60)) failures.push(`evasion boost mismatch ${behavior.evasionHitChance}`);
  if (behavior.action?.moveId !== "postgame_lucci_ultimate_rokuogan") failures.push("ultimate was not forced after six powers");
  if (behavior.ultimate.power !== 480 || behavior.ultimate.ignoreDefenseRatio !== 0.5) failures.push("ultimate damage settings mismatch");
  if (!behavior.guaranteed?.hit || behavior.guaranteed?.chance !== 100) failures.push("ultimate is not guaranteed to hit");
  if (behavior.beforeReset.nodes !== 6 || !behavior.beforeReset.pending || behavior.afterReset.nodes !== 0 || behavior.afterReset.pending) failures.push("six-power reset mismatch");
  if (postRokuoganAudioState?.effectAudioSilenced || postRokuoganAudioState?.bgmHeld) failures.push(`Rokuogan audio hold was not released ${JSON.stringify(postRokuoganAudioState)}`);
  if (!rokuoganBgmLog.some((entry) => entry.type === "lock" && entry.reason === "lucci-rokuogan") || !rokuoganBgmLog.some((entry) => entry.type === "fadeOut" && entry.duration === 0) || !rokuoganBgmLog.some((entry) => entry.type === "fadeIn" && entry.duration === 520) || !rokuoganBgmLog.some((entry) => entry.type === "unlock" && entry.reason === "lucci-rokuogan")) failures.push(`Rokuogan BGM hold lifecycle mismatch ${JSON.stringify(rokuoganBgmLog)}`);
  errors.forEach((error) => failures.push(error));

  const report = { assetChecks, desktopEvent, desktopVisual, desktopPanel, phoneEvent, phoneVisual, phonePanel, desktopRokuoganEvent, desktopRokuoganCast, desktopRokuoganImpact, desktopRokuoganReveal, desktopRokuoganHit, phoneRokuoganEvent, phoneRokuoganCast, phoneRokuoganImpact, phoneRokuoganReveal, phoneRokuoganHit, postRokuoganAudioState, rokuoganBgmLog, behavior, errors, failures, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
