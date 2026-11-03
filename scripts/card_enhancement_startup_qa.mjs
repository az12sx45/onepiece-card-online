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
const out=process.env.STARTUP_QA_OUT||'D:/Codex_QA/card-android-playback-20261103/startup-'+Date.now();
const modes=(process.env.STARTUP_QA_MODES||'android').split(',');
const report={passed:false,scope:'Exact retained bundles and current HTML with real MP4/native media API and original EMIT STATE queue. Fault scenarios either hold the first unmuted play promise or limit real range sample delivery until the first native play invocation. Browser/fault evidence only, not physical Android root-cause proof.',checks:[],errors:[],requests:[],traces:{},screenshots:[],bundles:{}};
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass||report.checks.length%5===0)save();if(!pass)throw Error(name+': '+JSON.stringify(detail));}
const sourceFiles=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','public/css/card-native-online.css','server/engine.js','server/card_skill_intent.js','server/card_presentation_ready.js'];
report.source=sourceFiles.map(file=>({file,sha256:sha(fs.readFileSync(path.join(root,file)))}));
const mediaMarker='window.__cardOriginalEnhVideo = playEnhFxFor;';
const htmlSource=fs.readFileSync(path.join(root,'public/game.html'),'utf8');
const mediaStart=htmlSource.indexOf('const ENH_VID ='),mediaEnd=htmlSource.indexOf(mediaMarker,mediaStart)+mediaMarker.length;
report.mediaFunctionSHA256=sha(htmlSource.slice(mediaStart,mediaEnd));
if(process.env.STARTUP_QA_MEDIA_SHA)check('final page retains verified media function bytes',
  mediaStart>=0&&mediaEnd>mediaStart&&report.mediaFunctionSHA256===process.env.STARTUP_QA_MEDIA_SHA,report.mediaFunctionSHA256);
if(process.env.STARTUP_QA_HTML_SHA)check('expected frozen game HTML identity',
  report.source[0].sha256===process.env.STARTUP_QA_HTML_SHA,report.source[0]);
