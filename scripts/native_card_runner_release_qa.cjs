'use strict';
// Uses a separately generated QA PCK and fixture account; never the player's account.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createNativeCardRunner}=require('../desktop/native-card-runner');
async function main(){
 const [rootArg,outArg]=process.argv.slice(2),root=path.resolve(rootArg),out=path.resolve(outArg);
 const provenance=JSON.parse(fs.readFileSync(root+'-provenance.json'));
 assert.equal(provenance.playerRelease,false);assert(provenance.addedQaResources.includes('qa/bridge.gd'));
 const files=[];function walk(dir,prefix=''){for(const d of fs.readdirSync(dir,{withFileTypes:true})){assert(!d.isSymbolicLink());const name=prefix+d.name;if(d.isDirectory())walk(path.join(dir,d.name),name+'/');else if(name!=='runtime.json'){const b=fs.readFileSync(path.join(root,name));files.push({path:name,size:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}
 walk(root);fs.writeFileSync(path.join(root,'runtime.json'),JSON.stringify({schema:1,game:'card',releaseAllowed:false,executable:'pirate-card.exe',pack:'pirate-card.pck',files}));
 const mediaDir=path.join(out,'desktop-media-qa');const file=fs.readdirSync(mediaDir).find(n=>/^[a-f0-9]{64}$/.test(n));assert(file);
 const filePath=path.join(mediaDir,file),size=fs.statSync(filePath).size;
 const auth={getSecretForGame:()=> 'isolated-qa-secret',accountSummary:()=>({userId:7,name:'QA native bridge'}),getGameBootstrap:()=>({op_device_id:'isolated-device'}),getPreferences:()=>({})};
 let exited;const exit=new Promise(r=>exited=r);process.env.PO_NATIVE_QA_MODE='bridge';
 const runner=createNativeCardRunner({root,auth,assets:{resolveAsset:async(g,n)=>g==='card'&&n==='videos/enh/0.mp4'?{filePath,size,sha256:file}:null},allowInternal:true,onExit:exited});
 try{
  const started=await runner.launch();assert(started.ok&&runner.isRunning());
  const duplicate=await runner.launch();assert(duplicate.alreadyRunning);
  let timer;await Promise.race([exit,new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('Native process did not exit')),45000))]).finally(()=>clearTimeout(timer));
  assert(!runner.isRunning());
  const log=path.join(process.env.APPDATA,'Godot/app_userdata/PIRATE ODYSSEY - Card Arena/logs/godot.log');
  const text=fs.readFileSync(log,'utf8');assert(text.includes('PO_NATIVE_DESKTOP_BRIDGE_PASS'));assert(!/SCRIPT ERROR|ERROR:/.test(text));
  assert((await runner.launch()).ok);runner.close();assert(!runner.isRunning());
  const report={passed:true,actualReleaseProcess:true,productionRunner:true,privateBridgeAndOriginalMovie:true,duplicateLaunchPrevented:true,exitAndRelaunch:true,explicitClose:true,qaPack:true,realAccountTested:false};
  fs.writeFileSync(path.join(out,'desktop-runner-release.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
 }finally{runner.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
