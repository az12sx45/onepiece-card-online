"use strict";

// Isolated publication gate: never opens the production database or account service.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { validateConfig, createLauncherAnnouncements } = require("../server/launcher-announcements.js");
const { validateAppendOnly } = require("../tools/launcher-room/presentation-v126/validate_release.js");
const { validateCatalog, validateManifest } = require("./desktop_program_package_common.js");

const BASELINE = "2afbda5358257cb6eac12edb957ca93ccd3ee817";
const ROOT = path.resolve(__dirname, "..");
const CONFIG = "config/launcher-announcements-v1.json";
const CATALOG = "public/desktop/catalog-v3.json";
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
const read = name => fs.readFileSync(path.join(ROOT, name));
const json = name => JSON.parse(read(name));
const at = name => JSON.parse(execFileSync("git", ["cat-file", "blob", `${BASELINE}:${name}`], {
  cwd: ROOT, windowsHide: true, maxBuffer: 16 * 1024 * 1024,
}));

async function main(argv = process.argv.slice(2)) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    assert(["--release", "--candidate", "--report"].includes(key) && !options[key], "Invalid or duplicate option");
    assert(argv[i + 1] && !argv[i + 1].startsWith("--"), `Missing ${key} value`);
    options[key] = argv[i + 1];
  }
  assert(options["--release"] && options["--candidate"] && options["--report"], "Require --release, --candidate and --report");
  assert.match(options["--release"], /^package-[a-f0-9]{16}$/);
  const candidate = path.resolve(options["--candidate"]);
  const reportPath = path.resolve(options["--report"]);
  const checks = [];
  const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push(name); };
  const originalConfigSha = hash(read(CONFIG));
  const previous = validateConfig(at(CONFIG));
  const current = validateConfig(json(CONFIG));
  validateAppendOnly(previous, current);
  check("previous eight published notices preserved", [previous.revision, previous.announcements.length,
    previous.announcements.every(item => item.status === "published")], [7, 8, true]);
  check("one append-only revision", [current.revision, current.announcements.length], [8, 9]);
  const previousIds = new Set(previous.announcements.map(item => item.id));
  const added = current.announcements.filter(item => !previousIds.has(item.id));
  check("exactly one new announcement", added.length, 1);
  const note = added[0];
  check("announcement gated by new Board package", [note.scope, note.category, note.status,
    note.version, note.requiredRelease, note.cta], ["board", "update", "published",
    options["--release"], { kind: "board", releaseId: options["--release"] }, { kind: "game", gameId: "board" }]);
  check("announcement timestamp is not in the future", Date.parse(note.publishedAt) <= Date.now(), true);

  const beforeCatalog = validateCatalog(at(CATALOG));
  const catalog = validateCatalog(json(CATALOG));
  check("catalog changes only Board identity", [catalog.games.card, catalog.games.chess,
    catalog.games.board.releaseId], [beforeCatalog.games.card, beforeCatalog.games.chess, options["--release"]]);
  const manifestBytes = read(`public/${catalog.games.board.manifestPath}`);
  check("promoted manifest SHA", hash(manifestBytes), catalog.games.board.manifestSha256);
  const manifest = validateManifest(JSON.parse(manifestBytes), "board");
  check("promoted manifest identity", [manifest.releaseId, manifest.totalFiles], [options["--release"], 6396]);
  check("candidate catalog bytes", hash(fs.readFileSync(path.join(candidate, "desktop/catalog-v3.json"))), hash(read(CATALOG)));
  check("candidate manifest bytes", hash(fs.readFileSync(path.join(candidate, catalog.games.board.manifestPath))), hash(manifestBytes));

  const { PGlite } = require(process.env.BOARD_QA_PGLITE || "@electric-sql/pglite");
  const db = new PGlite();
  try {
    await db.exec("CREATE TABLE player_profiles(user_id BIGSERIAL PRIMARY KEY, secret TEXT UNIQUE NOT NULL, stats JSONB)");
    await db.query("INSERT INTO player_profiles(secret,stats) VALUES($1,$3::jsonb),($2,$3::jsonb)",
      ["tavern-captain-fixture-a", "tavern-captain-fixture-b", JSON.stringify({ fixtureOnly: true })]);
    const pool = { query: (...args) => db.query(...args) };
    let mode = "old";
    const verifyRelease = async kind => {
      if (kind === "launcher") return { ok: true, kind, version: "1.2.10" };
      assert.equal(kind, "board");
      if (mode === "offline") throw new Error("isolated verifier unavailable");
      if (mode === "old") return { ok: true, kind, releaseId: beforeCatalog.games.board.releaseId,
        manifestSha256: beforeCatalog.games.board.manifestSha256 };
      return { ok: true, kind, releaseId: catalog.games.board.releaseId,
        manifestSha256: mode === "bad-sha" ? "" : catalog.games.board.manifestSha256 };
    };
    const api = createLauncherAnnouncements({ config: current, verifyRelease });
    const get = secret => api.get(pool, secret, { scope: "board" }, { crewContentRevision: 1 });
    const has = result => result.announcements.some(item => item.id === note.id);
    check("unrecognized account rejected", (await get("invalid-secret")).error, "bad secret");
    check("old Board runtime hides new notice", has(await get("tavern-captain-fixture-a")), false);
    mode = "bad-sha";
    check("package without verified manifest hides notice", has(await get("tavern-captain-fixture-a")), false);
    mode = "current";
    const shown = await get("tavern-captain-fixture-a");
    check("verified package shows one matching notice", shown.announcements.filter(item => item.id === note.id).length, 1);
    const publicNote = shown.announcements.find(item => item.id === note.id);
    check("public note points into Board", [publicNote.releaseId, publicNote.cta],
      [options["--release"], { kind: "game", gameId: "board" }]);
    check("private release-gate fields not exposed", ["status", "requiredRelease", "contentSha256"]
      .some(field => field in publicNote), false);
    check("fixture A marks notice read", (await api.read(pool, "tavern-captain-fixture-a",
      { announcementId: note.id }, { crewContentRevision: 1 })).ok, true);
    check("fixture B remains unread", (await get("tavern-captain-fixture-b")).readIds.includes(note.id), false);
    mode = "offline";
    check("published witness survives verifier outage", has(await get("tavern-captain-fixture-a")), true);
    check("announcement source unchanged by QA", hash(read(CONFIG)), originalConfigSha);
  } finally { await db.close(); }

  const report = { ok: true, scope: "Isolated local PGlite fixture, not a public account or production DB test",
    baseline: BASELINE, releaseId: options["--release"], announcementId: note.id,
    candidate, checks, count: checks.length, configSha256: originalConfigSha,
    catalogSha256: hash(read(CATALOG)), manifestSha256: hash(manifestBytes) };
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, count: checks.length, report: reportPath }));
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 1; });
