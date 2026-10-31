const assert=require('node:assert/strict'),fs=require('node:fs'),{harness}=require('./card_all_effect_flow_qa'),gate=require('../server/card_presentation_ready');
let checks=0;const check=(name,fn)=>{try{fn();checks++;}catch(e){throw Error(name+': '+e.message);}};
(async()=>{
 const h=harness({roundNo:1,turnIndex:0},0);await h.advance(1);
 const snapshots=[{roundNo:1,turnIndex:0,turnStep:'choose'},{roundNo:1,turnIndex:1,turnStep:'draw'},{roundNo:2,turnIndex:1,turnStep:'draw'}];
 for(const [i,s]of snapshots.entries()){h.deliver('EMIT',{to:'all',type:'log',text:'action '+i});h.deliver('STATE',s);}
 await h.advance(500);check('three complete transactions queue behind first animation',()=>{assert.equal(h.api.presentationQueueSize(),3);assert.equal(h.committed.length,0);});
 for(let i=0;i<3;i++){
  h.releaseIntro();await h.advance(200);check('pile waits with later turns still queued '+i,()=>assert.equal(h.committed.filter(x=>x[0]==='STATE').length,i));
  h.releasePile();await h.advance(200);check('result narration waits before next turn '+i,()=>assert.equal(h.committed.filter(x=>x[0]==='STATE').length,i));
  h.fx(false);await h.advance(200);check('only current transaction commits '+i,()=>{assert.equal(h.committed.filter(x=>x[0]==='STATE').length,i+1);assert.deepEqual(h.ctx.state,snapshots[i]);});
 }
 check('queue drains without overlap',()=>assert.equal(h.api.presentationQueueSize(),0));
 const stop=harness({roundNo:1},0);await stop.advance(1);for(const i of [1,2]){stop.deliver('EMIT',{to:'all',type:'log',text:'stale '+i});stop.deliver('STATE',{roundNo:i});}await stop.advance(200);stop.deliver('disconnect');stop.releaseIntro();await stop.advance(200);check('disconnect cancels active and queued transactions',()=>{assert.equal(stop.api.presentationQueueSize(),0);assert.equal(stop.committed.length,0);});
 const room={state:{roundNo:7,players:[{id:0,isCPU:false,alive:false},{id:1,isCPU:false,alive:true},{id:2,isCPU:true,alive:true}]}};
 let g=gate.begin(room);check('eliminated humans still finish viewing',()=>assert.deepEqual(g.required,[0,1]));gate.acknowledge(room,1,g);check('eliminated slow reader blocks auto next',()=>assert.equal(gate.waiting(room),true));gate.acknowledge(room,0,g);check('all viewers release',()=>assert.equal(gate.waiting(room),false));const old=g;g=gate.begin(room);check('old action acknowledgement cannot release new action',()=>assert.equal(gate.acknowledge(room,0,old),false));room._cpuFastForward=true;gate.begin(room);check('explicit CPU fast-forward does not deadlock',()=>assert.equal(gate.waiting(room),false));
 const result={passed:true,checks,scope:'Real local flow module: consecutive actions, turn and round order, disconnect reset; room barrier includes eliminated viewers and rejects stale acknowledgements.'};if(process.env.CARD_QA_REPORT)fs.writeFileSync(process.env.CARD_QA_REPORT,JSON.stringify(result,null,2));console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
