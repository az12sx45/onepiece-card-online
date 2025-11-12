// server/index.js — 統一 chestCoins、支援 NEXT_ROUND 權限、提供靜態檔與 Socket.IO
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const {
  createInitialState,
  applyAction,
  getVisibleState,
  isRoundEnded, // 若引擎未輸出也沒關係，下面有保險邏輯
  nextRound     // 同上
} = require("./engine.js");

// === HTTP + 靜態檔 ===
const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// === 房間狀態 ===
// room = { state, sockets: Map<socketId, {playerId, secret}>, host:number|null, lobbyReady?: Record<number, boolean> }
const rooms = new Map();

// 統一寶箱欄位：就算引擎不同欄位，也統一成 vis.chestCoins
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

// ★ 廣播狀態：計算 viewerCanNext（房主或本局勝者）
function broadcastState(room){
  const st = room.state;
  const ended = (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");

  // 勝利者＝回合已結束且仍存活者
  const winners = ended
    ? new Set(st.players.filter(p => p.alive).map(p => p.id))
    : new Set();

  for (const [sid, meta] of room.sockets){
    const vis = injectChestCoins(getVisibleState(st, meta.playerId));

    // 只有房主或本局勝者可以按下一局（前端顯示用）
    vis.viewerCanNext = (room.host === meta.playerId) || winners.has(meta.playerId);

    // allowNextRound 已由 injectChestCoins 設定；此處不覆寫
    io.to(sid).emit("STATE", vis);
  }
}

// === 廣播等待室（玩家名單 / 準備狀態 / 房主） ===
function broadcastLobby(roomId){
  const room = rooms.get(roomId);
  if (!room) return;
  const st = room.state;
  const ready = room.lobbyReady || {};
  const payload = {
    roomId,
    host: room.host,
    players: st.players.map(p => ({
      id: p.id,
      name: p.client?.displayName || `P${p.id+1}`,
      avatar: p.client?.avatar || 1,
      ready: !!ready[p.id],
    }))
  };
  for (const [sid] of room.sockets){
    io.to(sid).emit('EMIT', { type:'lobby', lobby: payload });
  }
}

// === Socket.IO ===
io.on("connection", (socket) => {
  let joinedRoom = null;

  socket.on("JOIN_ROOM", (payload = {}) => {
    const { roomId, displayName = "", avatar = 1, secret = "", playerCount } = payload;
    if (!roomId) return;

    // 建房
    let room = rooms.get(roomId);
    if (!room) {
      const n = Number(playerCount) || 4;
      room = { state: createInitialState(n), sockets: new Map(), host: null }; // ★ 加 host
      rooms.set(roomId, room);
    }

    // 找第一個未綁 client 的位置
    let myId = null;
    for (const p of room.state.players) {
      if (!p.client) {
        myId = p.id;
        // 先存一份在 client（原本就有的）
        p.client = { displayName, avatar, pid: payload?.pid };
        // ★ 同步到頂層，讓引擎 / 結算可直接讀到
        if (displayName) p.displayName = displayName;
        if (avatar != null) p.avatar = avatar;
        if (payload?.pid != null) p.pid = payload.pid;
        break;
      }
    }
    if (myId == null) return socket.emit("ERROR", { message: "房間已滿" });

    // ★ 若尚未指定房主，第一位入座者即為房主（保險：重入不覆寫）
    if (room.host == null) room.host = myId;

    const sec = secret || Math.random().toString(36).slice(2);
    room.sockets.set(socket.id, { playerId: myId, secret: sec });

    joinedRoom = roomId;
    socket.join(roomId);
    socket.emit("JOINED", { playerId: myId, secret: sec });

    // === 等待室：初始化準備表並加入新玩家，廣播快照 ===
    if (!room.lobbyReady) room.lobbyReady = {};
    room.lobbyReady[myId] = false; // 初始未準備
    broadcastLobby(roomId);

    // 仍維持一次遊戲狀態（方便觀察）
    broadcastState(room);
  });

  socket.on("ACTION", (action = {}) => {
    const { roomId, playerId, secret, type } = action;
    const room = rooms.get(roomId);
    if (!room) return;

    // 簽章驗證
    const ok = Array.from(room.sockets.values()).some(m => m.playerId === playerId && m.secret === secret);
    if (!ok) return socket.emit("ERROR", { message: "驗證失敗" });

    // === 等待室：切換準備 ===
    if (type === 'LOBBY_READY' || type === 'LOBBY_UNREADY'){
      room.lobbyReady = room.lobbyReady || {};
      room.lobbyReady[playerId] = (type === 'LOBBY_READY');
      broadcastLobby(roomId);
      return;
    }

    // === 等待室：房主開局（同步導航到 game.html） ===
    if (type === 'START_GAME'){
      for (const [sid] of room.sockets){
        io.to(sid).emit('EMIT', { type:'nav_game' });
      }
      return;
    }

    // ★ NEXT_ROUND 權限：只有房主或本局勝者能啟動
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
        ns.chestLeft = st.chestLeft;       // ★ 保留寶箱剩餘
        ns.chestTotal = st.chestTotal;     // ★ 保留寶箱總量
        room.state = ns;
      }

      broadcastState(room);
      return;
    }

    // 交由引擎處理
    const res = applyAction(room.state, action);
    room.state = res.state;

    // 單播/群播 EMIT
    for (const e of (res.emits || [])) {
      if (e.to === "all") io.to(roomId).emit("EMIT", e);
      else {
        for (const [sid, meta] of room.sockets) {
          if (meta.playerId === e.to) io.to(sid).emit("EMIT", e);
        }
      }
    }

    broadcastState(room);
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;
    room.sockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 8787;
const path = require('path'); // 檔案頂部若尚未引入就加這行

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'start.html'));
});

server.listen(PORT, () => console.log("Server listening on", PORT));
