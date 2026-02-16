// server/index.js — 動態人數/無佔位 + 正確對齊 playerId + 開局即廣播 STATE
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const { pool } = require("./db");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const {
  createInitialState,
  applyAction,
  getVisibleState,
  isRoundEnded,
  nextRound,
  _util,   // 新增
} = require("./engine.js");

const { cardById, tail } = _util;  // 再多拿 tail 來看尾數


const {
  pickCpuCardSmart,
  pickCpuTargetSmart,
  pickCpuDigitSmart,
} = require("./cpu.js");

console.log("server/index.js loaded");

const app = express();
app.use(express.json({ limit: "1mb" }));

// 靜態檔（你的 Cloudflare Pages / 或本地 public）
app.use(express.static(path.join(__dirname, "..", "public")));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// ====== Rooms ======
const rooms = new Map();

function makeRoom(roomId) {
  const st = createInitialState(6); // 等待室用，會在 START_GAME 依總人數重建
  return {
    id: roomId,
    host: null,
    phase: "lobby",
    state: st,
    sockets: new Map(), // sid -> { playerId, secret, displayName, avatar }
    lobbyReady: {},     // playerId -> bool
    cpuCount: 0,
  };
}

// ====== DB helper ======
async function ensureUser(username, password) {
  const u = (username || "").trim();
  if (!u) throw new Error("bad username");
  const hash = await bcrypt.hash(password, 10);
  const secret = crypto.randomBytes(20).toString("hex");

  // users: username unique
  const r = await pool.query(
    `INSERT INTO users(username, passhash, secret)
     VALUES($1,$2,$3)
     ON CONFLICT(username) DO UPDATE SET passhash = EXCLUDED.passhash
     RETURNING id, secret`,
    [u, hash, secret]
  );
  return r.rows[0];
}

async function loginUser(username, password) {
  const u = (username || "").trim();
  if (!u) throw new Error("bad username");
  const r = await pool.query(`SELECT id, passhash, secret FROM users WHERE username=$1`, [u]);
  if (!r.rowCount) throw new Error("no user");
  const ok = await bcrypt.compare(password, r.rows[0].passhash);
  if (!ok) throw new Error("bad password");
  return { id: r.rows[0].id, secret: r.rows[0].secret };
}

async function getProfileBySecret(secret) {
  if (!secret) return null;
  const r = await pool.query(`SELECT profile FROM player_profiles WHERE secret=$1`, [secret]);
  if (!r.rowCount) return null;
  return r.rows[0].profile;
}

async function upsertProfile(secret, profile) {
  if (!secret) return;
  await pool.query(
    `INSERT INTO player_profiles(secret, profile)
     VALUES($1,$2)
     ON CONFLICT(secret) DO UPDATE SET profile = EXCLUDED.profile`,
    [secret, profile]
  );
}

// ====== Visible state / Broadcast ======
function injectChestCoins(st){
  // 你原本的 chest coin 注入邏輯如果有，這裡先保留
  return st;
}

