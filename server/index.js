// server/index.js — 動態人數/無佔位 + 正確對齊 playerId + 開局即廣播 STATE
const path = require("path");
const fs = require("fs/promises");
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
app.use(express.json({ limit: "30mb" }));
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/api/board-save", (req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  return next();
});

const BOARD_SAVE_DIR = path.join(__dirname, "data", "board_saves");
const BOARD_CAMPAIGN_DIR = path.join(__dirname, "data", "board_campaigns");
const BOARD_CAMPAIGN_SCHEMA_VERSION = 1;
const BOARD_DB_PERSISTENCE_ENABLED = Boolean(process.env.DATABASE_URL);
const boardCampaignWriteQueues = new Map();

async function ensureBoardPersistenceTables(){
  if(!BOARD_DB_PERSISTENCE_ENABLED) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_saves (
      room_code TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      saved_at BIGINT NOT NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS board_saves_saved_at_idx ON board_saves(saved_at DESC);`);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_campaigns (
      campaign_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at BIGINT NOT NULL
    );
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS board_campaigns_updated_at_idx ON board_campaigns(updated_at DESC);`);
}

let boardPersistenceInitError = null;
const boardPersistenceReady = ensureBoardPersistenceTables().then(() => {
  if(BOARD_DB_PERSISTENCE_ENABLED) console.log("[board-persistence] PostgreSQL ready");
}).catch((error) => {
  console.error("[board-persistence] PostgreSQL init failed", error);
  boardPersistenceInitError = error;
});

async function waitForBoardPersistence(){
  await boardPersistenceReady;
  if(boardPersistenceInitError) throw boardPersistenceInitError;
}

function sanitizeBoardSaveRoomCode(value){
  return String(value || "LOCAL").trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 32) || "LOCAL";
}

function boardSaveFilePath(roomCode){
  const safeRoom = sanitizeBoardSaveRoomCode(roomCode);
  return path.join(BOARD_SAVE_DIR, `${safeRoom}.json`);
}

function sanitizeBoardCampaignId(value){
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, "")
    .slice(0, 32);
}

function boardCampaignFilePath(campaignId){
  const safeId = sanitizeBoardCampaignId(campaignId);
  if(!safeId) throw new Error("invalid campaign id");
  return path.join(BOARD_CAMPAIGN_DIR, `${safeId}.json`);
}

function boardCampaignClone(value){
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function boardCampaignMemberKey(value = {}){
  const userId = Number(value?.userId ?? value?.id);
  if(Number.isFinite(userId) && userId > 0) return `user-${Math.trunc(userId)}`;
  const clientId = String(value?.clientId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 80);
  return clientId ? `client-${clientId}` : "";
}

function isValidBoardCampaign(campaign){
  return Boolean(
    campaign
    && typeof campaign === "object"
    && sanitizeBoardCampaignId(campaign.campaignId)
    && Array.isArray(campaign.members)
    && campaign.memberRecords
    && typeof campaign.memberRecords === "object"
  );
}

async function readBoardCampaign(campaignId){
  const safeId = sanitizeBoardCampaignId(campaignId);
  let campaign;
  if(BOARD_DB_PERSISTENCE_ENABLED){
    await waitForBoardPersistence();
    const result = await pool.query(
      "SELECT payload FROM board_campaigns WHERE campaign_id=$1 LIMIT 1",
      [safeId]
    );
    if(!result.rows.length){
      const error = new Error("campaign not found");
      error.code = "ENOENT";
      throw error;
    }
    campaign = result.rows[0].payload;
  }else{
    const raw = await fs.readFile(boardCampaignFilePath(safeId), "utf8");
    campaign = JSON.parse(raw);
  }
  if(!isValidBoardCampaign(campaign)){
    const error = new Error("invalid campaign");
    error.code = "INVALID_CAMPAIGN";
    throw error;
  }
  return campaign;
}

async function writeBoardCampaign(campaign){
  if(!isValidBoardCampaign(campaign)) throw new Error("invalid campaign");
  const normalized = {
    ...campaign,
    schemaVersion: BOARD_CAMPAIGN_SCHEMA_VERSION,
    campaignId: sanitizeBoardCampaignId(campaign.campaignId),
    updatedAt: Date.now(),
  };
  if(BOARD_DB_PERSISTENCE_ENABLED){
    await waitForBoardPersistence();
    await pool.query(
      `INSERT INTO board_campaigns(campaign_id,payload,updated_at)
       VALUES($1,$2,$3)
       ON CONFLICT(campaign_id) DO UPDATE
       SET payload=EXCLUDED.payload, updated_at=EXCLUDED.updated_at`,
      [normalized.campaignId, normalized, normalized.updatedAt]
    );
    return normalized;
  }
  await fs.mkdir(BOARD_CAMPAIGN_DIR, { recursive: true });
  const filePath = boardCampaignFilePath(normalized.campaignId);
  const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(normalized), "utf8");
  try{
    await fs.rename(tempPath, filePath);
  }catch(error){
    if(!["EPERM", "EEXIST", "EACCES"].includes(String(error?.code || ""))) throw error;
    // Windows/OneDrive/防毒軟體偶爾會短暫鎖住既有 JSON；同一 campaign
    // 已由 write queue 串行化，因此可安全改用覆寫後移除暫存檔。
    await fs.copyFile(tempPath, filePath);
    await fs.unlink(tempPath).catch(() => {});
  }
  return normalized;
}

async function listBoardCampaigns(){
  if(BOARD_DB_PERSISTENCE_ENABLED){
    await waitForBoardPersistence();
    const result = await pool.query("SELECT payload FROM board_campaigns ORDER BY updated_at DESC");
    return result.rows.map((row) => row.payload).filter(isValidBoardCampaign);
  }
  let entries = [];
  try{
    entries = await fs.readdir(BOARD_CAMPAIGN_DIR, { withFileTypes:true });
  }catch(error){
    if(error?.code === "ENOENT") return [];
    throw error;
  }
  const campaigns = [];
  for(const entry of entries){
    if(!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    try{
      campaigns.push(await readBoardCampaign(path.basename(entry.name, ".json")));
    }catch(error){
      console.warn("[board-campaign:list] skipped invalid file", entry.name, String(error?.message || error));
    }
  }
  return campaigns;
}

async function withBoardCampaignWriteLock(campaignId, task){
  const key = sanitizeBoardCampaignId(campaignId);
  const previous = boardCampaignWriteQueues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(task);
  boardCampaignWriteQueues.set(key, next);
  try{
    return await next;
  }finally{
    if(boardCampaignWriteQueues.get(key) === next) boardCampaignWriteQueues.delete(key);
  }
}

function isValidBoardSavePayload(payload){
  return Boolean(payload && typeof payload === "object" && payload.gameState && payload.gameState.boardData);
}

async function readValidBoardSavePayload(roomCode){
  const safeRoom = sanitizeBoardSaveRoomCode(roomCode);
  let payload;
  let raw;
  if(BOARD_DB_PERSISTENCE_ENABLED){
    await waitForBoardPersistence();
    const result = await pool.query(
      "SELECT payload FROM board_saves WHERE room_code=$1 LIMIT 1",
      [safeRoom]
    );
    if(!result.rows.length){
      const error = new Error("save not found");
      error.code = "ENOENT";
      throw error;
    }
    payload = result.rows[0].payload;
    raw = JSON.stringify(payload);
  }else{
    raw = await fs.readFile(boardSaveFilePath(safeRoom), "utf8");
    payload = JSON.parse(raw);
  }
  if (!isValidBoardSavePayload(payload)) {
    const error = new Error("invalid save");
    error.code = "INVALID_SAVE";
    throw error;
  }
  return { roomCode: safeRoom, payload, raw };
}

function boardSaveTimestamp(payload, stat){
  const savedAt = Date.parse(payload?.serverSavedAt || payload?.savedAt || "");
  return Number.isFinite(savedAt) ? savedAt : Number(stat?.mtimeMs || 0);
}

async function readLatestValidBoardSavePayload(excludeRoomCode = ""){
  const exclude = sanitizeBoardSaveRoomCode(excludeRoomCode);
  if(BOARD_DB_PERSISTENCE_ENABLED){
    await waitForBoardPersistence();
    const result = await pool.query(
      `SELECT room_code,payload,saved_at
       FROM board_saves
       WHERE room_code<>$1
       ORDER BY saved_at DESC
       LIMIT 1`,
      [exclude]
    );
    if(!result.rows.length || !isValidBoardSavePayload(result.rows[0].payload)) return null;
    return {
      roomCode: result.rows[0].room_code,
      payload: result.rows[0].payload,
      timestamp: Number(result.rows[0].saved_at || 0),
      modifiedAt: Number(result.rows[0].saved_at || 0),
    };
  }
  let entries = [];
  try {
    entries = await fs.readdir(BOARD_SAVE_DIR, { withFileTypes: true });
  } catch (error) {
    if (error?.code === "ENOENT") return null;
    throw error;
  }
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".json")) continue;
    const roomCode = sanitizeBoardSaveRoomCode(path.basename(entry.name, ".json"));
    if (!roomCode || roomCode === exclude) continue;
    const filePath = boardSaveFilePath(roomCode);
    try {
      const [raw, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);
      const payload = JSON.parse(raw);
      if (!isValidBoardSavePayload(payload)) continue;
      candidates.push({
        roomCode,
        payload,
        timestamp: boardSaveTimestamp(payload, stat),
        modifiedAt: Number(stat.mtimeMs || 0),
      });
    } catch (_) {
      // Ignore broken or in-progress save files when searching fallback saves.
    }
  }
  candidates.sort((a, b) => (b.timestamp - a.timestamp) || (b.modifiedAt - a.modifiedAt));
  return candidates[0] || null;
}

app.get("/api/board-save/:roomCode", async (req, res) => {
  const roomCode = sanitizeBoardSaveRoomCode(req.params.roomCode);
  try {
    const { payload } = await readValidBoardSavePayload(roomCode);
    return res.json({ ok: true, roomCode, payload });
  } catch (error) {
    if (error?.code === "INVALID_SAVE") {
      return res.status(422).json({ ok: false, error: "invalid save" });
    }
    if (error?.code === "ENOENT") {
      const fallback = await readLatestValidBoardSavePayload(roomCode);
      if (fallback?.payload) {
        return res.json({ ok: true, roomCode, fallbackRoomCode: fallback.roomCode, payload: fallback.payload });
      }
      return res.status(404).json({ ok: false, error: "not found" });
    }
    console.error("[board-save:get] failed:", error);
    return res.status(500).json({ ok: false, error: "read failed" });
  }
});

app.put("/api/board-save/:roomCode", async (req, res) => {
  const roomCode = sanitizeBoardSaveRoomCode(req.params.roomCode || req.body?.roomCode);
  const payload = req.body?.payload || req.body;
  if (!isValidBoardSavePayload(payload)) {
    return res.status(400).json({ ok: false, error: "invalid save payload" });
  }
  const normalized = {
    ...payload,
    roomCode: payload.roomCode || roomCode,
    serverSavedAt: new Date().toISOString(),
  };
  try {
    if(BOARD_DB_PERSISTENCE_ENABLED){
      await waitForBoardPersistence();
      const savedAtMs = Date.parse(normalized.serverSavedAt) || Date.now();
      await pool.query(
        `INSERT INTO board_saves(room_code,payload,saved_at)
         VALUES($1,$2,$3)
         ON CONFLICT(room_code) DO UPDATE
         SET payload=EXCLUDED.payload, saved_at=EXCLUDED.saved_at`,
        [roomCode, normalized, savedAtMs]
      );
    }else{
      await fs.mkdir(BOARD_SAVE_DIR, { recursive: true });
      const filePath = boardSaveFilePath(roomCode);
      const tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(normalized), "utf8");
      await fs.rename(tempPath, filePath);
    }
    return res.json({ ok: true, roomCode, savedAt: normalized.savedAt, serverSavedAt: normalized.serverSavedAt });
  } catch (error) {
    console.error("[board-save:put] failed:", error);
    return res.status(500).json({ ok: false, error: "write failed" });
  }
});

app.delete("/api/board-save/:roomCode", async (req, res) => {
  const roomCode = sanitizeBoardSaveRoomCode(req.params.roomCode);
  try {
    if(BOARD_DB_PERSISTENCE_ENABLED){
      await waitForBoardPersistence();
      const result = await pool.query("DELETE FROM board_saves WHERE room_code=$1", [roomCode]);
      return res.json({ ok: true, roomCode, deleted: result.rowCount > 0 });
    }
    await fs.unlink(boardSaveFilePath(roomCode));
    return res.json({ ok: true, roomCode, deleted: true });
  } catch (error) {
    if (error?.code === "ENOENT") {
      return res.json({ ok: true, roomCode, deleted: false });
    }
    console.error("[board-save:delete] failed:", error);
    return res.status(500).json({ ok: false, error: "delete failed" });
  }
});
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
  return until - now;
}

function pruneLobbyInvites(){
  const now = Date.now();
  for(const [id, inv] of lobbyInvites){
    if(!inv || (Number(inv.expiresAt)||0) <= now) lobbyInvites.delete(id);
  }
}

function pruneLoginLocks(){
  const now = Date.now();
  for(const [uid, lock] of loginLocks.entries()){
    const sockets = (lock && lock.sockets) ? lock.sockets.size : 0;
    const last = Number(lock?.lastSeen||0) || 0;
    if(sockets<=0 && (now - last) > LOGIN_LOCK_GRACE_MS){
      loginLocks.delete(uid);
    }
  }
}
setInterval(pruneLoginLocks, 15000).unref?.();


async function getProfileBySecret(secret){
  if(!secret) return null;
  const r = await pool.query(
    "SELECT user_id, name, avatar, stats FROM player_profiles WHERE secret=$1",
    [secret]
  );
  return r.rows?.[0] || null;
}
function ensureSocial(client){
  if(!client || typeof client!=="object") return;
  if(!client.social || typeof client.social!=="object") client.social = {};
  if(!Array.isArray(client.social.friends)) client.social.friends = [];
  if(!Array.isArray(client.social.friend_in)) client.social.friend_in = [];   // incoming requests
  if(!Array.isArray(client.social.friend_out)) client.social.friend_out = []; // outgoing requests
}

ensurePlayerNameUniqueIndex();

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  maxHttpBufferSize: 30 * 1024 * 1024,
});

// room = { state, sockets: Map<sid,{playerId,secret,displayName,avatar}>, host, lobbyReady }
const rooms = new Map();
const boardRooms = new Map();

const MAX_ROOM_PLAYERS = 6;
const BOARD_HOST_RECONNECT_GRACE_MS = 8000;
const BOARD_CAMPAIGN_RECONNECT_GRACE_MS = 30000;

function sanitizeBoardRoomCode(value){
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 12);
}

