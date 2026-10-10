'use strict';

// Versioned profile subprotocol on the already authenticated desktop transport.
// It is dispatched before the life engine and never records a life event or
// changes a life revision. The old core's item/card allowlists stay unchanged.
const shop = require('./launcher-profile-shop');
const guestbook = require('./launcher-guestbook');
const SCOPE = 'launcher-profile-v1';
const object = value => value && typeof value === 'object' && !Array.isArray(value);
const exact = (value, required, optional = []) => object(value) &&
  required.every(key => Object.prototype.hasOwnProperty.call(value, key)) &&
  Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const isProfileCommand = command => object(command?.payload) && command.payload.scope === SCOPE;
const allowedItem = id => typeof id === 'string' &&
  (id === shop.DEFAULT_GUESTBOOK_STYLE.id || id === shop.DEFAULT_COMMENT_STYLE.id ||
   shop.CATALOG.some(item => item.id === id &&
     (['guestbook_style', 'comment_style'].includes(item.type) || item.type === 'avatar' && item.key >= 63 && item.key <= shop.LAUNCHER_AVATAR_MAX)));

function validCommand(command) {
  if (!exact(command, ['requestId', 'expectedRevision', 'type', 'payload']) ||
      typeof command.requestId !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(command.requestId) ||
      !Number.isSafeInteger(command.expectedRevision) || command.expectedRevision < 0 ||
      command.type !== 'event.record' || !isProfileCommand(command)) return false;
  const p = command.payload;
  try { if (JSON.stringify(p).length > 2048) return false; } catch (_) { return false; }
  if (p.operation === 'shop.buy' || p.operation === 'shop.equip') {
    return exact(p, ['scope', 'operation', 'itemId']) && allowedItem(p.itemId);
  }
  if (p.operation === 'card.set') {
    return exact(p, ['scope', 'operation', 'card']) && exact(p.card, ['displayName', 'tagline', 'avatarId']);
  }
  if (p.operation === 'comment.post') {
    return exact(p, ['scope', 'operation', 'userId', 'body'], ['styleId']) &&
      Number.isSafeInteger(p.userId) && p.userId >= 0 && typeof p.body === 'string' && p.body.length <= 280 &&
      (p.styleId === undefined || typeof p.styleId === 'string' && !!shop.commentStyleById(p.styleId));
  }
  if (p.operation === 'social.avatars') return exact(p, ['scope', 'operation']);
  return false;
}

async function socialAvatars(pool, secret) {
  const found = await pool.query('SELECT user_id, stats FROM player_profiles WHERE secret=$1 LIMIT 1', [secret]);
  const me = found.rows[0];
  if (!me) return { ok: false, error: 'bad secret' };
  const social = me.stats?.client?.social;
  // Match the desktop's 200 entries per social section. The caller supplies no
  // user IDs; only its existing graph can authorize this compact projection.
  const ids = [...new Set(['friends', 'friend_in', 'friend_out'].flatMap(key =>
    (Array.isArray(social?.[key]) ? social[key] : []).slice(0, 200)
      .map(Number).filter(id => Number.isSafeInteger(id) && id > 0 && id !== Number(me.user_id))))];
  if (!ids.length) return { ok: true, avatars: [] };
  const rows = await pool.query(`SELECT user_id, avatar,
    jsonb_build_object('launcherOwnedV1', stats->'launcherOwnedV1', 'launcherAppearanceV1', stats->'launcherAppearanceV1') AS stats
    FROM player_profiles WHERE user_id = ANY($1::bigint[])`, [ids]);
  return { ok: true, avatars: rows.rows.map(row => ({ userId: Number(row.user_id), avatar: shop.launcherAvatarForRow(row) })) };
}

async function commandLauncherProfile(pool, secret, command, capability) {
  if (typeof secret !== 'string' || !secret.trim()) return { ok: false, error: 'bad secret' };
  if (!validCommand(command)) return { ok: false, error: 'invalid_profile_command' };
  const p = command.payload;
  let result;
  if (p.operation === 'shop.buy' || p.operation === 'shop.equip') {
    result = await shop.changeLauncherItem(pool, secret, p.itemId, p.operation === 'shop.buy' ? 'buy' : 'equip', capability);
  } else if (p.operation === 'card.set') {
    result = await shop.setLauncherCard(pool, secret, p.card, capability);
  } else if (p.operation === 'social.avatars') {
    result = await socialAvatars(pool, secret);
  } else {
    result = await guestbook.postLauncherComment(pool, secret, p.userId, p.body, p.styleId, command.requestId);
  }
  return { ...result, profileCommand: { version: 1, requestId: command.requestId, operation: p.operation } };
}

module.exports = { SCOPE, isProfileCommand, validCommand, commandLauncherProfile };
