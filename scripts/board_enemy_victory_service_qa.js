// Local, isolated-data Chrome regression for enemy-island victory continuation.
// The fixture creates a real LAN room, starts a real enemy battle, and supplies
// its completed win state. All settlement, service, turn and reload paths are real.
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18922";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-enemy-service-20260921";
const RUN = `${Date.now().toString(36)}${crypto.randomBytes(3).toString("hex")}`;
const BASE = 920000000 + crypto.randomInt(100000, 700000);
const BASELINE = process.env.BOARD_QA_BASELINE === "1";
const BASELINE_REF = process.env.BOARD_QA_BASELINE_REF || "HEAD";
const BASELINE_JS = BASELINE ? execFileSync("git", ["show", `${BASELINE_REF}:public/js/board_game.js`], { cwd: path.resolve(__dirname, ".."), maxBuffer: 10 * 1024 * 1024 }).toString("utf8") : "";
const LEAVE = "#leaveHospitalBtn, #leaveShopBtn, #leaveTavernBtn, #leaveResearchLabBtn, #leaveMissionBoardBtn, #leaveArenaBtn";
const report = { rootUrl: ROOT_URL, run: RUN, baseline: BASELINE, baselineRef: BASELINE ? BASELINE_REF : null, baselineSourceSha256: BASELINE ? crypto.createHash("sha256").update(BASELINE_JS).digest("hex") : null, automatedOnly: true, cases: [], errors: [], failures: [] };

function check(value, message, details) {
  if (!value) report.failures.push({ message, details });
}

async function inspect(page) {
  return page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__;
    const s = d?.getState();
    const g = s?.gameState;
    const p = d?.getCurrentPlayer();
    const visible = (selector) => [...document.querySelectorAll(selector)].some((el) => el.getClientRects().length && getComputedStyle(el).visibility !== "hidden");
    return {
      current: String(p?.id || ""), round: g?.round, turnStep: g?.turnStep,
      battle: !!s?.battleState, deferred: String(s?.battleState?.deferredCoopResult?.playerId || ""),
      resolutionLock: !!g?.resolutionLock, battleExitLock: !!g?.battleExitLock,
      diceRolling: !!g?.diceRolling, pendingMove: !!g?.pendingMove,
      routePrompt: !!g?.routePrompt, location: p?.location,
      pending: p?.pendingIslandServiceChoice || null,
      queues: (g?.players || []).map((v) => ({ id: String(v.id), count: d.coopDeferredResultQa.normalize(v).length, pending: v.pendingIslandServiceChoice || null })),
      service: visible("#leaveHospitalBtn, #leaveShopBtn, #leaveTavernBtn, #leaveResearchLabBtn, #leaveMissionBoardBtn, #leaveArenaBtn"),
      choice: visible(".island-service-choice-ui"),
      enter: visible("#enterPostBattleIslandBtn"), rollChoice: visible("#rollFromPostBattleIslandBtn"),
      modal: document.getElementById("boardModal")?.innerText?.slice(0, 500) || "",
      overlayClosing: !!document.getElementById("battlePageOverlay")?.classList.contains("closing"),
      lan: d?.boardLanStatus(),
    };
  });
}

async function until(page, predicate, description, timeout = 16000) {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    await page.evaluate(() => {
      const el = document.getElementById("itemRevealContinue");
      if (el?.getClientRects().length) el.click();
    });
    last = await inspect(page);
    if (predicate(last)) return last;
    await page.waitForTimeout(160);
  }
  throw new Error(`${description}: ${JSON.stringify(last)}`);
}

