/* Viewer-visible browser regression: enhanced discard art and private deluxe/Teach faces. */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
import {readMobileSources} from 'file:///C:/Users/%E7%8E%8B%E6%9B%9C%E7%91%8B/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/mobile-sources.mjs';
const require=createRequire(import.meta.url);
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const engine=require(root+'/server/engine.js'),desktop=process.env.PO_DESKTOP==='1';
const output=process.env.PO_QA_OUT||'D:/Codex_QA/card-hud-discard-20261103/discard-'+(desktop?'desktop':'mobile');
fs.mkdirSync(output,{recursive:true});
const report={scope:'Local original HTML and engine-produced visible state in an isolated browser; no physical-device acceptance.',checks:[],errors:[]};
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const socketStub=`window.__sent=[];window.__handlers={};window.io=()=>({connected:true,id:'discard-fixture',on(n,f){(window.__handlers[n]??=[]).push(f);return this},onAny(){return this},once(){return this},listeners(n){return [...(window.__handlers[n]||[])]},off(){return this},emit(...a){window.__sent.push(a);return this},disconnect(){},connect(){}});`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
const baseline=process.env.PO_QA_BASELINE?execFileSync('git',['show',process.env.PO_QA_BASELINE+':public/game.html'],{cwd:root,maxBuffer:40e6}):null;
const server=http.createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'public','.'+name);
 if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
 if(name.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(socketStub);return;}
 if(/\.(mp3|mp4|ogg|wav|webm|m4a|qa-disabled)$/i.test(name)){res.writeHead(204).end();return;}
 try{const ext=path.extname(file),data=name==='/game.html'&&baseline?baseline:fs.readFileSync(fs.existsSync(file)?file:path.join(mobile,'public',path.relative(path.join(root,'public'),file)));res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'}).end(['.html','.js'].includes(ext)?data.toString().replace(/\.(mp3|mp4|ogg|wav|webm|m4a)\b/gi,'.qa-disabled'):data);}catch{res.writeHead(404).end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const browser=process.env.PO_QA_WEBKIT?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
const bundleRoot=process.env.PO_QA_MOBILE_ASSETS;
const {script,css}=desktop?{script:'',css:''}:bundleRoot?{script:fs.readFileSync(path.join(bundleRoot,'game-mobile.js'),'utf8'),css:fs.readFileSync(path.join(bundleRoot,'game-mobile.css'),'utf8')}:readMobileSources();
function played(){
 const s=engine.createInitialState(4);s.phase='playing';s.turnIndex=0;s.turnStep='choose';s.venues=[{name:'巴拉蒂'},{name:'佐烏'}];s.discard=[1,{id:4,coverBy:'teach',owner:1}];
 s.deluxeUnlocks={0:[3],1:[1]};
 s.players.forEach((p,i)=>{p.hand=i===0?3:i+5;p.tempDraw=i===0?2:null;p.gold=10;p.alive=true;p.client={name:'玩家'+i,displayName:'玩家'+i,avatar:i+1};});
 return engine.applyAction(s,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}).state;
}
try{
 const stateAfterPlay=played();check('engine played enhanced card into numeric discard',stateAfterPlay.discard.at(-1)===3);
 for(const viewer of [0,1]){
  const visible=engine.getVisibleState(stateAfterPlay,viewer);check('only viewer deluxe list is visible '+viewer,JSON.stringify(visible.myDeluxe)===JSON.stringify(viewer===0?[3]:[1])&&!('deluxeUnlocks'in visible));
  check('Teach owner alone sees hidden identity '+viewer,viewer===0?visible.discard[1].back===true&&visible.discard[1].id===undefined:visible.discard[1]===4);
  const userAgent=desktop?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1':process.env.PO_QA_WEBKIT?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)':'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)';
  const context=await browser.newContext({viewport:desktop?{width:1366,height:768}:{width:740,height:360},hasTouch:!desktop,isMobile:!desktop,serviceWorkers:'block',userAgent});
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  await context.addInitScript({content:`window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};${script}\nconst s=document.createElement('style');s.textContent=${JSON.stringify(css)};new MutationObserver((_,o)=>{if(document.documentElement){document.documentElement.append(s);o.disconnect();}}).observe(document,{childList:true});`});
  const p=await context.newPage();p.on('pageerror',e=>report.errors.push(e.message));await p.goto(origin+'/game.html',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.CardPhonePresentation?.openDiscard);
  if(!baseline)await p.waitForFunction(()=>window.CardPhonePresentation?.discardFaceVersion===1);
  await p.evaluate(({s,viewer})=>{state=s;me.playerId=viewer;me.roomId='DISCARD-FIXTURE';me.secret='fixture';render();},{s:visible,viewer});
  await p.waitForFunction(()=>document.querySelectorAll('#discard img').length===3);
  const expected=viewer===0?['images/cards/1.webp','images/cards/back.webp','images/cards_lux/enh/3.webp']:['images/cards_lux/1.webp','images/cards/enh/4.webp','images/cards/enh/3.webp'];
  const thumbs=await p.locator('#discard img').evaluateAll(ns=>ns.map(n=>new URL(n.src).pathname.slice(1)));
  check('thumbnail faces preserve normal enhanced and private styles '+viewer,JSON.stringify(thumbs)===JSON.stringify(expected),thumbs);
  const actionCount=await p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION').length);
  await p.evaluate(()=>CardPhonePresentation.openDiscard());await p.waitForSelector('#phoneLibrary:not([hidden])');
  const cards=p.locator('#phoneLibrary .phone-library-item');
  await p.waitForFunction(expected=>JSON.stringify([...document.querySelectorAll('#phoneLibrary .phone-library-item img')].map(n=>new URL(n.src).pathname.slice(1)))===JSON.stringify(expected),expected);
  const library=await cards.locator('img').evaluateAll(ns=>ns.map(n=>new URL(n.src).pathname.slice(1)));
  check('discard library preserves the same faces '+viewer,JSON.stringify(library)===JSON.stringify(expected),library);
  await cards.nth(2).click();
  check('enlarged played card retains enhanced face '+viewer,await p.locator('#phoneLibrary .phone-library-art img').getAttribute('src')===expected[2]);
  check('enlarged effect is enhanced '+viewer,(await p.locator('#phoneLibrary .phone-library-copy').innerText()).includes('【強化】'));
  await p.locator('#phoneLibrary .phone-library-head button').click();await cards.nth(1).click();
  check('Teach inspector honors owner visibility '+viewer,viewer===0?(await p.locator('#phoneLibrary .phone-library-copy').innerText()).includes('只顯示卡背'):(await p.locator('#phoneLibrary .phone-library-art img').getAttribute('src'))===expected[1]);
  check('inspection sends no game action '+viewer,await p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION').length)===actionCount);
  await context.close();
 }
 check('no browser script errors',report.errors.length===0,report.errors);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;}finally{await browser.close();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
