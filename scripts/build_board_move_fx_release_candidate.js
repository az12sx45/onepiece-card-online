"use strict";

// Local review candidate only. No network, Git writes, or public/desktop writes.
// A formal release must rebuild/recheck these inputs against committed Git HEAD.
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { TextDecoder } = require("node:util");
const assert = require("node:assert/strict");
const { buildManifest, validateConfig } = require("./build_desktop_program_catalog");
const { canonicalJson, sha256Bytes, classifyPath, comparePaths, validateManifest, validateCatalog } = require("./desktop_program_package_common");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC = path.join(ROOT, "public");
const TOOL = "board-move-fx-release-candidate-v1";
const NEW_SCRIPTS = ["js/board_move_fx.js", "js/board_move_fx_catalog.js"];
const CHANGED_PROGRAMS = ["board_battle.html", "board_game.html", "js/board_battle.js", "js/board_game.js"];
const IMAGE_PREFIX = "images/board/battle/move-fx/v1/";
const AUDIO_PREFIX = "audio/board_game/move-fx/v1/";
const git = (args) => execFileSync("git", args, { cwd: ROOT, maxBuffer: 128 * 1024 * 1024, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
const fail = (message) => { throw new Error(message); };
const json = (bytes) => JSON.parse(bytes.toString("utf8").replace(/^\uFEFF/, ""));
const within = (parent, target) => { const relative = path.relative(parent, target); return !relative || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)); };

function rejectLinks(target) {
  for (let cursor = target; ; cursor = path.dirname(cursor)) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) fail(`Links/junctions are not accepted: ${cursor}`);
    if (path.dirname(cursor) === cursor) break;
  }
}

function validateOutput(value) {
  if (!value || !path.isAbsolute(value)) fail("--output requires an explicit absolute projectless work/release-candidate directory.");
  const output = path.resolve(value);
  if (within(ROOT, output) || within(output, ROOT)) fail("Candidate output must be outside the repository.");
  if (path.basename(output) !== "release-candidate" || path.basename(path.dirname(output)) !== "work") fail("Output must be named work/release-candidate.");
  rejectLinks(output);
  if (fs.existsSync(output) && !fs.statSync(output).isDirectory()) fail("Output is not a directory.");
  return output;
}

function sourceBytes(relative) {
  if (!classifyPath(relative)) fail(`Unsafe source path: ${relative}`);
  const filename = path.resolve(PUBLIC, relative);
  if (!within(PUBLIC, filename)) fail(`Source escaped public: ${relative}`);
  rejectLinks(filename);
  if (!fs.statSync(filename).isFile()) fail(`Source is not a regular file: ${relative}`);
  const bytes = fs.readFileSync(filename);
  if (!bytes.length) fail(`Source is empty: ${relative}`);
  return bytes;
}

function record(relative, bytes) {
  const type = classifyPath(relative);
  if (!type) fail(`Unsupported candidate path: ${relative}`);
  return { path: relative, kind: type.kind, mime: type.mime, size: bytes.length, sha256: sha256Bytes(bytes) };
}

function normalizedText(bytes) {
  const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(bytes);
  if (text.includes("\0") || /\r(?!\n)/.test(text)) fail("Program source is binary or contains unsupported lone CR characters.");
  return Buffer.from(text.replace(/\r\n/g, "\n"), "utf8");
}

function checkGitTextRules(programs) {
  if (git(["config", "--get", "core.autocrlf"]).toString("utf8").trim() !== "true") fail("This candidate requires the reviewed core.autocrlf=true checkout rule.");
  const checked = git(["check-attr", "-z", "text", "eol", "filter", "working-tree-encoding", "--", ...programs.map((p) => `public/${p}`)]).toString("utf8").split("\0");
  const attributes = [];
  for (let i = 0; i + 2 < checked.length; i += 3) {
    const [filename, attribute, value] = checked.slice(i, i + 3);
    const allowed = attribute === "text" ? ["unspecified", "set", "auto"] : attribute === "eol" ? ["unspecified", "lf", "crlf"] : ["unspecified", "unset"];
    if (!allowed.includes(value)) fail(`Unreviewed Git clean rule: ${filename} ${attribute}=${value}`);
    attributes.push({ path: filename, attribute, value });
  }
  return { coreAutocrlf: true, policy: "LF for new/changed UTF-8 programs; unchanged content retains SHA-verified deployed HEAD bytes", attributes };
}

