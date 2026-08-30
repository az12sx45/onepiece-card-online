"use strict";

const { chromium } = require("playwright");

const rootUrl = process.argv[2] || "http://127.0.0.1:8787";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const roomCode = `YQ${Date.now().toString(36).slice(-6).toUpperCase()}`;
const errors = [];

function attachErrors(page, label) {
  page.on("pageerror", error => errors.push(`${label}: pageerror: ${error.message}`));
  page.on("console", message => {
    const text = message.text();
    if (message.type() === "error" && !/Failed to load resource|DATABASE_URL|manual save/i.test(text)) errors.push(`${label}: console: ${text}`);
  });
  page.on("response", response => {
    if (response.status() >= 400 && !/favicon\.ico|api\/board\/save/i.test(response.url())) errors.push(`${label}: http ${response.status()}: ${response.url()}`);
  });
}

async function placeSolution(frame, solution) {
  for (let index = 0; index < solution.length; index += 1) {
    await frame.locator(`[data-bank-card="${solution[index]}"]`).click();
    await frame.locator("#sequencePanel [data-slot-index]").nth(index).click();
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  const hostProfile = {
    userId: 880001,
    clientId: `york-qa-host-${roomCode}`,
    name: "約克 QA 房主",
    avatar: 8,
    title: "座標測試員",
  };
  const installProfile = async (browserContext, profile) => browserContext.addInitScript(value => {
    localStorage.setItem("op_board_user_id", String(value.userId));
    localStorage.setItem("op_board_client_id", value.clientId);
    localStorage.setItem("op_name", value.name);
  }, profile);
  const keeperContext = await browser.newContext();
  await installProfile(keeperContext, hostProfile);
  const keeper = await keeperContext.newPage();
  await keeper.goto(`${rootUrl}/board_start.html?york_room_keeper=1`, { waitUntil: "domcontentloaded" });
  await keeper.waitForFunction(() => typeof window.io === "function", null, { timeout: 10000 });
  const createRoomResult = await keeper.evaluate(({ roomCode: code, profile }) => new Promise((resolve, reject) => {
    const socket = window.io({ transports: ["websocket", "polling"] });
    window.__yorkQaRoomKeeperSocket = socket;
    const timer = setTimeout(() => reject(new Error("room create timeout")), 10000);
    socket.on("connect", () => {
      socket.emit("BOARD_JOIN_ROOM", { roomCode: code, create: true, profile }, result => {
        clearTimeout(timer);
        resolve(result);
      });
    });
  }), { roomCode, profile: hostProfile });
  if (!createRoomResult?.ok) throw new Error(`Unable to create QA board room: ${JSON.stringify(createRoomResult)}`);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  await installProfile(context, hostProfile);
  const page = await context.newPage();
  attachErrors(page, "host");
  await page.goto(`${rootUrl}/board_game.html?room=${roomCode}&online=1&york_formal_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardYorkCluePuzzle, null, { timeout: 20000 });

  const setup = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    state.gameState.phase = "main";
    state.gameState.currentPlayerIndex = 0;
    state.gameState.resolutionLock = false;
    const player = state.gameState.players[0];
    debug.unlockPostgameWorldAfterEnding(player, { id: "york-formal-qa" });
    debug.grantAllYorkClues(player);
    debug.renderAll();
    return {
      playerId: String(player.id),
      layoutSeed: String(state.gameState.postgameWorld.layoutSeed),
      clueTotal: Object.entries(player.inventory.items).filter(([id]) => id.startsWith("york_clue_")).reduce((sum, [, count]) => sum + Number(count || 0), 0),
    };
  });

  const opened = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.activateYorkTrackingFromBackpack(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()));
  if (!opened) errors.push("formal overlay did not open from the backpack action");
  const iframeElement = page.locator("#yorkPuzzleOverlay iframe");
  await iframeElement.waitFor({ state: "visible", timeout: 10000 });
  const frame = page.frames().find(entry => /board_york_clue_puzzle_formal_demo\.html/.test(entry.url()));
  if (!frame) throw new Error("Unable to locate the embedded York puzzle frame.");
  await frame.locator('[data-difficulty="easy"]').click();
  const easySolution = await page.evaluate(({ layoutSeed, playerId }) => window.BoardYorkCluePuzzle.createPuzzle(layoutSeed, playerId, "easy").solution, setup);
  await placeSolution(frame, easySolution);
  await frame.locator("#submitButton").click();
  await frame.locator("#resultOverlay:not(.hidden)").waitFor({ state: "visible", timeout: 10000 });

  const easyResult = await page.evaluate((clueTotalBefore) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const clueTotalAfter = Object.entries(player.inventory.items).filter(([id]) => id.startsWith("york_clue_")).reduce((sum, [, count]) => sum + Number(count || 0), 0);
    return {
      tier: debug.normalizePlayerYorkDecoderState(player),
      decoderCounts: [1, 2, 3].map(tier => Number(player.inventory.items[`york_coordinate_decoder_t${tier}`] || 0)),
      eggheadUnlocked: state.gameState.postgameWorld.eggheadUnlocked,
      clueTotalBefore,
      clueTotalAfter,
    };
  }, setup.clueTotal);
  if (easyResult.tier !== 1 || easyResult.decoderCounts.join(",") !== "1,0,0" || !easyResult.eggheadUnlocked || easyResult.clueTotalBefore !== easyResult.clueTotalAfter) {
    errors.push(`easy formal result mismatch: ${JSON.stringify(easyResult)}`);
  }
  await frame.locator("#resultClose").click();
  await page.locator("#yorkPuzzleOverlay").waitFor({ state: "detached", timeout: 10000 });

  const ruleAudit = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const api = window.BoardYorkCluePuzzle;
    const players = state.gameState.players;
    const world = state.gameState.postgameWorld;
    state.gameState.resolutionLock = false;
    while (players.length < 4) {
      const clone = JSON.parse(JSON.stringify(players[0]));
      clone.id = `york-qa-player-${players.length + 1}`;
      clone.userId = 990000 + players.length;
      clone.clientId = `york-qa-client-${players.length + 1}`;
      clone.name = `約克 QA 玩家 ${players.length + 1}`;
      clone.isMe = false;
      clone.isCPU = false;
      clone.yorkDecoderTier = 0;
      [1, 2, 3].forEach(tier => delete clone.inventory.items[`york_coordinate_decoder_t${tier}`]);
      clone.items = (clone.items || []).filter(item => !String(item?.id || item || "").startsWith("york_coordinate_decoder_t"));
      players.push(clone);
    }
    players.forEach(player => debug.grantAllYorkClues(player));
    const solve = (player, key) => debug.completeYorkPuzzleDifficulty(
      player,
      key,
      api.createPuzzle(world.layoutSeed, player.id, key).solution,
      { skipControl: true, deferWorldCinematic: true, source: "qa" },
    );
    const p1Normal = solve(players[0], "normal");
    const p1Hard = solve(players[0], "hard");
    const p2Easy = solve(players[1], "easy");
    const p2Hard = solve(players[1], "hard");
    const p3Hard = solve(players[2], "hard");
    const p3MissingVariant = solve(players[2], "hard");
    const practiceVariant = "qa-tier3-practice-round-1";
    const p3BeforePractice = {
      tier: debug.normalizePlayerYorkDecoderState(players[2]),
      decoders: [1, 2, 3].map(tier => Number(players[2].inventory.items[`york_coordinate_decoder_t${tier}`] || 0)),
      clues: Object.entries(players[2].inventory.items).filter(([id]) => id.startsWith("york_clue_")).reduce((sum, [, count]) => sum + Number(count || 0), 0),
      eggheadUnlocked: world.eggheadUnlocked,
    };
    const p3Repeat = debug.completeYorkPuzzleDifficulty(
      players[2],
      "hard",
      api.createPuzzle(world.layoutSeed, players[2].id, "hard", practiceVariant).solution,
      { skipControl: true, deferWorldCinematic: true, source: "qa-practice", puzzleVariant: practiceVariant },
    );
    const p3AfterPractice = {
      tier: debug.normalizePlayerYorkDecoderState(players[2]),
      decoders: [1, 2, 3].map(tier => Number(players[2].inventory.items[`york_coordinate_decoder_t${tier}`] || 0)),
      clues: Object.entries(players[2].inventory.items).filter(([id]) => id.startsWith("york_clue_")).reduce((sum, [, count]) => sum + Number(count || 0), 0),
      eggheadUnlocked: world.eggheadUnlocked,
    };
    const wrong = debug.completeYorkPuzzleDifficulty(players[3], "hard", api.createPuzzle(world.layoutSeed, players[3].id, "hard").initialOrder, { skipControl: true });
    players[3].isCPU = true;
    const cpuFirst = debug.completeYorkCpuDecoder(players[3]);
    const cpuSecond = debug.completeYorkCpuDecoder(players[3]);
    return {
      p1: [p1Normal.ok, p1Hard.ok, debug.normalizePlayerYorkDecoderState(players[0])],
      p2: [p2Easy.ok, p2Hard.ok, debug.normalizePlayerYorkDecoderState(players[1])],
      p3: [p3Hard.ok, p3MissingVariant.ok, p3Repeat.ok, debug.normalizePlayerYorkDecoderState(players[2])],
      practice: { result: p3Repeat, before: p3BeforePractice, after: p3AfterPractice },
      wrong: [wrong.ok, debug.normalizePlayerYorkDecoderState(players[3])],
      cpu: [cpuFirst, cpuSecond, debug.normalizePlayerYorkDecoderState(players[3])],
      eggheadAnchor: world.eggheadAnchorIslandId,
      eggheadRoute: world.eggheadRouteId,
    };
  });
  if (JSON.stringify(ruleAudit.p1) !== JSON.stringify([true, true, 3])) errors.push(`T1 -> T2 -> T3 failed: ${JSON.stringify(ruleAudit.p1)}`);
  if (JSON.stringify(ruleAudit.p2) !== JSON.stringify([true, true, 3])) errors.push(`T1 -> T3 failed: ${JSON.stringify(ruleAudit.p2)}`);
  if (JSON.stringify(ruleAudit.p3) !== JSON.stringify([true, false, true, 3])) errors.push(`hard-first/practice replay failed: ${JSON.stringify(ruleAudit.p3)}`);
  if (!ruleAudit.practice.result.practice || ruleAudit.practice.result.rewardGranted !== false
    || JSON.stringify(ruleAudit.practice.before) !== JSON.stringify(ruleAudit.practice.after)) {
    errors.push(`tier-3 practice changed rewards or state: ${JSON.stringify(ruleAudit.practice)}`);
  }
  if (ruleAudit.wrong[0]) errors.push(`wrong answer upgraded a player: ${JSON.stringify(ruleAudit.wrong)}`);
  if (JSON.stringify(ruleAudit.cpu) !== JSON.stringify([true, false, 2])) errors.push(`CPU normal-only rule failed: ${JSON.stringify(ruleAudit.cpu)}`);

  const practiceOpened = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.activateYorkTrackingFromBackpack(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()));
  if (!practiceOpened) errors.push("tier-3 practice overlay did not open");
  const practiceIframeElement = page.locator("#yorkPuzzleOverlay iframe");
  await practiceIframeElement.waitFor({ state: "visible", timeout: 10000 });
  const practiceFrame = page.frames().find(entry => /board_york_clue_puzzle_formal_demo\.html/.test(entry.url()) && /puzzleVariant=/.test(entry.url()));
  if (!practiceFrame) throw new Error("Unable to locate the tier-3 practice frame.");
  const practiceFrameUrl = new URL(practiceFrame.url());
  const practiceVariant = practiceFrameUrl.searchParams.get("puzzleVariant") || "";
  const practiceSelection = await practiceFrame.locator("#difficultyGrid").evaluate(element => ({
    buttons: element.querySelectorAll("[data-difficulty]").length,
    disabled: element.querySelectorAll("[data-difficulty]:disabled").length,
    text: element.textContent,
  }));
  const practiceBefore = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    return {
      tier: debug.normalizePlayerYorkDecoderState(player),
      decoders: [1, 2, 3].map(tier => Number(player.inventory.items[`york_coordinate_decoder_t${tier}`] || 0)),
      clues: Object.entries(player.inventory.items).filter(([id]) => id.startsWith("york_clue_")).reduce((sum, [, count]) => sum + Number(count || 0), 0),
      eggheadUnlocked: state.gameState.postgameWorld.eggheadUnlocked,
    };
  });
  await practiceFrame.locator('[data-difficulty="hard"]').click();
  const practiceSolutionAudit = await page.evaluate(({ layoutSeed, playerId, variant }) => {
    const api = window.BoardYorkCluePuzzle;
    const base = api.createPuzzle(layoutSeed, playerId, "hard");
    const practice = api.createPuzzle(layoutSeed, playerId, "hard", variant);
    return { solution: practice.solution, changed: !api.arraysEqual(base.solution, practice.solution), valid: api.validatePuzzle(practice).ok };
  }, { layoutSeed: setup.layoutSeed, playerId: setup.playerId, variant: practiceVariant });
  await placeSolution(practiceFrame, practiceSolutionAudit.solution);
  await practiceFrame.locator("#submitButton").click();
  await practiceFrame.locator("#resultOverlay:not(.hidden)").waitFor({ state: "visible", timeout: 10000 });
  const practiceResultText = await practiceFrame.locator("#resultOverlay").innerText();
  const practiceAfter = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    return {
      tier: debug.normalizePlayerYorkDecoderState(player),
      decoders: [1, 2, 3].map(tier => Number(player.inventory.items[`york_coordinate_decoder_t${tier}`] || 0)),
      clues: Object.entries(player.inventory.items).filter(([id]) => id.startsWith("york_clue_")).reduce((sum, [, count]) => sum + Number(count || 0), 0),
      eggheadUnlocked: state.gameState.postgameWorld.eggheadUnlocked,
    };
  });
  const practiceUiAudit = { practiceOpened, practiceVariant, practiceSelection, practiceSolutionAudit, practiceBefore, practiceAfter, practiceResultText };
  if (!practiceVariant || practiceSelection.buttons !== 3 || practiceSelection.disabled !== 0
    || !practiceSelection.text.includes("開始新題目") || !practiceSelection.text.includes("不發放其他加成獎勵")
    || !practiceSolutionAudit.changed || !practiceSolutionAudit.valid
    || JSON.stringify(practiceBefore) !== JSON.stringify(practiceAfter)
    || !practiceResultText.includes("未獲得新道具或階級") || !practiceResultText.includes("維持不變")) {
    errors.push(`tier-3 practice UI audit failed: ${JSON.stringify(practiceUiAudit)}`);
  }
  await practiceFrame.locator("#resultClose").click();
  await page.locator("#yorkPuzzleOverlay").waitFor({ state: "detached", timeout: 10000 });
  practiceUiAudit.secondOpened = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.activateYorkTrackingFromBackpack(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()));
  await page.locator("#yorkPuzzleOverlay iframe").waitFor({ state: "visible", timeout: 10000 });
  const secondPracticeFrame = page.frames().find(entry => /board_york_clue_puzzle_formal_demo\.html/.test(entry.url()) && /puzzleVariant=/.test(entry.url()));
  practiceUiAudit.secondVariant = secondPracticeFrame ? (new URL(secondPracticeFrame.url()).searchParams.get("puzzleVariant") || "") : "";
  practiceUiAudit.variantChangedOnReopen = Boolean(practiceUiAudit.secondVariant && practiceUiAudit.secondVariant !== practiceVariant);
  if (!practiceUiAudit.secondOpened || !practiceUiAudit.variantChangedOnReopen) {
    errors.push(`tier-3 practice did not create a new question on reopen: ${JSON.stringify(practiceUiAudit)}`);
  }
  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.closeYorkPuzzleOverlay());
  await page.locator("#yorkPuzzleOverlay").waitFor({ state: "detached", timeout: 10000 });

  const dropAudit = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getState().gameState.players[0];
    const resetTier = (tier) => {
      player.yorkDecoderTier = 0;
      [1, 2, 3].forEach(value => delete player.inventory.items[`york_coordinate_decoder_t${value}`]);
      if (tier > 0) debug.grantYorkDecoderTier(player, tier, { source: "qa" });
    };
    const countEclipse = () => (player.items || []).filter(item => item?.id === "rocks_eclipse_sword").length;
    const run = (tier, roll, battle = { rocksRewardedPlayerIds: [], enemyTier: "T1", isRocksBattle: true }) => {
      resetTier(tier);
      const before = countEclipse();
      const result = debug.grantRocksVictoryRewards(player, battle, { rand: () => roll });
      return { dropped: result?.eclipseDropped || false, delta: countEclipse() - before, battle };
    };
    const baseHit = run(0, 0.099);
    const baseMiss = run(0, 0.1);
    const t1Hit = run(1, 0.199);
    const t1Miss = run(1, 0.2);
    const t2Hit = run(2, 0.299);
    const t2Miss = run(2, 0.3);
    const t3Battle = { rocksRewardedPlayerIds: [], enemyTier: "T1", isRocksBattle: true };
    const t3Hit = run(3, 0.399, t3Battle);
    const beforeDuplicate = countEclipse();
    const duplicate = debug.grantRocksVictoryRewards(player, t3Battle, { rand: () => 0 });
    const duplicateDelta = countEclipse() - beforeDuplicate;
    const t3Miss = run(3, 0.4);
    resetTier(3);
    const beforeRepeat = countEclipse();
    debug.grantRocksVictoryRewards(player, { rocksRewardedPlayerIds: [], enemyTier: "T1", isRocksBattle: true }, { rand: () => 0.1 });
    const repeatDelta = countEclipse() - beforeRepeat;
    const tradeable = debug.tradeableInventoryEntries(player).some(entry => entry.id === "rocks_eclipse_sword");
    return { baseHit, baseMiss, t1Hit, t1Miss, t2Hit, t2Miss, t3Hit, t3Miss, duplicateWasNull: duplicate === null, duplicateDelta, repeatDelta, tradeable };
  });
  const dropExpected = dropAudit.baseHit.dropped && dropAudit.baseHit.delta === 1 && !dropAudit.baseMiss.dropped
    && dropAudit.t1Hit.dropped && dropAudit.t1Hit.delta === 1 && !dropAudit.t1Miss.dropped
    && dropAudit.t2Hit.dropped && dropAudit.t2Hit.delta === 1 && !dropAudit.t2Miss.dropped
    && dropAudit.t3Hit.dropped && dropAudit.t3Hit.delta === 1 && !dropAudit.t3Miss.dropped
    && dropAudit.duplicateWasNull && dropAudit.duplicateDelta === 0 && dropAudit.repeatDelta === 1 && !dropAudit.tradeable;
  if (!dropExpected) errors.push(`Rocks drop audit failed: ${JSON.stringify(dropAudit)}`);

  const bossRelicDropAudit = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getState().gameState.players[0];
    const bossKeys = [
      "postgame_shiki", "postgame_gild_tesoro", "postgame_zephyr", "postgame_tot_musica",
      "postgame_douglas_bullet", "postgame_saga", "postgame_vinsmoke_judge",
      "postgame_rob_lucci_awakened", "postgame_king", "postgame_charlotte_katakuri",
      "postgame_patrick_redfield", "postgame_oars", "postgame_aramaki",
    ];
    const hits = bossKeys.map(bossKey => {
      const result = debug.grantPostgameBossRelicDrop(player, { postgameBossKey: bossKey }, { rand: () => 0.099 });
      return { bossKey, itemId: result?.relicDef?.id || "", dropped: !!result?.dropped, rate: result?.dropRate };
    });
    const missBattle = { postgameBossKey: "postgame_shiki" };
    const miss = debug.grantPostgameBossRelicDrop(player, missBattle, { rand: () => 0.1 });
    const duplicate = debug.grantPostgameBossRelicDrop(player, missBattle, { rand: () => 0 });
    return { hits, miss: !!miss?.dropped, missRate: miss?.dropRate, duplicateWasNull: duplicate === null };
  });
  if (bossRelicDropAudit.hits.length !== 13 || bossRelicDropAudit.hits.some(entry => !entry.dropped || entry.rate !== 0.1 || !entry.itemId)
    || bossRelicDropAudit.miss || bossRelicDropAudit.missRate !== 0.1 || !bossRelicDropAudit.duplicateWasNull) {
    errors.push(`Boss relic drop audit failed: ${JSON.stringify(bossRelicDropAudit)}`);
  }

  const adjustedRelicEffectAudit = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getState().gameState.players[0];
    if (!player.crew?.length) player.crew = [debug.cloneCard(window.BoardCards.cards[0])];
    player.activeCrewIndex = 0;
    const card = player.crew[0];
    const previous = card.battleCarryItem;
    card.battleCarryItem = { type: "battleCarry", id: "rocks_eclipse_sword", bound: false };
    const battle = {
      activeCrewIndex: 0,
      roundIndex: 1,
      enemyCombatant: { baseStats: { atk: 1, def: 1, satk: 1, sdef: 1, spd: 1 }, stages: { atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 } },
      playerStages: { atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 },
      playerRoundEffects: {},
      carryItemStates: {},
      log: [],
    };
    battle.heldItemStates = battle.carryItemStates;
    const thresholds = [6, 5, 4].map(value => debug.rocksEclipseThirdDiceThreshold("player", player, battle, value));
    const enemyThreshold = debug.rocksEclipseThirdDiceThreshold("enemy", player, battle, 4);
    card.battleCarryItem = null;
    const noItemThreshold = debug.rocksEclipseThirdDiceThreshold("player", player, battle, 4);
    const baseHp = debug.cardMaxHp(card);
    const baseSpeed = debug.currentBattleStat("player", "spd", player, battle);
    card.battleCarryItem = { type: "battleCarry", id: "lucci_awakened_black_flame_hagoromo", bound: false };
    const boostedHp = debug.cardMaxHp(card);
    const boostedSpeed = debug.currentBattleStat("player", "spd", player, battle);
    card.battleCarryItem = previous || null;
    return {
      thresholds,
      enemyThreshold,
      noItemThreshold,
      baseHp,
      boostedHp,
      baseSpeed,
      boostedSpeed,
    };
  });
  if (JSON.stringify(adjustedRelicEffectAudit.thresholds) !== JSON.stringify([5, 3, 1])
    || adjustedRelicEffectAudit.enemyThreshold !== 0 || adjustedRelicEffectAudit.noItemThreshold !== 0
    || adjustedRelicEffectAudit.boostedHp !== Math.round(adjustedRelicEffectAudit.baseHp * 1.3)
    || adjustedRelicEffectAudit.boostedSpeed !== Math.round(adjustedRelicEffectAudit.baseSpeed * 1.3)) {
    errors.push(`Adjusted relic effect audit failed: ${JSON.stringify(adjustedRelicEffectAudit)}`);
  }

  const saveAudit = await page.evaluate(async (qaRoomCode) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    await debug.saveManualGame({ silent: true });
    const saved = debug.readManualSavePayload();
    const savedTier = saved?.gameState?.players?.[0]?.yorkDecoderTier;
    player.yorkDecoderTier = 0;
    [1, 2, 3].forEach(tier => delete player.inventory.items[`york_coordinate_decoder_t${tier}`]);
    const loaded = debug.loadManualGame(saved, { silent: true, source: "qa" });
    const restoredTier = debug.normalizePlayerYorkDecoderState(debug.getState().gameState.players[0]);
    const legacy = debug.createManualSavePayload();
    const legacyPlayer = legacy.gameState.players[0];
    delete legacyPlayer.yorkDecoderTier;
    legacyPlayer.inventory.items.york_coordinate_decoder_t1 = 1;
    legacyPlayer.inventory.items.york_coordinate_decoder_t3 = 2;
    debug.loadManualGame(legacy, { silent: true, source: "qa-old-save" });
    const normalizedPlayer = debug.getState().gameState.players[0];
    const normalizedTier = debug.normalizePlayerYorkDecoderState(normalizedPlayer);
    const normalizedCounts = [1, 2, 3].map(tier => Number(normalizedPlayer.inventory.items[`york_coordinate_decoder_t${tier}`] || 0));
    localStorage.removeItem("onepiece-board-manual-save-v1");
    localStorage.removeItem(`onepiece-board-manual-save-v1:${qaRoomCode}`);
    const cleanupResponse = await fetch(`/api/board-save/${encodeURIComponent(qaRoomCode)}`, {
      method: "DELETE",
    });
    const deleted = cleanupResponse.ok && !debug.readManualSavePayload();
    return { saved: Boolean(saved), savedTier, loaded, restoredTier, normalizedTier, normalizedCounts, deleted };
  }, roomCode);
  if (!saveAudit.saved || !saveAudit.loaded || saveAudit.restoredTier !== saveAudit.savedTier || saveAudit.normalizedTier !== 3 || saveAudit.normalizedCounts.join(",") !== "0,0,1" || !saveAudit.deleted) {
    errors.push(`save/load/normalization audit failed: ${JSON.stringify(saveAudit)}`);
  }

  let syncAudit = { attempted: false, converged: false, viewerOpenedPuzzle: null };
  const spectatorContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 1 });
  await installProfile(spectatorContext, {
    userId: 880002,
    clientId: `york-qa-viewer-${roomCode}`,
    name: "約克 QA 觀看方",
  });
  const spectator = await spectatorContext.newPage();
  attachErrors(spectator, "spectator");
  try {
    await spectator.goto(`${rootUrl}/board_game.html?room=${roomCode}&online=1&york_formal_qa_viewer=1`, { waitUntil: "domcontentloaded" });
    await spectator.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().connected, null, { timeout: 15000 });
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.boardLanStatus?.().connected, null, { timeout: 15000 });
    const hostSync = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const player = state.gameState.players[0];
      state.gameState.phase = "main";
      state.gameState.currentPlayerIndex = 0;
      player.yorkDecoderTier = 0;
      [1, 2, 3].forEach(tier => delete player.inventory.items[`york_coordinate_decoder_t${tier}`]);
      debug.grantYorkDecoderTier(player, 2, { source: "qa-sync" });
      debug.pushBoardLanState("york-formal-sync-qa");
      return { playerId: String(player.id), tier: player.yorkDecoderTier, eggheadUnlocked: state.gameState.postgameWorld.eggheadUnlocked };
    });
    await spectator.waitForFunction(expected => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug?.getState?.();
      const player = state?.gameState?.players?.find(entry => String(entry?.id || "") === expected.playerId);
      return Number(player?.yorkDecoderTier || 0) === expected.tier && Boolean(state?.gameState?.postgameWorld?.eggheadUnlocked) === expected.eggheadUnlocked;
    }, hostSync, { timeout: 15000 });
    const viewerOpenedPuzzle = await spectator.evaluate((playerId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const player = debug.getState().gameState.players.find(entry => String(entry?.id || "") === playerId);
      return debug.activateYorkTrackingFromBackpack(player);
    }, hostSync.playerId);
    syncAudit = { attempted: true, converged: true, viewerOpenedPuzzle, hostSync };
    if (viewerOpenedPuzzle) errors.push("spectator was able to open the controlled player's puzzle");
  } catch (error) {
    const hostStatus = await page.evaluate(() => window.__BOARD_GAME_DEBUG__?.boardLanStatus?.() || null).catch(() => null);
    const spectatorStatus = await spectator.evaluate(() => window.__BOARD_GAME_DEBUG__?.boardLanStatus?.() || null).catch(() => null);
    syncAudit = { attempted: true, converged: false, viewerOpenedPuzzle: null, error: error.message, hostStatus, spectatorStatus };
    errors.push(`BOARD_GAME_STATE sync audit failed: ${error.message}`);
  } finally {
    await spectatorContext.close();
  }

  const battleUiPage = await context.newPage();
  attachErrors(battleUiPage, "battle-ui");
  await battleUiPage.goto(`${rootUrl}/board_battle.html`, { waitUntil: "domcontentloaded" });
  await battleUiPage.waitForFunction(() => Boolean(window.__BOARD_BATTLE_DEBUG__), null, { timeout: 10000 });
  const thirdDiceUiAudit = await battleUiPage.evaluate(() => {
    const debug = window.__BOARD_BATTLE_DEBUG__;
    const rolling = { isExtraDice: true, extraDiceOrdinal: 3, firstDie: 6, secondDie: 3, triggerThreshold: 3, extraDiceReason: "名刀『日蝕』", settle: 4 };
    const final = { firstDie: 6, secondDie: 3, thirdDie: 4, settle: 13, extraDiceReason: "名刀『日蝕』", bonusText: "總點數 13" };
    return {
      rollingTitle: debug.diceRollingTitle(rolling),
      rollingSubtitle: debug.diceRollingSubtitle(rolling, "attack"),
      settledTitle: debug.diceSettledTitleForEvent(rolling),
      settledSubtitle: debug.diceSettledSubtitleForEvent(rolling, "attack"),
      finalTitle: debug.diceSettledTitleForEvent(final),
      finalSubtitle: debug.diceSettledSubtitleForEvent(final, "attack"),
    };
  });
  await battleUiPage.close();
  if (!thirdDiceUiAudit.rollingTitle.includes("第三顆戰鬥骰")
    || !thirdDiceUiAudit.rollingSubtitle.includes("第二顆 3") || !thirdDiceUiAudit.rollingSubtitle.includes("正在骰第三顆")
    || !thirdDiceUiAudit.settledTitle.includes("第三顆骰出 4") || !thirdDiceUiAudit.settledSubtitle.includes("第三顆 4")
    || !thirdDiceUiAudit.finalTitle.includes("6 + 3 + 4 = 13") || !thirdDiceUiAudit.finalSubtitle.includes("總點數 13")) {
    errors.push(`Third dice battle UI audit failed: ${JSON.stringify(thirdDiceUiAudit)}`);
  }

  const report = {
    ok: errors.length === 0,
    roomCode,
    setup,
    easyResult,
    ruleAudit,
    practiceUiAudit,
    dropAudit,
    bossRelicDropAudit,
    adjustedRelicEffectAudit,
    thirdDiceUiAudit,
    saveAudit,
    syncAudit,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
  await keeperContext.close();
  await browser.close();
})().catch(error => {
  console.error(error);
  process.exit(1);
});
