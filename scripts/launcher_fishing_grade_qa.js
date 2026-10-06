'use strict';
const assert=require('node:assert/strict');
const V=require('../server/launcher-fishing-v5');
const M=require('../server/launcher-minigames');
const B=require('../server/launcher-fishing-balance');
let checks=0;const check=(name,ok)=>{assert(ok,name);checks++;};
const date=t=>new Date(t);
function round(id,level,seed=71){const r=V.create('grade',0,level,true);r.motionSeed=seed;V.cast(r,date(0),'lure','mid',{x:.66,y:.45});V.hook(r,date(4000),1,id);return r;}
for(const fish of M.FISH_SPECIES){const r=round(fish.id,0),tier=B.TIERS[M.FISH_RARITY_BY_ID[fish.id]];check(fish.id+' uses canonical grade',r.maxFishStamina===tier.hp&&r.fishTier===tier.level&&r.recommendedRodLevel===tier.rod);}
const weak=round('golden-whale',0),strong=round('golden-whale',3);
for(const r of [weak,strong]){r.distance=40;r.phaseUntil=date(10000).toISOString();r.runState='calm';r.flickTell=null;V.control(r,date(4000),true,0);V.simulate(r,date(5000),1);}
check('upgrading substantially raises real damage',1800-strong.fishStamina>20*(1800-weak.fishStamina));
check('upgrading actually counters fish pull',weak.distance>40&&strong.distance<40);
const ledger=round('golden-whale',3);ledger.distance=40;ledger.phaseUntil=date(12000).toISOString();ledger.runState='calm';ledger.flickTell=null;
V.control(ledger,date(4000),true,0);V.simulate(ledger,date(5100),1);V.control(ledger,date(5100),false,0);
const hp=ledger.fishStamina,events=ledger.damageEvents.length;
check('reel events equal actual spent HP',Math.abs(ledger.damageEvents.reduce((n,e)=>n+e.amount,0)-(1800-hp))<.001);
V.simulate(ledger,date(6100),1);check('release produces neither damage nor extra events',ledger.fishStamina===hp&&ledger.damageEvents.length===events);
ledger.powerCharge=6;V.power(ledger,date(6200),'special');for(const key of ledger.special.sequence.slice())V.power(ledger,date(6300),'specialKey',key);
check('special event is actual authoritative damage',ledger.damageEvents.at(-1).kind==='special'&&ledger.damageEvents.at(-1).amount===1100&&ledger.powerFeedback.damage===1100);
check('old active round retains 100 HP and old skill damage',(()=>{const r=round('golden-whale',0);delete r.battleVersion;V.hook(r,date(4000),1,'golden-whale');r.powerCharge=6;V.power(r,date(4100),'special');for(const key of r.special.sequence.slice())V.power(r,date(4200),'specialKey',key);return r.maxFishStamina===100&&r.fishStamina===45;})());
const results=[];
for(const fish of M.FISH_SPECIES){const required=B.TIERS[M.FISH_RARITY_BY_ID[fish.id]].rod;
 for(const seed of [52,71,97]){const r=round(fish.id,required,seed);let outcome=null,reeling=true;
  for(let at=4100;at<154000&&!outcome;at+=200){
   if(r.flickCue){const f=V.flick(r,date(at),r.flickCue.direction,r.flickCue.id);outcome=f.settlement;}
   if(r.powerCharge>=6&&!outcome){V.power(r,date(at),'special');for(const key of r.special.sequence.slice())outcome=V.power(r,date(at),'specialKey',key).settlement;}
   if(r.strength<30)reeling=false;else if(r.strength>75)reeling=true;
   V.control(r,date(at),reeling,r.pullDirection==='left'?-1:r.pullDirection==='right'?1:0);
   outcome=outcome||V.simulate(r,date(at+200),1);
  }
  results.push({species:fish.id,rod:required,seed,outcome});check(fish.id+' catchable at recommended rod seed '+seed,outcome==='landed');
 }
}
for(const id of ['burning-dragon','golden-whale','goliath-grouper','white-marlin']){const r=round(id,0);let outcome;for(let t=4100;t<154000&&!outcome;t+=200){if(r.flickCue)V.flick(r,date(t),r.flickCue.direction,r.flickCue.id);V.control(r,date(t),r.strength>35,r.pullDirection==='left'?-1:r.pullDirection==='right'?1:0);outcome=V.simulate(r,date(t+200),1);}check(id+' is beyond starter rod despite correct steering',outcome!=='landed');}
const session=M.create('fishing','room-character-luffy',1,date(0),false,'supply',5,'worm','shore',3,true);
M.answer(session,{roundId:session.challenge.id,counterMoves:['cast'],castPower:80},date(100));session.catchSpeciesId='golden-whale';M.answer(session,{roundId:session.challenge.id,counterMoves:['hook']},date(Date.parse(session.challenge.biteAt)+100));
const publicRound=M.view(session).challenge;check('real route exposes grade but no hidden species',publicRound.maxFishStamina===1800&&publicRound.fishTier===4&&!publicRound.behavior&&!M.view(session).catchSpeciesId&&!Object.hasOwn(publicRound,'damageSequence'));
console.log(JSON.stringify({status:'PASS',checks,results},null,2));
