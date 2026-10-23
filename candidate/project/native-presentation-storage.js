'use strict';
// The web battle iframe reads this live presentation mailbox. The native battle
// scene receives the same snapshot directly. Keep its localStorage API readable
// in memory without rewriting the durable save file for every animation frame.
exports.create=function(storage){
 let key=null,value=null;
 const adapter=new Proxy(storage,{get(target,name){
  if(name==='getItem')return input=>String(input)===key?value:target.getItem(input);
  if(name==='setItem')return (input,next)=>{if(String(input)===key)value=String(next);else target.setItem(input,next);};
  if(name==='removeItem')return input=>{if(String(input)===key)value=null;else target.removeItem(input);};
  if(name==='clear')return ()=>{target.clear();value=null;};
  if(name==='length')return target.length+(value!==null?1:0);
  if(name==='key')return index=>{index=Number(index)>>>0;return index===target.length&&value!==null?key:target.key(index);};
  const member=target[name];return typeof member==='function'?member.bind(target):member;
 }});
 return {storage:adapter,bind(sourceKey){
  if(key!==null||typeof sourceKey!=='string'||!sourceKey)throw Error('Original battle presentation key required');
  // The only retired disk entry is the exact presentation key exported by the
  // unchanged source. Saves, account data and all other keys remain durable.
  const prior=storage.getItem(sourceKey);if(prior!==null)storage.removeItem(sourceKey);
  key=sourceKey;value=prior;
 }};
};
