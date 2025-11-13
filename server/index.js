// server/index.js — 動態人數/無佔位 + 正確對齊 playerId + 開局即廣播 STATE
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

const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "start.html"));
});
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// room = { state, sockets: Map<sid,{playerId,secret,displayName,avatar}>, host, lobbyReady }
const rooms = new Map();

// 🔧 房間清理工具：當房間沒人時，從記憶體移除
function cleanupRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  rooms.delete(roomId);
  console.log(`🧹 cleanupRoom: room ${roomId} removed`);
}

// ——— 視圖小工具：統一 chestCoins 並加上 viewerCanNext ———
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
      .filter(p => joinedIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.client?.displayName || p.displayName || `P${p.id+1}`,
        avatar: p.client?.avatar ?? p.avatar ?? 1,
        ready: !!ready[p.id],
      }))
  };

  for (const [sid] of room.sockets){
    io.to(sid).emit('EMIT', { type:'lobby', lobby: payload });
  }
}

// ——— Socket.IO ———
io.on("connection", (socket) => {
  let joinedRoom = null;

  socket.on("JOIN_ROOM", (payload = {}) => {
    const { roomId, displayName = "", avatar = 1, secret = "", pid } = payload;
    if (!roomId) return;

    // 建房：暫給 1 位座位（真正開始時會重建）
    let room = rooms.get(roomId);
    if (!room) {
      room = { state: createInitialState(1), sockets: new Map(), host: null, lobbyReady: {} };
      rooms.set(roomId, room);
    }

    const st = room.state;
    let sec = secret || "";

    // ★ 0) 若帶有 secret，且 state 裡已有同 secret 的玩家 → 視為「重連」
    let myId = null;
    if (sec) {
      const found = (st.players || []).find(p => p && p.secret === sec);
      if (found) myId = found.id;
    }

    // ★ 1) 沒找到舊座位時：找第一個未綁 client 的位置
    if (myId == null) {
      for (const p of st.players) {
        if (!p.client) { myId = p.id; break; }
      }
    }

    // ★ 2) 若都滿就新增一格座位（等待室用）
    if (myId == null) {
      myId = st.players.length;
      st.players.push({
        id: myId,
        alive: true,
        protected: false,
        dodging: false,
        frozen: false,
        hand: null,
        tempDraw: null,
        gold: 0,
        skipNext: false
      });
    }

    // ★ 若這次才產生 secret → 給一個新的
    if (!sec) sec = Math.random().toString(36).slice(2);

    // 寫入玩家 meta（state 端），順便記住 secret
    const p = st.players[myId];
    p.client = { displayName, avatar, pid };
    p.displayName = displayName;
    p.avatar = avatar;
    p.secret = sec;             // ← 關鍵：把 secret 綁到這個玩家

    // 第一位為房主
    if (room.host == null) room.host = myId;

    // 建 socket meta（之後驗章 / START_GAME 會用）
    room.sockets.set(socket.id, {
      playerId: myId,
      secret: sec,
      displayName: (displayName || "").trim() || `P${myId + 1}`,
      avatar: Number(avatar) || 1,
    });

    joinedRoom = roomId;
    socket.join(roomId);
    socket.emit("JOINED", { playerId: myId, secret: sec });

    // 等待室 ready 狀態（預設未準備）
    room.lobbyReady[myId] = room.lobbyReady[myId] ?? false;

    broadcastLobby(roomId);
    broadcastState(room);
  });


  socket.on("ACTION", (action = {}) => {
    const { roomId, playerId, secret, type } = action;
    const room = rooms.get(roomId);
    if (!room) return;

    // 驗章
    const ok = Array.from(room.sockets.values()).some(m => m.playerId === playerId && m.secret === secret);
    if (!ok) return socket.emit("ERROR", { message: "驗證失敗" });

    // 等待室：準備 / 取消
    if (type === 'LOBBY_READY' || type === 'LOBBY_UNREADY'){
      room.lobbyReady = room.lobbyReady || {};
      room.lobbyReady[playerId] = (type === 'LOBBY_READY');
      broadcastLobby(roomId);
      return;
    }

    // 等待室：房主開始 → 重建 state、對齊 playerId、廣播 nav_game
    if (type === 'START_GAME'){
      if (room.host !== playerId) {
        io.to(socket.id).emit('EMIT', { type:'toast', text:'只有房主可以開始遊戲' });
        return;
      }

      // ① 以「socket 的加入順序」作為座位順序；同時帶出名稱/頭像/secret
      const entries = Array.from(room.sockets.entries()); // [ [sid, meta], ... ]
      const joined = entries.map(([sid, m]) => ({
        sid,
        oldId: m.playerId,
        name: m.displayName || `P${m.playerId + 1}`,
        avatar: m.avatar || 1,
        secret: m.secret,
      }));
      const n = joined.length;
      if (n < 2){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'至少需要 2 名玩家才能開始' });
        return;
      }

      // ② 必須全員 ready（用 oldId 檢查）
      const allReady = joined.every(j => room.lobbyReady?.[j.oldId] === true);
      if (!allReady){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'尚有人未準備' });
        return;
      }

      // ③ 依實際人數建立全新 state（會自動發手牌 / 建牌堆 / 場地）
      const st = createInitialState(n);

      // ④ 把名字/頭像/secret 寫進 players
      for (let i = 0; i < n; i++){
        const j = joined[i];
        const p = st.players[i];
        if (!p.client) p.client = {};
        p.client.displayName = j.name;
        p.client.avatar = j.avatar;
        p.displayName = j.name;
        p.avatar = j.avatar;
        p.secret = j.secret;    // ← 關鍵：把 secret 帶到新 state
      }

      // ⑤ 重新對齊 socket 的 playerId（oldId → 新座位 i），並回傳新的 JOINED
      const newSockets = new Map();
      for (let i = 0; i < joined.length; i++){
        const { sid, secret: sec } = joined[i];
        const oldMeta = room.sockets.get(sid) || {};
        newSockets.set(sid, {
          ...oldMeta,
          playerId: i,
          secret: sec,
        });
        io.to(sid).emit('JOINED', { playerId: i, secret: sec });
      }
      room.sockets = newSockets;

      // ⑥ host 也改成新座位（原 host 是某個 oldId）
      const remap = new Map(joined.map((j, i) => [j.oldId, i]));
      const newHost = remap.get(room.host);
      room.host = (newHost != null ? newHost : 0);

      // ⑦ 清空等待室 ready，寫回狀態並先廣播一版 STATE
      room.lobbyReady = {};
      room.state = st;
      broadcastState(room);

      // ⑧ 導頁到 game.html
      for (const [sid] of room.sockets){
        io.to(sid).emit('EMIT', { type:'nav_game' });
      }
      return;
    }

    // 下一局（房主或本局勝者）
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
        const n = st.players.length;
        const gold = st.players.map(p => p.gold || 0);
        const ns = createInitialState(n);
        ns.players.forEach((p, i) => p.gold = gold[i] || 0);
        ns.roundNo   = (st.roundNo || 0) + 1;
        ns.chestLeft = st.chestLeft;
        ns.chestTotal= st.chestTotal;

        // 沿用名字/頭像
        for (let i=0;i<n;i++){
          const src = st.players[i]?.client || {};
          if (!ns.players[i].client) ns.players[i].client = {};
          ns.players[i].client.displayName = src.displayName;
          ns.players[i].client.avatar = src.avatar;
          ns.players[i].displayName = src.displayName;
          ns.players[i].avatar = src.avatar;
        }

        room.state = ns;
      }

      broadcastState(room);
      return;
    }

    // 遊戲內其他行為 → 交給引擎
    const res = applyAction(room.state, action);
    room.state = res.state;

    // EMIT 單播/群播
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

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;

    const meta = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);

    if (meta && room.lobbyReady) delete room.lobbyReady[meta.playerId];

    // ✅ 無人在線 → 清掉整個房（避免記憶體一直累積）
    if (room.sockets.size === 0) {
      cleanupRoom(joinedRoom);
      joinedRoom = null;
      return;
    }

    // 房主斷線 → 交棒給目前第一位
    if (room.host != null){
      const all = [...room.sockets.values()];
      if (all.length) room.host = all[0].playerId;
    }

    broadcastLobby(joinedRoom);
  });
});

const PORT = process.env.PORT || 8787;
server.listen(PORT, () => console.log("Server listening on", PORT));