report.movie={path:movie,bytes:movieBytes,sha256:sha(fs.readFileSync(movie)),durationSecondsFromMvhd:5.106,moovOffset:5211600};
const bundles={
  android:{root:mobileRoot+'/android/app/src/main/assets/mobile',hash:{js:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',css:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'}},
  ios:{root:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',hash:{js:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',css:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'}}
};
for(const mode of new Set(modes.map(x=>x==='faults'?'android':x))){const b=bundles[mode];if(!b)throw Error('Unknown mode '+mode);b.js=fs.readFileSync(path.join(b.root,'game-mobile.js'));b.css=fs.readFileSync(path.join(b.root,'game-mobile.css'));report.bundles[mode]={root:b.root,js:sha(b.js),css:sha(b.css)};check(mode+' exact v063 JS identity',sha(b.js)===b.hash.js);check(mode+' exact v063 CSS identity',sha(b.css)===b.hash.css);}
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
const stub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of window.__any)cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'enh-ready-qa',onAny(cb){window.__any.push(cb);return this},on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const sockets=new Set(),primeReleased=new Map();
const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),b=u.pathname.match(/^\/__qa_bundle\/(android|ios)\.(js|css)$/);
  if(b){res.writeHead(200,{'content-type':mime['.'+b[2]]}).end(bundles[b[1]][b[2]]);return;}
  if(u.pathname==='/__qa_prime_start'){
    const id=u.searchParams.get('id');
    if(!primeReleased.has(id))primeReleased.set(id,Date.now());
    return res.writeHead(204).end();
  }
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
      if(kind==='prime-limited'){
        // Keep real MP4 ranges intact while simulating a host that does not
        // deliver enough initial sample data until its first native play.
        res.flushHeaders();
        const fd=fs.openSync(movie,'r'),chunk=Buffer.alloc(32768);
        let pos=start,timer;
        res.on('close',()=>{clearTimeout(timer);fs.closeSync(fd);});
        const deliver=()=>{
          if(res.destroyed)return;
          if(pos>end){res.end();return;}
          const cap=primeReleased.has(id)||start>movieBytes-32768?end+1:Math.min(65536,end+1);
          const length=Math.max(0,Math.min(chunk.length,cap-pos));
          if(length){
            const read=fs.readSync(fd,chunk,0,length,pos);
            pos+=read;entry.streamedBytes=(entry.streamedBytes||0)+read;
            res.write(Buffer.from(chunk.subarray(0,read)));
          }
          timer=setTimeout(deliver,length?8:25);timer.unref();
        };
        deliver();
        return;
      }
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
  await p.waitForFunction(()=>typeof window.__prepareCardEnhVideo==='function'&&CardPhonePresentation?.enhancementSummonVersion>=5&&CardPhonePresentation?.enhancementVideoOrderVersion>=2);
  check('online enhancement owner version 2 and summon v5 are mounted over retained bundle',await p.evaluate(()=>CardPhonePresentation.enhancementVideoOrderVersion>=2&&CardPhonePresentation.enhancementSummonVersion>=5));
  await model(p,fixture());await idle(p);
  await p.evaluate(()=>{
    window.__enhTrace=[];window.__enhJobDone=false;window.__enhJobError=null;
    const video=document.getElementById('enhVideo');
    const snapshot=()=>{let buffer=0;try{for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=.05)buffer=video.buffered.end(i);}catch{}return {at:Date.now(),readyState:video.readyState,width:video.videoWidth,height:video.videoHeight,duration:Number.isFinite(video.duration)?video.duration:null,buffer,src:video.getAttribute('src'),time:video.currentTime,overlayHidden:document.getElementById('enhOverlay').classList.contains('hidden')};};
    window.__enhSnapshot=snapshot;
    for(const type of ['loadstart','loadedmetadata','loadeddata','canplay','canplaythrough','playing','waiting','stalled','ended','error'])video.addEventListener(type,()=>window.__enhTrace.push({type,...snapshot()}));
    for(const name of ['load','play','pause']){const original=HTMLMediaElement.prototype[name];HTMLMediaElement.prototype[name]=function(...args){if(this===video)window.__enhTrace.push({type:'native-'+name,...snapshot()});return Reflect.apply(original,this,args);};}
    const originalEmit=socket.emit;
    socket.emit=function(...args){
      if(args[0]==='ACTION'&&args[1]?.type==='PRESENTATION_READY')window.__enhTrace.push({type:'ack',id:args[1].payload?.id,...snapshot()});
      return Reflect.apply(originalEmit,this,args);
    };
    let signature='';new MutationObserver(()=>{const layer=document.querySelector('.card-enhancement-summon'),next=layer?layer.dataset.card+':'+layer.dataset.phase:'none';if(next!==signature){signature=next;window.__enhTrace.push({type:'phase',phase:layer?.dataset.phase||'none',card:layer?.dataset.card||null,...snapshot()});}}).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['data-phase']});
    let skillBusy=null;setInterval(()=>{const busy=!!CardPhonePresentation.isCardSkillIntroBusy?.();if(busy!==skillBusy){skillBusy=busy;window.__enhTrace.push({type:'skill-busy',busy,...snapshot()});}},40);
  });
}
async function source(p,id,kind,tag){const url='/__qa_video/'+id+'.mp4?kind='+kind+'&id='+encodeURIComponent(tag);await p.evaluate(({id,url})=>ENH_VID[id]=url,{id,url});return url;}
async function trace(p,key){const t=await p.evaluate(()=>window.__enhTrace);report.traces[report.activeScenario+'/'+key]=t;save();return t;}
async function actions(p){return p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION').map(x=>x[1]));}
const scenarios=(process.env.STARTUP_QA_SCENARIOS||'recovery').split(',');
async function installFault(p,mode='pending-first'){
  await p.evaluate(({mode,forceAny})=>{
    const v=document.getElementById('enhVideo'),prior=HTMLMediaElement.prototype.play;
    const fault=window.__startupFault={mode,injected:false,attempts:[],settled:'pending',forceAny};
    HTMLMediaElement.prototype.play=function(...args){
      if(this!==v)return Reflect.apply(prior,this,args);
      const row={at:Date.now(),muted:this.muted,paused:this.paused,src:this.getAttribute('src'),time:this.currentTime,readyState:this.readyState};fault.attempts.push(row);
      if(mode!=='none'&&!fault.injected&&(!this.muted||forceAny)){
        fault.injected=true;row.injectedPending=true;
        return new Promise((resolve,reject)=>{window.__qaResolveFirstPlay=()=>{fault.settled='resolved';resolve();};window.__qaRejectFirstPlay=()=>{fault.settled='rejected';reject(new DOMException('Injected delayed first-play rejection','NotAllowedError'));};});
      }
      if(mode==='both-pending'&&this.muted){row.injectedMutedPending=true;return new Promise(()=>{});}
      row.native=true;return Reflect.apply(prior,this,args);
    };
  },{mode,forceAny:process.env.STARTUP_QA_FORCE_FIRST==='1'});
}
async function acceptedCard(p,id,room={},tag='startup-pending',kind='fast'){
  const sample=cases.find(c=>c.label==='card-'+id+'-enhanced/PLAY_CARD'),before=structuredClone(sample.before);before.phase='playing';before.players.forEach((p,i)=>p.isCPU=i!==0);await model(p,before);
  room.state=before;const result=intent.decorate(room,before,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}},engine.applyAction(before,{type:'PLAY_CARD',playerId:0,payload:{which:'hand'}}));room.state=result.state;
  const after=engine.getVisibleState(room.state,0);after.presentationReady=barrier.begin(room);const url=await source(p,id,kind,tag);
  await p.evaluate(({events,s})=>{window.__sent=[];for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:result.emits.filter(e=>e.to==='all'||e.to===0),s:after});return {room,after,url};
}
async function releaseAck(p,{room,after},label){
  await idle(p);await p.waitForFunction(id=>window.__sent.some(x=>x[0]==='ACTION'&&x[1].type==='PRESENTATION_READY'&&x[1].payload?.id===id),after.presentationReady.id,{timeout:5000});
  const acks=(await actions(p)).filter(x=>x.type==='PRESENTATION_READY'&&x.payload?.id===after.presentationReady.id);check(label+' original barrier receives sole human ACK',acks.length===1&&barrier.acknowledge(room,0,acks[0].payload));const released=barrier.view(room);
  await p.evaluate(s=>window.__deliver('STATE',s),{...after,presentationReady:released});await idle(p);
}
async function followTarget(p,label){await p.evaluate(()=>window.__sent=[]);await p.locator('main #players>[data-seat-id="1"]').tap();const selected=await actions(p);check(label+' original follow-up target remains playable',selected.length===1&&selected[0].type==='PICK_TARGET'&&selected[0].payload.target===1,selected);}
async function settleFirst(p,late){await p.evaluate(late=>late==='resolve'?window.__qaResolveFirstPlay():window.__qaRejectFirstPlay(),late);await p.waitForTimeout(250);}
async function queueStartup(p,mode){
  await installFault(p);await p.evaluate(()=>window.__enhTrace=[]);const accepted=await acceptedCard(p,1);
  await p.waitForFunction(()=>window.__startupFault.attempts.length>0,{},{timeout:20000});
  await p.waitForFunction(()=>window.__enhTrace.some(x=>x.type==='playing')||window.__sent.some(x=>x[0]==='ACTION'&&x[1].type==='PRESENTATION_READY'),{},{timeout:20000});
  let t=await trace(p,'startup-checkpoint');report.fault=await p.evaluate(()=>window.__startupFault);save();
  const playing=t.find(x=>x.type==='playing'),injected=report.fault.attempts.find(x=>x.injectedPending),native=report.fault.attempts.filter(x=>x.native);
  check('fault targets first unmuted pending play or safe muted startup avoids that request',!!injected||native.length>0&&native[0].muted,report.fault);
  check('pending startup recovers through actual native muted playback instead of skipping',!!playing&&native.some(x=>x.muted),{fault:report.fault,trace:t});
  if(injected)check('pending play fallback reaches playing within six seconds',playing.at-injected.at<6000,{injected,playing});
  check('same warm element is retried without source or load reset',report.fault.attempts.every(x=>x.src===accepted.url)&&t.filter(x=>x.type==='native-load'&&x.src).length===1,{attempts:report.fault.attempts,loads:t.filter(x=>x.type==='native-load')});
  const checkpoint=report.fault.attempts.length,late=process.env.STARTUP_QA_LATE||'reject';
  if(injected){await settleFirst(p,late);const now=await p.evaluate(()=>window.__startupFault);check('late first-play '+late+' does not start another play',now.attempts.length===checkpoint,{checkpoint,now});}
  await p.waitForFunction(()=>window.__enhTrace.some(x=>x.type==='ended'),{},{timeout:16000});await idle(p);t=await trace(p,'startup-complete');report.fault=await p.evaluate(()=>window.__startupFault);
  check('one actual movie completes after fallback',t.filter(x=>x.type==='ended').length===1,t);
  report.whiteAfterPlayback=t.filter(x=>x.type==='phase'&&x.phase==='white').every(x=>x.at>=playing.at);
  if(process.env.STARTUP_QA_REQUIRE_STARTED_WHITE==='1')check('white starts only after actual playback has started',report.whiteAfterPlayback,{white:t.filter(x=>x.type==='phase'&&x.phase==='white'),playing});
  await releaseAck(p,accepted,'recovery');await followTarget(p,'recovery');
}
async function cancelAndReplace(p,late){
  await installFault(p);await p.evaluate(()=>window.__enhTrace=[]);const first=await acceptedCard(p,1);
  await p.waitForFunction(()=>window.__startupFault.injected,{},{timeout:20000});
  const cancelAt=await p.evaluate(()=>{const at=Date.now();CardPhonePresentation.cancelEnhancements();return at;});
  await p.waitForTimeout(1600);let f=await p.evaluate(()=>window.__startupFault),t=await trace(p,'canceled-before-retry');
  check('cancellation arrives before pending-play retry deadline',cancelAt-f.attempts[0].at<1000,{cancelAt,f});
  check('canceled first job never retries or plays',f.attempts.length===1&&!t.some(x=>x.type==='playing'),{f,t});
  check('canceled pending job removes overlay and source',await p.evaluate(()=>document.getElementById('enhOverlay').classList.contains('hidden')&&!document.getElementById('enhVideo').getAttribute('src')));
  await releaseAck(p,first,'canceled job');
  const second=await acceptedCard(p,2,first.room,'replacement');
  await p.waitForFunction(url=>window.__enhTrace.some(x=>x.type==='playing'&&x.src===url),second.url,{timeout:18000});
  const before=await p.evaluate(()=>({attempts:window.__startupFault.attempts.length,source:document.getElementById('enhVideo').getAttribute('src'),time:document.getElementById('enhVideo').currentTime}));await settleFirst(p,late);
  f=await p.evaluate(()=>window.__startupFault);check('late canceled '+late+' cannot replay or replace the next skill',f.attempts.length===before.attempts&&await p.locator('#enhVideo').getAttribute('src')===second.url,{before,f});
  await p.waitForFunction(url=>window.__enhTrace.some(x=>x.type==='ended'&&x.src===url),second.url,{timeout:12000});
  // The real enhanced Robin result includes a private reading gate. Complete
  // that original user action before expecting the presentation ACK.
  await p.locator('#phonePrivateReveal').waitFor({state:'visible',timeout:15000});await p.waitForFunction(()=>!document.querySelector('#phoneCardFlights [data-kind="peek"]'),{},{timeout:15000});await p.locator('#phonePrivateDone').click();
  check('replacement real private reading is explicitly completed',true);await idle(p);t=await trace(p,'replacement-complete');
  check('only replacement movie completes once',t.filter(x=>x.type==='ended').length===1&&t.filter(x=>x.type==='ended')[0].src===second.url,t);
  check('old job never starts after replacement',!t.some(x=>x.type==='playing'&&x.src===first.url),t);await releaseAck(p,second,'replacement job');
}
async function bothPending(p){
  await installFault(p,'both-pending');await p.evaluate(()=>window.__enhTrace=[]);const accepted=await acceptedCard(p,1);
  await p.waitForFunction(()=>window.__startupFault.injected,{},{timeout:20000});await releaseAck(p,accepted,'both pending');const f=await p.evaluate(()=>window.__startupFault),t=await trace(p,'both-pending-bounded');
  const cleared=t.filter(x=>x.type==='native-pause').at(-1),elapsed=cleared.at-f.attempts[0].at;
  check('both pending permits one original and one muted retry only',f.attempts.length===2&&f.attempts[0].injectedPending&&f.attempts[1].injectedMutedPending,f);
  check('both pending startup cleanup remains bounded near eight seconds',elapsed>=7500&&elapsed<10000,{elapsed,f,t});
  check('both pending yields no false playing/ended and releases video source',!t.some(x=>x.type==='playing'||x.type==='ended')&&await p.locator('#enhVideo').getAttribute('src')===null,t);
  await settleFirst(p,'reject');await p.waitForTimeout(1400);check('late rejected first call cannot revive timed-out movie',(await p.evaluate(()=>window.__startupFault.attempts.length))===2);await followTarget(p,'both pending');
}
async function metadataPrime(p,mode){
  if(mode!=='android')throw Error('metadata-prime must use the retained Android bundle and Android UA');
  await p.evaluate(()=>{
    const v=document.getElementById('enhVideo'),prior=HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play=function(...args){
      const pending=Reflect.apply(prior,this,args);
      if(this===v&&this.getAttribute('src')?.includes('kind=prime-limited')){
        const id=new URL(this.src).searchParams.get('id');
        void fetch('/__qa_prime_start?id='+encodeURIComponent(id));
      }
      return pending;
    };
  });
  const tag='metadata-prime-actual-queue';
  const accepted=await acceptedCard(p,1,{},tag,'prime-limited');
  await p.waitForFunction(()=>window.__enhTrace.some(row=>row.type==='playing'&&!row.overlayHidden),{},{timeout:22000});
  let t=await trace(p,'visible-playing');
  const diag=await p.evaluate(()=>window.__readCardEnhVideoTrace());
  const start=diag.find(row=>row.type==='prime-start'),ready=diag.find(row=>row.type==='prepare-ready');
  const before=t.find(row=>row.type==='native-play'&&row.overlayHidden);
  const visible=t.find(row=>row.type==='playing'&&!row.overlayHidden);
  const ranges=report.requests.filter(row=>row.id===tag);
  check('limited original MP4 requires real first play before readiness',
    !!before&&before.readyState<3&&primeReleased.has(tag)&&!!start&&start.muted&&
    !!ready&&['prime-frame','buffer-after-prime'].includes(ready.detail)&&ready.width>0&&ready.time<20,
    {start,ready,before});
  check('exact movie range fetched real tail metadata under restricted preload',
    ranges.some(row=>row.status===206&&row.start>movieBytes-32768&&row.streamedBytes>0));
  const white=t.filter(row=>row.type==='phase'&&row.phase==='white');
  check('white phase waits for decoded same-source opening frame',
    white.length===1&&white[0].width>0&&white[0].readyState>=2&&white[0].time<.03&&
    white[0].src===accepted.url&&white[0].at>=before.at&&visible.at>=white[0].at&&visible.time<.12,
    {white,visible});
  check('room does not acknowledge while visible video still plays',
    !(await actions(p)).some(x=>x.type==='PRESENTATION_READY'&&x.payload?.id===accepted.after.presentationReady.id));
  await p.waitForFunction(()=>window.__enhTrace.some(row=>row.type==='ended'&&!row.overlayHidden),{},{timeout:11000});
  await releaseAck(p,accepted,'metadata prime');
  t=await trace(p,'accepted-complete');
  const ended=t.filter(row=>row.type==='ended'),acks=t.filter(row=>row.type==='ack'&&row.id===accepted.after.presentationReady.id);
  check('one movie completes and original room ACK comes after it',
    ended.length===1&&ended[0].src===accepted.url&&ended[0].time>=5&&acks.length===1&&acks[0].at>=ended[0].at,
    {ended,acks});
  check('original video source reused without a reload or visible replay',
    t.filter(row=>row.type==='native-load'&&row.src).length===1&&t.filter(row=>row.type==='playing'&&!row.overlayHidden).length===1,
    t.filter(row=>['native-load','playing'].includes(row.type)));
  await followTarget(p,'metadata prime');
}

