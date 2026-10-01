'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life=require('../server/launcher-life-store');
const minigames=require('../server/launcher-minigames');
const species=minigames.FISH_SPECIES;
const db=new PGlite(),checks=[];
let queue=Promise.resolve(),serial=0;
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const cap={crewContentRevision:1},today=new Date().toISOString().slice(0,10),base=Date.parse(today+'T03:00:00.000Z');
const at=seconds=>new Date(base+seconds*1000),actor='room-character-luffy';
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected,name);checks.push({name,status:'PASS'});};
const ref=game=>({sessionId:game.id,token:game.token});
async function createUser(secret,owned=[]){
  const stats={client:{totals:{coins:73}},board:{saved:'preserve'},launcherWalletV1:{coins:100,lastGrantDay:today},launcherOwnedV1:{items:[actor,...owned]},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:[{itemId:actor,x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',[secret,'8',JSON.stringify(stats)]);
}
const get=(secret,t=0)=>life.getLauncherLife(pool,secret,at(t),cap);
async function command(secret,type,payload,t=0,requestId){
  const state=await get(secret,t);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId:requestId||'fishing-qa-'+String(++serial).padStart(8,'0'),expectedRevision:state.life.revision},at(t),cap);
}
const counter={left:'right',right:'left',deep:'slack'};
const sides=[0,1,2,3];
const openings=(tile,rotation)=>(tile.type==='straight'?[0,2]:[0,1]).map(side=>(side+rotation)%4);
function repairSolution(round){
  const rotations=round.tiles.map(tile=>tile.rotation),seen=new Set();
  function visit(index,entry){
    if(seen.has(index))return false;
    seen.add(index);
    for(let rotation=0;rotation<4;rotation++){
      const ports=openings(round.tiles[index],rotation);
      if(!ports.includes(entry))continue;
      const exit=ports.find(side=>side!==entry);
      if(index===round.exit.index&&exit===1){rotations[index]=rotation;return true;}
      const x=index%3,y=Math.floor(index/3),nx=x+[0,1,0,-1][exit],ny=y+[-1,0,1,0][exit];
      if(nx<0||nx>2||ny<0||ny>2)continue;
      if(visit(ny*3+nx,(exit+2)%4)){rotations[index]=rotation;return true;}
    }
    seen.delete(index);
    return false;
  }
  assert.equal(visit(round.entry.index,3),true,'generated repair board is solvable');
  return rotations;
}
function navigationSolution(round){
  const paths=[[round.start]],visited=new Set([round.start]);
  while(paths.length){
    const current=paths.shift(),last=current.at(-1);
    if(last===round.goal)return current;
    const x=last%4,y=Math.floor(last/4);
    for(const next of [x>0?last-1:-1,x<3?last+1:-1,y>0?last-4:-1,y<3?last+4:-1]){
      if(next<0||visited.has(next)||round.blocked.includes(next))continue;
      visited.add(next);paths.push([...current,next]);
    }
  }
  throw Error('generated navigation chart is unsolvable');
}
function solve(job,round){
  if(job==='supply')return{selections:round.crates.filter(crate=>crate.category===round.order.category).map(crate=>crate.id)};
  if(job==='cooking')return{ingredients:round.recipe};
  if(job==='repair')return{rotations:repairSolution(round)};
  if(job==='navigation')return{path:navigationSolution(round)};
  return{counterMoves:round.pulls.map(pull=>counter[pull])};
}
async function play(secret,job){
  let time=0,response=await command(secret,'minigame.start',{kind:'work',characterId:actor,jobId:job});
  assert.equal(response.ok,true,JSON.stringify(response));
  let game=response.minigame;
  check(`${job}: secret catch hidden before finish`,Object.hasOwn(game,'catchSpeciesId'),false);
  while(game.challenge){
    const round=game.challenge;
    time=Math.max(time,(Date.parse(round.notBefore)-base)/1000);
    response=await command(secret,'minigame.answer',{...ref(game),roundId:round.id,...solve(job,round)},time);
    assert.equal(response.ok,true,JSON.stringify(response));
    game=response.minigame;
  }
  time=Math.max(time,(Date.parse(game.finishNotBefore)-base)/1000);
  response=await command(secret,'minigame.finish',ref(game),time);
  assert.equal(response.ok,true,JSON.stringify(response));
  check(`${job}: all rounds correct`,response.minigame.result.correctRounds,job==='fishing'?5:8);
  check(`${job}: server awards 10 coins`,response.wallet.coins,110);
  return{response,time};
}
const seconds=stamp=>(Date.parse(stamp)-base)/1000;
async function startFishingV2(secret,t=0){
  const response=await command(secret,'minigame.start',{kind:'work',characterId:actor,jobId:'fishing',fishingVersion:2},t);
  assert.equal(response.ok,true,JSON.stringify(response));
  check(`${secret}: v2 opts in without changing saved v1 sessions`,response.minigame.fishingVersion,2);
  check(`${secret}: v2 has three casts`,response.minigame.totalRounds,3);
  check(`${secret}: catch stays server private`,Object.hasOwn(response.minigame,'catchSpeciesId'),false);
  return response.minigame;
}
async function fishAction(secret,game,move,t,extra={}){
  const response=await command(secret,'minigame.answer',{...ref(game),roundId:game.challenge.id,counterMoves:[move],...extra},t);
  assert.equal(response.ok,true,JSON.stringify({move,t,response}));
  return response.minigame;
}
async function landFishingRound(secret,game,t,assertSlack=false){
  const index=game.roundIndex;
  game=await fishAction(secret,game,'cast',t);
  check(`${secret} round ${index+1}: cast shows a future bite`,seconds(game.challenge.biteAt)>t,true);
  check(`${secret} round ${index+1}: cast enters bobber wait`,game.challenge.stage,'wait');
  t=seconds(game.challenge.biteAt)+0.05;
  game=await fishAction(secret,game,'hook',t);
  check(`${secret} round ${index+1}: timely hook starts fight`,game.challenge.stage,'fight');
  check(`${secret} round ${index+1}: private pull pattern stays hidden`,Object.hasOwn(game.challenge,'fightPattern'),false);
  if(assertSlack){
    const early=await command(secret,'minigame.answer',{...ref(game),roundId:game.challenge.id,counterMoves:['reel']},t+0.1);
    check('fishing v2: server rejects action spam inside cooldown',early.error,'fishing_action_cooldown');
    t+=0.31;game=await fishAction(secret,game,'reel',t);
    check('fishing v2: reel shortens line distance',game.challenge.distance<100,true);
    const tension=game.challenge.tension,distance=game.challenge.distance;
    t+=0.31;game=await fishAction(secret,game,'slack',t);
    check('fishing v2: slack lowers tension',game.challenge.tension<tension,true);
    check('fishing v2: slack gives fish distance',game.challenge.distance>distance,true);
  }
  for(let step=0;step<40&&game.roundIndex===index;step++){
    const round=game.challenge;
    const move=round.tension>55||round.pull==='surge'&&round.tension>34?'slack':'reel';
    t+=0.31;game=await fishAction(secret,game,move,t);
  }
  check(`${secret} round ${index+1}: fish landed without inspecting private pattern`,game.feedback.reason,'landed');
  check(`${secret} round ${index+1}: completed one catch`,game.roundIndex,index+1);
  return{game,t};
}
async function fishingV2Checks(){
  await createUser('v2-missed');
  let game=await startFishingV2('v2-missed');
  game=await fishAction('v2-missed',game,'cast',0.1);
  const first=game.challenge;
  game=await fishAction('v2-missed',game,'hook',0.2);
  check('fishing v2: premature hook fails the cast',game.feedback.reason,'early_hook');
  check('fishing v2: premature hook does not score',game.score,0);
  check('fishing v2: premature hook advances exactly one round',game.roundIndex,1);
  game=await fishAction('v2-missed',game,'cast',1);
  const tooSoon=await command('v2-missed','minigame.answer',{...ref(game),roundId:game.challenge.id,counterMoves:['timeout']},1.1);
  check('fishing v2: timeout cannot skip a waiting float',tooSoon.error,'invalid_fishing_action');
  game=await fishAction('v2-missed',game,'timeout',seconds(game.challenge.hookUntil)+0.02);
  check('fishing v2: missed bite advances as failure',game.feedback.reason,'missed_bite');
  check('fishing v2: two missed bites still have zero score',game.score,0);
  check('fishing v2: original missed hook window was after bite',seconds(first.hookUntil)>seconds(first.biteAt),true);

  await createUser('v2-snap');
  game=await startFishingV2('v2-snap');
  game=await fishAction('v2-snap',game,'cast',0.1);
  let t=seconds(game.challenge.biteAt)+0.05;
  game=await fishAction('v2-snap',game,'hook',t);
  // A controlled server-private current makes this branch deterministic while
  // keeping the entire fight pattern out of the public challenge response.
  const stored=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id])).rows[0].session;
  stored.challenge.fightPattern=Array(24).fill('surge');stored.challenge.pull='surge';
  await db.query('UPDATE launcher_minigame_sessions SET session=$1::jsonb WHERE session_id=$2',[JSON.stringify(stored),game.id]);
  for(let move=0;move<4;move++){t+=0.31;game=await fishAction('v2-snap',game,'reel',t);}
  check('fishing v2: excess tension snaps line',game.feedback.reason,'line_snapped');
  check('fishing v2: line snap awards no round',game.correctRounds,0);

  await createUser('v2-catch');
  game=await startFishingV2('v2-catch');t=0.1;
  ({game,t}=await landFishingRound('v2-catch',game,t,true));
  ({game,t}=await landFishingRound('v2-catch',game,t+0.1));
  check('fishing v2: two landed rounds pass threshold',game.correctRounds,2);
  game=await fishAction('v2-catch',game,'cast',t+0.1);
  game=await fishAction('v2-catch',game,'hook',t+0.2);
  check('fishing v2: last missed cast still completes three rounds',game.roundIndex,3);
  check('fishing v2: final feedback records miss',game.feedback.reason,'early_hook');
  t=Math.max(t+0.3,seconds(game.finishNotBefore)+0.05);
  const finished=await command('v2-catch','minigame.finish',ref(game),t);
  assert.equal(finished.ok,true,JSON.stringify(finished));
  check('fishing v2: two out of three is a pass',finished.minigame.result.passed,true);
  check('fishing v2: final score reports two landed fish',finished.minigame.result.correctRounds,2);
  check('fishing v2: pass adds one canonical collection fish',species.some(entry=>entry.id===finished.minigame.result.catch?.speciesId),true);
  check('fishing v2: pass awards wallet coins once',finished.wallet.coins,110);
  check('fishing v2: duplicate finish does not duplicate catch',(await command('v2-catch','minigame.finish',ref(game),t+1)).life.fishCollection.length,1);
}
async function fishingV3Checks(){
  await createUser('v3-catch');
  await get('v3-catch');
  const beforeStats=(await db.query('SELECT stats FROM player_profiles WHERE secret=$1',['v3-catch'])).rows[0].stats;
  const beforeWorkStarts=beforeStats.launcherCompanionsV1.workStartsToday;
  const beforeActorStarts=beforeStats.launcherCompanionsV1.characters[actor].worksStartedToday;
  for(const payload of [
    {kind:'fishing',characterId:actor,baitId:'worm'},
    {kind:'fishing',characterId:actor,spotId:'shore'},
    {kind:'fishing',characterId:actor,baitId:'bogus',spotId:'shore'},
    {kind:'fishing',characterId:actor,baitId:'worm',spotId:'bogus'},
    {kind:'work',characterId:actor,jobId:'fishing',baitId:'worm',spotId:'shore'}
  ])check('fishing v3: invalid bait or spot is rejected',
    (await command('v3-catch','minigame.start',payload)).error,'invalid_minigame');
  const difficulty={'butterflyfish':0,'adventure-fish':1,'glistening-saury':1,
    'smile-jellyfish':1,'cola-sunfish':2,'panda-shark':2,'reef-shark':3,'elephant-tuna':3};
  const meanDifficulty=pool=>pool.reduce((sum,[id,weight])=>sum+difficulty[id]*weight,0)/
    pool.reduce((sum,[,weight])=>sum+weight,0);
  for(const spotId of minigames.FISHING_SPOTS)for(const baitId of minigames.FISHING_BAITS){
    const near=minigames.fishingPoolFor(spotId,baitId,'near');
    const far=minigames.fishingPoolFor(spotId,baitId,'far');
    check(`fishing v3: ${spotId}/${baitId} near and far have different species`,
      near.some(([id])=>!far.some(([farId])=>farId===id))&&far.some(([id])=>!near.some(([nearId])=>nearId===id)),true);
    check(`fishing v3: ${spotId}/${baitId} far cast favours stronger fish`,
      meanDifficulty(far)>meanDifficulty(near),true);
    for(const castZone of Object.keys(minigames.FISHING_CAST_ZONES)){
      const pool=minigames.fishingPoolFor(spotId,baitId,castZone);
      check(`fishing v3: ${spotId}/${baitId}/${castZone} has canonical catch choices`,
        pool.length>=2&&pool.every(([id,weight])=>species.some(entry=>entry.id===id)&&weight>0),true);
      const drawn=minigames.create('fishing',actor,1,at(0),false,'supply',1,baitId,spotId);
      check(`fishing v3: ${spotId}/${baitId}/${castZone} does not predraw a fish`,
        Object.hasOwn(drawn,'catchSpeciesId'),false);
      const cast=minigames.answer(drawn,{roundId:drawn.challenge.id,counterMoves:['cast'],castZone},at(.1));
      check(`fishing v3: ${spotId}/${baitId}/${castZone} cast is accepted`,cast.error,undefined);
      check(`fishing v3: ${spotId}/${baitId}/${castZone} draw stays in chosen pool`,
        pool.some(([id])=>id===drawn.catchSpeciesId),true);
      check(`fishing v3: ${spotId}/${baitId}/${castZone} has guaranteed reel openings`,
        drawn.challenge.fightPattern.filter(pull=>pull==='steady').length>=10,true);
      check(`fishing v3: ${spotId}/${baitId}/${castZone} has guaranteed countersteer openings`,
        drawn.challenge.fightPattern.filter(pull=>pull==='left'||pull==='right').length>=8,true);
    }
  }
  let t=0;
  for(const [index,{baitId,spotId}] of [
    {baitId:'worm',spotId:'shore'},
    {baitId:'shrimp',spotId:'reef'},
    {baitId:'lure',spotId:'deep'}
  ].entries()){
    const started=await command('v3-catch','minigame.start',{kind:'fishing',characterId:actor,baitId,spotId},t);
    assert.equal(started.ok,true,JSON.stringify(started));
    let game=started.minigame;
    check('fishing v3: separate mode has no work job',game.kind==='fishing'&&game.jobId===undefined,true);
    check('fishing v3: selected bait and spot persist in public session',[game.baitId,game.spotId],[baitId,spotId]);
    check('fishing v3: one cast is one fish opportunity',game.totalRounds,1);
    check('fishing v3: no legacy 24-second finish gate',game.finishNotBefore,game.startedAt);
    check('fishing v3: species remains private before landing',Object.hasOwn(game,'catchSpeciesId'),false);
    check('fishing v3: no fish exists before casting',
      Object.hasOwn((await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id])).rows[0].session,'catchSpeciesId'),false);
    const castZone=['near','mid','far'][index];
    t+=0.1;
    check('fishing v3: cast without a target is rejected',
      (await command('v3-catch','minigame.answer',{...ref(game),roundId:game.challenge.id,counterMoves:['cast']},t)).error,
      'invalid_fishing_cast_zone');
    check('fishing v3: invented target is rejected',
      (await command('v3-catch','minigame.answer',{...ref(game),roundId:game.challenge.id,counterMoves:['cast'],castZone:'ocean-floor'},t)).error,
      'invalid_fishing_cast_zone');
    game=await fishAction('v3-catch',game,'cast',t,{castZone});
    check('fishing v3: cast begins the bobber wait',game.challenge.stage,'wait');
    check('fishing v3: cast target survives in public challenge',
      [game.castZone,game.challenge.castZone,game.challenge.castTarget],
      [castZone,castZone,minigames.FISHING_CAST_ZONES[castZone]]);
    check('fishing v3: selected species remains hidden after cast',Object.hasOwn(game,'catchSpeciesId'),false);
    const storedCatch=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id])).rows[0].session.catchSpeciesId;
    check('fishing v3: reroll by second cast is rejected',
      (await command('v3-catch','minigame.answer',{...ref(game),roundId:game.challenge.id,counterMoves:['cast'],castZone:'far'},t+.01)).error,
      'invalid_fishing_action');
    check('fishing v3: rejected second cast keeps selected fish',
      (await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id])).rows[0].session.catchSpeciesId,storedCatch);
    t=seconds(game.challenge.biteAt)+0.05;game=await fishAction('v3-catch',game,'hook',t);
    check('fishing v3: timely hook enters fight',game.challenge.stage,'fight');
    check('fishing v3: future fish pattern is private',Object.hasOwn(game.challenge,'fightPattern'),false);
    for(let step=0;step<65&&game.challenge;step++){
      const round=game.challenge,direction=round.pullDirection;
      const move=round.tension>55?'slack':direction==='left'?'steerRight':
        direction==='right'?'steerLeft':direction==='deep'?'slack':'reel';
      const oldTension=round.tension,oldDistance=round.distance;
      t+=0.31;game=await fishAction('v3-catch',game,move,t);
      if(game.challenge&&['steerLeft','steerRight'].includes(move)){
        check('fishing v3: correct countersteer relieves tension',game.challenge.tension<=oldTension,true);
        check('fishing v3: correct countersteer closes distance',game.challenge.distance<oldDistance,true);
      }
    }
    check('fishing v3: fish landed after one cast',game.feedback.reason,'landed');
    check('fishing v3: one cast completes the session',game.roundIndex,1);
    const finished=await command('v3-catch','minigame.finish',ref(game),t+0.01);
    assert.equal(finished.ok,true,JSON.stringify(finished));
    check('fishing v3: one landed fish is a pass',finished.minigame.result.passed,true);
    check('fishing v3: catch comes from chosen spot, bait and cast distance',
      minigames.fishingPoolFor(spotId,baitId,castZone).some(([id])=>id===finished.minigame.result.catch.speciesId),true);
    check('fishing v3: every landed cast adds one fish',finished.life.fishCollection.length,index+1);
    check('fishing v3: fishing awards no work coins',finished.wallet.coins,100);
    const duplicate=await command('v3-catch','minigame.finish',ref(game),t+0.02);
    check('fishing v3: duplicate finish cannot add another catch',duplicate.life.fishCollection.length,index+1);
    t+=0.1;
  }
  const afterStats=(await db.query('SELECT stats FROM player_profiles WHERE secret=$1',['v3-catch'])).rows[0].stats;
  check('fishing v3: fishing does not count as work',afterStats.launcherCompanionsV1.workStartsToday,beforeWorkStarts);
  check('fishing v3: character work counter unchanged',afterStats.launcherCompanionsV1.characters[actor].worksStartedToday,beforeActorStarts);
  check('fishing v3: fishing creates no wallet ledger rows',
    Number((await db.query('SELECT count(*) AS count FROM launcher_wallet_ledger WHERE user_id=(SELECT user_id FROM player_profiles WHERE secret=$1)',['v3-catch'])).rows[0].count),0);
  const ownerId=(await db.query('SELECT user_id FROM player_profiles WHERE secret=$1',['v3-catch'])).rows[0].user_id;
  const fullState=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[ownerId])).rows[0].state;
  fullState.fishCollection=Array.from({length:64},(_,index)=>({id:crypto.randomUUID(),
    speciesId:species[index%species.length].id,caughtAt:at(t+index).toISOString(),inAquarium:index<6}));
  const protectedIds=fullState.fishCollection.map(fish=>fish.id);
  await db.query('UPDATE launcher_life_state SET state=$1::jsonb WHERE user_id=$2',[JSON.stringify(fullState),ownerId]);
  t+=0.1;
  const fullStart=await command('v3-catch','minigame.start',{kind:'fishing',characterId:actor,baitId:'lure',spotId:'deep'},t);
  check('fishing v3: full collection does not block casting',fullStart.ok,true);
  let fullGame=fullStart.minigame;
  t+=0.1;fullGame=await fishAction('v3-catch',fullGame,'cast',t,{castZone:'far'});
  t=seconds(fullGame.challenge.biteAt)+0.05;fullGame=await fishAction('v3-catch',fullGame,'hook',t);
  for(let step=0;step<65&&fullGame.challenge;step++){
    const direction=fullGame.challenge.pullDirection;
    const move=fullGame.challenge.tension>55?'slack':direction==='left'?'steerRight':
      direction==='right'?'steerLeft':direction==='deep'?'slack':'reel';
    t+=0.31;fullGame=await fishAction('v3-catch',fullGame,move,t);
  }
  check('fishing v3: full collection still allows landing',fullGame.feedback.reason,'landed');
  const fullResult=await command('v3-catch','minigame.finish',ref(fullGame),t+0.01);
  check('fishing v3: full collection is explicitly reported',fullResult.minigame.result.catchCollectionFull,true);
  check('fishing v3: full collection does not claim a saved catch',Object.hasOwn(fullResult.minigame.result,'catch'),false);
  check('fishing v3: full collection never deletes an existing fish',fullResult.life.fishCollection.map(fish=>fish.id),protectedIds);
  await createUser('v3-miss');
  let miss=(await command('v3-miss','minigame.start',{kind:'fishing',characterId:actor,baitId:'worm',spotId:'shore'})).minigame;
  miss=await fishAction('v3-miss',miss,'cast',0.1,{castZone:'near'});
  miss=await fishAction('v3-miss',miss,'hook',0.2);
  check('fishing v3: early hook ends only this cast',miss.feedback.reason,'early_hook');
  const failed=await command('v3-miss','minigame.finish',ref(miss),0.21);
  check('fishing v3: miss has no catch',failed.life.fishCollection.length,0);
  check('fishing v3: miss has no coin reward',failed.wallet.coins,100);
  const again=await command('v3-miss','minigame.start',{kind:'fishing',characterId:actor,baitId:'shrimp',spotId:'reef'},0.3);
  check('fishing v3: new attempt available immediately after a miss',again.ok,true);
  await createUser('v3-steer');
  let steer=(await command('v3-steer','minigame.start',{kind:'fishing',characterId:actor,baitId:'lure',spotId:'deep'})).minigame;
  steer=await fishAction('v3-steer',steer,'cast',0.1,{castZone:'mid'});
  let turn=seconds(steer.challenge.biteAt)+0.05;
  steer=await fishAction('v3-steer',steer,'hook',turn);
  const stored=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[steer.id])).rows[0].session;
  stored.challenge.fightPattern=['left','left','steady'];stored.challenge.pullDirection='left';stored.challenge.pull='surge';
  await db.query('UPDATE launcher_minigame_sessions SET session=$1::jsonb WHERE session_id=$2',[JSON.stringify(stored),steer.id]);
  const beforeWrong=stored.challenge.tension,beforeDistance=stored.challenge.distance;
  turn+=0.31;steer=await fishAction('v3-steer',steer,'steerLeft',turn);
  check('fishing v3: steering with fish increases tension',steer.challenge.tension>beforeWrong,true);
  check('fishing v3: wrong steering lets fish run farther',steer.challenge.distance>beforeDistance,true);
  const afterWrong=steer.challenge.tension,afterDistance=steer.challenge.distance;
  turn+=0.31;steer=await fishAction('v3-steer',steer,'steerRight',turn);
  check('fishing v3: countersteering reduces tension',steer.challenge.tension<afterWrong,true);
  check('fishing v3: countersteering recovers distance',steer.challenge.distance<afterDistance,true);
}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  for(const job of ['supply','cooking','repair','navigation','fishing']){
    await createUser(job);
    const {response,time}=await play(job,job);
    if(job!=='fishing')continue;
    const fish=response.minigame.result.catch;
    check('fishing: one canonical fish awarded',species.some(entry=>entry.id===fish.speciesId),true);
    check('fishing: collection persisted',(await get(job,time)).life.fishCollection.length,1);
    check('fishing: fish starts outside tank',fish.inAquarium,false);
    check('fishing: duplicate finish cannot mint fish',(await command(job,'minigame.finish',ref(response.minigame),time+1)).life.fishCollection.length,1);
    check('fishing: unknown fish cannot be displayed',(await command(job,'fish.place',{fishId:crypto.randomUUID(),inAquarium:true},time+1)).error,'fish_not_owned');
    check('fishing: display needs owned scene or tank',(await command(job,'fish.place',{fishId:fish.id,inAquarium:true},time+1)).error,'fish_aquarium_locked');
    await createUser('visitor',['room-furniture-aquarium-tank']);
    check('fishing: friend cannot move someone else fish',(await command('visitor','fish.place',{fishId:fish.id,inAquarium:true},time+1)).error,'fish_not_owned');
    const ownerRow=(await db.query('SELECT * FROM player_profiles WHERE secret=$1',['fishing'])).rows[0];
    ownerRow.stats.launcherOwnedV1.items.push('room-furniture-aquarium-tank');
    await db.query('UPDATE player_profiles SET stats=$1::jsonb WHERE secret=$2',[JSON.stringify(ownerRow.stats),'fishing']);
    check('fishing: owned tank allows placement',(await command(job,'fish.place',{fishId:fish.id,inAquarium:true},time+1)).fish.inAquarium,true);
    const projection=await life.publicProjection(pool,(await db.query('SELECT * FROM player_profiles WHERE secret=$1',['fishing'])).rows[0]);
    check('fishing: friend sees displayed fish',projection.fishCollection.map(entry=>entry.id),[fish.id]);
    check('fishing: retrieve keeps collection',(await command(job,'fish.place',{fishId:fish.id,inAquarium:false},time+1)).life.fishCollection.length,1);
    const hidden=await life.publicProjection(pool,(await db.query('SELECT * FROM player_profiles WHERE secret=$1',['fishing'])).rows[0]);
    check('fishing: friend does not see stored fish',hidden.fishCollection.length,0);
    check('fishing: re-display after retrieve',(await command(job,'fish.place',{fishId:fish.id,inAquarium:true},time+1)).fish.inAquarium,true);
    const stateRow=(await db.query('SELECT state FROM launcher_life_state WHERE user_id=$1',[ownerRow.user_id])).rows[0];
    stateRow.state.fishCollection=Array.from({length:64},(_,index)=>({id:index===0?fish.id:crypto.randomUUID(),speciesId:species[index%species.length].id,caughtAt:at(time+1).toISOString(),inAquarium:index<6}));
    await db.query('UPDATE launcher_life_state SET state=$1::jsonb WHERE user_id=$2',[JSON.stringify(stateRow.state),ownerRow.user_id]);
    const fullCollectionStart=await command(job,'minigame.start',{kind:'work',characterId:actor,jobId:'fishing'},time+2);
    check('fishing: full collection does not block another session',fullCollectionStart.ok,true);
    check('fishing: full collection keeps original version by default',fullCollectionStart.minigame.fishingVersion,1);
    check('fishing: full collection session can be cancelled',(await command(job,'minigame.cancel',ref(fullCollectionStart.minigame),time+2)).cancelled,true);
    check('fishing: seventh tank fish rejected',(await command(job,'fish.place',{fishId:stateRow.state.fishCollection[6].id,inAquarium:true},time+2)).error,'fish_aquarium_full');
    check('fishing: release removes selected catch',(await command(job,'fish.release',{fishId:stateRow.state.fishCollection[7].id},time+2)).life.fishCollection.length,63);
    check('fishing: invalid release cannot duplicate',(await command(job,'fish.release',{fishId:stateRow.state.fishCollection[7].id},time+2)).error,'fish_not_owned');
    check('fishing: wallet unchanged by collection actions',(await get(job,time+2)).wallet.coins,110);
    check('fishing: existing board save retained',(await db.query('SELECT stats FROM player_profiles WHERE secret=$1',['fishing'])).rows[0].stats.board,{saved:'preserve'});
  }
  await createUser('late-fishing');
  const lateStart=await command('late-fishing','minigame.start',{kind:'work',characterId:actor,jobId:'fishing'});
  assert.equal(lateStart.ok,true,JSON.stringify(lateStart));
  const lateGame=lateStart.minigame,lateRound=lateGame.challenge;
  const lateAt=(Date.parse(lateRound.notBefore)-base)/1000+lateRound.answerWindowMs/1000+3.1;
  const lateAnswer=await command('late-fishing','minigame.answer',{
    ...ref(lateGame),roundId:lateRound.id,...solve('fishing',lateRound)
  },lateAt);
  assert.equal(lateAnswer.ok,true,JSON.stringify(lateAnswer));
  check('fishing: server rejects correct answer after round deadline',lateAnswer.minigame.feedback.correct,false);
  check('fishing: late answer does not increase score',lateAnswer.minigame.score,0);
  await fishingV2Checks();
  await fishingV3Checks();
  const files=['server/launcher-life.js','server/launcher-life-store.js','server/launcher-minigames.js','scripts/launcher_fishing_server_qa.js'];
  const report={schemaVersion:1,status:'PASS',checks:checks.length,results:checks,sourceHashes:Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'..',file))).digest('hex')])),limitations:['In-memory PGlite service test with serialized transactions. Does not prove production PostgreSQL timing or human play.'],createdAt:new Date().toISOString()};
  if(process.argv[2]){fs.mkdirSync(path.dirname(path.resolve(process.argv[2])),{recursive:true});fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({status:'PASS',checks:checks.length,output:process.argv[2]||null}));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
