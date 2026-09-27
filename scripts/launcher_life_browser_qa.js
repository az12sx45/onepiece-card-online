'use strict';
// Actual renderer and authored artwork; server replies are isolated fixtures.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const runtime='C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const playwright=fs.readdirSync(runtime).map(name=>path.join(runtime,name,'bin/node_modules/playwright')).find(p=>fs.existsSync(path.join(p,'package.json')));
const {chromium}=require(playwright);
const {CATALOG}=require('../server/launcher-profile-shop');
const root=path.resolve(__dirname,'..'),out=process.env.LAUNCHER_LIFE_QA_OUT||'C:/Codex_Candidates/launcher-life-qa-1.2.0/browser';
fs.mkdirSync(out,{recursive:true});
const read=file=>fs.readFileSync(path.join(root,'desktop',file),'utf8');
const files=['launcher-room-dialogue.js','launcher-room-motion-data.js','launcher-room-motion.js','launcher-life-data.js','launcher-life-actions.js','launcher-life.js','launcher-life-room.js','launcher-room.js'];
async function main(){
  const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const page=await browser.newPage({viewport:{width:1366,height:1050}}),errors=[],calls=[],results=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  await page.route('opui://**',route=>{
    const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    const file=path.resolve(root,'public',rel);
    return file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Not generated yet'});
  });
  try{
    let html=read('launcher.html').replace(/<meta[^>]+Content-Security-Policy[^>]+>/i,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'')
      .replace('<body data-stage="boot">','<body data-stage="app">')
      .replace('<main class="launcher-app screen" id="launcherApp" hidden>','<main class="launcher-app screen is-active" id="launcherApp">');
    await page.setContent(html,{waitUntil:'domcontentloaded'});
    await page.addStyleTag({content:['launcher.css','launcher-social.css','launcher-profile-shop.css','launcher-room.css'].map(read).join('\n')});
    await page.evaluate(catalog=>{
      window.__LAUNCHER_ROOM_QA__=true;
      const item=catalog.find(p=>p.id==='room-character-sanji'),furniture=catalog.find(p=>p.id==='room-furniture-kitchen-table');
      const character={itemId:item.id,x:460,y:422};const placed={itemId:furniture.id,x:480,y:370,scale:1,rotation:0};
      const profile={userId:42,isSelf:true,name:'生活基地測試',collection:{launcher:{itemIds:[item.id,furniture.id]}},
        room:{revision:1,capacityVersion:2,sceneId:'room-scene-default',placements:[placed],characters:[character]},
        roomItems:{scene:null,placements:[{...placed,item:furniture}],characters:[{...character,item}]},companions:[{itemId:item.id,affinity:12,talksRemainingToday:6}]};
      const life={schemaVersion:1,revision:1,ownedCharacterIds:[item.id],activeCharacterIds:[item.id],characters:{[item.id]:{itemId:item.id,key:'sanji',needs:{energy:85,hunger:20,mood:70,social:70,workMotivation:70},memories:[]}},pairs:{},jobs:[],pendingArrivals:[],directive:'free',recentEvents:[],offlineSummary:{elapsedMs:0,completedJobs:0,coins:0}};
      window.__lifeFixture={profile,life,calls:[],wallet:{coins:100,cap:500},receipts:[]};
      function response(extra={}){return structuredClone({ok:true,serverNow:new Date().toISOString(),profile,room:profile.room,life,wallet:window.__lifeFixture.wallet,...extra});}
      window.onePieceDesktop={
        getLauncherLife:async()=>response(),
        getLauncherCharacter:async()=>({ok:true,character:profile.companions[0]}),
        getLauncherShop:async()=>({ok:true,shop:{catalog,wallet:window.__lifeFixture.wallet,owned:{roomCharacters:[item.id],roomFurniture:[furniture.id],roomScenes:[]}}}),
        commandLauncherLife:async command=>{
          const f=window.__lifeFixture;f.calls.push({...command,at:Date.now(),walkers:window.__launcherRoomTest?.snapshot()?.walkers});life.revision++;
          if(command.type==='work.reserve'){
            const job={jobId:'fixture-job-1',itemId:item.id,stationId:command.payload.stationId,status:'reserved',durationMs:18000,roomRevision:1,reservedAt:new Date().toISOString(),reward:10};life.jobs=[job];return response({job});
          }
          if(command.type==='work.activate'){const job=life.jobs[0];job.status='active';job.activatedAt=new Date().toISOString();job.readyAt=new Date(Date.now()+job.durationMs).toISOString();return response({job});}
          if(command.type==='work.complete'){if(!f.receipts.length){f.wallet.coins+=10;f.receipts.push({jobId:'fixture-job-1',amount:10,operationId:'fixture-pay-1'});}life.jobs=[];return response({receipt:f.receipts[0]});}
          if(command.type==='work.cancel'){life.jobs=[];return response();}
          if(command.type==='directive.set'){life.directive=command.payload.directiveId;return response();}
          if(command.type==='arrival.ack'){life.pendingArrivals=[];return response();}
          return response();
        }
      };
      document.getElementById('bootScreen').hidden=true;document.body.dataset.stage='app';document.getElementById('profilePanel').hidden=false;document.getElementById('libraryPanel').hidden=true;
    },CATALOG);
    for(const file of files)await page.addScriptTag({content:read(file)});
    await page.evaluate(()=>{window.LauncherRoom.setProfile(window.__lifeFixture.profile,{accountId:42});window.LauncherRoom.onVisible('profile');});
    await page.waitForFunction(()=>window.__launcherRoomTest?.snapshot()?.life?.ownedCharacterIds?.length===1,null,{timeout:15000});
    await page.waitForFunction(()=>window.__launcherRoomTest.snapshot().walkers[0]?.ready.length===4,null,{timeout:15000});
    results.push({name:'real Life module initializes with only purchased actor',pass:await page.locator('#roomCharacters [data-room-key]').count()===1});
    await page.locator('#roomCharacters [data-room-key]').click();
    await page.locator('#roomLifeWork').click();
    await page.locator('#roomLifeWorkChoices button').filter({hasText:'備餐區'}).click();
    await page.waitForFunction(()=>window.__lifeFixture.calls.some(c=>c.type==='work.activate'),null,{timeout:60000});
    const activated=await page.evaluate(()=>({calls:window.__lifeFixture.calls,state:window.__launcherRoomTest.snapshot(),source:document.querySelector('#roomCharacters [data-room-key]').dataset.actionSource}));
    fs.writeFileSync(path.join(out,'activation.json'),JSON.stringify(activated,null,2));
    assert.equal(activated.source,'life_v1');
    assert.deepEqual(activated.calls.filter(c=>c.type.startsWith('work.')).slice(0,2).map(c=>c.type),['work.reserve','work.activate']);
    const actor=activated.calls.find(c=>c.type==='work.activate').walkers[0];assert.equal(actor.route.length,0);
    results.push({name:'real BFS arrival and decoded whole-body work loop precede activation',pass:true});
    const pngHashes=[];
    for(let i=0;i<4;i++){
      await page.waitForTimeout(330);
      const png=await page.locator('#roomStage').screenshot({path:path.join(out,`sanji-work-${i}.png`)});
      pngHashes.push(crypto.createHash('sha256').update(png).digest('hex'));
    }
    assert(new Set(pngHashes).size>=3);results.push({name:'visible loop changes real drawn frame over time',pass:true});
    await page.waitForFunction(()=>window.__lifeFixture.calls.some(c=>c.type==='work.complete'),null,{timeout:40000});
    assert.equal(await page.evaluate(()=>window.__lifeFixture.wallet.coins),110);
    results.push({name:'fixture receipt reaches existing marketplace wallet',pass:true});
    await page.locator('#roomLifeStatus').click();
    await page.screenshot({path:path.join(out,'desktop-life.png'),fullPage:true});
    await page.setViewportSize({width:390,height:844});
    await page.screenshot({path:path.join(out,'narrow-life.png'),fullPage:true});
    const width=await page.evaluate(()=>({body:document.body.scrollWidth,viewport:innerWidth}));assert(width.body<=width.viewport+1);
    results.push({name:'390px page has no horizontal overflow',pass:true});
    assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({ok:true,results,errors,scope:'Real Chromium renderer and GPT art; fixture server, no real purchase, database or deployment acceptance.'},null,2));
    console.log(JSON.stringify({ok:true,checks:results.length,out}));
  }catch(error){
    fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({error:error.stack,errors,results,snapshot:await page.evaluate(()=>window.__launcherRoomTest?.snapshot()).catch(()=>null)},null,2));
    await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});throw error;
  }finally{await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
