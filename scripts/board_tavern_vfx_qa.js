"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT ||
  "D:/LATTICE/projects/tabletop-series/qa-browser/node_modules/playwright-core");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18932";
const SANDBOX_URL = process.env.BOARD_QA_SANDBOX_URL || "http://127.0.0.1:18934";
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-tavern-vfx-20260928";
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const GRADES = ["E", "D", "C", "B", "A", "S"];
const DOOR_GAP_ROI = { left: 0.38, right: 0.62, top: 0.04, bottom: 0.95 };
const ROOT = new URL(ROOT_URL);
assert(["localhost", "127.0.0.1"].includes(ROOT.hostname), "VFX fixtures must run on loopback");
assert(["localhost", "127.0.0.1"].includes(new URL(SANDBOX_URL).hostname),
  "VFX sandbox QA must run on loopback");

async function ensureSandbox() {
  const url = SANDBOX_URL + "/vfx-sandbox";
  const healthy = async () => {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
      return response.ok && (await response.text()).includes("酒館招募 VFX 測試台");
    } catch (_) { return false; }
  };
  if (await healthy()) return null;
  const child = spawn(process.execPath, [path.join(__dirname, "board_tavern_vfx_sandbox_server.js")],
    { cwd: path.dirname(__dirname), stdio: "ignore", windowsHide: true });
  for (let attempt = 0; attempt < 30; attempt++) {
    await new Promise(resolve => setTimeout(resolve, 300));
    if (await healthy()) return child;
    if (child.exitCode !== null) break;
  }
  child.kill();
  throw new Error("VFX dev sandbox did not start on " + url);
}

function setupFixture() {
  document.querySelector("#qa-vfx-fixture")?.remove();
  const fixture = document.createElement("div");
  fixture.id = "qa-vfx-fixture";
  Object.assign(fixture.style, {
    position: "fixed", left: "0", top: "0", width: "min(100vw, 960px)",
    height: "min(100vh, 640px)", background: "rgb(3, 6, 11)", overflow: "hidden",
    zIndex: "2147483647", pointerEvents: "none",
  });
  document.body.append(fixture);
  return fixture;
}

function createMockResult(grade = "S") {
  document.querySelector("#qa-tavern-result")?.remove();
  const card = window.BoardCards.cards.find(entry => entry.id === "nami");
  if (!card) throw new Error("Nami card missing");
  const portrait = card.battlePortraits?.normal || card.battlePortraits?.idle;
  if (!portrait) throw new Error("Nami portrait missing");
  const result = document.createElement("section");
  result.id = "qa-tavern-result";
  result.className = "tavern-result-ui";
  result.dataset.tavernReveal = "v" + window.BoardTavernReveal.version;
  result.dataset.grade = grade;
  result.dataset.tavernOutcome = "invite";
  result.dataset.tavernHost = "luffy";
  result.innerHTML = '<div class="tavern-result-art"><img alt="娜美"></div>' +
    '<div class="tavern-result-name">娜美</div>' +
    '<button id="acceptRecruitBtn" type="button">加入</button>' +
    '<button id="rejectRecruitBtn" type="button">不加入</button>';
  result.querySelector("img").src = portrait;
  document.body.append(result);
  window.BoardTavernReveal.scan();
  return { portrait, grade: result.dataset.grade };
}

