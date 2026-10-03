'use strict';

const assert=require('node:assert/strict');
const fs=require('node:fs');
const v5=require('../server/launcher-fishing-v5');
const v4=require('../server/launcher-fishing-v4');
const minigames=require('../server/launcher-minigames');
let checks=0;
function check(label,actual,expected){assert.deepEqual(actual,expected,label);checks++;}
const date=ms=>new Date(ms);

function fight(skill,seed,strategy,rod=0,durationSec=70,speciesId=null,cadenceMs=350) {
  const r=v5.create('test',0,rod);r.motionSeed=seed;
  v5.cast(r,date(100),'worm','mid',{x:.66,y:.45});
  v5.hook(r,date(4000),skill,speciesId);
  let result=null,t=4000;
  for(;t<Math.min(74000,4000+durationSec*1000)&&!result;t+=cadenceMs){
    const next=Math.min(t+cadenceMs,74000,4000+durationSec*1000);
    result=v5.simulate(r,date(next),skill);
    if(result)break;
    const controls=strategy(r);
    v5.control(r,date(next),controls.reeling,controls.steer,controls.paying);
  }
  return{result,round:r,elapsed:(t-4000)/1000};
}

function firstSurge(speciesId) {
  // Pick a documented calm-then-directed draw for each distinct weight row.
  const seed={'striped-clam':60,'glistening-saury':35,'golden-whale':70,
    'pumpkin-octopus':60}[speciesId];
  const r=v5.create('surge',0);r.motionSeed=seed;
  v5.cast(r,date(100),'worm','mid',{x:.66,y:.45});v5.hook(r,date(4000),1,speciesId);
  let t=4000,calmMs=0,surgeMs=0,turns=0,previous='steady';
  const calmIntensity=r.pullIntensity;
  while(r.runState==='calm'&&t<13000){t+=50;v5.simulate(r,date(t),1);}
  calmMs=t-4000;
  const start=t,surgeIntensity=r.pullIntensity;
  const pull=JSON.parse(JSON.stringify(r));
  v5.control(pull,date(t),true,0,false);
  v5.simulate(pull,date(t+700),1);
  const reelStrengthLoss=r.strength-pull.strength,reelDistanceEscape=pull.distance-r.distance;
  const selectedPhase=r.phaseIndex;
  while(r.runState==='surge'&&r.phaseIndex===selectedPhase&&t<18000){
    previous=r.pullDirection;
    v5.control(r,date(t),false,previous==='left'?-1:1,true);
    t+=50;v5.simulate(r,date(t),1);
    if(r.phaseIndex===selectedPhase&&r.pullDirection!==previous)turns++;
  }
  surgeMs=t-start;
  return{calmMs,surgeMs,turns,calmIntensity,surgeIntensity,reelStrengthLoss,reelDistanceEscape};
}

function surgeCount(speciesId){
  const r=v5.create('cycles',0);r.motionSeed=12345;
  v5.cast(r,date(100),'worm','mid',{x:.66,y:.45});v5.hook(r,date(4000),1,speciesId);
  let count=0,prior='calm';
  for(let t=4100;t<=19000&&r.distance>0&&r.strength>0;t+=100){
    const signal=r.runState==='surge'?{reeling:false,steer:r.pullDirection==='left'?-1:1,paying:true}:
      {reeling:true,steer:0,paying:false};
    v5.control(r,date(t-100),signal.reeling,signal.steer,signal.paying);
    v5.simulate(r,date(t),1);
    if(prior!=='surge'&&r.runState==='surge')count++;
    prior=r.runState;
  }
  return count;
}

