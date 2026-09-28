'use strict';
// Real Chromium room renderer, isolated account fixture and reviewed source art.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
const out = process.env.LAUNCHER_LIFE_HD_QA_OUT || path.join(os.tmpdir(), 'launcher-life-hd-v2-qa');
fs.mkdirSync(out, {recursive: true});
process.env.LAUNCHER_LIFE_INTEGRATION_OUT = out;
const fixture = require('./launcher_life_integration_qa');
const actions = require('../desktop/launcher-life-actions');
const manifest = require('../tools/launcher-room/life-hd-v2/manifest.json');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const samples = [
  ['luffy', 'work'],
  ['sanji', 'cook'],
  ['chopper', 'medicine'],
  ['franky', 'eat'],
  ['robin', 'work']
];

async function main() {
  assert.equal(manifest.count, 116);
  assert.equal(actions.hdAssets().length, 116);
  assert.equal(actions.assets().length, 128, 'historical life list remains available');
  for (const asset of manifest.assets) {
    const file = path.join(root, asset.asset);
    assert.equal(hash(fs.readFileSync(file)), asset.assetSha256, asset.asset);
    assert.equal(asset.cellPixels, 256);
    assert(asset.scaleFromSource < 1, 'HD art must come from source downsampling');
  }
  const browser = await fixture.chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });
  fixture.setBrowser(browser);
  let page;
  try {
    const result = await fixture.create({owned: [...new Set(samples.map(([key]) => key))]});
    page = result.page;
    const missing = [];
    page.on('response', response => {if (response.status() >= 400) missing.push([response.status(), response.url()]);});
    const loaded = await page.evaluate(async samples => {
      return Promise.all(samples.map(async ([key, action]) => {
        const record = OnePieceLifeActions.preload(key, action, 'south');
        await record.promise;
        return {key, action, url: record.source, cell: record.cell, ready: record.ready,
          width: record.image.naturalWidth, height: record.image.naturalHeight};
      }));
    }, samples);
    assert(loaded.every(row => row.ready && row.cell === 256 && row.width === 1024 && row.height === 256));
    assert(loaded.filter(row => row.key !== 'robin').every(row => row.url.includes('/life_hd_v2/')));
    assert(loaded.find(row => row.key === 'robin').url.includes('/robin_v2/life/'));

    const layout = await page.evaluate(samples => {
      const bounds = canvas => {
        const rect = canvas.getBoundingClientRect();
        return {x: rect.x, y: rect.y, width: rect.width, height: rect.height};
      };
      return samples.map(([key, action]) => {
        const node = document.querySelector(`[data-room-key="c:room-character-${key}"]`);
        const canvas = node.querySelector('.room-walk-sprite');
        const walk = OnePieceRoomMotion.preload(key).atlases.south;
        if (!walk) throw Error(`Walk atlas missing: ${key}`);
        OnePieceRoomMotion.draw(canvas, walk, 0);
        const walkPixels = [canvas.width, canvas.height];
        const walkBox = bounds(canvas);
        const played = OnePieceLifeActions.draw(canvas, key, action, 'south', 0);
        if (!played) throw Error(`Action atlas missing: ${key}/${action}`);
        const actionPixels = [canvas.width, canvas.height];
        const actionBox = bounds(canvas);
        node.dataset.pose = action;
        node.dataset.actionSource = 'life_v1';
        node.classList.add('has-directional-sprite');
        canvas.hidden = false;
        return {key, action, walkPixels, actionPixels, walkBox, actionBox,
          paintedSource: played.source, paintedFrame: played.frame};
      });
    }, samples);
    for (const row of layout) {
      assert.deepEqual(row.walkPixels, [384, 384], row.key);
      assert.deepEqual(row.actionPixels, [256, 256], row.key);
      assert(Math.abs(row.walkBox.width - row.actionBox.width) < 0.1, `${row.key} CSS width jumped`);
      assert(Math.abs(row.walkBox.height - row.actionBox.height) < 0.1, `${row.key} CSS height jumped`);
    }
    assert.deepEqual(missing, [], 'all sampled images must load locally');
    assert.deepEqual(result.errors, [], 'room must have no page errors');
    const screenshot = path.join(out, 'room-life-hd-actions.png');
    await page.locator('#roomStage').screenshot({path: screenshot});
    const report = {schema: 'launcher-life-hd-browser-qa/1', status: 'PASS', assetCount: manifest.count,
      loaded, layout, missing, pageErrors: result.errors,
      screenshot: {path: screenshot, sha256: hash(fs.readFileSync(screenshot))},
      scope: 'Actual Chromium room and canvas, local WebP assets, isolated account fixture; no human art acceptance or deployment.'};
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(JSON.stringify({status: report.status, assets: report.assetCount, browserSamples: layout.length, out}));
  } finally {
    await page?.close();
    await browser.close();
  }
}

main().catch(error => {console.error(error.stack || error); process.exitCode = 1;});
