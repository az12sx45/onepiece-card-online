'use strict';
// Isolated in-memory SQL and actual Socket.IO-handler-body tests. No live accounts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { createLauncherAnnouncements, validateConfig } = require('../server/launcher-announcements');
const shipping = require('../config/launcher-announcements-v1.json');
const root = path.resolve(__dirname, '..');
const sourcePaths = ['config/launcher-announcements-v1.json','config/launcher-crew-release-v1.json',
  'server/launcher-announcements.js','server/launcher-crew-release.js','server/launcher-profile-shop.js',
  'server/index.js','server/desktop-distribution.js','desktop/launcher-update-service.js','scripts/launcher_announcements_server_qa.js'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const sourceHashes = normalize => Object.fromEntries(sourcePaths.map(file => [file, hash(normalize ?
  Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')) : fs.readFileSync(path.join(root,file)))]));
const beforeHashes = sourceHashes(false);
const checks = [], check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push({name,status:'PASS'}); };
const rejects = (name, config) => { assert.throws(() => validateConfig(config), /Invalid launcher announcement/); checks.push({name,status:'PASS'}); };
const clone = value => JSON.parse(JSON.stringify(value));
const cap = { crewContentRevision: 1 }, gameA = 'package-1234567890abcdef', gameB = 'package-fedcba0987654321';
const db = new PGlite(), pool = { query:(...args) => db.query(...args) };
let currentLauncher = '1.2.5', currentGame = gameA, verifierFails = false;
const calls = [];
const verifyRelease = async kind => {
  calls.push(kind); if (verifierFails) throw new Error('fixture verifier unavailable');
  return kind === 'launcher' ? {ok:true,kind,version:currentLauncher} : {ok:true,kind,releaseId:currentGame,manifestSha256:'a'.repeat(64)};
};
const fixedNow = new Date('2026-09-27T23:00:00.000Z');
const service = config => createLauncherAnnouncements({config,verifyRelease,now:()=>fixedNow});
const get = (api, secret='a', query={}, capability=cap) => api.get(pool,secret,query,capability);
const ids = response => response.announcements.map(item=>item.id).sort();
const readRows = async () => (await db.query('SELECT * FROM launcher_announcement_reads ORDER BY user_id,announcement_id')).rows;
const publicationRows = async () => (await db.query('SELECT * FROM launcher_announcement_publications ORDER BY announcement_id,content_sha256')).rows;
async function main() {
  await db.exec('CREATE TABLE player_profiles(user_id BIGSERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,stats JSONB)');
  await db.query('INSERT INTO player_profiles(secret,stats) VALUES($1,$3::jsonb),($2,$3::jsonb)', ['a','b',JSON.stringify({client:{totals:{coins:73}},launcherWalletV1:{coins:100},launcherRoomV1:{revision:4}})]);
  const profileBefore = (await db.query('SELECT * FROM player_profiles ORDER BY user_id')).rows;
  const api = service(shipping);
  check('shipping roster opens only Ace',require('../config/launcher-crew-release-v1.json'),{schemaVersion:1,rosterRevision:2,characters:{ace:true,sabo:false,law:false,hancock:false}});
  check('shipping contains only two truthful current notices',shipping.announcements.map(item=>[item.id,item.scope,item.requiredRelease]),[
    ['launcher-1.2.6-announcements','launcher',{kind:'launcher',version:'1.2.6'}],['crew-ace-1.2.6','shop',{kind:'launcher',version:'1.2.6'}]]);
  for (const secret of ['',null,{},'missing','x'.repeat(257)]) check('unauthorized GET '+String(secret).slice(0,10),(await get(api,secret)).error,'bad secret');
  check('unauthenticated requests do not create tables',(await db.query("SELECT to_regclass('launcher_announcement_reads') AS value")).rows[0].value,null);
  let response = await get(api);
  check('required launcher release hidden before deployment',response,{ok:true,revision:1,total:0,unreadCount:0,readIds:[],announcements:[]});
  check('future release creates no publication witness',await publicationRows(),[]);
  check('hidden read refused',(await api.read(pool,'a',{announcementId:'crew-ace-1.2.6'},cap)).error,'announcement_unavailable');
  check('hidden read has no rows',await readRows(),[]);
  currentLauncher = '1.2.6'; response = await get(api);
  check('published current launcher and Ace visible',ids(response),['crew-ace-1.2.6','launcher-1.2.6-announcements']);
  check('first visit has two unread',[response.total,response.unreadCount,response.readIds],[2,2,[]]);
  check('private fields never leak',response.announcements.every(item=>!('status' in item)&&!('requiredRelease' in item)&&!('requiresCharacterId' in item)&&!('contentSha256' in item)),true);
  check('publication witness tied to current verified version',(await publicationRows()).map(row=>[row.release_kind,row.release_id]),[['launcher','1.2.6'],['launcher','1.2.6']]);
  check('legacy client hides Ace and its count',ids(await get(api,'a',{},{})),['launcher-1.2.6-announcements']);
  check('legacy cannot mark Ace read',(await api.read(pool,'a',{announcementId:'crew-ace-1.2.6'},{})).error,'announcement_unavailable');
  response = await get(api,'a',{scope:'launcher'});
  check('scope filter does not reduce global unread count',[response.announcements.length,response.unreadCount,response.total],[1,2,2]);
  check('empty game filter has no fake update',[...(await get(api,'a',{scope:'board'})).announcements],[]);
  check('category filter works',ids(await get(api,'a',{category:'character'})),['crew-ace-1.2.6']);
  for (const query of [{scope:'bogus'},{category:'bogus'},{userId:2},{scope:[]},null,[]]) check('invalid query rejected '+JSON.stringify(query),(await get(api,'a',query)).error,'invalid_announcement_filter');
  for (const request of [{},{announcementIds:[]},{announcementIds:['crew-ace-1.2.6','crew-ace-1.2.6']},
    {announcementId:'crew-ace-1.2.6',announcementIds:['crew-ace-1.2.6']},{announcementId:"x'; DROP TABLE player_profiles;--"},
    {announcementId:'x'.repeat(97)},{announcementIds:Array.from({length:101},(_,i)=>'test-'+i)},{announcementId:'crew-ace-1.2.6',userId:2},null,[]]) {
    check('invalid read rejected '+JSON.stringify(request).slice(0,60),(await api.read(pool,'a',request,cap)).error,'invalid_announcement_id');
  }
  check('bad-secret read denied',(await api.read(pool,'missing',{announcementId:'crew-ace-1.2.6'},cap)).error,'bad secret');
  check('mixed visible and unknown batch rejected',(await api.read(pool,'a',{announcementIds:['crew-ace-1.2.6','never-public']},cap)).error,'announcement_unavailable');
  check('mixed batch creates no partial read',await readRows(),[]);
  let read = await api.read(pool,'a',{announcementId:'crew-ace-1.2.6'},cap);
  check('single read persisted',[read.ok,read.read,read.unreadCount,read.readIds],[true,true,1,['crew-ace-1.2.6']]);
  const once = await readRows(); await api.read(pool,'a',{announcementId:'crew-ace-1.2.6'},cap);
  check('read idempotent including original timestamp',await readRows(),once);
  check('account B remains unread',(await get(api,'b')).unreadCount,2);
  read = await api.read(pool,'a',{announcementIds:shipping.announcements.map(item=>item.id)},cap);
  check('explicit snapshot batch read',[read.ok,read.unreadCount,read.readIds.length],[true,0,2]);
  check('new service instance retains account reads',(await get(service(shipping))).unreadCount,0);
  currentLauncher = '1.2.7'; verifierFails = true;
  check('published history survives later release verifier outage',ids(await get(service(shipping))),['crew-ace-1.2.6','launcher-1.2.6-announcements']);
  verifierFails = false;
  const fixture = clone(shipping); fixture.revision = 2;
  const baseEntry = clone(shipping.announcements[0]);
  fixture.announcements.push(
    {...baseEntry,id:'draft',status:'draft'},
    {...baseEntry,id:'future',publishedAt:'2027-01-01T00:00:00.000Z'},
    {...baseEntry,id:'later-launcher',requiredRelease:{kind:'launcher',version:'9.0.0'}},
    {...baseEntry,id:'locked-sabo',scope:'shop',category:'character',requiresCharacterId:'room-character-sabo',cta:{kind:'shop',itemId:'room-character-sabo'}},
    ...['card','board','chess'].map(scope=>({...baseEntry,id:scope+'-update',scope,version:gameA,requiredRelease:{kind:scope,releaseId:gameA},cta:{kind:'game',gameId:scope}})),
    {...baseEntry,id:'board-future',scope:'board',version:gameB,requiredRelease:{kind:'board',releaseId:gameB}});
  response = await get(service(fixture));
  check('all three verified game categories publish',ids(response),['board-update','card-update','chess-update','crew-ace-1.2.6','launcher-1.2.6-announcements']);
  check('hidden notes omitted before global counts',[response.total,response.unreadCount],[5,3]);
  check('game notes expose real release identifier',response.announcements.filter(item=>['card','board','chess'].includes(item.scope)).every(item=>item.releaseId===gameA),true);
  check('hidden statuses never enter publication ledger',(await publicationRows()).some(row=>['draft','future','locked-sabo','later-launcher','board-future'].includes(row.announcement_id)),false);
  currentGame = gameB;
  response = await get(service(fixture));
  check('next package keeps game history and adds newly verified note',ids(response),['board-future','board-update','card-update','chess-update','crew-ace-1.2.6','launcher-1.2.6-announcements']);
  const edited = clone(fixture); edited.announcements.find(item=>item.id==='board-update').body=['未經目前版本核對的新敘述'];
  check('edited historical content cannot inherit stale witness',ids(await get(service(edited))).includes('board-update'),false);
  const draftWithdrawal = clone(shipping); draftWithdrawal.announcements[1].status='draft';
  check('withdrawn notice remains hidden despite historic witness',ids(await get(service(draftWithdrawal))),['launcher-1.2.6-announcements']);
  const oldSupport = require('../server/launcher-crew-release').metadata;
  try {
    require('../server/launcher-crew-release').metadata = () => ({releasedCharacterIds:[],rosterRevision:2});
    check('character release gate rechecked even after publication',ids(await get(service(shipping))),['launcher-1.2.6-announcements']);
  } finally { require('../server/launcher-crew-release').metadata=oldSupport; }
  // Malformed/private metadata cannot turn into raw HTML or external navigation.
  for (const [name,mutate] of [
    ['HTML title',c=>c.announcements[0].title='<img src=x>'], ['duplicate ids',c=>c.announcements[1].id=c.announcements[0].id],
    ['too many entries',c=>c.announcements=Array.from({length:101},(_,i)=>({...c.announcements[0],id:'large-'+i}))],
    ['invalid date',c=>c.announcements[0].publishedAt='2026-02-31T00:00:00.000Z'],
    ['external CTA',c=>c.announcements[0].cta={kind:'url',url:'https://example.com'}],
    ['CTA extra URL',c=>c.announcements[1].cta.url='https://example.com'],
    ['character CTA mismatch',c=>c.announcements[1].cta.itemId='room-character-sabo'],
    ['character CTA missing gate',c=>{delete c.announcements[1].requiresCharacterId;c.announcements[1].category='item';}],
    ['wrong game release binding',c=>{c.announcements[0].scope='board';c.announcements[0].requiredRelease={kind:'chess',releaseId:gameA};}],
    ['game note missing package',c=>c.announcements[0].scope='card'],
    ['empty body',c=>c.announcements[0].body=[]], ['oversized body',c=>c.announcements[0].body=['a'.repeat(1001)]],
    ['invalid character metadata',c=>c.announcements[1].requiresCharacterId='javascript:alert(1)']]) {
    const config=clone(shipping);mutate(config);rejects(name,config);
  }
  const index = fs.readFileSync(path.join(root,'server/index.js'),'utf8'), handlers=new Map();
  const start=index.indexOf("socket.on('LAUNCHER_ANNOUNCEMENTS_GET'"),end=index.indexOf("socket.on('LAUNCHER_COMMENTS_GET'",start);
  assert.ok(start>0&&end>start);
  vm.runInNewContext(index.slice(start,end),{socket:{on:(name,fn)=>handlers.set(name,fn)},pool,launcherAnnouncements:api,console});
  async function wire(event,payload){let result;await handlers.get(event)(payload,value=>result=value);return result;}
  check('GET socket body preserves authentication/capability',(await wire('LAUNCHER_ANNOUNCEMENTS_GET',{secret:'b',crewContentRevision:1})).total,2);
  check('GET socket body old capability projection',(await wire('LAUNCHER_ANNOUNCEMENTS_GET',{secret:'b'})).total,1);
  check('READ socket body works',(await wire('LAUNCHER_ANNOUNCEMENT_READ',{secret:'b',crewContentRevision:1,announcementId:'crew-ace-1.2.6'})).ok,true);
  check('socket rejects forged userId',(await wire('LAUNCHER_ANNOUNCEMENT_READ',{secret:'b',crewContentRevision:1,announcementId:'crew-ace-1.2.6',userId:1})).error,'invalid_announcement_id');
  check('malformed socket payload safe',(await wire('LAUNCHER_ANNOUNCEMENTS_GET',null)).error,'bad secret');
  const distribution=fs.readFileSync(path.join(root,'server/desktop-distribution.js'),'utf8');
  check('distribution allows exact GET and READ events',['LAUNCHER_ANNOUNCEMENTS_GET','LAUNCHER_ANNOUNCEMENT_READ'].every(event=>distribution.slice(0,distribution.indexOf('const RETIRED_WORKER')).includes("'"+event+"'")),true);
  // Execute the production adapter, including the actual pinned-key signature
  // verifier. The checkout may still contain the previous signed release while
  // the new installer is being built; this checks authenticity, not deployment.
  const adapterStart=index.indexOf('const launcherAnnouncements = createLauncherAnnouncements(');
  const adapterEnd=index.indexOf('\n} });',adapterStart)+7;
  assert.ok(adapterStart>0&&adapterEnd>adapterStart);
  let adapter, gameCall, tamper=false;
  const signedBytes=fs.readFileSync(path.join(root,'public/desktop/launcher-release-v1.json'));
  const adapterFs={readFile:async file=>{
    check('production adapter reads only canonical manifest path',path.resolve(file),path.join(root,'public/desktop/launcher-release-v1.json'));
    if(!tamper)return signedBytes;
    const document=JSON.parse(signedBytes);document.version='9.9.9';return Buffer.from(JSON.stringify(document));
  }};
  vm.runInNewContext(index.slice(adapterStart,adapterEnd),{
    createLauncherAnnouncements:options=>{adapter=options.verifyRelease;return {};},
    validateLauncherAnnouncementRelease:require('../desktop/launcher-update-service').validateReleaseManifest,
    fs:adapterFs,path,__dirname:path.join(root,'server'),URL,Date,JSON,
    verifyDesktopRuntimePackage:async gameId=>{gameCall=gameId;return {ok:true,gameId,releaseId:gameA,manifestSha256:'a'.repeat(64)};}
  });
  const actualRelease=await adapter('launcher');
  check('actual signed launcher manifest accepted',JSON.parse(JSON.stringify(actualRelease)),{ok:true,kind:'launcher',version:JSON.parse(signedBytes).version});
  tamper=true;
  await assert.rejects(()=>adapter('launcher'));
  checks.push({name:'tampered launcher manifest refused by production adapter',status:'PASS'});
  const gameRelease=await adapter('board');
  check('game adapter invokes existing real runtime verifier',gameCall,'board');
  check('game adapter carries verified release and SHA',[gameRelease.kind,gameRelease.releaseId,gameRelease.manifestSha256],['board',gameA,'a'.repeat(64)]);
  check('profile stats, wallets and game saves unchanged',(await db.query('SELECT * FROM player_profiles ORDER BY user_id')).rows,profileBefore);
  check('QA source stable',sourceHashes(false),beforeHashes);
  const report={status:'PASS',kind:'isolated-in-memory-PGlite-announcement-service-QA',checkCount:checks.length,checks,
    sourceStable:true,sourceSha256:sourceHashes(false),sourceHashNormalization:'CRLF-to-LF-only',sourceNormalizedSha256:sourceHashes(true),
    limitations:['In-memory SQL and isolated Socket.IO handler bodies; no physical-device, public-account, or concurrent PostgreSQL acceptance.','Release verifier is injected for publication-boundary scenarios; production adapter uses signed launcher manifest and existing program-hash verifier.']};
  const idx=process.argv.indexOf('--report'); if(idx>=0)fs.writeFileSync(process.argv[idx+1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,checkCount:report.checkCount,kind:report.kind}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.close());