function phaseModes(speciesId,seed=71){
  const r=v5.create('phase-weights',0);r.motionSeed=seed;
  v5.cast(r,date(100),'worm','mid',{x:.66,y:.45});v5.hook(r,date(4000),1,speciesId);
  const counts={calm:0,surge:0,force:{}};
  for(let index=1;index<=100;index++){
    // Jump to a boundary to examine the source-weighted draw itself, without
    // letting the 70-second player fight deadline hide later RNG samples.
    const at=5000+index*10;
    r.phaseUntil=date(at).toISOString();r.lastSimAt=date(at).toISOString();
    r.fightUntil=date(at+1000).toISOString();r.distance=50;r.strength=100;
    check(`phase draw ${speciesId} ${index} stays active`,v5.simulate(r,date(at+1),1),null);
    counts[r.runState]++;
    counts.force[r.behavior.forceRaw]=(counts.force[r.behavior.forceRaw]||0)+1;
  }
  return counts;
}

function firstPhaseModes(speciesId){
  const counts={calm:0,surge:0};
  for(let seed=1;seed<=100;seed++){
    const r=v5.create('first-phase',0);r.motionSeed=seed;
    v5.cast(r,date(100),'worm','mid',{x:.66,y:.45});v5.hook(r,date(4000),1,speciesId);
    counts[r.runState]++;
  }
  return counts;
}

