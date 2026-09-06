'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const OUTPUT_ROOT = path.join(ROOT, 'public', 'desktop', 'manifests');
const CONFIG_PATH = path.join(ROOT, 'config', 'desktop-chess-assets-v1.json');
const LOGICAL_PREFIX = 'images/chess/assets';
const HASH_PATTERN = /^[a-f0-9]{64}$/;
const EXTENSIONS = new Map([
  ['.png', ['image', 'image/png']], ['.jpg', ['image', 'image/jpeg']],
  ['.jpeg', ['image', 'image/jpeg']], ['.jfif', ['image', 'image/jpeg']],
  ['.webp', ['image', 'image/webp']], ['.gif', ['image', 'image/gif']],
  ['.svg', ['image', 'image/svg+xml']], ['.avif', ['image', 'image/avif']],
  ['.mp3', ['audio', 'audio/mpeg']], ['.wav', ['audio', 'audio/wav']],
  ['.ogg', ['audio', 'audio/ogg']], ['.m4a', ['audio', 'audio/mp4']],
  ['.aac', ['audio', 'audio/aac']], ['.flac', ['audio', 'audio/flac']],
  ['.mp4', ['video', 'video/mp4']], ['.webm', ['video', 'video/webm']],
  ['.mov', ['video', 'video/quicktime']], ['.m4v', ['video', 'video/x-m4v']],
  ['.woff', ['font', 'font/woff']], ['.woff2', ['font', 'font/woff2']],
  ['.ttf', ['font', 'font/ttf']], ['.otf', ['font', 'font/otf']]
]);

function fail(message) {
  throw new Error(message);
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Bytes(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isWithin(parent, child) {
  const relation = path.relative(path.resolve(parent), path.resolve(child));
  return Boolean(relation) && relation !== '..' && !relation.startsWith(`..${path.sep}`) && !path.isAbsolute(relation);
}

function parseArguments(argv) {
  const options = { source: String(process.env.CHESS_ASSET_SOURCE || '').trim() };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--source') {
      index += 1;
      if (index >= argv.length) fail('--source requires a directory.');
      options.source = argv[index];
    } else if (argument.startsWith('--source=')) {
      options.source = argument.slice('--source='.length);
    } else {
      fail(`Unknown argument: ${argument}`);
    }
  }
  if (!options.source) fail('Chess asset source is required. Pass --source <release public/assets directory>.');
  return { source: path.resolve(options.source) };
}

async function listAssets(sourceRoot) {
  const sourceInfo = await fsp.lstat(sourceRoot);
  if (!sourceInfo.isDirectory() || sourceInfo.isSymbolicLink()) fail(`Chess asset source must be a real directory: ${sourceRoot}`);
  const realRoot = await fsp.realpath(sourceRoot);
  const assets = [];
  const folded = new Map();

  async function walk(directory, relativeDirectory) {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    entries.sort((left, right) => compareText(left.name, right.name));
    for (const entry of entries) {
      const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
      const absolutePath = path.join(directory, entry.name);
      const info = await fsp.lstat(absolutePath);
      if (info.isSymbolicLink()) fail(`Chess asset source contains a symbolic link: ${absolutePath}`);
      const resolved = await fsp.realpath(absolutePath);
      if (!isWithin(realRoot, resolved)) fail(`Chess asset source escapes its root: ${absolutePath}`);
      if (info.isDirectory()) {
        if (relativePath.normalize('NFC').toLowerCase() === 'vendor') continue;
        await walk(absolutePath, relativePath);
        continue;
      }
      if (!info.isFile()) fail(`Chess asset source contains an unsupported entry: ${absolutePath}`);
      const type = EXTENSIONS.get(path.posix.extname(relativePath).toLowerCase());
      if (!type) continue;
      const normalized = relativePath.replace(/\\/g, '/').normalize('NFC');
      if (normalized !== relativePath.replace(/\\/g, '/') || path.posix.normalize(normalized) !== normalized) {
        fail(`Chess asset path is not portable: ${relativePath}`);
      }
      const logicalPath = `${LOGICAL_PREFIX}/${normalized}`;
      const foldedPath = logicalPath.toLowerCase();
      if (folded.has(foldedPath)) fail(`Chess asset path collides by case: ${folded.get(foldedPath)} <> ${logicalPath}`);
      folded.set(foldedPath, logicalPath);
      assets.push({ absolutePath, logicalPath, kind: type[0], mime: type[1], size: info.size });
    }
  }

  await walk(sourceRoot, '');
  assets.sort((left, right) => compareText(left.logicalPath, right.logicalPath));
  if (!assets.length) fail('Chess asset source contains no supported media.');
  return assets;
}

