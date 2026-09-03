const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "public");
const MANIFEST_PATH = path.join(ROOT, "desktop", "generated", "asset-manifest.json");
const INCLUDED_ROOTS = ["images", "audio", "videos", "fonts"];
const FORBIDDEN_PATH_SEGMENTS = new Set(["battle_chess", "incoming", "backup", "backups", "private"]);
const TYPES = new Map([
  [".png", ["image", "image/png"]], [".jpg", ["image", "image/jpeg"]],
  [".jpeg", ["image", "image/jpeg"]], [".jfif", ["image", "image/jpeg"]],
  [".webp", ["image", "image/webp"]], [".gif", ["image", "image/gif"]],
  [".svg", ["image", "image/svg+xml"]], [".avif", ["image", "image/avif"]],
  [".mp3", ["audio", "audio/mpeg"]], [".wav", ["audio", "audio/wav"]],
  [".ogg", ["audio", "audio/ogg"]], [".m4a", ["audio", "audio/mp4"]],
  [".aac", ["audio", "audio/aac"]], [".flac", ["audio", "audio/flac"]],
  [".mp4", ["video", "video/mp4"]], [".webm", ["video", "video/webm"]],
  [".mov", ["video", "video/quicktime"]], [".m4v", ["video", "video/x-m4v"]],
  [".woff", ["font", "font/woff"]], [".woff2", ["font", "font/woff2"]],
  [".ttf", ["font", "font/ttf"]], [".otf", ["font", "font/otf"]],
]);
const QUICK_HASH_SAMPLE_SIZE = 96;

function fail(message) {
  throw new Error(message);
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function typeFor(assetPath) {
  return TYPES.get(path.posix.extname(assetPath).toLowerCase()) || null;
}

function isForbidden(assetPath) {
  return assetPath.normalize("NFC").toLowerCase().split("/").some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateAssetPath(assetPath) {
  if (
    typeof assetPath !== "string" || !assetPath || assetPath.includes("\\") || path.posix.isAbsolute(assetPath) ||
    path.win32.isAbsolute(assetPath) || path.posix.normalize(assetPath) !== assetPath ||
    assetPath.split("/").some((part) => !part || part === "." || part === "..") ||
    !INCLUDED_ROOTS.includes(assetPath.split("/")[0]) || !typeFor(assetPath)
  ) {
    fail(`Unsafe or unsupported desktop asset path: ${assetPath}`);
  }
  const absolutePath = path.resolve(SOURCE_ROOT, ...assetPath.split("/"));
  if (!isWithin(SOURCE_ROOT, absolutePath)) fail(`Desktop asset escapes public: ${assetPath}`);
  return absolutePath;
}

function gitValue(args, label) {
  const value = execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim().toLowerCase();
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value)) fail(`Unexpected ${label}: ${value}`);
  return value;
}

function getTrackedInventory() {
  const roots = INCLUDED_ROOTS.map((root) => `public/${root}`);
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", "HEAD", "--", ...roots], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const supported = output.toString("utf8").split("\0").filter(Boolean).map((repoPath) => {
    if (!repoPath.startsWith("public/")) fail(`Unexpected tracked asset path: ${repoPath}`);
    return repoPath.slice("public/".length);
  }).filter(typeFor).sort(comparePaths);
  supported.forEach(validateAssetPath);

  const excludedForbiddenPaths = supported.filter(isForbidden);
  const allowed = supported.filter((assetPath) => !isForbidden(assetPath));
  const groups = new Map();
  for (const assetPath of allowed) {
    const key = assetPath.normalize("NFC").toLowerCase();
    const group = groups.get(key) || [];
    group.push(assetPath);
    groups.set(key, group);
  }
  const excludedCaseCollisions = [...groups.values()].filter((group) => group.length > 1).flat().sort(comparePaths);
  const excludedFolded = new Set(excludedCaseCollisions.map((assetPath) => assetPath.normalize("NFC").toLowerCase()));
  const includedPaths = allowed.filter((assetPath) => !excludedFolded.has(assetPath.normalize("NFC").toLowerCase()));
  return { roots, includedPaths, excludedForbiddenPaths, excludedCaseCollisions, excludedFolded };
}

function assertSourceMatchesHead(tracked) {
  const exclusions = [...tracked.excludedCaseCollisions, ...tracked.excludedForbiddenPaths]
    .map((assetPath) => `:(exclude)public/${assetPath}`);
  const diff = spawnSync("git", ["diff", "--quiet", "HEAD", "--", ...tracked.roots, ...exclusions], {
    cwd: ROOT,
    stdio: "ignore",
  });
  if (diff.error) throw diff.error;
  if (diff.status !== 0) fail("Tracked desktop assets differ from HEAD outside declared exclusions");

  const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", ...tracked.roots], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  }).toString("utf8").split("\0").filter(Boolean).map((repoPath) => repoPath.startsWith("public/") ? repoPath.slice(7) : repoPath)
    .filter((assetPath) => typeFor(assetPath) && !isForbidden(assetPath));
  if (untracked.length) fail(`Untracked assets are not allowed: ${untracked.join(", ")}`);
}

