const path = require("path");
const fs = require("fs");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve(__dirname, "..", "docs", "qa", "bullet_arsenal_battle_hud");

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
    const qa = debug.bulletArsenalQa;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const source = window.BoardCards.cards.find((card) => !/luffy/i.test(card.id)) || window.BoardCards.cards[0];
    const card = debug.cloneCard(source);
    card.battleCarryItem = qa.normalize({
      id: qa.itemId,
      arsenalItems: [
        { id: "wind_shell" },
        { id: "lucci_awakened_black_flame_hagoromo" },
      ],
    });
    card.currentHp = qa.maxHp(card);
    player.crew = [card];
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    state.gameState.currentPlayerIndex = 0;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "bullet-arsenal-battle-hud-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_patrick_redfield");
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
    battle.roundResolved = false;
    return {
      cardName: card.name,
      carryItem: debug.getBattleView()?.activeCard?.carryItem || null,
    };
  });
}

async function inspectHud(page, screenshotName) {
  await page.evaluate(() => window.__BOARD_BATTLE_DEBUG__?.fitBattleViewport());
  await page.waitForTimeout(120);
  await page.waitForFunction(() => document.querySelector("#playerHudMeta .carry-arsenal-pill"));
  const pill = page.locator("#playerHudMeta .carry-arsenal-pill");
  await pill.click();
  await page.waitForFunction(() => document.querySelector("#statusPopover.carry-arsenal-popover.open [data-carry-arsenal-choice]"));
  const initial = await page.evaluate(() => ({
    carryPillCount: document.querySelectorAll("#playerHudMeta .carry-pill").length,
    legacySubPillCount: document.querySelectorAll("#playerHudMeta .carry-sub-pill").length,
    hudText: document.getElementById("playerHudMeta")?.innerText || "",
    choiceCount: document.querySelectorAll("#statusPopover [data-carry-arsenal-choice]").length,
    choiceText: Array.from(document.querySelectorAll("#statusPopover [data-carry-arsenal-choice]")).map((entry) => entry.innerText.trim()),
    prompt: document.querySelector("#statusPopover [data-carry-arsenal-detail]")?.innerText.trim() || "",
  }));
  await page.locator("#statusPopover [data-carry-arsenal-choice]").nth(0).click();
  const first = await page.evaluate(() => ({
    selectedCount: document.querySelectorAll("#statusPopover [data-carry-arsenal-choice].is-selected").length,
    detail: document.querySelector("#statusPopover [data-carry-arsenal-detail]")?.innerText.trim() || "",
  }));
  await page.locator("#statusPopover [data-carry-arsenal-choice]").nth(1).click();
  const second = await page.evaluate(() => {
    const popover = document.getElementById("statusPopover");
    const rect = popover?.getBoundingClientRect();
    const hud = document.getElementById("playerHudMeta");
    return {
      selectedCount: document.querySelectorAll("#statusPopover [data-carry-arsenal-choice].is-selected").length,
      detail: document.querySelector("#statusPopover [data-carry-arsenal-detail]")?.innerText.trim() || "",
      popoverInsideViewport: !!rect && rect.left >= -2 && rect.right <= innerWidth + 2 && rect.top >= -2 && rect.bottom <= innerHeight + 2,
      hudOverflow: !!hud && (hud.scrollWidth > hud.clientWidth + 2 || hud.scrollHeight > hud.clientHeight + 2),
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName), fullPage: true });
  return { initial, first, second };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?bullet_arsenal_battle_hud_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.bulletArsenalQa && window.BoardCards, null, { timeout: 20000 });
  const prepared = await prepareBattle(host);

  const battlePromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?bullet_arsenal_battle_hud_qa=1", "_blank"));
  const battle = await battlePromise;
  captureErrors(battle, errors, "battle");
  await battle.waitForLoadState("domcontentloaded");
  await battle.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.latestView()?.activeCard?.carryItem?.subItems?.length === 2, null, { timeout: 20000 });

  const desktop = await inspectHud(battle, "desktop_1600x900.png");
  await battle.setViewportSize({ width: 932, height: 430 });
  await battle.evaluate(() => window.__BOARD_BATTLE_DEBUG__?.fitBattleViewport());
  const tablet = await inspectHud(battle, "tablet_932x430.png");

  for (const [label, result] of [["desktop", desktop], ["tablet", tablet]]) {
    if (result.initial.carryPillCount !== 1 || result.initial.legacySubPillCount !== 0) failures.push(`${label}: arsenal expanded into multiple HUD pills ${JSON.stringify(result.initial)}`);
    if (!/巴雷特的武器庫/.test(result.initial.hudText)) failures.push(`${label}: arsenal HUD pill missing`);
    if (result.initial.choiceCount !== 2 || !result.initial.choiceText.some((text) => /疾風貝/.test(text)) || !result.initial.choiceText.some((text) => /黑焰羽衣/.test(text))) failures.push(`${label}: nested arsenal choices missing ${JSON.stringify(result.initial)}`);
    if (result.first.selectedCount !== 1 || !/疾風貝/.test(result.first.detail) || !/目前狀態/.test(result.first.detail) || !/完整效果/.test(result.first.detail)) failures.push(`${label}: first arsenal detail incomplete ${JSON.stringify(result.first)}`);
    if (result.second.selectedCount !== 1 || !/黑焰羽衣/.test(result.second.detail) || !result.second.popoverInsideViewport || result.second.hudOverflow) failures.push(`${label}: second arsenal detail or layout invalid ${JSON.stringify(result.second)}`);
  }
  if (errors.length) failures.push(...errors);
  process.stdout.write(JSON.stringify({ ok: failures.length === 0, prepared, desktop, tablet, errors, failures, outputDir: OUTPUT_DIR }, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
