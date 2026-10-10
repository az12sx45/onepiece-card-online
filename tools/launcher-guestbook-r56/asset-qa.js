const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../..');
const manifest = require('./styles.json');
const out = process.argv[2] || 'D:/Codex_QA/launcher-guestbook-r56-art';
fs.mkdirSync(out, {recursive: true});
(async () => {
  const result = {status: 'PASS', boards: [], notes: [], totalBytes: 0, checks: []};
  const check = (name, pass) => { result.checks.push({name, pass}); if (!pass) result.status = 'FAIL'; };
  const hashes = new Set();
  check('10 board styles', manifest.boards.length === 10);
  check('20 note styles', manifest.notes.length === 20);
  for (const kind of ['boards', 'notes']) {
    const composites = [];
    const cw = kind === 'boards' ? 384 : 384, ch = kind === 'boards' ? 216 : 192;
    const cols = kind === 'boards' ? 2 : 4;
    for (let i = 0; i < manifest[kind].length; i++) {
      const item = manifest[kind][i];
      const file = path.join(root, 'public', item.asset.replace('opui://launcher/', ''));
      const bytes = fs.readFileSync(file);
      const meta = await sharp(bytes).metadata();
      const stats = await sharp(bytes).stats();
      const hash = crypto.createHash('sha256').update(bytes).digest('hex');
      const note = kind === 'notes';
      check(item.key + ' dimensions', meta.width === (note ? 960 : 1536) && meta.height === (note ? 480 : 864));
      check(item.key + ' unique bytes', !hashes.has(hash)); hashes.add(hash);
      if (note) check(item.key + ' real transparent outside', meta.hasAlpha && !stats.isOpaque && stats.channels[3].min === 0 && stats.channels[3].max === 255);
      const row = {key: item.key, name: item.name, width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, bytes: bytes.length, sha256: hash};
      result[kind].push(row); result.totalBytes += bytes.length;
      const img = await sharp(bytes).resize(cw, ch, {fit:'contain', background:'#102435'}).flatten({background:'#102435'}).png().toBuffer();
      const label = Buffer.from('<svg width="384" height="26"><rect width="384" height="26" fill="#102435"/><text x="8" y="18" font-size="14" font-family="sans-serif" fill="#ecd49b">' + item.key + '</text></svg>');
      const x = (i % cols) * cw, y = Math.floor(i / cols) * (ch + 26);
      composites.push({input:img,left:x,top:y},{input:label,left:x,top:y+ch});
    }
    await sharp({create:{width:cols*cw,height:Math.ceil(manifest[kind].length/cols)*(ch+26),channels:3,background:'#102435'}}).composite(composites).png().toFile(path.join(out, kind + '-contact.png'));
  }
  fs.writeFileSync(path.join(out, 'asset-qa.json'), JSON.stringify(result,null,2));
  console.log(JSON.stringify({status:result.status,checks:result.checks.length,totalBytes:result.totalBytes,boardCount:result.boards.length,noteCount:result.notes.length,out},null,2));
  if (result.status !== 'PASS') process.exitCode = 1;
})().catch(error => {console.error(error);process.exitCode=1;});
