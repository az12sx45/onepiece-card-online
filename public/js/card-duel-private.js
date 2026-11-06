/* Authenticated, event-only duel card projection. Never infer cards from STATE. */
(() => {
  'use strict';
  function mount(){
    const api=window.CardPhonePresentation;
    if(!api||api.duelPrivateVersion||typeof socket!=='object'||!socket.onAny)return;
    api.duelPrivateVersion=1;
    const records=new Map(),seen=new Map(),publicLogs=new Map(),issued=new WeakMap();
    let epoch=0;
    const validCard=id=>Number.isInteger(id)&&id>=0&&id<20;
    const viewer=()=>typeof me==='object'?me.playerId:null;
    const room=()=>typeof me==='object'?me.roomId:null;
    const validId=id=>typeof id==='string'&&id.length>0&&id.length<=100;
    function clear(){epoch++;records.clear();publicLogs.clear();}
    function receive(event,e){
      if(event!=='EMIT')return;
      if(e?.type==='duel_log'&&e.to==='all'&&validId(e.duelId)&&Number.isInteger(e.loserId)&&validCard(e.cardId)){
        const now=Date.now();
        for(const[key,record]of publicLogs)if(record.expires<=now||record.room!==room())publicLogs.delete(key);
        if(!publicLogs.has(e.duelId))publicLogs.set(e.duelId,{packet:{...e},room:room(),expires:now+300000});
        while(publicLogs.size>64)publicLogs.delete(publicLogs.keys().next().value);
        return;
      }
      if(e?.type!=='duel_private')return;
      const id=viewer();
      if(!Number.isInteger(id)||e.to!==id||![e.leftId,e.rightId].includes(id)||
        !Number.isInteger(e.leftId)||!Number.isInteger(e.rightId)||e.leftId===e.rightId||
        !validId(e.duelId)||!validCard(e.leftCardId)||!validCard(e.rightCardId))return;
      const now=Date.now();
      for(const[key,expires]of seen)if(expires<=now)seen.delete(key);
      if(seen.has(e.duelId))return;
      seen.set(e.duelId,now+300000);
      while(seen.size>512)seen.delete(seen.keys().next().value);
      for(const[key,record]of records)if(record.expires<=now||record.room!==room())records.delete(key);
      records.set(e.duelId,{room:room(),viewer:id,leftId:e.leftId,rightId:e.rightId,
        leftCardId:e.leftCardId,rightCardId:e.rightCardId,expires:now+300000});
      while(records.size>64)records.delete(records.keys().next().value);
    }
    api.prepareDuelDetails=function(duel,log){
      const result={...duel};
      delete result.privateCards;
      const previous=issued.get(duel);
      const same=previous&&previous.epoch===epoch&&previous.room===room()&&previous.viewer===viewer()&&
        previous.duelId===duel.duelId&&previous.leftId===duel.leftId&&previous.rightId===duel.rightId&&previous.expires>Date.now();
      const cachedLog=publicLogs.get(duel.duelId);
      const publicLog=log||(cachedLog?.room===room()&&cachedLog.expires>Date.now()?cachedLog.packet:null)||(same?previous.log:null);
      const matchingLog=publicLog?.type==='duel_log'&&
        (validId(duel.duelId)?publicLog.duelId===duel.duelId:!publicLog.duelId)&&
        [duel.leftId,duel.rightId].includes(publicLog.loserId)&&validCard(publicLog.cardId);
      if(matchingLog){
        result.loserSide=publicLog.loserId===duel.leftId?'left':'right';
        result.loserCardId=publicLog.cardId;
      }else if(validId(duel.duelId)||log){result.loserSide=null;result.loserCardId=undefined;}
      if(api.committingPresentation)return result;
      const record=same?previous:records.get(duel.duelId);
      if(!same)records.delete(duel.duelId);
      if(record&&(!same||previous.privateCards)&&record.expires>Date.now()&&record.room===room()&&record.viewer===viewer()&&
        record.leftId===duel.leftId&&record.rightId===duel.rightId&&[duel.leftId,duel.rightId].includes(viewer())){
        result.privateCards=same?{...previous.privateCards}:{[record.leftId]:record.leftCardId,[record.rightId]:record.rightCardId};
      }
      publicLogs.delete(duel.duelId);
      issued.set(result,{epoch,room:room(),viewer:viewer(),duelId:duel.duelId,leftId:duel.leftId,rightId:duel.rightId,
        expires:record?.expires||Date.now()+300000,privateCards:result.privateCards?{...result.privateCards}:undefined,log:matchingLog?{...publicLog}:null});
      return result;
    };
    // Installed native queues can invoke playDuel without the newer online batch
    // hook. Re-project there too, preserving only this bridge's issued objects.
    api.attachDuelDetails=duel=>api.prepareDuelDetails(duel);
    socket.onAny(receive);
    for(const event of ['disconnect','JOINED'])socket.on(event,clear);
    document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
    api.clearDuelPrivate=clear;
  }
  let bootTimer=null,attempts=0;
  function boot(){
    clearTimeout(bootTimer);mount();
    if(window.CardPhonePresentation?.duelPrivateVersion)return;
    if(++attempts<200)bootTimer=setTimeout(boot,50);
  }
  document.addEventListener('DOMContentLoaded',boot,{once:true});
  document.addEventListener('card:interface-ready',boot);
  boot();
})();