function makeBoardRoomCode(){
  for(let i = 0; i < 24; i += 1){
    const code = `B${Math.floor(1000 + Math.random() * 9000)}`;
    if(!boardRooms.has(code)) return code;
  }
  return `B${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function normalizeBoardProfile(profile = {}){
  const userId = Number(profile.userId) || Math.floor(100000 + Math.random() * 900000);
  const clientId = String(profile.clientId || `board-${userId}`).trim() || `board-${userId}`;
  const name = String(profile.name || `玩家${String(userId).slice(-4)}`).trim() || `玩家${String(userId).slice(-4)}`;
  return {
    userId,
    clientId,
    name,
    avatar: Math.max(1, Math.min(2000, Number(profile.avatar) || 1)),
    title: String(profile.title || "航海士").trim() || "航海士",
  };
}

function createBoardRoom(roomCode, profile){
  const host = normalizeBoardProfile(profile);
  const code = sanitizeBoardRoomCode(roomCode) || makeBoardRoomCode();
  const room = {
    roomCode: code,
    roomId: code,
    roomName: `${host.name} 的航海房`,
    hostUserId: host.userId,
    status: "waiting",
    maxPlayers: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players: [],
    chat: [
      { system: true, text: "本地連線房間已建立。同 WiFi 裝置可用房號加入。", ts: Date.now() },
    ],
    sockets: new Map(),
    gamePayload: null,
    gameVersion: 0,
    gameUpdatedAt: 0,
    hostTransferTimer: null,
  };
  room.players.push({ ...host, isHost: true, ready: false, online: true });
  boardRooms.set(code, room);
  return room;
}

function boardPlayerKey(player){
  return `${Number(player?.userId) || 0}:${String(player?.clientId || "")}`;
}

function upsertBoardPlayer(room, profile, socketId){
  const player = normalizeBoardProfile(profile);
  const key = boardPlayerKey(player);
  let existing = room.players.find((item) => boardPlayerKey(item) === key);
  if(!existing){
    existing = room.players.find((item) => Number(item.userId) === Number(player.userId));
  }
  if(!existing){
    if(room.players.length >= Number(room.maxPlayers || 4)) {
      return { ok:false, error:"full" };
    }
    existing = { ...player, isHost: false, ready: false, online: true };
    room.players.push(existing);
  }else{
    Object.assign(existing, player, { online: true });
  }
  if(!room.hostUserId || !room.players.some((item) => Number(item.userId) === Number(room.hostUserId))){
    room.hostUserId = existing.userId;
  }
  room.players.forEach((item) => {
    item.isHost = Number(item.userId) === Number(room.hostUserId);
  });
  room.sockets.set(socketId, { userId: existing.userId, clientId: existing.clientId });
  if(Number(existing.userId) === Number(room.hostUserId) && room.hostTransferTimer){
    clearTimeout(room.hostTransferTimer);
    room.hostTransferTimer = null;
  }
  room.updatedAt = Date.now();
  return { ok:true, player: existing };
}

function boardPlayerIsCpu(player){
  return !!player && (
    player.isCPU === true
    || player.isCpu === true
    || player.cpu === true
    || String(player.clientId || "").startsWith("board-cpu-")
  );
}

function boardCpuSlotNumber(player, fallbackOrdinal = 1){
  const userId = Number(player?.userId);
  if(Number.isInteger(userId) && userId <= -1001) return Math.max(1, Math.abs(userId + 1000));
  const clientMatch = String(player?.clientId || "").match(/-(\d+)$/);
  if(clientMatch) return Math.max(1, Number(clientMatch[1]) || 1);
  return Math.max(1, Number(fallbackOrdinal) || 1);
}

function boardCpuDisplayName(player, fallbackOrdinal = 1){
  return `CPU${boardCpuSlotNumber(player, fallbackOrdinal)}`;
}

function nextBoardCpuSlot(room){
  const usedIds = new Set((room?.players || []).map((player) => Number(player.userId)));
  for(let slot = 1; slot <= Math.max(1, Number(room?.maxPlayers || 4)); slot += 1){
    const userId = -1000 - slot;
    if(!usedIds.has(userId)) return slot;
  }
  return Math.max(1, (room?.players || []).length + 1);
}

function createBoardCpuPlayer(room){
  const slot = nextBoardCpuSlot(room);
  const avatars = [12, 18, 24];
  return {
    userId: -1000 - slot,
    clientId: `board-cpu-${room.roomCode}-${slot}`,
    name: `CPU${slot}`,
    avatar: avatars[(slot - 1) % avatars.length],
    title: "CPU 航海士",
    isHost: false,
    ready: true,
    online: true,
    isCPU: true,
  };
}

function boardCampaignLocationSummary(player = {}){
  const location = player?.location && typeof player.location === "object" ? player.location : {};
  if(location.kind === "island") return { ...boardCampaignClone(location), label: String(location.islandId || "島嶼") };
  if(location.kind === "sea") return { ...boardCampaignClone(location), label: String(location.tileId || location.routeId || "海上") };
  return { ...boardCampaignClone(location), label: "位置已保存" };
}

function boardCampaignCrewSummary(player = {}){
  return (Array.isArray(player?.crew) ? player.crew : []).slice(0, 6).map((card) => ({
    id: String(card?.id || card?.cardId || card?.instanceId || ""),
    instanceId: String(card?.instanceId || ""),
    name: String(card?.name || "未知角色"),
    level: Math.max(1, Number(card?.level || 1)),
    image: String(card?.image || card?.imagePath || card?.portrait || ""),
  }));
}

function boardCampaignSharedStateFromPayload(payload = {}){
  const game = payload?.gameState || {};
  const world = game?.postgameWorld || {};
  return {
    postgameUnlocked: world.unlocked === true,
    finalIslandUnlocked: game.finalIslandUnlocked === true,
    researchLabsActive: world.researchLabsActive === true,
    eggheadUnlocked: world.eggheadUnlocked === true,
    finalEndingCleared: game.finalEndingCleared === true,
  };
}

function mergeBoardCampaignSharedState(previous = {}, incoming = {}){
  const merged = { ...previous };
  ["postgameUnlocked", "finalIslandUnlocked", "researchLabsActive", "eggheadUnlocked", "finalEndingCleared"].forEach((key) => {
    merged[key] = previous?.[key] === true || incoming?.[key] === true;
  });
  return merged;
}

function applyBoardCampaignSharedState(payload, shared = {}){
  const clone = boardCampaignClone(payload);
  const game = clone?.gameState;
  if(!game) return clone;
  if(shared.finalIslandUnlocked) game.finalIslandUnlocked = true;
  if(shared.finalEndingCleared) game.finalEndingCleared = true;
  if(shared.postgameUnlocked || shared.researchLabsActive || shared.eggheadUnlocked){
    if(!game.postgameWorld || typeof game.postgameWorld !== "object") game.postgameWorld = {};
    if(shared.postgameUnlocked) game.postgameWorld.unlocked = true;
    if(shared.researchLabsActive) game.postgameWorld.researchLabsActive = true;
    if(shared.eggheadUnlocked) game.postgameWorld.eggheadUnlocked = true;
  }
  return clone;
}

function boardCampaignHumanPlayers(payload = {}){
  const players = Array.isArray(payload?.gameState?.players) ? payload.gameState.players : [];
  return players.filter((player) => {
    const userId = Number(player?.userId ?? player?.id);
    return Number.isFinite(userId) && userId > 0;
  });
}

function boardCampaignRecordSummary(record = {}){
  const player = record?.player || {};
  return {
    revision: Math.max(0, Number(record?.revision || 0)),
    savedAt: String(record?.savedAt || ""),
    playerName: String(player?.name || "玩家"),
    location: boardCampaignLocationSummary(player),
    crew: boardCampaignCrewSummary(player),
    coins: Math.max(0, Number(player?.coins || 0)),
    bounty: Math.max(0, Number(player?.bounty || 0)),
  };
}

function boardCampaignBasePayload(campaign, memberKey = ""){
  const key = String(memberKey || "");
  return campaign?.branchRecords?.[key]?.payload
    || campaign?.basePayload
    || Object.values(campaign?.branchRecords || {}).find((record) => isValidBoardSavePayload(record?.payload))?.payload
    || null;
}

function boardCampaignProgressId(room, payload = {}){
  if(room?.campaignId) return sanitizeBoardCampaignId(room.campaignId);
  if(payload?.campaignContext?.campaignId) return sanitizeBoardCampaignId(payload.campaignContext.campaignId);
  if(room?.roomCode && room?.createdAt){
    return sanitizeBoardCampaignId(`${room.roomCode}-${Number(room.createdAt).toString(36)}`);
  }
  return sanitizeBoardCampaignId(payload?.roomCode || room?.roomCode || "");
}

function boardCampaignFindMember(campaign, identity = {}){
  const key = boardCampaignMemberKey(identity);
  return (campaign?.members || []).find((member) => member.key === key)
    || (campaign?.members || []).find((member) => Number(member.userId) > 0 && Number(member.userId) === Number(identity?.userId))
    || null;
}

function boardCampaignActiveGatherRoom(campaignId){
  const id = sanitizeBoardCampaignId(campaignId);
  return Array.from(boardRooms.values()).find((room) => (
    room?.campaignId === id
    && room?.campaignMode === "gather"
    && room?.status === "waiting"
  )) || null;
}

function serializeBoardCampaign(campaign, identity = {}){
  const member = boardCampaignFindMember(campaign, identity);
  if(!member) return null;
  const activeGather = boardCampaignActiveGatherRoom(campaign.campaignId);
  const branch = campaign?.branchRecords?.[member.key] || null;
  return {
    campaignId: campaign.campaignId,
    roomName: campaign.roomName || "共有航海紀錄",
    schemaVersion: Number(campaign.schemaVersion || BOARD_CAMPAIGN_SCHEMA_VERSION),
    createdAt: Number(campaign.createdAt || 0),
    updatedAt: Number(campaign.updatedAt || 0),
    shared: boardCampaignClone(campaign.shared || {}),
    memberKey: member.key,
    seatIndex: Number(member.seatIndex || 0),
    branch: branch ? {
      revision: Number(branch.revision || 0),
      savedAt: String(branch.savedAt || ""),
      hasBattle: Boolean(branch.payload?.battleState),
      round: Math.max(1, Number(branch.payload?.gameState?.round || 1)),
      turnStep: String(branch.payload?.gameState?.turnStep || branch.payload?.gameState?.phase || ""),
    } : null,
    members: (campaign.members || []).map((entry) => ({
      key: entry.key,
      userId: Number(entry.userId || 0),
      name: String(entry.name || "玩家"),
      avatar: Number(entry.avatar || 1),
      title: String(entry.title || "航海士"),
      seatIndex: Number(entry.seatIndex || 0),
      latest: boardCampaignRecordSummary(campaign.memberRecords?.[entry.key]),
    })),
    activeGatherRoom: activeGather ? {
      roomCode: activeGather.roomCode,
      hostName: activeGather.players.find((player) => Number(player.userId) === Number(activeGather.hostUserId))?.name || "房主",
      joinedHumans: activeGather.players.filter((player) => !boardPlayerIsCpu(player)).length,
    } : null,
  };
}

async function boardCampaignsForIdentity(identity = {}){
  const campaigns = await listBoardCampaigns();
  return campaigns
    .map((campaign) => serializeBoardCampaign(campaign, identity))
    .filter(Boolean)
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0));
}

function boardCampaignRoomPlayer(member, profile, campaignId, isActiveHuman){
  const activeProfile = isActiveHuman ? normalizeBoardProfile(profile) : null;
  const userId = Number(member.userId || activeProfile?.userId || 0);
  return {
    userId,
    clientId: isActiveHuman
      ? activeProfile.clientId
      : `board-proxy-${sanitizeBoardCampaignId(campaignId)}-${userId}`,
    name: isActiveHuman ? activeProfile.name : member.name,
    avatar: isActiveHuman ? activeProfile.avatar : member.avatar,
    title: isActiveHuman ? activeProfile.title : member.title,
    isHost: false,
    ready: !isActiveHuman,
    online: true,
    isCPU: !isActiveHuman,
    isProxyCPU: !isActiveHuman,
    proxyOwnerUserId: !isActiveHuman ? userId : 0,
    campaignMemberKey: member.key,
  };
}

function createBoardCampaignRoom(campaign, profile, mode = "gather"){
  const opener = boardCampaignFindMember(campaign, profile);
  if(!opener) return { ok:false, error:"not_campaign_member" };
  const roomCode = makeBoardRoomCode();
  const normalizedProfile = normalizeBoardProfile(profile);
  const basePayload = boardCampaignBasePayload(campaign, opener.key);
  if(!isValidBoardSavePayload(basePayload)) return { ok:false, error:"campaign_missing_save" };
  const basePlayers = Array.isArray(basePayload.gameState?.players) ? basePayload.gameState.players : [];
  const playersBySeat = [];
  (campaign.members || []).forEach((member) => {
    playersBySeat[Number(member.seatIndex || 0)] = boardCampaignRoomPlayer(
      member,
      normalizedProfile,
      campaign.campaignId,
      member.key === opener.key
    );
  });
  basePlayers.forEach((player, index) => {
    const userId = Number(player?.userId ?? player?.id);
    if(userId > 0 || playersBySeat[index]) return;
    playersBySeat[index] = {
      userId,
      clientId: String(player?.clientId || `board-cpu-${roomCode}-${index + 1}`),
      name: String(player?.name || `CPU${index + 1}`),
      avatar: Number(player?.avatar || 1),
      title: String(player?.title || "CPU 航海士"),
      isHost: false,
      ready: true,
      online: true,
      isCPU: true,
      isOriginalCPU: true,
    };
  });
  const players = playersBySeat.filter(Boolean).slice(0, 4);
  const room = {
    roomCode,
    roomId: roomCode,
    roomName: campaign.roomName || "共有航海紀錄",
    hostUserId: normalizedProfile.userId,
    status: mode === "solo" ? "playing" : "waiting",
    maxPlayers: 4,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    players,
    chat: [
      { system:true, text: mode === "solo" ? "已從共有航海紀錄開啟個別分支。" : "集合等待室已開啟；所有真人準備後才會開始。", ts:Date.now() },
    ],
    sockets: new Map(),
    gamePayload: null,
    gameVersion: 0,
    gameUpdatedAt: 0,
    hostTransferTimer: null,
    campaignId: campaign.campaignId,
    campaignMode: mode === "solo" ? "solo" : "gather",
    campaignBaseMemberKey: opener.key,
    campaignStartedHumanUserIds: mode === "solo" ? [normalizedProfile.userId] : [],
  };
  room.players.forEach((player) => {
    player.isHost = Number(player.userId) === Number(room.hostUserId);
  });
  boardRooms.set(roomCode, room);
  return { ok:true, room, opener };
}

function joinBoardCampaignRoom(room, profile, socketId){
  if(!room?.campaignId || room.status !== "waiting") return { ok:false, error:"not_waiting" };
  const normalized = normalizeBoardProfile(profile);
  const player = room.players.find((entry) => Number(entry.userId) === Number(normalized.userId));
  if(!player) return { ok:false, error:"not_campaign_member" };
  const alreadyConnected = Array.from(room.sockets.entries()).some(([activeSocketId, meta]) => (
    activeSocketId !== socketId
    && Number(meta?.userId) === Number(normalized.userId)
  ));
  if(alreadyConnected) return { ok:false, error:"campaign_already_connected" };
  clearBoardCampaignDisconnectTimer(room, normalized.userId);
  if(!player.isProxyCPU && !boardPlayerIsCpu(player)){
    Object.assign(player, normalized, { online:true });
    room.sockets.set(socketId, { userId:player.userId, clientId:player.clientId });
    room.updatedAt = Date.now();
    return { ok:true, player, reconnected:true };
  }
  if(!player.isProxyCPU) return { ok:false, error:"not_campaign_member" };
  Object.assign(player, normalized, {
    isCPU:false,
    isProxyCPU:false,
    proxyOwnerUserId:0,
    ready:false,
    online:true,
  });
  room.sockets.set(socketId, { userId:player.userId, clientId:player.clientId });
  room.updatedAt = Date.now();
  return { ok:true, player };
}

function boardCampaignGatherPayloadIsStable(payload){
  const game = payload?.gameState || {};
  return !payload?.battleState
    && !game.pendingMove
    && !game.routePrompt
    && !game.tradePrompt
    && !game.coopBattlePrompt
    && !game.activeTrade
    && !game.activeSpar
    && !game.islandDecision
    && !game.movementAnimating
    && !game.diceRolling
    && !game.resolutionLock
    && !game.battleExitLock;
}

function assembleBoardCampaignPayload(campaign, room){
  const base = boardCampaignBasePayload(campaign, room.campaignBaseMemberKey);
  if(!isValidBoardSavePayload(base)) return null;
  let payload = applyBoardCampaignSharedState(base, campaign.shared || {});
  const game = payload.gameState;
  const players = Array.isArray(game.players) ? game.players : [];
  (campaign.members || []).forEach((member) => {
    const recordPlayer = campaign.memberRecords?.[member.key]?.player;
    if(!recordPlayer) return;
    const lobbyPlayer = room.players.find((entry) => Number(entry.userId) === Number(member.userId));
    const proxy = !lobbyPlayer || boardPlayerIsCpu(lobbyPlayer);
    const nextPlayer = boardCampaignClone(recordPlayer);
    nextPlayer.id = String(member.userId);
    nextPlayer.userId = Number(member.userId);
    nextPlayer.clientId = String(lobbyPlayer?.clientId || `board-proxy-${campaign.campaignId}-${member.userId}`);
    nextPlayer.name = String(member.name || nextPlayer.name || "玩家");
    nextPlayer.avatar = Number(member.avatar || nextPlayer.avatar || 1);
    nextPlayer.title = String(member.title || nextPlayer.title || "航海士");
    nextPlayer.isCPU = proxy;
    nextPlayer.isCpu = false;
    nextPlayer.cpu = false;
    nextPlayer.isProxyCPU = proxy;
    nextPlayer.proxyOwnerUserId = proxy ? Number(member.userId) : 0;
    nextPlayer.isHost = Number(member.userId) === Number(room.hostUserId);
    nextPlayer.isMe = false;
    players[Number(member.seatIndex || 0)] = nextPlayer;
  });
  game.players = players.filter(Boolean).slice(0, 4);
  game.currentPlayerIndex = Math.max(0, Math.min(game.players.length - 1, Number(game.currentPlayerIndex || 0)));
  if(room.campaignMode === "gather"){
    payload.battleState = null;
    payload.boardUiEvent = null;
    game.pendingMove = null;
    game.routePrompt = null;
    game.tradePrompt = null;
    game.coopBattlePrompt = null;
    game.activeTrade = null;
    game.activeSpar = null;
    game.islandDecision = null;
    game.movementAnimating = false;
    game.diceRolling = false;
    game.resolutionLock = false;
    game.battleExitLock = false;
  }
  payload.roomCode = room.roomCode;
  payload.savedAt = new Date().toISOString();
  payload.campaignContext = {
    schemaVersion: BOARD_CAMPAIGN_SCHEMA_VERSION,
    campaignId: campaign.campaignId,
    mode: room.campaignMode,
    baseMemberKey: room.campaignBaseMemberKey,
    startedHumanUserIds: room.players.filter((player) => !boardPlayerIsCpu(player)).map((player) => Number(player.userId)),
  };
  return payload;
}

async function saveBoardCampaignProgressUnlocked(room, identity, payload){
  if(!isValidBoardSavePayload(payload)) return { ok:false, error:"invalid_payload" };
  const callerKey = boardCampaignMemberKey(identity);
  const humanPlayers = boardCampaignHumanPlayers(payload);
  const callerPlayer = humanPlayers.find((player) => boardCampaignMemberKey(player) === callerKey)
    || humanPlayers.find((player) => Number(player.userId || player.id) === Number(identity?.userId));
  if(!callerPlayer) return { ok:false, error:"player_not_found" };
  const campaignId = boardCampaignProgressId(room, payload);
  if(!campaignId) return { ok:false, error:"invalid_campaign_id" };
  let campaign = null;
  try{
    campaign = await readBoardCampaign(campaignId);
  }catch(error){
    if(error?.code !== "ENOENT") throw error;
  }
  const nowIso = new Date().toISOString();
  if(!campaign){
    const members = humanPlayers.map((player, seatIndex) => ({
      key: boardCampaignMemberKey(player),
      userId: Number(player.userId || player.id),
      clientId: String(player.clientId || ""),
      name: String(player.name || `玩家${seatIndex + 1}`),
      avatar: Number(player.avatar || 1),
      title: String(player.title || "航海士"),
      seatIndex: Math.max(0, (payload.gameState.players || []).indexOf(player)),
      joinedAt: Date.now(),
    })).filter((member) => member.key);
    const memberRecords = {};
    const branchRecords = {};
    members.forEach((member) => {
      const player = humanPlayers.find((entry) => boardCampaignMemberKey(entry) === member.key);
      memberRecords[member.key] = { revision:1, savedAt:nowIso, player:boardCampaignClone(player) };
      branchRecords[member.key] = { revision:1, savedAt:nowIso, payload:boardCampaignClone(payload) };
    });
    campaign = {
      schemaVersion: BOARD_CAMPAIGN_SCHEMA_VERSION,
      campaignId,
      roomName: String(room?.roomName || payload?.campaignContext?.roomName || "共有航海紀錄"),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      shared: boardCampaignSharedStateFromPayload(payload),
      members,
      memberRecords,
      branchRecords,
      basePayload: boardCampaignClone(payload),
    };
  }else{
    const member = boardCampaignFindMember(campaign, identity);
    if(!member) return { ok:false, error:"not_campaign_member" };
    member.clientId = String(identity?.clientId || member.clientId || "");
    member.name = String(identity?.name || callerPlayer.name || member.name || "玩家");
    member.avatar = Number(identity?.avatar || callerPlayer.avatar || member.avatar || 1);
    member.title = String(identity?.title || callerPlayer.title || member.title || "航海士");
    const previousRevision = Number(campaign.memberRecords?.[member.key]?.revision || 0);
    campaign.memberRecords[member.key] = {
      revision: previousRevision + 1,
      savedAt: nowIso,
      player: boardCampaignClone(callerPlayer),
    };
    const previousBranchRevision = Number(campaign.branchRecords?.[member.key]?.revision || 0);
    campaign.branchRecords[member.key] = {
      revision: previousBranchRevision + 1,
      savedAt: nowIso,
      payload: boardCampaignClone(payload),
    };
    campaign.shared = mergeBoardCampaignSharedState(campaign.shared, boardCampaignSharedStateFromPayload(payload));
  }
  campaign = await writeBoardCampaign(campaign);
  return {
    ok:true,
    campaignId:campaign.campaignId,
    campaign:serializeBoardCampaign(campaign, identity),
  };
}

async function saveBoardCampaignProgress(room, identity, payload){
  const campaignId = boardCampaignProgressId(room, payload);
  if(!campaignId) return { ok:false, error:"invalid_campaign_id" };
  return withBoardCampaignWriteLock(campaignId, () => saveBoardCampaignProgressUnlocked(room, identity, payload));
}

function serializeBoardLobby(room){
  let cpuOrdinal = 0;
  return {
    roomId: room.roomCode,
    roomCode: room.roomCode,
    roomName: room.roomName,
    hostName: room.players.find((item) => Number(item.userId) === Number(room.hostUserId))?.name || "房主",
    hostUserId: room.hostUserId,
    status: room.status,
    maxPlayers: room.maxPlayers,
    campaignId: room.campaignId || "",
    campaignMode: room.campaignMode || "",
    campaignBaseMemberKey: room.campaignBaseMemberKey || "",
    players: room.players.map((item) => {
      const isCPU = boardPlayerIsCpu(item);
      if(isCPU) cpuOrdinal += 1;
      return {
        userId: item.userId,
        clientId: item.clientId,
        name: isCPU ? boardCpuDisplayName(item, cpuOrdinal) : item.name,
        avatar: item.avatar,
        title: item.title,
        isHost: Number(item.userId) === Number(room.hostUserId),
        ready: !!item.ready,
        online: !!item.online,
        isCPU,
        isProxyCPU: item.isProxyCPU === true,
        isOriginalCPU: item.isOriginalCPU === true,
        proxyOwnerUserId: Number(item.proxyOwnerUserId || 0),
        campaignMemberKey: String(item.campaignMemberKey || ""),
      };
    }),
    chat: room.chat.slice(-80),
  };
}

function currentBoardTurnActorFromPayload(payload){
  const game = payload?.gameState;
  if (!game || game.phase !== "main") return null;
  const players = Array.isArray(game.players) ? game.players : [];
  if (!players.length) return null;
  const index = Math.max(0, Math.min(players.length - 1, Number(game.currentPlayerIndex) || 0));
  return players[index] || null;
}

function boardGameFromPayload(payload){
  return payload?.gameState && typeof payload.gameState === "object" ? payload.gameState : null;
}

function boardGamePhaseRank(payload){
  const phase = String(boardGameFromPayload(payload)?.phase || "");
  if (phase === "setup-order") return 0;
  if (phase === "setup-draft") return 1;
  if (phase === "main") return 2;
  return -1;
}

function boardPlayerFromPayload(payload, playerId){
  const players = Array.isArray(boardGameFromPayload(payload)?.players) ? boardGameFromPayload(payload).players : [];
  return players.find((item) => String(item?.id) === String(playerId)) || null;
}

function boardBattleActorFromPayload(payload){
  const battle = payload?.battleState;
  if (!battle || typeof battle !== "object") return null;
  return boardPlayerFromPayload(payload, battle.playerId);
}

function boardSparParticipantIds(spar){
  return Array.isArray(spar?.participantIds)
    ? [...new Set(spar.participantIds.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 2)
    : [];
}

function boardSparFromPayload(payload){
  const spar = boardGameFromPayload(payload)?.activeSpar;
  return spar && typeof spar === "object" ? spar : null;
}

function boardBattleSparParticipantIds(payload){
  const battle = payload?.battleState;
  if (!battle?.isSparBattle || !Array.isArray(battle.participantOrder)) return [];
  return [...new Set(battle.participantOrder.map((id) => String(id || "").trim()).filter(Boolean))].slice(0, 2);
}

function boardJsonKey(value){
  try{
    return JSON.stringify(value ?? null);
  }catch{
    return "";
  }
}

function boardGameWithoutSettings(game){
  if (!game || typeof game !== "object") return null;
  try{
    const clone = JSON.parse(JSON.stringify(game));
    if (clone && typeof clone === "object") delete clone.settings;
    return clone;
  }catch{
    return null;
  }
}

function boardSettingsOnlyChange(previousPayload, nextPayload){
  const previousGame = boardGameFromPayload(previousPayload);
  const nextGame = boardGameFromPayload(nextPayload);
  if (!previousGame || !nextGame) return false;
  return boardJsonKey(boardGameWithoutSettings(previousGame)) === boardJsonKey(boardGameWithoutSettings(nextGame))
    && boardJsonKey(previousPayload?.battleState || null) === boardJsonKey(nextPayload?.battleState || null);
}

function boardPayloadWithPreservedSettings(room, socket, payload, reason = ""){
  if (!payload?.gameState || String(reason || "").startsWith("settings-")) return payload;
  const socketMeta = room?.sockets?.get(socket.id) || socket.data.boardProfile || {};
  if (boardSocketIsRoomHost(room, socketMeta)) return payload;
  const previousSettings = room?.gamePayload?.gameState?.settings;
  if (!previousSettings || typeof previousSettings !== "object") return payload;
  try{
    const clone = JSON.parse(JSON.stringify(payload));
    clone.gameState.settings = JSON.parse(JSON.stringify(previousSettings));
    return clone;
  }catch{
    payload.gameState.settings = previousSettings;
    return payload;
  }
}

function boardLocationKey(player){
  const location = player?.location || {};
  return [
    location.kind || "",
    location.routeId || "",
    Number(location.tileIndex ?? -1),
    location.islandId || "",
  ].join("|");
}

function boardPlayersStayOnSameTiles(previousPayload, nextPayload){
  const previousPlayers = Array.isArray(boardGameFromPayload(previousPayload)?.players) ? boardGameFromPayload(previousPayload).players : [];
  return previousPlayers.every((player) => {
    const nextPlayer = boardPlayerFromPayload(nextPayload, player?.id);
    return nextPlayer && boardLocationKey(player) === boardLocationKey(nextPlayer);
  });
}

function boardTradeParticipants(trade){
  return [trade?.initiatorId, trade?.partnerId]
    .map((id) => String(id || "").trim())
    .filter(Boolean);
}

function boardActiveTradeFromPayload(payload){
  const trade = boardGameFromPayload(payload)?.activeTrade;
  return trade && typeof trade === "object" ? trade : null;
}

function boardTradeIncludesCpu(payload, trade){
  return boardTradeParticipants(trade).some((playerId) => {
    const player = boardPlayerFromPayload(payload, playerId);
    return boardPlayerIsCpu(player);
  });
}

function boardTradeSamePair(previousTrade, nextTrade){
  if (!previousTrade || !nextTrade) return false;
  const previousIds = boardTradeParticipants(previousTrade).sort().join("|");
  const nextIds = boardTradeParticipants(nextTrade).sort().join("|");
  return Boolean(previousTrade.id && nextTrade.id)
    && String(previousTrade.id) === String(nextTrade.id)
    && previousIds === nextIds;
}

function boardSocketIsRoomHost(room, socketMeta = {}){
  return !!room
    && Number(room.hostUserId) === Number(socketMeta.userId)
    && Number(socketMeta.userId) !== 0;
}

function boardSocketCanDriveActor(actor, room, socketMeta = {}, sourceClientId = ""){
  if (boardPlayerIsCpu(actor) && boardSocketIsRoomHost(room, socketMeta)) return true;
  return boardActorMatchesSocket(actor, socketMeta, sourceClientId);
}

function boardSocketControlsTradeParticipant(payload, trade, socketMeta = {}, sourceClientId = "", room = null){
  return boardTradeParticipants(trade).some((playerId) => {
    const player = boardPlayerFromPayload(payload, playerId);
    return player && boardSocketCanDriveActor(player, room, socketMeta, sourceClientId);
  });
}

function boardTradeFlowUnchanged(previousPayload, nextPayload){
  const previousGame = boardGameFromPayload(previousPayload);
  const nextGame = boardGameFromPayload(nextPayload);
  if (!previousGame || !nextGame) return false;
  if (String(previousGame.phase || "") !== String(nextGame.phase || "")) return false;
  if (Number(previousGame.currentPlayerIndex || 0) !== Number(nextGame.currentPlayerIndex || 0)) return false;
  if (Number(previousGame.round || 0) !== Number(nextGame.round || 0)) return false;
  if (boardJsonKey(previousPayload?.battleState || null) !== boardJsonKey(nextPayload?.battleState || null)) return false;
  if (boardJsonKey(previousGame.pendingMove || null) !== boardJsonKey(nextGame.pendingMove || null)) return false;
  return boardPlayersStayOnSameTiles(previousPayload, nextPayload);
}

function canAcceptBoardTradeStateUpdate(previousPayload, nextPayload, socket, sourceClientId = ""){
  const previousTrade = boardActiveTradeFromPayload(previousPayload);
  if (!previousTrade) return false;
  const nextTrade = boardActiveTradeFromPayload(nextPayload);
  if (nextTrade && boardTradeIncludesCpu(nextPayload, nextTrade)) return false;
  if (nextTrade && !boardTradeSamePair(previousTrade, nextTrade)) return false;
  if (!boardTradeFlowUnchanged(previousPayload, nextPayload)) return false;
  const roomCode = sanitizeBoardRoomCode(socket.data.boardRoomCode || nextPayload?.roomCode || previousPayload?.roomCode || "");
  const room = boardRooms.get(roomCode);
  const socketMeta = room?.sockets?.get(socket.id) || socket.data.boardProfile || {};
  return boardSocketControlsTradeParticipant(previousPayload, previousTrade, socketMeta, sourceClientId, room);
}

function canAcceptBoardBattleStateUpdate(previousPayload, nextPayload, socket, sourceClientId = ""){
  const roomCode = sanitizeBoardRoomCode(socket.data.boardRoomCode || nextPayload?.roomCode || previousPayload?.roomCode || "");
  const room = boardRooms.get(roomCode);
  const socketMeta = room?.sockets?.get(socket.id) || socket.data.boardProfile || {};
  const sparIds = boardBattleSparParticipantIds(nextPayload).length
    ? boardBattleSparParticipantIds(nextPayload)
    : boardBattleSparParticipantIds(previousPayload);
  if (sparIds.length === 2) {
    return sparIds.some((playerId) => {
      const player = boardPlayerFromPayload(nextPayload, playerId) || boardPlayerFromPayload(previousPayload, playerId);
      return player && !boardPlayerIsCpu(player) && boardSocketCanDriveActor(player, room, socketMeta, sourceClientId);
    });
  }
  const nextActor = boardBattleActorFromPayload(nextPayload);
  if (nextActor && boardSocketCanDriveActor(nextActor, room, socketMeta, sourceClientId)) return true;
  const previousActor = boardBattleActorFromPayload(previousPayload);
  if (previousActor && boardSocketCanDriveActor(previousActor, room, socketMeta, sourceClientId)) return true;
  return false;
}

function canAcceptBoardSparStateUpdate(previousPayload, nextPayload, socket, sourceClientId = ""){
  const previousSpar = boardSparFromPayload(previousPayload);
  const nextSpar = boardSparFromPayload(nextPayload);
  const ids = boardSparParticipantIds(nextSpar).length ? boardSparParticipantIds(nextSpar) : boardSparParticipantIds(previousSpar);
  if (ids.length !== 2) return false;
  const previousIds = boardSparParticipantIds(previousSpar).sort().join("|");
  const nextIds = boardSparParticipantIds(nextSpar).sort().join("|");
  if (previousSpar && nextSpar && previousIds !== nextIds) return false;
  const previousGame = boardGameFromPayload(previousPayload);
  const nextGame = boardGameFromPayload(nextPayload);
  if (!previousGame || !nextGame) return false;
  if (String(previousGame.phase || "") !== String(nextGame.phase || "")) return false;
  if (Number(previousGame.currentPlayerIndex || 0) !== Number(nextGame.currentPlayerIndex || 0)) return false;
  if (Number(previousGame.round || 0) !== Number(nextGame.round || 0)) return false;
  if (!boardPlayersStayOnSameTiles(previousPayload, nextPayload)) return false;
  const roomCode = sanitizeBoardRoomCode(socket.data.boardRoomCode || nextPayload?.roomCode || previousPayload?.roomCode || "");
  const room = boardRooms.get(roomCode);
  const socketMeta = room?.sockets?.get(socket.id) || socket.data.boardProfile || {};
  return ids.some((playerId) => {
    const player = boardPlayerFromPayload(nextPayload, playerId) || boardPlayerFromPayload(previousPayload, playerId);
    return player && !boardPlayerIsCpu(player) && boardSocketCanDriveActor(player, room, socketMeta, sourceClientId);
  });
}

function boardActorMatchesSocket(actor, socketMeta = {}, sourceClientId = ""){
  if (!actor) return true;
  const actorClientId = String(actor.clientId || "").trim();
  const socketClientId = String(socketMeta.clientId || sourceClientId || "").trim();
  const fallbackClientId = String(actor.userId || actor.id || "").trim();
  const actorClientIdIsSynthetic = actorClientId === fallbackClientId || actorClientId.startsWith("board-player-");
  if (actorClientId && socketClientId && actorClientId === socketClientId) return true;
  if (actorClientId && socketClientId && !actorClientIdIsSynthetic) return false;
  const actorUserId = Number(actor.userId || actor.id);
  const socketUserId = Number(socketMeta.userId);
  if (Number.isFinite(actorUserId) && actorUserId > 0 && Number.isFinite(socketUserId) && socketUserId > 0) {
    return actorUserId === socketUserId;
  }
  return true;
}

function canAcceptBoardGameStateUpdate(room, socket, sourceClientId = "", nextPayload = null, reason = ""){
  const previousPayload = room?.gamePayload;
  if (!previousPayload) {
    const socketMeta = room?.sockets?.get(socket.id) || socket.data.boardProfile || {};
    return boardSocketIsRoomHost(room, socketMeta);
  }
  const normalizedReason = String(reason || "");
  if (normalizedReason !== "load-save" && boardGamePhaseRank(nextPayload) < boardGamePhaseRank(previousPayload)) {
    return false;
  }
  if (normalizedReason === "join") return false;
  if (normalizedReason === "lobby-players") {
    const previousPhase = String(previousPayload?.gameState?.phase || "");
    const nextPhase = String(nextPayload?.gameState?.phase || "");
    if (previousPhase && previousPhase !== "setup-order" && nextPhase === "setup-order") return false;
  }
  const nextTrade = boardActiveTradeFromPayload(nextPayload);
  if (nextTrade && boardTradeIncludesCpu(nextPayload, nextTrade)) return false;
  const socketMeta = room.sockets.get(socket.id) || socket.data.boardProfile || {};
  if (normalizedReason.startsWith("settings-")) {
    return boardSocketIsRoomHost(room, socketMeta) && boardSettingsOnlyChange(previousPayload, nextPayload);
  }
  if (normalizedReason === "load-save" && boardSocketIsRoomHost(room, socketMeta)) {
    return true;
  }
  const actor = currentBoardTurnActorFromPayload(previousPayload);
  if (!actor) return true;
  if (boardSocketCanDriveActor(actor, room, socketMeta, sourceClientId)) return true;
  if (normalizedReason.startsWith("battle-") || nextPayload?.battleState || previousPayload?.battleState) {
    return canAcceptBoardBattleStateUpdate(previousPayload, nextPayload, socket, sourceClientId);
  }
  if (normalizedReason.startsWith("spar-")) {
    return canAcceptBoardSparStateUpdate(previousPayload, nextPayload, socket, sourceClientId);
  }
  if (normalizedReason.startsWith("trade-")) {
    return canAcceptBoardTradeStateUpdate(previousPayload, nextPayload, socket, sourceClientId);
  }
  return false;
}

function serializeBoardRoomList(){
  return Array.from(boardRooms.values())
    .filter((room) => room && room.status !== "closed" && (!room.campaignId || room.campaignMode === "gather"))
    .sort((a, b) => Number(b.updatedAt || 0) - Number(a.updatedAt || 0))
    .slice(0, 24)
    .map((room) => ({
      roomId: room.roomCode,
      hostName: room.players.find((item) => Number(item.userId) === Number(room.hostUserId))?.name || "房主",
      total: room.players.length,
      maxPlayers: room.maxPlayers,
      status: room.players.length >= room.maxPlayers ? "full" : room.status,
      title: room.roomName,
      campaignId: room.campaignId || "",
      campaignMode: room.campaignMode || "",
    }));
}

function emitBoardRoomList(){
  io.emit("BOARD_ROOM_LIST", { rooms: serializeBoardRoomList() });
}

function emitBoardLobby(room){
  if(!room) return;
  io.to(`board:${room.roomCode}`).emit("BOARD_LOBBY", { lobby: serializeBoardLobby(room) });
  emitBoardRoomList();
}

function boardRoomPlayerOnline(room, player){
  if(!room || !player) return false;
  return Array.from(room.sockets.values()).some((meta) => Number(meta.userId) === Number(player.userId));
}

function clearBoardCampaignDisconnectTimer(room, userId){
  const timers = room?._campaignDisconnectTimers;
  const timer = timers?.get(Number(userId));
  if(timer) clearTimeout(timer);
  timers?.delete(Number(userId));
}

function scheduleBoardCampaignProxyTakeover(room, userId){
  if(!room?.campaignId) return;
  if(!room._campaignDisconnectTimers) room._campaignDisconnectTimers = new Map();
  clearBoardCampaignDisconnectTimer(room, userId);
  const timer = setTimeout(() => {
    const latest = boardRooms.get(room.roomCode);
    if(!latest || latest !== room) return;
    const player = latest.players.find((entry) => Number(entry.userId) === Number(userId));
    if(!player || boardRoomPlayerOnline(latest, player)) return;
    player.clientId = `board-proxy-${latest.campaignId}-${player.userId}`;
    player.isCPU = true;
    player.isProxyCPU = true;
    player.proxyOwnerUserId = Number(player.userId || 0);
    player.ready = true;
    player.online = true;
    latest.campaignStartedHumanUserIds = (latest.campaignStartedHumanUserIds || [])
      .filter((entry) => Number(entry) !== Number(player.userId));
    transferBoardHostToOnlinePlayer(latest);
    latest.updatedAt = Date.now();
    emitBoardLobby(latest);
    if(latest.sockets.size <= 0){
      clearBoardHostTransferTimer(latest);
      boardRooms.delete(latest.roomCode);
      emitBoardRoomList();
    }
  }, BOARD_CAMPAIGN_RECONNECT_GRACE_MS);
  room._campaignDisconnectTimers.set(Number(userId), timer);
}

function clearBoardHostTransferTimer(room){
  if(!room?.hostTransferTimer) return;
  clearTimeout(room.hostTransferTimer);
  room.hostTransferTimer = null;
}

function transferBoardHostToOnlinePlayer(room){
  if(!room) return false;
  const currentHost = room.players.find((player) => Number(player.userId) === Number(room.hostUserId));
  if(currentHost && boardRoomPlayerOnline(room, currentHost)){
    clearBoardHostTransferTimer(room);
    return false;
  }
  const nextHost = room.players.find((player) => !boardPlayerIsCpu(player) && boardRoomPlayerOnline(room, player))
    || room.players.find((player) => !boardPlayerIsCpu(player))
    || room.players[0];
  if(!nextHost) return false;
  const changed = Number(room.hostUserId) !== Number(nextHost.userId);
  room.hostUserId = nextHost.userId;
  room.players.forEach((player) => {
    player.isHost = Number(player.userId) === Number(room.hostUserId);
  });
  return changed;
}

function scheduleBoardHostTransfer(room){
  if(!room || room.hostTransferTimer) return;
  room.hostTransferTimer = setTimeout(() => {
    room.hostTransferTimer = null;
    const latestRoom = boardRooms.get(room.roomCode);
    if(!latestRoom || latestRoom !== room) return;
    const changed = transferBoardHostToOnlinePlayer(latestRoom);
    if(!changed) return;
    latestRoom.updatedAt = Date.now();
    emitBoardLobby(latestRoom);
    if(latestRoom.status === "playing" && !latestRoom.gamePayload){
      io.to(`board:${latestRoom.roomCode}`).emit("BOARD_STATE_REQUEST", {
        roomCode: latestRoom.roomCode,
        requesterClientId: "host-transfer",
      });
    }
  }, BOARD_HOST_RECONNECT_GRACE_MS);
}

function cleanupBoardRoom(roomCode){
  const code = sanitizeBoardRoomCode(roomCode);
  const room = boardRooms.get(code);
  if(!room) return;
  room.players.forEach((player) => {
    if(boardPlayerIsCpu(player)){
      player.online = true;
      return;
    }
    const online = Array.from(room.sockets.values()).some((meta) => Number(meta.userId) === Number(player.userId));
    player.online = online;
  });
  if(room.campaignId && room.sockets.size <= 0){
    clearBoardHostTransferTimer(room);
    boardRooms.delete(code);
    emitBoardRoomList();
    return;
  }
  if(room.sockets.size <= 0 && !room.gamePayload && room.status !== "playing"){
    clearBoardHostTransferTimer(room);
    boardRooms.delete(code);
    emitBoardRoomList();
    return;
  }
  const currentHost = room.players.find((player) => Number(player.userId) === Number(room.hostUserId));
  const currentHostOnline = currentHost && boardRoomPlayerOnline(room, currentHost);
  if(currentHostOnline){
    clearBoardHostTransferTimer(room);
  }else if(room.status === "playing" && currentHost){
    scheduleBoardHostTransfer(room);
  }else{
    clearBoardHostTransferTimer(room);
    transferBoardHostToOnlinePlayer(room);
  }
  room.players.forEach((player) => {
    player.isHost = Number(player.userId) === Number(room.hostUserId);
  });
  room.updatedAt = Date.now();
  emitBoardLobby(room);
}

// =========================
// Resilience: disconnect takeover + idle watchdog (multi-round match safe)
//  - If a human disconnects during playing, give a short grace period, then mark them as CPU.
//  - If a human is idle on their turn or during pending interaction, convert them to CPU (prevents soft-lock).
//  - If the human reconnects with same secret, they regain control immediately.
// =========================
const OFFLINE_GRACE_MS = 8000;      // 斷線保留時間：8 秒
const TURN_IDLE_MS     = 30000;     // 回合掛機：30 秒自動接管
const PENDING_IDLE_MS  = 30000;     // 互動流程掛機：30 秒自動接管
const IDLE_WARN_MS     = 10000;     // 接手前 10 秒先警告

function ensureRoomResilience(room){
  if(!room) return;
  if(!room._offlineTimers) room._offlineTimers = new Map(); // playerId -> timeout
  if(!room._turnTimer) room._turnTimer = null;
  if(!room._pendingTimer) room._pendingTimer = null;
  if(!room._turnWarnTimer) room._turnWarnTimer = null;
  if(!room._pendingWarnTimer) room._pendingWarnTimer = null;
}

function clearOfflineTimer(room, playerId){
  try{
    ensureRoomResilience(room);
    const t = room._offlineTimers.get(playerId);
    if(t) clearTimeout(t);
    room._offlineTimers.delete(playerId);
  }catch{}
}

function emitRoomToast(room, text){
  try{
    for(const [sid] of room.sockets){
      io.to(sid).emit("EMIT", { type:"toast", text: String(text||"") });
    }
  }catch{}
}

function emitToPlayer(room, playerId, event, payload){
  try{
    for(const [sid, meta] of room.sockets){
      if(Number(meta?.playerId) === Number(playerId)){
        io.to(sid).emit(event, payload);
      }
    }
  }catch{}
}

function setPlayerAutoControl(room, playerId, isAuto, reason = "idle"){
  try{
    const p = room?.state?.players?.[playerId];
    if(!p) return;

    p.isCPU = !!isAuto;

    if(!p.client || typeof p.client !== "object") p.client = {};
    p.client.autoControlled = !!isAuto;
    p.autoControlled = !!isAuto;

    emitToPlayer(room, playerId, "EMIT", {
      type: "auto_control_changed",
      isAuto: !!isAuto,
      reason: String(reason || "idle")
    });

    broadcastState(room);
  }catch(e){
    console.error("[setPlayerAutoControl] error:", e);
  }
}

function warnPlayerBeforeTakeover(room, playerId, remainMs){
  try{
    const sec = Math.max(1, Math.ceil(Number(remainMs || 0) / 1000));
    emitToPlayer(room, playerId, "EMIT", {
      type: "idle_warning",
      remainSec: sec
    });
  }catch{}
}

function pendingResponderId(st){
  const p = st?.pending;
  if(!p) return null;

  // victim-response style interactions
  if(p.action === "queen" || p.action === "bigmom-pay"){
    return (p.target != null) ? Number(p.target) : null;
  }

  // some pending include caster explicitly
  if(p.caster != null) return Number(p.caster);

  // default: assume current turn player
  return (st?.turnIndex != null) ? Number(st.turnIndex) : null;
}

function armRoomWatchdogs(roomId){
  const room = rooms.get(roomId);
  if(!room) return;
  ensureRoomResilience(room);

  // clear existing timers
try{ if(room._turnTimer) clearTimeout(room._turnTimer); }catch{}
try{ if(room._pendingTimer) clearTimeout(room._pendingTimer); }catch{}
try{ if(room._turnWarnTimer) clearTimeout(room._turnWarnTimer); }catch{}
try{ if(room._pendingWarnTimer) clearTimeout(room._pendingWarnTimer); }catch{}
room._turnTimer = null;
room._pendingTimer = null;
room._turnWarnTimer = null;
room._pendingWarnTimer = null;
  if(room.phase !== "playing") return;
  const st = room.state;
  if(!st || !Array.isArray(st.players) || st.players.length===0) return;

  // ---- turn watchdog ----
  const turnIdx = Number(st.turnIndex);
  const turnP = st.players[turnIdx];
if(turnP && turnP.alive && !turnP.isCPU){
  room._turnWarnTimer = setTimeout(()=>{
    const r2 = rooms.get(roomId);
    if(!r2 || r2.phase !== "playing") return;
    const s2 = r2.state;
    const idx2 = Number(s2?.turnIndex);
    const p2 = s2?.players?.[idx2];
    if(!p2 || !p2.alive || p2.isCPU) return;

    warnPlayerBeforeTakeover(r2, idx2, IDLE_WARN_MS);
  }, Math.max(0, TURN_IDLE_MS - IDLE_WARN_MS));

  room._turnTimer = setTimeout(()=>{
    const r2 = rooms.get(roomId);
    if(!r2 || r2.phase!=="playing") return;
    const s2 = r2.state;
    if(!s2) return;
    const idx2 = Number(s2.turnIndex);
    const p2 = s2.players?.[idx2];
    if(!p2 || !p2.alive || p2.isCPU) return;

    setPlayerAutoControl(r2, idx2, true, "idle");
    emitRoomToast(r2, `⚠ ${p2.client?.displayName || p2.displayName || "玩家"} 掛機，已由 CPU 接管`);
    try{ runCpuLoop(roomId); }catch{}
  }, TURN_IDLE_MS);
}

  // ---- pending watchdog ----
  const respId = pendingResponderId(st);
if(respId != null){
  const rp = st.players?.[respId];
  if(rp && rp.alive && !rp.isCPU){
    room._pendingWarnTimer = setTimeout(()=>{
      const r2 = rooms.get(roomId);
      if(!r2 || r2.phase !== "playing") return;
      const s2 = r2.state;
      const resp2 = pendingResponderId(s2);
      if(resp2 == null || Number(resp2)!==Number(respId)) return;

      const p2 = s2.players?.[resp2];
      if(!p2 || !p2.alive || p2.isCPU) return;

      warnPlayerBeforeTakeover(r2, resp2, IDLE_WARN_MS);
    }, Math.max(0, PENDING_IDLE_MS - IDLE_WARN_MS));

    room._pendingTimer = setTimeout(()=>{
      const r2 = rooms.get(roomId);
      if(!r2 || r2.phase!=="playing") return;
      const s2 = r2.state;
      const resp2 = pendingResponderId(s2);
      if(resp2 == null || Number(resp2)!==Number(respId)) return;

      const p2 = s2.players?.[resp2];
      if(!p2 || !p2.alive || p2.isCPU) return;

      setPlayerAutoControl(r2, resp2, true, "pending");
      emitRoomToast(r2, `⚠ ${p2.client?.displayName || p2.displayName || "玩家"} 掛機，已由 CPU 接管`);
      try{ runCpuLoop(roomId); }catch{}
    }, PENDING_IDLE_MS);
  }
}
}

// ====== 房間清單（等待室） ======
function buildRoomList(){
  const list = [];
  for (const [roomId, room] of rooms.entries()){
    if(!room) continue;
    // 只顯示還在等待室的房間（遊戲中不列）
    if(room.phase !== "lobby") continue;

    const humans = new Set([...room.sockets.values()].map(m => m?.playerId)).size;
    const cpuCount = Math.max(0, Math.min(MAX_ROOM_PLAYERS, Number(room.cpuCount || 0) || 0));
    const total = Math.min(MAX_ROOM_PLAYERS, humans + cpuCount);

    const hostId = (room.host == null) ? null : Number(room.host);
    const hostP = (hostId != null) ? room.state?.players?.[hostId] : null;
    const hostName = String(hostP?.client?.displayName || hostP?.displayName || "").trim();

    list.push({
      roomId,
      hostName: hostName || "",
      title: (hostName ? `${hostName}的等待室` : `${roomId}的等待室`),
      humans,
      cpuCount,
      total,
    });
  }
  // 排序：房號字典序（視覺上好找）
  list.sort((a,b)=> String(a.roomId).localeCompare(String(b.roomId)));
  return list;
}


function cleanupRoomIfNoHumans(roomId){
  const rid = String(roomId||"").trim();
  if(!rid) return false;
  const room = rooms.get(rid);
  if(!room) return false;

  // 真人玩家 = room.sockets 裡 distinct playerId
  const humans = new Set([...room.sockets.values()].map(m => m?.playerId)).size;

  // ✅ 等待室：沒真人就立刻解散（符合你原本需求）
  if(humans <= 0 && room.phase === 'lobby'){
    rooms.delete(rid);
    try{ broadcastRoomList(); }catch{}
    return true;
  }

  // ✅ 遊戲中：不要「立刻」刪房，避免 start.html → game.html 轉跳時所有人暫時斷線導致 CPU / 房間資料丟失
  if(humans <= 0 && room.phase === 'playing'){
    // 已經在倒數就不重複排
    if(!room._emptyTimer){
      room._emptySince = Date.now();
      room._emptyTimer = setTimeout(()=>{
        try{
          const r2 = rooms.get(rid);
          if(!r2) return;
          const humans2 = new Set([...r2.sockets.values()].map(m => m?.playerId)).size;
          // 仍然沒真人才刪（保守一點）
          if(humans2 <= 0){
            rooms.delete(rid);
            try{ broadcastRoomList(); }catch{}
          }else{
            // 有人回來了 → 取消刪房標記
            try{ clearTimeout(r2._emptyTimer); }catch{}
            r2._emptyTimer = null;
            r2._emptySince = 0;
          }
        }catch{}
      }, 60000); // 60 秒緩衝（足夠完成換頁 / 斷線重連）
    }
    return false;
  }

  // 有真人：如果之前有排刪房，取消它
  if(humans > 0 && room._emptyTimer){
    try{ clearTimeout(room._emptyTimer); }catch{}
    room._emptyTimer = null;
    room._emptySince = 0;
  }

  return false;
}


function broadcastRoomList(){
  try{ io.emit("ROOM_LIST_UPDATE", { rooms: buildRoomList() }); }catch{}
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

function injectTitlesIntoVisibleState(vis, fullState){
  try{
    if (!vis || !Array.isArray(vis.players) || !fullState || !Array.isArray(fullState.players)) return vis;

    const byId = new Map(fullState.players.map(p => [p.id, p]));
    for (const vp of vis.players){
      const fp = byId.get(vp?.id);
      if (!fp) continue;

      const title = String(fp?.client?.title ?? fp?.title ?? "").trim();
      const tier0 = Number(fp?.client?.titleTier ?? fp?.titleTier ?? 1) || 1;
      const tier = Math.max(1, Math.min(6, tier0));

      if (!vp.client || typeof vp.client !== "object") vp.client = {};

      // 同時塞到 client + root，前端怎麼吃都吃得到
      vp.client.title = title;
      vp.client.titleTier = tier;
      vp.title = title;
      vp.titleTier = tier;
    }
  }catch{}
  return vis;
}


function injectRanksIntoVisibleState(vis, fullState){
  try{
    if (!vis || !Array.isArray(vis.players) || !fullState || !Array.isArray(fullState.players)) return vis;

    const byId = new Map(fullState.players.map(p => [p.id, p]));
    for (const vp of vis.players){
      const fp = byId.get(vp?.id);
      if (!fp) continue;

      const rank = fp?.client?.rank ?? fp?.rank ?? null;

      if (!vp.client || typeof vp.client !== "object") vp.client = {};

      vp.client.rank = (rank && typeof rank === "object") ? rank : null;
      vp.rank = (rank && typeof rank === "object") ? rank : null;
    }
  }catch{}
  return vis;
}



function injectOfflineIntoVisibleState(vis, fullState){
  try{
    if (!vis || !Array.isArray(vis.players) || !fullState || !Array.isArray(fullState.players)) return vis;

    const byId = new Map(fullState.players.map(p => [p.id, p]));
    for (const vp of vis.players){
      const fp = byId.get(vp?.id);
      if (!fp) continue;

      const offline = !!(fp?.client?.offline || fp?.offline);
      const since = Number(fp?.client?.offlineSince || fp?.offlineSince || 0) || 0;

      if (!vp.client || typeof vp.client !== "object") vp.client = {};
      vp.client.offline = offline;
      vp.client.offlineSince = since;

      // root fields too (some frontends read without .client)
      vp.offline = offline;
      vp.offlineSince = since;
    }
  }catch{}
  return vis;
}

function injectAutoControlIntoVisibleState(vis, fullState){
  try{
    if (!vis || !Array.isArray(vis.players) || !fullState || !Array.isArray(fullState.players)) return vis;

    const byId = new Map(fullState.players.map(p => [p.id, p]));
    for (const vp of vis.players){
      const fp = byId.get(vp?.id);
      if (!fp) continue;

      const autoControlled = !!(fp?.client?.autoControlled || fp?.autoControlled || fp?.isCPU);

      if (!vp.client || typeof vp.client !== "object") vp.client = {};
      vp.client.autoControlled = autoControlled;
      vp.autoControlled = autoControlled;
    }
  }catch{}
  return vis;
}

function broadcastState(room){
  const st = room.state;
  const ended = (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");
  const winners = ended ? new Set(st.players.filter(p => p.alive).map(p => p.id)) : new Set();

  for (const [sid, meta] of room.sockets){
    let vis = injectChestCoins(getVisibleState(st, meta.playerId));
vis = injectTitlesIntoVisibleState(vis, st);
vis = injectRanksIntoVisibleState(vis, st);
vis = injectOfflineIntoVisibleState(vis, st);
vis = injectAutoControlIntoVisibleState(vis, st);

const hostPlayer = st?.players?.[room.host];
const hostIsCPU = !!(hostPlayer?.isCPU);

vis.viewerCanNext =
  hostIsCPU ||
  (room.host === meta.playerId) ||
  winners.has(meta.playerId);

vis.viewerIsHost = (room.host === meta.playerId);
vis.cpuSkipAvailable = canHostSkipCpu(room, meta.playerId);
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
  chat: Array.isArray(room.lobbyChat) ? room.lobbyChat : [],
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
// ✅ 新增：段位（等待室互相可見）
    rank: (p.client?.rank ?? p.rank ?? null),
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

  // 2.5) A 方案：如果這局已結束，而且目前沒有任何真人可操作，3 秒後自動下一局
  try{
    const st = room.state;
    const ended = (st?.turnStep === "ended" || st?.turnStep === "end" || st?.turnStep === "score");

    if (ended) {
      const winners = st.players.filter(p => p.alive);
      const aliveHumans = winners.filter(p => !p.isCPU).length;

      // 先清掉舊的 auto-next timer，避免重複排程
      if (room._autoNextTimer) {
        try{ clearTimeout(room._autoNextTimer); }catch{}
        room._autoNextTimer = null;
      }

      // 只要本局結束後，存活者全是 CPU，就自動下一局
      if (aliveHumans === 0) {
        const roomId = [...rooms.entries()].find(([_, r]) => r === room)?.[0];
        if (roomId) {
          room._autoNextTimer = setTimeout(() => {
            const r2 = rooms.get(roomId);
            if (!r2) return;

            const st2 = r2.state;
            const ended2 = (st2?.turnStep === "ended" || st2?.turnStep === "end" || st2?.turnStep === "score");
            if (!ended2) return;

            const ns = nextRound(st2);
            r2.state = ns;
            r2._cpuFastForward = false;
            r2._autoNextTimer = null;

            broadcastState(r2);
            runCpuLoop(roomId);
            armRoomWatchdogs(roomId);
          }, 3000);
        }
      }
    }
  }catch(e){
    console.error("[auto next round] error:", e);
  }

  // 3) 用「最新 state」重新掛 watchdog
  try{
    const roomId = [...rooms.entries()].find(([_, r]) => r === room)?.[0];
    if (roomId) armRoomWatchdogs(roomId);
  }catch(e){
    console.error("[applyAndBroadcast -> armRoomWatchdogs] error:", e);
  }
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

  room._cpuLoopToken = Number(room._cpuLoopToken || 0) + 1;
  const loopToken = room._cpuLoopToken;

  const step = () => {
    const roomNow = rooms.get(roomId);
    if (!roomNow) return;
    if (Number(roomNow._cpuLoopToken || 0) !== loopToken) return;

    const st = roomNow.state;
    if (!st) return;

    if (st.turnStep === 'ended' || st.turnStep === 'end' || st.turnStep === 'score') {
      roomNow._cpuFastForward = false;
    }

    const delay = (ms) => setTimeout(step, roomNow._cpuFastForward ? 0 : ms);
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

      const beforeTurnIndex = st.turnIndex;
      const firstWhich = pickCpuCardSmart(st, meIdx); // 'hand' 或 'drawn'

      applyAndBroadcast(roomNow, {
        type: 'PLAY_CARD',
        playerId: meIdx,
        payload: { which: firstWhich },
      }, io);

      // ===== 保底：如果這次出牌被規則擋下，立刻改打另一張 =====
      const stAfterFirst = roomNow.state;
      const meAfterFirst = stAfterFirst?.players?.[meIdx];
      const stillSameCpuChoose = (
        stAfterFirst &&
        stAfterFirst.turnIndex === beforeTurnIndex &&
        stAfterFirst.turnStep === 'choose' &&
        !stAfterFirst.pending &&
        meAfterFirst &&
        meAfterFirst.alive &&
        meAfterFirst.isCPU
      );

      if (stillSameCpuChoose) {
        let fallbackWhich = null;

        // 青雉凍結：只能打剛抽那張
        if (meAfterFirst.frozen && meAfterFirst.tempDraw != null) {
          fallbackWhich = 'drawn';
        } else if (firstWhich !== 'drawn' && meAfterFirst.tempDraw != null) {
          fallbackWhich = 'drawn';
        } else if (firstWhich !== 'hand' && meAfterFirst.hand != null) {
          fallbackWhich = 'hand';
        }

        if (fallbackWhich) {
          applyAndBroadcast(roomNow, {
            type: 'PLAY_CARD',
            playerId: meIdx,
            payload: { which: fallbackWhich },
          }, io);
        }
      }

      // ★ 出牌後：依「最後成功打出的牌」決定要等多久
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

  socket.on("BOARD_ROOM_LIST", (_payload = {}, cb) => {
    const rooms = serializeBoardRoomList();
    socket.emit("BOARD_ROOM_LIST", { rooms });
    cb?.({ ok:true, rooms });
  });

  socket.on("BOARD_CAMPAIGN_LIST", async (payload = {}, cb) => {
    try{
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      const campaigns = await boardCampaignsForIdentity(profile);
      socket.emit("BOARD_CAMPAIGN_LIST", { campaigns });
      return cb?.({ ok:true, campaigns });
    }catch(error){
      console.error("[BOARD_CAMPAIGN_LIST] error:", error);
      return cb?.({ ok:false, error:String(error?.message || error) });
    }
  });

  socket.on("BOARD_CAMPAIGN_OPEN", async (payload = {}, cb) => {
    try{
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      const campaignId = sanitizeBoardCampaignId(payload.campaignId || "");
      const mode = String(payload.mode || "gather") === "solo" ? "solo" : "gather";
      const campaign = await readBoardCampaign(campaignId);
      if(!boardCampaignFindMember(campaign, profile)) return cb?.({ ok:false, error:"not_campaign_member" });
      let room = mode === "gather" ? boardCampaignActiveGatherRoom(campaignId) : null;
      if(room){
        const joined = joinBoardCampaignRoom(room, profile, socket.id);
        if(!joined.ok) return cb?.({ ok:false, error:joined.error || "join_failed" });
      }else{
        const created = createBoardCampaignRoom(campaign, profile, mode);
        if(!created.ok) return cb?.({ ok:false, error:created.error || "campaign_open_failed" });
        room = created.room;
        room.sockets.set(socket.id, {
          userId:profile.userId,
          clientId:profile.clientId,
          // 個別遊玩會從開始頁立刻導向遊戲頁；允許同一裝置的新分頁連線接手這個暫存席位。
          campaignNavigationPending:mode === "solo",
        });
      }
      socket.data.boardRoomCode = room.roomCode;
      socket.data.boardProfile = profile;
      socket.join(`board:${room.roomCode}`);
      if(mode === "solo" && !room.gamePayload){
        room.gamePayload = assembleBoardCampaignPayload(campaign, room);
        if(!isValidBoardSavePayload(room.gamePayload)) return cb?.({ ok:false, error:"campaign_assemble_failed" });
        room.gameVersion = 1;
        room.gameUpdatedAt = Date.now();
      }
      emitBoardLobby(room);
      return cb?.({
        ok:true,
        mode,
        navigate:mode === "solo",
        roomCode:room.roomCode,
        lobby:serializeBoardLobby(room),
        hasState:!!room.gamePayload,
      });
    }catch(error){
      if(error?.code === "ENOENT") return cb?.({ ok:false, error:"campaign_not_found" });
      console.error("[BOARD_CAMPAIGN_OPEN] error:", error);
      return cb?.({ ok:false, error:String(error?.message || error) });
    }
  });

  socket.on("BOARD_CAMPAIGN_SAVE", async (message = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(message.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      const profile = normalizeBoardProfile(message.profile || socket.data.boardProfile || {});
      if(room){
        const socketMeta = room.sockets.get(socket.id);
        if(!socketMeta || Number(socketMeta.userId) !== Number(profile.userId)){
          return cb?.({ ok:false, error:"not_joined" });
        }
      }
      const result = await saveBoardCampaignProgress(room, profile, message.payload);
      if(!result.ok) return cb?.(result);
      socket.emit("BOARD_CAMPAIGN_SAVED", { campaign:result.campaign });
      return cb?.(result);
    }catch(error){
      console.error("[BOARD_CAMPAIGN_SAVE] error:", error);
      return cb?.({ ok:false, error:String(error?.message || error) });
    }
  });

  socket.on("BOARD_JOIN_ROOM", (payload = {}, cb) => {
    try{
      const profile = normalizeBoardProfile(payload.profile || {});
      const wantsCreate = !!payload.create;
      let roomCode = sanitizeBoardRoomCode(payload.roomCode || payload.roomId || "");
      let room = roomCode ? boardRooms.get(roomCode) : null;
      if(!room && wantsCreate){
        room = createBoardRoom(roomCode || makeBoardRoomCode(), profile);
        roomCode = room.roomCode;
      }
      if(!room){
        return cb?.({ ok:false, error:"not_found" });
      }
      if(room.status === "playing" && !payload.allowPlayingJoin){
        return cb?.({ ok:false, error:"playing" });
      }
      if(room.campaignId && room.status === "playing"){
        return cb?.({ ok:false, error:"campaign_locked" });
      }
      const joined = room.campaignId
        ? joinBoardCampaignRoom(room, profile, socket.id)
        : upsertBoardPlayer(room, profile, socket.id);
      if(!joined.ok) return cb?.({ ok:false, error:joined.error || "join_failed" });
      socket.data.boardRoomCode = room.roomCode;
      socket.data.boardProfile = profile;
      socket.join(`board:${room.roomCode}`);
      emitBoardLobby(room);
      return cb?.({ ok:true, lobby: serializeBoardLobby(room), rooms: serializeBoardRoomList() });
    }catch(e){
      console.error("[BOARD_JOIN_ROOM] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_LEAVE_ROOM", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(room){
        room.sockets.delete(socket.id);
        const meta = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
        const player = room.players.find((item) => Number(item.userId) === Number(meta.userId));
        if(player){
          if(room.campaignId){
            player.clientId = `board-proxy-${room.campaignId}-${player.userId}`;
            player.isCPU = true;
            player.isProxyCPU = true;
            player.proxyOwnerUserId = Number(player.userId || 0);
            player.ready = true;
            player.online = true;
            if(room.status === "playing"){
              room.campaignStartedHumanUserIds = (room.campaignStartedHumanUserIds || [])
                .filter((userId) => Number(userId) !== Number(player.userId));
            }
            emitBoardLobby(room);
          }else{
            player.online = false;
          }
        }
        socket.leave(`board:${room.roomCode}`);
        cleanupBoardRoom(room.roomCode);
      }
      socket.data.boardRoomCode = null;
      return cb?.({ ok:true });
    }catch(e){
      console.error("[BOARD_LEAVE_ROOM] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_LOBBY_READY", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      const player = room.players.find((item) => Number(item.userId) === Number(profile.userId));
      if(!player) return cb?.({ ok:false, error:"not_joined" });
      player.ready = typeof payload.ready === "boolean" ? payload.ready : !player.ready;
      room.chat.push({ system:true, text:`${player.name}${player.ready ? "已準備完成" : "取消了準備"}`, ts:Date.now() });
      room.updatedAt = Date.now();
      emitBoardLobby(room);
      return cb?.({ ok:true, lobby: serializeBoardLobby(room) });
    }catch(e){
      console.error("[BOARD_LOBBY_READY] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_LOBBY_CHAT", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      const text = String(payload.text || "").trim().slice(0, 240);
      if(!text) return cb?.({ ok:false, error:"empty" });
      room.chat.push({ name:profile.name, avatar:profile.avatar, userId:profile.userId, text, ts:Date.now() });
      room.updatedAt = Date.now();
      emitBoardLobby(room);
      return cb?.({ ok:true });
    }catch(e){
      console.error("[BOARD_LOBBY_CHAT] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_ADD_CPU", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      if(room.campaignId) return cb?.({ ok:false, error:"campaign_fixed_roster" });
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      if(Number(room.hostUserId) !== Number(profile.userId)){
        return cb?.({ ok:false, error:"host_only" });
      }
      if(room.status !== "waiting") return cb?.({ ok:false, error:"not_waiting" });
      if(room.players.length >= Number(room.maxPlayers || 4)) return cb?.({ ok:false, error:"full" });
      const cpu = createBoardCpuPlayer(room);
      room.players.push(cpu);
      room.players.forEach((item) => {
        item.isHost = Number(item.userId) === Number(room.hostUserId);
      });
      room.chat.push({ system:true, text:`${cpu.name} 已加入等待室。`, ts:Date.now() });
      room.updatedAt = Date.now();
      emitBoardLobby(room);
      return cb?.({ ok:true, lobby: serializeBoardLobby(room), rooms: serializeBoardRoomList() });
    }catch(e){
      console.error("[BOARD_ADD_CPU] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_REMOVE_CPU", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      if(room.campaignId) return cb?.({ ok:false, error:"campaign_fixed_roster" });
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      if(Number(room.hostUserId) !== Number(profile.userId)){
        return cb?.({ ok:false, error:"host_only" });
      }
      if(room.status !== "waiting") return cb?.({ ok:false, error:"not_waiting" });
      const targetUserId = Number(payload.userId);
      const target = room.players.find((player) => Number(player.userId) === targetUserId);
      if(!boardPlayerIsCpu(target)) return cb?.({ ok:false, error:"cpu_only" });
      room.players = room.players.filter((player) => Number(player.userId) !== targetUserId);
      room.players.forEach((item) => {
        item.isHost = Number(item.userId) === Number(room.hostUserId);
      });
      room.chat.push({ system:true, text:`${target.name} 已離開等待室。`, ts:Date.now() });
      room.updatedAt = Date.now();
      emitBoardLobby(room);
      return cb?.({ ok:true, lobby: serializeBoardLobby(room), rooms: serializeBoardRoomList() });
    }catch(e){
      console.error("[BOARD_REMOVE_CPU] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_START_GAME", async (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      if(Number(room.hostUserId) !== Number(profile.userId)){
        return cb?.({ ok:false, error:"host_only" });
      }
      if(room.campaignId){
        const joinedHumans = room.players.filter((player) => !boardPlayerIsCpu(player));
        const notReady = joinedHumans.filter((player) => !player.ready);
        if(notReady.length) return cb?.({ ok:false, error:"not_all_ready" });
        const campaign = await readBoardCampaign(room.campaignId);
        const basePayload = boardCampaignBasePayload(campaign, room.campaignBaseMemberKey);
        if(room.campaignMode === "gather" && !boardCampaignGatherPayloadIsStable(basePayload)){
          return cb?.({ ok:false, error:"campaign_branch_busy" });
        }
        room.gamePayload = assembleBoardCampaignPayload(campaign, room);
        if(!isValidBoardSavePayload(room.gamePayload)) return cb?.({ ok:false, error:"campaign_assemble_failed" });
        room.gameVersion = Math.max(1, Number(room.gameVersion || 0) + 1);
        room.gameUpdatedAt = Date.now();
        room.campaignStartedHumanUserIds = joinedHumans.map((player) => Number(player.userId));
      }
      room.status = "playing";
      room.updatedAt = Date.now();
      emitBoardLobby(room);
      io.to(`board:${room.roomCode}`).emit("BOARD_NAV_GAME", { roomCode: room.roomCode, lobby: serializeBoardLobby(room) });
      return cb?.({ ok:true });
    }catch(e){
      console.error("[BOARD_START_GAME] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_JOIN_GAME", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      const profile = normalizeBoardProfile(payload.profile || socket.data.boardProfile || {});
      let joined = null;
      if(room.campaignId && room.status === "playing"){
        const allowed = (room.campaignStartedHumanUserIds || []).some((userId) => Number(userId) === Number(profile.userId));
        const existing = room.players.find((player) => Number(player.userId) === Number(profile.userId));
        if(!allowed || !existing || boardPlayerIsCpu(existing)) return cb?.({ ok:false, error:"campaign_locked" });
        const activeConnection = Array.from(room.sockets.entries()).find(([activeSocketId, meta]) => (
          activeSocketId !== socket.id
          && Number(meta?.userId) === Number(profile.userId)
        ));
        if(activeConnection){
          const [activeSocketId, activeMeta] = activeConnection;
          const canTakeOverCampaignNavigation = activeMeta?.campaignNavigationPending === true
            && String(activeMeta?.clientId || "") === String(profile.clientId || "");
          if(!canTakeOverCampaignNavigation) return cb?.({ ok:false, error:"campaign_already_connected" });
          room.sockets.delete(activeSocketId);
          const launcherSocket = io.sockets.sockets.get(activeSocketId);
          if(launcherSocket){
            launcherSocket.leave(`board:${room.roomCode}`);
            launcherSocket.data.boardRoomCode = "";
          }
        }
        clearBoardCampaignDisconnectTimer(room, profile.userId);
        Object.assign(existing, profile, { online:true, isCPU:false, isProxyCPU:false });
        room.sockets.set(socket.id, { userId:existing.userId, clientId:existing.clientId });
        joined = { ok:true, player:existing, reconnected:true };
      }else{
        joined = upsertBoardPlayer(room, profile, socket.id);
      }
      if(!joined.ok) return cb?.({ ok:false, error:joined.error || "join_failed" });
      socket.data.boardRoomCode = room.roomCode;
      socket.data.boardProfile = profile;
      socket.join(`board:${room.roomCode}`);
      const socketMeta = room.sockets.get(socket.id) || profile;
      const canSeedState = boardSocketIsRoomHost(room, socketMeta);
      socket.emit("BOARD_LOBBY", { lobby: serializeBoardLobby(room) });
      if(room.gamePayload){
        socket.emit("BOARD_GAME_STATE", {
          roomCode: room.roomCode,
          payload: room.gamePayload,
          version: room.gameVersion,
          sourceClientId: room.gameSourceClientId || "",
        });
      }else{
        socket.to(`board:${room.roomCode}`).emit("BOARD_STATE_REQUEST", { roomCode: room.roomCode, requesterClientId: profile.clientId });
      }
      emitBoardLobby(room);
      return cb?.({
        ok:true,
        lobby: serializeBoardLobby(room),
        hasState: !!room.gamePayload,
        canSeedState,
        version: room.gameVersion,
      });
    }catch(e){
      console.error("[BOARD_JOIN_GAME] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_GAME_STATE", (message = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(message.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      let payload = message.payload;
      if(!isValidBoardSavePayload(payload)) return cb?.({ ok:false, error:"invalid_payload" });
      const sourceClientId = String(message.sourceClientId || socket.data.boardProfile?.clientId || "");
      if(!canAcceptBoardGameStateUpdate(room, socket, sourceClientId, payload, message.reason || "")){
        return cb?.({ ok:false, error:"not_your_turn" });
      }
      payload = boardPayloadWithPreservedSettings(room, socket, payload, message.reason || "");
      const version = Math.max(Number(room.gameVersion || 0) + 1, Number(message.version || 0) || 0);
      room.gamePayload = payload;
      room.gameVersion = version;
      room.gameSourceClientId = sourceClientId;
      room.gameUpdatedAt = Date.now();
      room.updatedAt = Date.now();
      socket.to(`board:${room.roomCode}`).emit("BOARD_GAME_STATE", { roomCode: room.roomCode, payload, version, sourceClientId, reason: message.reason || "" });
      return cb?.({ ok:true, version });
    }catch(e){
      console.error("[BOARD_GAME_STATE] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

  socket.on("BOARD_STATE_REQUEST", (payload = {}, cb) => {
    try{
      const roomCode = sanitizeBoardRoomCode(payload.roomCode || socket.data.boardRoomCode || "");
      const room = boardRooms.get(roomCode);
      if(!room) return cb?.({ ok:false, error:"not_found" });
      if(room.gamePayload){
        socket.emit("BOARD_GAME_STATE", {
          roomCode: room.roomCode,
          payload: room.gamePayload,
          version: room.gameVersion,
          sourceClientId: room.gameSourceClientId || "",
        });
      }else{
        socket.to(`board:${room.roomCode}`).emit("BOARD_STATE_REQUEST", { roomCode: room.roomCode, requesterClientId: payload.requesterClientId || "" });
      }
      return cb?.({ ok:true });
    }catch(e){
      console.error("[BOARD_STATE_REQUEST] error:", e);
      return cb?.({ ok:false, error:String(e?.message || e) });
    }
  });

// ===== Social auth (for friend dock presence / DM routing) =====
socket.on("SOCIAL_AUTH", async ({ secret, deviceId }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });

    const uid = Number(prof.user_id);

const did = String(deviceId||"").trim();
const existing = loginLocks.get(uid);
if(existing){
  const sockets = existing.sockets ? existing.sockets.size : 0;
  const last = Number(existing.lastSeen||0) || 0;
  const active = (sockets>0) || ((Date.now()-last) <= LOGIN_LOCK_GRACE_MS);
  const bound = String(existing.deviceId||"");
  if(active && bound && did && bound !== did){
    // 擠下線模式：新裝置登入 → 強制把舊裝置踢下線，並把登入轉移到新裝置
    lockKickOthers(uid, socket.id, "takeover", did);
  }
}
lockTouch(uid, did, socket.id);

    socket.data.userId = uid;
    markOnline(uid, socket.id);

    return cb?.({ ok:true, me:{ userId: uid, name: prof.name || "", avatar: Number(prof.avatar)||1 } });
  }catch(e){
    console.error("[SOCIAL_AUTH] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});

// ===== Presence update (page/scene) =====
// Can be sent from any page (including game.html) to mark user online and set their current page.
socket.on("PRESENCE_SET", async ({ secret, page, deviceId }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });

    const uid = Number(prof.user_id);

const did = String(deviceId||"").trim();
const existing = loginLocks.get(uid);
if(existing){
  const sockets = existing.sockets ? existing.sockets.size : 0;
  const last = Number(existing.lastSeen||0) || 0;
  const active = (sockets>0) || ((Date.now()-last) <= LOGIN_LOCK_GRACE_MS);
  const bound = String(existing.deviceId||"");
  if(active && bound && did && bound !== did){
    // 擠下線模式：新裝置更新 presence → 踢掉舊裝置，並把登入轉移到新裝置
    lockKickOthers(uid, socket.id, "takeover", did);
  }
}
lockTouch(uid, did, socket.id);

    socket.data.userId = uid;
    markOnline(uid, socket.id);

    const p = normalizePresencePage(page);
    if(p) userPage.set(uid, p);

    // notify this user's friends to refresh status (best-effort)
    try{
      const stats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
      const client = (stats.client && typeof stats.client==="object") ? stats.client : (stats.client = {});
      ensureSocial(client);
      const fs = client.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0);
      for(const fid of fs){
        emitToUser(fid, "FRIENDS_DIRTY", { by:"presence", userId: uid });
      }
    }catch(_){}

    return cb?.({ ok:true });
  }catch(e){
    console.error("[PRESENCE_SET] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});


socket.on("FRIENDS_GET", async ({ secret }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });

    const stats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const client = (stats.client && typeof stats.client==="object") ? stats.client : (stats.client = {});
    ensureSocial(client);

    const myId = Number(prof.user_id);
    const friends = client.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0);
    const reqIn = client.social.friend_in.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==myId);
    const reqOut = client.social.friend_out.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==myId);

    const wantIds = Array.from(new Set([...friends, ...reqIn, ...reqOut]));
    if(!wantIds.length){
      return cb?.({ ok:true, friends:[], requestsIn:[], requestsOut:[] });
    }

    const r = await pool.query(
      "SELECT user_id, name, avatar FROM player_profiles WHERE user_id = ANY($1::int[])",
      [wantIds]
    );
    const rows = r.rows || [];
    const byId = new Map(rows.map(x=>[Number(x.user_id), x]));

    const friendList = friends
      .map(id=>{
        const x = byId.get(id);
        if(!x) return null;
        const uid = Number(x.user_id);
        return {
          userId: uid,
          name: String(x.name||""),
          avatar: Number(x.avatar)||1,
          online: isOnline(uid),
          page: userPage.get(uid) || "",
          activity: (isOnline(uid)
            ? ((userPage.get(uid)||"")==="game" ? "遊戲中" : "線上")
            : "離線")
        };
      })
      .filter(Boolean);

    const reqInList = reqIn
      .map(id=>{
        const x = byId.get(id);
        if(!x) return null;
        const uid = Number(x.user_id);
        return { userId: uid, name: String(x.name||""), avatar: Number(x.avatar)||1, online: isOnline(uid) };
      })
      .filter(Boolean);

    const reqOutList = reqOut
      .map(id=>{
        const x = byId.get(id);
        if(!x) return null;
        const uid = Number(x.user_id);
        return { userId: uid, name: String(x.name||""), avatar: Number(x.avatar)||1, online: isOnline(uid) };
      })
      .filter(Boolean);

    return cb?.({ ok:true, friends: friendList, requestsIn: reqInList, requestsOut: reqOutList });
  }catch(e){
    console.error("[FRIENDS_GET] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});


// =========================
// Lobby Invite Flow
//  - LOBBY_INVITE_SEND: sender invites friend to roomId
//  - LOBBY_INVITE_RESPOND: receiver accept / reject / mute5
// =========================
socket.on("LOBBY_INVITE_SEND", async ({ secret, toUserId, roomId }, cb) => {
  try{
    pruneLobbyInvites();

    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });

    const fromId = Number(prof.user_id);
    const toId = Number(toUserId);
    const rid = String(roomId||"").trim().toUpperCase();

    if(!(fromId>0)) return cb?.({ ok:false, error:"bad from" });
    if(!(toId>0)) return cb?.({ ok:false, error:"bad to" });
    if(!rid) return cb?.({ ok:false, error:"no room" });
    if(toId === fromId) return cb?.({ ok:false, error:"cannot invite self" });

    // verify room exists & in lobby phase
    const room = rooms.get(rid);
    if(!room) return cb?.({ ok:false, error:"room not found" });
    if(room.phase !== 'lobby') return cb?.({ ok:false, error:"room already started" });

    // only allow inviting friends
    const stats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const client = (stats.client && typeof stats.client==="object") ? stats.client : (stats.client = {});
    ensureSocial(client);
    const friends = new Set(client.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0));
    if(!friends.has(toId)) return cb?.({ ok:false, error:"not friends" });

    // receiver online?
    if(!isOnline(toId)) return cb?.({ ok:false, error:"offline" });

    // receiver muted?
    const rem = lobbyInviteMuteRemainingMs(toId);
    if(rem>0) return cb?.({ ok:false, error:"muted", remainingMs: rem });

    // generate invite
    const inviteId = crypto.randomBytes(4).toString('hex');
    const now = Date.now();
    const inv = {
      inviteId,
      fromId,
      fromName: String(prof.name||""),
      fromAvatar: Number(prof.avatar)||1,
      toId,
      roomId: rid,
      createdAt: now,
      expiresAt: now + 120000, // 2 min
    };
    lobbyInvites.set(inviteId, inv);

    emitToUser(toId, "EMIT", {
      type: "lobby_invite",
      invite: {
        inviteId,
        fromId,
        fromName: inv.fromName,
        fromAvatar: inv.fromAvatar,
        roomId: rid,
        createdAt: now,
        expiresAt: inv.expiresAt,
      }
    });

    return cb?.({ ok:true, inviteId });
  }catch(e){
    console.error("[LOBBY_INVITE_SEND] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});

socket.on("LOBBY_INVITE_RESPOND", async ({ secret, inviteId, action }, cb) => {
  try{
    pruneLobbyInvites();

    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);

    const id = String(inviteId||"").trim();
    const act = String(action||"").trim().toLowerCase();
    const inv = lobbyInvites.get(id);
    if(!inv) return cb?.({ ok:false, error:"invite not found" });
    if(Number(inv.toId)!==myId) return cb?.({ ok:false, error:"not receiver" });

    if(act === 'mute5'){
      lobbyInvites.delete(id);
      const until = Date.now() + 5*60*1000;
      lobbyInviteMuteUntil.set(myId, until);
      emitToUser(Number(inv.fromId), "EMIT", { type:"toast", text:`${String(prof.name||'對方')} 已暫停接收遊戲邀請 5 分鐘` });
      return cb?.({ ok:true, mutedUntil: until });
    }

    if(act === 'reject'){
      lobbyInvites.delete(id);
      emitToUser(Number(inv.fromId), "EMIT", { type:"toast", text:`${String(prof.name||'對方')} 已拒絕遊戲邀請` });
      return cb?.({ ok:true });
    }

    if(act !== 'accept') return cb?.({ ok:false, error:"bad action" });

    // accept
    lobbyInvites.delete(id);

    // verify room still exists and is lobby
    const room = rooms.get(String(inv.roomId));
    if(!room) return cb?.({ ok:false, error:"room not found" });
    if(room.phase !== 'lobby') return cb?.({ ok:false, error:"room already started" });

    emitToUser(Number(inv.fromId), "EMIT", { type:"toast", text:`${String(prof.name||'好友')} 已接受邀請` });
    return cb?.({ ok:true, roomId: String(inv.roomId) });
  }catch(e){
    console.error("[LOBBY_INVITE_RESPOND] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});


// Send friend request by display name (requires target confirmation)
socket.on("FRIEND_ADD_BY_NAME", async ({ secret, name }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);

    const targetName = String(name||"").trim();
    if(!targetName) return cb?.({ ok:false, error:"no name" });

    const t = await pool.query(
      "SELECT user_id, name, avatar, stats FROM player_profiles WHERE lower(btrim(name)) = lower(btrim($1)) LIMIT 1",
      [targetName]
    );
    if(!t.rows.length) return cb?.({ ok:false, error:"not found" });
    const other = t.rows[0];
    const otherId = Number(other.user_id);
    if(otherId === myId) return cb?.({ ok:false, error:"cannot add self" });

    // load my stats
    const myStats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const myClient = (myStats.client && typeof myStats.client==="object") ? myStats.client : (myStats.client = {});
    ensureSocial(myClient);

    // load other stats
    const oStats = (other.stats && typeof other.stats==="object") ? other.stats : {};
    const oClient = (oStats.client && typeof oStats.client==="object") ? oStats.client : (oStats.client = {});
    ensureSocial(oClient);

    // already friends?
    if(myClient.social.friends.includes(otherId)) return cb?.({ ok:false, error:"already friends" });

    // if I already sent request
    if(myClient.social.friend_out.includes(otherId)) return cb?.({ ok:false, error:"request already sent" });

    // if other already requested me -> auto accept? keep explicit confirm, so treat as: add to my incoming and show confirm
    // We'll still create symmetrical in/out if not exists.
    if(!myClient.social.friend_out.includes(otherId)) myClient.social.friend_out.push(otherId);
    if(!oClient.social.friend_in.includes(myId)) oClient.social.friend_in.push(myId);

    // clean duplicates
    myClient.social.friend_out = Array.from(new Set(myClient.social.friend_out.map(n=>Number(n)).filter(n=>Number.isFinite(n)&&n>0)));
    oClient.social.friend_in = Array.from(new Set(oClient.social.friend_in.map(n=>Number(n)).filter(n=>Number.isFinite(n)&&n>0)));

    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [myStats, myId]);
    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [oStats, otherId]);

    // notify online friend docks
    emitToUser(myId, "FRIENDS_DIRTY", { by:"request_out", userId: otherId });
    emitToUser(otherId, "FRIENDS_DIRTY", { by:"request_in", userId: myId });

    return cb?.({ ok:true, pending:true, to:{ userId: otherId, name:String(other.name||""), avatar:Number(other.avatar)||1, online:isOnline(otherId) } });
  }catch(e){
    console.error("[FRIEND_ADD_BY_NAME] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});



// Accept incoming friend request (userId = requester)
socket.on("FRIEND_REQUEST_ACCEPT", async ({ secret, userId }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);
    const otherId = Number(userId);
    if(!(Number.isFinite(otherId) && otherId>0) || otherId===myId) return cb?.({ ok:false, error:"bad userId" });

    // my stats
    const myStats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const myClient = (myStats.client && typeof myStats.client==="object") ? myStats.client : (myStats.client = {});
    ensureSocial(myClient);

    // other profile
    const t = await pool.query("SELECT user_id, name, avatar, stats FROM player_profiles WHERE user_id=$1 LIMIT 1", [otherId]);
    if(!t.rows.length) return cb?.({ ok:false, error:"not found" });
    const other = t.rows[0];

    const oStats = (other.stats && typeof other.stats==="object") ? other.stats : {};
    const oClient = (oStats.client && typeof oStats.client==="object") ? oStats.client : (oStats.client = {});
    ensureSocial(oClient);

    // must have incoming request
    if(!myClient.social.friend_in.includes(otherId)) return cb?.({ ok:false, error:"no incoming request" });

    // remove pending
    myClient.social.friend_in = myClient.social.friend_in.filter(n=>Number(n)!==otherId);
    oClient.social.friend_out = oClient.social.friend_out.filter(n=>Number(n)!==myId);

    // add friends mutual
    if(!myClient.social.friends.includes(otherId)) myClient.social.friends.push(otherId);
    if(!oClient.social.friends.includes(myId)) oClient.social.friends.push(myId);

    // dedupe
    myClient.social.friends = Array.from(new Set(myClient.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n)&&n>0)));
    oClient.social.friends = Array.from(new Set(oClient.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n)&&n>0)));

    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [myStats, myId]);
    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [oStats, otherId]);

    emitToUser(myId, "FRIENDS_DIRTY", { by:"accept", userId: otherId });
    emitToUser(otherId, "FRIENDS_DIRTY", { by:"accept", userId: myId });

    return cb?.({ ok:true });
  }catch(e){
    console.error("[FRIEND_REQUEST_ACCEPT] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});

// Decline incoming friend request (userId = requester)
socket.on("FRIEND_REQUEST_DECLINE", async ({ secret, userId }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);
    const otherId = Number(userId);
    if(!(Number.isFinite(otherId) && otherId>0) || otherId===myId) return cb?.({ ok:false, error:"bad userId" });

    // my stats
    const myStats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const myClient = (myStats.client && typeof myStats.client==="object") ? myStats.client : (myStats.client = {});
    ensureSocial(myClient);

    if(!myClient.social.friend_in.includes(otherId)) return cb?.({ ok:false, error:"no incoming request" });

    // other profile
    const t = await pool.query("SELECT user_id, stats FROM player_profiles WHERE user_id=$1 LIMIT 1", [otherId]);
    if(!t.rows.length){
      // still remove on my side
      myClient.social.friend_in = myClient.social.friend_in.filter(n=>Number(n)!==otherId);
      await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [myStats, myId]);
      return cb?.({ ok:true });
    }
    const other = t.rows[0];
    const oStats = (other.stats && typeof other.stats==="object") ? other.stats : {};
    const oClient = (oStats.client && typeof oStats.client==="object") ? oStats.client : (oStats.client = {});
    ensureSocial(oClient);

    myClient.social.friend_in = myClient.social.friend_in.filter(n=>Number(n)!==otherId);
    oClient.social.friend_out = oClient.social.friend_out.filter(n=>Number(n)!==myId);

    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [myStats, myId]);
    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [oStats, otherId]);

    emitToUser(myId, "FRIENDS_DIRTY", { by:"decline", userId: otherId });
    emitToUser(otherId, "FRIENDS_DIRTY", { by:"decline", userId: myId });

    return cb?.({ ok:true });
  }catch(e){
    console.error("[FRIEND_REQUEST_DECLINE] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});

socket.on("FRIEND_REMOVE", async ({ secret, userId }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);
    const otherId = Number(userId);
    if(!Number.isFinite(otherId) || otherId<=0) return cb?.({ ok:false, error:"bad userId" });

    const myStats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const myClient = (myStats.client && typeof myStats.client==="object") ? myStats.client : (myStats.client = {});
    ensureSocial(myClient);
    myClient.social.friends = myClient.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==otherId);
    myClient.social.friend_in = myClient.social.friend_in.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==otherId);
    myClient.social.friend_out = myClient.social.friend_out.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==otherId);
    await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [myStats, myId]);

    // mutual remove if other exists
    const t = await pool.query("SELECT stats FROM player_profiles WHERE user_id=$1", [otherId]);
    if(t.rows.length){
      const oStats = (t.rows[0].stats && typeof t.rows[0].stats==="object") ? t.rows[0].stats : {};
      const oClient = (oStats.client && typeof oStats.client==="object") ? oStats.client : (oStats.client = {});
      ensureSocial(oClient);
      oClient.social.friends = oClient.social.friends.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==myId);
      oClient.social.friend_in = oClient.social.friend_in.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==myId);
      oClient.social.friend_out = oClient.social.friend_out.map(n=>Number(n)).filter(n=>Number.isFinite(n) && n>0 && n!==myId);
      await pool.query("UPDATE player_profiles SET stats=$1 WHERE user_id=$2", [oStats, otherId]);
    }

    emitToUser(myId, "FRIENDS_DIRTY", { by:"remove", userId: otherId });
    emitToUser(otherId, "FRIENDS_DIRTY", { by:"remove", userId: myId });

    return cb?.({ ok:true });
  }catch(e){
    console.error("[FRIEND_REMOVE] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});

socket.on("DM_HISTORY", async ({ secret, withUserId, limit }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);
    const otherId = Number(withUserId);
    if(!Number.isFinite(otherId) || otherId<=0) return cb?.({ ok:false, error:"bad withUserId" });

    const L = Math.max(10, Math.min(80, Number(limit)||50));
    const a = Math.min(myId, otherId);
    const b = Math.max(myId, otherId);

    const r = await pool.query(
      "SELECT id,a_id,b_id,from_id,body,created_at FROM dm_messages WHERE a_id=$1 AND b_id=$2 ORDER BY created_at DESC LIMIT $3",
      [a,b,L]
    );
    const msgs = (r.rows||[]).map(m=>({
      id: String(m.id),
      from: Number(m.from_id),
      body: String(m.body||""),
      ts: Number(m.created_at)||0
    })).reverse();

    return cb?.({ ok:true, messages: msgs });
  }catch(e){
    console.error("[DM_HISTORY] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});

socket.on("DM_SEND", async ({ secret, toUserId, body }, cb) => {
  try{
    const prof = await getProfileBySecret(String(secret||"").trim());
    if(!prof) return cb?.({ ok:false, error:"bad secret" });
    const myId = Number(prof.user_id);
    const otherId = Number(toUserId);
    const msg = String(body||"").trim();
    if(!Number.isFinite(otherId) || otherId<=0) return cb?.({ ok:false, error:"bad toUserId" });
    if(!msg) return cb?.({ ok:false, error:"empty" });
    if(msg.length > 400) return cb?.({ ok:false, error:"too long" });

    // (optional) only allow to friends
    const stats = (prof.stats && typeof prof.stats==="object") ? prof.stats : {};
    const client = (stats.client && typeof stats.client==="object") ? stats.client : (stats.client = {});
    ensureSocial(client);
    if(!client.social.friends.includes(otherId)){
      return cb?.({ ok:false, error:"not friends" });
    }

    const a = Math.min(myId, otherId);
    const b = Math.max(myId, otherId);
    const now = Date.now();
    const ins = await pool.query(
      "INSERT INTO dm_messages(a_id,b_id,from_id,body,created_at) VALUES($1,$2,$3,$4,$5) RETURNING id",
      [a,b,myId,msg,now]
    );

    const payload = { id:String(ins.rows[0].id), from: myId, to: otherId, body: msg, ts: now };

    // ✅ 修正：避免「送出者」在前端同時做 optimistic append + 收到 DM_NEW 再 append 造成重複。
    // 送出者會以 callback(res.message) 自己渲染一次即可。
    // 收到者才需要 DM_NEW 推播。
    emitToUser(otherId, "DM_NEW", payload);

    return cb?.({ ok:true, message: payload });
  }catch(e){
    console.error("[DM_SEND] error:", e);
    return cb?.({ ok:false, error:String(e?.message||e) });
  }
});


// =====================
// AUTH: 註冊 / 登入
// =====================

// 註冊：建立 users + 建立 player_profiles 並綁 user_id，回傳 secret
socket.on("AUTH_REGISTER", async ({ username, password, deviceId }, cb) => {
  try {
    username = String(username || "").trim().toLowerCase();
    password = String(password || "");

    if (!username || username.length < 3 || username.length > 24) {
      return cb?.({ ok: false, error: "username length 3~24" });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return cb?.({ ok: false, error: "username only a-z 0-9 _" });
    }
    if (!password || password.length < 6 || password.length > 72) {
      return cb?.({ ok: false, error: "password length 6~72" });
    }

    // 1) username 是否被用過
    const exist = await pool.query("SELECT id FROM users WHERE username=$1", [username]);
    if (exist.rows.length) return cb?.({ ok: false, error: "username taken" });

    // 2) 建 user
    const password_hash = await bcrypt.hash(password, 10);
    const u = await pool.query(
      "INSERT INTO users(username, password_hash) VALUES($1,$2) RETURNING id, username",
      [username, password_hash]
    );
    const userId = u.rows[0].id;

    // 3) 建 profile 並綁定 user_id（產生一組永久 secret）
    const secret = crypto.randomBytes(24).toString("hex");

    await pool.query(
      `
      INSERT INTO player_profiles(secret, user_id, name, avatar, stats, titles, bounties, recent_matches)
      VALUES($1, $2, '', '', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
      `,
      [secret, userId]
    );

    lockTouch(userId, deviceId, socket.id);

    return cb?.({ ok: true, username, secret });
  } catch (err) {
    console.error("[AUTH_REGISTER] error:", err);
    return cb?.({ ok: false, error: String(err.message || err) });
  }
});

// 登入：驗證密碼 → 找到該 user 綁定的 player_profiles.secret → 回傳 secret
socket.on("AUTH_LOGIN", async ({ username, password, deviceId }, cb) => {
  try {
    username = String(username || "").trim().toLowerCase();
    password = String(password || "");

    if (!username || !password) return cb?.({ ok: false, error: "missing credentials" });

    // 1) 找 user
    const u = await pool.query(
      "SELECT id, username, password_hash FROM users WHERE username=$1",
      [username]
    );
    if (!u.rows.length) return cb?.({ ok: false, error: "invalid username/password" });

    // 2) 比對密碼
    const user = u.rows[0];
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return cb?.({ ok: false, error: "invalid username/password" });



// =============================
// ✅ Single-session lock: same account cannot login from another device while active
// =============================
const did = String(deviceId||"").trim();
const existing = loginLocks.get(Number(user.id));
if(existing){
  const sockets = existing.sockets ? existing.sockets.size : 0;
  const last = Number(existing.lastSeen||0) || 0;
  const active = (sockets>0) || ((Date.now()-last) <= LOGIN_LOCK_GRACE_MS);
  const bound = String(existing.deviceId||"");
  if(active && bound && did && bound !== did){
    // 擠下線模式：新裝置登入 → 強制踢掉舊裝置，並把登入轉移到新裝置
    lockKickOthers(Number(user.id), socket.id, "takeover", did);
  }
}
// lock to this deviceId (or bind if first time)
lockTouch(Number(user.id), did, socket.id);    // 3) 拿這個帳號對應的 secret
    const p = await pool.query("SELECT secret FROM player_profiles WHERE user_id=$1", [user.id]);

    // 理論上一定有（因為註冊就建了），但保底處理
    let secret;
    if (p.rows.length) {
      secret = p.rows[0].secret;
    } else {
      secret = crypto.randomBytes(24).toString("hex");
      await pool.query(
        `
        INSERT INTO player_profiles(secret, user_id, name, avatar, stats, titles, bounties, recent_matches)
        VALUES($1, $2, '', '', '{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb)
        `,
        [secret, user.id]
      );
    }

    return cb?.({ ok: true, username: user.username, secret });
  } catch (err) {
    console.error("[AUTH_LOGIN] error:", err);
    return cb?.({ ok: false, error: String(err.message || err) });
  }
});


// ====== 雲端個人頁：取得 ======
socket.on("PROFILE_GET", async ({ secret }, cb) => {
  if (!secret) return cb?.({ ok: false, error: "no secret" });

  try {
    const { rows } = await pool.query(
      "SELECT * FROM player_profiles WHERE secret=$1",
      [secret]
    );
    cb?.({ ok: true, profile: rows[0] || null });
  } catch (err) {
  console.error("[PROFILE_GET] db error:", err);
  cb?.({ ok: false, error: String(err.message || err) });
}
});

// ====== 公開參觀：用 user_id 取得玩家資料（唯讀，不回 secret） ======
socket.on("PROFILE_PUBLIC_GET", async ({ userId }, cb) => {
  try {
    const uid = Number(userId);
    if (!Number.isFinite(uid) || uid <= 0) {
      return cb?.({ ok: false, error: "bad userId" });
    }

    const { rows } = await pool.query(
      `
      SELECT
        user_id,
        name,
        avatar,
        stats,
        titles,
        bounties,
        recent_matches,
        updated_at
      FROM player_profiles
      WHERE user_id = $1
      LIMIT 1
      `,
      [uid]
    );

    const p = rows[0] || null;
    if (!p) return cb?.({ ok: false, error: "not found" });

    // ✅ 不回 secret，避免被拿去冒用
    return cb?.({ ok: true, profile: p });
  } catch (err) {
    console.error("[PROFILE_PUBLIC_GET] error:", err);
    return cb?.({ ok: false, error: String(err.message || err) });
  }
});

// ====== 雲端個人頁：更新（永久安全版：局部更新 + stats 合併，不會洗掉 shop/bounties/titles） ======
socket.on("PROFILE_UPDATE", async ({ secret, patch }, cb) => {
  try {
    if (!secret || !patch) return cb?.({ ok: false, error: "missing payload" });

    const has = (k) => Object.prototype.hasOwnProperty.call(patch, k);

    // ✅ 沒傳就不改（避免其它頁只更新 stats 時把 name/avatar 洗成空字串）
    let nameParam   = has("name")   ? String(patch.name ?? "") : null;
    const avatarParam = has("avatar") ? String(patch.avatar ?? "") : null;

    // =============================
    // ✅ 名稱：全服唯一（大小寫不分、去頭尾空白）
    // =============================
    if (nameParam !== null) {
      const cleaned = String(nameParam).replace(/\s+/g, ' ').trim();
      if (!cleaned) return cb?.({ ok:false, error:"bad_name" });
      if (cleaned.length > 16) return cb?.({ ok:false, error:"bad_name" });

      // 查：是否已被其他人使用（secret 不同才算衝突）
      const dup = await pool.query(
        `SELECT 1 FROM player_profiles WHERE lower(btrim(name)) = lower(btrim($2)) AND secret <> $1 LIMIT 1`,
        [secret, cleaned]
      );
      if (dup.rows.length) return cb?.({ ok:false, error:"name_taken" });

      // 用清理後的名字寫入（避免 "  路飛  " 這種）
      nameParam = cleaned;
    }

    // ✅ stats：JSONB 合併（保留 stats.client.shop / stats.client.titles / …）
    const statsParam = has("stats") ? JSON.stringify(patch.stats ?? {}) : null;

    // ✅ JSON 欄位：沒傳就保留；有傳才覆蓋
    const titlesParam   = has("titles")         ? JSON.stringify(patch.titles ?? []) : null;
    const bountiesParam = has("bounties")       ? JSON.stringify(patch.bounties ?? []) : null;
    const recentParam   = has("recent_matches") ? JSON.stringify(patch.recent_matches ?? []) : null;

    const { rows } = await pool.query(
      `
      INSERT INTO player_profiles
        (secret, name, avatar, stats, titles, bounties, recent_matches)
      VALUES
        (
          $1,
          COALESCE($2, ''),                 -- insert 時保底（但 update 時不會亂改）
          COALESCE($3, ''),
          COALESCE($4::jsonb, '{}'::jsonb),
          COALESCE($5::jsonb, '[]'::jsonb),
          COALESCE($6::jsonb, '[]'::jsonb),
          COALESCE($7::jsonb, '[]'::jsonb)
        )
      ON CONFLICT (secret) DO UPDATE SET
        name = COALESCE($2, player_profiles.name),
        avatar = COALESCE($3, player_profiles.avatar),

        stats = CASE
          WHEN $4::jsonb IS NULL THEN player_profiles.stats
          ELSE (player_profiles.stats || $4::jsonb)
        END,

        titles = COALESCE($5::jsonb, player_profiles.titles),
        bounties = COALESCE($6::jsonb, player_profiles.bounties),
        recent_matches = COALESCE($7::jsonb, player_profiles.recent_matches),

        updated_at = now()
      RETURNING *;
      `,
      [secret, nameParam, avatarParam, statsParam, titlesParam, bountiesParam, recentParam]
    );

    cb?.({ ok: true, profile: rows[0] });
  } catch (err) {
    console.error("[PROFILE_UPDATE] error:", err);
    // 23505 = unique_violation（若有建 unique index）
    if (String(err?.code || '') === '23505') {
      return cb?.({ ok:false, error:'name_taken' });
    }
    cb?.({ ok: false, error: String(err.message || err) });
  }
});


// =====================
// MATCH HISTORY（方案B）
// =====================

// 1) 結算頁寫入「這局有哪些人/名次/金幣」（一局一筆，match_key 去重）
socket.on("MATCH_HISTORY_WRITE", async ({ matchKey, endedAt, players }, cb) => {
  try{
    matchKey = String(matchKey || "").trim();
    endedAt = Number(endedAt || 0);
    if(!matchKey) return cb?.({ ok:false, error:"bad matchKey" });
    if(!Number.isFinite(endedAt) || endedAt<=0) endedAt = Date.now();
    if(!Array.isArray(players) || !players.length) return cb?.({ ok:false, error:"bad players" });

    // 瘦身 + 防呆（只留你要的欄位）
// 重要：userId 若前端沒帶到（=0），這裡會嘗試用「room / seatId」補齊
const slimRaw = players
  .map(p=>({
    seatId: Number(p?.seatId ?? p?.id ?? p?.playerId ?? 0) || 0,
    userId: Number(p?.userId || 0) || 0,
    name: String(p?.name || "").slice(0, 32),
    avatar: String(p?.avatar ?? ""),
    place: Number(p?.place || 0) || 0,
    coins: Number(p?.coins || 0) || 0,
  }))
  .filter(p=>p.place>0 && p.coins>=0); // place>=1

// 依 matchKey 解析 roomId（matchKey 格式："<roomId>|<season>|<endedAt>"）
const roomIdFromKey = String(matchKey).split("|")[0] || "";
const room = roomIdFromKey ? rooms.get(roomIdFromKey) : null;

// 若 room 存在：用 room.sockets(meta.playerId + meta.secret) 反查 user_id，補齊 slimRaw.userId
let seatIdToUser = new Map();
if (room && room.sockets){
  // 建 seatId -> secret
  const seatIdToSecret = new Map();
  for (const [,meta] of room.sockets){
    const sid = Number(meta?.playerId ?? -1);
    const sec = String(meta?.secret || "").trim();
    if (sid>=0 && sec) seatIdToSecret.set(sid, sec);
  }

  // 批次查 secret -> user_id/name/avatar
  const secrets = Array.from(new Set(Array.from(seatIdToSecret.values())));
  if (secrets.length){
    try{
      const { rows: profs } = await pool.query(
        `SELECT secret, user_id, name, avatar FROM player_profiles WHERE secret = ANY($1::text[])`,
        [secrets]
      );
      const bySecret = new Map((profs||[]).map(r=>[String(r.secret), r]));
      for (const [sid, sec] of seatIdToSecret.entries()){
        const pr = bySecret.get(sec);
        if (pr){
          seatIdToUser.set(sid, {
            userId: Number(pr.user_id||0) || 0,
            name: String(pr.name||"").slice(0,32),
            avatar: String(pr.avatar ?? "")
          });
        }
      }
    }catch(e){
      console.error("[MATCH_HISTORY_WRITE] enrich userId failed:", e);
    }
  }
}

const slim = slimRaw.map(p=>{
  if(!p.userId && p.seatId && seatIdToUser.has(p.seatId)){
    const filled = seatIdToUser.get(p.seatId);
    return { ...p,
      userId: filled.userId || 0,
      name: p.name || filled.name || p.name,
      avatar: p.avatar || filled.avatar || p.avatar
    };
  }
  return p;
});

    if(!slim.length) return cb?.({ ok:false, error:"empty slim players" });

    await pool.query(
      `
      INSERT INTO match_history(match_key, ended_at, players, rp_map)
      VALUES($1, $2, $3::jsonb, '{}'::jsonb)
      ON CONFLICT (match_key) DO UPDATE SET
        ended_at = EXCLUDED.ended_at,
        players  = EXCLUDED.players
      `,
      [matchKey, endedAt, JSON.stringify(slim)]
    );

    return cb?.({ ok:true });
  }catch(err){
    console.error("[MATCH_HISTORY_WRITE] error:", err);
    return cb?.({ ok:false, error:String(err.message || err) });
  }
});

// 2) 結算頁回寫「自己的本局 RP」（只改 rp_map 裡的自己那格）
socket.on("MATCH_HISTORY_RP_PATCH", async ({ matchKey, userId, deltaRP }, cb) => {
  try{
    matchKey = String(matchKey || "").trim();
    const uid = Number(userId || 0);
    const d = Number(deltaRP || 0);
    if(!matchKey) return cb?.({ ok:false, error:"bad matchKey" });
    if(!Number.isFinite(uid) || uid<=0) return cb?.({ ok:false, error:"bad userId" });
    if(!Number.isFinite(d)) return cb?.({ ok:false, error:"bad deltaRP" });

    await pool.query(
      `
      UPDATE match_history
      SET rp_map = COALESCE(rp_map, '{}'::jsonb) || jsonb_build_object($2::text, $3)
      WHERE match_key = $1
      `,
      [matchKey, uid, d]
    );

    return cb?.({ ok:true });
  }catch(err){
    console.error("[MATCH_HISTORY_RP_PATCH] error:", err);
    return cb?.({ ok:false, error:String(err.message || err) });
  }
});

// 3) 取某玩家最近 N 局（給個人頁最近10局）
socket.on("MATCH_HISTORY_RECENT", async ({ userId, limit }, cb) => {
  try{
    const uid = Number(userId || 0);
    const lim = Math.max(1, Math.min(50, Number(limit || 10) || 10));
    if(!Number.isFinite(uid) || uid<=0) return cb?.({ ok:false, error:"bad userId" });

    const needle = JSON.stringify([{ userId: uid }]);

    const { rows } = await pool.query(
      `
      SELECT match_key, ended_at, players, rp_map
      FROM match_history
      WHERE players @> $1::jsonb
      ORDER BY ended_at DESC NULLS LAST
      LIMIT $2
      `,
      [needle, lim]
    );

    const list = (rows || []).map(r=>{
      const players = Array.isArray(r.players) ? r.players : [];
      const me = players.find(p => Number(p?.userId||0) === uid) || null;
      const rpMap = (r.rp_map && typeof r.rp_map === 'object') ? r.rp_map : {};
      const myRp = (rpMap && Object.prototype.hasOwnProperty.call(rpMap, String(uid))) ? Number(rpMap[String(uid)]) : null;

      return {
        matchKey: r.match_key,
        endedAt: Number(r.ended_at || 0) || 0,
        playerCount: players.length,
        myPlace: Number(me?.place || 0) || 0,
        myCoins: Number(me?.coins || 0) || 0,
        myRp, // 可能 null（尚未回寫）
      };
    });

    return cb?.({ ok:true, list });
  }catch(err){
    console.error("[MATCH_HISTORY_RECENT] error:", err);
    return cb?.({ ok:false, error:String(err.message || err) });
  }
});

// 4) 取單局完整資料（點擊最近10局 → 彈窗顯示所有人）
socket.on("MATCH_HISTORY_GET", async ({ matchKey }, cb) => {
  try{
    matchKey = String(matchKey || "").trim();
    if(!matchKey) return cb?.({ ok:false, error:"bad matchKey" });

    const { rows } = await pool.query(
      `SELECT match_key, ended_at, players, rp_map FROM match_history WHERE match_key=$1 LIMIT 1`,
      [matchKey]
    );
    const r = rows[0] || null;
    if(!r) return cb?.({ ok:false, error:"not found" });

    return cb?.({ ok:true, match:{
      matchKey: r.match_key,
      endedAt: Number(r.ended_at || 0) || 0,
      players: Array.isArray(r.players) ? r.players : [],
      rpMap: (r.rp_map && typeof r.rp_map==='object') ? r.rp_map : {},
    }});
  }catch(err){
    console.error("[MATCH_HISTORY_GET] error:", err);
    return cb?.({ ok:false, error:String(err.message || err) });
  }
});
// ====== 段位排行榜：回傳所有玩家段位（供 profile.html 點段位圖時顯示） ======
socket.on("RANK_LEADERBOARD", async ({ limit=200 } = {}, cb) => {
  try {
    const lim = Math.max(1, Math.min(500, Number(limit)||200));

    // rank 在 stats.client.rank
const { rows } = await pool.query(
  `
  SELECT
    user_id,
    name,
    avatar,
    stats->'client'->'rank' AS rank
  FROM player_profiles
  ORDER BY
    COALESCE((stats->'client'->'rank'->>'tier')::int, 0) DESC,
    COALESCE((stats->'client'->'rank'->>'rp')::int, 0) DESC,
    updated_at DESC
  LIMIT $1
  `,
  [lim]
);

    cb?.({ ok:true, list: rows || [] });
  } catch (err) {
    console.error("[RANK_LEADERBOARD] error:", err);
    cb?.({ ok:false, error: String(err.message || err) });
  }
});


// ====== 房間清單：等待室公開列表 ======
socket.on("ROOM_LIST_GET", (_payload = {}, cb) => {
  try{
    cb?.({ ok:true, rooms: buildRoomList() });
  }catch(err){
    cb?.({ ok:false, error: String(err?.message || err) });
  }
});

// ====== 斷線回來：用 secret 找回自己所在房間（不需要 roomId） ======
// start.html 會在登入後呼叫，若找到就自動 JOIN_ROOM。
// 回傳：{ ok:true, roomId, phase }
socket.on("RESUME_ROOM", (payload = {}, cb) => {
  try{
    const sec = String(payload?.secret || "").trim();
    if (!sec) return cb?.({ ok:false, error:"no secret" });

    let found = null;
    for (const [rid, room] of rooms.entries()){
      const ph = String(room?.phase || "");
      if (ph !== 'lobby' && ph !== 'playing') continue;
      const arr = room?.state?.players || [];
      const hit = Array.isArray(arr) ? arr.find(p => p && String(p.secret||"") === sec) : null;
      if (!hit) continue;
      // 優先：playing > lobby
      if (!found) found = { roomId: rid, phase: ph };
      else if (found.phase !== 'playing' && ph === 'playing') found = { roomId: rid, phase: ph };
    }

    if (!found) return cb?.({ ok:true, roomId:"", phase:"" });
    cb?.({ ok:true, roomId: found.roomId, phase: found.phase });
  }catch(err){
    cb?.({ ok:false, error: String(err?.message || err) });
  }
});


// ====== 遊戲整場（多局）結算完成：封存房間，禁止再 RESUME 回來 ======
socket.on("ROOM_FINISHED", (payload = {}, cb) => {
  try{
    const rid = String(payload?.roomId || joinedRoom || "").trim();
    if(!rid) return cb?.({ ok:false, error:"no roomId" });

    const room = rooms.get(rid);
    if(!room) return cb?.({ ok:true, gone:true });

    // 標記為 ended：RESUME_ROOM 只會找 lobby/playing，所以後續不會再被自動接回
    room.phase = 'ended';
    room.endedAt = Date.now();

    // 1 分鐘後直接刪房（避免使用者回到 start/profile/shop 又被舊房間牽回）
    if(room._endedTimer){
      try{ clearTimeout(room._endedTimer); }catch{}
      room._endedTimer = null;
    }
    room._endedTimer = setTimeout(()=>{
      try{
        rooms.delete(rid);
        broadcastRoomList();
      }catch(e){
        console.error("[ROOM_FINISHED] delete error:", e);
      }
    }, 60 * 1000);

    try{ broadcastRoomList(); }catch{}
    cb?.({ ok:true });
  }catch(err){
    cb?.({ ok:false, error: String(err?.message || err) });
  }
});

socket.on("JOIN_ROOM", async (payload = {}) => {

  const {
  roomId,
  displayName = "",
  avatar = 1,
  secret = "",
  pid,
  cpuCount,        // ← 接收從前端傳來的 CPU 數量

  // ✅ 新增：稱號（等待室顯示）
  title = "",
  titleTier = 1,
// ✅ 新增：段位（可由前端帶；沒帶就 DB 撈）
  rank = null,
} = payload;

    if (!roomId) return;


// 建房：暫給 1 位座位（真正開始時會重建）
let room = rooms.get(roomId);
if (!room) {
  const safeCpu = typeof cpuCount === "number"
    ? Math.max(0, Math.min(3, cpuCount))  // 限制在 0~5
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
  broadcastRoomList();
}

// ✅ 若之前因為全員暫離而排了刪房倒數，這裡有人回來就取消
if(room && room._emptyTimer){
  try{ clearTimeout(room._emptyTimer); }catch{}
  room._emptyTimer = null;
  room._emptySince = 0;
}

const st = room.state;
let sec = secret || "";

// ★ 0) 若帶有 secret，且 state 裡已有同 secret 的玩家 → 視為「重連」
let myId = null;
if (sec) {
  const found = (st.players || []).find(p => p && p.secret === sec);
  if (found) myId = found.id;
}

// ✅ 重連到遊戲中：若玩家先前被 CPU 接管，回來就拿回控制權
if (myId != null && room && room.phase === 'playing') {
  try{
    const p0 = room.state?.players?.[myId];
    if(p0){
      setPlayerAutoControl(room, myId, false, "reconnect");

      // ✅ 重新連線：清掉「斷線中」標記，並立刻廣播讓其他人看到
      if(!p0.client || typeof p0.client !== "object") p0.client = {};
      p0.client.offline = false;
      p0.client.offlineSince = 0;
      p0.offline = false;
      p0.offlineSince = 0;

      clearOfflineTimer(room, myId);
      emitRoomToast(room, `✅ ${p0.client?.displayName || p0.displayName || '玩家'} 已重新連線，恢復真人操控`);
      try{ broadcastState(room); }catch{}
      armRoomWatchdogs(roomId);
    }
  }catch{}
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
  // 房間上限：最多 6 位（等待室只算真人座位；CPU 之後開始時再補）
  if (st.players.length >= MAX_ROOM_PLAYERS) {
    io.to(socket.id).emit('EMIT', { type:'toast', text:`房間已滿（${MAX_ROOM_PLAYERS}/${MAX_ROOM_PLAYERS}）` });
    return;
  }

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

let pickedTitle = String(title || "").trim();
let pickedTier  = Number(titleTier || 1) || 1;

// ✅ 段位：只讀雲端（忽略 payload.rank，避免本地舊資料覆蓋）
let pickedRank = null;

// ✅ 若 payload 沒帶稱號（或為空），或沒帶 rank，就用 secret 去雲端撈
if ((!pickedTitle || !pickedRank) && sec) {
  try {
    const r = await pool.query(
      "SELECT stats FROM player_profiles WHERE secret=$1",
      [sec]
    );
    const client = r.rows?.[0]?.stats?.client;

    // --- title ---
    if (!pickedTitle) {
      const dbTitle = String(client?.titles?.equipped || "").trim();
      const dbTier  = Number(client?.titles?.equippedTier || 1) || 1;
      if (dbTitle) {
        pickedTitle = dbTitle;
        pickedTier = dbTier;
      }
    }

    // --- rank ---
    if (!pickedRank) {
      const dbRank = client?.rank;
      if (dbRank && typeof dbRank === "object") {
        pickedRank = dbRank;
      }
    }
  } catch (e) {
    console.error("[JOIN_ROOM] load title/rank from DB failed:", e?.message || e);
  }
}


const safeTitle = String(pickedTitle || "").trim().slice(0, 18);
const safeTier  = Math.max(1, Math.min(6, Number(pickedTier || 1) || 1));

// ✅ rank 防呆
const safeRank = (pickedRank && typeof pickedRank === "object") ? pickedRank : null;

p.client = { displayName, avatar, pid, title: safeTitle, titleTier: safeTier, rank: safeRank, offline:false, offlineSince:0 };
p.displayName = displayName;
p.avatar = avatar;
p.secret = sec;

p.title = safeTitle;
p.titleTier = safeTier;

// ✅ 新增：段位（等待室/遊戲都吃得到）
p.rank = safeRank;


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
    broadcastRoomList();
    broadcastState(room);

    // ✅ 若這是一個「正在進行中的遊戲」且前端要求立即進 game（斷線回復 / 重新登入）
    // 為了避免 game.html 自己 JOIN_ROOM 時被硬跳，這個只在 wantNav=true 才送。
    try{
      if (room.phase === 'playing' && payload?.wantNav) {
        io.to(socket.id).emit('EMIT', { type:'nav_game', roomId });
      }
    }catch(_){ }
  });

socket.on("TAKE_BACK_CONTROL", ({ roomId, playerId, secret } = {}, cb) => {
  try{
    const room = rooms.get(String(roomId || "").trim());
    if(!room) return cb?.({ ok:false, error:"room not found" });

    const ok = Array.from(room.sockets.values()).some(
      m => Number(m.playerId) === Number(playerId) && String(m.secret || "") === String(secret || "")
    );
    if(!ok) return cb?.({ ok:false, error:"auth failed" });

    const p = room.state?.players?.[playerId];
    if(!p) return cb?.({ ok:false, error:"player not found" });

    setPlayerAutoControl(room, playerId, false, "manual");
    emitRoomToast(room, `✅ ${p.client?.displayName || p.displayName || "玩家"} 已拿回控制權`);

    try{ armRoomWatchdogs(roomId); }catch{}
    return cb?.({ ok:true });
  }catch(e){
    console.error("[TAKE_BACK_CONTROL] error:", e);
    return cb?.({ ok:false, error:String(e?.message || e) });
  }
});

  socket.on("ACTION", (action = {}) => {
    const { roomId, playerId, secret, type } = action;
    const room = rooms.get(roomId);
    if (!room) return;

    // 驗章
    const ok = Array.from(room.sockets.values()).some(m => m.playerId === playerId && m.secret === secret);
    if (!ok) return socket.emit("ERROR", { message: "驗證失敗" });

try{
  const p = room.state?.players?.[playerId];
  if(p && p.isCPU){
    setPlayerAutoControl(room, playerId, false, "manual");
    emitRoomToast(room, `✅ ${p.client?.displayName || p.displayName || "玩家"} 已拿回控制權`);
  }
}catch{}



    // ✅ 任一動作都重置 watchdog，避免掛機卡死
    try{ armRoomWatchdogs(roomId); }catch{}

    if (type === 'TAKE_BACK_CONTROL') {
      const p = room.state?.players?.[playerId];
      if (!p) return;

      setPlayerAutoControl(room, playerId, false, 'manual');
      emitRoomToast(room, `✅ ${p.client?.displayName || p.displayName || "玩家"} 已拿回控制權`);

      try{ armRoomWatchdogs(roomId); }catch{}
      return;
    }

    // 等待室：準備 / 取消
    if (type === 'LOBBY_READY' || type === 'LOBBY_UNREADY'){
      room.lobbyReady = room.lobbyReady || {};
      room.lobbyReady[playerId] = (type === 'LOBBY_READY');
      broadcastLobby(roomId);
      return;
    }

if (type === 'HOST_SKIP_CPU') {
  if (room.host !== playerId) {
    socket.emit('EMIT', { type:'toast', text:'只有房主可以使用一鍵跳過' });
    return;
  }

  if (!canHostSkipCpu(room, playerId)) {
    socket.emit('EMIT', { type:'toast', text:'目前還有真人存活，不能一鍵跳過' });
    return;
  }

  room._cpuFastForward = true;
  io.to(roomId).emit('EMIT', { type:'toast', text:'房主已啟用 CPU 快速跳過' });

  try{ broadcastState(room); }catch{}
  try{ runCpuLoop(roomId); }catch{}
  try{ armRoomWatchdogs(roomId); }catch{}
  return;
}

    // 等待室：文字聊天（所有在等待室的人都看得到）
    // 前端送：{ type:'LOBBY_CHAT', text }
    if (type === 'LOBBY_CHAT'){
      // 只允許在 lobby 階段聊天
      if (room.phase && room.phase !== 'lobby'){
        return;
      }

      const raw = String(action?.text || "").replace(/\s+/g, " ").trim();
      if (!raw) return;

      const msg = raw.slice(0, 160); // 最多 160 字
      room.lobbyChat = Array.isArray(room.lobbyChat) ? room.lobbyChat : [];

      // 取得發送者資料
      const st = room.state;
      const p = (st?.players || []).find(x => x && x.id === playerId) || null;
      const name = (p?.client?.displayName || p?.displayName || `P${playerId+1}`).toString();
      const avatar = Number(p?.client?.avatar ?? p?.avatar ?? 1) || 1;

      room.lobbyChat.push({
        ts: Date.now(),
        pid: playerId,
        name,
        avatar,
        text: msg,
      });

      // 保留最近 60 則
      if (room.lobbyChat.length > 60){
        room.lobbyChat = room.lobbyChat.slice(room.lobbyChat.length - 60);
      }

      broadcastLobby(roomId);
      return;
    }

    // 等待室：房主踢人（只在 waiting lobby 生效）
    // 前端送：{ type:'LOBBY_KICK', targetPlayerId }
    if (type === 'LOBBY_KICK'){
      if (room.host !== playerId) {
        io.to(socket.id).emit('EMIT', { type:'toast', text:'只有房主可以踢人' });
        return;
      }

      const targetPlayerId = Number(action?.targetPlayerId);
      if (!Number.isFinite(targetPlayerId)) {
        io.to(socket.id).emit('EMIT', { type:'toast', text:'踢人失敗：targetPlayerId 錯誤' });
        return;
      }

      // 不允許踢自己
      if (targetPlayerId === playerId) {
        io.to(socket.id).emit('EMIT', { type:'toast', text:'不能踢自己' });
        return;
      }

      // 找出目標 socket（可能理論上有多個 sid，保險起見全刪）
      const kickSids = [];
      for (const [sid, meta] of room.sockets.entries()){
        if (meta?.playerId === targetPlayerId) kickSids.push(sid);
      }

      if (!kickSids.length){
        io.to(socket.id).emit('EMIT', { type:'toast', text:'踢人失敗：玩家已不在房間' });
        return;
      }

      // 從等待室移除（socket map + ready 狀態）
      for (const sid of kickSids){
        try{ room.sockets.delete(sid); }catch{}
        try{ if (room.lobbyReady) delete room.lobbyReady[targetPlayerId]; }catch{}

        // 讓對方端立即回到「選房」
        try{ io.to(sid).emit('EMIT', { type:'lobby_kicked', roomId, by: playerId }); }catch{}
        try{ io.to(sid).emit('EMIT', { type:'toast', text:'你已被房主踢出房間' }); }catch{}

        // 讓 socket.io 也離開該房間（避免收到後續廣播）
        try{
          const s = io.sockets.sockets.get(sid);
          if (s && typeof s.leave === 'function') s.leave(roomId);
        }catch{}
      }

      // 重新選房主（理論上不會踢到 host，但保險）
      if (room.host === targetPlayerId){
        const all = [...room.sockets.values()];
        room.host = all.length ? all[0].playerId : null;
      }

      // 若房間沒人了就刪掉
      if (room.sockets.size === 0){
        rooms.delete(roomId);
        broadcastRoomList();
      } else {
        broadcastLobby(roomId);
        broadcastRoomList();
      }
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

  const safeRank0 = (oldP?.client?.rank ?? oldP?.rank ?? null);
  const safeRank  = (safeRank0 && typeof safeRank0 === "object") ? safeRank0 : null;

  return {
    sid,
    oldId: m.playerId,
    name: m.displayName || `P${m.playerId + 1}`,
    avatar: m.avatar || 1,
    secret: m.secret,

    title: safeTitle,
    titleTier: safeTier,

    // ✅ 新增：段位
    rank: safeRank,
  };
});


      const nHuman = joined.length;       // 真人數
      const cpuMax = Math.max(0, Math.min(MAX_ROOM_PLAYERS - nHuman, Number(room.cpuCount || 0) || 0)); // CPU 上限：總人數不超過 6
      const total = nHuman + cpuMax;      // 總人數 = 真人 + CPU

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
      st.cpuCount = cpuMax;   // 之後如果要給引擎用，可以參考這個欄位

    // ④ 組一個「座位池」：把所有真人 & CPU 丟進來，等等一起洗牌
  const seatPool = [];

  // 先把真人塞進 seatPool
  for (let i = 0; i < nHuman; i++) {
    seatPool.push({ kind: 'human', data: joined[i] });
  }

  // 再把 CPU 佔位塞進 seatPool
  for (let i = 0; i < cpuMax; i++) {
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
  title: j.title || "",
  titleTier: Math.max(1, Math.min(6, Number(j.titleTier || 1) || 1)),

  // ✅ 新增：段位
  rank: (j.rank && typeof j.rank === "object") ? j.rank : null,
};

p.title = j.title || "";
p.titleTier = Math.max(1, Math.min(6, Number(j.titleTier || 1) || 1));

// ✅ 新增：段位
p.rank = (j.rank && typeof j.rank === "object") ? j.rank : null;


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
  broadcastRoomList();
  broadcastState(room);

  // ★ 如果一開始就輪到 CPU，直接讓 CPU 先開始（含 2 秒 / 4 秒延遲）
  runCpuLoop(roomId);

  // ✅ 啟動 watchdog（斷線/掛機/互動卡死保護）
  armRoomWatchdogs(roomId);

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
const hostPlayer = st?.players?.[room.host];
const hostIsCPU = !!(hostPlayer?.isCPU);

// 只有房主 / 本局勝者，或「房主已被接手成 CPU」時的任何玩家，才能開下一局
const can =
  hostIsCPU ||
  (room.host === playerId) ||
  winners.has(playerId);

if (!can) {
  socket.emit('EMIT', {
    type: 'toast',
    text: '只有房主或本局勝者可以開始下一局'
  });
  return;
}

      // 正式進入下一局
const ns = nextRound(st);
room.state = ns;
room._cpuFastForward = false;

// 新一局開始時，把「自動進下一局」計時器清掉，避免重複觸發
if (room._autoNextTimer) {
  try{ clearTimeout(room._autoNextTimer); }catch{}
  room._autoNextTimer = null;
}

broadcastState(room);
      // ★ 如果下一局起始玩家是 CPU，一樣讓 CPU 先動（含延遲）
      runCpuLoop(roomId);

      // ✅ 每局開始也重上 watchdog
      armRoomWatchdogs(roomId);
      return;

    }   // ★★★ 多這一行，把 NEXT_ROUND 的 if 收起來

    // 遊戲內其他行為 → 交給引擎（統一用 helper）
     // 遊戲內其他行為 → 交給引擎（統一用 helper）
    applyAndBroadcast(room, action, io);

    // ★ 玩家行動結束後，如果接下來輪到的是 CPU，就讓 CPU 自動行動（含 2 秒 / 4 秒延遲）
    runCpuLoop(roomId);

    // ✅ 動作結束後再 arm 一次（因為 state 可能已變 turn/pending）
    armRoomWatchdogs(roomId);
  });






  // ===== Lobby: leave room (explicit) =====
  // Client can leave waiting room without closing the page; we must remove the socket from room.sockets,
  // otherwise other players will still see them in lobby.
  socket.on("LEAVE_ROOM", (payload = {}, cb) => {
    try{
      const { roomId } = payload || {};
      const rid = String(roomId || joinedRoom || "").trim();
      if(!rid) return cb?.({ ok:false, error:"no roomId" });

      const room = rooms.get(rid);
      if(!room) {
        // still allow client to proceed
        joinedRoom = null;
        try{ socket.leave(rid); }catch{}
        return cb?.({ ok:true, gone:true });
      }

      // remove this socket from this room
      const meta = room.sockets.get(socket.id);
      room.sockets.delete(socket.id);

      // if lobby stage, also clear ready flag for that playerId
      if(meta && room.lobbyReady) delete room.lobbyReady[meta.playerId];

      // host transfer if needed
      if(room.host != null){
        const all = [...room.sockets.values()];
        room.host = all.length ? all[0].playerId : null;
      }

      // leave socket.io room & clear joinedRoom
      try{ socket.leave(rid); }catch{}
      if(joinedRoom === rid) joinedRoom = null;

      // if no human left, delete room to avoid stale rooms
      if(!cleanupRoomIfNoHumans(rid)){
        broadcastLobby(rid);
        broadcastRoomList();
      }
      return cb?.({ ok:true });
    }catch(e){
      console.error("[LEAVE_ROOM] error:", e);
      return cb?.({ ok:false, error:String(e?.message||e) });
    }
  });

  socket.on("disconnect", () => {
    // social presence
    try{ markOffline(socket.data?.userId, socket.id); }catch{}
    try{ lockRemoveSocket(socket.data?.userId, socket.id); }catch{}

    try{
      const boardCode = sanitizeBoardRoomCode(socket.data?.boardRoomCode || "");
      const boardRoom = boardRooms.get(boardCode);
      if(boardRoom){
        boardRoom.sockets.delete(socket.id);
        const meta = socket.data?.boardProfile || {};
        const player = boardRoom.players.find((item) => Number(item.userId) === Number(meta.userId));
        if(player) player.online = false;
        if(boardRoom.campaignId && player){
          boardRoom.updatedAt = Date.now();
          emitBoardLobby(boardRoom);
          scheduleBoardCampaignProxyTakeover(boardRoom, player.userId);
        }else{
          cleanupBoardRoom(boardRoom.roomCode);
        }
      }
    }catch(e){
      console.error("[BOARD disconnect] error:", e);
    }

    if (!joinedRoom) return;
    const room = rooms.get(joinedRoom);
    if (!room) return;

    const meta = room.sockets.get(socket.id);
    room.sockets.delete(socket.id);

    // ✅ 遊戲中斷線：給 grace 之後 CPU 接管，避免整場多局卡死
    try{
      ensureRoomResilience(room);
      if(room.phase === 'playing' && meta && meta.playerId != null){
        const pid2 = Number(meta.playerId);
        const p = room.state?.players?.[pid2];
        if(p && p.alive){
          emitRoomToast(room, `⚠ ${p.client?.displayName || p.displayName || '玩家'} 連線中斷，${Math.round(OFFLINE_GRACE_MS/1000)} 秒內未回來將由 CPU 接管`);

          // ✅ 斷線中標記（讓其他玩家 UI 立刻看到）
          if(!p.client || typeof p.client !== "object") p.client = {};
          p.client.offline = true;
          p.client.offlineSince = Date.now();
          p.offline = true;
          p.offlineSince = p.client.offlineSince;

          try{ broadcastState(room); }catch{}

          clearOfflineTimer(room, pid2);

          const t = setTimeout(()=>{
            const r2 = rooms.get(joinedRoom);
            if(!r2 || r2.phase !== 'playing') return;
            const p2 = r2.state?.players?.[pid2];
            if(!p2 || !p2.alive) return;

            const sec2 = String(p2.secret || '').trim();
            if(sec2){
              const reconnected = Array.from(r2.sockets.values()).some(m=> String(m?.secret||'').trim() === sec2);
              if(reconnected) return;
            }

if(!p2.isCPU){
  setPlayerAutoControl(r2, pid2, true, "offline");
  emitRoomToast(r2, `⚠ ${p2.client?.displayName || p2.displayName || '玩家'} 未回來，已由 CPU 接管（直到整場結束/或玩家重連）`);
  try{ runCpuLoop(joinedRoom); }catch{}
  try{ armRoomWatchdogs(joinedRoom); }catch{}
}
          }, OFFLINE_GRACE_MS);

          room._offlineTimers.set(pid2, t);
        }
      }
    }catch(e){
      console.error("[disconnect takeover] error:", e);
    }

    if (meta && room.lobbyReady) delete room.lobbyReady[meta.playerId];

    // 房主斷線 → 交棒給目前第一位
    if (room.host != null){
      const all = [...room.sockets.values()];
      if (all.length) room.host = all[0].playerId;
    }

        // 如果沒有真人玩家就解散房間（CPU 不算真人）
    if(!cleanupRoomIfNoHumans(joinedRoom)){
      broadcastLobby(joinedRoom);
      broadcastRoomList();
      // ✅ 剩下的人繼續玩：重上 watchdog
      try{ armRoomWatchdogs(joinedRoom); }catch{}
    }
  });
});


const PORT = process.env.PORT || 8787;
server.listen(PORT, () => console.log("Server listening on", PORT));
