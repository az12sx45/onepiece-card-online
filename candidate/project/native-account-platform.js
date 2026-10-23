'use strict';
const {Callable}=require('godot');
// Asynchronous, memory-only transport to the Android Keystore plugin.
exports.create=function(node){
 let sequence=0,disposed=false;const pending=new Map();
 const respond=(id,json)=>{const entry=pending.get(String(id));if(!entry)return;pending.delete(String(id));clearTimeout(entry.timer);let result;try{result=JSON.parse(json);}catch{result={ok:false,error:'invalid native session response'};}entry.resolve(result);};
 const callback=Callable.create(node,respond);node.connect('reply',callback);
 return {
  nativeCall(method,args={}){
   if(disposed)return Promise.resolve({ok:false,error:'native session transport disposed'});
   if(!['getNativeState','saveSession','clearSession'].includes(method))return Promise.resolve({ok:false,error:'unsupported native session request'});
   if(pending.size>=32)return Promise.resolve({ok:false,error:'native session queue full'});
   return new Promise(resolve=>{const id=String(++sequence),timer=setTimeout(()=>{pending.delete(id);resolve({ok:false,error:'native timeout'});},30000);pending.set(id,{resolve,timer});
    try{node.call('request',id,method,JSON.stringify(args));}catch{respond(id,'{"ok":false,"error":"native session request failed"}');}
   });
  },
  dispose(){if(disposed)return;disposed=true;node.disconnect('reply',callback);for(const entry of pending.values()){clearTimeout(entry.timer);entry.resolve({ok:false,error:'native session transport disposed'});}pending.clear();}
 };
};