async function screenshotMetrics(page, bytes, roi = null) {
  return page.evaluate(async ({ encoded, roi }) => {
    const raw = Uint8Array.from(atob(encoded), char => char.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([raw], { type: "image/png" }));
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    const buckets = { pink: 0, gold: 0, green: 0, cyan: 0, blue: 0, purple: 0 };
    let lit = 0;
    let bright = 0;
    let white = 0;
    let colorful = 0;
    let maxLuminance = 0;
    const x0 = Math.floor(canvas.width * (roi?.left ?? 0.22));
    const x1 = Math.ceil(canvas.width * (roi?.right ?? 0.78));
    const y0 = Math.floor(canvas.height * (roi?.top ?? 0.08));
    const y1 = Math.ceil(canvas.height * (roi?.bottom ?? 0.96));
    for (let y = y0; y < y1; y += 2) {
      for (let x = x0; x < x1; x += 2) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        const hi = Math.max(r, g, b);
        const lo = Math.min(r, g, b);
        const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        maxLuminance = Math.max(maxLuminance, luma);
        if (luma > 42) lit++;
        if (luma > 95) bright++;
        if (luma > 115 && hi - lo < 29) white++;
        if (hi < 65 || hi - lo < 20) continue;
        colorful++;
        let hue;
        const delta = hi - lo;
        if (hi === r) hue = ((g - b) / delta + 6) % 6;
        else if (hi === g) hue = (b - r) / delta + 2;
        else hue = (r - g) / delta + 4;
        hue *= 60;
        if (hue < 20 || hue >= 335) buckets.pink++;
        else if (hue < 75) buckets.gold++;
        else if (hue < 155) buckets.green++;
        else if (hue < 205) buckets.cyan++;
        else if (hue < 250) buckets.blue++;
        else buckets.purple++;
      }
    }
    return { width: canvas.width, height: canvas.height, sampled: Math.ceil((x1 - x0) / 2) * Math.ceil((y1 - y0) / 2), lit, bright, white,
      colorful, buckets, maxLuminance: Math.round(maxLuminance) };
  }, { encoded: bytes.toString("base64"), roi });
}

async function capture(page, name, report, selector = "#qa-vfx-fixture", roi = null) {
  const filename = path.join(OUTPUT, name + ".png");
  const bytes = await page.locator(selector).screenshot({ path: filename, timeout: 10000 });
  const metrics = await screenshotMetrics(page, bytes, roi);
  report.screenshots.push({ file: filename, ...metrics });
  return metrics;
}

async function captureWhen(page, name, report, condition, timeoutMs = 6000) {
  const started = Date.now();
  const attempts = [];
  while (Date.now() - started < timeoutMs) {
    const bytes = await page.locator("#qa-vfx-fixture").screenshot({ timeout: 10000 });
    const metrics = await screenshotMetrics(page, bytes);
    attempts.push({ elapsedMs: Date.now() - started, buckets: metrics.buckets, white: metrics.white });
    if (condition(metrics)) {
      const filename = path.join(OUTPUT, name + ".png");
      fs.writeFileSync(filename, bytes);
      report.screenshots.push({ file: filename, ...metrics });
      return { ...metrics, attempts };
    }
    await page.waitForTimeout(160);
  }
  throw new Error(name + " phase did not appear: " + JSON.stringify(attempts));
}

