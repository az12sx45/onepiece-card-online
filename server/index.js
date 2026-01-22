/* server/index.js (fixed)
 * - Removes duplicate declarations causing "Identifier already declared"
 * - Adds PostgreSQL + JWT auth + /api/me sync endpoints
 * - Keeps existing Socket.IO game server logic scaffold-friendly
 *
 * ENV required:
 *   DATABASE_URL=postgres://...
 *   JWT_SECRET=some_long_random_string
 */

"use strict";

const path = require("path");
const http = require("http");
const express = require("express");
const { Server } = require("socket.io");

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

// ------------------------
// Config
// ------------------------
const PORT = process.env.PORT || 10000;
const JWT_SECRET = process.env.JWT_SECRET || "";
const JWT_TTL = process.env.JWT_TTL || "30d";
const DATABASE_URL = process.env.DATABASE_URL || "";

if (!DATABASE_URL) {
  console.error("[FATAL] DATABASE_URL is missing");
}
if (!JWT_SECRET) {
  console.error("[FATAL] JWT_SECRET is missing");
}

// Render Postgres commonly needs SSL; this setting works for Render-hosted DB.
const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL ? { rejectUnauthorized: false } : undefined,
});

// ------------------------
// DB schema
// ------------------------
async function ensureSchema() {
  // users: username+password
  // user_data: profile + stats (JSON)
  const sql = `
  CREATE TABLE IF NOT EXISTS users (
    id            SERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    pass_hash     TEXT NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS user_data (
    user_id       INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    profile_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `;
  await pool.query(sql);
}

async function dbPing() {
  const r = await pool.query("SELECT 1 as ok");
  return r?.rows?.[0]?.ok === 1;
}

// ------------------------
// Helpers: JWT + auth
// ------------------------
function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, JWT_SECRET, { expiresIn: JWT_TTL });
}

function parseBearer(req) {
  const h = req.headers.authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : "";
}

function authMiddleware(req, res, next) {
  try {
    const token = parseBearer(req);
    if (!token) return res.status(401).json({ ok: false, error: "NO_TOKEN" });

    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded?.sub);
    if (!userId) return res.status(401).json({ ok: false, error: "BAD_TOKEN" });

    req.userId = userId;
    next();
  } catch (e) {
    return res.status(401).json({ ok: false, error: "INVALID_TOKEN" });
  }
}

// Merge helpers (server-side safe merge)
function isObj(x) {
  return x && typeof x === "object" && !Array.isArray(x);
}
function deepMerge(a, b) {
  // merges b into a (both plain objects); arrays are replaced by union where appropriate
  if (!isObj(a)) a = {};
  if (!isObj(b)) return a;

  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (Array.isArray(v)) {
      // For known array fields, do union unique
      const av = Array.isArray(out[k]) ? out[k] : [];
      const set = new Set([...av, ...v]);
      out[k] = Array.from(set);
    } else if (isObj(v)) {
      out[k] = deepMerge(out[k], v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function nowIso() {
  return new Date().toISOString();
}

// ------------------------
// Express app + routes
// ------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));

// Serve static files from /public
app.use(express.static(path.join(__dirname, "..", "public"), { maxAge: 0 }));

// Health check
app.get("/health", async (req, res) => {
  try {
    const ok = await dbPing();
    res.json({ ok: true, db: ok });
  } catch (e) {
    res.status(500).json({ ok: false, error: "DB_DOWN" });
  }
});

// Auth: register
app.post("/api/auth/register", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");

    if (!username || username.length < 3) {
      return res.status(400).json({ ok: false, error: "USERNAME_TOO_SHORT" });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ ok: false, error: "PASSWORD_TOO_SHORT" });
    }

    const pass_hash = await bcrypt.hash(password, 10);

    const r = await pool.query(
      "INSERT INTO users (username, pass_hash) VALUES ($1, $2) RETURNING id",
      [username, pass_hash]
    );
    const userId = r.rows[0].id;

    // init user_data row
    await pool.query(
      "INSERT INTO user_data (user_id, profile_json) VALUES ($1, $2)",
      [userId, JSON.stringify({ createdAt: nowIso(), totals: { games: 0, wins: 0, coins: 0 } })]
    );

    return res.json({ ok: true });
  } catch (e) {
    // unique violation
    if (String(e?.code) === "23505") {
      return res.status(409).json({ ok: false, error: "USERNAME_TAKEN" });
    }
    console.error("register error:", e);
    return res.status(500).json({ ok: false, error: "REGISTER_FAILED" });
  }
});

