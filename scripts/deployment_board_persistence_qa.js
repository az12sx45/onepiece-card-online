"use strict";

const assert = require("assert");
const path = require("path");

const saves = new Map();
const campaigns = new Map();

function normalizeSql(sql){
  return String(sql || "").replace(/\s+/g, " ").trim().toLowerCase();
}

const fakePool = {
  async query(sql, params = []){
    const text = normalizeSql(sql);
    if(text === "select now() as now") return { rows:[{ now:new Date().toISOString() }], rowCount:1 };
    if(text.startsWith("create table") || text.startsWith("create index")) return { rows:[], rowCount:0 };
    if(text.startsWith("insert into board_saves")){
      saves.set(String(params[0]), { payload:params[1], saved_at:Number(params[2]) });
      return { rows:[], rowCount:1 };
    }
    if(text.startsWith("select payload from board_saves where room_code")){
      const row = saves.get(String(params[0]));
      return { rows:row ? [{ payload:row.payload }] : [], rowCount:row ? 1 : 0 };
    }
    if(text.startsWith("select room_code,payload,saved_at from board_saves")){
      const excluded = String(params[0]);
      const found = [...saves.entries()]
        .filter(([roomCode]) => roomCode !== excluded)
        .sort((a,b) => b[1].saved_at - a[1].saved_at)[0];
      return {
        rows:found ? [{ room_code:found[0], payload:found[1].payload, saved_at:found[1].saved_at }] : [],
        rowCount:found ? 1 : 0,
      };
    }
    if(text.startsWith("delete from board_saves where room_code")){
      const deleted = saves.delete(String(params[0]));
      return { rows:[], rowCount:deleted ? 1 : 0 };
    }
    if(text.startsWith("insert into board_campaigns")){
      campaigns.set(String(params[0]), { payload:params[1], updated_at:Number(params[2]) });
      return { rows:[], rowCount:1 };
    }
    if(text.startsWith("select payload from board_campaigns where campaign_id")){
      const row = campaigns.get(String(params[0]));
      return { rows:row ? [{ payload:row.payload }] : [], rowCount:row ? 1 : 0 };
    }
    if(text.startsWith("select payload from board_campaigns order by updated_at")){
      const rows = [...campaigns.values()]
        .sort((a,b) => b.updated_at - a.updated_at)
        .map((row) => ({ payload:row.payload }));
      return { rows, rowCount:rows.length };
    }
    return { rows:[], rowCount:0 };
  },
};

async function requestJson(url, options){
  const response = await fetch(url, options);
  const body = await response.json();
  assert(response.ok, `${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function main(){
  const dbPath = require.resolve(path.join(__dirname, "..", "server", "db.js"));
  require.cache[dbPath] = {
    id:dbPath,
    filename:dbPath,
    loaded:true,
    exports:{ pool:fakePool },
  };
  process.env.DATABASE_URL = "postgresql://deployment-qa.invalid/mock";
  process.env.PORT = "8792";
  require(path.join(__dirname, "..", "server", "index.js"));

  await new Promise((resolve) => setTimeout(resolve, 250));
  const base = "http://127.0.0.1:8792/api/board-save";
  const payloadA = { version:1, savedAt:new Date().toISOString(), gameState:{ boardData:{ mapTemplate:{ cols:11 } } } };
  const payloadB = { version:1, savedAt:new Date(Date.now()+1000).toISOString(), gameState:{ boardData:{ mapTemplate:{ cols:22 } } } };
  const jsonHeaders = { "content-type":"application/json" };

  assert((await requestJson(`${base}/QA_DB_A`, { method:"PUT", headers:jsonHeaders, body:JSON.stringify({ payload:payloadA }) })).ok);
  assert((await requestJson(`${base}/QA_DB_B`, { method:"PUT", headers:jsonHeaders, body:JSON.stringify({ payload:payloadB }) })).ok);
  assert.strictEqual((await requestJson(`${base}/QA_DB_A`)).payload.gameState.boardData.mapTemplate.cols, 11);
  assert.strictEqual((await requestJson(`${base}/QA_DB_A`, { method:"DELETE" })).deleted, true);
  const fallback = await requestJson(`${base}/QA_DB_A`);
  assert.strictEqual(fallback.fallbackRoomCode, "QA_DB_B");
  assert.strictEqual(fallback.payload.gameState.boardData.mapTemplate.cols, 22);
  assert.strictEqual((await requestJson(`${base}/QA_DB_B`, { method:"DELETE" })).deleted, true);

  assert.strictEqual(saves.size, 0);
  console.log("BOARD_PERSISTENCE_DB_QA=PASS");
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});
