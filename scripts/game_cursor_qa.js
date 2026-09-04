const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const BASE_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

const CARD_PAGES = ["start.html", "game.html", "result.html", "profile.html", "shop.html", "tutorial.html"];
const BOARD_PAGES = [
  "board_start.html",
  "board_fixed_viewport.html",
  "board_game.html",
  "board_battle.html",
  "board_impel_down.html",
  "board_marineford.html",
  "board_water_seven.html",
  "board_spar_selection_demo.html",
  "board_york_clue_puzzle_formal_demo.html",
];

const CURSOR_ASSETS = [
  "images/ui/cursors/card_cursor_buggy_glove_default_v1.png",
  "images/ui/cursors/card_cursor_buggy_glove_pointer_v1.png",
  "images/ui/cursors/card_cursor_buggy_glove_pressed_v1.png",
  "images/board/cursors/board_cursor_nami_chart_pen_default_v1.png",
  "images/board/cursors/board_cursor_nami_chart_pen_pointer_v1.png",
  "images/board/cursors/board_cursor_nami_chart_pen_pressed_v1.png",
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStaticContract() {
  for (const fileName of CARD_PAGES) {
    const source = fs.readFileSync(path.join(PUBLIC_ROOT, fileName), "utf8");
    assert(source.includes("css/card-cursor-buggy-v1.css?v=20260905-game-cursors-v1"), `${fileName} is missing the card cursor CSS`);
    assert(source.includes("js/game_cursor_feedback_v1.js?v=20260905-game-cursors-v1"), `${fileName} is missing the cursor feedback script`);
  }
  for (const fileName of BOARD_PAGES) {
    const source = fs.readFileSync(path.join(PUBLIC_ROOT, fileName), "utf8");
    assert(source.includes("css/board-cursor-nami-v1.css?v=20260905-game-cursors-v1"), `${fileName} is missing the board cursor CSS`);
    assert(source.includes("js/game_cursor_feedback_v1.js?v=20260905-game-cursors-v1"), `${fileName} is missing the cursor feedback script`);
  }
  for (const relativePath of CURSOR_ASSETS) {
    const bytes = fs.readFileSync(path.join(PUBLIC_ROOT, relativePath));
    assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", `${relativePath} is not a PNG`);
    assert(bytes.readUInt32BE(16) === 48 && bytes.readUInt32BE(20) === 48, `${relativePath} is not 48x48`);
    assert(bytes[25] === 6, `${relativePath} is not RGBA PNG`);
  }
}

async function inspectCursorPage(page, pagePath, expectedPrefix) {
  const response = await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  assert(response && response.ok(), `${pagePath} returned ${response?.status()}`);
  await page.waitForFunction(() => window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__ === true, null, { timeout: 10_000 });
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.id = "cursorQaButton";
    button.textContent = "QA";
    button.style.position = "fixed";
    button.style.left = "40px";
    button.style.top = "40px";
    button.style.width = "96px";
    button.style.height = "48px";
    button.style.zIndex = "2147483646";
    document.body.appendChild(button);
    const input = document.createElement("input");
    input.id = "cursorQaInput";
    input.style.position = "fixed";
    input.style.left = "40px";
    input.style.top = "100px";
    input.style.zIndex = "2147483646";
    document.body.appendChild(input);
  });
  await page.hover("#cursorQaButton");
  const initial = await page.evaluate(() => ({
    body: getComputedStyle(document.body).cursor,
    button: getComputedStyle(document.querySelector("#cursorQaButton")).cursor,
    input: getComputedStyle(document.querySelector("#cursorQaInput")).cursor,
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert(initial.body.includes(`${expectedPrefix}_default_v1.png`), `${pagePath} body did not use the themed default cursor`);
  assert(initial.button.includes(`${expectedPrefix}_pointer_v1.png`), `${pagePath} button did not use the themed pointer cursor`);
  assert(initial.input === "text", `${pagePath} text input cursor was not preserved`);

  const box = await page.locator("#cursorQaButton").boundingBox();
  assert(box, `${pagePath} QA button is missing`);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  const pressed = await page.evaluate(() => ({
    bodyClass: document.body.classList.contains("game-cursor-pressed"),
    pulseCount: document.querySelectorAll(".game-cursor-click-pulse").length,
    button: getComputedStyle(document.querySelector("#cursorQaButton")).cursor,
  }));
  assert(pressed.bodyClass && pressed.pulseCount === 1, `${pagePath} press feedback did not start`);
  assert(pressed.button.includes(`${expectedPrefix}_pressed_v1.png`), `${pagePath} pressed cursor did not render`);
  await page.mouse.up();
  await page.waitForTimeout(560);
  const released = await page.evaluate(() => ({
    bodyClass: document.body.classList.contains("game-cursor-pressed"),
    pulseCount: document.querySelectorAll(".game-cursor-click-pulse").length,
  }));
  assert(!released.bodyClass && released.pulseCount === 0, `${pagePath} press feedback did not clean up`);
  return initial.overflow;
}

async function inspectAlpha(page) {
  return page.evaluate(async (assets) => {
    const results = [];
    for (const asset of assets) {
      const image = new Image();
      image.src = `/${asset}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let minAlpha = 255;
      let maxAlpha = 0;
      for (let index = 3; index < pixels.length; index += 4) {
        minAlpha = Math.min(minAlpha, pixels[index]);
        maxAlpha = Math.max(maxAlpha, pixels[index]);
      }
      results.push({ asset, width: image.naturalWidth, height: image.naturalHeight, minAlpha, maxAlpha });
    }
    return results;
  }, CURSOR_ASSETS);
}

async function main() {
  assertStaticContract();
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const desktopPage = await desktop.newPage();
  const pageErrors = [];
  desktopPage.on("pageerror", (error) => pageErrors.push(error.message));

  const cardOverflow = await inspectCursorPage(desktopPage, "start.html", "card_cursor_buggy_glove");
  const alpha = await inspectAlpha(desktopPage);
  const boardOverflow = await inspectCursorPage(desktopPage, "board_start.html", "board_cursor_nami_chart_pen");
  const battleOverflow = await inspectCursorPage(desktopPage, "board_battle.html", "board_cursor_nami_chart_pen");
  assert(alpha.every((entry) => entry.width === 48 && entry.height === 48 && entry.minAlpha === 0 && entry.maxAlpha === 255), "Cursor alpha validation failed");

  const touch = await browser.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true });
  const touchPage = await touch.newPage();
  await touchPage.goto(`${BASE_URL}/board_start.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await touchPage.waitForFunction(() => window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__ === true, null, { timeout: 10_000 });
  const touchState = await touchPage.evaluate(() => ({
    fine: matchMedia("(hover: hover) and (pointer: fine)").matches,
    bodyCursor: getComputedStyle(document.body).cursor,
    pressed: document.body.classList.contains("game-cursor-pressed"),
    pulseCount: document.querySelectorAll(".game-cursor-click-pulse").length,
  }));
  assert(!touchState.fine && !touchState.bodyCursor.includes("board_cursor_nami_chart_pen"), "Touch mode should not apply the custom cursor");
  assert(!touchState.pressed && touchState.pulseCount === 0, "Touch mode should not create mouse feedback");

  await touch.close();
  await desktop.close();
  await browser.close();
  assert(pageErrors.length === 0, `Browser page errors: ${pageErrors.join(" | ")}`);

  console.log(`GAME_CURSOR_QA=PASS assets=${CURSOR_ASSETS.length} cardPages=${CARD_PAGES.length} boardPages=${BOARD_PAGES.length} desktop=1440x900 touch=932x430 alpha=transparent cardOverflow=${cardOverflow} boardOverflow=${boardOverflow} battleOverflow=${battleOverflow}`);
}

main().catch((error) => {
  console.error(`GAME_CURSOR_QA=FAIL ${error.stack || error}`);
  process.exitCode = 1;
});
