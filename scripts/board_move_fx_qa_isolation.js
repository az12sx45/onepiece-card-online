"use strict";

// Opt-in preload for the move-effect browser fixture. Production never loads it.
// Remap the server's fixed save directory, including reads, into disposable QA
// storage before npm start imports server/index.js. No real campaign is opened.
const path = require("node:path");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const { fileURLToPath } = require("node:url");
const destination = process.env.BOARD_MOVE_FX_QA_DATA;
if (!destination) throw new Error("BOARD_MOVE_FX_QA_DATA is required for QA isolation");
const source = path.resolve(__dirname, "../server/data");
const target = path.resolve(destination);
if (target === source || target.startsWith(source + path.sep)) throw new Error("QA data must be outside production data");
delete process.env.DATABASE_URL;
fs.mkdirSync(target, { recursive: true });
function redirect(value) {
  if (!(typeof value === "string" || Buffer.isBuffer(value) || value instanceof URL)) return value;
  const file = path.resolve(value instanceof URL ? fileURLToPath(value) : String(value));
  const relative = path.relative(source, file);
  if (!relative || (!relative.startsWith(".." + path.sep) && relative !== ".." && !path.isAbsolute(relative))) return path.join(target, relative);
  return value;
}
for (const api of [fs, fsp]) {
  for (const name of ["readFile", "writeFile", "appendFile", "mkdir", "readdir", "stat", "lstat", "access", "unlink", "rm", "open", "readFileSync", "writeFileSync", "appendFileSync", "mkdirSync", "readdirSync", "statSync", "lstatSync", "accessSync", "unlinkSync", "rmSync", "openSync", "existsSync", "createReadStream", "createWriteStream"]) {
    if (typeof api[name] !== "function") continue;
    const original = api[name];
    api[name] = function (file, ...args) { return original.call(this, redirect(file), ...args); };
  }
  for (const name of ["rename", "copyFile", "renameSync", "copyFileSync"]) {
    if (typeof api[name] !== "function") continue;
    const original = api[name];
    api[name] = function (from, to, ...args) { return original.call(this, redirect(from), redirect(to), ...args); };
  }
}
console.log("[move-fx QA] Isolated local data; database access disabled.");
