const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411";

function captureErrors(page, errors, label) {
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

async function prepareThreePlayerCoop(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const cards = window.BoardCards.cards;
    const owner = game.players[0];
    owner.name = "船長雷利";
    owner.avatar = 1;
    owner.isCPU = false;
    owner.crew = cards.slice(0, 6).map((card) => debug.cloneCard(card));
    owner.activeCrewIndex = 0;
    owner.pendingBattle = null;
    owner.crew.forEach((card) => {
      card.currentHp = Math.max(1, Number(card.baseStats?.hp || card.hp || 500));
    });

    const names = ["航海士娜美", "劍士索隆"];
    while (game.players.length < 3) {
      const index = game.players.length;
      const player = JSON.parse(JSON.stringify(owner));
      player.id = `coop-view-qa-${index + 1}`;
      player.userId = 880000 + index;
      player.clientId = `coop-view-qa-client-${index + 1}`;
      player.name = names[index - 1];
      player.avatar = index + 1;
      player.isMe = false;
      player.isCPU = false;
      player.crew = cards.slice(index * 6, index * 6 + 6).map((card) => debug.cloneCard(card));
      player.activeCrewIndex = index;
      player.pendingBattle = null;
      player.crew.forEach((card) => {
        card.currentHp = Math.max(1, Number(card.baseStats?.hp || card.hp || 500));
      });
      game.players.push(player);
    }
    game.players.length = 3;
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.pendingMove = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    state.battleState = null;

    if (!game.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(owner, { id: "coop-view-switch-qa" });
    debug.ensurePostgameWorldLayout(game);
    const assignment = game.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_shiki")
      || game.postgameWorld.islandAssignments[0];
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(owner, island, islandState);

    const battle = state.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualAnimating = false;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.playerId = owner.id;
    battle.coop = {
      enabled: true,
      participantIds: game.players.map((player) => String(player.id)),
      actions: {},
      runtimes: {},
      defeated: {},
      roundStartedAt: Date.now(),
    };

    game.players.forEach((player) => debug.getBattleView({ coopViewPlayerId: player.id }));
    game.players.forEach((player, index) => {
      const runtime = battle.coop.runtimes[String(player.id)];
      runtime.activeCrewIndex = index;
      runtime.playerStages = { atk: index, def: 0, satk: 0, sdef: 0, spd: index, accuracy: 0, evasion: 0 };
      runtime.playerStatuses = index === 1
        ? { poison: 0, burn: 2, bleed: 0, freeze: 0, paralyze: 0, bind: 0 }
        : { poison: 0, burn: 0, bleed: 0, freeze: 0, paralyze: 0, bind: 0 };
      runtime.defeated = false;
      runtime.escaped = false;
      const card = player.crew[index];
      const maxHp = Number(card.baseStats?.hp || card.hp || 500);
      card.currentHp = Math.max(1, maxHp - index * 37);
      player.activeCrewIndex = index;
    });
    battle.playerId = owner.id;
    battle.activeCrewIndex = 0;
    const ownerView = debug.getBattleView();
    return {
      playerIds: game.players.map((player) => String(player.id)),
      playerNames: game.players.map((player) => player.name),
      activeNames: ownerView.battle.coopInfo.participants.map((entry) => entry.activeName),
      commandPlayerId: String(battle.playerId),
    };
  });
}

