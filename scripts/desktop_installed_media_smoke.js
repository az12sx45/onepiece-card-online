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
  const games = ['card', 'board'].map((gameId) => {
    const entry = catalog.games[gameId];
    const manifestSource = path.join(ROOT, 'public', ...entry.manifestPath.split('/'));
    const manifestBytes = fs.readFileSync(manifestSource);
    if (sha256(manifestBytes) !== entry.manifestSha256) throw new Error(`${gameId} manifest digest differs from catalog.`);
    return { gameId, entry, manifestSource, manifest: JSON.parse(manifestBytes.toString('utf8')) };
  });
  const chosen = games.flatMap(({ gameId, manifest }) => (
    (gameId === 'card' ? ['image', 'audio', 'video'] : ['audio', 'video']).map((kind) => {
      const available = manifest.assets
        .filter((candidate) => candidate.kind === kind && fs.existsSync(path.join(ROOT, 'public', ...candidate.path.split('/'))))
        .sort((left, right) => left.size - right.size);
      const asset = gameId === 'card' && kind === 'image'
        ? available.find((candidate) => candidate.path === 'images/cards/back.webp') || available.find((candidate) => /\.(?:webp|png|jpe?g)$/i.test(candidate.path))
        : available[0];
      if (!asset) throw new Error(`Fixture needs one ${gameId} ${kind} asset.`);
      return { ...asset, gameId };
    })
  ));

  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'onepiece-installed-media-smoke-'));
  const cacheRoot = path.join(fixtureRoot, 'cache');
  const userDataRoot = path.join(fixtureRoot, 'user-data');
  const reportPath = path.join(fixtureRoot, 'report.json');
  fs.mkdirSync(path.join(cacheRoot, 'receipts'), { recursive: true });
  for (const { gameId, entry, manifestSource, manifest } of games) {
    const manifestFile = path.basename(manifestSource);
    fs.mkdirSync(path.join(cacheRoot, 'manifests', gameId), { recursive: true });
    fs.copyFileSync(manifestSource, path.join(cacheRoot, 'manifests', gameId, manifestFile));
    fs.writeFileSync(path.join(cacheRoot, 'receipts', `${gameId}.json`), `${JSON.stringify({
      schema: 1,
      gameId,
      releaseId: manifest.releaseId,
      manifestSha256: entry.manifestSha256,
      manifestFile,
      installedAt: new Date().toISOString()
    }, null, 2)}\n`);
  }
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
      OP_DESKTOP_SMOKE_MEDIA_ASSETS: JSON.stringify(chosen.map((asset) => ({ gameId: asset.gameId, path: asset.path, sha256: asset.sha256 })))
    }
  });
  let report = null;
  try { report = JSON.parse(fs.readFileSync(reportPath, 'utf8')); } catch { /* reported below */ }
  const sessionDataPath = path.resolve(String(report?.sessionDataPath || ''));
  const sessionDataRelative = path.relative(path.resolve(cacheRoot), sessionDataPath);
  const sessionDataInsideCache = !!report?.sessionDataPath && sessionDataRelative !== '..' &&
    !sessionDataRelative.startsWith(`..${path.sep}`) && !path.isAbsolute(sessionDataRelative);
  const passed = child.status === 0 && report?.ok === true && report?.installedMediaSmoke?.ok === true &&
    report.installedMediaSmoke.results.length === chosen.length && report.installedMediaSmoke.results.every((result) => result.cacheHeader === 'hit') &&
    sessionDataInsideCache;
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  if (!passed) {
    throw new Error(`Installed media smoke failed: ${JSON.stringify({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr, report })}`);
  }
  const summary = report.installedMediaSmoke.results.map((result) => `${result.gameId}:${result.contentType}:${result.fullBytes}:range${result.rangeStatus}`).join(',');
  console.log(`DESKTOP_INSTALLED_MEDIA_SMOKE=PASS source=${options.exe ? 'packaged' : 'dev'} cache=hit chromiumCache=selected-root assets=${summary}`);
}

try {
  main();
} catch (error) {
  console.error(`DESKTOP_INSTALLED_MEDIA_SMOKE=FAIL ${error.stack || error}`);
  process.exitCode = 1;
}
