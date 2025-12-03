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

const {
  pickCpuCardSmart,
  pickCpuTargetSmart,
  pickCpuDigitSmart,
} = require("./cpu.js");


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
  cpuCount: room.cpuCount || 0,   // ← 新增：房間有幾個 CPU
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

// ---------- 統一套用 applyAction + 廣播 EMIT / STATE ----------
function applyAndBroadcast(room, action, io){
  const res = applyAction(room.state, action);
  room.state = res.state;

  // 1) 先把 EMIT 事件照舊丟給前端
  for (const e of (res.emits || [])) {
    if (e.to === "all") {
      for (const [sid] of room.sockets) io.to(sid).emit("EMIT", e);
    } else {
      for (const [sid, meta] of room.sockets) {
        if (meta.playerId === e.to) io.to(sid).emit("EMIT", e);
      }
    }
  }

  // 2) 再廣播一次 STATE
  broadcastState(room);
}

// 判斷目前是否輪到 CPU（原本那個保留即可）
function isCpuTurn(room){
  const st = room.state;
  if (!st) return false;
  const idx = st.turnIndex;
  const p = st.players && st.players[idx];
  return !!(p && p.isCPU && p.alive);
}

// 讓 CPU 自動行動：
// - 抽牌 → 等 2 秒
// - 出牌 → 等 4 秒
// - 如果卡在 pending（騙人布/羅賓/索隆/羅/娜美/魯夫/凱多/青雉/基拉/大媽/羅傑…）
//   就自動送 PICK_TARGET / PICK_DIGIT / LUFFY_SECOND / BIGMOM_COIN 等
function runCpuLoop(roomId){
  const room = rooms.get(roomId);
  if (!room) return;

  const step = () => {
    const roomNow = rooms.get(roomId);
    if (!roomNow) return;
    const st = roomNow.state;
    if (!st) return;

    const delay = (ms) => setTimeout(step, ms);
    const pending = st.pending || null;

    // 目前只讓「輪到的玩家是 CPU」時自動動作
    const meIdx = st.turnIndex;
    const me = st.players && st.players[meIdx];
    if (!me || !me.isCPU || !me.alive) {
      return; // 不輪到 CPU → 不動
    }

    // ========= ① 先處理 pending 的互動 =========
    if (pending) {
      const act = pending.action;

      // --- 1 騙人布：選目標 → 猜尾數 ---
      if (act === 'usopp') {
        if (!pending.extra || pending.extra.target == null) {
          const targetIdx = pickCpuTargetSmart(st, meIdx, {
            for: 'usopp',
            avoidProtected: true,
            avoidDodging: true,
          });
          if (targetIdx == null) return;

          applyAndBroadcast(roomNow, {
            type: 'PICK_TARGET',
            playerId: meIdx,
            payload: { target: targetIdx },
          }, io);

          delay(1500);
          return;
        }

        const d = pickCpuDigitSmart(st, meIdx, pending.extra.target);
        applyAndBroadcast(roomNow, {
          type: 'PICK_DIGIT',
          playerId: meIdx,
          payload: { digit: d },
        }, io);

        delay(1500);
        return;
      }

      // --- 2 羅賓：選一個人偷看 ---
      if (act === 'robin') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'robin',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 3 香吉士：挑一個人決鬥 ---
      if (act === 'sanji') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'sanji',
          avoidProtected: true,
          avoidDodging: true,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 5 索隆：選一個人丟手牌 ---
      if (act === 'zoro') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'zoro',
          avoidProtected: true,
          avoidDodging: true,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 6 羅：選一個人交換 ---
      if (act === 'law') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'law',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 7 娜美（強化）：選一個人麻痺 ---
      if (act === 'nami') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'nami',
          avoidProtected: true,
          avoidDodging: true,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 10 凱多：選一個人決鬥（無視保護/閃避） ---
      if (act === 'kaido') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'kaido',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 16 青雉：選一個人凍結 ---
      if (act === 'aokiji') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'aokiji',
          avoidProtected: true,
          avoidDodging: true,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 13 基拉：選一個人解除保護/閃避 ---
      if (act === 'killer') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'killer',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 14 大媽強化（萬國）：選一個人收保護費/處刑 ---
      if (act === 'bigmom') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'bigmom',
          avoidProtected: true,
          avoidDodging: true,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // --- 14 大媽一般：自己擲硬幣拿保護/閃避 ---
      if (act === 'bigmom-coin') {
        applyAndBroadcast(roomNow, {
          type: 'BIGMOM_COIN',
          playerId: meIdx,
        }, io);

        delay(1500);
        return;
      }

      // --- 8 魯夫：第一次決鬥 + 第二次決鬥 ---
      if (act === 'luffy') {
        // 第一次決鬥：先挑一個人
        if (!pending.extra || !pending.extra.firstDone) {
          const targetIdx = pickCpuTargetSmart(st, meIdx, {
            for: 'luffy',
            avoidProtected: true,
            avoidDodging: true,
          });
          if (targetIdx == null) return;

          applyAndBroadcast(roomNow, {
            type: 'PICK_TARGET',
            playerId: meIdx,
            payload: { target: targetIdx },
          }, io);

          delay(1500);
          return;
        }

        // 已做過第一次 → 第二次決鬥（沒有合適對象就傳 -1）
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'luffy-second',
          avoidProtected: true,
          avoidDodging: true,
        });
        const sendTarget = (targetIdx == null) ? -1 : targetIdx;

        applyAndBroadcast(roomNow, {
          type: 'LUFFY_SECOND',
          playerId: meIdx,
          payload: { target: sendTarget },
        }, io);

        delay(1500);
        return;
      }

      // --- 8 魯夫魚人島強化：是否發動全場大砍 ---
      if (act === 'luffy-boost') {
        applyAndBroadcast(roomNow, {
          type: 'LUFFY_BOOST_COMMIT',
          playerId: meIdx,
          payload: { go: true },   // CPU 一律選發動
        }, io);

        delay(800);
        return;
      }

      // --- 19 羅傑（有奧羅傑克森號）：預測勝者 ---
      if (act === 'roger') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'roger',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        delay(1500);
        return;
      }

      // 其他暫時沒處理的 pending（例如卡塔庫栗頂牌排序）先不動
      return;
    }

    // ========= ② 沒有 pending：正常「抽牌 → 出牌」 =========
    if (st.turnStep === 'draw') {
      applyAndBroadcast(roomNow, {
        type: 'DRAW',
        playerId: meIdx,
      }, io);

      delay(2000);   // 抽牌動畫 2 秒
      return;
    }

    if (st.turnStep === 'choose') {
      const which = pickCpuCardSmart(st, meIdx); // 'hand' 或 'drawn'

      applyAndBroadcast(roomNow, {
        type: 'PLAY_CARD',
        playerId: meIdx,
        payload: { which },
      }, io);

      delay(4000);   // 出牌展示 4 秒
      return;
    }

    // 其他 turnStep（例如結算中 / 換人中） → 不再自動動作
  };

  // 啟動第一次檢查
  step();
}




