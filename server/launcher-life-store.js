'use strict';

// All mutations lock player_profiles first, then the life row. The wallet and
// unique receipt are committed together; no renderer state is trusted here.
const crypto = require('node:crypto');
const L = require('./launcher-life');
const crewRelease = require('./launcher-crew-release');
const M = require('./launcher-minigames');
const initializers = new WeakMap();
const ACTIVITY_EFFECTS=Object.freeze({Eat:{hunger:-8,mood:1},Rest:{energy:6,mood:1},Sleep:{energy:10},Train:{energy:-4,workMotivation:3},UseFurniture:{mood:1,workMotivation:1}});
function applyActivityNeeds(actor,activity) {
  for(const [key,delta] of Object.entries(ACTIVITY_EFFECTS[activity]||{})){
    const bounds=L.content().needBounds?.[key]||[0,100];actor.needs[key]=L.clamp(actor.needs[key]+delta,bounds[0],bounds[1]);
  }
}
const shop = () => require('./launcher-profile-shop');
function deployedRoom(stats) {
  const room = shop().launcherRoom(stats, true);
  const scenes = Object.values(room.scenes);
  return { ...room, placements: scenes.flatMap(scene => scene.placements),
    characters: scenes.flatMap(scene => scene.characters) };
}
const jobState = (state, room) => ({ ...state,
  activeCharacterIds: room.characters.map(entry => entry.itemId) });