function collectMedia(frozen) {
  assert.equal(Object.keys(frozen.families).length, 102, "Expected 102 frozen art families");
  const images = new Set();
  const audio = new Set();
  for (const family of Object.values(frozen.families)) {
    if (!/^images\/board\/battle\/move-fx\/v1\/[\w.-]+\.webp$/.test(family.sheet)) fail(`Unexpected atlas path: ${family.sheet}`);
    images.add(family.sheet);
  }
  for (const [id, profile] of [...Object.entries(frozen.moves), ...frozen.variants.map((v) => [v.moveId, v.profile])]) {
    if (!frozen.families[profile.art]) fail(`Unknown family in ${id}`);
    for (const phase of ["sound", "castSound"]) {
      const source = profile[phase];
      if (source === "") continue;
      if (typeof source !== "string" || !/^audio\/board_game\/move-fx\/v1\/[\w.-]+\.ogg$/.test(source)) fail(`Unexpected ${phase} path in ${id}`);
      audio.add(source);
    }
  }
  assert.equal(images.size, 102, "Expected 102 distinct referenced images");
  assert.equal(audio.size, 487, "Expected 487 distinct referenced OGGs");
  for (const [prefix, expected, extension] of [[IMAGE_PREFIX, images, ".webp"], [AUDIO_PREFIX, audio, ".ogg"]]) {
    const actual = fs.readdirSync(path.join(PUBLIC, prefix)).filter((name) => name.endsWith(extension)).map((name) => prefix + name).sort(comparePaths);
    assert.deepEqual(actual, [...expected].sort(comparePaths), `Referenced media and output folder disagree: ${prefix}`);
  }
  return [...images, ...audio].sort(comparePaths);
}

