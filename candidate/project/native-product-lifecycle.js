'use strict';
// Product startup ownership. The platform supplies the existing secure account,
// storage and native scene router; this module never creates a player or room.
exports.create=function({account,view,createSession,openFriends}){
 for(const key of ['loading','failure','returnToLauncher'])if(typeof view[key]!=='function')throw Error('Product view missing '+key);
 if(typeof createSession!=='function'||typeof openFriends!=='function')throw Error('Product services incomplete');
 let closed=false,epoch=0,session=null,loading=null,disposal=null;
 const identity=()=>{const s=account.snapshot();return s.authenticated&&Number.isSafeInteger(Number(s.account?.userId))&&Number(s.account.userId)>0?Number(s.account.userId):0;};
 async function release(){const old=session;session=null;if(old)await old.dispose();}
 function failure(kind){if(!closed)view.failure(kind);}
 const unsubscribe=account.subscribe((event)=>{
  if(closed||event!=='state'||!session||identity()===session.userId)return;
  ++epoch;view.loading();release().then(()=>failure('session-changed')).catch(()=>failure('session-changed'));
 });
 async function start(){
  if(closed)return false;if(loading)return loading;
  const token=++epoch;view.loading();
  loading=(async()=>{
   await release();
   try{
    await account.load();if(closed||token!==epoch)return false;
    const userId=identity();
    if(!userId){failure(account.snapshot().restorePending?'offline':'sign-in');return false;}
    const next=await createSession({account,userId,openFriends:()=>{if(!closed&&identity()===userId)return openFriends(account);}});
    if(closed||token!==epoch||identity()!==userId){await next.dispose();if(!closed&&token===epoch)failure('session-changed');return false;}
    session={...next,userId};await next.enter();
    if(closed||token!==epoch||identity()!==userId){await release();return false;}
    return true;
   }catch(error){await release();if(!closed&&token===epoch)failure(error.name==='NativeStorageError'?'storage':'unavailable');return false;}
  })();
  try{return await loading;}finally{loading=null;}
 }
 async function dispose(){
  if(disposal)return disposal;
  closed=true;++epoch;unsubscribe();
  // An in-flight mount is released by start before the services disappear.
  disposal=(async()=>{if(loading)await loading;await release();account.dispose();})();return disposal;
 }
 return {start,retry:start,current:()=>session,async leave(){await dispose();view.returnToLauncher();},dispose};
};
