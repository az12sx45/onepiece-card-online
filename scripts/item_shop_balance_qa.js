const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const itemSourcePath = path.join(root, "public", "js", "board_items.js");
const gameSourcePath = path.join(root, "public", "js", "board_game.js");
const window = {};

vm.runInNewContext(fs.readFileSync(itemSourcePath, "utf8"), { window });

const gameSource = fs.readFileSync(gameSourcePath, "utf8");
const items = Object.values(window.GAME_ITEMS || {});
const itemById = window.GAME_ITEMS || {};
const shopIds = Array.from(new Set(window.ITEM_SHOPS?.item_shop || []));
const shopItems = shopIds
  .map((id) => itemById[id])
  .filter((item) => item && (item.rarity !== "S" || item.category === "ship"));
const ships = items.filter((item) => item.category === "ship");
const shopShips = shopItems.filter((item) => item.category === "ship");

assert.strictEqual(items.length, 178, "正式道具總數必須維持 178");
assert.strictEqual(shopItems.length, 115, "一般道具商店應有 115 項商品");
assert.strictEqual(ships.length, 16, "船隻類道具應維持 16 項");
assert.strictEqual(shopShips.length, 16, "16 項船隻類道具都必須進入一般道具商店");
assert.deepStrictEqual(
  ships.filter((item) => !shopIds.includes(item.id)).map((item) => item.id),
  [],
  "不得有船隻類道具遺漏商店取得方式"
);
assert.deepStrictEqual(
  shopShips.filter((item) => !(Number(item.price) > 0)).map((item) => item.id),
  [],
  "商店內船隻類道具都必須有正售價"
);
assert.deepStrictEqual(
  shopItems.filter((item) => item.rarity === "S" && item.category !== "ship").map((item) => item.id),
  [],
  "一般商店的 S 級例外只能套用於船隻類道具"
);
assert.ok(
  gameSource.includes('itemRarityLabel(item.rarity) !== "S" || item.category === "ship"'),
  "board_game.js 必須保留 S 級船隻商品例外"
);

const expectedShipPrices = {
  ship_patch_canvas: 1200,
  ship_ration_barrel: 1350,
  ship_escape_ladder: 1200,
  ship_tailwind_sail: 2400,
  ship_observer_spyglass: 2500,
  ship_reinforced_bottom_plate: 2600,
  ship_stove_upgrade: 2800,
  ship_cola_aux_engine: 4800,
  ship_coup_de_burst_port: 5000,
  ship_bird_nest_tower: 5200,
  ship_adam_sub_keel: 5600,
  ship_dream_medical_galley: 9800,
  ship_plank: 300,
  ship_toolbox: 900,
  ship_coating_resin: 2400,
  ship_adam_wood: 6000,
};

Object.entries(expectedShipPrices).forEach(([id, expected]) => {
  assert.strictEqual(itemById[id]?.price, expected, `${id} 售價應為 ${expected}`);
});

const expectedStrategicConsumablePrices = {
  fixed_step: 3800,
  odd_dice: 4800,
  even_dice: 4800,
};
Object.entries(expectedStrategicConsumablePrices).forEach(([id, expected]) => {
  assert.strictEqual(itemById[id]?.price, expected, `${id} 售價應為 ${expected}`);
  assert.ok(expected > 3000, `${id} 售價必須高於新局 3,000 貝里`);
});

assert.ok(gameSource.includes("unlockBounty: 0"), "一般商店商品必須標記為零解鎖門檻");
assert.ok(gameSource.includes('const unlockStage = "ALL"'), "一般商店庫存不得再依懸賞階段重建或鎖定");
assert.ok(!gameSource.includes("if (!itemUnlockedByBounty(player, item?.id))"), "一般商店購買流程不得檢查懸賞門檻");
assert.ok(!gameSource.includes("if (!itemUnlockedByBounty(player, item.id))"), "一般商店數量流程不得檢查懸賞門檻");

const permanentPriceFloors = {
  C: 1000,
  B: 1500,
  A: 3000,
};
const underpricedPermanentItems = items
  .filter((item) => item.category === "held" && shopIds.includes(item.id) && permanentPriceFloors[item.rarity])
  .filter((item) => Number(item.price) < permanentPriceFloors[item.rarity])
  .map((item) => ({ id: item.id, rarity: item.rarity, price: item.price }));
assert.deepStrictEqual(underpricedPermanentItems, [], "商店常駐攜帶物不得低於新的永久效果價格底線");

console.log(JSON.stringify({
  status: "PASS",
  formalItems: items.length,
  shopItems: shopItems.length,
  shipItems: ships.length,
  shopShipItems: shopShips.length,
  sRankShopItems: shopItems.filter((item) => item.rarity === "S").map((item) => item.id),
  strategicConsumablePrices: expectedStrategicConsumablePrices,
  permanentHeldPriceFloors: permanentPriceFloors,
}, null, 2));
