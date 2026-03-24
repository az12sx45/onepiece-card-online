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

console.log("[env] DATABASE_URL exists:", !!process.env.DATABASE_URL);


const app = express();
app.use(express.static(path.join(__dirname, "..", "public")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "start.html"));
});
app.get("/health", (_req, res) => res.json({ ok: true, ts: Date.now() }));

(async () => {
  try {
    const r = await pool.query("select now() as now");
    console.log("[db] connected at", r.rows[0].now);
  } catch (e) {
    console.error("[db] connection failed", e);
  }
})();



/* =========================
 * Match History (方案B): 永久對戰紀錄
 *  - match_history: 每局一筆（match_key 唯一）
 *  - players: [{ userId, name, avatar, place, coins }]
 *  - rp_map: { "<userId>": <deltaRP number> } 由各玩家結算頁回寫
 * ========================= */
async function ensureMatchHistoryTable(){
  try{
    await pool.query(`
      CREATE TABLE IF NOT EXISTS match_history (
        id SERIAL PRIMARY KEY,
        match_key TEXT UNIQUE,
        ended_at BIGINT,
        players JSONB,
        rp_map JSONB DEFAULT '{}'::jsonb
      );
    `);

    // 查最近 10 局（依 ended_at）
    await pool.query(`CREATE INDEX IF NOT EXISTS match_history_ended_at_idx ON match_history(ended_at DESC);`);

    // players JSONB containment 查詢（players @> '[{"userId":123}]'）
    await pool.query(`CREATE INDEX IF NOT EXISTS match_history_players_gin ON match_history USING GIN (players jsonb_path_ops);`);
  }catch(e){
    console.error("[db] ensureMatchHistoryTable failed:", e);
  }
}
ensureMatchHistoryTable();

/* =========================
 * Player Name Uniqueness
 *  - Enforce global unique display name (case-insensitive, trimmed)
 *  - App-level check is primary; DB unique index is a safety net
 * ========================= */
async function ensurePlayerNameUniqueIndex(){
  try{
    // NOTE: if existing data already contains duplicates, this CREATE may fail.
    // We still keep the runtime check in PROFILE_UPDATE to enforce going forward.
    await pool.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS player_profiles_name_unique_ci
      ON player_profiles (lower(btrim(name)))
      WHERE btrim(name) <> '';
    `);
  }catch(e){
    console.warn("[db] ensurePlayerNameUniqueIndex skipped/failed:", String(e?.message||e));
  }
}


/* =========================
 * Social: Friends + DM (LoL-style friend dock)
 *  - friends stored in player_profiles.stats.client.social.friends : int[]
 *  - dm_messages stores private chat history
 * ========================= */
async function ensureDmTable(){
  try{
    await pool.query(`
      CREATE TABLE IF NOT EXISTS dm_messages(
        id BIGSERIAL PRIMARY KEY,
        a_id INT NOT NULL,
        b_id INT NOT NULL,
        from_id INT NOT NULL,
        body TEXT NOT NULL,
        created_at BIGINT NOT NULL
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS dm_messages_ab_idx ON dm_messages(a_id,b_id,created_at DESC);`);
  }catch(e){
    console.error("[db] ensureDmTable failed:", e);
  }
}
ensureDmTable();

// online presence: userId -> Set<socketId>
const onlineUsers = new Map();
// presence page: userId -> page string (e.g. 'game')
const userPage = new Map();// =========================
// Single-session login lock (per account)
//  - Prevent the same account from logging in on another device while still online.
//  - A "deviceId" is generated/stored by client (localStorage) and sent on AUTH_LOGIN / SOCIAL_AUTH / PRESENCE_SET.
//  - If the last socket disconnects, we keep the lock for a short grace window, then auto-release.
// =========================
const loginLocks = new Map(); // userId -> { deviceId, sockets:Set<socketId>, lastSeen:number }
const LOGIN_LOCK_GRACE_MS = 60000; // 60s after last disconnect auto-release (avoid permanent lock)

function lockTouch(userId, deviceId, socketId){
  if(!userId) return;
  const uid = Number(userId);
  if(!(uid>0)) return;
  const did = String(deviceId||"").trim();
  let lock = loginLocks.get(uid);
  if(!lock){
    lock = { deviceId: did || "", sockets: new Set(), lastSeen: Date.now() };
    loginLocks.set(uid, lock);
  }
  // If deviceId provided, bind/refresh it
  if(did) lock.deviceId = did;
  if(socketId) lock.sockets.add(String(socketId));
  lock.lastSeen = Date.now();
  return lock;
}

function canHostSkipCpu(room, viewerId){
  try{
    if(!room || room.phase !== 'playing') return false;
    if(room.host !== viewerId) return false;

    const ps = Array.isArray(room.state?.players) ? room.state.players : [];
    const aliveHumans = ps.filter(p => p && p.alive && !p.isCPU).length;
    const aliveCpus   = ps.filter(p => p && p.alive &&  p.isCPU).length;

    // 只剩 CPU 存活，且觀看者是房主
    return aliveHumans === 0 && aliveCpus > 0;
  }catch{
    return false;
  }
}

function lockRemoveSocket(userId, socketId){
  const uid = Number(userId);
  const lock = loginLocks.get(uid);
  if(!lock) return;
  try{ lock.sockets.delete(String(socketId)); }catch{}
  lock.lastSeen = Date.now();
  if(lock.sockets.size<=0){
    // keep lock for grace window, then auto-release
    lock.lastSeen = Date.now();
  }
}

function lockIsActive(lock){
  if(!lock) return false;
  if(lock.sockets && lock.sockets.size>0) return true;
  return (Date.now() - (Number(lock.lastSeen)||0)) <= LOGIN_LOCK_GRACE_MS;
}


function lockKickOthers(userId, keepSocketId, reason, newDeviceId){
  try{
    const uid = Number(userId);
    if(!(uid>0)) return;
    const lock = loginLocks.get(uid);
    if(!lock) return;
    const keep = keepSocketId ? String(keepSocketId) : "";
    const did = String(newDeviceId||"").trim();

    const ids = Array.from(lock.sockets || []);
    for(const sid of ids){
      const sidStr = String(sid);
      if(keep && sidStr === keep) continue;
      const s = io?.sockets?.sockets?.get(sidStr);
      if(!s) continue;
      try{ s.emit("SESSION_KICK", { reason: reason || "takeover" }); }catch{}
      try{ s.disconnect(true); }catch{}
    }
    // transfer lock to new device/socket
    lock.sockets = new Set(keep ? [keep] : []);
    if(did) lock.deviceId = did;
    lock.lastSeen = Date.now();
  }catch(e){
    console.error("[lockKickOthers] error:", e);
  }
}

// JS doesn't have True; fix below after insertion

// =========================
// Lobby Invites
//  - inviteId -> { fromId, toId, roomId, createdAt, expiresAt }
//  - muteUntil: userId -> ts(ms) until which user won't receive invites
// =========================
const lobbyInvites = new Map();
const lobbyInviteMuteUntil = new Map();
function markOnline(userId, socketId){
  if(!userId) return;
  let set = onlineUsers.get(userId);
  if(!set){ set = new Set(); onlineUsers.set(userId, set); }
  set.add(socketId);
}
function markOffline(userId, socketId){
  if(!userId) return;
  const set = onlineUsers.get(userId);
  if(!set) return;
  set.delete(socketId);
  if(set.size===0){ onlineUsers.delete(userId); userPage.delete(userId); }
}
function isOnline(userId){ return onlineUsers.has(userId); }
function normalizePresencePage(p){
  const s = String(p||"").trim().toLowerCase();
  if(!s) return "";
  if(s.includes("game")) return "game";
  if(s.includes("start")) return "start";
  if(s.includes("profile")) return "profile";
  if(s.includes("shop")) return "shop";
  if(s.includes("result")) return "result";
  return s.slice(0, 24);
}

function emitToUser(userId, event, payload){
  const set = onlineUsers.get(userId);
  if(!set) return;
  for(const sid of set){
    io.to(sid).emit(event, payload);
  }
}

function lobbyInviteMuteRemainingMs(userId){
  const until = Number(lobbyInviteMuteUntil.get(userId) || 0) || 0;
  const now = Date.now();
  if(until <= now){
    lobbyInviteMuteUntil.delete(userId);
    return 0;
  }
  return Math.max(0, until - now);
}

function makeInvitePayload(inv){
  return {
    id: inv.id,
    roomId: inv.roomId,
    fromId: inv.fromId,
    fromName: inv.fromName,
    fromAvatar: inv.fromAvatar,
    createdAt: inv.createdAt,
    expiresAt: inv.expiresAt,
  };
}

function cleanupLobbyInvites(){
  const now = Date.now();
  for(const [id, inv] of lobbyInvites.entries()){
    if(!inv || Number(inv.expiresAt||0) <= now){
      lobbyInvites.delete(id);
    }
  }
}
setInterval(cleanupLobbyInvites, 30 * 1000);

async function getProfileBasicByUserId(userId){
  try{
    const uid = Number(userId);
    if(!(uid>0)) return null;
    const q = await pool.query(
      `SELECT user_id, secret, name, avatar, stats
         FROM player_profiles
        WHERE user_id = $1
        LIMIT 1`,
      [uid]
    );
    const row = q.rows[0];
    if(!row) return null;
    const stats = row.stats || {};
    const client = stats.client || {};
    const player = client.player || {};
    return {
      userId: Number(row.user_id),
      secret: row.secret,
      name: String(row.name || player.name || ""),
      avatar: Number(row.avatar || player.avatar || 1),
      stats,
    };
  }catch(e){
    console.error("[getProfileBasicByUserId] failed:", e);
    return null;
  }
}

async function areFriends(userIdA, userIdB){
  try{
    const a = Number(userIdA), b = Number(userIdB);
    if(!(a>0 && b>0)) return false;
    const pa = await getProfileBasicByUserId(a);
    if(!pa) return false;
    const social = (((pa.stats||{}).client||{}).social) || {};
    const friends = Array.isArray(social.friends) ? social.friends.map(Number).filter(n=>n>0) : [];
    return friends.includes(b);
  }catch(e){
    console.error("[areFriends] failed:", e);
    return false;
  }
}

async function listFriendsOnline(userId){
  try{
    const prof = await getProfileBasicByUserId(userId);
    if(!prof) return [];
    const social = (((prof.stats||{}).client||{}).social) || {};
    const ids = Array.isArray(social.friends) ? social.friends.map(Number).filter(n=>n>0) : [];
    if(!ids.length) return [];
    const rows = [];
    for(const fid of ids){
      const fp = await getProfileBasicByUserId(fid);
      if(!fp) continue;
      const page = userPage.get(fid) || "";
      rows.push({
        userId: fid,
        name: fp.name || `玩家${fid}`,
        avatar: Number(fp.avatar || 1),
        online: isOnline(fid),
        page: page || "",
      });
    }
    return rows;
  }catch(e){
    console.error("[listFriendsOnline] failed:", e);
    return [];
  }
}

async function pushSocialStateToUser(userId){
  try{
    const list = await listFriendsOnline(userId);
    emitToUser(userId, "SOCIAL_STATE", { friends: list, ts: Date.now() });
  }catch(e){
    console.error("[pushSocialStateToUser] failed:", e);
  }
}

async function pushSocialStateToFriendsOf(userId){
  try{
    const prof = await getProfileBasicByUserId(userId);
    if(!prof) return;
    const social = (((prof.stats||{}).client||{}).social) || {};
    const ids = Array.isArray(social.friends) ? social.friends.map(Number).filter(n=>n>0) : [];
    for(const fid of ids){
      await pushSocialStateToUser(fid);
    }
  }catch(e){
    console.error("[pushSocialStateToFriendsOf] failed:", e);
  }
}
ensurePlayerNameUniqueIndex();


async function ensurePlayerProfilesTable(){
  try{
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_profiles (
        secret TEXT PRIMARY KEY,
        name TEXT NOT NULL DEFAULT '',
        avatar TEXT NOT NULL DEFAULT '',
        stats JSONB NOT NULL DEFAULT '{}'::jsonb,
        titles JSONB NOT NULL DEFAULT '[]'::jsonb,
        bounties JSONB NOT NULL DEFAULT '[]'::jsonb,
        recent_matches JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);

    // 新增 user_id 欄位（若尚未存在）
    await pool.query(`
      ALTER TABLE player_profiles
      ADD COLUMN IF NOT EXISTS user_id INTEGER UNIQUE REFERENCES users(id);
    `);

    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_player_profiles_user_id
      ON player_profiles(user_id);
    `);

    // 新增獎金欄位（累積金幣）
    await pool.query(`
      ALTER TABLE player_profiles
      ADD COLUMN IF NOT EXISTS coins INTEGER NOT NULL DEFAULT 0;
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_player_profiles_coins ON player_profiles(coins DESC);`);
  }catch(e){
    console.error("[db] ensurePlayerProfilesTable failed:", e);
  }
}
ensurePlayerProfilesTable();

