'use strict';

// Real isolated PostgreSQL queries plus the unchanged installed-core transport.
// Never connects to a formal player database or spends real account currency.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const S = require('../server/launcher-profile-shop');
const G = require('../server/launcher-guestbook');
const B = require('../server/launcher-profile-command');
const db = new PGlite();
const pool = { query: (...args) => db.query(...args), async connect() { return { query: (...args) => db.query(...args), release() {} }; } };
const capability = { crewContentRevision: 1 };
const checks = [];
const check = async (name, fn) => { await fn(); checks.push(name); };
const today = new Date().toISOString().slice(0, 10);
let requestCounter = 0;
const command = payload => ({ requestId: 'guestbook-qa-' + ++requestCounter, expectedRevision: 0, type: 'event.record', payload: { scope: B.SCOPE, ...payload } });
const profile = async secret => (await db.query('SELECT * FROM player_profiles WHERE secret=$1', [secret])).rows[0];
const ageComments = async () => db.query("UPDATE launcher_profile_comments SET created_at=now()-INTERVAL '2 minutes'");
const invoke = (secret, p) => B.commandLauncherProfile(pool, secret, command(p), capability);
const buy = (secret, itemId) => invoke(secret, { operation: 'shop.buy', itemId });
const equip = (secret, itemId) => invoke(secret, { operation: 'shop.equip', itemId });

