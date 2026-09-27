'use strict';
// Real room renderer, navigation, docking and decoded art. No production account is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {CATALOG}=require('../server/launcher-profile-shop');
const runtime='C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const {chromium}=require(fs.readdirSync(runtime).map(name=>path.join(runtime,name,'bin/node_modules/playwright')).find(p=>fs.existsSync(path.join(p,'package.json'))));
const root=path.resolve(__dirname,'..'),out=process.env.LAUNCHER_LIFE_CONTACT_OUT||'C:/Codex_Candidates/launcher-life-qa-1.2.0/contact';
const read=file=>fs.readFileSync(path.join(root,'desktop',file),'utf8');
const scripts=['launcher-room-dialogue.js','launcher-room-motion-data.js','launcher-room-motion.js','launcher-life-data.js','launcher-life-actions.js','launcher-life.js','launcher-life-room.js','launcher-room.js'];
const cases=[['sanji','galley-stove','cook'],['brook','piano','music'],['jinbe','helm','helm'],['usopp','tool-bench','craft'],['franky','tool-bench','craft'],['chopper','medicine-cabinet','medicine'],['nami','map-table','read'],['robin','bookshelf','read']];
async function run(){
 fs.mkdirSync(out,{recursive:true});
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}),results=[];
 const filter=process.argv[2];
 try{for(const [key,furniture,clip] of cases.filter(v=>!filter||v[0]===filter))for(const rotation of [0,1,2,3].filter(value=>process.argv[3]===undefined||value===Number(process.argv[3]))){
  const id=`${key}-${furniture}-r${rotation}`,page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.route('opui://**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');const p=path.resolve(root,'public',rel);return p.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(p)?route.fulfill({path:p}):route.fulfill({status:404,body:'missing'});});
  try {
   const html=read('launcher.html').replace(/<meta[^>]+Content-Security-Policy[^>]+>/i,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'').replace('<body data-stage="boot">','<body data-stage="app">').replace('<main class="launcher-app screen" id="launcherApp" hidden>','<main class="launcher-app screen is-active" id="launcherApp">');
   await page.setContent(html);await page.addStyleTag({content:['launcher.css','launcher-social.css','launcher-profile-shop.css','launcher-room.css'].map(read).join('\n')});
   await page.evaluate(({catalog,key,furniture,rotation})=>{
    window.__LAUNCHER_ROOM_QA__=true;
    const actor=catalog.find(v=>v.id==='room-character-'+key),object=catalog.find(v=>v.id==='room-furniture-'+furniture);
    const p={itemId:object.id,x:480,y:390,scale:1,rotation},c={itemId:actor.id,x:420,y:452};
    const profile={userId:100,isSelf:true,name:'接點檢查',collection:{launcher:{itemIds:[actor.id,object.id]}},room:{revision:1,capacityVersion:2,sceneId:'room-scene-default',placements:[p],characters:[c]},roomItems:{scene:null,placements:[{...p,item:object}],characters:[{...c,item:actor}]},companions:[{itemId:actor.id,affinity:30}]};
    const life={schemaVersion:1,revision:1,ownedCharacterIds:[actor.id],activeCharacterIds:[actor.id],characters:{[actor.id]:{itemId:actor.id,key,needs:{energy:80,hunger:25,mood:75,social:75,workMotivation:70},memories:[]}},pairs:{},jobs:[],pendingArrivals:[],directive:'free_day',recentEvents:[],offlineSummary:{elapsedMs:0,completedJobs:0,coins:0}};
    const calls=[];window.__fixture={profile,life,calls};
    const response=extra=>structuredClone({ok:true,serverNow:new Date().toISOString(),profile,room:profile.room,life,wallet:{coins:100,cap:500},...extra});
    window.onePieceDesktop={getLauncherLife:async()=>response(),getLauncherCharacter:async()=>({ok:true,character:profile.companions[0]}),getLauncherShop:async()=>({ok:true,shop:{catalog,owned:{roomCharacters:[actor.id],roomFurniture:[object.id],roomScenes:[]},wallet:{coins:100,cap:500}}}),commandLauncherLife:async cmd=>{
     calls.push({type:cmd.type,payload:cmd.payload,at:Date.now()});life.revision++;
     if(cmd.type==='work.reserve'){const job={jobId:'contact-job',itemId:actor.id,stationId:object.id,status:'reserved',durationMs:60000,roomRevision:1,reservedAt:new Date().toISOString(),reward:10};life.jobs=[job];return response({job});}
     if(cmd.type==='work.activate'){const job=life.jobs[0];job.status='active';job.activatedAt=new Date().toISOString();job.readyAt=new Date(Date.now()+job.durationMs).toISOString();return response({job});}
     if(cmd.type==='work.cancel')life.jobs=[];
     return response();
    }};
    document.getElementById('bootScreen').hidden=true;document.getElementById('profilePanel').hidden=false;document.getElementById('libraryPanel').hidden=true;
   },{catalog:CATALOG,key,furniture,rotation});
   for(const file of scripts)await page.addScriptTag({content:read(file)});
   await page.evaluate(()=>{LauncherRoom.setProfile(__fixture.profile,{accountId:100});LauncherRoom.onVisible('profile');});
   await page.waitForFunction(({key,clip})=>__launcherRoomTest.snapshot().life&&OnePieceLifeActions.preload(key,clip,'south')?.ready,{key,clip},{timeout:25000});
   await page.evaluate(key=>__launcherRoomTest.lifeCancel(key),key);
   await page.waitForTimeout(250);
   const assigned=await page.evaluate(({key,furniture})=>__launcherRoomTest.lifeAssign(key,'room-furniture-'+furniture),{key,furniture});
   assert(assigned.ok,JSON.stringify(assigned));
   await page.waitForFunction(()=>__fixture.calls.some(c=>c.type==='work.activate'),null,{timeout:90000});
   await page.waitForFunction(clip=>document.querySelector('#roomCharacters [data-room-key]')?.dataset.pose===clip,clip,{timeout:90000});
   const initial=await page.evaluate(()=>({state:__launcherRoomTest.snapshot(),world:__launcherRoomTest.lifeWorld(),calls:__fixture.calls}));
   assert(initial.calls.some(c=>c.type==='work.activate'));
   const selector='#roomCharacters [data-room-key]';
   const directions=await page.locator(selector).getAttribute('data-motion-direction');
   const frames=[];
   for(let i=0;i<4;i++){
    await page.waitForFunction(({clip,i})=>{const n=document.querySelector('#roomCharacters [data-room-key]');return n?.dataset.pose===clip&&Number(n.dataset.actionFrame)===i;},{clip,i},{timeout:12000});
    const stageImage=path.join(out,`${id}-f${i}-room.png`);
    await page.locator('#roomStage').screenshot({path:stageImage});
    const actor=await page.evaluate(()=>__launcherRoomTest.snapshot().walkers[0]);
    require('node:child_process').execFileSync('python',[path.join(__dirname,'launcher_life_contact_crop.py'),stageImage,path.join(out,`${id}-f${i}.png`),String(actor.x),String(actor.y)]);
    frames.push(await page.locator(selector).getAttribute('data-action-frame'));
   }
   await page.locator('#roomStage').screenshot({path:path.join(out,`${id}-room.png`)});
   assert.deepEqual(errors,[]);results.push({id,key,furniture,clip,rotation,frames,directions,pass:true,state:initial.state,calls:initial.calls});
  } catch(error){await page.screenshot({path:path.join(out,`${id}-failure.png`),fullPage:true});const state=await page.evaluate(()=>window.__launcherRoomTest?.snapshot());fs.writeFileSync(path.join(out,`${id}-failure.json`),JSON.stringify({error:error.stack,state,errors},null,2));throw error;}
  finally{await page.close();}
  fs.writeFileSync(path.join(out,`report-${filter||'all'}${process.argv[3]===undefined?'':'-r'+process.argv[3]}.json`),JSON.stringify({ok:true,scope:'Real renderer and art, isolated fixture server; numeric pass is not human visual approval.',results},null,2));
  console.log(JSON.stringify({ok:true,id}));
 }}finally{await browser.close();}
}
run().catch(error=>{console.error(error);process.exitCode=1;});
