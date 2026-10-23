'use strict';
// Plan only the original presentation's visible poses. Do not prefetch every
// art variant in a complete actor snapshot or compete with the texture budget.
exports.prepare=function(event,view,factory=require('./native-tot-stage-controller'),fx=require('./original-move-fx'),catalog=require('./original-fx-catalog')){
 const images=new Set(),profiles=new Map(),sounds=new Set(),jobs=new Map();let serial=0,time=0;
 const collect=()=>{for(const actor of Object.values(controller.project().actors)){if(actor.portrait)images.add(actor.portrait.split('?')[0]);for(const layer of Object.values(actor.frame?.layers||{}))images.add(layer.asset.split('?')[0]);}};
 const controller=factory.create({changed(){},effect(value){if(value.event){const profile=fx.resolve(catalog,value.event);if(profile)profiles.set(profile.sheet,profile);}if(value.source)sounds.add(value.source);},visualRandom:()=>.42,timers:{setTimeout(fn,ms,...args){const id=++serial;jobs.set(id,{id,at:time+ms,fn,args});return id;},clearTimeout:id=>jobs.delete(id),setInterval:()=>++serial,clearInterval(){}}});
 controller.refresh(view);controller.play(event);collect();let steps=0;
 while(jobs.size){if(++steps>100)throw Error('Tot warm plan did not settle');const job=[...jobs.values()].sort((a,b)=>a.at-b.at||a.id-b.id)[0];time=job.at;jobs.delete(job.id);job.fn(...job.args);collect();}
 controller.dispose();return {images:[...images],profiles:[...profiles.values()],sounds:[...sounds]};
};