async function loadBoard(page) {
  await page.goto(ROOT_URL + "/board_game.html?skipOpeningStory=1&tavern_vfx_qa=1",
    { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => window.BoardTavernVfx &&
    window.BoardTavernReveal && window.BoardCards?.cards, null, { timeout: 45000 });
}

async function waitReady(page, selector = "#qa-vfx-fixture") {
  await page.waitForFunction(css => {
    const node = document.querySelector(css);
    return node?.dataset.vfxReady === "1" && !!node.querySelector("canvas[data-tavern-vfx]");
  }, selector, { timeout: 30000 });
}

async function dispose(page) {
  await page.evaluate(() => {
    window.__qaVfxController?.dispose();
    window.__qaVfxController = null;
    document.querySelector("#qa-vfx-fixture")?.remove();
  });
  await page.waitForFunction(() => {
    const diagnostics = window.BoardTavernVfx.diagnostics();
    return diagnostics.liveControllerCount === 0 && diagnostics.liveTickerCount === 0 &&
      diagnostics.particleCount === 0 && !document.querySelector("canvas[data-tavern-vfx]");
  }, null, { timeout: 10000 });
}

async function directGrade(page, grade, report, check) {
  await page.evaluate(setupFixture);
  await page.evaluate(value => {
    const fixture = document.querySelector("#qa-vfx-fixture");
    window.__qaVfxController = window.BoardTavernVfx.create({
      container: fixture, grade: value, quality: "high", intensity: 1,
    });
    window.__qaVfxController.stage("invitation");
  }, grade);
  await waitReady(page);
  const invitation = await capture(page, grade + "-invitation", report);
  await page.evaluate(value => {
    if (value === "S") window.__qaVfxController.setTimeScale(0.25);
    window.__qaVfxController.stage("crack");
  }, grade);
  if (grade !== "S") await page.waitForTimeout(550);
  const crackEarly = grade === "S" ? await captureWhen(page, "S-crack-blue", report,
    metrics => metrics.buckets.blue + metrics.buckets.cyan > 20 &&
      metrics.buckets.blue + metrics.buckets.cyan > metrics.buckets.gold + metrics.buckets.purple) : null;
  const crackPurple = grade === "S" ? await captureWhen(page, "S-crack-purple", report,
    metrics => metrics.buckets.purple > 20 && metrics.buckets.purple > metrics.buckets.gold) : null;
  const crack = grade === "S" ? await captureWhen(page, "S-crack-gold", report,
    metrics => metrics.buckets.gold > 40 &&
      metrics.buckets.gold > metrics.buckets.blue + metrics.buckets.cyan + metrics.buckets.purple) :
    await capture(page, grade + "-crack", report);
  await page.evaluate(() => {
    window.__qaVfxController.setTimeScale(1);
    window.__qaVfxController.stage("glow");
  });
  if (grade !== "S") await page.waitForTimeout(800);
  const glow = grade === "S" ? await captureWhen(page, "S-glow-prism", report,
    metrics => Object.values(metrics.buckets).filter(count => count > 10).length >= 3 &&
      metrics.white > invitation.white + 3) : await capture(page, grade + "-glow", report);
  const state = await page.evaluate(() => ({
    stats: window.__qaVfxController.stats(),
    diagnostics: window.BoardTavernVfx.diagnostics(),
    canvasCount: document.querySelectorAll("#qa-vfx-fixture canvas[data-tavern-vfx]").length,
  }));
  report.grades.push({ grade, invitation, crackEarly, crackPurple, crack, glow, ...state });
  check(grade + " canvas exists and reports correct grade/stage", state.canvasCount === 1 &&
    state.stats.grade === grade && state.stats.stage === "glow" && state.stats.ready &&
    state.diagnostics.liveControllerCount === 1 && state.diagnostics.liveTickerCount === 1);
  check(grade + " visible VFX photons appear at first door crack",
    crack.lit > invitation.lit + 25 && crack.maxLuminance > invitation.maxLuminance + 15);
  check(grade + " glow has nonblank lit and white-core canvas pixels",
    glow.lit > invitation.lit + 50 && glow.white > invitation.white + 3);
  check(grade + " particle pool remains bounded", state.stats.particleCount >= 0 &&
    state.stats.particleCount <= 2000);
  await page.evaluate(() => {
    window.__qaVfxController.stage("glow");
    window.__qaVfxController.stage("silhouette");
    window.__qaVfxController.stage("reveal");
  });
  await dispose(page);
  check(grade + " disposal releases canvas, controller, ticker and particles", true);
}

async function integration(page, report, check) {
  const baseline = await page.evaluate(() => window.BoardTavernVfx.diagnostics());
  check("integration starts without live VFX resources", baseline.liveControllerCount === 0 &&
    baseline.liveTickerCount === 0);
  await page.evaluate(createMockResult);
  await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.ready === "1",
    null, { timeout: 55000 });
  await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "crack",
    null, { timeout: 8000 });
  await waitReady(page, ".tavern-reveal-vfx-layer");
  const crackObserved = await page.evaluate(() =>
    document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "crack");
  await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "glow",
    null, { timeout: 8000 });
  const reachedGlow = await page.evaluate(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "glow");
  await page.waitForTimeout(1050);
  const portal = await capture(page, "integration-S-door-prism-desktop", report,
    ".tavern-reveal-portal", DOOR_GAP_ROI);
  const glow = await capture(page, "integration-S-glow-desktop", report, ".tavern-reveal-overlay");
  const stage = await page.evaluate(() => ({
    stage: document.querySelector(".tavern-reveal-overlay")?.dataset.stage,
    canvas: !!document.querySelector(".tavern-reveal-scene canvas[data-tavern-vfx]"),
    ready: document.querySelector(".tavern-reveal-vfx-layer")?.dataset.vfxReady,
    line: document.querySelector(".tavern-reveal-line")?.textContent,
    stats: window.BoardTavernVfx.diagnostics(),
  }));
  report.integration = { crackObserved, portal, glow, reachedGlow, ...stage };
  check("real Tavern reveal drives Pixi crack and glow under Luffy invitation",
    crackObserved && reachedGlow && ["glow", "silhouette", "reveal", "choice"].includes(stage.stage) &&
    stage.canvas && stage.ready === "1" &&
    stage.line === "你真有趣，要不要加入我們？" && stage.stats.liveControllerCount === 1);
  check("real S door gap displays white core and multicolor prism",
    portal.white > 500 && portal.colorful > 1000 &&
    [portal.buckets.pink, portal.buckets.cyan, portal.buckets.blue, portal.buckets.purple]
      .filter(count => count > 100).length >= 3);
  await page.locator("[data-tavern-reveal-skip]").click();
  await page.locator(".tavern-reveal-overlay").waitFor({ state: "detached" });
  await page.waitForFunction(() => window.BoardTavernVfx.diagnostics().liveControllerCount === 0,
    null, { timeout: 10000 });
  check("skip detaches production overlay and VFX resources", !await page.locator("canvas[data-tavern-vfx]").count());
  await page.evaluate(createMockResult);
  await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.ready === "1",
    null, { timeout: 55000 });
  await page.locator("[data-tavern-reveal-skip]").click();
  await page.locator(".tavern-reveal-overlay").waitFor({ state: "detached" });
  await page.waitForFunction(() => window.BoardTavernVfx.diagnostics().liveControllerCount === 0,
    null, { timeout: 10000 });
  check("immediate replay and skip leave no VFX controller", true);
  await page.evaluate(() => document.querySelector("#qa-tavern-result")?.remove());
  for (const grade of ["A", "E"]) {
    await page.evaluate(createMockResult, grade);
    await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.ready === "1",
      null, { timeout: 55000 });
    await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "glow",
      null, { timeout: 8000 });
    await waitReady(page, ".tavern-reveal-vfx-layer");
    const beforeShot = await page.evaluate(() => ({
      grade: document.querySelector(".tavern-reveal-overlay")?.dataset.grade,
      stage: document.querySelector(".tavern-reveal-overlay")?.dataset.stage,
      canvas: !!document.querySelector(".tavern-reveal-scene canvas[data-tavern-vfx]"),
    }));
    const metrics = await capture(page, `integration-${grade}-door-glow-desktop`, report,
      ".tavern-reveal-portal", DOOR_GAP_ROI);
    report.composites.push({ grade, beforeShot, metrics });
    check(`${grade} real dual-door composite displays grade VFX`,
      beforeShot.grade === grade && beforeShot.stage === "glow" && beforeShot.canvas &&
      metrics.lit > 100 && metrics.bright > 10);
    await page.locator("[data-tavern-reveal-skip]").click();
    await page.locator(".tavern-reveal-overlay").waitFor({ state: "detached" });
    await page.waitForFunction(() => window.BoardTavernVfx.diagnostics().liveControllerCount === 0,
      null, { timeout: 10000 });
  }
  const aGap = report.composites.find(entry => entry.grade === "A")?.metrics;
  const eGap = report.composites.find(entry => entry.grade === "E")?.metrics;
  check("real A door-gap light reads gold; real E reads silver",
    aGap?.buckets.gold > eGap?.buckets.gold + 100 &&
    eGap?.colorful < aGap?.colorful * 0.3 && eGap?.white > 10);
  await page.evaluate(() => document.querySelector("#qa-tavern-result")?.remove());
}

