const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/draft_crew_frame_formal_20260817_v107";

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

async function setupDraft(page, playerCount, phase, crewCount) {
  return page.evaluate(({ count, targetPhase, selectedCrewCount }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const basePlayer = game.players[0];
    const names = ["草帽船長", "紅心海賊團長名", "革命軍總司令船長", "九蛇船長"];
    const previewCrew = (window.BoardCards?.cards || []).slice(0, selectedCrewCount).map((card) => JSON.parse(JSON.stringify(card)));
    game.players = names.slice(0, count).map((name, index) => {
      const player = JSON.parse(JSON.stringify(basePlayer));
      player.id = `qa-draft-crew-${count}-${index + 1}`;
      player.userId = player.id;
      player.clientId = "";
      player.name = name;
      player.avatar = index + 1;
      player.isCpu = false;
      player.isCPU = false;
      player.crew = index === 0 ? previewCrew : [];
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
  }, { count: playerCount, targetPhase: phase, selectedCrewCount: crewCount });
}

async function inspect(page, mode) {
  return page.evaluate((expectedMode) => {
    const shell = document.querySelector(`.draft-recruitment-shell.draft-mode-${expectedMode}`);
    const board = shell?.querySelector(".draft-crew-board");
    const frame = board?.querySelector(":scope > img");
    const heading = board?.querySelector(".draft-crew-heading");
    const slots = [...(board?.querySelectorAll(".draft-crew-slot") || [])];
    const portraits = [...(board?.querySelectorAll(".draft-crew-slot > .portrait") || [])];
    const names = [...(board?.querySelectorAll(".draft-crew-slot > strong") || [])];
    const roleIcons = [...(board?.querySelectorAll(".draft-crew-slot > .role-icon") || [])];
    const boardRect = board?.getBoundingClientRect();
    const headingRect = heading?.getBoundingClientRect();
    const frameRect = frame?.getBoundingClientRect();
    const overlapArea = (a, b) => {
      if (!a || !b) return 0;
      return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
        * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    };
    const noOverflow = (element) => element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1;
    return {
      mode: expectedMode,
      shellExists: Boolean(shell),
      boardVisible: Boolean(boardRect && boardRect.width > 0 && boardRect.height > 0),
      formalFrameLoaded: Boolean(frame?.currentSrc.includes("/draft_crew_slots_frame.webp?v=20260817-cutout-v1")
        && !frame.currentSrc.includes("/incoming/")),
      frameNaturalSize: { width: frame?.naturalWidth || 0, height: frame?.naturalHeight || 0 },
      slotCount: slots.length,
      portraitCount: portraits.length,
      nameCount: names.length,
      roleIconCount: roleIcons.length,
      textNoOverflow: [heading].filter(Boolean).every(noOverflow)
        && names.every((element) => noOverflow(element)
          || (getComputedStyle(element).overflowX === "hidden"
            && getComputedStyle(element).textOverflow === "ellipsis")),
      brokenImageCount: [frame, ...portraits, ...roleIcons].filter((image) => image && (!image.complete || image.naturalWidth <= 0)).length,
      headingFrameOverlap: overlapArea(headingRect, frameRect),
      slotWidths: slots.map((slot) => Math.round(slot.getBoundingClientRect().width)),
      namePositions: names.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          left: (rect.left - boardRect.left) / boardRect.width,
          right: (rect.right - boardRect.left) / boardRect.width,
          top: (rect.top - boardRect.top) / boardRect.height,
          bottom: (rect.bottom - boardRect.top) / boardRect.height,
        };
      }),
      documentHorizontalOverflow: document.documentElement.scrollWidth > innerWidth + 2,
    };
  }, mode);
}

async function captureCase(browser, viewport, playerCount, crewCount, label, errors, failures) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?draft_crew_frame_formal=${label}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.openSetupStep && window.BoardCards?.cards?.length, null, { timeout: 20000 });

  const phases = [
    ["setup-order", "order"],
    ["setup-draft", "wheel"],
  ];
  const results = {};
  for (const [phase, mode] of phases) {
    await setupDraft(page, playerCount, phase, crewCount);
    await page.waitForSelector(`.draft-recruitment-shell.draft-mode-${mode} .draft-crew-board`);
    await page.waitForTimeout(250);
    results[mode] = await inspect(page, mode);
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-${mode}.png`) });
  }

  await page.locator("#recruitRollBtn").click();
  await page.waitForSelector(".draft-recruitment-shell.draft-mode-pick .draft-character-card", { timeout: 6000 });
  await page.waitForTimeout(250);
  results.pick = await inspect(page, "pick");
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-pick.png`) });

  for (const [mode, result] of Object.entries(results)) {
    if (!result.shellExists || (!result.boardVisible && !(label.startsWith("phone") && mode === "pick"))
      || (result.boardVisible && (!result.formalFrameLoaded
        || result.frameNaturalSize.width !== 1672 || result.frameNaturalSize.height !== 941
        || result.slotCount !== 3 || result.portraitCount !== crewCount || result.nameCount !== crewCount
        || result.roleIconCount !== 0 || !result.textNoOverflow || result.brokenImageCount !== 0
        || result.namePositions.some((position) => position.top < .76 || position.bottom > .92)
        || result.documentHorizontalOverflow))) {
      failures.push(`${label}:${mode}: formal cutout frame layout or asset validation failed`);
    }
  }

  await context.close();
  return results;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const failures = [];
  const cases = {};
  cases.desktopTwoOfThree = await captureCase(browser, { width: 1600, height: 900 }, 4, 2, "desktop-2of3", errors, failures);
  cases.desktopFull = await captureCase(browser, { width: 1600, height: 900 }, 4, 3, "desktop-3of3", errors, failures);
  cases.tabletTwoOfThree = await captureCase(browser, { width: 1024, height: 768 }, 4, 2, "tablet-2of3", errors, failures);
  cases.phoneTwoOfThree = await captureCase(browser, { width: 932, height: 430 }, 4, 2, "phone-2of3", errors, failures);
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