async function createDevice(browser, label, index, viewport) {
  const profile = { userId: BASE + index, clientId: `qa-enemy-${RUN}-${index}`, name: `敵人島QA${index}`, avatar: index % 8 };
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "reduce" });
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    localStorage.setItem("op_avatar", String(entry.avatar));
    localStorage.setItem("op_board_story_speed", "3");
  }, profile);
  const page = await context.newPage();
  if (BASELINE) await page.route("**/js/board_game.js*", (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: BASELINE_JS }));
  page.on("pageerror", (e) => report.errors.push(`${label}:${e.message}`));
  page.on("websocket", (socket) => socket.on("socketerror", (e) => report.errors.push(`${label}:websocket:${e}`)));
  await page.goto(`${ROOT_URL}/board_start.html?view=modeSelect&enemy_service_qa=${RUN}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => ["press", "auth", "app"].includes(document.body.dataset.entryStage), null, { timeout: 15000 });
  if (await page.evaluate(() => document.body.dataset.entryStage === "press")) await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth", null, { timeout: 10000 });
  await page.fill("#boardAuthUsername", profile.name);
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app", null, { timeout: 10000 });
  await page.waitForFunction(() => window.BoardShared && window.io && window.__BOARD_START_DEBUG__, null, { timeout: 20000 });
  await page.waitForFunction(() => window.__BOARD_START_DEBUG__.getState().socketReady, null, { timeout: 15000 }).catch(async (error) => {
    throw new Error(`${error.message}: ${JSON.stringify({ errors: report.errors, state: await page.evaluate(() => window.__BOARD_START_DEBUG__?.getState()) })}`);
  });
  const userId = await page.evaluate(() => Number(localStorage.getItem("op_board_user_id") || 0));
  return { ...profile, userId: userId || profile.userId, label, context, page };
}

async function createRoom(browser, label, count) {
  const viewports = [{ width: 1600, height: 900 }, { width: 1024, height: 768 }, { width: 932, height: 430 }];
  const devices = [];
  for (let i = 0; i < count; i += 1) devices.push(await createDevice(browser, `${label}-${i}`, (label === "solo" ? 1 : 10) + i, viewports[i]));
  await devices[0].page.click("#createBoardRoomBtn");
  await devices[0].page.waitForFunction(() => document.querySelector('[data-view="lobby"]')?.classList.contains("active") && /^B[A-Z0-9]+$/.test(document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || ""));
  const room = (await devices[0].page.textContent("#boardLobbyRoomCode")).trim();
  for (const device of devices.slice(1)) {
    await device.page.fill("#roomCodeInput", room);
    await device.page.click("#joinBoardRoomBtn");
    await device.page.waitForFunction((code) => document.getElementById("boardLobbyRoomCode")?.textContent?.trim() === code, room, { timeout: 12000 }).catch(async (error) => {
      throw new Error(`${error.message}: ${JSON.stringify(await device.page.evaluate(() => ({ debug: window.__BOARD_START_DEBUG__?.getState(), text: document.body.innerText.slice(-3500) })))}`);
    });
  }
  await devices[0].page.waitForFunction((n) => document.querySelectorAll("#boardLobbyPlayerGrid .seat-card:not(.empty)").length === n, count, { timeout: 12000 }).catch(async (error) => {
    throw new Error(`${error.message}: ${JSON.stringify(await Promise.all(devices.map((v) => v.page.evaluate(() => window.__BOARD_START_DEBUG__?.getState()))))}`);
  });
  for (const device of devices.slice(1)) await device.page.click("#boardReadyBtn");
  await devices[0].page.click("#boardStartBtn");
  console.log(`${label}: room ${room} started with ${count} clients`);
  for (const device of devices) {
    await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 25000 });
    await device.page.waitForFunction(() => {
      const d = window.__BOARD_GAME_DEBUG__, lan = d?.boardLanStatus();
      return d && window.BoardCards?.cards?.length && lan?.connected && !lan.awaitingInitialState;
    }, null, { timeout: 30000 });
    await device.page.evaluate(() => document.getElementById("finalEndingSkipBtn")?.click());
  }
  return { devices, room };
}

async function prepareBattle(page, coop, hostId) {
  return page.evaluate(({ coop, hostId }) => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState;
    g.players.sort((a, b) => Number(Number(b.userId) === hostId) - Number(Number(a.userId) === hostId));
    g.currentPlayerIndex = 0;
    g.phase = "main";
    g.turnStep = "擲骰前進";
    g.pendingMove = null;
    g.movementAnimating = false;
    g.diceRolling = false;
    g.resolutionLock = false;
    g.battleExitLock = false;
    g.routePrompt = null;
    g.tradePrompt = null;
    g.activeTrade = null;
    g.coopBattlePrompt = null;
    g.islandDecision = null;
    g.pendingMoveLearnQueue = [];
    s.battleState = null;
    const island = g.boardData.islands.find((v) => v.kind === "enemy");
    const islandState = d.getIslandState(island.id);
    islandState.currentKind = "enemy";
    islandState.isDefeated = false;
    islandState.temporaryServiceKind = "";
    islandState.currentHp = Math.max(1, Number(islandState.maxHp || 100));
    g.players.forEach((p, index) => {
      p.isCPU = false; p.isCpu = false; p.cpu = false;
      p.pendingBattle = null; p.pendingCoopBattleResults = []; p.pendingIslandServiceChoice = null;
      p.coins = 5000;
      p.crew = window.BoardCards.cards.slice(index * 4, index * 4 + 3).map((v) => d.cloneCard(v));
      p.crew.forEach((c) => { c.currentHp = d.cardMaxHp(c); });
      p.activeCrewIndex = 0;
      p.location = { kind: "island", islandId: island.id, entryDirection: null };
      d.recalcPlayerDerivedStats(p);
    });
    const modal = document.getElementById("boardModalBack");
    modal?.classList.remove("open");
    if (modal) { delete modal.dataset.forceChoice; delete modal.dataset.backdropClose; }
    document.getElementById("boardModal").innerHTML = "";
    d.renderAll();
    d.pushBoardLanState("qa-enemy-before-battle", { force: true });
    d.startBattle(g.players[0], island, islandState);
    const b = s.battleState;
    if (!b) throw new Error("startBattle did not open a battle");
    b.entryTransition = null; b.prebattleIntro = null; b.prebattleIntroDone = true;
    b.openingPassiveVisual = null; b.openingPassiveVisualQueue = []; b.openingPassiveVisualAnimating = false;
    b.animating = false; b.roundResolved = true; b.waitingResume = false; b.needsReplacement = false;
    b.result = "win"; b.enemyCombatant.currentHp = 0;
    if (coop) {
      b.coop = { enabled: true, participantIds: g.players.map((p) => String(p.id)), actions: {}, runtimes: {}, defeated: {}, contributions: {}, roundStartedAt: Date.now() };
      g.players.forEach((p) => d.getBattleView({ coopViewPlayerId: p.id }));
      // The active combat actor can differ from the map-turn owner.
      b.playerId = g.players[1].id;
    }
    d.ensureLineageExtractionOpportunity(b);
    d.battleDeclineLineageExtraction(g.players[0].id);
    d.renderAll(); d.notifyBattleWindow();
    d.pushBoardLanState("battle-qa-enemy-win", { force: true });
    return { playerIds: g.players.map((p) => String(p.id)), islandId: island.id, islandName: island.name, owner: String(g.players[0].id) };
  }, { coop, hostId });
}

async function finishVictory(page, reveal = false) {
  await page.waitForFunction(() => {
    const d = window.__BOARD_GAME_DEBUG__;
    return d?.getState()?.battleState && d.getBattleView()?.battle?.canControl && document.querySelector("#battlePageOverlay iframe");
  }, null, { timeout: 20000 });
  await page.evaluate((showReveal) => {
    const d = window.__BOARD_GAME_DEBUG__;
    if (showReveal) d.queueImportantItemReveal("pierced_flag", 1);
    return d.battleFinish();
  }, reveal);
  if (reveal) {
    await page.waitForTimeout(2500);
    const delayed = await inspect(page);
    const pendingReveal = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.isItemRevealPending());
    check(pendingReveal && !delayed.service && !!delayed.pending?.requiredEntry, "winner service did not wait for important item reveal", { pendingReveal, delayed });
    return { pendingReveal, delayed };
  }
}

async function checkService(page, label, owner) {
  const state = await until(page, (s) => s.service && !s.battle, `${label} service did not open`);
  check(state.current === owner, `${label}: service changed active player`, state);
  check(!state.choice && !state.rollChoice, `${label}: winner was offered roll choice`, state);
  check(!state.diceRolling && !state.pendingMove, `${label}: dice started before service`, state);
  const before = { current: state.current, round: state.round, location: state.location };
  await page.evaluate(() => window.__BOARD_GAME_DEBUG__.rollDice());
  await page.waitForTimeout(350);
  const blocked = await inspect(page);
  check(!blocked.diceRolling && !blocked.pendingMove && !blocked.routePrompt && JSON.stringify(blocked.location) === JSON.stringify(before.location), `${label}: direct roll bypassed required service`, blocked);
  await page.screenshot({ path: path.join(OUTPUT_DIR, `${label}.png`), fullPage: false });
  return { state, blocked };
}

async function leaveService(page) {
  await page.locator(LEAVE).filter({ visible: true }).first().click();
}

async function finishDeferred(page, playerId) {
  const before = await until(page, (s) => s.current === playerId && s.deferred === playerId, "own-turn deferred result did not open", 24000);
  check(!before.choice, "choice opened before deferred result finished", before);
  const coins = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getCurrentPlayer().coins);
  await page.evaluate((id) => {
    const d = window.__BOARD_GAME_DEBUG__;
    d.battleDeclineLineageExtraction(id);
    return d.battleFinish();
  }, playerId);
  const choice = await until(page, (s) => !s.battle && s.current === playerId && s.choice, "deferred completion did not open enter/roll choice", 22000);
  const afterCoins = await page.evaluate(() => window.__BOARD_GAME_DEBUG__.getCurrentPlayer().coins);
  check(coins === afterCoins, "deferred completion duplicated reward", { coins, afterCoins });
  check(choice.enter && choice.rollChoice && !choice.pending?.requiredEntry, "co-op participant missing both choices", choice);
  return { before, choice, coins, afterCoins };
}

async function soloCase(browser) {
  const { devices, room } = await createRoom(browser, "solo", 2);
  const host = devices[0].page;
  const entry = { label: "solo-online", room };
  report.cases.push(entry);
  try {
    entry.setup = await prepareBattle(host, false, devices[0].userId);
    console.log("solo: prepared victory");
    entry.reveal = await finishVictory(host, true);
    entry.immediate = await checkService(host, "solo-immediate-desktop", entry.setup.owner);
    console.log("solo: immediate service verified");
    entry.peer = await until(devices[1].page, (s) => !s.battle && s.current === entry.setup.owner && !!s.queues[0]?.pending, "observer did not receive pending winner service");
    check(entry.peer.queues[0].pending.requiredEntry === true, "winner required entry did not synchronize", entry.peer);
    await host.reload({ waitUntil: "domcontentloaded" });
    await host.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.boardLanStatus().connected, null, { timeout: 20000 });
    entry.afterReload = await checkService(host, "solo-reload-desktop", entry.setup.owner);
    entry.manualRoundTrip = await host.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__;
      const payload = d.createManualSavePayload();
      const before = payload.gameState.players[payload.gameState.currentPlayerIndex].pendingIslandServiceChoice;
      const loaded = d.loadManualGame(payload, { source: "lan", initialLanRestore: true, silent: true });
      const after = d.getCurrentPlayer().pendingIslandServiceChoice;
      return { loaded, before, after };
    });
    check(entry.manualRoundTrip.loaded && entry.manualRoundTrip.after?.requiredEntry === true && entry.manualRoundTrip.before.createdAt === entry.manualRoundTrip.after.createdAt, "manual save/load lost winner required service", entry.manualRoundTrip);
    entry.afterManualLoad = await checkService(host, "solo-manual-load-desktop", entry.setup.owner);
    await host.setViewportSize({ width: 932, height: 430 });
    await host.screenshot({ path: path.join(OUTPUT_DIR, "solo-service-mobile.png"), fullPage: false });
    entry.layout = await host.locator(LEAVE).filter({ visible: true }).first().evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: innerWidth, height: innerHeight };
    });
    check(entry.layout.x >= 0 && entry.layout.right <= entry.layout.width && entry.layout.y >= 0 && entry.layout.bottom <= entry.layout.height, "mobile service exit outside viewport", entry.layout);
    await leaveService(host);
    entry.afterLeave = await until(devices[1].page, (s) => s.current === entry.setup.playerIds[1] && !s.battle, "service exit did not hand off turn");
    check(!entry.afterLeave.queues[0]?.pending, "winner required entry survived completed service", entry.afterLeave);
  } catch (error) {
    entry.error = error.stack;
    report.failures.push({ message: "solo-online exception", error: error.message });
    entry.finalState = await inspect(host).catch(() => null);
    await host.screenshot({ path: path.join(OUTPUT_DIR, "solo-failure.png") }).catch(() => {});
  } finally {
    for (const device of devices) await device.context.close();
  }
}

async function coopCase(browser) {
  const { devices, room } = await createRoom(browser, "coop", 3);
  const host = devices[0].page;
  const entry = { label: "coop-online", room };
  report.cases.push(entry);
  try {
    entry.setup = await prepareBattle(host, true, devices[0].userId);
    console.log("coop: prepared victory");
    await finishVictory(host);
    entry.immediate = await checkService(host, "coop-winner-desktop", entry.setup.owner);
    console.log("coop: immediate service verified");
    entry.queuesBeforeHandoff = await inspect(host);
    check(entry.queuesBeforeHandoff.queues.slice(1).every((q) => q.count === 1 && q.pending && !q.pending.requiredEntry), "other participants did not receive deferred optional choices", entry.queuesBeforeHandoff);
    for (let i = 1; i < devices.length; i += 1) {
      const other = await inspect(devices[i].page);
      check(!other.enter && !other.rollChoice, `participant ${i} received actionable choice before own turn`, other);
    }
    await leaveService(host);
    entry.second = await finishDeferred(devices[1].page, entry.setup.playerIds[1]);
    await devices[1].page.screenshot({ path: path.join(OUTPUT_DIR, "coop-choice-tablet.png"), fullPage: false });
    await devices[1].page.click("#enterPostBattleIslandBtn");
    entry.secondService = await until(devices[1].page, (s) => s.service && s.current === entry.setup.playerIds[1], "participant enter did not open service");
    await leaveService(devices[1].page);
    entry.third = await finishDeferred(devices[2].page, entry.setup.playerIds[2]);
    await devices[2].page.screenshot({ path: path.join(OUTPUT_DIR, "coop-choice-mobile.png"), fullPage: false });
    await devices[2].page.click("#rollFromPostBattleIslandBtn");
    entry.thirdRoll = await until(devices[2].page, (s) => !s.pending && !s.choice && (s.diceRolling || s.pendingMove || s.routePrompt || s.turnStep !== entry.third.choice.turnStep), "participant roll did not proceed");
    check(!entry.thirdRoll.pending && !entry.thirdRoll.choice, "roll choice was not consumed", entry.thirdRoll);
  } catch (error) {
    entry.error = error.stack;
    report.failures.push({ message: "coop-online exception", error: error.message });
    entry.finalStates = await Promise.all(devices.map((v) => inspect(v.page).catch(() => null)));
    await host.screenshot({ path: path.join(OUTPUT_DIR, "coop-failure.png") }).catch(() => {});
  } finally {
    for (const device of devices) await device.context.close();
  }
}

async function legacyCpuCase(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  try {
    await page.goto(`${ROOT_URL}/board_game.html?enemy_service_legacy_qa=${RUN}`, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.postBattleIslandChoiceQa && window.BoardCards?.cards?.length);
    const entry = await page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState, p = g.players[0];
      g.players.length = 1; g.phase = "main"; g.currentPlayerIndex = 0; g.resolutionLock = false;
      g.battleExitLock = false; g.pendingMove = null; g.routePrompt = null; s.battleState = null;
      p.isCPU = false; p.isCpu = false; p.cpu = false; p.pendingCoopBattleResults = [];
      p.coins = 0; p.crew = window.BoardCards.cards.slice(0, 3).map((c) => d.cloneCard(c));
      p.crew.forEach((c) => { c.currentHp = d.cardMaxHp(c); }); p.activeCrewIndex = 0;
      d.recalcPlayerDerivedStats(p);
      const island = g.boardData.islands.find((v) => v.kind === "enemy"), islandState = d.getIslandState(island.id);
      p.location = { kind: "island", islandId: island.id };
      islandState.currentKind = "hospital"; islandState.temporaryServiceKind = "hospital"; islandState.isDefeated = true;
      islandState.temporaryServiceStartedRound = g.round; islandState.temporaryServiceExpiresAtRound = g.round + 3;
      d.postBattleIslandChoiceQa.mark(p, island, "hospital", { islandId: island.id });
      delete p.pendingIslandServiceChoice.requiredEntry;
      d.closeModal();
      const opened = d.postBattleIslandChoiceQa.open(p);
      const legacy = { opened, enter: !!document.getElementById("enterPostBattleIslandBtn"), roll: !!document.getElementById("rollFromPostBattleIslandBtn"), requiredEntry: p.pendingIslandServiceChoice.requiredEntry === true };
      p.isCPU = true; p.isCpu = true; p.cpu = true;
      const shouldEnter = d.postBattleIslandChoiceQa.shouldEnter(d.postBattleIslandChoiceQa.action(p));
      const message = d.postBattleIslandChoiceQa.handleCpu();
      return { label: "legacy-optional-cpu", legacy, cpu: { shouldEnter, message, pending: !!p.pendingIslandServiceChoice, ownsLock: d.postBattleIslandChoiceQa.ownsLock() } };
    });
    report.cases.push(entry);
    check(entry.legacy.opened && entry.legacy.enter && entry.legacy.roll && !entry.legacy.requiredEntry, "legacy save without requiredEntry changed optional behavior", entry);
    check(!entry.cpu.shouldEnter && !!entry.cpu.message && !entry.cpu.pending && !entry.cpu.ownsLock, "CPU legacy optional choice deadlocked", entry);
  } finally { await context.close(); }
}

(async () => {
  if (!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(ROOT_URL)) throw new Error("Run only against an isolated local QA server.");
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: CHROME_PATH, args: ["--disable-features=LocalNetworkAccessChecks,LocalNetworkAccessRestrictions"] });
  try {
    await soloCase(browser);
    await coopCase(browser);
    if (!BASELINE) await legacyCpuCase(browser);
  } catch (error) {
    report.failures.push({ message: "setup exception", error: error.stack });
  } finally {
    await browser.close();
    report.passed = !report.failures.length && !report.errors.length;
    fs.writeFileSync(path.join(OUTPUT_DIR, "report.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ passed: report.passed, baseline: BASELINE, cases: report.cases.map((v) => v.label), errors: report.errors, failures: report.failures, report: path.join(OUTPUT_DIR, "report.json") }, null, 2));
    if (!report.passed) process.exitCode = 1;
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
