// /server/index.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

// 引擎：請確認這些匯出在你的 engine.js 內存在
const {
  createInitialState,
  applyAction,
  nextRound,
  isRoundEnded,
} = require('./engine');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*'},
});

const rooms = new Map(); // roomId -> { state, sockets(Map), host:number|null, lobbyReady:Object }

// 靜態檔
app.use(express.static(path.join(__dirname, '..', 'public')));

// ====== 小工具 ======
function ensureRoom(roomId){
  let room = rooms.get(roomId);
  if (!room){
    // 起一個最小 state；實際開局時會用等待室人數重建
    room = {
      state: createInitialState(1),
      sockets: new Map(), // sid -> { playerId, displayName, avatar, secret? }
      host: null,
      lobbyReady: {},     // pid -> true/false
    };
    rooms.set(roomId, room);
  }
  return room;
}

// 廣播 STATE（遊戲內畫面專用）
function broadcastState(room){
  const payload = room.state;
  // 把同一個 room 的所有 socket 逐一單播（不用房間 join，保持清晰）
  for (const [sid] of room.sockets){
    io.to(sid).emit('STATE', payload);
  }
}

// === 廣播等待室（純 sockets → 沒佔位） ===
function broadcastLobby(roomId){
  const room = rooms.get(roomId);
  if (!room) return;

  const ready = room.lobbyReady || {};

  // 依加入順序產生等待室玩家清單（不看 state.players）
  const players = [...room.sockets.values()].map(m => ({
    id: m.playerId,
    name: m.displayName || `P${(m.playerId ?? 0) + 1}`,
    avatar: m.avatar || 1,
    ready: !!ready[m.playerId],
  }));

  // 若還沒指定房主，第一位進來的人就是房主
  if (room.host == null && players.length) {
    room.host = players[0].id;
  }

  const payload = { roomId, host: room.host ?? null, players };

  for (const [sid] of room.sockets){
    io.to(sid).emit('EMIT', { type:'lobby', lobby: payload });
  }
}

