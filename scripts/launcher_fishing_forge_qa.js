'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const L=require('../server/launcher-life');
const life=require('../server/launcher-life-store');
const fishing=require('../server/launcher-fishing-v4');
const fishingV5=require('../server/launcher-fishing-v5');
const db=new PGlite(),cap={crewContentRevision:1};
let queue=Promise.resolve(),checks=0;
const results=[];
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const now=new Date(),today=now.toISOString().slice(0,10),actor='room-character-luffy';
function check(label,actual,expected){if(actual&&expected&&Object.hasOwn(actual,'characters')&&!Object.hasOwn(expected,'characters')){actual={...actual};delete actual.characters;}assert.deepEqual(actual,expected,label);checks++;results.push({name:label,status:'PASS'});}
async function add(secret,coins,owned=[actor]){
  const stats={launcherWalletV1:{coins,lastGrantDay:today},launcherOwnedV1:{items:owned},
    launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:[{itemId:actor,x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify(stats)]);
  await life.getLauncherLife(pool,secret,now,cap);
  await db.query('UPDATE launcher_life_state SET state=jsonb_set(state,$1,$2::jsonb) WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$3)',[['fishingCoins'],JSON.stringify(coins),secret]);
}
const get=secret=>life.getLauncherLife(pool,secret,now,cap);
async function command(secret,type,payload,requestId,revision,at=now){
  const snap=await get(secret);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId,expectedRevision:revision??snap.life.revision},at,cap);
}
async function main(){
 await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await add('forge',200,[actor,'room-character-zoro']);
  async function forgeCommand(payload,id,ms){const snap=await get('forge');return life.commandLauncherLife(pool,'forge',{type:'fish.release',payload,requestId:id,expectedRevision:snap.life.revision},new Date(now.getTime()+ms),cap);}
  const startForge=await forgeCommand({disposition:'forge_start',recipientId:actor},'forge-start-0001',0);
  check('forge start authenticated through installed core',startForge.ok,true);
  check('forge start does not charge',startForge.fishingWallet.coins,200);
  const forgePayload={disposition:'forge_tap',recipientId:actor,fishId:startForge.forge.id};
  let forged;
  for(const [i,t] of [350,1050,1750].entries())forged=await forgeCommand(forgePayload,'forge-tap-'+i+'-0001',t);
  check('three perfect taps produce 100 percent chance',forged.receipt.chance,100);
  check('perfect forge succeeds',forged.receipt.success,true);
  check('forge selected rod upgraded once',forged.rod.characters[actor].level,1);
  check('forge preserves other character',forged.rod.characters['room-character-zoro'].level,0);
  check('forge deducts only fishing coins',forged.fishingWallet.coins,180);
  check('forge leaves shop wallet unchanged',forged.wallet.coins,200);
  const replayForge=await forgeCommand(forgePayload,'forge-tap-2-0001',1800);
  check('final forge replay idempotent',replayForge.duplicate,true);
  check('final forge replay not charged twice',replayForge.fishingWallet.coins,180);
  const expiredStart=await forgeCommand({disposition:'forge_start',recipientId:actor},'forge-start-expired',2000);
  const expired=await forgeCommand({...forgePayload,fishId:expiredStart.forge.id},'forge-tap-expired',18000);
  check('expired forge refused',expired.error,'forge_expired');
  check('expired forge not charged',(await get('forge')).fishingWallet.coins,180);
  const lowStart=await forgeCommand({disposition:'forge_start',recipientId:actor},'forge-start-low000',19000);
  let low;
  for(const [i,t] of [700,1400,2100].entries())low=await forgeCommand({...forgePayload,fishId:lowStart.forge.id},'forge-low-'+i+'-0001',19000+t);
  check('poor timing retains base55 chance',low.receipt.chance,55);
  check('failed forging never lowers rod level',low.rod.characters[actor].level,low.receipt.success?2:1);
  check('forge charges exactly one attempt',low.fishingWallet.coins,145);
  await add('dex',100);
  await db.query('UPDATE launcher_life_state SET state=jsonb_set(state,$1,$2::jsonb) WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$3)',[['fishDexImported'],'false','dex']);
  await db.query("INSERT INTO launcher_life_operations(user_id,request_id,payload_hash,result) SELECT user_id,'old-catch','old-hash',$1::jsonb FROM player_profiles WHERE secret=$2",[JSON.stringify({catch:{speciesId:'golden-whale'}}),'dex']);
  const dex=await get('dex');check('historical sold catch unlocks journal',dex.life.fishDex.includes('golden-whale'),true);
  check('historical discovery survives second read',(await get('dex')).life.fishDex.includes('golden-whale'),true);
  check('old account dex migration does not mint fish',dex.life.fishCollection.length,0);

 const prior=await get('forge');const legacy=await command('forge','rod.upgrade',{itemId:actor},'legacy-upgrade-blocked');
 check('old upgrade cannot bypass timing probability',legacy.error,'forge_required');
 const after=await get('forge');check('refused old path preserves fishing coins',after.fishingWallet.coins,prior.fishingWallet.coins);
 check('refused old path preserves rod level',after.rod.characters[actor].level,prior.rod.characters[actor].level);
 const forgedState=L.normalizeState({fishingRodProgression:2,fishingRodLevel:0,fishingRodLevels:{[actor]:99},fishDex:['golden-whale','bad-id']},[actor],[actor],now);
 check('maximum99 save preserved',forgedState.fishingRodLevels[actor],99);
 check('dex invalid ids discarded',forgedState.fishDex,['golden-whale']);
 const beforeUnowned=await get('forge');const bad=await command('forge','fish.release',{disposition:'forge_start',recipientId:'room-character-law'},'unowned-forge-0001');
 check('cannot forge unowned character',bad.error,'character_not_owned');check('unowned does not spend',(await get('forge')).fishingWallet.coins,beforeUnowned.fishingWallet.coins);
 const restart=await forgeCommand({disposition:'forge_start',recipientId:actor},'forge-atomic-start',23000);
 const atomicPayload={disposition:'forge_tap',recipientId:actor,fishId:restart.forge.id};
 await forgeCommand(atomicPayload,'forge-atomic-tap1',23350);await forgeCommand(atomicPayload,'forge-atomic-tap2',24050);
 const atomicBefore=await get('forge');const failingPool={query:pool.query,async connect(){const c=await pool.connect();return{...c,query:(sql,args)=>String(sql).startsWith('INSERT INTO launcher_wallet_ledger')?Promise.reject(new Error('forge ledger fixture failure')):c.query(sql,args)};}};
 const final={type:'fish.release',payload:atomicPayload,requestId:'forge-atomic-tap3',expectedRevision:atomicBefore.life.revision};
 await assert.rejects(()=>life.commandLauncherLife(failingPool,'forge',final,new Date(now.getTime()+24750),cap),/forge ledger fixture failure/);checks++;
 const raw=(await db.query("SELECT state FROM launcher_life_state WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$1)",['forge'])).rows[0].state;
 check('failed final ledger preserves two taps',raw.rodForge.hits.length,2);check('ledger failure rolls back fishing money',raw.fishingCoins,atomicBefore.fishingWallet.coins);check('ledger failure rolls back rod level',raw.fishingRodLevels[actor],atomicBefore.rod.characters[actor].level);
 await db.query('UPDATE launcher_life_state SET state=jsonb_set(state,$1,$2::jsonb) WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$3)',[['fishingRodLevels',actor],'99','forge']);
 const maxed=await command('forge','fish.release',{disposition:'forge_start',recipientId:actor},'forge-at-max-0001');check('max99 cannot start charged forge',maxed.error,'rod_max_level');
 const FR=require('../server/launcher-fish-records');const records={};
 const small={id:'10000000-0000-4000-8000-000000000001',speciesId:'glistening-saury',lengthCm:16.4,spotId:'shore',baitId:'worm',caughtAt:now.toISOString()};
 const large={...small,id:'10000000-0000-4000-8000-000000000002',lengthCm:31.8,spotId:'reef',baitId:'shrimp'};
 FR.record(records,large);FR.record(records,small);
 check('minimum retains smaller actual fish and location',records['glistening-saury'].minCatch.lengthCm,16.4);
 check('maximum retains larger fish and bait',records['glistening-saury'].maxCatch.baitId,'shrimp');
 check('both actual fishing grounds kept',records['glistening-saury'].grounds.length,2);
 const norm=L.normalizeState({fishRecordsVersion:1,fishRecords:records,fishCollection:[small]},[actor],[actor],now);
 check('size record survives save round trip',norm.fishRecords['glistening-saury'].maxCatch.lengthCm,31.8);
 check('fish retains measurement in collection',norm.fishCollection[0].lengthCm,16.4);
 check('records survive selling all fish',L.normalizeState({...norm,fishCollection:[]},[actor],[actor],now).fishRecords['glistening-saury'].minCatch.lengthCm,16.4);
 for(const id of Object.keys(FR.SIZE_BANDS)){const len=FR.measuredLength(id),[min,max]=FR.SIZE_BANDS[id];check(id+' gameplay measurement inside band',len>=min&&len<=max,true);}
 await add('records-old',100);await db.query('UPDATE launcher_life_state SET state=jsonb_set(state,$1,$2::jsonb) WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$3)',[['fishRecordsVersion'],'0','records-old']);
 const old={...small};delete old.lengthCm;delete old.spotId;delete old.baitId;
 await db.query("INSERT INTO launcher_minigame_sessions(session_id,user_id,status,session) SELECT 'records-history-session',user_id,'completed',$1::jsonb FROM player_profiles WHERE secret=$2",[JSON.stringify({result:{catch:old},spotId:'reef',baitId:'shrimp'}),'records-old']);
 await db.query("INSERT INTO launcher_life_operations(user_id,request_id,payload_hash,result) SELECT user_id,'records-history-operation','h',$1::jsonb FROM player_profiles WHERE secret=$2",[JSON.stringify({catch:old}),'records-old']);
 const restored=(await get('records-old')).life.fishRecords['glistening-saury'];
 check('legacy capture does not invent size',restored.minCatch,null);check('legacy session restores real sea and bait',restored.grounds,[{spotId:'reef',baitId:'shrimp',count:1}]);check('legacy duplicate session and operation counted once',restored.catches,1);
 check('repeated read does not duplicate legacy records',(await get('records-old')).life.fishRecords['glistening-saury'].catches,1);
 await add('capture',100);const startCapture=await command('capture','minigame.start',{kind:'fishing',characterId:actor,fishingVersion:5,baitId:'shrimp',spotId:'reef',flickMode:true},'capture-start-0001');check('old client start retains original rules',startCapture.minigame.challenge.rulesVersion,undefined);
 check('capture integration starts real session',startCapture.ok,true);
 const sid=startCapture.minigame.id,session=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[sid])).rows[0].session;
 session.state='ready';session.roundIndex=session.totalRounds;session.correctRounds=session.totalRounds;session.challenge=null;session.catchSpeciesId='glistening-saury';session.fishLengthCm=32.1;session.finishNotBefore=new Date(now.getTime()-1000).toISOString();
 await db.query('UPDATE launcher_minigame_sessions SET session=$1::jsonb,status=$2 WHERE session_id=$3',[JSON.stringify(session),'ready',sid]);
 const finished=await command('capture','minigame.finish',{sessionId:sid,token:session.token},'capture-finish-0001');const fish=finished.minigame.result.catch;
 check('settled catch includes real selected sea',fish.spotId,'reef');check('settled catch includes selected bait',fish.baitId,'shrimp');check('settled fish gets persisted gameplay size',Number.isFinite(fish.lengthCm),true);check('settlement preserves actual battle fish size',fish.lengthCm,32.1);
 check('largest record equals settled fish size',finished.life.fishRecords['glistening-saury'].maxCatch.lengthCm,fish.lengthCm);
 const repeated=await command('capture','minigame.finish',{sessionId:sid,token:session.token},'capture-finish-0001');check('finish replay does not reroll size',repeated.minigame.result.catch.lengthCm,fish.lengthCm);check('finish replay does not duplicate catch record',repeated.life.fishRecords['glistening-saury'].catches,1);
 await add('records-nested',100);await db.query('UPDATE launcher_life_state SET state=jsonb_set(state,$1,$2::jsonb) WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$3)',[['fishRecordsVersion'],'0','records-nested']);
 await db.query("INSERT INTO launcher_life_operations(user_id,request_id,payload_hash,result) SELECT user_id,'nested-catch','h',$1::jsonb FROM player_profiles WHERE secret=$2",[JSON.stringify({minigame:{spotId:'deep',baitId:'lure',result:{catch:{id:'10000000-0000-4000-8000-000000000003',speciesId:'panda-shark',caughtAt:now.toISOString()}}}}),'records-nested']);
 const nested=(await get('records-nested')).life;check('nested old finish restores fishing location',nested.fishRecords['panda-shark'].grounds,[{spotId:'deep',baitId:'lure',count:1}]);check('nested catch also unlocks missing discovery',nested.fishDex.includes('panda-shark'),true);check('nested catch never fabricates dimensions',nested.fishRecords['panda-shark'].maxCatch,null);

 await add('local-capture',100);const localStart=await command('local-capture','minigame.start',{kind:'fishing',characterId:actor,fishingVersion:5,baitId:'worm',spotId:'shore',flickMode:true,localMode:true},'local-start-0001');check('local start flag accepted by real account command',localStart.ok,true);check('local mode persisted and returned',localStart.minigame.localMode,true);
 const localSession=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[localStart.minigame.id])).rows[0].session;const localAt=now.getTime()+10000;fishingV5.cast(localSession.challenge,new Date(now.getTime()+100),'worm','mid',{x:.5,y:.5});localSession.challenge.localSimulation=true;fishingV5.hook(localSession.challenge,new Date(localAt),1,'glistening-saury');localSession.catchSpeciesId='glistening-saury';await db.query('UPDATE launcher_minigame_sessions SET session=$1::jsonb WHERE session_id=$2',[JSON.stringify(localSession),localSession.id]);
 const localBatch={sessionId:localSession.id,token:localSession.token,roundId:localSession.challenge.id,localBatchId:'local-account-batch-1',localActions:[[localAt+100,1,1,0,0]]};const localResult=await command('local-capture','minigame.answer',localBatch,'local-batch-0001',undefined,new Date(localAt+200));check('real account accepts local event batch',localResult.ok,true);check('validated controls persisted',localResult.minigame.challenge.control.reeling,true);
 const localRetry=await command('local-capture','minigame.answer',localBatch,'local-batch-0002',undefined,new Date(localAt+250));check('retry batch leaves validated time unchanged',localRetry.minigame.challenge.lastSimAt,localResult.minigame.challenge.lastSimAt);

 await add('new-client',100);const revised=await command('new-client','minigame.start',{kind:'fishing',characterId:actor,fishingVersion:5,baitId:'worm',spotId:'shore',flickMode:true,localMode:true,fishingRulesVersion:39},'new-client-start-0001');check('new client explicitly opts into version39',revised.minigame?.challenge?.rulesVersion,39);check('rod detail exposes actual typed stats',revised.rod.characters[actor].stats.label,'平衡型');
 await add('size-sale',100);
 const smallFish={id:'20000000-0000-4000-8000-000000000001',speciesId:'glistening-saury',lengthCm:15,caughtAt:now.toISOString(),inAquarium:false},largeFish={...smallFish,id:'20000000-0000-4000-8000-000000000002',lengthCm:45};
 await db.query('UPDATE launcher_life_state SET state=jsonb_set(state,$1,$2::jsonb) WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$3)',[['fishCollection'],JSON.stringify([smallFish,largeFish]),'size-sale']);
 const price=await get('size-sale'),offers=price.fishOffers;check('large specimen has higher actual sale offer',offers.find(f=>f.fishId===largeFish.id).saleCoins>offers.find(f=>f.fishId===smallFish.id).saleCoins,true);
 const sold=await command('size-sale','fish.sell',{fishId:largeFish.id},'size-sale-large-0001');check('actual sale applies quoted specimen price',sold.sale.amount,offers.find(f=>f.fishId===largeFish.id).saleCoins);check('sale credits only fishing wallet',sold.fishingWallet.coins,100+sold.sale.amount);check('sale preserves shop wallet',sold.wallet.coins,price.wallet.coins);
 const report={status:'PASS',checks,results,kind:'PGlite authoritative forging and discovery transactions'};
 fs.writeFileSync(process.env.LAUNCHER_FISH_FORGE_QA_OUT||'D:/Codex_QA/launcher-fishing-r35/forge-server-report.json',JSON.stringify(report,null,2));console.log('PASS '+checks+' forge server checks');await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
