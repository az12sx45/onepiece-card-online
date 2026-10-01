'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const S=require('../server/launcher-profile-shop');
const B=require('../server/launcher-life-store');
const L=require('../server/launcher-life');
const {PROFILE_STATS_SQL}=require('../server/board-art-collection');
const db=new PGlite();
// PGlite has one session. Queue whole transactions explicitly so concurrent
// invocations test both service orderings without pretending to test PG locks.
let transactionTail=Promise.resolve(),nextAdmission;
const pool={query:(...args)=>db.query(...args),async connect(){
 const prior=transactionTail;let release;
 transactionTail=new Promise(resolve=>{release=resolve;});await prior;
 if(nextAdmission){const notify=nextAdmission;nextAdmission=null;notify();}
 return{query:(...args)=>db.query(...args),release};
}};
async function queuedPair(first,second){
 const admitted=new Promise(resolve=>{nextAdmission=resolve;});
 const a=first();await admitted;return Promise.all([a,second()]);
}
const results=[];
let seq=0;
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);results.push({name,pass:true});};
const today=new Date().toISOString().slice(0,10),base=Date.parse(today+'T03:00:00.000Z');
const now=s=>new Date(base+s*1000),id=k=>'room-character-'+k;
const keys=['luffy','zoro','nami','usopp','sanji','chopper','robin','franky','brook','jinbe'];
const legacyRoom=room=>{const {scenes:_scenes,...flat}=room;return flat;};
function stats(owned=['luffy','zoro','nami'],coins=100) {return {
 client:{totals:{coins:73}},launcherWalletV1:{coins,lastGrantDay:today},
 launcherOwnedV1:{items:owned.map(id)},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:owned.map((key,i)=>({itemId:id(key),x:160+i*70,y:440}))},
 launcherLifeV1:{revision:999999,jobs:[{reward:9999}],characters:{[id('luffy')]:{needs:{energy:999}}}}
};}
const add=async(secret,value)=>{await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify(value)]);};
const row=async secret=>(await db.query('SELECT * FROM player_profiles WHERE secret=$1',[secret])).rows[0];
const get=(secret,time=0)=>B.getLauncherLife(pool,secret,now(time));
async function cmd(secret,type,payload,time=0,opts={}) {
 const snap=opts.snapshot||await get(secret,time);
 return B.commandLauncherLife(pool,secret,{requestId:opts.requestId||'qa-op-'+String(++seq).padStart(8,'0'),expectedRevision:opts.revision??snap.life.revision,type,payload},now(time));
}
async function start(secret,key,time=0,stationId='deck') {
 const snap=await get(secret,time),reserved=await cmd(secret,'work.reserve',{itemId:id(key),stationId,roomRevision:snap.room.revision},time,{snapshot:snap});
 assert.equal(reserved.ok,true,JSON.stringify(reserved));
 const activation=Math.max(time,Math.ceil((Date.parse(reserved.job.activateAfter)-base)/1000));
 const active=await cmd(secret,'work.activate',{jobId:reserved.job.jobId},activation);
 assert.equal(active.ok,true,JSON.stringify(active));return {reserved,active,time:activation,ready:Math.ceil((Date.parse(active.job.readyAt)-base)/1000)};
}
(async()=>{
 try {
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await add('owner',stats());await add('empty',stats([]));
  check('bad secret has no state',(await get('wrong')).error,'bad secret');
  const init=await get('owner');
  check('only purchased actors',init.life.ownedCharacterIds,[id('luffy'),id('zoro'),id('nami')]);
  check('initial old purchases have no arrival replay',init.life.pendingArrivals.length,0);
  check('poisoned legacy JSON ignored',init.life.revision,1);
  check('canonical initial needs',init.life.characters[id('luffy')].needs,L.content().characters.luffy.initialNeeds);
  check('never create free starter crew',(await get('empty')).life.ownedCharacterIds,[]);
  check('client life branch stripped',S.sanitizeLauncherStatsPatch({launcherLifeV1:{coins:9},other:1}),{other:1});
  check('nonowner cannot reserve',(await cmd('empty','work.reserve',{itemId:id('luffy'),stationId:'deck',roomRevision:1})).error,'not_owned');
  check('invalid station rejected',(await cmd('owner','work.reserve',{itemId:id('luffy'),stationId:'hacked',roomRevision:1})).error,'invalid_station');
  check('stale room rejected',(await cmd('owner','work.reserve',{itemId:id('luffy'),stationId:'deck',roomRevision:9})).error,'room_revision_conflict');
  check('client reward/time injection rejected',(await cmd('owner','work.reserve',{itemId:id('luffy'),stationId:'deck',roomRevision:1,reward:999})).error,'invalid_command');
  for(const type of ['constructor','__proto__','toString',['checkpoint'],null])check('reject inherited or nonstring command '+JSON.stringify(type),(await cmd('owner',type,{})).error,'invalid_command');
  for(const directiveId of ['constructor','__proto__','toString'])check('reject inherited directive '+directiveId,(await cmd('owner','directive.set',{directiveId})).error,'invalid_directive');
  check('saved inherited directive normalized',L.normalizeState({directive:'constructor'},[],[],now(0)).directive,'free_day');
  const rs=await cmd('owner','work.reserve',{itemId:id('luffy'),stationId:'deck',roomRevision:1},0);
  check('reserve has no started timestamp',rs.job.activatedAt,null);
  check('early arrival cannot activate',(await cmd('owner','work.activate',{jobId:rs.job.jobId},0)).error,'arrival_too_early');
  check('reserved job cannot complete',(await cmd('owner','work.complete',{jobId:rs.job.jobId},1)).error,'work_not_ready');
  const before=rs.wallet.coins;
  const offlineReserved=await get('owner',800);
  check('expired reservation has no offline reward',offlineReserved.wallet.coins,before);
  check('reservation expiry removes job',offlineReserved.life.jobs.length,0);
  const started=await start('owner','luffy',801);
  check('old start sees new active job',(await S.startLauncherCharacterWork(pool,'owner',id('luffy'),now(started.time))).error,'work_active');
  check('work duration server efficiency',started.active.job.durationMs,Math.round(300000/L.clamp(L.content().characters.luffy.workEfficiency.deck??1,.35,1.5)));
  check('not ready after actual activation',(await cmd('owner','work.complete',{jobId:started.active.job.jobId},started.time+1)).error,'work_not_ready');
  // Keep foreground heartbeat recent to exercise explicit completion, not offline auto-claim.
  await get('owner',started.ready-30);
  const request='complete-once-123',first=await cmd('owner','work.complete',{jobId:started.active.job.jobId},started.ready,{requestId:request});
  check('real work pays ten',first.receipt.amount,10);
  const replay=await cmd('owner','work.complete',{jobId:started.active.job.jobId},started.ready,{requestId:request});
  check('same request replay wallet unchanged',replay.wallet.coins,first.wallet.coins);
  check('same request replay same receipt',replay.receipt,first.receipt);
  const secondId=await cmd('owner','work.complete',{jobId:started.active.job.jobId},started.ready);
  check('new request same job no double reward',secondId.wallet.coins,first.wallet.coins);
  check('different payload same request rejected',(await cmd('owner','work.cancel',{jobId:started.active.job.jobId},started.ready,{requestId:request})).error,'request_id_conflict');
  check('Card currency untouched',(await row('owner')).stats.client.totals.coins,73);
  const stale=await get('owner',started.ready),changed=await cmd('owner','directive.set',{directiveId:'training_day'},started.ready);
  const conflictId='revision-retry-123';
  const conflict=await cmd('owner','directive.set',{directiveId:'work_day'},started.ready,{revision:stale.life.revision,requestId:conflictId});
  check('revision conflict includes fresh snapshot',conflict.error,'revision_conflict');
  check('retry same logical request after conflict',(await cmd('owner','directive.set',{directiveId:'work_day'},started.ready,{snapshot:conflict,requestId:conflictId})).ok,true);
  const gift=await cmd('owner','character.interact',{itemId:id('nami'),action:'gift'},2000);
  check('gift costs five',gift.interaction.cost,5);
  const giftReject=await cmd('owner','character.interact',{itemId:id('nami'),action:'gift'},2001);
  check('gift cooldown',giftReject.error,'interaction_cooldown');check('rejected gift no charge',giftReject.wallet.coins,gift.wallet.coins);
  const gift2=await cmd('owner','character.interact',{itemId:id('nami'),action:'gift'},2061);
  const gift3=await cmd('owner','character.interact',{itemId:id('nami'),action:'gift'},2122);
  check('gift daily two',gift3.error,'gift_daily_limit');check('daily limit no charge',gift3.wallet.coins,gift2.wallet.coins);
  await add('activity',stats(['luffy']));await get('activity',0);
  check('activity first eight seconds',(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Eat'},0)).error,'activity_cooldown');
  check('activity forged needs rejected',(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Eat',needs:{energy:100}},8)).error,'invalid_command');
  check('activity nonowned rejected',(await cmd('activity','activity.record',{itemId:id('nami'),activity:'Eat'},8)).error,'not_owned');
  check('activity arbitrary action rejected',(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'MintCoins'},8)).error,'invalid_activity');
  const beforeEat=await get('activity',8),ate=await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Eat'},8,{snapshot:beforeEat});
  check('completed meal saves fixed server hunger delta',ate.life.characters[id('luffy')].needs.hunger,beforeEat.life.characters[id('luffy')].needs.hunger-8);
  check('activity earns no coins',ate.wallet.coins,beforeEat.wallet.coins);
  check('activity cooldown',(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Rest'},9)).error,'activity_cooldown');
  for(let n=1;n<12;n++)check('bounded activity '+n,(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Rest'},8+n*31)).ok,true);
  check('activity hourly cap',(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Sleep'},400)).error,'activity_hourly_limit');
  const activeBlock=await start('activity','luffy',401);
  check('activity cannot fake rest while earning',(await cmd('activity','activity.record',{itemId:id('luffy'),activity:'Rest'},activeBlock.time+1)).error,'work_active');
  const ownedEvent=L.content().events.find(e=>!e.requiredFurniture?.length&&e.location?.type==='floor'&&e.requiredCharacters.length>1&&e.requiredCharacters.every(k=>['luffy','zoro','nami'].includes(k)));
  assert.ok(ownedEvent,'shared content has an owned pair event');
  check('unknown event rejected',(await cmd('owner','event.record',{eventId:'mint-coins',participants:[id('luffy')]},2200)).error,'invalid_event');
  check('invalid participant rejected',(await cmd('owner','event.record',{eventId:ownedEvent.id,participants:[id('luffy'),id('sanji')]},2200)).error,'invalid_participants');
  const event=await cmd('owner','event.record',{eventId:ownedEvent.id,participants:ownedEvent.requiredCharacters.map(id)},2200);
  check('defined owned pair event accepted',event.ok,true);
  check('event cooldown blocks farming',(await cmd('owner','event.record',{eventId:ownedEvent.id,participants:ownedEvent.requiredCharacters.map(id)},2201)).error,'event_cooldown');
  check('memories saved',event.life.characters[id(ownedEvent.requiredCharacters[0])].memories.some(m=>m.type===(ownedEvent.memory?.type||ownedEvent.id)),true);
  const offlineStart=await start('owner','zoro',2300);
  await cmd('owner','checkpoint',{exit:true},offlineStart.time+1);
  const recovered=await get('owner',offlineStart.ready+600);
  check('offline work receipt once',recovered.life.offlineSummary.completedJobs,1);
  check('offline work coin summary',recovered.life.offlineSummary.coins,10);
  check('reloading cannot reaward',(await get('owner',offlineStart.ready+601)).wallet.coins,recovered.wallet.coins);
  const bounded=await get('owner',offlineStart.ready+999999);
  check('offline aggregation capped eight hours',bounded.life.offlineSummary.elapsedMs,8*3600000);
  check('needs always bounded',Object.values(bounded.life.characters).every(c=>Object.values(c.needs).every(v=>v>=0&&v<=100)),true);
  await add('legacy',stats(['luffy']));
  await S.startLauncherCharacterWork(pool,'legacy',id('luffy'),now(0));
  const imported=await get('legacy',1);check('legacy active job imported',imported.life.jobs[0].legacy,true);
  const legacySettled=await get('legacy',301);check('legacy offline pays once',legacySettled.wallet.coins,110);
  check('legacy old API cannot reaward',(await S.claimLauncherCharacterWork(pool,'legacy',id('luffy'),now(302))).claimed,false);
  await add('legacy-first',stats(['luffy']));await S.startLauncherCharacterWork(pool,'legacy-first',id('luffy'),now(0));
  const legacyImported=await get('legacy-first',1);
  await S.claimLauncherCharacterWork(pool,'legacy-first',id('luffy'),now(300));
  const afterOld=await get('legacy-first',301);check('old claim then life preserves one payout',afterOld.wallet.coins,110);check('old claim removes imported job',afterOld.life.jobs.length,0);
  check('ledger unique per legacy reward',Number((await db.query('SELECT count(*) AS n FROM launcher_wallet_ledger WHERE user_id=$1',[(await row('legacy-first')).user_id])).rows[0].n),1);
  await add('cap',stats(['luffy'],495));const full=await start('cap','luffy',0);const capSnap=await get('cap',full.ready+1);
   check('wallet cap grants only five available coins',capSnap.wallet.coins,500);
   check('capped work completes instead of holding job',capSnap.life.jobs.length,0);
   check('capped work reports actual offline coins',capSnap.life.offlineSummary.coins,5);
  await S.changeLauncherItem(pool,'cap','bgm-op-01','buy');const afterSpend=await cmd('cap','work.complete',{jobId:full.active.job.jobId},full.ready+2);
   check('spending cannot reaward completed work',afterSpend.wallet.coins,490);
  await add('buyer',stats(['luffy'],500));const beforeBuy=await get('buyer');
  const bought=await S.changeLauncherItem(pool,'buyer',id('zoro'),'buy');
  check('new purchase auto adds owned actor',bought.profile.room.characters.map(c=>c.itemId),[id('luffy'),id('zoro')]);
  check('purchase preserves existing position',bought.profile.room.characters[0],beforeBuy.room.characters[0]);
  check('arrival once',bought.life.pendingArrivals.length,1);
  check('repeat purchase rejected',(await S.changeLauncherItem(pool,'buyer',id('zoro'),'buy')).error,'already_owned');
  const arrival=bought.life.pendingArrivals[0];check('ack succeeds',(await cmd('buyer','arrival.ack',{arrivalId:arrival.arrivalId})).ok,true);
  check('ack survives reload',(await get('buyer')).life.pendingArrivals.length,0);
  const stove='room-furniture-galley-stove',stoveBefore=(await S.getLauncherShop(pool,'buyer')).shop.wallet.coins;
  const stoveBuy=await S.changeLauncherItem(pool,'buyer',stove,'buy');
  check('new stove is paid item',stoveBuy.shop.wallet.coins,stoveBefore-80);
  check('stove is never granted without purchase',(await S.getLauncherShop(pool,'empty')).shop.owned.roomFurniture.includes(stove),false);
  const stoveRoom={...legacyRoom(stoveBuy.profile.room),placements:[{itemId:stove,x:480,y:400,rotation:0,scale:1,flip:false}]};
  check('owned stove may be placed',(await S.setLauncherRoom(pool,'buyer',stoveRoom)).ok,true);
  check('canonical new stove station type',L.stationFor(S.launcherRoom((await row('buyer')).stats),stove).type,'kitchen');
  await add('ten',stats(keys));const ten=await get('ten');check('ten owned actors retained',ten.room.characters.length,10);
  check('legacy eight client cannot erase ninth tenth',(await S.setLauncherRoom(pool,'ten',{...legacyRoom(ten.room),capacityVersion:undefined,characters:ten.room.characters.slice(0,8)})).error,'upgrade_required');
  check('v2 ten save works',(await S.setLauncherRoom(pool,'ten',ten.room)).ok,true);
  // Move an owned station after activation: the job is invalidated and cannot pay.
  const furniture='room-furniture-map-table',movedStats=stats(['nami']);movedStats.launcherOwnedV1.items.push(furniture);movedStats.launcherRoomV1.placements=[{itemId:furniture,x:500,y:430,scale:1,rotation:0,flip:false}];
  await add('moved',movedStats);const moveWork=await start('moved','nami',0,furniture),moveSnap=await get('moved',10);
  await S.setLauncherRoom(pool,'moved',{...legacyRoom(moveSnap.room),placements:[{...moveSnap.room.placements[0],x:700}]});
  const cancelled=await get('moved',moveWork.ready+1);check('moved furniture cancels invalid work',cancelled.life.jobs.length,0);check('invalid station never pays',cancelled.wallet.coins,100);
   // Work sessions remain available after six starts and two starts per actor.
  await add('limits',stats(keys));
  for(let n=0;n<6;n++) {const key=keys[Math.floor(n/2)],work=await start('limits',key,n*700),settled=await get('limits',work.ready+2);check('daily reward '+n,settled.wallet.coins,110+n*10);}
   check('seventh work reserve succeeds',(await cmd('limits','work.reserve',{itemId:id('franky'),stationId:'deck',roomRevision:1},5000)).ok,true);
  await add('perchar',stats());const one=await start('perchar','luffy',0);await get('perchar',one.ready+1);const two=await start('perchar','luffy',700);await get('perchar',two.ready+1);
   check('third same-character work reserve succeeds',(await cmd('perchar','work.reserve',{itemId:id('luffy'),stationId:'deck',roomRevision:1},1400)).ok,true);
  const beforeProtect=await row('buyer');
  const safe=S.sanitizeLauncherStatsPatch({launcherWalletV1:{coins:999999},launcherOwnedV1:{items:keys.map(id)},launcherLifeV1:{revision:90000},launcherCompanionsV1:{claimsToday:0},client:{totals:{coins:17}}});
  await db.query('UPDATE player_profiles SET stats='+PROFILE_STATS_SQL.replaceAll('$4','$1')+' WHERE user_id=$2',[JSON.stringify(safe),beforeProtect.user_id]);
  const afterProtect=await row('buyer');check('generic profile update preserves wallet',afterProtect.stats.launcherWalletV1,beforeProtect.stats.launcherWalletV1);check('generic update preserves ownership',afterProtect.stats.launcherOwnedV1,beforeProtect.stats.launcherOwnedV1);
  const projection=await B.publicProjection(pool,await row('owner'));check('guest projection contains no memories/jobs',JSON.stringify(projection).includes('memories')||JSON.stringify(projection).includes('jobs'),false);
  // No Life GET is allowed between reservation expiry and legacy start: the
  // old API itself must discard stale reservations from its capacity guard.
  await add('stale-reservation',stats(['luffy']));
  await cmd('stale-reservation','work.reserve',{itemId:id('luffy'),stationId:'deck',roomRevision:1},0);
  check('old start ignores expired new reservation',(await S.startLauncherCharacterWork(pool,'stale-reservation',id('luffy'),now(601))).ok,true);
  await add('stale-context',movedStats);
  await start('stale-context','nami',0,furniture);
  const oldRoom=S.launcherRoom((await row('stale-context')).stats);
  await S.setLauncherRoom(pool,'stale-context',{...legacyRoom(oldRoom),placements:[{...oldRoom.placements[0],x:700}]});
  check('old start ignores relocated new station',(await S.startLauncherCharacterWork(pool,'stale-context',id('nami'),now(20))).ok,true);
  // Same revision / same request ID must commit one effect in either delivery.
  await add('duplicate-gift',stats(['nami']));const dupSnap=await get('duplicate-gift');
  const duplicateCommand={type:'character.interact',payload:{itemId:id('nami'),action:'gift'},requestId:'concurrent-gift-123',expectedRevision:dupSnap.life.revision};
  const duplicateResults=await Promise.all([B.commandLauncherLife(pool,'duplicate-gift',duplicateCommand,now(0)),B.commandLauncherLife(pool,'duplicate-gift',duplicateCommand,now(0))]);
  check('queued duplicate both replies succeed',duplicateResults.map(r=>r.ok),[true,true]);
  check('queued duplicate has one replay',duplicateResults.filter(r=>r.duplicate).length,1);
  check('queued duplicate gift single debit',(await row('duplicate-gift')).stats.launcherWalletV1.coins,95);
  check('queued duplicate gift single ledger',Number((await db.query('SELECT count(*) n FROM launcher_wallet_ledger WHERE user_id=$1',[(await row('duplicate-gift')).user_id])).rows[0].n),1);
  const raceSnap=await get('duplicate-gift',61);
  const directives=await Promise.all(['training_day','work_day'].map((directiveId,i)=>B.commandLauncherLife(pool,'duplicate-gift',{type:'directive.set',payload:{directiveId},requestId:'competing-directive-'+i,expectedRevision:raceSnap.life.revision},now(61))));
  check('different requests same revision one wins',directives.map(r=>r.ok),[true,false]);
  check('second competing request gets conflict',directives[1].error,'revision_conflict');
   // Purchase and payout share the same profile transaction. At 495 coins,
   // payout grants only the space available at the moment the row lock is held.
  for(const purchaseFirst of [true,false]){
   const secret='wallet-order-'+purchaseFirst;await add(secret,stats(['luffy'],495));
   const work=await start(secret,'luffy'),snapshot=await get(secret,work.ready-1);
   const complete=()=>B.commandLauncherLife(pool,secret,{type:'work.complete',payload:{jobId:work.active.job.jobId},requestId:'wallet-complete-'+purchaseFirst,expectedRevision:snapshot.life.revision},now(work.ready));
   const purchase=()=>S.changeLauncherItem(pool,secret,'bgm-op-01','buy');
   const ordered=await queuedPair(...(purchaseFirst?[purchase,complete]:[complete,purchase]));
   check('wallet order purchase success '+purchaseFirst,ordered[purchaseFirst?0:1].ok,true);
    check('wallet order completion result '+purchaseFirst,ordered[purchaseFirst?1:0].ok,true);
   const final=await cmd(secret,'work.complete',{jobId:work.active.job.jobId},work.ready+1);
    check('wallet order respects cap and serial order '+purchaseFirst,final.wallet.coins,purchaseFirst?495:490);
    check('wallet order receipt has actual payout '+purchaseFirst,final.receipt.amount,purchaseFirst?10:5);
   check('wallet order preserves purchase '+purchaseFirst,(await row(secret)).stats.launcherOwnedV1.items.includes('bgm-op-01'),true);
   check('wallet order one reward ledger '+purchaseFirst,Number((await db.query('SELECT count(*) n FROM launcher_wallet_ledger WHERE user_id=$1',[(await row(secret)).user_id])).rows[0].n),1);
  }
  // Both old/new claim orderings see one legacy receipt under queued calls.
  for(const oldFirst of [true,false]){
   const secret='legacy-race-'+oldFirst;await add(secret,stats(['luffy']));await S.startLauncherCharacterWork(pool,secret,id('luffy'),now(0));
   const snapshot=await get(secret,299),job=snapshot.life.jobs[0];
   const oldClaim=()=>S.claimLauncherCharacterWork(pool,secret,id('luffy'),now(300));
   const newClaim=()=>B.commandLauncherLife(pool,secret,{type:'work.complete',payload:{jobId:job.jobId},requestId:'legacy-race-command-'+oldFirst,expectedRevision:snapshot.life.revision},now(300));
   await queuedPair(...(oldFirst?[oldClaim,newClaim]:[newClaim,oldClaim]));
   check('queued legacy mixed API one payout '+oldFirst,(await row(secret)).stats.launcherWalletV1.coins,110);
   check('queued legacy mixed API one ledger '+oldFirst,Number((await db.query('SELECT count(*) n FROM launcher_wallet_ledger WHERE user_id=$1',[(await row(secret)).user_id])).rows[0].n),1);
  }
  await add('purchase-race',stats(['luffy'],500));
  const purchases=await Promise.all([S.changeLauncherItem(pool,'purchase-race',id('zoro'),'buy'),S.changeLauncherItem(pool,'purchase-race',id('zoro'),'buy')]);
  check('duplicate character purchase one accepted',purchases.filter(r=>r.ok).length,1);
  check('duplicate purchase rejected without debit',purchases.find(r=>!r.ok).error,'already_owned');
  const purchaseLife=await get('purchase-race');
  check('duplicate purchase one arrival',purchaseLife.life.pendingArrivals.length,1);
  check('duplicate purchase one debit',purchaseLife.wallet.coins,500-S.CATALOG.find(x=>x.id===id('zoro')).price);
  await add('capacity-buy',stats(keys.slice(0,8),500));const positions=S.launcherRoom((await row('capacity-buy')).stats).characters;
  check('ninth crew purchase',(await S.changeLauncherItem(pool,'capacity-buy',id('brook'),'buy')).ok,true);
  const tenth=await S.changeLauncherItem(pool,'capacity-buy',id('jinbe'),'buy');
  check('tenth crew purchase places ten',tenth.profile.room.characters.length,10);
  check('ninth tenth keep first eight positions',tenth.profile.room.characters.slice(0,8),positions);
  check('ninth tenth arrivals exactly two',tenth.life.pendingArrivals.length,2);
  const overflowStats=stats(['luffy'],500);overflowStats.launcherRoomV1.revision=Number.MAX_SAFE_INTEGER;await add('revision-overflow',overflowStats);
  const overflowBuy=await S.changeLauncherItem(pool,'revision-overflow',id('zoro'),'buy');
  check('room revision overflow defers placement without blocking purchase',
    [overflowBuy.ok,overflowBuy.roomPlacementDeferred,overflowBuy.profile.room.revision],
    [true,true,Number.MAX_SAFE_INTEGER]);
  check('deferred purchase debits once',(await row('revision-overflow')).stats.launcherWalletV1.coins,
    500-S.CATALOG.find(x=>x.id===id('zoro')).price);
  check('deferred purchase keeps new ownership',(await row('revision-overflow')).stats.launcherOwnedV1.items,
    [id('luffy'),id('zoro')]);
  await add('offline-batch',stats(keys,100));const batch=[];
  for(const key of keys.slice(0,6))batch.push(await start('offline-batch',key,0));
  const allReady=Math.max(...batch.map(w=>w.ready));const batchResult=await get('offline-batch',allReady+1);
  check('six offline jobs aggregate once',batchResult.life.offlineSummary.completedJobs,6);
  check('six offline jobs pay sixty',batchResult.wallet.coins,160);
  check('offline batch repeat no reward',(await get('offline-batch',allReady+2)).wallet.coins,160);
  // A failed receipt insert must roll back wallet, state and the operation.
  await add('atomic-failure',stats(['nami']));const rollbackSnapshot=await get('atomic-failure');
  const failingPool={query:pool.query,async connect(){const c=await pool.connect();return{release:()=>c.release(),query:(sql,args)=>String(sql).startsWith('INSERT INTO launcher_wallet_ledger')?Promise.reject(new Error('fixture ledger failure')):c.query(sql,args)};}};
  const failedCommand={type:'character.interact',payload:{itemId:id('nami'),action:'gift'},requestId:'rollback-gift-123',expectedRevision:rollbackSnapshot.life.revision};
  await assert.rejects(()=>B.commandLauncherLife(failingPool,'atomic-failure',failedCommand,now(0)),/fixture ledger failure/);results.push({name:'ledger error propagates after rollback',pass:true});
  check('ledger rollback wallet untouched',(await row('atomic-failure')).stats.launcherWalletV1.coins,100);
  const rollbackState=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[(await row('atomic-failure')).user_id])).rows[0].state;
  check('ledger rollback life revision untouched',rollbackState.revision,rollbackSnapshot.life.revision);
  check('same request retry after transaction failure',(await B.commandLauncherLife(pool,'atomic-failure',failedCommand,now(0))).wallet.coins,95);
  await add('visitor',stats([]));await add('friend-target',stats(['luffy']));
  const visitor=await row('visitor'),friend=await row('friend-target');
  const setFriends=async(userId,friends)=>db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social}', $1::jsonb) WHERE user_id=$2",[JSON.stringify({friends}),userId]);
  await setFriends(visitor.user_id,[friend.user_id]);
  check('one-way friend cannot inspect life',(await S.getLauncherProfile(pool,'visitor',friend.user_id)).error,'not friends');
  await setFriends(friend.user_id,[visitor.user_id]);await start('friend-target','luffy',0);
  const beforeVisit=await row('friend-target'),beforeVisitState=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[friend.user_id])).rows[0].state;
  const visit=await S.getLauncherProfile(pool,'visitor',friend.user_id);
  check('reciprocal friend gets public life',visit.ok,true);
   check('friend life exact public fields',Object.keys(visit.profile.life).sort(),['activeCharacterIds','characters','directive','fishCollection','ownedCharacterIds','revision','schemaVersion'].sort());
  check('friend character projection excludes private fields',Object.keys(visit.profile.life.characters[id('luffy')]).sort(),['itemId','key','needs']);
  check('friend visit does not aggregate profile',(await row('friend-target')).stats,beforeVisit.stats);
  check('friend visit does not advance life state',(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[friend.user_id])).rows[0].state,beforeVisitState);
  const Module=require('node:module'),originalLoad=Module._load;let bridge;
  try {
     Module._load=function(request,parent,isMain){if(request==='electron')return {app:{isPackaged:true},safeStorage:{}};if(request==='socket.io-client')return{io:()=>{throw new Error('Network transport is not used by this bridge QA');}};return originalLoad.call(this,request,parent,isMain);};
    const {AuthService}=require('../desktop/auth-service');bridge=new AuthService({origin:'https://example.invalid',userDataPath:'C:/Codex_Candidates/launcher-life-audit/unused-bridge'});
  }finally{Module._load=originalLoad;}
  bridge.secretMemory='fixture-secret';bridge.state.account={userId:1};let emitted;
  bridge.emitAck=async(event,payload)=>{emitted={event,payload};return {ok:true};};
  check('life GET bridge',(await bridge.getLauncherLife()).ok,true);check('life GET exact event',emitted.event,'LAUNCHER_LIFE_GET');
  const apiCommand={requestId:'bridge-fixture-123',expectedRevision:1,type:'checkpoint',payload:{exit:true},secret:'forged-secret',userId:999};
  check('life command bridge',(await bridge.commandLauncherLife(apiCommand)).ok,true);
  check('secret remains main process authority',emitted.payload.secret,'fixture-secret');check('renderer owner id not forwarded',emitted.payload.userId,undefined);
  check('bridge rejects unknown command',(await bridge.commandLauncherLife({...apiCommand,type:'wallet.set'})).error,'invalid_command');
  bridge.emitAck=async()=>{bridge.secretMemory='changed-account';return {ok:true,life:{}};};
  check('late response after account switch rejected',(await bridge.getLauncherLife()).error,'session changed');bridge.close();
  const report={ok:true,kind:'PGlite simulated SQL integration with explicitly queued concurrent service calls; not real PostgreSQL multi-session locks or UI play',environment:{engine:'PGlite',transactionScheduling:'fixture mutex, one session',postgresProbe:'local 127.0.0.1:5432 no response; no credentials read or live database used'},checks:results.length,results};
  if(process.env.LAUNCHER_LIFE_QA_REPORT)fs.writeFileSync(process.env.LAUNCHER_LIFE_QA_REPORT,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
 }finally{await db.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
