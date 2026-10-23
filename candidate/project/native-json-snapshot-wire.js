'use strict';
// createManualSavePayload already JSON-clones gameState, battleState and campaign
// context. Its remaining fields are primitive/null. Only that source producer
// may register a snapshot; this is not a validator for arbitrary caller data.
// The private queue does not modify it before the immediate synchronous send.
exports.create=function(){
 const fresh=new WeakSet(),stats={textPackets:0};
 function capture(snapshot){
  if(!snapshot||typeof snapshot!=='object')throw Error('Original snapshot required');
  fresh.add(snapshot);
  // A queued snapshot can outlive the current turn. It must then use the normal
  // parser, including its attachment scan, rather than retaining a stale proof.
  Promise.resolve().then(()=>fresh.delete(snapshot));
 }
 function emit(socket,event,...args){
  const envelope=args[0],encoder=socket.io?.encoder;
  if(event!=='BOARD_GAME_STATE'||!socket.connected||!fresh.has(envelope?.payload)||
    !encoder||typeof encoder.encodeAsString!=='function'||encoder.replacer!=null){
   return socket.emit(event,...args);
  }
  const original=encoder.encode;
  encoder.encode=function(packet){
   if(packet.type===2&&packet.data?.length===2&&packet.data[0]===event&&packet.data[1]===envelope){
    // Envelope fields are assembled by flushBoardLanPendingState, immediately
    // from source-owned scalars and this snapshot. Use the SAME upstream text
    // encoder, namespace, acknowledgement id and escaping.
    stats.textPackets++;
    return [encoder.encodeAsString(packet)];
   }
   return original.call(this,packet);
  };
  try{return socket.emit(event,...args);}
  finally{encoder.encode=original;}
 }
 return {capture,emit,stats};
};
