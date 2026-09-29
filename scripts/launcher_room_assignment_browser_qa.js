'use strict';
// Production room UI and navigation in Chromium, with isolated account/IPC fixtures.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const fixture = require('./launcher_life_integration_qa');
const { create, advance, snap, chromium } = fixture;
const root = path.resolve(__dirname, '..');
const out = process.env.LAUNCHER_ROOM_ASSIGNMENT_QA_OUT || 'D:/Codex_QA/launcher-life-1.2.13-assignment';
fs.mkdirSync(out, { recursive: true });
const files = ['desktop/launcher.html', 'desktop/launcher-room.css', 'desktop/launcher-room.js',
  'desktop/launcher-life-room.js', 'desktop/launcher-life.js', 'desktop/launcher-room-dialogue.js'];
const hashes = () => Object.fromEntries(files.map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')]));
const results = [];
async function visitStage(page) {
  await page.locator('#roomStage').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('#roomStage').scrollIntoView({ block: 'center', behavior: 'instant' }));
}
async function openWheel(page, key) {
  await visitStage(page);
  await page.locator(`#roomCharacters [data-room-key="c:room-character-${key}"]`).click({ force: true });
  await page.waitForFunction(() => !document.getElementById('roomCompanionPanel').hidden);
}
async function begin(page, key) {
  await openWheel(page, key);
  assert.equal(await page.locator('#roomLifeCall').textContent(), '指派移動');
  await page.locator('#roomLifeCall').click();
  await page.waitForFunction(() => !!window.__launcherRoomTest?.snapshot().assignment);
  assert(await page.locator('#roomAssignmentHint').isVisible());
  assert(await page.locator('#roomCompanionPanel').isHidden());
  assert(await page.locator('#roomStage').evaluate(node => node.classList.contains('is-assigning')));
}
async function cellPoint(page, col, row) {
  return page.locator('#roomStage').evaluate((stage, value) => {
    const rect = stage.getBoundingClientRect(), depth = (value.row + .5) / 8;
    const left = 164 + (28 - 164) * depth, right = 796 + (932 - 796) * depth;
    return { x: rect.left + (left + (right - left) * (value.col + .5) / 16) / 960 * rect.width,
      y: rect.top + (267 + 248 * depth) / 540 * rect.height };
  }, { col, row });
}
async function clickCell(page, col, row) {
  const point = await cellPoint(page, col, row);
  await page.mouse.click(point.x, point.y);
}
async function touchCell(page, col, row) {
  const point = await cellPoint(page, col, row);
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, id: 1, radiusX: 1, radiusY: 1, force: 1 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await session.detach(); }
}
async function scenario(name, options, test) {
  const { page, errors } = await create(options);
  try {
    const detail = await test(page);
    assert.deepEqual(errors, [], 'No uncaught browser errors');
    results.push({ name, pass: true, detail });
    console.log('PASS ' + name);
  } catch (error) {
    results.push({ name, pass: false, error: error.stack });
    await page.screenshot({ path: path.join(out, name + '-failure.png'), fullPage: true }).catch(() => {});
    console.error('FAIL ' + name + ': ' + error.message);
  } finally { await page.close(); }
}
async function main() {
  const startedSources = hashes();
  const browser = await chromium.launch({ headless: true, executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' });
  fixture.setBrowser(browser);
  try {
    await scenario('floor-and-cancel', { owned: ['luffy'], furniture: [{ key: 'map-table', col: 8, row: 1 }] }, async page => {
      await begin(page, 'luffy');
      const origin = (await snap(page)).walkers[0];
      await page.screenshot({ path: path.join(out, 'assignment-cue-desktop.png') });
      const wall = await page.locator('#roomStage').boundingBox();
      await page.mouse.click(wall.x + wall.width * .5, wall.y + wall.height * .2);
      assert((await snap(page)).assignment, 'Clicking scenery above the floor keeps target selection active');
      const keyboardCell = (await snap(page)).assignment.cell;
      await page.locator('#roomStage').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal((await snap(page)).assignment.cell.col, Math.min(15, keyboardCell.col + 1), 'Keyboard moves floor target');
      await page.locator('#roomStage').screenshot({ path: path.join(out, 'floor-target-desktop.png') });
      await clickCell(page, 12, 6);
      await page.waitForFunction(() => window.__launcherRoomTest.snapshot().assignment === null);
      const accepted = await snap(page);
      assert(accepted.life.tasks.some(task => task.key === 'luffy'), 'A local destination task was created');
      assert(accepted.walkers[0].route.length > 0, 'Actor received a real grid route');
      assert(Math.hypot(accepted.walkers[0].x - origin.x, accepted.walkers[0].y - origin.y) < 25, 'No teleport on assignment');
      assert.equal(await page.evaluate(() => window.__integration.calls.length), 0, 'Moving spends no coins or server command');
      await advance(page, 1200);
      assert(Math.hypot((await snap(page)).walkers[0].x - origin.x, (await snap(page)).walkers[0].y - origin.y) > 1, 'Actor actually walks');
      await begin(page, 'luffy');
      await page.keyboard.press('Escape');
      assert.equal((await snap(page)).assignment, null, 'Escape cancels target selection');
      await begin(page, 'luffy');
      await page.locator('#roomAssignmentCancel').click();
      assert.equal((await snap(page)).assignment, null, 'Visible cancel button works');
      return { routeCells: accepted.walkers[0].route.length, coins: 100, cancel: ['Escape', 'button'] };
    });
    await scenario('furniture-nonexpert', { owned: ['zoro'], furniture: [{ key: 'piano', col: 8, row: 1 }] }, async page => {
      await begin(page, 'zoro');
      const target = page.locator('#roomObjects [data-room-key="f:room-furniture-piano"]');
      assert(await target.isVisible());
      await target.click();
      await page.waitForFunction(() => window.__launcherRoomTest.snapshot().assignment === null);
      let state = await snap(page);
      assert(state.life.tasks.some(task => task.key === 'zoro'), 'Furniture interaction has a local task');
      assert.equal(await page.evaluate(() => window.__integration.calls.length), 0, 'No purchase or paid job on furniture click');
      let said = false; const trace = [];
      for (let ms = 0; ms < 40000; ms += 500) {
        state = await snap(page);
        if (ms % 1000 === 0) trace.push({ ms, task: state.life.tasks.find(task => task.key === 'zoro'),
          walker: state.walkers.find(walker => walker.key === 'zoro'), node: state.nodes.find(node => node.key === 'zoro') });
        if (state.nodes.find(node => node.key === 'zoro')?.speech) { said = true; break; }
        await advance(page, 500);
      }
      fs.writeFileSync(path.join(out, 'zoro-piano-trace.json'), JSON.stringify(trace, null, 2));
      assert(said, 'Character gives a voiced/text response at the furniture');
      const reaction = state.nodes.find(node => node.key === 'zoro');
      const line = reaction.speech;
      assert(/練刀|不熟|不會|別指望|琴/.test(line), `Nonexpert response fits Zoro and the piano: ${line}`);
      assert(['surprised', 'talk_annoyed'].includes(reaction.pose) && reaction.source === 'acting_v4',
        `Nonexpert response uses a full-body puzzled reaction: ${JSON.stringify(reaction)}`);
      assert.equal(state.walkers.find(walker => walker.key === 'zoro').direction, 'south', 'Puzzled response faces the player');
      await page.locator('#roomStage').screenshot({ path: path.join(out, 'zoro-piano-response.png') });
      await advance(page, 1800);
      const resumed = (await snap(page)).nodes.find(node => node.key === 'zoro');
      assert.equal(resumed.source, 'life_v1', 'Furniture action resumes after the reaction');
      assert.equal((await snap(page)).walkers.find(walker => walker.key === 'zoro').direction, 'north', 'Actor faces the piano again');
      return { line, reaction: { pose: reaction.pose, source: reaction.source, direction: 'south' }, resumed: resumed.source, coins: 100 };
    });
    await scenario('mobile-width-and-visitor', { owned: ['luffy'], visitor: true }, async page => {
      await page.setViewportSize({ width: 390, height: 844 });
      await openWheel(page, 'luffy');
      assert(await page.locator('#roomLifeCall').isHidden(), 'Visitor has no assignment action');
      assert.equal(await page.evaluate(() => window.LauncherRoom.beginAssignment('room-character-luffy')), false);
      assert(await page.locator('#roomAssignmentHint').isHidden());
      assert.equal(await page.evaluate(() => window.__integration.calls.length), 0);
      return { visitorReadonly: true };
    });
    await scenario('mobile-width-floor', { owned: ['luffy'] }, async page => {
      await page.setViewportSize({ width: 390, height: 844 });
      await begin(page, 'luffy');
      assert(await page.locator('#roomAssignmentCancel').isVisible());
      await page.screenshot({ path: path.join(out, 'assignment-cue-mobile.png') });
      const layout = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth,
        hint: document.getElementById('roomAssignmentHint').getBoundingClientRect().toJSON() }));
      assert(layout.document <= layout.viewport + 1, 'No horizontal overflow outside room scroll');
      await touchCell(page, 3, 6);
      await page.waitForFunction(() => window.__launcherRoomTest.snapshot().assignment === null);
      assert((await snap(page)).life.tasks.some(task => task.key === 'luffy'));
      await page.screenshot({ path: path.join(out, 'mobile-assigned.png') });
      return layout;
    });
  } finally { await browser.close(); }
  const completedSources = hashes();
  const report = { ok: results.every(result => result.pass) && JSON.stringify(startedSources) === JSON.stringify(completedSources),
    generatedAt: new Date().toISOString(), results, startedSources, completedSources,
    scope: 'Headless Chromium production room UI, movement and character art with isolated IPC fixtures. Mobile viewport is simulated; no physical-device, real-account or public-deployment acceptance.' };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, checks: results.length, out, failures: results.filter(result => !result.pass).map(result => result.name) }));
  if (!report.ok) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
