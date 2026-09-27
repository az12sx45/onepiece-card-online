'use strict';
// Real Chromium, production room/BFS/whole-body renderer and local GPT assets.
// IPC replies are isolated fixtures; the Playwright clock drives real animation
// frames deterministically. No real purchase, DB, device or deployment claims.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const runtime='C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const playwright=fs.readdirSync(runtime).map(name=>path.join(runtime,name,'bin/node_modules/playwright')).find(p=>fs.existsSync(path.join(p,'package.json')));
const {chromium}=require(playwright);
const sourceRoot=path.resolve(__dirname,'..');
const {CATALOG}=require(sourceRoot+'/server/launcher-profile-shop');
const root=path.resolve(__dirname,'..');
const out=process.env.LAUNCHER_LIFE_INTEGRATION_OUT||path.join(sourceRoot,'tools/launcher-room/presentation-v123/review-evidence');
const read=file=>fs.readFileSync(fs.existsSync(path.join(root,'desktop',file))?path.join(root,'desktop',file):path.join(sourceRoot,'desktop',file),'utf8');
const files=['launcher-room-dialogue.js','launcher-room-motion-data.js','launcher-room-motion.js','launcher-life-data.js','launcher-life-actions.js','launcher-life.js','launcher-life-room.js','launcher-room.js'];
const keys=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
fs.mkdirSync(out,{recursive:true});
let browser;const results=[];
const sourceHashes=()=>Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')]));

