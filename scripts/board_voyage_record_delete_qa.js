'use strict';
// All persistence and sockets use synthetic accounts in an isolated in-memory DB.
const fs=require('node:fs'), path=require('node:path'), assert=require('node:assert/strict'), crypto=require('node:crypto');
const {fork}=require('node:child_process');
const PORT=Number(process.env.BOARD_RECORD_DELETE_QA_PORT||41963), ORIGIN=`http://127.0.0.1:${PORT}`;
const OUT=process.env.BOARD_RECORD_DELETE_QA_OUT||'D:/Codex_QA/launcher-profile-r61/records';
const report={status:'RUNNING',scope:'Real production Socket.IO and two Chrome sessions; isolated PGlite fixtures only. No formal accounts or save records touched.',checks:[],errors:[],screenshots:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function check(label,ok){assert.ok(ok,label);report.checks.push(label);console.log('PASS '+label)}
const ack=(s,event,payload={})=>new Promise((resolve,reject)=>s.timeout(10000).emit(event,payload,(e,r)=>e?reject(e):resolve(r)));
const wait=(s,event)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(Error('timeout '+event)),10000);s.once(event,r=>{clearTimeout(t);resolve(r)})});
let child, rpcSerial=0;
function rpc(action){return new Promise((resolve,reject)=>{const id=++rpcSerial;const t=setTimeout(()=>reject(Error('fixture RPC timeout')),10000);function receive(m){if(m.id!==id)return;child.off('message',receive);clearTimeout(t);m.error?reject(Error(m.error)):resolve(m.result)}child.on('message',receive);child.send({id,action})})}
async function fixture(){
 const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');const db=new PGlite();
 await db.exec(`CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB DEFAULT '{}',titles JSONB DEFAULT '[]',bounties JSONB DEFAULT '[]',recent_matches JSONB DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT now());CREATE TABLE board_campaigns(campaign_id TEXT PRIMARY KEY,payload JSONB NOT NULL,updated_at BIGINT NOT NULL);`);
 for(const id of [1,2,3])await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar) VALUES($1,$2,$3,$4)',[id,`r61-record-owner-${id}`,`航海員${id}`,'7']);
 const records=require('../server/board-voyage-records');
 for(const [id,members,name] of [['V61SOLO',[1],'風車村的個人航海'],['V61SHARED',[1,2],'夥伴們的共同冒險'],['V61FOREIGN',[3],'另一帳號的航海'],['V61LEGACY',[1],'舊版航海紀錄']]){
  const crew=members.map((userId,seatIndex)=>({key:`user-${userId}`,userId,seatIndex,name:`航海員${userId}`,avatar:7}));
  const payload={gameState:{boardData:{islands:[{id:'loguetown',name:'羅格鎮',kind:'start',col:0,row:0}],routesBetweenIslands:[],routes:[]},players:crew.map(m=>({...m,id:m.userId,coins:987,crew:[],location:{kind:'island',islandId:'loguetown'},discoveredIslands:['loguetown']})),round:6,currentPlayerIndex:0,phase:'main',turnStep:'roll'}};
  const campaign=records.create({campaignId:id,members:crew,name,payload});if(id==='V61LEGACY'){campaign.schemaVersion=1;campaign.basePayload=campaign.payload;campaign.memberRecords={};delete campaign.payload;delete campaign.revision;}await db.query('INSERT INTO board_campaigns VALUES($1,$2,$3)',[id,campaign,campaign.updatedAt]);
 }
 let unavailable=false;const query=(...a)=>{if(unavailable&&String(a[0]).includes('board_campaign_preferences'))throw Error('fixture_persistence_unavailable');return db.query(...a)};const pool={query,async connect(){return{query:(...a)=>db.query(...a),release(){}}}};const file=require.resolve('../server/db');require.cache[file]={id:file,filename:file,loaded:true,exports:{pool}};
 process.env.DATABASE_URL='isolated-r61-pglite';process.env.PORT=String(PORT);process.env.OP_DESKTOP_ONLY='0';require('../server/index');
 process.on('message',async m=>{try{let result;if(m.action==='unavailable-on'){unavailable=true;result=true;}else if(m.action==='unavailable-off'){unavailable=false;result=true;}else if(m.action==='snapshot')result=(await db.query('SELECT payload FROM board_campaigns ORDER BY campaign_id')).rows;else if(m.action==='preferences')result=(await db.query('SELECT * FROM board_campaign_preferences ORDER BY user_id,campaign_id')).rows;else if(m.action==='bump-shared'){const row=(await db.query("SELECT payload FROM board_campaigns WHERE campaign_id='V61SHARED'")).rows[0];const next=records.save(row.payload,row.payload.payload,{saveKind:'auto'});await db.query("UPDATE board_campaigns SET payload=$1,updated_at=$2 WHERE campaign_id='V61SHARED'",[next,next.updatedAt]);result=next.revision;}else throw Error('unknown fixture action');process.send({id:m.id,result});}catch(e){process.send({id:m.id,error:e.message})}});
}
async function protocol(){
 const {io}=require('../public/vendor/socket.io-client/4.8.1/socket.io.min.js');const sockets=[];
 async function connect(id){const s=io(ORIGIN,{transports:['websocket'],forceNew:true});sockets.push(s);await wait(s,'connect');if(id)assert.equal((await ack(s,'SOCIAL_AUTH',{secret:`r61-record-owner-${id}`,deviceId:`r61-${id}`})).ok,true);return s;}
 const req=(id,action='remove',revision=1,visibility=0)=>({campaignId:id,action,expectedRevision:revision,expectedVisibilityRevision:visibility});
 const list=async s=>(await ack(s,'BOARD_CAMPAIGN_LIST')).campaigns;
 try{
  const a=await connect(1),otherTab=await connect(1),b=await connect(2),guest=await connect(0);
  const original=JSON.stringify(await rpc('snapshot'));
  check('old database migrates preferences table successfully',Array.isArray(await rpc('preferences')));
  check('original list contains personal and shared records only',(await list(a)).map(c=>c.campaignId).sort().join(',')==='V61LEGACY,V61SHARED,V61SOLO');
  check('unauthenticated identity cannot delete',(await ack(guest,'BOARD_CAMPAIGN_VISIBILITY',{...req('V61SOLO'),profile:{userId:1}})).error==='auth_required');
  check('forged profile cannot delete another account personal record',(await ack(b,'BOARD_CAMPAIGN_VISIBILITY',{...req('V61SOLO'),profile:{userId:1}})).error==='not_campaign_member');
  check('nonmember foreign record rejected',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61FOREIGN'))).error==='not_campaign_member');
  check('path-like ID rejected before access',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('../V61SOLO'))).error==='campaign_not_found');
  check('unknown action rejected',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','erase'))).error==='invalid_action');
  check('stale save revision rejected',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','remove',0))).error==='revision_conflict');
  check('legacy no-revision record can be removed',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61LEGACY','remove',0,0))).ok);
  check('legacy no-revision record can be restored',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61LEGACY','restore',0,1))).ok);
  await rpc('unavailable-on');check('database unavailable returns error instead of empty successful list',(await ack(a,'BOARD_CAMPAIGN_LIST')).error==='fixture_persistence_unavailable');check('database unavailable rejects mutation without filesystem fallback',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO'))).error==='fixture_persistence_unavailable');await rpc('unavailable-off');check('failed mutation did not create preference',(await rpc('preferences')).every(row=>row.campaign_id!=='V61SOLO'));
  const notice=wait(otherTab,'BOARD_CAMPAIGN_VISIBILITY_UPDATED');
  const removed=await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO'));check('solo removal succeeds with personal revision',removed.ok&&removed.removedAt>0&&removed.visibilityRevision===1);await notice;check('same-account second session notified',true);
  check('legacy clients no longer list recycled personal record',!(await list(a)).some(c=>c.campaignId==='V61SOLO'));
  const bin=(await ack(a,'BOARD_CAMPAIGN_LIST',{includeRemoved:true})).campaigns;check('recycle list retains full record metadata',bin.find(c=>c.campaignId==='V61SOLO')?.removedAt>0);
  check('recycled record cannot load directly',(await ack(a,'BOARD_CAMPAIGN_OPEN',{campaignId:'V61SOLO',mode:'solo'})).error==='campaign_removed');
  check('recycled record cannot bypass through copy',(await ack(a,'BOARD_CAMPAIGN_OPEN',{campaignId:'V61SOLO',mode:'copy'})).error==='campaign_removed');
  check('stale personal visibility revision rejected',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','restore',1,0))).error==='revision_conflict');
  check('restore succeeds',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','restore',1,1))).ok);
  const pair=await Promise.all([a,otherTab].map(s=>ack(s,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','remove',1,2))));check('simultaneous delete only applies once',pair.filter(r=>r.ok).length===1&&pair.some(r=>r.error==='revision_conflict'));
  await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','restore',1,3));
  check('shared record removed only for requesting member',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SHARED'))).ok&&!(await list(a)).some(c=>c.campaignId==='V61SHARED')&&(await list(b)).some(c=>c.campaignId==='V61SHARED'));
  check('remove and restore preserve campaign payload/revision/backups byte-equivalent',JSON.stringify(await rpc('snapshot'))===original);
  const revision=await rpc('bump-shared');check('another member autosave cannot revive personal removal',revision===2&&!(await list(a)).some(c=>c.campaignId==='V61SHARED'));
  check('other member sees latest autosaved revision',(await list(b)).find(c=>c.campaignId==='V61SHARED')?.revision===2);
  check('stale restore refresh required after autosave',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SHARED','restore',1,1))).error==='revision_conflict');
  check('fresh revision restores shared record',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SHARED','restore',2,1))).ok);
  const opened=await ack(a,'BOARD_CAMPAIGN_OPEN',{campaignId:'V61SOLO',mode:'solo',profile:{clientId:'r61-owner-active'}});check('restored personal record can open',opened.ok);
  check('active own session blocks removal',(await ack(otherTab,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','remove',1,4))).error==='campaign_in_use');
  await ack(a,'BOARD_LEAVE_ROOM',{roomCode:opened.roomCode});
  check('remove after leaving active session succeeds',(await ack(a,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','remove',1,4))).ok);
  const fresh=await connect(1);check('reconnected account reads persisted recycle state',!(await list(fresh)).some(c=>c.campaignId==='V61SOLO'));
  await ack(fresh,'BOARD_CAMPAIGN_VISIBILITY',req('V61SOLO','restore',1,5));
  const preferences=await rpc('preferences');check('only owner preferences exist; no foreign account mutation',preferences.length===3&&preferences.every(row=>Number(row.user_id)===1));
  const legacy=await ack(a,'BOARD_CAMPAIGN_OPEN',{campaignId:'V61LEGACY',mode:'solo',profile:{clientId:'r61-legacy'}});check('legacy migration uses new lock without deadlock',legacy.ok&&legacy.campaignId!=='V61LEGACY');await ack(a,'BOARD_LEAVE_ROOM',{roomCode:legacy.roomCode});
 }finally{sockets.forEach(s=>s.disconnect())}
}
async function browserQA(){
 const {chromium}=require(process.env.BOARD_QA_PLAYWRIGHT||'C:/Users/王曜瑋/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});const pages=[];
 try{
  for(const id of [1,2]){
   const context=await browser.newContext({viewport:{width:1440,height:1000}});
   await context.route(ORIGIN+'/**',async route=>{const p=new URL(route.request().url()).pathname;if(p.endsWith('.html')){const file=path.resolve(__dirname,'../public','.'+p);assert(file.startsWith(path.resolve(__dirname,'../public')+path.sep));return route.fulfill({contentType:'text/html',body:fs.readFileSync(file,'utf8').replaceAll('https://onepiece-card-online.onrender.com',ORIGIN)})}return route.continue()});
   await context.addInitScript(id=>{for(const key of ['opSecret','op_secret'])localStorage.setItem(key,`r61-record-owner-${id}`);for(const key of ['op_user_id','op_board_user_id'])localStorage.setItem(key,String(id));localStorage.setItem('op_board_client_id',`r61-record-browser-${id}`);localStorage.setItem('op_device_id',`r61-record-browser-${id}`)},id);
   const page=await context.newPage();pages.push(page);page.on('pageerror',e=>report.errors.push(e.stack||e.message));
   const cdp=await context.newCDPSession(page),target=await cdp.send('Target.getTargetInfo');await cdp.send('Browser.setPermission',{permission:{name:'loopback-network'},setting:'granted',origin:ORIGIN,browserContextId:target.targetInfo.browserContextId});
   await page.goto(ORIGIN+'/board_start.html?view=campaigns',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>['app','press'].includes(document.body.dataset.entryStage));if(await page.locator('#boardEntryStartBtn').isVisible())await page.locator('#boardEntryStartBtn').click();await page.waitForFunction(()=>document.body.dataset.entryStage==='app'&&window.BoardShared?.getState()?.socialReady);await page.waitForSelector('[data-campaign-id="V61SHARED"]');
  }
  const [a,b]=pages, shared='[data-campaign-id="V61SHARED"]',solo='[data-campaign-id="V61SOLO"]';
  await a.locator(shared+' [data-campaign-remove]').click();check('confirmation identifies shared record and individual impact',(await a.locator('#campaignRemoveName').textContent())==='夥伴們的共同冒險'&&(await a.locator('#campaignRemoveScope').textContent()).includes('同團玩家仍能繼續'));
  await a.screenshot({path:path.join(OUT,'shared-removal-dialog.png')});report.screenshots.push('shared-removal-dialog.png');
  await a.locator('#campaignRemoveCancel').click();check('cancel preserves record',await a.locator(shared).isVisible());
  await a.locator(shared+' [data-campaign-remove]').click();await a.keyboard.press('Escape');check('Escape cancels without removing',await a.locator(shared).isVisible()&&!(await a.locator('#campaignRemoveDialog').evaluate(e=>e.open)));
  await a.locator(shared+' [data-campaign-remove]').click();await a.locator('#campaignRemoveConfirm').click();await a.locator(shared).waitFor({state:'detached'});check('confirm removes record from current list',true);check('other account still sees shared record',await b.locator(shared).isVisible());
  await a.reload({waitUntil:'domcontentloaded'});await a.waitForSelector(solo);check('refresh keeps removed record absent',await a.locator(shared).count()===0);
  await a.locator('[data-campaign-view="removed"]').click();await a.waitForSelector(shared+' [data-campaign-restore]');check('recycle area shows restore but not load',await a.locator(shared+' [data-campaign-continue]').count()===0);
  const avatarResult=await a.evaluate(()=>new Promise(resolve=>window.BoardShared.getState().socket.emit('LAUNCHER_CARD_SET',{secret:'r61-record-owner-1',avatarId:8,displayName:'航海員1',tagline:'',crewContentRevision:1},resolve)));assert(avatarResult.ok);await a.waitForFunction(()=>document.querySelector('[data-campaign-id="V61SHARED"] .campaign-member-chip img')?.src.includes('/8.webp'));check('changing avatar while viewing recycle area retains record and refreshes portrait',await a.locator(shared+' [data-campaign-restore]').isVisible());
  await a.screenshot({path:path.join(OUT,'recycle-desktop.png')});report.screenshots.push('recycle-desktop.png');
  await a.locator(shared+' [data-campaign-restore]').click();await a.locator(shared).waitFor({state:'detached'});await a.locator('[data-campaign-view="active"]').click();await a.waitForSelector(shared);check('restored record returns to active list',true);
  await a.setViewportSize({width:540,height:800});await a.locator(solo+' [data-campaign-remove]').click();check('solo action and confirmation explain recoverable deletion',(await a.locator(solo+' [data-campaign-remove]').textContent())==='刪除紀錄'&&(await a.locator('#campaignRemoveScope').textContent()).includes('回收區恢復'));
  const bounds=await a.locator('#campaignRemoveDialog').boundingBox();check('narrow dialog fits viewport',bounds.x>=0&&bounds.x+bounds.width<=540);
  await a.screenshot({path:path.join(OUT,'solo-removal-narrow.png')});report.screenshots.push('solo-removal-narrow.png');await a.locator('#campaignRemoveCancel').click();
  await a.setViewportSize({width:1440,height:1000});
  await a.locator(shared+' [data-campaign-continue]').click();await a.waitForFunction(()=>document.querySelector('section[data-view="lobby"]')?.classList.contains('active'));
  const room=(await a.locator('#boardLobbyRoomCode').textContent()).trim();await b.locator(shared+' [data-campaign-continue]').click();await b.waitForFunction(expected=>document.querySelector('section[data-view="lobby"]')?.classList.contains('active')&&document.querySelector('#boardLobbyRoomCode')?.textContent.trim()===expected,room);
  check('restored shared record UI lets original members gather in same room',true);
  for(const page of [a,b])await page.evaluate(roomCode=>new Promise(resolve=>{const state=window.BoardShared.getState();state.socket.emit('BOARD_LEAVE_ROOM',{roomCode,profile:state.profile},resolve)}),room);
  await a.goto(ORIGIN+'/board_start.html?view=campaigns',{waitUntil:'domcontentloaded'});await a.waitForSelector(solo+' [data-campaign-continue]');await a.locator(solo+' [data-campaign-continue]').click();await a.waitForURL(/board_game\.html/,{timeout:30000});await a.waitForFunction(()=>window.__BOARD_GAME_DEBUG__?.getState()?.gameState?.round===6,null,{timeout:30000});
  check('restored personal record UI loads saved round into actual game',true);
  check('no browser runtime exceptions',report.errors.length===0);
 }catch(e){for(let i=0;i<pages.length;i++)await pages[i].screenshot({path:path.join(OUT,`failure-${i}.png`)}).catch(()=>{});throw e}finally{await browser.close()}
}
async function main(){fs.mkdirSync(OUT,{recursive:true});await new Promise((r,j)=>{const s=require('node:net').createServer();s.once('error',j);s.listen(PORT,'127.0.0.1',()=>s.close(r))});const log=[];child=fork(__filename,['--fixture'],{cwd:path.resolve(__dirname,'..'),windowsHide:true,stdio:['ignore','pipe','pipe','ipc']});child.stdout.on('data',d=>log.push(String(d)));child.stderr.on('data',d=>log.push(String(d)));
 try{let ready=false;for(let i=0;i<400;i++){try{if((await fetch(ORIGIN+'/health',{signal:AbortSignal.timeout(500)})).ok){ready=true;break}}catch{}await delay(100)}assert(ready,'fixture startup');await protocol();await browserQA();report.status='PASS';}catch(e){report.status='FAIL';report.failure=e.stack;report.serverLog=log.join('').slice(-12000)}finally{child.kill();report.sources=Object.fromEntries(['server/index.js','public/board_start.html','public/js/board_start.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.resolve(__dirname,'..',p))).digest('hex')]));fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify(report,null,2));}console.log(JSON.stringify({status:report.status,checks:report.checks.length,failure:report.failure,report:path.join(OUT,'report.json')}));process.exitCode=report.status==='PASS'?0:1;
}
if(process.argv.includes('--fixture'))fixture().catch(e=>{console.error(e);process.exit(1)});else main().catch(e=>{console.error(e);process.exit(1)});
