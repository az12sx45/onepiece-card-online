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
  metafile: true,
  write: false,
});

const bundledPackages = new Set();
for (const input of Object.keys(result.metafile.inputs)) {
  const match = input.replaceAll("\\", "/").match(/(?:^|\/)node_modules\/((?:@[^/]+\/)?[^/]+)/);
  if (match) bundledPackages.add(match[1]);
}

const colordLicense = `MIT License

Copyright (c) 2020 Vlad Shilov omgovich@ya.ru

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;

const notices = [];
for (const name of [...bundledPackages].sort()) {
  if (name === "gsap") continue; // esbuild retains GSAP's own standard-license notice.
  const packageDir = path.join(root, "node_modules", ...name.split("/"));
  const licenseFile = fs.readdirSync(packageDir).find((file) => /^licen[cs]e(?:\.|$)/i.test(file));
  const license = licenseFile
    ? fs.readFileSync(path.join(packageDir, licenseFile), "utf8")
    : name === "@pixi/colord" ? colordLicense : null;
  if (!license) throw new Error(`Missing bundled dependency license: ${name}`);
  if (license.includes("*/")) throw new Error(`Unsafe bundled dependency license: ${name}`);
  notices.push(`/*! ${name} license\n${license.trim()}\n*/`);
}
if (!bundledPackages.has("gsap") || !result.outputFiles[0].text.includes("https://gsap.com/standard-license")) {
  throw new Error("GSAP's bundled license notice is missing");
}

const bundle = `${result.outputFiles[0].text.replace(/[ \t]+(?=\r?$)/gm, "")}\n${notices.join("\n\n")}\n`;
fs.writeFileSync(outfile, bundle);