// 上雲時，把舊格式補齊，避免 social/title 結構缺欄位
function normalizeProfilePayload(raw){
  const data = raw && typeof raw === "object" ? JSON.parse(JSON.stringify(raw)) : {};

  const client = (data.client && typeof data.client === "object") ? data.client : (data.client = {});
  const player = (client.player && typeof client.player === "object") ? client.player : (client.player = {});
  const shop   = (client.shop   && typeof client.shop   === "object") ? client.shop   : (client.shop   = {});
  const totals = (client.totals && typeof client.totals === "object") ? client.totals : (client.totals = {});
  const titles = (client.titles && typeof client.titles === "object") ? client.titles : (client.titles = {});
  const social = (client.social && typeof client.social === "object") ? client.social : (client.social = {});
  const wall   = (client.wall   && typeof client.wall   === "object") ? client.wall   : (client.wall   = {});

  if (!Array.isArray(shop.ownedAvatars)) shop.ownedAvatars = [];
  if (!Array.isArray(shop.ownedWalls))   shop.ownedWalls = [];
  if (!Array.isArray(shop.ownedFlags))   shop.ownedFlags = [];
  if (!Array.isArray(shop.ownedItems))   shop.ownedItems = [];

  if (!Array.isArray(titles.owned)) titles.owned = [];
  if (!("equipped" in titles)) titles.equipped = "";
  if (!("equippedTier" in titles)) titles.equippedTier = 1;
  if (!Array.isArray((client.recent))) client.recent = [];

  if (!Array.isArray(social.friends))   social.friends = [];
  if (!Array.isArray(social.reqIn))     social.reqIn = [];
  if (!Array.isArray(social.reqOut))    social.reqOut = [];
  if (!Array.isArray(social.dmPinned))  social.dmPinned = [];
  if (!Array.isArray(social.blocked))   social.blocked = [];
  if (!Array.isArray(social.unread))    social.unread = []; // optional structure [{userId,count}]
  if (!Array.isArray(social.friend_in)) social.friend_in = [];
  if (!Array.isArray(social.friend_out)) social.friend_out = [];

  if (!("id" in wall)) wall.id = 1;
  if (!("flagId" in wall)) wall.flagId = 1;

  if (!("wins" in totals)) totals.wins = 0;
  if (!("coins" in totals)) totals.coins = 0;
  if (!("games" in totals)) totals.games = 0;

  if (!("name" in player)) player.name = "";
  if (!("avatar" in player)) player.avatar = 1;

  return data;
}


/* ========== Auth tables & helpers ========== */
async function ensureUsersTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        passhash TEXT NOT NULL,
        secret TEXT NOT NULL UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
    // 提醒：player_profiles.user_id 欄位與索引現在由 ensurePlayerProfilesTable() 建立
  } catch (e) {
    console.error("[db] ensureUsersTable failed:", e);
  }
}
ensureUsersTable();

