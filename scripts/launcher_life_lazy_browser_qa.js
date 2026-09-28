'use strict';
// Actual Chromium room with local artwork and isolated account replies.
// The historical fixture eagerly warms three Life actions; remove that fixture-only warmup.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const fixturePath = path.join(__dirname, 'launcher_life_integration_qa.js');
let source = fs.readFileSync(fixturePath, 'utf8');
const warmup = "  await page.evaluate(async()=>{const promises=[];for(const key of window.__integration.db[42].life.ownedCharacterIds.map(id=>id.replace('room-character-','')))for(const clip of ['work','eat','train']){const record=window.OnePieceLifeActions.preload(key,clip,'south');if(record?.promise)promises.push(record.promise);}await Promise.all(promises);});";
assert(source.includes(warmup), 'integration fixture warmup anchor changed');
source = source.replace(warmup, '');
const scriptAnchor = /  for\(const file of files\)\{\r?\n    await page\.addScriptTag\(\{content:read\(file\)\}\);/;
assert(scriptAnchor.test(source), 'integration fixture script anchor changed');
source = source.replace(scriptAnchor, `  for(const file of files){
    if(file==='launcher-life-actions.js')await page.evaluate(()=>{
      window.__lifeImageStarts=[];
      const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
      Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){
        if(String(value).includes('/launcher_room/life_v1/'))window.__lifeImageStarts.push(String(value));
        return descriptor.set.call(this,value);
      }});
    });
    await page.addScriptTag({content:read(file)});`);
const mod = new Module(fixturePath, module);
mod.filename = fixturePath;
mod.paths = Module._nodeModulePaths(path.dirname(fixturePath));
mod._compile(source, fixturePath);
const fixture = mod.exports;

async function main() {
  const browser = await fixture.chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  fixture.setBrowser(browser);
  let page;
  try {
    const result = await fixture.create({ owned: ['sanji'], furniture: [{ key: 'galley-stove' }] });
    page = result.page;
    assert.deepEqual(result.errors, []);
    const lifeRequests = () => page.evaluate(() => [...__lifeImageStarts]);
    const initial = await lifeRequests();
    assert.equal(initial.length, 0, 'room entry should not decode every Life action');
    const stationId = await page.evaluate(() => __launcherRoomTest.lifeWorld().stations.find(station => station.furnitureKey === 'galley-stove')?.id);
    assert(stationId, 'galley stove station must exist');
    const assignment = await page.evaluate(id => __launcherRoomTest.lifeAssign('sanji', id), stationId);
    assert.equal(assignment.ok, true);
    let activated = false, specialist = false;
    for (let elapsed = 0; elapsed < 90000; elapsed += 500) {
      await fixture.advance(page, 500);
      const state = await fixture.snap(page);
      activated ||= await page.evaluate(() => __integration.calls.some(call => call.type === 'work.activate'));
      specialist ||= state.nodes.some(node => node.key === 'sanji' && node.pose === 'cook' && node.source === 'life_v1');
      if (activated && specialist) break;
    }
    assert(activated, 'work activates after first-use art decodes');
    assert(specialist, 'Sanji plays cook during the first stove assignment');
    const requests = await lifeRequests();
    assert(requests.some(url => /\/sanji\/cook-(north|south|east|west)\.webp$/.test(url)), 'specialist art requested: ' + JSON.stringify(requests));
    assert(requests.length < 10, 'first assignment should not fetch the entire Life library');
    assert.deepEqual(result.errors, []);
    console.log(JSON.stringify({ ok: true, initialLifeRequests: initial.length, firstAssignmentLifeRequests: requests.length, activated, specialist }));
  } finally {
    await page?.close();
    await browser.close();
  }
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
