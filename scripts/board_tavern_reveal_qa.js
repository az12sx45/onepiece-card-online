"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18928";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-tavern-reveal-20260928";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OVERLAY = ".tavern-reveal-overlay";
const SKIP = "[data-tavern-reveal-skip]";

// This fixture exposes existing closure functions only in the intercepted QA response.
const QA_ACCESS = `
  window.__tavernRevealQa = {
    prepare(crewCount = 3) {
      closeModal();
      devObserver.running = false;
      window.clearTimeout(devObserver.timer);
      window.clearTimeout(cpuAuto.timer);
      state.gameState.phase = "main";
      state.gameState.currentPlayerIndex = 0;
      state.gameState.pendingMove = null;
      state.gameState.routePrompt = null;
      state.gameState.islandDecision = null;
      state.gameState.resolutionLock = false;
      state.gameState.movementAnimating = false;
      state.battleState = null;
      state.boardUiEvent = null;
      const game = state.gameState;
      const candidate = window.BoardCards.cards.find((card) => card.id === "nami");
      if (!candidate) throw new Error("Nami is required for the recruitment fixture");
      const crewCards = window.BoardCards.cards.filter((card) => card.id !== candidate.id);
      game.players.forEach((entry, index) => {
        entry.isCPU = false;
        entry.isCpu = false;
        entry.cpu = false;
        entry.clientId = "qa-tavern-human-" + index;
        entry.pendingIslandServiceChoice = null;
        entry.pendingPostgameBossVoyage = null;
        entry.crew = [];
      });
      const player = currentPlayer();
      const island = game.boardData.islands.find((entry) => entry.kind === "tavern");
      if (!island) throw new Error("A real tavern island is required");
      player.crew = crewCards.slice(0, crewCount).map(cloneFreshDraftRecruit);
      player.activeCrewIndex = 0;
      player.coins = 20000;
      player.activeMissions = [];
      player.location = { kind: "island", islandId: island.id };
      game.availableCards = [cloneFreshDraftRecruit(candidate)];
      recalcPlayerDerivedStats(player);
      this.playerId = player.id;
      this.island = island;
      this.candidate = candidate;
      renderAll();
      return this.snapshot();
    },
    snapshot() {
      const player = state.gameState.players.find((entry) => entry.id === this.playerId);
      return {
        playerId: player.id,
        coins: player.coins,
        crewIds: player.crew.map((card) => card.id),
        poolIds: state.gameState.availableCards.map((card) => card.id),
        candidateId: this.candidate.id,
        rollCost: TAVERN_RECRUIT_ROLL_COST,
        currentPlayerIndex: state.gameState.currentPlayerIndex,
      };
    },
    openTavern() { openTavernModal(currentPlayer(), this.island); },
    openResult(options = {}) {
      const recruit = cloneFreshDraftRecruit(this.candidate);
      if (options.grade) recruit.tier = ({ S: "T1", A: "T2", B: "T3", C: "T4", D: "T5", E: "T6" })[options.grade];
      openRecruitResultModal(currentPlayer(), this.island, recruit, { chance: 1, tavernReveal: options.cinematic !== false });
    },
    openSpectator(options = {}) {
      spectatorTavernResultModal({
        islandName: this.island.name,
        playerName: "QA spectator",
        recruit: { ...spectatorCardData(cloneFreshDraftRecruit(this.candidate)), ...(options.missingImage ? { image: "/qa-tavern-missing-image.webp" } : {}) },
        chanceText: "100%",
        tavernReveal: true,
      });
    },
    close: closeModal,
    cpuHandle: devObserverHandleTavernModal,
  };
`;

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const report = { rootUrl: ROOT_URL, errors: [], resources: [], checks: [], colors: [], layouts: [], outcomes: [] };
  const check = (name, condition) => {
    assert(condition, name);
    report.checks.push(name);
    console.log(`PASS ${name}`);
  };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH });
  let page;
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Electron/44.0.0",
    });
    page = await context.newPage();
    page.on("pageerror", (error) => report.errors.push(error.message));
    page.on("response", (response) => { if (response.status() >= 400) report.resources.push({ status: response.status(), url: response.url() }); });
    await context.addInitScript(() => {
      window.__qaTavernDecodeErrors = [];
      const decode = HTMLImageElement.prototype.decode;
      HTMLImageElement.prototype.decode = function (...args) {
        return decode.apply(this, args).catch((error) => {
          window.__qaTavernDecodeErrors.push({ src: this.src, error: error.message });
          throw error;
        });
      };
    });
    await page.route("**/qa-tavern-missing-image.webp", (route) => route.fulfill({ status: 404, body: "QA missing image" }));
    await page.route("**/js/board_game.js*", async (route) => {
      const response = await route.fetch();
      const source = await response.text();
      const marker = "  window.__BOARD_GAME_DEBUG__ = {";
      assert(source.includes(marker), "Production debug access marker exists");
      await route.fulfill({ response, body: source.replace(marker, QA_ACCESS + marker) });
    });
    await page.goto(`${ROOT_URL}/board_game.html?skipOpeningStory=1&tavern_reveal_qa=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__tavernRevealQa && window.BoardTavernReveal && window.__BOARD_GAME_DEBUG__?.getState?.().gameState, null, { timeout: 30000 });

    async function prepare(crewCount = 3) {
      await page.evaluate((count) => window.__tavernRevealQa.prepare(count), crewCount);
      await page.waitForFunction(() => !document.querySelector(".tavern-reveal-overlay"));
      return page.evaluate(() => window.__tavernRevealQa.snapshot());
    }
    async function result(options = {}) {
      await page.evaluate((entry) => window.__tavernRevealQa.openResult(entry), options);
      await page.locator(OVERLAY).waitFor({ state: "visible" });
    }
    async function skip() {
      await page.locator(SKIP).click();
      await page.locator(OVERLAY).waitFor({ state: "detached" });
    }
    async function snapshot() {
      return page.evaluate(() => window.__tavernRevealQa.snapshot());
    }
    async function frame() {
      return page.evaluate(() => {
        const overlay = document.querySelector(".tavern-reveal-overlay");
        const skipButton = overlay?.querySelector("[data-tavern-reveal-skip]");
        const box = overlay?.getBoundingClientRect();
        const buttonBox = skipButton?.getBoundingClientRect();
        const style = overlay && getComputedStyle(overlay);
        const images = [...(overlay?.querySelectorAll("img") || [])].map((image) => ({
          source: image.getAttribute("src"), loaded: image.complete && image.naturalWidth > 0,
        }));
        return {
          stage: overlay?.dataset.stage,
          grade: overlay?.dataset.grade,
          color: style?.getPropertyValue("--tavern-reveal-color").trim() || "",
          width: innerWidth, height: innerHeight,
          cover: Boolean(box && box.left <= 1 && box.top <= 1 && box.right >= innerWidth - 1 && box.bottom >= innerHeight - 1),
          skipVisible: Boolean(buttonBox && buttonBox.width >= 30 && buttonBox.height >= 30 && buttonBox.left >= 0 && buttonBox.right <= innerWidth + 1 && buttonBox.top >= 0 && buttonBox.bottom <= innerHeight + 1),
          skipTextFits: Boolean(skipButton && skipButton.scrollWidth <= skipButton.clientWidth + 2),
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          images,
        };
      });
    }

    if (process.env.BOARD_QA_LANDSCAPE_ONLY === "1") {
      await page.setViewportSize({ width: 932, height: 430 });
      await prepare();
      await result({ grade: "A" });
      async function inspectArt(selector) {
        return page.evaluate(async (target) => {
          const image = document.querySelector(target);
          await image.decode();
          let alphaImage = image;
          if (image.dataset.portraitMask) {
            alphaImage = new Image();
            alphaImage.crossOrigin = "anonymous";
            alphaImage.src = image.dataset.portraitMask;
            await alphaImage.decode();
          }
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 128;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(alphaImage, 0, 0, 128, 128);
          const pixels = context.getImageData(0, 0, 128, 128).data;
          let minX = 128, minY = 128, maxX = -1, maxY = -1;
          for (let y = 0; y < 128; y += 1) for (let x = 0; x < 128; x += 1) {
            if (pixels[(y * 128 + x) * 4 + 3] < 32) continue;
            minX = Math.min(minX, x); minY = Math.min(minY, y);
            maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
          }
          const box = image.getBoundingClientRect();
          const fitWidth = Math.min(box.width, box.height * image.naturalWidth / image.naturalHeight);
          const fitHeight = Math.min(box.height, box.width * image.naturalHeight / image.naturalWidth);
          const bottomAligned = getComputedStyle(image).objectPosition.endsWith("100%");
          const left = box.left + (box.width - fitWidth) / 2;
          const top = box.top + (box.height - fitHeight) * (bottomAligned ? 1 : 0.5);
          const painted = { left: left + minX / 128 * fitWidth, right: left + (maxX + 1) / 128 * fitWidth, top: top + minY / 128 * fitHeight, bottom: top + (maxY + 1) / 128 * fitHeight };
          const caption = document.querySelector(".tavern-reveal-caption");
          const captionBox = caption?.getBoundingClientRect();
          return { stage: document.querySelector(".tavern-reveal-overlay")?.dataset.stage, painted, captionTop: captionBox?.top, opacity: Number(getComputedStyle(image).opacity), fullArtVisible: painted.left >= -1 && painted.right <= innerWidth + 1 && painted.top >= -1 && painted.bottom <= innerHeight + 1 };
        }, selector);
      }
      await page.waitForFunction(() => Number(getComputedStyle(document.querySelector(".tavern-reveal-luffy")).opacity) > 0.98);
      const invitation = await inspectArt(".tavern-reveal-luffy");
      report.landscapeInvitation = invitation;
      check("landscape invitation keeps Luffy's entire head visible", invitation.painted.top >= 0 && invitation.painted.left >= 0 && invitation.painted.right <= 932 && invitation.opacity > 0.95);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "landscape-invitation.png"), timeout: 5000 });
      await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "silhouette");
      await page.waitForTimeout(850);
      const silhouette = await inspectArt(".tavern-reveal-character");
      report.landscapeSilhouette = silhouette;
      check("landscape silhouette keeps the complete head visible", silhouette.fullArtVisible);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "landscape-silhouette.png"), timeout: 5000 });
      await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "reveal");
      await page.waitForTimeout(1000);
      const reveal = await inspectArt(".tavern-reveal-character");
      report.landscapeReveal = reveal;
      check("landscape reveal keeps complete character art visible", reveal.fullArtVisible);
      check("landscape reveal leaves caption separate from character", reveal.painted.bottom < reveal.captionTop - 2);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "landscape-reveal.png"), timeout: 5000 });
      await skip();
      check("landscape animation returns usable result controls", await page.locator("#acceptRecruitBtn").isEnabled());
      check("landscape has no browser runtime errors", report.errors.length === 0);
      return;
    }

    await prepare();
    await page.evaluate(() => {
      window.__qaTavernStages = [];
      window.__qaTavernStageObserver = new MutationObserver(() => {
        const stage = document.querySelector(".tavern-reveal-overlay")?.dataset.stage;
        if (stage && window.__qaTavernStages.at(-1) !== stage) window.__qaTavernStages.push(stage);
      });
      window.__qaTavernStageObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["data-stage"] });
    });
    const started = Date.now();
    await result({ grade: "S" });
    check("result remains present while animation blocks actions", await page.evaluate(() => Boolean(document.querySelector('.tavern-result-ui[data-tavern-reveal="v1"]') && document.getElementById("acceptRecruitBtn")?.disabled)));
    const untouched = await snapshot();
    for (const key of ["b", "k", "Home"]) await page.keyboard.press(key);
    check("B, K, and Home cannot escape the animation into game actions", await page.locator(OVERLAY).count() === 1 && await page.locator("dialog[open]").count() === 0 && JSON.stringify(await snapshot()) === JSON.stringify(untouched));
    const cpuAction = await page.evaluate(() => window.__tavernRevealQa.cpuHandle());
    check("CPU does not accept through the animation", !cpuAction && JSON.stringify(await snapshot()) === JSON.stringify(untouched));
    await page.evaluate(() => {
      document.getElementById("acceptRecruitBtn").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      window.BoardTavernReveal.scan();
      window.BoardTavernReveal.scan();
    });
    check("repeated scans and synthetic clicks cannot duplicate or accept", await page.locator(OVERLAY).count() === 1 && JSON.stringify(await snapshot()) === JSON.stringify(untouched));
    await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "silhouette", null, { timeout: 8000 });
    await page.waitForTimeout(750);
    report.silhouetteArt = await page.evaluate(async () => {
      const actor = document.querySelector(".tavern-reveal-character");
      const captain = document.querySelector(".tavern-reveal-luffy");
      const canvas = document.createElement("canvas");
      canvas.width = 64; canvas.height = 64;
      const context = canvas.getContext("2d", { willReadFrequently: true });
      context.drawImage(actor, 0, 0, 64, 64);
      if (actor.dataset.portraitMask) {
        const mask = new Image();
        mask.crossOrigin = "anonymous";
        mask.src = actor.dataset.portraitMask;
        await mask.decode();
        context.globalCompositeOperation = "destination-in";
        context.drawImage(mask, 0, 0, 64, 64);
      }
      const pixels = context.getImageData(0, 0, 64, 64).data;
      let transparent = 0;
      for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 245) transparent += 1;
      return { source: actor.src, mask: actor.dataset.portraitMask || "", computedMask: getComputedStyle(actor).maskImage, transparentFraction: transparent / 4096, captainOpacity: Number(getComputedStyle(captain).opacity) };
    });
    check("recruit silhouette uses character transparency, not an opaque rectangle", report.silhouetteArt.transparentFraction > 0.02 && (!report.silhouetteArt.mask || report.silhouetteArt.computedMask !== "none"));
    check("Luffy leaves the stage before the silhouette appears", report.silhouetteArt.captainOpacity < 0.05);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-silhouette.png"), timeout: 5000 });
    await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "reveal", null, { timeout: 5000 });
    await page.waitForTimeout(900);
    await page.screenshot({ path: path.join(OUTPUT_DIR, "desktop-reveal.png"), timeout: 5000 });
    await page.locator(OVERLAY).waitFor({ state: "detached", timeout: 12000 });
    const stages = await page.evaluate(() => { window.__qaTavernStageObserver.disconnect(); return window.__qaTavernStages; });
    report.stages = stages;
    report.automaticDurationMs = Date.now() - started;
    check("invitation, rarity light, silhouette, and reveal occur in order", JSON.stringify(stages) === JSON.stringify(["invitation", "glow", "silhouette", "reveal"]));
    check("automatic completion restores the same undecided result", await page.locator("#acceptRecruitBtn").isEnabled() && JSON.stringify(await snapshot()) === JSON.stringify(untouched));
    check("animation completes within 12 seconds", report.automaticDurationMs < 12000);

    for (const grade of ["S", "A", "B", "C", "D", "E"]) {
      await prepare();
      await result({ grade });
      const item = await frame();
      report.colors.push({ grade, color: item.color });
      check(`${grade} grade reaches the reveal`, await page.locator('.tavern-result-ui[data-tavern-reveal="v1"]').getAttribute("data-grade") === grade);
      await skip();
      check(`${grade} skip restores actions`, await page.locator("#acceptRecruitBtn").isEnabled());
    }
    check("all six grades have different light colors", report.colors.every((entry) => entry.color) && new Set(report.colors.map((entry) => entry.color)).size === 6);

    await prepare();
    await result();
    await page.keyboard.press("Escape");
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    check("Escape only skips and retains the result", await page.locator("#acceptRecruitBtn").isEnabled() && await page.locator("#rejectRecruitBtn").isVisible());
    await prepare();
    await result();
    const beforeSpace = await snapshot();
    await page.keyboard.press("Space");
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    check("Space activates focused skip without rolling or accepting", await page.locator("#acceptRecruitBtn").isEnabled() && JSON.stringify(await snapshot()) === JSON.stringify(beforeSpace));
    await prepare();
    await result();
    await page.evaluate(() => window.__tavernRevealQa.close());
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    check("closing the source modal removes the overlay", await page.locator(".tavern-result-ui").count() === 0);
    await prepare();
    await result();
    await page.evaluate(() => document.getElementById("boardModalBack").classList.remove("open"));
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    check("hiding the source modal removes the overlay", await page.locator(OVERLAY).count() === 0);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }]) {
      await page.setViewportSize(viewport);
      await prepare();
      await result({ grade: "A" });
      await page.waitForFunction(() => [...document.querySelectorAll(".tavern-reveal-overlay img")].every((image) => image.complete), null, { timeout: 8000 });
      const layout = await frame();
      report.layouts.push(layout);
      check(`overlay and skip fit ${viewport.width}x${viewport.height}`, layout.cover && layout.skipVisible && layout.skipTextFits && !layout.overflow);
      check(`art loads at ${viewport.width}x${viewport.height}`, layout.images.length > 0 && layout.images.every((image) => image.loaded));
      await page.waitForTimeout(750);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `invitation-${viewport.width}x${viewport.height}.png`), timeout: 5000 });
      await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay")?.dataset.stage === "reveal", null, { timeout: 8000 });
      await page.waitForTimeout(900);
      await page.screenshot({ path: path.join(OUTPUT_DIR, `reveal-${viewport.width}x${viewport.height}.png`), timeout: 5000 });
      await skip();
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    await prepare();
    await page.evaluate(() => window.__tavernRevealQa.openSpectator({ missingImage: true }));
    await page.waitForFunction(() => !document.querySelector(".tavern-reveal-overlay") && !document.getElementById("spectatorModalCloseBtn")?.disabled, null, { timeout: 5000 });
    check("missing character art does not trap spectator result", await page.locator("#spectatorModalCloseBtn").isEnabled());
    await prepare();
    await page.evaluate(() => window.__tavernRevealQa.openSpectator());
    await page.locator(OVERLAY).waitFor({ state: "visible" });
    await page.evaluate(() => {
      window.__qaReplacedTavernResult = document.querySelector(".tavern-result-ui");
      window.__qaReplacedTavernOverlay = document.querySelector(".tavern-reveal-overlay");
      window.__tavernRevealQa.openSpectator();
    });
    await page.waitForFunction(() => document.querySelector(".tavern-reveal-overlay") !== window.__qaReplacedTavernOverlay);
    check("replacing spectator result cleans previous overlay and controls", await page.evaluate(() => document.querySelectorAll(".tavern-reveal-overlay").length === 1 && !window.__qaReplacedTavernOverlay.isConnected && !window.__qaReplacedTavernResult.inert && !window.__qaReplacedTavernResult.querySelector("button").disabled));
    await skip();
    check("spectator result receives the same animation and keeps close action", await page.locator("#spectatorModalCloseBtn").isEnabled());
    await prepare();
    await page.evaluate(() => window.__tavernRevealQa.openResult({ cinematic: false }));
    await page.waitForTimeout(100);
    check("non-tavern shared result does not animate", await page.locator(OVERLAY).count() === 0 && await page.locator("#acceptRecruitBtn").isEnabled());

    await page.emulateMedia({ reducedMotion: "reduce" });
    await prepare();
    const reducedStart = Date.now();
    await page.evaluate(() => window.__tavernRevealQa.openResult());
    await page.waitForFunction(() => !document.querySelector(".tavern-reveal-overlay") && !document.getElementById("acceptRecruitBtn")?.disabled, null, { timeout: 3000 });
    check("reduced motion exposes the result promptly", Date.now() - reducedStart < 3000);
    await page.emulateMedia({ reducedMotion: "no-preference" });

    for (const outcome of ["accept", "reject", "replace"]) {
      const before = await prepare(outcome === "replace" ? 6 : 3);
      await page.evaluate(() => window.__tavernRevealQa.openTavern());
      await page.locator("#rollRecruitBtn").click();
      await page.locator(OVERLAY).waitFor({ state: "visible" });
      const rolled = await snapshot();
      check(`${outcome}: real draw charges exactly once`, before.coins - rolled.coins === before.rollCost);
      check(`${outcome}: animation leaves crew and candidate pool undecided`, JSON.stringify(before.crewIds) === JSON.stringify(rolled.crewIds) && JSON.stringify(before.poolIds) === JSON.stringify(rolled.poolIds));
      await skip();
      const selector = outcome === "accept" ? "#acceptRecruitBtn" : outcome === "reject" ? "#rejectRecruitBtn" : '[data-replace-crew="0"]';
      await page.locator(selector).click();
      const after = await snapshot();
      report.outcomes.push({ outcome, before, rolled, after });
      check(`${outcome}: deciding does not charge again`, after.coins === rolled.coins);
      if (outcome === "accept") check("accept adds only the selected recruit and removes it from the pool", after.crewIds.length === before.crewIds.length + 1 && after.crewIds.filter((id) => id === before.candidateId).length === 1 && !after.poolIds.includes(before.candidateId));
      if (outcome === "reject") check("reject preserves crew and returns no false acceptance", JSON.stringify(after.crewIds) === JSON.stringify(before.crewIds) && after.poolIds.includes(before.candidateId));
      if (outcome === "replace") check("full crew replacement keeps six and returns the replaced card to pool", after.crewIds.length === 6 && after.crewIds[0] === before.candidateId && after.poolIds.includes(before.crewIds[0]) && !after.poolIds.includes(before.candidateId));
    }
    check("no browser runtime errors", report.errors.length === 0);
  } catch (error) {
    report.failure = error.stack;
    if (page) {
      report.failureState = await page.evaluate(() => ({ stages: window.__qaTavernStages, decodeErrors: window.__qaTavernDecodeErrors, modalClass: document.getElementById("boardModal")?.className, backdropClass: document.getElementById("boardModalBack")?.className, modalText: document.getElementById("boardModal")?.textContent?.slice(0, 400), overlay: document.querySelector(".tavern-reveal-overlay")?.outerHTML?.slice(0, 2000) })).catch(() => null);
      await page.screenshot({ path: path.join(OUTPUT_DIR, "failure.png"), timeout: 5000 }).catch(() => {});
    }
    process.exitCode = 1;
  } finally {
    await browser.close();
    fs.writeFileSync(path.join(OUTPUT_DIR, "result.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
