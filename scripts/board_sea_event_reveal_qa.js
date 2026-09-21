"use strict";

// Disposable localhost rooms and isolated browser contexts only. The test hook is
// injected into the browser response, never into a production file or saved game.
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright");
const ROOT = path.resolve(__dirname, "..");
const URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18924";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new global.URL(URL).hostname)) throw new Error("Sea reveal QA is localhost only");
const OUTPUT = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-sea-event-reveal-20260921";
const CHROME = process.env.BOARD_QA_CHROME || "C:/Users/王曜瑋/AppData/Local/ms-playwright/chromium-1193/chrome-win/chrome.exe";
const ALLOW_MISSING_ART = process.env.BOARD_QA_ALLOW_MISSING_ART === "1";
const report = { startedAt: new Date().toISOString(), url: URL, allowMissingArt: ALLOW_MISSING_ART, checks: [], cases: [], errors: [], missingArt: [] };
fs.mkdirSync(OUTPUT, { recursive: true });
function check(name, ok, detail) { report.checks.push({ name, ok: !!ok, detail }); if (!ok) console.error("FAIL", name, JSON.stringify(detail)); }
function save() { fs.writeFileSync(path.join(OUTPUT, "sea-event-reveal-report.json"), JSON.stringify(report, null, 2) + "\n"); }

const source = fs.readFileSync(path.join(ROOT, "public/js/board_game.js"), "utf8");
const anchor = "window.__BOARD_GAME_DEBUG__ = {";
if (source.split(anchor).length !== 2) throw new Error("Production debug export anchor changed");
const hookedSource = source.replace(anchor, `${anchor}\n seaRevealQa: {
  definitions: () => Object.entries(SEA_CARD_EFFECTS).flatMap(([type, entries]) => entries.map((entry,index) => ({type,index,title:entry.title}))),
  definition: (type,index) => SEA_CARD_EFFECTS[type][index],
  openChoice: openSeaEventChoice, trigger: triggerSeaEvent, draw: drawSeaCardEffect,
  resolveChest: resolveSeaTreasureChestChoice, chestTypes: SEA_TREASURE_CHEST_TYPES,
  item: gameItemDef, applyWood: applySeaWoodChestTrap,
  seedRng: createRng,
 },`);

