'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = path.join(__dirname, '..', 'desktop', 'launcher-room-dialogue.js');
const dialogue = require(source);
const browser = { window: {} };
vm.runInNewContext(fs.readFileSync(source, 'utf8'), browser, { filename: source });
assert.equal(typeof browser.window.OnePieceRoomDialogue.scene, 'function', 'browser exposes scene API without CommonJS');
const canonical = ['luffy', 'zoro', 'nami', 'usopp', 'sanji', 'chopper', 'robin', 'franky', 'brook', 'jinbe'];
const furniture = ['helm', 'map-table', 'treasure-chest', 'tangerine-tree', 'swords-rack', 'kitchen-table', 'bookshelf', 'medicine-cabinet', 'piano', 'tool-bench'];
assert.deepEqual([...dialogue.KEYS], canonical);
assert.equal(Object.keys(dialogue.SCENES).length, 45, 'every distinct crew pairing is authored');
assert.equal(Object.keys(dialogue.PAIR_LINES).length, 45, 'legacy pair table remains available');
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const ids = new Set();
const lineOwners = new Map();
const normalizedScripts = new Set();
const namePattern = new RegExp(canonical.map(key => dialogue.profile(key).name).join('|'), 'gu');
const normalize = line => line.replace(namePattern, '夥伴').replace(/[\p{P}\p{S}\s]/gu, '');
const actingByCharacter = new Map(canonical.map(key => [key, new Set()]));
const characterLines = new Map(canonical.map(key => [key, []]));
const validateBeat = (beat, label, expectedSpeaker) => {
  check(beat && typeof beat.line === 'string' && Array.from(beat.line).length >= 4 && Array.from(beat.line).length <= 50, `${label}: bubble is concise`);
  check(dialogue.MOODS.includes(beat.mood), `${label}: supported mood`);
  check(dialogue.POSES.includes(beat.pose), `${label}: supported sprite pose`);
  check(dialogue.ACTIONS.includes(beat.action) && /[\u3400-\u9fff]/u.test(dialogue.ACTION_LABELS[beat.action]), `${label}: action has a player-readable label`);
  check(!/[<>]|\{\{|\$\{|undefined|generic|TODO|待補|種子台詞/iu.test(beat.line), `${label}: no markup or unfinished template`);
  check(!/[种连长对这吗帮个时样]/u.test(beat.line), `${label}: no common simplified-character typos`);
  check(!/尼卡|五檔|閻魔|和之國|四皇|兩年後|左眼|懸賞金|香吉士的婚|血統因子|世界政府的真相/u.test(beat.line), `${label}: no era-dependent costume spoiler`);
  if (expectedSpeaker) {
    check(beat.speaker === expectedSpeaker, `${label}: authored speaker is preserved`);
    actingByCharacter.get(expectedSpeaker).add(beat.action);
    characterLines.get(expectedSpeaker).push(beat.line);
  }
};
let soloLines = 0;
let furnitureLines = 0;
const claimLines = new Set();
for (const key of canonical) {
  const profile = dialogue.profile(key);
  check(profile && profile.name && profile.role && profile.detail && profile.voice, `${key}: role plus voice direction`);
  check(Object.isFrozen(profile), `${key}: exported profile cannot be changed by a consumer`);
  check(profile.closeTo.every(other => canonical.includes(other) && other !== key), `${key}: relationship references are real crew IDs`);
  check(dialogue.CHARACTER_LINES[key].chat.length >= 6 && dialogue.CHARACTER_LINES[key].reply.length >= 4, `${key}: legacy solo lists stay populated`);
  for (const kind of ['chat', 'work', 'bond', 'rest', 'claim']) {
    const lines = dialogue.SOLO[key][kind];
    check(lines.length >= (kind === 'chat' ? 6 : kind === 'claim' ? 2 : 4), `${key}/${kind}: independent options`);
    check(new Set(lines.map(beat => beat.line)).size === lines.length, `${key}/${kind}: options do not duplicate`);
    lines.forEach((_, index) => {
      const beat = dialogue.interactionBeat(key, kind, index);
      validateBeat(beat, `${key}/${kind}/${index}`, key);
      if (kind === 'claim') {
        check(/好了|做完|完成|辦妥|妥當|清點過|收尾|交工/u.test(beat.line), `${key}: claim describes completed work`);
        check(!dialogue.SOLO[key].work.some(start => start.line === beat.line), `${key}: claim does not reuse work-start dialogue`);
        check(!claimLines.has(beat.line), `${key}: completion is individually authored`);
        claimLines.add(beat.line);
      }
      assert.deepEqual(dialogue.interaction(key, kind, index), [beat.line, beat.mood]);
      soloLines++;
    });
    assert.deepEqual(dialogue.interactionBeat(key, kind, -1), dialogue.interactionBeat(key, kind, lines.length - 1), 'negative cursor wraps');
    assert.deepEqual(dialogue.interactionBeat(key, kind, Infinity), dialogue.interactionBeat(key, kind, 0), 'invalid cursor is deterministic');
  }
  for (const item of profile.favorite) {
    check(furniture.includes(item), `${key}/${item}: existing furniture ID`);
    const values = dialogue.SOLO[key].furniture[item];
    check(values && values.length >= 2, `${key}/${item}: varied furniture activity`);
    values.forEach((_, index) => {
      const beat = dialogue.activity(key, item, index);
      validateBeat(beat, `${key}/${item}/${index}`, key);
      check(beat.verb.length > 1 && beat.furnitureKey === item, `${key}/${item}: activity retains context`);
      furnitureLines++;
    });
  }
}
let sceneCount = 0;
let turnCount = 0;
let responsiveBeats = 0;
for (let i = 0; i < canonical.length; i++) {
  for (let j = i + 1; j < canonical.length; j++) {
    const a = canonical[i];
    const b = canonical[j];
    check(dialogue.hasPair(a, b) && dialogue.hasPair(b, a), `${a}/${b}: both encounter orders supported`);
    const scenes = dialogue.SCENES[`${a}:${b}`];
    check(scenes && scenes.length >= 3, `${a}/${b}: at least three authored scenes`);
    check(new Set(scenes.map(scene => scene.topic)).size === scenes.length, `${a}/${b}: distinct scene topics`);
    for (let index = 0; index < scenes.length; index++) {
      const scene = dialogue.scene(a, b, index);
      const label = scene.id;
      assert.deepEqual(dialogue.scene(b, a, index), scene, 'reversed encounter cannot put an answer before its question');
      check(!ids.has(label), `${label}: unique scene ID`);
      ids.add(label);
      check(scene.relationship.length >= 12, `${label}: authored relationship direction`);
      check(scene.turns.length >= 3 && scene.turns.length <= 5, `${label}: complete short conversation`);
      check(scene.cooldownMs >= 15000, `${label}: avoids immediate repetition`);
      check(scene.tags.every(tag => furniture.includes(tag)), `${label}: contextual tags use real furniture`);
      check(new Set(scene.turns.map(beat => beat.speaker)).size === 2, `${label}: both actors get to speak`);
      for (const [n, beat] of scene.turns.entries()) {
        validateBeat(beat, `${label}/${n}`, n % 2 ? b : a);
        check(beat.durationMs >= 2200 && beat.durationMs <= 7000, `${label}/${n}: readable duration`);
        check(beat.listener && beat.listener.key === (beat.speaker === a ? b : a), `${label}/${n}: listener is the other actor`);
        check(dialogue.MOODS.includes(beat.listener.mood) && dialogue.POSES.includes(beat.listener.pose) && dialogue.ACTIONS.includes(beat.listener.action), `${label}/${n}: listener has a renderable reaction`);
        check(!lineOwners.has(normalize(beat.line)), `${label}/${n}: a full line is not recycled from ${lineOwners.get(normalize(beat.line))}`);
        lineOwners.set(normalize(beat.line), `${label}/${n}`);
        if (beat.listener.action !== 'listen') responsiveBeats++;
        turnCount++;
      }
      const script = scene.turns.map(beat => normalize(beat.line)).join('|');
      check(!normalizedScripts.has(script), `${label}: not the same script with different names`);
      normalizedScripts.add(script);
      const originalPair = dialogue.pair(a, b, index);
      assert.deepEqual(originalPair, scene.turns.slice(0, 2).map(beat => [beat.line, beat.mood]));
      assert.deepEqual(dialogue.pair(b, a, index), [originalPair[1], originalPair[0]], 'legacy pair keeps requested actor order');
      if (scene.tags.length) {
        const selected = dialogue.scene(a, b, index, { furnitureKey: scene.tags[0] });
        check(selected.tags.includes(scene.tags[0]), `${label}: furniture context selects a relevant scene`);
      }
      const notRepeated = dialogue.scene(a, b, 0, { recentSceneIds: [scene.id] });
      check(notRepeated.id !== scene.id, `${label}: recent scene is skipped when alternatives exist`);
      scene.turns[0].line = 'caller mutation';
      scene.turns[0].listener.action = 'caller mutation';
      scene.tags.push('caller mutation');
      check(dialogue.scene(a, b, index).turns[0].line !== 'caller mutation' && !dialogue.scene(a, b, index).tags.includes('caller mutation'), `${label}: callers cannot contaminate future scenes`);
      sceneCount++;
    }
    assert.deepEqual(dialogue.scene(a, b, -1), dialogue.scene(a, b, scenes.length - 1), 'negative scene cursor wraps');
    assert.deepEqual(dialogue.scene(a, b, NaN), dialogue.scene(a, b, 0), 'NaN cursor resolves safely');
    assert.deepEqual(dialogue.scene(a, b, 0, null), dialogue.scene(a, b, 0), 'null context stays safe');
    const fallback = dialogue.scene(a, b, 0, { furnitureKey: 'not-a-furniture', recentSceneIds: scenes.map(s => s.id) });
    check(scenes.some(value => value.id === fallback.id), `${a}/${b}: exhausted history falls back only to that pair's authored scenes`);
  }
}
for (const key of canonical) check(actingByCharacter.get(key).size >= 7, `${key}: performance is not one unchanging reaction`);
const shingles = value => new Set(Array.from({ length: Math.max(0, value.length - 2) }, (_, i) => value.slice(i, i + 3)));
const fingerprints = [...normalizedScripts].map(shingles);
let maximumSceneSimilarity = 0;
for (let i = 0; i < fingerprints.length; i++) {
  for (let j = i + 1; j < fingerprints.length; j++) {
    const a = fingerprints[i];
    const b = fingerprints[j];
    const common = [...a].filter(value => b.has(value)).length;
    const similarity = 2 * common / (a.size + b.size);
    maximumSceneSimilarity = Math.max(maximumSceneSimilarity, similarity);
    check(similarity < 0.75, `scenes ${i}/${j}: reject near-identical templates even when names and punctuation differ`);
  }
}
check(responsiveBeats >= 150, 'listeners have many deliberate responses beyond waiting silently');
check(characterLines.get('luffy').filter(line => /肉/u.test(line)).length < 8, 'Luffy is not reduced to a meat catchphrase');
check(characterLines.get('zoro').filter(line => /迷路|方向|門換/u.test(line)).length < 8, 'Zoro is not reduced to getting lost');
check(characterLines.get('nami').filter(line => /錢|貝里|收費/u.test(line)).length < 8, 'Nami is not reduced to money');
check(characterLines.get('franky').filter(line => /SUPER/u.test(line)).length < 8, 'Franky catchphrase is used sparingly');
// Editorial invariants: concrete scenes retain their premise, response and payoff.
const named = id => Object.values(dialogue.SCENES).flat().find(value => value.id === id);
check(/菜刀|擦刀布/u.test(named('zoro-sanji-3').turns[0].line) && /謝了/u.test(named('zoro-sanji-3').turns[2].line), 'Zoro/Sanji rivalry includes understated care rather than hostility alone');
check(/手藝|扣子/u.test(named('usopp-franky-1').turns[0].line) && /聽你的/u.test(named('usopp-franky-1').turns[3].line), 'Franky respects Usopp authorship rather than replacing his idea');
check(/檢查/u.test(named('sanji-chopper-3').turns[1].line) && /醫生/u.test(named('sanji-chopper-3').turns[2].line), 'Chopper receives professional trust');
check(/訊號/u.test(named('nami-jinbe-1').turns[1].line) && /現在/u.test(named('nami-jinbe-1').turns[2].line), 'Navigator and helmsman exchange an actionable cue');
for (const value of [dialogue.profile('unknown'), dialogue.scene('luffy', 'luffy'), dialogue.scene('luffy', 'unknown'), dialogue.pair('unknown', 'zoro'), dialogue.interactionBeat('unknown'), dialogue.activity('luffy', 'unknown'), dialogue.activity('luffy', '__proto__')]) assert.equal(value, null);
assert.equal(dialogue.hasPair('unknown', 'zoro'), false);
const report = { ok: true, characters: canonical.length, pairs: 45, scenes: sceneCount, turns: turnCount, soloLines, claimLines: claimLines.size, furnitureLines, responsiveBeats, maximumSceneSimilarity, checks, note: 'Data/API checks only. Canon fit and emotional timing still require editorial and in-room visual review.' };
const outIndex = process.argv.indexOf('--out');
if (outIndex >= 0) {
  const target = path.resolve(process.argv[outIndex + 1]);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify(report, null, 2));
