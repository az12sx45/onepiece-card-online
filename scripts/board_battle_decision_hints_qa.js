"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");
const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18920";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-quality-20260920/battle";
const source = fs.readFileSync(path.join(__dirname, "../public/js/board_game.js"), "utf8");
const start = source.indexOf("  function battleDecisionHints(");
const end = source.indexOf("  function getBattleItemOptions(", start);
assert.ok(start >= 0 && end > start);
const decisionHints = vm.runInNewContext(`(${source.slice(start, end).trim()})`, {
  postgameBossMechanicCrewKey: (card, index) => String(card?.id || card?.key || `crew-${index}`),
  isYonkoBattleKey: (battle, key) => battle.enemyCombatant.key === key,
  cardMaxHp: (card) => card.qaEffectiveMaxHp || card.baseStats.hp,
});
let checks = 0;
function check(value, expected, label) { assert.deepEqual(value, expected, label); checks += 1; }
function fixture() {
  return {
    player: { crew: [{ id: "a", currentHp: 100, baseStats: { hp: 100 } }, { id: "b", currentHp: 100 }] },
    battle: { activeCrewIndex: 0, enemyCombatant: { key: "normal", stages: {}, roundEffects: {} }, playerRoundEffects: {} },
  };
}
function hints(f) { return JSON.parse(JSON.stringify(decisionHints(f.player, f.battle))); }
function freeze(value) { Object.values(value).forEach((v) => { if (v && typeof v === "object") freeze(v); }); return Object.freeze(value); }
const quiet = fixture();
check(hints(quiet), [], "ordinary neutral battle does not add generic noise");
const boosted = fixture();
boosted.battle.enemyCombatant.stages.sdef = 2;
check(hints(boosted).map((hint) => hint.id), ["enemy-special-defense"], "actual special-defense boost gets actionable context");
boosted.battle.enemyCombatant.stages.sdef = 0;
check(hints(boosted), [], "expired boost clears the hint");
const shield = fixture();
shield.battle.playerRoundEffects = { nextShieldRatio: 0.35 };
check(hints(shield)[0].id, "player-shield-next", "a shield cast after the enemy acted is explicitly future protection");
check(hints(shield)[0].text.includes("目前尚未生效"), true, "future protection is never described as current");
shield.battle.playerRoundEffects = { shieldRatio: 0.35, nextShieldRatio: 0 };
check(hints(shield)[0].text.includes("回合結束後消失"), true, "current one-round shield shows expiry");
shield.battle.playerRoundEffects.nextShieldRatio = 0.5;
check(hints(shield)[0].text.includes("下回合仍有 50%"), true, "renewed shield does not claim expiry");
const gold = fixture();
gold.battle.postgameBossMechanic = { key: "postgame_gild_tesoro", phase: 1, goldByCrew: { a: 2 } };
check(hints(gold)[0].text.includes("強制替補"), true, "second gold stack warns about forced substitution");
gold.player.crew[1].currentHp = 0;
check(hints(gold)[0].text.includes("沒有可替補夥伴"), true, "no living bench explains action cancellation instead");
gold.battle.postgameBossMechanic.phase = 3;
check(hints(gold), [], "Tesoro final phase no longer warns about inactive gold mechanic");
gold.battle.postgameBossMechanic.phase = 1;
gold.battle.postgameBossMechanic.goldByCrew.a = 1;
check(hints(gold), [], "one stack does not warn about an imminent third hit");
const low = fixture();
low.player.crew[0].currentHp = 30;
check(hints(low)[0].id, "low-hp", "low HP makes healing and bench options visible");
low.player.crew[0].currentHp = 45;
low.player.crew[0].qaEffectiveMaxHp = 150;
check(hints(low)[0].id, "low-hp", "HP ratio uses the authoritative maximum including equipped effects");
low.player.crew[0].currentHp = 0;
check(hints(low), [], "knocked out actor uses the replacement UI instead");
const shanks = fixture();
shanks.battle.enemyCombatant.key = "yonko_shanks";
check(hints(shanks)[0].id, "shanks-attribute", "Shanks points to existing authoritative move previews");
shanks.battle.result = "win";
check(hints(shanks), [], "settlement clears decision advice");
freeze(shield);
const before = JSON.stringify(shield);
hints(shield);
check(JSON.stringify(shield), before, "deriving hints leaves all battle and save state unchanged");

