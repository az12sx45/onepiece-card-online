// server/index.js — 靜態檔 + Socket.IO（/lobby 等待室 + / 遊戲本體）
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

// 引擎（請確認檔案在 server/engine.js）
const {
  createInitialState,
  applyAction,
  getVisibleState,
} = require("./engine.js");

// === HTTP 靜態檔 ===
const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (_req, res) => res.redirect("/start.html"));

const server = http.createServer(app);

// === Socket.IO（允許跨網域前端；正式上線請改成你的前端網域） ===
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// -------------------------------
// A. 等待室（/lobby）
// -------------------------------
const lobby = io.of("/lobby");
const roomsLobby = new Map(); // Map<roomId, { players: Map<sid,{pid,name,avatar,seat}>, hostSid, createdAt }>

function nextFreeSeat(room) {
  const used = new Set([...room.players.values()].map((p) => p.seat));
  let s = 0; while (used.has(s)) s++; return s;
}
function getLobbyRoom(roomId) {
  if (!roomsLobby.has(roomId)) roomsLobby.set(roomId, { players: new Map(), hostSid: null, createdAt: Date.now() });
  return roomsLobby.get(roomId);
}
function broadcastLobbyState(roomId) {
  const r = roomsLobby.get(roomId); if (!r) return;
  const players = [...r.players.entries()].map(([sid,p])=>({ sid, pid:p.pid, name:p.name, avatar:p.avatar, seat:p.seat, isHost:r.hostSid===sid }));
  lobby.to(roomId).emit("LOBBY_STATE", { roomId, players, hostSid:r.hostSid });
}

lobby.on("connection", (socket)=>{
  let joinedRoomId = null;

  socket.on("LOBBY_ENTER", ({roomId, pid, name, avatar})=>{
    if(!roomId || !pid) return;
    joinedRoomId = roomId;
    socket.join(roomId);
    const r = getLobbyRoom(roomId);
    if(!r.hostSid) r.hostSid = socket.id;
    const seat = nextFreeSeat(r);
    r.players.set(socket.id, { pid:String(pid), name:String(name||""), avatar:Number(avatar)||1, seat });
    broadcastLobbyState(roomId);
  });

  socket.on("LOBBY_READY", ({roomId})=>{
    if(!roomId) return; broadcastLobbyState(roomId);
  });

  socket.on("LOBBY_LEAVE", ({roomId})=>{
    const r = roomsLobby.get(roomId); if(!r) return;
    r.players.delete(socket.id);
    if(r.players.size===0){ roomsLobby.delete(roomId); }
    else if(r.hostSid===socket.id){ r.hostSid = r.players.keys().next().value || null; }
    broadcastLobbyState(roomId);
  });

  socket.on("LOBBY_START", ({roomId, serverURL})=>{
    const r = roomsLobby.get(roomId); if(!r) return;
    if(r.hostSid !== socket.id) return;
    for(const [sid,p] of r.players.entries()){
      lobby.to(sid).emit("LOBBY_NAV", { roomId, serverURL, name:p.name, avatar:p.avatar, seat:p.seat });
    }
    // roomsLobby.delete(roomId); // 如要開始後清掉等待室可開
  });

  socket.on("disconnect", ()=>{
    if(!joinedRoomId) return;
    const r = roomsLobby.get(joinedRoomId); if(!r) return;
    r.players.delete(socket.id);
    if(r.players.size===0){ roomsLobby.delete(joinedRoomId); }
    else if(r.hostSid===socket.id){ r.hostSid = r.players.keys().next().value || null; }
    broadcastLobbyState(joinedRoomId);
  });
});

// -------------------------------
// B. 遊戲本體（/）
// -------------------------------
const rooms = new Map(); // Map<roomId,{ state, maxPlayers, claims:boolean[], sockets:Map<sid,{playerId,secret}>, createdAt }>

function makeSecret(){ return crypto.randomBytes(12).toString("hex"); }

function broadcastState(roomId){
  const room = rooms.get(roomId); if(!room) return;
  const st = room.state;
  for(const [sid, meta] of room.sockets.entries()){
    const vis = getVisibleState(st, meta.playerId);
    io.to(sid).emit("STATE", vis);
  }
}

io.on("connection", (socket)=>{
  let joinedRoom = null;
  let myPlayerId = null;

  socket.on("JOIN_ROOM", ({ roomId, displayName, avatar, playerCount })=>{
    if(!roomId) return;

    if(!rooms.has(roomId)){
      const rLobby = roomsLobby.get(roomId);
      const n = (rLobby && rLobby.players.size) || Number(playerCount) || 4;
      const st = createInitialState(n);
      rooms.set(roomId, { state: st, maxPlayers:n, claims:Array(n).fill(false), sockets:new Map(), createdAt:Date.now() });

      if(rLobby){
        for(const p of rLobby.players.values()){
          const seat = Math.min(Math.max(0, Number(p.seat)||0), n-1);
          st.players[seat].displayName = p.name || st.players[seat].displayName;
          st.players[seat].avatar = Number(p.avatar) || st.players[seat].avatar;
          st.players[seat].client = { displayName: st.players[seat].displayName, avatar: st.players[seat].avatar };
        }
      }
    }

    const room = rooms.get(roomId); if(!room) return;

    let pid = room.claims.findIndex(v=>!v);
    if(pid===-1){ socket.emit("ERROR",{message:"Room is full"}); return; }

    room.claims[pid] = true;
    joinedRoom = roomId;
    myPlayerId = pid;

    try{
      const p = room.state.players[pid];
      if(displayName) p.displayName = String(displayName);
      if(avatar!=null) p.avatar = Number(avatar) || p.avatar;
      p.client = { displayName: p.displayName, avatar: p.avatar };
    }catch(_){}

    const secret = makeSecret();
    room.sockets.set(socket.id, { playerId: pid, secret });
    socket.emit("JOINED", { playerId: pid, secret });

    broadcastState(roomId);
  });

  socket.on("ACTION", ({ type, roomId, playerId, payload, secret })=>{
    const room = rooms.get(roomId); if(!room) return;
    const meta = room.sockets.get(socket.id); if(!meta) return;
    if(meta.playerId !== Number(playerId)) return;
    if(meta.secret !== String(secret||"")) return;

    const action = { type:String(type), roomId, playerId:meta.playerId, payload: payload||{} };
    const { state:newState, emits } = applyAction(room.state, action);
    room.state = newState;

    if(Array.isArray(emits)){
      for(const e of emits){
        if(!e) continue;
        if(e.to==="all"){
          io.to([...room.sockets.keys()]).emit("EMIT", e);
        } else if(typeof e.to==="number"){
          for(const [sid,m] of room.sockets.entries()){
            if(m.playerId===e.to){ io.to(sid).emit("EMIT", e); }
          }
        }
      }
    }
    broadcastState(roomId);
  });

  socket.on("disconnect", ()=>{
    if(!joinedRoom) return;
    const room = rooms.get(joinedRoom); if(!room) return;
    const meta = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);
    if(meta && typeof meta.playerId==="number"){ room.claims[meta.playerId] = false; }

    if(room.sockets.size===0){
      const TTL = 30*60*1000;
      if(Date.now() - room.createdAt > TTL){ rooms.delete(joinedRoom); }
    }
  });
});

const PORT = process.env.PORT || 8787;
server.listen(PORT, ()=> console.log("Server listening on", PORT));