// ====== Socket.IO ======
io.on('connection', (socket) => {
  let joinedRoom = null;
  let myPid = null; // 僅供本連線暫存（等待室階段會用）

  // === 加入/建立房（等待室用） ===
  socket.on('JOIN_ROOM', ({ roomId, displayName, avatar, secret })=>{
    if (!roomId) return;
    const room = ensureRoom(roomId);

    // 指派一個暫時 pid（按進房順序）。Map 保序，pid 僅用於等待室階段
    myPid = [...room.sockets.values()].length;

    room.sockets.set(socket.id, {
      playerId: myPid,
      displayName: (displayName||'').trim() || `P${myPid+1}`,
      avatar: Number(avatar)||1,
      secret: secret || '',
    });

    joinedRoom = roomId;

    // 首位加入者為房主（若尚未指定）
    if (room.host == null) room.host = myPid;

    // 回覆本人的 playerId/secret
    io.to(socket.id).emit('JOINED', { playerId: myPid, secret: secret || '' });

    // 廣播等待室名單
    broadcastLobby(roomId);
  });

  // === 等待室／遊戲中行為 ===
  socket.on('ACTION', (action = {}) => {
    const roomId   = action.roomId;
    const room     = rooms.get(roomId);
    if (!room) return;

    // 找出這個 socket 的 meta（為了權限與身分）
    const meta = room.sockets.get(socket.id);
    const playerId = meta?.playerId;
    const type = action.type;

    // ——— 等待室：準備 / 取消準備 ———
    if (type === 'LOBBY_READY' || type === 'LOBBY_UNREADY'){
      if (playerId == null) return;
      room.lobbyReady = room.lobbyReady || {};
      room.lobbyReady[playerId] = (type === 'LOBBY_READY');
      broadcastLobby(roomId);
      return;
    }

    // ——— 等待室：房主開始遊戲 ———
    if (type === 'START_GAME'){
      // 只允許房主按「開始」
      if (room.host !== playerId) {
        io.to(socket.id).emit('EMIT', { type:'toast', text:'只有房主可以開始遊戲' });
        return;
      }

      // 取得實際已加入的人（在線座位）
      const lobbyPlayers = [...room.sockets.values()].map(m => ({
        id: m.playerId,                       // 等待室 pid
        name: m.displayName || `P${(m.playerId ?? 0)+1}`,
        avatar: m.avatar || 1,
      }));
      const playerCount = lobbyPlayers.length;

      if (playerCount < 2){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'至少需要 2 名玩家才能開始' });
        return;
      }

      // 檢查全員都已按準備
      const allReady = lobbyPlayers.every(p => room.lobbyReady?.[p.id] === true);
      if (!allReady){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'尚有人未準備' });
        return;
      }

      // —— 依等待室人數重建遊戲 state —— //
      const ns = createInitialState(playerCount);

      // 依等待室順序，覆寫玩家 client meta
      for (let i=0; i<playerCount; i++){
        const lp = lobbyPlayers[i];
        if (!ns.players[i].client) ns.players[i].client = {};
        ns.players[i].client.displayName = lp.name;
        ns.players[i].client.avatar      = lp.avatar;
      }

      room.state = ns;

      // —— 重新編號 sockets 上的 playerId：等待室順序即新 id —— //
      // 建 oldId -> newId 的對映（此時其實 oldId == i，多數會相同；保險寫法）
      const remap = new Map();
      lobbyPlayers.forEach((p, idx) => remap.set(p.id, idx));

      const newSockets = new Map();
      for (const [sid, m] of room.sockets.entries()){
        const newId = remap.get(m.playerId);
        if (newId == null) continue;
        newSockets.set(sid, { ...m, playerId: newId });
        // 回傳一次 JOINED（帶新編號），以免前端還留著等待室 pid
        io.to(sid).emit('JOINED', { playerId: newId, secret: m.secret || '' });
      }
      room.sockets = newSockets;

      // 房主 → 轉成新編號
      if (room.host != null){
        const newHost = remap.get(room.host);
        room.host = (newHost != null ? newHost : 0);
      } else {
        room.host = 0;
      }

      // 清空等待室準備狀態
      room.lobbyReady = {};

      // 同步導向 game.html（前端接到會帶上 n = 等待室人數）
      for (const [sid] of room.sockets){
        io.to(sid).emit('EMIT', { type:'nav_game' });
      }

      // 立即廣播一版 STATE（保險）
      broadcastState(room);
      return;
    }

    // ——— 下一局（仍採用你原本的權限邏輯） ———
    if (type === "NEXT_ROUND"){
      const st = room.state;
      const ended = typeof isRoundEnded === "function"
        ? isRoundEnded(st)
        : (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");

      if (!ended) {
        socket.emit("EMIT", { type:'toast', text:'本局尚未結束' });
        return;
      }

      // 勝利者＝回合已結束且仍存活者
      const winners = new Set(st.players.filter(p => p.alive).map(p => p.id));
      const can = (room.host === playerId) || winners.has(playerId);
      if (!can) {
        socket.emit("EMIT", { type:'toast', text:'只有房主或本局勝者可以開始下一局' });
        return;
      }

      // 允許 → 進入下一局
      if (typeof nextRound === "function"){
        room.state = nextRound(st);
      } else {
        // 後備：重建，但保留金幣與 roundNo、寶箱資訊
        const n = st.players.length;
        const gold = st.players.map(p => p.gold || 0);
        const ns = createInitialState(n);
        ns.players.forEach((p, i) => p.gold = gold[i] || 0);
        ns.roundNo = (st.roundNo || 0) + 1;
        ns.chestLeft = st.chestLeft;       // 保留寶箱剩餘
        ns.chestTotal = st.chestTotal;     // 保留寶箱總量
        room.state = ns;
      }

      broadcastState(room);
      return;
    }

    // ——— 遊戲中一般行為 → 交由引擎處理 ———
    const res = applyAction(room.state, action);
    room.state = res.state;

    // 單播/群播 EMIT
    for (const e of (res.emits || [])) {
      if (e.to === "all") {
        for (const [sid] of room.sockets) io.to(sid).emit("EMIT", e);
      } else {
        for (const [sid, m] of room.sockets) {
          if (m.playerId === e.to) io.to(sid).emit("EMIT", e);
        }
      }
    }

    broadcastState(room);
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;

    // 移除該連線
    const meta = room.sockets.get(socket.id);
    if (meta){
      room.sockets.delete(socket.id);
      // 清除其 ready
      if (room.lobbyReady && meta.playerId != null) {
        delete room.lobbyReady[meta.playerId];
      }
    }

    // 若 host 斷線 → 交棒給目前第一位
    if (room.host != null){
      const all = [...room.sockets.values()];
      if (!all.length) {
        // 房內已空 → 可視需求保留或刪房
        // rooms.delete(joinedRoom);
      } else {
        const first = all[0];
        room.host = first.playerId;
      }
    }

    // 更新等待室名單
    broadcastLobby(joinedRoom);
  });
});

// 入口（允許直接打根路徑）
const PORT = process.env.PORT || 8787;
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'start.html'));
});
server.listen(PORT, () => console.log("Server listening on", PORT));
