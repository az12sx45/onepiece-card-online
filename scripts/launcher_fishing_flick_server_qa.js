'use strict';

const assert=require('node:assert/strict');
const v5=require('../server/launcher-fishing-v5');
const minigames=require('../server/launcher-minigames');
const date=milliseconds=>new Date(milliseconds);
let checks=0;
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks++;}

function makeRound(seed,speciesId='glistening-saury',flickMode=true){
  const round=v5.create('flick-test',0,0,flickMode);round.motionSeed=seed;
  v5.cast(round,date(100),'lure','mid',{x:.66,y:.45});
  v5.hook(round,date(4000),1,speciesId);
  return round;
}
function firstCue(seed,speciesId='glistening-saury'){
  const round=makeRound(seed,speciesId);
  for(let at=4000;at<38000;at+=100){
    if(round.flickCue)return{round,at};
    const result=v5.simulate(round,date(at+100),1);
    if(result)break;
  }
  return null;
}
function responsive(round){
  const reeling=round.runState==='surge'?
    round.strength>65&&v5.displayIntensity(round.pullIntensity,round.runState)<.85:
    round.strength>=38;
  return{reeling,steer:round.pullDirection==='left'?-1:round.pullDirection==='right'?1:0};
}
function fightWithFlicks(seed,speciesId,skill){
  const round=makeRound(seed,speciesId);let at=4000,result=null,flicks=0;
  for(;at<93000&&!result;at+=350){
    result=v5.simulate(round,date(at+350),skill);
    if(result)break;
    if(round.flickCue){
      const outcome=v5.flick(round,date(at+350),round.flickCue.direction,round.flickCue.id);
      check('valid cue resolves once',outcome.error,undefined);
      flicks++;
      if(outcome.settlement){result=outcome.settlement;break;}
    }
    const input=responsive(round);
    v5.control(round,date(at+350),input.reeling,input.steer);
  }
  return{result,flicks};
}

