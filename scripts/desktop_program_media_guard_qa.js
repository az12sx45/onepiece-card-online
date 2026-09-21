'use strict';

const assert = require('node:assert/strict');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { assertMediaRetained, buildManifest, verifyExistingMediaRetained } = require('./build_desktop_program_catalog');
const { canonicalJson, classifyPath, sha256Bytes, GAME_IDS } = require('./desktop_program_package_common');

const CREATED_AT = '2026-09-21T00:00:00.000Z';
const record = (logicalPath) => ({ path: logicalPath, ...classifyPath(logicalPath), size: 1, sha256: sha256Bytes('x') });

async function write(root, relative, value) {
  const filename = path.join(root, relative);
  await fsp.mkdir(path.dirname(filename), { recursive: true });
  await fsp.writeFile(filename, canonicalJson(value));
}

async function snapshot(root, relative = '') {
  const result = {};
  for (const entry of await fsp.readdir(path.join(root, relative), { withFileTypes: true })) {
    const child = path.join(relative, entry.name);
    if (entry.isDirectory()) Object.assign(result, await snapshot(root, child));
    else result[child] = sha256Bytes(await fsp.readFile(path.join(root, child)));
  }
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  assert.equal(args.length, 2, 'Usage: node scripts/desktop_program_media_guard_qa.js --output <absolute work directory>');
  assert.equal(args[0], '--output');
  assert.ok(path.isAbsolute(args[1]), 'Output must be absolute');
  const output = path.resolve(args[1]);
  await fsp.mkdir(output, { recursive: true });
  const fixture = await fsp.mkdtemp(path.join(output, 'fixture-'));
  const publicRoot = path.join(fixture, 'public');
  let checks = 0;

  for (const logicalPath of ['images/new.webp', 'audio/new.ogg', 'videos/new.mp4', 'fonts/new.woff2']) {
    assert.throws(() => assertMediaRetained('board', { assets: [record(logicalPath)] }, new Set()), /would lose 1 existing v3 media/);
    checks += 1;
  }
  assert.doesNotThrow(() => assertMediaRetained('board', { assets: [record('images/kept.webp'), record('js/old.js')] }, new Set(['images/kept.webp'])));
  checks += 1;
  await verifyExistingMediaRetained({}, {}, publicRoot);
  checks += 1;

  const sourceTrees = Object.fromEntries(['images', 'audio', 'videos', 'fonts'].map((kind) => [kind, 'a'.repeat(40)]));
  const legacyCatalog = { schema: 2, createdAt: CREATED_AT, assetBlobBaseUrl: 'https://example.com/desktop/blobs/sha256', sourceTrees, games: {} };
  const catalog = { schema: 3, createdAt: CREATED_AT, assetBlobBaseUrl: legacyCatalog.assetBlobBaseUrl, sourceTrees, games: {} };
  const config = { schema: 1, legacyBaseline: { catalogPath: 'desktop/catalog-v2.json', catalogSha256: '', manifestSha256ByGame: {} }, games: {} };
  for (const gameId of GAME_IDS) {
    const entryPath = `${gameId}.html`;
    const media = [record(`images/${gameId}.webp`)];
    const legacy = { schema: 1, gameId, releaseId: `assets-${gameId}`, assetSetSha256: sha256Bytes(JSON.stringify(media)), totalFiles: media.length, totalBytes: 1, assets: media };
    const legacyPath = `desktop/manifests/${gameId}-legacy.json`;
    const legacySha = sha256Bytes(canonicalJson(legacy));
    legacyCatalog.games[gameId] = { releaseId: legacy.releaseId, manifestPath: legacyPath, manifestSha256: legacySha, totalFiles: legacy.totalFiles, totalBytes: legacy.totalBytes };
    config.legacyBaseline.manifestSha256ByGame[gameId] = legacySha;
    config.games[gameId] = { entryPath, programFiles: [entryPath] };
    const additional = gameId === 'board' ? [
      ...Array.from({ length: 102 }, (_, index) => record(`images/board/battle/move-fx/v1/fx-${index}.webp`)),
      ...Array.from({ length: 487 }, (_, index) => record(`audio/board_game/move-fx/v1/fx-${index}.ogg`))
    ] : [];
    const manifest = buildManifest(gameId, entryPath, CREATED_AT, [...media, ...additional], [record(entryPath)]);
    const manifestPath = `desktop/manifests/${gameId}-${manifest.releaseId}.json`;
    catalog.games[gameId] = { releaseId: manifest.releaseId, manifestPath, manifestSha256: sha256Bytes(canonicalJson(manifest)), entryPath, totalFiles: manifest.totalFiles, totalBytes: manifest.totalBytes };
    await write(publicRoot, legacyPath, legacy);
    await write(publicRoot, manifestPath, manifest);
  }
  config.legacyBaseline.catalogSha256 = sha256Bytes(canonicalJson(legacyCatalog));
  await write(publicRoot, 'desktop/catalog-v2.json', legacyCatalog);
  await write(publicRoot, 'desktop/catalog-v3.json', catalog);
  await write(fixture, 'config/desktop-program-packages-v1.json', config);
  await fsp.mkdir(path.join(fixture, 'scripts'), { recursive: true });
  for (const filename of ['build_desktop_program_catalog.js', 'desktop_program_package_common.js']) {
    await fsp.copyFile(path.join(__dirname, filename), path.join(fixture, 'scripts', filename));
  }

  const before = await snapshot(fixture);
  const run = spawnSync(process.execPath, [path.join(fixture, 'scripts/build_desktop_program_catalog.js')], { cwd: fixture, encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 1, run.stderr);
  assert.match(run.stderr, /board would lose 589 existing v3 media/);
  assert.match(run.stderr, /scripts\/promote_board_move_fx_release\.js/);
  assert.doesNotMatch(run.stderr, /Cannot read Git HEAD/);
  checks += 1;
  assert.deepEqual(await snapshot(fixture), before, 'Rejected rebuild must not write any metadata, including earlier Card manifest');
  checks += 1;

  const intactBytes = await fsp.readFile(path.join(publicRoot, 'desktop/catalog-v3.json'));
  await fsp.writeFile(path.join(publicRoot, 'desktop/catalog-v3.json'), '{ broken');
  await assert.rejects(() => verifyExistingMediaRetained(config, legacyCatalog, publicRoot), /not valid JSON/);
  await fsp.writeFile(path.join(publicRoot, 'desktop/catalog-v3.json'), intactBytes);
  checks += 1;
  console.log(JSON.stringify({ ok: true, checks, fixture, rejectedDroppedMedia: 589, metadataUnchanged: true }));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
