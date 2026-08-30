const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/judge_clone_squad_20260813_v35";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
}

async function prepareJudgeBattle(host) {
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((source) => debug.cloneCard(source));
    player.crew.forEach((card) => {
      card.currentHp = Math.max(1, Number(card.maxHp || card.baseStats?.hp || card.currentHp || 999));
      card.battleCarryItem = null;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "judge-clone-intercept-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_vinsmoke_judge");
    if (!assignment) throw new Error("Missing Judge postgame assignment");
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
    battle.visualEvent = null;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.postgameBossMechanic.clones = 3;
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?judge_clone_intercept_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postgameBossMechanicQa && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  await prepareJudgeBattle(host);

  const popupPromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?judge_clone_intercept_qa=1", "_blank"));
  const battle = await popupPromise;
  captureErrors(battle, errors, "battle");
  await battle.waitForLoadState("domcontentloaded");
  await battle.waitForFunction(() => document.getElementById("judgeCloneGuardLayer") && document.getElementById("enemyPortrait")?.naturalWidth > 0, null, { timeout: 15000 });
  await battle.waitForTimeout(500);

  const idle = await battle.evaluate(() => {
    const layer = document.getElementById("judgeCloneGuardLayer");
    const portrait = document.getElementById("enemyPortrait");
    return {
      layerHidden: layer.hidden || getComputedStyle(layer).display === "none",
      soldierCount: layer.querySelectorAll(".judge-clone-guard").length,
      judgeVisible: getComputedStyle(portrait).visibility !== "hidden" && Number(getComputedStyle(portrait).opacity) > 0,
      judgeImage: portrait.currentSrc || portrait.src,
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "01-judge-unobstructed-idle.png") });

  const rule = await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const mechanic = battle.postgameBossMechanic;
    const move = player.crew[0].moveSet.find((entry) => Number(entry.power || 0) > 0);
    const qa = debug.postgameBossMechanicQa;
    mechanic.clones = 3;
    const meta = {};
    const combo = qa.applyDamageRules([100, 110, 120, 130], "player", move, 6, player, battle, { targetId: "boss" }, meta);
    const afterCombo = mechanic.clones;
    mechanic.clones = 2;
    const targetMeta = {};
    const targeted = qa.applyDamageRules([50, 60, 70], "player", move, 1, player, battle, { targetId: "judge_clone" }, targetMeta);
    mechanic.clones = 0;
    const unguarded = qa.applyDamageRules([80, 90], "player", move, 1, player, battle, { targetId: "boss" }, {});
    return { combo, blocks: meta.judgeCloneBlocks, afterCombo, targeted, targetBlocks: targetMeta.judgeCloneBlocks, afterTargeted: mechanic.clones, unguarded };
  });

  await battle.evaluate(() => {
    window.__judgeCloneQa = { intercepts: [], breaks: [], damages: [], maxConcurrent: 0, formationOverlapRatio: 0 };
    const layer = document.getElementById("judgeCloneGuardLayer");
    const damageLayer = document.getElementById("damagePop");
    new MutationObserver((records) => records.forEach((record) => {
      if (record.type === "childList") record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || !node.classList.contains("judge-clone-intercept")) return;
        window.__judgeCloneQa.maxConcurrent = Math.max(
          window.__judgeCloneQa.maxConcurrent,
          layer.querySelectorAll(".judge-clone-intercept").length,
        );
        requestAnimationFrame(() => {
          const image = node.querySelector(".judge-clone-guard");
          const matrix = new DOMMatrixReadOnly(getComputedStyle(image).transform);
          const entry = {
            guardIndex: Number(node.dataset.guardIndex || 0),
            flipped: matrix.a < 0,
            image: image.currentSrc || image.src,
            fullyContained: false,
          };
          window.__judgeCloneQa.intercepts.push(entry);
          setTimeout(() => {
            const imageRect = image.getBoundingClientRect();
            const layerRect = layer.getBoundingClientRect();
            entry.fullyContained = imageRect.left >= layerRect.left - 1
              && imageRect.top >= layerRect.top - 1
              && imageRect.right <= layerRect.right + 1
              && imageRect.bottom <= layerRect.bottom + 1;
          }, 540);
        });
      });
      if (record.type === "attributes") {
        const image = record.target;
        if (!(image instanceof HTMLElement) || !image.classList.contains("is-breaking") || image.dataset.qaBreakRecorded) return;
        image.dataset.qaBreakRecorded = "1";
        const wrapper = image.closest(".judge-clone-intercept");
        window.__judgeCloneQa.breaks.push({
          guardIndex: Number(wrapper?.dataset.guardIndex || 0),
          hitIndex: Number(wrapper?.dataset.hitIndex || 0),
        });
      }
    })).observe(layer, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
    new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (!(node instanceof HTMLElement) || !node.classList.contains("damage-number")) return;
      window.__judgeCloneQa.damages.push({ kind: node.dataset.damageKind || "", value: Number(node.dataset.damageValue || 0), text: node.textContent.trim() });
    }))).observe(damageLayer, { childList: true });
  });

  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const battle = state.battleState;
    const target = battle.enemyCombatant;
    const start = JSON.parse(JSON.stringify(target));
    target.currentHp = Math.max(0, Number(target.currentHp || 0) - 130);
    battle.postgameBossMechanic.clones = 0;
    battle.visualEvent = {
      id: `judge-clone-combo-${Date.now()}`,
      type: "attack",
      side: "player",
      targetSide: "enemy",
      actorName: player.crew[0].name,
      targetName: target.name,
      actorCombatant: JSON.parse(JSON.stringify(player.crew[0])),
      targetCombatant: JSON.parse(JSON.stringify(target)),
      startCombatant: start,
      moveName: "四段連擊測試",
      moveType: "attack",
      damage: 130,
      hitDamages: [0, 0, 0, 130],
      judgeCloneBlocks: [true, true, true, false],
      judgeCloneCountBefore: 3,
      judgeCloneCountAfter: 0,
      judgeCloneTargetId: "boss",
      hitEffect: "punch_heavy.webp",
      startHp: { player: player.crew[0].currentHp, enemy: start.currentHp },
      finalHp: { player: player.crew[0].currentHp, enemy: target.currentHp },
      diceFace: 6,
      miss: false,
      duration: 6500,
    };
    battle.animating = true;
  });

  await battle.waitForFunction(() => window.__judgeCloneQa?.maxConcurrent === 3, null, { timeout: 10000 });
  await battle.waitForTimeout(540);
  await battle.evaluate(() => {
    const soldiers = Array.from(document.querySelectorAll(".judge-clone-intercept .judge-clone-guard"));
    const judgeRect = document.getElementById("enemyPortrait")?.getBoundingClientRect();
    const overlap = soldiers.reduce((sum, soldier) => {
      const rect = soldier.getBoundingClientRect();
      return sum + Math.max(0, Math.min(rect.right, judgeRect.right) - Math.max(rect.left, judgeRect.left))
        * Math.max(0, Math.min(rect.bottom, judgeRect.bottom) - Math.max(rect.top, judgeRect.top));
    }, 0);
    window.__judgeCloneQa.formationOverlapRatio = judgeRect ? overlap / Math.max(1, judgeRect.width * judgeRect.height) : 0;
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "02-clone-squad-deployed.png") });
  await battle.waitForFunction(() => window.__judgeCloneQa?.breaks?.length >= 3 && window.__judgeCloneQa?.damages?.length >= 4, null, { timeout: 10000 });
  const visual = await battle.evaluate(() => {
    const soldiers = Array.from(document.querySelectorAll(".judge-clone-intercept .judge-clone-guard"));
    const soldierRect = soldiers.at(-1)?.getBoundingClientRect();
    const judgeRect = document.getElementById("enemyPortrait")?.getBoundingClientRect();
    const intersection = soldierRect && judgeRect
      ? Math.max(0, Math.min(soldierRect.right, judgeRect.right) - Math.max(soldierRect.left, judgeRect.left))
        * Math.max(0, Math.min(soldierRect.bottom, judgeRect.bottom) - Math.max(soldierRect.top, judgeRect.top))
      : 0;
    return {
      ...window.__judgeCloneQa,
      judgeHit: document.getElementById("enemyCard")?.classList.contains("portrait-hit"),
      judgeOverlapRatio: judgeRect ? intersection / Math.max(1, judgeRect.width * judgeRect.height) : 0,
    };
  });
  await battle.waitForTimeout(2400);
  const settled = await battle.evaluate(() => {
    const layer = document.getElementById("judgeCloneGuardLayer");
    return { hidden: layer.hidden, intercepts: layer.querySelectorAll(".judge-clone-intercept").length };
  });

  await battle.setViewportSize({ width: 932, height: 430 });
  await host.evaluate(() => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const target = battle.enemyCombatant;
    battle.postgameBossMechanic.clones = 2;
    battle.visualEvent = {
      id: `judge-clone-phone-${Date.now()}`,
      type: "attack",
      side: "player",
      targetSide: "enemy",
      actorName: player.crew[0].name,
      targetName: target.name,
      actorCombatant: JSON.parse(JSON.stringify(player.crew[0])),
      targetCombatant: JSON.parse(JSON.stringify(target)),
      startCombatant: JSON.parse(JSON.stringify(target)),
      moveName: "手機兩段連擊測試",
      moveType: "attack",
      damage: 0,
      hitDamages: [0, 0],
      judgeCloneBlocks: [true, true],
      judgeCloneCountBefore: 2,
      judgeCloneCountAfter: 0,
      judgeCloneTargetId: "boss",
      hitEffect: "punch_heavy.webp",
      startHp: { player: player.crew[0].currentHp, enemy: target.currentHp },
      finalHp: { player: player.crew[0].currentHp, enemy: target.currentHp },
      diceFace: 2,
      miss: false,
      duration: 4200,
    };
    battle.animating = true;
  });
  await battle.waitForFunction(() => document.querySelectorAll(".judge-clone-intercept .judge-clone-guard").length === 2, null, { timeout: 10000 });
  await battle.waitForTimeout(500);
  const phone = await battle.evaluate(() => {
    const soldiers = Array.from(document.querySelectorAll(".judge-clone-intercept .judge-clone-guard"));
    const soldierRects = soldiers.map((soldier) => soldier.getBoundingClientRect());
    const judge = document.getElementById("enemyPortrait");
    return {
      soldierCount: soldiers.length,
      soldierInViewport: soldierRects.length === 2 && soldierRects.every((rect) => rect.left >= -2 && rect.top >= -2 && rect.right <= innerWidth + 2 && rect.bottom <= innerHeight + 2),
      flipped: soldiers.length === 2 && soldiers.every((soldier) => new DOMMatrixReadOnly(getComputedStyle(soldier).transform).a < 0),
      judgeVisible: getComputedStyle(judge).visibility !== "hidden" && Number(getComputedStyle(judge).opacity) > 0,
      overflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
  await battle.screenshot({ path: path.join(OUTPUT_DIR, "03-clone-intercept-phone-932x430.png") });

  if (!idle.layerHidden || idle.soldierCount !== 0 || !idle.judgeVisible) failures.push(`idle obstruction ${JSON.stringify(idle)}`);
  if (JSON.stringify(rule.combo) !== JSON.stringify([0, 0, 0, 130]) || JSON.stringify(rule.blocks) !== JSON.stringify([true, true, true, false]) || rule.afterCombo !== 0) failures.push(`combo rule ${JSON.stringify(rule)}`);
  if (JSON.stringify(rule.targeted) !== JSON.stringify([0, 0, 0]) || JSON.stringify(rule.targetBlocks) !== JSON.stringify([true, true, false]) || rule.afterTargeted !== 0) failures.push(`target rule ${JSON.stringify(rule)}`);
  if (JSON.stringify(rule.unguarded) !== JSON.stringify([80, 90])) failures.push(`unguarded rule ${JSON.stringify(rule)}`);
  if (visual.maxConcurrent !== 3 || visual.intercepts.length !== 3 || visual.intercepts.some((entry) => !entry.flipped || !entry.fullyContained || !/judge_clone_guard/.test(entry.image))) failures.push(`intercept visual ${JSON.stringify(visual)}`);
  if (JSON.stringify(visual.breaks) !== JSON.stringify([
    { guardIndex: 0, hitIndex: 0 }, { guardIndex: 1, hitIndex: 1 }, { guardIndex: 2, hitIndex: 2 },
  ])) failures.push(`break order ${JSON.stringify(visual.breaks)}`);
  if (JSON.stringify(visual.damages.map(({ kind, value }) => ({ kind, value }))) !== JSON.stringify([
    { kind: "blocked", value: 0 }, { kind: "blocked", value: 0 }, { kind: "blocked", value: 0 }, { kind: "normal", value: 130 },
  ])) failures.push(`damage visual ${JSON.stringify(visual.damages)}`);
  if (visual.damages.filter((entry) => entry.kind === "blocked").some((entry) => entry.text !== "GUARD")) failures.push(`guard label ${JSON.stringify(visual.damages)}`);
  if (!(visual.formationOverlapRatio > 0.5)) failures.push(`judge formation overlap ${JSON.stringify(visual.formationOverlapRatio)}`);
  if (!settled.hidden || settled.intercepts !== 0) failures.push(`intercept cleanup ${JSON.stringify(settled)}`);
  if (phone.soldierCount !== 2 || !phone.soldierInViewport || !phone.flipped || !phone.judgeVisible || phone.overflow) failures.push(`phone layout ${JSON.stringify(phone)}`);
  if (errors.length) failures.push(...errors);

  const report = { idle, rule, visual, settled, phone, errors, failures, outputDir: OUTPUT_DIR };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