function main(){
  const legacy=makeRound(71,'glistening-saury',false);
  check('old V5 round has no flick opt-in',legacy.flickMode,undefined);
  for(let at=4100;at<24000;at+=100){
    if(v5.simulate(legacy,date(at),1))break;
    check('old V5 never receives a flick cue',legacy.flickCue,undefined);
  }
  const directions={};
  for(let seed=1;seed<=120;seed++){
    const found=firstCue(seed);
    if(found&&!directions[found.round.flickCue.direction])directions[found.round.flickCue.direction]={seed,...found};
    if(Object.keys(directions).length===3)break;
  }
  check('left/right/up cues are all reachable',Object.keys(directions).sort(),['left','right','up']);
  const initialCues={};
  for(let seed=1;seed<=5000&&Object.keys(initialCues).length<3;seed++){
    const round=makeRound(seed),direction=round.flickCue?.direction;
    if(direction&&!initialCues[direction])initialCues[direction]=seed;
  }
  check('all three flicks can appear immediately after hook',Object.keys(initialCues).sort(),['left','right','up']);
  for(const direction of ['left','right','up']){
    const {round}=directions[direction],cue=round.flickCue;
    check(`${direction} public cue has a 2.6s window`,Date.parse(cue.until)-Date.parse(cue.startedAt),2600);
    check(`${direction} surge lasts through the response window`,Date.parse(round.phaseUntil)-Date.parse(cue.startedAt)>=2900,true);
    check(`${direction} fish motion matches cue`,round.pullDirection,direction==='up'?'deep':direction);
    const hit=JSON.parse(JSON.stringify(round)),wrong=JSON.parse(JSON.stringify(round));
    const at=Date.parse(cue.startedAt)+500;
    check(`${direction} correct flick accepted`,v5.flick(hit,date(at),direction,cue.id).result,'hit');
    check(`${direction} correct flick has line relief`,hit.strength>round.strength&&hit.distance<round.distance,true);
    check(`${direction} flick cannot be replayed`,v5.flick(hit,date(at+5),direction,cue.id).error,'fishing_flick_replayed');
    check(`${direction} wrong cue id is stale`,v5.flick(wrong,date(at),'left',cue.id+1).error,'fishing_flick_stale');
    const incorrect=direction==='left'?'right':'left';
    check(`${direction} wrong flick consumes cue`,v5.flick(wrong,date(at),incorrect,cue.id).result,'wrong');
    check(`${direction} wrong flick costs line and distance`,wrong.strength<round.strength&&wrong.distance>round.distance,true);
    const missed=JSON.parse(JSON.stringify(round));
    v5.simulate(missed,date(Date.parse(cue.until)+100),1);
    check(`${direction} missed cue has feedback`,missed.flickFeedback.result,'miss');
    check(`${direction} missed cue cannot be replayed`,v5.flick(missed,date(Date.parse(cue.until)+101),direction,cue.id).error,'fishing_flick_expired');
  }
  const up=directions.up.round;
  check('up flick is a deep dive, not neutral lateral steer',up.pullDirection,'deep');
  const direct=v5.create('public',0,1,true);
  check('direct opt-in persisted',direct.flickMode,true);
  const session=minigames.create('fishing','luffy',1,date(0),false,'supply',5,'lure','shore',1,true);
  check('session opt-in persisted',session.flickMode,true);
  check('challenge opt-in persisted',session.challenge.flickMode,true);
  session.challenge.motionSeed=directions.left.seed;
  check('opt-in cast',minigames.answer(session,{roundId:session.challenge.id,counterMoves:['cast'],castPower:50,castZone:'mid'},date(100)).error,undefined);
  session.catchSpeciesId='glistening-saury';
  const hookAt=Date.parse(session.challenge.biteAt)+100;
  check('opt-in hook',minigames.answer(session,{roundId:session.challenge.id,counterMoves:['hook']},date(hookAt)).error,undefined);
  let cue=null,clock=hookAt;
  for(let n=0;n<35&&!cue&&session.challenge;n++){
    clock+=1000;
    check('sync can reveal cue',minigames.answer(session,{roundId:session.challenge.id,counterMoves:['sync']},date(clock)).error,undefined);
    cue=minigames.view(session).challenge.flickCue;
  }
  check('public session receives cue',Boolean(cue),true);
  check('public view hides flick relief internals',Object.hasOwn(minigames.view(session).challenge,'flickReliefUntil'),false);
  const invalid={roundId:session.challenge.id,counterMoves:['flick'],flickCueId:cue.id};
  check('missing direction rejected',minigames.answer(session,invalid,date(clock+10)).error,'invalid_fishing_flick');
  check('stale cue id rejected',minigames.answer(session,{...invalid,flickDirection:cue.direction,flickCueId:cue.id+1},date(clock+20)).error,'fishing_flick_stale');
  check('server route accepts correct flick',minigames.answer(session,{...invalid,flickDirection:cue.direction},date(clock+30)).error,undefined);
  check('server route publishes hit feedback',minigames.view(session).challenge.flickFeedback.result,'hit');
  check('server route rejects replay',minigames.answer(session,{...invalid,flickDirection:cue.direction},date(clock+40)).error,'fishing_flick_replayed');
  const fishIds=[...Object.keys(v5.ISO_BEHAVIOR_MODES),...Object.keys(v5.EXTRA_BEHAVIOR_MODES)];
  const failures=[];let totalFlicks=0;
  for(const speciesId of fishIds)for(const seed of [7,71]){
    const skill=minigames.FISHING_V3_DIFFICULTY[speciesId]??1;
    const fight=fightWithFlicks(seed,speciesId,skill);
    totalFlicks+=fight.flicks;
    if(fight.result!=='landed')failures.push({speciesId,seed,...fight});
  }
  check('all 26 species are catchable with responsive reel and flick input',failures,[]);
  check('sampled fights actually trigger directional flicks',totalFlicks>0,true);
  console.log(JSON.stringify({status:'PASS',checks,species:fishIds.length,scenarios:fishIds.length*2,totalFlicks,
    cueSeeds:Object.fromEntries(Object.entries(directions).map(([direction,value])=>
      [direction,{seed:value.seed,speciesId:'glistening-saury',afterHookMs:value.at-4000}])),
    initialCueSeeds:initialCues},null,2));
}
main();