function buildCandidate() {
  const baselineHEAD = git(["rev-parse", "HEAD"]).toString("utf8").trim();
  const catalogBytes = sourceBytes("desktop/catalog-v3.json");
  const catalog = validateCatalog(json(catalogBytes));
  const cardManifestBytes = sourceBytes(catalog.games.card.manifestPath);
  assert.equal(sha256Bytes(cardManifestBytes), catalog.games.card.manifestSha256, "Unchanged Card manifest digest");
  const cardManifest = validateManifest(json(cardManifestBytes), "card");
  const baselineBytes = sourceBytes(catalog.games.board.manifestPath);
  assert.equal(sha256Bytes(baselineBytes), catalog.games.board.manifestSha256, "Baseline Board manifest digest");
  const baseline = validateManifest(json(baselineBytes), "board");
  for (const key of ["releaseId", "entryPath", "totalFiles", "totalBytes"]) assert.equal(baseline[key], catalog.games.board[key], `Baseline ${key}`);
  const configBytes = fs.readFileSync(path.join(ROOT, "config/desktop-program-packages-v1.json"));
  const config = validateConfig(json(configBytes));
  const programs = config.games.board.programFiles;
  assert.equal(programs.length, 39, "Expected reviewed 39-program whitelist");
  NEW_SCRIPTS.forEach((p) => assert.ok(programs.includes(p), `Missing new script ${p}`));
  const textRules = checkGitTextRules(programs);
  const frozenBytes = fs.readFileSync(path.join(ROOT, "scripts/data/board_move_fx_v1.json"));
  const frozen = json(frozenBytes);
  const publicCatalog = sourceBytes("js/board_move_fx_catalog.js").toString("utf8");
  const match = publicCatalog.match(/window\.BoardMoveFxCatalog\s*=\s*([\s\S]*);\s*$/);
  if (!match) fail("Generated runtime catalog assignment is missing.");
  const expectedCatalog = { version: 1, assetVersion: "20260921-v1", families: frozen.families, moves: frozen.moves, variants: frozen.variants, aliases: frozen.aliases };
  assert.deepEqual(JSON.parse(match[1]), expectedCatalog, "Runtime catalog differs from frozen registry");
  const mediaPaths = collectMedia(frozen);
  const old = new Map(baseline.assets.map((asset) => [asset.path, asset]));
  const replacement = new Map();
  const programBytes = new Map();
  const programInputs = [];
  for (const relative of programs) {
    const raw = sourceBytes(relative);
    const normalized = normalizedText(raw);
    const existing = old.get(relative);
    let selected = normalized;
    let mode = "new-working-tree-normalized-LF";
    if (existing) {
      const head = git(["cat-file", "blob", `HEAD:public/${relative}`]);
      assert.equal(sha256Bytes(head), existing.sha256, `HEAD disagrees with deployed baseline for ${relative}`);
      assert.equal(head.length, existing.size, `HEAD size differs for ${relative}`);
      if (normalized.equals(normalizedText(head))) { selected = head; mode = "unchanged-content-preserve-baseline-HEAD-bytes"; }
      else mode = "changed-working-tree-normalized-LF";
    }
    const asset = record(relative, selected);
    replacement.set(relative, asset);
    programBytes.set(relative, selected);
    programInputs.push({ ...asset, source: mode, rawWorkingTree: { size: raw.length, sha256: sha256Bytes(raw) }, candidateBytes: `program-bytes/${relative}` });
  }
  const media = mediaPaths.map((relative) => record(relative, sourceBytes(relative)));
  media.forEach((asset) => replacement.set(asset.path, asset));
  const retained = baseline.assets.filter((asset) => !replacement.has(asset.path));
  const manifest = validateManifest(buildManifest("board", config.games.board.entryPath, new Date().toISOString(), retained, [...replacement.values()]), "board");
  const next = new Map(manifest.assets.map((asset) => [asset.path, asset]));
  const added = manifest.assets.filter((asset) => !old.has(asset.path)).map((asset) => asset.path);
  const changed = manifest.assets.filter((asset) => old.has(asset.path) && JSON.stringify(old.get(asset.path)) !== JSON.stringify(asset)).map((asset) => asset.path);
  assert.deepEqual(added, [...NEW_SCRIPTS, ...mediaPaths].sort(comparePaths), "Only the 591 reviewed paths may be added");
  assert.deepEqual(changed, CHANGED_PROGRAMS, "Unexpected existing program content change");
  assert.equal(manifest.totalFiles, baseline.totalFiles + 591, "Candidate file count");
  const rankAssets = cardManifest.assets.filter((asset) => asset.path.startsWith("images/ranks/"));
  assert.ok(rankAssets.length > 0, "Baseline rank records were not found");
  retained.forEach((asset) => assert.deepEqual(next.get(asset.path), asset, `Unrelated baseline changed: ${asset.path}`));
  // Rank art belongs to Card, not Board. The exact original Card manifest stays
  // referenced; dirty local rank images are never read as candidate inputs.
  assert.ok(!manifest.assets.some((asset) => asset.path.startsWith("images/ranks/")), "Rank art unexpectedly entered Board candidate");
  replacement.forEach((asset) => assert.deepEqual(next.get(asset.path), asset, `Missing candidate input: ${asset.path}`));
  const manifestPath = `desktop/manifests/board-${manifest.releaseId}.json`;
  const manifestBytes = Buffer.from(canonicalJson(manifest));
  const candidateCatalog = { ...catalog, createdAt: manifest.createdAt, games: { ...catalog.games, board: { releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(manifestBytes), entryPath: manifest.entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes } } };
  validateCatalog(candidateCatalog);
  ["card", "chess"].forEach((game) => assert.deepEqual(candidateCatalog.games[game], catalog.games[game], `${game} record changed`));
  // Refuse a candidate assembled while a source changes underneath this read.
  programInputs.forEach((input) => assert.equal(sha256Bytes(sourceBytes(input.path)), input.rawWorkingTree.sha256, `Program changed during candidate build: ${input.path}`));
  media.forEach((input) => assert.equal(sha256Bytes(sourceBytes(input.path)), input.sha256, `Media changed during candidate build: ${input.path}`));
  assert.equal(sha256Bytes(sourceBytes("desktop/catalog-v3.json")), sha256Bytes(catalogBytes), "Baseline catalog changed during build");
  assert.equal(sha256Bytes(sourceBytes(catalog.games.board.manifestPath)), sha256Bytes(baselineBytes), "Baseline Board manifest changed during build");
  assert.equal(sha256Bytes(sourceBytes(catalog.games.card.manifestPath)), sha256Bytes(cardManifestBytes), "Unrelated Card/rank manifest changed during build");
  assert.equal(sha256Bytes(fs.readFileSync(path.join(ROOT, "config/desktop-program-packages-v1.json"))), sha256Bytes(configBytes), "Program whitelist changed during build");
  assert.equal(sha256Bytes(fs.readFileSync(path.join(ROOT, "scripts/data/board_move_fx_v1.json"))), sha256Bytes(frozenBytes), "Frozen registry changed during build");
  assert.equal(git(["rev-parse", "HEAD"]).toString("utf8").trim(), baselineHEAD, "HEAD changed during build");
  const inputs = {
    generator: TOOL, candidateOnly: true, sourceState: "working-tree-uncommitted", publishReady: false,
    requiredBeforePublication: "Commit reviewed sources, rebuild/compare Git HEAD bytes, then run authorized R2 and public-runtime verification. This candidate is not a deployed release.",
    baselineHEAD, baseDeployedBoardRelease: baseline.releaseId,
    baselineIdentitySource: "Existing local public/desktop/catalog-v3.json; no network verification performed by this tool",
    baselineCatalog: { path: "public/desktop/catalog-v3.json", sha256: sha256Bytes(catalogBytes) },
    baselineBoardManifest: { path: `public/${catalog.games.board.manifestPath}`, sha256: sha256Bytes(baselineBytes) },
    sourceConfig: { path: "config/desktop-program-packages-v1.json", sha256: sha256Bytes(configBytes) },
    frozenRegistry: { path: "scripts/data/board_move_fx_v1.json", sha256: sha256Bytes(frozenBytes) },
    textRules, programs: programInputs, media, unchangedCardRankAssets: rankAssets,
    candidate: { catalogPath: "desktop/catalog-v3.json", ...candidateCatalog.games.board },
    checks: { newPaths: added.length, newMedia: media.length, images: 102, ogg: 487, programFiles: programs.length, changedExistingPrograms: changed, retainedBaselineRecords: retained.length, unchangedRankRecords: rankAssets.length, cardAndChessUnchanged: true, noMissingReferences: true },
    addedPaths: added,
  };
  const files = new Map([[manifestPath, manifestBytes], ["desktop/catalog-v3.json", Buffer.from(canonicalJson(candidateCatalog))]]);
  programBytes.forEach((bytes, relative) => files.set(`program-bytes/${relative}`, bytes));
  inputs.outputFiles = [...files].map(([relative, bytes]) => ({ path: relative, size: bytes.length, sha256: sha256Bytes(bytes) }));
  files.set("release-inputs.json", Buffer.from(canonicalJson(inputs)));
  return { files, inputs };
}

