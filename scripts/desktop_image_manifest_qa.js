const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "public", "images");
const MANIFEST_PATH = path.join(ROOT, "desktop", "generated", "image-manifest.json");
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".svg", ".avif"]);
const FORBIDDEN_PATH_SEGMENTS = new Set(["battle_chess", "incoming", "backup", "backups", "private"]);
const QUICK_HASH_SAMPLE_SIZE = 64;

function fail(message) {
  throw new Error(message);
}

function comparePortablePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateManifestPath(manifestPath) {
  if (typeof manifestPath !== "string" || manifestPath.length === 0) {
    fail("Manifest contains an empty or non-string file path");
  }
  if (
    manifestPath.includes("\\") ||
    path.posix.isAbsolute(manifestPath) ||
    path.win32.isAbsolute(manifestPath) ||
    manifestPath.split("/").some((part) => part === "" || part === "." || part === "..") ||
    path.posix.normalize(manifestPath) !== manifestPath
  ) {
    fail(`Unsafe or non-canonical manifest path: ${manifestPath}`);
  }

  const forbidden = manifestPath
    .normalize("NFC")
    .toLowerCase()
    .split("/")
    .find((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
  if (forbidden) {
    fail(`Forbidden path segment "${forbidden}" in manifest: ${manifestPath}`);
  }

  if (!SUPPORTED_EXTENSIONS.has(path.posix.extname(manifestPath).toLowerCase())) {
    fail(`Unsupported image extension in manifest: ${manifestPath}`);
  }

  const absolutePath = path.resolve(SOURCE_ROOT, ...manifestPath.split("/"));
  if (!isWithin(SOURCE_ROOT, absolutePath)) {
    fail(`Manifest path escapes public/images: ${manifestPath}`);
  }
  return absolutePath;
}

function getImageSourceCommit() {
  return execFileSync("git", ["log", "-1", "--format=%H", "HEAD", "--", "public/images"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim().toLowerCase();
}

function getTrackedImageInventory() {
  const prefix = "public/images/";
  const output = execFileSync("git", ["ls-tree", "-r", "--name-only", "-z", "HEAD", "--", "public/images"], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const trackedPaths = output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((repoPath) => SUPPORTED_EXTENSIONS.has(path.posix.extname(repoPath).toLowerCase()))
    .map((repoPath) => {
      if (!repoPath.startsWith(prefix)) fail(`Unexpected tracked image path: ${repoPath}`);
      const manifestPath = repoPath.slice(prefix.length);
      validateManifestPath(manifestPath);
      return manifestPath;
    })
    .sort(comparePortablePaths);

  const foldedGroups = new Map();
  for (const manifestPath of trackedPaths) {
    const folded = manifestPath.normalize("NFC").toLowerCase();
    const group = foldedGroups.get(folded) || [];
    group.push(manifestPath);
    foldedGroups.set(folded, group);
  }
  const excludedCaseCollisions = [...foldedGroups.values()]
    .filter((group) => group.length > 1)
    .flat()
    .sort(comparePortablePaths);
  const excludedFolded = new Set(excludedCaseCollisions.map((manifestPath) => manifestPath.normalize("NFC").toLowerCase()));
  const includedPaths = trackedPaths.filter((manifestPath) => !excludedFolded.has(manifestPath.normalize("NFC").toLowerCase()));
  return { includedPaths, excludedCaseCollisions, excludedFolded };
}

function assertIncludedImagesMatchHead(excludedCaseCollisions) {
  const exclusions = excludedCaseCollisions.map((manifestPath) => `:(exclude)public/images/${manifestPath}`);
  const diff = spawnSync("git", ["diff", "--quiet", "HEAD", "--", "public/images", ...exclusions], {
    cwd: ROOT,
    stdio: "ignore",
  });
  if (diff.error) throw diff.error;
  if (diff.status !== 0) {
    fail("Tracked public/images files differ from HEAD outside the declared Windows case-collision exclusions");
  }

  const untrackedOutput = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z", "--", "public/images"], {
    cwd: ROOT,
    encoding: "buffer",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const untrackedImages = untrackedOutput
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((repoPath) => SUPPORTED_EXTENSIONS.has(path.posix.extname(repoPath).toLowerCase()));
  if (untrackedImages.length) {
    fail(`Untracked images are not allowed in the desktop package: ${untrackedImages.join(", ")}`);
  }
}

async function inventorySource(excludedFolded) {
  const sourceInfo = await fs.promises.lstat(SOURCE_ROOT);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory()) {
    fail(`Image source must be a real directory: ${SOURCE_ROOT}`);
  }
  const sourceRealPath = await fs.promises.realpath(SOURCE_ROOT);
  const paths = [];

  async function walk(directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePortablePaths(left.name, right.name));
    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const info = await fs.promises.lstat(absolutePath);
      if (info.isSymbolicLink()) {
        fail(`Symbolic links are not allowed under public/images: ${absolutePath}`);
      }

      const realPath = await fs.promises.realpath(absolutePath);
      if (!isWithin(sourceRealPath, realPath)) {
        fail(`Image path escapes public/images: ${absolutePath}`);
      }

      if (info.isDirectory()) {
        await walk(absolutePath);
      } else if (info.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const relative = path.relative(SOURCE_ROOT, absolutePath).split(path.sep).join("/");
        validateManifestPath(relative);
        if (!excludedFolded.has(relative.normalize("NFC").toLowerCase())) paths.push(relative);
      }
    }
  }

  await walk(SOURCE_ROOT);
  paths.sort(comparePortablePaths);
  return paths;
}

function validateManifestShape(manifest) {
  if (!isPlainObject(manifest)) fail("Manifest root must be an object");
  const expectedFields = ["schema", "sourceRoot", "sourceCommit", "createdAt", "excludedCaseCollisions", "totalFiles", "totalBytes", "files"];
  if (Object.keys(manifest).join(",") !== expectedFields.join(",")) {
    fail(`Manifest fields or field order are invalid; expected ${expectedFields.join(", ")}`);
  }
  if (manifest.schema !== 1) fail(`Unsupported manifest schema: ${manifest.schema}`);
  if (manifest.sourceRoot !== "public/images") fail("sourceRoot must be public/images");
  if (typeof manifest.sourceCommit !== "string" || !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/.test(manifest.sourceCommit)) {
    fail("sourceCommit must be a lowercase 40- or 64-character git object id");
  }
  if (
    typeof manifest.createdAt !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(manifest.createdAt) ||
    Number.isNaN(Date.parse(manifest.createdAt))
  ) {
    fail("createdAt must be an ISO-8601 UTC timestamp");
  }
  if (!Array.isArray(manifest.excludedCaseCollisions)) fail("excludedCaseCollisions must be an array");
  if (!Number.isSafeInteger(manifest.totalFiles) || manifest.totalFiles < 0) {
    fail("totalFiles must be a non-negative safe integer");
  }
  if (!Number.isSafeInteger(manifest.totalBytes) || manifest.totalBytes < 0) {
    fail("totalBytes must be a non-negative safe integer");
  }
  if (!isPlainObject(manifest.files)) fail("files must be an object");
}

function selectQuickSample(paths) {
  if (paths.length <= QUICK_HASH_SAMPLE_SIZE) return paths;
  const selected = new Set();
  for (let index = 0; index < QUICK_HASH_SAMPLE_SIZE; index += 1) {
    selected.add(paths[Math.floor((index * (paths.length - 1)) / (QUICK_HASH_SAMPLE_SIZE - 1))]);
  }
  return paths.filter((manifestPath) => selected.has(manifestPath));
}

async function sha256File(absolutePath) {
  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(absolutePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest("hex");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((argument) => argument !== "--quick") || args.filter((argument) => argument === "--quick").length > 1) {
    fail("Usage: node scripts/desktop_image_manifest_qa.js [--quick]");
  }
  const quick = args.includes("--quick");

  const manifestText = await fs.promises.readFile(MANIFEST_PATH, "utf8");
  let manifest;
  try {
    manifest = JSON.parse(manifestText);
  } catch (error) {
    fail(`Manifest is not valid JSON: ${error.message}`);
  }
  if (manifestText !== `${JSON.stringify(manifest, null, 2)}\n`) {
    fail("Manifest JSON is not canonical; formatting, ordering, or duplicate keys may have changed");
  }
  validateManifestShape(manifest);

  const tracked = getTrackedImageInventory();
  assertIncludedImagesMatchHead(tracked.excludedCaseCollisions);
  const imageSourceCommit = getImageSourceCommit();
  if (manifest.sourceCommit !== imageSourceCommit) {
    fail(`sourceCommit mismatch: manifest=${manifest.sourceCommit} public/images=${imageSourceCommit}`);
  }
  const excludedJson = JSON.stringify(manifest.excludedCaseCollisions);
  const expectedExcludedJson = JSON.stringify(tracked.excludedCaseCollisions);
  if (excludedJson !== expectedExcludedJson) {
    fail(`excludedCaseCollisions mismatch: manifest=${excludedJson} HEAD=${expectedExcludedJson}`);
  }

  const manifestPaths = Object.keys(manifest.files);
  const sortedPaths = [...manifestPaths].sort(comparePortablePaths);
  if (manifestPaths.some((manifestPath, index) => manifestPath !== sortedPaths[index])) {
    fail("Manifest file keys are not in deterministic ascending order");
  }
  if (manifest.totalFiles !== manifestPaths.length) {
    fail(`totalFiles mismatch: manifest=${manifest.totalFiles} entries=${manifestPaths.length}`);
  }

  const exactPaths = new Set();
  const foldedPaths = new Map();
  let calculatedBytes = 0;
  const absolutePaths = new Map();

  for (const manifestPath of manifestPaths) {
    if (exactPaths.has(manifestPath)) fail(`Duplicate manifest path: ${manifestPath}`);
    exactPaths.add(manifestPath);

    const folded = manifestPath.normalize("NFC").toLowerCase();
    const previous = foldedPaths.get(folded);
    if (previous && previous !== manifestPath) {
      fail(`Case-insensitive manifest path collision: ${previous} <> ${manifestPath}`);
    }
    foldedPaths.set(folded, manifestPath);

    const metadata = manifest.files[manifestPath];
    if (!isPlainObject(metadata)) fail(`File metadata must be an object: ${manifestPath}`);
    if (!Number.isSafeInteger(metadata.size) || metadata.size < 0) fail(`Invalid size: ${manifestPath}`);
    if (typeof metadata.sha256 !== "string" || !/^[0-9a-f]{64}$/.test(metadata.sha256)) {
      fail(`Invalid SHA-256: ${manifestPath}`);
    }
    if (Object.keys(metadata).sort().join(",") !== "sha256,size") {
      fail(`Unexpected metadata fields: ${manifestPath}`);
    }

    const absolutePath = validateManifestPath(manifestPath);
    absolutePaths.set(manifestPath, absolutePath);
    calculatedBytes += metadata.size;
    if (!Number.isSafeInteger(calculatedBytes)) fail("Image byte total exceeds JavaScript's safe integer range");
  }

  if (manifest.totalBytes !== calculatedBytes) {
    fail(`totalBytes mismatch: manifest=${manifest.totalBytes} entries=${calculatedBytes}`);
  }

  const sourcePaths = await inventorySource(tracked.excludedFolded);
  if (sourcePaths.length !== manifestPaths.length) {
    fail(`Source inventory count mismatch: manifest=${manifestPaths.length} source=${sourcePaths.length}`);
  }
  for (let index = 0; index < sourcePaths.length; index += 1) {
    if (sourcePaths[index] !== sortedPaths[index]) {
      fail(`Source inventory mismatch: manifest=${sortedPaths[index] || "<missing>"} source=${sourcePaths[index] || "<missing>"}`);
    }
  }
  if (
    sourcePaths.length !== tracked.includedPaths.length ||
    sourcePaths.some((manifestPath, index) => manifestPath !== tracked.includedPaths[index])
  ) {
    fail("Physical public/images inventory does not match the included image paths in HEAD");
  }

  for (const manifestPath of manifestPaths) {
    const absolutePath = absolutePaths.get(manifestPath);
    const info = await fs.promises.lstat(absolutePath);
    if (info.isSymbolicLink() || !info.isFile()) fail(`Manifest target is not a regular file: ${manifestPath}`);
    if (info.size !== manifest.files[manifestPath].size) {
      fail(`Size mismatch: ${manifestPath} manifest=${manifest.files[manifestPath].size} actual=${info.size}`);
    }
  }

  const hashPaths = quick ? selectQuickSample(manifestPaths) : manifestPaths;
  for (const manifestPath of hashPaths) {
    const actualHash = await sha256File(absolutePaths.get(manifestPath));
    if (actualHash !== manifest.files[manifestPath].sha256) {
      fail(`SHA-256 mismatch: ${manifestPath}`);
    }
  }

  console.log(
    `DESKTOP_IMAGE_MANIFEST_QA=PASS mode=${quick ? "quick" : "full"} files=${manifestPaths.length} ` +
    `hashed=${hashPaths.length} bytes=${manifest.totalBytes} excludedCaseCollisions=${manifest.excludedCaseCollisions.length}`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_IMAGE_MANIFEST_QA=FAIL ${error.message}`);
  process.exitCode = 1;
});
