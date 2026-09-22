'use strict';

const { normalizeCollection } = require('../public/js/board_adventure_art');
const FIELD = 'boardArtCollectionV1';

function sanitizeProfileStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return stats ?? {};
  if (!Object.prototype.hasOwnProperty.call(stats, FIELD)) return stats;
  return { ...stats, [FIELD]: normalizeCollection(stats[FIELD]) };
}

// Evaluated inside the profile UPSERT, under its row lock. Two clients adding
// different pictures cannot replace each other's collection. Other stats retain
// the existing top-level merge behavior. Existing first-seen times win on ties.
const PROFILE_STATS_SQL = `CASE
  WHEN $4::jsonb IS NULL THEN player_profiles.stats
  ELSE (COALESCE(player_profiles.stats, '{}'::jsonb) || $4::jsonb)
    || CASE WHEN $4::jsonb ? '${FIELD}' THEN
      jsonb_build_object('${FIELD}',
        COALESCE((SELECT jsonb_object_agg(picture_id, first_seen) FROM (
          SELECT picture_id, MIN((stamp #>> '{}')::bigint) AS first_seen
          FROM (
            SELECT key AS picture_id, value AS stamp FROM jsonb_each($4::jsonb->'${FIELD}')
            UNION ALL
            SELECT key AS picture_id, value AS stamp FROM jsonb_each(
              CASE WHEN jsonb_typeof(player_profiles.stats->'${FIELD}') = 'object'
                THEN player_profiles.stats->'${FIELD}' ELSE '{}'::jsonb END)
          ) AS encounters
          WHERE jsonb_typeof(stamp) = 'number' AND (stamp #>> '{}') ~ '^[0-9]{1,16}$'
          GROUP BY picture_id
        ) AS collection), '{}'::jsonb))
      ELSE '{}'::jsonb END
END`;

module.exports = { FIELD, sanitizeProfileStats, PROFILE_STATS_SQL };
