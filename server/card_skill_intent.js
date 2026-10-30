'use strict';
const {_util:{cardById}}=require('./engine');
const ids={robin:2,sanji:3,zoro:5,law:6,nami:7,luffy:8,'luffy-boost':8,kaido:10,queen:12,killer:13,bigmom:14,'bigmom-coin':14,'kata-order':15,aokiji:16,'teach-multipick':17,roger:19};
// Public declaration only: never include hand/peek data, winning cards or results.
function intent(before,action,result){
 const events=result.emits||[],after=result.state,p=before.pending;
 if(events.some(e=>e.to==='all'&&e.type==='log'&&/【靜默】/.test(e.text||'')))return null;
 let cardId,casterId=before.turnIndex,targetId=null,mode='effect';
 if(action.type==='PLAY_CARD'){
  const play=events.find(e=>e.to==='all'&&e.type==='log'&&/ 打出 \d+｜/.test(e.text||''));
  if(!play||after.pending)return null;
  cardId=Number(play.text.match(/ 打出 (\d+)｜/)[1]);
 }else{
  if(!p||!Object.hasOwn(ids,p.action))return null;
  const changed=before.turnIndex!==after.turnIndex||JSON.stringify(p)!==JSON.stringify(after.pending)||events.some(e=>e.to==='all'&&e.type!=='toast');
  if(!changed)return null;
  cardId=ids[p.action];casterId=p.caster??before.turnIndex;
  if(action.type==='PICK_TARGET'||action.type==='LUFFY_SECOND'){
   const target=action.payload?.target;
   if(!Number.isInteger(target)||!before.players[target]?.alive)return null;
   targetId=target;
   mode=({robin:'view',sanji:'duel',zoro:'discard',law:'swap',nami:'paralyze',luffy:'duel',kaido:'duel',killer:'disarm',aokiji:'freeze',roger:'predict',bigmom:'demand'})[p.action]||'effect';
   if(p.action==='law'&&p.extra?.boost){
    if(action.payload?.preview===true)mode='view';
    else if(action.payload?.swap!==true){if(Number.isInteger(p.extra.previewTarget))return null;mode='view';}
   }
   if(p.action==='killer'&&action.payload?.duel===true)mode='duel';
  }else if(action.type==='QUEEN_COIN'){targetId=p.target;mode='coin';}
  else if(action.type==='BIGMOM_COIN')mode='coin';
  else if(action.type==='ORDER_COMMIT')mode='order';
  else if(action.type==='MULTIPICK_COMMIT')mode='cover';
  else if(action.type==='LUFFY_BOOST_COMMIT')mode='all-duel';
  else return null;
 }
 if(cardId===1)return null; // Existing Usopp number-specific declaration remains.
 const enhanced=before.venues.some(v=>v.name===cardById(cardId)?.venue);
 return {to:'all',type:'card_skill_intent',cardId,casterId,targetId,mode,enhanced};
}
function decorate(room,before,action,result){
 const events=result.emits||[];
 const play=events.find(e=>e.to==='all'&&e.type==='log'&&/ 打出 \d+｜/.test(e.text||''));
 if(play){
  room._deferredSkillMovies=null;
  if(result.state.pending){
   const movies=events.filter(e=>['enh_fx','play_fx'].includes(e.type));
   room._deferredSkillMovies={round:before.roundNo,caster:before.turnIndex,events:movies};
   result.emits=events.filter(e=>!['enh_fx','play_fx'].includes(e.type));
  }
 }
 const declaration=intent(before,action,result);
 // Usopp has an existing public guess event and dedicated cut-in.
 const resolvedGuess=result.emits?.some(e=>e.type==='card_guess');
 if(declaration||resolvedGuess){
  const held=room._deferredSkillMovies;
  if(held&&held.round===before.roundNo&&held.caster===before.turnIndex){
   result.emits.unshift(...held.events);room._deferredSkillMovies=null;
  }
  if(declaration)result.emits.unshift(declaration);
 }
 if(before.roundNo!==result.state.roundNo||(!result.state.pending&& !play))room._deferredSkillMovies=null;
 return result;
}
module.exports={intent,decorate};
