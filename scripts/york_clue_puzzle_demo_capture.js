"use strict";

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const puzzleApi = require(path.resolve(__dirname, "../public/js/board_york_clue_puzzle.js"));

const baseUrl = process.argv[2] || "http://127.0.0.1:8787/board_york_clue_puzzle_formal_demo.html";
const outputDir = path.resolve(__dirname, "../public/images/board/postgame_clue_puzzle_ui/incoming/screenshots");
const layoutSeed = "formal-preview-layout-20260802";
const playerId = "formal-preview-player-1";
const chromePath = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const expectedSlotCenters = [468, 551.5, 634.5, 717.5, 800.5, 883, 966, 1049, 1132.5, 1216, 1299, 1383, 1467];
const sourceFrameSize = { width: 1672, height: 941 };

fs.mkdirSync(outputDir, { recursive: true });

async function openDifficulty(browser, key, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("response", response => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      errors.push(`http ${response.status()}: ${response.url()}`);
    }
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator(`[data-difficulty="${key}"]`).click();
  await page.locator("#sequencePanel [data-slot-index]").first().waitFor({ state: "visible" });
  await page.waitForTimeout(250);
  return { page, errors };
}

async function captureDifficultySelection(browser, viewport, filename) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on("pageerror", error => errors.push(`pageerror: ${error.message}`));
  page.on("console", message => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`console: ${message.text()}`);
  });
  await page.goto(baseUrl, { waitUntil: "networkidle" });
  await page.locator("[data-difficulty]").first().waitFor({ state: "visible" });
  const textOverflow = await page.evaluate(() => Array.from(document.querySelectorAll([
    ".selection-header h1", ".selection-lead", ".account-state span", ".difficulty-kicker",
    ".difficulty-content h2", ".difficulty-target", ".difficulty-desc", ".difficulty-meta",
    ".difficulty-action", ".selection-note", ".demo-tag",
  ].join(","))).filter(element => element.scrollWidth > element.clientWidth + 1 || (["hidden", "clip", "auto", "scroll"].includes(getComputedStyle(element).overflowY) && element.scrollHeight > element.clientHeight + 1)).map(element => ({
    text: String(element.textContent || "").trim().slice(0, 100),
    client: [element.clientWidth, element.clientHeight],
    scroll: [element.scrollWidth, element.scrollHeight],
  })));
  if (textOverflow.length) errors.push(`selection text overflow: ${JSON.stringify(textOverflow)}`);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: true });
  await page.close();
  return { viewport, textOverflow, errors };
}

async function capturePuzzle(browser, key, viewport, filename) {
  const { page, errors } = await openDifficulty(browser, key, viewport);
  const slotCount = await page.locator("#sequencePanel [data-slot-index]").count();
  const bankCardCount = await page.locator("[data-bank-card]").count();
  const clueCount = await page.locator("#clueList [data-clue-card]").count();
  const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const textOverflow = await page.evaluate(() => {
    const selectors = [
      ".clue-panel h2", ".clue-summary", ".clue-row", ".clue-copy",
      ".status-title strong", ".status-title span", ".badge", ".bank-heading",
      ".bank-card-label", ".sequence-message", ".image-button",
    ];
    return Array.from(document.querySelectorAll(selectors.join(",")))
      .filter(element => {
        const style = getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") return false;
        return element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1;
      })
      .map(element => ({
        selector: element.id ? `#${element.id}` : `.${Array.from(element.classList).join(".")}`,
        text: String(element.textContent || "").trim().slice(0, 80),
        client: [element.clientWidth, element.clientHeight],
        scroll: [element.scrollWidth, element.scrollHeight],
      }));
  });
  if (textOverflow.length) errors.push(`text overflow: ${JSON.stringify(textOverflow)}`);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
  await page.close();
  return { key, viewport, slotCount, bankCardCount, clueCount, documentWidth, textOverflow, errors };
}

