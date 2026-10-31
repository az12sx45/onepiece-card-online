import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{chromium}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname.slice(1)),'..');
const mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/app/src/main/assets/mobile';
const ios='D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile';
const out=process.env.CARD_QA_OUT||'C:/Codex_QA/card-venue-ready-20261031';fs.mkdirSync(out,{recursive:true});
const port=30969,origin=`http://127.0.0.1:${port}`,report={passed:false,checks:[],errors:[],scope:'Three Chromium clients with exact desktop/v059 Android/iOS bundles plus three CPU; isolated server with test-process-only state seeds, original engine/actions/Socket.IO, private read, CPU duel, next-round gates; no physical-device claim.'};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
const server=spawn(process.execPath,['scripts/card_group_server_fixture.js'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port)},stdio:['pipe','pipe','pipe']});let log='',browser;server.stdout.on('data',b=>log+=b);server.stderr.on('data',b=>log+=b);const pages=[];
const action=(p,type,payload={})=>p.evaluate(({type,payload})=>socket.emit('ACTION',{...me,type,payload}),{type,payload});
try{
 for(let i=0;i<100&&!log.includes('Server listening');i++){if(server.exitCode!==null)throw Error(log.slice(-1800));await new Promise(r=>setTimeout(r,150));}
 check('isolated original server listening',log.includes('Server listening'));
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
 for(const p of pages){await p.locator('#phoneVenueContinue').waitFor({state:'visible'});await p.waitForFunction(()=>!document.getElementById('phoneVenueContinue').disabled);await p.locator('#phoneVenueContinue').click();}
 for(const p of pages)await p.waitForFunction(()=>!window.__raw?.venueReady?.waiting&&!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.isVenueEntering());
 async function seed(scenario){server.stdin.write(JSON.stringify({room,scenario})+'\n');await pages[0].waitForFunction(()=>window.__raw?.presentationReady?.waiting);}
 async function released(){for(const p of pages)await p.waitForFunction(()=>window.__raw?.presentationReady?.waiting===false,{},{timeout:60000});}
 const seats=await Promise.all(pages.map(p=>p.evaluate(()=>me.playerId)));const hostId=seats[0];const spectator=pages[2];
 await spectator.evaluate(()=>CardPhonePresentation.openCardLibrary());
 await seed('peek');
 await pages[0].waitForFunction(()=>window.__raw.presentationReady.waiting&&window.__raw.presentationReady.ready.length===2,{},{timeout:30000});
 check('all-human barrier waits for slow reader',await pages[0].evaluate(()=>window.__raw.presentationReady.waiting&&window.__raw.presentationReady.ready.length===2));
 for(const [i,p]of pages.slice(0,2).entries()){const fit=await p.locator('#cardActiveTurn').evaluate(n=>{const b=n.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth+1&&b.top>=0&&b.bottom<=innerHeight;});check('waiting status fits viewport '+i,fit);}
 await action(pages[0],'PLAY_CARD',{which:'hand'});await pages[0].waitForTimeout(350);
 check('playing cannot bypass another readers gate',await pages[0].evaluate(id=>window.__raw.players[id].hand===2,hostId));
 await spectator.locator('.phone-library-head button').click();await released();
 await action(pages[0],'PLAY_CARD',{which:'hand'});await pages[0].waitForFunction(()=>window.__raw.pending?.action==='robin'||document.querySelector('#phonePrivateReveal:not([hidden])'),{},{timeout:30000});
 if(await pages[0].evaluate(()=>window.__raw.pending?.action==='robin')){await released();check('target choice is unlocked after card entry without stage deadlock',true);await action(pages[0],'PICK_TARGET',{target:seats[1]});}
 await pages[0].locator('#phonePrivateReveal:not([hidden])').waitFor({timeout:30000});
 await pages[1].waitForFunction(()=>window.__raw.presentationReady.ready.length===2,{},{timeout:30000});
 const before=await pages[1].evaluate(()=>({round:window.__raw.roundNo,turn:window.__raw.turnIndex,step:window.__raw.turnStep,deck:window.__raw.deck.length}));
 const actor=pages[seats.indexOf(before.turn)];
 await action(actor,'DRAW');await pages[0].waitForTimeout(1200);
 check('next turn waits until private reader closes card',await pages[1].evaluate(b=>window.__raw.turnIndex===b.turn&&window.__raw.turnStep===b.step&&window.__raw.deck.length===b.deck,before));
 await pages[0].locator('#phonePrivateReveal button').last().click();await released();
 await action(actor,'DRAW');await actor.waitForFunction(()=>state.turnStep==='choose');await released();
 check('next turn draw resumes after everyone finishes',true);
 // Queue a CPU-only winning round while one human is still reading.
 await spectator.evaluate(()=>CardPhonePresentation.openCardLibrary());await seed('cpu-final');await pages[0].waitForTimeout(1800);
 check('CPU waits for all viewers before its first action',await pages[0].evaluate(()=>window.__raw.players[window.__raw.turnIndex].isCPU&&window.__raw.turnStep==='choose'&&!window.__raw.pending&&window.__raw.discard.length===2));
 await spectator.locator('.phone-library-head button').click();
 // Only this test viewer opens its existing library as the winning STATE arrives.
 await spectator.evaluate(()=>{window.__holdFinal=true;socket.onAny((event,s)=>{if(event==='STATE'&&s?.turnStep==='ended'&&window.__holdFinal){window.__holdFinal=false;CardPhonePresentation.openCardLibrary();}});});
 await pages[0].waitForFunction(()=>window.__raw.turnStep==='ended',{},{timeout:90000});
 const endedRound=await pages[0].evaluate(()=>window.__raw.roundNo);
 await pages[0].waitForTimeout(4500);
 check('auto next round waits beyond old three-second timeout',await pages[0].evaluate(round=>window.__raw.roundNo===round&&window.__raw.presentationReady.waiting,endedRound));
 await action(pages[0],'NEXT_ROUND');await pages[0].waitForTimeout(300);
 check('host cannot force next round while viewer is still reading',await pages[0].evaluate(round=>window.__raw.roundNo===round,endedRound));
 await spectator.locator('.phone-library-head button').click();
 for(const p of pages)await p.waitForFunction(round=>window.__raw.roundNo===round+1&&window.__raw.venueReady.waiting,endedRound,{timeout:90000});
 check('CPU round completes and next round gets fresh venue gate',true);
 for(const p of pages){await p.locator('#phoneVenueContinue').waitFor({state:'visible',timeout:60000});await p.waitForFunction(()=>!document.getElementById('phoneVenueContinue').disabled,{},{timeout:60000});}
 for(const p of pages.slice(0,2))await p.locator('#phoneVenueContinue').click();await pages[0].waitForFunction(()=>window.__raw.venueReady.ready.length===2);
 await pages[0].waitForTimeout(1500);
 check('new round waits for last venue reader',await pages[0].evaluate(()=>window.__raw.venueReady.waiting&&window.__raw.turnStep==='draw'));
 await spectator.locator('#phoneVenueContinue').click();for(const p of pages)await p.waitForFunction(()=>!window.__raw.venueReady.waiting);
 check('new round releases after all venue readers finish',true);
 check('no page errors',report.errors.length===0,report.errors);report.passed=true;
}catch(e){report.failure=e.stack;report.log=log.slice(-1600);for(const p of pages)report.checks.push({diagnostic:await p.evaluate(()=>({seat:me.playerId,players:state?.players?.length,gate:window.__raw?.venueReady,presentation:window.__raw?.presentationReady,local:state?.presentationReady,queue:CardPhonePresentation.presentationQueueSize(),busy:CardPhonePresentation.presentationEffectsBusy(),intro:document.getElementById('phoneVenueIntro')?.hidden,button:document.getElementById('phoneVenueContinue')?.outerHTML})).catch(()=>null)});process.exitCode=1;}
finally{await browser?.close();spawnSync('taskkill',['/PID',String(server.pid),'/T','/F'],{windowsHide:true});fs.writeFileSync(out+'/browser.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
