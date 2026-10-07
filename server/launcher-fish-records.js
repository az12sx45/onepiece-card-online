'use strict';
const crypto=require('node:crypto');
const SPOTS=new Set(['shore','reef','deep','freshwater','magma','rainbow']),BAITS=new Set(['worm','shrimp','lure']);
// Gameplay centimetre bands, not a claim about canonical biological sizes.
const SIZE_BANDS={
 'balloon-catfish':[15,65],'panda-shark':[80,320],'glistening-saury':[15,45],'smile-jellyfish':[8,35],
 butterflyfish:[5,22],'adventure-fish':[12,55],'cola-sunfish':[25,120],'reef-shark':[70,260],
 'elephant-tuna':[60,240],'lovely-angel':[8,35],'striped-clam':[3,18],'cutie-piranha':[10,42],
 'claw-shrimp':[5,30],'pumpkin-octopus':[20,110],'maple-salmon':[30,110],'lava-flounder':[20,85],
 'treasure-pearl-clam':[8,40],'electric-catfish':[25,140],'demon-bonito':[30,120],'guiding-anglerfish':[35,180],
 'ice-fish':[8,40],'beat-alligator':[140,650],'aurora-sunfish':[70,350],'burning-dragon':[400,2200],
 'great-terigius':[600,3500],'golden-whale':[1500,6000],'largemouth-bass':[20,75],warmouth:[8,30],
 'congo-bichir':[20,100],paddlefish:[70,200],'alligator-gar':[80,300],dolphinfish:[50,210],
 lionfish:[10,48],'dusky-grouper':[40,150],'goliath-grouper':[80,280],'white-marlin':[100,320]
};
function measuredLength(id){const [min,max]=SIZE_BANDS[id]||[10,80];return crypto.randomInt(min*10,max*10+1)/10;}
function evidence(fish,context={}){
 if(!fish||typeof fish!=='object')return null;
 return {lengthCm:Number.isFinite(fish.lengthCm)&&fish.lengthCm>0&&fish.lengthCm<=30000?Math.round(fish.lengthCm*10)/10:null,
   spotId:SPOTS.has(fish.spotId)?fish.spotId:SPOTS.has(context.spotId)?context.spotId:null,
   baitId:BAITS.has(fish.baitId)?fish.baitId:BAITS.has(context.baitId)?context.baitId:null,
   caughtAt:Number.isFinite(Date.parse(fish.caughtAt))?new Date(fish.caughtAt).toISOString():null};
}
function normalize(raw,ids){
 const output={};for(const id of ids){const r=raw?.[id];if(!r||typeof r!=='object')continue;
  const min=evidence(r.minCatch),max=evidence(r.maxCatch);
  output[id]={minCatch:min?.lengthCm?min:null,maxCatch:max?.lengthCm?max:null,
   catches:Number.isSafeInteger(r.catches)&&r.catches>=0?r.catches:0,
   grounds:(Array.isArray(r.grounds)?r.grounds:[]).filter(g=>SPOTS.has(g.spotId)&&BAITS.has(g.baitId)&&Number.isSafeInteger(g.count)&&g.count>0).slice(0,18).map(g=>({spotId:g.spotId,baitId:g.baitId,count:g.count}))};
 }return output;
}
function record(records,fish,context={}){
 if(!Object.hasOwn(SIZE_BANDS,fish?.speciesId))return;
 const v=evidence(fish,context),r=records[fish.speciesId]||={minCatch:null,maxCatch:null,catches:0,grounds:[]};
 r.catches=Math.min(2147483647,r.catches+1);
 if(v.lengthCm!==null){if(!r.minCatch||v.lengthCm<r.minCatch.lengthCm)r.minCatch={...v};if(!r.maxCatch||v.lengthCm>r.maxCatch.lengthCm)r.maxCatch={...v};}
 if(v.spotId&&v.baitId){let g=r.grounds.find(g=>g.spotId===v.spotId&&g.baitId===v.baitId);if(!g){g={spotId:v.spotId,baitId:v.baitId,count:0};r.grounds.push(g);}g.count=Math.min(2147483647,g.count+1);}
}
module.exports={measuredLength,evidence,normalize,record,SIZE_BANDS};
