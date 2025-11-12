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
// 根路徑給 Render 面板點擊時用
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "start.html"));
});

// 你原本已經有的
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

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
  const joinedIds = new Set([...room.sockets.values()].map(m => m.playerId));
  const payload = {
    roomId,
    host: room.host,
    players: st.players
     .filter(p => joinedIds.has(p.id))         // ← 關鍵：只保留已加入的人
     .map(p => ({
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
      const n = 6;
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
    // 只允許房主
    if (room.host !== playerId) {
      io.to(socket.id).emit('EMIT', { type:'toast', text:'只有房主可以開始遊戲' });
      return;
    }

    // 取得實際在線座位
    const joined = [...room.sockets.values()]
      .map(m => ({
        playerId: m.playerId,
        pid: m.playerId,                     // 你的專案裡 pid=playerId 即可
        name: m.displayName || `P${m.playerId+1}`,
        avatar: m.avatar || 1
      }));
    const n = joined.length;
    if (n < 2){
      io.to(socket.id).emit('EMIT', { type:'toast', text:'至少需要 2 名玩家才能開始' });
      return;
    }

    // 必須全員 ready
    const allReady = joined.every(j => room.lobbyReady?.[j.playerId] === true);
    if (!allReady){
      io.to(socket.id).emit('EMIT', { type:'toast', text:'尚有人未準備' });
      return;
    }

    // ① 建立對局 state（會完成起始牌庫、發牌等）
    const st = createInitialState(n);

    // ② 把玩家 meta（名字/頭像/pid）寫入 state
    //    id 與「座位順序」相同：joined[0] → st.players[0] …
    for (let i = 0; i < n; i++){
      const j = joined[i];
      const p = st.players[i];
      // 確保玩家 id 與房內映射一致（你的 engine 以 index 當 id 就不動；只補 client 資訊）
      p.client = { displayName: j.name, avatar: j.avatar, pid: j.pid };
    }

    // 可選：清空等待室 ready 狀態
    room.lobbyReady = {};

    // 寫回房間狀態並廣播
    room.state = st;
    broadcastState(room);

    // ③ 條件符合 → 同步導向 game.html
    for (const [sid] of room.sockets){
      io.to(sid).emit('EMIT', { type:'nav_game' });
    }
    return;
  }

  // =========================
  // ★ NEXT_ROUND：沿用你原本的權限/流程
  // =========================
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
      // 後備：重建，但保留金幣與 roundNo、寶箱資訊
      const n = st.players.length;
      const gold = st.players.map(p => p.gold || 0);
      const ns = createInitialState(n);
      ns.players.forEach((p, i) => p.gold = gold[i] || 0);
      ns.roundNo   = (st.roundNo || 0) + 1;
      ns.chestLeft = st.chestLeft;
      ns.chestTotal= st.chestTotal;

      // 把名字/頭像沿用
      for (let i=0;i<n;i++){
        const src = st.players[i]?.client || {};
        ns.players[i].client = { displayName: src.displayName, avatar: src.avatar, pid: src.pid };
      }

      room.state = ns;
    }

    broadcastState(room);
    return;
  }

  // 其他遊戲內動作 → 交給引擎
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

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'start.html'));
});

server.listen(PORT, () => console.log("Server listening on", PORT));