async function makeView(page) {
  await page.goto(`${ROOT_URL}/board_game.html?decision_hints_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 3).map((source) => debug.cloneCard({ ...source, level: 50 }));
    player.crew.forEach((card) => { card.currentHp = card.baseStats.hp; card.battleCarryItem = null; });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    debug.unlockPostgameWorldAfterEnding(player, { id: "decision-hints-local-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_gild_tesoro");
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, debug.getIslandById(assignment.islandId), islandState);
    const battle = state.battleState;
    Object.assign(battle, { entryTransition: null, prebattleIntro: null, prebattleIntroDone: true, openingPassiveVisual: null,
      openingPassiveVisualQueue: [], visualEvent: null, animating: false, roundResolved: false, waitingResume: false });
    battle.enemyCombatant.stages.sdef = 2;
    battle.playerRoundEffects.shieldRatio = 0.35;
    battle.postgameBossMechanic.goldByCrew[player.crew[0].id] = 2;
    battle.postgameBossMechanic.controlByCrew[player.crew[0].id] = 2;
    player.crew[0].currentHp = Math.floor(player.crew[0].baseStats.hp * 0.25);
    return debug.getBattleView();
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  try {
    const context = await browser.newContext();
    await context.addInitScript(() => { window.setInterval = () => 0; });
    const host = await context.newPage();
    host.on("pageerror", (error) => errors.push(error.message));
    const view = await makeView(host);
    check(view.decisionHints.some((hint) => hint.id === "tesoro-next-hit"), true, "formal getBattleView includes real Boss state advice");
    check(view.decisionHints.some((hint) => hint.id === "enemy-special-defense"), true, "formal getBattleView includes current special defense");
    await host.close();
    const reports = [];
    for (const [name, width, height] of [["desktop", 1440, 900], ["phone-landscape", 932, 430], ["phone-portrait", 390, 844]]) {
      const page = await context.newPage();
      await page.setViewportSize({ width, height });
      page.on("pageerror", (error) => errors.push(`${name}:${error.message}`));
      await page.goto(`${ROOT_URL}/board_battle.html?decision_hints_qa=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.refresh);
      await page.evaluate((snapshot) => window.__BOARD_BATTLE_DEBUG__.refresh(snapshot), view);
      await page.waitForTimeout(300);
      const report = await page.evaluate(() => {
        const panel = document.getElementById("battleDecisionHints");
        const bounds = panel.getBoundingClientRect();
        const actions = document.querySelector(".action-panel").getBoundingClientRect();
        return { hidden: panel.hidden, count: panel.querySelectorAll("li").length,
          horizontalOverflow: panel.scrollWidth > panel.clientWidth,
          pageOverflow: document.documentElement.scrollWidth > innerWidth,
          inViewport: bounds.left >= 0 && bounds.right <= innerWidth && bounds.top >= 0 && bounds.bottom <= innerHeight,
          overlapsActions: bounds.bottom > actions.top && bounds.right > actions.left && bounds.left < actions.right,
          text: panel.innerText };
      });
      check(report.hidden, false, `${name}: decision hints are visible before acting`);
      check(report.count, view.decisionHints.length, `${name}: all advice remains reachable`);
      check(report.horizontalOverflow, false, `${name}: advice wraps inside the panel`);
      check(report.pageOverflow, false, `${name}: no horizontal page overflow`);
      check(await page.locator("#battleDecisionHints").getAttribute("tabindex"), "0", `${name}: scrollable advice is keyboard reachable`);
      if (name !== "phone-portrait") {
        check(report.inViewport, true, `${name}: hints remain on screen`);
        check(report.overlapsActions, false, `${name}: hints do not cover commands`);
      }
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${name}.png`) });
      await page.evaluate((snapshot) => { snapshot.battle.animating = true; window.__BOARD_BATTLE_DEBUG__.refresh(snapshot); }, view);
      check(await page.locator("#battleDecisionHints").getAttribute("hidden"), "", `${name}: animation hides advice`);
      await page.evaluate((snapshot) => { snapshot.battle.canControl = false; snapshot.battle.canAct = false; window.__BOARD_BATTLE_DEBUG__.refresh(snapshot); }, view);
      check(await page.locator("#battleDecisionHints").getAttribute("hidden"), "", `${name}: spectator retains read-only presentation`);
      reports.push({ name, ...report });
      await page.close();
    }
    check(errors, [], "no runtime page errors");
    const result = { ok: true, checks, errors, reports };
    fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), `${JSON.stringify(result, null, 2)}\n`);
    console.log(JSON.stringify({ ok: true, checks, errors, output: OUTPUT_DIR }, null, 2));
  } finally { await browser.close(); }
})().catch((error) => { console.error(error); process.exitCode = 1; });
