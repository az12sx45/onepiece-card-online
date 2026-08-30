const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/egghead_dialogue_story_20260815_v70";

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

async function snapshot(page) {
  return page.evaluate(() => {
    const screen = document.querySelector(".final-ending-screen");
    const dialogue = document.querySelector(".final-ending-dialogue");
    const body = document.querySelector(".final-ending-dialogue-body");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    const rect = (node) => {
      const box = node?.getBoundingClientRect();
      return box ? { left: box.left, top: box.top, right: box.right, bottom: box.bottom, width: box.width, height: box.height } : null;
    };
    return {
      scene: screen?.className || "",
      speaker: document.querySelector(".final-ending-speaker")?.textContent?.trim() || "",
      text: document.querySelector(".final-ending-lines")?.textContent?.trim() || "",
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

async function advance(page) {
  await page.waitForFunction(() => {
    const button = document.getElementById("finalEndingNextBtn");
    return button && !button.disabled;
  });
  await page.evaluate(() => {
    document.getElementById("finalEndingNextBtn")?.click();
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(650);
  await page.waitForFunction(() => {
    const image = document.querySelector(".final-ending-speaker-portrait img");
    return !image || (image.complete && image.naturalWidth > 0);
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?egghead_dialogue_story_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.openPostgameRocksModal, null, { timeout: 20000 });

  const setup = await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    debug.closeModal?.();
    document.getElementById("postgameWorldCinematic")?.remove();
    document.getElementById("postgameEggheadCinematic")?.remove();
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.resolutionLock = false;
    player.pendingBattle = null;
    const world = debug.normalizePostgameWorldState(game);
    world.unlocked = true;
    world.eggheadUnlocked = true;
    world.researchLabsActive = true;
    debug.ensurePostgameWorldLayout(game);
    const island = debug.getIslandById("postgame-egghead-island");
    const islandState = debug.getIslandState(island.id);
    debug.openPostgameRocksModal(player, island, islandState);
    return { islandId: island.id, turnStep: game.turnStep };
  });

  await page.waitForSelector(".final-ending-screen.scene-postgame-egghead-arrival");
  const dialogueShots = [];
  const captureDialogue = async (index, slug) => {
    await page.waitForFunction(() => {
      const button = document.getElementById("finalEndingNextBtn");
      const image = document.querySelector(".final-ending-speaker-portrait img");
      return button && !button.disabled && (!image || (image.complete && image.naturalWidth > 0));
    });
    await page.waitForTimeout(180);
    const entry = await snapshot(page);
    const file = `${String(index).padStart(2, "0")}-${slug}.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, file) });
    dialogueShots.push({ index, file, speaker: entry.speaker || "旁白", text: entry.text, scene: entry.scene });
    return entry;
  };

  const arrival = await captureDialogue(1, "arrival-narration");
  await advance(page);
  const nami = await captureDialogue(2, "nami");
  await advance(page);
  await captureDialogue(3, "robin-coordinate");
  await advance(page);
  await captureDialogue(4, "luffy-land");
  await advance(page);
  await captureDialogue(5, "york-stage-narration");
  await advance(page);
  const york = await captureDialogue(6, "york-masterpiece");
  await advance(page);
  await captureDialogue(7, "lilith-warning");
  await advance(page);
  await captureDialogue(8, "york-monster");
  await advance(page);
  await captureDialogue(9, "rocks-stage-narration");
  await advance(page);
  const rocks = await captureDialogue(10, "rocks-awakens");
  await advance(page);
  await captureDialogue(11, "robin-reveals-rocks");
  await advance(page);
  await captureDialogue(12, "luffy-challenge");
  await advance(page);
  await captureDialogue(13, "rocks-challenge");

  await advance(page);
  await page.waitForSelector(".encounter-nautical-modal");
  await page.waitForFunction(() => Array.from(document.querySelectorAll(".encounter-nautical-modal img"))
    .every((image) => image.complete && image.naturalWidth > 0));
  const encounter = await page.evaluate(() => ({
    title: document.querySelector(".encounter-nautical-modal")?.textContent || "",
    dialogueStillOpen: Boolean(document.querySelector(".final-ending-screen")),
    brokenImages: Array.from(document.querySelectorAll(".encounter-nautical-modal img"))
      .filter((image) => !image.complete || image.naturalWidth <= 0)
      .map((image) => image.getAttribute("src")),
  }));
  await page.screenshot({ path: path.join(OUTPUT_DIR, "14-rocks-encounter.png") });

  [nami, york, rocks].forEach((entry, index) => {
    if (!entry.speaker || !entry.portraitSource || !entry.portraitReady) failures.push(`dialogue ${index + 1} missing speaker portrait`);
    if (entry.documentOverflow) failures.push(`dialogue ${index + 1} caused document overflow`);
    if (entry.dialogueRect && (entry.dialogueRect.left < -1 || entry.dialogueRect.right > entry.viewport.width + 1
      || entry.dialogueRect.top < -1 || entry.dialogueRect.bottom > entry.viewport.height + 1)) {
      failures.push(`dialogue ${index + 1} exceeds viewport`);
    }
  });
  if (setup.turnStep !== "移動蛋頭島登島劇情") failures.push(`unexpected turn step: ${setup.turnStep}`);
  if (!arrival.scene.includes("scene-postgame-egghead-arrival")) failures.push("arrival scene did not open");
  if (!york.scene.includes("scene-postgame-egghead-york") || york.speaker !== "約克") failures.push("York scene did not render");
  if (!rocks.scene.includes("scene-postgame-egghead-rocks") || !rocks.speaker.includes("洛克斯")) failures.push("Rocks scene did not render");
  if (!encounter.title.includes("蛋頭島終戰・洛克斯") || encounter.dialogueStillOpen) failures.push("story did not continue to the Rocks encounter panel");
  if (encounter.brokenImages.length) failures.push(`encounter has broken images: ${encounter.brokenImages.join(",")}`);
  failures.push(...errors);

  if (dialogueShots.length !== 13) failures.push(`expected 13 dialogue screenshots, got ${dialogueShots.length}`);
  const report = { outputDir: OUTPUT_DIR, setup, dialogueShots, arrival, nami, york, rocks, encounter, errors, failures };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
