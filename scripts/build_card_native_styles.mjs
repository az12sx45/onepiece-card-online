import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// This bounded delivery preserves the canonical art bytes without embedding
// every image into the stylesheet downloaded by an already styled native host.
const root=fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const args=process.argv.slice(2),check=args.includes('--check');
const mobile=args.find(arg=>arg!=='--check');
if(args.some(arg=>arg!==mobile&&arg!=='--check')||!mobile||!path.isAbsolute(mobile))throw Error('Usage: node scripts/build_card_native_styles.mjs <verified absolute mobile source root> [--check]');
const samePath=(a,b)=>path.resolve(a).toLowerCase()===path.resolve(b).toLowerCase();
const gitRoot=execFileSync('git',['-C',root,'rev-parse','--show-toplevel'],{encoding:'utf8'}).trim();
if(!samePath(fs.realpathSync(gitRoot),root)||!fs.existsSync(path.join(root,'public/game.html')))throw Error('Target must be this script\'s formal game Git root');
const sourceRoot=fs.realpathSync(mobile),web=fs.realpathSync(path.join(sourceRoot,'android/web'));
if(samePath(root,sourceRoot)||!samePath(web,path.join(sourceRoot,'android/web')))throw Error('Unexpected canonical source location');
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const sourcePins={
  'card-anime-skills.css':'aca74e658e9ed386dbe83fcdea64debe8bd92cae8daa24143ab765e172430ce8',
  'card-enhancement-summon.css':'ffd82aaa52ad9ea3c5c6f2bf516f3d37b872e7c5561393d245117ae126cd02be',
  'card-next-starter.css':'694077bfd84b9aa790b3083eca2add0f698213291502ccf3ffdbe939eb09ce6b',
  'card-private-enhance.css':'4caa79d442a6f73036c1bab6d16681b9c7691d89ff65bc4937ba9ce82b7d07d9',
  'card-hud-combat.css':'091395a273e8bb9306be93f0c5b747a6eadd30a21e1fd53ae12a4e84b6d1e2c4',
  'card-seat-hud.css':'6040dda3e8d5f533440d9729c026484c71ef0c47e3fda01592428c1af4c83319'
};
const sources=Object.entries(sourcePins).map(([name,expected])=>{
  const bytes=fs.readFileSync(path.join(web,name)),actual=sha(bytes);
  if(actual!==expected)throw Error(`Canonical source changed: ${name}; review and update its source pin before building`);
  return {name,bytes:bytes.length,sha256:actual,text:bytes.toString('utf8')};
});
const read=name=>sources.find(source=>source.name===name).text;
const sniper=read('card-hud-combat.css').split(/\r?\n/).filter(line=>/^html\[data-card-phone\] \.phone-sniper-(?:cutin|cut-strip|cut-art|cut-copy)(?:[ {])/.test(line)).join('\n');
if(sniper.split('\n').length!==7)throw Error('Expected the canonical sniper container, three child classes and three copy rules');
const compat='@media(max-height:500px) and (orientation:landscape){html:root[data-card-phone][data-card-seat-hud]{--seat-card-height:clamp(48px,20dvh,78px);}html:root[data-card-phone][data-card-fx][data-card-piles][data-card-stage][data-card-hand-dock][data-card-seat-hud]{--hand-card-h:clamp(150px,49dvh,215px);--pile-w:clamp(48px,16dvh,66px);}html[data-card-seat-hud] #cardActiveTurn{display:none!important;}}';
if(Buffer.byteLength(compat)!==397||sha(compat)!=='4c9b00813ad4b39fb11cd98e4823dd3c867beaad4794babb6f43c05e38f7e13c')throw Error('Low-height compatibility block changed');
for(const declaration of ['--seat-card-height:clamp(48px,20dvh,78px);','--hand-card-h:clamp(150px,49dvh,215px);--pile-w:clamp(48px,16dvh,66px);','html[data-card-seat-hud] #cardActiveTurn{display:none!important;}']){
  if(!read('card-seat-hud.css').includes(declaration))throw Error(`Missing canonical low-height declaration: ${declaration}`);
}
const parts=[
  ...['card-anime-skills.css','card-enhancement-summon.css','card-next-starter.css','card-private-enhance.css'].map(name=>({name,selection:'full',text:read(name)})),
  {name:'card-hud-combat.css',selection:'sniper cut-in container and children',text:sniper},
  {name:'card-seat-hud.css',selection:'397-byte retained low-height compatibility',text:compat}
];
const assetNames=new Set();
const rewrite=text=>text.replace(/url\(\s*(?:(["'])([^"']+)\1|([^\s)]+))\s*\)/g,(_match,_quote,quoted,unquoted)=>{
  const url=quoted??unquoted;
  if(!/^art\/[a-z0-9-]+\.webp$/.test(url))throw Error(`Unapproved canonical CSS URL: ${url}`);
  const name=url.slice(4);assetNames.add(name);
  return `url("/images/card-presentation/${name}")`;
});
// Only selector preludes gain specificity. Keep keyframes, declarations,
// comments and quoted URL/value text intact, including nested @media rules.
const nativeScope='[data-card-bundled-styles="1"]';
function scopeSelectors(text){
  const changes=[],stack=['rules'];let start=0,quote='',comment=false,parens=0;
  const clean=prelude=>prelude.replace(/\/\*[\s\S]*?\*\//g,'').trim();
  const scopePrelude=(from,to)=>{
    let q='',c=false;
    for(let i=from;i<to;i++){
      if(c){if(text[i]==='*'&&text[i+1]==='/'){c=false;i++;}continue;}
      if(q){if(text[i]==='\\'){i++;continue;}if(text[i]===q)q='';continue;}
      if(text[i]==='/'&&text[i+1]==='*'){c=true;i++;continue;}
      if(text[i]==='"'||text[i]==="'"){q=text[i];continue;}
      if(text.slice(i,i+4)==='html'&&!/[\w-]/.test(text[i-1]||'')&&!/[\w-]/.test(text[i+4]||''))changes.push(i+4);
    }
  };
  for(let i=0;i<text.length;i++){
    if(comment){if(text[i]==='*'&&text[i+1]==='/'){comment=false;i++;}continue;}
    if(quote){if(text[i]==='\\'){i++;continue;}if(text[i]===quote)quote='';continue;}
    if(text[i]==='/'&&text[i+1]==='*'){comment=true;i++;continue;}
    if(text[i]==='"'||text[i]==="'"){quote=text[i];continue;}
    if(text[i]==='('){parens++;continue;}if(text[i]===')'){parens--;continue;}if(parens)continue;
    if(text[i]==='{'){
      const prelude=clean(text.slice(start,i)),kind=stack.at(-1);
      if(kind==='rules'){
        if(/^@(?:-webkit-)?keyframes\b/i.test(prelude))stack.push('keyframes');
        else if(/^@(?:media|supports|layer|container)\b/i.test(prelude))stack.push('rules');
        else if(prelude.startsWith('@'))throw Error(`Unreviewed CSS at-rule: ${prelude}`);
        else {scopePrelude(start,i);stack.push('declarations');}
      }else if(kind==='keyframes')stack.push('declarations');
      else throw Error('Unexpected nested CSS declaration block');
      start=i+1;
    }else if(text[i]==='}'){
      if(stack.length===1)throw Error('Unbalanced canonical CSS');stack.pop();start=i+1;
    }else if(text[i]===';'&&stack.at(-1)==='rules')start=i+1;
  }
  if(stack.length!==1||quote||comment||parens)throw Error('Incomplete canonical CSS');
  let scoped=text;for(const at of changes.reverse())scoped=scoped.slice(0,at)+nativeScope+scoped.slice(at);
  return scoped;
}
// A successful HTTP stylesheet response must reach this final declaration.
// Native hosts already have older layout variables, and Chrome can expose an
// empty CSSStyleSheet after HTTP 503, so sheet presence alone is insufficient.
const sentinel=`html${nativeScope}{--card-native-style-ready:1;}`;
const css='/* CARD_NATIVE_ONLINE_STYLES: generated by scripts/build_card_native_styles.mjs; canonical art bytes are separate. */\n'+parts.map(part=>`\n/* ${part.name}: ${part.selection} */\n${scopeSelectors(rewrite(part.text)).trimEnd()}\n`).join('')+sentinel+'\n';
const expectedNames=[
  ...[0,...Array.from({length:18},(_,i)=>i+2)].map(id=>`card-anime-skill-${id}-v1.webp`),
  ...Array.from({length:20},(_,id)=>`card-summon-${id}-v1.webp`),
  'card-next-starter-v2.webp','card-usopp-anime-shout-v1.webp'
].sort();
if(JSON.stringify([...assetNames].sort())!==JSON.stringify(expectedNames))throw Error('Native stylesheet must reference exactly the reviewed 41 canonical WebP assets');
const artRoot=fs.realpathSync(path.join(web,'art'));
const assets=expectedNames.map(name=>{
  const source=fs.realpathSync(path.join(artRoot,name));
  if(!samePath(path.dirname(source),artRoot))throw Error(`Art source escaped canonical directory: ${name}`);
  const bytes=fs.readFileSync(source);
  if(bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WEBP')throw Error(`Not canonical WebP bytes: ${name}`);
  return {name,source,buffer:bytes,bytes:bytes.length,sha256:sha(bytes),file:`public/images/card-presentation/${name}`,url:`/images/card-presentation/${name}`};
});
const mediaBytes=assets.reduce((sum,asset)=>sum+asset.bytes,0);
if(mediaBytes!==11594668)throw Error(`Canonical asset inventory size changed: ${mediaBytes}`);
const cssFile='public/css/card-native-online.css',inventoryFile='docs/CARD_NATIVE_STYLES_20261103.json';
const inventory={
  format:'card-native-online-styles-v1',
  selectorScope:`html${nativeScope}`,
  generatedRules:[{position:'end',selector:`html${nativeScope}`,declaration:{property:'--card-native-style-ready',value:'1'},purpose:'Native boot requires a successfully loaded complete online stylesheet, beyond sheet presence.'}],
  sourceRoot,
  sourceFiles:sources.map(({name,bytes,sha256})=>({file:`android/web/${name}`,bytes,sha256})),
  selections:parts.map(({name,selection,text})=>({file:`android/web/${name}`,selection,bytes:Buffer.byteLength(text),sha256:sha(text)})),
  stylesheet:{file:cssFile,url:'/css/card-native-online.css',bytes:Buffer.byteLength(css),sha256:sha(css)},
  media:{count:assets.length,bytes:mediaBytes,files:assets.map(({name,bytes,sha256,file,url})=>({source:`android/web/art/${name}`,file,url,bytes,sha256}))},
  releaseWhitelist:{program:[cssFile],media:assets.map(asset=>asset.file)}
};
const writes=[{file:cssFile,buffer:Buffer.from(css)},...assets.map(({file,buffer})=>({file,buffer})),{file:inventoryFile,buffer:Buffer.from(JSON.stringify(inventory,null,2)+'\n')}];
let ownedPrevious=false;
try{
  const previous=JSON.parse(fs.readFileSync(path.join(root,inventoryFile),'utf8'));
  const previousCss=fs.readFileSync(path.join(root,cssFile));
  ownedPrevious=previous.format===inventory.format&&samePath(previous.sourceRoot,sourceRoot)&&previous.stylesheet.file===cssFile&&sha(previousCss)===previous.stylesheet.sha256&&previousCss.toString().startsWith('/* CARD_NATIVE_ONLINE_STYLES: generated by scripts/build_card_native_styles.mjs;')&&JSON.stringify(previous.media)===JSON.stringify(inventory.media)&&JSON.stringify(previous.releaseWhitelist)===JSON.stringify(inventory.releaseWhitelist);
}catch{}
// Validate every collision before creating anything. Existing raw images are
// reused only when byte-identical; unrelated or edited files are never replaced.
for(const item of writes){
  item.target=path.join(root,item.file);
  if(fs.existsSync(item.target)){
    if(!fs.lstatSync(item.target).isFile())throw Error(`Refusing to overwrite an unexpected existing file: ${item.file}`);
    if(!fs.readFileSync(item.target).equals(item.buffer)){
      if(!check&&ownedPrevious&&(item.file===cssFile||item.file===inventoryFile))item.update=true;
      else throw Error(`Refusing to overwrite an unexpected existing file: ${item.file}`);
    }
  }else if(check)throw Error(`Missing generated file: ${item.file}`);
}
for(const item of writes){
  if(check||fs.existsSync(item.target)&&!item.update)continue;
  fs.mkdirSync(path.dirname(item.target),{recursive:true});
  fs.writeFileSync(item.target,item.buffer,{flag:item.update?'w':'wx'});
}
for(const item of writes){
  if(!fs.readFileSync(item.target).equals(item.buffer))throw Error(`Output readback mismatch: ${item.file}`);
}
// Read the originals again so a concurrent source modification cannot be
// mistaken for a verified, stable copy operation.
for(const source of sources){
  if(sha(fs.readFileSync(path.join(web,source.name)))!==source.sha256)throw Error(`Canonical CSS changed during build: ${source.name}`);
}
for(const asset of assets){
  if(sha(fs.readFileSync(asset.source))!==asset.sha256)throw Error(`Canonical art changed during build: ${asset.name}`);
}
console.log(JSON.stringify({mode:check?'checked':'built',root,stylesheet:inventory.stylesheet,media:{count:assets.length,bytes:mediaBytes},inventory:inventoryFile}));
