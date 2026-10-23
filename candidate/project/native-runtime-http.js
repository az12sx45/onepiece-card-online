'use strict';
const {Callable}=require('godot');
exports.create=function(node,origin='https://onepiece-card-online.onrender.com'){
 let sequence=0,disposed=false;const pending=new Map();
 const fail=message=>new Promise((_resolve,reject)=>setTimeout(()=>reject(Error(message)),0));
 const completed=Callable.create(node,(id,code,text,error)=>{const entry=pending.get(id);if(!entry)return;pending.delete(id);clearTimeout(entry.timer);if(error){setTimeout(()=>entry.reject(Error(error)),0);return;}entry.resolve({ok:code>=200&&code<300,status:code,json:async()=>JSON.parse(text)});});
 node.connect('completed',completed);
 return {fetch(path,options={}){
  if(disposed)return fail('Native runtime HTTP disposed');
  if(path!=='/api/board-runtime'||options.method&&options.method!=='GET')return fail('Native HTTP endpoint not implemented');
  return new Promise((resolve,reject)=>{const id=++sequence,timer=setTimeout(()=>{pending.delete(id);node.call('cancel',id);reject(Error('runtime_timeout'));},10000);pending.set(id,{resolve,reject,timer});node.call('read_runtime',id,origin+path);});
 },dispose(){if(disposed)return;disposed=true;node.disconnect('completed',completed);for(const [id,entry]of pending){clearTimeout(entry.timer);node.call('cancel',id);entry.reject(Error('Native runtime HTTP disposed'));}pending.clear();}};
};
