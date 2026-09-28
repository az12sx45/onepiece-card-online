'use strict';

// Exercise the real Electron launcher with delayed local verification and account restore.
// No server, account, or installed game files are touched.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const desktop = path.join(root, 'desktop');
const modes = ['verified', 'offline'];

async function runChild(mode) {
  const { app, BrowserWindow } = require('electron');
  const { AuthService } = require(path.join(desktop, 'auth-service'));
  const { AssetStore } = require(path.join(desktop, 'asset-store'));
  const { SocialService } = require(path.join(desktop, 'social-service'));
  const { LauncherUpdateService } = require(path.join(desktop, 'launcher-update-service'));
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const checks = [];
  const check = (name, pass, detail) => checks.push({ name, pass: Boolean(pass), detail });
  const gameStates = Object.fromEntries(['card', 'board', 'chess'].map((gameId) => [gameId, {
    status: 'installed', message: '已安裝，可以遊玩', hasInstalled: true, installedVersion: 'fixture'
  }]));

  AuthService.prototype.load = async function () {
    this.secretMemory = 'qa-local-secret';
    this.state.account = { username: 'qa', userId: 17, name: 'QA', secretCipher: null };
    this.state.cacheRoot = path.join(os.tmpdir(), 'onepiece-startup-qa-cache');
    return this.state;
  };
  AuthService.prototype.restore = async function () {
    await delay(3500);
    return mode === 'verified' ? { ok: true, account: this.accountSummary() } : { ok: false, error: 'offline', recoverable: true };
  };
  AuthService.prototype.launcherRequest = async () => ({ ok: false, error: 'fixture' });
  AssetStore.prototype.init = async function () {
    await delay(6000);
    this.gameStates = new Map(Object.entries(gameStates));
    return this.getState();
  };
  AssetStore.prototype.getState = async function () {
    return { cacheRoot: this.cacheRoot, freeBytes: 12345, catalogSource: 'bundled', games: gameStates };
  };
  AssetStore.prototype.refreshRemoteCatalog = async () => ({ ok: true });
  SocialService.prototype.start = async () => {};
  LauncherUpdateService.prototype.checkForUpdates = async function () { return this.getState(); };

  require(path.join(desktop, 'main.js'));
  await app.whenReady();
  let win;
  const deadline = Date.now() + 20000;
  while (!win && Date.now() < deadline) {
    win = BrowserWindow.getAllWindows()[0];
    if (!win) await delay(40);
  }
  if (!win) throw new Error('Launcher window was not created');
  win.hide();
  async function inspect() {
    return win.webContents.executeJavaScript(`({
      stage: document.body.dataset.stage,
      disabled: document.querySelector('#authSubmit').disabled,
      message: document.querySelector('#authMessage').textContent,
      gameStatus: snapshot.games.board.status,
      launchPending: window.__qaLaunchPending
    })`, true);
  }
  async function waitFor(predicate, timeoutMs = 4000) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
      const value = await inspect().catch(() => null);
      if (value && predicate(value)) return value;
      await delay(60);
    }
    throw new Error('Timed out waiting for expected renderer state');
  }
  await waitFor((value) => value.stage === 'auth' && value.disabled, 5000);
  const began = Date.now();
  const early = await win.webContents.executeJavaScript('window.onePieceDesktop.getState()', true);
  const earlyMs = Date.now() - began;
  check('local state returns before account and cache work', earlyMs < 1200 && early.restoringSession === true && early.authenticated === false && early.games.board.status === 'checking', { earlyMs, early });
  const earlyUi = await inspect();
  check('account form shows verification in progress', earlyUi.stage === 'auth' && earlyUi.disabled && earlyUi.message.includes('確認'), earlyUi);
  const mid = await waitFor((value) => mode === 'verified'
    ? value.stage === 'app' && value.gameStatus === 'checking'
    : value.stage === 'auth' && !value.disabled && value.gameStatus === 'checking', 5000);
  check('account result appears before local game scan completes', Boolean(mid), mid);
  win.webContents.executeJavaScript(`window.__qaLaunchPending='pending'; window.onePieceDesktop.launchGame('invalid').then((result) => { window.__qaLaunchPending=result; });`, true).catch(() => {});
  await delay(150);
  check('game action waits for the file check', (await inspect()).launchPending === 'pending');
  const done = await waitFor((value) => value.gameStatus === 'installed' && typeof value.launchPending === 'object', 5000);
  check('game state updates after file check', done.gameStatus === 'installed' && (mode === 'verified' ? done.stage === 'app' : done.stage === 'auth'), done);
  check('invalid game remains rejected after check', done.launchPending.ok === false);
  const finalState = await win.webContents.executeJavaScript('window.onePieceDesktop.getState()', true);
  check('unverified account never enters app', mode === 'verified' || (finalState.authenticated === false && finalState.profile === null), { authenticated: finalState.authenticated, profile: finalState.profile });
  const report = { mode, pass: checks.every((item) => item.pass), checks };
  process.stdout.write(`STARTUP_QA_REPORT=${JSON.stringify(report)}\n`, () => app.exit(report.pass ? 0 : 1));
}

if (process.argv.includes('--child')) {
  const mode = process.argv[process.argv.indexOf('--child') + 1];
  runChild(mode).catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    require('electron').app.exit(1);
  });
} else {
  const electron = require(path.join(desktop, 'node_modules', 'electron'));
  const reports = [];
  for (const mode of (modes.includes(process.argv[2]) ? [process.argv[2]] : modes)) {
    const userData = fs.mkdtempSync(path.join(os.tmpdir(), `onepiece-startup-${mode}-`));
    const result = spawnSync(electron, [__filename, '--child', mode], {
      cwd: root,
      env: { ...process.env, OP_DESKTOP_USER_DATA: userData, OP_DESKTOP_PREVIEW: '0' },
      encoding: 'utf8',
      timeout: 30000
    });
    const line = result.stdout.split(/\r?\n/).find((item) => item.startsWith('STARTUP_QA_REPORT='));
    const report = line ? JSON.parse(line.slice('STARTUP_QA_REPORT='.length)) : null;
    reports.push(report || { mode, pass: false, error: result.error?.message || result.stderr || result.stdout, stdout: result.stdout, stderr: result.stderr });
    const resolvedUserData = path.resolve(userData);
    if (path.dirname(resolvedUserData) === path.resolve(os.tmpdir()) &&
        path.basename(resolvedUserData).startsWith(`onepiece-startup-${mode}-`)) {
      fs.rmSync(resolvedUserData, { recursive: true, force: true });
    }
  }
  process.stdout.write(`${JSON.stringify({ pass: reports.every((item) => item.pass), reports }, null, 2)}\n`);
  if (reports.some((item) => !item.pass)) process.exitCode = 1;
}
