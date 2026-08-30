const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/battle_damage_numbers_20260813";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function prepareBattle(host) {
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    player.crew = window.BoardCards.cards.slice(0, 6).map((source) => debug.cloneCard({
      ...source,
      level: 50,
      currentHp: Number.MAX_SAFE_INTEGER,
    }));
    player.crew.forEach((card) => {
      card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
      card.battleCarryItem = null;
    });
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    state.battleState = null;
    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "damage-number-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_douglas_bullet")
      || state.gameState.postgameWorld.islandAssignments[0];
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
  });
}

async function watchDamageNodes(battlePage) {
  await battlePage.evaluate(() => {
    window.__damageNumberQaSeen = [];
    window.__damageNumberQaObserver?.disconnect?.();
    const layer = document.getElementById("damagePop");
    window.__damageNumberQaObserver = new MutationObserver((records) => {
      records.forEach((record) => record.addedNodes.forEach((node) => {
        if (!(node instanceof HTMLElement) || !node.classList.contains("damage-number")) return;
        window.__damageNumberQaSeen.push({
          kind: node.dataset.damageKind || "",
          value: Number(node.dataset.damageValue || 0),
          text: node.textContent.trim(),
        });
      }));
    });
    window.__damageNumberQaObserver.observe(layer, { childList: true });
  });
}

