import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

const require=createRequire(import.meta.url);
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mobileRoot='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const engine=require(root+'/server/engine.js');
const engineCases=require(root+'/scripts/card_all_effect_cases.js').buildCases();
const output=process.env.CARD_PICKER_QA_OUT||'D:/Codex_QA/card-picker-panels-20261103';
const modes=(process.env.CARD_PICKER_QA_MODES||'desktop,android,ios').split(',');
const report={passed:false,scope:'Current online Card HTML and original handlers with desktop Chromium, exact retained v063 Android Chromium and exact retained v063 iOS Windows WebKit; engine-produced visible-state fixtures and original action payloads. No real account, physical-device or multiplayer acceptance.',checks:[],errors:[],cases:[],screenshots:[],bundles:{}};
fs.mkdirSync(output,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass||report.checks.length%10===0)save();if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const sourceFiles=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','server/engine.js'];
report.source=sourceFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const bundles={
  android:{root:process.env.CARD_PICKER_ANDROID_ASSETS||mobileRoot+'/android/app/src/main/assets/mobile',expected:{js:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',css:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'},provenance:'Exact bytes previously compared directly with assets/mobile/* inside retained D:/Codex_QA/marineford-box-20261101/PO-v063.apk; no extracted copies.'},
  ios:{root:process.env.CARD_PICKER_IOS_ASSETS||'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',expected:{js:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',css:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'},provenance:'Exact bytes previously compared directly with Payload/PO.app/launcher-web/mobile/* inside retained D:/Codex_QA/marineford-box-20261101/PO-iOS-v063-UNSIGNED.ipa; no extracted copies.'}
};
for(const mode of modes.filter(x=>x!=='desktop')){
  const b=bundles[mode];if(!b)throw Error('Unknown mode '+mode);
  b.js=fs.readFileSync(path.join(b.root,'game-mobile.js'));b.css=fs.readFileSync(path.join(b.root,'game-mobile.css'));
  report.bundles[mode]={root:b.root,provenance:b.provenance,js:{bytes:b.js.length,sha256:sha(b.js)},css:{bytes:b.css.length,sha256:sha(b.css)}};
  check(mode+' exact v063 JS',sha(b.js)===b.expected.js);check(mode+' exact v063 CSS',sha(b.css)===b.expected.css);
}
const socketStub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of window.__any)cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'picker-qa',onAny(cb){window.__any.push(cb);return this},on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),match=u.pathname.match(/^\/__qa_bundle\/(android|ios)\.(js|css)$/);
  if(match){res.writeHead(200,{'content-type':mime['.'+match[2]]}).end(bundles[match[1]][match[2]]);return;}
  if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(socketStub);return;}
  if(/\.(mp3|mp4|ogg|wav|webm|m4a)$/i.test(u.pathname)){res.writeHead(204).end();return;}
  const file=path.resolve(root,'public','.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  try{let data=fs.readFileSync(fs.existsSync(file)?file:path.join(mobileRoot,'public',path.relative(path.join(root,'public'),file)));
    if(u.pathname==='/game.html'&&u.searchParams.get('qaBundle')==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__qa_bundle/android.css"><script src="/__qa_bundle/android.js"></script>'));
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(data);
  }catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const ua={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1',android:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)'};
function raw(){
  const s=engine.createInitialState(6);Object.assign(s,{phase:'playing',turnIndex:0,turnStep:'choose',venues:[],discard:[2,3],roundNo:80});
  s.players.forEach((p,i)=>Object.assign(p,{hand:i===0?4:i+2,tempDraw:i===0?6:null,alive:true,gold:10,displayName:'QA船長'+i,client:{name:'QA船長'+i,avatar:i+1}}));return s;
}
function guessRaw(enhanced=false){const found=engineCases.find(c=>c.label===`card-1-${enhanced?'enhanced':'normal'}/PICK_DIGIT`&&c.before.pending.extra.target===1);const s=structuredClone(found.before);s.phase='playing';s.players.forEach((p,i)=>{p.displayName='QA船長'+i;p.client={name:p.displayName,avatar:i+1};});return s;}
async function state(p,s){const visible=engine.getVisibleState(s,0);await p.evaluate(s=>{state=s;me.playerId=0;me.roomId='PICKER-QA';me.secret='fixture';render();window.__deliver('STATE',s);},visible);await p.waitForFunction(()=>document.documentElement.dataset.cardPickers==='v1');await idle(p);}
async function idle(p){await p.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy(),{},{timeout:30000});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));}
async function actions(p){return p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION').map(x=>x[1]));}
async function clear(p){await p.evaluate(()=>window.__sent=[]);}
async function activate(p,mode,selector){if(mode==='desktop')await p.locator(selector).click();else await p.locator(selector).tap();}
async function close(p){await p.locator('#phoneCardSheet .phone-card-sheet-head button').click();await p.waitForFunction(()=>document.getElementById('phoneCardSheet').hidden);await p.waitForTimeout(320);}
async function inspect(p,mode,slot=0){
  await p.waitForTimeout(320);const selector=slot?'#playDrawn':'#playHand';
  for(let i=0;i<2&&!await p.locator('#phoneCardSheet').isVisible();i++){
    if(mode==='desktop')await p.locator(selector).click();else{const pt=await p.locator(selector).evaluate(n=>{const r=n.getBoundingClientRect(),x=r.x+r.width/2,y=Math.min(innerHeight-8,Math.max(8,r.top+Math.min(20,r.height/2))),e=document.elementFromPoint(x,y);return {x,y,hit:!!e&&(e===n||n.contains(e))};});check('original hand hit point is reachable',pt.hit,pt);await p.touchscreen.tap(pt.x,pt.y);}await p.waitForTimeout(320);
  }
  await p.waitForFunction(()=>document.querySelector('#phoneCardSheet[data-inspect-kind="hand"][data-picker-design="v1"]')?.hidden===false);
}
async function hit(p,selector){return p.locator(selector).evaluate(n=>{const r=n.getBoundingClientRect(),e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:r.toJSON(),inside:r.width>0&&r.height>0&&r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,hit:!!e&&(n===e||n.contains(e)),top:e?.id||e?.className};});}
async function art(p,selector,label){
  const info=await p.locator(selector).evaluate(async panel=>{
    const surfaces=[panel,...panel.querySelectorAll('[data-picker-art]')],out=[];
    for(const n of surfaces)for(const pseudo of [null,'::before','::after']){
      const style=getComputedStyle(n,pseudo);if(style.display==='none'||pseudo&&style.content==='none')continue;
      const match=style.backgroundImage.match(/^url\(["']?(.*?)["']?\)$/);if(!match)continue;
      const img=new Image();img.src=match[1];await img.decode();const r=n.getBoundingClientRect();out.push({surface:n.getAttribute('data-picker-art')||n.id||n.className,pseudo,width:r.width,height:r.height,inside:r.left>=-1&&r.top>=-1&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,size:style.backgroundSize,borderSource:style.borderImageSource,ratioError:Math.abs(r.width/r.height-img.naturalWidth/img.naturalHeight)});
    }return out;
  });
  check(label+' generated artwork fits viewport and decodes at its original aspect ratio',info.length>0&&info.every(x=>x.inside&&x.naturalWidth>0&&x.naturalHeight>0&&x.ratioError<.035),info);
  check(label+' generated artwork uses contain without stretched border image',info.every(x=>x.size==='contain'&&x.borderSource==='none'),info);return info;
}
async function shot(p,name){const file=path.join(output,name+'.png');if(report.screenshots.length>=4||report.screenshots.includes(file)||process.env.CARD_PICKER_QA_NO_SHOTS)return;await p.screenshot({path:file});report.screenshots.push(file);}
async function handChecks(p,mode,label,width){
  await state(p,raw());await clear(p);await inspect(p,mode);const panel='#phoneCardSheet[data-inspect-kind="hand"]';
  check(label+' original inspector title and card exist',await p.locator(panel+' .phone-card-inspector-art img').getAttribute('src').then(s=>s.endsWith('/4.webp')));
  const artInfo=await art(p,panel,label+' choice frame');
  const image=await p.locator(panel+' .phone-card-inspector-art img').evaluate(async n=>{await n.decode();return {fit:getComputedStyle(n).objectFit,width:n.naturalWidth,height:n.naturalHeight};});check(label+' original card artwork retains contain',image.fit==='contain'&&image.width>0&&image.height>0,image);
  for(const selector of [panel+' .phone-card-sheet-head button',panel+' .phone-card-inspector-nav button[aria-label="下一張"]','#phoneCardConfirm']){const h=await hit(p,selector);check(label+' new frame leaves original control reachable '+selector,h.inside&&h.hit,h);}
  if(mode==='desktop'&&width===1366||mode==='android'&&width===740)await shot(p,mode+'-'+width+'-choice');
  if(mode==='android'&&width===740&&!process.env.CARD_PICKER_QA_NO_SHOTS&&!report.componentPreview){report.componentPreview=path.join(output,'picker-component-preview.png');await p.locator(panel).screenshot({path:report.componentPreview});}
  await activate(p,mode,panel+' .phone-card-inspector-nav button[aria-label="下一張"]');check(label+' next selects the original drawn card',await p.locator(panel+' .phone-card-inspector-art img').getAttribute('src').then(s=>s.endsWith('/6.webp')));
  await p.locator(panel+' .phone-card-inspector-copy').focus();await p.keyboard.press('ArrowLeft');check(label+' ArrowLeft selects original held card',await p.locator(panel+' .phone-card-inspector-art img').getAttribute('src').then(s=>s.endsWith('/4.webp')));await p.keyboard.press('ArrowRight');
  const original=await p.locator('#phoneCardConfirm').elementHandle();await activate(p,mode,'#phoneCardConfirm');await original.evaluate(n=>n.click());const sent=await actions(p);
  check(label+' original confirmation forwards drawn PLAY_CARD once even if stale control is activated again',sent.length===1&&sent[0].type==='PLAY_CARD'&&sent[0].payload.which==='drawn',sent);
  // WebKit can deliver a mouse compatibility click after touch pointerup closed
  // the sheet. It must not activate the captain underneath the old confirm.
  await p.waitForTimeout(120);
  check(label+' confirm compatibility click leaves inspector closed and collection unopened',await p.locator('#phoneCardSheet').evaluate(n=>n.hidden)&&await p.locator('#phoneCardSheet .phone-deluxe-collection').count()===0);
  await activate(p,mode,'#phoneSelfPlayer .phone-seat-avatar');
  check(label+' a fresh captain pointer gesture immediately opens the collection',await p.locator('#phoneCardSheet .phone-deluxe-collection').isVisible()&&await p.locator('#phoneCardSheetTitle').innerText()==='我的豪華卡');
  check(label+' fresh collection inspection preserves exactly one original PLAY_CARD',(await actions(p)).length===1);await close(p);
  if(mode==='desktop'&&width===1366||mode==='ios'&&width===640){
    await state(p,raw());await clear(p);await inspect(p,mode);await p.locator('#phoneCardConfirm').focus();await p.keyboard.press('Enter');await p.waitForTimeout(120);const keyboardSent=await actions(p);
    check(label+' Enter still confirms the original held card once',keyboardSent.length===1&&keyboardSent[0].type==='PLAY_CARD'&&keyboardSent[0].payload.which==='hand',keyboardSent);
    check(label+' keyboard confirmation leaves no accidental collection',await p.locator('#phoneCardSheet').evaluate(n=>n.hidden)&&await p.locator('#phoneCardSheet .phone-deluxe-collection').count()===0);
  }
  const frozen=raw();frozen.players[0].frozen=true;await state(p,frozen);await clear(p);check(label+' engine frozen hand retains original disabled button',await p.locator('#playHand').isDisabled());await inspect(p,mode,1);await activate(p,mode,panel+' .phone-card-inspector-nav button[aria-label="上一張"]');check(label+' frozen held-card confirmation is disabled',await p.locator('#phoneCardConfirm').isDisabled());await p.locator('#phoneCardConfirm').evaluate(n=>n.click());check(label+' frozen inspection emits no action',(await actions(p)).length===0);await close(p);
  await state(p,raw());await inspect(p,mode);await clear(p);const stale=await p.locator('#phoneCardConfirm').elementHandle(),changed=raw();changed.roundNo++;changed.players[0].hand=5;
  // Fixture-only model advance isolates the original inspector phaseKey guard.
  // A real STATE intentionally waits in the presentation queue while reading;
  // this test must not mistake that protected wait for a failure to become idle.
  await p.evaluate(s=>{state=s;render();},engine.getVisibleState(changed,0));await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const closed=await p.locator('#phoneCardSheet').evaluate(n=>n.hidden);check(label+' fixture-only model change closes or disables stale phaseKey confirmation',closed||await p.locator('#phoneCardConfirm').isDisabled());await stale.evaluate(n=>n.click());check(label+' stale confirmation cannot send an action',(await actions(p)).length===0);if(!closed)await close(p);
  return artInfo;
}
async function guessChecks(p,mode,label,width){
  let firstArt;
  for(const digit of [0,2,3,4,5,6,7,8,9]){
    const s=guessRaw();await state(p,s);await clear(p);await p.waitForFunction(()=>document.querySelector('#modal[data-picker-design="usopp"][data-interaction="guess"] .phone-sniper-number-grid'));
    const buttons=await p.locator('#modal button[data-d]').evaluateAll(ns=>ns.map(n=>({d:Number(n.dataset.d),disabled:n.disabled,original:window.__originalPickerHandlers.get(n)===n.onclick})));
    check(label+' original ten digit nodes, handlers and ban preserved '+digit,JSON.stringify(buttons.map(x=>x.d))==='[0,1,2,3,4,5,6,7,8,9]'&&buttons.every(x=>x.disabled===(x.d===1)&&x.original),buttons);
    const grid=await p.locator('.phone-sniper-number-grid').evaluate(n=>({cols:getComputedStyle(n).gridTemplateColumns.split(' ').length,rows:getComputedStyle(n).gridTemplateRows.split(' ').length}));check(label+' new sniper number grid has five columns and two rows '+digit,grid.cols===5&&grid.rows===2,grid);
    if(digit===0){check(label+' rendered guess panel permits real browser timer callbacks',await p.evaluate(()=>new Promise(resolve=>setTimeout(()=>resolve(true),20))));firstArt=await art(p,'#modal>.card',label+' sniper frame');const h=await hit(p,'#modal button[data-d="0"]');check(label+' number hit point is not covered by frame',h.inside&&h.hit,h);await p.locator('#modal button[data-d="1"]').evaluate(n=>n.click());check(label+' disabled 1 sends no action',(await actions(p)).length===0);if(mode==='android'&&(width===640||process.env.CARD_PICKER_QA_QUICK)||mode==='ios'&&width===844)await shot(p,mode+'-'+width+'-sniper');}
    const beforeTarget=await p.evaluate(()=>state.pending.extra.target);
    const digitHit=await hit(p,'#modal button[data-d="'+digit+'"]');check(label+' legal digit '+digit+' has an unobstructed visible touch point',digitHit.inside&&digitHit.hit,digitHit);
    if(digit===2){await p.locator('#modal button[data-d="2"]').focus();await p.keyboard.press('Enter');}
    else if(digit===3){await p.locator('#modal button[data-d="3"]').focus();await p.keyboard.press('Space');}
    else await activate(p,mode,'#modal button[data-d="'+digit+'"]');
    const sent=await actions(p);check(label+' legitimate digit '+digit+' sends one original PICK_DIGIT',sent.length===1&&sent[0].type==='PICK_DIGIT'&&sent[0].payload.digit===digit&&sent[0].playerId===0,sent);
    const actual=engine.applyAction(s,{type:'PICK_DIGIT',playerId:0,payload:sent[0].payload}),guess=actual.emits.filter(e=>e.type==='card_guess');check(label+' engine confirms digit '+digit+' and unchanged target',guess.length===1&&guess[0].digit===digit&&guess[0].targetId===beforeTarget&&beforeTarget===s.pending.extra.target,guess);
    const another=digit===0?2:0;await p.locator('#modal button[data-d="'+another+'"]').evaluate(n=>n.click());check(label+' original digit lock prevents second submission '+digit,(await actions(p)).length===1);
  }
  const enhanced=guessRaw(true);await state(p,enhanced);check(label+' enhanced Usopp retains original target',await p.evaluate(()=>state.pending.extra.chain===true&&state.pending.extra.target===1));
  await clear(p);await p.evaluate(()=>{const view=document.createElement('article');view.textContent='讀取中的規則';CardPhonePresentation.openView('規則',view);});check(label+' real reading state activates original presentation guard',await p.locator('#modal button[data-d="4"]').evaluate(n=>CardPhonePresentation.canSendPresentedAction(n)===false));await p.locator('#modal button[data-d="4"]').evaluate(n=>n.click());check(label+' busy capture blocks digit despite new visual design',(await actions(p)).length===0);await p.evaluate(()=>CardPhonePresentation.closeSheet());
  return firstArt;
}
let browser,page;
try{
  for(const mode of modes){
    browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
    let sizes=mode==='desktop'?[[1366,768],[1024,600]]:mode==='android'?[[844,390],[844,316],[740,320],[740,316],[640,320],[640,316]]:[[844,390],[640,320]];
    if(process.env.CARD_PICKER_QA_VIEWPORTS)sizes=process.env.CARD_PICKER_QA_VIEWPORTS.split(',').map(s=>s.split('x').map(Number));
    if(process.env.CARD_PICKER_QA_QUICK)sizes=[mode==='android'?[740,320]:sizes[0]];
    for(const [width,height] of sizes){
      const label=mode+' '+width+'x'+height,ctx=await browser.newContext({viewport:{width,height},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',userAgent:ua[mode],serviceWorkers:'block'});
      await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve();};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};window.__originalPickerHandlers=new WeakMap();new MutationObserver(()=>{for(const n of document.querySelectorAll('button[data-d]'))if(!window.__originalPickerHandlers.has(n))window.__originalPickerHandlers.set(n,n.onclick);}).observe(document,{childList:true,subtree:true});});
      if(mode==='ios')await ctx.addInitScript({content:bundles.ios.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/__qa_bundle/ios.css';document.head.append(link);},{once:true});`});
      page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({case:label,message:e.message}));await page.goto(origin+'/game.html?qaBundle='+mode,{waitUntil:'load'});
      const hand=await handChecks(page,mode,label,width),guess=await guessChecks(page,mode,label,width);check(label+' no page errors',!report.errors.some(x=>x.case===label),report.errors);report.cases.push({label,handArt:hand,guessArt:guess});save();await ctx.close();page=null;
    }
    await browser.close();browser=null;
  }
  check('source bytes stayed unchanged throughout this run',report.source.every(x=>sha(fs.readFileSync(path.join(root,x.file)))===x.sha256),report.source);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{report.failureScreenshot=path.join(output,'failure.png');await page.screenshot({path:report.failureScreenshot});}catch{}}
finally{await browser?.close();await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure,report:path.join(output,'report.json'),screenshots:report.screenshots,component:report.componentPreview}));}
