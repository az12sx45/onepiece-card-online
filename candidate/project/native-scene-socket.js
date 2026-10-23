'use strict';
// One route owns its callbacks, never the authenticated connection itself.
// In particular, an old lobby ACK must not navigate or replace stored room
// membership after the player has entered the game.
exports.create=function(realSocket){
 let disposed=false;const listeners=[];
 const guardReply=value=>typeof value==='function'?(...args)=>{if(!disposed)value(...args);}:value;
 let socket;socket=new Proxy(realSocket,{get(target,key){
  if(key==='connected')return !disposed&&target.connected;
  if(key==='on'||key==='once')return (event,fn)=>{
   if(disposed)throw Error('Native route socket disposed');
   const entry={event,fn,wrapped:null};entry.wrapped=(...args)=>{if(key==='once'){const index=listeners.indexOf(entry);if(index>=0)listeners.splice(index,1);}if(!disposed)fn(...args);};listeners.push(entry);target[key](event,entry.wrapped);return socket;
  };
  if(key==='off')return (event,fn)=>{for(let i=listeners.length-1;i>=0;i--){const item=listeners[i];if(item.event===event&&item.fn===fn){target.off(event,item.wrapped);listeners.splice(i,1);}}return socket;};
  if(key==='emit')return (event,...args)=>{if(disposed)return false;return target.emit(event,...args.map(guardReply));};
  if(key==='timeout')return ms=>({emit(event,...args){if(disposed)return false;return target.timeout(ms).emit(event,...args.map(guardReply));}});
  if(key==='disconnect'||key==='close')return ()=>{throw Error('A route cannot close the account connection');};
  const value=target[key];return typeof value==='function'?value.bind(target):value;
 }});
 return {socket,active:()=>!disposed,listenerCount:()=>listeners.length,dispose(){if(disposed)return;disposed=true;for(const {event,wrapped}of listeners)realSocket.off(event,wrapped);listeners.length=0;}};
};
