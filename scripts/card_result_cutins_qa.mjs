import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import http from 'node:http';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(import.meta.url),engine=require('../server/engine.js'),decorate=require('../server/card_skill_intent.js').decorate;
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(import.meta.dirname,'..'),mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const mode=process.env.PO_QA_MODE||'android',output=process.env.PO_QA_OUT||'D:/Codex_QA/card-result-cutins-20261103/'+mode;fs.mkdirSync(output,{recursive:true});
const report={scope:'Real engine/decorator fixtures for all Card operations; exact retained v063 presentation plus online HTML. Isolated browser, no real-account or physical-device acceptance.',checks:[],errors:[],cases:[]};
const check=(name,pass,detail)=>{report.checks.push({name,pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));};
const source=fs.readFileSync(mobile+'/android/web/card-result-cutins.js','utf8'),cases=require('./card_all_effect_cases.js').buildCases();
const tracked=['public/game.html','public/js/card-desktop-table.js','public/css/card-desktop-table.css','public/css/card-native-online.css'];
report.source=tracked.map(file=>{const bytes=fs.readFileSync(root+'/'+file);return{file,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};});
report.resultModule={file:mobile+'/android/web/card-result-cutins.js',bytes:Buffer.byteLength(source),sha256:createHash('sha256').update(source).digest('hex')};
const api={},early=[];
const sandbox=vm.createContext({state:null,window:{CardPhonePresentation:api,__TABLETOP_ANDROID_TEST_ORIGIN:'http://fixture'},location:{origin:'http://fixture',pathname:'/game.html'},document:{readyState:'complete',addEventListener(){}},socket:{on(){}},setTimeout:fn=>fn(),pname:id=>'Audit'+id});
api.presentCardSkillBatch=async events=>{early.push(events);return null;};
vm.runInContext(source,sandbox);
let server,browser,activePage;
function sample(label){const c=cases.find(c=>c.label===label);if(!c)throw Error('Missing fixture '+label);return c;}
function zoro(id,enhanced){const base=structuredClone(sample('card-5-'+(enhanced?'enhanced':'normal')+'/PICK_TARGET').before);base.players[1].hand=id;const action={type:'PICK_TARGET',playerId:0,payload:{target:1}},result=decorate({state:base},base,action,engine.applyAction(base,action));return {label:'Zoro '+id,before:base,state:result.state,events:result.emits};}
function redundantNami(){const before=structuredClone(sample('card-7-enhanced/PICK_TARGET').before);before.players[1].skipNext=true;const action={type:'PICK_TARGET',playerId:0,payload:{target:1}},result=decorate({state:before},before,action,engine.applyAction(before,action));return{label:'already-paralyzed-Nami',before,state:result.state,events:result.emits};}
function queenContinuations(first){const result=[],room={state:structuredClone(first.state)},random=Math.random;try{for(const face of [.9,.1]){Math.random=()=>face;const before=room.state,action={type:'QUEEN_COIN',playerId:before.pending.target},next=decorate(room,before,action,engine.applyAction(before,action));room.state=next.state;result.push({before,state:next.state,events:next.emits});}const before=room.state,action={type:'DRAW',playerId:before.turnIndex},next=decorate(room,before,action,engine.applyAction(before,action));result.push({before,state:next.state,events:next.emits,automatic:true});}finally{Math.random=random;}return result;}
try{
 for(const c of cases){
  sandbox.state=engine.getVisibleState(c.before,0);
  const next=engine.getVisibleState(c.state,0),publicNext={roundNo:next.roundNo,pending:next.pending,log:next.log,players:next.players.map(({id,alive,skipNext})=>({id,alive,skipNext}))};
  const result=api.cardResultSummary([...c.events,{to:0,type:'peek',lines:['PRIVATE_SENTINEL_42'],cardId:19}],publicNext);
  await api.presentCardSkillBatch(c.events);
  const expected=c.events.filter(e=>e.type!=='card_skill_intent');
  check(c.label+' early wrapper retains all real movies/effects but no diagonal declaration',JSON.stringify(early.at(-1))===JSON.stringify(expected));
  check(c.label+' result never reads a private event',!result?.result.includes('PRIVATE_SENTINEL_42'));
  if(c.events.some(e=>e.type==='card_skill_intent')){
   const intent=c.events.find(e=>e.type==='card_skill_intent');
   const unfinished=intent.mode==='demand'&&c.state.pending?.action==='bigmom-pay'||intent.cardId===6&&intent.mode==='view'&&c.state.pending?.action==='law';
   const noEffect=c.label==='card-7-normal/PLAY_CARD';
   // These real fixtures exercise a blocked single-target operation, not a
   // successful all-player operation with some protected targets.
   const blocked=/^(3|5|6|8|14)-(protected|dodging)\/PICK_TARGET$/.test(c.label);
   const continuation=intent.cardId===14&&['pay','decline'].includes(intent.mode);
   check(c.label+' only supported successful outcomes get a result cut-in',unfinished||noEffect||blocked||continuation?result===null:!!result?.result,{result:result?.result,unfinished,blocked,continuation});
  }
 }
 for(const [label,text]of [['14-heads/BIGMOM_COIN','護盾'],['14-tails/BIGMOM_COIN','閃避'],['12-heads/QUEEN_COIN','正面'],['12-tails/QUEEN_COIN','反面']]){const c=sample(label);sandbox.state=c.before;check(label+' public backend result is used',api.cardResultSummary(c.events,c.state)?.result.includes(text));}
 for(const label of ['bigmom-pay/BIGMOM_CHOICE','bigmom-die/BIGMOM_CHOICE']){const c=sample(label);sandbox.state=c.before;check(label+' target choice is not another card result',api.cardResultSummary(c.events,c.state)===null);}
 for(const id of [0,17]){const c=zoro(id,true);sandbox.state=c.before;check('Zoro explicit backend card '+id,api.cardResultSummary(c.events,c.state)?.result.includes(id+' 號卡'));}
 report.engineFixtures=cases.length;
 if(process.env.PO_QA_UNIT_ONLY){check('classifier product sources remain unchanged',report.source.every(x=>createHash('sha256').update(fs.readFileSync(root+'/'+x.file)).digest('hex')===x.sha256),report.source);report.passed=true;}
 else{
  const socketStub=`window.__sent=[];window.__handlers={};window.__any=[];window.__deliver=(n,d)=>{for(const f of window.__any)f(n,d);for(const f of [...(window.__handlers[n]||[])])f(d)};window.io=()=>({connected:true,id:'cutin-fixture',on(n,f){(window.__handlers[n]??=[]).push(f);return this},onAny(f){window.__any.push(f);return this},once(){return this},listeners(n){return [...(window.__handlers[n]||[])]},off(n,f){window.__handlers[n]=(window.__handlers[n]||[]).filter(x=>x!==f);return this},emit(...a){window.__sent.push(a);return this},disconnect(){},connect(){}});`;
  const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml'};
  const bundleRoot=mode==='desktop'?null:mode==='ios'?'D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile':mobile+'/android/app/src/main/assets/mobile';
  const bundle=bundleRoot?{js:fs.readFileSync(bundleRoot+'/game-mobile.js'),css:fs.readFileSync(bundleRoot+'/game-mobile.css')}:{js:fs.readFileSync(root+'/public/js/card-desktop-table.js'),css:fs.readFileSync(root+'/public/css/card-desktop-table.css')};
  report.bundle={kind:mode,source:bundleRoot||root+'/public',jsBytes:bundle.js.length,cssBytes:bundle.css.length,jsSha256:createHash('sha256').update(bundle.js).digest('hex'),cssSha256:createHash('sha256').update(bundle.css).digest('hex'),htmlSha256:createHash('sha256').update(fs.readFileSync(root+'/public/game.html')).digest('hex')};
  server=http.createServer((req,res)=>{const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname),file=path.resolve(root,'public','.'+name);
   if(name==='/__bundle.js'||name==='/__bundle.css'){const ext=name.endsWith('js')?'js':'css';res.writeHead(200,{'content-type':mime['.'+ext]}).end(bundle[ext]);return;}
   if(!file.startsWith(path.join(root,'public')+path.sep)){res.writeHead(403).end();return;}
   if(name.includes('socket.io.min.js')){res.writeHead(200,{'content-type':'application/javascript'}).end(socketStub);return;}
   if(/\.(mp3|mp4|ogg|wav|webm|m4a|qa-disabled)$/i.test(name)){res.writeHead(204).end();return;}
   try{const ext=path.extname(file);let data=fs.readFileSync(fs.existsSync(file)?file:path.join(mobile,'public',path.relative(path.join(root,'public'),file)));if(name==='/game.html'&&mode==='android')data=Buffer.from(data.toString().replace(/<head([^>]*)>/i,'<head$1><link rel="stylesheet" href="/__bundle.css"><script src="/__bundle.js"></script>'));res.writeHead(200,{'content-type':mime[ext]||'application/octet-stream'}).end(data);}catch{res.writeHead(404).end();}
  });await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  browser=mode==='ios'?await webkit.launch({headless:true}):await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-extensions']});
  let browserCases=[
   {c:sample('14-heads/BIGMOM_COIN'),viewer:0,text:'護盾',coin:true,cancel:true},
   {c:sample('14-tails/BIGMOM_COIN'),viewer:0,text:'閃避',coin:true,visibility:true},
   {c:zoro(0,false),viewer:0,text:'0 號卡',slash:true},
   {c:zoro(17,true),viewer:0,text:'17 號卡',slash:true,reconnect:true},
   {c:sample('12-tails/QUEEN_COIN'),viewer:sample('12-tails/QUEEN_COIN').before.pending.target,text:'反面',coin:true},
   {c:sample('bigmom-pay/PICK_TARGET'),viewer:0,none:true},
   {c:sample('bigmom-pay/BIGMOM_CHOICE'),viewer:1,none:true},
   {c:sample('card-2-normal/PICK_TARGET'),viewer:0,text:'偵察',privateRead:true}
  ];
  if(process.env.PO_QA_QUICK)browserCases=browserCases.slice(0,1);
  if(mode==='desktop'&&process.env.PO_QA_DESKTOP_COMPACT)browserCases=browserCases.filter(item=>item.coin&&item.c.label.startsWith('14-')||item.slash||item.privateRead);
  if(process.env.PO_QA_REPETITION_ONLY)browserCases=[
   {c:sample('5-protected/PICK_TARGET'),viewer:0,none:true},
   {c:sample('5-dodging/PICK_TARGET'),viewer:0,none:true},
   {c:sample('bigmom-pay/BIGMOM_CHOICE'),viewer:0,none:true},
   {c:sample('bigmom-die/BIGMOM_CHOICE'),viewer:0,none:true},
   {c:redundantNami(),viewer:0,none:true},
   {c:sample('12-tails/QUEEN_COIN'),viewer:0,text:'反面',queenChain:true}
  ];
  for(const item of browserCases){
   const {c,viewer}=item,context=await browser.newContext({viewport:mode==='desktop'?{width:1366,height:768}:{width:740,height:360},hasTouch:mode!=='desktop',isMobile:mode!=='desktop',serviceWorkers:'block',userAgent:mode==='desktop'?'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/144.0.0.0 Safari/537.36 Electron/44.1.1':mode==='ios'?'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 ONEPIECE_TABLETOP_IOS/0.1.0 (Electron/44.1.1 compatibility)':'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/144.0.0.0 Mobile Safari/537.36 ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)'});
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await context.addInitScript(()=>{window.__TABLETOP_ANDROID_TEST_ORIGIN=location.origin;HTMLMediaElement.prototype.play=function(){return Promise.resolve()};HTMLMediaElement.prototype.load=function(){};HTMLMediaElement.prototype.pause=function(){};});
   if(mode==='ios')await context.addInitScript({content:bundle.js.toString()+`\ndocument.addEventListener('DOMContentLoaded',()=>{const link=document.createElement('link');link.rel='stylesheet';link.href='/__bundle.css';document.head.append(link);},{once:true});`});
   const p=await context.newPage();activePage=p;p.on('pageerror',e=>report.errors.push({case:c.label,error:e.message}));await p.goto(origin+'/game.html',{waitUntil:'load'});await p.waitForFunction(()=>CardPhonePresentation?.resultCutinVersion>=2);
   if(mode==='desktop'&&process.env.PO_QA_WARM_PROBE&&!report.warmProbe){
    report.warmProbe=await p.evaluate(async()=>{const api=CardPhonePresentation,original=api.presentEnhancementSummon;let result=null;api.presentEnhancementSummon=async(id,options)=>{result={id,hasReady:!!options&&typeof options.ready?.then==='function'};Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));};try{await api.presentCardSkillBatch([{to:'all',type:'card_skill_intent',cardId:4,casterId:0,mode:'effect',enhanced:true},{to:'all',type:'enh_fx',cardId:4}]);}finally{api.presentEnhancementSummon=original;Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));}return result;});
    check('actual generated desktop preserves the warm video/summon wrapper',report.warmProbe?.id===4&&report.warmProbe.hasReady,report.warmProbe);
   }
   await p.evaluate(({s,viewer})=>{state=s;me.playerId=viewer;me.roomId='RESULT-QA';me.secret='fixture';render();window.__deliver('STATE',s);},{s:engine.getVisibleState(c.before,viewer),viewer});
   if(await p.locator('#phoneVenueIntro:not([hidden])').count())await p.locator('#phoneVenueContinue').click();
   await p.waitForFunction(()=>!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.presentationQueueSize(),{},{timeout:30000});
   await p.evaluate(()=>{window.__resultHistory=[];const seen=new WeakSet();let coin='';new MutationObserver(()=>{const toss=document.getElementById('phoneCoinToss'),key=String(toss?.hidden)+':'+toss?.dataset.settled;if(key!==coin){coin=key;window.__resultHistory.push({type:'coin',time:performance.now(),hidden:toss?.hidden,settled:toss?.dataset.settled});}for(const node of document.querySelectorAll('.card-anime-skill'))if(!seen.has(node)){seen.add(node);window.__resultHistory.push({type:'cutin',time:performance.now(),result:node.textContent,post:node.dataset.resultCutin,coinBusy:CardPhonePresentation.isCoinBusy(),fxBusy:CardPhonePresentation.isEffectBusy(),privateOpen:!document.getElementById('phonePrivateReveal').hidden});}const scene=document.querySelector('#phoneInteractionFx .phone-hud-scene');if(scene?.dataset.phase==='effect'&&!seen.has(scene)){seen.add(scene);window.__resultHistory.push({type:'effect',time:performance.now()});}}).observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['hidden','data-settled','data-phase']});});
   await p.evaluate(()=>{const result=CardPhonePresentation.presentCardResultBatch;CardPhonePresentation.presentCardResultBatch=async(...args)=>{window.__resultHistory.push({type:'result-call',time:performance.now(),summary:CardPhonePresentation.cardResultSummary(...args)});return result(...args);};});
   await p.evaluate(({events,s})=>{for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:c.events.filter(e=>e.to==='all'||e.to===viewer),s:engine.getVisibleState(c.state,viewer)});
   if(item.privateRead){await p.waitForSelector('#phonePrivateReveal:not([hidden])',{timeout:30000});check(c.label+' no diagonal result before private reading is closed',await p.locator('.card-anime-skill').count()===0);await p.locator('#phonePrivateDone').click();}
   if(item.none){await p.waitForFunction(()=>!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.presentationQueueSize(),{},{timeout:30000});check(c.label+' further decision has no premature diagonal result',await p.evaluate(()=>window.__resultHistory.every(x=>x.type!=='cutin')));}
   else{
    await p.waitForSelector('.card-anime-skill[data-result-cutin="true"]',{timeout:60000});
    const history=await p.evaluate(()=>window.__resultHistory),cut=history.find(x=>x.type==='cutin');
    check(c.label+' only post-effect diagonals appear',history.filter(x=>x.type==='cutin').every(x=>x.post==='true'&&!x.coinBusy&&!x.fxBusy&&!x.privateOpen),history);
    check(c.label+' diagonal names authoritative result',cut.result.includes(item.text),cut.result);
    if(item.coin)check(c.label+' settled real coin precedes diagonal',history.some(x=>x.type==='coin'&&x.settled&&x.time<cut.time),history);
    if(item.slash)check(c.label+' real slash effect precedes diagonal',history.some(x=>x.type==='effect'&&x.time<cut.time),history);
    if(item.cancel){await p.screenshot({path:path.join(output,'bigmom-result.png')});await p.evaluate(()=>CardPhonePresentation.cancelCardSkillIntro());check(c.label+' cancellation removes diagonal and releases its busy gate',await p.locator('.card-anime-skill').count()===0&&!await p.evaluate(()=>CardPhonePresentation.isCardSkillIntroBusy()));}
    if(item.visibility){await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await p.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.isCardSkillIntroBusy());check(c.label+' background fast-forward removes diagonal and commits backend state',await p.locator('.card-anime-skill').count()===0&&await p.evaluate(()=>state.pending===null));await p.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});document.dispatchEvent(new Event('visibilitychange'));});}
    if(item.reconnect){await p.evaluate(({s,viewer})=>{window.__deliver('disconnect');window.__deliver('JOINED',{playerId:viewer,secret:'fixture'});window.__deliver('STATE',s);},{s:engine.getVisibleState(c.state,viewer),viewer});await p.waitForFunction(()=>!CardPhonePresentation.presentationQueueSize()&&!CardPhonePresentation.isCardSkillIntroBusy());check(c.label+' reconnect removes the old diagonal and resumes backend state',await p.locator('.card-anime-skill').count()===0&&await p.evaluate(()=>state.pending===null));}
    await p.waitForFunction(()=>!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.presentationQueueSize(),{},{timeout:30000});
    if(item.queenChain){
     const deliver=async step=>{await p.evaluate(({events,s})=>{for(const e of events)window.__deliver('EMIT',e);window.__deliver('STATE',s);},{events:step.events.filter(e=>e.to==='all'||e.to===viewer),s:engine.getVisibleState(step.state,viewer)});await p.waitForFunction(()=>!CardPhonePresentation.presentationEffectsBusy()&&!CardPhonePresentation.presentationQueueSize(),{},{timeout:30000});};
     await deliver(c);check('actual repeated Queen result does not reopen a diagonal',await p.evaluate(()=>window.__resultHistory.filter(x=>x.type==='cutin').length===1));
     for(const step of queenContinuations(c)){await deliver(step);check(step.automatic?'actual automatic paralysis skip does not reopen a diagonal':'actual next Queen coin decision does not reopen a diagonal',await p.evaluate(()=>window.__resultHistory.filter(x=>x.type==='cutin').length===1),step.events.map(e=>e.type));}
     check('actual Queen chain commits the final authoritative state',await p.evaluate(()=>state.pending===null));
    }
    report.cases.push({label:c.label,history:await p.evaluate(()=>window.__resultHistory)});
   }
   check(c.label+' presentation sends no gameplay action',await p.evaluate(()=>!window.__sent.some(e=>e[0]==='ACTION')));await context.close();
  }
  check('actual generated sources and online HTML stayed unchanged during the suite',report.source.every(x=>createHash('sha256').update(fs.readFileSync(root+'/'+x.file)).digest('hex')===x.sha256),report.source);
  check('no browser script errors',report.errors.length===0,report.errors);report.passed=true;
 }
}catch(e){report.failure=e.stack;process.exitCode=1;if(activePage)try{report.debug=await activePage.evaluate(()=>({root:{...document.documentElement.dataset},coin:CardPhonePresentation.isCoinBusy(),fx:CardPhonePresentation.isEffectBusy(),intro:CardPhonePresentation.isCardSkillIntroBusy(),queue:CardPhonePresentation.presentationQueueSize(),pending:state?.pending,history:window.__resultHistory}));}catch{}}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,engineFixtures:report.engineFixtures,errors:report.errors,failure:report.failure,debug:report.debug,report:path.join(output,'report.json')}));}
