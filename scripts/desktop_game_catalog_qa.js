const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const ASSET_MANIFEST_PATH = path.join(ROOT, "desktop", "generated", "asset-manifest.json");
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

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
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

function expectedByKind(assets) {
  const totals = Object.fromEntries(KINDS.map((kind) => [kind, { files: 0, bytes: 0 }]));
  for (const asset of assets) {
    totals[asset.kind].files += 1;
    totals[asset.kind].bytes += asset.size;
  }
  return totals;
}

async function readCanonicalJson(filePath, label) {
  const text = await fs.promises.readFile(filePath, "utf8");
  let value;
  try {
    value = JSON.parse(text);
  } catch (error) {
    fail(`${label} is not valid JSON: ${error.message}`);
  }
  if (text !== canonicalJson(value)) fail(`${label} JSON is not canonical`);
  return { text, value };
}

function validateUnified(unified) {
  if (!isPlainObject(unified) || unified.schema !== 2 || unified.sourceRoot !== "public") fail("Unified manifest schema/source is invalid");
  if (JSON.stringify(unified.includedRoots) !== JSON.stringify(ROOT_NAMES)) fail("Unified manifest roots are invalid");
  if (!isPlainObject(unified.sourceTrees) || Object.keys(unified.sourceTrees).join(",") !== ROOT_NAMES.join(",")) fail("Unified manifest sourceTrees are invalid");
  for (const rootName of ROOT_NAMES) {
    if (typeof unified.sourceTrees[rootName] !== "string" || !/^[a-f0-9]{40}(?:[a-f0-9]{24})?$/.test(unified.sourceTrees[rootName])) fail(`Invalid sourceTrees.${rootName}`);
  }
  if (typeof unified.createdAt !== "string" || Number.isNaN(Date.parse(unified.createdAt))) fail("Unified manifest createdAt is invalid");
  if (!isPlainObject(unified.files)) fail("Unified manifest files are invalid");
  const paths = Object.keys(unified.files);
  const sorted = [...paths].sort();
  if (paths.some((assetPath, index) => assetPath !== sorted[index])) fail("Unified manifest files are not sorted");
  for (const assetPath of paths) {
    validateAssetPath(assetPath);
    const record = unified.files[assetPath];
    if (
      !isPlainObject(record) || Object.keys(record).join(",") !== "kind,mime,size,sha256" ||
      !KINDS.includes(record.kind) || typeof record.mime !== "string" || !record.mime ||
      !Number.isSafeInteger(record.size) || record.size < 0 ||
      typeof record.sha256 !== "string" || !HASH_PATTERN.test(record.sha256)
    ) {
      fail(`Invalid unified asset record: ${assetPath}`);
    }
  }
  return paths;
}

function validateCatalog(catalog, unified) {
  const catalogFields = ["schema", "createdAt", "sourceTrees", "games"];
  if (!isPlainObject(catalog) || Object.keys(catalog).join(",") !== catalogFields.join(",")) fail("Catalog fields/order are invalid");
  if (catalog.schema !== 1 || catalog.createdAt !== unified.createdAt) fail("Catalog schema/createdAt is invalid");
  if (JSON.stringify(catalog.sourceTrees) !== JSON.stringify(unified.sourceTrees)) fail("Catalog sourceTrees do not match unified manifest");
  if (!isPlainObject(catalog.games) || Object.keys(catalog.games).join(",") !== "card,board,chess") fail("Catalog games/order are invalid");
  for (const gameId of GAME_IDS) {
    const record = catalog.games[gameId];
    const fields = ["releaseId", "manifestPath", "manifestSha256", "totalFiles", "totalBytes"];
    if (!isPlainObject(record) || Object.keys(record).join(",") !== fields.join(",")) fail(`Catalog ${gameId} fields/order are invalid`);
    if (typeof record.releaseId !== "string" || !/^assets-[a-f0-9]{16}$/.test(record.releaseId)) fail(`Catalog ${gameId} releaseId is invalid`);
    if (typeof record.manifestPath !== "string" || !new RegExp(`^desktop/manifests/${gameId}-assets-[a-f0-9]{16}\\.json$`).test(record.manifestPath)) fail(`Catalog ${gameId} manifestPath is invalid`);
    if (typeof record.manifestSha256 !== "string" || !HASH_PATTERN.test(record.manifestSha256)) fail(`Catalog ${gameId} manifestSha256 is invalid`);
    if (!Number.isSafeInteger(record.totalFiles) || record.totalFiles < 0 || !Number.isSafeInteger(record.totalBytes) || record.totalBytes < 0) fail(`Catalog ${gameId} totals are invalid`);
  }
  if (!isPlainObject(catalog.games.chess) || Object.keys(catalog.games.chess).join(",") !== "available" || catalog.games.chess.available !== false) {
    fail("Chess must remain explicitly unavailable without a manifest");
  }
}

