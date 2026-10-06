'use strict';

// The supplied Unlimited Adventure ISO confirms fish/rod tables and its DOL
// uses rod/fish lateral alignment while spending a separate reeling resource.
// The rates, phase lengths and trajectories below are original launcher rules:
// static disc analysis cannot establish the original game's exact timing.
const crypto = require('node:crypto');
const iso = value => new Date(value).toISOString();
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const round4 = value => Math.round(value*10000)/10000;
// Leave room for input/network latency on rare high-pull fish after the
// normal responsive catch window; this is a fail-safe, not a target duration.
const DURATION_MS = 150000;
const CONTROL_LEASE_MS = 2000;
const HOOK_WINDOW_MS = 4500;
const STEP_MS = 100;
const FLICK_WINDOW_MS = 2600;
const FLICK_TELL_MS = Object.freeze({patient:850,dart:550,heavy:950,weave:700});
const FLICK_MIN_SURGE_MS = 3850;
const FLICK_RELIEF_MS = 3500;
const rodLevel = value => Number.isInteger(value)&&value>=0&&value<=3?value:0;
// Franky's three upgrades improve the player-controlled parts of a fight.
// The bonuses do not alter the species pool, bite timing, cast reach or fish
// force. Misaligned reeling still gains almost no distance, even at level 3.
const ROD_EFFECT_PER_LEVEL = Object.freeze({reelGain:.45,reelDrain:.6,
  freeLineRecovery:.4,freeLineEscape:.12});

// Exact numeric behavior slots extracted read-only from the user's Unlimited
// Adventure ISO (fish_prm.bin SHA-256 4c713eee0191385339f5f16650789412045f2e545eb9988cf9b13dcd0f961ea4).
// Each row is [ISO fish ID, [[mode, nominal weight, force F, duration base,
// duration random range], ...]]. DOL confirms slot selection, force F and
// duration-counter use. Browser conversion below is new design: the source
// values are dimensionless coefficients/internal ticks, not Newtons/seconds.
const ISO_BEHAVIOR_MODES = Object.freeze({
  'lovely-angel':[0x097d,[[0,65,800,2500,1500],[1,35,500,1000,1500]]],
  'adventure-fish':[0x097e,[[0,50,1000,2000,1000],[1,35,600,1500,2000],[1,15,800,1500,500]]],
  'claw-shrimp':[0x1eb7,[[0,65,1300,1000,1500],[1,35,800,1500,2000]]],
  'beat-alligator':[0x1eb6,[[0,65,1300,1000,1600],[1,35,800,1500,2000]]],
  'elephant-tuna':[0x097c,[[0,65,1300,1000,1700],[1,35,900,1500,2000]]],
  'panda-shark':[0x1eb5,[[0,80,1300,3000,0],[1,20,2000,2500,1500]]],
  'great-terigius':[0x1eb9,[[0,80,2000,1000,1700],[1,20,3000,2500,1500]]],
  'golden-whale':[0x1eba,[[0,80,2000,1000,1700],[1,20,3000,2500,1500]]],
  'striped-clam':[0x1ec2,[[0,65,500,3000,0],[1,35,1000,1000,1500]]],
  'treasure-pearl-clam':[0x1ec3,[[0,65,1300,1000,1700],[1,35,1200,1000,1500]]],
  'pumpkin-octopus':[0x1ebb,[[0,65,1300,1000,1700],[1,35,800,1000,1500]]],
  'cutie-piranha':[0x1ebc,[[0,65,1300,1000,1700],[1,35,800,1000,1500]]],
  'electric-catfish':[0x097f,[[0,65,1300,1000,1700],[1,35,900,1000,1500]]],
  'demon-bonito':[0x1ebd,[[0,65,1300,1000,1700],[1,35,1000,1000,1500]]],
  'maple-salmon':[0x1ebe,[[0,65,1300,1000,1700],[1,35,500,1000,1500]]],
  'lava-flounder':[0x1ebf,[[0,65,1300,1000,1700],[1,35,600,1000,1500]]],
  'guiding-anglerfish':[0x1eb8,[[0,65,1300,1000,1700],[1,35,1200,1000,1500]]],
  'burning-dragon':[0x1ec0,[[0,65,1300,1000,1700],[1,35,1800,1000,1500]]],
  'ice-fish':[0x1ec1,[[0,65,1300,1000,1700],[1,35,500,1000,1500]]],
  'aurora-sunfish':[0x23eb,[[0,20,1500,1000,1500],[1,35,1500,1000,2000],
    [1,15,2000,1500,1000],[1,15,2500,1000,2000],[1,15,1500,2000,1500]]]
});
// The six launcher legacy catches have no record in this ISO and therefore
// use separately authored slots. Mode/weight/rate units match the schema
// above for internal consistency; none of these values are ISO claims.
const EXTRA_BEHAVIOR_MODES = Object.freeze({
  'balloon-catfish':[[0,70,750,2600,800],[1,30,650,1400,700]],
  'glistening-saury':[[0,45,950,1700,600],[1,55,1200,1200,700]],
  'smile-jellyfish':[[0,75,600,2800,700],[1,25,550,1700,700]],
  'butterflyfish':[[0,50,800,1700,700],[1,50,850,1200,800]],
  'cola-sunfish':[[0,70,900,2600,900],[1,30,850,1600,800]],
  'reef-shark':[[0,70,1400,2600,700],[1,30,1900,2300,800]],
  'largemouth-bass':[[0,55,950,1800,700],[1,45,1200,1350,600]],
  'warmouth':[[0,80,700,2400,700],[1,20,550,1100,500]],
  'congo-bichir':[[0,55,950,1800,700],[1,45,1000,1700,700]],
  'paddlefish':[[0,75,1250,2200,900],[1,25,1700,1800,800]],
  'alligator-gar':[[0,55,1450,2000,700],[1,45,1900,1600,800]],
  'dolphinfish':[[0,45,1100,1500,650],[1,55,1550,1250,650]],
  'lionfish':[[0,70,800,2100,600],[1,30,1250,1500,700]],
  'dusky-grouper':[[0,70,1300,2200,700],[1,30,1750,1800,800]],
  'goliath-grouper':[[0,70,1600,2600,800],[1,30,2050,2100,900]],
  'white-marlin':[[0,50,1450,1600,600],[1,50,2100,1550,800]]
});
const ISO_STYLES = Object.freeze({
  'lovely-angel':'patient','adventure-fish':'weave','claw-shrimp':'dart','beat-alligator':'heavy',
  'elephant-tuna':'heavy','panda-shark':'heavy','great-terigius':'heavy','golden-whale':'heavy',
  'striped-clam':'patient','treasure-pearl-clam':'patient','pumpkin-octopus':'weave',
  'cutie-piranha':'dart','electric-catfish':'weave','demon-bonito':'dart','maple-salmon':'dart',
  'lava-flounder':'heavy','guiding-anglerfish':'heavy','burning-dragon':'dart',
  'ice-fish':'dart','aurora-sunfish':'weave'
});
const EXTRA_STYLES = Object.freeze({'balloon-catfish':'patient','glistening-saury':'dart',
  'smile-jellyfish':'patient','butterflyfish':'dart','cola-sunfish':'patient','reef-shark':'heavy',
  'largemouth-bass':'dart','warmouth':'patient','congo-bichir':'weave',
  'paddlefish':'heavy','alligator-gar':'heavy','dolphinfish':'dart',
  'lionfish':'weave','dusky-grouper':'heavy','goliath-grouper':'heavy',
  'white-marlin':'dart'});
