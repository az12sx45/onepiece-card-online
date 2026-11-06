'use strict';
// Fast terminal-frame geometry checks for the standalone stage, not transport/ACK acceptance.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out='D:/Codex_QA/card-duel-stage-20261106',mobile='C:/Users/王曜瑋/.codex/worktrees/android-tabletop-landscape/2026-04-20-1-2-start-html-game-html';
const retainedCss='D:/Codex_QA/native-ios-cloud-20261023/candidate/bundle-resources/launcher-web/mobile/game-mobile.css';
const cssProfile=process.env.CARD_DUEL_CSS_PROFILE||'desktop';
const moveIds=['fire-fist','ice-sphere','triple-slash','thunderbolt','magma-fist','sandstorm','dark-vortex','quake-ring','paw-cannon','light-beam','meteor','dragon-breath','phoenix-flame','poison-dragon','rubber-barrage','flame-kick','water-dragon','mochi-drill','string-cage','thunder-orb'];
const report={passed:false,cssProfile,boundary:'Standalone stage. Passed animation helper applies final keyframes immediately for geometry; not engine transport, real timing, ACK, native, account, or player acceptance.',checks:[],cases:[],errors:[],externalArtworkRequests:[]};
fs.mkdirSync(out,{recursive:true});
const check=(name,pass,detail)=>{report.checks.push({name,pass:!!pass,detail});assert(pass,name);};
const fixture=`<!doctype html><html data-card-phone data-card-fx><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/card-desktop-table.css"><link rel="stylesheet" href="/css/card-duel-stage.css"></head><body style="margin:0"><div id="players"><div><img class="rounded-full" src="/images/avatars/1.webp"></div><div><img class="rounded-full" src="/images/avatars/2.webp"></div></div><div id="fixtureScene" style="position:fixed;inset:0"></div><script>window.me={playerId:0};window.CardPhonePresentation={playerVisualElement:id=>document.querySelector('#players').children[id]};window.runStage=(d,viewer)=>{document.querySelector('#fixtureScene').replaceChildren();window.me.playerId=viewer;window.at=0;window.timers=[];window.frames=[];const api=CardPhonePresentation;api.playDuelScene({scene:document.querySelector('#fixtureScene'),from:0,to:1,d,bounds:{},anchor:id=>({id,x:id?innerWidth-30:30,y:50}),handAnchor:a=>a,animate:(n,frames,ms,delay)=>{window.frames.push({class:n.className,frames,ms,delay});const last=frames[frames.length-1];for(const [key,value]of Object.entries(last))if(key!=='offset')n.style[key]=String(value);},later:(fn,ms)=>window.timers.push({fn,ms:window.at+ms}),make:(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls;if(text)n.textContent=text;return n;},name:id=>id?'右方玩家':'左方玩家',card:id=>'images/cards/'+id+'.webp',validCard:id=>Number.isInteger(id)&&id>=0&&id<20});};window.advance=ms=>{while(true){timers.sort((a,b)=>a.ms-b.ms);const next=timers[0];if(!next||next.ms>ms)break;timers.shift();window.at=next.ms;next.fn();}window.at=ms;};</script><script src="/js/card-duel-stage.js"></script></body></html>`;
function fileFor(url){
 const relative=decodeURIComponent(new URL(url,'http://fixture').pathname).replace(/^\//,'');
 const target=path.resolve(root,'public',relative);
 if(!target.startsWith(path.resolve(root,'public')+path.sep))return null;
 if(fs.existsSync(target))return target;
 if(relative.startsWith('art/')){report.externalArtworkRequests.push(relative);return null;}
 if(relative.startsWith('images/'))return path.join(mobile,'public',relative);
 return null;
}
const server=http.createServer((req,res)=>{if(req.url==='/'){res.setHeader('Content-Type','text/html;charset=utf-8');res.end(cssProfile==='ios-retained'?fixture.replace('data-card-phone data-card-fx','data-card-phone data-card-fx data-card-bundled-styles="1"').replace('/css/card-desktop-table.css','/retained/game-mobile.css'):fixture);return;}const file=req.url==='/retained/game-mobile.css'?retainedCss:fileFor(req.url);if(!file||!fs.existsSync(file)){res.writeHead(404);res.end();return;}const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'text/javascript':ext==='.css'?'text/css':ext==='.webp'?'image/webp':'application/octet-stream');res.end(fs.readFileSync(file));});
async function inlineTextures(page){
 return page.evaluate(async ids=>Promise.all(ids.map(async id=>{
  const probe=document.createElement('i');probe.className='duel-finisher-art';probe.dataset.finisher=id;probe.style.cssText='position:fixed;width:0;height:0;visibility:hidden;';document.body.append(probe);
  const value=getComputedStyle(probe).getPropertyValue('--duel-finisher-art').trim(),match=value.match(/^url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*))\s*\)$/);probe.remove();const url=(match?.[1]??match?.[2]??match?.[3]??'').trim();
  if(!/^data:image\//.test(url))return {id,inline:false,length:url.length,width:0,height:0};
  const image=new Image();image.src=url;await image.decode();return {id,inline:true,length:url.length,width:image.naturalWidth,height:image.naturalHeight};
 })),moveIds);
}
function state(page){return page.evaluate(()=>{
 const rect=n=>{const r=n.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
 const stage=document.querySelector('.card-duel-stage');
 return {width:innerWidth,height:innerHeight,stage:rect(stage),arena:stage.dataset.arena,phase:stage.dataset.phase,text:stage.innerText,background:getComputedStyle(stage).backgroundImage,verdict:rect(stage.querySelector('.cduel-verdict')),verdictHidden:stage.querySelector('.cduel-verdict').hidden,slots:[...stage.querySelectorAll('.cduel-slot')].map(n=>({card:rect(n.querySelector('.cduel-card')),holder:rect(n.querySelector('.cduel-card-wrap')),identity:rect(n.querySelector('.cduel-identity')),name:rect(n.querySelector('.cduel-name')),number:n.querySelector('.cduel-number')?{text:n.querySelector('.cduel-number').textContent,visibility:n.querySelector('.cduel-number').dataset.visibility,rect:rect(n.querySelector('.cduel-number'))}:null,src:n.querySelector('.cduel-card').getAttribute('src'),alt:n.querySelector('.cduel-card').alt})),deformedFrames:window.frames.flatMap(a=>a.frames.map(f=>f.transform||'')).filter(v=>/scale\([^)]*,/.test(v))};
 });}
(async()=>{let browser;try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 if(process.env.CARD_DUEL_ASSETS_ONLY==='1'){
  const page=await browser.newPage({viewport:{width:736,height:430}});
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof CardPhonePresentation.duelStageAssetsFor==='function');
  const textures=await inlineTextures(page);report.finisherTextures=textures;
  check('all twenty finisher textures resolve and decode from existing inline CSS',textures.length===20&&textures.every(t=>t.inline&&t.length>1000&&t.width>1&&t.height>1),textures);
  const pairs=await page.evaluate(()=>Array.from({length:40},(_,i)=>{
   const duelId='asset-contract-'+i,api=CardPhonePresentation;
   runStage({duelId,winnerId:null},2);
   const stage=document.querySelector('.card-duel-stage'),urls=api.duelStageAssetsFor(duelId),background=stage.style.getPropertyValue('--cduel-background').match(/url\("?(.*?)"?\)/)[1];
   const rendered=[background,...[...stage.querySelectorAll('.cduel-shot')].map(n=>n.src),stage.querySelector('.cduel-card').src];
   return {duelId,arena:stage.dataset.arena,apiArena:api.duelStageArenaFor(duelId),urlKinds:urls.map(url=>url.startsWith('data:image/')?'inline-image':url),urlLengths:urls.map(url=>url.length),inlineEffects:urls.slice(1,3).every(url=>url.startsWith('data:image/')&&url.length>1000),onlyPublicBack:urls[3].endsWith('/images/cards/back.webp'),match:JSON.stringify(urls)===JSON.stringify(rendered)};
  }));
  check('asset API and renderer select identical public textures',pairs.every(p=>p.match&&p.arena===p.apiArena),pairs);
  check('asset API includes all three backgrounds and only public back plus inline cosmetic effects',new Set(pairs.map(p=>p.arena)).size===3&&pairs.every(p=>p.urlKinds.length===4&&p.onlyPublicBack&&p.inlineEffects),pairs);
  check('no external finisher media is requested',report.externalArtworkRequests.length===0,report.externalArtworkRequests);
  report.mode='asset API contract only';report.passed=true;await page.close();return;
 }
 const cases=[[320,568],[375,812],[736,320],[932,430],[1366,768]];
 for(const [width,height]of cases){
  const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>CardPhonePresentation.duelSceneVersion===4);
  await page.evaluate(()=>runStage({duelId:'geometry-duel',winnerId:1,loserCardId:3,privateCards:{0:3,1:10}},0));
  await page.waitForFunction(()=>[...document.querySelectorAll('.cduel-card')].every(n=>n.complete&&n.naturalWidth));
  const background=await page.evaluate(async()=>{const value=getComputedStyle(document.querySelector('.card-duel-stage')).backgroundImage;const url=value.match(/url\("?(.*?)"?\)/)[1];const image=new Image();image.src=url;await image.decode();return {url,width:image.naturalWidth,height:image.naturalHeight};});
  check(`${width} arena background decodes from page media path`,background.width===1600&&!background.url.includes('/css/images/'),background);
  if(width===1366){
   const decoded=await inlineTextures(page);
   report.finisherTextures=decoded;
   check('all twenty existing inline finisher textures decode',decoded.length===20&&decoded.every(t=>t.inline&&t.length>1000&&t.width>1&&t.height>1),decoded);
  }
  const initial=await state(page);
  check(`${width} cards preserve 2:3`,initial.slots.every(s=>Math.abs(s.card.width/s.card.height-2/3)<.005),initial);
  check(`${width} participant numbers`,initial.slots.map(s=>s.number?.text).join(',')==='3,10',initial);
  check(`${width} initially backs`,initial.slots.every(s=>s.src.endsWith('/back.webp')),initial);
  await page.evaluate(()=>advance(6500));const final=await state(page);report.cases.push({width,height,initial,final});
  check(`${width} card rectangles fit`,final.slots.every(s=>s.card.x>=-1&&s.card.right<=width+1&&s.card.y>=-1&&s.card.bottom<=height+1),final);
  check(`${width} identities fit`,final.slots.every(s=>s.identity.x>=-1&&s.identity.right<=width+1&&s.identity.bottom<=height+1),final);
  check(`${width} result does not cover identities`,final.slots.every(s=>s.identity.bottom<=final.verdict.y||s.identity.y>=final.verdict.bottom),final);
  check(`${width} public loser only`,final.slots[0].src.endsWith('/3.webp')&&final.slots[1].src.endsWith('/back.webp')&&final.slots[0].number.visibility==='public'&&final.slots[1].number.visibility==='private',final);
  check(`${width} no nonuniform card scales`,final.deformedFrames.length===0,final.deformedFrames);
  if(width===1366)await page.screenshot({path:path.join(out,'stage-visual-desktop.png')});
  await page.evaluate(()=>runStage({duelId:'geometry-duel',winnerId:null,privateCards:{0:8,1:8}},2));
  await page.evaluate(()=>advance(6500));const observer=await state(page);
  check(`${width} spectator has no private number nodes`,observer.slots.every(s=>s.number===null),observer);
  check(`${width} draw keeps backs`,observer.slots.every(s=>s.src.endsWith('/back.webp')),observer);
  if(width===736)await page.screenshot({path:path.join(out,'stage-visual-landscape.png')});
  await page.close();
 }
 check('no external finisher media is requested',report.externalArtworkRequests.length===0,report.externalArtworkRequests);
 check('no browser exceptions',report.errors.length===0,report.errors);report.passed=true;
}catch(error){report.failure=error.stack;process.exitCode=1;}finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));const name=(process.env.CARD_DUEL_ASSETS_ONLY==='1'?'stage-assets-qa':'stage-visual-qa')+(cssProfile==='desktop'?'':'-'+cssProfile)+'.json';fs.writeFileSync(path.join(out,name),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,cssProfile,errors:report.errors,failure:report.failure}));}})();
