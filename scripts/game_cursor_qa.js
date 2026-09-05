const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
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
  "images/ui/cursors/card_cursor_buggy_glove_default_v2.png",
  "images/ui/cursors/card_cursor_buggy_glove_pointer_v2.png",
  "images/ui/cursors/card_cursor_buggy_glove_pressed_v2.png",
  "images/board/cursors/board_cursor_nami_quill_default_v3.png",
  "images/board/cursors/board_cursor_nami_quill_pointer_v3.png",
  "images/board/cursors/board_cursor_nami_quill_pressed_v3.png",
];
const BOARD_CURSOR_ROTATION_PAIRS = ["default", "pointer", "pressed"].map((state) => ({
  source: `images/board/cursors/board_cursor_nami_quill_${state}_v2.png`,
  current: `images/board/cursors/board_cursor_nami_quill_${state}_v3.png`,
}));
let activeBrowser = null;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function isolateCursorQaNetwork(context) {
  const expectedOrigin = new URL(BASE_URL).origin;
  await context.route("**/*", (route) => {
    const requestUrl = route.request().url();
    if (/^https?:/i.test(requestUrl) && new URL(requestUrl).origin !== expectedOrigin) {
      return route.abort();
    }
    return route.continue();
  });
}

function assertStaticContract() {
  for (const fileName of CARD_PAGES) {
    const source = fs.readFileSync(path.join(PUBLIC_ROOT, fileName), "utf8");
    assert(source.includes("css/card-cursor-buggy-v3.css?v=20260905-game-cursors-v3"), `${fileName} is missing the V3 card cursor CSS`);
    assert(!source.includes("card-cursor-buggy-v1.css") && !source.includes("card-cursor-buggy-v2.css"), `${fileName} still loads an older card cursor CSS`);
    assert(source.includes("js/game_cursor_feedback_v1.js?v=20260905-game-cursors-v1"), `${fileName} is missing the cursor feedback script`);
  }
  for (const fileName of BOARD_PAGES) {
    const source = fs.readFileSync(path.join(PUBLIC_ROOT, fileName), "utf8");
    assert(source.includes("css/board-cursor-nami-v3.css?v=20260905-game-cursors-v3"), `${fileName} is missing the V3 board cursor CSS`);
    assert(!source.includes("board-cursor-nami-v1.css") && !source.includes("board-cursor-nami-v2.css"), `${fileName} still loads an older board cursor CSS`);
    assert(source.includes("js/game_cursor_feedback_v1.js?v=20260905-game-cursors-v1"), `${fileName} is missing the cursor feedback script`);
  }
  for (const relativePath of CURSOR_ASSETS) {
    const bytes = fs.readFileSync(path.join(PUBLIC_ROOT, relativePath));
    assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", `${relativePath} is not a PNG`);
    assert(bytes.readUInt32BE(16) === 48 && bytes.readUInt32BE(20) === 48, `${relativePath} is not 48x48`);
    assert(bytes[25] === 6, `${relativePath} is not RGBA PNG`);
  }
  const hashes = CURSOR_ASSETS.map((relativePath) =>
    crypto.createHash("sha256").update(fs.readFileSync(path.join(PUBLIC_ROOT, relativePath))).digest("hex")
  );
  assert(new Set(hashes).size === CURSOR_ASSETS.length, "Cursor states must use six distinct image files");

  const cardCss = fs.readFileSync(path.join(PUBLIC_ROOT, "css/card-cursor-buggy-v3.css"), "utf8");
  const boardCss = fs.readFileSync(path.join(PUBLIC_ROOT, "css/board-cursor-nami-v3.css"), "utf8");
  assert(cardCss.includes("card_cursor_buggy_glove_pointer_v2.png\") 11 13"), "Buggy glove hotspot is not aligned to the pinch point");
  assert(boardCss.includes("board_cursor_nami_quill_default_v3.png\") 4 43"), "Nami default quill hotspot is not aligned to the lower-left nib");
  assert(boardCss.includes("board_cursor_nami_quill_pointer_v3.png\") 4 43"), "Nami pointer quill hotspot is not aligned to the lower-left nib");
  assert(boardCss.includes("board_cursor_nami_quill_pressed_v3.png\") 5 43"), "Nami pressed quill hotspot is not aligned to the lower-left nib");
  assert(boardCss.includes(".board-viewport") && boardCss.includes(".lineage-cylinder-scene") && boardCss.includes("[draggable=\"true\"]"), "Board drag surfaces are not pinned to the themed quill");
  assert(boardCss.includes("scrollbar-width: none") && boardCss.includes("html::-webkit-scrollbar"), "Board root scrollbar hiding is missing");
  assert(cardCss.includes("scrollbar-width: none") && cardCss.includes("html::-webkit-scrollbar"), "Card root scrollbar hiding is missing");
  assert(boardCss.includes("conic-gradient") && boardCss.includes("boardInkCircleV3"), "Board black-ink selection feedback is missing");
}

