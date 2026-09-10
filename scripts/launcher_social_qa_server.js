'use strict';
// Isolated database fixture; the actual application Socket.IO handlers run unchanged.
const path = require('node:path');
const bcrypt = require('bcryptjs');
const profiles = new Map(); const users = new Map(); const messages = [];
let nextUser = 100, nextMessage = 1;
for (const [id, username, name, friends] of [[43, 'qa_new', '', [44]], [44, 'qa_friend', '海上信差', [43]], [45, 'qa_other', '第三位好友', []]]) {
  users.set(username, { id, username, password_hash: bcrypt.hashSync('qa-social-pass', 8) });
  profiles.set(id, { user_id: id, secret: `qa-social-${id}`, name, avatar: 8, stats: { client: { social: { friends, friend_in: [], friend_out: [] }, totals: { coins: 1234 } } } });
}
const clone = value => JSON.parse(JSON.stringify(value));
const result = rows => ({ rows: clone(rows), rowCount: rows.length });
const pool = { async query(sql, params = []) {
  const s = String(sql).replace(/\s+/g, ' ').trim().toLowerCase();
  if (/^(create|alter)/.test(s)) return result([]);
  if (s === 'select now() as now') return result([{ now: new Date().toISOString() }]);
  if (s.includes('from users where username=$1')) return result(users.has(params[0]) ? [users.get(params[0])] : []);
  if (s.startsWith('insert into users')) { const user = { id: nextUser++, username: params[0], password_hash: params[1] }; users.set(user.username, user); return result([user]); }
  if (s.startsWith('insert into player_profiles') && s.includes('on conflict (secret)')) {
    const p = [...profiles.values()].find(p => p.secret === params[0]);
    if (!p) throw Error('fixture profile missing');
    if (params[1] !== null) p.name = params[1]; if (params[2] !== null) p.avatar = params[2];
    return result([p]);
  }
  if (s.startsWith('insert into player_profiles')) { profiles.set(Number(params[1]), { user_id: Number(params[1]), secret: params[0], name: '', avatar: '', stats: {} }); return result([]); }
  if (s.startsWith('select 1 from player_profiles')) return result([...profiles.values()].filter(p => p.secret !== params[0] && p.name.trim().toLowerCase() === String(params[1]).trim().toLowerCase()).map(() => ({ exists: 1 })));
  if (s.includes('from player_profiles where secret=$1')) { const p = [...profiles.values()].find(p => p.secret === params[0]); return result(p ? [p] : []); }
  if (s.includes('from player_profiles where user_id = any')) return result(params[0].map(id => profiles.get(Number(id))).filter(Boolean));
  if (/from player_profiles where user_id\s*=\s*\$1/.test(s)) { const p = profiles.get(Number(params[0])); if (!p) return result([]); if (s.startsWith('select secret')) return result([{ secret: p.secret }]); const { secret, ...publicFields } = p; return result([publicFields]); }
  if (s.includes('from player_profiles where lower(btrim(name))')) return result([...profiles.values()].filter(p => p.name.toLowerCase() === String(params[0]).trim().toLowerCase()).slice(0, 1));
  if (s.startsWith('update player_profiles set stats=$1 where user_id=$2')) { profiles.get(Number(params[1])).stats = clone(params[0]); return result([]); }
  if (s.startsWith('insert into dm_messages')) { const m = { id: nextMessage++, a_id: params[0], b_id: params[1], from_id: params[2], body: params[3], created_at: params[4] }; messages.push(m); return result([{ id: m.id }]); }
  if (s.startsWith('select') && s.includes('from dm_messages')) return result(messages.filter(m => m.a_id === params[0] && m.b_id === params[1]).sort((a, b) => b.created_at - a.created_at).slice(0, params[2]));
  if (s.includes('from board_')) return result([]);
  return result([]);
} };
const dbPath = require.resolve(path.join(__dirname, '..', 'server', 'db.js'));
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: { pool } };
process.env.DATABASE_URL = 'postgresql://launcher-social-qa.invalid/mock';
process.env.PORT = process.env.PORT || '18894';
require('../server/index');
