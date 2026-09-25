'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = path.join(__dirname, '..', 'desktop', 'launcher-room-dialogue.js');
const dialogue = require(source);
const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(source, 'utf8'), browser, { filename: source });
assert.equal(browser.window.OnePieceRoomDialogue.KEYS.length, 10, 'browser global is available before launcher-room.js');

const canonical = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
assert.deepEqual([...dialogue.KEYS], canonical);
assert.equal(Object.keys(dialogue.PAIR_LINES).length, 45, 'all distinct character pairs have authored scenes');

let soloLines = 0;
let pairScenes = 0;
for (const key of canonical) {
  const profile = dialogue.profile(key);
  assert.ok(profile && profile.name && profile.role && profile.detail, `${key} has a readable profile`);
  assert.ok(dialogue.CHARACTER_LINES[key].chat.length >= 6, `${key} has at least six chat lines`);
  assert.ok(dialogue.CHARACTER_LINES[key].reply.length >= 4, `${key} has at least four replies`);
  assert.equal(new Set(dialogue.CHARACTER_LINES[key].chat).size, dialogue.CHARACTER_LINES[key].chat.length, `${key} chat lines vary`);
  for (const kind of ['chat', 'work', 'bond', 'rest']) {
    const lines = Array.from({ length: 4 }, (_, index) => dialogue.interaction(key, kind, index));
    assert.equal(new Set(lines.map(value => value[0])).size, 4, `${key} ${kind} actions vary`);
    for (const [line, mood] of lines) {
      assert.ok(line.length > 4 && line.length <= 50, `${key} line fits a speech bubble`);
      assert.ok(dialogue.MOODS.includes(mood), `${key} mood maps to an existing body pose`);
    }
    soloLines += lines.length;
  }
  for (const furnitureKey of profile.favorite) {
    const activity = dialogue.activity(key, furnitureKey, 1);
    assert.ok(activity && activity.line && activity.verb, `${key} can act at preferred furniture ${furnitureKey}`);
    assert.ok(dialogue.MOODS.includes(activity.mood));
  }
}

for (let i = 0; i < canonical.length; i++) {
  for (let j = i + 1; j < canonical.length; j++) {
    const first = canonical[i];
    const second = canonical[j];
    assert.ok(dialogue.hasPair(first, second));
    assert.ok(dialogue.hasPair(second, first));
    const scenes = dialogue.PAIR_LINES[`${first}:${second}`] || dialogue.PAIR_LINES[`${second}:${first}`];
    assert.ok(scenes.length >= 2, `${first}/${second} has more than one scene`);
    for (let sceneIndex = 0; sceneIndex < scenes.length; sceneIndex++) {
      const forwards = dialogue.pair(first, second, sceneIndex);
      const backwards = dialogue.pair(second, first, sceneIndex);
      assert.equal(forwards.length, 2);
      assert.equal(backwards.length, 2);
      assert.equal(backwards[0][0], forwards[1][0], 'reverse encounter changes speaker order');
      for (const [line, mood] of forwards) {
        assert.ok(line.length > 4 && line.length <= 50, `${first}/${second} dialogue fits bubble`);
        assert.ok(dialogue.MOODS.includes(mood), `${first}/${second} has valid mood`);
      }
      pairScenes++;
    }
  }
}

assert.equal(dialogue.profile('unknown'), null);
assert.equal(dialogue.hasPair('unknown', 'luffy'), false);
assert.equal(dialogue.pair('luffy', 'luffy'), null);
assert.equal(dialogue.activity('luffy', 'invalid'), null);
console.log(`PASS launcher room dialogue: ${canonical.length} canon characters, ${soloLines} click lines, ${pairScenes} authored pair scenes across 45 relationships`);
