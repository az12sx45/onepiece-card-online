const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

// Localhost-only regression: one human identity plus one lobby-created CPU.
// BASELINE=1 reproduces the old no-effect item deadlock, then reloads current
// code through real Socket.IO state restoration. ITEM_MODE=forced/heal checks
// no-effect completion and actual healing. All data belongs to isolated QA rooms.

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:18943";
if (!["127.0.0.1", "localhost", "[::1]"].includes(new URL(ROOT_URL).hostname)) {
  throw new Error("CPU arrival QA creates disposable rooms and is localhost only.");
}
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Users/王曜瑋/AppData/Local/ms-playwright/chromium-1193/chrome-win/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-battle-recovery-20260924/default";
const BASELINE_REF = "073283a0d689fed1df6a5c6df69241501fa9e44f";
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
const report = { startedAt: new Date().toISOString(), rootUrl: ROOT_URL, baselineRef: process.env.BOARD_QA_BASELINE === "1" ? BASELINE_REF : null, errors: [], samples: [], cases: [] };
function saveReport() { fs.writeFileSync(path.join(OUTPUT_DIR, "cpu-arrival-report.json"), JSON.stringify(report, null, 2)); }

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
      battleState: s.battleState && { playerId: s.battleState.playerId, phase: s.battleState.phase, prebattleIntro: s.battleState.prebattleIntro, animating: s.battleState.animating, roundResolved: s.battleState.roundResolved, result: s.battleState.result },
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
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
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
    if (g.players.length !== 2 || g.players.filter(p => p.isCPU).length !== 1) throw new Error("Expected 1 human plus 1 real lobby CPU");
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


const assert=require('node:assert/strict');
const baseline=process.env.BOARD_QA_BASELINE==='1';
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:CHROME_PATH});
 try {
 const {page}=await startRoom(browser);globalThis.qaPage=page;console.log('room ready');await prepareMain(page);
 report.seed=await page.evaluate(mode=>{
 const d=window.__BOARD_GAME_DEBUG__,s=d.getState(),g=s.gameState,p=g.players.find(p=>p.isCPU);
 g.currentPlayerIndex=g.players.indexOf(p);p.crew=[d.cloneFreshDraftRecruit(window.BoardCards.cards.find(c=>c.id==='jinbe'))];p.activeCrewIndex=0;
 p.inventory={};p.smallSupplies=0;p.battleFood=0;p.guardCharm=0;d.recalcPlayerDerivedStats(p);p.crew[0].currentHp=Math.max(1,Math.floor(d.cardMaxHp(p.crew[0])*.25));
 d.grantFormalItemToPlayer(p,'paralyze_oil',2);if(mode==='heal')d.grantFormalItemToPlayer(p,'small_meat',2);
 const islands=g.boardData.islands.filter(i=>i.kind==='enemy');const island=islands.find(i=>d.getIslandState(i.id).enemyProfile?.key==='enel')||islands[0];
 p.location={kind:'island',islandId:island.id};d.startBattle(p,island,d.getIslandState(island.id));
 const b=s.battleState; b.enemyCombatant.moveSet=[{id:'enel_mantra',name:'心綱預判',category:'buff',pp:99,currentPP:99,power:0,effects:{selfStages:{evasion:2,accuracy:1}}}];
 b.enemyCombatant.name='艾尼路';window.__qaOriginalBattle=b;
 if(mode==='forced'){if(b.prebattleIntro)d.battleMarkPrebattleIntroDone(b.prebattleIntro.id,b.prebattleIntro.key);if(!d.battleUseItem('paralyze_oil',0))throw Error('No-effect item fixture rejected');}
 return {enemy:b.enemyCombatant,player:structuredClone(p),items:d.getBattleView().player.battleItems};
 },process.env.BOARD_QA_ITEM_MODE||'cpu');
 saveReport();console.log('battle seeded');
 for(let i=0;i<35;i++){await page.waitForTimeout(1500);const row=await snapshot(page,'round-'+i);console.log(JSON.stringify({i,cpu:row.cpu,battle:row.battleState}));if(await page.evaluate(()=>{const b=window.__BOARD_GAME_DEBUG__.getState().battleState||window.__qaOriginalBattle;if(b.log?.includes('共鬥行動結束，交棒中。')){window.__qaOriginalBattle=b;return true}return false}))break;}
 report.resolved=await page.evaluate(()=>{const d=window.__BOARD_GAME_DEBUG__,b=window.__qaOriginalBattle,p=d.getState().gameState.players.find(x=>x.isCPU);return {battle:structuredClone(b),hp:p.crew.map(c=>c.currentHp),oil:d.inventoryItemCount(p,'paralyze_oil'),cpu:d.cpuAutoStatus()}});
 if(baseline){
  assert.equal(report.resolved.battle.playerAction.itemId,'paralyze_oil');assert.equal(report.resolved.battle.playerPerformedAction,false);assert.equal(report.resolved.battle.enemyPerformedAction,true);assert.equal(report.resolved.oil,2);
  await page.evaluate(()=>window.__BOARD_GAME_DEBUG__.pushBoardLanState('qa-old-item-handoff'));
  await page.waitForTimeout(500);
  await page.unroute('**/js/board_game.js*');
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>{const d=window.__BOARD_GAME_DEBUG__;return d?.boardLanStatus().connected&&!d.boardLanStatus().awaitingInitialState},null,{timeout:30000});
  await page.waitForFunction(()=>!window.__BOARD_GAME_DEBUG__.getState().battleState,null,{timeout:45000});
  report.recovered=await page.evaluate(()=>{const d=window.__BOARD_GAME_DEBUG__,g=d.getState().gameState,p=g.players.find(x=>x.isCPU);return {hp:p.crew.map(c=>c.currentHp),oil:d.inventoryItemCount(p,'paralyze_oil'),pendingBattle:p.pendingBattle,player:d.getCurrentPlayer().name,lan:d.boardLanStatus()}});
  assert.deepEqual(report.recovered.hp,report.resolved.hp);assert.equal(report.recovered.oil,2);
  assert.equal(report.recovered.pendingBattle.enemyCombatant.moveSet[0].currentPP,report.resolved.battle.enemyCombatant.moveSet[0].currentPP);
 }else{
  if(process.env.BOARD_QA_ITEM_MODE==='forced'){assert.equal(report.resolved.battle.playerAction.itemId,'paralyze_oil');assert.equal(report.resolved.battle.itemUseCounts?.['-1001:paralyze_oil']||0,0)}
  else if(process.env.BOARD_QA_ITEM_MODE==='heal'){assert.equal(report.resolved.battle.playerAction.itemId,'small_meat');assert.equal(report.resolved.battle.itemUseCounts['-1001:small_meat'],1);assert.ok(report.resolved.hp[0]>report.seed.player.crew[0].currentHp)}
  else assert.notEqual(report.resolved.battle.playerAction.type,'item');
  assert.equal(report.resolved.battle.playerPerformedAction,true);assert.equal(report.resolved.oil,2);
  await page.waitForFunction(()=>!window.__BOARD_GAME_DEBUG__.getState().battleState,null,{timeout:45000});
  report.returnedToMap=true;
 }
 assert.equal(report.errors.length,0);report.ok=true;console.log(JSON.stringify({ok:true,baseline,recovery:!!report.recovered}));
 }catch(e){if(globalThis.qaPage)await snapshot(globalThis.qaPage,'failure');report.failure=e.stack;console.error(e);process.exitCode=1}finally{saveReport();await browser.close()}
})();
