const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT
  || "C:/Users/王曜瑋/.codex/visualizations/2026/07/27/019fa333-31ef-7e32-b226-023fffa4c411/board_desktop_page_parity_20260815_v66";

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) {
      errors.push(`${label}:console:${message.text()}`);
    }
  });
}

async function waitForFrame(page, match, timeout = 20000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const frame = page.frames().find((candidate) => match(candidate.url()));
    if (frame) return frame;
    await page.waitForTimeout(100);
  }
  throw new Error(`Timed out waiting for frame: ${match}`);
}

async function loadHost(page, portable) {
  await page.goto(`${ROOT_URL}/board_game.html?desktop_page_parity_qa=1`, { waitUntil: "domcontentloaded" });
  if (!portable) {
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 25000 });
    return page.mainFrame();
  }
  await page.waitForURL(/board_fixed_viewport\.html/, { timeout: 15000 });
  const host = await waitForFrame(page, (url) => url.includes("board_game.html"));
  await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.startBattle && window.BoardCards?.cards?.length, null, { timeout: 25000 });
  return host;
}

async function openStandardBattle(page, host) {
  await host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const player = runtime.gameState.players[0];
    const source = window.BoardCards.cards.find((card) => card.id === "custom_mp3la6fr") || window.BoardCards.cards[0];
    player.crew = [debug.cloneCard({ ...source, level: 50, currentHp: Number.MAX_SAFE_INTEGER })];
    player.crew[0].currentHp = Number(player.crew[0].baseStats?.hp || 1);
    player.activeCrewIndex = 0;
    player.pendingBattle = null;
    runtime.battleState = null;
    if (!runtime.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player, { id: "desktop-page-parity-qa" });
    debug.ensurePostgameWorldLayout(runtime.gameState);
    const assignment = runtime.gameState.postgameWorld.islandAssignments.find((entry) => {
      const assignedIsland = debug.getIslandById(entry.islandId);
      return assignedIsland?.postgameBossKey === "postgame_judge";
    }) || runtime.gameState.postgameWorld.islandAssignments.find((entry) => {
      const assignedIsland = debug.getIslandById(entry.islandId);
      return assignedIsland?.postgameBossKey !== "postgame_tot_musica";
    });
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.currentHp = islandState.maxHp;
    islandState.isDefeated = false;
    runtime.gameState.skipNextBattleMapShake = true;
    debug.startBattle(player, island, islandState);
    if (runtime.battleState) {
      runtime.battleState.entryTransition = null;
      runtime.battleState.prebattleIntro = null;
      runtime.battleState.prebattleIntroDone = true;
      runtime.battleState.openingPassiveVisual = null;
      runtime.battleState.openingPassiveVisualQueue = [];
      runtime.battleState.visualEvent = null;
      runtime.battleState.animating = false;
      runtime.battleState.roundResolved = false;
      runtime.battleState.waitingResume = false;
    }
    const overlay = document.getElementById("battlePageOverlay");
    overlay?.classList.add("open", "ready");
    overlay?.classList.remove("transitioning", "closing");
    debug.notifyBattleWindow();
  });
  const battle = await waitForFrame(page, (url) => url.includes("board_battle.html"));
  await battle.waitForFunction(() => window.__BOARD_BATTLE_DEBUG__ && document.querySelectorAll(".battle-action-grid .action-button").length === 4, null, { timeout: 25000 });
  await host.evaluate(() => window.__BOARD_GAME_DEBUG__.notifyBattleWindow());
  await battle.waitForFunction(() => document.querySelector(".action-panel")?.getBoundingClientRect().width > 0, null, { timeout: 10000 });
  await page.waitForTimeout(500);
  return battle;
}

