const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MOBILE_ROOT = path.join(ROOT, "public", "images", "board", "mobile");
const OUTPUT = path.join(MOBILE_ROOT, "manifest-v397.json");
const VERSION = "20260831-portable-prefetch-v397";
const SOURCE_DIRS = ["avatars", "decorations", "islands", "ships"];
const DEFERRED_ASSETS = [
  "images/board/evolution_ui/evolution_portrait_frame_v1.webp",
  "images/board/item_reveal_ui/important_item_reveal_panel_frame.webp",
  "images/board/postgame_clue_ui/york_clue_playing_card_frame_v2.webp",
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

const assets = SOURCE_DIRS
  .flatMap((directory) => walk(path.join(MOBILE_ROOT, directory)))
  .filter((file) => /\.webp$/i.test(file))
  .map((file) => path.relative(path.join(ROOT, "public"), file).replace(/\\/g, "/"))
  .sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

if (assets.length !== 105) {
  throw new Error(`Expected 105 portable Board images, found ${assets.length}`);
}

const missingDeferredAssets = DEFERRED_ASSETS.filter((asset) => !fs.existsSync(path.join(ROOT, "public", asset)));
if (missingDeferredAssets.length) {
  throw new Error(`Missing deferred Board assets: ${missingDeferredAssets.join(", ")}`);
}

const output = {
  schema: 1,
  version: VERSION,
  assets,
  deferredAssets: DEFERRED_ASSETS,
};

fs.writeFileSync(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`BOARD_MOBILE_PREFETCH_MANIFEST=${assets.length + DEFERRED_ASSETS.length}`);