// Auth: login
app.post("/api/auth/login", async (req, res) => {
  try {
    const username = String(req.body?.username || "").trim();
    const password = String(req.body?.password || "");
    if (!username || !password) {
      return res.status(400).json({ ok: false, error: "MISSING_FIELDS" });
    }

    const r = await pool.query("SELECT id, pass_hash FROM users WHERE username=$1", [username]);
    if (!r.rows.length) return res.status(401).json({ ok: false, error: "BAD_CREDENTIALS" });

    const { id, pass_hash } = r.rows[0];
    const ok = await bcrypt.compare(password, pass_hash);
    if (!ok) return res.status(401).json({ ok: false, error: "BAD_CREDENTIALS" });

    const token = signToken(id);
    return res.json({ ok: true, token });
  } catch (e) {
    console.error("login error:", e);
    return res.status(500).json({ ok: false, error: "LOGIN_FAILED" });
  }
});

// Get current user data
app.get("/api/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const r = await pool.query("SELECT profile_json FROM user_data WHERE user_id=$1", [userId]);
    const profile = r.rows.length ? r.rows[0].profile_json : {};
    return res.json({ ok: true, userId, profile });
  } catch (e) {
    console.error("me error:", e);
    return res.status(500).json({ ok: false, error: "ME_FAILED" });
  }
});

// Sync profile data from client (merge)
app.post("/api/me/sync", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;
    const incoming = req.body?.profile || {};
    const r = await pool.query("SELECT profile_json FROM user_data WHERE user_id=$1", [userId]);
    const current = r.rows.length ? r.rows[0].profile_json : {};

    // Merge strategy:
    // - totals: take max for games/wins, sum coins if you want; here we take max coins_total
    // - arrays: union
    // - recent: merge by matchKey if present
    const merged = deepMerge(current, incoming);

    // Optional: normalize totals
    if (merged?.totals && incoming?.totals) {
      const ct = merged.totals || {};
      const it = incoming.totals || {};
      merged.totals = {
        games: Math.max(Number(ct.games || 0), Number(it.games || 0)),
        wins: Math.max(Number(ct.wins || 0), Number(it.wins || 0)),
        coins: Math.max(Number(ct.coins || 0), Number(it.coins || 0)),
      };
    }

    // recent merge by matchKey
    if (Array.isArray(current?.recent) || Array.isArray(incoming?.recent)) {
      const a = Array.isArray(current?.recent) ? current.recent : [];
      const b = Array.isArray(incoming?.recent) ? incoming.recent : [];
      const map = new Map();
      for (const item of [...a, ...b]) {
        const key = item?.matchKey || item?.id || JSON.stringify(item).slice(0, 80);
        if (!map.has(key)) map.set(key, item);
      }
      merged.recent = Array.from(map.values()).slice(-10);
    }

    merged.updatedAt = nowIso();

    await pool.query(
      "INSERT INTO user_data (user_id, profile_json, updated_at) VALUES ($1, $2, NOW()) " +
        "ON CONFLICT (user_id) DO UPDATE SET profile_json = EXCLUDED.profile_json, updated_at = NOW()",
      [userId, JSON.stringify(merged)]
    );

    return res.json({ ok: true });
  } catch (e) {
    console.error("sync error:", e);
    return res.status(500).json({ ok: false, error: "SYNC_FAILED" });
  }
});

// ------------------------
// Socket.IO server
// ------------------------
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// Authenticate socket via handshake auth.token (optional but recommended)
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || "";
    if (!token) {
      socket.userId = null;
      return next();
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userId = Number(decoded?.sub);
    socket.userId = userId || null;
    return next();
  } catch (e) {
    socket.userId = null;
    return next(); // allow connection; game can require login for join
  }
});

// --------------------------------------------------------------------
// NOTE:
// Your existing game room logic should already be here in your repo.
// This fixed file is intended to be a drop-in "server/index.js" that
// doesn't duplicate declarations and supports auth+db.
// If you have additional server logic files (engine, etc.), keep them.
// --------------------------------------------------------------------

// Example minimal gate: require login before joining room
io.on("connection", (socket) => {
  socket.on("JOIN_ROOM", async (payload = {}) => {
    try {
      if (!socket.userId) {
        socket.emit("TOAST", { type: "error", msg: "請先登入帳號後再進入遊戲。" });
        return;
      }
      // Your existing join room logic should run here.
      // If your project already handles room join via another event/action,
      // adapt this gate into that flow.
      socket.emit("TOAST", { type: "ok", msg: "登入驗證成功（可進房）" });
      socket.emit("JOINED", { ok: true });
    } catch (e) {
      socket.emit("TOAST", { type: "error", msg: "進房失敗" });
    }
  });
});

// ------------------------
// Boot
// ------------------------
(async () => {
  try {
    await ensureSchema();
    const ok = await dbPing();
    console.log(ok ? "[DB] PostgreSQL connected" : "[DB] PostgreSQL ping failed");
  } catch (e) {
    console.error("[DB] init failed:", e);
  }

  server.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });
})();