// Launcher-authored species accents make fish of the same broad movement style
// feel different. They do not alter the sourced ISO slot weights or raw F:
// duration controls the lull/run, swim the lateral speed, pull line escape,
// fatigue the strength cost of hard reeling, and grip the reeling gain.
const FIGHT_ACCENTS = Object.freeze({
  'balloon-catfish':Object.freeze({duration:1.08,swim:.9,pull:.87,fatigue:.86,grip:1.07}),
  'glistening-saury':Object.freeze({duration:.84,swim:1.27,pull:1.03,fatigue:.96,grip:1.02}),
  'smile-jellyfish':Object.freeze({duration:1.14,swim:.74,pull:.83,fatigue:.8,grip:1.1}),
  'panda-shark':Object.freeze({duration:1.06,swim:1.12,pull:1.12,fatigue:1.1,grip:.95}),
  'butterflyfish':Object.freeze({duration:.91,swim:1.19,pull:.91,fatigue:.9,grip:1.06}),
  'adventure-fish':Object.freeze({duration:.97,swim:1.12,pull:1.03,fatigue:1.01,grip:1.01}),
  'cola-sunfish':Object.freeze({duration:1.16,swim:.77,pull:1.04,fatigue:1.02,grip:.97}),
  'reef-shark':Object.freeze({duration:1.08,swim:1.15,pull:1.18,fatigue:1.14,grip:.91}),
  'elephant-tuna':Object.freeze({duration:.94,swim:1.21,pull:1.14,fatigue:1.11,grip:.94}),
  'lovely-angel':Object.freeze({duration:1.06,swim:.87,pull:.86,fatigue:.86,grip:1.08}),
  'striped-clam':Object.freeze({duration:1.12,swim:.72,pull:.82,fatigue:.83,grip:1.1}),
  'cutie-piranha':Object.freeze({duration:.88,swim:1.24,pull:1.06,fatigue:1.04,grip:1.02}),
  'claw-shrimp':Object.freeze({duration:.94,swim:1.16,pull:.94,fatigue:.93,grip:1.05}),
  'pumpkin-octopus':Object.freeze({duration:1.09,swim:1.08,pull:1.08,fatigue:1.06,grip:.97}),
  'maple-salmon':Object.freeze({duration:.93,swim:1.13,pull:.98,fatigue:.96,grip:1.03}),
  'lava-flounder':Object.freeze({duration:1.13,swim:.86,pull:1.08,fatigue:1.05,grip:.99}),
  'treasure-pearl-clam':Object.freeze({duration:1.1,swim:.79,pull:1.04,fatigue:1.11,grip:.95}),
  'electric-catfish':Object.freeze({duration:.9,swim:1.18,pull:1.13,fatigue:1.1,grip:.94}),
  'demon-bonito':Object.freeze({duration:.85,swim:1.26,pull:1.08,fatigue:1.08,grip:.97}),
  'guiding-anglerfish':Object.freeze({duration:1.11,swim:.83,pull:1.12,fatigue:1.11,grip:.93}),
  'ice-fish':Object.freeze({duration:.87,swim:1.23,pull:1.05,fatigue:1.03,grip:1.01}),
  'beat-alligator':Object.freeze({duration:1.08,swim:.92,pull:1.16,fatigue:1.12,grip:.92}),
  'aurora-sunfish':Object.freeze({duration:1.06,swim:1.05,pull:1.03,fatigue:1.07,grip:1.08}),
  'burning-dragon':Object.freeze({duration:.88,swim:1.27,pull:1.24,fatigue:1.18,grip:.9}),
  'great-terigius':Object.freeze({duration:.94,swim:1.18,pull:1.19,fatigue:1.13,grip:.91}),
  'golden-whale':Object.freeze({duration:1.12,swim:.82,pull:1.16,fatigue:1.13,grip:.91}),
  'largemouth-bass':Object.freeze({duration:.94,swim:1.12,pull:.96,fatigue:.92,grip:1.04}),
  'warmouth':Object.freeze({duration:1.1,swim:.78,pull:.8,fatigue:.81,grip:1.11}),
  'congo-bichir':Object.freeze({duration:1.06,swim:.98,pull:1.01,fatigue:.96,grip:1.03}),
  'paddlefish':Object.freeze({duration:1.12,swim:.91,pull:1.12,fatigue:1.04,grip:.98}),
  'alligator-gar':Object.freeze({duration:.92,swim:1.16,pull:1.18,fatigue:1.11,grip:.94}),
  'dolphinfish':Object.freeze({duration:.86,swim:1.3,pull:1.1,fatigue:1.01,grip:.99}),
  'lionfish':Object.freeze({duration:1.1,swim:.87,pull:.89,fatigue:.88,grip:1.06}),
  'dusky-grouper':Object.freeze({duration:1.14,swim:.85,pull:1.17,fatigue:1.1,grip:.94}),
  'goliath-grouper':Object.freeze({duration:1.07,swim:.78,pull:1.06,fatigue:1.06,grip:1.07}),
  'white-marlin':Object.freeze({duration:.88,swim:1.3,pull:1.16,fatigue:1.08,grip:.96})
});
const BEHAVIOR_STYLES = Object.freeze({
  patient:Object.freeze({calmMs:5100,surgeMs:1600,turns:0,swimSpeed:.11,reelGain:6.25,surgeEscape:1.45,reelDrain:5.6,recovery:9.2}),
  dart:Object.freeze({calmMs:2200,surgeMs:1250,turns:0,swimSpeed:.29,reelGain:6.15,surgeEscape:2.1,reelDrain:7.8,recovery:8.2}),
  heavy:Object.freeze({calmMs:3900,surgeMs:2850,turns:0,swimSpeed:.12,reelGain:5.45,surgeEscape:2.3,reelDrain:8.8,recovery:6.5}),
  weave:Object.freeze({calmMs:3000,surgeMs:2450,turns:1,swimSpeed:.22,reelGain:5.9,surgeEscape:1.95,reelDrain:7.3,recovery:7.8})
});
function directedFraction(slots){
  const total=slots.reduce((sum,slot)=>sum+slot[1],0);
  return slots.reduce((sum,slot)=>sum+(slot[0]===1?slot[1]:0),0)/total;
}
function behaviorFor(id) {
  const iso=ISO_BEHAVIOR_MODES[id];
  if(iso)return{style:ISO_STYLES[id],source:'iso',sourceId:iso[0],slots:iso[1],
    directedFraction:directedFraction(iso[1]),accent:FIGHT_ACCENTS[id]||null};
  const slots=EXTRA_BEHAVIOR_MODES[id]||[[0,65,1000,1800,700],[1,35,1000,1500,700]];
  return{style:EXTRA_STYLES[id]||'weave',source:'launcher',slots,
    directedFraction:directedFraction(slots),accent:FIGHT_ACCENTS[id]||null};
}

