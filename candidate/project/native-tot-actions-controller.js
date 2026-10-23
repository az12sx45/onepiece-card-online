'use strict';
const Controls=require('./native-lineage-controls'),original=require('./original-tot-actions');
const one=(n,s)=>n?.querySelector(s),all=(n,s)=>n?.querySelectorAll(s)||[],text=n=>String(n?.textContent||'').replace(/\s+/g,' ').trim();
exports.create=function({changed,command,timers={setTimeout,clearTimeout}}){
 let view=null,signature='',notice='',pending=null,accepted=false,lastEvent='';
 const tree=Controls.create({changed,bounds(){throw Error('Tot action control has no browser layout');}}),refs=Object.fromEntries(['actionPanel','infoPanel','infoTitle','infoContent'].map(id=>[id,tree.addRoot('div',{id})]));
 const api=original.create({refs,callBattleAction(method,type,payload={}){if(!view?.battle?.canControl)return false;return command({method,type,payload});},showStatus(value){notice=String(value);changed();},confirm(message){if(accepted){accepted=false;return true;}pending={message:String(message),uid:activeUid};changed();return false;},syncStage(){},...timers});
 let activeUid='';
 function refresh(next){view=next;const b=next?.battle,m=b?.postgameBossMechanic,intro=b?.prebattleIntro;
  if(!b?.canControl||m?.prompt||m?.key!=='postgame_tot_musica'||!m.state?.assigned||!b.canAct||b.result||b.canFinish||intro&&!intro.done){if(signature){api.dispose();refs.infoContent.innerHTML='';signature='';pending=null;}return;}
  const event=b.visualEvent;if(event?.type==='tot-musica-dual-sync'&&String(event.id)!==lastEvent){lastEvent=String(event.id);api.presentation(true);}else if(!b.animating)api.presentation(false);
  const key=JSON.stringify([b.round,b.roundIndex,m,b.animating,b.canAct,next.player?.battleItems]);if(key===signature)return;signature=key;api.render(next);
 }
 const control=n=>({uid:n.uid,disabled:n.disabled,label:text(n),dataset:{...n.dataset},classes:n.className.split(/\s+/).filter(Boolean),name:text(one(n,'strong'))||text(one(n,'span'))||text(n),detail:text(one(n,'small')),image:one(n,'.tot-musica-world-command-icon')?.src||one(n,'img')?.src||'',frame:one(n,'.tot-musica-world-command-frame')?.src||''});
 function project(){if(!signature)return {visible:false};const columns=all(refs.infoContent,'.postgame-world-column').map((column,index)=>{
  const world=index?'song':'real',context=api.context(world),heading=one(column,'header'),selected=one(column,'.tot-musica-world-selected'),mode=one(column,'.tot-musica-world-mode-head');
  const titleSpan=one(heading,'span'),title=titleSpan?.children.filter(n=>n.tag==='text').map(n=>n.textContent).join('')||'';
  return {world,title,subtitle:text(one(heading,'small')),actor:context?.card||{},frame:one(column,'.postgame-world-panel-frame')?.src||'',heading:text(one(mode,'b')),selectedTitle:text(one(selected,'strong')),selectedDetail:text(one(selected,'small')),empty:text(one(column,'.tot-musica-world-empty')),controls:all(column,'button').map(control)};
 });return {visible:true,columns,notice,awaiting:api.awaiting(),confirmation:pending?{message:pending.message}:null,controls:all(refs.infoContent,'button').map(control)};}
 function input(uid){activeUid=uid;tree.dispatch(uid,'click');activeUid='';}
 function answer(ok){const request=pending;pending=null;if(ok&&request&&tree.nodes.has(request.uid)){accepted=true;input(request.uid);accepted=false;}changed();}
 return {refresh,project,input,answer,tree,presentation(active){api.presentation(active);if(!active&&view)api.render(view);},dispose(){api.dispose();tree.dispose();view=null;signature='';}};
};
