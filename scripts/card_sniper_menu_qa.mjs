import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readMobileSources} from 'file:///C:/Users/%E7%8E%8B%E6%9B%9C%E7%91%8B/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/mobile-sources.mjs';
const require=createRequire(import.meta.url),{chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const desktop=process.env.PO_DESKTOP==='1',mobileRoot='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html',root='D:/Codex_Release_Worktrees/card-native-server-adapter-20261029',engine=require(root+'/server/engine.js');
const output=process.env.PO_QA_OUT||'C:/Codex_QA/card-match-polish-20261031/desktop';fs.mkdirSync(output,{recursive:true});
const report={scope:'Desktop original game.html, real engine-produced public play events, isolated browser fixtures; no physical-device/live account claim.',checks:[],errors:[],screenshots:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const baseline=new Map();if(process.env.PO_QA_BASELINE)for(const file of ['game.html','js/card-desktop-table.js','css/card-desktop-table.css'])baseline.set(path.join(root,'public',file),execFileSync('git',['show',process.env.PO_QA_BASELINE+':public/'+file],{cwd:root,maxBuffer:80e6}));
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),file=path.resolve(root,'public','.'+decodeURIComponent(u.pathname));
 if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
 if(u.pathname==='/qa-enh.mp4'||/^\/videos\/enh\/\d+\.qa-disabled$/.test(u.pathname)){const id=process.env.PO_QA_REAL_VIDEO?(u.pathname.match(/\/(\d+)\.qa-disabled$/)?.[1]||'1'):'1';res.writeHead(200,{'content-type':'video/mp4'});res.end(fs.readFileSync(path.join(mobileRoot,'public/videos/enh/'+id+'.mp4')));return;}
 if(/\.(mp3|mp4|ogg|wav|webm|m4a|qa-disabled)$/i.test(u.pathname)){res.writeHead(204).end();return;}
 if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(`window.__sent=[];window.__handlers={};window.__deliver=(name,data)=>{for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'phone-qa',on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`);return;}
 try {const ext=path.extname(file),data=baseline.get(file)||fs.readFileSync(fs.existsSync(file)?file:path.join(mobileRoot,'public',path.relative(path.join(root,'public'),file)));res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'});res.end(['.html','.js','.css'].includes(ext)?data.toString('utf8').replace(/\.(mp3|mp4|ogg|wav|webm|m4a)\b/gi,'.qa-disabled'):data);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(Number(process.env.PO_QA_PORT)||(desktop?30988:30989),'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const bundleRoot=process.env.PO_QA_MOBILE_ASSETS;
const {script,css}=desktop?{script:'',css:''}:bundleRoot?{script:fs.readFileSync(path.join(bundleRoot,'game-mobile.js'),'utf8'),css:fs.readFileSync(path.join(bundleRoot,'game-mobile.css'),'utf8')}:readMobileSources();
const browser=process.env.PO_QA_WEBKIT?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions','--autoplay-policy=no-user-gesture-required']});
function fixture(mode='choose',count=4){const s=engine.createInitialState(count);s.phase='playing';s.turnIndex=0;s.turnStep=mode;s.venues=[{name:'巴拉蒂'},{name:'和之國'}];s.discard=[1,2,3,4,5,6,7,8,9,10,11,12,13];s.players.forEach((p,i)=>{p.alive=true;p.gold=10+i;p.hand=i+1;p.displayName=['測試船長','索隆','娜美','香吉士'][i%4];p.client={name:p.displayName,avatar:i+1};});s.players[0].hand=1;s.players[0].tempDraw=4;Object.assign(s.players[1],{protected:true,dodging:true,frozen:true,skipNext:true,iceArmed:true});return engine.getVisibleState(s,0);}
async function setState(page,s){await page.evaluate(s=>{state=s;me.playerId=0;me.roomId='LOCAL-QA';me.secret='fixture';render();},s);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));if(await page.locator('#phoneVenueIntro:not([hidden])').count())await page.locator('#phoneVenueContinue').click();}

async function context(width,height,record=false){const ctx=await browser.newContext({viewport:{width,height},hasTouch:!desktop,isMobile:!desktop,userAgent:desktop?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1':process.env.PO_QA_IOS?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)':'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',serviceWorkers:'block',...(record?{recordVideo:{dir:output,size:{width,height}}}:{})});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await ctx.addInitScript({content:`window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;window.__nativePlay=HTMLMediaElement.prototype.play;window.__nativeLoad=HTMLMediaElement.prototype.load;window.__nativePause=HTMLMediaElement.prototype.pause;HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};${script}\nconst s=document.createElement('style');s.textContent=${JSON.stringify(css)};new MutationObserver((_,o)=>{if(document.documentElement){${process.env.PO_QA_IOS?"document.addEventListener('DOMContentLoaded',()=>document.head.append(s),{once:true});":"document.documentElement.append(s);"}o.disconnect();}}).observe(document,{childList:true});`});return ctx;}
function raw(card=1,actor=0){const s=engine.createInitialState(4);s.phase='playing';s.turnIndex=actor;s.turnStep='choose';s.venues=[{name:'巴拉蒂'},{name:'和之國'}];s.discard=[0,2,7];s.players.forEach((p,i)=>{p.hand=i+2;p.tempDraw=null;p.gold=10;p.displayName=['測試船長','索隆','娜美','香吉士'][i];p.client={displayName:p.displayName,name:['測試船長','索隆','娜美','香吉士'][i],avatar:i+1};});s.players[actor].hand=card;s.players[actor].tempDraw=4;return s;}

