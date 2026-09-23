const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

// Localhost-only no-action regression. Modes: wait, pp-item, stale, reload,
// empty-enemy, choice and human. All fixtures use isolated real LAN rooms.
const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18943";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(ROOT_URL).hostname)) {
  throw new Error("Battle no-action QA creates disposable rooms and is localhost only.");
}
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Users/王曜瑋/AppData/Local/ms-playwright/chromium-1193/chrome-win/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-stall-completion-20260924/no-action";
const BASELINE_REF = "2d0e40572a925869af5d78031578c4b03b7589e4";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const report = { startedAt: new Date().toISOString(), rootUrl: ROOT_URL, baselineRef: process.env.BOARD_QA_BASELINE === "1" ? BASELINE_REF : null, errors: [], samples: [], cases: [] };
function saveReport() { fs.writeFileSync(path.join(OUTPUT_DIR, "no-action-report.json"), JSON.stringify(report, null, 2)); }

async function snapshot(page, label) {
  const value = await page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState, p = d.getCurrentPlayer();
    return {
      phase: g.phase, round: g.round, turnStep: g.turnStep, currentPlayerIndex: g.currentPlayerIndex,
      player: p && { id: p.id, name: p.name, isCPU: p.isCPU, location: p.location },
      cpu: d.cpuAutoStatus(), lan: d.boardLanStatus(),
      resolutionLock: g.resolutionLock, movementAnimating: g.movementAnimating, diceRolling: g.diceRolling,
      pendingMove: g.pendingMove, routePrompt: g.routePrompt, islandDecision: g.islandDecision,
      coopBattlePrompt: g.coopBattlePrompt, tradePrompt: g.tradePrompt, activeTrade: g.activeTrade,
      battleState: s.battleState && { playerId: s.battleState.playerId, phase: s.battleState.phase, prebattleIntro: s.battleState.prebattleIntro, animating: s.battleState.animating, roundResolved: s.battleState.roundResolved, result: s.battleState.result, log: s.battleState.log?.slice(-12) },
      boardUiEvent: s.boardUiEvent,
      overlay: [...document.querySelectorAll('[id$="Overlay"], #boardModalBack')].map(e => ({ id: e.id, classes: e.className, display: getComputedStyle(e).display, opacity: getComputedStyle(e).opacity, visibility: getComputedStyle(e).visibility, title: e.innerText?.slice(0, 240) })),
      frames: [...document.querySelectorAll('iframe')].map(e => ({ id: e.id, src: e.src, ready: e.contentDocument?.readyState, title: e.contentDocument?.title })),
      modalOpen: document.getElementById("boardModalBack")?.classList.contains("open"),
      modalText: document.getElementById("boardModal")?.innerText?.slice(0, 1800),
      buttons: [...document.querySelectorAll("#boardModal button")].map(b => ({ id: b.id, text: b.innerText, disabled: b.disabled, visible: !!(b.offsetWidth || b.offsetHeight || b.getClientRects().length) })),
      log: (g.log || g.logs || []).slice(-12),
    };
  });
  report.samples.push({ label, time: new Date().toISOString(), ...value });
  saveReport();
  return value;
}

