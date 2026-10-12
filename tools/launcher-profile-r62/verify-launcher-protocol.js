'use strict';
const vm = require('vm');
const { fs, path, assert, root, origin, spec, hash, write, manifests } = require('./common');
const { LauncherContentOverlay, RENDERER_FILES } = require(root + '/desktop/launcher-content-overlay');
const src = fs.readFileSync(root + '/desktop/main.js', 'utf8');
const cut = (a, b) => { const start = src.indexOf(a), end = src.indexOf(b, start); assert(start >= 0 && end > start); return src.slice(start, end); };
(async () => {
  const { current, changed } = manifests();
  const overlay = new LauncherContentOverlay({ coreVersion: spec.coreVersion, userDataPath: 'D:/Codex_QA/launcher-fishing-r45/candidate', origin, fetchImpl: () => { throw Error('Unexpected network'); } });
  assert.equal(await overlay.load(), spec.revision); assert.deepEqual(overlay.active, current);
  let handler, fallbacks = 0;
  const context = vm.createContext({ path, URL, Response, Headers, Buffer, LAUNCHER_SCHEME: 'opui', RENDERER_FILES,
    launcherContentOverlay: overlay, __dirname: root + '/desktop', protocol: { handle: async (s, h) => { assert.equal(s, 'opui'); handler = h; } },
    resolveLauncherResource: () => { fallbacks++; throw Error('Unexpected bundled fallback'); }, streamFileResponse: () => { throw Error('Unexpected bundled fallback'); } });
  vm.runInContext(cut('function mimeForPath(', 'function launcherWindowSize(') + cut('function parseRange(', 'async function streamFileResponse(') + cut('async function installLauncherProtocol(', 'function requestAssetPath(') + '\nglobalThis.install=installLauncherProtocol;', context);
  await context.install(); const checks = [];
  for (const f of changed) {
    const url = 'opui://' + (RENDERER_FILES.has(f.path) ? 'launcher-ui/' : 'launcher/') + f.path;
    for (const method of ['GET', 'HEAD']) {
      const res = await handler(new Request(url, { method })); assert.equal(res.status, 200, url);
      assert.equal(Number(res.headers.get('content-length')), f.bytes);
      if (method === 'GET') assert.equal(hash(Buffer.from(await res.arrayBuffer())), f.sha256);
      checks.push(method + ' ' + url);
    }
  }
  assert.equal(fallbacks, 0);
  write('launcher-protocol-report.json', { status: 'PASS', scope: 'Actual core installLauncherProtocol and verifiedOverlayResponse with signed r62 candidate, exact bytes and zero network/bundle fallback.', coreSourceSha256: hash(Buffer.from(src)), checks, fallbacks });
  console.log(JSON.stringify({ status: 'PASS', checks: checks.length, fallbacks }));
})().catch(e => { console.error(e.message); process.exitCode = 1; });
