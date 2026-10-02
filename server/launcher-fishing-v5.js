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
const DURATION_MS = 90000;
const CONTROL_LEASE_MS = 2000;
const HOOK_WINDOW_MS = 4500;
const STEP_MS = 100;
const rodLevel = value => Number.isInteger(value)&&value>=0&&value<=3?value:0;

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
  'reef-shark':[[0,70,1400,2600,700],[1,30,1900,2300,800]]
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
  'smile-jellyfish':'patient','butterflyfish':'dart','cola-sunfish':'patient','reef-shark':'heavy'});
// These two ISO records are numerically identical. A small launcher-only
// movement accent makes their silhouette and pacing distinguishable without
// changing either fish's sourced force coefficient.
const PRESENTATION_ACCENTS = Object.freeze({
  'great-terigius':Object.freeze({duration:.94,swim:1.18}),
  'golden-whale':Object.freeze({duration:1.08,swim:.82})
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
    directedFraction:directedFraction(iso[1]),accent:PRESENTATION_ACCENTS[id]||null};
  const slots=EXTRA_BEHAVIOR_MODES[id]||[[0,65,1000,1800,700],[1,35,1000,1500,700]];
  return{style:EXTRA_STYLES[id]||'weave',source:'launcher',slots,
    directedFraction:directedFraction(slots)};
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

function create(id,issuedAt,equippedRodLevel=0) {
  return{id,fishingVersion:5,stage:'cast',castAt:null,castZone:null,castTarget:null,
    nibbleAt:null,biteAt:null,hookUntil:null,hookedAt:null,fightUntil:null,
    lastSimAt:iso(issuedAt),distance:100,strength:100,maxStrength:100,tension:0,pullIntensity:0,
    pullDirection:'steady',runState:'calm',fishX:.5,fishY:.57,fishVelocityX:0,fishVelocityY:0,
    motionSeed:crypto.randomInt(1,0x80000000),rodLevel:rodLevel(equippedRodLevel),motionStartedAt:null,
    phaseIndex:0,phaseUntil:null,nextTurnAt:null,turnsRemaining:0,behavior:null,reelHoldMs:0,
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
  const length=Math.max(1250,Math.round((mode?rules.surgeMs:rules.calmMs)*durationFactor*
    (round.behavior.accent?.duration||1)+
    (mode?skill*65:0)+wobble));
  round.runState=mode?'surge':'calm';
  const side=round.behavior.style==='heavy'?Math.floor(index/2):index;
  round.pullDirection=mode?((round.motionSeed+side)%2?'left':'right'):'steady';
  round.phaseUntil=iso(at+length);
  // The source picks a single lateral heading for each behavior slot. Keep
  // that heading until the next draw; extra launcher fish may still zigzag.
  const turns=round.behavior.source==='iso'?0:rules.turns;
  round.turnsRemaining=mode?turns:0;
  round.nextTurnAt=mode&&turns?iso(at+Math.round(length/(turns+1))):null;
  const pull=rules.surgeEscape*round.behavior.force;
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
  round.reelHoldMs=0;
  round.fishVelocityX=0;round.fishVelocityY=0;
}

function simulate(round,now,difficulty=1) {
  if(round.stage!=='fight')return null;
  const requested=now.getTime(),deadline=Date.parse(round.fightUntil),end=Math.min(requested,deadline);
  let cursor=Date.parse(round.lastSimAt);
  if(!Number.isFinite(cursor)||!Number.isFinite(end))return 'escaped';
  if(end<cursor)return null;
  const skill=clamp(difficulty,0,3),gear=rodLevel(round.rodLevel),lease=Date.parse(round.controlLeaseUntil);
  while(cursor<end) {
    if(cursor>=Date.parse(round.phaseUntil))advancePhase(round,skill,cursor);
    if(round.nextTurnAt&&cursor>=Date.parse(round.nextTurnAt))turnFish(round,cursor);
    const turnAt=round.nextTurnAt?Date.parse(round.nextTurnAt):Infinity;
    const next=Math.min(end,cursor+STEP_MS,Date.parse(round.phaseUntil),turnAt),dt=(next-cursor)/1000;
    if(next<=cursor)return 'escaped';
    const held=Number.isFinite(lease)&&cursor<lease;
    const control=held?round.control:{reeling:false,steer:0,paying:false};
    const surge=round.runState==='surge',fishSign=round.pullDirection==='left'?-1:round.pullDirection==='right'?1:0;
    const aligned=surge&&control.steer===fishSign,opposed=surge&&control.steer===-fishSign;
    const paying=control.paying===true&&!control.reeling;
    const {style,force}=round.behavior,rules=BEHAVIOR_STYLES[style],surgePull=rules.surgeEscape*force;
    const speed=surge?(fishSign*rules.swimSpeed*(round.behavior.accent?.swim||1)*
      (.75+force*.25)*(aligned?.42:opposed?1.2:1)):
      (.5-round.fishX)*.65+.027*Math.sin((next-Date.parse(round.hookedAt))/830+(round.motionSeed%71));
    const depth={patient:.59,dart:.63,heavy:.7,weave:.66}[style];
    const vertical=surge?(depth-round.fishY)*1.7:(.56-round.fishY)*1.2;
    round.fishX=round4(clamp(round.fishX+speed*dt,.08,.92));
    round.fishY=round4(clamp(round.fishY+vertical*dt,.4,.75));
    round.fishVelocityX=round4(speed);round.fishVelocityY=round4(vertical);
    if(control.reeling) {
      round.reelHoldMs+=dt*1000;
      // A fish that draws directed runs most of the time must still be
      // catchable by following it and reeling on a one-second input cadence.
      const alignedGain=7.2+Math.max(0,round.behavior.directedFraction-.5)*4+gear*.18;
      const gain=surge?(aligned?alignedGain:.3):(rules.reelGain-force*.25+gear*.28);
      const escape=surge?surgePull*(aligned?.62:opposed?1.3:1.06):.5;
      round.distance=clamp(round.distance+(escape-gain)*dt,0,100);
      // Holding the reel without a pause costs increasing strength. This
      // makes release a real choice even for a patient, easy-to-catch fish.
      const heldCost=clamp((round.reelHoldMs-2500)/1000*2,0,15);
      const drain=(surge?rules.reelDrain*force*(aligned?.72:opposed?1.28:1)+skill*.25-gear*.45:
        2.15+force*.4+skill*.2-gear*.25)+heldCost;
      round.strength=clamp(round.strength-drain*dt,0,round.maxStrength);
    }else{
      round.reelHoldMs=0;
      const escape=surge?surgePull*(paying?(aligned?.3:opposed?1.2:1):
        (aligned?.58:opposed?1.28:1.12)):(paying?.85:.6);
      round.distance=clamp(round.distance+Math.max(.08,escape-gear*.08)*dt,0,100);
      const restore=surge?(aligned?(paying?rules.recovery-force*.4:rules.recovery*.58):
        opposed?-(2+force*2.8):-(1+force*1.8)):(paying?10:8.6)+gear*.25;
      round.strength=clamp(round.strength+restore*dt,0,round.maxStrength);
    }
    round.strength=round4(round.strength);round.distance=round4(round.distance);
    round.tension=round4(100-round.strength);
    cursor=next;round.lastSimAt=iso(cursor);
    if(round.strength<=0)return 'line_snapped';
    if(round.distance<=0)return 'landed';
    if(round.distance>=100)return 'escaped';
  }
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

module.exports={create,cast,hook,simulate,control,observe,position,rodLevel,
  ISO_BEHAVIOR_MODES,EXTRA_BEHAVIOR_MODES,
  castZoneForPower,castTargetForPower,displayIntensity,CONTROL_LEASE_MS,HOOK_WINDOW_MS,DURATION_MS};
