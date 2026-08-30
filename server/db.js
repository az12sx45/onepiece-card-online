const { Pool } = require("pg");

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }, // Render / Neon 都適用
    })
  : {
      async query() {
        throw new Error("DATABASE_URL not set");
      },
    };

if (!process.env.DATABASE_URL) {
  console.warn("[db] DATABASE_URL not set; static pages can run, DB-backed features are disabled.");
}

module.exports = { pool };
