import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Keep the online compatibility patch identical to the shared source. Installed
// Android/iOS hosts retain their injected bundle until the next binary update.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobile = process.argv[2];
if (!mobile || !path.isAbsolute(mobile)) throw Error('Supply the verified absolute mobile source root');
const web = path.join(mobile, 'android/web');
const read = name => fs.readFileSync(path.join(web, name), 'utf8');
const section = (source, marker) => {
  const start = source.indexOf(marker);
  if (start < 0) throw Error('Missing source marker: ' + marker);
  return source.slice(start);
};
const script = read('card-menu-layout.js') + '\n' + section(read('card-seat-hud.js'), '/* Online-compatible own collection */');
const css = (read('card-menu-layout.css')
  + '\n' + section(read('card-seat-hud.css'), '/* Larger local player plate and a private collection, shared with retained hosts. */'))
  .replace(/url\("art\/([\w-]+\.webp)"\)/g, (_, name) => `url("data:image/webp;base64,${fs.readFileSync(path.join(web, 'art', name)).toString('base64')}")`);
const start = '<!-- CARD_HUD_COLLECTION_START -->', end = '<!-- CARD_HUD_COLLECTION_END -->';
const block = `${start}\n<style>\n${css}\n</style>\n<script>\n${script}\n</script>\n${end}`;
const file = path.join(root, 'public/game.html');
let html = fs.readFileSync(file, 'utf8');
if (html.includes(start)) {
  const a = html.indexOf(start), b = html.indexOf(end, a);
  if (b < 0) throw Error('Incomplete online patch marker');
  html = html.slice(0, a) + block + html.slice(b + end.length);
} else {
  if (!html.includes('</body>')) throw Error('Missing body end');
  html = html.replace('</body>', block + '\n</body>');
}
html = html.replace(/(css\/card-desktop-table\.css|js\/card-desktop-table\.js)\?v=[^"\s]+/g, '$1?v=20261103-hud-collection1');
fs.writeFileSync(file, html);
console.log(JSON.stringify({ file, onlineScriptBytes: Buffer.byteLength(script), onlineCssBytes: Buffer.byteLength(css) }));
