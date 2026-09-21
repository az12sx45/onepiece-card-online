"use strict";

// Promote the reviewed, frozen Board candidate only after every input exists in
// committed Git HEAD. Does not upload, push, rebuild legacy media or alter saves.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { validateOutput } = require("./build_board_move_fx_release_candidate");
const { validateConfig } = require("./build_desktop_program_catalog");
const { canonicalJson, sha256Bytes, validateCatalog, validateManifest } = require("./desktop_program_package_common");
const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const git = (args) => execFileSync("git", args, { cwd: ROOT, windowsHide: true, maxBuffer: 128 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
const parse = (bytes) => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
const readHead = (name) => git(["cat-file", "blob", `HEAD:${name}`]);
const readAt = (ref, name) => git(["cat-file", "blob", `${ref}:${name}`]);

function verify(candidatePath) {
  const directory = validateOutput(candidatePath);
  const inputs = parse(fs.readFileSync(path.join(directory, "release-inputs.json")));
  assert.equal(inputs.generator, "board-move-fx-release-candidate-v1");
  assert.equal(inputs.candidateOnly, true);
  assert.match(inputs.baselineHEAD, /^[a-f0-9]{40}$/);
  git(["merge-base", "--is-ancestor", inputs.baselineHEAD, "HEAD"]);
  const head = git(["rev-parse", "HEAD"]).toString("utf8").trim();
  const baselineBytes = readAt(inputs.baselineHEAD, "public/desktop/catalog-v3.json");
  assert.equal(sha256Bytes(baselineBytes), inputs.baselineCatalog.sha256, "Frozen baseline catalog");
  const baseline = validateCatalog(parse(baselineBytes));
  const baselineManifestBytes = readAt(inputs.baselineHEAD, `public/${baseline.games.board.manifestPath}`);
  assert.equal(sha256Bytes(baselineManifestBytes), baseline.games.board.manifestSha256);
  assert.equal(sha256Bytes(baselineManifestBytes), inputs.baselineBoardManifest.sha256);
  const oldManifest = validateManifest(parse(baselineManifestBytes), "board");
  assert.equal(oldManifest.releaseId, inputs.baseDeployedBoardRelease);
  const catalogBytes = fs.readFileSync(path.join(directory, "desktop/catalog-v3.json"));
  const catalog = validateCatalog(parse(catalogBytes));
  assert.ok(catalogBytes.equals(Buffer.from(canonicalJson(catalog))), "Canonical candidate catalog");
  const manifestPath = catalog.games.board.manifestPath;
  const manifestBytes = fs.readFileSync(path.join(directory, manifestPath));
  assert.equal(sha256Bytes(manifestBytes), catalog.games.board.manifestSha256);
  const manifest = validateManifest(parse(manifestBytes), "board");
  assert.ok(manifestBytes.equals(Buffer.from(canonicalJson(manifest))), "Canonical candidate manifest");
  assert.deepEqual(catalog.games.board, { releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(manifestBytes), entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes });
  for (const id of ["card", "chess"]) assert.deepEqual(catalog.games[id], baseline.games[id], `${id} unchanged`);
  assert.deepEqual(catalog.sourceTrees, baseline.sourceTrees);
  assert.equal(catalog.assetBlobBaseUrl, baseline.assetBlobBaseUrl);
  assert.deepEqual(catalog.games.board, Object.fromEntries(Object.keys(catalog.games.board).map(key => [key, inputs.candidate[key]])));

  const config = validateConfig(parse(readHead("config/desktop-program-packages-v1.json")));
  assert.deepEqual(config, parse(fs.readFileSync(path.join(ROOT, "config/desktop-program-packages-v1.json"))), "No uncommitted config changes");
  const programs = config.games.board.programFiles;
  assert.equal(programs.length, 39);
  assert.deepEqual(inputs.programs.map(item => item.path), programs);
  assert.equal(inputs.media.length, 589);
  assert.equal(inputs.media.filter(item => item.kind === "image").length, 102);
  assert.equal(inputs.media.filter(item => item.kind === "audio").length, 487);
  const registry = fs.readFileSync(path.join(ROOT, "scripts/data/board_move_fx_v1.json"));
  assert.equal(sha256Bytes(registry), inputs.frozenRegistry.sha256);
  assert.deepEqual(parse(readHead("scripts/data/board_move_fx_v1.json")), parse(registry));
  const replacements = new Map([...inputs.programs, ...inputs.media].map(item => [item.path, item]));
  assert.equal(replacements.size, 628);
  const assets = new Map(manifest.assets.map(item => [item.path, item]));
  assert.equal(manifest.totalFiles, oldManifest.totalFiles + 591);
  assert.deepEqual(manifest.assets.filter(item => !oldManifest.assets.some(old => old.path === item.path)).map(item => item.path), inputs.addedPaths);
  let checkedBytes = 0;
  for (const [relative, expected] of replacements) {
    const asset = assets.get(relative);
    assert.ok(asset, `Candidate missing ${relative}`);
    for (const key of ["kind", "mime", "size", "sha256"]) assert.equal(asset[key], expected[key], `${relative} ${key}`);
    const bytes = readHead(`public/${relative}`);
    assert.equal(bytes.length, expected.size, `Committed size: ${relative}`);
    assert.equal(sha256Bytes(bytes), expected.sha256, `Committed SHA: ${relative}`);
    checkedBytes += bytes.length;
  }
  for (const old of oldManifest.assets) {
    if (!replacements.has(old.path)) assert.deepEqual(assets.get(old.path), old, `Retained ${old.path}`);
  }
  const changed = manifest.assets.filter(item => {
    const old = oldManifest.assets.find(entry => entry.path === item.path);
    return old && canonicalJson(item) !== canonicalJson(old);
  }).map(item => item.path);
  assert.deepEqual(changed, ["board_battle.html", "board_game.html", "js/board_battle.js", "js/board_game.js"]);
  const currentBytes = fs.readFileSync(path.join(PUBLIC, "desktop/catalog-v3.json"));
  assert.ok(currentBytes.equals(baselineBytes) || currentBytes.equals(catalogBytes), "Public catalog changed outside this release");
  const legacyBytes = readAt(inputs.baselineHEAD, "public/desktop/catalog-v2.json");
  assert.ok(fs.readFileSync(path.join(PUBLIC, "desktop/catalog-v2.json")).equals(legacyBytes), "Legacy v2 unchanged");
  assert.equal(git(["rev-parse", "HEAD"]).toString("utf8").trim(), head, "HEAD stable during verification");
  return { head, catalog, manifestPath, manifestBytes, catalogBytes, checkedBytes };
}

function main(argv = process.argv.slice(2)) {
  assert.ok(argv.length === 2 || argv.length === 3, "Usage: --candidate <absolute work/release-candidate> [--promote]");
  assert.equal(argv[0], "--candidate");
  if (argv.length === 3) assert.equal(argv[2], "--promote");
  const result = verify(argv[1]);
  if (argv.includes("--promote")) {
    const destination = path.join(PUBLIC, result.manifestPath);
    if (fs.existsSync(destination)) assert.ok(fs.readFileSync(destination).equals(result.manifestBytes), "Immutable manifest exists with different bytes");
    else fs.writeFileSync(destination, result.manifestBytes, { flag: "wx" });
    const catalogPath = path.join(PUBLIC, "desktop/catalog-v3.json");
    const temporary = `${catalogPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, result.catalogBytes, { flag: "wx" });
    fs.renameSync(temporary, catalogPath);
    assert.ok(fs.readFileSync(destination).equals(result.manifestBytes));
    assert.ok(fs.readFileSync(catalogPath).equals(result.catalogBytes));
  }
  console.log(JSON.stringify({ ok: true, promoted: argv.includes("--promote"), head: result.head, board: result.catalog.games.board, checkedPrograms: 39, checkedMedia: 589, checkedBytes: result.checkedBytes, cardChessAndLegacyUnchanged: true }));
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; } }
module.exports = { verify, main };
