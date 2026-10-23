'use strict';
const {Callable}=require('godot');
exports.project=function(core,ui){
 const refs=ui.refs,actions=new Map(),inputs=new Map();
 const control=id=>{const n=ui.nodes.get(id);if(!n)throw Error('Original lobby action missing '+id);actions.set(id,()=>n.click());return {key:id,label:n.caption?.trim()||n.textContent.trim(),disabled:n.disabled,visible:!n.hidden&&n.style.display!=='none',title:n.title};};
 const seats=refs.boardLobbyPlayerGrid.children.map((row,index)=>{const remove=row.querySelector('[data-remove-cpu]'),key=remove?'removeCpu:'+remove.dataset.removeCpu:'';if(remove)actions.set(key,()=>remove.click());return {key:String(core.state.lobby?.players[index]?.userId??'empty-'+index),name:row.querySelector('.seat-name')?.textContent.trim()||row.textContent.trim(),title:row.querySelector('.seat-title')?.textContent.trim()||'',tags:row.querySelectorAll('.seat-tag').map(n=>n.textContent.trim()),portrait:row.querySelector('img')?.src||'',remove:key,removeLabel:remove?.textContent.trim()||''};});
 const view=core.state.currentView;
 const keys=view==='lobby'?['leaveLobbyBtn','boardAddCpuBtn','boardReadyBtn','boardStartBtn','boardLobbySendChatBtn']:view==='modeSelect'?['backToHomeBtn','createBoardRoomBtn','joinBoardRoomBtn','refreshBoardRoomsBtn','toggleBoardRoomsBtn']:view==='home'?['openBoardFlowBtn','openCampaignsBtn','openSocialBtn','openPlayerProfileBtn']:view==='campaigns'?['backFromCampaignsBtn','refreshCampaignsBtn']:view==='social'?['backFromSocialBtn','openFriendDockBtn','refreshSocialBtn']:[];
 const model={view,profileOpen:!refs.accountProfileMenu.hidden,title:refs.boardLobbyRoomName.textContent,code:refs.boardLobbyRoomCode.textContent,count:refs.boardLobbyPlayerCount.textContent,player:{name:refs.playerNameDisplay.textContent,title:refs.playerTitle.textContent,coins:refs.playerCoin.textContent,portrait:refs.playerAvatar.src},seats,actions:keys.map(control),chat:refs.boardLobbyChatBox.children.map(row=>row.textContent.replace(/\s+/g,' ').trim()),roomCode:refs.roomCodeInput.value,chatInput:refs.boardLobbyChatInput.value,rooms:[]};
 if(model.profileOpen)model.actions.push(control('closePlayerProfileBtn'));
 // Runtime labels replace the static HTML caption after source state changes.
 for(const action of model.actions){const node=ui.nodes.get(action.key);if(!['openBoardFlowBtn','openCampaignsBtn','openSocialBtn','openPlayerProfileBtn'].includes(action.key))action.label=node.textContent.trim();}
 if(view==='modeSelect'&&core.state.roomListOpen)model.rooms=refs.boardRoomList.children.map((row,index)=>{const node=row.querySelector('.board-room-join'),room=core.state.rooms[index],key='joinRoom:'+room.roomId;actions.set(key,()=>node.click());return {key,title:row.querySelector('.board-room-name')?.textContent.trim()||'',host:row.querySelector('.board-room-host')?.textContent.trim()||'',code:room.roomId,count:row.querySelector('.board-room-meta')?.textContent.replace(/\s+/g,' ').trim()||'',disabled:node.disabled,label:node.textContent.trim()};});
 if(view==='campaigns')model.campaign=require('./native-campaign-scene').project(core,ui,actions,inputs);
 return {model,actions,inputs};
};
exports.bind=function(stage,core,ui){
 let pending=false,disposed=false,last='',commands=new Map(),inputs=new Map();
 const refresh=()=>{pending=false;if(disposed)return;const result=exports.project(core,ui);commands=result.actions;inputs=result.inputs;const json=JSON.stringify(result.model);if(json!==last){stage.call('apply_json',json);last=json;}};
 const schedule=()=>{if(pending||disposed)return;pending=true;setTimeout(refresh,0);};
 const command=Callable.create(stage,key=>{const action=commands.get(String(key));if(!action)throw Error('Native lobby action has no original handler '+key);action();schedule();});
 const input=Callable.create(stage,(key,value)=>{const node=inputs.get(String(key))||ui.nodes.get(String(key));if(!node)throw Error('Unknown lobby input '+key);node.value=String(value);node.dispatch('input');schedule();});
 stage.connect('command_requested',command);stage.connect('input_changed',input);
 return {schedule,refresh,dispose(){disposed=true;stage.disconnect('command_requested',command);stage.disconnect('input_changed',input);}};
};
