'use strict';
// Local production-entry/browser QA. Fixture IPC exists only in the owned child.
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const Module = require('node:module');
const {createHash} = require('node:crypto');
const {spawn, spawnSync} = require('node:child_process');
const {once} = require('node:events');
const root = path.resolve(__dirname, '..');
const mobileRoot = process.env.CARD_DUEL_MOBILE_ROOT || 'C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const dependencyRoot = process.env.CARD_DUEL_NODE_MODULES || path.join(mobileRoot, 'node_modules');
process.env.NODE_PATH = [dependencyRoot, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();
const out = process.env.CARD_DUEL_QA_OUT || 'D:/Codex_QA/card-duel-stage-20261106/browser';
const browserCache = process.env.CARD_DUEL_WEBKIT_CACHE || 'D:/Codex_QA/card-duel-stage-20261106/playwright-browsers';
if (fs.existsSync(browserCache)) process.env.PLAYWRIGHT_BROWSERS_PATH = browserCache;

if (process.argv.includes('--fixture-server')) {
  // Deterministic, valid UUIDs select all three cosmetic backgrounds. No game
  // comparison, hand, effect, or timing logic is replaced.
  const crypto = require('node:crypto'), originalUuid = crypto.randomUUID;
  let forcedUuids = [];
  crypto.randomUUID = (...args) => forcedUuids.length ? forcedUuids.shift() : originalUuid(...args);
  const entry = path.join(root, 'server/index.js');
  const childModule = new Module(entry, module);
  childModule.filename = entry;
  childModule.paths = Module._nodeModulePaths(path.dirname(entry));
  const fixture = String.raw`
app.use(require('express').static(process.env.CARD_DUEL_QA_ASSETS, {fallthrough:true}));
function __duelQaStop(room) {
  for (const key of ['_turnTimer','_pendingTimer','_turnWarnTimer','_pendingWarnTimer','_autoNextTimer','_cpuLoopTimer']) {clearTimeout(room[key]);room[key]=null;}
  room._cpuLoopToken=(room._cpuLoopToken||0)+1;
  room._cpuFastForward=false;
}
function __duelQaStatus(room) {
  const s=room.state;
  return {round:s.roundNo,turn:s.turnIndex,step:s.turnStep,pending:s.pending?.action||null,deck:s.deck.length,discard:s.discard.slice(),gate:cardPresentationReady.view(room),players:s.players.map(p=>({id:p.id,alive:p.alive,isCPU:!!p.isCPU,hand:p.hand,avatar:p.client?.avatar??p.avatar,name:p.client?.displayName||p.displayName}))};
}
function __duelQaSeed(room, request) {
  __duelQaStop(room);
  const previous=room.state, s=createInitialState(4), pair=request.pair||[8,5],target=request.target??1;
  s.roundNo=request.round||previous.roundNo;
  s.venues=previous.venues;
  s.turnIndex=0;s.turnStep='pending';s.phase='playing';s.deck=[0,1,2,4,6,7,8,9,10,11,12,13,14,15,16,17,18,19];s.discard=[3];s.log=[];
  for(const p of s.players) {
    const old=previous.players.find(x=>x.id===p.id);
    if(old)Object.assign(p,old);
    p.alive=!(request.cpuGate&&p.id===2);p.hand=p.id===0?pair[0]:p.id===target?pair[1]:p.id===2?4:6;p.tempDraw=null;
    if(!p.alive)p.hand=null;
    p.isCPU=p.id===3;p.protected=false;p.dodging=false;p.frozen=false;p.skipNext=false;p.gold=5;
    p.client={...(old?.client||{}),displayName:['QA 挑戰者','QA 防守者','QA 旁觀者','QA CPU'][p.id],avatar:p.id+1};
    p.displayName=p.client.displayName;p.avatar=p.client.avatar;
  }
  s.pending={action:'sanji',extra:{keep:pair[0],boost:false}};
  room.state=s;room.phase='playing';room._venueReady=null;room._presentationReady=null;
  broadcastState(room);
  return s;
}
process.on('message', request => {
  try {
    if(!String(request.roomId||'').startsWith('QA-DUEL-'))throw Error('Isolated QA room required');
    const room=rooms.get(request.roomId);if(!room)throw Error('QA room not joined');
    if(request.type==='lobby')room.cpuCount=0;
    if(request.type==='seed')__duelQaSeed(room,request);
    if(request.type==='next-round')__duelQaSeed(room,{...request,round:room.state.roundNo+1});
    if(request.type==='arm-uuid')process.emit('card-duel-qa-uuid',request.ids||[]);
    if(request.type==='multi') {
      const s=__duelQaSeed(room,{...request,pair:[8,2]});
      s.players[2].hand=4;s.pending={action:'luffy',extra:{keep:8,firstDone:false}};
      process.emit('card-duel-qa-uuid',request.ids||[]);
      const first=applyAction(s,{type:'PICK_TARGET',playerId:0,payload:{target:1}});
      const second=applyAction(first.state,{type:'LUFFY_SECOND',playerId:0,payload:{target:2}});
      const events=[...first.emits,...second.emits];
      if(events.filter(e=>e.type==='duel').length!==2)throw Error('Actual Luffy fixture did not emit two duels');
      room.state=second.state;cardPresentationReady.begin(room);
      for(const event of events)for(const [sid,meta]of room.sockets)if(event.to==='all'||event.to===meta.playerId)io.to(sid).emit('EMIT',event);
      broadcastState(room);
    }
    if(request.type==='stop-cpu')__duelQaStop(room);
    process.send({key:request.key,value:__duelQaStatus(room)});
  } catch(error) {process.send({key:request.key,error:error.stack});}
});
`;
  process.on('card-duel-qa-uuid', ids => { forcedUuids = ids.slice(); });
  let serverSource=fs.readFileSync(entry,'utf8');
  if(process.env.CARD_DUEL_QA_PHASE==='legacy'){
    childModule.__legacyQaBytes=Object.fromEntries([['/game.html','public/game.html'],['/js/card-desktop-table.js','public/js/card-desktop-table.js']].map(([url,file])=>{const result=spawnSync('git',['show','dbc45faa4377df86cf0fbb86944c1379b84cdc05:'+file],{cwd:root,maxBuffer:8*1024*1024});if(result.status!==0)throw Error('Missing legacy bytes '+file);return[url,result.stdout];}));
    const anchor='app.use(desktopDistribution.middleware);';if(!serverSource.includes(anchor))throw Error('QA HTTP fixture insertion point missing');
    serverSource=serverSource.replace(anchor,anchor+'\napp.get(["/game.html","/js/card-desktop-table.js"],(req,res,next)=>{if(req.headers["x-card-duel-qa-legacy"]!=="1")return next();res.type(req.path.endsWith(".js")?"application/javascript":"text/html").send(module.__legacyQaBytes[req.path]);});\n');
  }
  childModule._compile(serverSource + '\n' + fixture, entry);
  return;
}

fs.mkdirSync(out, {recursive:true});
const pw = require(process.env.CARD_DUEL_PLAYWRIGHT || 'C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const report = {passed:false,scope:'Three independent guest browser clients using the candidate production server, engine and Socket.IO. Test-process-only deterministic pending states and cosmetic UUIDs. Browser-only media routes allow the hash-verified live Card manifest plus exactly three new candidate arena files; movies/audio are muted fixture stubs. No database/account, native entry/network, native install, physical-device, video-decoder or public-release acceptance.',sources:[],profiles:[],bundles:[],assetSources:[],stubbedMedia:[],unexpectedAssets:[],checks:[],cases:[],errors:[],missingAssets:[],screenshots:[]};
const tracked = ['server/index.js','server/engine.js','server/card_presentation_ready.js','public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','public/css/card-native-online.css','public/js/card-duel-private.js','public/js/card-duel-runtime.js','public/js/card-duel-stage.js','public/css/card-duel-stage.css'];
const digest = file => {const bytes=fs.readFileSync(file);return {bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
let legacyBytesCache;
function legacyBytes(){if(legacyBytesCache)return legacyBytesCache;const base='dbc45faa4377df86cf0fbb86944c1379b84cdc05',files=['public/game.html','public/js/card-desktop-table.js'],bytes={};report.legacySources=files.map(file=>{const result=spawnSync('git',['show',base+':'+file],{cwd:root,maxBuffer:8*1024*1024});if(result.status!==0)throw Error('Cannot read legacy source '+file);bytes[file]=result.stdout;return{base,file,bytes:result.stdout.length,sha256:sha(result.stdout)};});legacyBytesCache=bytes;return bytes;}
const liveAssetMap = new Map(), assetBytes = new Map(), newArenas = new Set(['marineford','onigashima','dressrosa'].map(arena=>'images/card-duel/arena-'+arena+'-v1.webp'));
async function loadLiveManifest(){
  const origin=process.env.CARD_DUEL_LIVE_ORIGIN||'https://onepiece-card-online.onrender.com';
  const catalogResponse=await fetch(origin+'/desktop/catalog-v3.json',{signal:AbortSignal.timeout(20000)});if(!catalogResponse.ok)throw Error('Live catalog HTTP '+catalogResponse.status);
  const catalogBytes=Buffer.from(await catalogResponse.arrayBuffer()),catalog=JSON.parse(catalogBytes),card=catalog.games?.card;if(!card?.manifestPath)throw Error('Live Card catalog entry missing');
  const manifestResponse=await fetch(origin+'/'+card.manifestPath,{signal:AbortSignal.timeout(20000)});if(!manifestResponse.ok)throw Error('Live manifest HTTP '+manifestResponse.status);
  const manifestBytes=Buffer.from(await manifestResponse.arrayBuffer());if(sha(manifestBytes)!==card.manifestSha256)throw Error('Live manifest SHA does not match catalog');
  const manifest=JSON.parse(manifestBytes);for(const asset of manifest.assets)liveAssetMap.set(asset.path,asset);
  report.protectedOriginalStyles=['css/card-desktop-table.css','css/card-native-online.css'].map(logical=>{const actual=digest(path.join(root,'public',logical)),published=liveAssetMap.get(logical);if(!published||actual.sha256!==published.sha256||actual.bytes!==published.size)throw Error('Protected original CSS RAW bytes do not equal the live Card manifest: '+logical);return{logical,...actual,liveSha256:published.sha256,matchesLive:true};});
  report.liveAssets={origin,checkedAt:new Date().toISOString(),releaseId:card.releaseId,catalogSha256:sha(catalogBytes),manifestPath:card.manifestPath,manifestSha256:sha(manifestBytes),blobBase:catalog.assetBlobBaseUrl,total:manifest.assets.length,newArenaWhitelist:[...newArenas]};
  fs.writeFileSync(path.join(out,'live-catalog.json'),catalogBytes);fs.writeFileSync(path.join(out,'live-card-manifest.json'),manifestBytes);save();
}
async function assetRoute(route,relative){
  const published=liveAssetMap.get(relative),isNew=newArenas.has(relative);
  if(!published&&!isNew){report.unexpectedAssets.push(relative);return route.fulfill({status:404,body:'Not a published Card asset or new arena whitelist path'});}
  let bytes=assetBytes.get(relative),source;
  if(!bytes){
    const file=[path.join(root,'public',relative),path.join(mobileRoot,'public',relative)].find(file=>fs.existsSync(file)&&fs.statSync(file).isFile()&&(isNew||digest(file).sha256===published.sha256));
    if(file){bytes=fs.readFileSync(file);source=file;}
    else if(published){const url=report.liveAssets.blobBase+'/'+published.sha256.slice(0,2)+'/'+published.sha256;const response=await fetch(url,{headers:{Origin:report.liveAssets.origin},signal:AbortSignal.timeout(20000)});if(!response.ok)throw Error('Published asset HTTP '+response.status+': '+relative);bytes=Buffer.from(await response.arrayBuffer());source=url;}
    else throw Error('New arena candidate file missing: '+relative);
    if(published&&(sha(bytes)!==published.sha256||bytes.length!==published.size))throw Error('Published asset bytes differ from manifest: '+relative);
    assetBytes.set(relative,bytes);report.assetSources.push({logical:relative,source,published:!!published,newArena:isNew,bytes:bytes.length,sha256:sha(bytes)});
  }
  const ext=path.extname(relative).toLowerCase(),mime={'.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.ttf':'font/ttf'};
  return route.fulfill({status:200,contentType:published?.mime||mime[ext]||'application/octet-stream',body:bytes});
}
report.sources=tracked.filter(f=>fs.existsSync(path.join(root,f))).map(file=>({file,...digest(path.join(root,file))}));
const save = () => fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass:!!pass,detail});save();if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const wait = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function until(name, predicate, timeout=15000){const end=Date.now()+timeout;do{const value=await predicate();if(value)return value;await wait(40);}while(Date.now()<end);throw Error(name+' timed out');}
function hashId(value){let h=2166136261;for(const c of value)h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
const arenas=['marineford','onigashima','dressrosa'];
function uuidFor(arena,nonce){for(let i=nonce*32;i<nonce*32+200;i++){const id='00000000-0000-4000-8000-'+i.toString(16).padStart(12,'0');if(arenas[hashId(id)%3]===arena)return id;}throw Error('UUID selector');}
function inside(a,b){return a.x>=b.x-1&&a.right<=b.right+1&&a.y>=b.y-1&&a.bottom<=b.bottom+1;}
function overlap(a,b){return a&&b&&Math.min(a.right,b.right)>Math.max(a.x,b.x)+1&&Math.min(a.bottom,b.bottom)>Math.max(a.y,b.y)+1;}
let child, serverLog='',requestNo=0, activePages=[], activeBrowser;
async function rpc(type,roomId,extra={}){const key=++requestNo;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{child.off('message',receive);reject(Error(type+' fixture IPC timed out'));},5000);function receive(message){if(message?.key!==key)return;clearTimeout(timer);child.off('message',receive);message.error?reject(Error(message.error)):resolve(message.value);}child.on('message',receive);child.send({key,type,roomId,...extra});});}
async function action(page,type,payload={}){await page.evaluate(({type,payload})=>sendAction(type,payload),{type,payload});}
async function idle(page,timeout=30000){await page.waitForFunction(()=>window.CardPhonePresentation&&!CardPhonePresentation.presentationQueueSize?.()&&!CardPhonePresentation.presentationEffectsBusy?.()&&!CardPhonePresentation.isVenueEntering?.()&&!CardPhonePresentation.isVenueIntroPending?.(),null,{timeout});}
async function stableIdle(page,timeout=65000){let stable=0;await until('stable presentation idle',async()=>{const value=await page.evaluate(()=>window.CardPhonePresentation&&!CardPhonePresentation.presentationQueueSize?.()&&!CardPhonePresentation.presentationEffectsBusy?.()&&!CardPhonePresentation.isVenueEntering?.()&&!CardPhonePresentation.isVenueIntroPending?.());stable=value?stable+1:0;return stable>=10;},timeout);}
async function resizeGroup(group,width,height){await Promise.all(group.pages.map(page=>page.setViewportSize({width,height})));await Promise.all(group.pages.map(page=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))));}
async function stage(page){return page.evaluate(()=>{
  const node=document.querySelector('.card-duel-stage');if(!node)return null;
  const r=n=>{if(!n)return null;const b=n.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height};};
  return {width:innerWidth,height:innerHeight,scrollWidth:document.scrollingElement.scrollWidth,rect:r(node),arena:node.dataset.arena,phase:node.dataset.phase,text:node.textContent,background:getComputedStyle(node).backgroundImage,effects:[...node.querySelectorAll('.cduel-charge,.cduel-shot')].map(img=>({dataUri:img.getAttribute('src')?.startsWith('data:image/'),complete:img.complete,naturalWidth:img.naturalWidth,objectFit:getComputedStyle(img).objectFit})),verdict:{hidden:node.querySelector('.cduel-verdict').hidden,rect:r(node.querySelector('.cduel-verdict')),text:node.querySelector('.cduel-verdict').textContent},slots:[...node.querySelectorAll('.cduel-slot')].map(slot=>{const img=slot.querySelector('img.cduel-card'),badge=slot.querySelector('.cduel-number'),avatar=slot.querySelector('img.cduel-portrait');return{id:Number(slot.dataset.player),side:slot.dataset.side,name:slot.querySelector('.cduel-name').textContent,identityRect:r(slot.querySelector('.cduel-identity')),nameRect:r(slot.querySelector('.cduel-name')),cardRect:r(slot.querySelector('.cduel-card-wrap')),src:img.getAttribute('src'),alt:img.alt,revealed:img.dataset.revealed||null,complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,objectFit:getComputedStyle(img).objectFit,ko:Number(getComputedStyle(slot.querySelector('.cduel-ko')).opacity),badge:badge?{text:badge.textContent,visibility:badge.dataset.visibility,aria:badge.getAttribute('aria-label'),rect:r(badge)}:null,avatar:avatar?{src:avatar.getAttribute('src'),complete:avatar.complete,naturalWidth:avatar.naturalWidth}:null};})};
});}
function hiddenCorrect(s,viewer,pair,ids=[0,1]){return s&&s.slots.length===2&&s.slots.every((slot,i)=>slot.id===ids[i]&&/cards\/back\.webp$/.test(slot.src)&&!slot.revealed&&(!ids.includes(viewer)?slot.badge===null:slot.badge?.visibility==='private'&&slot.badge.text===String(pair[i])));}
function geometry(s){return s&&s.scrollWidth<=s.width+1&&inside(s.rect,{x:0,y:0,right:s.width,bottom:s.height})&&s.slots.every(slot=>inside(slot.cardRect,s.rect)&&inside(slot.identityRect,s.rect)&&slot.objectFit==='contain'&&(!slot.badge||inside(slot.badge.rect,slot.cardRect))&&(s.verdict.hidden||!overlap(slot.identityRect,s.verdict.rect)));}
async function installTrace(page){await page.evaluate(()=>{
  window.__duelQA={wire:[],actions:[],history:[],last:''};const qa=window.__duelQA;
  const emit=socket.emit;socket.emit=function(type,data,...rest){if(type==='ACTION')qa.actions.push({time:performance.now(),type:data.type,gate:data.payload?.id});return emit.call(this,type,data,...rest);};
  socket.onAny((type,data)=>{if(type==='EMIT')qa.wire.push(data);if(type==='STATE')qa.raw={round:data.roundNo,turn:data.turnIndex,step:data.turnStep,gate:data.presentationReady};});
  const record=()=>{const n=document.querySelector('.card-duel-stage'),entry={time:performance.now(),phase:n?.dataset.phase||null,arena:n?.dataset.arena||null,slots:n?[...n.querySelectorAll('.cduel-slot')].map(slot=>({id:Number(slot.dataset.player),src:slot.querySelector('.cduel-card').getAttribute('src'),badge:slot.querySelector('.cduel-number')?.textContent||null,visibility:slot.querySelector('.cduel-number')?.dataset.visibility||null,revealed:slot.querySelector('.cduel-card').dataset.revealed||null})):[]};const key=JSON.stringify({...entry,time:0});if(key!==qa.last){qa.last=key;qa.history.push(entry);}};
  new MutationObserver(record).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase','data-revealed','src','data-visibility']});record();
});}
async function clearTrace(pages){for(const p of pages)await p.evaluate(()=>{const q=window.__duelQA;q.wire=[];q.actions=[];q.history=[];q.last='';});}
async function selectSeed(group,pair,options={}){
  await rpc('seed',group.room,{pair,...options});for(const p of group.pages)await idle(p);
  for(const p of group.pages)await p.waitForFunction(()=>state?.pending?.action==='sanji');await clearTrace(group.pages);
}
async function startDuel(group,pair,arena,nonce,options={}){
  await selectSeed(group,pair,options);const duelId=uuidFor(arena,nonce);await rpc('arm-uuid',group.room,{ids:[duelId]});await action(group.pages[0],'PICK_TARGET',{target:1});
  await Promise.all(group.pages.map(p=>p.waitForSelector('.card-duel-stage',{timeout:20000})));return duelId;
}
async function closeGroup(group){for(const context of group.contexts)await context.close();await group.browser.close();activePages=[];activeBrowser=null;}
async function createGroup(profile,origin){
  console.log('START '+profile.id);const browser=await pw[profile.engine].launch({headless:true,timeout:15000,...(profile.engine==='chromium'?{executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}:{})});activeBrowser=browser;
  const group={browser,profile,room:'QA-DUEL-'+profile.id+'-'+Date.now(),pages:[],contexts:[]};
  const ua=profile.bundle==='android'?'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)':profile.bundle==='ios'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1';
  report.profiles.push({...profile,userAgent:ua,electronCompatibilityToken:true,nativeEntryVerified:false,scope:profile.bundle?'Exact retained presentation hooks/CSS in a browser engine; compatibility token is a local HTTP/socket gate fixture, not proof of shipping app headers or native entry.':'Desktop browser with launcher-compatible UA.'});save();
  const bundleRoot=profile.bundle==='android'?path.join(mobileRoot,'android/app/src/main/assets/mobile'):profile.bundle==='ios'?(process.env.CARD_DUEL_IOS_BUNDLE||'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile'):null;
  let bundleJs,bundleCss;if(bundleRoot){bundleJs=fs.readFileSync(path.join(bundleRoot,'game-mobile.js'),'utf8');bundleCss=fs.readFileSync(path.join(bundleRoot,'game-mobile.css'));if(!report.bundles.some(b=>b.kind===profile.bundle))report.bundles.push({kind:profile.bundle,root:bundleRoot,js:digest(path.join(bundleRoot,'game-mobile.js')),css:digest(path.join(bundleRoot,'game-mobile.css'))});}
  for(let viewer=0;viewer<3;viewer++){
    const oldViewer=process.env.CARD_DUEL_QA_PHASE==='legacy'&&viewer===0;
    const context=await browser.newContext({viewport:{width:profile.width,height:profile.height},hasTouch:!!profile.bundle,userAgent:ua,serviceWorkers:'block'});group.contexts.push(context);
    await context.route('**/*',route=>{
      const url=new URL(route.request().url());if(url.origin!==origin)return route.abort();
      if(/^\/(?:audio|videos)\//.test(url.pathname)){const relative=decodeURIComponent(url.pathname).replace(/^\//,'');if(!liveAssetMap.has(relative))report.unexpectedAssets.push(relative);if(!report.stubbedMedia.includes(relative))report.stubbedMedia.push(relative);return route.fulfill({status:204,body:''});}
      if(/^\/(?:images|art|fonts)\//.test(url.pathname)){
        const relative=decodeURIComponent(url.pathname).replace(/^\//,'');return assetRoute(route,relative);
      }
      return route.continue();
    });
    if(bundleRoot)await context.route('**/__duel_qa_retained.css',route=>route.fulfill({status:200,contentType:'text/css',body:bundleCss}));
    if(oldViewer){legacyBytes();await context.setExtraHTTPHeaders({'X-Card-Duel-QA-Legacy':'1'});}
    await context.addInitScript({content:`window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;if(!localStorage.getItem('opSecret'))localStorage.setItem('opSecret','qa-duel-'+crypto.randomUUID());HTMLMediaElement.prototype.play=function(){if(this.id==='enhVideo'){const v=this;setTimeout(()=>v.dispatchEvent(new Event('ended')),120);}return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){};${bundleJs||''}\n${bundleRoot?`const link=document.createElement('link');link.rel='stylesheet';link.href='/__duel_qa_retained.css';new MutationObserver((_,observer)=>{if(document.documentElement){document.documentElement.append(link);observer.disconnect();}}).observe(document,{childList:true});`:''}`});
    const page=await Promise.race([context.newPage(),wait(12000).then(()=>{throw Error(profile.id+' newPage timed out');})]);group.pages.push(page);activePages=group.pages;page.setDefaultTimeout(15000);
    page.on('pageerror',error=>report.errors.push({profile:profile.id,viewer,message:error.message}));page.on('response',response=>{if(response.status()===404&&/\.(webp|png|jpg|css|js)(?:\?|$)/.test(response.url()))report.missingAssets.push({profile:profile.id,url:new URL(response.url()).pathname});});
    await page.goto(origin+'/game.html?name=QA'+viewer+'&avatar='+(viewer+1),{waitUntil:'domcontentloaded',timeout:30000});await page.waitForFunction(oldViewer=>typeof doJoin==='function'&&typeof socket==='object'&&socket.connected&&window.CardPhonePresentation&&(oldViewer||CardPhonePresentation.duelStageVersion>=1&&CardPhonePresentation.duelRuntimeVersion>=1),oldViewer);if(oldViewer)group.legacyPage=page;
    await installTrace(page);await page.evaluate(({room,viewer})=>{el.room.value=room;doJoin(['QA 挑戰者','QA 防守者','QA 旁觀者'][viewer]);history.replaceState(null,'','/game.html?room='+encodeURIComponent(room)+'&name=QA'+viewer+'&avatar='+(viewer+1));},{room:group.room,viewer});await page.waitForFunction(()=>me.playerId!==null&&state?.players?.length>0);
    await wait(250);if(await page.locator('#phoneVenueIntro:not([hidden])').count()){await page.waitForFunction(()=>!document.getElementById('phoneVenueContinue').disabled);await page.locator('#phoneVenueContinue').click();}await idle(page);
  }
  await group.pages[0].waitForFunction(()=>state.players.length===3);await rpc('lobby',group.room);
  for(const p of group.pages)await action(p,'LOBBY_READY');await wait(160);await action(group.pages[0],'START_GAME');
  for(const p of group.pages){await p.locator('#phoneVenueContinue').waitFor({state:'visible',timeout:30000});await p.waitForFunction(()=>!document.getElementById('phoneVenueContinue').disabled);await p.locator('#phoneVenueContinue').click();}
  for(const p of group.pages)await idle(p,60000);
  const seats=await Promise.all(group.pages.map(async(page,index)=>({page,context:group.contexts[index],seat:await page.evaluate(()=>me.playerId)})));seats.sort((a,b)=>a.seat-b.seat);group.pages=seats.map(item=>item.page);group.contexts=seats.map(item=>item.context);activePages=group.pages;
  check(profile.id+' original guest create/join/ready/start works across three browsers',await group.pages[0].evaluate(()=>state.players.length===3)&&JSON.stringify(seats.map(item=>item.seat))==='[0,1,2]',{engine:profile.engine,bundle:profile.bundle||'desktop',viewport:[profile.width,profile.height],actualSortedSeats:seats.map(item=>item.seat)});
  return group;
}
async function verifyDuel(group,item,nonce){
  const {pages,profile}=group,pair=item.pair,loser=pair[0]%10===pair[1]%10?null:pair[0]%10>pair[1]%10?1:0,winner=loser===null?null:1-loser;
  await selectSeed(group,pair,{cpuGate:!!item.cpuGate});const duelId=uuidFor(item.arena,nonce);await rpc('arm-uuid',group.room,{ids:[duelId]});let gate;
  // Each real viewer starts only after its own decode wait. Observe its own
  // phases instead of applying a global wall-clock delay to cold clients.
  const observations=pages.map((page,viewer)=>(async()=>{
    await page.waitForSelector('.card-duel-stage',{timeout:20000});const initial=await stage(page);
    await page.waitForFunction(()=>document.querySelector('.card-duel-stage')?.dataset.phase==='exchange',null,{timeout:8000});const exchange=await stage(page);
    const cpuDuring=item.cpuGate&&viewer===0?await rpc('status',group.room):null;
    await page.waitForFunction(()=>document.querySelector('.card-duel-stage')?.dataset.phase==='result',null,{timeout:12000});const result=await stage(page),atResult=await page.evaluate(()=>window.__duelQA);
    if(profile.id==='desktop-chrome'&&item.name==='challenger-win'&&viewer===2){const file=path.join(out,'desktop-duel-result.png');await page.screenshot({path:file});report.screenshots.push(file);}
    await page.waitForSelector('.card-duel-stage',{state:'detached',timeout:14000});
    await until('ACK after complete stage '+viewer,async()=>page.evaluate(id=>window.__duelQA.actions.some(a=>a.type==='PRESENTATION_READY'&&a.gate===id),gate?.id),10000);
    return{initial,exchange,result,atResult,cpuDuring,trace:await page.evaluate(()=>window.__duelQA)};
  })());
  const all=Promise.all(observations);all.catch(()=>{});await action(pages[0],'PICK_TARGET',{target:1});gate=await until('new server presentation gate',async()=>{const status=await rpc('status',group.room);return status.gate?.waiting?status.gate:null;},5000);const captures=await all;
  for(const [viewer,capture]of captures.entries()){
    const s=capture.initial;
    check(profile.id+' '+item.name+' entry backs/private numbers viewer '+viewer,hiddenCorrect(s,viewer,pair),s);
    check(profile.id+' '+item.name+' four effects use decoded inline CSS textures viewer '+viewer,s.effects.length===4&&s.effects.every(image=>image.dataUri&&image.complete&&image.naturalWidth>1&&image.objectFit==='contain'),s.effects);
    check(profile.id+' '+item.name+' arena/public avatar/name/contained textures viewer '+viewer,s.arena===item.arena&&s.background.includes('arena-'+item.arena+'-v1.webp')&&s.slots.every((slot,i)=>slot.name===['QA 挑戰者','QA 防守者'][i]&&slot.complete&&slot.naturalWidth>0&&slot.objectFit==='contain'&&slot.avatar?.complete&&slot.avatar.naturalWidth>0&&inside(slot.identityRect,s.rect)),s);
  }
  for(const [viewer,capture]of captures.entries())check(profile.id+' '+item.name+' exchange preserves backs/numbers viewer '+viewer,hiddenCorrect(capture.exchange,viewer,pair),capture.exchange);
  if(item.cpuGate){const s=captures[0].cpuDuring;check('CPU cannot advance while any duel stage is active',s.gate?.waiting&&s.turn===3&&s.step==='draw',s);}
  for(const [viewer,capture]of captures.entries()){
    const s=capture.result;
    check(profile.id+' '+item.name+' result geometry viewer '+viewer,geometry(s),s);
    if(loser===null)check(profile.id+' draw has no face/KO disclosure viewer '+viewer,hiddenCorrect(s,viewer,pair)&&s.slots.every(slot=>slot.ko<.01),s);
    else check(profile.id+' '+item.name+' only loser becomes public viewer '+viewer,s.slots[loser].revealed==='public-loser'&&s.slots[loser].badge?.visibility==='public'&&s.slots[loser].badge.text===String(pair[loser])&&s.slots[loser].ko>.99&&/cards\/back\.webp$/.test(s.slots[winner].src)&&!s.slots[winner].revealed&&(viewer===2?s.slots[winner].badge===null:s.slots[winner].badge?.visibility==='private'),s);
    const trace=capture.atResult;
    check(profile.id+' '+item.name+' private wire packet reaches duel participants only viewer '+viewer,trace.wire.filter(e=>e.type==='duel_private').length===(viewer===2?0:1)&&trace.wire.filter(e=>e.type==='duel_private').every(e=>e.to===viewer&&e.duelId===duelId),trace.wire.filter(e=>['duel','duel_private','duel_log'].includes(e.type)));
    check(profile.id+' '+item.name+' no presentation ACK before stage result viewer '+viewer,!trace.actions.some(a=>a.type==='PRESENTATION_READY'&&a.gate===gate.id),trace.actions);
    const first=trace.history.find(h=>h.slots.length),reveal=trace.history.find(h=>h.slots.some(slot=>slot.revealed));
    check(profile.id+' '+item.name+' no losing face before its own reveal deadline viewer '+viewer,loser===null?!reveal:!!first&&!!reveal&&reveal.time-first.time>=4750,{entry:first?.time,reveal:reveal?.time,elapsed:reveal&&first?reveal.time-first.time:null});
  }
  for(const [viewer,capture]of captures.entries()){
    const trace=capture.trace;
    const first=trace.history.find(h=>h.slots.length),gone=trace.history.find(h=>first&&h.time>first.time&&!h.slots.length);
    const actions=trace.actions;
    check(profile.id+' '+item.name+' ACK follows complete stage viewer '+viewer,!!gone&&actions.filter(a=>a.type==='PRESENTATION_READY'&&a.gate===gate.id).every(a=>a.time>=gone.time),{gone,actions});
  }
  if(item.cpuGate){const changed=await until('CPU resumes after stage barrier',async()=>{const status=await rpc('status',group.room);return status.step!=='draw'||status.turn!==3?status:null;},15000);check('CPU resumes only after all viewers release presentation gate',!!changed,changed);await rpc('stop-cpu',group.room);}
  report.cases.push({profile:profile.id,item,duelId,captures});save();console.log('PASS '+profile.id+' '+item.name);
}
async function multiTarget(group){
  await clearTrace(group.pages);const ids=[uuidFor('onigashima',700),uuidFor('dressrosa',701)];
  const observers=group.pages.map((page,viewer)=>(async()=>{const samples=[];for(const [target,pair]of [[1,[8,2]],[2,[8,4]]]){
    await page.waitForSelector('.card-duel-stage .cduel-slot[data-player="'+target+'"]',{timeout:25000});const entry=await stage(page);
    await page.waitForFunction(target=>{const n=document.querySelector('.card-duel-stage');return n?.dataset.phase==='result'&&!!n.querySelector('.cduel-slot[data-player="'+target+'"]');},target,{timeout:15000});const result=await stage(page);
    if(group.profile.bundle==='android'&&target===2&&viewer===0){const file=path.join(out,'android-retained-320-result.png');await page.screenshot({path:file});report.screenshots.push(file);}samples.push({target,pair,entry,result});
  }await page.waitForSelector('.card-duel-stage',{state:'detached',timeout:14000});await idle(page);return samples;})());
  const all=Promise.all(observers);all.catch(()=>{});await rpc('multi',group.room,{ids});const captures=await all;
  for(const [viewer,samples]of captures.entries())for(const {target,pair,entry,result}of samples){check('Luffy target '+target+' event IDs preserve private ownership viewer '+viewer,hiddenCorrect(entry,viewer,pair,[0,target]),entry);check('Luffy target '+target+' reveals its own actual losing card viewer '+viewer,result.slots.find(x=>x.id===target)?.badge?.text===String(pair[1])&&result.slots.find(x=>x.id===target)?.revealed==='public-loser'&&/cards\/back\.webp$/.test(result.slots[0].src),result);check(group.profile.id+' Luffy target '+target+' actual '+result.width+'x'+result.height+' result geometry viewer '+viewer,geometry(result),result);}
  report.cases.push({profile:group.profile.id,name:'two genuine Luffy engine actions grouped into one controlled transport boundary',ids,captures});save();
}
async function cancellation(group){
  const {pages,profile}=group;
  await startDuel(group,[8,5],'marineford',800);await wait(1400);
  await pages[0].evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
  await pages[0].waitForSelector('.card-duel-stage',{state:'detached',timeout:3000});await wait(5300);
  check('visibility handler cancels late reveal/KO and commits without replay',!await stage(pages[0])&&await pages[0].evaluate(()=>!CardPhonePresentation.presentationEffectsBusy?.()&&!CardPhonePresentation.presentationQueueSize?.()));
  await pages[0].evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});for(const p of pages.slice(1))await p.waitForSelector('.card-duel-stage',{state:'detached',timeout:8000});for(const p of pages)await idle(p);
  await startDuel(group,[8,5],'onigashima',801);await wait(1400);
  const before=await pages[1].evaluate(()=>({id:me.playerId,room:me.roomId,secret:me.secret}));await pages[1].reload({waitUntil:'domcontentloaded'});await pages[1].waitForFunction(()=>me.playerId!==null&&state?.players?.length===4);await idle(pages[1]);
  const resumed=await pages[1].evaluate(before=>({sameSeat:me.playerId===before.id,sameRoom:me.roomId===before.room,sameSecret:me.secret===before.secret,stage:!!document.querySelector('.card-duel-stage')}),before);
  check('original guest reload restores the same identity without replaying old duel',resumed.sameSeat&&resumed.sameRoom&&resumed.sameSecret&&!resumed.stage,resumed);await installTrace(pages[1]);
  for(const p of [pages[0],pages[2]])await p.waitForSelector('.card-duel-stage',{state:'detached',timeout:14000});for(const p of pages)await idle(p);
  await startDuel(group,[8,5],'dressrosa',802);await wait(1300);const next=await rpc('next-round',group.room,{pair:[5,15]});
  await Promise.all(pages.map(p=>p.waitForSelector('.card-duel-stage',{state:'detached',timeout:3500})));await wait(5300);
  check('new-round state cancels old duel and its late callbacks',!(await Promise.all(pages.map(stage))).some(Boolean)&&await pages[0].evaluate(round=>state.roundNo===round,next.round),next);
  report.cases.push({profile:profile.id,name:'cancellation',syntheticVisibilityEvent:true,reload:resumed,newRound:next.round});save();
}
async function legacyCompatibility(group){
  const old=group.legacyPage;if(!old)throw Error('Legacy compatibility requires CARD_DUEL_QA_PHASE=legacy so the old guest remains open from first navigation');const oldSeat=await old.evaluate(()=>me.playerId),target=oldSeat===0?1:oldSeat,newPages=group.pages.filter(page=>page!==old);
  check('legacy participant really uses base HTML/desktop without the three new modules',await old.evaluate(()=>!CardPhonePresentation.duelPrivateVersion&&!CardPhonePresentation.duelStageVersion&&!CardPhonePresentation.duelRuntimeVersion&&![...document.scripts].some(s=>/card-duel-(?:private|stage|runtime)\.js/.test(s.src))));
  await selectSeed(group,[8,5],{target});const duelId=uuidFor('marineford',900);await rpc('arm-uuid',group.room,{ids:[duelId]});await action(group.pages[0],'PICK_TARGET',{target});
  await newPages[0].waitForSelector('.card-duel-stage',{timeout:20000});await old.waitForFunction(id=>window.__duelQA.wire.some(e=>e.type==='duel'&&e.duelId===id),duelId);await stableIdle(old,65000);
  const wire=await old.evaluate(()=>window.__duelQA.wire);check('legacy participant accepts new targeted private packet and completes its original presentation',wire.some(e=>e.type==='duel_private'&&e.to===oldSeat&&e.duelId===duelId)&&await old.evaluate(()=>!CardPhonePresentation.presentationQueueSize?.()&&!CardPhonePresentation.presentationEffectsBusy?.()),wire.filter(e=>['duel_private','duel','duel_log'].includes(e.type)));
  for(const p of newPages)await stableIdle(p,30000);const status=await until('legacy and new clients release actual presentation gate',async()=>{const status=await rpc('status',group.room);return status.gate&&!status.gate.waiting?status:null;},10000);check('legacy/new mixed clients acknowledge actual server presentation gate',!status.gate.waiting,status.gate);report.cases.push({profile:group.profile.id,name:'one old-open base participant with new engine and two new viewers',oldSeat,duelId});save();
}
async function choosePort(){for(let attempt=0;attempt<12;attempt++){const port=40000+Math.floor(Math.random()*20000),probe=net.createServer();try{probe.listen(port,'127.0.0.1');await once(probe,'listening');await new Promise(resolve=>probe.close(resolve));return port;}catch(error){probe.close();if(error.code!=='EADDRINUSE')throw error;}}throw Error('No available safe QA port');}
(async()=>{
  try{
    await loadLiveManifest();
    const port=await choosePort(),origin='http://127.0.0.1:'+port;
    child=spawn(process.execPath,[__filename,'--fixture-server'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:'',PORT:String(port),CARD_DUEL_QA_ASSETS:path.join(mobileRoot,'public')},stdio:['ignore','pipe','pipe','ipc']});
    const capture=bytes=>{serverLog=(serverLog+String(bytes)).slice(-5000);};child.stdout.on('data',capture);child.stderr.on('data',capture);
    await until('candidate production server listening',()=>{if(child.exitCode!==null)throw Error(serverLog);return serverLog.includes('Server listening on');},15000);check('candidate production entry starts with database disabled',true);
    const profiles=[{id:'desktop-chrome',engine:'chromium',width:1366,height:768},{id:'desktop-webkit',engine:'webkit',width:1366,height:768},...['android','ios'].flatMap(bundle=>[[932,430],[667,375],[390,844],[320,740]].map(([width,height])=>({id:bundle+'-'+width,engine:bundle==='android'?'chromium':'webkit',bundle,width,height})))];
    const phase=process.env.CARD_DUEL_QA_PHASE||'all';
    const selected=process.env.CARD_DUEL_QA_PROFILE?profiles.filter(p=>process.env.CARD_DUEL_QA_PROFILE.split(',').includes(p.id)):phase==='native-responsive'?profiles.filter(p=>['android-932','ios-932'].includes(p.id)).map(p=>({...p,progressiveResultViewports:[[932,430],[667,375],[390,844],[320,740]]})):phase==='matrix'?profiles.slice(1):['legacy','core','representative'].includes(phase)?profiles.slice(0,1):profiles;if(!selected.length)throw Error('Unknown CARD_DUEL_QA_PROFILE');
    let nonce=1;
    for(const profile of selected){const group=await createGroup(profile,origin);if(phase==='legacy'){await legacyCompatibility(group);await closeGroup(group);continue;}await verifyDuel(group,{name:'challenger-win',pair:[8,5],arena:arenas[(nonce-1)%3],cpuGate:profile.id==='desktop-chrome'},nonce++);
      if(profile.id==='desktop-chrome'&&phase!=='representative'||phase==='native-responsive'){if(phase==='native-responsive')await resizeGroup(group,667,375);await verifyDuel(group,{name:'challenger-loss',pair:[2,9],arena:'onigashima'},nonce++);if(phase==='native-responsive')await resizeGroup(group,390,844);await verifyDuel(group,{name:'draw',pair:[5,15],arena:'dressrosa'},nonce++);if(phase==='native-responsive')await resizeGroup(group,320,740);await multiTarget(group);if(phase!=='native-responsive')await cancellation(group);}
      await closeGroup(group);
    }
    check('no uncategorized browser errors',report.errors.length===0,report.errors);check('no runtime image/art/font URL is masked by an unpublished fallback',report.unexpectedAssets.length===0,report.unexpectedAssets);check('all stage card/avatar/background assets resolve',report.missingAssets.filter(x=>/card-duel|cards\/(?:back|[0-9])|avatars/.test(x.url)).length===0,report.missingAssets);
    check('candidate sources remain unchanged throughout final suite',report.sources.every(item=>digest(path.join(root,item.file)).sha256===item.sha256),report.sources);report.passed=true;
  }catch(error){report.failure=error.stack;report.serverLog=serverLog;report.debug=await Promise.all(activePages.map(page=>page.evaluate(()=>{const m=typeof me==='object'?me:{},s=typeof state==='object'?state:{},sock=typeof socket==='object'?socket:null;return{url:location.href,title:document.title,connection:sock?{connected:sock.connected,uri:sock.io?.uri,options:{hostname:sock.io?.opts?.hostname,port:sock.io?.opts?.port,path:sock.io?.opts?.path}}:null,conn:document.getElementById('conn')?.textContent,seat:m?.playerId,state:{round:s?.roundNo,turn:s?.turnIndex,step:s?.turnStep,pending:s?.pending?.action},root:{...document.documentElement.dataset},queue:window.CardPhonePresentation?.presentationQueueSize?.(),busy:window.CardPhonePresentation?.presentationEffectsBusy?.(),stage:document.querySelector('.card-duel-stage')?.outerHTML.slice(0,500),venue:document.getElementById('phoneVenueIntro')?.hidden,raw:window.__duelQA?.raw};}).catch(()=>null)));process.exitCode=1;
  }finally{await activeBrowser?.close().catch(()=>{});if(child&&child.exitCode===null)spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,errors:report.errors,failure:report.failure,report:path.join(out,'report.json')}));}
})();
