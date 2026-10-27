import fs from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root='D:/Codex_Release_Worktrees/board-multiplayer-authority-20261025',out='D:/Codex_QA/card-action-clarity-20261027/sync.json',port=30929,origin=`http://127.0.0.1:${port}`;
const child=spawn('cmd.exe',['/d','/s','/c','npm.cmd start'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});
let log='',browser;child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
const report={scope:'Two isolated Chromium windows using the real local npm-start server and Socket.IO. Guest room, no production accounts or physical-device claim.',checks:[],passed:false};
const check=(name,ok,detail)=>{report.checks.push({name,ok,detail});if(!ok)throw Error(name+': '+JSON.stringify(detail));};
const action=(p,type,payload={})=>p.evaluate(({type,payload})=>socket.emit('ACTION',{...me,type,payload}),{type,payload});
try{
 for(let i=0;i<100&&!log.includes('Server listening');i++){if(child.exitCode!==null)throw Error(log.slice(-2000));await new Promise(r=>setTimeout(r,150));}
 check('npm start listening',log.includes('Server listening'));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const pages=[],room='QA-clarity-'+Date.now();
 for(let i=0;i<2;i++){
  const ctx=await browser.newContext({viewport:{width:1366,height:768},userAgent:'ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',serviceWorkers:'block'});
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve()};});
  const p=await ctx.newPage();p.setDefaultTimeout(12000);await p.goto(origin+'/game.html?room='+room+'&name=QA'+i,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof me!=='undefined'&&me.playerId!==null&&state?.players?.length>0);
  await p.evaluate(()=>{window.__events=[];socket.on('EMIT',e=>window.__events.push(e));});pages.push(p);
 }
 await pages[0].waitForFunction(()=>state.players.length===2);check('both guests joined',await pages[1].evaluate(()=>state.players.length===2));
 for(const p of pages)await action(p,'LOBBY_READY');await pages[0].waitForTimeout(200);await action(pages[0],'START_GAME');
 for(const p of pages)await p.waitForFunction(()=>window.__events.some(e=>e.type==='nav_game'));
 check('start synchronized',await pages[0].evaluate(()=>state.players.length===2&&state.players.every(p=>p.client)));
 const before=await pages[0].evaluate(()=>({turn:state.turnIndex,step:state.turnStep}));
 let actor;for(const p of pages)if(await p.evaluate(()=>me.playerId===state.turnIndex))actor=p;
 check('one authoritative current player',!!actor,before);
 await action(actor,'DRAW');await actor.waitForFunction(()=>state.turnStep==='choose');
 for(const p of pages)await p.waitForFunction(()=>state.turnStep==='choose');
 check('draw step broadcast to both',await pages[0].evaluate(()=>state.turnStep==='choose'));
 const old=await pages[1].evaluate(()=>({id:me.playerId,secret:me.secret,turn:state.turnIndex,step:state.turnStep}));
 await pages[1].reload({waitUntil:'domcontentloaded'});await pages[1].waitForFunction(()=>me.playerId!==null&&state?.turnStep==='choose');
 const fresh=await pages[1].evaluate(()=>({id:me.playerId,secret:me.secret,turn:state.turnIndex,step:state.turnStep}));
 check('refresh restores same seat and turn',JSON.stringify(old)===JSON.stringify(fresh),{seat:fresh.id,turn:fresh.turn,step:fresh.step});
 check('private other hand stays hidden',await pages[1].evaluate(()=>state.players.filter(p=>p.id!==me.playerId).every(p=>p.hand==null||p.hand===-1)));
 report.passed=true;
}catch(e){report.failure=e.stack;report.log=log.slice(-2500);process.exitCode=1;}
finally{await browser?.close();spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
