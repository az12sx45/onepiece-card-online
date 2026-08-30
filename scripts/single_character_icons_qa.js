const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const sharp = require("sharp");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/single_character_icons_20260818_v114";

const CASES = [
  { label: "desktop", viewport: { width: 1600, height: 900 } },
  { label: "tablet", viewport: { width: 1024, height: 768 } },
  { label: "phone_landscape", viewport: { width: 932, height: 430 } },
];

const GENERATED_ICON_DIRS = [
  "public/images/board/training_ui/stat_icons",
  "public/images/board/ship_info_ui/upgrade_icons",
  "public/images/board/judicial_raid_ui/reward_icons",
  "public/images/board/impel_down_ui/event_icons",
];

async function inspectOpticalCenters() {
  const entries = [];
  for (const relativeDir of GENERATED_ICON_DIRS) {
    const absoluteDir = path.join(__dirname, "..", relativeDir);
    for (const filename of fs.readdirSync(absoluteDir).filter((name) => name.endsWith(".webp"))) {
      const absolutePath = path.join(absoluteDir, filename);
      const { data, info } = await sharp(absolutePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      let left = info.width;
      let top = info.height;
      let right = -1;
      let bottom = -1;
      for (let y = 0; y < info.height; y += 1) {
        for (let x = 0; x < info.width; x += 1) {
          if (data[(y * info.width + x) * 4 + 3] < 48) continue;
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
      entries.push({
        file: path.relative(path.join(__dirname, ".."), absolutePath).replaceAll("\\", "/"),
        width: info.width,
        height: info.height,
        alpha: info.channels === 4,
        offsetX: ((left + right) / 2) - ((info.width - 1) / 2),
        offsetY: ((top + bottom) / 2) - ((info.height - 1) / 2),
        safeEdge: Math.min(left, top, info.width - 1 - right, info.height - 1 - bottom),
      });
    }
  }
  return entries;
}

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

async function waitForImages(page, selector, expected, exactSize = 256) {
  await page.waitForFunction(({ selector: query, expected: count, exactSize: size }) => {
    const images = [...document.querySelectorAll(query)];
    return images.length === count && images.every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0 && (!size || (image.naturalWidth === size && image.naturalHeight === size)));
  }, { selector, expected, exactSize }, { timeout: 15000 });
}

async function inspectImageGroup(page, selector, expected, exactSize = 256) {
  return page.evaluate(({ selector: query, expected: count, exactSize: size }) => {
    const images = [...document.querySelectorAll(query)];
    const inside = images.every((image) => {
      const parent = image.parentElement?.getBoundingClientRect();
      const rect = image.getBoundingClientRect();
      return parent && rect.left >= parent.left - 1 && rect.right <= parent.right + 1 && rect.top >= parent.top - 1 && rect.bottom <= parent.bottom + 1;
    });
    return {
      count: images.length,
      expected: count,
      broken: images.filter((image) => !image.complete || !image.naturalWidth).length,
      wrongSize: size ? images.filter((image) => image.naturalWidth !== size || image.naturalHeight !== size).length : 0,
      incomingSource: images.filter((image) => image.currentSrc.includes("/incoming/")).length,
      inside,
      sources: images.map((image) => image.currentSrc),
    };
  }, { selector, expected, exactSize });
}

async function setupBoardPlayer(page) {
  await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.singleCharacterIconQa && window.BoardCards?.cards?.length, null, { timeout: 20000 });
  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const player = debug.getState().gameState.players[0];
    const source = window.BoardCards.cards.find((card) => String(card.name || "").includes("凱洛特")) || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 30 })];
    player.activeCrewIndex = 0;
    player.isCPU = false;
    player.isCpu = false;
  });
}

