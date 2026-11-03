import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const engine=require(root+'/server/engine.js'),cases=require(root+'/scripts/card_all_effect_cases.js').buildCases();
const normal=cases.find(x=>x.label==='card-2-normal/PICK_TARGET');
if(!normal)throw Error('Missing real Robin case');
const patched=process.env.CARD_RETURN_QA_PATCH!=='0',integrated=process.env.CARD_RETURN_QA_INTEGRATED==='1',modes=(process.env.CARD_RETURN_QA_MODES||'android,ios').split(','),out=process.env.CARD_RETURN_QA_OUT||'D:/Codex_QA/card-return-hand-20261103/'+(patched?'patched':'baseline');
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),web=mobile+'/android/web';
const patch=fs.readFileSync(web+'/card-return-hand.js','utf8'),css=fs.readFileSync(web+'/card-return-hand.css','utf8');
const report={passed:false,patched,integrated,scope:'Engine-produced authorized Robin private events; current generated desktop output or exact retained v063 mobile JS/CSS plus current HTML. Integrated mode injects no product module or CSS. Isolated sockets and fixture accounts; not physical-device or multiplayer acceptance.',checks:[],errors:[],flights:[],sources:['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','server/engine.js'].map(file=>({file,sha256:sha(fs.readFileSync(root+'/'+file))})),patch:{js:sha(patch),css:sha(css)}};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const bundles={
 android:{root:mobile+'/android/app/src/main/assets/mobile',jsSha:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',cssSha:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'},
 ios:{root:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',jsSha:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',cssSha:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'}
};
for(const mode of modes.filter(x=>x!=='desktop')){const b=bundles[mode];b.js=fs.readFileSync(b.root+'/game-mobile.js');b.css=fs.readFileSync(b.root+'/game-mobile.css');check(mode+' exact v063 JS',sha(b.js)===b.jsSha);check(mode+' exact v063 CSS',sha(b.css)===b.cssSha);}
const stub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of window.__any)cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'return-qa',onAny(cb){window.__any.push(cb);return this},on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),match=u.pathname.match(/^\/__return_bundle\/(android|ios)\.(js|css)$/);if(match){res.writeHead(200,{'content-type':mime['.'+match[2]]}).end(bundles[match[1]][match[2]]);return;}if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(stub);return;}if(/\.(mp3|mp4|ogg|wav|webm|m4a)$/i.test(u.pathname)){res.writeHead(204).end();return;}const file=path.resolve(root,'public','.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}try{let data=fs.readFileSync(fs.existsSync(file)?file:path.join(mobile,'public',path.relative(path.join(root,'public'),file)));if(u.pathname==='/game.html'&&u.searchParams.get('qaBundle')==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__return_bundle/android.css"><script src="/__return_bundle/android.js"></script>'));res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const ua={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1',android:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)'};
async function setup(browser,mode,width,height,viewer){
 const ctx=await browser.newContext({viewport:{width,height},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',userAgent:ua[mode],serviceWorkers:'block'});
 await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve();};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};});
 if(mode==='ios')await ctx.addInitScript({content:bundles.ios.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/__return_bundle/ios.css';document.head.append(l);},{once:true});`});
 const p=await ctx.newPage();p.on('pageerror',e=>report.errors.push({mode,width,viewer,error:e.message}));await p.goto(origin+'/game.html?qaBundle='+mode,{waitUntil:'load'});
 await p.waitForFunction(()=>typeof CardPhonePresentation?.flyCard==='function');
 if(patched){if(!integrated){await p.addStyleTag({content:css});await p.addScriptTag({content:patch});}await p.waitForFunction(()=>CardPhonePresentation.returnHandVersion===1);}
 await setState(p,normal.before,viewer);return {ctx,p};
}
async function setState(p,raw,viewer){const s=engine.getVisibleState({...structuredClone(raw),phase:'playing'},viewer);s.players.forEach((x,i)=>{x.displayName='QA船長'+i;x.client={name:x.displayName,displayName:x.displayName,avatar:i+1};});await p.evaluate(({s,viewer})=>{state=s;me.playerId=viewer;me.roomId='RETURN-QA';me.secret='fixture';render();window.__deliver('STATE',s);},{s,viewer});await p.waitForTimeout(250);}
async function privateView(p,viewer=0){
 await setState(p,normal.before,viewer);
 // These are real engine events and recipient IDs, not card IDs invented by QA.
 for(const e of normal.events.filter(e=>e.to==='all'||e.to===viewer))await p.evaluate(e=>window.__deliver('EMIT',e),e);
 await p.evaluate(s=>window.__deliver('STATE',s),engine.getVisibleState({...structuredClone(normal.state),phase:'playing'},viewer));
 if(viewer===0){await p.waitForFunction(()=>!document.getElementById('phonePrivateReveal').hidden,{},{timeout:30000});await p.waitForFunction(()=>!document.querySelector('#phoneCardFlights [data-kind="peek"]'),{},{timeout:15000});}
 else await p.waitForTimeout(650);
}
async function sampleReturn(p){
 await p.locator('#phonePrivateDone').click();
 await p.waitForFunction(()=>!!document.querySelector('#phoneCardFlights [data-kind="peek-return"]'),{},{timeout:5000});
 return p.evaluate(async()=>{const g=document.querySelector('#phoneCardFlights [data-kind="peek-return"]'),img=g.querySelector('img'),a=g.getAnimations()[0];await img.decode();a.pause();const frames=[];for(const time of [0,275,550,825,1099]){a.currentTime=time;await new Promise(r=>requestAnimationFrame(r));const m=new DOMMatrixReadOnly(getComputedStyle(g).transform),sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d);frames.push({time,sx,sy,anisotropy:Math.abs(sx-sy)/Math.max(sx,sy)});}return {src:img.getAttribute('src'),naturalRatio:img.naturalWidth/img.naturalHeight,boxRatio:g.offsetWidth/g.offsetHeight,frames};});
}
async function handChecks(p,label,mode){
 const s=engine.createInitialState(6);Object.assign(s,{phase:'playing',turnIndex:0,turnStep:'choose',roundNo:900,venues:[],discard:[]});s.players.forEach((x,i)=>Object.assign(x,{alive:true,hand:i===0?4:i+2,tempDraw:i===0?6:null,client:{name:'QA船長'+i,avatar:i+1}}));await setState(p,s,0);
 const styles=await p.locator('#playHand,#playDrawn').evaluateAll(ns=>ns.map(n=>{const r=getComputedStyle(n),face=n.querySelector('.card-finish-face'),f=face&&getComputedStyle(face);return {id:n.id,border:r.borderTopWidth,shadow:r.boxShadow,background:r.backgroundImage,faceShadow:f?.boxShadow,disabled:n.disabled,src:n.querySelector('img').getAttribute('src')};}));
 check(label+' both real hand artworks remain and enabled',styles.length===2&&styles.every(x=>!x.disabled&&x.src),styles);
 check(label+' no outer hand or finish-frame border/shadow',styles.every(x=>x.border==='0px'&&x.shadow==='none'&&x.background==='none'&&x.faceShadow==='none'),styles);
 for(const [id,expected]of [['playHand','4.webp'],['playDrawn','6.webp']]){
  for(let attempt=0;attempt<2&&!await p.locator('#phoneCardSheet').isVisible();attempt++){
   const hit=await p.locator('#'+id).evaluate(n=>{const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=Math.min(innerHeight-8,Math.max(8,r.top+20)),e=document.elementFromPoint(x,y);return {x,y,ok:e===n||n.contains(e)};});check(label+' '+id+' real touch point remains',hit.ok,hit);if(mode==='desktop')await p.mouse.click(hit.x,hit.y);else await p.touchscreen.tap(hit.x,hit.y);await p.waitForTimeout(350);
  }
  await p.waitForFunction(()=>!document.getElementById('phoneCardSheet').hidden);check(label+' '+id+' opens original matching inspector',await p.locator('.phone-card-inspector-art img').getAttribute('src').then(x=>x.endsWith(expected)));check(label+' selection outline stays inside artwork',await p.locator('#'+id).evaluate(n=>getComputedStyle(n).outlineOffset==='-3px'));await p.locator('#phoneCardSheet .phone-card-sheet-head button').click();await p.waitForTimeout(300);
 }
 check(label+' inspection emits no game action',await p.evaluate(()=>!__sent.some(x=>x[0]==='ACTION')));
 s.players[0].frozen=true;await setState(p,s,0);check(label+' frozen original hand remains disabled',await p.locator('#playHand').isDisabled()&&!await p.locator('#playDrawn').isDisabled());
}
let browser,page;
try{
 for(const mode of modes){browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});const sizes=mode==='desktop'?[[1366,768]]:process.env.CARD_RETURN_QA_QUICK?[[640,320]]:[[844,390],[640,320]];
  for(const [width,height]of sizes){const label=mode+' '+width+'x'+height,{ctx,p}=await setup(browser,mode,width,height,0);page=p;
   await privateView(p);check(label+' real authorized Robin face is visible only in private surface',await p.locator('#phonePrivateReveal figure img').getAttribute('src').then(x=>x.endsWith('/4.webp')));
   const flight=await sampleReturn(p);report.flights.push({label,...flight});check(label+' return uses only original card back',flight.src.endsWith('/back.webp'));
   const worst=Math.max(...flight.frames.map(x=>x.anisotropy));check(label+(patched?' return remains uniform at start/quarter/mid/three-quarter/end':' baseline reproduces nonuniform return scale'),patched?worst<.002:worst>.02,flight);
   if(patched){check(label+' flight box preserves decoded back aspect ratio',Math.abs(flight.boxRatio-flight.naturalRatio)<.01,flight);await p.evaluate(()=>CardPhonePresentation.cancelCardFlights('peek-return'));check(label+' cancellation removes return ghost',await p.locator('#phoneCardFlights [data-kind="peek-return"]').count()===0);await p.waitForTimeout(50);check(label+' cancellation leaves no borrowed hand surface',await p.locator('[data-card-visual-borrowed="true"]').count()===0);
    await privateView(p);await p.locator('#phonePrivateDone').click();await p.waitForFunction(()=>!!document.querySelector('#phoneCardFlights [data-kind="peek-return"]'));await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});check(label+' hidden cancels return and releases borrowed surfaces',await p.locator('#phoneCardFlights [data-kind="peek-return"],[data-card-visual-borrowed="true"]').count()===0);await p.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    // A fresh page isolates hand interaction from the deliberately interrupted
    // hidden-page replay fixture. Do not shortcut the real presentation gate.
    const handPage=await setup(browser,mode,width,height,0);page=handPage.p;await handChecks(handPage.p,label,mode);await handPage.ctx.close();page=p;
    for(const viewer of [1,2]){const q=await setup(browser,mode,width,height,viewer);await privateView(q.p,viewer);check(label+' target/spectator '+viewer+' receives no private face or return',await q.p.locator('#phonePrivateReveal:not([hidden]) figure img,#phoneCardFlights [data-kind="peek-return"]').count()===0);await q.ctx.close();}
   }else await p.evaluate(()=>CardPhonePresentation.cancelCardFlights('peek-return'));
   check(label+' no page errors',report.errors.length===0,report.errors);await ctx.close();page=null;save();
  }await browser.close();browser=null;
 }report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{report.failureState=await page.evaluate(()=>({title:document.getElementById('phoneCardSheetTitle')?.textContent,privateHidden:document.getElementById('phonePrivateReveal')?.hidden,flights:[...document.querySelectorAll('#phoneCardFlights>div')].map(n=>({kind:n.dataset.kind,src:n.querySelector('img')?.src})),queue:CardPhonePresentation.presentationQueueSize?.(),busy:CardPhonePresentation.presentationEffectsBusy?.()}));}catch{}}
finally{await browser?.close();await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,patched,checks:report.checks.length,errors:report.errors,failure:report.failure,report:out+'/report.json'}));}