async function inspectCursorPage(page, pagePath, expectedPrefix) {
  const assetVersion = expectedPrefix === "board_cursor_nami_quill" ? "v3" : "v2";
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
    const disabled = document.createElement("button");
    disabled.id = "cursorQaDisabled";
    disabled.disabled = true;
    disabled.style.position = "fixed";
    disabled.style.left = "160px";
    disabled.style.top = "40px";
    document.body.appendChild(disabled);
    const poster = document.createElement("div");
    poster.id = "cursorQaPoster";
    poster.className = "poster";
    document.body.appendChild(poster);
    for (const cursor of ["grab", "grabbing", "crosshair", "wait"]) {
      const node = document.createElement("div");
      node.dataset.qaCursor = cursor;
      node.style.cursor = cursor;
      if (cursor === "grab") node.className = "board-viewport";
      if (cursor === "grabbing") node.className = "board-viewport dragging";
      document.body.appendChild(node);
    }
    const draggable = document.createElement("div");
    draggable.id = "cursorQaDraggable";
    draggable.draggable = true;
    draggable.style.cursor = "grab";
    document.body.appendChild(draggable);
  });
  await page.evaluate(() => {
    document.querySelector("#cursorQaButton").dispatchEvent(new PointerEvent("pointerover", {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
    }));
  });
  const initial = await page.evaluate(() => ({
    body: getComputedStyle(document.body).cursor,
    button: getComputedStyle(document.querySelector("#cursorQaButton")).cursor,
    input: getComputedStyle(document.querySelector("#cursorQaInput")).cursor,
    disabled: getComputedStyle(document.querySelector("#cursorQaDisabled")).cursor,
    poster: getComputedStyle(document.querySelector("#cursorQaPoster")).cursor,
    semantic: [...document.querySelectorAll("[data-qa-cursor]")].map((node) => getComputedStyle(node).cursor),
    draggable: getComputedStyle(document.querySelector("#cursorQaDraggable")).cursor,
    rootScrollbar: {
      standard: getComputedStyle(document.documentElement).scrollbarWidth,
      webkitDisplay: getComputedStyle(document.documentElement, "::-webkit-scrollbar").display,
      webkitWidth: getComputedStyle(document.documentElement, "::-webkit-scrollbar").width,
    },
    overflow: document.documentElement.scrollWidth > innerWidth + 1,
  }));
  assert(initial.body.includes(`${expectedPrefix}_default_${assetVersion}.png`), `${pagePath} body did not use the themed default cursor`);
  assert(initial.button.includes(`${expectedPrefix}_pointer_${assetVersion}.png`), `${pagePath} button did not use the themed pointer cursor`);
  assert(initial.input === "text", `${pagePath} text input cursor was not preserved`);
  assert(initial.disabled.includes(`${expectedPrefix}_default_${assetVersion}.png`), `${pagePath} disabled control looked interactive`);
  assert(initial.rootScrollbar.standard === "none", `${pagePath} root scrollbar was not hidden`);
  assert(initial.rootScrollbar.webkitDisplay === "none" || initial.rootScrollbar.webkitWidth === "0px", `${pagePath} WebKit root scrollbar gutter remained visible`);
  if (expectedPrefix === "card_cursor_buggy_glove") {
    assert(initial.poster === "zoom-in", `${pagePath} card poster zoom cursor was not preserved`);
    assert(initial.semantic.join(",") === "grab,grabbing,crosshair,wait", `${pagePath} card semantic cursors were unexpectedly replaced`);
    assert(initial.draggable === "grab", `${pagePath} card drag cursor was unexpectedly replaced`);
  } else {
    assert(initial.semantic[0].includes("board_cursor_nami_quill_pointer_v3.png"), `${pagePath} Board grab surface lost the quill`);
    assert(initial.semantic[1].includes("board_cursor_nami_quill_pressed_v3.png"), `${pagePath} Board grabbing surface lost the pressed quill`);
    assert(initial.semantic.slice(2).join(",") === "crosshair,wait", `${pagePath} Board crosshair/wait semantics changed unexpectedly`);
    assert(initial.draggable.includes("board_cursor_nami_quill_pointer_v3.png"), `${pagePath} draggable Board control lost the quill`);
  }

  await page.evaluate(() => {
    document.querySelector("#cursorQaButton").dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      button: 0,
      clientX: 88,
      clientY: 64,
      isPrimary: true,
      pointerType: "mouse",
    }));
  });
  const pressed = await page.evaluate(() => ({
    bodyClass: document.body.classList.contains("game-cursor-pressed"),
    pulseCount: document.querySelectorAll(".game-cursor-click-pulse").length,
    button: getComputedStyle(document.querySelector("#cursorQaButton")).cursor,
    inkCircle: getComputedStyle(document.querySelector(".game-cursor-click-pulse"), "::before").backgroundImage,
  }));
  assert(pressed.bodyClass && pressed.pulseCount === 1, `${pagePath} press feedback did not start`);
  assert(pressed.button.includes(`${expectedPrefix}_pressed_${assetVersion}.png`), `${pagePath} pressed cursor did not render`);
  if (expectedPrefix === "board_cursor_nami_quill") {
    assert(pressed.inkCircle.includes("conic-gradient"), `${pagePath} black-ink selection circle did not render`);
  }
  await page.evaluate(() => {
    document.querySelector("#cursorQaButton").dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      button: 0,
      isPrimary: true,
      pointerType: "mouse",
    }));
  });
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

