const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const DESKTOP_USER_AGENT = process.env.BOARD_QA_DESKTOP_USER_AGENT;
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-island-intros-20261004/browser-qa";
const PUBLIC_DIR = path.resolve(__dirname, "../public");

const CASES = [
  { key: "shop", kind: "shop", service: ".shop-shell", speakers: ["店主", "娜美", "店主"], islandPortrait: "island_intro_shopkeeper.webp" },
  { key: "hospital", kind: "hospital", service: ".hospital-ui", speakers: ["喬巴", "娜美", "喬巴"] },
  { key: "tavern", kind: "tavern", service: ".tavern-game-shell", speakers: ["瑪姬", "魯夫", "瑪姬"], islandPortrait: "tavern_owner_makino.webp" },
  { key: "mission", kind: "mission", service: ".mission-shell", speakers: ["摩爾岡斯", "羅賓", "摩爾岡斯"], islandPortrait: "morgans_open.webp" },
  { key: "research_lab", kind: "hospital", service: ".research-lab-ui", postgame: true, speakers: ["莉莉絲", "喬巴", "莉莉絲"] },
  { key: "arena", kind: "tavern", service: ".arena-ui", postgame: true, speakers: ["索隆", "娜美", "索隆"] },
  { key: "water_seven", islandId: "island-24", service: "#waterSevenPageOverlay.open", speakers: ["保利", "魯夫", "保利"], islandPortrait: "paulie.webp" },
  { key: "judicial", islandId: "island-25", service: ".judicial-raid-ui", speakers: ["斯潘達姆", "魯夫", "斯潘達姆"], islandPortrait: "island_intro_spandam.webp" },
  { key: "impel_down", islandId: "island-26", service: ".impel-entry-rescue-ui", speakers: ["麥哲倫", "魯夫", "麥哲倫"], islandPortrait: "island_intro_magellan.webp" },
  { key: "marineford", islandId: "island-19", service: "#enterMarinefordIslandBtn", speakers: ["青雉", "魯夫", "青雉"], islandPortrait: "aokiji_capture_serious_v3.webp" },
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
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    ...(DESKTOP_USER_AGENT ? { userAgent: DESKTOP_USER_AGENT } : {}),
  });
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
    const speakers = beats.map((beat) => beat.speaker);
    if (JSON.stringify(speakers) !== JSON.stringify(entry.speakers)) {
      failures.push(`${entry.key}: expected island conversation ${entry.speakers.join(" -> ")}; got ${speakers.join(" -> ")}`);
    }
    if (entry.islandPortrait && [beats[0], beats[beats.length - 1]].some((beat) =>
      !String(beat?.speakerImage || "").endsWith(entry.islandPortrait))) {
      failures.push(`${entry.key}: island character missing dedicated portrait`);
    }
    const requiredPortrait = {
      tavern: "luffy_pre_timeskip_tavern_invite.webp",
      water_seven: "luffy_pre_timeskip_enies.webp",
      judicial: "luffy_pre_timeskip_enies.webp",
      impel_down: "luffy_pre_timeskip_war.webp",
      marineford: "luffy_pre_timeskip_war.webp",
    }[entry.key];
    if (requiredPortrait && !beats.some((beat) => String(beat.speakerImage || "").endsWith(requiredPortrait))) {
      failures.push(`${entry.key}: wrong-era portrait in story definition`);
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
    if (entry.overrideName) island.name = entry.overrideName;
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
  const label = `${entry.key}${entry.variant ? `-${entry.variant}` : ""}${useServiceAction ? "-service-return" : ""}${finishNormally ? "-complete" : ""}${viewport ? "-narrow" : ""}`;
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
      const speaker = document.querySelector(".final-ending-speaker");
      const dialogue = document.querySelector(".final-ending-dialogue");
      const rect = dialogue?.getBoundingClientRect();
      return {
        title: document.querySelector(".final-ending-screen")?.textContent?.trim().slice(0, 120) || "",
        speaker: speaker?.textContent?.trim() || "",
        text: lines?.textContent?.trim() || "",
        background: screen ? getComputedStyle(screen).getPropertyValue("--ending-bg") : "",
        portraitReady: Boolean(portrait?.complete && portrait.naturalWidth > 0 && portrait.getBoundingClientRect().width > 100),
        portraitSrc: portrait?.getAttribute("src") || "",
        dialogueInside: Boolean(rect && rect.left >= -1 && rect.top >= -1 && rect.right <= innerWidth + 1 && rect.bottom <= innerHeight + 1),
        overflow: document.documentElement.scrollWidth > innerWidth + 2 || document.documentElement.scrollHeight > innerHeight + 2,
      };
    });
    if (!story.background.includes(`${entry.expectedBg || entry.key}.webp`) || story.text.includes("{{island}}")
      || story.speaker !== entry.speakers[0] || !story.text || !story.portraitReady
      || (entry.islandPortrait && !story.portraitSrc.endsWith(entry.islandPortrait))
      || !story.dialogueInside || story.overflow) {
      failures.push(`${label}: invalid cinematic presentation: ${JSON.stringify(story)}`);
    }
    if (entry.overrideName && !story.text.includes(entry.overrideName)) {
      failures.push(`${label}: story omitted actual island name: ${story.text}`);
    }
    if (entry.variant === "named-mission-wall" && story.text.includes("任務牆的任務牆")) {
      failures.push(`${label}: island name repeated service label: ${story.text}`);
    }
    if (entry.variant === "named-tavern" && story.text.includes("酒館港的酒館")) {
      failures.push(`${label}: island name repeated service label: ${story.text}`);
    }
    if (entry.variant === "zou" && (!story.text.includes("象主背上市集") || /碼頭|港口/.test(story.text))) {
      failures.push(`${label}: elephant-back market copy is inconsistent: ${story.text}`);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-story.png`) });
    for (let index = 1; index < entry.speakers.length; index += 1) {
      await page.locator("#finalEndingNextBtn").click();
      await page.waitForFunction((speakerName) => {
        const portrait = document.querySelector(".final-ending-speaker-portrait img");
        return document.querySelector(".final-ending-speaker")?.textContent?.trim() === speakerName
          && portrait?.complete && portrait.naturalWidth > 0 && portrait.getBoundingClientRect().width > 100
          && !document.getElementById("finalEndingNextBtn")?.disabled;
      }, entry.speakers[index], { timeout: 10000 });
      await page.waitForTimeout(120);
      const beat = await page.evaluate(() => ({
        speaker: document.querySelector(".final-ending-speaker")?.textContent?.trim() || "",
        text: document.querySelector(".final-ending-lines")?.textContent?.trim() || "",
        portraitSrc: document.querySelector(".final-ending-speaker-portrait img")?.getAttribute("src") || "",
      }));
      if (beat.speaker !== entry.speakers[index] || !beat.text || !beat.portraitSrc
        || (index === entry.speakers.length - 1 && entry.islandPortrait && !beat.portraitSrc.endsWith(entry.islandPortrait))) {
        failures.push(`${label}: beat ${index + 1} missing speaker or portrait: ${JSON.stringify(beat)}`);
      }
      await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}-beat-${index + 1}.png`) });
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
    await page.waitForTimeout(5000);
    const serviceVisuals = await page.evaluate((selector) => {
      const service = document.querySelector(selector);
      const root = service?.closest(".board-modal") || service;
      return Array.from(root?.querySelectorAll("img") || []).filter((img) => {
        const rect = img.getBoundingClientRect();
        const style = getComputedStyle(img);
        return !img.hidden && style.display !== "none" && style.visibility !== "hidden"
          && rect.width > 0 && rect.height > 0
          && rect.right > 0 && rect.bottom > 0 && rect.left < innerWidth && rect.top < innerHeight;
      }).map((img) => ({ src: img.currentSrc || img.src, ready: img.complete && img.naturalWidth > 0 }));
    }, entry.service);
    const pendingServiceImages = serviceVisuals.filter((img) => !img.ready);
    if (pendingServiceImages.length) {
      failures.push(`${label}: visible service images are not ready: ${JSON.stringify(pendingServiceImages.slice(0, 5))}`);
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
    runs.push(await runCase(browser, { ...CASES[0], variant: "zou", overrideName: "象主背上市集", expectedBg: "shop_zou_market" }, errors, failures));
    runs.push(await runCase(browser, { ...CASES[2], variant: "named-tavern", overrideName: "雙子酒館港" }, errors, failures));
    runs.push(await runCase(browser, { ...CASES[3], variant: "named-mission-wall", overrideName: "世界經濟新聞任務牆" }, errors, failures));
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
