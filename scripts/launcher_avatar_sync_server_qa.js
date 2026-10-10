'use strict';
// Isolated PGlite only. Exercises actual production Socket.IO handlers over
// loopback; no formal account, DB credentials, saved worlds or coins are used.
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const {PGlite}=require(process.env.BOARD_QA_PGLITE||'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const {io}=require('../public/vendor/socket.io-client/4.8.1/socket.io.min.js');
const S=require('../server/launcher-profile-shop');
const out=process.env.AVATAR_SYNC_QA_OUT||'D:/Codex_QA/launcher-shop-r58/sync-server-report.json';
const checks=[];const check=(name,value)=>{assert.ok(value,name);checks.push(name);};
const db=new PGlite();
const pool={query:(...a)=>db.query(...a),async connect(){return{query:(...a)=>db.query(...a),release(){}};}};
const ack=(s,event,data)=>new Promise((resolve,reject)=>s.timeout(10000).emit(event,data,(err,r)=>err?reject(err):resolve(r)));
const once=(s,event,accept=()=>true)=>new Promise((resolve,reject)=>{const t=setTimeout(()=>{s.off(event,fn);reject(Error('timeout '+event));},12000);function fn(r){if(accept(r)){clearTimeout(t);s.off(event,fn);resolve(r);}}s.on(event,fn);});
async function main(){
  await db.exec(`CREATE TABLE player_profiles(user_id SERIAL PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB DEFAULT '{}',titles JSONB DEFAULT '[]',bounties JSONB DEFAULT '[]',recent_matches JSONB DEFAULT '[]',updated_at TIMESTAMPTZ DEFAULT now());`);
  const today=new Date().toISOString().slice(0,10);
  for(const [id,secret]of [[1,'r58-qa-owner'],[2,'r58-qa-friend']])await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$2,$3,$4::jsonb)',[id,secret,'8',JSON.stringify({launcherWalletV1:{coins:500,lastGrantDay:today},launcherOwnedV1:{items:['ava-122','ava-123','ava-222']},launcherAppearanceV1:{avatarId:id===1?222:123},client:{totals:{coins:77,games:4},social:{friends:[id===1?2:1]},shop:{ownedAvatars:[31]}},keep:'unchanged'})]);
  // First exercise every new product's real SQL purchase/equip with capped QA wallets.
  const fresh=S.CATALOG.filter(x=>x.type==='avatar'&&x.key>=123);
  check('exactly_100_new_ids_123_to_222',fresh.length===100&&fresh[0].key===123&&fresh.at(-1).key===222);
  for(let batch=0;batch<5;batch++){
    const secret='r58-buyer-'+batch;
    await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$2,$3,$4::jsonb)',[10+batch,secret,'8',JSON.stringify({launcherWalletV1:{coins:500,lastGrantDay:today}})]);
    for(const item of fresh.slice(batch*20,batch*20+20)){
      const b=await S.changeLauncherItem(pool,secret,item.id,'buy',{crewContentRevision:1});assert.equal(b.ok,true,item.id);
      const e=await S.changeLauncherItem(pool,secret,item.id,'equip',{crewContentRevision:1});assert.equal(e.profile.avatar,item.key);
    }
  }
  checks.push('all_100_products_bought_and_equipped_with_real_isolated_SQL');
  const row=()=>db.query('SELECT * FROM player_profiles WHERE user_id=1').then(r=>r.rows[0]);
  let original=await row(), projected=S.toGameProfile(original);
  check('projection_matches_launcher_and_public_profile',projected.avatar===222&&S.toPublicProfile(original).avatar===222&&S.toCardPublicProfile(original).avatar===222);
  check('projection_keeps_legacy_and_modern_ownership',JSON.stringify(projected.stats.client.shop.ownedAvatars)==='[31,122,123,222]');
  check('projection_does_not_mutate_stored_inventory',JSON.stringify(original.stats.client.shop.ownedAvatars)==='[31]');
  check('unowned_selection_ignored',S.toGameProfile({...original,stats:{...original.stats,launcherAppearanceV1:{avatarId:221}}}).avatar===8);
  const card=await S.setLauncherCard(pool,'r58-qa-owner',{displayName:'測試航海士',tagline:'',avatarId:123},{crewContentRevision:1});
  check('profile_card_avatar_is_shared',card.profile.avatar===123&&S.toGameProfile(await row()).avatar===123);
  await S.changeLauncherItem(pool,'r58-qa-owner','ava-222','equip',{crewContentRevision:1});
  check('equip_also_updates_custom_card',S.toPublicProfile(await row()).card.avatarId===222);
  const dbPath=require.resolve('../server/db');require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{pool}};
  process.env.DATABASE_URL='isolated-pglite-no-network';process.env.OP_DESKTOP_ONLY='0';process.env.PORT='41958';
  require('../server/index');
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:41958/health')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  const a=io('http://127.0.0.1:41958',{transports:['websocket'],forceNew:true}),b=io('http://127.0.0.1:41958',{transports:['websocket'],forceNew:true});
  await Promise.all([once(a,'connect'),once(b,'connect')]);
  const pa=await ack(a,'PROFILE_GET',{secret:'r58-qa-owner'});check('actual_PROFILE_GET_returns_222',pa.profile.avatar===222);
  const publicView=await ack(b,'PROFILE_PUBLIC_GET',{userId:1});check('actual_visitor_returns_222_without_secret',publicView.profile.avatar===222&&!('secret'in publicView.profile));
  for(const launcher of [false,true]){const f=await ack(b,'FRIENDS_GET',{secret:'r58-qa-friend',launcher});check('friends_match_for_launcher_'+launcher,f.friends[0].avatar===222);}
  const stale=await ack(a,'PROFILE_UPDATE',{secret:'r58-qa-owner',patch:{avatar:'1',stats:{client:{totals:{coins:78,games:5},shop:{ownedAvatars:[]}}}}});
  check('stale_game_autosave_keeps_equipped_avatar',stale.ok&&stale.profile.avatar===222&&(await row()).stats.keep==='unchanged');
  check('stale_autosave_keeps_independent_wallet',(await row()).stats.launcherWalletV1.coins===500&&(await row()).stats.client.totals.coins===78);
  const deny=await ack(a,'PROFILE_UPDATE',{secret:'r58-qa-owner',patch:{avatar:'221',avatarSelection:true}});check('unowned_explicit_selection_rejected',deny.error==='not_owned');
  const select=await ack(a,'PROFILE_UPDATE',{secret:'r58-qa-owner',patch:{avatar:'123',avatarSelection:true}});check('game_picker_changes_shared_avatar',select.ok&&select.profile.avatar===123);
  const friend=await ack(b,'FRIENDS_GET',{secret:'r58-qa-friend'});check('friend_sees_new_shared_choice',friend.friends[0].avatar===123);
  check('new_catalog_ownership_not_forged',!(await row()).stats.launcherOwnedV1.items.includes('ava-221'));
  const free=await ack(a,'PROFILE_UPDATE',{secret:'r58-qa-owner',patch:{avatar:'7',avatarSelection:true}});check('free_avatar_can_replace_paid_avatar_everywhere',free.ok&&free.profile.avatar===7&&S.toPublicProfile(await row()).card.avatarId===7);
  const oldFree=await ack(a,'PROFILE_UPDATE',{secret:'r58-qa-owner',patch:{avatar:'1'}});check('stale_autosave_also_preserves_selected_free_avatar',oldFree.profile.avatar===7&&(await row()).avatar==='7');
  await S.changeLauncherItem(pool,'r58-qa-owner','ava-222','equip',{crewContentRevision:1});
  for(const [sock,secret]of [[a,'r58-qa-owner'],[b,'r58-qa-friend']])assert.equal((await ack(sock,'SOCIAL_AUTH',{secret,deviceId:'r58-qa-'+secret})).ok,true);
  const c=await ack(a,'CHESS_JOIN_ROOM',{create:true,roomCode:'C58581',profile:{avatar:1}});assert.equal(c.ok,true,JSON.stringify(c));
  const d=await ack(b,'CHESS_JOIN_ROOM',{roomCode:'C58581',profile:{avatar:1}});assert.equal(d.ok,true);
  check('chess_room_uses_server_avatar_not_supplied_default',d.lobby.players.find(p=>p.userId===1).avatar===222&&d.lobby.players.find(p=>p.userId===2).avatar===123);
  const ca=await ack(a,'BOARD_JOIN_ROOM',{create:true,roomCode:'B58581',profile:{userId:1,clientId:'a',avatar:1}});assert.equal(ca.ok,true,JSON.stringify(ca));
  const cb=await ack(b,'BOARD_JOIN_ROOM',{roomCode:'B58581',profile:{userId:2,clientId:'b',avatar:1}});assert.equal(cb.ok,true,JSON.stringify(cb));
  check('board_room_uses_account_avatar',cb.lobby.players.find(p=>p.userId===1).avatar===222&&cb.lobby.players.find(p=>p.userId===2).avatar===123);
  const cardLobby=once(a,'EMIT',r=>r.type==='lobby');a.emit('JOIN_ROOM',{roomId:'R58QA',secret:'r58-qa-owner',displayName:'QA',avatar:1});
  const cl=await cardLobby;check('card_room_ignores_stale_supplied_avatar',cl.lobby.players.some(p=>p.avatar===222));
  a.disconnect();b.disconnect();
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({status:'PASS',scope:'actual server handlers and two Socket.IO clients, isolated PGlite; no formal player data',checks},null,2));
  console.log(JSON.stringify({status:'PASS',checks:checks.length,report:out}));
  // Optional browser QA can connect while this isolated runtime remains alive.
  if(process.env.AVATAR_QA_KEEP_SERVER==='1')return;
  await db.close();process.exit(0);
}
main().catch(e=>{fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify({status:'FAIL',checks,error:e.stack},null,2));console.error(e);process.exit(1);});
