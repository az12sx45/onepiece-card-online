"use strict";

// Real HTTP + Socket.IO transport, isolated mock PostgreSQL. No real account or save is touched.
const assert = require("assert/strict");
const path = require("path");
const WebSocket = require("ws");
const clone = (value) => JSON.parse(JSON.stringify(value));
const campaigns = new Map();
const legacySaves = new Map();
const sqlLog = [];
const clients = [];
const port = Number(process.env.BOARD_VOYAGE_QA_PORT || 18915);
let assertions = 0;
const check = (value, message) => { assert(value, message); assertions++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const fakePool = {
  async query(sql, params = []){
    const normalized = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
    sqlLog.push(normalized);
    if(normalized === "select now() as now") return { rows:[{ now:new Date().toISOString() }], rowCount:1 };
    if(normalized.includes("from player_profiles where secret=$1")){
      const userId = Number(String(params[0]).replace("qa-secret-", ""));
      return { rows:userId > 0 && userId < 10 ? [{ user_id:userId, name:`QA ${userId}`, avatar:userId, stats:{} }] : [], rowCount:1 };
    }
    if(normalized.startsWith("insert into board_campaigns")){
      check(normalized.includes("where $4::bigint") && normalized.includes("returning campaign_id"), "database write must use SQL CAS");
      const [id, payload, , expected] = params;
      const previous = campaigns.get(id);
      if(previous && (Number(expected) < 0 || Number(previous.revision || 0) !== Number(expected))) return { rows:[], rowCount:0 };
      campaigns.set(id, clone(payload));
      return { rows:[{ campaign_id:id }], rowCount:1 };
    }
    if(normalized.startsWith("select payload from board_campaigns where campaign_id")){
      const payload = campaigns.get(params[0]);
      return { rows:payload ? [{ payload:clone(payload) }] : [], rowCount:payload ? 1 : 0 };
    }
    if(normalized.startsWith("select payload from board_campaigns where exists")){
      check(normalized.includes("jsonb_array_elements") && normalized.includes("member->>'userid'=$1"), "list query filters authenticated membership before reading snapshots");
      return { rows:[...campaigns.values()].filter((payload) => payload.members.some((member) => String(member.userId) === params[0])).map((payload) => ({ payload:clone(payload) })) };
    }
    if(normalized.startsWith("select payload from board_campaigns order by updated_at")) throw new Error("unscoped_campaign_list_query");
    if(normalized.startsWith("select payload from board_saves where room_code")){
      const payload = legacySaves.get(params[0]);
      return { rows:payload ? [{ payload:clone(payload) }] : [], rowCount:payload ? 1 : 0 };
    }
    return { rows:[], rowCount:0 };
  },
};

async function connect(userId){
  const socket = new WebSocket(`ws://127.0.0.1:${port}/socket.io/?EIO=4&transport=websocket`);
  const waiting = new Map();
  const events = [];
  let seq = 0;
  const connected = new Promise((resolve, reject) => {
    socket.on("error", reject);
    socket.on("message", (bytes) => {
      const message = bytes.toString();
      if(message.startsWith("0")) return socket.send("40");
      if(message === "2") return socket.send("3");
      if(message.startsWith("40")) return resolve();
      if(message.startsWith("42")) events.push(JSON.parse(message.slice(2)));
      const ack = message.match(/^43(\d+)(\[.*)$/s);
      if(ack){ const callback = waiting.get(Number(ack[1])); waiting.delete(Number(ack[1])); callback?.(JSON.parse(ack[2])[0]); }
    });
  });
  await connected;
  const client = {
    socket, events, profile:{ userId, clientId:`voyage-qa-${userId}`, name:`QA ${userId}`, avatar:userId },
    async emit(event, payload = {}){
      const id = ++seq;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`ack_timeout:${event}`)); }, 5000);
        waiting.set(id, (result) => { clearTimeout(timer); resolve(result); });
        socket.send(`42${id}${JSON.stringify([event, payload])}`);
      });
    },
    async auth(){ return this.emit("SOCIAL_AUTH", { secret:`qa-secret-${userId}`, deviceId:`qa-device-${userId}` }); },
  };
  clients.push(client);
  return client;
}

