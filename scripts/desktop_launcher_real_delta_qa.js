'use strict';

// Optional release fixture test: node scripts/desktop_launcher_real_delta_qa.js OLD_EXE NEW_EXE SIGNED_MANIFEST QA_ROOT
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { rebuildInstaller } = require('../desktop/launcher-blockmap-delta');
const { validateReleaseManifest, verifyInstaller } = require('../desktop/launcher-update-service');

async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function main() {
  const [oldExe, newExe, manifestPath, qaRoot] = process.argv.slice(2).map((value) => path.resolve(value || '.'));
  if (!oldExe || !newExe || !manifestPath || !qaRoot || process.argv.length !== 6) {
    throw new Error('Usage: node scripts/desktop_launcher_real_delta_qa.js OLD_EXE NEW_EXE SIGNED_MANIFEST QA_ROOT');
  }
  const manifest = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
  const oldVersion = /Launcher-(\d+\.\d+\.\d+)-x64\.exe$/.exec(path.basename(oldExe))?.[1];
  if (!oldVersion) throw new Error('Old installer filename is not canonical.');
  const release = validateReleaseManifest(manifest, {
    manifestUrl: new URL('https://onepiece-card-online.onrender.com/desktop/launcher-release-v1.json'),
    currentVersion: oldVersion,
    allowedArtifactOrigins: new Set(['https://game-assets.rihdi.tw'])
  });
  assert.equal(release.updateAvailable, true);
  assert.equal(path.basename(newExe), release.fileName);
  assert.equal((await fsp.stat(newExe)).size, release.bytes);
  assert.equal(await hashFile(newExe), release.sha256);

  const oldSha = await hashFile(oldExe);
  const runRoot = path.join(qaRoot, `delta-${oldVersion}-to-${release.version}`);
  await fsp.mkdir(runRoot, { recursive: true });
  const oldFolder = path.join(runRoot, `${oldVersion}-${oldSha.slice(0, 16)}`);
  await fsp.mkdir(oldFolder, { recursive: true });
  const cachedOld = path.join(oldFolder, path.basename(oldExe));
  const partPath = path.join(runRoot, `${release.fileName}.part`);
  const reportPath = path.join(qaRoot, `delta-${oldVersion}-to-${release.version}-report.json`);
  const calls = [];
  try {
    await fsp.link(oldExe, cachedOld);
    const fetchImpl = async (url, options) => {
      const source = url.endsWith(`${path.basename(oldExe)}.blockmap`) ? `${oldExe}.blockmap`
        : url.endsWith(`${path.basename(newExe)}.blockmap`) ? `${newExe}.blockmap`
          : url === release.artifactUrl.href ? newExe : null;
      if (!source) throw new Error(`Unexpected URL: ${url}`);
      const range = options?.headers?.Range || '';
      calls.push({ url, range });
      if (!range) {
        const bytes = await fsp.readFile(source);
        return { status: 200, ok: true, url, headers: { get: (name) => name.toLowerCase() === 'content-length' ? String(bytes.length) : null },
          body: { async *[Symbol.asyncIterator]() { yield bytes; } } };
      }
      const match = /^bytes=(\d+)-(\d+)$/.exec(range);
      if (!match) throw new Error(`Invalid requested Range: ${range}`);
      const start = Number(match[1]);
      const end = Number(match[2]);
      const length = end - start + 1;
      return { status: 206, ok: true, url,
        headers: { get: (name) => ({ 'content-length': String(length), 'content-range': `bytes ${start}-${end}/${release.bytes}` })[name.toLowerCase()] || null },
        body: fs.createReadStream(newExe, { start, end }) };
    };
    const delta = await rebuildInstaller({ artifactUrl: release.artifactUrl, currentVersion: oldVersion,
      downloadRoot: runRoot, partPath, expectedSize: release.bytes,
      fetchImpl, signal: new AbortController().signal, onProgress: () => {} });
    assert.ok(delta, 'real release pair should qualify for differential download');
    assert.ok(delta.downloadedBytes < release.bytes, 'real release pair should save network bytes');
    await verifyInstaller(partPath, release, Number.MAX_SAFE_INTEGER);
    const report = { status: 'PASS', oldVersion, newVersion: release.version, oldBytes: (await fsp.stat(oldExe)).size,
      newBytes: release.bytes, downloadedBytes: delta.downloadedBytes, reusedBytes: delta.reusedBytes,
      rangeRequests: calls.filter((call) => call.range).length, sha256: release.sha256 };
    await fsp.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
    process.stdout.write(`DESKTOP_LAUNCHER_REAL_DELTA_QA=PASS ${JSON.stringify(report)}\n`);
  } finally {
    await fsp.rm(partPath, { force: true });
    await fsp.rm(cachedOld, { force: true });
    await fsp.rmdir(oldFolder).catch(() => {});
    await fsp.rmdir(runRoot).catch(() => {});
  }
}

main().catch((error) => {
  process.stderr.write(`DESKTOP_LAUNCHER_REAL_DELTA_QA=FAIL ${error.stack || error}\n`);
  process.exitCode = 1;
});
