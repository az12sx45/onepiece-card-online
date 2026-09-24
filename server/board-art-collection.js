'use strict';

const { normalizeCollection } = require('../public/js/board_adventure_art');
const FIELD = 'boardArtCollectionV1';

function sanitizeProfileStats(stats) {
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) return stats ?? {};
  if (!Object.prototype.hasOwnProperty.call(stats, FIELD)) return stats;
  return { ...stats, [FIELD]: normalizeCollection(stats[FIELD]) };
}

const objectSql = expression => `CASE WHEN jsonb_typeof(${expression}) = 'object' THEN ${expression} ELSE '{}'::jsonb END`;
const arraySql = expression => `CASE WHEN jsonb_typeof(${expression}) = 'array' THEN ${expression} ELSE '[]'::jsonb END`;
const shopOwnershipSql = key => `COALESCE((
  SELECT jsonb_agg(DISTINCT item)
  FROM (
    SELECT value AS item FROM jsonb_array_elements(${arraySql(`player_profiles.stats #> '{client,shop,${key}}'`)})
    UNION ALL
    SELECT value AS item FROM jsonb_array_elements(${arraySql(`$4::jsonb #> '{client,shop,${key}}'`)})
  ) AS owned
), '[]'::jsonb)`;
const currentShopSql = objectSql("player_profiles.stats #> '{client,shop}'");
const incomingShopSql = objectSql("$4::jsonb #> '{client,shop}'");
// Friendship changes go through authenticated server events. A Card game-end
// snapshot may contain older social arrays and must not undo those changes.
const currentSocialSql = objectSql("player_profiles.stats #> '{client,social}'");
const mergedShopSql = `(${currentShopSql} || ${incomingShopSql} || jsonb_build_object(
  'ownedAvatars', ${shopOwnershipSql('ownedAvatars')},
  'ownedWalls', ${shopOwnershipSql('ownedWalls')},
  'ownedFlags', ${shopOwnershipSql('ownedFlags')},
  'ownedItems', ${shopOwnershipSql('ownedItems')}
))`;
const patchedClientSql = `CASE WHEN jsonb_typeof($4::jsonb->'client') = 'object'
  THEN $4::jsonb->'client' ELSE ${objectSql("player_profiles.stats->'client'")} END`;
const shopPreservingStatsSql = `CASE
  WHEN $4::jsonb ? 'client' THEN jsonb_set(
    ${objectSql('player_profiles.stats')} || $4::jsonb,
    '{client}',
    (${patchedClientSql} || jsonb_build_object('shop', ${mergedShopSql}, 'social', ${currentSocialSql})),
    true
  )
  ELSE ${objectSql('player_profiles.stats')} || $4::jsonb
END`;

// Evaluated inside the profile UPSERT under its row lock. Board pictures keep
// their earliest encounter, and additive shop ownership survives stale Card
// profile snapshots. Legacy coin values still follow the existing client patch.
const PROFILE_STATS_SQL = `CASE
  WHEN $4::jsonb IS NULL THEN player_profiles.stats
  ELSE (${shopPreservingStatsSql})
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
