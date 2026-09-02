"use strict";

const path = require("path");
const { spawn } = require("child_process");
const { chromium } = require("playwright");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const LOCAL_URL = process.env.LAUNCHER_LOCAL_URL || "http://127.0.0.1:8787";
const ACCOUNT_PORT = Number(process.env.LAUNCHER_ACCOUNT_QA_PORT || 8798);
const ACCOUNT_URL = `http://127.0.0.1:${ACCOUNT_PORT}`;
const CHROME_PATH = process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForHttp(url, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { cache: "no-store" });
      if (response.ok) return;
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
  throw new Error(`server timeout: ${url}`);
}

async function readStage(page) {
  return page.locator("body").getAttribute("data-launcher-entry-stage");
}

async function assertCardInsideViewport(page, label) {
  const card = page.locator(".launcher-auth-card");
  const box = await card.boundingBox();
  const viewport = page.viewportSize();
  assert(box && viewport, `${label}: missing login card bounds`);
  assert(box.x >= -0.5 && box.y >= -0.5, `${label}: login card starts outside viewport`);
  assert(box.x + box.width <= viewport.width + 0.5, `${label}: login card overflows horizontally`);
  assert(box.y + box.height <= viewport.height + 0.5, `${label}: login card overflows vertically`);
  const pageOverflow = await page.evaluate(() => ({
    x: document.documentElement.scrollWidth - innerWidth,
    y: document.documentElement.scrollHeight - innerHeight,
  }));
  assert(pageOverflow.x <= 1 && pageOverflow.y <= 1, `${label}: document overflow ${JSON.stringify(pageOverflow)}`);
}

async function enterLocalGallery(page) {
  await page.addInitScript(() => {
    localStorage.setItem("opSecret", "stale-local-secret");
    localStorage.setItem("op_secret", "stale-local-secret");
    localStorage.setItem("op_user_id", "123");
    localStorage.setItem("op_board_user_id", "123");
  });
  await page.goto(`${LOCAL_URL}/game_launcher_preview.html`, { waitUntil: "networkidle" });
  assert(await readStage(page) === "press", "local: initial stage is not press");
  await page.evaluate(() => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "r", ctrlKey: true, bubbles: true, cancelable: true }));
  });
  assert(await readStage(page) === "press", "local: browser shortcut incorrectly opened entry flow");
  assert(await page.locator(".launcher-stage").getAttribute("aria-hidden") === "true", "local: gallery is exposed before entry");
  assert(await page.locator("video[src]").count() === 0, "local: preview videos loaded before gallery");
  await page.locator("#launcherEntryStartBtn").click({ position: { x: 20, y: 20 } });
  await page.waitForFunction(() => document.body.dataset.launcherEntryStage === "auth");
  assert(await page.locator("body").getAttribute("data-launcher-auth-source") === "local-preview", "local: loopback bypass was not isolated");
  assert(await page.locator("#launcherAuthRegisterTab").isHidden(), "local: register must be hidden without database");
  await page.locator("#launcherAuthSubmitBtn").click();
  await page.waitForFunction(() => document.body.dataset.launcherEntryStage === "gallery");
  const localIdentity = await page.evaluate(() => ({
    secret: localStorage.getItem("opSecret") || localStorage.getItem("op_secret"),
    userId: Number(localStorage.getItem("op_user_id") || 0),
  }));
  assert(localIdentity.secret === null, "local: stale account secret survived preview login");
  assert(localIdentity.userId >= 700000, "local: preview identity was not normalized");
}

async function testLocalFlow(browser) {
  const context = await browser.newContext({ viewport: { width: 1540, height: 660 } });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await enterLocalGallery(page);
  await page.mouse.move(5, 5);
  await page.waitForTimeout(500);

  const links = await page.locator(".game-pick").evaluateAll((nodes) => nodes.map((node) => new URL(node.href).pathname));
  assert(JSON.stringify(links) === JSON.stringify(["/start.html", "/board_start.html", "/battle_chess/index.html"]), `local: links changed ${JSON.stringify(links)}`);
  assert(await page.locator(".chess-edition").getAttribute("class").then((value) => !value.includes("is-unavailable")), "local: chess development link was not enabled");

  const boxes = await page.locator(".game-box").evaluateAll((nodes) => nodes.map((node) => {
    const rect = node.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  }));
  const expectedX = [180.656, 619.984, 1059.328];
  boxes.forEach((box, index) => {
    assert(Math.abs(box.x - expectedX[index]) < 1, `local: box ${index + 1} x shifted to ${box.x}`);
    assert(Math.abs(box.y - 213.813) < 1, `local: box ${index + 1} y shifted to ${box.y}`);
    assert(Math.abs(box.width - 300) < 1 && Math.abs(box.height - 400) < 1, `local: box ${index + 1} size changed`);
  });

  await page.locator(".board-edition .game-pick").hover();
  await page.waitForFunction(() => document.querySelector(".board-edition")?.classList.contains("is-preview-playing"), null, { timeout: 10000 });
  assert(await page.locator(".board-edition video").getAttribute("src"), "local: hover video did not load");
  await page.mouse.move(5, 5);
  await page.waitForFunction(() => !document.querySelector(".board-edition video")?.hasAttribute("src"));

  assert(errors.length === 0, `local: page errors ${errors.join(" | ")}`);
  await context.close();
  return { links, boxes, errors };
}