async function create(options={}) {
  const page=await browser.newPage({viewport:{width:1366,height:1050}}),errors=[];
  page.on('pageerror',error=>errors.push(error.stack||error.message));
  await page.route('opui://**',route=>{
    const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,'');
    const file=path.resolve(sourceRoot,'public',rel);
    return file.startsWith(path.join(sourceRoot,'public')+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Artwork not available'});
  });
  await page.clock.install({time:new Date('2026-09-27T04:00:00Z')});
  let html=read('launcher.html').replace(/<meta[^>]+Content-Security-Policy[^>]+>/i,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'')
    .replace('<body data-stage="boot">','<body data-stage="app">').replace('<main class="launcher-app screen" id="launcherApp" hidden>','<main class="launcher-app screen is-active" id="launcherApp">');
  await page.setContent(html,{waitUntil:'domcontentloaded'});
  await page.addStyleTag({content:['launcher.css','launcher-social.css','launcher-profile-shop.css','launcher-room.css'].map(read).join('\n')});
  await page.evaluate(({catalog,options})=>{
    window.__LAUNCHER_ROOM_QA__=true;Math.random=()=>0;
    const clone=v=>structuredClone(v),item=id=>catalog.find(p=>p.id===id);
    function point(col,row,width=1,height=1){const y=267+248*(row+height)/8,depth=(row+height)/8,left=164+(28-164)*depth,right=796+(932-796)*depth;return{x:left+(right-left)*(col+width/2)/16,y};}
    function fixture(userId,owned,placements=[]) {
      const chars=owned.map((key,i)=>({itemId:'room-character-'+key,...point(3+(i%5)*2,4+Math.floor(i/5))}));
      const furniture=placements.map(p=>({itemId:'room-furniture-'+p.key,...point(p.col??7,p.row??2,p.width??3,p.height??2),scale:1,rotation:p.rotation||0}));
      const ids=chars.map(c=>c.itemId),room={revision:1,capacityVersion:2,sceneId:'room-scene-default',characters:chars,placements:furniture};
      const life={schemaVersion:1,revision:1,ownedCharacterIds:ids,activeCharacterIds:ids,characters:Object.fromEntries(owned.map(key=>['room-character-'+key,{key,itemId:'room-character-'+key,needs:{energy:85,hunger:20,mood:70,social:70,workMotivation:70},memories:[]}])),pairs:{},jobs:[],pendingArrivals:[],directive:'free_day',recentEvents:[],offlineSummary:{elapsedMs:0,completedJobs:0,coins:0}};
      const profile={userId,isSelf:true,name:'隔離整合測試 '+userId,life,collection:{launcher:{itemIds:[...ids,...furniture.map(x=>x.itemId)]}},room,
        roomItems:{scene:null,placements:furniture.map(p=>({...p,item:item(p.itemId)})),characters:chars.map(p=>({...p,item:item(p.itemId)}))},companions:chars.map(c=>({itemId:c.itemId,affinity:12,talksRemainingToday:6}))};
      return{profile,life,wallet:{coins:100,cap:500}};
    }
    const f=window.__integration={db:{42:fixture(42,options.owned||[],options.furniture||[]),43:fixture(43,['zoro'])},accountId:options.visitor?99:42,calls:[],gets:[],held:[],hold:options.holdGet?'get':'',walletUpdates:[],sequence:0};
    if(options.persisted)f.db[42]=clone(options.persisted);
    function response(id,extra={}){const db=f.db[id];return clone({ok:true,serverNow:new Date().toISOString(),...db,room:db.profile.room,...extra});}
    function defer(kind,build){if(f.hold!==kind)return Promise.resolve(build());f.hold='';return new Promise(resolve=>f.held.push(()=>resolve(build())));}
    function command(body,id){
      const db=f.db[id],life=db.life;let job,receipt;life.revision++;
      if(body.type==='work.reserve') {job={jobId:'mock-'+(++f.sequence),itemId:body.payload.itemId,stationId:body.payload.stationId,status:'reserved',durationMs:180000,roomRevision:db.profile.room.revision,reservedAt:new Date().toISOString(),reward:10};life.jobs.push(job);}
      else if(body.type==='work.activate'){job=life.jobs.find(j=>j.jobId===body.payload.jobId);if(!job)return{ok:false,error:'unknown_job'};job.status='active';job.activatedAt=new Date().toISOString();job.readyAt=new Date(Date.now()+job.durationMs).toISOString();}
      else if(body.type==='work.cancel')life.jobs=life.jobs.filter(j=>j.jobId!==body.payload.jobId);
      else if(body.type==='work.complete'){life.jobs=life.jobs.filter(j=>j.jobId!==body.payload.jobId);receipt={jobId:body.payload.jobId,amount:10};db.wallet.coins+=10;}
      else if(body.type==='arrival.ack')life.pendingArrivals=life.pendingArrivals.filter(a=>a.arrivalId!==body.payload.arrivalId);
      else if(body.type==='character.interact'&&body.payload.action==='gift')db.wallet.coins-=5;
      else if(body.type==='event.record')life.recentEvents.push({id:body.payload.eventId,timestamp:Date.now()});
      else if(body.type==='directive.set')life.directive=body.payload.directiveId;
      return response(id,{job,receipt});
    }
    window.LauncherProfileShop={onCompanionWalletChanged:wallet=>f.walletUpdates.push({accountId:f.accountId,...clone(wallet)})};
    window.onePieceDesktop={
      getLauncherLife:()=>{const id=f.accountId;f.gets.push(id);return defer('get',()=>response(id));},
      commandLauncherLife:body=>{const id=f.accountId;f.calls.push({accountId:id,...clone(body),at:Date.now(),state:window.__integrationSnapshot?.()});return defer(body.type,()=>command(body,id));},
      getLauncherShop:async()=>({ok:true,shop:{catalog,wallet:f.db[f.accountId]?.wallet||{coins:0},owned:{roomCharacters:f.db[f.accountId]?.life.ownedCharacterIds||[],roomFurniture:f.db[f.accountId]?.profile.room.placements.map(p=>p.itemId)||[],roomScenes:[]}}}),
      getLauncherCharacter:async id=>({ok:true,character:f.db[f.accountId]?.profile.companions.find(c=>c.itemId===id)||{itemId:id,affinity:0}}),
      saveLauncherRoom:async()=>{f.calls.push({type:'saveLauncherRoom'});return{ok:false,error:'fixture_not_enabled'};}
    };
    f.use=(userId,accountId=userId)=>{f.accountId=accountId;const profile=clone(f.db[userId].profile);profile.isSelf=userId===accountId;window.LauncherRoom.setProfile(profile,{accountId});window.LauncherRoom.onVisible('profile');};
    f.refresh=()=>{const profile=clone(f.db[42].profile);window.LauncherRoom.setProfile(profile,{accountId:42});};
    f.purchase=key=>{const old=f.db[42],next=fixture(42,[...old.life.ownedCharacterIds.map(id=>id.replace('room-character-','')),key],options.furniture||[]);next.life.revision=old.life.revision+1;next.profile.room.revision=old.profile.room.revision+1;next.life.pendingArrivals=[{arrivalId:'arrival-'+key,itemId:'room-character-'+key,createdAt:new Date().toISOString()}];f.db[42]=next;f.use(42);window.LauncherRoom.onPurchase(response(42),'room-character-'+key);};
    f.resolve=()=>{const next=f.held.shift();if(next)next();};
    f.response=response;
    document.getElementById('bootScreen').hidden=true;document.body.dataset.stage='app';document.getElementById('profilePanel').hidden=false;document.getElementById('libraryPanel').hidden=true;
  },{catalog:CATALOG,options});
  for(const file of files){
    await page.addScriptTag({content:read(file)});
    if(file==='launcher-life-data.js')await page.evaluate(()=>{
      // Only random autonomous choice is suppressed in the fixture. Explicit
      // events keep real authored definitions, eligibility and navigation.
      const data=window.OnePieceLifeData,zero=Object.fromEntries(['Idle','Wander','Work','Eat','Rest','Sleep','Train','Socialize','UseFurniture','SpecialAction'].map(state=>[state,0]));
      window.OnePieceLifeData={...data,characters:Object.fromEntries(Object.entries(data.characters).map(([key,value])=>[key,{...value,weights:{...zero,Idle:1}}]))};
      window.OnePieceRoomDialogue={...window.OnePieceRoomDialogue,scene:()=>null};
    });
  }
  await page.evaluate(options=>{
    window.__integrationSnapshot=()=>{const snapshot=window.__launcherRoomTest.snapshot();return{...snapshot,now:Date.now(),editing:!document.getElementById('roomEditor').hidden,
      nodes:Array.from(document.querySelectorAll('#roomCharacters [data-room-key]')).map(node=>({key:node.dataset.roomKey.replace('c:room-character-',''),hidden:node.hidden,pose:node.dataset.pose,source:node.dataset.actionSource,frame:node.dataset.actionFrame,speech:node.querySelector('.room-speech')?.hidden?'':node.querySelector('.room-speech-text')?.textContent||''}))};};
    window.__integration.use(42,options.visitor?99:42);
  },options);
  if(!options.holdGet)await page.waitForFunction(()=>!!window.__launcherRoomTest.snapshot().life,null,{timeout:20000});
  await page.waitForFunction(()=>window.__launcherRoomTest.snapshot().walkers.every(w=>w.ready.length===4),null,{timeout:20000});
  await page.evaluate(async()=>{const promises=[];for(const key of window.__integration.db[42].life.ownedCharacterIds.map(id=>id.replace('room-character-','')))for(const clip of ['work','eat','train']){const record=window.OnePieceLifeActions.preload(key,clip,'south');if(record?.promise)promises.push(record.promise);}await Promise.all(promises);});
  await page.clock.pauseAt(new Date('2026-09-27T04:00:04Z'));
  return{page,errors};
}
const snap=page=>page.evaluate(()=>window.__integrationSnapshot());
async function advance(page,ms,observer){for(let elapsed=0;elapsed<ms;elapsed+=500){await page.clock.runFor(Math.min(500,ms-elapsed));if(observer)await observer(await snap(page));}}
async function until(page,predicate,limit=90000){const trail=[];for(let t=0;t<=limit;t+=500){const state=await snap(page);trail.push(state);if(await predicate(state))return trail;if(t<limit)await advance(page,500);}throw new Error('Timed out; latest state '+JSON.stringify(trail.at(-1)));}
function exactActors(state,owned){assert.deepEqual(state.walkers.map(w=>w.key).sort(),[...owned].sort());assert.deepEqual(state.nodes.map(n=>n.key).sort(),[...owned].sort());assert(state.life.ownedCharacterIds.every(id=>owned.includes(id.replace('room-character-',''))));}
function exclusive(state){const cells=state.life.reservations.map(r=>r.cell.col+':'+r.cell.row);assert.equal(new Set(cells).size,cells.length,'reserved floor goals do not overlap');const slots=state.life.reservations.filter(r=>r.stationId).map(r=>r.stationId+':'+r.slotId);assert.equal(new Set(slots).size,slots.length,'station slots are exclusive');}
async function scenario(name,options,test){if(process.env.LAUNCHER_LIFE_INTEGRATION_FILTER&&!new RegExp(process.env.LAUNCHER_LIFE_INTEGRATION_FILTER).test(name))return;const {page,errors}=await create(options);try{const detail=await test(page);assert.deepEqual(errors,[]);results.push({name,pass:true,...detail});console.log('PASS '+name);}catch(error){const state=await snap(page).catch(()=>null);fs.writeFileSync(path.join(out,name+'-failure.json'),JSON.stringify({error:error.stack,state,errors},null,2));await page.screenshot({path:path.join(out,name+'-failure.png'),fullPage:true}).catch(()=>{});results.push({name,pass:false,error:error.message});console.log('FAIL '+name+': '+error.message.slice(0,200));}finally{await page.close();}}
async function main(){
  const startedSources=sourceHashes();
  browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  try{
    for(const count of [0,1,2,10])await scenario('ownership-'+count,{owned:keys.slice(0,count)},async page=>{
      await advance(page,3000,state=>exactActors(state,keys.slice(0,count)));
      const pool=await page.evaluate(()=>window.__launcherRoomTest.lifePool());assert(pool.every(e=>e.requiredCharacters.every(key=>keys.slice(0,count).includes(key))));
      if(count===10)await page.locator('#roomStage').screenshot({path:path.join(out,'ten-owned-actors.png')});
      return{actorCount:count,poolCount:pool.length};
    });
    await scenario('arrival-once',{owned:[]},async page=>{
      await page.evaluate(async()=>{await Promise.all([window.OnePieceRoomMotion.preload('luffy').promise,window.OnePieceRoomMotion.preloadActions('luffy').promise]);});
      await page.evaluate(()=>window.__integration.purchase('luffy'));
      const queued=await snap(page);
      assert(queued.nodes[0].hidden||queued.life.tasks.some(t=>t.key==='luffy'&&t.token.startsWith('arrival-')),'unstarted arrival stays hidden instead of flashing at saved position');
      const trail=await until(page,async()=>page.evaluate(()=>window.__integration.calls.some(c=>c.type==='arrival.ack')));
      const moving=trail.filter(s=>s.life.tasks.some(t=>t.key==='luffy'&&t.phase==='approach'));
      assert(moving.length>2);assert(moving.some(s=>s.walkers[0]?.cell.col===0&&s.walkers[0]?.cell.row===6));
      assert(trail.some(s=>s.nodes.some(n=>n.key==='luffy'&&n.pose==='wave')&&s.walkers[0]?.route.length===0));
      assert(moving.every(s=>s.walkers[0].route.every((cell,i,list)=>i===0||Math.abs(cell.col-list[i-1].col)+Math.abs(cell.row-list[i-1].row)===1)));
      const positions=moving.map(s=>s.walkers[0]);for(let i=1;i<positions.length;i++)assert(Math.hypot(positions[i].x-positions[i-1].x,positions[i].y-positions[i-1].y)<45,'no spawn teleport after entry');
      const ack=await page.evaluate(()=>window.__integration.calls.find(c=>c.type==='arrival.ack'));assert.equal(ack.state.walkers[0].route.length,0);
      await page.evaluate(()=>{window.__integration.refresh();window.LauncherRoom.onVisible('library');window.LauncherRoom.onVisible('profile');});await advance(page,5000);
      assert.equal(await page.evaluate(()=>window.__integration.calls.filter(c=>c.type==='arrival.ack').length),1);assert.equal((await snap(page)).life.pendingArrivals.length,0);
      const persisted=await page.evaluate(()=>structuredClone(window.__integration.db[42]));
      const reopened=await create({persisted});
      try {await advance(reopened.page,5000);assert.equal(await reopened.page.evaluate(()=>window.__integration.calls.filter(c=>c.type==='arrival.ack').length),0);assert.equal((await snap(reopened.page)).life.pendingArrivals.length,0);assert.deepEqual(reopened.errors,[]);}finally{await reopened.page.close();}
      fs.writeFileSync(path.join(out,'arrival-trajectory.json'),JSON.stringify(trail,null,2));return{entrySamples:moving.length,acknowledgements:1,freshControllerDidNotReplay:true};
    });
    await scenario('same-owner-refresh-position',{owned:['luffy']},async page=>{
      await page.evaluate(()=>{window.__launcherRoomTest.lifeCancel('luffy');window.__launcherRoomTest.route('luffy',{col:12,row:4});});await advance(page,1500);
      const before=await snap(page);await page.evaluate(()=>window.__integration.refresh());const after=await snap(page);
      assert.equal(after.walkers[0].x,before.walkers[0].x);assert.equal(after.walkers[0].y,before.walkers[0].y);assert.deepEqual(after.walkers[0].route,before.walkers[0].route);return{position:{x:after.walkers[0].x,y:after.walkers[0].y}};
    });
    await scenario('late-account-get',{owned:['luffy'],holdGet:true},async page=>{
      assert.equal(await page.evaluate(()=>window.__integration.held.length),1);await page.evaluate(()=>window.__integration.use(43));await advance(page,500);await page.evaluate(()=>window.__integration.resolve());await advance(page,1000);exactActors(await snap(page),['zoro']);assert(!(await snap(page)).life.characters.luffy);return{};
    });
    await scenario('late-account-command',{owned:['luffy']},async page=>{
      await page.evaluate(()=>{window.__integration.hold='character.interact';window.__lateInteraction=window.__launcherRoomTest.lifeInteract('luffy','gift');});
      assert.equal(await page.evaluate(()=>window.__integration.held.length),1);await page.evaluate(()=>window.__integration.use(43));await advance(page,500);const mark=await page.evaluate(()=>window.__integration.walletUpdates.length);
      await page.evaluate(()=>window.__integration.resolve());assert.equal((await page.evaluate(()=>window.__lateInteraction)).error,'stale');await advance(page,1000);exactActors(await snap(page),['zoro']);
      assert(!(await page.evaluate(mark=>window.__integration.walletUpdates.slice(mark),mark)).some(update=>update.coins===95));return{};
    });
    await scenario('late-owner-command',{owned:['luffy']},async page=>{
      await page.evaluate(()=>{window.__integration.hold='character.interact';window.__lateOwner=window.__launcherRoomTest.lifeInteract('luffy','gift');});
      await page.evaluate(()=>window.__integration.use(43,42));await advance(page,500);const mark=await page.evaluate(()=>window.__integration.walletUpdates.length);
      await page.evaluate(()=>window.__integration.resolve());assert.equal((await page.evaluate(()=>window.__lateOwner)).error,'stale');await advance(page,1000);
      const state=await snap(page);exactActors(state,['zoro']);assert.equal(state.life.writable,false);assert.equal(await page.evaluate(()=>window.__integration.walletUpdates.length),mark);return{};
    });
    await scenario('late-autoassign-ui',{owned:['luffy']},async page=>{
      await page.evaluate(()=>{window.__launcherRoomTest.lifeCancel('luffy');window.__integration.hold='work.reserve';window.__lateAuto=document.getElementById('roomLifeAutoAssign').onclick();});
      assert.equal(await page.evaluate(()=>window.__integration.held.length),1);await page.evaluate(()=>window.__integration.use(43));await advance(page,500);
      const before=await page.locator('#roomCompanionStatus').textContent();await page.evaluate(()=>window.__integration.resolve());await page.evaluate(()=>window.__lateAuto);
      assert.equal(await page.locator('#roomCompanionStatus').textContent(),before,'old auto-assignment must not write status into a new owner view');exactActors(await snap(page),['zoro']);return{};
    });
    await scenario('visitor-readonly',{owned:['luffy','zoro'],visitor:true},async page=>{
      for(const action of ['call','gift','train']){await advance(page,2000);const response=await page.evaluate(action=>window.__launcherRoomTest.lifeInteract('luffy',action),action);assert.equal(response.error,'readonly');}
      assert.equal((await page.evaluate(()=>window.__launcherRoomTest.lifeAssign('luffy','deck'))).ok,false);await advance(page,65000);
      assert.equal(await page.evaluate(()=>window.__integration.calls.length),0);assert.equal(await page.evaluate(()=>window.__integration.gets.length),0);return{};
    });
    await scenario('station-editor-release',{owned:['luffy','zoro'],furniture:[{key:'kitchen-table'}]},async page=>{
      assert((await page.evaluate(()=>window.__launcherRoomTest.lifeAssign('luffy','room-furniture-kitchen-table'))).ok);
      assert.equal((await page.evaluate(()=>window.__launcherRoomTest.lifeAssign('luffy','deck'))).error,'work_active');
      assert.equal((await page.evaluate(()=>window.__launcherRoomTest.lifeAssign('zoro','room-furniture-kitchen-table'))).ok,false);exclusive(await snap(page));
      await advance(page,1000);const before=await snap(page);await page.evaluate(()=>window.LauncherRoom.openEditor());let state=await snap(page);assert(state.editing&&state.life.paused);assert.equal(state.life.reservations.length,0);
      await page.locator('#roomCancel').click();state=await snap(page);assert(!state.editing&&!state.life.paused);exclusive(state);assert(state.life.reservations.some(r=>r.stationId==='room-furniture-kitchen-table'));assert(Math.hypot(state.walkers[0].x-before.walkers[0].x,state.walkers[0].y-before.walkers[0].y)<1);
      await page.evaluate(()=>window.__launcherRoomTest.lifeCancel('luffy'));await advance(page,500);assert(!(await snap(page)).life.reservations.some(r=>r.key==='luffy'));assert.equal(await page.evaluate(()=>window.__integration.calls.filter(c=>c.type==='work.cancel').length),1);return{};
    });
    await scenario('pending-reserve-editor',{owned:['luffy'],furniture:[{key:'kitchen-table'}]},async page=>{
      await page.evaluate(()=>{window.__integration.hold='work.reserve';window.__reserve=window.__launcherRoomTest.lifeAssign('luffy','room-furniture-kitchen-table');});
      await page.evaluate(()=>window.LauncherRoom.openEditor());await page.locator('#roomCancel').click();await advance(page,1500);let state=await snap(page);assert.equal(state.life.tasks[0].phase,'reserving');assert.equal(state.walkers[0].route.length,0);
      assert(!await page.evaluate(()=>window.__integration.calls.some(c=>c.type==='work.activate')));await page.evaluate(()=>window.__integration.resolve());assert((await page.evaluate(()=>window.__reserve)).ok);await advance(page,500);state=await snap(page);assert(state.life.reservations.length===1);assert(state.walkers[0].route.length>0);return{};
    });
    for(const key of ['luffy','zoro'])await scenario(key==='luffy'?'manual-arrival-lines':'manual-arrival-lines-zoro',{owned:[key]},async page=>{
      // Actual actor + panel button pointer clicks; only the account authority is a fixture.
      await page.locator(`[data-room-key="c:room-character-${key}"]`).click({force:true});
      assert(await page.locator('#roomCompanionPanel').isVisible());
      await page.locator('#roomLifeCall').click();let state=await snap(page);assert.equal(state.nodes[0].speech,'');assert(state.life.tasks[0].goal.row>=6);
      const trail=await until(page,s=>s.nodes[0]?.speech&&s.life.tasks[0]?.phase==='performing');state=trail.at(-1);assert.equal(state.walkers[0].route.length,0);assert(state.nodes[0].speech.length>0);
      await page.locator('#roomStage').screenshot({path:path.join(out,key+'-call.png')});
      await page.evaluate(key=>window.__launcherRoomTest.lifeCancel(key),key);await advance(page,2000);await page.locator('#roomLifeGift').click();assert.equal(await page.evaluate(()=>window.__integration.db[42].wallet.coins),100);await page.locator('#roomLifeGift').click();
      await until(page,s=>s.nodes[0]?.pose==='eat'&&s.nodes[0]?.speech);state=await snap(page);assert.equal(state.nodes[0].source,'life_v1');assert.equal(await page.evaluate(()=>window.__integration.db[42].wallet.coins),95);
      await page.locator('#roomStage').screenshot({path:path.join(out,key+'-gift-eat-with-line.png')});await page.evaluate(key=>window.__launcherRoomTest.lifeCancel(key),key);await advance(page,2000);await page.locator('#roomLifeTrain').click();await until(page,s=>s.nodes[0]?.pose==='train'&&s.nodes[0]?.speech);
      await page.locator('#roomStage').screenshot({path:path.join(out,key+'-train.png')});
      const frames=[];for(let i=0;i<4;i++){frames.push((await snap(page)).nodes[0].frame);await page.clock.runFor(420);}assert(new Set(frames).size>=3,'train shows successive authored frames');
      return{actor:key,uiPointerClicks:true,trainFrames:frames,atlasSha256:Object.fromEntries(['eat','train'].map(action=>[action,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'public/images/launcher_room/life_v1',key,action+'-south.webp'))).digest('hex')]))};
    });
    for(const cast of [['luffy'],['luffy','sanji','nami']])await scenario('authored-chain-'+cast.length,{owned:cast},async page=>{
      await advance(page,13000);await page.evaluate(()=>{for(const actor of window.__launcherRoomTest.snapshot().walkers)window.__launcherRoomTest.lifeCancel(actor.key);});assert(await page.evaluate(()=>window.__launcherRoomTest.lifeEvent('life-chain-luffy-break')));
      await advance(page,250);const first=await snap(page);assert.deepEqual(first.life.foreground.keys.sort(),cast.slice().sort());
      const trail=await until(page,async s=>{exactActors(s,cast);exclusive(s);return page.evaluate(()=>window.__integration.calls.some(c=>c.type==='event.record'&&c.payload.eventId==='life-chain-luffy-break'));},150000);
      const record=await page.evaluate(()=>window.__integration.calls.find(c=>c.type==='event.record'&&c.payload.eventId==='life-chain-luffy-break'));assert.deepEqual(record.payload.participants.sort(),cast.map(k=>'room-character-'+k).sort());
      assert.equal((await snap(page)).life.foreground,null);assert(trail.some(s=>s.nodes.some(n=>n.pose==='eat')));fs.writeFileSync(path.join(out,'chain-'+cast.length+'-trajectory.json'),JSON.stringify(trail,null,2));return{participants:cast};
    });
    await scenario('piano-event-work-contention',{owned:['brook','zoro'],furniture:[{key:'piano'}]},async page=>{
      await advance(page,13000);await page.evaluate(()=>{for(const actor of window.__launcherRoomTest.snapshot().walkers)window.__launcherRoomTest.lifeCancel(actor.key);});
      assert((await page.evaluate(()=>window.__launcherRoomTest.lifeAssign('zoro','room-furniture-piano'))).ok);
      assert.equal(await page.evaluate(()=>window.__launcherRoomTest.lifeEvent('life-chain-brook-small-tune')),false);
      await page.evaluate(()=>window.__launcherRoomTest.lifeCancel('zoro'));
      assert(await page.evaluate(()=>window.__launcherRoomTest.lifeEvent('life-chain-brook-small-tune')));
      assert.equal((await page.evaluate(()=>window.__launcherRoomTest.lifeAssign('zoro','room-furniture-piano'))).ok,false);
      const trail=await until(page,s=>{exclusive(s);return s.nodes.some(n=>n.key==='brook'&&n.pose==='music');});
      const state=trail.at(-1);assert(state.life.reservations.some(r=>r.key==='brook'&&r.stationId==='room-furniture-piano'));assert.equal(state.walkers.find(w=>w.key==='brook').route.length,0);
      await page.locator('#roomStage').screenshot({path:path.join(out,'piano-event-exclusive.png')});return{approachSamples:trail.length};
    });
    const completedSources=sourceHashes(),sourceChangedDuringRun=JSON.stringify(startedSources)!==JSON.stringify(completedSources);
    const report={ok:results.every(r=>r.pass),generatedAt:new Date().toISOString(),checks:results.length,results,filter:process.env.LAUNCHER_LIFE_INTEGRATION_FILTER||null,
      testScriptSha256:crypto.createHash('sha256').update(fs.readFileSync(__filename)).digest('hex'),startedSources,completedSources,sourceChangedDuringRun,
      scope:'Actual headless Chromium, existing BFS/room/controller/GPT assets, deterministic Playwright animation clock and isolated IPC fixtures. Random autonomous selection disabled only in fixture. No real purchase, database, physical-device, remote-network or public deployment acceptance.'};
    fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:results.length,out}));if(!report.ok)process.exitCode=1;
  }finally{await browser.close();}
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
else module.exports={create,advance,snap,sourceHashes,chromium,setBrowser:value=>{browser=value;}};
