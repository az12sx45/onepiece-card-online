'use strict';
// Snapshot application releases authority asynchronously, after the render
// that disabled commands. Reconcile only when that authority changes; the
// original function remains the sole owner of every command's disabled flag.
exports.create=function(core,refs={}){
 let previous=null;
 return function reconcile(){
  const lan=core.boardLan,f=core.functions,game=core.state.gameState,player=f.currentPlayer();
  // A whole snapshot can arrive and release applying between two frames.
  // Also observe flow/modal locks: CPU automation reads the original die flag.
  const next=[game,lan.enabled,lan.connected,lan.awaitingInitialState,lan.applying,
   f.remoteBoardPlaybackBusy(),f.localPlayerIsLobbyHost(),player?.id,
   game?f.isGameActionLocked():true,!!refs.modalBack?.classList.contains('open'),
   !!player?.pendingPostgameBossVoyage,player?.pendingIslandServiceChoice?.requiredEntry===true];
  if(previous&&next.every((value,index)=>value===previous[index]))return false;
  previous=next;f.syncTurnActionButtons();return true;
 };
};