async function mobile(page, report, check) {
  await page.evaluate(setupFixture);
  await page.evaluate(() => {
    const fixture = document.querySelector("#qa-vfx-fixture");
    window.__qaVfxController = window.BoardTavernVfx.create({
      container: fixture, grade: "S", quality: "low", intensity: 0.6,
    });
    window.__qaVfxController.stage("glow");
  });
  await waitReady(page);
  await page.waitForTimeout(1750);
  const shot = await capture(page, "mobile-390-S-glow", report);
  const detail = await page.evaluate(() => ({
    stats: window.__qaVfxController.stats(),
    viewport: { width: innerWidth, height: innerHeight },
    canvas: document.querySelector("canvas[data-tavern-vfx]")?.getBoundingClientRect().toJSON(),
  }));
  report.mobile = { shot, ...detail };
  check("390px mobile canvas is framed and nonblank", shot.width <= 390 &&
    shot.lit > 50 && detail.canvas.width <= 390 && detail.canvas.height <= 844);
  check("quality/intensity controls are reflected by controller", detail.stats.quality === "low" &&
    detail.stats.intensity === 0.6);
  await dispose(page);
}

async function fallback(page, report, check) {
  await page.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(String(type).toLowerCase())) return null;
      return native.call(this, type, ...args);
    };
  });
  await loadBoard(page);
  await page.evaluate(setupFixture);
  const outcome = await page.evaluate(async () => {
    const fixture = document.querySelector("#qa-vfx-fixture");
    const controller = window.BoardTavernVfx.create({ container: fixture, grade: "A" });
    controller?.stage("glow");
    await new Promise(resolve => setTimeout(resolve, 1200));
    const details = {
      controller: !!controller,
      ready: fixture.dataset.vfxReady,
      canvasCount: fixture.querySelectorAll("canvas[data-tavern-vfx]").length,
      diagnostics: window.BoardTavernVfx.diagnostics(),
    };
    controller?.dispose();
    fixture.remove();
    return details;
  });
  report.fallback = outcome;
  check("WebGL unavailable leaves CSS/DOM reveal path available and no live VFX", outcome.ready !== "1" &&
    outcome.diagnostics.liveTickerCount === 0 &&
    await page.evaluate(() => !!document.querySelector(".tavern-reveal-doors") ||
      !!document.querySelector("link[href*='board_tavern_reveal.css']")));
}

