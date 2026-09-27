"use strict";

const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18928";
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-tavern-crew-20260928";
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const HOSTS = (process.env.BOARD_QA_HOSTS || "luffy,zoro,nami,usopp,sanji,chopper,robin,franky,brook,jinbe").split(",").filter(Boolean);
const OVERLAY = ".tavern-reveal-overlay";
const SKIP = "[data-tavern-reveal-skip]";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Electron/44.0.0";

// Only intercepted QA responses expose fixture controls; shipped source is unchanged.
const ACCESS = `
  window.__tavernInvitationQa = {
    prepare(options = {}) {
      closeModal();
      devObserver.running = false;
      clearTimeout(devObserver.timer);
      clearTimeout(cpuAuto.timer);
      boardLan.enabled = false;
      boardLan.connected = false;
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
      const candidate = window.BoardCards.cards.find(card => card.id === "nami");
      const crewCards = window.BoardCards.cards.filter(card => card.id !== candidate.id);
      game.players.forEach((entry, index) => {
        entry.isCPU = entry.isCpu = entry.cpu = false;
        entry.clientId = "qa-tavern-human-" + index;
        entry.pendingIslandServiceChoice = null;
        entry.pendingPostgameBossVoyage = null;
        entry.crew = [];
      });
      const player = currentPlayer();
      const island = game.boardData.islands.find(entry => entry.kind === "tavern");
      player.crew = crewCards.slice(0, options.crewCount || 3).map(cloneFreshDraftRecruit);
      player.activeCrewIndex = 0;
      player.coins = 20000;
      player.activeMissions = [];
      player.location = { kind: "island", islandId: island.id };
      game.availableCards = [cloneFreshDraftRecruit(candidate)];
      recalcPlayerDerivedStats(player);
      this.playerId = player.id;
      this.originalPlayer = player;
      this.island = island;
      this.candidate = candidate;
      window.__qaFinishCount = 0;
      window.__qaHost = options.host || "luffy";
      window.__qaChooseCount = 0;
      renderAll();
      if (options.cpu) player.isCPU = true;
      return this.snapshot();
    },
    snapshot() {
      const player = state.gameState.players.find(entry => entry.id === this.playerId);
      return {
        coins: player.coins,
        crew: player.crew.map(card => card.id),
        originalCrew: this.originalPlayer.crew.map(card => card.id),
        pool: state.gameState.availableCards.map(card => card.id),
        candidate: this.candidate.id,
        rollCost: TAVERN_RECRUIT_ROLL_COST,
        turn: state.gameState.currentPlayerIndex,
        finished: window.__qaFinishCount,
        chooseCount: window.__qaChooseCount,
      };
    },
    openTavern() { openTavernModal(currentPlayer(), this.island); },
    openResult(options = {}) {
      const recruit = cloneFreshDraftRecruit(this.candidate);
      if (options.grade) recruit.tier = ({ S: "T1", A: "T2", B: "T3", C: "T4", D: "T5", E: "T6" })[options.grade];
      openRecruitResultModal(currentPlayer(), this.island, recruit, { chance: 1, tavernReveal: options.cinematic !== false });
    },
    spectator(outcome = "invite", host = "zoro") {
      spectatorTavernResultModal({ islandName: this.island.name, playerName: "QA spectator", recruit: spectatorCardData(cloneFreshDraftRecruit(this.candidate)), chanceText: "100%", tavernReveal: true, tavernHost: host, tavernOutcome: outcome });
    },
    invalidate(kind) {
      if (kind === "new-game") state.gameState = safeJsonClone(state.gameState);
      if (kind === "lost-control") { boardLan.enabled = true; boardLan.connected = false; }
      if (kind === "round") state.gameState.round += 1;
      if (kind === "new-modal") openModal('<h3 id="qaNewModal">QA replacement modal</h3>');
      if (kind === "close") closeModal();
    },
    cpuPolicy(strongCrew) {
      for (const card of currentPlayer().crew) {
        card.tier = strongCrew ? "T1" : "T6";
        card.baseStats = { hp: strongCrew ? 9999 : 1, atk: strongCrew ? 9999 : 1, def: strongCrew ? 9999 : 1, spd: strongCrew ? 9999 : 1 };
      }
    },
    close: closeModal,
    cpuHandle: devObserverHandleTavernModal,
  };
`;

