'use strict';
const {Callable}=require('godot');
// Source media callbacks retain ownership of the 11.2 s watchdog, fade and
// rescue continuation. No simulated ended event or substitute movie is used.
exports.create=function(view){
 let node=null,started=false,fading=false,disposed=false,resolvePlay=null,rejectPlay=null;
 let callback=Callable.create(view,event=>{if(!node||disposed)return;const type=String(event);if(type==='playing'){resolvePlay?.();resolvePlay=null;rejectPlay=null;}if(type==='error'){rejectPlay?.(Error('Original native rescue video unavailable'));resolvePlay=null;rejectPlay=null;}if(['playing','loadedmetadata','ended','error'].includes(type))node.dispatch(type).catch(e=>console.error(e));});
 view.connect('media_event',callback);
 return {
  bind(target){
   if(node&&started)throw Error('Overlapping original Marineford movies');node=target;
   target.play=()=>{
    if(disposed||target!==node||target.src!=='images/board/marineford/props/haki/conqueror_intro.mp4')return Promise.reject(Error('Unknown source Marineford movie'));
    started=true;fading=false;
    return new Promise((resolve,reject)=>{resolvePlay=resolve;rejectPlay=reject;view.call('start_video',JSON.stringify({src:target.src,muted:!!target.muted,profile:'marineford'}));});
   };
   target.pause=()=>{if(target===node&&started)view.call('pause_video');};
   for(const key of ['duration','paused','ended','readyState'])Object.defineProperty(target,key,{get:()=>JSON.parse(view.call('media_state_json'))[key]});
   Object.defineProperty(target,'currentTime',{get:()=>JSON.parse(view.call('media_state_json')).currentTime,set:value=>{if(Number(value)!==0)throw Error('Unknown source rescue seek');}});
  },
  sync(document){
   if(disposed||!started)return;
   const layer=node?.closest('.conqueror-video-layer');
   if(!layer||!document.querySelector('.conqueror-video-layer')){view.call('remove_video');node=null;started=false;return;}
   if(layer.classList.contains('fade-out')&&!fading){fading=true;view.call('fade_out');}
  },
  dispose(){if(disposed)return;disposed=true;view.disconnect('media_event',callback);callback=null;if(started)view.call('remove_video');node=null;started=false;rejectPlay?.(Error('Native rescue movie closed'));resolvePlay=null;rejectPlay=null;}
 };
};