function fixture(round = 1){
  return {
    version:1, roomCode:"QA", savedAt:new Date().toISOString(),
    battleState:{ fixture:true, turn:3, enemy:{ hp:17 }, awaitingResult:true },
    boardUiEvent:{ type:"qa-pending-dialogue" },
    gameState:{ boardData:{ mapTemplate:{ cols:11 }, nodes:[{ id:"fixture-island" }] }, phase:"main", round, currentPlayerIndex:0, turnStep:"event", seed:"voyage-server-qa", postgameWorld:{ unlocked:false }, pendingMove:{ to:3 }, tradePrompt:{ id:"unchanged" }, players:[
      { id:"1", userId:1, clientId:"voyage-qa-1", name:"QA 1", coins:100, crew:[{ id:"luffy", instanceId:"qa-crew-1" }], items:[{ id:"log-pose" }], location:{ kind:"sea", tileId:"t1" } },
      { id:"2", userId:2, clientId:"voyage-qa-2", name:"QA 2", coins:200, crew:[{ id:"zoro", instanceId:"qa-crew-2" }], items:[], location:{ kind:"island", islandId:"i1" } },
      { id:"-1001", userId:-1001, clientId:"cpu-1", name:"CPU1", isCPU:true, coins:50 },
    ] },
  };
}

