const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const itemSource = path.join(root, "public", "js", "board_items.js");
const gameSourcePath = path.join(root, "public", "js", "board_game.js");
const outputPath = path.join(root, "docs", "ITEM_CATALOG.md");
const window = {};
vm.runInNewContext(fs.readFileSync(itemSource, "utf8"), { window });

const gameSource = fs.readFileSync(gameSourcePath, "utf8");
function extractConstLiteral(name, nextName) {
  const startToken = `const ${name} =`;
  const endToken = nextName.startsWith("Object.") ? nextName : `const ${nextName} =`;
  const start = gameSource.indexOf(startToken);
  const end = gameSource.indexOf(endToken, start + startToken.length);
  if (start < 0 || end < 0) throw new Error(`Unable to extract ${name} from board_game.js`);
  const literal = gameSource.slice(start + startToken.length, end).trim().replace(/;\s*$/, "");
  return vm.runInNewContext(`(${literal})`);
}

const legacyCarryDefs = extractConstLiteral("BATTLE_CARRY_ITEM_DEFS", "BATTLE_CARRY_ITEM_ORDER");
const legacyCarryOrder = extractConstLiteral("BATTLE_CARRY_ITEM_ORDER", "BATTLE_CARRY_ITEM_DROP_STRENGTH");
const legacyCarryLootTable = extractConstLiteral("BATTLE_CARRY_ENEMY_LOOT_TABLE", "Object.values(GAME_ITEMS).forEach");
const formalItems = Object.values(window.GAME_ITEMS || {});
const formalIds = new Set(formalItems.map((item) => item.id));
const legacyCarryItems = Object.values(legacyCarryDefs)
  .filter((item) => !formalIds.has(item.id))
  .map((item) => ({
    id: item.id,
    name: item.name,
    category: "held",
    rarity: item.rarity,
    uiSummary: item.summary,
    effect: item.effect || {},
    legacyCarry: true,
  }));
const items = [...formalItems, ...legacyCarryItems];
const legacyCarryDropIds = new Set(legacyCarryOrder);
const shops = window.ITEM_SHOPS || {};
const eventPools = window.ITEM_EVENT_POOLS || {};
const dropPools = window.ITEM_DROP_POOLS || {};
const categoryLabels = window.ITEM_CATEGORY_LABELS || {};

