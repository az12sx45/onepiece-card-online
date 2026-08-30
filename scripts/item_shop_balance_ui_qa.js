const assert = require("assert");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function openShop(page, selectedItemId) {
  return page.evaluate((requestedItemId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const player = state.gameState.players[0];
    const island = state.gameState.boardData.islands.find((entry) => entry.kind === "shop")
      || state.gameState.boardData.islands[0];
    const islandState = debug.getIslandState(island.id);
    player.coins = 50000;
    player.bounty = 0;
    debug.openShopModal(player, island, islandState, requestedItemId);
    return {
      playerId: player.id,
      islandId: island.id,
      coins: player.coins,
      shopItems: debug.shopItems(),
      gameItems: debug.gameItems(),
    };
  }, selectedItemId);
}

async function runViewport(browser, label, viewport) {
  const errors = [];
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  captureErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?item_shop_balance_qa=${label}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__BOARD_GAME_DEBUG__, null, { timeout: 15000 });

  const prepared = await openShop(page, "ship_adam_wood");
  const formalItems = Object.values(prepared.gameItems);
  const shipItems = formalItems.filter((item) => item.category === "ship");
  const shopShipItems = prepared.shopItems.filter((item) => item.category === "ship");
  const missingShips = shipItems.filter((item) => !shopShipItems.some((shopItem) => shopItem.id === item.id));

  const ui = await page.evaluate(() => {
    const modal = document.getElementById("boardModal");
    const list = document.querySelector(".shop-list");
    const rows = Array.from(document.querySelectorAll("[data-shop-select]"));
    const selected = document.querySelector('[data-shop-select="ship_adam_wood"]');
    const rect = modal?.getBoundingClientRect();
    return {
      rows: rows.length,
      lockedRows: document.querySelectorAll("[data-shop-select].is-locked").length,
      lockLabels: Array.from(document.querySelectorAll(".shop-row-status.is-locked")).map((entry) => entry.textContent?.trim() || ""),
      selectedName: selected?.querySelector(".shop-item-name")?.textContent?.trim() || "",
      selectedPrice: selected?.querySelector(".shop-item-price")?.textContent?.trim() || "",
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      listScrollable: !!list && list.scrollHeight > list.clientHeight,
      modalFitsWidth: !!rect && rect.left >= -1 && rect.right <= window.innerWidth + 1,
      brokenImages: Array.from(document.querySelectorAll('#boardModal img[src]:not([src=""])'))
        .filter((image) => image.offsetParent !== null && image.complete && image.naturalWidth === 0)
        .map((image) => image.currentSrc || image.src),
    };
  });

  assert.strictEqual(prepared.shopItems.length, 115, `${label} 商店應顯示 115 項`);
  assert.deepStrictEqual(prepared.shopItems.filter((item) => Number(item.unlockBounty || 0) !== 0).map((item) => item.id), [], `${label} 所有商品解鎖門檻都應為 0`);
  assert.strictEqual(shipItems.length, 16, `${label} 正式船隻道具應為 16 項`);
  assert.strictEqual(shopShipItems.length, 16, `${label} 商店船隻道具應為 16 項`);
  assert.deepStrictEqual(missingShips.map((item) => item.id), [], `${label} 不得遺漏船隻商品`);
  assert.strictEqual(ui.rows, 115, `${label} 商店 UI 列數應為 115`);
  assert.strictEqual(ui.lockedRows, 0, `${label} 零懸賞玩家不應看到鎖定商品`);
  assert.deepStrictEqual(ui.lockLabels, [], `${label} 商店不得顯示懸賞鎖標籤`);
  assert.strictEqual(ui.selectedName, "寶樹亞當木片", `${label} 應能選到 S 級船材`);
  assert.ok(ui.selectedPrice.includes("6,000"), `${label} S 級船材應顯示 6,000 貝里`);
  assert.strictEqual(ui.horizontalOverflow, false, `${label} 不得產生頁面水平溢出`);
  assert.strictEqual(ui.modalFitsWidth, true, `${label} 商店視窗寬度必須留在 viewport`);
  assert.strictEqual(ui.listScrollable, true, `${label} 115 項商品清單必須可捲動`);
  assert.deepStrictEqual(ui.brokenImages, [], `${label} 商店不得有破圖`);

  await page.locator("#shopBuyBtn").click();
  await page.locator("#shopQtyConfirm").click();
  await page.waitForFunction(() => document.querySelector(".shop-description-bar")?.textContent?.includes("已購買"));
  const purchase = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getState().gameState.players[0];
    return {
      coins: player.coins,
      count: Number(player.inventory?.items?.ship_adam_wood || 0),
      notice: document.querySelector(".shop-description-bar")?.textContent || "",
    };
  });
  assert.strictEqual(purchase.coins, 44000, `${label} 購買後應扣除 6,000 貝里`);
  assert.strictEqual(purchase.count, 1, `${label} S 級船材應進入正式背包庫存`);
  assert.ok(purchase.notice.includes("已購買"), `${label} 應顯示購買成功訊息`);
  assert.deepStrictEqual(errors, [], `${label} 不得有頁面錯誤`);

  await context.close();
  return {
    label,
    viewport,
    shopItems: prepared.shopItems.length,
    shipItems: shopShipItems.length,
    ui,
    purchase,
    errors,
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  try {
    const results = [];
    results.push(await runViewport(browser, "desktop", { width: 1440, height: 900 }));
    results.push(await runViewport(browser, "tablet", { width: 932, height: 430 }));
    console.log(JSON.stringify({ status: "PASS", results }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
