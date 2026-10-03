const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-island-intros-20261004/browser-qa";
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const CASES = [
  { key: "shop", kind: "shop", service: ".shop-shell" },
  { key: "hospital", kind: "hospital", service: ".hospital-ui" },
  { key: "tavern", kind: "tavern", service: ".tavern-game-shell" },
  { key: "mission", kind: "mission", service: ".mission-shell" },
  { key: "research_lab", kind: "hospital", service: ".research-lab-ui", postgame: true },
  { key: "arena", kind: "tavern", service: ".arena-ui", postgame: true },
  { key: "water_seven", islandId: "island-24", service: "#waterSevenPageOverlay.open" },
  { key: "judicial", islandId: "island-25", service: ".judicial-raid-ui" },
  { key: "impel_down", islandId: "island-26", service: ".impel-entry-rescue-ui" },
  { key: "marineford", islandId: "island-19", service: "#enterMarinefordIslandBtn" },
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

async function openGame(browser, label, errors, viewport = { width: 1600, height: 900 }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  attachErrors(page, errors, label);
  await page.goto(`${ROOT_URL}/board_game.html?skipOpeningStory=1&feature_island_intro_qa=1`, {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => Boolean(
    window.__BOARD_GAME_DEBUG__?.getFeatureIslandStoryDefinitions
    && window.__BOARD_GAME_DEBUG__?.resolveLanding
    && window.__BOARD_GAME_DEBUG__?.normalizeLoadedGameState
  ), null, { timeout: 20000 });
  return { context, page };
}

async function checkDefinitions(page, failures) {
  const definitions = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getFeatureIslandStoryDefinitions());
  const keys = Object.keys(definitions || {}).sort();
  const expected = CASES.map((entry) => entry.key).sort();
  if (JSON.stringify(keys) !== JSON.stringify(expected)) {
    failures.push(`definitions: expected ${expected.join(",")}; got ${keys.join(",")}`);
  }
  const assets = [];
  for (const entry of CASES) {
    const definition = definitions[entry.key];
    if (!definition || !Array.isArray(definition.chapters) || !definition.chapters.length) {
      failures.push(`${entry.key}: missing story chapters`);
      continue;
    }
    const beats = definition.chapters.flatMap((chapter) => chapter.beats || []);
    if (beats.length < 3 || beats.length > 5 || beats.some((beat) => !beat.speaker || !beat.text)) {
      failures.push(`${entry.key}: expected 3-5 complete dialogue beats`);
    }
    const requiredLuffyPortrait = {
      judicial: "luffy_pre_timeskip_enies.webp",
      impel_down: "luffy_pre_timeskip_war.webp",
      marineford: "luffy_pre_timeskip_war.webp",
    }[entry.key];
    if (requiredLuffyPortrait && !beats.some((beat) => String(beat.speakerImage || "").endsWith(requiredLuffyPortrait))) {
      failures.push(`${entry.key}: wrong-era Luffy portrait in story definition`);
    }
    for (const beat of beats) {
      if (!beat.speakerImage) continue;
      const portraitPath = path.join(PUBLIC_DIR, beat.speakerImage);
      if (!fs.existsSync(portraitPath) || fs.statSync(portraitPath).size < 10000) {
        failures.push(`${entry.key}: missing speaker image ${beat.speakerImage}`);
        continue;
      }
      const decoded = await page.evaluate((src) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve(image.naturalWidth > 0 && image.naturalHeight > 0);
        image.onerror = () => resolve(false);
        image.src = new URL(src, location.href).href;
      }), beat.speakerImage);
      if (!decoded) failures.push(`${entry.key}: speaker image failed to decode ${beat.speakerImage}`);
    }
    for (const chapter of definition.chapters) {
      const bg = String(chapter.bg || "");
      const localPath = path.join(PUBLIC_DIR, bg);
      const exists = bg.startsWith("images/board/story/backgrounds/island_intro/")
        && bg.endsWith(".webp") && fs.existsSync(localPath);
      const bytes = exists ? fs.statSync(localPath).size : 0;
      if (!exists || bytes < 20000) failures.push(`${entry.key}: missing/empty background ${bg}`);
      const browserImage = await page.evaluate((src) => new Promise((resolve) => {
        const image = new Image();
        image.onload = () => resolve({ ok: true, width: image.naturalWidth, height: image.naturalHeight });
        image.onerror = () => resolve({ ok: false, width: 0, height: 0 });
        image.src = new URL(src, location.href).href;
      }), bg);
      if (!browserImage.ok || browserImage.width < 1200 || browserImage.height < 650) {
        failures.push(`${entry.key}: background did not decode at cinematic size`);
      }
      assets.push({ key: entry.key, path: bg, bytes, ...browserImage });
    }
  }
  return { keys, assets };
}

