"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || path.join(__dirname, ".."));
const publicRoot = path.join(root, "public");
const requiredFiles = [
  "public/start.html",
  "public/game_launcher_preview.html",
  "public/css/game_launcher_preview.css",
  "public/js/game_launcher_preview.js",
  "public/board_start.html",
  "public/board_game.html",
  "public/board_fixed_viewport.html",
  "public/board_battle.html",
  "public/board_impel_down.html",
  "public/board_marineford.html",
  "public/board_water_seven.html",
  "public/board_spar_selection_demo.html",
  "public/board_york_clue_puzzle_formal_demo.html",
  "public/board_manifest.webmanifest",
  "public/chess/index.html",
  "public/chess/battle-game.html",
  "public/chess/battle-chess.css",
  "public/chess/battle-chess.js",
  "public/chess/battle-start-v1.js",
  "public/chess/battle-room-runtime-v1.js",
  "public/chess/pre-match-lobby.js",
  "public/desktop/catalog-v2.json",
  "public/js/board_shared.js",
  "public/js/board_start.js",
  "public/js/board_game.js",
  "public/js/board_battle.js",
  "public/js/board_items.js",
  "public/js/board_cosmetic_frame_preview.js",
  "server/index.js",
  "server/db.js",
  "package.json",
];
const runtimeSources = [
  "public/start.html",
  "public/game_launcher_preview.html",
  "public/board_start.html",
  "public/board_game.html",
  "public/board_fixed_viewport.html",
  "public/board_battle.html",
  "public/board_impel_down.html",
  "public/board_marineford.html",
  "public/board_water_seven.html",
  "public/board_spar_selection_demo.html",
  "public/board_york_clue_puzzle_formal_demo.html",
  "public/chess/index.html",
  "public/chess/battle-game.html",
  "public/chess/battle-chess.css",
  "public/chess/battle-chess.js",
  "public/chess/battle-game-loader-v1.js",
  "public/chess/battle-game-social-shell-v1.js",
  "public/chess/battle-room-runtime-v1.js",
  "public/chess/battle-social-v1.js",
  "public/chess/battle-start-v1.js",
  "public/chess/battlefield-profile-frame.js",
  "public/chess/multiplayer-config.js",
  "public/chess/player-header-ui.js",
  "public/chess/pre-match-lobby.js",
  "public/js/battle_hit_effect_settings.js",
  "public/js/battle_sfx_catalog.js",
  "public/js/bgm_manager.js",
  "public/js/bgm_metadata.js",
  "public/js/board_battle.js",
  "public/js/board_cards.js",
  "public/js/board_cosmetic_frame_preview.js",
  "public/js/board_enemy_spawn_regions.js",
  "public/js/board_game.js",
  "public/js/board_impel_down.js",
  "public/js/board_items.js",
  "public/js/board_lineage_extraction.js",
  "public/js/board_lobby.js",
  "public/js/board_map_align.js",
  "public/js/board_map_layout_override.js",
  "public/js/board_missions.js",
  "public/js/board_shared.js",
  "public/js/board_start.js",
  "public/js/board_york_clue_puzzle.js",
  "public/js/choose_bgm.js",
  "public/js/onepiece_prebattle_lines.js",
];

function walk(dir){
  if(!fs.existsSync(dir)) return [];
  const output = [];
  for(const entry of fs.readdirSync(dir, { withFileTypes:true })){
    const full = path.join(dir, entry.name);
    if(entry.isDirectory()) output.push(...walk(full));
    else if(entry.isFile()) output.push(full);
  }
  return output;
}

const errors = [];
for(const relative of requiredFiles){
  if(!fs.existsSync(path.join(root, relative))) errors.push(`required file missing: ${relative}`);
}

const allPublicFiles = walk(publicRoot);
for(const full of allPublicFiles){
  const relative = path.relative(root, full).replace(/\\/g, "/");
  if(relative.split("/").some((part) => part.toLowerCase() === "incoming")){
    errors.push(`incoming source included: ${relative}`);
  }
  const size = fs.statSync(full).size;
  if(size >= 100 * 1024 * 1024) errors.push(`GitHub 100 MiB limit exceeded: ${relative}`);
}

if(fs.existsSync(path.join(publicRoot, "battle_chess"))) errors.push("battle_chess junction/content must not deploy");
if(fs.existsSync(path.join(publicRoot, "images", "secret_modes"))) errors.push("secret_modes chess art must not deploy");

