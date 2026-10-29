'use strict';
const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {validateNativeCardBundle}=require('../desktop/native-card-runner');
async function main(){
 const [runtimeArg,stageArg,toolsArg,outputArg,releaseVersion]=process.argv.slice(2);
 if(!outputArg)throw Error('Expected runtime, isolated application directory, tools directory, new build output');
 const runtime=path.resolve(runtimeArg),stage=path.resolve(stageArg),toolchain=path.resolve(toolsArg),out=path.resolve(outputArg);
 if(fs.existsSync(out))throw Error('Build output already exists');
 if(releaseVersion&&!/^\d+\.\d+\.\d+$/.test(releaseVersion))throw Error('Invalid release version');
 if(!await validateNativeCardBundle(runtime,{allowInternal:!releaseVersion}))throw Error('Native runtime descriptor missing');
 const source=path.resolve(__dirname,'../desktop'),pkg=JSON.parse(fs.readFileSync(path.join(source,'package.json')));
 // Stage exact formal launcher files; QA boot/instrumentation is not in this inventory.
 fs.mkdirSync(stage,{recursive:true});
 for(const name of pkg.build.files){
  const from=path.join(source,name),to=path.join(stage,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);
 }
 for(const name of new Set(Object.values(pkg.build.nsis||{}).filter(x=>typeof x==='string'&&x.startsWith('assets/')))){
  const to=path.join(stage,name);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(path.join(source,name),to);
 }
 const config={...pkg.build,productName:releaseVersion?pkg.build.productName:'ONE PIECE TABLETOP SERIES 原生測試版',
  appId:releaseVersion?pkg.build.appId:'com.onepiece.tabletop.nativecard.internal',directories:{output:out},
  nsis:releaseVersion?pkg.build.nsis:{...pkg.build.nsis,shortcutName:'ONE PIECE TABLETOP SERIES 原生測試版'},
  electronDist:path.join(toolchain,'node_modules/electron/dist'),
  extraMetadata:releaseVersion?{version:releaseVersion}:{version:'1.2.25',nativeCardChannel:'internal'},
  extraResources:[...pkg.build.extraResources.map(x=>({...x,from:path.resolve(source,x.from)})),{from:runtime,to:'native-card',filter:['**/*','.godot/**/*']}],
  win:{...pkg.build.win,signAndEditExecutable:true,signExecutable:false}};
 const file=out+'-config.json';fs.writeFileSync(file,JSON.stringify(config,null,2));
 const result=spawnSync(process.execPath,[path.join(toolchain,'node_modules/electron-builder/out/cli/cli.js'),'--projectDir',stage,'--config',file,'--dir','--win','--x64','--publish','never'],
  {windowsHide:true,stdio:'inherit',env:{...process.env,ELECTRON_BUILDER_CACHE:'D:/Codex_BuildCache/electron-builder',CSC_IDENTITY_AUTO_DISCOVERY:'false'}});
 if(result.status!==0)throw Error('Launcher build failed');
 console.log(JSON.stringify({internal:!releaseVersion,output:out,publicRelease:false,playerProfileIsolated:!releaseVersion,version:releaseVersion||'1.2.25'}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
