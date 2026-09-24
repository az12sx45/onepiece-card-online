'use strict';

const assert = require('node:assert/strict');
const { PGlite } = require(process.env.BOARD_QA_PGLITE || 'D:/Codex_QA/draw-result-art-20260922/deps/node_modules/@electric-sql/pglite');
const { changeLauncherItem } = require('../server/launcher-profile-shop');
const { getLauncherComments, postLauncherComment, deleteLauncherComment } = require('../server/launcher-guestbook');

const db = new PGlite();
const pool = { query: (...args) => db.query(...args), async connect() { return { query: (...args) => db.query(...args), release() {} }; } };
const addProfile = async (id, secret, name, stats) => db.query(
  'INSERT INTO player_profiles(user_id,secret,name,avatar,stats) VALUES($1,$2,$3,$4,$5::jsonb)',
  [id, secret, name, '8', JSON.stringify(stats)]
);

(async () => {
  try {
    await db.exec(`CREATE TABLE player_profiles (
      user_id BIGINT PRIMARY KEY, secret TEXT UNIQUE NOT NULL, name TEXT, avatar TEXT,
      stats JSONB, updated_at TIMESTAMPTZ DEFAULT now()
    )`);
    await addProfile(1, 'owner', '頁主', { launcherOwnedV1: { items: ['guestbook-1'] }, client: { social: { friends: [2] } } });
    await addProfile(2, 'friend', '好友', { client: { social: { friends: [1, 5] } } });
    await addProfile(3, 'stranger', '陌生人', { client: { social: { friends: [] } } });
    await addProfile(4, 'one-sided', '單向好友', { client: { social: { friends: [1] } } });
    await addProfile(5, 'locked', '未解鎖', { client: { totals: { coins: 15 }, social: { friends: [2] } } });

    assert.equal((await getLauncherComments(pool, 'friend', 1)).ok, true);
    assert.equal((await getLauncherComments(pool, 'friend', 5)).error, 'guestbook_locked');
    assert.equal((await postLauncherComment(pool, 'friend', 5, '你好')).error, 'guestbook_locked');
    assert.equal((await getLauncherComments(pool, 'stranger', 1)).error, 'not friends');
    assert.equal((await getLauncherComments(pool, 'one-sided', 1)).error, 'not friends');
    assert.equal((await postLauncherComment(pool, 'one-sided', 1, '偽造單向好友')).error, 'not friends');
    assert.equal((await postLauncherComment(pool, 'friend', 1, ' ')).error, 'invalid_body');
    assert.equal((await postLauncherComment(pool, 'friend', 1, '字'.repeat(281))).error, 'invalid_body');

    const first = await postLauncherComment(pool, 'friend', 1, '  一起出航！\r\n期待見面  ');
    assert.equal(first.ok, true);
    assert.equal(first.comment.body, '一起出航！\n期待見面');
    assert.equal(first.comment.authorUserId, 2);
    assert.equal(first.comment.authorName, '好友');
    assert.ok(first.comment.createdAt > 0);
    assert.equal((await postLauncherComment(pool, 'friend', 1, '連續發文')).error, 'rate_limited');
    const listed = await getLauncherComments(pool, 'owner', 0);
    assert.equal(listed.comments[0].id, first.comment.id);
    assert.ok(!JSON.stringify(listed).includes('"secret"'));
    assert.ok(!JSON.stringify(listed).includes('"stats"'));
    assert.equal((await deleteLauncherComment(pool, 'stranger', first.comment.id)).error, 'not_found_or_forbidden');

    await db.query("UPDATE launcher_profile_comments SET created_at=now()-INTERVAL '31 seconds' WHERE id=$1", [first.comment.id]);
    const second = await postLauncherComment(pool, 'friend', 1, '第二則');
    assert.equal(second.ok, true);
    assert.equal((await deleteLauncherComment(pool, 'friend', second.comment.id)).ok, true);
    assert.equal((await deleteLauncherComment(pool, 'owner', first.comment.id)).ok, true);
    assert.equal((await getLauncherComments(pool, 'owner', 0)).comments.length, 0);
    assert.equal((await postLauncherComment(pool, 'friend', 1, '刪除後偷渡')).error, 'rate_limited');
    await db.query(`INSERT INTO launcher_profile_comments(owner_user_id,author_user_id,body,created_at)
      SELECT 1,2,'歷史留言 '||n,now()-INTERVAL '2 minutes' FROM generate_series(1,40) AS n`);
    assert.equal((await postLauncherComment(pool, 'friend', 1, '超過每日上限')).error, 'rate_limited');
    const firstPage = await getLauncherComments(pool, 'owner', 0);
    assert.equal(firstPage.comments.length, 30);
    assert.equal(firstPage.hasMore, true);
    const secondPage = await getLauncherComments(pool, 'owner', 0, firstPage.nextBeforeId);
    assert.equal(secondPage.comments.length, 10);
    assert.equal(secondPage.hasMore, false);
    assert.ok(!secondPage.comments.some(comment => firstPage.comments.some(newer => newer.id === comment.id)));

    const unlocked = await changeLauncherItem(pool, 'locked', 'guestbook-1', 'buy');
    assert.equal(unlocked.ok, true);
    assert.equal(unlocked.profile.guestbookUnlocked, true);
    assert.equal((await getLauncherComments(pool, 'friend', 5)).ok, true);
    assert.equal((await postLauncherComment(pool, 'wrong', 1, '無效登入')).error, 'bad secret');

    console.log('launcher guestbook: purchase gate, mutual friendship, moderation, body limits, rate limit passed (PGlite)');
  } finally {
    await db.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
