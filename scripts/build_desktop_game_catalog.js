const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const ASSET_MANIFEST_PATH = path.join(ROOT, "desktop", "generated", "asset-manifest.json");
const PUBLIC_ROOT = path.join(ROOT, "public");
const OUTPUT_ROOT = path.join(PUBLIC_ROOT, "desktop", "manifests");
const CATALOG_PATH = path.join(PUBLIC_ROOT, "desktop", "catalog-v1.json");
const ROOT_NAMES = ["images", "audio", "videos", "fonts"];
const KINDS = ["image", "audio", "video", "font"];
const GAME_IDS = ["card", "board"];
const HASH_PATTERN = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Text(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function validateAssetPath(assetPath) {
  if (
    typeof assetPath !== "string" || !assetPath || assetPath.includes("\\") ||
    path.posix.isAbsolute(assetPath) || path.win32.isAbsolute(assetPath) ||
    path.posix.normalize(assetPath) !== assetPath ||
    assetPath.split("/").some((part) => !part || part === "." || part === "..") ||
    !ROOT_NAMES.includes(assetPath.split("/")[0])
  ) {
    fail(`Unsafe asset path in unified manifest: ${assetPath}`);
  }
}

function validateUnifiedManifest(manifest) {
  if (!isPlainObject(manifest) || manifest.schema !== 2 || manifest.sourceRoot !== "public") {
    fail("Unified desktop asset manifest must use schema 2 and sourceRoot public");
  }
  if (JSON.stringify(manifest.includedRoots) !== JSON.stringify(ROOT_NAMES)) {
    fail("Unified desktop asset manifest roots are incomplete or out of order");
  }
  if (!isPlainObject(manifest.sourceTrees) || Object.keys(manifest.sourceTrees).join(",") !== ROOT_NAMES.join(",")) {
    fail("Unified desktop asset manifest sourceTrees are incomplete or out of order");
  }
  for (const rootName of ROOT_NAMES) {
    if (typeof manifest.sourceTrees[rootName] !== "string" || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(manifest.sourceTrees[rootName])) {
      fail(`Invalid source tree for ${rootName}`);
    }
  }
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt))) {
    fail("Unified desktop asset manifest createdAt is invalid");
  }
  if (!isPlainObject(manifest.files)) fail("Unified desktop asset manifest files map is invalid");

  const assetPaths = Object.keys(manifest.files);
  const sortedPaths = [...assetPaths].sort(comparePaths);
  if (assetPaths.some((assetPath, index) => assetPath !== sortedPaths[index])) {
    fail("Unified desktop asset manifest files must be sorted");
  }
  if (manifest.totalFiles !== assetPaths.length) fail("Unified desktop asset manifest file total is invalid");

  let totalBytes = 0;
  for (const assetPath of assetPaths) {
    validateAssetPath(assetPath);
    const record = manifest.files[assetPath];
    if (
      !isPlainObject(record) || Object.keys(record).join(",") !== "kind,mime,size,sha256" ||
      !KINDS.includes(record.kind) || typeof record.mime !== "string" || !record.mime ||
      !Number.isSafeInteger(record.size) || record.size < 0 ||
      typeof record.sha256 !== "string" || !HASH_PATTERN.test(record.sha256)
    ) {
      fail(`Invalid unified asset record: ${assetPath}`);
    }
    totalBytes += record.size;
    if (!Number.isSafeInteger(totalBytes)) fail("Unified desktop asset byte total is unsafe");
  }
  if (manifest.totalBytes !== totalBytes) fail("Unified desktop asset byte total is invalid");
  return assetPaths;
}

function isSharedShell(assetPath) {
  return (
    assetPath === "images/icon-192.png" ||
    assetPath === "images/board/items/odd_dice.webp" ||
    assetPath.startsWith("images/game_launcher/") ||
    assetPath.startsWith("videos/game_launcher/")
  );
}

function isLauncherOnly(assetPath) {
  return assetPath.startsWith("images/desktop_launcher/");
}

function belongsToBoard(assetPath) {
  return (
    isSharedShell(assetPath) ||
    assetPath.startsWith("images/board/") ||
    assetPath.startsWith("audio/board_game/") ||
    assetPath.startsWith("videos/board/") ||
    assetPath.startsWith("fonts/board/")
  );
}

function belongsToCard(assetPath) {
  if (isSharedShell(assetPath)) return true;
  if (assetPath.startsWith("images/")) {
    return (
      !assetPath.startsWith("images/board/") &&
      !assetPath.startsWith("images/game_launcher/") &&
      !isLauncherOnly(assetPath)
    );
  }
  if (assetPath.startsWith("audio/")) return !assetPath.startsWith("audio/board_game/");
  if (assetPath.startsWith("videos/")) {
    return !assetPath.startsWith("videos/board/") && !assetPath.startsWith("videos/game_launcher/");
  }
  return false;
}

function toAssetRecord(assetPath, record) {
  return {
    path: assetPath,
    kind: record.kind,
    mime: record.mime,
    size: record.size,
    sha256: record.sha256,
  };
}

function calculateByKind(assets) {
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, { files: 0, bytes: 0 }]));
  for (const asset of assets) {
    totals[asset.kind].files += 1;
    totals[asset.kind].bytes += asset.size;
  }
  return totals;
}

