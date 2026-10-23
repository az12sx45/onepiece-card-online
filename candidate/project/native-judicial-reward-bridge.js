'use strict';
const {Callable,Time}=require('godot');
const source=require('./original-judicial-reveal'),controls=require('./native-judicial-controls');
class NativeJudicialRewardBridge{
 constructor(stage,{window,channel,canControl}){
  this.surface=stage.get('judicial_reward');this.window=window;this.channel=channel;this.canControl=canControl;
  this.jobs=new Map();this.frames=new Map();this.sequence=0;this.connections=[];this.disposed=false;this.last='';this.phaseKey='';this.pending=null;
  this.previousParent=window.TabletopJudicialReward;this.previousChannel=new Map();
  const parentListeners=new Map(),childListeners=new Map();
  const listen=(map,name,fn)=>{const list=map.get(name)||[];list.push(fn);map.set(name,list);};
  this.emitChild=name=>{for(const fn of childListeners.get(name)||[])fn();};
  const parentProxy=new Proxy(window,{get:(target,key)=>key==='addEventListener'?(name,fn)=>listen(parentListeners,name,fn):target[key]});
  this.data=controls.create({height:()=>this.surface.call('reel_height'),capture:id=>this.surface.call('capture_pointer',id),release:id=>this.surface.call('release_pointer',id)});
  this.parentDocument={documentElement:{dataset:{platform:'android'}},hidden:false,getElementById:()=>null,addEventListener:(name,fn)=>listen(parentListeners,name,fn)};
  const clear=id=>{if(this.jobs.has(id)){(this.jobs.get(id)?clearInterval:clearTimeout)(id);this.jobs.delete(id);}};
  const schedule=(fn,delay,repeat)=>{let id;id=(repeat?setInterval:setTimeout)(()=>{if(!repeat)this.jobs.delete(id);if(!this.disposed)this.invoke(fn);},delay);this.jobs.set(id,repeat);return id;};
  const scheduler={performance:{now:()=>Time.get_ticks_msec()},setTimeout:(fn,ms)=>schedule(fn,ms,false),setInterval:(fn,ms)=>schedule(fn,ms,true),clearTimeout:clear,clearInterval:clear,requestAnimationFrame:fn=>{const id=++this.sequence;this.frames.set(id,fn);this.surface.call('request_frames',true);return id;},cancelAnimationFrame:id=>{this.frames.delete(id);this.surface.call('request_frames',this.frames.size>0);}};
  for(const [key,value]of Object.entries({parent:window,location:window.location,BoardAdventureArt:window.BoardAdventureArt,addEventListener:(name,fn)=>listen(childListeners,name,fn)})){this.previousChannel.set(key,{has:Object.hasOwn(channel,key),value:channel[key]});channel[key]=value;}
  this.previousChannel.set('TabletopJudicialReward',{has:Object.hasOwn(channel,'TabletopJudicialReward'),value:channel.TabletopJudicialReward});
  this.owner=source.install(parentProxy,this.parentDocument,scheduler);this.viewer=source.install(channel,this.data.document,scheduler);
  const connect=(name,fn)=>{const callback=Callable.create(this.surface,(...args)=>this.invoke(()=>fn(...args)));this.surface.connect(name,callback);this.connections.push({name,callback});};
  connect('control_requested',key=>this.data.press(key));
  connect('pointer_event',(kind,id,y,button)=>this.data.pointer(kind,{pointerId:id,clientY:y,button}));
  connect('frame_requested',now=>{const batch=[...this.frames];this.frames.clear();for(const [,fn]of batch)fn(now);this.surface.call('request_frames',this.frames.size>0);});
  connect('viewport_changed',()=>this.emitChild('resize'));
  connect('visibility_lost',()=>{this.data.visibility(true);this.parentDocument.hidden=true;for(const fn of parentListeners.get('visibilitychange')||[])fn();this.data.visibility(false);this.parentDocument.hidden=false;});
 }
 invoke(fn){if(this.disposed)return;try{fn();this.flush();}catch(error){this.fail(error);}}
 flush(){
  if(this.disposed)return;
  const active=this.viewer.snapshot().presentation,key=JSON.stringify([active?.eventId,active?.phase,active?.attached,active?.spectator]);
  // Physics only moves the native reel; no per-frame row traversal or JSON.
  if(key!==this.phaseKey){this.phaseKey=key;const model=this.data.project();delete model.offset;const json=JSON.stringify(model);if(json!==this.last){this.last=json;this.surface.call('apply_source_json',json);this.emitChild('resize');}}
  this.surface.call('set_reel_offset',Number(this.data.wheel.style.transform?.match(/^translateY\(([-+\d.eE]+)px\)$/)?.[1]||0));
  if(this.pending&&!this.viewer.isPresent(this.pending.id)){const pending=this.pending;this.pending=null;pending.resolve();}
 }
 play(event){
  if(this.disposed)return Promise.reject(Error('Judicial surface disposed'));
  if(this.pending){
   if(this.pending.id===String(event.id))return this.pending.promise;
   // Source present() replaces the previous visual. Restoring a paid battle can
   // first notify its saved event, then issue a fresh phone-resume event id.
   this.viewer.dismiss(this.pending.id);this.flush();
  }
  let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});this.pending={id:String(event.id),promise,resolve,reject};
  try{this.channel.BoardAdventureArt=this.window.BoardAdventureArt;if(!this.viewer.present(event,{canControl:this.canControl}))throw Error('Original Judicial presentation rejected event');this.flush();}catch(error){this.fail(error);}
  return promise;
 }
 wait(event,options){return this.owner.wait(event,options);}
 close(){if(this.disposed)return;this.invoke(()=>this.emitChild('pagehide'));this.owner.abort();this.flush();}
 fail(error){const pending=this.pending;this.pending=null;this.viewer?.abort();this.owner?.abort();this.frames.clear();for(const [id,repeat]of this.jobs)(repeat?clearInterval:clearTimeout)(id);this.jobs.clear();this.surface.call('close_surface');if(pending)pending.reject(error);else throw error;}
 dispose(){
  if(this.disposed)return;this.close();this.viewer.abort();this.owner.abort();this.disposed=true;
  for(const [id,repeat]of this.jobs)(repeat?clearInterval:clearTimeout)(id);this.jobs.clear();this.frames.clear();
  for(const {name,callback}of this.connections)this.surface.disconnect(name,callback);
  // Drop Callable wrappers after disconnect: each owns a JS closure retaining
  // this bridge. Keeping them forms native/JS reference cycles during teardown.
  this.connections.length=0;
  if(this.previousParent===undefined)delete this.window.TabletopJudicialReward;else this.window.TabletopJudicialReward=this.previousParent;
  for(const [key,previous]of this.previousChannel){if(previous.has)this.channel[key]=previous.value;else delete this.channel[key];}
  this.surface.call('close_surface');
  this.previousChannel.clear();this.previousParent=null;
  this.owner=null;this.viewer=null;this.data=null;this.parentDocument=null;
  this.emitChild=null;this.canControl=null;this.window=null;this.channel=null;this.surface=null;
 }
}
exports.NativeJudicialRewardBridge=NativeJudicialRewardBridge;
