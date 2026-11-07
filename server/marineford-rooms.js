'use strict';
const crypto=require('node:crypto');
const engine=require('./marineford-engine');
const records=require('./marineford-records');
const RULESET='20261106-kizaru-one';
const RULESET_UPDATE_ERROR='遊戲規則已更新，請返回啟動器更新《馬林福特之戰》後再進入。';
// The existing SOCIAL_AUTH establishes identity. New protocol never accepts a
// client-supplied player index, hand, deck, winner or full-state replacement.
function attach(io,{identity=socket=>socket.data.socialProfile,clock=()=>Date.now(),cpuDelay=1000,gateTimeout=120000,emptyRoomGraceMs=60000,recordMatch=null,getProfile=null}={}){
 const rooms=new Map(),timers=new Set();
 const later=(fn,ms)=>{const t=setTimeout(()=>{timers.delete(t);fn();},ms);t.unref?.();timers.add(t);return t;};
 const profile=socket=>{const p=identity(socket);if(!p||!Number.isSafeInteger(p.userId)||p.userId<=0)throw Error('請先從啟動器登入');return p;};
 function roomOf(socket){const r=rooms.get(socket.data.marinefordRoom);if(!r)throw Error('尚未加入房間');return r;}
 function seat(r,socket){const p=profile(socket),i=r.seats.findIndex(s=>s.userId===p.userId);if(i<0)throw Error('沒有此房間席位');return i;}
 const connections=r=>[...io.sockets.sockets.values()].filter(s=>s.connected===true&&s.data.marinefordRoom===r.code&&r.seats.some(p=>!p.cpu&&p.userId===identity(s)?.userId));
 const online=(r,id)=>connections(r).some(s=>s.connected!==false&&identity(s)?.userId===r.seats[id]?.userId);
 const hasHuman=r=>r.seats.some((p,id)=>!p.cpu&&online(r,id));
 const cpuControls=(r,id)=>!!r.seats[id]&&(r.seats[id].cpu||!online(r,id));
 function cancel(r,key){if(r[key]){clearTimeout(r[key]);timers.delete(r[key]);r[key]=null;}}
 function closeRoom(r){if(rooms.get(r.code)!==r)return;rooms.delete(r.code);for(const key of ['gateTimer','cpuTimer','emptyTimer'])cancel(r,key);r.gate=null;for(const peer of connections(r)){delete peer.data.marinefordRoom;peer.emit('MF_CLOSED',{code:r.code});}}
 function lifecycle(r){if(rooms.get(r.code)!==r)return;if(hasHuman(r)){cancel(r,'emptyTimer');r.emptyDeadline=null;}else if(!r.emptyTimer){r.emptyDeadline=clock()+emptyRoomGraceMs;r.emptyTimer=later(()=>{r.emptyTimer=null;if(rooms.get(r.code)!==r)return;if(!hasHuman(r))closeRoom(r);else r.emptyDeadline=null;},emptyRoomGraceMs);}schedule(r);}
 const lobby=r=>({code:r.code,host:r.host,navyId:r.navyId,started:!!r.state,seats:r.seats.map((p,id)=>({id,name:p.name,avatar:p.avatar,cpu:p.cpu,ready:p.ready,host:p.userId===r.host})),morale:r.morale});
 function broadcast(r,joining){for(const s of connections(r)){const id=seat(r,s),details=lobby(r);
  if(!r.state&&r.seats[id].userId===r.host)for(const [slot,member] of r.seats.entries()){
   if(!member.cpu&&member.userId!==r.host)details.seats[slot].kickToken=member.kickToken;
  }
  s.emit('MF_LOBBY',{...details,you:id,chat:r.state?[]:(r.chat||[])});if(r.state&&(!r.gate||s===joining)){s.emit('MF_STATE',{view:engine.visible(r.state,id),you:id,sequence:r.sequence});}}}
 function release(r){r.gate=null;if(r.gateTimer){clearTimeout(r.gateTimer);timers.delete(r.gateTimer);r.gateTimer=null;}for(const s of connections(r))s.emit('MF_CAN_ACT',{sequence:r.sequence});schedule(r);}
 function schedule(r){if(rooms.get(r.code)!==r||r.cpuTimer||r.gate||!r.state||r.state.phase!=='playing')return;const id=r.state.pending?.owner??r.state.turn,revision=r.state.revision;if(!cpuControls(r,id))return;r.cpuTimer=later(()=>{r.cpuTimer=null;if(rooms.get(r.code)!==r||r.gate||r.state?.phase!=='playing'||r.state.revision!==revision||(r.state.pending?.owner??r.state.turn)!==id||!cpuControls(r,id))return;try{const a=engine.cpuAction(engine.visible(r.state,id),id,Math.random,r.cpuKnowledge?.[id]);if(a)act(r,id,a);}catch(error){console.warn('[marineford-cpu]',error.message);}},cpuDelay);}
 function persist(r){if(!recordMatch||r.recorded||r.recording)return;const match=records.completed(r);if(!match)return;r.recordAttempts=(r.recordAttempts||0)+1;r.recording=Promise.resolve().then(()=>recordMatch(match)).then(()=>{r.recorded=true;for(const socket of connections(r))socket.emit('MF_RECORD',{ok:true});}).catch(error=>{console.warn('[marineford-record]',error.code||'record_unavailable');if(r.recordAttempts<3)later(()=>persist(r),5000);}).finally(()=>{r.recording=null;});}
 const eventsFor=(events,viewer)=>events.filter(e=>e.to==='all'||Array.isArray(e.to)&&e.to.includes(viewer));
 function act(r,id,action){
  if(r.gate)throw Error('等待所有玩家看完演出');const result=engine.apply(r.state,id,action);if(!result.ok)throw Error(result.error);cancel(r,'cpuTimer');r.state=result.state;
  r.cpuKnowledge=r.seats.map((_,viewer)=>engine.observeCpu(r.cpuKnowledge?.[viewer],engine.visible(r.state,viewer),viewer,eventsFor(result.events,viewer)));
  r.touched=clock();r.sequence++;if(r.state.phase==='ended')persist(r);
  const clients=connections(r);r.gate=new Set(clients.map(s=>s.id));
  for(const socket of clients){const viewer=seat(r,socket);socket.emit('MF_PRESENT',{sequence:r.sequence,view:engine.visible(r.state,viewer),you:viewer,events:eventsFor(result.events,viewer).map(({to,...event})=>event)});}
  if(!r.gate.size)release(r);else r.gateTimer=later(()=>{if(!rooms.has(r.code))return;for(const socket of connections(r))socket.emit('MF_RECOVER',{sequence:r.sequence,view:engine.visible(r.state,seat(r,socket)),you:seat(r,socket)});release(r);},gateTimeout);
 }
 function detach(socket){const r=rooms.get(socket.data.marinefordRoom);delete socket.data.marinefordRoom;if(!r)return;r.gate?.delete(socket.id);if(r.gate&&!r.gate.size)release(r);lifecycle(r);}
 io.on('connection',socket=>{
  const on=(name,handler)=>socket.on(name,async(payload={},reply)=>{try{profile(socket);if(socket.handshake?.auth?.marinefordRuleset!==RULESET)throw Error(RULESET_UPDATE_ERROR);const now=clock(),unthrottled=name==='MF_ACK'||name==='MF_RULES';if(now-(socket.data.mfLastAction||0)<30&&!unthrottled)throw Error('請稍候再操作');if(!unthrottled)socket.data.mfLastAction=now;const result=await handler(payload);reply?.({ok:true,...result});}catch(e){reply?.({ok:false,error:e.message});}});
  on('MF_RULES',()=>({ruleset:RULESET}));
  on('MF_PROFILE',async()=>{if(!getProfile)throw Error('戰績服務暫時無法使用');const r=rooms.get(socket.data.marinefordRoom);if(r?.recording)await r.recording;return {stats:await getProfile(profile(socket).userId),pending:!!r&&r.state?.phase==='ended'&&!r.recorded};});
  on('MF_LIST',()=>({rooms:[...rooms.values()].filter(r=>!r.state&&r.seats.length<6).map(lobby)}));
  on('MF_CREATE',payload=>{
   const p=profile(socket),existing=[...rooms.values()].find(r=>r.seats.some(s=>s.userId===p.userId)&&r.state?.phase==='playing');if(existing)throw Error('請先完成或返回既有對局 '+existing.code);
   for(const r of rooms.values())if(clock()-r.touched>2*60*60*1000&&!connections(r).length)closeRoom(r);
   if(rooms.size>=100)throw Error('目前房間已滿');detach(socket);let code;do{code='M'+crypto.randomBytes(3).toString('hex').toUpperCase();}while(rooms.has(code));
   const r={code,host:p.userId,navyId:0,seats:[{userId:p.userId,name:String(p.name||'船長').slice(0,24),avatar:p.avatar,ready:true,cpu:false,kickToken:crypto.randomUUID()}],morale:'mandatory',state:null,sequence:0,touched:clock()};
   const cpuCount=Number.isInteger(payload?.cpuCount)?Math.max(0,Math.min(5,payload.cpuCount)):0;
   for(let i=1;i<=cpuCount;i++)r.seats.push({userId:-(i+1),name:'CPU '+i,avatar:i+1,ready:true,cpu:true});
   rooms.set(code,r);socket.data.marinefordRoom=code;broadcast(r);return {code,you:0};
  });
  on('MF_JOIN',payload=>{const code=String(payload.code||'').toUpperCase(),r=rooms.get(code);if(!r)throw Error('找不到房間');const p=profile(socket);let id=r.seats.findIndex(s=>s.userId===p.userId);if(id<0){if(r.state||r.seats.length>=6)throw Error('房間已開始或已滿');id=r.seats.length;r.seats.push({userId:p.userId,name:String(p.name||'船員').slice(0,24),avatar:p.avatar,ready:false,cpu:false,kickToken:crypto.randomUUID()});}if(!r.seats.some(s=>s.userId===r.host)){r.host=p.userId;r.seats[id].ready=true;}detach(socket);socket.data.marinefordRoom=code;r.touched=clock();cancel(r,'cpuTimer');lifecycle(r);broadcast(r,socket);return {code,you:id};});
  on('MF_CHAT',payload=>{const r=roomOf(socket),id=seat(r,socket);if(r.state||id<0)throw Error('只能在等待室聊天');const body=typeof payload.body==='string'?payload.body.trim():'';if(!body||body.length>500)throw Error('訊息需為 1 至 500 字');const now=clock();if(socket.data.mfLastChat!=null&&now-socket.data.mfLastChat<750)throw Error('請稍候再傳');socket.data.mfLastChat=now;const message={code:r.code,name:r.seats[id].name,body};r.chat=[...(r.chat||[]),message].slice(-40);for(const client of connections(r))client.emit('MF_CHAT',message);return {};});
  on('MF_READY',payload=>{const r=roomOf(socket),id=seat(r,socket);if(r.state)throw Error('對局已開始');r.seats[id].ready=payload.ready===true;broadcast(r);return {};});
  on('MF_CONFIG',payload=>{const r=roomOf(socket);if(profile(socket).userId!==r.host||r.state)throw Error('只有房主可設定');if(payload.addCpu){if(r.seats.length>=6)throw Error('最多六位');const ordinal=[1,2,3,4,5].find(n=>!r.seats.some(p=>p.userId===-(n+1)));r.seats.push({userId:-(ordinal+1),name:'CPU '+ordinal,avatar:ordinal+1,ready:true,cpu:true});}if(Number.isInteger(payload.navyId)){if(!r.seats[payload.navyId])throw Error('席位無效');r.navyId=payload.navyId;}if(payload.removeCpu){const i=r.seats.findLastIndex(p=>p.cpu);if(i>=0){r.seats.splice(i,1);if(r.navyId===i)r.navyId=0;else if(r.navyId>i)r.navyId--;}}broadcast(r);return {};});
  on('MF_START',()=>{const r=roomOf(socket);if(profile(socket).userId!==r.host||r.state)throw Error('只有房主可以開始');if(r.seats.length<2||r.seats.some(p=>!p.ready))throw Error('等待至少兩位玩家準備');r.matchId=records.newId();r.state=engine.create(r.seats,r.navyId);broadcast(r);schedule(r);return {};});
  on('MF_ACTION',payload=>{const r=roomOf(socket),id=seat(r,socket);if(!r.state||payload.revision!==r.state.revision)throw Error('畫面已更新，請重新選擇');act(r,id,payload.action);return {};});
  on('MF_ACK',payload=>{const r=roomOf(socket);if(payload.sequence===r.sequence){r.gate?.delete(socket.id);if(r.gate&&!r.gate.size)release(r);}return {};});
  on('MF_CLOSE',()=>{const r=roomOf(socket);if(profile(socket).userId!==r.host)throw Error('只有房主可以結束本場');closeRoom(r);return {};});
  function removeWaitingPlayer(r,id,reason,origin){
   const userId=r.seats[id].userId;
   for(const peer of connections(r)){
    if(identity(peer)?.userId!==userId)continue;
    detach(peer);
    if(peer!==origin)peer.emit('MF_CLOSED',{code:r.code,reason});
   }
   r.seats.splice(id,1);
   if(r.navyId===id)r.navyId=0;
   else if(r.navyId>id)r.navyId--;
   if(r.host===userId)r.host=r.seats.find(p=>!p.cpu)?.userId;
   broadcast(r);
   lifecycle(r);
  }
  on('MF_KICK',payload=>{
   const r=roomOf(socket);
   if(r.state||profile(socket).userId!==r.host)throw Error('只有等待室房主可以移出玩家');
   const target=Number.isInteger(payload.slot)?r.seats[payload.slot]:null;
   if(!target||target.cpu||target.userId===r.host||typeof payload.kickToken!=='string'||target.kickToken!==payload.kickToken)throw Error('席位已變更，請重新選擇');
   removeWaitingPlayer(r,payload.slot,'已被房主移出等待室');
   return {};
  });
  on('MF_LEAVE',()=>{
   const r=roomOf(socket),id=seat(r,socket);
   if(r.state?.phase==='playing')throw Error('對局中離開可關閉畫面，重新進入會保留席位');
   if(r.state)detach(socket);
   else removeWaitingPlayer(r,id,'已離開等待室',socket);
   return {};
  });
  socket.on('disconnect',()=>detach(socket));
 });
 return {rooms,close(){for(const t of timers)clearTimeout(t);timers.clear();rooms.clear();}};
}
module.exports={attach,RULESET};
