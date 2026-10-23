'use strict';
require('./native-timers').install();
const {Callable,Time}=require('godot');
// A game's callbacks belong to that scene, not to the account service or the
// next room. Disposing this scope cancels only the timers/listeners it created.
exports.create=function(parentWindow,search,navigate,pathname='/board_game.html',frameOwner=null){
 if(!['/board_game.html','/board_start.html'].includes(pathname))throw Error('Native scene path unavailable');
 const timers=new Map(),listeners=[],frames=new Map();let disposed=false,nextFrame=0;
 const measure=(label,callback)=>{const start=Time.get_ticks_usec();try{return callback();}finally{const ms=(Time.get_ticks_usec()-start)/1000;if(ms>=40&&frameOwner?.has_method('report_native_perf'))frameOwner.call('report_native_perf',label,ms);}};
 let frameCallback=frameOwner?Callable.create(frameOwner,()=>{const ready=[...frames];for(const [id]of ready)frames.delete(id);const now=Time.get_ticks_msec();for(const [,fn]of ready){if(disposed)break;fn(now);}}):null;
 if(frameCallback)frameOwner.get_tree().connect('process_frame',frameCallback);
 const guard=()=>{if(disposed)throw Error('Native game scope disposed');};
 const timer=(callback,delay,args,repeat)=>{guard();let id;const wrapped=()=>{if(disposed)return;if(!repeat)timers.delete(id);measure('timer:'+(callback.name||'anonymous')+':'+delay,()=>callback(...args));};id=(repeat?setInterval:setTimeout)(wrapped,delay);timers.set(id,repeat);return id;};
 const cancel=id=>{if(!timers.has(id))return;(timers.get(id)?clearInterval:clearTimeout)(id);timers.delete(id);};
 const location={origin:'https://onepiece-card-online.onrender.com',pathname,search};
 Object.defineProperty(location,'href',{get:()=>location.origin+location.pathname+location.search,set:value=>{guard();navigate(String(value));}});
 const window={...parentWindow,location,setTimeout:(fn,delay,...args)=>timer(fn,delay,args,false),setInterval:(fn,delay,...args)=>timer(fn,delay,args,true),clearTimeout:cancel,clearInterval:cancel,
  requestAnimationFrame:fn=>{guard();if(!frameOwner)return timer(()=>fn(Time.get_ticks_msec()),16,[],false);const id=--nextFrame;frames.set(id,fn);return id;},cancelAnimationFrame:id=>{if(frames.has(id))frames.delete(id);else cancel(id);},
  addEventListener(name,fn){guard();const wrapped=event=>{if(!disposed)fn(event);};listeners.push({name,fn,wrapped});parentWindow.addEventListener(name,wrapped);},
  removeEventListener(name,fn){for(let i=listeners.length-1;i>=0;i--){const entry=listeners[i];if(entry.name===name&&entry.fn===fn){parentWindow.removeEventListener(name,entry.wrapped);listeners.splice(i,1);}}}
 };
 window.top=window;window.self=window;
 return {window,measure,pendingCount:()=>timers.size+frames.size,dispose(){if(disposed)return;disposed=true;frames.clear();if(frameCallback)frameOwner.get_tree().disconnect('process_frame',frameCallback);frameCallback=null;for(const id of [...timers.keys()])cancel(id);for(const {name,wrapped}of listeners)parentWindow.removeEventListener(name,wrapped);listeners.length=0;}};
};
