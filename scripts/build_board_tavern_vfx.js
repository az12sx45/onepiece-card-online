const path = require("node:path");
const fs = require("node:fs");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const outfile = path.join(root, "public", "js", "board_tavern_vfx.bundle.js");
const result = esbuild.buildSync({
  entryPoints: [path.join(root, "src", "board_tavern_vfx.mjs")],
  outfile,
  bundle: true,
  minify: true,
  format: "iife",
  target: ["es2022"],
  platform: "browser",
  legalComments: "eof",
  write: false,
});
fs.writeFileSync(outfile, result.outputFiles[0].text.replace(/[ \t]+(?=\r?$)/gm, ""));