async function hashAssets(assets) {
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= assets.length) return;
      const asset = assets[index];
      const before = await fsp.lstat(asset.absolutePath);
      const hash = crypto.createHash('sha256');
      for await (const chunk of fs.createReadStream(asset.absolutePath)) hash.update(chunk);
      const after = await fsp.lstat(asset.absolutePath);
      if (!after.isFile() || after.isSymbolicLink() || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
        fail(`Chess asset changed while hashing: ${asset.logicalPath}`);
      }
      asset.sha256 = hash.digest('hex');
      if (!HASH_PATTERN.test(asset.sha256)) fail(`Chess asset SHA-256 is invalid: ${asset.logicalPath}`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(8, assets.length) }, worker));
}

async function reuseCreatedAt(outputPath, manifest) {
  try {
    const text = await fsp.readFile(outputPath, 'utf8');
    const existing = JSON.parse(text);
    const candidate = { ...manifest, createdAt: existing.createdAt };
    if (text !== canonicalJson(candidate)) fail(`Immutable Chess manifest already exists with different content: ${outputPath}`);
    return existing;
  } catch (error) {
    if (error.code === 'ENOENT') return manifest;
    throw error;
  }
}

async function writeAtomic(filePath, text) {
  await fsp.mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  try {
    await fsp.writeFile(temporary, text, { encoding: 'utf8', flag: 'wx' });
    await fsp.rm(filePath, { force: true });
    await fsp.rename(temporary, filePath);
  } finally {
    await fsp.rm(temporary, { force: true });
  }
}

async function main() {
  const { source } = parseArguments(process.argv.slice(2));
  const sourceAssets = await listAssets(source);
  await hashAssets(sourceAssets);
  const assets = sourceAssets.map((asset) => ({
    path: asset.logicalPath,
    kind: asset.kind,
    mime: asset.mime,
    size: asset.size,
    sha256: asset.sha256
  }));
  const assetSetSha256 = sha256Bytes(JSON.stringify(assets));
  const totalBytes = assets.reduce((sum, asset) => sum + asset.size, 0);
  const byKind = Object.fromEntries(['image', 'audio', 'video', 'font'].map((kind) => [kind, { files: 0, bytes: 0 }]));
  for (const asset of assets) {
    byKind[asset.kind].files += 1;
    byKind[asset.kind].bytes += asset.size;
  }
  let manifest = {
    schema: 1,
    gameId: 'chess',
    releaseId: `assets-${assetSetSha256.slice(0, 16)}`,
    createdAt: new Date().toISOString(),
    assetSetSha256,
    totalFiles: assets.length,
    totalBytes,
    byKind,
    assets
  };
  const fileName = `chess-assets-${assetSetSha256.slice(0, 16)}.json`;
  const outputPath = path.join(OUTPUT_ROOT, fileName);
  manifest = await reuseCreatedAt(outputPath, manifest);
  const manifestText = canonicalJson(manifest);
  if (!fs.existsSync(outputPath)) await writeAtomic(outputPath, manifestText);
  const config = {
    schema: 1,
    manifestPath: `desktop/manifests/${fileName}`,
    manifestSha256: sha256Bytes(manifestText)
  };
  await writeAtomic(CONFIG_PATH, canonicalJson(config));
  process.stdout.write(
    `CHESS_ASSET_MANIFEST=PASS files=${manifest.totalFiles} bytes=${manifest.totalBytes} ` +
    `release=${manifest.releaseId} manifestSha256=${config.manifestSha256}\n`
  );
}

main().catch((error) => {
  process.stderr.write(`CHESS_ASSET_MANIFEST=FAIL ${String(error?.message || error)}\n`);
  process.exitCode = 1;
});