async function testBoardPage(browser, config, errors, results) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, `${config.label}:board`);
  await page.goto(`${ROOT_URL}/board_game.html?single_character_icons_qa=1`, { waitUntil: "domcontentloaded" });
  await setupBoardPlayer(page);

  await page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    debug.openCrewManagementModal(debug.getState().gameState.players[0]);
  });
  await page.waitForSelector(".crew-manage-levelline .attribute-pill", { timeout: 5000 });
  const boardAttributes = await page.$$eval(".attribute-pill", (nodes) => ({
    count: nodes.length,
    texts: nodes.map((node) => node.textContent.trim()),
    imageCount: nodes.reduce((total, node) => total + node.querySelectorAll("img").length, 0),
    overflow: nodes.some((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
    backgrounds: nodes.map((node) => getComputedStyle(node).backgroundImage),
  }));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_attribute_text.png`), fullPage: true });

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.singleCharacterIconQa.openTraining());
  await waitForImages(page, ".training-stat-badge img", 6);
  const training = await inspectImageGroup(page, ".training-stat-badge img", 6);
  const trainingText = await page.$$eval(".training-stat-badge", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_training.png`), fullPage: true });

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.singleCharacterIconQa.openShipInfo());
  await page.click('[data-ship-info-tab-button="upgrades"]');
  await waitForImages(page, ".ship-info-upgrade-glyph img", 5);
  const ship = await inspectImageGroup(page, ".ship-info-upgrade-glyph img", 5);
  const shipText = await page.$$eval(".ship-info-upgrade-glyph", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_ship.png`), fullPage: true });

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.singleCharacterIconQa.openFleetInfo());
  await waitForImages(page, ".fleet-info-kpis b img", 4, 0);
  const fleet = await inspectImageGroup(page, ".fleet-info-kpis b img", 4, 0);
  const fleetText = await page.$$eval(".fleet-info-kpis b", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_fleet.png`), fullPage: true });

  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.singleCharacterIconQa.openCodex());
  await waitForImages(page, ".defeated-codex-kpis b img", 3, 0);
  const codex = await inspectImageGroup(page, ".defeated-codex-kpis b img", 3, 0);
  const codexText = await page.$$eval(".defeated-codex-kpis b", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_codex.png`), fullPage: true });
  results.push({ page: "board", label: config.label, boardAttributes, training, trainingText, ship, shipText, fleet, fleetText, codex, codexText });
  await context.close();
}

async function testWaterSeven(browser, config, errors, results) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, `${config.label}:water-seven`);
  await page.goto(`${ROOT_URL}/board_water_seven.html?single_character_icons_qa=1`, { waitUntil: "domcontentloaded" });
  await waitForImages(page, ".callout-glyph img", 5);
  await page.waitForFunction(() => !document.querySelector(".ship-stage")?.classList.contains("is-turning"), null, { timeout: 5000 });
  const callouts = await inspectImageGroup(page, ".callout-glyph img", 5);
  const calloutText = await page.$$eval(".callout-glyph", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_water_seven.png`), fullPage: true });
  results.push({ page: "water-seven", label: config.label, callouts, calloutText });
  await context.close();
}

async function testBattle(browser, config, errors, results) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, `${config.label}:battle`);
  await page.goto(`${ROOT_URL}/board_battle.html?single_character_icons_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__?.playRaidPhaseRewardFx, null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const nodes = [...document.querySelectorAll(".matchup-node")];
    return nodes.length === 3 && nodes.map((node) => node.textContent.trim()).join("") === "技力速";
  }, null, { timeout: 5000 });
  await page.evaluate(() => window.__BOARD_BATTLE_DEBUG__.playRaidPhaseRewardFx({
    defeatedName: "司法島守衛",
    nextEnemyName: "下一名守衛",
    bonus: { id: "shield", index: 5, label: "絕對屏障", description: "下一戰獲得屏障。" },
    segments: ["heal", "pp", "attack", "defense", "speed", "shield", "revive", "burst"].map((id) => ({ id, iconKey: id, label: id })),
    duration: 12000,
  }));
  await page.waitForSelector(".raid-phase-fx.show .raid-slot-icon img", { timeout: 5000 });
  await page.waitForTimeout(3300);
  const matchup = await page.$$eval(".matchup-node", (nodes) => ({
    count: nodes.length,
    texts: nodes.map((node) => node.textContent.trim()),
    imageCount: nodes.reduce((total, node) => total + node.querySelectorAll("img").length, 0),
    backgrounds: nodes.map((node) => getComputedStyle(node).backgroundImage),
    overflow: nodes.some((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
  }));
  const attributePills = await page.$$eval(".attribute-pill", (nodes) => ({
    count: nodes.length,
    texts: nodes.map((node) => node.textContent.trim()),
    imageCount: nodes.reduce((total, node) => total + node.querySelectorAll("img").length, 0),
    overflow: nodes.some((node) => node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1),
  }));
  const raidCount = await page.$$eval(".raid-slot-icon img", (images) => images.length);
  const raidBroken = await page.$$eval(".raid-slot-icon img, .raid-wheel-center img", (images) => images.filter((image) => !image.complete || image.naturalWidth !== 256 || image.naturalHeight !== 256).length);
  const legacyText = await page.$$eval(".raid-slot-icon, .raid-wheel-center", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_battle.png`), fullPage: true });
  results.push({ page: "battle", label: config.label, matchup, attributePills, raidCount, raidBroken, legacyText });
  await context.close();
}

