'use strict';
const Controls=require('./native-lineage-controls'),original=require('./original-boss-prompts');
const one=(root,selector)=>root?.querySelector(selector),all=(root,selector)=>root?.querySelectorAll(selector)||[],text=root=>String(root?.textContent||'').replace(/\s+/g,' ').trim(),value=(root,selector)=>text(one(root,selector)),image=root=>one(root,'img')?.src||'';
exports.create=function({changed,command}){
 let view=null,signature='',notice='';
 const tree=Controls.create({changed,bounds(){throw Error('Boss prompt has no browser geometry');},extraEvents:['dragstart','dragover','dragleave','drop']});
 const refs=Object.fromEntries(['actionPanel','infoPanel','infoTitle','infoContent'].map(id=>[id,tree.addRoot('div',{id})]));
 const api=original.create({refs,showStatus(message){notice=String(message);changed();},callBattleAction(method,type,payload){if(!view?.battle?.canControl)return false;return command({type,payload,method});}});
 function refresh(next){view=next;const prompt=view?.battle?.postgameBossMechanic?.prompt;
  const intro=view?.battle?.prebattleIntro;
  if(view?.battle?.judicialSwitchPrompt&&view.battle.canControl){const key=JSON.stringify(['judicial-switch',view.battle.judicialSwitchPrompt,view.battle.canControl]);if(signature===key)return;signature=key;notice='';api.render(view);return;}
  if(!prompt||!view.battle.canControl||intro&&!intro.done&&!view.battle.result){signature='';refs.infoContent.innerHTML='';return;}
  if(!['katakuri_future_sight','oars_lottery','oars_purification','tot_team_setup'].includes(prompt.type))throw Error('Unbound original boss prompt '+prompt.type);
  const key=JSON.stringify([view.battle.postgameBossMechanic,view.battle.animating,view.battle.roundIndex,view.player?.id]);if(signature===key)return;signature=key;notice='';api.render(view);
 }
 const control=node=>node?{uid:node.uid,disabled:node.disabled,label:text(node),image:image(node),dataset:{...node.dataset},classes:node.className.split(/\s+/).filter(Boolean)}:null;
 function project(){
  if(view?.battle?.judicialSwitchPrompt&&view.battle.canControl){
   const box=one(refs.infoContent,'.judicial-switch-box'),entries=all(refs.infoContent,'[data-judicial-switch-index]');
   if(!box&&!one(refs.infoContent,'.empty-state'))return {visible:false};
   return {visible:true,type:'judicial_switch',title:value(box,'.battle-result-title'),message:box?value(box,'.battle-result-reward-line'):value(refs.infoContent,'.empty-state'),frame:'images/board/battle_switch_ui/battle_switch_panel_frame.webp',controls:entries.map(control),choices:entries.map(n=>({...control(n),key:String(n.dataset.judicialSwitchIndex),name:value(n,'.choice-name'),detail:all(n,'.choice-meta').map(text).join('\n')}))};
  }
  const root=one(refs.infoContent,'section');if(!root)return {visible:false};
  const heading=one(root,'header'),type=view.battle.postgameBossMechanic.prompt.type;
  const model={visible:true,type,title:value(heading,'strong'),message:value(heading,'span'),notice,frame:one(root,'.battle-command-panel-frame')?.src||'',controls:all(root,'button').map(control)};
  if(type==='katakuri_future_sight'){model.heading=value(root,'.battle-command-notice-name');model.explanation=value(root,'.battle-command-notice-meta');model.choices=all(root,'[data-katakuri-choice]').map(n=>({...control(n),name:value(n,'.battle-command-choice-name'),description:value(n,'.battle-command-choice-meta')}));}
  else if(type==='oars_lottery'){model.groups=all(root,'.oars-lottery-group').map(group=>({name:value(group,'h3'),options:all(group,'.oars-lottery-choice').map(n=>({id:n.dataset.oarsPrediction,label:value(n,'span'),payout:value(n,'strong'),description:value(n,'small'),count:value(n,'output'),minus:control(one(n,'[data-oars-stake-minus]')),plus:control(one(n,'[data-oars-stake-plus]'))}))}));model.summary=value(root,'[data-oars-bet-summary]');model.confirm=control(one(root,'[data-oars-confirm-bets]'));}
  else if(type==='oars_purification'){const button=one(root,'[data-oars-purify]');model.action={...control(button),name:value(button,'strong'),description:value(button,'small')};}
  else if(type==='tot_team_setup'){model.lanes=all(root,'.tot-musica-team-lane').map(lane=>({label:value(one(lane,'header'),'strong'),subtitle:value(one(lane,'header'),'span'),slots:all(lane,'[data-tot-team-slot]').map(n=>({...control(n),key:n.dataset.totTeamWorld+':'+n.dataset.totTeamPosition,name:value(n,'strong'),order:value(n,'.tot-musica-team-order'),detail:value(n,'small'),empty:value(n,'.tot-musica-team-empty-copy')}))}));model.roster=all(one(root,'.tot-musica-team-roster'),'button').map(n=>({...control(n),key:'crew:'+n.dataset.totCrewIndex,name:value(n,'strong'),detail:value(n,'small')}));model.confirm=control(one(root,'[data-tot-team-confirm]'));}
  return model;
 }
 function input(uid,type='click',transfer=''){
  const values={dataTransfer:{getData:()=>String(transfer),setData(_type,value){transfer=String(value);},effectAllowed:''}};
  tree.dispatch(uid,type,values);return {transfer,mode:api.mode()};
 }
 return {refresh,project,input,tree,dispose(){tree.dispose();view=null;}};
};
