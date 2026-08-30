const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const cardsPath = path.join(root, "public", "js", "board_cards.js");
global.window = {};
vm.runInThisContext(fs.readFileSync(cardsPath, "utf8"), { filename: cardsPath });

const cards = window.BoardCards?.cards || [];
const byId = new Map(cards.map((card) => [card.id, card]));
const expectedChangedTiers = {
  sabo: "T1",
  rayleigh: "T1",
  custom_mp3l6s8w: "T3",
  usopp: "T4",
  nami: "T6",
  mansherry: "T6",
  perona: "T6",
};

const openingExcludedIds = new Set([
  "whitebeard", "ace", "marco", "jozu", "vista", "izo", "little_oars_jr", "squard",
  "prison_buggy", "prison_mr3", "prison_mr2_bon_clay", "prison_mr1_daz_bones", "prison_crocodile",
  "corazon", "oden", "custom_mp3la6fr",
]);
const expectedOpeningCounts = { T1: 6, T2: 8, T3: 5, T4: 5, T5: 6, T6: 5 };
const errors = [];

Object.entries(expectedChangedTiers).forEach(([id, tier]) => {
  const actual = byId.get(id)?.tier;
  if (actual !== tier) errors.push(`${id}: expected ${tier}, got ${actual || "missing"}`);
});

const openingCards = cards.filter((card) => !openingExcludedIds.has(card.id));
const openingCounts = Object.fromEntries(
  Object.keys(expectedOpeningCounts).map((tier) => [tier, openingCards.filter((card) => card.tier === tier).length])
);
Object.entries(expectedOpeningCounts).forEach(([tier, count]) => {
  if (openingCounts[tier] !== count) errors.push(`${tier}: expected ${count}, got ${openingCounts[tier]}`);
});
if (openingCards.length !== 35) errors.push(`opening total: expected 35, got ${openingCards.length}`);

const report = {
  ok: errors.length === 0,
  errors,
  openingTotal: openingCards.length,
  openingCounts,
  changedTiers: Object.fromEntries(Object.keys(expectedChangedTiers).map((id) => [id, byId.get(id)?.tier || "missing"])),
};
console.log(JSON.stringify(report, null, 2));
if (errors.length) process.exitCode = 1;
