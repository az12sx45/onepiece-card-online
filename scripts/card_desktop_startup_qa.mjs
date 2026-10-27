import fs from 'node:fs';
import path from 'node:path';
import { spawn,spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const output='D:/Codex_QA/card-desktop-arena-20261027/startup';fs.mkdirSync(output,{recursive:true});
const port=30928,nodeDir=path.dirname(process.execPath);
const child=spawn('cmd.exe',['/d','/s','/c','npm.cmd start'],{cwd:root,windowsHide:true,env:{...process.env,PATH:nodeDir+';'+process.env.PATH,DATABASE_URL:'',PORT:String(port)},stdio:['ignore','pipe','pipe']});
let log='';child.stdout.on('data',chunk=>{log+=chunk});child.stderr.on('data',chunk=>{log+=chunk});
const report={scope:'npm start and local static entry routes with database disabled. Does not establish real account/gameplay acceptance.',databaseEnabled:false,pages:[],ok:false};
try {
  for(let i=0;i<80&&!log.includes('Server listening');i++) {
    if(child.exitCode!==null)throw Error('npm start exited '+child.exitCode);
    await new Promise(resolve=>setTimeout(resolve,150));
  }
  if(!log.includes('Server listening'))throw Error('Local server did not start');
  for(const file of ['board_start.html','board_game.html','board_battle.html','start.html','game.html','chess/index.html','chess/battle-game.html']) {
    const response=await fetch(`http://127.0.0.1:${port}/${file}`,{headers:{'User-Agent':'ONEPIECE_TABLETOP_ANDROID (Electron/44.1.1 compatibility)'}});
    const body=await response.text();report.pages.push({file,status:response.status,html:body.toLowerCase().includes('<html')});
  }
  report.ok=report.pages.every(x=>x.status===200&&x.html);
  report.npmStartObserved=log.includes('> node server/index.js')||log.includes('Server listening');
  report.databaseNotSetObserved=log.includes('DATABASE_URL not set');
} catch(error) {report.error=String(error);report.startupLog=log.slice(-4000);}
finally {
  const stop=spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});
  report.stoppedOwnedProcessTree=stop.status===0||child.exitCode!==null;
  fs.writeFileSync(path.join(output,process.env.TABLETOP_STARTUP_OUTPUT || 'v003-startup.json'),JSON.stringify(report,null,2)+'\n');
}
process.stdout.write(JSON.stringify(report)+'\n');if(!report.ok)process.exitCode=1;
