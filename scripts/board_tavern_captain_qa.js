"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const assert = require("node:assert/strict");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18929";
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-tavern-captain-20260928";
const CHROME = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36 Electron/44.0.0";
const OVERLAY = ".tavern-reveal-overlay";
const SKIP = "[data-tavern-reveal-skip]";
const ART = "images/board/tavern_recruit/crew_v3/";
const LOCAL_ART_DIR = path.resolve(__dirname, "../public", ART);
const LINES = Object.freeze({
  zoro: ["歡迎。先喝一杯吧。", "連魯夫都敢拒絕？哼，有膽識。"],
  nami: ["歡迎上船！航線交給我吧。", "魯夫竟然被拒絕了？好吧，祝你順風。"],
  usopp: ["歡迎！本大爺罩你，放心吧！", "欸！連魯夫都拒絕？你膽子真大！"],
  sanji: ["歡迎。你的那份晚餐，準備好了。", "連船長都留不住你？至少吃飽再走。"],
  chopper: ["哇，你加入了！我會好好照顧你的！", "欸，你真的拒絕了？別受傷喔！"],
  robin: ["歡迎。船上又多了一篇新故事。", "呵呵，讓魯夫被拒絕，真少見呢。"],
  franky: ["SUPER！歡迎登船！", "船長被拒絕啦！嗚，SUPER 可惜！"],
  brook: ["喲呵呵，歡迎！讓我為你奏一曲。", "心都碎了……啊，我沒有心臟。"],
  jinbe: ["歡迎上船。往後同舟共濟。", "婉拒船長，倒是有主見。一路順風。"],
});
const RESPONDERS = (process.env.BOARD_QA_RESPONDERS || Object.keys(LINES).join(","))
  .split(",").map(value => value.trim()).filter(Boolean);
assert(RESPONDERS.length > 0 && RESPONDERS.every(id => LINES[id]) &&
  new Set(RESPONDERS).size === RESPONDERS.length, "Valid unique QA responders required");
const OUTCOMES = (process.env.BOARD_QA_OUTCOMES || "accept,decline")
  .split(",").map(value => value.trim()).filter(Boolean);
assert(OUTCOMES.length > 0 && OUTCOMES.every(value => ["accept", "decline"].includes(value)) &&
  new Set(OUTCOMES).size === OUTCOMES.length, "Valid unique QA outcomes required");
const GRADES = Object.freeze({
  S: { color: "#f6dd8e", vfx: "S" },
  A: { color: "#f5cc65", vfx: "A" },
  B: { color: "#bd9bff", vfx: "B" },
  C: { color: "#8acfff", vfx: "C" },
  D: { color: "#a0dcae", vfx: "D" },
  E: { color: "#d3dbe0", vfx: "E" },
});

