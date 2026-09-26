'use strict';
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const args = process.argv.slice(2);
function run(command, params) {
  const result = spawnSync(command, params, { stdio: 'inherit', windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
run(process.execPath, [path.join(__dirname, 'build-rig-release.js'), ...args]);
const rootIndex = args.indexOf('--root');
run(process.env.LAUNCHER_ROOM_PYTHON || 'python', [path.join(__dirname, 'build-rig-portraits.py'), '--root', rootIndex >= 0 ? args[rootIndex + 1] : path.resolve(__dirname, '../..')]);
