'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),{spawnSync}=require('child_process');
const {validateNativeCardBundle}=require('../desktop/native-card-runner');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
(async()=>{
 const [base,inputsFile,nativeRoot,output]=process.argv.slice(2);if(!output||fs.existsSync(output))throw Error('A new output directory is required');
 await validateNativeCardBundle(base);
 const old=JSON.parse(fs.readFileSync(path.join(base,'runtime.json'))),inputs=JSON.parse(fs.readFileSync(inputsFile)).files;
 for(const f of inputs)if(hash(fs.readFileSync(f.sourceAbsolute))!==f.sha256)throw Error('Baseline resource changed: '+f.path);
 if(inputs.some(f=>f.path.startsWith('qa/')))throw Error('Player package cannot include QA boot');
 const changes=[];
 for(const name of ['native-card-entry.js','native_card_table.gd']){
  const item=inputs.find(f=>f.path===name);if(!item)throw Error('Missing resource');
  const sourceAbsolute=path.join(nativeRoot,'runtime-probe',name),sha256=hash(fs.readFileSync(sourceAbsolute));
  changes.push({path:name,before:item.sha256,after:sha256});Object.assign(item,{sourceAbsolute,sha256});
 }
 fs.mkdirSync(output,{recursive:true});const files=[];
 for(const record of old.files){if(record.path===old.pack)continue;const to=path.join(output,record.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.linkSync(path.join(base,record.path),to);files.push(record);}
 fs.writeFileSync(output+'-pack-inputs.json',JSON.stringify({files:inputs}));
 const r=spawnSync('D:/Tools/Godot/4.7.2-stable/Godot_v4.7.2-stable_win64_console.exe',['--headless','--script',path.join(nativeRoot,'tools/pack-native-product.gd'),'--',output+'-pack-inputs.json',path.join(output,old.pack)],{windowsHide:true,encoding:'utf8',timeout:120000});
 fs.writeFileSync(output+'-pack.log',(r.stdout||'')+(r.stderr||''));if(r.status!==0||!r.stdout.includes('PO_PRODUCT_PACK_BUILT'))throw Error('Packing failed');
 const pack=fs.readFileSync(path.join(output,old.pack));files.push({path:old.pack,size:pack.length,sha256:hash(pack)});
 const identity=hash(JSON.stringify(inputs.map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path))));
 fs.writeFileSync(path.join(output,'runtime.json'),JSON.stringify({...old,releaseAllowed:false,baseProductManifestSha256:old.productManifestSha256,productManifestSha256:identity,files},null,2));
 fs.writeFileSync(output+'-provenance.json',JSON.stringify({base,basePack:old.files.find(f=>f.path===old.pack),inputsFile,changes,derivedManifestSha256:identity,releaseAllowed:false},null,2));
 console.log(JSON.stringify({output,changed:changes,resources:inputs.length}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
