'use strict';
const {Callable}=require('godot'),fx=require('./original-move-fx'),catalog=require('./original-fx-catalog');
class NativeTotStageBridge{
 constructor(stage){
  this.stage=stage;this.surface=stage.get('tot_stage');this.disposed=false;this.last='';this.queued=false;this.jobs=new Map();this.pending=null;this.playing=false;
  this.statuses=Object.fromEntries(['real','song','boss'].map(world=>[world,require('./original-status-controls').create({Controls:require('./native-lineage-controls')})]));
  const schedule=(fn,delay,interval,args)=>{let id;const callback=()=>{if(!interval)this.jobs.delete(id);try{fn(...args);this.flush();this.settle();}catch(error){this.fail(error);}};id=(interval?setInterval:setTimeout)(callback,delay);this.jobs.set(id,interval);return id;};
  const clear=id=>{if(this.jobs.has(id)){(this.jobs.get(id)?clearInterval:clearTimeout)(id);this.jobs.delete(id);}};
  this.controller=require('./native-tot-stage-controller').create({changed:()=>this.schedule(),effect:value=>this.effect(value),timers:{setTimeout:(fn,ms,...args)=>schedule(fn,ms,false,args),setInterval:(fn,ms,...args)=>schedule(fn,ms,true,args),clearTimeout:clear,clearInterval:clear}});
  this.callback=Callable.create(this.surface,()=>{this.controller.toggle();this.flush();});this.surface.connect('preview_requested',this.callback);
 }
 schedule(){if(this.disposed||this.queued)return;this.queued=true;Promise.resolve().then(()=>{this.queued=false;if(!this.disposed)this.flush();});}
 flush(){if(this.disposed)return;const packet=this.controller.project();for(const [world,actor]of Object.entries(packet.actors)){this.statuses[world].refresh(actor,world==='boss'?'enemy':'player',this.view);actor.statusIcons=this.statuses[world].project();}const json=JSON.stringify(packet);if(json!==this.last){this.last=json;this.surface.call('apply_source_json',json);}this.surface.call('sync_controls_visibility');}
 effect(value){this.flush();const packet={...value};if(value.event)packet.profile=fx.resolve(catalog,value.event)||{};this.surface.get('cinematic').call('effect_json',JSON.stringify(packet));}
 settle(){if(!this.pending||this.jobs.size)return;const entry=this.pending;this.pending=null;this.flush();entry.resolve();}
 fail(error){for(const [id,interval]of this.jobs)(interval?clearInterval:clearTimeout)(id);this.jobs.clear();const entry=this.pending;this.pending=null;if(entry)entry.reject(error);else throw error;}
 async play(event){
  if(this.disposed)throw Error('Tot stage is disposed');if(this.playing)throw Error('Concurrent Tot cinematic');
  this.playing=true;
  try{
  const cinematic=this.surface.get('cinematic'),plan=require('./native-tot-assets').prepare(event,this.view);
  cinematic.call('warm_json',JSON.stringify(plan));const deadline=Date.now()+15000;
  while(!cinematic.call('ready_assets')){if(Date.now()>deadline)throw Error('Original Tot cinematic assets unavailable');if(this.disposed)throw Error('Tot stage closed during warmup');await new Promise(resolve=>setTimeout(resolve,16));}
  return await new Promise((resolve,reject)=>{this.pending={resolve,reject};try{this.controller.play(event);this.flush();this.settle();}catch(error){this.fail(error);}});
  }finally{this.playing=false;}
 }
 refresh(view){this.view=view;this.controller.refresh(view);this.flush();}
 presentation(active,awaiting=false){this.controller.presentation(active,awaiting);this.flush();}
 dispose(){if(this.disposed)return;if(this.pending)this.fail(Error('Tot stage disposed during presentation'));this.disposed=true;this.surface.disconnect('preview_requested',this.callback);this.callback=null;this.controller.dispose();for(const status of Object.values(this.statuses))status.dispose();this.surface.call('apply_source_json','{"visible":false}');}
}
exports.NativeTotStageBridge=NativeTotStageBridge;
