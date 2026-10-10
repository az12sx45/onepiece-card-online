import {readdir,readFile,stat,access} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const source='ios/GameAssets';
const bundle=process.argv[2];
if(!bundle)throw new Error('App bundle path required');
let reservedExists=false;
try {await access(join(bundle,'Resources')); reservedExists=true;} catch(error) {if(error.code!=='ENOENT')throw error;}
if(reservedExists)throw new Error('Reserved Resources directory must not exist in the iOS app root');
for(const file of ['launcher.html','launcher.css','launcher.js','bridge.js','modules.js','ios.css'])await access(join(bundle,'GameAssets','launcher',file));
let count=0,bytes=0;
const hash=data=>createHash('sha256').update(data).digest('hex');
const evidence=JSON.parse(await readFile(join(source,'build-evidence.json'),'utf8'));
if(evidence.assetMode!=='fully-bundled')throw new Error('Full bundled asset mode required');
const manifestFiles=['launcher-content.json',...['card','board','chess'].map(id=>`manifests/${id}.json`)];
let manifestAssets=0;
for(const name of manifestFiles){
  const manifest=JSON.parse(await readFile(join(source,name),'utf8'));
  for(const asset of manifest.assets??manifest.files){
    const info=await stat(join(bundle,'GameAssets','blobs',asset.sha256));
    if(info.size!==(asset.size??asset.bytes))throw new Error('Missing or incomplete bundled asset: '+asset.path);
    manifestAssets++;
  }
}
async function verify(relative=''){
  for(const name of await readdir(join(source,relative))){
    const path=join(relative,name),origin=join(source,path);
    if((await stat(origin)).isDirectory()){await verify(path);continue;}
    const expected=await readFile(origin),actual=await readFile(join(bundle,'GameAssets',path));
    if(hash(expected)!==hash(actual))throw new Error(`Bundled resource mismatch: ${path}`);
    if(relative==='blobs' && hash(actual)!==name)throw new Error('Blob hash does not match manifest identity: '+name);
    count++;bytes+=actual.length;
  }
}
await verify();
console.log(JSON.stringify({status:'PASS',assetMode:evidence.assetMode,manifestAssets,bundledFiles:count,bundledBytes:bytes,deviceAcceptance:'NOT_RUN'}));
