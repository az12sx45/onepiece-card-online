'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { createRequire } = require('node:module');
const P = require('./publish');
const { validateManifest } = require('../../scripts/desktop_program_package_common');
const { RELEASE_PATH, PROGRAM_FILES, validateMarinefordRelease } = require('../../desktop/marineford-release');

const args = process.argv.slice(2);
const live = args.includes('--live');
const expectedCommit = args.find(value => /^[a-f0-9]{40}$/.test(value));
assert(args.length === (live ? 2 : 1) && expectedCommit &&
  args.every(value => value === expectedCommit || value === '--live'), 'Expected full source commit and optional --live');
const repoRoot = path.resolve(__dirname, '..', '..');
assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).toString().trim(), expectedCommit);
const publicRoot = path.join(repoRoot, 'public');
const reference = JSON.parse(fs.readFileSync(path.join(publicRoot, RELEASE_PATH)));
validateMarinefordRelease(reference);
const manifestBytes = fs.readFileSync(path.join(publicRoot, reference.manifestPath));
assert.equal(P.sha256Bytes(manifestBytes), reference.manifestSha256);
const manifest = validateManifest(JSON.parse(manifestBytes), 'marineford');
assert.equal(manifest.releaseId, reference.releaseId);
assert.equal(manifest.entryPath, reference.entryPath);
assert.equal(manifest.totalFiles, reference.totalFiles);
assert.equal(manifest.totalBytes, reference.totalBytes);
assert.deepEqual(manifest.assets.filter(asset => asset.kind !== 'image').map(asset => asset.path), PROGRAM_FILES);
const records = new Map();
for (const asset of manifest.assets) {
  let record = records.get(asset.sha256);
  if (!record) {
    record = { ...asset, key: P.objectKeyForSha256(asset.sha256), sources: [], games: ['marineford'] };
    records.set(asset.sha256, record);
  }
  assert.equal(record.kind, asset.kind);
  assert.equal(record.mime, asset.mime);
  assert.equal(record.size, asset.size);
  record.sources.push(asset.path);
}
const inventory = {
  repoRoot, publicRoot, catalogSchema: 3,
  logicalFiles: manifest.totalFiles, logicalBytes: manifest.totalBytes,
  uniqueFiles: records.size,
  uniqueBytes: [...records.values()].reduce((sum, record) => sum + record.size, 0),
  records: [...records.values()]
};

async function main() {
  let context = null;
  try {
    if (live) {
      const sdk = createRequire(path.join(__dirname, 'publish.js'))('@aws-sdk/client-s3');
      const { endpoint, region, credentials, bucket } = P.loadLiveConfiguration();
      context = {
        client: new sdk.S3Client({ endpoint, region, credentials }), bucket,
        HeadObjectCommand: sdk.HeadObjectCommand, PutObjectCommand: sdk.PutObjectCommand
      };
    }
    const result = await P.publishInventory(inventory, { live, liveContext: context, concurrency: 4 });
    process.stdout.write(JSON.stringify({
      ...result, sourceCommit: expectedCommit, releaseId: manifest.releaseId,
      manifestSha256: reference.manifestSha256
    }, null, 2) + '\n');
  } finally {
    context?.client.destroy();
  }
}

main().catch(error => {
  process.stderr.write('Marineford program publication failed: ' + error.message + '\n');
  process.exitCode = 1;
});
