'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync,execFileSync}=require('node:child_process');
async function main(){
 const [stageArg,toolsArg,outputArg,releaseVersion,assetRootArg]=process.argv.slice(2);
 if(!outputArg)throw Error('Expected isolated application directory, tools directory, new build output, release version');
 const stage=path.resolve(stageArg),toolchain=path.resolve(toolsArg),out=path.resolve(outputArg);
 if(fs.existsSync(out))throw Error('Build output already exists');
 if(releaseVersion&&!/^\d+\.\d+\.\d+$/.test(releaseVersion))throw Error('Invalid release version');
 if(!releaseVersion)throw Error('Release version required');
 const source=path.resolve(__dirname,'../desktop'),pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json')));
 const copiedDependencies=new Set();
 function stageDependency(name){
  if(copiedDependencies.has(name))return;copiedDependencies.add(name);
  const from=path.join(toolchain,'node_modules',name),to=path.join(stage,'node_modules',name);
  const dependency=JSON.parse(fs.readFileSync(path.join(from,'package.json')));
  fs.mkdirSync(path.dirname(to),{recursive:true});fs.cpSync(from,to,{recursive:true});
  for(const child of Object.keys(dependency.dependencies||{}))stageDependency(child);
 }
 for(const dependency of Object.keys(pkg.dependencies||{}))stageDependency(dependency);
 // Stage exact formal launcher files; QA boot/instrumentation is not in this inventory.
 fs.mkdirSync(stage,{recursive:true});
 for(const name of pkg.build.files){
  const from=path.join(source,name),to=path.join(stage,name);fs.mkdirSync(path.dirname(to),{recursive:true});
  if(fs.existsSync(from))fs.copyFileSync(from,to);
  else fs.writeFileSync(to,execFileSync('git',['show','HEAD:desktop/'+name],{cwd:source,windowsHide:true,maxBuffer:16*1024*1024}));
 }
 for(const name of new Set(Object.values(pkg.build.nsis||{}).filter(x=>typeof x==='string'&&x.startsWith('assets/')))){
  const to=path.join(stage,name),from=path.join(source,name);fs.mkdirSync(path.dirname(to),{recursive:true});
  if(fs.existsSync(from))fs.copyFileSync(from,to);
  else fs.writeFileSync(to,execFileSync('git',['show','HEAD:desktop/'+name],{cwd:source,windowsHide:true,maxBuffer:16*1024*1024}));
 }
 const config={...pkg.build,productName:releaseVersion?pkg.build.productName:'ONE PIECE TABLETOP SERIES 原生測試版',
  appId:releaseVersion?pkg.build.appId:'com.onepiece.tabletop.nativecard.internal',directories:{output:out},
  nsis:releaseVersion?pkg.build.nsis:{...pkg.build.nsis,shortcutName:'ONE PIECE TABLETOP SERIES 原生測試版'},
  electronDist:path.join(toolchain,'node_modules/electron/dist'),
  extraMetadata:releaseVersion?{version:releaseVersion}:{version:'1.2.25',nativeCardChannel:'internal'},
  extraResources:[...pkg.build.extraResources.map(x=>({...x,from:path.resolve(assetRootArg?path.join(path.resolve(assetRootArg),'desktop'):source,x.from)})),
   {from:path.resolve(source,'../public/images/game_launcher/launcher_marineford_cover_v1.webp'),to:'launcher-assets/images/game_launcher/launcher_marineford_cover_v1.webp'}],
  win:{...pkg.build.win,signAndEditExecutable:true,signExecutable:false}};
 const file=out+'-config.json';fs.writeFileSync(file,JSON.stringify(config,null,2));
 const result=spawnSync(process.execPath,[path.join(toolchain,'node_modules/electron-builder/out/cli/cli.js'),'--projectDir',stage,'--config',file,'--dir','--win','--x64','--publish','never'],
  {windowsHide:true,stdio:'inherit',env:{...process.env,ELECTRON_BUILDER_CACHE:'D:/Codex_BuildCache/electron-builder',CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
 if(result.status!==0)throw Error('Launcher build failed');
 console.log(JSON.stringify({internal:!releaseVersion,output:out,publicRelease:false,playerProfileIsolated:!releaseVersion,version:releaseVersion||'1.2.25'}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
