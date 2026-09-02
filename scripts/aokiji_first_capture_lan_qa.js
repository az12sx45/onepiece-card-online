const fs = require("fs");
const crypto = require("crypto");
const { isDeepStrictEqual } = require("util");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const RUN_TOKEN = `${Date.now().toString(36)}-${crypto.randomBytes(4).toString("hex")}`;
const USER_BASE = 930000000 + crypto.randomInt(100000, 800000);

const PROFILES = {
  host: {
    userId: USER_BASE + 1,
    clientId: `qa-aokiji-host-${RUN_TOKEN}`,
    name: "青雉測試房主",
    avatar: 1,
    secret: process.env.BOARD_QA_HOST_SECRET || "",
    username: process.env.BOARD_QA_HOST_USERNAME || "",
    password: process.env.BOARD_QA_HOST_PASSWORD || "",
  },
  guest: {
    userId: USER_BASE + 2,
    clientId: `qa-aokiji-guest-${RUN_TOKEN}`,
    name: "青雉測試訪客",
    avatar: 2,
    secret: process.env.BOARD_QA_GUEST_SECRET || "",
    username: process.env.BOARD_QA_GUEST_USERNAME || "",
    password: process.env.BOARD_QA_GUEST_PASSWORD || "",
  },
};

function addFailure(report, message) {
  report.failures.push(String(message));
}