function broadcastState(room){
  const st = room.state;
  const ended = (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");
  const winners = ended ? new Set(st.players.filter(p => p.alive).map(p => p.id)) : new Set();

  for (const [sid, meta] of room.sockets){
    const vis = injectChestCoins(getVisibleState(st, meta.playerId));
    vis.viewerCanNext = (room.host === meta.playerId) || winners.has(meta.playerId);

    // ✅ 補上稱號資訊：getVisibleState 可能會剝掉 client 內的自訂欄位（例如 title）
    //    這裡用 room.state 當權威來源，依玩家 id 對齊後寫回可見狀態，避免「隨機座位」導致稱號對不上。
    try{
      if (vis && Array.isArray(vis.players) && Array.isArray(st.players)){
        for (const vp of vis.players){
          if (!vp) continue;
          const sp = st.players.find(x => x && x.id === vp.id);
          if (!sp) continue;
          const t = String(sp?.client?.title ?? sp?.title ?? "").trim();
          const tier = Math.max(1, Math.min(6, Number(sp?.client?.titleTier ?? sp?.titleTier ?? 1) || 1));
          vp.title = t;
          vp.titleTier = tier;
          if (!vp.client) vp.client = {};
          vp.client.title = t;
          vp.client.titleTier = tier;
        }
      }
    }catch(e){}

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
    cpuCount: room.cpuCount || 0,   // ← 新增：房間有幾個 CPU
    players: st.players
      .filter(p => joinedIds.has(p.id))
      .map(p => ({
        id: p.id,
        name: p.client?.displayName || p.displayName || `P${p.id+1}`,
        avatar: p.client?.avatar ?? p.avatar ?? 1,
        ready: !!ready[p.id],

        // ✅ 新增：稱號（等待室互相可見）
        title: (p.client?.title ?? p.title ?? ""),
        titleTier: (p.client?.titleTier ?? p.titleTier ?? 1),
      }))
  };

  for (const [sid] of room.sockets){
    io.to(sid).emit('EMIT', { type:'lobby', lobby: payload });
  }
}

// ---------- 統一套用 applyAction + 廣播 EMIT / STATE ----------
function applyAndBroadcast(room, action, io){
  try{
    const out = applyAction(room.state, action);
    // out: {emit:[], stateChanged:true/false}
    if (out?.emit && out.emit.length){
      for (const [sid] of room.sockets){
        for (const e of out.emit){
          io.to(sid).emit("EMIT", e);
        }
      }
    }
    if (out?.stateChanged){
      broadcastState(room);
    }
  }catch(e){
    console.error("applyAndBroadcast error", e);
  }
}

// ====== CPU loop ======
function runCpuLoop(roomId){
  const room = rooms.get(roomId);
  if (!room) return;
  if (room.phase !== 'playing') return;

  const st = room.state;
  const turn = st.players?.[st.turnIndex];
  if (!turn || !turn.isCPU) return;

  // 你原本的 CPU loop 在這裡（略），保留你 repo 的版本
  // 這份檔案主要修正「稱號 STATE 注入」，不改你 CPU 的行為
}

// ====== Socket.IO ======
io.on("connection", (socket) => {
  let joinedRoom = null;

  socket.on("AUTH_REGISTER", async (payload, cb) => {
    try{
      const { username, password } = payload || {};
      const u = await ensureUser(username, password);
      cb && cb(null, { ok:true, secret: u.secret });
    }catch(e){
      cb && cb(e?.message || "register failed");
    }
  });

  socket.on("AUTH_LOGIN", async (payload, cb) => {
    try{
      const { username, password } = payload || {};
      const u = await loginUser(username, password);
      cb && cb(null, { ok:true, secret: u.secret });
    }catch(e){
      cb && cb(e?.message || "login failed");
    }
  });

  socket.on("PROFILE_GET", async (payload, cb) => {
    try{
      const { secret } = payload || {};
      const profile = await getProfileBySecret(secret);
      cb && cb(null, { ok:true, profile: profile || null });
    }catch(e){
      cb && cb(e?.message || "profile_get failed");
    }
  });

  socket.on("PROFILE_SET", async (payload, cb) => {
    try{
      const { secret, profile } = payload || {};
      await upsertProfile(secret, profile || {});
      cb && cb(null, { ok:true });
    }catch(e){
      cb && cb(e?.message || "profile_set failed");
    }
  });

  // JOIN_ROOM: 等待室加入 / 重連
  socket.on("JOIN_ROOM", (payload = {}) => {
    const { roomId, displayName, avatar, secret, pid, title, titleTier } = payload || {};
    if (!roomId) return;

    let room = rooms.get(roomId);
    if (!room){
      room = makeRoom(roomId);
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

    // ★ 判斷房間是否已經在遊戲中
    const gameStarted = (room.phase === 'playing');

    // ★ 如果遊戲已經開始，而且沒找到舊座位，就拒絕中途加入
    if (gameStarted && myId == null) {
      io.to(socket.id).emit('EMIT', {
        type: 'toast',
        text: '本局已經開始，無法中途加入，請等下一局。'
      });
      return;
    }

    // ★ 1) 沒找到舊座位時：找第一個未綁 client 的位置（只會在 lobby 階段發生）
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

    // ✅ 稱號防呆（避免太長/亂值）
    const safeTitle = String(title || "").trim().slice(0, 18);
    const safeTier  = Math.max(1, Math.min(6, Number(titleTier || 1) || 1));

    p.client = { displayName, avatar, pid, title: safeTitle, titleTier: safeTier };
    p.displayName = displayName;
    p.avatar = avatar;
    p.secret = sec;

    // ✅ 也存一份在 player 本體上（你 broadcastLobby 用這份取最快）
    p.title = safeTitle;
    p.titleTier = safeTier;

    // 第一位為房主
    if (room.host == null) room.host = myId;

    // 先把「同一個玩家 + 同一個 secret」舊的 socket 清掉
    // 避免一個人重連後房間裡還掛著多個連線
    for (const [sid, meta] of room.sockets) {
      if (meta.playerId === myId && meta.secret === sec) {
        room.sockets.delete(sid);
      }
    }

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

      // ① 以「socket 的加入順序」作為座位順序；同時帶出名稱/頭像/secret（真人）
      const entries = Array.from(room.sockets.entries()); // [ [sid, meta], ... ]
      const joined = entries.map(([sid, m]) => {
        const oldP = room.state?.players?.[m.playerId];
        const safeTitle = String(oldP?.client?.title ?? oldP?.title ?? "").trim().slice(0, 18);
        const safeTier  = Math.max(1, Math.min(6, Number(oldP?.client?.titleTier ?? oldP?.titleTier ?? 1) || 1));

        return {
          sid,
          oldId: m.playerId,
          name: m.displayName || `P${m.playerId + 1}`,
          avatar: m.avatar || 1,
          secret: m.secret,

          // ✅ 新增：稱號
          title: safeTitle,
          titleTier: safeTier,
        };
      });

      const nHuman = joined.length;       // 真人數
      const cpu = room.cpuCount || 0;     // 等待室設定的
      const total = nHuman + cpu;         // 總人數 = 真人 + CPU

      // ★ 最低人數判斷：真人 + CPU 一起算
      if (total < 2){
        io.to(socket.id).emit('EMIT', {
          type:'toast',
          text:'至少需要 2 名玩家（包含 CPU）才能開始'
        });
        return;
      }

      // ② 必須全員 ready（只檢查真人，CPU 視為一開始就準備好）
      const notReady = joined.filter(j => !room.lobbyReady[j.oldId]);
      if (notReady.length){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'還有玩家尚未準備' });
        return;
      }

      // ③ 依「總人數」重建 state
      const st = createInitialState(total);
      st.cpuCount = cpu;   // 之後如果要給引擎用，可以參考這個欄位

      // ④ 組一個「座位池」：把所有真人 & CPU 丟進來，等等一起洗牌
      const seatPool = [];

      // 先把真人塞進 seatPool
      for (let i = 0; i < nHuman; i++) {
        seatPool.push({ kind: 'human', data: joined[i] });
      }

      // 再把 CPU 佔位塞進 seatPool
      for (let i = 0; i < cpu; i++) {
        seatPool.push({ kind: 'cpu' });
      }

      // 小工具：Fisher–Yates 洗牌，讓座位順序隨機
      for (let i = seatPool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [seatPool[i], seatPool[j]] = [seatPool[j], seatPool[i]];
      }

      // 預備：CPU 名稱 / 頭像、socket 新表、舊 id → 新 id 對照
      const cpuNames = ["克洛克達爾", "鷹眼密佛格", "小丑巴其"];
      const cpuAvatarIds = ["cpu1", "cpu2", "cpu3"];

      let cpuUsed = 0;                 // 已經用了第幾個 CPU 名稱
      const newSockets = new Map();    // sid → 新的 socket meta
      const idRemap = new Map();       // oldId → newPlayerId

      // ⑤ 把 seatPool 實際寫進 st.players
      for (let i = 0; i < seatPool.length; i++) {
        const seat = seatPool[i];
        const p = st.players[i];

        // 確保 player 自己的 id 也跟 index 對齊
        p.id = i;

        if (seat.kind === 'human') {
          const j = seat.data;

          // 真人：寫入名稱 / 頭像 / secret
          p.client = {
            displayName: j.name,
            avatar: j.avatar,
            pid: null,

            // ✅ 新增：稱號
            title: j.title || "",
            titleTier: Math.max(1, Math.min(6, Number(j.titleTier || 1) || 1)),
          };
          p.title = j.title || "";
          p.titleTier = Math.max(1, Math.min(6, Number(j.titleTier || 1) || 1));

          p.displayName = j.name;
          p.avatar = j.avatar;

          // ★ 關鍵：把舊的 secret 帶進來，讓之後重連可以靠 secret 找到你
          p.secret = j.secret;
          p.isCPU = false;

          // 建立 oldId → newId 對照（等一下要換 host、socket）
          idRemap.set(j.oldId, i);

          // 重建 socket meta（保留其它欄位）
          const oldMeta = room.sockets.get(j.sid) || {};
          newSockets.set(j.sid, {
            ...oldMeta,
            playerId: i,
            secret: j.secret,
            displayName: j.name,
            avatar: j.avatar,
          });

          // 通知真人自己的新座位
          io.to(j.sid).emit('JOINED', { playerId: i, secret: j.secret });
        } else {
          // CPU：照順序發名字 / 頭像，但座位是已經洗過的 i
          const idx = cpuUsed++;
          const cpuName   = cpuNames[idx]     || `CPU ${idx + 1}`;
          const cpuAvatar = cpuAvatarIds[idx] || "cpu1";

          p.client = {
            displayName: cpuName,
            avatar: cpuAvatar,
            pid: null,
          };
          p.displayName = cpuName;
          p.avatar = cpuAvatar;
          p.isCPU = true;
          p.secret = null;  // CPU 不需要 secret
        }
      }

      // 把 room.sockets 換成新的（playerId 已經是洗過座位）
      room.sockets = newSockets;

      // ⑥ host 也改成新座位（用 oldId → newId 對照）
      const newHost = idRemap.get(room.host);
      room.host = (newHost != null ? newHost : 0);

      // ⑦ 清空等待室 ready，寫回狀態並先廣播一版 STATE
      room.lobbyReady = {};
      room.state = st;
      room.phase = 'playing';
      broadcastState(room);

      // ★ 如果一開始就輪到 CPU，直接讓 CPU 先開始（含 2 秒 / 4 秒延遲）
      runCpuLoop(roomId);

      // ⑧ 導頁到 game.html（只會導真人的頁面，CPU 沒 socket）
      for (const [sid] of room.sockets) {
        io.to(sid).emit('EMIT', { type:'nav_game' });
      }
      return;
    }

    // 遊戲中：下一局（只有房主或本局勝利玩家可以按）
    if (type === 'NEXT_ROUND') {
      const st = room.state;

      // 先確認這一局真的結束了
      const ended = typeof isRoundEnded === "function"
        ? isRoundEnded(st)
        : (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");

      if (!ended) {
        socket.emit('EMIT', { type: 'toast', text: '本局尚未結束' });
        return;
      }

      // 找出這一局的勝利玩家（還活著的）
      const winners = new Set(st.players.filter(p => p.alive).map(p => p.id));

      // 只有房主或本局勝利者可以開下一局
      const can = (room.host === playerId) || winners.has(playerId);
      if (!can) {
        socket.emit('EMIT', { type: 'toast', text: '只有房主或本局勝者可以開始下一局' });
        return;
      }

      // nextRound 你本來的邏輯
      const next = nextRound(st);
      room.state = next;
      broadcastState(room);

      // 如果下一局輪到 CPU，跑 CPU loop
      runCpuLoop(roomId);
      return;
    }

    // 其它遊戲 action：統一走 engine
    applyAndBroadcast(room, action, io);

    // CPU：如果輪到 CPU，就跑
    runCpuLoop(roomId);
  });

  socket.on("SET_CPU", (payload = {}) => {
    const { roomId, cpuCount } = payload || {};
    const room = rooms.get(roomId);
    if (!room) return;
    room.cpuCount = Math.max(0, Math.min(3, Number(cpuCount || 0) || 0));
    broadcastLobby(roomId);
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;
    room.sockets.delete(socket.id);

    // 如果房間沒人了就清掉
    if (room.sockets.size === 0){
      rooms.delete(joinedRoom);
      return;
    }

    broadcastLobby(joinedRoom);
    broadcastState(room);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log("Server listening on", PORT);
});
