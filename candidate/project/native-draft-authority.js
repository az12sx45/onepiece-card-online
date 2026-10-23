"use strict";
// Original markup captures the current authority in its click closures. Remote
// playback may release control after that markup was rendered as a spectator.
// Refresh only that stale setup page on an actual authority gain; retain source
// handlers, rolls, candidates and state. Never refresh active wheel animations.
exports.create=function(core,modal){
 let rendered=null;
 function capture(){
  const draft=modal.draft,player=core.functions.currentPlayer();
  rendered=draft&&core.state.gameState?.phase==='setup-draft'?{draft,playerId:player?.id,controlled:core.functions.canBoardLanControlCurrentPlayer(player)}:null;
 }
 function reconcile(){
  const f=core.functions,s=core.state.gameState,player=f.currentPlayer(),draft=modal.draft;
  if(!rendered||draft!==rendered.draft||s?.phase!=='setup-draft'||player?.id!==rendered.playerId||rendered.controlled||!f.canBoardLanControlCurrentPlayer(player))return false;
  const roll=player.recruitRolls[player.crew.length];
  if(draft.model.mode==='draft-mode-wheel'&&!roll&&!draft.nodes.has('recruitRollBtn')){rendered.controlled=true;f.renderRecruitRollModal(player);return true;}
  if(draft.model.mode==='draft-mode-pick'&&roll){rendered.controlled=true;f.renderDraftPickModal(player,roll);return true;}
  return false;
 }
 return {capture,reconcile};
};
