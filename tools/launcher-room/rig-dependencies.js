'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');

function playwright() {
  const runtime = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData/Local'), 'OpenAI/Codex/runtimes/cua_node');
  const bundled = fs.existsSync(runtime) ? fs.readdirSync(runtime).map(name => path.join(runtime, name, 'bin/node_modules/playwright')) : [];
  const candidates = [process.env.BOARD_QA_PLAYWRIGHT, path.join(root, 'desktop/node_modules/playwright'), path.join(root, 'node_modules/playwright'), 'playwright', ...bundled].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
  }
  throw Error('Playwright unavailable. Set BOARD_QA_PLAYWRIGHT to its installed module path.');
}
function launchOptions(chromium) {
  const candidates = [process.env.BOARD_QA_CHROME, chromium.executablePath(), path.join(process.env.PROGRAMFILES || 'C:/Program Files', 'Google/Chrome/Application/chrome.exe')];
  const executablePath = candidates.find(file => file && fs.existsSync(file));
  if (!executablePath) throw Error('Chromium unavailable. Install the Playwright browser or set BOARD_QA_CHROME.');
  return { headless: true, executablePath };
}
module.exports = { playwright, launchOptions };
