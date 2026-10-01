'use strict';
// Actual room renderer/editor/BFS and life station discovery. Local IPC fixture.
// --require-assets additionally decodes every new GPT asset and captures layouts.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.LAUNCHER_EXPANSION_QA_OUT||'D:/Codex_QA/launcher-life-fishing-weather-1.2.15-art/furniture-qa');
const requireAssets=process.argv.includes('--require-assets');
const runtime=path.join(process.env.LOCALAPPDATA,'OpenAI/Codex/runtimes/cua_node');
const playwright=process.env.BOARD_QA_PLAYWRIGHT||fs.readdirSync(runtime).map(n=>path.join(runtime,n,'bin/node_modules/playwright')).find(p=>fs.existsSync(path.join(p,'package.json')));
const {chromium}=require(playwright),{CATALOG}=require('../server/launcher-profile-shop');
const keys=['aquarium-tank','fishing-gear-rack','galley-icebox','crew-tea-table'],scenes=['sunny-deck','sunny-aquarium'];
const spans=[[3,2],[2,2],[2,1],[3,1]],sizes=[84,78,80,86];
const files=['launcher-reserved-crew.js','launcher-room-dialogue.js','launcher-room-motion-data.js','launcher-room-motion.js','launcher-life-data.js','launcher-life-actions.js','launcher-life-room.js','launcher-room-ambience.js','launcher-room-aquarium.js','launcher-room.js'];
const read=f=>fs.readFileSync(path.join(root,'desktop',f),'utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const sourceFiles=[...files.map(f=>'desktop/'+f),'desktop/launcher.html','desktop/launcher.css','desktop/launcher-social.css','desktop/launcher-profile-shop.css','desktop/launcher-room.css','desktop/launcher-room-ambience.css','desktop/launcher-room-aquarium.css','server/launcher-profile-shop.js','scripts/launcher_furniture_weather_browser_qa.js'];
const hashes=()=>Object.fromEntries(sourceFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
const assetFiles=[...scenes.map(k=>`scenes/${k}-cutout-v3.webp`),...keys.map(k=>`furniture/${k}.webp`),...keys.flatMap(k=>[0,1,2,3].map(r=>`furniture_views/${k}/${r}.webp`)),...['balloon-catfish','panda-shark','glistening-saury','smile-jellyfish'].map(k=>`fish_v1/${k}.webp`)].map(f=>'public/images/launcher_room/'+f);
const assetHashes=()=>Object.fromEntries(assetFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
let browser,page;const checks=[],errors=[],missing=[],captures=[];
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}
async function use(options={}){await page.evaluate(options=>{if(!document.getElementById('roomCancel').hidden&&document.querySelector('#roomEditor:not([hidden])'))document.getElementById('roomCancel').click();window.__expansion.use(options);},options);await page.clock.runFor(50);}
async function main(){
 fs.mkdirSync(out,{recursive:true});const before=hashes(),assetSha256=requireAssets?assetHashes():{};
 browser=await chromium.launch({headless:true,executablePath:process.env.BOARD_QA_CHROME||'C:/Users/王曜瑋/AppData/Local/ms-playwright/chromium-1243/chrome-win64/chrome.exe'});
 page=await browser.newPage({viewport:{width:1366,height:1000}});page.on('pageerror',e=>errors.push(e.stack||e.message));
 await page.route('opui://**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\//,''),file=path.resolve(root,'public',rel);if(file.startsWith(path.join(root,'public')+path.sep)&&fs.existsSync(file))return route.fulfill({path:file});missing.push(rel);return route.fulfill({status:404,body:'Not available'});});
 await page.clock.install({time:new Date('2026-09-28T10:00:00Z')});
 const html=read('launcher.html').replace(/<meta[^>]+Content-Security-Policy[^>]+>/i,'').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'').replace('<body data-stage="boot">','<body data-stage="app">').replace('<main class="launcher-app screen" id="launcherApp" hidden>','<main class="launcher-app screen is-active" id="launcherApp">');
 await page.setContent(html,{waitUntil:'domcontentloaded'});await page.addStyleTag({content:['launcher.css','launcher-social.css','launcher-profile-shop.css','launcher-room.css','launcher-room-ambience.css','launcher-room-aquarium.css'].map(read).join('\n')});
 await page.evaluate(catalog=>{
  window.__LAUNCHER_ROOM_QA__=true;
  const copy=v=>structuredClone(v),byId=id=>catalog.find(p=>p.id===id),f={profile:null,calls:[],revision:0};window.__expansion=f;
  const point=(col,row,width=1,height=1)=>{const depth=(row+height)/8,left=164+(28-164)*depth,right=796+(932-796)*depth;return{x:left+(right-left)*(col+width/2)/16,y:267+248*depth};};
  f.shop={catalog,wallet:{coins:196,cap:500},owned:{roomScenes:catalog.filter(p=>p.type==='room_scene').map(p=>p.id),roomFurniture:catalog.filter(p=>p.type==='room_furniture').map(p=>p.id),roomCharacters:['room-character-robin']}};
  f.use=({pieces=[],scene='sunny-workshop',visitor=false,fish=[]}={})=>{
   const placements=pieces.map(p=>{const item=byId('room-furniture-'+p.key),rotation=p.rotation||0,b=item.footprint||({bookshelf:{cols:2,rows:1},'treasure-chest':{cols:2,rows:1}}[p.key]);const width=rotation%2?b.rows:b.cols,height=rotation%2?b.cols:b.rows;return{itemId:item.id,...point(p.col??5,p.row??2,width,height),scale:1,rotation,flip:rotation===2};});
   const character={itemId:'room-character-robin',...point(12,6)},ids=['room-character-robin',...placements.map(p=>p.itemId),'room-scene-'+scene],room={revision:++f.revision,capacityVersion:2,sceneId:'room-scene-'+scene,placements,characters:[character]};
   f.profile={userId:42,isSelf:!visitor,name:'千陽號新配件',room,collection:{launcher:{itemIds:ids}},roomItems:{scene:byId(room.sceneId),placements:placements.map(p=>({...p,item:byId(p.itemId)})),characters:[{...character,item:byId(character.itemId)}]},life:{schemaVersion:1,revision:1,ownedCharacterIds:['room-character-robin'],activeCharacterIds:['room-character-robin'],characters:{},jobs:[],pendingArrivals:[],directive:'free_day',fishCollection:fish.map((speciesId,index)=>({id:`fish-qa-${index}`,speciesId,caughtAt:'2026-09-27T00:00:00Z',inAquarium:true}))},companions:[]};
   window.LauncherRoom.setProfile(copy(f.profile),{accountId:visitor?99:42});window.LauncherRoom.onVisible('profile');
  };
  window.onePieceDesktop={getLauncherShop:async()=>({ok:true,shop:copy(f.shop)}),getLauncherLife:async()=>({ok:true,life:copy(f.profile?.life||{ownedCharacterIds:[],characters:{},jobs:[],pendingArrivals:[]})}),getLauncherCharacter:async itemId=>({ok:true,character:{itemId,affinity:0}}),commandLauncherLife:async body=>{f.calls.push(body);return{ok:false,error:'fixture_command_disabled'};},saveLauncherRoom:async room=>{f.calls.push({type:'save-room',room:copy(room)});f.profile.room={...copy(room),revision:room.revision+1};f.profile.roomItems={scene:byId(room.sceneId),placements:room.placements.map(p=>({...p,item:byId(p.itemId)})),characters:room.characters.map(p=>({...p,item:byId(p.itemId)}))};return{ok:true,profile:copy(f.profile),shop:copy(f.shop)};}};
  document.getElementById('bootScreen').hidden=true;document.body.dataset.stage='app';document.getElementById('profilePanel').hidden=false;document.getElementById('libraryPanel').hidden=true;
 },CATALOG);
 for(const file of files){await page.addScriptTag({content:read(file)});if(file==='launcher-life-room.js')await page.evaluate(()=>{const prior=window.OnePieceLifeRoom;window.OnePieceLifeRoom={...prior,create(env){window.__expansion.env=env;return prior.create(env);}};});}
 await check('new-furniture-stations-character-lines-and-empty-tank-reactions',async()=>{
  const result=await page.evaluate(()=>{
   const keys=['aquarium-tank','fishing-gear-rack','galley-icebox','crew-tea-table'];
   const data=window.OnePieceLifeData,dialogue=window.OnePieceRoomDialogue;
   return {stations:keys.map(key=>[key,data.stationForFurniture('room-furniture-'+key)?.type]),
    lines:dialogue.KEYS.map(actor=>keys.map(key=>dialogue.activity(actor,key,0,{aquariumFishCount:1})?.line)),
    empty:dialogue.activity('chopper','aquarium-tank',0,{aquariumFishCount:0}),
    occupied:dialogue.activity('chopper','aquarium-tank',0,{aquariumFishCount:1}),
    nonSpecialist:dialogue.directiveBeat('zoro','galley-icebox','use',0,{specialist:false}),
    events:data.events.filter(event=>event.id.includes('fishing-rack')||event.id.includes('tea')||event.id.includes('icebox')||event.id.includes('aquarium')).map(event=>({id:event.id,furniture:event.requiredFurniture,kind:event.kind}))};
  });
  assert.deepEqual(result.stations,[['aquarium-tank','aquarium'],['fishing-gear-rack','deck'],['galley-icebox','kitchen'],['crew-tea-table','social']]);
  assert.ok(result.lines.length>=14&&result.lines.every(lines=>lines.length===4&&lines.every(line=>typeof line==='string'&&line.length>5)));
  assert.notEqual(result.empty.line,result.occupied.line);assert.equal(result.empty.verb,'準備水族箱');
  assert.ok(result.nonSpecialist.line.includes('不')||result.nonSpecialist.line.includes('先'));
  for(const key of keys)assert.ok(result.events.some(event=>event.kind==='pair'&&event.furniture.includes(key)));
 });
 await check('six-items-four-turns-own-fixed-scale-and-rotated-footprint',async()=>{
  for(let i=0;i<keys.length;i++){
   await use({pieces:[{key:keys[i],col:5,row:2}]});await page.evaluate(()=>window.LauncherRoom.openEditor());const node=page.locator('#roomObjects .room-object-shell').first();await node.click();
   for(let rotation=0;rotation<4;rotation++){
    const info=await node.evaluate(n=>({rotation:Number(n.dataset.rotation),span:n.dataset.footprint,width:parseFloat(n.style.getPropertyValue('--room-width')),src:n.querySelector('.room-object').src}));
    assert.equal(info.rotation,rotation);assert.equal(info.span,(rotation%2?[spans[i][1],spans[i][0]]:spans[i]).join('x'));assert.ok(Math.abs(info.width-sizes[i]*1.5/960*100)<0.0001);assert.ok(info.src.endsWith(`/furniture_views/${keys[i]}/${rotation}.webp`)||!requireAssets&&info.src.endsWith(`/furniture/${keys[i]}.webp`));
    await node.locator('.room-canvas-rotate').nth(1).click();
   }
   assert.equal(await node.getAttribute('data-rotation'),'0');
  }
 });
 if(process.argv.includes('--station-check')){
 await check('all-16-furniture-directions-have-a-reachable-safe-station',async()=>{
  for(let i=0;i<keys.length;i++)for(let rotation=0;rotation<4;rotation++){
   await use({pieces:[{key:keys[i],col:5,row:2,rotation}]});
   const clean=await page.evaluate(key=>{const env=window.__expansion.env,target=env.layout().placements.get('f:room-furniture-'+key),blocked=env.layout().occupied,station=window.__launcherRoomTest.lifeWorld().stations.find(s=>s.id===target.entry.itemId);return{type:station?.type,slots:station?.slots.map(s=>({cell:s.cell,blocked:env.cellBlocked(s.cell,blocked),reachable:!!env.routeBetween({col:12,row:6},s.cell,blocked)}))||[]};},keys[i]);
   assert.equal(clean.type,CATALOG.find(item=>item.id==='room-furniture-'+keys[i]).stationType);
   assert.ok(clean.slots.length>=1);assert.ok(clean.slots.every(slot=>!slot.blocked));assert.ok(clean.slots.some(slot=>slot.reachable));
  }
 });
 }
 await check('placing-at-same-point-and-editor-rotation-never-overlap-occupied-grid',async()=>{
  await use({pieces:keys.map(key=>({key,col:5,row:2}))});
  assert.equal(await page.evaluate(()=>{const seen=new Set();for(const p of window.__expansion.env.layout().placements.values())for(let r=p.cell.row;r<p.cell.row+p.span.height;r++)for(let c=p.cell.col;c<p.cell.col+p.span.width;c++){const key=c+':'+r;if(seen.has(key))return false;seen.add(key);}return true;}),true);
  await page.evaluate(()=>window.LauncherRoom.openEditor());const node=page.locator('#roomObjects .room-object-shell').first();await node.click();for(let r=0;r<4;r++)await node.locator('.room-canvas-rotate').nth(1).click();
  assert.equal(await page.evaluate(()=>{const seen=new Set();for(const p of window.__expansion.env.layout().placements.values())for(let r=p.cell.row;r<p.cell.row+p.span.height;r++)for(let c=p.cell.col;c<p.cell.col+p.span.width;c++){const key=c+':'+r;if(seen.has(key))return false;seen.add(key);}return true;}),true);
 });
 await check('owner-editor-saves-new-scene-furniture-and-visitor-cannot-edit',async()=>{
  await use({pieces:[{key:'aquarium-tank',col:6,row:2}],scene:'sunny-aquarium'});await page.evaluate(()=>window.LauncherRoom.openEditor());const node=page.locator('#roomObjects .room-object-shell').first();await node.click();await node.locator('.room-canvas-rotate').nth(1).click();await page.locator('#roomSave').click();
  const saved=await page.evaluate(()=>window.__expansion.calls.filter(c=>c.type==='save-room').at(-1));assert.equal(saved.room.sceneId,'room-scene-sunny-aquarium');assert.equal(saved.room.placements[0].rotation,1);assert.equal(saved.room.placements[0].scale,1);
  await use({pieces:[{key:'aquarium-tank',col:6,row:2,rotation:1}],scene:'sunny-aquarium',visitor:true});assert.equal(await page.locator('#roomEditToggle').isVisible(),false);assert.equal(await page.locator('#roomObjects .room-canvas-controls').isVisible(),false);assert.equal(await page.evaluate(()=>window.__expansion.env.room().sceneId),'room-scene-sunny-aquarium');if(requireAssets)assert.equal(await page.locator('#roomScene').getAttribute('src'),'opui://launcher/images/launcher_room/scenes/sunny-aquarium-cutout-v3.webp');
 });
 if(requireAssets){
  await check('two-scenes-six-thumbnails-and-24-view-assets-decode-at-native-size',async()=>{
   const assets=[...scenes.map(k=>`scenes/${k}-cutout-v3.webp`),...keys.map(k=>`furniture/${k}.webp`),...keys.flatMap(k=>[0,1,2,3].map(r=>`furniture_views/${k}/${r}.webp`))];
   for(const rel of assets){const size=await page.evaluate(async rel=>{const img=new Image();img.src='opui://launcher/images/launcher_room/'+rel;await img.decode();return[img.naturalWidth,img.naturalHeight];},rel);assert.deepEqual(size,rel.startsWith('scenes/')?[1600,900]:[384,384]);}
  });
  await check('desktop-and-narrow-room-layouts-use-new-art-with-robin-and-no-fallbacks',async()=>{
   const pieces=keys.map((key,i)=>({key,col:[1,6,11,1,6,11][i],row:i<3?1:4}));
   for(const width of [1366,390])for(const scene of scenes){await page.setViewportSize({width,height:1000});await use({pieces,scene});await page.evaluate(async()=>{await Promise.all([...document.querySelectorAll('#roomStage img')].map(i=>i.decode()));});assert.equal(await page.locator('#roomObjects [data-art-fallback="true"]').count(),0);const file=`${scene}-${width}.png`;await page.locator('#profileRoom').screenshot({path:path.join(out,file)});captures.push({file,sha256:sha(fs.readFileSync(path.join(out,file)))});if(width===390){await page.locator('.room-stage-scroll').evaluate(n=>{n.scrollLeft=n.scrollWidth-n.clientWidth;});const visible=await page.evaluate(()=>{const box=document.querySelector('.room-stage-scroll').getBoundingClientRect(),actor=document.querySelector('#roomCharacters .room-character-shell').getBoundingClientRect();return actor.right>box.left&&actor.left<box.right;});assert.equal(visible,true);const right=`${scene}-${width}-right.png`;await page.locator('#profileRoom').screenshot({path:path.join(out,right)});captures.push({file:right,sha256:sha(fs.readFileSync(path.join(out,right)))});await page.locator('.room-stage-scroll').evaluate(n=>{n.scrollLeft=0;});}}
  });
  await check('caught-fish-swim-in-real-scene-and-placeable-tank',async()=>{
   const fish=['balloon-catfish','panda-shark','smile-jellyfish'];
   await page.setViewportSize({width:1366,height:1000});
   await use({scene:'sunny-aquarium',pieces:[{key:'aquarium-tank',col:3,row:3}],fish});
   await page.waitForFunction(()=>document.querySelector('#roomStage')?.dataset.aquariumFishCount==='3');
   const count=await page.evaluate(()=>{const inside=selector=>{const parent=document.querySelector(selector),box=parent.getBoundingClientRect();return[...parent.querySelectorAll('.room-aquarium-fish')].filter(node=>{const rect=node.getBoundingClientRect();return rect.left>=box.left&&rect.right<=box.right&&rect.top>=box.top&&rect.bottom<=box.bottom;}).length;};return{
     scene:document.querySelectorAll('.room-aquarium-scene-window .room-aquarium-fish').length,
     furniture:document.querySelectorAll('.room-aquarium-window .room-aquarium-fish').length,
     sceneFullyVisible:inside('.room-aquarium-scene-window'),furnitureFullyVisible:inside('.room-aquarium-window'),
     loaded:[...document.querySelectorAll('.room-aquarium-fish img')].every(img=>img.complete&&img.naturalWidth>0)};});
    assert.equal(count.scene,3);assert.equal(count.furniture,0);assert.equal(count.loaded,true);
    assert.ok(count.sceneFullyVisible>=2,JSON.stringify(count));assert.equal(count.furnitureFullyVisible,0);
   const file='sunny-aquarium-caught-fish-real-room.png';await page.locator('#profileRoom').screenshot({path:path.join(out,file)});captures.push({file,sha256:sha(fs.readFileSync(path.join(out,file)))});
   await page.setViewportSize({width:390,height:1000});
    assert.equal(await page.locator('#roomStage .room-aquarium-fish').count(),fish.length);
   const mobile='sunny-aquarium-caught-fish-mobile.png';await page.locator('#profileRoom').screenshot({path:path.join(out,mobile)});captures.push({file:mobile,sha256:sha(fs.readFileSync(path.join(out,mobile)))});
  });
  await check('aquarium-fish-move-between-scene-and-rotating-furniture-without-duplicates',async()=>{
   const fish=['balloon-catfish','panda-shark','smile-jellyfish'];
   for(const [scene,rotation,expectedScene,expectedFurniture] of [
    ['sunny-aquarium',1,3,0],['sunny-deck',1,0,3],['sunny-deck',2,0,0],
    ['sunny-deck',3,0,3],['sunny-aquarium',2,3,0]]){
    await use({scene,pieces:[{key:'aquarium-tank',col:3,row:3,rotation}],fish});
    const rendered=await page.evaluate(()=>({
     scene:document.querySelectorAll('.room-aquarium-scene-window .room-aquarium-fish').length,
     furniture:document.querySelectorAll('.room-aquarium-window .room-aquarium-fish').length,
     ids:[...document.querySelectorAll('#roomStage .room-aquarium-fish')].map(node=>node.dataset.fishId),
     stored:document.querySelector('#roomStage')?.dataset.aquariumFishCount
    }));
    assert.equal(rendered.scene,expectedScene,JSON.stringify({scene,rotation,rendered}));
    assert.equal(rendered.furniture,expectedFurniture,JSON.stringify({scene,rotation,rendered}));
    assert.equal(new Set(rendered.ids).size,rendered.ids.length);
    assert.equal(rendered.stored,'3');
   }
   await page.setViewportSize({width:390,height:1000});
   await use({scene:'sunny-deck',pieces:[{key:'aquarium-tank',col:3,row:3,rotation:3}],fish});
   assert.equal(await page.locator('.room-aquarium-window .room-aquarium-fish').count(),3);
   assert.equal(await page.locator('#roomStage .room-aquarium-fish').count(),3);
   const file='sunny-deck-furniture-fish-390.png';await page.locator('#profileRoom').screenshot({path:path.join(out,file)});captures.push({file,sha256:sha(fs.readFileSync(path.join(out,file)))});
  });
 }
 await check('no-script-errors-or-unexpected-wallet-commands',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.__expansion.calls.filter(c=>c.type!=='save-room')),[]);assert.deepEqual(hashes(),before);if(requireAssets){assert.deepEqual(missing,[]);assert.deepEqual(assetHashes(),assetSha256);}});
 const report={schema:'launcher-room-expansion-renderer-qa/1',status:'PASS',createdAt:new Date().toISOString(),sourceRoot:root,sourceSha256:before,assetSha256,checks,captures,requireAssets,missing:[...new Set(missing)],errors,limitations:['Real room HTML/CSS/JS, editor, layout, pathfinder and station discovery in automated Chromium with local IPC fixture.','Lifecycle controller and jobs are covered separately; this test does not mutate production accounts.','Human play, physical device and visual approval are not implied by browser assertions.',...requireAssets?[]:['Artwork generation was pending; missing new assets are explicitly not visual acceptance.']]};fs.writeFileSync(path.join(out,requireAssets?'ROOM_ASSET_QA.json':'ROOM_LOGIC_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length,requireAssets,captures:captures.length}));
}
main().catch(async e=>{fs.writeFileSync(path.join(out,requireAssets?'ROOM_ASSET_FAILURE.json':'ROOM_LOGIC_FAILURE.json'),JSON.stringify({status:'FAIL',error:e.stack,checks,errors,missing},null,2)+'\n');await page?.screenshot({path:path.join(out,'room-expansion-failure.png')}).catch(()=>{});console.error(e);process.exitCode=1;}).finally(()=>browser?.close());