function main(){
  const blind=()=>({reeling:true,steer:0,paying:false});
  const idle=()=>({reeling:false,steer:0,paying:false});
  const responsive=r=>r.runState==='surge'?
    {reeling:r.strength>65&&v5.displayIntensity(r.pullIntensity,r.runState)<.85,
      steer:r.pullDirection==='left'?-1:1,
      paying:!(r.strength>65&&v5.displayIntensity(r.pullIntensity,r.runState)<.85)}:
    {reeling:r.strength>=38,steer:0,paying:r.strength<38};
  const autoRelease=r=>({...responsive(r),paying:false});
  const reelAndRelease=r=>({reeling:r.runState==='calm'&&r.strength>38,
    steer:0,paying:false});
  const outcomes=[];
  for(const skill of [0,1,2,3])for(const seed of [1,2,10,12345]){
    const b=fight(skill,seed,blind),i=fight(skill,seed,idle),s=fight(skill,seed,responsive);
    outcomes.push({skill,seed,blind:b.result,responsive:s.result,responsiveSeconds:s.elapsed,idle:i.result});
    check(`blind holding cannot win skill ${skill} seed ${seed}`,b.result==='landed',false);
    check(`responsive control can land skill ${skill} seed ${seed}`,s.result,'landed');
    check(`no-input drift cannot land skill ${skill} seed ${seed}`,i.result==='landed',false);
    check('resource remains bounded',s.round.strength>=0&&s.round.strength<=s.round.maxStrength,true);
  }
  for(const seed of [70,71]){
    const before=v5.create('movement',0);before.motionSeed=seed;
    v5.cast(before,date(100),'worm','mid',{x:.66,y:.45});v5.hook(before,date(4000),2);
    const turnAt=Date.parse(before.phaseUntil)+10;
    check('fight switches into a directional surge',v5.simulate(before,date(turnAt),2),null);
    check('surge state is visible',before.runState,'surge');
    const toward=JSON.parse(JSON.stringify(before)),away=JSON.parse(JSON.stringify(before));
    const sign=before.pullDirection==='left'?-1:1;
    v5.control(toward,date(turnAt),false,sign,true);
    v5.control(away,date(turnAt),false,-sign,true);
    v5.simulate(toward,date(turnAt+700),2);v5.simulate(away,date(turnAt+700),2);
    check('matching fish direction preserves more line strength',toward.strength>away.strength,true);
    check('matching fish direction reduces lateral fish motion',
      Math.abs(toward.fishX-before.fishX)<Math.abs(away.fishX-before.fishX),true);
    check('matching fish direction reduces fish escape',toward.distance<away.distance,true);
    const automatic=JSON.parse(JSON.stringify(before));
    const hardReel=JSON.parse(JSON.stringify(before));
    v5.control(automatic,date(turnAt),false,sign,false);
    v5.control(hardReel,date(turnAt),true,0,false);
    v5.simulate(automatic,date(turnAt+700),2);
    v5.simulate(hardReel,date(turnAt+700),2);
    check('releasing reel automatically pays line like legacy explicit payout',
      [automatic.distance,automatic.strength],[toward.distance,toward.strength]);
    check('automatic payout preserves more strength than hard reeling into a run',
      automatic.strength>hardReel.strength,true);
  }
  check('weak patient fish is playable with only reel and release',
    fight(0,12345,reelAndRelease,0,70,'striped-clam').result,'landed');
  const basicGear=fight(3,1,blind,0,5),upgradedGear=fight(3,1,blind,3,5);
  check('rod upgrade keeps line stronger',upgradedGear.round.strength>basicGear.round.strength,true);
  check('rod upgrade helps reel fish closer',upgradedGear.round.distance<basicGear.round.distance,true);
  const styles=new Set(),speciesOutcomes=[];
  check('all canonical fish have ISO or separately authored modes',
    [...Object.keys(v5.ISO_BEHAVIOR_MODES),...Object.keys(v5.EXTRA_BEHAVIOR_MODES)].sort(),
    minigames.FISH_SPECIES.map(fish=>fish.id).sort());
  check('twenty catches use verified ISO fish records',Object.keys(v5.ISO_BEHAVIOR_MODES).length,20);
  check('six launcher catches have separate authored modes',Object.keys(v5.EXTRA_BEHAVIOR_MODES).length,6);
  check('first phase also follows ISO 65/35 weight',firstPhaseModes('lovely-angel'),{calm:65,surge:35});
  check('first phase also follows ISO 20/80 weight',firstPhaseModes('aurora-sunfish'),{calm:20,surge:80});
  for(const seed of [1,2,70,12345,67890]){
    const angel=phaseModes('lovely-angel',seed),aurora=phaseModes('aurora-sunfish',seed);
    check(`ISO 65/35 directed-pull ratio seed ${seed}`,[angel.calm,angel.surge],[65,35]);
    check(`ISO 20/80 directed-pull ratio seed ${seed}`,[aurora.calm,aurora.surge],[20,80]);
    check(`ISO five-slot force mix seed ${seed}`,aurora.force,{'1500':70,'2000':15,'2500':15});
  }
  const isoEvidence=process.env.BOARD_QA_FISH_ISO_PARAMETERS||
    'D:/Codex_QA/wii-adventure-iso-analysis/logic/fish-species-parameters.json';
  if(fs.existsSync(isoEvidence)){
    const extracted=JSON.parse(fs.readFileSync(isoEvidence,'utf8'));
    for(const row of extracted){
      const source=Object.values(v5.ISO_BEHAVIOR_MODES).find(entry=>entry[0]===Number(row.fish_id));
      check(`ISO raw five-slot record ${row.fish_id} copied exactly`,source?.[1],
        row.behavior_modes.map(slot=>[slot.mode,slot.weight,slot.force_raw,
          slot.duration_base_raw,slot.duration_random_range_raw]));
    }
  }
  for(const fish of minigames.FISH_SPECIES){
    const skill=minigames.FISHING_V3_DIFFICULTY[fish.id]??1;
    const result=fight(skill,12345,responsive,0,70,fish.id);
    const slowNetwork=fight(skill,12345,responsive,0,70,fish.id,1000);
    const autoResult=fight(skill,12345,autoRelease,0,70,fish.id,1000);
    const blindResult=fight(skill,12345,blind,0,70,fish.id);
    styles.add(result.round.behavior.style);
    speciesOutcomes.push({id:fish.id,style:result.round.behavior.style,force:result.round.behavior.force,
      normal:result.result,normalSeconds:result.elapsed,oneSecond:slowNetwork.result,oneSecondSeconds:slowNetwork.elapsed,
      blind:blindResult.result,auto:autoResult.result});
  }
  check('all species have a responsive catch',speciesOutcomes.filter(item=>item.normal!=='landed').map(item=>item.id),[]);
  check('all species survive one-second control cadence',speciesOutcomes.filter(item=>item.oneSecond!=='landed').map(item=>item.id),[]);
  check('all species can be landed without an explicit payout button',
    speciesOutcomes.filter(item=>item.auto!=='landed').map(item=>item.id),[]);
  check('all species use distinct launcher fight accents',
    new Set(minigames.FISH_SPECIES.map(fish=>{
      const round=v5.create('accent',0);round.motionSeed=71;
      v5.cast(round,date(100),'worm','mid',{x:.66,y:.45});v5.hook(round,date(4000),1,fish.id);
      return JSON.stringify(round.behavior.accent);
    })).size,minigames.FISH_SPECIES.length);
  check('blind held reel cannot land any species',speciesOutcomes.filter(item=>item.blind==='landed').map(item=>item.id),[]);
  const variationFailures=[];
  const sampledSeeds=[1,2,10,70,71,100,101,1000,12345,54321,7654321,
    0x1fffffff,0x3fffffff,0x7ffffffd,0x7fffffff];
  for(const fish of minigames.FISH_SPECIES)for(const seed of sampledSeeds){
    const skill=minigames.FISHING_V3_DIFFICULTY[fish.id]??1;
    const responsiveRun=fight(skill,seed,responsive,0,70,fish.id,1000);
    const blindRun=fight(skill,seed,blind,0,70,fish.id,1000);
    const idleRun=fight(skill,seed,idle,0,70,fish.id,1000);
    if(responsiveRun.result!=='landed'||blindRun.result==='landed'||idleRun.result==='landed')
      variationFailures.push({id:fish.id,seed,responsive:responsiveRun.result,
        blind:blindRun.result,idle:idleRun.result});
  }
  check('all species and sampled motion seeds reward responsive control at one-second cadence',variationFailures,[]);
  check('species pool uses four distinct behavior styles',[...styles].sort(),['dart','heavy','patient','weave']);
  const catchTimes=speciesOutcomes.map(item=>item.normalSeconds);
  check('authored fish have a wide catch-time spread',Math.max(...catchTimes)-Math.min(...catchTimes)>12,true);
  check('fish have more than a few identical catch times',new Set(catchTimes).size>=15,true);
  const patient=firstSurge('striped-clam'),dart=firstSurge('glistening-saury');
  const heavy=firstSurge('golden-whale'),weave=firstSurge('pumpkin-octopus');
  check('heavy pull lasts much longer than a dart',heavy.surgeMs>dart.surgeMs*1.8,true);
  check('patient fish waits substantially longer between pulls',patient.calmMs>dart.calmMs*1.8,true);
  check('ISO fish holds one direction within a selected behavior',weave.turns,0);
  check('long heavy pull keeps its direction',heavy.turns,0);
  check('darting fish makes more frequent runs',surgeCount('glistening-saury')>surgeCount('striped-clam'),true);
  check('heavy pull consumes more strength with same input',heavy.reelStrengthLoss>patient.reelStrengthLoss*2,true);
  check('heavy pull escapes farther with same input',heavy.reelDistanceEscape>patient.reelDistanceEscape*2,true);
  check('public pull intensity follows actual pulling force',heavy.surgeIntensity>dart.surgeIntensity&&dart.surgeIntensity>patient.surgeIntensity,true);
  check('calm intensity is less than the same fish surge',heavy.calmIntensity<heavy.surgeIntensity,true);
  const start=minigames.create('fishing','luffy',1,date(0),false,'supply',5,'worm','shore',2);
  check('v5 session and challenge are versioned',[start.fishingVersion,start.challenge.fishingVersion,start.rodLevel],[5,5,2]);
  check('v5 species not predrawn before cast',Object.hasOwn(start,'catchSpeciesId'),false);
  const ref={roundId:start.challenge.id,counterMoves:['cast'],castPower:50,castZone:'mid'};
  check('v5 cast accepted',minigames.answer(start,ref,date(100)).error,undefined);
  check('v5 waiting stage',start.challenge.stage,'wait');
  check('v5 cast selects a real fish',Boolean(start.catchSpeciesId),true);
  check('v5 public view hides species',Object.hasOwn(minigames.view(start),'catchSpeciesId'),false);
  check('second cast cannot reroll',minigames.answer(start,ref,date(200)).error,'invalid_fishing_action');
  check('early hook rejected',minigames.answer(start,{roundId:start.challenge.id,counterMoves:['hook']},date(201)).error,'fishing_not_bitten');
  const bite=Date.parse(start.challenge.biteAt);
  check('timely hook accepted',minigames.answer(start,{roundId:start.challenge.id,counterMoves:['hook']},date(bite+30)).error,undefined);
  check('v5 fighting stage',start.challenge.stage,'fight');
  const visible=minigames.view(start).challenge;
  check('v5 public view hides species rhythm internals',
    ['behavior','reelHoldMs','nextTurnAt','turnsRemaining','phaseIndex','phaseUntil'].some(key=>Object.hasOwn(visible,key)),false);
  check('v5 public view exposes only current intensity',
    [.12,.45,.7,.95].includes(visible.pullIntensity),true);
  check('v5 public view hides the motion seed',Object.hasOwn(visible,'motionSeed'),false);
  check('v5 public intensity is coarsened from true force',
    visible.pullIntensity,v5.displayIntensity(start.challenge.pullIntensity,start.challenge.runState));
  check('bad control rejected',minigames.answer(start,{roundId:start.challenge.id,counterMoves:['control'],reeling:true,steer:0,paying:true},date(bite+100)).error,'invalid_fishing_control');
  check('responsive control accepted',minigames.answer(start,{roundId:start.challenge.id,counterMoves:['control'],reeling:true,steer:0,paying:false},date(bite+120)).error,undefined);
  check('identical control heartbeat is rate limited',minigames.answer(start,{roundId:start.challenge.id,counterMoves:['control'],reeling:true,steer:0,paying:false},date(bite+150)).error,'fishing_action_cooldown');
  check('releasing reel is accepted immediately',minigames.answer(start,{roundId:start.challenge.id,counterMoves:['control'],reeling:false,steer:0,paying:false},date(bite+160)).error,undefined);
  const full=minigames.create('fishing','luffy',1,date(0),false,'supply',5,'worm','shore',0);
  check('full route cast accepted',minigames.answer(full,{roundId:full.challenge.id,counterMoves:['cast'],castPower:50,castZone:'mid'},date(100)).error,undefined);
  full.catchSpeciesId='balloon-catfish';full.challenge.motionSeed=1;
  let clock=Date.parse(full.challenge.biteAt)+30;
  check('full route hook accepted',minigames.answer(full,{roundId:full.challenge.id,counterMoves:['hook']},date(clock)).error,undefined);
  for(let step=0;step<190&&full.challenge;step++){
    clock+=350;
    const c=responsive(full.challenge);
    const result=minigames.answer(full,{roundId:full.challenge.id,counterMoves:['control'],...c},date(clock));
    check('full route accepts responsive controls',result.error,undefined);
  }
  check('full route lands through authoritative answer',full.feedback.reason,'landed');
  check('full route advances a single fishing round',full.roundIndex,1);
  check('completed round rejects replay',minigames.answer(full,{roundId:start.challenge.id,counterMoves:['sync']},date(clock+400)).error,'minigame_round_complete');
  const old=minigames.create('fishing','luffy',1,date(0),false,'supply',4,'worm','shore',0);
  check('v4 session remains versioned 4',[old.fishingVersion,old.challenge.fishingVersion],[4,4]);
  check('v4 module unchanged',v4.create('legacy',0).fishingVersion,4);
  console.log(JSON.stringify({status:'PASS',checks,fishCount:speciesOutcomes.length,
    sampledSeedCount:sampledSeeds.length,allResponsiveAtOneSecond:true,allBlindHoldFailed:true,
    catchSeconds:{minimum:Math.min(...catchTimes),maximum:Math.max(...catchTimes),unique:new Set(catchTimes).size},
    firstSurge:{patient,dart,heavy,weave},genericOutcomes:{cases:outcomes.length,
      blindFailed:outcomes.filter(item=>item.blind==='line_snapped').length,
      responsiveCaught:outcomes.filter(item=>item.responsive==='landed').length,
      idleEscaped:outcomes.filter(item=>item.idle==='escaped').length}},null,2));
}
main();
