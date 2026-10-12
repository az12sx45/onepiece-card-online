'use strict';
const { assert, root, spec, hash, blob, get, write, origin, manifests, preservedGames } = require('./common');
async function blobs() {
  const { current, changed } = manifests(), verified = [];
  for (const f of changed) {
    const url = current.baseUrl + f.sha256;
    const head = await fetch(url, { method: 'HEAD', headers: { 'accept-encoding': 'identity' }, signal: AbortSignal.timeout(30000) });
    assert.equal(head.status, 200, f.path); assert.equal(Number(head.headers.get('content-length')), f.bytes, f.path);
    const bytes = await get(url); assert.equal(bytes.length, f.bytes, f.path); assert.equal(hash(bytes), f.sha256, f.path);
    verified.push(f);
  }
  write('public-blobs-report.json', { status: 'PASS', revision: spec.revision, verifiedAt: new Date().toISOString(), verified });
  console.log('PASS ' + verified.length + ' immutable launcher blobs');
}
async function games() {
  const local = preservedGames();
  const bytes = await get(origin + '/desktop/catalog-v3.json');
  assert.equal(hash(bytes), hash(blob(spec.baseline, 'public/desktop/catalog-v3.json')), 'Public game catalog must remain byte-identical to r61');
  const catalog = JSON.parse(bytes), records = {};
  for (const [game, meta] of Object.entries(catalog.games)) {
    const manifest = await get(origin + '/' + meta.manifestPath);
    assert.equal(hash(manifest), hash(blob(spec.baseline, 'public/' + meta.manifestPath)), game + ' baseline manifest identity');
    assert.equal(hash(manifest), meta.manifestSha256);
    const runtime = JSON.parse(await get(origin + '/api/desktop-runtime-package/' + game));
    assert.equal(runtime.ok, true); assert.equal(runtime.releaseId, meta.releaseId); assert.equal(runtime.manifestSha256, meta.manifestSha256);
    records[game] = { releaseId: meta.releaseId, manifestSha256: meta.manifestSha256, runtimeEndpointIdentityVerified: true };
  }
  write('public-games-report.json', { status: 'PASS', verifiedAt: new Date().toISOString(), catalogSha256: hash(bytes), games: records, byteIdenticalToR61: true, localProtectedFiles: local.files.length });
  console.log('PASS all three game catalogs, manifests, runtime identities and local programs preserved');
}
async function shop() {
  const { io } = require('D:/Codex_QA/launcher-content-1.2.23-deps/desktop/node_modules/socket.io-client');
  await new Promise((resolve, reject) => {
    const s = io(origin, { transports: ['websocket'], reconnection: false, timeout: 30000 });
    const finish = e => { clearTimeout(timer); s.disconnect(); e ? reject(e) : resolve(); };
    const timer = setTimeout(() => finish(Error('Public shop timeout')), 45000);
    s.once('connect_error', finish);
    s.once('connect', () => s.emit('LAUNCHER_SHOP_GET', { preview: true, crewContentRevision: 1 }, r => {
      try {
        assert.equal(r.ok, true);
        const items = r.shop.catalog || r.shop.items;
        const local = JSON.parse(JSON.stringify(require(root + '/server/launcher-profile-shop').CATALOG));
        assert.equal(items.length, 330); assert.deepEqual(items, local, 'Full public catalog differs from authority');
        const counts = items.reduce((out, item) => { out[item.type] = (out[item.type] || 0) + 1; return out; }, {});
        write('public-shop-report.json', { status: 'PASS', verifiedAt: new Date().toISOString(), scope: 'Anonymous full catalog preview; no player, wallet or account mutation', totalItems: items.length, counts, catalogSha256: hash(JSON.stringify(items)), exactAuthorityMatch: true });
        console.log('PASS all 330 public shop records match authority'); finish();
      } catch (e) { finish(e); }
    }));
  });
}
async function manifest(wait) {
  const { signedBytes } = manifests(); let previous, lastError;
  for (let i = 0; i < (wait ? 40 : 1); i++) {
    try {
      const raw = await get(origin + '/desktop/launcher-content-v1.json'), value = JSON.parse(raw);
      if (value.revision !== previous) { console.log('Public content revision ' + value.revision); previous = value.revision; }
      if (hash(raw) === hash(signedBytes) && value.revision === spec.revision) {
        write('public-manifest-report.json', { status: 'PASS', revision: spec.revision, sha256: hash(raw), verifiedAt: new Date().toISOString() });
        console.log('PASS public signed r62 manifest'); return;
      }
      if (!wait) throw Error('Public r62 manifest not yet served');
      lastError = null;
    } catch (e) {
      if (!wait) throw e;
      if (lastError !== e.message) console.log('Public check temporarily failed: ' + e.message);
      lastError = e.message;
    }
    await new Promise(r => setTimeout(r, 45000));
  }
  throw Error('Public r62 not observed within this observation window');
}
(async () => {
  const mode = process.argv[2] || 'all';
  assert(['all', 'blobs', 'games', 'shop', 'manifest', 'wait'].includes(mode));
  if (mode === 'wait') return manifest(true);
  if (mode === 'all' || mode === 'manifest') await manifest(false);
  if (mode === 'all' || mode === 'blobs') await blobs();
  if (mode === 'all' || mode === 'games') await games();
  if (mode === 'all' || mode === 'shop') await shop();
})().catch(e => { console.error(e.message); process.exitCode = 1; });
