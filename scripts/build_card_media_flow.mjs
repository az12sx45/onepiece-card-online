import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),mobile=process.argv[2];
if(!mobile||!path.isAbsolute(mobile))throw Error('Supply verified absolute mobile source root');
const web=path.join(mobile,'android/web'),read=name=>fs.readFileSync(path.join(web,name),'utf8');
const file=path.join(root,'public/game.html');let html=fs.readFileSync(file,'utf8');
const source=read('card-enhancement-summon.js');
const start=html.indexOf('/* Public enhanced-card projection. No hand inspection or gameplay decisions. */');
const end=html.indexOf('\n})();',start);
if(start<0||end<0)throw Error('Existing inline summon not found');
html=html.slice(0,start)+source.trimEnd()+html.slice(end+'\n})();'.length);
const a='<!-- CARD_MEDIA_FLOW_BEGIN -->',b='<!-- CARD_MEDIA_FLOW_END -->';
const loading=read('card-enhancement-summon.css').match(/^html\[data-card-phone\] \.card-summon-loading\{[^\n]+\}/m)?.[0];
if(!loading)throw Error('Missing shared loading style');
const css=read('card-return-hand.css')+'\n'+loading+'\n';
const block=`${a}\n<style>\n${css}\n</style>\n<script>\n${read('card-return-hand.js')}\n${read('card-enhancement-ready.js')}\n</script>\n${b}`;
if(html.includes(a)){const x=html.indexOf(a),y=html.indexOf(b,x);if(y<0)throw Error('Incomplete media marker');html=html.slice(0,x)+block+html.slice(y+b.length);}
else html=html.replace('</body>',block+'\n</body>');
const venueA='<!-- CARD_VENUE_READY_BEGIN -->',venueB='<!-- CARD_VENUE_READY_END -->';
const venueSource=read('card-venue-ready.js');
const venueX=html.indexOf(venueA),venueY=html.indexOf(venueB,venueX);
if(venueX<0||venueY<0)throw Error('Existing venue ready marker not found');
html=html.slice(0,venueX)+venueA+'\n<script>\n'+venueSource+'\n</script>\n'+venueB+html.slice(venueY+venueB.length);
fs.writeFileSync(path.join(root,'scripts/card_venue_ready_client.js'),venueSource);
const resultA='<!-- CARD_RESULT_CUTINS_BEGIN -->',resultB='<!-- CARD_RESULT_CUTINS_END -->';
const resultSource=read('card-result-cutins.js').trimEnd();
const resultBlock=`${resultA}\n<script>\n${resultSource}\n</script>\n${resultB}`;
if(html.includes(resultA)){
  const x=html.indexOf(resultA),y=html.indexOf(resultB,x);
  if(y<0)throw Error('Incomplete result cut-ins marker');
  const current=html.slice(x+resultA.length,y).match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1];
  // Preserve existing line endings when this independent online module is equal.
  if(current?.replace(/\r\n/g,'\n').trim()!==resultSource.replace(/\r\n/g,'\n').trim())html=html.slice(0,x)+resultBlock+html.slice(y+resultB.length);
}else html=html.replace(a,resultBlock+'\n'+a);
const entryA='<!-- CARD_MATCH_ENTRY_BEGIN -->',entryB='<!-- CARD_MATCH_ENTRY_END -->';
const entrySource=fs.readFileSync(path.join(root,'scripts/card_match_entry_client.js'),'utf8');
const entryBlock=entryA+'\n<script>\n'+entrySource+'\n</script>\n'+entryB;
if(html.includes(entryA)){
  const x=html.indexOf(entryA),y=html.indexOf(entryB,x);if(y<0)throw Error('Incomplete match entry marker');
  html=html.slice(0,x)+entryBlock+html.slice(y+entryB.length);
}else html=html.replace('</body>',entryBlock+'\n</body>');
const statusA='<!-- CARD_STATUS_REVEAL_BEGIN -->',statusB='<!-- CARD_STATUS_REVEAL_END -->';
const statusBlock=statusA+'\n<script>\n'+read('card-status-reveal.js')+'\n</script>\n'+statusB;
if(html.includes(statusA)){
  const x=html.indexOf(statusA),y=html.indexOf(statusB,x);if(y<0)throw Error('Incomplete avatar status reveal marker');
  html=html.slice(0,x)+statusBlock+html.slice(y+statusB.length);
}else html=html.replace(entryA,statusBlock+'\n'+entryA);
for(const [name,marker] of [['card-pile-clarity','CARD_PILE_CLARITY'],['card-roger-prediction','CARD_ROGER_PREDICTION']]){
  const begin=`<!-- ${marker}_BEGIN -->`,end=`<!-- ${marker}_END -->`;
  const compat=`${begin}\n<style>\n${read(name+'.css')}\n</style>\n<script>\n${read(name+'.js')}\n</script>\n${end}`;
  if(html.includes(begin)){
    const x=html.indexOf(begin),y=html.indexOf(end,x);if(y<0)throw Error('Incomplete '+marker);
    html=html.slice(0,x)+compat+html.slice(y+end.length);
  }else html=html.replace(entryA,compat+'\n'+entryA);
}
// The two art stylesheets are unchanged. Keep their existing cache key and
// invalidate only the generated script that actually changed this release.
html=html.replace(/(css\/card-(?:desktop-table|native-online)\.css)\?v=[^"'\s]+/g,'$1?v=20261103-entry-startup3');
html=html.replace(/(js\/card-desktop-table\.js)\?v=[^"'\s]+/g,'$1?v=20261104-card-timing1');
fs.writeFileSync(file,html);console.log(JSON.stringify({file,bytes:Buffer.byteLength(html)}));