function validateGameManifest(gameId, manifest, expectedAssets, unified) {
  const fields = ["schema", "gameId", "releaseId", "createdAt", "assetSetSha256", "totalFiles", "totalBytes", "byKind", "assets"];
  if (!isPlainObject(manifest) || Object.keys(manifest).join(",") !== fields.join(",")) fail(`${gameId} manifest fields/order are invalid`);
  if (manifest.schema !== 1 || manifest.gameId !== gameId) fail(`${gameId} manifest identity is invalid`);
  const manifestCreatedAt = Date.parse(manifest.createdAt);
  if (typeof manifest.createdAt !== "string" || Number.isNaN(manifestCreatedAt) || manifestCreatedAt > Date.parse(unified.createdAt)) {
    fail(`${gameId} manifest createdAt is invalid or newer than the catalog`);
  }
  if (typeof manifest.assetSetSha256 !== "string" || !HASH_PATTERN.test(manifest.assetSetSha256)) fail(`${gameId} assetSetSha256 is invalid`);
  if (manifest.releaseId !== `assets-${manifest.assetSetSha256.slice(0, 16)}`) fail(`${gameId} releaseId is not derived from its asset set`);
  if (!Array.isArray(manifest.assets)) fail(`${gameId} assets is not an array`);
  if (JSON.stringify(manifest.assets) !== JSON.stringify(expectedAssets)) fail(`${gameId} assets differ from approved package boundaries`);
  for (const asset of manifest.assets) {
    if (!isPlainObject(asset) || Object.keys(asset).join(",") !== "path,kind,mime,size,sha256") fail(`${gameId} asset fields/order are invalid: ${asset?.path || "unknown"}`);
  }
  const assetSetSha256 = sha256Text(JSON.stringify(manifest.assets));
  if (manifest.assetSetSha256 !== assetSetSha256) fail(`${gameId} assetSetSha256 mismatch`);
  if (manifest.totalFiles !== manifest.assets.length) fail(`${gameId} totalFiles mismatch`);
  const totalBytes = manifest.assets.reduce((sum, asset) => sum + asset.size, 0);
  if (!Number.isSafeInteger(totalBytes) || manifest.totalBytes !== totalBytes) fail(`${gameId} totalBytes mismatch`);
  const byKind = expectedByKind(manifest.assets);
  if (JSON.stringify(manifest.byKind) !== JSON.stringify(byKind)) fail(`${gameId} byKind totals mismatch`);
}

async function main() {
  const { value: unified } = await readCanonicalJson(ASSET_MANIFEST_PATH, "Unified desktop asset manifest");
  const assetPaths = validateUnified(unified);
  const unassigned = assetPaths.filter((assetPath) => !belongsToCard(assetPath) && !belongsToBoard(assetPath) && !isLauncherOnly(assetPath));
  if (unassigned.length) fail(`Assets are outside all approved package boundaries: ${unassigned.slice(0, 20).join(", ")}`);

  const { value: catalog } = await readCanonicalJson(CATALOG_PATH, "Desktop game catalog");
  validateCatalog(catalog, unified);

  const manifestPaths = new Set();
  const allGameAssets = [];
  for (const gameId of GAME_IDS) {
    const catalogRecord = catalog.games[gameId];
    if (manifestPaths.has(catalogRecord.manifestPath)) fail("Game catalog reuses a manifest path");
    manifestPaths.add(catalogRecord.manifestPath);
    const manifestPath = path.resolve(PUBLIC_ROOT, ...catalogRecord.manifestPath.split("/"));
    if (!isWithin(PUBLIC_ROOT, manifestPath)) fail(`${gameId} manifest escapes public`);
    const { text, value: manifest } = await readCanonicalJson(manifestPath, `${gameId} immutable manifest`);
    if (sha256Text(text) !== catalogRecord.manifestSha256) fail(`${gameId} manifest file SHA-256 mismatch`);
    const predicate = gameId === "card" ? belongsToCard : belongsToBoard;
    const expectedAssets = assetPaths.filter(predicate).map((assetPath) => toAssetRecord(assetPath, unified.files[assetPath]));
    validateGameManifest(gameId, manifest, expectedAssets, unified);
    if (catalogRecord.releaseId !== manifest.releaseId || catalogRecord.totalFiles !== manifest.totalFiles || catalogRecord.totalBytes !== manifest.totalBytes) {
      fail(`${gameId} catalog summary differs from immutable manifest`);
    }
    if (!catalogRecord.manifestPath.endsWith(`${manifest.assetSetSha256.slice(0, 16)}.json`)) fail(`${gameId} manifest filename does not contain its asset-set hash`);
    allGameAssets.push(...manifest.assets);
  }

  const sharedPaths = assetPaths.filter(isSharedShell);
  for (const sharedPath of sharedPaths) {
    for (const gameId of GAME_IDS) {
      const record = catalog.games[gameId];
      const manifestPath = path.resolve(PUBLIC_ROOT, ...record.manifestPath.split("/"));
      const manifest = JSON.parse(await fs.promises.readFile(manifestPath, "utf8"));
      if (!manifest.assets.some((asset) => asset.path === sharedPath && asset.sha256 === unified.files[sharedPath].sha256)) {
        fail(`Shared shell asset is missing from ${gameId}: ${sharedPath}`);
      }
    }
  }

  const uniqueBlobs = new Map();
  let logicalBytes = 0;
  for (const asset of allGameAssets) {
    logicalBytes += asset.size;
    const existing = uniqueBlobs.get(asset.sha256);
    if (existing !== undefined && existing !== asset.size) fail(`Same SHA-256 has conflicting sizes: ${asset.sha256}`);
    uniqueBlobs.set(asset.sha256, asset.size);
  }
  const casBytes = [...uniqueBlobs.values()].reduce((sum, size) => sum + size, 0);
  console.log(
    `DESKTOP_GAME_CATALOG_QA=PASS cardFiles=${catalog.games.card.totalFiles} boardFiles=${catalog.games.board.totalFiles} ` +
    `sharedFiles=${sharedPaths.length} launcherOnlyFiles=${assetPaths.filter(isLauncherOnly).length} ` +
    `logicalBytes=${logicalBytes} casBlobs=${uniqueBlobs.size} casBytes=${casBytes} chess=unavailable`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_GAME_CATALOG_QA=FAIL ${error.message}`);
  process.exitCode = 1;
});
