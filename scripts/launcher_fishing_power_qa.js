'use strict';
const assert=require('node:assert/strict');
const v=require('../server/launcher-fishing-v5');
const M=require('../server/launcher-minigames');
const L=require('../server/launcher-life');
const d=t=>new Date(t);let checks=0;
function check(name,value){assert.ok(value,name);checks++;}
function round(species='glistening-saury',level=0){const r=v.create('power',0,level,true);r.motionSeed=71;v.cast(r,d(0),'lure','mid',{x:.66,y:.45});v.hook(r,d(4000),1,species);return r;}
const r=round();r.characterKey='ace';r.distance=60;r.strength=50;
check('burst requires three earned charges',v.power(r,d(4100),'burst').error==='fishing_power_not_ready');
for(let i=0;i<6;i++){r.flickCue={id:i+1,direction:'left',startedAt:d(4100+i*100).toISOString(),until:d(20000).toISOString()};v.flick(r,d(4200+i*100),'left',i+1);}
check('six successful counters bank six charges',r.powerCharge===6);
const before=r.fishStamina;v.power(r,d(5000),'special');
check('special consumes charge and creates six-key trial',r.powerCharge===0&&r.special.sequence.length===6);
const seq=r.special.sequence.slice();seq.forEach((key,i)=>v.power(r,d(5100+i*150),'specialKey',key));
check('successful trial deals large fish stamina damage',r.fishStamina<=before-55&&r.powerFeedback.type==='special');
check('Ace has his own cut-in technique',r.powerFeedback.theme==='flame'&&r.powerFeedback.name.includes('火拳'));
check('old key cannot repeat skill damage',v.power(r,d(7000),'specialKey','left').error==='fishing_special_expired');
r.powerCharge=3;r.distance=50;r.fishStamina=60;v.power(r,d(7100),'burst');
check('burst spends exactly three charges and pulls distance',r.powerCharge===0&&r.distance===35&&r.fishStamina===48);
const fail=round();fail.powerCharge=6;v.power(fail,d(4100),'special');const wrong=fail.special.sequence[0]==='left'?'right':'left';v.power(fail,d(4300),'specialKey',wrong);
check('wrong sequence cancels without damage',fail.special===null&&fail.fishStamina===100);
const frozen=round();frozen.powerCharge=6;v.power(frozen,d(4100),'special');const dist=frozen.distance;v.simulate(frozen,d(5000),1);
check('rhythm input freezes fish distance and line pressure',frozen.distance===dist&&frozen.strength===100);
v.simulate(frozen,d(12200),1);check('trial times out and resumes fight',!frozen.special&&frozen.powerFeedback.type==='miss');
const line=round();line.phaseUntil=d(20000).toISOString();line.runState='calm';line.flickTell=null;line.strength=70;v.control(line,d(4000),true,0);v.simulate(line,d(5000),1);const drain=70-line.strength;
check('normal reeling reduced below four distance units per second',line.distance>76);
check('line pressure depletes promptly',drain>4);
v.control(line,d(5000),false,0);v.simulate(line,d(6000),1);check('released line recovers over fourteen per second',line.strength>70+8);
const near=round();near.distance=0;near.fishStamina=40;near.phaseUntil=d(20000).toISOString();near.runState='calm';near.flickTell=null;v.control(near,d(4000),true,0);check('fish near shore is not caught while stamina remains',v.simulate(near,d(4100),1)!=='landed');near.fishStamina=0;near.distance=0;check('both stamina and distance exhausted lands fish',v.simulate(near,d(4200),1)==='landed');
const ids=['room-character-luffy','room-character-zoro'];const state=L.normalizeState({fishingRodLevel:2},ids,ids,d(0));check('legacy paid level preserved for both characters',state.fishingRodLevels[ids[0]]===2&&state.fishingRodLevels[ids[1]]===2);state.fishingRodLevels[ids[0]]=3;const saved=L.normalizeState(state,ids,ids,d(0));check('independent rod levels survive save normalization',saved.fishingRodLevels[ids[0]]===3&&saved.fishingRodLevels[ids[1]]===2);
for(const key of require('../server/launcher-crew-release').releasedKeys)check(key+' has unique skill',Boolean(v.SPECIALS[key]));
const results=[];
for(const fish of M.FISH_SPECIES){
 const f=round(fish.id,3);let result=null,cues=0,maxCharge=0;
 for(let at=4100;at<150000&&!result;at+=200){
  if(f.flickCue){v.flick(f,d(at),f.flickCue.direction,f.flickCue.id);cues++;maxCharge=Math.max(maxCharge,f.powerCharge);}
  if(f.powerCharge>=3&&f.fishStamina<25){const p=v.power(f,d(at),'burst');result=p.settlement;}
  v.control(f,d(at),f.strength>35,f.pullDirection==='left'?-1:f.pullDirection==='right'?1:0);result=result||v.simulate(f,d(at+200),1);
 }
 results.push({id:fish.id,result,cues,maxCharge});
 check(fish.id+' can be caught with pressure management',result==='landed');
}
console.log(JSON.stringify({status:'PASS',checks,results},null,2));
