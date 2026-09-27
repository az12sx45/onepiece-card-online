'use strict';
// Isolated, in-memory SQL service tests. Release overrides exist only in this
// process's require cache; the shipping JSON is never edited or environment driven.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const configPath = require.resolve('../config/launcher-crew-release-v1.json');
const shippingBytes = fs.readFileSync(configPath);
const shipping = JSON.parse(shippingBytes);
const sourcePaths=['config/launcher-crew-release-v1.json','server/launcher-crew-release.js','server/launcher-profile-shop.js','server/launcher-life.js','server/launcher-life-store.js','server/index.js','desktop/auth-service.js','desktop/launcher-reserved-crew.js','desktop/launcher-life-data.js','scripts/launcher_reserved_crew_server_qa.js'];
const cap = { crewContentRevision: 1 }, reserved = ['ace','sabo','law','hancock'];
const id = key => 'room-character-' + key;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual, expected, name); checks.push({ name, status: 'PASS' }); };
function modules(enabled = []) {
  for (const file of ['launcher-profile-shop','launcher-life-store','launcher-life','launcher-crew-release']) delete require.cache[require.resolve('../server/' + file)];
  require.cache[configPath] = { id: configPath, filename: configPath, loaded: true,
    exports: { schemaVersion: 1, rosterRevision: 1, characters: Object.fromEntries(reserved.map(key => [key, enabled.includes(key)])) } };
  return { S: require('../server/launcher-profile-shop'), B: require('../server/launcher-life-store'), L: require('../server/launcher-life'), R: require('../server/launcher-crew-release') };
}
const today = new Date().toISOString().slice(0,10), base = Date.parse(today + 'T03:00:00.000Z');
const now = seconds => new Date(base + seconds * 1000);
const yesterday = new Date(base - 86400000).toISOString().slice(0,10);
function stats(keys = ['luffy']) {
  return { client: { totals: { coins: 73 } }, launcherWalletV1: { coins: 100, lastGrantDay: yesterday },
    launcherOwnedV1: { items: keys.map(id) }, launcherRoomV1: { revision: 1, sceneId: 'room-scene-default', capacityVersion: 2,
      placements: [], characters: keys.map((key,i) => ({ itemId: id(key), x: 160 + i * 60, y: 440 })) } };
}
const db = new PGlite();
const pool = { query: (...args) => db.query(...args), connect: async () => ({ query: (...args) => db.query(...args), release() {} }) };
let sequence = 0;
const command = (type, payload, expectedRevision = 0) => ({ requestId: 'reserved-qa-' + String(++sequence).padStart(8,'0'), expectedRevision, type, payload });
const row = async secret => (await db.query('SELECT * FROM player_profiles WHERE secret=$1', [secret])).rows[0];
async function add(secret, value = stats()) {
  await db.query('INSERT INTO player_profiles(secret,name,avatar,stats) VALUES($1,$1,$2,$3::jsonb)', [secret,'8',JSON.stringify(value)]);
}
async function snapshot(secret) {
  const r = await row(secret), user = r.user_id;
  return { profile: r, life: (await db.query('SELECT * FROM launcher_life_state WHERE user_id=$1', [user])).rows,
    operations: (await db.query('SELECT * FROM launcher_life_operations WHERE user_id=$1 ORDER BY request_id', [user])).rows,
    ledger: (await db.query('SELECT * FROM launcher_wallet_ledger WHERE user_id=$1 ORDER BY operation_id', [user])).rows };
}
async function rejectUnchanged(name, secret, invoke, error = 'character_not_released') {
  const before = await snapshot(secret), result = await invoke();
  check(name + ' error', result.error, error);
  check(name + ' preserves canonical profile/life/operations/ledger', await snapshot(secret), before);
}
async function seedLife(secret, state) {
  const r = await row(secret);
  await db.query('INSERT INTO launcher_life_state(user_id,revision,state) VALUES($1,$2,$3::jsonb) ON CONFLICT(user_id) DO UPDATE SET revision=EXCLUDED.revision,state=EXCLUDED.state', [r.user_id,state.revision || 0,JSON.stringify(state)]);
}
async function main() {
  const sourceHashesBefore=Object.fromEntries(sourcePaths.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
  check('shipping flags explicitly false', shipping.characters, { ace:false,sabo:false,law:false,hancock:false });
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  let { S, B, L, R } = modules();
  await B.ensureLifeTables(pool); await add('closed');
  check('all false active life crew remains ten', L.CREW.length, 10);
  check('all false catalog excludes all reserved ids', S.CATALOG.filter(item => reserved.includes(item.key) && item.type === 'room_character'), []);
  check('all false ownership normalization rejects forged reserved items', S.launcherOwnedItemIds({launcherOwnedV1:{items:reserved.map(id)}}), []);
  const preview = await S.getLauncherShop(pool, '', true, cap);
  check('all false preview exposes ten released ids', preview.releasedCharacterIds.length, 10);
  check('nested shop carries same roster stamp', preview.shop.releasedCharacterIds, preview.releasedCharacterIds);
  for (const key of reserved) {
    const itemId = id(key), room = { ...stats().launcherRoomV1, characters: [{ itemId, x:300, y:400 }] };
    const operations = [
      ['buy', () => S.changeLauncherItem(pool,'closed',itemId,'buy',cap)],
      ['equip', () => S.changeLauncherItem(pool,'closed',itemId,'equip',cap)],
      ['room', () => S.setLauncherRoom(pool,'closed',room,cap)],
      ['character get', () => S.getLauncherCharacter(pool,'closed',itemId,now(0),cap)],
      ['talk', () => S.interactLauncherCharacter(pool,'closed',itemId,'talk',now(0),cap)],
      ['start', () => S.startLauncherCharacterWork(pool,'closed',itemId,now(0),cap)],
      ['claim', () => S.claimLauncherCharacterWork(pool,'closed',itemId,now(800),cap)],
      ['reserve', () => B.commandLauncherLife(pool,'closed',command('work.reserve',{itemId,stationId:'deck',roomRevision:1}),now(800),cap)],
      ['gift', () => B.commandLauncherLife(pool,'closed',command('character.interact',{itemId,action:'gift'}),now(800),cap)],
      ['activity', () => B.commandLauncherLife(pool,'closed',command('activity.record',{itemId,activity:'Eat'}),now(800),cap)],
      ['event participants', () => B.commandLauncherLife(pool,'closed',command('event.record',{eventId:'unknown',participants:[itemId]}),now(800),cap)]
    ];
    for (const [name, invoke] of operations) await rejectUnchanged('closed ' + key + ' ' + name,'closed',invoke);
    await rejectUnchanged('legacy cannot request reserved ' + key,'closed',()=>S.changeLauncherItem(pool,'closed',itemId,'buy'),'client_update_required');
  }
  const reservedContent = require('../desktop/launcher-reserved-crew');
  const aceEvent = reservedContent.events.find(event => event.requiredCharacters.includes('ace'));
  assert.ok(aceEvent,'dormant Ace event exists');
  await rejectUnchanged('event id alone cannot bypass release before aggregation','closed',()=>B.commandLauncherLife(pool,'closed',command('event.record',{eventId:aceEvent.id,participants:[id('luffy')]}),now(800),cap));
  // Raw life data deliberately includes an inaccessible character without an
  // owned/room entry. The guard must see this before normalization could erase it.
  await seedLife('closed',{revision:7,jobs:[{jobId:'hidden-job',itemId:id('ace'),status:'ready',reward:10}],pendingArrivals:[{arrivalId:'hidden-arrival',itemId:id('ace')}],characters:{[id('ace')]:{needs:{energy:60}}}});
  for (const type of ['work.activate','work.complete','work.cancel'])
    await rejectUnchanged('closed indirect ' + type,'closed',()=>B.commandLauncherLife(pool,'closed',command(type,{jobId:'hidden-job'},7),now(800),cap));
  await rejectUnchanged('closed indirect arrival','closed',()=>B.commandLauncherLife(pool,'closed',command('arrival.ack',{arrivalId:'hidden-arrival'},7),now(800),cap));
  await rejectUnchanged('closed GET cannot auto settle','closed',()=>B.getLauncherLife(pool,'closed',now(800),cap));
  await rejectUnchanged('raw life-only legacy guard','closed',()=>S.setLauncherCard(pool,'closed',{displayName:'unchanged',tagline:'',avatarId:8}),'client_update_required');
  await db.query('DELETE FROM launcher_life_state WHERE user_id=$1',[(await row('closed')).user_id]);
  const closedRow = await row('closed');
  await db.query('INSERT INTO launcher_wallet_ledger(user_id,operation_id,job_id,amount,balance_after,receipt) VALUES($1,$2,$3,10,110,$4::jsonb)',[closedRow.user_id,'life-work:old-hidden','old-hidden',JSON.stringify({itemId:id('ace'),amount:10})]);
  await rejectUnchanged('completed hidden job receipt cannot bypass gate','closed',()=>B.commandLauncherLife(pool,'closed',command('work.complete',{jobId:'old-hidden'}),now(800),cap));
  // Requiring the modules with only Ace true models a fresh server process.
  ({ S, B, L, R } = modules(['ace'])); await B.ensureLifeTables(pool); await add('open',stats([])); await add('legacy-ten');
  check('one enabled crew has eleven definitions', L.CREW.length, 11);
  check('only Ace enters sale catalog', S.CATALOG.filter(item => reserved.includes(item.key) && item.type==='room_character').map(item=>item.key), ['ace']);
  check('legacy preview stays ten after release',(await S.getLauncherShop(pool,'',true)).shop.catalog.filter(item=>item.type==='room_character').length,10);
  check('capability preview includes Ace',(await S.getLauncherShop(pool,'',true,cap)).shop.catalog.filter(item=>item.type==='room_character').length,11);
  await rejectUnchanged('legacy cannot buy even released Ace','open',()=>S.changeLauncherItem(pool,'open',id('ace'),'buy'),'client_update_required');
  const bought = await S.changeLauncherItem(pool,'open',id('ace'),'buy',cap);
  check('only-enabled Ace purchase succeeds',bought.ok,true);
  check('Ace purchase pays existing epic price after daily grant',bought.shop.wallet.coins,102);
  check('purchase owns and places Ace',bought.profile.room.characters.map(c=>c.itemId),[id('ace')]);
  check('purchase creates arrival',bought.life.pendingArrivals.map(a=>a.itemId),[id('ace')]);
  check('nested profile carries release stamp',bought.profile.releasedCharacterIds.includes(id('ace')),true);
  for (const key of reserved.slice(1)) await rejectUnchanged('only Ace enabled still rejects '+key,'open',()=>S.changeLauncherItem(pool,'open',id(key),'buy',cap));
  const savedRoom = bought.profile.room;
  check('modern room can save Ace',(await S.setLauncherRoom(pool,'open',savedRoom,cap)).ok,true);
  check('modern Ace talk works',(await S.interactLauncherCharacter(pool,'open',id('ace'),'talk',now(0),cap)).ok,true);
  let life = await B.getLauncherLife(pool,'open',now(0),cap);
  check('modern life preserves Ace',life.life.ownedCharacterIds,[id('ace')]);
  const arrival = life.life.pendingArrivals[0];
  life = await B.commandLauncherLife(pool,'open',command('arrival.ack',{arrivalId:arrival.arrivalId},life.life.revision),now(0),cap);
  check('released Ace arrival acknowledgement works',life.acknowledged,true);
  life = await B.commandLauncherLife(pool,'open',command('work.reserve',{itemId:id('ace'),stationId:'deck',roomRevision:life.room.revision},life.life.revision),now(0),cap);
  check('released Ace can reserve ordinary work',life.ok,true);
  const jobId=life.job.jobId, activateAt=Math.ceil((Date.parse(life.job.activateAfter)-base)/1000);
  life=await B.commandLauncherLife(pool,'open',command('work.activate',{jobId},life.life.revision),now(activateAt),cap);
  check('released Ace can activate ordinary work',life.ok,true);
  const ready=Math.ceil((Date.parse(life.job.readyAt)-base)/1000);
  const oldOps = [
    ['shop grant',()=>S.getLauncherShop(pool,'open')], ['buy other item',()=>S.changeLauncherItem(pool,'open','room-furniture-helm','buy')],
    ['equip default',()=>S.changeLauncherItem(pool,'open','layout-default','equip')],
    ['save empty room',()=>S.setLauncherRoom(pool,'open',{...savedRoom,characters:[]})],
    ['save card',()=>S.setLauncherCard(pool,'open',{displayName:'do not save',tagline:'',avatarId:8})],
    ['save decoration',()=>S.setLauncherDecorationPlacement(pool,'open','header',{x:50,y:50,scale:1})],
    ['life get auto settlement',()=>B.getLauncherLife(pool,'open',now(ready+600))],
    ...['checkpoint','directive.set','work.complete','arrival.ack'].map(type=>[type,()=>B.commandLauncherLife(pool,'open',command(type,type==='work.complete'?{jobId}:type==='arrival.ack'?{arrivalId:arrival.arrivalId}:type==='directive.set'?{directiveId:'free_day'}:{exit:true},life.life.revision),now(ready+600))]),
    ['old character endpoint',()=>S.getLauncherCharacter(pool,'open',id('luffy'),now(ready+600))]
  ];
  for(const [name,invoke] of oldOps)await rejectUnchanged('legacy canonical reserved '+name,'open',invoke,'client_update_required');
  const readBefore=await snapshot('open'),legacyProfile=await S.getLauncherProfile(pool,'open');
  check('legacy read projection hides Ace',legacyProfile.profile.room.characters,[]);
  check('legacy profile projection never writes canonical',await snapshot('open'),readBefore);
  const priorCoins=(await row('open')).stats.launcherWalletV1.coins;
  life=await B.getLauncherLife(pool,'open',now(ready+600),cap);
  check('modern offline work settles exactly ten',life.wallet.coins,priorCoins+10);
  check('Card game wallet remains untouched',(await row('open')).stats.client.totals.coins,73);
  check('legacy ten can still use ordinary talk',(await S.interactLauncherCharacter(pool,'legacy-ten',id('luffy'),'talk',now(0))).ok,true);
  check('unowned released characters never poison legacy companion state',Object.hasOwn((await row('legacy-ten')).stats.launcherCompanionsV1.characters,id('ace')),false);
  check('legacy ten remains writable after talk',(await B.getLauncherLife(pool,'legacy-ten',now(0))).ok,true);
  // Execute the actual launcher socket-handler region against isolated services.
  // This verifies wire capability forwarding, not a running remote Socket.IO server.
  const wireHandlers = new Map(), indexSource=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
  const wireStart=indexSource.indexOf('socket.on("LAUNCHER_PROFILE_GET"'),wireEnd=indexSource.indexOf("socket.on('LAUNCHER_COMMENTS_GET'",wireStart);
  assert.ok(wireStart>0&&wireEnd>wireStart);
  require('node:vm').runInNewContext(indexSource.slice(wireStart,wireEnd),{
    socket:{on:(name,handler)=>wireHandlers.set(name,handler)},pool,launcherProfileShop:S,launcherLife:B,console,
    boardCampaignsForIdentity:async()=>[],getProfileBySecret:row,emitToUser(){}
  });
  async function wire(event,payload){let result;await wireHandlers.get(event)({secret:'open',crewContentRevision:1,...payload},value=>{result=value;});return result;}
  check('profile wire preserves capability',(await wire('LAUNCHER_PROFILE_GET',{})).profile.room.characters[0].itemId,id('ace'));
  check('shop wire preserves capability',(await wire('LAUNCHER_SHOP_GET',{})).shop.owned.roomCharacters,[id('ace')]);
  check('life GET wire preserves capability',(await wire('LAUNCHER_LIFE_GET',{})).ok,true);
  for (const event of ['LAUNCHER_SHOP_BUY','LAUNCHER_SHOP_EQUIP','LAUNCHER_CHARACTER_GET','LAUNCHER_CHARACTER_WORK_START','LAUNCHER_CHARACTER_WORK_CLAIM','LAUNCHER_CHARACTER_INTERACT'])
    check(event+' wire uses modern closed-character gate',(await wire(event,{itemId:id('sabo'),action:'talk'})).error,'character_not_released');
  check('room wire forwards modern capability',(await wire('LAUNCHER_ROOM_SET',{...savedRoom,characters:[{itemId:id('sabo'),x:300,y:400}]})).error,'character_not_released');
  check('life command wire forwards modern capability',(await wire('LAUNCHER_LIFE_COMMAND',command('character.interact',{itemId:id('sabo'),action:'gift'}))).error,'character_not_released');
  check('card wire accepts capable existing-new-crew owner',(await wire('LAUNCHER_CARD_SET',{displayName:'QA Captain',tagline:'',avatarId:8})).ok,true);
  check('decoration wire reaches ordinary validation',(await wire('LAUNCHER_DECORATION_PLACEMENT_SET',{slot:'header',placement:{x:50,y:50,scale:1}})).error,'empty_slot');
  await rejectUnchanged('socket omitted capability is still legacy','open',()=>wire('LAUNCHER_LIFE_GET',{crewContentRevision:undefined}),'client_update_required');
  const Module=require('node:module'),originalLoad=Module._load;let bridge;
  try {
    Module._load=function(request,parent,isMain){if(request==='electron')return {app:{isPackaged:true},safeStorage:{}};return originalLoad.call(this,request,parent,isMain);};
    const {AuthService}=require('../desktop/auth-service');bridge=new AuthService({origin:'https://example.invalid',userDataPath:path.join(root,'unused-reserved-qa-bridge')});
  }finally{Module._load=originalLoad;}
  bridge.secretMemory='isolated-fixture';bridge.state.account={userId:1};let emitted;
  bridge.emitAck=async(event,payload)=>{emitted={event,payload};return {ok:true};};
  for(const key of reserved){
    check('Auth accepts supported dormant id '+key,(await bridge.buyLauncherItem(id(key))).ok,true);
    check('Auth sends capability on purchase '+key,emitted.payload.crewContentRevision,1);
    check('Auth room format accepts supported dormant id '+key,(await bridge.saveLauncherRoom({...savedRoom,characters:[{itemId:id(key),x:300,y:400}]})).ok,true);
    check('Auth character format accepts supported dormant id '+key,(await bridge.getLauncherCharacter(id(key))).ok,true);
  }
  await bridge.launcherRequest('LAUNCHER_LIFE_GET',{crewContentRevision:0});
  check('Auth capability cannot be downgraded by renderer payload',emitted.payload.crewContentRevision,1);
  bridge.previewMode=true;await bridge.getLauncherShop({preview:true});
  check('preview Auth request also sends capability',emitted.payload.crewContentRevision,1);bridge.close();
  // Capacity stays ten after all fourteen are server-supported.
  ({ S, B, L }=modules(reserved)); await B.ensureLifeTables(pool); await add('full',stats(R.LEGACY_KEYS));
  await rejectUnchanged('eleventh simultaneous purchase rejected','full',()=>S.changeLauncherItem(pool,'full',id('ace'),'buy',cap),'room_full');
  // Reverting a flag cannot erase previously released ownership or settle jobs.
  ({ S, B }=modules()); await B.ensureLifeTables(pool);
  await rejectUnchanged('unpublishing preserves existing rights via write refusal','open',()=>B.getLauncherLife(pool,'open',now(ready+900),cap));
  check('shipping config unchanged byte-for-byte',fs.readFileSync(configPath),shippingBytes);
  const sourceSha256=Object.fromEntries(sourcePaths.map(file=>[file,hash(fs.readFileSync(path.join(root,file)))]));
  check('tested source remains unchanged throughout QA',sourceSha256,sourceHashesBefore);
  const report={status:'PASS',kind:'isolated-in-memory-PGlite-service-QA',limitations:['One SQL session; no real PostgreSQL concurrency, public server, UI play or release flag modification.','Socket handler body and Auth bridge are executed in isolated harnesses; no network socket is opened.'],checks,checkCount:checks.length,shippingConfigSha256:hash(shippingBytes),sourceStable:true,sourceSha256,sourceHashNormalization:'CRLF-to-LF-only',sourceNormalizedSha256:Object.fromEntries(sourcePaths.map(file=>[file,hash(Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')))]))};
  const reportIndex=process.argv.indexOf('--report');if(reportIndex>=0)fs.writeFileSync(process.argv[reportIndex+1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,checkCount:report.checkCount,kind:report.kind}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await db.close();delete require.cache[configPath];});
