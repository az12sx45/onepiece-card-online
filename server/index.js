// server/index.js — 動態人數開局 / 等待室無佔位 / NEXT_ROUND 權限 / 靜態檔 + Socket.IO
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const {
  createInitialState,
  applyAction,
  getVisibleState,
  isRoundEnded,
  nextRound
} = require("./engine.js");

// === HTTP + 靜態檔 ===
const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "start.html"));
});
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// === 房間狀態 ===
// room = { state, sockets: Map<socketId, {playerId, displayName, avatar, secret}>, host:number|null, lobbyReady: Record<number, boolean> }
const rooms = new Map();

// === 視圖小工具：統一寶箱欄位，並推導回合狀態 ===
function injectChestCoins(vis){
  const cands = [
    vis.chestCoins, vis.chestLeft, vis.chest, vis.treasure, vis.bank, vis.pot,
    vis.meta?.chest, vis.meta?.treasure, vis.meta?.bank, vis.meta?.pot,
  ];
  let chest;
  for (const v of cands){
    if (typeof v === "number") { chest = v; break; }
    if (v && typeof v.coins  === "number") { chest = v.coins;  break; }
    if (v && typeof v.amount === "number") { chest = v.amount; break; }
    if (v && typeof v.value  === "number") { chest = v.value;  break; }
  }
  if (typeof chest !== "number") chest = 0;
  vis.chestCoins = chest;

  if (vis.turnStep){
    const ended = (vis.turnStep === "ended" || vis.turnStep === "end" || vis.turnStep === "score");
    vis.roundEnded = !!ended;
    vis.allowNextRound = ended && (typeof vis.chestLeft === "number" ? vis.chestLeft > 0 : true);
  }
  return vis;
}

