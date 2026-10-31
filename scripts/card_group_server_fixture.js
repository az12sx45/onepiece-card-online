// Test-process-only instrumentation; no HTTP fixture route or production code hook.
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),readline=require('node:readline');
let seed=0x31ab;Math.random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296;};
const root=path.resolve(__dirname,'..'),filename=path.join(root,'server/index.js'),m=new Module(filename,module);m.filename=filename;m.paths=Module._nodeModulePaths(path.dirname(filename));
m._compile(fs.readFileSync(filename,'utf8')+'\nmodule.exports.__qa={rooms,broadcastState,runCpuLoop,armRoomWatchdogs,cardVenueReady,cardPresentationReady};',filename);
const q=m.exports.__qa,engine=require('../server/engine');
readline.createInterface({input:process.stdin}).on('line',line=>{try{
 const cmd=JSON.parse(line),room=q.rooms.get(cmd.room);if(!room)throw Error('Test room missing');
 if(['peek','cpu-final','game-final'].includes(cmd.scenario)){
  for(const key of ['_turnTimer','_pendingTimer','_turnWarnTimer','_pendingWarnTimer','_autoNextTimer']){clearTimeout(room[key]);room[key]=null;}
  room._cpuLoopToken=(room._cpuLoopToken||0)+1;room._cpuFastForward=false;
  const old=room.state,s=engine.createInitialState(old.players.length);s.roundNo=old.roundNo;s.venues=old.venues;s.turnStep='choose';const host=room.host,cpu=old.players.findIndex(p=>p.isCPU);s.turnIndex=cmd.scenario==='peek'?host:cpu;s.discard=[4,6];
  s.players.forEach((p,i)=>Object.assign(p,{client:old.players[i].client,displayName:old.players[i].displayName,isCPU:old.players[i].isCPU,alive:cmd.scenario==='peek'?!old.players[i].isCPU:[host,cpu].includes(i),hand:i===s.turnIndex?(cmd.scenario==='peek'?2:3):4,tempDraw:i===s.turnIndex?8:null}));
  if(cmd.scenario==='game-final')s.chestLeft=1;room.state=s;room.phase='playing';room._venueReady=null;q.cardPresentationReady.begin(room);q.broadcastState(room);q.runCpuLoop(cmd.room);q.armRoomWatchdogs(cmd.room);
 }else throw Error('Unknown isolated scenario');
 console.log('QA_FIXTURE '+JSON.stringify({scenario:cmd.scenario,round:room.state.roundNo}));
 }catch(e){console.log('QA_FIXTURE_ERROR '+e.message);}});