function castZoneForPower(power) {return power<35?'near':power<70?'mid':'far';}
function castTargetForPower(power,zones) {
  const progress=power/100,from=zones.near,to=zones.far;
  return{x:round4(from.x+(to.x-from.x)*progress),y:round4(from.y+(to.y-from.y)*progress)};
}

function position(seed,motionStartedAt,at) {
  const t=Math.max(0,(at-Date.parse(motionStartedAt))/1000),phase=(seed%6283)/1000;
  return{x:clamp(.5+.22*Math.sin(t*.9+phase)+.055*Math.sin(t*1.8+phase*.37),.16,.84),
    y:clamp(.57+.075*Math.sin(t*.7+phase*1.4),.45,.72)};
}

function paintWaitingMotion(round,at) {
  const p=position(round.motionSeed,round.motionStartedAt,at),before=position(round.motionSeed,round.motionStartedAt,at-100);
  round.fishX=round4(p.x);round.fishY=round4(p.y);
  round.fishVelocityX=round4((p.x-before.x)*10);round.fishVelocityY=round4((p.y-before.y)*10);
}

function observe(round,now) {
  if(round.motionStartedAt&&round.stage==='wait')paintWaitingMotion(round,now.getTime());
  round.lastSimAt=iso(Math.max(now.getTime(),Date.parse(round.lastSimAt)||0));
}

