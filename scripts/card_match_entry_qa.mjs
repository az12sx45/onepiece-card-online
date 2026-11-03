import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..');
const mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const engine=require(root+'/server/engine.js');
const modes=(process.env.CARD_ENTRY_QA_MODES||'desktop,android,ios').split(',');
const out=process.env.CARD_ENTRY_QA_OUT||'D:/Codex_QA/card-match-entry-20261103/final';
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','public/css/card-native-online.css','server/engine.js'];
const report={passed:false,scope:'Current Card HTML with generated desktop or exact retained v063 Android/iOS and archived iOS v058 presentation bundles. Delayed local CSS/JS, synthetic authorized Socket.IO fixture state, original navigation and join handlers. No physical-device, real-account or public multiplayer acceptance.',checks:[],errors:[],requests:[],frames:{},screenshots:[],source:sources.map(file=>({file,sha256:sha(fs.readFileSync(root+'/'+file))}))};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass||report.checks.length%5===0)save();if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const bundles={
 android:{root:mobile+'/android/app/src/main/assets/mobile',jsSha:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',cssSha:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'},
 ios:{root:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',jsSha:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',cssSha:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'},
 ios58:{root:'D:/Codex_QA/card-native-update-diagnosis-20261101/ios-v058',jsSha:'3d3d650fadc0eb39e473767f6cbf5542f45c5eb35fe9b17c65b76533e6b20026',cssSha:'1bbb58d0aef4c2169e6e77677ba21ba96f3d2b8409aa138a8c6285c0cc61e55a'}
};
for(const mode of modes.filter(x=>x!=='desktop')){const b=bundles[mode];b.js=fs.readFileSync(b.root+'/game-mobile.js');b.css=fs.readFileSync(b.root+'/game-mobile.css');check(mode+' exact retained v063 JS',sha(b.js)===b.jsSha);check(mode+' exact retained v063 CSS',sha(b.css)===b.cssSha);}
const ua={
 desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1',
 android:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',
 ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)',
 ios58:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)'
};
const socketStub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of window.__any)cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'entry-qa',onAny(cb){window.__any.push(cb);return this},on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const cache=new Map(),visits=new Map(),sockets=new Set();
const bytes=file=>{if(!cache.has(file))cache.set(file,fs.readFileSync(file));return cache.get(file);};
const server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),ref=new URL(req.headers.referer||'http://localhost'),test=u.searchParams.get('qaCase')||ref.searchParams.get('qaCase'),run=u.searchParams.get('qaRun')||ref.searchParams.get('qaRun')||'none';
 const entry={path:u.pathname,test,run,at:Date.now()};report.requests.push(entry);
 const send=(data,type,status=200,delay=0)=>{setTimeout(()=>{if(res.destroyed)return;entry.responseAt=Date.now();entry.status=status;if(u.pathname.endsWith('.css')){entry.bytes=Buffer.byteLength(data);entry.sha256=sha(data);}res.writeHead(status,{'content-type':type,'cache-control':'no-store'}).end(data);},delay).unref();};
 const bundle=u.pathname.match(/^\/__entry_bundle\/(android|ios58|ios)\.(js|css)$/);
 if(bundle){send(bundles[bundle[1]][bundle[2]],mime['.'+bundle[2]]);return;}
 if(u.pathname.includes('socket.io.min.js')){send(socketStub,mime['.js']);return;}
 if(/\.(mp3|mp4|ogg|wav|webm|m4a)$/i.test(u.pathname)){send('',mime['.txt']||'text/plain',204);return;}
 const relative=u.pathname==='/'?'game.html':decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,'public',relative);
 if(!file.startsWith(path.join(root,'public')+path.sep)){send('','text/plain',403);return;}
 if(u.pathname==='/game.html')visits.set(run,(visits.get(run)||0)+1);
 if(['/css/card-desktop-table.css','/css/card-native-online.css'].includes(u.pathname)&&test==='css-fail'&&(visits.get(run)||0)===1){send('temporary stylesheet failure','text/plain',503);return;}
 let delay=0;
 if(test==='cold'&&['/css/card-desktop-table.css','/css/card-native-online.css'].includes(u.pathname))delay=1800;
 if(test==='cold'&&u.pathname==='/js/card-desktop-table.js')delay=1200;
 if(test==='cold'&&u.pathname==='/images/avatars/1.webp')delay=1000;
 try{
  let data=bytes(fs.existsSync(file)?file:path.join(mobile,'public',relative));
  if(u.pathname==='/game.html'&&u.searchParams.get('qaBundle')==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__entry_bundle/android.css"><script src="/__entry_bundle/android.js"></script>'));
  send(data,mime[path.extname(file)]||'application/octet-stream',200,delay);
 }catch{send('','text/plain',404);}
});
server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;