function buildGameManifest(gameId, createdAt, assets) {
  const assetSetSha256 = sha256Text(JSON.stringify(assets));
  const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
  if (!Number.isSafeInteger(totalBytes)) fail(`${gameId} byte total is unsafe`);
  return {
    schema: 1,
    gameId,
    releaseId: `assets-${assetSetSha256.slice(0, 16)}`,
    createdAt,
    assetSetSha256,
    totalFiles: assets.length,
    totalBytes,
    byKind: calculateByKind(assets),
    assets,
  };
}

async function writeImmutableJson(outputPath, value) {
  const text = canonicalJson(value);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  try {
    const existing = await fs.promises.readFile(outputPath, "utf8");
    if (existing !== text) fail(`Immutable manifest already exists with different content: ${outputPath}`);
    return text;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx" });
    await fs.promises.rm(outputPath, { force: true });
    await fs.promises.rename(temporaryPath, outputPath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
  return text;
}

async function reuseExistingImmutableManifest(outputPath, manifest, catalogCreatedAt) {
  let existingText;
  try {
    existingText = await fs.promises.readFile(outputPath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return manifest;
    throw error;
  }

  let existing;
  try {
    existing = JSON.parse(existingText);
  } catch (error) {
    fail(`Existing immutable manifest is not valid JSON: ${outputPath}`);
  }
  if (existingText !== canonicalJson(existing)) fail(`Existing immutable manifest is not canonical: ${outputPath}`);
  if (typeof existing.createdAt !== "string" || Number.isNaN(Date.parse(existing.createdAt))) {
    fail(`Existing immutable manifest createdAt is invalid: ${outputPath}`);
  }
  if (Date.parse(existing.createdAt) > Date.parse(catalogCreatedAt)) {
    fail(`Existing immutable manifest is newer than the catalog build: ${outputPath}`);
  }

  const expectedWithOriginalTimestamp = { ...manifest, createdAt: existing.createdAt };
  if (existingText !== canonicalJson(expectedWithOriginalTimestamp)) {
    fail(`Immutable manifest already exists with different asset content: ${outputPath}`);
  }
  return existing;
}

async function writeReplaceableJson(outputPath, value) {
  const text = canonicalJson(value);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  const temporaryPath = `${outputPath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fs.promises.writeFile(temporaryPath, text, { encoding: "utf8", flag: "wx" });
    await fs.promises.rename(temporaryPath, outputPath);
  } finally {
    await fs.promises.rm(temporaryPath, { force: true });
  }
}

async function main() {
  const unifiedText = await fs.promises.readFile(ASSET_MANIFEST_PATH, "utf8");
  let unified;
  try {
    unified = JSON.parse(unifiedText);
  } catch (error) {
    fail(`Unified desktop asset manifest is not valid JSON: ${error.message}`);
  }
  if (unifiedText !== canonicalJson(unified)) fail("Unified desktop asset manifest JSON is not canonical");
  const assetPaths = validateUnifiedManifest(unified);

  const unassigned = assetPaths.filter((assetPath) => (
    !belongsToCard(assetPath) && !belongsToBoard(assetPath) && !isLauncherOnly(assetPath)
  ));
  if (unassigned.length) fail(`Assets are outside all approved package boundaries: ${unassigned.slice(0, 20).join(", ")}`);

  const manifests = Object.create(null);
  for (const gameId of GAME_IDS) {
    const predicate = gameId === "card" ? belongsToCard : belongsToBoard;
    const assets = assetPaths
      .filter(predicate)
      .map((assetPath) => toAssetRecord(assetPath, unified.files[assetPath]));
    manifests[gameId] = buildGameManifest(gameId, unified.createdAt, assets);
  }

  const catalogGames = Object.create(null);
  for (const gameId of GAME_IDS) {
    let manifest = manifests[gameId];
    const filename = `${gameId}-assets-${manifest.assetSetSha256.slice(0, 16)}.json`;
    const outputPath = path.join(OUTPUT_ROOT, filename);
    manifest = await reuseExistingImmutableManifest(outputPath, manifest, unified.createdAt);
    manifests[gameId] = manifest;
    const manifestText = await writeImmutableJson(outputPath, manifest);
    catalogGames[gameId] = {
      releaseId: manifest.releaseId,
      manifestPath: `desktop/manifests/${filename}`,
      manifestSha256: sha256Text(manifestText),
      totalFiles: manifest.totalFiles,
      totalBytes: manifest.totalBytes,
    };
  }
  catalogGames.chess = { available: false };

  const catalog = {
    schema: 1,
    createdAt: unified.createdAt,
    sourceTrees: unified.sourceTrees,
    games: catalogGames,
  };
  await writeReplaceableJson(CATALOG_PATH, catalog);

  const sharedCount = assetPaths.filter(isSharedShell).length;
  const sharedBytes = assetPaths.filter(isSharedShell).reduce((sum, assetPath) => sum + unified.files[assetPath].size, 0);
  const launcherOnlyCount = assetPaths.filter(isLauncherOnly).length;
  console.log(
    `DESKTOP_GAME_CATALOG=PASS cardFiles=${manifests.card.totalFiles} cardBytes=${manifests.card.totalBytes} ` +
    `boardFiles=${manifests.board.totalFiles} boardBytes=${manifests.board.totalBytes} ` +
    `sharedFiles=${sharedCount} sharedBytes=${sharedBytes} launcherOnlyFiles=${launcherOnlyCount} chess=unavailable`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_GAME_CATALOG=FAIL ${error.message}`);
  process.exitCode = 1;
});