function attachDiagnostics(page, report, label) {
  page.on("pageerror", (error) => report.errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    const text = message.text();
    if (!text.startsWith("Failed to load resource:")) report.errors.push(`${label}:console:${text}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) {
      report.errors.push(`${label}:http:${response.status()}:${response.url()}`);
    }
  });
  page.on("requestfailed", (request) => {
    const reason = request.failure()?.errorText || "unknown";
    if (!/ERR_ABORTED/.test(reason)) report.errors.push(`${label}:requestfailed:${request.url()}:${reason}`);
  });
}

async function createDevice(browser, profile, report) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    reducedMotion: "reduce",
  });
  const hasCredentials = Boolean(profile.secret || (profile.username && profile.password));
  await context.addInitScript((entry) => {
    localStorage.setItem("op_board_user_id", String(entry.userId));
    localStorage.setItem("op_board_client_id", entry.clientId);
    localStorage.setItem("op_name", entry.name);
    localStorage.setItem("op_player_name", entry.name);
    localStorage.setItem("op_avatar", String(entry.avatar));
    localStorage.setItem("op_board_story_speed", "3");
    if (entry.secret) {
      localStorage.setItem("opSecret", entry.secret);
      localStorage.setItem("op_secret", entry.secret);
    }
    sessionStorage.clear();
  }, profile);
  const page = await context.newPage();
  if (!hasCredentials && /^https?:\/\/(?:127\.0\.0\.1|localhost)(?::\d+)?(?:\/|$)/i.test(ROOT_URL)) {
    await page.route("**/board_start.html*", async (route) => {
      const response = await route.fetch();
      const html = await response.text();
      const gateStart = html.indexOf('<section class="board-entry" id="boardEntry"');
      const appStart = html.indexOf('<main class="page">', gateStart);
      const body = gateStart >= 0 && appStart > gateStart
        ? `${html.slice(0, gateStart)}${html.slice(appStart)}`
        : html;
      await route.fulfill({ response, body });
    });
  }
  attachDiagnostics(page, report, profile.name);
  await page.goto(`${ROOT_URL}/board_start.html?view=modeSelect&aokiji_lan_qa=${encodeURIComponent(RUN_TOKEN)}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await completeEntryGate(page, profile);
  await page.waitForFunction(() => Boolean(window.BoardShared && window.io), null, { timeout: 20000 });
  const actualIdentity = await page.evaluate(() => ({
    userId: Number(localStorage.getItem("op_board_user_id") || localStorage.getItem("op_user_id") || 0),
    name: String(localStorage.getItem("op_name") || localStorage.getItem("op_player_name") || ""),
  }));
  return {
    ...profile,
    userId: actualIdentity.userId || profile.userId,
    name: actualIdentity.name || profile.name,
    context,
    page,
    report,
  };
}

async function completeEntryGate(page, profile) {
  await page.waitForFunction(() => ["app", "auth", "boot"].includes(String(document.body.dataset.entryStage || "")), null, { timeout: 15000 });
  let stage = await page.evaluate(() => String(document.body.dataset.entryStage || ""));
  if (stage === "app") return;
  if (stage === "boot" && profile.username && profile.password) {
    await page.evaluate(() => document.getElementById("boardBootLoginBtn")?.click());
    await page.waitForFunction(() => document.body.dataset.entryStage === "auth", null, { timeout: 5000 });
    stage = "auth";
  }
  if (stage === "auth" && profile.username && profile.password) {
    await page.fill("#boardAuthUsername", profile.username);
    await page.fill("#boardAuthPassword", profile.password);
    await page.click("#boardAuthSubmitBtn");
    await page.waitForFunction(() => {
      const current = String(document.body.dataset.entryStage || "");
      const errorText = document.getElementById("boardAuthMessage")?.textContent?.trim() || "";
      return current === "app" || Boolean(errorText);
    }, null, { timeout: 20000 });
    stage = await page.evaluate(() => String(document.body.dataset.entryStage || ""));
    if (stage === "app") return;
    const message = await page.textContent("#boardAuthMessage").catch(() => "");
    throw new Error(`Board entry login failed for ${profile.name}: ${String(message || "unknown error").trim()}`);
  }
  throw new Error(
    `Board entry login is required for ${profile.name}. `
    + "Provide BOARD_QA_HOST_SECRET/BOARD_QA_GUEST_SECRET, or the matching BOARD_QA_*_USERNAME and BOARD_QA_*_PASSWORD variables."
  );
}

async function enterRoom(device, roomCode, create = false) {
  const modeSelectActive = await device.page.locator('[data-view="modeSelect"].active').count();
  if (!modeSelectActive) await device.page.click("#openBoardFlowBtn");
  if (create) {
    await device.page.click("#createBoardRoomBtn");
  } else {
    await device.page.fill("#roomCodeInput", roomCode);
    await device.page.click("#joinBoardRoomBtn");
  }
  try {
    await device.page.waitForFunction((expected) => {
      const actual = document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "";
      const active = document.querySelector('[data-view="lobby"]')?.classList.contains("active");
      return Boolean(active && (expected ? actual === expected : /^B[A-Z0-9]+$/.test(actual)));
    }, roomCode, { timeout: 15000 });
  } catch (error) {
    const diagnostics = await device.page.evaluate(() => ({
      entryStage: document.body.dataset.entryStage || "",
      activeView: document.querySelector("[data-view].active")?.getAttribute("data-view") || "",
      roomCode: document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || "",
      toast: document.querySelector(".toast.show,.board-toast.show")?.textContent?.trim() || "",
      debug: window.__BOARD_START_DEBUG__?.getState?.() || null,
    }));
    diagnostics.browserErrors = device.report?.errors || [];
    throw new Error(`${error.message}; diagnostics=${JSON.stringify(diagnostics)}`);
  }
}

async function waitForGameReady(device) {
  await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 30000 });
  await device.page.waitForFunction(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const lan = debug?.boardLanStatus?.();
    return Boolean(debug && lan?.connected && !lan.awaitingInitialState && !lan.applying);
  }, null, { timeout: 30000 });
}

async function skipOpeningStoryIfVisible(page) {
  await page.waitForTimeout(200);
  await page.evaluate(() => document.getElementById("finalEndingSkipBtn")?.click());
  await page.waitForTimeout(180);
}