async function testResponsiveAuth(browser, viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(String(error)));
  await page.goto(`${LOCAL_URL}/game_launcher_preview.html`, { waitUntil: "networkidle" });
  await page.locator("#launcherEntryStartBtn").click({ position: { x: 10, y: 10 } });
  await page.waitForFunction(() => document.body.dataset.launcherEntryStage === "auth");
  await assertCardInsideViewport(page, `${viewport.width}x${viewport.height}`);
  const inputFontSize = await page.locator("#launcherAuthUsername").evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  assert(inputFontSize >= 16, `${viewport.width}x${viewport.height}: input font can trigger iOS zoom (${inputFontSize}px)`);
  assert(errors.length === 0, `${viewport.width}x${viewport.height}: page errors ${errors.join(" | ")}`);
  await context.close();
}

async function testAccountFlow(browser) {
  const qaServer = spawn(process.execPath, [path.join(PROJECT_ROOT, "scripts", "board_home_social_qa_server.js")], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, PORT: String(ACCOUNT_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let serverOutput = "";
  qaServer.stdout.on("data", (chunk) => { serverOutput += String(chunk); });
  qaServer.stderr.on("data", (chunk) => { serverOutput += String(chunk); });

  try {
    await waitForHttp(`${ACCOUNT_URL}/api/board-runtime`);
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addInitScript(() => localStorage.setItem("op_last_password", "legacy-plaintext-must-be-removed"));
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    await page.goto(`${ACCOUNT_URL}/game_launcher_preview.html`, { waitUntil: "networkidle" });
    await page.locator("#launcherEntryStartBtn").click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(() => document.body.dataset.launcherEntryStage === "auth");
    assert(await page.locator("body").getAttribute("data-launcher-auth-source") === "same-origin", "account: did not use same-origin auth");
    await page.locator("#launcherAuthUsername").fill("qa_board_guest");
    await page.locator("#launcherAuthPassword").fill("qa-board-pass");
    await page.locator("#launcherAuthSubmitBtn").click();
    await page.waitForFunction(() => document.body.dataset.launcherEntryStage === "gallery", null, { timeout: 15000 });
    const stored = await page.evaluate(() => ({
      hasSecret: Boolean(localStorage.getItem("opSecret")),
      secretsMatch: localStorage.getItem("opSecret") === localStorage.getItem("op_secret"),
      userId: localStorage.getItem("op_user_id"),
      lastPassword: localStorage.getItem("op_last_password"),
      passwordValue: document.querySelector("#launcherAuthPassword")?.value || "",
    }));
    assert(stored.hasSecret && stored.secretsMatch, "account: shared secret keys were not saved");
    assert(stored.userId === "91004", `account: canonical user id missing (${stored.userId})`);
    assert(stored.lastPassword === null && stored.passwordValue === "", "account: plaintext password remained in DOM/storage");

    await page.reload({ waitUntil: "networkidle" });
    assert(await readStage(page) === "press", "account: reload must return to press stage");
    await page.locator("#launcherEntryStartBtn").click({ position: { x: 20, y: 20 } });
    await page.waitForFunction(() => document.body.dataset.launcherEntryStage === "gallery", null, { timeout: 15000 });
    assert(await page.locator(".card-edition .game-pick").getAttribute("href") === "start.html", "account: card game link is missing");
    assert(await page.locator(".board-edition .game-pick").getAttribute("href") === "board_start.html", "account: Board link is missing");
    assert(await page.locator(".chess-edition .game-pick").getAttribute("href") === null, "account: postponed chess was linked in production mode");
    assert(await page.locator(".chess-edition .game-pick").getAttribute("aria-disabled") === "true", "account: postponed chess was not marked unavailable");
    assert(await page.locator(".chess-edition video").count() === 0, "account: postponed chess preview was included");
    assert(errors.length === 0, `account: page errors ${errors.join(" | ")}`);
    await context.close();
    return { stored: { ...stored, hasSecret: Boolean(stored.hasSecret) }, errors };
  } catch (error) {
    error.message += `\nQA server output:\n${serverOutput.slice(-3000)}`;
    throw error;
  } finally {
    qaServer.kill();
  }
}

(async () => {
  await waitForHttp(`${LOCAL_URL}/api/board-runtime`);
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  try {
    const local = await testLocalFlow(browser);
    await testResponsiveAuth(browser, { width: 932, height: 430 });
    await testResponsiveAuth(browser, { width: 390, height: 844 });
    const account = await testAccountFlow(browser);
    console.log(JSON.stringify({ ok: true, local, responsive: ["932x430", "390x844"], account }, null, 2));
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exitCode = 1;
});
