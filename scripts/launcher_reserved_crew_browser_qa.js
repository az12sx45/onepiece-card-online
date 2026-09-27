'use strict';
// Real Chromium and current production runtime; isolated IPC. New art may be absent.
// Deliberately does not certify illustration/motion quality or real artwork decoding.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),Module=require('node:module');
const root=process.env.LAUNCHER_RESERVED_CANDIDATE||path.resolve(__dirname,'..'),out=process.env.LAUNCHER_RESERVED_QA_OUT||path.join(root,'tools/launcher-room/presentation-v125/review-evidence');
fs.mkdirSync(out,{recursive:true});
process.env.LAUNCHER_LIFE_INTEGRATION_OUT=out;
const helperPath=path.join(root,'scripts/launcher_radial_fixture.js');let source=fs.readFileSync(helperPath,'utf8');
const replace=(before,after)=>{assert(source.includes(before),'fixture anchor '+before);source=source.replace(before,after);};
replace("const {CATALOG}=require(sourceRoot+'/server/launcher-profile-shop');","const {CATALOG:ACTIVE}=require(sourceRoot+'/server/launcher-profile-shop');const reserved=require(sourceRoot+'/desktop/launcher-reserved-crew');const CATALOG=[...ACTIVE,...Object.values(reserved.shopMetadata).map(p=>({...p,id:p.itemId,type:'room_character',price:0}))];");
replace("const files=['launcher-room-dialogue.js'","const files=['launcher-reserved-crew.js','launcher-room-dialogue.js'");
replace("  page.on('pageerror',error=>errors.push(error.stack||error.message));","  page.on('pageerror',error=>errors.push(error.stack||error.message));const assetRequests=[];page.on('request',r=>{if(r.url().includes('/reserved_v1/'))assetRequests.push(r.url());});");
replace("  await page.waitForFunction(()=>window.__launcherRoomTest.snapshot().walkers.every(w=>w.ready.length===4),null,{timeout:20000});",'');
// The historical test helper explicitly preloads every owned image regardless of runtime visibility.
// Remove that helper-only preload so this test can observe the real dormant loading policy.
replace("  await page.evaluate(async()=>{const promises=[];for(const key of window.__integration.db[42].life.ownedCharacterIds.map(id=>id.replace('room-character-','')))for(const clip of ['work','eat','train']){const record=window.OnePieceLifeActions.preload(key,clip,'south');if(record?.promise)promises.push(record.promise);}await Promise.all(promises);});",'');
replace('  return{page,errors};','  return{page,errors,assetRequests};');
replace('  await page.clock.install', `  await page.evaluate(()=>{window.__reservedArtSources=[];const descriptor=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');Object.defineProperty(HTMLImageElement.prototype,'src',{...descriptor,set(value){if(String(value).includes('/reserved_v1/'))window.__reservedArtSources.push(String(value));return descriptor.set.call(this,value);}});});
  await page.clock.install`);
