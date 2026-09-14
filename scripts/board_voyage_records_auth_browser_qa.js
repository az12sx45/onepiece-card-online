"use strict";

// Real Chrome and unchanged application handlers with a private mock PostgreSQL.
// Only this isolated fixture delays SOCIAL_AUTH packets; production is untouched.
const path = require("node:path");
const fs = require("node:fs/promises");
const assert = require("node:assert/strict");
const { fork } = require("node:child_process");
const PORT = Number(process.env.BOARD_VOYAGE_AUTH_QA_PORT || 18916);
const BASE = `http://127.0.0.1:${PORT}`;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const clone = value => JSON.parse(JSON.stringify(value));

function startFixture() {
  const campaigns = new Map();
  const profiles = new Map([1, 2, 3].map(id => [id, { user_id: id, secret: `qa-voyage-auth-${id}`, name: `正式分支測試${id}`, avatar: id, stats: { client: { social: { friends: [], friend_in: [], friend_out: [] }, totals: { coins: 1234 } } } }]));
  const result = rows => ({ rows: clone(rows), rowCount: rows.length });
  const pool = { async query(sql, params = []) {
    const s = String(sql).replace(/\s+/g, " ").trim().toLowerCase();
    if (/^(create|alter)/.test(s)) return result([]);
    if (s === "select now() as now") return result([{ now: new Date().toISOString() }]);
    if (s.includes("from player_profiles where secret=$1")) return result([...profiles.values()].filter(p => p.secret === params[0]));
    if (/from player_profiles where user_id\s*=\s*\$1/.test(s)) return result(profiles.has(Number(params[0])) ? [profiles.get(Number(params[0]))] : []);
    if (s.includes("from player_profiles where user_id = any")) return result(params[0].map(id => profiles.get(Number(id))).filter(Boolean));
    if (s.startsWith("insert into board_campaigns")) {
      assert(s.includes("where $4::bigint") && s.includes("returning campaign_id"), "Fixture requires production SQL CAS");
      const [id, payload, , expected] = params;
      const previous = campaigns.get(id);
      if (previous && (Number(expected) < 0 || Number(previous.revision || 0) !== Number(expected))) return result([]);
      campaigns.set(id, clone(payload));
      return result([{ campaign_id: id }]);
    }
    if (s.startsWith("select payload from board_campaigns where campaign_id")) return result(campaigns.has(params[0]) ? [{ payload: campaigns.get(params[0]) }] : []);
    if (s.startsWith("select payload from board_campaigns where exists")) {
      assert(s.includes("jsonb_array_elements") && s.includes("member->>'userid'=$1"), "Fixture requires membership-scoped SQL");
      return result([...campaigns.values()].filter(payload => payload.members.some(member => String(member.userId) === params[0])).map(payload => ({ payload })));
    }
    if (s.startsWith("select payload from board_campaigns order by updated_at")) throw new Error("unscoped_campaign_list_query");
    if (s.startsWith("update player_profiles set stats=$1 where user_id=$2")) { profiles.get(Number(params[1])).stats = clone(params[0]); return result([]); }
    return result([]);
  } };
  const dbPath = require.resolve(path.join(__dirname, "..", "server", "db.js"));
  require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool } };
  const socketModule = require("socket.io");
  class ObservedServer extends socketModule.Server {
    constructor(...args) {
      super(...args);
      this.on("connection", socket => {
        let acceptedAuthAt = 0;
        socket.use((packet, next) => {
          const event = packet[0];
          if (event === "SOCIAL_AUTH") {
            const receivedAt = Date.now();
            const callback = packet[packet.length - 1];
            if (typeof callback === "function") packet[packet.length - 1] = response => {
              if (response?.ok) acceptedAuthAt = Date.now();
              process.send?.({ kind: "authAck", socketId: socket.id, receivedAt, ackAt: Date.now(), ok: Boolean(response?.ok), delayMs: 400 });
              callback(response);
            };
            setTimeout(next, 400);
            return;
          }
          if (["PROFILE_GET", "BOARD_JOIN_ROOM", "BOARD_JOIN_GAME", "BOARD_CAMPAIGN_SAVE", "BOARD_CAMPAIGN_LIST", "BOARD_CAMPAIGN_OPEN"].includes(event)) {
            process.send?.({ kind: "packet", event, socketId: socket.id, at: Date.now(), acceptedAuthAt, authenticatedBeforeDispatch: acceptedAuthAt > 0 });
          }
          next();
        });
      });
    }
  }
  require.cache[require.resolve("socket.io")].exports = { ...socketModule, Server: ObservedServer };
  process.env.DATABASE_URL = "postgresql://voyage-auth-browser.invalid/isolated-mock";
  process.env.PORT = String(PORT);
  require("../server/index.js");
}

