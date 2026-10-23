'use strict';
// Both product and QA use this composition. Disposing a scene must not resolve
// a pending awakening and let its old rule continuation mutate a departed game.
exports.create=function(application,document){
 const bridge=require('./native-nika-video-bridge').bind(application.get('nika_video'),document,application.get('nika_post'));
 let disposed=false;
 const cancelled=new Promise(()=>{});
 return {
  bind(api){
   const original=api.presentation.nikaWithDocument(bridge.document);
   return Object.fromEntries(Object.entries(original).map(([name,fn])=>[name,function(...args){
    if(disposed)return cancelled;
    return Promise.resolve(fn.apply(this,args)).then(
     value=>disposed?cancelled:value,
     error=>{if(disposed)return cancelled;throw error;}
    );
   }]));
  },
  stats:()=>bridge.stats(),
  dispose(){if(disposed)return;disposed=true;bridge.dispose();}
 };
};
