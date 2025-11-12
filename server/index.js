// server/index.js — 靜態檔 + Socket.IO（/lobby 等待室 + / 遊戲本體）
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const crypto = require("crypto");

// 引擎：純函式
const {
  createInitialState,
  applyAction,
  getVisibleState,
} = require("./engine.js");

// === 1) HTTP 靜態檔 ===
const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (_req, res) => res.redirect("/start.html"));

const server = http.createServer(app);

// === 2) Socket.IO（允許跨網域前端） ===
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// -------------------------------
// A. 等待室（/lobby）
// -------------------------------
const lobby = io.of("/lobby");

/**
 * roomsLobby: Map<roomId, {
 *   players: Map<socketId, { pid: string, name: string, avatar: number, seat: number }>
 *   hostSid: string|null
 *   createdAt: number
 * }>
 *
 * 備註：
 * - seat 從 0 開始，先到先拿空位（供導頁到 game.html 時參考）
 * - 這份只是等待室資料；遊戲開始後，實際的 playerId 由遊戲 namespace 分派
 */
const roomsLobby = new Map();

function nextFreeSeat(room) {
  // 連續座位 0..N，取目前未被占用的最小 seat
  const used = new Set([...room.players.values()].map((p) => p.seat));
  let s = 0;
  while (used.has(s)) s++;
  return s;
}

function getLobbyRoom(roomId) {
  if (!roomsLobby.has(roomId)) {
    roomsLobby.set(roomId, {
      players: new Map(),
      hostSid: null,
      createdAt: Date.now(),
    });
  }
  return roomsLobby.get(roomId);
}

function broadcastLobbyState(roomId) {
  const r = roomsLobby.get(roomId);
  if (!r) return;
  const list = [...r.players.entries()].map(([sid, p]) => ({
    sid,
    pid: p.pid,
    name: p.name,
    avatar: p.avatar,
    seat: p.seat,
    isHost: r.hostSid === sid,
  }));
  lobby.to(roomId).emit("LOBBY_STATE", {
    roomId,
    players: list,
    hostSid: r.hostSid,
  });
}

lobby.on("connection", (socket) => {
  let joinedRoomId = null;

  socket.on("LOBBY_ENTER", ({ roomId, pid, name, avatar }) => {
    if (!roomId || !pid) return;
    joinedRoomId = roomId;
    socket.join(roomId);

    const r = getLobbyRoom(roomId);
    if (!r.hostSid) r.hostSid = socket.id;

    const seat = nextFreeSeat(r);
    r.players.set(socket.id, {
      pid: String(pid),
      name: String(name || ""),
      avatar: Number(avatar) || 1,
      seat,
    });

    broadcastLobbyState(roomId);
  });

  socket.on("LOBBY_READY", ({ roomId /*, pid, ready*/ }) => {
    // 這版等待室只同步名單；是否準備交給前端本地顯示即可
    // 若要後端強制檢查 ready，可再擴充此資料結構
    if (!roomId) return;
    broadcastLobbyState(roomId);
  });

  socket.on("LOBBY_LEAVE", ({ roomId }) => {
    const r = roomsLobby.get(roomId);
    if (!r) return;
    r.players.delete(socket.id);
    if (r.players.size === 0) {
      roomsLobby.delete(roomId);
    } else if (r.hostSid === socket.id) {
      const firstSid = r.players.keys().next().value || null;
      r.hostSid = firstSid;
    }
    broadcastLobbyState(roomId);
  });

  socket.on("LOBBY_START", ({ roomId, pid, serverURL }) => {
    const r = roomsLobby.get(roomId);
    if (!r) return;
    if (r.hostSid !== socket.id) return; // 只有房主能開始

    // 廣播導頁：每個人各自帶自己的名字/頭像（前端會直接跳 /game.html）
    for (const [sid, p] of r.players.entries()) {
      lobby.to(sid).emit("LOBBY_NAV", {
        roomId,
        serverURL,
        name: p.name,
        avatar: p.avatar,
        seat: p.seat, // 給前端參考（非必要）
      });
    }
    // 是否要清空等待室，視情況；這裡保留，以便中途有人斷線還能看名單
  });

  socket.on("disconnect", () => {
    if (!joinedRoomId) return;
    const r = roomsLobby.get(joinedRoomId);
    if (!r) return;
    r.players.delete(socket.id);
    if (r.players.size === 0) {
      roomsLobby.delete(joinedRoomId);
    } else if (r.hostSid === socket.id) {
      const firstSid = r.players.keys().next().value || null;
      r.hostSid = firstSid;
    }
    broadcastLobbyState(joinedRoomId);
  });
});

// -------------------------------
// B. 遊戲本體（/）
// -------------------------------

/**
 * rooms: Map<roomId, {
 *   state: StateObject,
 *   maxPlayers: number,
 *   claims: boolean[],                // 哪些 playerId 已經被占用
 *   sockets: Map<socketId, { playerId: number, secret: string }>,
 *   createdAt: number
 * }>
 *
 * JOIN_ROOM 流程：
 *  - 若 room 不存在 → 以「等待室人數」優先，否則以 client 傳的 playerCount 建 state
 *  - 該玩家取得第一個未被占用的 playerId
 *  - 立刻把 displayName / avatar 寫入 state.players[playerId]
 *  - 回傳 JOINED { playerId, secret }
 *  - 廣播 STATE（每人用 getVisibleState 遮蔽）
 */
