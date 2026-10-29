'use strict';
const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {createNativeCardBridge}=require('./native-card-bridge');

async function validateNativeCardBundle(root, {allowInternal=false}={}) {
  const descriptor=path.join(root,'runtime.json');
  let bytes;
  try {bytes=await fs.readFile(descriptor);}catch(e){if(e.code==='ENOENT')return null;throw e;}
  if(bytes.length>1024*1024)throw Error('Native runtime inventory too large');
  const data=JSON.parse(bytes);
  if(data.schema!==1||data.game!=='card'||(!data.releaseAllowed&&!allowInternal)||!Array.isArray(data.files)||data.files.length>5000)throw Error('Native runtime is not approved');
  const safe=name=>typeof name==='string'&&/^[a-zA-Z0-9_./ -]+$/.test(name)&&!path.isAbsolute(name)&&!name.split('/').some(p=>p==='..'||p==='.'||p==='')&&!name.includes('\\');
  const base=await fs.realpath(root),seen=new Set();
  for(const file of data.files){
    if(!safe(file.path)||seen.has(file.path.toLowerCase())||!Number.isSafeInteger(file.size)||file.size<0||!/^[a-f0-9]{64}$/.test(file.sha256))throw Error('Invalid native runtime file');
    seen.add(file.path.toLowerCase());const target=path.join(base,file.path),real=await fs.realpath(target);
    if(!real.toLowerCase().startsWith((base+path.sep).toLowerCase()))throw Error('Native runtime escapes bundle');
    const stat=await fs.lstat(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==file.size)throw Error('Native runtime changed');
    const handle=await fs.open(target,'r'),hash=crypto.createHash('sha256');
    try{for await(const block of handle.createReadStream())hash.update(block);}finally{await handle.close();}
    if(hash.digest('hex')!==file.sha256)throw Error('Native runtime verification failed');
  }
  if(!safe(data.executable)||!seen.has(data.executable.toLowerCase()))throw Error('Native executable not inventoried');
  if(data.pack){
    if(!safe(data.pack)||data.pack!==data.executable.replace(/\.exe$/i,'.pck')||!seen.has(data.pack.toLowerCase()))throw Error('Native pack not inventoried');
  }else if(!safe(data.project)||!seen.has((data.project+'/project.godot').toLowerCase())||!seen.has((data.project+'/native-card.tscn').toLowerCase()))throw Error('Native entry not inventoried');
  async function checkTree(directory,prefix='') {
    for(const item of await fs.readdir(directory,{withFileTypes:true})) {
      const relative=prefix+item.name;
      if(item.isSymbolicLink())throw Error('Native bundle links rejected');
      if(item.isDirectory())await checkTree(path.join(directory,item.name),relative+'/');
      else if(!item.isFile()||(relative!=='runtime.json'&&!seen.has(relative.toLowerCase())))throw Error('Unverified native bundle file');
    }
  }
  await checkTree(base);
  // The descriptor belongs to a trusted launcher installation, never a user-selected download.
  return {executable:path.join(base,data.executable),project:data.pack?null:path.join(base,data.project),pack:data.pack||null,root:base};
}
function createNativeCardRunner({root,auth,assets,onExit=()=>{},onSessionInvalid=()=>{},allowInternal=false}){
 let child=null,bridge=null,pending=null,generation=0;
 function close(){generation++;bridge?.close();bridge=null;if(child){const previous=child;child=null;previous.kill();}}
 async function launch(){
  if(child)return {ok:true,native:true,alreadyRunning:true};
  if(pending)return pending;
  const epoch=generation;
  pending=(async()=>{
   const bundle=await validateNativeCardBundle(root,{allowInternal});if(!bundle)return null;
   if(epoch!==generation)return {ok:false,error:'遊戲啟動已取消。'};
   const connection=await createNativeCardBridge({auth,assets,onSessionInvalid});
   if(epoch!==generation){connection.close();return {ok:false,error:'遊戲啟動已取消。'};}
   bridge=connection;
   const args=['--resolution','1440x900'];
   if(bundle.project)args.unshift('--path',bundle.project);
   if(auth.getPreferences().gameDisplayMode==='fullscreen')args.push('--fullscreen');
   if(bundle.project)args.push('res://native-card.tscn');
   const process=spawn(bundle.executable,args,{cwd:bundle.root,windowsHide:true,env:{...global.process.env,...connection.childEnvironment},stdio:'ignore'});child=process;
   const done=()=>{connection.close();if(bridge===connection)bridge=null;if(child===process){child=null;onExit();}};
   process.once('exit',done);process.once('error',done);
   await new Promise((resolve,reject)=>{process.once('spawn',resolve);process.once('error',reject);});
   return {ok:true,native:true};
  })().catch(()=>({ok:false,error:'原生爭霸戰啟動失敗，請修復遊戲後重試。'})).finally(()=>{pending=null;});
  return pending;
 }
 return {launch,close,isRunning:()=>!!child,isStarting:()=>!!pending};
}
module.exports={validateNativeCardBundle,createNativeCardRunner};
