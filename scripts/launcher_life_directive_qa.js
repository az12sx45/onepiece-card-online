'use strict';
// Independent directive-only probe. Real UI, zero-actor isolated server fixture.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=process.env.LAUNCHER_DIRECTIVE_QA_OUT||'C:/Codex_Candidates/launcher-life-qa-1.2.0/directive-ui-only';
fs.mkdirSync(out,{recursive:true});
const runtime='C:/Users/王曜瑋/AppData/Local/OpenAI/Codex/runtimes/cua_node';
const {chromium}=require(fs.readdirSync(runtime).map(name=>path.join(runtime,name,'bin/node_modules/playwright')).find(p=>fs.existsSync(path.join(p,'package.json'))));
const read=file=>fs.readFileSync(path.join(root,'desktop',file),'utf8');
const files=['launcher-room-dialogue.js','launcher-room-motion-data.js','launcher-room-motion.js','launcher-life-data.js','launcher-life-actions.js','launcher-life.js','launcher-life-room.js','launcher-room.js'];
const sourceHashes=()=>Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(read(file)).digest('hex')]));
const report={ok:false,results:[],errors:[],startedSources:sourceHashes(),scope:'Actual Chromium UI and production launcher files; isolated IPC fixture with free_day and external payload.directiveId, matching the adapter and server contract. No real account, database write or deployment acceptance.'};
const check=(name,pass,detail)=>{report.results.push({name,pass:!!pass,detail});};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',error=>report.errors.push(error.stack||error.message));
 await page.route('opui://**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,''),file=path.resolve(root,'public',rel);return file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404,body:'Unavailable local fixture asset'});});
 try {
  const html=read('launcher.html').replace(/<meta[^>]+Content-Security-Policy[^>]+>/i,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'').replace('<body data-stage="boot">','<body data-stage="app">').replace('<main class="launcher-app screen" id="launcherApp" hidden>','<main class="launcher-app screen is-active" id="launcherApp">');
  await page.setContent(html,{waitUntil:'domcontentloaded'});await page.addStyleTag({content:['launcher.css','launcher-social.css','launcher-profile-shop.css','launcher-room.css'].map(read).join('\n')});
  await page.evaluate(()=>{
   window.__LAUNCHER_ROOM_QA__=true;
   const life={schemaVersion:1,revision:1,ownedCharacterIds:[],activeCharacterIds:[],characters:{},pairs:{},jobs:[],pendingArrivals:[],directive:'free_day',recentEvents:[],offlineSummary:{elapsedMs:0,completedJobs:0,coins:0}};
   const profile={userId:42,isSelf:true,name:'今日方針 UI 隔離驗證',life,collection:{launcher:{itemIds:[]}},room:{revision:1,capacityVersion:2,sceneId:'room-scene-default',placements:[],characters:[]},roomItems:{scene:null,placements:[],characters:[]},companions:[]};
   const fixture=window.__directiveFixture={life,profile,calls:[],wallet:{coins:100,cap:500},requests:0};
   const response=()=>structuredClone({ok:true,serverNow:new Date().toISOString(),life,profile,room:profile.room,wallet:fixture.wallet});
   window.onePieceDesktop={getLauncherLife:async()=>{fixture.requests++;return response();},getLauncherShop:async()=>({ok:true,shop:{catalog:[],owned:{roomCharacters:[],roomFurniture:[],roomScenes:[]},wallet:fixture.wallet}}),commandLauncherLife:async command=>{fixture.calls.push(structuredClone(command));if(command.type==='directive.set'){life.revision++;life.directive=command.payload.directiveId;}return response();}};
   fixture.refresh=()=>window.LauncherRoom.setProfile(structuredClone(profile),{accountId:42});
   fixture.visit=()=>{const friend=structuredClone(profile);friend.userId=44;friend.isSelf=false;window.LauncherRoom.setProfile(friend,{accountId:42});window.LauncherRoom.onVisible('profile');};
   document.getElementById('bootScreen').hidden=true;document.body.dataset.stage='app';document.getElementById('profilePanel').hidden=false;document.getElementById('libraryPanel').hidden=true;
  });
  for(const file of files)await page.addScriptTag({content:read(file)});
  await page.evaluate(()=>{window.LauncherRoom.setProfile(window.__directiveFixture.profile,{accountId:42});window.LauncherRoom.onVisible('profile');});
  await page.waitForFunction(()=>document.getElementById('roomLifeDirective')?.options.length===6&&!document.getElementById('roomLifeDirective').disabled);
  const initial=await page.locator('#roomLifeDirective').evaluate(node=>({value:node.value,label:node.selectedOptions[0]?.textContent,options:[...node.options].map(o=>({value:o.value,label:o.textContent}))}));
  check('six labeled production directive options are present',initial.options.length===6&&initial.options.every(o=>o.value&&o.label?.trim()),initial.options);
  check('initial selection is labeled free_day 自由日',initial.value==='free_day'&&initial.label==='自由日',initial);
  await page.locator('#roomLifeToolbar').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,'narrow-directive-default.png')});
  let changed,selected;
  for(const option of initial.options){
   selected=option.value;const before=await page.evaluate(()=>window.__directiveFixture.calls.filter(c=>c.type==='directive.set').length);
   await page.locator('#roomLifeDirective').selectOption(selected);
   await page.waitForFunction(before=>window.__directiveFixture.calls.filter(c=>c.type==='directive.set').length===before+1&&!document.getElementById('roomLifeDirective').disabled,before);
   changed=await page.evaluate(()=>({value:document.getElementById('roomLifeDirective').value,label:document.getElementById('roomLifeDirective').selectedOptions[0]?.textContent,life:window.__directiveFixture.life.directive,controller:window.__launcherRoomTest.snapshot().life.directive,command:window.__directiveFixture.calls.filter(c=>c.type==='directive.set').at(-1)}));
   check(`actual UI selection sends the external directiveId ${selected}`,changed.command?.payload?.directiveId===selected&&!Object.hasOwn(changed.command?.payload||{},'directive'),changed);
   check(`UI and controller retain server-accepted ${selected}`,changed.value===selected&&changed.life===selected&&changed.controller===selected&&changed.label===option.label,changed);
   await page.screenshot({path:path.join(out,`narrow-directive-${selected}.png`)});
  }
  await page.evaluate(()=>window.__directiveFixture.refresh());await page.waitForTimeout(100);
  const refresh=await page.locator('#roomLifeDirective').inputValue();check('same-owner profile refresh preserves selected directive',refresh===selected,{value:refresh});
  const callsBefore=await page.evaluate(()=>window.__directiveFixture.calls.length);await page.evaluate(()=>window.__directiveFixture.visit());
  await page.waitForFunction(()=>document.getElementById('roomLifeDirective').disabled);
  check('friend directive selection is visibly disabled',await page.locator('#roomLifeDirective').isDisabled());
  // A synthetic event probes controller enforcement even if script bypasses the disabled UI.
  await page.evaluate(()=>{const select=document.getElementById('roomLifeDirective');select.value='work_day';select.dispatchEvent(new Event('change',{bubbles:true}));});await page.waitForTimeout(100);
  const visitor=await page.evaluate(()=>({calls:window.__directiveFixture.calls.length,value:document.getElementById('roomLifeDirective').value,life:window.__directiveFixture.life.directive,disabled:document.getElementById('roomLifeDirective').disabled}));
  check('friend synthetic change cannot send an IPC mutation or alter owned life',visitor.calls===callsBefore&&visitor.life===changed.life&&visitor.disabled,visitor);
  await page.screenshot({path:path.join(out,'narrow-directive-friend-readonly.png')});
  check('narrow page fits viewport',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  check('no uncaught JavaScript errors',report.errors.length===0,report.errors);
 } catch(error){report.failure=error.stack;await page.screenshot({path:path.join(out,'failure.png'),fullPage:true}).catch(()=>{});}
 finally {report.completedSources=sourceHashes();report.sourceChangedDuringRun=JSON.stringify(report.startedSources)!==JSON.stringify(report.completedSources);report.ok=!report.failure&&report.results.every(r=>r.pass)&&!report.sourceChangedDuringRun;report.generatedAt=new Date().toISOString();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log(JSON.stringify({ok:report.ok,checks:report.results.length,failed:report.results.filter(r=>!r.pass),failure:report.failure,out},null,2));if(!report.ok)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