async function device(browser, suffix) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  await context.addInitScript(({ id, name }) => {
    localStorage.setItem("op_board_user_id", id);
    localStorage.setItem("op_board_client_id", `qa-sea-reveal-${id}`);
    localStorage.setItem("op_name", name);
    localStorage.setItem("op_player_name", name);
    localStorage.setItem("op_board_story_speed", "3");
  }, { id: suffix === "host" ? "892101" : "892102", name: suffix === "host" ? "海域圖像房主" : "海域觀看玩家" });
  await context.route("**/js/board_game.js*", route => route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: hookedSource }));
  const page = await context.newPage();
  page.on("pageerror", error => report.errors.push({ device: suffix, message: error.message, stack: error.stack }));
  page.on("response", response => {
    if (response.status() >= 400 && /sea_event_reveal/.test(response.url()) && !/qa-sea-art-missing\.webp/.test(response.url())) report.missingArt.push({ status: response.status(), url: response.url() });
  });
  await page.goto(`${URL}/board_start.html?sea_reveal_qa=${suffix}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 30000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", suffix === "host" ? "海域圖像房主" : "海域觀看玩家");
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app");
  await page.click("#openBoardFlowBtn");
  return { context, page };
}

async function prepare(page) {
  return page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState;
    g.phase = "main"; g.currentPlayerIndex = g.players.findIndex(p => String(p.id) === String(d.getLocalBoardPlayer().id));
    g.seed = 2092101; g.pendingMove = null; g.routePrompt = null; g.islandDecision = null;
    g.resolutionLock = false; g.movementAnimating = false; g.diceRolling = false; g.pendingMoveLearnQueue = [];
    g.battleExitLock = false; g.coopBattlePrompt = null; g.tradePrompt = null; g.activeTrade = null; g.turnStep = "停靠結算";
    s.battleState = null; s.boardUiEvent = null;
    const p = d.getCurrentPlayer();
    p.crew = window.BoardCards.cards.slice(0, 3).map(c => d.cloneFreshDraftRecruit(c)); p.activeCrewIndex = 0;
    d.recalcPlayerDerivedStats(p);
    p.coins = 100000; p.bounty = 10000000000; p.nextDiceModifier = 0; p.inventory = { items: {}, equipped: {} }; p.items = [];
    p.crew.forEach(c => { c.currentHp = Math.max(1, Math.floor(c.baseStats.hp * 0.4)); c.moveSet.forEach(m => { m.currentPP = Math.floor(m.pp * 0.4); }); });
    const tile = g.boardData.seaTiles.find(t => t.zone === "safe"); tile.primaryTypeId = "money";
    const route = d.getRouteById(tile.routeId);
    p.location = { kind: "route", routeId: tile.routeId, tileIndex: tile.index, fromIslandId: route.from, toIslandId: route.to };
    window.__seaQaBaseline = structuredClone({ game: g, playerIndex: g.currentPlayerIndex, tileId: tile.id });
    d.closeModal(); d.renderAll(); d.pushBoardLanState("qa-sea-reveal-prepared");
    return { tileId: tile.id, version: d.boardLanStatus().version, playerId: p.id };
  });
}

async function reset(page) {
  await page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState();
    s.gameState = structuredClone(window.__seaQaBaseline.game); s.battleState = null; s.boardUiEvent = null;
    d.closeModal();
  });
}

async function readReveal(page) {
  return page.evaluate(() => {
    const scene = document.querySelector("#boardModal [data-sea-art-key]");
    const root = document.querySelector("#boardModal .sea-reveal");
    return {
      key: scene?.dataset.seaArtKey, variant: scene?.dataset.seaArtVariant,
      image: scene?.querySelector("img")?.getAttribute("src"),
      title: root?.querySelector("h3")?.textContent,
      outcomes: [...document.querySelectorAll("#boardModal .sea-reveal-outcome")].map(n => ({ text: n.textContent.replace(/\s+/g, " ").trim(), itemId: n.dataset.itemId || "", image: n.querySelector("img")?.getAttribute("src") || "" })),
      chest: root?.querySelector(".sea-reveal-chest")?.getAttribute("src") || "",
      buttons: [...document.querySelectorAll("#boardModal button")].map(n => ({ id: n.id, text: n.textContent.trim(), disabled: n.disabled })),
      modalClass: document.querySelector("#boardModal")?.className,
    };
  });
}

async function pairedReveal(host, guest, label, event) {
  check(`${label}: event includes visual`, !!event?.detail?.visual, event?.detail);
  await guest.waitForFunction(id => document.getElementById("boardModalBack")?.dataset.boardUiEventId === id, event?.id, { timeout: 15000 });
  const owner = await readReveal(host), viewer = await readReveal(guest);
  check(`${label}: owner illustration`, !!owner.key && !!owner.image, owner);
  check(`${label}: same visual`, owner.key === viewer.key && owner.variant === viewer.variant && owner.image === viewer.image, { owner, viewer });
  check(`${label}: same actual outcomes`, JSON.stringify(owner.outcomes) === JSON.stringify(viewer.outcomes) && owner.outcomes.length > 0, { owner: owner.outcomes, viewer: viewer.outcomes });
  check(`${label}: spectator read-only`, viewer.buttons.length === 1 && viewer.buttons[0].id === "spectatorModalCloseBtn", viewer.buttons);
  report.cases.push({ label, eventId: event?.id, owner, viewer });
  return { owner, viewer };
}

async function layout(page, label) {
  await page.waitForFunction(() => !document.getElementById("missionCompleteToast")?.classList.contains("show"), null, { timeout: 20000 });
  const evidence = await page.evaluate(async () => {
    await Promise.all([...document.querySelectorAll("#boardModal img")].map(img => img.decode().catch(() => {})));
    const box = node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }; };
    const modal = document.querySelector("#boardModal"), root = modal.querySelector(".sea-reveal"), buttons = [...modal.querySelectorAll("button")];
    return { viewport: { width: innerWidth, height: innerHeight }, modal: box(modal), root: root && box(root), buttons: buttons.map(box), overflow: document.documentElement.scrollWidth > innerWidth + 2,
      images: [...modal.querySelectorAll("img")].map(img => ({ src: img.getAttribute("src"), ok: img.complete && img.naturalWidth > 0 })) };
  });
  check(`${label}: modal width`, !!evidence.root && evidence.modal.width <= evidence.viewport.width + 2 && !evidence.overflow, evidence);
  check(`${label}: action visible`, evidence.buttons.length > 0 && evidence.buttons.every(b => b.width >= 32 && b.height >= 30 && b.right <= evidence.viewport.width + 2 && b.bottom <= evidence.viewport.height + 2 && b.y >= -2), evidence);
  if (!ALLOW_MISSING_ART) check(`${label}: images decoded`, evidence.images.every(img => img.ok), evidence.images);
  await page.screenshot({ path: path.join(OUTPUT, `${label}.png`), fullPage: false });
  return evidence;
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const devices = [];
  try {
    const host = await device(browser, "host"), guest = await device(browser, "guest");
    devices.push(host, guest);
    console.log("Sea reveal QA: lobby surfaces ready");
    await host.page.click("#createBoardRoomBtn");
    await host.page.waitForFunction(() => /^B[A-Z0-9]+$/.test(document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || ""));
    report.roomCode = (await host.page.textContent("#boardLobbyRoomCode")).trim();
    await guest.page.fill("#roomCodeInput", report.roomCode); await guest.page.click("#joinBoardRoomBtn");
    await guest.page.waitForFunction(code => document.getElementById("boardLobbyRoomCode")?.textContent?.trim() === code, report.roomCode);
    await guest.page.click("#boardReadyBtn"); await host.page.click("#boardStartBtn");
    for (const device of [host, guest]) {
      await device.page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 30000 });
      await device.page.waitForFunction(() => { const d = window.__BOARD_GAME_DEBUG__, l = d?.boardLanStatus?.(); return d?.seaRevealQa && window.BoardSeaEventVisuals && l?.connected && !l.awaitingInitialState && !l.applying; }, null, { timeout: 30000 });
    }
    report.prepared = await prepare(host.page);
    console.log("Sea reveal QA: disposable LAN room started", report.roomCode);
    await guest.page.waitForFunction(version => window.__BOARD_GAME_DEBUG__.boardLanStatus().version >= version, report.prepared.version);
    const defs = await host.page.evaluate(() => window.__BOARD_GAME_DEBUG__.seaRevealQa.definitions().filter(d => d.type !== "encounter"));
    check("24 ordinary sea effects", defs.length === 24, defs);
    const choiceEvidence = await host.page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa;
      const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId);
      const choices = [0, 1].map(i => ({ slotId: `qa-visible-choice-${i}`, typeId: "money" }));
      q.openChoice(p, tile, { choices });
      const selected = q.draw("money", tile, p, choices[1].slotId);
      const buttons = [...document.querySelectorAll("[data-sea-choice]")];
      const cardCount = document.querySelectorAll(".sea-event-choice-card[data-sea-choice]").length;
      buttons.filter(b => b.dataset.seaChoice === choices[1].slotId).at(-1).click();
      return { cardCount, buttonCount: buttons.length, expectedTitle: selected.title, event: structuredClone(s.boardUiEvent) };
    });
    const chosen = await pairedReveal(host.page, guest.page, "actual two-choice click", choiceEvidence.event);
    check("two-choice preserves displayed preselection", choiceEvidence.cardCount === 2 && choiceEvidence.buttonCount === 4 && chosen.owner.title === choiceEvidence.expectedTitle, choiceEvidence);
    for (const def of defs.filter(d => d.type !== "treasure")) {
      await reset(host.page);
      const evidence = await host.page.evaluate(({ type, index }) => {
        const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa;
        const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId);
        const selected = q.definition(type, index), before = window.BoardSeaEventVisuals.capture(p);
        q.trigger(p, tile, type, `qa-preselected-${type}-${index}`, selected);
        return { event: structuredClone(s.boardUiEvent), before, after: window.BoardSeaEventVisuals.capture(p), expectedTitle: selected.title };
      }, def);
      const pair = await pairedReveal(host.page, guest.page, def.title, evidence.event);
      check(`${def.title}: preselected effect preserved`, pair.owner.title === evidence.expectedTitle, pair.owner);
      for (const kind of ["coins", "hp", "pp", "dice"]) {
        const delta = evidence.after[kind] - evidence.before[kind];
        if (!delta) continue;
        const shown = evidence.event.detail.outcomes.find(row => row.kind === kind);
        check(`${def.title}: actual ${kind} delta`, !!shown && Number(String(shown.value).replace(/[^\d.-]/g, "")) === delta, { expected: delta, shown });
      }
      if (def.title === "漂流補給船") await layout(host.page, "desktop-money-result");
    }
    console.log("Sea reveal QA: ordinary outcomes verified");
    for (const def of defs.filter(d => d.type === "treasure")) {
      await reset(host.page);
      const evidence = await host.page.evaluate(({ type, index }) => {
        const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa;
        const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId);
        q.trigger(p, tile, type, `qa-${index}`, q.definition(type, index));
        return { event: structuredClone(s.boardUiEvent), count: document.querySelectorAll("[data-sea-treasure-chest]").length, button: !!document.querySelector("#startSeaChestShuffleBtn") };
      }, def);
      check(`${def.title}: four-chest draft retained`, evidence.count === 4 && evidence.button && evidence.event?.detail?.kind === "chest-draft", evidence);
      await guest.page.waitForFunction(id => document.getElementById("boardModalBack")?.dataset.boardUiEventId === id, evidence.event.id, { timeout: 15000 });
      check(`${def.title}: spectator draft read-only`, await guest.page.locator("[data-sea-treasure-chest]").count() === 4 && await guest.page.locator("[data-sea-treasure-chest]:not(:disabled)").count() === 0);
    }
    for (const type of ["wood", "copper", "silver", "gold", "gem"]) {
      await reset(host.page);
      const evidence = await host.page.evaluate(chestType => {
        const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa;
        const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId), effect = q.definition("treasure", 5);
        q.resolveChest(p, tile, effect, "treasure", [{ typeId: chestType, slotId: `qa-chest-${chestType}` }], `qa-chest-${chestType}`);
        return { event: structuredClone(s.boardUiEvent), player: window.BoardSeaEventVisuals.capture(p) };
      }, type);
      const pair = await pairedReveal(host.page, guest.page, `chest-${type}`, evidence.event);
      check(`chest-${type}: actual chest icon`, pair.owner.chest.includes(`chest_${type}.webp`) && pair.owner.chest === pair.viewer.chest, pair);
      if (type === "wood") check("wood trap adverse actual outcome", pair.owner.outcomes.some(row => /-|拘捕|陷阱/.test(row.text)), pair.owner.outcomes);
      else check(`chest-${type}: actual item icon`, pair.owner.outcomes.some(row => row.itemId && row.image), pair.owner.outcomes);
      if (type === "gem") {
        await layout(host.page, "desktop-chest-result");
        await host.page.setViewportSize({ width: 390, height: 844 });
        await layout(host.page, "mobile-chest-result");
        await host.page.setViewportSize({ width: 932, height: 430 });
        await layout(host.page, "landscape-chest-result");
        await host.page.setViewportSize({ width: 1440, height: 900 });
      }
    }
    await reset(host.page);
    const invariants = await host.page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa, v = window.BoardSeaEventVisuals;
      const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId), before = JSON.stringify(s.gameState);
      const initial = q.draw("money", tile, p, "stable-probe").title;
      const oldRandom = Math.random; const variants = {}; let randomUsed = false;
      Math.random = () => { randomUsed = true; throw new Error("Visual picker consumed gameplay Math.random"); };
      try { v.definitions.forEach(def => { const picks = Array.from({ length: 40 }, () => v.pick(def.title).variant); variants[def.key] = { unique: new Set(picks).size, adjacentRepeats: picks.some((n, i) => i > 0 && n === picks[i - 1]) }; }); }
      finally { Math.random = oldRandom; }
      return { randomUsed, unchanged: before === JSON.stringify(s.gameState), sameDraw: initial === q.draw("money", tile, p, "stable-probe").title, variants };
    });
    check("visual RNG does not consume gameplay RNG", !invariants.randomUsed && invariants.sameDraw && invariants.unchanged, invariants);
    check("all events use three variants without immediate repeats", Object.values(invariants.variants).every(v => v.unique === 3 && !v.adjacentRepeats), invariants.variants);
    if (!ALLOW_MISSING_ART) {
      const decoded = await host.page.evaluate(async () => {
        const paths = window.BoardSeaEventVisuals.definitions.flatMap(def => def.images);
        return Promise.all(paths.map(async src => { const img = new Image(); img.src = src; try { await img.decode(); return { src, ok: true, width: img.naturalWidth, height: img.naturalHeight }; } catch { return { src, ok: false }; } }));
      });
      check("all 72 generated illustrations decode", decoded.length === 72 && decoded.every(image => image.ok && image.width >= 400 && image.height >= 250), decoded);
    }
    await reset(host.page);
    await host.page.setViewportSize({ width: 390, height: 844 });
    await host.page.evaluate(() => {
      const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa;
      const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId);
      q.trigger(p, tile, "medicine", "qa-mobile", q.definition("medicine", 2));
    });
    await layout(host.page, "mobile-medicine-result");
    await host.page.setViewportSize({ width: 360, height: 780 });
    await layout(host.page, "small-mobile-medicine-result");
    await host.page.setViewportSize({ width: 390, height: 844 });
    await guest.page.reload({ waitUntil: "domcontentloaded" });
    await guest.page.waitForFunction(() => { const d = window.__BOARD_GAME_DEBUG__, l = d?.boardLanStatus?.(); return l?.connected && !l.awaitingInitialState && d.getState().gameState.phase === "main"; }, null, { timeout: 30000 });
    const recovered = await guest.page.evaluate(playerId => { const d = window.__BOARD_GAME_DEBUG__, s = d.getState(); return { connected: d.boardLanStatus().connected, playerCount: s.gameState.players.length, player: window.BoardSeaEventVisuals.capture(s.gameState.players.find(p => String(p.id) === String(playerId))) }; }, report.prepared.playerId);
    const owner = await host.page.evaluate(() => window.BoardSeaEventVisuals.capture(window.__BOARD_GAME_DEBUG__.getCurrentPlayer()));
    check("spectator refresh preserves actual result state", recovered.connected && recovered.playerCount === 2 && JSON.stringify(recovered.player) === JSON.stringify(owner), { recovered, owner });
    // Confirmation ends a real LAN turn. Exercise the same production CPU handler
    // in a separate offline page so fixture resets cannot conflict with authority.
    const cpuPage = await host.context.newPage();
    cpuPage.on("pageerror", error => report.errors.push({ device: "cpu-selector", message: error.message }));
    await cpuPage.goto(`${URL}/board_game.html?room=SEAQA&seed=2092101`, { waitUntil: "domcontentloaded" });
    await cpuPage.waitForFunction(() => window.__BOARD_GAME_DEBUG__?.seaRevealQa && window.BoardSeaEventVisuals, null, { timeout: 30000 });
    await prepare(cpuPage);
    for (const type of ["wood", "copper", "silver", "gold", "gem", "normal"]) {
      await reset(cpuPage);
      const cpu = await cpuPage.evaluate(chestType => {
        const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), p = d.getCurrentPlayer(), q = d.seaRevealQa;
        const tile = s.gameState.boardData.seaTiles.find(t => t.id === window.__seaQaBaseline.tileId);
        if (chestType === "normal") q.trigger(p, tile, "money", "qa-cpu-confirm", q.definition("money", 1));
        else q.resolveChest(p, tile, q.definition("treasure", 5), "treasure", [{ typeId: chestType, slotId: `qa-chest-${chestType}` }], `qa-chest-${chestType}`);
        const selector = chestType === "normal" ? "#confirmSeaEventBtn" : "#confirmSeaTreasureChestBtn";
        const before = !!document.querySelector(selector); const action = d.cpuDeadlockQa.handleVisibleOverlay();
        return { before, action, stillPresent: !!document.querySelector(selector), lanEnabled: d.boardLanStatus().enabled };
      }, type);
      check(`${type}: CPU confirmation selector`, cpu.before && !!cpu.action && !cpu.stillPresent, cpu);
    }
    await host.page.emulateMedia({ reducedMotion: "no-preference" });
    const moving = await host.page.evaluate(() => [...document.querySelectorAll("#boardModal .sea-reveal, #boardModal .sea-reveal-illustration, #boardModal .sea-reveal-outcome")].map(n => ({ name: getComputedStyle(n).animationName, duration: getComputedStyle(n).animationDuration })));
    check("normal motion has reveal and scene animation", moving.length >= 3 && moving.every(row => row.name !== "none" && parseFloat(row.duration) > 0), moving);
    await host.page.emulateMedia({ reducedMotion: "reduce" });
    const reduced = await host.page.evaluate(() => [...document.querySelectorAll("#boardModal .sea-reveal, #boardModal .sea-reveal-illustration, #boardModal .sea-reveal-outcome")].map(n => getComputedStyle(n).animationName));
    check("reduced motion disables reveal and scene animation", reduced.length >= 3 && reduced.every(name => name === "none"), reduced);
    await host.page.route("**/qa-sea-art-missing.webp", route => route.fulfill({ status: 404, contentType: "text/plain", body: "Intentional isolated QA missing-image case" }));
    await host.page.evaluate(() => { document.querySelector("#boardModal .sea-reveal-illustration").src = "images/board/sea_event_reveal/v2/qa-sea-art-missing.webp"; });
    await host.page.waitForFunction(() => document.querySelector("#boardModal .sea-reveal-art.art-unavailable"));
    const fallback = await host.page.evaluate(() => {
      const img = document.querySelector("#boardModal .sea-reveal-illustration"), note = document.querySelector("#boardModal .sea-reveal-art-fallback"), confirm = document.querySelector("#confirmSeaEventBtn");
      const result = { hidden: img.hidden, display: getComputedStyle(img).display, fallbackDisplay: getComputedStyle(note).display, text: note.textContent, confirmEnabled: !!confirm && !confirm.disabled };
      confirm.click(); result.closed = !document.querySelector("#confirmSeaEventBtn"); return result;
    });
    check("missing illustration has readable fallback and working confirmation", fallback.hidden && fallback.display === "none" && fallback.fallbackDisplay !== "none" && fallback.text.includes("結果與操作仍可繼續") && fallback.confirmEnabled && fallback.closed, fallback);
    check("zero browser page errors", report.errors.length === 0, report.errors);
    if (!ALLOW_MISSING_ART) check("no missing reveal assets", report.missingArt.length === 0, report.missingArt);
  } catch (error) {
    for (let index = 0; index < devices.length; index += 1) {
      await devices[index].page.screenshot({ path: path.join(OUTPUT, `failure-device-${index}.png`) }).catch(() => {});
      const state = await devices[index].page.evaluate(() => ({ url: location.href, text: document.body.innerText.slice(0, 4000), debug: !!window.__BOARD_GAME_DEBUG__, helper: !!window.BoardSeaEventVisuals })).catch(() => null);
      report[`failureDevice${index}`] = state;
    }
    throw error;
  } finally { await browser.close(); }
}

main().catch(error => { report.fatal = { message: error.message, stack: error.stack }; console.error(error); }).finally(() => {
  report.finishedAt = new Date().toISOString(); report.ok = !report.fatal && report.checks.every(c => c.ok); save();
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, failures: report.checks.filter(c => !c.ok).map(c => c.name), report: path.join(OUTPUT, "sea-event-reveal-report.json") }));
  if (!report.ok) process.exitCode = 1;
});
