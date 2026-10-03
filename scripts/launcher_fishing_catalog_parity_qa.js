'use strict';

// Read-only catalogue parity check. It evaluates only the static declarations
// at the top of each renderer, without opening a room or changing player data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const server = require('../server/launcher-minigames');

const root = path.join(__dirname, '..');
const MASTER_IDS = [
  'largemouth-bass', 'warmouth', 'congo-bichir', 'paddlefish', 'alligator-gar',
  'dolphinfish', 'lionfish', 'dusky-grouper', 'goliath-grouper', 'white-marlin'
];
const RARITIES = new Set(['common', 'uncommon', 'rare', 'legendary']);
let checks = 0;
function check(actual, expected, label) {
  assert.deepEqual(actual, expected, label);
  checks++;
}
function staticDeclarations(file, startMarker, endMarker, outputExpression) {
  const source = fs.readFileSync(path.join(root, 'desktop', file), 'utf8');
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert(start >= 0 && end > start, `${file}: catalogue declarations not found`);
  return vm.runInNewContext(`${source.slice(start, end)}\n(${outputExpression})`, {}, {filename: file});
}

const client = staticDeclarations('launcher-room-minigames.js', 'const ASSET=', 'const spotArt=',
  '{labels:FISH_LABELS,rarity:FISH_RARITY_BY_ID,art:fishArt}');
const aquarium = staticDeclarations('launcher-room-aquarium.js', 'const SPECIES =', '// The cutouts',
  '{labels:SPECIES,art:fishArt}');
const species = server.FISH_SPECIES;
const ids = species.map(fish => fish.id);
const sorted = values => [...values].sort();

check(species.length, 36, 'server has 36 species');
check(new Set(ids).size, 36, 'server IDs are unique');
check(sorted(Object.keys(server.FISH_RARITY_BY_ID)), sorted(ids), 'server rarity covers every species');
check(sorted(Object.keys(client.labels)), sorted(ids), 'catch and collection labels cover server species');
check(sorted(Object.keys(client.rarity)), sorted(ids), 'catch and collection rarity covers server species');
check(sorted(Object.keys(aquarium.labels)), sorted(ids), 'aquarium labels cover server species');
check(MASTER_IDS.filter(id => ids.includes(id)).length, 10, 'ten Fishing Master IDs are present');

for (const fish of species) {
  const rarity = server.FISH_RARITY_BY_ID[fish.id];
  check(RARITIES.has(rarity), true, `${fish.id} has a valid rarity`);
  check(client.labels[fish.id], fish.label, `${fish.id} catch label`);
  check(aquarium.labels[fish.id], fish.label, `${fish.id} aquarium label`);
  check(client.rarity[fish.id], rarity, `${fish.id} rarity`);
  check(aquarium.art(fish.id), client.art(fish.id), `${fish.id} aquarium/catch art parity`);
  if (MASTER_IDS.includes(fish.id)) {
    check(client.art(fish.id),
      `opui://launcher/images/launcher_room/fish_master/${fish.id}.webp`,
      `${fish.id} new art path`);
  }
}

console.log(`launcher_fishing_catalog_parity_qa PASS ${checks} checks (36 species; ten fish_master paths)`);
