'use strict';
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('node:assert/strict'),express=require('express'),{Server}=require('socket.io'),engine=require('../server/marineford-engine');
const {chromium,webkit}=require('C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.MF_QA_DIR;fs.mkdirSync(out,{recursive:true});
const app=express(),server=http.createServer(app),io=new Server(server),sockets=new Map(),acks=new Map(),checks=[],errors=[];
app.use((req,res,next)=>{res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data: blob: poasset:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self' ws: wss:; media-src 'self' data: blob:");next();});
app.use(express.static(root+'/public'));if(process.env.MF_MEDIA_ROOT)app.use(express.static(process.env.MF_MEDIA_ROOT));app.use(express.static('D:/Codex_Release_Worktrees/card-native-server-adapter-20261029/public'));
app.use('/images/board/avatars',express.static('D:/Codex_Release_Worktrees/board-voyage-records-v1/public/images/board/avatars'));
const seats=Array.from({length:6},(_,i)=>({userId:i+1,name:i?'海賊隊員'+i:'海軍元帥',avatar:i+8,ready:true}));
io.on('connection',socket=>{
 socket.on('SOCIAL_AUTH',({secret},cb)=>{const id=Number(secret);sockets.set(id,socket);cb({ok:true,me:seats[id]});});
 socket.on('MF_PROFILE',(_,cb)=>cb({ok:true,stats:{collection:null},pending:false}));
 socket.on('MF_RULES',(_,cb)=>cb({ok:true,ruleset:'20261106-kizaru-one'}));
 socket.on('MF_ACK',({sequence},cb)=>{acks.set([...sockets].find(([,s])=>s===socket)[0],sequence);cb?.({ok:true});});
});

(async()=>{
 
 let browser;
 try{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await(process.env.MF_BROWSER==='webkit'?webkit.launch():chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'}));
  for(const [index,route] of ['rescue','execution','justice'].entries()){
   const id=index===0?1:0, viewport=index===0?{width:1366,height:768}:index===1?{width:568,height:320}:{width:390,height:844};
   const ctx=await browser.newContext({viewport,reducedMotion:index===0?'reduce':'no-preference'});
   await ctx.addInitScript(id=>localStorage.setItem('opSecret',String(id)),id);
   const page=await ctx.newPage();
   page.on('pageerror',error=>errors.push(error.message));
   await page.goto('http://127.0.0.1:'+server.address().port+'/marineford/index.html');
   await page.locator('#connection').getByText('已連線',{exact:true}).waitFor();
   const socket=sockets.get(id), state=engine.create(seats,0);
   acks.delete(id);
   socket.emit('MF_LOBBY',{code:'QA77',host:0,seats,you:id});
   socket.emit('MF_RECOVER',{sequence:10,view:engine.visible(state,id),you:id});
   await page.locator('.execution-scaffold').waitFor();
   state.winner=route==='rescue'?'pirate':'navy';
   state.phase='ended';
   if(route==='execution')state.hp.pirate=0;
   if(route==='rescue')state.hp.navy=0;
   const justice=route==='justice'?Array.from({length:6},(_,i)=>'justice-'+(i+1)):[];
   socket.emit('MF_PRESENT',{sequence:11,you:id,view:engine.visible(state,id),events:[{type:'victory',team:state.winner,justice}]});
   const stage=page.locator('.mf-finale[data-route="'+route+'"]');
   await stage.waitFor();
   await stage.locator('.mf-finale-art').first().evaluate(img=>img.decode());
   if(route==='execution'){
    await page.locator('.mf-finale[data-phase=raise] .mf-finale-ending[src*=finale-execution-v1]').waitFor();
    await page.locator('.mf-finale[data-phase=swing] .mf-finale-ending[src*=finale-execution-swing-v1]').waitFor();
   }
   if(justice.length)assert.equal(await stage.locator('.mf-finale-justice .card-face').count().then(async count=>{if(!count)await stage.locator('.mf-finale-justice .card-face').first().waitFor();return stage.locator('.mf-finale-justice .card-face').count();}),6);
   const result=page.locator('#sheet[data-kind="campaign-result"]');
   await result.waitFor();
   await result.locator('.mf-result-art').evaluate(img=>img.decode());
   if(route!=='justice')assert.match(await result.locator('.mf-result-art').getAttribute('src'),new RegExp('finale-'+route+'-v1'));
   assert.equal(await result.locator('.campaign-banner h3').textContent(),['艾斯獲救','處刑執行','正義集結'][index]);
   assert.equal(await result.locator('.campaign-player').count(),6);
   const body=result.locator('#sheetBody');
   assert(await body.evaluate(el=>el.scrollWidth<=el.clientWidth+1),'No result horizontal overflow');
   await result.getByText('本場獲得 30 枚戰役勳章').waitFor();
   await result.locator('.campaign-player .avatar').evaluateAll(images=>Promise.all(images.map(img=>img.decode())));
   await result.screenshot({path:out+'/'+route+'.png'});
   await result.getByRole('button',{name:'回到牌桌'}).click();
   await page.getByRole('button',{name:'查看戰果'}).click();
   await result.waitFor();
   assert.equal(await page.locator('.mf-finale').count(),0,'Opening result does not replay');
   assert.equal(acks.get(id),11);
   checks.push({route,viewport});
   await ctx.close();
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(out+'/report.json',JSON.stringify({passed:true,checks,errors,sourceHashes:Object.fromEntries(['public/marineford/marineford.js','public/marineford/marineford.css'].map(file=>[file,require('node:crypto').createHash('sha256').update(fs.readFileSync(file)).digest('hex')]))},null,2));
  console.log(JSON.stringify({passed:true,checks}));
 }finally{await browser?.close();io.close();server.close();}
})();