function fixture(){const s=engine.createInitialState(6);Object.assign(s,{phase:'playing',turnIndex:0,turnStep:'choose',venues:[],discard:[2,3],roundNo:101});s.players.forEach((p,i)=>Object.assign(p,{alive:true,hand:i===0?4:i+2,tempDraw:i===0?6:null,gold:7,client:{name:'入口船長'+i,avatar:i+1}}));return engine.getVisibleState(s,0);}
async function context(browser,mode){
 const ctx=await browser.newContext({viewport:mode==='desktop'?{width:1366,height:768}:{width:740,height:360},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',userAgent:ua[mode],serviceWorkers:'block'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.addInitScript(()=>{
  window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;
  HTMLMediaElement.prototype.play=function(){return Promise.resolve();};
  window.__entryFrames=[];window.__entryEvents=[];const seen=new WeakSet();
  const ready=e=>{if(seen.has(e))return;seen.add(e);window.__entryEvents.push({at:performance.now(),type:e.type});};
  document.addEventListener('card:interface-ready',ready);window.addEventListener('card:interface-ready',ready);
  let signature='';function sample(){
   const root=document.documentElement,main=document.querySelector('body>main'),self=document.querySelector('#phoneSelfPlayer .phone-self-captain'),boot=document.getElementById('cardMatchBoot');
   if(main){const style=getComputedStyle(main),value={at:performance.now(),boot:root.dataset.cardBoot||null,mainOpacity:style.opacity,mainVisibility:style.visibility,rows:document.querySelectorAll('#players>[data-seat-id]').length,self:!!self,flow:root.dataset.cardFlow||null,menu:root.dataset.cardMenuLayout||null,loader:!!boot&&!boot.hidden};const next=JSON.stringify({...value,at:0});if(next!==signature){signature=next;window.__entryFrames.push(value);}}
   requestAnimationFrame(sample);
  }requestAnimationFrame(sample);
 });
 if(mode.startsWith('ios'))await ctx.addInitScript({content:bundles[mode].js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/__entry_bundle/${mode}.css';document.head.append(l);},{once:true});`});
 return ctx;
}
async function pageFor(ctx,mode,test='cold',room=true){
 const p=await ctx.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>report.errors.push({mode,test,error:e.message}));
 const run=mode+'-'+test+'-'+Date.now()+'-'+Math.random().toString(16).slice(2),query=new URLSearchParams({qaBundle:mode,qaCase:test,qaRun:run});if(room)query.set('room','ENTRY-QA');
 await p.goto(origin+'/game.html?'+query,{waitUntil:'commit'});return {p,run};
}
async function mounted(p){await p.waitForFunction(()=>typeof window.__deliver==='function'&&typeof window.doJoin==='function'&&window.CardPhonePresentation?.ownCollectionVersion==='2',{},{timeout:18000});}
async function deliver(p,{firstState=false}={}){
 const s=fixture();
 if(firstState){await p.evaluate(s=>window.__deliver('STATE',s),s);await p.waitForTimeout(350);return;}
 await p.evaluate(s=>{window.__deliver('JOINED',{playerId:0,secret:'entry-fixture'});window.__deliver('STATE',s);},s);
}
async function hidden(p){return p.evaluate(()=>{const n=document.querySelector('body>main');return !n||getComputedStyle(n).opacity==='0'||getComputedStyle(n).visibility==='hidden';});}
async function ready(p){await p.waitForFunction(()=>document.documentElement.dataset.cardBoot==='ready',{},{timeout:15000});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function frameCheck(p,label){
 const frames=await p.evaluate(()=>window.__entryFrames);report.frames[label]=frames;
 check(label+' old/zero-player table is never exposed before boot ready',frames.filter(x=>x.boot!=='ready').every(x=>x.mainOpacity==='0'||x.mainVisibility==='hidden'),frames);
 const revealed=frames.filter(x=>x.boot==='ready'&&x.mainOpacity!=='0'&&x.mainVisibility!=='hidden');
 check(label+' first revealed table already has six modern seats and own captain',revealed.length>0&&revealed.every(x=>x.rows===6&&x.self&&x.flow==='1'&&x.menu==='v3'),frames);
 check(label+' interface-ready fires exactly once',await p.evaluate(()=>window.__entryEvents.length===1),await p.evaluate(()=>window.__entryEvents));
}
async function styleCheck(p,mode,run,label=mode){
 const native=mode!=='desktop',selected=native?'/css/card-native-online.css':'/css/card-desktop-table.css',other=native?'/css/card-desktop-table.css':'/css/card-native-online.css';
 const selectedRequests=report.requests.filter(x=>x.run===run&&x.path===selected&&x.status===200),otherRequests=report.requests.filter(x=>x.run===run&&x.path===other);
 const expected=fs.readFileSync(root+'/public'+selected);
 const identity=await p.evaluate(()=>({bundled:document.documentElement.dataset.cardBundledStyles||null,nativeReady:getComputedStyle(document.documentElement).getPropertyValue('--card-native-style-ready').trim(),href:document.getElementById('cardMatchPresentationStyle')?.getAttribute('href'),sheet:!!document.getElementById('cardMatchPresentationStyle')?.sheet}));
 check(label+' selects only its intended presentation stylesheet',otherRequests.length===0&&selectedRequests.length===1&&identity.sheet&&identity.href?.startsWith(selected.slice(1)),{identity,selectedRequests,otherRequests});
 check(label+' selected stylesheet has exact current bytes and SHA',selectedRequests.every(x=>x.bytes===expected.length&&x.sha256===sha(expected)),{expectedBytes:expected.length,expectedSha256:sha(expected),selectedRequests});
 check(label+(native?' uses guarded small native style with zero desktop CSS requests':' keeps normal full desktop styles'),native?identity.bundled==='1'&&identity.nativeReady==='1'&&expected.length<65536:identity.bundled===null&&expected.length>1000000,{identity,bytes:expected.length});
 if(native)check(label+' native ready sentinel is at the end of the delivered stylesheet',/--card-native-style-ready\s*:\s*1\s*;?\s*\}\s*$/.test(expected.toString()),{bytes:expected.length,nativeReady:identity.nativeReady});
}
async function cold(browser,mode){
 const ctx=await context(browser,mode),{p,run}=await pageFor(ctx,mode);page=p;
 await p.waitForTimeout(300);check(mode+' initial head cannot expose a table before boot loading is parsed',await p.evaluate(()=>document.documentElement.dataset.cardBoot==='loading'||!document.querySelector('body>main')));
 check(mode+' initial shell is hidden while CSS/JS are delayed',await hidden(p));
 await mounted(p);await p.waitForTimeout(250);check(mode+' no first STATE means no table reveal',await hidden(p)&&await p.evaluate(()=>document.documentElement.dataset.cardBoot==='loading'));
 await deliver(p,{firstState:true});check(mode+' STATE before JOINED keeps unassigned/empty-self table covered',await hidden(p));
 await p.evaluate(()=>window.__deliver('JOINED',{playerId:0,secret:'entry-fixture'}));
 await ready(p);check(mode+' ready gate is removed',await p.locator('#cardMatchBoot').count()===0);
 const final=await p.evaluate(()=>({rows:document.querySelectorAll('#players>[data-seat-id]').length,self:document.getElementById('phoneSelfPlayer')?.dataset.selfDesign,avatar:[...document.querySelectorAll('#phoneSelfPlayer .phone-seat-avatar')].every(img=>img.complete&&img.naturalWidth>0),visible:getComputedStyle(document.querySelector('body>main')).opacity}));
 check(mode+' applied six-seat model, new captain and decoded own avatar are visible',final.rows===6&&final.self==='captain-v1'&&final.avatar&&final.visible==='1',final);
 await frameCheck(p,mode+' cold');
 await styleCheck(p,mode,run);
 const file=out+'/'+mode+'-ready.png';await p.screenshot({path:file});report.screenshots.push(file);
 check(mode+' boot process sends no gameplay ACTION',await p.evaluate(()=>!window.__sent.some(x=>x[0]==='ACTION')),await p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION')));
 await ctx.close();page=null;
}
async function failures(browser,mode='desktop'){
 const ctx=await context(browser,mode);
 const a=await pageFor(ctx,mode,'css-fail'),b=await pageFor(ctx,mode,'css-fail');page=a.p;
 for(const p of [a.p,b.p]){await mounted(p);await deliver(p);}
 await Promise.all([a.p,b.p].map(p=>p.waitForFunction(()=>document.documentElement.dataset.cardBoot==='failed',{},{timeout:26000})));
 for(const [index,p]of[a.p,b.p].entries()){
  check(mode+' stylesheet failure '+index+' retains hidden table',await hidden(p));
  check(mode+' stylesheet failure '+index+' exposes real retry and back controls',await p.locator('#cardMatchBootRetry').isVisible()&&await p.locator('#cardMatchBootBack').isVisible());
  const frames=await p.evaluate(()=>window.__entryFrames);report.frames[mode+' stylesheet failure '+index]=frames;
  check(mode+' stylesheet failure '+index+' never reveals a timed-out legacy layout',frames.length>0&&frames.every(x=>x.mainOpacity==='0'||x.mainVisibility==='hidden'),frames);
 }
 await Promise.all([a.p.waitForNavigation({waitUntil:'domcontentloaded'}),a.p.locator('#cardMatchBootRetry').click()]);await mounted(a.p);await deliver(a.p);await ready(a.p);
 check(mode+' original boot retry reloads and recovers when selected stylesheet becomes available',(visits.get(a.run)||0)>=2&&!await a.p.locator('#cardMatchBoot').count());
 await frameCheck(a.p,mode+' retry recovered');
 await styleCheck(a.p,mode,a.run,mode+' retry recovered');
 await b.p.route('**/start.html',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>QA original lobby navigation target</title>'}));
 await Promise.all([b.p.waitForURL('**/start.html'),b.p.locator('#cardMatchBootBack').click()]);check(mode+' boot back uses original start.html destination',new URL(b.p.url()).pathname==='/start.html');
 await ctx.close();page=null;
}
async function ordinaryFlagGuard(browser){
 const ctx=await browser.newContext({viewport:{width:1366,height:768},userAgent:ua.desktop.replace(' Electron/44.1.1',''),serviceWorkers:'block'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;window.__TABLETOP_ANDROID_GAME_UI__=true;HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
 const {p,run}=await pageFor(ctx,'desktop','guard',false);page=p;
 await p.waitForLoadState('domcontentloaded');
 check('ordinary browser UA plus a UI flag cannot opt into native styles',await p.evaluate(()=>!document.documentElement.dataset.cardBundledStyles&&document.getElementById('cardMatchPresentationStyle')?.getAttribute('href')?.startsWith('css/card-desktop-table.css')));
 await styleCheck(p,'desktop',run,'ordinary UA guarded');
 await ctx.close();page=null;
}
async function nativeFailureProbe(browser){
 const ctx=await context(browser,'android'),{p,run}=await pageFor(ctx,'android','css-fail');page=p;await mounted(p);await deliver(p);
 await p.waitForFunction(()=>['ready','failed'].includes(document.documentElement.dataset.cardBoot),{},{timeout:26000});
 const info=await p.evaluate(()=>({boot:document.documentElement.dataset.cardBoot,styles:[...document.querySelectorAll('link[rel="stylesheet"]')].map(n=>{let rules;try{rules=n.sheet?.cssRules?.length??null;}catch(e){rules=e.name;}return {id:n.id,href:n.href,sheet:!!n.sheet,rules};})}));
 report.nativeFailureProbe={...info,requests:report.requests.filter(x=>x.run===run&&x.path.endsWith('.css'))};
 check('native failed selected stylesheet must not reveal the table',info.boot==='failed',report.nativeFailureProbe);
 await ctx.close();page=null;
}
async function unavailableAndNoRoom(browser){
 const ctx=await context(browser,'desktop'),a=await pageFor(ctx,'desktop','normal');page=a.p;await mounted(a.p);
 await a.p.waitForFunction(()=>window.__sent.some(x=>x[0]==='JOIN_ROOM'&&x[1]?.roomId==='ENTRY-QA'));
 await a.p.evaluate(()=>window.__deliver('ROOM_UNAVAILABLE',{roomId:'ENTRY-QA'}));await a.p.waitForFunction(()=>!!document.getElementById('cardRoomUnavailable'));
 check('expired room dialog remains visible above the boot cover',await a.p.locator('#cardRoomUnavailable').isVisible()&&await a.p.locator('#cardRoomUnavailable button').isVisible());
 check('expired room never exposes legacy table',await hidden(a.p));
 const b=await pageFor(ctx,'desktop','normal',false);page=b.p;await mounted(b.p);
 check('no-room route has no visible boot gate or loading state',await b.p.evaluate(()=>{const gate=document.getElementById('cardMatchBoot');return !document.documentElement.dataset.cardBoot&&(!gate||gate.hidden||getComputedStyle(gate).display==='none')&&getComputedStyle(document.querySelector('body>main')).opacity==='1';}));
 await b.p.evaluate(()=>{el.room.value='ENTRY-LEGACY-JOIN';el.name.value='EntryQA';el.join.click();});
 const joins=await b.p.evaluate(()=>window.__sent.filter(x=>x[0]==='JOIN_ROOM'));
 check('no-room original join handler still submits the requested room',joins.length===1&&joins[0][1].roomId==='ENTRY-LEGACY-JOIN',joins.map(x=>({event:x[0],roomId:x[1].roomId,resumeOnly:x[1].resumeOnly})));
 await ctx.close();page=null;
}
let browser,page;
try{
 for(const mode of modes){browser=mode.startsWith('ios')?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});if(process.env.CARD_ENTRY_QA_NATIVE_FAILURE_PROBE==='1'){await nativeFailureProbe(browser);}else{await cold(browser,mode);if(process.env.CARD_ENTRY_QA_SKIP_FAULTS!=='1'&&['desktop','android'].includes(mode)){await failures(browser,mode);if(mode==='desktop'){await unavailableAndNoRoom(browser);await ordinaryFlagGuard(browser);}}}check(mode+' no page exceptions',!report.errors.some(x=>x.mode===mode),report.errors);await browser.close();browser=null;save();}
 check('all product source SHA remain unchanged throughout entry QA',report.source.every(x=>sha(fs.readFileSync(root+'/'+x.file))===x.sha256),report.source);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{report.failureState=await page.evaluate(()=>({boot:document.documentElement.dataset.cardBoot,root:{...document.documentElement.dataset},message:document.getElementById('cardMatchBootMessage')?.textContent,events:window.__entryEvents,frames:window.__entryFrames,state:typeof state==='object'?{players:state?.players?.length,step:state?.turnStep}:null,me:typeof me==='object'?{playerId:me.playerId,roomId:me.roomId}:null}));await page.screenshot({path:out+'/failure.png'});}catch{}}
finally{await browser?.close();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure,report:out+'/report.json'}));}
