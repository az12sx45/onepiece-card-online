// Format generated PNG assets for the shipped guestbook. No painted content is changed.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root = path.resolve(__dirname, '../..');
const rows = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
(async () => {
  const out = [];
  for (const row of rows) {
    const target = path.join(root, 'public/images/launcher_guestbook', row.kind, row.key + '.webp');
    const meta = await sharp(row.source).metadata();
    const note = row.kind === 'notes';
    await sharp(row.source).resize(note ? 960 : 1536, note ? 480 : 864, { fit: note ? 'contain' : 'cover', position: 'centre', background: { r: 0, g: 0, b: 0, alpha: 0 } }).webp({quality: 91, effort: 6, alphaQuality: 100}).toFile(target);
    const finalMeta = await sharp(target).metadata();
    const stat = await sharp(target).stats();
    out.push({key: row.key, kind: row.kind, source: row.source, sourceWidth: meta.width, sourceHeight: meta.height, target, width: finalMeta.width, height: finalMeta.height, hasAlpha: finalMeta.hasAlpha, opaque: stat.isOpaque, bytes: fs.statSync(target).size});
  }
  console.log(JSON.stringify(out, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