/* 玩家名稱占用表（舊表）：若你已手動建立過也沒關係，這裡僅確保存在 */
async function ensurePlayerNamesTable() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS player_names (
        name TEXT PRIMARY KEY,
        owner_secret TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
    `);
  } catch (e) {
    console.error("[db] ensurePlayerNamesTable failed:", e);
  }
}
ensurePlayerNamesTable();

function genSecret() {
  return crypto.randomBytes(16).toString("hex");
}
function normUsername(s) {
  return String(s || "").trim().toLowerCase();
}
function okUsername(s) {
  return /^[a-zA-Z0-9_]{3,24}$/.test(String(s || "").trim());
}
function okPassword(s) {
  return String(s || "").length >= 4 && String(s || "").length <= 64;
}

// 綁定 user_id -> player_profiles（如果已存在 secret 對應的 profile）
async function bindUserProfile(userId, secret) {
  try {
    await pool.query(
      `INSERT INTO player_profiles (secret, user_id, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (secret) DO UPDATE SET user_id = EXCLUDED.user_id, updated_at = now()`,
      [secret, userId]
    );
  } catch (e) {
    console.error("[db] bindUserProfile failed:", e);
  }
}

/* 檢查並占用玩家名稱（舊機制保留） */
async function reservePlayerName(name, ownerSecret){
  const trimmed = String(name || "").trim();
  if (!trimmed) return { ok:false, msg:"名稱不能空白" };
  try{
    const q = await pool.query(
      "SELECT owner_secret FROM player_names WHERE name = $1 LIMIT 1",
      [trimmed]
    );
    const row = q.rows[0];
    if (!row) {
      await pool.query(
        "INSERT INTO player_names(name, owner_secret, updated_at) VALUES($1,$2,now())",
        [trimmed, String(ownerSecret||"")]
      );
      return { ok:true };
    }
    if (String(row.owner_secret||"") === String(ownerSecret||"")) {
      await pool.query("UPDATE player_names SET updated_at = now() WHERE name = $1", [trimmed]);
      return { ok:true };
    }
    return { ok:false, msg:"這個玩家名稱已被使用" };
  }catch(e){
    // 安全網：若撞 PK 或其他錯誤
    console.error("[reservePlayerName] failed:", e);
    return { ok:false, msg:"名稱保留失敗，請稍後再試" };
  }
}

async function readProfileBySecret(secret){
  try{
    const q = await pool.query(
      `SELECT secret, user_id, name, avatar, stats, titles, bounties, recent_matches, coins, updated_at
       FROM player_profiles
       WHERE secret = $1
       LIMIT 1`,
      [String(secret||"")]
    );
    return q.rows[0] || null;
  }catch(e){
    console.error("[db] readProfileBySecret failed:", e);
    return null;
  }
}

async function writeProfileBySecret(secret, payload){
  const p = normalizeProfilePayload(payload);
  const name = String(p?.client?.player?.name || "");
  const avatar = String(p?.client?.player?.avatar || "");
  const titles = p?.client?.titles || {};
  const bounties = Array.isArray(p?.bountyPosters) ? p.bountyPosters : [];
  const recent = Array.isArray(p?.client?.recent) ? p.client.recent : [];
  try{
    await pool.query(
      `INSERT INTO player_profiles (secret, name, avatar, stats, titles, bounties, recent_matches, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, now())
       ON CONFLICT (secret) DO UPDATE SET
         name = EXCLUDED.name,
         avatar = EXCLUDED.avatar,
         stats = EXCLUDED.stats,
         titles = EXCLUDED.titles,
         bounties = EXCLUDED.bounties,
         recent_matches = EXCLUDED.recent_matches,
         updated_at = now()`,
      [
        String(secret||""),
        name,
        avatar,
        JSON.stringify(p),
        JSON.stringify(titles),
        JSON.stringify(bounties),
        JSON.stringify(recent),
      ]
    );
    return true;
  }catch(e){
    console.error("[db] writeProfileBySecret failed:", e);
    return false;
  }
}

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });



const rooms = new Map();

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}
function pickUniqueCode() {
  let c = makeCode();
  while (rooms.has(c)) c = makeCode();
  return c;
}

function toLobbySnapshot(room){
  return {
    code: room.code,
    phase: room.phase,
    host: room.host,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      ready: !!p.ready,
      isCPU: !!p.isCPU,
      online: p.online !== false, // 預設 true
    })),
    viewerCanSkipCpu: !!room.viewerCanSkipCpu, // 新增：給前端決定顯示跳過按鈕
  };
}


function buildStartPlayers(roomPlayers) {
  return roomPlayers.map(p => ({
    id: p.id,
    name: p.name,
    isCPU: !!p.isCPU,
    avatar: p.avatar || (p.isCPU ? "👑" : "🙂"),
  }));
}

function broadcastLobby(room) {
  const roomPlayers = room.players.map(p => ({ id: p.id, name: p.name, avatar: p.avatar, ready: p.ready, isCPU: !!p.isCPU, online: p.online !== false }));
  for (const p of room.players){
    const payload = {
      type: "lobby",
      lobby: {
        code: room.code,
        phase: room.phase,
        host: room.host,
        players: roomPlayers,
        viewerCanSkipCpu: canHostSkipCpu(room, p.id),
      }
    };
    io.to(p.socketId).emit("EMIT", payload);
  }
}

function stableStringify(obj){
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]";
  const keys = Object.keys(obj).sort();
  return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}
function hashMatchPlayers(arr){
  const src = stableStringify(arr.map(p => ({
    userId: Number(p.userId || 0) || 0,
    name: String(p.name || ""),
    avatar: String(p.avatar || ""),
    place: Number(p.place || 0) || 0,
    coins: Number(p.coins || 0) || 0,
  })));
  return crypto.createHash("sha1").update(src).digest("hex");
}
function buildMatchKey(roomCode, endedAt, playersArr){
  return `${roomCode}|${Number(endedAt)||0}|${hashMatchPlayers(playersArr)}`;
}

/* =========================
 * Persist final match snapshot if not exists
 * ========================= */
async function saveMatchHistoryIfNeeded(room){
  try{
    if (!room || !room.finalResults || !Array.isArray(room.finalResults.players)) return null;
    const endedAt = Number(room.finalResults.endedAt || Date.now());
    const players = room.finalResults.players.map(p => ({
      userId: Number(p.userId || 0) || 0,
      name: String(p.name || ""),
      avatar: String(p.avatar || ""),
      place: Number(p.place || 0) || 0,
      coins: Number(p.coins || 0) || 0,
    }));
    const matchKey = buildMatchKey(room.code, endedAt, players);

    await pool.query(
      `INSERT INTO match_history (match_key, ended_at, players, rp_map)
       VALUES ($1, $2, $3::jsonb, '{}'::jsonb)
       ON CONFLICT (match_key) DO NOTHING`,
      [matchKey, endedAt, JSON.stringify(players)]
    );
    return matchKey;
  }catch(e){
    console.error("[saveMatchHistoryIfNeeded] failed:", e);
    return null;
  }
}

/* =========================
 * Upsert one player's RP delta into match_history.rp_map
 *  - caller provides userId, rp delta, and either matchKey OR room.finalResults
 * ========================= */
async function upsertMatchRpDelta({ matchKey, roomCode, endedAt, playersArr, userId, deltaRp }){
  try{
    let mk = String(matchKey || "");
    if (!mk){
      const players = Array.isArray(playersArr) ? playersArr : [];
      mk = buildMatchKey(roomCode, endedAt, players);
    }
    const uid = String(Number(userId||0) || 0);
    const drp = Number(deltaRp || 0) || 0;
    if (!mk || uid === "0") return false;

    await pool.query(
      `UPDATE match_history
          SET rp_map = COALESCE(rp_map, '{}'::jsonb) || jsonb_build_object($2::text, to_jsonb($3::int))
        WHERE match_key = $1`,
      [mk, uid, drp]
    );
    return true;
  }catch(e){
    console.error("[upsertMatchRpDelta] failed:", e);
    return false;
  }
}


/* =========================
 * Read last N matches for a given userId
 * returns [{ matchKey, endedAt, place, coins, name, avatar, deltaRp }]
 * ========================= */
async function getRecentMatchesForUser(userId, limit=10){
  try{
    const uid = Number(userId||0) || 0;
    if (!(uid > 0)) return [];
    const q = await pool.query(
      `SELECT match_key, ended_at, players, rp_map
         FROM match_history
        WHERE players @> $1::jsonb
        ORDER BY ended_at DESC
        LIMIT $2`,
      [JSON.stringify([{ userId: uid }]), Math.max(1, Math.min(50, Number(limit)||10))]
    );
    const out = [];
    for (const row of q.rows){
      const players = Array.isArray(row.players) ? row.players : [];
      const me = players.find(p => Number(p?.userId||0) === uid);
      if (!me) continue;
      const rpMap = row.rp_map && typeof row.rp_map === "object" ? row.rp_map : {};
      out.push({
        matchKey: String(row.match_key || ""),
        endedAt: Number(row.ended_at || 0) || 0,
        place: Number(me.place || 0) || 0,
        coins: Number(me.coins || 0) || 0,
        name: String(me.name || ""),
        avatar: String(me.avatar || ""),
        deltaRp: Number(rpMap[String(uid)] || 0) || 0,
      });
    }
    return out;
  }catch(e){
    console.error("[getRecentMatchesForUser] failed:", e);
    return [];
  }
}

function emitState(room) {
  for (const p of room.players) {
    const visible = getVisibleState(room.state, p.id);
    io.to(p.socketId).emit("STATE", visible);
  }
}

function getRoomBySocket(socketId) {
  for (const room of rooms.values()) {
    const found = room.players.find((p) => p.socketId === socketId);
    if (found) return { room, player: found };
  }
  return null;
}

function getLivingPlayers(state) {
  return state.players.filter((p) => p.alive);
}

function getPlayerById(state, id) {
  return state.players.find((p) => p.id === id);
}

function remainingDeckCount(state) {
  return state.deck.length;
}

function autoArrangeCardPositions(room) {
  const players = room.state.players;
  const aliveCount = players.filter((p) => p.alive).length;
  const oneCardSlots = aliveCount === 2 ? ["bottom", "top"] : ["bottom", "left", "top", "right"];

  const livingIds = players.filter((p) => p.alive).map((p) => p.id);
  const deadIds = players.filter((p) => !p.alive).map((p) => p.id);

  const arr = [];

  if (aliveCount === 2) {
    // 2人生還：優先把活著的擺 bottom / top；淘汰者補 left / right
    for (let i = 0; i < livingIds.length; i++) {
      arr.push({ playerId: livingIds[i], slot: oneCardSlots[i] });
    }
    const deadSlots = ["left", "right"];
    for (let i = 0; i < deadIds.length; i++) {
      arr.push({ playerId: deadIds[i], slot: deadSlots[i] || null });
    }
  } else {
    // 其餘情況（3~4人生還 或 1人生還）：維持原先順序分配
    const order = [...livingIds, ...deadIds];
    for (let i = 0; i < order.length; i++) {
      arr.push({ playerId: order[i], slot: i < 4 ? oneCardSlots[i] || oneCardSlots[oneCardSlots.length - 1] : null });
    }
  }

  room.cardPositions = arr;
  io.to(room.code).emit("card_positions", arr);
}

// === [P1] helper：回傳真正「還存活且可操作」的人類玩家數（排除已被 CPU 接手的真人） ===
function countActiveHumans(room){
  try{
    const ps = Array.isArray(room?.state?.players) ? room.state.players : [];
    const rp = Array.isArray(room?.players) ? room.players : [];
    let n = 0;
    for (const p of ps){
      if (!p || !p.alive || p.isCPU) continue;
      const meta = rp.find(x => x && x.id === p.id);
      if (meta && meta.cpuControlled) continue; // 真人被 CPU 接手中，視同不算真人在操作
      n++;
    }
    return n;
  }catch{
    return 0;
  }
}

// === 新增：如果「完全沒有真人可操作」，就讓房主看到可跳過CPU按鈕 ===
function emitLobbyViewFlagsForPlaying(room){
  try{
    if (!room || room.phase !== 'playing') return;

    const noActiveHumans = countActiveHumans(room) === 0;

    // 找一位人類房主（room.host 可能是 player.id，不是 socket）
    for (const p of room.players){
      if (!p || !p.socketId) continue;
      const viewerCanSkipCpu = !!(noActiveHumans && p.id === room.host);
      io.to(p.socketId).emit("LOBBY_VIEW_FLAGS", { viewerCanSkipCpu });
    }
  }catch(e){
    console.error("[emitLobbyViewFlagsForPlaying] failed:", e);
  }
}

// 按活著玩家數決定場地卡數量：
// 4人 → 2張；3/2人 → 1張；1人/0人 → 0張
function desiredVenueCountByAlive(aliveCount){
  if (aliveCount >= 4) return 2;
  if (aliveCount >= 2) return 1;
  return 0;
}

// 生成「不與現有重複」的隨機場地卡 ID（優先從 1..8）
// 若抽不到，最後退回 1..8 任一張（理論上不會）
function drawUniqueVenueId(excludingIds){
  const banned = new Set((excludingIds || []).map(Number));
  const pool = [];
  for (let id = 1; id <= 8; id++) {
    if (!banned.has(id)) pool.push(id);
  }
  if (pool.length > 0) return pool[Math.floor(Math.random() * pool.length)];
  return 1 + Math.floor(Math.random() * 8);
}

// 依目前存活人數，把 room.venues 補/減到正確數量
function syncVenueCountToAlive(room){
  try{
    if (!room) return;
    if (!Array.isArray(room.venues)) room.venues = [];

    const aliveCount = (room.state?.players || []).filter(p => p.alive).length;
    const want = desiredVenueCountByAlive(aliveCount);
    const cur = room.venues.length;

    if (cur === want) return;

    if (cur < want){
      // 補到 want：新增時避免與現有重複
      while (room.venues.length < want){
        const nowIds = room.venues.map(v => Number(v?.id)).filter(Boolean);
        const newId = drawUniqueVenueId(nowIds);
        room.venues.push({ id: newId });
      }
    } else {
      // 多了就裁掉尾端
      room.venues = room.venues.slice(0, want);
    }

    io.to(room.code).emit("venues", room.venues);
  }catch(e){
    console.error("[syncVenueCountToAlive] failed:", e);
  }
}

/* =========================
 * Helpers: lobby cleanup / game-end transitions
 * ========================= */

// 檢查等待室是否已無真人玩家；若無則解散房間
function maybeDissolveLobbyIfNoHumans(roomCode){
  const room = rooms.get(roomCode);
  if (!room) return false;
  if (room.phase !== "lobby") return false;
  const humanCount = room.players.filter(p => !p.isCPU).length;
  if (humanCount > 0) return false;

  try {
    io.to(room.code).emit("ROOM_CLOSED", {
      reason: "empty_lobby",
      message: "等待室已無真人玩家，房間已解散。"
    });
  } catch {}
  // 離開 room
  for (const p of room.players){
    try{ io.sockets.sockets.get(p.socketId)?.leave(room.code); }catch{}
  }
  rooms.delete(room.code);
  return true;
}

// 遊戲房：把所有仍在房內 socket 廣播移回 start（例如被踢下線、結束後）
function emitNavStartToRoom(room, reason){
  if (!room) return;
  for (const p of room.players){
    try{
      io.to(p.socketId).emit("EMIT", { type: "nav_start", reason: reason || "room_closed" });
    }catch{}
  }
}

// 遊戲已經結束且清房後，保險再刪一次
function forceDeleteRoom(roomCode){
  const room = rooms.get(roomCode);
  if (!room) return false;
  try{
    for (const p of room.players){
      try{ io.sockets.sockets.get(p.socketId)?.leave(room.code); }catch{}
    }
  }catch{}
  rooms.delete(roomCode);
  return true;
}

/* =========================
 * Turn Watchdog / CPU takeover
 *  - 真人逾時：先切 CPU 接手（顯示中），再由 CPU 自動出牌
 *  - 玩家回來點一下即可解除 auto，恢復真人操作
 *  - 房內只剩 CPU 可操作時，主機可一鍵 skip
 * ========================= */

const PLAYER_TURN_TIMEOUT_MS = 10000; // 真人回合逾時幾秒後接手
const CPU_ACTION_DELAY_MS = 600;      // 接手後多久出牌
const CPU_WARN_BEFORE_MS = 3000;      // 接手前幾秒先警告

function clearRoomTimers(room){
  try{
    if (room.turnWarnTimer) { clearTimeout(room.turnWarnTimer); room.turnWarnTimer = null; }
    if (room.turnTimer) { clearTimeout(room.turnTimer); room.turnTimer = null; }
    if (room.cpuTakeoverTimer) { clearTimeout(room.cpuTakeoverTimer); room.cpuTakeoverTimer = null; }
  }catch{}
}

function emitPlayerAutoState(room, playerId, autoPlay){
  try{
    const meta = room.players.find(x => x.id === playerId);
    if (!meta?.socketId) return;
    io.to(meta.socketId).emit("PLAYER_AUTO_STATE", {
      playerId,
      autoPlay: !!autoPlay,
      canCancel: !!autoPlay,
      ts: Date.now(),
    });
  }catch{}
}

function emitCpuTakeoverCountdown(room, playerId, msLeft){
  try{
    const meta = room.players.find(x => x.id === playerId);
    if (!meta?.socketId) return;
    io.to(meta.socketId).emit("CPU_TAKEOVER_COUNTDOWN", {
      playerId,
      msLeft: Math.max(0, Number(msLeft)||0),
      ts: Date.now(),
    });
  }catch{}
}

function setCpuControlled(room, playerId, on){
  const meta = room.players.find(x => x.id === playerId);
  if (!meta) return;
  meta.cpuControlled = !!on;
  emitPlayerAutoState(room, playerId, !!on);
  emitLobbyViewFlagsForPlaying(room);
}

function getRoomMetaPlayer(room, playerId){
  return room.players.find(p => p.id === playerId) || null;
}

function isHumanTurnControllable(room){
  if (!room || room.phase !== "playing") return false;
  const pid = room.state?.turnPlayerId;
  if (!pid) return false;
  const sp = getPlayerById(room.state, pid);
  if (!sp || !sp.alive) return false;
  if (sp.isCPU) return false;
  return true;
}

// 判斷這位目前回合玩家是否應該被視為 CPU 操作中
function isTurnAutoControlled(room){
  try{
    const pid = room.state?.turnPlayerId;
    if (!pid) return false;
    const sp = getPlayerById(room.state, pid);
    if (!sp) return false;
    if (sp.isCPU) return true;
    const meta = getRoomMetaPlayer(room, pid);
    return !!meta?.cpuControlled;
  }catch{
    return false;
  }
}

function scheduleCpuAutoPlay(room, playerId, delay = CPU_ACTION_DELAY_MS){
  try{
    if (!room || room.phase !== "playing") return;
    if (room.cpuTakeoverTimer) clearTimeout(room.cpuTakeoverTimer);
    room.cpuTakeoverTimer = setTimeout(() => {
      room.cpuTakeoverTimer = null;
      tryCpuTakeTurn(room, playerId);
    }, Math.max(0, Number(delay)||0));
  }catch{}
}

function armRoomWatchdogs(room){
  try{
    clearRoomTimers(room);
    if (!room || room.phase !== "playing") return;

    const pid = room.state?.turnPlayerId;
    if (!pid) return;

    const sp = getPlayerById(room.state, pid);
    if (!sp || !sp.alive) return;

    // 本來就是 CPU，直接排 auto play
    if (sp.isCPU){
      scheduleCpuAutoPlay(room, pid, 500);
      return;
    }

    const meta = getRoomMetaPlayer(room, pid);
    if (!meta) return;

    // 已被接手中：持續 auto play
    if (meta.cpuControlled){
      emitPlayerAutoState(room, pid, true);
      scheduleCpuAutoPlay(room, pid, 500);
      return;
    }

    // 真人、尚未接手：先倒數提示，再正式接手
    const warnDelay = Math.max(0, PLAYER_TURN_TIMEOUT_MS - CPU_WARN_BEFORE_MS);

    room.turnWarnTimer = setTimeout(() => {
      room.turnWarnTimer = null;
      try{
        // 若回合已變，不提示
        if (room.phase !== "playing") return;
        if (room.state?.turnPlayerId !== pid) return;
        const sp2 = getPlayerById(room.state, pid);
        const meta2 = getRoomMetaPlayer(room, pid);
        if (!sp2 || !sp2.alive || sp2.isCPU || meta2?.cpuControlled) return;
        emitCpuTakeoverCountdown(room, pid, CPU_WARN_BEFORE_MS);
      }catch{}
    }, warnDelay);

    room.turnTimer = setTimeout(() => {
      room.turnTimer = null;
      try{
        if (room.phase !== "playing") return;
        if (room.state?.turnPlayerId !== pid) return;
        const sp2 = getPlayerById(room.state, pid);
        const meta2 = getRoomMetaPlayer(room, pid);
        if (!sp2 || !sp2.alive || sp2.isCPU) return;
        if (meta2?.cpuControlled) return;

        setCpuControlled(room, pid, true);
        scheduleCpuAutoPlay(room, pid, 500);
      }catch(e){
        console.error("[turn watchdog takeover] failed:", e);
      }
    }, PLAYER_TURN_TIMEOUT_MS);
  }catch(e){
    console.error("[armRoomWatchdogs] failed:", e);
  }
}

function cancelAutoForPlayer(room, playerId){
  try{
    const meta = getRoomMetaPlayer(room, playerId);
    if (!meta) return false;
    if (!meta.cpuControlled) return false;
    meta.cpuControlled = false;

    // 若現在正好輪到他，重開 watchdog，讓玩家可手動出牌
    if (room.phase === "playing" && room.state?.turnPlayerId === playerId){
      emitPlayerAutoState(room, playerId, false);
      armRoomWatchdogs(room);
    }else{
      emitPlayerAutoState(room, playerId, false);
      emitLobbyViewFlagsForPlaying(room);
    }
    return true;
  }catch{
    return false;
  }
}

/* =========================
 * CPU decision helpers
 * ========================= */

function findHighestCardIndex(hand){
  if (!Array.isArray(hand) || hand.length === 0) return 0;
  let best = 0;
  let bestVal = -Infinity;
  for (let i = 0; i < hand.length; i++){
    const id = Number(hand[i]?.id ?? -999);
    if (id > bestVal){
      bestVal = id;
      best = i;
    }
  }
  return best;
}

function pickFallbackTarget(state, selfId){
  const others = state.players.filter(p => p.alive && p.id !== selfId);
  return others[0]?.id || null;
}

function pickFallbackDigit(hand){
  // 偏保守：選手牌第一張尾數
  const c = hand?.[0];
  return c ? tail(cardById(c.id).id) : 0;
}

/* =========================
 * CPU execute one legal action for current turn
 * ========================= */

function tryCpuTakeTurn(room, expectedPlayerId = null){
  try{
    if (!room || room.phase !== "playing") return false;

    const currentId = room.state?.turnPlayerId;
    if (!currentId) return false;
    if (expectedPlayerId && currentId !== expectedPlayerId) return false;

    const sp = getPlayerById(room.state, currentId);
    if (!sp || !sp.alive) return false;

    const meta = getRoomMetaPlayer(room, currentId);

    // 只有 CPU 或被接手的真人，才允許自動出牌
    const auto = !!sp.isCPU || !!meta?.cpuControlled;
    if (!auto) return false;

    if (!Array.isArray(sp.hand) || sp.hand.length === 0) return false;

    // 先挑 card index
    let cardIndex = 0;
    try{
      cardIndex = Number(pickCpuCardSmart(room.state, currentId));
      if (!(cardIndex >= 0 && cardIndex < sp.hand.length)) {
        cardIndex = findHighestCardIndex(sp.hand);
      }
    }catch{
      cardIndex = findHighestCardIndex(sp.hand);
    }

    const chosen = sp.hand[cardIndex];
    const cid = Number(chosen?.id);

    // 再補 payload（target / digit）
    const payload = { cardIndex };

    try{
      const target = pickCpuTargetSmart(room.state, currentId, cid);
      if (target != null) payload.targetPlayerId = Number(target);
    }catch{}

    try{
      const digit = pickCpuDigitSmart(room.state, currentId, cid);
      if (digit != null) payload.declareDigit = Number(digit);
    }catch{}

    // fallback：某些牌若缺 target / digit，補一個
    if (payload.targetPlayerId == null){
      const fb = pickFallbackTarget(room.state, currentId);
      if (fb != null) payload.targetPlayerId = fb;
    }
    if (payload.declareDigit == null){
      payload.declareDigit = pickFallbackDigit(sp.hand);
    }

    const r = applyAction(room.state, currentId, payload);

    // 若 smart AI 挑的資料不合法，退回簡單暴力嘗試
    if (!r.ok){
      let applied = false;
      const fallbackTarget = pickFallbackTarget(room.state, currentId);
      for (let i = 0; i < sp.hand.length && !applied; i++){
        const base = { cardIndex: i };
        const cardId = Number(sp.hand[i]?.id);
        const tries = [
          { ...base },
          { ...base, targetPlayerId: fallbackTarget },
          { ...base, declareDigit: pickFallbackDigit(sp.hand) },
          { ...base, targetPlayerId: fallbackTarget, declareDigit: pickFallbackDigit(sp.hand) },
        ];
        for (const t of tries){
          const rr = applyAction(room.state, currentId, t);
          if (rr.ok){
            applied = true;
            break;
          }
        }
      }
      if (!applied){
        console.warn("[CPU] no legal move found for", currentId);
        return false;
      }
    }

    // 有可能這步讓回合推進 / round end
    afterAnyAction(room);
    return true;
  }catch(e){
    console.error("[tryCpuTakeTurn] failed:", e);
    return false;
  }
}

/* =========================
 * Common post-action flow
 * ========================= */

function afterAnyAction(room){
  try{
    emitState(room);
    io.to(room.code).emit("coin_count", room.state.chestCoins);

    syncVenueCountToAlive(room);      // 新增：存活數改變時，場地張數立即同步
    autoArrangeCardPositions(room);

    if (room.state.lastRoundResult) {
      io.to(room.code).emit("round_result", room.state.lastRoundResult);
    }

    if (isRoundEnded(room.state)) {
      if (room.state.chestCoins <= 0) {
        clearRoomTimers(room);
        endGame(room);
      } else {
        clearRoomTimers(room);
        setTimeout(() => {
          // 只在還沒結束時進下一輪
          if (room.phase !== "playing") return;
          room.state = nextRound(room.state);
          syncVenueCountToAlive(room);  // 新一輪也再校正一次
          autoArrangeCardPositions(room);
          emitState(room);
          io.to(room.code).emit("coin_count", room.state.chestCoins);
          if (room.state.lastRoundResult) {
            io.to(room.code).emit("round_result", room.state.lastRoundResult);
          }
          armRoomWatchdogs(room);       // 新回合重上 watchdog
        }, 1600);
      }
    } else {
      // 正常進下一位 / 繼續同回合
      armRoomWatchdogs(room);
    }
  }catch(e){
    console.error("[afterAnyAction] failed:", e);
  }
}

function buildFinalRankPlayers(room){
  // 以本局已結算資訊為主；place 越小越前面。coins 從 state.players 讀。
  const ranked = [...room.state.players]
    .map(p => {
      const meta = room.players.find(x => x.id === p.id);
      return {
        id: p.id,
        userId: Number(meta?.userId || 0) || 0,
        name: p.name,
        avatar: p.avatar,
        place: Number(p.place || 999) || 999,
        coins: Number(p.coinsWon || 0) || 0,
      };
    })
    .sort((a,b) => (a.place - b.place) || (b.coins - a.coins) || (a.id - b.id));

  return ranked;
}

function endGame(room){
  try{
    room.phase = "finished";

    const players = buildFinalRankPlayers(room);
    const endedAt = Date.now();
    room.finalResults = { endedAt, players };

    // 先確保 match_history 有這局（方案B）
    saveMatchHistoryIfNeeded(room).then((matchKey)=>{
      try{
        if (matchKey) room.finalResults.matchKey = matchKey;
      }catch{}
    }).catch(()=>{});

    // 廣播 final 給遊戲頁（若你前端還要用）
    io.to(room.code).emit("final_result", room.finalResults);

    // 導到 result 頁；把必要資料塞 query
    for (const p of room.players){
      try{
        const me = players.find(x => x.id === p.id) || null;
        const q = new URLSearchParams({
          room: room.code,
          endedAt: String(endedAt),
          userId: String(Number(p.userId || 0) || 0),
          playerId: String(p.id),
          matchKey: room.finalResults.matchKey || "",
        });
        io.to(p.socketId).emit("EMIT", { type:"nav_result", url:`/result.html?${q.toString()}` });
      }catch{}
    }

    // 一段時間後刪房，避免 refresh / 回跳又連回遊戲
    setTimeout(() => {
      try{
        emitNavStartToRoom(room, "game_finished_cleanup");
      }catch{}
      forceDeleteRoom(room.code);
    }, 15000);
  }catch(e){
    console.error("[endGame] failed:", e);
  }
}

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);

  socket.on("health_ping", () => {
    socket.emit("health_pong", { ts: Date.now() });
  });


  // 建立帳號
  socket.on("AUTH_REGISTER", async (d = {}) => {
    try {
      const username = normUsername(d.username);
      const password = String(d.password || "");
      if (!okUsername(username)) {
        socket.emit("AUTH_RESULT", { ok: false, mode: "register", msg: "帳號格式錯誤（3-24字，可用英數底線）" });
        return;
      }
      if (!okPassword(password)) {
        socket.emit("AUTH_RESULT", { ok: false, mode: "register", msg: "密碼長度需 4-64 字" });
        return;
      }

      const exists = await pool.query(`SELECT id FROM users WHERE username = $1 LIMIT 1`, [username]);
      if (exists.rowCount > 0) {
        socket.emit("AUTH_RESULT", { ok: false, mode: "register", msg: "此帳號已存在" });
        return;
      }

      const passhash = await bcrypt.hash(password, 10);
      const secret = genSecret();

      const ins = await pool.query(
        `INSERT INTO users(username, passhash, secret) VALUES($1,$2,$3) RETURNING id, username, secret`,
        [username, passhash, secret]
      );
      const user = ins.rows[0];

      // 綁 profile（若無則建立空 profile）
      await bindUserProfile(user.id, user.secret);

      socket.emit("AUTH_RESULT", {
        ok: true,
        mode: "register",
        userId: user.id,
        username: user.username,
        secret: user.secret,
      });
    } catch (e) {
      console.error("AUTH_REGISTER error:", e);
      socket.emit("AUTH_RESULT", { ok: false, mode: "register", msg: "註冊失敗，請稍後再試" });
    }
  });

  // 登入
socket.on("AUTH_LOGIN", async (d = {}) => {
  try {
    const username = normUsername(d.username);
    const password = String(d.password || "");
    const deviceId = String(d.deviceId || "").trim();

    if (!okUsername(username) || !okPassword(password)) {
      socket.emit("AUTH_RESULT", { ok: false, mode: "login", msg: "帳號或密碼格式錯誤" });
      return;
    }

    const q = await pool.query(
      `SELECT id, username, secret, passhash FROM users WHERE username = $1 LIMIT 1`,
      [username]
    );
    if (q.rowCount === 0) {
      socket.emit("AUTH_RESULT", { ok: false, mode: "login", msg: "帳號或密碼錯誤" });
      return;
    }

    const user = q.rows[0];
    const ok = await bcrypt.compare(password, user.passhash);
    if (!ok) {
      socket.emit("AUTH_RESULT", { ok: false, mode: "login", msg: "帳號或密碼錯誤" });
      return;
    }

    // === 擠下線模式：同帳號新裝置登入時，強制踢掉舊裝置 ===
    // 若同 deviceId 視為同裝置刷新，不踢自己；若 deviceId 不同則把舊的都踢掉。
    const existing = loginLocks.get(Number(user.id));
    if (existing && lockIsActive(existing)) {
      const sameDevice = !!deviceId && !!existing.deviceId && String(existing.deviceId) === deviceId;
      if (!sameDevice) {
        lockKickOthers(Number(user.id), socket.id, "takeover", deviceId || existing.deviceId || "");
      }
    }
    lockTouch(Number(user.id), deviceId, socket.id);

    await bindUserProfile(user.id, user.secret);

    socket.userId = Number(user.id);
    socket.secret = user.secret;
    socket.deviceId = deviceId || "";
    socket.authed = true;

    socket.emit("AUTH_RESULT", {
      ok: true,
      mode: "login",
      userId: user.id,
      username: user.username,
      secret: user.secret,
    });
  } catch (e) {
    console.error("AUTH_LOGIN error:", e);
    socket.emit("AUTH_RESULT", { ok: false, mode: "login", msg: "登入失敗，請稍後再試" });
  }
});


  // 讀取自己 profile（需 secret）
  socket.on("PROFILE_GET", async ({ secret }) => {
    try{
      const row = await readProfileBySecret(secret);
      if (!row) {
        socket.emit("PROFILE_DATA", { ok:true, profile:null });
        return;
      }

      let profile = row.stats || {};
      profile = normalizeProfilePayload(profile);

      // 將資料庫欄位補回前端慣用位置
      if (!profile.client) profile.client = {};
      if (!profile.client.player) profile.client.player = {};
      if (!profile.client.titles) profile.client.titles = row.titles || {};
      profile.client.player.name = row.name || profile.client.player.name || "";
      profile.client.player.avatar = row.avatar || profile.client.player.avatar || "";
      profile.bountyPosters = Array.isArray(row.bounties) ? row.bounties : [];
      if (!profile.client.recent || !Array.isArray(profile.client.recent) || profile.client.recent.length === 0) {
        const uid = Number(row.user_id || 0) || 0;
        if (uid > 0) {
          profile.client.recent = await getRecentMatchesForUser(uid, 10);
        }
      }
      if (row.user_id) {
        profile.client.userId = Number(row.user_id);
      }
      // 累積金幣
      profile.coins = Number(row.coins || 0) || 0;

      socket.emit("PROFILE_DATA", { ok:true, profile, updatedAt: row.updated_at });
    }catch(e){
      console.error("PROFILE_GET error:", e);
      socket.emit("PROFILE_DATA", { ok:false, msg:"讀取失敗" });
    }
  });

  // 讀取公開 profile（依 userId，不回 secret）
  socket.on("PROFILE_PUBLIC_GET", async ({ userId }) => {
    try{
      const uid = Number(userId);
      if (!(uid > 0)) {
        socket.emit("PROFILE_PUBLIC_DATA", { ok:false, msg:"userId 無效" });
        return;
      }

      const q = await pool.query(
        `SELECT user_id, name, avatar, stats, titles, bounties, recent_matches, coins, updated_at
         FROM player_profiles
         WHERE user_id = $1
         LIMIT 1`,
        [uid]
      );

      const row = q.rows[0];
      if (!row) {
        socket.emit("PROFILE_PUBLIC_DATA", { ok:true, profile:null });
        return;
      }

      let profile = row.stats || {};
      profile = normalizeProfilePayload(profile);

      // 將資料庫欄位補回前端慣用位置（不包含 secret）
      if (!profile.client) profile.client = {};
      if (!profile.client.player) profile.client.player = {};
      if (!profile.client.titles) profile.client.titles = row.titles || {};
      profile.client.player.name = row.name || profile.client.player.name || "";
      profile.client.player.avatar = row.avatar || profile.client.player.avatar || "";
      profile.bountyPosters = Array.isArray(row.bounties) ? row.bounties : [];
      if (!profile.client.recent || !Array.isArray(profile.client.recent) || profile.client.recent.length === 0) {
        const uid2 = Number(row.user_id || 0) || 0;
        if (uid2 > 0) {
          profile.client.recent = await getRecentMatchesForUser(uid2, 10);
        }
      }
      profile.client.userId = Number(row.user_id || uid);
      profile.coins = Number(row.coins || 0) || 0;

      socket.emit("PROFILE_PUBLIC_DATA", { ok:true, profile, updatedAt: row.updated_at });
    }catch(e){
      console.error("PROFILE_PUBLIC_GET error:", e);
      socket.emit("PROFILE_PUBLIC_DATA", { ok:false, msg:"讀取公開資料失敗" });
    }
  });

  // 新增：排行榜（依累積 coins）
  socket.on("LEADERBOARD_GET", async () => {
    try{
      const q = await pool.query(`
        SELECT user_id, name, avatar, coins, stats
        FROM player_profiles
        WHERE user_id IS NOT NULL
        ORDER BY coins DESC, updated_at ASC
        LIMIT 100
      `);

      const rows = q.rows.map((r, idx) => {
        const stats = r.stats || {};
        const client = stats.client || {};
        const rank = client.rank || {};
        return {
          rankNo: idx + 1,
          userId: Number(r.user_id || 0) || 0,
          name: String(r.name || client?.player?.name || ""),
          avatar: Number(r.avatar || client?.player?.avatar || 1),
          coins: Number(r.coins || 0) || 0,
          rp: Number(rank.rp || 0) || 0,
          tier: Number(rank.tier || 1) || 1,
        };
      });

      socket.emit("LEADERBOARD_DATA", { ok:true, rows });
    }catch(e){
      console.error("LEADERBOARD_GET error:", e);
      socket.emit("LEADERBOARD_DATA", { ok:false, msg:"讀取排行榜失敗" });
    }
  });

  // 可選：排行榜分頁版
  socket.on("LEADERBOARD_GET_PAGE", async ({ page=1, pageSize=50 } = {}) => {
    try{
      const p = Math.max(1, Number(page)||1);
      const s = Math.max(1, Math.min(100, Number(pageSize)||50));
      const offset = (p - 1) * s;

      const totalQ = await pool.query(`SELECT COUNT(*)::int AS c FROM player_profiles WHERE user_id IS NOT NULL`);
      const total = Number(totalQ.rows?.[0]?.c || 0) || 0;

      const q = await pool.query(`
        SELECT user_id, name, avatar, coins, stats
        FROM player_profiles
        WHERE user_id IS NOT NULL
        ORDER BY coins DESC, updated_at ASC
        OFFSET $1 LIMIT $2
      `, [offset, s]);

      const rows = q.rows.map((r, i) => {
        const stats = r.stats || {};
        const client = stats.client || {};
        const rank = client.rank || {};
        return {
          rankNo: offset + i + 1,
          userId: Number(r.user_id || 0) || 0,
          name: String(r.name || client?.player?.name || ""),
          avatar: Number(r.avatar || client?.player?.avatar || 1),
          coins: Number(r.coins || 0) || 0,
          rp: Number(rank.rp || 0) || 0,
          tier: Number(rank.tier || 1) || 1,
        };
      });

      socket.emit("LEADERBOARD_PAGE_DATA", { ok:true, page:p, pageSize:s, total, rows });
    }catch(e){
      console.error("LEADERBOARD_GET_PAGE error:", e);
      socket.emit("LEADERBOARD_PAGE_DATA", { ok:false, msg:"讀取排行榜分頁失敗" });
    }
  });

  // 寫入自己 profile（需 secret）
  socket.on("PROFILE_UPDATE", async ({ secret, profile }) => {
    try{
      // 先補齊資料結構
      const normalized = normalizeProfilePayload(profile || {});

      // 名稱唯一檢查（以 player_profiles 為主，大小寫不分、trim 後）
      const newName = String(normalized?.client?.player?.name || "").trim();
      if (newName){
        const dup = await pool.query(
          `SELECT secret
             FROM player_profiles
            WHERE lower(btrim(name)) = lower(btrim($1))
              AND secret <> $2
            LIMIT 1`,
          [newName, String(secret||"")]
        );
        if (dup.rowCount > 0){
          socket.emit("PROFILE_SAVE_RESULT", { ok:false, msg:"這個玩家名稱已被使用" });
          return;
        }
      }

      // 舊的保留機制一併更新（可作兼容）
      if (newName){
        const r = await reservePlayerName(newName, secret);
        if (!r.ok){
          socket.emit("PROFILE_SAVE_RESULT", { ok:false, msg:r.msg || "名稱不可用" });
          return;
        }
      }

      // 取出目前資料庫 coins，避免被前端覆蓋
      let keepCoins = 0;
      let boundUserId = null;
      try{
        const rowNow = await readProfileBySecret(secret);
        keepCoins = Number(rowNow?.coins || 0) || 0;
        boundUserId = Number(rowNow?.user_id || 0) || null;
      }catch{}

      // 將 coins 欄位從 payload 分離，不讓前端任意覆蓋 DB coins
      const payload = JSON.parse(JSON.stringify(normalized));
      if (payload && typeof payload === "object") {
        delete payload.coins;
      }

      const ok = await writeProfileBySecret(secret, payload);
      if (ok) {
        // 重新把 coins / user_id 寫回列（保留原值）
        try{
          await pool.query(
            `UPDATE player_profiles
                SET coins = $2,
                    user_id = COALESCE(user_id, $3),
                    updated_at = now()
              WHERE secret = $1`,
            [String(secret||""), keepCoins, boundUserId]
          );
        }catch(e2){
          console.error("[PROFILE_UPDATE keep coins/user_id] failed:", e2);
        }

        socket.emit("PROFILE_SAVE_RESULT", { ok:true });
      } else {
        socket.emit("PROFILE_SAVE_RESULT", { ok:false, msg:"保存失敗" });
      }
    }catch(e){
      console.error("PROFILE_UPDATE error:", e);
      socket.emit("PROFILE_SAVE_RESULT", { ok:false, msg:"保存失敗" });
    }
  });

  /* =========================
   * Match History APIs
   * ========================= */

  // 前端在 result 頁送自己的 RP 結算回來，伺服器寫入 match_history.rp_map
  // payload:
  // {
  //   matchKey?: string,
  //   roomCode?: string,
  //   endedAt?: number,
  //   players?: [{userId,name,avatar,place,coins}],
  //   userId: number,
  //   deltaRp: number
  // }
  socket.on("MATCH_RP_UPSERT", async (payload = {}) => {
    try{
      const userId = Number(payload.userId || 0) || 0;
      const deltaRp = Number(payload.deltaRp || 0) || 0;
      if (!(userId > 0)) {
        socket.emit("MATCH_RP_UPSERT_RESULT", { ok:false, msg:"userId 無效" });
        return;
      }

      const ok = await upsertMatchRpDelta({
        matchKey: String(payload.matchKey || ""),
        roomCode: String(payload.roomCode || ""),
        endedAt: Number(payload.endedAt || 0) || 0,
        playersArr: Array.isArray(payload.players) ? payload.players : [],
        userId,
        deltaRp
      });

      socket.emit("MATCH_RP_UPSERT_RESULT", { ok: !!ok });
    }catch(e){
      console.error("MATCH_RP_UPSERT error:", e);
      socket.emit("MATCH_RP_UPSERT_RESULT", { ok:false, msg:"寫入 RP 失敗" });
    }
  });

  // 取得某玩家最近 N 局
  // payload: { userId:number, limit?:number }
  socket.on("MATCH_HISTORY_GET", async ({ userId, limit=10 } = {}) => {
    try{
      const uid = Number(userId || 0) || 0;
      if (!(uid > 0)) {
        socket.emit("MATCH_HISTORY_DATA", { ok:false, msg:"userId 無效", rows: [] });
        return;
      }
      const rows = await getRecentMatchesForUser(uid, limit);
      socket.emit("MATCH_HISTORY_DATA", { ok:true, rows });
    }catch(e){
      console.error("MATCH_HISTORY_GET error:", e);
      socket.emit("MATCH_HISTORY_DATA", { ok:false, msg:"讀取對戰紀錄失敗", rows: [] });
    }
  });

  // 只查指定 matchKey（給 result 頁 refresh 後重建）
  socket.on("MATCH_HISTORY_GET_ONE", async ({ matchKey } = {}) => {
    try{
      const mk = String(matchKey || "");
      if (!mk){
        socket.emit("MATCH_HISTORY_ONE_DATA", { ok:false, msg:"matchKey 無效" });
        return;
      }
      const q = await pool.query(
        `SELECT match_key, ended_at, players, rp_map
           FROM match_history
          WHERE match_key = $1
          LIMIT 1`,
        [mk]
      );
      const row = q.rows[0];
      if (!row){
        socket.emit("MATCH_HISTORY_ONE_DATA", { ok:true, row:null });
        return;
      }
      socket.emit("MATCH_HISTORY_ONE_DATA", {
        ok:true,
        row: {
          matchKey: String(row.match_key || ""),
          endedAt: Number(row.ended_at || 0) || 0,
          players: Array.isArray(row.players) ? row.players : [],
          rpMap: row.rp_map && typeof row.rp_map === "object" ? row.rp_map : {},
        }
      });
    }catch(e){
      console.error("MATCH_HISTORY_GET_ONE error:", e);
      socket.emit("MATCH_HISTORY_ONE_DATA", { ok:false, msg:"讀取指定對戰失敗" });
    }
  });



  socket.on("SOCIAL_AUTH", async ({ secret, userId, deviceId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const uid = Number(userId || 0) || 0;
      const did = String(deviceId || "").trim();
      if (!sec || !(uid > 0)) {
        socket.emit("SOCIAL_AUTH_RESULT", { ok:false, msg:"缺少憑證" });
        return;
      }
      const row = await readProfileBySecret(sec);
      if (!row || Number(row.user_id || 0) !== uid) {
        socket.emit("SOCIAL_AUTH_RESULT", { ok:false, msg:"憑證失效" });
        return;
      }

      // single-session lock: social pages entering later should also register the device/socket
      const existing = loginLocks.get(uid);
      if (existing && lockIsActive(existing)) {
        const sameDevice = !!did && !!existing.deviceId && String(existing.deviceId) === did;
        if (!sameDevice) {
          lockKickOthers(uid, socket.id, "takeover", did || existing.deviceId || "");
        }
      }
      lockTouch(uid, did, socket.id);

      socket.userId = uid;
      socket.secret = sec;
      socket.deviceId = did || socket.deviceId || "";
      socket.authed = true;
      markOnline(uid, socket.id);
      await pushSocialStateToUser(uid);
      await pushSocialStateToFriendsOf(uid);
      socket.emit("SOCIAL_AUTH_RESULT", { ok:true });
    }catch(e){
      console.error("SOCIAL_AUTH error:", e);
      socket.emit("SOCIAL_AUTH_RESULT", { ok:false, msg:"社交登入失敗" });
    }
  });

  socket.on("PRESENCE_SET", async ({ secret, userId, page, deviceId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const uid = Number(userId || 0) || 0;
      const pg = normalizePresencePage(page);
      const did = String(deviceId || "").trim();
      if (!sec || !(uid > 0)) return;
      const row = await readProfileBySecret(sec);
      if (!row || Number(row.user_id || 0) !== uid) return;

      const existing = loginLocks.get(uid);
      if (existing && lockIsActive(existing)) {
        const sameDevice = !!did && !!existing.deviceId && String(existing.deviceId) === did;
        if (!sameDevice) {
          lockKickOthers(uid, socket.id, "takeover", did || existing.deviceId || "");
        }
      }
      lockTouch(uid, did || socket.deviceId || "", socket.id);
      socket.userId = uid;
      socket.secret = sec;
      socket.deviceId = did || socket.deviceId || "";
      socket.authed = true;
      markOnline(uid, socket.id);
      if (pg) userPage.set(uid, pg);
      await pushSocialStateToUser(uid);
      await pushSocialStateToFriendsOf(uid);
    }catch(e){
      console.error("PRESENCE_SET error:", e);
    }
  });

  socket.on("SOCIAL_STATE_GET", async ({ secret, userId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const uid = Number(userId || 0) || 0;
      if (!sec || !(uid > 0)) {
        socket.emit("SOCIAL_STATE", { friends: [], ts: Date.now() });
        return;
      }
      const row = await readProfileBySecret(sec);
      if (!row || Number(row.user_id || 0) !== uid) {
        socket.emit("SOCIAL_STATE", { friends: [], ts: Date.now() });
        return;
      }
      socket.userId = uid;
      socket.secret = sec;
      socket.authed = true;
      markOnline(uid, socket.id);
      await pushSocialStateToUser(uid);
    }catch(e){
      console.error("SOCIAL_STATE_GET error:", e);
      socket.emit("SOCIAL_STATE", { friends: [], ts: Date.now() });
    }
  });

  socket.on("FRIEND_REQUEST_SEND", async ({ secret, fromUserId, toUserId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const fromId = Number(fromUserId || 0) || 0;
      const toId = Number(toUserId || 0) || 0;
      if (!sec || !(fromId > 0) || !(toId > 0) || fromId === toId) {
        socket.emit("FRIEND_REQUEST_RESULT", { ok:false, msg:"參數錯誤" });
        return;
      }
      const me = await readProfileBySecret(sec);
      if (!me || Number(me.user_id || 0) !== fromId) {
        socket.emit("FRIEND_REQUEST_RESULT", { ok:false, msg:"憑證錯誤" });
        return;
      }
      const myProf = normalizeProfilePayload(me.stats || {});
      const mySocial = (((myProf||{}).client||{}).social) || (myProf.client.social = {});
      mySocial.friends = Array.isArray(mySocial.friends) ? mySocial.friends.map(Number).filter(n=>n>0) : [];
      mySocial.reqIn = Array.isArray(mySocial.reqIn) ? mySocial.reqIn.map(Number).filter(n=>n>0) : [];
      mySocial.reqOut = Array.isArray(mySocial.reqOut) ? mySocial.reqOut.map(Number).filter(n=>n>0) : [];
      mySocial.friend_in = Array.isArray(mySocial.friend_in) ? mySocial.friend_in : [];
      mySocial.friend_out = Array.isArray(mySocial.friend_out) ? mySocial.friend_out : [];
      if (mySocial.friends.includes(toId)) {
        socket.emit("FRIEND_REQUEST_RESULT", { ok:false, msg:"你們已經是好友" });
        return;
      }
      if (!mySocial.reqOut.includes(toId)) mySocial.reqOut.push(toId);

      const targetRow = await getProfileBasicByUserId(toId);
      if (!targetRow) {
        socket.emit("FRIEND_REQUEST_RESULT", { ok:false, msg:"找不到對方" });
        return;
      }
      const targetProf = normalizeProfilePayload(targetRow.stats || {});
      const targetSocial = (((targetProf||{}).client||{}).social) || (targetProf.client.social = {});
      targetSocial.friends = Array.isArray(targetSocial.friends) ? targetSocial.friends.map(Number).filter(n=>n>0) : [];
      targetSocial.reqIn = Array.isArray(targetSocial.reqIn) ? targetSocial.reqIn.map(Number).filter(n=>n>0) : [];
      targetSocial.reqOut = Array.isArray(targetSocial.reqOut) ? targetSocial.reqOut.map(Number).filter(n=>n>0) : [];
      targetSocial.friend_in = Array.isArray(targetSocial.friend_in) ? targetSocial.friend_in : [];
      targetSocial.friend_out = Array.isArray(targetSocial.friend_out) ? targetSocial.friend_out : [];
      if (!targetSocial.reqIn.includes(fromId)) targetSocial.reqIn.push(fromId);

      const basicFrom = await getProfileBasicByUserId(fromId);
      const basicTo = await getProfileBasicByUserId(toId);
      const reqInEntry = {
        userId: fromId,
        name: basicFrom?.name || `玩家${fromId}`,
        avatar: Number(basicFrom?.avatar || 1),
        ts: Date.now(),
      };
      const reqOutEntry = {
        userId: toId,
        name: basicTo?.name || `玩家${toId}`,
        avatar: Number(basicTo?.avatar || 1),
        ts: Date.now(),
      };
      targetSocial.friend_in = targetSocial.friend_in.filter(x => Number(x?.userId||0) !== fromId);
      targetSocial.friend_in.push(reqInEntry);
      mySocial.friend_out = mySocial.friend_out.filter(x => Number(x?.userId||0) !== toId);
      mySocial.friend_out.push(reqOutEntry);

      await writeProfileBySecret(sec, myProf);
      await writeProfileBySecret(targetRow.secret, targetProf);

      emitToUser(toId, "FRIEND_REQUEST_RECEIVED", reqInEntry);
      await pushSocialStateToUser(fromId);
      await pushSocialStateToUser(toId);

      socket.emit("FRIEND_REQUEST_RESULT", { ok:true });
    }catch(e){
      console.error("FRIEND_REQUEST_SEND error:", e);
      socket.emit("FRIEND_REQUEST_RESULT", { ok:false, msg:"好友申請失敗" });
    }
  });

  socket.on("FRIEND_REQUEST_ACCEPT", async ({ secret, userId, fromUserId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const toId = Number(userId || 0) || 0;
      const fromId = Number(fromUserId || 0) || 0;
      if (!sec || !(toId > 0) || !(fromId > 0) || toId === fromId) {
        socket.emit("FRIEND_ACCEPT_RESULT", { ok:false, msg:"參數錯誤" });
        return;
      }
      const me = await readProfileBySecret(sec);
      if (!me || Number(me.user_id || 0) !== toId) {
        socket.emit("FRIEND_ACCEPT_RESULT", { ok:false, msg:"憑證錯誤" });
        return;
      }
      const myProf = normalizeProfilePayload(me.stats || {});
      const mySocial = (((myProf||{}).client||{}).social) || (myProf.client.social = {});
      mySocial.friends = Array.isArray(mySocial.friends) ? mySocial.friends.map(Number).filter(n=>n>0) : [];
      mySocial.reqIn = Array.isArray(mySocial.reqIn) ? mySocial.reqIn.map(Number).filter(n=>n>0) : [];
      mySocial.reqOut = Array.isArray(mySocial.reqOut) ? mySocial.reqOut.map(Number).filter(n=>n>0) : [];
      mySocial.friend_in = Array.isArray(mySocial.friend_in) ? mySocial.friend_in : [];
      mySocial.friend_out = Array.isArray(mySocial.friend_out) ? mySocial.friend_out : [];
      if (!mySocial.friends.includes(fromId)) mySocial.friends.push(fromId);
      mySocial.reqIn = mySocial.reqIn.filter(x => Number(x)!==fromId);
      mySocial.friend_in = mySocial.friend_in.filter(x => Number(x?.userId||0)!==fromId);

      const other = await getProfileBasicByUserId(fromId);
      if (!other) {
        socket.emit("FRIEND_ACCEPT_RESULT", { ok:false, msg:"找不到對方" });
        return;
      }
      const otherProf = normalizeProfilePayload(other.stats || {});
      const otherSocial = (((otherProf||{}).client||{}).social) || (otherProf.client.social = {});
      otherSocial.friends = Array.isArray(otherSocial.friends) ? otherSocial.friends.map(Number).filter(n=>n>0) : [];
      otherSocial.reqIn = Array.isArray(otherSocial.reqIn) ? otherSocial.reqIn.map(Number).filter(n=>n>0) : [];
      otherSocial.reqOut = Array.isArray(otherSocial.reqOut) ? otherSocial.reqOut.map(Number).filter(n=>n>0) : [];
      otherSocial.friend_in = Array.isArray(otherSocial.friend_in) ? otherSocial.friend_in : [];
      otherSocial.friend_out = Array.isArray(otherSocial.friend_out) ? otherSocial.friend_out : [];
      if (!otherSocial.friends.includes(toId)) otherSocial.friends.push(toId);
      otherSocial.reqOut = otherSocial.reqOut.filter(x => Number(x)!==toId);
      otherSocial.friend_out = otherSocial.friend_out.filter(x => Number(x?.userId||0)!==toId);

      await writeProfileBySecret(sec, myProf);
      await writeProfileBySecret(other.secret, otherProf);

      await pushSocialStateToUser(toId);
      await pushSocialStateToUser(fromId);

      socket.emit("FRIEND_ACCEPT_RESULT", { ok:true });
      emitToUser(fromId, "FRIEND_ACCEPTED", { userId: toId });
    }catch(e){
      console.error("FRIEND_REQUEST_ACCEPT error:", e);
      socket.emit("FRIEND_ACCEPT_RESULT", { ok:false, msg:"接受好友失敗" });
    }
  });

  socket.on("FRIEND_REQUEST_REJECT", async ({ secret, userId, fromUserId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const toId = Number(userId || 0) || 0;
      const fromId = Number(fromUserId || 0) || 0;
      if (!sec || !(toId > 0) || !(fromId > 0)) {
        socket.emit("FRIEND_REJECT_RESULT", { ok:false, msg:"參數錯誤" });
        return;
      }
      const me = await readProfileBySecret(sec);
      if (!me || Number(me.user_id || 0) !== toId) {
        socket.emit("FRIEND_REJECT_RESULT", { ok:false, msg:"憑證錯誤" });
        return;
      }
      const myProf = normalizeProfilePayload(me.stats || {});
      const mySocial = (((myProf||{}).client||{}).social) || (myProf.client.social = {});
      mySocial.reqIn = Array.isArray(mySocial.reqIn) ? mySocial.reqIn.map(Number).filter(n=>n>0) : [];
      mySocial.friend_in = Array.isArray(mySocial.friend_in) ? mySocial.friend_in : [];
      mySocial.reqIn = mySocial.reqIn.filter(x => Number(x)!==fromId);
      mySocial.friend_in = mySocial.friend_in.filter(x => Number(x?.userId||0)!==fromId);
      await writeProfileBySecret(sec, myProf);

      const other = await getProfileBasicByUserId(fromId);
      if (other){
        const otherProf = normalizeProfilePayload(other.stats || {});
        const otherSocial = (((otherProf||{}).client||{}).social) || (otherProf.client.social = {});
        otherSocial.reqOut = Array.isArray(otherSocial.reqOut) ? otherSocial.reqOut.map(Number).filter(n=>n>0) : [];
        otherSocial.friend_out = Array.isArray(otherSocial.friend_out) ? otherSocial.friend_out : [];
        otherSocial.reqOut = otherSocial.reqOut.filter(x => Number(x)!==toId);
        otherSocial.friend_out = otherSocial.friend_out.filter(x => Number(x?.userId||0)!==toId);
        await writeProfileBySecret(other.secret, otherProf);
      }

      await pushSocialStateToUser(toId);
      await pushSocialStateToUser(fromId);

      socket.emit("FRIEND_REJECT_RESULT", { ok:true });
    }catch(e){
      console.error("FRIEND_REQUEST_REJECT error:", e);
      socket.emit("FRIEND_REJECT_RESULT", { ok:false, msg:"拒絕好友失敗" });
    }
  });

  socket.on("DM_SEND", async ({ secret, fromUserId, toUserId, body } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const fromId = Number(fromUserId || 0) || 0;
      const toId = Number(toUserId || 0) || 0;
      const text = String(body || "").slice(0, 1000).trim();
      if (!sec || !(fromId > 0) || !(toId > 0) || !text) {
        socket.emit("DM_SEND_RESULT", { ok:false, msg:"訊息無效" });
        return;
      }
      const me = await readProfileBySecret(sec);
      if (!me || Number(me.user_id || 0) !== fromId) {
        socket.emit("DM_SEND_RESULT", { ok:false, msg:"憑證錯誤" });
        return;
      }
      const friend = await areFriends(fromId, toId);
      if (!friend) {
        socket.emit("DM_SEND_RESULT", { ok:false, msg:"只有好友可以私訊" });
        return;
      }

      const a = Math.min(fromId, toId);
      const b = Math.max(fromId, toId);
      const createdAt = Date.now();
      const ins = await pool.query(
        `INSERT INTO dm_messages(a_id,b_id,from_id,body,created_at)
         VALUES($1,$2,$3,$4,$5)
         RETURNING id, a_id, b_id, from_id, body, created_at`,
        [a, b, fromId, text, createdAt]
      );
      const msg = ins.rows[0];

      const payload = {
        id: Number(msg.id),
        aId: Number(msg.a_id),
        bId: Number(msg.b_id),
        fromId: Number(msg.from_id),
        toId,
        body: String(msg.body || ""),
        createdAt: Number(msg.created_at || createdAt),
      };

      // 發送給雙方所有連線
      emitToUser(fromId, "DM_MESSAGE", payload);
      emitToUser(toId, "DM_MESSAGE", payload);

      // 若收件者不在 DM 頁面，可額外送未讀提示
      emitToUser(toId, "DM_UNREAD", { fromId, countDelta: 1, ts: Date.now() });

      socket.emit("DM_SEND_RESULT", { ok:true, message: payload });
    }catch(e){
      console.error("DM_SEND error:", e);
      socket.emit("DM_SEND_RESULT", { ok:false, msg:"私訊發送失敗" });
    }
  });

  socket.on("DM_HISTORY_GET", async ({ secret, userId, otherUserId, limit=50, beforeId } = {}) => {
    try{
      const sec = String(secret || "").trim();
      const uid = Number(userId || 0) || 0;
      const oid = Number(otherUserId || 0) || 0;
      const lim = Math.max(1, Math.min(100, Number(limit)||50));
      const before = Number(beforeId || 0) || 0;

      if (!sec || !(uid > 0) || !(oid > 0)) {
        socket.emit("DM_HISTORY_DATA", { ok:false, msg:"參數錯誤", messages: [] });
        return;
      }
      const me = await readProfileBySecret(sec);
      if (!me || Number(me.user_id || 0) !== uid) {
        socket.emit("DM_HISTORY_DATA", { ok:false, msg:"憑證錯誤", messages: [] });
        return;
      }
      const friend = await areFriends(uid, oid);
      if (!friend) {
        socket.emit("DM_HISTORY_DATA", { ok:false, msg:"不是好友", messages: [] });
        return;
      }

      const a = Math.min(uid, oid);
      const b = Math.max(uid, oid);

      let q;
      if (before > 0) {
        q = await pool.query(
          `SELECT id, a_id, b_id, from_id, body, created_at
             FROM dm_messages
            WHERE a_id=$1 AND b_id=$2 AND id < $3
            ORDER BY id DESC
            LIMIT $4`,
          [a, b, before, lim]
        );
      } else {
        q = await pool.query(
          `SELECT id, a_id, b_id, from_id, body, created_at
             FROM dm_messages
            WHERE a_id=$1 AND b_id=$2
            ORDER BY id DESC
            LIMIT $3`,
          [a, b, lim]
        );
      }

      const messages = q.rows
        .slice()
        .reverse()
        .map(r => ({
          id: Number(r.id),
          aId: Number(r.a_id),
          bId: Number(r.b_id),
          fromId: Number(r.from_id),
          body: String(r.body || ""),
          createdAt: Number(r.created_at || 0) || 0,
        }));

      socket.emit("DM_HISTORY_DATA", { ok:true, messages });
    }catch(e){
      console.error("DM_HISTORY_GET error:", e);
      socket.emit("DM_HISTORY_DATA", { ok:false, msg:"讀取私訊失敗", messages: [] });
    }
  });

  socket.on("LOBBY_INVITE_SEND", async ({ secret, fromUserId, toUserId, roomId } = {}) => {
    try{
      cleanupLobbyInvites();
      const sec = String(secret || "").trim();
      const fromId = Number(fromUserId || 0) || 0;
      const toId = Number(toUserId || 0) || 0;
      const code = String(roomId || "").trim().toUpperCase();
      if (!sec || !(fromId > 0) || !(toId > 0) || !code) {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"邀請參數錯誤" });
        return;
      }
      const me = await readProfileBySecret(sec);
      if (!me || Number(me.user_id || 0) !== fromId) {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"憑證錯誤" });
        return;
      }
      if (!(await areFriends(fromId, toId))) {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"只能邀請好友" });
        return;
      }
      const room = rooms.get(code);
      if (!room || room.phase !== "lobby") {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"房間不存在或已開始" });
        return;
      }
      const meInRoom = room.players.find(p => Number(p.userId || 0) === fromId);
      if (!meInRoom) {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"你不在這個等待室" });
        return;
      }
      const targetBasic = await getProfileBasicByUserId(toId);
      if (!targetBasic) {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"找不到對方" });
        return;
      }
      const muteRemain = lobbyInviteMuteRemainingMs(toId);
      if (muteRemain > 0) {
        socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"對方目前暫時關閉邀請通知" });
        return;
      }
      const inviteId = crypto.randomUUID ? crypto.randomUUID() : genSecret();
      const now = Date.now();
      const inv = {
        id: inviteId,
        fromId,
        fromName: String(me.name || me.stats?.client?.player?.name || `玩家${fromId}`),
        fromAvatar: Number(me.avatar || me.stats?.client?.player?.avatar || 1),
        toId,
        roomId: code,
        createdAt: now,
        expiresAt: now + 5 * 60 * 1000,
      };
      lobbyInvites.set(inviteId, inv);

      emitToUser(toId, "LOBBY_INVITE", makeInvitePayload(inv));
      socket.emit("LOBBY_INVITE_RESULT", { ok:true, invite: makeInvitePayload(inv) });
    }catch(e){
      console.error("LOBBY_INVITE_SEND error:", e);
      socket.emit("LOBBY_INVITE_RESULT", { ok:false, msg:"送出邀請失敗" });
    }
  });

  socket.on("LOBBY_INVITE_RESPOND", async ({ secret, userId, inviteId, action } = {}) => {
    try{
      cleanupLobbyInvites();
      const sec = String(secret || "").trim();
      const uid = Number(userId || 0) || 0;
      const iid = String(inviteId || "").trim();
      const act = String(action || "").trim().toLowerCase();
      if (!sec || !(uid > 0) || !iid || !["accept","reject","mute5"].includes(act)) {
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"邀請回應參數錯誤" });
        return;
      }
      const row = await readProfileBySecret(sec);
      if (!row || Number(row.user_id || 0) !== uid) {
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"憑證錯誤" });
        return;
      }
      const inv = lobbyInvites.get(iid);
      if (!inv || Number(inv.toId || 0) !== uid) {
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"邀請不存在或已失效" });
        return;
      }
      if (Number(inv.expiresAt || 0) <= Date.now()) {
        lobbyInvites.delete(iid);
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"邀請已過期" });
        return;
      }

      if (act === "mute5") {
        lobbyInviteMuteUntil.set(uid, Date.now() + 5 * 60 * 1000);
        lobbyInvites.delete(iid);
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:true, action:"mute5" });
        emitToUser(inv.fromId, "LOBBY_INVITE_FEEDBACK", {
          inviteId: iid,
          toId: uid,
          action: "mute5",
        });
        return;
      }

      if (act === "reject") {
        lobbyInvites.delete(iid);
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:true, action:"reject" });
        emitToUser(inv.fromId, "LOBBY_INVITE_FEEDBACK", {
          inviteId: iid,
          toId: uid,
          action: "reject",
        });
        return;
      }

      // accept
      const room = rooms.get(String(inv.roomId || "").trim().toUpperCase());
      if (!room || room.phase !== "lobby") {
        lobbyInvites.delete(iid);
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"房間已不存在或已開始" });
        return;
      }

      // 已在房內就直接導航
      const existingByUser = room.players.find(p => Number(p.userId || 0) === uid);
      if (existingByUser) {
        lobbyInvites.delete(iid);
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", {
          ok:true,
          action:"accept",
          roomId: room.code,
          alreadyJoined: true,
        });
        socket.emit("EMIT", { type:"nav_waiting", code: room.code, viaInvite:true });
        emitToUser(inv.fromId, "LOBBY_INVITE_FEEDBACK", {
          inviteId: iid,
          toId: uid,
          action: "accept",
          roomId: room.code,
        });
        return;
      }

      const activeHumans = room.players.filter(p => !p.isCPU).length;
      if (activeHumans >= 4) {
        socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"房間已滿" });
        return;
      }

      // 若有在線的同 userId 舊 socket 先從其他等待室移除，避免同人多房
      try{
        for (const [code0, room0] of rooms.entries()){
          const idx0 = room0.players.findIndex(p => Number(p.userId || 0) === uid);
          if (idx0 >= 0) {
            room0.players.splice(idx0, 1);
            broadcastLobby(room0);
            maybeDissolveLobbyIfNoHumans(code0);
          }
        }
      }catch{}

      // 以目前這個 socket 加入房間（注意：等待頁先做 SOCIAL_AUTH / PRESENCE_SET）
      const joinerName = String(row.name || row.stats?.client?.player?.name || "玩家");
      const joinerAvatar = String(row.avatar || row.stats?.client?.player?.avatar || "🙂");

      const p = {
        id: room.nextPlayerId++,
        name: joinerName,
        avatar: joinerAvatar,
        ready: false,
        socketId: socket.id,
        isCPU: false,
        online: true,
        userId: uid,
      };
      room.players.push(p);
      socket.join(room.code);

      lobbyInvites.delete(iid);
      broadcastLobby(room);

      socket.emit("LOBBY_INVITE_RESPONSE_RESULT", {
        ok:true,
        action:"accept",
        roomId: room.code,
        playerId: p.id,
      });
      socket.emit("EMIT", { type:"nav_waiting", code: room.code, viaInvite:true });

      emitToUser(inv.fromId, "LOBBY_INVITE_FEEDBACK", {
        inviteId: iid,
        toId: uid,
        action: "accept",
        roomId: room.code,
      });
    }catch(e){
      console.error("LOBBY_INVITE_RESPOND error:", e);
      socket.emit("LOBBY_INVITE_RESPONSE_RESULT", { ok:false, msg:"回應邀請失敗" });
    }
  });

  socket.on("LOBBY_INVITES_SYNC", async ({ secret, userId } = {}) => {
    try{
      cleanupLobbyInvites();
      const sec = String(secret || "").trim();
      const uid = Number(userId || 0) || 0;
      if (!sec || !(uid > 0)) {
        socket.emit("LOBBY_INVITES_DATA", { ok:false, invites: [] });
        return;
      }
      const row = await readProfileBySecret(sec);
      if (!row || Number(row.user_id || 0) !== uid) {
        socket.emit("LOBBY_INVITES_DATA", { ok:false, invites: [] });
        return;
      }
      const invites = [];
      for (const inv of lobbyInvites.values()){
        if (Number(inv.toId || 0) === uid && Number(inv.expiresAt || 0) > Date.now()) {
          invites.push(makeInvitePayload(inv));
        }
      }
      socket.emit("LOBBY_INVITES_DATA", {
        ok:true,
        invites,
        mutedMs: lobbyInviteMuteRemainingMs(uid),
      });
    }catch(e){
      console.error("LOBBY_INVITES_SYNC error:", e);
      socket.emit("LOBBY_INVITES_DATA", { ok:false, invites: [] });
    }
  });

  // 建房：只加入房主，不預設補任何玩家/CPU（前端再決定加幾個 CPU）
  socket.on("CREATE_ROOM", (data) => {
    const code = pickUniqueCode();
    const room = {
      code,
      host: 1,
      phase: "lobby",
      players: [{
        id: 1,
        name: data.name || "玩家1",
        avatar: data.avatar || "🙂",
        ready: false,
        socketId: socket.id,
        isCPU: false,
        online: true,                   // 新增
        userId: Number(data.userId || 0) || null, // 新增：綁定帳號
      }],
      nextPlayerId: 2,
      state: null,
      turnWarnTimer: null,
      turnTimer: null,
      cpuTakeoverTimer: null,
    };
    rooms.set(code, room);
    socket.join(code);
    broadcastLobby(room);
  });

  // 加房：只允許真人加入到 4 人總上限；不自動補位
  socket.on("JOIN_ROOM", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || room.phase !== "lobby") return;

    // 先檢查這個 userId 是否已經在房內（避免同帳號重複加入）
    const uid = Number(data.userId || 0) || 0;
    if (uid > 0) {
      const existingByUser = room.players.find(p => Number(p.userId || 0) === uid);
      if (existingByUser) {
        existingByUser.socketId = socket.id;   // 更新連線
        existingByUser.online = true;
        socket.join(code);
        broadcastLobby(room);
        return;
      }
    }

    const humanCount = room.players.filter(p => !p.isCPU).length;
    if (humanCount >= 4) return;

    const playerId = room.nextPlayerId++;
    room.players.push({
      id: playerId,
      name: data.name || `玩家${playerId}`,
      avatar: data.avatar || "🙂",
      ready: false,
      socketId: socket.id,
      isCPU: false,
      online: true,                  // 新增
      userId: uid || null,           // 新增
    });
    socket.join(code);
    broadcastLobby(room);
  });

  // 房主可動態加/減 CPU（最多總數 4 人、CPU 最多 3）
  socket.on("SET_CPU_COUNT", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const want = Math.max(0, Math.min(3, Number(data.cpuCount || 0)));
    const room = rooms.get(code);
    if (!room || room.phase !== "lobby") return;

    // 只有房主可以調整
    const me = room.players.find(p => p.socketId === socket.id);
    if (!me || me.id !== room.host) return;

    const humans = room.players.filter(p => !p.isCPU);
    let cpus = room.players.filter(p => p.isCPU);

    // 總人數上限 4
    const maxCpuAllowedBySeats = Math.max(0, 4 - humans.length);
    const targetCpu = Math.min(want, maxCpuAllowedBySeats, 3);

    if (cpus.length < targetCpu) {
      while (cpus.length < targetCpu) {
        const id = room.nextPlayerId++;
        const cpu = {
          id,
          name: `CPU${cpus.length + 1}`,
          avatar: "🤖",
          ready: true,     // CPU 視同已準備
          socketId: `cpu:${code}:${id}`,
          isCPU: true,
          online: true,
          userId: null,
        };
        room.players.push(cpu);
        cpus.push(cpu);
      }
    } else if (cpus.length > targetCpu) {
      const removeN = cpus.length - targetCpu;
      let removed = 0;
      room.players = room.players.filter(p => {
        if (p.isCPU && removed < removeN) { removed++; return false; }
        return true;
      });
    }

    // 若房主被刪到（理論上不會），補正
    if (!room.players.some(p => p.id === room.host)) {
      room.host = room.players[0]?.id || 1;
    }

    broadcastLobby(room);
  });

  // 房主點擊玩家頭像：踢出（房主不能踢自己；只在 lobby）
  socket.on("KICK_PLAYER", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const targetId = Number(data.targetId || 0);
    const room = rooms.get(code);
    if (!room || room.phase !== "lobby") return;

    const me = room.players.find(p => p.socketId === socket.id);
    if (!me || me.id !== room.host) return;       // 只有房主可踢
    if (targetId === room.host) return;           // 不能踢自己

    const idx = room.players.findIndex(p => p.id === targetId);
    if (idx < 0) return;

    const target = room.players[idx];
    room.players.splice(idx, 1);

    // 通知被踢者返回主畫面（CPU 不需要）
    if (!target.isCPU && target.socketId) {
      io.to(target.socketId).emit("ROOM_KICKED", { code, byHost: true });
      try { io.sockets.sockets.get(target.socketId)?.leave(code); } catch {}
    }

    // 若房主被意外移除（理論上不會），補新房主
    if (!room.players.some(p => p.id === room.host)) {
      room.host = room.players[0]?.id || 1;
    }

    broadcastLobby(room);
    maybeDissolveLobbyIfNoHumans(code);
  });

  // 就緒切換：只有真人需要 ready；CPU 固定 ready=true
  socket.on("TOGGLE_READY", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || room.phase !== "lobby") return;
    const p = room.players.find((x) => x.socketId === socket.id);
    if (!p || p.isCPU) return;
    p.ready = !p.ready;
    broadcastLobby(room);
  });

  // 開始：至少 2 人；所有真人 ready
  socket.on("START_GAME", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || room.phase !== "lobby") return;

    const me = room.players.find((x) => x.socketId === socket.id);
    if (!me || me.id !== room.host) return;

    const humans = room.players.filter(p => !p.isCPU);
    const total = room.players.length;
    const allHumansReady = humans.every(p => !!p.ready);

    if (total < 2) return;
    if (!allHumansReady) return;

    const startPlayers = buildStartPlayers(room.players);
    room.state = createInitialState(startPlayers);
    room.phase = "playing";

    // 場地卡：4人兩張；3/2人一張；1人零張
    const aliveAtStart = room.state.players.filter(p => p.alive).length;
    const venueCount = desiredVenueCountByAlive(aliveAtStart);
    const used = new Set();
    room.venues = [];
    for (let i = 0; i < venueCount; i++) {
      const id = drawUniqueVenueId([...used]);
      used.add(id);
      room.venues.push({ id });
    }

    // 存房內對應表：state.players 已用同樣順序建立 id，仍可沿用 room.players 的 id
    room.players.forEach((meta, idx) => {
      meta.id = room.state.players[idx].id; // 保險對齊
    });

    // 進場動畫/導航
    for (const p of room.players) {
      const q = new URLSearchParams({
        room: code,
        name: p.name,
        avatar: p.avatar,
        playerId: String(p.id),
        userId: String(Number(p.userId || 0) || 0),
      });
      io.to(p.socketId).emit("EMIT", { type: "nav_game", url: `/game.html?${q.toString()}` });
    }

    // 等一下讓前端頁面切過來再推狀態
    setTimeout(() => {
      emitState(room);
      io.to(room.code).emit("coin_count", room.state.chestCoins);
      io.to(room.code).emit("venues", room.venues);
      autoArrangeCardPositions(room);
      armRoomWatchdogs(room);           // <— 開局即上 watchdog
    }, 350);
  });

  // 進入 game.html 後主動加入 Socket room，伺服器回補目前 STATE
  socket.on("GAME_JOIN", (data) => {
    const code = String(data.room || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room || room.phase !== "playing") return;

    // 依 query 的 playerId 找到既有玩家，更新 socketId（支援頁面切換後重連）
    const playerId = Number(data.playerId || 0);
    const p = room.players.find((x) => x.id === playerId);
    if (!p) return;

    try {
      if (p.socketId && p.socketId !== socket.id) {
        io.sockets.sockets.get(p.socketId)?.leave(code);
      }
    } catch {}
    p.socketId = socket.id;
    p.online = true;                  // 新增：標記在線

    socket.join(code);

    // 立刻回補目前可見狀態給這位玩家
    const visible = getVisibleState(room.state, p.id);
    io.to(socket.id).emit("STATE", visible);
    io.to(socket.id).emit("coin_count", room.state.chestCoins);
    io.to(socket.id).emit("venues", room.venues || []);
    if (room.cardPositions) {
      io.to(socket.id).emit("card_positions", room.cardPositions);
    } else {
      autoArrangeCardPositions(room);
    }

    // 若這個真人之前被 CPU 接手，重連後也維持覆蓋提示
    if (p.cpuControlled){
      emitPlayerAutoState(room, p.id, true);
    } else {
      // 玩家重進畫面，就把自己的 CPU 接手解除
      cancelAutoForPlayer(room, p.id);
    }

    emitLobbyViewFlagsForPlaying(room);
  });

  // 玩家點一下畫面，要求解除 CPU 接手
  socket.on("CANCEL_CPU_TAKEOVER", (data = {}) => {
    try{
      const code = String(data.room || "").trim().toUpperCase();
      const playerId = Number(data.playerId || 0);
      const room = rooms.get(code);
      if (!room || room.phase !== "playing") return;

      const p = room.players.find(x => x.id === playerId);
      if (!p) return;
      if (p.socketId !== socket.id) return; // 只能本人解除
      if (p.isCPU) return;

      cancelAutoForPlayer(room, playerId);
    }catch(e){
      console.error("CANCEL_CPU_TAKEOVER error:", e);
    }
  });

  // 房主在只剩 CPU 可操作時，可一鍵跳過 CPU 回合
  socket.on("HOST_SKIP_CPU", (data = {}) => {
    try{
      const code = String(data.room || "").trim().toUpperCase();
      const room = rooms.get(code);
      if (!room || room.phase !== "playing") return;

      const me = room.players.find(x => x.socketId === socket.id);
      if (!me || me.id !== room.host) return;

      // 僅當完全沒有真人可操作時才允許
      if (countActiveHumans(room) > 0) return;

      // 直接讓當前 CPU/被接手者出牌
      const pid = room.state?.turnPlayerId;
      if (!pid) return;

      const sp = getPlayerById(room.state, pid);
      if (!sp || !sp.alive) return;

      // 若是人類但尚未接手，先標記成接手
      if (!sp.isCPU){
        const meta = getRoomMetaPlayer(room, pid);
        if (meta && !meta.cpuControlled){
          setCpuControlled(room, pid, true);
        }
      }

      clearRoomTimers(room);
      scheduleCpuAutoPlay(room, pid, 50);
    }catch(e){
      console.error("HOST_SKIP_CPU error:", e);
    }
  });

  // 出牌：沿用原本流程，但真人若正在被接手就不允許手動出
  socket.on("ACTION", (payload) => {
    const joined = getRoomBySocket(socket.id);
    if (!joined) return;

    const { room, player } = joined;
    if (room.phase !== "playing") return;

    // 不是你的回合
    if (room.state.turnPlayerId !== player.id) return;

    const sp = getPlayerById(room.state, player.id);
    if (!sp || !sp.alive) return;

    // CPU or 被 CPU 接手中的真人，不允許手動 action
    if (sp.isCPU || player.cpuControlled) return;

    // 合法真人操作：取消 watchdog，套用動作
    clearRoomTimers(room);

    const result = applyAction(room.state, player.id, payload);
    if (!result.ok) {
      // 非法仍重開 watchdog
      armRoomWatchdogs(room);
      return;
    }

    afterAnyAction(room);
  });

  // 房內聊天（等待室 + 遊戲中都可）
  socket.on("ROOM_CHAT", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const text = String(data.text || "").trim();
    if (!code || !text) return;
    const room = rooms.get(code);
    if (!room) return;

    const sender = room.players.find(p => p.socketId === socket.id);
    if (!sender) return;

    io.to(code).emit("room_chat", {
      fromId: sender.id,
      name: sender.name,
      avatar: sender.avatar,
      text: text.slice(0, 300),
      ts: Date.now(),
    });
  });

  socket.on("REQUEST_ROOMS", () => {
    const list = [];
    for (const room of rooms.values()) {
      if (room.phase !== "lobby") continue;
      const humanCount = room.players.filter(p => !p.isCPU).length;
      const cpuCount = room.players.filter(p => p.isCPU).length;
      const hostPlayer = room.players.find(p => p.id === room.host);
      list.push({
        code: room.code,
        roomTitle: `${hostPlayer?.name || "玩家"}的等待室`,
        hostName: hostPlayer?.name || "玩家",
        humans: humanCount,
        cpus: cpuCount,
        total: room.players.length,
      });
    }
    socket.emit("ROOMS", list);
  });

  socket.on("LEAVE_ROOM", (data) => {
    const code = String(data.code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return;

    const idx = room.players.findIndex(p => p.socketId === socket.id);
    if (idx < 0) return;

    const leaving = room.players[idx];
    room.players.splice(idx, 1);
    try { socket.leave(code); } catch {}

    if (room.phase === "lobby") {
      if (room.players.length === 0 || !room.players.some(p => !p.isCPU)) {
        rooms.delete(code);
        return;
      }
      if (leaving.id === room.host) {
        room.host = room.players.find(p => !p.isCPU)?.id || room.players[0].id;
      }
      broadcastLobby(room);
      maybeDissolveLobbyIfNoHumans(code);
      return;
    }

    // playing / finished：真人離開先標示離線，不直接移除 state 玩家
    const meta = room.players.find(p => p.id === leaving.id);
    if (meta) meta.online = false;

    // 真人離線 → 立即 CPU 接手（若還活著）
    try{
      const sp = getPlayerById(room.state, leaving.id);
      if (sp && sp.alive && !sp.isCPU){
        setCpuControlled(room, leaving.id, true);
        // 如果剛好是他的回合，安排自動出牌
        if (room.state?.turnPlayerId === leaving.id){
          clearRoomTimers(room);
          scheduleCpuAutoPlay(room, leaving.id, 500);
        }
      }
    }catch{}

    emitLobbyViewFlagsForPlaying(room);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);

    // social presence cleanup
    try{
      if (socket.userId) {
        markOffline(socket.userId, socket.id);
        lockRemoveSocket(socket.userId, socket.id);
      }
    }catch{}
    if (socket.userId) {
      pushSocialStateToUser(socket.userId).catch(()=>{});
      pushSocialStateToFriendsOf(socket.userId).catch(()=>{});
    }

    const joined = getRoomBySocket(socket.id);
    if (!joined) return;

    const { room, player } = joined;

    // lobby：直接移除，若沒真人了就解散
    if (room.phase === "lobby") {
      room.players = room.players.filter((p) => p.socketId !== socket.id);
      if (room.players.length === 0 || !room.players.some(p => !p.isCPU)) {
        rooms.delete(room.code);
        return;
      }
      if (player.id === room.host) room.host = room.players.find(p => !p.isCPU)?.id || room.players[0].id;
      broadcastLobby(room);
      maybeDissolveLobbyIfNoHumans(room.code);
      return;
    }

    // playing / finished：不刪玩家，改為離線，並由 CPU 接手
    const meta = room.players.find((p) => p.id === player.id);
    if (meta) meta.online = false;

    try{
      const sp = getPlayerById(room.state, player.id);
      if (sp && sp.alive && !sp.isCPU){
        setCpuControlled(room, player.id, true);
        if (room.phase === "playing" && room.state?.turnPlayerId === player.id){
          clearRoomTimers(room);
          scheduleCpuAutoPlay(room, player.id, 500);
        }
      }
    }catch{}

    emitLobbyViewFlagsForPlaying(room);

    // finished 房間會照 endGame 的清房定時器刪掉
    // ✅ 剩下的人繼續玩：重上 watchdog
    try{ armRoomWatchdogs(room); }catch{}
  });
});


const PORT = process.env.PORT || 8787;
server.listen(PORT, () => console.log("Server listening on", PORT));
