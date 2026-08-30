const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("_codex_artifacts/impel-down-team-invite-coop-qa");

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

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, timeout: 15000 });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  const errors = [];
  const failures = [];
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?impel_team_invite_coop_qa=1`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__ && window.BoardCards, null, { timeout: 20000 });

  const rules = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const game = runtime.gameState;
    const cards = window.BoardCards.cards;
    const source = game.players[0];
    const impelIsland = (game.boardData?.islands || []).find((entry) => entry.kind === "impel_down" || entry.name === "推進城");
    if (!impelIsland) throw new Error("QA 找不到正式推進城島嶼");
    const makePlayer = (id, userId, name, offset) => {
      const player = JSON.parse(JSON.stringify(source));
      player.id = id;
      player.userId = userId;
      player.clientId = `${id}-client`;
      player.name = name;
      player.isCPU = false;
      player.isMe = id === "impel-a";
      player.location = { kind: "island", islandId: impelIsland.id, entryDirection: null };
      player.pendingBattle = null;
      player.crew = cards.slice(offset, offset + 6).map((card) => debug.cloneCard(card));
      player.activeCrewIndex = 0;
      player.crew.forEach((card) => {
        const maxHp = Math.max(1, Number(card.baseStats?.hp || card.hp || 100));
        card.currentHp = maxHp;
        (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(0, Number(move.pp || 0)); });
      });
      player.impelDown = {
        active: true,
        level: 4,
        status: "free",
        escapeBonus: 0,
        teamId: "",
        teamInvite: null,
      };
      return player;
    };
    const a = makePlayer("impel-a", 994001, "草帽船長", 0);
    const between = makePlayer("impel-between", 994002, "中間順位船長", 6);
    const c = makePlayer("impel-c", 994003, "紅心船長", 12);
    game.players = [a, between, c];
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.pendingMove = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    runtime.battleState = null;

    const qa = debug.impelDownTeamQa;
    const before = debug.getImpelDownView(a);
    const invite = qa.createInvite(a.id, c.id);
    const pending = debug.getImpelDownView(c).team.pendingInvite;
    const accepted = qa.acceptInvite(c.id);
    const after = debug.getImpelDownView(a);
    const fullPool = qa.eventPool(a.id);
    c.crew[0].currentHp = Math.max(1, c.crew[0].currentHp - 1);
    const injuredPool = qa.eventPool(a.id);
    c.crew[0].currentHp = Number(c.crew[0].baseStats?.hp || c.crew[0].hp || c.crew[0].currentHp);

    a.impelDown.status = "free";
    c.impelDown.status = "free";
    const hiddenTargets = qa.applyEvent(a.id, "hidden");
    const hiddenStates = { a: a.impelDown.status, c: c.impelDown.status };
    a.impelDown.status = "free";
    a.impelDown.eventId = "";
    c.impelDown.status = "free";
    c.impelDown.eventId = "";
    const keyTargets = qa.applyEvent(a.id, "key");
    a.impelDown.status = "free";
    a.impelDown.eventId = "";
    c.impelDown.status = "free";
    c.impelDown.eventId = "";
    debug.renderAll();
    debug.openImpelDownWindow(a);
    return {
      ids: [a.id, between.id, c.id],
      beforeGroupCount: before.groupCount,
      beforeCandidates: before.team.candidates.map((entry) => entry.id),
      invite,
      pending,
      accepted,
      afterGroupIds: qa.group(a.id),
      afterGroupCount: after.groupCount,
      fullPool,
      injuredPool,
      hiddenTargets,
      hiddenStates,
      keyTargets,
    };
  });

  const impelFrame = host.frameLocator("#impelDownPageFrame");
  await impelFrame.locator("#teamBtn").waitFor({ state: "visible", timeout: 10000 });
  await host.waitForFunction(() => (
    document.getElementById("impelDownPageFrame")?.contentWindow?.document?.getElementById("groupCount")?.textContent === "2人"
  ), null, { timeout: 10000 });
  await impelFrame.locator("#teamBtn").click();
  await impelFrame.locator("#teamModal").waitFor({ state: "visible", timeout: 5000 });
  const desktopUi = await impelFrame.locator("body").evaluate(() => ({
    text: document.getElementById("teamModal")?.textContent || "",
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
    groupLabel: document.getElementById("groupCount")?.textContent || "",
    teamModalVisible: !document.getElementById("teamModal")?.hidden,
  }));
  await impelFrame.locator("body").screenshot({ path: path.join(OUTPUT_DIR, "team-modal-desktop.png") });

  await host.setViewportSize({ width: 760, height: 900 });
  await host.waitForTimeout(250);
  const mobileUi = await impelFrame.locator("body").evaluate(() => ({
    horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
    teamModalVisible: !document.getElementById("teamModal")?.hidden,
  }));
  await impelFrame.locator("body").screenshot({ path: path.join(OUTPUT_DIR, "team-modal-tablet.png") });

  const battleRules = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const game = runtime.gameState;
    const [a, between, c] = game.players;
    game.currentPlayerIndex = 0;
    game.resolutionLock = false;
    runtime.battleState = null;
    a.impelDown.status = "event";
    a.impelDown.eventId = "patrol";
    c.impelDown.status = "event";
    c.impelDown.eventId = "patrol";
    debug.startImpelDownBattle(a, { forceNew: true, eventId: "patrol" });
    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualAnimating = false;
    battle.animating = false;
    const participantIds = battle.coop?.participantIds?.slice() || [];
    const markedA = debug.impelDownTeamQa.markActed(a.id, battle);
    const nextAfterA = debug.impelDownTeamQa.nextParticipant(a.id, battle);
    const markedC = debug.impelDownTeamQa.markActed(c.id, battle);
    const nextAfterC = debug.impelDownTeamQa.nextParticipant(c.id, battle);
    const rescueWait = debug.impelDownTeamQa.beginRescueWait(a.id, battle);

    runtime.battleState = null;
    game.currentPlayerIndex = 1;
    game.resolutionLock = false;
    between.impelDown.teamId = "";
    between.impelDown.status = "free";
    debug.startImpelDownBattle(between, { forceNew: true, prisonerPlayerId: a.id, eventId: "rescue" });
    const rescueBattle = runtime.battleState;
    return {
      teamBattle: Boolean(battle.impelDown?.teamBattle),
      participantIds,
      markedA,
      nextAfterA,
      markedC,
      nextAfterC,
      rescueWait,
      rescueIsCoop: Boolean(rescueBattle?.coop?.enabled),
      rescueFlag: Boolean(rescueBattle?.impelDown?.rescue),
    };
  });

  const commandRules = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const game = runtime.gameState;
    const [a, between, c] = game.players;
    runtime.battleState = null;
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.pendingMove = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    game.players.forEach((player) => {
      player.pendingBattle = null;
      player.impelDown.active = true;
      player.impelDown.level = 4;
      player.impelDown.status = "free";
      player.impelDown.teamId = "";
      player.impelDown.teamInvite = null;
    });
    const actionInvite = debug.impelInvitePlayer({ playerId: c.id });
    const currentAfterActionInvite = game.players[game.currentPlayerIndex]?.id || "";
    game.currentPlayerIndex = 2;
    game.resolutionLock = false;
    runtime.battleState = null;
    const actionAccept = debug.impelAcceptTeamInvite();
    const currentAfterActionAccept = game.players[game.currentPlayerIndex]?.id || "";
    return {
      ids: [a.id, between.id, c.id],
      actionInvite,
      actionAccept,
      currentAfterActionInvite,
      currentAfterActionAccept,
    };
  });

  if (rules.beforeGroupCount !== 1 || rules.beforeCandidates.length !== 2) failures.push(`unteamed-floor-auto-grouped:${JSON.stringify(rules)}`);
  if (!commandRules.actionInvite?.ok || commandRules.currentAfterActionInvite !== commandRules.ids[1]) failures.push(`invite-action-did-not-end-turn:${JSON.stringify(commandRules)}`);
  if (!commandRules.actionAccept?.ok || commandRules.currentAfterActionAccept !== commandRules.ids[2]) failures.push(`accept-action-consumed-turn:${JSON.stringify(commandRules)}`);
  if (!rules.invite?.ok || rules.pending?.fromPlayerId !== rules.ids[0] || !rules.accepted?.ok) failures.push(`invite-accept-failed:${JSON.stringify(rules)}`);
  if (rules.afterGroupCount !== 2 || rules.afterGroupIds.join(",") !== [rules.ids[0], rules.ids[2]].join(",")) failures.push(`accepted-team-members-wrong:${JSON.stringify(rules)}`);
  if (rules.fullPool.includes("ivankov") || !rules.injuredPool.includes("ivankov")) failures.push(`ivankov-pool-filter-wrong:${JSON.stringify(rules)}`);
  if (rules.hiddenTargets.join(",") !== rules.ids[0] || rules.hiddenStates.a !== "event" || rules.hiddenStates.c !== "free") failures.push(`hidden-event-not-individual:${JSON.stringify(rules)}`);
  if (rules.keyTargets.join(",") !== [rules.ids[0], rules.ids[2]].join(",")) failures.push(`shared-event-targets-wrong:${JSON.stringify(rules)}`);
  if (!desktopUi.teamModalVisible || !desktopUi.text.includes("草帽船長") || !desktopUi.text.includes("紅心船長") || desktopUi.groupLabel !== "2人") failures.push(`desktop-team-ui-wrong:${JSON.stringify(desktopUi)}`);
  if (desktopUi.horizontalOverflow || mobileUi.horizontalOverflow || !mobileUi.teamModalVisible) failures.push(`team-ui-overflow:${JSON.stringify({ desktopUi, mobileUi })}`);
  if (!battleRules.teamBattle || battleRules.participantIds.join(",") !== [rules.ids[0], rules.ids[2]].join(",")) failures.push(`impel-team-coop-not-created:${JSON.stringify(battleRules)}`);
  if (battleRules.nextAfterA !== rules.ids[2] || battleRules.nextAfterC !== "") failures.push(`non-adjacent-handoff-wrong:${JSON.stringify(battleRules)}`);
  if (!battleRules.rescueWait.ok || !battleRules.rescueWait.awaitingRescue || battleRules.rescueWait.turnsRemaining !== 2) failures.push(`rescue-wait-not-two-turns:${JSON.stringify(battleRules)}`);
  if (battleRules.rescueIsCoop || !battleRules.rescueFlag) failures.push(`outside-rescue-should-remain-solo:${JSON.stringify(battleRules)}`);

  const report = { rules, commandRules, desktopUi, mobileUi, battleRules, errors, failures, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