const presentation=require(root+'/server/card_skill_intent.js');
async function idle(p){await p.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy()&&(!CardPhonePresentation.isCardResolving()||!!state?.pending),{},{timeout:60000});}
async function deliver(p,room,action){const res=presentation.decorate(room,room.state,action,engine.applyAction(room.state,action));room.state=res.state;await p.evaluate(({events,s})=>{for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:res.emits.filter(e=>e.to==='all'||e.to===0),s:engine.getVisibleState(res.state,0)});return res;}



try{
 const ctx=await context(desktop?1366:740,desktop?768:360),p=await ctx.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(origin+'/game.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.CardPhonePresentation?.sniperSequenceVersion===1);
 const sample=require(root+'/scripts/card_all_effect_cases.js').buildCases().find(c=>c.label==='card-1-normal/PICK_DIGIT');
 for(const hit of (process.env.PO_QA_LAYOUT_ONLY?[]:[true,false])){
  const before=structuredClone(sample.before);before.venues=[];before.players[1].hand=hit?4:5;before.players.forEach((x,i)=>{x.client={name:'玩家'+(i+1),displayName:'玩家'+(i+1),avatar:i+1};});
  const room={state:before};await setState(p,engine.getVisibleState(before,0));await idle(p);
  const initial=await p.evaluate(()=>state.discard.length);await deliver(p,room,sample.action);
  await p.waitForSelector('#phoneSniperSequence .phone-sniper-cutin',{state:'visible',timeout:15000});
  check('cutin visible '+hit,true);check('guess and target printed '+hit,await p.locator('.phone-sniper-cut-copy').innerText().then(t=>t.includes('4')&&t.includes('玩家2')));
  check('outcome state deferred '+hit,await p.evaluate(()=>state.discard.length)===initial);
  await p.waitForTimeout(650);check('sniper character decoded '+hit,await p.evaluate(async()=>{const n=document.querySelector('.phone-sniper-cut-art');const src=getComputedStyle(n).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1];if(!src)return false;const i=new Image();i.src=src;try{await i.decode();return i.naturalWidth>100&&n.getBoundingClientRect().width>100;}catch{return false;}}));await p.screenshot({path:path.join(output,'cutin-'+hit+'.png')});
  await p.waitForFunction(()=>document.getElementById('phoneSniperSequence')?.dataset.phase==='attack');
  if(!hit)check('dodge before impact',await p.locator('#phoneSniperSequence').evaluate(n=>Number(n.dataset.dodgeAt)<Number(n.dataset.impactAt)&&!!n.dataset.dodgeAt));
  await idle(p);check('sequence removed '+hit,await p.locator('#phoneSniperSequence').count()===0);
  check('outcome state committed '+hit,await p.evaluate(()=>state.discard.length)===room.state.discard.length);
 }
 for(const [w,h] of (desktop?[[1366,768]]:[[844,390],[740,360],[640,320]])){
  await p.setViewportSize({width:w,height:h});await setState(p,fixture('choose',6));await idle(p);
  const menu=p.locator('#phoneCardMenu');check('menu upper-left '+w,await menu.evaluate(n=>{const r=n.getBoundingClientRect();return r.x<20&&r.y<15&&r.width/r.height===3;}));
  await p.screenshot({path:path.join(output,'six-seat-'+w+'.png')});await menu.click();await p.waitForSelector('#cardMenuChoices',{state:'visible'});
  check('menu button proportion '+w,await p.locator('#cardMenuChoices>button').evaluateAll(ns=>ns.length>0&&ns.every(n=>{const r=n.getBoundingClientRect();return Math.abs(r.width/r.height-3)<.05&&n.scrollWidth<=n.clientWidth+1;})));
  check('close button painted '+w,await p.locator('#cardMenuReturn').evaluate(n=>getComputedStyle(n).backgroundImage.startsWith('url("data:image/webp')));await p.screenshot({path:path.join(output,'menu-'+w+'.png')});await p.locator('.phone-card-sheet-head button').click();
 }
 await p.evaluate(events=>{window.__sniperCancelled=false;CardPhonePresentation.presentSniperBatch(events).then(()=>window.__sniperCancelled=true);},sample.events);await p.waitForSelector('#phoneSniperSequence');await p.evaluate(()=>CardPhonePresentation.cancelSniperSequence());await p.waitForFunction(()=>window.__sniperCancelled);check('cancel resolves active sequence and removes overlay',await p.locator('#phoneSniperSequence').count()===0);check('no page errors',report.errors.length===0,report.errors);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));report.scope='Real engine public events; exact retained mobile bundle or desktop; isolated browser, not physical iPhone.';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
