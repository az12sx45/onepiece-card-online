const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("tmp/tot-musica-full-dual-qa");
const VIEWPORT_WIDTH = Math.max(320, Number(process.env.BOARD_QA_WIDTH || 1600));
const VIEWPORT_HEIGHT = Math.max(320, Number(process.env.BOARD_QA_HEIGHT || 900));

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`${label}:http:${response.status()}:${response.url()}`);
  });
}

async function prepareTotBattle(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((card) => debug.cloneCard(card));
    player.crew.forEach((card) => {
      card.baseStats ||= {};
      card.baseStats.hp = 5000;
      card.baseStats.spd = 999;
      card.currentHp = 5000;
      card.battleCarryItem = "rocks_eclipse_sword";
      (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(5, Number(move.pp || move.currentPP || 5)); });
    });
    // 左隊先發刻意設為會被第一輪反擊擊倒，驗證同隊第 2 位會自動接替。
    player.crew[0].currentHp = 500;
    player.activeCrewIndex = 0;
    player.smallSupplies = Math.max(2, Number(player.smallSupplies || 0));
    debug.grantFormalItemToPlayer(player, "lineage_extractor_standard", 1, { reveal: false });
    player.pendingBattle = null;
    runtime.battleState = null;
    if (!runtime.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "tot-full-dual-qa" });
    debug.ensurePostgameWorldLayout(runtime.gameState);
    const assignment = runtime.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_tot_musica");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    // 正式流程不得依賴測試腳本預先補血；startBattle 必須自行建立滿血 Boss。
    islandState.currentHp = Math.max(1, Math.round(Number(islandState.maxHp || 1) * 0.37));
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.enemyCombatant.baseStats ||= {};
    battle.enemyCombatant.baseStats.spd = 1;
    battle.enemyCombatant.spd = 1;
    return debug.getBattleView();
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  console.log("qa:launch");
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, timeout: 15000 });
  const context = await browser.newContext({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1 });
  context.setDefaultTimeout(15000);
  const errors = [];
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?tot_full_dual_qa=1`, { waitUntil: "commit", timeout: 15000 });
  console.log("qa:host-loaded");
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 20000 });
  await prepareTotBattle(host);
  const initiativeRules = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    const battle = runtime.battleState;
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    const realIndex = mechanic.realIndices[0];
    const songIndex = mechanic.songIndices[0];
    const savedRealSpeed = player.crew[realIndex].baseStats.spd;
    const savedSongSpeed = player.crew[songIndex].baseStats.spd;
    const savedAssigned = mechanic.assigned;
    mechanic.assigned = true;
    player.crew[realIndex].baseStats.spd = 240;
    player.crew[songIndex].baseStats.spd = 35;
    const combinedSpeed = qa.totOrderSpeed(player, battle);
    const realMove = player.crew[realIndex].moveSet[0];
    const songMove = player.crew[songIndex].moveSet[0];
    const dualPriority = qa.totOrderPriority({
      type: "tot-dual",
      realAction: { type: "move", moveId: realMove.id },
      songAction: { type: "move", moveId: songMove.id },
    }, player, battle);
    const expectedDualPriority = Math.max(Number(realMove.effects?.priority || realMove.priority || 0), Number(songMove.effects?.priority || songMove.priority || 0));
    const savedRealHp = mechanic.realIndices.map((index) => player.crew[index].currentHp);
    mechanic.realIndices.forEach((index) => { player.crew[index].currentHp = 0; });
    const wipedRealIndex = qa.totLivingWorldIndex(player, mechanic, "real");
    mechanic.realIndices.forEach((index, position) => { player.crew[index].currentHp = savedRealHp[position]; });
    player.crew[realIndex].baseStats.spd = savedRealSpeed;
    player.crew[songIndex].baseStats.spd = savedSongSpeed;
    mechanic.assigned = savedAssigned;
    return { realSpeed: 240, songSpeed: 35, combinedSpeed, dualPriority, expectedDualPriority, wipedRealIndex };
  });
  console.log("qa:battle-prepared");

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?tot_full_dual_qa=1", "_blank"));
  const battle = await battlePagePromise;
  captureErrors(battle, errors, "battle");
  await battle.waitForLoadState("domcontentloaded", { timeout: 15000 });
  console.log("qa:battle-page-loaded");
  await battle.waitForFunction(() => document.getElementById("battleStage")?.classList.contains("tot-musica-battle-mode"), null, { timeout: 15000 });
  await battle.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll(".tot-musica-roster-card img"));
    return images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 15000 });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "01-team-setup-before-enemy.png") });
  console.log("qa:team-setup-captured");
  const setup = await battle.evaluate(() => ({
    dedicated: document.getElementById("battleStage")?.classList.contains("tot-musica-battle-mode"),
    teamSetup: document.getElementById("totMusicaDualFx")?.classList.contains("team-setup-stage"),
    bossVisible: getComputedStyle(document.getElementById("totMusicaBossFrame")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
    genericCardsHidden: ["playerCard", "enemyCard"].every((id) => getComputedStyle(document.getElementById(id)).visibility === "hidden" || Number(getComputedStyle(document.getElementById(id)).opacity) === 0),
    slots: document.querySelectorAll("[data-tot-team-slot]").length,
    roster: document.querySelectorAll(".tot-musica-roster-card").length,
    emptySlots: document.querySelectorAll("[data-tot-team-slot].empty").length,
    visibleRosterImages: Array.from(document.querySelectorAll(".tot-musica-roster-card img")).filter((image) => {
      const rect = image.getBoundingClientRect();
      return !!image.currentSrc && rect.width > 0 && rect.height > 0 && getComputedStyle(image).visibility !== "hidden";
    }).length,
  }));

  for (const [crewIndex, world, position] of [[0, "real", 0], [3, "real", 1], [2, "real", 2], [1, "song", 0], [4, "song", 1], [5, "song", 2]]) {
    const source = battle.locator(`.tot-musica-roster-card[data-tot-crew-index="${crewIndex}"]`);
    const target = battle.locator(`[data-tot-team-slot][data-tot-team-world="${world}"][data-tot-team-position="${position}"]`);
    // 點選船員再點槽位在桌機與觸控尺寸都走相同正式操作，避免 headless 拖曳偶發遺失 drop。
    await source.click();
    await target.click();
    await battle.waitForFunction(({ expectedIndex, expectedWorld, expectedPosition }) => {
      const slot = document.querySelector(`[data-tot-team-slot][data-tot-team-world="${expectedWorld}"][data-tot-team-position="${expectedPosition}"]`);
      return slot?.classList.contains("filled") && Number(slot.dataset.totCrewIndex) === expectedIndex;
    }, { expectedIndex: crewIndex, expectedWorld: world, expectedPosition: position }, { timeout: 5000 });
  }
  await battle.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll(".tot-musica-team-slot img"));
    return images.length === 6 && images.every((image) => image.complete && image.naturalWidth > 0);
  }, null, { timeout: 15000 });
  const arranged = await battle.evaluate(() => ({
    filledSlots: document.querySelectorAll("[data-tot-team-slot].filled").length,
    loadedSlotImages: Array.from(document.querySelectorAll(".tot-musica-team-slot img")).filter((image) => image.complete && image.naturalWidth > 0).length,
    confirmEnabled: !document.querySelector("[data-tot-team-confirm]")?.disabled,
  }));
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "01b-team-setup-arranged.png") });
  await battle.locator("[data-tot-team-confirm]").click();
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("selection-preview"), null, { timeout: 10000 });
  const statusHud = await battle.evaluate(() => {
    const debug = window.__BOARD_BATTLE_DEBUG__;
    const view = debug.latestView();
    const state = view.battle.postgameBossMechanic.state;
    const real = state.crew.find((card) => Number(card.index) === Number(state.realActiveIndex));
    const song = state.crew.find((card) => Number(card.index) === Number(state.songActiveIndex));
    debug.setTotMusicaWorldStage({ ...real, statuses: { ...(real.statuses || {}), poison: 2 } }, "real");
    debug.setTotMusicaWorldStage({ ...song, statuses: { ...(song.statuses || {}), poison: 2 } }, "song");
    return {
      realMeta: document.querySelector("#totMusicaRealHud .tot-musica-world-hud-meta")?.textContent || "",
      songMeta: document.querySelector("#totMusicaSongHud .tot-musica-world-hud-meta")?.textContent || "",
      realStatusIcons: document.querySelectorAll("#totMusicaRealStatusIcons .status-icon").length,
      songStatusIcons: document.querySelectorAll("#totMusicaSongStatusIcons .status-icon").length,
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "02-selection-before-enemy.png") });
  console.log("qa:selection-captured");
  const selection = await battle.evaluate(() => ({
    bossVisible: getComputedStyle(document.getElementById("totMusicaBossFrame")).display !== "none" && getComputedStyle(document.getElementById("totMusicaBossFrame")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
    bossHudVisible: getComputedStyle(document.getElementById("totMusicaBossHud")).display !== "none" && getComputedStyle(document.getElementById("totMusicaBossHud")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossHud")).opacity || 1) > 0,
    realHp: document.getElementById("totMusicaRealHpText")?.textContent,
    songHp: document.getElementById("totMusicaSongHpText")?.textContent,
    realMeta: document.querySelector("#totMusicaRealHud .tot-musica-world-hud-meta")?.textContent || "",
    songMeta: document.querySelector("#totMusicaSongHud .tot-musica-world-hud-meta")?.textContent || "",
    realStatusIcons: document.querySelectorAll("#totMusicaRealStatusIcons .status-icon").length,
    songStatusIcons: document.querySelectorAll("#totMusicaSongStatusIcons .status-icon").length,
    genericCardsHidden: ["playerCard", "enemyCard"].every((id) => Number(getComputedStyle(document.getElementById(id)).opacity) === 0),
  }));
  await battle.locator("#totMusicaBossPreviewToggle").click();
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("boss-preview-open"), null, { timeout: 3000 });
  await battle.waitForTimeout(120);
  const bossPreview = await battle.evaluate(() => {
    const boss = document.getElementById("totMusicaBossFrame");
    const bossHud = document.getElementById("totMusicaBossHud");
    const button = document.getElementById("totMusicaBossPreviewToggle");
    const backButton = document.getElementById("totMusicaBossPreviewBack");
    const rect = boss?.getBoundingClientRect();
    const hudRect = bossHud?.getBoundingClientRect();
    const backRect = backButton?.getBoundingClientRect();
    const style = getComputedStyle(boss);
    const hudStyle = getComputedStyle(bossHud);
    return {
      open: document.getElementById("totMusicaDualFx")?.classList.contains("boss-preview-open"),
      expanded: button?.getAttribute("aria-expanded"),
      bossVisible: style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0,
      hudVisible: hudStyle.display !== "none" && hudStyle.visibility !== "hidden" && Number(hudStyle.opacity || 1) > 0,
      hpText: document.getElementById("totMusicaBossHpText")?.textContent || "",
      squareRatio: rect?.height ? rect.width / rect.height : 0,
      inViewport: !!(rect && rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1),
      hudAboveBoss: !!(rect && hudRect && hudRect.bottom <= rect.top + 2),
      diceHidden: Number(getComputedStyle(document.getElementById("totMusicaBossDiceCluster")).opacity || 0) === 0 || getComputedStyle(document.getElementById("totMusicaBossDiceCluster")).display === "none",
      operationUiHidden: ["infoPanel", "actionPanel"].every((id) => {
        const node = document.querySelector(`[data-layout-id="${id}"]`);
        const style = getComputedStyle(node);
        return style.visibility === "hidden" || Number(style.opacity) <= 0.02;
      }),
      returnVisible: !!(backRect && getComputedStyle(backButton).display !== "none" && backRect.left >= -1 && backRect.right <= window.innerWidth + 1 && backRect.bottom <= window.innerHeight + 1),
      returnText: backButton?.textContent?.trim() || "",
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "02a-boss-preview-open.png") });
  await battle.locator("#totMusicaBossPreviewBack").click();
  await battle.waitForFunction(() => !document.getElementById("totMusicaDualFx")?.classList.contains("boss-preview-open"), null, { timeout: 3000 });
  await battle.locator("#totMusicaRealCarry [data-carry-popover]").click();
  await battle.waitForFunction(() => document.getElementById("statusPopover")?.classList.contains("carry-popover") && document.getElementById("statusPopover")?.classList.contains("open"), null, { timeout: 3000 });
  const carryPopover = await battle.evaluate(() => {
    const popover = document.getElementById("statusPopover");
    const rect = popover?.getBoundingClientRect();
    return {
      open: popover?.classList.contains("open"),
      carryClass: popover?.classList.contains("carry-popover"),
      text: popover?.textContent?.replace(/\s+/g, " ").trim() || "",
      inViewport: !!(rect && rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1),
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "02b-carry-item-description.png") });
  await battle.keyboard.press("Escape");
  const teamOrder = await host.evaluate(() => {
    const state = window.__BOARD_GAME_DEBUG__.getState().battleState.postgameBossMechanic;
    return { real: state.realIndices.slice(), song: state.songIndices.slice() };
  });
  const synergyMatrix = await host.evaluate(() => {
    const qa = window.__BOARD_GAME_DEBUG__.postgameBossMechanicQa;
    const player = { crew: [
      { attribute: "力" }, { attribute: "力" }, { attribute: "技" }, { attribute: "速" },
    ] };
    const result = (cardIndex, firstDiceFace, category, attribute) => ({ cardIndex, firstDiceFace, move: { category, attribute } });
    const matrix = {
      none: qa.totDualAttackSynergy(player, result(0, 1, "attack", "力"), result(2, 2, "special", "技")),
      attribute: qa.totDualAttackSynergy(player, result(0, 1, "attack", "力"), result(1, 2, "special", "力")),
      die: qa.totDualAttackSynergy(player, result(0, 3, "attack", "力"), result(2, 3, "special", "技")),
      moveClass: qa.totDualAttackSynergy(player, result(0, 1, "attack", "力"), result(2, 2, "attack", "技")),
      mismatchMax: qa.totDualAttackSynergy(player, result(0, 1, "attack", "力"), result(1, 2, "attack", "力")),
      all: qa.totDualAttackSynergy(player, result(0, 5, "attack", "力"), result(1, 5, "attack", "力")),
    };
    return {
      ...matrix,
      rates: {
        noAttack: qa.totDualDamageRate(false, false, matrix.all),
        mismatchBase: qa.totDualDamageRate(true, false, matrix.none),
        mismatchMax: qa.totDualDamageRate(true, false, matrix.mismatchMax),
        syncAll: qa.totDualDamageRate(true, true, matrix.all),
      },
    };
  });
  if (process.env.BOARD_QA_SELECTION_ONLY === "1") {
    console.log(JSON.stringify({ setup, arranged, selection, teamOrder }, null, 2));
    await browser.close();
    return;
  }

  await battle.evaluate(() => {
    window.__totSceneWatch = {
      genericVisibleFrames: 0,
      missingDedicatedFrames: 0,
      earlyBossFrames: 0,
      samples: 0,
      revealHpText: "",
      revealHpWidth: 0,
      impactHpText: "",
      impactHpWidth: 0,
      launchAt: 0,
      revealAt: 0,
      impactAt: 0,
    };
    window.__totSceneWatchTimer = setInterval(() => {
      const watch = window.__totSceneWatch;
      const stage = document.getElementById("battleStage");
      const fx = document.getElementById("totMusicaDualFx");
      const boss = document.getElementById("totMusicaBossFrame");
      const genericVisible = ["playerCard", "enemyCard"].some((id) => {
        const style = getComputedStyle(document.getElementById(id));
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.02;
      });
      const bossStyle = getComputedStyle(boss);
      const bossVisible = bossStyle.display !== "none" && bossStyle.visibility !== "hidden" && Number(bossStyle.opacity) > 0.02;
      watch.samples += 1;
      if (fx?.classList.contains("launch-upward") && !watch.launchAt) watch.launchAt = performance.now();
      if (fx?.classList.contains("boss-revealed") && !watch.revealAt) watch.revealAt = performance.now();
      if (fx?.classList.contains("wave-impact") && !watch.impactAt) watch.impactAt = performance.now();
      if (genericVisible && !stage?.classList.contains("lineage-extraction-active")) watch.genericVisibleFrames += 1;
      if (!stage?.classList.contains("tot-musica-battle-mode") || !fx?.classList.contains("show") || !fx?.classList.contains("persistent-stage")) watch.missingDedicatedFrames += 1;
      if (bossVisible && !fx?.classList.contains("boss-revealed") && !fx?.classList.contains("enemy-present")) watch.earlyBossFrames += 1;
      if (fx?.classList.contains("boss-revealed") && !fx?.classList.contains("wave-impact") && !watch.revealHpText) {
        watch.revealHpText = document.getElementById("totMusicaBossHpText")?.textContent || "";
        watch.revealHpWidth = Number.parseFloat(document.getElementById("totMusicaBossHpFill")?.style.width || "0");
      }
      if (fx?.classList.contains("wave-impact") && !watch.impactHpText) {
        watch.impactHpText = document.getElementById("totMusicaBossHpText")?.textContent || "";
        watch.impactHpWidth = Number.parseFloat(document.getElementById("totMusicaBossHpFill")?.style.width || "0");
      }
    }, 16);
  });

  await battle.evaluate(() => {
    const debug = window.__BOARD_BATTLE_DEBUG__;
    const view = debug.latestView();
    const state = view.battle.postgameBossMechanic.state;
    const crew = state.crew || [];
    const real = crew.find((card) => Number(card.index) === Number(state.realActiveIndex));
    const song = crew.find((card) => Number(card.index) === Number(state.songActiveIndex));
    debug.playTotMusicaDualSyncFx({
      id: `qa-mismatch-${Date.now()}`,
      type: "tot-musica-dual-sync",
      duration: 4700,
      // Deliberately pass a stale/wrong synchronized flag. The renderer must
      // still trust the displayed first-die parity and shatter 6 versus 5.
      synchronized: true,
      partialStrike: true,
      parityMatched: false,
      bothAttackRolls: true,
      bothDirectHits: true,
      damage: 77,
      resultText: "雙數／單數・分流 5%",
      realWorld: { ...real, actorName: real.name, moveName: "測試招式", firstDiceFace: 6, diceRolls: [6], diceTotal: 6, parityLabel: "雙數", direct: true, hit: true },
      songWorld: { ...song, actorName: song.name, moveName: "測試招式", firstDiceFace: 5, diceRolls: [5], diceTotal: 5, parityLabel: "單數", direct: true, hit: true },
      targetCombatant: view.enemy,
      startSnapshot: { enemy: view.enemy },
    });
  });
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("collision-failed"), null, { timeout: 7000 });
  await battle.waitForTimeout(180);
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "03-mismatch-dice-shatter.png") });
  const mismatch = await battle.evaluate(() => ({
    bossVisible: getComputedStyle(document.getElementById("totMusicaBossFrame")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
    shardAnimations: Array.from(document.querySelectorAll(".tot-musica-dice-shards i")).filter((node) => node.getAnimations().length > 0).length,
    result: document.getElementById("totMusicaDualResult")?.textContent,
    visibleFirstDice: [
      document.getElementById("totMusicaRealDie")?.textContent || "",
      document.getElementById("totMusicaSongDie")?.textContent || "",
    ],
  }));
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("split-upward"), null, { timeout: 8000 });
  await battle.waitForTimeout(1450);
  const mismatchTravel = await battle.evaluate(() => ({
    loaded: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .straight-stream")).filter((image) => image.complete && image.naturalWidth > 0).length,
    visible: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .straight-stream")).filter((image) => Number(getComputedStyle(image).opacity) > 0).length,
    animations: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .straight-stream")).filter((image) => image.getAnimations().length > 0).length,
    spiralsHidden: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .spiral-stream, .tot-musica-upward-shockwave .merged-strike")).every((image) => getComputedStyle(image).display === "none"),
  }));
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "03c-mismatch-straight-upward.png") });
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("wave-impact") && document.querySelectorAll("#damagePop .damage-number").length >= 1, null, { timeout: 7000 });
  const mismatchImpact = await battle.evaluate(() => ({
    result: document.getElementById("totMusicaDualResult")?.textContent || "",
    bossHit: document.getElementById("totMusicaBossFrame")?.classList.contains("portrait-hit"),
  }));
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("selection-preview"), null, { timeout: 11000 });
  await battle.evaluate(() => {
    window.__totSceneWatch = {
      genericVisibleFrames: 0, missingDedicatedFrames: 0, earlyBossFrames: 0, samples: 0,
      revealHpText: "", revealHpWidth: 0, impactHpText: "", impactHpWidth: 0,
      launchAt: 0, revealAt: 0, impactAt: 0,
    };
  });

  const action = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    const battle = runtime.battleState;
    const mechanic = battle.postgameBossMechanic;
    const pickMove = (index) => (player.crew[index].moveSet || []).find((move) => ["attack", "special"].includes(move.category || move.type) && Number(move.power || 0) > 0 && Number(move.currentPP ?? move.pp ?? 0) > 0)?.id;
    player.crew.forEach((card) => {
      card.stats ||= {};
      card.stats.spd = 999;
    });
    window.__totQaOriginalRandom = Math.random;
    Math.random = () => 0.999999;
    const realMove = pickMove(mechanic.realActiveIndex);
    const songMove = pickMove(mechanic.songActiveIndex);
    const beforeHp = battle.enemyCombatant.currentHp;
    const maxHp = battle.enemyCombatant.maxHp;
    return { accepted: false, realMove, songMove, beforeHp, maxHp };
  });
  const commandPanelBefore = await battle.evaluate(() => {
    const columns = Array.from(document.querySelectorAll(".postgame-world-column"));
    return {
      originalHidden: document.querySelector('[data-layout-id="actionPanel"]')?.classList.contains("is-hidden"),
      columns: columns.map((column) => {
        const rect = column.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, commands: column.querySelectorAll("[data-tot-world-mode]").length };
      }),
    };
  });
  await battle.locator('[data-tot-world-mode="partners"][data-tot-world="real"]').click();
  const partnerOptionCount = await battle.locator('.postgame-world-column:not(.song) [data-tot-world-action="switch"]').count();
  await battle.locator('[data-tot-world-back="real"]').click();
  await battle.locator('[data-tot-world-mode="items"][data-tot-world="real"]').click();
  const itemOptionCount = await battle.locator('.postgame-world-column:not(.song) [data-tot-world-item="real"]').count();
  await battle.locator('[data-tot-world-back="real"]').click();
  await battle.locator('[data-tot-world-mode="escape"][data-tot-world="real"]').click();
  const escapeOptions = await battle.evaluate(() => ({
    run: !!document.querySelector('.postgame-world-column:not(.song) [data-tot-world-action="escape"]'),
    surrender: !!document.querySelector('.postgame-world-column:not(.song) [data-tot-world-surrender]'),
  }));
  await battle.locator('[data-tot-world-back="real"]').click();
  const commandOptions = { partnerOptionCount, itemOptionCount, escapeOptions };
  await battle.locator('[data-tot-world-mode="attack"][data-tot-world="real"]').click();
  const leftSubmenu = await battle.evaluate(() => {
    const left = document.querySelector(".postgame-world-column:not(.song)");
    const right = document.querySelector(".postgame-world-column.song");
    const option = left?.querySelector('[data-tot-world-action="move"]');
    const optionRect = option?.getBoundingClientRect();
    const leftRect = left?.getBoundingClientRect();
    return {
      leftMoveCount: left?.querySelectorAll('[data-tot-world-action="move"]').length || 0,
      rightCommandCount: right?.querySelectorAll('[data-tot-world-mode]').length || 0,
      submenuInsideLeft: !!(optionRect && leftRect && optionRect.left >= leftRect.left && optionRect.right <= leftRect.right),
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "03a-left-attack-submenu-right-command-panel.png") });
  await battle.locator(`.postgame-world-column:not(.song) [data-tot-value="${action.realMove}"]`).click();
  await battle.waitForFunction(() => document.querySelector('.postgame-world-column:not(.song) [data-tot-world-change="real"]') && document.querySelectorAll('.postgame-world-column.song [data-tot-world-mode]').length === 4, null, { timeout: 5000 });
  const commandPanelAfterLeft = await battle.evaluate(() => ({
    leftSelected: document.querySelector(".postgame-world-column:not(.song) .tot-musica-world-selected strong")?.textContent || "",
    leftCanChange: !!document.querySelector('.postgame-world-column:not(.song) [data-tot-world-change="real"]'),
    rightCommands: document.querySelectorAll('.postgame-world-column.song [data-tot-world-mode]').length,
  }));
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "03b-left-selected-right-command-panel.png") });
  await battle.locator('[data-tot-world-mode="attack"][data-tot-world="song"]').click();
  await battle.locator(`.postgame-world-column.song [data-tot-value="${action.songMove}"]`).click();
  await host.waitForFunction(() => {
    const battle = window.__BOARD_GAME_DEBUG__?.getState()?.battleState;
    return !!battle?.animating || battle?.visualEvent?.type === "tot-musica-dual-sync";
  }, null, { timeout: 5000 });
  action.accepted = true;
  action.visualEvent = await host.evaluate(() => {
    const event = window.__BOARD_GAME_DEBUG__.getState().battleState?.visualEvent || {};
    return {
      synchronized: event.synchronized,
      partialStrike: event.partialStrike,
      baseDamageRate: event.baseDamageRate,
      finalDamageRate: event.finalDamageRate,
      synergy: event.synergy,
      damage: event.damage,
      rawDamage: Number(event.realWorld?.damage || 0) + Number(event.songWorld?.damage || 0),
    };
  });
  const commandFlow = { before: commandPanelBefore, leftSubmenu, afterLeft: commandPanelAfterLeft };
  console.log("qa:action-queued", action);

  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("player-resolving"), null, { timeout: 10000 });
  const playerResolveStartedAt = Date.now();
  await battle.waitForTimeout(2400);
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "04-player-dice-single-slot.png") });
  console.log("qa:dice-captured");
  const dice = await battle.evaluate(() => ({
    real: Array.from(document.querySelectorAll("#totMusicaRealDiceRow .tot-musica-dual-die.is-visible span")).map((node) => node.textContent),
    song: Array.from(document.querySelectorAll("#totMusicaSongDiceRow .tot-musica-dual-die.is-visible span")).map((node) => node.textContent),
    realTotal: document.getElementById("totMusicaRealTotal")?.textContent,
    songTotal: document.getElementById("totMusicaSongTotal")?.textContent,
    expectedRollCount: Math.max(
      1,
      window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle?.visualEvent?.realWorld?.diceRolls?.length || 0,
      window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle?.visualEvent?.songWorld?.diceRolls?.length || 0,
    ),
    bossDiceVisible: getComputedStyle(document.getElementById("totMusicaBossDiceCluster")).display !== "none" && Number(getComputedStyle(document.getElementById("totMusicaBossDiceCluster")).opacity) > 0,
    overlaps: (() => {
      const intersects = (left, right) => left.right > right.left && left.left < right.right && left.bottom > right.top && left.top < right.bottom;
      const realDice = document.getElementById("totMusicaRealDiceCluster")?.getBoundingClientRect();
      const songDice = document.getElementById("totMusicaSongDiceCluster")?.getBoundingClientRect();
      const realCard = document.getElementById("totMusicaRealFrame")?.getBoundingClientRect();
      const songCard = document.getElementById("totMusicaSongFrame")?.getBoundingClientRect();
      return {
        real: !!(realDice && realCard && intersects(realDice, realCard)),
        song: !!(songDice && songCard && intersects(songDice, songCard)),
      };
    })(),
  }));
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("dice-colliding"), null, { timeout: 10000 });
  dice.cadenceMs = Date.now() - playerResolveStartedAt;
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("launch-upward"), null, { timeout: 15000 });
  const launchStartedAt = Date.now();
  await battle.waitForTimeout(1450);
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "05-upward-art-camera-travel.png") });
  const wave = await battle.evaluate(() => ({
    bossVisible: getComputedStyle(document.getElementById("totMusicaBossFrame")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
    waveVisible: getComputedStyle(document.querySelector(".tot-musica-upward-shockwave .merged-strike")).display !== "none" && Number(getComputedStyle(document.querySelector(".tot-musica-upward-shockwave .merged-strike")).opacity) > 0,
    waveLoaded: document.querySelector(".tot-musica-upward-shockwave .merged-strike")?.complete && document.querySelector(".tot-musica-upward-shockwave .merged-strike")?.naturalWidth > 0,
    loadedSpiralStreams: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .spiral-stream")).filter((node) => node.complete && node.naturalWidth > 0).length,
    spiralAnimations: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .spiral-stream")).filter((node) => node.getAnimations().length > 0).length,
    mergedAnimations: document.querySelector(".tot-musica-upward-shockwave .merged-strike")?.getAnimations().length || 0,
    mergedLoaded: !!(document.querySelector(".tot-musica-upward-shockwave .merged-strike")?.complete && document.querySelector(".tot-musica-upward-shockwave .merged-strike")?.naturalWidth > 0),
    legacySpiralsHidden: Array.from(document.querySelectorAll(".tot-musica-upward-shockwave .spiral-stream")).every((node) => getComputedStyle(node).display === "none"),
    cameraAnimations: Array.from(document.querySelectorAll(".tot-musica-dual-pane")).map((node) => getComputedStyle(node, "::before").animationName),
    infoHidden: Number(getComputedStyle(document.querySelector('[data-layout-id="infoPanel"]')).opacity) === 0,
  }));
  console.log("qa:upward-wave-captured");
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("boss-revealed"), null, { timeout: 8000 });
  const bossRevealStartedAt = Date.now();
  await battle.waitForTimeout(620);
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "06-boss-high-after-camera-rise.png") });
  const reveal = await battle.evaluate(() => {
    const boss = document.getElementById("totMusicaBossFrame");
    const rect = boss?.getBoundingClientRect();
    return {
      bossVisible: getComputedStyle(boss).visibility !== "hidden" && Number(getComputedStyle(boss).opacity) > 0,
      highReveal: boss?.classList.contains("boss-high-reveal"),
      bossTopRatio: rect ? rect.top / window.innerHeight : 1,
      bossBottomRatio: rect ? rect.bottom / window.innerHeight : 1,
      bossWidthRatio: rect ? rect.width / window.innerWidth : 0,
      bossHeightRatio: rect ? rect.height / window.innerHeight : 0,
      bossCardRatio: rect?.height ? rect.width / rect.height : 0,
      bossClipped: !!(rect && (rect.left < -1 || rect.top < -1 || rect.right > window.innerWidth + 1 || rect.bottom > window.innerHeight + 1)),
      portraitObjectFit: getComputedStyle(document.getElementById("totMusicaBossPortrait")).objectFit,
      portraitNaturalRatio: (() => {
        const image = document.getElementById("totMusicaBossPortrait");
        return image?.naturalHeight ? image.naturalWidth / image.naturalHeight : 0;
      })(),
      hpText: document.getElementById("totMusicaBossHpText")?.textContent,
      hpWidth: Number.parseFloat(document.getElementById("totMusicaBossHpFill")?.style.width || "0"),
      hudAboveBoss: (() => {
        const hudRect = document.getElementById("totMusicaBossHud")?.getBoundingClientRect();
        return !!(hudRect && rect && hudRect.bottom <= rect.top + 2);
      })(),
    };
  });
  reveal.delayFromLaunchMs = bossRevealStartedAt - launchStartedAt;
  await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("wave-impact"), null, { timeout: 5000 });
  const playerImpactStartedAt = Date.now();
  reveal.impactAfterRevealMs = playerImpactStartedAt - bossRevealStartedAt;
  reveal.impactFromLaunchMs = playerImpactStartedAt - launchStartedAt;
  await battle.waitForTimeout(180);
  const playerImpact = await battle.evaluate(() => {
    window.__totCameraBridgeWatch = { samples: 0, selectionFrames: 0, risingFrames: 0, heldFrames: 0 };
    window.__totCameraBridgeWatchTimer = setInterval(() => {
      const fx = document.getElementById("totMusicaDualFx");
      const watch = window.__totCameraBridgeWatch;
      watch.samples += 1;
      if (fx?.classList.contains("selection-preview")) watch.selectionFrames += 1;
      if (fx?.classList.contains("enemy-camera-rising")) watch.risingFrames += 1;
      if (fx?.classList.contains("camera-held-high")) watch.heldFrames += 1;
    }, 16);
    const boss = document.getElementById("totMusicaBossFrame")?.getBoundingClientRect();
    const bossCenter = boss ? { x: boss.left + boss.width / 2, y: boss.top + boss.height / 2 } : { x: 0, y: 0 };
    const fx = document.getElementById("totMusicaDualFx")?.getBoundingClientRect();
    const impactMarker = fx ? { x: fx.left + fx.width / 2, y: fx.top + fx.height / 2 } : { x: 0, y: 0 };
    return {
      hpText: document.getElementById("totMusicaBossHpText")?.textContent,
      hpWidth: Number.parseFloat(document.getElementById("totMusicaBossHpFill")?.style.width || "0"),
      damageNumbers: Array.from(document.querySelectorAll("#damagePop .damage-number")).map((node) => ({
        kind: node.dataset.damageKind || "",
        value: Number(node.dataset.damageValue || 0),
        text: node.textContent.trim(),
      })),
      resultOverflow: (() => {
        const node = document.getElementById("totMusicaDualResult");
        return !!node && node.scrollWidth > node.clientWidth + 2;
      })(),
      bossCenter,
      impactMarker,
      impactAnimation: getComputedStyle(document.getElementById("totMusicaDualFx"), "::after").animationName,
      hitDistance: Math.hypot(impactMarker.x - bossCenter.x, impactMarker.y - bossCenter.y),
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "07-player-upward-impact.png") });
  console.log("qa:player-impact-captured");
  await host.evaluate(() => { Math.random = () => 0.01; });

  try {
    await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("camera-held-high"), null, { timeout: 18000 });
    await battle.waitForTimeout(240);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, "08-player-impact-holds-boss-view.png") });
    await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("enemy-rolling"), null, { timeout: 18000 });
    var enemyContinuation = await battle.evaluate(() => {
      clearInterval(window.__totCameraBridgeWatchTimer);
      delete window.__totCameraBridgeWatchTimer;
      const fx = document.getElementById("totMusicaDualFx");
      return {
        ...(window.__totCameraBridgeWatch || {}),
        heldHigh: !!fx?.classList.contains("camera-held-high"),
        cameraRising: !!fx?.classList.contains("enemy-camera-rising"),
        bossVisible: getComputedStyle(document.getElementById("totMusicaBossFrame")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
        playersHidden: ["totMusicaRealFrame", "totMusicaSongFrame"].every((id) => Number(getComputedStyle(document.getElementById(id)).opacity) < 0.08),
      };
    });
    await battle.waitForTimeout(1450);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, "09-enemy-high-boss-dice-single-slot.png") });
    console.log("qa:enemy-dice-captured");
    var enemyDice = await battle.evaluate(() => ({
      visibleDice: document.querySelectorAll("#totMusicaBossDiceCluster .tot-musica-dual-die.is-visible").length,
      face: document.getElementById("totMusicaBossDie")?.textContent,
      bossVisible: getComputedStyle(document.getElementById("totMusicaBossFrame")).visibility !== "hidden" && Number(getComputedStyle(document.getElementById("totMusicaBossFrame")).opacity) > 0,
      playersHiddenBelow: ["totMusicaRealFrame", "totMusicaSongFrame"].every((id) => Number(getComputedStyle(document.getElementById(id)).opacity) < 0.08),
      bossTopRatio: document.getElementById("totMusicaBossFrame")?.getBoundingClientRect().top / window.innerHeight,
      bossBottomRatio: document.getElementById("totMusicaBossFrame")?.getBoundingClientRect().bottom / window.innerHeight,
      diceOverlapsBoss: (() => {
        const die = document.getElementById("totMusicaBossDiceCluster")?.getBoundingClientRect();
        const boss = document.getElementById("totMusicaBossFrame")?.getBoundingClientRect();
        return !!(die && boss && die.right > boss.left && die.left < boss.right && die.bottom > boss.top && die.top < boss.bottom);
      })(),
    }));
    await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("enemy-striking"), null, { timeout: 18000 });
    await battle.waitForTimeout(1450);
    await battle.screenshot({ path: path.join(OUTPUT_DIR, "10-enemy-downward-art-camera-follow.png") });
    var enemyTravel = await battle.evaluate(() => ({
      visibleWaves: Array.from(document.querySelectorAll(".tot-musica-enemy-downstrike img")).filter((node) => Number(getComputedStyle(node).opacity) > 0).length,
      loadedWaves: Array.from(document.querySelectorAll(".tot-musica-enemy-downstrike img")).filter((node) => node.complete && node.naturalWidth > 0).length,
      waveAnimations: Array.from(document.querySelectorAll(".tot-musica-enemy-downstrike img")).filter((node) => node.getAnimations().length > 0).length,
      cameraAnimations: Array.from(document.querySelectorAll(".tot-musica-dual-pane")).map((node) => getComputedStyle(node, "::before").animationName),
    }));
  } catch (error) {
    await battle.evaluate(() => {
      clearInterval(window.__totCameraBridgeWatchTimer);
      delete window.__totCameraBridgeWatchTimer;
    });
    const runtime = await host.evaluate(() => {
      const state = window.__BOARD_GAME_DEBUG__.getState().battleState;
      return {
        animating: state?.animating,
        result: state?.result,
        playerPerformedAction: state?.playerPerformedAction,
        enemyPerformedAction: state?.enemyPerformedAction,
        eventType: state?.visualEvent?.type,
        enemyHp: state?.enemyCombatant?.currentHp,
        log: (state?.log || []).slice(-8),
      };
    });
    throw new Error(`enemy strike did not start: ${JSON.stringify(runtime)}; ${error.message}`);
  }
  await battle.waitForFunction(() => {
    const fx = document.getElementById("totMusicaDualFx");
    if (!fx?.classList.contains("enemy-impact") || document.querySelectorAll("#damagePop .damage-number").length < 2) return false;
    window.__totEnemyStrikeSnapshot = {
      downward: true,
      realText: document.getElementById("totMusicaRealMove")?.textContent,
      songText: document.getElementById("totMusicaSongMove")?.textContent,
      realHp: document.getElementById("totMusicaRealHpText")?.textContent,
      songHp: document.getElementById("totMusicaSongHpText")?.textContent,
      dedicatedStillActive: document.getElementById("battleStage")?.classList.contains("tot-musica-battle-mode"),
      genericCardsHidden: ["playerCard", "enemyCard"].every((id) => {
        const style = getComputedStyle(document.getElementById(id));
        return style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0;
      }),
      damageNumbers: Array.from(document.querySelectorAll("#damagePop .damage-number")).map((node) => ({
        kind: node.dataset.damageKind || "",
        value: Number(node.dataset.damageValue || 0),
        text: node.textContent.trim(),
      })),
      resultText: document.getElementById("totMusicaDualResult")?.textContent?.trim() || "",
      resultOverflow: (() => {
        const node = document.getElementById("totMusicaDualResult");
        return !!node && (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1);
      })(),
      hitDistances: [
        [document.querySelector(".tot-musica-enemy-downstrike img.real"), document.getElementById("totMusicaRealFrame")],
        [document.querySelector(".tot-musica-enemy-downstrike img.song"), document.getElementById("totMusicaSongFrame")],
      ].map(([wave, target]) => {
        const waveRect = wave?.getBoundingClientRect();
        const targetRect = target?.getBoundingClientRect();
        if (!waveRect || !targetRect) return 99999;
        const waveTip = { x: waveRect.left + waveRect.width / 2, y: waveRect.bottom };
        const targetCenter = { x: targetRect.left + targetRect.width / 2, y: targetRect.top + targetRect.height / 2 };
        return Math.hypot(waveTip.x - targetCenter.x, waveTip.y - targetCenter.y);
      }),
    };
    return true;
  }, null, { timeout: 8000 });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "11-enemy-downward-impact-at-players.png") });
  console.log("qa:enemy-impact-captured");
  const enemyStrike = await battle.evaluate(() => window.__totEnemyStrikeSnapshot || {});
  try {
    await battle.waitForFunction(() => document.getElementById("totMusicaDualFx")?.classList.contains("selection-preview"), null, { timeout: 12000 });
  } catch (error) {
    const [runtime, battleDom] = await Promise.all([host.evaluate(() => {
      const battle = window.__BOARD_GAME_DEBUG__?.getState()?.battleState;
      return {
        result: battle?.result,
        animating: battle?.animating,
        roundIndex: battle?.roundIndex,
        realActiveIndex: battle?.postgameBossMechanic?.realActiveIndex,
        songActiveIndex: battle?.postgameBossMechanic?.songActiveIndex,
        crewHp: window.__BOARD_GAME_DEBUG__?.getState()?.gameState?.players?.[0]?.crew?.map((card) => card.currentHp),
        eventType: battle?.visualEvent?.type,
        log: (battle?.log || []).slice(-12),
      };
    }), battle.evaluate(() => ({
      fxClasses: document.getElementById("totMusicaDualFx")?.className || "",
      stageClasses: document.getElementById("battleStage")?.className || "",
      infoText: document.getElementById("infoContent")?.textContent?.replace(/\s+/g, " ").trim().slice(0, 300) || "",
    }))]);
    throw new Error(`next selection did not return: ${JSON.stringify({ runtime, battleDom })}; ${error.message}`);
  }
  const replacement = await host.evaluate(() => {
    const runtime = window.__BOARD_GAME_DEBUG__.getState();
    const player = runtime.gameState.players[0];
    const mechanic = runtime.battleState.postgameBossMechanic;
    return {
      realActiveIndex: mechanic.realActiveIndex,
      expectedRealIndex: mechanic.realIndices[1],
      songActiveIndex: mechanic.songActiveIndex,
      expectedSongIndex: mechanic.songIndices[0],
      defeatedHp: player.crew[mechanic.realIndices[0]].currentHp,
      replacementHp: player.crew[mechanic.realIndices[1]].currentHp,
      result: runtime.battleState.result || "",
    };
  });
  const secondRoundAction = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    const battle = runtime.battleState;
    const mechanic = battle.postgameBossMechanic;
    const pickMove = (index) => (player.crew[index].moveSet || []).find((move) => ["attack", "special"].includes(move.category || move.type) && Number(move.power || 0) > 0 && Number(move.currentPP ?? move.pp ?? 0) > 0)?.id;
    battle.enemyCombatant.currentHp = 1;
    return {
      roundIndex: battle.roundIndex,
      realMove: pickMove(mechanic.realActiveIndex),
      songMove: pickMove(mechanic.songActiveIndex),
    };
  });
  const secondRoundSelection = await battle.evaluate(() => ({
    realCommands: document.querySelectorAll('.postgame-world-column:not(.song) [data-tot-world-mode]').length,
    songCommands: document.querySelectorAll('.postgame-world-column.song [data-tot-world-mode]').length,
    selectedCards: document.querySelectorAll('.tot-musica-world-selected').length,
  }));
  await battle.evaluate(() => {
    window.__totSecondRoundWatch = {
      samples: 0,
      genericVisibleFrames: 0,
      missingDedicatedFrames: 0,
      impactAt: 0,
      staggerAt: 0,
      fallAt: 0,
      completeAt: 0,
      impactPortrait: "",
      staggerPortrait: "",
    };
    window.__totSecondRoundWatchTimer = setInterval(() => {
      const watch = window.__totSecondRoundWatch;
      const stage = document.getElementById("battleStage");
      const fx = document.getElementById("totMusicaDualFx");
      const bossPortrait = document.getElementById("totMusicaBossPortrait");
      const genericVisible = ["playerCard", "enemyCard"].some((id) => {
        const style = getComputedStyle(document.getElementById(id));
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.02;
      });
      watch.samples += 1;
      if (genericVisible && !stage?.classList.contains("lineage-extraction-active")) watch.genericVisibleFrames += 1;
      if (!stage?.classList.contains("tot-musica-battle-mode") || !fx?.classList.contains("show") || !fx?.classList.contains("persistent-stage")) watch.missingDedicatedFrames += 1;
      if (fx?.classList.contains("wave-impact") && !watch.impactAt) {
        watch.impactAt = performance.now();
        watch.impactPortrait = bossPortrait?.getAttribute("src") || "";
      }
      if (fx?.classList.contains("boss-knockout-stagger") && !watch.staggerAt) {
        watch.staggerAt = performance.now();
        watch.staggerPortrait = bossPortrait?.getAttribute("src") || "";
      }
      if (fx?.classList.contains("boss-knockout-fall") && !watch.fallAt) watch.fallAt = performance.now();
      if (fx?.classList.contains("boss-knockout-complete") && !watch.completeAt) watch.completeAt = performance.now();
    }, 16);
  });
  await battle.locator('[data-tot-world-mode="attack"][data-tot-world="real"]').click();
  await battle.locator(`.postgame-world-column:not(.song) [data-tot-value="${secondRoundAction.realMove}"]`).click();
  await battle.locator('[data-tot-world-mode="attack"][data-tot-world="song"]').click();
  await battle.locator(`.postgame-world-column.song [data-tot-value="${secondRoundAction.songMove}"]`).click();
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getState()?.battleState?.result === "win", null, { timeout: 20000 });
  await battle.waitForFunction(() => document.querySelector('.battle-result-ui.result-win'), null, { timeout: 15000 });
  await battle.waitForFunction(() => document.getElementById("lineageExtractionRoot")?.classList.contains("is-open"), null, { timeout: 15000 });
  await battle.waitForTimeout(180);
  const knockoutStage = await battle.evaluate(() => {
    const watch = window.__totSecondRoundWatch || {};
    return {
      impactAt: watch.impactAt || 0,
      staggerAt: watch.staggerAt || 0,
      fallAt: watch.fallAt || 0,
      completeAt: watch.completeAt || 0,
      impactPortrait: watch.impactPortrait || "",
      staggerPortrait: watch.staggerPortrait || "",
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "12-second-round-victory-result.png") });
  const secondRoundResult = await battle.evaluate(() => {
    clearInterval(window.__totSecondRoundWatchTimer);
    delete window.__totSecondRoundWatchTimer;
    const boss = document.getElementById("totMusicaBossFrame");
    const bossStyle = getComputedStyle(boss);
    const enemyRect = document.getElementById("enemyCard")?.getBoundingClientRect();
    const actionPanelRect = document.querySelector(".lineage-battle-panel.action")?.getBoundingClientRect();
    const lineageTextNodes = Array.from(document.querySelectorAll(
      ".lineage-battle-panel-title, .lineage-battle-log, .lineage-hint-line, .lineage-image-button span"
    ));
    return {
      watch: window.__totSecondRoundWatch,
      dedicated: document.getElementById("battleStage")?.classList.contains("tot-musica-battle-mode"),
      persistent: document.getElementById("totMusicaDualFx")?.classList.contains("persistent-stage"),
      lineageOpen: document.getElementById("lineageExtractionRoot")?.classList.contains("is-open"),
      lineageActive: document.getElementById("battleStage")?.classList.contains("lineage-extraction-active"),
      lineageProceedVisible: !!document.querySelector("[data-lineage-proceed]")?.offsetParent,
      lineageDeclineVisible: !!document.querySelector("[data-lineage-decline]")?.offsetParent,
      lineageActionTitle: document.querySelector("[data-lineage-action-title]")?.textContent || "",
      genericEnemyVisible: (() => {
        const node = document.getElementById("enemyCard");
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0.02;
      })(),
      enemyInViewport: !!enemyRect && enemyRect.left >= -1 && enemyRect.right <= innerWidth + 1 && enemyRect.top >= -1 && enemyRect.bottom <= innerHeight + 1,
      enemyClearOfActionPanel: !!enemyRect && !!actionPanelRect && enemyRect.bottom <= actionPanelRect.top + 1,
      lineageTextOverflow: lineageTextNodes.some((node) => node.scrollWidth > node.clientWidth + 1),
      bossVisible: bossStyle.visibility !== "hidden" && Number(bossStyle.opacity) > 0.02,
      bossHp: document.getElementById("totMusicaBossHpText")?.textContent || "",
      resultVisible: !!document.querySelector('.battle-result-ui.result-win'),
      knockoutComplete: document.getElementById("totMusicaDualFx")?.classList.contains("boss-knockout-complete"),
    };
  });
  const sceneWatch = await battle.evaluate(() => {
    clearInterval(window.__totSceneWatchTimer);
    delete window.__totSceneWatchTimer;
    return window.__totSceneWatch;
  });
  await battle.locator("[data-lineage-decline]").click();
  await battle.waitForFunction(() => !document.getElementById("lineageExtractionRoot")?.classList.contains("is-open") && !!document.querySelector("[data-finish-battle]"), null, { timeout: 15000 });
  const afterDecline = await battle.evaluate(() => ({
    lineageOpen: document.getElementById("lineageExtractionRoot")?.classList.contains("is-open"),
    finishVisible: !!document.querySelector("[data-finish-battle]")?.offsetParent,
    finishText: document.querySelector("[data-finish-battle]")?.textContent?.trim() || "",
  }));
  const bossMoves = await host.evaluate(() => {
    const runtime = window.__BOARD_GAME_DEBUG__.getState();
    return (runtime.battleState?.enemyCombatant?.moveSet || runtime.battleState?.enemyCombatant?.moves || []).map((move) => ({
      id: move.id,
      name: move.name,
      category: move.category || move.type,
      power: Number(move.power || 0),
    }));
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "13-after-lineage-decline-return-ready.png") });
  await battle.locator("[data-finish-battle]").click();
  await host.waitForFunction(() => document.getElementById("itemRevealHud")?.classList.contains("show"), null, { timeout: 15000 });
  const revealAfterReturn = await host.evaluate(() => ({
    visible: document.getElementById("itemRevealHud")?.classList.contains("show") || false,
    battleOverlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("show") || false,
    itemName: document.getElementById("itemRevealName")?.textContent || "",
  }));
  for (let attempt = 0; attempt < 4; attempt += 1) {
    if (await host.evaluate(() => !window.__BOARD_GAME_DEBUG__?.isItemRevealPending?.())) break;
    await host.waitForFunction(() => document.getElementById("itemRevealHud")?.classList.contains("awaiting"), null, { timeout: 10000 });
    await host.locator("#itemRevealHud").click({ position: { x: 8, y: 8 } });
    await host.waitForTimeout(180);
  }
  await host.waitForFunction(() => !window.__BOARD_GAME_DEBUG__?.getState()?.battleState, null, { timeout: 20000 });
  const returnedToMap = await host.evaluate(() => ({
    battleCleared: !window.__BOARD_GAME_DEBUG__?.getState()?.battleState,
    battleOverlayOpen: document.getElementById("battlePageOverlay")?.classList.contains("show") || false,
  }));
  await host.evaluate(() => {
    if (window.__totQaOriginalRandom) Math.random = window.__totQaOriginalRandom;
    delete window.__totQaOriginalRandom;
  });

  const failures = [];
  if (initiativeRules.combinedSpeed < Math.max(initiativeRules.realSpeed, initiativeRules.songSpeed) || initiativeRules.dualPriority !== initiativeRules.expectedDualPriority || initiativeRules.wipedRealIndex !== -1) failures.push(`initiative/wipeout rules ${JSON.stringify(initiativeRules)}`);
  if (!setup.dedicated || !setup.teamSetup || setup.bossVisible || !setup.genericCardsHidden || setup.slots !== 6 || setup.roster !== 6 || setup.emptySlots !== 6 || setup.visibleRosterImages !== 6) failures.push(`team setup ${JSON.stringify(setup)}`);
  if (arranged.filledSlots !== 6 || arranged.loadedSlotImages !== 6 || !arranged.confirmEnabled) failures.push(`arranged team setup ${JSON.stringify(arranged)}`);
  if (selection.bossVisible || selection.bossHudVisible || !selection.realHp || !selection.songHp || !selection.genericCardsHidden
    || !/Lv\./.test(selection.realMeta) || !/攜帶物：/.test(selection.realMeta)
    || !/Lv\./.test(selection.songMeta) || !/攜帶物：/.test(selection.songMeta)) failures.push(`selection stage ${JSON.stringify(selection)}`);
  if (!bossPreview.open || bossPreview.expanded !== "true" || !bossPreview.bossVisible || !bossPreview.hudVisible || !/HP \d+ \/ \d+/.test(bossPreview.hpText) || Math.abs(bossPreview.squareRatio - 1) > 0.03 || !bossPreview.inViewport || !bossPreview.hudAboveBoss || !bossPreview.diceHidden || !bossPreview.operationUiHidden || !bossPreview.returnVisible || !/返回我方/.test(bossPreview.returnText)) failures.push(`boss preview ${JSON.stringify(bossPreview)}`);
  if (!/Lv\./.test(statusHud.realMeta) || !/攜帶物：/.test(statusHud.realMeta) || statusHud.realStatusIcons < 1
    || !/Lv\./.test(statusHud.songMeta) || !/攜帶物：/.test(statusHud.songMeta) || statusHud.songStatusIcons < 1) failures.push(`dual status hud ${JSON.stringify(statusHud)}`);
  if (!carryPopover.open || !carryPopover.carryClass || !/攜帶物：/.test(carryPopover.text) || !/完整效果：/.test(carryPopover.text) || !carryPopover.inViewport) failures.push(`carry popover ${JSON.stringify(carryPopover)}`);
  if (JSON.stringify(teamOrder) !== JSON.stringify({ real: [0, 3, 2], song: [1, 4, 5] })) failures.push(`drag order ${JSON.stringify(teamOrder)}`);
  if (synergyMatrix.none.bonusMultiplier !== 1 || synergyMatrix.attribute.bonusMultiplier !== 1.5 || synergyMatrix.die.bonusMultiplier !== 1.5
    || synergyMatrix.moveClass.bonusMultiplier !== 1.2 || synergyMatrix.all.bonusMultiplier !== 2.2
    || synergyMatrix.rates.noAttack !== 0 || synergyMatrix.rates.mismatchBase !== 0.05
    || Math.abs(synergyMatrix.rates.mismatchMax - 0.085) > 0.000001 || synergyMatrix.rates.syncAll !== 2.2) failures.push(`synergy matrix ${JSON.stringify(synergyMatrix)}`);
  if (mismatch.bossVisible || mismatch.shardAnimations < 8 || !/碎裂/.test(mismatch.result || "") || JSON.stringify(mismatch.visibleFirstDice) !== JSON.stringify(["6", "5"])) failures.push(`mismatch ${JSON.stringify(mismatch)}`);
  if (mismatchTravel.loaded !== 2 || mismatchTravel.visible !== 2 || mismatchTravel.animations !== 2 || !mismatchTravel.spiralsHidden) failures.push(`mismatch straight travel ${JSON.stringify(mismatchTravel)}`);
  if (!/造成 77 傷害/.test(mismatchImpact.result) || !mismatchImpact.bossHit) failures.push(`mismatch impact ${JSON.stringify(mismatchImpact)}`);
  if (!action.accepted) failures.push(`action rejected ${JSON.stringify(action)}`);
  if (!action.visualEvent?.synchronized || action.visualEvent?.partialStrike || !action.visualEvent?.synergy?.sameFirstDie || Number(action.visualEvent?.synergy?.bonusMultiplier || 0) < 1.5
    || Math.abs(Number(action.visualEvent?.damage || 0) - Math.round(Number(action.visualEvent?.rawDamage || 0) * Number(action.visualEvent?.finalDamageRate || 0))) > 1) failures.push(`stacked damage bonus ${JSON.stringify(action.visualEvent)}`);
  const dualColumnsValid = commandFlow.before.originalHidden && commandFlow.before.columns.length === 2
    && commandFlow.before.columns.every((column) => column.commands === 4)
    && commandFlow.before.columns[0].right <= commandFlow.before.columns[1].left + 2;
  if (!dualColumnsValid || commandFlow.leftSubmenu.leftMoveCount < 1 || commandFlow.leftSubmenu.rightCommandCount !== 4 || !commandFlow.leftSubmenu.submenuInsideLeft || !commandFlow.afterLeft.leftSelected || !commandFlow.afterLeft.leftCanChange || commandFlow.afterLeft.rightCommands !== 4) failures.push(`dual-side command panel ${JSON.stringify(commandFlow)}`);
  if (commandOptions.partnerOptionCount !== 2 || commandOptions.itemOptionCount < 1 || !commandOptions.escapeOptions.run || !commandOptions.escapeOptions.surrender) failures.push(`command options ${JSON.stringify(commandOptions)}`);
  if (action.beforeHp !== action.maxHp) failures.push(`fresh boss hp ${JSON.stringify(action)}`);
  if (dice.real.length !== 1 || dice.song.length !== 1 || dice.bossDiceVisible || !dice.realTotal || !dice.songTotal || dice.overlaps.real || dice.overlaps.song || dice.cadenceMs < dice.expectedRollCount * 2600 - 500) failures.push(`dice layout/cadence ${JSON.stringify(dice)}`);
  if (wave.bossVisible || !wave.waveVisible || !wave.waveLoaded || wave.loadedSpiralStreams !== 2 || !wave.mergedLoaded || !wave.legacySpiralsHidden || wave.mergedAnimations < 1 || wave.cameraAnimations.some((name) => !/totMusicaCameraRise/.test(name)) || !wave.infoHidden) failures.push(`upward wave ${JSON.stringify(wave)}`);
  if (!reveal.bossVisible || reveal.bossTopRatio < 0 || reveal.bossTopRatio > 0.16 || reveal.bossBottomRatio > 0.88
    || reveal.bossWidthRatio < 0.28 || reveal.bossHeightRatio < 0.64 || reveal.bossClipped || Math.abs(reveal.bossCardRatio - 1) > 0.02
    || reveal.portraitObjectFit !== "contain" || Math.abs(reveal.portraitNaturalRatio - (2 / 3)) > 0.02 || !reveal.hudAboveBoss) failures.push(`boss high reveal ${JSON.stringify(reveal)}`);
  if (playerImpact.damageNumbers.length !== 1 || playerImpact.damageNumbers[0].value <= 0 || !["normal", "critical"].includes(playerImpact.damageNumbers[0].kind) || playerImpact.resultOverflow || playerImpact.impactAnimation !== "totMusicaImpactBurst" || playerImpact.hitDistance > Math.max(90, VIEWPORT_HEIGHT * 0.22)) failures.push(`player damage number/hit alignment ${JSON.stringify(playerImpact)}`);
  if (!enemyContinuation || !enemyContinuation.heldHigh || enemyContinuation.cameraRising || !enemyContinuation.bossVisible || !enemyContinuation.playersHidden
    || !enemyContinuation.samples || !enemyContinuation.heldFrames || enemyContinuation.selectionFrames || enemyContinuation.risingFrames) failures.push(`enemy continuous high camera ${JSON.stringify(enemyContinuation)}`);
  if (!enemyDice || enemyDice.visibleDice !== 1 || !enemyDice.bossVisible || !enemyDice.playersHiddenBelow || enemyDice.bossTopRatio > 0.18 || enemyDice.bossBottomRatio > 0.94 || enemyDice.diceOverlapsBoss) failures.push(`enemy dice ${JSON.stringify(enemyDice)}`);
  if (!enemyTravel || enemyTravel.visibleWaves !== 2 || enemyTravel.loadedWaves !== 2 || enemyTravel.waveAnimations !== 2 || enemyTravel.cameraAnimations.some((name) => !/totMusicaCameraDescend/.test(name))) failures.push(`enemy travel ${JSON.stringify(enemyTravel)}`);
  if (!enemyStrike.downward || !/受到 \d+ 傷害/.test(enemyStrike.realText) || !/受到 \d+ 傷害/.test(enemyStrike.songText) || !enemyStrike.dedicatedStillActive || !enemyStrike.genericCardsHidden || enemyStrike.damageNumbers.length !== 2 || enemyStrike.damageNumbers.some((entry) => entry.value <= 0 || !["normal", "critical"].includes(entry.kind)) || !/兩界各 \d+ 傷害|左 (?:\d+|MISS)・右 (?:\d+|MISS) 傷害/.test(enemyStrike.resultText) || enemyStrike.resultOverflow || enemyStrike.hitDistances?.some((distance) => distance > Math.max(130, VIEWPORT_HEIGHT * 0.35))) failures.push(`enemy strike/alignment ${JSON.stringify(enemyStrike)}`);
  if (replacement.realActiveIndex !== replacement.expectedRealIndex || replacement.songActiveIndex !== replacement.expectedSongIndex || replacement.defeatedHp !== 0 || replacement.replacementHp <= 0 || replacement.result) failures.push(`same-world automatic replacement ${JSON.stringify(replacement)}`);
  if (secondRoundSelection.realCommands !== 4 || secondRoundSelection.songCommands !== 4 || secondRoundSelection.selectedCards !== 0) failures.push(`second round selection reset ${JSON.stringify(secondRoundSelection)}`);
  if (!secondRoundResult.dedicated || !secondRoundResult.persistent || !secondRoundResult.lineageOpen || !secondRoundResult.lineageActive
    || !secondRoundResult.lineageProceedVisible || !secondRoundResult.lineageDeclineVisible || !/是否進行血統因子提取/.test(secondRoundResult.lineageActionTitle)
    || !secondRoundResult.enemyInViewport || !secondRoundResult.enemyClearOfActionPanel || secondRoundResult.lineageTextOverflow
    || !secondRoundResult.genericEnemyVisible || secondRoundResult.bossVisible || !/HP 0 \/ \d+/.test(secondRoundResult.bossHp) || !secondRoundResult.resultVisible || !secondRoundResult.knockoutComplete
    || !secondRoundResult.watch?.samples || secondRoundResult.watch.genericVisibleFrames || secondRoundResult.watch.missingDedicatedFrames
    || !secondRoundResult.watch.impactAt || !secondRoundResult.watch.staggerAt || !secondRoundResult.watch.fallAt || !secondRoundResult.watch.completeAt
    || secondRoundResult.watch.staggerAt <= secondRoundResult.watch.impactAt || secondRoundResult.watch.fallAt <= secondRoundResult.watch.staggerAt || secondRoundResult.watch.completeAt <= secondRoundResult.watch.fallAt
    || !/hit/.test(secondRoundResult.watch.impactPortrait || "") || !/dizzy/.test(secondRoundResult.watch.staggerPortrait || "")) failures.push(`second round victory continuity ${JSON.stringify(secondRoundResult)}`);
  if (afterDecline.lineageOpen || !afterDecline.finishVisible || !/返回地圖/.test(afterDecline.finishText)) failures.push(`lineage decline did not unlock result ${JSON.stringify(afterDecline)}`);
  if (!revealAfterReturn.visible || revealAfterReturn.battleOverlayOpen || !revealAfterReturn.itemName) failures.push(`post-battle item reveal blocked by battle overlay ${JSON.stringify(revealAfterReturn)}`);
  if (!returnedToMap.battleCleared || returnedToMap.battleOverlayOpen) failures.push(`return map did not finish battle ${JSON.stringify(returnedToMap)}`);
  if (bossMoves.length !== 4 || bossMoves.some((move) => !["attack", "special"].includes(move.category) || move.power <= 0)) failures.push(`boss moves not all damaging attacks ${JSON.stringify(bossMoves)}`);
  if (!sceneWatch?.samples || sceneWatch.genericVisibleFrames || sceneWatch.missingDedicatedFrames || sceneWatch.earlyBossFrames) failures.push(`dedicated stage continuity ${JSON.stringify(sceneWatch)}`);
  const revealFromLaunchMs = Number(sceneWatch?.revealAt || 0) - Number(sceneWatch?.launchAt || 0);
  const impactFromRevealMs = Number(sceneWatch?.impactAt || 0) - Number(sceneWatch?.revealAt || 0);
  const impactFromLaunchMs = Number(sceneWatch?.impactAt || 0) - Number(sceneWatch?.launchAt || 0);
  if (!sceneWatch?.launchAt || !sceneWatch?.revealAt || !sceneWatch?.impactAt || revealFromLaunchMs < 2850 || revealFromLaunchMs > 3350
    || impactFromRevealMs < 900 || impactFromRevealMs > 1350 || impactFromLaunchMs < 3950 || impactFromLaunchMs > 4450) failures.push(`player impact cadence ${JSON.stringify({ revealFromLaunchMs, impactFromRevealMs, impactFromLaunchMs })}`);
  if (sceneWatch?.revealHpWidth < 99.9 || !sceneWatch?.revealHpText?.includes(`${action.beforeHp} / ${action.maxHp}`) || !(sceneWatch?.impactHpWidth < sceneWatch?.revealHpWidth) || sceneWatch?.impactHpText === sceneWatch?.revealHpText) failures.push(`boss hp impact timing ${JSON.stringify(sceneWatch)}`);
  const report = { initiativeRules, setup, arranged, selection, bossPreview, statusHud, carryPopover, teamOrder, synergyMatrix, mismatch, mismatchTravel, mismatchImpact, commandFlow, commandOptions, action, dice, wave, reveal, playerImpact, enemyContinuation, enemyDice, enemyTravel, enemyStrike, replacement, secondRoundSelection, secondRoundAction, knockoutStage, secondRoundResult, afterDecline, revealAfterReturn, returnedToMap, bossMoves, sceneWatch, errors, failures, outputDir: OUTPUT_DIR };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
