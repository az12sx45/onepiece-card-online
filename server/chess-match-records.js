"use strict";

// A room may be played against another account or a server-created CPU. Only
// authenticated humans have a profile row and receive account statistics.
function completedChessMatch(room) {
  if (!room?.matchId || room.status !== "ended" || !room?.chess
    || !room.chess.isGameOver?.() || !(room.moveSequence > 0)) return null;
  const seats = Array.isArray(room.matchParticipants) ? room.matchParticipants : [];
  if (seats.length !== 2 || !["w", "b"].every((color) => seats.some((seat) => seat.color === color))) return null;
  const white = seats.find((seat) => seat.color === "w");
  const black = seats.find((seat) => seat.color === "b");
  if (!white || !black) return null;
  const userId = (seat) => {
    if (seat.isCPU) return null;
    const id = Number(seat.userId);
    return Number.isSafeInteger(id) && id > 0 ? id : 0;
  };
  const whiteUserId = userId(white);
  const blackUserId = userId(black);
  if (whiteUserId === 0 || blackUserId === 0 || (!whiteUserId && !blackUserId)
    || (whiteUserId && whiteUserId === blackUserId)) return null;
  let result;
  if (room.chess.isCheckmate?.()) result = room.chess.turn() === "w" ? "black" : "white";
  else if (room.chess.isDraw?.()) result = "draw";
  else return null;
  return {
    matchId: String(room.matchId),
    roomCode: String(room.roomCode || ""),
    whiteUserId,
    blackUserId,
    result,
    endedAt: Number(room.updatedAt) || Date.now(),
    moves: Math.max(1, Number(room.moveSequence) || 1),
  };
}

const TABLE_SQL = `CREATE TABLE IF NOT EXISTS launcher_chess_matches (
  match_id UUID PRIMARY KEY,
  room_code TEXT NOT NULL,
  white_user_id INTEGER,
  black_user_id INTEGER,
  result TEXT NOT NULL CHECK (result IN ('white', 'black', 'draw')),
  ended_at BIGINT NOT NULL,
  moves INTEGER NOT NULL,
  CHECK (white_user_id IS NOT NULL OR black_user_id IS NOT NULL)
)`;

function counter(name) {
  const value = `(p.stats #>> '{launcherChessV1,${name}}')`;
  return `(CASE WHEN ${value} ~ '^[0-9]{1,9}$' THEN ${value}::integer ELSE 0 END)`;
}

// The ledger insert and both profile increments are one PostgreSQL statement.
// A repeated terminal event gets zero rows from recorded, so it cannot count
// the same match twice. Profile existence is checked before inserting it.
const RECORD_SQL = `WITH recorded AS (
  INSERT INTO launcher_chess_matches
    (match_id, room_code, white_user_id, black_user_id, result, ended_at, moves)
  SELECT $1::uuid, $2::text, $3::integer, $4::integer, $5::text, $6::bigint, $7::integer
  WHERE ($3::integer IS NULL OR EXISTS (SELECT 1 FROM player_profiles WHERE user_id = $3::integer))
    AND ($4::integer IS NULL OR EXISTS (SELECT 1 FROM player_profiles WHERE user_id = $4::integer))
  ON CONFLICT (match_id) DO NOTHING
  RETURNING white_user_id, black_user_id, result
), verdicts AS (
  SELECT white_user_id AS user_id,
    CASE result WHEN 'white' THEN 'win' WHEN 'black' THEN 'loss' ELSE 'draw' END AS verdict
  FROM recorded WHERE white_user_id IS NOT NULL
  UNION ALL
  SELECT black_user_id AS user_id,
    CASE result WHEN 'black' THEN 'win' WHEN 'white' THEN 'loss' ELSE 'draw' END AS verdict
  FROM recorded WHERE black_user_id IS NOT NULL
), updated AS (
  UPDATE player_profiles AS p
  SET stats = jsonb_set(
    CASE WHEN jsonb_typeof(p.stats) = 'object' THEN p.stats ELSE '{}'::jsonb END,
    '{launcherChessV1}',
    jsonb_build_object(
      'games', ${counter("games")} + 1,
      'wins', ${counter("wins")} + CASE WHEN v.verdict = 'win' THEN 1 ELSE 0 END,
      'draws', ${counter("draws")} + CASE WHEN v.verdict = 'draw' THEN 1 ELSE 0 END,
      'losses', ${counter("losses")} + CASE WHEN v.verdict = 'loss' THEN 1 ELSE 0 END
    ), true),
    updated_at = now()
  FROM verdicts AS v WHERE p.user_id = v.user_id
  RETURNING p.user_id
)
SELECT (SELECT COUNT(*) FROM recorded)::integer AS recorded,
       (SELECT COUNT(*) FROM updated)::integer AS updated`;

let initPromise;
async function recordCompletedChessMatch(pool, match) {
  if (!initPromise) initPromise = pool.query(TABLE_SQL).catch((error) => { initPromise = null; throw error; });
  await initPromise;
  const params = [match.matchId, match.roomCode, match.whiteUserId, match.blackUserId,
    match.result, match.endedAt, match.moves];
  const response = await pool.query(RECORD_SQL, params);
  const recorded = Number(response.rows?.[0]?.recorded || 0);
  const updated = Number(response.rows?.[0]?.updated || 0);
  const expected = Number(Boolean(match.whiteUserId)) + Number(Boolean(match.blackUserId));
  if (recorded && updated !== expected) throw new Error("chess_match_profile_count_mismatch");
  return { recorded: recorded === 1, updated };
}

// PROFILE_UPDATE remains for legacy card/profile data. Account chess results
// are written only by the server after a verified terminal board position.
function sanitizeChessStatsPatch(stats) {
  if (!stats || typeof stats !== "object" || Array.isArray(stats)) return {};
  if (!Object.prototype.hasOwnProperty.call(stats, "launcherChessV1")) return stats;
  const { launcherChessV1: _ignored, ...safe } = stats;
  return safe;
}

module.exports = { completedChessMatch, recordCompletedChessMatch, sanitizeChessStatsPatch };
