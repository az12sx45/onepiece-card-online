'use strict';
const original=require('./original-tot-stage'),Controls=require('./native-lineage-controls'),refNames=require('./tot-stage-refs.json'),classNames=new Set(require('./tot-stage-classes.json')),fx=require('./original-move-fx'),catalog=require('./original-fx-catalog');
exports.create=function({changed,effect=()=>{throw Error('Tot cinematic effects not connected');},timers={setTimeout,clearTimeout,setInterval,clearInterval},visualRandom}){
 const tree=Controls.create({changed,bounds(){throw Error('Tot stage has native geometry');}}),refs=Object.fromEntries(refNames.map(id=>[id,tree.addRoot('div',{id})]));
 for(const name of refNames)if(/^totMusica(?:Real|Song|Boss)Die[23]?$/.test(name)){const parent=tree.addRoot('div');parent.appendChild(refs[name]);refs[name].textContent='?';if(name.endsWith('Die'))parent.classList.add('is-visible');}
 let actors={},signature='',latest=null,visualSeed=(Date.now()^0x7f4a7c15)>>>0;
 const random=visualRandom||(()=>{visualSeed=(Math.imul(visualSeed,1664525)+1013904223)>>>0;return visualSeed/4294967296;});
 const carryNode=tree.addRoot('div'),carryLabel=actor=>{carryNode.innerHTML=api.carry(actor.carryItem);return carryNode.textContent.trim();};
 const worldName=world=>world==='real'?'Real':world==='song'?'Song':'Boss';
 function writeActor(actor,world){
  const boss=world==='boss',key=worldName(world),portrait=api.portrait(actor,boss&&Number(actor.currentHp??1)<=0?['dizzy','weak','hitEnemySide','hit','normal']:boss?['normal','idle','morale','angry']:['normal','idle','morale','angry','attack']);
  actors[world]={...actor,name:actor.actorName||actor.name||(boss?'Tot Musica':'船員'),carryLabel:boss?'':carryLabel(actor),frame:api.frame(actor.cosmeticFrameId||(boss?'postgameTotMusica':'')),portrait};
  refs['totMusica'+key+'Portrait'].src=portrait;
  const max=Math.max(1,Number(actor.maxHp||1)),current=Math.max(0,Math.min(max,Number(actor.currentHp||0)));
  refs['totMusica'+key+'HpText'].textContent='HP '+Math.round(current)+' / '+Math.round(max);refs['totMusica'+key+'HpFill'].style.width=String(Math.max(0,Math.min(100,current/max*100)))+'%';
  if(refs['totMusica'+key+'Move'])refs['totMusica'+key+'Move'].textContent=actor.moveName||'';
 }
 const anchor=node=>Object.entries(refs).find(([,value])=>value===node)?.[0]||'';
 const api=original.create({refs,setWorld:writeActor,setBoss:actor=>writeActor(actor,'boss'),...timers,visualRandom:random,showStatus(){},hooks:{
  clearDamageNumbers:()=>effect({type:'clear-numbers'}),playStageShake:()=>effect({type:'shake'}),playCastEffectSound:source=>effect({type:'cast-sound',source}),playHitEffectSound:source=>effect({type:'hit-sound',source}),
  moveFxSound(event,phase,fallback=''){const sound=fx.soundFor(catalog,event,phase);return sound===undefined?fallback:sound;},
  moveFxRuntime:()=>({warm:event=>effect({type:'warm',event}),play:(event,options)=>effect({type:'move',event,options:{...options,anchorElement:anchor(options.anchorElement)}})}),
  restartAnimation(node,name){node.classList.remove(name);node.classList.add(name);effect({type:'animation',anchor:anchor(node),name});},
  spawnBattleDamageNumber:value=>effect({type:'number',value:{...value,anchorElement:anchor(value.anchorElement)}}),renderPanel:()=>effect({type:'refresh-panel'})
 }});
 function refresh(view){latest=view;const next=JSON.stringify([view?.battle?.postgameBossMechanic,view?.battle?.canAct,view?.battle?.result,view?.battle?.canFinish,view?.enemy]);if(signature===next)return;signature=next;api.sync(view);}
 function project(){const c=refs.totMusicaDualFx.classList,active=refs.stage.classList.contains('tot-musica-battle-mode');const displayActors=Object.fromEntries(Object.entries(actors).map(([world,a])=>{const key=worldName(world),hp=refs['totMusica'+key+'HpText'].textContent.match(/^HP (\d+) \/ (\d+)$/);return [world,{...a,portrait:refs['totMusica'+key+'Portrait'].src,currentHp:hp?Number(hp[1]):a.currentHp,maxHp:hp?Number(hp[2]):a.maxHp}];}));return {visible:active&&c.contains('show'),classes:refs.totMusicaDualFx.className.split(/\s+/).filter(Boolean),stageClasses:refs.stage.className.split(/\s+/).filter(Boolean),preview:c.contains('boss-preview-open'),selection:c.contains('selection-preview'),setup:c.contains('team-setup-stage'),result:c.contains('battle-result-stage'),enemy:c.contains('enemy-present'),defeated:c.contains('boss-knockout-complete'),controlsHidden:refs.infoPanel.classList.contains('tot-musica-boss-preview-hidden'),actors:displayActors,toggleLabel:refs.totMusicaBossPreviewToggle.getAttribute('aria-label')||'',background:'images/board/battle/tot_musica_dual/tot_musica_vertical_world_background.webp'};}
 function trace(){const nodes={};for(const [key,node]of Object.entries(refs)){const entry={classes:node.className.split(/\s+/).filter(c=>classNames.has(c)).sort()};if(/(?:Die[23]?|Parity|Total|Result|Face|Value|Move|SideLabel|DiceLabel|HpText)$/.test(key))entry.text=node.textContent;if(key.endsWith('Portrait'))entry.src=node.src;if(key.endsWith('HpFill'))entry.width=node.style.width;if(/^totMusica(?:Real|Song|Boss)Die[23]?$/.test(key))entry.parentClasses=node.parentElement.className.split(/\s+/).filter(c=>classNames.has(c)).sort();nodes[key]=entry;}return {nodes,animationActive:api.animationActive()};}
 return {refresh,project(){return {...project(),cinematic:trace()};},trace,toggle(){api.toggle();changed();},play(event){api.play(event);changed();},presentation(active,awaiting=false){api.presentation(active,awaiting);if(!active&&!awaiting)api.sync(latest);changed();},dispose(){api.clear();tree.dispose();actors={};}};
};
