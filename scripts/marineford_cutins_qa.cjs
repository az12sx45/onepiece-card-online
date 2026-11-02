'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict'),express=require('express'),{Server}=require('socket.io'),{attach}=require('../server/marineford-rooms'),engine=require('../server/marineford-engine');
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MF_QA_DIR;fs.mkdirSync(out,{recursive:true});
(async()=>{const app=express(),server=http.createServer(app),io=new Server(server),runtime=attach(io,{cpuDelay:1000000}),checks=[],errors=[];let browser,p,room,seq=200;
app.use(express.static(root+'/public'));app.use('/images/board/avatars',express.static('D:/Codex_Release_Worktrees/launcher-flick-reward-r12/public/images/board/avatars'));
io.on('connection',s=>s.on('SOCIAL_AUTH',(_,cb)=>{s.data.socialProfile={userId:1,name:'海軍元帥測試船長',avatar:8};cb({ok:true,me:s.data.socialProfile});}));
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));browser=await(process.env.MF_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true}));
 const ctx=await browser.newContext({viewport:{width:740,height:320}});await ctx.addInitScript(()=>localStorage.setItem('opSecret','qa'));p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://127.0.0.1:'+server.address().port+'/marineford/index.html');
 for(const [width,height]of [[740,320],[1366,768]]){await p.setViewportSize({width,height});await p.getByRole('button',{name:'建立房間',exact:true}).waitFor();await p.waitForTimeout(250);assert(await p.locator('#lobbyBody').evaluate(e=>e.scrollHeight<=e.clientHeight+1),'Start controls must fit without scrolling');await p.screenshot({path:out+'/lobby-'+width+'.png'});}checks.push('New panoramic start page: desktop/mobile controls fit');
 await p.getByRole('button',{name:'建立房間',exact:true}).click();for(let i=0;i<5;i++)await p.getByRole('button',{name:'加入 CPU',exact:true}).click();await p.screenshot({path:out+'/room-six.png'});await p.getByRole('button',{name:'開始對局',exact:true}).click();await p.locator('#table:not([hidden])').waitFor();room=[...runtime.rooms.values()][0];const socket=[...io.sockets.sockets.values()][0];
 const recover=async(s,viewer=0)=>{room.state=s;socket.emit('MF_RECOVER',{sequence:++seq,view:engine.visible(s,viewer),you:viewer});await p.waitForTimeout(200);await p.locator('.execution-scaffold').evaluate(i=>i.decode());};


 const state=engine.create(room.seats,0);state.players[0].played=['navy-garp'];state.players[1].played=['pirate-1'];
 for(const [width,height]of [[640,320],[740,360],[1366,768]]){
  await p.setViewportSize({width,height});
  for(const [actor,card,event]of [[0,'navy-garp',{type:'target',player:0,target:1}],[1,'pirate-1',{type:'guess',player:1,targets:[0],digit:4}],[0,'justice-3',{type:'play',player:0,card:'justice-3'}]]){
   state.turn=actor;state.players[actor].played=[card];await recover(state,1);socket.emit('MF_PRESENT',{sequence:++seq,you:1,view:engine.visible(state,1),events:[event]});await p.waitForFunction(()=>document.querySelector('#effectLayer').dataset.phase==='hold'&&document.querySelector('.mf-cutin'));
   const info=await p.locator('.mf-cutin').evaluate(n=>{const r=n.getBoundingClientRect(),copy=n.querySelector('.mf-cutin-copy'),text=document.createRange();text.selectNodeContents(copy);return{r:r.toJSON(),copy:copy.getBoundingClientRect().toJSON(),text:text.getBoundingClientRect().toJSON(),card:n.dataset.card,loaded:n.querySelector('img').naturalWidth,background:getComputedStyle(n.parentNode).backgroundColor}});
   assert.equal(info.card,card);assert(info.loaded>0);assert.equal(info.background,'rgba(0, 0, 0, 0)');assert(info.r.height<height*.6);assert(info.text.left>=0&&info.text.right<=width&&info.text.top>=info.r.top&&info.text.bottom<=info.r.bottom,JSON.stringify(info));assert(await p.locator('#table').isVisible());
   await p.screenshot({path:out+'/'+card+'-'+width+'.png'});await p.waitForFunction(()=>!document.querySelector('#effectLayer').children.length,{},{timeout:25000});
  }checks.push(width+': public Navy, pirate and symbol-only Justice cut-ins fit; table retained; sequence settles');
 }
 state.players[0].played=['navy-garp'];await recover(state,1);socket.emit('MF_PRESENT',{sequence:++seq,you:1,view:engine.visible(state,1),events:[{type:'target',player:0,target:1}]});await p.waitForSelector('.mf-cutin');await recover(state,1);await p.waitForTimeout(1500);assert.equal(await p.locator('.mf-cutin').count(),0);checks.push('Recovery cancels active cut-in without stale reveal or ACK');
 assert.deepEqual(errors,[]);fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,checks,errors,scope:'Real isolated browser with synthetic presentation packets, desktop/mobile widths; no physical device claim'},null,2));console.log(JSON.stringify({passed:true,checks:checks.length}));
}catch(e){await p?.screenshot({path:out+'/failure.png'}).catch(()=>{});fs.writeFileSync(out+'/failure.json',JSON.stringify({error:e.stack,checks,errors},null,2));throw e;}finally{await browser?.close();runtime.close();io.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
