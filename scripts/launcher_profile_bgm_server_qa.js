'use strict';
// Test existing BGM ownership, persistence and friend projection against isolated
// in-memory SQL. Playback acceptance belongs to the separate actual-browser QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const S = require('../server/launcher-profile-shop');
const root = path.resolve(__dirname, '..'), cap = { crewContentRevision:1 };
const sourcePaths = ['server/launcher-profile-shop.js','server/launcher-life-store.js','server/launcher-crew-release.js',
  'server/index.js','config/launcher-crew-release-v1.json','config/launcher-announcements-v1.json','scripts/launcher_profile_bgm_server_qa.js'];
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hashes = normalize => Object.fromEntries(sourcePaths.map(file=>[file,hash(normalize
  ? Buffer.from(fs.readFileSync(path.join(root,file),'utf8').replace(/\r\n/g,'\n')) : fs.readFileSync(path.join(root,file)))]));
const beforeHashes = hashes(false), checks = [];
const check = (name, actual, expected) => { assert.deepEqual(actual,expected,name);checks.push({name,status:'PASS'}); };
const db = new PGlite(), pool = {query:(...args)=>db.query(...args),connect:async()=>({query:(...args)=>db.query(...args),release(){}})};
const today = new Date().toISOString().slice(0,10), musicId='bgm-op-01';
const row = async secret => (await db.query('SELECT * FROM player_profiles WHERE secret=$1',[secret])).rows[0];
const snapshot = async () => (await db.query('SELECT * FROM player_profiles ORDER BY user_id')).rows;
const read = (secret,userId=0) => S.getLauncherProfile(pool,secret,userId,null,cap);
async function main(){
  await db.exec('CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now())');
  for(const [secret,id,friends] of [['owner',1,[2]],['visitor',2,[1]],['stranger',3,[]]]) {
    const stats={client:{social:{friends},totals:{coins:73,games:8}},launcherWalletV1:{coins:100,lastGrantDay:today},
      launcherOwnedV1:{items:[]},launcherAppearanceV1:{bgmId:'bgm-none'},launcherRoomV1:{revision:4,sceneId:'room-scene-default',capacityVersion:2,placements:[],characters:[]}};
    await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$2,$3,$4::jsonb)',[id,secret,'8',JSON.stringify(stats)]);
  }
  const catalogMusic = S.CATALOG.find(item=>item.id===musicId);
  check('real OP track present in shop',[catalogMusic.type,catalogMusic.price,catalogMusic.asset],['bgm',10,'opui://launcher/audio/bgm/track01.mp3']);
  let before=await snapshot();
  check('unowned track equip denied',(await S.changeLauncherItem(pool,'owner',musicId,'equip',cap)).error,'not_owned');
  check('denied equip preserves every profile and wallet',await snapshot(),before);
  let bought=await S.changeLauncherItem(pool,'owner',musicId,'buy',cap);
  check('actual purchased OP track owned',bought.shop.owned.bgms,[musicId]);
  check('music purchase pays existing ten-coin price',bought.shop.wallet.coins,90);
  check('purchase does not silently equip',bought.profile.appearance.bgmId,'bgm-none');
  let equipped=await S.changeLauncherItem(pool,'owner',musicId,'equip',cap);
  check('owned track equip succeeds',equipped.ok,true);
  check('equipped item returned for immediate playback',[equipped.profile.appearance.bgmId,equipped.profile.appearanceItems.bgm.asset],[musicId,catalogMusic.asset]);
  check('equip persists to authoritative saved appearance',(await row('owner')).stats.launcherAppearanceV1.bgmId,musicId);
  check('equip does not charge again',equipped.shop.wallet.coins,90);
  before=await snapshot();
  const mine=await read('owner'),guest=await read('visitor',1);
  check('self profile entry returns saved music',[mine.profile.isSelf,mine.profile.appearance.bgmId,mine.profile.appearanceItems.bgm.asset],[true,musicId,catalogMusic.asset]);
  check('mutual friend visit returns owner music',[guest.profile.isSelf,guest.profile.userId,guest.profile.appearance.bgmId,guest.profile.appearanceItems.bgm.asset],[false,1,musicId,catalogMusic.asset]);
  check('friend visit does not equip music for visitor',(await row('visitor')).stats.launcherAppearanceV1.bgmId,'bgm-none');
  check('self and guest reads do not mutate any profile',await snapshot(),before);
  check('profile payload does not expose account secret',!Object.hasOwn(guest.profile,'secret'),true);
  check('non-friend cannot visit profile',(await read('stranger',1)).error,'not friends');
  check('bad secret cannot read profile',(await read('missing',1)).error,'bad secret');
  await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social,friends}','[]'::jsonb) WHERE secret='owner'");
  check('one-way friend cannot read owner music',(await read('visitor',1)).error,'not friends');
  await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social,friends}','[2]'::jsonb) WHERE secret='owner'");
  const handlers=new Map(),source=fs.readFileSync(path.join(root,'server/index.js'),'utf8');
  const start=source.indexOf('socket.on("LAUNCHER_PROFILE_GET"'),end=source.indexOf('socket.on("LAUNCHER_SHOP_GET"',start);
  assert.ok(start>0&&end>start);
  vm.runInNewContext(source.slice(start,end),{socket:{on:(name,fn)=>handlers.set(name,fn)},launcherProfileShop:S,pool,boardCampaignsForIdentity:async()=>[],console});
  let wireResult;await handlers.get('LAUNCHER_PROFILE_GET')({secret:'visitor',userId:1,crewContentRevision:1},value=>wireResult=value);
  check('actual profile socket handler delivers visitor BGM',wireResult.profile.appearanceItems.bgm.asset,catalogMusic.asset);
  equipped=await S.changeLauncherItem(pool,'owner','bgm-none','equip',cap);
  check('disable music succeeds and retains ownership',[equipped.ok,equipped.shop.equipped.bgmId,equipped.shop.owned.bgms],[true,'bgm-none',[musicId]]);
  check('disabled music persisted',(await row('owner')).stats.launcherAppearanceV1.bgmId,'bgm-none');
  check('self disabled profile has no playable track',(await read('owner')).profile.appearanceItems.bgm,null);
  check('guest disabled profile has no playable track',(await read('visitor',1)).profile.appearanceItems.bgm,null);
  check('disabling does not deduct coins',(await row('owner')).stats.launcherWalletV1.coins,90);
  check('nonowner may choose bgm-none',(await S.changeLauncherItem(pool,'visitor','bgm-none','equip',cap)).ok,true);
  // A forged stale saved ID cannot bypass ownership or become a playable source.
  await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{launcherAppearanceV1,bgmId}',$1::jsonb) WHERE secret='visitor'",[JSON.stringify(musicId)]);
  before=await snapshot();
  const forged=await read('visitor');
  check('unowned saved BGM normalizes to none',[forged.profile.appearance.bgmId,forged.profile.appearanceItems.bgm],['bgm-none',null]);
  check('normalizing public projection never rewrites original profile',await snapshot(),before);
  check('original game currency remains untouched',(await snapshot()).map(item=>item.stats.client.totals.coins),[73,73,73]);
  check('room revisions remain untouched',(await snapshot()).map(item=>item.stats.launcherRoomV1.revision),[4,4,4]);
  const announcement=require('../config/launcher-announcements-v1.json');
  check('same two release announcements retained',announcement.announcements.length,2);
  check('release notice describes self and friend BGM autoplay',announcement.announcements.find(item=>item.id==='launcher-1.2.6-announcements').body.some(line=>line.includes('BGM')&&line.includes('自己')&&line.includes('好友')&&line.includes('自動播放')),true);
  check('tested sources stay unchanged',hashes(false),beforeHashes);
  const report={status:'PASS',kind:'isolated-in-memory-PGlite-profile-BGM-QA',checkCount:checks.length,checks,sourceStable:true,
    sourceSha256:hashes(false),sourceNormalizedSha256:hashes(true),sourceHashNormalization:'CRLF-to-LF-only',
    limitations:['No production accounts or saves were touched. PGlite runs one isolated SQL session.','This verifies server ownership, persistence and profile/socket projection, not audible playback or physical devices.']};
  const arg=process.argv.indexOf('--report');if(arg>=0)fs.writeFileSync(process.argv[arg+1],JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({status:report.status,checkCount:report.checkCount,kind:report.kind}));
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>db.close());
