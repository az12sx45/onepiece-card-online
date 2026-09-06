"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const chessDir = path.join(publicDir, "chess");
const programFiles = ["index.html", "battle-game.html", "battle-start-v1.css", "battle-start-v1.js",
  "battle-social-v1.js", "battle-chess.css", "battle-chess.js", "battle-game-loader-v1.js",
  "battle-game-social-shell-v1.js", "battle-room-runtime-v1.js", "battle-click-priority-fix.js",
  "battlefield-profile-frame.js", "player-header-ui.js", "pre-match-lobby.js", "multiplayer-config.js", "favicon.svg"];
const vendorFiles = ["COPYING.txt", "SOURCE.md", "stockfish-18-lite-single.js", "stockfish-18-lite-single.wasm"];
const vendorRoot = "assets/vendor/stockfish-18.0.0/";
const localAvatars = ["images/board/avatars/50.webp", "images/board/avatars/cpu2.webp"];
for (const file of [...programFiles, ...vendorFiles.map((name) => vendorRoot + name), ...localAvatars]) {
  assert.ok(fs.statSync(path.join(chessDir, file)).isFile(), `missing ${file}`);
}
assert.deepStrictEqual(fs.readdirSync(chessDir).filter((name) => fs.statSync(path.join(chessDir, name)).isFile()).sort(), [...programFiles].sort());
assert.match(fs.readFileSync(path.join(chessDir, vendorRoot, "COPYING.txt"), "utf8"), /GNU GENERAL PUBLIC LICENSE/);
assert.match(fs.readFileSync(path.join(chessDir, vendorRoot, "SOURCE.md"), "utf8"), /github\.com\/nmrugg\/stockfish\.js/);
const catalog = JSON.parse(fs.readFileSync(path.join(publicDir, "desktop/catalog-v2.json")));
assert.strictEqual(catalog.schema, 2);
const entry = catalog.games.chess;
const manifestBytes = fs.readFileSync(path.join(publicDir, entry.manifestPath));
assert.strictEqual(crypto.createHash("sha256").update(manifestBytes).digest("hex"), entry.manifestSha256);
const manifest = JSON.parse(manifestBytes);
assert.strictEqual(manifest.schema, 1);
assert.strictEqual(manifest.gameId, "chess");
const assetPaths = new Set(manifest.assets.map((asset) => `/${asset.path}`));

// Scan just path-containing literals, including nested template expressions
// (the bundled runtime uses `0` inside padStart expressions). Template families
// are checked against manifest patterns, not misreported as concrete URLs.
function readLiteral(text, start) {
  const quote = text[start];
  let value = "";
  for (let index = start + 1; index < text.length; index++) {
    const char = text[index];
    if (char === "\\") { value += text[++index] || ""; continue; }
    if (char === quote) return { value, end:index };
    if (quote === "`" && char === "$" && text[index + 1] === "{") {
      index = skipExpression(text, index + 2);
      value += "${*}";
    } else value += char;
  }
  throw new Error("unterminated asset literal");
}
function skipExpression(text, start) {
  let depth = 1;
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (["'", '"', "`"].includes(char)) index = readLiteral(text, index).end;
    else if (char === "{") depth++;
    else if (char === "}" && --depth === 0) return index;
  }
  throw new Error("unterminated asset template expression");
}
const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const checked = { literal:0, directory:0, template:0, vendor:0, javascript:0 };
const failures = [];
for (const file of programFiles) {
  const source = fs.readFileSync(path.join(chessDir, file), "utf8");
  assert.ok(!/(?:^|[\s"'`(=])D:[\\/]/im.test(source), `D-drive absolute path in ${file}`);
  if (file.endsWith(".js")) {
    execFileSync(process.execPath, ["--check", path.join(chessDir, file)], { stdio:"pipe" });
    checked.javascript++;
  }
  for (const match of source.matchAll(/\/images\/chess\/assets\/|\.\/assets\//g)) {
    const preceding = source[match.index - 1];
    let raw;
    if (["'", '"', "`"].includes(preceding)) raw = readLiteral(source, match.index - 1).value;
    else raw = source.slice(match.index).split(/[\s)'"`;<>]/, 1)[0];
    if (raw.startsWith("./assets/")) {
      assert.strictEqual(file, "battle-room-runtime-v1.js", `unexpected relative assets in ${file}`);
      assert.ok(["./" + vendorRoot + "stockfish-18-lite-single.js", "./" + vendorRoot + "stockfish-18-lite-single.wasm"].includes(raw), raw);
      checked.vendor++;
      continue;
    }
    const logical = raw.split("?", 1)[0];
    if (logical.includes("${*}")) {
      const pattern = new RegExp("^" + logical.split("${*}").map(escape).join(".*") + "$");
      if (![...assetPaths].some((asset) => pattern.test(asset))) failures.push({ file, raw, kind:"template" });
      checked.template++;
    } else if (assetPaths.has(logical)) checked.literal++;
    else if ([...assetPaths].some((asset) => asset.startsWith(logical.replace(/\/$/, "") + "/"))) checked.directory++;
    else failures.push({ file, raw, kind:"literal" });
  }
}
assert.strictEqual(checked.vendor, 2);
assert.deepStrictEqual(failures, []);
assert.ok(checked.literal > 0);
console.log(JSON.stringify({ ok:true, programFiles:programFiles.length, vendorFiles:vendorFiles.length,
  localAvatars:localAvatars.length, requiredFiles:programFiles.length + vendorFiles.length + localAvatars.length,
  manifestAssets:assetPaths.size, manifestBytes:entry.totalBytes, checked,
  limits:"Template families match existing manifest paths; this is not an exhaustive runtime/browser traversal." }, null, 2));
console.log("CHESS_RELEASE_BUNDLE_QA=PASS");