function writeCandidate(output, files) {
  output = validateOutput(output);
  const previousPath = path.join(output, "release-inputs.json");
  let previous = null;
  if (fs.existsSync(previousPath)) {
    previous = json(fs.readFileSync(previousPath));
    if (previous.generator !== TOOL || previous.candidateOnly !== true) fail("Refusing to replace an unowned candidate directory.");
  }
  const owned = new Map((previous?.outputFiles || []).map((file) => [file.path, file]));
  // Validate every existing destination before the first write. No recursive removal.
  for (const [relative, bytes] of files) {
    const destination = path.resolve(output, relative);
    if (!within(output, destination)) fail("Candidate output path escaped its directory.");
    rejectLinks(destination);
    if (fs.existsSync(destination)) {
      if (!fs.statSync(destination).isFile()) fail(`Candidate destination is not a file: ${relative}`);
      const existing = fs.readFileSync(destination);
      if (existing.equals(bytes)) continue;
      if (relative === "release-inputs.json" && previous) continue;
      if (!owned.has(relative) || sha256Bytes(existing) !== owned.get(relative).sha256) fail(`Refusing to overwrite an unknown or edited candidate file: ${relative}`);
    }
  }
  for (const [relative, bytes] of files) {
    const destination = path.join(output, relative);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, bytes);
    assert.equal(sha256Bytes(fs.readFileSync(destination)), sha256Bytes(bytes), `Candidate readback ${relative}`);
  }
}

function main(argv = process.argv.slice(2)) {
  if (argv.length !== 2 || argv[0] !== "--output") fail("Usage: node scripts/build_board_move_fx_release_candidate.js --output <absolute projectless work/release-candidate>");
  const output = validateOutput(argv[1]);
  const { files, inputs } = buildCandidate();
  writeCandidate(output, files);
  console.log(JSON.stringify({ ok: true, candidateOnly: true, output, baselineHEAD: inputs.baselineHEAD, baseRelease: inputs.baseDeployedBoardRelease, candidateRelease: inputs.candidate.releaseId, ...inputs.checks }));
  return inputs;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(`BOARD_MOVE_FX_CANDIDATE=FAIL ${error.message}`); process.exitCode = 1; }
}
module.exports = { validateOutput, normalizedText, collectMedia, buildCandidate, writeCandidate, main };
