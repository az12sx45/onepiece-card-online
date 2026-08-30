const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const sourcePath = path.join(root, "public", "js", "board_game.js");
const outputPath = path.join(root, "public", "js", "board_enemy_spawn_designer_catalog.js");
const source = fs.readFileSync(sourcePath, "utf8");

function matchingIndex(text, startIndex, openChar, closeChar) {
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1] || "";
    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) quote = "";
      continue;
    }
    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === openChar) depth += 1;
    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  throw new Error(`找不到 ${openChar}${closeChar} 的結尾（起點 ${startIndex}）`);
}

function splitTopLevel(sourceText) {
  const parts = [];
  let start = 0;
  let round = 0;
  let square = 0;
  let curly = 0;
  let quote = "";
  let escaped = false;
  for (let index = 0; index < sourceText.length; index += 1) {
    const char = sourceText[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === "\"" || char === "'" || char === "`") {
      quote = char;
      continue;
    }
    if (char === "(") round += 1;
    else if (char === ")") round -= 1;
    else if (char === "[") square += 1;
    else if (char === "]") square -= 1;
    else if (char === "{") curly += 1;
    else if (char === "}") curly -= 1;
    else if (char === "," && round === 0 && square === 0 && curly === 0) {
      parts.push(sourceText.slice(start, index).trim());
      start = index + 1;
    }
  }
  parts.push(sourceText.slice(start).trim());
  return parts;
}

function parseQuoted(value, label) {
  const text = String(value || "").trim();
  if (!text.startsWith("\"") || !text.endsWith("\"")) {
    throw new Error(`${label} 不是可解析的雙引號字串：${text.slice(0, 80)}`);
  }
  return JSON.parse(text);
}

function statValue(statsSource, key) {
  const match = String(statsSource || "").match(new RegExp(`(?:^|[,\\s{])${key}\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`));
  return match ? Number(match[1]) : null;
}

const marker = "const ENEMY_POOLS =";
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error("找不到 ENEMY_POOLS");
const blockStart = source.indexOf("{", markerIndex + marker.length);
const blockEnd = matchingIndex(source, blockStart, "{", "}");
const poolSource = source.slice(blockStart, blockEnd + 1);

const tierRank = { T5: "D", T4: "C", T3: "B", T2: "A", T1: "S" };
const enemies = [];

function objectStringValue(objectSource, key, label) {
  const match = String(objectSource || "").match(new RegExp(`(?:^|[,\\s{])${key}\\s*:\\s*(\"(?:\\\\.|[^\"])*\")`));
  if (!match) throw new Error(`${label} 找不到 ${key}`);
  return JSON.parse(match[1]);
}

function appendObjectProfile(objectSource, sourceGroup) {
  const key = objectStringValue(objectSource, "key", sourceGroup);
  const name = objectStringValue(objectSource, "name", key);
  const tier = objectStringValue(objectSource, "tier", key);
  const attribute = objectStringValue(objectSource, "attribute", key);
  const role = objectStringValue(objectSource, "role", key);
  const portraitKey = key === "lucci" ? "rob_lucci" : key;
  enemies.push({
    key,
    name,
    tier,
    rank: tierRank[tier] || tier,
    attribute,
    role,
    baseHp: statValue(objectSource, "maxHp"),
    baseAtk: statValue(objectSource, "atk"),
    baseDef: statValue(objectSource, "def"),
    baseSpd: statValue(objectSource, "spd"),
    portrait: `images/board/battle/enemies/${portraitKey}/normal.webp`,
    fallbackPortrait: `images/board/enemies/${portraitKey}_idle.webp`,
    availability: "second_playthrough",
    unlockCondition: "game.postgameWorld.unlocked === true",
    sourceGroup,
  });
}

