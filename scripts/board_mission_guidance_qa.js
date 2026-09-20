const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const rootUrl = process.env.BOARD_QA_URL || "http://127.0.0.1:18920";
const outputDir = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-quality-20260920/mission";

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
  const results = [];
  const errors = [];
  try {
    for (const viewport of [{ width: 1600, height: 900 }, { width: 932, height: 430 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      page.on("pageerror", (error) => errors.push(error.message));
      await page.goto(`${rootUrl}/board_game.html?mission_guidance_qa=1`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.mainMissionQa?.commissionGrade && window.BoardCards?.cards?.length);
      const checks = await page.evaluate(() => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const qa = debug.mainMissionQa;
        const state = debug.getState();
        const game = state.gameState;
        const player = game.players[0];
        const missions = qa.definitions();
        const checks = [];
        const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
        game.phase = "main";
        game.currentPlayerIndex = 0;
        game.turnStep = "roll";
        game.resolutionLock = false;
        player.isCPU = player.isCpu = player.cpu = false;
        player.crew = window.BoardCards.cards.slice(0, 4).map((card) => debug.cloneCard(card));
        player.activeCrewIndex = 0;
        debug.recalcPlayerDerivedStats(player);
        const setMain = (order) => {
          player.mainMission = { currentMissionId: missions[order - 1].id, progress: 0, target: 1, completed: false, claimedMissionIds: missions.slice(0, order - 1).map((mission) => mission.id), stats: {} };
          qa.normalize(player);
        };
        const island = { id: "qa-mission-island", name: "任務島", kind: "mission" };
        const byId = (id) => window.BOARD_MISSIONS.find((mission) => mission.id === id);
        for (const [order, grade] of [[83, "A"], [89, "S"]]) {
          setMain(order);
          player.activeMissions = [];
          player.activeMission = null;
          player.completedMissionIds = [];
          player.bounty = 2999999999;
          check(qa.commissionGuidance(player).includes("需懸賞 30億"), `${grade}: visible locked threshold`);
          check(!qa.buildChoices(player, island, 4).some((id) => ["A", "S"].includes(byId(id).grade)), `${grade}: below threshold stays locked`);
          check(!qa.acceptCommission(player, window.BOARD_MISSIONS.find((mission) => mission.grade === grade).id).ok, `${grade}: cannot bypass gate`);
          player.bounty = 3000000000;
          for (let seed = 0; seed < 60; seed += 1) {
            const choices = qa.buildChoices(player, island, seed);
            check(choices.length === 4 && new Set(choices).size === 4 && choices.some((id) => byId(id).grade === grade), `${grade}: eligible reserved slot seed ${seed}`);
            check(choices.every((id) => !byId(id).postgameOnly), `${grade}: postgame commissions excluded seed ${seed}`);
          }
          const choices = qa.buildChoices(player, island, 77);
          check(JSON.stringify(choices) === JSON.stringify(qa.buildChoices(player, island, 77)), `${grade}: deterministic choices`);
          const activeId = "e_shop_visit";
          player.activeMissions = [{ missionId: activeId, progress: 0, target: 1, completed: false }];
          player.activeMission = null;
          player.missionBoardChoices = { islandId: island.id, choices: [activeId, "e_hospital_visit", "e_tavern_visit", "e_chest"], acceptedThisVisit: 1, visitRound: game.round, refreshed: true };
          const resumed = qa.ensureChoices(player, island);
          check(resumed.includes(activeId) && resumed.some((id) => byId(id).grade === grade), `${grade}: existing board fills slot and keeps accepted mission`);
          check(player.missionBoardChoices.acceptedThisVisit === 1 && player.missionBoardChoices.refreshed, `${grade}: visit limits preserved`);
          const saved = JSON.stringify(player.missionBoardChoices);
          player.missionBoardChoices = JSON.parse(saved);
          check(JSON.stringify(qa.ensureChoices(player, island)) === JSON.stringify(resumed), `${grade}: serialized choice restoration stable`);
          player.activeMissions = ["e_shop_visit", "e_hospital_visit", "e_tavern_visit", "e_chest"].map((missionId) => ({ missionId, progress: 0, target: 1, completed: false }));
          player.activeMission = null;
          player.missionBoardChoices.choices = player.activeMissions.map((entry) => entry.missionId);
          const oldAcceptedIds = player.activeMissions.map((entry) => entry.missionId).join(",");
          check(qa.ensureChoices(player, island).some((id) => byId(id).grade === grade) && player.activeMissions.map((entry) => entry.missionId).join(",") === oldAcceptedIds, `${grade}: fully accepted saved wall reserves slot without dropping accepted quests`);
        }
        check(missions[81].condition.includes("30億") && missions[87].condition.includes("30億"), "unlock guidance precedes chapters 83 and 89");
        setMain(83);
        player.activeMissions = [];
        player.activeMission = null;
        player.completedMissionIds = [];
        player.missionBoardChoices = null;
        player.bounty = 3000000000;
        player.coins = 100000;
        qa.openBoard(player, island, {});
        check(document.querySelectorAll(".mission-mainline-guidance").length > 0, "mission wall guidance rendered");
        check(document.querySelectorAll(".mainline-tag").length > 0, "reserved grade visibly marked");
        window.__missionGuidanceFixture = { island, setMain, checks };
        return checks;
      });
      await page.screenshot({ path: path.join(outputDir, `mission-wall-${viewport.width}x${viewport.height}.png`), fullPage: true });
      const layout = await page.evaluate(() => {
        const note = document.querySelector(".mission-mainline-guidance");
        const rect = note.getBoundingClientRect();
        const toolbar = document.querySelector(".board-toolbar").getBoundingClientRect();
        const overlapsToolbar = rect.left < toolbar.right && rect.right > toolbar.left && rect.top < toolbar.bottom && rect.bottom > toolbar.top;
        return { noteFits: note.scrollWidth <= note.clientWidth + 1, noteInViewport: rect.left >= -1 && rect.right <= innerWidth + 1, overlapsToolbar, text: note.textContent };
      });
      if (!layout.noteFits || !layout.noteInViewport || layout.overlapsToolbar) errors.push(`${viewport.width}: mission wall guidance clips or overlaps toolbar`);
      await page.evaluate(() => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const player = debug.getState().gameState.players[0];
        player.bounty = 2000000000;
        debug.openMissionJournalModal(player);
      });
      await page.screenshot({ path: path.join(outputDir, `mission-locked-journal-${viewport.width}x${viewport.height}.png`), fullPage: true });
      const journalLayout = await page.evaluate(() => {
        const note = document.querySelector(".mission-journal-detail-copy .mission-mainline-guidance");
        const copy = document.querySelector(".mission-journal-detail-copy");
        const style = getComputedStyle(copy);
        return { gateVisible: note?.textContent?.includes("目前 20億"), readable: copy.scrollHeight <= copy.clientHeight + 1 || ["auto", "scroll"].includes(style.overflowY) };
      });
      if (!journalLayout.gateVisible || !journalLayout.readable) errors.push(`${viewport.width}: journal unlock guidance inaccessible`);
      await page.evaluate(() => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const player = debug.getState().gameState.players[0];
        player.bounty = 3000000000;
        debug.mainMissionQa.openBoard(player, window.__missionGuidanceFixture.island, {});
      });
      const notificationChecks = await page.evaluate(() => {
        const debug = window.__BOARD_GAME_DEBUG__;
        const qa = debug.mainMissionQa;
        const player = debug.getState().gameState.players[0];
        const checks = [];
        const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
        const fixture = window.__missionGuidanceFixture;
        const aId = player.missionBoardChoices.choices.find((id) => window.BOARD_MISSIONS.find((mission) => mission.id === id)?.grade === "A");
        const before = { coins: player.coins, bounty: player.bounty };
        check(qa.acceptCommission(player, aId, fixture.island).ok && player.mainMission.completed, "accepting reserved A commission completes chapter 83");
        check(player.coins === before.coins && player.bounty === before.bounty, "completion notification does not grant rewards");
        check(document.querySelector("[data-mission-toast-title]").textContent.includes("主線完成"), "main completion toast appears");
        player.activeMissions = [{ missionId: "e_sea_tiles", progress: 1, target: 2, completed: false }, { missionId: "c_mid_route", progress: 2, target: 3, completed: false }];
        player.activeMission = null;
        qa.recordCommission(player, { type: "sea_step" });
        check(qa.toastQueue().queued.length === 2, "simultaneous side completions queue behind main completion");
        qa.recordCommission(player, { type: "sea_step" });
        check(qa.toastQueue().queued.length === 2, "repeated events do not repeat completed notifications");
        const queue = JSON.stringify(qa.toastQueue());
        player.isCPU = true;
        qa.showCompleteToast(window.BOARD_MISSIONS.find((mission) => mission.id === "e_chest"), player);
        player.isCPU = false;
        check(JSON.stringify(qa.toastQueue()) === queue, "CPU completion does not notify the human viewer");
        check(qa.claimableCount(player) === 3, "main and side ready rewards counted together");
        const completedSnapshot = JSON.parse(JSON.stringify(player));
        const priorSnapshot = JSON.parse(JSON.stringify(player));
        priorSnapshot.mainMission.completed = false;
        priorSnapshot.activeMissions.forEach((entry) => { entry.completed = false; });
        check(qa.newlyCompleted(priorSnapshot, completedSnapshot).length === 3, "remote false-to-true detects local main and side completions");
        check(qa.newlyCompleted(completedSnapshot, completedSnapshot).length === 0, "identical snapshot produces no repeated notification");
        check(qa.newlyCompleted(null, completedSnapshot).length === 0, "initial or reconnect baseline is silent");
        check(qa.newlyCompleted(priorSnapshot, { ...completedSnapshot, id: "other-player" }).length === 0, "other identity cannot trigger local completion transition");
        debug.openMissionJournalModal(player);
        check(document.querySelector(".mission-journal-primary-action button:not([disabled])"), "completed main reward available in journal");
        const payload = debug.createManualSavePayload();
        check(!JSON.stringify(payload.gameState).includes("missionCompleteToastQueue"), "notification queue excluded from saved game");
        const stableQueue = JSON.stringify(qa.toastQueue());
        debug.loadManualGame(payload, { source: "lan", silent: true });
        check(JSON.stringify(qa.toastQueue()) === stableQueue, "remote state restoration does not replay notifications");
        return checks;
      });
      await page.waitForTimeout(300);
      const toastLayout = await page.evaluate(() => {
        const toast = document.querySelector("#missionCompleteToast");
        const rect = toast.getBoundingClientRect();
        return { visible: getComputedStyle(toast).opacity === "1", aboveModal: Number(getComputedStyle(toast).zIndex) > Number(getComputedStyle(document.querySelector("#boardModalBack")).zIndex), fits: rect.left >= 0 && rect.right <= innerWidth && toast.scrollWidth <= toast.clientWidth + 1 };
      });
      if (!toastLayout.visible || !toastLayout.aboveModal || !toastLayout.fits) errors.push(`${viewport.width}: mission toast layout failed ${JSON.stringify(toastLayout)}`);
      await page.screenshot({ path: path.join(outputDir, `mission-complete-${viewport.width}x${viewport.height}.png`), fullPage: true });
      await page.waitForTimeout(5100);
      const nextToast = await page.locator("[data-mission-toast-title]").textContent();
      if (!nextToast.includes("海格巡航")) errors.push(`${viewport.width}: first queued side toast did not play: ${nextToast}`);
      results.push({ viewport, count: checks.length + notificationChecks.length + 3, layout, nextToast, checks: [...checks, ...notificationChecks] });
      await context.close();
    }
    // Reuse the reconnect suite's server fixture while exercising the real
    // BOARD_GAME_STATE receiver, version handling and asynchronous apply path.
    const reconnectSource = fs.readFileSync(path.join(__dirname, "board_reconnect_client_qa.js"), "utf8");
    const fixtureStart = reconnectSource.indexOf("function socketMockSource()");
    const fixtureEnd = reconnectSource.indexOf("(async () =>", fixtureStart);
    const socketSource = new Function(`${reconnectSource.slice(fixtureStart, fixtureEnd)}; return socketMockSource();`)();
    const remoteContext = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await remoteContext.addInitScript(() => {
      localStorage.setItem("op_board_user_id", "990401");
      localStorage.setItem("op_board_client_id", "qa-reconnect-host");
      localStorage.setItem("op_name", "任務同步測試");
    });
    const remotePage = await remoteContext.newPage();
    remotePage.on("pageerror", (error) => errors.push(error.message));
    await remotePage.route(/\/(?:socket\.io\/socket\.io\.js|vendor\/socket\.io-client\/[^/]+\/socket\.io\.min\.js)(?:\?.*)?$/, (route) => route.fulfill({ status: 200, contentType: "application/javascript", body: socketSource }));
    await remotePage.goto(`${rootUrl}/board_game.html?room=BRECONNECT&online=1&skipOpeningStory=1`, { waitUntil: "domcontentloaded" });
    await remotePage.waitForFunction(() => {
      const lan = window.__BOARD_GAME_DEBUG__?.boardLanStatus();
      return lan?.connected && !lan.awaitingInitialState && !lan.applying;
    });
    const remoteChecks = await remotePage.evaluate(async () => {
      const debug = window.__BOARD_GAME_DEBUG__;
      const qa = debug.mainMissionQa;
      const socket = window.__qaSocket;
      const checks = [];
      const check = (ok, label) => { if (!ok) throw new Error(label); checks.push(label); };
      check(!qa.toastQueue().active && !qa.toastQueue().queued.length, "initial live receiver restore is silent");
      const player = debug.getState().gameState.players.find((entry) => Number(entry.userId || entry.id) === 990401);
      player.isCPU = player.isCpu = player.cpu = false;
      const definitions = qa.definitions();
      player.mainMission = { currentMissionId: "main_083", completed: false, progress: 0, target: 1, stats: {}, claimedMissionIds: definitions.slice(0, 82).map((mission) => mission.id) };
      player.activeMissions = [{ missionId: "e_sea_tiles", progress: 1, target: 2, completed: false }];
      player.activeMission = null;
      player.completedMissionIds = [];
      const payload = debug.createManualSavePayload();
      payload.boardUiEvent = null;
      const incoming = payload.gameState.players.find((entry) => String(entry.id) === String(player.id));
      incoming.mainMission.completed = true;
      incoming.mainMission.progress = 1;
      incoming.activeMissions[0].completed = true;
      incoming.activeMissions[0].progress = 2;
      incoming.activeMission = incoming.activeMissions[0];
      const send = async () => {
        socket.serverVersion = Math.max(socket.serverVersion, debug.boardLanStatus().version) + 1;
        socket.serverPayload = structuredClone(payload);
        socket.fire("BOARD_GAME_STATE", { roomCode: "BRECONNECT", payload: structuredClone(payload), version: socket.serverVersion, sourceClientId: "qa-remote-authority", reason: "qa-mission-complete" });
        await new Promise((resolve) => setTimeout(resolve, 400));
      };
      await send();
      check(qa.toastQueue().active.endsWith(":main_083") && qa.toastQueue().queued.some((key) => key.endsWith(":e_sea_tiles")), "remote authority triggers local main and side completion notifications");
      const queue = JSON.stringify(qa.toastQueue());
      await send();
      check(JSON.stringify(qa.toastQueue()) === queue, "newer identical remote snapshot does not duplicate notifications");
      socket.disconnectForQa();
      socket.reconnectForQa();
      await new Promise((resolve) => setTimeout(resolve, 400));
      check(JSON.stringify(qa.toastQueue()) === queue, "reconnect snapshot does not replay notifications");
      return checks;
    });
    results.push({ scenario: "remote-state-receiver", count: remoteChecks.length, checks: remoteChecks });
    await remoteContext.close();
  } finally {
    await browser.close();
  }
  const report = { ok: !errors.length, count: results.reduce((total, result) => total + result.count, 0), errors, results };
  fs.writeFileSync(path.join(outputDir, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ok: report.ok, count: report.count, errors, outputDir }));
  if (errors.length) process.exitCode = 1;
}

main().catch((error) => { console.error(error.stack || error); process.exitCode = 1; });
