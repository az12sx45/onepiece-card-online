'use strict';

// Verify actual Chromium character rendering at both room widths. Account
// data is supplied by the existing isolated room fixture.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tools/launcher-room/scale-v1210/review-evidence');
process.env.LAUNCHER_LIFE_INTEGRATION_OUT = out;
const fixture = require('./launcher_life_integration_qa.js');
const cases = [
  { key: 'franky', action: 'eat', direction: 'south' },
  { key: 'jinbe', action: 'helm', direction: 'north' },
  { key: 'sanji', action: 'train', direction: 'south' }
];
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const results = [];

async function render(page, specimen, kind) {
  return page.evaluate(async ({ key, action, direction, kind }) => {
    const node = document.querySelector(`[data-room-key="c:room-character-${key}"]`);
    assertNode(node);
    const canvas = node.querySelector('.room-walk-sprite');
    if (kind === 'walk') {
      const motion = OnePieceRoomMotion.preload(key);
      await motion.promise;
      if (!OnePieceRoomMotion.draw(canvas, motion.atlases[direction], 1)) throw Error('walk atlas not ready');
      node.dataset.actionSource = 'motion_v4';
      node.dataset.pose = 'walk';
    } else {
      const clip = OnePieceLifeActions.preload(key, action, direction);
      await clip.promise;
      if (!OnePieceLifeActions.draw(canvas, key, action, direction, 0)) throw Error('life atlas not ready');
      node.dataset.actionSource = 'life_v1';
      node.dataset.pose = action;
    }
    node.dataset.direction = direction;
    canvas.style.setProperty('--room-root-offset', '12.5%');
    canvas.hidden = false;
    node.classList.add('has-directional-sprite');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    let top = canvas.height, bottom = 0;
    for (let i = 3; i < pixels.length; i += 4) if (pixels[i] > 24) {
      const y = Math.floor((i - 3) / 4 / canvas.width);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y + 1);
    }
    if (bottom <= top) throw Error('empty figure');
    const box = canvas.getBoundingClientRect();
    const shell = node.getBoundingClientRect();
    const stage = document.getElementById('roomStage').getBoundingClientRect();
    const rootY = box.top + box.height * (112 / 128);
    return {
      kind, key, action, direction, source: node.dataset.actionSource,
      canvasPixels: canvas.width, sourceHeightFraction: (bottom - top) / canvas.height,
      visibleHeight: (bottom - top) / canvas.height * box.height,
      rootDelta: rootY - shell.bottom,
      stageWidth: stage.width, viewportWidth: innerWidth,
      appliedScale: Number(getComputedStyle(node).getPropertyValue('--room-pose-scale')) || 1
    };
    function assertNode(value) { if (!value) throw Error('room character not present'); }
  }, { ...specimen, kind });
}

async function main() {
  fs.mkdirSync(out, { recursive: true });
  const browser = await fixture.chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    args: ['--disable-web-security']
  });
  fixture.setBrowser(browser);
  try {
    for (const specimen of cases) {
      const { page, errors } = await fixture.create({ owned: [specimen.key] });
      try {
        for (const viewport of [
          { name: 'desktop', width: 1366, height: 1050 },
          { name: 'mobile', width: 390, height: 844 }
        ]) {
          await page.setViewportSize({ width: viewport.width, height: viewport.height });
          const walk = await render(page, specimen, 'walk');
          const pose = await render(page, specimen, 'life');
          const ratio = pose.visibleHeight / walk.visibleHeight;
          assert(Math.abs(walk.rootDelta) < 1 && Math.abs(pose.rootDelta) < 1,
            `${specimen.key} ground root moved at ${viewport.name}`);
          assert(ratio > 0.96 && ratio < 1.04,
            `${specimen.key} ${specimen.action} height jumped to ${ratio.toFixed(3)} at ${viewport.name}`);
          assert(pose.appliedScale > 1.05, 'measured correction not applied');
          assert.deepEqual(errors, [], 'Chromium page errors');
          const capture = path.join(out, `${specimen.key}-${specimen.action}-${viewport.name}.png`);
          await page.locator('#roomStage').screenshot({ path: capture });
          results.push({ ...specimen, viewport: viewport.name, walk, pose, ratio, capture: path.basename(capture), captureSha256: hash(capture) });
        }
      } finally { await page.close(); }
    }
    const report = {
      schema: 'launcher-character-proportion-qa/1',
      status: 'PASS', checks: results.length, results,
      sourceHashes: Object.fromEntries(['desktop/launcher-room.css', 'desktop/launcher-life-room.js',
        'desktop/launcher-room.js', 'desktop/launcher-life-actions.js'].map(file => [file, hash(path.join(root, file))])),
      humanAcceptance: false,
      scope: 'Real Chromium room renderer and atlas alpha, isolated account fixture; desktop and narrow viewport. No live account or human visual acceptance.'
    };
    fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ status: report.status, checks: report.checks, out }));
  } finally { await browser.close(); }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