async function installPreReleaseArtFixture(page, report) {
  if (process.env.BOARD_QA_REAL_MEDIA === "1") return;
  report.preReleaseArtFixture = {
    scope: "Only the 18 new crew_v3 WebP files are served from this checkout; this does not verify desktop catalog or public CDN delivery.",
    assets: [],
  };
  for (const responder of Object.keys(LINES)) {
    for (const outcome of ["accept", "decline"]) {
      const name = responder + "_" + outcome + ".webp";
      const bytes = fs.readFileSync(path.join(LOCAL_ART_DIR, name));
      report.preReleaseArtFixture.assets.push({ name, size: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
  }
  await page.route("**/images/board/tavern_recruit/crew_v3/*.webp", route => {
    const name = new URL(route.request().url()).pathname.split("/").at(-1);
    if (!Object.keys(LINES).some(id => [id + "_accept.webp", id + "_decline.webp"].includes(name))) {
      return route.continue();
    }
    return route.fulfill({ status: 200, contentType: "image/webp",
      body: fs.readFileSync(path.join(LOCAL_ART_DIR, name)) });
  });
}

// This is injected into one intercepted browser response; production code is not edited.
const ACCESS = [
  "  window.__tavernCaptainQa = {",
  "    prepare(options = {}) {",
  "      closeModal();",
  "      devObserver.running = false;",
  "      clearTimeout(devObserver.timer);",
  "      clearTimeout(cpuAuto.timer);",
  "      boardLan.enabled = false;",
  "      boardLan.connected = false;",
  "      state.gameState.phase = 'main';",
  "      state.gameState.currentPlayerIndex = 0;",
  "      state.gameState.pendingMove = state.gameState.routePrompt = state.gameState.islandDecision = null;",
  "      state.gameState.resolutionLock = state.gameState.movementAnimating = false;",
  "      state.battleState = state.boardUiEvent = null;",
  "      const game = state.gameState;",
  "      const candidateId = options.candidateId || (options.responder === 'nami' ? 'zoro' : 'nami');",
  "      const candidate = window.BoardCards.cards.find(card => card.id === candidateId);",
  "      const crewCards = window.BoardCards.cards.filter(card => card.id !== candidate.id);",
  "      game.players.forEach((entry, index) => {",
  "        entry.isCPU = entry.isCpu = entry.cpu = false;",
  "        entry.clientId = 'qa-captain-human-' + index;",
  "        entry.pendingIslandServiceChoice = entry.pendingPostgameBossVoyage = null;",
  "        entry.crew = [];",
  "      });",
  "      const player = currentPlayer();",
  "      const island = game.boardData.islands.find(entry => entry.kind === 'tavern');",
  "      player.crew = crewCards.slice(0, options.crewCount || 3).map(cloneFreshDraftRecruit);",
  "      player.activeCrewIndex = 0;",
  "      player.coins = 20000;",
  "      player.activeMissions = [];",
  "      player.location = { kind: 'island', islandId: island.id };",
  "      game.availableCards = [cloneFreshDraftRecruit(candidate)];",
  "      recalcPlayerDerivedStats(player);",
  "      this.playerId = player.id;",
  "      this.originalPlayer = player;",
  "      this.island = island;",
  "      this.candidate = candidate;",
  "      window.__qaFinishCount = 0;",
  "      window.__qaResponseCount = 0;",
  "      window.__qaSpectatorEvents = [];",
  "      window.__qaResponder = options.responder || 'zoro';",
  "      renderAll();",
  "      if (options.cpu) player.isCPU = true;",
  "      return this.snapshot();",
  "    },",
  "    snapshot() {",
  "      const player = state.gameState.players.find(entry => entry.id === this.playerId);",
  "      return { coins: player.coins, crew: player.crew.map(card => card.id),",
  "        originalCrew: this.originalPlayer.crew.map(card => card.id),",
  "        pool: state.gameState.availableCards.map(card => card.id),",
  "        candidate: this.candidate.id, rollCost: TAVERN_RECRUIT_ROLL_COST,",
  "        turn: state.gameState.currentPlayerIndex, finished: window.__qaFinishCount,",
  "        responseCount: window.__qaResponseCount };",
  "    },",
  "    openTavern() { openTavernModal(currentPlayer(), this.island); },",
  "    openResult(options = {}) {",
  "      const recruit = cloneFreshDraftRecruit(this.candidate);",
  "      if (options.grade) recruit.tier = ({ S:'T1', A:'T2', B:'T3', C:'T4', D:'T5', E:'T6' })[options.grade];",
  "      openRecruitResultModal(currentPlayer(), this.island, recruit,",
  "        { chance: 1, tavernReveal: options.cinematic !== false });",
  "    },",
  "    spectator(outcome = 'invite', responder = 'zoro') {",
  "      spectatorTavernResultModal({ islandName: this.island.name, playerName: 'QA spectator',",
  "        recruit: spectatorCardData(cloneFreshDraftRecruit(this.candidate)), chanceText: '100%',",
  "        tavernReveal: true, tavernHost: responder, tavernOutcome: outcome });",
  "    },",
  "    invalidate(kind) {",
  "      if (kind === 'new-game') state.gameState = safeJsonClone(state.gameState);",
  "      if (kind === 'lost-control') { boardLan.enabled = true; boardLan.connected = false; }",
  "      if (kind === 'round') state.gameState.round += 1;",
  "      if (kind === 'new-modal') openModal('<h3 id=\"qaNewModal\">QA replacement modal</h3>');",
  "      if (kind === 'close') closeModal();",
  "    },",
  "    close: closeModal,",
  "  };",
].join("\n") + "\n";

const SYNC_ACCESS = [
  "  window.__tavernCaptainSocketQa = {",
  "    prepare() {",
  "      devObserver.running = false;",
  "      clearTimeout(devObserver.timer);",
  "      clearTimeout(cpuAuto.timer);",
  "      const game = state.gameState;",
  "      const player = localBoardPlayer();",
  "      const candidate = window.BoardCards.cards.find(card => card.id === 'nami');",
  "      const island = game.boardData.islands.find(entry => entry.kind === 'tavern');",
  "      game.phase = 'main';",
  "      game.currentPlayerIndex = game.players.indexOf(player);",
  "      game.turnStep = '擲骰前進';",
  "      game.pendingMove = game.routePrompt = game.islandDecision = null;",
  "      game.resolutionLock = game.movementAnimating = game.battleExitLock = false;",
  "      state.battleState = state.boardUiEvent = null;",
  "      game.players.forEach(entry => {",
  "        entry.isCPU = entry.isCpu = entry.cpu = false;",
  "        entry.pendingIslandServiceChoice = entry.pendingPostgameBossVoyage = null;",
  "        entry.activeMissions = [];",
  "        entry.crew = [];",
  "      });",
  "      player.crew = window.BoardCards.cards.filter(card => card.id !== candidate.id)",
  "        .slice(0, 3).map(cloneFreshDraftRecruit);",
  "      player.activeCrewIndex = 0;",
  "      player.coins = 20000;",
  "      player.location = { kind: 'island', islandId: island.id };",
  "      game.availableCards = [cloneFreshDraftRecruit(candidate)];",
  "      recalcPlayerDerivedStats(player);",
  "      normalizeLoadedGameState();",
  "      closeModal();",
  "      renderAll();",
  "      pushBoardLanState('qa-tavern-captain-socket-fixture');",
  "      this.island = island;",
  "      return { playerId: String(player.id), candidateId: candidate.id, count: 3 };",
  "    },",
  "    open() { openTavernModal(localBoardPlayer(), this.island); },",
  "    draw(id) {",
  "      const player = currentPlayer();",
  "      const pool = tavernRecruitRollPool(tavernRecruitPool(player), player);",
  "      const index = pool.findIndex(card => card.id === id);",
  "      if (index < 0) throw new Error('Controlled candidate unavailable');",
  "      const total = tavernRecruitTotalWeight(pool, player);",
  "      const prior = pool.slice(0, index).reduce((sum, card) =>",
  "        sum + tavernRecruitWeight(card, player), 0);",
  "      const fraction = (prior + tavernRecruitWeight(pool[index], player) / 2) / total;",
  "      const random = window.crypto.getRandomValues;",
  "      window.crypto.getRandomValues = buffer => {",
  "        buffer[0] = Math.floor(fraction * 4294967296); return buffer;",
  "      };",
  "      try { document.getElementById('rollRecruitBtn').click(); }",
  "      finally { window.crypto.getRandomValues = random; }",
  "      return { cost: TAVERN_RECRUIT_ROLL_COST, grade: tavernRecruitGrade(pool[index]) };",
  "    },",
  "  };",
].join("\n") + "\n";

function sameDraft(before, after) {
  return before.coins === after.coins &&
    JSON.stringify(before.crew) === JSON.stringify(after.crew) &&
    JSON.stringify(before.pool) === JSON.stringify(after.pool);
}
function recruited(before, after) {
  return after.crew.length === before.crew.length + 1 &&
    after.crew.filter(id => id === after.candidate).length === 1 &&
    !after.pool.includes(after.candidate) && after.finished === 1;
}
async function main() {
  assert(["127.0.0.1", "localhost"].includes(new URL(ROOT_URL).hostname), "Controlled fixtures are local only");
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = {
    ok: false, rootUrl: ROOT_URL,
    scope: "Local automated Chromium with controlled fixture state and production settlement handlers; not human-play, physical-device or public-deployment acceptance.",
    responders: RESPONDERS, outcomes: OUTCOMES, checks: [], errors: [], resources: [],
    screenshots: [], reactions: [], grades: [], timings: [], layouts: [],
  };
  const check = (name, value) => {
    assert(value, name);
    report.checks.push(name);
    console.log("PASS " + name);
  };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  let page;
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, userAgent: UA });
    page = await context.newPage();
    page.on("pageerror", error => report.errors.push(error.message));
    page.on("response", response => {
      if (response.status() >= 400) report.resources.push({ url: response.url(), status: response.status() });
    });
    await installPreReleaseArtFixture(page, report);
    await page.route("**/js/board_game.js*", async route => {
      const response = await route.fetch();
      let source = await response.text();
      const marker = "  window.__BOARD_GAME_DEBUG__ = {";
      assert(source.includes(marker), "QA closure marker exists");
      assert(source.includes("function finishIslandServiceTurn() {"), "Original settlement marker exists");
      assert(source.includes("function emitSpectatorModalEvent(kind, player, detail = {}, options = {}) {"),
        "Spectator event marker exists");
      source = source.replace("function finishIslandServiceTurn() {",
        "function finishIslandServiceTurn() { window.__qaFinishCount = (window.__qaFinishCount || 0) + 1;");
      source = source.replace("function emitSpectatorModalEvent(kind, player, detail = {}, options = {}) {",
        "function emitSpectatorModalEvent(kind, player, detail = {}, options = {}) { if (kind === 'tavern-result') { (window.__qaSpectatorEvents ||= []).push({ host: detail.tavernHost, outcome: detail.tavernOutcome || 'invite' }); }");
      await route.fulfill({ response, body: source.replace(marker, ACCESS + marker) });
    });
    await page.route("**/js/board_tavern_crew.js*", async route => {
      const response = await route.fetch();
      const source = await response.text();
      assert(source.includes('function chooseResponder(excludedId = "") {'), "Exclusion-aware response selector exists");
      await route.fulfill({ response, body: source.replace('function chooseResponder(excludedId = "") {',
        'function chooseResponder(excludedId = "") { window.__qaResponseCount = (window.__qaResponseCount || 0) + 1; if (window.__qaResponder) { if (window.__qaResponder === excludedId) throw new Error("QA attempted to bypass responder self-exclusion"); return window.__qaResponder; }') });
    });
    await page.goto(ROOT_URL + "/board_game.html?skipOpeningStory=1&tavern_captain_qa=1", { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__tavernCaptainQa &&
      window.BoardTavernReveal?.version === "4" &&
      window.BoardTavernCrew?.version === "3" &&
      window.BoardTavernVfx?.version === "1" &&
      window.__BOARD_GAME_DEBUG__?.getState?.().gameState, null, { timeout: 30000 });

    const snapshot = () => page.evaluate(() => window.__tavernCaptainQa.snapshot());
    async function ready(stage, timeout = stage === "silhouette" ? 36000 : 24000) {
      await page.waitForFunction(value => {
        const node = document.querySelector(".tavern-reveal-overlay");
        return node?.dataset.stage === value && node.dataset.ready === "1";
      }, stage, { timeout });
    }
    async function prepare(options = {}) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      const value = await page.evaluate(arg => window.__tavernCaptainQa.prepare(arg), options);
      await page.locator(OVERLAY).waitFor({ state: "detached" });
      return value;
    }
    async function result(options = {}) {
      await page.evaluate(arg => window.__tavernCaptainQa.openResult(arg), options);
      await ready("invitation");
    }
    async function vfxReady() {
      await page.waitForFunction(() => {
        const node = document.querySelector(".tavern-reveal-overlay");
        const canvas = node?.querySelector(".tavern-reveal-vfx-canvas");
        return node?.dataset.vfxReady === "1" && canvas?.width > 0 && canvas?.height > 0;
      }, null, { timeout: 12000 });
    }
    async function skip() {
      await page.locator(SKIP).click();
      await page.locator(OVERLAY).waitFor({ state: "detached" });
    }
    async function settle() {
      await page.waitForFunction(() => window.__qaFinishCount === 1, null, { timeout: 7000 });
      await page.locator(OVERLAY).waitFor({ state: "detached" });
      return snapshot();
    }
    async function shot(name) {
      const file = path.join(OUTPUT, name + ".png");
      await page.screenshot({ path: file, timeout: 7000 });
      report.screenshots.push(file);
    }
    async function vfxPixels(name) {
      await page.evaluate(() => {
        const style = document.createElement("style");
        style.id = "qa-isolate-tavern-vfx";
        style.textContent = [
          ".tavern-reveal-overlay { background: #000 !important; }",
          ".tavern-reveal-scene::after { display: none !important; }",
          ".tavern-reveal-backdrop, .tavern-reveal-portal, .tavern-reveal-host-frame,",
          ".tavern-reveal-invitation, .tavern-reveal-caption, .tavern-reveal-skip { visibility: hidden !important; }",
        ].join(" ");
        document.head.append(style);
      });
      try {
        await page.waitForTimeout(100);
        const bytes = await page.screenshot({ path: path.join(OUTPUT, name + "-vfx-only.png"), timeout: 7000 });
        return await page.evaluate(async encoded => {
          const img = new Image();
          img.src = "data:image/png;base64," + encoded;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.width;
          canvas.height = img.height;
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context.drawImage(img, 0, 0);
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
          const counts = { lit: 0, gold: 0, purple: 0, blue: 0, green: 0, silver: 0 };
          for (let index = 0; index < data.length; index += 4) {
            const r = data[index], g = data[index + 1], b = data[index + 2];
            if (Math.max(r, g, b) < 32) continue;
            counts.lit += 1;
            if (r > b * 1.22 && g > b * 1.09 && r > g * 1.05) counts.gold += 1;
            if (r > g * 1.2 && b > g * 1.22) counts.purple += 1;
            if (b > r * 1.2 && b > g * 1.08) counts.blue += 1;
            if (g > r * 1.1 && g > b * 1.06) counts.green += 1;
            if (Math.max(r, g, b) - Math.min(r, g, b) < 24) counts.silver += 1;
          }
          return { ...counts, width: canvas.width, height: canvas.height };
        }, bytes.toString("base64"));
      } finally {
        await page.evaluate(() => document.getElementById("qa-isolate-tavern-vfx")?.remove());
      }
    }
    async function overlayDetails() {
      return page.evaluate(() => {
        const node = document.querySelector(".tavern-reveal-overlay");
        const art = node?.querySelector(".tavern-reveal-host");
        return node && { stage: node.dataset.stage, grade: node.dataset.grade,
          host: node.dataset.host, motion: node.dataset.motion,
          line: node.querySelector(".tavern-reveal-line")?.textContent,
          speaker: node.querySelector(".tavern-reveal-speaker")?.textContent,
          image: art?.getAttribute("src"), loaded: art?.complete && art.naturalWidth > 0,
          spectator: node.dataset.spectator };
      });
    }
    async function reaction(outcome, responder) {
      await ready(outcome);
      const values = await overlayDetails();
      const expected = await page.evaluate(({ id, phase }) =>
        window.BoardTavernCrew.get(id)[phase], { id: responder, phase: outcome });
      const lineIndex = outcome === "accept" ? 0 : 1;
      check(responder + " " + outcome + " exact line, independent actor, art and motion",
        values.host === responder && values.host !== "luffy" &&
        values.line === LINES[responder][lineIndex] &&
        values.line === expected.line && values.image === ART + responder + "_" + outcome + ".webp" &&
        values.image === expected.image && values.motion === expected.motion &&
        values.loaded && values.speaker === windowNames[responder]);
      const latestEvent = await page.evaluate(() => window.__qaSpectatorEvents?.at(-1));
      check(responder + " " + outcome + " spectator payload shares selected responder",
        latestEvent?.host === responder && latestEvent.outcome === outcome);
      report.reactions.push({ responder, outcome, ...values });
    }
    const windowNames = Object.fromEntries(await page.evaluate(() =>
      window.BoardTavernCrew.responders.map(entry => [entry.id, entry.name])));

    const catalog = await page.evaluate(() => ({
      captain: window.BoardTavernCrew.captain,
      crew: window.BoardTavernCrew.crew.map(entry => entry.id),
      responders: window.BoardTavernCrew.responders.map(entry => ({
        id: entry.id, accept: entry.accept, decline: entry.decline,
      })),
    }));
    check("captain remains the sole inviting Straw Hat with exact requested dialogue",
      catalog.captain.id === "luffy" &&
      catalog.captain.invite.line === "你真有趣，要不要加入我們？" &&
      catalog.responders.every(entry => !("invite" in entry)));
    check("nine unique non-Luffy response hosts cover all ten Straw Hats",
      catalog.crew.length === 10 && new Set(catalog.crew).size === 10 &&
      catalog.responders.length === 9 &&
      new Set(catalog.responders.map(entry => entry.id)).size === 9 &&
      catalog.responders.every(entry => entry.id !== "luffy" && LINES[entry.id]));
    check("all eighteen response scripts point to purpose-built phase images",
      catalog.responders.every(entry =>
        entry.accept.line === LINES[entry.id][0] &&
        entry.decline.line === LINES[entry.id][1] &&
        entry.accept.image === ART + entry.id + "_accept.webp" &&
        entry.decline.image === ART + entry.id + "_decline.webp" &&
        entry.accept.image !== entry.decline.image));
    const random = await page.evaluate(() => {
      window.__qaResponder = "";
      const original = Math.random;
      Math.random = () => { throw new Error("Cosmetic response consumed gameplay RNG"); };
      try { return Array.from({ length: 900 }, () => window.BoardTavernCrew.chooseResponder()); }
      finally { Math.random = original; }
    });
    check("response selection is independent of gameplay RNG and covers nine hosts",
      random.every(id => LINES[id]) && new Set(random).size === 9);
    const excluded = await page.evaluate(() =>
      Array.from({ length: 900 }, () => window.BoardTavernCrew.chooseResponder("nami")));
    check("response selection never chooses drawn Straw Hat and still covers eight others",
      excluded.every(id => id !== "nami" && LINES[id]) && new Set(excluded).size === 8);
    const exclusionMatrix = await page.evaluate(ids => ({
      cards: ids.filter(id => window.BoardCards.cards.some(card => card.id === id)),
      draws: Object.fromEntries(ids.map(id => [id,
        Array.from({ length: 400 }, () => window.BoardTavernCrew.chooseResponder(id))])),
    }), Object.keys(LINES));
    check("all nine responder IDs exist unchanged in actual BoardCards",
      exclusionMatrix.cards.length === 9);
    check("all nine real card IDs exclude self and cover the other eight responders",
      Object.entries(exclusionMatrix.draws).every(([id, draws]) =>
        draws.every(value => value !== id && LINES[value]) && new Set(draws).size === 8));

    // Each rarity is checked on the same door seam, before the leaves fully open.
    for (const [grade, expected] of (process.env.BOARD_QA_ART_ONLY === "1" ? [] : Object.entries(GRADES))) {
      await prepare();
      await result({ grade });
      const invite = await overlayDetails();
      check(grade + " draw still starts with Luffy, never a random inviter",
        invite.host === "luffy" && invite.line === "你真有趣，要不要加入我們？" &&
        invite.loaded && invite.grade === grade);
      if (grade === "S") {
        await page.evaluate(() => {
          const node = document.querySelector(".tavern-reveal-overlay");
          window.__qaStageTicks = [{ stage: node.dataset.stage, at: performance.now() }];
          const observer = new MutationObserver(() => window.__qaStageTicks.push({
            stage: node.dataset.stage, at: performance.now(),
          }));
          observer.observe(node, { attributes: true, attributeFilter: ["data-stage"] });
          window.__qaStageObserver = observer;
        });
        await page.waitForTimeout(650);
        await shot("S-luffy-invitation");
      }
      const initial = await page.evaluate(() => {
        const node = document.querySelector(".tavern-reveal-overlay");
        return { left: getComputedStyle(node.querySelector(".tavern-reveal-door.left")).transform,
          opacity: Number(getComputedStyle(node.querySelector(".tavern-reveal-light")).opacity) };
      });
      await ready("crack", 7000);
      await vfxReady();
      await page.waitForTimeout(500);
      const crack = await page.evaluate(() => {
        const node = document.querySelector(".tavern-reveal-overlay");
        const light = node.querySelector(".tavern-reveal-light");
        const leaf = node.querySelector(".tavern-reveal-door.left");
        const lightStyle = getComputedStyle(light);
        const canvas = node.querySelector(".tavern-reveal-vfx-canvas");
        const diagnostics = window.BoardTavernVfx.diagnostics();
        return { stage: node.dataset.stage,
          color: node.style.getPropertyValue("--tavern-reveal-color").trim(),
          source: node.style.getPropertyValue("--tavern-reveal-light").trim(),
          image: lightStyle.backgroundImage,
          background: lightStyle.backgroundColor,
          opacity: Number(lightStyle.opacity),
          left: getComputedStyle(leaf).transform,
          width: light.getBoundingClientRect().width,
          vfxReady: node.dataset.vfxReady,
          canvas: { width: canvas?.width, height: canvas?.height,
            context: canvas?.getContext("webgl2") instanceof WebGL2RenderingContext },
          grades: window.BoardTavernVfx.grades,
          diagnostics };
      });
      check(grade + " door opens a crack with active WebGL rarity VFX before full glow",
        initial.opacity < 0.1 && crack.stage === "crack" &&
        crack.left !== initial.left && crack.width > 0 &&
        crack.color === expected.color &&
        crack.vfxReady === "1" && crack.opacity === 0 &&
        crack.canvas.context && crack.canvas.width > 0 && crack.canvas.height > 0 &&
        crack.diagnostics.liveControllerCount === 1 && crack.diagnostics.liveTickerCount === 1 &&
        crack.grades.includes(expected.vfx));
      check(grade + " light does not illuminate the outside door frame",
        await page.evaluate(() => {
          const node = document.querySelector(".tavern-reveal-overlay");
          const scene = node.querySelector(".tavern-reveal-scene");
          const frame = node.querySelector(".tavern-reveal-portal");
          const style = getComputedStyle(frame);
          return style.boxShadow === "none" &&
            getComputedStyle(scene).boxShadow === "none" &&
            node.dataset.vfxReady === "1";
        }));
      check(grade + " seam remains in crack phase for visual inspection",
        await page.locator(OVERLAY).getAttribute("data-stage") === "crack");
      const pixels = await vfxPixels(grade + "-crack");
      report.grades.push({ grade, initial, crack, pixels });
      check(grade + " WebGL draw produces visible pixels at the door crack",
        pixels.lit > 500);
      if (grade !== "S") {
        const colorCheck = {
          A: () => pixels.gold > 1000 && pixels.gold > pixels.purple * 3,
          B: () => pixels.purple > 1000 && pixels.purple > pixels.gold * 3,
          C: () => pixels.blue > 1000 && pixels.purple < pixels.blue * .1,
          D: () => pixels.green > 1000 && pixels.green > pixels.gold * 3,
          E: () => pixels.silver > pixels.lit * .7 &&
            pixels.gold + pixels.purple + pixels.blue + pixels.green < pixels.lit * .05,
        };
        check(grade + " actual WebGL pixels carry its distinct rarity color",
          colorCheck[grade]());
      }
      await shot(grade === "S" ? "S-door-crack-gold-prelude" : grade + "-door-crack");
      if (grade === "S") {
        for (const stage of ["glow", "silhouette", "reveal", "choice"]) {
          await ready(stage);
          if (stage !== "choice") await page.waitForTimeout(900);
          await shot("S-" + stage);
        }
        const ticks = await page.evaluate(() => {
          window.__qaStageObserver.disconnect();
          return window.__qaStageTicks;
        });
        report.timings = ticks;
        const ordered = ticks.map(row => row.stage).join(",");
        const durations = ticks.slice(1).map((row, index) => row.at - ticks[index].at);
        check("extended draw stages stay ordered: crack, glow, silhouette, reveal, choice",
          ordered === "invitation,crack,glow,silhouette,reveal,choice");
        check("door reveal pacing is substantially longer than the former short animation",
          durations[0] >= 2200 && durations[1] >= 1600 &&
          durations[2] >= 1900 && durations[3] >= 1700 &&
          durations[4] >= 2300 &&
          durations.reduce((sum, value) => sum + value, 0) >= 10000);
      }
      await skip();
      if (grade === "S") {
        await result({ grade });
        await ready("glow");
        await page.waitForTimeout(1050);
        report.sRainbow = await vfxPixels("S-glow");
        check("S burst carries multiple prismatic hues around a white light core",
          report.sRainbow.lit > 5000 &&
          report.sRainbow.gold > 500 && report.sRainbow.blue > 500 &&
          report.sRainbow.green > 500 && report.sRainbow.silver > 5000);
        await skip();
      }
    }
    if (process.env.BOARD_QA_STAGE_ONLY === "1") {
      for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
        await page.setViewportSize(viewport);
        for (const grade of ["S", "A"]) {
          await prepare();
          await result({ grade });
          await ready("crack", 7000);
          await page.waitForTimeout(900);
          const leak = await page.evaluate(() => {
            const node = document.querySelector(".tavern-reveal-overlay");
            const light = node.querySelector(".tavern-reveal-light");
            const doors = node.querySelector(".tavern-reveal-doors");
            const leaf = node.querySelector(".tavern-reveal-door.left");
            const canvas = node.querySelector(".tavern-reveal-vfx-canvas");
            return {
              beam: Number(getComputedStyle(light, "::after").opacity),
              lightOpacity: Number(getComputedStyle(light).opacity),
              center: Number(getComputedStyle(doors, "::after").opacity),
              innerEdge: Number(getComputedStyle(leaf, "::after").opacity),
              source: node.style.getPropertyValue("--tavern-reveal-light").trim(),
              grade: node.dataset.grade,
              vfxReady: node.dataset.vfxReady,
              canvas: { width: canvas?.width, height: canvas?.height },
            };
          });
          check(grade + " crack projects colored light past the wood on " +
            viewport.width + "x" + viewport.height,
            leak.grade === grade && leak.vfxReady === "1" &&
            leak.canvas.width > 0 && leak.canvas.height > 0 &&
            leak.lightOpacity === 0 && leak.center === 0 && leak.innerEdge > 0 &&
            (grade === "S" ? leak.source === "#fff9e9" : leak.source === GRADES.A.color));
          await shot(grade + "-door-crack-" + viewport.width + "x" + viewport.height);
          await skip();
        }
      }
      for (const viewport of [
        { width: 1440, height: 900 }, { width: 390, height: 844 },
        { width: 320, height: 568 }, { width: 932, height: 430 },
      ]) {
        await page.setViewportSize(viewport);
        const before = await prepare({ responder: "nami" });
        await result();
        await page.waitForTimeout(650);
        const invitationLayout = await layout();
        check("Luffy invitation fits " + viewport.width + "x" + viewport.height,
          invitationLayout.inside && !invitationLayout.textSkipOverlap &&
          invitationLayout.textFits && !invitationLayout.overflow);
        await shot("invitation-" + viewport.width + "x" + viewport.height);
        await skip();
        check("responsive initial skip still makes no choice " + viewport.width + "x" + viewport.height,
          sameDraft(before, await snapshot()) && (await snapshot()).finished === 0);
        await result();
        await ready("choice");
        const choiceLayout = await layout();
        check("choice controls and candidate fit " + viewport.width + "x" + viewport.height,
          choiceLayout.inside && !choiceLayout.textSkipOverlap &&
          choiceLayout.textFits && !choiceLayout.overflow &&
          choiceLayout.controls.length === 3 &&
          choiceLayout.controls.every(entry => entry.inside && entry.fits) &&
          !choiceLayout.portraitCaptionOverlap);
        await shot("choice-" + viewport.width + "x" + viewport.height);
        await page.locator('[data-tavern-choice="decline"]').click();
        await reaction("decline", "nami");
        await page.waitForTimeout(900);
        const responseLayout = await layout();
        check("Nami refusal line fits " + viewport.width + "x" + viewport.height,
          responseLayout.inside && !responseLayout.textSkipOverlap &&
          responseLayout.textFits && !responseLayout.overflow);
        await shot("decline-" + viewport.width + "x" + viewport.height);
        await skip();
        const after = await settle();
        check("responsive refusal settles exactly once " + viewport.width + "x" + viewport.height,
          sameDraft(before, after) && after.finished === 1 && after.responseCount === 1);
        report.layouts.push({ viewport, invitationLayout, choiceLayout, responseLayout });
      }
      check("stage-only browser run has no runtime errors", report.errors.length === 0);
      report.ok = true;
      return;
    }

    // Response art and dialogue are exercised through original decision buttons.
    for (const responder of RESPONDERS) {
      for (const outcome of OUTCOMES) {
        const before = await prepare({ responder });
        await result();
        check(responder + " " + outcome + " invite is always Luffy",
          (await overlayDetails()).host === "luffy" && (await snapshot()).responseCount === 0);
        await skip();
        check(responder + " " + outcome + " initial skip makes no decision",
          sameDraft(before, await snapshot()) && (await snapshot()).finished === 0);
        await page.locator(outcome === "accept" ? "#acceptRecruitBtn" : "#rejectRecruitBtn").click();
        await reaction(outcome, responder);
        check(responder + " " + outcome + " defers game settlement until response finishes",
          sameDraft(before, await snapshot()) && (await snapshot()).finished === 0);
        await page.waitForTimeout(900);
        await shot(responder + "-" + outcome + "-desktop");
        await skip();
        const after = await settle();
        check(responder + " " + outcome + " settles once, without a second response roll",
          (outcome === "accept" ? recruited(before, after) :
            sameDraft(before, after) && after.finished === 1) &&
          after.responseCount === 1);
      }
    }
    if (process.env.BOARD_QA_ART_ONLY === "1") {
      check("response-art matrix has no browser runtime errors", report.errors.length === 0);
      report.ok = true;
      return;
    }

    for (const outcome of ["accept", "decline"]) {
      const before = await prepare({ responder: "robin" });
      await page.evaluate(() => window.__tavernCaptainQa.openTavern());
      await page.locator("#rollRecruitBtn").click();
      await ready("invitation");
      const paid = await snapshot();
      check("real " + outcome + " draw deducts 2500 exactly once",
        paid.coins === before.coins - before.rollCost && paid.rollCost === 2500 &&
        paid.crew.length === before.crew.length && paid.responseCount === 0);
      await ready("choice");
      check("real " + outcome + " choice holds original result controls inert",
        await page.locator("#acceptRecruitBtn").isDisabled() &&
        await page.locator(".tavern-result-ui").evaluate(node => node.inert));
      await page.locator('[data-tavern-choice="' + outcome + '"]').click();
      await reaction(outcome, "robin");
      const after = await settle();
      check("real " + outcome + " choice commits original settlement only once",
        (outcome === "accept" ? recruited(paid, after) :
          sameDraft(paid, after) && after.finished === 1) &&
        after.coins === paid.coins && after.responseCount === 1);
    }

    const fullBefore = await prepare({ crewCount: 6, responder: "franky" });
    await result();
    await ready("choice");
    check("full crew requires a replacement choice before any welcome",
      await page.locator('[data-tavern-choice="accept"]').textContent() === "選擇替換夥伴");
    await page.locator('[data-tavern-choice="accept"]').click();
    await page.locator(OVERLAY).waitFor({ state: "detached" });
    check("opening replacement UI leaves roster and response RNG untouched",
      sameDraft(fullBefore, await snapshot()) &&
      (await snapshot()).finished === 0 && (await snapshot()).responseCount === 0);
    await page.locator('[data-replace-crew="0"]').click();
    await reaction("accept", "franky");
    await skip();
    const fullAfter = await settle();
    check("replacement settles one accepted six-person roster",
      fullAfter.crew.length === 6 && fullAfter.crew[0] === fullAfter.candidate &&
      fullAfter.pool.includes(fullBefore.crew[0]) &&
      !fullAfter.pool.includes(fullAfter.candidate) &&
      fullAfter.finished === 1 && fullAfter.responseCount === 1);
    const fullReject = await prepare({ crewCount: 6, responder: "zoro" });
    await result(); await skip();
    await page.locator("#rejectFullRecruitBtn").click();
    await reaction("decline", "zoro"); await skip();
    const fullRejectAfter = await settle();
    check("full-team refusal preserves crew and pool and settles once",
      sameDraft(fullReject, fullRejectAfter) &&
      fullRejectAfter.finished === 1 && fullRejectAfter.responseCount === 1);

    const doubleBefore = await prepare({ responder: "sanji" });
    await result();
    await page.evaluate(() => { window.BoardTavernReveal.scan(); window.BoardTavernReveal.scan(); });
    check("repeated scans do not duplicate invitation", await page.locator(OVERLAY).count() === 1);
    await skip();
    await page.evaluate(() => {
      const accept = document.getElementById("acceptRecruitBtn");
      accept.click(); accept.click(); document.getElementById("rejectRecruitBtn").click();
    });
    await reaction("accept", "sanji");
    await page.evaluate(() => {
      const node = document.querySelector("[data-tavern-reveal-skip]");
      node.click(); node.click();
    });
    const doubleAfter = await settle();
    await page.waitForTimeout(3300);
    check("double click, conflicting action and double skip cannot settle twice",
      recruited(doubleBefore, doubleAfter) && (await snapshot()).finished === 1 &&
      (await snapshot()).responseCount === 1);

    for (const kind of ["new-game", "lost-control", "round", "new-modal", "close"]) {
      const before = await prepare({ responder: "jinbe" });
      await result(); await skip();
      await page.locator("#acceptRecruitBtn").click();
      await reaction("accept", "jinbe");
      await page.evaluate(value => window.__tavernCaptainQa.invalidate(value), kind);
      await page.locator(OVERLAY).waitFor({ state: "detached", timeout: 4000 });
      await page.waitForTimeout(3300);
      const after = await snapshot();
      check(kind + " invalidates reaction before stale settlement",
        sameDraft(before, after) && after.finished === 0 &&
        JSON.stringify(after.originalCrew) === JSON.stringify(before.originalCrew));
    }

    const reducedBefore = await prepare({ responder: "brook" });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => window.__tavernCaptainQa.openResult());
    await page.waitForTimeout(100);
    check("reduced motion exposes usable original decision immediately",
      await page.locator(OVERLAY).count() === 0 &&
      await page.locator("#acceptRecruitBtn").isEnabled());
    await page.locator("#acceptRecruitBtn").click();
    check("reduced motion still commits one response selection and one settlement",
      recruited(reducedBefore, await settle()) && (await snapshot()).responseCount === 1);

    const spectatorBefore = await prepare();
    for (const [outcome, actor] of [["invite", "zoro"], ["accept", "robin"], ["decline", "brook"]]) {
      await page.evaluate(({ phase, id }) => window.__tavernCaptainQa.spectator(phase, id),
        { phase: outcome, id: actor });
      await ready(outcome === "invite" ? "invitation" : outcome);
      const detail = await overlayDetails();
      check("spectator " + outcome + " sees authoritative actor with no decision controls",
        detail.host === (outcome === "invite" ? "luffy" : actor) &&
        detail.spectator === "1" && await page.locator("[data-tavern-choice]").count() === 0);
      await skip();
    }
    check("spectator skip never mutates local recruitment",
      sameDraft(spectatorBefore, await snapshot()) && (await snapshot()).finished === 0);

    for (const viewport of [
      { width: 1440, height: 900 }, { width: 390, height: 844 },
      { width: 320, height: 568 }, { width: 932, height: 430 },
    ]) {
      await page.setViewportSize(viewport);
      const before = await prepare({ responder: "nami" });
      await result();
      await page.waitForTimeout(650);
      const invitationLayout = await layout();
      check("Luffy invitation text and skip fit " + viewport.width + "x" + viewport.height,
        invitationLayout.inside && !invitationLayout.textSkipOverlap &&
        !invitationLayout.overflow && invitationLayout.textFits);
      await shot("invitation-" + viewport.width + "x" + viewport.height);
      await ready("choice");
      const choiceLayout = await layout();
      check("choice controls and revealed candidate fit " + viewport.width + "x" + viewport.height,
        choiceLayout.inside && !choiceLayout.textSkipOverlap &&
        !choiceLayout.overflow && choiceLayout.textFits &&
        choiceLayout.controls.length === 3 &&
        choiceLayout.controls.every(entry => entry.inside && entry.fits) &&
        !choiceLayout.portraitCaptionOverlap);
      await shot("choice-" + viewport.width + "x" + viewport.height);
      await page.locator('[data-tavern-choice="decline"]').click();
      await reaction("decline", "nami");
      await page.waitForTimeout(900);
      const responseLayout = await layout();
      check("response text and skip fit " + viewport.width + "x" + viewport.height,
        responseLayout.inside && !responseLayout.textSkipOverlap &&
        !responseLayout.overflow && responseLayout.textFits);
      await shot("decline-" + viewport.width + "x" + viewport.height);
      await skip();
      check("responsive refusal still settles once " + viewport.width + "x" + viewport.height,
        sameDraft(before, await settle()) && (await snapshot()).finished === 1);
      report.layouts.push({ viewport, invitationLayout, choiceLayout, responseLayout });
    }
    check("no browser runtime errors", report.errors.length === 0);
    check("all eighteen purpose-built reaction images loaded without HTTP error",
      Object.keys(LINES).every(id => ["accept", "decline"].every(outcome =>
        report.reactions.some(entry => entry.responder === id && entry.outcome === outcome && entry.loaded))) &&
      !report.resources.some(entry => entry.url.includes("/crew_v3/")));
    report.ok = true;

    async function layout() {
      return page.evaluate(() => {
        const overlay = document.querySelector(".tavern-reveal-overlay");
        const skip = overlay.querySelector(".tavern-reveal-skip");
        const speech = overlay.querySelector(".tavern-reveal-invitation");
        const caption = overlay.querySelector(".tavern-reveal-caption");
        const portrait = overlay.querySelector(".tavern-reveal-character");
        const rect = node => {
          const box = node.getBoundingClientRect();
          return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
        };
        const overlap = (a, b) => a.left < b.right - 1 && a.right > b.left + 1 &&
          a.top < b.bottom - 1 && a.bottom > b.top + 1;
        const within = box => box.left >= -1 && box.right <= innerWidth + 1 &&
          box.top >= -1 && box.bottom <= innerHeight + 1;
        const texts = [speech.querySelector(".tavern-reveal-speaker"),
          speech.querySelector(".tavern-reveal-role"),
          speech.querySelector(".tavern-reveal-line"),
          speech.querySelector(".tavern-reveal-decision"),
          caption.querySelector(".tavern-reveal-rank"),
          caption.querySelector(".tavern-reveal-name")]
          .filter(node => {
            if (!node || !node.getClientRects().length || node.closest("[hidden]")) return false;
            return node.closest(".tavern-reveal-caption")
              ? !caption.hidden : Number(getComputedStyle(speech).opacity) > 0.05;
          });
        const controls = [...overlay.querySelectorAll("button")]
          .filter(node => node.getClientRects().length)
          .map(node => ({ label: node.textContent, inside: within(rect(node)),
            fits: node.scrollWidth <= node.clientWidth + 2 }));
        const skipRect = rect(skip);
        const textRects = texts.map(rect);
        const portraitRect = portrait && portrait.getClientRects().length ? rect(portrait) : null;
        const captionRect = !caption.hidden ? rect(caption) : null;
        return { stage: overlay.dataset.stage,
          inside: textRects.every(within), textSkipOverlap: textRects.some(box => overlap(box, skipRect)),
          textFits: texts.every(node => node.scrollWidth <= node.clientWidth + 2),
          overflow: document.documentElement.scrollWidth > innerWidth + 2,
          controls, portraitCaptionOverlap: overlay.dataset.stage === "choice" &&
            portraitRect && captionRect ? overlap(portraitRect, captionRect) : false,
          textRects, skipRect, portraitRect, captionRect };
      });
    }
  } catch (error) {
    report.failure = error.stack;
    if (page) {
      report.failureState = await page.evaluate(() => ({
        overlay: document.querySelector(".tavern-reveal-overlay")?.outerHTML,
        snapshot: window.__tavernCaptainQa?.snapshot(),
        result: document.querySelector(".tavern-result-ui")?.dataset,
        modalOpen: document.querySelector(".tavern-result-ui")?.closest(".board-modal-backdrop")?.classList.contains("open"),
        readyToken: getComputedStyle(document.documentElement).getPropertyValue("--tavern-reveal-ready").trim(),
        reducedMotion: matchMedia("(prefers-reduced-motion: reduce)").matches,
        crewLoaded: !!window.BoardTavernCrew?.get("luffy"),
        revealLoaded: window.BoardTavernReveal?.version,
        portrait: document.querySelector(".tavern-result-art img")?.src,
      })).catch(() => null);
      await page.screenshot({ path: path.join(OUTPUT, "failure.png") }).catch(() => {});
    }
    throw error;
  } finally {
    fs.writeFileSync(path.join(OUTPUT, "result.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

async function socketDevice(browser, profile, report) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, userAgent: UA });
  await context.addInitScript(entry => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    window.__tavernCaptainWire = [];
    let originalIo;
    Object.defineProperty(window, "io", {
      configurable: true,
      get: () => originalIo,
      set(value) {
        originalIo = new Proxy(value, {
          apply(target, thisArg, args) {
            const socket = Reflect.apply(target, thisArg, args);
            const emit = socket.emit;
            socket.emit = function (eventName, ...values) {
              if (["BOARD_GAME_EVENT", "BOARD_GAME_STATE"].includes(eventName)) {
                const event = values[0]?.event;
                const row = {
                  eventName, type: event?.type, kind: event?.detail?.kind,
                  detail: event?.detail?.kind === "tavern-result" ? event.detail : null,
                  ack: null,
                };
                window.__tavernCaptainWire.push(row);
                const index = values.length - 1;
                if (typeof values[index] === "function") {
                  const callback = values[index];
                  values[index] = (...reply) => {
                    row.ack = reply[0];
                    return callback(...reply);
                  };
                }
              }
              return emit.call(this, eventName, ...values);
            };
            window.__tavernCaptainSocket = socket;
            return socket;
          },
        });
      },
    });
  }, profile);
  const page = await context.newPage();
  await installPreReleaseArtFixture(page, report);
  page.on("pageerror", error => report.errors.push({ device: profile.name, error: error.message }));
  await page.route("**/js/board_game.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = "  window.__BOARD_GAME_DEBUG__ = {";
    assert(source.includes(marker), "Socket fixture closure marker exists");
    await route.fulfill({ response, body: source.replace(marker, SYNC_ACCESS + marker) });
  });
  await page.route("**/js/board_tavern_crew.js*", async route => {
    const response = await route.fetch();
    const source = await response.text();
    const marker = 'function chooseResponder(excludedId = "") {';
    assert(source.includes(marker), "Socket fixture exclusion-aware chooser exists");
    await route.fulfill({ response, body: source.replace(marker,
      marker + ' if (excludedId === "zoro") throw new Error("QA responder cannot greet self"); return "zoro";') });
  });
  await page.goto(ROOT_URL + "/board_start.html?tavern_captain_socket_qa=1", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForFunction(() => window.BoardShared && window.io &&
    document.body.dataset.entryStage === "press", null, { timeout: 15000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app");
  return {
    ...profile, context, page,
    userId: await page.evaluate(() => Number(localStorage.getItem("op_board_user_id"))),
  };
}

async function socketRoom(entry, code = "") {
  await entry.page.click("#openBoardFlowBtn");
  if (code) {
    await entry.page.fill("#roomCodeInput", code);
    await entry.page.click("#joinBoardRoomBtn");
  } else {
    await entry.page.click("#createBoardRoomBtn");
  }
  await entry.page.waitForFunction(expected => {
    const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
    return document.querySelector('section[data-view="lobby"]')?.classList.contains("active") &&
      (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual));
  }, code, { timeout: 15000 });
}

async function socketConnected(entry) {
  await entry.page.waitForURL(/board_game\.html\?.*online=1/,
    { waitUntil: "domcontentloaded", timeout: 20000 });
  await entry.page.waitForFunction(() => {
    const status = window.__BOARD_GAME_DEBUG__?.boardLanStatus?.();
    return status?.connected && !status.awaitingInitialState && !status.applying &&
      window.__tavernCaptainSocket?.connected && window.BoardTavernReveal?.version === "4";
  }, null, { timeout: 30000 });
}

async function socketSnapshot(entry, id) {
  return entry.page.evaluate(playerId => {
    const game = window.__BOARD_GAME_DEBUG__.getState().gameState;
    const player = game.players.find(row => String(row.id) === playerId);
    return {
      coins: player.coins, crew: player.crew.map(card => card.id),
      pool: game.availableCards.map(card => card.id).sort(),
      phase: game.phase, turn: game.currentPlayerIndex,
    };
  }, id);
}

async function socketReady(entry, stage) {
  const handle = await entry.page.waitForFunction(expected => {
    const overlay = document.querySelector(".tavern-reveal-overlay");
    if (overlay?.dataset.stage !== expected || overlay.dataset.ready !== "1") return false;
    const art = overlay.querySelector(".tavern-reveal-host");
    return {
      host: overlay.dataset.host, stage: overlay.dataset.stage,
      grade: overlay.dataset.grade, motion: overlay.dataset.motion,
      color: overlay.style.getPropertyValue("--tavern-reveal-color"),
      line: overlay.querySelector(".tavern-reveal-line").textContent,
      image: art.getAttribute("src"),
      loaded: art.complete && art.naturalWidth > 0,
    };
  }, stage, { timeout: stage === "silhouette" ? 36000 : 24000 });
  return handle.jsonValue();
}

async function socketMain() {
  assert(["127.0.0.1", "localhost"].includes(new URL(ROOT_URL).hostname),
    "Controlled Socket fixtures are local only");
  fs.mkdirSync(OUTPUT, { recursive: true });
  const report = {
    ok: false, rootUrl: ROOT_URL,
    scope: "Two real local Socket.IO rooms, each with two independent Chromium contexts using create/join/start and production recruitment/state handlers. Fixture state and cosmetic responder are controlled only in intercepted browser responses. Not remote-network, human-play or physical-device acceptance.",
    checks: [], outcomes: [], wire: [], errors: [],
  };
  const check = (name, value) => {
    assert(value, name);
    report.checks.push(name);
    console.log("PASS " + name);
  };
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  let host, guest;
  try {
    for (const outcome of ["accept", "decline"]) {
      const stamp = Date.now().toString(36);
      host = await socketDevice(browser, {
        userId: 991291, clientId: "captain-host-" + stamp, name: "酒館主" + stamp,
      }, report);
      guest = await socketDevice(browser, {
        userId: 991292, clientId: "captain-guest-" + stamp, name: "酒館客" + stamp,
      }, report);
      await socketRoom(host);
      const roomCode = (await host.page.textContent("#boardLobbyRoomCode")).trim();
      await socketRoom(guest, roomCode);
      await guest.page.click("#boardReadyBtn");
      await host.page.click("#boardStartBtn");
      await Promise.all([socketConnected(host), socketConnected(guest)]);
      check(outcome + " real two-context room reaches connected v4 game", true);
      const fixture = await host.page.evaluate(() => window.__tavernCaptainSocketQa.prepare());
      await guest.page.waitForFunction(({ id, count }) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const game = debug.getState().gameState;
        const player = game.players.find(row => String(row.id) === id);
        return game.phase === "main" &&
          String(game.players[game.currentPlayerIndex]?.id) === id &&
          player.coins === 20000 && player.crew.length === count &&
          !player.crew.some(card => card.id === "nami") &&
          !debug.boardLanStatus().applying;
      }, { id: fixture.playerId, count: fixture.count }, { timeout: 15000 });
      const before = await socketSnapshot(host, fixture.playerId);
      check(outcome + " fixture is synchronized before draw",
        JSON.stringify(before) === JSON.stringify(await socketSnapshot(guest, fixture.playerId)));
      await host.page.evaluate(() => window.__tavernCaptainSocketQa.open());
      await guest.page.locator("#spectatorModalCloseBtn").waitFor({ state: "visible", timeout: 10000 });
      const draw = await host.page.evaluate(id =>
        window.__tavernCaptainSocketQa.draw(id), fixture.candidateId);
      const invitation = {
        host: null, guest: null,
      };
      [invitation.host, invitation.guest] = await Promise.all([
        socketReady(host, "invitation"), socketReady(guest, "invitation"),
      ]);
      const { stage: ownerStage, ...ownerInvite } = invitation.host;
      const { stage: viewerStage, ...viewerInvite } = invitation.guest;
      check(outcome + " invitation is the same Luffy image, line and rarity for both clients",
        ownerStage === "invitation" && viewerStage === "invitation" &&
        JSON.stringify(ownerInvite) === JSON.stringify(viewerInvite) &&
        ownerInvite.host === "luffy" && ownerInvite.grade === draw.grade &&
        ownerInvite.line === "你真有趣，要不要加入我們？" &&
        ownerInvite.loaded && viewerInvite.loaded);
      check(outcome + " spectator has no decision controls",
        await guest.page.locator("#acceptRecruitBtn, #rejectRecruitBtn, [data-replace-crew], [data-tavern-choice]").count() === 0);
      await guest.page.waitForFunction(({ id, coins }) =>
        window.__BOARD_GAME_DEBUG__.getState().gameState.players.find(row =>
          String(row.id) === id)?.coins === coins,
      { id: fixture.playerId, coins: before.coins - draw.cost });
      const paid = await socketSnapshot(host, fixture.playerId);
      const paidVersion = await host.page.evaluate(() =>
        window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
      check(outcome + " draw charges exactly once before deciding",
        paid.coins === before.coins - 2500 &&
        JSON.stringify(paid.crew) === JSON.stringify(before.crew));
      await guest.page.locator(SKIP).click();
      await guest.page.locator(OVERLAY).waitFor({ state: "detached" });
      check(outcome + " spectator invitation skip leaves authority unchanged",
        JSON.stringify(await socketSnapshot(guest, fixture.playerId)) === JSON.stringify(paid));
      await socketReady(host, "choice");
      await host.page.locator('[data-tavern-choice="' + outcome + '"]').click();
      const reaction = {
        host: null, guest: null,
      };
      [reaction.host, reaction.guest] = await Promise.all([
        socketReady(host, outcome), socketReady(guest, outcome),
      ]);
      check(outcome + " reaction shares exactly one non-self responder across two clients",
        JSON.stringify(reaction.host) === JSON.stringify(reaction.guest) &&
        reaction.host.host === "zoro" && reaction.host.host !== fixture.candidateId &&
        reaction.host.stage === outcome && reaction.host.loaded);
      check(outcome + " response appears before authoritative roster settlement",
        JSON.stringify(await socketSnapshot(host, fixture.playerId)) === JSON.stringify(paid));
      await guest.page.locator(SKIP).click();
      check(outcome + " spectator reaction skip does not settle owner",
        JSON.stringify(await socketSnapshot(host, fixture.playerId)) === JSON.stringify(paid));
      await host.page.locator(SKIP).click();
      await host.page.locator(OVERLAY).waitFor({ state: "detached" });
      await host.page.waitForFunction(version => {
        const status = window.__BOARD_GAME_DEBUG__.boardLanStatus();
        return status.version > version && status.lastAck?.ok === true &&
          !status.hasInFlightState && !status.hasPendingState && !status.hasPushTimer;
      }, paidVersion, { timeout: 15000 });
      const committedVersion = await host.page.evaluate(() =>
        window.__BOARD_GAME_DEBUG__.boardLanStatus().version);
      await guest.page.waitForFunction(({ id, expected, outcome, version }) => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const status = debug.boardLanStatus();
        const game = debug.getState().gameState;
        const player = game.players.find(row => String(row.id) === id);
        return status.version >= version && !status.applying &&
          !status.playback.active && status.playback.pending === 0 &&
          !document.querySelector(".tavern-result-ui") &&
          (outcome === "decline"
            ? player.crew.length === expected
            : player.crew.some(card => card.id === "nami"));
      }, {
        id: fixture.playerId, expected: before.crew.length,
        outcome, version: committedVersion,
      }, { timeout: 15000 });
      const after = {
        host: await socketSnapshot(host, fixture.playerId),
        guest: await socketSnapshot(guest, fixture.playerId),
      };
      check(outcome + " acknowledged game state converges on both clients",
        JSON.stringify(after.host) === JSON.stringify(after.guest));
      check(outcome + " original recruit outcome settles once with no second charge",
        after.host.coins === paid.coins &&
        (outcome === "accept"
          ? after.host.crew.filter(id => id === "nami").length === 1 &&
            !after.host.pool.includes("nami") && after.host.crew.length === 4
          : JSON.stringify(after.host.crew) === JSON.stringify(before.crew) &&
            after.host.pool.includes("nami")));
      const guestWire = await guest.page.evaluate(() => window.__tavernCaptainWire);
      check(outcome + " spectator never emits a recruitment decision",
        !guestWire.some(row => row.kind === "tavern-result"));
      const ownerWire = await host.page.evaluate(() => window.__tavernCaptainWire);
      check(outcome + " actual Socket event ACK carries one reaction host and outcome",
        ownerWire.filter(row => row.kind === "tavern-result" &&
          row.detail?.tavernOutcome === outcome &&
          row.detail?.tavernHost === "zoro" && row.ack?.ok === true).length === 1);
      check(outcome + " actual state transport receives positive ACK",
        ownerWire.some(row => row.eventName === "BOARD_GAME_STATE" && row.ack?.ok === true));
      report.outcomes.push({
        outcome, roomCode, fixture, before, paid, invitation, reaction, after,
        ownerWire: ownerWire.filter(row => row.kind === "tavern-result"),
      });
      report.wire.push(...ownerWire);
      await guest.page.reload({ waitUntil: "domcontentloaded" });
      await socketConnected(guest);
      check(outcome + " spectator refresh restores settled game and identity",
        JSON.stringify(await socketSnapshot(guest, fixture.playerId)) === JSON.stringify(after.host) &&
        await guest.page.evaluate(() =>
          Number(window.__BOARD_GAME_DEBUG__.getLocalBoardPlayer()?.userId)) === guest.userId);
      await host.context.close();
      await guest.context.close();
      host = guest = null;
    }
    check("two-context Socket run has no browser runtime errors", report.errors.length === 0);
    report.ok = true;
  } catch (error) {
    report.failure = error.stack;
    for (const entry of [host, guest].filter(Boolean)) {
      const label = entry === host ? "owner" : "spectator";
      await entry.page.screenshot({
        path: path.join(OUTPUT, label + "-failure.png"),
      }).catch(() => {});
      report[label + "Failure"] = await entry.page.evaluate(() => ({
        url: location.href,
        modal: document.getElementById("boardModal")?.textContent?.slice(0, 800),
        overlay: document.querySelector(".tavern-reveal-overlay")?.dataset,
        result: document.querySelector(".tavern-result-ui")?.dataset,
        readyToken: getComputedStyle(document.documentElement).getPropertyValue("--tavern-reveal-ready").trim(),
        status: window.__BOARD_GAME_DEBUG__?.boardLanStatus?.(),
        wire: window.__tavernCaptainWire?.slice(-12),
      })).catch(() => null);
    }
    throw error;
  } finally {
    fs.writeFileSync(path.join(OUTPUT, "result.json"), JSON.stringify(report, null, 2));
    await browser.close();
  }
}

(process.env.BOARD_QA_SOCKET_ONLY === "1" ? socketMain() : main())
  .catch(error => { console.error(error); process.exitCode = 1; });
