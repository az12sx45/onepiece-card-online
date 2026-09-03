'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const DESKTOP_ROOT = path.join(ROOT, 'desktop');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function parseArguments(argv) {
  const result = { exe: '' };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--exe') {
      result.exe = path.resolve(argv[++index] || '');
      continue;
    }
    if (argv[index].startsWith('--exe=')) {
      result.exe = path.resolve(argv[index].slice(6));
      continue;
    }
    throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return result;
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'desktop', 'catalog-v1.json'), 'utf8'));
  const entry = catalog.games.board;
  const manifestSource = path.join(ROOT, 'public', ...entry.manifestPath.split('/'));
  const manifestBytes = fs.readFileSync(manifestSource);
  if (sha256(manifestBytes) !== entry.manifestSha256) throw new Error('Board manifest digest differs from catalog.');
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const chosen = ['audio', 'video'].map((kind) => manifest.assets
    .filter((asset) => asset.kind === kind && fs.existsSync(path.join(ROOT, 'public', ...asset.path.split('/'))))
    .sort((left, right) => left.size - right.size)[0]);
  if (chosen.some((asset) => !asset)) throw new Error('Fixture needs one audio and one video asset.');

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onepiece-installed-media-smoke-'));
  const cacheRoot = path.join(fixtureRoot, 'cache');
  const userDataRoot = path.join(fixtureRoot, 'user-data');
  const reportPath = path.join(fixtureRoot, 'report.json');
  const manifestFile = path.basename(manifestSource);
  fs.mkdirSync(path.join(cacheRoot, 'manifests', 'board'), { recursive: true });
  fs.mkdirSync(path.join(cacheRoot, 'receipts'), { recursive: true });
  fs.copyFileSync(manifestSource, path.join(cacheRoot, 'manifests', 'board', manifestFile));
  fs.writeFileSync(path.join(cacheRoot, 'receipts', 'board.json'), `${JSON.stringify({
    schema: 1,
    gameId: 'board',
    releaseId: manifest.releaseId,
    manifestSha256: entry.manifestSha256,
    manifestFile,
    installedAt: new Date().toISOString()
  }, null, 2)}\n`);
  for (const asset of chosen) {
    const destination = path.join(cacheRoot, 'blobs', 'sha256', asset.sha256.slice(0, 2), asset.sha256);
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'public', ...asset.path.split('/')), destination);
  }

  const executable = options.exe || require(path.join(DESKTOP_ROOT, 'node_modules', 'electron'));
  const args = options.exe ? [] : [DESKTOP_ROOT];
  const child = spawnSync(executable, args, {
    cwd: DESKTOP_ROOT,
    encoding: 'utf8',
    timeout: 90_000,
    windowsHide: true,
    env: {
      ...process.env,
      OP_DESKTOP_SMOKE: '1',
      OP_DESKTOP_PREVIEW: '1',
      OP_DESKTOP_SMOKE_REPORT: reportPath,
      OP_DESKTOP_USER_DATA: userDataRoot,
      OP_DESKTOP_CACHE_ROOT: cacheRoot,
      OP_DESKTOP_SMOKE_MEDIA_ASSETS: JSON.stringify(chosen.map((asset) => ({ gameId: 'board', path: asset.path, sha256: asset.sha256 })))
    }
  });
  let report = null;
  try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch { /* reported below */ }
  const passed = child.status === 0 && report?.ok === true && report?.installedMediaSmoke?.ok === true &&
    report.installedMediaSmoke.results.length === chosen.length && report.installedMediaSmoke.results.every((result) => result.cacheHeader === 'hit');
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  if (!passed) {
    throw new Error(`Installed media smoke failed: ${JSON.stringify({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr, report })}`);
  }
  const summary = report.installedMediaSmoke.results.map((result) => `${result.contentType}:${result.fullBytes}:range${result.rangeStatus}`).join(',');
  console.log(`DESKTOP_INSTALLED_MEDIA_SMOKE=PASS source=${options.exe ? 'packaged' : 'dev'} cache=hit assets=${summary}`);
}

try {
  main();
} catch (error) {
  console.error(`DESKTOP_INSTALLED_MEDIA_SMOKE=FAIL ${error.stack || error}`);
  process.exitCode = 1;
}