async function runInteractionAudit(browser) {
  const { page, errors } = await openDifficulty(browser, "easy", { width: 1440, height: 900 });
  let placementAlignment = null;
  const slots = () => page.locator("#sequencePanel [data-slot-index]").evaluateAll(elements => elements.map(element => {
    const card = element.querySelector("[data-placed-card]");
    return card ? Number(card.dataset.placedCard) : null;
  }));
  const bank = () => page.locator("[data-bank-card]").evaluateAll(cards => cards.map(card => Number(card.dataset.bankCard)));
  const initialBank = await bank();

  const firstCard = initialBank[0];
  await page.locator(`[data-bank-card="${firstCard}"]`).click();
  await page.locator("#sequencePanel [data-slot-index]").nth(0).click();
  if ((await slots())[0] !== firstCard || (await bank()).includes(firstCard)) errors.push("bottom-to-top placement failed");
  for (let index = 1; index < 5; index += 1) {
    await page.locator(`[data-bank-card="${initialBank[index]}"]`).click();
    await page.locator("#sequencePanel [data-slot-index]").nth(index).click();
  }
  placementAlignment = await page.evaluate(({ expectedCenters, sourceSize }) => {
    const stage = document.querySelector(".puzzle-stage").getBoundingClientRect();
    const panel = document.querySelector("#sequencePanel").getBoundingClientRect();
    const targetBoxes = Array.from(document.querySelectorAll("#sequencePanel [data-slot-index]")).map(slot => {
      const box = slot.getBoundingClientRect();
      return { left: box.left, width: box.width, center: box.left + box.width / 2 };
    });
    const placed = Array.from(document.querySelectorAll("#sequencePanel [data-slot-index] .formal-clue-card"));
    const offsets = placed.map((card, index) => {
      const box = card.getBoundingClientRect();
      const expectedX = stage.left + stage.width * expectedCenters[index] / sourceSize.width;
      const expectedY = stage.top + stage.height * 250 / sourceSize.height;
      return {
        index,
        dx: Number((box.left + box.width / 2 - expectedX).toFixed(3)),
        dy: Number((box.top + box.height / 2 - expectedY).toFixed(3)),
      };
    });
    return {
      stage: { left: stage.left, top: stage.top, width: stage.width, height: stage.height },
      panel: { left: panel.left, top: panel.top, width: panel.width, height: panel.height },
      targetBoxes,
      offsets,
      maxAbsDx: Math.max(...offsets.map(offset => Math.abs(offset.dx))),
      maxAbsDy: Math.max(...offsets.map(offset => Math.abs(offset.dy))),
    };
  }, { expectedCenters: expectedSlotCenters, sourceSize: sourceFrameSize });
  if (placementAlignment.maxAbsDx > 1.5 || placementAlignment.maxAbsDy > 1.5) {
    errors.push(`placed cards are not centered in image slots: ${JSON.stringify(placementAlignment)}`);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(outputDir, "york_easy_card_placement_desktop_1440x900.png"), fullPage: false });

  await page.locator("[data-lock-index='0']").click();
  const lockedCard = (await slots())[0];
  await page.locator("#shuffleButton").click();
  if ((await slots())[0] !== lockedCard) errors.push("bottom shuffle moved a locked top slot");

  await page.locator("#resetButton").click();
  const resetBank = await bank();
  if (!puzzleApi.arraysEqual(initialBank, resetBank)) errors.push("reset did not restore the initial bottom-card order");
  if ((await slots()).some(Number.isInteger)) errors.push("reset did not clear all top slots");
  if (await page.locator(".slot-lock.locked").count()) errors.push("reset did not unlock all slots");

  await page.locator("#submitButton").click();
  const wrongMessage = await page.locator("#sequenceMessage").textContent();
  if (!String(wrongMessage).includes("仍有空格")) errors.push("incomplete answer did not show the generic message");

  const solution = puzzleApi.createPuzzle(layoutSeed, playerId, "easy").solution;
  for (let index = 0; index < solution.length; index += 1) {
    await page.locator(`[data-bank-card="${solution[index]}"]`).click();
    await page.locator("#sequencePanel [data-slot-index]").nth(index).click();
  }
  await page.locator("#submitButton").click();
  await page.locator("#resultOverlay:not(.hidden)").waitFor({ state: "visible" });
  const resultAlignment = await page.evaluate(({ sourceSize }) => {
    const stage = document.querySelector(".result-stage").getBoundingClientRect();
    const expectedCenters = {
      decoder: [1024, 259],
      tier: [1338, 202],
      world: [1348, 318],
      rate: [1243, 429],
      close: [836, 835],
    };
    const elements = {
      decoder: document.querySelector("#resultDecoder"),
      tier: document.querySelector("#resultTier")?.closest(".result-field"),
      world: document.querySelector("#resultWorld")?.closest(".result-field"),
      rate: document.querySelector("#resultRate")?.closest(".result-field"),
      close: document.querySelector("#resultClose"),
    };
    const centers = Object.fromEntries(Object.entries(elements).map(([key, element]) => {
      const box = element.getBoundingClientRect();
      const sourceX = (box.left + box.width / 2 - stage.left) / stage.width * sourceSize.width;
      const sourceY = (box.top + box.height / 2 - stage.top) / stage.height * sourceSize.height;
      return [key, {
        sourceX: Number(sourceX.toFixed(2)),
        sourceY: Number(sourceY.toFixed(2)),
        dx: Number((sourceX - expectedCenters[key][0]).toFixed(2)),
        dy: Number((sourceY - expectedCenters[key][1]).toFixed(2)),
      }];
    }));
    const textOverflow = Array.from(document.querySelectorAll([
      ".result-copy .eyebrow", ".result-copy h2", ".result-copy p",
      ".result-field span", ".result-field strong", ".result-close",
    ].join(","))).filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).map(element => ({
      text: String(element.textContent || "").trim(),
      client: [element.clientWidth, element.clientHeight],
      scroll: [element.scrollWidth, element.scrollHeight],
    }));
    return { centers, textOverflow };
  }, { sourceSize: sourceFrameSize });
  if (Object.values(resultAlignment.centers).some(center => Math.abs(center.dx) > 15 || Math.abs(center.dy) > 15)) {
    errors.push(`result content is not aligned to image boxes: ${JSON.stringify(resultAlignment.centers)}`);
  }
  if (resultAlignment.textOverflow.length) errors.push(`result text overflow: ${JSON.stringify(resultAlignment.textOverflow)}`);
  await page.screenshot({ path: path.join(outputDir, "york_result_success_desktop.png"), fullPage: false });
  const resultTier = await page.locator("#resultTier").textContent();
  if (!String(resultTier).includes("一階")) errors.push("success result did not award the expected tier");
  await page.close();
  return { initialBankOrder: initialBank, solution, placementAlignment, resultAlignment, errors };
}

