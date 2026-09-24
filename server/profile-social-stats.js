'use strict';

// Social handlers begin from a profile snapshot. Update only the social
// branch so a concurrent shop purchase, launcher wallet, or game reward cannot
// be replaced by that older whole-profile snapshot.
const PROFILE_SOCIAL_STATS_SQL = `UPDATE player_profiles SET stats =
  (CASE WHEN jsonb_typeof(stats) = 'object' THEN stats ELSE '{}'::jsonb END) || jsonb_build_object('client',
    (CASE WHEN jsonb_typeof(stats->'client') = 'object' THEN stats->'client' ELSE '{}'::jsonb END)
      || jsonb_build_object('social', $1::jsonb))
  WHERE user_id = $2`;

async function updateProfileSocial(pool, userId, social) {
  return pool.query(PROFILE_SOCIAL_STATS_SQL, [JSON.stringify(social), userId]);
}

module.exports = { PROFILE_SOCIAL_STATS_SQL, updateProfileSocial };