function create(id,issuedAt,equippedRodLevel=0,flickMode=false) {
  return{id,fishingVersion:5,stage:'cast',castAt:null,castZone:null,castTarget:null,
    nibbleAt:null,biteAt:null,hookUntil:null,hookedAt:null,fightUntil:null,
    lastSimAt:iso(issuedAt),distance:100,strength:100,maxStrength:100,tension:0,pullIntensity:0,
    pullDirection:'steady',runState:'calm',fishX:.5,fishY:.57,fishVelocityX:0,fishVelocityY:0,
    motionSeed:crypto.randomInt(1,0x80000000),rodLevel:rodLevel(equippedRodLevel),motionStartedAt:null,
    phaseIndex:0,phaseUntil:null,nextTurnAt:null,turnsRemaining:0,behavior:null,reelHoldMs:0,
    ...(flickMode===true?{flickMode:true,flickTell:null,flickCue:null,flickFeedback:null,
      flickReliefUntil:null,powerMode:true,powerCharge:0,fishStamina:100,maxFishStamina:100,
      special:null,powerFeedback:null}:{}),
    control:{reeling:false,steer:0},controlLeaseUntil:null,
    showcaseMs:0,answerWindowMs:90000,notBefore:iso(issuedAt)};
}

function cast(round,now,baitId,castZone,castTarget) {
  const at=now.getTime(),baitWait={worm:3000,shrimp:2700,lure:2400}[baitId]??2700;
  const biteAt=at+baitWait+crypto.randomInt(0,1000);
  round.stage='wait';round.castAt=iso(at);round.castZone=castZone;round.castTarget={...castTarget};
  round.motionStartedAt=iso(at);round.nibbleAt=iso(biteAt-1150);round.biteAt=iso(biteAt);
  round.hookUntil=iso(biteAt+HOOK_WINDOW_MS);round.lastSimAt=iso(at);
  paintWaitingMotion(round,at);
}

