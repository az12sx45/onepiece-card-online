// server/index.js — 動態人數/無佔位 + 正確對齊 playerId + 開局即廣播 STATE
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = process.env.JWT_TTL || "30d";

function signToken(user){
  return jwt.sign({ sub: user.id, u: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function readBearer(req){
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}
function authRequired(req, res, next){
  const token = readBearer(req);
  if(!token) return res.status(401).json({ ok:false, error:"NO_TOKEN" });
  try{
    const dec = jwt.verify(token, JWT_SECRET);
    req.user = { id: dec.sub, username: dec.u };
    return next();
  }catch(e){
    return res.status(401).json({ ok:false, error:"BAD_TOKEN" });
  }
}

// Render PostgreSQL: use DATABASE_URL; enable SSL in production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
});

async function ensureSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_data(
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    avatar INT NOT NULL DEFAULT 1,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
}

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


const app = express();
const JSON_LIMIT = process.env.JSON_LIMIT || "2mb";
app.use(express.json({ limit: JSON_LIMIT }));

// ---- Auth APIs ----
app.post("/api/auth/register", async (req, res) => {
  try{
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if(username.length < 3 || username.length > 32) return res.status(400).json({ ok:false, error:"BAD_USERNAME" });
    if(password.length < 6 || password.length > 72) return res.status(400).json({ ok:false, error:"BAD_PASSWORD" });

    const pass_hash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    await pool.query("INSERT INTO users(id, username, pass_hash) VALUES($1,$2,$3)", [id, username, pass_hash]);
    await pool.query("INSERT INTO user_data(user_id, display_name, avatar, profile) VALUES($1,$2,$3,$4::jsonb)", [id, "", 1, JSON.stringify({ version:1, totals:{games:0,wins:0,coins:0}, recent:[], titles:{owned:[],equipped:"",equippedTier:1}, deluxeUnlocked:[] })]);

    const token = signToken({ id, username });
    return res.json({ ok:true, token, user:{ id, username } });
  }catch(e){
    if(String(e?.code||"") === "23505") return res.status(409).json({ ok:false, error:"USERNAME_TAKEN" });
    console.error("[register]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try{
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const { rows } = await pool.query("SELECT id, username, pass_hash FROM users WHERE username=$1", [username]);
    const u = rows[0];
    if(!u) return res.status(401).json({ ok:false, error:"BAD_CREDENTIALS" });
    const ok = await bcrypt.compare(password, u.pass_hash);
    if(!ok) return res.status(401).json({ ok:false, error:"BAD_CREDENTIALS" });

    const token = signToken({ id: u.id, username: u.username });
    return res.json({ ok:true, token, user:{ id: u.id, username: u.username } });
  }catch(e){
    console.error("[login]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  try{
    const { rows } = await pool.query("SELECT display_name, avatar, profile FROM user_data WHERE user_id=$1", [req.user.id]);
    const d = rows[0];
    if(!d) return res.status(404).json({ ok:false, error:"NO_PROFILE" });
    return res.json({ ok:true, user:{ id:req.user.id, username:req.user.username, displayName:d.display_name, avatar:d.avatar }, profile:d.profile || {} });
  }catch(e){
    console.error("[me]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

// 更新玩家顯示名稱/頭貼（雲端）
app.post("/api/me/player", authRequired, async (req, res) => {
  try{
    const displayName = String(req.body?.displayName || "").trim().slice(0,16);
    const avatar = Math.max(1, Math.min(30, Number(req.body?.avatar || 1)));
    await pool.query("UPDATE user_data SET display_name=$2, avatar=$3, updated_at=now() WHERE user_id=$1", [req.user.id, displayName, avatar]);
    return res.json({ ok:true });
  }catch(e){
    console.error("[me/player]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

// 同步整份玩家頁資料（結算頁/玩家頁把 local profile 推上來）
app.post("/api/me/sync", authRequired, async (req, res) => {
  try{
    const profile = req.body?.profile;
    const player  = req.body?.player;
    if(!profile || typeof profile !== "object") return res.status(400).json({ ok:false, error:"BAD_PROFILE" });

    // 基本防呆與裁切（避免過大）
    const safeProfile = JSON.parse(JSON.stringify(profile));
    if(Array.isArray(safeProfile.recent)) safeProfile.recent = safeProfile.recent.slice(0,10);
    if(Array.isArray(safeProfile._appliedMatchKeys)) safeProfile._appliedMatchKeys = safeProfile._appliedMatchKeys.slice(0,200);

    let displayName = "";
    let avatar = 1;
    if(player && typeof player === "object"){
      displayName = String(player.playerName || player.displayName || "").trim().slice(0,16);
      avatar = Math.max(1, Math.min(30, Number(player.playerAvatar || player.avatar || 1)));
    }

    // 先讀舊資料，做「合併」而非覆蓋（避免不同裝置互相蓋掉）
    const { rows } = await pool.query("SELECT display_name, avatar, profile FROM user_data WHERE user_id=$1", [req.user.id]);
    const cur = rows[0] || { display_name:"", avatar:1, profile:{} };

    const merged = {
      ...(cur.profile || {}),
      ...safeProfile,
    };

    // 合併 recent / owned / deluxeUnlocked（做 union）
    const uniqBy = (arr, keyFn)=>{
      const out=[]; const seen=new Set();
      for(const it of (Array.isArray(arr)?arr:[])){
        const k = String(keyFn(it));
        if(!k || seen.has(k)) continue;
        seen.add(k); out.push(it);
      }
      return out;
    };

    // recent 以 matchKey 去重，保留最新 10
    if(Array.isArray(cur.profile?.recent) || Array.isArray(safeProfile?.recent)){
      const a = Array.isArray(safeProfile?.recent) ? safeProfile.recent : [];
      const b = Array.isArray(cur.profile?.recent) ? cur.profile.recent : [];
      merged.recent = uniqBy([...a, ...b], x=>x?.matchKey||JSON.stringify(x)).slice(0,10);
    }

    // titles.owned union
    if(merged.titles && (cur.profile?.titles || safeProfile?.titles)){
      const ownedA = Array.isArray(safeProfile?.titles?.owned) ? safeProfile.titles.owned : [];
      const ownedB = Array.isArray(cur.profile?.titles?.owned) ? cur.profile.titles.owned : [];
      // 允許 string 或 {label,tier}
      const normOwned = (list)=>{
        const out=[];
        for(const it of (Array.isArray(list)?list:[])){
          if(typeof it === "string"){
            const label = it.trim(); if(!label) continue;
            out.push({ label, tier:1 });
          }else if(it && typeof it === "object"){
            const label = String(it.label ?? it.text ?? "").trim();
            if(!label) continue;
            const tier = Math.max(1, Math.min(6, Number(it.tier ?? it.level ?? 1) || 1));
            out.push({ label, tier });
          }
        }
        // 同名取最高 tier
        const map=new Map();
        for(const x of out){
          const prev = map.get(x.label);
          if(!prev || x.tier > prev.tier) map.set(x.label, x);
        }
        return [...map.values()];
      };
      const mergedOwned = normOwned([...ownedA, ...ownedB]);
      merged.titles = merged.titles || {};
      merged.titles.owned = mergedOwned;
    }

    // deluxeUnlocked union
    const dA = Array.isArray(safeProfile?.deluxeUnlocked) ? safeProfile.deluxeUnlocked : [];
    const dB = Array.isArray(cur.profile?.deluxeUnlocked) ? cur.profile.deluxeUnlocked : [];
    const dSet = new Set([...dA, ...dB].map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>=0 && n<=19));
    merged.deluxeUnlocked = [...dSet];

    // totals：取較大（避免重複加總）
    if(merged.totals){
      const tg = Number(merged.totals.games)||0;
      const tw = Number(merged.totals.wins)||0;
      const tc = Number(merged.totals.coins)||0;
      const cg = Number(cur.profile?.totals?.games)||0;
      const cw = Number(cur.profile?.totals?.wins)||0;
      const cc = Number(cur.profile?.totals?.coins)||0;
      merged.totals = {
        games: Math.max(tg, cg),
        wins:  Math.max(tw, cw),
        coins: Math.max(tc, cc),
      };
    }

    const finalDisplayName = displayName || cur.display_name || "";
    const finalAvatar = avatar || cur.avatar || 1;

    await pool.query(
      "UPDATE user_data SET display_name=$2, avatar=$3, profile=$4::jsonb, updated_at=now() WHERE user_id=$1",
      [req.user.id, finalDisplayName, finalAvatar, JSON.stringify(merged)]
    );

    return res.json({ ok:true });
  }catch(e){
    console.error("[me/sync]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "start.html"));
});
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
io.use((socket, next)=>{
  const token = socket.handshake.auth?.token;
  if(!token) return next(); // 前端若未帶 token，後續 JOIN_ROOM 會擋；這裡不硬擋以免影響靜態頁
  try{
    const dec = jwt.verify(token, JWT_SECRET);
    socket.user = { id: dec.sub, username: dec.u };
  }catch(e){
    // token 無效也先放行，JOIN_ROOM 時再處理提示
  }
  next();
});


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

// ================= CPU 抽牌延遲設定（依上一張牌，一般 / 強化） =================

// 你給的表格（我已經幫你換算成毫秒）
//
// 一般：
// 0-4秒,1-4秒,2-4秒,3-8秒,4-4秒,5-4秒,6-4秒,7-4秒,
// 8-8秒,9-4秒,10-8秒,11-4秒,12-8秒,13-4秒,14-8秒,
// 15-4秒,16-4秒,17-4秒,18-4秒,19-4秒
//
// 強化：
// 0-10秒,1-4秒,2-10秒,3-8秒,4-10秒,5-4秒,6-4秒,7-4秒,
// 8-8秒,9-14秒,10-8秒,11-13秒,12-13秒,13-4秒,14-8秒,
// 15-4秒,16-15秒,17-4秒,18-4秒,19-4秒

const PREV_CARD_DELAY = {
  0:  { normal: 4000,  enhanced: 10000 },
  1:  { normal: 4000,  enhanced: 4000  },
  2:  { normal: 4000,  enhanced: 10000 },
  3:  { normal: 13000,  enhanced: 13000  },
  4:  { normal: 4000,  enhanced: 10000 },
  5:  { normal: 4000,  enhanced: 4000  },
  6:  { normal: 4000,  enhanced: 4000  },
  7:  { normal: 4000,  enhanced: 4000  },
  8:  { normal: 13000,  enhanced: 12000  },
  9:  { normal: 4000,  enhanced: 17000 },
  10: { normal: 13000,  enhanced: 8000  },
  11: { normal: 4000,  enhanced: 18000 },
  12: { normal: 8000,  enhanced: 16000 },
  13: { normal: 4000,  enhanced: 13000  },
  14: { normal: 8000,  enhanced: 8000  },
  15: { normal: 4000,  enhanced: 4000  },
  16: { normal: 4000,  enhanced: 15000 },
  17: { normal: 4000,  enhanced: 4000  },
  18: { normal: 4000,  enhanced: 4000  },
  19: { normal: 4000,  enhanced: 4000  },
};

// ================= CPU「打出牌後」延遲設定（依這張牌，一般 / 強化） =================
// 單位：毫秒
const PLAY_CARD_DECISION_DELAY = {
  0:  { normal: 4000,  enhanced: 6000  },  // 薩波
  1:  { normal: 4000,  enhanced: 10000  },  // 騙人布
  2:  { normal: 4000,  enhanced: 10000  },  // 羅賓
  3:  { normal: 4000,  enhanced: 9000  },  // 香吉士
  4:  { normal: 4000,  enhanced: 6000  },  // 喬巴
  5:  { normal: 4000,  enhanced: 17000  },  // 索隆
  6:  { normal: 4000,  enhanced: 12000  },  // 羅
  7:  { normal: 4000,  enhanced: 10000  },  // 娜美
  8:  { normal: 4000,  enhanced: 13000  },  // 魯夫
  9:  { normal: 4000,  enhanced: 14000  },  // 女帝
  10: { normal: 4000,  enhanced: 8000  },  // 凱多
  11: { normal: 4000,  enhanced: 9000  },  // 基德
  12: { normal: 4000,  enhanced: 9000  },  // 奎因
  13: { normal: 4000,  enhanced: 20000  },  // 基拉
  14: { normal: 4000,  enhanced: 12000  },  // 大媽
  15: { normal: 4000,  enhanced: 19000  },  // 卡塔庫栗
  16: { normal: 4000,  enhanced: 9000  },  // 青雉
  17: { normal: 4000,  enhanced: 16000  },  // 黑鬍子
  18: { normal: 4000,  enhanced: 14000  },  // 紅髮
  19: { normal: 4000,  enhanced: 21000 },  // 羅傑
};

// ================= 魯夫第一次決鬥 → 第二次決鬥 中間的延遲 =================
// 單位：毫秒
// normal ＝ 一般魯夫；enhanced 這裡其實用不到，先留欄位給你之後調整
const LUFFY_SECOND_GAP = {
  normal: 10000,   // 一般魯夫：1.5 秒（你可以自己改）
  enhanced: 1500, // 先隨便設，實際只會用在一般魯夫
};


// 判斷一張卡現在是不是在自己的強化場地上
function isEnhancedNowServer(st, cardId) {
  if (cardId == null) return false;
  const card = cardById(cardId);
  if (!card || !card.venue) return false;
  if (!Array.isArray(st.venues)) return false;
  return st.venues.some(v => v && v.name === card.venue);
}

// 從棄牌堆拿到「最後一張被打出去的卡 id」
function getLastPlayedCardId(st) {
  const disc = st.discard;
  if (!Array.isArray(disc) || disc.length === 0) return null;

  // 從後面往前找第一筆有 id 的
  for (let i = disc.length - 1; i >= 0; i--) {
    const d = disc[i];
    if (typeof d === "number") return d;
    if (d && typeof d.id === "number") return d.id;
  }
  return null;
}

// 根據上一張牌，算出 CPU 抽牌前要延遲多久（毫秒）
// 沒有設定的卡 → 回傳 0
function getDelayForPrevCard(st) {
  const lastId = getLastPlayedCardId(st);
  if (lastId == null) return 0;

  const cfg = PREV_CARD_DELAY[lastId];
  if (!cfg) return 0;

  const enhanced = isEnhancedNowServer(st, lastId);
  if (enhanced && typeof cfg.enhanced === "number") {
    return cfg.enhanced;
  }
  if (!enhanced && typeof cfg.normal === "number") {
    return cfg.normal;
  }
  return 0;
}

// 根據「最後一張打出的牌」，決定 CPU 出牌後要延遲多久（毫秒）
// 會依照 PLAY_CARD_DECISION_DELAY + 是否強化 來決定
function getDelayAfterPlay(st) {
  const lastId = getLastPlayedCardId(st);
  if (lastId == null) return 4000;   // 找不到就給一個預設值（例如 4 秒）

  const cfg = PLAY_CARD_DECISION_DELAY[lastId];
  if (!cfg) return 4000;

  const enhanced = isEnhancedNowServer(st, lastId);

  // 強化版 → 用 enhanced
  if (enhanced && typeof cfg.enhanced === "number") {
    return cfg.enhanced;
  }

  // 一般版 → 用 normal
  if (!enhanced && typeof cfg.normal === "number") {
    return cfg.normal;
  }

  return 4000;
}

// 根據現在狀態，決定「魯夫第一次決鬥 → 第二次決鬥」中間要等多久
function getLuffySecondGap(st) {
  const lastId = getLastPlayedCardId(st);
  const enhanced = isEnhancedNowServer(st, 8);

  // 理論上 pending.action === 'luffy' 時，最後一張就是 8 號
  if (lastId !== 8) {
    return LUFFY_SECOND_GAP.normal;
  }

  // 如果你未來有要分「魯夫在魚人島但沒開強化招式」也可用這個欄位
  return enhanced ? LUFFY_SECOND_GAP.enhanced : LUFFY_SECOND_GAP.normal;
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

  // ---------- 先處理「不是自己回合」但輪到 CPU 回應的互動 ----------
    if (pending) {
      // 奎因：輪到 target 擲硬幣（QUEEN_COIN）
      if (pending.action === 'queen') {
        const tgt = pending.target;
        const victim = st.players[tgt];
        if (victim && victim.isCPU && victim.alive) {
          applyAndBroadcast(roomNow, {
            type: 'QUEEN_COIN',
            playerId: tgt,
          }, io);

          delay(1500);  // 硬幣動畫 & 文字稍微停一下
          return;
        }
      }

      // 大媽強化：被點名的玩家決定要不要交保護費（BIGMOM_CHOICE）
      if (pending.action === 'bigmom-pay') {
        const tgt = pending.target;
        const victim = st.players[tgt];
        if (victim && victim.isCPU && victim.alive) {
          const willPay = (victim.gold || 0) > 0;  // 有金幣就先選「付錢」避免直接死
          applyAndBroadcast(roomNow, {
            type: 'BIGMOM_CHOICE',
            playerId: tgt,
            payload: { choice: willPay ? 'pay' : 'die' },
          }, io);

          delay(1500);
          return;
        }
      }

      // （順便補）羅傑被索隆丟出、在奧羅傑克森號上的預測，也可能是 CPU 要選
      if (pending.action === 'roger' && pending.caster != null) {
        const rogerIdx = pending.caster;           // 擁有羅傑的人
        const roger = st.players[rogerIdx];
        if (roger && roger.isCPU && roger.alive) {
          const targetIdx = pickCpuTargetSmart(st, rogerIdx, {
            for: 'roger',
            avoidProtected: false,
            avoidDodging: false,
          });
          if (targetIdx != null) {
            applyAndBroadcast(roomNow, {
              type: 'PICK_TARGET',
              playerId: rogerIdx,
              payload: { target: targetIdx },
            }, io);

            delay(1500);
            return;
          }
        }
      }
    }

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

      // --- 13 基拉：先解除，再決定要不要決鬥 ---
      if (act === 'killer') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'killer',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        const isBoost = !!(pending.extra && pending.extra.boost);

        // ① 一般版基拉：只解除保護/閃避就結束
        if (!isBoost) {
          applyAndBroadcast(roomNow, {
            type: 'PICK_TARGET',
            playerId: meIdx,
            payload: { target: targetIdx },
          }, io);

          delay(1500);
          return;
        }

        // ② 強化版基拉：
        //    先對目標送一次 PICK_TARGET（只解除保護/閃避）
        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        // 讀出自己「保留下來的手牌」尾數（用來決定要不要決鬥）
        const keepId =
          (pending.extra && typeof pending.extra.keep === 'number')
            ? pending.extra.keep
            : (st.players[meIdx] && st.players[meIdx].hand);

        const myTail = (typeof keepId === 'number') ? tail(keepId) : 0;

        // 簡單策略：尾數 >= 7 再決鬥，尾數小就只拆防
        const willDuel = myTail >= 7;

        if (willDuel) {
          // ③ 尾數夠大 → 再送一次 PICK_TARGET，這次帶 duel:true 進入決鬥
          applyAndBroadcast(roomNow, {
            type: 'PICK_TARGET',
            playerId: meIdx,
            payload: { target: targetIdx, duel: true },
          }, io);
        } else {
          // ④ 不想決鬥 → 用 PICK_CANCEL 告訴引擎「我放棄決鬥」
          applyAndBroadcast(roomNow, {
            type: 'PICK_CANCEL',
            playerId: meIdx,
          }, io);
        }

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

      // --- 8 魯夫：第一次決鬥 + 第二次決鬥（只影響一般魯夫） ---
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

          // 第一次決鬥前的思考時間（維持你原本 1.5 秒）
          delay(1500);
          return;
        }

        // ★ 走到這裡代表：第一次決鬥已經做完（firstDone = true）

        // 第一次 → 第二次中間：先停頓一次（只停一次）
        if (!st._cpuWaitedLuffySecond) {
          st._cpuWaitedLuffySecond = true;

          const gapMs = getLuffySecondGap(st);  // 通常是 LUFFY_SECOND_GAP.normal
          delay(gapMs);
          return;
        }

        // 第二次進來：等完了，就真正選第二個對象
        st._cpuWaitedLuffySecond = false;

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

        // 第二次決鬥送出後，也可以留一點動畫時間
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

      // --- 17 黑鬍子強化：頂牌多選覆蓋 teach-multipick ---
      if (act === 'teach-multipick') {
        const n = pending.n || 0;
        const cards = Array.isArray(pending.cards) ? pending.cards : [];

        // 簡單策略：優先覆蓋「尾數高」的牌，避免大家抽到太強的牌
        const withTail = cards.map((id, idx) => ({
          idx,
          tail: (typeof id === 'number') ? ((id % 10 + 10) % 10) : 0,
        }));

        // 尾數由大到小排序
        withTail.sort((a, b) => b.tail - a.tail);

        // 覆蓋至少一張，預設覆蓋一半（無條件進位）
        const coverCount = Math.max(1, Math.ceil(n / 2));
        const pickedIndices = withTail.slice(0, coverCount).map(x => x.idx);

        applyAndBroadcast(roomNow, {
          type: 'MULTIPICK_COMMIT',
          playerId: meIdx,
          payload: { pickedIndices },
        }, io);

        delay(1500);
        return;
      }

      // --- 15 卡塔庫栗強化：頂牌排序 kata-order ---
      if (act === 'kata-order') {
        const n = pending.n || 0;

        // 簡單做法：直接維持原順序
        const order = [];
        for (let i = 0; i < n; i++) order.push(i);

        applyAndBroadcast(roomNow, {
          type: 'ORDER_COMMIT',
          playerId: meIdx,
          payload: { order },
        }, io);

        delay(1500);
        return;
      }


      // 其他暫時沒處理的 pending（例如卡塔庫栗頂牌排序）先不動
      return;
    }

    // ========= ② 沒有 pending：正常「抽牌 → 出牌」 =========
    if (st.turnStep === 'draw') {
      // 這個延遲是「從輪到他、進到這個分支開始算」
      // 會依照上一張打出的牌 + 是否強化，從 PREV_CARD_DELAY 取出毫秒數
      const delayMs = getDelayForPrevCard(st);

      // 為了「抽牌前等」，我們用 state 上的一個旗標來避免重複等
      if (!st._cpuWaitedBeforeDraw) {
        st._cpuWaitedBeforeDraw = true;
        // 第一次進來：只等，不抽牌
        delay(delayMs || 0);
        return;
      }

      // 第二次進來：已經等過了，真正執行抽牌
      st._cpuWaitedBeforeDraw = false;

      applyAndBroadcast(roomNow, {
        type: 'DRAW',
        playerId: meIdx,
      }, io);

      // 抽牌後不再額外等（要等的時間都已經「抽牌前」用掉了）
      // 如果你想抽完牌停 0.5 秒再出牌，可以改成 delay(500);
      delay(0);
      return;
    }



    if (st.turnStep === 'choose') {
      // 抽完牌 → 先等 4 秒，再真正出牌
      // 用一個旗標避免每次進來都在等
      if (!st._cpuWaitedAfterDraw) {
        st._cpuWaitedAfterDraw = true;
        // 第一次進到 choose：只等 4 秒，不出牌
        delay(4000);
        return;
      }

      // 第二次進到 choose：已經等過，再真正出牌
      st._cpuWaitedAfterDraw = false;

      const which = pickCpuCardSmart(st, meIdx); // 'hand' 或 'drawn'

      applyAndBroadcast(roomNow, {
        type: 'PLAY_CARD',
        playerId: meIdx,
        payload: { which },
      }, io);

  // ★ 出牌後：依「這張牌是不是強化」決定要等多久
  const stAfter = roomNow.state;          // 套用 PLAY_CARD 後的最新 state
  const waitMs = getDelayAfterPlay(stAfter);

  delay(waitMs);
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

  const token = String(payload.token || socket.handshake.auth?.token || "").trim();
  let authedUser = null;
  if(token){
    try{
      const dec = jwt.verify(token, JWT_SECRET);
      authedUser = { id: dec.sub, username: dec.u };
      socket.user = authedUser;
    }catch(e){
      // ignore here; handled below
    }
  }
  // 需要登入才可進房
  if(!authedUser){
    io.to(socket.id).emit('EMIT', { type:'toast', text:'請先登入帳號後再進入遊戲。' });
    return;
  }

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
    p.client = { displayName, avatar, pid, userId: authedUser.id, username: authedUser.username };
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
      userId: authedUser.id,
      username: authedUser.username,
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
      pid: null,          // 之後你要用 pid 再補
    };
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
      ...oldMeta,         // ← 正確語法：展開舊 meta
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
// server/index.js — 動態人數/無佔位 + 正確對齊 playerId + 開局即廣播 STATE
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const crypto = require("crypto");

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_TTL = process.env.JWT_TTL || "30d";

function signToken(user){
  return jwt.sign({ sub: user.id, u: user.username }, JWT_SECRET, { expiresIn: TOKEN_TTL });
}
function readBearer(req){
  const h = String(req.headers.authorization || "");
  const m = h.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : "";
}
function authRequired(req, res, next){
  const token = readBearer(req);
  if(!token) return res.status(401).json({ ok:false, error:"NO_TOKEN" });
  try{
    const dec = jwt.verify(token, JWT_SECRET);
    req.user = { id: dec.sub, username: dec.u };
    return next();
  }catch(e){
    return res.status(401).json({ ok:false, error:"BAD_TOKEN" });
  }
}

// Render PostgreSQL: use DATABASE_URL; enable SSL in production
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false }
});

async function ensureSchema(){
  await pool.query(`CREATE TABLE IF NOT EXISTS users(
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    pass_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
  await pool.query(`CREATE TABLE IF NOT EXISTS user_data(
    user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL DEFAULT '',
    avatar INT NOT NULL DEFAULT 1,
    profile JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );`);
}

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


const app = express();
const JSON_LIMIT = process.env.JSON_LIMIT || "2mb";
app.use(express.json({ limit: JSON_LIMIT }));

// ---- Auth APIs ----
app.post("/api/auth/register", async (req, res) => {
  try{
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    if(username.length < 3 || username.length > 32) return res.status(400).json({ ok:false, error:"BAD_USERNAME" });
    if(password.length < 6 || password.length > 72) return res.status(400).json({ ok:false, error:"BAD_PASSWORD" });

    const pass_hash = await bcrypt.hash(password, 10);
    const id = crypto.randomUUID();
    await pool.query("INSERT INTO users(id, username, pass_hash) VALUES($1,$2,$3)", [id, username, pass_hash]);
    await pool.query("INSERT INTO user_data(user_id, display_name, avatar, profile) VALUES($1,$2,$3,$4::jsonb)", [id, "", 1, JSON.stringify({ version:1, totals:{games:0,wins:0,coins:0}, recent:[], titles:{owned:[],equipped:"",equippedTier:1}, deluxeUnlocked:[] })]);

    const token = signToken({ id, username });
    return res.json({ ok:true, token, user:{ id, username } });
  }catch(e){
    if(String(e?.code||"") === "23505") return res.status(409).json({ ok:false, error:"USERNAME_TAKEN" });
    console.error("[register]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

app.post("/api/auth/login", async (req, res) => {
  try{
    const username = String(req.body?.username || "").trim().toLowerCase();
    const password = String(req.body?.password || "");
    const { rows } = await pool.query("SELECT id, username, pass_hash FROM users WHERE username=$1", [username]);
    const u = rows[0];
    if(!u) return res.status(401).json({ ok:false, error:"BAD_CREDENTIALS" });
    const ok = await bcrypt.compare(password, u.pass_hash);
    if(!ok) return res.status(401).json({ ok:false, error:"BAD_CREDENTIALS" });

    const token = signToken({ id: u.id, username: u.username });
    return res.json({ ok:true, token, user:{ id: u.id, username: u.username } });
  }catch(e){
    console.error("[login]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

app.get("/api/me", authRequired, async (req, res) => {
  try{
    const { rows } = await pool.query("SELECT display_name, avatar, profile FROM user_data WHERE user_id=$1", [req.user.id]);
    const d = rows[0];
    if(!d) return res.status(404).json({ ok:false, error:"NO_PROFILE" });
    return res.json({ ok:true, user:{ id:req.user.id, username:req.user.username, displayName:d.display_name, avatar:d.avatar }, profile:d.profile || {} });
  }catch(e){
    console.error("[me]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

// 更新玩家顯示名稱/頭貼（雲端）
app.post("/api/me/player", authRequired, async (req, res) => {
  try{
    const displayName = String(req.body?.displayName || "").trim().slice(0,16);
    const avatar = Math.max(1, Math.min(30, Number(req.body?.avatar || 1)));
    await pool.query("UPDATE user_data SET display_name=$2, avatar=$3, updated_at=now() WHERE user_id=$1", [req.user.id, displayName, avatar]);
    return res.json({ ok:true });
  }catch(e){
    console.error("[me/player]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

// 同步整份玩家頁資料（結算頁/玩家頁把 local profile 推上來）
app.post("/api/me/sync", authRequired, async (req, res) => {
  try{
    const profile = req.body?.profile;
    const player  = req.body?.player;
    if(!profile || typeof profile !== "object") return res.status(400).json({ ok:false, error:"BAD_PROFILE" });

    // 基本防呆與裁切（避免過大）
    const safeProfile = JSON.parse(JSON.stringify(profile));
    if(Array.isArray(safeProfile.recent)) safeProfile.recent = safeProfile.recent.slice(0,10);
    if(Array.isArray(safeProfile._appliedMatchKeys)) safeProfile._appliedMatchKeys = safeProfile._appliedMatchKeys.slice(0,200);

    let displayName = "";
    let avatar = 1;
    if(player && typeof player === "object"){
      displayName = String(player.playerName || player.displayName || "").trim().slice(0,16);
      avatar = Math.max(1, Math.min(30, Number(player.playerAvatar || player.avatar || 1)));
    }

    // 先讀舊資料，做「合併」而非覆蓋（避免不同裝置互相蓋掉）
    const { rows } = await pool.query("SELECT display_name, avatar, profile FROM user_data WHERE user_id=$1", [req.user.id]);
    const cur = rows[0] || { display_name:"", avatar:1, profile:{} };

    const merged = {
      ...(cur.profile || {}),
      ...safeProfile,
    };

    // 合併 recent / owned / deluxeUnlocked（做 union）
    const uniqBy = (arr, keyFn)=>{
      const out=[]; const seen=new Set();
      for(const it of (Array.isArray(arr)?arr:[])){
        const k = String(keyFn(it));
        if(!k || seen.has(k)) continue;
        seen.add(k); out.push(it);
      }
      return out;
    };

    // recent 以 matchKey 去重，保留最新 10
    if(Array.isArray(cur.profile?.recent) || Array.isArray(safeProfile?.recent)){
      const a = Array.isArray(safeProfile?.recent) ? safeProfile.recent : [];
      const b = Array.isArray(cur.profile?.recent) ? cur.profile.recent : [];
      merged.recent = uniqBy([...a, ...b], x=>x?.matchKey||JSON.stringify(x)).slice(0,10);
    }

    // titles.owned union
    if(merged.titles && (cur.profile?.titles || safeProfile?.titles)){
      const ownedA = Array.isArray(safeProfile?.titles?.owned) ? safeProfile.titles.owned : [];
      const ownedB = Array.isArray(cur.profile?.titles?.owned) ? cur.profile.titles.owned : [];
      // 允許 string 或 {label,tier}
      const normOwned = (list)=>{
        const out=[];
        for(const it of (Array.isArray(list)?list:[])){
          if(typeof it === "string"){
            const label = it.trim(); if(!label) continue;
            out.push({ label, tier:1 });
          }else if(it && typeof it === "object"){
            const label = String(it.label ?? it.text ?? "").trim();
            if(!label) continue;
            const tier = Math.max(1, Math.min(6, Number(it.tier ?? it.level ?? 1) || 1));
            out.push({ label, tier });
          }
        }
        // 同名取最高 tier
        const map=new Map();
        for(const x of out){
          const prev = map.get(x.label);
          if(!prev || x.tier > prev.tier) map.set(x.label, x);
        }
        return [...map.values()];
      };
      const mergedOwned = normOwned([...ownedA, ...ownedB]);
      merged.titles = merged.titles || {};
      merged.titles.owned = mergedOwned;
    }

    // deluxeUnlocked union
    const dA = Array.isArray(safeProfile?.deluxeUnlocked) ? safeProfile.deluxeUnlocked : [];
    const dB = Array.isArray(cur.profile?.deluxeUnlocked) ? cur.profile.deluxeUnlocked : [];
    const dSet = new Set([...dA, ...dB].map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>=0 && n<=19));
    merged.deluxeUnlocked = [...dSet];

    // totals：取較大（避免重複加總）
    if(merged.totals){
      const tg = Number(merged.totals.games)||0;
      const tw = Number(merged.totals.wins)||0;
      const tc = Number(merged.totals.coins)||0;
      const cg = Number(cur.profile?.totals?.games)||0;
      const cw = Number(cur.profile?.totals?.wins)||0;
      const cc = Number(cur.profile?.totals?.coins)||0;
      merged.totals = {
        games: Math.max(tg, cg),
        wins:  Math.max(tw, cw),
        coins: Math.max(tc, cc),
      };
    }

    const finalDisplayName = displayName || cur.display_name || "";
    const finalAvatar = avatar || cur.avatar || 1;

    await pool.query(
      "UPDATE user_data SET display_name=$2, avatar=$3, profile=$4::jsonb, updated_at=now() WHERE user_id=$1",
      [req.user.id, finalDisplayName, finalAvatar, JSON.stringify(merged)]
    );

    return res.json({ ok:true });
  }catch(e){
    console.error("[me/sync]", e);
    return res.status(500).json({ ok:false, error:"SERVER_ERROR" });
  }
});

app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "start.html"));
});
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
io.use((socket, next)=>{
  const token = socket.handshake.auth?.token;
  if(!token) return next(); // 前端若未帶 token，後續 JOIN_ROOM 會擋；這裡不硬擋以免影響靜態頁
  try{
    const dec = jwt.verify(token, JWT_SECRET);
    socket.user = { id: dec.sub, username: dec.u };
  }catch(e){
    // token 無效也先放行，JOIN_ROOM 時再處理提示
  }
  next();
});


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

// ================= CPU 抽牌延遲設定（依上一張牌，一般 / 強化） =================

// 你給的表格（我已經幫你換算成毫秒）
//
// 一般：
// 0-4秒,1-4秒,2-4秒,3-8秒,4-4秒,5-4秒,6-4秒,7-4秒,
// 8-8秒,9-4秒,10-8秒,11-4秒,12-8秒,13-4秒,14-8秒,
// 15-4秒,16-4秒,17-4秒,18-4秒,19-4秒
//
// 強化：
// 0-10秒,1-4秒,2-10秒,3-8秒,4-10秒,5-4秒,6-4秒,7-4秒,
// 8-8秒,9-14秒,10-8秒,11-13秒,12-13秒,13-4秒,14-8秒,
// 15-4秒,16-15秒,17-4秒,18-4秒,19-4秒

const PREV_CARD_DELAY = {
  0:  { normal: 4000,  enhanced: 10000 },
  1:  { normal: 4000,  enhanced: 4000  },
  2:  { normal: 4000,  enhanced: 10000 },
  3:  { normal: 13000,  enhanced: 13000  },
  4:  { normal: 4000,  enhanced: 10000 },
  5:  { normal: 4000,  enhanced: 4000  },
  6:  { normal: 4000,  enhanced: 4000  },
  7:  { normal: 4000,  enhanced: 4000  },
  8:  { normal: 13000,  enhanced: 12000  },
  9:  { normal: 4000,  enhanced: 17000 },
  10: { normal: 13000,  enhanced: 8000  },
  11: { normal: 4000,  enhanced: 18000 },
  12: { normal: 8000,  enhanced: 16000 },
  13: { normal: 4000,  enhanced: 13000  },
  14: { normal: 8000,  enhanced: 8000  },
  15: { normal: 4000,  enhanced: 4000  },
  16: { normal: 4000,  enhanced: 15000 },
  17: { normal: 4000,  enhanced: 4000  },
  18: { normal: 4000,  enhanced: 4000  },
  19: { normal: 4000,  enhanced: 4000  },
};

// ================= CPU「打出牌後」延遲設定（依這張牌，一般 / 強化） =================
// 單位：毫秒
const PLAY_CARD_DECISION_DELAY = {
  0:  { normal: 4000,  enhanced: 6000  },  // 薩波
  1:  { normal: 4000,  enhanced: 10000  },  // 騙人布
  2:  { normal: 4000,  enhanced: 10000  },  // 羅賓
  3:  { normal: 4000,  enhanced: 9000  },  // 香吉士
  4:  { normal: 4000,  enhanced: 6000  },  // 喬巴
  5:  { normal: 4000,  enhanced: 17000  },  // 索隆
  6:  { normal: 4000,  enhanced: 12000  },  // 羅
  7:  { normal: 4000,  enhanced: 10000  },  // 娜美
  8:  { normal: 4000,  enhanced: 13000  },  // 魯夫
  9:  { normal: 4000,  enhanced: 14000  },  // 女帝
  10: { normal: 4000,  enhanced: 8000  },  // 凱多
  11: { normal: 4000,  enhanced: 9000  },  // 基德
  12: { normal: 4000,  enhanced: 9000  },  // 奎因
  13: { normal: 4000,  enhanced: 20000  },  // 基拉
  14: { normal: 4000,  enhanced: 12000  },  // 大媽
  15: { normal: 4000,  enhanced: 19000  },  // 卡塔庫栗
  16: { normal: 4000,  enhanced: 9000  },  // 青雉
  17: { normal: 4000,  enhanced: 16000  },  // 黑鬍子
  18: { normal: 4000,  enhanced: 14000  },  // 紅髮
  19: { normal: 4000,  enhanced: 21000 },  // 羅傑
};

// ================= 魯夫第一次決鬥 → 第二次決鬥 中間的延遲 =================
// 單位：毫秒
// normal ＝ 一般魯夫；enhanced 這裡其實用不到，先留欄位給你之後調整
const LUFFY_SECOND_GAP = {
  normal: 10000,   // 一般魯夫：1.5 秒（你可以自己改）
  enhanced: 1500, // 先隨便設，實際只會用在一般魯夫
};


// 判斷一張卡現在是不是在自己的強化場地上
function isEnhancedNowServer(st, cardId) {
  if (cardId == null) return false;
  const card = cardById(cardId);
  if (!card || !card.venue) return false;
  if (!Array.isArray(st.venues)) return false;
  return st.venues.some(v => v && v.name === card.venue);
}

// 從棄牌堆拿到「最後一張被打出去的卡 id」
function getLastPlayedCardId(st) {
  const disc = st.discard;
  if (!Array.isArray(disc) || disc.length === 0) return null;

  // 從後面往前找第一筆有 id 的
  for (let i = disc.length - 1; i >= 0; i--) {
    const d = disc[i];
    if (typeof d === "number") return d;
    if (d && typeof d.id === "number") return d.id;
  }
  return null;
}

// 根據上一張牌，算出 CPU 抽牌前要延遲多久（毫秒）
// 沒有設定的卡 → 回傳 0
function getDelayForPrevCard(st) {
  const lastId = getLastPlayedCardId(st);
  if (lastId == null) return 0;

  const cfg = PREV_CARD_DELAY[lastId];
  if (!cfg) return 0;

  const enhanced = isEnhancedNowServer(st, lastId);
  if (enhanced && typeof cfg.enhanced === "number") {
    return cfg.enhanced;
  }
  if (!enhanced && typeof cfg.normal === "number") {
    return cfg.normal;
  }
  return 0;
}

// 根據「最後一張打出的牌」，決定 CPU 出牌後要延遲多久（毫秒）
// 會依照 PLAY_CARD_DECISION_DELAY + 是否強化 來決定
function getDelayAfterPlay(st) {
  const lastId = getLastPlayedCardId(st);
  if (lastId == null) return 4000;   // 找不到就給一個預設值（例如 4 秒）

  const cfg = PLAY_CARD_DECISION_DELAY[lastId];
  if (!cfg) return 4000;

  const enhanced = isEnhancedNowServer(st, lastId);

  // 強化版 → 用 enhanced
  if (enhanced && typeof cfg.enhanced === "number") {
    return cfg.enhanced;
  }

  // 一般版 → 用 normal
  if (!enhanced && typeof cfg.normal === "number") {
    return cfg.normal;
  }

  return 4000;
}

// 根據現在狀態，決定「魯夫第一次決鬥 → 第二次決鬥」中間要等多久
function getLuffySecondGap(st) {
  const lastId = getLastPlayedCardId(st);
  const enhanced = isEnhancedNowServer(st, 8);

  // 理論上 pending.action === 'luffy' 時，最後一張就是 8 號
  if (lastId !== 8) {
    return LUFFY_SECOND_GAP.normal;
  }

  // 如果你未來有要分「魯夫在魚人島但沒開強化招式」也可用這個欄位
  return enhanced ? LUFFY_SECOND_GAP.enhanced : LUFFY_SECOND_GAP.normal;
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

  // ---------- 先處理「不是自己回合」但輪到 CPU 回應的互動 ----------
    if (pending) {
      // 奎因：輪到 target 擲硬幣（QUEEN_COIN）
      if (pending.action === 'queen') {
        const tgt = pending.target;
        const victim = st.players[tgt];
        if (victim && victim.isCPU && victim.alive) {
          applyAndBroadcast(roomNow, {
            type: 'QUEEN_COIN',
            playerId: tgt,
          }, io);

          delay(1500);  // 硬幣動畫 & 文字稍微停一下
          return;
        }
      }

      // 大媽強化：被點名的玩家決定要不要交保護費（BIGMOM_CHOICE）
      if (pending.action === 'bigmom-pay') {
        const tgt = pending.target;
        const victim = st.players[tgt];
        if (victim && victim.isCPU && victim.alive) {
          const willPay = (victim.gold || 0) > 0;  // 有金幣就先選「付錢」避免直接死
          applyAndBroadcast(roomNow, {
            type: 'BIGMOM_CHOICE',
            playerId: tgt,
            payload: { choice: willPay ? 'pay' : 'die' },
          }, io);

          delay(1500);
          return;
        }
      }

      // （順便補）羅傑被索隆丟出、在奧羅傑克森號上的預測，也可能是 CPU 要選
      if (pending.action === 'roger' && pending.caster != null) {
        const rogerIdx = pending.caster;           // 擁有羅傑的人
        const roger = st.players[rogerIdx];
        if (roger && roger.isCPU && roger.alive) {
          const targetIdx = pickCpuTargetSmart(st, rogerIdx, {
            for: 'roger',
            avoidProtected: false,
            avoidDodging: false,
          });
          if (targetIdx != null) {
            applyAndBroadcast(roomNow, {
              type: 'PICK_TARGET',
              playerId: rogerIdx,
              payload: { target: targetIdx },
            }, io);

            delay(1500);
            return;
          }
        }
      }
    }

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

      // --- 13 基拉：先解除，再決定要不要決鬥 ---
      if (act === 'killer') {
        const targetIdx = pickCpuTargetSmart(st, meIdx, {
          for: 'killer',
          avoidProtected: false,
          avoidDodging: false,
        });
        if (targetIdx == null) return;

        const isBoost = !!(pending.extra && pending.extra.boost);

        // ① 一般版基拉：只解除保護/閃避就結束
        if (!isBoost) {
          applyAndBroadcast(roomNow, {
            type: 'PICK_TARGET',
            playerId: meIdx,
            payload: { target: targetIdx },
          }, io);

          delay(1500);
          return;
        }

        // ② 強化版基拉：
        //    先對目標送一次 PICK_TARGET（只解除保護/閃避）
        applyAndBroadcast(roomNow, {
          type: 'PICK_TARGET',
          playerId: meIdx,
          payload: { target: targetIdx },
        }, io);

        // 讀出自己「保留下來的手牌」尾數（用來決定要不要決鬥）
        const keepId =
          (pending.extra && typeof pending.extra.keep === 'number')
            ? pending.extra.keep
            : (st.players[meIdx] && st.players[meIdx].hand);

        const myTail = (typeof keepId === 'number') ? tail(keepId) : 0;

        // 簡單策略：尾數 >= 7 再決鬥，尾數小就只拆防
        const willDuel = myTail >= 7;

        if (willDuel) {
          // ③ 尾數夠大 → 再送一次 PICK_TARGET，這次帶 duel:true 進入決鬥
          applyAndBroadcast(roomNow, {
            type: 'PICK_TARGET',
            playerId: meIdx,
            payload: { target: targetIdx, duel: true },
          }, io);
        } else {
          // ④ 不想決鬥 → 用 PICK_CANCEL 告訴引擎「我放棄決鬥」
          applyAndBroadcast(roomNow, {
            type: 'PICK_CANCEL',
            playerId: meIdx,
          }, io);
        }

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

      // --- 8 魯夫：第一次決鬥 + 第二次決鬥（只影響一般魯夫） ---
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

          // 第一次決鬥前的思考時間（維持你原本 1.5 秒）
          delay(1500);
          return;
        }

        // ★ 走到這裡代表：第一次決鬥已經做完（firstDone = true）

        // 第一次 → 第二次中間：先停頓一次（只停一次）
        if (!st._cpuWaitedLuffySecond) {
          st._cpuWaitedLuffySecond = true;

          const gapMs = getLuffySecondGap(st);  // 通常是 LUFFY_SECOND_GAP.normal
          delay(gapMs);
          return;
        }

        // 第二次進來：等完了，就真正選第二個對象
        st._cpuWaitedLuffySecond = false;

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

        // 第二次決鬥送出後，也可以留一點動畫時間
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

      // --- 17 黑鬍子強化：頂牌多選覆蓋 teach-multipick ---
      if (act === 'teach-multipick') {
        const n = pending.n || 0;
        const cards = Array.isArray(pending.cards) ? pending.cards : [];

        // 簡單策略：優先覆蓋「尾數高」的牌，避免大家抽到太強的牌
        const withTail = cards.map((id, idx) => ({
          idx,
          tail: (typeof id === 'number') ? ((id % 10 + 10) % 10) : 0,
        }));

        // 尾數由大到小排序
        withTail.sort((a, b) => b.tail - a.tail);

        // 覆蓋至少一張，預設覆蓋一半（無條件進位）
        const coverCount = Math.max(1, Math.ceil(n / 2));
        const pickedIndices = withTail.slice(0, coverCount).map(x => x.idx);

        applyAndBroadcast(roomNow, {
          type: 'MULTIPICK_COMMIT',
          playerId: meIdx,
          payload: { pickedIndices },
        }, io);

        delay(1500);
        return;
      }

      // --- 15 卡塔庫栗強化：頂牌排序 kata-order ---
      if (act === 'kata-order') {
        const n = pending.n || 0;

        // 簡單做法：直接維持原順序
        const order = [];
        for (let i = 0; i < n; i++) order.push(i);

        applyAndBroadcast(roomNow, {
          type: 'ORDER_COMMIT',
          playerId: meIdx,
          payload: { order },
        }, io);

        delay(1500);
        return;
      }


      // 其他暫時沒處理的 pending（例如卡塔庫栗頂牌排序）先不動
      return;
    }

    // ========= ② 沒有 pending：正常「抽牌 → 出牌」 =========
    if (st.turnStep === 'draw') {
      // 這個延遲是「從輪到他、進到這個分支開始算」
      // 會依照上一張打出的牌 + 是否強化，從 PREV_CARD_DELAY 取出毫秒數
      const delayMs = getDelayForPrevCard(st);

      // 為了「抽牌前等」，我們用 state 上的一個旗標來避免重複等
      if (!st._cpuWaitedBeforeDraw) {
        st._cpuWaitedBeforeDraw = true;
        // 第一次進來：只等，不抽牌
        delay(delayMs || 0);
        return;
      }

      // 第二次進來：已經等過了，真正執行抽牌
      st._cpuWaitedBeforeDraw = false;

      applyAndBroadcast(roomNow, {
        type: 'DRAW',
        playerId: meIdx,
      }, io);

      // 抽牌後不再額外等（要等的時間都已經「抽牌前」用掉了）
      // 如果你想抽完牌停 0.5 秒再出牌，可以改成 delay(500);
      delay(0);
      return;
    }



    if (st.turnStep === 'choose') {
      // 抽完牌 → 先等 4 秒，再真正出牌
      // 用一個旗標避免每次進來都在等
      if (!st._cpuWaitedAfterDraw) {
        st._cpuWaitedAfterDraw = true;
        // 第一次進到 choose：只等 4 秒，不出牌
        delay(4000);
        return;
      }

      // 第二次進到 choose：已經等過，再真正出牌
      st._cpuWaitedAfterDraw = false;

      const which = pickCpuCardSmart(st, meIdx); // 'hand' 或 'drawn'

      applyAndBroadcast(roomNow, {
        type: 'PLAY_CARD',
        playerId: meIdx,
        payload: { which },
      }, io);

  // ★ 出牌後：依「這張牌是不是強化」決定要等多久
  const stAfter = roomNow.state;          // 套用 PLAY_CARD 後的最新 state
  const waitMs = getDelayAfterPlay(stAfter);

  delay(waitMs);
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

  const token = String(payload.token || socket.handshake.auth?.token || "").trim();
  let authedUser = null;
  if(token){
    try{
      const dec = jwt.verify(token, JWT_SECRET);
      authedUser = { id: dec.sub, username: dec.u };
      socket.user = authedUser;
    }catch(e){
      // ignore here; handled below
    }
  }
  // 需要登入才可進房
  if(!authedUser){
    io.to(socket.id).emit('EMIT', { type:'toast', text:'請先登入帳號後再進入遊戲。' });
    return;
  }

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
    p.client = { displayName, avatar, pid, userId: authedUser.id, username: authedUser.username };
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
      userId: authedUser.id,
      username: authedUser.username,
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
      pid: null,          // 之後你要用 pid 再補
    };
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
      ...oldMeta,         // ← 正確語法：展開舊 meta
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
