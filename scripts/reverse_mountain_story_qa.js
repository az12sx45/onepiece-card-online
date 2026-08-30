const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/reverse_mountain_story_20260817_v108";

const EXPECTED_TEXT = [
  "離開羅格鎮後，通往偉大航道的海面忽然被紅土大陸截斷；唯一的入口，是一股沿著山壁向上奔流的海流。",
  "海流正在往山上爬！抓緊船身，偏離水道就會直接撞上紅土大陸！",
  "海水竟然會爬山！好，沿著水流一路衝上去！",
  "船乘著激流越過山頂。浪聲落下的另一側，就是變幻莫測的偉大航道。",
  "前方分成五條主航線。看地圖上亮起的海格，點選第一到第五海路，就能決定我們的航向。",
  "五條主航線採唯一占用制：先選的玩家會占有該航線，其他玩家不能再選擇已被占用的海路。",
  "若這次擲骰還有剩餘步數，選定後會先用一格駛入航線，再繼續走完剩餘步數；沒有剩餘步數時，船會停在航線入口。",
  "還沒被選走的路都會亮著吧？那就挑一條，繼續往前！",
];

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

async function prepareReverseMountain(page) {
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.turnIndex = 0;
    game.resolutionLock = false;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.pendingMove = null;
    game.routePrompt = null;
    game.claimedBranchRoutes = {};
    player.isCPU = false;
    player.isCpu = false;
    player.cpu = false;
    player.claimedBranchId = null;
    player.location = { kind: "island", islandId: "reverse-mountain", entryDirection: null };
    debug.openReverseMountainChoice(player, 3);
  });
  await page.waitForSelector(".final-ending-screen.scene-reverse-mountain-climb");
}

async function waitReady(page) {
  await page.waitForFunction(() => {
    const button = document.getElementById("finalEndingNextBtn");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    return button && !button.disabled && (!portrait || (portrait.complete && portrait.naturalWidth > 0));
  });
  await page.waitForTimeout(120);
}

async function inspectBeat(page) {
  return page.evaluate(() => {
    const screen = document.querySelector(".final-ending-screen");
    const dialogue = document.querySelector(".final-ending-dialogue");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    const box = dialogue?.getBoundingClientRect();
    return {
      scene: [...(screen?.classList || [])].find((name) => name.startsWith("scene-reverse-")) || "",
      speaker: document.querySelector(".final-ending-speaker")?.textContent?.trim() || "旁白",
      text: document.querySelector(".final-ending-lines")?.textContent?.trim() || "",
      background: screen ? getComputedStyle(screen).getPropertyValue("--ending-bg") : "",
      portraitReady: portrait ? portrait.complete && portrait.naturalWidth > 0 : true,
      insideViewport: box
        ? box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1
        : false,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
      resolutionLock: Boolean(window.__BOARD_GAME_DEBUG__.getState().gameState.resolutionLock),
      routeCount: window.__BOARD_GAME_DEBUG__.getState().gameState.routePrompt?.routeIds?.length || 0,
    };
  });
}

async function runViewport(browser, label, viewport, errors, failures) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?skipOpeningStory=1&reverse_mountain_story_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.getReverseMountainStoryDefinition, null, { timeout: 20000 });

  const definition = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getReverseMountainStoryDefinition());
  const definitionText = definition.chapters.flatMap((chapter) => chapter.beats.map((beat) => beat.text));
  if (JSON.stringify(definitionText) !== JSON.stringify(EXPECTED_TEXT)) {
    failures.push(`${label}:story definition mismatch`);
  }
  await prepareReverseMountain(page);

  const beats = [];
  for (let index = 0; index < EXPECTED_TEXT.length; index += 1) {
    await waitReady(page);
    const beat = await inspectBeat(page);
    beats.push(beat);
    if (beat.text !== EXPECTED_TEXT[index]) failures.push(`${label}:beat ${index + 1} text mismatch`);
    if (!beat.background.includes("reverse_mountain_route_choice_story.webp")) failures.push(`${label}:beat ${index + 1} background mismatch`);
    if (!beat.portraitReady || !beat.insideViewport || beat.documentOverflow || beat.resolutionLock || beat.routeCount !== 5) {
      failures.push(`${label}:beat ${index + 1} layout or route lock failed`);
    }
    if ([0, 4, 5, 6].includes(index)) {
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-beat-${index + 1}.png`) });
    }
    await page.evaluate(() => document.getElementById("finalEndingNextBtn")?.click());
  }

  await page.waitForFunction(() => !document.querySelector(".final-ending-screen"));
  await page.waitForFunction(() => document.querySelectorAll(".sea-tile.route-choice").length === 25);
  const finalState = await page.evaluate(() => {
    const game = window.__BOARD_GAME_DEBUG__.getState().gameState;
    return {
      resolutionLock: game.resolutionLock,
      turnStep: game.turnStep,
      stepsRemaining: game.pendingMove?.stepsRemaining,
      routeCount: game.routePrompt?.routeIds?.length || 0,
      highlightedTileCount: document.querySelectorAll(".sea-tile.route-choice").length,
    };
  });
  if (finalState.resolutionLock || finalState.routeCount !== 5 || finalState.stepsRemaining !== 3 || finalState.highlightedTileCount !== 25) {
    failures.push(`${label}:route choice did not resume correctly: ${JSON.stringify(finalState)}`);
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-route-choice.png`) });

  const replay = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug.getState().gameState;
    const player = game.players[0];
    game.routePrompt = null;
    game.pendingMove = null;
    game.claimedBranchRoutes = { north: player.id };
    player.claimedBranchId = "north";
    debug.openReverseMountainChoice(player, 0);
    return {
      storyVisible: Boolean(document.querySelector(".final-ending-screen")),
      routeCount: game.routePrompt?.routeIds?.length || 0,
    };
  });
  if (replay.storyVisible || replay.routeCount !== 1) failures.push(`${label}:claimed route replay behavior failed: ${JSON.stringify(replay)}`);

  await context.close();
  return { label, viewport, beats, finalState, replay };
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const runs = [];
  runs.push(await runViewport(browser, "desktop", { width: 1600, height: 900 }, errors, failures));
  runs.push(await runViewport(browser, "phone", { width: 932, height: 430 }, errors, failures));
  failures.push(...errors);
  const report = { ok: failures.length === 0, outputDir: OUTPUT_DIR, runs, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
