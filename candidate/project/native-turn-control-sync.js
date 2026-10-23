'use strict';
// Snapshot application releases authority asynchronously, after the render
// that disabled commands. Reconcile only when that authority changes; the
// original function remains the sole owner of every command's disabled flag.
exports.create=function(core){
 let previous=null;
 return function reconcile(){
  const lan=core.boardLan,f=core.functions;
  const next=[lan.enabled,lan.connected,lan.awaitingInitialState,lan.applying,
   f.remoteBoardPlaybackBusy(),f.localPlayerIsLobbyHost(),f.currentPlayer()?.id];
  if(previous&&next.every((value,index)=>value===previous[index]))return false;
  previous=next;f.syncTurnActionButtons();return true;
 };
};
