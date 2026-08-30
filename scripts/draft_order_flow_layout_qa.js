const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/draft_order_flow_layout_20260817_v103";

function attachErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      errors.push(`${label}:http:${response.status()}:${response.url()}`);
    }
  });
}

async function setupDraft(page, playerCount, phase) {
  return page.evaluate(({ count, targetPhase }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const basePlayer = game.players[0];
    const names = ["草帽船長", "紅心海賊團長名", "革命軍總司令船長", "九蛇船長"];
    game.players = names.slice(0, count).map((name, index) => {
      const player = JSON.parse(JSON.stringify(basePlayer));
      player.id = `qa-draft-flow-${count}-${index + 1}`;
      player.userId = player.id;
      player.clientId = "";
      player.name = name;
      player.avatar = index + 1;
      player.isCpu = false;
      player.isCPU = false;
      player.crew = [];
      player.recruitRolls = [];
      player.defeatedEnemies = [];
      return player;
    });
    const ids = game.players.map((player) => player.id);
    game.phase = targetPhase;
    game.currentPlayerIndex = 0;
    game.draftOrder = ids.slice();
    game.draftSequence = [...ids, ...ids.slice().reverse(), ...ids];
    game.draftPickIndex = 0;
    game.draftPickNotice = "";
    game.resolutionLock = false;
    debug.openSetupStep({ skipOpeningStory: true });
    return { playerIds: ids, sequence: game.draftSequence.slice() };
  }, { count: playerCount, targetPhase: phase });
}

async function inspectLayout(page, expectedMode, playerCount) {
  return page.evaluate(({ mode, count }) => {
    const shell = document.querySelector(`.draft-recruitment-shell.draft-mode-${mode}`);
    const board = shell?.querySelector(".draft-voyage-order");
    const boardImage = board?.querySelector(":scope > img");
    const grid = board?.querySelector(".draft-order-grid");
    const boardRect = board?.getBoundingClientRect();
    const gridRect = grid?.getBoundingClientRect();
    const labels = [...(board?.querySelectorAll(".draft-order-corner,.draft-order-round") || [])];
    const heads = [...(board?.querySelectorAll(".draft-order-player-head") || [])];
    const cells = [...(board?.querySelectorAll(".draft-order-cell") || [])];
    const textNodes = [...(shell?.querySelectorAll([
      ".draft-title-copy h2",
      ".draft-title-copy span",
      ".draft-order-corner",
      ".draft-order-round",
      ".draft-order-player-head",
      ".draft-order-cell",
      ".draft-order-copy",
      ".draft-wheel-hint",
      ".draft-wheel-result",
      ".draft-action-console",
      ".draft-recruit-heading",
      ".draft-recruit-footer",
    ].join(",")) || [])];
    const images = [...(shell?.querySelectorAll("img") || [])];
    const ratio = (rect) => ({
      left: (rect.left - boardRect.left) / boardRect.width,
      right: (rect.right - boardRect.left) / boardRect.width,
      top: (rect.top - boardRect.top) / boardRect.height,
      bottom: (rect.bottom - boardRect.top) / boardRect.height,
    });
    const insideRatio = (element, left, right, top, bottom) => {
      if (!boardRect) return false;
      const value = ratio(element.getBoundingClientRect());
      return value.left >= left - .002 && value.right <= right + .002
        && value.top >= top - .002 && value.bottom <= bottom + .002;
    };
    const noOverflow = (element) => element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1;
    const overflowItems = textNodes.filter((element) => !noOverflow(element)).map((element) => ({
      selector: element.className || element.tagName,
      text: String(element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 80),
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
      clientHeight: element.clientHeight,
      scrollHeight: element.scrollHeight,
    }));
    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
      return x * y;
    };
    const spinButtonRect = shell?.querySelector(".draft-wheel-spin-btn")?.getBoundingClientRect();
    const wheelResultRect = shell?.querySelector(".draft-wheel-result")?.getBoundingClientRect();
    const orderBoardRect = shell?.querySelector(".draft-voyage-order")?.getBoundingClientRect();
    const crewBoardRect = shell?.querySelector(".draft-crew-board")?.getBoundingClientRect();
    const recruitBoardRect = shell?.querySelector(".draft-recruit-board")?.getBoundingClientRect();
    const candidateRects = [...(shell?.querySelectorAll(".draft-character-card") || [])]
      .map((element) => element.getBoundingClientRect());
    const candidateOverlap = candidateRects.some((rect, index) => candidateRects
      .slice(index + 1).some((other) => overlapArea(rect, other) > 3));
    return {
      mode,
      playerCount: count,
      shellExists: Boolean(shell),
      frameIsFormal: Boolean(boardImage?.currentSrc.includes("/draft_order_compass_board.webp"))
        && !boardImage.currentSrc.includes("/incoming/"),
      frameSize: { width: boardImage?.naturalWidth || 0, height: boardImage?.naturalHeight || 0 },
      playerHeaderCount: heads.length,
      orderCellCount: cells.length,
      labelCount: labels.length,
      labelsInsidePlaques: labels.every((element) => insideRatio(element, .052, .198, .13, .79)),
      playerContentInsideParchment: [...heads, ...cells].every((element) => insideRatio(element, .2, .948, .125, .79)),
      textNoOverflow: textNodes.every(noOverflow),
      overflowItems,
      brokenImageCount: images.filter((image) => !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0).length,
      gridInsideBoard: Boolean(boardRect && gridRect)
        && gridRect.left >= boardRect.left - 1 && gridRect.top >= boardRect.top - 1
        && gridRect.right <= boardRect.right + 1 && gridRect.bottom <= boardRect.bottom + 1,
      wheelButtonResultOverlap: overlapArea(spinButtonRect, wheelResultRect),
      orderCrewOverlap: overlapArea(orderBoardRect, crewBoardRect),
      orderRecruitOverlap: overlapArea(orderBoardRect, recruitBoardRect),
      crewRecruitOverlap: overlapArea(crewBoardRect, recruitBoardRect),
      candidateOverlap,
      candidateCount: candidateRects.length,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  }, { mode: expectedMode, count: playerCount });
}

