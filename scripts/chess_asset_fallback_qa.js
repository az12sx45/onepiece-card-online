"use strict";

// Read-only tests of the actual server fallback block, with an in-memory FS.
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const source = fs.readFileSync(path.join(root, "server/index.js"), "utf8");
const start = source.indexOf('const CHESS_ASSET_PREFIX =');
const end = source.indexOf('app.use("/api/board-save"', start);
assert.ok(start > source.indexOf("app.use(express.static("), "local static handler must precede fallback");
assert.ok(end > start);
const block = source.slice(start, end);
assert.ok(block.includes('"catalog-v2.json"'));
assert.ok(!block.includes('"catalog-v1.json"'));
const assetPath = "images/chess/assets/characters/test/standing/front.webp";
const hash = "a".repeat(64);
const records = [{ path:assetPath, kind:"image", mime:"image/webp", size:123, sha256:hash }];
function fixture(assets = records) {
  const byKind = Object.fromEntries(["image", "audio", "video", "font"].map((kind) => [kind, { files:0, bytes:0 }]));
  for (const asset of assets) if (Object.hasOwn(byKind, asset.kind)) { byKind[asset.kind].files++; byKind[asset.kind].bytes += asset.size; }
  const manifest = { schema:1, gameId:"chess", releaseId:"assets-qa", totalFiles:assets.length,
    totalBytes:assets.reduce((sum, asset) => sum + asset.size, 0), byKind, assets };
  const bytes = Buffer.from(JSON.stringify(manifest));
  const catalog = { schema:2, games:{ chess:{ releaseId:manifest.releaseId,
    manifestPath:"desktop/manifests/chess-assets-qa.json",
    manifestSha256:crypto.createHash("sha256").update(bytes).digest("hex"),
    totalFiles:manifest.totalFiles, totalBytes:manifest.totalBytes } } };
  return { catalog, bytes };
}
let fixtureState = fixture(), revision = 1, manifestReads = 0, handler;
const context = {
  crypto, path, publicDir, Buffer,
  fs:{
    async lstat(file) {
      const bytes = String(file).endsWith("catalog-v2.json") ? Buffer.from(JSON.stringify(fixtureState.catalog)) : fixtureState.bytes;
      return { isFile:() => true, size:bytes.length, mtimeMs:revision, ctimeMs:revision };
    },
    async readFile(file) {
      if (String(file).endsWith("catalog-v2.json")) return Buffer.from(JSON.stringify(fixtureState.catalog));
      manifestReads++;
      return fixtureState.bytes;
    },
  },
  app:{ get(route, callback) { assert.strictEqual(route, "/images/chess/assets/*"); handler = callback; } },
};
vm.createContext(context);
vm.runInContext(block, context);
function verify(current) { return context.verifyChessAssetManifest(current.catalog, current.bytes); }
async function request(requestPath) {
  const result = { status:200, headers:{}, next:false };
  const res = {
    status(code) { result.status = code; return this; }, type(value) { result.type = value; return this; },
    send(body) { result.body = body; return this; }, setHeader(name, value) { result.headers[name] = value; },
    redirect(code, location) { result.status = code; result.location = location; return this; },
  };
  await handler({ path:requestPath }, res, () => { result.next = true; });
  return result;
}
async function main() {
  const valid = verify(fixture());
  assert.strictEqual(valid.size, 1);
  assert.strictEqual(valid.get(assetPath), `https://game-assets.rihdi.tw/desktop/blobs/sha256/aa/${hash}`);
  const invalidPaths = ["images/chess/assets/../secret", "images/chess/assets/a/./x", "images/chess/assets/a//x",
    "images/chess/assets/a\\x", "images/chess/assets/%2e%2e/secret", "images/chess/assets/file?token=private",
    "images/chess/assets/file#x", "images/chess/assets/file\u0000", "/images/chess/assets/file", "images/board/file"];
  for (const invalid of invalidPaths) {
    assert.strictEqual(context.validChessAssetPath(invalid), false, invalid);
    assert.throws(() => verify(fixture([{ ...records[0], path:invalid }])));
  }
  for (const mutate of [
    (value) => { value.catalog.schema = 1; },
    (value) => { value.catalog.games.chess.available = false; },
    (value) => { value.catalog.games.chess.manifestPath = "desktop/manifests/../../.env"; },
    (value) => { value.catalog.games.chess.manifestSha256 = "0".repeat(64); },
    (value) => { value.catalog.games.chess.totalBytes++; },
    (value) => { value.catalog.games.chess.totalFiles++; },
    (value) => { value.catalog.games.chess.releaseId = "other"; },
  ]) { const bad = fixture(); mutate(bad); assert.throws(() => verify(bad)); }
  for (const asset of [
    { ...records[0], sha256:"https://evil.example/blob" }, { ...records[0], size:-1 },
    { ...records[0], kind:"__proto__" }, { ...records[0], mime:"image/webp\r\nX-Test: injected" },
  ]) assert.throws(() => verify(fixture([asset])));
  assert.throws(() => verify(fixture([records[0], records[0]])));
  for (const mutate of [
    (manifest) => { manifest.schema = 2; }, (manifest) => { manifest.gameId = "board"; },
    (manifest) => { manifest.byKind.image.bytes++; }, (manifest) => { manifest.byKind.other = {}; },
  ]) {
    const bad = fixture(), manifest = JSON.parse(bad.bytes); mutate(manifest);
    bad.bytes = Buffer.from(JSON.stringify(manifest));
    bad.catalog.games.chess.manifestSha256 = crypto.createHash("sha256").update(bad.bytes).digest("hex");
    assert.throws(() => verify(bad));
  }
  const parallel = await Promise.all(Array.from({ length:8 }, () => request(`/${assetPath}`)));
  assert.ok(parallel.every((result) => result.status === 302 && result.headers["Cache-Control"] === "no-store"));
  assert.strictEqual(manifestReads, 1, "parallel static misses should share one verified manifest decode");
  assert.strictEqual((await request("/images/chess/assets/unknown.webp")).next, true);
  for (const invalid of ["/images/chess/assets/%", "/images/chess/assets/%2e%2e/secret", "/images/chess/assets/%252e%252e/secret", "/images/chess/assets/a%5cb"]) {
    assert.strictEqual((await request(invalid)).status, 400, invalid);
  }
  fixtureState.bytes = Buffer.from("invalid manifest"); revision++;
  const failure = await request(`/${assetPath}`);
  assert.strictEqual(failure.status, 503);
  assert.strictEqual(failure.body, "Chess assets temporarily unavailable.");
  fixtureState = fixture(); revision++;
  assert.strictEqual((await request(`/${assetPath}`)).status, 302, "failed cache must recover after a valid manifest replaces it");
  const catalogPath = path.join(publicDir, "desktop/catalog-v2.json");
  let release = null;
  if (fs.existsSync(catalogPath)) {
    const catalog = JSON.parse(fs.readFileSync(catalogPath));
    const bytes = fs.readFileSync(path.join(publicDir, catalog.games.chess.manifestPath));
    const actual = context.verifyChessAssetManifest(catalog, bytes);
    release = { files:actual.size, bytes:catalog.games.chess.totalBytes, manifest:catalog.games.chess.manifestPath };
  }
  console.log(JSON.stringify({ ok:true, staticPriority:true, catalogV2Only:true, digestAndShape:true,
    traversalRejected:true, safeFixedOrigin:true, singleFlight:true, invalidCacheRecovery:true, release }, null, 2));
  console.log("CHESS_ASSET_FALLBACK_QA=PASS");
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