async function prepareMainGame(hostPage, hostUserId, guestUserId) {
  return hostPage.evaluate(({ requestedHostUserId, requestedGuestUserId }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const players = game.players || [];
    const humans = players.filter((player) => !player.isCPU);
    const cpus = players.filter((player) => player.isCPU);
    const host = humans.find((player) => Number(player.userId || player.id) === Number(requestedHostUserId));
    const guest = humans.find((player) => Number(player.userId || player.id) === Number(requestedGuestUserId));
    if (!host || !guest || humans.length !== 2 || cpus.length !== 2) {
      throw new Error(`Expected 2 humans + 2 CPUs, got humans=${humans.length}, cpus=${cpus.length}`);
    }
    const cards = Array.isArray(window.BoardCards?.cards) ? window.BoardCards.cards : [];
    if (!cards.length) throw new Error("BoardCards.cards is unavailable");
    players.forEach((player, playerIndex) => {
      player.crew = Array.from({ length: 2 }, (_, crewIndex) => {
        const source = cards[(playerIndex * 2 + crewIndex) % cards.length];
        const card = debug.cloneFreshDraftRecruit(source);
        // The receiving client applies save-migration metadata during snapshot load.
        // Seed the current migration marker so this fixture compares story state, not legacy backfill bookkeeping.
        card.lateMoveBackfillVersion = 3;
        card.currentHp = Math.max(1, Number(card.baseStats?.hp || card.maxHp || card.currentHp || 1));
        (card.moveSet || []).forEach((move) => {
          move.currentPP = Math.max(0, Number(move.pp || move.maxPP || 0));
        });
        return card;
      });
      player.activeCrewIndex = 0;
      player.pendingBattle = null;
      player.mainMission = {
        version: 3,
        currentMissionId: "main_001",
        progress: 0,
        target: 3,
        completed: false,
        claimedMissionIds: [],
        stats: {},
      };
      player.impelDown = {
        ...(player.impelDown || {}),
        active: false,
        status: "",
        aokijiFirstCaptureStorySeen: false,
      };
      debug.aokijiCaptureQa.playerState(player);
      debug.getMarinefordView(player);
      debug.recalcPlayerDerivedStats(player);
    });
    game.phase = "main";
    game.round = Math.max(1, Number(game.round || 1));
    game.currentPlayerIndex = players.indexOf(host);
    game.pendingAokijiCaptureStory = null;
    game.pendingMove = null;
    game.routePrompt = null;
    game.islandDecision = null;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.resolutionLock = false;
    game.battleExitLock = false;
    game.turnStep = "擲骰前進";
    state.battleState = null;
    state.boardUiEvent = null;
    debug.closeModal();
    debug.renderAll();
    debug.pushBoardLanState("qa-aokiji-lan-main-ready");
    return {
      hostId: String(host.id || host.userId || ""),
      guestId: String(guest.id || guest.userId || ""),
      cpuIds: cpus.map((player) => String(player.id || player.userId || "")),
      playerCount: players.length,
    };
  }, { requestedHostUserId: hostUserId, requestedGuestUserId: guestUserId });
}

async function waitForPreparedSnapshot(page, prepared) {
  await page.waitForFunction(({ hostId, playerCount }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug?.getState?.().gameState;
    const lan = debug?.boardLanStatus?.();
    return Boolean(
      game
      && lan?.connected
      && !lan.awaitingInitialState
      && !lan.applying
      && game.phase === "main"
      && game.players?.length === playerCount
      && String(game.players?.[game.currentPlayerIndex]?.id || "") === String(hostId)
      && !game.pendingAokijiCaptureStory
    );
  }, prepared, { timeout: 15000 });
}

async function triggerHostWipeout(page, hostId) {
  return page.evaluate((requestedHostId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const player = game.players.find((entry) => String(entry.id || entry.userId || "") === String(requestedHostId));
    if (!player) throw new Error("Host player missing");
    game.currentPlayerIndex = game.players.indexOf(player);
    game.pendingAokijiCaptureStory = null;
    game.resolutionLock = false;
    player.impelDown = {
      ...(player.impelDown || {}),
      active: false,
      status: "",
      aokijiFirstCaptureStorySeen: false,
    };
    (player.crew || []).forEach((card) => {
      card.currentHp = 0;
      (card.moveSet || []).forEach((move) => { move.currentPP = 0; });
    });
    const triggered = debug.aokijiCaptureQa.triggerWipeout(player, "QA 首次全隊瀕死");
    const pending = debug.aokijiCaptureQa.pending();
    const fullyRestored = (player.crew || []).every((card) => (
      Number(card.currentHp || 0) === Math.max(1, Number(card.baseStats?.hp || card.maxHp || 1))
      && (card.moveSet || []).every((move) => Number(move.currentPP || 0) === Math.max(0, Number(move.pp || move.maxPP || 0)))
    ));
    return {
      triggered: Boolean(triggered),
      pending,
      fullyRestored,
      seen: Boolean(player.impelDown?.aokijiFirstCaptureStorySeen),
      inImpelDown: Boolean(player.impelDown?.active),
      resolutionLock: Boolean(game.resolutionLock),
    };
  }, hostId);
}

async function waitForPending(page, expectedPlayerId, expectedPhase = "") {
  await page.waitForFunction(({ playerId, phase }) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug?.getState?.().gameState;
    const pending = game?.pendingAokijiCaptureStory;
    const lan = debug?.boardLanStatus?.();
    return Boolean(
      pending
      && String(pending.playerId || "") === String(playerId)
      && (!phase || String(pending.phase || "") === phase)
      && lan?.connected
      && !lan.applying
    );
  }, { playerId: expectedPlayerId, phase: expectedPhase }, { timeout: 15000 });
}