async function manualMainTap(p,mode){
  if(mode!=='android')throw Error('manual-main-tap must use the retained Android bundle and Android UA');
  await p.evaluate(()=>{
    const video=document.getElementById('enhVideo'),overlay=document.getElementById('enhOverlay');
    const original=HTMLMediaElement.prototype.play;
    window.__manualMain=[];
    HTMLMediaElement.prototype.play=function(...args){
      if(this!==video||overlay.classList.contains('hidden'))return Reflect.apply(original,this,args);
      const call={muted:this.muted,time:this.currentTime,src:this.getAttribute('src'),at:Date.now()};
      window.__manualMain.push(call);
      if(window.__manualMain.length<=2){call.fault='pending';return new Promise(()=>{});}
      return Reflect.apply(original,this,args);
    };
  });
  const accepted=await acceptedCard(p,1,{},'manual-main-tap');
  const button=p.getByRole('button',{name:'點一下播放強化影片',exact:true});
  await button.waitFor({state:'visible',timeout:22000});
  const hit=await button.evaluate(button=>{
    const r=button.getBoundingClientRect(),style=getComputedStyle(button),overlay=document.getElementById('enhOverlay');
    const o=getComputedStyle(overlay),summon=document.querySelector('.card-enhancement-summon');
    const target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {hit:target===button||button.contains(target),target:{id:target?.id,tag:target?.tagName,className:target?.className},
      width:r.width,height:r.height,display:style.display,visibility:style.visibility,buttonZ:style.zIndex,
      overlayState:overlay.dataset.enhState,overlayZ:o.zIndex,overlayBackground:o.backgroundColor,
      overlayPointerEvents:o.pointerEvents,summonPhase:summon?.dataset.phase||null,
      nativeStyle:document.documentElement.dataset.cardBundledStyles,calls:window.__manualMain.slice()};
  });
  check('two actual main-phase attempts leave one local tap under native layout',
    hit.nativeStyle==='1'&&hit.overlayState==='loading'&&hit.calls.length===2&&
    hit.calls.every(row=>row.fault==='pending'&&row.src===accepted.url)&&!hit.calls[0].muted&&hit.calls[1].muted,hit);
  let clickError=null;
  try{await button.click({timeout:2000});}catch(error){clickError=error.message;}
  check('native CSS leaves the real manual control at the hit point and normal click succeeds',
    hit.hit&&!clickError,{hit,clickError});
  await p.waitForFunction(()=>window.__enhTrace.some(row=>row.type==='ended'&&!row.overlayHidden),{},{timeout:11000});
  await releaseAck(p,accepted,'manual main tap');
  const t=await trace(p,'manual-main-complete'),calls=await p.evaluate(()=>window.__manualMain);
  const visible=t.filter(row=>row.type==='playing'&&!row.overlayHidden),ended=t.filter(row=>row.type==='ended');
  check('real click gives one same-source native replay from the opening frames through completion',
    calls.length===3&&calls[2].src===accepted.url&&calls[2].muted&&visible.length===1&&visible[0].time<.1&&
    ended.length===1&&ended[0].time>=5&&t.filter(row=>row.type==='native-load'&&row.src).length===1,{calls,visible,ended});
}

