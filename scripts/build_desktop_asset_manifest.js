const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "public");
const OUTPUT = path.join(ROOT, "desktop", "generated", "asset-manifest.json");
const INCLUDED_ROOTS = ["images", "audio", "videos", "fonts"];
const FORBIDDEN_PATH_SEGMENTS = new Set(["battle_chess", "incoming", "backup", "backups", "private"]);
const EXTENSION_METADATA = new Map([
  [".png", { kind: "image", mime: "image/png" }],
  [".jpg", { kind: "image", mime: "image/jpeg" }],
  [".jpeg", { kind: "image", mime: "image/jpeg" }],
  [".jfif", { kind: "image", mime: "image/jpeg" }],
  [".webp", { kind: "image", mime: "image/webp" }],
  [".gif", { kind: "image", mime: "image/gif" }],
  [".svg", { kind: "image", mime: "image/svg+xml" }],
  [".avif", { kind: "image", mime: "image/avif" }],
  [".mp3", { kind: "audio", mime: "audio/mpeg" }],
  [".wav", { kind: "audio", mime: "audio/wav" }],
  [".ogg", { kind: "audio", mime: "audio/ogg" }],
  [".m4a", { kind: "audio", mime: "audio/mp4" }],
  [".aac", { kind: "audio", mime: "audio/aac" }],
  [".flac", { kind: "audio", mime: "audio/flac" }],
  [".mp4", { kind: "video", mime: "video/mp4" }],
  [".webm", { kind: "video", mime: "video/webm" }],
  [".mov", { kind: "video", mime: "video/quicktime" }],
  [".m4v", { kind: "video", mime: "video/x-m4v" }],
  [".woff", { kind: "font", mime: "font/woff" }],
  [".woff2", { kind: "font", mime: "font/woff2" }],
  [".ttf", { kind: "font", mime: "font/ttf" }],
  [".otf", { kind: "font", mime: "font/otf" }],
]);

function comparePortablePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function metadataForPath(assetPath) {
  return EXTENSION_METADATA.get(path.posix.extname(assetPath).toLowerCase()) || null;
}

function isForbidden(assetPath) {
  return assetPath
    .normalize("NFC")
    .toLowerCase()
    .split("/")
    .some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
}

function validateAssetPath(assetPath) {
  if (
    typeof assetPath !== "string" ||
    assetPath.length === 0 ||
    assetPath.includes("\\") ||
    path.posix.isAbsolute(assetPath) ||
    path.win32.isAbsolute(assetPath) ||
    assetPath.split("/").some((part) => part === "" || part === "." || part === "..") ||
    path.posix.normalize(assetPath) !== assetPath ||
    !INCLUDED_ROOTS.includes(assetPath.split("/")[0])
  ) {
    throw new Error(`Unsafe desktop asset path: ${assetPath}`);
  }
  if (!metadataForPath(assetPath)) {
    throw new Error(`Unsupported desktop asset extension: ${assetPath}`);
  }
  return assetPath;
}

