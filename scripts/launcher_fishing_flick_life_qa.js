'use strict';

const assert=require('node:assert/strict');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||
  'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const life=require('../server/launcher-life-store');
const db=new PGlite(),cap={crewContentRevision:1};
let queue=Promise.resolve(),serial=0,checks=0;
const pool={query:(...args)=>db.query(...args),async connect(){
  const previous=queue;let done;queue=new Promise(resolve=>done=resolve);
  await previous;return{query:(...args)=>db.query(...args),release:done};
}};
const base=Date.now(),at=seconds=>new Date(base+seconds*1000),actor='room-character-luffy';
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks++;}
async function command(type,payload,seconds){
  const state=await life.getLauncherLife(pool,'flick-player',at(seconds),cap);
  return life.commandLauncherLife(pool,'flick-player',{
    type,payload,requestId:`flick-life-${String(++serial).padStart(8,'0')}`,
    expectedRevision:state.life.revision},at(seconds),cap);
}
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  const stats={launcherWalletV1:{coins:100,lastGrantDay:at(0).toISOString().slice(0,10)},
    launcherOwnedV1:{items:[actor]},launcherRoomV1:{revision:1,sceneId:'room-scene-default',capacityVersion:2,
      placements:[],characters:[{itemId:actor,x:160,y:440}]}};
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$2,$3,$4::jsonb)',
    ['flick-player','8',null,JSON.stringify(stats)]);
  const invalid=await command('minigame.start',{
    kind:'fishing',characterId:actor,baitId:'worm',spotId:'shore',fishingVersion:4,flickMode:true},0);
  check('V4 cannot opt into flick mode',invalid.error,'invalid_minigame');
  const begun=await command('minigame.start',{
    kind:'fishing',characterId:actor,baitId:'lure',spotId:'shore',fishingVersion:5,flickMode:true},.1);
  check('flick opt-in starts through life command',begun.ok,true);
  let game=begun.minigame;
  check('opt-in survives public response',[game.flickMode,game.challenge.flickMode],[true,true]);
  const stored=await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id]);
  check('opt-in persists in JSONB',[stored.rows[0].session.flickMode,stored.rows[0].session.challenge.flickMode],[true,true]);
  const ref=()=>({sessionId:game.id,token:game.token,roundId:game.challenge.id});
  const cast=await command('minigame.answer',{
    ...ref(),counterMoves:['cast'],castPower:50,castZone:'mid'},.2);
  check('opt-in cast',cast.ok,true);game=cast.minigame;
  await db.query("UPDATE launcher_minigame_sessions SET session=jsonb_set(jsonb_set(session,'{catchSpeciesId}',to_jsonb($2::text)),'{challenge,motionSeed}',to_jsonb($3::integer)) WHERE session_id=$1",
    [game.id,'glistening-saury',48]);
  const biteSeconds=(Date.parse(game.challenge.biteAt)-base)/1000+.1;
  const hook=await command('minigame.answer',{...ref(),counterMoves:['hook']},biteSeconds);
  check('opt-in hook',hook.ok,true);game=hook.minigame;
  check('public response exposes direction before cue',game.challenge.flickTell?.direction,'up');
  check('hook does not open a flick window immediately',game.challenge.flickCue,null);
  const tell=game.challenge.flickTell;
  const early=await command('minigame.answer',{...ref(),counterMoves:['flick'],
    flickDirection:tell.direction,flickCueId:tell.id},biteSeconds+.1);
  check('telegraphed flick cannot be submitted before cue',early.error,'fishing_flick_stale');
  const held=await db.query('SELECT session FROM launcher_minigame_sessions WHERE session_id=$1',[game.id]);
  check('tell persists through a rejected early input',held.rows[0].session.challenge.flickTell?.id,tell.id);
  let clock=biteSeconds,cue=null;
  for(let i=0;i<35&&!cue&&game.challenge;i++){
    clock+=1;
    const sync=await command('minigame.answer',{...ref(),counterMoves:['sync']},clock);
    check('authoritative sync remains valid',sync.ok,true);game=sync.minigame;
    cue=game.challenge?.flickCue;
  }
  check('new cue survives persistence and public projection',Boolean(cue),true);
  check('cue keeps the telegraphed direction and id',[cue.direction,cue.id],
    [tell.direction,tell.id]);
  check('cue direction is a legal gesture',['left','right','up'].includes(cue.direction),true);
  check('server-private relief deadline is hidden',Object.hasOwn(game.challenge,'flickReliefUntil'),false);
  const answer=await command('minigame.answer',{
    ...ref(),counterMoves:['flick'],flickDirection:cue.direction,flickCueId:cue.id},clock+.05);
  check('flick accepted through persisted command',answer.ok,true);game=answer.minigame;
  check('hit feedback returns to renderer',game.challenge.flickFeedback.result,'hit');
  check('cue is consumed once',game.challenge.flickCue,null);
  const replay=await command('minigame.answer',{
    ...ref(),counterMoves:['flick'],flickDirection:cue.direction,flickCueId:cue.id},clock+.1);
  check('replayed flick rejected by persisted command',replay.error,'fishing_flick_replayed');
  console.log(JSON.stringify({status:'PASS',checks,cueDirection:cue.direction,cueId:cue.id},null,2));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