async function startRoom(browser) {
  const context = await browser.newContext({ viewport: { width: Number(process.env.BOARD_QA_WIDTH || 1440), height: Number(process.env.BOARD_QA_HEIGHT || 900) }, reducedMotion: "reduce" });
  await context.addInitScript(() => {
    localStorage.setItem("op_board_user_id", "889923");
    localStorage.setItem("op_board_client_id", "qa-cpu-battle-stall-host");
    localStorage.setItem("op_name", "CPU停靠測試");
    localStorage.setItem("op_player_name", "CPU停靠測試");
    localStorage.setItem("op_board_story_speed", "3");
  });
  const page = await context.newPage();
  if (process.env.BOARD_QA_BASELINE === "1") {
    const baseline = execFileSync("git", ["show", `${BASELINE_REF}:public/js/board_game.js`], { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
    await page.route("**/js/board_game.js*", route => route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: baseline }));
  }
  page.on("pageerror", e => { report.errors.push({ type: "pageerror", message: e.message, stack: e.stack }); saveReport(); });
  page.on("console", e => {
    if (e.type() === "error" && !e.text().startsWith("Failed to load resource:")) { report.errors.push({ type: "console", message: e.text() }); saveReport(); }
  });
  await page.goto(`${ROOT_URL}/board_start.html?cpu_arrival_qa=1`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 20000 });
  await page.click("#boardEntryStartBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "auth");
  await page.fill("#boardAuthUsername", "CPU停靠測試");
  await page.click("#boardAuthSubmitBtn");
  await page.waitForFunction(() => document.body.dataset.entryStage === "app");
  await page.click("#openBoardFlowBtn");
  await page.click("#createBoardRoomBtn");
  await page.waitForFunction(() => /^B[A-Z0-9]+$/.test(document.getElementById("boardLobbyRoomCode")?.textContent?.trim() || ""));
  report.roomCode = (await page.textContent("#boardLobbyRoomCode")).trim();
  for (let count = 2; count <= 2; count += 1) {
    await page.click("#boardAddCpuBtn");
    await page.waitForFunction(n => window.__BOARD_START_DEBUG__.getState().lobby.players.length === n, count);
  }
  report.lobby = await page.evaluate(() => window.__BOARD_START_DEBUG__.getState().lobby);
  await page.click("#boardStartBtn");
  await page.waitForURL(/board_game\.html\?.*online=1/, { timeout: 30000 });
  await page.waitForFunction(() => {
    const d = window.__BOARD_GAME_DEBUG__, l = d?.boardLanStatus?.();
    return d && l?.connected && !l.awaitingInitialState && !l.applying;
  }, null, { timeout: 30000 });
  return { context, page };
}

async function prepareMain(page) {
  return page.evaluate(() => {
    const d = window.__BOARD_GAME_DEBUG__, s = d.getState(), g = s.gameState;
    if (g.players.length !== 2 || g.players.filter(p => p.isCPU).length !== 1) throw new Error("Expected 1 human plus 3 real lobby CPUs");
    g.phase = "main";
    g.currentPlayerIndex = g.players.findIndex(p => !p.isCPU);
    g.players.forEach((p, i) => {
      p.crew = window.BoardCards.cards.slice(i * 3, i * 3 + 3).map(c => d.cloneFreshDraftRecruit(c));
      p.activeCrewIndex = 0;
      d.recalcPlayerDerivedStats(p);
    });
    g.resolutionLock = false; g.movementAnimating = false; g.diceRolling = false; g.pendingMove = null;
    g.battleExitLock = false; g.routePrompt = null; g.islandDecision = null; g.tradePrompt = null; g.activeTrade = null;
    g.coopBattlePrompt = null; g.turnStep = "擲骰前進"; s.battleState = null; s.boardUiEvent = null;
    d.closeModal(); d.renderAll(); d.pushBoardLanState("qa-cpu-arrival-main");
    return { humanIndex: g.currentPlayerIndex, playerIds: g.players.map(p => p.id), islandKinds: [...new Set(g.boardData.islands.map(i => i.kind))], gameKeys: Object.keys(g) };
  });
}


