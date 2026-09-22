'use strict';
// Isolated real Board UI / keyboard integration. Hooks are served only by this
// Playwright route; no test overrides are present in the shipped game script.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||'C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node/df473e5367fa2b42/bin/node_modules/playwright');
const ROOT=path.resolve(__dirname,'..'),BASE=process.env.BOARD_QA_URL||'http://127.0.0.1:18931';
const OUT=process.env.BOARD_QA_OUTPUT||'D:/Codex_QA/hotkeys-fx-20260922/game';fs.mkdirSync(OUT,{recursive:true});
const report={checks:[],errors:[],base:BASE};
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});if(!pass)throw Error(name);}
const anchor='window.__BOARD_GAME_DEBUG__ = {';
const source=fs.readFileSync(path.join(ROOT,'public/js/board_game.js'),'utf8');
if(source.split(anchor).length!==2)throw Error('Debug anchor changed');
const hooked=source.replace(anchor,()=>`shouldRunCpuAutoStep=()=>false;
 const qaChooseRoute=chooseRouteFromMap;chooseRouteFromMap=(id)=>{window.__hotkeyRouteCalls=(window.__hotkeyRouteCalls||[]).concat(id);return qaChooseRoute(id);};
 ${anchor} hotkeyQa:{ui:()=>boardHotkeys,canRun:canRunBoardHotkey,lan:boardLan,openModal,routeDirectionFromIsland,locks:()=>({openingStoryActive,itemReveal:itemRevealIsPending(),turnHandoff:!!turnHandoffVisualLock,remote:remoteBoardPlaybackBusy(),cpu:isCpuPlayer(currentPlayer()),ship:canOpenShipActionsFor(currentPlayer()),game:isGameActionLocked()})},`);
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900}});
  await context.addInitScript(()=>{if(!/^https?:$/.test(location.protocol))return;localStorage.setItem('op_board_user_id','892231');localStorage.setItem('op_board_client_id','qa-hotkey-892231');localStorage.setItem('op_name','快捷鍵隔離驗證');localStorage.setItem('op_player_name','快捷鍵隔離驗證');});
  await context.route('**/js/board_game.js*',route=>route.fulfill({contentType:'application/javascript',body:hooked}));
  const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto(BASE+'/board_game.html?hotkey_qa=1&skipOpeningStory=1');
  await page.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.hotkeyQa.ui(),null,{timeout:30000});
  await page.evaluate(()=>{
   const d=__BOARD_GAME_DEBUG__,s=d.getState(),g=s.gameState,p=g.players[0];
   g.phase='main';g.currentPlayerIndex=0;g.pendingMove=null;g.routePrompt=null;g.islandDecision=null;g.resolutionLock=false;g.diceRolling=false;g.movementAnimating=false;g.turnStep='停靠結算';
   p.userId=BoardShared.getState().profile.userId;p.clientId='qa-hotkey-892231';p.isCPU=false;p.isCpu=false;p.cpu=false;p.crew=BoardCards.cards.slice(0,3).map(c=>d.cloneFreshDraftRecruit(c));p.activeCrewIndex=0;p.coins=100000;p.bounty=100000;p.pendingIslandServiceChoice=null;g.players=[p];
   d.recalcPlayerDerivedStats(p);d.normalizeLoadedGameState();d.closeModal();d.renderAll();window.__hotkeyBase=JSON.stringify(g);
  });
  const panel=async(key,selector,name)=>{await page.keyboard.press(key);const visible=await page.locator(selector).isVisible();check(name,visible,visible?undefined:await page.evaluate(()=>({locks:__BOARD_GAME_DEBUG__.hotkeyQa.locks(),canInventory:__BOARD_GAME_DEBUG__.hotkeyQa.canRun('inventory'),focus:{tag:document.activeElement?.tagName,id:document.activeElement?.id},modal:document.querySelector('#boardModal')?.className,bindings:__BOARD_GAME_DEBUG__.hotkeyQa.ui().bindings,game:((g)=>({phase:g.phase,trade:g.tradePrompt,activeTrade:g.activeTrade,island:g.islandDecision,coop:g.coopBattlePrompt,resolution:g.resolutionLock,pendingMove:g.pendingMove} ))(__BOARD_GAME_DEBUG__.getState().gameState),required:__BOARD_GAME_DEBUG__.getCurrentPlayer().pendingIslandServiceChoice})));};
  await panel('b','#closeItemModalBtn','B opens actual backpack');
  await panel('q','#journalCloseMissionBtn','Q switches backpack directly to actual mission journal');
  check('Switch removes previous backpack',await page.locator('#closeItemModalBtn').count()===0);
  await panel('c','#closeCrewManageBtn','C switches to actual crew roster');
  await page.keyboard.press('c');check('Same shortcut closes panel',!await page.locator('#boardModalBack').evaluate(e=>e.classList.contains('open')));
  await panel('f','#closeFleetInfoBtn','F opens fleet');await panel('v','#closeShipInfoBtn','V switches to ship');
  await panel('g','dialog.adventure-gallery[open]','G switches to collection dialog');
  await panel('b','#closeItemModalBtn','B switches from native collection dialog');
  check('Collection closes when switching',await page.locator('dialog.adventure-gallery[open]').count()===0);
  await page.keyboard.press('Home');check('Home returns to current player and closes menu',await page.evaluate(()=>__BOARD_GAME_DEBUG__.getState().autoCenterEnabled&&!document.querySelector('#boardModalBack.open')));
  await page.keyboard.press('m');check('M opens whole map',await page.evaluate(()=>!__BOARD_GAME_DEBUG__.getState().autoCenterEnabled));
  await page.keyboard.press('Home');check('Home restores player following',await page.evaluate(()=>__BOARD_GAME_DEBUG__.getState().autoCenterEnabled));
  await page.keyboard.press('k');check('K opens shortcut settings',await page.getByRole('dialog',{name:'快捷鍵設定',exact:true}).isVisible());
  await page.screenshot({path:path.join(OUT,'settings-desktop.png')});
  await page.setViewportSize({width:390,height:844});
  check('Settings fits phone viewport',await page.getByRole('dialog',{name:'快捷鍵設定',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.top>=0&&r.bottom<=innerHeight+1;}));
  await page.screenshot({path:path.join(OUT,'settings-mobile.png')});await page.keyboard.press('Escape');await page.setViewportSize({width:1440,height:900});
  check('Escape closes settings without game action',await page.locator('dialog[open]').count()===0&&await page.locator('#closeItemModalBtn').count()===0);
  await page.evaluate(()=>{const input=document.createElement('input');input.id='qa-key-input';document.body.appendChild(input);input.focus();});
  await page.keyboard.type('bqc');check('Typing does not trigger menus',await page.inputValue('#qa-key-input')==='bqc'&&!await page.locator('#boardModalBack').evaluate(e=>e.classList.contains('open')));
  await page.evaluate(()=>document.getElementById('qa-key-input').remove());
  await page.keyboard.down('b');await page.keyboard.down('b');await page.keyboard.up('b');check('Key repeat does not toggle menu twice',await page.locator('#closeItemModalBtn').isVisible());await page.keyboard.press('b');
  for(const [flag,value] of [['diceRolling',true],['movementAnimating',true],['resolutionLock',true]]){
   await page.evaluate(([flag,value])=>__BOARD_GAME_DEBUG__.getState().gameState[flag]=value,[flag,value]);await page.keyboard.press('b');check(flag+' blocks menu',!await page.locator('#boardModalBack').evaluate(e=>e.classList.contains('open')));await page.evaluate(flag=>__BOARD_GAME_DEBUG__.getState().gameState[flag]=false,flag);
  }
  for(const selector of ['#itemRevealHud','#evolutionHud']){await page.locator(selector).evaluate(e=>e.classList.add('show'));await page.keyboard.press('b');check(selector+' reveal blocks map shortcuts',!await page.locator('#boardModalBack').evaluate(e=>e.classList.contains('open')));await page.locator(selector).evaluate(e=>e.classList.remove('show'));}
  await page.evaluate(()=>__BOARD_GAME_DEBUG__.hotkeyQa.openModal('<button id="qa-required">必須先選擇</button>','force-choice'));
  await page.keyboard.press('b');await page.keyboard.press('Home');check('Required choice cannot be dismissed by shortcuts',await page.locator('#qa-required').isVisible());await page.evaluate(()=>__BOARD_GAME_DEBUG__.closeModal());
  await page.evaluate(()=>__BOARD_GAME_DEBUG__.getState().battleState={});await page.keyboard.press('b');check('Battle blocks map shortcuts',!await page.locator('#boardModalBack').evaluate(e=>e.classList.contains('open')));await page.evaluate(()=>__BOARD_GAME_DEBUG__.getState().battleState=null);
  await page.evaluate(()=>__BOARD_GAME_DEBUG__.getCurrentPlayer().isCPU=true);await page.keyboard.press('b');await page.keyboard.press('Space');check('CPU cannot be driven through player hotkeys',await page.evaluate(()=>!document.querySelector('#boardModalBack.open')&&!__BOARD_GAME_DEBUG__.getState().gameState.pendingMove));await page.evaluate(()=>__BOARD_GAME_DEBUG__.getCurrentPlayer().isCPU=false);
  await page.evaluate(()=>{const d=__BOARD_GAME_DEBUG__;Object.assign(d.hotkeyQa.lan,{enabled:true,connected:true,awaitingInitialState:false,clientId:'qa-hotkey-892231'});Object.assign(d.getCurrentPlayer(),{userId:892239,clientId:'foreign-client'});});
  await page.keyboard.press('Space');await page.keyboard.press('b');check('Foreign turn rejects action and menu keys',await page.evaluate(()=>!document.querySelector('#boardModalBack.open')&&!__BOARD_GAME_DEBUG__.getState().gameState.pendingMove));
  await page.evaluate(()=>{const d=__BOARD_GAME_DEBUG__;d.hotkeyQa.lan.enabled=false;Object.assign(d.getCurrentPlayer(),{userId:892231,clientId:'qa-hotkey-892231'});});
  for(const [direction,key] of [['north','ArrowUp'],['south','ArrowDown'],['west','ArrowLeft'],['east','ArrowRight'],['special','r']]){
   const routeId=await page.evaluate(direction=>{const d=__BOARD_GAME_DEBUG__,g=d.getState().gameState,p=d.getCurrentPlayer();const route=g.boardData.routesBetweenIslands.find(r=>!r.meta?.uniqueBranch&&(r.directions?.from===direction||r.directions?.to===direction));if(!route)throw Error('No real route for '+direction);const islandId=route.directions.from===direction?route.from:route.to;p.location={kind:'island',islandId};p.routeChoice=null;g.routePrompt={playerId:p.id,islandId,stepsRemaining:0,routeIds:[route.id]};g.pendingMove=null;window.__hotkeyRouteCalls=[];return route.id;},direction);
   await page.keyboard.press(key);check(direction+' selects the actual allowed route',await page.evaluate(id=>window.__hotkeyRouteCalls.length===1&&window.__hotkeyRouteCalls[0]===id&&__BOARD_GAME_DEBUG__.getState().gameState.routePrompt===null,routeId));
  }
  const multi=await page.evaluate(()=>{const d=__BOARD_GAME_DEBUG__,g=d.getState().gameState,p=d.getCurrentPlayer();for(const island of g.boardData.islands){for(const direction of ['north','south','west','east']){const routes=g.boardData.routesBetweenIslands.filter(r=>d.hotkeyQa.routeDirectionFromIsland(r,island.id)===direction);if(routes.length>1){p.location={kind:'island',islandId:island.id};g.routePrompt={playerId:p.id,islandId:island.id,stepsRemaining:0,routeIds:routes.map(r=>r.id)};window.__hotkeyRouteCalls=[];return{direction,count:routes.length};}}}for(const island of g.boardData.islands){const routes=g.boardData.routesBetweenIslands.filter(r=>!r.meta?.uniqueBranch&&(r.from===island.id||r.to===island.id)).slice(0,2);if(routes.length===2){for(const route of routes)route.directions[route.from===island.id?'from':'to']='east';p.location={kind:'island',islandId:island.id};g.routePrompt={playerId:p.id,islandId:island.id,stepsRemaining:0,routeIds:routes.map(r=>r.id)};window.__hotkeyRouteCalls=[];return{direction:'east',count:2,fixture:'isolated shared-heading metadata'};}}return null;});
  if(multi){await page.keyboard.press({north:'ArrowUp',south:'ArrowDown',west:'ArrowLeft',east:'ArrowRight'}[multi.direction]);check('Ambiguous direction opens explicit route choices',await page.locator('[data-hotkey-route]').count()===multi.count);await page.keyboard.press('Enter');check('Enter chooses one explicit route',await page.evaluate(()=>window.__hotkeyRouteCalls.length===1));}else throw Error('No multi-route fixture found');
  await page.evaluate(()=>{const d=__BOARD_GAME_DEBUG__;d.getState().gameState=JSON.parse(window.__hotkeyBase);d.closeModal();d.renderAll();d.getCurrentPlayer().presetStep=1;});
  await page.keyboard.press('Space');check('Space performs actual dice/movement action',await page.evaluate(()=>__BOARD_GAME_DEBUG__.getCurrentPlayer().presetStep===null&&__BOARD_GAME_DEBUG__.getState().gameState.lastRoll===1));
  check('No hotkey preferences enter saved game state',await page.evaluate(()=>!Object.keys(__BOARD_GAME_DEBUG__.getState().gameState).some(k=>/hotkey|shortcut/i.test(k))));
  const seed=await page.evaluate(()=>window.__hotkeyBase);
  const wrapper=await context.newPage();wrapper.on('pageerror',e=>report.errors.push(e.message));
  await wrapper.goto(BASE+'/board_fixed_viewport.html?hotkey_qa=1&skipOpeningStory=1');
  const boardFrame=await(await wrapper.waitForSelector('#boardFixedFrame')).contentFrame();
  await boardFrame.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.hotkeyQa.ui(),null,{timeout:30000});
  await boardFrame.evaluate(seed=>{const d=__BOARD_GAME_DEBUG__;d.getState().gameState=JSON.parse(seed);d.closeModal();d.renderAll();},seed);
  await boardFrame.locator('#boardToolsToggle').click();await wrapper.keyboard.press('k');
  check('Shortcut works inside actual fixed viewport iframe',await boardFrame.getByRole('dialog',{name:'快捷鍵設定',exact:true}).isVisible());
  await wrapper.screenshot({path:path.join(OUT,'settings-fixed-viewport.png')});
  await wrapper.keyboard.press('Escape');check('Fixed viewport dialog Escape closes',await boardFrame.locator('dialog[open]').count()===0);
  check('No game browser JS errors',report.errors.length===0,report.errors);
 }catch(error){report.fatal=error.stack;process.exitCode=1;}finally{await browser.close();}
 report.ok=!report.fatal&&report.checks.every(c=>c.pass)&&report.errors.length===0;fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,failed:report.checks.filter(c=>!c.pass),errors:report.errors,fatal:report.fatal,output:OUT}));
})();
