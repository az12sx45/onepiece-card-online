import {readdir,readFile,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
const source='ios/Resources';
const bundle=process.argv[2];
if(!bundle)throw new Error('App bundle path required');
let count=0,bytes=0;
const hash=data=>createHash('sha256').update(data).digest('hex');
async function verify(relative=''){
  for(const name of await readdir(join(source,relative))){
    const path=join(relative,name),origin=join(source,path);
    if((await stat(origin)).isDirectory()){await verify(path);continue;}
    const expected=await readFile(origin),actual=await readFile(join(bundle,'Resources',path));
    if(hash(expected)!==hash(actual))throw new Error(`Bundled resource mismatch: ${path}`);
    count++;bytes+=actual.length;
  }
}
await verify();
console.log(JSON.stringify({status:'PASS',bundledFiles:count,bundledBytes:bytes,deviceAcceptance:'NOT_RUN'}));
