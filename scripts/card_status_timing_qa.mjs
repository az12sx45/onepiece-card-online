import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import vm from 'node:vm';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';

const require=createRequire(import.meta.url),engine=require(rootPath('server/engine.js'));
function rootPath(file){return path.resolve(import.meta.dirname,'..',file);}
const root=rootPath(''),mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const cases=require(rootPath('scripts/card_all_effect_cases.js')).buildCases();
const source=fs.readFileSync(mobile+'/android/web/card-status-reveal.js','utf8');
const baseline=process.env.STATUS_QA_BASELINE==='1',baselineCommit='45602234069809a36c17fca0cc971144919df425';
const modes=(process.env.STATUS_QA_MODES||'desktop,android,ios,ios58').split(',');
const out=process.env.STATUS_QA_OUT||'D:/Codex_QA/card-status-timing-20261103/'+(baseline?'baseline':'final');
fs.mkdirSync(out,{recursive:true});
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','public/css/card-native-online.css','server/engine.js'];
const frozen=new Map(files.map(file=>[file,baseline?execFileSync('git',['show',baselineCommit+':'+file],{cwd:root,maxBuffer:64*1024*1024}):fs.readFileSync(rootPath(file))]));
const report={passed:false,baseline,baselineCommit:baseline?baselineCommit:null,scope:'Engine/decorator-produced public status events with current integrated Card runtime, or explicitly identified historical baseline. Exact retained mobile UI bundles. Local isolated Socket.IO fixtures; no private hand reads, physical-device, account or public-server acceptance.',checks:[],errors:[],traces:{},source:files.map(file=>({file,bytes:frozen.get(file).length,sha256:sha(frozen.get(file))})),moduleSha256:sha(source)};
const save=()=>fs.writeFileSync(out+'/report.json',JSON.stringify(report,null,2));
function check(name,pass,detail){report.checks.push({name,pass,detail});if(!pass||report.checks.length%5===0)save();if(!pass)throw Error(name+': '+JSON.stringify(detail));}

