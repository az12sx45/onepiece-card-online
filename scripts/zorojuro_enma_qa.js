const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve(".codex/qa/zorojuro_evolution_frame_v364");

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function captureErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.stack || error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
}

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await context.newPage();
  captureErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?zorojuro_enma_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.zorojuroQa && window.BoardCards && window.GAME_ITEMS, null, { timeout: 30000 });

  const audit = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.zorojuroQa;
    const arsenalQa = debug.bulletArsenalQa;
    const criticalQa = debug.battleCriticalQa;
    const rootState = debug.getState();
    const player = rootState.gameState.players[0];
    const source = window.BoardCards.cards.find((entry) => entry.id === "zoro");
    const checks = [];
    const check = (name, pass, actual, expected) => checks.push({ name, pass: Boolean(pass), actual, expected });
    const approx = (actual, expected, tolerance = .02) => Math.abs(Number(actual) - Number(expected)) <= tolerance;
    const emptyStages = () => ({ atk: 0, def: 0, satk: 0, sdef: 0, spd: 0, accuracy: 0, evasion: 0 });
    const emptyStatuses = () => ({ poison: 0, burn: 0, paralyze: 0, freeze: 0, bind: 0, sleep: 0, confusion: 0, bleed: 0 });
    const makeCard = (mode = "standalone", formId = qa.newWorldFormId) => {
      const card = debug.cloneCard(source);
      card.level = 40;
      card.totalExp = Number.MAX_SAFE_INTEGER;
      card.exp = Number.MAX_SAFE_INTEGER;
      card.currentExp = Number.MAX_SAFE_INTEGER;
      card.formId = formId;
      card.evolutionFormId = formId;
      card.unlockedEvolutionFormIds = formId === "base" ? [] : ["zoro_santoryu_plus", qa.newWorldFormId].filter((id) => id !== "base");
      card.battleCarryItem = mode === "arsenal"
        ? arsenalQa.normalize({ id: arsenalQa.itemId, arsenalItems: [{ id: qa.itemId }, { id: "scope_lens" }] })
        : arsenalQa.normalize({ id: qa.itemId });
      card.currentHp = Number(card.baseStats?.hp || card.hp || 1);
      return card;
    };
    const makeBattle = (overrides = {}) => ({
      playerId: player.id,
      islandId: "qa-zorojuro",
      islandKind: "enemy",
      activeCrewIndex: 0,
      participatedCrewIndices: [0],
      result: "win",
      roundIndex: 1,
      log: [],
      carryItemStates: {},
      heldItemStates: {},
      playerStages: emptyStages(),
      playerStatuses: emptyStatuses(),
      playerRoundEffects: {},
      enemyCombatant: {
        id: "qa-enemy",
        name: "進化測試敵人",
        maxHp: 1000,
        currentHp: 0,
        baseStats: { hp: 1000, atk: 80, def: 80, satk: 80, sdef: 80, spd: 80 },
        stages: emptyStages(),
        statuses: emptyStatuses(),
      },
      ...overrides,
    });

    const item = window.GAME_ITEMS[qa.itemId];
    const form = window.BoardCards.evolutionForms[qa.zorojuroFormId];
    check("閻魔正式道具資料", item?.name === "閻魔" && item.effect?.kind === "zoro_enma", item, "閻魔／zoro_enma");
    check("索隆十郎為第三階特殊進化", form?.stage === 3 && form.specialAwakening === true && form.consumeMaterials === false, form, "stage 3／special／不消耗");
    check("索隆十郎預設四招", form?.defaultMoveIds?.length === 4 && form.defaultMoveIds.every((id) => form.moveSet.some((move) => move.id === id)), form?.defaultMoveIds, "四招全部存在");

    let card = makeCard();
    player.crew = [card];
    player.activeCrewIndex = 0;
    let battle = makeBattle({ participatedCrewIndices: [] });
    rootState.battleState = battle;
    check("未實際參戰不進化", qa.grantVictoryEvolution(player, battle).length === 0 && card.formId === qa.newWorldFormId, card.formId, qa.newWorldFormId);

    battle = makeBattle({ isSparBattle: true });
    rootState.battleState = battle;
    check("切磋 PK 勝利不進化", qa.grantVictoryEvolution(player, battle).length === 0 && card.formId === qa.newWorldFormId, card.formId, qa.newWorldFormId);

    card = makeCard("standalone", "base");
    player.crew = [card];
    battle = makeBattle();
    rootState.battleState = battle;
    check("未到新世界形態不進化", qa.grantVictoryEvolution(player, battle).length === 0 && card.formId === "base", card.formId, "base");

    card = makeCard("standalone");
    player.crew = [card];
    battle = makeBattle({ result: "lose" });
    rootState.battleState = battle;
    check("戰敗不進化", qa.grantVictoryEvolution(player, battle).length === 0 && card.formId === qa.newWorldFormId, card.formId, qa.newWorldFormId);

    card = makeCard("standalone");
    player.crew = [card];
    battle = makeBattle();
    rootState.battleState = battle;
    const noItemCard = makeCard("standalone");
    noItemCard.battleCarryItem = null;
    player.crew = [noItemCard];
    check("沒有裝閻魔不進化", qa.grantVictoryEvolution(player, battle).length === 0 && noItemCard.formId === qa.newWorldFormId, noItemCard.formId, qa.newWorldFormId);

    for (const mode of ["standalone", "arsenal"]) {
      card = makeCard(mode);
      player.crew = [card];
      player.activeCrewIndex = 0;
      battle = makeBattle();
      rootState.battleState = battle;
      const evolved = qa.grantVictoryEvolution(player, battle);
      check(`${mode} 閻魔正式勝利後進化`, evolved.length === 1 && card.formId === qa.zorojuroFormId, { count: evolved.length, formId: card.formId }, qa.zorojuroFormId);
      check(`${mode} 進化後換成四招`, card.unlockedMoveIds?.join(",") === form.defaultMoveIds.join(","), card.unlockedMoveIds, form.defaultMoveIds);
      card.battleCarryItem = null;
      check(`${mode} 取下閻魔仍保留永久形態`, card.formId === qa.zorojuroFormId, card.formId, qa.zorojuroFormId);
    }

    const baseCard = makeCard();
    baseCard.battleCarryItem = null;
    player.crew = [baseCard];
    battle = makeBattle({ result: "" });
    rootState.battleState = battle;
    const baseAtk = debug.currentBattleStat("player", "atk", player, battle);
    const baseCrit = criticalQa.actorRate("player", player, battle);
    const baseCritDamage = criticalQa.actorDamageMultiplier("player", player, battle);
    const enmaCard = makeCard();
    player.crew = [enmaCard];
    battle = makeBattle({ result: "" });
    rootState.battleState = battle;
    const enmaAtk = debug.currentBattleStat("player", "atk", player, battle);
    const enmaCrit = criticalQa.actorRate("player", player, battle);
    const enmaCritDamage = criticalQa.actorDamageMultiplier("player", player, battle);
    check("閻魔物攻 +15% 已接入", approx(enmaAtk / baseAtk, 1.15, .03), { baseAtk, enmaAtk, ratio: enmaAtk / baseAtk }, 1.15);
    check("閻魔 8% 暴擊已接入", approx(enmaCrit - baseCrit, .08, .001), { baseCrit, enmaCrit }, "+0.08");
    check("閻魔暴擊傷害 +0.15 已接入", approx(enmaCritDamage - baseCritDamage, .15, .001), { baseCritDamage, enmaCritDamage }, "+0.15");

    const mainDrop = debug.grantPostgameBossRelicDrop(player, { postgameBossKey: "postgame_king" }, { rand: () => .099 });
    const bonusBattle = { postgameBossKey: "postgame_king" };
    const bonusDrop = debug.grantPostgameBossBonusRelicDrops(player, bonusBattle, { rand: () => .099 });
    const bonusDuplicate = debug.grantPostgameBossBonusRelicDrops(player, bonusBattle, { rand: () => 0 });
    const bonusMiss = debug.grantPostgameBossBonusRelicDrops(player, { postgameBossKey: "postgame_king" }, { rand: () => .1 });
    check("KING 原佩刀掉落保留", mainDrop?.dropped && mainDrop.relicDef?.id === "king_sword", mainDrop, "king_sword");
    check("閻魔為 KING 額外獨立 10%", bonusDrop.length === 1 && bonusDrop[0].dropped && bonusDrop[0].relicDef?.id === qa.itemId, bonusDrop, "enma／10%");
    check("閻魔同一場同玩家不重複判定", bonusDuplicate.length === 0, bonusDuplicate, []);
    check("閻魔 0.1 邊界不掉落", bonusMiss.length === 1 && !bonusMiss[0].dropped, bonusMiss, "未掉落");

    rootState.battleState = null;
    return { checks, item, form };
  });

  const imageAudit = await page.evaluate(async () => {
    const paths = [
      "images/board/items/postgame_boss_relics/enma.webp",
      ...["normal", "angry", "hit", "hit_enemy", "morale", "weak", "dizzy"]
        .map((name) => `images/board/battle/portraits/evolutions/zoro_zorojuro/${name}.webp`),
    ];
    return Promise.all(paths.map(async (src) => {
      const response = await fetch(src, { cache: "no-store" });
      const bitmap = response.ok ? await createImageBitmap(await response.blob()) : null;
      return { src, ok: response.ok, width: bitmap?.width || 0, height: bitmap?.height || 0 };
    }));
  });

  const finishPage = await context.newPage();
  captureErrors(finishPage, errors);
  await finishPage.goto(`${ROOT_URL}/board_game.html?zorojuro_finish_integration_qa=1`, { waitUntil: "domcontentloaded" });
  await finishPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.zorojuroQa && window.BoardCards, null, { timeout: 30000 });
  const finishIntegration = await finishPage.evaluate(async () => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.zorojuroQa;
    const rootState = debug.getState();
    const player = rootState.gameState.players[0];
    const source = window.BoardCards.cards.find((entry) => entry.id === "zoro");
    const card = debug.cloneCard(source);
    card.totalExp = Number.MAX_SAFE_INTEGER;
    card.exp = Number.MAX_SAFE_INTEGER;
    card.level = 40;
    card.formId = qa.newWorldFormId;
    card.evolutionFormId = qa.newWorldFormId;
    card.unlockedEvolutionFormIds = ["zoro_santoryu_plus", qa.newWorldFormId];
    card.battleCarryItem = debug.bulletArsenalQa.normalize({ id: qa.itemId });
    player.crew = [card];
    player.activeCrewIndex = 0;
    player.isCpu = true;
    player.isCPU = true;
    rootState.gameState.phase = "main";
    rootState.gameState.turnIndex = 0;
    const island = rootState.gameState.boardData.islands.find((entry) => entry.kind === "enemy");
    const islandState = debug.getIslandState(island.id);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    debug.startBattle(player, island, islandState);
    const battle = rootState.battleState;
    battle.prebattleIntro.done = true;
    battle.result = "win";
    battle.roundResolved = true;
    battle.enemyCombatant.currentHp = 0;
    battle.participatedCrewIndices = [0];
    await debug.battleFinish();
    return {
      formId: card.formId,
      moveIds: card.unlockedMoveIds,
      battleCleared: !rootState.battleState,
      evolutionLog: rootState.gameState.log.find((entry) => String(entry).includes("特殊進化為 索隆十郎")) || "",
    };
  });
  await finishPage.close();

  const uiPage = await context.newPage();
  captureErrors(uiPage, errors);
  await uiPage.goto(`${ROOT_URL}/board_game.html?zorojuro_evolution_hud_qa=1`, { waitUntil: "domcontentloaded" });
  await uiPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.zorojuroQa && window.BoardCards, null, { timeout: 30000 });
  await uiPage.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.zorojuroQa;
    const rootState = debug.getState();
    const player = rootState.gameState.players[0];
    const source = window.BoardCards.cards.find((entry) => entry.id === "zoro");
    const card = debug.cloneCard(source);
    card.totalExp = Number.MAX_SAFE_INTEGER;
    card.exp = Number.MAX_SAFE_INTEGER;
    card.level = 40;
    card.formId = qa.newWorldFormId;
    card.evolutionFormId = qa.newWorldFormId;
    card.unlockedEvolutionFormIds = ["zoro_santoryu_plus", qa.newWorldFormId];
    card.battleCarryItem = debug.bulletArsenalQa.normalize({ id: qa.itemId });
    player.crew = [card];
    player.activeCrewIndex = 0;
    player.isCpu = false;
    player.isCPU = false;
    rootState.gameState.phase = "main";
    rootState.gameState.turnIndex = 0;
    const battle = {
      playerId: player.id,
      islandId: "qa-hud",
      islandKind: "enemy",
      activeCrewIndex: 0,
      participatedCrewIndices: [0],
      result: "win",
      roundIndex: 1,
      log: [],
    };
    rootState.battleState = battle;
    window.__zorojuroHudPromise = qa.resolveVictoryEvolutions(player, battle);
  });
  await uiPage.waitForSelector("#evolutionHud.show.enma", { timeout: 5000 });
  await uiPage.waitForFunction(() => {
    const before = getComputedStyle(document.getElementById("evolutionHudCharacterBefore"));
    const material = getComputedStyle(document.getElementById("evolutionHudMaterial"));
    const grayscale = Number(before.filter.match(/grayscale\(([\d.]+)\)/)?.[1] || 0);
    return Number(before.opacity || 0) > .5 && grayscale > .72 && Number(material.opacity || 0) > .8;
  }, null, { timeout: 6500 });
  const beforeFlash = await uiPage.evaluate(() => {
    const character = document.getElementById("evolutionHudCharacterBefore");
    const material = document.getElementById("evolutionHudMaterial");
    const characterStyle = getComputedStyle(character);
    const materialStyle = getComputedStyle(material);
    const characterRect = character.getBoundingClientRect();
    const materialRect = material.getBoundingClientRect();
    const verticalGap = Math.max(0, characterRect.top - materialRect.bottom, materialRect.top - characterRect.bottom);
    return {
      opacity: Number(characterStyle.opacity || 0),
      filter: characterStyle.filter,
      materialOpacity: Number(materialStyle.opacity || 0),
      verticalGap,
      horizontalCenterDistance: Math.abs((characterRect.left + characterRect.right) / 2 - (materialRect.left + materialRect.right) / 2),
    };
  });
  await uiPage.screenshot({ path: path.join(OUTPUT_DIR, "desktop-before-flash-1600x900.webp"), type: "webp" });
  await uiPage.waitForFunction(() => {
    const after = getComputedStyle(document.getElementById("evolutionHudCharacterAfter"));
    const grayscale = Number(after.filter.match(/grayscale\(([\d.]+)\)/)?.[1] || 0);
    return Number(after.opacity || 0) > .5 && grayscale > .72;
  }, null, { timeout: 3500 });
  const afterFlash = await uiPage.evaluate(() => {
    const style = getComputedStyle(document.getElementById("evolutionHudCharacterAfter"));
    return { opacity: Number(style.opacity || 0), filter: style.filter };
  });
  await uiPage.screenshot({ path: path.join(OUTPUT_DIR, "desktop-after-flash-1600x900.webp"), type: "webp" });
  await uiPage.waitForTimeout(1600);
  const desktopHud = await uiPage.evaluate(() => ({
    className: document.getElementById("evolutionHud")?.className || "",
    material: document.getElementById("evolutionHudMaterial")?.getAttribute("src") || "",
    materialOpacity: Number(getComputedStyle(document.getElementById("evolutionHudMaterial")).opacity || 0),
    before: document.getElementById("evolutionHudCharacterBefore")?.getAttribute("src") || "",
    after: document.getElementById("evolutionHudCharacterAfter")?.getAttribute("src") || "",
    frame: (() => {
      const element = document.getElementById("evolutionHudCharacterFrame");
      const rect = element?.getBoundingClientRect();
      const style = element ? getComputedStyle(element) : null;
      return {
        src: element?.getAttribute("src") || "",
        complete: Boolean(element?.complete && element?.naturalWidth && element?.naturalHeight),
        naturalWidth: element?.naturalWidth || 0,
        naturalHeight: element?.naturalHeight || 0,
        opacity: Number(style?.opacity || 0),
        animationName: style?.animationName || "",
        rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
      };
    })(),
    afterRect: (() => {
      const rect = document.getElementById("evolutionHudCharacterAfter")?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    })(),
    characterWindow: (() => {
      const element = document.getElementById("evolutionHudCharacterWindow");
      const rect = element?.getBoundingClientRect();
      const style = element ? getComputedStyle(element) : null;
      return {
        rect: rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null,
        clipPath: style?.clipPath || "",
        overflow: style?.overflow || "",
      };
    })(),
    afterClipPath: getComputedStyle(document.getElementById("evolutionHudCharacterAfter")).clipPath,
    frameCount: document.querySelectorAll(".evolution-character-frame").length,
    awakenedFrameCount: document.querySelectorAll("#evolutionHudCharacterFrameAwakened,.evolution-character-frame.awakened").length,
    stageBeforeAnimation: getComputedStyle(document.querySelector(".evolution-material-stage"), "::before").animationName,
    stageAfterAnimation: getComputedStyle(document.querySelector(".evolution-material-stage"), "::after").animationName,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await uiPage.screenshot({ path: path.join(OUTPUT_DIR, "desktop-1600x900.webp"), type: "webp" });
  await uiPage.setViewportSize({ width: 844, height: 390 });
  await uiPage.waitForTimeout(150);
  const tabletHud = await uiPage.evaluate(() => ({
    visible: document.getElementById("evolutionHud")?.classList.contains("show") || false,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    materialRect: (() => {
      const rect = document.getElementById("evolutionHudMaterial")?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom } : null;
    })(),
    frameRect: (() => {
      const rect = document.getElementById("evolutionHudCharacterFrame")?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    })(),
    windowRect: (() => {
      const rect = document.getElementById("evolutionHudCharacterWindow")?.getBoundingClientRect();
      return rect ? { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height } : null;
    })(),
  }));
  await uiPage.screenshot({ path: path.join(OUTPUT_DIR, "tablet-844x390.webp"), type: "webp" });
  const themeCoverage = await uiPage.evaluate(() => {
    const hud = document.getElementById("evolutionHud");
    const frame = document.getElementById("evolutionHudCharacterFrame");
    const originalClassName = hud?.className || "evolution-hud";
    const result = ["flag", "paper", "prime", "enma"].map((type) => {
      hud.className = `evolution-hud show ${type}`;
      const hudStyle = getComputedStyle(hud);
      const frameStyle = getComputedStyle(frame);
      return {
        type,
        animationName: frameStyle.animationName,
        display: frameStyle.display,
        glow: hudStyle.getPropertyValue("--evolution-glow").trim(),
      };
    });
    hud.className = originalClassName;
    return result;
  });
  await uiPage.close();

  audit.checks.forEach((entry) => {
    if (!entry.pass) errors.push(`${entry.name}: actual=${JSON.stringify(entry.actual)} expected=${JSON.stringify(entry.expected)}`);
  });
  imageAudit.forEach((entry, index) => {
    const expected = index === 0 ? [1254, 1254] : [1086, 1448];
    if (!entry.ok || entry.width !== expected[0] || entry.height !== expected[1]) {
      errors.push(`image:${entry.src}: actual=${entry.ok}/${entry.width}x${entry.height} expected=200/${expected[0]}x${expected[1]}`);
    }
  });
  const finishExpectedMoves = audit.form.defaultMoveIds;
  if (finishIntegration.formId !== "zoro_zorojuro" || finishIntegration.moveIds.join(",") !== finishExpectedMoves.join(",") || !finishIntegration.battleCleared || !finishIntegration.evolutionLog) {
    errors.push(`finishIntegration:${JSON.stringify(finishIntegration)}`);
  }
  const desktopFrameAligned = desktopHud.frame.rect && desktopHud.afterRect
    && Math.abs(desktopHud.frame.rect.width - desktopHud.afterRect.width) <= 3
    && Math.abs(desktopHud.frame.rect.height - desktopHud.afterRect.height) <= 3
    && Math.abs(desktopHud.frame.rect.left - desktopHud.afterRect.left) <= 3
    && Math.abs(desktopHud.frame.rect.top - desktopHud.afterRect.top) <= 3;
  const desktopWindowAligned = desktopHud.frame.rect && desktopHud.characterWindow.rect
    && Math.abs(desktopHud.frame.rect.width - desktopHud.characterWindow.rect.width) <= 1
    && Math.abs(desktopHud.frame.rect.height - desktopHud.characterWindow.rect.height) <= 1
    && Math.abs(desktopHud.frame.rect.left - desktopHud.characterWindow.rect.left) <= 1
    && Math.abs(desktopHud.frame.rect.top - desktopHud.characterWindow.rect.top) <= 1;
  if (!desktopHud.className.includes("enma") || !desktopHud.material.endsWith("/enma.webp") || !desktopHud.before.includes("/zoro_evolution_2/") || !desktopHud.after.includes("/zoro_zorojuro/") || desktopHud.overflowX
    || !desktopHud.frame.src.endsWith("/evolution_portrait_frame_v1.webp") || !desktopHud.frame.complete
    || desktopHud.frame.naturalWidth !== 1086 || desktopHud.frame.naturalHeight !== 1448
    || desktopHud.frame.opacity < .9 || desktopHud.frame.animationName !== "evolutionCharacterFrame" || !desktopFrameAligned
    || !desktopWindowAligned || desktopHud.characterWindow.clipPath === "none" || !["hidden", "clip"].includes(desktopHud.characterWindow.overflow)
    || desktopHud.materialOpacity > .1 || desktopHud.afterClipPath !== "none"
    || desktopHud.frameCount !== 1 || desktopHud.awakenedFrameCount !== 0
    || desktopHud.stageBeforeAnimation !== "none" || desktopHud.stageAfterAnimation !== "none") {
    errors.push(`desktopHud:${JSON.stringify(desktopHud)}`);
  }
  if (!tabletHud.visible || tabletHud.overflowX || !tabletHud.materialRect || tabletHud.materialRect.left < 0 || tabletHud.materialRect.right > 844
    || !tabletHud.frameRect || tabletHud.frameRect.left < 0 || tabletHud.frameRect.right > 844 || tabletHud.frameRect.top < 0 || tabletHud.frameRect.bottom > 390
    || !tabletHud.windowRect || Math.abs(tabletHud.frameRect.left - tabletHud.windowRect.left) > 1 || Math.abs(tabletHud.frameRect.top - tabletHud.windowRect.top) > 1
    || Math.abs(tabletHud.frameRect.width - tabletHud.windowRect.width) > 1 || Math.abs(tabletHud.frameRect.height - tabletHud.windowRect.height) > 1) {
    errors.push(`tabletHud:${JSON.stringify(tabletHud)}`);
  }
  if (themeCoverage.length !== 4 || themeCoverage.some((entry) => entry.animationName !== "evolutionCharacterFrame" || entry.display === "none" || !entry.glow)) {
    errors.push(`themeCoverage:${JSON.stringify(themeCoverage)}`);
  }
  const beforeGrayscale = Number(beforeFlash.filter.match(/grayscale\(([\d.]+)\)/)?.[1] || 0);
  const afterGrayscale = Number(afterFlash.filter.match(/grayscale\(([\d.]+)\)/)?.[1] || 0);
  if (beforeFlash.opacity <= .5 || beforeFlash.materialOpacity <= .8 || beforeFlash.verticalGap > 24 || beforeFlash.horizontalCenterDistance > 40
    || beforeGrayscale <= .72 || !beforeFlash.filter.includes("invert(")) {
    errors.push(`beforeFlash:${JSON.stringify(beforeFlash)}`);
  }
  if (afterFlash.opacity <= .5 || afterGrayscale <= .72 || !afterFlash.filter.includes("invert(")) {
    errors.push(`afterFlash:${JSON.stringify(afterFlash)}`);
  }

  await browser.close();
  const report = {
    pass: errors.length === 0,
    checkCount: audit.checks.length + 7,
    imageCount: imageAudit.length,
    failedChecks: audit.checks.filter((entry) => !entry.pass),
    imageAudit,
    finishIntegration,
    desktopHud,
    tabletHud,
    themeCoverage,
    beforeFlash,
    afterFlash,
    errors,
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.pass ? 0 : 1);
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
