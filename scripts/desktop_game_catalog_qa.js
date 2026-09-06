const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PUBLIC_ROOT = path.join(ROOT, "public");
const ASSET_MANIFEST_PATH = path.join(ROOT, "desktop", "generated", "asset-manifest.json");
const ASSET_DELIVERY_CONFIG_PATH = path.join(ROOT, "config", "desktop-asset-delivery-v1.json");
const CHESS_ASSET_CONFIG_PATH = path.join(ROOT, "config", "desktop-chess-assets-v1.json");
const CATALOG_PATH = path.join(PUBLIC_ROOT, "desktop", "catalog-v2.json");
const ROOT_NAMES = ["images", "audio", "videos", "fonts"];
const KINDS = ["image", "audio", "video", "font"];
const GAME_IDS = ["card", "board"];
const CATALOG_GAME_IDS = ["card", "board", "chess"];
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const STABLE_GAME_MANIFESTS = Object.freeze({
  card: Object.freeze({
    manifestPath: "desktop/manifests/card-assets-440918e609684317.json",
    manifestSha256: "46bc6d59f66c6ec5c26e2d7291c5b1ec65f466f6c2a70560c6a39ba11faed263",
  }),
  board: Object.freeze({
    manifestPath: "desktop/manifests/board-assets-eb95373ee6ab1aa3.json",
    manifestSha256: "c1d6736b6687d1146397607607c9e9fe63f93acf2f83aa5fe5fc68cd34f32c82",
  }),
});

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

function validateAssetBlobBaseUrl(value, label) {
  if (typeof value !== "string" || !value) fail(`${label} must be a non-empty string`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    fail(`${label} is not a valid URL`);
  }
  if (
    parsed.protocol !== "https:" || parsed.username || parsed.password ||
    parsed.search || parsed.hash || parsed.pathname === "/" || parsed.pathname.endsWith("/") ||
    `${parsed.origin}${parsed.pathname}` !== value
  ) {
    fail(`${label} must be a normalized HTTPS URL without credentials, query, hash, or trailing slash`);
  }
  return value;
}

