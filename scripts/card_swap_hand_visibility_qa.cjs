'use strict';
// Mechanism regression: exact shipped FX/borrow/mask functions in a real DOM.
// Deliberately orders commit.restore before the legacy swap's reading callback.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {JSDOM,VirtualConsole}=require('C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/node_modules/jsdom');
const root='D:/Codex_Release_Worktrees/card-swap-collision-20261107',qa='D:/Codex_QA/card-swap-collision-20261107';
const draft=process.argv.includes('--draft');
const marker='/* Old native swap callbacks can run after the flow\'s global hand restore.';
const runtime=fs.readFileSync(path.join(root,'public/js/card-duel-runtime.js'),'utf8');
const hook=draft?fs.readFileSync(path.join(qa,'card-swap-visibility-draft.js'),'utf8'):runtime.slice(runtime.indexOf(marker));
assert(hook.startsWith(marker),'Scoped hook not found');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sources={
 desktop:{file:path.join(root,'public/js/card-desktop-table.js')},
 android:{file:'C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html/android/app/src/main/assets/mobile/game-mobile.js',expected:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5'},
 ios:{file:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile/game-mobile.js',expected:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b'}
};
for(const source of Object.values(sources)){
 source.bytes=fs.readFileSync(source.file);source.sha256=sha(source.bytes);if(source.expected)assert.equal(source.sha256,source.expected);
 const text=source.bytes.toString('utf8'),at=text.indexOf("if(!root.dataset.cardPhone||root.dataset.cardFx)return;");
 const start=text.lastIndexOf('(() => {',at),end=text.indexOf('\n})();',at);
 assert(start>=0&&end>at);source.fx=text.slice(start,end+7);
 const borrow=text.indexOf('const borrowed=new Map();'),borrowEnd=text.indexOf('const reduced=',borrow);
 const mask=text.indexOf('const masked=new Set();'),maskEnd=text.indexOf('api.suppressKidFlash=true;',mask);
 assert(borrow>=0&&borrowEnd>borrow&&mask>=0&&maskEnd>mask);
 source.borrow=text.slice(borrow,borrowEnd);source.mask=text.slice(mask,maskEnd);
}
const assertions=[],baseline=[],failures=[],domErrors=[];
function check(name,fn){try{fn();assertions.push({name,pass:true});}catch(e){assertions.push({name,pass:false,error:e.stack});failures.push({name,error:e.stack});}}
function harness(source,enabled=true,viewer=0){
 let now=0,serial=0;const jobs=new Map(),events=new Map(),trace=[];const flags={fast:false};
 const virtualConsole=new VirtualConsole();virtualConsole.on('jsdomError',e=>domErrors.push({source:source.file,error:e.message}));
 const dom=new JSDOM(`<html data-card-phone="table" data-card-flow="1"><head><style>.hidden,[hidden]{display:none!important}[data-card-visual-borrowed="true"],[data-card-visual-borrowed="true"] *{visibility:hidden!important}</style></head><body><main><div id="players">${[0,1,2].map(i=>`<div data-seat-id="${i}"><img class="rounded-full"><div class="grow"></div></div>`).join('')}</div><div id="myPlayZone"><button id="playHand"><img id="imgHand" src="images/cards/8.webp"></button><button id="playDrawn"><img id="imgDrawn"></button></div></main><div id="modal" class="hidden"></div><div id="enhOverlay" class="hidden"><video id="enhVideo"></video></div><div id="lawSwapModal" class="hidden"><img id="lawTargetImg"></div><button id="btnDraw"></button></body></html>`,{url:'https://swap-qa.invalid/game.html',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole});
 const w=dom.window,d=w.document,ctx=dom.getInternalVMContext();Object.defineProperty(d,'readyState',{configurable:true,get:()=> 'complete'});
 w.setTimeout=(fn,ms=0)=>{const id=++serial;jobs.set(id,{at:now+ms,fn});return id;};w.clearTimeout=id=>jobs.delete(id);
 w.requestAnimationFrame=fn=>w.setTimeout(()=>fn(now),16);w.cancelAnimationFrame=w.clearTimeout;
 Object.defineProperty(w.performance,'now',{value:()=>now});w.matchMedia=()=>({matches:false});w.ResizeObserver=class{observe(){}};
 const nativeObserver=w.MutationObserver,observers=[];w.MutationObserver=class extends nativeObserver{constructor(callback){super(callback);observers.push(this);}};
 w.HTMLElement.prototype.getBoundingClientRect=function(){if(!this.isConnected||this.closest('[hidden],.hidden'))return{left:0,top:0,right:0,bottom:0,width:0,height:0};const row=this.closest('[data-seat-id]'),left=row?Number(row.dataset.seatId)*100:20;return{left,top:20,right:left+80,bottom:140,width:80,height:120};};
 w.HTMLElement.prototype.getClientRects=function(){const r=this.getBoundingClientRect();return r.width?[r]:[];};
 w.HTMLElement.prototype.animate=function(){return{finished:Promise.resolve(),cancel(){}};};
 w.__TABLETOP_ANDROID_TEST_ORIGIN=w.location.origin;w.me={roomId:'QA-SWAP',playerId:viewer};
 w.state={roundNo:1,turnIndex:0,pending:{action:'law',extra:{keep:8}},players:[0,1,2].map(id=>({id,alive:true,hand:id===viewer?8:null,client:{displayName:'A'+id}}))};
 w.isCpuSkipFastMode=()=>flags.fast;w.playDuel=()=>{};
 w.socket={on(name,fn){if(!events.has(name))events.set(name,[]);events.get(name).push(fn);}};
 const api=w.CardPhonePresentation={ownHandElement:()=>d.getElementById('imgHand'),cancelCardFlights(){}};
 vm.runInContext(`(()=>{const api=window.CardPhonePresentation;${source.borrow}\n${source.mask}})();`,ctx);
 const nativeMask=api.maskHandArt,nativeRestore=api.restoreHandArt,nativeBorrow=api.borrowCardVisual;
 api.maskHandArt=function(...args){trace.push({type:'original-mask',time:now});return nativeMask.apply(this,args);};
 api.restoreHandArt=function(){trace.push({type:'global-restore',time:now});return nativeRestore();};
 api.borrowCardVisual=function(node){trace.push({type:'borrow',time:now,node:node?.id});const release=nativeBorrow(node);return()=>{trace.push({type:'release',time:now,node:node?.id});release();};};
 vm.runInContext(source.fx,ctx);
 if(enabled)vm.runInContext(hook,ctx);
 const flush=async()=>{for(let i=0;i<8;i++)await Promise.resolve();};
 async function tick(ms){const end=now+ms;let count=0;while(true){const next=[...jobs].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at||a[0]-b[0])[0];if(!next)break;assert(++count<4000,'timer loop');jobs.delete(next[0]);now=next[1].at;next[1].fn();await flush();}now=end;await flush();}
 const emit=(name,value)=>{for(const fn of (events.get(name)||[]).slice())fn(value);};
 return{w,d,api,flags,trace,tick,flush,emit,close:()=>{for(const observer of observers)observer.disconnect();jobs.clear();dom.window.close();},
  start:()=>api.presentEffectEvent({to:'all',type:'law_swap',casterId:0,targetId:1}),
  layer:()=>d.getElementById('phoneInteractionFx'),node:()=>d.getElementById('playHand'),
  hidden:()=>d.getElementById('playHand').getAttribute('data-card-visual-borrowed')==='true',
  visibility:()=>w.getComputedStyle(d.getElementById('imgHand')).visibility};
}
(async()=>{
 for(const [kind,source]of Object.entries(sources)){
  {
   const h=harness(source,false);h.start();await h.tick(32);h.api.restoreHandArt();await h.tick(6500);
   const evidence={kind,expectedFailure:true,mechanismOnly:true,afterSceneRemoved:!h.layer().children.length,borrowed:h.hidden(),visibility:h.visibility(),trace:h.trace};baseline.push(evidence);
   check(kind+' original exact FX reproduces late-mask leak after early commit restore',()=>{assert(evidence.afterSceneRemoved);assert(evidence.borrowed);assert.equal(evidence.visibility,'hidden');assert(h.trace.some(x=>x.type==='original-mask'&&x.time>32));});h.close();
  }
  {
   const h=harness(source);await h.tick(0);h.start();await h.tick(32);h.api.restoreHandArt();await h.tick(2400);
   check(kind+' late swap callback owns one borrow while scene is active',()=>{assert(h.hidden());assert.equal(h.trace.filter(x=>x.type==='original-mask').length,0);});
   h.api.maskHandArt();h.api.maskHandArt();
   check(kind+' same scene deduplicates its normalized hand slot',()=>assert.equal(h.trace.filter(x=>x.type==='borrow').length,1));
   await h.tick(4100);check(kind+' normal scene removal restores its hand without another global restore',()=>{assert(!h.hidden());assert.equal(h.visibility(),'visible');assert.equal(h.trace.filter(x=>x.type==='global-restore').length,1);});h.close();
  }
  {
   const h=harness(source);await h.tick(0);const inspector=h.api.borrowCardVisual(h.d.getElementById('imgHand'));h.start();await h.tick(6500);
   check(kind+' swap releases only its lease and preserves mixed inspector ownership',()=>assert(h.hidden()));inspector();
   check(kind+' final inspector release restores hand after mixed ownership',()=>assert(!h.hidden()));h.close();
  }
  for(const reason of ['explicit','JOINED','disconnect','background','pagehide','round','room','fast']){
   const h=harness(source);await h.tick(0);h.start();await h.tick(2400);assert(h.hidden());const oldScene=h.layer().firstElementChild;
   if(reason==='explicit')h.api.clearSwapHandVisibility();else if(reason==='background'){Object.defineProperty(h.d,'hidden',{configurable:true,value:true});h.d.dispatchEvent(new h.w.Event('visibilitychange'));}else if(reason==='pagehide')h.w.dispatchEvent(new h.w.Event('pagehide'));else if(reason==='round'){h.w.state.roundNo=2;h.emit('STATE',{...h.w.state});}else if(reason==='room'){h.w.me.roomId='QA-OTHER';h.emit('STATE',{...h.w.state});}else if(reason==='fast'){h.flags.fast=true;await h.tick(60);}else h.emit(reason);
   await h.flush();check(kind+' '+reason+' releases active scene lease',()=>assert(!h.hidden()));
   // JOINED/pagehide/explicit cancellation can leave the original scene alive.
   // Its delayed or replayed mask must not acquire a fresh lease.
   if(oldScene?.isConnected&&oldScene.parentElement===h.layer()){
    if(reason==='background')Object.defineProperty(h.d,'hidden',{configurable:true,value:false});h.flags.fast=false;h.api.maskHandArt();
    check(kind+' '+reason+' rejects a late mask from the same cancelled scene',()=>assert(!h.hidden()));
   }
   h.close();
  }
  {
   const h=harness(source);await h.tick(0);h.start();h.api.clearSwapHandVisibility();await h.tick(2400);
   check(kind+' cancellation before original reading timer rejects its late mask',()=>assert(!h.hidden()));await h.tick(4100);h.start();await h.tick(2400);
   check(kind+' a fresh swap scene can acquire its own lease after cancellation',()=>assert(h.hidden()));await h.tick(4100);assert(!h.hidden());h.close();
  }
  {
   const h=harness(source);await h.tick(0);h.layer().dataset.kind='guard';h.api.maskHandArt();
   check(kind+' non-swap mask retains original contract and owner',()=>{assert(h.hidden());assert.equal(h.trace.filter(x=>x.type==='original-mask').length,1);});h.api.clearSwapHandVisibility();assert(h.hidden());h.api.restoreHandArt();assert(!h.hidden());h.close();
  }
  for(const explicit of ['node','null']){
   const h=harness(source);await h.tick(0);h.start();h.api.maskHandArt(explicit==='node'?h.d.getElementById('imgHand'):null);await h.tick(6500);
   check(kind+' active swap preserves original owner for explicit '+explicit+' mask',()=>{assert(h.hidden());assert.equal(h.trace.filter(x=>x.type==='original-mask').length,1);});h.api.restoreHandArt();assert(!h.hidden());h.close();
  }
  {
   const h=harness(source,true,2);await h.tick(0);h.start();await h.tick(6500);
   check(kind+' spectator swap never creates a private hand borrow',()=>{assert(!h.hidden());assert.equal(h.trace.filter(x=>x.type==='borrow').length,0);});h.close();
  }
  {
   const h=harness(source);await h.tick(0);h.api.ownHandElement=()=>null;h.start();await h.tick(6500);
   check(kind+' missing live hand node does not create a phantom lease',()=>{assert(!h.hidden());assert.equal(h.trace.filter(x=>x.type==='borrow').length,0);});h.close();
  }
 }
 check('no unexpected DOM callback errors',()=>assert.deepEqual(domErrors,[]));
 const report={passed:failures.length===0,checks:assertions.length,failed:failures.length,mechanismOnly:true,scope:'Exact shipped FX IIFE, borrow and mask/restore snippets in jsdom. Forced early restore/late swap callback ordering; not end-to-end server/device acceptance.',runtime:{file:path.join(root,'public/js/card-duel-runtime.js'),bytes:Buffer.byteLength(runtime),sha256:sha(runtime)},script:{file:__filename,sha256:sha(fs.readFileSync(__filename))},hook:{draft,sha256:sha(hook)},sources:Object.fromEntries(Object.entries(sources).map(([kind,s])=>[kind,{file:s.file,bytes:s.bytes.length,sha256:s.sha256}])),baselineExpectedFailures:baseline,assertions,failures,domErrors};
 const output=path.join(qa,draft?'swap-scope-mechanism-draft.json':'swap-scope-mechanism-final.json');fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,checks:report.checks,failed:report.failed,output,failures}));if(!report.passed)process.exitCode=1;
})().catch(error=>{console.error(error.stack);process.exitCode=1;});