async function main(){
  const dbPath = require.resolve(path.join(__dirname, "..", "server", "db.js"));
  require.cache[dbPath] = { id:dbPath, filename:dbPath, loaded:true, exports:{ pool:fakePool } };
  process.env.DATABASE_URL = "postgresql://voyage-qa.invalid/isolated-mock";
  process.env.PORT = String(port);
  require(path.join(__dirname, "..", "server", "index.js"));
  const a = await connect(1), b = await connect(2), stranger = await connect(3), guest = await connect(4);
  eq((await guest.emit("BOARD_CAMPAIGN_LIST", { profile:a.profile })).error, "auth_required", "production must not trust requested user id");
  eq((await guest.emit("BOARD_JOIN_ROOM", { create:true, profile:a.profile })).error, "auth_required", "unauthenticated room impersonation rejected");
  for(const client of [a,b,stranger]) check((await client.auth()).ok, "QA authentication");
  for(const method of ["GET", "PUT", "DELETE"]){
    const response = await fetch(`http://127.0.0.1:${port}/api/board-save/QA_MISSING`, { method });
    eq(response.status, 410, "legacy global endpoint disabled");
  }
  const joined = await a.emit("BOARD_JOIN_ROOM", { create:true, roomCode:"VQA1", profile:a.profile });
  check(joined.ok, "create room");
  const roomCode = joined.lobby.roomCode;
  check((await b.emit("BOARD_JOIN_ROOM", { roomCode, profile:b.profile })).ok, "second player joined");
  check((await a.emit("BOARD_ADD_CPU", { roomCode })).ok, "CPU added before saving");
  check((await a.emit("BOARD_START_GAME", { roomCode })).ok, "new game starts");
  check((await a.emit("BOARD_GAME_STATE", { roomCode, baseVersion:0, version:1, payload:fixture(), reason:"initial" })).ok, "first authoritative snapshot accepted");
  eq((await a.emit("BOARD_CAMPAIGN_SAVE", { roomCode, expectedRevision:0, baseVersion:999 })).error, "state_conflict", "future state rejected without converting room");
  eq((await stranger.emit("BOARD_CAMPAIGN_SAVE", { roomCode, profile:a.profile, expectedRevision:0, baseVersion:1 })).error, "not_joined", "forged profile cannot save another room");
  const first = await b.emit("BOARD_CAMPAIGN_SAVE", { roomCode, profile:b.profile, expectedRevision:0, baseVersion:1, saveKind:"manual", payload:fixture(999) });
  check(first.ok, `non-controller saves team snapshot: ${JSON.stringify(first)}`);
  const id = first.campaignId;
  eq(campaigns.get(id).payload.gameState.round, 1, "client supplied save payload ignored");
  eq((await b.emit("BOARD_GAME_STATE", { roomCode, profile:a.profile, baseVersion:1, version:2, payload:fixture(99), reason:"advance" })).error, "not_your_turn", "forged profile cannot control authenticated teammate's turn");
  eq(campaigns.get(id).members.map((member) => member.userId), [1,2], "all authenticated original humans share same record");
  eq(campaigns.get(id).payload.gameState.pendingMove, { to:3 }, "pending movement preserved");
  eq(campaigns.get(id).payload.battleState.enemy.hp, 17, "battle preserved on first-playthrough save");
  eq((await stranger.emit("BOARD_CAMPAIGN_LIST", { profile:a.profile })).campaigns.length, 0, "stranger cannot list another user's records");
  eq((await stranger.emit("BOARD_CAMPAIGN_OPEN", { campaignId:id, profile:a.profile })).error, "not_campaign_member", "stranger cannot open another user's record");
  eq((await a.emit("BOARD_CAMPAIGN_LIST", {})).campaigns[0].campaignId, id, "A sees same record");
  eq((await b.emit("BOARD_CAMPAIGN_LIST", {})).campaigns[0].campaignId, id, "B sees same record");
  let revision = first.revision, version = 1;
  for(let round = 2; round <= 8; round++){
    check((await a.emit("BOARD_GAME_STATE", { roomCode, baseVersion:version, version:version+1, payload:fixture(round), reason:"load-save" })).ok, "fixture state advanced through authenticated host");
    version++;
    const saved = await a.emit("BOARD_CAMPAIGN_SAVE", { roomCode, baseVersion:version, expectedRevision:revision, saveKind:"auto" });
    check(saved.ok, `automatic checkpoint ${round}`); revision = saved.revision;
  }
  eq(campaigns.get(id).backups.length, 5, "five automatic checkpoints retained");
  eq(campaigns.get(id).manualSave.payload.gameState.round, 1, "last manual checkpoint retained separately");
  eq(campaigns.get(id).backups.map((entry) => entry.payload.gameState.round), [8,7,6,5,4], "backup order and retention");
  const ren = await a.emit("BOARD_CAMPAIGN_SAVE", { action:"rename", campaignId:id, name:"QA 原團", expectedRevision:revision });
  check(ren.ok, "record renamed"); revision = ren.revision;
  const afterRename = await b.emit("BOARD_CAMPAIGN_SAVE", { roomCode, baseVersion:version, expectedRevision:revision });
  check(afterRename.ok, "rename updates live room CAS"); revision = afterRename.revision;
  const original = clone(campaigns.get(id));
  for(const busyKind of ["trade", "spar", "sparBattle"]){
    const busy = clone(original);
    if(busyKind === "trade") busy.payload.gameState.activeTrade = { id:"qa-open-trade", initiatorId:"1", partnerId:"2" };
    if(busyKind === "spar") busy.payload.gameState.activeSpar = { id:"qa-open-spar", participantIds:["1","2"] };
    if(busyKind === "sparBattle") busy.payload.battleState.isSparBattle = true;
    campaigns.set(id, busy);
    const countBefore = campaigns.size;
    eq((await a.emit("BOARD_CAMPAIGN_OPEN", { campaignId:id, mode:"copy" })).error, "copy_flow_busy", `${busyKind} cannot silently discard human negotiation on copy`);
    eq(campaigns.size, countBefore, "busy copy creates no partial record");
    eq(campaigns.get(id), busy, "busy source remains unchanged");
  }
  campaigns.set(id, clone(original));
  const solo = await a.emit("BOARD_CAMPAIGN_OPEN", { campaignId:id, mode:"solo" });
  check(solo.ok && solo.navigate && solo.campaignId !== id, "solo from team creates private independent record");
  eq(campaigns.get(solo.campaignId).members.map((member) => member.userId), [1], "copy membership is private");
  check(campaigns.get(solo.campaignId).payload.gameState.players[1].isProxyCPU, "copy retains absent teammate character with CPU control");
  eq(campaigns.get(id), original, "copy never mutates original world");
  const restored = await a.emit("BOARD_CAMPAIGN_OPEN", { campaignId:id, mode:"copy", backupRevision:original.backups[2].revision });
  check(restored.ok, "backup restores as new record");
  eq(campaigns.get(restored.campaignId).payload.gameState.round, 6, "selected backup has exact world");
  const ga = await a.emit("BOARD_CAMPAIGN_OPEN", { campaignId:id, mode:"gather" });
  check(ga.ok && !ga.navigate, "open team gathering");
  eq((await a.emit("BOARD_START_GAME", { roomCode:ga.roomCode })).error, "campaign_members_missing", "cannot start without original teammate");
  const gb = await b.emit("BOARD_CAMPAIGN_OPEN", { campaignId:id, mode:"gather" });
  eq(gb.roomCode, ga.roomCode, "members join same gathering");
  check((await a.emit("BOARD_LOBBY_READY", { roomCode:ga.roomCode, ready:true })).ok, "host ready");
  eq((await a.emit("BOARD_START_GAME", { roomCode:ga.roomCode })).error, "not_all_ready", "all original members must ready");
  check((await b.emit("BOARD_LOBBY_READY", { roomCode:ga.roomCode, ready:true })).ok, "teammate ready");
  check((await a.emit("BOARD_START_GAME", { roomCode:ga.roomCode })).ok, "gather starts with complete ready roster");
  check((await a.emit("BOARD_JOIN_GAME", { roomCode:ga.roomCode, profile:a.profile })).ok, "joined resumed game");
  const stateEvent = a.events.filter(([name]) => name === "BOARD_GAME_STATE").at(-1);
  check(Boolean(stateEvent), "resumed full state delivered");
  eq(stateEvent[1].payload.gameState.pendingMove, { to:3 }, "gather does not clear pending movement");
  eq(stateEvent[1].payload.battleState.enemy.hp, 17, "gather does not clear battles");
  eq(stateEvent[1].payload.gameState.players[1].coins, 200, "gather restores intact team economics");
  // An unrelated session wins CAS; this room must not overwrite it.
  const competing = clone(campaigns.get(id)); competing.revision++; campaigns.set(id, competing);
  eq((await a.emit("BOARD_CAMPAIGN_SAVE", { roomCode:ga.roomCode, baseVersion:1, expectedRevision:revision })).error, "revision_conflict", "stale room cannot overwrite newer campaign");
  const v1 = { campaignId:"LEGACY_QA", schemaVersion:1, roomName:"舊共有紀錄", members:clone(original.members), memberRecords:{}, basePayload:fixture(15), branchRecords:{ "user-1":{ revision:4, payload:fixture(16) }, "user-2":{ revision:8, payload:fixture(27) } }, shared:{ finalEndingCleared:true } };
  campaigns.set(v1.campaignId, clone(v1));
  const legacyA = await a.emit("BOARD_CAMPAIGN_OPEN", { campaignId:v1.campaignId, mode:"gather" });
  const legacyB = await b.emit("BOARD_CAMPAIGN_OPEN", { campaignId:v1.campaignId, mode:"gather" });
  check(legacyA.ok && legacyB.ok, "legacy whole-world migration opens");
  eq(legacyA.campaignId, legacyB.campaignId, "legacy migration has one stable campaign id");
  eq(legacyA.roomCode, legacyB.roomCode, "legacy members gather together");
  eq(campaigns.get(v1.campaignId), v1, "v1 branches remain byte-equivalent in storage");
  const branchCopy = await b.emit("BOARD_CAMPAIGN_OPEN", { campaignId:v1.campaignId, mode:"copy", legacyBranch:true });
  check(branchCopy.ok, "explicit legacy member branch copy");
  eq(campaigns.get(branchCopy.campaignId).payload.gameState.round, 27, "legacy branch world remains available");
  legacySaves.set("ORIGINAL_QA", fixture(42));
  eq((await stranger.emit("BOARD_CAMPAIGN_SAVE", { action:"importLegacyRoom", roomCode:"ORIGINAL_QA" })).error, "not_save_member", "legacy exact room import checks authenticated membership");
  const imported = await a.emit("BOARD_CAMPAIGN_SAVE", { action:"importLegacyRoom", roomCode:"ORIGINAL_QA" });
  check(imported.ok, "own exact old room imports to private copy");
  eq(campaigns.get(imported.campaignId).members.length, 1, "legacy import only authorizes importer");
  eq(legacySaves.get("ORIGINAL_QA").gameState.round, 42, "old room source remains unchanged");
  check(!sqlLog.some((sql) => sql.includes("from board_saves") && !sql.includes("where room_code=$1")), "no cross-room latest-save query exists");
  eq((await b.emit("BOARD_CAMPAIGN_SAVE", { action:"import", payload:fixture(33) })).ok, true, "local save import becomes private new record");
  eq((await stranger.emit("BOARD_CAMPAIGN_SAVE", { action:"import", payload:fixture(33) })).error, "not_save_member", "local legacy import rejects another account");
  console.log(JSON.stringify({ result:"PASS", assertions, transport:"real HTTP and Socket.IO WebSocket", persistence:"isolated mock PostgreSQL", records:campaigns.size }, null, 2));
}

main().then(() => { clients.forEach((client) => client.socket.close()); process.exit(0); }).catch((error) => { console.error(error); clients.forEach((client) => client.socket.close()); process.exit(1); });
