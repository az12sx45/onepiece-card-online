'use strict';
const { fs, path, cp, assert, root, qa, spec, hash, git, blob, write, writeExact, preservedGames } = require('./common');
const head = git('rev-parse', 'HEAD').toString().trim();
git('merge-base', '--is-ancestor', spec.baseline, head);
assert.notEqual(head, spec.baseline, 'Commit reviewed r62 source before building');
assert.deepEqual(JSON.parse(blob(head, 'tools/launcher-profile-r62/release-spec.json')), spec);
const gamePreservation = preservedGames(head);
const baselineBytes = blob(spec.baseline, 'public/desktop/launcher-content-v1.json');
assert.equal(hash(fs.readFileSync(root + '/public/desktop/launcher-content-v1.json')), hash(baselineBytes), 'Signed baseline overlay moved before build');
const previous = require(root + '/desktop/launcher-content-overlay').validateManifest(JSON.parse(baselineBytes), spec.coreVersion);
assert.equal(previous.revision, spec.previousRevision); assert.equal(previous.files.length, spec.previousFiles);
writeExact('baseline-launcher-content-v1.json', baselineBytes);
writeExact('baseline-catalog-v3.json', blob(spec.baseline, 'public/desktop/catalog-v3.json'));
const changed = [...spec.rendererFiles, ...spec.images];
for (const p of changed) {
  const source = (p.startsWith('images/') ? 'public/' : 'desktop/') + p;
  assert.equal(hash(fs.readFileSync(path.join(root, source))), hash(blob(head, source)), 'Uncommitted release source: ' + source);
}
assert(!fs.existsSync(path.join(qa, 'unsigned-r62.json')), 'Unsigned candidate already exists; inspect before rebuilding');
const args = [root + '/tools/desktop-r2-publisher/launcher-content-manifest.js', 'build', '--repo-root', root, '--core-version', spec.coreVersion,
  '--revision', String(spec.revision), '--carry-from', qa + '/baseline-launcher-content-v1.json', '--output', qa + '/unsigned-r62.json'];
for (const p of changed) args.push('--include', p);
cp.execFileSync(process.execPath, args, { cwd: root, stdio: 'inherit', windowsHide: true });
const manifest = JSON.parse(fs.readFileSync(qa + '/unsigned-r62.json'));
const old = new Map(previous.files.map(f => [f.path, f]));
assert.deepEqual(manifest.files.map(f => f.path).sort(), [...new Set([...old.keys(), ...changed])].sort());
for (const f of manifest.files) {
  if (changed.includes(f.path)) {
    const bytes = blob(head, (f.path.startsWith('images/') ? 'public/' : 'desktop/') + f.path);
    assert.equal(f.sha256, hash(bytes)); assert.equal(f.bytes, bytes.length);
    assert.notEqual(f.sha256, old.get(f.path)?.sha256, 'Listed path did not change: ' + f.path);
  } else assert.deepEqual(f, old.get(f.path), 'Unrelated overlay entry changed: ' + f.path);
}
const unique = [...new Map(manifest.files.filter(f => changed.includes(f.path)).map(f => [f.sha256, f])).values()];
const report = { status: 'PASS', sourceCommit: head, baseline: spec.baseline, revision: spec.revision, coreVersion: spec.coreVersion,
  files: manifest.files.length, changedPaths: changed, uniqueChangedBytes: unique.reduce((n, f) => n + f.bytes, 0),
  catalogSha256: hash(blob(spec.baseline, 'public/desktop/catalog-v3.json')), gameProgramsPreserved: gamePreservation.files,
  carryPolicy: 'Exact signed r61 entries preserved outside the listed renderer and announcement paths; game catalogs, manifests and program source bytes unchanged.' };
write('renderer-inventory-report.json', report);
console.log(JSON.stringify({ status: report.status, sourceCommit: head, files: report.files, uniqueChangedBytes: report.uniqueChangedBytes, gameProgramsPreserved: gamePreservation.files.length }));