const rooms = new Map();

function makeSecret() {
  return crypto.randomBytes(12).toString("hex");
}

function broadcastState(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const st = room.state;

  // 依照每個 socket 的 playerId，送出各自可見的 STATE
  for (const [sid, meta] of room.sockets.entries()) {
    const vis = getVisibleState(st, meta.playerId);
    io.to(sid).emit("STATE", vis);
  }
}

io.on("connection", (socket) => {
  let joinedRoom = null;
  let myPlayerId = null;

  socket.on("JOIN_ROOM", ({ roomId, displayName, avatar, playerCount }) => {
    if (!roomId) return;

    // 1) 建立 / 取得房間
    if (!rooms.has(roomId)) {
      // 優先用等待室的人數（跨裝置從 start.html 進來會有），否則用前端傳的 playerCount
      const rLobby = roomsLobby.get(roomId);
      const n =
        (rLobby && rLobby.players.size) ||
        Number(playerCount) ||
        4; // 最低 4 位，避免 0

      const st = createInitialState(n);
      rooms.set(roomId, {
        state: st,
        maxPlayers: n,
        claims: Array(n).fill(false),
        sockets: new Map(),
        createdAt: Date.now(),
      });

      // 若有等待室，試著把名字/頭像帶進 state
      if (rLobby) {
        for (const p of rLobby.players.values()) {
          const seat = Math.min(Math.max(0, Number(p.seat) || 0), n - 1);
          st.players[seat].displayName = p.name || st.players[seat].displayName;
          st.players[seat].avatar = Number(p.avatar) || st.players[seat].avatar;
        }
      }
    }

    const room = rooms.get(roomId);
    if (!room) return;

    // 2) 指派 playerId：取第一個空位
    let pid = room.claims.findIndex((v) => !v);
    if (pid === -1) {
      // 滿員就拒絕（也可以改成觀戰）
      socket.emit("ERROR", { message: "Room is full" });
      return;
    }

    room.claims[pid] = true;
    joinedRoom = roomId;
    myPlayerId = pid;

    // 3) 寫入該玩家的顯示名與頭像（立刻反映在 state）
    try {
      const p = room.state.players[pid];
      if (displayName) p.displayName = String(displayName);
      if (avatar != null) p.avatar = Number(avatar) || p.avatar;
      // 額外保留 client 欄位（引擎有些 log 會取 p.client.displayName）
      p.client = { displayName: p.displayName, avatar: p.avatar };
    } catch (_) {}

    // 4) 建立私密 secret，回覆 JOINED
    const secret = makeSecret();
    room.sockets.set(socket.id, { playerId: pid, secret });
    socket.emit("JOINED", { playerId: pid, secret });

    // 5) 廣播 STATE（每人不同）
    broadcastState(roomId);
  });

  socket.on("ACTION", ({ type, roomId, playerId, payload, secret }) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const meta = room.sockets.get(socket.id);
    if (!meta) return;

    // 安全檢查：playerId 與 secret 必須相符
    if (meta.playerId !== Number(playerId)) return;
    if (meta.secret !== String(secret || "")) return;

    // 交由引擎處理
    const action = {
      type: String(type),
      roomId,
      playerId: meta.playerId,
      payload: payload || {},
    };

    const { state: newState, emits } = applyAction(room.state, action);
    room.state = newState;

    // 處理引擎的「一對多 / 一對一」事件
    if (Array.isArray(emits)) {
      for (const e of emits) {
        if (!e) continue;
        if (e.to === "all") {
          io.to([...room.sockets.keys()]).emit("EMIT", e);
        } else if (typeof e.to === "number") {
          // 發給特定玩家（找他的 socket）
          for (const [sid, m] of room.sockets.entries()) {
            if (m.playerId === e.to) {
              io.to(sid).emit("EMIT", e);
            }
          }
        }
      }
    }

    // 最後廣播 STATE（遮蔽視野）
    broadcastState(roomId);
  });

  socket.on("disconnect", () => {
    if (!joinedRoom) return;

    const room = rooms.get(joinedRoom);
    if (!room) return;

    const meta = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);

    if (meta && typeof meta.playerId === "number") {
      room.claims[meta.playerId] = false;
      // （不自動改名/清人，保留原座位給重連；若想釋放座位，可在此重排）
    }

    // 若完全無人連線，可以選擇回收（避免佔記憶體）
    if (room.sockets.size === 0) {
      // 保留 30 分鐘，以便中途重連；你也可改成立即刪除
      const TTL = 30 * 60 * 1000;
      if (Date.now() - room.createdAt > TTL) {
        rooms.delete(joinedRoom);
      }
    }
  });
});

// === 3) 監聽埠（Render 會注入 PORT） ===
const PORT = process.env.PORT || 8787;
server.listen(PORT, () => console.log("Server listening on", PORT));
