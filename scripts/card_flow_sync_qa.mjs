import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='D:/Codex_Release_Worktrees/board-multiplayer-authority-20261025',out=process.env.CARD_QA_REPORT||'D:/Codex_QA/card-action-clarity-20261027/sync.json',port=30929,origin=`http://127.0.0.1:${port}`;
const child=spawn('cmd.exe',['/d','/s','/c','npm.cmd start'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});
let log='',browser;const pages=[];child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
const report={scope:'Two isolated Chromium windows using the real local npm-start server and Socket.IO. Guest room with stable isolated test identities, no production accounts or physical-device claim.',checks:[],passed:false};
const check=(name,ok,detail)=>{report.checks.push({name,ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));};
const action=(p,type,payload={})=>p.evaluate(({type,payload})=>socket.emit('ACTION',{...me,type,payload}),{type,payload});
try{
 for(let i=0;i<100&&!log.includes('Server listening');i++){if(child.exitCode!==null)throw Error(log.slice(-2000));await new Promise(r=>setTimeout(r,150));}
 check('npm start listening',log.includes('Server listening'));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const room='QA-clarity-'+Date.now();
 for(let i=0;i<2;i++){
  const ctx=await browser.newContext({viewport:{width:1366,height:768},userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1',serviceWorkers:'block'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;if(!localStorage.getItem('opSecret'))localStorage.setItem('opSecret','qa-cinema-'+crypto.randomUUID());HTMLMediaElement.prototype.play=function(){return Promise.resolve()};});
  const p=await ctx.newPage();p.setDefaultTimeout(12000);await p.goto(origin+'/game.html?room='+room+'&name=QA'+i,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof me!=='undefined'&&me.playerId!==null&&state?.players?.length>0);
  await p.waitForTimeout(250);if(await p.locator('#phoneVenueIntro:not([hidden])').count())await p.locator('#phoneVenueContinue').click();await p.evaluate(()=>{window.__events=[];socket.on('EMIT',e=>window.__events.push(e));});pages.push(p);
 }
 await pages[0].waitForFunction(()=>state.players.length===2);check('both guests joined',await pages[1].evaluate(()=>state.players.length===2));
 for(const p of pages)await action(p,'LOBBY_READY');await pages[0].waitForTimeout(200);await action(pages[0],'START_GAME');
 for(const p of pages){await p.waitForFunction(()=>window.__events.some(e=>e.type==='nav_game'));await p.waitForTimeout(250);if(await p.locator('#phoneVenueIntro:not([hidden])').count())await p.locator('#phoneVenueContinue').click();}
 check('start synchronized',await pages[0].evaluate(()=>state.players.length===2&&state.players.every(p=>p.client)));
 const before=await pages[0].evaluate(()=>({turn:state.turnIndex,step:state.turnStep}));
 let actor;for(const p of pages)if(await p.evaluate(()=>me.playerId===state.turnIndex))actor=p;
 check('one authoritative current player',!!actor,before);
 const viewer=pages.find(p=>p!==actor);await viewer.evaluate(()=>CardPhonePresentation.openCardLibrary());await action(actor,'DRAW');await actor.waitForFunction(()=>state.turnStep==='choose');await viewer.waitForTimeout(350);check('real next state waits while viewer reads',await viewer.evaluate(()=>state.turnStep==='draw'&&CardPhonePresentation.presentationQueueSize()>0));await viewer.locator('.phone-library-head button').click();
 for(const p of pages)await p.waitForFunction(()=>state.turnStep==='choose');
 check('draw step broadcast to both',await pages[0].evaluate(()=>state.turnStep==='choose'));
 const old=await pages[1].evaluate(()=>({id:me.playerId,secret:me.secret,turn:state.turnIndex,step:state.turnStep}));
 await pages[1].reload({waitUntil:'domcontentloaded'});await pages[1].waitForFunction(()=>me.playerId!==null&&state?.turnStep==='choose');
 const fresh=await pages[1].evaluate(()=>({id:me.playerId,secret:me.secret,turn:state.turnIndex,step:state.turnStep}));
 check('refresh restores same seat and turn',JSON.stringify(old)===JSON.stringify(fresh),{seat:fresh.id,turn:fresh.turn,step:fresh.step});
 check('private other hand stays hidden',await pages[1].evaluate(()=>state.players.filter(p=>p.id!==me.playerId).every(p=>p.hand==null||p.hand===-1)));
 report.passed=true;
}catch(e){report.clients=await Promise.all(pages.map(p=>p.evaluate(()=>({room:me.roomId,seat:me.playerId,players:state?.players?.map(p=>({id:p.id,name:p.displayName})),step:state?.turnStep})).catch(()=>null)));report.failure=e.stack;report.log=log.slice(-2500);process.exitCode=1;}
finally{await browser?.close();spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
