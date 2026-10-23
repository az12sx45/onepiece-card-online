'use strict';
require('./native-timers').install();
// Product adapter: no profiles, secrets, socket responses or storage fixtures.
exports.create=function({websocketPool,sessionNode,publish}){
 const subscribers=new Set();
 const transport=require('./native-websocket').install(websocketPool);
 const bridge=require('./native-account-platform').create(sessionNode);
 const io=require('./vendor/socket.io-4.8.1');
 const account=require('./original-account').create({
  nativeCall:bridge.nativeCall,publish(name,value){publish?.(name,value);for(const listener of [...subscribers])listener(name,value);},
  io(origin,options){
   if(origin!=='https://onepiece-card-online.onrender.com')throw Error('Unexpected account origin');
   return io(origin,{...options,transports:['websocket'],upgrade:false});
  }
 });
 let closed=false;
 return {
  authenticate:credentials=>account.authenticate(credentials),load:()=>account.load(),retry:()=>account.retry(),clear:()=>account.clear(),snapshot:()=>account.snapshot(),
  getSecret:()=>account.getSecret(),getSocket:()=>account.getSocket(),socialState:()=>account.socialState(),socialRequest:(action,payload)=>account.socialRequest(action,payload),
  subscribe(listener){if(closed)throw Error('Native account service disposed');subscribers.add(listener);return ()=>subscribers.delete(listener);},
  dispose(){if(closed)return;closed=true;account.dispose();for(const listener of [...subscribers])listener('state',account.snapshot());subscribers.clear();bridge.dispose();transport.dispose();}
 };
};
