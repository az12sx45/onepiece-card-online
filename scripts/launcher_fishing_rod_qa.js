'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life=require('../server/launcher-life-store');
const fishing=require('../server/launcher-fishing-v4');
const db=new PGlite(),cap={crewContentRevision:1};
let queue=Promise.resolve(),checks=0;
const results=[];
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const now=new Date(),today=now.toISOString().slice(0,10),actor='room-character-luffy';
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks++;results.push({name:label,status:'PASS'});}
async function add(secret,coins){
  const stats={launcherWalletV1:{coins,lastGrantDay:today},launcherOwnedV1:{items:[actor]},
    launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:[{itemId:actor,x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify(stats)]);
}
const get=secret=>life.getLauncherLife(pool,secret,now,cap);
async function command(secret,type,payload,requestId,revision){
  const snap=await get(secret);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId,expectedRevision:revision??snap.life.revision},now,cap);
}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await add('poor',10);await add('fisher',160);await add('atomic',100);await add('competing',100);
  let response=await get('fisher');
  check('default rod state survives normalization',response.life.fishingRodLevel,0);
  check('default status',{...response.rod},{level:0,maxLevel:3,nextCost:20});
  response=await command('poor','rod.upgrade',{},'rod-poor-0001');
  check('insufficient coins rejected',response.error,'insufficient_coins');
  check('insufficient coins unchanged',response.wallet.coins,10);
  check('invalid price injection rejected',(await command('fisher','rod.upgrade',{price:0},'rod-inject-0001')).error,'invalid_command');
  const before=await get('fisher'),firstRequest={type:'rod.upgrade',payload:{},requestId:'rod-first-0001',expectedRevision:before.life.revision};
  const first=await life.commandLauncherLife(pool,'fisher',firstRequest,now,cap);
  check('first level and next price',first.rod,{level:1,maxLevel:3,nextCost:35});
  check('first wallet debit',first.wallet.coins,140);
  check('first receipt',{amount:first.receipt.amount,level:first.receipt.level}, {amount:-20,level:1});
  const replay=await life.commandLauncherLife(pool,'fisher',firstRequest,now,cap);
  check('same request id is replay',replay.duplicate,true);
  check('same request does not debit twice',replay.wallet.coins,140);
  check('same request does not advance level twice',replay.rod.level,1);
  const started=await command('fisher','minigame.start',
    {kind:'fishing',characterId:actor,baitId:'worm',spotId:'shore',fishingVersion:4},'rod-start-0001');
  check('fishing v4 starts',started.ok,true);
  check('rod pinned to session and round',[started.minigame.rodLevel,started.minigame.challenge.rodLevel],[1,1]);
  response=await command('fisher','rod.upgrade',{},'rod-second-0001');
  check('second level and next price',response.rod,{level:2,maxLevel:3,nextCost:55});
  check('second wallet debit',response.wallet.coins,105);
  check('active session stays pinned',response.activeMinigame.rodLevel,1);
  check('active round stays pinned',response.activeMinigame.challenge.rodLevel,1);
  response=await command('fisher','minigame.cancel',
    {sessionId:started.minigame.id,token:started.minigame.token},'rod-cancel-0001');
  check('active fishing cancelled',response.cancelled,true);
  const next=await command('fisher','minigame.start',
    {kind:'fishing',characterId:actor,baitId:'worm',spotId:'shore',fishingVersion:4},'rod-start-0002');
  check('new session uses new level',[next.minigame.rodLevel,next.minigame.challenge.rodLevel],[2,2]);
  await command('fisher','minigame.cancel',{sessionId:next.minigame.id,token:next.minigame.token},'rod-cancel-0002');
  response=await command('fisher','rod.upgrade',{},'rod-third-0001');
  check('third level reaches cap',response.rod,{level:3,maxLevel:3,nextCost:null});
  check('third wallet debit',response.wallet.coins,50);
  check('fourth upgrade rejected',(await command('fisher','rod.upgrade',{},'rod-fourth-0001')).error,'rod_max_level');
  check('max level wallet unchanged',(await get('fisher')).wallet.coins,50);
  const raceSnapshot=await get('competing');
  const raceCommand=(id)=>life.commandLauncherLife(pool,'competing',
    {type:'rod.upgrade',payload:{},requestId:id,expectedRevision:raceSnapshot.life.revision},now,cap);
  const race=await Promise.all([raceCommand('rod-race-a0001'),raceCommand('rod-race-b0001')]);
  check('two concurrent upgrades with one revision have one winner',race.filter(item=>item.ok).length,1);
  check('second competing upgrade conflicts',race.filter(item=>item.error==='revision_conflict').length,1);
  check('competing requests only debit once',(await get('competing')).wallet.coins,80);
  const failingPool={query:pool.query,async connect(){const connection=await pool.connect();return{
    release:()=>connection.release(),query:(sql,args)=>String(sql).startsWith('INSERT INTO launcher_wallet_ledger')
      ?Promise.reject(new Error('fixture rod ledger failure')):connection.query(sql,args)};}};
  const atomicSnapshot=await get('atomic');
  const atomicCommand={type:'rod.upgrade',payload:{},requestId:'rod-atomic-0001',expectedRevision:atomicSnapshot.life.revision};
  await assert.rejects(()=>life.commandLauncherLife(failingPool,'atomic',atomicCommand,now,cap),/fixture rod ledger failure/);
  checks++;results.push({name:'ledger insert failure propagates after rollback',status:'PASS'});
  const atomicSaved=(await db.query('SELECT stats FROM player_profiles WHERE secret=$1',['atomic'])).rows[0].stats;
  check('failed ledger rolls back wallet',atomicSaved.launcherWalletV1.coins,100);
  const atomicState=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$1)',['atomic'])).rows[0].state;
  check('failed ledger rolls back rod level',atomicState.fishingRodLevel,0);
  check('failed ledger rolls back revision',atomicState.revision,atomicSnapshot.life.revision);
  check('same request succeeds after failed transaction',
    (await life.commandLauncherLife(pool,'atomic',atomicCommand,now,cap)).wallet.coins,80);
  const user=(await db.query('SELECT user_id FROM player_profiles WHERE secret=$1',['fisher'])).rows[0].user_id;
  const ledger=(await db.query('SELECT amount,balance_after FROM launcher_wallet_ledger WHERE user_id=$1 ORDER BY created_at,operation_id',[user])).rows;
  check('one ledger record per actual purchase',ledger.length,3);
  check('ledger debits total',ledger.reduce((total,row)=>total+row.amount,0),-110);
  const persisted=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[user])).rows[0].state;
  check('rod persists in life state',persisted.fishingRodLevel,3);
  const old=fishing.create('old',now.getTime());delete old.rodLevel;
  check('pre-upgrade v4 round remains level zero',fishing.rodLevel(old.rodLevel),0);
  const compare=level=>{
    const round=fishing.create('compare',now.getTime(),level);
    round.motionSeed=12345;round.motionStartedAt=now.toISOString();
    fishing.hook(round,now,1);fishing.control(round,now,true,0);
    fishing.simulate(round,new Date(now.getTime()+1800),1);
    return round;
  };
  const basic=compare(0),upgraded=compare(3);
  check('upgraded rod reels more distance',upgraded.distance<basic.distance,true);
  check('upgraded rod accumulates less tension',upgraded.tension<basic.tension,true);
  check('rod upgrade does not change fish species pool',
    require('../server/launcher-minigames').FISH_SPECIES.length>0,true);
  const files=['server/launcher-life.js','server/launcher-life-store.js','server/launcher-minigames.js',
    'server/launcher-fishing-v4.js','scripts/launcher_fishing_rod_qa.js'];
  const report={schemaVersion:1,status:'PASS',checks,results,
    sourceHashes:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256')
      .update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')])),
    limitations:['PGlite transaction simulation; not production PostgreSQL concurrency or human fishing play.'],
    createdAt:new Date().toISOString()};
  if(process.argv[2]){fs.mkdirSync(path.dirname(path.resolve(process.argv[2])),{recursive:true});
    fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:'PASS',checks,output:process.argv[2]||null}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
