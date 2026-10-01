'use strict';
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=process.env.LAUNCHER_FISHING_V3_QA_OUT||'D:/Codex_QA/launcher-fishing-adventure-1.2.17/client-qa';
fs.mkdirSync(out,{recursive:true});process.env.TEMP=out;process.env.TMP=out;
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const runtimeBase=path.join(process.env.LOCALAPPDATA,'OpenAI/Codex/runtimes/cua_node');
const runtime=fs.readdirSync(runtimeBase).map(name=>path.join(runtimeBase,name,'bin/node_modules/playwright')).find(fs.existsSync);
const {chromium}=require(runtime),life=require(path.join(root,'server/launcher-life-store'));
const db=new PGlite(),checks=[],errors=[];let serial=0,browser,server,queue=Promise.resolve();
const cap={crewContentRevision:1};
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const verify=(label,actual,expected)=>{assert.deepEqual(actual,expected,label);checks.push(label);console.log('PASS '+label);};
const fixture=()=>{const initial={authenticated:false,profile:null,preferences:{},games:{}};window.onePieceDesktop={getState:async()=>initial,onState(){},onSocialState(){},onLauncherUpdate(){},onProgress(){},onSessionKicked(){},getSocialState:async()=>({ok:false}),getLauncherUpdateState:async()=>({ok:false}),getLauncherAnnouncements:async()=>({ok:false}),getLauncherShop:async()=>({ok:false}),getLauncherProfile:async()=>({ok:false}),getLauncherComments:async()=>({ok:false}),getLauncherLife:async()=>({ok:false})};window.__FISH_V3={last:null,seq:0};};
const source=file=>path.join(root,file);
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  const today=new Date().toISOString().slice(0,10);
  const stats={client:{totals:{coins:73}},launcherWalletV1:{coins:500,lastGrantDay:today},launcherOwnedV1:{items:['room-character-luffy','room-furniture-aquarium-tank']},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:[{itemId:'room-character-luffy',x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)',['fish-v3-client','fish-v3-client','8',JSON.stringify(stats)]);
  server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\//,'')||'launcher.html';const file=source('desktop/'+rel);if(rel.includes('..')||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',path.extname(file)==='.js'?'text/javascript':path.extname(file)==='.css'?'text/css':'text/html');res.end(fs.readFileSync(file));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--disable-gpu-shader-disk-cache']});
  const context=await browser.newContext({viewport:{width:1280,height:850}});await context.addInitScript(fixture);
  await context.route('opui://**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,''),file=source('public/'+rel);return !rel.includes('..')&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'missing'});});
  await context.exposeFunction('__fishV3Service',async(type,payload)=>{const state=await life.getLauncherLife(pool,'fish-v3-client',new Date(),cap);return life.commandLauncherLife(pool,'fish-v3-client',{type,payload,requestId:'fish-v3-'+String(++serial).padStart(8,'0'),expectedRevision:state.life.revision},new Date(),cap);});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.stack||e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/launcher.html`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.OnePieceRoomMinigames);
  await page.evaluate(()=>{window.__v3=OnePieceRoomMinigames.create({command:async(type,payload)=>{const r=await __fishV3Service(type,payload);__FISH_V3.last=r;__FISH_V3.seq++;return r;},fishCollection:()=>__FISH_V3.last?.life?.fishCollection||[]});});
  const action=async name=>{const before=await page.evaluate(()=>__FISH_V3.seq);await page.locator(`[data-fish-action="${name}"]`).click();await page.waitForFunction(n=>__FISH_V3.seq>n&&!__v3.inspect().requesting,before,{timeout:8000});const state=await page.evaluate(()=>({ok:__FISH_V3.last?.ok,error:__FISH_V3.last?.error}));assert.equal(state.ok,true,JSON.stringify({name,state}));};
  for(let cast=0;cast<3;cast++){
    if(cast===1)await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>__v3.open({kind:'fishing',characterId:'room-character-luffy'}));
    verify('standalone fishing title',await page.locator('#roomMinigameTitle').innerText(),'千陽號海釣');
    verify('bait options visible',await page.locator('.room-fishing-v3-bait').count(),3);
    verify('spot options visible',await page.locator('.room-fishing-v3-spot').count(),3);
    if(cast<2)await page.screenshot({path:path.join(out,cast===0?'v3-intro-desktop.png':'v3-intro-mobile.png')});
    if(cast===0){await page.locator('[data-bait="shrimp"]').click();await page.locator('[data-spot="deep"]').click();}
    else if(cast===1){await page.locator('[data-bait="shrimp"]').click();await page.locator('[data-spot="reef"]').click();}
    else{await page.locator('[data-bait="worm"]').click();await page.locator('[data-spot="shore"]').click();}
    await page.getByRole('button',{name:'帶上魚餌 · 前往釣點'}).click();await page.waitForSelector('.room-fishing-v3-sea[data-stage=cast]');
    const start=await page.evaluate(()=>__FISH_V3.last.minigame);verify('single cast is one round',start.totalRounds,1);verify('fishing v3 version',start.challenge.fishingVersion,3);
    const zone=['far','near','mid'][cast];
    if(cast===0){await page.locator('#roomMinigameOverlay').press('ArrowUp');verify('keyboard changes cast target',await page.locator('.room-fishing-v3-sea').getAttribute('data-cast-zone'),'far');}
    else await page.locator(`.room-fishing-v3-zone[data-cast-zone="${zone}"]`).click();
    verify('aim selection is visible',await page.locator(`.room-fishing-v3-zone[data-cast-zone="${zone}"]`).getAttribute('aria-pressed'),'true');
    const seaBox=await page.locator('.room-fishing-v3-sea').boundingBox(),castControl=await page.locator('[data-fish-action="cast"]').boundingBox(),viewport=page.viewportSize();
    verify('sea keeps readable size',seaBox.width>=(cast===0?700:300)&&seaBox.height>=(cast===0?440:320),true);
    verify('cast control visible with target',castControl.height>=44&&castControl.y+castControl.height<=viewport.height,true);
    verify('selected ground art is local',await page.locator('.room-fishing-v3-sea').evaluate(el=>getComputedStyle(el).backgroundImage.includes(`sea-${el.dataset.spot}.webp`)),true);
    if(cast<2)await page.screenshot({path:path.join(out,cast===0?'v3-cast-desktop.png':'v3-cast-mobile.png')});
    await action('cast');await page.waitForSelector('.room-fishing-v3-sea[data-stage=wait]');
    verify('server persists chosen cast zone',await page.evaluate(()=>__FISH_V3.last.minigame.challenge.castZone),zone);
    verify('client float follows chosen zone',await page.locator('.room-fishing-v3-sea').getAttribute('data-cast-zone'),zone);
    verify('hook unavailable before sink',await page.locator('[data-fish-action="hook"]').isDisabled(),true);
    await page.waitForFunction(()=>document.querySelector('.room-fishing-v3-sea')?.dataset.biting==='true',null,{timeout:10000});
    await action('hook');await page.waitForSelector('.room-fishing-v3-sea[data-stage=fight]');
    if(cast<2)await page.screenshot({path:path.join(out,cast===0?'v3-fight-desktop.png':'v3-fight-mobile.png')});
    let attempts=0;
    while(await page.locator('.room-fishing-v3-sea').count()){
      if(++attempts>75)throw Error('Fight exceeded 75 actions');
      const status=await page.evaluate(()=>({direction:document.querySelector('.room-fishing-v3-sea')?.dataset.pullDirection,tension:Number(document.querySelector('.room-fishing-v2-meter.tension .room-fishing-v2-meter-title span')?.textContent.replace(/\D/g,''))}));
      const move=status.direction==='left'?'steerRight':status.direction==='right'?'steerLeft':status.direction==='deep'?'slack':status.tension>=70?'slack':'reel';
      await page.waitForTimeout(275);await action(move);
      if(await page.locator('.room-fishing-v3-sea').count()===0)break;
    }
    await page.waitForSelector('.room-fishing-v3-result',{timeout:12000});
    const result=await page.evaluate(()=>__FISH_V3.last.minigame.result);
    verify('one successful cast creates one fish',Boolean(result?.catch?.id),true);
    verify('fishing grants no coins',result.coins,0);
    const collection=await page.evaluate(()=>__FISH_V3.last.life.fishCollection);verify('collection grows one fish per cast',collection.length,cast+1);
    await page.waitForTimeout(900);
    await page.screenshot({path:path.join(out,`v3-result-${cast+1}-${cast===0?'desktop':'mobile'}.png`)});
    if(cast===0){
      verify('newly caught species uses v3 art',new Set(['cola-sunfish','reef-shark','elephant-tuna']).has(result.catch.speciesId),true);
      await page.getByRole('button',{name:'放進水族箱'}).click();
      verify('new fish placed in aquarium',await page.evaluate(()=>__FISH_V3.last.life.fishCollection.some(fish=>fish.inAquarium&&fish.id===__FISH_V3.last.fish.id)),true);
      const aquarium=await page.evaluate(async()=>{
        const stage=document.createElement('div'),furniture=document.createElement('div'),windowNode=document.createElement('div');furniture.className='room-aquarium-furniture';furniture.dataset.rotation='0';windowNode.className='room-aquarium-window';furniture.append(windowNode);stage.append(furniture);document.body.append(stage);
        OnePieceRoomAquarium.render({stage,room:{sceneId:'room-scene-default'},fishCollection:__FISH_V3.last.life.fishCollection});
        const sprite=stage.querySelector('.room-aquarium-fish img');await sprite?.decode().catch(()=>{});const state={count:stage.dataset.aquariumFishCount,src:sprite?.src,loaded:!!sprite?.naturalWidth};stage.remove();return state;
      });
      verify('new fish rendered in room aquarium',aquarium.count,'1');
      verify('aquarium points at v3 fish art',aquarium.src?.includes('/fish_v3/'),true);
      verify('aquarium v3 fish art loads',aquarium.loaded,true);
    }
    await page.getByRole('button',{name:'返回房間'}).click();
  }
  verify('no browser errors',errors.length,0);
  fs.writeFileSync(path.join(out,'FISHING_V3_CLIENT_QA.json'),JSON.stringify({status:'PASS',checks:checks.length,errors,screenshots:fs.readdirSync(out).filter(name=>/^v3-.*\.png$/.test(name))},null,2));
  console.log(JSON.stringify({status:'PASS',checks:checks.length,report:path.join(out,'FISHING_V3_CLIENT_QA.json')}));
}
main().catch(e=>{console.error(e.stack||e);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));});
