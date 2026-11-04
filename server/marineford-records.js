'use strict';
// Only terminal server-owned games reach this ledger. No client score payloads.
const crypto = require('node:crypto');
const FIELD = 'launcherMarinefordV1';
const KEYS = ['games','wins','losses','navyGames','navyWins','pirateGames','pirateWins','cpuGames'];
function summary(stats) {
  const s = stats?.[FIELD] || {}, result = { available: true, source: 'server-match-results' };
  for (const key of KEYS) result[key] = Number.isSafeInteger(s[key]) && s[key] >= 0 ? s[key] : 0;
  return result;
}
function completed(room) {
  const state = room?.state;
  if (!state || state.phase !== 'ended' || !['navy','pirate'].includes(state.winner) || state.revision < 1 || !room.matchId) return null;
  const humans = room.seats.flatMap((seat,id) => seat.cpu ? [] : [{user_id: seat.userId, team: state.players[id]?.team}]);
  if (!humans.length || humans.length > 6 || new Set(humans.map(p=>p.user_id)).size !== humans.length || humans.some(p=>!Number.isSafeInteger(p.user_id)||p.user_id<=0||!['navy','pirate'].includes(p.team))) return null;
  return {id:room.matchId,code:room.code,participants:humans,winner:state.winner,cpu:room.seats.some(p=>p.cpu),endedAt:room.touched,actions:state.revision};
}
const TABLE = `CREATE TABLE IF NOT EXISTS launcher_marineford_matches (
 match_id UUID PRIMARY KEY, room_code TEXT NOT NULL, participants JSONB NOT NULL,
 winner TEXT NOT NULL CHECK (winner IN ('navy','pirate')), has_cpu BOOLEAN NOT NULL,
 ended_at BIGINT NOT NULL, actions INTEGER NOT NULL)`;
const count = key => `(CASE WHEN (p.stats #>> '{${FIELD},${key}}') ~ '^[0-9]{1,9}$' THEN (p.stats #>> '{${FIELD},${key}}')::integer ELSE 0 END)`;
const increment = key => key==='games'?'1':key==='wins'?"CASE WHEN v.team=$4 THEN 1 ELSE 0 END":key==='losses'?"CASE WHEN v.team<>$4 THEN 1 ELSE 0 END":key==='cpuGames'?"CASE WHEN $5::boolean THEN 1 ELSE 0 END":`CASE WHEN v.team='${key.startsWith('navy')?'navy':'pirate'}'${key.endsWith('Wins')?' AND v.team=$4':''} THEN 1 ELSE 0 END`;
const RECORD = `WITH recorded AS (
 INSERT INTO launcher_marineford_matches(match_id,room_code,participants,winner,has_cpu,ended_at,actions)
 SELECT $1::uuid,$2::text,$3::jsonb,$4::text,$5::boolean,$6::bigint,$7::integer
 WHERE NOT EXISTS (SELECT 1 FROM jsonb_to_recordset($3::jsonb) AS x(user_id integer,team text)
   WHERE NOT EXISTS (SELECT 1 FROM player_profiles WHERE user_id=x.user_id))
 ON CONFLICT(match_id) DO NOTHING RETURNING participants
), verdicts AS (SELECT x.* FROM recorded, jsonb_to_recordset(participants) AS x(user_id integer,team text)),
 updated AS (UPDATE player_profiles p SET stats=jsonb_set(
 CASE WHEN jsonb_typeof(p.stats)='object' THEN p.stats ELSE '{}'::jsonb END,
 '{${FIELD}}',jsonb_build_object(${KEYS.map(k=>`'${k}',${count(k)}+(${increment(k)})`).join(',')}),true), updated_at=now()
 FROM verdicts v WHERE p.user_id=v.user_id RETURNING p.user_id)
 SELECT (SELECT count(*) FROM recorded)::integer recorded,(SELECT count(*) FROM updated)::integer updated`;
const SHOP_FIELD = 'marinefordCollectionV1';
const CATALOG = [
  {id:'justice',name:'海軍正義旗',description:'以海軍卡背裝飾你的戰績檔案與結算名牌。',price:30,art:'navy-back.webp'},
  {id:'rescue',name:'白鬍子救援旗',description:'以海賊卡背裝飾你的戰績檔案與結算名牌。',price:30,art:'pirate-back.webp'},
  {id:'scaffold',name:'處刑台戰役紀念章',description:'以馬林福特處刑台紀念這場決戰。',price:65,art:'redraw-scaffold.webp'}
];
function collection(stats) {
  const saved = stats?.[SHOP_FIELD] || {};
  const owned = CATALOG.filter(item => Array.isArray(saved.owned) && saved.owned.includes(item.id));
  const equipped = owned.find(item => item.id === saved.equipped)?.id || null;
  const record = summary(stats);
  return {
    balance:Math.max(0,record.games*20+record.wins*10-owned.reduce((sum,item)=>sum+item.price,0)),
    owned:owned.map(item=>item.id),equipped,catalog:CATALOG
  };
}
function createStore(pool) {
  let init;
  async function ready(){if(!init)init=pool.query(TABLE).catch(e=>{init=null;throw e;});await init;}
  return {
    async record(match){if(!match)throw Error('marineford_invalid_result');await ready();const r=await pool.query(RECORD,[match.id,match.code,JSON.stringify(match.participants),match.winner,match.cpu,match.endedAt,match.actions]);const row=r.rows[0];if(row.recorded&&row.updated!==match.participants.length)throw Error('marineford_profile_count_mismatch');if(!row.recorded){const previous=await pool.query('SELECT match_id FROM launcher_marineford_matches WHERE match_id=$1',[match.id]);if(!previous.rows.length)throw Error('marineford_profile_missing');}return row;},
    async profile(userId){
      await ready();
      const r=await pool.query('SELECT stats FROM player_profiles WHERE user_id=$1 LIMIT 1',[userId]);
      if(!r.rows[0])throw Error('profile_missing');
      const recent=await pool.query(`SELECT winner,has_cpu,ended_at,actions,member->>'team' AS team
        FROM launcher_marineford_matches
        CROSS JOIN LATERAL jsonb_array_elements(participants) AS members(member)
        WHERE member @> jsonb_build_object('user_id',$1::integer)
        ORDER BY ended_at DESC, match_id DESC LIMIT 10`,[userId]);
      return {...summary(r.rows[0].stats),collection:collection(r.rows[0].stats),recent:recent.rows};
    },

  };
}
module.exports={FIELD,KEYS,summary,completed,createStore,newId:()=>crypto.randomUUID()};