async function sharedPayload(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const payload = debug.createManualSavePayload();
    delete payload.savedAt;
    (payload.gameState?.players || []).forEach((player) => {
      delete player.isMe;
    });
    return payload;
  });
}

function firstDifference(left, right, path = "$", seen = new Set()) {
  if (Object.is(left, right)) return "";
  if (!left || !right || typeof left !== "object" || typeof right !== "object") {
    return `${path}: ${JSON.stringify(left)} !== ${JSON.stringify(right)}`;
  }
  if (seen.has(left) || seen.has(right)) return "";
  seen.add(left);
  seen.add(right);
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (!isDeepStrictEqual(leftKeys, rightKeys)) {
    return `${path}: keys ${JSON.stringify(leftKeys)} !== ${JSON.stringify(rightKeys)}`;
  }
  for (const key of leftKeys) {
    const difference = firstDifference(left[key], right[key], `${path}.${key}`, seen);
    if (difference) return difference;
  }
  return "";
}

async function advanceHostIntroToChoice(page, hostId) {
  await page.evaluate(() => window.__BOARD_GAME_DEBUG__?.aokijiCaptureQa?.present?.());
  await page.waitForSelector("#finalEndingSkipBtn", { state: "visible", timeout: 10000 });
  await page.click("#finalEndingSkipBtn");
  await waitForPending(page, hostId, "choice");
}

async function inspectChoiceControl(page) {
  await page.evaluate(() => window.__BOARD_GAME_DEBUG__?.aokijiCaptureQa?.present?.());
  await page.waitForSelector("#aokijiCaptureFightBtn", { state: "visible", timeout: 10000 });
  await page.waitForFunction(() => {
    const fight = document.getElementById("aokijiCaptureFightBtn");
    const leave = document.getElementById("aokijiCaptureLeaveBtn");
    const waiting = document.querySelector(".final-ending-inline-choice__waiting");
    return Boolean(fight && leave && ((!fight.disabled && !leave.disabled) || waiting));
  }, null, { timeout: 10000 });
  return page.evaluate(() => ({
    storyId: document.querySelector("#boardModal")?.dataset?.aokijiCaptureStoryId || "",
    phase: document.querySelector("#boardModal")?.dataset?.aokijiCapturePhase || "",
    fightDisabled: Boolean(document.getElementById("aokijiCaptureFightBtn")?.disabled),
    leaveDisabled: Boolean(document.getElementById("aokijiCaptureLeaveBtn")?.disabled),
    watchingText: document.querySelector(".final-ending-inline-choice__waiting")?.textContent?.trim() || "",
    fullscreen: Boolean(document.querySelector("#boardModal")?.classList.contains("final-ending-fullscreen-modal")),
    choiceInsideStoryDialogue: Boolean(document.querySelector(".final-ending-dialogue .final-ending-inline-choices")),
    background: document.querySelector(".final-ending-screen")?.style.getPropertyValue("--ending-bg") || "",
  }));
}

async function attemptUnauthorizedGuestChoice(page) {
  return page.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const before = debug.aokijiCaptureQa.pending();
    const result = debug.aokijiCaptureQa.choose("fight");
    const after = debug.aokijiCaptureQa.pending();
    return { result: Boolean(result), before, after };
  });
}

async function reloadAtChoice(device, hostId) {
  await device.page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
  await waitForGameReady(device);
  await waitForPending(device.page, hostId, "choice");
  const modal = await inspectChoiceControl(device.page);
  const localPlayerId = await device.page.evaluate(() => String(window.__BOARD_GAME_DEBUG__?.getLocalBoardPlayer?.()?.id || ""));
  return { modal, localPlayerId };
}

async function chooseLeaveAndFinish(page, hostId) {
  await page.click("#aokijiCaptureLeaveBtn");
  await waitForPending(page, hostId, "leave-response");
  await page.evaluate(() => window.__BOARD_GAME_DEBUG__?.aokijiCaptureQa?.present?.());
  await page.waitForSelector("#finalEndingSkipBtn", { state: "visible", timeout: 10000 });
  await page.click("#finalEndingSkipBtn");
  await page.waitForFunction((playerId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug?.getState?.().gameState;
    const player = game?.players?.find((entry) => String(entry.id || entry.userId || "") === String(playerId));
    return Boolean(
      game
      && !game.pendingAokijiCaptureStory
      && player?.impelDown?.aokijiFirstCaptureStorySeen
      && !player?.impelDown?.active
      && !game.resolutionLock
    );
  }, hostId, { timeout: 15000 });
}

