'use strict';

// Pure, clock-driven fishing simulation. The renderer predicts motion from
// motionSeed, while the server alone advances the fight and awards catches.
const crypto = require('node:crypto');
const iso = value => new Date(value).toISOString();
const clamp = (value,min,max) => Math.max(min,Math.min(max,value));
const DURATION_MS = 55000;
const CONTROL_LEASE_MS = 2000;
const HOOK_WINDOW_MS = 4500;
const rodLevel = value => Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0;

function position(seed,motionStartedAt,at) {
  const start=Date.parse(motionStartedAt);
  const t=Math.max(0,(at-start)/1000);
  const phase=(seed%6283)/1000;
  return {
    x:clamp(.5+.31*Math.sin(t*1.15+phase)+.09*Math.sin(t*2.2+phase*.37),.1,.9),
    y:clamp(.57+.13*Math.sin(t*.76+phase*1.7),.38,.78)
  };
}

function motionAt(round,at) {
  const here=position(round.motionSeed,round.motionStartedAt,at);
  const before=position(round.motionSeed,round.motionStartedAt,at-250);
  const dx=here.x-before.x,dy=here.y-before.y;
  return {...here,direction:here.y>.68&&dy>.008?'deep':dx>.022?'right':dx<-.022?'left':'steady'};
}

function paintMotion(round,at) {
  const motion=motionAt(round,at);
  round.fishX=Math.round(motion.x*10000)/10000;
  round.fishY=Math.round(motion.y*10000)/10000;
  round.pullDirection=motion.direction;
}

function observe(round,now) {
  const at=now.getTime();
  if(round.motionStartedAt)paintMotion(round,at);
  round.lastSimAt=iso(at);
}

function create(id,issuedAt,equippedRodLevel=0) {
  return {id,fishingVersion:4,stage:'cast',castAt:null,castZone:null,castTarget:null,
    nibbleAt:null,biteAt:null,hookUntil:null,hookedAt:null,fightUntil:null,
    lastSimAt:iso(issuedAt),distance:100,tension:10,pullDirection:'steady',
    fishX:.5,fishY:.57,motionSeed:crypto.randomInt(1,0x80000000),rodLevel:rodLevel(equippedRodLevel),
    motionStartedAt:null,control:{reeling:false,steer:0},controlLeaseUntil:null,
    showcaseMs:0,answerWindowMs:90000,notBefore:iso(issuedAt)};
}

function cast(round,now,baitId,castZone,castTarget) {
  const at=now.getTime(),baitWait={worm:3000,shrimp:2700,lure:2400}[baitId]??2700;
  const biteAt=at+baitWait+crypto.randomInt(0,1000);
  round.stage='wait';round.castAt=iso(at);round.castZone=castZone;
  round.castTarget={...castTarget};round.motionStartedAt=iso(at);
  round.nibbleAt=iso(biteAt-1150);round.biteAt=iso(biteAt);
  round.hookUntil=iso(biteAt+HOOK_WINDOW_MS);round.lastSimAt=iso(at);
  paintMotion(round,at);
}

function hook(round,now,difficulty=1) {
  const at=now.getTime();
  round.stage='fight';round.hookedAt=iso(at);round.fightUntil=iso(at+DURATION_MS);
  round.lastSimAt=iso(at);round.distance=73+clamp(difficulty,0,3)*4;
  round.tension=10;round.control={reeling:false,steer:0};
  round.controlLeaseUntil=null;paintMotion(round,at);
}

function simulate(round,now,difficulty=1) {
  if(round.stage!=='fight')return null;
  const deadline=Date.parse(round.fightUntil);
  const requested=now.getTime(),end=Math.min(requested,deadline);
  let cursor=Date.parse(round.lastSimAt);
  if(!Number.isFinite(cursor)||!Number.isFinite(end))return 'escaped';
  if(end<cursor)return null;
  const skill=clamp(difficulty,0,3),lease=Date.parse(round.controlLeaseUntil),gear=rodLevel(round.rodLevel);
  while(cursor<end) {
    const next=Math.min(end,cursor+100),dt=(next-cursor)/1000;
    const motion=motionAt(round,next),held=Number.isFinite(lease)&&cursor<lease;
    const control=held?round.control:{reeling:false,steer:0};
    const direction=motion.direction;
    const aligned=direction==='left'&&control.steer===1||direction==='right'&&control.steer===-1;
    const opposed=direction==='left'&&control.steer===-1||direction==='right'&&control.steer===1;
    const escape=.5+skill*.12+(direction==='deep'?.32:0);
    if(control.reeling){
      const reel=9.8-skill*.2+gear*.45+(aligned?1.1:0)-(opposed?1.2:0)-(direction==='deep'?.7:0);
      round.distance=clamp(round.distance-(reel-escape)*dt,0,100);
      round.tension=clamp(round.tension+(7+skill*.65-gear*.4+(direction==='deep'?1.4:0)+(opposed?3.5:0)-(aligned?3:0))*dt,0,100);
    }else{
      round.distance=clamp(round.distance+escape*dt,0,100);
      // A free fish still tugs the line. Slack relaxes toward that gentle
      // baseline instead of dropping to a lifeless zero.
      const resting=12+skill*1.5+(direction==='deep'?5:0);
      const difference=resting-round.tension;
      round.tension=clamp(round.tension+Math.sign(difference)*
        Math.min(Math.abs(difference),(16+(aligned?2:0)-(opposed?2:0))*dt),0,100);
    }
    cursor=next;round.lastSimAt=iso(cursor);
    if(round.tension>=100){paintMotion(round,cursor);return 'line_snapped';}
    if(round.distance<=0){paintMotion(round,cursor);return 'landed';}
  }
  if(Number.isFinite(lease)&&end>=lease){
    round.control={reeling:false,steer:0};
    round.controlLeaseUntil=null;
  }
  paintMotion(round,end);
  if(requested>=deadline)return 'escaped';
  return null;
}

function control(round,now,reeling,steer) {
  round.control={reeling,steer};
  round.controlLeaseUntil=iso(now.getTime()+CONTROL_LEASE_MS);
}

module.exports={create,cast,hook,simulate,control,observe,position,motionAt,rodLevel,
  CONTROL_LEASE_MS,HOOK_WINDOW_MS,DURATION_MS};