function validateAssetDeliveryConfig(config) {
  const fields = ["schema", "assetBlobBaseUrl"];
  if (!isPlainObject(config) || Object.keys(config).join(",") !== fields.join(",")) {
    fail("Desktop asset delivery config fields/order are invalid");
  }
  if (config.schema !== 1) fail("Desktop asset delivery config schema is invalid");
  validateAssetBlobBaseUrl(config.assetBlobBaseUrl, "Desktop asset delivery config assetBlobBaseUrl");
  return config;
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

const DESKTOP_ONLY_GAME_LAUNCHER_ASSETS = new Set([
  "images/game_launcher/launcher_board_box_shell_fixed_v1.png",
  "images/game_launcher/launcher_board_lid_front_panel_v1.png",
  "images/game_launcher/launcher_card_box_shell_fixed_v1.png",
  "images/game_launcher/launcher_card_lid_front_panel_v1.png",
  "images/game_launcher/launcher_chess_box_shell_fixed_v1.png",
  "images/game_launcher/launcher_chess_lid_front_panel_v1.png",
]);

function isSharedShell(assetPath) {
  return !isLauncherOnly(assetPath) && (
    assetPath === "images/icon-192.png" ||
    assetPath === "images/board/items/odd_dice.webp" ||
    assetPath.startsWith("images/game_launcher/") ||
    assetPath.startsWith("videos/game_launcher/")
  );
}

function isLauncherOnly(assetPath) {
  return assetPath.startsWith("images/desktop_launcher/") || DESKTOP_ONLY_GAME_LAUNCHER_ASSETS.has(assetPath);
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
      !assetPath.startsWith("images/chess/assets/") &&
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

function validateCatalog(catalog, unified, deliveryConfig) {
  const catalogFieldsWithoutAssetOrigin = ["schema", "createdAt", "sourceTrees", "games"];
  const catalogFieldsWithAssetOrigin = ["schema", "createdAt", "assetBlobBaseUrl", "sourceTrees", "games"];
  const actualCatalogFields = isPlainObject(catalog) ? Object.keys(catalog) : [];
  if (
    actualCatalogFields.join(",") !== catalogFieldsWithoutAssetOrigin.join(",") &&
    actualCatalogFields.join(",") !== catalogFieldsWithAssetOrigin.join(",")
  ) {
    fail("Catalog fields/order are invalid");
  }
  if (
    catalog.schema !== 2 || typeof catalog.createdAt !== "string" || Number.isNaN(Date.parse(catalog.createdAt)) ||
    Date.parse(catalog.createdAt) < Date.parse(unified.createdAt)
  ) fail("Catalog schema/createdAt is invalid");
  if (catalog.assetBlobBaseUrl !== undefined) {
    validateAssetBlobBaseUrl(catalog.assetBlobBaseUrl, "Catalog assetBlobBaseUrl");
  }
  if (catalog.assetBlobBaseUrl !== deliveryConfig.assetBlobBaseUrl) {
    fail("Catalog assetBlobBaseUrl does not match desktop asset delivery config");
  }
  if (JSON.stringify(catalog.sourceTrees) !== JSON.stringify(unified.sourceTrees)) fail("Catalog sourceTrees do not match unified manifest");
  if (!isPlainObject(catalog.games) || Object.keys(catalog.games).join(",") !== "card,board,chess") fail("Catalog games/order are invalid");
  for (const gameId of CATALOG_GAME_IDS) {
    const record = catalog.games[gameId];
    const fields = ["releaseId", "manifestPath", "manifestSha256", "totalFiles", "totalBytes"];
    if (!isPlainObject(record) || Object.keys(record).join(",") !== fields.join(",")) fail(`Catalog ${gameId} fields/order are invalid`);
    if (typeof record.releaseId !== "string" || !/^assets-[a-f0-9]{16}$/.test(record.releaseId)) fail(`Catalog ${gameId} releaseId is invalid`);
    if (typeof record.manifestPath !== "string" || !new RegExp(`^desktop/manifests/${gameId}-assets-[a-f0-9]{16}\\.json$`).test(record.manifestPath)) fail(`Catalog ${gameId} manifestPath is invalid`);
    if (typeof record.manifestSha256 !== "string" || !HASH_PATTERN.test(record.manifestSha256)) fail(`Catalog ${gameId} manifestSha256 is invalid`);
    if (!Number.isSafeInteger(record.totalFiles) || record.totalFiles < 1 || !Number.isSafeInteger(record.totalBytes) || record.totalBytes < 1) fail(`Catalog ${gameId} totals are invalid`);
  }
  for (const [gameId, expected] of Object.entries(STABLE_GAME_MANIFESTS)) {
    if (catalog.games[gameId].manifestPath !== expected.manifestPath) fail(`${gameId} manifest path changed during the Chess release`);
    if (catalog.games[gameId].manifestSha256 !== expected.manifestSha256) fail(`${gameId} immutable manifest bytes changed during the Chess release`);
  }
}

async function readChessManifest(catalog) {
  const { value: config } = await readCanonicalJson(CHESS_ASSET_CONFIG_PATH, "Desktop Chess asset config");
  if (
    !isPlainObject(config) || Object.keys(config).join(",") !== "schema,manifestPath,manifestSha256" ||
    config.schema !== 1 || !/^desktop\/manifests\/chess-assets-[a-f0-9]{16}\.json$/.test(String(config.manifestPath || "")) ||
    !HASH_PATTERN.test(String(config.manifestSha256 || ""))
  ) fail("Desktop Chess asset config is invalid");
  const { text, value: manifest } = await readCanonicalJson(
    path.resolve(PUBLIC_ROOT, ...config.manifestPath.split("/")),
    "Chess immutable manifest",
  );
  if (sha256Text(text) !== config.manifestSha256) fail("Chess immutable manifest SHA-256 differs from config");
  const record = catalog.games.chess;
  if (
    record.manifestPath !== config.manifestPath || record.manifestSha256 !== config.manifestSha256 ||
    record.releaseId !== manifest.releaseId || record.totalFiles !== manifest.totalFiles || record.totalBytes !== manifest.totalBytes
  ) fail("Chess catalog entry differs from its immutable manifest/config");
  const fields = ["schema", "gameId", "releaseId", "createdAt", "assetSetSha256", "totalFiles", "totalBytes", "byKind", "assets"];
  if (!isPlainObject(manifest) || Object.keys(manifest).join(",") !== fields.join(",") || manifest.schema !== 1 || manifest.gameId !== "chess") {
    fail("Chess immutable manifest fields/identity are invalid");
  }
  if (typeof manifest.createdAt !== "string" || Number.isNaN(Date.parse(manifest.createdAt)) || Date.parse(manifest.createdAt) > Date.parse(catalog.createdAt)) {
    fail("Chess immutable manifest createdAt is invalid or newer than catalog");
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length < 1) fail("Chess immutable manifest contains no assets");
  let previousPath = "";
  for (const asset of manifest.assets) {
    validateAssetPath(asset?.path);
    if (!asset.path.startsWith("images/chess/assets/")) fail(`Chess asset escaped its logical prefix: ${asset.path}`);
    if (previousPath && previousPath >= asset.path) fail("Chess manifest assets are not strictly sorted");
    previousPath = asset.path;
    if (
      !isPlainObject(asset) || Object.keys(asset).join(",") !== "path,kind,mime,size,sha256" ||
      !KINDS.includes(asset.kind) || typeof asset.mime !== "string" || !asset.mime ||
      !Number.isSafeInteger(asset.size) || asset.size < 1 || !HASH_PATTERN.test(String(asset.sha256 || ""))
    ) fail(`Chess manifest asset metadata is invalid: ${asset.path}`);
  }
  if (manifest.assetSetSha256 !== sha256Text(JSON.stringify(manifest.assets))) fail("Chess assetSetSha256 mismatch");
  if (manifest.releaseId !== `assets-${manifest.assetSetSha256.slice(0, 16)}`) fail("Chess releaseId is not derived from its asset set");
  if (manifest.totalFiles !== manifest.assets.length) fail("Chess totalFiles mismatch");
  if (manifest.totalBytes !== manifest.assets.reduce((sum, asset) => sum + asset.size, 0)) fail("Chess totalBytes mismatch");
  if (JSON.stringify(manifest.byKind) !== JSON.stringify(expectedByKind(manifest.assets))) fail("Chess byKind totals mismatch");
  return manifest;
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
  const { value: deliveryConfigValue } = await readCanonicalJson(
    ASSET_DELIVERY_CONFIG_PATH,
    "Desktop asset delivery config",
  );
  const deliveryConfig = validateAssetDeliveryConfig(deliveryConfigValue);
  const { value: unified } = await readCanonicalJson(ASSET_MANIFEST_PATH, "Unified desktop asset manifest");
  const assetPaths = validateUnified(unified);
  const unassigned = assetPaths.filter((assetPath) => !belongsToCard(assetPath) && !belongsToBoard(assetPath) && !isLauncherOnly(assetPath));
  if (unassigned.length) fail(`Assets are outside all approved package boundaries: ${unassigned.slice(0, 20).join(", ")}`);

  const { value: catalog } = await readCanonicalJson(CATALOG_PATH, "Desktop game catalog");
  validateCatalog(catalog, unified, deliveryConfig);
  const chessManifest = await readChessManifest(catalog);
  const expectedCatalogCreatedAt = new Date(Math.max(Date.parse(unified.createdAt), Date.parse(chessManifest.createdAt))).toISOString();
  if (catalog.createdAt !== expectedCatalogCreatedAt) fail("Catalog createdAt does not cover both unified and Chess manifests");

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
  allGameAssets.push(...chessManifest.assets);

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
    `DESKTOP_GAME_CATALOG_QA=PASS cardFiles=${catalog.games.card.totalFiles} boardFiles=${catalog.games.board.totalFiles} chessFiles=${catalog.games.chess.totalFiles} ` +
    `sharedFiles=${sharedPaths.length} launcherOnlyFiles=${assetPaths.filter(isLauncherOnly).length} ` +
    `logicalBytes=${logicalBytes} casBlobs=${uniqueBlobs.size} casBytes=${casBytes}`,
  );
}

main().catch((error) => {
  console.error(`DESKTOP_GAME_CATALOG_QA=FAIL ${error.message}`);
  process.exitCode = 1;
});
