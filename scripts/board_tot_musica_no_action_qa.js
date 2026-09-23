const fs = require("fs");
const path = require("path");
const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "playwright");

const ROOT_URL = process.env.BOARD_QA_URL || "http://127.0.0.1:8787";
const CHROME_PATH = process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT_DIR = process.env.BOARD_QA_OUTPUT || "D:/Codex_QA/board-stall-completion-20260924/tot-wait";
const VIEWPORT_WIDTH = Math.max(320, Number(process.env.BOARD_QA_WIDTH || 1600));
const VIEWPORT_HEIGHT = Math.max(320, Number(process.env.BOARD_QA_HEIGHT || 900));

function captureErrors(page, errors, label) {
  page.on("pageerror", (error) => errors.push(`${label}:pageerror:${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) errors.push(`${label}:console:${message.text()}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400 && !/favicon\.ico(?:\?|$)/.test(response.url())) errors.push(`${label}:http:${response.status()}:${response.url()}`);
  });
}

async function preparePlayerWorldBattle(host) {
  return host.evaluate(() => {
    const debug = window.__BOARD_GAME_DEBUG__;
    const runtime = debug.getState();
    const game = runtime.gameState;
    const cards = window.BoardCards.cards;
    const owner = game.players[0];
    owner.id = "tot-world-owner";
    owner.userId = 910001;
    owner.clientId = "tot-world-client-owner";
    owner.name = "現實船長";
    owner.isCPU = false;
    owner.isMe = true;
    owner.crew = cards.slice(0, 6).map((card) => debug.cloneCard(card));
    owner.activeCrewIndex = 0;
    owner.pendingBattle = null;
    owner.crew.forEach((card, index) => {
      card.baseStats ||= {};
      card.baseStats.hp = 3000;
      card.baseStats.spd = index === 0 ? 120 : 80;
      card.currentHp = 3000;
      card.battleCarryItem = null;
      (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(5, Number(move.pp || move.currentPP || 5)); });
    });

    const makePlayer = (id, userId, name, cardOffset) => {
      const player = JSON.parse(JSON.stringify(owner));
      player.id = id;
      player.userId = userId;
      player.clientId = `${id}-client`;
      player.name = name;
      player.isMe = false;
      player.crew = cards.slice(cardOffset, cardOffset + 6).map((card) => debug.cloneCard(card));
      player.activeCrewIndex = 0;
      player.crew.forEach((card, index) => {
        card.baseStats ||= {};
        card.baseStats.hp = 3000;
        card.baseStats.spd = index === 0 ? (id === "tot-world-song" ? 360 : 180) : 80;
        card.currentHp = 3000;
        card.battleCarryItem = null;
        (card.moveSet || []).forEach((move) => { move.currentPP = Math.max(5, Number(move.pp || move.currentPP || 5)); });
      });
      return player;
    };
    const song = makePlayer("tot-world-song", 910002, "歌世界船長", 6);
    const newcomer = makePlayer("tot-world-newcomer", 910003, "後援船長", 12);
    game.players = [owner, song, newcomer];
    game.currentPlayerIndex = 0;
    game.phase = "main";
    game.pendingMove = null;
    game.movementAnimating = false;
    game.resolutionLock = false;
    runtime.battleState = null;

    if (!game.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(owner, { id: "tot-player-world-coop-qa" });
    debug.ensurePostgameWorldLayout(game);
    const assignment = game.postgameWorld.islandAssignments.find((entry) => entry.bossKey === "postgame_tot_musica");
    const island = debug.getIslandById(assignment.islandId);
    const islandState = debug.getIslandState(assignment.islandId);
    islandState.isDefeated = false;
    debug.startBattle(owner, island, islandState);

    const battle = runtime.battleState;
    battle.entryTransition = null;
    battle.prebattleIntro = null;
    battle.prebattleIntroDone = true;
    battle.openingPassiveVisual = null;
    battle.openingPassiveVisualQueue = [];
    battle.openingPassiveVisualAnimating = false;
    battle.animating = false;
    battle.roundResolved = false;
    battle.waitingResume = false;
    battle.result = "";
    battle.coop = {
      enabled: true,
      participantIds: [owner.id, song.id, newcomer.id],
      actions: {},
      runtimes: {},
      defeated: {},
      roundStartedAt: Date.now(),
    };
    game.players.forEach((player) => debug.getBattleView({ coopViewPlayerId: player.id }));
    const mechanic = battle.postgameBossMechanic;
    mechanic.assigned = true;
    mechanic.coopPlayerWorlds = false;
    mechanic.realPlayerIds = [];
    mechanic.songPlayerIds = [];
    mechanic.realPlayerCursor = 0;
    mechanic.songPlayerCursor = 0;
    mechanic.coopSelectionWorld = "real";
    mechanic.coopWorldActions = { real: null, song: null };
    const qa = debug.postgameBossMechanicQa;
    qa.totNormalizePlayerWorlds(battle, mechanic);
    battle.playerId = mechanic.realPlayerIds[0];
    battle.activeCrewIndex = battle.coop.runtimes[battle.playerId].activeCrewIndex;
    return {
      playerIds: game.players.map((player) => String(player.id)),
      playerNames: game.players.map((player) => player.name),
      realPlayerIds: mechanic.realPlayerIds.slice(),
      songPlayerIds: mechanic.songPlayerIds.slice(),
      playerWorlds: qa.totUsesPlayerWorlds(battle, mechanic),
    };
  });
}


