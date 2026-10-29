'use strict';
const model=require('./native-card-model');
exports.create=function({socket,secret,profile,view}){
  let room='',viewer=null,presented=null,wire=null,events=[],queue=[],active=null,serial=0,revision=0,held=false,disposed=false,local={},awaiting=false,phase='rooms';
  const listeners=[];
  let responseTimer=null;
  const clearWait=()=>{if(responseTimer!==null)clearTimeout(responseTimer);responseTimer=null;awaiting=false;};
  const on=(key,fn)=>{socket.on(key,fn);listeners.push([key,fn]);};
  const render=()=>view.render({phase,room,viewer,revision,state:presented,controls:model.controls(presented,viewer,local),busy:!!active||queue.length>0||awaiting,connected:socket.connected});
  function pump(){
    if(disposed||active||held)return;
    const tx=queue[0];
    if(!tx){render();return;}
    if(tx.steps.length){const step=tx.steps.shift();active={id:++serial,step};render();view.present(active.id,step);}
    else{presented=tx.state;revision++;queue.shift();if(!presented.pending||presented.pending.action!==local.action)local={};render();pump();}
  }
  function join(code,cpuCount=0){
    if(disposed||room||!socket.connected)return false;
    code=String(code).trim();if(!code||code.length>80)return false;
    room=code;phase='lobby';socket.emit('JOIN_ROOM',{roomId:room,displayName:profile.name,avatar:profile.avatar,secret,cpuCount:Math.max(0,Math.min(3,cpuCount)),wantNav:true});render();return true;
  }
  function done(id){if(disposed||active?.id!==id)return false;active=null;pump();return true;}
  on('JOINED',e=>{
    if(viewer!==null&&viewer!==e.playerId){view.cancel();held=false;queue=[];events=[];active=null;wire=null;presented=null;local={};awaiting=false;revision++;}
    viewer=e.playerId;render();
  });
  on('STATE',s=>{
    if(viewer===null||disposed)return;
    const next=model.project(s,viewer),batch=events;events=[];clearWait();
    const timeline=phase==='playing'?model.steps(wire,next,batch,viewer):[];
    wire=next;queue.push({state:next,steps:timeline});pump();
  });
  on('EMIT',e=>{
    if(disposed)return;
    if(e.type==='lobby'){view.lobby(e.lobby);return;}
    if(e.type==='nav_game'){phase='playing';render();return;}
    if(e.type==='lobby_kicked'){leave();view.notify('已離開等待室');return;}
    if(e.type==='law_view')local={action:'law',target:e.targetId,card:e.cardId};
    if(e.type==='killer_disarm'&&wire?.pending?.extra?.boost&&e.casterId===viewer)local={action:'killer',target:e.targetId};
    if(e.type==='toast'&&e.text){clearWait();view.notify(String(e.text));render();return;}
    events.push(e);
  });
  on('ROOM_LIST_UPDATE',r=>view.rooms(r.rooms||[]));
  on('ERROR',e=>{clearWait();view.notify(String(e.message||'操作失敗'));render();});
  on('disconnect',()=>{clearWait();render();});
  on('connect',()=>{
    // Cancel stale visuals before a reconnect snapshot. Do not replay an action.
    view.cancel();held=false;queue=[];events=[];active=null;wire=null;presented=null;awaiting=false;
    if(room)socket.emit('JOIN_ROOM',{roomId:room,displayName:profile.name,avatar:profile.avatar,secret,wantNav:true});
    else socket.emit('ROOM_LIST_GET',{},r=>view.rooms(r?.rooms||[]));render();
  });
  function send(type,payload={},top={}){
    if(disposed||viewer===null||!socket.connected||active||queue.length||awaiting||held)return false;
    const c=model.controls(presented,viewer,local);
    const lobby=['LOBBY_READY','LOBBY_UNREADY','START_GAME','LOBBY_CHAT','LOBBY_KICK'];
    let allowed=phase==='lobby'&&lobby.includes(type);
    if(c.options?.some(x=>x.type===type&&JSON.stringify(x.payload)===JSON.stringify(payload)))allowed=true;
    if(c.kind==='targets'&&type===c.type&&c.targets.includes(payload.target))allowed=true;
    if(c.kind==='order'&&type===c.type&&Array.isArray(payload.order)&&JSON.stringify([...payload.order].sort())===JSON.stringify([...c.cards].sort()))allowed=true;
    if(c.kind==='multi'&&type===c.type&&Array.isArray(payload.pickedIndices)&&new Set(payload.pickedIndices).size===payload.pickedIndices.length&&payload.pickedIndices.every(x=>Number.isInteger(x)&&x>=0&&x<c.cards.length))allowed=true;
    if(!allowed)return false;
    // Waiting room mutations answer with lobby rather than STATE.
    awaiting=!lobby.includes(type);
    if(awaiting)responseTimer=setTimeout(()=>{clearWait();if(disposed||!room)return;view.notify('連線回應逾時，正在重新取得牌局');socket.disconnect();socket.connect();},15000);
    socket.emit('ACTION',{roomId:room,playerId:viewer,secret,type,payload,...top});render();return true;
  }
  function rewardDone(roundNo){if(disposed||viewer===null)return;socket.emit('ACTION',{roomId:room,playerId:viewer,secret,type:'REWARD_DONE',payload:{roundNo}});}
  function leave(){
    clearWait();
    if(room)socket.emit('LEAVE_ROOM',{roomId:room,playerId:viewer,secret});
    view.cancel();held=false;room='';viewer=null;phase='rooms';queue=[];events=[];active=null;wire=null;presented=null;local={};awaiting=false;render();
  }
  socket.emit('ROOM_LIST_GET',{},r=>view.rooms(r?.rooms||[]));render();
  return {join,send,done,rewardDone,leave,finishRoom(){if(presented?.final&&!active&&!queue.length)socket.emit('ROOM_FINISHED',{roomId:room,secret});},reading(value){held=!!value;if(!held)pump();},snapshot:()=>({room,viewer,phase,presented,active,queued:queue.length,awaiting}),
    dispose(){if(disposed)return;leave();disposed=true;for(const [event,fn]of listeners)socket.off(event,fn);listeners.length=0;}};
};
