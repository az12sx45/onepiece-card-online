const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8842";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.join(process.cwd(), "tmp", "king_hidden_parity_qa");

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareKing(host) {
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const cloneAtMaxLevel = (source) => debug.cloneCard({
      ...source,
      level: 99,
      totalExp: Number.MAX_SAFE_INTEGER,
      currentHp: Number.MAX_SAFE_INTEGER,
    });
    player.crew = window.BoardCards.cards.slice(0, 6).map(cloneAtMaxLevel);
    player.crew.forEach((card) => {
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
      card.battleCarryItem = null;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "king-hidden-parity-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_king");
    if (!assignment) throw new Error("Missing KING assignment");
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
    battle.openingPassiveVisualQueue = [];
    battle.animating = false;
  });
}

async function inspectPanel(page) {
  await page.waitForFunction(() => document.querySelector(".boss-mechanic-status-icon img")?.naturalWidth > 0, null, { timeout: 15000 });
  await page.locator(".boss-mechanic-status-icon").click();
  await page.waitForFunction(() => document.getElementById("postgameBossMechanicPanel")?.hidden === false, null, { timeout: 10000 });
  return page.evaluate(() => {
    const panel = document.getElementById("postgameBossMechanicPanel");
    const text = panel?.textContent || "";
    return {
      text,
      forbiddenDisclosure: /奇數|偶數|第一顆骰|10%|35%|丹弓皇/.test(text),
      flameOn: text.includes("背火點燃") && text.includes("火焰覆體・傷害大幅削弱"),
      flameOff: text.includes("背火熄滅") && text.includes("現在是輸出窗口"),
      overflow: Array.from(panel?.querySelectorAll("*") || [])
        .filter((node) => node.scrollWidth > node.clientWidth + 3 || node.scrollHeight > node.clientHeight + 3)
        .map((node) => node.textContent.trim()).filter(Boolean).slice(0, 10),
      brokenImages: Array.from(panel?.querySelectorAll("img") || [])
        .filter((image) => !image.complete || image.naturalWidth <= 0)
        .map((image) => image.src),
    };
  });
}

async function closeMechanicPanel(page) {
  const panel = page.locator("#postgameBossMechanicPanel");
  if (await panel.isVisible()) await page.locator("#postgameBossMechanicClose").click();
}

async function inspectKingVisual(page) {
  return page.evaluate(() => {
    const card = document.getElementById("enemyCard");
    const plate = document.getElementById("kingFlameStatePlate");
    const aura = document.getElementById("kingFlameStateAura");
    const hudPill = document.querySelector(".king-flame-hud-pill");
    const icon = document.querySelector(".boss-mechanic-status-icon");
    const transition = document.getElementById("kingFlameTransition");
    const cardRect = card?.getBoundingClientRect();
    const plateRect = plate?.getBoundingClientRect();
    const visibleText = [plate?.textContent, hudPill?.textContent, transition?.textContent].filter(Boolean).join("｜");
    return {
      cardClass: card?.className || "",
      plateClass: plate?.className || "",
      plateText: plate?.textContent?.trim() || "",
      hudText: hudPill?.textContent?.trim() || "",
      iconBadge: icon?.querySelector(".status-icon-turns")?.textContent?.trim() || "",
      transitionClass: transition?.className || "",
      transitionText: transition?.textContent?.trim() || "",
      auraDisplay: aura ? getComputedStyle(aura).display : "missing",
      plateVisible: !!plate && !plate.hidden && getComputedStyle(plate).display !== "none",
      plateWithinCard: !!cardRect && !!plateRect
        && plateRect.left >= cardRect.left - 2
        && plateRect.right <= cardRect.right + 2
        && plateRect.top >= cardRect.top - 2
        && plateRect.bottom <= cardRect.bottom + 2,
      overflow: !!plate && (plate.scrollWidth > plate.clientWidth + 3 || plate.scrollHeight > plate.clientHeight + 3),
      forbiddenDisclosure: /奇數|偶數|第一顆骰|10%|35%|丹弓皇/.test(visibleText),
    };
  });
}

