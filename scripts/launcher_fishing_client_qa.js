'use strict';
// Chromium with the production launcher HTML and real life service on PGlite.
// The script operates visible fishing controls and reads only visible cues/meters.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const runtimeBase=path.join(process.env.LOCALAPPDATA,'OpenAI/Codex/runtimes/cua_node');
const runtime=process.env.BOARD_QA_PLAYWRIGHT||fs.readdirSync(runtimeBase).map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync);
const {chromium}=require(runtime),root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_FISHING_QA_OUT||'D:/Codex_QA/launcher-fishing-rework-1.2.16/fishing-client';
fs.mkdirSync(out,{recursive:true});process.env.TEMP=out;process.env.TMP=out;
const db=new PGlite(),checks=[],screens=[],errors=[],commands=[],geometries=[];
let queue=Promise.resolve(),serial=0,browser,server;
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const life=require('../server/launcher-life-store'),cap={crewContentRevision:1},sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(label,actual,expected)=>{assert.deepEqual(actual,expected,label);checks.push({label,status:'PASS'});console.log('PASS '+label);};
const source=file=>path.join(root,file);
function fixture(){
  const initial={authenticated:false,profile:null,preferences:{},games:{}};
  window.onePieceDesktop={getState:async()=>initial,onState(){},onSocialState(){},onLauncherUpdate(){},onProgress(){},onSessionKicked(){},getSocialState:async()=>({ok:false}),getLauncherUpdateState:async()=>({ok:false}),getLauncherAnnouncements:async()=>({ok:false}),getLauncherShop:async()=>({ok:false}),getLauncherProfile:async()=>({ok:false}),getLauncherComments:async()=>({ok:false}),getLauncherLife:async()=>({ok:false})};
  window.__FISH_QA={last:null,seq:0,opens:0,closes:0};
}
async function capture(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:false});screens.push({path:file,sha256:sha(fs.readFileSync(file)),viewport:page.viewportSize()});}
async function measureFishingGeometry(page,label){
  const geometry=await page.evaluate(()=>{
    const sea=document.querySelector('.room-fishing-v2-sea'),rod=sea.querySelector('.room-fishing-v2-rod'),bobber=sea.querySelector('.room-fishing-v2-bobber'),svg=sea.querySelector('.room-fishing-v2-line');
    const rect=element=>{const box=element.getBoundingClientRect();return{x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),height:Math.round(box.height),right:Math.round(box.right),bottom:Math.round(box.bottom)};};
    const path=[...svg.querySelectorAll('path')].find(element=>{const style=getComputedStyle(element);return style.display!=='none'&&style.visibility!=='hidden'&&style.opacity!=='0';});
    const endpoint=point=>{const ctm=path.getScreenCTM(),screen=new DOMPoint(point.x,point.y).matrixTransform(ctm);return{x:Math.round(screen.x),y:Math.round(screen.y)};};
    const bob=rect(bobber),start=path?endpoint(path.getPointAtLength(0)):null,end=path?endpoint(path.getPointAtLength(path.getTotalLength())):null;
    return{stage:sea.dataset.stage,sea:rect(sea),rod:rect(rod),bobber:bob,bobberCenter:{x:bob.x+bob.width/2,y:bob.y+bob.height/2},svg:rect(svg),svgNamespace:svg.namespaceURI,path:path?{className:path.getAttribute('class'),d:path.getAttribute('d'),boundingBox:rect(path),start,end}:null};
  });
  geometries.push({label,viewport:page.viewportSize(),...geometry});
  console.log('GEOMETRY '+label+' '+JSON.stringify(geometry));
  check(`${label}: SVG has correct namespace`,geometry.svgNamespace,'http://www.w3.org/2000/svg');
  check(`${label}: active line path paints`,Boolean(geometry.path?.boundingBox.width>0&&geometry.path?.boundingBox.height>0),true);
}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  const keys=['luffy','sabo','law'],today=new Date().toISOString().slice(0,10);
  const stats={client:{totals:{coins:73}},board:{saved:'preserve'},launcherWalletV1:{coins:100,lastGrantDay:today},launcherOwnedV1:{items:[...keys.map(key=>'room-character-'+key),'room-furniture-aquarium-tank']},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:keys.map((key,index)=>({itemId:'room-character-'+key,x:160+index*70,y:440}))}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)',['fish-client','fish-client','8',JSON.stringify(stats)]);
  server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'launcher.html';if(rel.includes('..')){res.writeHead(404);res.end();return;}const file=source('desktop/'+rel);if(!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.css'?'text/css':'text/html');res.end(fs.readFileSync(file));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:process.env.BOARD_QA_CHROMIUM||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu-shader-disk-cache']});
  const context=await browser.newContext({viewport:{width:1280,height:850}});
  await context.addInitScript(fixture);
  await context.route('opui://**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,''),file=source('public/'+rel);return !rel.includes('..')&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'missing'});});
  await context.exposeFunction('__fishService',async(type,payload)=>{const state=await life.getLauncherLife(pool,'fish-client',new Date(),cap);const response=await life.commandLauncherLife(pool,'fish-client',{type,payload,requestId:'fish-client-'+String(++serial).padStart(8,'0'),expectedRevision:state.life.revision},new Date(),cap);commands.push({type,action:payload.counterMoves?.[0],ok:response.ok,error:response.error,roundIndex:response.minigame?.roundIndex});return response;});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.OnePieceRoomMinigames);
  await page.evaluate(()=>{window.__game=OnePieceRoomMinigames.create({command:async(type,payload)=>{const response=await __fishService(type,payload);__FISH_QA.last=response;__FISH_QA.seq++;return response;},fishCollection:()=>__FISH_QA.last?.life?.fishCollection||[],onOpen:()=>__FISH_QA.opens++,onClose:()=>__FISH_QA.closes++});});
  for(const [key,expected] of [['sabo','魯夫'],['law','魚往深處']]){
    check(`${key} minigame entry opens`,await page.evaluate(key=>__game.open({kind:'work',characterId:'room-character-'+key,jobId:'fishing'}),key),true);
    check(`${key} fishing voice has character-specific line`,(await page.getByTestId('minigame-feedback').innerText()).includes(expected),true);
    await page.getByRole('button',{name:'結束並關閉挑戰'}).click();
  }
  check('fishing entry opens',await page.evaluate(()=>__game.open({kind:'work',characterId:'room-character-luffy',jobId:'fishing'})),true);
  check('fishing collection initially empty',await page.locator('.room-fishing-collection-item').count(),0);
  await capture(page,'fishing-intro-desktop');
  await page.getByRole('button',{name:'準備好了 · 開始挑戰'}).click();
  await page.waitForFunction(()=>__game.inspect().phase==='answer');
  check('fishing v2 has three rounds',await page.evaluate(()=>__FISH_QA.last.minigame.totalRounds),3);
  check('fishing v2 challenge is active',await page.locator('.fishing-v2').count(),1);
  const started=Date.now(),sea=page.locator('.room-fishing-v2-sea');
  const action=async name=>{
    await page.waitForTimeout(275);
    const before=await page.evaluate(()=>__FISH_QA.seq);
    await page.locator(`[data-fish-action="${name}"]`).click();
    await page.waitForFunction(previous=>__FISH_QA.seq>previous&&!__game.inspect().requesting,before,{timeout:8000});
    const status=await page.evaluate(()=>({ok:__FISH_QA.last?.ok,error:__FISH_QA.last?.error}));
    assert.equal(status.ok,true,JSON.stringify({name,status}));
  };
  for(let roundIndex=0;roundIndex<3;roundIndex++){
    await page.waitForFunction(index=>__game.inspect().roundIndex===index&&__game.inspect().phase==='answer',roundIndex,{timeout:16000});
    check(`round ${roundIndex+1}: starts with cast`,await sea.getAttribute('data-stage'),'cast');
    if(roundIndex===0){
      await capture(page,'fishing-cast-desktop');
      const box=await sea.boundingBox();
      check('desktop fishing sea is visibly enlarged',box.width>=700&&box.height>=320,true);
      check('desktop shows four readable step labels',await page.locator('.room-fishing-v2-steps span').count(),4);
      check('desktop cast control is enabled',await page.locator('[data-fish-action="cast"]').isEnabled(),true);
      check('fishing background art loads',await sea.evaluate(element=>getComputedStyle(element).backgroundImage.includes('fishing-sea.webp')),true);
      for(const asset of ['rod','bobber','splash']){
        check(`${asset} generated art loads`,await page.locator(`.room-fishing-v2-${asset}`).evaluate(img=>img.complete&&img.naturalWidth>0),true);
      }
    }
    if(roundIndex===1){
      await page.setViewportSize({width:390,height:844});
      await capture(page,'fishing-cast-mobile');
      const card=await page.locator('.room-minigame-card').boundingBox(),box=await sea.boundingBox();
      check('mobile card stays inside 390px viewport',card.x>=0&&card.x+card.width<=390,true);
      check('mobile sea retains a large readable area',box.width>=300&&box.height>=290,true);
    }
    await action('cast');
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.stage==='wait');
    check(`round ${roundIndex+1}: bobber appears after cast`,await sea.getAttribute('data-stage'),'wait');
    if(roundIndex===0){
      check('hook is disabled before bite',await page.locator('[data-fish-action="hook"]').isDisabled(),true);
      await capture(page,'fishing-wait-desktop');
    }
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.nibbling==='true',null,{timeout:8000});
    const bobberBefore=await page.locator('.room-fishing-v2-bobber').boundingBox();
    if(roundIndex===0)await capture(page,'fishing-nibble-desktop');
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.biting==='true'&&!document.querySelector('[data-fish-action="hook"]')?.disabled,null,{timeout:5000});
    await page.waitForTimeout(340);
    check(`round ${roundIndex+1}: visible sink cue precedes hook`,(await page.locator('.room-fishing-v2-signal').innerText()).includes('沉下'),true);
    const bobberAfter=await page.locator('.room-fishing-v2-bobber').boundingBox();
    check(`round ${roundIndex+1}: bobber visibly sinks`,bobberAfter.y-bobberBefore.y>=8,true);
    if(roundIndex===0)await capture(page,'fishing-bite-desktop');
    await action('hook');
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.stage==='fight');
    if(roundIndex===0){await measureFishingGeometry(page,'fishing-fight-desktop');await capture(page,'fishing-fight-desktop');}
    if(roundIndex===1){
      await page.locator('.room-fishing-v2-actions').scrollIntoViewIfNeeded();
      await measureFishingGeometry(page,'fishing-fight-mobile');
      await capture(page,'fishing-fight-controls-mobile');
      for(const button of await page.locator('.room-fishing-v2-action:not([hidden])').all()){
        const rect=await button.boundingBox();
        check('mobile fishing action remains touch sized',rect.width>=44&&rect.height>=44,true);
        check('mobile fishing action fits viewport',rect.x>=0&&rect.x+rect.width<=390,true);
      }
    }
    for(let step=0;step<40;step++){
      const now=await page.evaluate(()=>__game.inspect().roundIndex);
      if(now!==roundIndex)break;
      const tension=Number((await page.locator('.room-fishing-v2-meter.tension .room-fishing-v2-meter-title span').innerText()).replace(/[^\d.]/g,''));
      const surge=(await page.locator('.room-fishing-v2-signal').innerText()).includes('猛衝');
      await action(tension>55||surge&&tension>34?'slack':'reel');
    }
    check(`round ${roundIndex+1}: landed using visible meter and cue`,await page.evaluate(()=>__game.inspect().roundIndex),roundIndex+1);
  }
  await page.waitForFunction(()=>__game.inspect().phase==='result',null,{timeout:35000});
  const result=await page.evaluate(()=>__FISH_QA.last.minigame.result);
  check('fishing success yields one canon fish',result.catch&&['balloon-catfish','glistening-saury','smile-jellyfish','panda-shark'].includes(result.catch.speciesId),true);
  check('fishing v2 real-time completion remains under 75s',Date.now()-started<75000,true);
  await capture(page,'fishing-catch-mobile');
  await page.getByRole('button',{name:'放進水族箱'}).click();
  check('caught fish placed into owned tank',(await life.getLauncherLife(pool,'fish-client',new Date(),cap)).life.fishCollection[0].inAquarium,true);
  await capture(page,'fishing-placed-mobile');
  await page.getByRole('button',{name:'再玩一場'}).click();
  check('caught fish appears in collection',await page.locator('.room-fishing-collection-item').count(),1);
  await capture(page,'fishing-collection-mobile');
  const collectionAction=await page.locator('.room-fishing-collection-action').first().boundingBox();
  check('narrow collection action remains touch sized',collectionAction.height>=44,true);
  const nextStart=page.getByRole('button',{name:'準備好了 · 開始挑戰'});
  await nextStart.scrollIntoViewIfNeeded();
  const nextStartBox=await nextStart.boundingBox();
  check('narrow scrolled intro can reach next start button',nextStartBox.y>=0&&nextStartBox.y+nextStartBox.height<=844,true);
  await page.getByRole('button',{name:'收回收藏'}).click();
  check('fish can be retrieved without loss',(await life.getLauncherLife(pool,'fish-client',new Date(),cap)).life.fishCollection[0].inAquarium,false);
  // The server clock is authoritative. A client clock one minute ahead must
  // still wait for the actual bite; keyboard repeats should reel while held.
  await page.evaluate(()=>{const actualNow=Date.now.bind(Date);Date.now=()=>actualNow()+60000;});
  await page.getByRole('button',{name:'準備好了 · 開始挑戰'}).click();
  await page.waitForFunction(()=>__game.inspect().phase==='answer');
  await action('cast');
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.stage==='wait');
  check('60-second fast client clock does not trigger premature bite',await sea.getAttribute('data-biting'),'false');
  check('60-second fast client clock keeps hook unavailable before bite',await page.locator('[data-fish-action="hook"]').isDisabled(),true);
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.biting==='true'&&!document.querySelector('[data-fish-action="hook"]')?.disabled,null,{timeout:8000});
  await action('hook');
  await page.waitForFunction(()=>document.querySelector('.room-fishing-v2-sea')?.dataset.stage==='fight');
  const distanceBefore=Number((await page.locator('.room-fishing-v2-meter.distance .room-fishing-v2-meter-title span').innerText()).replace(/[^\d.]/g,''));
  const reelsBefore=commands.filter(entry=>entry.type==='minigame.answer'&&entry.action==='reel').length;
  await page.keyboard.down('Space');
  await page.waitForTimeout(590);
  await page.keyboard.down('Space');
  await page.waitForTimeout(590);
  await page.keyboard.down('Space');
  await page.keyboard.up('Space');
  await page.waitForFunction(()=>!__game.inspect().requesting);
  const distanceAfter=Number((await page.locator('.room-fishing-v2-meter.distance .room-fishing-v2-meter-title span').innerText()).replace(/[^\d.]/g,''));
  check('keyboard held Space reels the fish repeatedly',commands.filter(entry=>entry.type==='minigame.answer'&&entry.action==='reel').length-reelsBefore>=2,true);
  check('keyboard held Space visibly shortens fish distance',distanceAfter<distanceBefore,true);
  await page.evaluate(()=>__game.dismiss());
  check('no browser page errors',errors,[]);
  const report={schema:'launcher-fishing-client-qa/1',status:'PASS',createdAt:new Date().toISOString(),checks,screens,geometries,commands,elapsedMs:Date.now()-started,limitations:['Automated Chromium interaction, not human playtest.','Real service functions with isolated PGlite, not production PostgreSQL.','Production launcher HTML, local assets, desktop and 390px viewport.','Scene aquarium rendering is verified separately by scene composite and root room integration QA.']};
  fs.writeFileSync(path.join(out,'FISHING_CLIENT_QA.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:checks.length,report:path.join(out,'FISHING_CLIENT_QA.json')}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'FISHING_CLIENT_FAILURE.json'),JSON.stringify({status:'FAIL',error:error.stack,checks,geometries,commands,errors},null,2)+'\n');console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());await db.close();});