async function captureResultViewport(browser, viewport, filename) {
  const { page, errors } = await openDifficulty(browser, "easy", viewport);
  const solution = puzzleApi.createPuzzle(layoutSeed, playerId, "easy").solution;
  for (let index = 0; index < solution.length; index += 1) {
    await page.locator(`[data-bank-card="${solution[index]}"]`).click();
    await page.locator("#sequencePanel [data-slot-index]").nth(index).click();
  }
  await page.locator("#submitButton").click();
  await page.locator("#resultOverlay:not(.hidden)").waitFor({ state: "visible" });
  const layout = await page.evaluate(() => {
    const overlay = document.querySelector("#resultOverlay");
    const stage = document.querySelector(".result-stage").getBoundingClientRect();
    const textOverflow = Array.from(document.querySelectorAll([
      ".result-copy .eyebrow", ".result-copy h2", ".result-copy p",
      ".result-field span", ".result-field strong", ".result-close",
    ].join(","))).filter(element => element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1).map(element => ({
      text: String(element.textContent || "").trim(),
      client: [element.clientWidth, element.clientHeight],
      scroll: [element.scrollWidth, element.scrollHeight],
    }));
    return {
      stage: { left: stage.left, top: stage.top, width: stage.width, height: stage.height },
      viewport: [window.innerWidth, window.innerHeight],
      overlay: { clientHeight: overlay.clientHeight, scrollHeight: overlay.scrollHeight, overflowY: getComputedStyle(overlay).overflowY },
      textOverflow,
    };
  });
  if (layout.stage.left < -1 || layout.stage.left + layout.stage.width > layout.viewport[0] + 1) errors.push(`result stage exceeds viewport width: ${JSON.stringify(layout)}`);
  if (layout.stage.height > layout.viewport[1] && !["auto", "scroll"].includes(layout.overlay.overflowY)) errors.push(`tall result stage is not scrollable: ${JSON.stringify(layout)}`);
  if (layout.textOverflow.length) errors.push(`result viewport text overflow: ${JSON.stringify(layout.textOverflow)}`);
  await page.screenshot({ path: path.join(outputDir, filename), fullPage: false });
  await page.close();
  return { viewport, layout, errors };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromePath });
  try {
    const captures = [];
    const selections = [];
    selections.push(await captureDifficultySelection(browser, { width: 1440, height: 900 }, "york_difficulty_selection_desktop_1440x900.png"));
    selections.push(await captureDifficultySelection(browser, { width: 1024, height: 768 }, "york_difficulty_selection_tablet_1024x768.png"));
    selections.push(await captureDifficultySelection(browser, { width: 390, height: 844 }, "york_difficulty_selection_phone_390x844.png"));
    captures.push(await capturePuzzle(browser, "easy", { width: 1440, height: 900 }, "york_easy_desktop_1440x900.png"));
    captures.push(await capturePuzzle(browser, "normal", { width: 1024, height: 768 }, "york_normal_tablet_1024x768.png"));
    captures.push(await capturePuzzle(browser, "hard", { width: 1440, height: 900 }, "york_hard_desktop_1440x900.png"));
    captures.push(await capturePuzzle(browser, "normal", { width: 390, height: 844 }, "york_normal_phone_390x844.png"));
    captures.push(await capturePuzzle(browser, "hard", { width: 844, height: 390 }, "york_hard_phone_844x390.png"));
    const interaction = await runInteractionAudit(browser);
    const resultCaptures = [];
    resultCaptures.push(await captureResultViewport(browser, { width: 1912, height: 895 }, "york_result_success_desktop_1912x895.png"));
    resultCaptures.push(await captureResultViewport(browser, { width: 390, height: 844 }, "york_result_success_phone_390x844.png"));
    resultCaptures.push(await captureResultViewport(browser, { width: 844, height: 390 }, "york_result_success_phone_844x390.png"));
    const report = {
      ok: selections.every(selection => selection.errors.length === 0)
        && captures.every(capture => capture.slotCount === 13 && capture.bankCardCount === 13 && capture.clueCount === 13 && capture.errors.length === 0)
        && resultCaptures.every(capture => capture.errors.length === 0)
        && interaction.errors.length === 0,
      baseUrl,
      selections,
      captures,
      resultCaptures,
      interaction,
      outputDir,
    };
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