async function inspectSwitch(page) {
  return page.evaluate(() => {
    const switcher = document.getElementById("coopViewSwitch");
    const trigger = document.getElementById("coopViewTrigger");
    const menu = document.getElementById("coopViewMenu");
    const hud = document.querySelector("[data-layout-id='playerHud']");
    const triggerRect = trigger.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const hudRect = hud.getBoundingClientRect();
    const matchupRect = document.getElementById("attributeMatchupChip")?.getBoundingClientRect();
    const overlaps = (a, b) => !!a && !!b && Math.min(a.right, b.right) > Math.max(a.left, b.left) + 1 && Math.min(a.bottom, b.bottom) > Math.max(a.top, b.top) + 1;
    const hudMetaOverlap = Array.from(document.querySelectorAll("#playerHudMeta .pill"))
      .some((element) => overlaps(triggerRect, element.getBoundingClientRect()));
    const watchedText = Array.from(switcher.querySelectorAll(".coop-view-trigger-copy, .coop-view-person-name, .coop-view-person-state"));
    const images = Array.from(switcher.querySelectorAll("img"));
    return {
      hidden: switcher.hidden,
      open: switcher.classList.contains("open"),
      triggerName: document.getElementById("coopViewTriggerName").textContent.trim(),
      triggerMode: document.getElementById("coopViewTriggerMode").textContent.trim(),
      triggerCount: document.getElementById("coopViewTriggerCount").textContent.trim(),
      participantCount: document.querySelectorAll("[data-coop-view-player]").length,
      selectedId: document.querySelector("[data-coop-view-player].selected")?.dataset.coopViewPlayer || "",
      actorId: document.querySelector("[data-coop-view-player].active-actor")?.dataset.coopViewPlayer || "",
      states: Array.from(document.querySelectorAll("[data-coop-view-player]")).map((button) => ({
        id: button.dataset.coopViewPlayer,
        name: button.querySelector(".coop-view-person-name")?.textContent.trim() || "",
        state: button.querySelector(".coop-view-person-state")?.textContent.trim() || "",
      })),
      attachedToHudLowerEdge: triggerRect.top <= hudRect.bottom + 4 && triggerRect.bottom >= hudRect.bottom + 12,
      overlapsMatchupChip: overlaps(triggerRect, matchupRect),
      overlapsHudMeta: hudMetaOverlap,
      insideViewport: triggerRect.left >= -1 && triggerRect.right <= innerWidth + 1 && menuRect.left >= -1 && menuRect.right <= innerWidth + 1,
      textOverflow: watchedText.filter((element) => element.scrollWidth > element.clientWidth + 2 || element.scrollHeight > element.clientHeight + 2).map((element) => element.textContent.trim()),
      brokenImages: images.filter((image) => !image.complete || image.naturalWidth <= 0).map((image) => image.currentSrc || image.src),
    };
  });
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errors = [];
  const failures = [];
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?coop_view_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 15000 });
  const setup = await prepareThreePlayerCoop(host);

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?coop_view_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");
  await battlePage.waitForSelector("#coopViewSwitch:not([hidden])", { timeout: 15000 });

  await battlePage.locator("#coopViewTrigger").click();
  await battlePage.waitForSelector("#coopViewMenu:not([hidden])", { timeout: 5000 });
  await battlePage.waitForFunction(() => Array.from(document.querySelectorAll("#coopViewSwitch img")).every((image) => image.complete && image.naturalWidth > 0), null, { timeout: 10000 });
  const desktopInitial = await inspectSwitch(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "coop_view_switch_desktop.png"), fullPage: true });

  await battlePage.locator(`[data-coop-view-player="${setup.playerIds[1]}"]`).click();
  await battlePage.waitForFunction((expected) => (
    document.getElementById("coopViewTriggerName")?.textContent.trim() === expected
    && document.getElementById("coopViewTriggerMode")?.textContent.trim() === "觀看中"
  ), setup.playerNames[1], { timeout: 5000 });
  const teammateView = await battlePage.evaluate(() => {
    const view = window.__BOARD_BATTLE_DEBUG__.latestView();
    return {
      playerId: String(view.player.id),
      activeName: view.activeCard.name,
      canControl: view.battle.canControl,
      lockedReason: view.battle.viewerLockedReason,
      commandPlayerId: String(view.battle.coopView.currentPlayerId),
      selectedId: window.__BOARD_BATTLE_DEBUG__.selectedCoopViewPlayerId(),
      actionPanelHidden: document.querySelector("[data-layout-id='actionPanel']")?.classList.contains("is-hidden"),
      hudName: document.getElementById("playerHudName")?.textContent.trim() || "",
    };
  });
  const hostInvariant = await host.evaluate((expectedCommandPlayerId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const viewed = debug.getBattleView({ coopViewPlayerId: state.gameState.players[1].id });
    return {
      playerIdAfterRead: String(state.battleState.playerId),
      expectedCommandPlayerId,
      viewedPlayerId: String(viewed.player.id),
      viewCanControl: viewed.battle.canControl,
      viewCommandPlayerId: String(viewed.battle.coopView.currentPlayerId),
    };
  }, setup.commandPlayerId);

  await host.evaluate((nextPlayerId) => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    state.battleState.playerId = nextPlayerId;
  }, setup.playerIds[2]);
  await battlePage.evaluate(() => window.dispatchEvent(new Event("focus")));
  await battlePage.waitForFunction((expected) => (
    document.getElementById("coopViewTriggerName")?.textContent.trim() === expected.name
    && window.__BOARD_BATTLE_DEBUG__.selectedCoopViewPlayerId() === expected.id
  ), { id: setup.playerIds[2], name: setup.playerNames[2] }, { timeout: 5000 });
  const followedHandoff = await battlePage.evaluate(() => {
    const view = window.__BOARD_BATTLE_DEBUG__.latestView();
    return {
      playerId: String(view.player.id),
      commandPlayerId: String(view.battle.coopView.currentPlayerId),
      selectedId: window.__BOARD_BATTLE_DEBUG__.selectedCoopViewPlayerId(),
      menuOpen: window.__BOARD_BATTLE_DEBUG__.coopViewMenuOpen(),
      hudName: document.getElementById("playerHudName")?.textContent.trim() || "",
    };
  });

  await host.evaluate((nextPlayerId) => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    state.battleState.playerId = nextPlayerId;
  }, setup.playerIds[0]);
  await battlePage.evaluate(() => window.dispatchEvent(new Event("focus")));
  await battlePage.waitForFunction((expected) => (
    document.getElementById("coopViewTriggerName")?.textContent.trim() === expected.name
    && window.__BOARD_BATTLE_DEBUG__.selectedCoopViewPlayerId() === expected.id
  ), { id: setup.playerIds[0], name: setup.playerNames[0] }, { timeout: 5000 });
  const returnedToActor = await battlePage.evaluate(() => {
    const view = window.__BOARD_BATTLE_DEBUG__.latestView();
    return {
      playerId: String(view.player.id),
      canControl: view.battle.canControl,
      selectedId: window.__BOARD_BATTLE_DEBUG__.selectedCoopViewPlayerId(),
      actionPanelHidden: document.querySelector("[data-layout-id='actionPanel']")?.classList.contains("is-hidden"),
    };
  });

  await battlePage.locator("#coopViewTrigger").click();
  await battlePage.waitForSelector("#coopViewMenu:not([hidden])", { timeout: 5000 });
  await battlePage.locator(`[data-coop-view-player="${setup.playerIds[1]}"]`).click();
  await battlePage.locator("#coopViewTrigger").click();
  await battlePage.waitForSelector("#coopViewMenu:not([hidden])", { timeout: 5000 });
  await battlePage.setViewportSize({ width: 900, height: 600 });
  await battlePage.waitForTimeout(180);
  const narrow = await inspectSwitch(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "coop_view_switch_narrow.png"), fullPage: true });

  await host.evaluate(() => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    const spectator = JSON.parse(JSON.stringify(state.gameState.players[0]));
    spectator.id = "coop-view-qa-spectator";
    spectator.userId = 889999;
    spectator.clientId = "coop-view-qa-spectator-client";
    spectator.name = "未參戰觀看者";
    spectator.isMe = false;
    spectator.isCPU = false;
    state.gameState.players.push(spectator);
    state.gameState.currentPlayerIndex = state.gameState.players.length - 1;
  });
  await battlePage.evaluate(() => window.dispatchEvent(new Event("focus")));
  await battlePage.waitForFunction(() => document.getElementById("coopViewSwitch")?.hidden === true, null, { timeout: 5000 });
  const spectatorHidden = await battlePage.evaluate(() => document.getElementById("coopViewSwitch")?.hidden === true);
  await host.evaluate(() => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    state.gameState.currentPlayerIndex = 0;
    state.gameState.players = state.gameState.players.filter((player) => player.id !== "coop-view-qa-spectator");
  });

  if (desktopInitial.hidden || !desktopInitial.open || desktopInitial.participantCount !== 3) failures.push(`desktop switch incomplete: ${JSON.stringify(desktopInitial)}`);
  if (!desktopInitial.attachedToHudLowerEdge) failures.push("switch is not attached to the lower edge of the player HUD");
  if (desktopInitial.overlapsMatchupChip || desktopInitial.overlapsHudMeta) failures.push(`desktop switch overlaps HUD content: ${JSON.stringify(desktopInitial)}`);
  if (!desktopInitial.insideViewport || desktopInitial.textOverflow.length || desktopInitial.brokenImages.length) failures.push(`desktop layout/image issue: ${JSON.stringify(desktopInitial)}`);
  if (desktopInitial.actorId !== setup.commandPlayerId) failures.push(`current actor highlight mismatch: ${desktopInitial.actorId}`);
  if (teammateView.playerId !== setup.playerIds[1] || teammateView.activeName !== setup.activeNames[1]) failures.push(`teammate state mismatch: ${JSON.stringify(teammateView)}`);
  if (teammateView.canControl || !teammateView.actionPanelHidden || !teammateView.lockedReason.includes("觀看中")) failures.push(`teammate view was not read-only: ${JSON.stringify(teammateView)}`);
  if (hostInvariant.playerIdAfterRead !== setup.commandPlayerId || hostInvariant.viewCommandPlayerId !== setup.commandPlayerId || hostInvariant.viewCanControl) failures.push(`read-only view mutated authority: ${JSON.stringify(hostInvariant)}`);
  if (followedHandoff.playerId !== setup.playerIds[2] || followedHandoff.commandPlayerId !== setup.playerIds[2] || followedHandoff.selectedId !== setup.playerIds[2] || followedHandoff.menuOpen || followedHandoff.hudName !== setup.activeNames[2]) failures.push(`handoff did not auto-follow current actor: ${JSON.stringify(followedHandoff)}`);
  if (returnedToActor.playerId !== setup.playerIds[0] || !returnedToActor.canControl || returnedToActor.actionPanelHidden) failures.push(`return to current actor failed: ${JSON.stringify(returnedToActor)}`);
  if (!narrow.insideViewport || narrow.overlapsMatchupChip || narrow.overlapsHudMeta || narrow.textOverflow.length || narrow.brokenImages.length) failures.push(`narrow layout/image issue: ${JSON.stringify(narrow)}`);
  if (!spectatorHidden) failures.push("coop view switch was visible to a non-participant spectator");

  const report = { setup, desktopInitial, teammateView, hostInvariant, followedHandoff, returnedToActor, narrow, spectatorHidden, errors, failures };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