function selectPhase(round,skill,index,at) {
  // Draw from the entire five-slot source table by its nominal weights on
  // every phase, including the first. Browser phase duration is tuned
  // separately because the Wii counter is not seconds.
  const slots=round.behavior.slots;
  const total=slots.reduce((sum,slot)=>sum+slot[1],0);
  let draw=((round.motionSeed+index*7919)>>>0)%total,chosen=slots[0];
  for(const slot of slots){draw-=slot[1];if(draw<0){chosen=slot;break;}}
  const mode=chosen[0];
  const spread=chosen[4],variation=spread?((round.motionSeed+index*6133)>>>0)%spread:0;
  const durationRaw=chosen[3]+variation;
  const perFishRandom=(round.motionSeed%997)/997;
  const originalFactor=chosen[2]/1000*(1+.3*perFishRandom);
  // Preserve the verified relative F and duration distinctions while tuning
  // them to keyboard/pointer response time. ISO duration counters are not ms.
  round.behavior.force=clamp(.55+originalFactor*.4,.7,1.85);
  round.behavior.forceRaw=chosen[2];round.behavior.durationRaw=durationRaw;
  const rules=BEHAVIOR_STYLES[round.behavior.style];
  const durationFactor=clamp(1+(durationRaw-1900)/6000,.82,1.25);
  const wobble=((round.motionSeed+index*37)%5-2)*65;
  const rawLength=Math.max(1250,Math.round((mode?rules.surgeMs:rules.calmMs)*durationFactor*
    (round.behavior.accent?.duration||1)+
    (mode?skill*65:0)+wobble));
  // Only opt-in sessions get the gesture layer. Non-flick V5 rounds keep
  // their lateral run timing and are never asked for a new control.
  // Most directed runs now offer a counter. A cue-bearing run is at least
  // 3.85s long, so even consecutive cues leave time to reel between them.
  const cuePhase=Boolean(round.flickMode&&(round.powerMode||mode&&((round.motionSeed>>>2)+index)%4!==0));
  const length=round.powerMode?Math.max(3700,Math.min(rawLength,4400)):
    cuePhase?Math.max(rawLength,FLICK_MIN_SURGE_MS):rawLength;
  round.runState=mode?'surge':'calm';
  const side=round.behavior.style==='heavy'?Math.floor(index/2):index;
  round.pullDirection=mode?((round.motionSeed+side)%2?'left':'right'):'steady';
  if(cuePhase){
    const direction=((round.motionSeed>>>3)+index)%3===0?'up':mode?round.pullDirection:
      ((round.motionSeed+index)%2?'left':'right');
    round.pullDirection=direction==='up'?'deep':direction;
    const tellMs=FLICK_TELL_MS[round.behavior.style];
    round.flickTell={id:index+1,direction,startedAt:iso(at),until:iso(at+tellMs)};
    round.flickCue=null;
    // Keep the last settled result until another counter settles. A sync may
    // cross both a missed cue and the next phase; clearing here would hide
    // that miss from the player even though the penalty was already applied.
  }else if(round.flickMode){round.flickTell=null;round.flickCue=null;}
  round.phaseUntil=iso(at+length);
  // The ISO source picks one lateral heading for a behavior slot. This new
  // opt-in launcher gesture layer may replace one run with an upward dive;
  // otherwise keep that heading until the next draw.
  const turns=cuePhase||round.behavior.source==='iso'?0:rules.turns;
  round.turnsRemaining=mode?turns:0;
  round.nextTurnAt=mode&&turns?iso(at+Math.round(length/(turns+1))):null;
  const pull=rules.surgeEscape*round.behavior.force*(round.behavior.accent?.pull||1);
  round.pullIntensity=round4(mode?clamp(.12+pull/5,0,1):clamp(.06+pull/30,0,.2));
}

function advancePhase(round,skill,at) {
  round.phaseIndex++;
  selectPhase(round,skill,round.phaseIndex,at);
}

function turnFish(round,at) {
  round.pullDirection=round.pullDirection==='left'?'right':'left';
  round.turnsRemaining--;
  const remaining=Date.parse(round.phaseUntil)-at;
  round.nextTurnAt=round.turnsRemaining>0?iso(at+Math.round(remaining/(round.turnsRemaining+1))):null;
}

function hook(round,now,difficulty=1,speciesId=null) {
  const at=now.getTime(),skill=clamp(difficulty,0,3);
  round.stage='fight';round.hookedAt=iso(at);round.fightUntil=iso(at+DURATION_MS);
  const targetY=Number(round.castTarget?.y),castOffset=Number.isFinite(targetY)?clamp((.45-targetY)*40,-4,5):0;
  round.distance=clamp(80+skill*3+castOffset,0,99);
  round.strength=round.maxStrength=100;round.tension=0;
  round.behavior=behaviorFor(speciesId);
  round.runState='calm';round.pullDirection='steady';round.phaseIndex=0;
  selectPhase(round,skill,0,at);
  round.lastSimAt=iso(at);round.control={reeling:false,steer:0};round.controlLeaseUntil=null;
  if(round.flickMode){round.flickFeedback=null;round.flickReliefUntil=null;}
  if(round.powerMode){round.powerCharge=0;round.fishStamina=100;round.special=null;}
  round.reelHoldMs=0;
  round.fishVelocityX=0;round.fishVelocityY=0;
}

