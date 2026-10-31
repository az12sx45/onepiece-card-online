'use strict';
// Room-only presentation barrier. No engine/save fields or private card data.
const {randomUUID} = require('node:crypto');
function begin(room) {
  room._presentationReady = {id:randomUUID(), roundNo:room.state.roundNo,
    required:room._cpuFastForward?[]:room.state.players.filter(p=>!p.isCPU).map(p=>p.id), ready:new Set(), released:false};
  return view(room);
}
function view(room) {
  const gate=room._presentationReady;
  if(!gate || gate.roundNo!==room.state?.roundNo) return null;
  // A disconnected human remains required during the existing reconnect grace.
  // Only the existing CPU takeover (or actual seat removal) releases their wait.
  const required=gate.required.filter(id=>room.state.players.some(p=>p.id===id&&!p.isCPU));
  const ready=required.filter(id=>gate.ready.has(id));
  if(ready.length===required.length) gate.released=true;
  return {id:gate.id,roundNo:gate.roundNo,waiting:!gate.released,required,ready};
}
function waiting(room) { return !!view(room)?.waiting; }
function acknowledge(room,playerId,payload) {
  const gate=room._presentationReady, status=view(room);
  if(!status?.waiting || payload?.id!==gate.id || payload?.roundNo!==gate.roundNo || !status.required.includes(playerId)) return false;
  gate.ready.add(playerId);view(room);return true;
}
module.exports={begin,view,waiting,acknowledge};
