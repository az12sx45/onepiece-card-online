const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve(__dirname, "..", "docs", "qa", "bullet_arsenal");

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function runLogicQa(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const qa = debug.bulletArsenalQa;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const source = window.BoardCards.cards.find((card) => !/luffy/i.test(card.id)) || window.BoardCards.cards[0];
    const card = debug.cloneCard(source);
    const checks = [];
    const check = (name, pass, actual, expected) => checks.push({ name, pass: !!pass, actual, expected });
    const inventoryCount = (id) => Number(player.inventory?.items?.[id] || 0);
    const backpackIndex = (id) => player.items.findIndex((item) => String(item?.id || item) === id);

    state.battleState = null;
    player.crew = [card];
    player.activeCrewIndex = 0;
    player.items = [];
    player.inventory = { items: {}, equipped: {} };
    card.battleCarryItem = null;
    card.currentHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);

    window.grantBattleCarryItem("bullet_large_bullet_armor");
    window.grantBattleCarryItem("bullet_large_bullet_armor");
    window.grantBattleCarryItem("wind_shell");
    window.grantBattleCarryItem("lucci_awakened_black_flame_hagoromo");
    window.grantBattleCarryItem("choice_band");

    const outerResult = qa.equipOuter(player, 0, backpackIndex("bullet_large_bullet_armor"));
    check("武器庫占用一個角色攜帶物欄", outerResult.ok && card.battleCarryItem?.id === qa.itemId, card.battleCarryItem?.id, qa.itemId);
    const innerOneResult = qa.equipInner(player, 0, 0, backpackIndex("wind_shell"));
    const innerTwoResult = qa.equipInner(player, 0, 1, backpackIndex("lucci_awakened_black_flame_hagoromo"));
    const effectiveIds = qa.effectiveItems(card).map((item) => item.id);
    check("兩件兵裝可同時裝入", innerOneResult.ok && innerTwoResult.ok && effectiveIds.length === 2, effectiveIds, ["wind_shell", "lucci_awakened_black_flame_hagoromo"]);
    check("內裝物自背包扣除", inventoryCount("wind_shell") === 0 && inventoryCount("lucci_awakened_black_flame_hagoromo") === 0, [inventoryCount("wind_shell"), inventoryCount("lucci_awakened_black_flame_hagoromo")], [0, 0]);

    window.grantBattleCarryItem("lucci_awakened_black_flame_hagoromo");
    const duplicateCountBefore = inventoryCount("lucci_awakened_black_flame_hagoromo");
    const duplicateResult = qa.equipInner(player, 0, 0, backpackIndex("lucci_awakened_black_flame_hagoromo"));
    const duplicateRejectedSlots = qa.slots(card.battleCarryItem).map((item) => item?.id || null);
    check("兩個兵裝槽不能裝入同一種道具", !duplicateResult.ok && /同一種兵裝不能重複/.test(duplicateResult.reason) && inventoryCount("lucci_awakened_black_flame_hagoromo") === duplicateCountBefore && duplicateRejectedSlots.join(",") === "wind_shell,lucci_awakened_black_flame_hagoromo", { result: duplicateResult, inventory: inventoryCount("lucci_awakened_black_flame_hagoromo"), slots: duplicateRejectedSlots }, "拒絕重複且道具留在背包");

    const legacyCard = debug.cloneCard(source);
    const legacyBaseHp = Number(legacyCard.baseStats?.hp || legacyCard.maxHp || legacyCard.hp || 1);
    const legacySingleMaxHp = Math.round(legacyBaseHp * 1.3);
    legacyCard.battleCarryItem = qa.normalize({ id: qa.itemId, arsenalItems: [{ id: "lucci_awakened_black_flame_hagoromo" }, { id: "lucci_awakened_black_flame_hagoromo" }] });
    legacyCard.currentHp = qa.maxHp(legacyCard);
    const legacyPlayer = { items: [], inventory: { items: {}, equipped: {} }, crew: [legacyCard] };
    qa.ensureUnique(legacyPlayer, legacyCard);
    check("舊存檔的重複兵裝自動退回背包", qa.slots(legacyCard.battleCarryItem).map((item) => item?.id || null).join(",") === "lucci_awakened_black_flame_hagoromo," && Number(legacyPlayer.inventory.items.lucci_awakened_black_flame_hagoromo || 0) === 1 && qa.maxHp(legacyCard) === legacySingleMaxHp && legacyCard.currentHp === legacySingleMaxHp, { slots: qa.slots(legacyCard.battleCarryItem).map((item) => item?.id || null), backpack: legacyPlayer.inventory.items.lucci_awakened_black_flame_hagoromo || 0, maxHp: qa.maxHp(legacyCard), currentHp: legacyCard.currentHp }, { slots: ["lucci_awakened_black_flame_hagoromo", null], backpack: 1, maxHp: legacySingleMaxHp, currentHp: legacySingleMaxHp });

    const nestedResult = qa.equipInner(player, 0, 0, backpackIndex("bullet_large_bullet_armor"));
    check("武器庫不可巢狀裝入另一個武器庫", !nestedResult.ok && /不能裝入/.test(nestedResult.reason), nestedResult, "拒絕巢狀");

    const baseHp = Number(card.baseStats?.hp || card.maxHp || card.hp || 1);
    const expectedHp = Math.round(baseHp * 1.3);
    check("黑焰羽衣在武器庫內仍提升最大 HP", qa.maxHp(card) === expectedHp, qa.maxHp(card), expectedHp);

    const fakeBattle = { activeCrewIndex: 0, carryItemStates: {} };
    const contexts = qa.contexts(player, fakeBattle);
    const runtimeKeys = Object.keys(fakeBattle.carryItemStates);
    check("兩個兵裝槽各有獨立戰鬥狀態", contexts.length === 2 && contexts[0].state !== contexts[1].state && runtimeKeys.some((key) => key.includes("arsenal:0")) && runtimeKeys.some((key) => key.includes("arsenal:1")), runtimeKeys, "arsenal:0 與 arsenal:1");
    const equippedLoadout = card.battleCarryItem;
    card.battleCarryItem = null;
    const baseSpeed = qa.currentStat("player", "spd", player, fakeBattle);
    card.battleCarryItem = equippedLoadout;
    const boostedSpeed = qa.currentStat("player", "spd", player, fakeBattle);
    const speedRatio = boostedSpeed / Math.max(1, baseSpeed);
    check("疾風貝與黑焰羽衣的速度效果同時生效", speedRatio > 1.46 && speedRatio < 1.53, { baseSpeed, boostedSpeed, speedRatio }, "約 1.15 × 1.30");
    const serialized = qa.serialize(card, 0, fakeBattle);
    check("戰鬥視圖序列化兩件兵裝", serialized.subItems?.length === 2 && serialized.subItems.map((item) => item.slotIndex).join(",") === "0,1", serialized.subItems, "兩槽 0,1");

    const slotOneUnequip = qa.unequipInner(player, 0, 0);
    const fixedGap = qa.slots(card.battleCarryItem);
    const normalizedSave = qa.normalize(JSON.parse(JSON.stringify(card.battleCarryItem)));
    const normalizedGap = qa.slots(normalizedSave);
    check("卸下第一槽不會把第二槽左移", slotOneUnequip.ok && fixedGap[0] === null && fixedGap[1]?.id === "lucci_awakened_black_flame_hagoromo" && normalizedGap[0] === null && normalizedGap[1]?.id === "lucci_awakened_black_flame_hagoromo", normalizedGap.map((item) => item?.id || null), [null, "lucci_awakened_black_flame_hagoromo"]);
    qa.equipInner(player, 0, 0, backpackIndex("wind_shell"));

    const replaceResult = qa.equipOuter(player, 0, backpackIndex("choice_band"));
    check("更換武器庫會歸還武器庫與兩件兵裝", replaceResult.ok && card.battleCarryItem?.id === "choice_band" && inventoryCount("bullet_large_bullet_armor") === 2 && inventoryCount("wind_shell") === 1 && inventoryCount("lucci_awakened_black_flame_hagoromo") === 2, {
      equipped: card.battleCarryItem?.id,
      arsenal: inventoryCount("bullet_large_bullet_armor"),
      wind: inventoryCount("wind_shell"),
      blackFlame: inventoryCount("lucci_awakened_black_flame_hagoromo"),
    }, "choice_band / 2 / 1 / 2");

    qa.unequipOuter(player, 0);
    card.battleCarryItem = qa.normalize({
      id: qa.itemId,
      arsenalItems: [{ id: "wind_shell" }, { id: "lucci_awakened_black_flame_hagoromo" }],
    });
    card.currentHp = qa.maxHp(card);
    player.items = [];
    player.inventory = { items: {}, equipped: {} };

    if (!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "bullet-arsenal-qa" });
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment = state.gameState.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_douglas_bullet");
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
    const bossQa = debug.postgameBossMechanicQa;
    bossQa.initializeBulletRuntime(player, battle, battle.postgameBossMechanic);
    const physicalSlot = battle.postgameBossMechanic.slots[0];
    const absorbedSlots = bossQa.activeBulletSlots(battle);
    check("巴雷特只吸收空武器庫外殼", physicalSlot.itemId === qa.itemId && physicalSlot.arsenalItems.length === 0 && absorbedSlots.length === 0, { physical: physicalSlot.itemName, absorbed: absorbedSlots.map((slot) => slot.itemName) }, "空武器庫 / 無兵裝效果");
    check("武器庫孔破壞前原持有人兩件兵裝封存", qa.contexts(player, battle).length === 0 && qa.maxHp(card) === baseHp, { contexts: qa.contexts(player, battle).length, maxHp: qa.maxHp(card) }, { contexts: 0, maxHp: baseHp });
    check("空武器庫不提高巴雷特最大 HP", battle.enemyCombatant.maxHp === battle.postgameBossMechanic.bulletBaseMaxHp, battle.enemyCombatant.maxHp, battle.postgameBossMechanic.bulletBaseMaxHp);
    const bossView = bossQa.view(player, battle);
    check("巴雷特六孔狀態顯示空武器庫與封存", /空武器庫・內裝兵裝封存中（破孔後生效）/.test(bossView?.state?.slots?.[0]?.runtimeStatus || ""), bossView?.state?.slots?.[0]?.runtimeStatus, "空武器庫・內裝兵裝封存中（破孔後生效）");
    const releaseResult = bossQa.releaseBulletSlot(player, battle, physicalSlot);
    check("破壞武器庫孔後原持有人兩件兵裝才生效", releaseResult && physicalSlot.destroyed && bossQa.activeBulletSlots(battle).length === 0 && qa.contexts(player, battle).length === 2 && qa.maxHp(card) === expectedHp, { destroyed: physicalSlot.destroyed, restored: qa.contexts(player, battle).map((ctx) => ctx.item.id), maxHp: qa.maxHp(card) }, { restored: "兩件兵裝破孔後恢復生效", maxHp: expectedHp });

    state.battleState = null;
    player.items = [];
    player.inventory = { items: {}, equipped: {} };
    window.grantBattleCarryItem("ammo_pouch");
    window.grantBattleCarryItem("wind_shell");
    qa.openLoadout(player, 0, 0);
    return { checks, cardName: card.name };
  });
}