async function unit(){
 const delivered=[],listeners={},docListeners={};let unblock;
 const api={presentCardSkillBatch:async()=>17,presentEffectEvent:e=>delivered.push(e),presentPileBatch:async()=>{await new Promise(r=>unblock=r);return 23;},cancelCardSkillIntro:()=>29,isEffectBusy:()=>false};
 const document={readyState:'complete',hidden:false,addEventListener:(name,fn)=>(docListeners[name]??=[]).push(fn)};
 const context=vm.createContext({window:{CardPhonePresentation:api,__TABLETOP_ANDROID_TEST_ORIGIN:'http://status-fixture'},location:{origin:'http://status-fixture',pathname:'/game.html'},document,me:{roomId:'UNIT',playerId:0},state:{roundNo:1},socket:{on:(name,fn)=>(listeners[name]??=[]).push(fn)},setTimeout:fn=>fn()});
 vm.runInContext(source,context);check('unit status compatibility owner mounts once',api.avatarStatusRevealVersion===1);const fn=api.presentEffectEvent;vm.runInContext(source,context);check('unit second module evaluation leaves original wrappers intact',api.presentEffectEvent===fn);
 const event=(type='bigmom_status',status='protect')=>({to:'all',type,status,casterId:0});
 let e=event(),block={to:'all',type:'card_defense',casterId:1,targetId:0,status:'protect'};
 await api.presentCardSkillBatch([e,block]);api.presentEffectEvent(e);api.presentEffectEvent(block);
 check('unit acquired defense is held but actual defense block is immediate',delivered.length===1&&delivered[0]===block&&api.avatarStatusRevealPending()===1);
 check('unit held acquisition does not make the original effect queue busy',api.isEffectBusy()===false);
 let done=false;const p=api.presentPileBatch([e,block],{}).then(x=>{done=x;});await Promise.resolve();check('unit acquisition remains held until original pile/result promise resolves',delivered.length===1&&!done);unblock();await p;
 check('unit original result value is retained and acquisition is then delivered once',done===23&&delivered.at(-1)===e&&delivered.length===2&&api.avatarStatusRevealPending()===0);
 e=event('chopper_status','dodge');await api.presentCardSkillBatch([e]);api.presentEffectEvent(e);let q=api.presentPileBatch([e],{});check('unit direct cancel retains original return value',api.cancelCardSkillIntro()===29);unblock();await q;check('unit canceled cut-in cannot deliver its held acquisition',!delivered.includes(e)&&api.avatarStatusRevealPending()===0);
 for(const reset of ['JOINED','disconnect','hidden']){
  e=event();await api.presentCardSkillBatch([e]);api.presentEffectEvent(e);q=api.presentPileBatch([e],{});
  if(reset==='hidden'){document.hidden=true;for(const cb of docListeners.visibilitychange||[])cb();}else for(const cb of listeners[reset]||[])cb();
  unblock();await q;check('unit '+reset+' discards old held visuals without blocking the result',!delivered.includes(e)&&api.avatarStatusRevealPending()===0);document.hidden=false;
 }
 e=event();api.presentEffectEvent(e);check('unit status event outside an accepted batch keeps its original immediate route',delivered.at(-1)===e);
 const a=event(),b=event();await api.presentCardSkillBatch([a,b]);api.presentEffectEvent(a);api.presentEffectEvent(b);q=api.presentPileBatch([a,b],{});unblock();await q;check('unit duplicate acquisition in one accepted transaction is delivered once',delivered.filter(x=>x===a||x===b).length===1);
 const privateEvent={...event(),to:2};await api.presentCardSkillBatch([privateEvent]);api.presentEffectEvent(privateEvent);check('unit private event is not collected or reclassified as public status',api.avatarStatusRevealPending()===0&&delivered.at(-1)===privateEvent);
}
const bundles={
 android:{root:mobile+'/android/app/src/main/assets/mobile',jsSha:'583b21edddae3e0ebc2ec464282e96cd680196215d2758546d3ac99fc6bfb5a5',cssSha:'8348d1e9c0b0a27ca2e3e06457b3a883e17159b7796b2334041c446aa96cf3b2'},
 ios:{root:'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile',jsSha:'15567712b4b30f5587bc44ea6c9fcec3932cd5dabe19be7f4c295ce46d051b2b',cssSha:'a21a4361ee5cd306c6c97f9b3e62266b9d902d466ab7e3137e874b7e2948acf0'},
 ios58:{root:'D:/Codex_QA/card-native-update-diagnosis-20261101/ios-v058',jsSha:'3d3d650fadc0eb39e473767f6cbf5542f45c5eb35fe9b17c65b76533e6b20026',cssSha:'1bbb58d0aef4c2169e6e77677ba21ba96f3d2b8409aa138a8c6285c0cc61e55a'}
};
const uas={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1',android:'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)',ios:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)'};uas.ios58=uas.ios;
const stub=`window.__sent=[];window.__handlers={};window.__deliver=(name,data)=>{for(const cb of [...(window.__handlers[name]||[])])cb(data)};window.io=()=>({connected:true,id:'status-qa',on(name,cb){(window.__handlers[name]??=[]).push(cb);return this},once(){return this},listeners(name){return [...(window.__handlers[name]||[])]},off(name,fn){window.__handlers[name]=(window.__handlers[name]||[]).filter(x=>x!==fn);return this},emit(...args){window.__sent.push(args);return this},disconnect(){},connect(){}});`;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
let server,origin,browser,page;const sockets=new Set();
async function startServer(){
 for(const mode of modes.filter(x=>x!=='desktop')){const b=bundles[mode];b.js=fs.readFileSync(b.root+'/game-mobile.js');b.css=fs.readFileSync(b.root+'/game-mobile.css');check(mode+' exact retained JS identity',sha(b.js)===b.jsSha);check(mode+' exact retained CSS identity',sha(b.css)===b.cssSha);}
 server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),b=u.pathname.match(/^\/__status_bundle\/(android|ios58|ios)\.(js|css)$/);if(b){res.writeHead(200,{'content-type':mime['.'+b[2]]}).end(bundles[b[1]][b[2]]);return;}if(u.pathname.includes('socket.io.min.js')){res.writeHead(200,{'content-type':mime['.js']}).end(stub);return;}if(/\.(mp3|mp4|ogg|wav|webm|m4a)$/i.test(u.pathname)){res.writeHead(204).end();return;}const relative=decodeURIComponent(u.pathname).slice(1),file=path.resolve(root,'public',relative);if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}try{let data=frozen.get('public/'+relative)||fs.readFileSync(fs.existsSync(file)?file:path.join(mobile,'public',relative));if(relative==='game.html'&&u.searchParams.get('bundle')==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__status_bundle/android.css"><script src="/__status_bundle/android.js"></script>'));res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}});
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});await new Promise(r=>server.listen(0,'127.0.0.1',r));origin='http://127.0.0.1:'+server.address().port;
}
async function setup(mode,c,viewer){
 const ctx=await browser.newContext({viewport:mode==='desktop'?{width:1366,height:768}:{width:740,height:360},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',userAgent:uas[mode],serviceWorkers:'block'});await ctx.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
 await ctx.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;window.__qaHidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__qaHidden});Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>window.__qaHidden?'hidden':'visible'});HTMLMediaElement.prototype.play=function(){return Promise.resolve();};});
 if(mode.startsWith('ios'))await ctx.addInitScript({content:bundles[mode].js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const l=document.createElement('link');l.rel='stylesheet';l.href='/__status_bundle/${mode}.css';document.head.append(l);},{once:true});`});
 const p=await ctx.newPage();page=p;p.setDefaultTimeout(18000);p.on('pageerror',e=>report.errors.push({mode,message:e.message}));await p.goto(origin+'/game.html?bundle='+mode,{waitUntil:'load'});await p.waitForFunction(()=>window.CardPhonePresentation?.resultCutinVersion>=1&&typeof window.CardPhonePresentation.presentEffectEvent==='function');
 if(!baseline)await p.waitForFunction(()=>CardPhonePresentation.avatarStatusRevealVersion===1);
 const state=engine.getVisibleState({...structuredClone(c.before),phase:'playing',venues:[]},viewer);
 await p.evaluate(({s,viewer})=>{me.roomId='STATUS-QA';me.playerId=viewer;me.secret='status-fixture';state=s;render();hideModal();window.__sent=[];},{s:state,viewer});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 await p.evaluate(()=>{
  window.__statusTrace=[];let signature='';
  function sample(){const node=CardPhonePresentation.playerVisualElement?.(0),cutin=!!document.querySelector('.card-anime-skill[data-result-cutin="true"]'),row=node?.querySelector('.phone-seat-status'),value={at:performance.now(),cutin,guardIcons:document.querySelectorAll('#phoneInteractionFx .phone-hud-defense').length,kind:document.getElementById('phoneInteractionFx')?.dataset.kind,protected:!!row?.querySelector('[data-status="protected"]'),dodging:!!row?.querySelector('[data-status="dodging"]'),modelProtected:!!state?.players?.[0]?.protected,modelDodging:!!state?.players?.[0]?.dodging,coin:!!CardPhonePresentation.isCoinBusy?.(),held:CardPhonePresentation.avatarStatusRevealPending?.()||0};const key=JSON.stringify({...value,at:0});if(key!==signature){signature=key;window.__statusTrace.push(value);}requestAnimationFrame(sample);}requestAnimationFrame(sample);
 });
 return {ctx,p};
}
const sample=label=>{const c=cases.find(c=>c.label===label);if(!c)throw Error('Missing actual engine fixture '+label);return c;};
async function send(p,c,viewer){await p.evaluate(({events,s})=>{for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:c.events.filter(e=>e.to==='all'||e.to===viewer),s:engine.getVisibleState({...structuredClone(c.state),phase:'playing',venues:[]},viewer)});}
async function settled(p){await p.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.isCardSkillIntroBusy?.(),{},{timeout:40000});await p.waitForTimeout(150);}
async function timeline(mode,label,viewer,action='normal'){
 const c=sample(label),status=c.events.find(e=>['bigmom_status','chopper_status'].includes(e.type))?.status;if(!status)throw Error('Missing actual acquired defense '+label);
 const {ctx,p}=await setup(mode,c,viewer);await send(p,c,viewer);await p.waitForSelector('.card-anime-skill[data-result-cutin="true"]',{timeout:30000});await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 let t=await p.evaluate(()=>window.__statusTrace);const before=t.filter(x=>!x.cutin),during=t.at(-1);
 if(baseline){check(mode+' historical baseline reproduces acquired avatar defense before diagonal result',before.some(x=>x.guardIcons>0),t);report.traces[mode+'/'+label]=t;await ctx.close();page=null;return;}
 check(mode+' '+label+' avatar acquisition icon does not appear before result cut-in',!t.some(x=>x.guardIcons>0),t);
 check(mode+' '+label+' persistent avatar badges retain the prior committed state during cut-in',!during.protected&&!during.dodging&&!during.modelProtected&&!during.modelDodging,during);
 check(mode+' '+label+' accepted status is held without preventing the cut-in',await p.evaluate(()=>CardPhonePresentation.avatarStatusRevealPending()>0));
 if(action==='cancel')await p.evaluate(()=>CardPhonePresentation.cancelCardSkillIntro());
 else if(action==='hidden'){await p.evaluate(()=>{window.__qaHidden=true;document.dispatchEvent(new Event('visibilitychange'));});await p.waitForTimeout(150);await p.evaluate(()=>{window.__qaHidden=false;document.dispatchEvent(new Event('visibilitychange'));});}
 else if(action==='reconnect'){await p.evaluate(()=>window.__deliver('disconnect'));await p.waitForTimeout(120);await p.evaluate(s=>{window.__deliver('JOINED',{playerId:0,secret:'status-fixture'});window.__deliver('STATE',s);},engine.getVisibleState({...structuredClone(c.state),phase:'playing',venues:[]},viewer));}
 await settled(p);t=await p.evaluate(()=>window.__statusTrace);report.traces[mode+'/'+label+'/'+viewer+'/'+action]=t;
 const started=t.findIndex(x=>x.cutin),ended=t.find((x,i)=>i>started&&!x.cutin),firstGuard=t.find(x=>x.guardIcons>0),firstBadge=t.find(x=>status==='protect'?x.protected:x.dodging);
 if(action==='normal')check(mode+' '+label+' original acquisition FX starts only after diagonal ended',!!ended&&!!firstGuard&&firstGuard.at>=ended.at,{ended,firstGuard});
 else check(mode+' '+action+' does not replay discarded held status FX',!firstGuard,t);
 check(mode+' '+label+' final authoritative badge appears after result cut-in release',!!ended&&!!firstBadge&&firstBadge.at>=ended.at,{ended,firstBadge});
 check(mode+' '+label+' final public state and visible avatar badge agree',await p.evaluate(status=>{const row=CardPhonePresentation.playerVisualElement(0)?.querySelector('.phone-seat-status'),field=status==='protect'?'protected':'dodging';return !!state.players[0][field]&&!!row?.querySelector('[data-status="'+field+'"]')&&CardPhonePresentation.avatarStatusRevealPending()===0;},status));
 check(mode+' '+label+' presentation changes send no game ACTION',await p.evaluate(()=>!window.__sent.some(x=>x[0]==='ACTION')),await p.evaluate(()=>window.__sent.filter(x=>x[0]==='ACTION').map(x=>x[1].type)));
 await ctx.close();page=null;
}
async function realBlock(mode){const c=sample('1-protected/PICK_TARGET'),{ctx,p}=await setup(mode,c,0);await send(p,c,0);await p.waitForSelector('#phoneInteractionFx .phone-hud-defense[data-status="protect"]',{timeout:15000});check(mode+' actual public shield block still plays its original portrait effect',true);check(mode+' real defense block is never collected as an acquired status',await p.evaluate(()=>CardPhonePresentation.avatarStatusRevealPending()===0));await settled(p);await ctx.close();page=null;}

try{
 await unit();
 if(process.env.STATUS_QA_ONLY_UNIT!=='1'){
  await startServer();
  for(const mode of modes){browser=mode.startsWith('ios')?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
   if(baseline)await timeline(mode,'14-heads/BIGMOM_COIN',0);
   else{
    await timeline(mode,'14-heads/BIGMOM_COIN',0);await timeline(mode,'14-tails/BIGMOM_COIN',1);
    if(mode==='desktop'){await timeline(mode,'card-4-normal/PLAY_CARD',0);await timeline(mode,'14-heads/BIGMOM_COIN',0,'cancel');await timeline(mode,'14-tails/BIGMOM_COIN',0,'hidden');await timeline(mode,'14-heads/BIGMOM_COIN',0,'reconnect');await realBlock(mode);}
   }
   check(mode+' no page exceptions',!report.errors.some(x=>x.mode===mode),report.errors);await browser.close();browser=null;save();
  }
 }
 if(!baseline)check('all integrated product bytes remain unchanged throughout status QA',report.source.every(x=>sha(fs.readFileSync(rootPath(x.file)))===x.sha256),report.source);report.passed=true;
}catch(e){report.failure=e.stack;process.exitCode=1;if(page)try{report.failureState=await page.evaluate(()=>({trace:window.__statusTrace,queued:CardPhonePresentation.presentationQueueSize?.(),busy:CardPhonePresentation.presentationEffectsBusy?.(),held:CardPhonePresentation.avatarStatusRevealPending?.()}));await page.screenshot({path:out+'/failure.png'});}catch{}}
finally{await browser?.close();for(const s of sockets)s.destroy();if(server)await new Promise(r=>server.close(r));save();console.log(JSON.stringify({passed:report.passed,baseline,checks:report.checks.length,errors:report.errors,failure:report.failure,report:out+'/report.json'}));}
