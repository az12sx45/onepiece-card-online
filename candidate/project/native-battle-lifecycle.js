'use strict';
// Reconcile the persistent native surface with the source-owned lifetime.
// Never settle a battle or advance a turn here. A completed state can arrive
// without its earlier presentation callback (restore/handoff/background).
exports.create=function(core,scene){
 return function reconcile(){
  if(core.state.battleState||core.state.gameState?.battleExitLock||scene.closing||!scene.isOpen())return false;
  if(core.boardLan.awaitingInitialState||core.boardLan.applying||core.boardLan.pendingRemoteBattleViews.length)return false;
  if(core.functions.remoteBoardPlaybackBusy()||scene.hasPendingBattlePresentation())return false;
  core.functions.closeBattlePageOverlay();return true;
 };
};
