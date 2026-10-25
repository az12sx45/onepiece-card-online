'use strict';
// LAN restoration may attempt to open a participant page during remote playback,
// when the original ownership checks deliberately reject input. Retry once on
// snapshot/authority changes, never every frame or by bypassing those checks.
exports.create=function(core,refs){
 let previous=null;
 return function reconcile(){
  const f=core.functions,lan=core.boardLan,s=core.state.gameState;
  if(!s)return false;
  const ready=!lan.enabled||(lan.connected&&!lan.awaitingInitialState&&!lan.applying&&!f.remoteBoardPlaybackBusy());
  const next=[s,ready,s.activeTrade,s.tradePrompt,s.coopBattlePrompt,s.activeSpar];
  if(previous&&next.every((value,index)=>value===previous[index]))return false;
  previous=next;
  if(!ready)return false;
  // These original schedulers determine the allowed participant and preserve
  // source invitations, offers, confirmation and co-op rules.
  if(s.activeTrade)f.scheduleActiveTradeModalForLocalPlayer();
  else if(s.tradePrompt&&!refs.modalBack.classList.contains('open')){
   const player=f.currentPlayer();
   if(String(s.tradePrompt.playerId)===String(player?.id)&&f.canBoardLanControlCurrentPlayer(player))f.openTradePromptModal(player);
  }
  if(s.coopBattlePrompt)f.scheduleCoopBattlePromptModalForLocalPlayer();
  if(s.activeSpar)f.scheduleActiveSparUiForLocalPlayer();
  return true;
 };
};