const assert=require('node:assert/strict');const mode=process.env.BOARD_QA_MODE||'wait';
(async()=>{const browser=await chromium.launch({headless:true,executablePath:CHROME_PATH});
try{const {page}=await startRoom(browser);await prepareMain(page);
report.seed=await page.evaluate(mode=>{
 const d=window.__BOARD_GAME_DEBUG__,s=d.getState(),g=s.gameState,p=g.players.find(p=>mode==='human'?!p.isCPU:p.isCPU);g.currentPlayerIndex=g.players.indexOf(p);p.crew=[d.cloneFreshDraftRecruit(window.BoardCards.cards.find(c=>c.id==='luffy'))];p.activeCrewIndex=0;
 p.crew[0].battleCarryItem={type:'battleCarry',id:mode==='choice'?'choice_band':'assault_vest',bound:false};p.inventory={};p.smallSupplies=0;p.battleFood=0;p.guardCharm=0;d.recalcPlayerDerivedStats(p);
 const island=g.boardData.islands.find(i=>i.kind==='enemy');p.location={kind:'island',islandId:island.id};d.startBattle(p,island,d.getIslandState(island.id));const b=s.battleState;b.noEscape=true;
 b.enemyCombatant.moveSet=mode==='empty-enemy'?[]:[{id:'qa-enel-mantra',name:'心綱預判',category:'buff',pp:99,currentPP:99,power:0,effects:{selfStages:{evasion:2,accuracy:1}}}];window.__qaBattle=b;window.__qaPlayerId=p.id;
 p.crew[0].moveSet.forEach(m=>m.currentPP=0);
 if(mode==='choice'){const atk=p.crew[0].moveSet.find(m=>['attack','special'].includes(m.category));const other=p.crew[0].moveSet.find(m=>['attack','special'].includes(m.category)&&m.id!==atk.id);other.currentPP=10;d.bulletArsenalQa.contexts(p,b).forEach(c=>{if(c.item.id==='choice_band')c.state.lockedSkillId=atk.id});const rt=b.coop.runtimes[String(p.id)];rt.carryItemStates=structuredClone(b.carryItemStates);rt.heldItemStates=rt.carryItemStates;}
 if(mode==='pp-item')d.grantFormalItemToPlayer(p,'rum_secret',1);
 if(mode==='stale'){const m=p.crew[0].moveSet.find(m=>['attack','special'].includes(m.category));m.currentPP=1;if(b.prebattleIntro)d.battleMarkPrebattleIntroDone(b.prebattleIntro.id,b.prebattleIntro.key);if(!d.battleChooseMove(m.id))throw Error('Stale move queue failed');m.currentPP=0;}
 d.notifyBattleWindow();return {hp:p.crew[0].currentHp,pp:p.crew[0].moveSet.map(m=>m.currentPP),playerId:p.id};
},mode);
if(mode==='human'){
 await page.waitForFunction(()=>window.__BOARD_GAME_DEBUG__.getBattleView()?.battle.canWait,null,{timeout:35000});
 const frame=page.frameLocator('#battlePageFrame');await frame.locator('[data-mode="attack"]').click();await page.screenshot({path:path.join(OUTPUT_DIR,'wait-button.png')});await frame.locator('[data-battle-wait]').click();
}
if(mode==='reload'){
 await page.waitForFunction(()=>window.__BOARD_GAME_DEBUG__.getState().battleState?.playerAction?.type==='wait'&&window.__BOARD_GAME_DEBUG__.getState().battleState?.animating,null,{timeout:40000});
 await page.waitForTimeout(450);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.boardLanStatus().connected&&!window.__BOARD_GAME_DEBUG__.boardLanStatus().awaitingInitialState);
}
await page.waitForFunction(()=>{const d=window.__BOARD_GAME_DEBUG__,b=d.getState().battleState;return !b||b.roundResolved||b.result},null,{timeout:60000});
report.after=await page.evaluate(id=>{const d=window.__BOARD_GAME_DEBUG__,s=d.getState(),p=s.gameState.players.find(p=>p.id===id),b=s.battleState||window.__qaBattle||p.pendingBattle;return {battle:structuredClone(b),hp:p.crew[0].currentHp,pp:p.crew[0].moveSet.map(m=>m.currentPP),items:d.inventoryItemCount(p,'rum_secret'),cpu:d.cpuAutoStatus()}},report.seed.playerId);
if(mode==='pp-item'){assert.equal(report.after.battle.playerAction.itemId,'rum_secret');assert.equal(report.after.items,0);assert.ok(report.after.pp.some(n=>n>0))}
else if(mode==='stale'){assert.equal(report.after.battle.playerPerformedAction,true);assert.ok(report.after.battle.log.some(s=>s.includes('原定招式已無法使用')))}
else{assert.equal(report.after.battle.playerAction.type,'wait');assert.deepEqual(report.after.pp,report.seed.pp)}
if(mode!=='empty-enemy')assert.equal(report.after.hp,report.seed.hp);else assert.ok(report.after.battle.enemyCombatant.moveSet.some(m=>m.id.endsWith('_struggle')));
if(mode==='human')await page.evaluate(()=>window.__BOARD_GAME_DEBUG__.battleFinish());
await page.waitForFunction(()=>!window.__BOARD_GAME_DEBUG__.getState().battleState,null,{timeout:35000});
assert.equal(report.errors.length,0);report.ok=true;console.log(JSON.stringify({mode,ok:true}));
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1}finally{saveReport();await browser.close()}})();
