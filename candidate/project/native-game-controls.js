'use strict';
const {FileAccess}=require('godot');
exports.create=function(changed){
 const ui=require('./native-lobby-controls').create(JSON.parse(FileAccess.get_file_as_string('res://game-controls.json')),changed);
 for(const node of ui.nodes.values())node.style.setProperty=(key,value)=>{node.style[key]=String(value);changed();};
 // These desktop panels are hidden in the original mobile layout. Retain the
 // source descendants and action closures for avatar refresh and the drawer, without drawing
 // a second desktop header over the map.
 for(const [id,selector]of [['gamePlayerStrip','.mini-ava img'],['currentPlayerCard','.current-ava img']]){
  const node=ui.nodes.get(id),query=node.querySelectorAll.bind(node);
  node.querySelectorAll=value=>value===selector?node.querySelectorAll(selector.split(' ')[0]).flatMap(parent=>parent.querySelectorAll('img')):query(value);
 }
 const keys=['focusPlayerBtn','viewWholeMapBtn','quickVoyageBtn','cpuStrategyBtn','saveGameBtn','loadGameBtn','backToLobbyBtn'];
 const playerActions={'current:captain':'[data-select-captain]','current:passives':'[data-view-passives]'};
 ui.project=function(){
  const n=ui.refs,banner=n.mapTurnBanner,text=selector=>banner.querySelector(selector)?.textContent||'';
  return {open:!n.boardToolsPanel.hidden,turn:{name:text('.map-turn-name'),step:text('.map-turn-step'),kicker:text('.map-turn-kicker'),avatar:banner.querySelector('.map-turn-avatar')?.querySelector('img')?.getAttribute('src')||'',color:banner.style['--turn-color']||'#f3c25a'},status:n.voyageRecordStatus.textContent,
   actions:[...keys.map(key=>({key,label:n[key].textContent.trim(),disabled:n[key].disabled})),...Object.entries(playerActions).flatMap(([key,selector])=>{const node=n.currentPlayerCard.querySelector(selector);return node?[{key,label:node.textContent.trim(),disabled:node.disabled}]:[];})],cpu:{visible:!n.cpuSpeedControl.hidden,disabled:n.cpuSpeedSelect.disabled,value:n.cpuSpeedSelect.value,options:n.cpuSpeedSelect.options.map(o=>({label:o.textContent,value:o.value})),hint:n.cpuSpeedHint.textContent}};
 };
 ui.activate=function(key,value){
  if(Object.hasOwn(playerActions,key)){
   const node=ui.refs.currentPlayerCard.querySelector(playerActions[key]);if(!node)return false;
   const result=node.click();if(result)ui.refs.boardToolsPanel.hidden=true;return result;
  }
  if(!['boardToolsToggle','cpuSpeedSelect',...keys].includes(key))throw Error('Native toolbar action unknown '+key);
  if(key==='cpuSpeedSelect'){ui.refs[key].value=value;return ui.refs[key].dispatch('change');}
  const result=ui.refs[key].click();
  if(result&&key!=='boardToolsToggle'&&!['quickVoyageBtn','saveGameBtn'].includes(key))ui.refs.boardToolsPanel.hidden=true;
  return result;
 };
 return ui;
};
