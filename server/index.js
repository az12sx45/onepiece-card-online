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
app.use(express.static(path.join(__dirname, "..", "public")))
app.get("/", (_req, res) => res.redirect(302, "/start.html"));
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// === 房間狀態 ===
// room = { state, sockets: Map<socketId, {playerId, secret}>, host:number|null }
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

    // ★ 若尚未指定房主，第一位入座者即為房主
    if (room.host == null) room.host = myId;

    const sec = secret || Math.random().toString(36).slice(2);
    room.sockets.set(socket.id, { playerId: myId, secret: sec });

    joinedRoom = roomId;
    socket.join(roomId);
    socket.emit("JOINED", { playerId: myId, secret: sec });

    broadcastState(room);
  });

// === LOBBY（跨裝置等待室） ===
const LOBBY_PREFIX = 'lobby:';
function lobbyRoom(roomId){ return LOBBY_PREFIX + String(roomId).toUpperCase(); }

const lobbies = new Map(); 
// 結構：lobbies.get(roomId) = { hostSid, players: Map<sid, {sid,name,avatar,ready,pid}> }

function broadcastLobby(roomId){
  const lobby = lobbies.get(roomId);
  if (!lobby) return;
  const players = [...lobby.players.values()].map(p => ({
    sid: p.sid, name: p.name, avatar: p.avatar, ready: !!p.ready, pid: p.pid
  }));
  io.to(lobbyRoom(roomId)).emit('LOBBY_STATE', {
    roomId, hostSid: lobby.hostSid, players
  });
}

socket.on('LOBBY_JOIN', ({ roomId, name, avatar, pid })=>{
  roomId = String(roomId||'').toUpperCase();
  if (!roomId) return;
  socket.join(lobbyRoom(roomId));

  if (!lobbies.has(roomId)) lobbies.set(roomId, { hostSid: socket.id, players: new Map() });
  const lobby = lobbies.get(roomId);
  // 首位進房者成為 host（若 host 離線會在 LEAVE 時自動讓位）
  if (!lobby.hostSid) lobby.hostSid = socket.id;

  lobby.players.set(socket.id, { sid: socket.id, name: name||('玩家'+socket.id.slice(-4)), avatar: Number(avatar)||1, ready:false, pid: pid||null });
  broadcastLobby(roomId);
});

socket.on('LOBBY_READY', ({ roomId, ready })=>{
  roomId = String(roomId||'').toUpperCase();
  const lobby = lobbies.get(roomId);
  if (!lobby) return;
  const p = lobby.players.get(socket.id);
  if (!p) return;
  p.ready = !!ready;
  broadcastLobby(roomId);
});

socket.on('LOBBY_START', ({ roomId, serverURL })=>{
  roomId = String(roomId||'').toUpperCase();
  const lobby = lobbies.get(roomId);
  if (!lobby) return;
  if (lobby.hostSid !== socket.id) return; // 只有房主可開始

  const everyoneReady = [...lobby.players.values()].every(p => !!p.ready);
  if (!everyoneReady) return;

  // 通知所有等待室成員「一起跳 game.html」
  io.to(lobbyRoom(roomId)).emit('NAVIGATE_GAME', {
    roomId,
    serverURL: serverURL || process.env.PUBLIC_SERVER_URL || 'https://onepiece-card-online.onrender.com'
  });
  // （可選）不要清空 lobbies，保留名單直到實際進入遊戲
});

socket.on('LOBBY_LEAVE', ({ roomId })=>{
  roomId = String(roomId||'').toUpperCase();
  const lobby = lobbies.get(roomId);
  if (!lobby) return;
  lobby.players.delete(socket.id);
  if (lobby.hostSid === socket.id){
    // 讓位給下一個人
    lobby.hostSid = (lobby.players.size > 0) ? [...lobby.players.keys()][0] : null;
  }
  if (lobby.players.size === 0) {
    lobbies.delete(roomId);
  } else {
    broadcastLobby(roomId);
  }
});

socket.on('disconnect', ()=>{
  // 從所有大廳清理
  for (const [roomId, lobby] of lobbies){
    if (lobby.players.delete(socket.id)){
      if (lobby.hostSid === socket.id){
        lobby.hostSid = (lobby.players.size > 0) ? [...lobby.players.keys()][0] : null;
      }
      if (lobby.players.size === 0) lobbies.delete(roomId);
      else broadcastLobby(roomId);
    }
  }
});


  socket.on("ACTION", (action = {}) => {
    const { roomId, playerId, secret, type } = action;
    const room = rooms.get(roomId);
    if (!room) return;

    // 簽章驗證
    const ok = Array.from(room.sockets.values()).some(m => m.playerId === playerId && m.secret === secret);
    if (!ok) return socket.emit("ERROR", { message: "驗證失敗" });

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
server.listen(PORT, () => console.log("Server listening on", PORT));
