import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mobile=process.argv[2];
if(!mobile||!path.isAbsolute(mobile))throw Error('Supply verified absolute shared mobile root');
const web=path.join(mobile,'android/web');
const script=fs.readFileSync(path.join(web,'card-picker-panels.js'),'utf8');
const css=fs.readFileSync(path.join(web,'card-picker-panels.css'),'utf8').replace(/url\("art\/([\w-]+\.webp)"\)/g,(_,name)=>`url("data:image/webp;base64,${fs.readFileSync(path.join(web,'art',name)).toString('base64')}")`);
const start='<!-- CARD_PICKER_PANELS_BEGIN -->',end='<!-- CARD_PICKER_PANELS_END -->';
const block=`${start}\n<style>\n${css}\n</style>\n<script>\n${script}\n</script>\n${end}`;
const file=path.join(root,'public/game.html');let html=fs.readFileSync(file,'utf8');
if(html.includes(start)){const a=html.indexOf(start),b=html.indexOf(end,a);if(b<0)throw Error('Incomplete picker marker');html=html.slice(0,a)+block+html.slice(b+end.length);}
else{if(!html.includes('</body>'))throw Error('Missing body end');html=html.replace('</body>',block+'\n</body>');}
html=html.replace(/(css\/card-desktop-table\.css|js\/card-desktop-table\.js)\?v=[^"\s]+/g,'$1?v=20261103-picker-panels1');
fs.writeFileSync(file,html);console.log(JSON.stringify({file,scriptBytes:Buffer.byteLength(script),cssBytes:Buffer.byteLength(css)}));