async function prepareLanding(page, entry, useServiceAction = false) {
  return page.evaluate(({ entry, useServiceAction }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    let player = game.players[0];
    delete player.featureIslandIntroSeen;
    debug.normalizeLoadedGameState({ source: "feature-island-qa" });
    player = game.players[0];
    const normalizedSeen = player.featureIslandIntroSeen;
    game.phase = "main";
    game.currentPlayerIndex = 0;
    game.turnIndex = 0;
    game.resolutionLock = false;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.pendingMove = null;
    game.routePrompt = null;
    game.islandDecision = null;
    state.battleState = null;
    player.isCPU = false;
    player.isCpu = false;
    player.cpu = false;
    player.pendingBattle = null;
    game.postgameWorld ||= {};
    game.postgameWorld.researchLabsActive = entry.postgame === true;
    const island = entry.islandId
      ? debug.getIslandById(entry.islandId)
      : game.boardData.islands.find((candidate) => candidate.kind === entry.kind && candidate.id !== "island-24");
    if (!island) throw new Error(`No ${entry.key} island in test map`);
    const islandState = debug.getIslandState(island.id);
    if (!islandState) throw new Error(`No state for ${island.id}`);
    player.location = { kind: "island", islandId: island.id, entryDirection: null };
    debug.mainMissionQa.normalize(player);
    const visitsBefore = Number(player.mainMission?.stats?.visit_island_kind || 0);
    if (useServiceAction) {
      debug.enterIslandService({ player, island, islandState, kind: entry.key, label: island.name });
    } else {
      debug.resolveLanding(player);
    }
    return {
      islandId: island.id,
      islandName: island.name,
      normalizedSeen,
      visitsBefore,
      visitsAtStory: Number(player.mainMission?.stats?.visit_island_kind || 0),
    };
  }, { entry, useServiceAction });
}

