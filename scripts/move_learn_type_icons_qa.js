const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/move_learn_type_icons_20260817_v111_no_frame";

const CASES = [
  {
    label: "desktop",
    viewport: { width: 1600, height: 900 },
    currentTypes: ["attack", "special", "buff", "shield"],
    newType: "special",
  },
  {
    label: "tablet",
    viewport: { width: 1024, height: 768 },
    currentTypes: ["debuff", "heal", "control", "status"],
    newType: "attack",
  },
  {
    label: "phone_landscape",
    viewport: { width: 932, height: 430 },
    currentTypes: ["attack", "special", "buff", "shield"],
    newType: "heal",
  },
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

async function setupMoveLearn(page, config) {
  await page.evaluate(({ currentTypes, newType }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players[0];
    const source = window.BoardCards.cards.find((card) => String(card.name || "").includes("凱洛特"))
      || window.BoardCards.cards[0];
    const card = debug.cloneCard({ ...source, level: 20 });
    const labels = {
      attack: "爪擊",
      special: "電氣爪",
      buff: "兔躍",
      debuff: "月影壓制",
      heal: "月光療癒",
      shield: "月步閃避",
      control: "鎖鏈牽制",
      status: "滿月姿態",
    };
    const makeMove = (type, index, isNew = false) => ({
      id: `qa_move_type_${type}_${index}${isNew ? "_new" : ""}`,
      name: labels[type] || type,
      category: type,
      type,
      unlockLevel: isNew ? 15 : 1,
      pp: Math.max(5, 25 - index * 5),
      currentPP: Math.max(5, 25 - index * 5),
      power: ["attack", "special"].includes(type) ? 45 + index * 10 : 0,
      damageClass: type === "special" ? "special" : type === "attack" ? "physical" : "status",
      effectText: ["attack", "special"].includes(type) ? "6：痛擊" : `${labels[type] || type}效果`,
      effects: {},
    });
    const currentMoves = currentTypes.map((type, index) => makeMove(type, index));
    const newMove = makeMove(newType, 4, true);
    card.moveSet = [...currentMoves, newMove];
    card.learnset = card.moveSet.map((move) => move.id);
    card.unlockedMoveIds = currentMoves.map((move) => move.id);
    card.level = 20;
    player.crew = [card];
    player.activeCrewIndex = 0;
    player.isCPU = false;
    player.isCpu = false;
    player.isMe = true;
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.resolutionLock = false;
    game.pendingMoveLearnQueue = [{ playerId: player.id, cardId: card.id, moveId: newMove.id }];
    state.battleState = null;
    debug.moveLearnQa.open({ playerId: player.id, notify: true });
  }, config);
  await page.waitForSelector(".move-learn-ui .move-learn-current-card", { timeout: 10000 });
  await page.waitForFunction(() => [...document.querySelectorAll(".move-learn-current-badge img")]
    .every((image) => image.complete && image.naturalWidth === 256 && image.naturalHeight === 256));
}

async function inspect(page, expectedTypes) {
  return page.evaluate((typeCount) => {
    const modal = document.querySelector(".board-modal.move-learn-nautical-modal");
    const cards = [...document.querySelectorAll(".move-learn-current-card")];
    const badges = [...document.querySelectorAll(".move-learn-current-badge")];
    const badgeImages = [...document.querySelectorAll(".move-learn-current-badge img")];
    const badgeLabels = [...document.querySelectorAll(".move-learn-current-badge small")];
    const centralImage = document.querySelector(".move-learn-new-type-value img");
    const centralTypeText = document.querySelector(".move-learn-new-type-value b")?.textContent?.trim() || "";
    const oldLetterNodes = [...document.querySelectorAll(".move-learn-current-badge > b")];
    const modalRect = modal?.getBoundingClientRect();
    const inside = (outer, inner) => outer && inner
      && inner.left >= outer.left - 1 && inner.right <= outer.right + 1
      && inner.top >= outer.top - 1 && inner.bottom <= outer.bottom + 1;
    const noOverflow = (element) => element.scrollWidth <= element.clientWidth + 1
      && element.scrollHeight <= element.clientHeight + 1;
    return {
      modalVisible: Boolean(modalRect?.width && modalRect?.height),
      cardCount: cards.length,
      badgeCount: badges.length,
      badgeLabelCount: badgeLabels.length,
      iconCount: badgeImages.length,
      centralTypeIconCount: centralImage ? 1 : 0,
      centralTypeText,
      oldLetterNodeCount: oldLetterNodes.length,
      sources: badgeImages.map((image) => image.currentSrc),
      naturalSizes: badgeImages.map((image) => [image.naturalWidth, image.naturalHeight]),
      iconsInsideBadges: badgeImages.every((image, index) => inside(badges[index]?.getBoundingClientRect(), image.getBoundingClientRect())),
      badgeCenterDeltas: badgeImages.map((image, index) => {
        const badgeRect = badges[index]?.getBoundingClientRect();
        const imageRect = image.getBoundingClientRect();
        return badgeRect ? {
          x: Math.abs((badgeRect.left + badgeRect.width / 2) - (imageRect.left + imageRect.width / 2)),
          y: Math.abs((badgeRect.top + badgeRect.height / 2) - (imageRect.top + imageRect.height / 2)),
        } : { x: 999, y: 999 };
      }),
      iconsInsideCards: badgeImages.every((image, index) => inside(cards[index]?.getBoundingClientRect(), image.getBoundingClientRect())),
      modalInsideViewport: Boolean(modalRect
        && modalRect.left >= -1 && modalRect.top >= -1
        && modalRect.right <= innerWidth + 1 && modalRect.bottom <= innerHeight + 1),
      textNoOverflow: [...document.querySelectorAll(".move-learn-current-copy, .move-learn-current-meta, .move-learn-new-stat, .move-learn-hint, .move-learn-actions button")]
        .every(noOverflow),
      expectedTypes: typeCount,
    };
  }, expectedTypes);
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const results = [];
  try {
    for (const config of CASES) {
      const context = await browser.newContext({ viewport: config.viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      attachErrors(page, errors, config.label);
      await page.goto(`${ROOT_URL}/board_game.html?move_learn_type_icons_qa=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.moveLearnQa?.open && window.BoardCards?.cards?.length, null, { timeout: 20000 });
      await setupMoveLearn(page, config);
      const result = await inspect(page, config.currentTypes.length + 1);
      const expectedIconByType = {
        attack: "physical_attack.webp",
        special: "special_attack.webp",
        buff: "buff.webp",
        debuff: "debuff.webp",
        heal: "heal.webp",
        shield: "shield.webp",
        control: "control.webp",
        status: "status.webp",
      };
      const expectedIcons = config.currentTypes.map((type) => expectedIconByType[type]);
      results.push({ label: config.label, viewport: config.viewport, expectedIcons, ...result });
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${config.label}.png`), fullPage: true });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const failures = [];
  results.forEach((result) => {
    if (!result.modalVisible) failures.push(`${result.label}: move learn modal missing`);
    if (result.cardCount !== 4 || result.badgeCount !== 4 || result.iconCount !== 4) failures.push(`${result.label}: icon/card count mismatch`);
    if (result.badgeLabelCount !== 0) failures.push(`${result.label}: badge type text remains`);
    if (result.centralTypeIconCount !== 0 || !result.centralTypeText) failures.push(`${result.label}: central type detail should be text only`);
    if (result.oldLetterNodeCount !== 0) failures.push(`${result.label}: legacy letter badge remains`);
    if (result.sources.some((source) => !source.includes("/move_type_icons/") || source.includes("/incoming/"))) failures.push(`${result.label}: wrong icon source`);
    if (result.sources.some((source, index) => !source.includes(`/${result.expectedIcons[index]}?`))) failures.push(`${result.label}: category icon mapping mismatch`);
    if (result.naturalSizes.some(([width, height]) => width !== 256 || height !== 256)) failures.push(`${result.label}: icon dimensions are not 256x256`);
    if (!result.iconsInsideCards) failures.push(`${result.label}: an icon exceeds its move card`);
    if (!result.iconsInsideBadges) failures.push(`${result.label}: an icon exceeds its badge frame`);
    if (result.badgeCenterDeltas.some(({ x, y }) => x > 1 || y > 1)) failures.push(`${result.label}: an icon is not centered in its badge frame`);
    if (!result.modalInsideViewport) failures.push(`${result.label}: modal exceeds viewport`);
    if (!result.textNoOverflow) failures.push(`${result.label}: text overflow detected`);
  });
  failures.push(...errors);
  console.log(JSON.stringify({ ok: failures.length === 0, failures, results, outputDir: OUTPUT_DIR }, null, 2));
  if (failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