const mod=new Module(helperPath,module);mod.filename=helperPath;mod.paths=Module._nodeModulePaths(path.dirname(helperPath));mod._compile(source,helperPath);
const fixture=mod.exports,R=require(path.join(root,'desktop/launcher-reserved-crew')),catalog=require(path.join(root,'server/launcher-profile-shop')).CATALOG;
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),files=['launcher-reserved-crew.js','launcher-room.js','launcher-room-motion.js','launcher-life-actions.js','launcher-life-data.js','launcher-room-dialogue.js','launcher-life.js','launcher-life-room.js','launcher.html'];
const bindings=()=>Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,'desktop',file)))])),sourceSha256=bindings();
const itemId=k=>'room-character-'+k,results=[];let browser;
function state({owned,placed=owned,released,visitor=false}){
  const chars=placed.map((key,i)=>({itemId:itemId(key),x:300+i*80,y:435})),ids=owned.map(itemId),products=[...catalog,...Object.values(R.shopMetadata).map(p=>({...p,id:p.itemId,type:'room_character',price:0}))];
  const stamp=released===undefined?{}:{releasedCharacterIds:released.map(itemId),rosterRevision:2};
  const life={schemaVersion:1,revision:1,ownedCharacterIds:ids,activeCharacterIds:chars.map(c=>c.itemId),characters:Object.fromEntries(owned.map(key=>[itemId(key),{key,itemId:itemId(key),needs:{energy:85,hunger:20,mood:70,social:70,workMotivation:70},memories:[]}])),pairs:{},jobs:[],pendingArrivals:[],directive:'free_day',recentEvents:[],offlineSummary:{elapsedMs:0,completedJobs:0,coins:0}};
  const room={revision:1,capacityVersion:2,sceneId:'room-scene-default',characters:chars,placements:[]};
  const profile={userId:42,isSelf:!visitor,name:'隔離預載測試',...stamp,life,room,collection:{launcher:{itemIds:ids}},roomItems:{scene:null,placements:[],characters:chars.map(c=>({...c,item:products.find(p=>p.id===c.itemId)}))},companions:chars.map(c=>({itemId:c.itemId,affinity:12,talksRemainingToday:6}))};
  return{profile,life,wallet:{coins:100,cap:500},...stamp};
}
async function check(name,options,verify){const f=await fixture.create({persisted:state(options),visitor:options.visitor});try{await verify(f);assert.deepEqual(f.errors,[]);results.push({name,status:'PASS'});console.log('PASS '+name);}finally{await f.page.close();}}
(async()=>{
  browser=await fixture.chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});fixture.setBrowser(browser);
  await check('browser-old-server-forged-reserved-owned-and-placed-stays-hidden',{owned:[...R.RESERVED_KEYS,'luffy']},async({page,assetRequests})=>{
    const s=await fixture.snap(page);assert.deepEqual(s.nodes.map(n=>n.key),['luffy']);assert.deepEqual(s.life.ownedCharacterIds,[itemId('luffy')]);assert.equal(assetRequests.length,0);assert.equal(await page.evaluate(()=>__reservedArtSources.length),0);assert.equal(await page.evaluate(()=>OnePieceLifeData.characterKeys.length),14);
    await page.evaluate(()=>LauncherRoom.openEditor());await fixture.advance(page,300);const text=await page.locator('#roomEditor').textContent();assert(!/艾斯|薩波|漢考克|托拉法爾加/.test(text));
  });
  await check('browser-explicit-legacy-release-stamp-hides-all-four',{owned:R.RESERVED_KEYS,released:R.LEGACY_KEYS},async({page,assetRequests})=>{const s=await fixture.snap(page);assert.equal(s.nodes.length,0);assert.equal(s.life.ownedCharacterIds.length,0);assert.equal(assetRequests.length,0);assert.equal(await page.evaluate(()=>__reservedArtSources.length),0);});
  for(const key of R.RESERVED_KEYS)await check('browser-single-release-'+key,{owned:R.RESERVED_KEYS,released:[...R.LEGACY_KEYS,key]},async({page,assetRequests})=>{
    const s=await fixture.snap(page);assert.deepEqual(s.nodes.map(n=>n.key),[key]);assert.deepEqual(s.life.ownedCharacterIds,[itemId(key)]);assert((await page.evaluate(()=>__reservedArtSources)).some(url=>url.includes('/'+key+'/portrait.webp')));assert((await page.evaluate(()=>__reservedArtSources)).every(url=>url.includes('/'+key+'/')));
    await page.locator('[data-room-key="c:'+itemId(key)+'"]').click();await fixture.advance(page,350);assert(await page.locator('#roomCompanionPanel').isVisible());assert((await page.locator('#roomCompanionPanel').textContent()).includes(R.profiles[key].name));
    const result=await page.evaluate(()=>({src:document.getElementById('roomCompanionPortrait').getAttribute('src'),count:document.querySelectorAll('#roomCompanionWheel button').length}));assert.equal(result.src,R.assetUrl(key,'portrait.webp'));assert(result.count>=6);
  });
  await check('browser-released-but-unowned-does-not-render',{owned:[],placed:['ace'],released:[...R.LEGACY_KEYS,'ace']},async({page,assetRequests})=>{assert.equal((await fixture.snap(page)).nodes.length,0);assert.equal(assetRequests.length,0);assert.equal(await page.evaluate(()=>__reservedArtSources.length),0);});
  await check('browser-released-owned-but-unplaced-does-not-render',{owned:['ace'],placed:[],released:[...R.LEGACY_KEYS,'ace']},async({page,assetRequests})=>{const s=await fixture.snap(page);assert.equal(s.nodes.length,0);assert.equal(s.life.tasks.length,0);assert.equal(assetRequests.length,0);assert.equal(await page.evaluate(()=>__reservedArtSources.length),0);});
  await check('browser-friend-profile-keeps-release-stamp-and-readonly',{owned:['hancock'],released:[...R.LEGACY_KEYS,'hancock'],visitor:true},async({page})=>{const s=await fixture.snap(page);assert.deepEqual(s.nodes.map(n=>n.key),['hancock']);assert.equal(s.life.writable,false);const result=await page.evaluate(()=>__launcherRoomTest.lifeInteract('hancock','gift'));assert.equal(result.error,'readonly');assert.equal(await page.evaluate(()=>__integration.calls.length),0);});
  assert.deepEqual(bindings(),sourceSha256);
  const report={schema:'one-piece-launcher-reserved-client-qa/1',ok:true,generatedAt:new Date().toISOString(),checks:results.length,results,sourceRoot:root,sourceSha256,sourceNormalizedSha256:Object.fromEntries(files.map(file=>[file,sha(fs.readFileSync(path.join(root,'desktop',file),'utf8').replace(/\r\n/g,'\n'))])),sourceHashNormalization:'UTF-8 decoded text; replace CRLF (\\r\\n) with LF (\\n) only; no other changes.',testScriptSha256:sha(fs.readFileSync(__filename)),fixtureOriginalSha256:sha(fs.readFileSync(helperPath)),fixtureEffectiveSha256:sha(source),humanAcceptance:false,scope:'Actual headless Chromium with production HTML/CSS/JS and isolated IPC. Tests roster visibility, asset request policy, profile/radial wiring and friend readonly. Reserved artwork files may be absent and 404 is permitted here; this is not artwork decode/visual/motion quality acceptance. No real DB, account or deployment.'};fs.writeFileSync(path.join(out,'CLIENT_RELEASE_BROWSER_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,checks:results.length}));
})().catch(error=>{fs.writeFileSync(path.join(out,'CLIENT_RESERVED_BROWSER_QA_FAILURE.json'),JSON.stringify({ok:false,error:error.stack,results},null,2));console.error(error.stack);process.exitCode=1;}).finally(async()=>{await browser?.close();});