(async () => {
  try {
    await db.exec(`CREATE TABLE player_profiles(user_id BIGINT PRIMARY KEY,secret TEXT UNIQUE NOT NULL,name TEXT,avatar TEXT,stats JSONB,updated_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE launcher_profile_comments(id BIGSERIAL PRIMARY KEY,owner_user_id BIGINT NOT NULL,author_user_id BIGINT NOT NULL,body TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
      INSERT INTO launcher_profile_comments(owner_user_id,author_user_id,body,created_at) VALUES(1,2,'舊版留言',now()-INTERVAL '1 day');`);
    for (const [id, secret, items, friends] of [[1,'owner',['guestbook-1'],[2]],[2,'friend',[],[1,5,6]],[3,'stranger',[],[]],[4,'one-sided',[],[1]],[5,'board-owner',[],[2]],[6,'locked',[],[2]]]) {
      await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$2,$3,$4::jsonb)', [id, secret, '8', JSON.stringify({ launcherWalletV1: {coins:500,lastGrantDay:today}, launcherOwnedV1:{items}, client:{totals:{coins:77},social:{friends}}, launcherLifeV1:{keep:'original'}, custom:'preserved' })]);
    }
    const boards = S.CATALOG.filter(x => x.type === 'guestbook_style');
    const notes = S.CATALOG.filter(x => x.type === 'comment_style');
    const avatars = S.CATALOG.filter(x => x.type === 'avatar' && x.key >= 93 && x.key <= 122);
    await check('catalog_10_boards_20_notes_30_new_avatars_93_to_122', () => { assert.equal(boards.length,10); assert.equal(notes.length,20); assert.deepEqual(avatars.map(x=>x.key),Array.from({length:30},(_,i)=>93+i)); });
    await check('catalog_matches_art_registry_and_pricing', () => {
      const art = JSON.parse(fs.readFileSync(path.join(__dirname,'../tools/launcher-guestbook-r56/styles.json'),'utf8'));
      for (const [items, spec] of [[boards,art.boards],[notes,art.notes]]) for (let i=0;i<spec.length;i++) {
        assert.equal(items[i].key,spec[i].key); assert.equal(items[i].asset,spec[i].asset); assert.equal(items[i].name,spec[i].name); assert.ok(items[i].price>0);
      }
      assert.equal(new Set(S.CATALOG.map(x=>x.id)).size,S.CATALOG.length);
    });
    await check('old_table_migration_keeps_default_style', async () => { const r=await G.getLauncherComments(pool,'owner'); assert.equal(r.comments[0].styleId,S.DEFAULT_COMMENT_STYLE.id); assert.equal(r.comments[0].body,'舊版留言'); });
    await check('schema_migration_repeat_is_idempotent', async () => { await G.ensureGuestbookTable({query:(...a)=>db.query(...a)}); assert.equal((await db.query('SELECT COUNT(*)::int n FROM launcher_profile_comments')).rows[0].n,1); });
    await check('board_purchase_unlocks_without_legacy_guestbook_purchase', async () => { const r=await buy('board-owner',boards[0].id); assert.equal(r.ok,true); assert.equal(r.profile.guestbookUnlocked,true); assert.equal(r.shop.wallet.coins,500-boards[0].price); assert.deepEqual(r.shop.owned.guestbookStyles,[boards[0].id]); assert.ok(!r.profile.collection.launcher.itemIds.includes('guestbook-1')); });
    await check('board_equip_is_public_safe_asset', async () => { const r=await equip('board-owner',boards[0].id); assert.equal(r.shop.equipped.guestbookStyleId,boards[0].id); assert.equal(r.profile.appearanceItems.guestbookStyle.asset,boards[0].asset); assert.equal((await G.getLauncherComments(pool,'friend',5)).ok,true); });
    await check('all_boards_buy_and_equip', async () => { for(const item of boards.slice(1)) {assert.equal((await buy('board-owner',item.id)).ok,true);assert.equal((await equip('board-owner',item.id)).shop.equipped.guestbookStyleId,item.id);} });
    await check('buy_once_no_repeat_charge', async () => { const coins=S.toShop(await profile('board-owner')).wallet.coins; assert.equal((await buy('board-owner',boards[0].id)).error,'already_owned');assert.equal(S.toShop(await profile('board-owner')).wallet.coins,coins); });
    await check('unowned_style_equip_rejected', async () => { assert.equal((await equip('friend',notes[0].id)).error,'not_owned'); });
    await check('all_notes_buy_and_equip', async () => { for(const item of notes){assert.equal((await buy('friend',item.id)).ok,true);assert.equal((await equip('friend',item.id)).shop.equipped.commentStyleId,item.id);} });
    await check('note_ownership_does_not_unlock_own_board', async () => { assert.equal(S.toShop(await profile('friend')).owned.guestbook,false); assert.equal(S.toShop(await profile('friend')).owned.commentStyles.length,20); });
    await check('default_style_equip_free_not_buyable', async () => { const before=S.toShop(await profile('friend')).wallet.coins; assert.equal((await equip('friend',S.DEFAULT_COMMENT_STYLE.id)).ok,true); assert.equal((await buy('friend',S.DEFAULT_COMMENT_STYLE.id)).error,'invalid item');assert.equal(S.toShop(await profile('friend')).wallet.coins,before); });
    await check('default_board_keeps_purchase_unlock', async () => { const r=await equip('board-owner',S.DEFAULT_GUESTBOOK_STYLE.id);assert.equal(r.profile.guestbookUnlocked,true);assert.equal(r.shop.equipped.guestbookStyleId,S.DEFAULT_GUESTBOOK_STYLE.id); });
    await check('equipped_note_snapshotted_on_old_post_api', async () => { await equip('friend',notes[0].id); const r=await G.postLauncherComment(pool,'friend',1,'第一次出航');assert.equal(r.comment.styleId,notes[0].id);await equip('friend',notes[1].id); const list=await G.getLauncherComments(pool,'owner');assert.equal(list.comments[0].styleId,notes[0].id);assert.equal(list.comments[0].style.asset,notes[0].asset); });
    await check('rate_limit_still_applies', async () => { assert.equal((await G.postLauncherComment(pool,'friend',1,'太快')).error,'rate_limited'); });
    await ageComments();
    const explicit = command({operation:'comment.post',userId:1,body:'<img src=x onerror=alert(1)>',styleId:notes[2].id});
    let explicitId;
    await check('explicit_owned_note_and_text_survive_safely', async () => { const r=await B.commandLauncherProfile(pool,'friend',explicit,capability);assert.equal(r.ok,true);assert.equal(r.comment.styleId,notes[2].id);assert.equal(r.comment.body,explicit.payload.body);explicitId=r.comment.id; assert.ok(!JSON.stringify(r).includes('author_stats')); });
    await check('same_request_replay_is_same_comment_no_duplicate', async () => { const r=await B.commandLauncherProfile(pool,'friend',explicit,capability);assert.equal(r.duplicate,true);assert.equal(r.comment.id,explicitId); assert.equal((await db.query('SELECT COUNT(*)::int n FROM launcher_profile_comments WHERE client_request_id=$1',[explicit.requestId])).rows[0].n,1); });
    await check('request_id_payload_conflict_rejected', async () => { const r=await B.commandLauncherProfile(pool,'friend',{...explicit,payload:{...explicit.payload,body:'changed'}},capability);assert.equal(r.error,'request_id_conflict'); });
    await check('request_id_owner_conflict_rejected', async () => { const r=await B.commandLauncherProfile(pool,'friend',{...explicit,payload:{...explicit.payload,userId:5}},capability);assert.equal(r.error,'request_id_conflict'); });
    await check('visitor_can_read_snapshot_without_style_ownership', async () => { const r=await G.getLauncherComments(pool,'owner');assert.equal(r.comments[0].style.id,notes[2].id);assert.ok(!JSON.stringify(r).includes('"secret"'));assert.ok(!JSON.stringify(r).includes('"stats"')); });
    await check('nonowner_cannot_use_paid_note', async () => { assert.equal((await G.postLauncherComment(pool,'owner',1,'偷用',notes[2].id)).error,'comment_style_not_owned'); });
    await check('invalid_style_url_and_board_id_rejected', async () => { for(const id of ['https://evil.invalid/x',boards[0].id,'comment-style-nope',null])assert.equal((await G.postLauncherComment(pool,'owner',1,'樣式',id)).error,'invalid_comment_style'); });
    await check('default_free_comment_without_note_ownership', async () => { const r=await G.postLauncherComment(pool,'owner',1,'船長公告',S.DEFAULT_COMMENT_STYLE.id);assert.equal(r.ok,true);assert.equal(r.comment.styleId,S.DEFAULT_COMMENT_STYLE.id); });
    await check('notes_are_reusable_and_never_charge_on_post', async () => { await ageComments(); const before=S.toShop(await profile('friend')); for(let i=0;i<3;i++){await ageComments();assert.equal((await G.postLauncherComment(pool,'friend',1,'重複使用 '+i,notes[0].id)).ok,true);}const after=S.toShop(await profile('friend'));assert.equal(after.wallet.coins,before.wallet.coins);assert.deepEqual(after.owned.commentStyles,before.owned.commentStyles); });
    await check('mutual_friend_and_locked_board_rules_preserved', async () => { assert.equal((await G.postLauncherComment(pool,'stranger',1,'你好')).error,'not friends');assert.equal((await G.postLauncherComment(pool,'one-sided',1,'你好')).error,'not friends');assert.equal((await G.postLauncherComment(pool,'friend',6,'你好')).error,'guestbook_locked'); });
    await check('body_limits_preserved', async () => { assert.equal((await G.postLauncherComment(pool,'friend',1,' ')).error,'invalid_body');assert.equal((await G.postLauncherComment(pool,'friend',1,'字'.repeat(281))).error,'invalid_body'); });
    await check('stranger_moderation_denied', async () => { assert.equal((await G.deleteLauncherComment(pool,'stranger',explicitId)).error,'not_found_or_forbidden'); });
    await check('author_delete_and_replay_cannot_resurrect', async () => { assert.equal((await G.deleteLauncherComment(pool,'friend',explicitId)).ok,true);assert.equal((await B.commandLauncherProfile(pool,'friend',explicit,capability)).error,'comment_deleted'); });
    await check('owner_can_delete_friend_comment', async () => { const row=(await G.getLauncherComments(pool,'owner')).comments.find(x=>x.authorUserId===2);assert.equal((await G.deleteLauncherComment(pool,'owner',row.id)).ok,true); });
    await check('new_avatar_buy_equip_public_profile_comment_and_card', async () => {
      assert.equal((await buy('friend','ava-122')).ok,true);const r=await equip('friend','ava-122');assert.equal(r.profile.avatar,122);assert.equal(r.shop.equipped.avatar,122);assert.ok(r.profile.collection.card.avatars.includes(122));
      const card=await invoke('friend',{operation:'card.set',card:{displayName:'羅賓迷',tagline:'一起航海',avatarId:122}});assert.equal(card.profile.card.avatarId,122);
      await ageComments();const post=await G.postLauncherComment(pool,'friend',1,'新頭貼');assert.equal(post.comment.authorAvatar,122);assert.equal((await G.getLauncherComments(pool,'owner')).comments[0].authorAvatar,122);
      assert.equal(S.toCardPublicProfile(await profile('friend')).avatar,122);
    });
    await check('unowned_and_out_of_range_avatar_rejected', async () => { assert.equal((await equip('friend','ava-91')).error,'not_owned');assert.equal((await buy('friend','ava-223')).error,'invalid_profile_command');assert.equal((await invoke('friend',{operation:'card.set',card:{displayName:'x',tagline:'',avatarId:91}})).error,'not_owned'); });
    await check('all_30_new_avatars_buy_equip_and_card_set', async () => {
      await db.query('INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES(7,$1,$1,$2,$3::jsonb)',['avatar-buyer','8',JSON.stringify({launcherWalletV1:{coins:500,lastGrantDay:today}})]);
      assert.ok(avatars.reduce((sum,item)=>sum+item.price,0)<=500);
      for(const item of avatars){assert.equal((await buy('avatar-buyer',item.id)).ok,true);const r=await equip('avatar-buyer',item.id);assert.equal(r.profile.avatar,item.key);assert.equal((await invoke('avatar-buyer',{operation:'card.set',card:{displayName:'新頭貼',tagline:'',avatarId:item.key}})).profile.card.avatarId,item.key);}
    });
    await check('old_appearance_and_avatar_remain_compatible', () => {const r=S.toPublicProfile({user_id:7,name:'old',avatar:31,stats:{launcherOwnedV1:{items:['guestbook-1']},launcherAppearanceV1:{layoutId:'layout-default'},client:{shop:{ownedAvatars:[31]}}}});assert.equal(r.avatar,31);assert.equal(r.guestbookUnlocked,true);assert.equal(r.appearance.commentStyleId,S.DEFAULT_COMMENT_STYLE.id);});
    await check('private_existing_data_and_currency_preserved', async () => {const row=await profile('friend');assert.equal(row.stats.client.totals.coins,77);assert.equal(row.stats.launcherLifeV1.keep,'original');assert.equal(row.stats.custom,'preserved');assert.equal((await db.query("SELECT to_regclass('launcher_life_state') relation")).rows[0].relation,null);});
    await check('all_330_catalog_items_remain_in_public_collection', () => {const items=S.CATALOG.filter(x=>!['wall','flag'].includes(x.type)).map(x=>x.id);const r=S.toPublicProfile({user_id:1,name:'all',avatar:8,stats:{launcherOwnedV1:{items}}});assert.equal(r.collection.launcher.items.length,r.collection.launcher.itemIds.length);assert.ok(r.collection.launcher.items.length>150);});
    await check('bridge_requires_secret', async () => {assert.equal((await buy('',boards[0].id)).error,'bad secret');assert.equal((await buy('wrong',boards[0].id)).error,'bad secret');});
    await check('bridge_exact_fields_and_operation_allowlist', () => {
      const base=command({operation:'shop.buy',itemId:boards[0].id});
      for(const c of [{...base,extra:true},{...base,type:'minigame.answer'},{...base,requestId:'bad'},{...base,expectedRevision:-1},{...base,payload:{...base.payload,extra:true}},{...base,payload:{...base.payload,operation:'wallet.add'}},{...base,payload:{...base.payload,itemId:'room-character-luffy'}},{...base,payload:{...base.payload,itemId:'ava-31'}}])assert.equal(B.validCommand(c),false);
    });
    await check('bridge_rejects_oversized_payload_and_card_extra_fields', () => {assert.equal(B.validCommand(command({operation:'card.set',card:{displayName:'x',tagline:'x'.repeat(2100),avatarId:0}})),false);assert.equal(B.validCommand(command({operation:'card.set',card:{displayName:'x',tagline:'',avatarId:0,coins:99}})),false);});
    await check('preview_includes_styles_without_private_account', async () => {const r=await S.getLauncherShop(pool,'',true,capability);assert.equal(r.shop.catalog.filter(x=>x.type==='comment_style').length,20);assert.deepEqual(r.shop.owned.guestbookStyles,[]);assert.equal(r.shop.equipped.commentStyleId,S.DEFAULT_COMMENT_STYLE.id);});
    await check('social_avatars_only_current_social_graph_and_no_private_fields', async () => {const r=await invoke('owner',{operation:'social.avatars'});assert.deepEqual(r.avatars,[{userId:2,avatar:122}]);assert.deepEqual(Object.keys(r.avatars[0]).sort(),['avatar','userId']);assert.equal((await invoke('stranger',{operation:'social.avatars'})).avatars.length,0);});
    await check('social_avatars_incoming_and_outgoing_requests_supported', async () => {await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social}',$1::jsonb) WHERE secret='board-owner'",[JSON.stringify({friends:[2],friend_in:[3],friend_out:[4]})]);const r=await invoke('board-owner',{operation:'social.avatars'});assert.deepEqual(r.avatars.map(x=>x.userId).sort(),[2,3,4]);});
    await check('social_avatars_reject_anonymous_bad_secret_and_caller_ids', async () => {assert.equal((await invoke('',{operation:'social.avatars'})).error,'bad secret');assert.equal((await invoke('bad',{operation:'social.avatars'})).error,'bad secret');assert.equal((await invoke('owner',{operation:'social.avatars',userIds:[7]})).error,'invalid_profile_command');});
    await check('social_avatars_at_most_200_per_section_no_self_or_duplicates', async () => {
      const graph={friends:[1,2,2,...Array.from({length:300},(_,i)=>i+100)],friend_in:Array.from({length:300},(_,i)=>i+500),friend_out:Array.from({length:300},(_,i)=>i+900)};
      await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social}',$1::jsonb) WHERE secret='owner'",[JSON.stringify(graph)]);
      let requested=[];const observed={query:async(sql,args)=>{if(sql.includes('ANY($1::bigint[])'))requested=args[0];return db.query(sql,args);}};
      const r=await B.commandLauncherProfile(observed,'owner',command({operation:'social.avatars'}),capability);assert.equal(r.ok,true);assert.ok(requested.length<=600);assert.equal(requested.length,new Set(requested).size);assert.ok(!requested.includes(1));assert.ok(!requested.includes(900+200));
      await db.query("UPDATE player_profiles SET stats=jsonb_set(stats,'{client,social}',$1::jsonb) WHERE secret='owner'",[JSON.stringify({friends:[2]})]);
    });

    // Load the unchanged core module with Electron stubbed. Execute its actual
    // commandLauncherLife method through the real index route into production SQL.
    const authPath=path.join(__dirname,'../desktop/auth-service.js');
    const moduleObject={exports:{}};
    const localRequire=createRequire(authPath);
    vm.runInNewContext(fs.readFileSync(authPath,'utf8'),{module:moduleObject,exports:moduleObject.exports,require:id=>id==='electron'?{safeStorage:{}}:id==='socket.io-client'?{io(){throw new Error('Network disabled in isolated QA');}}:localRequire(id),console,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,process},{filename:authPath});
    const indexSource=fs.readFileSync(path.join(__dirname,'../server/index.js'),'utf8');
    const start=indexSource.indexOf("socket.on('LAUNCHER_LIFE_COMMAND'");
    const end=indexSource.indexOf('\n});',start)+'\n});'.length;
    let route,lifeCalls=0;
    vm.runInNewContext(indexSource.slice(start,end),{socket:{on:(name,fn)=>{route=fn;}},pool,launcherProfileCommand:B,launcherLife:{commandLauncherLife:async()=>{lifeCalls++;return{ok:true,ordinaryLife:true};}},console,getProfileBySecret:profile,emitToUser(){}});
    const auth=Object.create(moduleObject.exports.AuthService.prototype);
    const transport=[];
    auth.launcherRequest=async(event,payload)=>{transport.push({event,payload});return new Promise(resolve=>route({secret:'friend',crewContentRevision:1,...payload},resolve));};
    await check('unchanged_core_transports_new_style_equip_into_real_server_sql', async () => {const r=await auth.commandLauncherLife(command({operation:'shop.equip',itemId:notes[4].id}));assert.equal(r.ok,true);assert.equal(r.shop.equipped.commentStyleId,notes[4].id);assert.equal(lifeCalls,0);assert.equal(transport.at(-1).event,'LAUNCHER_LIFE_COMMAND');});
    await check('unchanged_core_transports_new_avatar_card', async () => {const r=await auth.commandLauncherLife(command({operation:'card.set',card:{displayName:'考古航海者',tagline:'出航',avatarId:122}}));assert.equal(r.profile.card.avatarId,122);assert.equal(lifeCalls,0);});
    await check('unchanged_core_transports_styled_comment_with_dedupe', async () => {await ageComments();const c=command({operation:'comment.post',userId:1,body:'核心相容留言',styleId:notes[4].id});const one=await auth.commandLauncherLife(c),two=await auth.commandLauncherLife(c);assert.equal(one.ok,true);assert.equal(two.comment.id,one.comment.id);assert.equal(two.duplicate,true);assert.equal(lifeCalls,0);});
    await check('ordinary_life_commands_still_route_to_life_engine', async () => {const r=await auth.commandLauncherLife({requestId:'ordinary-life-command',expectedRevision:0,type:'checkpoint',payload:{}});assert.equal(r.ordinaryLife,true);assert.equal(lifeCalls,1);});
    await check('new_protocol_bad_type_rejected_before_life_engine', async () => {const c=command({operation:'shop.buy',itemId:boards[0].id});c.type='minigame.answer';const r=await auth.commandLauncherLife(c);assert.equal(r.error,'invalid_profile_command');assert.equal(lifeCalls,1);});
    await check('unchanged_core_social_avatar_projection_bypasses_lossy_person_filter', async () => {const r=await auth.commandLauncherLife(command({operation:'social.avatars'}));assert.equal(r.ok,true);assert.ok(r.avatars.some(x=>x.userId===1));assert.equal(lifeCalls,1);});
    const report={status:'PASS',checks:checks.length,passed:checks,scope:'Isolated PGlite SQL; existing AuthService method and index route exercised. No formal player account transactions.',catalog:{boards:boards.length,notes:notes.length,avatars:avatars.length}};
    const out=process.env.LAUNCHER_GUESTBOOK_STYLES_QA_OUT||'D:/Codex_QA/launcher-shop-r58/backend-report.json';
    fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  } finally {await db.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