async function normalStartup(p){
  // An actual user touch allows native unmuted autoplay in desktop Chromium;
  // the Android host separately sets mediaPlaybackRequiresUserGesture(false).
  await p.evaluate(()=>{const b=document.createElement('button');b.id='qaStartupTouch';b.textContent='啟動播放測試';Object.assign(b.style,{position:'fixed',left:'0',top:'0',zIndex:'999999'});b.onclick=()=>b.remove();document.body.append(b);});await p.locator('#qaStartupTouch').tap();
  await installFault(p,'none');await p.evaluate(()=>window.__enhTrace=[]);const accepted=await acceptedCard(p,1);
  await p.waitForFunction(()=>window.__enhTrace.some(x=>x.type==='playing'),{},{timeout:18000});await p.waitForTimeout(1700);
  const f=await p.evaluate(()=>window.__startupFault);check('normal unmuted native playback starts without an extra muted retry',f.attempts.length===1&&f.attempts[0].native&&!f.attempts[0].muted,f);
  await p.waitForFunction(()=>window.__enhTrace.some(x=>x.type==='ended'),{},{timeout:10000});await idle(p);const t=await trace(p,'normal-complete');check('normal movie completes once without source reload',t.filter(x=>x.type==='ended').length===1&&t.filter(x=>x.type==='native-load'&&x.src).length===1,t);await releaseAck(p,accepted,'normal');await followTarget(p,'normal');
}