async function sandbox(browser, report, check) {
  const fpsSamples = async page => {
    const samples = [];
    for (let index = 0; index < 5; index++) {
      await page.waitForTimeout(600);
      samples.push(Number(await page.locator("#sandboxFps").textContent()));
    }
    return samples;
  };
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on("pageerror", error => report.errors.push("sandbox: " + error.message));
  await page.goto(SANDBOX_URL + "/vfx-sandbox", { waitUntil: "domcontentloaded", timeout: 30000 });
  await waitReady(page, "#sandboxVfxLayer");
  await page.waitForFunction(() => Number(document.querySelector("#sandboxFps")?.textContent) > 0,
    null, { timeout: 10000 });
  const start = await page.evaluate(() => ({
    grade: document.querySelector("#sandboxStage")?.dataset.grade,
    fps: Number(document.querySelector("#sandboxFps")?.textContent),
    resources: window.BoardTavernVfx.diagnostics(),
  }));
  check("dev sandbox starts with live S VFX and FPS readout",
    start.grade === "S" && start.fps > 0 && start.resources.liveControllerCount === 1);
  const highFpsSamples = await fpsSamples(page);
  await page.locator('[data-sandbox-grade="A"]').click();
  await page.locator("#sandboxQuality").selectOption("low");
  await page.locator("#sandboxIntensity").evaluate(input => {
    input.value = "0.5";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("#sandboxSpeed").selectOption("0.5");
  await waitReady(page, "#sandboxVfxLayer");
  const adjusted = await page.evaluate(() => ({
    grade: document.querySelector("#sandboxStage")?.dataset.grade,
    pressed: document.querySelector('[data-sandbox-grade="A"]')?.getAttribute("aria-pressed"),
    quality: document.querySelector("#sandboxQuality")?.value,
    intensity: document.querySelector("#sandboxIntensity")?.value,
    intensityReadout: document.querySelector("#sandboxIntensityValue")?.textContent,
    speed: document.querySelector("#sandboxSpeed")?.value,
    resources: window.BoardTavernVfx.diagnostics(),
  }));
  check("sandbox grade, quality, intensity and slow-motion controls apply",
    adjusted.grade === "A" && adjusted.pressed === "true" && adjusted.quality === "low" &&
    adjusted.intensity === "0.5" && adjusted.intensityReadout === "0.5" &&
    adjusted.speed === "0.5" && adjusted.resources.liveControllerCount === 1);
  const lowFpsSamples = await fpsSamples(page);
  const screenshot = path.join(OUTPUT, "sandbox-A-low-slow-desktop.png");
  await page.screenshot({ path: screenshot });
  report.screenshots.push({ file: screenshot, note: "Developer-only sandbox controls" });
  await page.locator("#sandboxSkip").click();
  await page.waitForFunction(() => window.BoardTavernVfx.diagnostics().liveControllerCount === 0,
    null, { timeout: 10000 });
  check("sandbox skip releases canvas, controller and ticker",
    await page.evaluate(() => !document.querySelector("canvas[data-tavern-vfx]") &&
      window.BoardTavernVfx.diagnostics().liveTickerCount === 0));
  await page.locator("#sandboxReplay").click();
  await waitReady(page, "#sandboxVfxLayer");
  check("sandbox replay restores one live VFX controller",
    await page.evaluate(() => window.BoardTavernVfx.diagnostics().liveControllerCount === 1));
  report.sandbox = { start, adjusted, highFpsSamples, lowFpsSamples,
    note: "Headless Chrome SwiftShader software WebGL samples, not physical-device FPS." };
  await page.close();
  const noWebgl = await browser.newPage({ viewport: { width: 960, height: 640 } });
  noWebgl.on("pageerror", error => report.errors.push("sandbox-fallback: " + error.message));
  await noWebgl.addInitScript(() => {
    const native = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(String(type).toLowerCase())) return null;
      return native.call(this, type, ...args);
    };
  });
  await noWebgl.goto(SANDBOX_URL + "/vfx-sandbox", { waitUntil: "domcontentloaded", timeout: 30000 });
  await noWebgl.waitForFunction(() => document.querySelector("#vfxFallback")?.textContent.includes("WebGL 不可用"),
    null, { timeout: 10000 });
  check("sandbox explicitly reports WebGL fallback", true);
  await noWebgl.close();
}

