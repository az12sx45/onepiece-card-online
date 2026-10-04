'use strict';

const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life=require('../server/launcher-life-store');
const db=new PGlite(),cap={crewContentRevision:1};
const now=new Date(),today=now.toISOString().slice(0,10),actor='room-character-luffy',otherActor='room-character-robin';
let queue=Promise.resolve(),checks=0;
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks++;}
async function add(secret,coins,affinity=0,includeOther=false){
  const stats={launcherWalletV1:{coins,lastGrantDay:today},
    launcherOwnedV1:{items:[actor,'room-furniture-aquarium-tank',...(includeOther?[otherActor]:[])]},
    launcherCompanionsV1:{characters:{[actor]:{affinity},...(includeOther?{[otherActor]:{affinity:7}}:{})}},
    launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],
      characters:[{itemId:actor,x:160,y:440},...(includeOther?[{itemId:otherActor,x:240,y:440}]:[])]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify(stats)]);
  await life.getLauncherLife(pool,secret,now,cap);
}
async function seed(secret,speciesId,inAquarium=false){
  const user=(await db.query('SELECT user_id FROM player_profiles WHERE secret=$1',[secret])).rows[0].user_id;
  const row=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[user])).rows[0];
  const fish={id:crypto.randomUUID(),speciesId,caughtAt:now.toISOString(),inAquarium};
  row.state.fishCollection.push(fish);
  await db.query('UPDATE launcher_life_state SET state=$1::jsonb WHERE user_id=$2',[JSON.stringify(row.state),user]);
  return fish;
}
const get=secret=>life.getLauncherLife(pool,secret,now,cap);
async function command(secret,type,payload,requestId,revision){
  const before=await get(secret);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId,expectedRevision:revision??before.life.revision},now,cap);
}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await add('cook',10,0,true);await add('sell',16);await add('full',499);await add('max',10,100);await add('race',0);await add('atomic',0);await add('friend',0);
  const cookedFish=await seed('cook','glistening-saury',true);
  const cookOffer=(await get('cook')).fishOffers[0];
  check('offers server-authored meal and common sale',
    {fishId:cookOffer.fishId,cookable:cookOffer.cookable,saleCoins:cookOffer.saleCoins,affinityGain:cookOffer.affinityGain},
    {fishId:cookedFish.id,cookable:true,saleCoins:4,affinityGain:2});
  check('unowned recipient cannot eat fish',
    (await command('cook','fish.cook',{fishId:cookedFish.id,itemId:'room-character-franky'},'cook-other-0001')).error,'not_owned');
  check('invalid affinity injection rejected',
    (await command('cook','fish.cook',{fishId:cookedFish.id,itemId:actor,affinity:100},'cook-cheat-0001')).error,'invalid_command');
  check('friend cannot cook someone else catch',
    (await command('friend','fish.cook',{fishId:cookedFish.id,itemId:actor},'cook-friend-0001')).error,'fish_not_owned');
  const beforeCook=await get('cook');
  const cookCommand={type:'fish.cook',payload:{fishId:cookedFish.id,itemId:actor},requestId:'cook-meal-0001',expectedRevision:beforeCook.life.revision};
  const meal=await life.commandLauncherLife(pool,'cook',cookCommand,now,cap);
  check('meal consumes displayed fish',meal.life.fishCollection.length,0);
  check('meal credits target affinity',
    {itemId:meal.meal.itemId,affinityGained:meal.meal.affinityGained,affinityAfter:meal.meal.affinityAfter},
    {itemId:actor,affinityGained:2,affinityAfter:2});
  check('meal snapshot updates only the selected companion',
    Object.fromEntries(meal.profile.companions.map(companion=>[companion.itemId,companion.affinity])),
    {[actor]:2,[otherActor]:7});
  check('meal clears aquarium projection',(await life.publicProjection(pool,{user_id:(await db.query('SELECT user_id FROM player_profiles WHERE secret=$1',['cook'])).rows[0].user_id,stats:(await db.query('SELECT stats FROM player_profiles WHERE secret=$1',['cook'])).rows[0].stats})).fishCollection.length,0);
  const replayMeal=await life.commandLauncherLife(pool,'cook',cookCommand,now,cap);
  check('same meal request is idempotent',[replayMeal.duplicate,replayMeal.meal.affinityAfter,replayMeal.life.fishCollection.length],[true,2,0]);
  check('second request cannot cook consumed fish',
    (await command('cook','fish.cook',{fishId:cookedFish.id,itemId:actor},'cook-again-0001')).error,'fish_not_owned');
  const unsafe=await seed('cook','smile-jellyfish');
  check('unsafe fantasy species has no recipe',(await get('cook')).fishOffers[0].cookable,false);
  check('unsafe species remains after rejected meal',
    (await command('cook','fish.cook',{fishId:unsafe.id,itemId:actor},'cook-unsafe-0001')).error,'fish_not_cookable');
  check('unsafe species is still owned',(await get('cook')).life.fishCollection[0].id,unsafe.id);
  const maxFish=await seed('max','glistening-saury');
  check('full affinity does not consume meal fish',
    (await command('max','fish.cook',{fishId:maxFish.id,itemId:actor},'cook-max-0001')).error,'affinity_full');
  check('full affinity fish remains',(await get('max')).life.fishCollection.length,1);

  const soldFish=await seed('sell','glistening-saury',true);
  const beforeSale=await get('sell');
  const saleCommand={type:'fish.sell',payload:{fishId:soldFish.id},requestId:'sell-common-0001',expectedRevision:beforeSale.life.revision};
  const sold=await life.commandLauncherLife(pool,'sell',saleCommand,now,cap);
  check('sale credits full price and consumes fish',[sold.sale.amount,sold.wallet.coins,sold.life.fishCollection.length],[4,20,0]);
  const replaySale=await life.commandLauncherLife(pool,'sell',saleCommand,now,cap);
  check('sale replay never duplicates coins',[replaySale.duplicate,replaySale.wallet.coins],[true,20]);
  check('second sale cannot sell consumed fish',
    (await command('sell','fish.sell',{fishId:soldFish.id},'sell-again-0001')).error,'fish_not_owned');
  check('fish proceeds can pay Franky upgrade',
    (await command('sell','rod.upgrade',{},'sell-rod-0001')).rod.level,1);
  check('rod upgrade uses fish proceeds',(await get('sell')).wallet.coins,0);
  const saleLedger=(await db.query("SELECT amount,balance_after FROM launcher_wallet_ledger WHERE operation_id='life-fish-sale:sell-common-0001'")).rows;
  check('sale has one durable wallet ledger row',saleLedger,[{amount:4,balance_after:20}]);

  const fullFish=await seed('full','glistening-saury');
  check('sale above wallet cap is rejected without consuming fish',
    (await command('full','fish.sell',{fishId:fullFish.id},'sell-full-0001')).error,'wallet_full');
  check('wallet cap leaves fish and balance intact',[(await get('full')).life.fishCollection.length,(await get('full')).wallet.coins],[1,499]);
  check('client cannot inject sale value',
    (await command('full','fish.sell',{fishId:fullFish.id,amount:500},'sell-cheat-0001')).error,'invalid_command');

  const raceFish=await seed('race','glistening-saury');
  const raceBefore=await get('race');
  const race=(id,type,payload)=>life.commandLauncherLife(pool,'race',
    {type,payload,requestId:id,expectedRevision:raceBefore.life.revision},now,cap);
  const raced=await Promise.all([race('race-sell-0001','fish.sell',{fishId:raceFish.id}),race('race-cook-0001','fish.cook',{fishId:raceFish.id,itemId:actor})]);
  check('competing sale and meal have one winner',raced.filter(item=>item.ok).length,1);
  check('competing request conflicts',raced.filter(item=>item.error==='revision_conflict').length,1);
  check('one fish cannot be spent twice',(await get('race')).life.fishCollection.length,0);

  const atomicFish=await seed('atomic','glistening-saury');
  const atomicBefore=await get('atomic');
  const atomicCommand={type:'fish.sell',payload:{fishId:atomicFish.id},requestId:'sell-atomic-0001',expectedRevision:atomicBefore.life.revision};
  const failingPool={query:pool.query,async connect(){const connection=await pool.connect();return{release:()=>connection.release(),
    query:(sql,args)=>String(sql).startsWith('INSERT INTO launcher_wallet_ledger')
      ?Promise.reject(new Error('fixture sale ledger failure')):connection.query(sql,args)};}};
  await assert.rejects(()=>life.commandLauncherLife(failingPool,'atomic',atomicCommand,now,cap),/fixture sale ledger failure/);checks++;
  const atomicRaw=(await db.query('SELECT p.stats,l.state FROM player_profiles p JOIN launcher_life_state l ON l.user_id=p.user_id WHERE p.secret=$1',['atomic'])).rows[0];
  check('ledger failure rolls back wallet and fish',
    {coins:atomicRaw.stats.launcherWalletV1.coins,fish:atomicRaw.state.fishCollection[0].id,revision:atomicRaw.state.revision},
    {coins:0,fish:atomicFish.id,revision:atomicBefore.life.revision});
  check('failed sale request can succeed after rollback',
    (await life.commandLauncherLife(pool,'atomic',atomicCommand,now,cap)).sale.amount,4);
  console.log(`aquarium management PASS ${checks} checks`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.close());