function getTrackedInventory() {
  const args = ["ls-tree", "-r", "--name-only", "-z", "HEAD", "--", ...INCLUDED_ROOTS.map((root) => `public/${root}`)];
  const output = execFileSync("git", args, {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = "public/";
  const supportedPaths = output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((repoPath) => {
      if (!repoPath.startsWith(prefix)) throw new Error(`Unexpected tracked asset path: ${repoPath}`);
      return repoPath.slice(prefix.length);
    })
    .filter((assetPath) => metadataForPath(assetPath))
    .map(validateAssetPath)
    .sort(comparePortablePaths);

  const excludedForbiddenPaths = supportedPaths.filter(isForbidden);
  const allowedPaths = supportedPaths.filter((assetPath) => !isForbidden(assetPath));
  const foldedGroups = new Map();
  for (const assetPath of allowedPaths) {
    const folded = assetPath.normalize("NFC").toLowerCase();
    const group = foldedGroups.get(folded) || [];
    group.push(assetPath);
    foldedGroups.set(folded, group);
  }
  const excludedCaseCollisions = [...foldedGroups.values()]
    .filter((group) => group.length > 1)
    .flat()
    .sort(comparePortablePaths);
  const excludedFolded = new Set(excludedCaseCollisions.map((assetPath) => assetPath.normalize("NFC").toLowerCase()));
  const includedPaths = allowedPaths.filter((assetPath) => !excludedFolded.has(assetPath.normalize("NFC").toLowerCase()));
  return { includedPaths, excludedCaseCollisions, excludedForbiddenPaths, excludedFolded };
}

function assertIncludedAssetsMatchHead(excludedPaths) {
  const roots = INCLUDED_ROOTS.map((root) => `public/${root}`);
  const exclusions = excludedPaths.map((assetPath) => `:(exclude)public/${assetPath}`);
  const diff = spawnSync("git", ["diff", "--quiet", "HEAD", "--", ...roots, ...exclusions], {
    cwd: ROOT,
    stdio: "ignore",
  });
  if (diff.error) throw diff.error;
  if (diff.status !== 0) {
    throw new Error("Tracked desktop assets differ from HEAD outside declared exclusions");
  }

  const untrackedOutput = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", ...roots], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 128 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const unexpected = untrackedOutput
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .map((repoPath) => repoPath.startsWith("public/") ? repoPath.slice("public/".length) : repoPath)
    .filter((assetPath) => metadataForPath(assetPath) && !isForbidden(assetPath));
  if (unexpected.length) {
    throw new Error(`Untracked assets are not allowed in the desktop package: ${unexpected.join(", ")}`);
  }
}

async function inventoryPhysicalAssets(excludedFolded) {
  const sourceInfo = await fs.promises.lstat(SOURCE_ROOT);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory()) {
    throw new Error(`Desktop asset source must be a real directory: ${SOURCE_ROOT}`);
  }
  const sourceRealPath = await fs.promises.realpath(SOURCE_ROOT);
  const assets = [];

  async function walk(directory, relativeDirectory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePortablePaths(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const normalisedSegments = relativePath.normalize("NFC").toLowerCase().split("/");
      if (normalisedSegments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment))) continue;

      const absolutePath = path.join(directory, entry.name);
      const info = await fs.promises.lstat(absolutePath);
      if (info.isSymbolicLink()) throw new Error(`Symbolic links are not allowed under public assets: ${absolutePath}`);
      const realPath = await fs.promises.realpath(absolutePath);
      if (!isWithin(sourceRealPath, realPath)) throw new Error(`Asset path escapes public: ${absolutePath}`);

      if (info.isDirectory()) {
        await walk(absolutePath, relativePath);
      } else if (info.isFile() && metadataForPath(relativePath)) {
        const assetPath = validateAssetPath(relativePath);
        if (!excludedFolded.has(assetPath.normalize("NFC").toLowerCase())) {
          assets.push({ absolutePath, assetPath });
        }
      }
    }
  }

  for (const rootName of INCLUDED_ROOTS) {
    const rootPath = path.join(SOURCE_ROOT, rootName);
    const rootInfo = await fs.promises.lstat(rootPath);
    if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
      throw new Error(`Required desktop asset root must be a real directory: ${rootPath}`);
    }
    await walk(rootPath, rootName);
  }

  assets.sort((left, right) => comparePortablePaths(left.assetPath, right.assetPath));
  const folded = new Map();
  for (const asset of assets) {
    const key = asset.assetPath.normalize("NFC").toLowerCase();
    const previous = folded.get(key);
    if (previous && previous !== asset.assetPath) {
      throw new Error(`Case-insensitive physical asset collision: ${previous} <> ${asset.assetPath}`);
    }
    folded.set(key, asset.assetPath);
  }
  return assets;
}

async function hashAsset(asset) {
  const before = await fs.promises.lstat(asset.absolutePath);
  if (before.isSymbolicLink() || !before.isFile()) throw new Error(`Asset changed type: ${asset.assetPath}`);
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(asset.absolutePath);
  for await (const chunk of stream) hash.update(chunk);
  const after = await fs.promises.lstat(asset.absolutePath);
  if (
    after.isSymbolicLink() || !after.isFile() || before.size !== after.size || before.mtimeMs !== after.mtimeMs ||
    before.dev !== after.dev || before.ino !== after.ino
  ) {
    throw new Error(`Asset changed while hashing: ${asset.assetPath}`);
  }
  const type = metadataForPath(asset.assetPath);
  return { kind: type.kind, mime: type.mime, size: after.size, sha256: hash.digest("hex") };
}

