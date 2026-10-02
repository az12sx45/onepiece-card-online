'use strict';

const assert=require('node:assert/strict');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life=require('../server/launcher-life-store');
const minigames=require('../server/launcher-minigames');
const db=new PGlite(),cap={crewContentRevision:1};
let queue=Promise.resolve(),serial=0,checks=0;
const pool={query:(...args)=>db.query(...args),async connect(){const previous=queue;let done;
  queue=new Promise(resolve=>done=resolve);await previous;return{query:(...args)=>db.query(...args),release:done};}};
const base=Date.now(),at=seconds=>new Date(base+seconds*1000),actor='room-character-luffy';
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks++;}
const ref=game=>({sessionId:game.id,token:game.token});
async function get(secret,t){return life.getLauncherLife(pool,secret,at(t),cap);}
async function command(secret,type,payload,t){const state=await get(secret,t);
  return life.commandLauncherLife(pool,secret,{type,payload,requestId:`v5-life-${String(++serial).padStart(8,'0')}`,
    expectedRevision:state.life.revision},at(t),cap);}
async function add(secret){const stats={launcherWalletV1:{coins:100,lastGrantDay:at(0).toISOString().slice(0,10)},
  launcherOwnedV1:{items:[actor]},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,
    placements:[],characters:[{itemId:actor,x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)',
    [secret,'8',JSON.stringify(stats)]);}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  await add('v5-player');await add('v4-player');
  const begun=await command('v5-player','minigame.start',
    {kind:'fishing',characterId:actor,baitId:'worm',spotId:'shore',fishingVersion:5},0);
  check('life-store accepts v5 fishing',begun.ok,true);
  let game=begun.minigame;
  check('v5 version round trips through JSONB',[game.fishingVersion,game.challenge.fishingVersion],[5,5]);
  check('v5 species is private before cast',Object.hasOwn(game,'catchSpeciesId'),false);
  check('v5 public challenge omits RNG seed',Object.hasOwn(game.challenge,'motionSeed'),false);
  const legacy=await command('v4-player','minigame.start',
    {kind:'fishing',characterId:actor,baitId:'shrimp',spotId:'reef',fishingVersion:4},0);
  check('life-store still accepts v4',legacy.ok,true);
  let old=legacy.minigame;
  const oldCast=await command('v4-player','minigame.answer',
    {...ref(old),roundId:old.challenge.id,counterMoves:['cast'],castZone:'mid'},.1);
  check('v4 in-progress round casts after v5 code lands',[oldCast.ok,oldCast.minigame.challenge.stage],[true,'wait']);
  old=oldCast.minigame;
  const cast=await command('v5-player','minigame.answer',
    {...ref(game),roundId:game.challenge.id,counterMoves:['cast'],castZone:'mid',castPower:50},.1);
  check('v5 cast persists',[cast.ok,cast.minigame.challenge.stage],[true,'wait']);game=cast.minigame;
  const forcedSpecies=process.env.BOARD_QA_FISH_SPECIES;
  if(forcedSpecies){
    check('forced QA fish is canonical',minigames.FISH_SPECIES.some(fish=>fish.id===forcedSpecies),true);
    // Test-only substitution of the server-private chosen catch after the
    // real cast; the public minigame path still runs through persisted JSONB.
    await db.query("UPDATE launcher_minigame_sessions SET session=jsonb_set(session,'{catchSpeciesId}',to_jsonb($2::text)) WHERE session_id=$1",
      [game.id,forcedSpecies]);
  }
  const selected=(await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id])).rows[0].session.catchSpeciesId;
  check('cast selected canonical fish',Boolean(selected),true);
  check('v5 species stays hidden while playing',Object.hasOwn(game,'catchSpeciesId'),false);
  let t=(Date.parse(game.challenge.biteAt)-base)/1000+.05;
  const hooked=await command('v5-player','minigame.answer',
    {...ref(game),roundId:game.challenge.id,counterMoves:['hook']},t);
  check('v5 hook starts fight',[hooked.ok,hooked.minigame.challenge.stage],[true,'fight']);game=hooked.minigame;
  check('v5 public force is a coarse display tier',
    [.12,.45,.7,.95].includes(game.challenge.pullIntensity),true);
  for(let step=0;step<200&&game.challenge;step++){
    const round=game.challenge;
    const safeSurgeReel=round.strength>65&&round.pullIntensity<.85;
    const control=round.runState==='surge'?{reeling:safeSurgeReel,
      steer:round.pullDirection==='left'?-1:1,paying:!safeSurgeReel}:
      {reeling:round.strength>=38,steer:0,paying:round.strength<38};
    t+=.35;
    const reply=await command('v5-player','minigame.answer',
      {...ref(game),roundId:round.id,counterMoves:['control'],...control},t);
    assert.equal(reply.ok,true,JSON.stringify(reply));game=reply.minigame;
  }
  check('server response reaches landed result',game.feedback.reason,'landed');
  check('single catch ends one-round session',game.roundIndex,1);
  const finished=await command('v5-player','minigame.finish',ref(game),t+.01);
  check('v5 finish passes',finished.minigame.result.passed,true);
  check('v5 finish adds exactly one saved fish',finished.life.fishCollection.length,1);
  check('saved fish is the originally drawn species',finished.life.fishCollection[0].speciesId,selected);
  check('v5 fishing awards no work coins',finished.wallet.coins,100);
  const duplicate=await command('v5-player','minigame.finish',ref(game),t+.02);
  check('duplicate finish is idempotent',duplicate.duplicate,true);
  check('duplicate finish does not duplicate catch',duplicate.life.fishCollection.length,1);
  const oldAfter=await get('v4-player',t+.03);
  check('v4 unfinished session remains versioned 4',
    [oldAfter.activeMinigame.fishingVersion,oldAfter.activeMinigame.challenge.fishingVersion],[4,4]);
  const oldBite=(Date.parse(old.challenge.biteAt)-base)/1000+.05;
  const oldHook=await command('v4-player','minigame.answer',
    {...ref(old),roundId:old.challenge.id,counterMoves:['hook']},Math.max(oldBite,t+.04));
  // A real clock never rewinds; this compatibility call may be after the
  // hook window, in which case the v4 miss is still the correct old behavior.
  check('v4 old session is still handled by v4 rules',
    oldHook.ok&&['fight','missed_bite'].includes(oldHook.minigame.challenge?.stage||oldHook.minigame.feedback?.reason),true);
  console.log(JSON.stringify({status:'PASS',checks,selectedSpecies:selected,completedAt:t.toFixed(2)},null,2));
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1;});
