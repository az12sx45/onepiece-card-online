const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('D:/LATTICE/projects/tabletop-series/qa-browser/node_modules/playwright-core');
const BASE=process.env.BOARD_QA_BASE||'http://127.0.0.1:18943';
const ROOT=path.resolve(__dirname,'..');
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(BASE).hostname))throw Error('Visual fixtures are localhost only');
const manifest=JSON.parse(fs.readFileSync(ROOT+'/public/images/board-depth/v1/manifest.json'));
const OUT=process.env.BOARD_QA_OUTPUT||'D:/Codex_QA/board-battle-recovery-20260924/visual';fs.mkdirSync(OUT,{recursive:true});
async function prepareBattle(host){
  await host.goto(BASE+'/board_game.html?desktop_frame=1&depth_correction_dynamic_qa=1',{waitUntil:'domcontentloaded'});
  await host.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.startBattle&&window.BoardCards?.cards?.length,null,{timeout:30000});
  return host.evaluate(()=>{
    const debug=window.__BOARD_GAME_DEBUG__,state=debug.getState(),player=state.gameState.players[0];
    const source=window.BoardCards.cards.find(card=>/魯夫/.test(card.name))||window.BoardCards.cards[0];
    player.crew=[debug.cloneCard({...source,level:50,currentHp:Number.MAX_SAFE_INTEGER})];
    player.crew[0].currentHp=Number(player.crew[0].baseStats?.hp||1000);
    player.activeCrewIndex=0;player.pendingBattle=null;state.battleState=null;
    if(!state.gameState.postgameWorld?.unlocked) debug.unlockPostgameWorldAfterEnding(player,{id:'isolated-depth-correction-dynamic-qa'});
    debug.ensurePostgameWorldLayout(state.gameState);
    const assignment=state.gameState.postgameWorld.islandAssignments.find(entry=>entry.bossKey==='postgame_douglas_bullet')||state.gameState.postgameWorld.islandAssignments[0];
    const island=debug.getIslandById(assignment.islandId),islandState=debug.getIslandState(assignment.islandId);
    islandState.currentHp=islandState.maxHp;islandState.isDefeated=false;
    debug.startBattle(player,island,islandState);
    Object.assign(state.battleState,{entryTransition:null,prebattleIntro:null,prebattleIntroDone:true,openingPassiveVisual:null,openingPassiveVisualQueue:[],visualEvent:null,animating:false,roundResolved:false,waitingResume:false});
    const originalGetBattleView=debug.getBattleView.bind(debug);
    debug.getBattleView=(...args)=>{
      const view=originalGetBattleView(...args),forced=window.__qaForcedPortrait;
      if(forced&&view?.enemy?.battlePortraits){
        view.enemy={...view.enemy,battlePortraits:Object.fromEntries(
          Object.keys(view.enemy.battlePortraits).map(key=>[key,forced]))};
      }
      return view;
    };
    return {bossKey:assignment.bossKey,islandId:assignment.islandId,
      battleStateKeys:Object.keys(state.battleState||{}),
      enemyKeys:Object.keys(state.battleState?.enemyCombatant||{}),
      enemyPortraits:state.battleState?.enemyCombatant?.battlePortraits||null};
  });
}


