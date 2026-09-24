'use strict';

const { guestbookUnlocked } = require('./launcher-profile-shop');

const readyByPool = new WeakMap();
const object = value => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const friendIds = row => new Set((Array.isArray(object(object(object(row.stats).client).social).friends)
  ? row.stats.client.social.friends : []).map(Number).filter(Number.isSafeInteger));

async function ensureGuestbookTable(pool) {
  let ready = readyByPool.get(pool);
  if (!ready) {
    ready = (async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS launcher_profile_comments (
        id BIGSERIAL PRIMARY KEY,
        owner_user_id BIGINT NOT NULL,
        author_user_id BIGINT NOT NULL,
        body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 280),
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        deleted_at TIMESTAMPTZ
      )`);
      await pool.query('ALTER TABLE launcher_profile_comments ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ');
      await pool.query('CREATE INDEX IF NOT EXISTS launcher_profile_comments_owner_idx ON launcher_profile_comments(owner_user_id, id DESC)');
      await pool.query('CREATE INDEX IF NOT EXISTS launcher_profile_comments_author_idx ON launcher_profile_comments(author_user_id, created_at DESC)');
    })().catch(error => { readyByPool.delete(pool); throw error; });
    readyByPool.set(pool, ready);
  }
  return ready;
}

async function accessProfile(db, secret, userId = 0, lockActor = false) {
  if (!secret) return { ok: false, error: 'bad secret' };
  const mine = await db.query(`SELECT user_id, name, avatar, stats FROM player_profiles WHERE secret=$1 ${lockActor ? 'FOR UPDATE' : 'LIMIT 1'}`, [secret]);
  const me = mine.rows[0];
  if (!me) return { ok: false, error: 'bad secret' };
  const requested = Number(userId);
  if (!Number.isSafeInteger(requested) || requested < 0) return { ok: false, error: 'bad userId' };
  const targetId = requested || Number(me.user_id);
  if (targetId === Number(me.user_id)) return { ok: true, me, target: me };
  if (!friendIds(me).has(targetId)) return { ok: false, error: 'not friends' };
  const other = await db.query('SELECT user_id, name, avatar, stats FROM player_profiles WHERE user_id=$1 LIMIT 1', [targetId]);
  const target = other.rows[0];
  if (!target) return { ok: false, error: 'not found' };
  if (!friendIds(target).has(Number(me.user_id))) return { ok: false, error: 'not friends' };
  return { ok: true, me, target };
}

const toComment = row => ({
  id: Number(row.id),
  authorUserId: Number(row.author_user_id),
  authorName: String(row.author_name || '').trim().slice(0, 40) || `玩家 ${row.author_user_id}（尚未取名）`,
  authorAvatar: Number.isSafeInteger(Number(row.author_avatar)) && Number(row.author_avatar) >= 1 && Number(row.author_avatar) <= 50 ? Number(row.author_avatar) : 1,
  body: String(row.body || ''),
  createdAt: Number(row.created_at_ms) || 0
});

async function getLauncherComments(pool, secret, userId = 0, beforeId = 0) {
  const access = await accessProfile(pool, secret, userId);
  if (!access.ok) return access;
  if (!guestbookUnlocked(object(access.target.stats))) return { ok: false, error: 'guestbook_locked' };
  const before = Number(beforeId);
  if (!Number.isSafeInteger(before) || before < 0) return { ok: false, error: 'bad beforeId' };
  await ensureGuestbookTable(pool);
  const result = await pool.query(`SELECT m.id, m.author_user_id, p.name AS author_name, p.avatar AS author_avatar,
      m.body, (EXTRACT(EPOCH FROM m.created_at) * 1000)::bigint AS created_at_ms
    FROM launcher_profile_comments m
    LEFT JOIN player_profiles p ON p.user_id=m.author_user_id
    WHERE m.owner_user_id=$1 AND m.deleted_at IS NULL AND ($2::bigint=0 OR m.id<$2::bigint)
    ORDER BY m.id DESC LIMIT 31`, [access.target.user_id, before]);
  const hasMore = result.rows.length > 30;
  const comments = result.rows.slice(0, 30).map(toComment);
  return { ok: true, enabled: true, ownerUserId: Number(access.target.user_id), comments, hasMore,
    nextBeforeId: hasMore ? comments[comments.length - 1].id : null };
}

function normalizeBody(body) {
  if (typeof body !== 'string') return null;
  const clean = body.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').trim();
  return clean && clean.length <= 280 ? clean : null;
}

async function postLauncherComment(pool, secret, userId, body) {
  const clean = normalizeBody(body);
  if (!clean) return { ok: false, error: 'invalid_body' };
  await ensureGuestbookTable(pool);
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    const access = await accessProfile(db, secret, userId, true);
    if (!access.ok) { await db.query('ROLLBACK'); return access; }
    if (!guestbookUnlocked(object(access.target.stats))) { await db.query('ROLLBACK'); return { ok: false, error: 'guestbook_locked' }; }
    const limit = await db.query(`SELECT
      COUNT(*) FILTER (WHERE created_at > now() - INTERVAL '30 seconds')::int AS recent_count,
      COUNT(*)::int AS daily_count
      FROM launcher_profile_comments
      WHERE author_user_id=$1 AND created_at > now() - INTERVAL '24 hours'`, [access.me.user_id]);
    if (Number(limit.rows[0].recent_count) > 0 || Number(limit.rows[0].daily_count) >= 20) {
      await db.query('ROLLBACK');
      return { ok: false, error: 'rate_limited' };
    }
    const inserted = await db.query(`INSERT INTO launcher_profile_comments(owner_user_id, author_user_id, body)
      VALUES ($1, $2, $3) RETURNING id, author_user_id, body,
      (EXTRACT(EPOCH FROM created_at) * 1000)::bigint AS created_at_ms`,
    [access.target.user_id, access.me.user_id, clean]);
    await db.query('COMMIT');
    return { ok: true, comment: toComment({ ...inserted.rows[0], author_name: access.me.name, author_avatar: access.me.avatar }) };
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

async function deleteLauncherComment(pool, secret, messageId) {
  const id = Number(messageId);
  if (!Number.isSafeInteger(id) || id <= 0) return { ok: false, error: 'bad messageId' };
  const mine = await pool.query('SELECT user_id FROM player_profiles WHERE secret=$1 LIMIT 1', [secret]);
  if (!mine.rows[0]) return { ok: false, error: 'bad secret' };
  await ensureGuestbookTable(pool);
  const deleted = await pool.query(`UPDATE launcher_profile_comments SET deleted_at=now()
    WHERE id=$1 AND deleted_at IS NULL AND (author_user_id=$2 OR owner_user_id=$2) RETURNING id, owner_user_id`, [id, mine.rows[0].user_id]);
  return deleted.rows[0] ? { ok: true, messageId: id, ownerUserId: Number(deleted.rows[0].owner_user_id) } :
    { ok: false, error: 'not_found_or_forbidden' };
}

module.exports = { ensureGuestbookTable, getLauncherComments, postLauncherComment, deleteLauncherComment, normalizeBody };
