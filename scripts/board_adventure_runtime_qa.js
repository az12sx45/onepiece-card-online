'use strict';
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..'),BASE=process.env.BOARD_QA_URL||'http://127.0.0.1:18929',OUTPUT=process.env.BOARD_QA_OUTPUT||'D:/Codex_QA/draw-result-art-20260922/runtime';
if(!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(BASE))throw Error('Local isolated QA only');
fs.mkdirSync(OUTPUT,{recursive:true});const report={checks:[],errors:[],screenshots:[]};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});if(!pass)console.error('FAIL',name,detail);}
const source=fs.readFileSync(path.join(ROOT,'public/js/board_game.js'),'utf8');
const anchor='window.__BOARD_GAME_DEBUG__ = {';
if(source.split(anchor).length!==2)throw Error('Debug anchor changed');
const hooked=source.replace(anchor,()=>`${anchor}
  adventureQa:{record:recordAdventureArt,impelNormalize:normalizeImpelDownState,
    grant(id){const old=randomJudicialPhaseBonus;randomJudicialPhaseBonus=()=>JUDICIAL_PHASE_BONUS_POOL.find(b=>b.id===id);try{return grantJudicialPhaseReward(currentPlayer(),{activeCrewIndex:0},0,'qa-'+id,'驗證敵人');}finally{randomJudicialPhaseBonus=old;}},
    resetRewards(){ensureJudicialRaidState().phaseRewardClaimedKeys=[];},
  },`);