async function inspectBoardRotation(page) {
  return page.evaluate(async (pairs) => {
    async function readPixels(asset) {
      const image = new Image();
      image.src = `/${asset}`;
      await image.decode();
      const canvas = document.createElement("canvas");
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: context.getImageData(0, 0, canvas.width, canvas.height).data,
      };
    }

    const results = [];
    for (const pair of pairs) {
      const source = await readPixels(pair.source);
      const current = await readPixels(pair.current);
      let rotatedAlphaMismatches = 0;
      let weight = 0;
      let sumX = 0;
      let sumY = 0;
      let minX = current.width;
      let minY = current.height;
      let maxX = -1;
      let maxY = -1;
      for (let y = 0; y < current.height; y += 1) {
        for (let x = 0; x < current.width; x += 1) {
          const currentIndex = ((y * current.width) + x) * 4;
          const sourceX = source.width - 1 - y;
          const sourceY = x;
          const sourceIndex = ((sourceY * source.width) + sourceX) * 4;
          const alpha = current.pixels[currentIndex + 3];
          if (alpha !== source.pixels[sourceIndex + 3]) rotatedAlphaMismatches += 1;
          if (alpha >= 64) {
            weight += alpha;
            sumX += x * alpha;
            sumY += y * alpha;
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        }
      }
      const meanX = sumX / weight;
      const meanY = sumY / weight;
      let covariance = 0;
      let varianceX = 0;
      let varianceY = 0;
      for (let y = 0; y < current.height; y += 1) {
        for (let x = 0; x < current.width; x += 1) {
          const alpha = current.pixels[((y * current.width) + x) * 4 + 3];
          if (alpha < 64) continue;
          const dx = x - meanX;
          const dy = y - meanY;
          covariance += alpha * dx * dy;
          varianceX += alpha * dx * dx;
          varianceY += alpha * dy * dy;
        }
      }
      results.push({
        ...pair,
        rotatedAlphaMismatches,
        correlation: covariance / Math.sqrt(varianceX * varianceY),
        bounds: { minX, minY, maxX, maxY },
      });
    }
    return results;
  }, BOARD_CURSOR_ROTATION_PAIRS);
}

async function inspectHiddenRootScrollbarStillScrolls(page, pagePath) {
  await page.evaluate(() => {
    document.documentElement.style.setProperty("overflow-y", "auto", "important");
    document.body.style.setProperty("overflow-y", "visible", "important");
    document.body.style.setProperty("min-height", "220vh", "important");
    window.scrollTo(0, 0);
  });
  await page.mouse.move(720, 450);
  await page.mouse.wheel(0, 640);
  await page.waitForFunction(() => window.scrollY > 0, null, { timeout: 3_000 });
  const result = await page.evaluate(() => ({
    scrollY: window.scrollY,
    scrollHeight: document.documentElement.scrollHeight,
    clientHeight: document.documentElement.clientHeight,
    standard: getComputedStyle(document.documentElement).scrollbarWidth,
    webkitDisplay: getComputedStyle(document.documentElement, "::-webkit-scrollbar").display,
    webkitWidth: getComputedStyle(document.documentElement, "::-webkit-scrollbar").width,
  }));
  assert(result.scrollHeight > result.clientHeight, `${pagePath} root fixture did not overflow vertically`);
  assert(result.scrollY > 0, `${pagePath} could not scroll after hiding the root gutter`);
  assert(result.standard === "none", `${pagePath} exposed the standard root scrollbar`);
  assert(result.webkitDisplay === "none" || result.webkitWidth === "0px", `${pagePath} exposed the WebKit root scrollbar`);
  return result;
}

