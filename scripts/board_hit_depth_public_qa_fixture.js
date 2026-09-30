'use strict';

// An isolated candidate plus fake HTTP responses; no production request is made.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { buildManifest, validateConfig } = require('./build_desktop_program_catalog');
const { canonicalJson, sha256Bytes } = require('./desktop_program_package_common');
const {
  BASELINE_RELEASE, BASELINE_MANIFEST_SHA, BASELINE_CATALOG_SHA, CHANGED_PROGRAMS,
} = require('./build_board_hit_depth_release');
const { createVerifier, parseArguments, ORIGIN, ELECTRON_UA } = require('./board_hit_depth_public_qa');

const ROOT = path.resolve(__dirname, '..');
const BASELINE_SOURCE = 'cc85b439f88d4b8a127a95f021398956083f28ef';
const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'board-hit-depth-public-qa-'));
const candidateDir = path.join(folder, 'candidate');
const bytesOf = value => Buffer.from(canonicalJson(value));
const at = (ref, filename) => execFileSync('git', ['cat-file', 'blob', `${ref}:${filename}`], {
  cwd: ROOT, windowsHide: true, maxBuffer: 128 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'],
});
const sourceHead = BASELINE_SOURCE;
const write = (relative, bytes) => {
  const filename = path.join(candidateDir, relative);
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  fs.writeFileSync(filename, bytes);
};

function fixture() {
  const baselineBytes = at(sourceHead, 'public/desktop/catalog-v3.json');
  assert.equal(sha256Bytes(baselineBytes), BASELINE_CATALOG_SHA);
  const baseline = JSON.parse(baselineBytes);
  const oldBytes = at(sourceHead, `public/${baseline.games.board.manifestPath}`);
  assert.equal(sha256Bytes(oldBytes), BASELINE_MANIFEST_SHA);
  const old = JSON.parse(oldBytes);
  const config = validateConfig(JSON.parse(at(sourceHead, 'config/desktop-program-packages-v1.json')));
  const oldByPath = new Map(old.assets.map(asset => [asset.path, asset]));
  const payloads = new Map([
    ['board_battle.html', Buffer.from('<!doctype html><title>Fixture battle</title>\n')],
    ['board_game.html', Buffer.from('<!doctype html><title>Fixture board</title>\n')],
    ['css/board_character_depth.css', Buffer.from('.fixture-hit { transform: rotateY(8deg); }\n')],
  ]);
  const programs = config.games.board.programFiles.map(name => {
    if (!payloads.has(name)) return oldByPath.get(name);
    const previous = oldByPath.get(name);
    const bytes = payloads.get(name);
    return { ...previous, size: bytes.length, sha256: sha256Bytes(bytes) };
  });
  const retained = old.assets.filter(asset => !config.games.board.programFiles.includes(asset.path));
  const createdAt = '2026-09-29T00:00:00.000Z';
  const manifest = buildManifest('board', old.entryPath, createdAt, retained, programs);
  const manifestBytes = bytesOf(manifest);
  const board = {
    releaseId: manifest.releaseId,
    manifestPath: `desktop/manifests/board-${manifest.releaseId}.json`,
    manifestSha256: sha256Bytes(manifestBytes),
    entryPath: manifest.entryPath,
    totalFiles: manifest.totalFiles,
    totalBytes: manifest.totalBytes,
  };
  const catalog = { ...baseline, createdAt, games: { ...baseline.games, board } };
  const inputs = {
    generator: 'board-hit-depth-release-v1', sourceHead, createdAt,
    baselineCatalogSha256: BASELINE_CATALOG_SHA,
    baselineBoardRelease: BASELINE_RELEASE,
    baselineBoardManifestSha256: BASELINE_MANIFEST_SHA,
    retainedAssetCount: retained.length,
    retainedAssetRecordsSha256: sha256Bytes(bytesOf(retained)),
    changedPrograms: CHANGED_PROGRAMS.map(name => programs.find(asset => asset.path === name)),
    candidate: board,
  };
  write('release-inputs.json', bytesOf(inputs));
  write('desktop/catalog-v3.json', bytesOf(catalog));
  write(board.manifestPath, manifestBytes);
  for (const [name, bytes] of payloads) write(`program-bytes/${name}`, bytes);
  return { catalog, board, manifest, payloads, baseline, candidateDir };
}

