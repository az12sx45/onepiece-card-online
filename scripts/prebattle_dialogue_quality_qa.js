const fs = require("fs");
const vm = require("vm");

global.window = {};
vm.runInThisContext(fs.readFileSync("public/js/onepiece_prebattle_lines.js", "utf8"), {
  filename: "public/js/onepiece_prebattle_lines.js",
});

const data = window.OnePiecePrebattleLines || { heroLines: {}, enemyLines: {}, pairLines: [] };
const boardGameSource = fs.readFileSync("public/js/board_game.js", "utf8");
const systemPattern = /(上場|出戰|迎戰|登場|參戰|應戰|派出|輪到你|準備戰鬥|戰鬥開始|放馬過來)/;
const expositionPattern = /(超越這份見聞色|血統因子的完成形|覺醒之後|火焰熄滅前|每回合|第[一二三四五六0-9]+顆|命中率|閃避率|血量|HP|骰子|傷害[+＋\-－])/i;
const expectedExpandedEnemies = [
  "紅髮香克斯", "黑鬍子", "大媽", "凱多", "伊姆", "麒麟格姆", "索瑪茲",
  "金獅子史基", "吉爾德・泰佐洛", "澤法", "Tot Musica", "道格拉斯・巴雷特",
  "薩卡／七星劍", "文斯莫克・伽治", "覺醒羅布・路基", "KING", "夏洛特・卡塔庫栗",
  "帕特里克・雷德菲爾德", "洛基", "綠牛／荒牧", "洛克斯・D・吉貝克", "魔人歐斯",
];
const expectedSpecialPairs = [
  ["蒙其·D·魯夫", "紅髮香克斯"],
  ["蒙其·D·魯夫", "黑鬍子"],
  ["五檔・尼卡", "凱多"],
  ["大和", "凱多"],
  ["五檔・尼卡", "夏洛特・卡塔庫栗"],
  ["索隆", "KING"],
  ["司法島索隆", "KING"],
  ["新世界索隆", "KING"],
  ["香吉士", "文斯莫克・伽治"],
  ["司法島香吉士", "文斯莫克・伽治"],
  ["新世界香吉士", "文斯莫克・伽治"],
  ["烏塔", "Tot Musica"],
  ["哥爾·D·羅傑", "洛克斯・D・吉貝克"],
  ["年輕羅傑", "洛克斯・D・吉貝克"],
  ["愛德華·紐蓋特", "洛克斯・D・吉貝克"],
  ["蒙其·D·卡普", "洛克斯・D・吉貝克"],
  ["波特卡斯·D·艾斯", "黑鬍子"],
  ["白鬍子", "黑鬍子"],
  ["愛德華·紐蓋特", "黑鬍子"],
  ["新世界 羅", "黑鬍子"],
  ["蒙其·D·魯夫", "道格拉斯・巴雷特"],
  ["蒙其·D·魯夫", "吉爾德・泰佐洛"],
  ["蒙其·D·魯夫", "金獅子史基"],
  ["蒙其·D·魯夫", "魔人歐斯"],
  ["五檔・尼卡", "覺醒羅布・路基"],
];
const errors = [];
const badLines = [];
const expositionLines = [];
const longLines = [];

function inspectLine(scope, key, text) {
  const value = String(text || "").trim();
  if (!value) errors.push(`${scope} ${key}: empty dialogue`);
  if (systemPattern.test(value)) badLines.push({ scope, key, text: value });
  if (expositionPattern.test(value)) expositionLines.push({ scope, key, text: value });
  if ([...value].length > 30) longLines.push({ scope, key, length: [...value].length, text: value });
}

Object.entries(data.heroLines || {}).forEach(([key, lines]) => {
  (lines || []).forEach((line, index) => inspectLine("heroPool", `${key}#${index + 1}`, line?.text));
});
Object.entries(data.enemyLines || {}).forEach(([key, lines]) => {
  (lines || []).forEach((line, index) => inspectLine("enemyPool", `${key}#${index + 1}`, line?.text));
});
(data.pairLines || []).forEach((pair, index) => {
  inspectLine("pairHero", `${index}:${pair.hero} vs ${pair.enemy}`, pair.heroText);
  inspectLine("pairEnemy", `${index}:${pair.hero} vs ${pair.enemy}`, pair.enemyText);
});

expectedExpandedEnemies.forEach((enemy) => {
  const lines = data.enemyLines?.[enemy];
  if (!Array.isArray(lines) || lines.length < 2) errors.push(`${enemy}: expanded enemy lines missing`);
});
expectedSpecialPairs.forEach(([hero, enemy]) => {
  if (!(data.pairLines || []).some((pair) => pair.hero === hero && pair.enemy === enemy)) {
    errors.push(`${hero} vs ${enemy}: special pair missing`);
  }
});

const pairHeroKeys = [...new Set((data.pairLines || []).map((pair) => pair.hero).filter(Boolean))];
pairHeroKeys.forEach((hero) => {
  const poolHasNaturalLine = (data.heroLines?.[hero] || []).some((line) => line?.text && !systemPattern.test(line.text));
  const pairHasNaturalLine = (data.pairLines || []).some((pair) => pair.hero === hero && pair.heroText && !systemPattern.test(pair.heroText));
  if (!poolHasNaturalLine && !pairHasNaturalLine) errors.push(`${hero}: no natural fallback line`);
});

if (badLines.length) errors.push(`system-style dialogue remains: ${badLines.length}`);
if (expositionLines.length) errors.push(`mechanic/exposition-style dialogue remains: ${expositionLines.length}`);
if (longLines.length) errors.push(`dialogue longer than 30 characters: ${longLines.length}`);
if (boardGameSource.includes('${activeCard?.name || player?.name || "夥伴"} 上場。')) errors.push("old hero fallback remains in board_game.js");
if (boardGameSource.includes('${enemy.name || "敵人"} 迎戰。')) errors.push("old enemy fallback remains in board_game.js");

const report = {
  ok: errors.length === 0,
  errors,
  heroPools: Object.keys(data.heroLines || {}).length,
  enemyPools: Object.keys(data.enemyLines || {}).length,
  pairLines: (data.pairLines || []).length,
  expandedEnemies: expectedExpandedEnemies.length,
  specialPairsChecked: expectedSpecialPairs.length,
  pairHeroKeys: pairHeroKeys.length,
  badLines,
  expositionLines,
  longLines,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
