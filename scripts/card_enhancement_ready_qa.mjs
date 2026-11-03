import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';

// Native media methods are retained in the real-MP4 suites. Fault injection is
// reported separately and never stands in for physical-phone acceptance.
const require=createRequire(import.meta.url);
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const mobileRoot='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const engine=require(root+'/server/engine.js'),intent=require(root+'/server/card_skill_intent'),barrier=require(root+'/server/card_presentation_ready');
const cases=require(root+'/scripts/card_all_effect_cases.js').buildCases();
const movie=path.join(mobileRoot,'public/videos/enh/1.mp4'),movieBytes=fs.statSync(movie).size;
const out=process.env.ENH_READY_QA_OUT||'D:/Codex_QA/card-enhancement-ready-20261103';
const modes=(process.env.ENH_READY_QA_MODES||'android,ios,faults').split(',');
const report={passed:false,scope:'Real local MP4 and HTTP Range 206 delayed responses using unmocked browser media methods, current online Card HTML and exact retained v063 bundles. Separate readiness/queue fault injection. Browser-engine evidence only, not physical-device, real-account or real-server multiplayer acceptance.',checks:[],errors:[],requests:[],traces:{},screenshots:[],bundles:{}};
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass||report.checks.length%5===0)save();if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const sourceFiles=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','server/engine.js'];
report.source=sourceFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
report.movie={path:movie,bytes:movieBytes,sha256:sha(fs.readFileSync(movie)),durationSecondsFromMvhd:5.106,moovOffset:5211600};
const bundles={
  android:{root:mobileRoot+'/android/app/src/main/assets/mobile',hash:{js:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',css:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'}},
  ios:{root:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',hash:{js:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',css:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'}}
};
for(const mode of new Set(modes.map(x=>x==='faults'?'android':x))){const b=bundles[mode];if(!b)throw Error('Unknown mode '+mode);b.js=fs.readFileSync(path.join(b.root,'game-mobile.js'));b.css=fs.readFileSync(path.join(b.root,'game-mobile.css'));report.bundles[mode]={root:b.root,js:sha(b.js),css:sha(b.css)};check(mode+' exact v063 JS identity',sha(b.js)===b.hash.js);check(mode+' exact v063 CSS identity',sha(b.css)===b.hash.css);}
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const stub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of window.__any)cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'enh-ready-qa',onAny(cb){window.__any.push(cb);return this},on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const sockets=new Set();
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),b=u.pathname.match(/^\/__qa_bundle\/(android|ios)\.(js|css)$/);
  if(b){res.writeHead(200,{'content-type':mime['.'+b[2]]}).end(bundles[b[1]][b[2]]);return;}
  if(u.pathname.startsWith('/__qa_video/')){
    const kind=u.searchParams.get('kind')||'fast',id=u.searchParams.get('id')||'',entry={at:Date.now(),kind,id,range:req.headers.range||null};report.requests.push(entry);
    req.on('aborted',()=>entry.abortedAt=Date.now());res.on('close',()=>entry.closedAt=Date.now());
    if(kind==='never')return;
    // The replacement source's first response is held past the old response;
    // later ranges remain fast so this cancellation case stays below 15s.
    const firstForTag=report.requests.filter(x=>x.id===id&&x.kind===kind).length===1;
    const delay=kind==='slow'?4200:kind==='cancel-old'?4500:kind==='next'&&firstForTag?6500:0;
    const timer=setTimeout(()=>{
      if(res.destroyed){entry.discardedAt=Date.now();return;}
      entry.responseAt=Date.now();
      if(kind==='error'){res.writeHead(404).end();entry.status=404;return;}
      let start=0,end=movieBytes-1,status=200;
      if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!m){res.writeHead(416,{'content-range':'bytes */'+movieBytes}).end();return;}if(!m[1]){start=Math.max(0,movieBytes-Number(m[2]));}else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}if(start>end||start>=movieBytes){res.writeHead(416,{'content-range':'bytes */'+movieBytes}).end();return;}status=206;}
      entry.status=status;entry.start=start;entry.end=end;
      res.writeHead(status,{'content-type':'video/mp4','content-length':end-start+1,'accept-ranges':'bytes','cache-control':'no-store',...(status===206?{'content-range':`bytes ${start}-${end}/${movieBytes}`}:{})});
      const stream=fs.createReadStream(movie,{start,end});stream.on('data',c=>entry.streamedBytes=(entry.streamedBytes||0)+c.length);res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
    },delay);timer.unref();return;
  }
  if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(stub);return;}
  if(/\.(mp3|mp4|ogg|wav|webm|m4a)$/i.test(u.pathname)){res.writeHead(204).end();return;}
  const file=path.resolve(root,'public','.'+decodeURIComponent(u.pathname));if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
  try{let bytes=fs.readFileSync(fs.existsSync(file)?file:path.join(mobileRoot,'public',path.relative(path.join(root,'public'),file)));
    if(u.pathname==='/game.html'&&u.searchParams.get('qaBundle')==='android')bytes=Buffer.from(bytes.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__qa_bundle/android.css"><script src="/__qa_bundle/android.js"></script>'));
    res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(bytes);
  }catch{res.writeHead(404).end();}
});
server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
const uas={android:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)'};
function fixture(){const s=engine.createInitialState(4);Object.assign(s,{phase:'playing',turnIndex:0,turnStep:'choose',venues:[],discard:[2,3]});s.players.forEach((p,i)=>Object.assign(p,{hand:i===0?4:i+2,tempDraw:i===0?6:null,alive:true,gold:10,client:{name:'影片QA'+i,avatar:i+1}}));return s;}
async function model(p,s){await p.evaluate(s=>{state=s;me.playerId=0;me.roomId='ENH-READY-QA';me.secret='fixture';render();},engine.getVisibleState(s,0));await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));if(await p.locator('#phoneVenueIntro:not([hidden])').count())await p.locator('#phoneVenueContinue').click();}
async function idle(p){await p.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy(),{},{timeout:30000});}
async function setup(p){
  await p.waitForFunction(()=>typeof window.__prepareCardEnhVideo==='function'&&CardPhonePresentation?.enhancementSummonVersion>=5&&CardPhonePresentation?.enhancementVideoOrderVersion===2);
  check('online enhancement owner version 2 and summon v5 are mounted over retained bundle',await p.evaluate(()=>CardPhonePresentation.enhancementVideoOrderVersion===2&&CardPhonePresentation.enhancementSummonVersion>=5));
  await model(p,fixture());await idle(p);
  await p.evaluate(()=>{
    window.__enhTrace=[];window.__enhJobDone=false;window.__enhJobError=null;
    const video=document.getElementById('enhVideo');
    const snapshot=()=>{let buffer=0;try{for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=.05)buffer=video.buffered.end(i);}catch{}return {at:Date.now(),readyState:video.readyState,width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,buffer,src:video.getAttribute('src'),time:video.currentTime};};
    window.__enhSnapshot=snapshot;
    for(const type of ['loadstart','loadedmetadata','loadeddata','canplay','canplaythrough','playing','waiting','stalled','ended','error'])video.addEventListener(type,()=>window.__enhTrace.push({type,...snapshot()}));
    for(const name of ['load','play','pause']){const original=HTMLMediaElement.prototype[name];HTMLMediaElement.prototype[name]=function(...args){if(this===video)window.__enhTrace.push({type:'native-'+name,...snapshot()});return Reflect.apply(original,this,args);};}
    let signature='';new MutationObserver(()=>{const layer=document.querySelector('.card-enhancement-summon'),next=layer?layer.dataset.card+':'+layer.dataset.phase:'none';if(next!==signature){signature=next;window.__enhTrace.push({type:'phase',phase:layer?.dataset.phase||'none',card:layer?.dataset.card||null,...snapshot()});}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase']});
    let skillBusy=null;setInterval(()=>{const busy=!!CardPhonePresentation.isCardSkillIntroBusy?.();if(busy!==skillBusy){skillBusy=busy;window.__enhTrace.push({type:'skill-busy',busy,...snapshot()});}},40);
    const prior=document.getElementById('phonePlayedStage');if(prior)prior.id='qa-original-played-stage';const stage=document.createElement('div');stage.id='phonePlayedStage';stage.innerHTML='<div class="phone-stage-card" style="position:fixed;left:45%;top:42%;width:90px;height:135px;pointer-events:none"></div>';document.body.append(stage);
    const start=document.createElement('button');start.id='qaEnhStart';start.textContent='開始強化演出';Object.assign(start.style,{position:'fixed',left:'4px',top:'4px',zIndex:'100000'});document.body.append(start);
  });
}
async function source(p,id,kind,tag){const url='/__qa_video/'+id+'.mp4?kind='+kind+'&id='+encodeURIComponent(tag);await p.evaluate(({id,url})=>ENH_VID[id]=url,{id,url});return url;}
async function startPublic(p,id){await p.evaluate(id=>{window.__enhJobDone=false;window.__enhJobError=null;document.getElementById('qaEnhStart').onclick=()=>{window.__enhTrace.push({type:'trusted-start',at:Date.now()});Promise.resolve(CardPhonePresentation.presentCardSkillBatch([{to:'all',type:'enh_fx',cardId:id}])).then(()=>window.__enhJobDone=true,e=>{window.__enhJobError=String(e);window.__enhJobDone=true;});};},id);await p.locator('#qaEnhStart').tap();}
async function trace(p,key){const t=await p.evaluate(()=>window.__enhTrace);report.traces[key]=t;save();return t;}
async function cancel(p){await p.evaluate(()=>{CardPhonePresentation.cancelEnhancements?.();window.__cancelPreparedEnhVideo();document.getElementById('enhVideo').__enhOnEnded?.();});}
async function actions(p){return p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION').map(x=>x[1]));}
async function legacyReplay(p,id,label){
  const before=await p.evaluate(()=>window.__enhTrace.length);await p.evaluate(id=>playEnhFxFor(id),id);await p.waitForTimeout(120);
  const replay=await p.evaluate(from=>window.__enhTrace.slice(from).filter(x=>x.type==='native-play'||x.type==='native-load'||x.type==='phase'&&x.phase==='white'),before);
  check(label+' legacy enh_fx replay is consumed without a second load, movie or white',replay.length===0,replay);
}
async function choiceAfter(p,label){await p.evaluate(()=>{hideModal();state.pending={action:'usopp',extra:{target:1}};state.turnIndex=me.playerId;renderPending();window.__sent=[];});await p.locator('#modal button[data-d="4"]').tap();const sent=await actions(p);check(label+' original choice still sends one PICK_DIGIT',sent.length===1&&sent[0].type==='PICK_DIGIT'&&sent[0].payload.digit===4,sent);await p.evaluate(()=>{state.pending=null;hideModal();});}
async function realSlow(p,mode){
  const tag=mode+'-slow';await source(p,1,'slow',tag);await startPublic(p,1);
  await p.waitForTimeout(2500);const waiting=await p.evaluate(()=>({trace:window.__enhTrace,phase:document.querySelector('.card-enhancement-summon')?.dataset.phase,snapshot:window.__enhSnapshot()}));
  check(mode+' delayed media has not turned white after the 1900ms rise',!waiting.trace.some(x=>x.type==='phase'&&x.phase==='white'),waiting);
  await p.waitForFunction(()=>window.__enhTrace.some(x=>x.type==='playing'),{},{timeout:20000});
  await p.waitForFunction(()=>document.getElementById('enhVideo').currentTime>.15,{},{timeout:6000});
  check(mode+' real MP4 advances with native media methods',await p.locator('#enhVideo').evaluate(v=>v.currentTime>.15&&v.videoWidth>0&&v.videoHeight>0));
  if(report.screenshots.length<2){const file=path.join(out,mode+'-real-movie.png');await p.screenshot({path:file});report.screenshots.push(file);}
  await p.waitForFunction(()=>window.__enhJobDone,{},{timeout:25000});const t=await trace(p,tag),white=t.filter(x=>x.type==='phase'&&x.phase==='white'),playing=t.find(x=>x.type==='playing'),loaded=t.find(x=>['loadeddata','canplay'].includes(x.type)),requests=report.requests.filter(x=>x.id===tag);
  check(mode+' request starts before white, including a real delay beyond the rise',requests.length>0&&white.length===1&&white[0].at-requests[0].at>=3900&&requests[0].at<white[0].at,{requests,white});
  check(mode+' white begins only with a decoded frame and buffer',white.every(x=>x.readyState>=3&&x.width>0&&x.height>0&&(x.readyState>=4||x.buffer>=Math.min(2,x.duration||2))),white);
  check(mode+' loaded data precedes the single white transition and real playback',!!loaded&&!!playing&&loaded.at<=white[0].at&&white[0].at<=playing.at,{loaded,white,playing});
  const beforePlay=t.filter(x=>x.type==='native-load'&&x.src&&x.at<=playing.at);check(mode+' warm element is consumed without a second load or source reset',beforePlay.length===1,beforePlay);
  check(mode+' native MP4 ends and presentation completely settles',t.some(x=>x.type==='ended')&&await p.evaluate(()=>!window.__enhJobError&&document.getElementById('enhOverlay').classList.contains('hidden')&&!document.querySelector('.card-enhancement-summon')));
  check(mode+' all media responses are genuine Range 206 when requested',requests.filter(x=>x.range&&x.responseAt).every(x=>x.status===206),requests);
  await legacyReplay(p,1,mode+' after real movie');
  await choiceAfter(p,mode+' after real movie');
}
async function wholeJobCancel(p){
  await p.evaluate(()=>window.__enhTrace=[]);await source(p,1,'fast','whole-job-cancel');await startPublic(p,1);
  await p.evaluate(()=>{window.__wholeJobReady='pending';window.__prepareCardEnhVideo(1).then(v=>window.__wholeJobReady=v);});
  await p.waitForFunction(()=>window.__wholeJobReady===true&&document.querySelector('.card-enhancement-summon')?.dataset.phase==='rise',{},{timeout:6000});
  check('whole public job has a ready real movie while its character is still rising',true);
  const canceledAt=await p.evaluate(()=>{const at=Date.now();CardPhonePresentation.cancelEnhancements();return at;});
  await p.waitForTimeout(2500);const t=await trace(p,'whole-job-cancel'),late=t.filter(x=>x.at>=canceledAt&&(x.type==='native-play'||x.type==='phase'&&x.phase==='white'||x.type==='skill-busy'&&x.busy));
  check('cancelEnhancements invalidates the whole pending public job without a late movie, white or cut-in',late.length===0,{canceledAt,late});
  check('whole public cancellation settles the job and releases its lock',await p.evaluate(()=>window.__enhJobDone&&!document.querySelector('.card-enhancement-summon')&&document.getElementById('enhOverlay').classList.contains('hidden')&&!CardPhonePresentation.presentationEffectsBusy()));
  await legacyReplay(p,1,'after whole public cancellation');
  await choiceAfter(p,'after whole public cancellation');
}
async function faults(p){
  // These are local HTTP failures and synthetic late events, kept separate from
  // the native real-MP4 timeline above.
  if(process.env.ENH_READY_QA_FAULT_CASE==='queue'){await queueFailure(p);return;}
  await wholeJobCancel(p);if(process.env.ENH_READY_QA_FAULT_CASE==='cancel-job')return;
  await p.evaluate(()=>window.__enhTrace=[]);
  await source(p,1,'error','error');await startPublic(p,1);await p.waitForFunction(()=>window.__enhJobDone,{},{timeout:10000});let t=await trace(p,'error');check('HTTP failure skips white and finishes the public job',!t.some(x=>x.type==='phase'&&x.phase==='white')&&!await p.locator('.card-enhancement-summon').count());await legacyReplay(p,1,'after HTTP failure');await choiceAfter(p,'after HTTP failure');
  await p.evaluate(()=>window.__enhTrace=[]);await source(p,1,'never','never');const start=Date.now();await startPublic(p,1);await p.waitForTimeout(2500);check('never-responding media remains out of white after rise',!await p.evaluate(()=>window.__enhTrace.some(x=>x.type==='phase'&&x.phase==='white')));await p.waitForFunction(()=>window.__enhJobDone,{},{timeout:18000});t=await trace(p,'never');check('readiness timeout is bounded and does not expose white',Date.now()-start<18000&&!t.some(x=>x.type==='phase'&&x.phase==='white'),{elapsed:Date.now()-start});await legacyReplay(p,1,'after never-responding media');await choiceAfter(p,'after never-responding media');
  await p.evaluate(()=>window.__enhTrace=[]);await source(p,1,'cancel-old','cancel-old');await p.evaluate(()=>{window.__oldPrepared='pending';window.__prepareCardEnhVideo(1).then(x=>window.__oldPrepared=x);});await p.waitForTimeout(300);await p.evaluate(()=>window.__cancelPreparedEnhVideo());check('cancel resolves the pending preparation false',await p.evaluate(()=>window.__oldPrepared===false));
  await source(p,2,'next','next');await p.evaluate(()=>{window.__newPrepared='pending';window.__prepareCardEnhVideo(2).then(x=>window.__newPrepared=x);const v=document.getElementById('enhVideo');v.dispatchEvent(new Event('loadeddata'));v.dispatchEvent(new Event('canplay'));});await p.waitForTimeout(4900);check('late old response/events do not mark the newer source ready',await p.evaluate(()=>window.__newPrepared==='pending'&&document.getElementById('enhVideo').getAttribute('src')===ENH_VID[2]));await p.waitForFunction(()=>window.__newPrepared===true,{},{timeout:12000});check('new source independently reaches real readiness',true);await cancel(p);
  await source(p,1,'fast','prime');await p.evaluate(()=>{window.__primeReady='pending';window.__prepareCardEnhVideo(1).then(x=>window.__primeReady=x);});await p.waitForFunction(()=>window.__primeReady===true,{},{timeout:12000});
  await p.evaluate(()=>{window.__pauseBeforePrime=window.__enhTrace.filter(x=>x.type==='native-pause').length;_iosPrimed=false;document.getElementById('qaEnhStart').onclick=()=>primeIOSMediaOnce();});await p.locator('#qaEnhStart').tap();await p.waitForTimeout(200);check('first trusted touch priming does not pause or reset a prepared movie',await p.evaluate(()=>window.__enhTrace.filter(x=>x.type==='native-pause').length===window.__pauseBeforePrime&&document.getElementById('enhVideo').getAttribute('src')===ENH_VID[1]));
  await p.evaluate(()=>{document.getElementById('qaEnhStart').onclick=()=>{const v=document.getElementById('enhVideo');v.muted=true;window.__nativeTouchPlay=v.play().then(()=>true,e=>String(e));};});await p.locator('#qaEnhStart').tap();await p.waitForFunction(()=>document.getElementById('enhVideo').currentTime>.15,{},{timeout:6000});check('a new trusted touch starts the prepared muted real MP4',await p.evaluate(()=>window.__nativeTouchPlay instanceof Promise&&document.getElementById('enhVideo').muted&&document.getElementById('enhVideo').currentTime>.15));await cancel(p);
  await queueFailure(p);
}
async function queueFailure(p){
  // Remove our touch-start button and restore the real played-stage element
  // before driving the original selection UI and presentation queue.
  await cancel(p);await p.evaluate(()=>{document.getElementById('qaEnhStart')?.remove();const original=document.getElementById('qa-original-played-stage');if(original){document.getElementById('phonePlayedStage')?.remove();original.id='phonePlayedStage';}});
  // Exercise the existing presentation queue/ACK with real engine-produced events.
  const sample=cases.find(c=>c.label==='card-1-enhanced/PLAY_CARD'),before=structuredClone(sample.before);before.phase='playing';before.players.forEach((p,i)=>p.isCPU=i!==0);await model(p,before);
  const room={state:before},result=intent.decorate(room,before,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},engine.applyAction(before,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}));room.state=result.state;
  const after=engine.getVisibleState(room.state,0);after.presentationReady=barrier.begin(room);
  await source(p,1,'error','queue-error');await p.evaluate(({events,s})=>{window.__sent=[];for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:result.emits.filter(e=>e.to==='all'||e.to===0),s:after});await idle(p);await p.waitForFunction(()=>window.__sent.some(x=>x[0]==='ACTION'&&x[1].type==='PRESENTATION_READY'),{},{timeout:5000});check('readiness failure releases original queue and same-room ACK',await p.evaluate(()=>me.roomId==='ENH-READY-QA'&&state.players.length===6&&state.pending?.action==='usopp'));
  const ack=(await actions(p)).find(x=>x.type==='PRESENTATION_READY');check('original server barrier accepts the actual sole-human ACK',barrier.acknowledge(room,0,ack.payload));
  const released=barrier.view(room);check('original server barrier releases the same presentation identity',released.waiting===false&&released.id===after.presentationReady.id&&released.ready.length===1,released);
  await p.evaluate(s=>window.__deliver('STATE',s),{...after,presentationReady:released});await idle(p);await p.evaluate(()=>window.__sent=[]);
  await p.locator('main #players>[data-seat-id="1"]').tap();const selected=await actions(p);check('released original target UI sends PICK_TARGET once',selected.length===1&&selected[0].type==='PICK_TARGET'&&selected[0].payload.target===1,selected);
  const targetResult=engine.applyAction(room.state,{type:'PICK_TARGET',playerId:0,payload:selected[0].payload});room.state=targetResult.state;const targeted=engine.getVisibleState(room.state,0);targeted.presentationReady=barrier.view(room);
  await p.evaluate(({events,s})=>{for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:targetResult.emits.filter(e=>e.to==='all'||e.to===0),s:targeted});await idle(p);await p.evaluate(()=>window.__sent=[]);await p.locator('#modal button[data-d="4"]').tap();const picked=await actions(p);
  check('after failed media and original ACK release, real choice sends PICK_DIGIT once',picked.length===1&&picked[0].type==='PICK_DIGIT'&&picked[0].payload.digit===4,picked);
  const guessed=engine.applyAction(room.state,{type:'PICK_DIGIT',playerId:0,payload:picked[0].payload});check('original engine accepts the follow-up digit for the unchanged target',guessed.emits.some(e=>e.type==='card_guess'&&e.digit===4&&e.targetId===1));
}
let browser,page;
try{
  for(const mode of modes){const bundleMode=mode==='ios'?'ios':'android';browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});const ctx=await browser.newContext({viewport:{width:740,height:360},hasTouch:true,isMobile:true,userAgent:uas[bundleMode],serviceWorkers:'block'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await ctx.addInitScript(()=>window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin);
    if(bundleMode==='ios')await ctx.addInitScript({content:bundles.ios.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/__qa_bundle/ios.css';document.head.append(l);},{once:true});`});
    page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({mode,message:e.message}));await page.goto(origin+'/game.html?qaBundle='+bundleMode,{waitUntil:'load'});await setup(page);if(mode==='faults')await faults(page);else await realSlow(page,mode);check(mode+' no page exceptions',!report.errors.some(x=>x.mode===mode),report.errors);save();await ctx.close();page=null;await browser.close();browser=null;
  }
  check('all product source bytes remain unchanged throughout this run',report.source.every(x=>sha(fs.readFileSync(path.join(root,x.file)))===x.sha256),report.source);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{report.failureTrace=await page.evaluate(()=>({trace:window.__enhTrace,jobDone:window.__enhJobDone,jobError:window.__enhJobError,snapshot:window.__enhSnapshot?.(),phase:document.querySelector('.card-enhancement-summon')?.dataset.phase,queue:CardPhonePresentation?.presentationQueueSize?.(),busy:CardPhonePresentation?.presentationEffectsBusy?.(),venuePending:CardPhonePresentation?.isVenueIntroPending?.(),venueEntering:CardPhonePresentation?.isVenueEntering?.(),reading:['phoneVenueIntro','phoneCardSheet','phonePrivateReveal','phoneLibrary'].filter(id=>{const n=document.getElementById(id);return n&&!n.hidden&&n.getClientRects().length;})}));report.failureScreenshot=path.join(out,'failure.png');await page.screenshot({path:report.failureScreenshot});}catch{}}
finally{await browser?.close();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure,report:path.join(out,'report.json')}));}