if(!['localhost','127.0.0.1','[::1]'].includes(new URL(ROOT_URL).hostname))throw Error('Localhost only');
const assert=require('node:assert/strict');
(async()=>{
 fs.mkdirSync(OUTPUT_DIR,{recursive:true});const report={cases:[],errors:[]};
 const browser=await chromium.launch({headless:true,executablePath:CHROME_PATH});
 try{for(const variant of (process.env.BOARD_QA_WORLD ? [process.env.BOARD_QA_WORLD] : ['coop','solo','cpu-coop','cpu-solo'])){
 const worlds=variant.includes('solo')?'solo':'coop';
 const context=await browser.newContext({viewport:{width:VIEWPORT_WIDTH,height:VIEWPORT_HEIGHT}}),host=await context.newPage();
 host.on('pageerror',e=>report.errors.push(e.message));
 await host.goto(ROOT_URL+'/board_game.html?desktop_frame=1');await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__&&window.BoardCards);
 await preparePlayerWorldBattle(host);
 const guard=await host.evaluate(worlds=>{
 const d=window.__BOARD_GAME_DEBUG__,s=d.getState(),b=s.battleState,m=b.postgameBossMechanic;
 if(worlds==='solo'){b.coop=null;s.gameState.players=[s.gameState.players[0]];m.coopPlayerWorlds=false;m.realPlayerIds=[];m.songPlayerIds=[];m.realIndices=[0,1,2];m.songIndices=[3,4,5];m.realActiveIndex=0;m.songActiveIndex=3;b.playerId=s.gameState.players[0].id;b.activeCrewIndex=0;}
 const rejected=worlds==='solo'?!d.battleTotDualAction({type:'wait'},{type:'wait'}):!d.battleTotWorldAction('real',{type:'wait'});
 s.gameState.players.forEach(p=>p.crew.forEach(c=>c.moveSet.forEach(move=>move.currentPP=0)));
 b.enemyCombatant.moveSet=[{id:'qa-tot-buff',name:'沉默觀望',category:'buff',pp:99,currentPP:99,power:0,effects:{selfStages:{def:1}}}];
 window.__qaTotBattle=b;d.notifyBattleWindow();return rejected;
 },worlds);assert.equal(guard,true);
 const popup=context.waitForEvent('page');await host.evaluate(()=>window.open('board_battle.html?tot_wait_qa=1','_blank'));const battle=await popup;
 battle.on('pageerror',e=>report.errors.push(e.message));await battle.waitForSelector('.postgame-dual-world-grid');
 if(variant.startsWith('cpu-'))await host.evaluate(()=>window.startBoardDevObserver());else{
 await battle.locator('[data-tot-world-mode="attack"][data-tot-world="real"]').click();await battle.locator('[data-tot-world-action="wait"][data-tot-world="real"]').click();
 if(worlds==='coop'){
 await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__.getState().battleState.postgameBossMechanic.coopSelectionWorld==='song');
 // Both player identities are local fixtures; choose the second actor through the same authoritative command.
 assert.equal(await host.evaluate(()=>window.__BOARD_GAME_DEBUG__.battleTotWorldAction('song',{type:'wait'})),true);
 }else{
 await battle.locator('[data-tot-world-mode="attack"][data-tot-world="song"]').click();await battle.screenshot({path:path.join(OUTPUT_DIR,`wait-${worlds}.png`)});await battle.locator('[data-tot-world-action="wait"][data-tot-world="song"]').click();
 }
 }
 await host.waitForFunction(()=>{const b=window.__BOARD_GAME_DEBUG__.getState().battleState;return b&&!b.animating&&(b.roundResolved||b.result||b.roundIndex>=2)},null,{timeout:60000}).catch(async error=>{report.timeout=await host.evaluate(()=>window.__BOARD_GAME_DEBUG__.getState().battleState);throw error});
 await host.evaluate(()=>window.stopBoardDevObserver());
 const result=await host.evaluate(()=>{const s=window.__BOARD_GAME_DEBUG__.getState(),b=s.battleState||window.__qaTotBattle;return {playerPerformedAction:b.playerPerformedAction,enemyPerformedAction:b.enemyPerformedAction,roundResolved:b.roundResolved,roundIndex:b.roundIndex,log:b.log.slice(-15),pp:s.gameState.players.flatMap(p=>p.crew.flatMap(c=>c.moveSet.map(m=>m.currentPP)))}});
 assert.ok(result.roundResolved||result.roundIndex>=2);assert.ok(result.log.filter(s=>s.includes('沒有可用招式，本輪待機')).length===2);assert.ok(result.pp.every(n=>n===0));
 report.cases.push({variant,worlds,guard,result});console.log(JSON.stringify({variant,worlds,ok:true}));await context.close();
 }assert.equal(report.errors.length,0);report.ok=true;}catch(e){report.failure=e.stack;throw e}finally{fs.writeFileSync(path.join(OUTPUT_DIR,'report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
