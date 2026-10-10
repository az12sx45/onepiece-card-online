import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
const output = path.join(root, 'ios', 'Resources');
const { validateManifest } = require('../desktop/launcher-content-overlay.js');
const { RENDERER_FILES } = require('../desktop/launcher-content-overlay.js');
const contentBytes = fs.readFileSync(path.join(root, 'public/desktop/launcher-content-v1.json'));
const content = JSON.parse(contentBytes);
validateManifest(content, '1.2.23');
const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/desktop/catalog-v3.json')));
const modified = new Set(execFileSync('git',['diff','--name-only','HEAD'],{cwd:root,encoding:'utf8'}).trim().split(/\r?\n/));
function put(name, bytes) {
  if (name.includes('..') || path.isAbsolute(name)) throw new Error('unsafe resource path');
  const target = path.join(output, name);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, bytes);
}
function verified(bytes, hash, size) {
  if (bytes.length !== size || crypto.createHash('sha256').update(bytes).digest('hex') !== hash) throw new Error('resource integrity mismatch');
  return bytes;
}
async function exactBytes(local, record, launcher = false) {
  let bytes = fs.existsSync(local) ? fs.readFileSync(local) : Buffer.alloc(0);
  const size = record.bytes ?? record.size;
  try { return verified(bytes, record.sha256, size); } catch {}
  for (const text of /\.(js|css|html|json|txt|svg)$/i.test(record.path) ? [bytes.toString('utf8').replace(/\r\n/g,'\n'), bytes.toString('utf8').replace(/\r?\n/g,'\r\n')] : []) {
    try { return verified(Buffer.from(text),record.sha256,size); } catch {}
  }
  const base = launcher ? content.baseUrl : catalog.assetBlobBaseUrl + '/';
  const response = await fetch(base + (launcher ? '' : record.sha256.slice(0,2)+'/') + record.sha256,{signal:AbortSignal.timeout(120000)});
  if (!response.ok) throw new Error(`Missing verified blob: ${record.path}: ${response.status}`);
  return verified(Buffer.from(await response.arrayBuffer()), record.sha256, size);
}
const rendererNames = [...fs.readFileSync(path.join(root,'desktop/launcher.html'),'utf8').matchAll(/(?:href|src)="(launcher[^"/]+\.(?:js|css))"/g)].map(m => m[1]);
rendererNames.push('launcher.html');
for (const name of new Set(rendererNames)) {
  const record = content.files.find(f => f.path === name);
  if (!RENDERER_FILES.has(name)) throw new Error(`renderer not allowlisted: ${name}`);
  let bytes = fs.readFileSync(path.join(root,'desktop',name));
  // The signed content manifest is an overlay; unchanged baseline files come from the exact Git commit.
  if (record) bytes = await exactBytes(path.join(root,'desktop',name), record, true);
  if (name === 'launcher.html') {
    let html = bytes.toString('utf8').replace(/<meta http-equiv="Content-Security-Policy"[^>]+>/, '<meta http-equiv="Content-Security-Policy" content="default-src \'self\' opui:; img-src \'self\' opui: data:; media-src \'self\' opui:; style-src \'self\'; script-src \'self\'; connect-src https://onepiece-card-online.onrender.com wss://onepiece-card-online.onrender.com; font-src \'self\' opui: data:; object-src \'none\'; base-uri \'none\'; form-action \'none\'">');
    html = html.replace('<script src="launcher.js"', '<link rel="stylesheet" href="ios.css"><script src="socket.io.min.js"></script><script src="modules.js"></script><script src="bridge.js"></script><script src="launcher.js"');
    bytes = Buffer.from(html);
  }
  put(`launcher/${name}`, bytes);
}
put('launcher/bridge.js',fs.readFileSync(path.join(root,'ios/bridge.js')));
put('launcher/ios.css',`html{height:100%;}body{padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);} .window-titlebar{display:none!important;} @media(max-width:600px){.topnav{overflow-x:auto;flex-wrap:nowrap}.nav-button{flex-shrink:0}.launcher-app{min-width:0!important} .topbar{flex-wrap:wrap} .room-stage{max-width:100%} }`);
put('launcher/socket.io.min.js',fs.readFileSync(path.join(root,'public/vendor/socket.io-client/4.8.1/socket.io.min.js')));
const shim = `window.IOSModules={};(()=>{class Events{constructor(){this.events=new Map()}on(k,f){if(!this.events.has(k))this.events.set(k,new Set());this.events.get(k).add(f);return this}off(k,f){this.events.get(k)?.delete(f);return this}emit(k,...a){for(const f of this.events.get(k)||[])f(...a)}}const stub=new Proxy({}, {get:(_,key)=>()=>{throw new Error('Desktop filesystem call blocked: '+String(key))}});const modules={'node:events':{EventEmitter:Events},'node:crypto':{randomBytes:n=>{const bytes=crypto.getRandomValues(new Uint8Array(n));return {toString:()=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('')}}},'node:fs':stub,'node:fs/promises':stub,'node:path':{join:(...p)=>p.join('/')},'socket.io-client':{io:window.io},electron:{app:{isPackaged:true},safeStorage:{isEncryptionAvailable:()=>false}}};const require=name=>{if(!modules[name])throw new Error('Unmapped desktop import: '+name);return modules[name]};`;
let modules = shim;
for (const [key,file] of [['auth','auth-service.js'],['social','social-service.js']]) {
  modules += `window.IOSModules.${key}=(()=>{const module={exports:{}};${fs.readFileSync(path.join(root,'desktop',file),'utf8')}\nreturn module.exports})();\n`;
}
modules += '})();';
put('launcher/modules.js', modules);
put('launcher-content.json',contentBytes);
put('catalog.json',JSON.stringify(catalog));
let launcherBaselineFiles=0;
async function bundleLauncherDirectory(relative){
  const directory=path.join(root,'public',relative);
  if(!fs.existsSync(directory))return;
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    const item=relative+'/'+entry.name;
    if(entry.isDirectory()){await bundleLauncherDirectory(item);continue;}
    if(!entry.isFile())throw new Error('Unsupported launcher asset: '+item);
    const record=content.files.find(f=>f.path===item);
    const sourceBytes=modified.has('public/'+item)?execFileSync('git',['show','HEAD:public/'+item],{cwd:root,maxBuffer:128*1024*1024}):fs.readFileSync(path.join(root,'public',item));
    put('launcher/'+item,record?verified(sourceBytes,record.sha256,record.bytes):sourceBytes);
    launcherBaselineFiles++;
  }
}
for(const directory of ['images/game_launcher','images/desktop_launcher','images/profile_decor','images/launcher_room','images/avatars','images/ranks','audio/profile_bgm','audio/launcher_room','audio/bgm','videos/game_launcher'])await bundleLauncherDirectory(directory);
let bundled = 0;
const blobs = new Map();
for (const file of content.files) blobs.set(file.sha256,{file,launcher:true,local:path.join(root,RENDERER_FILES.has(file.path)?'desktop':'public',file.path)});
for (const [id,game] of Object.entries(catalog.games)) {
  const bytes = fs.readFileSync(path.join(root,'public',game.manifestPath));
  if (crypto.createHash('sha256').update(bytes).digest('hex') !== game.manifestSha256) throw new Error('manifest hash mismatch');
  const manifest = JSON.parse(bytes);
  if (manifest.gameId !== id || manifest.releaseId !== game.releaseId) throw new Error('manifest identity mismatch');
  put(`manifests/${id}.json`,bytes);
  for (const file of manifest.assets) {
    if (!['image','audio','video','font'].includes(file.kind)) bundled++;
    if(!blobs.has(file.sha256)) blobs.set(file.sha256,{file,launcher:false,local:path.join(root,'public',file.path)});
  }
}
const tasks=[...blobs.values()];let next=0,completed=0,totalBytes=0;
await Promise.all(Array.from({length:8},async()=>{
  while(next<tasks.length){
    const {file,launcher,local}=tasks[next++];let bytes;
    for(let attempt=0;attempt<3;attempt++){
      try{bytes=await exactBytes(local,file,launcher);break;}catch(error){if(attempt===2)throw error;}
    }
    put(`blobs/${file.sha256}`,bytes);totalBytes+=bytes.length;completed++;
    if(completed%500===0)console.log(JSON.stringify({bundledAssets:completed,total:tasks.length}));
  }
}));
put('build-evidence.json',JSON.stringify({sourceCommit:process.env.IOS_SOURCE_COMMIT||null,launcherVersion:'1.2.23',contentRevision:content.revision,bundledProgramFiles:bundled,launcherBaselineFiles,bundledUniqueAssets:completed,bundledAssetBytes:totalBytes,assetMode:'fully-bundled',deviceTests:'NOT_RUN',fullFeatureAcceptance:'NOT_RUN'},null,2));
console.log(JSON.stringify({contentRevision:content.revision,bundledProgramFiles:bundled,output}));