const categoryOrder = ["navigation", "battle", "ship", "held", "key"];
const eventPoolLabels = {
  basic_supply_pool: "海上事件・基礎補給池",
  advanced_supply_pool: "海上事件・進階補給池",
  elite_supply_pool: "海上事件・菁英補給池",
  safe_sea_pool: "安全海域事件池",
  mid_sea_pool: "中段海域事件池",
  danger_sea_pool: "危險海域事件池",
  weather_pool: "天候事件池",
  treasure_pool: "寶藏事件池",
  heal_pool: "治療事件池",
  training_pool: "修行事件池",
  sky_pool: "空島事件池",
  ship_material_pool: "船材事件池",
  rare_pool: "稀有事件池",
};
const bossRelics = {
  shiki_oto_kogarashi: "史基",
  tesoro_gran_tesoro_gold_rings: "泰佐洛",
  zephyr_battle_smasher: "澤法",
  tot_musica_demon_score: "Tot Musica",
  bullet_large_bullet_armor: "巴雷特",
  saga_seven_star_sword: "薩卡",
  judge_germa66_battle_suit: "伽治",
  lucci_awakened_black_flame_hagoromo: "覺醒路基",
  king_sword: "KING",
  enma: "KING（額外獨立判定）",
  katakuri_mogura: "卡塔庫栗",
  redfield_umbrella_sword: "雷德菲爾德",
  loki_ragnir: "洛基",
  oars_giant_belt: "魔人歐斯",
  green_bull_life_seed: "綠牛",
  rocks_eclipse_sword: "洛克斯",
};
const specialSources = {
  devon_kyubi_mask: "首次擊敗四皇黑鬍子時取得（每位玩家限領一次）",
  griffon_sword: "首次擊敗四皇香克斯時取得（每位玩家限領一次）",
  fearless_heart: "首次擊敗四皇凱多時取得（每位玩家限領一次）",
  sun_pirates_badge: "首次擊敗四皇大媽時取得（每位玩家限領一次）",
  road_poneglyph: "舊版存檔相容用通用拓本；現行流程改由四皇方向拓本取代",
  road_poneglyph_east: "首次擊敗四皇香克斯時取得",
  road_poneglyph_west: "首次擊敗四皇大媽時取得",
  road_poneglyph_south: "首次擊敗四皇凱多時取得",
  road_poneglyph_north: "首次擊敗四皇黑鬍子時取得",
  dawn_paw_route_pass: "主線任務「世界最大宴會」完成最終結局後取得",
  sea_train_golden_ticket: "打開司法島通關寶箱後四選一",
  judicial_clear_chest: "完成司法島連戰後取得",
  pierced_flag: "打開司法島通關寶箱後四選一",
  seastone_handcuffs: "打開司法島通關寶箱後四選一",
  going_merry_rescue: "打開司法島通關寶箱後四選一",
  new_world_newspaper_3d2y: "完成頂上戰爭並救出處刑台角色後取得",
  prime_vivre_card: "S 級任務「舊時代殘響」獎勵",
  lineage_extractor_standard: "研究所解鎖後永久販售",
  lineage_extractor_precision: "研究等級 2 後於研究所販售；亦可由研究委託／高階寶箱取得",
  lineage_extractor_resonance_power: "研究等級 3 後於研究所販售；亦可由研究委託／高階寶箱取得",
  lineage_extractor_resonance_skill: "研究等級 3 後於研究所販售；亦可由研究委託／高階寶箱取得",
  lineage_extractor_resonance_speed: "研究等級 3 後於研究所販售；亦可由研究委託／高階寶箱取得",
  lineage_extractor_ability: "研究等級 3 後於研究所販售；亦可由研究委託／寶石寶箱取得",
  lineage_extractor_emperor: "研究等級 4 後於研究所重複製作",
  perfect_lineage_core: "第 10 階段洛克斯戰勝利獎勵",
};

function has(pool, id) {
  return Array.isArray(pool) && pool.includes(id);
}

function acquisition(item) {
  const sources = [];
  Object.entries(shops).forEach(([shopId, ids]) => {
    if (has(ids, item.id)) sources.push(shopId === "item_shop" ? "一般道具商店" : `商店：${shopId}`);
  });
  Object.entries(eventPools).forEach(([poolId, ids]) => {
    if (has(ids, item.id)) sources.push(eventPoolLabels[poolId] || `海上事件：${poolId}`);
  });
  if (has(dropPools.common_enemy_drop_pool, item.id)) sources.push("一般敵人掉落池");
  if (has(dropPools.devil_fruit_user_extra_drop_pool, item.id)) sources.push("能力者敵人額外掉落池");
  if (legacyCarryDropIds.has(item.id)) {
    const tierRates = ["T5", "T4", "T3", "T2", "T1"].map((tier) => `${Math.round(Number(legacyCarryLootTable[tier]?.chance || 0) * 100)}%`).join("／");
    sources.push(`一般／海格戰鬥勝利的角色攜帶物掉落（T5～T1 基礎判定 ${tierRates}；海格 +10%、能力者 +6%，成功後依稀有度權重抽取）`);
  }
  if (bossRelics[item.id]) {
    sources.push(item.id === "rocks_eclipse_sword"
      ? `擊敗${bossRelics[item.id]}：依約克解碼器階級 10%／20%／30%／40% 獨立判定`
      : item.id === "enma"
        ? "擊敗 KING：每位實際參戰者固定 10% 額外獨立判定，不取代 KING 的佩刀"
        : `擊敗${bossRelics[item.id]}：每位實際參戰者固定 10% 獨立判定`);
  }
  if (/^york_clue_\d+_/.test(item.id)) sources.push("擊敗該線索對應的無風帶孤島 Boss（所有實際參戰者必得）");
  if (/^york_coordinate_decoder_t[123]$/.test(item.id)) sources.push(`完成約克 13 張線索座標拼圖的${item.id.endsWith("t1") ? "一階" : item.id.endsWith("t2") ? "二階" : "三階"}難度`);
  if (specialSources[item.id]) sources.push(specialSources[item.id]);
  return [...new Set(sources)].join("；") || "目前未接入一般商店、事件池、敵人掉落或明確獎勵流程";
}