async function runCase(browser, entry, errors, failures, useServiceAction = false, finishNormally = false, viewport = null) {
  const label = `${entry.key}${useServiceAction ? "-service-return" : ""}${finishNormally ? "-complete" : ""}${viewport ? "-narrow" : ""}`;
  const { context, page } = await openGame(browser, label, errors, viewport || undefined);
  try {
    const before = await prepareLanding(page, entry, useServiceAction);
    if (!Array.isArray(before.normalizedSeen) || before.normalizedSeen.length) {
      failures.push(`${label}: old-save field did not normalize to an empty array`);
    }
    await page.waitForSelector(`.final-ending-screen.scene-feature-island-${entry.key}`);
    await page.waitForFunction(() => {
      const next = document.getElementById("finalEndingNextBtn");
      const portrait = document.querySelector(".final-ending-speaker-portrait img");
      return next && !next.disabled && (!portrait || (portrait.complete && portrait.naturalWidth > 0));
    }, null, { timeout: 10000 });
    await page.waitForTimeout(120);
    const story = await page.evaluate(() => {
      const screen = document.querySelector(".final-ending-screen");
      const portrait = document.querySelector(".final-ending-speaker-portrait img");
      const lines = document.querySelector(".final-ending-lines");
      const dialogue = document.querySelector(".final-ending-dialogue");
      const rect = dialogue?.getBoundingClientRect();
      return {
        title: document.querySelector(".final-ending-screen")?.textContent?.trim().slice(0, 120) || "",
        text: lines?.textContent?.trim() || "",
        background: screen ? getComputedStyle(screen).getPropertyValue("--ending-bg") : "",
        portraitReady: portrait ? portrait.complete && portrait.naturalWidth > 0 : true,
        dialogueInside: Boolean(rect && rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1),
        overflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
      };
    });
    if (!story.background.includes(`${entry.key}.webp`) || story.text.includes("{{island}}")
      || !story.text || !story.portraitReady || !story.dialogueInside || story.overflow) {
      failures.push(`${label}: invalid cinematic presentation: ${JSON.stringify(story)}`);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-story.png`) });
    if (["judicial", "impel_down", "marineford"].includes(entry.key)) {
      await page.locator("#finalEndingNextBtn").click();
      await page.waitForFunction(() => {
        const portrait = document.querySelector(".final-ending-speaker-portrait img");
        return document.querySelector(".final-ending-speaker")?.textContent?.trim() === "魯夫"
          && portrait?.complete && portrait.naturalWidth > 0
          && !document.getElementById("finalEndingNextBtn")?.disabled;
      }, null, { timeout: 10000 });
      await page.waitForTimeout(120);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-luffy.png`) });
    }
    if (finishNormally) {
      for (let step = 0; step < 12 && await page.locator(".final-ending-screen").count(); step += 1) {
        await page.waitForFunction(() => {
          const button = document.getElementById("finalEndingNextBtn");
          return button && !button.disabled;
        }, null, { timeout: 5000 });
        await page.locator("#finalEndingNextBtn").click();
      }
      if (await page.locator(".final-ending-screen").count()) failures.push(`${label}: story did not complete after dialogue`);
    } else {
      await page.locator("#finalEndingSkipBtn").click();
    }
    await page.waitForFunction((selector) => !document.querySelector(".final-ending-screen")
      && Boolean(document.querySelector(selector)), entry.service, { timeout: 15000 });
    const after = await page.evaluate((key) => {
      const player = window.__BOARD_GAME_DEBUG__.getState().gameState.players[0];
      return {
        seen: player.featureIslandIntroSeen,
        visits: Number(player.mainMission?.stats?.visit_island_kind || 0),
        storyVisible: Boolean(document.querySelector(".final-ending-screen")),
      };
    }, entry.key);
    if (!Array.isArray(after.seen) || !after.seen.includes(entry.key)) {
      failures.push(`${label}: completed story was not recorded for this kind`);
    }
    if (before.visitsAtStory !== before.visitsBefore + 1 || after.visits !== before.visitsAtStory) {
      failures.push(`${label}: visit mission event duplicated or missing: ${JSON.stringify({ before, after })}`);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-service.png`) });

    const repeat = await page.evaluate((entry) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const player = game.players[0];
      const alternate = entry.kind && game.boardData.islands.find((candidate) =>
        candidate.kind === entry.kind && candidate.id !== player.location.islandId && candidate.id !== "island-24");
      if (alternate) player.location = { kind: "island", islandId: alternate.id, entryDirection: null };
      game.resolutionLock = false;
      debug.resolveLanding(player);
      return {
        islandId: player.location.islandId,
        storyVisible: Boolean(document.querySelector(".final-ending-screen")),
        seen: player.featureIslandIntroSeen,
      };
    }, entry);
    if (repeat.storyVisible) failures.push(`${label}: same kind replayed on a later entry`);
    return { label, before, story, after, repeat };
  } finally {
    await context.close();
  }
}

async function runInterruptedRestoreCase(browser, errors, failures) {
  const label = "shop-interrupted-restore";
  const { context, page } = await openGame(browser, label, errors);
  try {
    const before = await prepareLanding(page, CASES[0]);
    await page.waitForSelector(".final-ending-screen.scene-feature-island-shop");
    await page.evaluate(() => {
      const payload = window.__BOARD_GAME_DEBUG__.createManualSavePayload();
      sessionStorage.setItem("featureIslandIntroQaSnapshot", JSON.stringify(payload));
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => Boolean(window.__BOARD_GAME_DEBUG__?.loadManualGame));
    const restored = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const payload = JSON.parse(sessionStorage.getItem("featureIslandIntroQaSnapshot"));
      const loaded = debug.loadManualGame(payload, { source: "lan", silent: true, initialLanRestore: true });
      const game = debug.getState().gameState;
      const player = game.players[0];
      const action = debug.currentIslandServiceAction(player);
      return {
        loaded,
        visit: Number(player.mainMission?.stats?.visit_island_kind || 0),
        turnStep: game.turnStep,
        storyVisible: Boolean(document.querySelector(".final-ending-screen")),
        serviceActionAvailable: Boolean(action),
      };
    });
    if (!restored.loaded || !restored.serviceActionAvailable || restored.visit !== before.visitsAtStory) {
      failures.push(`${label}: saved state could not restore or service became unavailable: ${JSON.stringify(restored)}`);
    }
    const reentry = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const player = game.players[0];
      const action = debug.currentIslandServiceAction(player);
      const entered = action ? debug.enterIslandService(action) : false;
      return {
        entered,
        visit: Number(player.mainMission?.stats?.visit_island_kind || 0),
        turnStep: game.turnStep,
        storyVisible: Boolean(document.querySelector(".final-ending-screen")),
        shopVisible: Boolean(document.querySelector(".shop-shell")),
      };
    });
    if (!reentry.entered || reentry.visit !== before.visitsAtStory) {
      failures.push(`${label}: reentry locked or visit mission event duplicated: ${JSON.stringify({ before, restored, reentry })}`);
    }
    if (reentry.storyVisible) {
      await page.waitForFunction(() => Boolean(document.getElementById("finalEndingSkipBtn")));
      await page.locator("#finalEndingSkipBtn").click();
    }
    await page.waitForFunction(() => Boolean(document.querySelector(".shop-shell")), null, { timeout: 10000 });
    const finished = await page.evaluate(() => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug.getState().gameState;
      const player = game.players[0];
      return {
        visit: Number(player.mainMission?.stats?.visit_island_kind || 0),
        turnStep: game.turnStep,
        seen: player.featureIslandIntroSeen,
        shopVisible: Boolean(document.querySelector(".shop-shell")),
      };
    });
    if (finished.visit !== before.visitsAtStory || /登島劇情$/.test(finished.turnStep)
      || !finished.seen?.includes("shop")) {
      failures.push(`${label}: interrupted story did not recover cleanly: ${JSON.stringify(finished)}`);
    }
    return { label, before, restored, reentry, finished };
  } finally {
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const errors = [];
  const failures = [];
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  try {
    const { context, page } = await openGame(browser, "definitions", errors);
    let definitions;
    try {
      definitions = await checkDefinitions(page, failures);
    } finally {
      await context.close();
    }
    const runs = [];
    for (const entry of CASES) runs.push(await runCase(browser, entry, errors, failures));
    runs.push(await runCase(browser, CASES[0], errors, failures, true));
    runs.push(await runCase(browser, CASES[1], errors, failures, false, true));
    for (const key of ["shop", "judicial", "marineford"]) {
      runs.push(await runCase(browser, CASES.find((entry) => entry.key === key), errors, failures,
        false, false, { width: 390, height: 844 }));
    }
    runs.push(await runInterruptedRestoreCase(browser, errors, failures));
    failures.push(...errors);
    const report = { ok: failures.length === 0, outputDir: OUTPUT_DIR, definitions, runs, errors, failures };
    fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ ok: report.ok, outputDir: OUTPUT_DIR, definitions: definitions.keys,
      runs: runs.map((run) => ({ label: run.label, islandId: run.before.islandId,
        visitsBefore: run.before.visitsBefore, visitsAtStory: run.before.visitsAtStory,
        visitsAfterSkip: (run.after || run.finished).visits ?? (run.after || run.finished).visit,
        seen: (run.after || run.finished).seen, replay: run.repeat?.storyVisible ?? run.reentry?.storyVisible })),
      errors, failures }, null, 2));
    if (failures.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
