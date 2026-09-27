'use strict';
// Real catalog/services with isolated PGlite. No production profile or wallet.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),Module=require('node:module');
const root=path.resolve(__dirname,'..');
const out=path.resolve(process.env.LAUNCHER_EXPANSION_QA_OUT||'C:/Users/王曜瑋/Documents/Codex/2026-04-20-1-2-start-html-game-html/artifacts/launcher-room-expansion-1.2.8/qa-catalog');
const S=require('../server/launcher-profile-shop'),L=require('../server/launcher-life'),D=require('../desktop/launcher-life-data');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const db=new PGlite(),pool={query:(...args)=>db.query(...args),async connect(){return{query:(...args)=>db.query(...args),release(){}};}};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex'),clone=v=>JSON.parse(JSON.stringify(v));
const sourceFiles=['server/launcher-profile-shop.js','server/launcher-life.js','server/launcher-life-store.js','server/launcher-minigames.js','server/launcher-crew-release.js','desktop/launcher-room.js','desktop/launcher-life-data.js','desktop/launcher-reserved-crew.js','desktop/launcher-room-dialogue.js','scripts/launcher_room_expansion_catalog_qa.js'];
const bindings=()=>Object.fromEntries(sourceFiles.map(f=>[f,sha(fs.readFileSync(path.join(root,f)))]));
const checks=[],furniture=['supply-rack','log-pose-desk','repair-cart','library-cart','medical-cart','den-den-desk'],scenes=['sunny-workshop','sunny-aquarium'];
const ids=[...scenes.map(k=>'room-scene-'+k),...furniture.map(k=>'room-furniture-'+k)],cap={crewContentRevision:1};
async function check(name,fn){await fn();checks.push({name,status:'PASS'});console.log('PASS '+name);}
const row=async id=>(await db.query('SELECT * FROM player_profiles WHERE user_id=$1',[id])).rows[0];
async function main(){
 fs.mkdirSync(out,{recursive:true});const before=bindings();
 await db.exec('CREATE TABLE player_profiles(user_id INTEGER PRIMARY KEY, secret TEXT UNIQUE, name TEXT, avatar TEXT, stats JSONB, updated_at TIMESTAMPTZ DEFAULT now())');
 const stats={client:{totals:{coins:73,games:9,wins:4},social:{friends:[2],privateMarker:'owner-private'}},launcherWalletV1:{coins:300,lastGrantDay:new Date().toISOString().slice(0,10)},launcherOwnedV1:{items:['room-character-robin','room-furniture-bookshelf']},launcherRoomV1:{revision:0,capacityVersion:2,sceneId:'room-scene-default',placements:[],characters:[{itemId:'room-character-robin',x:480,y:470}]},boardMarker:{preserve:['untouched']}};
 await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',[1,'expansion-owner','配件測試船長','8',JSON.stringify(stats)]);
 await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',[2,'expansion-friend','參觀夥伴','4',JSON.stringify({client:{social:{friends:[1]}}})]);
 await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',[3,'expansion-stranger','陌生人','4',JSON.stringify({})]);
 await check('exact-eight-products-added-old-catalog-unchanged',()=>{
  const file=path.join(root,'server/launcher-profile-shop.js'),old=new Module(file,module);old.filename=file;old.paths=Module._nodeModulePaths(path.dirname(file));old._compile(fs.readFileSync(path.join(out,'baseline/server/launcher-profile-shop.js'),'utf8'),file);
  assert.deepEqual(S.CATALOG.filter(p=>!ids.includes(p.id)),old.exports.CATALOG);
  assert.deepEqual(S.CATALOG.filter(p=>ids.includes(p.id)).map(p=>p.id).sort(),[...ids].sort());
  assert.equal(new Set(S.CATALOG.map(p=>p.id)).size,S.CATALOG.length);
 });
 await check('unowned-new-scene-and-furniture-rejected-without-wallet-change',async()=>{
  const before=clone((await row(1)).stats);
  for(const sceneId of ['room-scene-default','room-scene-sunny-workshop']){
   const r=await S.setLauncherRoom(pool,'expansion-owner',{revision:0,capacityVersion:2,sceneId,placements:sceneId==='room-scene-default'?[{itemId:'room-furniture-supply-rack',x:350,y:380,scale:1,rotation:0,flip:false}]:[],characters:stats.launcherRoomV1.characters},cap);
   assert.equal(r.error,'not_owned');
  }
  assert.deepEqual((await row(1)).stats,before);
 });
 await check('all-eight-purchases-charge-existing-shop-wallet-and-preserve-game-data',async()=>{
  let expected=300;
  for(const id of ids){const item=S.CATALOG.find(i=>i.id===id),r=await S.changeLauncherItem(pool,'expansion-owner',id,'buy',cap);assert.equal(r.ok,true,JSON.stringify(r));expected-=item.price;assert.equal(r.shop.wallet.coins,expected);assert.ok(r.profile.collection.launcher.itemIds.includes(id));}
  const saved=(await row(1)).stats;assert.deepEqual(saved.client,stats.client);assert.deepEqual(saved.boardMarker,stats.boardMarker);assert.equal(saved.launcherWalletV1.coins,196);
 });
 await check('repeat-purchase-invalid-equip-and-forged-id-do-not-charge',async()=>{
  const before=clone((await row(1)).stats);
  assert.equal((await S.changeLauncherItem(pool,'expansion-owner',ids[0],'buy',cap)).error,'already_owned');
  assert.equal((await S.changeLauncherItem(pool,'expansion-owner',ids[2],'equip',cap)).error,'invalid_action');
  assert.equal((await S.changeLauncherItem(pool,'expansion-owner','room-furniture-fake-cart','buy',cap)).error,'invalid item');
  assert.deepEqual((await row(1)).stats,before);
 });
 await check('two-scenes-six-pieces-all-four-rotations-save-and-reload',async()=>{
  let revision=0;
  for(const scene of scenes)for(let rotation=0;rotation<4;rotation++){
   const snapshot={revision,capacityVersion:2,sceneId:'room-scene-'+scene,placements:furniture.map((key,i)=>({itemId:'room-furniture-'+key,x:200+i*108,y:350+(i%2)*60,scale:1,rotation,flip:rotation===2})),characters:stats.launcherRoomV1.characters};
   const r=await S.setLauncherRoom(pool,'expansion-owner',snapshot,cap);assert.equal(r.ok,true,JSON.stringify(r));revision++;assert.equal(r.profile.room.revision,revision);assert.deepEqual(r.profile.room.placements,snapshot.placements);assert.equal(r.profile.roomItems.scene.key,scene);assert.equal(r.profile.roomItems.placements.length,6);
   assert.deepEqual(S.launcherRoom((await row(1)).stats),r.profile.room);
  }
 });
 await check('legacy-saved-room-normalization-remains-compatible',()=>{
  const legacy={...stats,launcherRoomV1:{revision:4,sceneId:'room-scene-default',placements:[{itemId:'room-furniture-bookshelf',x:300,y:390,scale:1.2,flip:true}],characters:stats.launcherRoomV1.characters}};
  const saved=S.launcherRoom(legacy);assert.equal(saved.placements[0].rotation,2);assert.equal(saved.placements[0].scale,1.2);assert.deepEqual(saved.characters,stats.launcherRoomV1.characters);
 });
 await check('invalid-rotation-duplicate-piece-and-stale-revision-rejected',async()=>{
  const current=S.launcherRoom((await row(1)).stats),before=clone((await row(1)).stats);
  const invalid=clone(current);invalid.placements[0].rotation=4;assert.equal((await S.setLauncherRoom(pool,'expansion-owner',invalid,cap)).error,'invalid_room');
  const duplicate=clone(current);duplicate.placements.push(clone(duplicate.placements[0]));assert.equal((await S.setLauncherRoom(pool,'expansion-owner',duplicate,cap)).error,'invalid_room');
  assert.equal((await S.setLauncherRoom(pool,'expansion-owner',{...current,revision:0},cap)).error,'revision_conflict');assert.deepEqual((await row(1)).stats,before);
 });
 await check('friend-visit-resolves-new-assets-and-stranger-remains-blocked',async()=>{
  const visit=await S.getLauncherProfile(pool,'expansion-friend',1);assert.equal(visit.ok,true);assert.equal(visit.profile.isSelf,false);assert.equal(visit.profile.roomItems.scene.key,'sunny-aquarium');assert.deepEqual(visit.profile.roomItems.placements.map(p=>p.item.key),furniture);assert.equal(JSON.stringify(visit).includes('owner-private'),false);assert.equal(JSON.stringify(visit).includes('expansion-owner'),false);
  assert.equal((await S.getLauncherProfile(pool,'expansion-stranger',1)).error,'not friends');
 });
 await check('all-six-workstations-resolve-only-while-placed-and-rotation-fingerprints-change',async()=>{
  const room=S.launcherRoom((await row(1)).stats),types=['deck','navigation','workshop','library','medical','deck'];
  for(let i=0;i<furniture.length;i++){
   const id='room-furniture-'+furniture[i],station=L.stationFor(room,id);assert.equal(station.type,types[i]);assert.equal(station.capacity,1);assert.equal(D.stationForFurniture(id).type,types[i]);assert.equal(L.stationFor({...room,placements:room.placements.filter(p=>p.itemId!==id)},id),null);
   assert.equal(L.validJobContext({itemId:'room-character-robin',stationId:id,stationFingerprint:L.stationFingerprint(station)},{activeCharacterIds:['room-character-robin']},room),true);
   const moved=clone(room);moved.placements[i].rotation=0;assert.equal(L.validJobContext({itemId:'room-character-robin',stationId:id,stationFingerprint:L.stationFingerprint(station)},{activeCharacterIds:['room-character-robin']},moved),false);
  }
  assert.deepEqual(D.stations.workshop.specialistRequirements.franky.furnitureKeys,['tool-bench']);assert.deepEqual(D.stations.medical.specialistRequirements.chopper.furnitureKeys,['medicine-cabinet']);
 });
 await check('target-source-stable-through-test',()=>assert.deepEqual(bindings(),before));
 const report={schema:'launcher-room-expansion-catalog-qa/1',status:'PASS',createdAt:new Date().toISOString(),sourceRoot:root,sourceSha256:before,checks,products:ids.map(id=>S.CATALOG.find(i=>i.id===id)),limitations:['Actual service SQL runs in isolated PGlite; no production wallet or account was changed.','Serial test, not concurrent PostgreSQL acceptance.','Catalog and persistence proof does not prove visual asset quality.']};fs.writeFileSync(path.join(out,'CATALOG_QA.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({status:'PASS',checks:checks.length}));
}
main().catch(e=>{fs.writeFileSync(path.join(out,'CATALOG_FAILURE.json'),JSON.stringify({status:'FAIL',error:e.stack,checks},null,2)+'\n');console.error(e);process.exitCode=1;}).finally(()=>db.close());