function price(item) {
  if (has(shops.item_shop, item.id)) return `一般道具商店 ${Number(item.price || 0).toLocaleString("en-US")} B`;
  if (/^lineage_extractor_/.test(item.id)) {
    if (item.id === "lineage_extractor_emperor") return "研究所製作 10,000 B＋120 研究點";
    return `研究所 ${Number(item.price || 0).toLocaleString("en-US")} B`;
  }
  return "—（不可於商店購買）";
}

function clean(text) {
  return String(text || "").replace(/\|/g, "／").replace(/\r?\n/g, " ").trim();
}

const counts = Object.fromEntries(categoryOrder.map((category) => [category, items.filter((item) => item.category === category).length]));
const generalShopItems = items.filter((item) => has(shops.item_shop, item.id));
const shipShopItems = generalShopItems.filter((item) => item.category === "ship");
const lines = [
  "# Board 遊戲全道具清單",
  "",
  `> 由 \`public/js/board_items.js\` 與 \`public/js/board_game.js\` 的現行道具／角色攜帶物資料自動產生；共 ${items.length} 件。取得方式以正式商店清單、事件池、兩套敵人掉落流程與現行特殊獎勵交叉整理。更新日期：2026-08-27。`,
  "",
  "## 類型統計",
  "",
  "| 類型 | 件數 |",
  "| --- | ---: |",
  ...categoryOrder.map((category) => `| ${categoryLabels[category] || category} | ${counts[category]} |`),
  `| **合計** | **${items.length}** |`,
  "",
  `價格欄只列玩家實際可使用的購買／製作價格；Boss、任務、事件與掉落限定品標為不可購買。取得方式同時列出所有已接上的來源。目前一般道具商店共 ${generalShopItems.length} 件商品，${shipShopItems.length} 件船隻道具皆可購買。`,
  "",
];

categoryOrder.forEach((category) => {
  lines.push(`## ${categoryLabels[category] || category}（${counts[category]}）`, "", "| 名稱 | ID | 稀有度 | 效果摘要 | 取得方式 | 商店價格 |", "| --- | --- | :---: | --- | --- | --- |");
  items.filter((item) => item.category === category).forEach((item) => {
    lines.push(`| ${clean(item.name)} | \`${clean(item.id)}\` | ${clean(item.rarity || "C")} | ${clean(item.uiSummary || item.description || "—")} | ${clean(acquisition(item))} | ${clean(price(item))} |`);
  });
  lines.push("");
});

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${lines.join("\n")}\n`, "utf8");

const idsInCatalog = [...fs.readFileSync(outputPath, "utf8").matchAll(/\| `([^`]+)` \|/g)].map((match) => match[1]);
const duplicateIds = idsInCatalog.filter((id, index) => idsInCatalog.indexOf(id) !== index);
const missingIds = items.map((item) => item.id).filter((id) => !idsInCatalog.includes(id));
const emptyAcquisition = items.filter((item) => !acquisition(item));
const shopWithoutPrice = items.filter((item) => has(shops.item_shop, item.id) && !(Number(item.price || 0) > 0));
if (idsInCatalog.length !== items.length || duplicateIds.length || missingIds.length || emptyAcquisition.length || shopWithoutPrice.length) {
  throw new Error(JSON.stringify({ catalog: idsInCatalog.length, items: items.length, duplicateIds, missingIds, emptyAcquisition: emptyAcquisition.map((item) => item.id), shopWithoutPrice: shopWithoutPrice.map((item) => item.id) }, null, 2));
}
console.log(JSON.stringify({ outputPath, total: items.length, formalItems: formalItems.length, legacyCarryItems: legacyCarryItems.length, counts, generalShopItems: generalShopItems.length, shipShopItems: shipShopItems.length }, null, 2));