(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const report={cases:[],errors:[]};
 try{for(const config of [{viewport:{width:1440,height:900}},{viewport:{width:844,height:390}},{viewport:{width:844,height:390},isMobile:true,hasTouch:true},{viewport:{width:1440,height:900},reducedMotion:'reduce'}]){
 const context=await browser.newContext({...config,userAgent:"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36"});const host=await context.newPage();host.on('pageerror',e=>report.errors.push(e.stack));try{await prepareBattle(host)}catch(e){report.failure={message:e.message,url:host.url(),text:(await host.locator('body').innerText()).slice(0,1600)};throw e;}
 const popup=context.waitForEvent('page');await host.evaluate(()=>window.open('board_battle.html?whole_frame_qa=1','_blank'));const battle=await popup;
 battle.on('pageerror',e=>report.errors.push(e.message));await battle.waitForFunction(()=>window.__BOARD_BATTLE_DEBUG__?.latestView()?.battle);
 const sources=['images/board/battle/enemies/enel/normal.webp',Object.keys(manifest.fallbacks)[0]];
 for(const src of sources){
 await host.evaluate(src=>window.__qaForcedPortrait=src,src);await battle.evaluate(()=>window.__BOARD_BATTLE_DEBUG__.refresh());
 await battle.waitForFunction(src=>document.querySelector('#enemyPortrait')?.getAttribute('src')===src&&document.querySelector('#enemyPortraitWrap')?.hasAttribute('data-board-depth-ready'),src);
 await battle.mouse.move(0,0);await battle.waitForTimeout(250);
 const measure=()=>battle.evaluate(()=>{const c=document.querySelector('#enemyCard'),face=c.querySelector('.board-character-depth-model-face'),cs=getComputedStyle(c),rect=c.getBoundingClientRect();return {layout:[c.offsetWidth,c.offsetHeight,c.offsetLeft,c.offsetTop],rect:[rect.width,rect.height],transform:cs.transform,animation:cs.animationName,engaged:c.classList.contains('board-frame-inset-engaged'),pitch:c.style.getPropertyValue('--board-frame-pitch'),yaw:c.style.getPropertyValue('--board-frame-yaw'),inner:face?getComputedStyle(face).transform:null,frame:c.querySelector('.board-frame-inset-edge')?.parentElement===c,portrait:[c.querySelector('.battle-portrait').offsetWidth,c.querySelector('.battle-portrait').offsetHeight]}});
 const before=await measure(),box=await battle.locator('#enemyCard').boundingBox();await battle.mouse.move(box.x+box.width*.15,box.y+box.height*.2,{steps:8});await battle.waitForTimeout(250);const tilted=await measure();
 assert.deepEqual(tilted.layout,before.layout);assert.deepEqual(tilted.portrait,before.portrait);assert.equal(tilted.frame,true);if(tilted.inner)assert.equal(tilted.inner,'none');
 if(!config.hasTouch&&config.reducedMotion!=='reduce'){assert.equal(tilted.engaged,true);assert.ok(tilted.transform.startsWith('matrix3d('));assert.notEqual(tilted.yaw,'0.000deg');
 const busyAnimation=await battle.evaluate(()=>{const c=document.querySelector('#enemyCard');c.classList.add('portrait-attack');return getComputedStyle(c).animationName});assert.equal(busyAnimation,'enemyCardAttackShake');await battle.waitForTimeout(50);const attacking=await measure();assert.equal(attacking.engaged,false);assert.deepEqual(attacking.layout,before.layout);
 await battle.evaluate(()=>document.querySelector('#enemyCard').classList.remove('portrait-attack'));
 }else assert.equal(tilted.engaged,false);
 await battle.mouse.move(0,0);await battle.waitForTimeout(200);assert.equal((await measure()).engaged,false);
 const shot=path.join(OUT,`${report.cases.length}-full.png`);await battle.mouse.move(box.x+box.width*.15,box.y+box.height*.2);await battle.waitForTimeout(220);await battle.screenshot({path:shot});
 report.cases.push({config,src,before,tilted,shot});console.log(JSON.stringify({config,src,ok:true}));
 }
 if(config.viewport.width===1440&&!config.reducedMotion){
 await host.evaluate(()=>window.__qaForcedPortrait=null);await battle.evaluate(()=>window.__BOARD_BATTLE_DEBUG__.refresh());
 await battle.locator('[data-mode="attack"]').click();await battle.locator('[data-move-id]').first().click();
 await host.waitForFunction(()=>{const b=window.__BOARD_GAME_DEBUG__.getState().battleState;return b&&!b.animating&&(b.roundResolved||b.result)},null,{timeout:45000});
 report.attack=await host.evaluate(()=>{const b=window.__BOARD_GAME_DEBUG__.getState().battleState;return {result:b.result,roundResolved:b.roundResolved,log:b.log.slice(-10)}});
 assert.ok(report.attack.roundResolved||report.attack.result);
 }
 // Closing and reopening a populated portrait must not self-trigger the source observer forever.
 for(let cycle=0;cycle<3;cycle++){
 await battle.evaluate(()=>{const img=document.querySelector('#enemyPortrait');window.__qaSavedPortrait=img.getAttribute('src');img.classList.add('is-empty');img.removeAttribute('src')});
 await battle.waitForFunction(()=>!document.querySelector('#enemyPortraitWrap .board-character-depth-model-layer') && !document.querySelector('#enemyPortraitWrap').hasAttribute('data-board-depth-ready'),null,{timeout:5000});
 await battle.evaluate(()=>new Promise(resolve=>setTimeout(resolve,50)));
 await battle.evaluate(()=>{const img=document.querySelector('#enemyPortrait');img.classList.remove('is-empty');img.setAttribute('src',window.__qaSavedPortrait)});
 await battle.waitForFunction(()=>document.querySelector('#enemyPortraitWrap')?.hasAttribute('data-board-depth-ready'),null,{timeout:15000});
 }
 report.lifecycleCycles=(report.lifecycleCycles||0)+3;
 await context.close();
 }assert.equal(report.errors.length,0);report.ok=true;}finally{fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
