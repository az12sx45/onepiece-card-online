// /server/index.js
const path   = require('path');
const express= require('express');
const http   = require('http');
const { Server } = require('socket.io');

const { createInitialState, applyAction, getVisibleState, isRoundEnded, nextRound } = require('./engine');

const app = express();
const server = http.createServer(app);
const io  = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, '..', 'public')));

// ===== 房間結構 =====
// rooms: Map<roomId, {
//   sockets: Map<socketId, { playerId:number, secret:string }>
//   host: number|null,
//   state: GameState|null,
//   lobbyReady: { [playerId]: true },
//   secrets: Map<secret, playerId>   // 讓玩家重連時能接回
// }>
const rooms = new Map();

function ensureRoom(roomId){
  if (!rooms.has(roomId)){
    rooms.set(roomId, {
      sockets: new Map(),
      host: null,
      state: null,
      lobbyReady: {},
      secrets: new Map()
    });
  }
  return rooms.get(roomId);
}

// === 等待室快照 ===
function broadcastLobby(roomId){
  const room = rooms.get(roomId); if (!room) return;
  const ready = room.lobbyReady || {};
  // 目前「線上座位」= 這個房間的 sockets 裡的 playerId（去重後排序）
  const joined = [...room.sockets.values()]
    .map(m => m.playerId)
    .filter(v => typeof v === 'number' && v >= 0);
  const uniq = Array.from(new Set(joined)).sort((a,b)=>a-b);

  // 若尚未開局，用 uniq 長度作為等待室玩家數；名字/頭像暫放 client 欄位
  let players = [];
  if (!room.state){
    players = uniq.map(pid => ({
      id: pid,
      name: `P${pid+1}`,
      avatar: 1,
      ready: !!ready[pid]
    }));
  }else{
    players = room.state.players.map(p => ({
      id: p.id,
      name: p.client?.displayName || `P${p.id+1}`,
      avatar: p.client?.avatar || 1,
      ready: true
    }));
  }

  const payload = {
    roomId,
    host: room.host,
    players
  };

  for (const [sid] of room.sockets){
    io.to(sid).emit('EMIT', { type:'lobby', lobby: payload });
  }
}

// === 依 viewer 發送可見狀態 ===
function broadcastState(room){
  if (!room || !room.state) return;
  for (const [sid, meta] of room.sockets){
    const st = getVisibleState(room.state, meta.playerId);
    io.to(sid).emit('STATE', st);
  }
}

