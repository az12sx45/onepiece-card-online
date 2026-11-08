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
  // If a Judicial return missed its turn-start retries, re-arm on authority release.
  const actionLocked=!game||f.isGameActionLocked(),modalOpen=!!refs.modalBack?.classList.contains('open');
  const judicialReady=!!game&&!lan.applying&&!actionLocked&&!modalOpen&&!game.battleExitLock
   &&!player?.pendingPostgameBossVoyage&&player?.pendingIslandServiceChoice?.requiredEntry!==true
   &&(!player?.pendingBattle||player.pendingBattle.isJudicialRaid)
   &&f.canAutoOpenJudicialRaidForPlayer(player)&&f.canBoardLanControlCurrentPlayer(player);
  const judicialPlayer=judicialReady?player.id:null;
  const next=[game,lan.enabled,lan.connected,lan.awaitingInitialState,lan.applying,
   f.remoteBoardPlaybackBusy(),f.localPlayerIsLobbyHost(),player?.id,
   actionLocked,modalOpen,!!player?.pendingPostgameBossVoyage,
   player?.pendingIslandServiceChoice?.requiredEntry===true,judicialPlayer];
  if(previous&&next.every((value,index)=>value===previous[index]))return false;
  const resumeJudicial=judicialReady&&(!previous||previous[0]!==game||previous.at(-1)!==judicialPlayer);
  previous=next;f.syncTurnActionButtons();
  if(resumeJudicial)f.scheduleAutoResumeBattleForCurrentPlayer();
  return true;
 };
};
