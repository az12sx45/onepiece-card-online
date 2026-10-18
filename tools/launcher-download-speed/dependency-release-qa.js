'use strict';

// Compare production dependency payloads with the retained, working 1.2.23
// ASAR. Presence of socket.io-client alone does not prove its closure is packed.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const asar = require('@electron/asar');
const BASELINE = 'D:/Codex_QA/launcher-content-1.2.23-build-r3/source/desktop/dist/win-unpacked/resources/app.asar';
const BASELINE_SHA = '6832f60b233429f1c9642d68da6300a91cc6e94464c58b14451f02d28c934a78';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const plain = value => value.replace(/^[/\\]+/, '').replaceAll('\\', '/');

function payloads(file) {
  const files = new Map();
  for (const name of asar.listPackage(file).map(plain).filter(name => name.startsWith('node_modules/'))) {
    const native = path.normalize(name);
    const stat = asar.statFile(file, native, false);
    if (stat.files) continue;
    assert(!stat.link, `Production dependency cannot be an archive link: ${name}`);
    files.set(name, asar.extractFile(file, native));
  }
  return files;
}

function main(argv = process.argv.slice(2)) {
  const options = { baseline: BASELINE };
  for (let index = 0; index < argv.length; index++) {
    const key = argv[index];
    assert(['--baseline-asar', '--candidate-asar', '--report'].includes(key), `Unknown argument: ${key}`);
    const value = argv[++index];
    assert(value && !value.startsWith('--'), `Missing value: ${key}`);
    options[{ '--baseline-asar': 'baseline', '--candidate-asar': 'candidate', '--report': 'report' }[key]] = path.resolve(value);
  }
  assert(options.candidate && options.report, '--candidate-asar and a new --report path are required.');
  assert(!fs.existsSync(options.report), 'Retain the old report and select a new path.');
  assert.equal(sha(fs.readFileSync(options.baseline)), BASELINE_SHA, 'The independent dependency baseline changed.');
  const baseline = payloads(options.baseline), candidate = payloads(options.candidate);
  assert.equal(baseline.size, 172, 'Expected the complete known production dependency payload.');
  const report = { ok: false, baselineAsar: options.baseline, baselineAsarSha256: BASELINE_SHA,
    candidateAsar: options.candidate, candidateAsarSha256: sha(fs.readFileSync(options.candidate)),
    expectedFiles: baseline.size, actualFiles: candidate.size, missing: [], changed: [], extra: [], files: [], packages: [] };
  for (const [name, bytes] of baseline) {
    const actual = candidate.get(name);
    const record = { path: name, bytes: bytes.length, sha256: sha(bytes), exact: Boolean(actual?.equals(bytes)) };
    report.files.push(record);
    if (!actual) report.missing.push(name);
    else if (!actual.equals(bytes)) report.changed.push({ path: name, expectedSha256: record.sha256, actualSha256: sha(actual) });
    if (name.endsWith('/package.json')) {
      const pkg = JSON.parse(bytes);
      if (pkg.name && pkg.version) report.packages.push({ path: name, name: pkg.name, version: pkg.version, dependencies: pkg.dependencies || {} });
    }
  }
  report.extra = [...candidate.keys()].filter(name => !baseline.has(name));
  report.ok = !report.missing.length && !report.changed.length && !report.extra.length;
  fs.writeFileSync(options.report, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ok: report.ok, expectedFiles: report.expectedFiles, actualFiles: report.actualFiles,
    missing: report.missing.length, changed: report.changed.length, extra: report.extra.length, report: options.report }));
  assert(report.ok, 'The packaged production dependency closure differs from the working baseline.');
  return report;
}

if (require.main === module) {
  try { main(); } catch (error) { console.error(error.stack); process.exitCode = 1; }
}
module.exports = { main, payloads };