io.on('connection', (socket)=>{
  let joinedRoom = null;

  socket.on('JOIN_ROOM', ({ roomId, displayName='P', avatar=1, secret='' })=>{
    if (!roomId) return;
    const room = ensureRoom(roomId);
    joinedRoom = roomId;

    // 1) 判斷他是「回到舊座位 / 新人 / 觀戰」
    // 若已有 state：優先用 secret 找回原座位；找不到就當觀戰 (playerId = -1)
    // 若尚未有 state：分配下一個 playerId
    let playerId = -1;

    if (room.state){
      // 已開局
      if (secret && room.secrets.has(secret)){
        playerId = room.secrets.get(secret); // 接回
      } else {
        playerId = -1; // 觀戰
      }
    } else {
      // 尚未開局：用目前 socket 裡已存在的座位 + 不補空位
      const taken = new Set([...room.sockets.values()].map(m=>m.playerId).filter(i=>i>=0));
      // 優先用舊 secret 的座位
      if (secret && room.secrets.has(secret)) {
        playerId = room.secrets.get(secret);
      } else {
        // 找最小未使用整數作為新座位
        let i = 0; while (taken.has(i)) i++;
        playerId = i;
      }
      if (secret) room.secrets.set(secret, playerId);
      // 第一個進來的人就是房主
      if (room.host == null) room.host = playerId;
    }

    // 登記 socket → 房間
    room.sockets.set(socket.id, { playerId, secret: secret||'' });
    socket.join(roomId);

    // 回覆本人座位
    socket.emit('JOINED', { playerId, secret });

    // 如果尚未開局，廣播等待室；已開局則同步狀態給他
    if (!room.state) {
      broadcastLobby(roomId);
    } else {
      // 已開局：立刻送他能看的 STATE
      const st = getVisibleState(room.state, playerId);
      socket.emit('STATE', st);
    }
  });

  socket.on('ACTION', (action)=>{
    const roomId = action.roomId;
    const room = rooms.get(roomId);
    if (!room) return;

    const playerId = action.playerId;
    const type = action.type;

    // === 等待室：切換準備 ===
    if (type === 'LOBBY_READY' || type === 'LOBBY_UNREADY'){
      if (room.state){ return; } // 開局後忽略
      const will = (type === 'LOBBY_READY');
      room.lobbyReady[playerId] = will;
      broadcastLobby(roomId);
      return;
    }

    // === 開始遊戲：只有房主可以，且所有在線玩家都 ready，且人數≥2 ===
    if (type === 'START_GAME'){
      if (room.host !== playerId){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'只有房主可以開始遊戲' });
        return;
      }
      const joinedIds = Array.from(new Set(
        [...room.sockets.values()].map(m=>m.playerId).filter(i=>i>=0)
      )).sort((a,b)=>a-b);

      if (joinedIds.length < 2){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'至少需要 2 名玩家才能開始' });
        return;
      }
      const allReady = joinedIds.every(id => room.lobbyReady?.[id] === true);
      if (!allReady){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'尚有人未準備' });
        return;
      }

      // 建立初始 state（玩家數 = 實際在線的人數）
      const n = joinedIds.length;
      const st = createInitialState(n);

      // 把等待室的暱稱/頭像寫到 players.client，上桌次序 = joinedIds 的順序
      for (let i=0;i<n;i++){
        const pid = joinedIds[i];
        // 把所有屬於此 pid 的 socket，座位改成「i」（正式座位）
        for (const [sid, meta] of room.sockets){
          if (meta.playerId === pid){
            meta.playerId = i;
          }
        }
        // secret 對應也改成新座位 i（讓重整可接回）
        for (const [sec, old] of room.secrets){
          if (old === pid) room.secrets.set(sec, i);
        }
        st.players[i].id = i;
        st.players[i].client = st.players[i].client || {};
        st.players[i].client.displayName = `P${i+1}`;
        st.players[i].client.avatar = 1;
      }

      // 設房主為 0（第一個）
      room.host = 0;
      room.lobbyReady = {};
      room.state = st;

      // 導向 game.html（仍保留）
      for (const [sid] of room.sockets){
        io.to(sid).emit('EMIT', { type:'nav_game' });
      }

      // 首次廣播狀態（每個人看到自己的手牌）
      broadcastState(room);
      return;
    }

    // === 下一局（房主或本局勝者） ===
    if (type === 'NEXT_ROUND'){
      const st = room.state;
      const ended = typeof isRoundEnded === 'function'
        ? isRoundEnded(st)
        : (st?.turnStep === 'ended' || st?.turnStep === 'end' || st?.turnStep === 'score');

      if (!ended) {
        socket.emit('EMIT', { type:'toast', text:'本局尚未結束' });
        return;
      }
      const winners = new Set(st.players.filter(p=>p.alive).map(p=>p.id));
      const can = (room.host === playerId) || winners.has(playerId);
      if (!can) {
        socket.emit('EMIT', { type:'toast', text:'只有房主或本局勝者可以開始下一局' });
        return;
      }

      room.state = (typeof nextRound === 'function')
        ? nextRound(st)
        : (()=>{ const ns = createInitialState(st.players.length); return ns; })();

      broadcastState(room);
      return;
    }

    // === 交給引擎 ===
    if (!room.state) return;
    const res = applyAction(room.state, action);
    room.state = res.state;

    // 逐個單播 EMIT
    for (const e of (res.emits || [])) {
      if (e.to === 'all') {
        for (const [sid, meta] of room.sockets){
          io.to(sid).emit('EMIT', e);
        }
      } else {
        for (const [sid, meta] of room.sockets){
          if (meta.playerId === e.to) io.to(sid).emit('EMIT', e);
        }
      }
    }

    broadcastState(room);
  });

  socket.on('disconnect', ()=>{
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;
    room.sockets.delete(socket.id);
    // 還沒開局 → 更新等待室
    if (!room.state) broadcastLobby(joinedRoom);
  });
});

const PORT = process.env.PORT || 8787;
app.get('/', (req,res)=> res.sendFile(path.join(__dirname, '..', 'public', 'start.html')));
server.listen(PORT, ()=> console.log('Server listening on', PORT));