async function inventoryPhysical(tracked) {
  const publicRealPath = await fs.promises.realpath(SOURCE_ROOT);
  const paths = [];
  async function walk(directory, relativeDirectory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePaths(left.name, right.name));
    for (const entry of entries) {
      const relativePath = `${relativeDirectory}/${entry.name}`;
      if (isForbidden(relativePath)) continue;
      const absolutePath = path.join(directory, entry.name);
      const info = await fs.promises.lstat(absolutePath);
      if (info.isSymbolicLink()) fail(`Symbolic link is not allowed: ${absolutePath}`);
      const realPath = await fs.promises.realpath(absolutePath);
      if (!isWithin(publicRealPath, realPath)) fail(`Asset escapes public: ${absolutePath}`);
      if (info.isDirectory()) {
        await walk(absolutePath, relativePath);
      } else if (info.isFile() && typeFor(relativePath)) {
        validateAssetPath(relativePath);
        if (!tracked.excludedFolded.has(relativePath.normalize("NFC").toLowerCase())) paths.push(relativePath);
      }
    }
  }
  for (const root of INCLUDED_ROOTS) await walk(path.join(SOURCE_ROOT, root), root);
  paths.sort(comparePaths);
  return paths;
}

function validateManifestShape(manifest) {
  if (!isPlainObject(manifest)) fail("Manifest root must be an object");
  const fields = ["schema", "sourceRoot", "sourceCommit", "sourceTrees", "createdAt", "includedRoots", "excludedCaseCollisions", "excludedForbiddenPaths", "totalFiles", "totalBytes", "byKind", "files"];
  if (Object.keys(manifest).join(",") !== fields.join(",")) fail(`Manifest fields/order are invalid; expected ${fields.join(", ")}`);
  if (manifest.schema !== 2 || manifest.sourceRoot !== "public") fail("Manifest schema/sourceRoot is invalid");
  if (JSON.stringify(manifest.includedRoots) !== JSON.stringify(INCLUDED_ROOTS)) fail("Manifest includedRoots are invalid");
  if (typeof manifest.sourceCommit !== "string" || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.sourceCommit)) fail("Invalid sourceCommit");
  if (!isPlainObject(manifest.sourceTrees) || Object.keys(manifest.sourceTrees).join(",") !== INCLUDED_ROOTS.join(",")) fail("Invalid sourceTrees roots/order");
  for (const root of INCLUDED_ROOTS) {
    if (typeof manifest.sourceTrees[root] !== "string" || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.sourceTrees[root])) fail(`Invalid sourceTrees.${root}`);
  }
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) fail("Invalid createdAt");
  if (!Array.isArray(manifest.excludedCaseCollisions) || !Array.isArray(manifest.excludedForbiddenPaths)) fail("Invalid exclusion arrays");
  if (!Number.isSafeInteger(manifest.totalFiles) || manifest.totalFiles < 0 || !Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes < 0) fail("Invalid manifest totals");
  if (!isPlainObject(manifest.byKind) || !isPlainObject(manifest.files)) fail("Invalid manifest maps");
}

function selectQuickSample(paths) {
  if (paths.length <= QUICK_HASH_SAMPLE_SIZE) return paths;
  const selected = new Set();
  for (let index = 0; index < QUICK_HASH_SAMPLE_SIZE; index += 1) {
    selected.add(paths[Math.floor((index * (paths.length - 1)) / (QUICK_HASH_SAMPLE_SIZE - 1))]);
  }
  for (const kind of ["audio", "video", "font"]) {
    const matching = paths.filter((assetPath) => typeFor(assetPath)?.[0] === kind);
    if (matching.length) selected.add(matching[Math.floor(matching.length / 2)]);
  }
  return paths.filter((assetPath) => selected.has(assetPath));
}