function validate(result, label, failures) {
  if (!result.shellExists
    || !result.frameIsFormal
    || result.frameSize.width !== 2400
    || result.frameSize.height !== 600
    || result.playerHeaderCount !== result.playerCount
    || result.orderCellCount !== result.playerCount * 3
    || result.labelCount !== 4
    || !result.labelsInsidePlaques
    || !result.playerContentInsideParchment
    || !result.textNoOverflow
    || result.brokenImageCount !== 0
    || !result.gridInsideBoard
    || result.wheelButtonResultOverlap > 3
    || result.orderCrewOverlap > 3
    || result.orderRecruitOverlap > 3
    || result.crewRecruitOverlap > 3
    || result.candidateOverlap
    || result.documentOverflow) {
    failures.push(`${label}: layout, image, safe-area, overlap, or overflow failure`);
  }
}

async function runCase(browser, viewport, playerCount, viewportLabel, errors, failures) {
  const label = `${viewportLabel}-${playerCount}p`;
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?draft_flow_layout_qa=${label}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.openSetupStep && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const setup = await setupDraft(page, playerCount, "setup-order");
  await page.waitForSelector(".draft-recruitment-shell.draft-mode-order .draft-order-grid");
  await page.waitForTimeout(180);
  const order = await inspectLayout(page, "order", playerCount);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-01-order.png`) });
  validate(order, `${label}:order`, failures);

  await setupDraft(page, playerCount, "setup-draft");
  await page.waitForSelector(".draft-recruitment-shell.draft-mode-wheel #recruitRollBtn");
  await page.waitForTimeout(180);
  const wheelIdle = await inspectLayout(page, "wheel", playerCount);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-02-wheel-idle.png`) });
  validate(wheelIdle, `${label}:wheel-idle`, failures);

  await page.locator("#recruitRollBtn").click();
  await page.waitForFunction(() => document.getElementById("draftWheelResult")?.textContent?.includes("正在轉動"));
  await page.waitForTimeout(520);
  const wheelRolling = await inspectLayout(page, "wheel", playerCount);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-03-wheel-rolling.png`) });
  validate(wheelRolling, `${label}:wheel-rolling`, failures);

  await page.waitForSelector(".draft-recruitment-shell.draft-mode-pick .draft-character-card", { timeout: 6000 });
  await page.waitForTimeout(220);
  const pick = await inspectLayout(page, "pick", playerCount);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-04-pick.png`) });
  validate(pick, `${label}:pick`, failures);

  await context.close();
  return { viewport, setup, order, wheelIdle, wheelRolling, pick };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const cases = {};
  for (const playerCount of [1, 2, 3, 4]) {
    cases[`desktop${playerCount}p`] = await runCase(browser, { width: 1600, height: 900 }, playerCount, "desktop", errors, failures);
  }
  cases.tablet4p = await runCase(browser, { width: 1024, height: 768 }, 4, "tablet", errors, failures);
  cases.phone4p = await runCase(browser, { width: 932, height: 430 }, 4, "phone", errors, failures);
  await browser.close();
  failures.push(...errors);
  const report = { ok: failures.length === 0, outputDir: OUTPUT_DIR, cases, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
