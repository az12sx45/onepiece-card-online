'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs/promises');
const {spawn}=require('node:child_process');
const crypto=require('node:crypto');
const {createNativeCardBridge}=require('../desktop/native-card-bridge');
async function main(){
 const [runtime,output]=process.argv.slice(2);let checks=0,secret='isolated-qa-secret',resolved=0;
 const check=(v)=>{assert(v);checks++;};
 const account={userId:7,name:'QA native bridge',username:'qa',avatar:'1'};
 const auth={getSecretForGame:()=>secret,accountSummary:()=>account,getGameBootstrap:()=>({op_device_id:'isolated-device'}),getPreferences:()=>({})};
 const mediaRoot=path.join(output,'desktop-media-qa');await fs.mkdir(mediaRoot,{recursive:true});
 const movie=await fs.readFile(path.resolve(runtime,'../../public/videos/enh/0.mp4'));
 const sha=crypto.createHash('sha256').update(movie).digest('hex'),filePath=path.join(mediaRoot,sha);
 await fs.writeFile(filePath,movie);
 const bridge=await createNativeCardBridge({auth,assets:{resolveAsset:async(game,name)=>{resolved++;check(game==='card');return name==='videos/enh/0.mp4'?{filePath,size:movie.length,sha256:sha}:null;}}});
 const env=bridge.childEnvironment;
 async function rpc(method,args={},headers={}){return fetch(env.PO_NATIVE_DESKTOP_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json','X-Po-Native':env.PO_NATIVE_DESKTOP_TOKEN,...headers},body:JSON.stringify({method,args})});}
 try{
  check((await rpc('getNativeState',{}, {'X-Po-Native':'wrong'})).status===403);
  check((await rpc('getNativeState',{}, {Origin:'https://example.com'})).status===403);
  check((await rpc('getNativeState',{}, {'Sec-Fetch-Site':'same-origin'})).status===403);
  check((await rpc('not-a-method')).status===400);
  check((await rpc('resolveCardAsset',{path:'audio/../../private.mp3'})).status===400);
  check((await rpc('resolveCardAsset',{path:'videos/enh/20.mp4'})).status===400);
  check((await rpc('resolveCardAsset',{path:'C:/account.json'})).status===400);
  check(resolved===0);
  const before=await(await rpc('getNativeState')).json();check(before.account.userId===7&&before.secret===secret);
  check(!(await(await rpc('saveSession',{secret:'replacement',account})).json()).ok);
  check(!(await(await rpc('saveSession',{secret,account:{userId:9}})).json()).ok);
  check((await(await rpc('saveSession',{secret,account})).json()).ok);
  let stdout='',stderr='';
  const executable=process.env.PO_QA_GODOT_EXE||'D:/Tools/Godot/4.7.2-stable/Godot_v4.7.2-stable_win64_console.exe';
  const project=process.env.PO_QA_NATIVE_PROJECT||runtime;
  const packed=!!process.env.PO_QA_PACKED_RUNTIME,log=path.resolve(output,'desktop-bridge-runtime.log');
  const args=packed?['--log-file',log]:['--path',project,'--script',path.resolve(runtime,'../tools/native-card-desktop-bridge-qa.gd')];
  const child=spawn(executable,args,{windowsHide:true,cwd:packed?path.dirname(executable):undefined,env:{...process.env,...env,PO_NATIVE_QA_MODE:'bridge'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
  const timer=setTimeout(()=>child.kill(),30000);
  const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});clearTimeout(timer);
  if(packed)stdout+='\n'+await fs.readFile(log,'utf8');
  if(code!==0||!stdout.includes('PO_NATIVE_DESKTOP_BRIDGE_PASS')||/SCRIPT ERROR|ERROR:/.test(stderr+stdout))throw Error('Native RPC/media failed: '+(stderr+stdout).slice(-1800));checks++;
  check(!stdout.includes(secret)&&!stderr.includes(secret));
  secret='another-session';check((await rpc('getNativeState')).status===409);
  bridge.close();await assert.rejects(()=>rpc('getNativeState'));checks++;
  const result={passed:true,checks,actualGodotRpc:true,originalMovieViaHashedCache:true,releaseTemplateTested:!!process.env.PO_QA_GODOT_EXE,liveAccountTested:false,launcherLaunchIntegrated:false,published:false};
  await fs.mkdir(output,{recursive:true});await fs.writeFile(path.join(output,'desktop-bridge.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
 }finally{bridge.close();}
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
