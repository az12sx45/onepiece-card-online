'use strict';

// Run with --require-art after the signed fish_master artwork is available.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const expectedNew = Object.freeze({
  'largemouth-bass': '大嘴鱸魚',
  warmouth: '暖口太陽魚',
  'congo-bichir': '剛果多鰭魚',
  paddlefish: '匙吻鱘',
  'alligator-gar': '鱷雀鱔',
  dolphinfish: '鯕鰍',
  lionfish: '獅子魚',
  'dusky-grouper': '褐石斑魚',
  'goliath-grouper': '巨型石斑魚',
  'white-marlin': '白馬林魚'
});
const existing = [
  'balloon-catfish', 'panda-shark', 'glistening-saury', 'smile-jellyfish',
  'butterflyfish', 'adventure-fish', 'cola-sunfish', 'reef-shark',
  'elephant-tuna', 'lovely-angel', 'striped-clam', 'cutie-piranha',
  'claw-shrimp', 'pumpkin-octopus', 'maple-salmon', 'lava-flounder',
  'treasure-pearl-clam', 'electric-catfish', 'demon-bonito',
  'guiding-anglerfish', 'ice-fish', 'beat-alligator', 'aurora-sunfish',
  'burning-dragon', 'great-terigius', 'golden-whale'
];
let checks = 0;
function check(actual, expected, message) {
  assert.deepEqual(actual, expected, message);
  checks++;
}

function element(className = '') {
  const node = {
    className, children: [], dataset: {}, attributes: {},
    classList: {
      contains: name => node.className.split(' ').includes(name),
      toggle: () => {}
    },
    style: {values: {}, setProperty(name, value) {this.values[name] = value;}},
    append(child) {child.parent = this; this.children.push(child);},
    remove() {if (this.parent) this.parent.children.splice(this.parent.children.indexOf(this), 1);},
    setAttribute(name, value) {this.attributes[name] = value;},
    querySelectorAll(selector) {
      if (selector === ':scope > .room-aquarium-fish')
        return this.children.filter(child => child.className === 'room-aquarium-fish');
      if (selector === '.room-aquarium-window') return [];
      throw new Error(`Unexpected selector: ${selector}`);
    },
    querySelector(selector) {
      if (selector === '.room-aquarium-scene-window') return this.children.find(child => child.className === 'room-aquarium-scene-window') || null;
      throw new Error(`Unexpected selector: ${selector}`);
    }
  };
  return node;
}

const sandbox = {window: {}, document: {createElement: () => element()}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'desktop', 'launcher-room-aquarium.js'), 'utf8'), sandbox);
const aquarium = sandbox.window.OnePieceRoomAquarium;
const allIds = [...existing, ...Object.keys(expectedNew)];
check(Object.keys(aquarium.species).length, 36, 'existing 26 plus ten new species');
for (const id of existing) check(typeof aquarium.species[id], 'string', `${id} retained`);

for (const [id, label] of Object.entries(expectedNew)) {
  check(aquarium.species[id], label, `${id} label`);
  const stage = element();
  const glass = element('room-aquarium-scene-window');
  stage.append(glass);
  aquarium.render({stage, room: {sceneId: 'room-scene-sunny-aquarium'},
    fishCollection: [{id: `catch-${id}`, speciesId: id, inAquarium: true}]});
  const lane = glass.children[0];
  check(stage.dataset.aquariumFishCount, '1', `${id} displayed`);
  check(lane?.dataset.speciesId, id, `${id} sprite species`);
  check(lane?.children[0]?.src,
    `opui://launcher/images/launcher_room/fish_master/${id}.webp`, `${id} art path`);
  check(lane?.dataset.swim, id === 'lionfish' ? 'drift' : 'swim', `${id} motion`);
  check(lane?.style.values['--fish-face-right'], '1', `${id} right-facing art`);
}

const sample = allIds.slice(0, 6).map((speciesId, index) => ({id: `old-${index}`, speciesId, inAquarium: true}));
check(aquarium.displayedFish(null, [...sample, {id: 'extra', speciesId: allIds[6], inAquarium: true}]).length,
  6, 'aquarium capacity remains six');
check(aquarium.displayedFish(null, [{id: 'unknown', speciesId: 'missing-fish', inAquarium: true}]).length,
  0, 'unknown species stays hidden');

if (process.argv.includes('--require-art')) {
  for (const id of Object.keys(expectedNew)) {
    const file = path.join(root, 'public', 'images', 'launcher_room', 'fish_master', `${id}.webp`);
    const bytes = fs.readFileSync(file);
    check(bytes.toString('ascii', 0, 4), 'RIFF', `${id} RIFF art`);
    check(bytes.toString('ascii', 8, 12), 'WEBP', `${id} WebP art`);
  }
}

console.log(`launcher_fishing_master_aquarium_qa PASS ${checks} checks${process.argv.includes('--require-art') ? ' (art present)' : ' (art pending)'}`);
