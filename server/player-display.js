'use strict';

// Keep login usernames private. Unnamed accounts complete onboarding in the
// launcher; public social surfaces use a neutral label until then.
async function withDisplayNames(pool, profiles) {
  return profiles.map(p => ({ ...p, name: String(p.name || '').trim() || `玩家 ${p.user_id}（尚未取名）` }));
}

module.exports = { withDisplayNames };