let searchIndex = 0;
while (searchIndex < poolSource.length) {
  const callIndex = poolSource.indexOf("enemyProfile(", searchIndex);
  if (callIndex < 0) break;
  const argsStart = poolSource.indexOf("(", callIndex);
  const argsEnd = matchingIndex(poolSource, argsStart, "(", ")");
  const args = splitTopLevel(poolSource.slice(argsStart + 1, argsEnd));
  searchIndex = argsEnd + 1;
  if (args.length < 6 || args[0].startsWith("{")) continue;
  const key = parseQuoted(args[0], "敵人 key");
  const name = parseQuoted(args[1], `${key} name`);
  const tier = parseQuoted(args[2], `${key} tier`);
  const attribute = parseQuoted(args[4], `${key} attribute`);
  const role = parseQuoted(args[5], `${key} role`);
  const portraitKey = key === "lucci" ? "rob_lucci" : key;
  enemies.push({
    key,
    name,
    tier,
    rank: tierRank[tier] || tier,
    attribute,
    role,
    baseHp: statValue(args[3], "hp"),
    baseAtk: statValue(args[3], "atk"),
    baseDef: statValue(args[3], "def"),
    baseSpd: statValue(args[3], "spd"),
    portrait: `images/board/battle/enemies/${portraitKey}/normal.webp`,
    fallbackPortrait: `images/board/enemies/${portraitKey}_idle.webp`,
    availability: "always",
    unlockCondition: "always",
    sourceGroup: "general_enemy_pool",
  });
}

const finalGateMarker = "const FINAL_GATE_ENEMY_PROFILE = enemyProfile(";
const finalGateIndex = source.indexOf(finalGateMarker);
if (finalGateIndex < 0) throw new Error("找不到 FINAL_GATE_ENEMY_PROFILE");
const finalGateArgsStart = source.indexOf("(", finalGateIndex);
const finalGateArgsEnd = matchingIndex(source, finalGateArgsStart, "(", ")");
const finalGateArgs = splitTopLevel(source.slice(finalGateArgsStart + 1, finalGateArgsEnd));
appendObjectProfile(finalGateArgs[0], "final_gate_imu");

const godKnightMarker = "const ELBAPH_GOD_KNIGHT_PROFILES =";
const godKnightIndex = source.indexOf(godKnightMarker);
if (godKnightIndex < 0) throw new Error("找不到 ELBAPH_GOD_KNIGHT_PROFILES");
const godKnightBlockStart = source.indexOf("{", godKnightIndex + godKnightMarker.length);
const godKnightBlockEnd = matchingIndex(source, godKnightBlockStart, "{", "}");
const godKnightSource = source.slice(godKnightBlockStart, godKnightBlockEnd + 1);
let godKnightSearchIndex = 0;
while (godKnightSearchIndex < godKnightSource.length) {
  const callIndex = godKnightSource.indexOf("enemyProfile(", godKnightSearchIndex);
  if (callIndex < 0) break;
  const argsStart = godKnightSource.indexOf("(", callIndex);
  const argsEnd = matchingIndex(godKnightSource, argsStart, "(", ")");
  const args = splitTopLevel(godKnightSource.slice(argsStart + 1, argsEnd));
  godKnightSearchIndex = argsEnd + 1;
  appendObjectProfile(args[0], "elbaph_god_knights");
}

if (!enemies.length) throw new Error("ENEMY_POOLS 未解析出任何敵人");
const duplicateKeys = enemies.filter((entry, index) => enemies.findIndex((candidate) => candidate.key === entry.key) !== index);
if (duplicateKeys.length) throw new Error(`敵人 key 重複：${duplicateKeys.map((entry) => entry.key).join(", ")}`);

const secondPlaythroughCount = enemies.filter((entry) => entry.availability === "second_playthrough").length;
const sourceHash = crypto.createHash("sha256")
  .update(poolSource)
  .update(source.slice(finalGateIndex, finalGateArgsEnd + 1))
  .update(godKnightSource)
  .digest("hex");
const payload = {
  schemaVersion: 1,
  source: "public/js/board_game.js::ENEMY_POOLS+FINAL_GATE_ENEMY_PROFILE+ELBAPH_GOD_KNIGHT_PROFILES",
  sourceHash,
  enemyCount: enemies.length,
  alwaysAvailableCount: enemies.length - secondPlaythroughCount,
  secondPlaythroughCount,
  enemies,
};
const output = `// 此檔由 scripts/build_enemy_spawn_designer_catalog.js 依正式一般敵人池與二周目限定名單產生。\nwindow.BoardEnemySpawnDesignerCatalog = Object.freeze(${JSON.stringify(payload, null, 2)});\n`;
fs.writeFileSync(outputPath, output, "utf8");
console.log(`已輸出 ${enemies.length} 名敵人：${outputPath}`);
