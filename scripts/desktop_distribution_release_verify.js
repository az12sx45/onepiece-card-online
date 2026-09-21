'use strict';

// Read-only deployed distribution checks. Program bytes are compared with the
// published manifest, not Windows checkout line endings. Media reads use Range.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const base = arg('--base', 'https://onepiece-card-online.onrender.com').replace(/\/$/, '');
const output = path.resolve(arg('--out', 'desktop-distribution-release-report.json'));
const local = new URL(base).hostname === '127.0.0.1' || new URL(base).hostname === 'localhost';
const desktopUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/148.0.0.0 Electron/44.1.1 Safari/537.36';
const browserUA = desktopUA.replace(' Electron/44.1.1', '');
const mediaKinds = new Set(['image', 'audio', 'video', 'font']);
const checks = [];
let bytesRead = 0;
function check(name, pass, details = {}) { checks.push({ name, pass: Boolean(pass), ...details }); }
function sha(bytes) { return crypto.createHash('sha256').update(bytes).digest('hex'); }
async function get(url, headers = {}, method = 'GET') {
  const response = await fetch(new URL(url, base), { method, headers, redirect: 'manual', signal: AbortSignal.timeout(45000) });
  const bytes = Buffer.from(await response.arrayBuffer());
  bytesRead += bytes.length;
  return { status: response.status, headers: Object.fromEntries(response.headers), bytes };
}
async function browserWebSocketStatus() {
  const target = new URL('/socket.io/?EIO=4&transport=websocket', base);
  return new Promise((resolve, reject) => {
    const transport = require(target.protocol === 'https:' ? 'node:https' : 'node:http');
    const request = transport.get(target, { headers: { 'User-Agent': browserUA, Origin: base,
      Upgrade: 'websocket', Connection: 'Upgrade', 'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': crypto.randomBytes(16).toString('base64') } });
    request.setTimeout(15000, () => request.destroy(new Error('websocket probe timeout')));
    request.on('error', reject);
    request.on('response', response => { response.resume(); resolve(response.statusCode); });
    request.on('upgrade', (response, socket) => { socket.destroy(); resolve(response.statusCode); });
  });
}
async function main() {
  const health = await get('/health');
  check('health', health.status === 200 && JSON.parse(health.bytes).ok);
  const landing = await get('/download', { 'User-Agent': browserUA });
  check('download page', landing.status === 200 && landing.headers['x-onepiece-distribution'] === 'desktop-only-v1'
    && landing.bytes.includes('download-link') && landing.bytes.length < 20000, { bytes: landing.bytes.length });
  const localLanding = fs.readFileSync(path.join(__dirname, '../public/desktop-download.html'), 'utf8').replace(/\r\n/g, '\n');
  check('download source', landing.bytes.toString().replace(/\r\n/g, '\n') === localLanding);
  for (const entry of ['/board_start.html', '/board_game.html?desktop=1', '/start.html', '/game.html', '/chess/index.html', '/chess/battle-game.html']) {
    const r = await get(entry, { 'User-Agent': browserUA });
    check('browser redirects ' + entry, r.status === 302 && r.headers.location === '/download' && r.bytes.length === 0);
  }
  for (const entry of ['/js/board_game.js?desktop=1', '/chess/battle-chess.js', '/vendor/socket.io-client/4.8.1/socket.io.min.js']) {
    const r = await get(entry, { 'User-Agent': browserUA });
    check('browser program denied ' + entry, r.status === 403 && JSON.parse(r.bytes).error === 'desktop_required');
  }
  const bundle = await get('/socket.io/socket.io.js', { 'User-Agent': browserUA });
  check('dynamic socket client bundle disabled', [400, 403, 404].includes(bundle.status) && bundle.bytes.length < 1000);
  const worker = await get('/sw.js', { 'User-Agent': browserUA });
  check('retired worker', worker.status === 200 && worker.bytes.includes('registration.unregister') && !worker.bytes.includes('caches.delete'));
  const polling = await get('/socket.io/?EIO=4&transport=polling', { 'User-Agent': browserUA, Origin: base });
  check('browser socket rejected polling', polling.status === 403);
  check('browser socket rejected websocket', await browserWebSocketStatus() === 403);
  const catalogResponse = await get('/desktop/catalog-v3.json');
  const catalog = JSON.parse(catalogResponse.bytes);
  const allMedia = new Map();
  const allPrograms = new Map();
  for (const [gameId, record] of Object.entries(catalog.games)) {
    const m = await get('/' + record.manifestPath);
    check(gameId + ' manifest SHA', m.status === 200 && sha(m.bytes) === record.manifestSha256);
    const manifest = JSON.parse(m.bytes);
    const runtime = await get('/api/desktop-runtime-package/' + gameId);
    const identity = JSON.parse(runtime.bytes);
    if (!local) check(gameId + ' runtime identity', runtime.status === 200 && identity.ok && identity.releaseId === record.releaseId,
      { releaseId: identity.releaseId, error: identity.error });
    for (const asset of manifest.assets) (mediaKinds.has(asset.kind) ? allMedia : allPrograms).set(asset.path, asset);
  }
  // Local Windows checkouts may use CRLF while release manifests freeze Git LF.
  for (const asset of allPrograms.values()) {
    const r = await get('/' + asset.path, { 'User-Agent': desktopUA });
    check('desktop program ' + asset.path, r.status === 200 && (local || (r.bytes.length === asset.size && sha(r.bytes) === asset.sha256)),
      { status: r.status, bytes: r.bytes.length, sha256: sha(r.bytes) });
  }
  const sample = [];
  for (const extension of ['.webp', '.png', '.mp3', '.ogg', '.mp4', '.otf']) {
    const asset = [...allMedia.values()].find(a => a.path.endsWith(extension));
    if (asset) sample.push(asset);
  }
  const chess = [...allMedia.values()].find(a => a.path.startsWith('images/chess/assets/'));
  if (chess) sample.push(chess);
  for (const asset of sample) {
    const expected = `${catalog.assetBlobBaseUrl}/${asset.sha256.slice(0, 2)}/${asset.sha256}`;
    for (const method of ['GET', 'HEAD']) {
      const r = await get('/' + asset.path, { 'User-Agent': desktopUA, Range: 'bytes=0-63' }, method);
      check('media redirect ' + method + ' ' + asset.path, r.status === 302 && r.headers.location === expected && r.bytes.length === 0);
    }
    const response = await fetch(expected, { headers: { Origin: base, Range: 'bytes=0-63' }, signal: AbortSignal.timeout(45000) });
    const headers = Object.fromEntries(response.headers);
    if (response.status !== 206) { await response.body.cancel(); check('R2 Range ' + asset.path, false, { status: response.status }); continue; }
    const bytes = Buffer.from(await response.arrayBuffer()); bytesRead += bytes.length;
    check('R2 Range and CORS ' + asset.path, bytes.length === 64 && headers['content-range'] === `bytes 0-63/${asset.size}`
      && [base, '*'].includes(headers['access-control-allow-origin']) && headers['content-type']?.split(';')[0] === asset.mime,
    { bytes: bytes.length, status: response.status, cors: headers['access-control-allow-origin'], mime: headers['content-type'] });
  }
  const release = JSON.parse((await get('/desktop/launcher-release-v1.json')).bytes);
  const installer = await get(release.artifact.url, {}, 'HEAD');
  check('installer remains available', installer.status === 200 && Number(installer.headers['content-length']) === release.artifact.bytes,
    { version: release.version, bytes: release.artifact.bytes });
}
main().catch(error => check('verification exception', false, { error: error.message })).finally(() => {
  const report = { ok: checks.length > 0 && checks.every(c => c.pass), base, at: new Date().toISOString(),
    localProgramByteHashCheckSkipped: local, bytesRead, total: checks.length, checks };
  fs.mkdirSync(path.dirname(output), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ ...report, checks: undefined, failures: checks.filter(c => !c.pass), output }, null, 2));
  process.exitCode = report.ok ? 0 : 1;
});
