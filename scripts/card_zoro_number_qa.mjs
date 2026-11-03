import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {readMobileSources} from 'file:///C:/Users/%E7%8E%8B%E6%9B%9C%E7%91%8B/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/mobile-sources.mjs';
const require=createRequire(import.meta.url),engine=require('../server/engine.js');
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const mode=process.env.PO_QA_MODE||'new',output=process.env.PO_QA_OUT||'D:/Codex_QA/card-zoro-number-20261103/'+mode;
fs.mkdirSync(output,{recursive:true});
const source=fs.readFileSync(mobile+'/android/web/card-zoro-result.js','utf8');
const report={scope:'Real engine public cardId and browser effect/result ordering. Isolated accounts and socket fixture; no physical-device acceptance.',checks:[],errors:[]};
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));}
function zoro(id,enhanced=false,protectedTarget=false){
 const s=engine.createInitialState(4);Object.assign(s,{phase:'playing',turnIndex:0,turnStep:'choose',venues:enhanced?[{name:'和之國'}]:[],discard:[{id:18,coverBy:'teach',owner:2}]});
 s.players.forEach((p,i)=>Object.assign(p,{alive:true,hand:i===0?5:i===1?id:i+7,tempDraw:i===0?2:null,displayName:'玩家'+i,client:{displayName:'玩家'+i,avatar:i+1},gold:10}));s.players[1].protected=protectedTarget;
 const before=engine.applyAction(s,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}).state;
 const result=engine.applyAction(before,{type:'PICK_TARGET',playerId:0,payload:{target:1}});
 return {before:engine.getVisibleState(before,0),after:engine.getVisibleState(result.state,0),events:result.emits.filter(e=>e.to==='all'||e.to===0)};
}
function helper(s){
 const lines=[],api={presentEffectEvent(){}},observers=[],handlers={};
 const layer={querySelectorAll:()=>lines};
 const context=vm.createContext({state:s,window:{CardPhonePresentation:api,__TABLETOP_ANDROID_TEST_ORIGIN:'http://fixture',addEventListener(){}},location:{origin:'http://fixture',pathname:'/game.html'},document:{readyState:'complete',hidden:false,getElementById:()=>layer,addEventListener(){}},socket:{on(n,fn){(handlers[n]??=[]).push(fn);}},setTimeout(fn){fn();},MutationObserver:class{constructor(fn){observers.push(fn)}observe(){}}});
 vm.runInContext(source,context);return {api,context,lines,flush:()=>observers.forEach(fn=>fn()),deliver:(n,s)=>handlers[n]?.forEach(fn=>fn(s))};
}
let server,browser;
try{
 for(const [id,enhanced]of [[0,false],[3,false],[4,true],[17,true],[19,true]]){
  const c=zoro(id,enhanced),h=helper(c.before),event=c.events.find(e=>e.type==='zoro_discard');
  check('engine emits explicit public cardId '+id,event?.to==='all'&&event.cardId===id);
  check(`engine ${enhanced?'enhanced':'normal'} ${id} confirms exactly the thrown card`,JSON.stringify(h.api.zoroDiscardCards(event))===JSON.stringify([id]),c.events);
  check('target hand remains hidden before result '+id,c.before.players[1].hand===null);
  h.api.presentEffectEvent(event);const line={textContent:'玩家0 → 玩家1：斬擊棄牌'};h.lines.push(line);h.flush();
  check('retained result names exact card including zero '+id,line.textContent===`玩家0 → 玩家1：砍掉 ${id} 號卡`,line.textContent);
  const missing={...event};delete missing.cardId;check('old server without cardId stays neutral '+id,h.api.zoroDiscardCards(missing).length===0);
 }
 const first=zoro(4,true),second=zoro(17,true),h=helper(first.before);
 const events=[...first.events,...second.events];
 check('multiple real enhanced result events keep their own numbers',JSON.stringify(events.filter(e=>e.type==='zoro_discard').map(e=>h.api.zoroDiscardCards(e)))==='[[4],[17]]');
 const blocked=zoro(8,false,true);
 check('blocked slash has no numbered discard result',!blocked.events.some(e=>e.type==='zoro_discard'));
 const c=zoro(0),event=c.events.find(e=>e.type==='zoro_discard'),old=helper(c.before),missing={...event};delete missing.cardId;
 check('old visible discards cannot substitute for missing cardId',old.api.zoroDiscardCards(missing).length===0);
 for(const cardId of [null,undefined,-1,20,'0',{},0.5])check('invalid result cardId is rejected '+JSON.stringify(cardId),old.api.zoroDiscardCards({...event,cardId}).length===0);
 check('private-recipient Zoro data is not treated as public',old.api.zoroDiscardCards({...event,to:1}).length===0);
 const teachState=engine.createInitialState(4);Object.assign(teachState,{phase:'playing',turnIndex:0,turnStep:'choose',venues:[]});teachState.players[0].hand=17;teachState.players[0].tempDraw=2;teachState.deck.push(18);
 const teachResult=engine.applyAction(teachState,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}),teachViewer=engine.getVisibleState(teachResult.state,1);
 check('real Teach result hides the covered identity from another viewer',teachViewer.discard.at(-1)?.back===true);
 check('real Teach silent/private card events are not numbered Zoro results',teachResult.emits.some(e=>e.type==='silent_discard'&&e.cards.includes(18))&&teachResult.emits.every(e=>old.api.zoroDiscardCards(e).length===0));
 const fallback=helper(c.before);fallback.api.presentEffectEvent(missing);fallback.lines.push({textContent:'玩家0 → 玩家1：斬擊棄牌'});fallback.flush();check('missing cardId keeps the original neutral result',fallback.lines[0].textContent==='玩家0 → 玩家1：斬擊棄牌');
 const mixed=helper(c.before);mixed.api.presentEffectEvent(missing);mixed.api.presentEffectEvent(event);mixed.lines.push({textContent:'玩家0 → 玩家1：斬擊棄牌'});mixed.flush();mixed.flush();mixed.lines.push({textContent:'玩家0 → 玩家1：斬擊棄牌'});mixed.flush();check('missing and numbered results for the same target do not cross-associate',mixed.lines[0].textContent==='玩家0 → 玩家1：斬擊棄牌'&&mixed.lines[1].textContent==='玩家0 → 玩家1：砍掉 0 號卡');
 const round=helper(c.before);round.api.presentEffectEvent(event);round.context.state={...c.before,roundNo:c.before.roundNo+1};round.api.presentEffectEvent(missing);round.lines.push({textContent:'玩家0 → 玩家1：斬擊棄牌'});round.flush();check('committed round change clears cancelled legacy result',round.lines[0].textContent==='玩家0 → 玩家1：斬擊棄牌');
 const future=helper(c.before);future.api.presentEffectEvent(event);future.deliver('STATE',{...c.before,roundNo:c.before.roundNo+1});future.lines.push({textContent:'玩家0 → 玩家1：斬擊棄牌'});future.flush();check('queued future STATE does not erase the displayed transaction result',future.lines[0].textContent==='玩家0 → 玩家1：砍掉 0 號卡');
 const identity=helper(c.before);identity.context.me={roomId:'A',playerId:0};identity.api.presentEffectEvent(event);identity.context.me={roomId:'B',playerId:0};identity.api.presentEffectEvent(missing);identity.lines.push({textContent:'玩家0 → 玩家1：斬擊棄牌'});identity.flush();check('committed identity change clears cancelled legacy result',identity.lines[0].textContent==='玩家0 → 玩家1：斬擊棄牌');

 const socketStub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(n,d)=>{for(const f of window.__any)f(n,d);for(const f of [...(window.__handlers[n]||[])])f(d)};window.io=()=>({connected:true,id:'zoro-fixture',on(n,f){(window.__handlers[n]??=[]).push(f);return this},onAny(f){window.__any.push(f);return this},once(){return this},listeners(n){return [...(window.__handlers[n]||[])]},off(n,f){window.__handlers[n]=(window.__handlers[n]||[]).filter(x=>x!==f);return this},emit(...a){window.__sent.push(a);return this},disconnect(){},connect(){}});`;
 const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
 server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'public','.'+name);
  if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  if(name.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(socketStub);return;}
  if(/\.(mp3|mp4|ogg|wav|webm|m4a|qa-disabled)$/i.test(name)){res.writeHead(204).end();return;}
  try{const ext=path.extname(file),data=fs.readFileSync(fs.existsSync(file)?file:path.join(mobile,'public',path.relative(path.join(root,'public'),file)));res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'}).end(['.html','.js'].includes(ext)?data.toString().replace(/\.(mp3|mp4|ogg|wav|webm|m4a)\b/gi,'.qa-disabled'):data);}catch{res.writeHead(404).end();}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 const bundleRoot=mode==='android'?mobile+'/android/app/src/main/assets/mobile':mode==='ios'?'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile':null;
 report.bundle=bundleRoot||mode;
 const {script,css}=mode==='desktop'?{script:'',css:''}:bundleRoot?{script:fs.readFileSync(bundleRoot+'/game-mobile.js','utf8'),css:fs.readFileSync(bundleRoot+'/game-mobile.css','utf8')}:readMobileSources();
 browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
 const context=await browser.newContext({viewport:mode==='desktop'?{width:1366,height:768}:{width:740,height:360},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',serviceWorkers:'block',userAgent:mode==='desktop'?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1':mode==='ios'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)':'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await context.addInitScript({content:`window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};${script}\nconst style=document.createElement('style');style.textContent=${JSON.stringify(css)};document.addEventListener('DOMContentLoaded',()=>document.head.append(style),{once:true});`});
 const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(origin+'/game.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>CardPhonePresentation?.zoroDiscardResultVersion===1);
 await p.evaluate(s=>{state=s;me.playerId=0;me.roomId='ZORO-FIXTURE';me.secret='fixture';render();},c.before);
 if(await p.locator('#phoneVenueIntro:not([hidden])').count())await p.locator('#phoneVenueContinue').click();
 await p.waitForFunction(()=>!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.presentationQueueSize());
 await p.evaluate(()=>{window.__zoroHistory=[];const layer=document.getElementById('phoneInteractionFx');new MutationObserver(()=>{const scene=layer.querySelector('.phone-hud-scene');window.__zoroHistory.push({time:performance.now(),kind:layer.dataset.kind,phase:scene?.dataset.phase,text:layer.textContent});}).observe(layer,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-phase']});});
 await p.evaluate(({events,s})=>{for(const event of events)window.__deliver('EMIT',event);window.__deliver('STATE',s);},{events:c.events,s:c.after});
 await p.waitForFunction(()=>window.__zoroHistory.some(x=>x.text.includes('砍掉 0 號卡')),{},{timeout:30000});
 const history=await p.evaluate(()=>window.__zoroHistory),effectAt=history.find(x=>x.kind==='slash'&&x.phase==='effect')?.time,resultAt=history.find(x=>x.text.includes('砍掉 0 號卡'))?.time;
 check(mode+' real slash result prints actual 0 card after effect',Number.isFinite(effectAt)&&resultAt>effectAt,{effectAt,resultAt});
 check(mode+' neutral narration does not reveal the number',history.filter(x=>x.kind==='slash'&&x.phase==='narration').every(x=>!x.text.includes('砍掉 0')));
 await p.waitForFunction(()=>!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.presentationQueueSize(),{},{timeout:30000});
 check(mode+' final public discard commits after result',await p.evaluate(()=>state.discard.at(-1))===0);
 if(process.env.PO_QA_CANCELLATION){
  for(const nextId of [null,17]){
   const cancelled=zoro(4,true),cancelEvent=cancelled.events.find(e=>e.type==='zoro_discard');
   await p.evaluate(({s,e})=>{state=s;render();CardPhonePresentation.deferResultText=true;CardPhonePresentation.presentEffectEvent(e);},{s:cancelled.before,e:cancelEvent});
   await p.waitForFunction(()=>document.querySelector('#phoneInteractionFx[data-kind="slash"] .phone-hud-scene'));
   await p.evaluate(()=>CardPhonePresentation.openPlayers());
   await p.waitForFunction(()=>!document.getElementById('players').closest('main')&&!CardPhonePresentation.isEffectBusy(),{},{timeout:3000});
   check(mode+' openPlayers really cancels the active legacy FX '+nextId,true);
   await p.evaluate(()=>CardPhonePresentation.closeSheet());
   const nextEvent={...c.events.find(e=>e.type==='zoro_discard')};if(nextId===null)delete nextEvent.cardId;else nextEvent.cardId=nextId;
   await p.evaluate(e=>{window.__zoroHistory=[];CardPhonePresentation.deferResultText=true;CardPhonePresentation.presentEffectEvent(e);},nextEvent);
   await p.waitForFunction(()=>!CardPhonePresentation.isEffectBusy(),{},{timeout:30000});
   await p.evaluate(()=>{CardPhonePresentation.deferResultText=false;CardPhonePresentation.flushDeferredResults();});
   await p.waitForFunction(()=>window.__zoroHistory.some(x=>x.kind==='notice'&&x.text.includes('玩家0 → 玩家1')));
   await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
   const result=await p.evaluate(()=>window.__zoroHistory.filter(x=>x.kind==='notice').at(-1)?.text);
   check(mode+' cancelled result cannot label next same-target result '+nextId,nextId===null?!result.includes('砍掉'):result.includes('砍掉 '+nextId+' 號卡'),result);
   await p.waitForFunction(()=>!CardPhonePresentation.isEffectBusy(),{},{timeout:30000});
  }
 }
 check(mode+' no game action emitted by presentation',await p.evaluate(()=>!window.__sent.some(e=>e[0]==='ACTION')));
 check(mode+' no browser errors',report.errors.length===0,report.errors);report.history=history;report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure,report:path.join(output,'report.json')}));}
