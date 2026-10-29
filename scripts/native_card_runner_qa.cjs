'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const {validateNativeCardBundle,createNativeCardRunner}=require('../desktop/native-card-runner');
async function main(){
 const output=process.argv[2],root=path.join(output,'runner-validation-'+Date.now());await fs.mkdir(path.join(root,'project'),{recursive:true});
 let checks=0;const check=v=>{assert(v);checks++;};
 check(await validateNativeCardBundle(path.join(root,'absent'))===null);
 const contents={'runtime.exe':'not an executable','project/project.godot':'config_version=5\n','project/native-card.tscn':'[gd_scene format=3]\n'};
 for(const [file,body]of Object.entries(contents))await fs.writeFile(path.join(root,file),body);
 const data={schema:1,game:'card',releaseAllowed:false,executable:'runtime.exe',project:'project',files:Object.entries(contents).map(([file,body])=>({path:file,size:Buffer.byteLength(body),sha256:crypto.createHash('sha256').update(body).digest('hex')}))};
 const write=()=>fs.writeFile(path.join(root,'runtime.json'),JSON.stringify(data));await write();
 await assert.rejects(()=>validateNativeCardBundle(root));checks++;
 check(!!await validateNativeCardBundle(root,{allowInternal:true}));
 data.files.push({...data.files[0]});await write();await assert.rejects(()=>validateNativeCardBundle(root,{allowInternal:true}));checks++;data.files.pop();
 data.files[0].path='../escape.exe';await write();await assert.rejects(()=>validateNativeCardBundle(root,{allowInternal:true}));checks++;data.files[0].path='runtime.exe';
 await write();await fs.writeFile(path.join(root,'runtime.exe'),'changed');await assert.rejects(()=>validateNativeCardBundle(root,{allowInternal:true}));checks++;
 await fs.writeFile(path.join(root,'runtime.exe'),contents['runtime.exe']);
 const auth={getSecretForGame:()=> 'isolated-qa-secret',accountSummary:()=>({userId:7}),getPreferences:()=>({})};
 const runner=createNativeCardRunner({root,auth,assets:{},allowInternal:true});
 const launched=await runner.launch();check(launched.ok===false);runner.close();check(!runner.isRunning());
 await fs.writeFile(path.join(root,'project','unverified.js'),'throw new Error("unverified")');await assert.rejects(()=>validateNativeCardBundle(root,{allowInternal:true}));checks++;
 const result={passed:true,checks,inventoryValidation:true,failedProcessCleanup:true,windowsGameExportTested:false,published:false};await fs.writeFile(path.join(output,'desktop-runner.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