async function main() {
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = {
    ok: false, rootUrl: ROOT_URL, scope: "Local automated Chrome/WebGL fixture and actual Tavern overlay; not human-play, physical-device, or public acceptance.",
    checks: [], errors: [], screenshots: [], grades: [], composites: [], cycles: [],
  };
  const check = (name, condition) => {
    assert(condition, name);
    report.checks.push(name);
    console.log("PASS " + name);
  };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME,
    args: ["--enable-webgl", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });
  let sandboxServer = null;
  try {
    sandboxServer = await ensureSandbox();
    const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    desktop.on("pageerror", error => report.errors.push("desktop: " + error.message));
    await loadBoard(desktop);
    const api = await desktop.evaluate(() => ({
      revealVersion: window.BoardTavernReveal.version,
      vfxVersion: window.BoardTavernVfx.version,
      hasCreate: typeof window.BoardTavernVfx.create === "function",
      hasDiagnostics: typeof window.BoardTavernVfx.diagnostics === "function",
    }));
    report.api = api;
    check("production Board loads VFX and Tavern v4 APIs", api.hasCreate &&
      api.hasDiagnostics && Number(api.revealVersion) >= 4);
    for (const grade of GRADES) await directGrade(desktop, grade, report, check);
    const byGrade = Object.fromEntries(report.grades.map(entry => [entry.grade, entry]));
    check("A gold exceeds purple/blue/green in colored glow pixels",
      byGrade.A.glow.buckets.gold > byGrade.A.glow.buckets.purple &&
      byGrade.A.glow.buckets.gold > byGrade.A.glow.buckets.blue &&
      byGrade.A.glow.buckets.gold > byGrade.A.glow.buckets.green);
    check("B purple edge is present", byGrade.B.glow.buckets.purple > 20);
    check("C blue/cyan edge is present", byGrade.C.glow.buckets.blue + byGrade.C.glow.buckets.cyan > 20);
    check("D green edge is present", byGrade.D.glow.buckets.green > 20);
    check("E silver remains mostly neutral", byGrade.E.glow.white > 5 &&
      byGrade.E.glow.colorful < byGrade.B.glow.colorful);
    check("S blue, purple, fake-gold crack and later multicolor prism",
      byGrade.S.crackEarly.buckets.blue + byGrade.S.crackEarly.buckets.cyan > 20 &&
      byGrade.S.crackPurple.buckets.purple > 20 &&
      byGrade.S.crack.buckets.gold > 40 &&
      Object.values(byGrade.S.glow.buckets).filter(count => count > 10).length >= 3);
    for (let index = 0; index < 5; index++) {
      await desktop.evaluate(setupFixture);
      await desktop.evaluate(() => {
        const fixture = document.querySelector("#qa-vfx-fixture");
        window.__qaVfxController = window.BoardTavernVfx.create({ container: fixture, grade: "S" });
        window.__qaVfxController.stage("crack");
        window.__qaVfxController.stage("glow");
      });
      await waitReady(desktop);
      await desktop.waitForTimeout(500);
      const stats = await desktop.evaluate(() => window.__qaVfxController.stats());
      await dispose(desktop);
      report.cycles.push({ index: index + 1, stats });
      check("S repeated pull " + (index + 1) + " renders and releases resources",
        stats.grade === "S" && stats.ready);
    }
    await integration(desktop, report, check);
    const mobilePage = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    mobilePage.on("pageerror", error => report.errors.push("mobile: " + error.message));
    await loadBoard(mobilePage);
    await mobile(mobilePage, report, check);
    await mobilePage.close();
    const fallbackPage = await browser.newPage({ viewport: { width: 960, height: 640 } });
    fallbackPage.on("pageerror", error => report.errors.push("fallback: " + error.message));
    await fallback(fallbackPage, report, check);
    await fallbackPage.close();
    await sandbox(browser, report, check);
    check("no uncaught browser errors", report.errors.length === 0);
    await desktop.close();
    report.ok = true;
  } catch (error) {
    report.failure = error.stack || String(error);
    throw error;
  } finally {
    await browser.close();
    sandboxServer?.kill();
    const file = path.join(OUTPUT, "result.json");
    fs.writeFileSync(file, JSON.stringify(report, null, 2) + "\n");
    console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length,
      errors: report.errors.length, report: file, failure: report.failure || null }));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
