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
  const result = { exe: '', electron: '', chessSource: String(process.env.CHESS_ASSET_SOURCE || '').trim() };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--exe') {
      result.exe = path.resolve(argv[++index] || '');
      continue;
    }
    if (argv[index].startsWith('--exe=')) {
      result.exe = path.resolve(argv[index].slice(6));
      continue;
    }
    if (argv[index] === '--electron') {
      index += 1;
      if (index >= argv.length || !String(argv[index] || '').trim()) {
        throw new Error('--electron requires a path.');
      }
      result.electron = path.resolve(argv[index]);
      continue;
    }
    if (argv[index].startsWith('--electron=')) {
      const executable = argv[index].slice('--electron='.length).trim();
      if (!executable) throw new Error('--electron requires a path.');
      result.electron = path.resolve(executable);
      continue;
    }
    if (argv[index] === '--chess-source') {
      index += 1;
      if (index >= argv.length || !String(argv[index] || '').trim()) {
        throw new Error('--chess-source requires a path.');
      }
      result.chessSource = path.resolve(argv[index]);
      continue;
    }
    if (argv[index].startsWith('--chess-source=')) {
      const source = argv[index].slice('--chess-source='.length).trim();
      if (!source) throw new Error('--chess-source requires a path.');
      result.chessSource = path.resolve(source);
      continue;
    }
    throw new Error(`Unknown argument: ${argv[index]}`);
  }
  if (result.exe && result.electron) throw new Error('Use either --exe or --electron, not both.');
  if (!result.chessSource) throw new Error('Chess media smoke requires --chess-source <release public/assets directory>.');
  return result;
}

function isWithin(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

function createChessSourceResolver(sourceRoot) {
  const rootInfo = fs.lstatSync(sourceRoot, { throwIfNoEntry: false });
  if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink()) throw new Error(`Chess source must be a real directory: ${sourceRoot}`);
  const realRoot = fs.realpathSync(sourceRoot);
  return (assetPath) => {
    const prefix = 'images/chess/assets/';
    if (typeof assetPath !== 'string' || !assetPath.startsWith(prefix)) throw new Error(`Chess asset escaped its logical prefix: ${assetPath}`);
    const relativePath = assetPath.slice(prefix.length);
    const parts = relativePath.split('/');
    if (!relativePath || parts.some((part) => !part || part === '.' || part === '..')) throw new Error(`Chess asset path is unsafe: ${assetPath}`);
    let candidate = sourceRoot;
    for (let index = 0; index < parts.length; index += 1) {
      candidate = path.join(candidate, parts[index]);
      const info = fs.lstatSync(candidate, { throwIfNoEntry: false });
      if (!info || info.isSymbolicLink()) throw new Error(`Chess source asset is missing or linked: ${candidate}`);
      if (index < parts.length - 1 && !info.isDirectory()) throw new Error(`Chess source path is not a directory: ${candidate}`);
      if (index === parts.length - 1 && !info.isFile()) throw new Error(`Chess source asset is not a file: ${candidate}`);
    }
    const resolved = fs.realpathSync(candidate);
    if (!isWithin(realRoot, resolved)) throw new Error(`Chess source asset escaped its root: ${candidate}`);
    return resolved;
  };
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  const resolveChessSource = createChessSourceResolver(options.chessSource);
  const catalog = JSON.parse(fs.readFileSync(path.join(ROOT, 'public', 'desktop', 'catalog-v2.json'), 'utf8'));
  const games = ['card', 'board', 'chess'].map((gameId) => {
    const entry = catalog.games[gameId];
    const manifestSource = path.join(ROOT, 'public', ...entry.manifestPath.split('/'));
    const manifestBytes = fs.readFileSync(manifestSource);
    if (sha256(manifestBytes) !== entry.manifestSha256) throw new Error(`${gameId} manifest digest differs from catalog.`);
    return { gameId, entry, manifestSource, manifest: JSON.parse(manifestBytes.toString('utf8')) };
  });
  const requiredKinds = {
    card: ['image', 'audio', 'video'],
    board: ['audio', 'video'],
    chess: ['image']
  };
  const chosen = games.flatMap(({ gameId, manifest }) => (
    requiredKinds[gameId].map((kind) => {
      const available = manifest.assets
        .filter((candidate) => candidate.kind === kind && (
          gameId === 'chess'
            ? candidate.path.startsWith('images/chess/assets/')
            : fs.existsSync(path.join(ROOT, 'public', ...candidate.path.split('/')))
        ))
        .sort((left, right) => left.size - right.size);
      const asset = gameId === 'card' && kind === 'image'
        ? available.find((candidate) => candidate.path === 'images/cards/back.webp') || available.find((candidate) => /\.(?:webp|png|jpe?g)$/i.test(candidate.path))
        : gameId === 'chess'
          ? available.find((candidate) => candidate.path.startsWith('images/chess/assets/'))
          : available[0];
      if (!asset) throw new Error(`Fixture needs one ${gameId} ${kind} asset.`);
      const sourcePath = gameId === 'chess'
        ? resolveChessSource(asset.path)
        : path.join(ROOT, 'public', ...asset.path.split('/'));
      return { ...asset, gameId, sourcePath };
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
    fs.copyFileSync(asset.sourcePath, destination);
  }

  const executable = options.exe || options.electron || require(path.join(DESKTOP_ROOT, 'node_modules', 'electron'));
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
    report?.gpu?.requestedPreference === 'high-performance' &&
    report.installedMediaSmoke.results.length === chosen.length && report.installedMediaSmoke.results.every((result) => result.cacheHeader === 'hit') &&
    sessionDataInsideCache;
  fs.rmSync(fixtureRoot, { recursive: true, force: true });
  if (!passed) {
    throw new Error(`Installed media smoke failed: ${JSON.stringify({ status: child.status, signal: child.signal, error: child.error?.message, stderr: child.stderr, report })}`);
  }
  const summary = report.installedMediaSmoke.results.map((result) => `${result.gameId}:${result.contentType}:${result.fullBytes}:range${result.rangeStatus}`).join(',');
  console.log(`DESKTOP_INSTALLED_MEDIA_SMOKE=PASS source=${options.exe ? 'packaged' : 'dev'} cache=hit chromiumCache=selected-root chessSource=verified assets=${summary}`);
  console.log(`DESKTOP_GPU_DIAGNOSTICS=${JSON.stringify(report.gpu)}`);
}

try {
  main();
} catch (error) {
  console.error(`DESKTOP_INSTALLED_MEDIA_SMOKE=FAIL ${error.stack || error}`);
  process.exitCode = 1;
}
