"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "D:/LATTICE/projects/tabletop-series/qa-browser/node_modules/playwright-core");
const ROOT = path.resolve(__dirname, ".."), BASELINE = "4f4170331f0e323786f93dd8d7535e868985dc6d";
const BASE = process.env.BOARD_QA_URL || "http://127.0.0.1:18943";
const OUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/water-seven-ship-depth-20260924/browser";
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(new URL(BASE).hostname), "Localhost fixtures only");
fs.mkdirSync(OUT, { recursive: true });
const oldHtml = execFileSync("git", ["show", `${BASELINE}:public/board_water_seven.html`], { cwd: ROOT });
const geometry = JSON.parse(fs.readFileSync(path.join(ROOT, "public/js/board_water_seven_depth_data.json")));
const report = { cases: [], errors: [], assets: [], startedAt: new Date().toISOString() };
for (const [source, entry] of Object.entries(geometry.assets)) {
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "public", source))).digest("hex"), entry.sourceSha256);
  assert.equal(Buffer.from(entry.depth, "base64").length, entry.grid[0] * entry.grid[1]);
  report.assets.push(source);
}
assert.equal(report.assets.length, 36);
async function settled(page, depth = true) {
  await page.waitForFunction(depth => {
    const stage = document.querySelector("#shipStage"), image = document.querySelector("#shipImg");
    return stage && !stage.classList.contains("is-turning") && image.complete && image.naturalWidth > 0
      && (!depth || window.__WATER_SEVEN_DEPTH__?.status().ready);
  }, depth, { timeout: 15000 });
  await page.waitForTimeout(760);
}
async function layout(page) {
  return page.evaluate(() => {
    const selectors = [".screen", "#dockPanel", "#shipStage", "#shipFocusLayer", "#shipImg", ".ship-marker", ".upgrade-map", ".upgrade-lines", "#slotBoard", ".slot-socket", "#workList", "#waterSevenExitBtn", "[data-tab]"];
    return selectors.flatMap(selector => Array.from(document.querySelectorAll(selector), el => {
      const rect = el.getBoundingClientRect();
      return { selector, rect: [rect.x, rect.y, rect.width, rect.height].map(n => Math.round(n * 100) / 100), text: el.tagName === "BUTTON" ? el.textContent.trim() : "", disabled: !!el.disabled };
    }));
  });
}
async function compare(old, next, label) {
  // Chromium may defer a background tab's CSS transition. Measure each page
  // after it has actually presented, rather than comparing different times.
  await old.bringToFront(); await settled(old, false); const oldLayout = await layout(old);
  await next.bringToFront(); await settled(next);
  assert.deepEqual(await layout(next), oldLayout, label + " layout or controls changed");
  const oldState = await old.evaluate(() => ({ state, currentShipFocus, currentShipFrameImage, shipConfigs }));
  const newState = await next.evaluate(() => ({ state, currentShipFocus, currentShipFrameImage, shipConfigs }));
  assert.deepEqual(newState, oldState, label + " interface state changed");
  report.cases.push({ label, layoutEqual: true, stateEqual: true, depth: await next.evaluate(() => window.__WATER_SEVEN_DEPTH__.status()) });
}
async function pairedVisuals(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const old = await context.newPage(), next = await context.newPage();
  await old.route("**/board_water_seven.html*", route => route.fulfill({ status: 200, contentType: "text/html", body: oldHtml }));
  for (const page of [old, next]) page.on("pageerror", error => report.errors.push(error.message));
  if (process.argv.includes("--interactions-only")) await next.goto(BASE + "/board_water_seven.html?ship=ship_06&lockShip=1");
  for (let ship = 1; ship <= (process.argv.includes("--interactions-only") ? 0 : 6); ship++) {
    const url = `${BASE}/board_water_seven.html?ship=ship_0${ship}&lockShip=1`;
    await Promise.all([old.goto(url), next.goto(url)]);
    for (const focus of ["sail", "watchtower", "training", "kitchen", "rudder"]) {
      await Promise.all([old.locator(`[data-select-upgrade="${focus}"]`).click(), next.locator(`[data-select-upgrade="${focus}"]`).click()]);
      await compare(old, next, `${viewport.width}:ship${ship}:${focus}`);
      if (focus === "sail") await next.screenshot({ path: path.join(OUT, `${viewport.width}-ship${ship}.png`) });
    }
    for (const tab of ["gear", "slots"]) {
      await Promise.all([old.locator(`[data-tab="${tab}"]`).click(), next.locator(`[data-tab="${tab}"]`).click()]);
      await compare(old, next, `${viewport.width}:ship${ship}:${tab}`);
    }
    console.log(JSON.stringify({ width: viewport.width, ship, comparisons: 7, ok: true }));
  }
  await next.locator('[data-tab="upgrades"]').click(); await settled(next);
  const before = await layout(next);
  const point = await next.evaluate(() => {
    const stage = document.querySelector('#shipStage'), r = stage.getBoundingClientRect();
    for (const u of [.78, .22, .68, .32]) for (const v of [.52, .45, .65, .75]) {
      const x = r.x + r.width * u, y = r.y + r.height * v, el = document.elementFromPoint(x, y);
      if (el && stage.contains(el) && !el.closest('button,input,select,textarea,.ship-marker,.slot')) return { x, y };
    }
    throw Error('No unobstructed ship hover point');
  });
  await next.mouse.move(point.x, point.y);
  await next.waitForTimeout(600);
  report.pointer = await next.evaluate(() => window.__WATER_SEVEN_DEPTH__.status());
  assert.ok(report.pointer.pointer.some(value => Math.abs(value) > .1)); assert.deepEqual(await layout(next), before);
  await next.mouse.move(0, 0); await next.waitForTimeout(700);
  const rest = await next.evaluate(() => window.__WATER_SEVEN_DEPTH__.status()); await next.waitForTimeout(400);
  assert.equal((await next.evaluate(() => window.__WATER_SEVEN_DEPTH__.status())).frames, rest.frames, "Idle renderer must stop");
  await next.keyboard.press("F4"); await next.waitForTimeout(100);
  assert.equal(await next.evaluate(() => window.__WATER_SEVEN_DEPTH__.status().ready), false, "Calibration uses original artwork");
  await next.keyboard.press("F4"); await settled(next);
  await next.evaluate(() => { window.__qaLoseContext = document.querySelector(".ship-depth-canvas").getContext("webgl").getExtension("WEBGL_lose_context"); window.__qaLoseContext.loseContext(); });
  await next.waitForTimeout(100);
  assert.equal(await next.evaluate(() => getComputedStyle(document.querySelector("#shipImg")).opacity), "1");
  await next.evaluate(() => window.__qaLoseContext.restoreContext()); await settled(next);
  await next.evaluate(() => window.__WATER_SEVEN_DEPTH__.dispose());
  assert.equal(await next.locator(".ship-depth-canvas").count(), 0);
  report.cases.push({ label: `${viewport.width}:interaction-lifecycle`, ok: true, pointer: report.pointer, idleStops: true, calibration: true, contextRestore: true, disposed: true });
  await context.close();
}
async function fallbackChecks(browser) {
  for (const mode of ["touch", "reduced", "no-webgl", "missing-depth"]) {
    const context = await browser.newContext({ viewport: { width: 932, height: 430 }, ...(mode === "touch" ? { isMobile: true, hasTouch: true } : {}), ...(mode === "reduced" ? { reducedMotion: "reduce" } : {}) });
    const page = await context.newPage(); page.on("pageerror", error => report.errors.push(error.message));
    if (mode === "no-webgl") await page.addInitScript(() => { const original = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function(type, ...args) { return type === "webgl" ? null : original.call(this, type, ...args); }; });
    if (mode === "missing-depth") await page.route("**/js/board_water_seven_depth_data.json", route => route.fulfill({ status: 404, body: "missing" }));
    await page.goto(BASE + "/board_water_seven.html?ship=ship_01&lockShip=1");
    await settled(page, !["no-webgl", "missing-depth"].includes(mode));
    const status = await page.evaluate(() => window.__WATER_SEVEN_DEPTH__.status());
    if (["touch", "reduced"].includes(mode)) { await page.mouse.move(850, 270); await page.waitForTimeout(300); assert.deepEqual((await page.evaluate(() => window.__WATER_SEVEN_DEPTH__.status())).pointer, [0, 0]); }
    else { assert.equal(status.ready, false); assert.equal(await page.locator("#shipImg").evaluate(el => getComputedStyle(el).opacity), "1"); }
    await page.locator('[data-upgrade="training"]').click();
    assert.equal(await page.evaluate(() => upgrades.find(upgrade => upgrade.id === "training").level), 1);
    report.cases.push({ label: mode, ok: true, status }); await context.close();
  }
}
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true });
  try {
    if (!process.argv.includes("--fallback-only")) for (const viewport of [{ width: 1440, height: 900 }, { width: 932, height: 430 }]) await pairedVisuals(browser, viewport);
    await fallbackChecks(browser);
    assert.equal(report.errors.length, 0); report.ok = true;
  } catch (error) { report.failure = error.stack; process.exitCode = 1; }
  finally { fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2)); await browser.close(); }
  console.log(JSON.stringify({ ok: report.ok, cases: report.cases.length, assets: report.assets.length, failure: report.failure }));
})();
