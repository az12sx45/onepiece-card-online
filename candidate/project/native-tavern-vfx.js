'use strict';
const {Callable,Time}=require('godot');
const source=require('./original-tavern-vfx');
const createPacket=require('./native-tavern-vfx-delta').createPacket;
exports.create=function(owner,options){
 const view=owner.view,container=options.container,dimensions=JSON.parse(view.call('fx_dimensions_json'));
 container.clientWidth=dimensions[0];container.clientHeight=dimensions[1];
 const model=source.create({container,overlay:owner.overlay,now:()=>Time.get_ticks_msec(),entropy:()=>{const buffer=new Uint32Array(1);if(!owner.window.crypto?.getRandomValues)throw Error('Native tavern VFX entropy must be connected');owner.window.crypto.getRandomValues(buffer);return buffer[0];}},options);
 let disposed=false,lastSize=dimensions.join(','),lastTick=0,totalUpdates=0,serializedCharacters=0;const work=[],intervals=[],pack=createPacket(),spikes=[];
 const render=()=>{
  const started=Time.get_ticks_usec(),frame=model.frame(),projected=Time.get_ticks_usec();
  const packet=pack(frame),updates=packet.nodes.length+packet.motion.length/9;
  totalUpdates+=updates;const selected=Time.get_ticks_usec(),json=updates?JSON.stringify(packet):'',serialized=Time.get_ticks_usec();serializedCharacters+=json.length;if(json)view.call('apply_fx_frame',json);
  return {projection:(projected-started)/1000,selection:(selected-projected)/1000,serialization:(serialized-selected)/1000,native:(Time.get_ticks_usec()-serialized)/1000};
 };
 const callback=Callable.create(owner.bridge.application,(delta,width,height)=>{
  const started=Time.get_ticks_usec();if(lastTick)intervals.push((started-lastTick)/1000);lastTick=started;
  if(disposed)return;const size=width+','+height;if(size!==lastSize){model.resize(width,height);lastSize=size;}
  model.tick(delta*1000);const calculated=Time.get_ticks_usec(),parts=render();const duration=(Time.get_ticks_usec()-started)/1000;work.push(duration);if(duration>20)spikes.push({stage:model.stats().stage,ms:duration,calculation:(calculated-started)/1000,...parts});
 });
 view.connect('vfx_frame',callback);view.call('set_fx_active',true);render();
 return {stage(name){if(!disposed){model.stage(name);render();}},stats:()=>model.stats(),setTimeScale:value=>model.setTimeScale(value),dispose(){if(disposed)return;disposed=true;const percentile=(array,p)=>{const values=[...array].sort((a,b)=>a-b);return values[Math.min(values.length-1,Math.floor(values.length*p))]||0;};(owner.vfxDiagnostics||(owner.vfxDiagnostics=[])).push({frames:work.length,totalUpdates,serializedCharacters,spikes,workP95Ms:percentile(work,.95),workMaxMs:percentile(work,1),intervalP95Ms:percentile(intervals,.95),renderer:JSON.parse(view.call('fx_stats_json'))});view.disconnect('vfx_frame',callback);view.call('set_fx_active',false);model.dispose();}};
};