async function releasedPlayerSnapshot(page, playerId) {
  return page.evaluate((requestedPlayerId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const game = debug.getState().gameState;
    const player = game.players.find((entry) => String(entry.id || entry.userId || "") === String(requestedPlayerId));
    return {
      pending: game.pendingAokijiCaptureStory || null,
      seen: Boolean(player?.impelDown?.aokijiFirstCaptureStorySeen),
      inImpelDown: Boolean(player?.impelDown?.active),
      resolutionLock: Boolean(game.resolutionLock),
      currentPlayerId: String(game.players?.[game.currentPlayerIndex]?.id || ""),
    };
  }, playerId);
}

async function triggerCpuWipeoutAndObserveAutomaticLeave(page, cpuId) {
  return page.evaluate(async (requestedCpuId) => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const state = debug.getState();
    const game = state.gameState;
    const cpu = game.players.find((entry) => String(entry.id || entry.userId || "") === String(requestedCpuId));
    if (!cpu || !cpu.isCPU) throw new Error("Requested CPU player missing");
    game.currentPlayerIndex = game.players.indexOf(cpu);
    game.pendingAokijiCaptureStory = null;
    game.pendingMove = null;
    game.routePrompt = null;
    game.islandDecision = null;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.resolutionLock = false;
    game.turnStep = "擲骰前進";
    state.battleState = null;
    cpu.pendingBattle = null;
    cpu.impelDown = {
      ...(cpu.impelDown || {}),
      active: false,
      status: "",
      aokijiFirstCaptureStorySeen: false,
    };
    (cpu.crew || []).forEach((card) => {
      card.currentHp = 0;
      (card.moveSet || []).forEach((move) => { move.currentPP = 0; });
    });
    debug.closeModal();
    const triggered = debug.aokijiCaptureQa.triggerWipeout(cpu, "QA CPU 首次全隊瀕死");
    return new Promise((resolve, reject) => {
      const startedAt = Date.now();
      const probe = () => {
        const currentGame = debug.getState().gameState;
        const currentCpu = currentGame.players.find((entry) => String(entry.id || entry.userId || "") === String(requestedCpuId));
        const pending = currentGame.pendingAokijiCaptureStory;
        if (!pending && currentCpu?.impelDown?.aokijiFirstCaptureStorySeen) {
          const log = (currentGame.log || []).map(String);
          resolve({
            triggered: Boolean(triggered),
            pending: null,
            seen: true,
            inImpelDown: Boolean(currentCpu.impelDown?.active),
            resolutionLock: Boolean(currentGame.resolutionLock),
            turnStep: String(currentGame.turnStep || ""),
            currentPlayerId: String(currentGame.players?.[currentGame.currentPlayerIndex]?.id || ""),
            autoLeaveLogged: log.some((entry) => entry.includes("代理 CPU 接受青雉放行")),
          });
          return;
        }
        if (Date.now() - startedAt > 5000) {
          reject(new Error(`CPU automatic Aokiji release timed out: ${JSON.stringify({ pending, seen: currentCpu?.impelDown?.aokijiFirstCaptureStorySeen, resolutionLock: currentGame.resolutionLock, turnStep: currentGame.turnStep })}`));
          return;
        }
        setTimeout(probe, 5);
      };
      setTimeout(probe, 0);
    });
  }, cpuId);
}

