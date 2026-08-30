const fs = require("fs");
const vm = require("vm");

function loadWindowScript(path) {
  const sandbox = { window: {}, console };
  sandbox.globalThis = sandbox.window;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path, "utf8"), sandbox, { filename: path });
  return sandbox.window;
}

function extractObject(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*(\\{[\\s\\S]*?\\n\\s*\\});`));
  if (!match) return {};
  return vm.runInNewContext(`(${match[1]})`);
}

function extractSet(source, name) {
  const match = source.match(new RegExp(`const\\s+${name}\\s*=\\s*new Set\\((\\[[\\s\\S]*?\\])\\);`));
  if (!match) return new Set();
  return new Set(vm.runInNewContext(match[1]));
}

function compactKey(value) {
  return String(value || "")
    .trim()
    .replace(/[·・．.]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

function poolKey(pool, value, aliases = {}) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  if (aliases[raw]) return aliases[raw];
  if (pool?.[raw]) return raw;
  const compact = compactKey(raw);
  if (aliases[compact]) return aliases[compact];
  const matched = Object.keys(pool || {}).find((key) => compactKey(key) === compact);
  return matched || raw;
}

function lineText(entry, fallback) {
  const text = String(entry?.text || "").trim();
  return text && text !== "—" ? text : fallback;
}

function genericLines(lines, fallback) {
  const entries = Array.isArray(lines) ? lines.filter((entry) => lineText(entry, "")) : [];
  if (!entries.length) {
    return { text: fallback, meta: "系統備用", confidence: "低", source: "無，系統備用", note: "" };
  }
  const battleReady = entries.filter((entry) => ["口吻改寫", "通用嗆聲"].includes(entry.type));
  const pool = battleReady.length ? battleReady : entries;
  return {
    text: pool.map((entry) => lineText(entry, "")).filter(Boolean).join(" / "),
    meta: battleReady.length ? "通用池：口吻改寫 / 通用嗆聲" : "通用池：全部候選",
    confidence: [...new Set(pool.map((entry) => entry.confidence || "").filter(Boolean))].join("；"),
    source: [...new Set(pool.map((entry) => entry.source || "").filter(Boolean))].join("；"),
    note: [...new Set(pool.map((entry) => entry.note || "").filter(Boolean))].join("；"),
  };
}

function tsv(value) {
  return String(value ?? "").replace(/\r?\n/g, " ").replace(/\t/g, "    ");
}

const lineWindow = loadWindowScript("public/js/onepiece_prebattle_lines.js");
const cardWindow = loadWindowScript("public/js/board_cards.js");
const data = lineWindow.OnePiecePrebattleLines || { heroLines: {}, enemyLines: {}, pairLines: [] };
const cards = cardWindow.BoardCards || { cards: [], evolutionForms: {} };
const gameSource = fs.readFileSync("public/js/board_game.js", "utf8");
const heroById = extractObject(gameSource, "PREBATTLE_HERO_KEY_BY_ID");
const heroByName = extractObject(gameSource, "PREBATTLE_HERO_KEY_BY_NAME");
const enemyById = extractObject(gameSource, "PREBATTLE_ENEMY_KEY_BY_ID");
const eniesIds = extractSet(gameSource, "PREBATTLE_ENIES_LOBBY_ENEMY_KEYS");
const impelIds = extractSet(gameSource, "PREBATTLE_IMPEL_DOWN_ENEMY_KEYS");
const marineIds = extractSet(gameSource, "PREBATTLE_MARINE_ENEMY_KEYS");

const forms = [];
(cards.cards || []).forEach((card) => {
  forms.push({ stage: "原角色", id: card.id || "", name: card.name || "", sourceKey: card.id || "" });
});
Object.values(cards.evolutionForms || {}).forEach((form) => {
  forms.push({
    stage: `進化${form.evolutionStage || ""}`.trim(),
    id: form.id || "",
    name: form.name || "",
    sourceKey: form.baseId || form.id || "",
  });
});
forms.sort((a, b) => a.name.localeCompare(b.name, "zh-Hant") || a.id.localeCompare(b.id));

const enemyIdsByKey = new Map();
Object.entries(enemyById).forEach(([id, key]) => {
  if (!enemyIdsByKey.has(key)) enemyIdsByKey.set(key, []);
  enemyIdsByKey.get(key).push(id);
});
Object.keys(data.enemyLines || {}).forEach((key) => {
  if (!enemyIdsByKey.has(key)) enemyIdsByKey.set(key, []);
});
const enemies = [...enemyIdsByKey.entries()]
  .map(([key, ids]) => ({ key, ids }))
  .sort((a, b) => a.key.localeCompare(b.key, "zh-Hant"));

function heroDialogueKey(form) {
  const pairHeroKeyExists = (key) => !!key && Array.isArray(data.pairLines) && data.pairLines.some((pair) => pair?.hero === key);
  const heroKeyExists = (key) => !!key && (!!data.heroLines?.[key] || pairHeroKeyExists(key));
  if (form.name && pairHeroKeyExists(form.name)) return form.name;
  const idKey = heroById[form.id] || heroById[form.sourceKey];
  if (idKey && heroKeyExists(idKey)) return idKey;
  if (form.name && heroKeyExists(form.name)) return form.name;
  return poolKey(data.heroLines, form.name, heroByName);
}

function enemyCategories(enemy) {
  const categories = [];
  if (enemy.ids.some((id) => eniesIds.has(id))) categories.push("司法島敵人");
  if (
    enemy.ids.some((id) => impelIds.has(id))
    || ["小莎蒂", "米諾吉娃娃", "米諾無尾熊", "米諾陶爾", "米諾犀牛", "般若拔", "麥哲倫"].includes(enemy.key)
  ) {
    categories.push("推進城敵人");
  }
  if (enemy.ids.some((id) => marineIds.has(id)) || ["蒙卡", "戰桃丸", "赤犬", "青雉", "黃猿"].includes(enemy.key)) {
    categories.push("海軍敵人");
  }
  return categories;
}

function findPair(heroKey, enemy) {
  const categories = enemyCategories(enemy);
  const candidates = [enemy.key, ...categories].filter(Boolean);
  const pair = (data.pairLines || []).find((entry) => entry?.hero === heroKey && candidates.includes(entry.enemy));
  if (!pair) return { pair: null, categories, pairType: "通用", pairKey: "" };
  return {
    pair,
    categories,
    pairType: pair.enemy === enemy.key ? "專屬配對" : `分類配對：${pair.enemy}`,
    pairKey: pair.enemy || "",
  };
}

const header = [
  "角色ID",
  "角色/形態名稱",
  "角色階段",
  "目前對話角色key",
  "角色key狀態",
  "敵人ID",
  "敵人名稱",
  "敵人分類",
  "敵人key狀態",
  "配對類型",
  "套用配對key",
  "第一發話",
  "目前角色句",
  "目前敵人句",
  "信心",
  "來源",
  "備註",
  "GPT新版角色句",
  "GPT新版敵人句",
  "GPT備註",
];
const rows = [header];
let exactCount = 0;
let categoryCount = 0;
let fallbackHeroCount = 0;
let fallbackEnemyCount = 0;

for (const form of forms) {
  const heroKey = heroDialogueKey(form);
  const hasHeroLines = Boolean(data.heroLines?.[heroKey]);
  if (!hasHeroLines) fallbackHeroCount += enemies.length;
  for (const enemy of enemies) {
    const hasEnemyLines = Boolean(data.enemyLines?.[enemy.key]);
    if (!hasEnemyLines) fallbackEnemyCount += 1;
    const pairInfo = findPair(heroKey, enemy);
    const pair = pairInfo.pair;
    let heroText;
    let enemyText;
    let confidence;
    let source;
    let note;
    let firstSpeaker = "角色";
    if (pair) {
      if (pairInfo.pairType === "專屬配對") exactCount += 1;
      else categoryCount += 1;
      heroText = pair.heroText || "";
      enemyText = pair.enemyText || "";
      confidence = pair.confidence || "";
      source = pair.source || "";
      note = pair.note || "";
      const order = String(pair.firstSpeaker || pair.speakerFirst || pair.order || "").trim().toLowerCase();
      firstSpeaker = ["enemy", "enemy-first", "敵方", "敵人"].includes(order) ? "敵人" : "角色";
    } else {
      const heroGeneric = genericLines(data.heroLines?.[heroKey], `${form.name || "夥伴"} 上場。`);
      const enemyGeneric = genericLines(data.enemyLines?.[enemy.key], `${enemy.key || "敵人"} 迎戰。`);
      heroText = heroGeneric.text;
      enemyText = enemyGeneric.text;
      confidence = [heroGeneric.confidence, enemyGeneric.confidence].filter(Boolean).join(" | ");
      source = [heroGeneric.source, enemyGeneric.source].filter(Boolean).join(" | ");
      note = [heroGeneric.meta, heroGeneric.note, enemyGeneric.meta, enemyGeneric.note].filter(Boolean).join(" | ");
    }
    rows.push([
      form.id,
      form.name,
      form.stage,
      heroKey,
      hasHeroLines ? "已有角色句" : "缺角色句：目前走備用句",
      enemy.ids.join(","),
      enemy.key,
      pairInfo.categories.join("、") || "一般敵人",
      hasEnemyLines ? "已有敵人句" : "缺敵人句：目前走備用句",
      pairInfo.pairType,
      pairInfo.pairKey,
      firstSpeaker,
      heroText,
      enemyText,
      confidence,
      source,
      note,
      "",
      "",
      "",
    ].map(tsv));
  }
}

const output = `\uFEFF${rows.map((row) => row.join("\t")).join("\r\n")}\r\n`;
fs.writeFileSync("prebattle_dialogue_redesign_list.tsv", output, "utf8");
console.log(JSON.stringify({
  file: "prebattle_dialogue_redesign_list.tsv",
  forms: forms.length,
  enemies: enemies.length,
  rows: rows.length - 1,
  exactCount,
  categoryCount,
  fallbackHeroCount,
  fallbackEnemyCount,
  heroLineKeys: Object.keys(data.heroLines || {}).length,
  enemyLineKeys: Object.keys(data.enemyLines || {}).length,
  pairLineEntries: (data.pairLines || []).length,
}, null, 2));
