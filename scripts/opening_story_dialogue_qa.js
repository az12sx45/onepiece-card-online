const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/opening_story_dialogue_20260817_v100";

const EXPECTED_EXECUTION_BEATS = [
  { speaker: "旁白", text: "那一天，世界以為一個人的死亡，會讓海賊的時代就此結束。" },
  { speaker: "旁白", text: "征服偉大航路、抵達大海盡頭的男人——海賊王，哥爾・D・羅傑，即將在他的故鄉迎來終點。" },
  { speaker: "羅傑", text: "想要我的財寶嗎？想要的話就給你。" },
  { speaker: "羅傑", text: "去找吧！我把這世上的一切都放在那裡了！" },
  { speaker: "旁白", text: "一個人的終點，成了無數人航程的起點。" },
];

const EXPECTED_DEPARTURE_BEATS = [
  { speaker: "旁白", text: "羅傑臨死前留下的那句話，讓無數人奔向大海。" },
  { speaker: "旁白", text: "他們追逐財富、名聲與力量，也追逐各自相信的夢想。" },
  { speaker: "旁白", text: "世界，迎來了大航海時代。" },
];

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

async function waitUntilReady(page) {
  await page.waitForFunction(() => {
    const button = document.getElementById("finalEndingNextBtn");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    return button && !button.disabled && (!portrait || (portrait.complete && portrait.naturalWidth > 0));
  });
  await page.waitForTimeout(180);
}

async function snapshot(page) {
  return page.evaluate(() => {
    const dialogue = document.querySelector(".final-ending-dialogue");
    const portrait = document.querySelector(".final-ending-speaker-portrait img");
    const title = document.querySelector(".opening-story-title-card");
    const box = dialogue?.getBoundingClientRect();
    return {
      speaker: document.querySelector(".final-ending-speaker")?.textContent?.trim() || "旁白",
      text: document.querySelector(".final-ending-lines")?.textContent?.trim() || "",
      portrait: portrait?.getAttribute("src") || "",
      portraitReady: portrait ? portrait.complete && portrait.naturalWidth > 0 : true,
      title: title?.textContent?.trim() || "",
      titleVisible: Boolean(title?.classList.contains("is-visible")),
      openingEffect: document.querySelector(".final-ending-screen")?.dataset?.openingEffect || "",
      dialogueInsideViewport: box
        ? box.left >= -1 && box.top >= -1 && box.right <= innerWidth + 1 && box.bottom <= innerHeight + 1
        : false,
      documentOverflow: document.documentElement.scrollWidth > innerWidth + 2
        || document.documentElement.scrollHeight > innerHeight + 2,
    };
  });
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors);
  await page.goto(`${ROOT_URL}/board_game.html?opening_story_dialogue_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.playOpeningStory, null, { timeout: 20000 });

  const definition = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getOpeningStoryDefinition());
  const execution = definition?.chapters?.[0];
  const actualBeats = (execution?.beats || []).map((beat) => ({ speaker: beat.speaker, text: beat.text }));
  if (JSON.stringify(actualBeats) !== JSON.stringify(EXPECTED_EXECUTION_BEATS)) {
    failures.push(`execution dialogue mismatch: ${JSON.stringify(actualBeats)}`);
  }
  if (execution?.beats?.[3]?.speakerImage !== "images/board/story/opening/roger_execution_smile.webp") {
    failures.push("Roger smile portrait is not used for the final line");
  }
  if (execution?.beats?.[4]?.effect !== "execution-flash" || execution?.beats?.[4]?.titleCard !== "大航海時代——開幕") {
    failures.push("execution flash or title card is missing");
  }
  const departure = definition?.chapters?.[1];
  const actualDepartureBeats = (departure?.beats || []).map((beat) => ({ speaker: beat.speaker, text: beat.text }));
  if (JSON.stringify(actualDepartureBeats) !== JSON.stringify(EXPECTED_DEPARTURE_BEATS)) {
    failures.push(`departure dialogue mismatch: ${JSON.stringify(actualDepartureBeats)}`);
  }

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.playOpeningStory());
  await page.waitForSelector(".final-ending-screen.scene-opening-execution");
  const shots = [];
  for (let index = 0; index < EXPECTED_EXECUTION_BEATS.length; index += 1) {
    await waitUntilReady(page);
    const entry = await snapshot(page);
    const expected = EXPECTED_EXECUTION_BEATS[index];
    if (entry.speaker !== expected.speaker || entry.text !== expected.text) {
      failures.push(`beat ${index + 1} rendered ${entry.speaker}:${entry.text}`);
    }
    if (!entry.portraitReady || !entry.dialogueInsideViewport || entry.documentOverflow) {
      failures.push(`beat ${index + 1} visual layout failed`);
    }
    const file = `${String(index + 1).padStart(2, "0")}-${index >= 2 && index <= 3 ? "roger" : "narration"}.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, file) });
    shots.push({ file, ...entry });
    if (index < EXPECTED_EXECUTION_BEATS.length - 1) {
      await page.evaluate(() => document.getElementById("finalEndingNextBtn")?.click());
    }
  }

  const finalShot = shots[shots.length - 1];
  if (!finalShot.titleVisible || finalShot.title !== "大航海時代——開幕" || finalShot.openingEffect !== "execution-flash") {
    failures.push("final execution beat did not show the flash title");
  }
  await page.evaluate(() => document.getElementById("finalEndingNextBtn")?.click());
  await page.waitForSelector(".final-ending-screen.scene-opening-departure");
  const departureShots = [];
  for (let index = 0; index < EXPECTED_DEPARTURE_BEATS.length; index += 1) {
    await waitUntilReady(page);
    const entry = await snapshot(page);
    const expected = EXPECTED_DEPARTURE_BEATS[index];
    if (entry.speaker !== expected.speaker || entry.text !== expected.text) {
      failures.push(`departure beat ${index + 1} rendered ${entry.speaker}:${entry.text}`);
    }
    if (!entry.dialogueInsideViewport || entry.documentOverflow) {
      failures.push(`departure beat ${index + 1} visual layout failed`);
    }
    const file = `${String(index + 6).padStart(2, "0")}-departure.png`;
    await page.screenshot({ path: path.join(OUTPUT_DIR, file) });
    departureShots.push({ file, ...entry });
    if (index < EXPECTED_DEPARTURE_BEATS.length - 1) {
      await page.evaluate(() => document.getElementById("finalEndingNextBtn")?.click());
    }
  }
  failures.push(...errors);

  const report = {
    ok: failures.length === 0,
    outputDir: OUTPUT_DIR,
    actualBeats,
    actualDepartureBeats,
    shots,
    departureShots,
    errors,
    failures,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await browser.close();
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