(async () => {
  const report = {
    title: "Aokiji first-capture 2P2CPU LAN QA",
    runToken: RUN_TOKEN,
    rootUrl: ROOT_URL,
    roomCode: "",
    lobby: null,
    initialTrigger: null,
    pendingFullSnapshotMatch: false,
    pendingFullSnapshotDifference: "",
    guestChoiceView: null,
    guestUnauthorizedChoice: null,
    refreshChoice: null,
    released: null,
    releasedFullSnapshotMatch: false,
    releasedFullSnapshotDifference: "",
    cpuAutomaticLeave: null,
    errors: [],
    failures: [],
  };
  const launchOptions = {
    headless: true,
    args: ["--disable-features=LocalNetworkAccessChecks,PrivateNetworkAccessRespectPreflightResults"],
  };
  if (CHROME_PATH && fs.existsSync(CHROME_PATH)) launchOptions.executablePath = CHROME_PATH;
  const browser = await chromium.launch(launchOptions);
  let host;
  let guest;
  try {
    host = await createDevice(browser, PROFILES.host, report);
    guest = await createDevice(browser, PROFILES.guest, report);
    await enterRoom(host, "", true);
    report.roomCode = String(await host.page.textContent("#boardLobbyRoomCode")).trim();
    await enterRoom(guest, report.roomCode, false);
    await guest.page.click("#boardReadyBtn");
    await host.page.click("#boardAddCpuBtn");
    await host.page.click("#boardAddCpuBtn");
    await host.page.waitForFunction(() => document.querySelectorAll(".seat-tag.cpu").length === 2, null, { timeout: 10000 });
    report.lobby = await host.page.evaluate(() => ({
      playerCount: document.querySelectorAll("#boardLobbyPlayerGrid .seat-card:not(.empty)").length,
      cpuCount: document.querySelectorAll("#boardLobbyPlayerGrid .seat-card.cpu").length,
    }));
    if (report.lobby.playerCount !== 4 || report.lobby.cpuCount !== 2) {
      addFailure(report, `Lobby composition mismatch: ${JSON.stringify(report.lobby)}`);
    }

    await host.page.click("#boardStartBtn");
    await Promise.all([waitForGameReady(host), waitForGameReady(guest)]);
    await Promise.all([skipOpeningStoryIfVisible(host.page), skipOpeningStoryIfVisible(guest.page)]);

    const prepared = await prepareMainGame(host.page, host.userId, guest.userId);
    await Promise.all([waitForPreparedSnapshot(host.page, prepared), waitForPreparedSnapshot(guest.page, prepared)]);
    // Reload the controller once so both browsers compare the same post-migration full snapshot shape.
    await host.page.reload({ waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForGameReady(host);
    await skipOpeningStoryIfVisible(host.page);
    await Promise.all([waitForPreparedSnapshot(host.page, prepared), waitForPreparedSnapshot(guest.page, prepared)]);

    report.initialTrigger = await triggerHostWipeout(host.page, prepared.hostId);
    if (!report.initialTrigger.triggered || !report.initialTrigger.pending || !report.initialTrigger.fullyRestored) {
      addFailure(report, `Host wipeout did not stage a fully restored Aokiji story: ${JSON.stringify(report.initialTrigger)}`);
    }
    if (!report.initialTrigger.seen || report.initialTrigger.inImpelDown || !report.initialTrigger.resolutionLock) {
      addFailure(report, `Host first-capture flags are incorrect: ${JSON.stringify(report.initialTrigger)}`);
    }
    await Promise.all([
      waitForPending(host.page, prepared.hostId, "intro"),
      waitForPending(guest.page, prepared.hostId, "intro"),
    ]);

    const pendingHostPayload = await sharedPayload(host.page);
    const pendingGuestPayload = await sharedPayload(guest.page);
    report.pendingFullSnapshotMatch = isDeepStrictEqual(pendingHostPayload, pendingGuestPayload);
    report.pendingFullSnapshotDifference = report.pendingFullSnapshotMatch ? "" : firstDifference(pendingHostPayload, pendingGuestPayload);
    if (!report.pendingFullSnapshotMatch) {
      addFailure(report, `Guest did not receive the same full pending snapshot: ${report.pendingFullSnapshotDifference}`);
    }

    await advanceHostIntroToChoice(host.page, prepared.hostId);
    await waitForPending(guest.page, prepared.hostId, "choice");
    report.guestChoiceView = await inspectChoiceControl(guest.page);
    if (!report.guestChoiceView.fightDisabled
      || !report.guestChoiceView.leaveDisabled
      || !report.guestChoiceView.watchingText
      || !report.guestChoiceView.fullscreen
      || !report.guestChoiceView.choiceInsideStoryDialogue
      || !report.guestChoiceView.background.includes("aokiji_capture_bicycle_sea_story_v1.webp")) {
      addFailure(report, `Guest choice modal is not spectator-only: ${JSON.stringify(report.guestChoiceView)}`);
    }
    report.guestUnauthorizedChoice = await attemptUnauthorizedGuestChoice(guest.page);
    if (report.guestUnauthorizedChoice.result || !isDeepStrictEqual(report.guestUnauthorizedChoice.before, report.guestUnauthorizedChoice.after)) {
      addFailure(report, `Guest mutated the Aokiji choice: ${JSON.stringify(report.guestUnauthorizedChoice)}`);
    }
    await host.page.waitForTimeout(350);
    const hostChoiceAfterGuestAttempt = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__?.aokijiCaptureQa?.pending?.());
    if (hostChoiceAfterGuestAttempt?.phase !== "choice" || hostChoiceAfterGuestAttempt?.choice) {
      addFailure(report, `Guest attempt reached host state: ${JSON.stringify(hostChoiceAfterGuestAttempt)}`);
    }

    report.refreshChoice = await reloadAtChoice(host, prepared.hostId);
    if (report.refreshChoice.localPlayerId !== prepared.hostId
      || report.refreshChoice.modal.phase !== "choice"
      || report.refreshChoice.modal.fightDisabled
      || report.refreshChoice.modal.leaveDisabled
      || !report.refreshChoice.modal.fullscreen
      || !report.refreshChoice.modal.choiceInsideStoryDialogue
      || !report.refreshChoice.modal.background.includes("aokiji_capture_bicycle_sea_story_v1.webp")) {
      addFailure(report, `Host refresh did not restore controllable choice: ${JSON.stringify(report.refreshChoice)}`);
    }

    await chooseLeaveAndFinish(host.page, prepared.hostId);
    await guest.page.waitForFunction((playerId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.().gameState;
      const player = game?.players?.find((entry) => String(entry.id || entry.userId || "") === String(playerId));
      return Boolean(!game?.pendingAokijiCaptureStory && player?.impelDown?.aokijiFirstCaptureStorySeen && !player?.impelDown?.active && !debug?.boardLanStatus?.().applying);
    }, prepared.hostId, { timeout: 15000 });
    const releasedHost = await releasedPlayerSnapshot(host.page, prepared.hostId);
    const releasedGuest = await releasedPlayerSnapshot(guest.page, prepared.hostId);
    report.released = { host: releasedHost, guest: releasedGuest };
    if (!isDeepStrictEqual(releasedHost, releasedGuest) || releasedHost.pending || !releasedHost.seen || releasedHost.inImpelDown) {
      addFailure(report, `Leave outcome is inconsistent: ${JSON.stringify(report.released)}`);
    }
    const releasedHostPayload = await sharedPayload(host.page);
    const releasedGuestPayload = await sharedPayload(guest.page);
    report.releasedFullSnapshotMatch = isDeepStrictEqual(releasedHostPayload, releasedGuestPayload);
    report.releasedFullSnapshotDifference = report.releasedFullSnapshotMatch ? "" : firstDifference(releasedHostPayload, releasedGuestPayload);
    if (!report.releasedFullSnapshotMatch) {
      addFailure(report, `Guest did not receive the same full released snapshot: ${report.releasedFullSnapshotDifference}`);
    }

    const cpuId = prepared.cpuIds[prepared.cpuIds.length - 1];
    report.cpuAutomaticLeave = await triggerCpuWipeoutAndObserveAutomaticLeave(host.page, cpuId);
    if (!report.cpuAutomaticLeave.triggered
      || !report.cpuAutomaticLeave.seen
      || report.cpuAutomaticLeave.inImpelDown
      || report.cpuAutomaticLeave.resolutionLock
      || report.cpuAutomaticLeave.pending
      || !report.cpuAutomaticLeave.autoLeaveLogged) {
      addFailure(report, `CPU did not automatically leave without a story lock: ${JSON.stringify(report.cpuAutomaticLeave)}`);
    }
    await guest.page.waitForFunction((playerId) => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const game = debug?.getState?.().gameState;
      const player = game?.players?.find((entry) => String(entry.id || entry.userId || "") === String(playerId));
      return Boolean(!game?.pendingAokijiCaptureStory && player?.impelDown?.aokijiFirstCaptureStorySeen && !player?.impelDown?.active && !debug?.boardLanStatus?.().applying);
    }, cpuId, { timeout: 15000 });

    if (report.errors.length) addFailure(report, `Browser diagnostics reported ${report.errors.length} error(s)`);
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.failures.length ? 1 : 0;
  } finally {
    await Promise.allSettled([host?.context?.close(), guest?.context?.close()]);
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