async function inspectBattle(page, host, battle, screenshotName) {
  const hostViewport = await host.evaluate(() => [window.innerWidth, window.innerHeight]);
  const view = await battle.evaluate(() => {
    const rect = (element) => {
      const box = element?.getBoundingClientRect();
      return box ? {
        x: Number(box.x.toFixed(3)),
        y: Number(box.y.toFixed(3)),
        width: Number(box.width.toFixed(3)),
        height: Number(box.height.toFixed(3)),
      } : null;
    };
    return {
      viewport: [window.innerWidth, window.innerHeight],
      visualViewport: [window.visualViewport?.width || 0, window.visualViewport?.height || 0],
      compactWidthMedia: matchMedia("(max-width: 1100px)").matches,
      compactHeightMedia: matchMedia("(max-height: 620px)").matches,
      fitted: document.getElementById("battleViewport")?.classList.contains("battle-viewport-fitted") || false,
      actionPanel: rect(document.querySelector(".action-panel")),
      actionGrid: rect(document.querySelector(".battle-action-grid")),
      buttons: Array.from(document.querySelectorAll(".battle-action-grid .action-button")).map((button) => ({
        mode: button.dataset.mode,
        label: button.querySelector(".action-label")?.textContent?.trim() || "",
        box: rect(button),
        fontSize: getComputedStyle(button.querySelector(".action-label")).fontSize,
      })),
      brokenImages: Array.from(document.images)
        .filter((image) => String(image.getAttribute("src") || "").trim() && image.complete && !image.naturalWidth)
        .map((image) => image.src),
    };
  });
  await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName) });
  await battle.locator('.battle-action-grid .action-button[data-mode="attack"]').click({ timeout: 5000 });
  await battle.waitForFunction(() => document.querySelector(".battle-command-choice")?.getBoundingClientRect().width > 0, null, { timeout: 5000 });
  const attackSelection = await battle.evaluate(() => {
    const rect = (element) => {
      const box = element?.getBoundingClientRect();
      return box ? {
        x: Number(box.x.toFixed(3)),
        y: Number(box.y.toFixed(3)),
        width: Number(box.width.toFixed(3)),
        height: Number(box.height.toFixed(3)),
      } : null;
    };
    return {
      title: document.getElementById("infoTitle")?.textContent?.trim() || "",
      body: rect(document.querySelector(".battle-command-body")),
      choices: Array.from(document.querySelectorAll(".battle-command-choice")).map((button) => ({
        label: button.querySelector(".battle-command-choice-name")?.textContent?.trim() || button.textContent.trim(),
        box: rect(button),
        fontSize: getComputedStyle(button.querySelector(".battle-command-choice-name") || button).fontSize,
      })),
    };
  });
  await host.evaluate(() => {
    const overlay = document.getElementById("battlePageOverlay");
    overlay?.classList.add("open", "ready");
    overlay?.classList.remove("transitioning", "closing");
    document.body.classList.remove("battle-map-shake");
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: path.join(OUTPUT_DIR, screenshotName.replace(/\.png$/, "_attack.png")) });
  return { hostViewport, view, attackSelection };
}

function sameRect(a, b, tolerance = 0.2) {
  return a && b && ["x", "y", "width", "height"].every((key) => Math.abs(a[key] - b[key]) <= tolerance);
}