async function mapConcurrent(values, limit, worker) {
  const results = new Array(values.length);
  let cursor = 0;
  async function run() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= values.length) return;
      results[index] = await worker(values[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(1, values.length)) }, run));
  return results;
}

function gitValue(args, label) {
  const value = execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim().toLowerCase();
  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(value)) throw new Error(`Unexpected ${label}: ${value}`);
  return value;
}

function getSourceCommit() {
  return gitValue(["log", "-1", "--format=%H", "HEAD", "--", ...INCLUDED_ROOTS.map((root) => `public/${root}`)], "source commit");
}

function getSourceTrees() {
  return Object.fromEntries(INCLUDED_ROOTS.map((root) => [
    root,
    gitValue(["rev-parse", `HEAD:public/${root}`], `${root} tree id`),
  ]));
}

async function writeJsonAtomically(value) {
  await fs.promises.mkdir(path.dirname(OUTPUT), { recursive: true });
  const temporary = path.join(path.dirname(OUTPUT), `.${path.basename(OUTPUT)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString("hex")}.tmp`);
  try {
    await fs.promises.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    await fs.promises.rm(OUTPUT, { force: true });
    await fs.promises.rename(temporary, OUTPUT);
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
}

async function main() {
  const tracked = getTrackedInventory();
  const excludedPaths = [...tracked.excludedCaseCollisions, ...tracked.excludedForbiddenPaths];
  assertIncludedAssetsMatchHead(excludedPaths);
  const assets = await inventoryPhysicalAssets(tracked.excludedFolded);
  const physicalPaths = assets.map((asset) => asset.assetPath);
  if (
    physicalPaths.length !== tracked.includedPaths.length ||
    physicalPaths.some((assetPath, index) => assetPath !== tracked.includedPaths[index])
  ) {
    throw new Error("Physical desktop asset inventory does not match included paths in Git HEAD");
  }

  const metadata = await mapConcurrent(assets, 8, hashAsset);
  const files = Object.create(null);
  const byKind = {
    image: { files: 0, bytes: 0 },
    audio: { files: 0, bytes: 0 },
    video: { files: 0, bytes: 0 },
    font: { files: 0, bytes: 0 },
  };
  let totalBytes = 0;
  for (let index = 0; index < assets.length; index += 1) {
    const assetPath = assets[index].assetPath;
    const record = metadata[index];
    files[assetPath] = record;
    byKind[record.kind].files += 1;
    byKind[record.kind].bytes += record.size;
    totalBytes += record.size;
    if (!Number.isSafeInteger(totalBytes)) throw new Error("Desktop asset byte total exceeds JavaScript's safe integer range");
  }

  const manifest = {
    schema: 2,
    sourceRoot: "public",
    sourceCommit: getSourceCommit(),
    sourceTrees: getSourceTrees(),
    createdAt: new Date().toISOString(),
    includedRoots: INCLUDED_ROOTS,
    excludedCaseCollisions: tracked.excludedCaseCollisions,
    excludedForbiddenPaths: tracked.excludedForbiddenPaths,
    totalFiles: assets.length,
    totalBytes,
    byKind,
    files,
  };
  await writeJsonAtomically(manifest);
  console.log(
    `DESKTOP_ASSET_MANIFEST=PASS files=${manifest.totalFiles} bytes=${manifest.totalBytes} ` +
    `images=${byKind.image.files} audio=${byKind.audio.files} video=${byKind.video.files} fonts=${byKind.font.files} ` +
    `caseCollisions=${manifest.excludedCaseCollisions.length} forbidden=${manifest.excludedForbiddenPaths.length}`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_ASSET_MANIFEST=FAIL ${error.message}`);
  process.exitCode = 1;
});
