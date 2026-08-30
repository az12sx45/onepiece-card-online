const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("tmp/tot-musica-player-world-coop-qa");
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

async function preparePlayerWorldBattle(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const game = runtime.gameState;
    const cards = window.BoardCards.cards;
    const owner = game.players[0];
    owner.id = "tot-world-owner";
    owner.userId = 910001;
    owner.clientId = "tot-world-client-owner";
    owner.name = "現實船長";
    owner.isCPU = false;
    owner.isMe = true;
    owner.crew = cards.slice(0, 6).map((card) => debug.cloneCard(card));
    owner.activeCrewIndex = 0;
    owner.pendingBattle = null;
    owner.crew.forEach((card, index) => {
      card.baseStats ||= {};
      card.baseStats.hp = 3000;
      card.baseStats.spd = index === 0 ? 120 : 80;
      card.currentHp = 3000;
      card.battleCarryItem = null;
      (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(5, Number(move.pp || move.currentPP || 5)); });
    });

    const makePlayer = (id, userId, name, cardOffset) => {
      const player = JSON.parse(JSON.stringify(owner));
      player.id = id;
      player.userId = userId;
      player.clientId = `${id}-client`;
      player.name = name;
      player.isMe = false;
      player.crew = cards.slice(cardOffset, cardOffset + 6).map((card) => debug.cloneCard(card));
      player.activeCrewIndex = 0;
      player.crew.forEach((card, index) => {
        card.baseStats ||= {};
        card.baseStats.hp = 3000;
        card.baseStats.spd = index === 0 ? (id === "tot-world-song" ? 360 : 180) : 80;
        card.currentHp = 3000;
        card.battleCarryItem = null;
        (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(5, Number(move.pp || move.currentPP || 5)); });
      });
      return player;
    };
    const song = makePlayer("tot-world-song", 910002, "歌世界船長", 6);
    const newcomer = makePlayer("tot-world-newcomer", 910003, "後援船長", 12);
    game.players = [owner, song, newcomer];
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.pendingMove = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    runtime.battleState = null;

    if (!game.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(owner, { id: "tot-player-world-coop-qa" });
    debug.ensurePostgameWorldLayout(game);
    const assignment = game.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_tot_musica");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.isDefeated = false;
    debug.startBattle(owner, island, islandState);

    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualAnimating = false;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.result = "";
    battle.coop = {
      enabled: true,
      participantIds: [owner.id, song.id, newcomer.id],
      actions: {},
      runtimes: {},
      defeated: {},
      roundStartedAt: Date.now(),
    };
    game.players.forEach((player) => debug.getBattleView({ coopViewPlayerId: player.id }));
    const mechanic = battle.postgameBossMechanic;
    mechanic.assigned = true;
    mechanic.coopPlayerWorlds = false;
    mechanic.realPlayerIds = [];
    mechanic.songPlayerIds = [];
    mechanic.realPlayerCursor = 0;
    mechanic.songPlayerCursor = 0;
    mechanic.coopSelectionWorld = "real";
    mechanic.coopWorldActions = { real: null, song: null };
    const qa = debug.postgameBossMechanicQa;
    qa.totNormalizePlayerWorlds(battle, mechanic);
    battle.playerId = mechanic.realPlayerIds[0];
    battle.activeCrewIndex = battle.coop.runtimes[battle.playerId].activeCrewIndex;
    return {
      playerIds: game.players.map((player) => String(player.id)),
      playerNames: game.players.map((player) => player.name),
      realPlayerIds: mechanic.realPlayerIds.slice(),
      songPlayerIds: mechanic.songPlayerIds.slice(),
      playerWorlds: qa.totUsesPlayerWorlds(battle, mechanic),
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, timeout: 15000 });
  const context = await browser.newContext({ viewport: { width: VIEWPORT_WIDTH, height: VIEWPORT_HEIGHT }, deviceScaleFactor: 1 });
  const errors = [];
  const failures = [];
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?tot_player_world_coop_qa=1`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 20000 });
  const setup = await preparePlayerWorldBattle(host);

  const stateRules = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const battle = runtime.battleState;
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    const realPlayer = qa.totActiveWorldPlayer(battle, mechanic, "real");
    const songPlayer = qa.totActiveWorldPlayer(battle, mechanic, "song");
    const realRuntime = battle.coop.runtimes[String(realPlayer.id)];
    const songRuntime = battle.coop.runtimes[String(songPlayer.id)];
    realRuntime.playerStages = { atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 };
    songRuntime.playerStages = { atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 };
    const realMove = realPlayer.crew[realRuntime.activeCrewIndex].moveSet[0];
    const songMove = songPlayer.crew[songRuntime.activeCrewIndex].moveSet[0];
    realMove.priority = -2;
    songMove.priority = 3;
    const priority = qa.totOrderPriority({
      type: "tot-dual",
      realAction: { type: "move", moveId: realMove.id },
      songAction: { type: "move", moveId: songMove.id },
    }, realPlayer, battle);
    const speed = qa.totOrderSpeed(realPlayer, battle);
    const firstWorldAccepted = debug.battleTotWorldAction("real", { type: "move", moveId: realMove.id });
    const firstWorldQueue = {
      accepted: firstWorldAccepted,
      selectionWorld: mechanic.coopSelectionWorld,
      realSelected: !!mechanic.coopWorldActions.real,
      songSelected: !!mechanic.coopWorldActions.song,
      commandPlayerId: String(battle.playerId),
    };
    mechanic.coopWorldActions = { real: null, song: null };
    mechanic.coopSelectionWorld = "real";
    battle.playerId = realPlayer.id;
    battle.playerAction = null;
    battle.enemyAction = null;
    const realView = debug.getBattleView({ coopViewPlayerId: realPlayer.id });
    const songView = debug.getBattleView({ coopViewPlayerId: songPlayer.id });
    return {
      priority,
      speed,
      realPlayerId: String(realPlayer.id),
      songPlayerId: String(songPlayer.id),
      realCrewCount: realView.battle.postgameBossMechanic.state.realCrew.length,
      songCrewCount: songView.battle.postgameBossMechanic.state.songCrew.length,
      realViewName: realView.battle.postgameBossMechanic.state.realPlayerName,
      songViewName: songView.battle.postgameBossMechanic.state.songPlayerName,
      selectionWorld: realView.battle.postgameBossMechanic.state.selectionWorld,
      firstWorldQueue,
    };
  });

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?tot_player_world_coop_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded", { timeout: 15000 });
  await battlePage.waitForSelector(".postgame-dual-world-grid", { timeout: 15000 });
  const layout = await battlePage.evaluate(() => {
    const columns = Array.from(document.querySelectorAll(".postgame-world-column"));
    const images = Array.from(document.querySelectorAll(".tot-musica-world-card img, .postgame-world-column img"));
    return {
      columns: columns.length,
      headings: columns.map((column) => column.querySelector(".postgame-world-heading")?.textContent.trim() || ""),
      commandCounts: columns.map((column) => column.querySelectorAll("[data-tot-world-mode]").length),
      waitingTexts: columns.map((column) => column.textContent.includes("等待所屬玩家")),
      brokenImages: images.filter((image) => !image.complete || image.naturalWidth <= 0).map((image) => image.currentSrc || image.src),
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
    };
  });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `player-worlds-${VIEWPORT_WIDTH}x${VIEWPORT_HEIGHT}.png`), fullPage: true });

  const handoff = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const battle = runtime.battleState;
    const mechanic = battle.postgameBossMechanic;
    const qa = debug.postgameBossMechanicQa;
    const firstReal = qa.totActiveWorldPlayer(battle, mechanic, "real");
    const firstRuntime = battle.coop.runtimes[String(firstReal.id)];
    const defeatedCardIndex = firstRuntime.activeCrewIndex;
    firstReal.crew[defeatedCardIndex].currentHp = 0;
    const replacement = qa.totResolvePlayerWorldFrontlines(battle, mechanic, { log: false });
    const replacementIndex = battle.coop.runtimes[String(firstReal.id)].activeCrewIndex;
    firstReal.crew.forEach((card) => { card.currentHp = 0; });
    const nextPlayer = qa.totResolvePlayerWorldFrontlines(battle, mechanic, { log: false });
    const nextRealId = String(nextPlayer.realPlayer?.id || "");
    nextPlayer.realPlayer.crew.forEach((card) => { card.currentHp = 0; });
    const wipe = qa.totResolvePlayerWorldFrontlines(battle, mechanic, { log: false });
    return {
      firstRealId: String(firstReal.id),
      defeatedCardIndex,
      replacementIndex,
      samePlayerReplacement: String(replacement.realPlayer?.id || "") === String(firstReal.id),
      nextRealId,
      lostWorld: wipe.lostWorld,
      result: battle.result,
      needsReplacement: battle.needsReplacement,
    };
  });

  if (!setup.playerWorlds || setup.realPlayerIds.length !== 2 || setup.songPlayerIds.length !== 1) failures.push(`world assignment: ${JSON.stringify(setup)}`);
  if (setup.realPlayerIds[0] !== setup.playerIds[0] || setup.songPlayerIds[0] !== setup.playerIds[1] || setup.realPlayerIds[1] !== setup.playerIds[2]) failures.push(`newcomer balance: ${JSON.stringify(setup)}`);
  if (stateRules.priority !== 3 || stateRules.speed < 360 || stateRules.realCrewCount !== 6 || stateRules.songCrewCount !== 6 || stateRules.selectionWorld !== "real"
    || !stateRules.firstWorldQueue.accepted || stateRules.firstWorldQueue.selectionWorld !== "song" || !stateRules.firstWorldQueue.realSelected
    || stateRules.firstWorldQueue.songSelected || stateRules.firstWorldQueue.commandPlayerId !== setup.playerIds[1]) failures.push(`initiative/view/queue state: ${JSON.stringify(stateRules)}`);
  if (layout.columns !== 2 || !layout.headings.some((text) => text.includes("現實船長")) || !layout.headings.some((text) => text.includes("歌世界船長")) || layout.commandCounts[0] !== 4 || layout.commandCounts[1] !== 0 || !layout.waitingTexts[1] || layout.brokenImages.length || layout.horizontalOverflow) failures.push(`dual world layout: ${JSON.stringify(layout)}`);
  if (!handoff.samePlayerReplacement || handoff.replacementIndex === handoff.defeatedCardIndex || handoff.nextRealId !== setup.playerIds[2] || handoff.lostWorld !== "real" || handoff.result !== "lose" || handoff.needsReplacement) failures.push(`replacement/handoff/wipe: ${JSON.stringify(handoff)}`);

  const report = { setup, stateRules, layout, handoff, errors, failures, outputDir: OUTPUT_DIR };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