async function testImpelDown(browser, config, errors, results) {
  const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, `${config.label}:impel`);
  await page.goto(`${ROOT_URL}/board_impel_down.html?single_character_icons_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => window.__IMPEL_DOWN_DEBUG__?.previewEventSpin, null, { timeout: 15000 });
  await page.evaluate(() => window.__IMPEL_DOWN_DEBUG__.previewEventSpin("magellan", true));
  await page.waitForSelector("#eventArt .reward-slot-icon img", { timeout: 5000 });
  const count = await page.$$eval("#eventArt .reward-slot-icon img", (images) => images.length);
  const broken = await page.$$eval("#eventArt .reward-slot-icon img, #eventArt .reward-slot-center img", (images) => images.filter((image) => !image.complete || image.naturalWidth !== 256 || image.naturalHeight !== 256).length);
  const legacyText = await page.$$eval("#eventArt .reward-slot-icon, #eventArt .reward-slot-center", (nodes) => nodes.map((node) => node.textContent.trim()).filter(Boolean));
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}_impel.png`), fullPage: true });
  results.push({ page: "impel", label: config.label, count, broken, legacyText });
  await context.close();
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const opticalCenters = await inspectOpticalCenters();
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const results = [];
  try {
    for (const config of CASES) {
      await testBoardPage(browser, config, errors, results);
      await testWaterSeven(browser, config, errors, results);
      await testBattle(browser, config, errors, results);
      await testImpelDown(browser, config, errors, results);
    }
  } finally {
    await browser.close();
  }

  const failures = [...errors];
  if (opticalCenters.length !== 26) failures.push(`source-icons:count ${opticalCenters.length}/26`);
  for (const icon of opticalCenters) {
    if (icon.width !== 256 || icon.height !== 256 || !icon.alpha) failures.push(`source-icons:invalid ${icon.file}`);
    if (Math.abs(icon.offsetX) > 0.6 || Math.abs(icon.offsetY) > 0.6) failures.push(`source-icons:off-center ${icon.file}`);
    if (icon.safeEdge < 12) failures.push(`source-icons:clipped ${icon.file}`);
  }
  for (const result of results) {
    for (const group of [result.training, result.ship, result.fleet, result.codex, result.callouts].filter(Boolean)) {
      if (group.count !== group.expected) failures.push(`${result.label}:${result.page}:count ${group.count}/${group.expected}`);
      if (group.broken || group.wrongSize || group.incomingSource || !group.inside) failures.push(`${result.label}:${result.page}:invalid image group`);
    }
    if (result.trainingText?.length || result.shipText?.length || result.fleetText?.length || result.codexText?.length || result.calloutText?.length || result.legacyText?.length) failures.push(`${result.label}:${result.page}:legacy text icon remains`);
    if (result.boardAttributes && (!result.boardAttributes.count || result.boardAttributes.imageCount || result.boardAttributes.overflow || result.boardAttributes.texts.some((text) => !["力", "速", "技", "無"].includes(text)))) failures.push(`${result.label}:board:attribute text invalid`);
    if (result.matchup && (result.matchup.count !== 3 || result.matchup.imageCount || result.matchup.overflow || result.matchup.texts.join("") !== "技力速" || result.matchup.backgrounds.some((value) => value === "none"))) failures.push(`${result.label}:battle:matchup text invalid`);
    if (result.attributePills && (!result.attributePills.count || result.attributePills.imageCount || result.attributePills.overflow || result.attributePills.texts.some((text) => !["力", "速", "技", "無"].includes(text)))) failures.push(`${result.label}:battle:attribute text invalid`);
    if (result.page === "battle" && (result.raidCount < 30 || result.raidBroken)) failures.push(`${result.label}:battle:raid icons invalid`);
    if (result.page === "impel" && (result.count < 20 || result.broken)) failures.push(`${result.label}:impel:event icons invalid`);
  }
  const report = { ok: failures.length === 0, failures, opticalCenters, results, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "qa_report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
