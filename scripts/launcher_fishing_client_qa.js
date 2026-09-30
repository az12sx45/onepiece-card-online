'use strict';
// Chromium with the production launcher HTML and real life service on PGlite.
// The script operates the visible controls; server challenge data guides the test.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const runtimeBase=path.join(process.env.LOCALAPPDATA,'OpenAI/Codex/runtimes/cua_node');
const runtime=process.env.BOARD_QA_PLAYWRIGHT||fs.readdirSync(runtimeBase).map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync);
const {chromium}=require(runtime),root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_FISHING_QA_OUT||'D:/Codex_QA/launcher-life-fishing-weather-1.2.15/fishing-client';
fs.mkdirSync(out,{recursive:true});process.env.TEMP=out;process.env.TMP=out;
const db=new PGlite(),checks=[],screens=[],errors=[],commands=[];
let queue=Promise.resolve(),serial=0,browser,server;
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const life=require('../server/launcher-life-store'),cap={crewContentRevision:1},sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const check=(label,actual,expected)=>{assert.deepEqual(actual,expected,label);checks.push({label,status:'PASS'});console.log('PASS '+label);};
const source=file=>path.join(root,file);
function fixture(){
  const initial={authenticated:false,profile:null,preferences:{},games:{}};
  window.onePieceDesktop={getState:async()=>initial,onState(){},onSocialState(){},onLauncherUpdate(){},onProgress(){},onSessionKicked(){},getSocialState:async()=>({ok:false}),getLauncherUpdateState:async()=>({ok:false}),getLauncherAnnouncements:async()=>({ok:false}),getLauncherShop:async()=>({ok:false}),getLauncherProfile:async()=>({ok:false}),getLauncherComments:async()=>({ok:false}),getLauncherLife:async()=>({ok:false})};
  window.__FISH_QA={last:null,opens:0,closes:0};
}
async function capture(page,name){const file=path.join(out,name+'.png');await page.screenshot({path:file,fullPage:false});screens.push({path:file,sha256:sha(fs.readFileSync(file)),viewport:page.viewportSize()});}
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
  await context.exposeFunction('__fishService',async(type,payload)=>{const state=await life.getLauncherLife(pool,'fish-client',new Date(),cap);const response=await life.commandLauncherLife(pool,'fish-client',{type,payload,requestId:'fish-client-'+String(++serial).padStart(8,'0'),expectedRevision:state.life.revision},new Date(),cap);commands.push({type,ok:response.ok,error:response.error,roundIndex:response.minigame?.roundIndex});return response;});
  const page=await context.newPage();page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`,{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.OnePieceRoomMinigames);
  await page.evaluate(()=>{window.__game=OnePieceRoomMinigames.create({command:async(type,payload)=>{const response=await __fishService(type,payload);__FISH_QA.last=response;return response;},fishCollection:()=>__FISH_QA.last?.life?.fishCollection||[],onOpen:()=>__FISH_QA.opens++,onClose:()=>__FISH_QA.closes++});});
  for(const [key,expected] of [['sabo','魯夫'],['law','魚往深處']]){
    check(`${key} minigame entry opens`,await page.evaluate(key=>__game.open({kind:'work',characterId:'room-character-'+key,jobId:'fishing'}),key),true);
    check(`${key} fishing voice has character-specific line`,(await page.getByTestId('minigame-feedback').innerText()).includes(expected),true);
    await page.getByRole('button',{name:'結束並關閉挑戰'}).click();
  }
  check('fishing entry opens',await page.evaluate(()=>__game.open({kind:'work',characterId:'room-character-luffy',jobId:'fishing'})),true);
  check('fishing collection initially empty',await page.locator('.room-fishing-collection-item').count(),0);
  await capture(page,'fishing-intro-desktop');
  await page.getByRole('button',{name:'準備好了 · 開始挑戰'}).click();
  await page.waitForFunction(()=>['showcase','answer'].includes(__game.inspect().phase));
  check('fishing has five rounds',await page.evaluate(()=>__FISH_QA.last.minigame.totalRounds),5);
  const started=Date.now(),arrows={left:'ArrowRight',right:'ArrowLeft',deep:'ArrowDown'};
  for(let roundIndex=0;roundIndex<5;roundIndex++){
    await page.waitForFunction(index=>__game.inspect().roundIndex===index&&__game.inspect().phase==='answer',roundIndex,{timeout:16000});
    const challenge=await page.evaluate(()=>__FISH_QA.last.minigame.challenge);
    if(roundIndex===0){
      await capture(page,'fishing-active-desktop');
      check('fishing art loads',await page.locator('.room-fishing-sea').evaluate(element=>getComputedStyle(element).backgroundImage.includes('fishing-sea.webp')),true);
      check('fishing shows actionable pull',Boolean(await page.locator('.room-fishing-signal').innerText()),true);
      check('fishing cue does not reveal the exact button',
        /向左拉|向右拉|鬆線/.test(await page.locator('.room-fishing-signal').innerText()),false);
    }
    if(roundIndex===1){
      await page.setViewportSize({width:390,height:844});
      await capture(page,'fishing-active-narrow');
      const card=await page.locator('.room-minigame-card').boundingBox();
      check('narrow card stays within viewport',card.x>=0&&card.x+card.width<=390,true);
      for(const button of await page.locator('.room-fishing-control').all()){
        const rect=await button.boundingBox();
        check('narrow fishing control remains touch sized',rect.width>=44&&rect.height>=43,true);
      }
    }
    for(const pull of challenge.pulls){await page.keyboard.press(arrows[pull]);await page.waitForTimeout(90);}
    await page.waitForFunction(index=>__game.inspect().roundIndex>index||__game.inspect().phase==='result',roundIndex,{timeout:16000});
  }
  await page.waitForFunction(()=>__game.inspect().phase==='result',{},{timeout:20000});
  const result=await page.evaluate(()=>__FISH_QA.last.minigame.result);
  check('fishing success yields one canon fish',result.catch&&['balloon-catfish','glistening-saury','smile-jellyfish','panda-shark'].includes(result.catch.speciesId),true);
  check('fishing real-time completion remains under 65s',Date.now()-started<65000,true);
  await capture(page,'fishing-catch-narrow');
  await page.getByRole('button',{name:'放進水族箱'}).click();
  check('caught fish placed into owned tank',(await life.getLauncherLife(pool,'fish-client',new Date(),cap)).life.fishCollection[0].inAquarium,true);
  await capture(page,'fishing-placed-narrow');
  await page.getByRole('button',{name:'查看下一場規則'}).click();
  check('caught fish appears in collection',await page.locator('.room-fishing-collection-item').count(),1);
  await capture(page,'fishing-collection-narrow');
  const collectionAction=await page.locator('.room-fishing-collection-action').first().boundingBox();
  check('narrow collection action remains touch sized',collectionAction.height>=44,true);
  const nextStart=page.getByRole('button',{name:'準備好了 · 開始挑戰'});
  await nextStart.scrollIntoViewIfNeeded();
  const nextStartBox=await nextStart.boundingBox();
  check('narrow scrolled intro can reach next start button',nextStartBox.y>=0&&nextStartBox.y+nextStartBox.height<=844,true);
  await page.getByRole('button',{name:'收回收藏'}).click();
  check('fish can be retrieved without loss',(await life.getLauncherLife(pool,'fish-client',new Date(),cap)).life.fishCollection[0].inAquarium,false);
  check('no browser page errors',errors,[]);
  const report={schema:'launcher-fishing-client-qa/1',status:'PASS',createdAt:new Date().toISOString(),checks,screens,commands,elapsedMs:Date.now()-started,limitations:['Automated Chromium interaction, not human playtest.','Real service functions with isolated PGlite, not production PostgreSQL.','Production launcher HTML, local assets, desktop and 390px viewport.','Scene aquarium rendering is verified separately by scene composite and root room integration QA.']};
  fs.writeFileSync(path.join(out,'FISHING_CLIENT_QA.json'),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:'PASS',checks:checks.length,report:path.join(out,'FISHING_CLIENT_QA.json')}));
}
main().catch(error=>{fs.writeFileSync(path.join(out,'FISHING_CLIENT_FAILURE.json'),JSON.stringify({status:'FAIL',error:error.stack,checks,commands},null,2)+'\n');console.error(error.stack||error);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server?server.close(resolve):resolve());await db.close();});
