import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)),'..');
const mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/app/src/main/assets/mobile';
const ios='D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile';
const out=process.env.CARD_QA_OUT||'C:/Codex_QA/card-venue-ready-20261031';fs.mkdirSync(out,{recursive:true});
const port=30959,origin=`http://127.0.0.1:${port}`,report={passed:false,checks:[],errors:[],scope:'Three isolated Chromium clients: desktop and exact released v059 Android/iOS bundles, three CPU seats; real npm-start Socket.IO, no physical-device claim.'};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
const server=spawn('cmd.exe',['/d','/s','/c','npm.cmd start'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});let log='',browser;server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);const pages=[];
const action=(p,type,payload={})=>p.evaluate(({type,payload})=>socket.emit('ACTION',{...me,type,payload}),{type,payload});
try{
 for(let i=0;i<100&&!log.includes('Server listening');i++){if(server.exitCode!==null)throw Error(log.slice(-1800));await new Promise(r=>setTimeout(r,150));}
 check('npm start listening',log.includes('Server listening'));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const room='QA-venue-'+Date.now();
 for(const [index,bundle,width,height] of [[0,null,1366,768],[1,mobile,844,390],[2,ios,740,360]]){
  const context=await browser.newContext({viewport:{width,height},hasTouch:!!bundle,serviceWorkers:'block',userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1'});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const script=bundle?fs.readFileSync(bundle+'/game-mobile.js','utf8'):'',css=bundle?fs.readFileSync(bundle+'/game-mobile.css','utf8'):'';
  await context.addInitScript({content:`window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};${script}\n${bundle?`const st=document.createElement('style');st.textContent=${JSON.stringify(css)};new MutationObserver((_,o)=>{if(document.documentElement){document.documentElement.append(st);o.disconnect()}}).observe(document,{childList:true});`:''}`});
  const p=await context.newPage();p.setDefaultTimeout(15000);p.on('pageerror',e=>report.errors.push(e.message));
  await p.goto(origin+'/game.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>typeof me!=='undefined');
  await p.evaluate(({room,index})=>{me.roomId=room;me.secret='qa-venue-'+index+'-'+room;socket.onAny((event,s)=>{if(event==='STATE')window.__raw=s});socket.emit('JOIN_ROOM',{roomId:room,displayName:'QA'+index,secret:me.secret,cpuCount:3});},{room,index});
  await p.waitForFunction(()=>me.playerId!==null&&state?.players?.length>0);await p.waitForTimeout(200);if(await p.locator('#phoneVenueIntro:not([hidden])').count())await p.locator('#phoneVenueContinue').click();pages.push(p);
 }
 await pages[0].waitForFunction(()=>state.players.length===3);
 for(const p of pages)await action(p,'LOBBY_READY');await pages[0].waitForTimeout(150);await action(pages[0],'START_GAME');
 for(const p of pages)await p.waitForFunction(()=>window.__raw?.venueReady?.waiting&&state?.players?.length===6);
 const first=await pages[0].evaluate(()=>({gate:window.__raw.venueReady,turn:window.__raw.turnIndex,step:window.__raw.turnStep,deck:window.__raw.deck.length}));
 check('six seats wait for three humans only',first.gate.required.length===3&&first.gate.ready.length===0);
 for(const [index,p] of pages.entries()){
  await p.locator('#phoneVenueContinue').waitFor({state:'visible'});await p.waitForFunction(()=>!document.getElementById('phoneVenueContinue').disabled);
  const fit=await p.locator('#phoneVenueContinue').evaluate(n=>{const r=n.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1&&r.left>=0&&r.right<=innerWidth+1});check('confirmation fits '+index,fit);
 }
 await pages[0].keyboard.press('Escape');check('Escape does not confirm',await pages[0].evaluate(()=>window.__raw.venueReady.ready.length===0));
 for(const p of pages)await action(p,'DRAW');await pages[0].waitForTimeout(600);
 check('premature human or CPU draw cannot advance',await pages[0].evaluate(first=>window.__raw.deck.length===first.deck&&window.__raw.turnStep===first.step,first));
 await pages[0].locator('#phoneVenueContinue').click();await pages[0].waitForFunction(()=>window.__raw.venueReady.ready.length===1);
 check('first reader stays in waiting panel',await pages[0].locator('#phoneVenueIntro').isVisible());
 await pages[1].locator('#phoneVenueContinue').click();await pages[0].waitForFunction(()=>window.__raw.venueReady.ready.length===2);
 check('last unread reader blocks round',await pages[0].evaluate(()=>window.__raw.venueReady.waiting));
 const identity=await pages[2].evaluate(()=>({...me}));
 await pages[0].evaluate(({identity,gate})=>socket.emit('ACTION',{...identity,type:'VENUE_READY',payload:{id:gate.id,roundNo:gate.roundNo}}),{identity,gate:first.gate});
 await pages[0].waitForTimeout(300);check('another socket cannot confirm for unread player',await pages[0].evaluate(()=>window.__raw.venueReady.ready.length===2));
 if(process.env.CARD_QA_HOLD==='1'){
  await pages[0].waitForTimeout(32000);
  check('reading is not converted to CPU by idle watchdog',await pages[0].evaluate(()=>window.__raw.venueReady.waiting&&window.__raw.players.filter(p=>!p.isCPU).length===3&&window.__raw.turnStep==='draw'));
 }

 await pages[2].reload({waitUntil:'domcontentloaded'});
 // Manual fixture identities survive the normal reconnect via stored secret.
 await pages[2].evaluate(({room})=>{me.roomId=room;me.secret='qa-venue-2-'+room;socket.onAny((event,s)=>{if(event==='STATE')window.__raw=s});socket.emit('JOIN_ROOM',{roomId:room,displayName:'QA2',secret:me.secret});},{room});
 await pages[2].waitForFunction(()=>window.__raw?.venueReady?.waiting&&window.__raw.venueReady.ready.length===2);
 check('unread reconnect retains two confirmations',await pages[2].evaluate(()=>!window.__raw.venueReady.ready.includes(me.playerId)));
 await pages[2].waitForFunction(()=>!document.getElementById('phoneVenueContinue')?.disabled);
 await pages[2].locator('#phoneVenueContinue').click();
 for(const p of pages)await p.waitForFunction(()=>window.__raw?.venueReady?.waiting===false&&document.getElementById('phoneVenueIntro').hidden);
 check('all three release together without animation-queue deadlock',true);
 let actor;for(const p of pages)if(await p.evaluate(()=>me.playerId===window.__raw.turnIndex))actor=p;
 if(actor)await action(actor,'DRAW');
 await pages[0].waitForFunction(()=>window.__raw.turnStep==='choose'||window.__raw.deck.length<state.deck.length||window.__raw.discard.length>0,{},{timeout:15000});
 check('human or CPU can act after release',true);
 check('no page errors',report.errors.length===0,report.errors);
 report.passed=true;
}catch(e){report.failure=e.stack;report.log=log.slice(-1600);for(const p of pages)report.checks.push({diagnostic:await p.evaluate(()=>({seat:me.playerId,players:state?.players?.length,gate:window.__raw?.venueReady,intro:document.getElementById('phoneVenueIntro')?.hidden,button:document.getElementById('phoneVenueContinue')?.outerHTML})).catch(()=>null)});process.exitCode=1;}
finally{await browser?.close();spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true});fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