// === 廣播 STATE（遊戲內畫面用） ===
function broadcastState(room){
  const st = room.state;
  const ended = (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");
  const winners = ended ? new Set(st.players.filter(p => p.alive).map(p => p.id)) : new Set();

  for (const [sid, meta] of room.sockets){
    const vis = injectChestCoins(getVisibleState(st, meta.playerId));
    vis.viewerCanNext = (room.host === meta.playerId) || winners.has(meta.playerId);
    io.to(sid).emit("STATE", vis);
  }
}

// === 廣播等待室（玩家名單 / 準備狀態 / 房主） ===
function broadcastLobby(roomId){
  const room = rooms.get(roomId);
  if (!room) return;
  const st = room.state;
  const ready = room.lobbyReady || {};

  // 只取「實際已連線的 pid」來組名單（無佔位）
  const joinedIds = new Set([...room.sockets.values()].map(m => m.playerId));
  const payload = {
    roomId,
    host: room.host,
    players: st.players
      .filter(p => joinedIds.has(p.id)) // ← 關鍵：僅保留已加入的人
      .map(p => ({
        id: p.id,
        name: p.client?.displayName || p.displayName || `P${p.id+1}`,
        avatar: p.client?.avatar ?? p.avatar ?? 1,
        ready: !!ready[p.id],
      })),
  };

  for (const [sid] of room.sockets){
    io.to(sid).emit('EMIT', { type:'lobby', lobby: payload });
  }
}

// === Socket.IO ===
io.on("connection", (socket) => {
  let joinedRoom = null;

  // === 建立/加入房（等待室） ===
  socket.on("JOIN_ROOM", (payload = {}) => {
    const { roomId, displayName = "", avatar = 1, secret = "", playerCount } = payload;
    if (!roomId) return;

    // 建房：先用最小 1 位，真正開始時會依等待室重建
    let room = rooms.get(roomId);
    if (!room) {
      room = { state: createInitialState(1), sockets: new Map(), host: null, lobbyReady: {} };
      rooms.set(roomId, room);
    }

    // 尋找第一個沒有 client 的 player 槽位；沒有就 push 一個（避免佔位不足）
    let myId = null;
    for (const p of room.state.players) {
      if (!p.client) { myId = p.id; break; }
    }
    if (myId == null) {
      myId = room.state.players.length;
      room.state.players.push({
        id: myId,
        alive: true,
        hand: null,
        client: null,
      });
    }

    // 對應 player 寫入 meta
    const p = room.state.players[myId];
    p.client = { displayName, avatar };
    p.displayName = displayName;
    p.avatar = avatar;

    // 房主：第一位入座者為 host（若尚未指定）
    if (room.host == null) room.host = myId;

    // 建立 socket meta
    const sec = secret || Math.random().toString(36).slice(2);
    room.sockets.set(socket.id, {
      playerId: myId,
      displayName: (displayName||'').trim() || `P${myId+1}`,
      avatar: Number(avatar)||1,
      secret: sec
    });

    joinedRoom = roomId;

    // 回覆 JOINED
    io.to(socket.id).emit("JOINED", { playerId: myId, secret: sec });

    // 等待室：預設未準備
    room.lobbyReady[myId] = false;

    // 廣播等待室與一版 STATE（方便觀察）
    broadcastLobby(roomId);
    broadcastState(room);
  });

  // === 等待室 / 遊戲中動作 ===
  socket.on("ACTION", (action = {}) => {
    const { roomId, playerId, secret, type } = action;
    const room = rooms.get(roomId);
    if (!room) return;

    // 簽章驗證
    const ok = Array.from(room.sockets.values()).some(m => m.playerId === playerId && m.secret === secret);
    if (!ok) return socket.emit("ERROR", { message: "驗證失敗" });

    // --- 等待室：切換準備 ---
    if (type === 'LOBBY_READY' || type === 'LOBBY_UNREADY'){
      room.lobbyReady = room.lobbyReady || {};
      room.lobbyReady[playerId] = (type === 'LOBBY_READY');
      broadcastLobby(roomId);
      return;
    }

    // --- 等待室：房主開始遊戲（重建 state → nav_game） ---
    if (type === 'START_GAME'){
      // 只允許房主
      if (room.host !== playerId) {
        io.to(socket.id).emit('EMIT', { type:'toast', text:'只有房主可以開始遊戲' });
        return;
      }

      // 等待室真玩家（依進房順序）
      const lobbyPlayers = [...room.sockets.values()].map(m => ({
        id: m.playerId,
        name: m.displayName || `P${(m.playerId ?? 0)+1}`,
        avatar: m.avatar || 1,
      }));
      const n = lobbyPlayers.length;
      if (n < 2){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'至少需要 2 名玩家才能開始' });
        return;
      }

      // 全員準備檢查
      const allReady = lobbyPlayers.every(p => room.lobbyReady?.[p.id] === true);
      if (!allReady){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'尚有人未準備' });
        return;
      }

      // === 依等待室人數重建遊戲 state ===
      const ns = createInitialState(n);
      for (let i=0; i<n; i++){
        const lp = lobbyPlayers[i];
        if (!ns.players[i].client) ns.players[i].client = {};
        ns.players[i].client.displayName = lp.name;
        ns.players[i].client.avatar      = lp.avatar;
        ns.players[i].displayName = lp.name;
        ns.players[i].avatar      = lp.avatar;
      }
      room.state = ns;

      // === sockets 上的 playerId 也改成新編號（等待室順序即新 id）===
      const remap = new Map(); // oldId -> newId
      lobbyPlayers.forEach((p, idx) => remap.set(p.id, idx));
      const newSockets = new Map();
      for (const [sid, m] of room.sockets.entries()){
        const newId = remap.get(m.playerId);
        if (newId == null) continue;
        newSockets.set(sid, { ...m, playerId: newId });
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

      // 清空等待室 ready
      room.lobbyReady = {};

      // 導向 game.html（前端會據此帶 n）
      for (const [sid] of room.sockets){
        io.to(sid).emit('EMIT', { type:'nav_game' });
      }

      // 立即廣播一版 STATE
      broadcastState(room);
      return;
    }

    // --- 下一局（房主或本局勝者） ---
    if (type === "NEXT_ROUND"){
      const st = room.state;
      const ended = typeof isRoundEnded === "function"
        ? isRoundEnded(st)
        : (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");

      if (!ended) {
        socket.emit("EMIT", { type:'toast', text:'本局尚未結束' });
        return;
      }

      const winners = new Set(st.players.filter(p => p.alive).map(p => p.id));
      const can = (room.host === playerId) || winners.has(playerId);
      if (!can) {
        socket.emit("EMIT", { type:'toast', text:'只有房主或本局勝者可以開始下一局' });
        return;
      }

      if (typeof nextRound === "function"){
        room.state = nextRound(st);
      } else {
        // 後備：重建，但保留金幣與回合/寶箱資訊
        const n = st.players.length;
        const gold = st.players.map(p => p.gold || 0);
        const ns = createInitialState(n);
        ns.players.forEach((p, i) => p.gold = gold[i] || 0);
        ns.roundNo   = (st.roundNo || 0) + 1;
        ns.chestLeft = st.chestLeft;
        ns.chestTotal= st.chestTotal;
        room.state = ns;
      }

      broadcastState(room);
      return;
    }

    // --- 遊戲中一般行為 → 引擎處理 ---
    const res = applyAction(room.state, action);
    room.state = res.state;

    // 單播/群播 EMIT
    for (const e of (res.emits || [])) {
      if (e.to === "all") {
        for (const [sid] of room.sockets) io.to(sid).emit("EMIT", e);
      } else {
        for (const [sid, meta] of room.sockets) {
          if (meta.playerId === e.to) io.to(sid).emit("EMIT", e);
        }
      }
    }

    broadcastState(room);
  });

  // === 斷線處理 ===
  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;

    const meta = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);

    // 清理 ready 狀態
    if (meta && room.lobbyReady) {
      delete room.lobbyReady[meta.playerId];
    }

    // 房主斷線 → 交棒給目前第一位（若還有玩家）
    if (room.host != null){
      const all = [...room.sockets.values()];
      if (all.length) {
        room.host = all[0].playerId;
      }
    }

    broadcastLobby(joinedRoom);
  });
});

// === 啟動 ===
const PORT = process.env.PORT || 8787;
server.listen(PORT, () => console.log("Server listening on", PORT));
