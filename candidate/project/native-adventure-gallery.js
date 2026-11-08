'use strict';

const FIELD='boardArtCollectionV1';
const keyFor=owner=>'op_board_art_collection_v1:'+owner;

exports.voyageRecords=function(players,{boardPlayerMatchesLocalUser,isCpuPlayer}){
 const player=players.find(candidate=>!isCpuPlayer(candidate)&&boardPlayerMatchesLocalUser(candidate));
 return player?.adventureArt;
};

exports.createVoyageMerger=function(collection){
 let previous;
 return function mergeVoyage({state,functions}){
  const records=exports.voyageRecords(state.gameState?.players||[],functions);
  if(records===previous)return;
  previous=records;
  collection.merge(records);
 };
};

exports.project=function(art,unlocked,syncStatus='local'){
 return {
  groups:Object.entries(art.groups).map(([id,label])=>({id,label})),
  unlockedCount:Object.keys(unlocked).length,
  syncStatus,
  entries:art.entries.map(({id,group,title,variant,image})=>({
   id,group,title,variant:variant+1,image:unlocked[id]?image:''
  }))
 };
};

// Same owner-scoped storage and stats-only patch as the desktop collection.
exports.createCollection=function(art,{identity,storage,socket,setTimer,clearTimer,changed}){
 let owner='',secret='',generation=0,disposed=false,flight=null,timer=null;
 let unlocked={},cloud={},lastSocketId=null,syncStatus='local',storageError=false;
 function cancelRetry(){if(timer!==null){clearTimer(timer);timer=null;}}
 function schedule(delay){if(disposed||timer!==null)return;timer=setTimer(()=>{timer=null;sync();},delay);}
 function selectOwner(){
  const profile=disposed?null:identity();
  const nextOwner=String(profile?.userId||''),nextSecret=String(profile?.secret||'');
  if(owner===nextOwner&&secret===nextSecret)return;
  cancelRetry();generation++;flight=null;owner=nextOwner;secret=nextSecret;
  unlocked={};cloud={};lastSocketId=null;syncStatus='local';storageError=false;
  if(!owner)return;
  try{unlocked=art.normalizeCollection(JSON.parse(storage.getItem(keyFor(owner))||'{}'));}
  catch(_){storageError=true;}
 }
 function mergeUnlocked(value){
  const next=art.mergeCollections(unlocked,value);
  if(Object.keys(next).every(id=>next[id]===unlocked[id]))return false;
  unlocked=next;
  try{storage.setItem(keyFor(owner),JSON.stringify(unlocked));storageError=false;}
  catch(_){storageError=true;}
  return true;
 }
 function merge(value){
  selectOwner();
  if(!owner)return;
  const added=mergeUnlocked(value);
  if(added){syncStatus='pending';changed();}
  if(added||syncStatus==='local')schedule(750);
 }
 function pending(){
  return Object.fromEntries(Object.entries(unlocked).filter(([id,at])=>!cloud[id]||at<cloud[id]));
 }
 function request(event,payload){
  return new Promise((resolve,reject)=>socket.timeout(8000).emit(event,payload,(error,result)=>{
   if(error)reject(error);
   else resolve(result);
  }));
 }
 function snapshot(){selectOwner();return {unlocked:{...unlocked},syncStatus:storageError&&syncStatus!=='saved'?'storage-error':syncStatus};}
 async function sync(force=false){
  selectOwner();
  if(!owner||!secret||flight)return;
  cancelRetry();
  if(!socket.connected){syncStatus=Object.keys(pending()).length?'pending':'local';changed();schedule(30000);return;}
  const token={generation,owner,secret,socketId:socket.id};
  flight=token;
  let retryDelay=30000;
  const stillCurrent=()=>{
   selectOwner();
   return !disposed&&flight===token&&token.generation===generation&&socket.connected&&socket.id===token.socketId;
  };
  function accept(response){
   const profile=response?.profile;
   if(!response?.ok||String(profile?.user_id??profile?.userId??'')!==token.owner)throw Error('Collection profile unavailable');
   cloud=art.normalizeCollection(profile.stats?.[FIELD]);
   mergeUnlocked(cloud);
   lastSocketId=token.socketId;
  }
  try{
   if(force||lastSocketId!==token.socketId||syncStatus!=='saved'){
    const response=await request('PROFILE_GET',{secret:token.secret});
    if(!stillCurrent())return;
    accept(response);changed();
   }
   const batch=pending();
   if(Object.keys(batch).length){
    const response=await request('PROFILE_UPDATE',{secret:token.secret,patch:{stats:{[FIELD]:batch}}});
    if(!stillCurrent())return;
    accept(response);
   }
   syncStatus=Object.keys(pending()).length?'pending':'saved';
   retryDelay=750;
  }catch(_){
   if(stillCurrent()){syncStatus='pending';lastSocketId=null;}
  }finally{
   if(flight===token){
    flight=null;
    changed();
    if(syncStatus!=='saved'||socket.id!==token.socketId)schedule(retryDelay);
   }
  }
 }
 const connected=()=>{
  lastSocketId=null;
  if(flight&&flight.socketId!==socket.id)flight=null;
  sync(true);
 };
 socket.on('connect',connected);
 return {merge,sync,snapshot,dispose(){
  if(disposed)return;
  disposed=true;cancelRetry();socket.off('connect',connected);
  flight=null;generation++;secret='';owner='';unlocked={};cloud={};
 }};
};
