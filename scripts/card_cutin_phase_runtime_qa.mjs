import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';

// Start only against a coordinated frozen candidate. No production socket,
// presentation module injection, or HTMLMediaElement overrides are used.
if(process.env.CARD_CUTIN_RUNTIME_FROZEN!=='1')throw Error('Run only after the runtime owner freezes the candidate (CARD_CUTIN_RUNTIME_FROZEN=1)');
const require=createRequire(import.meta.url),root=path.resolve(import.meta.dirname,'..');
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const engine=require('../server/engine'),intent=require('../server/card_skill_intent'),barrier=require('../server/card_presentation_ready'),venue=require('../server/card_venue_ready');
const mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const modes=(process.env.CARD_CUTIN_RUNTIME_MODES||'desktop,android,ios,ios58').split(',');
const out=process.env.CARD_CUTIN_RUNTIME_OUT||'D:/Codex_QA/card-cutin-phase-20261104/runtime-final';fs.mkdirSync(out,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex');
const product=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','public/css/card-native-online.css','server/engine.js','server/card_skill_intent.js'];
const frozen=new Map(product.map(file=>[file,fs.readFileSync(path.join(root,file))]));
const report={passed:false,scope:'Frozen real game HTML and generated desktop or exact retained native bundles; genuine engine/decorator/room barriers delivered through real EMIT/STATE handlers. Isolated local Socket.IO fixtures and DOM observations; one labeled delayed-art cancellation probe. No media-method patches, MP4 acceptance, physical-device, real-account or deployment claim.',source:product.map(file=>({file,bytes:frozen.get(file).length,sha256:sha(frozen.get(file))})),bundles:{},checks:[],cases:[],errors:[],initialLegacyFlashes:[]};
const save=()=>fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
const check=(name,pass,detail)=>{report.checks.push({case:report.activeCase,name,pass:!!pass,detail});if(!pass){save();throw Error(name+': '+JSON.stringify(detail));}};
const resultFile=mobile+'/android/web/card-result-cutins.js',resultBytes=fs.readFileSync(resultFile),normalize=s=>s.replace(/\r\n/g,'\n').trim(),resultSource=normalize(resultBytes.toString());
const inlineResult=frozen.get('public/game.html').toString().split('<!-- CARD_RESULT_CUTINS_BEGIN -->')[1]?.split('<!-- CARD_RESULT_CUTINS_END -->')[0]?.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
report.resultModule={file:resultFile,bytes:resultBytes.length,sha256:sha(resultBytes)};
check('actual inline and generated desktop both contain the frozen canonical v3 result module',!!inlineResult&&normalize(inlineResult)===resultSource&&normalize(frozen.get('public/js/card-desktop-table.js').toString()).includes(resultSource),report.resultModule);
const specs={
 android:{root:mobile+'/android/app/src/main/assets/mobile',js:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',css:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'},
 ios:{root:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',js:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',css:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'},
 ios58:{root:'D:/Codex_QA/card-native-update-diagnosis-20261101/ios-v058',js:'3d3d650fadc0eb39e473767f6cbf5542f45c5eb35fe9b17c65b76533e6b20026',css:'1bbb58d0aef4c2169e6e77677ba21ba96f3d2b8409aa138a8c6285c0cc61e55a'}
};
for(const mode of modes){if(mode==='desktop')continue;const spec=specs[mode];if(!spec)throw Error('Unknown mode '+mode);spec.bytes={};report.bundles[mode]={};for(const ext of ['js','css']){const data=fs.readFileSync(`${spec.root}/game-mobile.${ext}`),digest=sha(data);spec.bytes[ext]=data;report.bundles[mode][ext]={bytes:data.length,sha256:digest};check(mode+' retained '+ext+' identity',digest===spec[ext]);}}
const ua={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1',android:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)'};ua.ios58=ua.ios;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2','.mp4':'video/mp4','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.m4a':'audio/mp4','.webm':'video/webm'};
const stub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(name,data)=>{for(const cb of [...window.__any])cb(name,data);for(const cb of [...(window.__handlers[name]||[])])cb(data);};window.io=()=>({connected:true,id:'cutin-phase-runtime',on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},onAny(cb){window.__any.push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,cb){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==cb);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const sockets=new Set(),server=http.createServer((req,res)=>{
 const u=new URL(req.url,'http://localhost'),bundle=u.pathname.match(/^\/__phase_retained\/(android|ios|ios58)\.(js|css)$/);
 if(bundle){const data=specs[bundle[1]].bytes[bundle[2]];res.writeHead(200,{'content-type':mime['.'+bundle[2]],'content-length':data.length}).end(data);return;}
 if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':mime['.js']}).end(stub);return;}
 const rel=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,'public',rel);
 if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
 try{
  let data=frozen.get('public/'+rel)||fs.readFileSync(fs.existsSync(file)?file:path.join(mobile,'public',rel));
  if(rel==='game.html'&&u.searchParams.get('host')==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__phase_retained/android.css"><script src="/__phase_retained/android.js"></script>'));
  const type=mime[path.extname(file)]||'application/octet-stream',range=req.headers.range?.match(/^bytes=(\d*)-(\d*)$/);
  if(range&&data.length){const total=data.length,start=range[1]?Number(range[1]):Math.max(0,total-Number(range[2])),end=range[1]&&range[2]?Math.min(total-1,Number(range[2])):total-1;if(start>end||start>=total){res.writeHead(416,{'content-range':`bytes */${total}`}).end();return;}data=data.subarray(start,end+1);res.writeHead(206,{'content-type':type,'content-length':data.length,'accept-ranges':'bytes','content-range':`bytes ${start}-${end}/${total}`}).end(data);return;}
  res.writeHead(200,{'content-type':type,'content-length':data.length,'accept-ranges':'bytes'}).end(data);
 }catch{res.writeHead(404).end();}
});
server.on('connection',socket=>{sockets.add(socket);socket.on('close',()=>sockets.delete(socket));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
const engineCases=require('./card_all_effect_cases').buildCases();
const fixture=label=>{const c=engineCases.find(x=>x.label===label);if(!c)throw Error('Missing engine fixture '+label);return structuredClone(c.before);};
const ordered=(rows,a,b)=>{const i=rows.findIndex(typeof a==='function'?a:x=>x.event===a),j=rows.findIndex(typeof b==='function'?b:x=>x.event===b);return i>=0&&j>i;};
const opens=rows=>rows.filter(x=>x.event==='cutin-open');
const fx=kind=>x=>x.event==='fx'&&x.kind===kind;
const commit=id=>x=>x.event==='commit'&&x.gate===id;

function observeDom(){
 const rows=window.__phaseTrace=[],api=CardPhonePresentation,seen=new WeakSet(),flags=new Map();let active=null,model=null,pilePhase=null;
 const node=id=>document.getElementById(id),shown=n=>!!n&&!n.hidden&&!n.classList.contains('hidden')&&n.getClientRects().length>0&&getComputedStyle(n).visibility!=='hidden';
 const record=(event,detail={})=>rows.push({event,at:performance.now(),...detail});
 const toggle=(key,next,detail)=>{if(flags.get(key)===next)return;flags.set(key,next);if(next)record(key+'-open',detail);else if(rows.some(x=>x.event===key+'-open'))record(key+'-close');};
 function capture(){
  const cut=document.querySelector('.card-anime-skill[data-result-cutin="true"]');
  if(active&&active!==cut){record('cutin-close',{card:Number(active.dataset.card),phase:active.dataset.cutinPhase});active=null;}
  if(cut&&active!==cut){active=cut;record('cutin-open',{card:Number(cut.dataset.card),phase:cut.dataset.cutinPhase,text:cut.textContent,privateOpen:shown(node('phonePrivateReveal')),lawOpen:shown(node('lawSwapModal')),confirmOpen:shown(node('yesBtn')),marks:document.querySelectorAll('.phone-roger-prediction').length});}
  const s=state;
  if(s&&s!==model){model=s;record('commit',{gate:s.presentationReady?.id||null,waiting:s.presentationReady?.waiting||false,round:s.roundNo,turn:s.turnIndex,pending:s.pending?.action||null,roger:s.rogerPred?{by:s.rogerPred.by,pick:s.rogerPred.pick}:null});}
  const layer=node('phoneInteractionFx'),scene=layer?.querySelector('.phone-hud-scene');
  if(scene&&!seen.has(scene)){seen.add(scene);record('fx',{kind:layer.dataset.kind,source:Number(scene.dataset.source),target:Number(scene.dataset.target),duringCutin:!!cut});}
  const sniper=document.querySelector('.phone-sniper-cutin');if(sniper&&!seen.has(sniper)){seen.add(sniper);record('sniper',{text:sniper.textContent});}
  const coin=node('phoneCoinToss');toggle('coin',shown(coin));toggle('coin-settled',shown(coin)&&!!coin.dataset.settled);
  toggle('private',shown(node('phonePrivateReveal')));toggle('law',shown(node('lawSwapModal')));toggle('confirm',shown(node('yesBtn')));
  const self=api.playerVisualElement?.(me.playerId);
  for(const key of ['protected','dodging'])toggle('badge-'+key,shown(self?.querySelector('.phone-seat-status-icon[data-status="'+key+'"]')));
  const mark=document.querySelector('.phone-roger-prediction');toggle('prediction',shown(mark),{target:Number(mark?.dataset.playerId),inside:!!mark&&api.playerVisualElement?.(Number(mark.dataset.playerId))?.querySelector(':scope > .phone-seat-card')?.contains(mark)});
  const pile=node('phonePileAction'),phase=shown(pile)?pile.dataset.phase:null;
  if(phase!==pilePhase){pilePhase=phase;if(phase){const imgs=[...pile.querySelectorAll('img')];record('pile-'+phase,{images:imgs.length,backs:imgs.every(img=>new URL(img.src).pathname.endsWith('/back.webp')),duringCutin:!!cut});}}
 }
 new MutationObserver(capture).observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:['hidden','class','data-phase','data-settled','data-kind','data-kid-draw']});
 setInterval(capture,40);window.__phaseCapture=capture;capture();
}

let browser,activePage,activeContext;
async function begin(mode,base,viewer=0){
 const current=structuredClone(base);current.phase='playing';current.players.forEach((p,id)=>{p.isCPU=id!==viewer;p.client={...p.client,name:'測試'+id,displayName:'測試'+id,avatar:id+1};});
 const room={state:current},id='PHASE-QA-'+mode.toUpperCase(),ctx=await browser.newContext({viewport:mode==='desktop'?{width:1366,height:768}:{width:740,height:360},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',userAgent:ua[mode],serviceWorkers:'block',reducedMotion:'reduce'});activeContext=ctx;
 await ctx.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;window.__phaseInputs=[];for(const type of ['pointerdown','pointerup','click'])window.addEventListener(type,e=>{const target=e.target,control=target.closest?.('#playHand,#playDrawn,#phoneCardConfirm,.phone-discard-stack,#modal button,#lawSwapOk');const item={type,trusted:e.isTrusted,pointer:e.pointerType||null,x:e.clientX,y:e.clientY,target:target.id||target.tagName,control:control?.id||control?.className||null,disabled:control?.disabled??null,canSend:control?window.CardPhonePresentation?.canSendPresentedAction?.(control):null};window.__phaseInputs.push(item);if(window.__phaseInputs.length>60)window.__phaseInputs.shift();queueMicrotask(()=>item.prevented=e.defaultPrevented);},true);});
 if(mode.startsWith('ios'))await ctx.addInitScript({content:specs[mode].bytes.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/__phase_retained/${mode}.css';document.head.append(l);},{once:true});`});
 const p=await ctx.newPage();activePage=p;p.setDefaultTimeout(16000);p.on('pageerror',error=>report.errors.push({case:report.activeCase,message:error.message}));const requests=[];p.on('request',r=>{const pathname=new URL(r.url()).pathname;if(pathname.endsWith('.css'))requests.push(pathname);});
 await p.goto(origin+'/game.html?room='+id+'&host='+mode,{waitUntil:'load'});
 await p.waitForFunction(()=>window.CardPhonePresentation?.resultCutinVersion>=3&&window.CardPhonePresentation?.avatarStatusRevealVersion>=2&&window.CardPhonePresentation?.pileClarityVersion>=1&&window.CardPhonePresentation?.rogerPredictionVersion>=1);
 await p.evaluate(({id,viewer})=>{me.roomId=id;me.playerId=viewer;me.secret='phase-qa';}, {id,viewer});
 if(room.state.venues.length)venue.begin(room);
 function visible(){return {...engine.getVisibleState(room.state,viewer),venueReady:venue.view(room),presentationReady:barrier.view(room)};}
 const stateOnly=async()=>p.evaluate(s=>window.__deliver('STATE',s),visible());
 const trace=async()=>p.evaluate(()=>{window.__phaseCapture?.();return window.__phaseTrace||[];});
 const idle=()=>p.waitForFunction(()=>{const legacy=document.getElementById('playedOverlay');return(!legacy||legacy.classList.contains('hidden'))&&!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy()&&(!CardPhonePresentation.isCardResolving?.()||!!state?.pending);},{}, {timeout:42000});
 const act=async(type,interact)=>{const before=await p.evaluate(()=>window.__sent.length);await interact();const handle=await p.waitForFunction(({before,type})=>window.__sent.slice(before).find(x=>x[0]==='ACTION'&&x[1].type===type)?.[1],{before,type});return await handle.jsonValue();};
 const click=locator=>mode==='desktop'?locator.click():locator.tap();
 const pick=async target=>{const button=p.locator(`#modal button[data-i="${target}"]`);if(await button.isVisible())return click(button);const seat=p.locator(`main #players>[data-seat-id="${target}"]`);await click(seat);};
 async function feed(action,{random}={}){
  const before=room.state,old=Math.random;let result;try{if(random!==undefined)Math.random=()=>random;result=intent.decorate(room,before,action,engine.applyAction(before,action));}finally{Math.random=old;}
  room.state=result.state;const gate=barrier.begin(room),events=result.emits.filter(e=>e.to==='all'||e.to===viewer);await p.evaluate(({events,s})=>{for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events,s:visible()});return {before,result,gate,events};
 }
 async function finish(step){
  await idle();const gate=step.gate;
  if(gate.waiting){const handle=await p.waitForFunction(id=>window.__sent.find(x=>x[0]==='ACTION'&&x[1].type==='PRESENTATION_READY'&&x[1].payload?.id===id)?.[1],gate.id);const ack=await handle.jsonValue();check('original presentation ACK '+gate.id,barrier.acknowledge(room,viewer,ack.payload));await stateOnly();await idle();}
 }
 await stateOnly();await p.waitForFunction(()=>document.documentElement.dataset.cardBoot==='ready',{},{timeout:28000});
 const legacyAtReady=await p.evaluate(()=>{const n=document.getElementById('playedOverlay');return !!n&&!n.classList.contains('hidden')&&n.getClientRects().length>0;});
 if(legacyAtReady)report.initialLegacyFlashes.push({case:report.activeCase,note:'A seeded first STATE with existing discard triggered the original playedOverlay. Waited for its own dismissal; did not hide it or change the fixture.'});
 if(venue.view(room)?.waiting){const button=p.locator('#phoneVenueContinue:not(:disabled)');await button.waitFor({state:'visible'});const packet=await act('VENUE_READY',()=>click(button));if(!venue.acknowledge(room,viewer,packet.payload))throw Error('Venue fixture ACK rejected');await stateOnly();await p.waitForFunction(()=>document.getElementById('phoneVenueIntro').hidden);}
 await idle();
 const styling=await p.evaluate(()=>({boot:document.documentElement.dataset.cardBoot,native:document.documentElement.dataset.cardBundledStyles,href:document.getElementById('cardMatchPresentationStyle')?.getAttribute('href')}));
 check('selected actual platform stylesheet and new APIs',styling.boot==='ready'&&(mode==='desktop'?styling.href?.includes('card-desktop-table.css'):styling.native==='1'&&styling.href?.includes('card-native-online.css')&&!requests.includes('/css/card-desktop-table.css')),styling);
 await p.evaluate(observeDom);
 return {p,ctx,room,viewer,mode,click,pick,act,feed,finish,trace,idle,stateOnly,visible};
}
const requireBefore=(rows,card,fragment,actual)=>{
 const c=opens(rows);check('one public pre-effect diagonal for '+card,c.length===1&&c[0].card===card&&c[0].phase==='before'&&c[0].text.includes(fragment)&&!c[0].privateOpen&&!c[0].lawOpen&&ordered(rows,'cutin-close',actual),rows);
};
async function closePrivate(h){const {p}=h;await p.locator('#phonePrivateReveal:not([hidden])').waitFor({state:'visible'});await p.waitForFunction(()=>!document.querySelector('#phoneCardFlights [data-kind="peek"]'));await h.click(p.locator('#phonePrivateDone'));}
async function chooseOwnHand(h){
 const find=()=>h.p.evaluate(()=>{const hand=document.getElementById('playHand'),r=hand?.getBoundingClientRect();if(!r)return{point:null};const left=Math.max(3,r.left),right=Math.min(innerWidth-3,r.right),top=Math.max(3,r.top),bottom=Math.min(innerHeight-3,r.bottom),blocks=[];const flags={disabled:hand.disabled,canSend:CardPhonePresentation.canSendPresentedAction?.(hand),width:innerWidth,height:innerHeight,handOpen:document.documentElement.dataset.handOpen||null};for(const ay of [.18,.34,.5,.66,.82])for(const ax of [.5,.33,.67,.16,.84]){const x=left+(right-left)*ax,y=top+(bottom-top)*ay,node=document.elementFromPoint(x,y);if(node?.closest('#playHand')===hand)return{point:{x,y},...flags};blocks.push(node?.id||node?.className?.baseVal||node?.className||node?.tagName||null);}return{point:null,rect:[r.x,r.y,r.width,r.height],pointerEvents:getComputedStyle(hand).pointerEvents,...flags,blocks:[...new Set(blocks)]};});
 const hit=await find();check('actual visible own hand hit target',!!hit.point,hit);const point=hit.point;
 if(h.mode==='desktop')await h.p.mouse.click(point.x,point.y);else{
  await h.p.touchscreen.tap(point.x,point.y);
  const raised=await h.p.evaluate(()=>document.documentElement.dataset.handOpen==='1');
  if(hit.handOpen!=='1'&&raised&&!await h.p.locator('#phoneCardSheet:not([hidden])').isVisible()){
   // Retained touch UI intentionally raises the fan on its first gesture.
   // Wait for the new hit area, then use a second actual touch on the same card.
   await h.p.waitForTimeout(300);const next=await find();check('first touch lifts fan; same card still has a real second touch target',next.handOpen==='1'&&!!next.point,next);await h.p.touchscreen.tap(next.point.x,next.point.y);
  }
 }
 await h.p.locator('#phoneCardSheet:not([hidden])').waitFor({state:'visible'});
}
const scenarios={
 async sabo(mode){const h=await begin(mode,fixture('card-0-normal/PLAY_CARD'));await chooseOwnHand(h);const action=await h.act('PLAY_CARD',()=>h.click(h.p.locator('#phoneCardConfirm')));const step=await h.feed(action);await h.finish(step);const rows=await h.trace();requireBefore(rows,0,'洗牌','pile-return');check('real return/shuffle/deal precede original STATE',ordered(rows,'pile-return','pile-shuffle')&&ordered(rows,'pile-shuffle','pile-deal')&&ordered(rows,'pile-deal',commit(step.gate.id)),rows);return h;},
 async usopp(mode){const h=await begin(mode,fixture('card-1-normal/PICK_DIGIT'));const action=await h.act('PICK_DIGIT',()=>h.click(h.p.locator('#modal button[data-d="4"]')));check('original Usopp number choice',action.payload.digit===4,action.payload);const step=await h.feed(action);await h.finish(step);const rows=await h.trace();check('original Usopp numeric diagonal still occurs without a generic card cut-in',opens(rows).length===0&&rows.some(x=>x.event==='sniper'&&x.text.includes('4')),rows);return h;},
 async robin(mode,viewer=0){const h=await begin(mode,fixture('card-2-normal/PICK_TARGET'),viewer);const action=viewer===0?await h.act('PICK_TARGET',()=>h.pick(1)):{type:'PICK_TARGET',playerId:0,payload:{target:1}};const step=await h.feed(action);
  if(viewer===0){await h.p.locator('#phonePrivateReveal:not([hidden])').waitFor({state:'visible'});const rows=await h.trace();requireBefore(rows,2,'查看','private-open');check('private reading still gates authoritative STATE',!rows.some(commit(step.gate.id)),rows);await closePrivate(h);}
  await h.finish(step);const rows=await h.trace();if(viewer!==0){requireBefore(rows,2,'查看',fx('scan'));check('observer sees no private sheet and receives no private card packet',!rows.some(x=>x.event==='private-open')&&!step.events.some(e=>e.type==='robin_view'||e.type==='peek'),rows);}return h;},
 async 'robin-observer'(mode){return scenarios.robin(mode,1);},
 async law(mode){const h=await begin(mode,fixture('card-6-enhanced/PICK_TARGET'));const action=await h.act('PICK_TARGET',()=>h.pick(1));check('original Law target sends preview only',action.payload.preview===true&&action.payload.target===1,action.payload);const preview=await h.feed(action);await h.p.locator('#lawSwapModal').waitFor({state:'visible'});await h.finish(preview);requireBefore(await h.trace(),6,'查看','law-open');const before=(await h.trace()).length;
  const swapAction=await h.act('PICK_TARGET',()=>h.click(h.p.locator('#lawSwapOk')));check('original Law confirm sends actual swap',swapAction.payload.swap===true&&swapAction.payload.target===1,swapAction.payload);const swap=await h.feed(swapAction);await h.finish(swap);const rows=(await h.trace()).slice(before);check('enhanced Law confirm swaps directly without another diagonal',opens(rows).length===0&&ordered(rows,fx('swap'),commit(swap.gate.id))&&swap.result.state.players[0].hand===swap.before.players[1].hand,rows);return h;},
 async luffy(mode){const h=await begin(mode,fixture('card-8-normal/PICK_TARGET'));for(const [type,target] of [['PICK_TARGET',1],['LUFFY_SECOND',2]]){const boundary=(await h.trace()).length,action=await h.act(type,()=>h.pick(target));check('original Luffy choice '+target,action.payload.target===target,action.payload);const step=await h.feed(action);await h.finish(step);const rows=(await h.trace()).slice(boundary);requireBefore(rows,8,'發起決鬥',fx('duel'));check('real duel receives actual chosen target '+target,rows.some(x=>x.event==='fx'&&x.kind==='duel'&&x.target===target)&&ordered(rows,fx('duel'),commit(step.gate.id)),rows);}return h;},
 async 'luffy-boost'(mode){
  // The ordinary STATE snapshot does not send the private confirmation prompt.
  // Start one action earlier and let the actual PLAY_CARD transaction deliver it.
  const initial=fixture('card-8-enhanced/PLAY_CARD');initial.players[0].tempDraw=9;initial.players[1].hand=5;initial.players[2].hand=15;initial.players[3].hand=6;initial.players[4].hand=16;initial.players[5].hand=7;
  const h=await begin(mode,initial);
  await chooseOwnHand(h);
  const play=await h.act('PLAY_CARD',()=>h.click(h.p.locator('#phoneCardConfirm')));
  const opening=await h.feed(play);
  await h.finish(opening);
  const prompt=h.p.locator('#luffyBoostModal');
  await prompt.waitFor({state:'visible'});
  check('real accepted enhanced play sends private confirmation only to its caster and no diagonal yet',opening.result.state.pending?.extra?.keep===9&&opening.events.some(e=>e.type==='luffy_boost_prompt'&&e.to===h.viewer)&&!opens(await h.trace()).length,opening.events.filter(e=>e.type==='luffy_boost_prompt'));
  const copy=await prompt.textContent();
  check('boost confirmation explains that only tails strictly below the threshold are eliminated',/尾數(?:嚴格)?(?:小於|低於)門檻/.test(copy)&&/等於門檻則留下/.test(copy),copy);
  const action=await h.act('LUFFY_BOOST_COMMIT',()=>h.click(h.p.locator('#luffyBoostGo')));
  check('actual enhanced confirmation sends literal go:true',action.payload.go===true,action.payload);
  const step=await h.feed(action);
  await h.finish(step);
  const rows=await h.trace();
  requireBefore(rows,8,'全體玩家',commit(step.gate.id));
  check('one real global presentation eliminates 5/15, keeps 6/16/7 and draws once without fake duels',!rows.some(fx('duel'))&&!h.room.state.players[1].alive&&!h.room.state.players[2].alive&&h.room.state.players.slice(3).every(p=>p.alive)&&h.room.state.discard.includes(8)&&h.room.state.discard.includes(9)&&h.room.state.deck.length===step.before.deck.length-1,rows);
  return h;
 },
 async kid(mode){const h=await begin(mode,fixture('card-11-normal/PLAY_CARD'));await chooseOwnHand(h);await h.click(h.p.locator('#phoneCardConfirm'));
  const pile=h.p.locator('.phone-discard-stack[data-kid-draw="ready"]');await pile.waitFor({state:'visible'});const rows=await h.trace();requireBefore(rows,11,'洗棄牌','pile-shuffle');check('Kid shuffles only backs, then waits without submitting',rows.some(x=>x.event==='pile-shuffle'&&x.images===6&&x.backs)&&ordered(rows,'pile-shuffle','pile-pick')&&await h.p.evaluate(()=>!window.__sent.some(x=>x[0]==='ACTION'&&x[1].type==='PLAY_CARD')),rows);
  const action=await h.act('PLAY_CARD',()=>h.click(pile));check('actual discard tap sends exactly original hand PLAY_CARD',action.payload.which==='hand'&&await h.p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION'&&x[1].type==='PLAY_CARD').length===1),action.payload);const step=await h.feed(action);await h.finish(step);const final=await h.trace();check('own accepted Kid does not replay its local diagonal and original draw is committed',opens(final).filter(x=>x.card===11).length===1&&h.room.state.turnStep==='choose'&&h.room.state.players[0].tempDraw!=null&&final.some(commit(step.gate.id)),final);return h;},
 async killer(mode,decline=false){const start=fixture('card-13-enhanced/PICK_TARGET');start.players[1].protected=true;const h=await begin(mode,start);const action=await h.act('PICK_TARGET',()=>h.pick(1));check('Killer first click is disarm and cannot open premature confirm',action.payload.target===1&&action.payload.duel!==true&&!await h.p.locator('#yesBtn').isVisible(),action.payload);const disarm=await h.feed(action);await h.finish(disarm);await h.p.locator('#yesBtn').waitFor({state:'visible'});const rows=await h.trace();requireBefore(rows,13,'解除',fx('break'));check('Killer confirm only after original disarm and authoritative commit',ordered(rows,fx('break'),commit(disarm.gate.id))&&ordered(rows,commit(disarm.gate.id),'confirm-open')&&!opens(rows)[0].confirmOpen,rows);
  const next=await h.act(decline?'PICK_CANCEL':'PICK_TARGET',()=>h.click(h.p.locator(decline?'#noBtn':'#yesBtn')));const boundary=(await h.trace()).length;if(!decline)check('Killer second click is real duel confirmation',next.payload.duel===true&&next.payload.target===1,next.payload);const step=await h.feed(next);await h.finish(step);const after=(await h.trace()).slice(boundary);if(decline)check('Killer cancel has no second cut-in or duel',!opens(after).length&&!after.some(fx('duel')),after);else requireBefore(after,13,'發起決鬥',fx('duel'));return h;},
 async 'killer-cancel'(mode){return scenarios.killer(mode,true);},
 async mom(mode){const tails=mode==='ios58',h=await begin(mode,fixture('14-'+(tails?'tails':'heads')+'/BIGMOM_COIN'));const action=await h.act('BIGMOM_COIN',()=>h.click(h.p.locator('#okBtn')));const step=await h.feed(action,{random:tails ? .9 : .1});await h.finish(step);const rows=await h.trace(),badge='badge-'+(tails?'dodging':'protected')+'-open',cut=opens(rows)[0];check('true Big Mom coin settles before one after-result diagonal and original portrait status',opens(rows).length===1&&cut.phase==='after'&&cut.text.includes(tails?'獲得閃避':'獲得護盾保護')&&ordered(rows,'coin-settled-open','cutin-open')&&ordered(rows,'cutin-close',fx('guard'))&&ordered(rows,fx('guard'),badge)&&ordered(rows,'cutin-close',commit(step.gate.id)),rows);return h;},
 async kata(mode){const h=await begin(mode,fixture('card-15-normal/PLAY_CARD'));await chooseOwnHand(h);const action=await h.act('PLAY_CARD',()=>h.click(h.p.locator('#phoneCardConfirm')));const step=await h.feed(action);await h.p.locator('#phonePrivateReveal:not([hidden])').waitFor({state:'visible'});const rows=await h.trace();requireBefore(rows,15,'查看未來','private-open');check('public future cue contains no private card face or order',!opens(rows)[0].text.match(/\d+\s*號卡/)&&!rows.some(commit(step.gate.id)),rows);await closePrivate(h);await h.finish(step);check('closing original Kata reader never adds another diagonal',opens(await h.trace()).length===1);return h;},
 async roger(mode){const h=await begin(mode,fixture('card-19-enhanced/PICK_TARGET'));check('no prediction marker before accepted target',await h.p.locator('.phone-roger-prediction').count()===0);const action=await h.act('PICK_TARGET',()=>h.pick(1));const step=await h.feed(action);await h.finish(step);const rows=await h.trace(),mark=rows.find(x=>x.event==='prediction-open');requireBefore(rows,19,'預測',commit(step.gate.id));check('actual selected portrait marker appears only after committed prediction',opens(rows)[0].marks===0&&ordered(rows,commit(step.gate.id),'prediction-open')&&mark?.target===1&&mark.inside&&await h.p.locator('.phone-roger-prediction[data-player-id="1"]').count()===1,rows);return h;},
 async defense(mode){const h=await begin(mode,fixture('5-protected/PICK_TARGET'));const action=await h.act('PICK_TARGET',()=>h.pick(1));const step=await h.feed(action);await h.finish(step);const rows=await h.trace();check('actual shield block survives without diagonal or invented slash',opens(rows).length===0&&rows.some(fx('shield-block'))&&!rows.some(fx('slash'))&&h.room.state.players[1].alive,rows);return h;},
 async cancel(mode){const h=await begin(mode,fixture('card-5-normal/PICK_TARGET'));await h.p.evaluate(()=>{const api=CardPhonePresentation,original=api.loadCardArt;let first=true;api.loadCardArt=async function(kind,id){const art=await original.call(this,kind,id);if(first&&kind==='anime'&&id===5){first=false;window.__qaDecodedArt=!!art;await new Promise(resolve=>window.__qaReleaseLateArt=resolve);window.__qaLateArtDelivered=true;}return art;};});const action=await h.act('PICK_TARGET',()=>h.pick(1));const step=await h.feed(action);
  await h.p.waitForFunction(()=>typeof window.__qaReleaseLateArt==='function');check('probe holds genuine decoded art before original overlay',await h.p.evaluate(()=>window.__qaDecodedArt===true)&&opens(await h.trace()).length===0);await h.p.evaluate(({viewer,id})=>{window.__deliver('disconnect');window.__deliver('JOINED',{playerId:viewer,roomId:id,secret:'phase-qa'});},{viewer:h.viewer,id:'PHASE-QA-'+mode.toUpperCase()});await h.stateOnly();await h.p.evaluate(()=>window.__qaReleaseLateArt());await h.p.waitForFunction(()=>window.__qaLateArtDelivered===true);await h.finish(step);await h.p.waitForTimeout(300);const rows=await h.trace();check('reconnect and late old decoded art cannot reopen a stale diagonal',opens(rows).length===0&&rows.some(commit(step.gate.id)),rows);return h;}
};
const matrix={desktop:['sabo','law','killer','roger','usopp','defense'],android:['robin','luffy','kid','mom','cancel'],ios:['robin-observer','kata','roger','mom','luffy-boost'],ios58:['law','kid','killer-cancel','defense','roger']};
const requestedCases=(process.env.CARD_CUTIN_RUNTIME_CASES||'').split(',').map(value=>value.trim()).filter(Boolean);
try{
 for(const mode of modes){
  browser=mode.startsWith('ios')?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
  for(const key of (requestedCases.length?requestedCases:matrix[mode])){
   if(!scenarios[key])throw Error('Unknown runtime scenario '+key);report.activeCase=mode+'/'+key;const started=Date.now(),h=await scenarios[key](mode),trace=await h.trace();
   check('no page exceptions',!report.errors.some(e=>e.case===report.activeCase),report.errors.filter(e=>e.case===report.activeCase));report.cases.push({mode,key,elapsedMs:Date.now()-started,trace});save();await h.ctx.close();activePage=activeContext=null;
   console.log(JSON.stringify({case:report.activeCase,passed:true,elapsedMs:Date.now()-started}));
  }
  await browser.close();browser=null;
 }
 check('all frozen product bytes unchanged',report.source.every(x=>sha(fs.readFileSync(path.join(root,x.file)))===x.sha256),report.source);
 check('canonical module unchanged throughout integration',sha(fs.readFileSync(resultFile))===report.resultModule.sha256,report.resultModule);
 report.passed=true;
}catch(error){report.failure=error.stack;if(activePage)try{report.failureState=await activePage.evaluate(()=>({boot:document.documentElement.dataset.cardBoot,flowBusy:document.documentElement.dataset.cardFlowBusy,handOpen:document.documentElement.dataset.handOpen,queue:CardPhonePresentation?.presentationQueueSize?.(),kidAwaiting:CardPhonePresentation?.isKidAwaiting?.(),pending:state?.pending?.action||null,turn:state?.turnIndex,viewer:me?.playerId,trace:window.__phaseTrace||[],input:window.__phaseInputs||[],sent:window.__sent.filter(x=>x[0]==='ACTION').map(x=>x[1]?.type)}));}catch{}process.exitCode=1;}
finally{await activeContext?.close();await browser?.close();for(const socket of sockets)socket.destroy();await new Promise(resolve=>server.close(resolve));save();console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cases:report.cases.length,errors:report.errors,failure:report.failure,report:path.join(out,'report.json')}));}