async function main() {
  assertStaticContract();
  const browser = await chromium.launch({ executablePath: CHROME_PATH, headless: true });
  activeBrowser = browser;
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await isolateCursorQaNetwork(desktop);
  const desktopPage = await desktop.newPage();
  const pageErrors = [];
  desktopPage.on("pageerror", (error) => pageErrors.push(error.message));

  const cardOverflow = await inspectCursorPage(desktopPage, "start.html", "card_cursor_buggy_glove");
  const cardScroll = await inspectHiddenRootScrollbarStillScrolls(desktopPage, "start.html");
  const alpha = await inspectAlpha(desktopPage);
  const boardOverflow = await inspectCursorPage(desktopPage, "board_start.html", "board_cursor_nami_quill");
  const boardScroll = await inspectHiddenRootScrollbarStillScrolls(desktopPage, "board_start.html");
  const boardRotation = await inspectBoardRotation(desktopPage);
  const battleOverflow = await inspectCursorPage(desktopPage, "board_battle.html", "board_cursor_nami_quill");
  assert(!cardOverflow && !boardOverflow && !battleOverflow, "Custom cursors introduced horizontal overflow");
  assert(alpha.every((entry) => entry.width === 48 && entry.height === 48 && entry.minAlpha === 0 && entry.maxAlpha === 255), "Cursor alpha validation failed");
  assert(boardRotation.every((entry) => entry.rotatedAlphaMismatches === 0), `Board V3 assets are not exact 90-degree counter-clockwise rotations: ${JSON.stringify(boardRotation)}`);
  assert(boardRotation.every((entry) => entry.correlation < -0.8), `Board V3 quill does not run from the lower-left nib toward the upper-right feather: ${JSON.stringify(boardRotation)}`);
  assert(boardRotation.every((entry) => entry.bounds.minX >= 1 && entry.bounds.minY >= 1 && entry.bounds.maxX <= 46 && entry.bounds.maxY <= 46), `Board V3 quill is clipped by its cursor canvas: ${JSON.stringify(boardRotation)}`);

  const touch = await browser.newContext({ viewport: { width: 932, height: 430 }, hasTouch: true, isMobile: true });
  await isolateCursorQaNetwork(touch);
  const touchPage = await touch.newPage();
  await touchPage.goto(`${BASE_URL}/board_start.html`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await touchPage.waitForFunction(() => window.__ONE_PIECE_GAME_CURSOR_FEEDBACK_V1__ === true, null, { timeout: 10_000 });
  const touchState = await touchPage.evaluate(() => ({
    fine: matchMedia("(hover: hover) and (pointer: fine)").matches,
    bodyCursor: getComputedStyle(document.body).cursor,
    pressed: document.body.classList.contains("game-cursor-pressed"),
    pulseCount: document.querySelectorAll(".game-cursor-click-pulse").length,
  }));
  assert(!touchState.fine && !touchState.bodyCursor.includes("board_cursor_nami_quill"), "Touch mode should not apply the custom cursor");
  assert(!touchState.pressed && touchState.pulseCount === 0, "Touch mode should not create mouse feedback");

  await touch.close();
  await desktop.close();
  await browser.close();
  activeBrowser = null;
  assert(pageErrors.length === 0, `Browser page errors: ${pageErrors.join(" | ")}`);

  console.log(`GAME_CURSOR_QA=PASS assets=${CURSOR_ASSETS.length} cardPages=${CARD_PAGES.length} boardPages=${BOARD_PAGES.length} desktop=1440x900 touch=932x430 alpha=transparent boardDirection=lower-left-nib dragQuill=preserved rootScrollbars=hidden cardScrollY=${cardScroll.scrollY} boardScrollY=${boardScroll.scrollY} cardOverflow=${cardOverflow} boardOverflow=${boardOverflow} battleOverflow=${battleOverflow}`);
}

main().catch(async (error) => {
  await activeBrowser?.close().catch(() => {});
  activeBrowser = null;
  console.error(`GAME_CURSOR_QA=FAIL ${error.stack || error}`);
  process.exitCode = 1;
});