async function main() {
  assert(["127.0.0.1", "localhost"].includes(new URL(ROOT_URL).hostname), "Controlled fixtures are local only");
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = { ok: false, rootUrl: ROOT_URL, scope: "Automated local Chromium with controlled fixture state and unmodified production decision handlers. Not human-play or physical-device acceptance.", hosts: HOSTS, checks: [], errors: [], resources: [], screenshots: [], outcomes: [] };
  const check = (name, value) => { assert(value, name); report.checks.push(name); console.log(`PASS ${name}`); };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("response", response => { if (response.status() >= 400) report.resources.push({ url: response.url(), status: response.status() }); });
    await page.route("**/js/board_game.js*", async route => {
      const response = await route.fetch();
      let source = await response.text();
      const marker = "  window.__BOARD_GAME_DEBUG__ = {";
      assert(source.includes(marker), "QA closure marker exists");
      assert(source.includes("function finishIslandServiceTurn() {"), "Original settlement marker exists");
      source = source.replace("function finishIslandServiceTurn() {", "function finishIslandServiceTurn() { window.__qaFinishCount = (window.__qaFinishCount || 0) + 1;");
      await route.fulfill({ response, body: source.replace(marker, ACCESS + marker) });
    });
    await page.route("**/js/board_tavern_crew.js*", async route => {
      const response = await route.fetch();
      const source = await response.text();
      assert(source.includes("function choose() {"), "Cosmetic random selector exists");
      await route.fulfill({ response, body: source.replace("function choose() {", "function choose() { window.__qaChooseCount = (window.__qaChooseCount || 0) + 1; if (window.__qaHost) return window.__qaHost;") });
    });
    await page.goto(`${ROOT_URL}/board_game.html?skipOpeningStory=1&tavern_invitation_qa=1`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__tavernInvitationQa && window.BoardTavernReveal?.version === "2" && window.BoardTavernCrew?.version === "2" && window.__BOARD_GAME_DEBUG__?.getState?.().gameState, null, { timeout: 30000 });

    const snapshot = () => page.evaluate(() => window.__tavernInvitationQa.snapshot());
    async function prepare(options = {}) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const value = await page.evaluate(arg => window.__tavernInvitationQa.prepare(arg), options);
      await page.locator(OVERLAY).waitFor({ state: "detached" });
      return value;
    }
    async function result(options = {}) {
      await page.evaluate(arg => window.__tavernInvitationQa.openResult(arg), options);
      await ready("invitation");
    }
    async function ready(stage) {
      await page.waitForFunction(value => {
        const node = document.querySelector(".tavern-reveal-overlay");
        return node?.dataset.stage === value && node.dataset.ready === "1";
      }, stage, { timeout: 12000 });
    }
    async function skip() { await page.locator(SKIP).click(); await page.locator(OVERLAY).waitFor({ state: "detached" }); }
    async function shot(name) {
      const output = path.join(OUTPUT, `${name}.png`);
      await page.screenshot({ path: output, timeout: 5000 });
      report.screenshots.push(output);
      console.log(`SCREENSHOT ${output}`);
    }
    async function reaction(outcome, host) {
      await ready(outcome);
      const values = await page.evaluate(() => {
        const overlay = document.querySelector(".tavern-reveal-overlay");
        const image = overlay.querySelector(".tavern-reveal-host");
        return { host: overlay.dataset.host, stage: overlay.dataset.stage, motion: overlay.dataset.motion, image: image.getAttribute("src"), loaded: image.complete && image.naturalWidth > 0, line: overlay.querySelector(".tavern-reveal-line").textContent };
      });
      const expected = await page.evaluate(({ id, phase }) => window.BoardTavernCrew.get(id)[phase], { id: host, phase: outcome });
      check(`${host} ${outcome} uses its matching art, line and motion`, values.host === host && values.loaded && values.image === expected.image && values.line === expected.line && values.motion === expected.motion);
    }
    async function settle() {
      await page.waitForFunction(() => window.__qaFinishCount === 1, null, { timeout: 7000 });
      await page.locator(OVERLAY).waitFor({ state: "detached" });
      return snapshot();
    }
    function recruited(before, after) { return after.crew.length === before.crew.length + 1 && after.crew.filter(id => id === after.candidate).length === 1 && !after.pool.includes(after.candidate) && after.finished === 1; }
    function unchanged(before, after) { return before.coins === after.coins && JSON.stringify(before.crew) === JSON.stringify(after.crew) && JSON.stringify(before.pool) === JSON.stringify(after.pool); }

    if (process.env.BOARD_QA_SUPPLEMENT_ONLY === "1") {
      const colors = { S: ["#ffe27a", "rgb(255, 226, 122)"], A: ["#dca4ff", "rgb(220, 164, 255)"], B: ["#9fc4ff", "rgb(159, 196, 255)"], C: ["#9fdaa9", "rgb(159, 218, 169)"], D: ["#cad2db", "rgb(202, 210, 219)"], E: ["#d7b786", "rgb(215, 183, 134)"] };
      report.palette = [];
      for (const [grade, expected] of Object.entries(colors)) {
        await prepare(); await result({ grade });
        const actual = await page.evaluate(() => {
          const node = document.querySelector(".tavern-reveal-overlay");
          return { grade: node.dataset.grade, token: getComputedStyle(node).getPropertyValue("--tavern-reveal-color").trim(), light: getComputedStyle(node.querySelector(".tavern-reveal-light")).backgroundColor };
        });
        check(`${grade} grade retains its exact computed rarity color`, actual.grade === grade && actual.token === expected[0] && actual.light === expected[1]);
        report.palette.push(actual);
        await skip();
      }
      await prepare(); await result({ grade: "A" });
      async function paintedPortrait() {
        return page.evaluate(async () => {
          const image = document.querySelector(".tavern-reveal-character");
          const style = getComputedStyle(image);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 128;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.filter = style.filter;
          context.drawImage(image, 0, 0, 128, 128);
          if (image.dataset.portraitMask) {
            const mask = new Image(); mask.crossOrigin = "anonymous"; mask.src = image.dataset.portraitMask; await mask.decode();
            context.filter = "none"; context.globalCompositeOperation = "destination-in";
            context.drawImage(mask, 0, 0, 128, 128);
          }
          const pixels = context.getImageData(0, 0, 128, 128).data;
          let transparent = 0, painted = 0, black = 0, colored = 0;
          for (let index = 0; index < pixels.length; index += 4) {
            if (pixels[index + 3] < 16) { transparent += 1; continue; }
            painted += 1;
            if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) < 12) black += 1;
            if (Math.max(pixels[index], pixels[index + 1], pixels[index + 2]) > 32) colored += 1;
          }
          return { mask: image.dataset.portraitMask, filter: style.filter, opacity: Number(style.opacity), transparentFraction: transparent / 16384, blackFraction: black / painted, coloredFraction: colored / painted };
        });
      }
      await ready("silhouette"); await page.waitForTimeout(850);
      report.silhouette = await paintedPortrait();
      check("real Nami silhouette uses approved alpha mask and black visible pixels", !!report.silhouette.mask && report.silhouette.transparentFraction > 0.2 && report.silhouette.transparentFraction < 0.9 && report.silhouette.blackFraction > 0.99 && report.silhouette.opacity > 0.98);
      await shot("real-nami-silhouette");
      await ready("reveal"); await page.waitForTimeout(1000);
      report.reveal = await paintedPortrait();
      check("revealed Nami retains alpha but restores non-black portrait pixels", report.reveal.mask === report.silhouette.mask && report.reveal.coloredFraction > 0.5 && report.reveal.opacity > 0.98);
      await shot("real-nami-reveal");
      await skip();
      check("rarity and portrait supplement has no browser runtime errors", report.errors.length === 0);
      report.ok = true;
      return;
    }

    const catalog = await page.evaluate(() => window.BoardTavernCrew.crew.map(host => ({ id: host.id, invite: host.invite.line, images: [host.invite.image, host.accept.image, host.decline.image] })));
    check("catalog contains exactly ten unique Straw Hat hosts", catalog.length === 10 && new Set(catalog.map(host => host.id)).size === 10);
    check("Luffy invitation is the exact requested line", catalog.find(host => host.id === "luffy").invite === "你真有趣，要不要加入我們？");
    const random = await page.evaluate(() => {
      window.__qaHost = "";
      const original = Math.random;
      Math.random = () => { throw new Error("Cosmetic choice consumed gameplay RNG"); };
      try { return Array.from({ length: 300 }, () => window.BoardTavernCrew.choose()); }
      finally { Math.random = original; }
    });
    check("cosmetic host RNG uses no Math.random and only valid hosts", random.every(id => catalog.some(host => host.id === id)) && new Set(random).size === 10);

    for (const host of HOSTS) {
      for (const outcome of ["accept", "decline"]) {
        const before = await prepare({ host });
        await result();
        check(`${host} invitation chooses host once`, (await snapshot()).chooseCount === 1 && await page.locator(OVERLAY).getAttribute("data-host") === host);
        if (outcome === "accept") { await page.waitForTimeout(900); await shot(`${host}-invitation-desktop`); }
        await skip();
        check(`${host} initial skip does not make a decision`, unchanged(before, await snapshot()) && (await snapshot()).finished === 0);
        await page.locator(outcome === "accept" ? "#acceptRecruitBtn" : "#rejectRecruitBtn").click();
        await reaction(outcome, host);
        check(`${host} ${outcome} holds original settlement until reaction completes`, unchanged(before, await snapshot()) && (await snapshot()).finished === 0);
        await page.waitForTimeout(900);
        await shot(`${host}-${outcome}-desktop`);
        await skip();
        const after = await settle();
        check(`${host} ${outcome} settles exactly once without reroll`, (outcome === "accept" ? recruited(before, after) : unchanged(before, after) && after.finished === 1) && after.chooseCount === 1);
        report.outcomes.push({ host, outcome, before, after });
      }
    }

    if (process.env.BOARD_QA_ART_ONLY === "1") {
      check("host art matrix has no browser runtime errors", report.errors.length === 0);
      report.ok = true;
      return;
    }

    for (const outcome of ["accept", "decline"]) {
      const before = await prepare({ host: "luffy" });
      await page.evaluate(() => window.__tavernInvitationQa.openTavern());
      await page.locator("#rollRecruitBtn").click();
      await ready("invitation");
      const paid = await snapshot();
      check(`real ${outcome} draw deducts exactly 2500 once`, paid.coins === before.coins - before.rollCost && paid.rollCost === 2500 && paid.crew.length === before.crew.length);
      await ready("choice");
      check(`real ${outcome} choice keeps result controls inert`, await page.locator("#acceptRecruitBtn").isDisabled() && await page.locator(".tavern-result-ui").evaluate(node => node.inert));
      await page.locator(`[data-tavern-choice="${outcome}"]`).click();
      await reaction(outcome, "luffy");
      const after = await settle();
      check(`real ${outcome} choice runs original settlement once`, (outcome === "accept" ? recruited(paid, after) : unchanged(paid, after) && after.finished === 1) && after.coins === paid.coins);
    }

    await prepare();
    await result();
    await ready("choice");
    const beforeKeyboard = await snapshot();
    for (const key of ["b", "k", "Home"]) await page.keyboard.press(key);
    check("B K Home cannot escape choice or mutate the game", unchanged(beforeKeyboard, await snapshot()) && await page.locator(OVERLAY).count() === 1);
    const focus = [];
    for (let index = 0; index < 4; index += 1) {
      focus.push(await page.evaluate(() => document.activeElement?.dataset.tavernChoice || (document.activeElement?.hasAttribute("data-tavern-reveal-skip") ? "skip" : "outside")));
      await page.keyboard.press("Tab");
    }
    check("choice Tab cycles accept, decline, skip inside dialog", focus.join(",") === "accept,decline,skip,accept");
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Space");
    await reaction("accept", "luffy");
    await page.keyboard.press("Escape");
    check("keyboard Space selects and Escape commits the selected reaction once", (await settle()).finished === 1);

    const doubleBefore = await prepare();
    await result();
    await page.evaluate(() => { window.BoardTavernReveal.scan(); window.BoardTavernReveal.scan(); });
    check("repeated scans keep exactly one overlay", await page.locator(OVERLAY).count() === 1);
    await skip();
    await page.evaluate(() => {
      const button = document.getElementById("acceptRecruitBtn");
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      document.getElementById("rejectRecruitBtn").dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await reaction("accept", "luffy");
    await page.evaluate(() => {
      const button = document.querySelector("[data-tavern-reveal-skip]");
      button.click(); button.click();
    });
    const doubleAfter = await settle();
    await page.waitForTimeout(2800);
    check("double click, conflicting click and double skip settle exactly once", recruited(doubleBefore, doubleAfter) && (await snapshot()).finished === 1);

    const fullBefore = await prepare({ crewCount: 6 });
    await result();
    await ready("choice");
    check("full-team primary requests a replacement", await page.locator('[data-tavern-choice="accept"]').textContent() === "選擇替換夥伴");
    await page.locator('[data-tavern-choice="accept"]').click();
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    check("opening replacement choices does not accept or settle", unchanged(fullBefore, await snapshot()) && (await snapshot()).finished === 0);
    await page.locator('[data-replace-crew="0"]').click();
    await reaction("accept", "luffy");
    await skip();
    const fullAfter = await settle();
    check("replacement uses original six-person crew and pool mutation", fullAfter.crew.length === 6 && fullAfter.crew[0] === fullAfter.candidate && fullAfter.pool.includes(fullBefore.crew[0]) && !fullAfter.pool.includes(fullAfter.candidate) && fullAfter.finished === 1);
    const rejectFull = await prepare({ crewCount: 6 });
    await result(); await skip();
    await page.locator("#rejectFullRecruitBtn").click();
    await reaction("decline", "luffy"); await skip();
    check("full-team rejection preserves crew and pool", unchanged(rejectFull, await settle()));

    for (const kind of ["new-game", "lost-control", "round", "new-modal", "close"]) {
      const before = await prepare();
      await result(); await skip();
      await page.locator("#acceptRecruitBtn").click();
      await reaction("accept", "luffy");
      await page.evaluate(value => window.__tavernInvitationQa.invalidate(value), kind);
      await page.locator(OVERLAY).waitFor({ state: "detached", timeout: 4000 });
      await page.waitForTimeout(2800);
      const after = await snapshot();
      check(`${kind} cancels delayed settlement, including old player closure`, unchanged(before, after) && after.finished === 0 && JSON.stringify(after.originalCrew) === JSON.stringify(before.originalCrew));
    }

    for (const stage of ["invitation", "choice"]) {
      for (const kind of ["lost-control", "round", "new-game"]) {
        const before = await prepare();
        await result();
        if (stage === "choice") await ready("choice");
        await page.evaluate(value => window.__tavernInvitationQa.invalidate(value), kind);
        await page.locator(OVERLAY).waitFor({ state: "detached", timeout: 1500 });
        const after = await snapshot();
        check(`${stage} ${kind} cancels before a decision and releases overlay`, unchanged(before, after) && after.finished === 0 && !(await page.locator(".tavern-result-ui").evaluate(node => node.inert)));
      }
    }

    for (const scenario of [{ label: "available slot", count: 3 }, { label: "strong full crew", count: 6, strong: true }, { label: "weak full crew", count: 6, strong: false }]) {
      const before = await prepare({ crewCount: scenario.count, cpu: true });
      if (scenario.count === 6) await page.evaluate(value => window.__tavernInvitationQa.cpuPolicy(value), scenario.strong);
      await result();
      await page.locator(OVERLAY).waitFor({ state: "detached", timeout: 11000 });
      check(`CPU ${scenario.label} leaves initial animation without input`, await page.locator(".tavern-result-ui").getAttribute("data-tavern-auto") === "1");
      const policy = await page.evaluate(() => window.__tavernInvitationQa.cpuHandle());
      await ready(scenario.strong ? "decline" : "accept");
      const after = await settle();
      check(`CPU ${scenario.label} completes existing decision policy`, after.finished === 1 && (scenario.count === 3 ? recruited(before, after) : scenario.strong ? !after.crew.includes(after.candidate) : after.crew.includes(after.candidate)));
      report.outcomes.push({ cpu: scenario.label, policy, after });
    }

    const reducedBefore = await prepare();
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.__tavernInvitationQa.openResult());
    await page.waitForTimeout(100);
    check("reduced motion leaves original result immediately available", await page.locator(OVERLAY).count() === 0 && await page.locator("#acceptRecruitBtn").isEnabled());
    await page.locator("#acceptRecruitBtn").click();
    check("reduced motion commits the chosen result without waiting", recruited(reducedBefore, await settle()));

    const missingBefore = await prepare();
    const missingPattern = "**/images/board/story/speakers/luffy_laugh.webp";
    await page.route(missingPattern, route => route.fulfill({ status: 404, body: "QA missing reaction art" }));
    await result(); await skip();
    await page.locator("#acceptRecruitBtn").click();
    check("missing reaction artwork fails open to valid settlement", recruited(missingBefore, await settle()));
    await page.unroute(missingPattern);

    const absentBefore = await prepare();
    await result(); await skip();
    await page.evaluate(() => { window.__qaSavedReveal = window.BoardTavernReveal; window.BoardTavernReveal = undefined; });
    await page.locator("#acceptRecruitBtn").click();
    check("missing helper still commits an explicitly chosen result", recruited(absentBefore, await settle()));
    await page.evaluate(() => { window.BoardTavernReveal = window.__qaSavedReveal; delete window.__qaSavedReveal; });

    const legacyBefore = await prepare();
    await page.evaluate(() => window.__tavernInvitationQa.openResult({ cinematic: false }));
    check("non-tavern shared recruitment has no animation", await page.locator(OVERLAY).count() === 0);
    await page.locator("#acceptRecruitBtn").click();
    check("non-tavern shared recruitment still settles immediately", recruited(legacyBefore, await settle()));

    const spectatorBefore = await prepare();
    for (const phase of ["invite", "accept", "decline"]) {
      await page.evaluate(value => window.__tavernInvitationQa.spectator(value, "zoro"), phase);
      await ready(phase === "invite" ? "invitation" : phase);
      check(`spectator ${phase} uses actor host with no choice controls`, await page.locator(OVERLAY).getAttribute("data-host") === "zoro" && await page.locator("[data-tavern-choice]").count() === 0);
    }
    await skip();
    check("spectator replacement and reaction skip never settle authority", unchanged(spectatorBefore, await snapshot()) && (await snapshot()).finished === 0);

    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 932, height: 430 }]) {
      await page.setViewportSize(viewport);
      await prepare(); await result();
      await page.waitForTimeout(900);
      await shot(`invitation-${viewport.width}x${viewport.height}`);
      await ready("choice");
      const layout = await page.evaluate(() => {
        const controls = [...document.querySelectorAll(".tavern-reveal-overlay button")].filter(node => node.getClientRects().length);
        const boxes = controls.map(node => { const box = node.getBoundingClientRect(); return { inside: box.left >= 0 && box.right <= innerWidth + 1 && box.top >= 0 && box.bottom <= innerHeight + 1, fits: node.scrollWidth <= node.clientWidth + 2 }; });
        return { controls: boxes, overflow: document.documentElement.scrollWidth > innerWidth + 2 };
      });
      check(`choice controls fit ${viewport.width}x${viewport.height}`, layout.controls.length === 3 && layout.controls.every(box => box.inside && box.fits) && !layout.overflow);
      await shot(`choice-${viewport.width}x${viewport.height}`);
      await page.locator('[data-tavern-choice="decline"]').click();
      await reaction("decline", "luffy");
      await page.waitForTimeout(900);
      await shot(`decline-${viewport.width}x${viewport.height}`);
      await skip(); await settle();
    }
    check("no browser runtime errors", report.errors.length === 0);
    report.ok = true;
  } catch (error) {
    report.failure = error.stack;
    if (page) {
      report.failureState = await page.evaluate(() => ({ overlay: document.querySelector(".tavern-reveal-overlay")?.outerHTML, state: window.__tavernInvitationQa?.snapshot() })).catch(() => null);
      await page.screenshot({ path: path.join(OUTPUT, "failure.png") }).catch(() => {});
    }
    throw error;
  } finally {
    fs.writeFileSync(path.join(OUTPUT, "result.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