function resolveFlick(round,at,result) {
  const cue=round.flickCue;
  if(!cue)return null;
  round.flickCue=null;
  round.flickFeedback={id:cue.id,direction:cue.direction,result,at:iso(at)};
  // A strong fish makes a clean counter more valuable and a missed counter
  // more costly, while the existing line-strength meter remains authoritative.
  const force=round.behavior?.force||1;
  if(result==='hit'){
    round.strength=round4(clamp(round.strength+10+force*2,0,round.maxStrength));
    round.distance=round4(clamp(round.distance-(round.powerMode?.8+force*.4:3.8+force*1.5),0,100));
    if(round.powerMode){round.powerCharge=Math.min(6,round.powerCharge+1);round.fishStamina=round4(Math.max(0,round.fishStamina-4));}
    round.flickReliefUntil=iso(at+FLICK_RELIEF_MS);
  }else{
    // A wrong or missed counter cancels any reward from the previous cue.
    round.flickReliefUntil=null;
    round.strength=round4(clamp(round.strength-(result==='wrong'?8+force*2:6+force*2),0,
      round.maxStrength));
    round.distance=round4(clamp(round.distance+(result==='wrong'?2.8+force*1.2:
      2.2+force*1.2),0,100));
  }
  round.tension=round4(100-round.strength);
  return settlement(round);
}

function settlement(round){return round.strength<=0?'line_snapped':round.distance<=0||round.powerMode&&round.fishStamina<=0?'landed':round.distance>=100?'escaped':null;}
const SPECIALS=Object.freeze({luffy:['橡膠橡膠・JET手槍','rubber'],zoro:['三刀流・百八煩惱鳳','sword'],nami:['雷光槍天候','weather'],usopp:['必殺・綠星梧桐手裏劍','star'],sanji:['惡魔風腳・畫龍點睛踢','flame'],chopper:['刻蹄・櫻','strength'],robin:['千紫萬紅・巨大樹','flower'],franky:['Franky Radical Beam','cola'],brook:['靈魂之劍','soul'],jinbe:['魚人柔術・海流過肩摔','wave'],ace:['火拳','flame'],sabo:['龍爪拳・龍之鉤爪','flame'],law:['ROOM・指揮棒','room'],hancock:['芳香腳','heart']});
function power(round,now,move,direction){
  if(!round.powerMode)return{error:'invalid_fishing_action'};
  const at=now.getTime();
  if(move==='burst'){
    if(round.special||round.powerCharge<3)return{error:'fishing_power_not_ready'};
    round.powerCharge-=3;round.distance=round4(Math.max(0,round.distance-15));
    round.fishStamina=round4(Math.max(0,round.fishStamina-12));round.flickReliefUntil=iso(at+4000);
    round.powerFeedback={at:iso(at),type:'burst',name:'爆拉',theme:'gold'};
    return{settlement:settlement(round)};
  }
  if(move==='special'){
    if(round.special||round.powerCharge<6)return{error:'fishing_power_not_ready'};
    round.powerCharge-=6;round.flickTell=null;round.flickCue=null;
    round.control={reeling:false,steer:0};round.controlLeaseUntil=null;
    const arrows=['left','up','right','down'];
    round.special={id:crypto.randomUUID(),sequence:Array.from({length:6},()=>arrows[crypto.randomInt(4)]),index:0,until:iso(at+8000),lastKeyAt:at-100};
    return{};
  }
  const s=round.special;
  if(!s||at>=Date.parse(s.until))return{error:'fishing_special_expired'};
  // Each input consumes one authoritative sequence step; fast consecutive keys are valid.
  s.lastKeyAt=at;
  if(direction!==s.sequence[s.index]){round.special=null;round.phaseUntil=iso(at+700);round.nextTurnAt=null;round.powerFeedback={at:iso(at),type:'miss',name:'節奏中斷',theme:'gold'};return{};}
  if(++s.index===s.sequence.length){
    round.special=null;round.fishStamina=round4(Math.max(0,round.fishStamina-55));
    round.distance=round4(Math.max(0,round.distance-8));round.strength=Math.min(100,round.strength+25);round.flickReliefUntil=iso(at+5000);
    const skill=SPECIALS[round.characterKey]||SPECIALS.luffy;
    round.powerFeedback={at:iso(at),type:'special',name:skill[0],theme:skill[1]};
  }
  return{settlement:settlement(round)};
}

function revealFlickCue(round,at) {
  const tell=round.flickTell;
  if(!tell)return;
  round.flickTell=null;
  round.flickCue={id:tell.id,direction:tell.direction,startedAt:iso(at),
    until:iso(at+FLICK_WINDOW_MS)};
}

function flick(round,now,direction,cueId) {
  if(!round.flickMode)return{error:'invalid_fishing_action'};
  const cue=round.flickCue;
  if(!cue)return{error:round.flickFeedback?.id===cueId?
    round.flickFeedback.result==='miss'?'fishing_flick_expired':'fishing_flick_replayed':
    'fishing_flick_stale'};
  if(cue.id!==cueId)return{error:'fishing_flick_stale'};
  const at=now.getTime();
  if(at>=Date.parse(cue.until))return{error:'fishing_flick_expired'};
  const result=direction===cue.direction?'hit':'wrong';
  return{result,settlement:resolveFlick(round,at,result)};
}

