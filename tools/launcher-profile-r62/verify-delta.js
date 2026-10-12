'use strict';
const { fs, path, assert, root, qa, origin, spec, hash, write, writeExact, get, manifests } = require('./common');
const { LauncherContentOverlay } = require(root + '/desktop/launcher-content-overlay');
const mode = process.argv[2]; assert(['candidate', 'actual'].includes(mode), 'Choose candidate or actual');
const candidate = 'D:/Codex_QA/launcher-fishing-r45/candidate';
const userDataPath = path.resolve(mode === 'candidate' ? candidate : path.join(process.env.APPDATA, 'onepiece-tabletop-desktop'));
function guard() {
  for (const p of [userDataPath, path.join(userDataPath, 'launcher-content-v1'), path.join(userDataPath, 'launcher-content-v1', 'blobs')]) {
    const st = fs.lstatSync(p);
    assert(st.isDirectory() && !st.isSymbolicLink(), 'Unexpected cache directory/reparse point: ' + p);
    assert.equal(path.resolve(fs.realpathSync(p)).toLowerCase(), path.resolve(p).toLowerCase(), 'Cache path resolves outside target: ' + p);
  }
}
(async () => {
  guard(); const { previous, signedBytes, current, changed } = manifests();
  if (mode === 'actual') assert.equal(hash(await get(origin + '/desktop/launcher-content-v1.json')), hash(signedBytes));
  let blobRequests = 0;
  const fetchImpl = (url, options) => {
    if (mode === 'candidate' && url === origin + '/desktop/launcher-content-v1.json') return Promise.resolve(new Response(signedBytes, { status: 200 }));
    if (String(url).startsWith(current.baseUrl)) blobRequests++;
    return fetch(url, options);
  };
  const overlay = () => new LauncherContentOverlay({ coreVersion: spec.coreVersion, userDataPath, origin, fetchImpl });
  const before = overlay(), from = await before.load();
  assert([spec.previousRevision, spec.revision].includes(from), 'Unexpected cache revision ' + from);
  assert.deepEqual(before.active, from === spec.previousRevision ? previous : current, 'Unexpected signed cache identity');
  // Always verify all previous immutable bytes before any staging; this never deletes, rewrites or rolls back blobs.
  for (const f of previous.files) {
    const p = before.blobPath(f.sha256), st = fs.lstatSync(p); assert(st.isFile() && !st.isSymbolicLink(), f.path);
    const bytes = fs.readFileSync(p); assert.equal(bytes.length, f.bytes, f.path); assert.equal(hash(bytes), f.sha256, f.path);
  }
  const backup = [];
  for (const slot of [0, 1]) if (fs.existsSync(before.slotPath(slot))) {
    const p = before.slotPath(slot); assert(!fs.lstatSync(p).isSymbolicLink()); const bytes = fs.readFileSync(p);
    const name = mode + '-manifest-before-' + hash(bytes) + '.json'; writeExact(name, bytes); backup.push({ slot, name, sha256: hash(bytes) });
  }
  const uniqueChanged = [...new Map(changed.map(f => [f.sha256, f])).values()];
  const expectedMissingBytes = uniqueChanged.reduce((n, f) => {
    const p = before.blobPath(f.sha256);
    if (fs.existsSync(p)) { assert(!fs.lstatSync(p).isSymbolicLink()); if (hash(fs.readFileSync(p)) === f.sha256) return n; }
    return n + f.bytes;
  }, 0);
  guard(); const staged = await before.stage();
  assert.equal(staged.staged, from === spec.previousRevision);
  assert.equal(staged.revision, spec.revision);
  assert.equal(staged.downloadedBytes, from === spec.previousRevision ? expectedMissingBytes : 0);
  const after = overlay(); assert.equal(await after.load(), spec.revision); assert.deepEqual(after.active, current);
  for (const f of current.files) { const bytes = await after.readVerified(f.path); assert(bytes, f.path); assert.equal(bytes.length, f.bytes, f.path); assert.equal(hash(bytes), f.sha256, f.path); }
  for (const f of previous.files) assert.equal(hash(fs.readFileSync(after.blobPath(f.sha256))), f.sha256, f.path);
  const initialBlobRequests = blobRequests, second = await after.stage();
  assert.equal(second.staged, false); assert.equal(second.downloadedBytes, 0); assert.equal(blobRequests, initialBlobRequests, 'Repeat update fetched a blob');
  const report = { status: 'PASS', source: mode, from, to: spec.revision, verifiedAt: new Date().toISOString(), manifestSha256: hash(signedBytes),
    changed, uniqueChangedBytes: uniqueChanged.reduce((n, f) => n + f.bytes, 0), downloadedBytes: staged.downloadedBytes,
    checked: current.files.length, preservedOldFiles: previous.files.length, secondDownload: 0, secondBlobRequests: 0, userDataPath, backup,
    alreadyInstalledBeforeVerification: from === spec.revision,
    limitations: from === spec.revision ? ['Cache was already r62; prior automatic download byte count was not observed. No downgrade was performed.'] : [] };
  write(mode + '-delta-report.json', report);
  console.log(JSON.stringify({ ...report, changed: changed.length, backup: backup.length }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
