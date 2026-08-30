const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.join(process.cwd(), "tmp", "battle_parity_dice_relay_flag_qa");

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareBattle(host, { relayFlag = false, livingBench = true } = {}) {
  return host.evaluate(({ relayFlag, livingBench }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const cloneAtMaxLevel = (source) => debug.cloneCard({
      ...source,
      level: 99,
      totalExp: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
    });
    player.crew = window.BoardCards.cards.slice(0, 3).map(cloneAtMaxLevel);
    player.crew.forEach((card, index) => {
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
      card.battleCarryItem = relayFlag && index === 0 ? { id: "relay_pirate_flag" } : null;
      if (!livingBench && index > 0) card.currentHp = 0;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-new-items-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_king")
      || state.gameState.postgameWorld.islandAssignments[0];
    if (!assignment) throw new Error("Missing postgame Boss assignment");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.maxHp = Math.max(99999, Number(islandState.maxHp || 1));
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = state.battleState;
    player.crew.forEach((card) => {
      card.baseStats.hp = 999999;
      card.currentHp = 999999;
    });
    battle.enemyCombatant.atk = 1;
    battle.enemyCombatant.satk = 1;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.animating = false;
    battle.result = "";
    battle.needsReplacement = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    return { playerId: player.id, enemy: battle.enemyCombatant.name };
  }, { relayFlag, livingBench });
}

async function inspectLayout(page) {
  return page.evaluate(() => {
    const visibleRoot = document.querySelector('[aria-label="選擇奇偶骰目標"]')
      || document.querySelector(".battle-switch-ui")
      || document.querySelector("main")
      || document.body;
    return {
      bodyOverflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 3,
      overflowing: Array.from(visibleRoot.querySelectorAll("button, article, .battle-switch-card"))
        .filter((node) => node.offsetParent && (node.scrollWidth > node.clientWidth + 4 || node.scrollHeight > node.clientHeight + 4))
        .map((node) => (node.textContent || node.className || node.tagName).trim().slice(0, 120))
        .filter(Boolean)
        .slice(0, 12),
      brokenImages: Array.from(document.images)
        .filter((image) => image.offsetParent && image.getAttribute("src") && (!image.complete || image.naturalWidth <= 0))
        .map((image) => image.src)
        .slice(0, 12),
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  try {
    await host.goto(`${ROOT_URL}/board_game.html?battle_new_items_qa=1`, { waitUntil: "domcontentloaded" });
    await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.battleNewItemQa?.applyItem && window.GAME_ITEMS && window.BoardCards, null, { timeout: 20000 });

    const definitions = await host.evaluate(() => ["odd_dice", "even_dice", "relay_pirate_flag"].map((id) => {
      const item = window.GAME_ITEMS[id];
      return item ? {
        id,
        name: item.name,
        category: item.category,
        targetType: item.targetType,
        effect: item.effect,
        image: item.image,
        inShop: window.ITEM_SHOPS.item_shop.includes(id),
        eventPools: Object.entries(window.ITEM_EVENT_POOLS).filter(([, ids]) => ids.includes(id)).map(([pool]) => pool),
      } : null;
    }));
    if (definitions.some((entry) => !entry)) failures.push(`missing definitions ${JSON.stringify(definitions)}`);
    if (definitions[0]?.effect?.parity !== "odd" || definitions[0]?.effect?.turns !== 2 || definitions[0]?.targetType !== "battle_side") failures.push(`odd dice definition invalid ${JSON.stringify(definitions[0])}`);
    if (definitions[1]?.effect?.parity !== "even" || definitions[1]?.effect?.turns !== 2 || definitions[1]?.targetType !== "battle_side") failures.push(`even dice definition invalid ${JSON.stringify(definitions[1])}`);
    if (definitions[2]?.category !== "held" || definitions[2]?.effect?.kind !== "switch_out_after_action") failures.push(`relay flag definition invalid ${JSON.stringify(definitions[2])}`);
    if (definitions.some((entry) => !entry?.inShop)) failures.push(`new item missing from shop ${JSON.stringify(definitions)}`);

    for (const definition of definitions) {
      const response = await context.request.get(`${ROOT_URL}/${definition.image}`);
      if (!response.ok()) failures.push(`image HTTP ${response.status()} ${definition.image}`);
    }

    await prepareBattle(host);
    const mechanics = await host.evaluate(async () => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const qa = debug.battleNewItemQa;
      const state = debug.getState();
      const player = state.gameState.players[0];
      const battle = state.battleState;
      debug.grantGameItems(["odd_dice", "even_dice"], 4, 0);
      const itemCount = (id) => debug.getBattleView().player.battleItems.find((item) => item.id === id)?.count || 0;
      const beforeOdd = itemCount("odd_dice");
      qa.applyItem("player", { type: "item", itemId: "odd_dice", targetPlayerId: player.id, targetSide: "enemy", actorCrewIndex: 0 }, player, battle);
      const oddApplied = qa.parityEntry("enemy", battle, player);
      const oddRolls = [];
      await qa.rollDiceWithPassives("attack", "敵方測試", "第一骰", battle, 6, { side: "enemy", suppressVisual: true, onFirstDie: (roll) => oddRolls.push(roll) });
      const afterOddOne = qa.parityEntry("enemy", battle, player);
      await qa.rollDiceWithPassives("attack", "敵方測試", "第一骰", battle, 6, { side: "enemy", suppressVisual: true, onFirstDie: (roll) => oddRolls.push(roll) });
      const afterOddTwo = qa.parityEntry("enemy", battle, player);

      const beforeEven = itemCount("even_dice");
      qa.applyItem("player", { type: "item", itemId: "even_dice", targetPlayerId: player.id, targetSide: "player", actorCrewIndex: 0 }, player, battle);
      const evenApplied = qa.parityEntry("player", battle, player);
      const evenRolls = [];
      await qa.rollDiceWithPassives("attack", "我方測試", "第一骰", battle, 6, { side: "player", suppressVisual: true, onFirstDie: (roll) => evenRolls.push(roll) });
      await qa.rollDiceWithPassives("attack", "我方測試", "第一骰", battle, 6, { side: "player", suppressVisual: true, onFirstDie: (roll) => evenRolls.push(roll) });
      const afterEvenTwo = qa.parityEntry("player", battle, player);

      qa.applyItem("player", { type: "item", itemId: "odd_dice", targetPlayerId: player.id, targetSide: "enemy", actorCrewIndex: 0 }, player, battle);
      await qa.rollDiceWithPassives("attack", "敵方測試", "第一骰", battle, 6, { side: "enemy", suppressVisual: true });
      qa.applyItem("player", { type: "item", itemId: "even_dice", targetPlayerId: player.id, targetSide: "enemy", actorCrewIndex: 0 }, player, battle);
      const overwritten = qa.parityEntry("enemy", battle, player);
      const view = debug.getBattleView();
      return {
        beforeOdd,
        afterOddCount: itemCount("odd_dice"),
        oddApplied,
        oddRolls,
        afterOddOne,
        afterOddTwo,
        beforeEven,
        afterEvenCount: itemCount("even_dice"),
        evenApplied,
        evenRolls,
        afterEvenTwo,
        overwritten,
        enemyEffect: view.enemy.effectDetails.find((entry) => entry.id === "first-dice-parity-enemy") || null,
      };
    });
    if (mechanics.beforeOdd - mechanics.afterOddCount !== 2) failures.push(`odd dice inventory consumption invalid ${JSON.stringify(mechanics)}`);
    if (mechanics.beforeEven - mechanics.afterEvenCount !== 2) failures.push(`even dice inventory consumption invalid ${JSON.stringify(mechanics)}`);
    if (mechanics.oddApplied?.parity !== "odd" || mechanics.oddApplied?.turnsRemaining !== 2) failures.push(`odd effect did not start at two ${JSON.stringify(mechanics)}`);
    if (mechanics.oddRolls.some((roll) => roll % 2 !== 1) || mechanics.afterOddOne?.turnsRemaining !== 1 || mechanics.afterOddTwo !== null) failures.push(`odd first-die lifecycle invalid ${JSON.stringify(mechanics)}`);
    if (mechanics.evenApplied?.parity !== "even" || mechanics.evenApplied?.turnsRemaining !== 2 || mechanics.evenRolls.some((roll) => roll % 2 !== 0) || mechanics.afterEvenTwo !== null) failures.push(`even first-die lifecycle invalid ${JSON.stringify(mechanics)}`);
    if (mechanics.overwritten?.parity !== "even" || mechanics.overwritten?.turnsRemaining !== 2) failures.push(`same-side replacement/reset invalid ${JSON.stringify(mechanics.overwritten)}`);
    if (!mechanics.enemyEffect?.label?.includes("雙數骰") || mechanics.enemyEffect?.turns !== 2) failures.push(`effect status display invalid ${JSON.stringify(mechanics.enemyEffect)}`);

    await prepareBattle(host);
    await host.evaluate(() => window.__BOARD_GAME_DEBUG__.grantGameItems(["odd_dice", "even_dice"], 1, 0));
    const battlePagePromise = context.waitForEvent("page");
    await host.evaluate(() => window.open("board_battle.html?battle_new_items_qa=1", "_blank"));
    const battlePage = await battlePagePromise;
    captureErrors(battlePage, errors, "battle");
    await battlePage.waitForLoadState("domcontentloaded");
    await battlePage.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.refresh && document.querySelectorAll("[data-mode]").length === 4, null, { timeout: 20000 });
    const commandButtons = await battlePage.evaluate(() => Array.from(document.querySelectorAll(".action-button[data-mode]")).map((button) => ({ mode: button.dataset.mode, text: button.textContent.trim() })));
    if (commandButtons.length !== 4 || commandButtons.some((entry) => !["attack", "partners", "items", "escape"].includes(entry.mode))) failures.push(`main command layout changed ${JSON.stringify(commandButtons)}`);
    await battlePage.locator('[data-mode="items"]').click();
    await battlePage.locator('[data-item-id="odd_dice"]').click();
    await battlePage.waitForFunction(() => document.querySelectorAll("[data-item-target-side]").length === 2);
    const targetChoices = await battlePage.evaluate(() => Array.from(document.querySelectorAll("[data-item-target-side]")).map((button) => {
      const rect = button.getBoundingClientRect();
      return {
        side: button.dataset.itemTargetSide,
        text: button.textContent.trim(),
        visible: !!button.offsetParent && rect.width > 20 && rect.height > 20 && rect.bottom > 0 && rect.top < innerHeight,
        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
      };
    }));
    if (targetChoices.length !== 2 || targetChoices[0].side !== "player" || targetChoices[1].side !== "enemy" || targetChoices.some((entry) => !entry.visible)) failures.push(`side target choices invalid ${JSON.stringify(targetChoices)}`);
    const desktopLayout = await inspectLayout(battlePage);
    if (desktopLayout.bodyOverflowX || desktopLayout.brokenImages.length) failures.push(`desktop item UI invalid ${JSON.stringify(desktopLayout)}`);
    await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "desktop_parity_target.png"), fullPage: true });
    await battlePage.setViewportSize({ width: 932, height: 430 });
    await battlePage.waitForTimeout(250);
    const mobileLayout = await inspectLayout(battlePage);
    if (mobileLayout.bodyOverflowX || mobileLayout.brokenImages.length) failures.push(`mobile item UI invalid ${JSON.stringify(mobileLayout)}`);
    await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "mobile_parity_target.png"), fullPage: true });

    const totItemAction = await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const player = state.gameState.players[0];
      player.crew = window.BoardCards.cards.slice(0, 6).map((source) => debug.cloneCard({ ...source, level: 99, currentHp: Number.MAX_SAFE_INTEGER }));
      player.crew.forEach((card) => {
        card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
        card.battleCarryItem = null;
      });
      player.activeCrewIndex = 0;
      state.battleState = null;
      if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "battle-new-items-tot-qa" });
      debug.ensurePostgameWorldLayout(state.gameState);
      const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_tot_musica");
      const island = assignment ? debug.getIslandById(assignment.islandId) : null;
      const islandState = assignment ? debug.getIslandState(assignment.islandId) : null;
      if (!island || !islandState) throw new Error("Missing Tot Musica assignment");
      islandState.currentHp = islandState.maxHp;
      islandState.isDefeated = false;
      debug.startBattle(player, island, islandState);
      const battle = state.battleState;
      battle.entryTransition = null;
      battle.prebattleIntro = null;
      battle.prebattleIntroDone = true;
      battle.openingPassiveVisual = null;
      battle.openingPassiveVisualQueue = [];
      battle.animating = false;
      const assigned = debug.battleTotTeamSetup([0, 2, 4], [1, 3, 5]);
      const mechanic = battle.postgameBossMechanic;
      const originalRealIndex = mechanic.realActiveIndex;
      const expectedRelayIndex = mechanic.realIndices.find((index) => index !== originalRealIndex && Number(player.crew[index]?.currentHp || 0) > 0);
      player.crew[originalRealIndex].battleCarryItem = { id: "relay_pirate_flag" };
      battle.playerAction = {
        type: "tot-dual",
        realAction: { type: "move", moveId: player.crew[originalRealIndex].moveSet[0]?.id || "qa" },
        songAction: { type: "move", moveId: player.crew[mechanic.songActiveIndex].moveSet[0]?.id || "qa" },
      };
      battle.playerPerformedAction = true;
      const relayTriggered = debug.battleNewItemQa.triggerRelaySwitch(player, battle);
      const relayResult = {
        triggered: relayTriggered,
        expectedRealIndex: expectedRelayIndex,
        realActiveIndex: mechanic.realActiveIndex,
        songActiveIndex: mechanic.songActiveIndex,
        replacement: !!battle.needsReplacement,
      };
      player.crew[originalRealIndex].battleCarryItem = null;
      mechanic.realActiveIndex = originalRealIndex;
      battle.activeCrewIndex = originalRealIndex;
      player.activeCrewIndex = originalRealIndex;
      battle.playerAction = null;
      battle.playerPerformedAction = false;
      debug.grantGameItems("odd_dice", 1, 0);
      battle.animating = false;
      const songMove = player.crew[mechanic.songActiveIndex].moveSet.find((entry) => Number(entry.currentPP ?? entry.pp ?? 0) > 0);
      const accepted = debug.battleTotDualAction(
        { type: "item", itemId: "odd_dice", targetPlayerId: player.id, targetSide: "enemy" },
        { type: "move", moveId: songMove?.id || "" },
      );
      return {
        assigned,
        relayResult,
        accepted,
        action: battle.playerAction ? JSON.parse(JSON.stringify(battle.playerAction)) : null,
      };
    });
    if (!totItemAction.assigned || !totItemAction.accepted || totItemAction.action?.realAction?.targetSide !== "enemy" || totItemAction.action?.realAction?.targetIndex !== null) failures.push(`Tot Musica side-target item invalid ${JSON.stringify(totItemAction)}`);
    if (!totItemAction.relayResult?.triggered || totItemAction.relayResult.realActiveIndex !== totItemAction.relayResult.expectedRealIndex || totItemAction.relayResult.replacement) failures.push(`Tot Musica relay flag crossed or skipped world queue ${JSON.stringify(totItemAction.relayResult)}`);

    await prepareBattle(host, { relayFlag: true, livingBench: true });
    const relay = await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const qa = debug.battleNewItemQa;
      const state = debug.getState();
      const player = state.gameState.players[0];
      const battle = state.battleState;
      const hpBefore = player.crew[0].currentHp;
      battle.playerAction = { type: "move", moveId: "qa", actorCrewIndex: 0 };
      battle.playerPerformedAction = true;
      const triggered = qa.triggerRelaySwitch(player, battle);
      const pending = {
        triggered,
        result: battle.result,
        needsReplacement: battle.needsReplacement,
        replacementReason: battle.replacementReason,
        holderHp: player.crew[0].currentHp,
        hpBefore,
      };
      const replaced = debug.battleChooseReplacement(1);
      return {
        pending,
        replaced,
        activeCrewIndex: battle.activeCrewIndex,
        playerActiveCrewIndex: player.activeCrewIndex,
        holderHp: player.crew[0].currentHp,
        holderItemId: player.crew[0].battleCarryItem?.id || "",
        replacementReasonAfter: battle.replacementReason || "",
      };
    });
    if (!relay.pending.triggered || relay.pending.result !== "replacement" || !relay.pending.needsReplacement || relay.pending.replacementReason !== "relay-pirate-flag") failures.push(`relay flag did not request replacement ${JSON.stringify(relay)}`);
    if (!relay.replaced || relay.activeCrewIndex !== 1 || relay.playerActiveCrewIndex !== 1 || relay.holderHp !== relay.pending.hpBefore || relay.holderItemId !== "relay_pirate_flag" || relay.replacementReasonAfter) failures.push(`relay replacement result invalid ${JSON.stringify(relay)}`);

    const relayGuards = await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const qa = debug.battleNewItemQa;
      const state = debug.getState();
      const player = state.gameState.players[0];
      const battle = state.battleState;
      battle.animating = false;
      battle.result = "";
      battle.needsReplacement = false;
      player.crew[0].battleCarryItem = { id: "relay_pirate_flag" };
      player.crew[1].currentHp = 0;
      player.crew[2].currentHp = 0;
      battle.activeCrewIndex = 0;
      player.activeCrewIndex = 0;
      battle.playerAction = { type: "move", actorCrewIndex: 0 };
      battle.playerPerformedAction = true;
      const noBench = qa.triggerRelaySwitch(player, battle);
      player.crew[1].currentHp = Math.max(1, Number(player.crew[1].baseStats?.hp || 1));
      battle.activeCrewIndex = 1;
      player.activeCrewIndex = 1;
      const alreadySwitched = qa.triggerRelaySwitch(player, battle);
      battle.activeCrewIndex = 0;
      player.activeCrewIndex = 0;
      battle.playerAction = { type: "switch", nextIndex: 1, actorCrewIndex: 0 };
      const manualSwitch = qa.triggerRelaySwitch(player, battle);
      return { noBench, alreadySwitched, manualSwitch, result: battle.result || "", needsReplacement: !!battle.needsReplacement };
    });
    if (relayGuards.noBench || relayGuards.alreadySwitched || relayGuards.manualSwitch || relayGuards.result || relayGuards.needsReplacement) failures.push(`relay guard cases invalid ${JSON.stringify(relayGuards)}`);

    await prepareBattle(host, { relayFlag: true, livingBench: true });
    const relayQueued = await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const view = debug.getBattleView();
      const move = view.activeCard.moves.find((entry) => Number(entry.currentPP || 0) > 0);
      return { moveId: move?.id || "", queued: move ? debug.battleChooseMove(move.id) : false };
    });
    if (!relayQueued.queued) failures.push(`relay integration action could not queue ${JSON.stringify(relayQueued)}`);
    else {
      await host.waitForFunction(() => {
        const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
        return battle?.needsReplacement && battle?.replacementReason === "relay-pirate-flag";
      }, null, { timeout: 20000 });
    }
    const relayRoundEnd = await host.evaluate(() => {
      const state = window.__BOARD_GAME_DEBUG__.getState();
      const player = state.gameState.players[0];
      const battle = state.battleState;
      return {
        needsReplacement: !!battle.needsReplacement,
        reason: battle.replacementReason || "",
        playerPerformedAction: !!battle.playerPerformedAction,
        enemyPerformedAction: !!battle.enemyPerformedAction,
        actorCrewIndex: battle.playerAction?.actorCrewIndex,
        activeCrewIndex: battle.activeCrewIndex,
        holderHp: player.crew[0].currentHp,
      };
    });
    if (!relayRoundEnd.needsReplacement || relayRoundEnd.reason !== "relay-pirate-flag" || !relayRoundEnd.playerPerformedAction || !relayRoundEnd.enemyPerformedAction || relayRoundEnd.activeCrewIndex !== 0 || relayRoundEnd.holderHp <= 0) failures.push(`relay did not trigger after full round ${JSON.stringify(relayRoundEnd)}`);

    await prepareBattle(host, { relayFlag: true, livingBench: true });
    await host.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const state = debug.getState();
      const player = state.gameState.players[0];
      const battle = state.battleState;
      battle.playerAction = { type: "item", itemId: "odd_dice", actorCrewIndex: 0 };
      battle.playerPerformedAction = true;
      debug.battleNewItemQa.triggerRelaySwitch(player, battle);
      debug.notifyBattleWindow();
    });
    await battlePage.setViewportSize({ width: 1440, height: 900 });
    await battlePage.evaluate(() => window.__BOARD_BATTLE_DEBUG__.refresh());
    await battlePage.waitForFunction(() => document.body.textContent.includes("交棒海賊旗啟動") && document.querySelectorAll("[data-replacement-index]").length > 0, null, { timeout: 10000 });
    const relayLayout = await inspectLayout(battlePage);
    if (relayLayout.bodyOverflowX || relayLayout.brokenImages.length) failures.push(`relay replacement UI invalid ${JSON.stringify(relayLayout)}`);
    await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "desktop_relay_replacement.png"), fullPage: true });

    errors.forEach((error) => failures.push(error));
    const result = { outputDir: OUTPUT_DIR, definitions, mechanics, commandButtons, targetChoices, desktopLayout, mobileLayout, totItemAction, relay, relayGuards, relayQueued, relayRoundEnd, relayLayout, errors, failures };
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = failures.length ? 1 : 0;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
