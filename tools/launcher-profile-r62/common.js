'use strict';
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const cp = require('child_process'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
const qa = 'D:/Codex_QA/launcher-profile-r62/release';
const origin = 'https://onepiece-card-online.onrender.com';
const spec = JSON.parse(fs.readFileSync(path.join(__dirname, 'release-spec.json')));
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, windowsHide: true, maxBuffer: 128 * 1024 * 1024 });
const blob = (ref, file) => git('cat-file', 'blob', ref + ':' + file);
const read = name => fs.readFileSync(path.join(qa, name));
const json = name => JSON.parse(read(name));
function write(name, value) {
  fs.mkdirSync(qa, { recursive: true });
  fs.writeFileSync(path.join(qa, name), JSON.stringify(value, null, 2) + '\n');
}
function writeExact(name, bytes) {
  fs.mkdirSync(qa, { recursive: true });
  const target = path.join(qa, name);
  if (fs.existsSync(target)) assert.equal(hash(fs.readFileSync(target)), hash(bytes), 'Refusing to replace different evidence: ' + name);
  else fs.writeFileSync(target, bytes, { flag: 'wx' });
}
async function get(url) {
  const res = await fetch(url, { headers: { 'accept-encoding': 'identity' }, signal: AbortSignal.timeout(30000) });
  assert.equal(res.status, 200, url);
  return Buffer.from(await res.arrayBuffer());
}
function manifests() {
  const { validateManifest } = require(root + '/desktop/launcher-content-overlay');
  const previous = validateManifest(JSON.parse(blob(spec.baseline, 'public/desktop/launcher-content-v1.json')), spec.coreVersion);
  const signedBytes = read('signed-r62.json');
  const current = validateManifest(JSON.parse(signedBytes), spec.coreVersion);
  assert.equal(previous.revision, spec.previousRevision);
  assert.equal(previous.files.length, spec.previousFiles);
  assert.equal(current.revision, spec.revision);
  const old = new Map(previous.files.map(f => [f.path, f]));
  const changed = current.files.filter(f => old.get(f.path)?.sha256 !== f.sha256);
  assert.deepEqual(changed.map(f => f.path).sort(), [...spec.rendererFiles, ...spec.images].sort());
  assert.deepEqual(current.files.map(f => f.path).sort(), [...new Set([...old.keys(), ...spec.images])].sort());
  for (const f of current.files) if (!changed.includes(f)) assert.deepEqual(f, old.get(f.path));
  return { previous, signedBytes, current, changed };
}
function assertSameFile(ref, file) {
  const expected = blob(spec.baseline, file);
  assert.equal(hash(blob(ref, file)), hash(expected), 'Committed baseline drift: ' + file);
  const working = fs.readFileSync(path.join(root, file)), byteIdentical = hash(working) === hash(expected);
  // core.autocrlf already checks out some untouched config/program text as CRLF.
  // This release never republishes those working copies. Public metadata remains raw-byte strict.
  if (file.startsWith('public/desktop/')) assert(byteIdentical, 'Working metadata byte drift: ' + file);
  else assert(byteIdentical || working.toString('utf8').replace(/\r\n/g, '\n') === expected.toString('utf8').replace(/\r\n/g, '\n'), 'Working source drift: ' + file);
  return { path: file, bytes: expected.length, sha256: hash(expected), workingByteIdentical: byteIdentical,
    ...(byteIdentical ? {} : { workingBytes: working.length, workingSha256: hash(working), workingDifference: 'Existing Git checkout CRLF/LF normalization only; not rebuilt or uploaded.' }) };
}
function preservedGames(ref = git('rev-parse', 'HEAD').toString().trim()) {
  const C = require(root + '/scripts/desktop_program_package_common');
  const catalog = C.validateCatalog(JSON.parse(blob(spec.baseline, 'public/desktop/catalog-v3.json')));
  const config = JSON.parse(blob(spec.baseline, 'config/desktop-program-packages-v1.json'));
  const desktopFiles = revision => git('ls-tree', '-r', '--name-only', revision, 'public/desktop').toString().trim().split(/\r?\n/).filter(p => p && p !== 'public/desktop/launcher-content-v1.json');
  assert.deepEqual(desktopFiles(ref), desktopFiles(spec.baseline), 'Unrelated desktop metadata inventory changed');
  const files = [...desktopFiles(spec.baseline), 'config/desktop-program-packages-v1.json'];
  for (const game of C.GAME_IDS) {
    files.push('public/' + catalog.games[game].manifestPath);
    for (const p of config.games[game].programFiles) files.push('public/' + p);
  }
  return { catalog, files: [...new Set(files)].map(p => assertSameFile(ref, p)) };
}
module.exports = { fs, path, cp, assert, root, qa, origin, spec, hash, git, blob, read, json, write, writeExact, get, manifests, preservedGames };