// ——— Socket.IO ———
io.on("connection", (socket) => {
  let joinedRoom = null;

socket.on("JOIN_ROOM", (payload = {}) => {
  const {
    roomId,
    displayName = "",
    avatar = 1,
    secret = "",
    pid,
    cpuCount,        // ← 接收從前端傳來的 CPU 數量
  } = payload;

    if (!roomId) return;

// 建房：暫給 1 位座位（真正開始時會重建）
let room = rooms.get(roomId);
if (!room) {
  const safeCpu = typeof cpuCount === "number"
    ? Math.max(0, Math.min(3, cpuCount))  // 限制在 0~3
    : 0;

  room = {
    state: createInitialState(1),
    sockets: new Map(),
    host: null,
    lobbyReady: {},
    phase: 'lobby',          // 目前還在等待室階段
    cpuCount: safeCpu,       // ← 新增：這個房間預計的 CPU 人數
  };
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
    p.client = { displayName, avatar, pid };
    p.displayName = displayName;
    p.avatar = avatar;
    p.secret = sec;             // ← 關鍵：把 secret 綁到這個玩家

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
      const joined = entries.map(([sid, m]) => ({
        sid,
        oldId: m.playerId,
        name: m.displayName || `P${m.playerId + 1}`,
        avatar: m.avatar || 1,
        secret: m.secret,
      }));

      const nHuman = joined.length;       // 真人數
      const cpu = room.cpuCount || 0;     // 等待室設定的 CPU 數
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

      // ④ 把名字/頭像/secret 寫進 players（真人部分：0 ~ nHuman-1）
      for (let i = 0; i < nHuman; i++){
        const j = joined[i];
        const p = st.players[i];
        p.client = {
          displayName: j.name,
          avatar: j.avatar,
          pid: null,
        };
        p.displayName = j.name;
        p.avatar = j.avatar;
        p.secret = j.secret;    // ← 把 secret 帶到新 state
      }

      // ⑤ CPU 座位：補上名稱與專用頭像（位置：nHuman ~ total-1）
      const cpuAvatarIds = ['cpu1', 'cpu2', 'cpu3'];

      for (let i = nHuman; i < total; i++) {
        const p = st.players[i];
        const idx = i - nHuman;                 // 第幾個 CPU（從 0 開始）
        const cpuName = `CPU ${idx + 1}`;
        const cpuAvatar = cpuAvatarIds[idx % cpuAvatarIds.length];

        // 統一格式，跟真人一樣有 client 區塊
        p.client = {
          displayName: cpuName,
          avatar: cpuAvatar,
          pid: null,
        };
        p.displayName = cpuName;
        p.avatar = cpuAvatar;   // ← 關鍵：這裡寫 'cpu1' / 'cpu2' / 'cpu3'
        p.isCPU = true;         // 可選：之後若前端要特別標示 CPU 可以用
      }


      // ⑤ 重新對齊 socket 的 playerId（oldId → 新座位 i），並回傳新的 JOINED（只針對真人）
      const newSockets = new Map();
      for (let i = 0; i < joined.length; i++){
        const { sid, secret: sec } = joined[i];
        const oldMeta = room.sockets.get(sid) || {};
        newSockets.set(sid, {
          ...oldMeta,
          playerId: i,    // 新座位就是 i
          secret: sec,
        });
        io.to(sid).emit('JOINED', { playerId: i, secret: sec });
      }
      room.sockets = newSockets;

      // ⑥ host 也改成新座位
      const remap = new Map(joined.map((j, idx) => [j.oldId, idx]));
      const newHost = remap.get(room.host);
      room.host = (newHost != null ? newHost : 0);

      // ⑦ 清空等待室 ready，寫回狀態並先廣播一版 STATE
      room.lobbyReady = {};
      room.state = st;
      room.phase = 'playing';
      broadcastState(room);

      // ★ 如果一開始就輪到 CPU，直接讓 CPU 先開始（含 2 秒 / 4 秒延遲）
      runCpuLoop(roomId);


      // ⑧ 導頁到 game.html（只會導真人的頁面，CPU 沒 socket）
      for (const [sid] of room.sockets){
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

      // 正式進入下一局
       const ns = nextRound(st);
      room.state = ns;
      broadcastState(room);

      // ★ 如果下一局起始玩家是 CPU，一樣讓 CPU 先動（含延遲）
      runCpuLoop(roomId);
      return;

    }   // ★★★ 多這一行，把 NEXT_ROUND 的 if 收起來

    // 遊戲內其他行為 → 交給引擎（統一用 helper）
     // 遊戲內其他行為 → 交給引擎（統一用 helper）
    applyAndBroadcast(room, action, io);

    // ★ 玩家行動結束後，如果接下來輪到的是 CPU，就讓 CPU 自動行動（含 2 秒 / 4 秒延遲）
    runCpuLoop(roomId);
  });




  socket.on("disconnect", () => {
    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;

    const meta = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);

    if (meta && room.lobbyReady) delete room.lobbyReady[meta.playerId];

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