async function sendAttack(host, options) {
  await host.evaluate((payload) => {
    const state = window.__BOARD_GAME_DEBUG__.getState();
    const battle = state.battleState;
    const player = state.gameState.players[0];
    const target = player.crew[battle.activeCrewIndex || 0];
    const total = payload.hitDamages.reduce((sum, value) => sum + Number(value || 0), 0);
    battle.visualEvent = {
      id: `damage-number-${payload.label}-${Date.now()}-${Math.random()}`,
      type: "attack",
      side: "enemy",
      targetSide: "player",
      actorName: battle.enemyCombatant.name,
      targetName: target.name,
      actorCombatant: JSON.parse(JSON.stringify(battle.enemyCombatant)),
      targetCombatant: JSON.parse(JSON.stringify(target)),
      startCombatant: JSON.parse(JSON.stringify(target)),
      moveName: payload.label,
      moveType: "attack",
      damage: total,
      hitDamages: payload.hitDamages,
      hitEffect: "punch_heavy.webp",
      startHp: { player: target.currentHp, enemy: battle.enemyCombatant.currentHp },
      finalHp: { player: Math.max(0, Number(target.currentHp || 0) - total), enemy: battle.enemyCombatant.currentHp },
      diceFace: 6,
      miss: !!payload.miss,
      critical: !!payload.critical,
      duration: 6000,
    };
    battle.animating = true;
  }, options);
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const host = await context.newPage();
  captureErrors(host, errors, "host");
  await host.goto(`${ROOT_URL}/board_game.html?damage_number_qa=1`, { waitUntil: "domcontentloaded" });
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  await prepareBattle(host);

  const popupPromise = context.waitForEvent("page");
  await host.evaluate(() => window.open("board_battle.html?damage_number_qa=1", "_blank"));
  const battlePage = await popupPromise;
  captureErrors(battlePage, errors, "battle");
  await battlePage.waitForLoadState("domcontentloaded");
  await battlePage.waitForFunction(() => document.getElementById("damagePop") && document.getElementById("playerCard"), null, { timeout: 15000 });

  const cases = [
    { label: "普通傷害", hitDamages: [123], expected: [{ kind: "normal", value: 123 }] },
    { label: "暴擊傷害", hitDamages: [456], critical: true, expected: [{ kind: "critical", value: 456 }] },
    { label: "三段連擊", hitDamages: [31, 42, 53], expected: [{ kind: "normal", value: 31 }, { kind: "normal", value: 42 }, { kind: "normal", value: 53 }] },
    { label: "攻擊落空", hitDamages: [0], miss: true, expected: [{ kind: "miss", value: 0 }] },
  ];
  const results = [];
  for (const entry of cases) {
    await watchDamageNodes(battlePage);
    await sendAttack(host, entry);
    await battlePage.waitForFunction((count) => window.__damageNumberQaSeen?.length >= count, entry.expected.length, { timeout: 10000 });
    const result = await battlePage.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll("#damagePop .damage-number"));
      return {
        seen: window.__damageNumberQaSeen.slice(),
        live: nodes.map((node) => {
          const valueStyle = getComputedStyle(node.querySelector(".damage-number-value"));
          const criticalIcon = node.querySelector(".damage-critical-icon");
          const criticalIconStyle = criticalIcon ? getComputedStyle(criticalIcon) : null;
          const criticalLabel = node.querySelector(".damage-critical-label");
          const criticalLabelStyle = criticalLabel ? getComputedStyle(criticalLabel) : null;
          const beforeStyle = getComputedStyle(node, "::before");
          const afterStyle = getComputedStyle(node, "::after");
          return {
            kind: node.dataset.damageKind || "",
            value: Number(node.dataset.damageValue || 0),
            text: node.textContent.trim(),
            animationName: getComputedStyle(node).animationName,
            fontSize: valueStyle.fontSize,
            fontFamily: valueStyle.fontFamily,
            fontStyle: valueStyle.fontStyle,
            textBackground: valueStyle.backgroundImage,
            textFillColor: valueStyle.webkitTextFillColor,
            textStrokeColor: valueStyle.webkitTextStrokeColor,
            textStrokeWidth: valueStyle.webkitTextStrokeWidth,
            digitAnimationName: valueStyle.animationName,
            hasCriticalIcon: !!criticalIcon,
            criticalIconSrc: criticalIcon?.getAttribute("src") || "",
            criticalIconLoaded: !!criticalIcon && criticalIcon.complete && criticalIcon.naturalWidth > 0,
            criticalIconWidth: criticalIconStyle?.width || "0px",
            criticalIconAnimationName: criticalIconStyle?.animationName || "none",
            hasCriticalLabel: !!criticalLabel,
            criticalLabel: criticalLabel?.textContent?.trim() || "",
            criticalLabelColor: criticalLabelStyle?.webkitTextFillColor || "",
            criticalLabelBackground: criticalLabelStyle?.backgroundImage || "none",
            criticalLabelClipPath: criticalLabelStyle?.clipPath || "none",
            criticalLabelAnimationName: criticalLabelStyle?.animationName || "none",
            beforeBackground: beforeStyle.backgroundImage,
            beforeBackgroundColor: beforeStyle.backgroundColor,
            beforeAnimationName: beforeStyle.animationName,
            beforeContent: beforeStyle.content,
            beforeClipPath: beforeStyle.clipPath,
            afterBackground: afterStyle.backgroundImage,
            afterBackgroundColor: afterStyle.backgroundColor,
            afterAnimationName: afterStyle.animationName,
            afterContent: afterStyle.content,
            afterClipPath: afterStyle.clipPath,
          };
        }),
      };
    });
    results.push({ label: entry.label, ...result });
    const actual = result.seen.slice(0, entry.expected.length);
    if (JSON.stringify(actual.map(({ kind, value }) => ({ kind, value }))) !== JSON.stringify(entry.expected)) {
      failures.push(`${entry.label}: ${JSON.stringify(result)}`);
    }
    if (entry.critical && !result.live.some((node) => node.kind === "critical" && node.criticalLabel === "爆擊" && /damageNumberCritical/.test(node.animationName))) {
      failures.push(`${entry.label}: critical presentation missing ${JSON.stringify(result.live)}`);
    }
    if (entry.critical && !result.live.some((node) =>
      node.criticalLabel === "爆擊"
      && Number.parseFloat(node.fontSize) >= 90
      && Number.parseFloat(node.fontSize) <= 98
      && /Impact|Haettenschweiler|Arial Narrow Bold/i.test(node.fontFamily)
      && /^(italic|oblique)/.test(node.fontStyle)
      && node.textBackground === "none"
      && /255, 241, 160/.test(node.textFillColor)
      && /23, 2, 8/.test(node.textStrokeColor)
      && Number.parseFloat(node.textStrokeWidth) > 0
      && /criticalGoldFlash/.test(node.digitAnimationName)
      && !node.hasCriticalIcon
      && /255, 241, 160/.test(node.criticalLabelColor)
      && /linear-gradient/.test(node.criticalLabelBackground)
      && node.criticalLabelClipPath !== "none"
      && /criticalLabelSnap/.test(node.criticalLabelAnimationName)
      && node.beforeBackground === "none"
      && node.beforeAnimationName === "none"
      && node.afterBackground === "none"
      && node.afterAnimationName === "none"
      && node.beforeContent === "none"
      && node.afterContent === "none"
    )) {
      failures.push(`${entry.label}: CSS-only critical visual missing ${JSON.stringify(result.live)}`);
    }
    if (!entry.critical && !entry.miss && !result.live.some((node) => node.kind === "normal" && /damageNumberNormal/.test(node.animationName))) {
      failures.push(`${entry.label}: normal presentation missing ${JSON.stringify(result.live)}`);
    }
    if (entry.label === "暴擊傷害") {
      await battlePage.waitForTimeout(260);
      await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "critical-damage-desktop.png") });
    }
    await battlePage.waitForTimeout(2200);
  }

  const healStyle = await battlePage.evaluate(() => {
    const root = document.getElementById("damagePop");
    const node = document.createElement("div");
    node.className = "damage-number heal show";
    const value = document.createElement("span");
    value.className = "damage-number-value";
    value.textContent = "+100";
    node.appendChild(value);
    root.appendChild(node);
    const result = {
      animationName: getComputedStyle(node).animationName,
      fontFamily: getComputedStyle(value).fontFamily,
      beforeBackground: getComputedStyle(node, "::before").backgroundImage,
      afterBackground: getComputedStyle(node, "::after").backgroundImage,
    };
    node.remove();
    return result;
  });
  if (!/damageNumberNormal/.test(healStyle.animationName)
    || !/Arial Black/.test(healStyle.fontFamily)
    || healStyle.beforeBackground !== "none"
    || healStyle.afterBackground !== "none") {
    failures.push(`heal presentation changed ${JSON.stringify(healStyle)}`);
  }

  await battlePage.setViewportSize({ width: 932, height: 430 });
  await watchDamageNodes(battlePage);
  await sendAttack(host, { label: "手機暴擊", hitDamages: [789], critical: true });
  await battlePage.waitForFunction(() => window.__damageNumberQaSeen?.length >= 1, null, { timeout: 10000 });
  await battlePage.waitForTimeout(260);
  const phone = await battlePage.evaluate(() => {
    const node = document.querySelector("#damagePop .damage-number");
    const rect = node?.getBoundingClientRect();
    return {
      kind: node?.dataset.damageKind || "",
      inViewport: !!rect && rect.left >= -1 && rect.top >= -1 && rect.right <= window.innerWidth + 1 && rect.bottom <= window.innerHeight + 1,
      overflow: document.documentElement.scrollWidth > window.innerWidth + 2 || document.documentElement.scrollHeight > window.innerHeight + 2,
    };
  });
  await battlePage.screenshot({ path: path.join(OUTPUT_DIR, "critical-damage-phone-932x430.png") });
  if (phone.kind !== "critical" || !phone.inViewport) failures.push(`phone critical layout ${JSON.stringify(phone)}`);
  if (errors.length) failures.push(...errors);

  const report = { outputDir: OUTPUT_DIR, results, healStyle, phone, errors, failures };
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