async function inspectUi(page, screenshotName) {
  await page.waitForFunction(() => document.querySelector('img[src*="bullet_arsenal.webp"]')?.naturalWidth > 0);
  await page.locator('[data-arsenal-slot="1"]').click();
  await page.waitForFunction(() => document.querySelector('[data-arsenal-slot="1"]')?.classList.contains("is-active"));
  const ui = await page.evaluate(() => {
    const section = document.querySelector(".bullet-arsenal-ui");
    const rect = section?.getBoundingClientRect();
    const modal = document.getElementById("modal");
    const images = Array.from(section?.querySelectorAll("img") || []);
    const duplicateRow = Array.from(section?.querySelectorAll(".carry-item-row") || [])
      .find((row) => row.textContent.includes("疾風貝"));
    return {
      visible: !!section && !modal?.classList.contains("hidden"),
      title: section?.querySelector("h3")?.textContent.trim() || "",
      slotCount: section?.querySelectorAll("[data-arsenal-slot]").length || 0,
      activeSlot: section?.querySelector("[data-arsenal-slot].is-active span")?.textContent.trim() || "",
      duplicateBlocked: !!duplicateRow && duplicateRow.classList.contains("is-disabled") && !!duplicateRow.querySelector("button:disabled") && /已在第 1 槽/.test(duplicateRow.textContent),
      brokenImages: images.filter((image) => !image.complete || image.naturalWidth <= 0).map((image) => image.src),
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 2,
      sectionInsideViewport: !!rect && rect.left >= -2 && rect.right <= window.innerWidth + 2,
      viewport: { width: window.innerWidth, height: window.innerHeight },
    };
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName), fullPage: true });
  return ui;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  captureErrors(page, errors, "board");
  await page.goto(`${ROOT_URL}/board_game.html?bullet_arsenal_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.bulletArsenalQa && window.BoardCards, null, { timeout: 20000 });

  const logic = await runLogicQa(page);
  const desktopUi = await inspectUi(page, "desktop_1600x900.png");
  await page.setViewportSize({ width: 932, height: 430 });
  const tabletUi = await inspectUi(page, "tablet_932x430.png");
  const uiChecks = [
    { name: "桌機武器庫整備介面", pass: desktopUi.visible && desktopUi.slotCount === 2 && desktopUi.activeSlot === "2" && desktopUi.duplicateBlocked && !desktopUi.brokenImages.length && !desktopUi.horizontalOverflow && desktopUi.sectionInsideViewport, actual: desktopUi },
    { name: "平板橫向武器庫整備介面", pass: tabletUi.visible && tabletUi.slotCount === 2 && tabletUi.activeSlot === "2" && tabletUi.duplicateBlocked && !tabletUi.brokenImages.length && !tabletUi.horizontalOverflow && tabletUi.sectionInsideViewport, actual: tabletUi },
  ];
  const failures = [...logic.checks, ...uiChecks].filter((entry) => !entry.pass).map((entry) => `${entry.name}: ${JSON.stringify(entry.actual)}`);
  if (errors.length) failures.push(...errors);
  const result = { outputDir: OUTPUT_DIR, logic, desktopUi, tabletUi, errors, failures };
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
