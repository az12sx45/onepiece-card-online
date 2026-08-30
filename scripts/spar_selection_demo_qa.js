const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || path.resolve("_codex_artifacts/spar-selection-demo-qa");

function captureErrors(page, errors, label) {
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

async function verifyViewport(browser, spec, errors, failures) {
  const context = await browser.newContext({ viewport: spec.viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  captureErrors(page, errors, spec.label);
  await page.goto(`${ROOT_URL}/board_spar_selection_demo.html`, { waitUntil: "networkidle", timeout: 20000 });

  const initial = await page.evaluate(() => ({
    leftCards: document.querySelectorAll("#leftCrew .crew-card").length,
    rightCards: document.querySelectorAll("#rightCrew .crew-card").length,
    attributeSlots: document.querySelectorAll(".attribute-slot").length,
    legacyAttributeCrests: document.querySelectorAll(".attribute-crest").length,
    detailCues: document.querySelectorAll(".detail-cue").length,
    room: (() => {
      const rect = document.querySelector("#sparRoom")?.getBoundingClientRect();
      return rect ? { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } : null;
    })(),
    viewport: { width: innerWidth, height: innerHeight },
    scroll: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
  }));
  if (initial.leftCards !== 6 || initial.rightCards !== 6) failures.push(`${spec.label}: expected 6+6 cards, got ${initial.leftCards}+${initial.rightCards}`);
  if (initial.attributeSlots !== 12 || initial.legacyAttributeCrests !== 0 || initial.detailCues !== 0) {
    failures.push(`${spec.label}: inline attribute/no-detail-button contract failed ${JSON.stringify(initial)}`);
  }
  if (!initial.room || initial.room.left < -1 || initial.room.top < -1 || initial.room.right > initial.viewport.width + 1 || initial.room.bottom > initial.viewport.height + 1) {
    failures.push(`${spec.label}: spar room outside viewport ${JSON.stringify(initial)}`);
  }
  if (initial.scroll.width > initial.viewport.width + 1 || initial.scroll.height > initial.viewport.height + 1) {
    failures.push(`${spec.label}: document overflow ${JSON.stringify(initial.scroll)}`);
  }
  const frameAlpha = await page.evaluate(async () => {
    const image = new Image();
    image.src = "images/board/spar_ui/spar_character_card_overlay_frame_v1.webp";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const alphaAt = (x, y) => context.getImageData(Math.round(x), Math.round(y), 1, 1).data[3];
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      portraitCenter: alphaAt(image.naturalWidth * .5, image.naturalHeight * .32),
      outsideCorner: alphaAt(image.naturalWidth * .02, image.naturalHeight * .5),
      nameplate: alphaAt(image.naturalWidth * .5, image.naturalHeight * .75),
    };
  });
  if (frameAlpha.width !== 1086 || frameAlpha.height !== 1448 || frameAlpha.portraitCenter !== 0 || frameAlpha.outsideCorner !== 0 || frameAlpha.nameplate < 200) {
    failures.push(`${spec.label}: card overlay alpha contract failed ${JSON.stringify(frameAlpha)}`);
  }
  const cardGeometry = await page.evaluate(() => {
    const card = document.querySelector("#leftCrew .crew-card");
    const frame = card?.querySelector(".card-shell-art");
    const portraitWindow = card?.querySelector(".portrait-window");
    const name = card?.querySelector(".crew-name");
    const meta = card?.querySelector(".crew-meta");
    const attribute = card?.querySelector(".attribute-slot");
    if (!card || !frame || !portraitWindow || !name || !meta || !attribute) return null;
    const cardRect = card.getBoundingClientRect();
    const frameRect = frame.getBoundingClientRect();
    const portraitRect = portraitWindow.getBoundingClientRect();
    const nameRect = name.getBoundingClientRect();
    const metaRect = meta.getBoundingClientRect();
    const attributeRect = attribute.getBoundingClientRect();
    const relativeCenter = (rect) => ((rect.top + rect.bottom) / 2 - cardRect.top) / cardRect.height;
    const relativeCenterX = (rect) => ((rect.left + rect.right) / 2 - cardRect.left) / cardRect.width;
    return {
      ratio: cardRect.width / cardRect.height,
      frameDelta: {
        left: Math.abs(frameRect.left - cardRect.left),
        top: Math.abs(frameRect.top - cardRect.top),
        right: Math.abs(frameRect.right - cardRect.right),
        bottom: Math.abs(frameRect.bottom - cardRect.bottom),
      },
      portraitBounds: {
        left: (portraitRect.left - cardRect.left) / cardRect.width,
        top: (portraitRect.top - cardRect.top) / cardRect.height,
        right: (portraitRect.right - cardRect.left) / cardRect.width,
        bottom: (portraitRect.bottom - cardRect.top) / cardRect.height,
        overflow: getComputedStyle(portraitWindow).overflow,
      },
      nameCenter: relativeCenter(nameRect),
      metaCenter: relativeCenter(metaRect),
      horizontalCenters: {
        frame: relativeCenterX(frameRect),
        portrait: relativeCenterX(portraitRect),
        name: relativeCenterX(nameRect),
        meta: relativeCenterX(metaRect),
      },
      attributeCenter: { x: relativeCenterX(attributeRect), y: relativeCenter(attributeRect) },
    };
  });
  if (!cardGeometry
    || Math.abs(cardGeometry.ratio - .75) > .015
    || Object.values(cardGeometry.frameDelta).some((value) => value > 1)
    || Math.abs(cardGeometry.portraitBounds.left - .173) > .01
    || Math.abs(cardGeometry.portraitBounds.right - .827) > .01
    || Math.abs(cardGeometry.portraitBounds.top - .102) > .01
    || Math.abs(cardGeometry.portraitBounds.bottom - .659) > .01
    || cardGeometry.portraitBounds.overflow !== "hidden"
    || Math.abs(cardGeometry.nameCenter - .714) > .02
    || Math.abs(cardGeometry.metaCenter - .869) > .025
    || Object.values(cardGeometry.horizontalCenters).some((value) => Math.abs(value - .5) > .006)
    || Math.abs(cardGeometry.attributeCenter.x - .2371) > .006
    || Math.abs(cardGeometry.attributeCenter.y - .1581) > .006) {
    failures.push(`${spec.label}: card frame/name alignment failed ${JSON.stringify(cardGeometry)}`);
  }

  await page.locator("#rightCrew .crew-card").first().click();
  await page.locator("#detailBackdrop.open").waitFor();
  const detailFrameAlpha = await page.evaluate(async () => {
    const image = new Image();
    image.src = "images/board/spar_ui/spar_character_detail_overlay_frame_v1.webp";
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0);
    const alphaAt = (x, y) => context.getImageData(Math.round(x), Math.round(y), 1, 1).data[3];
    return {
      width: image.naturalWidth,
      height: image.naturalHeight,
      outside: alphaAt(image.naturalWidth * .005, image.naturalHeight * .5),
      portrait: alphaAt(image.naturalWidth * .28, image.naturalHeight * .4),
      title: alphaAt(image.naturalWidth * .7, image.naturalHeight * .16),
      stat: alphaAt(image.naturalWidth * .6, image.naturalHeight * .28),
      information: alphaAt(image.naturalWidth * .7, image.naturalHeight * .65),
      topRail: alphaAt(image.naturalWidth * .35, image.naturalHeight * .055),
      button: alphaAt(image.naturalWidth * .7, image.naturalHeight * .86),
    };
  });
  if (detailFrameAlpha.width !== 1536 || detailFrameAlpha.height !== 1024
    || detailFrameAlpha.outside !== 0 || detailFrameAlpha.portrait !== 0
    || detailFrameAlpha.title !== 0 || detailFrameAlpha.stat !== 0
    || detailFrameAlpha.information !== 0 || detailFrameAlpha.topRail < 200
    || detailFrameAlpha.button < 200) {
    failures.push(`${spec.label}: detail overlay alpha contract failed ${JSON.stringify(detailFrameAlpha)}`);
  }
  const detailText = await page.locator("#detailPanel").innerText();
  if (/攜帶物|道具|裝備欄|持有物/.test(detailText)) failures.push(`${spec.label}: hidden carried-item information leaked in detail panel`);
  const detailRect = await page.locator("#detailPanel").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, scrollHeight: node.scrollHeight, clientHeight: node.clientHeight };
  });
  if (detailRect.left < -1 || detailRect.right > spec.viewport.width + 1 || detailRect.top < -1 || detailRect.bottom > spec.viewport.height + 1) {
    failures.push(`${spec.label}: detail panel outside viewport ${JSON.stringify(detailRect)}`);
  }
  const detailSlots = await page.evaluate(() => {
    const panel = document.querySelector("#detailPanel")?.getBoundingClientRect();
    const frame = document.querySelector(".detail-frame-art")?.getBoundingClientRect();
    const portrait = document.querySelector(".detail-portrait")?.getBoundingClientRect();
    const attribute = document.querySelector(".detail-attribute")?.getBoundingClientRect();
    const attributeStyle = document.querySelector(".detail-attribute") ? getComputedStyle(document.querySelector(".detail-attribute")) : null;
    const name = document.querySelector(".detail-portrait-name")?.getBoundingClientRect();
    const title = document.querySelector(".detail-title")?.getBoundingClientRect();
    const stats = [...document.querySelectorAll(".stat")].map((node) => node.getBoundingClientRect());
    const body = document.querySelector(".detail-body")?.getBoundingClientRect();
    const close = document.querySelector(".detail-close")?.getBoundingClientRect();
    if (!panel || !frame || !portrait || !attribute || !name || !title || stats.length !== 6 || !body || !close) return null;
    const normalize = (rect) => ({
      x: ((rect.left + rect.right) / 2 - panel.left) / panel.width,
      y: ((rect.top + rect.bottom) / 2 - panel.top) / panel.height,
    });
    return {
      panelCenter: { x: (panel.left + panel.right) / 2, y: (panel.top + panel.bottom) / 2 },
      frame: normalize(frame), portrait: normalize(portrait), attribute: normalize(attribute), name: normalize(name),
      attributeStyle: attributeStyle ? { fontSize: parseFloat(attributeStyle.fontSize), lineHeight: parseFloat(attributeStyle.lineHeight), textAlign: attributeStyle.textAlign } : null,
      title: normalize(title), stats: stats.map(normalize), body: normalize(body), close: normalize(close),
      bodyBottom: body.bottom, closeTop: close.top,
    };
  });
  if (!detailSlots || detailSlots.bodyBottom > detailSlots.closeTop + 1) failures.push(`${spec.label}: detail content overlaps close button ${JSON.stringify(detailSlots)}`);
  if (detailSlots) {
    const near = (actual, expected, tolerance = .008) => Math.abs(actual - expected) <= tolerance;
    const expectedStats = [[.596, .2778], [.8203, .2773], [.5964, .3735], [.82, .3735], [.5964, .4692], [.8203, .4692]];
    if (!near(detailSlots.panelCenter.x, spec.viewport.width / 2, 1)
      || !near(detailSlots.panelCenter.y, spec.viewport.height / 2, 1)
      || !near(detailSlots.frame.x, .5, .002) || !near(detailSlots.frame.y, .5, .002)
      || !near(detailSlots.portrait.x, .2562) || !near(detailSlots.portrait.y, .4614)
      || !near(detailSlots.attribute.x, .09075) || !near(detailSlots.attribute.y, .1529)
      || !detailSlots.attributeStyle || detailSlots.attributeStyle.fontSize < 18
      || Math.abs(detailSlots.attributeStyle.fontSize - detailSlots.attributeStyle.lineHeight) > 1
      || detailSlots.attributeStyle.textAlign !== "center"
      || !near(detailSlots.name.x, .2562) || !near(detailSlots.name.y, .87, .012)
      || !near(detailSlots.title.x, .7122) || !near(detailSlots.title.y, .1577)
      || !near(detailSlots.body.x, .708) || !near(detailSlots.body.y, .6519)
      || !near(detailSlots.close.x, .694) || !near(detailSlots.close.y, .865, .012)
      || detailSlots.stats.some((center, index) => !near(center.x, expectedStats[index][0]) || !near(center.y, expectedStats[index][1]))) {
      failures.push(`${spec.label}: detail content is not centered in frame openings ${JSON.stringify(detailSlots)}`);
    }
  }
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${spec.label}-detail.png`), fullPage: false });
  await page.locator(".detail-close").click();

  await page.locator("#sideToggle").click();
  for (const probe of [{ index: 0, attribute: "力" }, { index: 2, attribute: "速" }]) {
    await page.locator("#leftCrew .crew-card").nth(probe.index).click();
    await page.locator("#detailBackdrop.open").waitFor();
    const attributeText = (await page.locator(".detail-attribute").innerText()).trim();
    if (attributeText !== probe.attribute) failures.push(`${spec.label}: expected detail attribute ${probe.attribute}, got ${attributeText}`);
    await page.locator(".detail-close").click();
  }
  await page.locator("#sideToggle").click();

  const leftCards = page.locator("#leftCrew .crew-card");
  await leftCards.nth(0).click();
  await leftCards.nth(1).click();
  await leftCards.nth(2).click();
  if (await page.locator("#leftCrew .crew-card.selected").count() !== 3) failures.push(`${spec.label}: left secret selection did not reach 3`);
  await page.locator("#lockBtn").click();
  if ((await page.locator("#leftReady").innerText()).trim() !== "已鎖定") failures.push(`${spec.label}: left lock state missing`);
  if (await page.locator("#rightCrew .crew-card.selected").count() !== 0) failures.push(`${spec.label}: right side should not expose picks before its selection`);

  const rightCards = page.locator("#rightCrew .crew-card");
  await rightCards.nth(0).click();
  await rightCards.nth(1).click();
  await rightCards.nth(2).click();
  await page.locator("#lockBtn").click();
  await page.locator("#sparRoom.reveal-flash").waitFor();
  if (await page.locator(".crew-card.selected").count() !== 6) failures.push(`${spec.label}: simultaneous reveal did not show 3+3 selections`);
  if (!/雙方陣容揭曉/.test(await page.locator("#secretState").innerText())) failures.push(`${spec.label}: reveal status text missing`);
  if ((await page.locator("#lockBtn").innerText()).trim() !== "準備完成") failures.push(`${spec.label}: completed lock label missing`);

  await page.screenshot({ path: path.join(OUTPUT_DIR, `${spec.label}-revealed.png`), fullPage: false });
  await context.close();
  return initial;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, timeout: 15000 });
  const results = [];
  try {
    results.push(await verifyViewport(browser, { label: "desktop-1600x900", viewport: { width: 1600, height: 900 } }, errors, failures));
    results.push(await verifyViewport(browser, { label: "tablet-1024x768", viewport: { width: 1024, height: 768 } }, errors, failures));
  } finally {
    await browser.close();
  }
  const report = { errors, failures, results, outputDir: OUTPUT_DIR };
  console.log(JSON.stringify(report, null, 2));
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