async function runViewport(browser, viewport, label) {
  const errors = [];
  const failures = [];
  const context = await browser.newContext({ viewport });
  const host = await context.newPage();
  captureErrors(host, errors, `${label}:host`);
  await host.goto(`${ROOT_URL}/board_game.html?king_hidden_parity_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postgameBossMechanicQa?.afterMove && window.BoardCards, null, { timeout: 20000 });
  await prepareKing(host);

  const mechanics = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const qa = debug.postgameBossMechanicQa;
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const mechanic = battle.postgameBossMechanic;
    const playerMove = player.crew[0].moveSet.find((entry) => ["attack", "special"].includes(entry.category || entry.type) && Number(entry.power || 0) > 0);
    const kingMove = battle.enemyCombatant.moveSet[0];
    const damage = () => {
      const visualMeta = {};
      const amount = qa.applyDamageRules([1000], "player", playerMove, 4, player, battle, { targetId: "boss" }, visualMeta).reduce((sum, value) => sum + Number(value || 0), 0);
      return { amount, guarded: !!visualMeta.kingFlameGuarded, guardLabel: String(visualMeta.kingFlameGuardLabel || "") };
    };

    const initial = { flameOn: mechanic.flameOn, damage: damage() };
    qa.afterMove("enemy", kingMove, 9, true, 0, player, battle, 2);
    const evenQueued = { current: mechanic.flameOn, pending: mechanic.pendingFlameOn, firstDie: mechanic.lastFirstDice };
    battle.roundIndex += 1;
    qa.roundStart(player, battle);
    const evenApplied = { flameOn: mechanic.flameOn, damage: damage() };

    qa.afterMove("enemy", kingMove, 8, true, 0, player, battle, 3);
    const oddQueued = { current: mechanic.flameOn, pending: mechanic.pendingFlameOn, firstDie: mechanic.lastFirstDice };
    battle.roundIndex += 1;
    qa.roundStart(player, battle);
    const oddApplied = { flameOn: mechanic.flameOn, damage: damage() };
    return { initial, evenQueued, evenApplied, oddQueued, oddApplied };
  });

  if (!mechanics.initial.flameOn || mechanics.initial.damage.amount !== 100 || !mechanics.initial.damage.guarded || mechanics.initial.damage.guardLabel !== "火焰防護") failures.push(`${label}: opening flame/damage invalid ${JSON.stringify(mechanics.initial)}`);
  if (!mechanics.evenQueued.current || mechanics.evenQueued.pending !== false || mechanics.evenQueued.firstDie !== 2) failures.push(`${label}: even first die was not delayed ${JSON.stringify(mechanics.evenQueued)}`);
  if (mechanics.evenApplied.flameOn || mechanics.evenApplied.damage.amount !== 1000 || mechanics.evenApplied.damage.guarded) failures.push(`${label}: even first die did not extinguish next round ${JSON.stringify(mechanics.evenApplied)}`);
  if (mechanics.oddQueued.current || mechanics.oddQueued.pending !== true || mechanics.oddQueued.firstDie !== 3) failures.push(`${label}: odd first die was not delayed ${JSON.stringify(mechanics.oddQueued)}`);
  if (!mechanics.oddApplied.flameOn || mechanics.oddApplied.damage.amount !== 100 || !mechanics.oddApplied.damage.guarded) failures.push(`${label}: odd first die did not ignite next round ${JSON.stringify(mechanics.oddApplied)}`);

  const battlePagePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?king_hidden_parity_qa=1", "_blank"));
  const battlePage = await battlePagePromise;
  captureErrors(battlePage, errors, `${label}:battle`);
  await battlePage.waitForLoadState("domcontentloaded");
  const flameOnUi = await inspectPanel(battlePage);
  if (!flameOnUi.flameOn || flameOnUi.forbiddenDisclosure || flameOnUi.overflow.length || flameOnUi.brokenImages.length) failures.push(`${label}: flame-on UI invalid ${JSON.stringify(flameOnUi)}`);
  await closeMechanicPanel(battlePage);
  const flameOnVisual = await inspectKingVisual(battlePage);
  if (!flameOnVisual.cardClass.includes("king-flame-on") || !flameOnVisual.plateClass.includes("is-lit") || !flameOnVisual.plateText.includes("背火點燃") || !flameOnVisual.hudText.includes("火焰防護") || flameOnVisual.iconBadge !== "燃" || !flameOnVisual.plateVisible || !flameOnVisual.plateWithinCard || flameOnVisual.overflow || flameOnVisual.forbiddenDisclosure || flameOnVisual.auraDisplay === "none") failures.push(`${label}: flame-on visual invalid ${JSON.stringify(flameOnVisual)}`);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `${label}_king_flame_on.png`), fullPage: true });

  await host.evaluate(() => {
    const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
    battle.postgameBossMechanic.flameOn = false;
    battle.postgameBossMechanic.pendingFlameOn = null;
  });
  await battlePage.evaluate(() => window.__BOARD_BATTLE_DEBUG__.refresh());
  await battlePage.waitForFunction(() => document.getElementById("enemyCard")?.classList.contains("king-flame-off") && document.getElementById("kingFlameTransition")?.classList.contains("is-active"));
  const flameOffTransition = await inspectKingVisual(battlePage);
  if (!flameOffTransition.transitionClass.includes("is-unlit") || !flameOffTransition.transitionText.includes("背火熄滅") || !flameOffTransition.transitionText.includes("輸出窗口")) failures.push(`${label}: flame-off transition invalid ${JSON.stringify(flameOffTransition)}`);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `${label}_king_flame_off_transition.png`), fullPage: true });
  await battlePage.waitForTimeout(1380);
  const flameOffVisual = await inspectKingVisual(battlePage);
  if (!flameOffVisual.cardClass.includes("king-flame-off") || !flameOffVisual.plateClass.includes("is-unlit") || !flameOffVisual.plateText.includes("背火熄滅") || !flameOffVisual.hudText.includes("輸出窗口") || flameOffVisual.iconBadge !== "熄" || !flameOffVisual.plateVisible || !flameOffVisual.plateWithinCard || flameOffVisual.overflow || flameOffVisual.forbiddenDisclosure || flameOffVisual.auraDisplay === "none") failures.push(`${label}: flame-off visual invalid ${JSON.stringify(flameOffVisual)}`);
  const flameOffUi = await inspectPanel(battlePage);
  if (!flameOffUi.flameOff || flameOffUi.forbiddenDisclosure || flameOffUi.overflow.length || flameOffUi.brokenImages.length) failures.push(`${label}: flame-off UI invalid ${JSON.stringify(flameOffUi)}`);
  await closeMechanicPanel(battlePage);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `${label}_king_flame_off.png`), fullPage: true });

  await host.evaluate(() => {
    const battle = window.__BOARD_GAME_DEBUG__.getState().battleState;
    battle.postgameBossMechanic.flameOn = true;
    battle.postgameBossMechanic.pendingFlameOn = null;
  });
  await battlePage.evaluate(() => window.__BOARD_BATTLE_DEBUG__.refresh());
  await battlePage.waitForFunction(() => document.getElementById("kingFlameTransition")?.classList.contains("is-active") && document.getElementById("kingFlameTransition")?.classList.contains("is-lit"));
  const flameOnTransition = await inspectKingVisual(battlePage);
  if (!flameOnTransition.transitionText.includes("背火燃起") || !flameOnTransition.transitionText.includes("火焰防護展開")) failures.push(`${label}: flame-on transition invalid ${JSON.stringify(flameOnTransition)}`);
  await battlePage.waitForTimeout(1380);
  await battlePage.evaluate(() => window.__BOARD_BATTLE_DEBUG__.playKingFlameGuardFx({ playSound: false }));
  await battlePage.waitForFunction(() => document.getElementById("kingFlameGuardFx")?.classList.contains("is-active"));
  const guardVisual = await battlePage.evaluate(() => ({
    className: document.getElementById("kingFlameGuardFx")?.className || "",
    text: document.getElementById("kingFlameGuardFx")?.textContent?.trim() || "",
  }));
  if (!guardVisual.className.includes("is-active") || guardVisual.text !== "火焰防護") failures.push(`${label}: guard visual invalid ${JSON.stringify(guardVisual)}`);
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, `${label}_king_flame_guard.png`), fullPage: true });

  errors.forEach((error) => failures.push(error));
  await context.close();
  return { label, viewport, mechanics, flameOnUi, flameOnVisual, flameOffTransition, flameOffUi, flameOffVisual, flameOnTransition, guardVisual, errors, failures };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const results = [];
  try {
    results.push(await runViewport(browser, { width: 1440, height: 900 }, "desktop"));
    results.push(await runViewport(browser, { width: 932, height: 430 }, "mobile"));
  } finally {
    await browser.close();
  }
  const failures = results.flatMap((result) => result.failures);
  console.log(JSON.stringify({ outputDir: OUTPUT_DIR, results, failures }, null, 2));
  process.exit(failures.length ? 1 : 0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