async function sha256File(absolutePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(absolutePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

function committedSvgRecord(assetPath) {
  if (path.posix.extname(assetPath).toLowerCase() !== ".svg") return null;
  const bytes = execFileSync("git", ["cat-file", "blob", `HEAD:public/${assetPath}`], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 32 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  return {
    size: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

async function mapConcurrent(values, limit, worker) {
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, values.length)) }, run));
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--quick") || args.filter((argument) => argument === "--quick").length > 1) {
    fail("Usage: node scripts/desktop_asset_manifest_qa.js [--quick]");
  }
  const quick = args.includes("--quick");
  const text = await fs.promises.readFile(MANIFEST_PATH, "utf8");
  let manifest;
  try { manifest = JSON.parse(text); } catch (error) { fail(`Manifest is not valid JSON: ${error.message}`); }
  if (text !== `${JSON.stringify(manifest, null, 2)}\n`) fail("Manifest JSON is not canonical");
  validateManifestShape(manifest);

  const tracked = getTrackedInventory();
  assertSourceMatchesHead(tracked);
  const expectedSourceCommit = gitValue(["log", "-1", "--format=%H", "HEAD", "--", ...tracked.roots], "source commit");
  if (manifest.sourceCommit !== expectedSourceCommit) fail(`sourceCommit mismatch: ${manifest.sourceCommit} <> ${expectedSourceCommit}`);
  for (const root of INCLUDED_ROOTS) {
    const expectedSourceTree = gitValue(["rev-parse", `HEAD:public/${root}`], `${root} tree id`);
    if (manifest.sourceTrees[root] !== expectedSourceTree) fail(`sourceTrees.${root} mismatch: ${manifest.sourceTrees[root]} <> ${expectedSourceTree}`);
  }
  if (JSON.stringify(manifest.excludedCaseCollisions) !== JSON.stringify(tracked.excludedCaseCollisions)) fail("Case-collision exclusions mismatch");
  if (JSON.stringify(manifest.excludedForbiddenPaths) !== JSON.stringify(tracked.excludedForbiddenPaths)) fail("Forbidden-path exclusions mismatch");

  const manifestPaths = Object.keys(manifest.files);
  const sortedPaths = [...manifestPaths].sort(comparePaths);
  if (manifestPaths.some((assetPath, index) => assetPath !== sortedPaths[index])) fail("Manifest keys are not sorted");
  if (manifest.totalFiles !== manifestPaths.length) fail("Manifest file count mismatch");
  if (manifestPaths.length !== tracked.includedPaths.length || manifestPaths.some((assetPath, index) => assetPath !== tracked.includedPaths[index])) fail("Manifest inventory differs from Git HEAD");
  const physicalPaths = await inventoryPhysical(tracked);
  if (physicalPaths.length !== manifestPaths.length || physicalPaths.some((assetPath, index) => assetPath !== manifestPaths[index])) fail("Physical inventory differs from manifest");

  const expectedByKind = { image: { files: 0, bytes: 0 }, audio: { files: 0, bytes: 0 }, video: { files: 0, bytes: 0 }, font: { files: 0, bytes: 0 } };
  const absolutePaths = new Map();
  const committedSvgRecords = new Map();
  let calculatedBytes = 0;
  for (const assetPath of manifestPaths) {
    const record = manifest.files[assetPath];
    const expectedType = typeFor(assetPath);
    if (!isPlainObject(record) || Object.keys(record).join(",") !== "kind,mime,size,sha256") fail(`Invalid metadata fields: ${assetPath}`);
    if (record.kind !== expectedType[0] || record.mime !== expectedType[1]) fail(`Type mismatch: ${assetPath}`);
    if (!Number.isSafeInteger(record.size) || record.size < 0 || typeof record.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(record.sha256)) fail(`Invalid size/hash: ${assetPath}`);
    const absolutePath = validateAssetPath(assetPath);
    const info = await fs.promises.lstat(absolutePath);
    if (info.isSymbolicLink() || !info.isFile()) fail(`Physical size/type mismatch: ${assetPath}`);
    const committedSvg = committedSvgRecord(assetPath);
    if (committedSvg) {
      committedSvgRecords.set(assetPath, committedSvg);
      if (committedSvg.size !== record.size) fail(`Committed SVG size mismatch: ${assetPath}`);
    } else if (info.size !== record.size) {
      fail(`Physical size/type mismatch: ${assetPath}`);
    }
    absolutePaths.set(assetPath, absolutePath);
    calculatedBytes += record.size;
    expectedByKind[record.kind].files += 1;
    expectedByKind[record.kind].bytes += record.size;
  }
  if (manifest.totalBytes !== calculatedBytes) fail("Manifest byte total mismatch");
  if (JSON.stringify(manifest.byKind) !== JSON.stringify(expectedByKind)) fail("Manifest byKind totals mismatch");

  const hashPaths = quick ? selectQuickSample(manifestPaths) : manifestPaths;
  const failures = [];
  await mapConcurrent(hashPaths, 8, async (assetPath) => {
    const actual = committedSvgRecords.get(assetPath)?.sha256 || await sha256File(absolutePaths.get(assetPath));
    if (actual !== manifest.files[assetPath].sha256) failures.push(assetPath);
  });
  if (failures.length) fail(`SHA-256 mismatch: ${failures.sort(comparePaths).slice(0, 12).join(", ")}`);

  console.log(
    `DESKTOP_ASSET_MANIFEST_QA=PASS mode=${quick ? "quick" : "full"} files=${manifestPaths.length} ` +
    `hashed=${hashPaths.length} bytes=${manifest.totalBytes} images=${manifest.byKind.image.files} ` +
    `audio=${manifest.byKind.audio.files} video=${manifest.byKind.video.files} fonts=${manifest.byKind.font.files} ` +
    `caseCollisions=${manifest.excludedCaseCollisions.length} forbidden=${manifest.excludedForbiddenPaths.length}`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_ASSET_MANIFEST_QA=FAIL ${error.message}`);
  process.exitCode = 1;
});