async function main() {
  const runTag = Date.now().toString(36);
  const output = process.env.BOARD_VOYAGE_AUTH_QA_OUTPUT || `D:/Codex_QA/board-voyage-records-20260914/auth-browser/${runTag}`;
  await fs.mkdir(output, { recursive: true });
  const report = { startedAt: new Date().toISOString(), base: BASE, checks: [], errors: [], observations: [], fixture: "Private in-memory PostgreSQL fixture, three fixed synthetic profiles/secrets, real PROFILE_GET/SOCIAL_AUTH and Board handlers. Socket.IO fixture middleware delays each SOCIAL_AUTH packet by 400 ms. Main phase/round 12 and existing crew/item fields use the existing explicit browser fixture; not a natural playthrough." };
  const check = (label, condition, detail) => { report.checks.push({ label, ok: Boolean(condition), detail }); console.log(`${condition ? "PASS" : "FAIL"} ${label}`); assert(condition, label); };
  const child = fork(__filename, ["--fixture-server"], { cwd: path.resolve(__dirname, ".."), windowsHide: true, env: { ...process.env, NODE_PATH: process.env.NODE_PATH || "D:/Codex_Release_Worktrees/battle-chess-launcher-v1/node_modules", BOARD_VOYAGE_AUTH_QA_PORT: String(PORT) }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
  const serverOutput = [];
  child.stdout.on("data", data => serverOutput.push(data.toString()));
  child.stderr.on("data", data => serverOutput.push(data.toString()));
  child.on("message", message => report.observations.push(message));
  process.env.BOARD_QA_URL = BASE;
  const helpers = require("./board_voyage_records_browser_qa.js");
  const { chromium } = require(process.env.BOARD_QA_PLAYWRIGHT || "C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
  let browser;
  const devices = [];
  try {
    let runtime;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { runtime = await (await fetch(`${BASE}/api/board-runtime`, { signal: AbortSignal.timeout(1000) })).json(); break; } catch (_) { await delay(200); }
    }
    check("fixture enables production account database branch", runtime?.accountDatabaseEnabled === true, runtime);
    browser = await chromium.launch({ headless: true, executablePath: process.env.BOARD_QA_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe" });
    async function create(id) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      await context.addInitScript(({ id, runTag }) => {
        localStorage.setItem("opSecret", `qa-voyage-auth-${id}`);
        localStorage.setItem("op_secret", `qa-voyage-auth-${id}`);
        localStorage.setItem("op_board_client_id", `auth-browser-${runTag}-${id}`);
        localStorage.setItem("op_device_id", `auth-browser-device-${runTag}-${id}`);
        if (location.pathname.endsWith("/board_game.html")) { const url = new URL(location.href); url.searchParams.set("skipOpeningStory", "1"); history.replaceState(null, "", url.href); }
      }, { id, runTag });
      const page = await context.newPage();
      page.on("pageerror", error => report.errors.push(`${id}: ${error.message}`));
      page.on("console", message => { if (message.type() === "error" && !message.text().startsWith("Failed to load resource:")) report.errors.push(`${id}: ${message.text()}`); });
      await page.goto(`${BASE}/board_start.html?qa-auth=${runTag}`, { waitUntil: "domcontentloaded" });
      await page.waitForFunction(() => document.body.dataset.entryStage === "press", null, { timeout: 15000 });
      await page.click("#boardEntryStartBtn");
      await page.waitForFunction(() => document.body.dataset.entryStage === "app" && window.BoardShared?.getState()?.socialReady, null, { timeout: 20000 });
      const profile = await page.evaluate(() => ({ ...window.BoardShared.getState().profile, source: document.body.dataset.entryAuthSource }));
      check(`account ${id} loads through formal profile authentication`, profile.source === "same-origin" && Number(profile.userId) === id, profile);
      const device = { label: String(id), userId: id, name: profile.name, page, context };
      devices.push(device); return device;
    }
    const a = await create(1); const b = await create(2); const c = await create(3);
    report.roomCode = await helpers.startPair(a, b);
    await helpers.prepareFirstCycle(a, 12);
    await helpers.waitRound(b, 12);
    const saved = await helpers.saveThroughUi(b);
    report.campaignId = saved.campaignId;
    const records = await Promise.all([a, b, c].map(helpers.listRecords));
    check("formal members list same first-cycle save", records[0].some(r => r.campaignId === saved.campaignId) && records[1].some(r => r.campaignId === saved.campaignId), records.map(rows => rows.map(r => ({ campaignId: r.campaignId, revision: r.revision }))));
    check("formal unrelated account cannot list save", !records[2].some(r => r.campaignId === saved.campaignId));
    await b.page.reload({ waitUntil: "domcontentloaded" }); await helpers.waitForGame(b);
    const resumed = await helpers.snapshot(b);
    check("formal guest refresh recovers authenticated seat and current snapshot", resumed.round === 12 && resumed.players.some(p => p.userId === 2) && Number(await b.page.evaluate(() => window.__BOARD_GAME_DEBUG__.getLocalBoardPlayer()?.userId)) === 2, resumed);
    await Promise.all([a, b].map(helpers.goRecords));
    await helpers.recordCard(a, saved.campaignId).locator("[data-campaign-continue]").click();
    await helpers.recordCard(b, saved.campaignId).locator("[data-campaign-continue]").click();
    await Promise.all([a, b].map(d => d.page.waitForFunction(() => document.querySelector('section[data-view="lobby"]')?.classList.contains("active"))));
    await a.page.click("#boardReadyBtn"); await b.page.click("#boardReadyBtn"); await a.page.click("#boardStartBtn");
    await Promise.all([a, b].map(helpers.waitForGame));
    const assembled = await Promise.all([a, b].map(helpers.snapshot));
    check("formal authenticated gathering continues the same record", assembled.every(s => s.context.campaignId === saved.campaignId && s.round === 12), assembled);
    await b.page.screenshot({ path: path.join(output, "formal-gather-restored.png") });
    const authAcks = report.observations.filter(o => o.kind === "authAck" && o.ok);
    const gameJoins = report.observations.filter(o => o.kind === "packet" && o.event === "BOARD_JOIN_GAME");
    check("delayed authentication exercised across new page sockets", authAcks.length >= 8 && authAcks.every(o => o.ackAt - o.receivedAt >= 390), { authAcks: authAcks.length, delays: authAcks.map(o => o.ackAt - o.receivedAt) });
    check("every game join dispatch follows successful delayed SOCIAL_AUTH", gameJoins.length >= 5 && gameJoins.every(o => o.authenticatedBeforeDispatch && o.at >= o.acceptedAuthAt), gameJoins);
    check("no auth race or unexpected browser errors", report.errors.length === 0, report.errors);
    report.ok = true;
  } catch (error) {
    report.ok = false; report.failure = error.stack; report.diagnostics = [];
    for (const device of devices) {
      report.diagnostics.push({ label: device.label, url: device.page.url(), text: await device.page.locator("body").innerText().catch(() => "unavailable") });
      await device.page.screenshot({ path: path.join(output, `failure-${device.label}.png`), fullPage: true }).catch(() => {});
    }
  } finally {
    await Promise.all(devices.map(d => d.context.close()));
    if (browser) await browser.close();
    child.kill();
    report.finishedAt = new Date().toISOString();
    await fs.writeFile(path.join(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    await fs.writeFile(path.join(output, "fixture-server.log"), serverOutput.join(""));
  }
  console.log(JSON.stringify({ ok: report.ok, checks: report.checks.length, errors: report.errors, failure: report.failure, report: path.join(output, "report.json") }, null, 2));
  process.exitCode = report.ok ? 0 : 1;
}

if (process.argv.includes("--fixture-server")) startFixture();
else main().catch(error => { console.error(error); process.exitCode = 1; });