function simulate(round,now,difficulty=1) {
  if(round.stage!=='fight')return null;
  const completed=settlement(round);if(completed)return completed;
  const requested=now.getTime(),deadline=Date.parse(round.fightUntil),end=Math.min(requested,deadline);
  let cursor=Date.parse(round.lastSimAt);
  if(!Number.isFinite(cursor)||!Number.isFinite(end))return 'escaped';
  if(end<cursor)return null;
  const skill=clamp(difficulty,0,3),gear=rodLevel(round.rodLevel),lease=Date.parse(round.controlLeaseUntil);
  while(cursor<end) {
    if(round.special){
      const stop=Math.min(end,Date.parse(round.special.until));
      // The input challenge freezes the fish and line; its eight seconds still count toward the fight deadline.
      cursor=stop;round.lastSimAt=iso(cursor);
      if(cursor>=Date.parse(round.special.until)){round.special=null;round.powerFeedback={at:iso(cursor),type:'miss',name:'節奏中斷',theme:'gold'};round.phaseUntil=iso(cursor+700);round.nextTurnAt=null;}
      if(cursor>=end)break;
      continue;
    }
    if(cursor>=Date.parse(round.phaseUntil))advancePhase(round,skill,cursor);
    if(round.nextTurnAt&&cursor>=Date.parse(round.nextTurnAt))turnFish(round,cursor);
    if(round.flickTell&&cursor>=Date.parse(round.flickTell.until))revealFlickCue(round,cursor);
    if(round.flickCue&&cursor>=Date.parse(round.flickCue.until)){
      const outcome=resolveFlick(round,cursor,'miss');
      if(outcome)return outcome;
    }
    const turnAt=round.nextTurnAt?Date.parse(round.nextTurnAt):Infinity;
    const tellUntil=round.flickTell?Date.parse(round.flickTell.until):Infinity;
    const cueUntil=round.flickCue?Date.parse(round.flickCue.until):Infinity;
    const next=Math.min(end,cursor+STEP_MS,Date.parse(round.phaseUntil),turnAt,tellUntil,cueUntil),
      dt=(next-cursor)/1000;
    if(next<=cursor)return 'escaped';
    const held=Number.isFinite(lease)&&cursor<lease;
    const control=held?round.control:{reeling:false,steer:0,paying:false};
    const surge=round.runState==='surge',deep=round.pullDirection==='deep';
    const fishSign=round.pullDirection==='left'?-1:round.pullDirection==='right'?1:0;
    const relief=Boolean(round.flickMode&&Number.isFinite(Date.parse(round.flickReliefUntil))&&
      cursor<Date.parse(round.flickReliefUntil));
    const aligned=surge&&(relief||!deep&&control.steer===fishSign);
    const opposed=surge&&!deep&&!relief&&control.steer===-fishSign;
    // Releasing the reel automatically lets line run. Older clients may still
    // send `paying`; their requests remain valid, but the extra button is not
    // required to protect the line. Steering with the run limits the payout.
    const paying=!control.reeling;
    const {style,force,accent}=round.behavior,rules=BEHAVIOR_STYLES[style];
    const staminaFactor=round.powerMode?.45+.55*round.fishStamina/100:1;
    const surgePull=rules.surgeEscape*force*(accent?.pull||1)*staminaFactor;
    const speed=surge?(deep?(.5-round.fishX)*.5:fishSign*rules.swimSpeed*(round.behavior.accent?.swim||1)*
      (.75+force*.25)*(aligned?.42:opposed?1.2:1)):
      (.5-round.fishX)*.65+.027*Math.sin((next-Date.parse(round.hookedAt))/830+(round.motionSeed%71));
    // A successful upward counter briefly lifts a diving fish back toward
    // the surface. Lateral counters already slow the fish's sideways run.
    const depth=deep?(relief?.53:.76):{patient:.59,dart:.63,heavy:.7,weave:.66}[style];
    const vertical=surge?(depth-round.fishY)*(deep&&relief?2.2:1.7):(.56-round.fishY)*1.2;
    round.fishX=round4(clamp(round.fishX+speed*dt,.08,.92));
    round.fishY=round4(clamp(round.fishY+vertical*dt,.4,.75));
    round.fishVelocityX=round4(speed);round.fishVelocityY=round4(vertical);
    if(control.reeling) {
      round.reelHoldMs+=dt*1000;
      // A fish that draws directed runs most of the time must still be
      // catchable by following it and reeling on a one-second input cadence.
      const alignedGain=7.2+Math.max(0,round.behavior.directedFraction-.5)*4+
        gear*ROD_EFFECT_PER_LEVEL.reelGain;
      const gain=(surge?(aligned?alignedGain:.3):(rules.reelGain-force*.25+
        gear*ROD_EFFECT_PER_LEVEL.reelGain))*
        (accent?.grip||1)*(relief?1.2:1);
      const escape=(surge?surgePull*(aligned?.62:opposed?1.3:1.06):.5)*(relief?.65:1);
      round.distance=clamp(round.distance+(escape-gain*(round.powerMode?.30:1))*dt,0,100);
      if(round.powerMode)round.fishStamina=round4(Math.max(0,round.fishStamina-(surge&&!aligned?.35:1.35+gear*.12)*dt));
      // Holding the reel without a pause costs increasing strength. This
      // makes release a real choice even for a patient, easy-to-catch fish.
      const heldCost=clamp((round.reelHoldMs-2500)/1000*2,0,15);
      const drain=((surge?rules.reelDrain*force*(aligned?.72:opposed?1.28:1)+skill*.25-
        gear*ROD_EFFECT_PER_LEVEL.reelDrain:
        2.15+force*.4+skill*.2-gear*ROD_EFFECT_PER_LEVEL.reelDrain)*
        (accent?.fatigue||1)+heldCost)*(relief?.7:1);
      round.strength=clamp(round.strength-drain*(round.powerMode?1.9:1)*dt,0,round.maxStrength);
    }else{
      round.reelHoldMs=0;
      const escape=surge?surgePull*(paying?(aligned?.3:opposed?1.2:1):
        (aligned?.58:opposed?1.28:1.12)):(paying?.85:.6);
      round.distance=clamp(round.distance+Math.max(.08,escape-
        gear*ROD_EFFECT_PER_LEVEL.freeLineEscape)*dt,0,100);
      const restore=surge?(aligned?(paying?rules.recovery-force*.4:rules.recovery*.58):
        opposed?-(2+force*2.8):-(1+force*1.8)):(paying?10:8.6);
      round.strength=clamp(round.strength+(round.powerMode?Math.max(14,restore*2.1)+gear*ROD_EFFECT_PER_LEVEL.freeLineRecovery:restore+gear*ROD_EFFECT_PER_LEVEL.freeLineRecovery)*dt,
        0,round.maxStrength);
    }
    round.strength=round4(round.strength);round.distance=round4(round.distance);
    round.tension=round4(100-round.strength);
    cursor=next;round.lastSimAt=iso(cursor);
    if(round.flickCue&&cursor>=Date.parse(round.flickCue.until)){
      const outcome=resolveFlick(round,cursor,'miss');
      if(outcome)return outcome;
    }
    if(round.strength<=0)return 'line_snapped';
    if(round.distance<=0||round.powerMode&&round.fishStamina<=0)return 'landed';
    if(round.distance>=100)return 'escaped';
  }
  if(round.flickCue&&cursor>=Date.parse(round.flickCue.until)){
    const outcome=resolveFlick(round,cursor,'miss');
    if(outcome)return outcome;
  }
  if(round.flickTell&&cursor>=Date.parse(round.flickTell.until))revealFlickCue(round,cursor);
  if(cursor>=Date.parse(round.phaseUntil))advancePhase(round,skill,cursor);
  else if(round.nextTurnAt&&cursor>=Date.parse(round.nextTurnAt))turnFish(round,cursor);
  if(Number.isFinite(lease)&&end>=lease){round.control={reeling:false,steer:0};round.controlLeaseUntil=null;}
  if(requested>=deadline)return 'escaped';
  return null;
}

function control(round,now,reeling,steer,paying=false) {
  round.control={reeling,steer,...paying&&!reeling?{paying:true}:{}};
  round.controlLeaseUntil=iso(now.getTime()+CONTROL_LEASE_MS);
}

function displayIntensity(value,state) {
  // Show enough force contrast for the rod and line, while withholding the
  // source F coefficient and per-fish random multiplier until settlement.
  if(state!=='surge')return .12;
  return value<.55?.45:value<.85?.7:.95;
}

module.exports={create,cast,hook,simulate,control,flick,power,SPECIALS,observe,position,rodLevel,
  ROD_EFFECT_PER_LEVEL,
  ISO_BEHAVIOR_MODES,EXTRA_BEHAVIOR_MODES,
  castZoneForPower,castTargetForPower,displayIntensity,CONTROL_LEASE_MS,HOOK_WINDOW_MS,DURATION_MS,
  FLICK_WINDOW_MS,FLICK_TELL_MS,FLICK_MIN_SURGE_MS,FLICK_RELIEF_MS};