async function inspectFormalChildPages(page, host) {
  const targets = [
    "board_impel_down.html",
    "board_marineford.html",
    "board_water_seven.html",
    "board_york_clue_puzzle_formal_demo.html",
  ];
  const results = {};
  for (const target of targets) {
    const frameId = `desktopParity${target.replace(/\W/g, "")}`;
    await host.evaluate(({ id, src }) => {
      const iframe = document.createElement("iframe");
      iframe.id = id;
      iframe.src = src;
      iframe.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483646";
      document.body.appendChild(iframe);
    }, { id: frameId, src: target });
    const child = await waitForFrame(page, (url) => url.includes(target));
    await child.waitForFunction(() => document.readyState === "complete", null, { timeout: 15000 });
    results[target] = await child.evaluate(() => ({
      viewport: [window.innerWidth, window.innerHeight],
      visualViewport: [window.visualViewport?.width || 0, window.visualViewport?.height || 0],
      compact1180: matchMedia("(max-width: 1180px)").matches,
      compact1120: matchMedia("(max-width: 1120px)").matches,
      compact980: matchMedia("(max-width: 980px)").matches,
    }));
    await host.evaluate((id) => document.getElementById(id)?.remove(), frameId);
    await page.waitForTimeout(80);
  }
  return results;
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  const errors = [];
  const failures = [];

  const desktopContext = await browser.newContext({ viewport: { width: 1920, height: 900 }, deviceScaleFactor: 1 });
  const desktopPage = await desktopContext.newPage();
  captureErrors(desktopPage, errors, "desktop");
  const desktopHost = await loadHost(desktopPage, false);
  const desktopBattle = await openStandardBattle(desktopPage, desktopHost);
  const desktop = await inspectBattle(desktopPage, desktopHost, desktopBattle, "battle_desktop_1920x900.png");

  const tabletContext = await browser.newContext({
    viewport: { width: 1024, height: 768 },
    screen: { width: 1024, height: 768 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
    userAgent: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
  });
  const tabletPage = await tabletContext.newPage();
  captureErrors(tabletPage, errors, "tablet");
  const tabletHost = await loadHost(tabletPage, true);
  const tabletBattle = await openStandardBattle(tabletPage, tabletHost);
  const tablet = await inspectBattle(tabletPage, tabletHost, tabletBattle, "battle_tablet_1024x768.png");
  const tabletFormalPages = await inspectFormalChildPages(tabletPage, tabletHost);

  if (desktop.hostViewport[0] !== 1920 || desktop.hostViewport[1] !== 900) failures.push("desktop host viewport mismatch");
  if (tablet.hostViewport[0] !== 1920 || tablet.hostViewport[1] !== 900) failures.push("tablet host viewport is not the desktop viewport");
  for (const [label, result] of [["desktop", desktop], ["tablet", tablet]]) {
    if (result.view.viewport[0] !== 1920 || result.view.viewport[1] !== 900) failures.push(`${label} battle viewport mismatch`);
    if (result.view.compactWidthMedia || result.view.compactHeightMedia || result.view.fitted) failures.push(`${label} battle entered compact layout`);
    if (result.view.buttons.length !== 4 || result.view.brokenImages.length) failures.push(`${label} battle controls or images invalid`);
  }
  if (!sameRect(desktop.view.actionPanel, tablet.view.actionPanel)
    || !sameRect(desktop.view.actionGrid, tablet.view.actionGrid)
    || desktop.view.buttons.some((button, index) => !sameRect(button.box, tablet.view.buttons[index]?.box)
      || button.label !== tablet.view.buttons[index]?.label
      || button.fontSize !== tablet.view.buttons[index]?.fontSize)) {
    failures.push("tablet battle buttons do not exactly match desktop geometry");
  }
  if (desktop.attackSelection.title !== tablet.attackSelection.title
    || !sameRect(desktop.attackSelection.body, tablet.attackSelection.body)
    || desktop.attackSelection.choices.length !== tablet.attackSelection.choices.length
    || desktop.attackSelection.choices.some((choice, index) => !sameRect(choice.box, tablet.attackSelection.choices[index]?.box)
      || choice.label !== tablet.attackSelection.choices[index]?.label
      || choice.fontSize !== tablet.attackSelection.choices[index]?.fontSize)) {
    failures.push("tablet move-selection buttons do not exactly match desktop geometry");
  }
  Object.entries(tabletFormalPages).forEach(([target, result]) => {
    if (result.viewport[0] !== 1920 || result.viewport[1] !== 900
      || result.compact1180 || result.compact1120 || result.compact980) {
      failures.push(`${target} did not receive the desktop viewport`);
    }
  });

  const report = { desktop, tablet, tabletFormalPages, errors, failures, outputDir: OUTPUT_DIR };
  fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  await desktopContext.close();
  await tabletContext.close();
  await browser.close();
  if (errors.length || failures.length) process.exitCode = 1;
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
