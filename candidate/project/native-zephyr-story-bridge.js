'use strict';
const {Callable}=require('godot'),original=require('./original-zephyr-story');
class NativeZephyrStoryBridge{
 constructor(stage){
  this.stage=stage;this.surface=stage.get('zephyr_story');this.jobs=new Set();this.pending=null;this.disposed=false;this.last='';this.view=null;this.commands=0;this.flushes=0;
  this.controller=original.create({setTimeout:(fn,ms)=>{let id;id=setTimeout(()=>{this.jobs.delete(id);this.invoke(fn);},ms);this.jobs.add(id);return id;},clearTimeout:id=>{clearTimeout(id);this.jobs.delete(id);},preload:path=>this.surface.call('preload_asset',path),command:command=>{this.commands++;this.stage.emit_signal('command_json',JSON.stringify(command));return true;}});
  this.input=Callable.create(this.surface,()=>this.invoke(()=>this.controller.advance()));this.failure=Callable.create(this.surface,message=>this.fail(Error(String(message))));
  this.surface.connect('advance_requested',this.input);this.surface.connect('asset_error',this.failure);
 }
 invoke(fn){if(this.disposed)return;try{fn();this.flush();}catch(error){this.fail(error);}}
 flush(){
  if(this.disposed)return;const model=this.controller.snapshot(),json=JSON.stringify(model);
  if(this.last!==json){this.last=json;this.flushes++;this.surface.call('apply_source_json',json);}
  if(this.pending&&(!model.visible||model.eventId!==this.pending.id)){const p=this.pending;this.pending=null;p.resolve();}
 }
 refresh(view){this.view=view;this.invoke(()=>this.controller.refresh(view));}
 play(event){
  if(this.pending?.id===String(event.id))return this.pending.promise;
  if(this.pending){this.controller.close();this.flush();}
  let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});this.pending={id:String(event.id),promise,resolve,reject};
  this.invoke(()=>{if(!this.controller.play(event))throw Error('Original Zephyr story rejected event');});return promise;
 }
 close(){this.invoke(()=>this.controller.close());}
 fail(error){this.controller.close();for(const id of this.jobs)clearTimeout(id);this.jobs.clear();this.surface.call('close_surface');const p=this.pending;this.pending=null;if(p)p.reject(error);else throw error;}
 dispose(){if(this.disposed)return;this.close();this.disposed=true;for(const id of this.jobs)clearTimeout(id);this.jobs.clear();this.surface.disconnect('advance_requested',this.input);this.surface.disconnect('asset_error',this.failure);this.input=null;this.failure=null;this.controller=null;this.view=null;this.stage=null;this.surface=null;}
}
exports.NativeZephyrStoryBridge=NativeZephyrStoryBridge;
