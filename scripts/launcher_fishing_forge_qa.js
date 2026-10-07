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
async function command(secret,type,payload,requestId,revision){
  const snap=await get(secret);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId,expectedRevision:revision??snap.life.revision},now,cap);
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
 const report={status:'PASS',checks,results,kind:'PGlite authoritative forging and discovery transactions'};
 fs.writeFileSync('D:/Codex_QA/launcher-fishing-r29/forge-server-report.json',JSON.stringify(report,null,2));console.log('PASS '+checks+' forge server checks');await db.close();
}
main().catch(e=>{console.error(e);process.exitCode=1;});