let browser,page;
try{
  for(const mode of modes){
    const bundleMode=mode==='ios'?'ios':'android';browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
    for(const scenario of scenarios){report.activeScenario=mode+'/'+scenario;
      const ctx=await browser.newContext({viewport:{width:740,height:360},hasTouch:true,isMobile:true,userAgent:uas[bundleMode],serviceWorkers:'block'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await ctx.addInitScript(()=>window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin);
      if(bundleMode==='ios')await ctx.addInitScript({content:bundles.ios.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/__qa_bundle/ios.css';document.head.append(l);},{once:true});`});
      page=await ctx.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({mode,scenario,message:e.message}));await page.goto(origin+'/game.html?qaBundle='+bundleMode,{waitUntil:'load'});await setup(page);
      if(scenario==='recovery')await queueStartup(page,mode);else if(scenario==='cancel-reject'||scenario==='cancel-resolve')await cancelAndReplace(page,scenario.split('-')[1]);else if(scenario==='both-pending')await bothPending(page);else if(scenario==='normal')await normalStartup(page);else if(scenario==='metadata-prime')await metadataPrime(page,mode);else if(scenario==='manual-main-tap')await manualMainTap(page,mode);else throw Error('Unknown scenario '+scenario);
      check(mode+' '+scenario+' no page exceptions',!report.errors.some(x=>x.mode===mode&&x.scenario===scenario),report.errors);save();await ctx.close();page=null;
    }
    await browser.close();browser=null;
  }
  check('all product source bytes remain unchanged throughout this run',report.source.every(x=>sha(fs.readFileSync(path.join(root,x.file)))===x.sha256),report.source);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{report.failureTrace=await page.evaluate(()=>({trace:window.__enhTrace,jobDone:window.__enhJobDone,jobError:window.__enhJobError,snapshot:window.__enhSnapshot?.(),phase:document.querySelector('.card-enhancement-summon')?.dataset.phase,startupFault:window.__startupFault,queue:CardPhonePresentation?.presentationQueueSize?.(),busy:CardPhonePresentation?.presentationEffectsBusy?.(),venuePending:CardPhonePresentation?.isVenueIntroPending?.(),venueEntering:CardPhonePresentation?.isVenueEntering?.(),reading:['phoneVenueIntro','phoneCardSheet','phonePrivateReveal','phoneLibrary'].filter(id=>{const n=document.getElementById(id);return n&&!n.hidden&&n.getClientRects().length;})}));report.failureScreenshot=path.join(out,'failure.png');await page.screenshot({path:report.failureScreenshot});}catch{}}
finally{await browser?.close();for(const socket of sockets)socket.destroy();await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,errors:report.errors,failure:report.failure,report:path.join(out,'report.json')}));}
