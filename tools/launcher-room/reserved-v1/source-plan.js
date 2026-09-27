'use strict';
// Hash exact, explicitly selected GPT originals. Partial plans are preview-only.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const KEYS = ['ace', 'sabo', 'law', 'hancock'];
const SHEETS = ['master', 'walk-side', 'walk-front', 'acting-side', 'acting-front', 'work', 'utility'];
function build(root, selection) {
  const plan = { schema: 'one-piece-room-reserved-selection/1', releasePolicy: 'preloaded-not-released',
    selectionStatus: 'DRAFT', humanAcceptance: false, characters: Object.fromEntries(KEYS.map(k => [k, {}])), sources: {}, missing: [] };
  const reference = filename => { const bytes = fs.readFileSync(filename); return { path: path.relative(root, filename).split(path.sep).join('/'), sha256: crypto.createHash('sha256').update(bytes).digest('hex'), bytes: bytes.length }; };
  for (const key of KEYS) for (const sheet of SHEETS) {
    const name = selection[key] && selection[key][sheet];
    if (!name) { plan.missing.push(`${key}/${sheet}`); continue; }
    if (!new RegExp(`^${sheet}-[0-9]{2}$`).test(name)) throw Error(`Invalid explicit selection ${key}/${name}`);
    const folder = path.join(root, 'tools/launcher-room/reserved-v1/sources', key, name);
    const files = ['source.png', 'prompt.txt', 'receipt.json'].map(n => path.join(folder, n));
    if (files.some(n => !fs.existsSync(n))) throw Error(`Incomplete source ${key}/${name}`);
    plan.sources[`${key}-${sheet}`] = { key, sheet, generator: 'gpt-image', image: reference(files[0]), prompt: reference(files[1]), receipt: reference(files[2]) };
  }
  return plan;
}
if (require.main === module) {
  const [selectionFile, outputFile, rootArg] = process.argv.slice(2);
  if (!selectionFile || !outputFile) throw Error('Usage: node source-plan.js explicit-selection.json new-plan.json [source-root]');
  const root = path.resolve(rootArg || path.join(__dirname, '../../..'));
  const plan = build(root, JSON.parse(fs.readFileSync(selectionFile, 'utf8').replace(/^\uFEFF/, '')));
  fs.mkdirSync(path.dirname(path.resolve(outputFile)), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(plan, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ output: path.resolve(outputFile), sources: Object.keys(plan.sources).length, missing: plan.missing, selectionStatus: plan.selectionStatus }));
}
module.exports = { build };