async function ensureLifeTables(pool) {
  if (!initializers.has(pool)) initializers.set(pool, (async () => {
    await pool.query(`CREATE TABLE IF NOT EXISTS launcher_life_state (
      user_id INTEGER PRIMARY KEY, schema_version INTEGER NOT NULL DEFAULT 1,
      revision BIGINT NOT NULL DEFAULT 0, state JSONB NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`);
    await pool.query(`CREATE TABLE IF NOT EXISTS launcher_life_operations (
      user_id INTEGER NOT NULL, request_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
      result JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,request_id))`);
    await pool.query(`CREATE TABLE IF NOT EXISTS launcher_wallet_ledger (
      user_id INTEGER NOT NULL, operation_id TEXT NOT NULL, job_id TEXT,
      amount INTEGER NOT NULL, balance_after INTEGER NOT NULL, receipt JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,operation_id))`);
    await M.ensure(pool);
  })().catch(e => { initializers.delete(pool); throw e; }));
  await initializers.get(pool);
}
async function loadState(db,row,now) {
  const S=shop(),room=S.launcherRoom(row.stats),owned=S.launcherOwnedItemIds(row.stats).filter(L.keyOf);
  const found=await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1 FOR UPDATE',[row.user_id]);
  return L.normalizeState(found.rows[0]?.state,owned,room.characters.map(c=>c.itemId),now);
}
async function saveState(db,userId,state) {
  await db.query(`INSERT INTO launcher_life_state(user_id,schema_version,revision,state) VALUES($1,1,$2,$3::jsonb)
    ON CONFLICT(user_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state,updated_at=now()`,[userId,state.revision,JSON.stringify(state)]);
}
function reconcileLegacy(state,companions,room,now) {
  const live=new Set();
  for(const itemId of state.ownedCharacterIds) {
    const work=companions.characters[itemId]?.activeWork;if(!work)continue;
    const jobId=L.legacyJobId(itemId,work.startedAt);live.add(jobId);
    if(!state.jobs.some(j=>j.jobId===jobId))state.jobs.push({jobId,itemId,stationId:'deck',status:Date.parse(work.readyAt)<=now.getTime()?'ready':'active',reservedAt:work.startedAt,activatedAt:work.startedAt,readyAt:work.readyAt,durationMs:300000,reward:10,roomRevision:room.revision,legacy:true});
  }
  state.jobs=state.jobs.filter(j=>j.legacy?live.has(j.jobId):L.validJobContext(j,jobState(state,room),room));
}
function snapshot(row,state,now,extra={}) {
  const S=shop();return {ok:true,serverNow:now.toISOString(),life:L.publicLife(state),room:S.launcherRoom(row.stats),wallet:S.launcherWalletPublic(row.stats),profile:S.toPublicProfile(row,true),...extra};
}
async function ledger(db,userId,operationId) {
  const result=await db.query('SELECT receipt FROM launcher_wallet_ledger WHERE user_id=$1 AND operation_id=$2',[userId,operationId]);return result.rows[0]?.receipt||null;
}
async function writeLedger(db,row,operationId,jobId,amount,receipt) {
  await db.query('INSERT INTO launcher_wallet_ledger(user_id,operation_id,job_id,amount,balance_after,receipt) VALUES($1,$2,$3,$4,$5,$6::jsonb)',[row.user_id,operationId,jobId,amount,row.stats.launcherWalletV1.coins,JSON.stringify(receipt)]);
}
async function settleJob(db,row,state,companions,job,room,now) {
  const operationId='life-work:'+job.jobId,existing=await ledger(db,row.user_id,operationId);
  if(existing){state.jobs=state.jobs.filter(j=>j.jobId!==job.jobId);return {receipt:existing,duplicate:true};}
  if(!L.validJobContext(job,jobState(state,room),room))return {error:'work_context_changed'};
  if(job.status==='reserved'||!job.activatedAt||Date.parse(job.readyAt)>now.getTime())return {error:'work_not_ready'};
  if(companions.claimsToday>=6)return {error:'work_daily_limit'};
  const wallet=row.stats.launcherWalletV1;if(wallet.coins>490)return {error:'wallet_full'};
  if(job.legacy) {
    const old=companions.characters[job.itemId]?.activeWork;
    if(!old||L.legacyJobId(job.itemId,old.startedAt)!==job.jobId)return {error:'work_already_settled'};
  }
  wallet.coins+=10;companions.claimsToday++;
  const actor=companions.characters[job.itemId];actor.affinity=Math.min(100,actor.affinity+1);actor.lastClaimAt=now.toISOString();
  if(job.legacy)actor.activeWork=null;
  const receipt={operationId,jobId:job.jobId,itemId:job.itemId,amount:10,claimedAt:now.toISOString()};
  await writeLedger(db,row,operationId,job.jobId,10,receipt);
  state.jobs=state.jobs.filter(j=>j.jobId!==job.jobId);
  L.addMemory(state,job.itemId,'work.completed',[job.itemId],now,2);
  return {receipt};
}
const FIELDS={
 'work.reserve':['itemId','stationId','roomRevision','stationType','furnitureId'],
 'work.activate':['jobId'],'work.complete':['jobId'],'work.cancel':['jobId'],
 'directive.set':['directiveId'],'character.interact':['itemId','action'],
 'minigame.start':['characterId','kind','practice','jobId'],
 'minigame.answer':['sessionId','token','roundId','selections','directions','ingredients','rotations','path','counterMoves'],
 'minigame.finish':['sessionId','token'],'minigame.cancel':['sessionId','token'],
 'minigame.retry':['sessionId','token'],
 'fish.place':['fishId','inAquarium'],
 'fish.release':['fishId'],
 'event.record':['eventId','participants'],'activity.record':['itemId','activity'],'arrival.ack':['arrivalId'],'checkpoint':['exit']
};
function validCommand(command) {
  if(!command||typeof command!=='object'||Array.isArray(command)||typeof command.type!=='string'||!Object.hasOwn(FIELDS,command.type))return false;
  if(typeof command.requestId!=='string'||! /^[a-zA-Z0-9_-]{8,100}$/.test(command.requestId)||!Number.isSafeInteger(command.expectedRevision)||command.expectedRevision<0)return false;
  if(!command.payload||typeof command.payload!=='object'||Array.isArray(command.payload))return false;
  return Object.keys(command.payload).every(k=>FIELDS[command.type].includes(k))&&JSON.stringify(command.payload).length<=2048;
}
async function performMinigame(db,row,state,companions,command,room,now,sessions) {
  const p=command.payload;
  if(command.type==='minigame.start') {
    if(!['work','training'].includes(p.kind)||p.practice!==undefined&&typeof p.practice!=='boolean'||p.kind==='work'&&p.practice||p.jobId!==undefined&&(p.kind!=='work'||!M.WORK_JOBS.includes(p.jobId)))return{ok:false,error:'invalid_minigame'};
    const actor=state.characters[p.characterId];
    if(!actor)return{ok:false,error:'not_owned'};
    if(!state.activeCharacterIds.includes(p.characterId))return{ok:false,error:'not_placed'};
    if(sessions.length)return{ok:false,error:'minigame_active',minigame:M.view(sessions[0])};
    if(state.jobs.some(job=>job.itemId===p.characterId))return{ok:false,error:'work_active'};
    const old=companions.characters[p.characterId],practice=p.practice===true;
    if(p.kind==='work') {
      if(p.jobId==='fishing'&&state.fishCollection.length>=L.MAX_FISH)return{ok:false,error:'fish_collection_full'};
      const reserved=state.jobs.filter(job=>job.status==='reserved').length;
      if(companions.workStartsToday+reserved>=6||companions.claimsToday+state.jobs.length>=6||old.worksStartedToday>=2)return{ok:false,error:'work_daily_limit'};
      if(row.stats.launcherWalletV1.coins>490)return{ok:false,error:'wallet_full'};
      if(actor.needs.energy<15||actor.needs.hunger>90)return{ok:false,error:'needs_rest'};
      companions.workStartsToday++;old.worksStartedToday++;
    } else if(!practice) {
      if(Date.parse(actor.lastInteractions.train||0)+600000>now.getTime())return{ok:false,error:'interaction_cooldown'};
      if(actor.needs.energy<20)return{ok:false,error:'needs_rest'};
      actor.needs.energy=L.clamp(actor.needs.energy-6);actor.lastInteractions.train=now.toISOString();
    }
    const session=M.create(p.kind,p.characterId,room.revision,now,practice,p.jobId||'supply');
    await M.save(db,row.user_id,session);
    return{ok:true,minigame:M.view(session)};
  }
  const session=await M.load(db,row.user_id,p);
  if(!session)return{ok:false,error:'invalid_minigame_session'};
  if(command.type==='minigame.cancel') {
    if(M.ACTIVE.has(session.state)){session.state='cancelled';session.challenge=null;await M.save(db,row.user_id,session);}
    return{ok:true,cancelled:session.state==='cancelled',minigame:M.view(session)};
  }
  if(session.state==='completed'&&command.type==='minigame.finish')return{ok:true,duplicate:true,minigame:M.view(session),...(session.receipt?{receipt:session.receipt}:{})};
  if(!M.ACTIVE.has(session.state))return{ok:false,error:'minigame_'+session.state,minigame:M.view(session)};
  if(command.type==='minigame.retry') {
    if(session.state!=='failed'||session.attempt>=session.maxAttempts)return{ok:false,error:'minigame_retry_unavailable',minigame:M.view(session)};
    M.retry(session,now);await M.save(db,row.user_id,session);return{ok:true,minigame:M.view(session)};
  }
  if(session.state==='failed'&&command.type==='minigame.finish')return{ok:true,duplicate:true,minigame:M.view(session)};
  if(command.type==='minigame.answer') {
    const result=M.answer(session,p,now);
    if(result.error)return{ok:false,...result,minigame:M.view(session)};
    await M.save(db,row.user_id,session);return{ok:true,minigame:M.view(session)};
  }
  if(session.roundIndex!==session.totalRounds)return{ok:false,error:'minigame_incomplete',minigame:M.view(session)};
  if(now.getTime()<Date.parse(session.finishNotBefore))return{ok:false,error:'minigame_too_early',minigame:M.view(session)};
  const passed=session.correctRounds>=(session.kind==='work'?(session.jobId==='fishing'?4:6):3),actor=state.characters[session.characterId],old=companions.characters[session.characterId];
  const canRetry=!passed&&session.attempt<session.maxAttempts;
  const result={passed,practice:session.practice,canRetry,attempt:session.attempt,attemptsRemaining:canRetry?session.maxAttempts-session.attempt:0,coins:0,affinity:0,workMotivation:0,energyCost:session.kind==='training'&&!session.practice?6:0,correctRounds:session.correctRounds,totalRounds:session.totalRounds};
  if(passed&&session.kind==='work') {
    if(companions.claimsToday>=6)return{ok:false,error:'work_daily_limit',minigame:M.view(session)};
    if(row.stats.launcherWalletV1.coins>490){session.state='ready';await M.save(db,row.user_id,session);return{ok:false,error:'wallet_full',minigame:M.view(session)};}
    const jobId='minigame-'+session.id,operationId='life-work:'+jobId,prior=await ledger(db,row.user_id,operationId);
    if(prior)return{ok:false,error:'minigame_receipt_conflict'};
    row.stats.launcherWalletV1.coins+=10;companions.claimsToday++;old.affinity=Math.min(100,old.affinity+1);old.lastClaimAt=now.toISOString();
    session.receipt={operationId,jobId,itemId:session.characterId,amount:10,claimedAt:now.toISOString()};
    await writeLedger(db,row,operationId,jobId,10,session.receipt);
    result.coins=10;result.affinity=1;
    if(session.jobId==='fishing'&&state.fishCollection.length<L.MAX_FISH) {
      const species=M.FISH_SPECIES.find(entry=>entry.id===session.catchSpeciesId);
      if(species){const caught={id:crypto.randomUUID(),speciesId:species.id,caughtAt:now.toISOString(),inAquarium:false};state.fishCollection.push(caught);result.catch={...caught,label:species.label};}
    }
    L.addMemory(state,session.characterId,'work.completed',[session.characterId],now,2);
  } else if(passed&&session.kind==='training'&&!session.practice) {
    actor.needs.workMotivation=L.clamp(actor.needs.workMotivation+5);old.affinity=Math.min(100,old.affinity+1);
    result.affinity=1;result.workMotivation=5;
    L.addMemory(state,session.characterId,'player.train',[session.characterId],now,2);
  }
  session.state=canRetry?'failed':'completed';session.result=result;session.challenge=null;
  await M.save(db,row.user_id,session);
  return{ok:true,minigame:M.view(session),...(session.receipt?{receipt:session.receipt}:{})};
}
async function perform(db,row,state,companions,command,room,now,sessions=[],jobsRoom=room) {
  const p=command.payload,content=L.content(),actor=state.characters[p.itemId];
  if(command.type.startsWith('minigame.'))return performMinigame(db,row,state,companions,command,room,now,sessions);
  if(command.type==='fish.place') {
    if(typeof p.fishId!=='string'||typeof p.inAquarium!=='boolean')return{ok:false,error:'invalid_fish'};
    const fish=state.fishCollection.find(entry=>entry.id===p.fishId);
    if(!fish)return{ok:false,error:'fish_not_owned'};
    const owned=shop().launcherOwnedItemIds(row.stats);
    if(p.inAquarium&&!owned.includes('room-scene-sunny-aquarium')&&!owned.includes('room-furniture-aquarium-tank'))return{ok:false,error:'fish_aquarium_locked'};
    if(p.inAquarium&&!fish.inAquarium&&state.fishCollection.filter(entry=>entry.inAquarium).length>=L.MAX_AQUARIUM_FISH)return{ok:false,error:'fish_aquarium_full'};
    fish.inAquarium=p.inAquarium;
    return{ok:true,fish:{...fish}};
  }
  if(command.type==='fish.release') {
    if(typeof p.fishId!=='string')return{ok:false,error:'invalid_fish'};
    const index=state.fishCollection.findIndex(entry=>entry.id===p.fishId);
    if(index<0)return{ok:false,error:'fish_not_owned'};
    const [fish]=state.fishCollection.splice(index,1);
    return{ok:true,releasedFish:{...fish}};
  }
  if(command.type.startsWith('work.')&&command.type!=='work.reserve') {
    if(typeof p.jobId!=='string'||p.jobId.length>100)return {ok:false,error:'invalid_job'};
    const existing=command.type==='work.complete'?await ledger(db,row.user_id,'life-work:'+p.jobId):null;
    if(existing)return {ok:true,receipt:existing,duplicate:true};
    const job=state.jobs.find(j=>j.jobId===p.jobId);if(!job)return {ok:false,error:'no_active_work'};
    if(!L.validJobContext(job,jobState(state,jobsRoom),jobsRoom))return {ok:false,error:'work_context_changed'};
    if(command.type==='work.cancel') {
      if(job.legacy)companions.characters[job.itemId].activeWork=null;
      state.jobs=state.jobs.filter(j=>j!==job);return {ok:true,cancelled:true};
    }
    if(command.type==='work.complete') {const result=await settleJob(db,row,state,companions,job,jobsRoom,now);return {ok:!result.error,...result};}
    if(job.status!=='reserved')return {ok:true,job};
    if(Date.parse(job.activateAfter)>now.getTime())return {ok:false,error:'arrival_too_early'};
    const old=companions.characters[job.itemId];
    if(companions.workStartsToday>=6||old.worksStartedToday>=2)return {ok:false,error:'work_daily_limit'};
    old.worksStartedToday++;companions.workStartsToday++;
    job.status='active';job.activatedAt=now.toISOString();job.readyAt=new Date(now.getTime()+job.durationMs).toISOString();delete job.expiresAt;
    return {ok:true,job};
  }
  if(command.type==='work.reserve') {
    if(!actor)return {ok:false,error:'not_owned'};
    if(!state.activeCharacterIds.includes(p.itemId))return {ok:false,error:'not_placed'};
    if(sessions.some(session=>session.characterId===p.itemId))return{ok:false,error:'minigame_active'};
    if(p.roomRevision!==room.revision)return {ok:false,error:'room_revision_conflict'};
    const station=L.stationFor(room,p.stationId);if(!station)return {ok:false,error:'invalid_station'};
    if(state.jobs.some(j=>j.itemId===p.itemId))return {ok:false,error:'work_active'};
    if(state.jobs.filter(j=>j.stationId===p.stationId).length>=station.capacity)return {ok:false,error:'station_busy'};
    const old=companions.characters[p.itemId],reserved=state.jobs.filter(j=>j.status==='reserved').length;
    if(companions.workStartsToday+reserved>=6||companions.claimsToday+state.jobs.length+sessions.filter(session=>session.kind==='work').length>=6||old.worksStartedToday>=2)return {ok:false,error:'work_daily_limit'};
    if(actor.needs.energy<15||actor.needs.hunger>90)return {ok:false,error:'needs_rest'};
    const efficiency=L.clamp(content.characters?.[actor.key]?.workEfficiency?.[station.type]??1,.35,1.5);
    const durationMs=Math.round(300000/efficiency),placement=room.characters.find(c=>c.itemId===p.itemId);
    const travelMs=Math.min(20000,Math.round(Math.hypot(placement.x-station.x,placement.y-station.y)/80*1000));
    const job={jobId:crypto.randomUUID(),itemId:p.itemId,stationId:p.stationId,stationType:station.type,stationFingerprint:L.stationFingerprint(station),status:'reserved',reservedAt:now.toISOString(),activatedAt:null,readyAt:null,activateAfter:new Date(now.getTime()+travelMs).toISOString(),expiresAt:new Date(now.getTime()+L.RESERVATION_MS).toISOString(),durationMs,reward:10,roomRevision:room.revision};
    state.jobs.push(job);return {ok:true,job};
  }
  if(command.type==='directive.set') {
    if(typeof p.directiveId!=='string'||!Object.hasOwn(content.directives||{},p.directiveId))return {ok:false,error:'invalid_directive'};
    state.directive=p.directiveId;return {ok:true};
  }
  if(command.type==='character.interact') {
    if(!actor)return {ok:false,error:'not_owned'};
    if(!state.activeCharacterIds.includes(p.itemId))return {ok:false,error:'not_placed'};
    if(p.action==='train'&&sessions.some(session=>session.characterId===p.itemId))return{ok:false,error:'minigame_active'};
    if(!['call','gift','train'].includes(p.action))return {ok:false,error:'invalid_action'};
    const cooldown=p.action==='call'?10000:p.action==='gift'?60000:600000;
    if(Date.parse(actor.lastInteractions[p.action]||0)+cooldown>now.getTime())return {ok:false,error:'interaction_cooldown'};
    if(p.action==='gift') {
      if(actor.giftDay!==L.day(now)){actor.giftDay=L.day(now);actor.giftsToday=0;}
      if(actor.giftsToday>=2)return {ok:false,error:'gift_daily_limit'};
      if(row.stats.launcherWalletV1.coins<5)return {ok:false,error:'insufficient_coins'};
      row.stats.launcherWalletV1.coins-=5;actor.giftsToday++;
      actor.needs.hunger=L.clamp(actor.needs.hunger-12);actor.needs.mood=L.clamp(actor.needs.mood+5);actor.needs.social=L.clamp(actor.needs.social+6);
      companions.characters[p.itemId].affinity=Math.min(100,companions.characters[p.itemId].affinity+1);
      const operationId='life-gift:'+command.requestId;
      await writeLedger(db,row,operationId,null,-5,{operationId,itemId:p.itemId,amount:-5,claimedAt:now.toISOString()});
    } else if(p.action==='train') {
      if(actor.needs.energy<20)return {ok:false,error:'needs_rest'};
      actor.needs.energy=L.clamp(actor.needs.energy-6);actor.needs.workMotivation=L.clamp(actor.needs.workMotivation+5);
    }
    actor.lastInteractions[p.action]=now.toISOString();L.addMemory(state,p.itemId,'player.'+p.action,[p.itemId],now,p.action==='call'?1:2);
    return {ok:true,interaction:{itemId:p.itemId,action:p.action,cost:p.action==='gift'?5:0}};
  }
  if(command.type==='activity.record') {
    if(!actor)return {ok:false,error:'not_owned'};
    if(!state.activeCharacterIds.includes(p.itemId))return {ok:false,error:'not_placed'};
    if(sessions.some(session=>session.characterId===p.itemId))return{ok:false,error:'minigame_active'};
    if(typeof p.activity!=='string'||!Object.hasOwn(ACTIVITY_EFFECTS,p.activity))return {ok:false,error:'invalid_activity'};
    if(state.jobs.some(j=>j.itemId===p.itemId))return {ok:false,error:'work_active'};
    if(now.getTime()-Date.parse(actor.createdAt)<8000||actor.lastActivityAt&&now.getTime()-Date.parse(actor.lastActivityAt)<30000)return {ok:false,error:'activity_cooldown'};
    actor.activityHistory=actor.activityHistory.filter(a=>now.getTime()-Date.parse(a.at)<3600000);
    if(actor.activityHistory.length>=12)return {ok:false,error:'activity_hourly_limit'};
    applyActivityNeeds(actor,p.activity);actor.lastActivityAt=now.toISOString();
    actor.activityHistory.push({activity:p.activity,at:now.toISOString()});
    L.addMemory(state,p.itemId,p.activity.toLowerCase(),[p.itemId],now,.35);
    return {ok:true,activity:{itemId:p.itemId,activity:p.activity,completedAt:now.toISOString()}};
  }
  if(command.type==='event.record') {
    const event=content.events?.find(e=>e.id===p.eventId),ids=p.participants;
    if(!event||!Array.isArray(ids)||ids.length<1||ids.length>10||new Set(ids).size!==ids.length)return {ok:false,error:'invalid_event'};
    const required=(event.requiredCharacters||[]).map(k=>'room-character-'+k),allowed=new Set([...required,...(event.optionalCharacters||[]).map(k=>'room-character-'+k)]);
    if(required.some(id=>!ids.includes(id))||ids.some(id=>!allowed.has(id)||!state.activeCharacterIds.includes(id)))return {ok:false,error:'invalid_participants'};
    if((event.requiredFurniture||[]).some(k=>!room.placements.some(f=>f.itemId==='room-furniture-'+k)))return {ok:false,error:'missing_furniture'};
    if(event.location?.type==='station'&&!room.placements.some(f=>L.stationFor(room,f.itemId)?.type===event.location.stationType)&&!content.stations?.[event.location.stationType]?.freeFloor)return {ok:false,error:'missing_station'};
    const cooldown=Math.max(180000,Number(event.cooldownMs)||600000),prior=state.recentEvents.findLast(e=>e.eventId===event.id);
    if(prior&&Date.parse(prior.at)+cooldown>now.getTime())return {ok:false,error:'event_cooldown'};
    if(state.recentEvents.filter(e=>now.getTime()-Date.parse(e.at)<3600000).length>=24)return {ok:false,error:'event_rate_limit'};
    state.recentEvents.push({eventId:event.id,participants:ids.slice(),at:now.toISOString()});state.recentEvents=state.recentEvents.slice(-32);
    for(const id of ids){
      L.addMemory(state,id,event.memory?.type||event.id,ids,now,event.memory?.strength??.5,event.memory?.ttlMs);state.characters[id].needs.social=L.clamp(state.characters[id].needs.social+2);
      const clip=event.requiredActions?.find(a=>a.actor===L.keyOf(id)&&['eat','rest','sleep','train'].includes(a.clip))?.clip;
      if(clip)applyActivityNeeds(state.characters[id],clip[0].toUpperCase()+clip.slice(1));
    }
    const delta=event.relationshipDelta||event.relationDelta||{};
    for(let a=0;a<ids.length;a++)for(let b=a+1;b<ids.length;b++) {
      const pair=state.pairs[L.pairKey(ids[a],ids[b])];if(pair)for(const key of ['familiarity','friendship','rivalry','respect'])pair[key]=L.clamp(pair[key]+L.clamp(delta[key]??(key==='familiarity'?.25:0),-2,2));
    }
    return {ok:true,eventId:event.id};
  }
  if(command.type==='arrival.ack') {
    if(typeof p.arrivalId!=='string')return {ok:false,error:'invalid_arrival'};
    const arrival=state.pendingArrivals.find(a=>a.arrivalId===p.arrivalId);
    if(arrival){state.pendingArrivals=state.pendingArrivals.filter(a=>a!==arrival);if(!state.arrivedCharacterIds.includes(arrival.itemId))state.arrivedCharacterIds.push(arrival.itemId);}
    return {ok:true,acknowledged:Boolean(arrival)};
  }
  if(command.type==='checkpoint') {
    if(p.exit!==undefined&&typeof p.exit!=='boolean')return {ok:false,error:'invalid_checkpoint'};
    if(p.exit)state.lastExitAt=now.toISOString();return {ok:true};
  }
  return {ok:false,error:'invalid_command'};
}
async function run(pool,secret,command,suppliedNow,capability) {
  let now=suppliedNow||new Date();
  if(!secret)return {ok:false,error:'bad secret',serverNow:now.toISOString()};
  await ensureLifeTables(pool);const db=await pool.connect();
  try {
    await db.query('BEGIN');
    const found=await db.query('SELECT user_id,name,avatar,stats,updated_at FROM player_profiles WHERE secret=$1 FOR UPDATE',[secret]),row=found.rows[0];
    // A queued request must use the server time at lock acquisition, including
    // the current UTC day for shared reward limits. Tests may inject a clock.
    if(!suppliedNow)now=new Date();
    if(!row){await db.query('ROLLBACK');return {ok:false,error:'bad secret',serverNow:now.toISOString()};}
    // LIFE_GET also aggregates and settles: guard its raw canonical content too.
    const event=command?.type==='event.record'?L.content().events?.find(e=>e.id===command.payload?.eventId):null;
    const jobReceipt=typeof command?.payload?.jobId==='string'
      ?await ledger(db,row.user_id,'life-work:'+command.payload.jobId):null;
    const replay=typeof command?.requestId==='string'
      ?await db.query('SELECT result FROM launcher_life_operations WHERE user_id=$1 AND request_id=$2',[row.user_id,command.requestId]):{rows:[]};
    const releaseError=await crewRelease.canonicalError(db,row,capability,[command,event,jobReceipt,replay.rows[0]?.result]);
    if(releaseError){await db.query('ROLLBACK');return crewRelease.failure(releaseError,capability);}
    row.stats=L.clone(L.object(row.stats));
    const S=shop(),room=S.launcherRoom(row.stats),jobsRoom=deployedRoom(row.stats),
      state=await loadState(db,row,now),companions=S.launcherCompanionState(row.stats,now);
    row.stats.launcherWalletV1=S.prepareLauncherWallet(row.stats,now).wallet;
    reconcileLegacy(state,companions,jobsRoom,now);
    const sessions=await M.active(db,row.user_id,now,state,room);
    const beforeRevision=state.revision,aggregation=L.aggregate(state,now);
    if(aggregation.offline)for(const job of [...state.jobs])if(job.status==='ready'){
      const settled=await settleJob(db,row,state,companions,job,jobsRoom,now);
      if(settled.receipt&&!settled.duplicate){state.offlineSummary.completedJobs++;state.offlineSummary.coins+=10;}
    }
    let extra={};
    if(command!==undefined) {
      if(!validCommand(command))extra={ok:false,error:'invalid_command'};
      else {
        const prior=await db.query('SELECT payload_hash,result FROM launcher_life_operations WHERE user_id=$1 AND request_id=$2',[row.user_id,command.requestId]),hash=L.commandHash(command);
        if(prior.rows[0])extra=prior.rows[0].payload_hash===hash?{...prior.rows[0].result,duplicate:true}:{ok:false,error:'request_id_conflict'};
        else if(command.expectedRevision!==beforeRevision)extra={ok:false,error:'revision_conflict'};
        else {
          extra=await perform(db,row,state,companions,command,room,now,sessions,jobsRoom);
          // Transient failures are retryable; successful effects are immutable.
          if(extra.ok)await db.query('INSERT INTO launcher_life_operations(user_id,request_id,payload_hash,result) VALUES($1,$2,$3,$4::jsonb)',[row.user_id,command.requestId,hash,JSON.stringify(extra)]);
        }
      }
    }
    row.stats.launcherCompanionsV1=companions;state.revision++;
    const updated=await db.query('UPDATE player_profiles SET stats=$1::jsonb,updated_at=now() WHERE user_id=$2 RETURNING user_id,name,avatar,stats,updated_at',[JSON.stringify(row.stats),row.user_id]);
    await saveState(db,row.user_id,state);
    const activeMinigame=M.view((await M.active(db,row.user_id,now,state,room))[0]||null);
    await db.query('COMMIT');
    return snapshot(updated.rows[0]||row,state,now,{activeMinigame,...extra});
  } catch(error){await db.query('ROLLBACK').catch(()=>{});throw error;}finally{db.release();}
}
async function registerPurchasedCharacter(db,row,itemId,now=new Date()) {
  const state=await loadState(db,row,now);
  state.arrivedCharacterIds=state.arrivedCharacterIds.filter(id=>id!==itemId);
  if(!state.pendingArrivals.some(a=>a.itemId===itemId))state.pendingArrivals.push({arrivalId:crypto.randomUUID(),itemId,createdAt:now.toISOString()});
  state.revision++;await saveState(db,row.user_id,state);return L.publicLife(state);
}
async function legacyWorkGuard(db,row,companions,itemId,action,now=new Date()) {
  const found=await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1 FOR UPDATE',[row.user_id]);
  const S=shop(),room=S.launcherRoom(row.stats),jobsRoom=deployedRoom(row.stats);
  const state=L.normalizeState(found.rows[0]?.state,S.launcherOwnedItemIds(row.stats),room.characters.map(c=>c.itemId),now);
  const jobs=state.jobs.filter(j=>!j.legacy&&['reserved','active','ready'].includes(j.status)&&
    (j.status!=='reserved'||Date.parse(j.expiresAt)>now.getTime())&&L.validJobContext(j,jobState(state,jobsRoom),jobsRoom));
  const sessions=await M.active(db,row.user_id,now,state,room);
  if(action==='start'&&sessions.some(session=>session.characterId===itemId))return 'minigame_active';
  if(action==='start'&&jobs.some(j=>j.itemId===itemId))return 'work_active';
  if(action==='start'&&(companions.claimsToday+Object.values(companions.characters).filter(c=>c.activeWork).length+jobs.length+sessions.filter(session=>session.kind==='work').length>=6||companions.workStartsToday+jobs.filter(j=>j.status==='reserved').length>=6))return 'work_daily_limit';
  return null;
}
async function recordLegacyClaim(db,row,itemId,startedAt,now) {
  const jobId=L.legacyJobId(itemId,startedAt),operationId='life-work:'+jobId;
  const receipt={operationId,jobId,itemId,amount:10,claimedAt:now.toISOString()};
  await writeLedger(db,row,operationId,jobId,10,receipt);
  const found=await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1 FOR UPDATE',[row.user_id]);
  if(found.rows[0]){const state=found.rows[0].state;state.jobs=(state.jobs||[]).filter(j=>j.jobId!==jobId);state.revision++;await saveState(db,row.user_id,state);}
}
async function publicProjection(pool,row) {
  await ensureLifeTables(pool);const found=await pool.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[row.user_id]);
  if(!found.rows[0])return null;
  const S=shop(),state=L.normalizeState(found.rows[0].state,S.launcherOwnedItemIds(row.stats),S.launcherRoom(row.stats).characters.map(c=>c.itemId),new Date());
  return {schemaVersion:1,revision:state.revision,ownedCharacterIds:state.ownedCharacterIds,activeCharacterIds:state.activeCharacterIds,directive:state.directive,characters:Object.fromEntries(Object.entries(state.characters).map(([id,c])=>[id,{itemId:id,key:c.key,needs:c.needs}])),fishCollection:state.fishCollection.filter(fish=>fish.inAquarium)};
}
module.exports={ensureLifeTables,getLauncherLife:async(pool,secret,now,capability)=>crewRelease.projectResponse(await run(pool,secret,undefined,now,capability),capability),commandLauncherLife:async(pool,secret,command,now,capability)=>crewRelease.projectResponse(await run(pool,secret,command,now,capability),capability),registerPurchasedCharacter,legacyWorkGuard,recordLegacyClaim,publicProjection};
