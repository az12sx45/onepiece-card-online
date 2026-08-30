const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/postgame_world_unlock_dialogue_20260816_v73_york_escape";

function attachErrors(page, errors) {
  page.on("pageerror", (error) => errors.push(`pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console:${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      errors.push(`http:${response.status()}:${response.url()}`);
    }
  });
}

async function dialogueSnapshot(page) {
  return page.evaluate(() => {
    const screen = document.querySelector(".final-ending-screen");
    const dialogue = document.querySelector(".final-ending-dialogue");
    const body = document.querySelector(".final-ending-dialogue-body");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    const background = screen ? getComputedStyle(screen).getPropertyValue("--ending-bg").trim() : "";
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null;
    };
    return {
      storyId: screen?.dataset.storyId || "",
      scene: screen?.className || "",
      speaker: document.querySelector(".final-ending-speaker")?.textContent?.trim() || "旁白",
      text: document.querySelector(".final-ending-lines")?.textContent?.trim() || "",
      buttonText: document.getElementById("finalEndingNextBtn")?.textContent?.trim() || "",
      background,
      dialogueRect: rect(dialogue),
      bodyRect: rect(body),
      portraitRect: rect(portrait),
      portraitSource: portrait?.getAttribute("src") || "",
      portraitReady: portrait ? portrait.complete && portrait.naturalWidth > 0 : true,
      viewport: { width: innerWidth, height: innerHeight },
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
}

async function waitForDialogue(page) {
  await page.waitForFunction(() => {
    const button = document.getElementById("finalEndingNextBtn");
    const image = document.querySelector(".final-ending-speaker-portrait img");
    return button && !button.disabled && (!image || (image.complete && image.naturalWidth > 0));
  });
  await page.waitForTimeout(160);
}

async function setupStory(page, completeTurnAfterStory) {
  return page.evaluate(({ shouldComplete }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    debug.closeModal?.();
    document.getElementById("postgameWorldCinematic")?.remove();
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.round = Math.max(3, Number(game.round || 1));
    game.resolutionLock = shouldComplete;
    game.turnStep = "最終之島後續劇情";
    const world = debug.normalizePostgameWorldState(game);
    world.unlocked = true;
    world.researchLabsActive = true;
    world.researchStoryPlayed = true;
    debug.ensurePostgameWorldLayout(game);
    debug.playPostgameWorldUnlockCinematic({
      id: `postgame-world-unlock-qa-${Date.now()}-${Math.random()}`,
      type: "postgame-world-unlock",
      playerId: player.id,
      playerName: player.name,
      detail: {
        playerName: player.name,
        endingId: "qa-ending",
        islandCount: 13,
        completeTurnAfterStory: shouldComplete,
      },
    });
    return {
      playerId: player.id,
      playerName: player.name,
      beforeRound: game.round,
      beforeIndex: game.currentPlayerIndex,
      playerCount: game.players.length,
    };
  }, { shouldComplete: completeTurnAfterStory });
}

async function captureFullStory(page, failures) {
  const shots = [];
  for (let index = 1; index <= 30; index += 1) {
    await waitForDialogue(page);
    const shot = await dialogueSnapshot(page);
    const scene = (shot.scene.match(/scene-([\w-]+)/) || [])[1] || "scene";
    const speaker = shot.speaker.replace(/[\\/:*?"<>|\s]+/g, "-");
    const file = `${String(index).padStart(2, "0")}-${scene}-${speaker}.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, file) });
    shots.push({ index, file, ...shot });

    if (shot.storyId !== "postgame_world_unlock_story") failures.push(`line ${index} missing story marker`);
    if (!shot.text) failures.push(`line ${index} missing text`);
    if (!shot.background || shot.background === "none") failures.push(`line ${index} missing background`);
    if (shot.speaker !== "旁白" && (!shot.portraitSource || !shot.portraitReady)) {
      failures.push(`line ${index} ${shot.speaker} missing portrait`);
    }
    if (shot.documentOverflow) failures.push(`line ${index} caused document overflow`);
    if (shot.dialogueRect && (shot.dialogueRect.left < -1 || shot.dialogueRect.right > shot.viewport.width + 1
      || shot.dialogueRect.top < -1 || shot.dialogueRect.bottom > shot.viewport.height + 1)) {
      failures.push(`line ${index} dialogue exceeds viewport`);
    }
    if (shot.portraitRect && (shot.portraitRect.left < -1 || shot.portraitRect.right > shot.viewport.width + 1
      || shot.portraitRect.top < -1 || shot.portraitRect.bottom > shot.viewport.height + 1)) {
      failures.push(`line ${index} portrait exceeds viewport`);
    }

    const isFinal = shot.buttonText === "展開新世界地圖";
    await page.evaluate(() => document.getElementById("finalEndingNextBtn")?.click());
    if (isFinal) break;
    await page.waitForTimeout(560);
  }
  return shots;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?postgame_world_dialogue_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.playPostgameWorldUnlockCinematic, null, { timeout: 20000 });

  const setup = await setupStory(page, true);
  await page.waitForSelector(".final-ending-screen.scene-postgame-york-holy-land-escape");
  const shots = await captureFullStory(page, failures);
  if (shots.length !== 21) failures.push(`expected 21 dialogue screenshots, got ${shots.length}`);
  if (!shots[0]?.text.includes("聖地") || !shots[0]?.text.includes("約克")) {
    failures.push("story does not begin with York escaping the Holy Land");
  }
  if (!shots.some((shot) => shot.text.includes("研究接收器截下"))) {
    failures.push("story does not explain how Lilith intercepted the cultivation data");
  }
  if (!shots.some((shot) => shot.speaker === "莉莉絲" && shot.text.includes("培育紀錄"))) {
    failures.push("Lilith does not cite the cultivation records as evidence");
  }

  await page.waitForFunction(() => !document.querySelector(".final-ending-screen") && !window.__BOARD_GAME_DEBUG__.getState().gameState.resolutionLock, null, { timeout: 10000 });
  await page.waitForTimeout(1700);
  const completion = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug.getState().gameState;
    return {
      modalOpen: Boolean(document.querySelector(".final-ending-screen")),
      resolutionLock: game.resolutionLock,
      round: game.round,
      currentPlayerIndex: game.currentPlayerIndex,
      postgameIslandCount: game.boardData.islands.filter((island) => String(island.id || "").startsWith("calm-belt-island-")).length,
      postgameRouteCount: game.boardData.routesBetweenIslands.filter((route) => String(route.id || "").startsWith("route-postgame-")).length,
      mapReveal: document.getElementById("boardGameMap")?.classList.contains("postgame-world-map-reveal") || false,
    };
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, "22-new-world-map.png") });
  if (completion.modalOpen || completion.resolutionLock) failures.push("story completion did not close modal and release lock");
  if (setup.playerCount === 1 && completion.round !== setup.beforeRound + 1) failures.push("single-player turn did not advance after story");
  if (completion.postgameIslandCount < 13 || completion.postgameRouteCount < 13) failures.push("postgame map layout is incomplete");

  const tabletContext = await browser.newContext({ viewport: { width: 1180, height: 820 }, deviceScaleFactor: 1 });
  const tabletPage = await tabletContext.newPage();
  attachErrors(tabletPage, errors);
  await tabletPage.goto(`${ROOT_URL}/board_game.html?postgame_world_dialogue_tablet_qa=1`, { waitUntil: "domcontentloaded" });
  await tabletPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.playPostgameWorldUnlockCinematic, null, { timeout: 20000 });
  await setupStory(tabletPage, false);
  await tabletPage.waitForSelector(".final-ending-screen.scene-postgame-york-holy-land-escape");
  await waitForDialogue(tabletPage);
  await tabletPage.screenshot({ path: path.join(OUTPUT_DIR, "tablet-01-opening.png") });
  for (let index = 0; index < 20; index += 1) {
    await tabletPage.evaluate(() => document.getElementById("finalEndingNextBtn")?.click());
    await tabletPage.waitForTimeout(560);
    await waitForDialogue(tabletPage);
  }
  const tabletLast = await dialogueSnapshot(tabletPage);
  await tabletPage.screenshot({ path: path.join(OUTPUT_DIR, "tablet-21-ending.png") });
  if (tabletLast.documentOverflow) failures.push("tablet story caused document overflow");
  if (tabletLast.dialogueRect && (tabletLast.dialogueRect.left < -1 || tabletLast.dialogueRect.right > tabletLast.viewport.width + 1
    || tabletLast.dialogueRect.top < -1 || tabletLast.dialogueRect.bottom > tabletLast.viewport.height + 1)) {
    failures.push("tablet ending dialogue exceeds viewport");
  }

  failures.push(...errors);
  const report = { outputDir: OUTPUT_DIR, setup, shots, completion, tabletLast, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