const startText = fs.readFileSync(path.join(publicRoot, "start.html"), "utf8");
if(startText.includes("secret-mode-chess") || startText.includes("battle_chess/index.html")){
  errors.push("start.html still contains the retired local Chess entrance");
}
if(!startText.includes("secret-mode-board") || !startText.includes("game_launcher_preview.html?from=card-secret")){
  errors.push("start.html tabletop launcher secret entrance is missing");
}

const launcherText = fs.readFileSync(path.join(publicRoot, "game_launcher_preview.html"), "utf8");
if(/\shref=["'](?:battle_chess|chess)\//i.test(launcherText)) errors.push("browser launcher contains a production Chess link before R2 CORS approval");
if(launcherText.includes("chess_king_attack_preview")) errors.push("launcher contains an unreviewed Chess preview video");
if(!launcherText.includes('href="start.html"') || !launcherText.includes('href="board_start.html"')){
  errors.push("launcher Card or Board link is missing");
}

const literalAssetPattern = /["'`](?:\.\/)?((?:images|audio|videos|fonts)\/[^"'`\s<>?#)]+)(?:\?[^"'`\s<>]*)?["'`]/g;
const checkedAssets = new Set();
for(const relative of runtimeSources){
  const full = path.join(root, relative);
  if(!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for(const match of text.matchAll(literalAssetPattern)){
    const asset = match[1];
    if(asset.includes("${") || asset.includes("+") || asset.endsWith("/") || asset.includes("/custom_mp")) continue;
    checkedAssets.add(asset);
    if(!fs.existsSync(path.join(publicRoot, ...asset.split("/")))) errors.push(`literal asset missing: ${asset} <- ${relative}`);
  }
}

const checkedLinkedFiles = new Set();
const linkedFilePattern = /<(?:script|link)\b[^>]*(?:src|href)=["']([^"']+)["']/gi;
for(const relative of runtimeSources.filter((entry) => entry.endsWith(".html"))){
  const full = path.join(root, relative);
  if(!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for(const match of text.matchAll(linkedFilePattern)){
    const raw = match[1].trim();
    if(!raw || raw.startsWith("#") || /^(?:https?:|data:|blob:|javascript:)/i.test(raw)) continue;
    if(raw.startsWith("/socket.io/")) continue;
    const clean = raw.split(/[?#]/, 1)[0];
    const target = clean.startsWith("/")
      ? path.join(publicRoot, ...clean.slice(1).split("/"))
      : path.resolve(path.dirname(full), ...clean.split("/"));
    checkedLinkedFiles.add(path.relative(root, target).replace(/\\/g, "/"));
    if(!fs.existsSync(target)) errors.push(`linked runtime file missing: ${raw} <- ${relative}`);
  }
}

const runtimePagePattern = /["'`]((?:\.\/)?board_[a-z0-9_-]+\.html)(?:\?[^"'`]*)?["'`]/gi;
for(const relative of runtimeSources){
  const full = path.join(root, relative);
  if(!fs.existsSync(full)) continue;
  const text = fs.readFileSync(full, "utf8");
  for(const match of text.matchAll(runtimePagePattern)){
    const clean = match[1].replace(/^\.\//, "");
    checkedLinkedFiles.add(`public/${clean}`);
    if(!fs.existsSync(path.join(publicRoot, clean))) errors.push(`runtime page missing: ${clean} <- ${relative}`);
  }
}

const privateStateFiles = [
  ...walk(path.join(root, "server", "data", "board_saves")),
  ...walk(path.join(root, "server", "data", "board_campaigns")),
].filter((full) => full.toLowerCase().endsWith(".json"));
if(privateStateFiles.length) errors.push(`private Board state included: ${privateStateFiles.length} JSON files`);

if(errors.length){
  console.error(errors.join("\n"));
  process.exit(1);
}

const totalBytes = allPublicFiles.reduce((sum, full) => sum + fs.statSync(full).size, 0);
console.log(`DEPLOYMENT_ASSET_MANIFEST_QA=PASS files=${allPublicFiles.length} literalAssets=${checkedAssets.size} linkedFiles=${checkedLinkedFiles.size} publicMiB=${(totalBytes/1024/1024).toFixed(2)}`);