function fakeFetch(data, alteration = {}) {
  const routes = new Map();
  const add = (url, bytes, headers = {}) => routes.set(url, { bytes, headers });
  add(`${ORIGIN}/health`, Buffer.from('{"ok":true}'), { 'content-type': 'application/json' });
  add(`${ORIGIN}/desktop/catalog-v3.json`, bytesOf(data.catalog), { 'content-type': 'application/json' });
  for (const gameId of ['card', 'board', 'chess']) {
    const game = data.catalog.games[gameId];
    const identity = {
      ok: true, schema: 1, gameId, releaseId: game.releaseId,
      manifestSha256: game.manifestSha256, entryPath: game.entryPath,
    };
    add(`${ORIGIN}/api/desktop-runtime-package/${gameId}`, Buffer.from(JSON.stringify(identity)), {
      'content-type': 'application/json', 'cache-control': 'no-store',
    });
    const bytes = gameId === 'board'
      ? fs.readFileSync(path.join(data.candidateDir, game.manifestPath))
      : at(sourceHead, `public/${game.manifestPath}`);
    add(`${ORIGIN}/${game.manifestPath}`, bytes, { 'content-type': 'application/json' });
  }
  for (const [name, bytes] of data.payloads) {
    const asset = data.manifest.assets.find(item => item.path === name);
    add(`${ORIGIN}/${name}`, bytes, { 'content-type': name.endsWith('.css') ? 'text/css' : 'text/html; charset=utf-8' });
    add(`${data.catalog.assetBlobBaseUrl}/${asset.sha256.slice(0, 2)}/${asset.sha256}`, bytes, {
      'content-type': 'application/octet-stream', 'access-control-allow-origin': '*',
    });
  }
  if (alteration.url) {
    const current = routes.get(alteration.url);
    assert.ok(current, `Unknown fixture alteration: ${alteration.url}`);
    routes.set(alteration.url, {
      bytes: alteration.bytes || current.bytes,
      headers: { ...current.headers, ...alteration.headers },
    });
  }
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push({ url, headers: options.headers, redirect: options.redirect });
    if (url === `${ORIGIN}/board_battle.html` && !options.headers['User-Agent']) {
      return new Response(null, { status: 302, headers: { Location: '/download' } });
    }
    const item = routes.get(url);
    assert.ok(item, `Unexpected fixture request: ${url}`);
    if (url.includes('/api/desktop-runtime-package/') || data.payloads.has(url.slice(`${ORIGIN}/`.length))) {
      assert.equal(options.headers['User-Agent'], ELECTRON_UA, `Missing Electron UA: ${url}`);
    }
    if (url.startsWith(data.catalog.assetBlobBaseUrl)) assert.equal(options.headers.Origin, ORIGIN, `Missing CAS CORS request: ${url}`);
    return new Response(item.bytes, { status: 200, headers: item.headers });
  };
  return { fetchImpl, requests };
}

async function main() {
  const data = fixture();
  const checks = [];
  for (const args of [[], ['--candidate', 'relative'], ['--candidate', candidateDir, '--candidate', candidateDir], ['--unknown']]) {
    assert.throws(() => parseArguments(args));
  }
  checks.push('cli-rejects-unsafe-input');
  const healthy = fakeFetch(data);
  const report = await createVerifier({ root: ROOT, origin: ORIGIN, fetchImpl: healthy.fetchImpl }).verify(candidateDir);
  assert.equal(report.ok, true);
  assert.equal(report.checks.length, 15);
  assert.equal(healthy.requests.length, 15);
  checks.push('all-15-public-routes-verified-with-fake-responses');

  const badCatalog = fakeFetch(data, {
    url: `${ORIGIN}/desktop/catalog-v3.json`, bytes: Buffer.from('{}'),
  });
  await assert.rejects(createVerifier({ root: ROOT, origin: ORIGIN, fetchImpl: badCatalog.fetchImpl }).verify(candidateDir),
    /Public catalog differs/);
  checks.push('public-catalog-drift-rejected');

  const cardUrl = `${ORIGIN}/api/desktop-runtime-package/card`;
  const badCard = fakeFetch(data, { url: cardUrl, bytes: Buffer.from('{"ok":true,"gameId":"card","releaseId":"wrong"}') });
  await assert.rejects(createVerifier({ root: ROOT, origin: ORIGIN, fetchImpl: badCard.fetchImpl }).verify(candidateDir),
    /card runtime releaseId/);
  checks.push('card-runtime-drift-rejected');

  const css = data.manifest.assets.find(asset => asset.path === 'css/board_character_depth.css');
  const cssCas = `${data.catalog.assetBlobBaseUrl}/${css.sha256.slice(0, 2)}/${css.sha256}`;
  const badCors = fakeFetch(data, { url: cssCas, headers: { 'access-control-allow-origin': 'https://wrong.invalid' } });
  await assert.rejects(createVerifier({ root: ROOT, origin: ORIGIN, fetchImpl: badCors.fetchImpl }).verify(candidateDir),
    /CAS CORS origin/);
  checks.push('cas-cors-regression-rejected');

  const payload = path.join(candidateDir, 'program-bytes/board_battle.html');
  const original = fs.readFileSync(payload);
  try {
    fs.writeFileSync(payload, 'tampered');
    assert.throws(() => createVerifier({ root: ROOT, origin: ORIGIN, fetchImpl: healthy.fetchImpl }).localCandidate(candidateDir),
      /Candidate payload (size|digest) differs/);
  } finally { fs.writeFileSync(payload, original); }
  checks.push('local-candidate-tampering-rejected');
  console.log(JSON.stringify({ ok: true, fixtureOnly: true, checks, candidate: data.board.releaseId, folder }));
}

main().catch(error => { console.error(`BOARD_HIT_DEPTH_PUBLIC_FIXTURE=FAIL ${error.stack}`); process.exitCode = 1; });
