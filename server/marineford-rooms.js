'use strict';
const crypto=require('node:crypto');
const engine=require('./marineford-engine');
// The existing SOCIAL_AUTH establishes identity. New protocol never accepts a
// client-supplied player index, hand, deck, winner or full-state replacement.
function attach(io,{identity=socket=>socket.data.socialProfile,clock=()=>Date.now(),cpuDelay=1000,gateTimeout=45000}={}){
 const rooms=new Map(),timers=new Set();
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);t.unref?.();timers.add(t);return t;};
 const profile=socket=>{const p=identity(socket);if(!p||!Number.isSafeInteger(p.userId)||p.userId<=0)throw Error('請先從啟動器登入');return p;};
 function roomOf(socket){const r=rooms.get(socket.data.marinefordRoom);if(!r)throw Error('尚未加入房間');return r;}
 function seat(r,socket){const p=profile(socket),i=r.seats.findIndex(s=>s.userId===p.userId);if(i<0)throw Error('沒有此房間席位');return i;}
 const connections=r=>[...io.sockets.sockets.values()].filter(s=>s.data.marinefordRoom===r.code);
 const lobby=r=>({code:r.code,host:r.host,navyId:r.navyId,started:!!r.state,seats:r.seats.map((p,id)=>({id,name:p.name,avatar:p.avatar,cpu:p.cpu,ready:p.ready,host:p.userId===r.host})),morale:r.morale});
 function broadcast(r,joining){for(const s of connections(r)){const id=seat(r,s);s.emit('MF_LOBBY',{...lobby(r),you:id});if(r.state&&(!r.gate||s===joining)){s.emit('MF_STATE',{view:engine.visible(r.state,id),you:id,sequence:r.sequence});}}}
 function release(r){r.gate=null;if(r.gateTimer){clearTimeout(r.gateTimer);timers.delete(r.gateTimer);r.gateTimer=null;}for(const s of connections(r))s.emit('MF_CAN_ACT',{sequence:r.sequence});schedule(r);}
 function schedule(r){if(r.cpuTimer||r.gate||!r.state||r.state.phase!=='playing')return;const id=r.state.pending?.owner??r.state.turn;if(!r.seats[id]?.cpu)return;r.cpuTimer=later(()=>{r.cpuTimer=null;const a=engine.cpuAction(engine.visible(r.state,id),id);if(a)act(r,id,a);},cpuDelay);}
 function act(r,id,action){
  if(r.gate)throw Error('等待所有玩家看完演出');const result=engine.apply(r.state,id,action);if(!result.ok)throw Error(result.error);r.state=result.state;r.touched=clock();r.sequence++;
  const clients=connections(r);r.gate=new Set(clients.map(s=>s.id));
  for(const socket of clients){const viewer=seat(r,socket);socket.emit('MF_PRESENT',{sequence:r.sequence,view:engine.visible(r.state,viewer),you:viewer,events:result.events.filter(e=>e.to==='all'||Array.isArray(e.to)&&e.to.includes(viewer)).map(({to,...event})=>event)});}
  if(!r.gate.size)release(r);else r.gateTimer=later(()=>{if(!rooms.has(r.code))return;for(const socket of connections(r))socket.emit('MF_RECOVER',{sequence:r.sequence,view:engine.visible(r.state,seat(r,socket)),you:seat(r,socket)});release(r);},gateTimeout);
 }
 function detach(socket){const r=rooms.get(socket.data.marinefordRoom);delete socket.data.marinefordRoom;if(!r)return;r.gate?.delete(socket.id);if(r.gate&&!r.gate.size)release(r);}
 io.on('connection',socket=>{
  const on=(name,handler)=>socket.on(name,(payload={},reply)=>{try{profile(socket);const now=clock();if(now-(socket.data.mfLastAction||0)<30&&name!=='MF_ACK')throw Error('請稍候再操作');if(name!=='MF_ACK')socket.data.mfLastAction=now;const result=handler(payload);reply?.({ok:true,...result});}catch(e){reply?.({ok:false,error:e.message});}});
  on('MF_LIST',()=>({rooms:[...rooms.values()].filter(r=>!r.state&&r.seats.length<6).map(lobby)}));
  on('MF_CREATE',payload=>{
   const p=profile(socket),existing=[...rooms.values()].find(r=>r.seats.some(s=>s.userId===p.userId)&&r.state?.phase==='playing');if(existing)throw Error('請先完成或返回既有對局 '+existing.code);
   for(const [code,r]of rooms)if(clock()-r.touched>2*60*60*1000&&!connections(r).length)rooms.delete(code);
   if(rooms.size>=100)throw Error('目前房間已滿');detach(socket);let code;do{code='M'+crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
   const r={code,host:p.userId,navyId:0,seats:[{userId:p.userId,name:String(p.name||'船長').slice(0,24),avatar:p.avatar,ready:true,cpu:false}],morale:payload.morale==='mandatory'?'mandatory':'optional',state:null,sequence:0,touched:clock()};rooms.set(code,r);socket.data.marinefordRoom=code;broadcast(r);return {code,you:0};
  });
  on('MF_JOIN',payload=>{const code=String(payload.code||'').toUpperCase(),r=rooms.get(code);if(!r)throw Error('找不到房間');const p=profile(socket);let id=r.seats.findIndex(s=>s.userId===p.userId);if(id<0){if(r.state||r.seats.length>=6)throw Error('房間已開始或已滿');id=r.seats.length;r.seats.push({userId:p.userId,name:String(p.name||'船員').slice(0,24),avatar:p.avatar,ready:false,cpu:false});}detach(socket);socket.data.marinefordRoom=code;r.touched=clock();broadcast(r,socket);schedule(r);return {code,you:id};});
  on('MF_READY',payload=>{const r=roomOf(socket),id=seat(r,socket);if(r.state)throw Error('對局已開始');r.seats[id].ready=payload.ready===true;broadcast(r);return {};});
  on('MF_CONFIG',payload=>{const r=roomOf(socket);if(profile(socket).userId!==r.host||r.state)throw Error('只有房主可設定');if(payload.addCpu){if(r.seats.length>=6)throw Error('最多六位');r.seats.push({userId:-(r.seats.length+1),name:'CPU '+r.seats.length,avatar:r.seats.length+1,ready:true,cpu:true});}if(Number.isInteger(payload.navyId)){if(!r.seats[payload.navyId])throw Error('席位無效');r.navyId=payload.navyId;}if(payload.removeCpu){const i=r.seats.findLastIndex(p=>p.cpu);if(i>=0){r.seats.splice(i,1);if(r.navyId>=r.seats.length)r.navyId=0;}}broadcast(r);return {};});
  on('MF_START',()=>{const r=roomOf(socket);if(profile(socket).userId!==r.host||r.state)throw Error('只有房主可以開始');if(r.seats.length<2||r.seats.some(p=>!p.ready))throw Error('等待至少兩位玩家準備');r.state=engine.create(r.seats,r.navyId,{morale:r.morale});broadcast(r);schedule(r);return {};});
  on('MF_ACTION',payload=>{const r=roomOf(socket),id=seat(r,socket);if(!r.state||payload.revision!==r.state.revision)throw Error('畫面已更新，請重新選擇');act(r,id,payload.action);return {};});
  on('MF_ACK',payload=>{const r=roomOf(socket);if(payload.sequence===r.sequence){r.gate?.delete(socket.id);if(r.gate&&!r.gate.size)release(r);}return {};});
  on('MF_CLOSE',()=>{const r=roomOf(socket);if(profile(socket).userId!==r.host)throw Error('只有房主可以結束本場');for(const key of ['gateTimer','cpuTimer'])if(r[key]){clearTimeout(r[key]);timers.delete(r[key]);r[key]=null;}for(const peer of connections(r)){delete peer.data.marinefordRoom;peer.emit('MF_CLOSED',{code:r.code});}rooms.delete(r.code);return {};});
  on('MF_LEAVE',()=>{const r=roomOf(socket),id=seat(r,socket);if(r.state?.phase==='playing')throw Error('對局中離開可關閉畫面，重新進入會保留席位');detach(socket);if(!r.state){r.seats.splice(id,1);if(!r.seats.some(p=>!p.cpu))rooms.delete(r.code);else{if(!r.seats.some(p=>p.userId===r.host))r.host=r.seats.find(p=>!p.cpu).userId;r.navyId=Math.min(r.navyId,r.seats.length-1);broadcast(r);}}return {};});
  socket.on('disconnect',()=>detach(socket));
 });
 return {rooms,close(){for(const t of timers)clearTimeout(t);timers.clear();rooms.clear();}};
}
module.exports={attach};
