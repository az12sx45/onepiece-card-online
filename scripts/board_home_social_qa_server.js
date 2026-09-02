"use strict";

const path = require("path");
const bcrypt = require("bcryptjs");

const profiles = new Map([
  [91001, {
    user_id: 91001,
    secret: "qa-board-secret-a",
    name: "航海測試甲",
    avatar: 8,
    stats: { client: { social: { friends: [91002], friend_in: [91003], friend_out: [] } } },
  }],
  [91002, {
    user_id: 91002,
    secret: "qa-board-secret-b",
    name: "航海測試乙",
    avatar: 5,
    stats: { client: { social: { friends: [91001], friend_in: [], friend_out: [] } } },
  }],
  [91003, {
    user_id: 91003,
    secret: "qa-board-secret-c",
    name: "航海測試丙",
    avatar: 7,
    stats: { client: { social: { friends: [], friend_in: [], friend_out: [91001] } } },
  }],
  [91004, {
    user_id: 91004,
    secret: "qa-board-secret-login",
    name: "航海登入測試",
    avatar: 6,
    stats: { client: { social: { friends: [], friend_in: [], friend_out: [] }, totals: { coins: 4180 } } },
  }],
]);

const users = new Map([
  ["qa_board_guest", {
    id: 91004,
    username: "qa_board_guest",
    password_hash: bcrypt.hashSync("qa-board-pass", 8),
  }],
]);

const directMessages = [];
let nextMessageId = 1;

function normalizeSql(sql) {
  return String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function publicProfile(profile, includeStats = false) {
  if (!profile) return null;
  const result = {
    user_id: profile.user_id,
    name: profile.name,
    avatar: profile.avatar,
  };
  if (includeStats) result.stats = profile.stats;
  return result;
}

const fakePool = {
  async query(sql, params = []) {
    const text = normalizeSql(sql);
    if (text.startsWith("create ") || text.startsWith("alter ")) return { rows: [], rowCount: 0 };
    if (text === "select now() as now") return { rows: [{ now: new Date().toISOString() }], rowCount: 1 };
    if (text.includes("from users where username=$1")) {
      const user = users.get(String(params[0] || "").toLowerCase());
      return { rows: user ? [{ ...user }] : [], rowCount: user ? 1 : 0 };
    }
    if (text.includes("from player_profiles where secret=$1")) {
      const profile = [...profiles.values()].find((entry) => entry.secret === String(params[0] || ""));
      const row = publicProfile(profile, true);
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (text.includes("from player_profiles where user_id = any")) {
      const ids = Array.isArray(params[0]) ? params[0].map(Number) : [];
      const rows = ids.map((id) => publicProfile(profiles.get(id), text.includes(" stats"))).filter(Boolean);
      return { rows, rowCount: rows.length };
    }
    if (text.includes("select secret from player_profiles where user_id=$1")) {
      const profile = profiles.get(Number(params[0]));
      return { rows: profile ? [{ secret: profile.secret }] : [], rowCount: profile ? 1 : 0 };
    }
    if (text.includes("from player_profiles where user_id=$1")) {
      const row = publicProfile(profiles.get(Number(params[0])), text.includes("stats"));
      return { rows: row ? [row] : [], rowCount: row ? 1 : 0 };
    }
    if (text.startsWith("update player_profiles set stats=$1 where user_id=$2")) {
      const profile = profiles.get(Number(params[1]));
      if (profile) profile.stats = params[0];
      return { rows: [], rowCount: profile ? 1 : 0 };
    }
    if (text.includes("from dm_messages") && text.startsWith("select")) {
      const a = Number(params[0]);
      const b = Number(params[1]);
      const limit = Number(params[2]) || 60;
      const rows = directMessages
        .filter((message) => message.a_id === a && message.b_id === b)
        .sort((left, right) => right.created_at - left.created_at)
        .slice(0, limit)
        .map((message) => ({ ...message }));
      return { rows, rowCount: rows.length };
    }
    if (text.startsWith("insert into dm_messages")) {
      const message = {
        id: nextMessageId++,
        a_id: Number(params[0]),
        b_id: Number(params[1]),
        from_id: Number(params[2]),
        body: String(params[3] || ""),
        created_at: Number(params[4]) || Date.now(),
      };
      directMessages.push(message);
      return { rows: [{ id: message.id }], rowCount: 1 };
    }
    if (text.includes("from board_campaigns")) return { rows: [], rowCount: 0 };
    if (text.includes("from board_saves")) return { rows: [], rowCount: 0 };
    return { rows: [], rowCount: 0 };
  },
};

const dbPath = require.resolve(path.join(__dirname, "..", "server", "db.js"));
require.cache[dbPath] = {
  id: dbPath,
  filename: dbPath,
  loaded: true,
  exports: { pool: fakePool },
};

process.env.DATABASE_URL = "postgresql://board-social-qa.invalid/mock";
process.env.PORT = process.env.PORT || "8797";
require(path.join(__dirname, "..", "server", "index.js"));
