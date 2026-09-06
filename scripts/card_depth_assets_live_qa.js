'use strict';
// Read-only verification of deployed Git bytes, not a gameplay test.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const commit = process.argv[2];
if (!commit || !/^[a-f0-9]{40}$/.test(commit)) throw new Error('Pass the full release commit');
const sha = value => crypto.createHash('sha256').update(value).digest('hex');
const blob = name => execFileSync('git', ['show', `${commit}:${name}`], { cwd:root, maxBuffer:20*1024*1024 });
const manifest = JSON.parse(blob('docs/CARD_DEPTH_V1_ASSETS.json'));
const base = 'https://onepiece-card-online.onrender.com';
const code = ['game.html', 'css/card-finish-v1.css', 'js/card_finish_v1.js'].map(name => {
  const data = blob(`public/${name}`);
  return { path:`/${name}`, bytes:data.length, sha256:sha(data) };
});
const files = [...code, ...manifest.cards.flatMap(card => card.files.map(file => ({ ...file, path:manifest.base + file.path })))];
if (manifest.card_count !== 80 || manifest.file_count !== 240 || files.length !== 243) throw new Error('Incomplete release manifest');
const report = { commit, result:'FAIL', startedAt:new Date().toISOString(), checked:[], errors:[] };
let index = 0;
async function worker() {
  while (index < files.length) {
    const item = files[index++];
    try {
      const response = await fetch(`${base}${item.path}?verify=${commit.slice(0,12)}`, { signal:AbortSignal.timeout(60000), cache:'no-store' });
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.status !== 200 || bytes.length !== item.bytes || sha(bytes) !== item.sha256) throw new Error(`HTTP ${response.status}; size/hash mismatch`);
      if (item.path.endsWith('.webp') && !/^image\/webp/i.test(response.headers.get('content-type') || '')) throw new Error('Wrong image content type');
      report.checked.push({ path:item.path, bytes:bytes.length, sha256:sha(bytes) });
    } catch (error) { report.errors.push({ path:item.path, error:String(error.message) }); }
  }
}
(async () => {
  await Promise.all([worker(), worker(), worker(), worker()]);
  report.result = report.errors.length ? 'FAIL' : 'PASS';
  report.finishedAt = new Date().toISOString();
  const output = path.join(root, 'artifacts/card-depth-v1/live-assets');
  fs.mkdirSync(output, { recursive:true });
  const file = path.join(output, `report-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ result:report.result, checked:report.checked.length, errors:report.errors, report:file }));
  if (report.result !== 'PASS') process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
