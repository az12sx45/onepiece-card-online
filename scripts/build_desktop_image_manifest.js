const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { execFileSync, spawnSync } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const SOURCE_ROOT = path.join(ROOT, "public", "images");
const OUTPUT = path.join(ROOT, "desktop", "generated", "image-manifest.json");
const SUPPORTED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".jfif", ".webp", ".gif", ".svg", ".avif"]);
const FORBIDDEN_PATH_SEGMENTS = new Set(["battle_chess", "incoming", "backup", "backups", "private"]);

function comparePortablePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function validateManifestPath(manifestPath) {
  if (
    typeof manifestPath !== "string" ||
    manifestPath.length === 0 ||
    manifestPath.includes("\\") ||
    path.posix.isAbsolute(manifestPath) ||
    path.win32.isAbsolute(manifestPath) ||
    manifestPath.split("/").some((part) => part === "" || part === "." || part === "..") ||
    path.posix.normalize(manifestPath) !== manifestPath
  ) {
    throw new Error(`Unsafe image path: ${manifestPath}`);
  }

  const forbidden = manifestPath
    .normalize("NFC")
    .toLowerCase()
    .split("/")
    .find((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment));
  if (forbidden) {
    throw new Error(`Forbidden path segment "${forbidden}" in image source: ${manifestPath}`);
  }
  if (!SUPPORTED_EXTENSIONS.has(path.posix.extname(manifestPath).toLowerCase())) {
    throw new Error(`Unsupported image extension: ${manifestPath}`);
  }
  return manifestPath;
}

function toManifestPath(absolutePath) {
  const relative = path.relative(SOURCE_ROOT, absolutePath);
  const portable = relative.split(path.sep).join("/");

  return validateManifestPath(portable || absolutePath);
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
      if (!repoPath.startsWith(prefix)) throw new Error(`Unexpected tracked image path: ${repoPath}`);
      return validateManifestPath(repoPath.slice(prefix.length));
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
    throw new Error("Tracked public/images files differ from HEAD outside the declared Windows case-collision exclusions");
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
    throw new Error(`Untracked images are not allowed in the desktop package: ${untrackedImages.join(", ")}`);
  }
}

async function inventoryImages(excludedFolded) {
  const sourceInfo = await fs.promises.lstat(SOURCE_ROOT);
  if (sourceInfo.isSymbolicLink() || !sourceInfo.isDirectory()) {
    throw new Error(`Image source must be a real directory: ${SOURCE_ROOT}`);
  }

  const sourceRealPath = await fs.promises.realpath(SOURCE_ROOT);
  const images = [];

  async function walk(directory) {
    const entries = await fs.promises.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => comparePortablePaths(left.name, right.name));

    for (const entry of entries) {
      const absolutePath = path.join(directory, entry.name);
      const info = await fs.promises.lstat(absolutePath);

      if (info.isSymbolicLink()) {
        throw new Error(`Symbolic links are not allowed under public/images: ${absolutePath}`);
      }

      const realPath = await fs.promises.realpath(absolutePath);
      if (!isWithin(sourceRealPath, realPath)) {
        throw new Error(`Image path escapes public/images: ${absolutePath}`);
      }

      if (info.isDirectory()) {
        await walk(absolutePath);
      } else if (info.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        const manifestPath = toManifestPath(absolutePath);
        if (!excludedFolded.has(manifestPath.normalize("NFC").toLowerCase())) {
          images.push({ absolutePath, manifestPath });
        }
      }
    }
  }

  await walk(SOURCE_ROOT);
  images.sort((left, right) => comparePortablePaths(left.manifestPath, right.manifestPath));

  const exactPaths = new Set();
  const foldedPaths = new Map();
  for (const image of images) {
    if (exactPaths.has(image.manifestPath)) {
      throw new Error(`Duplicate image path: ${image.manifestPath}`);
    }
    exactPaths.add(image.manifestPath);

    const folded = image.manifestPath.normalize("NFC").toLowerCase();
    const previous = foldedPaths.get(folded);
    if (previous && previous !== image.manifestPath) {
      throw new Error(`Case-insensitive image path collision: ${previous} <> ${image.manifestPath}`);
    }
    foldedPaths.set(folded, image.manifestPath);
  }

  return images;
}

async function hashImage(image) {
  const before = await fs.promises.lstat(image.absolutePath);
  if (before.isSymbolicLink() || !before.isFile()) {
    throw new Error(`Image changed type while building manifest: ${image.manifestPath}`);
  }

  const hash = crypto.createHash("sha256");
  const stream = fs.createReadStream(image.absolutePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }

  const after = await fs.promises.lstat(image.absolutePath);
  if (
    after.isSymbolicLink() ||
    !after.isFile() ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    before.dev !== after.dev ||
    before.ino !== after.ino
  ) {
    throw new Error(`Image changed while building manifest: ${image.manifestPath}`);
  }

  return { size: after.size, sha256: hash.digest("hex") };
}

function getSourceCommit() {
  const commit = execFileSync("git", ["log", "-1", "--format=%H", "HEAD", "--", "public/images"], {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

  if (!/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/i.test(commit)) {
    throw new Error(`Unexpected public/images source commit id: ${commit}`);
  }
  return commit.toLowerCase();
}

async function writeJsonAtomically(value) {
  await fs.promises.mkdir(path.dirname(OUTPUT), { recursive: true });
  const temporary = path.join(
    path.dirname(OUTPUT),
    `.${path.basename(OUTPUT)}.${process.pid}.${Date.now()}.${crypto.randomBytes(6).toString("hex")}.tmp`,
  );

  try {
    await fs.promises.writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx",
    });
    await fs.promises.rename(temporary, OUTPUT);
  } finally {
    await fs.promises.rm(temporary, { force: true });
  }
}

async function main() {
  const tracked = getTrackedImageInventory();
  assertIncludedImagesMatchHead(tracked.excludedCaseCollisions);
  const images = await inventoryImages(tracked.excludedFolded);
  const physicalPaths = images.map((image) => image.manifestPath);
  if (
    physicalPaths.length !== tracked.includedPaths.length ||
    physicalPaths.some((manifestPath, index) => manifestPath !== tracked.includedPaths[index])
  ) {
    throw new Error("Physical public/images inventory does not match the included image paths in HEAD");
  }
  const files = Object.create(null);
  let totalBytes = 0;

  for (const image of images) {
    const metadata = await hashImage(image);
    files[image.manifestPath] = metadata;
    totalBytes += metadata.size;
    if (!Number.isSafeInteger(totalBytes)) {
      throw new Error("Image byte total exceeds JavaScript's safe integer range");
    }
  }

  const manifest = {
    schema: 1,
    sourceRoot: "public/images",
    sourceCommit: getSourceCommit(),
    createdAt: new Date().toISOString(),
    excludedCaseCollisions: tracked.excludedCaseCollisions,
    totalFiles: images.length,
    totalBytes,
    files,
  };

  await writeJsonAtomically(manifest);
  console.log(
    `DESKTOP_IMAGE_MANIFEST=PASS files=${manifest.totalFiles} bytes=${manifest.totalBytes} ` +
    `excludedCaseCollisions=${manifest.excludedCaseCollisions.length}`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_IMAGE_MANIFEST=FAIL ${error.message}`);
  process.exitCode = 1;
});