async function run(){
 const browser=await chromium.launch({headless:true,executablePath:process.env.BOARD_QA_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>{if(location.protocol!=='http:')return;localStorage.setItem('op_board_user_id','892220');localStorage.setItem('op_board_client_id','qa-adventure-892220');localStorage.setItem('op_name','插畫測試');localStorage.setItem('op_player_name','插畫測試');});
  await context.route('**/js/board_game.js*',route=>route.fulfill({contentType:'application/javascript',body:hooked}));
  context.on('page',page=>page.on('pageerror',e=>report.errors.push({message:e.message,stack:e.stack,url:page.url()})));
  const host=await context.newPage();await host.goto(BASE+'/board_game.html?adventure_qa=1');
  await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.adventureQa&&window.BoardCards?.cards?.length,null,{timeout:30000});
  const prepared=await host.evaluate(()=>{
    const d=__BOARD_GAME_DEBUG__,s=d.getState(),g=s.gameState,p=g.players[0];
    g.phase='main';g.currentPlayerIndex=0;g.pendingMove=null;g.resolutionLock=false;g.turnStep='停靠結算';
    p.userId=BoardShared.getState().profile.userId;p.isCPU=false;p.isCpu=false;p.cpu=false;p.clientId='qa-adventure-892220';
    p.crew=BoardCards.cards.slice(0,3).map(c=>d.cloneFreshDraftRecruit(c));p.activeCrewIndex=0;p.coins=100000;p.bounty=100000;p.adventureArt={};
    d.recalcPlayerDerivedStats(p);p.crew.forEach(c=>c.currentHp=Math.max(1,Math.floor(c.baseStats.hp*.6)));g.players=[p];
    d.normalizeLoadedGameState();window.__artBase=structuredClone(g);return {id:p.id,userId:p.userId,profile:BoardShared.getState().profile.userId};
  });report.identity=prepared;
  const save=await host.evaluate(()=>{
    const d=__BOARD_GAME_DEBUG__,g=d.getState().gameState,p=g.players[0];delete p.adventureArt;d.normalizeLoadedGameState();
    const oldEmpty=JSON.stringify(p.adventureArt)==='{}',before={coins:p.coins,bounty:p.bounty,crew:p.crew.map(c=>c.id),inventory:p.inventory};
    d.adventureQa.record(p,{group:'chest',key:'wood',variant:0});d.getState().gameState=JSON.parse(JSON.stringify(g));d.normalizeLoadedGameState();const restored=d.getState().gameState.players[0];
    return {oldEmpty,before,after:{coins:restored.coins,bounty:restored.bounty,crew:restored.crew.map(c=>c.id),inventory:restored.inventory},art:restored.adventureArt,collection:BoardArtCollection.snapshot()};
  });
  check('old save normalizes optional collection',save.oldEmpty);check('save JSON round trip retains unlocked version',!!save.art['chest:wood:1']);check('save round trip preserves gameplay values',JSON.stringify(save.before)===JSON.stringify(save.after),save);check('own encounter enters personal permanent collection',!!save.collection['chest:wood:1']);
  const cpu=await host.evaluate(()=>{const d=__BOARD_GAME_DEBUG__,p=d.getCurrentPlayer(),before=JSON.stringify(BoardArtCollection.snapshot());const c={...structuredClone(p),id:'cpu-only',isCPU:true,adventureArt:{}};d.adventureQa.record(c,{group:'chest',key:'gem',variant:2});const foreign={...structuredClone(p),userId:892221,id:'892221',adventureArt:{}};d.adventureQa.record(foreign,{group:'chest',key:'silver',variant:2});return {cpu:c.adventureArt,foreign:foreign.adventureArt,ownUntouched:before===JSON.stringify(BoardArtCollection.snapshot())};});
  check('CPU does not accumulate collection',Object.keys(cpu.cpu).length===0);check('foreign encounter not merged into local account',cpu.ownUntouched&&!!cpu.foreign['chest:silver:3'],cpu);
  for(const eventId of ['patrol','key','magellan','ivankov','hidden']){
    const result=await host.evaluate(id=>{const d=__BOARD_GAME_DEBUG__,s=d.getState(),p=s.gameState.players[0];const member={...structuredClone(p),id:'892221',userId:892221,adventureArt:{}};s.gameState.players=[p,member];for(const target of s.gameState.players)target.impelDown={active:true,status:'free',level:6,teamId:'qa-team'};const applied=d.impelDownTeamQa.applyEvent(p.id,id);const a=p.impelDown.eventVisual,b=member.impelDown.eventVisual;return {applied,a,b,member:member.adventureArt,own:p.adventureArt,views:[d.getImpelDownView(p).eventVisual,d.getImpelDownView(member).eventVisual]};},eventId);
    check(`${eventId}: authority selects correct art group`,result.a?.key===eventId&&result.a?.group==='impel',result);
    if(eventId==='hidden')check('hidden event excludes teammate',result.applied.length===1&&Object.keys(result.member).length===0);
    else check(`${eventId}: affected teammate shares exact art version`,JSON.stringify(result.a)===JSON.stringify(result.b)&&Object.keys(result.member).length===1);
  }
  await host.evaluate(()=>{const d=__BOARD_GAME_DEBUG__,g=d.getState().gameState;g.players=[g.players[0]];g.players[0].impelDown={active:true,status:'free',level:1};d.adventureQa.resetRewards();});
  for(const id of ['heal','pp','attack','defense','speed','shield','revive','burst']){
    const result=await host.evaluate(id=>{const d=__BOARD_GAME_DEBUG__,reward=d.adventureQa.grant(id),before=d.getCurrentPlayer().coins,again=d.adventureQa.grant(id);return {reward,again,unchanged:d.getCurrentPlayer().coins===before,art:d.getCurrentPlayer().adventureArt};},id);
    check(`${id}: actual judicial grant records one valid variant`,result.reward?.bonus?.visual?.key===id&&!!result.art[`judicial:${id}:${result.reward.bonus.visual.variant+1}`],result.reward);
    check(`${id}: repeat grant does not award again`,result.again===null&&result.unchanged);
  }
  // Real bridge command and real 800ms refresh loop, instrumenting DOM insertions.
  const impelPromise=context.waitForEvent('page');await host.evaluate(()=>window.open('board_impel_down.html?adventure_qa=1','_blank'));const impel=await impelPromise;await impel.waitForLoadState();
  await impel.evaluate(()=>{window.__artMutations=[];new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('.adventure-result-art'))__artMutations.push({at:performance.now(),id:n.dataset.artId});}).observe(document.getElementById('eventArt'),{childList:true});window.__artStarted=performance.now();});
  await impel.click('#primaryBtn');await impel.waitForTimeout(1200);check('Impel: no art before spin settles',await impel.locator('.adventure-result-art').count()===0);
  await impel.waitForSelector('.adventure-result-art',{timeout:7000});
  const first=await impel.evaluate(()=>{window.__firstArt=document.querySelector('.adventure-result-art');return {src:__firstArt.querySelector('img').getAttribute('src'),at:__artMutations[0].at-__artStarted,count:__artMutations.length};});
  check('Impel: reveal starts after 2550ms',first.at>=2500,first);
  await impel.waitForTimeout(4000);check('Impel: repeated polls keep same DOM node',await impel.evaluate(()=>__firstArt===document.querySelector('.adventure-result-art')&&__artMutations.length===1));
  await impel.screenshot({path:path.join(OUTPUT,'impel-result.png')});report.screenshots.push('impel-result.png');
  await impel.reload();await impel.waitForSelector('.adventure-result-art');check('Impel: refresh restores same selected picture',await impel.locator('.adventure-result-art img').getAttribute('src')===first.src);await impel.close();
  // Keep a genuine battle view available while exercising its reward renderer.
  await host.evaluate(()=>{const d=__BOARD_GAME_DEBUG__,s=d.getState(),p=s.gameState.players[0];p.impelDown.active=false;p.pendingBattle=null;s.battleState=null;d.unlockPostgameWorldAfterEnding(p,{id:'art-qa'});d.ensurePostgameWorldLayout(s.gameState);const a=s.gameState.postgameWorld.islandAssignments[0];d.startBattle(p,d.getIslandById(a.islandId),d.getIslandState(a.islandId));Object.assign(s.battleState,{entryTransition:null,prebattleIntro:null,prebattleIntroDone:true,openingPassiveVisual:null,openingPassiveVisualQueue:[],visualEvent:null,animating:false});});
  const battlePromise=context.waitForEvent('page');await host.evaluate(()=>window.open('board_battle.html?adventure_qa=1','_blank'));const battle=await battlePromise;await battle.waitForFunction(()=>window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle);
  await battle.evaluate(()=>{window.__raidInsert=[];new MutationObserver(records=>{for(const r of records)for(const n of r.addedNodes)if(n.nodeType===1&&n.matches('.adventure-result-art'))__raidInsert.push(performance.now());}).observe(document.getElementById('raidRewardScene'),{childList:true});window.__raidStart=performance.now();__BOARD_BATTLE_DEBUG__.playRaidPhaseRewardFx({id:'qa-judicial-reveal',finalVictory:true,defeatedName:'路基',duration:24000,bonus:{id:'attack',index:2,label:'全員總攻擊',description:'隊伍攻擊能力提升。',visual:{group:'judicial',key:'attack',variant:0}}});});
  await battle.waitForTimeout(3300);check('Judicial: no result art before reel settles',await battle.locator('#raidRewardScene img').count()===0);
  await battle.waitForSelector('#raidRewardScene img',{timeout:6000});
  check('Judicial: reveal starts at original 4550ms gate',await battle.evaluate(()=>__raidInsert.length===1&&__raidInsert[0]-__raidStart>=4500));
  for(const[label,width,height]of[['desktop',1440,900],['mobile',390,844],['landscape',932,430]]){
    await battle.setViewportSize({width,height});await battle.waitForTimeout(150);
    const box=await battle.locator('#raidRewardScene').boundingBox();check(`Judicial ${label}: scene fits viewport`,box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,box);
    await battle.screenshot({path:path.join(OUTPUT,'judicial-'+label+'.png')});report.screenshots.push('judicial-'+label+'.png');
  }
  await battle.waitForTimeout(1600);check('Judicial: refresh loop does not replay image',await battle.evaluate(()=>__raidInsert.length===1));
  check('Judicial: final phase completion caption',await battle.locator('#raidNextEnemyName').textContent()==='司法島全數突破！');
  check('browser JS errors',report.errors.length===0,report.errors);
 }finally{await browser.close();}
}
run().catch(e=>{report.fatal=e.stack;console.error(e);}).finally(()=>{report.ok=!report.fatal&&report.checks.every(c=>c.pass);fs.writeFileSync(path.join(OUTPUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass).map(c=>c.name),output:OUTPUT}));if(!report.ok)process.exitCode=1;});
